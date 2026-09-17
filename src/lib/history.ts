import type { LogsData, LoggedSet } from "../types/logs";
import { isSetLogged } from "../types/logs";
import type { Program } from "../types/program";

/** Busca el último registro guardado de un mismo ejercicio + índice de serie, antes de un día dado del programa. */
export function findLastLoggedSet(
  logs: LogsData,
  exerciseName: string,
  setIndex: number,
  beforeProgramIndex: number
): LoggedSet | null {
  const sessions = logs.sessions
    .filter((s) => s.programIndex < beforeProgramIndex && s.status === "completed")
    .sort((a, b) => b.programIndex - a.programIndex);

  for (const session of sessions) {
    const exercise = session.exercises.find((e) => e.exercise === exerciseName);
    if (!exercise) continue;
    const set = exercise.sets.find((s) => s.setIndex === setIndex && isSetLogged(s));
    if (set) return set;
  }
  return null;
}

export interface ProgressionPoint {
  sessionId: string;
  date: string;
  weekNumber: number;
  weightKg: number;
  reps: number;
  rir: string;
}

/** Progresión histórica de un ejercicio para una serie dada (por defecto la primera serie de trabajo). */
export function getExerciseProgression(
  logs: LogsData,
  exerciseName: string,
  setIndex = 0
): ProgressionPoint[] {
  return logs.sessions
    .filter((s) => s.status === "completed")
    .sort((a, b) => a.programIndex - b.programIndex)
    .flatMap((session) => {
      const exercise = session.exercises.find((e) => e.exercise === exerciseName);
      const set = exercise?.sets.find((s) => s.setIndex === setIndex);
      if (!set || !isSetLogged(set)) return [];
      return [
        {
          sessionId: session.id,
          date: session.completedAt ?? session.startedAt,
          weekNumber: session.weekNumber,
          weightKg: set.weightKg as number,
          reps: set.reps as number,
          rir: set.rir as string,
        },
      ];
    });
}

/** % de mejora entre el primer y el último registro histórico (null si hay menos de 2). */
export function getPctImprovement(points: ProgressionPoint[]): number | null {
  if (points.length < 2) return null;
  const first = points[0].weightKg;
  const last = points[points.length - 1].weightKg;
  if (first === 0) return null;
  return ((last - first) / first) * 100;
}

/**
 * Si la última vez que apareció esta prescripción (mismo ejercicio original)
 * el usuario la sustituyó (o la hizo tal cual), devuelve el nombre elegido
 * esa vez, para preseleccionarlo la próxima. Si nunca se tocó, devuelve null.
 */
export function getPreferredExercise(
  logs: LogsData,
  originalExerciseName: string,
  beforeProgramIndex: number
): string | null {
  const past = logs.sessions
    .filter((s) => s.programIndex < beforeProgramIndex && s.status !== "in_progress")
    .sort((a, b) => b.programIndex - a.programIndex);

  for (const session of past) {
    const ex = session.exercises.find(
      (e) => (e.originalExercise ?? e.exercise) === originalExerciseName
    );
    if (ex) return ex.exercise;
  }
  return null;
}

export function getAllExerciseNames(program: Program): string[] {
  const names = new Set<string>();
  program.blocks.forEach((b) =>
    b.weeks.forEach((w) =>
      w.days.forEach((d) => d.exerciseGroups.forEach((g) => names.add(g.exercise)))
    )
  );
  return Array.from(names).sort((a, b) => a.localeCompare(b, "es"));
}

const DAY_ORDER = ["Upper", "Lower", "Push", "Pull"];

/** Nombres de ejercicio únicos, agrupados por el primer tipo de día donde aparecen. */
export function getExerciseNamesByDay(program: Program): { day: string; exercises: string[] }[] {
  const seen = new Set<string>();
  const byDay = new Map<string, string[]>();

  program.blocks.forEach((b) =>
    b.weeks.forEach((w) =>
      w.days.forEach((d) =>
        d.exerciseGroups.forEach((g) => {
          if (seen.has(g.exercise)) return;
          seen.add(g.exercise);
          if (!byDay.has(d.name)) byDay.set(d.name, []);
          byDay.get(d.name)!.push(g.exercise);
        })
      )
    )
  );

  for (const list of byDay.values()) list.sort((a, b) => a.localeCompare(b, "es"));

  return DAY_ORDER.filter((d) => byDay.has(d)).map((day) => ({ day, exercises: byDay.get(day)! }));
}
