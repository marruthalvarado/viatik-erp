export function KpiCard({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-card p-4 ${highlight ? "border-amber-300 bg-amber-50/30" : ""}`}
    >
      <div className="flex items-center justify-between mb-1">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${highlight ? "text-amber-700" : ""}`}>
        {value}
      </p>
    </div>
  );
}
