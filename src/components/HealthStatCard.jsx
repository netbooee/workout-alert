export default function HealthStatCard({ icon, label, value, unit, sub }) {
  return (
    <div className="card p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">{icon}</span>
        <span className="label-secondary">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-white text-3xl font-bold tracking-tight">{value ?? '—'}</span>
        {unit && <span className="text-apple-secondary text-sm font-medium">{unit}</span>}
      </div>
      {sub && <p className="text-apple-tertiary text-xs">{sub}</p>}
    </div>
  )
}
