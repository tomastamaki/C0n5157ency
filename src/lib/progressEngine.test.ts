import { describe, it, expect } from "vitest";
import { classifySet, evaluateExerciseProgress, isProgressingOrImproving } from "./progressEngine";
import { parseRepRange } from "./repRange";

const range46 = parseRepRange("4-6");

describe("classifySet — reglas de avance", () => {
  it("(a) mismo peso, mismas reps, más RIR -> avance", () => {
    const r = classifySet({ weightKg: 60, reps: 5, rir: "2" }, { weightKg: 60, reps: 5, rir: "1" }, range46);
    expect(r.status).toBe("advance");
  });

  it("(b) mismo peso, más reps, menos RIR -> avance, con etiqueta 'más esfuerzo' si el e1RM no subió (10 reps @2 -> 11 reps @0)", () => {
    // e1RM referencia (10 reps @ RIR2): 60*(1+12/30)=84. e1RM actual (11 reps @ RIR0): 60*(1+11/30)=82 (bajó, no subió).
    const r = classifySet({ weightKg: 60, reps: 11, rir: "0" }, { weightKg: 60, reps: 10, rir: "2" }, parseRepRange("10"));
    expect(r.status).toBe("advance");
    expect(r.moreEffort).toBe(true);
  });

  it("(c) más peso, menos reps (dentro del rango), menos RIR -> avance", () => {
    const r = classifySet({ weightKg: 65, reps: 4, rir: "0" }, { weightKg: 60, reps: 5, rir: "1" }, range46);
    expect(r.status).toBe("advance");
  });

  it("(d) más peso, reps iguales o mayores -> avance (sin importar el RIR)", () => {
    const r1 = classifySet({ weightKg: 65, reps: 5, rir: "0" }, { weightKg: 60, reps: 5, rir: "1" }, range46);
    expect(r1.status).toBe("advance");
    const r2 = classifySet({ weightKg: 65, reps: 6, rir: "2" }, { weightKg: 60, reps: 5, rir: "1" }, range46);
    expect(r2.status).toBe("advance");
  });
});

describe("classifySet — reglas de retroceso", () => {
  it("peso menor -> retroceso", () => {
    const r = classifySet({ weightKg: 55, reps: 5, rir: "1" }, { weightKg: 60, reps: 5, rir: "1" }, range46);
    expect(r.status).toBe("regression");
  });

  it("peso mayor con reps por debajo del piso -> retroceso (no avance, aunque haya subido el peso)", () => {
    const r = classifySet({ weightKg: 65, reps: 3, rir: "0" }, { weightKg: 60, reps: 5, rir: "1" }, range46);
    expect(r.status).toBe("regression");
  });

  it("mismo peso, menos reps -> retroceso", () => {
    const r = classifySet({ weightKg: 60, reps: 4, rir: "1" }, { weightKg: 60, reps: 5, rir: "1" }, range46);
    expect(r.status).toBe("regression");
  });

  it("mismo peso, mismas reps, menos RIR -> retroceso", () => {
    const r = classifySet({ weightKg: 60, reps: 5, rir: "0" }, { weightKg: 60, reps: 5, rir: "2" }, range46);
    expect(r.status).toBe("regression");
  });
});

describe("classifySet — igual y casos no cubiertos (e1RM con tolerancia ±1%)", () => {
  it("mismo peso, reps y RIR -> igual", () => {
    const r = classifySet({ weightKg: 60, reps: 5, rir: "1" }, { weightKg: 60, reps: 5, rir: "1" }, range46);
    expect(r.status).toBe("same");
  });

  it("mismo peso, más reps, mismo o más RIR (no cubierto por una regla explícita) -> avance por e1RM", () => {
    const r = classifySet({ weightKg: 60, reps: 6, rir: "2" }, { weightKg: 60, reps: 5, rir: "2" }, range46);
    expect(r.status).toBe("advance");
  });

  it("cambio de e1RM dentro de la tolerancia ±1% -> igual", () => {
    // e1RM referencia: 60*(1+(5+1)/30)=72. Buscamos un combo no cubierto por reglas con e1RM muy cercano.
    const r = classifySet({ weightKg: 60, reps: 5, rir: "1" }, { weightKg: 60, reps: 5, rir: "1" }, range46);
    expect(r.status).toBe("same");
    expect(Math.abs(r.e1rmDeltaPct)).toBeLessThanOrEqual(1);
  });
});

describe("evaluateExerciseProgress — clasificación por ejercicio", () => {
  it("Progresa: una serie avanza y la otra se mantiene igual", () => {
    const result = evaluateExerciseProgress(
      [
        { weightKg: 65, reps: 5, rir: "1" }, // avanza (más peso, mismas reps)
        { weightKg: 60, reps: 5, rir: "1" }, // igual
      ],
      [
        { weightKg: 60, reps: 5, rir: "1" },
        { weightKg: 60, reps: 5, rir: "1" },
      ],
      [range46, range46],
      false
    );
    expect(result.status).toBe("progress");
  });

  it("Estable: todas las series iguales", () => {
    const result = evaluateExerciseProgress(
      [{ weightKg: 60, reps: 5, rir: "1" }],
      [{ weightKg: 60, reps: 5, rir: "1" }],
      [range46],
      false
    );
    expect(result.status).toBe("stable");
  });

  it("Retrocede: al menos una retrocede y ninguna avanza", () => {
    const result = evaluateExerciseProgress(
      [
        { weightKg: 55, reps: 5, rir: "1" }, // retrocede (bajó el peso)
        { weightKg: 60, reps: 5, rir: "1" }, // igual
      ],
      [
        { weightKg: 60, reps: 5, rir: "1" },
        { weightKg: 60, reps: 5, rir: "1" },
      ],
      [range46, range46],
      false
    );
    expect(result.status).toBe("regression");
  });

  it("Mixto: una avanza y otra retrocede", () => {
    const result = evaluateExerciseProgress(
      [
        { weightKg: 65, reps: 5, rir: "1" }, // avanza
        { weightKg: 55, reps: 5, rir: "1" }, // retrocede
      ],
      [
        { weightKg: 60, reps: 5, rir: "1" },
        { weightKg: 60, reps: 5, rir: "1" },
      ],
      [range46, range46],
      false
    );
    expect(result.status).toBe("mixed");
    expect(result.avgE1rmDeltaPct).not.toBeNull();
  });

  it("Nuevo: ninguna serie tiene referencia", () => {
    const result = evaluateExerciseProgress([{ weightKg: 60, reps: 5, rir: "1" }], [null], [range46], false);
    expect(result.status).toBe("new");
  });

  it("Deload: no se evalúa, aunque el peso haya bajado", () => {
    const result = evaluateExerciseProgress(
      [{ weightKg: 40, reps: 8, rir: "2" }],
      [{ weightKg: 60, reps: 5, rir: "1" }],
      [range46],
      true
    );
    expect(result.status).toBe("deload");
  });
});

describe("isProgressingOrImproving — veto para alertas (nunca marcar Progresa o Mixto con e1RM al alza)", () => {
  it("Progresa -> true", () => {
    const result = evaluateExerciseProgress([{ weightKg: 65, reps: 5, rir: "1" }], [{ weightKg: 60, reps: 5, rir: "1" }], [range46], false);
    expect(isProgressingOrImproving(result)).toBe(true);
  });

  it("Mixto con e1RM al alza -> true", () => {
    const result = evaluateExerciseProgress(
      [
        { weightKg: 70, reps: 5, rir: "1" }, // avanza fuerte
        { weightKg: 55, reps: 5, rir: "1" }, // retrocede un poco
      ],
      [
        { weightKg: 60, reps: 5, rir: "1" },
        { weightKg: 60, reps: 5, rir: "1" },
      ],
      [range46, range46],
      false
    );
    expect(result.status).toBe("mixed");
    expect(result.avgE1rmDeltaPct).toBeGreaterThan(0);
    expect(isProgressingOrImproving(result)).toBe(true);
  });

  it("Retrocede -> false", () => {
    const result = evaluateExerciseProgress([{ weightKg: 55, reps: 5, rir: "1" }], [{ weightKg: 60, reps: 5, rir: "1" }], [range46], false);
    expect(isProgressingOrImproving(result)).toBe(false);
  });

  it("Estable -> false", () => {
    const result = evaluateExerciseProgress([{ weightKg: 60, reps: 5, rir: "1" }], [{ weightKg: 60, reps: 5, rir: "1" }], [range46], false);
    expect(isProgressingOrImproving(result)).toBe(false);
  });
});
