import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Users, Car, CreditCard, Loader2 } from 'lucide-react';
import { useLanguage } from '@app/providers/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { searchService } from '@services/searchService';
import { logError } from '@shared/lib/logger';
import { cn } from '@shared/lib/utils';

interface SearchResult {
  id: string;
  label: string;
  sub?: string;
  type: 'employee' | 'vehicle' | 'advance';
  href: string;
}

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { isRTL } = useLanguage();
  const navigate = useNavigate();

  const search = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const { employees, vehicles } = await searchService.searchEmployeesAndVehicles(q);
      const out: SearchResult[] = [];

      employees.forEach(e => {
        out.push({
          id: e.id,
          label: e.name,
          sub: e.phone || undefined,
          type: 'employee',
          href: '/employees',
        });
      });

      vehicles.forEach(v => {
        out.push({
          id: v.id,
          label: v.plate_number,
          sub: [v.brand, v.model].filter(Boolean).join(' ') || undefined,
          type: 'vehicle',
          href: '/motorcycles',
        });
      });

      setResults(out);
    } catch (err) {
      logError('[GlobalSearch] search failed', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  // Close outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Keyboard shortcut
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  const typeIcon = (type: SearchResult['type']) => {
    if (type === 'employee') return <Users size={13} className="text-primary" />;
    if (type === 'vehicle') return <Car size={13} className="text-info" />;
    return <CreditCard size={13} className="text-warning" />;
  };

  const handleSelect = (r: SearchResult) => {
    setOpen(false);
    setQuery('');
    navigate(r.href);
  };

  return (
    <div className="relative" ref={containerRef}>
      <div className={cn(
        'flex items-center gap-2 h-9 px-3 rounded-full border border-border/70 bg-card/90 text-sm transition-all shadow-sm',
        'focus-within:ring-2 focus-within:ring-ring/30 focus-within:border-primary/50',
        open ? 'w-full sm:w-56' : 'w-full sm:w-40 md:w-52'
      )}>
        <Search size={15} className="text-muted-foreground flex-shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={isRTL ? 'بحث... (Ctrl+K)' : 'Search... (Ctrl+K)'}
          className="flex-1 min-w-0 bg-transparent outline-none text-foreground placeholder:text-muted-foreground text-sm"
          dir={isRTL ? 'rtl' : 'ltr'}
        />
        {query && (
          <button onClick={() => { setQuery(''); setResults([]); }} className="text-muted-foreground hover:text-foreground flex-shrink-0">
            <X size={12} />
          </button>
        )}
        {loading && <Loader2 size={12} className="animate-spin text-muted-foreground flex-shrink-0" />}
      </div>

      {open && (query.length >= 2) && (
        <div className={cn(
          'absolute top-10 z-50 w-72 rounded-xl border border-border bg-card shadow-xl overflow-hidden',
          isRTL ? 'left-0' : 'right-0'
        )}>
          {results.length === 0 && !loading && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {isRTL ? 'لا توجد نتائج' : 'No results found'}
            </div>
          )}
          {results.length > 0 && (
            <ul className="py-1">
              {results.map(r => (
                <li key={r.id}>
                  <button
                    onClick={() => handleSelect(r)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent transition-colors text-start"
                  >
                    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      {typeIcon(r.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{r.label}</p>
                      {r.sub && <p className="text-xs text-muted-foreground truncate">{r.sub}</p>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
