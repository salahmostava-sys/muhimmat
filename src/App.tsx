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
import ErrorBoundary from "@/components/ErrorBoundary";
import AppLayout from "./components/AppLayout";
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
const SalarySchemes = lazy(() => import("./pages/SalarySchemes"));
const UsersAndPermissions = lazy(() => import("./pages/UsersAndPermissions"));
const GeneralSettings = lazy(() => import("./pages/GeneralSettings"));
const ViolationResolver = lazy(() => import("./pages/ViolationResolver"));
const Motorcycles = lazy(() => import("./pages/Motorcycles"));
const VehicleAssignment = lazy(() => import("./pages/VehicleAssignment"));
const ActivityLog = lazy(() => import("./pages/ActivityLog"));
const Reports = lazy(() => import("./pages/Reports"));
const EmployeeTiers = lazy(() => import("./pages/EmployeeTiers"));
const NotFound = lazy(() => import("./pages/NotFound"));

const PageLoader = () => (
  <div className="min-h-[300px] flex items-center justify-center">
    <Loader2 size={28} className="animate-spin text-primary" />
  </div>
);

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <LanguageProvider>
              <SystemSettingsProvider>
                <ErrorBoundary>
                  <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><Loader2 size={32} className="animate-spin text-primary" /></div>}>
                    <Routes>
                      <Route path="/login" element={<Login />} />
                      <Route path="/forgot-password" element={<ForgotPassword />} />
                      <Route path="/reset-password" element={<ResetPassword />} />
                      <Route
                        path="/*"
                        element={
                          <ProtectedRoute>
                            <AppLayout>
                              <ErrorBoundary>
                                <Suspense fallback={<PageLoader />}>
                                  <Routes>
                                    <Route path="/" element={<Dashboard />} />
                                    <Route path="/employees" element={<Employees />} />
                                    <Route path="/attendance" element={<Attendance />} />
                                    <Route path="/orders" element={<Orders />} />
                                    <Route path="/salaries" element={<Salaries />} />
                                    <Route path="/advances" element={<Advances />} />
                                    <Route path="/motorcycles" element={<Motorcycles />} />
                                    <Route path="/vehicle-assignment" element={<VehicleAssignment />} />
                                    <Route path="/fuel" element={<FuelPage />} />
                                    <Route path="/apps" element={<Apps />} />
                                    <Route path="/alerts" element={<Alerts />} />
                                    <Route path="/reports" element={<Reports />} />
                                    <Route path="/employee-tiers" element={<EmployeeTiers />} />
                                    <Route path="/settings" element={<Navigate to="/settings/schemes" replace />} />
                                    <Route path="/settings/permissions" element={<Navigate to="/settings/users" replace />} />
                                    <Route path="/vehicles" element={<Navigate to="/motorcycles" replace />} />
                                    <Route path="/vehicle-tracking" element={<Navigate to="/motorcycles" replace />} />
                                    <Route path="/deductions" element={<Navigate to="/advances" replace />} />
                                    <Route path="/settings/schemes" element={<SalarySchemes />} />
                                    <Route path="/settings/users" element={<UsersAndPermissions />} />
                                    <Route path="/settings/general" element={<GeneralSettings />} />
                                    <Route path="/analytics" element={<Analytics />} />
                                    <Route path="/violation-resolver" element={<ViolationResolver />} />
                                    <Route path="/activity-log" element={<ActivityLog />} />
                                    <Route path="*" element={<NotFound />} />
                                  </Routes>
                                </Suspense>
                              </ErrorBoundary>
                            </AppLayout>
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
