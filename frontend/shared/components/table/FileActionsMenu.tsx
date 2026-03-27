import { useRef } from 'react';
import { Loader2, FolderOpen } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { cn } from '@shared/lib/utils';
import { useToast } from '@shared/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@shared/components/ui/dropdown-menu';

type FileActionLabels = Readonly<{
  export: string;
  template: string;
  import: string;
  print: string;
}>;

type FileActionsMenuProps = Readonly<{
  onExport: () => void | Promise<void>;
  onDownloadTemplate: () => void | Promise<void>;
  onPrint: () => void | Promise<void>;
  onImportFile: (file: File) => void | Promise<void>;
  importMaxBytes: number;
  loading?: boolean;
  disabled?: boolean;
  hideImport?: boolean;
  className?: string;
  ariaLabel: string;
  labels: FileActionLabels;
  invalidSizeMessage: string;
  invalidFormatMessage: string;
  logPrefix: string;
}>;

export function FileActionsMenu({
  onExport,
  onDownloadTemplate,
  onPrint,
  onImportFile,
  importMaxBytes,
  loading = false,
  disabled = false,
  hideImport = false,
  className,
  ariaLabel,
  labels,
  invalidSizeMessage,
  invalidFormatMessage,
  logPrefix,
}: FileActionsMenuProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const busy = loading || disabled;

  const run = async (fn: () => void | Promise<void>) => {
    try {
      await fn();
    } catch (e: unknown) {
      console.error(logPrefix, e);
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
    if (file.size > importMaxBytes) {
      toast({
        title: 'خطأ',
        description: invalidSizeMessage,
        variant: 'destructive',
      });
      return;
    }
    const lower = file.name.toLowerCase();
    const isValidFormat = lower.endsWith('.xlsx') || lower.endsWith('.xls');
    if (!isValidFormat) {
      toast({
        title: 'خطأ',
        description: invalidFormatMessage,
        variant: 'destructive',
      });
      return;
    }
    void run(() => onImportFile(file));
  };

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-start gap-2 sm:gap-3 w-auto max-w-full',
        className
      )}
      role="toolbar"
      aria-label={ariaLabel}
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
          <DropdownMenuItem onClick={() => void run(onExport)}>📊 {labels.export}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => void run(onDownloadTemplate)}>📋 {labels.template}</DropdownMenuItem>
          {!hideImport && (
            <DropdownMenuItem onClick={handleImportPick}>⬆️ {labels.import}</DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => void run(onPrint)}>🖨️ {labels.print}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
