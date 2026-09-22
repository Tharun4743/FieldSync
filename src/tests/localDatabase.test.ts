import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../lib/db/database';
import { upsertInspectionResult } from '../lib/db/repositories/results';
import { addNote } from '../lib/db/repositories/results';
import { queueMedia, deleteMedia } from '../lib/db/repositories/media';
import { queueVoiceNote, getVoiceNotesByInspection } from '../lib/db/repositories/voiceNotes';
import { saveProgress, getProgress } from '../lib/db/repositories/progress';
import { getSetting, setSetting } from '../lib/db/repositories/settings';
import { searchLocalDatabase } from '../lib/search/offlineSearch';

describe('Local Database Tests (IndexedDB / Dexie)', () => {
  beforeEach(async () => {
    await db.inspections.clear();
    await db.assets.clear();
    await db.checklistItems.clear();
    await db.inspectionResults.clear();
    await db.notes.clear();
    await db.media.clear();
    await db.voiceNotes.clear();
    await db.operations.clear();
    await db.inspectionProgress.clear();
    await db.userSettings.clear();
  });

  it('creates and persists inspection and asset records', async () => {
    const assetId = 'asset-m102';
    await db.assets.put({
      id: assetId,
      name: 'Motor M-102',
      assetCode: 'M-102',
      location: 'Factory A',
      type: 'MOTOR',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const inspectionId = 'insp-102';
    await db.inspections.put({
      id: inspectionId,
      title: 'Quarterly Motor M-102 Inspection',
      siteName: 'Factory A',
      assetId,
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      assignedTo: ['tech-1'],
      assignedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      serverVersion: 1,
      localVersion: 1,
      syncStatus: 'SYNCED',
    });

    const retrieved = await db.inspections.get(inspectionId);
    expect(retrieved).toBeDefined();
    expect(retrieved?.title).toBe('Quarterly Motor M-102 Inspection');
    expect(retrieved?.assetId).toBe('asset-m102');
  });

  it('updates checklist item and persists result locally', async () => {
    const inspectionId = 'insp-1';
    const checklistItemId = 'chk-temp';

    await db.checklistItems.put({
      id: checklistItemId,
      inspectionId,
      question: 'Measure Motor Temperature',
      type: 'NUMERIC',
      required: true,
      order: 1,
      unit: '°C',
      minValue: 20,
      maxValue: 120,
      createdAt: new Date().toISOString(),
    });

    const result = await upsertInspectionResult({
      inspectionId,
      checklistItemId,
      value: '82',
      valueType: 'number',
      userId: 'tech-1',
      userName: 'John Doe',
    });

    expect(result.value).toBe('82');
    expect(result.syncStatus).toBe('PENDING');

    const storedResult = await db.inspectionResults.get(result.id);
    expect(storedResult?.value).toBe('82');

    // Durable operation should be queued
    const pendingOps = await db.operations.where('entityId').equals(result.id).toArray();
    expect(pendingOps.length).toBe(1);
    expect(pendingOps[0].operationType).toBe('CREATE');
  });

  it('records offline notes and queues operation', async () => {
    const note = await addNote({
      inspectionId: 'insp-1',
      authorId: 'tech-1',
      authorName: 'John Doe',
      content: 'Bearing temperature is within normal limits.',
    });

    expect(note.content).toBe('Bearing temperature is within normal limits.');
    const stored = await db.notes.get(note.id);
    expect(stored).toBeDefined();

    const pendingOp = await db.operations.where('entityId').equals(note.id).first();
    expect(pendingOp).toBeDefined();
    expect(pendingOp?.entityType).toBe('note');
  });

  it('stores voice note metadata with native Blob in IndexedDB', async () => {
    const mockAudioBlob = new Blob(['mock-audio-data-wav'], { type: 'audio/webm' });
    const voiceNote = await queueVoiceNote({
      inspectionId: 'insp-1',
      checklistItemId: 'chk-vibe',
      technicianId: 'tech-1',
      blob: mockAudioBlob,
      duration: 8,
      fileName: 'vibe-observation.webm',
    });

    expect(voiceNote.duration).toBe(8);
    expect(voiceNote.uploadStatus).toBe('PENDING');
    expect(voiceNote.localBlob).toBeDefined();

    const storedList = await getVoiceNotesByInspection('insp-1');
    expect(storedList.length).toBe(1);
    expect(storedList[0].fileName).toBe('vibe-observation.webm');
  });

  it('stores photo metadata and binary blob in IndexedDB', async () => {
    const mockImageBlob = new Blob(['mock-image-pixels'], { type: 'image/jpeg' });
    const media = await queueMedia({
      inspectionId: 'insp-1',
      checklistItemId: 'chk-housing',
      file: mockImageBlob,
      fileName: 'housing-crack.jpg',
      userId: 'tech-1',
    });

    expect(media.fileName).toBe('housing-crack.jpg');
    expect(media.uploadStatus).toBe('PENDING');

    const storedMedia = await db.media.get(media.id);
    expect(storedMedia?.size).toBe(mockImageBlob.size);
    expect(storedMedia?.localBlob).toBeDefined();
  });

  it('deletes unsynced photo and cleans up pending sync operation', async () => {
    const mockImage = new Blob(['test'], { type: 'image/jpeg' });
    const media = await queueMedia({
      inspectionId: 'insp-1',
      file: mockImage,
      userId: 'tech-1',
    });

    // Operation was queued
    let ops = await db.operations.where('entityId').equals(media.id).toArray();
    expect(ops.length).toBe(1);

    // Delete photo before sync
    await deleteMedia(media.id, 'tech-1');

    // Both media and pending operation must be removed (no ghost uploads)
    const stored = await db.media.get(media.id);
    expect(stored).toBeUndefined();

    ops = await db.operations.where('entityId').equals(media.id).toArray();
    expect(ops.length).toBe(0);
  });

  it('tracks inspection progress and survives simulated reload', async () => {
    const progress = await saveProgress('insp-1', {
      lastChecklistItemId: 'chk-1',
      lastChecklistTitle: 'Electrical connection',
      nextChecklistItemId: 'chk-2',
      nextChecklistTitle: 'Emergency stop',
      completedCount: 14,
      totalCount: 24,
    });

    expect(progress.completedCount).toBe(14);

    // Simulated app restart: read directly from Dexie
    const retrieved = await getProgress('insp-1');
    expect(retrieved?.lastChecklistTitle).toBe('Electrical connection');
    expect(retrieved?.nextChecklistTitle).toBe('Emergency stop');
    expect(retrieved?.completedCount).toBe(14);
  });

  it('persists language settings locally in IndexedDB', async () => {
    await setSetting('language', 'ta');
    const lang = await getSetting('language', 'en');
    expect(lang).toBe('ta');
  });

  it('performs offline search across local IndexedDB indexes', async () => {
    await db.assets.put({
      id: 'asset-1',
      name: 'Compressor Unit 3',
      assetCode: 'C-201',
      location: 'Factory B',
      type: 'COMPRESSOR',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await db.inspections.put({
      id: 'insp-compressor',
      title: 'Monthly Compressor Check',
      siteName: 'Factory B',
      assetId: 'asset-1',
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
      assignedTo: ['tech-1'],
      assignedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      serverVersion: 1,
      localVersion: 1,
      syncStatus: 'SYNCED',
    });

    const results = await searchLocalDatabase('C-201');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBe('Compressor Unit 3');
    expect(results[0].assetCode).toBe('C-201');
  });
});
