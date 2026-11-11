import type { Habit, HabitEntry } from "../types/habits";
import { isScheduledDate } from "./habitStreaks";

export interface HabitDayHeat {
  /** null = gris neutro (nunca rojo); si no, 0-100 ya calculado (capado a 100 si se pasó del objetivo). */
  pct: number | null;
  /** Por qué es neutro, para variar el estilo (ej. salteado se ve distinto de "sin programar"). Solo tiene sentido cuando `pct` es null. */
  reason?: "skip" | "unscheduled" | "before-start" | "future" | "pending-today";
  /** Texto accesible para mostrar al tocar el día: fecha + estado/valor/%. */
  label: string;
}

function shortDate(d: string): string {
  return `${d.slice(8, 10)}/${d.slice(5, 7)}`;
}

/**
 * Clasifica un único día de un hábito en la escala roja→verde (Fase 5).
 * Única fuente de verdad, reutilizada por el mapa de 16 semanas, la mini
 * fila de 14 días de la tarjeta, y el calendario de Detalle — para que los
 * tres queden siempre consistentes entre sí.
 */
export function habitDayHeat(habit: Habit, entryByDate: Map<string, HabitEntry>, date: string, asOf: string): HabitDayHeat {
  const d = shortDate(date);
  if (date > asOf) return { pct: null, reason: "future", label: `${d}: todavía no llega` };
  if (date < habit.startDate) return { pct: null, reason: "before-start", label: `${d}: antes de empezar` };

  const entry = entryByDate.get(date);

  if (habit.frequency.kind === "weekly") {
    // Sin día asignado: un día sin hacer nunca es rojo, solo gris neutro (ver Fase 4).
    if (entry?.status === "done") return { pct: 100, label: `${d}: hecho` };
    if (entry?.status === "skip") return { pct: null, reason: "skip", label: `${d}: salteado` };
    return { pct: null, reason: "unscheduled", label: `${d}: sin hacer` };
  }

  if (!isScheduledDate(habit, date)) return { pct: null, reason: "unscheduled", label: `${d}: sin programar` };
  if (entry?.status === "skip") return { pct: null, reason: "skip", label: `${d}: salteado` };

  if (habit.type === "quantity") {
    if (!entry || entry.value === null) {
      if (date === asOf) return { pct: null, reason: "pending-today", label: `${d}: todavía sin registrar` };
      return { pct: 0, label: `${d}: 0 %` };
    }
    const goal = habit.goal ?? 0;
    const pct = goal > 0 ? Math.min(100, (entry.value / goal) * 100) : entry.value > 0 ? 100 : 0;
    const unit = habit.unit ? ` ${habit.unit}` : "";
    return { pct, label: `${d}: ${Math.round(pct)} % (${entry.value}${unit} / ${goal}${unit})` };
  }

  // sí/no, tiempo, a evitar: binario hecho/no hecho.
  if (entry?.status === "done") return { pct: 100, label: `${d}: hecho (100 %)` };
  if (date === asOf) return { pct: null, reason: "pending-today", label: `${d}: todavía sin registrar` };
  return { pct: 0, label: `${d}: no hecho (0 %)` };
}
