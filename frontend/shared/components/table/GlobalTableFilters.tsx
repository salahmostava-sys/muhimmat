import { useMemo } from 'react';
import { Input } from '@shared/components/ui/input';
import { Button } from '@shared/components/ui/button';
import { Label } from '@shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { Checkbox } from '@shared/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@shared/components/ui/popover';
import { ChevronDown, X } from 'lucide-react';
import { cn } from '@shared/lib/utils';

export type BranchKey = 'all' | 'makkah' | 'jeddah';

export type GlobalTableFilterState = {
  search: string;
  branch: BranchKey;
  driverId: string | 'all';
  /** فارغ = كل المنصات؛ غير فارغ = تضمين هذه المنصات فقط (متعدد الاختيار). */
  platformAppIds: string[];
  dateFrom: string; // yyyy-MM-dd or ''
  dateTo: string; // yyyy-MM-dd or ''
};

export type GlobalTableFilterOptions = {
  drivers?: { id: string; name: string }[];
  platforms?: { id: string; name: string }[];
  enableBranch?: boolean;
  enableDriver?: boolean;
  enablePlatform?: boolean;
  enableDateRange?: boolean;
};

export function createDefaultGlobalFilters(): GlobalTableFilterState {
  return {
    search: '',
    branch: 'all',
    driverId: 'all',
    platformAppIds: [],
    dateFrom: '',
    dateTo: '',
  };
}

export function hasActiveGlobalFilters(s: GlobalTableFilterState): boolean {
  return Boolean(
    s.search.trim() ||
      s.branch !== 'all' ||
      s.driverId !== 'all' ||
      s.platformAppIds.length > 0 ||
      s.dateFrom ||
      s.dateTo
  );
}

export function GlobalTableFilters({
  value,
  onChange,
  onReset,
  options,
}: {
  value: GlobalTableFilterState;
  onChange: (next: GlobalTableFilterState) => void;
  onReset: () => void;
  options: GlobalTableFilterOptions;
}) {
  const drivers = useMemo(() => options.drivers ?? [], [options.drivers]);
  const platforms = useMemo(() => options.platforms ?? [], [options.platforms]);
  const showReset = useMemo(() => hasActiveGlobalFilters(value), [value]);

  const platformIds = useMemo(() => platforms.map((p) => p.id), [platforms]);
  const selectedSet = useMemo(() => new Set(value.platformAppIds), [value.platformAppIds]);
  const allPlatformsSelected =
    platformIds.length > 0 && platformIds.every((id) => selectedSet.has(id));
  const somePlatformsSelected =
    platformIds.length > 0 && value.platformAppIds.length > 0 && !allPlatformsSelected;

  const platformTriggerLabel = useMemo(() => {
    if (platforms.length === 0) return 'لا توجد منصات';
    if (value.platformAppIds.length === 0) return 'كل المنصات';
    if (value.platformAppIds.length === 1) {
      const name = platforms.find((p) => p.id === value.platformAppIds[0])?.name;
      return name ?? 'منصة واحدة';
    }
    return `${value.platformAppIds.length} منصات`;
  }, [platforms, value.platformAppIds]);

  const toggleAllPlatforms = () => {
    if (allPlatformsSelected) {
      onChange({ ...value, platformAppIds: [] });
    } else {
      onChange({ ...value, platformAppIds: [...platformIds] });
    }
  };

  const toggleOnePlatform = (id: string) => {
    const next = new Set(value.platformAppIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange({ ...value, platformAppIds: [...next] });
  };

  return (
    <div className="bg-card rounded-2xl shadow-card p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">الفلاتر</span>
          {showReset && (
            <Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={onReset}>
              <X size={14} /> مسح الكل
            </Button>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-4">
          <Label className="text-xs">بحث</Label>
          <Input
            value={value.search}
            onChange={(e) => onChange({ ...value, search: e.target.value })}
            placeholder="بحث بالاسم / رقم الطلب / رقم الجوال..."
            className="h-9"
          />
        </div>

        {options.enableBranch !== false && (
          <div className="lg:col-span-2">
            <Label className="text-xs">الفرع</Label>
            <Select value={value.branch} onValueChange={(v) => onChange({ ...value, branch: v as BranchKey })}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="الكل" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="makkah">مكة</SelectItem>
                <SelectItem value="jeddah">جدة</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {options.enableDriver !== false && (
          <div className="lg:col-span-3">
            <Label className="text-xs">المندوب</Label>
            <Select value={value.driverId} onValueChange={(v) => onChange({ ...value, driverId: v as GlobalTableFilterState['driverId'] })}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="الكل" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                {drivers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {options.enablePlatform !== false && (
          <div className="lg:col-span-3">
            <Label className="text-xs">المنصة</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn('h-9 w-full justify-between font-normal', 'px-3')}
                  disabled={platforms.length === 0}
                >
                  <span className="truncate">{platformTriggerLabel}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-3" align="start" dir="rtl">
                <div className="space-y-2 max-h-[min(60vh,320px)] overflow-y-auto">
                  <label className="flex items-center gap-2 cursor-pointer rounded-md px-1 py-1 hover:bg-muted/50">
                    <Checkbox
                      checked={allPlatformsSelected ? true : somePlatformsSelected ? 'indeterminate' : false}
                      onCheckedChange={() => toggleAllPlatforms()}
                    />
                    <span className="text-sm font-medium">الكل</span>
                  </label>
                  <div className="border-t border-border pt-2 space-y-1">
                    {platforms.map((p) => (
                      <label
                        key={p.id}
                        className="flex items-center gap-2 cursor-pointer rounded-md px-1 py-1.5 hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={selectedSet.has(p.id)}
                          onCheckedChange={() => toggleOnePlatform(p.id)}
                        />
                        <span className="text-sm">{p.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}

        {options.enableDateRange !== false && (
          <>
            <div className="lg:col-span-2">
              <Label className="text-xs">من</Label>
              <Input
                type="date"
                value={value.dateFrom}
                onChange={(e) => onChange({ ...value, dateFrom: e.target.value })}
                className="h-9"
              />
            </div>
            <div className="lg:col-span-2">
              <Label className="text-xs">إلى</Label>
              <Input
                type="date"
                value={value.dateTo}
                onChange={(e) => onChange({ ...value, dateTo: e.target.value })}
                className="h-9"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
