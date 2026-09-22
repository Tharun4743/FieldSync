-- FieldSync Production Database Schema
-- Migration: 001_initial_schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('TECHNICIAN', 'SUPERVISOR', 'ADMIN')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Devices ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS devices (
  device_id TEXT PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  app_version TEXT,
  schema_version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Assets ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  asset_code TEXT NOT NULL UNIQUE,
  location TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('MOTOR', 'COMPRESSOR', 'PUMP', 'GENERATOR', 'VALVE', 'CONVEYOR', 'OTHER')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Inspections ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inspections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  site_name TEXT NOT NULL,
  asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'CRITICAL')),
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  version INT DEFAULT 1
);

-- ── Checklist Items ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS checklist_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('PASS_FAIL', 'GOOD_DAMAGED', 'NUMERIC', 'TEXT', 'BOOLEAN', 'SELECT')),
  required BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  options JSONB,
  unit TEXT,
  min_value DECIMAL,
  max_value DECIMAL
);

-- ── Inspection Results ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inspection_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  checklist_item_id UUID NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
  value TEXT,
  value_type TEXT,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  version INT DEFAULT 1,
  last_operation_id TEXT
);

-- Unique constraint: one result per checklist item per inspection
CREATE UNIQUE INDEX IF NOT EXISTS idx_results_unique ON inspection_results (inspection_id, checklist_item_id);

-- ── Notes ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  author_id UUID REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Media ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size BIGINT,
  cloudinary_public_id TEXT,
  secure_url TEXT,
  upload_status TEXT DEFAULT 'PENDING' CHECK (upload_status IN ('PENDING', 'UPLOADING', 'PAUSED', 'FAILED', 'COMPLETED')),
  uploaded_bytes BIGINT DEFAULT 0,
  total_bytes BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Operations (append-only operation log) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS operations (
  operation_id TEXT PRIMARY KEY,
  device_id TEXT,
  user_id UUID REFERENCES users(id),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('CREATE', 'UPDATE', 'DELETE')),
  payload JSONB,
  logical_clock BIGINT DEFAULT 0,
  schema_version INT DEFAULT 1,
  created_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Conflicts ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conflicts (
  id TEXT PRIMARY KEY,
  inspection_id UUID REFERENCES inspections(id),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  field TEXT NOT NULL,
  base_value TEXT,
  local_value TEXT,
  remote_value TEXT,
  local_operation_id TEXT REFERENCES operations(operation_id),
  remote_operation_id TEXT REFERENCES operations(operation_id),
  local_user_id UUID REFERENCES users(id),
  remote_user_id UUID REFERENCES users(id),
  local_updated_at TIMESTAMPTZ,
  remote_updated_at TIMESTAMPTZ,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RESOLVED', 'IGNORED')),
  resolved_value TEXT,
  resolved_by UUID REFERENCES users(id),
  resolution_type TEXT CHECK (resolution_type IN ('KEEP_LOCAL', 'KEEP_REMOTE', 'CUSTOM')),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Audit Events (append-only, never updated) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  operation_id TEXT,
  user_id UUID REFERENCES users(id),
  device_id TEXT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  before_value JSONB,
  after_value JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Yjs State (per-inspection CRDT state) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS yjs_states (
  inspection_id UUID PRIMARY KEY REFERENCES inspections(id) ON DELETE CASCADE,
  state_update TEXT NOT NULL,  -- base64-encoded Yjs state update
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Sync Cursors ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sync_cursors (
  device_id TEXT PRIMARY KEY,
  last_pull_cursor TEXT DEFAULT '',
  last_push_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_inspections_updated_at ON inspections (updated_at);
CREATE INDEX IF NOT EXISTS idx_inspections_assigned_to ON inspections (assigned_to);
CREATE INDEX IF NOT EXISTS idx_results_inspection ON inspection_results (inspection_id);
CREATE INDEX IF NOT EXISTS idx_results_updated_at ON inspection_results (updated_at);
CREATE INDEX IF NOT EXISTS idx_notes_inspection ON notes (inspection_id);
CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes (updated_at);
CREATE INDEX IF NOT EXISTS idx_operations_entity ON operations (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_operations_created_at ON operations (created_at);
CREATE INDEX IF NOT EXISTS idx_conflicts_inspection ON conflicts (inspection_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_status ON conflicts (status);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_events (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_inspection ON audit_events (inspection_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_events (created_at);

-- ── Updated_at trigger function ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_inspections_updated_at BEFORE UPDATE ON inspections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_assets_updated_at BEFORE UPDATE ON assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_notes_updated_at BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
