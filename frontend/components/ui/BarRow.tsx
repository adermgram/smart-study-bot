/** A labeled horizontal bar, sized as a percentage of some caller-chosen max.
 * Deliberately not a charting library -- a dashboard section here shows at most a
 * handful of topics, so a couple of styled divs are simpler and lighter than pulling
 * in a chart dependency for it. */
export function BarRow({
  label,
  valueLabel,
  percent,
  colorClass = "bg-accent",
}: {
  label: string;
  valueLabel: string;
  percent: number;
  colorClass?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <strong className="font-semibold">{label}</strong>
        <span className="text-muted">{valueLabel}</span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-border">
        <div
          className={`h-full rounded-full ${colorClass} transition-[width] duration-500`}
          style={{ width: `${Math.max(4, Math.min(100, percent))}%` }}
        />
      </div>
    </div>
  );
}
