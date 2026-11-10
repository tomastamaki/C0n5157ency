import type { HeatCellState } from "./habitVisuals";

interface HeatRowProps {
  cells: HeatCellState[];
  color: string;
  /** "onColor": la tarjeta ya está rellena del color del hábito (estado "completado"), así que las celdas usan tinta oscura translúcida en vez de los tonos de superficie normales. */
  tone?: "default" | "onColor";
}

/** Mini fila de ~14 días dentro del pie de la tarjeta de hábito. */
export function HeatRow({ cells, color, tone = "default" }: HeatRowProps) {
  const onColor = tone === "onColor";
  return (
    <div className="flex gap-[3px]" style={{ "--c": color } as React.CSSProperties} aria-hidden="true">
      {cells.map((state, i) => (
        <i
          key={i}
          className={
            state === "done"
              ? "block h-2 w-2 rounded-[2px] bg-[var(--c)]"
              : state === "skip"
                ? onColor
                  ? "block h-2 w-2 rounded-[2px] bg-transparent shadow-[inset_0_0_0_1px_var(--c)]"
                  : "block h-2 w-2 rounded-[2px] bg-ghost shadow-[inset_0_0_0_1px_rgb(var(--border))]"
                : state === "pending"
                  ? "block h-2 w-2 rounded-[2px] bg-transparent shadow-[inset_0_0_0_1.5px_var(--c)]"
                  : onColor
                    ? "block h-2 w-2 rounded-[2px] bg-[var(--c)] opacity-[0.16]"
                    : "block h-2 w-2 rounded-[2px] bg-surface2"
          }
        />
      ))}
    </div>
  );
}
