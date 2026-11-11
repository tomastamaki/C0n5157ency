import { describe, it, expect } from "vitest";
import { habitDayHeat } from "./habitHeat";
import { colorForPct } from "./heatScale";
import type { Habit, HabitEntry } from "../types/habits";

function habit(patch: Partial<Habit> = {}): Habit {
  return {
    id: "h1",
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

function entryMap(entries: HabitEntry[]): Map<string, HabitEntry> {
  return new Map(entries.map((e) => [e.date, e]));
}

function entry(date: string, patch: Partial<HabitEntry> = {}): HabitEntry {
  return { id: `e-${date}`, habitId: "h1", date, status: "done", value: null, source: "manual", updatedAt: "x", ...patch };
}

describe("habitDayHeat — casos pedidos", () => {
  it("un día en 0% es rojo", () => {
    const h = habit(); // sí/no diario
    const r = habitDayHeat(h, entryMap([]), "2026-01-10", "2026-01-15"); // día pasado, sin registro
    expect(r.pct).toBe(0);
    expect(colorForPct(r.pct!)).toBe("rgb(229, 83, 75)");
  });

  it("un día al 50% es amarillo (cantidad a mitad del objetivo)", () => {
    const h = habit({ type: "quantity", unit: "g", goal: 100 });
    const r = habitDayHeat(h, entryMap([entry("2026-01-10", { status: "partial", value: 50 })]), "2026-01-10", "2026-01-15");
    expect(r.pct).toBe(50);
    expect(colorForPct(r.pct!)).toBe("rgb(240, 194, 75)");
  });

  it("un día al 100% es verde", () => {
    const h = habit();
    const r = habitDayHeat(h, entryMap([entry("2026-01-10", { status: "done" })]), "2026-01-10", "2026-01-15");
    expect(r.pct).toBe(100);
    expect(colorForPct(r.pct!)).toBe("rgb(34, 197, 134)");
  });

  it("salteados son grises (no rojo, no verde)", () => {
    const h = habit();
    const r = habitDayHeat(h, entryMap([entry("2026-01-10", { status: "skip" })]), "2026-01-10", "2026-01-15");
    expect(r.pct).toBeNull();
    expect(r.reason).toBe("skip");
  });

  it("días futuros son grises", () => {
    const h = habit();
    const r = habitDayHeat(h, entryMap([]), "2026-01-20", "2026-01-15");
    expect(r.pct).toBeNull();
    expect(r.reason).toBe("future");
  });

  it("un día no hecho de un hábito semanal es gris, nunca rojo", () => {
    const h = habit({ frequency: { kind: "weekly", n: 3 } });
    const r = habitDayHeat(h, entryMap([]), "2026-01-10", "2026-01-15");
    expect(r.pct).toBeNull();
    expect(r.reason).toBe("unscheduled");
  });

  it("un día hecho de un hábito semanal es verde (100%)", () => {
    const h = habit({ frequency: { kind: "weekly", n: 3 } });
    const r = habitDayHeat(h, entryMap([entry("2026-01-10", { status: "done" })]), "2026-01-10", "2026-01-15");
    expect(r.pct).toBe(100);
  });
});

describe("habitDayHeat — otros casos", () => {
  it("por encima del objetivo de cantidad, verde pleno (capado a 100%, no sigue subiendo)", () => {
    const h = habit({ type: "quantity", unit: "ml", goal: 2000 });
    const r = habitDayHeat(h, entryMap([entry("2026-01-10", { status: "done", value: 2800 })]), "2026-01-10", "2026-01-15");
    expect(r.pct).toBe(100);
  });

  it("antes de la fecha de inicio es gris", () => {
    const h = habit({ startDate: "2026-02-01" });
    const r = habitDayHeat(h, entryMap([]), "2026-01-10", "2026-01-15");
    expect(r.pct).toBeNull();
    expect(r.reason).toBe("before-start");
  });

  it("día sin programar (frecuencia de días específicos) es gris, no rojo", () => {
    const h = habit({ frequency: { kind: "days", days: [0, 2, 4] } }); // lun/mié/vie
    // 2026-01-13 es martes: no programado.
    const r = habitDayHeat(h, entryMap([]), "2026-01-13", "2026-01-15");
    expect(r.pct).toBeNull();
    expect(r.reason).toBe("unscheduled");
  });

  it("hoy sin registrar todavía: gris (no es un fallo hasta que termina el día)", () => {
    const h = habit();
    const r = habitDayHeat(h, entryMap([]), "2026-01-15", "2026-01-15");
    expect(r.pct).toBeNull();
    expect(r.reason).toBe("pending-today");
  });
});
