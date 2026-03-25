import { ChevronLeft, ChevronRight } from 'lucide-react';

type Props = {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  compact?: boolean;
};

export const OrdersMonthNavigator = ({ label, onPrev, onNext, compact = false }: Props) => {
  return (
    <div className={`flex items-center gap-0.5 bg-muted rounded-lg ${compact ? 'p-0.5' : 'p-1'}`}>
      <button
        type="button"
        onClick={onPrev}
        className={`rounded hover:bg-background transition-colors ${compact ? 'p-1.5' : 'p-1.5'}`}
        aria-label="الشهر السابق"
      >
        <ChevronRight size={compact ? 15 : 16} />
      </button>
      <span className={`${compact ? 'px-2 text-xs font-semibold min-w-[7.5rem]' : 'px-3 text-sm font-medium min-w-28'} text-center tabular-nums`}>
        {label}
      </span>
      <button
        type="button"
        onClick={onNext}
        className={`rounded hover:bg-background transition-colors ${compact ? 'p-1.5' : 'p-1.5'}`}
        aria-label="الشهر التالي"
      >
        <ChevronLeft size={compact ? 15 : 16} />
      </button>
    </div>
  );
};
