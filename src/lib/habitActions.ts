import { newId } from "./id";
import type { Habit, HabitEntry } from "../types/habits";

/** Resultado de una acción: la entrada siguiente (null = "sin registro", volvió a pendiente) y la anterior, para poder deshacer. */
export interface ActionResult {
  next: HabitEntry | null;
  previous: HabitEntry | null;
}

function todayEntryOf(habit: Habit, allEntries: HabitEntry[], date: string): HabitEntry | null {
  let found: HabitEntry | null = null;
  for (const e of allEntries) {
    if (e.habitId !== habit.id || e.date !== date) continue;
    if (!found || e.updatedAt >= found.updatedAt) found = e;
  }
  return found;
}

function makeEntry(habit: Habit, date: string, patch: Partial<HabitEntry>, previous: HabitEntry | null): HabitEntry {
  return {
    id: previous?.id ?? newId(),
    habitId: habit.id,
    date,
    status: "done",
    value: null,
    source: "manual",
    updatedAt: new Date().toISOString(),
    ...patch,
  };
}

/** Sí/no y a evitar: tocar completa; tocar de nuevo sobre una completada deshace (vuelve a pendiente). */
export function toggleDone(habit: Habit, allEntries: HabitEntry[], date: string): ActionResult {
  const previous = todayEntryOf(habit, allEntries, date);
  if (previous?.status === "done") return { next: null, previous };
  return { next: makeEntry(habit, date, { status: "done" }, previous), previous };
}

/** Cantidad: suma al valor de hoy; pasa a "done" al llegar a la meta, "partial" antes de llegar. */
export function addQuantity(habit: Habit, allEntries: HabitEntry[], date: string, amount: number): ActionResult {
  const previous = todayEntryOf(habit, allEntries, date);
  const value = (previous?.status === "partial" || previous?.status === "done" ? (previous.value ?? 0) : 0) + amount;
  const status = value >= habit.goal ? "done" : "partial";
  return { next: makeEntry(habit, date, { status, value }, previous), previous };
}

/** Tiempo: "Iniciar" marca la sesión de hoy como completada directamente (sin cronómetro en vivo por ahora). */
export function completeTimeGoal(habit: Habit, allEntries: HabitEntry[], date: string): ActionResult {
  const previous = todayEntryOf(habit, allEntries, date);
  return { next: makeEntry(habit, date, { status: "done", value: habit.goal }, previous), previous };
}

/** Saltear: pausa avisada, no cuenta como fallo ni corta la racha. */
export function skipToday(habit: Habit, allEntries: HabitEntry[], date: string): ActionResult {
  const previous = todayEntryOf(habit, allEntries, date);
  return { next: makeEntry(habit, date, { status: "skip", value: null }, previous), previous };
}

/** Deshacer un salteado: vuelve a pendiente. */
export function unskip(habit: Habit, allEntries: HabitEntry[], date: string): ActionResult {
  const previous = todayEntryOf(habit, allEntries, date);
  return { next: null, previous };
}

export function newHabit(input: Omit<Habit, "id" | "createdAt" | "updatedAt" | "archivedAt">): Habit {
  const now = new Date().toISOString();
  return { ...input, id: newId(), archivedAt: null, createdAt: now, updatedAt: now };
}
