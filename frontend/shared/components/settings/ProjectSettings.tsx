import { useState, useEffect } from 'react';
import { useLanguage } from '@app/providers/LanguageContext';
import { useTheme } from '@app/providers/ThemeContext';
import { useSystemSettings } from '@app/providers/SystemSettingsContext';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Label } from '@shared/components/ui/label';
import { useToast } from '@shared/hooks/use-toast';
import { Loader2, Save, Globe, Palette, Building2, Upload, X, Download, Database, CheckCircle, Bell } from 'lucide-react';
import { cn } from '@shared/lib/utils';
import * as XLSX from '@e965/xlsx';
import { format } from 'date-fns';
import { usePermissions } from '@shared/hooks/usePermissions';
import { useAuth } from '@app/providers/AuthContext';
import { validateUploadFile } from '@shared/lib/validation';
import { settingsHubService } from '@services/settingsHubService';
import { supabase } from '@services/supabase/client';
import { getErrorMessage } from '@shared/lib/query';
import { logError } from '@shared/lib/logger';

export default function ProjectSettings() {
  const { isRTL } = useLanguage();
  const { isDark, toggleTheme } = useTheme();
  const { user } = useAuth();
  const { settings, refresh } = useSystemSettings();
  const { toast } = useToast();
  const { isAdmin } = usePermissions('settings');

  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [defaultLang, setDefaultLang] = useState('ar');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [iqamaAlertDays, setIqamaAlertDays] = useState(90);
  const [saving, setSaving] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);

  useEffect(() => {
    if (settings) {
      setNameAr(settings.project_name_ar);
      setNameEn(settings.project_name_en);
      setDefaultLang(settings.default_language);
      setLogoPreview(settings.logo_url);
      setRemoveLogo(false);
      setIqamaAlertDays(settings.iqama_alert_days ?? 90);
    }
  }, [settings]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateUploadFile(file, {
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
    });
    if (!validation.valid) {
      toast({ title: isRTL ? 'خطأ في الملف' : 'Invalid file', description: validation.error, variant: 'destructive' });
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setRemoveLogo(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let logo_url = settings?.logo_url ?? null;

      if (removeLogo) {
        logo_url = null;
      } else if (logoFile) {
        const ext = logoFile.name.split('.').pop();
        const version = Date.now();
        const path = `${user?.id ?? 'system'}/project-logo-${version}.${ext}`;
        try {
          await settingsHubService.uploadCompanyLogo(path, logoFile);
        } catch (e: unknown) {
          setSaving(false);
          toast({
            title: isRTL ? 'فشل رفع الشعار' : 'Logo upload failed',
            description: e instanceof Error ? e.message : String(e),
            variant: 'destructive',
          });
          return;
        }
        const { data: { publicUrl } } = settingsHubService.getCompanyLogoPublicUrl(path);
        logo_url = publicUrl;
      }

      const payload = {
        project_name_ar: nameAr,
        project_name_en: nameEn,
        default_language: defaultLang,
        logo_url,
        iqama_alert_days: iqamaAlertDays,
      };

      if (settings?.id) {
        const { error } = await supabase
          .from('system_settings')
          .update(payload)
          .eq('id', settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('system_settings')
          .insert(payload);
        if (error) throw error;
      }

      await refresh();
      setLogoFile(null);
      setRemoveLogo(false);
      toast({ title: isRTL ? 'تم الحفظ ✓' : 'Saved ✓', description: isRTL ? 'تم تحديث إعدادات المشروع' : 'Project settings updated' });
    } catch (err: unknown) {
      logError('[ProjectSettings] save failed', err);
      toast({ title: isRTL ? 'خطأ' : 'Error', description: getErrorMessage(err), variant: 'destructive' });
    }
    setSaving(false);
  };

  // ── Backup Handler ──
  const handleBackup = async () => {
    setBackupLoading(true);
    try {
      const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm');

      const tables = [
        'employees',
        'attendance',
        'advances',
        'advance_installments',
        'daily_orders',
        'employee_apps',
        'apps',
        'salary_schemes',
        'salary_records',
        'external_deductions',
        'vehicles',
        'vehicle_assignments',
        'alerts',
      ] as const;

      const results: Record<string, unknown[]> = {};

      await Promise.all(
        tables.map(async (table) => {
          const rows = await settingsHubService.exportTableRows(table);
          results[table] = rows;
        })
      );

      const exportedCount = Object.keys(results).filter(k => results[k].length >= 0).length;

      // ── Export JSON ──
      const jsonBlob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
      const jsonUrl = URL.createObjectURL(jsonBlob);
      const jsonLink = document.createElement('a');
      jsonLink.href = jsonUrl;
      jsonLink.download = `backup_${timestamp}.json`;
      jsonLink.click();
      URL.revokeObjectURL(jsonUrl);

      // ── Export Excel ──
      const wb = XLSX.utils.book_new();
      for (const table of tables) {
        const sheetData = results[table];
        if (sheetData.length > 0) {
          const ws = XLSX.utils.json_to_sheet(sheetData);
          XLSX.utils.book_append_sheet(wb, ws, table.slice(0, 31)); // Excel sheet name max 31 chars
        } else {
          // empty sheet with header
          const ws = XLSX.utils.json_to_sheet([{}]);
          XLSX.utils.book_append_sheet(wb, ws, table.slice(0, 31));
        }
      }
      XLSX.writeFile(wb, `backup_${timestamp}.xlsx`);

      toast({
        title: isRTL ? '✅ تم التصدير بنجاح' : '✅ Backup exported',
        description: isRTL
          ? `تم تصدير ${exportedCount} جدول — JSON + Excel`
          : `Exported ${exportedCount} tables — JSON + Excel`,
      });
    } catch (err: unknown) {
      logError('[ProjectSettings] backup export failed', err);
      toast({ title: isRTL ? 'خطأ' : 'Error', description: getErrorMessage(err), variant: 'destructive' });
    }
    setBackupLoading(false);
  };

  const SectionHeader = ({ icon, title }: { icon: React.ReactNode; title: string }) => (
    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border">
      <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">{icon}</div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    </div>
  );

  return (
    <div className="max-w-2xl space-y-6">
      {/* Project Name */}
      <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
        <SectionHeader icon={<Building2 size={14} />} title={isRTL ? 'اسم المشروع' : 'Project Name'} />
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">
                {isRTL ? 'اسم المشروع (عربي)' : 'Project Name (Arabic)'}
              </Label>
              <Input value={nameAr} onChange={e => setNameAr(e.target.value)} placeholder="مهمة التوصيل" dir="rtl" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">
                {isRTL ? 'اسم المشروع (إنجليزي)' : 'Project Name (English)'}
              </Label>
              <Input value={nameEn} onChange={e => setNameEn(e.target.value)} placeholder="Delivery System" dir="ltr" />
            </div>
          </div>
        </div>
      </div>

      {/* Logo */}
      <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
        <SectionHeader icon={<Upload size={14} />} title={isRTL ? 'شعار المشروع' : 'Project Logo'} />
        <div className="flex items-center gap-4">
          {logoPreview ? (
            <div className="relative">
              <img src={logoPreview} alt="logo" className="h-16 w-16 rounded-xl object-cover border border-border" />
              <button
                onClick={() => {
                  setLogoPreview(null);
                  setLogoFile(null);
                  setRemoveLogo(true);
                }}
                className="absolute -top-1.5 -end-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
              >
                <X size={10} />
              </button>
            </div>
          ) : (
            <div className="h-16 w-16 rounded-xl bg-muted flex items-center justify-center text-2xl border border-border border-dashed">
              🚀
            </div>
          )}
          <div>
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                className="hidden"
                onChange={handleLogoChange}
              />
              <Button variant="outline" size="sm" className="gap-2 pointer-events-none" asChild>
                <span><Upload size={13} /> {isRTL ? 'رفع شعار' : 'Upload Logo'}</span>
              </Button>
            </label>
            <p className="text-xs text-muted-foreground mt-1.5">
              {isRTL ? 'PNG، JPG، SVG — الحد الأقصى 2 ميغابايت' : 'PNG, JPG, SVG — Max 2MB'}
            </p>
          </div>
        </div>
      </div>

      {/* Language & Theme */}
      <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
        <SectionHeader icon={<Globe size={14} />} title={isRTL ? 'اللغة والمظهر' : 'Language & Theme'} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              {isRTL ? 'اللغة الافتراضية' : 'Default Language'}
            </Label>
            <div className="flex gap-2">
              {['ar', 'en'].map(l => (
                <button
                  key={l}
                  onClick={() => setDefaultLang(l)}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-sm font-medium border transition-colors',
                    defaultLang === l
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                  )}
                >
                  {l === 'ar' ? 'العربية' : 'English'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              {isRTL ? 'مظهر النظام' : 'System Theme'}
            </Label>
            <div className="flex gap-2">
              {[
                { key: 'light', labelAr: '☀️ فاتح', labelEn: '☀️ Light' },
                { key: 'dark', labelAr: '🌙 داكن', labelEn: '🌙 Dark' },
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => { if ((isDark ? 'dark' : 'light') !== opt.key) toggleTheme(); }}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-sm font-medium border transition-colors',
                    (isDark ? 'dark' : 'light') === opt.key
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                  )}
                >
                  {isRTL ? opt.labelAr : opt.labelEn}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Alert Settings ── */}
      <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
        <SectionHeader icon={<Bell size={14} />} title={isRTL ? 'إعدادات التنبيهات' : 'Alert Settings'} />
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Label className="text-xs font-medium text-muted-foreground">
              {isRTL ? 'التنبيه بانتهاء الإقامة (حسابات المنصات) قبل' : 'Iqama expiry alert (platform accounts) before'}
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isRTL ? 'سيظهر تنبيه تلقائي عند اقتراب انتهاء إقامة حساب المنصة بهذا العدد من الأيام أو أقل.' : 'An automatic alert shows when a platform account iqama expires within this many days.'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Input
              type="number"
              min={1}
              max={365}
              value={iqamaAlertDays}
              onChange={e => setIqamaAlertDays(Math.max(1, Number.parseInt(e.target.value) || 90))}
              className="w-24 text-center"
            />
            <span className="text-sm text-muted-foreground">{isRTL ? 'يوم' : 'days'}</span>
          </div>
        </div>
      </div>

      {/* ── Backup Section (Admin only) ── */}
      {isAdmin && (
        <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
          <SectionHeader icon={<Database size={14} />} title={isRTL ? 'النسخ الاحتياطي' : 'Backup'} />
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-1">
                {isRTL
                  ? 'تحميل نسخة احتياطية كاملة من قاعدة البيانات تشمل: الموظفين، الحضور، السلف، الطلبات، الرواتب، المركبات، والتنبيهات.'
                  : 'Download a full database backup including: employees, attendance, advances, orders, salaries, vehicles, and alerts.'}
              </p>
              <p className="text-xs text-muted-foreground">
                {isRTL ? 'يُصدر ملفين: JSON + Excel' : 'Exports two files: JSON + Excel'}
              </p>
            </div>
            <Button
              onClick={handleBackup}
              disabled={backupLoading}
              variant="outline"
              className="gap-2 min-w-44 flex-shrink-0"
            >
              {backupLoading ? (
                <><Loader2 size={14} className="animate-spin" /> {isRTL ? 'جاري التصدير...' : 'Exporting...'}</>
              ) : (
                <><Download size={14} /> {isRTL ? 'تحميل نسخة احتياطية' : 'Download Backup'}</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2 min-w-32">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {isRTL ? 'حفظ الإعدادات' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
