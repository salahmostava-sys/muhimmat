import { Wallet } from 'lucide-react';
import { Button } from '@shared/components/ui/button';

export function SalarySummary(props: Readonly<{ monthYear: string; total: number; onBack: () => void }>) {
  const { monthYear, total, onBack } = props;
  return (
    <div className="page-header">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2"><Wallet size={20} /> الرواتب — قائمة (سريعة)</h1>
          <p className="page-subtitle">{total.toLocaleString()} سجل — {monthYear}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={onBack}>رجوع</Button>
        </div>
      </div>
    </div>
  );
}
