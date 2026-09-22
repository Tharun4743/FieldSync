// ============================================================
// Offline Text-to-Speech Service
// Uses window.speechSynthesis natively on device — zero network
// ============================================================

export interface TTSState {
  isSupported: boolean;
  speaking: boolean;
}

const LANGUAGE_LOCALE_MAP: Record<string, string[]> = {
  en: ['en-US', 'en-GB', 'en-IN', 'en'],
  ta: ['ta-IN', 'ta-LK', 'ta'],
  hi: ['hi-IN', 'hi'],
  te: ['te-IN', 'te'],
  kn: ['kn-IN', 'kn'],
  ml: ['ml-IN', 'ml'],
};

export function isTTSSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

export function stopSpeaking(): void {
  if (isTTSSupported()) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore
    }
  }
}

/**
 * Speaks text using a local device voice matching the current language.
 * Returns null on success or a user-friendly error message if unavailable.
 */
export function speakText(
  text: string,
  lang: string = 'en',
  onStart?: () => void,
  onEnd?: () => void
): string | null {
  if (!isTTSSupported()) {
    return 'Read Aloud is not supported on this browser or device.';
  }

  try {
    stopSpeaking();

    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const candidateLocales = LANGUAGE_LOCALE_MAP[lang] || ['en-US'];

    // Try finding a matching voice
    let matchingVoice: SpeechSynthesisVoice | undefined;
    for (const locale of candidateLocales) {
      matchingVoice = voices.find(
        (v) => v.lang.toLowerCase() === locale.toLowerCase() || v.lang.toLowerCase().startsWith(locale.toLowerCase())
      );
      if (matchingVoice) break;
    }

    if (matchingVoice) {
      utterance.voice = matchingVoice;
      utterance.lang = matchingVoice.lang;
    } else {
      // Default to the first locale code
      utterance.lang = candidateLocales[0] || 'en-US';
      // If language is not English and no voice is found for that language, notify user gracefully
      if (lang !== 'en' && !voices.some(v => v.lang.toLowerCase().startsWith(lang))) {
        return 'Read Aloud is not available for this language on this device.';
      }
    }

    utterance.rate = 0.95; // comfortable rate for field conditions
    utterance.pitch = 1.0;

    if (onStart) utterance.onstart = () => onStart();
    if (onEnd) {
      utterance.onend = () => onEnd();
      utterance.onerror = () => onEnd();
    }

    window.speechSynthesis.speak(utterance);
    return null;
  } catch (err) {
    console.warn('[TextToSpeech] speak error:', err);
    return 'Read Aloud encountered an error.';
  }
}
