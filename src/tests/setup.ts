import 'fake-indexeddb/auto';
import '@testing-library/jest-dom';

// Polyfill window.speechSynthesis if missing
if (typeof window !== 'undefined' && !('speechSynthesis' in window)) {
  const mockVoices: SpeechSynthesisVoice[] = [
    { default: true, lang: 'en-US', localService: true, name: 'English US', voiceURI: 'en-US' },
    { default: false, lang: 'ta-IN', localService: true, name: 'Tamil India', voiceURI: 'ta-IN' },
    { default: false, lang: 'hi-IN', localService: true, name: 'Hindi India', voiceURI: 'hi-IN' },
  ];

  class MockUtterance {
    text: string;
    lang: string = 'en-US';
    rate: number = 1;
    pitch: number = 1;
    voice: SpeechSynthesisVoice | null = null;
    onstart: (() => void) | null = null;
    onend: (() => void) | null = null;
    onerror: ((e: unknown) => void) | null = null;

    constructor(text: string) {
      this.text = text;
    }
  }

  // @ts-expect-error Mock window SpeechSynthesis
  window.SpeechSynthesisUtterance = MockUtterance;

  // @ts-expect-error Mock window SpeechSynthesis
  window.speechSynthesis = {
    paused: false,
    pending: false,
    speaking: false,
    onvoiceschanged: null,
    cancel: () => {},
    pause: () => {},
    resume: () => {},
    speak: (utterance: MockUtterance) => {
      if (utterance.onstart) utterance.onstart();
      setTimeout(() => {
        if (utterance.onend) utterance.onend();
      }, 10);
    },
    getVoices: () => mockVoices,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  };
}

// Polyfill MediaRecorder if missing
if (typeof window !== 'undefined' && typeof MediaRecorder === 'undefined') {
  class MockMediaRecorder {
    state: 'inactive' | 'recording' | 'paused' = 'inactive';
    mimeType: string = 'audio/webm';
    ondataavailable: ((e: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;

    static isTypeSupported() {
      return true;
    }

    start() {
      this.state = 'recording';
    }

    stop() {
      this.state = 'inactive';
      if (this.ondataavailable) {
        this.ondataavailable({ data: new Blob(['mock audio'], { type: this.mimeType }) });
      }
      if (this.onstop) this.onstop();
    }
  }

  // @ts-expect-error Mock MediaRecorder
  window.MediaRecorder = MockMediaRecorder;

  if (!navigator.mediaDevices) {
    // @ts-expect-error Mock mediaDevices
    navigator.mediaDevices = {};
  }
  navigator.mediaDevices.getUserMedia = async () => {
    return {
      getTracks: () => [{ stop: () => {} }],
    } as unknown as MediaStream;
  };
}

import { beforeAll } from 'vitest';
import { bootstrapDevice } from '../lib/db/device';
import { LogicalClock } from '../lib/db/logicalClock';

beforeAll(async () => {
  await bootstrapDevice();
  await LogicalClock.initialize();
});

