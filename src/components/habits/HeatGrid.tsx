import { useState } from "react";
import { colorForPct, HEAT_NEUTRAL } from "../../lib/heatScale";

export interface HeatCellLike {
  /** null = gris neutro (nunca rojo); si no, 0-100. */
  pct: number | null;
  /** Texto accesible: fecha + estado/valor/% — se muestra al tocar la celda. */
  label: string;
  reason?: "skip" | "unscheduled" | "before-start" | "future" | "pending-today";
}

interface HeatGridProps {
  /** Orden columna por columna, de más vieja a más nueva; longitud múltiplo de 7. */
  cells: HeatCellLike[];
  /** Etiquetas de mes, una por columna (vacías donde no corresponde mostrar nada). */
  monthLabels?: string[];
  showLegend?: boolean;
  nowIndex?: number;
}

function cellBackground(cell: HeatCellLike): string {
  if (cell.pct === null) {
    if (cell.reason === "skip") return "rgb(var(--ghost))";
    return HEAT_NEUTRAL;
  }
  return colorForPct(cell.pct);
}

/**
 * Mapa de calor de 16 semanas (Detalle y Progreso), escala roja→verde (Fase
 * 5): el color propio del hábito se reemplaza acá para que el cambio se
 * note. Cada celda es tocable y muestra fecha/valor/% en texto, para no
 * depender solo del color.
 */
export function HeatGrid({ cells, monthLabels, showLegend = true, nowIndex }: HeatGridProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const cols = Math.ceil(cells.length / 7);

  return (
    <div>
      {monthLabels && (
        <div
          className="mb-1.5 grid h-[13px] text-[10.5px] text-faint"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: "3px" }}
        >
          {monthLabels.map((m, i) => (
            <span key={i} className="whitespace-nowrap">
              {m}
            </span>
          ))}
        </div>
      )}
      <div
        className="grid"
        style={{
          gridTemplateRows: "repeat(7, 1fr)",
          gridAutoFlow: "column",
          gridAutoColumns: "1fr",
          gap: "3px",
        }}
        role="group"
        aria-label="Mapa de calor de las últimas 16 semanas"
      >
        {cells.map((cell, i) => {
          const shadows = [
            cell.reason === "skip" ? "inset 0 0 0 1px rgb(var(--border))" : null,
            i === nowIndex ? "0 0 0 2px rgb(var(--text))" : null,
            selected === i ? "0 0 0 2px rgb(var(--primary))" : null,
          ]
            .filter(Boolean)
            .join(", ");
          return (
            <button
              key={i}
              type="button"
              onClick={() => setSelected(i)}
              aria-label={cell.label}
              className="block aspect-square rounded-[3px]"
              style={{ backgroundColor: cellBackground(cell), boxShadow: shadows || undefined }}
            />
          );
        })}
      </div>
      {selected !== null && <p className="mt-2 text-center text-xs text-muted">{cells[selected].label}</p>}
      {showLegend && (
        // `text-muted` (no `text-faint`): a "0%"/"100%" son texto real de la leyenda, necesitan contraste AA.
        <div className="mt-2.5 flex items-center gap-2 text-[10.5px] text-muted">
          <span>0 %</span>
          <div
            className="h-2 flex-1 rounded-pill"
            style={{ background: "linear-gradient(to right, #e5534b, #f08a4b, #f0c24b, #9bcf5b, #22c586)" }}
          />
          <span>100 %</span>
        </div>
      )}
    </div>
  );
}
