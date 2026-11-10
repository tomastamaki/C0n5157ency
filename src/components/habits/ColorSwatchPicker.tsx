import type { HabitColor } from "../../types/habits";
import { IconCheck } from "../icons";
import { HABIT_COLOR_ORDER, HABIT_COLORS } from "./habitVisuals";

interface ColorSwatchPickerProps {
  value: HabitColor;
  onChange: (color: HabitColor) => void;
}

/** Selector de los 8 colores fijos de hábito. */
export function ColorSwatchPicker({ value, onChange }: ColorSwatchPickerProps) {
  return (
    <div className="grid grid-cols-8 gap-2">
      {HABIT_COLOR_ORDER.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={c}
          aria-pressed={value === c}
          onClick={() => onChange(c)}
          style={{
            backgroundColor: HABIT_COLORS[c],
            boxShadow: value === c ? `0 0 0 2px rgb(var(--bg)), 0 0 0 4px ${HABIT_COLORS[c]}` : undefined,
          }}
          className="flex aspect-square items-center justify-center rounded-full text-habitink"
        >
          {value === c && <IconCheck className="h-4 w-4" strokeWidth={3} />}
        </button>
      ))}
    </div>
  );
}
