import { describe, it, expect } from "vitest";
import {
  addDays,
  canAutoMark,
  compliancePct,
  computeGlobalStreak,
  computeHabitStreak,
  computeRecovery,
  consistencyScore,
  detectMilestone,
  weeklyProgress,
} from "./habitStreaks";
import type { Habit, HabitEntry } from "../types/habits";

let seq = 0;
function habit(overrides: Partial<Habit> = {}): Habit {
  seq++;
  return {
    id: `h${seq}`,
    name: "Hábito",
    icon: "drop",
    color: "azul",
    type: "yesno",
    unit: null,
    goal: 1,
    aggregation: null,
    quickSteps: [],
    frequency: { kind: "daily" },
    category: "Salud",
    timeOfDay: "Mañana",
    startDate: "2026-01-01",
    why: null,
    archivedAt: null,
    linked: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function entry(habitId: string, date: string, status: "done" | "skip", patch: Partial<HabitEntry> = {}): HabitEntry {
  return { id: `${habitId}-${date}`, habitId, date, status, value: null, source: "manual", updatedAt: `${date}T12:00:00.000Z`, ...patch };
}

/** Construye entradas done/skip/(sin registro) para fechas consecutivas a partir de `start`, según una secuencia de letras: d=hecho, s=salteado, .=sin registro. */
function buildEntries(habitId: string, start: string, pattern: string): HabitEntry[] {
  const out: HabitEntry[] = [];
  let d = start;
  for (const ch of pattern) {
    if (ch === "d") out.push(entry(habitId, d, "done"));
    else if (ch === "s") out.push(entry(habitId, d, "skip"));
    d = addDays(d, 1);
  }
  return out;
}

describe("computeHabitStreak — diario", () => {
  it("caso 1: hecho, hecho, fallo, hecho -> la racha continúa (3 hechos)", () => {
    const h = habit({ frequency: { kind: "daily" } });
    const entries = buildEntries(h.id, "2026-01-01", "dd.d");
    const asOf = "2026-01-04";
    expect(computeHabitStreak(h, entries, asOf)).toEqual({ streak: 3, best: 3 });
  });

  it("caso 2: hecho, fallo, fallo -> racha 0, mejor récord conservado", () => {
    const h = habit({ frequency: { kind: "daily" } });
    const entries = buildEntries(h.id, "2026-01-01", "d..");
    // asOf un día después del patrón: así el día 3 (el 2do fallo) queda "vencido" y no "pendiente de hoy".
    const asOf = "2026-01-04";
    expect(computeHabitStreak(h, entries, asOf)).toEqual({ streak: 0, best: 1 });
  });
});

describe("computeHabitStreak — lunes, miércoles y viernes", () => {
  // 2026-01-05 es lunes.
  function mwfHabit() {
    return habit({ frequency: { kind: "days", days: [0, 2, 4] }, startDate: "2026-01-05" });
  }

  it("caso 3a: hecho lunes, fallo miércoles, hecho viernes -> la racha continúa", () => {
    const h = mwfHabit();
    const entries = [entry(h.id, "2026-01-05", "done"), entry(h.id, "2026-01-09", "done")]; // miércoles 07 sin registro
    const result = computeHabitStreak(h, entries, "2026-01-09");
    expect(result.streak).toBe(2);
  });

  it("caso 3b: fallo miércoles y fallo viernes -> se corta", () => {
    const h = mwfHabit();
    const entries = [entry(h.id, "2026-01-05", "done")]; // miércoles 07 y viernes 09 sin registro
    // asOf un día después del viernes (sábado no es ocurrencia): así el viernes queda vencido, no "hoy pendiente".
    const result = computeHabitStreak(h, entries, "2026-01-10");
    expect(result.streak).toBe(0);
  });

  it("caso 4: fallo viernes y fallo lunes siguiente -> se corta (consecutivas entre semanas)", () => {
    const h = mwfHabit();
    // Lunes 05 y miércoles 07 hechos; viernes 09 y el lunes siguiente (12) sin registro.
    const entries = [entry(h.id, "2026-01-05", "done"), entry(h.id, "2026-01-07", "done")];
    // asOf un día después del lunes siguiente (martes no es ocurrencia): el lunes 12 queda vencido.
    const result = computeHabitStreak(h, entries, "2026-01-13");
    expect(result.streak).toBe(0);
    expect(result.best).toBe(2);
  });
});

describe("computeHabitStreak — salteado interrumpe la secuencia de fallos", () => {
  it("caso 5: fallo, salteado, fallo -> no se corta", () => {
    const h = habit({ frequency: { kind: "daily" } });
    const entries = buildEntries(h.id, "2026-01-01", ".s.");
    const result = computeHabitStreak(h, entries, "2026-01-03");
    expect(result.streak).toBe(0); // nunca hubo un "hecho" antes, pero la secuencia de fallos no dispara un segundo corte
  });

  it("salteado tras una racha evita el corte aunque sigan dos fallos separados por el salteado", () => {
    const h = habit({ frequency: { kind: "daily" } });
    // hecho, fallo, salteado, fallo, hecho
    const entries = [
      entry(h.id, "2026-01-01", "done"),
      entry(h.id, "2026-01-03", "skip"),
      entry(h.id, "2026-01-05", "done"),
    ];
    const result = computeHabitStreak(h, entries, "2026-01-05");
    expect(result.streak).toBe(2);
  });
});

describe("computeHabitStreak — meta semanal (caso 6)", () => {
  // asOf siempre un par de días adentro de la semana SIGUIENTE a la última evaluada, para que
  // esa última semana quede claramente vencida (no "en curso").
  it("una semana por debajo de la meta se tolera", () => {
    const h = habit({ frequency: { kind: "weekly", n: 3 }, startDate: "2026-01-05" }); // lunes
    // Semana 1 (05-11 ene): 3 hechos -> cumple. Semana 2 (12-18): 1 hecho -> no cumple (tolerado).
    // Semana 3 (19-25): 3 hechos -> cumple, la racha sigue.
    const entries = [
      entry(h.id, "2026-01-05", "done"),
      entry(h.id, "2026-01-06", "done"),
      entry(h.id, "2026-01-07", "done"),
      entry(h.id, "2026-01-12", "done"),
      entry(h.id, "2026-01-19", "done"),
      entry(h.id, "2026-01-20", "done"),
      entry(h.id, "2026-01-21", "done"),
    ];
    const result = computeHabitStreak(h, entries, "2026-01-27");
    expect(result.streak).toBe(2); // semana 1 y semana 3 cumplidas; la semana 2 (tolerada) no suma ni resta
    expect(result.best).toBe(2);
  });

  it("dos semanas seguidas por debajo de la meta cortan la racha", () => {
    const h = habit({ frequency: { kind: "weekly", n: 3 }, startDate: "2026-01-05" });
    const entries = [
      entry(h.id, "2026-01-05", "done"),
      entry(h.id, "2026-01-06", "done"),
      entry(h.id, "2026-01-07", "done"), // semana 1: cumple
      entry(h.id, "2026-01-12", "done"), // semana 2: 1 hecho, no cumple (tolerada)
      entry(h.id, "2026-01-19", "done"), // semana 3: 1 hecho, no cumple -> dos seguidas: corta
    ];
    const result = computeHabitStreak(h, entries, "2026-01-27");
    expect(result.streak).toBe(0);
    expect(result.best).toBe(1);
  });
});

describe("computeRecovery (caso 7)", () => {
  it("aparece cuando la última ocurrencia vencida quedó sin registro", () => {
    const h = habit({ frequency: { kind: "daily" } });
    const entries = buildEntries(h.id, "2026-01-01", "ddddddddd."); // ayer (día 10) sin registro, hoy es el día 11
    const result = computeRecovery(h, entries, "2026-01-11");
    expect(result.show).toBe(true);
    expect(result.lastMissedDate).toBe("2026-01-10");
    expect(result.streakIfRecovered).toBe(9);
  });

  it("NO aparece si la última ocurrencia vencida fue salteada", () => {
    const h = habit({ frequency: { kind: "daily" } });
    const entries = buildEntries(h.id, "2026-01-01", "ddddddddds");
    expect(computeRecovery(h, entries, "2026-01-11").show).toBe(false);
  });

  it("NO aparece por la ocurrencia de hoy, aunque todavía no esté registrada", () => {
    const h = habit({ frequency: { kind: "daily" } });
    const entries = buildEntries(h.id, "2026-01-01", "ddddddddd"); // ayer hecho, hoy (día 10) sin registro
    expect(computeRecovery(h, entries, "2026-01-10").show).toBe(false);
  });

  it("NO aparece por una semana en curso incompleta (meta semanal)", () => {
    const h = habit({ frequency: { kind: "weekly", n: 3 }, startDate: "2026-01-05" });
    expect(computeRecovery(h, [], "2026-01-07").show).toBe(false);
  });
});

describe("hábito con fecha de inicio futura (caso 8)", () => {
  it("no genera ocurrencias ni fallos antes del inicio", () => {
    const h = habit({ frequency: { kind: "daily" }, startDate: "2026-06-01" });
    const result = computeHabitStreak(h, [], "2026-01-15");
    expect(result).toEqual({ streak: 0, best: 0 });
    expect(compliancePct(h, [], 30, "2026-01-15")).toBeNull();
    expect(computeRecovery(h, [], "2026-01-15").show).toBe(false);
  });
});

describe("ocurrencia de hoy y semana en curso nunca son un fallo (caso 9)", () => {
  it("la ocurrencia diaria de hoy pendiente no corta la racha ni queda como fallo", () => {
    const h = habit({ frequency: { kind: "daily" } });
    const entries = buildEntries(h.id, "2026-01-01", "ddd"); // hoy (día 4) sin registro todavía
    expect(computeHabitStreak(h, entries, "2026-01-04")).toEqual({ streak: 3, best: 3 });
  });

  it("la semana en curso incompleta no es una semana fallada", () => {
    const h = habit({ frequency: { kind: "weekly", n: 3 }, startDate: "2026-01-05" });
    const entries = [entry(h.id, "2026-01-05", "done")]; // va 1 de 3, semana no terminó
    expect(computeHabitStreak(h, entries, "2026-01-06")).toEqual({ streak: 0, best: 0 });
  });
});

describe("editar o deshacer recalcula todo a partir de las entradas (caso 10)", () => {
  it("editar retroactivamente un día pasado cambia la racha resultante", () => {
    const h = habit({ frequency: { kind: "daily" } });
    const before = buildEntries(h.id, "2026-01-01", "d.d"); // día 2 sin registro -> fallo tolerado, racha sigue en 2
    expect(computeHabitStreak(h, before, "2026-01-03").streak).toBe(2);

    const after = [...before, entry(h.id, "2026-01-02", "done")]; // se completa retroactivamente el día 2
    expect(computeHabitStreak(h, after, "2026-01-03").streak).toBe(3);
  });

  it("deshacer (borrar la entrada) recalcula como si nunca se hubiera marcado", () => {
    const h = habit({ frequency: { kind: "daily" } });
    const withEntry = buildEntries(h.id, "2026-01-01", "dd");
    expect(computeHabitStreak(h, withEntry, "2026-01-02").streak).toBe(2);
    const undone = withEntry.filter((e) => e.date !== "2026-01-02");
    expect(computeHabitStreak(h, undone, "2026-01-02").streak).toBe(1);
  });
});

describe("canAutoMark (caso 11)", () => {
  it("un hábito automático desmarcado a mano no se vuelve a marcar solo", () => {
    const manual = entry("h1", "2026-01-01", "skip", { source: "manual" });
    expect(canAutoMark(manual)).toBe(false);
  });

  it("sin entrada todavía, o con una entrada automática previa, sí puede auto-marcarse", () => {
    expect(canAutoMark(undefined)).toBe(true);
    const auto = entry("h1", "2026-01-01", "done", { source: "auto" });
    expect(canAutoMark(auto)).toBe(true);
  });
});

describe("frecuencia 'cada N días' (caso 12)", () => {
  it("genera ocurrencias cada N días desde el inicio", () => {
    const h = habit({ frequency: { kind: "every", n: 3 }, startDate: "2026-01-01" });
    // Ocurrencias: 01, 04, 07, 10 ene. Todas hechas.
    const entries = [
      entry(h.id, "2026-01-01", "done"),
      entry(h.id, "2026-01-04", "done"),
      entry(h.id, "2026-01-07", "done"),
      entry(h.id, "2026-01-10", "done"),
    ];
    expect(computeHabitStreak(h, entries, "2026-01-10")).toEqual({ streak: 4, best: 4 });
  });

  it("un fallo en una ocurrencia de 'cada N días' se tolera igual que en diario", () => {
    const h = habit({ frequency: { kind: "every", n: 3 }, startDate: "2026-01-01" });
    const entries = [entry(h.id, "2026-01-01", "done"), entry(h.id, "2026-01-07", "done")]; // 04 sin registro
    expect(computeHabitStreak(h, entries, "2026-01-07")).toEqual({ streak: 2, best: 2 });
  });
});

describe("archivar y restaurar conserva el historial (caso 13)", () => {
  it("el cálculo de racha no depende de archivedAt: archivar y restaurar da el mismo resultado", () => {
    const base = habit({ frequency: { kind: "daily" } });
    const entries = buildEntries(base.id, "2026-01-01", "ddd");
    const live = computeHabitStreak(base, entries, "2026-01-03");
    const archived = { ...base, archivedAt: "2026-01-03T00:00:00.000Z" };
    const restored = { ...archived, archivedAt: null };
    expect(computeHabitStreak(archived, entries, "2026-01-03")).toEqual(live);
    expect(computeHabitStreak(restored, entries, "2026-01-03")).toEqual(live);
  });
});

describe("computeGlobalStreak (caso 14)", () => {
  it("se calcula con el porcentaje (60%) de lo programado, no con un número fijo", () => {
    const h1 = habit({ frequency: { kind: "daily" } });
    const h2 = habit({ frequency: { kind: "daily" } });
    const h3 = habit({ frequency: { kind: "daily" } });
    const habits = [h1, h2, h3];
    // Día 1: 2 de 3 hechos (67% >= 60%) -> cuenta. Día 2: 1 de 3 (33% < 60%) -> no cuenta (fallo).
    const entries = [
      entry(h1.id, "2026-01-01", "done"),
      entry(h2.id, "2026-01-01", "done"),
      entry(h1.id, "2026-01-02", "done"),
    ];
    const result = computeGlobalStreak(habits, entries, "2026-01-02");
    // Día 2 con 1/3 (33%) es un fallo aislado: se tolera, la racha del día 1 sigue.
    expect(result.streak).toBe(1);
  });

  it("con menos del mínimo de hábitos programados ese día, el día no se evalúa", () => {
    const h1 = habit({ frequency: { kind: "daily" } });
    const habits = [h1]; // 1 solo hábito programado: por debajo del mínimo de 2
    const result = computeGlobalStreak(habits, [], "2026-01-05");
    expect(result).toEqual({ streak: 0, best: 0 });
  });
});

describe("compliancePct y consistencyScore", () => {
  it("cumplimiento: hechos sobre ocurrencias vencidas, excluyendo salteados", () => {
    const h = habit({ frequency: { kind: "daily" } });
    const entries = buildEntries(h.id, "2026-01-01", "ddsd."); // día 5 es "hoy", sin registro
    // Vencidas: 4 (días 1-4). Salteado el día 3 (se excluye). Quedan 3 vencidas, 3 hechas -> 100%.
    expect(compliancePct(h, entries, 30, "2026-01-05")).toBe(1);
  });

  it("constancia: un hábito siempre cumplido converge a 100", () => {
    const h = habit({ frequency: { kind: "daily" } });
    const entries = buildEntries(h.id, "2026-01-01", "d".repeat(30));
    expect(consistencyScore(h, entries, "2026-01-30")).toBe(100);
  });

  it("constancia: un hábito nunca cumplido converge a 0", () => {
    const h = habit({ frequency: { kind: "daily" } });
    const entries: HabitEntry[] = [];
    // Con 0 entradas, igual hay ocurrencias "miss" vencidas (sin registro, pasadas), salvo la de hoy.
    expect(consistencyScore(h, entries, "2026-01-10")).toBe(0);
  });
});

describe("weeklyProgress", () => {
  it("devuelve el progreso de la semana en curso para un hábito de meta semanal", () => {
    const h = habit({ frequency: { kind: "weekly", n: 3 }, startDate: "2026-01-05" });
    const entries = [entry(h.id, "2026-01-05", "done"), entry(h.id, "2026-01-06", "done")];
    expect(weeklyProgress(h, entries, "2026-01-07")).toEqual({ done: 2, n: 3, weekStart: "2026-01-05" });
  });

  it("null para hábitos que no son de meta semanal", () => {
    const h = habit({ frequency: { kind: "daily" } });
    expect(weeklyProgress(h, [], "2026-01-07")).toBeNull();
  });
});

describe("detectMilestone", () => {
  it("detecta el cruce exacto de 7, 30 o 100 días", () => {
    expect(detectMilestone(6, 7)).toBe(7);
    expect(detectMilestone(29, 30)).toBe(30);
    expect(detectMilestone(99, 100)).toBe(100);
  });

  it("no dispara si no se cruzó ningún hito, o si ya se había cruzado antes", () => {
    expect(detectMilestone(3, 4)).toBeNull();
    expect(detectMilestone(8, 9)).toBeNull();
    expect(detectMilestone(10, 7)).toBeNull(); // una racha no "retrocede" a un hito ya pasado
  });
});
