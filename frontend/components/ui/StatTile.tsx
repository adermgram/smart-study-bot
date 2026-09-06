/** A single headline number. Per dataviz guidance: a one-bar bar chart is a form
 * mistake -- when there's only one data point, the number IS the chart. */
export function StatTile({
  label,
  value,
  valueClassName = "text-foreground",
  caption,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  caption?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 text-center shadow-sm">
      <p className={`text-3xl font-semibold tracking-tight ${valueClassName}`}>{value}</p>
      <p className="mt-1 text-sm font-medium">{label}</p>
      {caption && <p className="mt-0.5 text-xs text-muted">{caption}</p>}
    </div>
  );
}
