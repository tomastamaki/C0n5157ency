import { describe, it, expect } from "vitest";
import { archiveHabit, completeTimeGoal, restoreHabit, setEntryStatus, skipToday, toggleDone, unskip } from "./habitActions";
import type { Habit, HabitEntry } from "../types/habits";

function habit(patch: Partial<Habit> = {}): Habit {
  return {
    id: "h1",
    name: "Tomar agua",
    icon: "drop",
    color: "azul",
    type: "quantity",
    unit: "ml",
    goal: 2500,
    aggregation: "sum",
    quickSteps: [250, 500],
    frequency: { kind: "daily" },
    category: "Salud",
    timeOfDay: "Todo el día",
    startDate: "2026-01-01",
    why: null,
    archivedAt: null,
    linked: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...patch,
  };
}

describe("toggleDone", () => {
  it("sin entrada: completa", () => {
    const r = toggleDone(habit({ type: "yesno" }), [], "2026-01-10");
    expect(r.next).toMatchObject({ status: "done" });
    expect(r.previous).toBeNull();
  });

  it("ya completada: deshace (vuelve a sin registro)", () => {
    const entries: HabitEntry[] = [
      { id: "e1", habitId: "h1", date: "2026-01-10", status: "done", value: null, source: "manual", updatedAt: "2026-01-10T08:00:00.000Z" },
    ];
    const r = toggleDone(habit({ type: "yesno" }), entries, "2026-01-10");
    expect(r.next).toBeNull();
    expect(r.previous).toMatchObject({ status: "done" });
  });
});

describe("skipToday / unskip", () => {
  it("saltea y deshacer vuelve a pendiente", () => {
    const h = habit({ type: "yesno" });
    const r = skipToday(h, [], "2026-01-10");
    expect(r.next).toMatchObject({ status: "skip" });
    const r2 = unskip(h, [r.next!], "2026-01-10");
    expect(r2.next).toBeNull();
    expect(r2.previous).toMatchObject({ status: "skip" });
  });
});

describe("completeTimeGoal", () => {
  it("marca la sesión de hoy como hecha con el valor de la meta", () => {
    const h = habit({ type: "time", unit: "min", goal: 20 });
    const r = completeTimeGoal(h, [], "2026-01-10");
    expect(r.next).toMatchObject({ status: "done", value: 20 });
  });
});

describe("setEntryStatus", () => {
  it("setea una fecha pasada cualquiera, no solo hoy", () => {
    const h = habit({ type: "yesno" });
    const r = setEntryStatus(h, [], "2026-01-05", "done");
    expect(r.next).toMatchObject({ date: "2026-01-05", status: "done" });
  });

  it("'none' borra la entrada existente", () => {
    const h = habit({ type: "yesno" });
    const entries: HabitEntry[] = [
      { id: "e1", habitId: "h1", date: "2026-01-05", status: "done", value: null, source: "manual", updatedAt: "x" },
    ];
    const r = setEntryStatus(h, entries, "2026-01-05", "none");
    expect(r.next).toBeNull();
    expect(r.previous).toMatchObject({ status: "done" });
  });
});

describe("archiveHabit / restoreHabit", () => {
  it("archivar setea archivedAt; restaurar lo vuelve a null", () => {
    const h = habit();
    const archived = archiveHabit(h);
    expect(archived.archivedAt).not.toBeNull();
    const restored = restoreHabit(archived);
    expect(restored.archivedAt).toBeNull();
  });
});
