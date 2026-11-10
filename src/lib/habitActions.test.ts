import { describe, it, expect } from "vitest";
import { addQuantity, completeTimeGoal, skipToday, toggleDone, unskip } from "./habitActions";
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

describe("addQuantity", () => {
  it("queda en partial mientras no llega a la meta", () => {
    const h = habit();
    const r1 = addQuantity(h, [], "2026-01-10", 1000);
    expect(r1.next).toMatchObject({ status: "partial", value: 1000 });
    const r2 = addQuantity(h, [r1.next!], "2026-01-10", 500);
    expect(r2.next).toMatchObject({ status: "partial", value: 1500 });
  });

  it("pasa a done al llegar o superar la meta, acumulando sobre lo ya cargado hoy", () => {
    const h = habit({ goal: 2000 });
    const entries: HabitEntry[] = [
      { id: "e1", habitId: "h1", date: "2026-01-10", status: "partial", value: 1500, source: "manual", updatedAt: "2026-01-10T08:00:00.000Z" },
    ];
    const r = addQuantity(h, entries, "2026-01-10", 600);
    expect(r.next).toMatchObject({ status: "done", value: 2100 });
    expect(r.previous).toMatchObject({ value: 1500 });
  });

  it("no acumula sobre una entrada de otro día", () => {
    const h = habit();
    const entries: HabitEntry[] = [
      { id: "e1", habitId: "h1", date: "2026-01-09", status: "done", value: 3000, source: "manual", updatedAt: "2026-01-09T20:00:00.000Z" },
    ];
    const r = addQuantity(h, entries, "2026-01-10", 250);
    expect(r.next).toMatchObject({ date: "2026-01-10", value: 250 });
  });
});

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
