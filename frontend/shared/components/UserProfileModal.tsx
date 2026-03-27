import { useState, useRef, useEffect } from 'react';
import { X, Camera, Eye, EyeOff, Check, AlertCircle } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Label } from '@shared/components/ui/label';
import { useToast } from '@shared/hooks/use-toast';
import { useAuth } from '@app/providers/AuthContext';
import { profileService } from '@services/profileService';
import { useTranslation } from 'react-i18next';
import { cn } from '@shared/lib/utils';
import { validateUploadFile } from '@shared/lib/validation';
import { getErrorMessage } from '@shared/lib/query';
import { logError } from '@shared/lib/logger';

// ─── Password strength ────────────────────────────────────────────────────────
const getStrength = (pw: string) => {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(3, Math.floor(score * 3 / 5));
};
const strengthLabel = (s: number, isRtl: boolean) => {
  const labels = isRtl
    ? ['', 'ضعيفة', 'متوسطة', 'قوية']
    : ['', 'Weak', 'Medium', 'Strong'];
  return labels[s] || '';
};
const strengthColor = (s: number) => {
  if (s === 1) return 'bg-destructive';
  if (s === 2) return 'bg-warning';
  return 'bg-success';
};

type PwFieldId = 'current' | 'next' | 'confirm';
type PwFieldProps = Readonly<{
  id: PwFieldId;
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
}>;

const PwField = ({
  id,
  label,
  value,
  onChange,
  show,
  onToggle,
}: PwFieldProps) => (
  <div>
    <Label htmlFor={id} className="text-sm mb-1.5 block text-foreground/80">{label}</Label>
    <div className="relative">
      <Input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="pe-10"
        dir="ltr"
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  </div>
);

interface Props { onClose: () => void; }

const UserProfileModal = ({ onClose }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const fileRef = useRef<HTMLInputElement>(null);

  // Profile state
  const [profile, setProfile] = useState({ name: '', avatar_url: '' });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Password state
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false });
  const [savingPw, setSavingPw] = useState(false);
  const [pwError, setPwError] = useState('');

  const strength = getStrength(pw.next);

  const saveProfileLoadingText = isRtl ? 'جاري الحفظ...' : 'Saving...';
  const saveProfileReadyText = isRtl ? 'حفظ التغييرات' : 'Save Changes';

  let strengthTextClass = 'text-success';
  if (strength === 1) strengthTextClass = 'text-destructive';
  else if (strength === 2) strengthTextClass = 'text-warning';

  const matchOkText = isRtl ? 'كلمتا المرور متطابقتان' : 'Passwords match';
  const matchBadText = isRtl ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match';

  const changePwLoadingText = isRtl ? 'جاري التغيير...' : 'Changing...';
  const changePwReadyText = isRtl ? 'تغيير كلمة المرور' : 'Change Password';

  // Load current profile
  useEffect(() => {
    if (!user) return;
    profileService.getProfile(user.id)
      .then((data) => {
        if (data) setProfile({ name: data.name || '', avatar_url: data.avatar_url || '' });
      })
      .catch((e: unknown) => {
        logError('[UserProfileModal] load profile failed', e);
      });
  }, [user]);

  // Handle file pick
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateUploadFile(file, {
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    });
    if (!validation.valid) {
      toast({ title: validation.error, variant: 'destructive' });
      return;
    }
    setAvatarFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  // Save profile (name + avatar)
  const saveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      let avatar_url = profile.avatar_url;

      if (avatarFile) {
        const { data: uploadData } = await profileService.uploadAvatar(user.id, avatarFile);
        avatar_url = profileService.getAvatarPublicUrl(uploadData.path);
      }

      await profileService.updateProfile(user.id, {
        name: profile.name.trim(),
        avatar_url,
      });

      setProfile(p => ({ ...p, avatar_url }));
      setAvatarFile(null);
      toast({ title: isRtl ? 'تم حفظ التغييرات' : 'Changes saved' });
    } catch (err: unknown) {
      logError('[UserProfileModal] save profile failed', err);
      toast({
        title: isRtl ? 'خطأ في الحفظ' : 'Save failed',
        description: getErrorMessage(err),
        variant: 'destructive',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  // Change password
  const changePassword = async () => {
    setPwError('');
    if (!pw.next || pw.next.length < 8) {
      setPwError(isRtl ? 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' : 'Password must be at least 8 characters');
      return;
    }
    if (pw.next !== pw.confirm) {
      setPwError(isRtl ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match');
      return;
    }
    setSavingPw(true);
    try {
      await profileService.updatePassword(pw.next);
    } catch (e: unknown) {
      setSavingPw(false);
      setPwError(e instanceof Error ? e.message : String(e));
      return;
    }
    setSavingPw(false);
    toast({ title: isRtl ? 'تم تغيير كلمة المرور' : 'Password changed successfully' });
    setPw({ current: '', next: '', confirm: '' });
  };

  const avatarSrc = previewUrl || profile.avatar_url || null;
  const initial = (profile.name || user?.email || 'U').charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md border border-border/50 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">
            {isRtl ? 'الملف الشخصي' : 'Profile Settings'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[80vh]">
          {/* ── Avatar Section ─────────────────────────────── */}
          <div className="px-6 py-5 border-b border-border/50">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
              {isRtl ? 'الصورة الشخصية' : 'Profile Photo'}
            </p>
            <div className="flex items-center gap-5">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                {avatarSrc ? (
                  <img
                    src={avatarSrc}
                    alt="avatar"
                    className="w-20 h-20 rounded-full object-cover border-2 border-border"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-primary/15 text-primary flex items-center justify-center text-3xl font-bold border-2 border-border">
                    {initial}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="absolute bottom-0 end-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors"
                >
                  <Camera size={12} />
                </button>
              </div>

              <div className="flex-1 space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => fileRef.current?.click()}
                >
                  <Camera size={14} />
                  {isRtl ? 'تغيير الصورة' : 'Change Photo'}
                </Button>
                <p className="text-[11px] text-muted-foreground text-center">
                  {isRtl ? 'JPG أو PNG — الحجم الأقصى 2MB' : 'JPG or PNG — Max 2MB'}
                </p>
                {avatarFile && (
                  <p className="text-[11px] text-primary text-center truncate">{avatarFile.name}</p>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} />
            </div>
          </div>

          {/* ── Personal Info ───────────────────────────────── */}
          <div className="px-6 py-5 border-b border-border/50 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {isRtl ? 'المعلومات الشخصية' : 'Personal Info'}
            </p>

            <div>
              <Label className="text-sm mb-1.5 block text-foreground/80">
                {isRtl ? 'الاسم الكامل' : 'Display Name'}
              </Label>
              <Input
                value={profile.name}
                onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                placeholder={isRtl ? 'أدخل اسمك' : 'Enter your name'}
              />
            </div>

            <div>
              <Label className="text-sm mb-1.5 block text-foreground/80">
                {isRtl ? 'البريد الإلكتروني' : 'Email'}
              </Label>
              <Input
                value={user?.email || ''}
                readOnly
                dir="ltr"
                className="bg-muted/40 text-muted-foreground cursor-default"
              />
              <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
                <AlertCircle size={11} />
                {isRtl ? 'لتغيير البريد الإلكتروني، تواصل مع المسؤول' : 'Contact admin to change email'}
              </p>
            </div>

            <Button onClick={saveProfile} disabled={savingProfile} className="w-full gap-2">
              {savingProfile ? saveProfileLoadingText : (
                <>
                  <Check size={15} />
                  {saveProfileReadyText}
                </>
              )}
            </Button>
          </div>

          {/* ── Change Password ─────────────────────────────── */}
          <div className="px-6 py-5 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {isRtl ? 'تغيير كلمة المرور' : 'Change Password'}
            </p>

            <PwField
              id="current"
              label={isRtl ? 'كلمة المرور الحالية' : 'Current Password'}
              value={pw.current}
              onChange={v => setPw(p => ({ ...p, current: v }))}
              show={showPw.current}
              onToggle={() => setShowPw(s => ({ ...s, current: !s.current }))}
            />
            <PwField
              id="next"
              label={isRtl ? 'كلمة المرور الجديدة' : 'New Password'}
              value={pw.next}
              onChange={v => { setPw(p => ({ ...p, next: v })); setPwError(''); }}
              show={showPw.next}
              onToggle={() => setShowPw(s => ({ ...s, next: !s.next }))}
            />

            {/* Strength indicator */}
            {pw.next && (
              <div className="space-y-1.5">
                <div className="flex gap-1">
                  {[1, 2, 3].map(i => (
                    <div
                      key={`pw-strength-${i}`}
                      className={cn('h-1.5 flex-1 rounded-full transition-colors',
                        strength >= i ? strengthColor(strength) : 'bg-muted'
                      )}
                    />
                  ))}
                </div>
                <p className={cn('text-xs font-medium', strengthTextClass)}>
                  {strengthLabel(strength, isRtl)}
                </p>
              </div>
            )}

            <PwField
              id="confirm"
              label={isRtl ? 'تأكيد كلمة المرور' : 'Confirm New Password'}
              value={pw.confirm}
              onChange={v => { setPw(p => ({ ...p, confirm: v })); setPwError(''); }}
              show={showPw.confirm}
              onToggle={() => setShowPw(s => ({ ...s, confirm: !s.confirm }))}
            />

            {/* Match indicator */}
            {pw.confirm && pw.next && (
              <p className={cn('text-xs flex items-center gap-1',
                pw.next === pw.confirm ? 'text-success' : 'text-destructive'
              )}>
                {pw.next === pw.confirm ? (
                  <>
                    <Check size={11} />
                    {matchOkText}
                  </>
                ) : (
                  <>
                    <AlertCircle size={11} />
                    {matchBadText}
                  </>
                )}
              </p>
            )}

            {pwError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle size={11} /> {pwError}
              </p>
            )}

            <Button
              variant="outline"
              onClick={changePassword}
              disabled={savingPw || !pw.next || !pw.confirm}
              className="w-full gap-2"
            >
              {savingPw ? changePwLoadingText : changePwReadyText}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfileModal;
