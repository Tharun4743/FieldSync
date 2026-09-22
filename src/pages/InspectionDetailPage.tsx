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
import { ArrowLeft, AlertTriangle, Zap, CheckCircle2, Send, Clock } from 'lucide-react';
import WorkflowStepper from '../components/inspection/WorkflowStepper';
import SupervisorWorkflowActions from '../components/inspection/SupervisorWorkflowActions';
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
  const [submittingWork, setSubmittingWork] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

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

  async function handleTechnicianSubmitWork(): Promise<void> {
    if (!user || !id || !inspection) return;
    setSubmittingWork(true);
    try {
      const now = new Date().toISOString();
      const updated: Inspection = {
        ...inspection,
        workflowStage: 'AWAITING_VERIFICATION',
        technicianCompletedAt: now,
        localVersion: inspection.localVersion + 1,
        updatedAt: now,
      };

      await db.inspections.put(updated);

      await db.notes.put({
        id: crypto.randomUUID(),
        inspectionId: id,
        authorId: user.id,
        authorName: user.fullName,
        content: `[TECHNICIAN WORK COMPLETED by ${user.fullName}]: Field inspection and measurements completed. Work submitted for supervisor quality verification.`,
        syncStatus: 'PENDING',
        createdAt: now,
        updatedAt: now,
      });

      await createAuditEvent({
        userId: user.id,
        userName: user.fullName,
        entityType: 'INSPECTION',
        entityId: id,
        inspectionId: id,
        action: 'INSPECTION_COMPLETED',
        field: 'workflowStage',
        beforeValue: inspection.workflowStage || 'FIELD_WORK',
        afterValue: 'AWAITING_VERIFICATION',
        metadata: {
          submittedBy: user.fullName,
          timestamp: now,
        },
      });

      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 5000);
      void syncManager.syncNow();
    } catch (err) {
      console.error('Failed to submit field work:', err);
    } finally {
      setSubmittingWork(false);
    }
  }

  const isSupervisor = user?.role === 'SUPERVISOR';
  const isAdmin = user?.role === 'ADMIN';
  const isCompleted = inspection.status === 'COMPLETED' || inspection.workflowStage === 'RESOLVED';
  const isAwaitingVerification = inspection.workflowStage === 'AWAITING_VERIFICATION';
  const isReadOnly = isSupervisor || isCompleted || (user?.role === 'TECHNICIAN' && isAwaitingVerification);

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
                {isReadOnly && (
                  <span className="text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                    👁 Reviewer Mode
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

            {!isReadOnly && (
              <button
                onClick={() => setIsQuickMode(!isQuickMode)}
                className="h-10 px-4 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-sm shadow-indigo-100 transition-all cursor-pointer shrink-0"
                id="btn-toggle-quick-mode"
              >
                <Zap size={15} />
                {isQuickMode ? 'Standard View' : 'Quick Mode'}
              </button>
            )}
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
      <div className="flex-1 w-full p-4 sm:p-5 space-y-4">
        {/* Interactive 6-Stage Workflow Stepper */}
        <WorkflowStepper inspection={inspection} />

        {/* Technician Work Submission Success Alert */}
        {submitSuccess && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-3 animate-fade-in shadow-xs">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <div>
              <p className="font-bold">Work Submitted for Quality Verification!</p>
              <p className="font-normal text-emerald-700 text-[11px] mt-0.5">
                The supervisor has been notified. This ticket is now in stage 5 (Awaiting Verification).
              </p>
            </div>
          </div>
        )}

        {/* Supervisor Workflow Actions Bar (Coordinate / Dispatch / Verify / Rework) */}
        {(isSupervisor || isAdmin) && (
          <SupervisorWorkflowActions inspection={inspection} />
        )}

        {/* Technician Active Field Work Action Banner */}
        {user?.role === 'TECHNICIAN' &&
          (inspection.workflowStage === 'FIELD_WORK' ||
            inspection.workflowStage === 'REWORK_REQUESTED' ||
            (!inspection.workflowStage && inspection.status === 'IN_PROGRESS')) && (
            <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 text-sky-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0">
                  <Send size={15} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-sky-950">Field Work in Progress</h4>
                  <p className="text-[11px] text-sky-700">
                    Complete your checklist answers, measurements, and photos. When finished, submit for Supervisor Verification.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleTechnicianSubmitWork}
                disabled={submittingWork}
                className="h-9 px-4 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white disabled:opacity-50 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-sky-200 shrink-0"
                id="btn-technician-submit-work"
              >
                <CheckCircle2 size={14} />
                {submittingWork ? 'Submitting…' : 'Submit Work for Supervisor Verification'}
              </button>
            </div>
          )}

        {/* Technician Awaiting Verification Notice */}
        {user?.role === 'TECHNICIAN' && inspection.workflowStage === 'AWAITING_VERIFICATION' && (
          <div className="p-3.5 rounded-2xl bg-violet-50 border border-violet-200 text-violet-900 text-xs flex items-center gap-2.5 font-medium shadow-2xs">
            <Clock size={16} className="text-violet-600 shrink-0" />
            <span>
              <strong>Work Submitted for Verification</strong> — Your findings and measurements have been sent to the Supervisor for final quality review and sign-off.
            </span>
          </div>
        )}

        {/* Resolved Banner */}
        {(inspection.workflowStage === 'RESOLVED' || inspection.status === 'COMPLETED') && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2.5 font-medium shadow-2xs">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>
              <strong>Issue Formally Resolved</strong> — Verified by{' '}
              <strong>{inspection.verifiedByName || 'Authorized Supervisor'}</strong> on{' '}
              {inspection.verifiedAt ? new Date(inspection.verifiedAt).toLocaleDateString() : 'recent'}. Records are locked for audit compliance.
            </span>
          </div>
        )}

        {/* Reviewer mode banner for supervisors when not yet verified */}
        {isReadOnly && inspection.status !== 'COMPLETED' && inspection.workflowStage !== 'RESOLVED' && (
          <div className="p-3 rounded-2xl bg-purple-50/70 border border-purple-200/80 text-purple-900 text-xs flex items-center gap-2 font-medium">
            <span className="text-sm">👁</span>
            <span>
              <strong>Reviewer Mode</strong> — Viewing checklist and field records. Use the Supervisor Quality actions above to verify completion or request rework.
            </span>
          </div>
        )}
        {isQuickMode && !isReadOnly ? (
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
                readOnly={isReadOnly}
              />
            )}
            {activeTab === 'notes' && (
              <NotesTab inspectionId={id!} onSubmit={handleNoteSubmit} readOnly={isReadOnly} />
            )}
            {activeTab === 'voice' && (
              <VoiceNotesTab inspectionId={id!} readOnly={isReadOnly} />
            )}
            {activeTab === 'photos' && (
              <PhotosTab inspectionId={id!} onCapture={handlePhotoCapture} readOnly={isReadOnly} />
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
