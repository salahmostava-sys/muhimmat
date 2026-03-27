import { lazy, Suspense } from "react";
import { Toaster } from "@shared/components/ui/toaster";
import { Toaster as Sonner } from "@shared/components/ui/sonner";
import { TooltipProvider } from "@shared/components/ui/tooltip";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "@app/providers/AuthContext";
import { LanguageProvider } from "@app/providers/LanguageContext";
import { ThemeProvider } from "@app/providers/ThemeContext";
import { SystemSettingsProvider } from "@app/providers/SystemSettingsContext";
import ProtectedRoute from "@shared/components/ProtectedRoute";
import PageGuard from "@shared/components/PageGuard";
import ErrorBoundary from "@shared/components/ErrorBoundary";
import { ErrorContextSync } from "@app/components/ErrorContextSync";
import DashboardLayout from "@shared/components/AppLayout";
import AuthLayout from "@app/layout/AuthLayout";
import Loading from "@shared/components/Loading";
import { emitAuthFailure, isStrictUnauthenticatedError } from "@shared/lib/auth/authFailureBus";
import "@app/i18n";

const Login = lazy(() => import("@modules/pages/Login"));
const ForgotPassword = lazy(() => import("@modules/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@modules/pages/ResetPassword"));
const Dashboard = lazy(() => import("@modules/pages/Dashboard"));
const Employees = lazy(() => import("@modules/employees/pages/EmployeesPage"));
const Attendance = lazy(() => import("@modules/pages/Attendance"));
const Orders = lazy(() => import("@modules/pages/Orders"));
const Salaries = lazy(() => import("@modules/pages/Salaries"));
const Advances = lazy(() => import("@modules/pages/Advances"));
const FuelPage = lazy(() => import("@modules/pages/Fuel"));
const Apps = lazy(() => import("@modules/pages/Apps"));
const Alerts = lazy(() => import("@modules/pages/Alerts"));
const SettingsHub = lazy(() => import("@modules/pages/SettingsHub"));
const ViolationResolver = lazy(() => import("@modules/pages/ViolationResolver"));
const Motorcycles = lazy(() => import("@modules/pages/Motorcycles"));
const VehicleAssignment = lazy(() => import("@modules/pages/VehicleAssignment"));
const EmployeeTiers = lazy(() => import("@modules/pages/EmployeeTiers"));
const PlatformAccounts = lazy(() => import("@modules/pages/PlatformAccounts"));
const ProfilePage = lazy(() => import("@modules/pages/ProfilePage"));
const NotFound = lazy(() => import("@modules/pages/NotFound"));

const PageLoader = () => {
  const location = useLocation();
  const resetKey = `${location.pathname}${location.search}`;
  return <Loading minHeightClassName="min-h-[300px]" resetKey={resetKey} />;
};

const RootLoader = () => {
  const location = useLocation();
  const resetKey = `${location.pathname}${location.search}`;
  return <Loading minHeightClassName="min-h-screen" className="bg-background" resetKey={resetKey} />;
};

const handleGlobalAuthError = (source: "query" | "mutation", error: unknown) => {
  if (!isStrictUnauthenticatedError(error)) return;
  emitAuthFailure({ source, reason: "unauthenticated" });
};

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => handleGlobalAuthError("query", error),
  }),
  mutationCache: new MutationCache({
    onError: (error) => handleGlobalAuthError("mutation", error),
  }),
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <AuthProvider>
            <ErrorContextSync />
            <LanguageProvider>
              <SystemSettingsProvider>
                <ErrorBoundary>
                  <Suspense fallback={<RootLoader />}>
                    <Routes>
                      <Route path="/login" element={<AuthLayout><Login /></AuthLayout>} />
                      <Route path="/forgot-password" element={<AuthLayout><ForgotPassword /></AuthLayout>} />
                      <Route path="/reset-password" element={<AuthLayout><ResetPassword /></AuthLayout>} />
                      <Route path="/forgot" element={<Navigate to="/forgot-password" replace />} />
                      <Route path="/forget-password" element={<Navigate to="/forgot-password" replace />} />
                      <Route path="/reset" element={<Navigate to="/reset-password" replace />} />
                      <Route path="/resetpass" element={<Navigate to="/reset-password" replace />} />
                      <Route
                        path="/*"
                        element={
                          <ProtectedRoute>
                            <DashboardLayout>
                              <ErrorBoundary>
                                <Suspense fallback={<PageLoader />}>
                                  <Routes>
                                    <Route path="/" element={<Dashboard />} />
                                    <Route path="/employees" element={<PageGuard pageKey="employees"><Employees /></PageGuard>} />
                                    <Route path="/attendance" element={<PageGuard pageKey="attendance"><Attendance /></PageGuard>} />
                                    <Route path="/orders" element={<PageGuard pageKey="orders"><Orders /></PageGuard>} />
                                    <Route path="/salaries" element={<PageGuard pageKey="salaries"><Salaries /></PageGuard>} />
                                    <Route path="/advances" element={<PageGuard pageKey="advances"><Advances /></PageGuard>} />
                                    <Route path="/motorcycles" element={<PageGuard pageKey="vehicles"><Motorcycles /></PageGuard>} />
                                    <Route path="/vehicle-assignment" element={<PageGuard pageKey="vehicle_assignment"><VehicleAssignment /></PageGuard>} />
                                    <Route path="/fuel" element={<PageGuard pageKey="fuel"><FuelPage /></PageGuard>} />
                                    <Route path="/apps" element={<PageGuard pageKey="apps"><Apps /></PageGuard>} />
                                    <Route path="/alerts" element={<PageGuard pageKey="alerts"><Alerts /></PageGuard>} />
                                    <Route path="/employee-tiers" element={<PageGuard pageKey="employee_tiers"><EmployeeTiers /></PageGuard>} />
                                    <Route path="/platform-accounts" element={<PageGuard pageKey="platform_accounts"><PlatformAccounts /></PageGuard>} />
                                    <Route path="/profile" element={<ProfilePage />} />
                                    <Route path="/profile-page" element={<Navigate to="/profile" replace />} />
                                    <Route path="/settings" element={<PageGuard pageKey="settings"><SettingsHub /></PageGuard>} />
                                    <Route path="/settings/general" element={<Navigate to="/settings?tab=general" replace />} />
                                    <Route path="/settings/schemes" element={<Navigate to="/settings?tab=schemes" replace />} />
                                    <Route path="/settings/users" element={<Navigate to="/settings?tab=users" replace />} />
                                    <Route path="/settings/permissions" element={<Navigate to="/settings?tab=users" replace />} />
                                    <Route path="/settings/profile" element={<Navigate to="/profile" replace />} />
                                    <Route path="/activity-log" element={<Navigate to="/settings?tab=activity" replace />} />
                                    <Route path="/reports" element={<Navigate to="/settings?tab=activity" replace />} />
                                    <Route path="/vehicles" element={<Navigate to="/motorcycles" replace />} />
                                    <Route path="/vehicle-tracking" element={<Navigate to="/motorcycles" replace />} />
                                    <Route path="/deductions" element={<Navigate to="/advances" replace />} />
                                    <Route path="/violation-resolver" element={<PageGuard pageKey="violation_resolver"><ViolationResolver /></PageGuard>} />
                                    <Route path="*" element={<NotFound />} />
                                  </Routes>
                                </Suspense>
                              </ErrorBoundary>
                            </DashboardLayout>
                          </ProtectedRoute>
                        }
                      />
                    </Routes>
                  </Suspense>
                </ErrorBoundary>
              </SystemSettingsProvider>
            </LanguageProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
