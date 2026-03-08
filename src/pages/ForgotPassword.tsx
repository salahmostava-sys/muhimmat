import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Loader2, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';

const gradientBtn =
  'w-full h-11 rounded-xl font-bold text-[15px] text-white transition-all duration-150 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70 flex items-center justify-center gap-2';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('يرجى إدخال بريد إلكتروني صحيح');
      return;
    }

    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);

    if (err) {
      setError('حدث خطأ، يرجى المحاولة مجدداً');
    } else {
      setSuccess(true);
    }
  };

  return (
    <>
      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0f1117' }}>
        <div
          className="w-full max-w-sm bg-[#141720] border border-white/5 rounded-2xl p-8 shadow-2xl"
          style={{ animation: 'fadeInUp 0.35s ease-out both' }}
        >
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl mb-4 flex items-center justify-center text-3xl shadow-lg"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>🔑</div>
            <h1 className="text-xl font-extrabold text-white text-center">نسيت كلمة المرور؟</h1>
            <p className="text-gray-400 text-sm text-center mt-1 leading-relaxed">
              أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين
            </p>
          </div>

          {success ? (
            <div className="flex flex-col items-center text-center space-y-4 animate-in fade-in duration-300" dir="rtl">
              <CheckCircle2 size={56} className="text-green-400" />
              <div>
                <p className="text-lg font-bold text-white">تم إرسال الرابط!</p>
                <p className="text-gray-400 text-sm mt-2 leading-relaxed">
                  إذا كان البريد <span className="text-blue-400 font-mono text-xs">{email}</span> مسجلاً لدينا، ستصلك رسالة بها رابط إعادة تعيين كلمة المرور.
                </p>
                <p className="text-gray-600 text-xs mt-2">تأكد من مجلد البريد المزعج أيضاً</p>
              </div>
              <Link to="/login"
                className="mt-2 flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors">
                <ArrowRight size={14} />
                العودة لتسجيل الدخول
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" dir="rtl">
              <div>
                <label className="block text-sm text-gray-300 mb-1.5">البريد الإلكتروني</label>
                <div className="relative">
                  <Mail size={15} className="absolute top-1/2 -translate-y-1/2 right-3 text-gray-500" />
                  <Input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="example@company.com"
                    dir="ltr"
                    autoComplete="email"
                    className="bg-[#1a1f2e] border-[#2a2f3e] text-white placeholder:text-gray-600 focus:border-blue-500 focus:ring-blue-500/20 h-11 pr-9"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-950/50 border border-red-800/50 rounded-lg px-3 py-2.5 animate-in slide-in-from-top-1 fade-in duration-200">
                  <span className="text-sm">⚠️</span>
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={gradientBtn}
                style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', boxShadow: '0 4px 20px rgba(59,130,246,0.3)' }}
              >
                {loading
                  ? <><Loader2 size={16} className="animate-spin" /> جاري الإرسال...</>
                  : 'إرسال رابط إعادة التعيين'}
              </button>

              <div className="text-center">
                <Link to="/login" className="text-sm text-gray-500 hover:text-gray-300 transition-colors flex items-center justify-center gap-1.5">
                  <ArrowRight size={13} />
                  العودة لتسجيل الدخول
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
};

export default ForgotPassword;
