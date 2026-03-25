import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';
import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, role, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6" dir="rtl">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-xl font-semibold text-foreground">بانتظار تعيين الدور</h1>
          <p className="text-sm text-muted-foreground">
            لم يُعيَّن بعد دور لحسابك في النظام. بعد أن يفعّلك مدير النظام ويحدد صلاحيتك ستتمكن من الاستخدام.
          </p>
          <Button type="button" variant="outline" onClick={() => void signOut()}>
            تسجيل الخروج
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
