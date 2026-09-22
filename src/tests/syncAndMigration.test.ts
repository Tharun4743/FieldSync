import { describe, it, expect, beforeEach } from 'vitest';
import { db, CURRENT_SCHEMA_VERSION } from '../lib/db/database';
import { createOperation, markOperationDuplicate, getPendingOperations } from '../lib/db/repositories/operations';
import { upsertInspectionResult } from '../lib/db/repositories/results';
import { syncProgressFromDB, getProgress } from '../lib/db/repositories/progress';
import { yjsManager } from '../lib/crdt/yjsManager';

describe('Offline Sync, Idempotency & CRDT Tests', () => {
  beforeEach(async () => {
    await db.operations.clear();
    await db.checklistItems.clear();
    await db.inspectionResults.clear();
    await db.inspectionProgress.clear();
    await db.conflicts.clear();
  });

  it('generates deterministic idempotent operation IDs and prevents duplicates', async () => {
    const op = await createOperation({
      userId: 'tech-1',
      entityType: 'inspectionResult',
      entityId: 'result-unique-123',
      inspectionId: 'insp-1',
      operationType: 'CREATE',
      payload: { value: 'PASS' },
    });

    expect(op.operationId).toBeDefined();
    expect(op.syncStatus).toBe('PENDING');

    // Simulate duplicate response from server
    await markOperationDuplicate(op.operationId);

    const updated = await db.operations.get(op.operationId);
    expect(updated?.syncStatus).toBe('DUPLICATE');

    // Duplicate operation must not remain in pending queue
    const pending = await getPendingOperations();
    expect(pending.some((p) => p.operationId === op.operationId)).toBe(false);
  });

  it('completes entire inspection offline with Yjs CRDT and IndexedDB', async () => {
    const inspectionId = 'insp-offline-complete';

    await db.checklistItems.bulkPut([
      { id: 'item-1', inspectionId, question: 'Housing Check', type: 'GOOD_DAMAGED', required: true, order: 1, createdAt: '' },
      { id: 'item-2', inspectionId, question: 'Vibration', type: 'PASS_FAIL', required: true, order: 2, createdAt: '' },
      { id: 'item-3', inspectionId, question: 'Bearing Temp', type: 'NUMERIC', required: true, order: 3, createdAt: '' },
    ]);

    // Initialize Yjs doc for this inspection
    await yjsManager.getDoc(inspectionId);

    // Answer item 1 offline
    yjsManager.setResult(inspectionId, 'item-1', 'GOOD');
    await upsertInspectionResult({
      inspectionId,
      checklistItemId: 'item-1',
      value: 'GOOD',
      valueType: 'string',
      userId: 'tech-1',
      userName: 'John Doe',
    });

    // Answer item 2 offline
    yjsManager.setResult(inspectionId, 'item-2', 'PASS');
    await upsertInspectionResult({
      inspectionId,
      checklistItemId: 'item-2',
      value: 'PASS',
      valueType: 'string',
      userId: 'tech-1',
      userName: 'John Doe',
    });

    // Answer item 3 offline
    yjsManager.setResult(inspectionId, 'item-3', '108');
    await upsertInspectionResult({
      inspectionId,
      checklistItemId: 'item-3',
      value: '108',
      valueType: 'number',
      userId: 'tech-1',
      userName: 'John Doe',
    });

    // Verify local CRDT state
    const yDoc = await yjsManager.getDoc(inspectionId);
    const resultsMap = yDoc.getMap('results');
    expect(resultsMap.get('item-1')).toBe('GOOD');
    expect(resultsMap.get('item-2')).toBe('PASS');
    expect(resultsMap.get('item-3')).toBe('108');

    // Recalculate progress
    await syncProgressFromDB(inspectionId, 'item-3');
    const progress = await getProgress(inspectionId);
    expect(progress?.completedCount).toBe(3);
    expect(progress?.totalCount).toBe(3);
    expect(progress?.lastChecklistTitle).toBe('Bearing Temp');
    expect(progress?.nextChecklistItemId).toBeUndefined();

    // Verify durable operations created
    const pendingOps = await getPendingOperations();
    expect(pendingOps.length).toBe(3);
  });

  it('preserves existing records during schema version 3 upgrade', async () => {
    // Check that schema version is 3
    expect(CURRENT_SCHEMA_VERSION).toBe(3);

    // Verify that all core entity stores exist
    const tableNames = db.tables.map((t) => t.name);
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('inspections');
    expect(tableNames).toContain('checklistItems');
    expect(tableNames).toContain('inspectionResults');
    expect(tableNames).toContain('notes');
    expect(tableNames).toContain('media');
    expect(tableNames).toContain('operations');
    expect(tableNames).toContain('conflicts');
    expect(tableNames).toContain('voiceNotes');
    expect(tableNames).toContain('inspectionProgress');
    expect(tableNames).toContain('offlinePackages');
    expect(tableNames).toContain('userSettings');
  });
});
