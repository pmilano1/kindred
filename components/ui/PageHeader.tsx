'use client';

import { ReactNode } from 'react';
import { useSettings } from '../SettingsProvider';
import { LucideIcon } from 'lucide-react';
import GlobalSearch from '../GlobalSearch';

export interface PageHeaderProps {
  /** Page title - falls back to family name from settings */
  title?: string;
  /** Subtitle text */
  subtitle?: string;
  /** Optional icon component */
  icon?: LucideIcon;
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
    icon?: LucideIcon;
  }>;
}

export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  actions,
  stats,
  showSearch = true,
}: PageHeaderProps) {
  const settings = useSettings();

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
        </div>
      </div>

      {stats && stats.length > 0 && (
        <div className="page-header-stats">
          {stats.map((stat, index) => (
            <div key={index} className="page-header-stat">
              {stat.icon && <stat.icon className="w-4 h-4 text-white/60" />}
              <span className="page-header-stat-value">{stat.value}</span>
              <span className="page-header-stat-label">{stat.label}</span>
            </div>
          ))}
        </div>
      )}
    </header>
  );
}

export default PageHeader;

