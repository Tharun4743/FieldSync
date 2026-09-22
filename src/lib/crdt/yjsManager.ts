import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';

// ============================================================
// Yjs CRDT Manager
//
// One Y.Doc per inspection — keyed by inspectionId.
// Persisted to IndexedDB via y-indexeddb.
//
// Data structure per inspection:
//   results: Y.Map<string> — checklistItemId → JSON stringified value
//   notes:   Y.Array<YNoteEntry>
//   meta:    Y.Map<string> — inspection-level metadata
//
// Yjs handles automatic convergence of concurrent edits.
// Independent edits merge automatically.
// Semantically contradictory edits (GOOD vs DAMAGED) trigger
// the business conflict layer on top of Yjs convergence.
// ============================================================

export interface YNoteEntry {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

interface DocEntry {
  doc: Y.Doc;
  persistence: IndexeddbPersistence;
  synced: boolean;
}

class YjsManager {
  private docs = new Map<string, DocEntry>();

  /**
   * Get or create a Y.Doc for an inspection.
   * The doc is persisted to IndexedDB automatically via y-indexeddb.
   * Calling this multiple times for the same inspection returns the same doc.
   */
  async getDoc(inspectionId: string): Promise<Y.Doc> {
    const existing = this.docs.get(inspectionId);
    if (existing) return existing.doc;

    const doc = new Y.Doc();

    // y-indexeddb automatically loads saved state and persists future updates
    const persistence = new IndexeddbPersistence(`fieldsync-inspection-${inspectionId}`, doc);

    const entry: DocEntry = { doc, persistence, synced: false };
    this.docs.set(inspectionId, entry);

    // Wait for initial load from IndexedDB
    await new Promise<void>((resolve) => {
      persistence.on('synced', () => {
        entry.synced = true;
        resolve();
      });
    });

    return doc;
  }

  /** Get the shared results map for an inspection */
  getResultsMap(inspectionId: string): Y.Map<string> {
    const entry = this.docs.get(inspectionId);
    if (!entry) throw new Error(`Doc for inspection ${inspectionId} not loaded`);
    return entry.doc.getMap('results');
  }

  /** Get the shared notes array for an inspection */
  getNotesArray(inspectionId: string): Y.Array<YNoteEntry> {
    const entry = this.docs.get(inspectionId);
    if (!entry) throw new Error(`Doc for inspection ${inspectionId} not loaded`);
    return entry.doc.getArray('notes');
  }

  /**
   * Update a result in the Yjs doc.
   * This should be called AFTER updating IndexedDB,
   * so both local stores stay in sync.
   */
  setResult(inspectionId: string, checklistItemId: string, value: string): void {
    const entry = this.docs.get(inspectionId);
    if (!entry) return;
    entry.doc.transact(() => {
      entry.doc.getMap<string>('results').set(checklistItemId, value);
    });
  }

  /**
   * Add a note to the Yjs doc.
   */
  addNote(inspectionId: string, note: YNoteEntry): void {
    const entry = this.docs.get(inspectionId);
    if (!entry) return;
    entry.doc.transact(() => {
      entry.doc.getArray<YNoteEntry>('notes').push([note]);
    });
  }

  /**
   * Encode the current Yjs state as a base64 string for HTTP transport.
   */
  encodeStateAsBase64(inspectionId: string): string | null {
    const entry = this.docs.get(inspectionId);
    if (!entry) return null;
    const update = Y.encodeStateAsUpdate(entry.doc);
    return btoa(String.fromCharCode(...update));
  }

  /**
   * Encode only the state vector (for efficient delta sync).
   */
  encodeStateVector(inspectionId: string): string | null {
    const entry = this.docs.get(inspectionId);
    if (!entry) return null;
    const sv = Y.encodeStateVector(entry.doc);
    return btoa(String.fromCharCode(...sv));
  }

  /**
   * Apply a server Yjs update (base64 encoded) to a local doc.
   * Yjs handles merging — this is safe to call multiple times.
   */
  applyRemoteUpdate(inspectionId: string, base64Update: string): void {
    const entry = this.docs.get(inspectionId);
    if (!entry) return;

    const bytes = Uint8Array.from(atob(base64Update), (c) => c.charCodeAt(0));
    Y.applyUpdate(entry.doc, bytes);
  }

  /**
   * Compute a diff update — only the changes since the given state vector.
   * Used for efficient incremental sync.
   */
  encodeDiffUpdate(inspectionId: string, remoteStateVectorBase64: string): string | null {
    const entry = this.docs.get(inspectionId);
    if (!entry) return null;

    const remoteSV = Uint8Array.from(
      atob(remoteStateVectorBase64),
      (c) => c.charCodeAt(0)
    );
    const diff = Y.encodeStateAsUpdate(entry.doc, remoteSV);
    return btoa(String.fromCharCode(...diff));
  }

  /**
   * Close and cleanup a doc (when navigating away from an inspection).
   */
  async closeDoc(inspectionId: string): Promise<void> {
    const entry = this.docs.get(inspectionId);
    if (!entry) return;
    await entry.persistence.destroy();
    entry.doc.destroy();
    this.docs.delete(inspectionId);
  }

  /**
   * Observe result changes on a doc — used for reactive UI updates.
   */
  observeResults(
    inspectionId: string,
    callback: (changes: Map<string, { action: string; oldValue?: string; newValue?: string }>) => void
  ): (() => void) {
    const entry = this.docs.get(inspectionId);
    if (!entry) return () => {};

    const map = entry.doc.getMap<string>('results');
    const handler = (event: Y.YMapEvent<string>) => {
      callback(event.changes.keys);
    };
    map.observe(handler);

    return () => map.unobserve(handler);
  }
}

// Singleton
export const yjsManager = new YjsManager();

export const getOrCreateDoc = (id: string) => yjsManager.getDoc(id);
export const setChecklistResult = (inspectionId: string, checklistItemId: string, value: string) =>
  yjsManager.setResult(inspectionId, checklistItemId, value);
export const appendNote = (inspectionId: string, note: YNoteEntry) =>
  yjsManager.addNote(inspectionId, note);

