interface StatsCardProps {
  label: string;
  value: number | string;
  icon?: string;
}

export default function StatsCard({ label, value, icon }: StatsCardProps) {
  return (
    <section className="card stat-card" aria-label={`${label}: ${value}`}>
      {icon && (
        <div className="text-3xl mb-2" aria-hidden="true">
          {icon}
        </div>
      )}
      <div className="stat-number">{value}</div>
      <div className="stat-label">{label}</div>
    </section>
  );
}
