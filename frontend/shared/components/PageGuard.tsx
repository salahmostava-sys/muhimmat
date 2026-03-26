import { ReactNode } from 'react';
import { Loader2, ShieldX } from 'lucide-react';
import { usePermissions } from '@shared/hooks/usePermissions';
import { useTranslation } from 'react-i18next';

interface PageGuardProps {
  pageKey: string;
  children: ReactNode;
}

const PageGuard = ({ pageKey, children }: PageGuardProps) => {
  const { permissions, loading } = usePermissions(pageKey);
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  if (!permissions.can_view) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-6"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <div className="rounded-full bg-destructive/10 p-5">
          <ShieldX size={40} className="text-destructive" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">
          {isRtl ? 'ليس لديك صلاحية لعرض هذه الصفحة' : 'Access Denied'}
        </h2>
        <p className="text-muted-foreground text-sm max-w-sm">
          {isRtl
            ? 'تواصل مع مدير النظام لطلب الصلاحية المناسبة.'
            : 'Contact your system administrator to request access.'}
        </p>
      </div>
    );
  }

  return <>{children}</>;
};

export default PageGuard;
