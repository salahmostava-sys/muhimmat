import { useState, useEffect } from 'react';
import { AlertTriangle, Clock, Shield, CreditCard } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays, parseISO, addDays, format } from 'date-fns';

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

const severityStyles: Record<string, string> = {
  urgent: 'badge-urgent',
  warning: 'badge-warning',
  info: 'badge-info',
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
      const in60Days = format(addDays(today, 60), 'yyyy-MM-dd');

      const [empRes, vehicleRes] = await Promise.all([
        supabase
          .from('employees')
          .select('id, name, residency_expiry')
          .eq('status', 'active')
          .not('residency_expiry', 'is', null)
          .lte('residency_expiry', in60Days)
          .limit(5),
        supabase
          .from('vehicles')
          .select('id, plate_number, insurance_expiry, registration_expiry')
          .in('status', ['active', 'maintenance'])
          .or(`insurance_expiry.lte.${in60Days},registration_expiry.lte.${in60Days}`)
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
        if (v.insurance_expiry && v.insurance_expiry <= in60Days) {
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

  if (alerts.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border/50 shadow-sm">
        <div className="p-5 border-b border-border/50">
          <h3 className="font-semibold text-foreground">التنبيهات العاجلة</h3>
        </div>
        <div className="p-8 text-center text-muted-foreground text-sm">
          ✅ لا توجد تنبيهات عاجلة
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border/50 shadow-sm">
      <div className="p-5 border-b border-border/50">
        <h3 className="font-semibold text-foreground">التنبيهات العاجلة</h3>
      </div>
      <div className="divide-y divide-border/50">
        {alerts.map((alert) => {
          const Icon = typeIcons[alert.type] || AlertTriangle;
          return (
            <div key={alert.id} className="p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                alert.severity === 'urgent' ? 'bg-destructive/10 text-destructive' :
                alert.severity === 'warning' ? 'bg-warning/10 text-warning' : 'bg-info/10 text-info'
              }`}>
                <Icon size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{alert.entityName}</p>
                <p className="text-xs text-muted-foreground">انتهاء {typeLabels[alert.type] || alert.type} — {alert.dueDate}</p>
              </div>
              <span className={severityStyles[alert.severity]}>
                {alert.daysLeft < 0 ? 'منتهي' : alert.daysLeft === 0 ? 'اليوم' : `${alert.daysLeft} يوم`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AlertsList;
