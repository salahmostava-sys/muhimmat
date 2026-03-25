import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Loader2, Eye, EyeOff, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { authService } from '@/services/authService';
import { authGradientBtn, authBtnStyle } from '@/lib/authStyles';

function calcStrength(pw: string): 0 | 1 | 2 | 3 {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  return score as 0 | 1 | 2 | 3;
}

const strengthColors = ['', 'bg-red-500', 'bg-yellow-400', 'bg-green-500'];
const strengthLabels = ['', 'ضعيفة', 'متوسطة', 'قوية'];
const strengthTextColors = ['', 'text-red-400', 'text-yellow-400', 'text-green-400'];

const ResetPassword = () => {
  const navigate = useNavigate();
  const [isRecovery, setIsRecovery] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showCf, setShowCf] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const strength = calcStrength(password);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setIsRecovery(true);
      authService.getSession().then(({ session }) => {
        if (!session) setInvalidLink(true);
      });
    } else {
      setInvalidLink(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password || password.length < 8) {
      setError('يجب أن تكون كلمة المرور 8 أحرف على الأقل');
      return;
    }
    if (password !== confirm) {
      setError('كلمة المرور وتأكيدها غير متطابقتان');
      return;
    }
    if (strength < 2) {
      setError('كلمة المرور ضعيفة جداً، أضف أرقاماً أو رموزاً');
      return;
    }

    setLoading(true);
    const { error: err } = await authService.updatePassword(password);
    setLoading(false);

    if (err) {
      setError(err.message || 'حدث خطأ أثناء تحديث كلمة المرور');
    } else {
      setSuccess(true);
      setTimeout(() => navigate('/'), 2500);
    }
  };

  if (invalidLink && !isRecovery) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-8 shadow-2xl text-center space-y-4" dir="rtl">
          <AlertTriangle size={56} className="text-yellow-400 mx-auto" />
          <h2 className="text-xl font-bold text-foreground">رابط غير صالح</h2>
          <p className="text-muted-foreground text-sm">الرابط منتهي الصلاحية أو غير صحيح. يرجى طلب رابط جديد.</p>
          <Link to="/forgot-password"
            className="inline-block mt-4 px-6 py-2 rounded-xl text-sm font-semibold text-primary-foreground"
            style={authBtnStyle}>
            طلب رابط جديد
          </Link>
        </div>
      </div>
    );
  }

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
              style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>🔐</div>
            <h1 className="text-xl font-extrabold text-foreground text-center">تعيين كلمة مرور جديدة</h1>
            <p className="text-muted-foreground text-sm text-center mt-1">أدخل كلمة مرور قوية لحماية حسابك</p>
          </div>

          {success ? (
            <div className="flex flex-col items-center text-center space-y-4 animate-in fade-in duration-300" dir="rtl">
              <CheckCircle2 size={56} className="text-green-400" />
              <div>
                <p className="text-lg font-bold text-foreground">تم تغيير كلمة المرور! ✓</p>
                <p className="text-muted-foreground text-sm mt-2">سيتم توجيهك للوحة التحكم تلقائياً...</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" dir="rtl">
              {/* New password */}
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">كلمة المرور الجديدة</label>
                <div className="relative">
                  <Lock size={15} className="absolute top-1/2 -translate-y-1/2 right-3 text-muted-foreground" />
                  <Input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="focus:border-primary focus:ring-ring/20 h-11 pr-9 pl-10"
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute top-1/2 -translate-y-1/2 left-3 text-muted-foreground hover:text-foreground transition-colors">
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {password && (
                  <div className="mt-2 space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3].map(i => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-colors duration-200 ${strength >= i ? strengthColors[strength] : 'bg-muted'}`} />
                      ))}
                    </div>
                    <p className={`text-xs ${strengthTextColors[strength]}`}>{strengthLabels[strength]}</p>
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">تأكيد كلمة المرور</label>
                <div className="relative">
                  <Lock size={15} className="absolute top-1/2 -translate-y-1/2 right-3 text-muted-foreground" />
                  <Input
                    type={showCf ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className={`focus:border-primary focus:ring-ring/20 h-11 pr-9 pl-10 ${confirm && confirm !== password ? 'border-red-600' : confirm && confirm === password ? 'border-green-600' : ''}`}
                  />
                  <button type="button" onClick={() => setShowCf(v => !v)}
                    className="absolute top-1/2 -translate-y-1/2 left-3 text-muted-foreground hover:text-foreground transition-colors">
                    {showCf ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {confirm && confirm !== password && (
                  <p className="text-red-400 text-xs mt-1">كلمة المرور غير متطابقة</p>
                )}
                {confirm && confirm === password && (
                  <p className="text-green-400 text-xs mt-1 flex items-center gap-1">
                    <CheckCircle2 size={11} /> متطابقة
                  </p>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2.5 animate-in slide-in-from-top-1 fade-in duration-200">
                  <span className="text-sm">⚠️</span>
                  <p className="text-destructive text-sm">{error}</p>
                </div>
              )}

              {/* Requirements */}
              <div className="bg-muted/60 rounded-xl p-3 text-xs text-muted-foreground space-y-1" dir="rtl">
                <p className={password.length >= 8 ? 'text-green-400' : ''}>✓ 8 أحرف على الأقل</p>
                <p className={/[0-9]/.test(password) ? 'text-green-400' : ''}>✓ تحتوي على رقم</p>
                <p className={/[^a-zA-Z0-9]/.test(password) ? 'text-green-400' : ''}>✓ تحتوي على رمز خاص</p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={authGradientBtn}
                style={authBtnStyle}
              >
                {loading
                  ? <><Loader2 size={16} className="animate-spin" /> جاري الحفظ...</>
                  : 'تعيين كلمة المرور الجديدة'}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
};

export default ResetPassword;
