import { describe, it, expect } from "vitest";
import { autoMarkEntriesForMetric, autoMarkWorkoutCompletion } from "./habitAutoLink";
import type { Habit, HabitEntry, Metric } from "../types/habits";

function habit(patch: Partial<Habit> = {}): Habit {
  return {
    id: "h1",
    name: "Pasos",
    icon: "walk",
    color: "verde",
    type: "quantity",
    unit: "pasos",
    goal: 8000,
    aggregation: "last",
    quickSteps: [],
    frequency: { kind: "daily" },
    category: "Salud",
    timeOfDay: "Todo el día",
    startDate: "2026-01-01",
    why: null,
    archivedAt: null,
    linked: { source: "steps" },
    createdAt: "x",
    updatedAt: "x",
    ...patch,
  };
}

function metric(patch: Partial<Metric> = {}): Metric {
  return {
    id: "2026-01-10",
    date: "2026-01-10",
    weightKg: null,
    bodyFatPct: null,
    muscleMassKg: null,
    sleepH: null,
    sleepScore: null,
    deepSleepMinutes: null,
    awakeMinutes: null,
    steps: null,
    waterMl: null,
    updatedAt: "x",
    ...patch,
  };
}

describe("autoMarkEntriesForMetric", () => {
  it("marca 'done' cuando el valor llega a la meta, 'partial' si no llega", () => {
    const below = autoMarkEntriesForMetric([habit()], [], metric({ steps: 5000 }));
    expect(below[0]).toMatchObject({ status: "partial", value: 5000, source: "auto" });

    const above = autoMarkEntriesForMetric([habit()], [], metric({ steps: 9000 }));
    expect(above[0]).toMatchObject({ status: "done", value: 9000, source: "auto" });
  });

  it("no escribe nada si el valor es 0 o la métrica no trae ese campo", () => {
    expect(autoMarkEntriesForMetric([habit()], [], metric({ steps: 0 }))).toEqual([]);
    expect(autoMarkEntriesForMetric([habit()], [], metric({ steps: null }))).toEqual([]);
  });

  it("nunca pisa una entrada manual", () => {
    const entries: HabitEntry[] = [
      { id: "e1", habitId: "h1", date: "2026-01-10", status: "skip", value: null, source: "manual", updatedAt: "x" },
    ];
    const updates = autoMarkEntriesForMetric([habit()], entries, metric({ steps: 9000 }));
    expect(updates).toEqual([]);
  });

  it("sí actualiza una entrada automática previa si el valor cambió", () => {
    const entries: HabitEntry[] = [
      { id: "e1", habitId: "h1", date: "2026-01-10", status: "partial", value: 5000, source: "auto", updatedAt: "x" },
    ];
    const updates = autoMarkEntriesForMetric([habit()], entries, metric({ steps: 9000 }));
    expect(updates[0]).toMatchObject({ id: "e1", status: "done", value: 9000 });
  });

  it("ignora hábitos no vinculados o archivados", () => {
    expect(autoMarkEntriesForMetric([habit({ linked: null })], [], metric({ steps: 9000 }))).toEqual([]);
    expect(autoMarkEntriesForMetric([habit({ archivedAt: "x" })], [], metric({ steps: 9000 }))).toEqual([]);
  });
});

describe("autoMarkWorkoutCompletion", () => {
  it("marca 'done' un hábito vinculado a entrenar", () => {
    const h = habit({ type: "yesno", linked: { source: "workout" }, goal: 1 });
    const updates = autoMarkWorkoutCompletion([h], [], "2026-01-10");
    expect(updates[0]).toMatchObject({ status: "done", source: "auto" });
  });

  it("no hace nada si ya está 'done' o fue editado a mano", () => {
    const h = habit({ type: "yesno", linked: { source: "workout" } });
    const doneAlready: HabitEntry[] = [
      { id: "e1", habitId: "h1", date: "2026-01-10", status: "done", value: null, source: "auto", updatedAt: "x" },
    ];
    expect(autoMarkWorkoutCompletion([h], doneAlready, "2026-01-10")).toEqual([]);

    const manual: HabitEntry[] = [
      { id: "e2", habitId: "h1", date: "2026-01-10", status: "skip", value: null, source: "manual", updatedAt: "x" },
    ];
    expect(autoMarkWorkoutCompletion([h], manual, "2026-01-10")).toEqual([]);
  });
});
