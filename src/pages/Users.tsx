import { useState, useEffect } from 'react';
import { Users as UsersIcon, Plus, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

type Profile = { id: string; name?: string | null; email?: string | null; is_active: boolean };
type UserRole = { user_id: string; role: string };

const roleLabels: Record<string, string> = { admin: 'مدير', hr: 'موارد بشرية', finance: 'مالية', operations: 'عمليات', viewer: 'عارض' };
const roleColors: Record<string, string> = { admin: 'badge-urgent', hr: 'badge-info', finance: 'badge-success', operations: 'badge-warning', viewer: 'bg-muted text-muted-foreground text-xs font-medium px-2.5 py-0.5 rounded-full' };

const Users = () => {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'hr' | 'finance' | 'operations' | 'viewer'>('viewer');
  const [saving, setSaving] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    const [{ data: pData }, { data: rData }] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at'),
      supabase.from('user_roles').select('user_id, role'),
    ]);
    if (pData) setProfiles(pData as Profile[]);
    if (rData) setUserRoles(rData as UserRole[]);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const getRole = (userId: string) => userRoles.find(r => r.user_id === userId)?.role;

  const handleAddUser = async () => {
    if (!newEmail || !newPassword || !newName) {
      toast({ title: 'خطأ', description: 'يرجى ملء جميع الحقول المطلوبة', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: newEmail,
        password: newPassword,
        options: { data: { name: newName } },
      });
      if (error) throw error;
      if (data.user) {
        await supabase.from('user_roles').insert({ user_id: data.user.id, role: newRole });
        await supabase.from('profiles').upsert({ id: data.user.id, email: newEmail, name: newName, is_active: true });
        toast({ title: 'تم الإنشاء', description: `تم إنشاء حساب ${newName} بدور ${roleLabels[newRole]}` });
        setShowAddUser(false);
        setNewEmail(''); setNewPassword(''); setNewName(''); setNewRole('viewer');
        fetchUsers();
      }
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <UsersIcon size={24} /> إدارة المستخدمين
          </h1>
          <p className="text-sm text-muted-foreground mt-1">حسابات الوصول ودورهم في النظام</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={fetchUsers}><RefreshCw size={14} /> تحديث</Button>
          <Button className="gap-2" onClick={() => setShowAddUser(true)}><Plus size={16} /> إضافة مستخدم</Button>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>
        ) : profiles.length === 0 ? (
          <div className="p-16 text-center">
            <UsersIcon size={40} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">لا توجد حسابات مسجلة بعد</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="text-right p-4 text-sm font-semibold text-muted-foreground">الاسم</th>
                <th className="text-right p-4 text-sm font-semibold text-muted-foreground">البريد الإلكتروني</th>
                <th className="text-center p-4 text-sm font-semibold text-muted-foreground">الدور</th>
                <th className="text-center p-4 text-sm font-semibold text-muted-foreground">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map(u => {
                const role = getRole(u.id);
                return (
                  <tr key={u.id} className="border-b border-border/30 hover:bg-muted/20">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                          {u.name?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase() || '?'}
                        </div>
                        <span className="text-sm font-medium text-foreground">{u.name || '—'}</span>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground" dir="ltr">{u.email || '—'}</td>
                    <td className="p-4 text-center">
                      {role ? <span className={roleColors[role]}>{roleLabels[role]}</span> : <span className="text-xs text-muted-foreground">بدون دور</span>}
                    </td>
                    <td className="p-4 text-center">
                      <span className={u.is_active ? 'badge-success' : 'badge-warning'}>{u.is_active ? 'نشط' : 'موقوف'}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShieldCheck size={18} /> إضافة مستخدم جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>الاسم الكامل *</Label><Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="أحمد محمد" /></div>
            <div className="space-y-2"><Label>البريد الإلكتروني *</Label><Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="user@delivery.sa" dir="ltr" /></div>
            <div className="space-y-2"><Label>كلمة المرور *</Label><Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" /></div>
            <div className="space-y-2">
              <Label>الدور والصلاحيات *</Label>
              <Select value={newRole} onValueChange={(v: any) => setNewRole(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">🔴 مدير — صلاحيات كاملة</SelectItem>
                  <SelectItem value="hr">🔵 موارد بشرية — الموظفون والحضور</SelectItem>
                  <SelectItem value="finance">🟢 مالية — الرواتب والسلف والخصومات</SelectItem>
                  <SelectItem value="operations">🟠 عمليات — الطلبات والمركبات</SelectItem>
                  <SelectItem value="viewer">⚪ عارض — عرض فقط</SelectItem>
                </SelectContent>
              </Select>
              <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
                {newRole === 'admin' && '✅ وصول كامل لكل شيء بدون قيود'}
                {newRole === 'hr' && '✅ الموظفون، الحضور، التطبيقات، التنبيهات'}
                {newRole === 'finance' && '✅ الرواتب، السلف، الخصومات'}
                {newRole === 'operations' && '✅ الطلبات اليومية، المركبات، التتبع'}
                {newRole === 'viewer' && '✅ عرض التقارير فقط — لا يمكن التعديل'}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddUser(false)}>إلغاء</Button>
            <Button onClick={handleAddUser} disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin ml-1" /> : <Plus size={14} className="ml-1" />}
              إنشاء الحساب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Users;
