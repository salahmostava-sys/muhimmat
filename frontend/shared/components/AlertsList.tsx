import { useEffect, useState } from 'react';
import { AlertTriangle, Clock, Shield, CreditCard } from 'lucide-react';
import { useAlerts } from '@shared/hooks/useAlertsData';
import { useRealtimePostgresChanges, REALTIME_TABLES_ALERTS_WIDGET } from '@shared/hooks/useRealtimePostgresChanges';

const typeLabels: Record<string, string> = {
  residency: 'إقامة',
  insurance: 'تأمين',
  registration: 'تسجيل',
  license: 'رخصة',
  installment: 'قسط سلفة',
  deduction: 'خصم',
  authorization: 'تفويض',
};

const typeIcons: Record<string, typeof AlertTriangle> = {
  residency: AlertTriangle,
  insurance: Shield,
  registration: Clock,
  license: Clock,
  installment: CreditCard,
  deduction: CreditCard,
  authorization: Clock,
};

function formatDaysLeftLabel(daysLeft: number): string {
  if (daysLeft < 0) return 'منتهي';
  if (daysLeft === 0) return 'اليوم';
  return `${daysLeft}ي`;
}

export function AlertsList() {
  const [refreshKey, setRefreshKey] = useState(0);
  const { data: alertsData = [], isLoading, refetch } = useAlerts();

  useRealtimePostgresChanges('dashboard-alerts-widget', REALTIME_TABLES_ALERTS_WIDGET, () => {
    setRefreshKey((k) => k + 1);
  });

  useEffect(() => {
    if (refreshKey === 0) return;
    void refetch();
  }, [refreshKey, refetch]);

  const alerts = [...alertsData]
    .filter((a) => !a.resolved)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 8);

  const severityDot: Record<string, string> = {
    urgent: 'bg-destructive',
    warning: 'bg-warning',
    info: 'bg-info',
  };

  const severityBadge: Record<string, string> = {
    urgent: 'badge-urgent',
    warning: 'badge-warning',
    info: 'badge-info',
  };

  const severityIconBg: Record<string, string> = {
    urgent: 'bg-destructive/10 text-destructive',
    warning: 'bg-warning/10 text-warning',
    info: 'bg-info/10 text-info',
  };

  let body: React.ReactNode = null;
  if (isLoading) {
    body = (
      <div className="p-8 text-center">
        <p className="text-sm font-medium text-muted-foreground">جارٍ تحميل التنبيهات...</p>
      </div>
    );
  } else if (alerts.length === 0) {
    body = (
      <div className="p-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-3">
          <Shield size={22} className="text-success" />
        </div>
        <p className="text-sm font-medium text-foreground">لا توجد تنبيهات عاجلة</p>
        <p className="text-xs text-muted-foreground mt-1">كل شيء على ما يرام ✅</p>
      </div>
    );
  } else {
    body = (
      <div className="divide-y divide-border/40">
        {alerts.map((alert) => {
          const Icon = typeIcons[alert.type] || AlertTriangle;
          return (
            <div key={alert.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors">
              <div className={`icon-box-sm flex-shrink-0 ${severityIconBg[alert.severity]}`}>
                <Icon size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{alert.entityName}</p>
                <p className="text-xs text-muted-foreground">
                  {typeLabels[alert.type] || alert.type} — {alert.dueDate}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`w-1.5 h-1.5 rounded-full ${severityDot[alert.severity]}`} />
                <span className={severityBadge[alert.severity]}>{formatDaysLeftLabel(alert.daysLeft)}</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="chart-card animate-fade-in">
      <div className="chart-card-header">
        <div className="flex items-center gap-2">
          <h3 className="chart-card-title">التنبيهات العاجلة</h3>
          {alerts.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center">
              {alerts.length}
            </span>
          )}
        </div>
      </div>

      {body}
    </div>
  );
}

export default AlertsList;
