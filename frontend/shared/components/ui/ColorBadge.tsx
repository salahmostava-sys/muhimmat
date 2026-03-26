import { cn } from '@shared/lib/utils';

export function ColorBadge(props: {
  label: string;
  bg?: string | null;
  fg?: string | null;
  className?: string;
}) {
  const { label, bg, fg, className } = props;
  const style =
    bg || fg
      ? ({
          '--cbg': bg ?? undefined,
          '--cfg': fg ?? undefined,
          '--cbd': bg ?? undefined,
        } as React.CSSProperties)
      : undefined;

  return (
    <span
      className={cn(
        'text-[11px] px-2 py-0.5 rounded-full border font-semibold inline-flex items-center justify-center',
        bg ? 'bg-[var(--cbg)] border-[var(--cbd)]' : 'bg-muted border-border',
        fg ? 'text-[var(--cfg)]' : 'text-muted-foreground',
        className
      )}
      style={style}
    >
      {label}
    </span>
  );
}

