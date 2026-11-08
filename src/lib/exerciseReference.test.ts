import { describe, it, expect } from "vitest";
import { flattenProgram } from "./schedule";
import { matchExerciseReferences } from "./exerciseReference";
import { getPersonalRecordInRepRange } from "./records";
import { globalSeq } from "./cycle";
import programJson from "../data/program.json";
import type { Program } from "../types/program";
import type { LogsData, WorkoutSession, LoggedExercise, LoggedSet } from "../types/logs";

const program = programJson as Program;
const flatDays = flattenProgram(program);

function set(setIndex: number, weightKg: number, reps: number, rir: "0" | "1" | "2" | "3+"): LoggedSet {
  return { setIndex, weightKg, reps, rir, confirmed: true };
}
function ex(name: string, sets: LoggedSet[]): LoggedExercise {
  return { exercise: name, originalExercise: null, supersetGroup: null, sets, notes: null, restStartedAt: null };
}
function findProgramIndex(weekNumber: number, dayName: string): number {
  return flatDays.findIndex((d) => d.weekNumber === weekNumber && d.day.name === dayName);
}
function session(id: string, weekNumber: number, dayName: string, exercises: LoggedExercise[]): WorkoutSession {
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
    startedAt: new Date(2026, 0, programIndex + 1).toISOString(),
    completedAt: new Date(2026, 0, programIndex + 1).toISOString(),
    durationSec: 3600,
    runningSince: null,
    pausedElapsedSec: 0,
    updatedAt: new Date().toISOString(),
    exercises,
    feeling: null,
  };
}
function logsWith(sessions: WorkoutSession[]): LogsData {
  return {
    version: 2,
    sessions,
    bodyWeightEntries: [],
    sleepEntries: [],
    stepsEntries: [],
    waterEntries: [],
    exerciseNoteEntries: [],
    habits: [],
    habitEntries: [],
    metrics: [],
  };
}

describe("matchExerciseReferences — Machine Chest Press (4-6, 4-6, 20)", () => {
  // Semana 1: 4-6 @60kgx5, 4-6 @62.5kgx6, 20 @40kgx20
  const logs = logsWith([
    session("w1", 1, "Upper", [ex("Machine Chest Press", [set(0, 60, 5, "1"), set(1, 62.5, 6, "2"), set(2, 40, 20, "1")])]),
  ]);
  const week2Upper = findProgramIndex(2, "Upper");
  const beforeSeq = globalSeq({ programIndex: week2Upper, cycle: 0 });

  it("ninguna serie recibe la referencia de otra: cada '4-6' trae su propio set, no el mismo duplicado", () => {
    const [refs] = matchExerciseReferences(logs, flatDays, program, "Machine Chest Press", "Upper", ["4-6", "4-6", "20"], beforeSeq);
    expect(refs[0].set).toEqual(expect.objectContaining({ weightKg: 60, reps: 5, rir: "1" }));
    expect(refs[1].set).toEqual(expect.objectContaining({ weightKg: 62.5, reps: 6, rir: "2" }));
    expect(refs[2].set).toEqual(expect.objectContaining({ weightKg: 40, reps: 20, rir: "1" }));
    // las dos primeras no deben ser el mismo objeto de set
    expect(refs[0].set).not.toBe(refs[1].set);
    expect(refs.every((r) => r.tier === "same-day")).toBe(true);
  });

  it("si hoy hay más series '4-6' que la semana pasada, las extra reusan la última del grupo", () => {
    const [refs] = matchExerciseReferences(
      logs,
      flatDays,
      program,
      "Machine Chest Press",
      "Upper",
      ["4-6", "4-6", "4-6", "20"],
      beforeSeq
    );
    expect(refs[0].set?.weightKg).toBe(60);
    expect(refs[1].set?.weightKg).toBe(62.5);
    expect(refs[2].set?.weightKg).toBe(62.5); // extra: reusa la última del grupo "4-6"
    expect(refs[3].set?.weightKg).toBe(40);
  });

  it("sin ningún registro histórico, todas las series quedan 'sin datos'", () => {
    const empty = logsWith([]);
    const [refs] = matchExerciseReferences(empty, flatDays, program, "Machine Chest Press", "Upper", ["4-6", "4-6", "20"], beforeSeq);
    expect(refs.every((r) => r.set === null && r.tier === "none")).toBe(true);
  });
});

describe("matchExerciseReferences — fallback a otra rutina y a aproximado", () => {
  it("sin sesión en el mismo día, cae a otra rutina con la misma prescripción exacta (con tier 'other-day')", () => {
    // DB Bench Press sustituto en Upper semana 1 con reps "4-6","4-6","20" (igual a Machine Chest Press)
    const logs = logsWith([
      session("w1", 1, "Upper", [ex("DB Bench Press", [set(0, 50, 5, "1"), set(1, 50, 6, "2"), set(2, 35, 20, "1")])]),
    ]);
    const week1Push = findProgramIndex(1, "Push");
    const beforeSeq = globalSeq({ programIndex: week1Push, cycle: 0 });
    // Push pide DB Bench Press con reps "10","20" — "10" no existe en Upper, "20" sí.
    const [refs] = matchExerciseReferences(logs, flatDays, program, "DB Bench Press", "Push", ["10", "20"], beforeSeq);
    expect(refs[0].tier).toBe("none"); // "10" no matchea con las "4-6" de Upper (fuera de tolerancia)
    expect(refs[1].set?.weightKg).toBe(35); // "20" matchea exacto, de otra rutina
    expect(refs[1].tier).toBe("other-day");
    expect(refs[1].dayName).toBe("Upper");
  });

  it("si el rango actual no está en la sesión de referencia, usa el más cercano disponible (tier 'approx')", () => {
    // Sesión de referencia solo tiene series de "6-8" (ej. prescripción vieja), buscamos "4-6" ahora.
    const logs = logsWith([session("w1", 1, "Lower", [ex("Hack Squat", [set(0, 80, 7, "1")])])]);
    const week2Lower = findProgramIndex(2, "Lower");
    const beforeSeq = globalSeq({ programIndex: week2Lower, cycle: 0 });
    const [refs] = matchExerciseReferences(logs, flatDays, program, "Hack Squat", "Lower", ["4-6"], beforeSeq);
    // 7 reps vs rango 4-6: distancia 1, dentro de la tolerancia default (1) -> aproximado
    expect(refs[0].set?.reps).toBe(7);
    expect(refs[0].tier).toBe("approx");
  });

  it("si el más cercano está fuera de la tolerancia, no inventa un aproximado engañoso: 'sin datos'", () => {
    const logs = logsWith([session("w1", 1, "Lower", [ex("Hack Squat", [set(0, 80, 20, "1")])])]);
    const week2Lower = findProgramIndex(2, "Lower");
    const beforeSeq = globalSeq({ programIndex: week2Lower, cycle: 0 });
    const [refs] = matchExerciseReferences(logs, flatDays, program, "Hack Squat", "Lower", ["4-6"], beforeSeq);
    expect(refs[0].set).toBeNull();
    expect(refs[0].tier).toBe("none");
  });
});

describe("matchExerciseReferences — límite de sesiones (última vs. anterior a la última)", () => {
  it("devuelve la última y la anterior, ambas de sesiones distintas, con el mismo emparejamiento posicional", () => {
    const logs = logsWith([
      session("w1", 1, "Upper", [ex("Machine Chest Press", [set(0, 60, 5, "1"), set(1, 60, 6, "2")])]),
      session("w2", 2, "Upper", [ex("Machine Chest Press", [set(0, 62.5, 5, "1"), set(1, 62.5, 6, "1")])]),
    ]);
    const week3Upper = findProgramIndex(3, "Upper");
    const beforeSeq = globalSeq({ programIndex: week3Upper, cycle: 0 });
    const [last, prior] = matchExerciseReferences(logs, flatDays, program, "Machine Chest Press", "Upper", ["4-6", "4-6"], beforeSeq, 2);
    expect(last[0].set?.weightKg).toBe(62.5);
    expect(prior[0].set?.weightKg).toBe(60);
    expect(last[0].sessionId).not.toBe(prior[0].sessionId);
  });
});

describe("getPersonalRecordInRepRange — PR por rango de reps con desempate por e1RM", () => {
  it("usa el rango literal (sin tolerancia) y desempata por mayor e1RM si el peso es igual", () => {
    const logs = logsWith([
      session("w1", 1, "Upper", [ex("Machine Chest Press", [set(0, 60, 4, "0")])]), // e1rm = 60*(1+4/30)=68
      session("w2", 2, "Upper", [ex("Machine Chest Press", [set(0, 60, 6, "2")])]), // e1rm = 60*(1+8/30)=76 (mejor)
    ]);
    const pr = getPersonalRecordInRepRange(logs, "Machine Chest Press", "4-6");
    expect(pr).not.toBeNull();
    expect(pr!.weightKg).toBe(60);
    expect(pr!.reps).toBe(6);
    expect(Math.round(pr!.e1rm)).toBe(76);
  });

  it("no cruza rangos: una serie de 20 reps no cuenta como PR del rango 4-6", () => {
    const logs = logsWith([session("w1", 1, "Upper", [ex("Machine Chest Press", [set(0, 100, 20, "1")])])]);
    const pr = getPersonalRecordInRepRange(logs, "Machine Chest Press", "4-6");
    expect(pr).toBeNull();
  });
});
