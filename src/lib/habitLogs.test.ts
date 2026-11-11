import { describe, it, expect } from "vitest";
import { addLog, aggregateForDate, deriveEntryForDate, editLog, lastLogForDate, logsForDate, removeLog } from "./habitLogs";
import type { Habit, HabitEntry, HabitLog } from "../types/habits";

function habit(patch: Partial<Habit> = {}): Habit {
  return {
    id: "h1",
    name: "Proteína",
    icon: "drop",
    color: "azul",
    type: "quantity",
    unit: "g",
    goal: 150,
    aggregation: "sum",
    quickSteps: [20, 30, 50],
    frequency: { kind: "daily" },
    category: "Salud",
    timeOfDay: "Todo el día",
    startDate: "2026-01-01",
    why: null,
    archivedAt: null,
    linked: null,
    createdAt: "x",
    updatedAt: "x",
    ...patch,
  };
}

describe("addLog / aggregateForDate — agregación 'sum'", () => {
  it("Proteína 150g con +20/+30/+50: tres registros suman 100g y quedan 'partial'", () => {
    const h = habit();
    let logs: HabitLog[] = [];
    let entries: HabitEntry[] = [];

    const r1 = addLog(h, logs, entries, "2026-01-10", 20);
    logs = [...logs, r1.log];
    if (r1.entry) entries = [r1.entry];
    expect(r1.entry).toMatchObject({ status: "partial", value: 20 });

    const r2 = addLog(h, logs, entries, "2026-01-10", 30);
    logs = [...logs, r2.log];
    entries = r2.entry ? [r2.entry] : [];
    expect(r2.entry).toMatchObject({ status: "partial", value: 50 });

    const r3 = addLog(h, logs, entries, "2026-01-10", 50);
    logs = [...logs, r3.log];
    entries = r3.entry ? [r3.entry] : [];
    expect(r3.entry).toMatchObject({ status: "partial", value: 100 });

    expect(logsForDate(h, logs, "2026-01-10")).toHaveLength(3);
  });

  it("superar el objetivo: pasa a 'done' sin techo, con el total real", () => {
    const h = habit();
    const logs: HabitLog[] = [
      { id: "l1", habitId: "h1", date: "2026-01-10", value: 100, source: "manual", createdAt: "a", updatedAt: "a" },
    ];
    const r = addLog(h, logs, [], "2026-01-10", 80); // 180g > 150g
    expect(r.entry).toMatchObject({ status: "done", value: 180 });
  });

  it("agua: 250 + 500 + 250 ml el mismo día suman 1000 ml", () => {
    const h = habit({ name: "Agua", unit: "ml", goal: 2500, aggregation: "sum" });
    let logs: HabitLog[] = [];
    for (const v of [250, 500, 250]) {
      const r = addLog(h, logs, [], "2026-01-10", v);
      logs = [...logs, r.log];
    }
    const agg = aggregateForDate(h, logs, "2026-01-10");
    expect(agg?.value).toBe(1000);
  });
});

describe("aggregation 'last' (peso, sueño, pasos)", () => {
  it("dos cargas el mismo día: vale la última, no la suma", () => {
    const h = habit({ name: "Peso", type: "tracking", unit: "kg", goal: null, aggregation: "last" });
    const logs: HabitLog[] = [
      { id: "l1", habitId: "h1", date: "2026-01-10", value: 82, source: "manual", createdAt: "2026-01-10T08:00:00.000Z", updatedAt: "2026-01-10T08:00:00.000Z" },
    ];
    const r = addLog(h, logs, [], "2026-01-10", 81.5);
    expect(aggregateForDate(h, [...logs, r.log], "2026-01-10")?.value).toBe(81.5);
  });
});

describe("deriveEntryForDate — 'tracking' nunca genera entry", () => {
  it("un hábito de seguimiento (peso) no tiene racha ni cumplimiento: sin entry aunque haya logs", () => {
    const h = habit({ type: "tracking", goal: null, aggregation: "last" });
    const logs: HabitLog[] = [{ id: "l1", habitId: "h1", date: "2026-01-10", value: 82, source: "manual", createdAt: "a", updatedAt: "a" }];
    expect(deriveEntryForDate(h, logs, "2026-01-10", null)).toBeNull();
  });
});

describe("removeLog", () => {
  it("'sum': borrar el último log del día elimina el entry (vuelve a 'sin registro')", () => {
    const h = habit();
    const log: HabitLog = { id: "l1", habitId: "h1", date: "2026-01-10", value: 50, source: "manual", createdAt: "a", updatedAt: "a" };
    const entry: HabitEntry = { id: "e1", habitId: "h1", date: "2026-01-10", status: "partial", value: 50, source: "manual", updatedAt: "a" };
    const r = removeLog(h, [log], [entry], "l1");
    expect(r?.entry).toBeNull();
  });

  it("'last': borrar el más reciente deja vigente el anterior", () => {
    const h = habit({ type: "tracking", goal: null, aggregation: "last" });
    const logs: HabitLog[] = [
      { id: "l1", habitId: "h1", date: "2026-01-10", value: 82, source: "manual", createdAt: "2026-01-10T08:00:00.000Z", updatedAt: "2026-01-10T08:00:00.000Z" },
      { id: "l2", habitId: "h1", date: "2026-01-10", value: 81.5, source: "manual", createdAt: "2026-01-10T20:00:00.000Z", updatedAt: "2026-01-10T20:00:00.000Z" },
    ];
    const r = removeLog(h, logs, [], "l2");
    expect(aggregateForDate(h, logs.filter((l) => l.id !== "l2"), "2026-01-10")?.value).toBe(82);
    expect(r?.entry).toBeNull(); // tracking: nunca hay entry, de todas formas
  });

  it("el gráfico/lista se actualiza: el registro borrado ya no aparece en logsForDate", () => {
    const h = habit();
    const logs: HabitLog[] = [
      { id: "l1", habitId: "h1", date: "2026-01-10", value: 20, source: "manual", createdAt: "a", updatedAt: "a" },
      { id: "l2", habitId: "h1", date: "2026-01-10", value: 30, source: "manual", createdAt: "b", updatedAt: "b" },
    ];
    removeLog(h, logs, [], "l1");
    const remaining = logs.filter((l) => l.id !== "l1");
    expect(logsForDate(h, remaining, "2026-01-10")).toHaveLength(1);
  });
});

describe("editLog", () => {
  it("cambia el valor de un registro puntual y recalcula el agregado del día", () => {
    const h = habit();
    const logs: HabitLog[] = [
      { id: "l1", habitId: "h1", date: "2026-01-10", value: 20, source: "manual", createdAt: "a", updatedAt: "a" },
      { id: "l2", habitId: "h1", date: "2026-01-10", value: 30, source: "manual", createdAt: "b", updatedAt: "b" },
    ];
    const r = editLog(h, logs, [], "l1", 25);
    expect(r?.entry?.value).toBe(55);
  });
});

describe("lastLogForDate — 'deshacer el último registro'", () => {
  it("devuelve el log más nuevo por createdAt", () => {
    const h = habit();
    const logs: HabitLog[] = [
      { id: "l1", habitId: "h1", date: "2026-01-10", value: 20, source: "manual", createdAt: "2026-01-10T08:00:00.000Z", updatedAt: "a" },
      { id: "l2", habitId: "h1", date: "2026-01-10", value: 30, source: "manual", createdAt: "2026-01-10T09:00:00.000Z", updatedAt: "b" },
    ];
    expect(lastLogForDate(h, logs, "2026-01-10")?.id).toBe("l2");
  });

  it("null si no hay registros ese día", () => {
    const h = habit();
    expect(lastLogForDate(h, [], "2026-01-10")).toBeNull();
  });
});
