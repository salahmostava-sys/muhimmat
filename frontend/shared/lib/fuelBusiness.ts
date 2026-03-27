type DailyRowLike = {
  employee_id: string;
  date: string;
  km_total: number;
  fuel_cost: number;
};

export const sortDailyRowsByDateDesc = <T extends DailyRowLike>(rows: T[]): T[] =>
  [...rows].sort((a, b) => b.date.localeCompare(a.date));

export const getRiderDailyRows = <T extends DailyRowLike>(rows: T[], employeeId: string): T[] =>
  sortDailyRowsByDateDesc(rows.filter((row) => row.employee_id === employeeId));

export const sumRiderKm = <T extends DailyRowLike>(rows: T[]): number =>
  rows.reduce((sum, row) => sum + (Number(row.km_total) || 0), 0);

export const sumRiderFuel = <T extends DailyRowLike>(rows: T[]): number =>
  rows.reduce((sum, row) => sum + (Number(row.fuel_cost) || 0), 0);

export const getRiderOrders = (monthOrdersMap: Record<string, number>, employeeId: string): number =>
  monthOrdersMap[employeeId] || 0;

export const calcFuelCostPerKm = (kmTotal: number, fuelCost: number): number | null =>
  kmTotal > 0 ? fuelCost / kmTotal : null;

export const calcFuelPerOrder = (fuelCost: number, ordersCount: number): number | null =>
  ordersCount > 0 ? fuelCost / ordersCount : null;
