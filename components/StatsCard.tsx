interface StatsCardProps {
  label: string;
  value: number | string;
  icon?: string;
}

export default function StatsCard({ label, value, icon }: StatsCardProps) {
  return (
    <div className="card stat-card">
      {icon && <div className="text-3xl mb-2">{icon}</div>}
      <div className="stat-number">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

