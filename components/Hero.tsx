'use client';

import { useSettings } from './SettingsProvider';

interface HeroProps {
  title?: string;
  subtitle?: string;
}

export default function Hero({ title, subtitle }: HeroProps) {
  const settings = useSettings();

  const displayTitle = title ?? settings.family_name;
  const displaySubtitle = subtitle ?? settings.site_tagline;

  return (
    <section className="hero-banner">
      <div className="text-center">
        <h1 className="banner-title">
          <span className="gradient-text">{displayTitle}</span>
        </h1>
        <p className="banner-subtitle">{displaySubtitle}</p>
      </div>
    </section>
  );
}
