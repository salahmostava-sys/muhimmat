/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, useCallback } from 'react';
import { X, Upload, CheckCircle, AlertTriangle, XCircle, Info, Download, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { employeeService } from '@/services/employeeService';
import * as XLSX from '@e965/xlsx';

// ─── Types ───────────────────────────────────────────────────────────────────
interface ParsedEmployee {
  employee_code?: string;
  national_id?: string;
  base_salary?: number | null;
  city?: 'makkah' | 'jeddah' | null;
  job_title?: string;
  sponsorship_status?: 'sponsored' | 'not_sponsored' | 'absconded' | 'terminated';
  name: string;
  platform?: string | null;
  status: 'active' | 'inactive';
  phone?: string;
  nationality?: string;
  birth_date?: string | null;
  email?: string;
  salary_type: 'orders' | 'shift';
  rowCategory: 'active_delivery' | 'accident' | 'absconded' | 'supervisor';
  _rowIndex: number;
  _errors: string[];
  _warnings: string[];
}

interface ImportSummary {
  active_delivery: number;
  accident: number;
  absconded: number;
  supervisor: number;
  errors: number;
  warnings: number;
}

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const parseCity = (val: string | undefined): 'makkah' | 'jeddah' | null => {
  if (!val) return null;
  const v = val.trim();
  if (['جدة', 'جده', 'جدّة'].includes(v)) return 'jeddah';
  if (['مكة', 'مكه', 'مكّة', 'مكه المكرمة', 'مكة المكرمة'].includes(v)) return 'makkah';
  return null;
};

const parseSponsorFromCol7 = (val: string | undefined): 'sponsored' | 'not_sponsored' | null => {
  if (!val) return null;
  const v = val.trim();
  if (v.includes('على الكفال')) return 'sponsored';
  if (v.includes('مش على') || v.includes('ليس على')) return 'not_sponsored';
  return null;
};

const PLATFORM_MAP: Record<string, string> = {
  'هنجر': 'هنقرستيشن',
  'هنقرستيشن': 'هنقرستيشن',
  'جاهز': 'جاهز',
  'كيتا': 'كيتا',
  'تويو': 'توبو',
  'توبو': 'توبو',
  'نينجا': 'نينجا',
};

const SUPERVISOR_KEYWORDS = ['ميكانيكى', 'ميكانيكي', 'مشرف', 'مشرف تشغيل', 'مشرف ميداني', 'غرفه عمليات', 'غرفة عمليات'];

const parseDate = (val: any): string | null => {
  if (!val) return null;
  if (typeof val === 'number') {
    const date = XLSX.SSF.parse_date_code(val);
    if (date) {
      const d = new Date(date.y, date.m - 1, date.d);
      return d.toISOString().split('T')[0];
    }
    return null;
  }
  if (typeof val === 'string') {
    const s = val.trim();
    if (!s) return null;
    const match1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match1) {
      const d = new Date(`${match1[3]}-${match1[2].padStart(2,'0')}-${match1[1].padStart(2,'0')}`);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
    const match2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match2) return s;
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  return null;
};

const isValidPhone = (phone?: string) => !phone || /^[0-9+\s-]{7,15}$/.test(phone);
const isValidEmail = (email?: string) => !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidNationalId = (id?: string) => !id || /^[0-9]{10}$/.test(id);

const parseRow = (row: any[], rowIndex: number): ParsedEmployee | null => {
  const col = (i: number) => {
    const v = row[i - 1];
    return v !== undefined && v !== null ? String(v).trim() : undefined;
  };
  const colRaw = (i: number) => row[i - 1];

  const name = col(8);
  if (!name) return null;

  const _errors: string[] = [];
  const _warnings: string[] = [];

  const employee_code = col(2) || undefined;
  const national_id = col(3) || undefined;
  const salaryRaw = colRaw(4);
  const base_salary = salaryRaw !== undefined && salaryRaw !== '' && salaryRaw !== null
    ? parseFloat(String(salaryRaw)) || null
    : null;

  const cityCol5 = parseCity(col(5));
  const cityCol10 = parseCity(col(10));
  const city = cityCol5 || cityCol10;

  const job_title = col(6) || undefined;
  const sponsorCol7 = parseSponsorFromCol7(col(7));

  const platformRaw = col(9) || '';
  const phone = col(11) ? col(11)!.replace(/\s/g, '') : undefined;
  const nationality = col(12) || undefined;
  const birth_date = parseDate(colRaw(13));
  const email = col(14) || undefined;

  // Validation
  if (!national_id) _warnings.push('رقم الهوية مفقود');
  else if (!isValidNationalId(national_id)) _errors.push('رقم الهوية يجب أن يكون 10 أرقام');

  if (phone && !isValidPhone(phone)) _warnings.push('رقم الهاتف قد يكون غير صحيح');
  if (email && !isValidEmail(email)) _errors.push('البريد الإلكتروني غير صحيح');
  if (!city) _warnings.push('المدينة غير محددة');
  if (base_salary !== null && base_salary < 0) _errors.push('الراتب لا يمكن أن يكون سالباً');

  const salary_type: 'orders' | 'shift' = job_title?.includes('مندوب') ? 'orders' : 'shift';

  let platform: string | null = null;
  let status: 'active' | 'inactive' = 'active';
  let sponsorship_status: 'sponsored' | 'not_sponsored' | 'absconded' | 'terminated' = sponsorCol7 || 'not_sponsored';
  let rowCategory: ParsedEmployee['rowCategory'] = 'active_delivery';

  if (PLATFORM_MAP[platformRaw]) {
    platform = PLATFORM_MAP[platformRaw];
    status = 'active';
    rowCategory = 'active_delivery';
  } else if (platformRaw === 'حادث') {
    status = 'inactive';
    platform = null;
    rowCategory = 'accident';
  } else if (platformRaw === 'هروب') {
    status = 'inactive';
    sponsorship_status = 'absconded';
    platform = null;
    rowCategory = 'absconded';
  } else if (SUPERVISOR_KEYWORDS.some(k => platformRaw.includes(k))) {
    status = 'active';
    platform = null;
    rowCategory = 'supervisor';
  } else if (platformRaw === '') {
    rowCategory = 'supervisor';
  }

  return {
    employee_code,
    national_id,
    base_salary,
    city,
    job_title,
    sponsorship_status,
    name,
    platform,
    status,
    phone,
    nationality,
    birth_date,
    email,
    salary_type,
    rowCategory,
    _rowIndex: rowIndex,
    _errors,
    _warnings,
  };
};

// ─── Component ────────────────────────────────────────────────────────────────
const ImportEmployeesModal = ({ onClose, onSuccess }: Props) => {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedEmployee[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [errors, setErrors] = useState<{ name: string; error: string }[]>([]);
  const [showAllRows, setShowAllRows] = useState(false);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'errors' | 'warnings'>('all');

  const handleFile = useCallback((file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        let startRow = 1;
        for (let i = 0; i < Math.min(5, rows.length); i++) {
          const nameCell = rows[i][7];
          if (nameCell && typeof nameCell === 'string' && nameCell.trim().length > 1 && !/اسم|name/i.test(nameCell)) {
            startRow = i;
            break;
          }
        }

        const employees: ParsedEmployee[] = [];
        for (let i = startRow; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.every((c: any) => !c)) continue;
          const emp = parseRow(row, i + 1);
          if (emp) employees.push(emp);
        }

        const sum: ImportSummary = {
          active_delivery: employees.filter(e => e.rowCategory === 'active_delivery').length,
          accident: employees.filter(e => e.rowCategory === 'accident').length,
          absconded: employees.filter(e => e.rowCategory === 'absconded').length,
          supervisor: employees.filter(e => e.rowCategory === 'supervisor').length,
          errors: employees.filter(e => e._errors.length > 0).length,
          warnings: employees.filter(e => e._warnings.length > 0).length,
        };

        setParsed(employees);
        setSummary(sum);
        setStep(2);
      } catch (err: any) {
        toast({ title: 'خطأ في قراءة الملف', description: err.message, variant: 'destructive' });
      }
    };
    reader.readAsArrayBuffer(file);
  }, [toast]);

  const handleConfirm = async () => {
    const criticalErrors = parsed.filter(e => e._errors.length > 0);
    if (criticalErrors.length > 0 && !window.confirm(`يوجد ${criticalErrors.length} صف به أخطاء. هل تريد الاستمرار وتخطّي هذه الصفوف؟`)) return;

    setImporting(true);
    setStep(3);
    setProgress(0);
    const importErrors: { name: string; error: string }[] = [];
    const validRows = parsed.filter(e => e._errors.length === 0);
    const total = validRows.length;
    const BATCH = 20;

    const { data: appsData } = await employeeService.getActiveApps();
    const appsMap: Record<string, string> = {};
    (appsData || []).forEach(a => { appsMap[a.name] = a.id; });

    let done = 0;

    for (let i = 0; i < validRows.length; i += BATCH) {
      const batch = validRows.slice(i, i + BATCH);

      for (const emp of batch) {
        try {
          const payload: Record<string, any> = {
            name: emp.name,
            status: emp.status,
            salary_type: emp.salary_type,
            base_salary: emp.base_salary ?? 0,
            sponsorship_status: emp.sponsorship_status,
          };
          if (emp.employee_code) payload.employee_code = emp.employee_code;
          if (emp.national_id) payload.national_id = emp.national_id;
          if (emp.city) payload.city = emp.city;
          if (emp.job_title) payload.job_title = emp.job_title;
          if (emp.phone) payload.phone = emp.phone;
          if (emp.nationality) payload.nationality = emp.nationality;
          if (emp.birth_date) payload.birth_date = emp.birth_date;
          if (emp.email) payload.email = emp.email;

          let empId: string | null = null;

          if (emp.employee_code) {
            const { data: existing } = await employeeService.findByEmployeeCode(emp.employee_code);
            if (existing) {
              await employeeService.updateEmployee(existing.id, payload);
              empId = existing.id;
            }
          }

          if (!empId && emp.national_id) {
            const { data: existing } = await employeeService.findByNationalId(emp.national_id);
            if (existing) {
              await employeeService.updateEmployee(existing.id, payload);
              empId = existing.id;
            }
          }

          if (!empId) {
            payload.status = payload.status || 'active';
            const { data: newEmp } = await employeeService.createEmployee(payload);
            empId = (newEmp as { id: string } | null)?.id;
          }

          if (empId && emp.platform && appsMap[emp.platform]) {
            const appId = appsMap[emp.platform];
            await employeeService.upsertEmployeeApp(empId, appId);
          }
        } catch (err: any) {
          importErrors.push({ name: emp.name, error: err.message });
        }

        done++;
        const pct = Math.round((done / total) * 100);
        setProgress(pct);
        setProgressLabel(`جاري الاستيراد... ${done}/${total}`);
      }
    }

    setErrors(importErrors);
    setImporting(false);

    if (importErrors.length === 0) {
      toast({ title: `✅ تم استيراد ${total} موظف بنجاح` });
      onSuccess();
    } else {
      toast({
        title: `⚠️ فشل ${importErrors.length} موظف`,
        description: 'يمكنك تحميل تقرير الأخطاء',
        variant: 'destructive',
      });
    }
  };

  const downloadErrorReport = () => {
    const ws = XLSX.utils.json_to_sheet(errors);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'أخطاء');
    XLSX.writeFile(wb, 'import_errors.xlsx');
  };

  const rowCategoryLabel = (emp: ParsedEmployee) => {
    if (emp.rowCategory === 'active_delivery') return { text: 'نشط — مندوب', cls: 'badge-success' };
    if (emp.rowCategory === 'accident') return { text: 'موقوف — حادث', cls: 'badge-warning' };
    if (emp.rowCategory === 'absconded') return { text: 'هروب', cls: 'badge-urgent' };
    return { text: 'مشرف/ميكانيكي', cls: 'bg-muted text-muted-foreground text-xs font-medium px-2 py-0.5 rounded-full' };
  };

  // Filter for preview
  const filteredRows = previewFilter === 'errors'
    ? parsed.filter(e => e._errors.length > 0)
    : previewFilter === 'warnings'
    ? parsed.filter(e => e._warnings.length > 0 && e._errors.length === 0)
    : parsed;

  const displayRows = showAllRows ? filteredRows : filteredRows.slice(0, 15);
  const criticalCount = parsed.filter(e => e._errors.length > 0).length;
  const warningCount = parsed.filter(e => e._warnings.length > 0).length;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col border border-border/50">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-lg font-bold text-foreground">استيراد بيانات الموظفين</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg text-muted-foreground">
            <X size={18} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-0 px-6 pt-4 pb-2 shrink-0">
          {['رفع الملف', 'معاينة وتحقق', 'استيراد'].map((s, i) => (
            <div key={s} className="flex items-center flex-1 last:flex-none">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i + 1 < step ? 'bg-success text-success-foreground' : i + 1 === step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {i + 1 < step ? <CheckCircle size={14} /> : i + 1}
                </div>
                <span className={`text-xs hidden sm:block ${i + 1 === step ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>{s}</span>
              </div>
              {i < 2 && <div className={`flex-1 h-px mx-2 ${i + 1 < step ? 'bg-success' : 'bg-border'}`} />}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">

          {/* ── Step 1: Upload ── */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                يدعم الملف بصيغة بيانات الموظفين الحالية (78 موظف أو أكثر)
              </p>
              <div
                className="border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-10 text-center cursor-pointer transition-colors"
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              >
                <Upload size={32} className="mx-auto text-muted-foreground mb-3" />
                <p className="font-medium text-foreground">اضغط لاختيار ملف أو اسحبه هنا</p>
                <p className="text-xs text-muted-foreground mt-1">xlsx أو xls فقط</p>
                {fileName && <p className="mt-2 text-sm text-primary font-medium">📄 {fileName}</p>}
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>
          )}

          {/* ── Step 2: Preview + Validation ── */}
          {step === 2 && summary && (
            <div className="space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-success/10 rounded-xl p-3 text-center">
                  <CheckCircle size={18} className="text-success mx-auto mb-1" />
                  <p className="text-xl font-bold text-success">{summary.active_delivery}</p>
                  <p className="text-xs text-muted-foreground">✅ مندوب توصيل نشط</p>
                </div>
                <div className="bg-warning/10 rounded-xl p-3 text-center">
                  <AlertTriangle size={18} className="text-warning mx-auto mb-1" />
                  <p className="text-xl font-bold text-warning">{summary.accident}</p>
                  <p className="text-xs text-muted-foreground">⚠️ حادث (موقوف)</p>
                </div>
                <div className="bg-destructive/10 rounded-xl p-3 text-center">
                  <XCircle size={18} className="text-destructive mx-auto mb-1" />
                  <p className="text-xl font-bold text-destructive">{summary.absconded}</p>
                  <p className="text-xs text-muted-foreground">🔴 هروب (غير نشط)</p>
                </div>
                <div className="bg-muted rounded-xl p-3 text-center">
                  <Info size={18} className="text-muted-foreground mx-auto mb-1" />
                  <p className="text-xl font-bold text-foreground">{summary.supervisor}</p>
                  <p className="text-xs text-muted-foreground">ℹ️ مشرف/ميكانيكي</p>
                </div>
              </div>

              {/* Validation summary */}
              {(criticalCount > 0 || warningCount > 0) && (
                <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
                  <p className="text-sm font-semibold text-foreground">نتائج التحقق من البيانات</p>
                  <div className="flex flex-wrap gap-2">
                    {criticalCount > 0 && (
                      <span className="flex items-center gap-1.5 text-xs bg-destructive/10 text-destructive border border-destructive/20 px-3 py-1.5 rounded-full font-medium">
                        <AlertCircle size={13} />
                        {criticalCount} صف به أخطاء — سيتم تخطّيها
                      </span>
                    )}
                    {warningCount > 0 && (
                      <span className="flex items-center gap-1.5 text-xs bg-warning/10 text-warning border border-warning/20 px-3 py-1.5 rounded-full font-medium">
                        <AlertTriangle size={13} />
                        {warningCount} صف به تحذيرات — ستُستورد مع إشارة
                      </span>
                    )}
                    <span className="flex items-center gap-1.5 text-xs bg-success/10 text-success border border-success/20 px-3 py-1.5 rounded-full font-medium">
                      <CheckCircle size={13} />
                      {parsed.length - criticalCount} صف جاهز للاستيراد
                    </span>
                  </div>
                </div>
              )}

              {/* Filter tabs */}
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {[
                    { key: 'all', label: `الكل (${parsed.length})` },
                    ...(criticalCount > 0 ? [{ key: 'errors', label: `🔴 أخطاء (${criticalCount})` }] : []),
                    ...(warningCount > 0 ? [{ key: 'warnings', label: `⚠️ تحذيرات (${warningCount})` }] : []),
                  ].map(f => (
                    <button
                      key={f.key}
                      onClick={() => { setPreviewFilter(f.key as 'all' | 'errors' | 'warnings'); setShowAllRows(false); }}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${previewFilter === f.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {showAllRows ? filteredRows.length : Math.min(15, filteredRows.length)} من {filteredRows.length} صف
                </p>
              </div>

              {/* Preview table */}
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-3 py-2 text-start text-muted-foreground font-medium whitespace-nowrap">#</th>
                      <th className="px-3 py-2 text-start text-muted-foreground font-medium whitespace-nowrap">الاسم</th>
                      <th className="px-3 py-2 text-start text-muted-foreground font-medium whitespace-nowrap">الكود</th>
                      <th className="px-3 py-2 text-start text-muted-foreground font-medium whitespace-nowrap">رقم الهوية</th>
                      <th className="px-3 py-2 text-start text-muted-foreground font-medium whitespace-nowrap">الراتب</th>
                      <th className="px-3 py-2 text-start text-muted-foreground font-medium whitespace-nowrap">المنصة</th>
                      <th className="px-3 py-2 text-start text-muted-foreground font-medium whitespace-nowrap">المدينة</th>
                      <th className="px-3 py-2 text-start text-muted-foreground font-medium whitespace-nowrap">الجنسية</th>
                      <th className="px-3 py-2 text-start text-muted-foreground font-medium whitespace-nowrap">الهاتف</th>
                      <th className="px-3 py-2 text-start text-muted-foreground font-medium whitespace-nowrap">الحالة</th>
                      <th className="px-3 py-2 text-start text-muted-foreground font-medium whitespace-nowrap">تحقق</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayRows.map((emp, i) => {
                      const st = rowCategoryLabel(emp);
                      const hasError = emp._errors.length > 0;
                      const hasWarning = emp._warnings.length > 0;
                      return (
                        <tr
                          key={i}
                          className={`border-b border-border/50 ${hasError ? 'bg-destructive/5' : hasWarning ? 'bg-warning/5' : 'hover:bg-muted/20'}`}
                        >
                          <td className="px-3 py-2 text-muted-foreground">{emp._rowIndex}</td>
                          <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">{emp.name}</td>
                          <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{emp.employee_code || '—'}</td>
                          <td className={`px-3 py-2 whitespace-nowrap font-mono text-xs ${emp._errors.some(e => e.includes('هوية')) ? 'text-destructive' : 'text-muted-foreground'}`}>
                            {emp.national_id || <span className="text-warning">⚠️ مفقود</span>}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                            {emp.base_salary !== null && emp.base_salary !== undefined ? `${emp.base_salary.toLocaleString()} ر.س` : '—'}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{emp.platform || '—'}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {emp.city === 'makkah'
                              ? <span className="bg-accent/20 text-accent-foreground px-1.5 py-0.5 rounded text-xs">مكة</span>
                              : emp.city === 'jeddah'
                              ? <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-xs">جدة</span>
                              : <span className="text-warning text-xs">⚠️ غير محدد</span>}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{emp.nationality || '—'}</td>
                          <td className={`px-3 py-2 whitespace-nowrap font-mono text-xs ${emp._warnings.some(w => w.includes('هاتف')) ? 'text-warning' : 'text-muted-foreground'}`}>
                            {emp.phone || '—'}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap"><span className={st.cls}>{st.text}</span></td>
                          <td className="px-3 py-2 whitespace-nowrap min-w-[160px]">
                            {hasError ? (
                              <div className="space-y-0.5">
                                {emp._errors.map((e, ei) => (
                                  <div key={ei} className="flex items-center gap-1 text-destructive">
                                    <AlertCircle size={10} className="flex-shrink-0" />
                                    <span>{e}</span>
                                  </div>
                                ))}
                              </div>
                            ) : hasWarning ? (
                              <div className="space-y-0.5">
                                {emp._warnings.map((w, wi) => (
                                  <div key={wi} className="flex items-center gap-1 text-warning">
                                    <AlertTriangle size={10} className="flex-shrink-0" />
                                    <span>{w}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="flex items-center gap-1 text-success">
                                <CheckCircle size={11} /> صحيح
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filteredRows.length > 15 && !showAllRows && (
                <button
                  onClick={() => setShowAllRows(true)}
                  className="w-full text-xs text-muted-foreground hover:text-foreground py-2 border border-dashed border-border rounded-lg transition-colors"
                >
                  عرض جميع {filteredRows.length} صف...
                </button>
              )}
            </div>
          )}

          {/* ── Step 3: Progress / Done ── */}
          {step === 3 && (
            <div className="space-y-5 py-4">
              {importing ? (
                <>
                  <div className="flex items-center justify-center gap-3">
                    <Loader2 size={20} className="animate-spin text-primary" />
                    <p className="font-medium text-foreground">{progressLabel}</p>
                  </div>
                  <Progress value={progress} className="h-3" />
                  <p className="text-xs text-muted-foreground text-center">{progress}%</p>
                </>
              ) : (
                <div className="text-center space-y-3">
                  {errors.length === 0 ? (
                    <>
                      <CheckCircle size={48} className="text-success mx-auto" />
                      <p className="text-lg font-bold text-foreground">✅ تم استيراد {parsed.filter(e => e._errors.length === 0).length} موظف بنجاح</p>
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={48} className="text-warning mx-auto" />
                      <p className="text-lg font-bold text-foreground">
                        ✅ نجح {parsed.filter(e => e._errors.length === 0).length - errors.length} | ⚠️ فشل {errors.length}
                      </p>
                      <Button variant="outline" size="sm" onClick={downloadErrorReport} className="gap-2">
                        <Download size={14} /> تحميل تقرير الأخطاء
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border shrink-0">
          <div>
            {step === 2 && criticalCount > 0 && (
              <p className="text-xs text-destructive flex items-center gap-1.5">
                <AlertCircle size={13} />
                {criticalCount} صف سيتم تخطّيه بسبب أخطاء
              </p>
            )}
          </div>
          <div className="flex gap-3">
            {step === 1 && (
              <Button variant="outline" onClick={onClose}>إلغاء</Button>
            )}
            {step === 2 && (
              <>
                <Button variant="outline" onClick={() => setStep(1)}>رجوع</Button>
                <Button onClick={handleConfirm} className="gap-2" disabled={parsed.filter(e => e._errors.length === 0).length === 0}>
                  تأكيد استيراد {parsed.filter(e => e._errors.length === 0).length} موظف
                </Button>
              </>
            )}
            {step === 3 && !importing && (
              <Button onClick={onClose}>إغلاق</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportEmployeesModal;
