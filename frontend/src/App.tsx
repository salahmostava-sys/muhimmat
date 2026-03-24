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
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Employees = lazy(() => import("./pages/Employees"));
const Attendance = lazy(() => import("./pages/Attendance"));
const Orders = lazy(() => import("./pages/Orders"));
const Salaries = lazy(() => import("./pages/Salaries"));
const SettingsHub = lazy(() => import("./pages/SettingsHub"));
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

                                    {/* ── Unified Settings Hub ── */}
                                    <Route path="/settings" element={<PageGuard pageKey="settings"><SettingsHub /></PageGuard>} />
                                    <Route path="/settings/*" element={<Navigate to="/settings" replace />} />
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
