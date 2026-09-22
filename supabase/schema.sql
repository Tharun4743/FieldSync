-- ==============================================================================
-- FieldSync — Complete Single Supabase SQL Schema & Authentic Seed Data
--
-- This single SQL file sets up the complete production database for FieldSync:
--   1. Extensions & Custom Types
--   2. Tables, Constraints & Indexes (Full fields for all 4 roles)
--   3. Automated Triggers & Functions (updated_at, user profile synchronization)
--   4. Row-Level Security (RLS) Policies
--   5. Authentic Seed Data:
--        - 5 Users for all roles:
--            * Tharun Erodde   (ADMIN)       tharun@gmail.com   / 123456
--            * Abi Kumar       (SUPERVISOR)  abi@gmail.com      / 123456
--            * Elakkiya S      (TECHNICIAN)  elakkiya@gmail.com / 123456
--            * Rajesh M        (TECHNICIAN)  rajesh@fieldsync.io / 123456
--            * Bob Abd         (CUSTOMER)    customer@company.com / 123456
--        - 5 Real Industrial Assets (Network, CCTV, Power, Access, IoT)
--        - 5 Sample Real Equipment Inspections across all lifecycle stages
--        - 35 Diagnostic Checklist Items linked to the 5 inspections
--
-- Ready to run directly in the Supabase SQL Editor or via direct PostgreSQL connection.
-- ==============================================================================

-- ── 1. Extensions ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── 2. Tables ─────────────────────────────────────────────────────────────────

-- Users & Profiles
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('CUSTOMER', 'TECHNICIAN', 'SUPERVISOR', 'ADMIN')) DEFAULT 'TECHNICIAN',
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

-- Inspections (Comprehensive schema covering all role workflows: Customer -> Admin -> Supervisor -> Technician)
CREATE TABLE IF NOT EXISTS public.inspections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  site_name TEXT NOT NULL,
  asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN (
    'NEW', 'UNDER_REVIEW', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS',
    'PENDING_VERIFICATION', 'REWORK_REQUESTED', 'RESOLVED', 'REJECTED',
    'REASSIGNED', 'ON_HOLD', 'REOPENED', 'PENDING', 'COMPLETED', 'CANCELLED'
  )) DEFAULT 'PENDING',
  priority TEXT NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')) DEFAULT 'MEDIUM',
  category TEXT CHECK (category IN (
    'NETWORK', 'IT_HARDWARE', 'CCTV_SECURITY', 'ELECTRICAL', 'IOT_SYSTEMS', 'FACILITY_TECH', 'GENERAL'
  )) DEFAULT 'GENERAL',
  issue_status TEXT DEFAULT 'NEW',
  workflow_stage TEXT CHECK (workflow_stage IN (
    'RAISED', 'ASSIGNED', 'COORDINATED', 'FIELD_WORK', 'AWAITING_VERIFICATION', 'REWORK_REQUESTED', 'RESOLVED'
  )) DEFAULT 'RAISED',
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  supervisor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  supervisor_name TEXT,
  supervisor_notes TEXT,
  supervised_at TIMESTAMPTZ,
  reported_by TEXT,
  customer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  customer_phone TEXT,
  customer_email TEXT,
  customer_notes TEXT,
  technician_completed_at TIMESTAMPTZ,
  rework_reason TEXT,
  verified_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  verified_by_name TEXT,
  verified_at TIMESTAMPTZ,
  resolution_summary TEXT,
  scheduled_date DATE,
  -- ── 5 Production Features Fields ─────────────────────────
  asset_verified_at TIMESTAMPTZ,
  asset_verified_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  asset_verified_code TEXT,
  response_deadline TIMESTAMPTZ,
  resolution_deadline TIMESTAMPTZ,
  escalation_level INT DEFAULT 0,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1. Asset Scan Events (QR / Barcode physical verification)
CREATE TABLE IF NOT EXISTS public.asset_scan_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  inspection_id UUID NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  scanned_code TEXT NOT NULL,
  expected_code TEXT NOT NULL,
  is_match BOOLEAN NOT NULL DEFAULT TRUE,
  scanned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  scanner_name TEXT,
  device_id TEXT,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Dual-Stage Before / After Evidence
CREATE TABLE IF NOT EXISTS public.work_evidence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspection_id UUID NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK (stage IN ('BEFORE', 'AFTER')),
  title TEXT NOT NULL,
  description TEXT,
  photo_url TEXT,
  captured_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  captured_by_name TEXT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  gps_latitude NUMERIC,
  gps_longitude NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Digital Signatures & Compliance Sign-Off
CREATE TABLE IF NOT EXISTS public.digital_signatures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspection_id UUID NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  signer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  signer_name TEXT NOT NULL,
  signer_role TEXT NOT NULL CHECK (signer_role IN ('TECHNICIAN', 'SUPERVISOR', 'CUSTOMER')),
  signature_data_url TEXT NOT NULL,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  declaration_text TEXT NOT NULL,
  checksum TEXT
);

-- 4. Enterprise SLA Policies
CREATE TABLE IF NOT EXISTS public.sla_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  priority TEXT NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  category TEXT DEFAULT 'ALL',
  response_minutes INT NOT NULL,
  resolution_minutes INT NOT NULL,
  escalation_1_minutes INT NOT NULL,
  escalation_2_minutes INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
  value_type TEXT NOT NULL,
  notes TEXT,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INT DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  CONSTRAINT uq_inspection_checklist UNIQUE (inspection_id, checklist_item_id)
);

-- Notes
CREATE TABLE IF NOT EXISTS public.notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspection_id UUID NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  author_name TEXT,
  content TEXT,
  text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sync_status TEXT NOT NULL DEFAULT 'synced'
);

-- Media (Photos & Voice Notes)
CREATE TABLE IF NOT EXISTS public.media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspection_id UUID NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  checklist_item_id UUID REFERENCES public.checklist_items(id) ON DELETE SET NULL,
  url TEXT,
  file_name TEXT,
  file_type TEXT,
  mime_type TEXT,
  size INT,
  uploaded_bytes INT DEFAULT 0,
  total_bytes INT DEFAULT 0,
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
  operation_type TEXT NOT NULL DEFAULT 'CREATE',
  payload JSONB NOT NULL,
  logical_clock BIGINT NOT NULL DEFAULT 1,
  schema_version INT NOT NULL DEFAULT 2,
  status TEXT NOT NULL DEFAULT 'APPLIED',
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
  field TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('OPEN', 'RESOLVED', 'IGNORED')) DEFAULT 'OPEN',
  base_value TEXT,
  local_value TEXT,
  remote_value TEXT,
  local_operation_id TEXT,
  remote_operation_id TEXT,
  local_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  remote_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  local_timestamp TIMESTAMPTZ,
  remote_timestamp TIMESTAMPTZ,
  local_value_json JSONB,
  server_value_json JSONB,
  resolved_value_json JSONB,
  resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Immutable Append-Only Audit Trail
CREATE TABLE IF NOT EXISTS public.audit_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  operation_id TEXT,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  device_id TEXT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  inspection_id UUID REFERENCES public.inspections(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  field TEXT,
  before_value TEXT,
  after_value TEXT,
  before_state JSONB,
  after_state JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Yjs CRDT Binary Document Store
CREATE TABLE IF NOT EXISTS public.yjs_updates (
  inspection_id UUID PRIMARY KEY REFERENCES public.inspections(id) ON DELETE CASCADE,
  update_data TEXT,
  update TEXT,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3. Performance Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_inspections_assigned_to ON public.inspections(assigned_to);
CREATE INDEX IF NOT EXISTS idx_inspections_supervisor_id ON public.inspections(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_inspections_customer_id ON public.inspections(customer_id);
CREATE INDEX IF NOT EXISTS idx_inspections_status ON public.inspections(status);
CREATE INDEX IF NOT EXISTS idx_inspections_workflow_stage ON public.inspections(workflow_stage);
CREATE INDEX IF NOT EXISTS idx_checklist_inspection ON public.checklist_items(inspection_id);
CREATE INDEX IF NOT EXISTS idx_results_inspection ON public.inspection_results(inspection_id);
CREATE INDEX IF NOT EXISTS idx_operations_user ON public.operations(user_id);
CREATE INDEX IF NOT EXISTS idx_operations_created ON public.operations(created_at);
CREATE INDEX IF NOT EXISTS idx_conflicts_status ON public.conflicts(status);
CREATE INDEX IF NOT EXISTS idx_audit_inspection ON public.audit_events(inspection_id);

-- ── 4. Automated Functions & Triggers ─────────────────────────────────────────

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
  INSERT INTO public.users (id, email, name, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(UPPER(NEW.raw_user_meta_data->>'role'), 'TECHNICIAN')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    updated_at = NOW();
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
DROP POLICY IF EXISTS "Authenticated users can read users" ON public.users;
CREATE POLICY "Authenticated users can read users" ON public.users FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Authenticated users can manage devices" ON public.devices;
CREATE POLICY "Authenticated users can manage devices" ON public.devices FOR ALL TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can read assets" ON public.assets;
CREATE POLICY "Authenticated users can read assets" ON public.assets FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can read inspections" ON public.inspections;
CREATE POLICY "Authenticated users can read inspections" ON public.inspections FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can update inspections" ON public.inspections;
CREATE POLICY "Authenticated users can update inspections" ON public.inspections FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can read checklist_items" ON public.checklist_items;
CREATE POLICY "Authenticated users can read checklist_items" ON public.checklist_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can manage inspection_results" ON public.inspection_results;
CREATE POLICY "Authenticated users can manage inspection_results" ON public.inspection_results FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage notes" ON public.notes;
CREATE POLICY "Authenticated users can manage notes" ON public.notes FOR ALL TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can manage media" ON public.media;
CREATE POLICY "Authenticated users can manage media" ON public.media FOR ALL TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert operations" ON public.operations;
CREATE POLICY "Authenticated users can insert operations" ON public.operations FOR ALL TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can manage conflicts" ON public.conflicts;
CREATE POLICY "Authenticated users can manage conflicts" ON public.conflicts FOR ALL TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can read audit_events" ON public.audit_events;
CREATE POLICY "Authenticated users can read audit_events" ON public.audit_events FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert audit_events" ON public.audit_events;
CREATE POLICY "Authenticated users can insert audit_events" ON public.audit_events FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can manage yjs_updates" ON public.yjs_updates;
CREATE POLICY "Authenticated users can manage yjs_updates" ON public.yjs_updates FOR ALL TO authenticated USING (true);

-- ── 6. Seed Data: 5 Real Users for All Roles ─────────────────────────────────

-- Insert or update Supabase auth.users (password: 123456 encrypted via bcrypt)
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
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'tharun@gmail.com',
    crypt('123456', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Tharun Erodde","role":"ADMIN"}',
    NOW(),
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'abi@gmail.com',
    crypt('123456', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Abi Kumar","role":"SUPERVISOR"}',
    NOW(),
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'elakkiya@gmail.com',
    crypt('123456', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Elakkiya S","role":"TECHNICIAN"}',
    NOW(),
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'customer@company.com',
    crypt('123456', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Bob Abd","role":"CUSTOMER"}',
    NOW(),
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'rajesh@fieldsync.io',
    crypt('123456', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Rajesh M","role":"TECHNICIAN"}',
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  encrypted_password = EXCLUDED.encrypted_password,
  raw_user_meta_data = EXCLUDED.raw_user_meta_data,
  updated_at = NOW();

-- Insert into public.users
INSERT INTO public.users (id, email, name, full_name, role) VALUES
  ('00000000-0000-0000-0000-000000000001', 'tharun@gmail.com',     'Tharun Erodde', 'Tharun Erodde', 'ADMIN'),
  ('00000000-0000-0000-0000-000000000002', 'abi@gmail.com',        'Abi Kumar',     'Abi Kumar',     'SUPERVISOR'),
  ('00000000-0000-0000-0000-000000000003', 'elakkiya@gmail.com',   'Elakkiya S',    'Elakkiya S',    'TECHNICIAN'),
  ('00000000-0000-0000-0000-000000000004', 'customer@company.com', 'Bob Abd',       'Bob Abd',       'CUSTOMER'),
  ('00000000-0000-0000-0000-000000000005', 'rajesh@fieldsync.io',  'Rajesh M',      'Rajesh M',      'TECHNICIAN')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  name = EXCLUDED.name,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role;

-- ── 7. Seed Data: 5 Real Industrial Assets ────────────────────────────────────
INSERT INTO public.assets (id, name, asset_code, location, type, manufacturer, model) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Wireless AP-204', 'NET-AP204', 'Second Floor — Laboratory 2', 'OTHER', 'UniFi', 'U6-Enterprise'),
  ('a1000000-0000-0000-0000-000000000002', 'PTZ Security Camera CAM-04', 'SEC-CAM04', 'North Perimeter — East Parking Entry', 'OTHER', 'Axis Communications', 'Q6135-LE'),
  ('a1000000-0000-0000-0000-000000000003', 'Modular UPS Unit 3000VA', 'PWR-UPS01', 'Main Facility — Server Room B', 'OTHER', 'APC Schneider', 'Smart-UPS RT 3000'),
  ('a1000000-0000-0000-0000-000000000004', 'RFID Badge Reader R-12', 'ACC-R12', 'Administration Wing A — Main Portal', 'OTHER', 'HID Global', 'Signo 40'),
  ('a1000000-0000-0000-0000-000000000005', 'Environmental IoT Telemetry Gateway', 'IOT-GW01', 'Logistics Facility — Cold Storage 3', 'OTHER', 'Advantech', 'WISE-4012')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  asset_code = EXCLUDED.asset_code,
  location = EXCLUDED.location,
  type = EXCLUDED.type,
  manufacturer = EXCLUDED.manufacturer,
  model = EXCLUDED.model;

-- ── 8. Seed Data: 5 Sample Real Inspections for All Roles ─────────────────────
-- 1: Wi-Fi unavailable in second-floor laboratory (IN_PROGRESS / FIELD_WORK)
-- 2: Security camera offline at East Parking Entry (IN_PROGRESS / AWAITING_VERIFICATION)
-- 3: UPS backup battery audible alarm in Server Room B (PENDING / RAISED)
-- 4: Card reader not unlocking main portal entrance (PENDING / ASSIGNED)
-- 5: Telemetry gateway offline in Cold Storage facility (COMPLETED / RESOLVED)

INSERT INTO public.inspections (
  id,
  title,
  site_name,
  asset_id,
  category,
  status,
  issue_status,
  priority,
  workflow_stage,
  reported_by,
  customer_id,
  customer_email,
  customer_phone,
  customer_notes,
  supervisor_id,
  supervisor_name,
  supervisor_notes,
  supervised_at,
  assigned_to,
  assigned_at,
  technician_completed_at,
  verified_by,
  verified_by_name,
  verified_at,
  resolution_summary,
  scheduled_date,
  version,
  created_at,
  updated_at
) VALUES
  (
    'b1000000-0000-0000-0000-000000000001',
    'Wi-Fi connection unavailable in second-floor laboratory',
    'Second Floor — Laboratory 2',
    'a1000000-0000-0000-0000-000000000001',
    'NETWORK',
    'IN_PROGRESS',
    'IN_PROGRESS',
    'HIGH',
    'FIELD_WORK',
    'Bob Abd',
    '00000000-0000-0000-0000-000000000004',
    'customer@company.com',
    '+1 (555) 234-8901',
    'The laboratory Wi-Fi connection has stopped working. Research workstations cannot authenticate to the laboratory subnet.',
    '00000000-0000-0000-0000-000000000002',
    'Abi Kumar',
    'Check PoE switch port 14 output first. Measure downlink RSSI after power cycle and ensure VLAN 20 is tagged.',
    NOW() - INTERVAL '1 hour',
    '00000000-0000-0000-0000-000000000003',
    NOW() - INTERVAL '2 hours',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    CURRENT_DATE,
    1,
    NOW() - INTERVAL '2 hours',
    NOW()
  ),
  (
    'b1000000-0000-0000-0000-000000000002',
    'Security camera offline at East Parking Entry',
    'North Perimeter — East Parking Entry',
    'a1000000-0000-0000-0000-000000000002',
    'CCTV_SECURITY',
    'IN_PROGRESS',
    'PENDING_VERIFICATION',
    'CRITICAL',
    'AWAITING_VERIFICATION',
    'Security Operations Desk',
    NULL,
    'security@facility.org',
    '+1 (555) 901-4432',
    'Video feed disconnected at 06:30. NVR shows RTSP handshake timeout on Channel 4.',
    '00000000-0000-0000-0000-000000000002',
    'Abi Kumar',
    'Inspect exterior waterproof RJ45 coupling and test with inline PoE tester.',
    NOW() - INTERVAL '2 hours',
    '00000000-0000-0000-0000-000000000003',
    NOW() - INTERVAL '2 hours',
    NOW(),
    NULL,
    NULL,
    NULL,
    NULL,
    CURRENT_DATE,
    1,
    NOW() - INTERVAL '2 hours',
    NOW()
  ),
  (
    'b1000000-0000-0000-0000-000000000003',
    'UPS backup battery audible alarm in Server Room B',
    'Main Facility — Server Room B',
    'a1000000-0000-0000-0000-000000000003',
    'ELECTRICAL',
    'PENDING',
    'NEW',
    'HIGH',
    'RAISED',
    'DevOps Infrastructure Lead',
    '00000000-0000-0000-0000-000000000004',
    'devops@company.com',
    '+1 (555) 782-1199',
    'Beeping error code LED #3 indicating internal battery pack impedance fault.',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NOW(),
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    CURRENT_DATE,
    1,
    NOW(),
    NOW()
  ),
  (
    'b1000000-0000-0000-0000-000000000004',
    'Card reader not unlocking main portal entrance',
    'Administration Wing A — Main Portal',
    'a1000000-0000-0000-0000-000000000004',
    'IT_HARDWARE',
    'PENDING',
    'ASSIGNED',
    'MEDIUM',
    'ASSIGNED',
    'Human Resources Front Office',
    '00000000-0000-0000-0000-000000000004',
    'hr@company.com',
    '+1 (555) 441-2900',
    'Staff badges trigger red blink with no relay activation on the magnetic lock.',
    '00000000-0000-0000-0000-000000000002',
    'Abi Kumar',
    'Verify Wiegand D0/D1 continuity and 12V DC power bus supply under lock load.',
    NOW() - INTERVAL '30 minutes',
    '00000000-0000-0000-0000-000000000003',
    NOW() - INTERVAL '30 minutes',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    CURRENT_DATE,
    1,
    NOW() - INTERVAL '1 hour',
    NOW()
  ),
  (
    'b1000000-0000-0000-0000-000000000005',
    'Telemetry gateway offline in Cold Storage facility',
    'Logistics Facility — Cold Storage 3',
    'a1000000-0000-0000-0000-000000000005',
    'IOT_SYSTEMS',
    'COMPLETED',
    'RESOLVED',
    'MEDIUM',
    'RESOLVED',
    'Cold Chain Compliance Officer',
    '00000000-0000-0000-0000-000000000004',
    'compliance@logistics.com',
    '+1 (555) 602-8811',
    'Loss of MQTT heartbeat packets since yesterday afternoon.',
    '00000000-0000-0000-0000-000000000002',
    'Abi Kumar',
    'Replace 24V DC auxiliary power adapter and reboot gateway.',
    NOW() - INTERVAL '2 hours',
    '00000000-0000-0000-0000-000000000003',
    NOW() - INTERVAL '2 hours',
    NOW() - INTERVAL '1 hour',
    '00000000-0000-0000-0000-000000000002',
    'Abi Kumar',
    NOW(),
    'Defective 24V DIN-rail power supply replaced. Gateway reconnected to MQTT broker, packet transmission verified with 100% telemetry uptime.',
    CURRENT_DATE,
    1,
    NOW() - INTERVAL '2 hours',
    NOW()
  )
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  site_name = EXCLUDED.site_name,
  asset_id = EXCLUDED.asset_id,
  category = EXCLUDED.category,
  status = EXCLUDED.status,
  issue_status = EXCLUDED.issue_status,
  priority = EXCLUDED.priority,
  workflow_stage = EXCLUDED.workflow_stage,
  reported_by = EXCLUDED.reported_by,
  customer_id = EXCLUDED.customer_id,
  customer_email = EXCLUDED.customer_email,
  customer_phone = EXCLUDED.customer_phone,
  customer_notes = EXCLUDED.customer_notes,
  supervisor_id = EXCLUDED.supervisor_id,
  supervisor_name = EXCLUDED.supervisor_name,
  supervisor_notes = EXCLUDED.supervisor_notes,
  supervised_at = EXCLUDED.supervised_at,
  assigned_to = EXCLUDED.assigned_to,
  assigned_at = EXCLUDED.assigned_at,
  technician_completed_at = EXCLUDED.technician_completed_at,
  verified_by = EXCLUDED.verified_by,
  verified_by_name = EXCLUDED.verified_by_name,
  verified_at = EXCLUDED.verified_at,
  resolution_summary = EXCLUDED.resolution_summary,
  updated_at = NOW();

-- ── 9. Seed Data: 35 Diagnostic Checklist Items (7 for each of 5 inspections) ─
INSERT INTO public.checklist_items (id, inspection_id, question, type, required, sort_order, unit, min_value, max_value) VALUES
  -- Items for Inspection 1
  ('c1000001-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'Visual condition of device, mountings, and enclosures', 'GOOD_DAMAGED', true, 1, NULL, NULL, NULL),
  ('c1000001-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', 'Power supply voltage & LED indicator status verified', 'PASS_FAIL', true, 2, NULL, NULL, NULL),
  ('c1000001-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000001', 'Physical cabling and connector integrity secure', 'PASS_FAIL', true, 3, NULL, NULL, NULL),
  ('c1000001-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000001', 'Key signal / operating measurement recorded', 'NUMERIC', false, 4, 'dBm / V', -120, 500),
  ('c1000001-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000001', 'Communication / network handshake confirmed operational', 'PASS_FAIL', true, 5, NULL, NULL, NULL),
  ('c1000001-0000-0000-0000-000000000006', 'b1000000-0000-0000-0000-000000000001', 'Corrective maintenance / component replacement completed', 'PASS_FAIL', true, 6, NULL, NULL, NULL),
  ('c1000001-0000-0000-0000-000000000007', 'b1000000-0000-0000-0000-000000000001', 'Field technician observations & findings', 'TEXT', false, 7, NULL, NULL, NULL),

  -- Items for Inspection 2
  ('c1000002-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002', 'Visual condition of device, mountings, and enclosures', 'GOOD_DAMAGED', true, 1, NULL, NULL, NULL),
  ('c1000002-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', 'Power supply voltage & LED indicator status verified', 'PASS_FAIL', true, 2, NULL, NULL, NULL),
  ('c1000002-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000002', 'Physical cabling and connector integrity secure', 'PASS_FAIL', true, 3, NULL, NULL, NULL),
  ('c1000002-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000002', 'Key signal / operating measurement recorded', 'NUMERIC', false, 4, 'dBm / V', -120, 500),
  ('c1000002-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000002', 'Communication / network handshake confirmed operational', 'PASS_FAIL', true, 5, NULL, NULL, NULL),
  ('c1000002-0000-0000-0000-000000000006', 'b1000000-0000-0000-0000-000000000002', 'Corrective maintenance / component replacement completed', 'PASS_FAIL', true, 6, NULL, NULL, NULL),
  ('c1000002-0000-0000-0000-000000000007', 'b1000000-0000-0000-0000-000000000002', 'Field technician observations & findings', 'TEXT', false, 7, NULL, NULL, NULL),

  -- Items for Inspection 3
  ('c1000003-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000003', 'Visual condition of device, mountings, and enclosures', 'GOOD_DAMAGED', true, 1, NULL, NULL, NULL),
  ('c1000003-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000003', 'Power supply voltage & LED indicator status verified', 'PASS_FAIL', true, 2, NULL, NULL, NULL),
  ('c1000003-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000003', 'Physical cabling and connector integrity secure', 'PASS_FAIL', true, 3, NULL, NULL, NULL),
  ('c1000003-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000003', 'Key signal / operating measurement recorded', 'NUMERIC', false, 4, 'dBm / V', -120, 500),
  ('c1000003-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000003', 'Communication / network handshake confirmed operational', 'PASS_FAIL', true, 5, NULL, NULL, NULL),
  ('c1000003-0000-0000-0000-000000000006', 'b1000000-0000-0000-0000-000000000003', 'Corrective maintenance / component replacement completed', 'PASS_FAIL', true, 6, NULL, NULL, NULL),
  ('c1000003-0000-0000-0000-000000000007', 'b1000000-0000-0000-0000-000000000003', 'Field technician observations & findings', 'TEXT', false, 7, NULL, NULL, NULL),

  -- Items for Inspection 4
  ('c1000004-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000004', 'Visual condition of device, mountings, and enclosures', 'GOOD_DAMAGED', true, 1, NULL, NULL, NULL),
  ('c1000004-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000004', 'Power supply voltage & LED indicator status verified', 'PASS_FAIL', true, 2, NULL, NULL, NULL),
  ('c1000004-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000004', 'Physical cabling and connector integrity secure', 'PASS_FAIL', true, 3, NULL, NULL, NULL),
  ('c1000004-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000004', 'Key signal / operating measurement recorded', 'NUMERIC', false, 4, 'dBm / V', -120, 500),
  ('c1000004-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000004', 'Communication / network handshake confirmed operational', 'PASS_FAIL', true, 5, NULL, NULL, NULL),
  ('c1000004-0000-0000-0000-000000000006', 'b1000000-0000-0000-0000-000000000004', 'Corrective maintenance / component replacement completed', 'PASS_FAIL', true, 6, NULL, NULL, NULL),
  ('c1000004-0000-0000-0000-000000000007', 'b1000000-0000-0000-0000-000000000004', 'Field technician observations & findings', 'TEXT', false, 7, NULL, NULL, NULL),

  -- Items for Inspection 5
  ('c1000005-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000005', 'Visual condition of device, mountings, and enclosures', 'GOOD_DAMAGED', true, 1, NULL, NULL, NULL),
  ('c1000005-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000005', 'Power supply voltage & LED indicator status verified', 'PASS_FAIL', true, 2, NULL, NULL, NULL),
  ('c1000005-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000005', 'Physical cabling and connector integrity secure', 'PASS_FAIL', true, 3, NULL, NULL, NULL),
  ('c1000005-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000005', 'Key signal / operating measurement recorded', 'NUMERIC', false, 4, 'dBm / V', -120, 500),
  ('c1000005-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000005', 'Communication / network handshake confirmed operational', 'PASS_FAIL', true, 5, NULL, NULL, NULL),
  ('c1000005-0000-0000-0000-000000000006', 'b1000000-0000-0000-0000-000000000005', 'Corrective maintenance / component replacement completed', 'PASS_FAIL', true, 6, NULL, NULL, NULL),
  ('c1000005-0000-0000-0000-000000000007', 'b1000000-0000-0000-0000-000000000005', 'Field technician observations & findings', 'TEXT', false, 7, NULL, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET
  question = EXCLUDED.question,
  type = EXCLUDED.type,
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order,
  unit = EXCLUDED.unit,
  min_value = EXCLUDED.min_value,
  max_value = EXCLUDED.max_value;

-- ── 10. Initial Audit Events & Inspection Results ─────────────────────────────
INSERT INTO public.inspection_results (id, inspection_id, checklist_item_id, value, value_type, notes, completed_at, updated_by, version) VALUES
  ('f1000005-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000005', 'c1000005-0000-0000-0000-000000000001', '"GOOD"', 'GOOD_DAMAGED', 'Enclosure intact, no frost ingress', NOW() - INTERVAL '1 hour', '00000000-0000-0000-0000-000000000003', 1),
  ('f1000005-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000005', 'c1000005-0000-0000-0000-000000000002', '"PASS"', 'PASS_FAIL', 'Measured 24.1V DC steady', NOW() - INTERVAL '1 hour', '00000000-0000-0000-0000-000000000003', 1),
  ('f1000005-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000005', 'c1000005-0000-0000-0000-000000000005', '"PASS"', 'PASS_FAIL', 'MQTT ping response latency 18ms', NOW() - INTERVAL '1 hour', '00000000-0000-0000-0000-000000000003', 1)
ON CONFLICT (inspection_id, checklist_item_id) DO UPDATE SET
  value = EXCLUDED.value,
  value_type = EXCLUDED.value_type,
  notes = EXCLUDED.notes,
  updated_at = NOW();

INSERT INTO public.audit_events (id, entity_type, entity_id, inspection_id, user_id, action, after_state) VALUES
  (uuid_generate_v4(), 'INSPECTION', 'b1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'ASSIGNED', '{"assigned_to":"elakkiya@gmail.com","supervisor":"abi@gmail.com"}'),
  (uuid_generate_v4(), 'INSPECTION', 'b1000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000002', 'RESOLVED', '{"verified_by":"abi@gmail.com","status":"RESOLVED"}')
ON CONFLICT DO NOTHING;
