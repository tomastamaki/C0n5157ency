import type {
  BodyWeightEntry,
  ExerciseNoteEntry,
  LogsData,
  SleepEntry,
  StepsEntry,
  WaterEntry,
  WorkoutSession,
} from "../types/logs";

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
 */
export function mergeLogs(a: LogsData, b: LogsData): LogsData {
  const sessions = mergeById<WorkoutSession>(a.sessions, b.sessions).sort(
    (s1, s2) => s1.programIndex - s2.programIndex
  );
  const bodyWeightEntries = mergeById<BodyWeightEntry>(a.bodyWeightEntries, b.bodyWeightEntries).sort((x, y) =>
    x.date.localeCompare(y.date)
  );
  const sleepEntries = mergeById<SleepEntry>(a.sleepEntries, b.sleepEntries).sort((x, y) =>
    x.date.localeCompare(y.date)
  );
  const stepsEntries = mergeById<StepsEntry>(a.stepsEntries, b.stepsEntries).sort((x, y) =>
    x.date.localeCompare(y.date)
  );
  const waterEntries = mergeById<WaterEntry>(a.waterEntries, b.waterEntries).sort((x, y) =>
    x.date.localeCompare(y.date)
  );
  const exerciseNoteEntries = mergeById<ExerciseNoteEntry>(a.exerciseNoteEntries, b.exerciseNoteEntries).sort(
    (x, y) => x.date.localeCompare(y.date)
  );

  return { version: 1, sessions, bodyWeightEntries, sleepEntries, stepsEntries, waterEntries, exerciseNoteEntries };
}
