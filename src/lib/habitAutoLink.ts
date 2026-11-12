import type { Habit, HabitEntry } from "../types/habits";
import { canAutoMark, entryMapFor } from "./habitStreaks";
import { newId } from "./id";

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
