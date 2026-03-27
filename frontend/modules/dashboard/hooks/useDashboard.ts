import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMonthlyActiveEmployeeIds } from '@shared/hooks/useMonthlyActiveEmployeeIds';

type Kpis = {
  activeEmployees: number;
  presentToday: number;
  absentToday: number;
  leaveToday: number;
  lateToday: number;
  sickToday: number;
  totalOrders: number;
  prevMonthOrders: number;
  activeVehicles: number;
  activeAlerts: number;
  activeApps: number;
  hasLicense: number;
  appliedLicense: number;
  noLicense: number;
  makkahCount: number;
  jeddahCount: number;
  estRevenueTotal: number;
};

type EmpDetail = { city: string; has_license: boolean; license_status: string; sponsorship_status: string };
type Rider = { name: string; orders: number; app: string; appColor: string; appId: string };
type AppMeta = { id: string; name: string; brand_color: string; text_color: string };

type DashboardData = {
  kpis: Kpis;
  empDetails: EmpDetail[];
  ordersByApp: { app: string; orders: number; appId: string; riders: number; brandColor: string; textColor: string; target: number }[];
  ordersByCity: { city: string; orders: number }[];
  allRiders: Rider[];
  attendanceWeek: { day: string; present: number; absent: number; leave: number; sick: number; late: number }[];
  recentActivity: { text: string; time: string; icon: unknown }[];
  apps: AppMeta[];
};

/** Stable empty refs so useMemo deps do not change every render when `data` is missing. */
const EMPTY_EMP_DETAILS: EmpDetail[] = [];
const EMPTY_ORDERS_BY_APP: DashboardData['ordersByApp'] = [];
const EMPTY_ORDERS_BY_CITY: DashboardData['ordersByCity'] = [];
const EMPTY_RIDERS: Rider[] = [];
const EMPTY_ATTENDANCE_WEEK: DashboardData['attendanceWeek'] = [];
const EMPTY_RECENT_ACTIVITY: DashboardData['recentActivity'] = [];
const EMPTY_APPS: AppMeta[] = [];

type EmployeeCounts = ReturnType<(empDetails: EmpDetail[]) => unknown>;

export function useDashboard(params: {
  userId?: string;
  currentMonth: string;
  enabled: boolean;
  authUserId?: string;
  fetchDashboardKpis: (currentMonth: string, activeEmployeeIdsInMonth: ReadonlySet<string> | undefined) => Promise<DashboardData>;
  buildEmployeeCounts: (empDetails: EmpDetail[]) => EmployeeCounts;
  parsePositiveIntOrNull: (raw: string) => number | null;
  useRealtimeInvalidation: (userId: string | undefined, month: string, queryClient: ReturnType<typeof useQueryClient>) => void;
}) {
  const { userId, currentMonth, enabled, authUserId, fetchDashboardKpis, buildEmployeeCounts, parsePositiveIntOrNull, useRealtimeInvalidation } = params;
  const [topN, setTopN] = useState(5);
  const [topNInput, setTopNInput] = useState('5');
  const queryClient = useQueryClient();
  const { data: activeIdsData } = useMonthlyActiveEmployeeIds(currentMonth);
  const activeEmployeeIdsInMonth = activeIdsData?.employeeIds;

  useRealtimeInvalidation(authUserId, currentMonth, queryClient);

  const { data, isLoading: loading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['dashboard-kpis', userId, currentMonth],
    enabled: enabled && !!activeIdsData,
    queryFn: () => fetchDashboardKpis(currentMonth, activeEmployeeIdsInMonth),
    staleTime: 5 * 60 * 1000,
  });

  const defaultKpis: Kpis = {
    activeEmployees: 0, presentToday: 0, absentToday: 0, leaveToday: 0, lateToday: 0, sickToday: 0, totalOrders: 0, prevMonthOrders: 0,
    activeVehicles: 0, activeAlerts: 0, activeApps: 0, hasLicense: 0, appliedLicense: 0, noLicense: 0, makkahCount: 0, jeddahCount: 0, estRevenueTotal: 0,
  };

  const kpis = data?.kpis ?? defaultKpis;
  const empDetails = data?.empDetails ?? EMPTY_EMP_DETAILS;
  const ordersByApp = data?.ordersByApp ?? EMPTY_ORDERS_BY_APP;
  const ordersByCity = data?.ordersByCity ?? EMPTY_ORDERS_BY_CITY;
  const allRiders = data?.allRiders ?? EMPTY_RIDERS;
  const attendanceWeek = data?.attendanceWeek ?? EMPTY_ATTENDANCE_WEEK;
  const recentActivity = data?.recentActivity ?? EMPTY_RECENT_ACTIVITY;
  const apps = data?.apps ?? EMPTY_APPS;

  const orderGrowth = useMemo(
    () => (kpis.prevMonthOrders > 0 ? ((kpis.totalOrders - kpis.prevMonthOrders) / kpis.prevMonthOrders) * 100 : 0),
    [kpis.prevMonthOrders, kpis.totalOrders],
  );
  const employeeCounts = useMemo(() => buildEmployeeCounts(empDetails), [buildEmployeeCounts, empDetails]);

  const ridersByAppId = useMemo(() => {
    const map = new Map<string, Rider[]>();
    for (const r of allRiders) {
      const arr = map.get(r.appId);
      if (arr) arr.push(r);
      else map.set(r.appId, [r]);
    }
    return map;
  }, [allRiders]);

  const topRidersOverall = useMemo(() => allRiders.slice(0, topN), [allRiders, topN]);
  const maxOrderOverall = useMemo(() => topRidersOverall[0]?.orders || 1, [topRidersOverall]);
  const topRidersPerApp = useMemo(
    () => apps.map((app) => ({ ...app, riders: (ridersByAppId.get(app.id) || []).slice(0, topN) })).filter((a) => a.riders.length > 0),
    [apps, ridersByAppId, topN],
  );

  const handleTopNBlur = useCallback(() => {
    const parsed = parsePositiveIntOrNull(topNInput);
    if (parsed !== null) {
      setTopN(parsed);
      return;
    }
    setTopNInput(String(topN));
  }, [topN, topNInput, parsePositiveIntOrNull]);

  return {
    loading, isError, error, refetch, isFetching,
    kpis, orderGrowth, employeeCounts, ordersByApp, ordersByCity, attendanceWeek, recentActivity,
    topNInput, setTopNInput, handleTopNBlur, topRidersOverall, maxOrderOverall, topRidersPerApp,
  };
}
