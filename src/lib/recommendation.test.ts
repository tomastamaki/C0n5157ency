import { describe, it, expect } from "vitest";
import { checkMuscleRecovery } from "./recommendation";
import { EMPTY_LOGS } from "../types/logs";
import type { LoggedExercise, LoggedSet, LogsData, WorkoutSession } from "../types/logs";
import type { ExerciseGroup, FlatProgramDay, ProgramDay } from "../types/program";

function loggedSet(weightKg: number, reps: number, rir: LoggedSet["rir"]): LoggedSet {
  return { setIndex: 0, weightKg, reps, rir, confirmed: true };
}

function loggedExercise(exercise: string, sets: LoggedSet[]): LoggedExercise {
  return { exercise, originalExercise: null, supersetGroup: null, sets, notes: null, restStartedAt: null };
}

function session(partial: Partial<WorkoutSession> & { completedAt: string; exercises: LoggedExercise[] }): WorkoutSession {
  return {
    id: "s1",
    cycle: 0,
    programIndex: 0,
    blockName: "Bloque",
    weekLabel: "Semana 1",
    weekNumber: 1,
    dayName: "Push",
    status: "completed",
    startedAt: partial.completedAt,
    durationSec: 3600,
    runningSince: null,
    pausedElapsedSec: 0,
    updatedAt: partial.completedAt,
    feeling: null,
    ...partial,
  };
}

function exerciseGroup(exercise: string): ExerciseGroup {
  return {
    exercise,
    videoUrl: null,
    supersetGroup: null,
    intensityTechnique: null,
    notes: null,
    substitutions: [],
    rest: null,
    sets: [],
  };
}

function flatDay(day: ProgramDay): FlatProgramDay {
  return { index: 0, blockIndex: 0, weekIndex: 0, dayIndex: 0, blockName: "Bloque", weekLabel: "Semana 1", weekNumber: 1, totalWeeks: 12, day };
}

const now = new Date("2026-11-03T12:00:00Z");
function hoursAgo(h: number): string {
  return new Date(now.getTime() - h * 60 * 60 * 1000).toISOString();
}

describe("checkMuscleRecovery — umbral de estímulo y factor de volumen por músculo", () => {
  it("Hack Squat (4 series) + Leg Extension (3 series) hace 30h: 7 series ponderadas de Cuádriceps, dispara alerta con el texto canónico", () => {
    const trainingSession = session({
      completedAt: hoursAgo(30),
      exercises: [
        loggedExercise("Hack Squat", [
          loggedSet(100, 8, "1"),
          loggedSet(100, 8, "1"),
          loggedSet(100, 8, "2"),
          loggedSet(100, 8, "2"),
        ]),
        loggedExercise("Leg Extension", [loggedSet(40, 12, "1"), loggedSet(40, 12, "1"), loggedSet(40, 12, "2")]),
      ],
    });
    const logs: LogsData = { ...EMPTY_LOGS, sessions: [trainingSession] };
    const today = flatDay({ name: "Legs", exerciseGroups: [exerciseGroup("Hack Squat")] });

    const alerts = checkMuscleRecovery(logs, today, now);
    const quadAlert = alerts.find((a) => a.muscle === "Cuádriceps");

    expect(quadAlert).toBeDefined();
    expect(quadAlert!.seriesCount).toBe(7);
    expect(Math.round(quadAlert!.hoursSince)).toBe(30);
    expect(Math.round(quadAlert!.recommendedHours)).toBe(72); // base 72h, RIR promedio no ajusta (ni liviano ni duro), factor de volumen = 1 (>= 6 series)
    expect(quadAlert!.detail).toBe("Cuádriceps entrenado hace 30h (7 series), recomendado 72h");
  });

  it("Push day con 1 sola serie de Leg Extension no alcanza el mínimo (3 series): no dispara alerta de piernas aunque haya pasado poco tiempo", () => {
    const pushSession = session({
      completedAt: hoursAgo(10),
      exercises: [loggedExercise("Leg Extension", [loggedSet(40, 12, "2")])],
    });
    const logs: LogsData = { ...EMPTY_LOGS, sessions: [pushSession] };
    const today = flatDay({ name: "Legs", exerciseGroups: [exerciseGroup("Hack Squat")] });

    const alerts = checkMuscleRecovery(logs, today, now);

    expect(alerts.find((a) => a.muscle === "Cuádriceps")).toBeUndefined();
  });

  it("3 series (el mínimo estimulado) recupera con la mitad de las horas base (factor 0.5)", () => {
    const trainingSession = session({
      completedAt: hoursAgo(20),
      exercises: [loggedExercise("Leg Extension", [loggedSet(40, 10, "1"), loggedSet(40, 10, "1"), loggedSet(40, 10, "2")])],
    });
    const logs: LogsData = { ...EMPTY_LOGS, sessions: [trainingSession] };
    const today = flatDay({ name: "Legs", exerciseGroups: [exerciseGroup("Hack Squat")] });

    const alerts = checkMuscleRecovery(logs, today, now);
    const quadAlert = alerts.find((a) => a.muscle === "Cuádriceps");

    expect(quadAlert).toBeDefined();
    expect(quadAlert!.seriesCount).toBe(3);
    expect(Math.round(quadAlert!.recommendedHours)).toBe(36); // 72h base * 0.5 (factor mínimo en minSeries=3)
  });

  it("series secundarias pesan la mitad (SECONDARY_MUSCLE_WEIGHT): Hack Squat también aporta a Glúteos pero a mitad de serie", () => {
    const trainingSession = session({
      completedAt: hoursAgo(10),
      exercises: [
        loggedExercise("Hack Squat", [loggedSet(100, 8, "1"), loggedSet(100, 8, "1"), loggedSet(100, 8, "2")]),
      ],
    });
    const logs: LogsData = { ...EMPTY_LOGS, sessions: [trainingSession] };
    const today = flatDay({ name: "Legs", exerciseGroups: [exerciseGroup("Hack Squat")] });

    const alerts = checkMuscleRecovery(logs, today, now);
    // 3 series secundarias * 0.5 = 1.5, por debajo del mínimo de 3: Glúteos no se considera entrenado.
    expect(alerts.find((a) => a.muscle === "Glúteos")).toBeUndefined();
    // Cuádriceps (primario, 3 series) sí llega al mínimo.
    expect(alerts.find((a) => a.muscle === "Cuádriceps")).toBeDefined();
  });
});
