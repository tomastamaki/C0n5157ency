import type { HabitColor } from "../../types/habits";
import { IconCheck } from "../icons";
import { Streak } from "./Streak";
import { habitIconFor, HABIT_COLORS } from "./habitVisuals";

interface HabitTileProps {
  name: string;
  icon: string;
  color: HabitColor;
  status: "pending" | "done" | "skip";
  streak: number;
  streakUnit?: string;
  /** Línea secundaria: progreso de cantidad/tiempo, o estado si es sí/no o a evitar. */
  caption: string;
  progressPct?: number;
  onClick?: () => void;
}

/** Mosaico de la vista en grilla (alternativa a la lista en "Hoy"). */
export function HabitTile({ name, icon, color, status, streak, streakUnit, caption, progressPct, onClick }: HabitTileProps) {
  const c = HABIT_COLORS[color];
  const Icon = habitIconFor(icon);
  const done = status === "done";
  const skip = status === "skip";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[136px] flex-col gap-1.5 rounded-card border p-3.5 text-left shadow-elevated ${
        skip ? "border-dashed border-border opacity-60 shadow-none" : ""
      }`}
      style={{
        backgroundColor: done ? c : "rgb(var(--surface))",
        borderColor: done ? "transparent" : skip ? undefined : `color-mix(in srgb, ${c} 30%, rgb(var(--border)))`,
        color: done ? "#0d0e13" : undefined,
      }}
    >
      <div className="flex items-start justify-between">
        <div
          className="flex h-[42px] w-[42px] items-center justify-center rounded-block"
          style={{ backgroundColor: done ? "rgba(13,14,19,0.14)" : c, color: done ? "#0d0e13" : "#0d0e13" }}
        >
          <Icon className="h-5 w-5" />
        </div>
        {!skip &&
          (done ? (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-habitink text-success">
              <IconCheck className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
          ) : (
            <span
              className="block h-7 w-7 rounded-full border-2"
              style={{ borderColor: `color-mix(in srgb, ${c} 70%, rgb(var(--border)))` }}
            />
          ))}
      </div>
      <div className={`mt-auto text-[14.5px] font-bold ${done ? "" : "text-ink"}`}>{name}</div>
      {progressPct !== undefined && !done && (
        <div className="h-1.5 overflow-hidden rounded-pill bg-surface2">
          <div className="h-full rounded-pill" style={{ width: `${Math.min(100, progressPct)}%`, backgroundColor: c }} />
        </div>
      )}
      <div className={`text-[11.5px] ${done ? "text-habitink/80" : "text-muted"}`}>{caption}</div>
      <Streak streak={streak} unit={streakUnit} dim={done} />
    </button>
  );
}
