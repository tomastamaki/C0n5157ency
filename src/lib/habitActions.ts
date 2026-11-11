import { newId } from "./id";
import type { Habit, HabitEntry } from "../types/habits";

/** Resultado de una acción: la entrada siguiente (null = "sin registro", volvió a pendiente) y la anterior, para poder deshacer. */
export interface ActionResult {
  next: HabitEntry | null;
  previous: HabitEntry | null;
}

export function entryForDate(habit: Habit, allEntries: HabitEntry[], date: string): HabitEntry | null {
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
  const previous = entryForDate(habit, allEntries, date);
  if (previous?.status === "done") return { next: null, previous };
  return { next: makeEntry(habit, date, { status: "done" }, previous), previous };
}

/** Tiempo: "Iniciar" marca la sesión de hoy como completada directamente (sin cronómetro en vivo por ahora). */
export function completeTimeGoal(habit: Habit, allEntries: HabitEntry[], date: string): ActionResult {
  const previous = entryForDate(habit, allEntries, date);
  return { next: makeEntry(habit, date, { status: "done", value: habit.goal }, previous), previous };
}

/** Saltear: pausa avisada, no cuenta como fallo ni corta la racha. */
export function skipToday(habit: Habit, allEntries: HabitEntry[], date: string): ActionResult {
  const previous = entryForDate(habit, allEntries, date);
  return { next: makeEntry(habit, date, { status: "skip", value: null }, previous), previous };
}

/** Deshacer un salteado: vuelve a pendiente. */
export function unskip(habit: Habit, allEntries: HabitEntry[], date: string): ActionResult {
  const previous = entryForDate(habit, allEntries, date);
  return { next: null, previous };
}

/** Setea directamente el estado de una fecha cualquiera (usado por el calendario editable de Detalle). "none" borra la entrada. */
export function setEntryStatus(
  habit: Habit,
  allEntries: HabitEntry[],
  date: string,
  status: "done" | "skip" | "none"
): ActionResult {
  const previous = entryForDate(habit, allEntries, date);
  if (status === "none") return { next: null, previous };
  return { next: makeEntry(habit, date, { status, value: status === "done" ? (previous?.value ?? null) : null }, previous), previous };
}

export function newHabit(input: Omit<Habit, "id" | "createdAt" | "updatedAt" | "archivedAt">): Habit {
  const now = new Date().toISOString();
  return { ...input, id: newId(), archivedAt: null, createdAt: now, updatedAt: now };
}

/** Archivar conserva todo el historial de entradas; solo deja de contar como activo. */
export function archiveHabit(habit: Habit): Habit {
  return { ...habit, archivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}

export function restoreHabit(habit: Habit): Habit {
  return { ...habit, archivedAt: null, updatedAt: new Date().toISOString() };
}
