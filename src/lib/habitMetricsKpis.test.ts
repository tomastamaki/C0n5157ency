import { describe, it, expect } from "vitest";
import { allDailyValues, formatMetric, getMetricKpis } from "./habitMetricsKpis";
import type { Habit, HabitLog } from "../types/habits";

function habit(patch: Partial<Habit> = {}): Habit {
  return {
    id: "metric-weight",
    name: "Peso",
    icon: "scale",
    color: "pizarra",
    type: "tracking",
    unit: "kg",
    goal: null,
    aggregation: "last",
    quickSteps: [],
    frequency: { kind: "daily" },
    category: "Métricas",
    timeOfDay: "Todo el día",
    startDate: "2026-01-01",
    why: null,
    archivedAt: null,
    linked: null,
    metricKind: "weight",
    secondaryField: null,
    createdAt: "x",
    updatedAt: "x",
    ...patch,
  };
}

function log(date: string, value: number): HabitLog {
  return { id: `l-${date}`, habitId: "metric-weight", date, value, secondaryValue: null, source: "manual", createdAt: `${date}T08:00:00.000Z`, updatedAt: `${date}T08:00:00.000Z` };
}

describe("allDailyValues", () => {
  it("un valor por fecha, leído de los HabitLog del hábito", () => {
    const h = habit();
    const daily = allDailyValues(h, [log("2026-01-01", 80), log("2026-01-02", 80.5)]);
    expect(daily.get("2026-01-01")).toBe(80);
    expect(daily.get("2026-01-02")).toBe(80.5);
  });
});

describe("getMetricKpis", () => {
  it("un KPI por hábito nativo con dato, con el valor de hoy si existe", () => {
    const h = habit();
    const kpis = getMetricKpis([h], [log("2026-01-14", 81), log("2026-01-15", 80.5)], "2026-01-15");
    expect(kpis).toHaveLength(1);
    expect(kpis[0]).toMatchObject({ metricKind: "weight", isToday: true, habitId: "metric-weight" });
  });

  it("no incluye un hábito nativo sin ningún registro todavía", () => {
    expect(getMetricKpis([habit()], [], "2026-01-15")).toEqual([]);
  });

  it("ignora hábitos archivados", () => {
    const h = habit({ archivedAt: "2026-01-10T00:00:00.000Z" });
    expect(getMetricKpis([h], [log("2026-01-15", 80)], "2026-01-15")).toEqual([]);
  });
});

describe("formatMetric", () => {
  it("pasos sin decimales, agua en litros, el resto con su unidad", () => {
    expect(formatMetric("steps", 8234, "pasos")).toBe("8.234");
    expect(formatMetric("water", 1500, "ml")).toBe("1.5L");
    expect(formatMetric("weight", 81.5, "kg")).toBe("81,5kg");
  });
});
