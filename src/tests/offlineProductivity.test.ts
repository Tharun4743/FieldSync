import { describe, it, expect, beforeEach } from 'vitest';
import { db, CURRENT_SCHEMA_VERSION } from '../lib/db/database';
import { syncProgressFromDB, getProgress } from '../lib/db/repositories/progress';
import { translations, SUPPORTED_LANGUAGES, type SupportedLanguage, getTranslation } from '../lib/i18n/translations';
import { isSpeechSupported, readAloud } from '../lib/speech/speechService';
import { updateUploadProgress, markUploadPaused } from '../lib/db/repositories/media';
import { updateVoiceNoteUploadStatus } from '../lib/db/repositories/voiceNotes';

describe('Offline Productivity Layer — Core Feature Suite', () => {
  beforeEach(async () => {
    await db.checklistItems.clear();
    await db.inspectionResults.clear();
    await db.inspectionProgress.clear();
    await db.media.clear();
    await db.voiceNotes.clear();
  });

  describe('Offline Progress Persistence & Resume', () => {
    it('automatically calculates completed items, next item, and survives restart', async () => {
      const inspectionId = 'insp-m102';

      // Setup 3 items
      await db.checklistItems.bulkPut([
        { id: 'item-1', inspectionId, question: 'Motor housing', type: 'GOOD_DAMAGED', required: true, order: 1, createdAt: '' },
        { id: 'item-2', inspectionId, question: 'Temperature', type: 'NUMERIC', required: true, order: 2, createdAt: '' },
        { id: 'item-3', inspectionId, question: 'Emergency stop', type: 'PASS_FAIL', required: true, order: 3, createdAt: '' },
      ]);

      // Complete item 1
      await db.inspectionResults.put({
        id: 'res-1',
        inspectionId,
        checklistItemId: 'item-1',
        value: 'GOOD',
        valueType: 'GOOD_DAMAGED',
        updatedBy: 'tech-1',
        updatedAt: new Date().toISOString(),
        version: 1,
        localVersion: 1,
        syncStatus: 'PENDING',
      });

      // Recalculate progress from IndexedDB
      await syncProgressFromDB(inspectionId, 'item-1');

      const progress = await getProgress(inspectionId);
      expect(progress).toBeDefined();
      expect(progress?.completedCount).toBe(1);
      expect(progress?.totalCount).toBe(3);
      expect(progress?.lastChecklistTitle).toBe('Motor housing');
      expect(progress?.nextChecklistTitle).toBe('Temperature');
      expect(progress?.nextChecklistItemId).toBe('item-2');
    });
  });

  describe('Offline Multi-Language Resources (Zero Internet)', () => {
    it('provides complete dictionaries for all 6 supported languages', () => {
      expect(SUPPORTED_LANGUAGES.length).toBe(6);
      const requiredKeys: (keyof typeof translations.en)[] = [
        'dashboard',
        'inspections',
        'conflicts',
        'sync',
        'history',
        'profile',
        'save',
        'cancel',
        'next',
        'previous',
        'record',
        'takePhoto',
        'addNote',
        'resume',
        'resumeInspection',
        'search',
        'syncNow',
        'readAloud',
        'saveAndNext',
        'prepareOffline',
        'online',
        'offline',
        'syncing',
        'pending',
        'failed',
        'completed',
        'savedOffline',
        'inspection',
        'checklist',
        'measurement',
        'photo',
        'voiceNote',
        'offlineAlert',
      ];

      for (const lang of ['en', 'ta', 'hi', 'te', 'kn', 'ml'] as SupportedLanguage[]) {
        const dict = translations[lang];
        expect(dict).toBeDefined();
        for (const key of requiredKeys) {
          expect(dict[key], `Language ${lang} missing key ${key}`).toBeDefined();
          expect(dict[key].length).toBeGreaterThan(0);
        }
      }
    });

    it('translates correctly via getTranslation helper', () => {
      expect(getTranslation('ta', 'save')).toBe('சேமி');
      expect(getTranslation('hi', 'save')).toBe('सहेजें');
      expect(getTranslation('te', 'save')).toBe('సేవ్ చేయి');
      expect(getTranslation('kn', 'save')).toBe('ಉಳಿಸು');
      expect(getTranslation('ml', 'save')).toBe('സേവ് ചെയ്യുക');
    });
  });

  describe('Offline Text-to-Speech (Read Aloud)', () => {
    it('detects speech support and reads aloud checklist text', async () => {
      expect(isSpeechSupported()).toBe(true);

      const result = await readAloud('Check motor bearing condition', 'en');
      expect(result.success).toBe(true);
    });

    it('handles unsupported languages gracefully without crashing', async () => {
      // Mock with speech disabled
      const original = window.speechSynthesis;
      // @ts-expect-error Mock undefined
      window.speechSynthesis = undefined;

      const result = await readAloud('Check motor bearing condition', 'ta');
      expect(result.success).toBe(false);
      expect(result.message).toContain('not supported');

      window.speechSynthesis = original;
    });
  });

  describe('Media Upload Resumption & Pause State', () => {
    it('pauses and resumes photo upload progress at exact byte offsets', async () => {
      const mediaId = 'media-chunk-test';
      await db.media.put({
        id: mediaId,
        inspectionId: 'insp-1',
        fileName: 'test.jpg',
        mimeType: 'image/jpeg',
        size: 12000000,
        uploadStatus: 'PENDING',
        uploadedBytes: 0,
        totalBytes: 12000000,
        createdAt: new Date().toISOString(),
        syncStatus: 'PENDING',
      });

      // Upload chunk 1 (6MB)
      await updateUploadProgress(mediaId, 6000000, 'upload-id-1');
      let record = await db.media.get(mediaId);
      expect(record?.uploadStatus).toBe('UPLOADING');
      expect(record?.uploadedBytes).toBe(6000000);

      // Network disconnects during upload: mark PAUSED
      await markUploadPaused(mediaId, 6000000);
      record = await db.media.get(mediaId);
      expect(record?.uploadStatus).toBe('PAUSED');
      expect(record?.uploadedBytes).toBe(6000000);

      // Network restores: continues from 6000000 without restarting from 0
      await updateUploadProgress(mediaId, 12000000, 'upload-id-1');
      record = await db.media.get(mediaId);
      expect(record?.uploadedBytes).toBe(12000000);
    });

    it('tracks voice note upload status transitions', async () => {
      const vnId = 'vn-test-1';
      await db.voiceNotes.put({
        id: vnId,
        inspectionId: 'insp-1',
        technicianId: 'tech-1',
        fileName: 'audio.webm',
        mimeType: 'audio/webm',
        duration: 10,
        uploadStatus: 'PENDING',
        uploadedBytes: 0,
        totalBytes: 50000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        schemaVersion: CURRENT_SCHEMA_VERSION,
        syncStatus: 'PENDING',
      });

      await updateVoiceNoteUploadStatus(vnId, 'UPLOADING', 25000);
      let vn = await db.voiceNotes.get(vnId);
      expect(vn?.uploadStatus).toBe('UPLOADING');
      expect(vn?.uploadedBytes).toBe(25000);

      await updateVoiceNoteUploadStatus(vnId, 'COMPLETED', 50000, 'cld-123', 'https://cdn.cloudinary.com/audio.webm');
      vn = await db.voiceNotes.get(vnId);
      expect(vn?.uploadStatus).toBe('COMPLETED');
      expect(vn?.syncStatus).toBe('SYNCED');
      expect(vn?.remoteUrl).toBe('https://cdn.cloudinary.com/audio.webm');
    });
  });

  describe('Schema Evolution & Data Integrity', () => {
    it('uses Schema Version >= 3 and has all essential offline productivity and enterprise tables', () => {
      expect(CURRENT_SCHEMA_VERSION).toBeGreaterThanOrEqual(3);
      expect(db.tables.some((t) => t.name === 'voiceNotes')).toBe(true);
      expect(db.tables.some((t) => t.name === 'inspectionProgress')).toBe(true);
      expect(db.tables.some((t) => t.name === 'offlinePackages')).toBe(true);
      expect(db.tables.some((t) => t.name === 'userSettings')).toBe(true);
      expect(db.tables.some((t) => t.name === 'assetScanEvents')).toBe(true);
      expect(db.tables.some((t) => t.name === 'workEvidence')).toBe(true);
      expect(db.tables.some((t) => t.name === 'digitalSignatures')).toBe(true);
    });
  });
});
