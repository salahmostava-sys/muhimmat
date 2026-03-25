import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Eye, EyeOff, Sun, Moon, Rocket, AlertCircle } from 'lucide-react';
import { dashboardService } from '@/services/dashboardService';
import { loadRememberedEmail, persistRememberedEmail } from '@/lib/loginRememberStorage';
import './login.css';

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
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  useEffect(() => {
    dashboardService.getSystemSettings().then(({ data }) => {
      if (data) setSettings(data as SystemSettings);
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
        console.error('[Login] loadRememberedEmail failed', e);
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
    let error: { message: string } | null = null;
    try {
      const res = await signIn(email, password);
      error = res.error;
    } catch (err) {
      console.error('[Login] signIn threw', err);
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
        console.error('[Login] persistRememberedEmail failed', e);
      }
      navigate('/', { replace: true });
    }
  };

  const inputClass =
    'min-h-[56px] py-4 px-4 text-lg md:text-lg font-semibold leading-normal rounded-xl border-border bg-background shadow-sm focus-visible:ring-2 focus-visible:ring-primary/30 [&::placeholder]:text-base [&::placeholder]:font-normal [&::placeholder]:opacity-70';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10" dir="rtl">
      <div className="fixed top-4 left-4 z-50">
        <button
          type="button"
          onClick={toggleTheme}
          className="h-10 w-10 flex items-center justify-center rounded-xl hover:bg-muted transition-colors text-muted-foreground border border-border shadow-sm bg-card/80 backdrop-blur-sm"
          title={isDark ? 'الوضع الفاتح' : 'الوضع الداكن'}
          aria-label={isDark ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن'}
        >
          {isDark ? <Sun size={18} className="text-amber-500" /> : <Moon size={18} />}
        </button>
      </div>

      <div className="w-full max-w-xl animate-in fade-in slide-in-from-bottom-4 duration-400">
        <header className="flex flex-col items-center text-center mb-8 px-4">
          {settings?.logo_url ? (
            <img
              src={settings.logo_url}
              alt=""
              className="shrink-0 w-[4.5rem] h-[4.5rem] sm:w-[5rem] sm:h-[5rem] rounded-2xl object-contain shadow-md border border-border bg-card p-1 mb-4"
            />
          ) : (
            <div
              className="login-brand-mark shrink-0 w-[4.5rem] h-[4.5rem] sm:w-[5rem] sm:h-[5rem] rounded-2xl flex items-center justify-center text-primary-foreground shadow-md mb-4"
              aria-hidden
            >
              <Rocket className="h-10 w-10 sm:h-12 sm:w-12" strokeWidth={2} aria-hidden />
            </div>
          )}
          <div className="min-w-0 w-full max-w-md">
            <h1 className="text-xl sm:text-2xl font-extrabold text-foreground leading-tight tracking-tight">
              {projectName}
            </h1>
            <p className="text-sm sm:text-[15px] text-muted-foreground mt-1.5 leading-relaxed">
              {projectSubtitle}
            </p>
          </div>
        </header>

        <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-xl">
          <h2 className="text-lg font-bold text-foreground mb-6 text-center">تسجيل الدخول</h2>

          <form onSubmit={handleLogin} className="space-y-6" noValidate aria-describedby={loginError ? 'login-error' : undefined}>
            <div className="space-y-2">
              <label htmlFor="login-email" className="block text-[16px] font-semibold text-foreground text-start">
                البريد الإلكتروني
              </label>
              <Input
                id="login-email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@company.com"
                required
                dir="ltr"
                autoComplete="email"
                aria-label="البريد الإلكتروني"
                aria-invalid={!!loginError}
                aria-errormessage={loginError ? 'login-error' : undefined}
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="login-password" className="block text-[16px] font-semibold text-foreground text-start">
                كلمة المرور
              </label>
              {/* dir=ltr: toggle على اليسار البصري، والنص يبدأ بعد مساحة الأيقونة */}
              <div className="relative flex w-full rounded-xl" dir="ltr">
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="pointer-events-auto absolute start-3 top-1/2 z-20 -translate-y-1/2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/90 transition-colors"
                  aria-label={showPw ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  aria-pressed={showPw}
                >
                  {showPw ? <EyeOff size={22} className="shrink-0" strokeWidth={2} /> : <Eye size={22} className="shrink-0" strokeWidth={2} />}
                </button>
                <Input
                  id="login-password"
                  name="password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  dir="ltr"
                  autoComplete="current-password"
                  aria-label="كلمة المرور"
                  aria-invalid={!!loginError}
                  aria-errormessage={loginError ? 'login-error' : undefined}
                  className={`${inputClass} w-full ps-[4.75rem] pe-5`}
                />
              </div>
            </div>

            <div className="login-remember-row flex w-full flex-row items-center justify-start gap-3 pt-1 pb-2">
              <Checkbox
                id="remember-me"
                checked={rememberMe}
                onCheckedChange={(v) => setRememberMe(v === true)}
                className="h-5 w-5 shrink-0 rounded-md border-2 border-primary data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <label
                htmlFor="remember-me"
                className="text-[16px] font-medium text-foreground cursor-pointer select-none leading-relaxed flex-1 min-w-0 text-start"
              >
                تذكرني على هذا الجهاز
              </label>
            </div>

            {loginError && (
              <div
                id="login-error"
                role="alert"
                className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-xl px-3 py-2.5 animate-in slide-in-from-top-1 fade-in duration-200"
              >
                <AlertCircle className="h-5 w-5 shrink-0 text-destructive" aria-hidden />
                <p className="text-destructive text-sm text-start leading-relaxed">{loginError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="login-submit-btn mt-2 w-full min-h-[56px] rounded-xl font-bold text-lg text-primary-foreground shadow-md transition-all duration-200 hover:shadow-lg hover:brightness-[1.03] active:scale-[0.99] disabled:opacity-70 disabled:pointer-events-none disabled:hover:shadow-md flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin shrink-0" aria-hidden />
                  <span>جاري التحقق...</span>
                </>
              ) : (
                'تسجيل الدخول'
              )}
            </button>
          </form>

          <nav
            className="mt-8 pt-6 border-t border-border/80 flex flex-col sm:flex-row items-center justify-center gap-5 sm:gap-10 text-center"
            aria-label="روابط إضافية"
          >
            <Link
              to="/forgot-password"
              className="text-[15px] font-semibold text-primary hover:underline underline-offset-4 decoration-2 transition-colors"
            >
              نسيت كلمة المرور؟
            </Link>
            <a
              href="mailto:?subject=%D8%B7%D9%84%D8%A8%20%D8%AD%D8%B3%D8%A7%D8%A8%20%D8%AC%D8%AF%D9%8A%D8%AF%20%D9%81%D9%8A%20%D9%85%D9%87%D9%85%D8%A9%20%D8%A7%D9%84%D8%AA%D9%88%D8%B5%D9%8A%D9%84"
              className="text-[15px] font-medium text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors"
            >
              طلب إنشاء حساب
            </a>
          </nav>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          {`جميع الحقوق محفوظة © ${new Date().getFullYear()}`}
        </p>
      </div>
    </div>
  );
};

export default Login;
