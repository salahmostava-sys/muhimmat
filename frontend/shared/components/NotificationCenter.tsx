import { useState, useEffect, useRef } from 'react';
import { Bell, X, CheckCheck, FileWarning, AlertTriangle, Clock, ShieldAlert } from 'lucide-react';
import { useLanguage } from '@app/providers/LanguageContext';
import { useAlerts } from '@shared/hooks/useAlertsData';
import { cn } from '@shared/lib/utils';
import { logError } from '@shared/lib/logger';
import { Link } from 'react-router-dom';
import type { Alert } from '@shared/lib/alertsBuilder';

/* ── Config ─────────────────────────────────────────────────── */

const TYPE_CONFIG: Record<string, {
  icon: React.ReactNode;
  colorClass: string;
  labelAr: string;
  labelEn: string;
}> = {
  residency: {
    icon: <FileWarning size={14} />,
    colorClass: 'text-destructive bg-destructive/10',
    labelAr: 'انتهاء إقامة',
    labelEn: 'Residency Expiry',
  },
  insurance: {
    icon: <ShieldAlert size={14} />,
    colorClass: 'text-warning bg-warning/10',
    labelAr: 'انتهاء تأمين',
    labelEn: 'Insurance Expiry',
  },
  authorization: {
    icon: <AlertTriangle size={14} />,
    colorClass: 'text-warning bg-warning/10',
    labelAr: 'انتهاء تفويض',
    labelEn: 'Authorization Expiry',
  },
  probation: {
    icon: <Clock size={14} />,
    colorClass: 'text-info bg-info/10',
    labelAr: 'انتهاء فترة التجربة',
    labelEn: 'Probation End',
  },
  platform_account: {
    icon: <AlertTriangle size={14} />,
    colorClass: 'text-warning bg-warning/10',
    labelAr: 'انتهاء إقامة حساب منصة',
    labelEn: 'Platform Account Iqama',
  },
  employee_absconded: {
    icon: <AlertTriangle size={14} />,
    colorClass: 'text-destructive bg-destructive/10',
    labelAr: 'مندوب هارب',
    labelEn: 'Employee Absconded',
  },
  employee_terminated: {
    icon: <AlertTriangle size={14} />,
    colorClass: 'text-warning bg-warning/10',
    labelAr: 'مندوب منتهي',
    labelEn: 'Employee Terminated',
  },
};

const SEVERITY_DOT: Record<Alert['severity'], string> = {
  urgent:  'bg-destructive',
  warning: 'bg-warning',
  info:    'bg-info',
};

/* ── Helper ─────────────────────────────────────────────────── */
function daysLabel(days: number, isRTL: boolean): string {
  if (days < 0) return isRTL ? `انتهت منذ ${Math.abs(days)} يوم` : `Expired ${Math.abs(days)}d ago`;
  if (days === 0) return isRTL ? 'ينتهي اليوم' : 'Expires today';
  return isRTL ? `يتبقى ${days} يوم` : `${days}d left`;
}

/* ── Main component ─────────────────────────────────────────── */

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('nc_dismissed') || '[]')); }
    catch (e) {
      logError('[NotificationCenter] invalid nc_dismissed in storage', e, { level: 'warn' });
      return new Set();
    }
  });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { isRTL } = useLanguage();
  const {
    data: alertsData = [],
    isLoading,
    isFetching,
    refetch,
  } = useAlerts();
  const alerts: Alert[] = alertsData;
  const loading = isLoading || isFetching;

  // Close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  /* ── Active (non-dismissed) alerts ──────────────────────── */
  const active = alerts.filter(a => !dismissed.has(a.id));
  const unread  = active.length;

  const hasUrgent  = active.some(a => a.severity === 'urgent');
  const hasWarning = !hasUrgent && active.some(a => a.severity === 'warning');

  /* ── Dismiss one ─────────────────────────────────────────── */
  const dismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(dismissed).add(id);
    setDismissed(next);
    localStorage.setItem('nc_dismissed', JSON.stringify([...next]));
  };

  /* ── Dismiss all ─────────────────────────────────────────── */
  const dismissAll = () => {
    const next = new Set([...dismissed, ...active.map(a => a.id)]);
    setDismissed(next);
    localStorage.setItem('nc_dismissed', JSON.stringify([...next]));
  };

  /* ── Badge color ─────────────────────────────────────────── */
  let badgeBg = 'bg-primary';
  if (hasUrgent) {
    badgeBg = 'bg-destructive';
  } else if (hasWarning) {
    badgeBg = 'bg-warning';
  }

  return (
    <div className="relative" ref={dropdownRef}>

      {/* ── Bell button ─────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => {
          setOpen(v => !v);
          if (!open) void refetch();
        }}
        className="relative h-9 w-9 flex items-center justify-center rounded-full border border-border/60 bg-card/80 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        title={isRTL ? 'الإشعارات' : 'Notifications'}
      >
        <Bell size={17} className={cn(unread > 0 && 'text-foreground')} />

        {/* Badge */}
        {unread > 0 && (
          <span
            className={cn(
              'absolute -top-1 -end-1 h-4 min-w-4 px-0.5 flex items-center justify-center rounded-full text-white text-[9px] font-bold leading-none',
              badgeBg,
              hasUrgent && 'animate-pulse',
            )}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* ── Dropdown ─────────────────────────────────────────── */}
      {open && (
        <div
          className={cn(
            'absolute top-10 z-50 w-80 rounded-xl border border-border bg-card shadow-2xl overflow-hidden',
            isRTL ? 'left-0' : 'right-0',
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-primary" />
              <span className="text-sm font-semibold text-foreground">
                {isRTL ? 'التنبيهات' : 'Alerts'}
              </span>
              {unread > 0 && (
                <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white', badgeBg)}>
                  {unread}
                </span>
              )}
            </div>
            {unread > 0 && (
              <button
                onClick={dismissAll}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <CheckCheck size={11} />
                {isRTL ? 'قراءة الكل' : 'Clear all'}
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[340px] overflow-y-auto divide-y divide-border/40">
            {loading && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {isRTL ? 'جاري التحميل...' : 'Loading...'}
              </div>
            )}

            {!loading && active.length === 0 && (
              <div className="py-10 flex flex-col items-center gap-2 text-muted-foreground">
                <Bell size={28} className="opacity-20" />
                <span className="text-sm">{isRTL ? 'لا توجد تنبيهات نشطة' : 'No active alerts'}</span>
              </div>
            )}

            {!loading && active.map(a => {
              const cfg = TYPE_CONFIG[a.type] || {
                icon: <Bell size={14} />,
                colorClass: 'text-muted-foreground bg-muted',
                labelAr: a.type,
                labelEn: a.type,
              };
              return (
                <div
                  key={a.id}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-accent/30 transition-colors"
                >
                  {/* Severity dot */}
                  <div className="mt-1 flex-shrink-0">
                    <span className={cn('block h-2 w-2 rounded-full', SEVERITY_DOT[a.severity])} />
                  </div>

                  {/* Icon */}
                  <div className={cn('mt-0.5 flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center', cfg.colorClass)}>
                    {cfg.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{a.entityName}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {isRTL ? cfg.labelAr : cfg.labelEn}
                    </p>
                    <p
                      className={cn(
                        'text-[10px] font-medium mt-0.5',
                        a.severity === 'urgent'  && 'text-destructive',
                        a.severity === 'warning' && 'text-warning',
                        a.severity === 'info'    && 'text-info',
                      )}
                    >
                      {daysLabel(a.daysLeft, isRTL)}
                    </p>
                  </div>

                  {/* Dismiss */}
                  <button
                    onClick={(e) => dismiss(a.id, e)}
                    className="flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors mt-0.5"
                    title={isRTL ? 'إخفاء' : 'Dismiss'}
                  >
                    <X size={10} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="border-t border-border px-4 py-2.5 bg-muted/30">
            <Link
              to="/alerts"
              onClick={() => setOpen(false)}
              className="text-xs text-primary hover:underline"
            >
              {isRTL ? 'عرض كل التنبيهات ←' : 'View all alerts →'}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
