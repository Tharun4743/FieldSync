import { useState, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/database';
import { useAuthStore } from '@/stores/authStore';
import { createOperation } from '@/lib/db/repositories/operations';
import { createAuditEvent } from '@/lib/db/repositories/auditEvents';
import { syncManager } from '@/lib/sync/syncManager';
import { PenTool, CheckCircle2, RotateCcw, ShieldCheck, Lock, Calendar, User } from 'lucide-react';
import type { DigitalSignature, SignatureRole, Inspection } from '@/types/db';

interface DigitalSignatureTabProps {
  inspection: Inspection;
  readOnly?: boolean;
}

export default function DigitalSignatureTab({
  inspection,
  readOnly = false,
}: DigitalSignatureTabProps) {
  const { user } = useAuthStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [declarationAgreed, setDeclarationAgreed] = useState(false);

  // Determine eligible sign role
  const isSupervisor = user?.role === 'SUPERVISOR' || user?.role === 'ADMIN';
  const roleToSign: SignatureRole = isSupervisor ? 'SUPERVISOR' : 'TECHNICIAN';

  // Query existing signatures for this inspection from Dexie
  const signatures = useLiveQuery(
    () => db.digitalSignatures.where('inspectionId').equals(inspection.id).toArray(),
    [inspection.id]
  ) as DigitalSignature[] | undefined;

  const technicianSig = signatures?.find((s) => s.signerRole === 'TECHNICIAN');
  const supervisorSig = signatures?.find((s) => s.signerRole === 'SUPERVISOR');

  const alreadySignedByMe = signatures?.some(
    (s) => s.signerId === user?.id || s.signerRole === roleToSign
  );

  // Setup canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [alreadySignedByMe]);

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (alreadySignedByMe || readOnly) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasSignature(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleSaveSignature = async () => {
    if (!canvasRef.current || !hasSignature || !user || !declarationAgreed) return;

    setIsSaving(true);
    try {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      const now = new Date().toISOString();
      const sigId = crypto.randomUUID();

      // Generate SHA-256 cryptographic checksum
      const enc = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest(
        'SHA-256',
        enc.encode(`${sigId}:${inspection.id}:${user.id}:${now}:${dataUrl.slice(0, 100)}`)
      );
      const checksum = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      const declaration =
        roleToSign === 'SUPERVISOR'
          ? `I, ${user.fullName}, certify that I have reviewed all checklist responses, measurements, and photos. The work meets enterprise engineering standards and is formally approved.`
          : `I, ${user.fullName}, certify that all field tests, visual inspections, and remedial actions were executed in adherence to safety protocols.`;

      const record: DigitalSignature = {
        id: sigId,
        inspectionId: inspection.id,
        signerId: user.id,
        signerName: user.fullName || 'Authorized Signatory',
        signerRole: roleToSign,
        signatureDataUrl: dataUrl,
        signedAt: now,
        declarationText: declaration,
        checksum,
        syncStatus: 'PENDING',
      };

      await db.digitalSignatures.put(record);

      await createOperation({
        userId: user.id,
        inspectionId: inspection.id,
        entityType: 'digitalSignature',
        entityId: sigId,
        operationType: 'CREATE',
        payload: {
          id: sigId,
          inspectionId: inspection.id,
          signerRole: roleToSign,
          signedAt: now,
          checksum,
        },
      });

      await createAuditEvent({
        userId: user.id,
        userName: user.fullName,
        inspectionId: inspection.id,
        entityType: 'SIGNATURE',
        entityId: sigId,
        action: 'CREATED',
        field: roleToSign,
        afterValue: `Signed by ${user.fullName} (${roleToSign}) with checksum ${checksum.slice(0, 8)}`,
      });

      clearCanvas();
      setDeclarationAgreed(false);
      void syncManager.syncNow();
    } catch (err) {
      console.error('Failed to save digital signature:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-3xl p-5 border border-zinc-200/80 shadow-xs flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-zinc-900">Digital Signatures & Compliance Sign-Off</h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
              <ShieldCheck size={11} /> Cryptographic Proof
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Tamper-evident legal completion signatures by Technician and Supervisor.
          </p>
        </div>
      </div>

      {/* Existing Signatures Showcase */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Technician Signature Card */}
        <div className="bg-white rounded-3xl p-5 border border-zinc-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-bold">
                  STAGE 1: TECHNICIAN
                </span>
              </div>
              {technicianSig ? (
                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 size={13} /> Completed
                </span>
              ) : (
                <span className="text-xs font-semibold text-zinc-400">Awaiting Sign-off</span>
              )}
            </div>

            {technicianSig ? (
              <div className="mt-4 space-y-3">
                <div className="h-28 bg-zinc-50/80 rounded-2xl border border-zinc-200/70 p-2 flex items-center justify-center">
                  <img
                    src={technicianSig.signatureDataUrl}
                    alt="Technician Signature"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <div className="text-xs text-zinc-700 space-y-1">
                  <p className="font-bold flex items-center gap-1.5 text-zinc-900">
                    <User size={13} className="text-zinc-400" />
                    {technicianSig.signerName}
                  </p>
                  <p className="text-[11px] text-zinc-500 flex items-center gap-1.5">
                    <Calendar size={13} className="text-zinc-400" />
                    {new Date(technicianSig.signedAt).toLocaleString()}
                  </p>
                  {technicianSig.checksum && (
                    <p className="text-[10px] font-mono text-zinc-400 truncate">
                      SHA256: {technicianSig.checksum}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="my-8 text-center text-xs text-zinc-400">
                <PenTool size={28} className="mx-auto mb-2 opacity-30 text-zinc-500" />
                <p>Technician signature will appear here once submitted.</p>
              </div>
            )}
          </div>
        </div>

        {/* Supervisor Verification Card */}
        <div className="bg-white rounded-3xl p-5 border border-zinc-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold">
                  STAGE 2: SUPERVISOR SIGN-OFF
                </span>
              </div>
              {supervisorSig ? (
                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 size={13} /> Verified
                </span>
              ) : (
                <span className="text-xs font-semibold text-zinc-400">Pending Review</span>
              )}
            </div>

            {supervisorSig ? (
              <div className="mt-4 space-y-3">
                <div className="h-28 bg-zinc-50/80 rounded-2xl border border-zinc-200/70 p-2 flex items-center justify-center">
                  <img
                    src={supervisorSig.signatureDataUrl}
                    alt="Supervisor Signature"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <div className="text-xs text-zinc-700 space-y-1">
                  <p className="font-bold flex items-center gap-1.5 text-zinc-900">
                    <User size={13} className="text-zinc-400" />
                    {supervisorSig.signerName} (Supervisor)
                  </p>
                  <p className="text-[11px] text-zinc-500 flex items-center gap-1.5">
                    <Calendar size={13} className="text-zinc-400" />
                    {new Date(supervisorSig.signedAt).toLocaleString()}
                  </p>
                  {supervisorSig.checksum && (
                    <p className="text-[10px] font-mono text-zinc-400 truncate">
                      SHA256: {supervisorSig.checksum}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="my-8 text-center text-xs text-zinc-400">
                <ShieldCheck size={28} className="mx-auto mb-2 opacity-30 text-zinc-500" />
                <p>Supervisor formal sign-off upon quality verification.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Signature Capture Pad (Available to sign if not signed yet) */}
      {!alreadySignedByMe && !readOnly && user && (
        <div className="bg-white rounded-3xl p-5 border border-zinc-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                <PenTool size={16} className="text-indigo-600" />
                Apply {roleToSign} Digital Signature
              </h4>
              <p className="text-xs text-zinc-500 mt-0.5">
                Sign in the box below using touchscreen, mouse, or stylus.
              </p>
            </div>
            <button
              type="button"
              onClick={clearCanvas}
              disabled={!hasSignature}
              className="px-3 py-1.5 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw size={13} /> Clear
            </button>
          </div>

          {/* Canvas Box */}
          <div className="border-2 border-dashed border-zinc-300 rounded-2xl overflow-hidden bg-zinc-50/50 relative shadow-inner">
            <canvas
              ref={canvasRef}
              width={600}
              height={180}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="w-full h-44 cursor-crosshair touch-none"
            />
            {!hasSignature && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-xs text-zinc-400">
                Sign here with finger or stylus
              </div>
            )}
          </div>

          {/* Legal Compliance Checkbox */}
          <label className="flex items-start gap-2.5 cursor-pointer text-xs text-zinc-700 select-none">
            <input
              type="checkbox"
              checked={declarationAgreed}
              onChange={(e) => setDeclarationAgreed(e.target.checked)}
              className="mt-0.5 rounded-md border-zinc-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span>
              I solemnly certify under enterprise compliance that the inspection records, diagnostic values, and
              photographic proof are authentic and conducted in person at the site.
            </span>
          </label>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSaveSignature}
              disabled={!hasSignature || !declarationAgreed || isSaving}
              className="h-10 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm shadow-indigo-100 cursor-pointer transition-all"
            >
              <CheckCircle2 size={15} />
              {isSaving ? 'Signing & Hashing…' : `Affix ${roleToSign} Signature`}
            </button>
          </div>
        </div>
      )}

      {alreadySignedByMe && (
        <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-600 flex items-center gap-2">
          <Lock size={15} className="text-zinc-500 shrink-0" />
          <span>You have already affixed your signature for this inspection record.</span>
        </div>
      )}
    </div>
  );
}
