import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, EyeOff, Mail, Lock, Languages } from 'lucide-react';

const Login = () => {
  const { signIn } = useAuth();
  const { lang, toggleLang, isRTL } = useLanguage();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isAr = lang === 'ar';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) return;
    setLoading(true);
    const { error: authError } = await signIn(email, password);
    setLoading(false);
    if (authError) {
      setError(isAr ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة' : 'Invalid email or password');
    }
  };

  const stats = [
    { num: '97', label: isAr ? 'مندوب نشط' : 'Active Riders' },
    { num: '3,720', label: isAr ? 'طلب اليوم' : "Today's Orders" },
    { num: '5', label: isAr ? 'منصات' : 'Platforms' },
  ];

  const features = isAr ? [
    'إدارة المناديب والرواتب بسهولة',
    'متابعة الطلبات اليومية لكل منصة',
    'تتبع السلف والخصومات تلقائياً',
    'تنبيهات فورية لانتهاء الوثائق',
  ] : [
    'Manage riders & payroll effortlessly',
    'Track daily orders across all platforms',
    'Auto-track advances & deductions',
    'Instant alerts for document expiry',
  ];

  const FormPanel = (
    <div
      className="flex flex-col justify-center items-center px-8 py-10 min-h-screen bg-[#0f1117]"
      style={{ animation: 'slideInLeft 0.4s ease-out both' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl mb-3 flex items-center justify-center text-3xl shadow-lg"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
            🚀
          </div>
          <h1 className="text-[22px] font-extrabold text-white text-center">
            {isAr ? 'نظام إدارة التوصيل' : 'Delivery Management System'}
          </h1>
          <p className="text-[13px] text-gray-400 text-center mt-1">
            {isAr ? 'مرحباً بك — سجّل دخولك للمتابعة' : 'Welcome back — sign in to continue'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
          {/* Email */}
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">
              {isAr ? 'البريد الإلكتروني' : 'Email Address'}
            </label>
            <div className="relative">
              <Mail size={15} className={`absolute top-1/2 -translate-y-1/2 text-gray-500 ${isRTL ? 'right-3' : 'left-3'}`} />
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={isAr ? 'example@company.com' : 'example@company.com'}
                required
                dir="ltr"
                autoComplete="email"
                className={`bg-[#1a1f2e] border-[#2a2f3e] text-white placeholder:text-gray-600 focus:border-blue-500 focus:ring-blue-500/20 h-11 ${isRTL ? 'pr-9' : 'pl-9'}`}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">
              {isAr ? 'كلمة المرور' : 'Password'}
            </label>
            <div className="relative">
              <Lock size={15} className={`absolute top-1/2 -translate-y-1/2 text-gray-500 ${isRTL ? 'right-3' : 'left-3'}`} />
              <Input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className={`bg-[#1a1f2e] border-[#2a2f3e] text-white placeholder:text-gray-600 focus:border-blue-500 focus:ring-blue-500/20 h-11 ${isRTL ? 'pr-9 pl-10' : 'pl-9 pr-10'}`}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className={`absolute top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors ${isRTL ? 'left-3' : 'right-3'}`}
              >
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Remember + Forgot */}
          <div className="flex items-center justify-between text-sm">
            <button type="button" className="text-gray-500 hover:text-gray-300 text-xs transition-colors">
              {isAr ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
            </button>
            <label className="flex items-center gap-2 text-gray-400 text-xs cursor-pointer">
              <input type="checkbox" className="rounded border-gray-600 bg-[#1a1f2e]" />
              {isAr ? 'تذكرني' : 'Remember me'}
            </label>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 bg-red-950/50 border border-red-800/50 rounded-lg px-3 py-2.5 animate-in slide-in-from-top-1 fade-in duration-200">
              <span className="text-sm">⚠️</span>
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-xl font-bold text-[15px] text-white transition-all duration-150 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70 flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', boxShadow: '0 4px 20px rgba(59,130,246,0.3)' }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 25px rgba(59,130,246,0.5)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 4px 20px rgba(59,130,246,0.3)')}
          >
            {loading ? (
              <><Loader2 size={16} className="animate-spin" /> {isAr ? 'جاري التحقق...' : 'Signing in...'}</>
            ) : (
              isAr ? 'تسجيل الدخول' : 'Sign In'
            )}
          </button>
        </form>

        <p className="text-center text-xs text-gray-600 mt-8">
          {isAr ? 'جميع الحقوق محفوظة © 2025' : '© 2025 All rights reserved'}
        </p>
      </div>
    </div>
  );

  const BrandPanel = (
    <div
      className="hidden md:flex flex-col justify-center items-center px-10 py-10 relative overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at 80% 20%, rgba(59,130,246,0.15) 0%, transparent 50%), radial-gradient(ellipse at 20% 80%, rgba(139,92,246,0.15) 0%, transparent 50%), linear-gradient(135deg, #1a1f35 0%, #0f1117 100%)',
        animation: 'slideInRight 0.4s ease-out 0.1s both',
      }}
    >
      {/* bg glow circles */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }} />
      <div className="absolute bottom-1/4 left-1/3 w-40 h-40 rounded-full blur-2xl opacity-15 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)' }} />

      <div className="relative z-10 text-center max-w-xs">
        {/* Main visual */}
        <div className="relative inline-block mb-8">
          <div className="w-28 h-28 rounded-full flex items-center justify-center"
            style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.2) 0%, transparent 70%)', filter: 'blur(0px)' }}>
            <span style={{ fontSize: 72 }}>🏍️</span>
          </div>
        </div>

        {/* Stats */}
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

        {/* Features */}
        <div className="space-y-2.5 mb-8 text-right" dir={isRTL ? 'rtl' : 'ltr'}>
          {features.map((f, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: i % 2 === 0 ? '#3b82f6' : '#8b5cf6' }} />
              <span className="text-[13px] text-gray-300">{f}</span>
            </div>
          ))}
        </div>

        {/* Quote */}
        <p className="text-[13px] italic" style={{ color: 'rgba(255,255,255,0.3)' }}>
          {isAr ? '"كل شيء في مكان واحد — لإدارة أذكى"' : '"Everything in one place — smarter management"'}
        </p>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <div className="min-h-screen flex" dir={isRTL ? 'rtl' : 'ltr'} style={{ background: '#0f1117' }}>
        {/* Language toggle */}
        <button
          onClick={toggleLang}
          className="fixed top-4 left-4 z-50 flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
        >
          <Languages size={13} />
          {lang === 'ar' ? 'EN' : 'عربي'}
        </button>

        {/* Layout: RTL = form left, panel right | LTR = panel left, form right */}
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
