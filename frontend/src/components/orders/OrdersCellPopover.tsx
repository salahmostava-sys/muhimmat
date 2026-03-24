import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getAppColor, type AppColorData } from '@/hooks/useAppColors';

type App = { id: string; name: string };
type DailyData = Record<string, number>;

export type OrdersPopoverState = { empId: string; day: number; x: number; y: number };

type Props = {
  state: OrdersPopoverState;
  apps: App[];
  data: DailyData;
  appColorsList: AppColorData[];
  canEdit: boolean;
  onApply: (empId: string, day: number, vals: Record<string, number>) => void;
  onClose: () => void;
};

export const OrdersCellPopover = ({ state, apps, data, appColorsList, canEdit, onApply, onClose }: Props) => {
  const initVals = () => {
    const v: Record<string, string> = {};
    apps.forEach((app) => {
      const k = `${state.empId}::${app.id}::${state.day}`;
      const cur = data[k];
      if (cur) v[app.id] = String(cur);
    });
    return v;
  };

  const [vals, setVals] = useState<Record<string, string>>(initVals);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: state.y + 6, left: state.x });

  useLayoutEffect(() => {
    if (!popRef.current) return;
    const rect = popRef.current.getBoundingClientRect();
    let left = state.x;
    let top = state.y + 6;
    if (left + rect.width > window.innerWidth - 8) left = window.innerWidth - rect.width - 8;
    if (top + rect.height > window.innerHeight - 8) top = state.y - rect.height - 6;
    setPos({ top, left });
  }, [state.x, state.y]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) onClose();
    };
    setTimeout(() => document.addEventListener('mousedown', handler), 10);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handleApply = () => {
    const result: Record<string, number> = {};
    Object.entries(vals).forEach(([appId, v]) => {
      result[appId] = parseInt(v, 10) || 0;
    });
    onApply(state.empId, state.day, result);
    onClose();
  };

  return (
    <div
      ref={popRef}
      className="fixed z-50 bg-popover border border-border rounded-xl shadow-xl p-3 min-w-[200px]"
      style={{ top: pos.top, left: pos.left }}
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs font-semibold text-foreground">يوم {state.day}</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-0.5 rounded">
          <X size={13} />
        </button>
      </div>
      <div className="space-y-1.5">
        {apps.map((app) => {
          const c = getAppColor(appColorsList, app.name);
          return (
            <div key={app.id} className="flex items-center gap-2">
              <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 min-w-[70px] text-center"
                style={{ backgroundColor: c.bg, color: c.text }}>
                {app.name}
              </span>
              <input
                type="number" min={0} placeholder="0"
                value={vals[app.id] ?? ''}
                onChange={e => setVals(prev => ({ ...prev, [app.id]: e.target.value }))}
                disabled={!canEdit}
                className="w-16 h-7 text-center text-xs rounded border border-border bg-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                onKeyDown={e => { if (e.key === 'Enter') handleApply(); if (e.key === 'Escape') onClose(); }}
              />
            </div>
          );
        })}
      </div>
      {canEdit && (
        <Button size="sm" className="w-full mt-3 h-7 text-xs gap-1" onClick={handleApply}>
          <Check size={12} /> تطبيق
        </Button>
      )}
    </div>
  );
};
