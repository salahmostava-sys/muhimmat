import { attendanceService } from '@services/attendanceService';
import { employeeService } from '@services/employeeService';
import { orderService } from '@services/orderService';
import { appService } from '@services/appService';
import { fuelService } from '@services/fuelService';
import { salaryService } from '@services/salaryService';
import { advanceService } from '@services/advanceService';
import { externalDeductionService } from '@services/externalDeductionService';

export const salaryDataService = {
  async calculateSalaryForEmployeeMonth(
    employeeId: string,
    monthYear: string,
    paymentMethod = 'cash',
    manualDeduction = 0,
    manualDeductionNote: string | null = null
  ) {
    return salaryService.calculateSalaryForEmployeeMonth(
      employeeId,
      monthYear,
      paymentMethod,
      manualDeduction,
      manualDeductionNote
    );
  },

  async calculateSalaryForMonth(monthYear: string, paymentMethod = 'cash') {
    return salaryService.calculateSalaryForMonth({ monthYear, paymentMethod });
  },

  async getSalaryPreviewForMonth(monthYear: string) {
    return salaryService.getSalaryPreviewForMonth(monthYear);
  },

  async getMonthlyContext(selectedMonth: string) {
    const [empRes, extRes, ordersRes, appsWithSchemeRes, attendanceRes, fuelRes, savedRecordsRes, allAdvancesRes] =
      await Promise.all([
        employeeService.getActiveForSalaryContext(),
        externalDeductionService.getApprovedByMonth(selectedMonth),
        orderService.getSalaryContextOrdersByMonth(selectedMonth),
        appService.getActiveWithSalarySchemes(),
        attendanceService.getAttendanceByMonth(selectedMonth),
        fuelService.getMonthlyFuelByMonthYear(selectedMonth),
        salaryService.getMonthRecordsForSalaryContext(selectedMonth),
        advanceService.getActiveAndPausedForSalaryContext(),
      ]);

    return {
      empRes,
      extRes,
      ordersRes,
      appsWithSchemeRes,
      attendanceRes: { data: attendanceRes.data || [], error: attendanceRes.error },
      fuelRes,
      savedRecords: savedRecordsRes.data || [],
      allAdvances: allAdvancesRes.data || [],
    };
  },

  async upsertSalaryRecord(record: Record<string, unknown>) {
    const { error } = await salaryService.upsertMany([record]);
    return { error };
  },

  async upsertSalaryRecords(records: Record<string, unknown>[]) {
    const { error } = await salaryService.upsertMany(records);
    return { error };
  },

  async markInstallmentsDeducted(installmentIds: string[], deductedAtIso: string) {
    return advanceService.markInstallmentsDeducted(installmentIds, deductedAtIso);
  },

  async getInstallmentsByIds(installmentIds: string[]) {
    return advanceService.getInstallmentsByIds(installmentIds);
  },

  async getAdvanceInstallmentStatuses(advanceId: string) {
    return advanceService.getAdvanceInstallmentStatuses(advanceId);
  },

  async markAdvanceCompleted(advanceId: string) {
    return advanceService.markAdvanceCompleted(advanceId);
  },

  async getMonthInstallmentsForAdvances(selectedMonth: string, advanceIds: string[]) {
    return advanceService.getMonthInstallmentsForAdvances(selectedMonth, advanceIds);
  },

  async getPendingInstallmentsForAdvances(advanceIds: string[]) {
    return advanceService.getPendingInstallmentsForAdvances(advanceIds);
  },
};

export default salaryDataService;
