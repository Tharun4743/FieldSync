-- FieldSync Realistic Seed Data
-- Run this once after schema setup to populate demo data.
-- Migration: 003_seed_data

-- ── Users ────────────────────────────────────────────────────────────────────
-- NOTE: Auth users must be created first via Supabase Auth dashboard or API.
-- These are the profile records. Replace UUIDs with real auth.users IDs.

INSERT INTO users (id, email, name, role) VALUES
  ('1d7e28ec-e29e-4f29-958e-b2f2be940063', 'admin@gmail.com',      'System Admin',   'ADMIN'),
  ('c7ae2610-6be0-46d3-871a-d3690abe3f16', 'supervisor@gmail.com', 'Site Supervisor','SUPERVISOR'),
  ('fc260600-d20d-46e8-8815-d6f9b5c1e927', 'technician@gmail.com', 'Field Technician','TECHNICIAN')
ON CONFLICT (id) DO NOTHING;

-- ── Assets ────────────────────────────────────────────────────────────────────
INSERT INTO assets (id, name, asset_code, location, type) VALUES
  ('a1111111-0000-0000-0000-000000000001', 'Cooling Tower Motor A',   'M-101', 'Factory A — Level 2', 'MOTOR'),
  ('a1111111-0000-0000-0000-000000000002', 'Compressor Unit 201',     'C-201', 'Factory A — Basement',  'COMPRESSOR'),
  ('a1111111-0000-0000-0000-000000000003', 'Main Circulation Pump',   'P-301', 'Factory B — Floor 1', 'PUMP'),
  ('a1111111-0000-0000-0000-000000000004', 'Standby Generator',       'G-101', 'Factory B — Yard',    'GENERATOR'),
  ('a1111111-0000-0000-0000-000000000005', 'Drive Motor — Line 2',    'M-102', 'Factory A — Level 1', 'MOTOR')
ON CONFLICT (id) DO NOTHING;

-- ── Inspections ───────────────────────────────────────────────────────────────
INSERT INTO inspections (id, title, site_name, asset_id, status, priority, assigned_to, assigned_at) VALUES
  ('i1111111-0000-0000-0000-000000000001',
   'Quarterly Motor Inspection — M-101',
   'Factory A', 'a1111111-0000-0000-0000-000000000001',
   'IN_PROGRESS', 'HIGH',
   '11111111-1111-1111-1111-111111111111',
   NOW() - INTERVAL '2 days'),

  ('i1111111-0000-0000-0000-000000000002',
   'Compressor Maintenance Check — C-201',
   'Factory A', 'a1111111-0000-0000-0000-000000000002',
   'PENDING', 'CRITICAL',
   '22222222-2222-2222-2222-222222222222',
   NOW() - INTERVAL '1 day'),

  ('i1111111-0000-0000-0000-000000000003',
   'Weekly Pump Inspection — P-301',
   'Factory B', 'a1111111-0000-0000-0000-000000000003',
   'IN_PROGRESS', 'NORMAL',
   '11111111-1111-1111-1111-111111111111',
   NOW() - INTERVAL '3 hours'),

  ('i1111111-0000-0000-0000-000000000004',
   'Generator Load Test — G-101',
   'Factory B', 'a1111111-0000-0000-0000-000000000004',
   'COMPLETED', 'HIGH',
   '33333333-3333-3333-3333-333333333333',
   NOW() - INTERVAL '5 days'),

  ('i1111111-0000-0000-0000-000000000005',
   'Drive Motor Full Inspection — M-102',
   'Factory A', 'a1111111-0000-0000-0000-000000000005',
   'IN_PROGRESS', 'CRITICAL',
   '22222222-2222-2222-2222-222222222222',
   NOW() - INTERVAL '6 hours')
ON CONFLICT (id) DO NOTHING;

-- ── Checklist Items for Motor Inspection (M-101) ──────────────────────────────
INSERT INTO checklist_items (id, inspection_id, question, type, required, sort_order, unit, min_value, max_value) VALUES
  ('c1000001-0000-0000-0000-000000000001', 'i1111111-0000-0000-0000-000000000001', 'Motor housing condition', 'GOOD_DAMAGED', true, 1, null, null, null),
  ('c1000001-0000-0000-0000-000000000002', 'i1111111-0000-0000-0000-000000000001', 'Bearing temperature', 'NUMERIC', true, 2, '°C', 0, 120),
  ('c1000001-0000-0000-0000-000000000003', 'i1111111-0000-0000-0000-000000000001', 'Lubrication status', 'PASS_FAIL', true, 3, null, null, null),
  ('c1000001-0000-0000-0000-000000000004', 'i1111111-0000-0000-0000-000000000001', 'Vibration level', 'NUMERIC', true, 4, 'mm/s', 0, 50),
  ('c1000001-0000-0000-0000-000000000005', 'i1111111-0000-0000-0000-000000000001', 'Electrical connection integrity', 'PASS_FAIL', true, 5, null, null, null),
  ('c1000001-0000-0000-0000-000000000006', 'i1111111-0000-0000-0000-000000000001', 'Emergency stop functional', 'BOOLEAN', true, 6, null, null, null),
  ('c1000001-0000-0000-0000-000000000007', 'i1111111-0000-0000-0000-000000000001', 'Guard condition', 'GOOD_DAMAGED', true, 7, null, null, null),
  ('c1000001-0000-0000-0000-000000000008', 'i1111111-0000-0000-0000-000000000001', 'Noise level', 'SELECT', true, 8, null, null, null)
ON CONFLICT (id) DO NOTHING;

-- ── Checklist Items for Compressor (C-201) ────────────────────────────────────
INSERT INTO checklist_items (id, inspection_id, question, type, required, sort_order, unit) VALUES
  ('c2000001-0000-0000-0000-000000000001', 'i1111111-0000-0000-0000-000000000002', 'Compressor housing condition', 'GOOD_DAMAGED', true, 1, null),
  ('c2000001-0000-0000-0000-000000000002', 'i1111111-0000-0000-0000-000000000002', 'Oil pressure', 'NUMERIC', true, 2, 'bar'),
  ('c2000001-0000-0000-0000-000000000003', 'i1111111-0000-0000-0000-000000000002', 'Discharge temperature', 'NUMERIC', true, 3, '°C'),
  ('c2000001-0000-0000-0000-000000000004', 'i1111111-0000-0000-0000-000000000002', 'Belt tension check', 'PASS_FAIL', true, 4, null),
  ('c2000001-0000-0000-0000-000000000005', 'i1111111-0000-0000-0000-000000000002', 'Safety valve functional', 'BOOLEAN', true, 5, null)
ON CONFLICT (id) DO NOTHING;

-- ── Checklist Items for Drive Motor (M-102) — Demo inspection ─────────────────
INSERT INTO checklist_items (id, inspection_id, question, type, required, sort_order, unit, min_value, max_value) VALUES
  ('c5000001-0000-0000-0000-000000000001', 'i1111111-0000-0000-0000-000000000005', 'Motor condition', 'GOOD_DAMAGED', true, 1, null, null, null),
  ('c5000001-0000-0000-0000-000000000002', 'i1111111-0000-0000-0000-000000000005', 'Operating temperature', 'NUMERIC', true, 2, '°C', 0, 150),
  ('c5000001-0000-0000-0000-000000000003', 'i1111111-0000-0000-0000-000000000005', 'Vibration reading', 'NUMERIC', true, 3, 'mm/s', 0, 100),
  ('c5000001-0000-0000-0000-000000000004', 'i1111111-0000-0000-0000-000000000005', 'Lubrication level', 'PASS_FAIL', true, 4, null, null, null),
  ('c5000001-0000-0000-0000-000000000005', 'i1111111-0000-0000-0000-000000000005', 'Electrical connections', 'PASS_FAIL', true, 5, null, null, null),
  ('c5000001-0000-0000-0000-000000000006', 'i1111111-0000-0000-0000-000000000005', 'Emergency stop test', 'BOOLEAN', true, 6, null, null, null),
  ('c5000001-0000-0000-0000-000000000007', 'i1111111-0000-0000-0000-000000000005', 'Shaft alignment', 'PASS_FAIL', false, 7, null, null, null),
  ('c5000001-0000-0000-0000-000000000008', 'i1111111-0000-0000-0000-000000000005', 'Noise characterization', 'SELECT', true, 8, null, null, null)
ON CONFLICT (id) DO NOTHING;

-- Update checklist options for SELECT types
UPDATE checklist_items SET options = '["Normal", "Unusual hum", "Grinding", "Squealing", "Rattling"]'
  WHERE question IN ('Noise level', 'Noise characterization');

-- ── Notes ─────────────────────────────────────────────────────────────────────
INSERT INTO notes (id, inspection_id, author_id, content, created_at) VALUES
  ('n1111111-0000-0000-0000-000000000001',
   'i1111111-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111',
   'Visual inspection complete. Housing shows minor surface rust on north face. Recommend cleaning.',
   NOW() - INTERVAL '1 hour'),
  ('n1111111-0000-0000-0000-000000000002',
   'i1111111-0000-0000-0000-000000000005',
   '22222222-2222-2222-2222-222222222222',
   'Baseline readings taken. Vibration slightly elevated at 2.3 mm/s vs expected 1.5 mm/s.',
   NOW() - INTERVAL '30 minutes')
ON CONFLICT (id) DO NOTHING;
