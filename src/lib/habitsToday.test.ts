import { describe, it, expect } from "vitest";
import { buildHeroMessage, buildHeroRing, buildTodayItems, buildWeekStrip, heatCellsFor, isRelevantToday } from "./habitsToday";
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
    startDate: "2026-01-01",
    why: null,
    archivedAt: null,
    linked: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...patch,
  };
}

describe("isRelevantToday", () => {
  it("un hábito diario es relevante todos los días desde su inicio", () => {
    expect(isRelevantToday(habit(), "2026-01-15")).toBe(true);
    expect(isRelevantToday(habit(), "2025-12-31")).toBe(false);
  });

  it("un hábito de meta semanal es siempre relevante (se evalúa por semana, no por día)", () => {
    expect(isRelevantToday(habit({ frequency: { kind: "weekly", n: 3 } }), "2026-01-15")).toBe(true);
  });

  it("un hábito archivado nunca es relevante", () => {
    expect(isRelevantToday(habit({ archivedAt: "2026-01-10T00:00:00.000Z" }), "2026-01-15")).toBe(false);
  });

  it("respeta los días específicos de la semana", () => {
    // 2026-01-14 es miércoles (día 2, lunes=0)
    const h = habit({ frequency: { kind: "days", days: [0, 2, 4] } });
    expect(isRelevantToday(h, "2026-01-14")).toBe(true);
    expect(isRelevantToday(h, "2026-01-15")).toBe(false);
  });

  it("un hábito de 'seguimiento' nunca es relevante hoy: sin racha ni cumplimiento", () => {
    const h = habit({ type: "tracking", goal: null, aggregation: "last" });
    expect(isRelevantToday(h, "2026-01-15")).toBe(false);
  });
});

describe("buildTodayItems", () => {
  it("arma un ítem por hábito relevante, con su estado derivado de la entrada de hoy", () => {
    const h1 = habit({ id: "a" });
    const h2 = habit({ id: "b", startDate: "2026-02-01" }); // todavía no empieza
    const entries: HabitEntry[] = [
      { id: "e1", habitId: "a", date: "2026-01-15", status: "done", value: null, source: "manual", updatedAt: "2026-01-15T08:00:00.000Z" },
    ];
    const items = buildTodayItems([h1, h2], entries, "2026-01-15");
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe("done");
  });
});

describe("heatCellsFor", () => {
  it("devuelve 14 celdas calendario, 'pending' para hoy sin registro, 'none' para el resto", () => {
    const h = habit();
    const cells = heatCellsFor(h, [], "2026-01-15");
    expect(cells).toHaveLength(14);
    expect(cells[13]).toBe("pending");
    expect(cells[0]).toBe("none");
  });

  it("marca 'done'/'skip' en las fechas con entrada", () => {
    const h = habit();
    const entries: HabitEntry[] = [
      { id: "e1", habitId: "h1", date: "2026-01-14", status: "done", value: null, source: "manual", updatedAt: "x" },
      { id: "e2", habitId: "h1", date: "2026-01-13", status: "skip", value: null, source: "manual", updatedAt: "x" },
    ];
    const cells = heatCellsFor(h, entries, "2026-01-15");
    expect(cells[12]).toBe("done");
    expect(cells[11]).toBe("skip");
  });
});

describe("buildHeroRing", () => {
  it("cuenta hechos sobre el total, excluyendo salteados del denominador", () => {
    const items = buildTodayItems(
      [habit({ id: "a" }), habit({ id: "b" }), habit({ id: "c" })],
      [
        { id: "e1", habitId: "a", date: "2026-01-15", status: "done", value: null, source: "manual", updatedAt: "x" },
        { id: "e2", habitId: "b", date: "2026-01-15", status: "skip", value: null, source: "manual", updatedAt: "x" },
      ],
      "2026-01-15"
    );
    const ring = buildHeroRing(items);
    expect(ring).toEqual({ done: 1, total: 2 });
  });

  it("Fase 4: un hábito de meta semanal sin hacer hoy no entra al denominador (no tiene día asignado, no penaliza)", () => {
    const items = buildTodayItems(
      [habit({ id: "a" }), habit({ id: "w", frequency: { kind: "weekly", n: 3 } })],
      [{ id: "e1", habitId: "a", date: "2026-01-15", status: "done", value: null, source: "manual", updatedAt: "x" }],
      "2026-01-15"
    );
    // El diario "a" cuenta 1/1; el semanal "w" (sin hacer hoy) no suma ni resta.
    expect(buildHeroRing(items)).toEqual({ done: 1, total: 1 });
  });

  it("Fase 4: un hábito de meta semanal SÍ hecho hoy suma al anillo del día", () => {
    const items = buildTodayItems(
      [habit({ id: "w", frequency: { kind: "weekly", n: 3 } })],
      [{ id: "e1", habitId: "w", date: "2026-01-15", status: "done", value: null, source: "manual", updatedAt: "x" }],
      "2026-01-15"
    );
    expect(buildHeroRing(items)).toEqual({ done: 1, total: 1 });
  });
});

describe("buildWeekStrip", () => {
  it("devuelve 7 días lunes a domingo; los días futuros quedan en 0/0", () => {
    const h = habit();
    // 2026-01-14 es miércoles de esa semana (lunes 2026-01-12)
    const days = buildWeekStrip([h], [], "2026-01-14");
    expect(days).toHaveLength(7);
    expect(days[0].date).toBe("2026-01-12");
    expect(days[2].isToday).toBe(true);
    expect(days[2].total).toBe(1);
    // jueves/viernes/sábado/domingo todavía no pasaron
    expect(days[3]).toMatchObject({ done: 0, total: 0 });
    expect(days[6]).toMatchObject({ done: 0, total: 0 });
  });
});

describe("buildHeroMessage", () => {
  it("sin hábitos todavía", () => {
    expect(buildHeroMessage([], { done: 0, total: 0 })[0]).toBe("Todavía no tenés hábitos");
  });

  it("todo lo de hoy quedó salteado (hay ítems, pero el denominador da 0)", () => {
    const items = buildTodayItems(
      [habit()],
      [{ id: "e1", habitId: "h1", date: "2026-01-15", status: "skip", value: null, source: "manual", updatedAt: "x" }],
      "2026-01-15"
    );
    expect(buildHeroMessage(items, buildHeroRing(items))[0]).toBe("Por hoy, ya está");
  });

  it("día completo", () => {
    const items = buildTodayItems(
      [habit()],
      [{ id: "e1", habitId: "h1", date: "2026-01-15", status: "done", value: null, source: "manual", updatedAt: "x" }],
      "2026-01-15"
    );
    expect(buildHeroMessage(items, buildHeroRing(items))[0]).toBe("¡Día completo!");
  });

  it("todavía nada hecho", () => {
    const items = buildTodayItems([habit()], [], "2026-01-15");
    expect(buildHeroMessage(items, buildHeroRing(items))[0]).toBe("Arrancá con lo fácil");
  });

  it("Fase 4: un hábito de meta semanal sin hacer hoy da anillo 0/0, pero NO es 'quedó salteado' (sigue pendiente)", () => {
    const items = buildTodayItems([habit({ frequency: { kind: "weekly", n: 3 } })], [], "2026-01-15");
    const ring = buildHeroRing(items);
    expect(ring).toEqual({ done: 0, total: 0 });
    expect(buildHeroMessage(items, ring)[0]).toBe("Arrancá con lo fácil");
  });
});
