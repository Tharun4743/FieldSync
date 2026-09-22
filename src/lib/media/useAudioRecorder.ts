import { useState, useRef, useCallback, useEffect } from 'react';

export interface AudioRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  recordingDuration: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
  isSupported: boolean;
  errorMessage: string | null;
}

export function useAudioRecorder() {
  const [state, setState] = useState<AudioRecorderState>({
    isRecording: false,
    isPaused: false,
    recordingDuration: 0,
    audioBlob: null,
    audioUrl: null,
    isSupported: typeof window !== 'undefined' && !!navigator?.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined',
    errorMessage: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up streams and object URLs on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (state.audioUrl) {
        URL.revokeObjectURL(state.audioUrl);
      }
    };
  }, [state.audioUrl]);

  const startRecording = useCallback(async () => {
    if (!state.isSupported) {
      setState((s) => ({
        ...s,
        errorMessage: 'Audio recording is not supported on this browser or device.',
      }));
      return;
    }

    try {
      // Clear previous recording
      if (state.audioUrl) {
        URL.revokeObjectURL(state.audioUrl);
      }
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Select supported mimeType
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/ogg';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const fullBlob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const url = URL.createObjectURL(fullBlob);
        setState((s) => ({
          ...s,
          isRecording: false,
          audioBlob: fullBlob,
          audioUrl: url,
        }));
      };

      recorder.start(250); // collect 250ms chunks
      setState((s) => ({
        ...s,
        isRecording: true,
        recordingDuration: 0,
        audioBlob: null,
        audioUrl: null,
        errorMessage: null,
      }));

      // Start duration timer
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setState((s) => ({ ...s, recordingDuration: s.recordingDuration + 1 }));
      }, 1000);
    } catch (err: unknown) {
      console.error('[useAudioRecorder] microphone access error:', err);
      const msg = err instanceof Error && err.name === 'NotAllowedError'
        ? 'Microphone access was denied. Please allow microphone permissions in your browser.'
        : 'Could not start audio recording. Please check your microphone settings.';
      setState((s) => ({ ...s, errorMessage: msg }));
    }
  }, [state.isSupported, state.audioUrl]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const resetRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (state.audioUrl) {
      URL.revokeObjectURL(state.audioUrl);
    }
    chunksRef.current = [];
    setState((s) => ({
      ...s,
      isRecording: false,
      recordingDuration: 0,
      audioBlob: null,
      audioUrl: null,
      errorMessage: null,
    }));
  }, [state.audioUrl]);

  return {
    ...state,
    startRecording,
    stopRecording,
    resetRecording,
  };
}
