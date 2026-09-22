import Dexie, { type EntityTable } from 'dexie';
import type {
  UserRecord,
  DeviceRecord,
  Inspection,
  Asset,
  ChecklistItem,
  InspectionResult,
  Note,
  MediaRecord,
  Operation,
  Conflict,
  AuditEvent,
  SyncState,
  AppMetadata,
  VoiceNote,
  InspectionProgress,
  OfflineWorkPackage,
  UserSettings,
  AssetScanEvent,
  WorkEvidence,
  DigitalSignature,
  AssetServiceHistoryItem,
  SlaTracking,
  Invoice,
} from '@/types/db';

// ============================================================
// FieldSync Local Database — Dexie v5
//
// Schema version history:
//   v1 — Initial schema (all core tables)
//   v2 — Added priority to inspections + scheduledDate
//        Added unit/minValue/maxValue/options to checklistItems
//        Added retryCount/lastError to operations
//        Added localBlob to media (store actual file)
//   v3 — Offline productivity (voiceNotes, inspectionProgress, offlinePackages)
//   v4 — 5 Enterprise Features: QR Scan, Before/After Evidence, Signatures, History, SLA
//   v5 — Billing, Invoices & QR Payment Flow
//
// NEVER delete a version entry — only add new ones.
// NEVER reset the database to handle schema changes.
// ============================================================

class FieldSyncDatabase extends Dexie {
  users!: EntityTable<UserRecord, 'id'>;
  devices!: EntityTable<DeviceRecord, 'deviceId'>;
  inspections!: EntityTable<Inspection, 'id'>;
  assets!: EntityTable<Asset, 'id'>;
  checklistItems!: EntityTable<ChecklistItem, 'id'>;
  inspectionResults!: EntityTable<InspectionResult, 'id'>;
  notes!: EntityTable<Note, 'id'>;
  media!: EntityTable<MediaRecord, 'id'>;
  operations!: EntityTable<Operation, 'operationId'>;
  conflicts!: EntityTable<Conflict, 'id'>;
  auditEvents!: EntityTable<AuditEvent, 'id'>;
  syncState!: EntityTable<SyncState, 'deviceId'>;
  appMetadata!: EntityTable<AppMetadata, 'key'>;
  voiceNotes!: EntityTable<VoiceNote, 'id'>;
  inspectionProgress!: EntityTable<InspectionProgress, 'inspectionId'>;
  offlinePackages!: EntityTable<OfflineWorkPackage, 'id'>;
  userSettings!: EntityTable<UserSettings, 'key'>;
  assetScanEvents!: EntityTable<AssetScanEvent, 'id'>;
  workEvidence!: EntityTable<WorkEvidence, 'id'>;
  digitalSignatures!: EntityTable<DigitalSignature, 'id'>;
  assetServiceHistory!: EntityTable<AssetServiceHistoryItem, 'id'>;
  slaTracking!: EntityTable<SlaTracking, 'inspectionId'>;
  invoices!: EntityTable<Invoice, 'id'>;

  constructor() {
    super('FieldSyncDB');

    // ── Version 1 — Initial schema ─────────────────────────────
    this.version(1).stores({
      users: 'id, email, role',
      devices: 'deviceId, userId',
      inspections: 'id, status, assetId, *assignedTo, syncStatus, updatedAt',
      assets: 'id, assetCode, type',
      checklistItems: 'id, inspectionId, order',
      inspectionResults: 'id, inspectionId, checklistItemId, updatedBy, syncStatus',
      notes: 'id, inspectionId, authorId, syncStatus',
      media: 'id, inspectionId, uploadStatus, syncStatus',
      operations: 'operationId, deviceId, userId, entityType, entityId, syncStatus, logicalClock, createdAt',
      conflicts: 'id, inspectionId, entityType, entityId, status, createdAt',
      auditEvents: 'id, operationId, userId, entityType, entityId, inspectionId, action, createdAt',
      syncState: 'deviceId',
      appMetadata: 'key',
    });

    // ── Version 2 — Schema evolution (migration demo) ──────────
    //   - inspections: added priority, scheduledDate
    //   - checklistItems: added unit, minValue, maxValue, options
    //   - operations: added retryCount, lastError
    //   - media: added localBlob (IndexedDB can store Blobs natively)
    //
    // No structural index changes — Dexie only needs new indexes listed.
    // New fields on existing records default to undefined (safe).
    this.version(2)
      .stores({
        users: 'id, email, role',
        devices: 'deviceId, userId',
        inspections: 'id, status, priority, assetId, *assignedTo, syncStatus, updatedAt',
        assets: 'id, assetCode, type',
        checklistItems: 'id, inspectionId, order',
        inspectionResults: 'id, inspectionId, checklistItemId, updatedBy, syncStatus',
        notes: 'id, inspectionId, authorId, syncStatus',
        media: 'id, inspectionId, uploadStatus, syncStatus',
        operations: 'operationId, deviceId, userId, entityType, entityId, syncStatus, logicalClock, createdAt',
        conflicts: 'id, inspectionId, entityType, entityId, status, createdAt',
        auditEvents: 'id, operationId, userId, entityType, entityId, inspectionId, action, createdAt',
        syncState: 'deviceId',
        appMetadata: 'key',
      })
      .upgrade(async (tx) => {
        // Backfill priority on existing inspections
        await tx.table('inspections').toCollection().modify((inspection) => {
          if (!inspection.priority) {
            inspection.priority = 'MEDIUM';
          }
        });

        // Record migration in appMetadata
        await tx.table('appMetadata').put({
          key: 'lastMigration',
          value: JSON.stringify({
            fromVersion: 1,
            toVersion: 2,
            migratedAt: new Date().toISOString(),
          }),
        });

        // Update schema version
        await tx.table('appMetadata').put({
          key: 'schemaVersion',
          value: '2',
        });
      });

    // ── Version 3 — Offline Productivity Layer ──────────────────
    //   - voiceNotes: local offline voice recordings with blob support
    //   - inspectionProgress: progress bookmarking & auto-resume
    //   - offlinePackages: downloaded offline packages
    //   - userSettings: offline settings (language, speech, etc.)
    this.version(3)
      .stores({
        users: 'id, email, role',
        devices: 'deviceId, userId',
        inspections: 'id, status, priority, assetId, *assignedTo, syncStatus, updatedAt',
        assets: 'id, assetCode, type',
        checklistItems: 'id, inspectionId, order',
        inspectionResults: 'id, [inspectionId+checklistItemId], inspectionId, checklistItemId, updatedBy, syncStatus',
        notes: 'id, inspectionId, authorId, syncStatus',
        media: 'id, inspectionId, checklistItemId, uploadStatus, syncStatus',
        operations: 'operationId, deviceId, userId, entityType, entityId, syncStatus, logicalClock, createdAt',
        conflicts: 'id, inspectionId, entityType, entityId, status, createdAt',
        auditEvents: 'id, operationId, userId, entityType, entityId, inspectionId, action, createdAt',
        syncState: 'deviceId',
        appMetadata: 'key',
        voiceNotes: 'id, inspectionId, checklistItemId, technicianId, uploadStatus, syncStatus, createdAt',
        inspectionProgress: 'inspectionId, lastOpenedAt',
        offlinePackages: 'id, downloadedAt, status',
        userSettings: 'key',
      })
      .upgrade(async (tx) => {
        // Record migration in appMetadata
        await tx.table('appMetadata').put({
          key: 'lastMigration',
          value: JSON.stringify({
            fromVersion: 2,
            toVersion: 3,
            migratedAt: new Date().toISOString(),
          }),
        });

        // Set default language setting if not present
        await tx.table('userSettings').put({
          key: 'language',
          value: 'en',
        });

        // Update schema version
        await tx.table('appMetadata').put({
          key: 'schemaVersion',
          value: '3',
        });
      });

    // ── Version 4 — 5 Enterprise Features ───────────────────────
    //   - assetScanEvents: QR / barcode physical asset verification
    //   - workEvidence: dual-stage BEFORE / AFTER photo evidence
    //   - digitalSignatures: technician completion & supervisor sign-offs
    //   - assetServiceHistory: past service events & inspection logs
    //   - slaTracking: SLA deadlines, breach timers, escalation levels
    this.version(4)
      .stores({
        users: 'id, email, role',
        devices: 'deviceId, userId',
        inspections: 'id, status, priority, assetId, *assignedTo, syncStatus, updatedAt',
        assets: 'id, assetCode, type',
        checklistItems: 'id, inspectionId, order',
        inspectionResults: 'id, [inspectionId+checklistItemId], inspectionId, checklistItemId, updatedBy, syncStatus',
        notes: 'id, inspectionId, authorId, syncStatus',
        media: 'id, inspectionId, checklistItemId, uploadStatus, syncStatus',
        operations: 'operationId, deviceId, userId, entityType, entityId, syncStatus, logicalClock, createdAt',
        conflicts: 'id, inspectionId, entityType, entityId, status, createdAt',
        auditEvents: 'id, operationId, userId, entityType, entityId, inspectionId, action, createdAt',
        syncState: 'deviceId',
        appMetadata: 'key',
        voiceNotes: 'id, inspectionId, checklistItemId, technicianId, uploadStatus, syncStatus, createdAt',
        inspectionProgress: 'inspectionId, lastOpenedAt',
        offlinePackages: 'id, downloadedAt, status',
        userSettings: 'key',
        assetScanEvents: 'id, assetId, inspectionId, scannedBy, isMatch, scannedAt, syncStatus',
        workEvidence: 'id, inspectionId, stage, capturedBy, capturedAt, syncStatus',
        digitalSignatures: 'id, inspectionId, signerId, signerRole, signedAt, syncStatus',
        assetServiceHistory: 'id, assetId, inspectionId, completedAt',
        slaTracking: 'inspectionId, priority, category, isResponseBreached, isResolutionBreached, escalationLevel',
      })
      .upgrade(async (tx) => {
        await tx.table('appMetadata').put({
          key: 'lastMigration',
          value: JSON.stringify({
            fromVersion: 3,
            toVersion: 4,
            migratedAt: new Date().toISOString(),
          }),
        });
        await tx.table('appMetadata').put({
          key: 'schemaVersion',
          value: '4',
        });
      });

    // ── Version 5 — Billing, Invoices & QR Payment Flow ─────────
    //   - invoices: full invoice records with labour, parts, travel, tax, QR payment
    this.version(5)
      .stores({
        users: 'id, email, role',
        devices: 'deviceId, userId',
        inspections: 'id, status, priority, assetId, *assignedTo, syncStatus, updatedAt',
        assets: 'id, assetCode, type',
        checklistItems: 'id, inspectionId, order',
        inspectionResults: 'id, [inspectionId+checklistItemId], inspectionId, checklistItemId, updatedBy, syncStatus',
        notes: 'id, inspectionId, authorId, syncStatus',
        media: 'id, inspectionId, checklistItemId, uploadStatus, syncStatus',
        operations: 'operationId, deviceId, userId, entityType, entityId, syncStatus, logicalClock, createdAt',
        conflicts: 'id, inspectionId, entityType, entityId, status, createdAt',
        auditEvents: 'id, operationId, userId, entityType, entityId, inspectionId, action, createdAt',
        syncState: 'deviceId',
        appMetadata: 'key',
        voiceNotes: 'id, inspectionId, checklistItemId, technicianId, uploadStatus, syncStatus, createdAt',
        inspectionProgress: 'inspectionId, lastOpenedAt',
        offlinePackages: 'id, downloadedAt, status',
        userSettings: 'key',
        assetScanEvents: 'id, assetId, inspectionId, scannedBy, isMatch, scannedAt, syncStatus',
        workEvidence: 'id, inspectionId, stage, capturedBy, capturedAt, syncStatus',
        digitalSignatures: 'id, inspectionId, signerId, signerRole, signedAt, syncStatus',
        assetServiceHistory: 'id, assetId, inspectionId, completedAt',
        slaTracking: 'inspectionId, priority, category, isResponseBreached, isResolutionBreached, escalationLevel',
        invoices: 'id, invoiceNumber, inspectionId, customerId, technicianId, status, createdAt, syncStatus',
      })
      .upgrade(async (tx) => {
        await tx.table('appMetadata').put({
          key: 'lastMigration',
          value: JSON.stringify({
            fromVersion: 4,
            toVersion: 5,
            migratedAt: new Date().toISOString(),
          }),
        });
        await tx.table('appMetadata').put({
          key: 'schemaVersion',
          value: '5',
        });
      });
  }
}

// Singleton instance — import this everywhere
export const db = new FieldSyncDatabase();

// Current schema version — must match the highest version() call above
export const CURRENT_SCHEMA_VERSION = 5;
