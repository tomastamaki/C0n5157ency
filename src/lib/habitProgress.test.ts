import { describe, it, expect } from "vitest";
import {
  bestWeekdays,
  buildGlobalHeatCells,
  buildHabitHeatCells,
  buildMonthCalendar,
  buildWeekSummary,
  monthLabelsForHeat,
  monthlyCompliancePctSeries,
  overallConsistency,
  rankHabitsByConsistency,
  weeklyDoneSeries,
} from "./habitProgress";
import type { Habit, HabitEntry } from "../types/habits";

function habit(patch: Partial<Habit> = {}): Habit {
  return {
    id: "h1",
    name: "Meditar",
    icon: "wind",
    color: "violeta",
    type: "yesno",
    unit: null,
    goal: 1,
    aggregation: null,
    quickSteps: [],
    frequency: { kind: "daily" },
    category: "Mente",
    timeOfDay: "Mañana",
    startDate: "2025-01-01",
    why: null,
    archivedAt: null,
    linked: null,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...patch,
  };
}

describe("buildHabitHeatCells", () => {
  it("devuelve 16*7 celdas, 100% (verde) donde hay entrada hecha, gris 'skip' donde se salteó", () => {
    const h = habit();
    const entries: HabitEntry[] = [
      { id: "e1", habitId: "h1", date: "2026-01-14", status: "done", value: null, source: "manual", updatedAt: "x" },
      { id: "e2", habitId: "h1", date: "2026-01-13", status: "skip", value: null, source: "manual", updatedAt: "x" },
    ];
    const cells = buildHabitHeatCells(h, entries, "2026-01-15", 16);
    expect(cells).toHaveLength(112);
    expect(cells.filter((c) => c.pct === 100)).toHaveLength(1);
    expect(cells.filter((c) => c.reason === "skip")).toHaveLength(1);
  });

  it("los días futuros a 'asOf' quedan grises, no se inventan; los pasados sin registro son 0% rojo (Fase 5)", () => {
    const h = habit();
    const cells = buildHabitHeatCells(h, [], "2026-01-15", 1);
    // la semana de asOf (lunes 12 a domingo 18): jue-dom (16-18) son futuro -> gris.
    expect(cells.slice(4, 7).every((c) => c.pct === null && c.reason === "future")).toBe(true);
    // lun-mié (12-14) ya pasaron sin registro -> 0% (rojo), no se inventa un gris complaciente.
    expect(cells.slice(0, 3).every((c) => c.pct === 0)).toBe(true);
    // hoy (15, jueves) todavía no termina -> gris, no rojo todavía.
    expect(cells[3]).toMatchObject({ pct: null, reason: "pending-today" });
  });
});

describe("buildGlobalHeatCells", () => {
  it("clasifica por proporción de hechos entre los programados ese día", () => {
    const h1 = habit({ id: "a" });
    const h2 = habit({ id: "b" });
    const entries: HabitEntry[] = [
      { id: "e1", habitId: "a", date: "2026-01-14", status: "done", value: null, source: "manual", updatedAt: "x" },
      { id: "e2", habitId: "b", date: "2026-01-14", status: "done", value: null, source: "manual", updatedAt: "x" },
    ];
    const cells = buildGlobalHeatCells([h1, h2], entries, "2026-01-15", 1);
    // 2026-01-14 es la posición 2 (índice de miércoles = 2) de la semana lunes=0
    expect(cells[2].pct).toBe(100);
  });

  it("un hábito semanal no participa del mapa global (no tiene día programado puntual)", () => {
    const weeklyHabit = habit({ frequency: { kind: "weekly", n: 3 } });
    const cells = buildGlobalHeatCells([weeklyHabit], [], "2026-01-15", 1);
    // Sin hábitos no-semanales programados ese día: gris neutro, no 0% rojo.
    expect(cells.every((c) => c.pct === null)).toBe(true);
  });
});

describe("monthLabelsForHeat", () => {
  it("una etiqueta por columna, solo donde cambia el mes", () => {
    const labels = monthLabelsForHeat("2026-01-15", 16);
    expect(labels).toHaveLength(16);
    expect(labels.filter((l) => l !== "").length).toBeGreaterThan(0);
    expect(labels.filter((l) => l !== "").length).toBeLessThanOrEqual(5);
  });
});

describe("weeklyDoneSeries", () => {
  it("cuenta los 'hecho' de cada semana, la última etiquetada 'Esta'", () => {
    const h = habit();
    const entries: HabitEntry[] = [
      { id: "e1", habitId: "h1", date: "2026-01-12", status: "done", value: null, source: "manual", updatedAt: "x" },
      { id: "e2", habitId: "h1", date: "2026-01-13", status: "done", value: null, source: "manual", updatedAt: "x" },
    ];
    const series = weeklyDoneSeries(h, entries, "2026-01-15", 2);
    expect(series).toHaveLength(2);
    expect(series[1]).toMatchObject({ value: 2, isCurrent: true, label: "Esta" });
  });

  it("no cuenta un 'hecho' cargado antes de que el hábito empezara", () => {
    const h = habit({ startDate: "2026-01-14" });
    const entries: HabitEntry[] = [
      { id: "e1", habitId: "h1", date: "2026-01-12", status: "done", value: null, source: "manual", updatedAt: "x" },
    ];
    const series = weeklyDoneSeries(h, entries, "2026-01-15", 1);
    expect(series[0].value).toBe(0);
  });
});

describe("monthlyCompliancePctSeries", () => {
  it("vacío para hábitos de meta semanal (no tienen ocurrencia diaria)", () => {
    const weeklyHabit = habit({ frequency: { kind: "weekly", n: 3 } });
    expect(monthlyCompliancePctSeries(weeklyHabit, [], "2026-01-15")).toEqual([]);
  });

  it("calcula % de cumplimiento del mes en curso sobre los días ya transcurridos", () => {
    const h = habit({ startDate: "2026-01-01" });
    const entries: HabitEntry[] = [
      { id: "e1", habitId: "h1", date: "2026-01-01", status: "done", value: null, source: "manual", updatedAt: "x" },
      { id: "e2", habitId: "h1", date: "2026-01-02", status: "done", value: null, source: "manual", updatedAt: "x" },
    ];
    const series = monthlyCompliancePctSeries(h, entries, "2026-01-02", 1);
    expect(series).toHaveLength(1);
    expect(series[0]).toMatchObject({ value: 100, isCurrent: true });
  });
});

describe("buildMonthCalendar", () => {
  it("rellena con huecos antes del día 1 según el día de la semana (lunes=0)", () => {
    // 2026-01-01 es jueves -> 3 huecos antes (lun,mar,mie)
    const h = habit({ startDate: "2025-01-01" });
    const cells = buildMonthCalendar(h, [], 2026, 1, "2026-01-15");
    expect(cells[0]).toBeNull();
    expect(cells[1]).toBeNull();
    expect(cells[2]).toBeNull();
    expect(cells[3]).toMatchObject({ day: 1 });
  });

  it("marca 'future' los días posteriores a asOf", () => {
    const h = habit({ startDate: "2025-01-01" });
    const cells = buildMonthCalendar(h, [], 2026, 1, "2026-01-15").filter(Boolean) as { day: number; status: string }[];
    const day20 = cells.find((c) => c.day === 20);
    expect(day20?.status).toBe("future");
  });

  it("también marca 'future' (no editable) los días anteriores al inicio del hábito", () => {
    const h = habit({ startDate: "2026-01-10" });
    const cells = buildMonthCalendar(h, [], 2026, 1, "2026-01-15").filter(Boolean) as { day: number; status: string }[];
    expect(cells.find((c) => c.day === 5)?.status).toBe("future");
    expect(cells.find((c) => c.day === 10)?.status).toBe("none");
  });

  it("Fase 5: cada celda trae su 'heat' (escala roja→verde) consistente con el status", () => {
    const h = habit({ startDate: "2026-01-01" });
    const entries: HabitEntry[] = [{ id: "e1", habitId: "h1", date: "2026-01-05", status: "done", value: null, source: "manual", updatedAt: "x" }];
    const cells = buildMonthCalendar(h, entries, 2026, 1, "2026-01-15").filter(Boolean) as { day: number; heat: { pct: number | null } }[];
    expect(cells.find((c) => c.day === 5)?.heat.pct).toBe(100); // hecho -> verde
    expect(cells.find((c) => c.day === 3)?.heat.pct).toBe(0); // pasado sin registro -> rojo
    expect(cells.find((c) => c.day === 20)?.heat.pct).toBeNull(); // futuro -> gris
  });
});

describe("rankHabitsByConsistency / overallConsistency", () => {
  it("ordena de mayor a menor puntaje y excluye archivados", () => {
    const good = habit({ id: "good", startDate: "2026-01-01" });
    const bad = habit({ id: "bad", startDate: "2026-01-01" });
    const archived = habit({ id: "arch", archivedAt: "2026-01-01T00:00:00.000Z" });
    const entries: HabitEntry[] = [
      { id: "e1", habitId: "good", date: "2026-01-14", status: "done", value: null, source: "manual", updatedAt: "x" },
    ];
    const ranked = rankHabitsByConsistency([good, bad, archived], entries, "2026-01-15");
    expect(ranked.map((r) => r.habit.id)).toEqual(["good", "bad"]);
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it("overallConsistency devuelve null sin hábitos activos", () => {
    expect(overallConsistency([], [], "2026-01-15")).toBeNull();
  });
});

describe("bestWeekdays", () => {
  it("devuelve 7 letras L..D con el % de cumplimiento de cada una", () => {
    const h = habit({ startDate: "2026-01-01" });
    const stats = bestWeekdays([h], [], "2026-01-15");
    expect(stats.map((s) => s.letter)).toEqual(["L", "M", "X", "J", "V", "S", "D"]);
  });
});

describe("buildWeekSummary", () => {
  it("cuenta días completos solo cuando el 100% de lo programado ese día está hecho", () => {
    const h = habit({ startDate: "2026-01-01" });
    const entries: HabitEntry[] = [
      { id: "e1", habitId: "h1", date: "2026-01-12", status: "done", value: null, source: "manual", updatedAt: "x" },
    ];
    const summary = buildWeekSummary([h], entries, "2026-01-13");
    expect(summary.daysComplete).toBe(1);
    expect(summary.habitsDone).toBe(1);
  });
});
