import ProjectSettings from '@/components/settings/ProjectSettings';
import CompanySettingsContent from './CompanySettingsContent';

export default function GeneralSettingsContent() {
  return (
    <div className="space-y-6">
      <ProjectSettings />
      <CompanySettingsContent />
    </div>
  );
}
