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

export const employees: Employee[] = [
  { id: '1', name: 'أحمد محمد العمري', phone: '0551234567', nationalId: '2123456789', status: 'active', salaryType: 'orders', residencyExpiry: '2025-08-15', apps: ['هنقرستيشن', 'جاهز'], schemeName: 'سكيمة هنقر', iban: 'SA1234567890123456789012', vehicleId: 'V1' },
  { id: '2', name: 'خالد عبدالله السهلي', phone: '0559876543', nationalId: '2198765432', status: 'active', salaryType: 'shift', residencyExpiry: '2025-04-20', apps: ['كيتا', 'توبو'], monthlySalary: 3000, iban: 'SA9876543210987654321098', vehicleId: 'V2' },
  { id: '3', name: 'عمر سعيد الحربي', phone: '0553456789', nationalId: '2134567890', status: 'active', salaryType: 'orders', residencyExpiry: '2026-01-10', apps: ['جاهز', 'نينجا'], schemeName: 'سكيمة جاهز', vehicleId: 'V3' },
  { id: '4', name: 'فهد ناصر القحطاني', phone: '0557654321', nationalId: '2176543210', status: 'suspended', salaryType: 'shift', residencyExpiry: '2025-03-01', apps: ['هنقرستيشن'], monthlySalary: 2800, vehicleId: 'V4' },
  { id: '5', name: 'سلطان بندر الدوسري', phone: '0552345678', nationalId: '2145678901', status: 'active', salaryType: 'orders', residencyExpiry: '2025-12-25', apps: ['كيتا', 'هنقرستيشن', 'جاهز'], schemeName: 'سكيمة كيتا', vehicleId: 'V5' },
  { id: '6', name: 'ياسر محمد الزهراني', phone: '0558765432', nationalId: '2187654321', status: 'active', salaryType: 'shift', residencyExpiry: '2025-09-30', apps: ['توبو'], monthlySalary: 3200, vehicleId: 'V6' },
  { id: '7', name: 'مشاري سعد الشمري', phone: '0554567890', nationalId: '2156789012', status: 'terminated', salaryType: 'orders', residencyExpiry: '2025-02-28', apps: ['نينجا'], schemeName: 'سكيمة نينجا' },
  { id: '8', name: 'عبدالرحمن فيصل المطيري', phone: '0556543210', nationalId: '2167890123', status: 'active', salaryType: 'orders', residencyExpiry: '2025-11-15', apps: ['جاهز', 'كيتا'], schemeName: 'سكيمة جاهز', vehicleId: 'V7' },
];

export const alerts: Alert[] = [
  { id: '1', type: 'residency', entityName: 'فهد ناصر القحطاني', dueDate: '2025-03-01', daysLeft: 4, severity: 'urgent' },
  { id: '2', type: 'residency', entityName: 'مشاري سعد الشمري', dueDate: '2025-02-28', daysLeft: 1, severity: 'urgent' },
  { id: '3', type: 'insurance', entityName: 'دراجة DRG-012', dueDate: '2025-03-20', daysLeft: 23, severity: 'warning' },
  { id: '4', type: 'license', entityName: 'خالد عبدالله السهلي', dueDate: '2025-04-20', daysLeft: 54, severity: 'warning' },
  { id: '5', type: 'installment', entityName: 'أحمد محمد العمري', dueDate: '2025-03-01', daysLeft: 4, severity: 'info' },
  { id: '6', type: 'registration', entityName: 'دراجة DRG-045', dueDate: '2025-04-15', daysLeft: 49, severity: 'warning' },
  { id: '7', type: 'insurance', entityName: 'دراجة MTR-033', dueDate: '2025-03-10', daysLeft: 13, severity: 'warning' },
  { id: '8', type: 'deduction', entityName: 'خصم هنقرستيشن — أحمد', dueDate: '2025-02-28', daysLeft: 1, severity: 'info' },
  { id: '9', type: 'residency', entityName: 'ياسر محمد الزهراني', dueDate: '2025-05-30', daysLeft: 94, severity: 'warning' },
  { id: '10', type: 'license', entityName: 'عمر سعيد الحربي', dueDate: '2025-06-15', daysLeft: 110, severity: 'info' },
];

export const advances: Advance[] = [
  { id: '1', employeeId: '1', employeeName: 'أحمد محمد العمري', amount: 5000, paidAmount: 2000, monthlyInstallment: 500, remainingInstallments: 6, disbursementDate: '2024-09-01', status: 'active', approvedBy: 'أدمن' },
  { id: '2', employeeId: '3', employeeName: 'عمر سعيد الحربي', amount: 3000, paidAmount: 1500, monthlyInstallment: 500, remainingInstallments: 3, disbursementDate: '2024-11-01', status: 'active', approvedBy: 'أدمن' },
  { id: '3', employeeId: '5', employeeName: 'سلطان بندر الدوسري', amount: 2000, paidAmount: 2000, monthlyInstallment: 500, remainingInstallments: 0, disbursementDate: '2024-06-01', status: 'completed', approvedBy: 'أدمن' },
  { id: '4', employeeId: '6', employeeName: 'ياسر محمد الزهراني', amount: 4000, paidAmount: 1000, monthlyInstallment: 500, remainingInstallments: 6, disbursementDate: '2024-12-01', status: 'active', approvedBy: 'أدمن' },
  { id: '5', employeeId: '2', employeeName: 'خالد عبدالله السهلي', amount: 1500, paidAmount: 0, monthlyInstallment: 500, remainingInstallments: 3, disbursementDate: '2025-01-15', status: 'paused', approvedBy: 'أدمن' },
];

export const vehicles: Vehicle[] = [
  { id: 'V1', plateNumber: 'DRG-012', type: 'motorcycle', brand: 'Honda', model: 'CG125', year: 2023, currentDriver: 'أحمد محمد العمري', currentDriverId: '1', insuranceExpiry: '2025-03-20', registrationExpiry: '2025-08-15', lastMaintenance: '2025-01-10', status: 'active' },
  { id: 'V2', plateNumber: 'DRG-025', type: 'motorcycle', brand: 'Yamaha', model: 'YBR125', year: 2022, currentDriver: 'خالد عبدالله السهلي', currentDriverId: '2', insuranceExpiry: '2025-07-10', registrationExpiry: '2025-09-20', lastMaintenance: '2025-02-01', status: 'active' },
  { id: 'V3', plateNumber: 'DRG-033', type: 'motorcycle', brand: 'Honda', model: 'Wave110', year: 2024, currentDriver: 'عمر سعيد الحربي', currentDriverId: '3', insuranceExpiry: '2025-03-10', registrationExpiry: '2025-12-01', lastMaintenance: '2024-12-15', status: 'active' },
  { id: 'V4', plateNumber: 'DRG-045', type: 'motorcycle', brand: 'Suzuki', model: 'GD110', year: 2023, currentDriver: 'فهد ناصر القحطاني', currentDriverId: '4', insuranceExpiry: '2025-06-20', registrationExpiry: '2025-04-15', lastMaintenance: '2025-01-20', status: 'maintenance' },
  { id: 'V5', plateNumber: 'MTR-001', type: 'motorcycle', brand: 'Honda', model: 'PCX150', year: 2024, currentDriver: 'سلطان بندر الدوسري', currentDriverId: '5', insuranceExpiry: '2025-11-30', registrationExpiry: '2026-01-15', lastMaintenance: '2025-02-10', status: 'active' },
  { id: 'V6', plateNumber: 'CAR-010', type: 'car', brand: 'Toyota', model: 'Hilux', year: 2022, currentDriver: 'ياسر محمد الزهراني', currentDriverId: '6', insuranceExpiry: '2025-05-15', registrationExpiry: '2025-07-20', lastMaintenance: '2025-01-05', status: 'active' },
  { id: 'V7', plateNumber: 'DRG-050', type: 'motorcycle', brand: 'Yamaha', model: 'FZ150', year: 2024, currentDriver: 'عبدالرحمن فيصل المطيري', currentDriverId: '8', insuranceExpiry: '2025-09-25', registrationExpiry: '2025-10-10', status: 'active' },
  { id: 'V8', plateNumber: 'MTR-033', type: 'motorcycle', brand: 'Honda', model: 'CG125', year: 2021, insuranceExpiry: '2025-03-10', registrationExpiry: '2025-05-01', lastMaintenance: '2024-11-20', status: 'suspended' },
];

export const dailyOrders: DailyOrder[] = [
  { id: '1', employeeId: '1', employeeName: 'أحمد محمد العمري', date: '2025-02-25', app: 'هنقرستيشن', orders: 28 },
  { id: '2', employeeId: '1', employeeName: 'أحمد محمد العمري', date: '2025-02-25', app: 'جاهز', orders: 12 },
  { id: '3', employeeId: '3', employeeName: 'عمر سعيد الحربي', date: '2025-02-25', app: 'جاهز', orders: 35 },
  { id: '4', employeeId: '3', employeeName: 'عمر سعيد الحربي', date: '2025-02-25', app: 'نينجا', orders: 8 },
  { id: '5', employeeId: '5', employeeName: 'سلطان بندر الدوسري', date: '2025-02-25', app: 'كيتا', orders: 22 },
  { id: '6', employeeId: '5', employeeName: 'سلطان بندر الدوسري', date: '2025-02-25', app: 'هنقرستيشن', orders: 18 },
  { id: '7', employeeId: '8', employeeName: 'عبدالرحمن فيصل المطيري', date: '2025-02-25', app: 'جاهز', orders: 30 },
  { id: '8', employeeId: '8', employeeName: 'عبدالرحمن فيصل المطيري', date: '2025-02-25', app: 'كيتا', orders: 15 },
  { id: '9', employeeId: '1', employeeName: 'أحمد محمد العمري', date: '2025-02-24', app: 'هنقرستيشن', orders: 25 },
  { id: '10', employeeId: '3', employeeName: 'عمر سعيد الحربي', date: '2025-02-24', app: 'جاهز', orders: 32 },
  { id: '11', employeeId: '5', employeeName: 'سلطان بندر الدوسري', date: '2025-02-24', app: 'كيتا', orders: 20 },
  { id: '12', employeeId: '8', employeeName: 'عبدالرحمن فيصل المطيري', date: '2025-02-24', app: 'جاهز', orders: 28 },
];

export const salaryRecords: SalaryRecord[] = [
  { id: '1', employeeId: '1', employeeName: 'أحمد محمد العمري', month: '2025-02', salaryType: 'orders', baseSalary: 4200, allowances: 500, absenceDeduction: 0, advanceDeduction: 500, externalDeduction: 150, manualDeduction: 0, netSalary: 4050, status: 'pending' },
  { id: '2', employeeId: '2', employeeName: 'خالد عبدالله السهلي', month: '2025-02', salaryType: 'shift', baseSalary: 3000, allowances: 400, absenceDeduction: 200, advanceDeduction: 0, externalDeduction: 0, manualDeduction: 0, netSalary: 3200, status: 'pending' },
  { id: '3', employeeId: '3', employeeName: 'عمر سعيد الحربي', month: '2025-02', salaryType: 'orders', baseSalary: 5100, allowances: 500, absenceDeduction: 0, advanceDeduction: 500, externalDeduction: 200, manualDeduction: 0, netSalary: 4900, status: 'approved' },
  { id: '4', employeeId: '5', employeeName: 'سلطان بندر الدوسري', month: '2025-02', salaryType: 'orders', baseSalary: 3800, allowances: 500, absenceDeduction: 0, advanceDeduction: 0, externalDeduction: 100, manualDeduction: 0, netSalary: 4200, status: 'approved' },
  { id: '5', employeeId: '6', employeeName: 'ياسر محمد الزهراني', month: '2025-02', salaryType: 'shift', baseSalary: 3200, allowances: 400, absenceDeduction: 0, advanceDeduction: 500, externalDeduction: 0, manualDeduction: 100, netSalary: 3000, status: 'pending' },
  { id: '6', employeeId: '8', employeeName: 'عبدالرحمن فيصل المطيري', month: '2025-02', salaryType: 'orders', baseSalary: 4500, allowances: 500, absenceDeduction: 0, advanceDeduction: 0, externalDeduction: 180, manualDeduction: 0, netSalary: 4820, status: 'paid' },
];

export const externalDeductions: ExternalDeduction[] = [
  { id: '1', employeeId: '1', employeeName: 'أحمد محمد العمري', source: 'هنقرستيشن', type: 'غرامة', amount: 150, incidentDate: '2025-02-10', deductionMonth: '2025-02', matchStatus: 'matched', approvalStatus: 'approved' },
  { id: '2', employeeId: '3', employeeName: 'عمر سعيد الحربي', source: 'جاهز', type: 'مردود', amount: 200, incidentDate: '2025-02-12', deductionMonth: '2025-02', matchStatus: 'matched', approvalStatus: 'approved' },
  { id: '3', employeeId: '5', employeeName: 'سلطان بندر الدوسري', source: 'كيتا', type: 'تأخير', amount: 100, incidentDate: '2025-02-15', deductionMonth: '2025-02', matchStatus: 'matched', approvalStatus: 'pending' },
  { id: '4', employeeId: '8', employeeName: 'عبدالرحمن فيصل المطيري', source: 'جاهز', type: 'حادثة', amount: 180, incidentDate: '2025-02-18', deductionMonth: '2025-02', matchStatus: 'unmatched', approvalStatus: 'pending' },
  { id: '5', employeeId: '1', employeeName: 'أحمد محمد العمري', source: 'هنقرستيشن', type: 'غرامة', amount: 75, incidentDate: '2025-02-20', deductionMonth: '2025-02', matchStatus: 'duplicate', approvalStatus: 'rejected' },
];

export const plRecords: PLRecord[] = [
  { month: '2025-02', driverRevenue: 32000, otherRevenue: 2000, totalRevenue: 34000, driverSalaries: 24170, vehicleCosts: 1500, externalDeductions: 705, otherCosts: 2000, totalCosts: 28375, netProfit: 5625, profitMargin: 16.5 },
  { month: '2025-01', driverRevenue: 29000, otherRevenue: 1500, totalRevenue: 30500, driverSalaries: 22000, vehicleCosts: 2200, externalDeductions: 850, otherCosts: 1800, totalCosts: 26850, netProfit: 3650, profitMargin: 12.0 },
  { month: '2024-12', driverRevenue: 35000, otherRevenue: 3000, totalRevenue: 38000, driverSalaries: 25500, vehicleCosts: 1200, externalDeductions: 600, otherCosts: 2500, totalCosts: 29800, netProfit: 8200, profitMargin: 21.6 },
  { month: '2024-11', driverRevenue: 27000, otherRevenue: 1000, totalRevenue: 28000, driverSalaries: 21000, vehicleCosts: 1800, externalDeductions: 500, otherCosts: 1500, totalCosts: 24800, netProfit: 3200, profitMargin: 11.4 },
  { month: '2024-10', driverRevenue: 31000, otherRevenue: 2500, totalRevenue: 33500, driverSalaries: 23500, vehicleCosts: 1400, externalDeductions: 700, otherCosts: 2000, totalCosts: 27600, netProfit: 5900, profitMargin: 17.6 },
  { month: '2024-09', driverRevenue: 28000, otherRevenue: 1200, totalRevenue: 29200, driverSalaries: 20500, vehicleCosts: 3000, externalDeductions: 400, otherCosts: 1800, totalCosts: 25700, netProfit: 3500, profitMargin: 12.0 },
];

export const salarySchemes: SalaryScheme[] = [
  { id: '1', name: 'سكيمة هنقر Q1 2025', app: 'هنقرستيشن', tiers: [{ from: 1, to: 500, pricePerOrder: 5 }, { from: 501, to: 1000, pricePerOrder: 6 }, { from: 1001, to: 9999, pricePerOrder: 7 }], targetBonus: { target: 800, bonus: 500 }, status: 'active', assignedCount: 2 },
  { id: '2', name: 'سكيمة جاهز Q1 2025', app: 'جاهز', tiers: [{ from: 1, to: 400, pricePerOrder: 5.5 }, { from: 401, to: 800, pricePerOrder: 6.5 }, { from: 801, to: 9999, pricePerOrder: 7.5 }], targetBonus: { target: 700, bonus: 400 }, status: 'active', assignedCount: 3 },
  { id: '3', name: 'سكيمة كيتا Q1 2025', app: 'كيتا', tiers: [{ from: 1, to: 300, pricePerOrder: 6 }, { from: 301, to: 600, pricePerOrder: 7 }, { from: 601, to: 9999, pricePerOrder: 8 }], status: 'active', assignedCount: 2 },
  { id: '4', name: 'سكيمة نينجا Q4 2024', app: 'نينجا', tiers: [{ from: 1, to: 500, pricePerOrder: 4.5 }, { from: 501, to: 9999, pricePerOrder: 5.5 }], status: 'archived', assignedCount: 1 },
];

export const kpis = {
  activeEmployees: 6,
  totalSalaries: 24170,
  activeAdvances: 3,
  totalAdvancesAmount: 8500,
  presentToday: 5,
  absentToday: 1,
  monthRevenue: 34000,
  monthProfit: 5625,
};

export const ordersByApp = [
  { app: 'هنقرستيشن', orders: 1250 },
  { app: 'جاهز', orders: 980 },
  { app: 'كيتا', orders: 720 },
  { app: 'توبو', orders: 450 },
  { app: 'نينجا', orders: 320 },
];

export const attendanceWeek = [
  { day: 'سبت', present: 6, absent: 1, leave: 1 },
  { day: 'أحد', present: 7, absent: 0, leave: 1 },
  { day: 'اثنين', present: 5, absent: 2, leave: 1 },
  { day: 'ثلاثاء', present: 6, absent: 1, leave: 1 },
  { day: 'أربعاء', present: 7, absent: 1, leave: 0 },
  { day: 'خميس', present: 5, absent: 2, leave: 1 },
];

export const appsList = ['هنقرستيشن', 'جاهز', 'كيتا', 'توبو', 'نينجا'];

export const alertTypeLabels: Record<string, string> = {
  residency: 'إقامة',
  insurance: 'تأمين',
  registration: 'تسجيل',
  license: 'رخصة',
  installment: 'قسط سلفة',
  deduction: 'خصم شركة',
};
