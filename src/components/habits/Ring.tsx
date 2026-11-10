import type { ReactNode } from "react";

interface RingProps {
  size: number;
  strokeWidth: number;
  /** 0..1 */
  pct: number;
  /** Color del trazo de progreso (CSS color string). Por defecto, primario. */
  color?: string;
  trackColor?: string;
  centerLabel?: ReactNode;
  ariaLabel?: string;
}

/**
 * Anillo de progreso en SVG puro. Tamaños de uso: 92px (hero del día), 54px
 * (estadística), 34px (tira semanal) — ver habi7-diseno.html.
 */
export function Ring({
  size,
  strokeWidth,
  pct,
  color = "rgb(var(--primary))",
  trackColor = "rgb(var(--border))",
  centerLabel,
  ariaLabel,
}: RingProps) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, pct));
  const dash = clamped * c;
  const mid = size / 2;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={ariaLabel ?? `${Math.round(clamped * 100)}%`}
      >
        <circle cx={mid} cy={mid} r={r} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        <circle
          cx={mid}
          cy={mid}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dash.toFixed(1)} ${c.toFixed(1)}`}
          transform={`rotate(-90 ${mid} ${mid})`}
          style={{ transition: "stroke-dasharray 0.4s ease-out" }}
        />
      </svg>
      {centerLabel !== undefined && (
        <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
          {centerLabel}
        </div>
      )}
    </div>
  );
}
