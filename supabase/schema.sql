-- ==============================================================================
-- FieldSync — Complete Single Supabase SQL Schema (WA-1)
--
-- This single SQL file sets up the complete production database for FieldSync:
--   1. Extensions & Custom Types
--   2. Tables, Constraints & Indexes
--   3. Automated Triggers & Functions (updated_at, user profile synchronization)
--   4. Row-Level Security (RLS) Policies
--   5. Authentic Seed Data:
--        - Tharun   (ADMIN)       tharun@gmail.com   / 123456
--        - Abi      (SUPERVISOR)  abi@gmail.com      / 123456
--        - Elakkiya (TECHNICIAN)  elakkiya@gmail.com / 123456
--        - Real Industrial Assets & Assigned Checklist Items
--
-- Ready to run directly in the Supabase SQL Editor.
-- ==============================================================================

-- ── 1. Extensions ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── 2. Tables ─────────────────────────────────────────────────────────────────

-- Users & Profiles
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('TECHNICIAN', 'SUPERVISOR', 'ADMIN')) DEFAULT 'TECHNICIAN',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backward-compatibility view for profiles
CREATE OR REPLACE VIEW public.profiles AS SELECT * FROM public.users;

-- Devices
CREATE TABLE IF NOT EXISTS public.devices (
  device_id TEXT PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  app_version TEXT,
  schema_version INT DEFAULT 3,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Industrial Assets
CREATE TABLE IF NOT EXISTS public.assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  asset_code TEXT NOT NULL UNIQUE,
  location TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('MOTOR', 'COMPRESSOR', 'PUMP', 'GENERATOR', 'VALVE', 'CONVEYOR', 'OTHER')),
  manufacturer TEXT,
  model TEXT,
  install_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Inspections
CREATE TABLE IF NOT EXISTS public.inspections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  site_name TEXT NOT NULL,
  asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')) DEFAULT 'PENDING',
  priority TEXT NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')) DEFAULT 'MEDIUM',
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  scheduled_date DATE,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Checklist Items
CREATE TABLE IF NOT EXISTS public.checklist_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspection_id UUID NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('PASS_FAIL', 'GOOD_DAMAGED', 'NUMERIC', 'TEXT', 'BOOLEAN', 'SELECT')),
  required BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  unit TEXT,
  min_value NUMERIC,
  max_value NUMERIC,
  options JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Inspection Results (Compound index prevents duplicate observations)
CREATE TABLE IF NOT EXISTS public.inspection_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspection_id UUID NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  checklist_item_id UUID NOT NULL REFERENCES public.checklist_items(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  value_type TEXT NOT NULL CHECK (value_type IN ('string', 'number', 'boolean')),
  notes TEXT,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sync_status TEXT NOT NULL DEFAULT 'synced',
  CONSTRAINT uq_inspection_checklist UNIQUE (inspection_id, checklist_item_id)
);

-- Notes
CREATE TABLE IF NOT EXISTS public.notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspection_id UUID NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sync_status TEXT NOT NULL DEFAULT 'synced'
);

-- Media (Photos & Voice Notes)
CREATE TABLE IF NOT EXISTS public.media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspection_id UUID NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  checklist_item_id UUID REFERENCES public.checklist_items(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INT,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  upload_status TEXT NOT NULL DEFAULT 'COMPLETED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pending & Synchronized Operations (Append-only queue replay)
CREATE TABLE IF NOT EXISTS public.operations (
  operation_id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE', 'UPSERT')),
  payload JSONB NOT NULL,
  logical_clock BIGINT NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'COMPLETED',
  retry_count INT DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Human-Readable Conflicts
CREATE TABLE IF NOT EXISTS public.conflicts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspection_id UUID REFERENCES public.inspections(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('OPEN', 'RESOLVED', 'IGNORED')) DEFAULT 'OPEN',
  local_value JSONB,
  server_value JSONB,
  resolved_value JSONB,
  resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Immutable Append-Only Audit Trail
CREATE TABLE IF NOT EXISTS public.audit_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  operation_id TEXT,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  inspection_id UUID REFERENCES public.inspections(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  before_state JSONB,
  after_state JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Yjs CRDT Binary Document Store
CREATE TABLE IF NOT EXISTS public.yjs_updates (
  inspection_id UUID PRIMARY KEY REFERENCES public.inspections(id) ON DELETE CASCADE,
  update TEXT NOT NULL,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3. Performance Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_inspections_assigned_to ON public.inspections(assigned_to);
CREATE INDEX IF NOT EXISTS idx_inspections_status ON public.inspections(status);
CREATE INDEX IF NOT EXISTS idx_checklist_inspection ON public.checklist_items(inspection_id);
CREATE INDEX IF NOT EXISTS idx_results_inspection ON public.inspection_results(inspection_id);
CREATE INDEX IF NOT EXISTS idx_operations_user ON public.operations(user_id);
CREATE INDEX IF NOT EXISTS idx_operations_created ON public.operations(created_at);
CREATE INDEX IF NOT EXISTS idx_conflicts_status ON public.conflicts(status);
CREATE INDEX IF NOT EXISTS idx_audit_inspection ON public.audit_events(inspection_id);

-- ── 4. Automated Functions & Triggers ─────────────────────────────────────────

-- Trigger for auto-updating updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_users_updated_at ON public.users;
CREATE TRIGGER trigger_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_assets_updated_at ON public.assets;
CREATE TRIGGER trigger_assets_updated_at
  BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_inspections_updated_at ON public.inspections;
CREATE TRIGGER trigger_inspections_updated_at
  BEFORE UPDATE ON public.inspections
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_results_updated_at ON public.inspection_results;
CREATE TRIGGER trigger_results_updated_at
  BEFORE UPDATE ON public.inspection_results
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Trigger to synchronize auth.users signups with public.users
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(UPPER(NEW.raw_user_meta_data->>'role'), 'TECHNICIAN')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    role = EXCLUDED.role;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ── 5. Row-Level Security (RLS) ───────────────────────────────────────────────
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yjs_updates ENABLE ROW LEVEL SECURITY;

-- Permissive policies for authenticated users
CREATE POLICY "Authenticated users can read users" ON public.users FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Authenticated users can manage devices" ON public.devices FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated users can read assets" ON public.assets FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read inspections" ON public.inspections FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can update inspections" ON public.inspections FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can read checklist_items" ON public.checklist_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage inspection_results" ON public.inspection_results FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage notes" ON public.notes FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage media" ON public.media FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert operations" ON public.operations FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage conflicts" ON public.conflicts FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated users can read audit_events" ON public.audit_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert audit_events" ON public.audit_events FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can manage yjs_updates" ON public.yjs_updates FOR ALL TO authenticated USING (true);

-- ── 6. Seed Data (Tharun, Abi, Elakkiya in 3 Roles) ──────────────────────────

-- A. Insert into Supabase auth.users (password: 123456 encrypted via bcrypt)
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) VALUES 
  (
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'tharun@gmail.com',
    crypt('123456', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Tharun","role":"ADMIN"}',
    NOW(),
    NOW()
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'abi@gmail.com',
    crypt('123456', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Abi","role":"SUPERVISOR"}',
    NOW(),
    NOW()
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'elakkiya@gmail.com',
    crypt('123456', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Elakkiya","role":"TECHNICIAN"}',
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  encrypted_password = EXCLUDED.encrypted_password,
  raw_user_meta_data = EXCLUDED.raw_user_meta_data,
  updated_at = NOW();

-- B. Insert into public.users
INSERT INTO public.users (id, email, name, role) VALUES
  ('11111111-1111-1111-1111-111111111111', 'tharun@gmail.com',   'Tharun',   'ADMIN'),
  ('22222222-2222-2222-2222-222222222222', 'abi@gmail.com',      'Abi',      'SUPERVISOR'),
  ('33333333-3333-3333-3333-333333333333', 'elakkiya@gmail.com', 'Elakkiya', 'TECHNICIAN')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  name = EXCLUDED.name,
  role = EXCLUDED.role;

-- C. Industrial Assets
INSERT INTO public.assets (id, name, asset_code, location, type, manufacturer, model) VALUES
  ('a1111111-0000-0000-0000-000000000001', 'Cooling Tower Motor A',   'M-101', 'Facility A — Level 2', 'MOTOR',       'Siemens', 'Simotics GP'),
  ('a1111111-0000-0000-0000-000000000002', 'Compressor Unit 201',     'C-201', 'Facility A — Basement', 'COMPRESSOR', 'Atlas Copco', 'GA 75'),
  ('a1111111-0000-0000-0000-000000000003', 'Main Circulation Pump',   'P-301', 'Facility B — Floor 1',  'PUMP',       'Grundfos', 'CR 45'),
  ('a1111111-0000-0000-0000-000000000004', 'Standby Diesel Generator','G-101', 'Facility B — Yard',     'GENERATOR',  'Cummins', 'QSK60')
ON CONFLICT (id) DO NOTHING;

-- D. Assigned Field Inspections (Assigned to Elakkiya)
INSERT INTO public.inspections (id, title, site_name, asset_id, status, priority, assigned_to, assigned_at, scheduled_date) VALUES
  ('i1111111-0000-0000-0000-000000000001',
   'Quarterly Motor Inspection — M-101',
   'Facility A', 'a1111111-0000-0000-0000-000000000001',
   'IN_PROGRESS', 'HIGH',
   '33333333-3333-3333-3333-333333333333',
   NOW() - INTERVAL '1 day', CURRENT_DATE),

  ('i1111111-0000-0000-0000-000000000002',
   'Critical Compressor Preventive Check — C-201',
   'Facility A', 'a1111111-0000-0000-0000-000000000002',
   'PENDING', 'CRITICAL',
   '33333333-3333-3333-3333-333333333333',
   NOW() - INTERVAL '4 hours', CURRENT_DATE)
ON CONFLICT (id) DO NOTHING;

-- E. Checklist Items for Inspection 1
INSERT INTO public.checklist_items (id, inspection_id, question, type, required, sort_order, unit, min_value, max_value) VALUES
  ('c1111111-0000-0000-0000-000000000001', 'i1111111-0000-0000-0000-000000000001', 'Inspect motor casing for physical fractures or oil leakage', 'GOOD_DAMAGED', true, 1, NULL, NULL, NULL),
  ('c1111111-0000-0000-0000-000000000002', 'i1111111-0000-0000-0000-000000000001', 'Verify emergency stop switch and safety interlocks', 'PASS_FAIL', true, 2, NULL, NULL, NULL),
  ('c1111111-0000-0000-0000-000000000003', 'i1111111-0000-0000-0000-000000000001', 'Measure drive-end bearing surface temperature', 'NUMERIC', true, 3, '°C', 20.0, 95.0),
  ('c1111111-0000-0000-0000-000000000004', 'i1111111-0000-0000-0000-000000000001', 'Record overall vibration velocity (RMS)', 'NUMERIC', true, 4, 'mm/s', 0.1, 7.1)
ON CONFLICT (id) DO NOTHING;

-- F. Initial Audit Log Entry
INSERT INTO public.audit_events (id, entity_type, entity_id, inspection_id, user_id, action, after_state) VALUES
  (uuid_generate_v4(), 'INSPECTION', 'i1111111-0000-0000-0000-000000000001', 'i1111111-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'ASSIGNED', '{"assigned_to":"elakkiya@gmail.com","assigned_by":"abi@gmail.com"}')
ON CONFLICT DO NOTHING;
