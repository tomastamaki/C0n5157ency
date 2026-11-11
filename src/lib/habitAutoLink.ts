import type { Habit, HabitEntry, Metric } from "../types/habits";
import { canAutoMark, entryMapFor } from "./habitStreaks";
import { newId } from "./id";

/**
 * Hábitos vinculados a pasos/agua/sueño: cuando la métrica del día cambia, se
 * marcan solos (o actualizan su progreso) si no fueron editados a mano. Nunca
 * pisa una entrada manual (ver `canAutoMark`). Un valor en 0 no escribe nada:
 * no tiene sentido crear una entrada automática vacía.
 */
export function autoMarkEntriesForMetric(habits: Habit[], entries: HabitEntry[], metric: Metric): HabitEntry[] {
  const updates: HabitEntry[] = [];
  const now = new Date().toISOString();

  for (const habit of habits) {
    if (habit.archivedAt || !habit.linked) continue;
    const source = habit.linked.source;
    const value = source === "steps" ? metric.steps : source === "water" ? metric.waterMl : source === "sleep" ? metric.sleepH : null;
    if (value === null || value <= 0) continue;

    const existing = entryMapFor(habit.id, entries).get(metric.date);
    if (!canAutoMark(existing)) continue;
    const status = habit.goal !== null && value >= habit.goal ? "done" : "partial";
    if (existing && existing.status === status && existing.value === value) continue;

    updates.push({
      id: existing?.id ?? newId(),
      habitId: habit.id,
      date: metric.date,
      status,
      value,
      source: "auto",
      updatedAt: now,
    });
  }
  return updates;
}

/** Hábitos vinculados a "Entrenar": se marcan solos al completar una sesión de entrenamiento ese día. */
export function autoMarkWorkoutCompletion(habits: Habit[], entries: HabitEntry[], date: string): HabitEntry[] {
  const updates: HabitEntry[] = [];
  const now = new Date().toISOString();

  for (const habit of habits) {
    if (habit.archivedAt || habit.linked?.source !== "workout") continue;
    const existing = entryMapFor(habit.id, entries).get(date);
    if (!canAutoMark(existing) || existing?.status === "done") continue;

    updates.push({ id: existing?.id ?? newId(), habitId: habit.id, date, status: "done", value: null, source: "auto", updatedAt: now });
  }
  return updates;
}
