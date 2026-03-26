import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ReactNode, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import Loading from '@/components/Loading';

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { session, role, loading, signOut, recoverSessionSilently } = useAuth();
  const [checkingRecovery, setCheckingRecovery] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (loading || session) return;
    let mounted = true;
    setCheckingRecovery(true);
    void recoverSessionSilently().finally(() => {
      if (mounted) setCheckingRecovery(false);
    });
    return () => {
      mounted = false;
    };
  }, [loading, recoverSessionSilently, session]);

  if (loading || checkingRecovery) {
    const resetKey = `${location.pathname}${location.search}`;
    return <Loading minHeightClassName="min-h-screen" className="bg-background" resetKey={resetKey} />;
  }

  if (!session) return <Navigate to="/login" replace />;

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
