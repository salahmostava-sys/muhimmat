import { useRef } from 'react';
import { Download, FileSpreadsheet, Upload, Printer, Loader2, FolderOpen } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { cn } from '@shared/lib/utils';
import { useToast } from '@shared/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@shared/components/ui/dropdown-menu';

/** 5MB import limit */
export const DATA_TABLE_IMPORT_MAX_BYTES = 5 * 1024 * 1024;

export type DataTableActionsProps = Readonly<{
  onExport: () => void | Promise<void>;
  onDownloadTemplate: () => void | Promise<void>;
  onPrint: () => void | Promise<void>;
  onImportFile: (file: File) => void | Promise<void>;
  /** Disables actions and shows spinner on primary/import affordance */
  loading?: boolean;
  disabled?: boolean;
  hideImport?: boolean;
  className?: string;
  /** Arabic labels (default) */
  labels?: Partial<{
    export: string;
    template: string;
    import: string;
    print: string;
  }>;
}>;

/** Unified compact actions menu for file operations. */
export function DataTableActions({
  onExport,
  onDownloadTemplate,
  onPrint,
  onImportFile,
  loading = false,
  disabled = false,
  hideImport = false,
  className,
  labels = {},
}: DataTableActionsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const busy = loading || disabled;

  const L = {
    export: labels.export ?? 'تصدير Excel',
    template: labels.template ?? 'تحميل قالب الاستيراد',
    import: labels.import ?? 'استيراد Excel',
    print: labels.print ?? 'طباعة الجدول',
  };

  const run = async (fn: () => void | Promise<void>) => {
    try {
      await fn();
    } catch (e: unknown) {
      console.error('[DataTableActions]', e);
    }
  };

  const handleImportPick = () => {
    if (busy || hideImport) return;
    inputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > DATA_TABLE_IMPORT_MAX_BYTES) {
      toast({
        title: 'خطأ',
        description: 'Error: file exceeds 5MB limit',
        variant: 'destructive',
      });
      return;
    }
    const lower = file.name.toLowerCase();
    const ok = lower.endsWith('.xlsx') || lower.endsWith('.xls');
    if (!ok) {
      toast({
        title: 'خطأ',
        description: 'Error: Invalid file format',
        variant: 'destructive',
      });
      return;
    }
    void run(() => onImportFile(file));
  };

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-center gap-2 sm:gap-3 w-full',
        className
      )}
      role="toolbar"
      aria-label="إجراءات البيانات"
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        className="hidden"
        onChange={handleFileChange}
      />

      {loading && (
        <span className="flex items-center gap-2 text-sm text-primary font-medium px-1" aria-live="polite">
          <Loader2 className="animate-spin size-4 shrink-0" aria-hidden />
          جارٍ المعالجة...
        </span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            className="gap-1.5 min-w-[9.5rem] border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
          >
            <FolderOpen className="size-4" aria-hidden />
            ملفات
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => void run(onExport)}>
            <Download className="size-4 ml-2" aria-hidden />
            {L.export}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void run(onDownloadTemplate)}>
            <FileSpreadsheet className="size-4 ml-2" aria-hidden />
            {L.template}
          </DropdownMenuItem>
          {!hideImport && (
            <DropdownMenuItem onClick={handleImportPick}>
              <Upload className="size-4 ml-2" aria-hidden />
              {L.import}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => void run(onPrint)}>
            <Printer className="size-4 ml-2" aria-hidden />
            {L.print}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
