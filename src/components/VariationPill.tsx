import { SUMMARY_CONFIG } from "../lib/summaryConfig";
import type { ComparisonCell } from "../lib/periodSummary";

function formatPct(pct: number): string {
  const rounded = Math.round(pct * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

/** Pill de variación: verde = sube, gris = igual, naranja = baja. Nunca rojo. */
export function VariationPill({ pct, neutral = false }: { pct: number | null; neutral?: boolean }) {
  if (pct === null) return <span className="text-xs text-faint">—</span>;
  if (neutral) {
    return (
      <span className="rounded-pill bg-surface2 px-2 py-0.5 font-mono text-xs font-medium text-muted">
        {formatPct(pct)}
      </span>
    );
  }
  const isUp = pct > SUMMARY_CONFIG.exerciseStatusStablePct;
  const isDown = pct < -SUMMARY_CONFIG.exerciseStatusStablePct;
  const toneClass = isUp ? "bg-success/15 text-success" : isDown ? "bg-warning/15 text-warning" : "bg-surface2 text-faint";
  const arrow = isUp ? "↑" : isDown ? "↓" : "→";
  return (
    <span className={`rounded-pill px-2 py-0.5 font-mono text-xs font-semibold ${toneClass}`}>
      {arrow} {formatPct(pct)}
    </span>
  );
}

/** Igual que VariationPill pero para una celda de comparación que puede no ser calculable ("—" + motivo). */
export function ComparisonPill({ cell }: { cell: ComparisonCell }) {
  if (cell.reason !== "ok") {
    return (
      <span className="text-xs text-faint">— {cell.reason === "variant-mismatch" ? "variante distinta" : "sin registro"}</span>
    );
  }
  return <VariationPill pct={cell.variationPct} />;
}
