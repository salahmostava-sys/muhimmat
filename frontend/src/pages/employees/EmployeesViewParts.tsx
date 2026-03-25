import { useState } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown, Check, Loader2, Pencil, X, ChevronDown as FilterIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { useSignedUrl, extractStoragePath } from '@/hooks/useSignedUrl';

export const CityBadge = ({ city }: { city?: string | null }) => {
  if (!city) return <span className="text-muted-foreground/40">—</span>;
  return city === 'makkah' ? (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-muted text-muted-foreground">مكة</span>
  ) : (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-muted text-muted-foreground">جدة</span>
  );
};

export const LicenseBadge = ({ status }: { status?: string | null }) => {
  if (!status) return <span className="text-muted-foreground/40">—</span>;
  const map: Record<string, { label: string; cls: string }> = {
    has_license: { label: 'لديه رخصة', cls: 'badge-success' },
    no_license: { label: 'ليس لديه رخصة', cls: 'badge-urgent' },
    applied: { label: 'تم التقديم', cls: 'badge-warning' },
  };
  const m = map[status];
  return m ? <span className={m.cls}>{m.label}</span> : null;
};

export const SponsorBadge = ({ status }: { status?: string | null }) => {
  if (!status) return <span className="text-muted-foreground/40">—</span>;
  const map: Record<string, { label: string; cls: string }> = {
    sponsored: { label: 'على الكفالة', cls: 'badge-info' },
    not_sponsored: {
      label: 'ليس على الكفالة',
      cls: 'bg-muted text-muted-foreground text-xs font-medium px-2.5 py-0.5 rounded-full',
    },
    absconded: { label: 'هروب', cls: 'badge-urgent' },
    terminated: {
      label: 'انتهاء الخدمة',
      cls: 'bg-muted text-muted-foreground text-xs font-medium px-2.5 py-0.5 rounded-full',
    },
  };
  const m = map[status];
  return m ? <span className={m.cls}>{m.label}</span> : null;
};

export const StatusBadge = ({ status }: { status?: string | null }) => {
  if (!status) return <span className="text-muted-foreground/40">—</span>;
  if (status === 'active') return <span className="badge-success">نشط</span>;
  if (status === 'inactive') return <span className="badge-warning">غير نشط</span>;
  if (status === 'ended')
    return <span className="bg-muted text-muted-foreground text-xs font-medium px-2.5 py-0.5 rounded-full">منتهي</span>;
  return <span className="text-muted-foreground/40">{status}</span>;
};

export interface InlineSelectProps {
  value: string;
  options: { value: string; label: string }[];
  onSave: (v: string) => Promise<void>;
  renderDisplay: () => React.ReactNode;
}

export const InlineSelect = ({ value, options, onSave, renderDisplay }: InlineSelectProps) => {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleChange = async (v: string) => {
    setSaving(true);
    await onSave(v);
    setSaving(false);
    setSaved(true);
    setEditing(false);
    setTimeout(() => setSaved(false), 1500);
  };

  if (saved) return <span className="text-success text-xs flex items-center gap-1"><Check size={12} /> تم</span>;
  if (saving) return <span className="text-muted-foreground text-xs flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> ...</span>;

  if (editing) {
    return (
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <Select value={value} onValueChange={handleChange} open onOpenChange={(o) => !o && setEditing(false)}>
          <SelectTrigger className="h-7 text-xs w-36 bg-card border-primary/50 shadow-md">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-1 cursor-pointer" onClick={() => setEditing(true)} title="اضغط للتعديل">
      {renderDisplay()}
      <Pencil size={10} className="text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-opacity flex-shrink-0" />
    </div>
  );
};

export const EmployeeAvatar = ({ path, name }: { path?: string | null; name: string }) => {
  const storagePath = extractStoragePath(path);
  const signedUrl = useSignedUrl('employee-documents', storagePath);
  if (!path) return null;
  if (!signedUrl) {
    return (
      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 text-xs font-semibold text-muted-foreground select-none">
        {name.charAt(0)}
      </div>
    );
  }
  return <img src={signedUrl} className="w-8 h-8 rounded-full object-cover flex-shrink-0" alt="" />;
};

export const SortIcon = ({
  field,
  sortField,
  sortDir,
}: {
  field: string;
  sortField: string | null;
  sortDir: 'asc' | 'desc' | null;
}) => {
  if (sortField !== field) return <ChevronsUpDown size={11} className="text-muted-foreground/40 inline ms-1" />;
  if (sortDir === 'asc') return <ChevronUp size={11} className="text-primary inline ms-1" />;
  return <ChevronDown size={11} className="text-primary inline ms-1" />;
};

export interface ColFilterPopoverProps {
  colKey: string;
  label: string;
  active: boolean;
  children: React.ReactNode;
  onClear: () => void;
}

export const ColFilterPopover = ({ label, active, children, onClear }: ColFilterPopoverProps) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`inline-flex items-center gap-0.5 rounded transition-colors hover:text-primary ${active ? 'text-primary' : 'text-muted-foreground/40 hover:text-muted-foreground'}`}
          title={`فلترة ${label}`}
          onClick={(e) => e.stopPropagation()}
        >
          <FilterIcon size={10} className={active ? 'text-primary' : ''} />
          {active && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-3 space-y-2" align="start" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-foreground">{label}</span>
          {active && (
            <button
              onClick={() => {
                onClear();
                setOpen(false);
              }}
              className="text-xs text-destructive hover:underline flex items-center gap-1"
            >
              <X size={10} /> مسح
            </button>
          )}
        </div>
        {children}
      </PopoverContent>
    </Popover>
  );
};

export const SkeletonRow = ({ cols }: { cols: number }) => (
  <tr className="border-b border-border/30">
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="px-3 py-3">
        <Skeleton className="h-4 w-full" />
      </td>
    ))}
  </tr>
);

export const TextFilterInput = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) => (
  <Input
    className="h-7 text-xs px-2"
    placeholder="ابحث..."
    value={value}
    onChange={(e) => onChange(e.target.value)}
    onClick={(e) => e.stopPropagation()}
    autoFocus
  />
);

