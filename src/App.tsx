import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { SystemSettingsProvider } from "@/context/SystemSettingsContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import PageGuard from "@/components/PageGuard";
import ErrorBoundary from "@/components/ErrorBoundary";
import DashboardLayout from '@/components/AppLayout';
import AuthLayout from "@/layouts/AuthLayout";
import { Loader2 } from "lucide-react";
import "@/i18n";

const Login = lazy(() => import("./pages/Login"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Employees = lazy(() => import("./pages/Employees"));
const Attendance = lazy(() => import("./pages/Attendance"));
const Orders = lazy(() => import("./pages/Orders"));
const Salaries = lazy(() => import("./pages/Salaries"));
const Advances = lazy(() => import("./pages/Advances"));
const FuelPage = lazy(() => import("./pages/Fuel"));
const Apps = lazy(() => import("./pages/Apps"));
const Alerts = lazy(() => import("./pages/Alerts"));
const SettingsHub = lazy(() => import("./pages/SettingsHub"));
const ViolationResolver = lazy(() => import("./pages/ViolationResolver"));
const Motorcycles = lazy(() => import("./pages/Motorcycles"));
const VehicleAssignment = lazy(() => import("./pages/VehicleAssignment"));
const EmployeeTiers = lazy(() => import("./pages/EmployeeTiers"));
const PlatformAccounts = lazy(() => import("./pages/PlatformAccounts"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const PageLoader = () => (
  <div className="min-h-[300px] flex items-center justify-center">
    <Loader2 size={28} className="animate-spin text-primary" />
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
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
            <LanguageProvider>
              <SystemSettingsProvider>
                <ErrorBoundary>
                  <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><Loader2 size={32} className="animate-spin text-primary" /></div>}>
                    <Routes>
                      <Route path="/login" element={<AuthLayout><Login /></AuthLayout>} />
                      <Route path="/forgot-password" element={<AuthLayout><ForgotPassword /></AuthLayout>} />
                      <Route path="/reset-password" element={<AuthLayout><ResetPassword /></AuthLayout>} />
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

                                    {/* ── Unified Settings Hub ── */}
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
