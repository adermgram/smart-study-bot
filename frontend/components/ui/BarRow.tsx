/** A single bar mark: square at the baseline, rounded only at the data-end, capped
 * thickness so it reads as a chart mark rather than a decorative progress sliver. */
export function Bar({
  percent,
  fillClassName = "bg-accent",
  trackClassName = "bg-border",
}: {
  percent: number;
  fillClassName?: string;
  trackClassName?: string;
}) {
  return (
    <div className={`h-5 w-full overflow-hidden rounded-sm ${trackClassName}`}>
      <div
        className={`h-full rounded-r-sm ${fillClassName} transition-[width] duration-500`}
        style={{ width: `${Math.max(6, Math.min(100, percent))}%` }}
      />
    </div>
  );
}

/** Label + value row above a Bar. Value is a plain text token, never the fill color --
 * color lives on the mark, not the text (a colorblind reader must not need the color
 * to read the number). */
export function BarRow({
  label,
  valueLabel,
  percent,
  fillClassName,
  trackClassName,
  statusWord,
}: {
  label: string;
  valueLabel: string;
  percent: number;
  fillClassName?: string;
  trackClassName?: string;
  statusWord?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <strong className="font-semibold">{label}</strong>
        <span className="text-muted">
          {statusWord && <span className="mr-1.5 font-medium text-foreground">{statusWord}</span>}
          {valueLabel}
        </span>
      </div>
      <div className="mt-2">
        <Bar percent={percent} fillClassName={fillClassName} trackClassName={trackClassName} />
      </div>
    </div>
  );
}
