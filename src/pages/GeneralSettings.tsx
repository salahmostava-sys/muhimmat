import { useState, useEffect } from 'react';
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
  const [backupLoading, setBackupLoading] = useState(false);

  // Dynamic page title
  document.title = `${projectName} | ${isRTL ? 'الإعدادات العامة' : 'General Settings'}`;

  const handleBackup = async () => {
    setBackupLoading(true);
    const tables = [
      'employees', 'attendance', 'advances', 'advance_installments',
      'daily_orders', 'employee_apps', 'apps', 'salary_schemes',
      'salary_records', 'external_deductions', 'vehicles', 'vehicle_assignments',
    ];

    const wb = XLSX.utils.book_new();
    const allData: Record<string, any[]> = {};
    let exported = 0;

    for (const table of tables) {
      const { data } = await supabase.from(table as any).select('*');
      const rows = data || [];
      allData[table] = rows;
      const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{}]);
      XLSX.utils.book_append_sheet(wb, ws, table.slice(0, 31));
      exported++;
    }

    const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm');

    // Excel file
    XLSX.writeFile(wb, `backup_${timestamp}.xlsx`);

    // JSON file
    const jsonBlob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(jsonBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_${timestamp}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setBackupLoading(false);
    toast({ title: isRTL ? `✅ تم تصدير ${exported} جدول بنجاح` : `✅ Exported ${exported} tables successfully` });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
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
                {isRTL
                  ? 'تحميل نسخة احتياطية كاملة من قاعدة البيانات بصيغة Excel و JSON'
                  : 'Download a full backup of the database as Excel & JSON'}
              </p>
            </div>
          </div>
          <Button
            onClick={handleBackup}
            disabled={backupLoading}
            variant="outline"
            className="gap-2"
          >
            {backupLoading ? (
              <><Loader2 size={15} className="animate-spin" /> {isRTL ? 'جاري التصدير...' : 'Exporting...'}</>
            ) : (
              <><Download size={15} /> {isRTL ? 'تحميل نسخة احتياطية' : 'Download Backup'}</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
