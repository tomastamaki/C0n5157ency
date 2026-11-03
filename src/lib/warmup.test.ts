import { describe, it, expect } from "vitest";
import { getWarmupSuggestion } from "./warmup";
import type { ExerciseGroup } from "../types/program";

function groupWithWarmup(count: string): ExerciseGroup {
  return {
    exercise: "Machine Chest Press",
    videoUrl: null,
    supersetGroup: null,
    intensityTechnique: null,
    notes: null,
    substitutions: [],
    rest: null,
    sets: [
      { type: "warmup", count },
      { type: "working", reps: "4-6", targetRIR: ["1", "2"] },
    ],
  };
}

describe("getWarmupSuggestion", () => {
  it("'2-3' (techo 3) con referencia 65kg e incremento 2.5: 3 series a 40/60/80%, redondeadas al incremento", () => {
    const s = getWarmupSuggestion(groupWithWarmup("2-3"), 65, 2.5);
    expect(s).not.toBeNull();
    expect(s!.countLabel).toBe("2-3");
    expect(s!.optional).toBe(false);
    expect(s!.sets).toEqual([
      { pct: 0.4, weightKg: 25 }, // 65*0.4=26 -> redondeado a paso 2.5 = 25
      { pct: 0.6, weightKg: 40 }, // 65*0.6=39 -> 40
      { pct: 0.8, weightKg: 52.5 }, // 65*0.8=52 -> 52.5
    ]);
  });

  it("'0-1' (techo 1): 1 sola serie al 60%, marcada como opcional (el rango incluye 0)", () => {
    const s = getWarmupSuggestion(groupWithWarmup("0-1"), 50, 5);
    expect(s!.optional).toBe(true);
    expect(s!.sets).toEqual([{ pct: 0.6, weightKg: 30 }]); // 50*0.6=30, ya es múltiplo de 5
  });

  it("'1-2': 2 series al 50/75%", () => {
    const s = getWarmupSuggestion(groupWithWarmup("1-2"), 50, 5);
    expect(s!.optional).toBe(false);
    expect(s!.sets).toEqual([
      { pct: 0.5, weightKg: 25 },
      { pct: 0.75, weightKg: 40 }, // 50*0.75=37.5 -> redondeado a paso 5 (Math.round redondea .5 hacia arriba) = 40
    ]);
  });

  it("sin entrada de calentamiento en el grupo: null", () => {
    const group = groupWithWarmup("1");
    group.sets = group.sets.filter((s) => s.type !== "warmup");
    expect(getWarmupSuggestion(group, 50, 2.5)).toBeNull();
  });

  it("sin peso de referencia todavía (primera vez): null, no se puede calcular nada", () => {
    expect(getWarmupSuggestion(groupWithWarmup("2-3"), null, 2.5)).toBeNull();
  });
});
