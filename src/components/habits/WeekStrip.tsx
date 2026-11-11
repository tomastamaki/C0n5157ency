import { Ring } from "./Ring";
import { colorForPct } from "../../lib/heatScale";

export interface WeekStripDay {
  letter: string;
  dayNumber: number;
  done: number;
  total: number;
  isToday?: boolean;
}

interface WeekStripProps {
  days: WeekStripDay[];
  title?: string;
}

/** Tira semanal: un anillo de 34px por día, con el día de hoy resaltado. */
export function WeekStrip({ days, title = "Esta semana" }: WeekStripProps) {
  const doneTotal = days.reduce((a, d) => a + d.done, 0);
  const weekTotal = days.reduce((a, d) => a + d.total, 0);
  const pct = weekTotal > 0 ? Math.round((doneTotal / weekTotal) * 100) : 0;

  return (
    <div className="rounded-card border border-border bg-surface px-2.5 py-3 shadow-elevated-sm">
      <div className="flex justify-between px-1.5 pb-2 text-xs text-muted">
        <span>{title}</span>
        <span>
          <b className="font-mono text-ink">{doneTotal}</b> de {weekTotal} ·{" "}
          <b className="font-mono text-ink">{pct}%</b>
        </span>
      </div>
      <div className="flex justify-between">
        {days.map((d, i) => {
          const ratio = d.total > 0 ? d.done / d.total : 0;
          // Misma escala roja→verde que el resto de los mapas de calor (Fase 5); con pct=0 y sin datos no se dibuja ningún trazo, así que el color es inocuo.
          const color = colorForPct(ratio * 100);
          return (
            <div
              key={i}
              className={`flex w-[45px] flex-col items-center gap-1.5 rounded-block py-1.5 text-[11px] font-bold text-faint ${
                d.isToday ? "bg-surface2 text-ink" : ""
              }`}
            >
              <span>{d.letter}</span>
              <Ring
                size={34}
                strokeWidth={3.5}
                pct={ratio}
                color={color}
                centerLabel={
                  <span className={`font-mono text-[11px] ${d.isToday ? "font-extrabold" : "font-bold"} text-ink`}>
                    {d.dayNumber}
                  </span>
                }
                ariaLabel={`Día ${d.dayNumber}: ${d.done} de ${d.total}`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
