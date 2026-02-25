import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import Attendance from "./pages/Attendance";
import Orders from "./pages/Orders";
import Salaries from "./pages/Salaries";
import Advances from "./pages/Advances";
import Vehicles from "./pages/Vehicles";
import ProfitLoss from "./pages/ProfitLoss";
import Deductions from "./pages/Deductions";
import Apps from "./pages/Apps";
import Alerts from "./pages/Alerts";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/salaries" element={<Salaries />} />
            <Route path="/advances" element={<Advances />} />
            <Route path="/vehicles" element={<Vehicles />} />
            <Route path="/pl" element={<ProfitLoss />} />
            <Route path="/deductions" element={<Deductions />} />
            <Route path="/apps" element={<Apps />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
