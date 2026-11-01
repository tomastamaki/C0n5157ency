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

/**
 * Igual que VariationPill pero para una celda de comparación con base propia
 * por ejercicio: si la base no coincide con la columna estándar (semana 1
 * para "inicio", la semana anterior no-deload para "anterior"), muestra de
 * dónde sale debajo del pill. "Inicio" siempre es por definición el primer
 * registro de ese ejercicio, así que esa columna agrega esa aclaración.
 */
export function ComparisonPill({ cell, kind }: { cell: ComparisonCell; kind: "inicio" | "anterior" }) {
  if (cell.baseWeekNumber === null) {
    return <span className="text-xs text-faint">Primer registro</span>;
  }
  return (
    <span className="flex flex-col items-end gap-0.5">
      <VariationPill pct={cell.variationPct} />
      {!cell.isStandardBase && (
        <span className="text-[10px] text-faint">
          vs S{cell.baseWeekNumber}
          {kind === "inicio" ? " (1er registro)" : ""}
        </span>
      )}
    </span>
  );
}
