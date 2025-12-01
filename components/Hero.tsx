interface HeroProps {
  title?: string;
  subtitle?: string;
}

export default function Hero({ title = "Milanese Family", subtitle = "Genealogy Database" }: HeroProps) {
  return (
    <section className="hero-banner">
      <div className="text-center">
        <h1 className="banner-title">
          <span className="gradient-text">{title}</span>
        </h1>
        <p className="banner-subtitle">{subtitle}</p>
      </div>
    </section>
  );
}

