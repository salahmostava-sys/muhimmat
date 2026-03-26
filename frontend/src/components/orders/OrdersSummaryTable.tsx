import { getAppColor, type AppColorData } from '@/hooks/useAppColors';
import { ColorBadge } from '@/components/ui/ColorBadge';

type Employee = { id: string; name: string };
type App = { id: string; name: string };
type DailyData = Record<string, number>;
type SortField = 'name' | 'total' | `app:${string}`;
type SortDir = 'asc' | 'desc';

type Props = {
  loading: boolean;
  apps: App[];
  appColorsList: AppColorData[];
  sortedEmployees: Employee[];
  employeesCount: number;
  data: DailyData;
  dayArr: number[];
  days: number;
  empTotal: (employeeId: string) => number;
  appGrandTotal: (appId: string) => number;
  grandTotal: number;
  shortName: (name: string) => string;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
};

const SortIcon = ({ active, dir }: { active: boolean; dir: SortDir }) => {
  if (!active) return <span className="text-muted-foreground/40 text-[10px] mr-0.5">⇅</span>;
  return <span className="text-[10px] mr-0.5">{dir === 'asc' ? '↑' : '↓'}</span>;
};

export const OrdersSummaryTable = ({
  loading,
  apps,
  appColorsList,
  sortedEmployees,
  employeesCount,
  data,
  dayArr,
  days,
  empTotal,
  appGrandTotal,
  grandTotal,
  shortName,
  sortField,
  sortDir,
  onSort,
}: Props) => {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b-2 border-border bg-muted/40">
          <th className="text-center p-3 font-semibold text-muted-foreground w-10">#</th>
          <th className="text-center p-3 font-semibold text-foreground min-w-[110px] cursor-pointer" onClick={() => onSort('name')}>
            المندوب <SortIcon active={sortField === 'name'} dir={sortDir} />
          </th>
          {apps.map((app) => {
            const c = getAppColor(appColorsList, app.name);
            const appField = `app:${app.id}` as const;
            return (
              <th
                key={app.id}
                onClick={() => onSort(appField)}
                className="text-center p-3 font-semibold min-w-[90px] border-l border-border/50 cursor-pointer"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <ColorBadge label={app.name} bg={c.bg} fg={c.text} />
                  <SortIcon active={sortField === appField} dir={sortDir} />
                </div>
              </th>
            );
          })}
          <th className="text-center p-3 font-semibold text-primary min-w-[80px] border-l border-border cursor-pointer" onClick={() => onSort('total')}>
            الإجمالي <SortIcon active={sortField === 'total'} dir={sortDir} />
          </th>
          <th className="text-center p-3 font-semibold text-muted-foreground min-w-[80px]">متوسط يومي</th>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <tr key={`skeleton-row-${i}`} className="border-b border-border/30">
              {Array.from({ length: apps.length + 4 }).map((__, j) => (
                <td key={`skeleton-cell-${i}-${j}`} className="p-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>
              ))}
            </tr>
          ))
        ) : sortedEmployees.map((emp, idx) => {
          const total = empTotal(emp.id);
          const avg = total > 0 ? Math.round(total / days) : 0;
          return (
            <tr key={emp.id} className={`border-b border-border/30 hover:bg-muted/20 ${idx % 2 === 1 ? 'bg-muted/5' : ''}`}>
              <td className="p-3 text-center text-xs text-muted-foreground font-medium">{idx + 1}</td>
              <td className="p-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground whitespace-nowrap" title={emp.name}>
                    {shortName(emp.name)}
                  </span>
                </div>
              </td>
              {apps.map((app) => {
                const c = getAppColor(appColorsList, app.name);
                const appTotal = dayArr.reduce((s, d) => s + (data[`${emp.id}::${app.id}::${d}`] ?? 0), 0);
                return (
                  <td key={app.id} className="text-center p-3 font-semibold border-l border-border/30" style={{ color: appTotal > 0 ? c.val : undefined }}>
                    {appTotal > 0 ? appTotal : <span className="text-muted-foreground/30">—</span>}
                  </td>
                );
              })}
              <td className="p-3 text-center font-bold text-primary border-l border-border">{total > 0 ? total : 0}</td>
              <td className="p-3 text-center text-muted-foreground">{avg}</td>
            </tr>
          );
        })}
      </tbody>
      {!loading && employeesCount > 0 && (
        <tfoot>
          <tr className="bg-muted/40 font-semibold border-t-2 border-border">
            <td colSpan={2} className="p-3">
              <span className="text-sm font-bold text-foreground">الإجمالي</span>
            </td>
            {apps.map((app) => {
              const c = getAppColor(appColorsList, app.name);
              const total = appGrandTotal(app.id);
              return (
                <td key={app.id} className="text-center p-3 font-bold border-l border-border/40" style={{ color: c.val }}>
                  {total > 0 ? total : '—'}
                </td>
              );
            })}
            <td className="p-3 text-center font-bold text-primary border-l border-border">{grandTotal}</td>
            <td />
          </tr>
        </tfoot>
      )}
    </table>
  );
};
