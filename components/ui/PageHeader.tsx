'use client';

import {
  BookOpen,
  Calendar,
  ClipboardList,
  Clock,
  FlaskConical,
  Key,
  LayoutDashboard,
  Network,
  Search,
  Settings,
  Shield,
  Sliders,
  TreeDeciduous,
  User,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import GlobalSearch from '../GlobalSearch';
import { useSettings } from '../SettingsProvider';
import UserMenu from '../UserMenu';

// Map of icon names to components (for Server → Client serialization)
const iconMap = {
  LayoutDashboard,
  Users,
  Search,
  Clock,
  Network,
  Shield,
  Key,
  Settings,
  Sliders,
  User,
  BookOpen,
  FlaskConical,
  ClipboardList,
  Calendar,
  TreeDeciduous,
} as const;

export type IconName = keyof typeof iconMap;

export interface PageHeaderProps {
  /** Page title - falls back to family name from settings */
  title?: string;
  /** Subtitle text */
  subtitle?: string;
  /** Optional icon name (string) - resolved internally to avoid Server→Client serialization issues */
  icon?: IconName;
  /** Optional actions (buttons, etc.) to display in header */
  actions?: ReactNode;
  /** Whether to show breadcrumbs (future feature) */
  showBreadcrumbs?: boolean;
  /** Whether to show search bar (default: true) */
  showSearch?: boolean;
  /** Additional stats to display */
  stats?: Array<{
    label: string;
    value: string | number;
    icon?: IconName;
  }>;
}

export function PageHeader({
  title,
  subtitle,
  icon,
  actions,
  stats,
  showSearch = true,
}: PageHeaderProps) {
  const settings = useSettings();
  const Icon = icon ? iconMap[icon] : null;

  const displayTitle = title ?? settings.family_name;
  const displaySubtitle = subtitle ?? settings.site_tagline;

  return (
    <header className="page-header">
      <div className="page-header-content">
        <div className="page-header-main">
          {Icon && (
            <div className="page-header-icon">
              <Icon className="w-8 h-8" />
            </div>
          )}
          <div className="page-header-text">
            <h1 className="page-header-title">{displayTitle}</h1>
            {displaySubtitle && (
              <p className="page-header-subtitle">{displaySubtitle}</p>
            )}
          </div>
        </div>

        <div className="page-header-actions flex items-center gap-4">
          {showSearch && <GlobalSearch />}
          {actions}
          <UserMenu />
        </div>
      </div>

      {stats && stats.length > 0 && (
        <div className="page-header-stats">
          {stats.map((stat, index) => {
            const StatIcon = stat.icon ? iconMap[stat.icon] : null;
            return (
              <div key={index} className="page-header-stat">
                {StatIcon && <StatIcon className="w-4 h-4 text-white/60" />}
                <span className="page-header-stat-value">{stat.value}</span>
                <span className="page-header-stat-label">{stat.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </header>
  );
}

export default PageHeader;
