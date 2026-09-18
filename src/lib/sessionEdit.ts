import type { LoggedSet, WorkoutSession } from "../types/logs";

/** Aplica un patch a una serie puntual (ejercicio + índice de serie) dentro de una sesión. */
export function patchLoggedSet(
  session: WorkoutSession,
  exerciseIdx: number,
  setIndex: number,
  patch: Partial<LoggedSet>
): WorkoutSession {
  return {
    ...session,
    exercises: session.exercises.map((ex, i) => {
      if (i !== exerciseIdx) return ex;
      return { ...ex, sets: ex.sets.map((s) => (s.setIndex === setIndex ? { ...s, ...patch } : s)) };
    }),
    updatedAt: new Date().toISOString(),
  };
}

/** Deja una serie como si nunca se hubiera registrado (para eliminarla o volver a hacerla). */
export function clearLoggedSet(session: WorkoutSession, exerciseIdx: number, setIndex: number): WorkoutSession {
  return patchLoggedSet(session, exerciseIdx, setIndex, {
    weightKg: null,
    reps: null,
    rir: null,
    confirmed: false,
  });
}
