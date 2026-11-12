import { describe, it, expect } from "vitest";
import { normalizeLogs } from "./storage";

/**
 * Simula lo que devuelve `JSON.parse` de un respaldo real pre-Fase-6B:
 * sesiones + las 4 colecciones legacy de Lifestyle (con datos) + `metrics`,
 * todos campos que ya no son parte de `LogsData`. El importador tiene que
 * cargar lo que sigue vigente y descartar el resto sin tirar error.
 */
function legacyBackupJson() {
  return {
    version: 2,
    sessions: [{ id: "s1", cycle: 0, programIndex: 0, exercises: [] }],
    bodyWeightEntries: [{ id: "w1", date: "2026-01-01", weightKg: 80, bodyFatPct: 15, muscleMassKg: 35, createdAt: "x", updatedAt: "x" }],
    sleepEntries: [{ id: "s1", date: "2026-01-01", score: 70, deepSleepMinutes: 90, awakeMinutes: 10, createdAt: "x", updatedAt: "x" }],
    stepsEntries: [{ id: "st1", date: "2026-01-01", steps: 5000, createdAt: "x", updatedAt: "x" }],
    waterEntries: [{ id: "a1", date: "2026-01-01", liters: 1, createdAt: "x", updatedAt: "x" }],
    exerciseNoteEntries: [],
    habits: [],
    habitEntries: [],
    habitLogs: [],
    metrics: [{ id: "2026-01-01", date: "2026-01-01", weightKg: 80 }],
  };
}

describe("normalizeLogs — importador de respaldos (HABI7 v2 Fase 6B)", () => {
  it("un JSON viejo con las 4 colecciones legacy de Lifestyle y metrics no tira error", () => {
    expect(() => normalizeLogs(legacyBackupJson())).not.toThrow();
  });

  it("descarta las colecciones legacy y metrics: no aparecen en el resultado", () => {
    const result = normalizeLogs(legacyBackupJson()) as unknown as Record<string, unknown>;
    expect(result).not.toBeNull();
    expect(result.bodyWeightEntries).toBeUndefined();
    expect(result.sleepEntries).toBeUndefined();
    expect(result.stepsEntries).toBeUndefined();
    expect(result.waterEntries).toBeUndefined();
    expect(result.metrics).toBeUndefined();
  });

  it("el resto de los datos (sesiones, versión, hábitos nativos) se carga bien de todas formas", () => {
    const result = normalizeLogs(legacyBackupJson());
    expect(result).not.toBeNull();
    expect(result!.version).toBe(5);
    expect(result!.sessions).toHaveLength(1);
    expect(result!.sessions[0].id).toBe("s1");
    // Instalación "nueva" para la migración (sin hábitos propios): igual siembra los 4 nativos.
    expect(result!.habits.filter((h) => h.metricKind !== null)).toHaveLength(4);
  });

  it("un JSON sin ninguna colección legacy (ya limpio) también carga bien", () => {
    const { bodyWeightEntries: _a, sleepEntries: _b, stepsEntries: _c, waterEntries: _d, metrics: _e, ...clean } = legacyBackupJson();
    const result = normalizeLogs(clean);
    expect(result).not.toBeNull();
    expect(result!.version).toBe(5);
  });
});
