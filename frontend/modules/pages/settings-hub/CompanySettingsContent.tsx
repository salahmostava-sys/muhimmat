import { useState, useEffect } from 'react';
import { Building2, Save, Loader2 } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Label } from '@shared/components/ui/label';
import { useToast } from '@shared/hooks/use-toast';
import { useLanguage } from '@app/providers/LanguageContext';
import { settingsHubService } from '@services/settingsHubService';
import { getErrorMessage } from '@shared/lib/query';
import { logError } from '@shared/lib/logger';

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

  const [recordId, setRecordId] = useState<string | null>(null);
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [crNumber, setCrNumber] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    settingsHubService.getTradeRegister()
      .then((data) => {
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
        await settingsHubService.updateTradeRegister(recordId, payload);
      } else {
        const data = await settingsHubService.createTradeRegister(payload);
        if (data) setRecordId((data as { id: string }).id);
      }
      toast({ title: isRTL ? 'تم الحفظ ✓' : 'Saved ✓', description: isRTL ? 'تم تحديث بيانات المنشأة' : 'Organization info updated' });
    } catch (err: unknown) {
      logError('[CompanySettings] save trade register failed', err);
      toast({ title: isRTL ? 'خطأ' : 'Error', description: getErrorMessage(err), variant: 'destructive' });
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
