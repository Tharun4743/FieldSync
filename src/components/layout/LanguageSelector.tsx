import { Globe } from 'lucide-react';
import { useLanguageStore } from '@/stores/languageStore';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/lib/i18n/translations';

export default function LanguageSelector() {
  const { language, setLanguage } = useLanguageStore();

  return (
    <div className="relative inline-flex items-center">
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white border border-zinc-200 text-zinc-700 hover:border-indigo-300 transition-colors shadow-xs">
        <Globe size={14} className="text-zinc-400 shrink-0" />
        <select
          value={language}
          onChange={(e) => void setLanguage(e.target.value as SupportedLanguage)}
          className="bg-transparent text-xs font-bold text-zinc-800 outline-none cursor-pointer pr-1"
          aria-label="Select language"
          id="select-app-language"
        >
          {SUPPORTED_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code} className="text-zinc-900 bg-white font-medium py-1">
              {l.nativeName} ({l.name})
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
