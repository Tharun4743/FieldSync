import { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/database';
import { useAuthStore } from '@/stores/authStore';
import { createOperation } from '@/lib/db/repositories/operations';
import { createAuditEvent } from '@/lib/db/repositories/auditEvents';
import { syncManager } from '@/lib/sync/syncManager';
import { Camera, Upload, Layers, MapPin, CheckCircle2, Sliders, Calendar } from 'lucide-react';
import type { WorkEvidence, EvidenceStage } from '@/types/db';

interface BeforeAfterEvidenceTabProps {
  inspectionId: string;
  readOnly?: boolean;
}

export default function BeforeAfterEvidenceTab({
  inspectionId,
  readOnly = false,
}: BeforeAfterEvidenceTabProps) {
  const { user } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeStage, setActiveStage] = useState<EvidenceStage>('BEFORE');
  const [evidenceTitle, setEvidenceTitle] = useState('');
  const [evidenceDescription, setEvidenceDescription] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [viewMode, setViewMode] = useState<'cards' | 'compare'>('cards');

  // Query evidence from IndexedDB
  const evidenceList = useLiveQuery(
    () => db.workEvidence.where('inspectionId').equals(inspectionId).toArray(),
    [inspectionId]
  ) as WorkEvidence[] | undefined;

  const beforeEvidence = evidenceList?.filter((e) => e.stage === 'BEFORE') ?? [];
  const afterEvidence = evidenceList?.filter((e) => e.stage === 'AFTER') ?? [];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleSaveEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !user) return;

    setIsCapturing(true);
    try {
      const evidenceId = crypto.randomUUID();
      const now = new Date().toISOString();

      // Read location if browser permits
      let lat: number | undefined;
      let lng: number | undefined;
      try {
        if ('geolocation' in navigator) {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 });
          });
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        }
      } catch {
        // Geolocation optional fallback
      }

      // Convert file to Base64 data URL for durable local storage
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(selectedFile);
      });

      const record: WorkEvidence = {
        id: evidenceId,
        inspectionId,
        stage: activeStage,
        title: evidenceTitle.trim() || `${activeStage} Intervention Evidence`,
        description: evidenceDescription.trim() || undefined,
        photoUrl: dataUrl,
        localBlob: selectedFile,
        capturedBy: user.id,
        capturedByName: user.fullName || 'Field Technician',
        capturedAt: now,
        gpsLatitude: lat,
        gpsLongitude: lng,
        syncStatus: 'PENDING',
      };

      await db.workEvidence.put(record);

      await createOperation({
        userId: user.id,
        inspectionId,
        entityType: 'workEvidence',
        entityId: evidenceId,
        operationType: 'CREATE',
        payload: {
          id: evidenceId,
          inspectionId,
          stage: activeStage,
          title: record.title,
          description: record.description,
          capturedAt: now,
          gpsLatitude: lat,
          gpsLongitude: lng,
        },
      });

      await createAuditEvent({
        userId: user.id,
        userName: user.fullName,
        inspectionId,
        entityType: 'WORK_EVIDENCE',
        entityId: evidenceId,
        action: 'PHOTO_ADDED',
        field: activeStage,
        afterValue: record.title,
      });

      // Reset form
      setSelectedFile(null);
      setPreviewUrl(null);
      setEvidenceTitle('');
      setEvidenceDescription('');
      void syncManager.syncNow();
    } catch (err) {
      console.error('Failed to save evidence:', err);
    } finally {
      setIsCapturing(false);
    }
  };

  const primaryBefore = beforeEvidence[0];
  const primaryAfter = afterEvidence[0];

  return (
    <div className="space-y-6">
      {/* Top Banner & Mode Toggle */}
      <div className="bg-white rounded-3xl p-5 border border-zinc-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-zinc-900">Before & After Field Evidence</h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              Audit Standard
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Capture initial damage state prior to remediation, followed by the restored condition.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'cards'
                ? 'bg-zinc-900 text-white shadow-2xs'
                : 'bg-zinc-100 text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Dual View ({beforeEvidence.length}B / {afterEvidence.length}A)
          </button>
          {primaryBefore && primaryAfter && (
            <button
              type="button"
              onClick={() => setViewMode('compare')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'compare'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
              }`}
            >
              <Sliders size={13} /> Interactive Slider
            </button>
          )}
        </div>
      </div>

      {/* Interactive Before/After Split Comparison Slider */}
      {viewMode === 'compare' && primaryBefore && primaryAfter && (
        <div className="bg-white rounded-3xl p-5 border border-zinc-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-amber-600 uppercase tracking-wider">◀ Before Intervention</span>
            <span className="font-bold text-emerald-600 uppercase tracking-wider">Restored After ▶</span>
          </div>

          <div className="relative aspect-video max-h-[420px] w-full bg-zinc-900 rounded-2xl overflow-hidden select-none">
            {/* After Image (Background) */}
            <img
              src={primaryAfter.photoUrl}
              alt="After remediation"
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Before Image (Clipped Overlay) */}
            <div
              className="absolute inset-y-0 left-0 overflow-hidden"
              style={{ width: `${sliderPosition}%` }}
            >
              <img
                src={primaryBefore.photoUrl}
                alt="Before remediation"
                className="absolute inset-0 w-full h-full object-cover max-w-none"
                style={{ width: '100%', minWidth: '100%' }}
              />
            </div>

            {/* Draggable Divider Bar */}
            <div
              className="absolute inset-y-0 w-1 bg-white cursor-ew-resize shadow-2xl flex items-center justify-center pointer-events-none"
              style={{ left: `${sliderPosition}%` }}
            >
              <div className="w-8 h-8 rounded-full bg-white text-zinc-900 shadow-xl flex items-center justify-center font-mono text-[10px] font-bold">
                ⇔
              </div>
            </div>

            {/* Interactive range slider input */}
            <input
              type="range"
              min="0"
              max="100"
              value={sliderPosition}
              onChange={(e) => setSliderPosition(Number(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-10"
              aria-label="Before after comparison slider"
            />
          </div>
          <p className="text-center text-[11px] text-zinc-400">
            Drag the slider horizontally to compare initial damage vs final repair
          </p>
        </div>
      )}

      {/* Capture Evidence Form (Technicians only, not in read-only) */}
      {!readOnly && (
        <form
          onSubmit={handleSaveEvidence}
          className="bg-white rounded-3xl p-5 border border-zinc-200/80 shadow-xs space-y-4"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-zinc-900">Record New Evidence</h4>
            {/* Stage Selector */}
            <div className="flex p-1 bg-zinc-100 rounded-xl border border-zinc-200/60">
              <button
                type="button"
                onClick={() => setActiveStage('BEFORE')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeStage === 'BEFORE'
                    ? 'bg-amber-500 text-white shadow-2xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                1. BEFORE Stage
              </button>
              <button
                type="button"
                onClick={() => setActiveStage('AFTER')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeStage === 'AFTER'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                2. AFTER Stage
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* File upload/camera input */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                Photo Proof ({activeStage})
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all min-h-[140px] ${
                  previewUrl
                    ? 'border-indigo-300 bg-indigo-50/20'
                    : 'border-zinc-200 hover:border-indigo-400 bg-zinc-50/50'
                }`}
              >
                {previewUrl ? (
                  <div className="relative w-full aspect-video rounded-xl overflow-hidden max-h-[160px]">
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                    <span className="absolute bottom-2 right-2 text-[10px] font-bold bg-black/70 text-white px-2 py-0.5 rounded-md">
                      Change Photo
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2">
                      <Camera size={20} />
                    </div>
                    <span className="text-xs font-bold text-zinc-800">Take Photo or Browse</span>
                    <span className="text-[11px] text-zinc-400 mt-0.5">JPEG, PNG from device camera</span>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </div>

            {/* Title & Notes */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Evidence Title / Component
                </label>
                <input
                  type="text"
                  placeholder={
                    activeStage === 'BEFORE'
                      ? 'e.g. Blown fuse / Cable fray / Corroded contact'
                      : 'e.g. Replaced 10A fuse / Rewired conduit'
                  }
                  value={evidenceTitle}
                  onChange={(e) => setEvidenceTitle(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-zinc-200 text-xs focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Technical Remarks (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional context on the physical state..."
                  value={evidenceDescription}
                  onChange={(e) => setEvidenceDescription(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-zinc-200 text-xs focus:outline-hidden focus:border-indigo-500 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={!selectedFile || isCapturing}
                className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm shadow-indigo-100 cursor-pointer transition-all"
              >
                <Upload size={14} />
                {isCapturing ? 'Saving Evidence…' : `Save ${activeStage} Evidence`}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Dual Columns: Before vs After cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* BEFORE COLUMN */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-zinc-200">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                Before Intervention ({beforeEvidence.length})
              </h4>
            </div>
            <span className="text-[10px] text-zinc-400">Pre-remediation state</span>
          </div>

          {beforeEvidence.length === 0 ? (
            <div className="p-8 rounded-2xl bg-zinc-50 border border-dashed border-zinc-200 text-center">
              <Layers size={24} className="text-zinc-400 mx-auto mb-2 opacity-50" />
              <p className="text-xs font-semibold text-zinc-600">No &quot;Before&quot; photos recorded</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Technician should photograph defect prior to making repairs.
              </p>
            </div>
          ) : (
            beforeEvidence.map((ev) => (
              <div
                key={ev.id}
                className="bg-white rounded-2xl overflow-hidden border border-zinc-200 shadow-2xs hover:shadow-xs transition-shadow"
              >
                <div className="aspect-video w-full bg-zinc-900 relative">
                  <img src={ev.photoUrl} alt={ev.title} className="w-full h-full object-cover" />
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-amber-500 text-white font-bold text-[10px] uppercase shadow-sm">
                    BEFORE
                  </span>
                </div>
                <div className="p-3.5 space-y-1.5">
                  <h5 className="text-xs font-bold text-zinc-900">{ev.title}</h5>
                  {ev.description && <p className="text-[11px] text-zinc-600">{ev.description}</p>}
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1 border-t border-zinc-100">
                    <span className="flex items-center gap-1">
                      <Calendar size={11} />
                      {new Date(ev.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span>By {ev.capturedByName}</span>
                    {ev.gpsLatitude && (
                      <span className="flex items-center gap-0.5 text-indigo-600 font-semibold">
                        <MapPin size={10} /> Geo-tagged
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* AFTER COLUMN */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-zinc-200">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                After Remediation ({afterEvidence.length})
              </h4>
            </div>
            <span className="text-[10px] text-zinc-400">Post-repair condition</span>
          </div>

          {afterEvidence.length === 0 ? (
            <div className="p-8 rounded-2xl bg-zinc-50 border border-dashed border-zinc-200 text-center">
              <CheckCircle2 size={24} className="text-zinc-400 mx-auto mb-2 opacity-50" />
              <p className="text-xs font-semibold text-zinc-600">No &quot;After&quot; photos recorded</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Technician takes evidence upon resolving the fault.
              </p>
            </div>
          ) : (
            afterEvidence.map((ev) => (
              <div
                key={ev.id}
                className="bg-white rounded-2xl overflow-hidden border border-zinc-200 shadow-2xs hover:shadow-xs transition-shadow"
              >
                <div className="aspect-video w-full bg-zinc-900 relative">
                  <img src={ev.photoUrl} alt={ev.title} className="w-full h-full object-cover" />
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-emerald-600 text-white font-bold text-[10px] uppercase shadow-sm">
                    AFTER
                  </span>
                </div>
                <div className="p-3.5 space-y-1.5">
                  <h5 className="text-xs font-bold text-zinc-900">{ev.title}</h5>
                  {ev.description && <p className="text-[11px] text-zinc-600">{ev.description}</p>}
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1 border-t border-zinc-100">
                    <span className="flex items-center gap-1">
                      <Calendar size={11} />
                      {new Date(ev.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span>By {ev.capturedByName}</span>
                    {ev.gpsLatitude && (
                      <span className="flex items-center gap-0.5 text-indigo-600 font-semibold">
                        <MapPin size={10} /> Geo-tagged
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
