// ─── Salary Slip Multi-Language Translation Dictionary ────────────────────────
// Supports: Arabic (ar) | English (en) | Urdu (ur)
// RTL languages: ar, ur  |  LTR languages: en

export type SlipLanguage = 'ar' | 'en' | 'ur';

export const LANGUAGE_META: Record<SlipLanguage, { label: string; dir: 'rtl' | 'ltr'; flag: string; fontFamily: string }> = {
  ar: { label: 'العربية',  dir: 'rtl', flag: '🇸🇦', fontFamily: 'Arial, sans-serif' },
  en: { label: 'English',  dir: 'ltr', flag: '🇬🇧', fontFamily: 'Arial, sans-serif' },
  ur: { label: 'اردو',     dir: 'rtl', flag: '🇵🇰', fontFamily: 'Arial, sans-serif' },
};

export interface SlipTranslations {
  // Header
  title: string;
  subtitle: string;
  // Employee Info
  sectionEmployee: string;
  name: string;
  nationalId: string;
  city: string;
  month: string;
  status: string;
  paymentMethod: string;
  // Status values
  statusPending: string;
  statusApproved: string;
  statusPaid: string;
  // Payment methods
  payBank: string;
  payCash: string;
  // Platforms
  sectionPlatforms: string;
  orders: string;
  platformTotal: string;
  // Additions
  sectionAdditions: string;
  incentives: string;
  sickAllowance: string;
  totalWithSalary: string;
  // Earnings section label
  sectionEarnings: string;
  // Deductions
  sectionDeductions: string;
  advanceInstallment: string;
  externalDeductions: string;
  violations: string;
  walletHunger: string;
  walletTuyo: string;
  walletJahiz: string;
  foodDamage: string;
  totalDeductions: string;
  // Net
  netSalary: string;
  transfer: string;
  remaining: string;
  advanceBalance: string;
  // Footer
  signatureDriver: string;
  signatureAdmin: string;
  // Currency
  currency: string;
  // Buttons
  printPdf: string;
  approve: string;
  close: string;
}

const translations: Record<SlipLanguage, SlipTranslations> = {
  ar: {
    title: 'كشف راتب',
    subtitle: 'نظام إدارة التوصيل',
    sectionEmployee: 'بيانات المندوب',
    name: 'الاسم',
    nationalId: 'رقم الهوية',
    city: 'المدينة',
    month: 'الشهر',
    status: 'الحالة',
    paymentMethod: 'طريقة الصرف',
    statusPending: 'معلّق',
    statusApproved: 'معتمد',
    statusPaid: 'مصروف',
    sectionEarnings: 'الاستحقاقات',
    payBank: '🏦 بنك',
    payCash: '💵 ماش',
    sectionPlatforms: 'الطلبات حسب المنصة',
    orders: 'طلب',
    platformTotal: 'إجمالي الراتب الأساسي',
    sectionAdditions: 'الإضافات',
    incentives: 'الحوافز',
    sickAllowance: 'بدل مرضي',
    totalWithSalary: 'المجموع مع الراتب',
    sectionDeductions: 'المستقطعات',
    advanceInstallment: 'قسط سلفة',
    externalDeductions: 'خصومات خارجية',
    violations: 'المخالفات',
    walletHunger: 'محفظة هنقرستيشن',
    walletTuyo: 'محفظة تويو',
    walletJahiz: 'محفظة جاهز',
    foodDamage: 'تلف طعام',
    totalDeductions: 'إجمالي المستقطعات',
    netSalary: 'إجمالي الراتب الصافي',
    transfer: 'التحويل',
    remaining: 'المتبقي',
    advanceBalance: 'رصيد السلفة المتبقي',
    signatureDriver: 'توقيع المندوب',
    signatureAdmin: 'اعتماد الإدارة',
    currency: 'ر.س',
    printPdf: 'طباعة PDF',
    approve: 'اعتماد',
    close: 'إغلاق',
  },
  en: {
    title: 'Salary Slip',
    subtitle: 'Delivery Management System',
    sectionEmployee: 'Employee Information',
    name: 'Name',
    nationalId: 'ID Number',
    city: 'City',
    month: 'Month',
    status: 'Status',
    paymentMethod: 'Payment Method',
    statusPending: 'Pending',
    statusApproved: 'Approved',
    statusPaid: 'Paid',
    sectionEarnings: 'Earnings',
    payBank: '🏦 Bank Transfer',
    payCash: '💵 Cash',
    sectionPlatforms: 'Orders by Platform',
    orders: 'orders',
    platformTotal: 'Total Base Salary',
    sectionAdditions: 'Additions',
    incentives: 'Incentives',
    sickAllowance: 'Sick Leave Allowance',
    totalWithSalary: 'Total with Salary',
    sectionDeductions: 'Deductions',
    advanceInstallment: 'Advance Installment',
    externalDeductions: 'External Deductions',
    violations: 'Violations',
    walletHunger: 'HungerStation Wallet',
    walletTuyo: 'Tuyo Wallet',
    walletJahiz: 'Jahiz Wallet',
    foodDamage: 'Food Damage',
    totalDeductions: 'Total Deductions',
    netSalary: 'Net Salary',
    transfer: 'Transfer',
    remaining: 'Remaining',
    advanceBalance: 'Remaining Advance Balance',
    signatureDriver: "Driver's Signature",
    signatureAdmin: 'Management Approval',
    currency: 'SAR',
    printPdf: 'Print PDF',
    approve: 'Approve',
    close: 'Close',
  },
  ur: {
    title: 'تنخواہ سلپ',
    subtitle: 'ڈیلیوری مینجمنٹ سسٹم',
    sectionEmployee: 'ملازم کی معلومات',
    name: 'نام',
    nationalId: 'شناختی نمبر',
    city: 'شہر',
    month: 'مہینہ',
    status: 'حیثیت',
    paymentMethod: 'ادائیگی کا طریقہ',
    statusPending: 'زیر التواء',
    statusApproved: 'منظور شدہ',
    statusPaid: 'ادا شدہ',
    payBank: '🏦 بینک',
    payCash: '💵 نقد',
    sectionPlatforms: 'پلیٹ فارم کے مطابق آرڈرز',
    orders: 'آرڈر',
    platformTotal: 'بنیادی تنخواہ کا مجموعہ',
    sectionAdditions: 'اضافے',
    incentives: 'مراعات',
    sickAllowance: 'بیماری الاؤنس',
    totalWithSalary: 'تنخواہ سمیت کل',
    sectionDeductions: 'کٹوتیاں',
    advanceInstallment: 'پیشگی قسط',
    externalDeductions: 'بیرونی کٹوتیاں',
    violations: 'خلاف ورزیاں',
    walletHunger: 'ہنگر اسٹیشن والٹ',
    walletTuyo: 'تویو والٹ',
    walletJahiz: 'جاہز والٹ',
    foodDamage: 'کھانے کا نقصان',
    totalDeductions: 'کل کٹوتیاں',
    netSalary: 'خالص تنخواہ',
    transfer: 'ٹرانسفر',
    remaining: 'باقی',
    advanceBalance: 'باقی پیشگی رقم',
    signatureDriver: 'ڈرائیور کے دستخط',
    signatureAdmin: 'انتظامیہ کی منظوری',
    currency: 'ریال',
    printPdf: 'PDF پرنٹ',
    approve: 'منظور کریں',
    close: 'بند کریں',
  },
};

export const getSlipTranslations = (lang: SlipLanguage): SlipTranslations => translations[lang];

export const getStatusLabel = (status: string, lang: SlipLanguage): string => {
  const t = translations[lang];
  if (status === 'approved') return t.statusApproved;
  if (status === 'paid') return t.statusPaid;
  return t.statusPending;
};
