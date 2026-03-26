import React from 'react';
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { getAppColor, type AppColorData } from '@shared/hooks/useAppColors';
import { ColorBadge } from '@shared/components/ui/ColorBadge';
import { ColorDot } from '@shared/components/ui/ColorDot';

type Employee = { id: string; name: string };
type App = { id: string; name: string };
type PopoverState = { empId: string; day: number; x: number; y: number };

type Props = {
  loading: boolean;
  tableRef: React.RefObject<HTMLTableElement | null>;
  seqColMin: number;
  repColMin: number;
  days: number;
  year: number;
  month: number;
  today: number;
  filteredEmployees: Employee[];
  visibleApps: App[];
  appColorsList: AppColorData[];
  expandedEmp: Set<string>;
  cellPopover: PopoverState | null;
  canEditMonth: boolean;
  dayArr: number[];
  getVal: (empId: string, appId: string, day: number) => number;
  getActiveApps: (empId: string) => App[];
  empDayTotal: (empId: string, day: number) => number;
  empMonthTotal: (empId: string) => number;
  empAppMonthTotal: (empId: string, appId: string) => number;
  shortName: (name: string) => string;
  toggleExpand: (employeeId: string) => void;
  handleCellClick: (event: React.MouseEvent, employeeId: string, day: number) => void;
};

export const OrdersGridTable = ({
  loading,
  tableRef,
  seqColMin,
  repColMin,
  days,
  year,
  month,
  today,
  filteredEmployees,
  visibleApps,
  appColorsList,
  expandedEmp,
  cellPopover,
  canEditMonth,
  dayArr,
  getVal,
  getActiveApps,
  empDayTotal,
  empMonthTotal,
  empAppMonthTotal,
  shortName,
  toggleExpand,
  handleCellClick,
}: Props) => {
  return (
    <div className="bg-card rounded-xl shadow-card overflow-x-auto w-full">
      {loading ? (
        <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground">
          <Loader2 size={20} className="animate-spin" /> جاري التحميل...
        </div>
      ) : (
        <table ref={tableRef} className="border-collapse text-[11px] leading-tight" style={{ minWidth: `${seqColMin + repColMin + days * 36 + 64}px`, width: '100%' }}>
          <thead className="sticky top-0 z-20">
            <tr className="bg-muted border-b-2 border-border">
              <th
                className="sticky right-0 z-[32] bg-muted text-center px-0.5 py-1.5 font-semibold text-muted-foreground border-l border-border"
                style={{ minWidth: seqColMin, width: seqColMin }}>
                #
              </th>
              <th
                className="sticky z-[31] bg-muted text-right px-1.5 py-1.5 font-semibold text-foreground border-l-2 border-border"
                style={{ right: seqColMin, minWidth: repColMin }}>
                المندوب / المنصة
              </th>
              {dayArr.map(d => {
                const dow = new Date(year, month - 1, d).getDay();
                const isWeekend = dow === 5 || dow === 6;
                const isThursday = dow === 4;
                const isToday = d === today;
                return (
                  <th key={d}
                    className={`text-center px-0.5 py-1.5 font-medium border-l border-border/50
                      ${isToday ? 'bg-primary/20 text-primary font-bold' : isWeekend ? 'text-muted-foreground/50 bg-muted/40' : isThursday ? 'text-muted-foreground/70 bg-muted/20' : 'text-muted-foreground'}`}
                    style={{ minWidth: 36 }}>
                    {d}
                  </th>
                );
              })}
              <th
                className="sticky left-0 z-30 text-center py-1.5 font-bold text-primary bg-muted border-r-2 border-border"
                style={{ minWidth: 64 }}>
                المجموع
              </th>
            </tr>
          </thead>

          <tbody>
            {filteredEmployees.length === 0 ? (
              <tr><td colSpan={days + 3} className="text-center py-12 text-muted-foreground">لا يوجد مناديب</td></tr>
            ) : filteredEmployees.map((emp, idx) => {
              const activeApps = getActiveApps(emp.id);
              const isExpanded = expandedEmp.has(emp.id);
              const total = empMonthTotal(emp.id);
              const rowBg = idx % 2 === 0 ? 'hsl(var(--card))' : 'hsl(var(--muted))';

              return (
                <React.Fragment key={emp.id}>
                  <tr className={`border-b border-border/40 select-none ${isExpanded ? 'border-b-0' : ''}`}>
                    <td
                      className="sticky right-0 z-[12] text-center px-0.5 py-1 border-l border-border tabular-nums text-muted-foreground font-medium"
                      style={{
                        backgroundColor: isExpanded ? 'hsl(var(--muted))' : rowBg,
                        minWidth: seqColMin,
                        width: seqColMin,
                      }}
                    >
                      {idx + 1}
                    </td>
                    <td
                      className="sticky z-[11] px-1.5 py-1 border-l-2 border-border cursor-pointer hover:brightness-[0.98] transition-[filter] dark:hover:brightness-110"
                      style={{
                        backgroundColor: isExpanded ? 'hsl(var(--muted))' : rowBg,
                        right: seqColMin,
                        minWidth: repColMin,
                      }}
                      onClick={() => activeApps.length > 0 && toggleExpand(emp.id)}
                    >
                      <div className="flex items-center gap-1">
                        {activeApps.length > 0 && (
                          <span className="text-muted-foreground flex-shrink-0">
                            {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                          </span>
                        )}
                        <span className="font-medium text-foreground truncate max-w-[7.5rem]" title={emp.name}>{shortName(emp.name)}</span>
                      </div>
                      {activeApps.length > 0 && (
                        <div className="flex gap-0.5 flex-wrap mt-0.5 pr-7">
                          {activeApps.slice(0, 3).map(a => {
                            const c = getAppColor(appColorsList, a.name);
                            return (
                              <ColorBadge key={a.id} label={a.name.slice(0, 4)} bg={c.solid} fg={c.solidText} className="text-[9px] px-1 py-0 rounded" />
                            );
                          })}
                          {activeApps.length > 3 && <span className="text-[9px] text-muted-foreground">+{activeApps.length - 3}</span>}
                        </div>
                      )}
                    </td>

                    {dayArr.map(d => {
                      const val = empDayTotal(emp.id, d);
                      const dow = new Date(year, month - 1, d).getDay();
                      const isWeekend = dow === 5 || dow === 6;
                      const isThursday = dow === 4;
                      const isToday = d === today;
                      const isOpen = cellPopover?.empId === emp.id && cellPopover?.day === d;
                      const dayApps = visibleApps.filter(a => getVal(emp.id, a.id, d) > 0);

                      return (
                        <td key={d}
                          className={`text-center p-0 border-l border-border/30 transition-colors
                            ${isToday ? 'bg-primary/10' : isWeekend ? 'bg-muted/20' : isThursday ? 'bg-muted/10' : ''}
                            ${isOpen ? 'ring-2 ring-inset ring-primary' : ''}
                            ${canEditMonth ? 'cursor-pointer hover:bg-primary/5' : ''}`}
                          style={{ minWidth: 36 }}
                          onClick={e => handleCellClick(e, emp.id, d)}
                        >
                          <div className="h-7 flex flex-col items-center justify-center gap-0">
                            {val > 0 ? (
                              <>
                                <span className="font-semibold text-foreground leading-none">{val}</span>
                                {dayApps.length > 0 && (
                                  <div className="flex gap-0.5 mt-0.5">
                                    {dayApps.slice(0, 3).map(a => {
                                      const c = getAppColor(appColorsList, a.name);
                                      return <ColorDot key={a.id} color={c.solid} />;
                                    })}
                                  </div>
                                )}
                              </>
                            ) : (
                              <span className="text-muted-foreground/20">·</span>
                            )}
                          </div>
                        </td>
                      );
                    })}

                    <td
                      className="sticky left-0 z-10 text-center px-1 py-1 font-bold text-primary border-r-2 border-border bg-muted"
                      style={{ minWidth: 64 }}
                    >
                      {total > 0 ? total : <span className="text-muted-foreground/30">0</span>}
                    </td>
                  </tr>

                  {isExpanded && activeApps.map(app => {
                    const c = getAppColor(appColorsList, app.name);
                    const appTotal = empAppMonthTotal(emp.id, app.id);
                    const rowStyle = { '--rowbg': c.cellBg, '--cval': c.text } as React.CSSProperties;
                    return (
                      <tr
                        key={`${emp.id}-${app.id}`}
                        className="border-b border-border/20 bg-[var(--rowbg)]"
                        style={rowStyle}
                      >
                        <td className="sticky right-0 z-[12] border-l border-border bg-[var(--rowbg)]" style={{ minWidth: seqColMin, width: seqColMin }} aria-hidden />
                        <td className="sticky z-[11] px-1.5 py-1 border-l-2 border-border bg-[var(--rowbg)]" style={{ right: seqColMin, minWidth: repColMin }}>
                          <div className="flex items-center gap-2 pr-8">
                            <ColorBadge label={app.name} bg={c.solid} fg={c.solidText} className="text-[10px]" />
                          </div>
                        </td>
                        {dayArr.map(d => {
                          const val = getVal(emp.id, app.id, d);
                          const dow = new Date(year, month - 1, d).getDay();
                          const isWeekend = dow === 5 || dow === 6;
                          const isThursday = dow === 4;
                          const isToday = d === today;
                          return (
                            <td key={d} className={`text-center p-0 border-l border-border/20 ${isToday ? 'bg-primary/5' : isWeekend ? 'bg-muted/20 opacity-70' : isThursday ? 'bg-muted/10' : ''}`} style={{ minWidth: 36 }}>
                              <div className={`h-6 flex items-center justify-center font-medium text-[10px] ${val > 0 ? 'text-[var(--cval)]' : ''}`}>
                                {val > 0 ? val : <span className="text-muted-foreground/20">·</span>}
                              </div>
                            </td>
                          );
                        })}
                        <td className="sticky left-0 z-10 text-center px-1 py-1 font-bold border-r-2 border-border text-[10px] bg-muted text-[var(--cval)]" style={{ minWidth: 64 }}>
                          {appTotal > 0 ? appTotal : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}

            <tr className="border-t-2 border-border font-semibold">
              <td className="sticky right-0 z-[12] text-center px-0.5 py-1.5 border-l border-border text-muted-foreground bg-muted"
                style={{ minWidth: seqColMin, width: seqColMin }}>
                —
              </td>
              <td className="sticky z-[11] px-1.5 py-1.5 text-xs font-bold border-l-2 border-border text-foreground bg-muted"
                style={{ right: seqColMin, minWidth: repColMin }}>
                الإجمالي
              </td>
              {dayArr.map(d => {
                const dayTotal = filteredEmployees.reduce((s, e) => s + empDayTotal(e.id, d), 0);
                const isToday = d === today;
                return (
                  <td key={d} className={`text-center px-0.5 py-1.5 font-bold border-l border-border/40 ${isToday ? 'bg-primary/10 text-primary' : 'text-foreground'}`}
                    style={{ minWidth: 36, backgroundColor: isToday ? undefined : 'hsl(var(--muted) / 0.4)' }}>
                    {dayTotal > 0 ? dayTotal : <span className="text-muted-foreground/30">—</span>}
                  </td>
                );
              })}
              <td className="sticky left-0 z-10 text-center px-1.5 py-1.5 font-bold text-xs text-primary border-r-2 border-border bg-muted"
                style={{ minWidth: 64 }}>
                {filteredEmployees.reduce((s, e) => s + empMonthTotal(e.id), 0)}
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
};
