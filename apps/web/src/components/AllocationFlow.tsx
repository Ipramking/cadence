export interface FlowItem {
  pct: number;
  label: string;
  sub?: string;
  dot?: string;
}

const DEFAULT_ITEMS: FlowItem[] = [
  { pct: 50, label: "Monthly salary", sub: "paid to you steadily", dot: "var(--primary)" },
  { pct: 20, label: "Rent vault", sub: "goal · due the 30th", dot: "var(--success)" },
  { pct: 15, label: "Send home", sub: "family support", dot: "var(--warn)" },
  { pct: 15, label: "USD hedge", sub: "against the naira", dot: "var(--primary-2)" },
];

/**
 * The Cadence signature: an incoming amount fanning through connector lines to
 * percentage badges and their destinations — the allocation of every dollar.
 */
export function AllocationFlow({
  amount = "$500",
  items = DEFAULT_ITEMS,
}: {
  amount?: string;
  items?: FlowItem[];
}) {
  const rowH = 64;
  const h = items.length * rowH;
  const w = 56;
  return (
    <div className="flex items-stretch">
      {/* source node */}
      <div className="flex flex-col justify-center">
        <div className="rounded-2xl border border-border bg-surface2 px-4 py-3 text-center">
          <div className="mx-auto mb-1 h-2 w-2 rounded-full bg-primary" />
          <div className="stat text-xl">{amount}</div>
          <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted">received</div>
        </div>
      </div>

      {/* connectors */}
      <svg width={w} height={h} className="shrink-0" aria-hidden>
        {items.map((_, i) => {
          const y = rowH * i + rowH / 2;
          return (
            <path
              key={i}
              d={`M0 ${h / 2} C ${w * 0.55} ${h / 2}, ${w * 0.45} ${y}, ${w} ${y}`}
              fill="none"
              stroke="var(--border)"
              strokeWidth={1.5}
            />
          );
        })}
      </svg>

      {/* destinations */}
      <div className="flex-1">
        {items.map((it) => (
          <div key={it.label} className="flex items-center gap-3" style={{ height: rowH }}>
            <span className="pill">{it.pct}%</span>
            <span className="text-muted">→</span>
            <span className="h-6 w-6 shrink-0 rounded-full" style={{ background: it.dot }} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{it.label}</p>
              {it.sub && <p className="truncate text-xs text-muted">{it.sub}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
