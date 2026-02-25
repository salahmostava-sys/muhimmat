import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Clock,
  Package,
  Wallet,
  CreditCard,
  Bike,
  FileDown,
  BarChart3,
  Settings,
  Bell,
  Smartphone,
  TrendingUp,
} from 'lucide-react';

const navItems = [
  { label: 'لوحة التحكم', icon: LayoutDashboard, path: '/' },
  { label: 'الموظفون', icon: Users, path: '/employees' },
  { label: 'الحضور والانصراف', icon: Clock, path: '/attendance' },
  { label: 'الطلبات اليومية', icon: Package, path: '/orders' },
  { label: 'الرواتب', icon: Wallet, path: '/salaries' },
  { label: 'السلف والأقساط', icon: CreditCard, path: '/advances' },
  { label: 'المركبات', icon: Bike, path: '/vehicles' },
  { label: 'الأرباح والخسائر', icon: TrendingUp, path: '/pl' },
  { label: 'الخصومات', icon: FileDown, path: '/deductions' },
  { label: 'التطبيقات', icon: Smartphone, path: '/apps' },
  { label: 'التنبيهات', icon: Bell, path: '/alerts' },
  { label: 'التقارير', icon: BarChart3, path: '/reports' },
  { label: 'الإعدادات', icon: Settings, path: '/settings' },
];

const AppSidebar = () => {
  const location = useLocation();

  return (
    <aside className="fixed top-0 right-0 h-screen w-64 bg-sidebar text-sidebar-foreground flex flex-col z-50">
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <h1 className="text-xl font-bold text-sidebar-primary-foreground">
          🚀 نظام التوصيل
        </h1>
        <p className="text-xs text-sidebar-muted mt-1">إدارة متكاملة للمناديب</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              }`}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground text-sm font-bold">
            أ
          </div>
          <div>
            <p className="text-sm font-medium text-sidebar-accent-foreground">أدمن</p>
            <p className="text-xs text-sidebar-muted">مدير النظام</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default AppSidebar;
