import type { Habit } from "../../types/habits";
import { ExactValueField } from "./ExactValueField";
import { SecondaryValueField } from "./SecondaryValueField";

interface Props {
  habit: Habit;
  color: string;
  onAdd: (value: number | null, secondaryValue?: number | null) => void;
}

/**
 * Botones rápidos + valor exacto de un hábito (y, si tiene, los del campo
 * secundario aparte). Compartido entre Detalle, la pestaña Métricas y la
 * hoja de carga rápida desde Hoy, para que los tres se comporten igual.
 */
export function QuickAddRow({ habit, color, onAdd }: Props) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {habit.quickSteps.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onAdd(n)}
            className="h-9 rounded-pill border px-3 font-mono text-[13px] font-bold text-ink"
            style={{
              backgroundColor: `color-mix(in srgb, ${color} 20%, rgb(var(--surface)))`,
              borderColor: `color-mix(in srgb, ${color} 50%, rgb(var(--border)))`,
            }}
          >
            {habit.aggregation === "sum" ? "+" : ""}
            {n} {habit.unit ?? ""}
          </button>
        ))}
        <ExactValueField unit={habit.unit ?? ""} color={color} onAdd={(v) => onAdd(v)} />
      </div>
      {habit.secondaryField && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-border pt-2.5">
          {habit.secondaryField.quickValues.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onAdd(null, n)}
              className="h-9 rounded-pill border px-3 font-mono text-[13px] font-bold text-ink"
              style={{
                backgroundColor: `color-mix(in srgb, ${color} 20%, rgb(var(--surface)))`,
                borderColor: `color-mix(in srgb, ${color} 50%, rgb(var(--border)))`,
              }}
            >
              {n}
            </button>
          ))}
          <SecondaryValueField field={habit.secondaryField} color={color} onAdd={(v) => onAdd(null, v)} />
        </div>
      )}
    </>
  );
}
