import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { SystemSettingsProvider } from "@/context/SystemSettingsContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import Attendance from "./pages/Attendance";
import Orders from "./pages/Orders";
import Salaries from "./pages/Salaries";
import Advances from "./pages/Advances";
import Vehicles from "./pages/Vehicles";
import FuelPage from "./pages/Fuel";
import Apps from "./pages/Apps";
import Alerts from "./pages/Alerts";
import SalarySchemes from "./pages/SalarySchemes";
import UsersAndPermissions from "./pages/UsersAndPermissions";
import GeneralSettings from "./pages/GeneralSettings";
import Analytics from "./pages/Analytics";
import ViolationResolver from "./pages/ViolationResolver";
import NotFound from "./pages/NotFound";
import "@/i18n";

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
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route
                    path="/*"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <Routes>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/employees" element={<Employees />} />
                            <Route path="/attendance" element={<Attendance />} />
                            <Route path="/orders" element={<Orders />} />
                            <Route path="/salaries" element={<Salaries />} />
                            <Route path="/advances" element={<Advances />} />
                            <Route path="/vehicles" element={<Vehicles />} />
                            <Route path="/vehicle-tracking" element={<Vehicles />} />
                            <Route path="/fuel" element={<FuelPage />} />
                            <Route path="/deductions" element={<Advances />} />
                            <Route path="/apps" element={<Apps />} />
                            <Route path="/alerts" element={<Alerts />} />
                            <Route path="/settings" element={<SalarySchemes />} />
                            <Route path="/settings/schemes" element={<SalarySchemes />} />
                            <Route path="/settings/users" element={<UsersAndPermissions />} />
                            <Route path="/settings/permissions" element={<UsersAndPermissions />} />
                            <Route path="/settings/general" element={<GeneralSettings />} />
                            <Route path="/analytics" element={<Analytics />} />
                            <Route path="/violation-resolver" element={<ViolationResolver />} />
                            <Route path="*" element={<NotFound />} />
                          </Routes>
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                </Routes>
              </SystemSettingsProvider>
            </LanguageProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
