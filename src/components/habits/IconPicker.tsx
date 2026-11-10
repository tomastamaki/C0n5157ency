import { HABIT_ICONS, HABIT_ICON_ORDER } from "./habitVisuals";

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
}

/** Selector de ícono para el hábito, en grilla de 6 columnas. */
export function IconPicker({ value, onChange }: IconPickerProps) {
  return (
    <div className="grid grid-cols-6 gap-2">
      {HABIT_ICON_ORDER.map((name) => {
        const Icon = HABIT_ICONS[name];
        const selected = name === value;
        return (
          <button
            key={name}
            type="button"
            aria-label={name}
            aria-pressed={selected}
            onClick={() => onChange(name)}
            className={`flex aspect-square items-center justify-center rounded-pill border ${
              selected ? "border-primary bg-primary/[0.18] text-primary" : "border-border bg-surface text-muted"
            }`}
          >
            <Icon className="h-5 w-5" />
          </button>
        );
      })}
    </div>
  );
}
