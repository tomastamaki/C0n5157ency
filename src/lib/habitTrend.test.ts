import { describe, it, expect } from "vitest";
import { averageOf, buildHabitTrendSeries, changeVsPreviousWeek, movingAverage7 } from "./habitTrend";
import type { Habit, HabitLog } from "../types/habits";

function habit(patch: Partial<Habit> = {}): Habit {
  return {
    id: "h1",
    name: "Peso",
    icon: "scale",
    color: "azul",
    type: "tracking",
    unit: "kg",
    goal: null,
    aggregation: "last",
    quickSteps: [],
    frequency: { kind: "daily" },
    category: "Salud",
    timeOfDay: "Todo el día",
    startDate: "2026-01-01",
    why: null,
    archivedAt: null,
    linked: null,
    metricKind: null,
    secondaryField: null,
    createdAt: "x",
    updatedAt: "x",
    ...patch,
  };
}

function log(date: string, value: number): HabitLog {
  return {
    id: `l-${date}`,
    habitId: "h1",
    date,
    value,
    secondaryValue: null,
    source: "manual",
    createdAt: `${date}T08:00:00.000Z`,
    updatedAt: `${date}T08:00:00.000Z`,
  };
}

describe("buildHabitTrendSeries", () => {
  it("devuelve un punto por día del rango, con null en los días sin registro", () => {
    const h = habit();
    const logs = [log("2026-02-08", 80), log("2026-02-10", 81)];
    const series = buildHabitTrendSeries(h, logs, "2026-02-10", 7);
    expect(series).toHaveLength(7);
    expect(series[0].date).toBe("2026-02-04");
    expect(series.find((p) => p.date === "2026-02-08")?.value).toBe(80);
    expect(series.find((p) => p.date === "2026-02-09")?.value).toBeNull();
    expect(series.find((p) => p.date === "2026-02-10")?.value).toBe(81);
  });
});

describe("averageOf", () => {
  it("ignora los días null", () => {
    const points = [
      { date: "2026-02-08", value: 80 },
      { date: "2026-02-09", value: null },
      { date: "2026-02-10", value: 82 },
    ];
    expect(averageOf(points)).toBe(81);
  });

  it("null si no hay ningún valor", () => {
    expect(averageOf([{ date: "2026-02-08", value: null }])).toBeNull();
  });
});

describe("movingAverage7", () => {
  it("promedia la ventana de hasta 7 días vigentes en cada punto", () => {
    const points = [
      { date: "2026-02-04", value: 80 },
      { date: "2026-02-05", value: 82 },
    ];
    const ma = movingAverage7(points);
    expect(ma[0]).toBe(80);
    expect(ma[1]).toBe(81);
  });

  it("null si ningún día de la ventana tiene dato", () => {
    const points = [{ date: "2026-02-04", value: null }];
    expect(movingAverage7(points)[0]).toBeNull();
  });
});

describe("changeVsPreviousWeek", () => {
  it("compara el promedio de los últimos 7 días contra los 7 anteriores", () => {
    const h = habit();
    const logs = [
      log("2026-01-29", 80),
      log("2026-01-30", 80),
      log("2026-02-05", 82),
      log("2026-02-06", 82),
    ];
    const change = changeVsPreviousWeek(h, logs, "2026-02-06");
    expect(change?.deltaAbs).toBeCloseTo(2, 5);
    expect(change?.deltaPct).toBeCloseTo(2.5, 1);
  });

  it("null si falta alguna de las dos semanas", () => {
    const h = habit();
    const logs = [log("2026-02-06", 82)];
    expect(changeVsPreviousWeek(h, logs, "2026-02-06")).toBeNull();
  });
});
