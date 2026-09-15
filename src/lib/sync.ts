import type { LogsData, WorkoutSession } from "../types/logs";

/**
 * Combina dos versiones de logs.json (por ejemplo local vs. remoto tras un
 * conflicto de sha). Es una fusión simple pensada para un solo usuario en un
 * solo dispositivo a la vez: une por id de sesión y, si el mismo id existe en
 * ambos lados con contenido distinto, gana el `updatedAt` más reciente.
 */
export function mergeLogs(a: LogsData, b: LogsData): LogsData {
  const byId = new Map<string, WorkoutSession>();

  for (const session of [...a.sessions, ...b.sessions]) {
    const existing = byId.get(session.id);
    if (!existing || new Date(session.updatedAt) >= new Date(existing.updatedAt)) {
      byId.set(session.id, session);
    }
  }

  const sessions = Array.from(byId.values()).sort((s1, s2) => s1.programIndex - s2.programIndex);
  return { version: 1, sessions };
}
