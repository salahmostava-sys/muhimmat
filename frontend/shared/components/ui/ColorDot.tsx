import { cn } from '@shared/lib/utils';

export function ColorDot(props: { color?: string | null; className?: string }) {
  const { color, className } = props;
  const style =
    color
      ? ({
          '--cdot': color,
        } as React.CSSProperties)
      : undefined;

  return (
    <span
      className={cn(
        'inline-block w-1.5 h-1.5 rounded-full bg-[var(--cdot)]',
        !color && 'bg-muted',
        className
      )}
      style={style}
      aria-hidden
    />
  );
}

