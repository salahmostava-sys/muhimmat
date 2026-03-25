import { User } from 'lucide-react';
import ProfileSettingsContent from '@/pages/settings-hub/ProfileSettingsContent';

/** صفحة مستقلة: أي مستخدم مسجّل (له دور) يصل إليها دون صلاحية «الإعدادات». */
const ProfilePage = () => {
  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <div className="flex-shrink-0">
        <nav className="page-breadcrumb">
          <span>الرئيسية</span>
          <span className="page-breadcrumb-sep">/</span>
          <span>الملف الشخصي</span>
        </nav>
        <h1 className="page-title flex items-center gap-2">
          <User size={20} /> الملف الشخصي
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          تعديل الاسم المعروض والصورة وكلمة المرور
        </p>
      </div>
      <ProfileSettingsContent omitPageHeading />
    </div>
  );
};

export default ProfilePage;
