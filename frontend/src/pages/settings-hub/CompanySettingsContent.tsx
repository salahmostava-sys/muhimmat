import { useState, useEffect } from 'react';
import { Building2, Save, Upload, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/LanguageContext';
import { useSystemSettings } from '@/context/SystemSettingsContext';
import { settingsHubService } from '@/services/settingsHubService';

const SectionHeader = ({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) => (
  <div className="flex items-center gap-3 pb-4 mb-5" style={{ borderBottom: '1px solid var(--ds-surface-container)' }}>
    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ background: 'rgba(38,66,230,0.08)', color: '#2642e6' }}>
      {icon}
    </div>
    <div>
      <h2 className="text-base font-bold" style={{ color: 'var(--ds-on-surface)' }}>{title}</h2>
      {subtitle && <p className="text-xs" style={{ color: 'var(--ds-on-surface-variant)' }}>{subtitle}</p>}
    </div>
  </div>
);

export default function CompanySettingsContent() {
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const { settings, refresh } = useSystemSettings();

  const [recordId, setRecordId] = useState<string | null>(null);
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [crNumber, setCrNumber] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [savingLogo, setSavingLogo] = useState(false);

  useEffect(() => {
    if (settings?.logo_url) setLogoPreview(settings.logo_url);
  }, [settings]);

  useEffect(() => {
    settingsHubService.getTradeRegister()
      .then(({ data }) => {
        if (data) {
          setRecordId(data.id);
          setNameAr(data.name || '');
          setNameEn(data.name_en || '');
          setCrNumber(data.cr_number || '');
          setTaxNumber(data.notes || '');
        }
        setLoading(false);
      });
  }, []);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: isRTL ? 'الملف كبير جداً — الحد الأقصى 2 ميغابايت' : 'File too large — Max 2MB', variant: 'destructive' });
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleSaveLogo = async () => {
    if (!logoFile || !settings?.id) return;
    setSavingLogo(true);
    try {
      const ext = logoFile.name.split('.').pop();
      const path = `logo/project-logo.${ext}`;
      const { error: upErr } = await settingsHubService.uploadCompanyLogo(path, logoFile);
      if (upErr) throw upErr;
      const { data: { publicUrl } } = settingsHubService.getCompanyLogoPublicUrl(path);
      const { error } = await settingsHubService.updateSystemLogo(settings.id, publicUrl);
      if (error) throw error;
      await refresh();
      setLogoFile(null);
      toast({ title: isRTL ? 'تم حفظ الشعار ✓' : 'Logo saved ✓' });
    } catch (err: any) {
      toast({ title: isRTL ? 'خطأ' : 'Error', description: err.message, variant: 'destructive' });
    }
    setSavingLogo(false);
  };

  const handleRemoveLogo = async () => {
    if (!settings?.id) return;
    const { error } = await settingsHubService.updateSystemLogo(settings.id, null);
    if (!error) { setLogoPreview(null); setLogoFile(null); await refresh(); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        name: nameAr.trim(),
        name_en: nameEn.trim(),
        cr_number: crNumber.trim(),
        notes: taxNumber.trim(),
      };
      if (recordId) {
        const { error } = await settingsHubService.updateTradeRegister(recordId, payload);
        if (error) throw error;
      } else {
        const { data, error } = await settingsHubService.createTradeRegister(payload);
        if (error) throw error;
        if (data) setRecordId(data.id);
      }
      toast({ title: isRTL ? 'تم الحفظ ✓' : 'Saved ✓', description: isRTL ? 'تم تحديث بيانات المنشأة' : 'Organization info updated' });
    } catch (err: any) {
      toast({ title: isRTL ? 'خطأ' : 'Error', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 size={28} className="animate-spin text-primary" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl" dir={isRTL ? 'rtl' : 'ltr'}>
      <SectionHeader
        icon={<Building2 size={20} />}
        title={isRTL ? 'بيانات المنشأة' : 'Organization Info'}
        subtitle={isRTL ? 'المعلومات الأساسية التي تظهر في التقارير والفواتير' : 'Basic information shown in reports and invoices'}
      />

      {/* Names */}
      <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {isRTL ? 'اسم المؤسسة' : 'Organization Name'}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              {isRTL ? 'اسم المؤسسة (بالعربية)' : 'Organization Name (Arabic)'}
            </Label>
            <Input value={nameAr} onChange={e => setNameAr(e.target.value)} placeholder="شركة المنسق الرقمي" dir="rtl" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              {isRTL ? 'اسم المؤسسة (بالإنجليزية)' : 'Organization Name (English)'}
            </Label>
            <Input value={nameEn} onChange={e => setNameEn(e.target.value)} placeholder="Digital Coordinator Logistics" dir="ltr" />
          </div>
        </div>
      </div>

      {/* Registration Numbers */}
      <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {isRTL ? 'الأرقام الرسمية' : 'Official Numbers'}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              {isRTL ? 'السجل التجاري' : 'Commercial Registration'}
            </Label>
            <Input value={crNumber} onChange={e => setCrNumber(e.target.value)} placeholder="1010101010" dir="ltr" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              {isRTL ? 'الرقم الضريبي' : 'Tax Number'}
            </Label>
            <Input value={taxNumber} onChange={e => setTaxNumber(e.target.value)} placeholder="3000524140003" dir="ltr" />
          </div>
        </div>
      </div>

      {/* Logo */}
      <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {isRTL ? 'شعار الشركة' : 'Company Logo'}
        </p>
        <div className="flex items-center gap-4">
          {logoPreview ? (
            <div className="relative">
              <img src={logoPreview} alt="logo" className="h-16 w-16 rounded-xl object-cover border border-border" />
              <button
                onClick={handleRemoveLogo}
                className="absolute -top-1.5 -end-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
              >
                <X size={10} />
              </button>
            </div>
          ) : (
            <div className="h-16 w-16 rounded-xl bg-muted flex items-center justify-center text-2xl border border-dashed border-border">
              🏢
            </div>
          )}
          <div className="flex-1 space-y-2">
            <label className="cursor-pointer">
              <input type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" className="hidden" onChange={handleLogoChange} />
              <Button variant="outline" size="sm" className="gap-2 pointer-events-none w-full" asChild>
                <span><Upload size={13} /> {isRTL ? 'اختيار شعار' : 'Choose Logo'}</span>
              </Button>
            </label>
            <p className="text-[11px] text-muted-foreground">
              {isRTL ? 'PNG أو SVG — الحد الأقصى 2MB' : 'PNG or SVG — Max 2MB'}
            </p>
            {logoFile && (
              <Button size="sm" onClick={handleSaveLogo} disabled={savingLogo} className="w-full gap-2">
                {savingLogo ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                {isRTL ? 'رفع الشعار' : 'Upload Logo'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2 min-w-36">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {isRTL ? 'حفظ البيانات' : 'Save Info'}
        </Button>
      </div>
    </div>
  );
}
