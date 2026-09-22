import { useState, useMemo } from 'react';
import type { ChecklistItem, InspectionResult, Inspection, Asset } from '@/types/db';
import { useI18n } from '../../lib/i18n/LanguageContext';
import { speakText } from '../../lib/tts/textToSpeech';
import VoiceNoteRecorderModal from './VoiceNoteRecorderModal';
import {
  Volume2,
  Mic,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  AlertCircle,
  Plus,
  Minus,
} from 'lucide-react';

interface Props {
  inspection: Inspection;
  asset?: Asset;
  items: ChecklistItem[];
  results: Record<string, InspectionResult>;
  onUpdateResult: (item: ChecklistItem, value: string) => Promise<void>;
  onCapturePhoto: (file: File) => Promise<void>;
  onExitQuickMode?: () => void;
  initialItemId?: string;
}

export default function QuickInspectionView({
  inspection,
  asset,
  items,
  results,
  onUpdateResult,
  onCapturePhoto,
  onExitQuickMode,
  initialItemId,
}: Props) {
  const { t, language } = useI18n();

  // Find initial item index: either specified initialItemId or the first incomplete item
  const initialIndex = useMemo(() => {
    if (initialItemId) {
      const idx = items.findIndex((i) => i.id === initialItemId);
      if (idx !== -1) return idx;
    }
    const firstIncompleteIdx = items.findIndex((i) => !results[i.id]?.value);
    return firstIncompleteIdx !== -1 ? firstIncompleteIdx : 0;
  }, [items, results, initialItemId]);

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [localValue, setLocalValue] = useState<string>('');
  const [activeVoiceModalItem, setActiveVoiceModalItem] = useState<ChecklistItem | null>(null);
  const [ttsFeedback, setTtsFeedback] = useState<string | null>(null);

  const currentItem: ChecklistItem | undefined = items[currentIndex];
  const currentResult: InspectionResult | undefined = currentItem ? results[currentItem.id] : undefined;

  // Active answer value (either local edit or saved result)
  const activeAnswer = currentResult?.value ?? '';

  // Completed count
  const completedCount = useMemo(() => {
    return items.filter((i) => results[i.id]?.value && results[i.id].value !== '').length;
  }, [items, results]);

  if (!currentItem) {
    return (
      <div className="p-8 text-center bg-white rounded-3xl border border-zinc-200 shadow-sm space-y-4">
        <CheckCircle2 size={48} className="mx-auto text-emerald-600" />
        <h3 className="text-xl font-black text-zinc-900">All Items Complete</h3>
        <p className="text-xs text-zinc-500">Every checklist item has been recorded locally.</p>
        {onExitQuickMode && (
          <button
            onClick={onExitQuickMode}
            className="px-6 py-2.5 rounded-xl bg-zinc-900 hover:bg-black text-white font-bold text-xs"
          >
            Return to Overview
          </button>
        )}
      </div>
    );
  }

  const handleSelectAnswer = async (val: string) => {
    setLocalValue(val);
    await onUpdateResult(currentItem, val);
  };

  const handleSaveAndNext = async () => {
    if (localValue && localValue !== activeAnswer) {
      await onUpdateResult(currentItem, localValue);
    }

    // Advance to next incomplete item or next item
    const nextIncompleteIdx = items.findIndex((item, idx) => idx > currentIndex && !results[item.id]?.value);
    if (nextIncompleteIdx !== -1) {
      setCurrentIndex(nextIncompleteIdx);
    } else if (currentIndex < items.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
    setLocalValue('');
  };

  const handleReadAloud = () => {
    const error = speakText(currentItem.question, language, undefined, () => setTtsFeedback(null));
    if (error) {
      setTtsFeedback(error);
      setTimeout(() => setTtsFeedback(null), 4000);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void onCapturePhoto(file);
      e.target.value = '';
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* High Contrast Header Card */}
      <div className="bg-zinc-900 text-white rounded-3xl p-5 shadow-lg border border-zinc-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {asset && (
              <span className="font-mono font-black text-xs px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                {asset.assetCode}
              </span>
            )}
            <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">{inspection.siteName}</span>
          </div>

          {onExitQuickMode && (
            <button
              onClick={onExitQuickMode}
              className="text-xs font-bold px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
            >
              Exit Quick Mode
            </button>
          )}
        </div>

        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">{asset?.name || inspection.title}</h2>
            <p className="text-xs text-zinc-400 mt-0.5">{inspection.title}</p>
          </div>
          <div className="text-right">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
              {t.progress}
            </span>
            <span className="font-mono text-xl sm:text-2xl font-black text-emerald-400">
              {completedCount} / {items.length}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
          <div
            className="bg-emerald-500 h-full rounded-full transition-all duration-300"
            style={{ width: `${Math.round((completedCount / items.length) * 100)}%` }}
          />
        </div>
      </div>

      {/* Checklist Card — High Contrast, Large Touch Targets */}
      <div className="bg-white border-2 border-zinc-900 rounded-3xl p-6 sm:p-7 shadow-xl space-y-6">
        {/* Step Indicator & Item Number */}
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-zinc-900 text-white font-mono text-xs font-black flex items-center justify-center">
              {currentIndex + 1}
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              of {items.length} checklist items
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Read Aloud Button */}
            <button
              onClick={handleReadAloud}
              className="h-9 px-3 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95 transition-all"
              id="btn-quick-read-aloud"
              title="Read Question Aloud (Offline TTS)"
            >
              <Volume2 size={16} className="text-indigo-600" />
              <span>{t.readAloud}</span>
            </button>

            {/* Voice Note Button */}
            <button
              onClick={() => setActiveVoiceModalItem(currentItem)}
              className="h-9 px-3 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95 transition-all"
              id="btn-quick-voice-note"
            >
              <Mic size={16} className="text-rose-600" />
              <span>Voice</span>
            </button>

            {/* Photo Capture Button */}
            <label
              className="h-9 px-3 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95 transition-all"
              id="btn-quick-photo"
            >
              <Camera size={16} className="text-sky-600" />
              <span>Photo</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileInput}
              />
            </label>
          </div>
        </div>

        {/* TTS Feedback if unavailable */}
        {ttsFeedback && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
            <AlertCircle size={14} className="text-amber-600 shrink-0" />
            <span>{ttsFeedback}</span>
          </div>
        )}

        {/* Question Header */}
        <div>
          <h3 className="text-xl sm:text-2xl font-black text-zinc-900 leading-snug tracking-tight">
            {currentItem.question}
          </h3>
          {currentItem.required && (
            <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full inline-block mt-1.5">
              Required
            </span>
          )}
        </div>

        {/* Input Target Area — Large Buttons */}
        <div className="pt-2">
          {currentItem.type === 'GOOD_DAMAGED' && (
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => handleSelectAnswer('GOOD')}
                className={`h-16 rounded-2xl font-black text-sm tracking-wide border-2 cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-2 ${
                  activeAnswer === 'GOOD'
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-md shadow-emerald-100'
                    : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                }`}
                id="btn-quick-good"
              >
                <CheckCircle2 size={20} />
                {t.good}
              </button>
              <button
                onClick={() => handleSelectAnswer('DAMAGED')}
                className={`h-16 rounded-2xl font-black text-sm tracking-wide border-2 cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-2 ${
                  activeAnswer === 'DAMAGED'
                    ? 'bg-rose-600 text-white border-rose-700 shadow-md shadow-rose-100'
                    : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                }`}
                id="btn-quick-damaged"
              >
                {t.damaged}
              </button>
              <button
                onClick={() => handleSelectAnswer('N/A')}
                className={`h-16 rounded-2xl font-black text-sm tracking-wide border-2 cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-2 ${
                  activeAnswer === 'N/A'
                    ? 'bg-zinc-800 text-white border-zinc-900 shadow-md'
                    : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                }`}
                id="btn-quick-na"
              >
                {t.na}
              </button>
            </div>
          )}

          {currentItem.type === 'PASS_FAIL' && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleSelectAnswer('PASS')}
                className={`h-16 rounded-2xl font-black text-base tracking-wide border-2 cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-2 ${
                  activeAnswer === 'PASS'
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-md shadow-emerald-100'
                    : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                }`}
                id="btn-quick-pass"
              >
                <CheckCircle2 size={22} />
                {t.pass}
              </button>
              <button
                onClick={() => handleSelectAnswer('FAIL')}
                className={`h-16 rounded-2xl font-black text-base tracking-wide border-2 cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-2 ${
                  activeAnswer === 'FAIL'
                    ? 'bg-rose-600 text-white border-rose-700 shadow-md shadow-rose-100'
                    : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                }`}
                id="btn-quick-fail"
              >
                {t.fail}
              </button>
            </div>
          )}

          {currentItem.type === 'BOOLEAN' && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleSelectAnswer('YES')}
                className={`h-16 rounded-2xl font-black text-base tracking-wide border-2 cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-2 ${
                  activeAnswer === 'YES'
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-md'
                    : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                }`}
                id="btn-quick-yes"
              >
                {t.yes}
              </button>
              <button
                onClick={() => handleSelectAnswer('NO')}
                className={`h-16 rounded-2xl font-black text-base tracking-wide border-2 cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-2 ${
                  activeAnswer === 'NO'
                    ? 'bg-rose-600 text-white border-rose-700 shadow-md'
                    : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                }`}
                id="btn-quick-no"
              >
                {t.no}
              </button>
            </div>
          )}

          {currentItem.type === 'NUMERIC' && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    const currentNum = parseFloat(activeAnswer || '0');
                    const nextVal = String(currentNum - 1);
                    void handleSelectAnswer(nextVal);
                  }}
                  className="w-14 h-14 rounded-2xl border-2 border-zinc-200 hover:bg-zinc-100 flex items-center justify-center text-zinc-800 font-bold active:scale-95 cursor-pointer"
                >
                  <Minus size={22} />
                </button>

                <div className="flex-1 relative">
                  <input
                    type="number"
                    step="any"
                    value={localValue || activeAnswer}
                    onChange={(e) => setLocalValue(e.target.value)}
                    onBlur={() => {
                      if (localValue && localValue !== activeAnswer) {
                        void handleSelectAnswer(localValue);
                      }
                    }}
                    placeholder={currentItem.unit ? `0.0 (${currentItem.unit})` : '0.0'}
                    className="w-full h-14 px-4 text-center font-mono font-black text-2xl text-zinc-900 border-2 border-zinc-300 rounded-2xl focus:border-zinc-900 focus:outline-none bg-zinc-50"
                    id={`quick-input-numeric-${currentItem.id}`}
                  />
                  {currentItem.unit && (
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-mono font-bold text-sm text-zinc-500">
                      {currentItem.unit}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => {
                    const currentNum = parseFloat(activeAnswer || '0');
                    const nextVal = String(currentNum + 1);
                    void handleSelectAnswer(nextVal);
                  }}
                  className="w-14 h-14 rounded-2xl border-2 border-zinc-200 hover:bg-zinc-100 flex items-center justify-center text-zinc-800 font-bold active:scale-95 cursor-pointer"
                >
                  <Plus size={22} />
                </button>
              </div>

              {(currentItem.minValue !== undefined || currentItem.maxValue !== undefined) && (
                <p className="text-[11px] font-mono text-zinc-500 text-center">
                  Allowable range: {currentItem.minValue ?? '—'} to {currentItem.maxValue ?? '—'} {currentItem.unit}
                </p>
              )}
            </div>
          )}

          {currentItem.type === 'SELECT' && (
            <div className="grid grid-cols-2 gap-2.5">
              {currentItem.options?.map((opt) => (
                <button
                  key={opt}
                  onClick={() => handleSelectAnswer(opt)}
                  className={`h-14 px-4 rounded-2xl font-bold text-xs border-2 cursor-pointer transition-all active:scale-95 flex items-center justify-center text-center ${
                    activeAnswer === opt
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-md shadow-indigo-100'
                      : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {currentItem.type === 'TEXT' && (
            <div className="space-y-2">
              <textarea
                value={localValue || activeAnswer}
                onChange={(e) => setLocalValue(e.target.value)}
                onBlur={() => {
                  if (localValue && localValue !== activeAnswer) {
                    void handleSelectAnswer(localValue);
                  }
                }}
                rows={3}
                placeholder="Enter field observation note..."
                className="w-full p-4 border-2 border-zinc-200 rounded-2xl text-sm font-medium text-zinc-900 focus:border-zinc-900 focus:outline-none resize-none bg-zinc-50"
              />
            </div>
          )}
        </div>

        {/* Current Item Status */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-100 text-xs text-zinc-500">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                activeAnswer ? 'bg-emerald-500' : 'bg-amber-400'
              }`}
            />
            <span className="font-semibold">
              {activeAnswer ? t.savedOffline : 'Pending input'}
            </span>
          </div>

          {currentResult?.updatedAt && (
            <span className="font-mono text-[11px]">
              {new Date(currentResult.updatedAt).toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* Navigation & SAVE & NEXT */}
        <div className="pt-2 flex items-center gap-3">
          <button
            onClick={() => setCurrentIndex((idx) => Math.max(0, idx - 1))}
            disabled={currentIndex === 0}
            className="h-14 px-4 rounded-2xl border-2 border-zinc-200 text-zinc-700 font-bold text-xs disabled:opacity-30 hover:bg-zinc-50 transition-colors flex items-center justify-center gap-1 cursor-pointer shrink-0"
            id="btn-quick-prev"
          >
            <ChevronLeft size={18} />
            <span className="hidden sm:inline">{t.previous}</span>
          </button>

          <button
            onClick={handleSaveAndNext}
            className="flex-1 h-14 rounded-2xl bg-zinc-900 hover:bg-black active:scale-98 text-white font-black text-sm tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-zinc-300 transition-all border-2 border-zinc-900"
            id="btn-quick-save-next"
          >
            <span>{t.saveAndNext}</span>
            <ArrowRight size={18} />
          </button>

          <button
            onClick={() => setCurrentIndex((idx) => Math.min(items.length - 1, idx + 1))}
            disabled={currentIndex === items.length - 1}
            className="h-14 px-4 rounded-2xl border-2 border-zinc-200 text-zinc-700 font-bold text-xs disabled:opacity-30 hover:bg-zinc-50 transition-colors flex items-center justify-center gap-1 cursor-pointer shrink-0"
            id="btn-quick-next"
          >
            <span className="hidden sm:inline">{t.next}</span>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Voice Note Recorder Modal */}
      {activeVoiceModalItem && (
        <VoiceNoteRecorderModal
          inspectionId={inspection.id}
          checklistItemId={activeVoiceModalItem.id}
          checklistQuestion={activeVoiceModalItem.question}
          onClose={() => setActiveVoiceModalItem(null)}
        />
      )}
    </div>
  );
}
