import type { HeatCellLike } from "./HeatGrid";
import { colorForPct, HEAT_NEUTRAL } from "../../lib/heatScale";

interface HeatRowProps {
  cells: HeatCellLike[];
  /** "onColor": la tarjeta ya está rellena del color del hábito (estado "completado"), así que las celdas usan tinta oscura translúcida en vez de los tonos de superficie normales. */
  tone?: "default" | "onColor";
}

/** Mini fila de ~14 días dentro del pie de la tarjeta de hábito. Misma escala roja→verde que el resto de los mapas de calor (Fase 5); puramente decorativa (sin tap-to-reveal, a diferencia de `HeatGrid`). */
export function HeatRow({ cells, tone = "default" }: HeatRowProps) {
  const onColor = tone === "onColor";
  return (
    <div className="flex gap-[3px]" aria-hidden="true">
      {cells.map((cell, i) => {
        let background = "transparent";
        let boxShadow: string | undefined;
        if (cell.pct === null) {
          if (cell.reason === "skip") {
            boxShadow = onColor ? "inset 0 0 0 1px rgba(13,14,19,0.4)" : "inset 0 0 0 1px rgb(var(--border))";
            if (!onColor) background = "rgb(var(--ghost))";
          } else if (cell.reason === "pending-today") {
            boxShadow = onColor ? "inset 0 0 0 1.5px rgba(13,14,19,0.4)" : "inset 0 0 0 1.5px rgb(var(--primary))";
          } else {
            background = onColor ? "rgba(13,14,19,0.16)" : HEAT_NEUTRAL;
          }
        } else {
          background = colorForPct(cell.pct);
        }
        return <i key={i} className="block h-2 w-2 rounded-[2px]" style={{ backgroundColor: background, boxShadow }} />;
      })}
    </div>
  );
}
