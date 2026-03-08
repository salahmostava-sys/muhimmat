// Type definitions — data is now served live from Supabase

export interface Employee {
  id: string;
  name: string;
  phone: string;
  nationalId: string;
  status: 'active' | 'suspended' | 'terminated';
  salaryType: 'shift' | 'orders';
  residencyExpiry: string;
  apps: string[];
  monthlySalary?: number;
  schemeName?: string;
  iban?: string;
  email?: string;
  birthDate?: string;
  sponsor?: string;
  licenseExpiry?: string;
  vehicleId?: string;
}

export interface Alert {
  id: string;
  type: 'residency' | 'insurance' | 'registration' | 'license' | 'installment' | 'deduction';
  entityName: string;
  dueDate: string;
  daysLeft: number;
  severity: 'urgent' | 'warning' | 'info';
  resolved?: boolean;
}

export interface Advance {
  id: string;
  employeeId: string;
  employeeName: string;
  amount: number;
  paidAmount: number;
  monthlyInstallment: number;
  remainingInstallments: number;
  disbursementDate: string;
  status: 'active' | 'completed' | 'paused';
  approvedBy: string;
}

export interface Vehicle {
  id: string;
  plateNumber: string;
  type: 'motorcycle' | 'car';
  brand: string;
  model: string;
  year: number;
  currentDriver?: string;
  currentDriverId?: string;
  insuranceExpiry: string;
  registrationExpiry: string;
  lastMaintenance?: string;
  status: 'active' | 'maintenance' | 'suspended';
}

export interface DailyOrder {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  app: string;
  orders: number;
  schemeName?: string;
}

export interface SalaryRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  month: string;
  salaryType: 'shift' | 'orders';
  baseSalary: number;
  allowances: number;
  absenceDeduction: number;
  advanceDeduction: number;
  externalDeduction: number;
  manualDeduction: number;
  netSalary: number;
  status: 'pending' | 'approved' | 'paid';
}

export interface ExternalDeduction {
  id: string;
  employeeId: string;
  employeeName: string;
  source: string;
  type: string;
  amount: number;
  incidentDate: string;
  deductionMonth: string;
  matchStatus: 'matched' | 'unmatched' | 'duplicate';
  approvalStatus: 'pending' | 'approved' | 'rejected';
}

export interface PLRecord {
  month: string;
  driverRevenue: number;
  otherRevenue: number;
  totalRevenue: number;
  driverSalaries: number;
  vehicleCosts: number;
  externalDeductions: number;
  otherCosts: number;
  totalCosts: number;
  netProfit: number;
  profitMargin: number;
}

export interface SalaryScheme {
  id: string;
  name: string;
  app: string;
  tiers: { from: number; to: number; pricePerOrder: number }[];
  targetBonus?: { target: number; bonus: number };
  status: 'active' | 'archived';
  assignedCount: number;
}

// Static string maps (not data — safe to keep here)
export const appsList = ['هنقرستيشن', 'جاهز', 'كيتا', 'توبو', 'نينجا'];

export const alertTypeLabels: Record<string, string> = {
  residency: 'إقامة',
  insurance: 'تأمين',
  registration: 'تسجيل',
  license: 'رخصة',
  installment: 'قسط سلفة',
  deduction: 'خصم شركة',
};
