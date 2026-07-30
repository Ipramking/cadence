export function Rings({
  size = 160,
  progress = 0.66,
  spin = false,
  className = "",
}: {
  size?: number;
  progress?: number;
  spin?: boolean;
  className?: string;
}) {
  const c = size / 2;
  const rOuter = c - 3;
  const rMid = c - 16;
  const rInner = c - 30;
  const circ = 2 * Math.PI * rOuter;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      aria-hidden
    >
      <g className={spin ? "spin-slow" : ""} style={{ transformOrigin: "center" }}>
        <circle cx={c} cy={c} r={rOuter} fill="none" stroke="var(--border)" strokeWidth={1.5} />
        <circle cx={c} cy={c} r={rMid} fill="none" stroke="var(--border)" strokeWidth={1} opacity={0.6} />
        {rInner > 6 && (
          <circle cx={c} cy={c} r={rInner} fill="none" stroke="var(--border)" strokeWidth={1} opacity={0.4} />
        )}
        <circle
          cx={c}
          cy={c}
          r={rOuter}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray={`${circ * progress} ${circ}`}
          transform={`rotate(-90 ${c} ${c})`}
        />
      </g>
    </svg>
  );
}
