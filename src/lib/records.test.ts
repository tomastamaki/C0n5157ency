import { describe, it, expect } from "vitest";
import {
  getPersonalRecord,
  getE1rmRecord,
  getPersonalRecordInRepRange,
  getPersonalRecordEvents,
} from "./records";
import type { LogsData, LoggedSet, WorkoutSession } from "../types/logs";
import type { Program } from "../types/program";
import { EMPTY_LOGS } from "../types/logs";

/** Programa mínimo de prueba: semana 1 normal, semana 2 "Deload Week". */
const program: Program = {
  blocks: [
    {
      name: "Block 1",
      weeks: [
        { label: "Week 1", weekNumber: 1, days: [] },
        { label: "Deload Week", weekNumber: 2, days: [] },
        { label: "Week 3", weekNumber: 3, days: [] },
      ],
    },
  ],
};

function set(weightKg: number, reps: number, rir: "0" | "1" | "2" | "3+"): LoggedSet {
  return { setIndex: 0, weightKg, reps, rir, confirmed: true };
}

function session(id: string, weekNumber: number, exercise: string, sets: LoggedSet[]): WorkoutSession {
  return {
    id,
    cycle: 0,
    programIndex: weekNumber,
    blockName: "Block 1",
    weekLabel: `Week ${weekNumber}`,
    weekNumber,
    dayName: "Upper",
    status: "completed",
    startedAt: new Date(2026, 0, weekNumber).toISOString(),
    completedAt: new Date(2026, 0, weekNumber).toISOString(),
    durationSec: 3600,
    runningSince: null,
    pausedElapsedSec: 0,
    updatedAt: new Date().toISOString(),
    exercises: [{ exercise, originalExercise: null, supersetGroup: null, sets, notes: null, restStartedAt: null }],
    feeling: null,
  };
}

function logsWith(sessions: WorkoutSession[]): LogsData {
  return { ...EMPTY_LOGS, sessions };
}

describe("getPersonalRecord — excluye semanas de deload", () => {
  it("un peso alto logueado en la semana de deload no se convierte en récord", () => {
    const logs = logsWith([
      session("w1", 1, "Bench Press", [set(80, 5, "1")]),
      session("w2", 2, "Bench Press", [set(100, 5, "2")]), // deload: peso más alto, no debería contar
    ]);
    const pr = getPersonalRecord(logs, program, "Bench Press");
    expect(pr?.weightKg).toBe(80);
  });

  it("sin deload de por medio, el peso más alto sí es récord", () => {
    const logs = logsWith([session("w1", 1, "Bench Press", [set(80, 5, "1")]), session("w2", 3, "Bench Press", [set(85, 5, "1")])]);
    const pr = getPersonalRecord(logs, program, "Bench Press");
    expect(pr?.weightKg).toBe(85);
  });
});

describe("getE1rmRecord — excluye semanas de deload", () => {
  it("un e1RM más alto logrado en deload no se convierte en récord", () => {
    const logs = logsWith([
      session("w1", 1, "Bench Press", [set(80, 5, "2")]),
      session("w2", 2, "Bench Press", [set(80, 8, "0")]), // deload: más reps/menos RIR, e1RM más alto
    ]);
    const normal = getE1rmRecord(logs, program, "Bench Press");
    expect(normal?.reps).toBe(5);
  });
});

describe("getPersonalRecordInRepRange — excluye semanas de deload", () => {
  it("una serie en rango logueada en deload no cuenta como PR de ese rango", () => {
    const logs = logsWith([session("w2", 2, "Hack Squat", [set(120, 5, "2")])]);
    const pr = getPersonalRecordInRepRange(logs, program, "Hack Squat", "4-6");
    expect(pr).toBeNull();
  });
});

describe("getPersonalRecordEvents — excluye semanas de deload", () => {
  it("no genera evento de PR para una sesión de deload, ni la usa como mejor previo", () => {
    const logs = logsWith([
      session("w1", 1, "Hack Squat", [set(100, 5, "1")]),
      session("w2", 2, "Hack Squat", [set(120, 5, "2")]), // deload: no genera evento
      session("w3", 3, "Hack Squat", [set(110, 5, "1")]), // normal: sigue comparando contra la semana 1 (100), no contra la 2 (120)
    ]);
    const events = getPersonalRecordEvents(logs, program);
    const weightEvents = events.filter((e) => e.kind === "weight");
    expect(weightEvents).toHaveLength(2); // semana 1 (primer registro) y semana 3 (110 > 100)
    expect(weightEvents.map((e) => e.weekNumber)).toEqual([1, 3]);
    expect(weightEvents[1].previousBest).toBe(100);
  });
});
