const DOLLAR = [0x57, 0xe9, 0xce];
const NAIRA = [0xf5, 0xb8, 0x41];

function mix(t: number): string {
  const c = DOLLAR.map((d, i) => Math.round(d + (NAIRA[i] - d) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/**
 * The Cadence signature: a row of bars that pulse in a travelling wave, tinted
 * from dollar-mint to naira-gold across the width — irregular income resolving
 * into a steady beat.
 */
export function CadenceWave({ bars = 44 }: { bars?: number }) {
  return (
    <div className="wave" aria-hidden>
      {Array.from({ length: bars }).map((_, i) => {
        const t = i / (bars - 1);
        // a static wave envelope so bars aren't a flat block
        const envelope = 0.45 + 0.55 * Math.abs(Math.sin(t * Math.PI * 2.2));
        return (
          <span
            key={i}
            style={{
              height: `${envelope * 100}%`,
              background: mix(t),
              animationDelay: `${(i * 1.6) / bars}s`,
            }}
          />
        );
      })}
    </div>
  );
}
