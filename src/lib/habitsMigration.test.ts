import { describe, it, expect } from "vitest";
import {
  backfillLegacyAggregation,
  deriveMetricsFromLegacyLifestyle,
  migrateHabitEntriesToLogs,
  upgradeLogsToV2,
  upgradeLogsToV3,
  verifyHabitLogMigration,
  verifyMigrationCounts,
  type MigratingLogs,
} from "./habitsMigration";
import { EMPTY_LOGS } from "../types/logs";
import type { Habit, HabitEntry } from "../types/habits";

function logsV1(patch: Partial<MigratingLogs>): MigratingLogs {
  const { habitLogs: _unused, ...rest } = EMPTY_LOGS;
  return { ...rest, version: 1, ...patch };
}

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
    createdAt: "x",
    updatedAt: "x",
    ...patch,
  };
}

describe("deriveMetricsFromLegacyLifestyle", () => {
  it("un registro de cada tipo en la misma fecha se junta en un solo Metric", () => {
    const logs = logsV1({
      bodyWeightEntries: [
        { id: "w1", date: "2026-01-01", weightKg: 82, bodyFatPct: 18, muscleMassKg: 40, createdAt: "2026-01-01T08:00:00.000Z", updatedAt: "2026-01-01T08:00:00.000Z" },
      ],
      sleepEntries: [
        { id: "s1", date: "2026-01-01", score: 80, deepSleepMinutes: 90, awakeMinutes: 10, createdAt: "2026-01-01T08:00:00.000Z", updatedAt: "2026-01-01T08:00:00.000Z" },
      ],
      stepsEntries: [{ id: "st1", date: "2026-01-01", steps: 6000, createdAt: "2026-01-01T08:00:00.000Z", updatedAt: "2026-01-01T08:00:00.000Z" }],
      waterEntries: [{ id: "a1", date: "2026-01-01", liters: 1, createdAt: "2026-01-01T08:00:00.000Z", updatedAt: "2026-01-01T08:00:00.000Z" }],
    });
    const metrics = deriveMetricsFromLegacyLifestyle(logs);
    expect(metrics).toHaveLength(1);
    expect(metrics[0]).toMatchObject({ date: "2026-01-01", weightKg: 82, sleepScore: 80, sleepH: null, steps: 6000, waterMl: 1000 });
  });

  it("varios registros de agua el mismo día se suman en waterMl (el total se preserva, no la cantidad de filas)", () => {
    const logs = logsV1({
      waterEntries: [
        { id: "a1", date: "2026-01-01", liters: 0.5, createdAt: "2026-01-01T08:00:00.000Z", updatedAt: "2026-01-01T08:00:00.000Z" },
        { id: "a2", date: "2026-01-01", liters: 0.75, createdAt: "2026-01-01T13:00:00.000Z", updatedAt: "2026-01-01T13:00:00.000Z" },
        { id: "a3", date: "2026-01-01", liters: 0.25, createdAt: "2026-01-01T20:00:00.000Z", updatedAt: "2026-01-01T20:00:00.000Z" },
      ],
    });
    const metrics = deriveMetricsFromLegacyLifestyle(logs);
    expect(metrics).toHaveLength(1);
    expect(metrics[0].waterMl).toBe(1500);
  });

  it("fechas distintas generan registros de Metric distintos", () => {
    const logs = logsV1({
      stepsEntries: [
        { id: "st1", date: "2026-01-01", steps: 5000, createdAt: "x", updatedAt: "2026-01-01T08:00:00.000Z" },
        { id: "st2", date: "2026-01-02", steps: 7000, createdAt: "x", updatedAt: "2026-01-02T08:00:00.000Z" },
      ],
    });
    const metrics = deriveMetricsFromLegacyLifestyle(logs);
    expect(metrics.map((m) => m.date)).toEqual(["2026-01-01", "2026-01-02"]);
  });
});

describe("upgradeLogsToV2", () => {
  it("sube la versión y deriva metrics cuando hay datos viejos de Lifestyle", () => {
    const logs = logsV1({
      bodyWeightEntries: [{ id: "w1", date: "2026-01-01", weightKg: 80, bodyFatPct: null, muscleMassKg: null, createdAt: "x", updatedAt: "x" }],
    });
    const upgraded = upgradeLogsToV2(logs);
    expect(upgraded.version).toBe(2);
    expect(upgraded.metrics).toHaveLength(1);
    expect(upgraded.habits).toEqual([]);
    expect(upgraded.habitEntries).toEqual([]);
    // Nunca borra los arrays viejos.
    expect(upgraded.bodyWeightEntries).toHaveLength(1);
  });

  it("es idempotente: si ya hay metrics, no los recalcula (no pisa ediciones posteriores)", () => {
    const logs = logsV1({
      bodyWeightEntries: [{ id: "w1", date: "2026-01-01", weightKg: 80, bodyFatPct: null, muscleMassKg: null, createdAt: "x", updatedAt: "x" }],
      metrics: [
        {
          id: "2026-01-01",
          date: "2026-01-01",
          weightKg: 99, // valor editado a mano después de migrar, distinto del derivado (80)
          bodyFatPct: null,
          muscleMassKg: null,
          sleepH: null,
          sleepScore: null,
          deepSleepMinutes: null,
          awakeMinutes: null,
          steps: null,
          waterMl: null,
          updatedAt: "x",
        },
      ],
      version: 2,
    });
    const upgraded = upgradeLogsToV2(logs);
    expect(upgraded.metrics[0].weightKg).toBe(99);
  });

  it("sin datos viejos de Lifestyle, no genera metrics de la nada", () => {
    const upgraded = upgradeLogsToV2(logsV1({}));
    expect(upgraded.version).toBe(2);
    expect(upgraded.metrics).toEqual([]);
  });
});

describe("verifyMigrationCounts", () => {
  it("ok=true cuando los conteos de peso/sueño/pasos y los litros totales de agua se preservan", () => {
    const before = logsV1({
      bodyWeightEntries: [{ id: "w1", date: "2026-01-01", weightKg: 80, bodyFatPct: null, muscleMassKg: null, createdAt: "x", updatedAt: "x" }],
      sleepEntries: [{ id: "s1", date: "2026-01-01", score: 70, deepSleepMinutes: null, awakeMinutes: null, createdAt: "x", updatedAt: "x" }],
      stepsEntries: [{ id: "st1", date: "2026-01-01", steps: 5000, createdAt: "x", updatedAt: "x" }],
      waterEntries: [
        { id: "a1", date: "2026-01-01", liters: 0.5, createdAt: "x", updatedAt: "x" },
        { id: "a2", date: "2026-01-01", liters: 0.5, createdAt: "x", updatedAt: "2026-01-01T09:00:00.000Z" },
      ],
    });
    const after = upgradeLogsToV2(before);
    const result = verifyMigrationCounts(before, after);
    expect(result.ok).toBe(true);
    expect(result.waterLitersBefore).toBe(1);
    expect(result.waterLitersAfter).toBe(1);
  });

  it("ok=false si se pierde algún registro de peso/sueño/pasos", () => {
    const before = logsV1({
      bodyWeightEntries: [{ id: "w1", date: "2026-01-01", weightKg: 80, bodyFatPct: null, muscleMassKg: null, createdAt: "x", updatedAt: "x" }],
    });
    const after = { ...upgradeLogsToV2(before), metrics: [] }; // simula una migración que perdió el dato
    const result = verifyMigrationCounts(before, after);
    expect(result.ok).toBe(false);
    expect(result.weightBefore).toBe(1);
    expect(result.weightAfter).toBe(0);
  });
});

describe("migrateHabitEntriesToLogs", () => {
  function entry(patch: Partial<HabitEntry> = {}): HabitEntry {
    return { id: "e1", habitId: "h1", date: "2026-01-01", status: "done", value: null, source: "manual", updatedAt: "2026-01-01T08:00:00.000Z", ...patch };
  }

  it("genera un HabitLog por cada HabitEntry de cantidad con value, mismo día y valor", () => {
    const habits = [habit()];
    const habitEntries = [entry({ value: 750 })];
    const result = migrateHabitEntriesToLogs({ habits, habitEntries });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ habitId: "h1", date: "2026-01-01", value: 750, source: "manual" });
  });

  it("no genera HabitLog para entradas sin value (sí/no, a evitar, o cantidad sin cargar)", () => {
    const habits = [habit()];
    const habitEntries = [entry({ value: null })];
    expect(migrateHabitEntriesToLogs({ habits, habitEntries })).toEqual([]);
  });

  it("no genera HabitLog para hábitos sin aggregation (sí/no, tiempo, a evitar)", () => {
    const habits = [habit({ id: "h2", type: "yesno", aggregation: null })];
    const habitEntries = [entry({ habitId: "h2", value: 5 })];
    expect(migrateHabitEntriesToLogs({ habits, habitEntries })).toEqual([]);
  });
});

describe("backfillLegacyAggregation", () => {
  /** Simula un hábito tal como quedó guardado antes de que existiera `aggregation` (respaldo real pre-Fase-2): el campo directamente no está. */
  function legacyQuantityHabit(patch: Partial<Habit> = {}): Habit {
    const { aggregation: _unused, ...rest } = habit(patch);
    return rest as unknown as Habit;
  }

  it("a un hábito de cantidad sin 'aggregation' le asigna 'sum' (el viejo addQuantity siempre acumulaba)", () => {
    const [h] = backfillLegacyAggregation([legacyQuantityHabit()]);
    expect(h.aggregation).toBe("sum");
  });

  it("no toca un 'aggregation' ya elegido a propósito (ni 'sum' ni 'last')", () => {
    const [h1] = backfillLegacyAggregation([habit({ aggregation: "last" })]);
    expect(h1.aggregation).toBe("last");
    const [h2] = backfillLegacyAggregation([habit({ aggregation: "sum" })]);
    expect(h2.aggregation).toBe("sum");
  });

  it("no le agrega aggregation a hábitos de otro tipo (sí/no, tiempo, a evitar)", () => {
    const h = legacyQuantityHabit({ type: "yesno" });
    const [result] = backfillLegacyAggregation([h]);
    expect(result.aggregation).toBeUndefined();
  });
});

describe("upgradeLogsToV3 con datos reales pre-Fase-2 (hábito de cantidad sin 'aggregation')", () => {
  function legacyQuantityHabit(patch: Partial<Habit> = {}): Habit {
    const { aggregation: _unused, ...rest } = habit(patch);
    return rest as unknown as Habit;
  }

  it("migra el HabitEntry existente a un HabitLog con el mismo valor (antes solo se perdía: 0 logs)", () => {
    const habits = [legacyQuantityHabit()];
    const habitEntries: HabitEntry[] = [{ id: "e1", habitId: "h1", date: "2026-11-11", status: "partial", value: 1250, source: "manual", updatedAt: "x" }];
    const logs = logsV1({ habits, habitEntries, version: 2 });
    const v3 = upgradeLogsToV3(logs);

    expect(v3.habits[0].aggregation).toBe("sum");
    expect(v3.habitLogs).toHaveLength(1);
    expect(v3.habitLogs[0]).toMatchObject({ habitId: "h1", date: "2026-11-11", value: 1250 });
    // El valor diario (HabitEntry) no cambia, solo se agrega el log derivado.
    expect(v3.habitEntries).toEqual(habitEntries);
  });
});

describe("verifyHabitLogMigration / upgradeLogsToV3", () => {
  it("ok=true cuando la cantidad de logs y la suma de valores coincide con las entradas elegibles", () => {
    const habits = [habit()];
    const habitEntries: HabitEntry[] = [
      { id: "e1", habitId: "h1", date: "2026-01-01", status: "done", value: 2500, source: "manual", updatedAt: "x" },
      { id: "e2", habitId: "h1", date: "2026-01-02", status: "partial", value: 1000, source: "manual", updatedAt: "x" },
    ];
    const migrated = migrateHabitEntriesToLogs({ habits, habitEntries });
    const result = verifyHabitLogMigration({ habits, habitEntries }, migrated);
    expect(result.ok).toBe(true);
    expect(result.entriesWithValueBefore).toBe(2);
    expect(result.logsAfter).toBe(2);
    expect(result.valueSumBefore).toBe(3500);
    expect(result.valueSumAfter).toBe(3500);
  });

  it("upgradeLogsToV3 migra una sola vez (idempotente) y nunca borra habitEntries", () => {
    const habits = [habit()];
    const habitEntries: HabitEntry[] = [{ id: "e1", habitId: "h1", date: "2026-01-01", status: "done", value: 2500, source: "manual", updatedAt: "x" }];
    const logs = logsV1({ habits, habitEntries, version: 2 });
    const v3 = upgradeLogsToV3(logs);
    expect(v3.version).toBe(3);
    expect(v3.habitLogs).toHaveLength(1);
    expect(v3.habitEntries).toHaveLength(1); // intacto

    // Si el usuario borra manualmente todos sus HabitLog, no se vuelven a regenerar de la nada en la próxima carga
    // (serían duplicados si además ya cargó nuevos a mano) — pero mientras existan entries migrables y habitLogs
    // esté vacío, sí se re-derivan, mismo espíritu que `metrics`.
    const v3Again = upgradeLogsToV3(v3);
    expect(v3Again.habitLogs).toHaveLength(1);
  });
});
