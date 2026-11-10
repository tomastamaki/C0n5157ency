import type { HeatLevel } from "./habitVisuals";

interface HeatGridProps {
  /** Orden columna por columna, de más vieja a más nueva; longitud múltiplo de 7. */
  cells: HeatLevel[];
  /** Etiquetas de mes, una por columna (vacías donde no corresponde mostrar nada). */
  monthLabels?: string[];
  color?: string;
  showLegend?: boolean;
  nowIndex?: number;
}

function cellClass(level: HeatLevel): string {
  if (level === "skip") return "bg-ghost shadow-[inset_0_0_0_1px_rgb(var(--border))]";
  if (level === 3) return "bg-[var(--c)]";
  if (level === 2) return "bg-[color-mix(in_srgb,var(--c)_68%,rgb(var(--surface-2)))]";
  if (level === 1) return "bg-[color-mix(in_srgb,var(--c)_38%,rgb(var(--surface-2)))]";
  return "bg-surface2";
}

/** Mapa de calor de 16 semanas (7 filas, lunes arriba) para Detalle y Progreso. */
export function HeatGrid({ cells, monthLabels, color = "rgb(var(--primary))", showLegend = true, nowIndex }: HeatGridProps) {
  const cols = Math.ceil(cells.length / 7);

  return (
    <div style={{ "--c": color } as React.CSSProperties}>
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
        role="img"
        aria-label="Mapa de calor de las últimas 16 semanas"
      >
        {cells.map((level, i) => (
          <i
            key={i}
            className={`block aspect-square rounded-[3px] ${cellClass(level)} ${
              i === nowIndex ? "shadow-[0_0_0_2px_rgb(var(--text))]" : ""
            }`}
          />
        ))}
      </div>
      {showLegend && (
        <div className="mt-2.5 flex items-center justify-end gap-1 text-[10.5px] text-faint">
          Menos
          <i className="block h-2.5 w-2.5 rounded-[3px] bg-surface2" />
          <i className="block h-2.5 w-2.5 rounded-[3px] bg-ghost shadow-[inset_0_0_0_1px_rgb(var(--border))]" />
          <i className="block h-2.5 w-2.5 rounded-[3px] bg-[var(--c)]" />
          Más
        </div>
      )}
    </div>
  );
}
