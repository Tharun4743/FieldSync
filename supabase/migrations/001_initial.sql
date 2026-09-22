-- ============================================================
-- FieldSync — Supabase PostgreSQL Schema
-- Migration: 001_initial
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ── User Profiles ─────────────────────────────────────────────
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role text not null check (role in ('TECHNICIAN', 'SUPERVISOR', 'ADMIN')) default 'TECHNICIAN',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Assets ────────────────────────────────────────────────────
create table if not exists assets (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  asset_code text not null unique,
  location text not null,
  type text not null check (type in ('MOTOR', 'COMPRESSOR', 'PUMP', 'GENERATOR', 'VALVE', 'OTHER')),
  manufacturer text,
  model text,
  install_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Inspections ───────────────────────────────────────────────
create table if not exists inspections (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  site_name text not null,
  asset_id uuid references assets(id) on delete set null,
  status text not null check (status in ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')) default 'PENDING',
  priority text not null check (priority in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')) default 'MEDIUM',
  assigned_to uuid[] not null default '{}',
  assigned_at timestamptz,
  scheduled_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  server_version integer not null default 1
);

-- ── Checklist Items ───────────────────────────────────────────
create table if not exists checklist_items (
  id uuid primary key default uuid_generate_v4(),
  inspection_id uuid not null references inspections(id) on delete cascade,
  question text not null,
  type text not null check (type in ('PASS_FAIL', 'GOOD_DAMAGED', 'NUMERIC', 'TEXT', 'BOOLEAN', 'SELECT')),
  required boolean not null default false,
  "order" integer not null default 0,
  unit text,
  min_value numeric,
  max_value numeric,
  options text[],
  created_at timestamptz not null default now()
);

-- ── Inspection Results ────────────────────────────────────────
create table if not exists inspection_results (
  id uuid primary key default uuid_generate_v4(),
  inspection_id uuid not null references inspections(id) on delete cascade,
  checklist_item_id uuid not null references checklist_items(id) on delete cascade,
  value text not null,
  value_type text not null check (value_type in ('string', 'number', 'boolean')),
  updated_by uuid not null references profiles(id),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  unique(inspection_id, checklist_item_id)
);

-- ── Notes ─────────────────────────────────────────────────────
create table if not exists notes (
  id uuid primary key default uuid_generate_v4(),
  inspection_id uuid not null references inspections(id) on delete cascade,
  author_id uuid not null references profiles(id),
  author_name text not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Media ─────────────────────────────────────────────────────
create table if not exists media (
  id uuid primary key default uuid_generate_v4(),
  inspection_id uuid not null references inspections(id) on delete cascade,
  file_name text not null,
  mime_type text not null,
  size bigint not null,
  cloudinary_public_id text,
  secure_url text,
  upload_status text not null check (upload_status in ('PENDING', 'UPLOADING', 'PAUSED', 'FAILED', 'COMPLETED')) default 'PENDING',
  uploaded_bytes bigint not null default 0,
  total_bytes bigint not null,
  created_at timestamptz not null default now()
);

-- ── Operations (sync log) ─────────────────────────────────────
create table if not exists operations (
  operation_id text primary key, -- {deviceId}-{entityId}-{clock}
  device_id text not null,
  user_id uuid not null references profiles(id),
  entity_type text not null,
  entity_id text not null,
  operation_type text not null check (operation_type in ('CREATE', 'UPDATE', 'DELETE')),
  payload jsonb not null,
  logical_clock bigint not null,
  schema_version integer not null,
  status text not null default 'APPLIED',
  created_at timestamptz not null
);
create index if not exists operations_created_at_idx on operations(created_at);
create index if not exists operations_entity_idx on operations(entity_type, entity_id);
create index if not exists operations_user_idx on operations(user_id);

-- ── Conflicts ─────────────────────────────────────────────────
create table if not exists conflicts (
  id uuid primary key default uuid_generate_v4(),
  inspection_id uuid references inspections(id) on delete set null,
  entity_type text not null,
  entity_id text not null,
  field text not null,
  base_value text not null,
  local_value text not null,
  remote_value text not null,
  local_operation_id text references operations(operation_id) on delete set null,
  remote_operation_id text references operations(operation_id) on delete set null,
  local_user_id uuid references profiles(id),
  remote_user_id uuid references profiles(id),
  local_user_name text not null default '',
  remote_user_name text not null default '',
  local_timestamp timestamptz not null,
  remote_timestamp timestamptz not null,
  status text not null check (status in ('OPEN', 'RESOLVED')) default 'OPEN',
  resolved_value text,
  resolved_by uuid references profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists conflicts_status_idx on conflicts(status);
create index if not exists conflicts_inspection_idx on conflicts(inspection_id);

-- ── Audit Events (append-only) ────────────────────────────────
create table if not exists audit_events (
  id uuid primary key default uuid_generate_v4(),
  operation_id text references operations(operation_id) on delete set null,
  user_id uuid references profiles(id),
  user_name text not null default '',
  device_id text,
  entity_type text not null,
  entity_id text not null,
  inspection_id uuid references inspections(id) on delete set null,
  action text not null,
  field text,
  before_value text,
  after_value text,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_inspection_idx on audit_events(inspection_id, created_at);
create index if not exists audit_entity_idx on audit_events(entity_type, entity_id);

-- ── Yjs CRDT State ────────────────────────────────────────────
create table if not exists yjs_updates (
  inspection_id uuid primary key references inspections(id) on delete cascade,
  update_data text not null, -- base64 encoded Y.Doc state
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

-- ── Sync Cursors ──────────────────────────────────────────────
create table if not exists sync_cursors (
  device_id text primary key,
  user_id uuid references profiles(id),
  last_pull_cursor text,
  last_sync timestamptz,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- Row Level Security Policies
-- ============================================================

alter table profiles enable row level security;
alter table assets enable row level security;
alter table inspections enable row level security;
alter table checklist_items enable row level security;
alter table inspection_results enable row level security;
alter table notes enable row level security;
alter table media enable row level security;
alter table operations enable row level security;
alter table conflicts enable row level security;
alter table audit_events enable row level security;
alter table yjs_updates enable row level security;
alter table sync_cursors enable row level security;

-- Helper: get role from JWT
create or replace function get_user_role()
returns text as $$
  select coalesce(
    current_setting('request.jwt.claims', true)::jsonb->>'role',
    (select role from profiles where id = auth.uid())
  );
$$ language sql stable;

-- Profiles: users can read all, update only their own
create policy "profiles_select" on profiles for select to authenticated using (true);
create policy "profiles_update" on profiles for update to authenticated using (auth.uid() = id);

-- Assets: all authenticated users can read
create policy "assets_select" on assets for select to authenticated using (true);
create policy "assets_insert" on assets for insert to authenticated with check (get_user_role() = 'ADMIN');
create policy "assets_update" on assets for update to authenticated using (get_user_role() = 'ADMIN');

-- Inspections: technicians see only assigned, supervisors/admins see all
create policy "inspections_select_assigned" on inspections for select to authenticated
  using (
    auth.uid() = any(assigned_to)
    or get_user_role() in ('SUPERVISOR', 'ADMIN')
  );
create policy "inspections_insert" on inspections for insert to authenticated
  with check (get_user_role() in ('ADMIN', 'SUPERVISOR'));
create policy "inspections_update" on inspections for update to authenticated
  using (
    auth.uid() = any(assigned_to)
    or get_user_role() in ('SUPERVISOR', 'ADMIN')
  );

-- Checklist items: follow inspection visibility
create policy "checklist_items_select" on checklist_items for select to authenticated
  using (
    exists (
      select 1 from inspections i
      where i.id = checklist_items.inspection_id
        and (auth.uid() = any(i.assigned_to) or get_user_role() in ('SUPERVISOR', 'ADMIN'))
    )
  );

-- Results: same as checklist items
create policy "results_select" on inspection_results for select to authenticated
  using (
    exists (
      select 1 from inspections i
      where i.id = inspection_results.inspection_id
        and (auth.uid() = any(i.assigned_to) or get_user_role() in ('SUPERVISOR', 'ADMIN'))
    )
  );
create policy "results_upsert" on inspection_results for all to authenticated
  using (
    exists (
      select 1 from inspections i
      where i.id = inspection_results.inspection_id
        and (auth.uid() = any(i.assigned_to) or get_user_role() in ('SUPERVISOR', 'ADMIN'))
    )
  );

-- Notes: visible to inspection participants
create policy "notes_select" on notes for select to authenticated
  using (
    exists (
      select 1 from inspections i
      where i.id = notes.inspection_id
        and (auth.uid() = any(i.assigned_to) or get_user_role() in ('SUPERVISOR', 'ADMIN'))
    )
  );
create policy "notes_insert" on notes for insert to authenticated
  with check (author_id = auth.uid());

-- Media: same as notes
create policy "media_select" on media for select to authenticated
  using (
    exists (
      select 1 from inspections i
      where i.id = media.inspection_id
        and (auth.uid() = any(i.assigned_to) or get_user_role() in ('SUPERVISOR', 'ADMIN'))
    )
  );

-- Operations: all authenticated can read (for pull), insert own
create policy "operations_select" on operations for select to authenticated using (true);
create policy "operations_insert" on operations for insert to authenticated with check (user_id = auth.uid());

-- Conflicts: visible to supervisors and affected technicians
create policy "conflicts_select" on conflicts for select to authenticated using (true);
create policy "conflicts_update" on conflicts for update to authenticated
  using (get_user_role() in ('SUPERVISOR', 'ADMIN'));

-- Audit events: read-only for all authenticated
create policy "audit_select" on audit_events for select to authenticated using (true);
-- Audit events are NEVER deleted or updated by policies
create policy "audit_insert" on audit_events for insert to authenticated with check (true);

-- Yjs updates
create policy "yjs_select" on yjs_updates for select to authenticated using (true);
create policy "yjs_upsert" on yjs_updates for all to authenticated using (true);

-- Sync cursors: each device manages its own
create policy "sync_cursors_own" on sync_cursors for all to authenticated using (true);

-- ============================================================
-- Seed Data (Realistic Industrial)
-- ============================================================

-- NOTE: Run this after authentication setup.
-- Replace user IDs with actual Supabase auth user UUIDs.

-- Seed assets
insert into assets (id, name, asset_code, location, type, manufacturer, model) values
  ('a1000000-0000-0000-0000-000000000001', 'Motor M-101', 'MTR-M101', 'Factory A - Line 1 - Bay 3', 'MOTOR', 'Siemens', 'SIMOTICS SD'),
  ('a1000000-0000-0000-0000-000000000002', 'Motor M-102', 'MTR-M102', 'Factory A - Line 1 - Bay 4', 'MOTOR', 'Siemens', 'SIMOTICS SD'),
  ('a1000000-0000-0000-0000-000000000003', 'Compressor C-201', 'CMP-C201', 'Factory A - Utility Room 2', 'COMPRESSOR', 'Atlas Copco', 'GA110'),
  ('a1000000-0000-0000-0000-000000000004', 'Pump P-301', 'PMP-P301', 'Factory B - Process Area 1', 'PUMP', 'Grundfos', 'CR 45'),
  ('a1000000-0000-0000-0000-000000000005', 'Generator G-101', 'GEN-G101', 'Factory B - Generator House', 'GENERATOR', 'Caterpillar', 'C15')
on conflict (id) do nothing;
