import { newId } from "./id";
import { entryForDate } from "./habitActions";
import type { Habit, HabitEntry, HabitLog } from "../types/habits";

export interface LogAggregate {
  value: number;
  source: "auto" | "manual";
}

/**
 * Agrega los `HabitLog` de un hábito para una fecha según `Habit.aggregation`:
 * "sum" suma todos (agua, proteína); "last" se queda con el más reciente por
 * `updatedAt` (peso, sueño, pasos). `null` si no hay ningún log ese día — a
 * diferencia de 0, significa "sin registro", no "registró cero".
 */
export function aggregateForDate(habit: Habit, allLogs: HabitLog[], date: string): LogAggregate | null {
  const dayLogs = allLogs.filter((l) => l.habitId === habit.id && l.date === date);
  if (dayLogs.length === 0) return null;
  const source: "auto" | "manual" = dayLogs.some((l) => l.source === "manual") ? "manual" : "auto";
  if (habit.aggregation === "sum") {
    return { value: dayLogs.reduce((sum, l) => sum + l.value, 0), source };
  }
  const last = dayLogs.reduce((latest, l) => (l.updatedAt > latest.updatedAt ? l : latest));
  return { value: last.value, source: last.source };
}

/**
 * El `HabitEntry` del día, recalculado a partir de los `HabitLog` vigentes.
 * "tracking" nunca genera entry (sin racha ni cumplimiento, ver `Habit.type`);
 * sin logs ese día, tampoco (vuelve a "sin registro", no se deja un valor
 * viejo colgado). Sobrepasar el objetivo sigue siendo "done" sin techo: el
 * valor real se preserva igual, el estado no cambia más allá de "done".
 */
export function deriveEntryForDate(
  habit: Habit,
  allLogs: HabitLog[],
  date: string,
  existingEntry: HabitEntry | null
): HabitEntry | null {
  if (habit.type === "tracking") return null;
  const agg = aggregateForDate(habit, allLogs, date);
  if (!agg) return null;
  const status = habit.goal !== null && agg.value >= habit.goal ? "done" : "partial";
  return {
    id: existingEntry?.id ?? newId(),
    habitId: habit.id,
    date,
    status,
    value: agg.value,
    source: agg.source,
    updatedAt: new Date().toISOString(),
  };
}

export interface LogWriteResult {
  log: HabitLog;
  /** Entry recalculado para la fecha del log (null = hay que borrar el entry existente, si había). */
  entry: HabitEntry | null;
  previousEntry: HabitEntry | null;
}

/** Agrega un registro nuevo (un tap de botón rápido, o un valor exacto) y recalcula el entry del día. */
export function addLog(
  habit: Habit,
  allLogs: HabitLog[],
  allEntries: HabitEntry[],
  date: string,
  value: number,
  source: "auto" | "manual" = "manual"
): LogWriteResult {
  const now = new Date().toISOString();
  const log: HabitLog = { id: newId(), habitId: habit.id, date, value, source, createdAt: now, updatedAt: now };
  const previousEntry = entryForDate(habit, allEntries, date);
  const entry = deriveEntryForDate(habit, [...allLogs, log], date, previousEntry);
  return { log, entry, previousEntry };
}

export interface LogRemoveResult {
  removedLogId: string;
  date: string;
  entry: HabitEntry | null;
  previousEntry: HabitEntry | null;
}

/** Quita un registro puntual y recalcula el entry del día (null si no quedó ninguno: "sum" sin logs borra el entry; "last" cae al anterior). */
export function removeLog(habit: Habit, allLogs: HabitLog[], allEntries: HabitEntry[], logId: string): LogRemoveResult | null {
  const removed = allLogs.find((l) => l.id === logId && l.habitId === habit.id);
  if (!removed) return null;
  const remaining = allLogs.filter((l) => l.id !== logId);
  const previousEntry = entryForDate(habit, allEntries, removed.date);
  const entry = deriveEntryForDate(habit, remaining, removed.date, previousEntry);
  return { removedLogId: logId, date: removed.date, entry, previousEntry };
}

/** Edita el valor de un registro existente (no su fecha) y recalcula el entry del día. */
export function editLog(
  habit: Habit,
  allLogs: HabitLog[],
  allEntries: HabitEntry[],
  logId: string,
  newValue: number
): (LogWriteResult & { date: string }) | null {
  const existing = allLogs.find((l) => l.id === logId && l.habitId === habit.id);
  if (!existing) return null;
  const log: HabitLog = { ...existing, value: newValue, updatedAt: new Date().toISOString() };
  const others = allLogs.filter((l) => l.id !== logId);
  const previousEntry = entryForDate(habit, allEntries, existing.date);
  const entry = deriveEntryForDate(habit, [...others, log], existing.date, previousEntry);
  return { log, entry, previousEntry, date: existing.date };
}

/** Registros de un hábito para una fecha, del más reciente al más viejo (para la lista "Hoy" de Detalle). */
export function logsForDate(habit: Habit, allLogs: HabitLog[], date: string): HabitLog[] {
  return allLogs
    .filter((l) => l.habitId === habit.id && l.date === date)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** El último registro cargado hoy (el más nuevo por `createdAt`), para "deshacer el último registro". */
export function lastLogForDate(habit: Habit, allLogs: HabitLog[], date: string): HabitLog | null {
  const todays = logsForDate(habit, allLogs, date);
  return todays[0] ?? null;
}
