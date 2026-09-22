import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, RotateCcw, Check, AlertCircle, Loader2 } from 'lucide-react';
import { queueVoiceNote } from '@/lib/db/repositories/voiceNotes';
import { useAuthStore } from '@/stores/authStore';

interface Props {
  inspectionId: string;
  checklistItemId?: string;
  onSaved?: () => void;
  onCancel?: () => void;
}

export default function VoiceNoteRecorder({
  inspectionId,
  checklistItemId,
  onSaved,
  onCancel,
}: Props) {
  const { user } = useAuthStore();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setIsSupported(false);
      setErrorMessage('Audio recording is not supported on this browser/device.');
    }
  }, []);

  // Cleanup object URLs and audio on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current = null;
      }
    };
  }, [audioUrl]);

  async function startRecording() {
    setErrorMessage(null);
    audioChunksRef.current = [];
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setAudioBlob(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const fullBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
        setAudioBlob(fullBlob);
        const url = URL.createObjectURL(fullBlob);
        setAudioUrl(url);

        // Stop all audio tracks to release microphone
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start(250); // collect 250ms chunks
      setIsRecording(true);
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: unknown) {
      console.error('[VoiceRecorder] Error accessing mic:', err);
      const errObj = err as { name?: string };
      if (errObj.name === 'NotAllowedError' || errObj.name === 'PermissionDeniedError') {
        setErrorMessage('Microphone permission was denied. Please allow microphone access.');
      } else {
        setErrorMessage('Unable to access microphone on this device.');
      }
      setIsRecording(false);
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
  }

  function handlePlayToggle() {
    if (!audioUrl) return;

    if (!audioElementRef.current) {
      const audio = new Audio(audioUrl);
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => setIsPlaying(false);
      audioElementRef.current = audio;
    }

    if (isPlaying) {
      audioElementRef.current.pause();
      setIsPlaying(false);
    } else {
      audioElementRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((e) => {
        console.error('Audio play error:', e);
        setIsPlaying(false);
      });
    }
  }

  function handleReRecord() {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current = null;
    }
    setIsPlaying(false);
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setRecordingDuration(0);
    void startRecording();
  }

  async function handleSave() {
    if (!audioBlob || !user) return;
    setIsSaving(true);
    setErrorMessage(null);

    try {
      await queueVoiceNote({
        inspectionId,
        checklistItemId,
        technicianId: user.id,
        blob: audioBlob,
        duration: recordingDuration || 1,
        fileName: `voice-${Date.now()}.${audioBlob.type.includes('mp4') ? 'm4a' : 'webm'}`,
      });
      onSaved?.();
    } catch (e) {
      console.error('[VoiceRecorder] Save error:', e);
      setErrorMessage('Failed to save voice note to local database.');
    } finally {
      setIsSaving(false);
    }
  }

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  if (!isSupported) {
    return (
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-amber-800 text-xs">
        <AlertCircle size={18} className="shrink-0 text-amber-600 mt-0.5" />
        <div>
          <p className="font-bold">Microphone Unavailable</p>
          <p className="mt-0.5">{errorMessage || 'Your browser does not support audio recording.'}</p>
          {onCancel && (
            <button
              onClick={onCancel}
              className="mt-2 text-xs font-bold text-amber-900 underline cursor-pointer"
            >
              Close
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-zinc-200/90 rounded-2xl p-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-rose-500 animate-pulse' : 'bg-indigo-500'}`} />
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-600">
            {isRecording ? 'Recording Voice Observation...' : audioBlob ? 'Voice Note Preview' : 'Record Voice Observation'}
          </h4>
        </div>
        <span className="font-mono text-sm font-bold text-zinc-800 bg-zinc-100 px-2.5 py-0.5 rounded-lg border border-zinc-200">
          {formatTime(recordingDuration)}
        </span>
      </div>

      {errorMessage && (
        <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200/60 p-2.5 rounded-xl flex items-center gap-2">
          <AlertCircle size={14} className="shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* State 1: Idle (Not started yet) */}
      {!isRecording && !audioBlob && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void startRecording()}
            className="flex-1 h-11 px-4 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95 shadow-xs shadow-indigo-100 flex items-center justify-center gap-2 transition-all cursor-pointer"
            id="btn-start-record-voice"
          >
            <Mic size={15} />
            Record Voice Note
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 h-11 rounded-xl font-bold text-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition-all cursor-pointer"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {/* State 2: Currently recording */}
      {isRecording && (
        <div className="space-y-3">
          <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
            <div className="h-full bg-rose-500 animate-pulse w-full" />
          </div>
          <button
            type="button"
            onClick={stopRecording}
            className="w-full h-11 px-4 rounded-xl font-bold text-xs bg-rose-600 hover:bg-rose-700 text-white active:scale-95 shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            id="btn-stop-record-voice"
          >
            <Square size={14} className="fill-white" />
            Stop Recording
          </button>
        </div>
      )}

      {/* State 3: Recorded, ready for preview and save */}
      {!isRecording && audioBlob && (
        <div className="space-y-3 pt-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePlayToggle}
              className="h-10 px-4 rounded-xl font-bold text-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-800 flex items-center gap-2 transition-colors cursor-pointer border border-zinc-200"
              id="btn-preview-play-voice"
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} className="fill-zinc-800" />}
              {isPlaying ? 'Pause' : 'Play'}
            </button>

            <button
              type="button"
              onClick={handleReRecord}
              className="h-10 px-3 rounded-xl font-bold text-xs bg-zinc-50 hover:bg-zinc-100 text-zinc-600 flex items-center gap-1.5 transition-colors cursor-pointer border border-zinc-200/80"
              id="btn-rerecord-voice"
            >
              <RotateCcw size={13} />
              Re-record
            </button>

            <div className="flex-1" />

            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving}
              className="h-10 px-5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-40"
              id="btn-save-voice-note"
            >
              {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={14} />}
              {isSaving ? 'Saving...' : 'Save Voice Note'}
            </button>
          </div>

          <p className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            Will save offline instantly into IndexedDB and queue for upload
          </p>
        </div>
      )}
    </div>
  );
}
