import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@shared/components/ui/dialog';
import { Button } from '@shared/components/ui/button';
import { Checkbox } from '@shared/components/ui/checkbox';
import { Input } from '@shared/components/ui/input';
import { Label } from '@shared/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@shared/components/ui/radio-group';
import { cn } from '@shared/lib/utils';
import type { FilterConfig, FilterState } from '@shared/hooks/useAdvancedFilter';

function snapshotDraft(filters: FilterState, configs: FilterConfig[]): FilterState {
  const out: FilterState = {};
  configs.forEach((c) => {
    const v = filters[c.key];
    out[c.key] = v == null ? [...(c.defaultValues ?? [])] : [...v];
  });
  return out;
}

export function AdvancedFilterModal(props: Readonly<{
  configs: FilterConfig[];
  filters: FilterState;
  onFilterChange: (key: string, values: string[]) => void;
  onReset: () => void;
  onApply: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>) {
  const { configs, filters, onFilterChange, onReset, onApply, open, onOpenChange } = props;
  const [draft, setDraft] = useState<FilterState>(() => snapshotDraft(filters, configs));
  const prevOpen = useRef(false);

  useEffect(() => {
    if (open && !prevOpen.current) {
      setDraft(snapshotDraft(filters, configs));
    }
    prevOpen.current = open;
  }, [open, filters, configs]);

  const handleClearAll = () => {
    const cleared: FilterState = {};
    configs.forEach((c) => {
      cleared[c.key] = [...(c.defaultValues ?? [])];
    });
    setDraft(cleared);
    onReset();
  };

  const handleApply = () => {
    configs.forEach((c) => {
      const values = draft[c.key] ?? (c.defaultValues ?? []);
      onFilterChange(c.key, [...values]);
    });
    onApply();
    onOpenChange(false);
  };

  const setDraftKey = (key: string, values: string[]) => {
    setDraft((prev) => ({ ...prev, [key]: [...values] }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto gap-0 p-0 [&>button.absolute]:hidden"
        dir="rtl"
      >
        <DialogHeader className="px-5 py-4 border-b border-border flex flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <span className="inline-flex items-center gap-2">
              <span aria-hidden>🔍</span>
              <span>فلتر متقدم</span>
            </span>
          </DialogTitle>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" />
          </button>
        </DialogHeader>

        <div className="px-5 py-4 space-y-6">
          {configs.map((c) => {
            const values = draft[c.key] ?? (c.defaultValues ?? []);

            if (c.type === 'multi_select') {
              const opts = c.options ?? [];
              const optionValues = opts.map((o) => o.value);
              const selected = values;
              const allSelected =
                optionValues.length > 0 && optionValues.every((v) => selected.includes(v));
              const someSelected =
                optionValues.length > 0 &&
                selected.some((v) => optionValues.includes(v)) &&
                !allSelected;

              const toggleAll = () => {
                if (allSelected) {
                  setDraftKey(c.key, []);
                } else {
                  setDraftKey(c.key, [...optionValues]);
                }
              };

              const toggleOne = (val: string) => {
                const next = new Set(selected);
                if (next.has(val)) next.delete(val);
                else next.add(val);
                setDraftKey(c.key, [...next]);
              };

              return (
                <section key={c.key} className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">{c.label}</p>
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                        onCheckedChange={() => toggleAll()}
                      />
                      <span className="text-sm font-medium">الكل</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {opts.map((opt) => (
                        <label
                          key={opt.value}
                          className="flex items-center gap-2 cursor-pointer rounded-lg px-2 py-1.5 hover:bg-muted/50"
                        >
                          <Checkbox
                            checked={selected.includes(opt.value)}
                            onCheckedChange={() => toggleOne(opt.value)}
                          />
                          <span className="text-sm">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </section>
              );
            }

            if (c.type === 'single_select') {
              const opts = c.options ?? [];
              const current = values[0] ?? '';
              return (
                <section key={c.key} className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">{c.label}</p>
                  <RadioGroup
                    value={current}
                    onValueChange={(v) => setDraftKey(c.key, v ? [v] : [])}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                  >
                    {opts.map((opt) => (
                      <label
                        key={opt.value}
                        className={cn(
                          'flex items-center gap-2 cursor-pointer rounded-lg border border-border/60 px-3 py-2 hover:bg-muted/40',
                          current === opt.value && 'border-primary bg-primary/5'
                        )}
                      >
                        <RadioGroupItem value={opt.value} id={`${c.key}-${opt.value}`} />
                        <span className="text-sm">{opt.label}</span>
                      </label>
                    ))}
                  </RadioGroup>
                </section>
              );
            }

            if (c.type === 'date_range') {
              const from = values[0] ?? '';
              const to = values[1] ?? '';
              return (
                <section key={c.key} className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">{c.label}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">من</Label>
                      <Input
                        type="date"
                        value={from}
                        onChange={(e) => setDraftKey(c.key, [e.target.value, to])}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">إلى</Label>
                      <Input
                        type="date"
                        value={to}
                        onChange={(e) => setDraftKey(c.key, [from, e.target.value])}
                        className="h-9"
                      />
                    </div>
                  </div>
                </section>
              );
            }

            if (c.type === 'number_range') {
              const min = values[0] ?? '';
              const max = values[1] ?? '';
              return (
                <section key={c.key} className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">{c.label}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">من</Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={min}
                        onChange={(e) => setDraftKey(c.key, [e.target.value, max])}
                        className="h-9"
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">إلى</Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={max}
                        onChange={(e) => setDraftKey(c.key, [min, e.target.value])}
                        className="h-9"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </section>
              );
            }

            return null;
          })}
        </div>

        <DialogFooter className="px-5 py-4 border-t border-border flex-row-reverse sm:justify-between gap-2">
          <div className="flex gap-2 flex-1 justify-end">
            <Button type="button" variant="outline" onClick={handleClearAll}>
              مسح الكل
            </Button>
            <Button type="button" onClick={handleApply}>
              <span className="inline-flex items-center gap-1.5">
                <span>تطبيق الفلتر</span>
                <span aria-hidden>✓</span>
              </span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
