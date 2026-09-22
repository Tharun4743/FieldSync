export * from './db';
import type {
  ChecklistItem,
  InspectionResult,
  Inspection,
  Asset,
  Note,
  Conflict,
  AuditEvent,
  MediaRecord,
} from './db';

export type ChecklistItemRecord = ChecklistItem;
export type InspectionResultRecord = InspectionResult;
export type InspectionRecord = Inspection;
export type AssetRecord = Asset;
export type NoteRecord = Note;
export type ConflictRecord = Conflict;
export type AuditEventRecord = AuditEvent;
export type { MediaRecord };
