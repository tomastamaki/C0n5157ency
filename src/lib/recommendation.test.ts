import { describe, it, expect } from "vitest";
import { checkMuscleRecovery, getRecommendation } from "./recommendation";
import { flattenProgram } from "./schedule";
import { EMPTY_LOGS } from "../types/logs";
import programJson from "../data/program.json";
import type { LoggedExercise, LoggedSet, LogsData, WorkoutSession } from "../types/logs";
import type { Habit, HabitLog } from "../types/habits";
import type { ExerciseGroup, FlatProgramDay, ProgramDay } from "../types/program";
import type { Program } from "../types/program";

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

describe("getRecommendation — capa 2 lee la calidad de sueño del hábito nativo 'Sueño' (HABI7 v2 Fase 6A)", () => {
  const program = programJson as unknown as Program;
  const flatDays = flattenProgram(program);

  function findProgramIndex(weekNumber: number, dayName: string): number {
    return flatDays.findIndex((d) => d.weekNumber === weekNumber && d.day.name === dayName);
  }

  /** Sesión sin ejercicios: aísla la capa 2 al parámetro de sueño (RIR, feeling, progreso y series completadas quedan todos "sin dato", nunca generan alerta muscular). Fecha en 2020 para que la Capa 1 (recuperación muscular, que usa el reloj real) nunca dispare, sin importar cuándo corra el test. */
  function emptySession(id: string, weekNumber: number, dayName: string, isoDate: string): WorkoutSession {
    const programIndex = findProgramIndex(weekNumber, dayName);
    return {
      id,
      cycle: 0,
      programIndex,
      blockName: "Bloque 1",
      weekLabel: `Semana ${weekNumber}`,
      weekNumber,
      dayName,
      status: "completed",
      startedAt: isoDate,
      completedAt: isoDate,
      durationSec: 3600,
      runningSince: null,
      pausedElapsedSec: 0,
      updatedAt: isoDate,
      exercises: [],
      // "Normal" (umbral 4-7): mantiene la capa 2 con dato propio, independiente de lo que se prueba acá (sueño).
      feeling: 6,
    };
  }

  function sleepHabit(): Habit {
    return {
      id: "metric-sleep",
      name: "Sueño",
      icon: "moon",
      color: "violeta",
      type: "tracking",
      unit: "h",
      goal: 8,
      aggregation: "last",
      quickSteps: [6, 7, 8, 9],
      frequency: { kind: "daily" },
      category: "Métricas",
      timeOfDay: "Noche",
      startDate: "2020-01-01",
      why: null,
      archivedAt: null,
      linked: null,
      metricKind: "sleep",
      secondaryField: { key: "quality", label: "Calidad", unit: null, min: 0, max: 100, quickValues: [50, 65, 75, 85], defaultValue: 50 },
      createdAt: "x",
      updatedAt: "x",
    };
  }

  function qualityLog(date: string, quality: number): HabitLog {
    return { id: `q-${date}`, habitId: "metric-sleep", date, value: null, secondaryValue: quality, source: "manual", createdAt: `${date}T08:00:00.000Z`, updatedAt: `${date}T08:00:00.000Z` };
  }

  function hoursOnlyLog(date: string, hours: number): HabitLog {
    return { id: `h-${date}`, habitId: "metric-sleep", date, value: hours, secondaryValue: null, source: "manual", createdAt: `${date}T08:00:00.000Z`, updatedAt: `${date}T08:00:00.000Z` };
  }

  const sessions: WorkoutSession[] = [
    emptySession("s1", 1, "Upper", "2020-01-06T08:00:00.000Z"),
    emptySession("s2", 2, "Upper", "2020-01-13T08:00:00.000Z"),
    emptySession("s3", 3, "Upper", "2020-01-20T08:00:00.000Z"),
  ];

  it("con calidad cargada en >= 2 noches de la ventana, el parámetro 'sleep' usa la calidad, no las horas", () => {
    const habits = [sleepHabit()];
    // Calidad alta (85) las 3 noches: el param "sleep" debería clasificar +1 (umbral alto = 75).
    const habitLogs = [qualityLog("2020-01-06", 85), qualityLog("2020-01-13", 85), qualityLog("2020-01-20", 85)];
    const logs: LogsData = { ...EMPTY_LOGS, sessions, habits, habitLogs };

    const rec = getRecommendation(logs, program, flatDays, "Upper", 4, 0);
    expect(rec.level).not.toBe("not-enough-data");
    const sleepParam = rec.layer2?.params.find((p) => p.key === "sleep");
    expect(sleepParam?.rawValue).toBe(85);
    expect(sleepParam?.classified).toBe(1);
  });

  it("horas cargadas pero SIN calidad en ninguna noche: el parámetro 'sleep' queda sin dato (no usa las horas como sustituto)", () => {
    const habits = [sleepHabit()];
    const habitLogs = [hoursOnlyLog("2020-01-06", 8), hoursOnlyLog("2020-01-13", 7.5), hoursOnlyLog("2020-01-20", 8)];
    const logs: LogsData = { ...EMPTY_LOGS, sessions, habits, habitLogs };

    const rec = getRecommendation(logs, program, flatDays, "Upper", 4, 0);
    const sleepParam = rec.layer2?.params.find((p) => p.key === "sleep");
    expect(sleepParam?.rawValue).toBeNull();
    expect(sleepParam?.classified).toBeNull();
  });

  it("calidad en una sola noche (menos del mínimo de 2): tampoco cuenta", () => {
    const habits = [sleepHabit()];
    const habitLogs = [qualityLog("2020-01-06", 90)];
    const logs: LogsData = { ...EMPTY_LOGS, sessions, habits, habitLogs };

    const rec = getRecommendation(logs, program, flatDays, "Upper", 4, 0);
    const sleepParam = rec.layer2?.params.find((p) => p.key === "sleep");
    expect(sleepParam?.rawValue).toBeNull();
  });

  it("sin hábito nativo 'Sueño' en absoluto: no rompe, el parámetro queda sin dato", () => {
    const logs: LogsData = { ...EMPTY_LOGS, sessions, habits: [], habitLogs: [] };
    const rec = getRecommendation(logs, program, flatDays, "Upper", 4, 0);
    expect(rec.level).not.toBe("muscle-alert");
    const sleepParam = rec.layer2?.params.find((p) => p.key === "sleep");
    expect(sleepParam?.rawValue).toBeNull();
  });
});
