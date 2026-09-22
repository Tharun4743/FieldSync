// ============================================================
// FieldSync — Local Database Types (Dexie / IndexedDB)
// ============================================================

export type UserRole = 'TECHNICIAN' | 'SUPERVISOR' | 'ADMIN';

export interface UserRecord {
  id: string; // Supabase auth UUID
  email: string;
  fullName: string;
  role: UserRole;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceRecord {
  deviceId: string; // device-{nanoid}
  userId: string;
  userAgent: string;
  createdAt: string;
  lastSeenAt: string;
}

export type InspectionStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type InspectionPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Inspection {
  id: string;
  title: string;
  siteName: string;
  assetId: string;
  status: InspectionStatus;
  priority: InspectionPriority; // added in schema v2
  assignedTo: string[]; // user IDs
  assignedAt: string;
  scheduledDate?: string;
  createdAt: string;
  updatedAt: string;
  serverVersion: number;
  localVersion: number;
  syncStatus: 'SYNCED' | 'PENDING' | 'CONFLICT';
}

export type AssetType = 'MOTOR' | 'COMPRESSOR' | 'PUMP' | 'GENERATOR' | 'VALVE' | 'OTHER';

export interface Asset {
  id: string;
  name: string;
  assetCode: string;
  location: string;
  type: AssetType;
  manufacturer?: string;
  model?: string;
  installDate?: string;
  createdAt: string;
  updatedAt: string;
}

export type ChecklistItemType =
  | 'PASS_FAIL'
  | 'GOOD_DAMAGED'
  | 'NUMERIC'
  | 'TEXT'
  | 'BOOLEAN'
  | 'SELECT';

export interface ChecklistItem {
  id: string;
  inspectionId: string;
  question: string;
  type: ChecklistItemType;
  required: boolean;
  order: number;
  unit?: string; // e.g. "°C", "RPM", "bar"
  minValue?: number;
  maxValue?: number;
  options?: string[]; // for SELECT type
  createdAt: string;
}

export type ResultValueType = ChecklistItemType | 'string' | 'number' | 'boolean';

export interface InspectionResult {
  id: string;
  inspectionId: string;
  checklistItemId: string;
  value: string; // JSON stringified value
  valueType: ResultValueType;
  updatedBy: string; // user ID
  updatedAt: string;
  version: number;
  localVersion: number;
  syncStatus: 'SYNCED' | 'PENDING';
}

export interface Note {
  id: string;
  inspectionId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: 'SYNCED' | 'PENDING';
}

export type UploadStatus = 'PENDING' | 'UPLOADING' | 'PAUSED' | 'FAILED' | 'COMPLETED';

export interface MediaRecord {
  id: string;
  inspectionId: string;
  checklistItemId?: string;
  fileName: string;
  mimeType: string;
  size: number; // bytes
  localBlob?: Blob; // stored in IndexedDB
  localReference?: string; // object URL (ephemeral)
  remoteReference?: string; // final CDN URL
  cloudinaryPublicId?: string;
  secureUrl?: string;
  uploadStatus: UploadStatus;
  uploadedBytes: number;
  totalBytes: number;
  uploadId?: string; // X-Unique-Upload-Id for Cloudinary resumable
  createdAt: string;
  syncStatus: 'SYNCED' | 'PENDING';
}

export type OperationType = 'CREATE' | 'UPDATE' | 'DELETE';
export type SyncStatus = 'PENDING' | 'SYNCED' | 'FAILED' | 'DUPLICATE';

export interface Operation {
  operationId: string; // {deviceId}-{entityId}-{logicalClock}
  deviceId: string;
  userId: string;
  entityType: string; // 'inspectionResult' | 'note' | 'media' | ...
  entityId: string;
  operationType: OperationType;
  payload: Record<string, unknown>;
  logicalClock: number;
  schemaVersion: number;
  createdAt: string;
  syncStatus: SyncStatus;
  retryCount: number;
  lastError?: string;
}

export type ConflictStatus = 'OPEN' | 'RESOLVED';

export interface Conflict {
  id: string;
  inspectionId: string;
  entityType: string;
  entityId: string;
  field: string;
  baseValue: string;
  localValue: string;
  remoteValue: string;
  localOperationId: string;
  remoteOperationId: string;
  localUserId: string;
  remoteUserId: string;
  localUserName: string;
  remoteUserName: string;
  localTimestamp: string;
  remoteTimestamp: string;
  status: ConflictStatus;
  resolvedValue?: string;
  resolvedBy?: string;
  resolvedByName?: string;
  resolvedAt?: string;
  createdAt: string;
}

export type AuditAction =
  | 'CREATED'
  | 'UPDATED'
  | 'DELETED'
  | 'CONFLICT_DETECTED'
  | 'CONFLICT_RESOLVED'
  | 'SYNCED'
  | 'UPLOADED'
  | 'NOTE_ADDED'
  | 'PHOTO_ADDED'
  | 'PHOTO_UPLOADED'
  | 'INSPECTION_OPENED'
  | 'INSPECTION_COMPLETED';

export interface AuditEvent {
  id: string;
  operationId?: string;
  userId: string;
  userName: string;
  deviceId: string;
  entityType: string;
  entityId: string;
  inspectionId: string;
  action: AuditAction;
  field?: string;
  beforeValue?: string;
  afterValue?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export type ConnectivityStatus = 'ONLINE' | 'OFFLINE' | 'SYNCING' | 'SYNC_ERROR';

export interface SyncState {
  deviceId: string;
  lastPullCursor?: string;
  lastSuccessfulSync?: string;
  lastSyncAttempt?: string;
  pendingOperations: number;
  pendingMedia: number;
  conflictCount: number;
  syncStatus: ConnectivityStatus;
}

export interface AppMetadata {
  key: string; // 'deviceId' | 'schemaVersion' | 'appVersion' | 'lastMigration'
  value: string;
}

export interface VoiceNote {
  id: string;
  inspectionId: string;
  checklistItemId?: string;
  technicianId: string;
  fileName: string;
  mimeType: string;
  duration: number; // in seconds
  localBlob?: Blob;
  localBlobReference?: string;
  uploadStatus: UploadStatus;
  uploadedBytes: number;
  totalBytes: number;
  cloudinaryPublicId?: string;
  remoteUrl?: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
  syncStatus: 'SYNCED' | 'PENDING';
}

export interface InspectionProgress {
  inspectionId: string;
  lastChecklistItemId?: string;
  lastChecklistTitle?: string;
  nextChecklistItemId?: string;
  nextChecklistTitle?: string;
  completedCount: number;
  totalCount: number;
  lastOpenedAt: string;
  updatedAt: string;
}

export interface OfflineWorkPackage {
  id: string;
  title: string;
  inspectionIds: string[];
  assetIds: string[];
  totalChecklistItems: number;
  estimatedSizeBytes: number;
  downloadedAt: string;
  status: 'READY' | 'DOWNLOADING' | 'EXPIRED';
}

export interface UserSettings {
  key: string; // e.g. 'language', 'speechEnabled'
  value: string;
}

