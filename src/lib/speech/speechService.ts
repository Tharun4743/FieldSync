import type { SupportedLanguage } from '@/lib/i18n/translations';

// ============================================================
// FieldSync — Offline Speech Synthesis (Read Aloud)
// Uses browser window.speechSynthesis. Zero network requests.
// ============================================================

const LOCALE_MAP: Record<SupportedLanguage, string[]> = {
  en: ['en-US', 'en-GB', 'en-IN', 'en'],
  ta: ['ta-IN', 'ta-LK', 'ta'],
  hi: ['hi-IN', 'hi'],
  te: ['te-IN', 'te'],
  kn: ['kn-IN', 'kn'],
  ml: ['ml-IN', 'ml'],
};

export interface SpeakResult {
  success: boolean;
  message?: string;
}

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && Boolean(window.speechSynthesis);
}

export function stopSpeaking(): void {
  if (isSpeechSupported()) {
    window.speechSynthesis.cancel();
  }
}

export function readAloud(
  text: string,
  language: SupportedLanguage = 'en',
  onEnd?: () => void,
): Promise<SpeakResult> {
  return new Promise((resolve) => {
    if (!isSpeechSupported()) {
      resolve({
        success: false,
        message: 'Speech synthesis is not supported on this browser.',
      });
      return;
    }

    try {
      window.speechSynthesis.cancel(); // Stop any currently playing audio

      const utterance = new SpeechSynthesisUtterance(text);
      const locales = LOCALE_MAP[language] || ['en-US'];

      // Look for a voice matching the target language locales
      const voices = window.speechSynthesis.getVoices();
      let matchedVoice: SpeechSynthesisVoice | undefined;

      for (const loc of locales) {
        matchedVoice = voices.find(
          (v) => v.lang.toLowerCase() === loc.toLowerCase() || v.lang.toLowerCase().startsWith(loc.toLowerCase()),
        );
        if (matchedVoice) break;
      }

      if (matchedVoice) {
        utterance.voice = matchedVoice;
        utterance.lang = matchedVoice.lang;
      } else if (language !== 'en') {
        // If device has no voice for Tamil/Hindi etc., warn gracefully without crashing
        console.warn(`[Speech] No voice found for locale: ${locales[0]}`);
        resolve({
          success: false,
          message: 'Read Aloud is not available for this language on this device.',
        });
        return;
      } else {
        utterance.lang = 'en-US';
      }

      utterance.rate = 0.95; // Slightly slower for clear industrial field clarity
      utterance.pitch = 1.0;

      utterance.onend = () => {
        onEnd?.();
        resolve({ success: true });
      };

      utterance.onerror = (e) => {
        console.warn('[Speech] Error speaking:', e);
        onEnd?.();
        resolve({
          success: false,
          message: 'Failed to read aloud checklist text.',
        });
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error('[Speech] Unexpected error:', err);
      resolve({
        success: false,
        message: 'Read Aloud encountered an error.',
      });
    }
  });
}
