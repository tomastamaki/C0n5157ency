const BOTTLE_PATH =
  "M28,4 h24 v13 c11,6.5 17,17 17,29.5 v57.5 a9,9 0 0 1 -9,9 h-40 a9,9 0 0 1 -9,-9 v-57.5 c0,-12.5 6,-23 17,-29.5 z";

/** Bidón que se "llena" de forma proporcional al progreso del día (0% vacío, 100% lleno). */
export function WaterBottle({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const bodyTop = 17;
  const bodyBottom = 113;
  const fillY = bodyBottom - (clamped / 100) * (bodyBottom - bodyTop);

  return (
    <svg viewBox="0 0 80 118" className="mx-auto h-36 w-24" aria-hidden>
      <defs>
        <clipPath id="water-bottle-clip">
          <path d={BOTTLE_PATH} />
        </clipPath>
      </defs>
      <rect x="31" y="0" width="18" height="6" rx="2" className="fill-border" />
      <path d={BOTTLE_PATH} className="fill-surface2 stroke-border" strokeWidth="2.5" />
      <g clipPath="url(#water-bottle-clip)">
        <rect
          x="0"
          y={fillY}
          width="80"
          height="118"
          className="fill-primary transition-all duration-700 ease-out"
        />
      </g>
      <path d={BOTTLE_PATH} fill="none" className="stroke-border" strokeWidth="2.5" />
    </svg>
  );
}
