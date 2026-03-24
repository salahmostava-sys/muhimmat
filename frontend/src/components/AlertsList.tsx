import { useState, useEffect } from 'react';
import { AlertTriangle, Clock, Shield, CreditCard } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays, parseISO, endOfMonth, format } from 'date-fns';

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

interface AlertItem {
  id: string;
  type: string;
  entityName: string;
  dueDate: string;
  daysLeft: number;
  severity: 'urgent' | 'warning' | 'info';
}

const AlertsList = () => {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  useEffect(() => {
    const fetchAlerts = async () => {
      const today = new Date();
      // Alert threshold = end of current month
      const threshold = format(new Date(today.getFullYear(), today.getMonth() + 1, 0), 'yyyy-MM-dd');

      const [empRes, vehicleRes] = await Promise.all([
        supabase
          .from('employees')
          .select('id, name, residency_expiry')
          .eq('status', 'active')
          .not('residency_expiry', 'is', null)
          .lte('residency_expiry', threshold)
          .limit(5),
        supabase
          .from('vehicles')
          .select('id, plate_number, insurance_expiry, registration_expiry')
          .in('status', ['active', 'maintenance'])
          .or(`insurance_expiry.lte.${threshold},registration_expiry.lte.${threshold}`)
          .limit(5),
      ]);

      const generated: AlertItem[] = [];

      empRes.data?.forEach(emp => {
        const daysLeft = differenceInDays(parseISO(emp.residency_expiry!), today);
        generated.push({
          id: `res-${emp.id}`,
          type: 'residency',
          entityName: emp.name,
          dueDate: emp.residency_expiry!,
          daysLeft,
          severity: daysLeft < 0 ? 'urgent' : daysLeft <= 14 ? 'urgent' : daysLeft <= 30 ? 'warning' : 'info',
        });
      });

      vehicleRes.data?.forEach(v => {
        if (v.insurance_expiry && v.insurance_expiry <= threshold) {
          const days = differenceInDays(parseISO(v.insurance_expiry), today);
          generated.push({
            id: `ins-${v.id}`,
            type: 'insurance',
            entityName: `مركبة ${v.plate_number}`,
            dueDate: v.insurance_expiry,
            daysLeft: days,
            severity: days <= 14 ? 'urgent' : 'warning',
          });
        }
      });

      setAlerts(generated.sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 8));
    };

    fetchAlerts();
  }, []);

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

  return (
    <div className="chart-card animate-fade-in">
      {/* Header */}
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

      {alerts.length === 0 ? (
        <div className="p-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-3">
            <Shield size={22} className="text-success" />
          </div>
          <p className="text-sm font-medium text-foreground">لا توجد تنبيهات عاجلة</p>
          <p className="text-xs text-muted-foreground mt-1">كل شيء على ما يرام ✅</p>
        </div>
      ) : (
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
                  <span className={severityBadge[alert.severity]}>
                    {alert.daysLeft < 0 ? 'منتهي' : alert.daysLeft === 0 ? 'اليوم' : `${alert.daysLeft}ي`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AlertsList;
