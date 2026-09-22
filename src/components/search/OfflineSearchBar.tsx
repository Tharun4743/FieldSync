import { useState, useEffect, useRef } from 'react';
import { Search, X, ClipboardCheck, Wrench, ListChecks, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { searchLocalDatabase, type SearchResultItem } from '@/lib/search/offlineSearch';
import { useLanguageStore } from '@/stores/languageStore';

export default function OfflineSearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const t = useLanguageStore((s) => s.t);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    let active = true;
    void searchLocalDatabase(query).then((res) => {
      if (active) {
        setResults(res);
        setIsOpen(true);
      }
    });

    return () => {
      active = false;
    };
  }, [query]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(item: SearchResultItem) {
    setIsOpen(false);
    setQuery('');
    if (item.inspectionId) {
      navigate(`/inspections/${item.inspectionId}`);
    } else {
      navigate('/inspections');
    }
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative flex items-center">
        <Search size={15} className="absolute left-3.5 text-zinc-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('action.search')}
          className="w-full h-10 pl-9 pr-9 bg-white border border-zinc-200/90 rounded-xl text-xs font-semibold text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all shadow-xs"
          id="offline-search-input"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
              setIsOpen(false);
            }}
            className="absolute right-3 text-zinc-400 hover:text-zinc-600 cursor-pointer p-0.5"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute top-12 left-0 right-0 z-50 bg-white border border-zinc-200 rounded-2xl shadow-xl overflow-hidden max-h-80 overflow-y-auto">
          <div className="p-2.5 bg-slate-50 border-b border-zinc-100 flex items-center justify-between text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
            <span>Offline Local Results</span>
            <span className="text-indigo-600 font-mono">{results.length} found</span>
          </div>

          {results.length === 0 ? (
            <div className="p-6 text-center text-xs text-zinc-400 font-medium">
              No matching inspections or assets stored locally.
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {results.map((item) => (
                <button
                  key={`${item.type}-${item.id}`}
                  onClick={() => handleSelect(item)}
                  className="w-full text-left p-3 hover:bg-slate-50 flex items-center justify-between gap-3 group transition-colors cursor-pointer"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="mt-0.5 text-zinc-400 group-hover:text-indigo-600 transition-colors">
                      {item.type === 'INSPECTION' && <ClipboardCheck size={16} />}
                      {item.type === 'ASSET' && <Wrench size={16} />}
                      {item.type === 'CHECKLIST' && <ListChecks size={16} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-zinc-800 truncate group-hover:text-indigo-600 transition-colors">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-zinc-400 truncate">{item.subtitle}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.badge && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200">
                        {item.badge}
                      </span>
                    )}
                    <ArrowRight size={13} className="text-zinc-300 group-hover:text-indigo-600 transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
