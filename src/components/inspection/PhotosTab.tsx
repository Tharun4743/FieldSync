import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db/database';
import { syncManager } from '../../lib/sync/syncManager';
import { Camera, Upload, Pause, AlertCircle, Loader2, Image } from 'lucide-react';

interface Props {
  inspectionId: string;
  onCapture: (file: File) => Promise<void>;
  readOnly?: boolean;
}

export default function PhotosTab({ inspectionId, onCapture, readOnly }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingMediaId, setUploadingMediaId] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  const media = useLiveQuery(
    () => db.media.where('inspectionId').equals(inspectionId).toArray(),
    [inspectionId]
  );

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCapturing(true);
    try {
      await onCapture(file);
    } finally {
      setCapturing(false);
      e.target.value = '';
    }
  }

  async function handleUploadNow(mediaId: string) {
    setUploadingMediaId(mediaId);
    try {
      await syncManager.syncNow();
    } finally {
      setUploadingMediaId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Capture / Select — hidden in readOnly mode */}
      {!readOnly ? (
        <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-sm space-y-3">
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block">Add Inspection Media</label>
          <div className="flex gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="h-11 px-5 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95 disabled:opacity-40 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-indigo-100 flex-1"
              disabled={capturing}
              id="btn-capture-photo"
            >
              {capturing ? (
                <><Loader2 size={16} className="animate-spin" /> Saving…</>
              ) : (
                <><Camera size={16} /> Take / Select Photo</>
              )}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileSelect}
            id="photo-file-input"
          />
          <p className="text-[11px] font-medium text-zinc-400">
            Photos cached locally in IndexedDB immediately · chunked resumable upload to Cloudinary when online
          </p>
        </div>
      ) : (
        <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-200 text-purple-900 text-xs flex items-center gap-2.5 font-medium">
          <span className="text-base">👁</span>
          <span>Reviewer Mode — photo gallery is read-only. You cannot capture new photos for this inspection.</span>
        </div>
      )}

      {/* Photo grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5">
        {media?.map(m => {
          const isCurrentUploading = uploadingMediaId === m.id;
          const status = isCurrentUploading ? 'UPLOADING' : m.uploadStatus;
          const pct = m.uploadedBytes && m.totalBytes
            ? Math.round((m.uploadedBytes / m.totalBytes) * 100)
            : 0;

          return (
            <div key={m.id} className="bg-white border border-zinc-200/80 rounded-2xl overflow-hidden shadow-sm flex flex-col" id={`photo-${m.id}`}>
              {/* Preview */}
              <div className="aspect-square bg-zinc-100 flex items-center justify-center relative overflow-hidden">
                {m.secureUrl ? (
                  <img
                    src={m.secureUrl.replace('/upload/', '/upload/w_400,h_400,c_fill/')}
                    alt={m.fileName}
                    className="w-full h-full object-cover"
                  />
                ) : m.localBlob ? (
                  <BlobPreview blob={m.localBlob} alt={m.fileName} />
                ) : (
                  <Image size={32} className="text-zinc-300" />
                )}

                {/* Status overlay */}
                {status !== 'COMPLETED' && (
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center">
                    <UploadStatusIcon status={status} />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-3 space-y-2">
                <p className="text-xs font-bold text-zinc-900 truncate">{m.fileName}</p>
                {status === 'COMPLETED' ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 inline-block">
                    Uploaded
                  </span>
                ) : status === 'UPLOADING' ? (
                  <div className="space-y-1">
                    <div className="w-full bg-zinc-100 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-indigo-600 h-full rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[10px] font-bold text-indigo-600">{pct}% uploading</p>
                  </div>
                ) : status === 'PAUSED' ? (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 inline-block">
                      Paused at {pct}%
                    </span>
                    <button
                      onClick={() => handleUploadNow(m.id)}
                      className="w-full h-7 rounded-lg text-[10px] font-bold bg-zinc-100 text-zinc-700 hover:bg-zinc-200 transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Upload size={11} /> Resume
                    </button>
                  </div>
                ) : status === 'FAILED' ? (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 inline-block">
                      Failed
                    </span>
                    <button
                      onClick={() => handleUploadNow(m.id)}
                      className="w-full h-7 rounded-lg text-[10px] font-bold bg-zinc-100 text-zinc-700 hover:bg-zinc-200 transition-all cursor-pointer"
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200 inline-block">
                    Queued
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {media?.length === 0 && (
          <div className="col-span-full text-center text-zinc-400 py-12 bg-white rounded-2xl border border-zinc-200/80 p-8 shadow-sm">
            <Camera size={32} className="mx-auto mb-2 text-zinc-300" />
            <p className="font-semibold text-sm">No photos attached yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function BlobPreview({ blob, alt }: { blob: Blob; alt: string }) {
  const [url] = useState(() => URL.createObjectURL(blob));
  return <img src={url} alt={alt} className="w-full h-full object-cover" />;
}

function UploadStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'UPLOADING': return <Loader2 size={24} className="text-white animate-spin" />;
    case 'PAUSED': return <Pause size={24} className="text-amber-300" />;
    case 'FAILED': return <AlertCircle size={24} className="text-rose-400" />;
    default: return <Upload size={24} className="text-white/80" />;
  }
}
