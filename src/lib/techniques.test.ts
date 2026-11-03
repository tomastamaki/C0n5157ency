import { describe, it, expect } from "vitest";
import { matchTechnique, getDropSetWeightSuggestions, getExtraTonnageKg } from "./techniques";
import type { LoggedSet } from "../types/logs";

function baseSet(patch: Partial<LoggedSet> = {}): LoggedSet {
  return { setIndex: 0, weightKg: 50, reps: 8, rir: "0", confirmed: true, ...patch };
}

describe("matchTechnique", () => {
  it("reconoce las 3 técnicas reales del programa", () => {
    expect(matchTechnique("Two Drop Sets (~25% per)")?.kind).toBe("drop-sets");
    expect(matchTechnique("Myo-reps")?.kind).toBe("myo-reps");
    expect(matchTechnique("Weighted Static Hold (30 sec)")?.kind).toBe("static-hold");
  });

  it("reconoce Lengthened Partials aunque no aparezca todavía en el programa actual", () => {
    expect(matchTechnique("Lengthened Partials")?.kind).toBe("partials");
  });

  it("null si no hay técnica o no matchea ninguna conocida", () => {
    expect(matchTechnique(null)).toBeNull();
    expect(matchTechnique("Tempo 3-1-1")).toBeNull();
  });
});

describe("getDropSetWeightSuggestions", () => {
  it("65kg de serie principal, incremento 2.5: ~75% y ~56%, redondeados al incremento", () => {
    expect(getDropSetWeightSuggestions(65, 2.5)).toEqual([50, 37.5]); // 65*.75=48.75->50, 65*.56=36.4->37.5
  });
});

describe("getExtraTonnageKg", () => {
  it("drop-sets: suma peso×reps de cada bajada con datos", () => {
    const set = baseSet({
      technique: {
        kind: "drop-sets",
        drops: [
          { weightKg: 47.5, reps: 8 },
          { weightKg: 35, reps: 10 },
        ],
      },
    });
    expect(getExtraTonnageKg(set)).toBe(47.5 * 8 + 35 * 10);
  });

  it("drop-sets: una bajada sin datos todavía no suma", () => {
    const set = baseSet({ technique: { kind: "drop-sets", drops: [{ weightKg: 47.5, reps: 8 }, { weightKg: null, reps: null }] } });
    expect(getExtraTonnageKg(set)).toBe(47.5 * 8);
  });

  it("partials: reps parciales al peso de la serie principal", () => {
    const set = baseSet({ weightKg: 50, technique: { kind: "partials", partialReps: 4 } });
    expect(getExtraTonnageKg(set)).toBe(200);
  });

  it("myo-reps: suma reps de cada mini-serie al peso de la serie principal", () => {
    const set = baseSet({
      weightKg: 20,
      technique: { kind: "myo-reps", miniSets: [{ reps: 5 }, { reps: 4 }, { reps: 1 }] },
    });
    expect(getExtraTonnageKg(set)).toBe(20 * (5 + 4 + 1));
  });

  it("static-hold: suma el peso sostenido una sola vez (no tiene reps)", () => {
    const set = baseSet({ technique: { kind: "static-hold", weightKg: 15, seconds: 28 } });
    expect(getExtraTonnageKg(set)).toBe(15);
  });

  it("sin técnica: 0", () => {
    expect(getExtraTonnageKg(baseSet())).toBe(0);
  });
});
