import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '@app/providers/LanguageContext';
import {
  Settings2, Users, Wallet, History,
  ChevronLeft, ChevronRight, Building2, User,
} from 'lucide-react';
import { cn } from '@shared/lib/utils';
import GeneralSettingsContent from './settings-hub/GeneralSettingsContent';
import UsersContent from './settings-hub/UsersContent';
import SchemesContent from './settings-hub/SchemesContent';
import ActivityLogContent from './settings-hub/ActivityLogContent';
import CompanySettingsContent from './settings-hub/CompanySettingsContent';
import ProfileSettingsContent from './settings-hub/ProfileSettingsContent';

type TabKey = 'general' | 'company' | 'users' | 'schemes' | 'activity' | 'profile';

interface Tab {
  key: TabKey;
  labelAr: string;
  labelEn: string;
  icon: React.ElementType;
}

const TABS: Tab[] = [
  { key: 'general',  labelAr: 'إعدادات النظام',          labelEn: 'System Settings',    icon: Settings2  },
  { key: 'users',    labelAr: 'المستخدمون والصلاحيات',   labelEn: 'Users & Permissions', icon: Users      },
  { key: 'schemes',  labelAr: 'مخططات الرواتب',           labelEn: 'Salary Schemes',     icon: Wallet     },
  { key: 'activity', labelAr: 'سجل النشاطات',             labelEn: 'Activity Log',       icon: History    },
  { key: 'profile',  labelAr: 'الملف الشخصي',             labelEn: 'My Profile',         icon: User       },
];

const TAB_TITLES: Record<TabKey, { ar: string; en: string }> = {
  'general':  { ar: 'إعدادات النظام',            en: 'System Settings'      },
  'company':  { ar: 'بيانات المنشأة',             en: 'Organization Info'    },
  'users':    { ar: 'المستخدمون والصلاحيات',     en: 'Users & Permissions'  },
  'schemes':  { ar: 'مخططات الرواتب',             en: 'Salary Schemes'       },
  'activity': { ar: 'سجل النشاطات',               en: 'Activity Log'         },
  'profile':  { ar: 'الملف الشخصي',               en: 'My Profile'           },
};

export default function SettingsHub() {
  const { isRTL } = useLanguage();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const tabParam = searchParams.get('tab') as TabKey | null;
  const validTab = TABS.find(t => t.key === tabParam)?.key ?? 'general';
  const [active, setActive] = useState<TabKey>(validTab);

  useEffect(() => {
    const t = searchParams.get('tab') as TabKey | null;
    const v = TABS.find(x => x.key === t)?.key ?? 'general';
    setActive(v);
  }, [searchParams]);

  const switchTab = (key: TabKey) => {
    navigate(`/settings?tab=${key}`, { replace: true });
    setActive(key);
  };

  const title = TAB_TITLES[active];
  const Sep = isRTL ? ChevronLeft : ChevronRight;

  return (
    <div className="flex flex-col gap-0 animate-fade-in">

      {/* ── Page header ─────────────────────────────────────── */}
      <div className="mb-5">
        <div className="flex items-center gap-1 text-xs mb-1" style={{ color: 'var(--ds-on-surface-variant)' }}>
          <span>{isRTL ? 'الإعدادات' : 'Settings'}</span>
          <Sep size={12} className="opacity-40" />
          <span className="font-semibold" style={{ color: 'var(--ds-on-surface)' }}>
            {isRTL ? title.ar : title.en}
          </span>
        </div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--ds-on-surface)' }}>
          {isRTL ? 'إعدادات النظام المتقدمة' : 'Advanced System Settings'}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--ds-on-surface-variant)' }}>
          {isRTL
            ? 'تحكم في هوية مؤسستك، صلاحيات الموظفين، وبوابات الربح من مكان واحد.'
            : 'Control your organization identity, employee permissions, and integrations from one place.'}
        </p>
      </div>

      {/* ── Main layout: sidebar + content ──────────────────── */}
      <div
        className="flex gap-0 rounded-2xl overflow-hidden flex-1"
        style={{ boxShadow: 'var(--shadow-card)', minHeight: '70vh' }}
      >

        {/* ── Sidebar ─────────────────────────────────────── */}
        <aside
          className={cn(
            'flex-shrink-0 w-[220px] flex flex-col py-4 px-3',
            isRTL ? 'border-l' : 'border-r',
          )}
          style={{
            background: 'var(--ds-surface-low)',
            borderColor: 'var(--ds-surface-container)',
          }}
        >
          {/* Section label */}
          <p
            className="text-[10px] font-semibold uppercase tracking-widest px-3 mb-3"
            style={{ color: 'var(--ds-on-surface-variant)' }}
          >
            {isRTL ? 'الأقسام' : 'Sections'}
          </p>

          <nav className="space-y-0.5 flex-1">
            {TABS.map(tab => {
              const isActive = active === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => switchTab(tab.key)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 text-start"
                  style={
                    isActive
                      ? {
                          background: 'linear-gradient(135deg, #2642e6, #465fff)',
                          color: '#ffffff',
                          fontWeight: 600,
                          boxShadow: '0 4px 12px rgba(38,66,230,0.20)',
                        }
                      : { color: 'var(--ds-on-surface-variant)', fontWeight: 400 }
                  }
                  onMouseEnter={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'var(--ds-surface-container)';
                      e.currentTarget.style.color = 'var(--ds-on-surface)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--ds-on-surface-variant)';
                    }
                  }}
                >
                  <tab.icon size={16} className="flex-shrink-0" />
                  <span className="truncate">
                    {isRTL ? tab.labelAr : tab.labelEn}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Bottom help link */}
          <div className="pt-4 px-3" style={{ borderTop: '1px solid var(--ds-surface-container)' }}>
            <p
              className="text-[11px] font-semibold mb-1"
              style={{ color: 'var(--ds-on-surface-variant)' }}
            >
              {isRTL ? 'المساعدة' : 'Help'}
            </p>
            <a
              href="#"
              className="text-[11px] flex items-center gap-1 hover:underline"
              style={{ color: 'var(--ds-primary)' }}
            >
              {isRTL ? '? وثائق المساعدة' : '? Help Docs'}
            </a>
          </div>
        </aside>

        {/* ── Content area ─────────────────────────────────── */}
        <main
          className="flex-1 overflow-auto p-6 lg:p-8"
          style={{ background: 'var(--ds-surface-lowest)' }}
        >
          {active === 'general'  && <GeneralSettingsContent />}
          {active === 'company'  && <CompanySettingsContent />}
          {active === 'users'    && <UsersContent />}
          {active === 'schemes'  && <SchemesContent />}
          {active === 'activity' && <ActivityLogContent />}
          {active === 'profile'  && <ProfileSettingsContent />}
        </main>
      </div>
    </div>
  );
}
