import { useState } from 'react';
import { Search, Plus, CreditCard, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { advances } from '@/data/mock';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

const statusLabels: Record<string, string> = { active: 'نشطة', completed: 'مكتملة', paused: 'متوقفة' };
const statusStyles: Record<string, string> = { active: 'badge-info', completed: 'badge-success', paused: 'badge-warning' };

  const handleExport = () => {
    const rows = filtered.map(a => ({
      'المندوب': a.employeeName,
      'مبلغ السلفة': a.amount,
      'المسدد': a.paidAmount,
      'المتبقي': a.amount - a.paidAmount,
      'القسط الشهري': a.monthlyInstallment,
      'أقساط متبقية': a.remainingInstallments,
      'تاريخ الصرف': a.disbursementDate,
      'الحالة': statusLabels[a.status],
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'السلف');
    XLSX.writeFile(wb, `السلف_${format(new Date(), 'yyyy-MM')}.xlsx`);
  };

  const totalActive = advances.filter(a => a.status === 'active').reduce((s, a) => s + (a.amount - a.paidAmount), 0);

  const filtered = advances.filter(a => {
    const matchSearch = a.employeeName.includes(search);
    const matchStatus = statusFilter === 'all' || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalActive = advances.filter(a => a.status === 'active').reduce((s, a) => s + (a.amount - a.paidAmount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><CreditCard size={24} /> السلف والأقساط</h1>
          <p className="text-sm text-muted-foreground mt-1">{advances.length} سلفة — رصيد متبقي: {totalActive.toLocaleString()} ر.س</p>
        </div>
        <Button className="gap-2"><Plus size={16} /> إضافة سلفة</Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="بحث بالاسم..." className="pr-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {[{ v: 'all', l: 'الكل' }, { v: 'active', l: 'نشطة' }, { v: 'completed', l: 'مكتملة' }, { v: 'paused', l: 'متوقفة' }].map(s => (
            <button key={s.v} onClick={() => setStatusFilter(s.v)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === s.v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>{s.l}</button>
          ))}
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="text-right p-4 text-sm font-semibold text-muted-foreground">المندوب</th>
                <th className="text-center p-4 text-sm font-semibold text-muted-foreground">مبلغ السلفة</th>
                <th className="text-center p-4 text-sm font-semibold text-muted-foreground">المسدد</th>
                <th className="text-center p-4 text-sm font-semibold text-muted-foreground">المتبقي</th>
                <th className="text-center p-4 text-sm font-semibold text-muted-foreground">التقدم</th>
                <th className="text-center p-4 text-sm font-semibold text-muted-foreground">القسط الشهري</th>
                <th className="text-center p-4 text-sm font-semibold text-muted-foreground">أقساط متبقية</th>
                <th className="text-center p-4 text-sm font-semibold text-muted-foreground">تاريخ الصرف</th>
                <th className="text-center p-4 text-sm font-semibold text-muted-foreground">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => {
                const remaining = a.amount - a.paidAmount;
                const progress = (a.paidAmount / a.amount) * 100;
                return (
                  <tr key={a.id} className="border-b border-border/30 hover:bg-muted/20">
                    <td className="p-4 text-sm font-medium text-foreground">{a.employeeName}</td>
                    <td className="p-4 text-center text-sm">{a.amount.toLocaleString()} ر.س</td>
                    <td className="p-4 text-center text-sm text-success">{a.paidAmount.toLocaleString()}</td>
                    <td className="p-4 text-center text-sm font-semibold text-destructive">{remaining.toLocaleString()}</td>
                    <td className="p-4 w-32"><Progress value={progress} className="h-2" /></td>
                    <td className="p-4 text-center text-sm">{a.monthlyInstallment}</td>
                    <td className="p-4 text-center text-sm">{a.remainingInstallments}</td>
                    <td className="p-4 text-center text-sm text-muted-foreground">{a.disbursementDate}</td>
                    <td className="p-4 text-center"><span className={statusStyles[a.status]}>{statusLabels[a.status]}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Advances;
