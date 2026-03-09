import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/context/LanguageContext';
import { useSystemSettings } from '@/context/SystemSettingsContext';
import { useAuth } from '@/context/AuthContext';
import ProjectSettings from '@/components/settings/ProjectSettings';
import { Settings2, Database, Download, Loader2, MessageCircle, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from '@e965/xlsx';
import { format } from 'date-fns';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

// ─── WhatsApp Config stored in localStorage ───────────────────────────────────
interface WAConfig { token: string; phone_number_id: string; enabled: boolean; }

const loadWAConfig = (): WAConfig => {
  try { return JSON.parse(localStorage.getItem('whatsapp_config') || '{}'); } catch { return { token: '', phone_number_id: '', enabled: false }; }
};

export default function GeneralSettings() {
  const { t } = useTranslation();
  const { lang } = useLanguage();
  const { projectName } = useSystemSettings();
  const { role } = useAuth();
  const { toast } = useToast();
  const isRTL = lang === 'ar';
  const [loadingExcel, setLoadingExcel] = useState(false);
  const [loadingJson, setLoadingJson] = useState(false);

  // WhatsApp state
  const [waConfig, setWAConfig] = useState<WAConfig>(loadWAConfig);
  const [showToken, setShowToken] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [showTestForm, setShowTestForm] = useState(false);
  const [testingSend, setTestingSend] = useState(false);

  document.title = `${projectName} | ${isRTL ? 'الإعدادات العامة' : 'General Settings'}`;

  const saveWAConfig = () => {
    localStorage.setItem('whatsapp_config', JSON.stringify(waConfig));
    toast({ title: '✅ تم حفظ إعدادات واتساب' });
  };

  const handleTestSend = async () => {
    if (!testPhone) return;
    setTestingSend(true);
    const ok = await sendWhatsAppMessage(testPhone, 'رسالة اختبار من نظام التوصيل ✅');
    setTestingSend(false);
    if (ok) toast({ title: '✅ تم إرسال رسالة الاختبار بنجاح' });
    else toast({ title: 'تعذّر إرسال رسالة الاختبار', description: 'تحقق من صحة الـ Token ورقم الهاتف', variant: 'destructive' });
  };

  const TABLES = [
    'employees', 'attendance', 'advances', 'advance_installments',
    'daily_orders', 'employee_apps', 'apps', 'salary_schemes',
    'salary_records', 'external_deductions', 'vehicles', 'vehicle_assignments',
  ];

  const fetchAllTables = async () => {
    const allData: Record<string, any[]> = {};
    for (const table of TABLES) {
      const { data } = await supabase.from(table as any).select('*');
      allData[table] = data || [];
    }
    return allData;
  };

  const handleBackupExcel = async () => {
    setLoadingExcel(true);
    const allData = await fetchAllTables();
    const wb = XLSX.utils.book_new();
    for (const table of TABLES) {
      const rows = allData[table];
      const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{}]);
      XLSX.utils.book_append_sheet(wb, ws, table.slice(0, 31));
    }
    XLSX.writeFile(wb, `backup_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`);
    setLoadingExcel(false);
    toast({ title: `✅ ${isRTL ? 'تم تصدير ملف Excel بنجاح' : 'Excel backup downloaded'}` });
  };

  const handleBackupJson = async () => {
    setLoadingJson(true);
    const allData = await fetchAllTables();
    const jsonBlob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(jsonBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setLoadingJson(false);
    toast({ title: `✅ ${isRTL ? 'تم تصدير ملف JSON بنجاح' : 'JSON backup downloaded'}` });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <Settings2 size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {isRTL ? 'الإعدادات العامة' : 'General Settings'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isRTL ? 'إدارة اسم المشروع والشعار والمظهر' : 'Manage project name, logo and theme'}
          </p>
        </div>
      </div>

      <ProjectSettings />

      {/* Admin-only Backup Section */}
      {role === 'admin' && (
        <div className="bg-card border border-border/50 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-warning/10 flex items-center justify-center text-warning">
              <Database size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {isRTL ? 'النسخ الاحتياطي' : 'System Backup'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isRTL ? `تصدير ${TABLES.length} جداول — اختر الصيغة المناسبة` : `Export ${TABLES.length} tables — choose format`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleBackupExcel} disabled={loadingExcel || loadingJson} variant="outline" className="gap-2">
              {loadingExcel ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              {isRTL ? 'تحميل Excel' : 'Download Excel'}
            </Button>
            <Button onClick={handleBackupJson} disabled={loadingExcel || loadingJson} variant="outline" className="gap-2">
              {loadingJson ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              {isRTL ? 'تحميل JSON' : 'Download JSON'}
            </Button>
          </div>
        </div>
      )}

      {/* Admin-only WhatsApp Settings */}
      {role === 'admin' && (
        <div className="bg-card border border-border/50 rounded-xl p-6 space-y-5" dir="rtl">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-success/10 flex items-center justify-center text-success">
              <MessageCircle size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">إعدادات إشعارات واتساب</h2>
              <p className="text-xs text-muted-foreground">إرسال إشعارات تلقائية عبر WhatsApp Cloud API</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Enable toggle */}
            <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
              <div>
                <p className="text-sm font-medium text-foreground">تفعيل إشعارات واتساب</p>
                <p className="text-xs text-muted-foreground">إرسال إشعارات عند اعتماد الرواتب والسلف</p>
              </div>
              <button
                onClick={() => setWAConfig(p => ({ ...p, enabled: !p.enabled }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${waConfig.enabled ? 'bg-success' : 'bg-muted-foreground/30'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${waConfig.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {/* Token input */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">رمز الوصول (Token)</label>
              <div className="relative">
                <Input
                  type={showToken ? 'text' : 'password'}
                  value={waConfig.token}
                  onChange={e => setWAConfig(p => ({ ...p, token: e.target.value }))}
                  placeholder="EAA..."
                  dir="ltr"
                  className="pl-10"
                />
                <button
                  onClick={() => setShowToken(v => !v)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Phone Number ID */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">معرف رقم الهاتف (Phone Number ID)</label>
              <Input
                value={waConfig.phone_number_id}
                onChange={e => setWAConfig(p => ({ ...p, phone_number_id: e.target.value }))}
                placeholder="123456789012345"
                dir="ltr"
              />
            </div>

            {/* Help text */}
            <p className="text-xs text-muted-foreground">
              احصل على هذه البيانات من{' '}
              <a href="https://developers.facebook.com/docs/whatsapp/cloud-api" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Meta Business → WhatsApp → API Setup
              </a>
            </p>

            {/* Save + Test buttons */}
            <div className="flex flex-wrap gap-2">
              <Button onClick={saveWAConfig} className="gap-2">
                <MessageCircle size={14} />
                حفظ الإعدادات
              </Button>
              <Button variant="outline" onClick={() => setShowTestForm(v => !v)} className="gap-2">
                اختبار الإرسال
              </Button>
            </div>

            {/* Test form */}
            {showTestForm && (
              <div className="flex items-center gap-2 p-3 bg-muted/40 rounded-lg">
                <Input
                  value={testPhone}
                  onChange={e => setTestPhone(e.target.value)}
                  placeholder="9665XXXXXXXX"
                  dir="ltr"
                  className="flex-1"
                />
                <Button onClick={handleTestSend} disabled={testingSend || !testPhone} size="sm" className="gap-1.5 shrink-0">
                  {testingSend && <Loader2 size={13} className="animate-spin" />}
                  إرسال رسالة اختبار
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
