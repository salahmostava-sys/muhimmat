import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Input } from '@/components/ui/input';
import { Loader2, Eye, EyeOff, Mail, Lock, Sun, Moon } from 'lucide-react';
import { dashboardService } from '@/services/dashboardService';

interface SystemSettings {
  project_name_ar: string;
  project_name_en: string;
  project_subtitle_ar: string;
  project_subtitle_en: string;
  logo_url: string | null;
}

const Login = () => {
  const { signIn } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  useEffect(() => {
    dashboardService.getSystemSettings().then(({ data }) => { if (data) setSettings(data as SystemSettings); });
  }, []);

  const projectName = settings
    ? settings.project_name_ar
    : 'نظام إدارة التوصيل';
  const projectSubtitle = settings
    ? settings.project_subtitle_ar
    : 'إدارة المناديب';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!email || !password) return;
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      const deactivatedMsg = 'هذا الحساب معطّل. تواصل مع المسؤول.';
      if (error.message === deactivatedMsg) {
        setLoginError(deactivatedMsg);
      } else {
        setLoginError('البريد الإلكتروني أو كلمة المرور غير صحيحة');
      }
    } else {
      navigate('/', { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4" dir="rtl">
      {/* Theme toggle */}
      <div className="absolute top-4 left-4 flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground border border-border"
          title={isDark ? 'Light mode' : 'Dark mode'}
        >
          {isDark ? <Sun size={15} className="text-yellow-500" /> : <Moon size={15} />}
        </button>
      </div>

      <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-400">
        {/* Logo / Brand */}
        <div className="flex flex-col items-center mb-8">
          {settings?.logo_url ? (
            <img
              src={settings.logo_url}
              alt="logo"
              className="w-24 h-16 rounded-2xl object-cover mb-3 shadow-lg border border-border"
            />
          ) : (
            <div
              className="w-16 h-16 rounded-2xl mb-3 flex items-center justify-center text-3xl shadow-lg"
              style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))' }}
            >
              🚀
            </div>
          )}
          <h1 className="text-[22px] font-extrabold text-foreground text-center leading-tight">
            {projectName}
          </h1>
          <p className="text-[13px] text-muted-foreground text-center mt-1">
            {projectSubtitle}
          </p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
          <h2 className="text-base font-bold text-foreground mb-5 text-center">
            تسجيل الدخول
          </h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1.5">
                البريد الإلكتروني
              </label>
              <div className="relative">
                <Mail size={15} className="absolute top-1/2 -translate-y-1/2 text-muted-foreground right-3" />
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="example@company.com"
                  required
                  dir="ltr"
                  autoComplete="email"
                  className="h-11 pr-9"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-1.5">
                كلمة المرور
              </label>
              <div className="relative">
                <Lock size={15} className="absolute top-1/2 -translate-y-1/2 text-muted-foreground right-3" />
                <Input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="h-11 pr-9 pl-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors left-3"
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {loginError && (
              <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2.5 animate-in slide-in-from-top-1 fade-in duration-200">
                <span className="text-sm">⚠️</span>
                <p className="text-destructive text-sm">{loginError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl font-bold text-[15px] text-primary-foreground transition-all duration-150 hover:opacity-90 active:scale-[0.99] disabled:opacity-70 flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.85))' }}
            >
              {loading
                ? <><Loader2 size={16} className="animate-spin" /> جاري التحقق...</>
                : 'تسجيل الدخول'
              }
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          {`جميع الحقوق محفوظة © ${new Date().getFullYear()}`}
        </p>
      </div>
    </div>
  );
};

export default Login;
