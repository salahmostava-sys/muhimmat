import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@app/providers/AuthContext';
import { useTheme } from '@app/providers/ThemeContext';
import { Input } from '@shared/components/ui/input';
import { Checkbox } from '@shared/components/ui/checkbox';
import { Loader2, Eye, EyeOff, Mail, Lock, Sun, Moon } from 'lucide-react';
import { dashboardService } from '@services/dashboardService';
import { loadRememberedEmail, persistRememberedEmail } from '@shared/lib/loginRememberStorage';
import { logError } from '@shared/lib/logger';
import { brandLogoSrc } from '@shared/lib/brandLogo';
import './login.css';

interface SystemSettings {
  project_name_ar: string;
  project_name_en: string;
  project_subtitle_ar: string;
  project_subtitle_en: string;
  logo_url: string | null;
  updated_at?: string | null;
}

const Login = () => {
  const { signIn } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  useEffect(() => {
    dashboardService.getSystemSettings().then((data) => {
      if (!data) return;
      setSettings({
        project_name_ar: data.project_name_ar ?? '',
        project_name_en: data.project_name_en ?? '',
        project_subtitle_ar: data.project_subtitle_ar ?? '',
        project_subtitle_en: data.project_subtitle_en ?? '',
        logo_url: data.logo_url ?? null,
        updated_at: (data as { updated_at?: string | null }).updated_at ?? null,
      });
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { email: storedEmail, remember } = await loadRememberedEmail();
        if (cancelled) return;
        setRememberMe(remember);
        if (storedEmail) setEmail(storedEmail);
      } catch (e) {
        logError('[Login] loadRememberedEmail failed', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const projectName = settings ? settings.project_name_ar : 'مهمة التوصيل';
  const projectSubtitle = settings ? settings.project_subtitle_ar : 'إدارة المناديب';

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginError('');
    if (!email || !password) return;
    setLoading(true);
    let error: { message: string } | null;
    try {
      const res = await signIn(email, password);
      error = res.error;
    } catch (err) {
      logError('[Login] signIn threw', err);
      error = { message: 'تعذّر إكمال تسجيل الدخول. حاول مرة أخرى.' };
    } finally {
      setLoading(false);
    }
    if (error) {
      const deactivatedMsg = 'هذا الحساب معطّل. تواصل مع المسؤول.';
      if (error.message === deactivatedMsg) {
        setLoginError(deactivatedMsg);
      } else {
        setLoginError('البريد الإلكتروني أو كلمة المرور غير صحيحة');
      }
    } else {
      try {
        await persistRememberedEmail(email.trim(), rememberMe);
      } catch (e) {
        logError('[Login] persistRememberedEmail failed', e);
      }
      navigate('/', { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4" dir="rtl">
      <div className="absolute top-4 left-4 flex items-center gap-2">
        <button
          type="button"
          onClick={toggleTheme}
          className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground border border-border"
          title={isDark ? 'Light mode' : 'Dark mode'}
        >
          {isDark ? <Sun size={15} className="text-yellow-500" /> : <Moon size={15} />}
        </button>
      </div>

      <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-400">
        <div className="flex flex-col items-center mb-8">
          {settings?.logo_url ? (
            <img
              src={brandLogoSrc(settings.logo_url, settings.updated_at)}
              alt="logo"
              className="w-[8.5rem] h-[5.5rem] sm:w-40 sm:h-28 rounded-2xl object-contain mb-4 shadow-lg border border-border bg-card p-1"
            />
          ) : (
            <div
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl mb-4 flex items-center justify-center text-5xl sm:text-6xl shadow-lg"
              style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))' }}
            >
              🚀
            </div>
          )}
          <h1 className="text-2xl sm:text-[26px] font-extrabold text-foreground text-center leading-tight">
            {projectName}
          </h1>
          <p className="text-sm sm:text-[15px] text-muted-foreground text-center mt-1.5">
            {projectSubtitle}
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
          <h2 className="text-base font-bold text-foreground mb-5 text-center">
            تسجيل الدخول
          </h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-base font-medium text-muted-foreground mb-2">
                البريد الإلكتروني
              </label>
              <div className="relative">
                <Mail size={18} className="absolute top-1/2 -translate-y-1/2 text-muted-foreground right-3.5 pointer-events-none" />
                <Input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="example@company.com"
                  required
                  dir="ltr"
                  autoComplete="email"
                  className="h-12 pr-11 text-base sm:text-lg"
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="block text-base font-medium text-muted-foreground mb-2">
                كلمة المرور
              </label>
              <div className="relative">
                <Lock size={18} className="absolute top-1/2 -translate-y-1/2 text-muted-foreground right-3.5 pointer-events-none" />
                <Input
                  id="login-password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="h-12 pr-11 pl-11 text-base sm:text-lg"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors left-3.5"
                  aria-label={showPw ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2.5 justify-start pt-0.5">
              <label
                htmlFor="remember-me"
                className="text-base text-foreground cursor-pointer select-none leading-snug"
              >
                تذكرني على هذا الجهاز
              </label>
              <Checkbox
                id="remember-me"
                checked={rememberMe}
                onCheckedChange={v => setRememberMe(v === true)}
                className="h-5 w-5 rounded-md"
              />
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
              className="w-full h-12 rounded-xl font-bold text-base sm:text-lg text-primary-foreground transition-all duration-150 hover:opacity-90 active:scale-[0.99] disabled:opacity-70 flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.85))' }}
            >
              {loading
                ? <><Loader2 size={18} className="animate-spin" /> جاري التحقق...</>
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
