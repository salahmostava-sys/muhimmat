import { useState, useEffect } from 'react';
import { ArrowRight, User, FileText, Wallet, Bike, CreditCard, Clock, Package, DollarSign, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { differenceInDays, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useSignedUrl, extractStoragePath } from '@/hooks/useSignedUrl';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Employee {
  id: string;
  name: string;
  job_title?: string | null;
  phone?: string | null;
  email?: string | null;
  national_id?: string | null;
  employee_code?: string | null;
  iban?: string | null;
  bank_account_number?: string | null;
  city?: string | null;
  join_date?: string | null;
  dob?: string | null;
  birth_date?: string | null;
  residency_expiry?: string | null;
  health_insurance_expiry?: string | null;
  license_expiry?: string | null;
  license_status?: string | null;
  sponsorship_status?: string | null;
  probation_end_date?: string | null;
  nationality?: string | null;
  preferred_language?: string | null;
  id_photo_url?: string | null;
  license_photo_url?: string | null;
  personal_photo_url?: string | null;
  status: string;
  salary_type: string;
  base_salary: number;
  trade_register?: { id: string; name: string } | null;
}

interface Advance {
  id: string;
  amount: number;
  monthly_amount: number;
  disbursement_date: string;
  first_deduction_month: string;
  status: string;
  note?: string | null;
  advance_installments?: Installment[];
}

interface Installment {
  id: string;
  month_year: string;
  amount: number;
  status: string;
  deducted_at?: string | null;
}

interface SalaryRecord {
  id: string;
  month_year: string;
  base_salary: number;
  allowances: number;
  attendance_deduction: number;
  advance_deduction: number;
  external_deduction: number;
  manual_deduction: number;
  net_salary: number;
  is_approved: boolean;
}

interface EmployeeApp {
  id: string;
  app_id: string;
  status: string;
  username?: string | null;
  apps?: { name: string } | null;
}

interface Props {
  employee: Employee;
  onBack: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const statusLabels: Record<string, string> = {
  active: 'نشط', inactive: 'موقوف', ended: 'منتهي',
};
const statusStyles: Record<string, string> = {
  active: 'badge-success', inactive: 'badge-warning', ended: 'badge-urgent',
};

const advanceStatusLabel: Record<string, string> = {
  active: 'نشطة', completed: 'مكتملة', paused: 'موقوفة',
};
const advanceStatusStyle: Record<string, string> = {
  active: 'badge-warning', completed: 'badge-success', paused: 'badge-info',
};

const installmentStatusStyle: Record<string, string> = {
  deducted: 'badge-success', pending: 'badge-warning', deferred: 'bg-muted text-muted-foreground text-xs font-medium px-2.5 py-0.5 rounded-full',
};
const installmentStatusLabel: Record<string, string> = {
  deducted: 'مخصوم', pending: 'معلّق', deferred: 'مؤجل',
};

// ─── Secure Document Thumbnail ────────────────────────────────────────────────
// Uses signed URLs for private employee-documents bucket
const SecureDocThumb = ({
  storagePath, label,
}: { storagePath: string | null | undefined; label: string }) => {
  const path = extractStoragePath(storagePath);
  const signedUrl = useSignedUrl('employee-documents', path);

  if (!path) return null;

  return (
    <div className="flex flex-col items-center gap-1">
      {signedUrl ? (
        <a href={signedUrl} target="_blank" rel="noreferrer" className="group">
          <img
            src={signedUrl}
            className="w-20 h-20 object-cover rounded-lg border border-border group-hover:opacity-80 transition-opacity"
            alt={label}
          />
        </a>
      ) : (
        <div className="w-20 h-20 rounded-lg border border-border bg-muted flex items-center justify-center">
          <Loader2 size={16} className="animate-spin text-muted-foreground" />
        </div>
      )}
      <p className="text-xs text-center text-muted-foreground">{label}</p>
      {signedUrl && (
        <a
          href={signedUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-0.5 text-[10px] text-primary hover:underline"
        >
          <ExternalLink size={9} /> فتح
        </a>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const EmployeeProfile = ({ employee, onBack }: Props) => {
  const [activeTab, setActiveTab] = useState('basic');
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [salaries, setSalaries] = useState<SalaryRecord[]>([]);
  const [employeeApps, setEmployeeApps] = useState<EmployeeApp[]>([]);
  const [expandedAdv, setExpandedAdv] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Signed URL for personal photo (used in profile header)
  const personalPhotoPath = extractStoragePath(employee.personal_photo_url);
  const personalPhotoSigned = useSignedUrl('employee-documents', personalPhotoPath);

  const residencyDays = employee.residency_expiry
    ? differenceInDays(parseISO(employee.residency_expiry), new Date())
    : null;

  // Fetch related data when tabs accessed
  useEffect(() => {
    setLoading(true);
    Promise.all([
      supabase
        .from('advances')
        .select('*, advance_installments(*)')
        .eq('employee_id', employee.id)
        .order('disbursement_date', { ascending: false }),
      supabase
        .from('salary_records')
        .select('*')
        .eq('employee_id', employee.id)
        .order('month_year', { ascending: false }),
      supabase
        .from('employee_apps')
        .select('*, apps(name)')
        .eq('employee_id', employee.id),
    ]).then(([advRes, salRes, appRes]) => {
      if (advRes.data) setAdvances(advRes.data as Advance[]);
      if (salRes.data) setSalaries(salRes.data as SalaryRecord[]);
      if (appRes.data) setEmployeeApps(appRes.data as EmployeeApp[]);
      setLoading(false);
    });
  }, [employee.id]);

  return (
    <div className="space-y-5">
      {/* Back Button */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack} className="gap-2 text-muted-foreground">
          <ArrowRight size={16} />
          العودة للقائمة
        </Button>
      </div>

      {/* Profile Card */}
      <div className="bg-card rounded-xl border border-border/50 shadow-sm p-6">
        <div className="flex items-start gap-5 flex-wrap">
          <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0">
            {personalPhotoSigned ? (
              <img src={personalPhotoSigned} className="w-full h-full object-cover" alt="" />
            ) : employee.personal_photo_url ? (
              <div className="w-full h-full bg-muted flex items-center justify-center">
                <Loader2 size={16} className="animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="w-full h-full bg-primary/10 text-primary flex items-center justify-center text-2xl font-bold">
                {employee.name.charAt(0)}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-bold text-foreground">{employee.name}</h2>
              <span className={statusStyles[employee.status] || 'badge-info'}>{statusLabels[employee.status] || employee.status}</span>
              <span className={`badge-${employee.salary_type === 'orders' ? 'info' : 'success'}`}>
                {employee.salary_type === 'orders' ? 'طلبات' : 'دوام'}
              </span>
            </div>
            <div className="flex gap-4 mt-2 flex-wrap text-sm text-muted-foreground">
              {employee.phone && <span>📱 {employee.phone}</span>}
              {employee.national_id && <span>🪪 {employee.national_id}</span>}
              {employee.iban && <span>🏦 SA••••••••{employee.iban.slice(-4)}</span>}
            </div>
            <div className="flex gap-2 mt-3 flex-wrap">
              {employeeApps.map(ea => (
                <span key={ea.id} className="badge-info">{ea.apps?.name || ea.app_id}</span>
              ))}
            </div>
          </div>
          <div className="text-left">
            {residencyDays !== null && (
              <div className={`text-sm font-medium ${residencyDays < 30 ? 'text-destructive' : residencyDays < 60 ? 'text-warning' : 'text-success'}`}>
                الإقامة: {residencyDays < 0 ? 'منتهية' : `${residencyDays} يوم`}
              </div>
            )}
            {employee.job_title && (
              <div className="text-sm text-muted-foreground mt-1">{employee.job_title}</div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/50 flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="basic" className="gap-1.5"><User size={14} /> البيانات الأساسية</TabsTrigger>
          <TabsTrigger value="docs" className="gap-1.5"><FileText size={14} /> الوثائق والتواريخ</TabsTrigger>
          <TabsTrigger value="salary" className="gap-1.5"><Wallet size={14} /> الراتب</TabsTrigger>
          <TabsTrigger value="apps" className="gap-1.5"><Package size={14} /> التطبيقات</TabsTrigger>
          <TabsTrigger value="advances" className="gap-1.5"><CreditCard size={14} /> السلف</TabsTrigger>
          <TabsTrigger value="attendance" className="gap-1.5"><Clock size={14} /> الحضور</TabsTrigger>
          <TabsTrigger value="salaries" className="gap-1.5"><DollarSign size={14} /> الرواتب</TabsTrigger>
        </TabsList>

        {/* Tab 1: Basic Data */}
        <TabsContent value="basic">
          <div className="bg-card rounded-xl border border-border/50 shadow-sm p-6">
            <h3 className="font-semibold text-foreground mb-5">البيانات الأساسية</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <InfoField label="الاسم الكامل" value={employee.name} />
              {employee.employee_code && <InfoField label="كود الموظف" value={employee.employee_code} dir="ltr" />}
              {employee.phone && <InfoField label="رقم الهاتف" value={employee.phone} dir="ltr" />}
              {employee.national_id && <InfoField label="رقم الهوية" value={employee.national_id} dir="ltr" />}
              {employee.nationality && <InfoField label="الجنسية" value={employee.nationality} />}
              {employee.iban && <InfoField label="رقم IBAN" value={`SA••••••••${employee.iban.slice(-4)}`} />}
              {employee.bank_account_number && <InfoField label="رقم الحساب البنكي" value={employee.bank_account_number} dir="ltr" />}
              {employee.email && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">البريد الإلكتروني</p>
                  <a href={`mailto:${employee.email}`} className="text-sm font-medium text-primary hover:underline break-all">
                    {employee.email}
                  </a>
                </div>
              )}
              {(employee.birth_date || employee.dob) && <InfoField label="تاريخ الميلاد" value={(employee.birth_date || employee.dob)!} />}
              {employee.city && <InfoField label="المدينة" value={employee.city === 'makkah' ? 'مكة المكرمة' : 'جدة'} />}
              {employee.job_title && <InfoField label="المسمى الوظيفي" value={employee.job_title} />}
              {employee.join_date && <InfoField label="تاريخ الانضمام" value={employee.join_date} />}
              {employee.probation_end_date && <InfoField label="انتهاء فترة التجربة" value={employee.probation_end_date} />}
              {employee.trade_register?.name && <InfoField label="السجل التجاري" value={employee.trade_register.name} />}
              {employee.sponsorship_status && (
                <InfoField label="حالة الكفالة" value={{
                  sponsored: 'على الكفالة', not_sponsored: 'ليس على الكفالة',
                  absconded: 'هروب', terminated: 'انتهاء الخدمة',
                }[employee.sponsorship_status] || employee.sponsorship_status} />
              )}
              {employee.preferred_language && (
                <InfoField label="لغة كشف الراتب" value={{
                  ar: '🇸🇦 العربية', en: '🇬🇧 English', ur: '🇵🇰 اردو',
                }[employee.preferred_language] || employee.preferred_language} />
              )}
              <InfoField label="الحالة" value={statusLabels[employee.status] || employee.status} />
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Documents — uses Signed URLs for private bucket */}
        <TabsContent value="docs">
          <div className="bg-card rounded-xl border border-border/50 shadow-sm p-6">
            <h3 className="font-semibold text-foreground mb-5">الوثائق والتواريخ</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {employee.residency_expiry && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">تاريخ انتهاء الإقامة</p>
                  <p className={`text-sm font-medium ${residencyDays !== null && residencyDays < 30 ? 'text-destructive' : residencyDays !== null && residencyDays < 60 ? 'text-warning' : 'text-foreground'}`}>
                    {employee.residency_expiry}
                    {residencyDays !== null && residencyDays < 60 && (
                      <span className="mr-2 text-xs">({residencyDays} يوم متبق)</span>
                    )}
                  </p>
                </div>
              )}
              {employee.health_insurance_expiry && (() => {
                const hiDays = differenceInDays(parseISO(employee.health_insurance_expiry), new Date());
                return (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">تاريخ انتهاء التأمين الصحي</p>
                    <p className={`text-sm font-medium ${hiDays < 0 ? 'text-destructive' : hiDays < 30 ? 'text-destructive' : hiDays < 60 ? 'text-warning' : 'text-foreground'}`}>
                      {employee.health_insurance_expiry}
                      {hiDays < 60 && (
                        <span className="mr-2 text-xs">
                          {hiDays < 0 ? `(منتهي منذ ${Math.abs(hiDays)} يوم)` : `(${hiDays} يوم متبق)`}
                        </span>
                      )}
                    </p>
                  </div>
                );
              })()}
              {employee.license_expiry && (
                <InfoField label="تاريخ انتهاء رخصة القيادة" value={employee.license_expiry} />
              )}
              {employee.license_status && (
                <InfoField label="حالة الرخصة" value={{
                  has_license: 'لديه رخصة', no_license: 'ليس لديه رخصة', applied: 'تم التقديم',
                }[employee.license_status] || employee.license_status} />
              )}
            </div>

            {/* Secure document thumbnails — signed URLs only */}
            <div className="mt-5 flex gap-4 flex-wrap">
              <SecureDocThumb storagePath={employee.personal_photo_url} label="الصورة الشخصية" />
              <SecureDocThumb storagePath={employee.id_photo_url} label="صورة الهوية" />
              <SecureDocThumb storagePath={employee.license_photo_url} label="صورة الرخصة" />
            </div>

            <p className="mt-3 text-[11px] text-muted-foreground flex items-center gap-1">
              🔒 الوثائق محمية بروابط مؤقتة (5 دقائق)
            </p>
          </div>
        </TabsContent>

        {/* Tab 3: Salary */}
        <TabsContent value="salary">
          <div className="bg-card rounded-xl border border-border/50 shadow-sm p-6">
            <h3 className="font-semibold text-foreground mb-5">الراتب</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <InfoField label="نوع الراتب" value={employee.salary_type === 'orders' ? 'طلبات (Orders)' : 'دوام ثابت (Shift)'} />
              {employee.salary_type === 'shift' && (
                <InfoField label="الراتب الشهري" value={`${employee.base_salary?.toLocaleString()} ر.س`} />
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab 4: Apps */}
        <TabsContent value="apps">
          <div className="bg-card rounded-xl border border-border/50 shadow-sm p-6">
            <h3 className="font-semibold text-foreground mb-5">التطبيقات المرتبطة</h3>
            {loading ? (
              <p className="text-muted-foreground text-sm">جارٍ التحميل...</p>
            ) : employeeApps.length === 0 ? (
              <p className="text-muted-foreground text-sm">لا توجد تطبيقات مرتبطة</p>
            ) : (
              <div className="space-y-3">
                {employeeApps.map(ea => (
                  <div key={ea.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                        {(ea.apps?.name || '?').charAt(0)}
                      </div>
                      <div>
                        <span className="font-medium text-foreground">{ea.apps?.name || ea.app_id}</span>
                        {ea.username && <p className="text-xs text-muted-foreground">{ea.username}</p>}
                      </div>
                    </div>
                    <span className={ea.status === 'active' ? 'badge-success' : 'badge-warning'}>
                      {ea.status === 'active' ? 'نشط' : 'موقوف'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 5: Advances */}
        <TabsContent value="advances">
          <div className="bg-card rounded-xl border border-border/50 shadow-sm p-6">
            <h3 className="font-semibold text-foreground mb-5">السلف</h3>
            {loading ? (
              <p className="text-muted-foreground text-sm">جارٍ التحميل...</p>
            ) : advances.length === 0 ? (
              <p className="text-muted-foreground text-sm">لا توجد سلف مسجلة</p>
            ) : (
              <div className="space-y-3">
                {advances.map(adv => {
                  const paid = (adv.advance_installments || []).filter(i => i.status === 'deducted').reduce((s, i) => s + i.amount, 0);
                  const remaining = adv.amount - paid;
                  const isExpanded = expandedAdv === adv.id;
                  return (
                    <div key={adv.id} className="border border-border/50 rounded-lg overflow-hidden">
                      <div
                        className="p-4 bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors"
                        onClick={() => setExpandedAdv(isExpanded ? null : adv.id)}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-foreground">{adv.amount.toLocaleString()} ر.س</p>
                            <p className="text-sm text-muted-foreground">قسط شهري: {adv.monthly_amount.toLocaleString()} ر.س · تاريخ الصرف: {adv.disbursement_date}</p>
                          </div>
                          <span className={advanceStatusStyle[adv.status] || 'badge-info'}>
                            {advanceStatusLabel[adv.status] || adv.status}
                          </span>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          مدفوع: {paid.toLocaleString()} ر.س — متبقي: {remaining.toLocaleString()} ر.س
                        </div>
                        {adv.note && <p className="mt-1 text-xs text-muted-foreground">📝 {adv.note}</p>}
                      </div>
                      {isExpanded && adv.advance_installments && adv.advance_installments.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-t border-border/30 bg-muted/10">
                                <th className="text-right p-2 text-muted-foreground">الشهر</th>
                                <th className="text-right p-2 text-muted-foreground">المبلغ</th>
                                <th className="text-right p-2 text-muted-foreground">الحالة</th>
                                <th className="text-right p-2 text-muted-foreground">تاريخ الخصم</th>
                              </tr>
                            </thead>
                            <tbody>
                              {adv.advance_installments.map(inst => (
                                <tr key={inst.id} className="border-t border-border/20">
                                  <td className="p-2">{inst.month_year}</td>
                                  <td className="p-2">{inst.amount.toLocaleString()} ر.س</td>
                                  <td className="p-2">
                                    <span className={installmentStatusStyle[inst.status] || ''}>
                                      {installmentStatusLabel[inst.status] || inst.status}
                                    </span>
                                  </td>
                                  <td className="p-2 text-muted-foreground">{inst.deducted_at ? inst.deducted_at.slice(0, 10) : '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 6: Attendance */}
        <TabsContent value="attendance">
          <div className="bg-card rounded-xl border border-border/50 shadow-sm p-6">
            <h3 className="font-semibold text-foreground mb-5">سجل الحضور</h3>
            <p className="text-muted-foreground text-sm">يمكن مراجعة سجل الحضور من صفحة الحضور والانصراف</p>
          </div>
        </TabsContent>

        {/* Tab 7: Salaries */}
        <TabsContent value="salaries">
          <div className="bg-card rounded-xl border border-border/50 shadow-sm p-6">
            <h3 className="font-semibold text-foreground mb-5">سجل الرواتب</h3>
            {loading ? (
              <p className="text-muted-foreground text-sm">جارٍ التحميل...</p>
            ) : salaries.length === 0 ? (
              <p className="text-muted-foreground text-sm">لا يوجد سجل رواتب</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-right p-3 text-muted-foreground">الشهر</th>
                      <th className="text-right p-3 text-muted-foreground">الأساسي</th>
                      <th className="text-right p-3 text-muted-foreground">البدلات</th>
                      <th className="text-right p-3 text-muted-foreground">الخصومات</th>
                      <th className="text-right p-3 text-muted-foreground font-semibold">الصافي</th>
                      <th className="text-right p-3 text-muted-foreground">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salaries.map(s => (
                      <tr key={s.id} className="border-b border-border/30">
                        <td className="p-3 font-medium">{s.month_year}</td>
                        <td className="p-3">{s.base_salary.toLocaleString()}</td>
                        <td className="p-3">{s.allowances.toLocaleString()}</td>
                        <td className="p-3 text-destructive">
                          -{(s.attendance_deduction + s.advance_deduction + s.external_deduction + s.manual_deduction).toLocaleString()}
                        </td>
                        <td className="p-3 font-semibold text-success">{s.net_salary.toLocaleString()} ر.س</td>
                        <td className="p-3">
                          <span className={s.is_approved ? 'badge-success' : 'badge-warning'}>
                            {s.is_approved ? 'معتمد' : 'معلق'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const InfoField = ({ label, value, dir }: { label: string; value: string; dir?: string }) => (
  <div>
    <p className="text-xs text-muted-foreground mb-1">{label}</p>
    <p className="text-sm font-medium text-foreground" dir={dir}>{value}</p>
  </div>
);

export default EmployeeProfile;
