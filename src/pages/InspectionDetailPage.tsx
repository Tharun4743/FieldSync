import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db/database';
import { useAuthStore } from '../stores/authStore';
import { yjsManager } from '../lib/crdt/yjsManager';
import { createOperation } from '../lib/db/repositories/operations';
import { createAuditEvent } from '../lib/db/repositories/auditEvents';
import { queueMedia } from '../lib/db/repositories/media';
import { generateId } from '../utils/idGenerator';
import { syncManager } from '../lib/sync/syncManager';
import ChecklistTab from '../components/inspection/ChecklistTab';
import NotesTab from '../components/inspection/NotesTab';
import PhotosTab from '../components/inspection/PhotosTab';
import HistoryTab from '../components/inspection/HistoryTab';
import OverviewTab from '../components/inspection/OverviewTab';
import VoiceNotesTab from '../components/inspection/VoiceNotesTab';
import QuickInspectionView from '../components/inspection/QuickInspectionView';
import { saveProgress, syncProgressFromDB } from '../lib/db/repositories/progress';
import { ArrowLeft, AlertTriangle, Zap } from 'lucide-react';
import type { ChecklistItem, InspectionResult, Inspection, Asset, Note } from '@/types/db';
import type * as Y from 'yjs';

type Tab = 'overview' | 'checklist' | 'measurements' | 'notes' | 'voice' | 'photos' | 'history';

export default function InspectionDetailPage() {
  const { id, tab: tabParam } = useParams<{ id: string; tab?: Tab }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>((tabParam as Tab) ?? 'overview');
  const [isQuickMode, setIsQuickMode] = useState(false);
  const [lastSavedItemId, setLastSavedItemId] = useState<string | undefined>(undefined);
  const [, setYjsDoc] = useState<Y.Doc | null>(null);

  // Check URL parameters (e.g. ?mode=quick or ?item=xxx)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'quick') {
      setIsQuickMode(true);
    }
    const itemParam = params.get('item');
    if (itemParam) {
      setLastSavedItemId(itemParam);
    }
  }, []);

  // Load progress bookmark & sync progress from IndexedDB
  useEffect(() => {
    if (!id) return;
    void syncProgressFromDB(id).then((p) => {
      if (p?.lastChecklistItemId) {
        setLastSavedItemId(p.lastChecklistItemId);
      }
    });
  }, [id]);


  const inspection = useLiveQuery(() => id ? db.inspections.get(id) : undefined, [id]) as Inspection | undefined;
  const asset = useLiveQuery(
    () => inspection?.assetId ? db.assets.get(inspection.assetId) : undefined,
    [inspection?.assetId]
  ) as Asset | undefined;
  const checklistItems = useLiveQuery(
    () => id ? db.checklistItems.where('inspectionId').equals(id).sortBy('order') : [],
    [id]
  ) as ChecklistItem[] | undefined;
  const results = useLiveQuery(
    () => id ? db.inspectionResults.where('inspectionId').equals(id).toArray() : [],
    [id]
  ) as InspectionResult[] | undefined;
  const conflictCount = useLiveQuery(
    () => id ? db.conflicts.where('inspectionId').equals(id).filter(c => c.status === 'OPEN').count() : 0,
    [id]
  );

  // Load Yjs document for this inspection
  useEffect(() => {
    if (!id) return;
    void yjsManager.getDoc(id).then(doc => setYjsDoc(doc));
  }, [id]);

  if (!inspection) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-64">
        <p className="text-field-muted">Loading inspection…</p>
      </div>
    );
  }

  const resultsMap: Record<string, InspectionResult> = Object.fromEntries(
    results?.map((r: InspectionResult) => [r.checklistItemId, r]) ?? []
  );

  // ── Checklist result update (local-first) ─────────────────────────────────
  async function handleResultUpdate(
    item: ChecklistItem,
    newValue: string
  ): Promise<void> {
    if (!user || !id) return;

    const existingResult = resultsMap[item.id];
    const oldValue = existingResult?.value ?? '';
    const now = new Date().toISOString();

    // 1. Update Yjs CRDT immediately (local, no network)
    yjsManager.setResult(id, item.id, newValue);

    // 2. Update IndexedDB immediately
    const resultId = existingResult?.id ?? generateId();
    const resultRecord: InspectionResult = {
      id: resultId,
      inspectionId: id,
      checklistItemId: item.id,
      value: newValue,
      valueType: item.type,
      updatedBy: user.id,
      updatedAt: now,
      version: (existingResult?.version ?? 0) + 1,
      localVersion: (existingResult?.localVersion ?? 0) + 1,
      syncStatus: 'PENDING',
    };
    await db.inspectionResults.put(resultRecord);

    // 3. Update inspection version counter
    await db.inspections.update(id, {
      localVersion: (inspection!.localVersion ?? 0) + 1,
      updatedAt: now,
      syncStatus: 'PENDING',
    });

    // 4. Update inspectionProgress locally
    const totalCount = checklistItems?.length ?? 0;
    const completedCount = (checklistItems ?? []).filter(i =>
      i.id === item.id ? Boolean(newValue) : Boolean(resultsMap[i.id]?.value)
    ).length;
    await saveProgress(id, {
      lastChecklistItemId: item.id,
      lastChecklistTitle: item.question,
      completedCount,
      totalCount,
    });

    // 4. Create operation for sync queue
    await createOperation({
      userId: user.id,
      inspectionId: id,
      entityType: 'inspectionResult',
      entityId: resultId,
      operationType: existingResult ? 'UPDATE' : 'CREATE',
      payload: {
        inspectionId: id,
        checklistItemId: item.id,
        field: item.question,
        oldValue,
        newValue,
        valueType: item.type,
      },
    });

    // 5. Create audit event
    await createAuditEvent({
      userId: user.id,
      inspectionId: id,
      entityType: 'inspectionResult',
      entityId: resultId,
      action: 'UPDATED',
      beforeValue: oldValue,
      afterValue: newValue,
    });

    // 6. Attempt sync if online
    void syncManager.syncNow();
  }

  // ── Note submit ────────────────────────────────────────────────────────────
  async function handleNoteSubmit(content: string): Promise<void> {
    if (!user || !id) return;

    const noteId = generateId();
    const now = new Date().toISOString();

    // 1. Append to Yjs
    yjsManager.addNote(id, {
      id: noteId,
      authorId: user.id,
      authorName: user.fullName,
      content,
      createdAt: now,
    });

    // 2. Write to Dexie
    const noteRecord: Note = {
      id: noteId,
      inspectionId: id,
      authorId: user.id,
      authorName: user.fullName || 'Technician',
      content,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'PENDING',
    };
    await db.notes.add(noteRecord);

    // 3. Create operation
    await createOperation({
      userId: user.id,
      inspectionId: id,
      entityType: 'note',
      entityId: noteId,
      operationType: 'CREATE',
      payload: { inspectionId: id, content, createdAt: now },
    });

    // 4. Audit event
    await createAuditEvent({
      userId: user.id,
      inspectionId: id,
      entityType: 'note',
      entityId: noteId,
      action: 'NOTE_ADDED',
      afterValue: content,
    });

    void syncManager.syncNow();
  }

  // ── Photo capture ──────────────────────────────────────────────────────────
  async function handlePhotoCapture(file: File): Promise<void> {
    if (!user || !id) return;

    // 1. Queue locally in IndexedDB (stores blob and creates operation)
    const media = await queueMedia({
      inspectionId: id,
      file,
      userId: user.id,
    });

    // 2. Audit
    await createAuditEvent({
      userId: user.id,
      inspectionId: id,
      entityType: 'media',
      entityId: media.id,
      action: 'PHOTO_ADDED',
      afterValue: file.name,
    });

    void syncManager.syncNow();
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview',     label: 'Overview' },
    { key: 'checklist',    label: 'Checklist' },
    { key: 'measurements', label: 'Measurements' },
    { key: 'notes',        label: 'Notes' },
    { key: 'voice',        label: 'Voice Notes' },
    { key: 'photos',       label: 'Photos' },
    { key: 'history',      label: 'History' },
  ];

  return (
    <div className="flex flex-col min-h-screen animate-fade-in -m-4 md:-m-6">
      {/* Header */}
      <div className="bg-white/95 backdrop-blur-md border-b border-zinc-200/80 sticky top-0 z-10 shadow-2xs">
        <div className="p-4 sm:p-5 w-full space-y-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 flex items-center justify-center text-zinc-600 hover:text-zinc-900 transition-all cursor-pointer shadow-2xs"
              aria-label="Go back"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {asset && (
                  <span className="text-[11px] font-mono font-bold text-indigo-600 bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded-full">
                    {asset.assetCode}
                  </span>
                )}
                {(conflictCount ?? 0) > 0 && (
                  <Link to="/conflicts" className="flex items-center gap-1 text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full">
                    <AlertTriangle size={10} />
                    {conflictCount} conflict{conflictCount! > 1 ? 's' : ''}
                  </Link>
                )}
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-zinc-900 leading-tight truncate">{inspection.title}</h1>
              <p className="text-zinc-500 text-xs font-medium mt-0.5">{inspection.siteName}</p>
            </div>

            <button
              onClick={() => setIsQuickMode(!isQuickMode)}
              className="h-10 px-4 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-sm shadow-indigo-100 transition-all cursor-pointer shrink-0"
              id="btn-toggle-quick-mode"
            >
              <Zap size={15} />
              {isQuickMode ? 'Standard View' : 'Quick Mode'}
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto p-1 bg-zinc-100/80 rounded-xl border border-zinc-200/60">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === t.key
                    ? 'bg-white text-zinc-900 shadow-2xs'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50'
                }`}
                id={`tab-${t.key}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content or Quick Mode View */}
      <div className="flex-1 w-full p-4 sm:p-5">
        {isQuickMode ? (
          <QuickInspectionView
            inspection={inspection}
            asset={asset}
            items={checklistItems ?? []}
            results={resultsMap}
            onUpdateResult={handleResultUpdate}
            onCapturePhoto={handlePhotoCapture}
            onExitQuickMode={() => setIsQuickMode(false)}
            initialItemId={lastSavedItemId}
          />
        ) : (
          <>
            {activeTab === 'overview' && (
              <OverviewTab inspection={inspection} asset={asset} results={results ?? []} checklistItems={checklistItems ?? []} />
            )}
            {(activeTab === 'checklist' || activeTab === 'measurements') && (
              <ChecklistTab
                items={checklistItems ?? []}
                results={resultsMap}
                onUpdate={handleResultUpdate}
                filterType={activeTab === 'measurements' ? 'NUMERIC' : 'other'}
              />
            )}
            {activeTab === 'notes' && (
              <NotesTab inspectionId={id!} onSubmit={handleNoteSubmit} />
            )}
            {activeTab === 'voice' && (
              <VoiceNotesTab inspectionId={id!} />
            )}
            {activeTab === 'photos' && (
              <PhotosTab inspectionId={id!} onCapture={handlePhotoCapture} />
            )}
            {activeTab === 'history' && (
              <HistoryTab inspectionId={id!} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
