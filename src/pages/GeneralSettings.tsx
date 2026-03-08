import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/context/LanguageContext';
import { useSystemSettings } from '@/context/SystemSettingsContext';
import { useAuth } from '@/context/AuthContext';
import ProjectSettings from '@/components/settings/ProjectSettings';
import { Settings2, Database, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

export default function GeneralSettings() {
  const { t } = useTranslation();
  const { lang } = useLanguage();
  const { projectName } = useSystemSettings();
  const { role } = useAuth();
  const { toast } = useToast();
  const isRTL = lang === 'ar';
  const [loadingExcel, setLoadingExcel] = useState(false);
  const [loadingJson, setLoadingJson] = useState(false);

  document.title = `${projectName} | ${isRTL ? 'الإعدادات العامة' : 'General Settings'}`;

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
    </div>
  );
}
