import type { ExerciseNoteEntry, LogsData, WorkoutSession } from "../types/logs";
import type { Habit, HabitEntry, HabitLog } from "../types/habits";

function mergeById<T extends { id: string; updatedAt: string }>(a: T[], b: T[]): T[] {
  const byId = new Map<string, T>();
  for (const item of [...a, ...b]) {
    const existing = byId.get(item.id);
    if (!existing || new Date(item.updatedAt) >= new Date(existing.updatedAt)) {
      byId.set(item.id, item);
    }
  }
  return Array.from(byId.values());
}

/**
 * Combina dos versiones de logs.json (por ejemplo local vs. remoto tras un
 * conflicto de sha, o al abrir la app con cambios pendientes). Es una fusión
 * simple pensada para un solo usuario en varios dispositivos: une por id en
 * cada colección y, si el mismo id existe en ambos lados con contenido
 * distinto, gana el `updatedAt` más reciente. Nunca reemplaza el archivo
 * entero ni pisa datos nuevos con una versión más vieja.
 *
 * PENDIENTE antes de activar sync entre dispositivos (verificado con una
 * simulación en HABI7 v2 Fase 6A): esto es una unión por id, sin manera de
 * distinguir "nunca existió" de "se borró" — un `habitLog`/`habitEntry`
 * borrado en un dispositivo reaparece al fusionar con otro que todavía lo
 * tiene. Hace falta un marcador de borrado (tombstone) para `habitLogs` y
 * `habitEntries` antes de que el sync sea seguro con más de un dispositivo.
 */
export function mergeLogs(a: LogsData, b: LogsData): LogsData {
  const sessions = mergeById<WorkoutSession>(a.sessions, b.sessions).sort(
    (s1, s2) => s1.programIndex - s2.programIndex
  );
  const exerciseNoteEntries = mergeById<ExerciseNoteEntry>(a.exerciseNoteEntries, b.exerciseNoteEntries).sort(
    (x, y) => x.date.localeCompare(y.date)
  );
  const habits = mergeById<Habit>(a.habits, b.habits).sort((x, y) => x.createdAt.localeCompare(y.createdAt));
  const habitEntries = mergeById<HabitEntry>(a.habitEntries, b.habitEntries).sort((x, y) => x.date.localeCompare(y.date));
  const habitLogs = mergeById<HabitLog>(a.habitLogs, b.habitLogs).sort((x, y) => x.date.localeCompare(y.date));

  return {
    version: 5,
    sessions,
    exerciseNoteEntries,
    habits,
    habitEntries,
    habitLogs,
  };
}
