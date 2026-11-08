import { describe, it, expect } from "vitest";
import { deriveMetricsFromLegacyLifestyle, upgradeLogsToV2, verifyMigrationCounts } from "./habitsMigration";
import { EMPTY_LOGS, type LogsData } from "../types/logs";

function logsV1(patch: Partial<LogsData>): LogsData {
  return { ...EMPTY_LOGS, version: 1 as unknown as 2, ...patch };
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
