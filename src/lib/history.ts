import type { LogsData, WorkoutSession } from "../types/logs";
import { isSetLogged, rirToNumber } from "../types/logs";
import type { Program } from "../types/program";
import { estimatedE1RM } from "./e1rm";

export interface ProgressionPoint {
  sessionId: string;
  date: string;
  weekNumber: number;
  weightKg: number;
  reps: number;
  rir: string;
  /** 1RM estimado ajustado por RIR (fórmula de Epley), ver lib/e1rm.ts. */
  e1rm: number;
}

/**
 * Progresión histórica de un ejercicio para una serie dada (por defecto la
 * primera serie de trabajo). Si se pasa `dayName`, se limita a sesiones de
 * ese tipo de día — necesario cuando el mismo nombre de ejercicio aparece
 * como sustituto en una rutina y como prescripto en otra con una prescripción
 * de reps distinta en esa misma posición (ver `exerciseReference.ts`).
 */
export function getExerciseProgression(
  logs: LogsData,
  exerciseName: string,
  setIndex = 0,
  dayName?: string
): ProgressionPoint[] {
  return logs.sessions
    .filter((s) => s.status === "completed" && (dayName === undefined || s.dayName === dayName))
    .sort((a, b) => a.programIndex - b.programIndex)
    .flatMap((session) => {
      const exercise = session.exercises.find((e) => e.exercise === exerciseName);
      const set = exercise?.sets.find((s) => s.setIndex === setIndex);
      if (!set || !isSetLogged(set)) return [];
      const weightKg = set.weightKg as number;
      const reps = set.reps as number;
      const rir = set.rir as string;
      return [
        {
          sessionId: session.id,
          date: session.completedAt ?? session.startedAt,
          weekNumber: session.weekNumber,
          weightKg,
          reps,
          rir,
          e1rm: estimatedE1RM(weightKg, reps, rirToNumber(set.rir!)),
        },
      ];
    });
}

/** % de mejora entre el primer y el último registro histórico, medido en e1RM (null si hay menos de 2). */
export function getPctImprovement(points: ProgressionPoint[]): number | null {
  if (points.length < 2) return null;
  const first = points[0].e1rm;
  const last = points[points.length - 1].e1rm;
  if (first === 0) return null;
  return ((last - first) / first) * 100;
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

export const DAY_ORDER = ["Upper", "Lower", "Push", "Pull"];

/**
 * A qué tipo de día pertenece cada nombre de ejercicio: el prescripto por el
 * programa (primera aparición) o, si nunca aparece como ejercicio prescripto
 * (un sustituto puro), el día de la primera sesión real donde se hizo.
 * Se reusa tanto para la lista del historial como para agrupar los PRs.
 */
export function buildExerciseDayMap(program: Program, sessions: WorkoutSession[]): Map<string, string> {
  const dayOf = new Map<string, string>();

  program.blocks.forEach((b) =>
    b.weeks.forEach((w) =>
      w.days.forEach((d) =>
        d.exerciseGroups.forEach((g) => {
          if (!dayOf.has(g.exercise)) dayOf.set(g.exercise, d.name);
        })
      )
    )
  );

  sessions
    .filter((s) => s.status === "completed")
    .forEach((s) =>
      s.exercises.forEach((ex) => {
        if (!dayOf.has(ex.exercise)) dayOf.set(ex.exercise, s.dayName);
      })
    );

  return dayOf;
}

/** Tipos de día (Upper/Lower/Push/Pull) bajo los que se registró efectivamente un ejercicio, ordenados. Más de uno significa que es sustituto en una rutina y prescripto (u otro sustituto) en otra. */
export function getExerciseDayTypes(sessions: WorkoutSession[], exerciseName: string): string[] {
  const days = new Set<string>();
  sessions
    .filter((s) => s.status === "completed" && s.exercises.some((e) => e.exercise === exerciseName))
    .forEach((s) => days.add(s.dayName));
  return DAY_ORDER.filter((d) => days.has(d));
}

export interface ExerciseListEntry {
  name: string;
  /** Si tiene al menos un registro guardado (ejercicio realmente hecho, no solo prescripto). */
  hasHistory: boolean;
}

/**
 * Nombres de ejercicio agrupados por tipo de día, para el selector del
 * historial. Incluye tanto los que ya tienen registros (el ejercicio
 * efectivamente hecho, sustituto incluido) como los prescriptos por el
 * programa que todavía no se hicieron: estos últimos quedan marcados con
 * `hasHistory: false` para mostrarlos atenuados al final de su grupo, en vez
 * de ocultarlos. Si un ejercicio original y su sustituto tienen historial
 * propio, ambos aparecen como entradas separadas.
 */
export function getExerciseNamesByDay(
  program: Program,
  sessions: WorkoutSession[] = []
): { day: string; exercises: ExerciseListEntry[] }[] {
  const dayOf = buildExerciseDayMap(program, sessions);

  const hasHistory = new Set<string>();
  sessions
    .filter((s) => s.status === "completed")
    .forEach((s) =>
      s.exercises.forEach((ex) => {
        // El objeto de ejercicio existe para todos los grupos del día desde que arranca la sesión;
        // solo cuenta como "con registro" si alguna serie quedó realmente confirmada.
        if (ex.sets.some(isSetLogged)) hasHistory.add(ex.exercise);
      })
    );

  const byDay = new Map<string, ExerciseListEntry[]>();
  for (const [name, day] of dayOf) {
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push({ name, hasHistory: hasHistory.has(name) });
  }

  for (const list of byDay.values()) {
    list.sort((a, b) => {
      if (a.hasHistory !== b.hasHistory) return a.hasHistory ? -1 : 1;
      return a.name.localeCompare(b.name, "es");
    });
  }

  return DAY_ORDER.filter((d) => byDay.has(d)).map((day) => ({ day, exercises: byDay.get(day)! }));
}
