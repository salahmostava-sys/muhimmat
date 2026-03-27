import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Loader2, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Input } from '@shared/components/ui/input';
import { authService } from '@services/authService';
import { authGradientBtn, authBtnStyle } from '@shared/lib/authStyles';

const isValidEmail = (value: string): boolean => {
  const trimmed = value.trim();
  const atIndex = trimmed.indexOf('@');
  if (atIndex <= 0 || atIndex !== trimmed.lastIndexOf('@')) return false;
  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);
  if (!local || !domain || domain.startsWith('.') || domain.endsWith('.')) return false;
  return domain.includes('.');
};

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isValidEmail(email)) {
      setError('يرجى إدخال بريد إلكتروني صحيح');
      return;
    }

    setLoading(true);
    try {
      await authService.sendPasswordReset(email);
      setSuccess(true);
    } catch (err) {
      console.error('[ForgotPassword] sendPasswordReset failed', err);
      setError('حدث خطأ، يرجى المحاولة مجدداً');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div
          className="w-full max-w-sm bg-card border border-border rounded-2xl p-8 shadow-2xl"
          style={{ animation: 'fadeInUp 0.35s ease-out both' }}
        >
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl mb-4 flex items-center justify-center text-3xl shadow-lg"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>🔑</div>
            <h1 className="text-xl font-extrabold text-foreground text-center">نسيت كلمة المرور؟</h1>
            <p className="text-muted-foreground text-sm text-center mt-1 leading-relaxed">
              أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين
            </p>
          </div>

          {success ? (
            <div className="flex flex-col items-center text-center space-y-4 animate-in fade-in duration-300" dir="rtl">
              <CheckCircle2 size={56} className="text-green-400" />
              <div>
                <p className="text-lg font-bold text-foreground">تم إرسال الرابط!</p>
                <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
                  إذا كان البريد <span className="text-primary font-mono text-xs">{email}</span> مسجلاً لدينا، ستصلك رسالة بها رابط إعادة تعيين كلمة المرور.
                </p>
                <p className="text-muted-foreground text-xs mt-2">تأكد من مجلد البريد المزعج أيضاً</p>
              </div>
              <Link to="/login"
                className="mt-2 flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors">
                <ArrowRight size={14} />
                العودة لتسجيل الدخول
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" dir="rtl">
              <div>
                <label htmlFor="forgot-email" className="block text-sm text-muted-foreground mb-1.5">البريد الإلكتروني</label>
                <div className="relative">
                  <Mail size={15} className="absolute top-1/2 -translate-y-1/2 right-3 text-muted-foreground" />
                  <Input
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="example@company.com"
                    dir="ltr"
                    autoComplete="email"
                    className="focus:border-primary focus:ring-ring/20 h-11 pr-9 text-[16px] md:text-[16px]"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2.5 animate-in slide-in-from-top-1 fade-in duration-200">
                  <span className="text-sm">⚠️</span>
                  <p className="text-destructive text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={authGradientBtn}
                style={authBtnStyle}
              >
                {loading
                  ? <><Loader2 size={16} className="animate-spin" /> جاري الإرسال...</>
                  : 'إرسال رابط إعادة التعيين'}
              </button>

              <div className="text-center">
                <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5">
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
