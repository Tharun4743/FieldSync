import { db } from './schema';
import type { Inspection, ChecklistItem, Asset } from '@/types/db';
import { v4 as uuidv4 } from 'uuid';

// ============================================================
// Realistic Industrial Seed Data
//
// Sites: Factory A (Harrington Industrial), Factory B (Meridian Processing Plant)
// Assets: Motor M-101, M-102, Compressor C-201, Pump P-301, Generator G-101
// ============================================================

export const REAL_USER_IDS = {
  ADMIN: '1d7e28ec-e29e-4f29-958e-b2f2be940063',
  SUPERVISOR: 'c7ae2610-6be0-46d3-871a-d3690abe3f16',
  TECHNICIAN: 'fc260600-d20d-46e8-8815-d6f9b5c1e927',
};

export async function seedLocalDatabase(
  userId = REAL_USER_IDS.TECHNICIAN,
  userName = 'Field Technician'
): Promise<void> {
  const existingInspections = await db.inspections.count();
  if (existingInspections > 0) {
    console.info('[Seed] Local database already seeded, skipping.', userName);
    return;
  }

  console.info('[Seed] Seeding local database with industrial data...');

  // ── Assets ────────────────────────────────────────────────
  const assets: Asset[] = [
    {
      id: 'a1000000-0000-0000-0000-000000000001',
      name: 'Motor M-101',
      assetCode: 'MTR-M101',
      location: 'Factory A — Line 1, Bay 3',
      type: 'MOTOR',
      manufacturer: 'Siemens',
      model: 'SIMOTICS SD',
      createdAt: '2025-01-15T08:00:00Z',
      updatedAt: '2025-01-15T08:00:00Z',
    },
    {
      id: 'a1000000-0000-0000-0000-000000000002',
      name: 'Motor M-102',
      assetCode: 'MTR-M102',
      location: 'Factory A — Line 1, Bay 4',
      type: 'MOTOR',
      manufacturer: 'Siemens',
      model: 'SIMOTICS SD',
      createdAt: '2025-01-15T08:00:00Z',
      updatedAt: '2025-01-15T08:00:00Z',
    },
    {
      id: 'a1000000-0000-0000-0000-000000000003',
      name: 'Compressor C-201',
      assetCode: 'CMP-C201',
      location: 'Factory A — Utility Room 2',
      type: 'COMPRESSOR',
      manufacturer: 'Atlas Copco',
      model: 'GA110',
      createdAt: '2025-01-15T08:00:00Z',
      updatedAt: '2025-01-15T08:00:00Z',
    },
    {
      id: 'a1000000-0000-0000-0000-000000000004',
      name: 'Pump P-301',
      assetCode: 'PMP-P301',
      location: 'Factory B — Process Area 1',
      type: 'PUMP',
      manufacturer: 'Grundfos',
      model: 'CR 45',
      createdAt: '2025-01-15T08:00:00Z',
      updatedAt: '2025-01-15T08:00:00Z',
    },
    {
      id: 'a1000000-0000-0000-0000-000000000005',
      name: 'Generator G-101',
      assetCode: 'GEN-G101',
      location: 'Factory B — Generator House',
      type: 'GENERATOR',
      manufacturer: 'Caterpillar',
      model: 'C15',
      createdAt: '2025-01-15T08:00:00Z',
      updatedAt: '2025-01-15T08:00:00Z',
    },
  ];

  await db.assets.bulkPut(assets);

  // ── Inspections + Checklists ──────────────────────────────
  const inspections = [
    {
      id: 'i1000000-0000-0000-0000-000000000001',
      title: 'Monthly Preventive Inspection',
      siteName: 'Harrington Industrial — Factory A',
      assetId: 'a1000000-0000-0000-0000-000000000001',
      assetName: 'Motor M-101',
    },
    {
      id: 'i1000000-0000-0000-0000-000000000002',
      title: 'Quarterly Safety Inspection',
      siteName: 'Harrington Industrial — Factory A',
      assetId: 'a1000000-0000-0000-0000-000000000002',
      assetName: 'Motor M-102',
    },
    {
      id: 'i1000000-0000-0000-0000-000000000003',
      title: 'Annual Overhaul Inspection',
      siteName: 'Harrington Industrial — Factory A',
      assetId: 'a1000000-0000-0000-0000-000000000003',
      assetName: 'Compressor C-201',
    },
    {
      id: 'i1000000-0000-0000-0000-000000000004',
      title: 'Routine Condition Check',
      siteName: 'Meridian Processing Plant — Factory B',
      assetId: 'a1000000-0000-0000-0000-000000000004',
      assetName: 'Pump P-301',
    },
    {
      id: 'i1000000-0000-0000-0000-000000000005',
      title: 'Emergency Shutdown Inspection',
      siteName: 'Meridian Processing Plant — Factory B',
      assetId: 'a1000000-0000-0000-0000-000000000005',
      assetName: 'Generator G-101',
    },
  ];

  const now = new Date().toISOString();

  for (const insp of inspections) {
    const inspection: Inspection = {
      id: insp.id,
      title: insp.title,
      siteName: insp.siteName,
      assetId: insp.assetId,
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
      assignedTo: Array.from(new Set([userId, REAL_USER_IDS.TECHNICIAN, REAL_USER_IDS.SUPERVISOR, REAL_USER_IDS.ADMIN])),
      assignedAt: now,
      scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAt: now,
      updatedAt: now,
      serverVersion: 1,
      localVersion: 1,
      syncStatus: 'SYNCED',
    };
    await db.inspections.put(inspection);
  }

  // ── Checklist Items for Motor Inspections ─────────────────
  const motorChecklistItems: Omit<ChecklistItem, 'id'>[] = [
    { inspectionId: '', question: 'Motor housing condition', type: 'GOOD_DAMAGED', required: true, order: 1, createdAt: now },
    { inspectionId: '', question: 'Lubrication status — sufficient grease/oil', type: 'PASS_FAIL', required: true, order: 2, createdAt: now },
    { inspectionId: '', question: 'Operating temperature (°C)', type: 'NUMERIC', required: true, order: 3, unit: '°C', minValue: 0, maxValue: 120, createdAt: now },
    { inspectionId: '', question: 'Vibration level', type: 'SELECT', required: true, order: 4, options: ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'], createdAt: now },
    { inspectionId: '', question: 'Electrical connections secure', type: 'PASS_FAIL', required: true, order: 5, createdAt: now },
    { inspectionId: '', question: 'Emergency stop functional', type: 'PASS_FAIL', required: true, order: 6, createdAt: now },
    { inspectionId: '', question: 'Safety guard in place', type: 'PASS_FAIL', required: true, order: 7, createdAt: now },
    { inspectionId: '', question: 'Noise level abnormal', type: 'BOOLEAN', required: false, order: 8, createdAt: now },
    { inspectionId: '', question: 'Current draw (A)', type: 'NUMERIC', required: false, order: 9, unit: 'A', minValue: 0, maxValue: 1000, createdAt: now },
    { inspectionId: '', question: 'Shaft alignment acceptable', type: 'PASS_FAIL', required: true, order: 10, createdAt: now },
    { inspectionId: '', question: 'Inspector notes', type: 'TEXT', required: false, order: 11, createdAt: now },
  ];

  // Add checklist items for Motor M-101 and M-102
  for (const inspId of [
    'i1000000-0000-0000-0000-000000000001',
    'i1000000-0000-0000-0000-000000000002',
  ]) {
    for (const item of motorChecklistItems) {
      await db.checklistItems.put({
        ...item,
        id: uuidv4(),
        inspectionId: inspId,
      });
    }
  }

  // ── Compressor Checklist ──────────────────────────────────
  const compressorItems: Omit<ChecklistItem, 'id'>[] = [
    { inspectionId: 'i1000000-0000-0000-0000-000000000003', question: 'Air filter condition', type: 'GOOD_DAMAGED', required: true, order: 1, createdAt: now },
    { inspectionId: 'i1000000-0000-0000-0000-000000000003', question: 'Oil level within range', type: 'PASS_FAIL', required: true, order: 2, createdAt: now },
    { inspectionId: 'i1000000-0000-0000-0000-000000000003', question: 'Discharge pressure (bar)', type: 'NUMERIC', required: true, order: 3, unit: 'bar', minValue: 0, maxValue: 20, createdAt: now },
    { inspectionId: 'i1000000-0000-0000-0000-000000000003', question: 'Inlet temperature (°C)', type: 'NUMERIC', required: true, order: 4, unit: '°C', minValue: -10, maxValue: 60, createdAt: now },
    { inspectionId: 'i1000000-0000-0000-0000-000000000003', question: 'Safety relief valve functional', type: 'PASS_FAIL', required: true, order: 5, createdAt: now },
    { inspectionId: 'i1000000-0000-0000-0000-000000000003', question: 'Belts/couplings condition', type: 'GOOD_DAMAGED', required: true, order: 6, createdAt: now },
    { inspectionId: 'i1000000-0000-0000-0000-000000000003', question: 'No air leaks detected', type: 'PASS_FAIL', required: true, order: 7, createdAt: now },
    { inspectionId: 'i1000000-0000-0000-0000-000000000003', question: 'Operating hours since last service', type: 'NUMERIC', required: false, order: 8, unit: 'h', createdAt: now },
  ];

  for (const item of compressorItems) {
    await db.checklistItems.put({ ...item, id: uuidv4() });
  }

  // ── Pump Checklist ────────────────────────────────────────
  const pumpItems: Omit<ChecklistItem, 'id'>[] = [
    { inspectionId: 'i1000000-0000-0000-0000-000000000004', question: 'Pump casing condition', type: 'GOOD_DAMAGED', required: true, order: 1, createdAt: now },
    { inspectionId: 'i1000000-0000-0000-0000-000000000004', question: 'Flow rate acceptable (m³/h)', type: 'NUMERIC', required: true, order: 2, unit: 'm³/h', createdAt: now },
    { inspectionId: 'i1000000-0000-0000-0000-000000000004', question: 'Seal leakage observed', type: 'BOOLEAN', required: true, order: 3, createdAt: now },
    { inspectionId: 'i1000000-0000-0000-0000-000000000004', question: 'Cavitation signs', type: 'BOOLEAN', required: true, order: 4, createdAt: now },
    { inspectionId: 'i1000000-0000-0000-0000-000000000004', question: 'Inlet/outlet pressure OK', type: 'PASS_FAIL', required: true, order: 5, createdAt: now },
    { inspectionId: 'i1000000-0000-0000-0000-000000000004', question: 'Coupling alignment', type: 'PASS_FAIL', required: true, order: 6, createdAt: now },
  ];

  for (const item of pumpItems) {
    await db.checklistItems.put({ ...item, id: uuidv4() });
  }

  // ── Generator Checklist ───────────────────────────────────
  const generatorItems: Omit<ChecklistItem, 'id'>[] = [
    { inspectionId: 'i1000000-0000-0000-0000-000000000005', question: 'Fuel level (%)', type: 'NUMERIC', required: true, order: 1, unit: '%', minValue: 0, maxValue: 100, createdAt: now },
    { inspectionId: 'i1000000-0000-0000-0000-000000000005', question: 'Battery charge voltage (V)', type: 'NUMERIC', required: true, order: 2, unit: 'V', createdAt: now },
    { inspectionId: 'i1000000-0000-0000-0000-000000000005', question: 'Coolant level OK', type: 'PASS_FAIL', required: true, order: 3, createdAt: now },
    { inspectionId: 'i1000000-0000-0000-0000-000000000005', question: 'Engine oil level OK', type: 'PASS_FAIL', required: true, order: 4, createdAt: now },
    { inspectionId: 'i1000000-0000-0000-0000-000000000005', question: 'Output voltage (V)', type: 'NUMERIC', required: true, order: 5, unit: 'V', createdAt: now },
    { inspectionId: 'i1000000-0000-0000-0000-000000000005', question: 'ATS (Auto Transfer Switch) tested', type: 'PASS_FAIL', required: true, order: 6, createdAt: now },
    { inspectionId: 'i1000000-0000-0000-0000-000000000005', question: 'Load test performed', type: 'PASS_FAIL', required: false, order: 7, createdAt: now },
  ];

  for (const item of generatorItems) {
    await db.checklistItems.put({ ...item, id: uuidv4() });
  }

  console.info('[Seed] Local database seeded with 5 inspections and 38 checklist items.');
}

export const seedDatabase = seedLocalDatabase;
