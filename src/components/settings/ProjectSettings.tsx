import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import { useSystemSettings } from '@/context/SystemSettingsContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Globe, Palette, Building2, Upload, X, Download, Database, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { usePermissions } from '@/hooks/usePermissions';

export default function ProjectSettings() {
  const { t } = useTranslation();
  const { lang } = useLanguage();
  const { isDark, toggleTheme } = useTheme();
  const { settings, refresh } = useSystemSettings();
  const { toast } = useToast();
  const { isAdmin } = usePermissions('settings');
  const isRTL = lang === 'ar';

  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [subtitleAr, setSubtitleAr] = useState('');
  const [subtitleEn, setSubtitleEn] = useState('');
  const [defaultLang, setDefaultLang] = useState('ar');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);

  useEffect(() => {
    if (settings) {
      setNameAr(settings.project_name_ar);
      setNameEn(settings.project_name_en);
      setSubtitleAr(settings.project_subtitle_ar);
      setSubtitleEn(settings.project_subtitle_en);
      setDefaultLang(settings.default_language);
      setLogoPreview(settings.logo_url);
    }
  }, [settings]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: isRTL ? 'الملف كبير جداً' : 'File too large', description: isRTL ? 'الحد الأقصى 2 ميغابايت' : 'Max 2MB', variant: 'destructive' });
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let logo_url = settings?.logo_url ?? null;

      if (logoFile) {
        const ext = logoFile.name.split('.').pop();
        const path = `logo/project-logo.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('avatars')
          .upload(path, logoFile, { upsert: true });
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
          logo_url = publicUrl;
        }
      }

      const payload = {
        project_name_ar: nameAr,
        project_name_en: nameEn,
        project_subtitle_ar: subtitleAr,
        project_subtitle_en: subtitleEn,
        default_language: defaultLang,
        logo_url,
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
      toast({ title: isRTL ? 'تم الحفظ ✓' : 'Saved ✓', description: isRTL ? 'تم تحديث إعدادات المشروع' : 'Project settings updated' });
    } catch (err: any) {
      toast({ title: isRTL ? 'خطأ' : 'Error', description: err.message, variant: 'destructive' });
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

      const results: Record<string, any[]> = {};

      await Promise.all(
        tables.map(async (table) => {
          const { data } = await supabase.from(table).select('*');
          results[table] = data || [];
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
    } catch (err: any) {
      toast({ title: isRTL ? 'خطأ' : 'Error', description: err.message, variant: 'destructive' });
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
              <Input value={nameAr} onChange={e => setNameAr(e.target.value)} placeholder="نظام التوصيل" dir="rtl" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">
                {isRTL ? 'اسم المشروع (إنجليزي)' : 'Project Name (English)'}
              </Label>
              <Input value={nameEn} onChange={e => setNameEn(e.target.value)} placeholder="Delivery System" dir="ltr" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">
                {isRTL ? 'العنوان الفرعي (عربي)' : 'Subtitle (Arabic)'}
              </Label>
              <Input value={subtitleAr} onChange={e => setSubtitleAr(e.target.value)} placeholder="إدارة المناديب" dir="rtl" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">
                {isRTL ? 'العنوان الفرعي (إنجليزي)' : 'Subtitle (English)'}
              </Label>
              <Input value={subtitleEn} onChange={e => setSubtitleEn(e.target.value)} placeholder="Rider Management" dir="ltr" />
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
                onClick={() => { setLogoPreview(null); setLogoFile(null); }}
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
