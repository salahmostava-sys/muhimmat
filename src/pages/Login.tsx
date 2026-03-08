import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { Input } from '@/components/ui/input';
import { Loader2, Eye, EyeOff, Mail, Lock, User, CheckCircle2, Languages } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

// ── password strength ─────────────────────────────────────────────
function calcStrength(pw: string): 0 | 1 | 2 | 3 {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  return score as 0 | 1 | 2 | 3;
}

const strengthColors = ['', 'bg-red-500', 'bg-yellow-400', 'bg-green-500'];
const strengthLabelsAr = ['', 'ضعيفة', 'متوسطة', 'قوية'];
const strengthLabelsEn = ['', 'Weak', 'Medium', 'Strong'];
const strengthTextColors = ['', 'text-red-400', 'text-yellow-400', 'text-green-400'];

// ── shared button style ───────────────────────────────────────────
const gradientBtn =
  'w-full h-11 rounded-xl font-bold text-[15px] text-white transition-all duration-150 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70 flex items-center justify-center gap-2';

const Login = () => {
  const { signIn } = useAuth();
  const { lang, toggleLang, isRTL } = useLanguage();
  const navigate = useNavigate();
  const isAr = lang === 'ar';

  // ── tab state ──────────────────────────────────────────────────
  const [tab, setTab] = useState<'login' | 'register'>('login');

  // ── login state ────────────────────────────────────────────────
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // ── register state ─────────────────────────────────────────────
  const [rName, setRName] = useState('');
  const [rEmail, setREmail] = useState('');
  const [rPw, setRPw] = useState('');
  const [rPwConfirm, setRPwConfirm] = useState('');
  const [showRPw, setShowRPw] = useState(false);
  const [showRPwC, setShowRPwC] = useState(false);
  const [rLoading, setRLoading] = useState(false);
  const [rError, setRError] = useState('');
  const [rFieldErrors, setRFieldErrors] = useState<Record<string, string>>({});
  const [rSuccess, setRSuccess] = useState(false);

  const pwStrength = calcStrength(rPw);

  // ── switch tab ─────────────────────────────────────────────────
  const switchTab = (t: 'login' | 'register') => {
    setTab(t);
    // clear all fields & errors
    setEmail(''); setPassword(''); setLoginError('');
    setRName(''); setREmail(''); setRPw(''); setRPwConfirm('');
    setRError(''); setRFieldErrors({}); setRSuccess(false);
  };

  // ── login submit ───────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!email || !password) return;
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) setLoginError(isAr ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة' : 'Invalid email or password');
  };

  // ── register submit ────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};

    if (!rName || rName.trim().length < 3)
      errs.name = isAr ? 'يجب أن يكون الاسم 3 أحرف على الأقل' : 'Name must be at least 3 characters';
    if (!rEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rEmail))
      errs.email = isAr ? 'أدخل بريدًا إلكترونيًا صحيحًا' : 'Please enter a valid email';
    if (!rPw || rPw.length < 8)
      errs.pw = isAr ? 'يجب أن تكون كلمة المرور 8 أحرف على الأقل' : 'Password must be at least 8 characters';
    if (rPw !== rPwConfirm)
      errs.pwc = isAr ? 'كلمة المرور غير متطابقة' : 'Passwords do not match';

    setRFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setRLoading(true);
    setRError('');
    const { data, error } = await supabase.auth.signUp({
      email: rEmail,
      password: rPw,
      options: { data: { full_name: rName.trim() } },
    });
    setRLoading(false);

    if (error) {
      if (error.message.includes('already registered') || error.message.includes('User already'))
        setRError(isAr ? 'هذا البريد الإلكتروني مسجل مسبقاً' : 'This email is already registered');
      else
        setRError(error.message);
      return;
    }

    if (data.session) {
      // auto-logged in — onAuthStateChange handles it
      navigate('/');
    } else {
      setRSuccess(true);
    }
  };

  // ── brand panel data ───────────────────────────────────────────
  const stats = [
    { num: '97', label: isAr ? 'مندوب نشط' : 'Active Riders' },
    { num: '3,720', label: isAr ? 'طلب اليوم' : "Today's Orders" },
    { num: '5', label: isAr ? 'منصات' : 'Platforms' },
  ];
  const features = isAr
    ? ['إدارة المناديب والرواتب بسهولة', 'متابعة الطلبات اليومية لكل منصة', 'تتبع السلف والخصومات تلقائياً', 'تنبيهات فورية لانتهاء الوثائق']
    : ['Manage riders & payroll effortlessly', 'Track daily orders across all platforms', 'Auto-track advances & deductions', 'Instant alerts for document expiry'];

  const inputCls = (hasErr?: boolean) =>
    `bg-[#1a1f2e] border-[#2a2f3e] text-white placeholder:text-gray-600 focus:border-blue-500 focus:ring-blue-500/20 h-11 ${hasErr ? 'border-red-600' : ''}`;

  // ── Login form ─────────────────────────────────────────────────
  const LoginForm = (
    <form onSubmit={handleLogin} className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div>
        <label className="block text-sm text-gray-300 mb-1.5">{isAr ? 'البريد الإلكتروني' : 'Email Address'}</label>
        <div className="relative">
          <Mail size={15} className={`absolute top-1/2 -translate-y-1/2 text-gray-500 ${isRTL ? 'right-3' : 'left-3'}`} />
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="example@company.com" required dir="ltr" autoComplete="email"
            className={`${inputCls()} ${isRTL ? 'pr-9' : 'pl-9'}`} />
        </div>
      </div>

      <div>
        <label className="block text-sm text-gray-300 mb-1.5">{isAr ? 'كلمة المرور' : 'Password'}</label>
        <div className="relative">
          <Lock size={15} className={`absolute top-1/2 -translate-y-1/2 text-gray-500 ${isRTL ? 'right-3' : 'left-3'}`} />
          <Input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
            placeholder="••••••••" required autoComplete="current-password"
            className={`${inputCls()} ${isRTL ? 'pr-9 pl-10' : 'pl-9 pr-10'}`} />
          <button type="button" onClick={() => setShowPw(v => !v)}
            className={`absolute top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors ${isRTL ? 'left-3' : 'right-3'}`}>
            {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm">
          <Link to="/forgot-password" className="text-gray-500 hover:text-gray-300 text-xs transition-colors">
            {isAr ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
          </Link>
        <label className="flex items-center gap-2 text-gray-400 text-xs cursor-pointer">
          <input type="checkbox" className="rounded border-gray-600 bg-[#1a1f2e]" />
          {isAr ? 'تذكرني' : 'Remember me'}
        </label>
      </div>

      {loginError && (
        <div className="flex items-center gap-2 bg-red-950/50 border border-red-800/50 rounded-lg px-3 py-2.5 animate-in slide-in-from-top-1 fade-in duration-200">
          <span className="text-sm">⚠️</span>
          <p className="text-red-400 text-sm">{loginError}</p>
        </div>
      )}

      <button type="submit" disabled={loading} className={gradientBtn}
        style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', boxShadow: '0 4px 20px rgba(59,130,246,0.3)' }}
        onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 25px rgba(59,130,246,0.5)')}
        onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 4px 20px rgba(59,130,246,0.3)')}>
        {loading ? <><Loader2 size={16} className="animate-spin" /> {isAr ? 'جاري التحقق...' : 'Signing in...'}</> : (isAr ? 'تسجيل الدخول' : 'Sign In')}
      </button>
    </form>
  );

  // ── Register form ──────────────────────────────────────────────
  const RegisterForm = rSuccess ? (
    <div className="flex flex-col items-center text-center py-4 space-y-4 animate-in fade-in duration-300">
      <CheckCircle2 size={64} className="text-green-400" />
      <div>
        <p className="text-xl font-bold text-white">{isAr ? 'تم إنشاء الحساب بنجاح! ✓' : 'Account created successfully! ✓'}</p>
        <p className="text-gray-400 text-sm mt-2">
          {isAr ? 'تم إرسال رابط التأكيد إلى بريدك الإلكتروني' : 'A confirmation link was sent to your email'}
        </p>
        <p className="text-gray-500 text-xs mt-1">
          {isAr ? 'يرجى التحقق من بريدك ثم تسجيل الدخول' : 'Please verify your email then sign in'}
        </p>
      </div>
      <button onClick={() => switchTab('login')} className={gradientBtn}
        style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', boxShadow: '0 4px 20px rgba(59,130,246,0.3)' }}>
        {isAr ? 'العودة لتسجيل الدخول' : 'Back to Sign In'}
      </button>
    </div>
  ) : (
    <form onSubmit={handleRegister} className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Full name */}
      <div>
        <label className="block text-sm text-gray-300 mb-1.5">{isAr ? 'الاسم الكامل' : 'Full Name'}</label>
        <div className="relative">
          <User size={15} className={`absolute top-1/2 -translate-y-1/2 text-gray-500 ${isRTL ? 'right-3' : 'left-3'}`} />
          <Input value={rName} onChange={e => setRName(e.target.value)}
            placeholder={isAr ? 'أدخل اسمك الكامل' : 'Enter your full name'}
            className={`${inputCls(!!rFieldErrors.name)} ${isRTL ? 'pr-9' : 'pl-9'}`} />
        </div>
        {rFieldErrors.name && <p className="text-red-400 text-xs mt-1">{rFieldErrors.name}</p>}
      </div>

      {/* Email */}
      <div>
        <label className="block text-sm text-gray-300 mb-1.5">{isAr ? 'البريد الإلكتروني' : 'Email Address'}</label>
        <div className="relative">
          <Mail size={15} className={`absolute top-1/2 -translate-y-1/2 text-gray-500 ${isRTL ? 'right-3' : 'left-3'}`} />
          <Input type="email" value={rEmail} onChange={e => setREmail(e.target.value)}
            placeholder="example@company.com" dir="ltr" autoComplete="email"
            className={`${inputCls(!!rFieldErrors.email)} ${isRTL ? 'pr-9' : 'pl-9'}`} />
        </div>
        {rFieldErrors.email && <p className="text-red-400 text-xs mt-1">{rFieldErrors.email}</p>}
      </div>

      {/* Password */}
      <div>
        <label className="block text-sm text-gray-300 mb-1.5">{isAr ? 'كلمة المرور' : 'Password'}</label>
        <div className="relative">
          <Lock size={15} className={`absolute top-1/2 -translate-y-1/2 text-gray-500 ${isRTL ? 'right-3' : 'left-3'}`} />
          <Input type={showRPw ? 'text' : 'password'} value={rPw} onChange={e => setRPw(e.target.value)}
            placeholder="••••••••" autoComplete="new-password"
            className={`${inputCls(!!rFieldErrors.pw)} ${isRTL ? 'pr-9 pl-10' : 'pl-9 pr-10'}`} />
          <button type="button" onClick={() => setShowRPw(v => !v)}
            className={`absolute top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors ${isRTL ? 'left-3' : 'right-3'}`}>
            {showRPw ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        {rPw && (
          <div className="mt-2 space-y-1">
            <div className="flex gap-1">
              {[1, 2, 3].map(i => (
                <div key={i} className={`h-1 flex-1 rounded-full transition-colors duration-200 ${pwStrength >= i ? strengthColors[pwStrength] : 'bg-gray-700'}`} />
              ))}
            </div>
            <p className={`text-xs ${strengthTextColors[pwStrength]}`}>
              {isAr ? strengthLabelsAr[pwStrength] : strengthLabelsEn[pwStrength]}
            </p>
          </div>
        )}
        {rFieldErrors.pw && <p className="text-red-400 text-xs mt-1">{rFieldErrors.pw}</p>}
      </div>

      {/* Confirm password */}
      <div>
        <label className="block text-sm text-gray-300 mb-1.5">{isAr ? 'تأكيد كلمة المرور' : 'Confirm Password'}</label>
        <div className="relative">
          <Lock size={15} className={`absolute top-1/2 -translate-y-1/2 text-gray-500 ${isRTL ? 'right-3' : 'left-3'}`} />
          <Input type={showRPwC ? 'text' : 'password'} value={rPwConfirm} onChange={e => setRPwConfirm(e.target.value)}
            placeholder="••••••••" autoComplete="new-password"
            className={`${inputCls(!!rFieldErrors.pwc)} ${isRTL ? 'pr-9 pl-10' : 'pl-9 pr-10'}`} />
          <button type="button" onClick={() => setShowRPwC(v => !v)}
            className={`absolute top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors ${isRTL ? 'left-3' : 'right-3'}`}>
            {showRPwC ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        {rFieldErrors.pwc && <p className="text-red-400 text-xs mt-1">{rFieldErrors.pwc}</p>}
      </div>

      {rError && (
        <div className="flex items-center gap-2 bg-red-950/50 border border-red-800/50 rounded-lg px-3 py-2.5 animate-in slide-in-from-top-1 fade-in duration-200">
          <span className="text-sm">⚠️</span>
          <p className="text-red-400 text-sm">{rError}</p>
        </div>
      )}

      <button type="submit" disabled={rLoading} className={gradientBtn}
        style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', boxShadow: '0 4px 20px rgba(59,130,246,0.3)' }}
        onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 25px rgba(59,130,246,0.5)')}
        onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 4px 20px rgba(59,130,246,0.3)')}>
        {rLoading ? <><Loader2 size={16} className="animate-spin" /> {isAr ? 'جاري إنشاء الحساب...' : 'Creating account...'}</> : (isAr ? 'إنشاء الحساب' : 'Create Account')}
      </button>
    </form>
  );

  // ── Form panel ─────────────────────────────────────────────────
  const FormPanel = (
    <div className="flex flex-col justify-center items-center px-8 py-10 min-h-screen bg-[#0f1117]"
      style={{ animation: 'slideInLeft 0.4s ease-out both' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl mb-3 flex items-center justify-center text-3xl shadow-lg"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>🚀</div>
          <h1 className="text-[22px] font-extrabold text-white text-center">
            {isAr ? 'نظام إدارة التوصيل' : 'Delivery Management System'}
          </h1>
          <p className="text-[13px] text-gray-400 text-center mt-1">
            {isAr ? 'مرحباً بك — سجّل دخولك للمتابعة' : 'Welcome back — sign in to continue'}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-[#1a1f2e] rounded-xl p-1 mb-6" dir="ltr">
          {(['login', 'register'] as const).map(t => {
            const label = t === 'login'
              ? (isAr ? 'تسجيل الدخول' : 'Sign In')
              : (isAr ? 'حساب جديد' : 'Create Account');
            const active = tab === t;
            return (
              <button key={t} onClick={() => switchTab(t)}
                className="flex-1 h-9 rounded-lg text-sm font-semibold transition-all duration-200"
                style={active ? { background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: '#fff', boxShadow: '0 2px 12px rgba(59,130,246,0.4)' } : { color: '#9ca3af' }}>
                {label}
              </button>
            );
          })}
        </div>

        {/* Form content */}
        <div className="animate-in fade-in duration-200">
          {tab === 'login' ? LoginForm : RegisterForm}
        </div>

        <p className="text-center text-xs text-gray-600 mt-8">
          {isAr ? 'جميع الحقوق محفوظة © 2025' : '© 2025 All rights reserved'}
        </p>
      </div>
    </div>
  );

  // ── Brand panel ────────────────────────────────────────────────
  const BrandPanel = (
    <div className="hidden md:flex flex-col justify-center items-center px-10 py-10 relative overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at 80% 20%, rgba(59,130,246,0.15) 0%, transparent 50%), radial-gradient(ellipse at 20% 80%, rgba(139,92,246,0.15) 0%, transparent 50%), linear-gradient(135deg, #1a1f35 0%, #0f1117 100%)',
        animation: 'slideInRight 0.4s ease-out 0.1s both',
      }}>
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }} />
      <div className="absolute bottom-1/4 left-1/3 w-40 h-40 rounded-full blur-2xl opacity-15 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)' }} />

      <div className="relative z-10 text-center max-w-xs">
        <div className="relative inline-block mb-8">
          <div className="w-28 h-28 rounded-full flex items-center justify-center"
            style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.2) 0%, transparent 70%)' }}>
            <span style={{ fontSize: 72 }}>🏍️</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-0 mb-8">
          {stats.map((s, i) => (
            <div key={i} className="flex items-center">
              <div className="text-center px-5">
                <div className="text-3xl font-black text-white">{s.num}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
              </div>
              {i < stats.length - 1 && <div className="w-px h-10 bg-white/10" />}
            </div>
          ))}
        </div>

        <div className="space-y-2.5 mb-8 text-right" dir={isRTL ? 'rtl' : 'ltr'}>
          {features.map((f, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: i % 2 === 0 ? '#3b82f6' : '#8b5cf6' }} />
              <span className="text-[13px] text-gray-300">{f}</span>
            </div>
          ))}
        </div>

        <p className="text-[13px] italic" style={{ color: 'rgba(255,255,255,0.3)' }}>
          {isAr ? '"كل شيء في مكان واحد — لإدارة أذكى"' : '"Everything in one place — smarter management"'}
        </p>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes slideInLeft { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes slideInRight { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>

      <div className="min-h-screen flex" dir={isRTL ? 'rtl' : 'ltr'} style={{ background: '#0f1117' }}>
        {/* Language toggle */}
        <button onClick={toggleLang}
          className="fixed top-4 left-4 z-50 flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white text-xs font-medium px-3 py-1.5 rounded-full transition-colors">
          <Languages size={13} />
          {lang === 'ar' ? 'EN' : 'عربي'}
        </button>

        {isRTL ? (
          <>
            <div className="w-full md:w-[40%]">{FormPanel}</div>
            <div className="flex-1">{BrandPanel}</div>
          </>
        ) : (
          <>
            <div className="flex-1">{BrandPanel}</div>
            <div className="w-full md:w-[40%]">{FormPanel}</div>
          </>
        )}
      </div>
    </>
  );
};

export default Login;
