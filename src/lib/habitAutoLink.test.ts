import { describe, it, expect } from "vitest";
import { autoMarkWorkoutCompletion } from "./habitAutoLink";
import type { Habit, HabitEntry } from "../types/habits";

function habit(patch: Partial<Habit> = {}): Habit {
  return {
    id: "h1",
    name: "Entrenar",
    icon: "dumbbell",
    color: "naranja",
    type: "yesno",
    unit: null,
    goal: 1,
    aggregation: null,
    quickSteps: [],
    frequency: { kind: "weekly", n: 4 },
    category: "Entrenamiento",
    timeOfDay: "Mañana",
    startDate: "2026-01-01",
    why: null,
    archivedAt: null,
    linked: { source: "workout" },
    metricKind: null,
    secondaryField: null,
    createdAt: "x",
    updatedAt: "x",
    ...patch,
  };
}

describe("autoMarkWorkoutCompletion", () => {
  it("marca 'done' un hábito vinculado a entrenar", () => {
    const h = habit();
    const updates = autoMarkWorkoutCompletion([h], [], "2026-01-10");
    expect(updates[0]).toMatchObject({ status: "done", source: "auto" });
  });

  it("no hace nada si ya está 'done' o fue editado a mano", () => {
    const h = habit();
    const doneAlready: HabitEntry[] = [
      { id: "e1", habitId: "h1", date: "2026-01-10", status: "done", value: null, source: "auto", updatedAt: "x" },
    ];
    expect(autoMarkWorkoutCompletion([h], doneAlready, "2026-01-10")).toEqual([]);

    const manual: HabitEntry[] = [
      { id: "e2", habitId: "h1", date: "2026-01-10", status: "skip", value: null, source: "manual", updatedAt: "x" },
    ];
    expect(autoMarkWorkoutCompletion([h], manual, "2026-01-10")).toEqual([]);
  });

  it("ignora hábitos no vinculados a entrenar o archivados", () => {
    expect(autoMarkWorkoutCompletion([habit({ linked: null })], [], "2026-01-10")).toEqual([]);
    expect(autoMarkWorkoutCompletion([habit({ archivedAt: "x" })], [], "2026-01-10")).toEqual([]);
  });
});
