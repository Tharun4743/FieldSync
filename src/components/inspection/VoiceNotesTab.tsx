import { useState, useEffect } from 'react';
import { Mic, Trash2, Clock, AlertCircle } from 'lucide-react';
import type { VoiceNote } from '@/types/db';
import { getVoiceNotesByInspection, deleteVoiceNote } from '@/lib/db/repositories/voiceNotes';
import { useAuthStore } from '@/stores/authStore';
import VoiceNoteRecorder from './VoiceNoteRecorder';
import { useLanguageStore } from '@/stores/languageStore';

interface Props {
  inspectionId: string;
  readOnly?: boolean;
}

export default function VoiceNotesTab({ inspectionId, readOnly }: Props) {
  const { user } = useAuthStore();
  const t = useLanguageStore((s) => s.t);
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([]);
  const [showRecorder, setShowRecorder] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadNotes() {
    try {
      const notes = await getVoiceNotesByInspection(inspectionId);
      setVoiceNotes(notes);
    } catch (e) {
      console.error('Failed to load voice notes:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadNotes();
  }, [inspectionId]);

  async function handleDelete(note: VoiceNote) {
    if (!user) return;
    if (!confirm('Are you sure you want to delete this voice observation?')) return;
    await deleteVoiceNote(note.id, user.id);
    await loadNotes();
  }

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* Top Header / Add Voice Note */}
      <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-sm flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-zinc-900">Voice Observations</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            {readOnly
              ? 'Playback-only view. Field technicians recorded these voice notes offline.'
              : 'Record audio notes offline. Plays instantly from device storage and syncs when online.'}
          </p>
        </div>

        {!readOnly && !showRecorder && (
          <button
            onClick={() => setShowRecorder(true)}
            className="h-10 px-4 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2 shadow-xs shadow-indigo-100 transition-all cursor-pointer shrink-0"
            id="btn-add-voice-note-tab"
          >
            <Mic size={15} />
            {t('action.addVoiceNote')}
          </button>
        )}
      </div>

      {!readOnly && showRecorder && (
        <VoiceNoteRecorder
          inspectionId={inspectionId}
          onSaved={() => {
            setShowRecorder(false);
            void loadNotes();
          }}
          onCancel={() => setShowRecorder(false)}
        />
      )}

      {/* Voice Notes List */}
      {loading ? (
        <div className="p-8 text-center text-xs text-zinc-400">Loading voice notes...</div>
      ) : voiceNotes.length === 0 ? (
        <div className="bg-white border border-zinc-200/80 rounded-2xl p-8 text-center shadow-sm space-y-2">
          <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <Mic size={20} />
          </div>
          <p className="text-sm font-bold text-zinc-700">No Voice Observations Yet</p>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            Field technicians can record voice notes hands-free in loud environments without internet.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {voiceNotes.map((note) => {
            const blobUrl = note.localBlob ? URL.createObjectURL(note.localBlob) : note.remoteUrl;

            return (
              <div
                key={note.id}
                className="bg-white border border-zinc-200/80 rounded-2xl p-4 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                      <Mic size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-zinc-800">{note.fileName}</p>
                      <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
                        <span className="flex items-center gap-1 font-mono">
                          <Clock size={11} /> {formatDuration(note.duration)}
                        </span>
                        <span>·</span>
                        <span>{new Date(note.createdAt).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {note.uploadStatus === 'COMPLETED' ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {t('status.uploaded')}
                      </span>
                    ) : note.uploadStatus === 'PENDING' ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                        {t('status.savedOffline')}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200">
                        {note.uploadStatus}
                      </span>
                    )}

                    <button
                      onClick={() => void handleDelete(note)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Delete voice note"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {blobUrl ? (
                  <audio
                    src={blobUrl}
                    controls
                    className="w-full h-10 rounded-lg outline-none"
                    preload="metadata"
                  />
                ) : (
                  <div className="text-xs text-zinc-400 italic flex items-center gap-1.5 bg-zinc-50 p-2 rounded-xl">
                    <AlertCircle size={14} /> Audio file stored on server
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
