import { useState, useEffect, useRef } from 'react';
import { Bell, X, CheckCheck, AlertTriangle, Clock, FileWarning } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/context/LanguageContext';
import { cn } from '@/lib/utils';
import { format, parseISO, isValid } from 'date-fns';

interface Notification {
  id: string;
  type: string;
  entity_type: string | null;
  entity_id: string | null;
  due_date: string | null;
  is_resolved: boolean;
  created_at: string;
}

const typeConfig: Record<string, { icon: React.ReactNode; color: string; labelAr: string; labelEn: string }> = {
  residency_expiry: {
    icon: <FileWarning size={15} />,
    color: 'text-destructive bg-destructive/10',
    labelAr: 'انتهاء إقامة',
    labelEn: 'Residency Expiry',
  },
  license_expiry: {
    icon: <AlertTriangle size={15} />,
    color: 'text-warning bg-warning/10',
    labelAr: 'انتهاء رخصة',
    labelEn: 'License Expiry',
  },
  insurance_expiry: {
    icon: <Clock size={15} />,
    color: 'text-info bg-info/10',
    labelAr: 'انتهاء تأمين',
    labelEn: 'Insurance Expiry',
  },
};

const getConfig = (type: string) =>
  typeConfig[type] ?? {
    icon: <Bell size={15} />,
    color: 'text-primary bg-primary/10',
    labelAr: type,
    labelEn: type,
  };

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { lang } = useLanguage();
  const isRTL = lang === 'ar';

  const unreadCount = notifications.filter(n => !n.is_resolved).length;

  const fetchNotifications = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    if (data) setNotifications(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markResolved = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from('alerts').update({ is_resolved: true, resolved_by: (await supabase.auth.getUser()).data.user?.id }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_resolved: true } : n));
  };

  const markAllResolved = async () => {
    const unresolvedIds = notifications.filter(n => !n.is_resolved).map(n => n.id);
    if (!unresolvedIds.length) return;
    const userId = (await supabase.auth.getUser()).data.user?.id;
    await supabase.from('alerts').update({ is_resolved: true, resolved_by: userId }).in('id', unresolvedIds);
    setNotifications(prev => prev.map(n => ({ ...n, is_resolved: true })));
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    try {
      const d = parseISO(dateStr);
      if (!isValid(d)) return '';
      return format(d, 'dd/MM/yyyy');
    } catch { return ''; }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => { setOpen(v => !v); if (!open) fetchNotifications(); }}
        className="relative h-8 w-8 flex items-center justify-center rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
        title={isRTL ? 'الإشعارات' : 'Notifications'}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -end-0.5 h-4 w-4 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className={cn(
          'absolute top-10 z-50 w-80 rounded-xl border border-border bg-card shadow-xl overflow-hidden',
          isRTL ? 'left-0' : 'right-0'
        )}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Bell size={15} className="text-primary" />
              <span className="text-sm font-semibold text-foreground">
                {isRTL ? 'الإشعارات' : 'Notifications'}
              </span>
              {unreadCount > 0 && (
                <span className="badge-urgent">{unreadCount}</span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllResolved}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <CheckCheck size={12} />
                {isRTL ? 'تعيين الكل كمقروء' : 'Mark all read'}
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-border/50">
            {loading && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {isRTL ? 'جاري التحميل...' : 'Loading...'}
              </div>
            )}
            {!loading && notifications.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {isRTL ? 'لا توجد إشعارات' : 'No notifications'}
              </div>
            )}
            {!loading && notifications.map(n => {
              const cfg = getConfig(n.type);
              return (
                <div
                  key={n.id}
                  className={cn(
                    'flex items-start gap-3 px-4 py-3 hover:bg-accent/40 transition-colors',
                    !n.is_resolved && 'bg-primary/5'
                  )}
                >
                  <div className={cn('mt-0.5 flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center', cfg.color)}>
                    {cfg.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-xs font-medium text-foreground', n.is_resolved && 'text-muted-foreground')}>
                      {isRTL ? cfg.labelAr : cfg.labelEn}
                    </p>
                    {n.due_date && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {isRTL ? 'التاريخ:' : 'Due:'} {formatDate(n.due_date)}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                      {formatDate(n.created_at)}
                    </p>
                  </div>
                  {!n.is_resolved && (
                    <button
                      onClick={(e) => markResolved(n.id, e)}
                      className="flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center hover:bg-success/20 text-muted-foreground hover:text-success transition-colors mt-0.5"
                      title={isRTL ? 'تعيين كمقروء' : 'Mark read'}
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="border-t border-border px-4 py-2.5 bg-muted/30">
            <a href="/alerts" className="text-xs text-primary hover:underline">
              {isRTL ? 'عرض كل التنبيهات ←' : 'View all alerts →'}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
