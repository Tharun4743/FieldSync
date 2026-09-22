-- FieldSync Row Level Security Policies
-- Migration: 002_rls

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
ALTER TABLE conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

-- ── Users ────────────────────────────────────────────────────────────────────
-- Users can read their own record; admins can read all
CREATE POLICY "users_read_own" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_read_admin" ON users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'ADMIN')
  );

-- ── Assets ────────────────────────────────────────────────────────────────────
-- All authenticated users can read assets
CREATE POLICY "assets_read" ON assets
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only admins can insert/update assets
CREATE POLICY "assets_admin_write" ON assets
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'ADMIN')
  );

-- ── Inspections ───────────────────────────────────────────────────────────────
-- Technicians see assigned inspections; supervisors/admins see all
CREATE POLICY "inspections_read_assigned" ON inspections
  FOR SELECT USING (
    assigned_to = auth.uid()
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('SUPERVISOR', 'ADMIN'))
  );

CREATE POLICY "inspections_admin_write" ON inspections
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'ADMIN')
  );

CREATE POLICY "inspections_update_own" ON inspections
  FOR UPDATE USING (
    assigned_to = auth.uid()
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('SUPERVISOR', 'ADMIN'))
  );

-- ── Checklist Items ───────────────────────────────────────────────────────────
CREATE POLICY "checklist_items_read" ON checklist_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM inspections i
      WHERE i.id = checklist_items.inspection_id
        AND (i.assigned_to = auth.uid()
          OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('SUPERVISOR', 'ADMIN')))
    )
  );

-- ── Inspection Results ────────────────────────────────────────────────────────
CREATE POLICY "results_read" ON inspection_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM inspections i
      WHERE i.id = inspection_results.inspection_id
        AND (i.assigned_to = auth.uid()
          OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('SUPERVISOR', 'ADMIN')))
    )
  );

CREATE POLICY "results_write_assigned" ON inspection_results
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM inspections i
      WHERE i.id = inspection_results.inspection_id
        AND (i.assigned_to = auth.uid()
          OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('SUPERVISOR', 'ADMIN')))
    )
  );

-- ── Notes ─────────────────────────────────────────────────────────────────────
CREATE POLICY "notes_read" ON notes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM inspections i
      WHERE i.id = notes.inspection_id
        AND (i.assigned_to = auth.uid()
          OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('SUPERVISOR', 'ADMIN')))
    )
  );

CREATE POLICY "notes_write" ON notes
  FOR INSERT WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM inspections i
      WHERE i.id = notes.inspection_id AND i.assigned_to = auth.uid()
    )
  );

-- ── Media ─────────────────────────────────────────────────────────────────────
CREATE POLICY "media_read" ON media
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM inspections i
      WHERE i.id = media.inspection_id
        AND (i.assigned_to = auth.uid()
          OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('SUPERVISOR', 'ADMIN')))
    )
  );

-- ── Conflicts ─────────────────────────────────────────────────────────────────
-- Supervisors and admins can read all conflicts; technicians can read their own
CREATE POLICY "conflicts_read" ON conflicts
  FOR SELECT USING (
    local_user_id = auth.uid()
    OR remote_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('SUPERVISOR', 'ADMIN'))
  );

CREATE POLICY "conflicts_resolve" ON conflicts
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('SUPERVISOR', 'ADMIN'))
  );

-- ── Audit Events ──────────────────────────────────────────────────────────────
-- Read-only for supervisors/admins; technicians can read events for their inspections
CREATE POLICY "audit_read" ON audit_events
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('SUPERVISOR', 'ADMIN'))
  );

-- Audit events are append-only — no UPDATE or DELETE allowed for any user
CREATE POLICY "audit_no_update" ON audit_events
  FOR UPDATE USING (false);

CREATE POLICY "audit_no_delete" ON audit_events
  FOR DELETE USING (false);
