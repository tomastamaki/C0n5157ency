import { describe, it, expect } from "vitest";
import { buildWeightSuggestions } from "./suggestions";
import { DELOAD_MESSAGE } from "./trainingConfig";
import type { LoggedSet } from "../types/logs";

function set(weightKg: number, reps: number, rir: "0" | "1" | "2" | "3+"): LoggedSet {
  return { setIndex: 0, weightKg, reps, rir, confirmed: true };
}

describe("buildWeightSuggestions — caso Machine Chest Press (4-6, 4-6), 62,5kg×6 @RIR1 en ambas series", () => {
  const literalSets = [
    { reps: "4-6", targetRIR: "1" },
    { reps: "4-6", targetRIR: "1" },
  ];
  const references = [set(62.5, 6, "1"), set(62.5, 6, "1")];

  it("con salto de 2,5kg: sube a 65kg con ~4-5 reps estimadas", () => {
    const [s1, s2] = buildWeightSuggestions(literalSets, references, 2.5);
    expect(s1!.mode).toBe("raise");
    expect(s1!.weightKg).toBe(65);
    expect(s1!.estimatedReps).toEqual({ min: 4, max: 5 });
    expect(s1!.warning).toBeNull();
    expect(s2!.mode).toBe("raise");
    expect(s2!.weightKg).toBe(65);
  });
});

describe("buildWeightSuggestions — caso Machine Shoulder Press, 50kg×8 @RIR1, rango 6-8, salto 5kg", () => {
  const literalSets = [{ reps: "6-8", targetRIR: "1" }];
  const references = [set(50, 8, "1")];

  it("llega al tope (8) pero el peso nuevo (55kg) estimaría reps por debajo del piso (6): mantiene con rango extendido 9-10", () => {
    const [s] = buildWeightSuggestions(literalSets, references, 5);
    expect(s!.mode).toBe("hold");
    expect(s!.weightKg).toBe(50);
    expect(s!.extendedRange).toEqual({ min: 9, max: 10 });
  });

  it("con el interruptor 'extender rango' apagado: mantiene el peso sin mostrar el rango extendido", () => {
    const [s] = buildWeightSuggestions(literalSets, references, 5, {
      extendRangeEnabled: false,
      rangeExtensionReps: 2,
      progressTolerancePct: 1,
      ceilingToleranceReps: 1,
      rirWarningGap: 2,
    });
    expect(s!.mode).toBe("hold");
    expect(s!.weightKg).toBe(50);
    expect(s!.extendedRange).toBeNull();
  });

  it("con un salto más chico (2,5kg) el peso nuevo (52,5kg) sí llega al piso: sugiere subir en vez de mantener", () => {
    const [s] = buildWeightSuggestions(literalSets, references, 2.5);
    expect(s!.mode).toBe("raise");
    expect(s!.weightKg).toBe(52.5);
    expect(s!.estimatedReps).toEqual({ min: 6, max: 7 });
  });
});

describe("buildWeightSuggestions — reps por debajo del piso la última vez", () => {
  const literalSets = [{ reps: "6-8", targetRIR: "1" }];

  it("1 rep debajo del piso: repetir el peso", () => {
    const [s] = buildWeightSuggestions(literalSets, [set(50, 5, "1")], 5);
    expect(s!.mode).toBe("hold");
    expect(s!.weightKg).toBe(50);
  });

  it("2 o más reps debajo del piso: bajar un escalón", () => {
    const [s] = buildWeightSuggestions(literalSets, [set(50, 3, "1")], 5);
    expect(s!.mode).toBe("step-down");
    expect(s!.weightKg).toBe(45);
  });
});

describe("buildWeightSuggestions — un backoff set liviano no bloquea subir en el resto del grupo (grupos distintos)", () => {
  it("Machine Chest Press real: dos series '4-6' a 62.5kg y una '20' de backoff a 40kg — las '4-6' suben, el backoff se evalúa aparte", () => {
    const literalSets = [
      { reps: "4-6", targetRIR: "1" },
      { reps: "4-6", targetRIR: "2" },
      { reps: "20", targetRIR: "1" },
    ];
    const references = [set(62.5, 6, "1"), set(62.5, 6, "2"), set(40, 20, "1")];
    const [s1, s2, s3] = buildWeightSuggestions(literalSets, references, 2.5);
    expect(s1!.mode).toBe("raise");
    expect(s1!.weightKg).toBe(65);
    expect(s2!.mode).toBe("raise");
    expect(s2!.weightKg).toBe(65);
    expect(s3!.reason).not.toContain("bajaste el peso entre series");
    expect(s3!.reason).not.toContain("Igualá el peso");
    expect(s3!.mode).toBe("hold");
    expect(s3!.extendedRange).toEqual({ min: 21, max: 22 });
  });
});

describe('buildWeightSuggestions — las reps mandan: tope del rango con tolerancia de 1 en UNA sola serie', () => {
  it("todas las series llegan exacto al tope: sube, sin aviso", () => {
    const literalSets = [
      { reps: "4-6", targetRIR: "1" },
      { reps: "4-6", targetRIR: "1" },
    ];
    const references = [set(65, 6, "1"), set(65, 6, "1")];
    const [s1, s2] = buildWeightSuggestions(literalSets, references, 2.5);
    expect(s1!.mode).toBe("raise");
    expect(s2!.mode).toBe("raise");
    expect(s1!.warning).toBeNull();
  });

  it("una sola serie se queda a 1 rep del tope: sube igual, con aviso ámbar señalando esa serie", () => {
    const literalSets = [
      { reps: "4-6", targetRIR: "1" },
      { reps: "4-6", targetRIR: "1" },
    ];
    const references = [set(65, 6, "1"), set(65, 5, "1")]; // s2: 5 reps, tope 6 (1 de tolerancia)
    const [s1, s2] = buildWeightSuggestions(literalSets, references, 1);
    expect(s1!.mode).toBe("raise");
    expect(s2!.mode).toBe("raise");
    expect(s1!.warning).toContain("serie 2");
    expect(s1!.warning).toContain("5 reps");
    expect(s1!.warning).toContain("tope 6");
    expect(s2!.warning).toBe(s1!.warning);
  });

  it("DOS series se quedan a 1 rep del tope (más de la tolerancia permitida): no sube, motivo señala a ambas series", () => {
    const literalSets = [
      { reps: "4-6", targetRIR: "1" },
      { reps: "4-6", targetRIR: "1" },
    ];
    const references = [set(65, 5, "1"), set(65, 5, "1")];
    const [s1, s2] = buildWeightSuggestions(literalSets, references, 2.5);
    expect(s1!.mode).toBe("hold");
    expect(s2!.mode).toBe("hold");
    expect(s1!.reason).toContain("te quedaste en 5 reps (tope 6)");
  });

  it("una serie se queda 2 o más reps del tope: no sube (fuera de la tolerancia), y el motivo es de esa serie", () => {
    const literalSets = [{ reps: "4-8", targetRIR: "1" }];
    const [s] = buildWeightSuggestions(literalSets, [set(60, 5, "1")], 2.5); // 5 reps, tope 8 (3 de diferencia)
    expect(s!.mode).toBe("hold");
    expect(s!.reason).toContain("te quedaste en 5 reps (tope 8)");
  });

  it("esta serie llegó al tope pero otra del mismo grupo se quedó lejos (2+): hold, motivo señala a la OTRA serie, no a esta", () => {
    const literalSets = [
      { reps: "4-6", targetRIR: "0" },
      { reps: "4-6", targetRIR: "0" },
    ];
    const references = [set(65, 6, "0"), set(65, 4, "0")]; // s2: 4 reps, tope 6 (2 de diferencia, fuera de la tolerancia de 1)
    const [s1, s2] = buildWeightSuggestions(literalSets, references, 2.5);
    expect(s1!.mode).toBe("hold");
    expect(s2!.mode).toBe("hold");
    expect(s1!.reason).toContain("serie 2");
    expect(s1!.reason).not.toContain("tope de esta serie");
    expect(s2!.reason).toContain("te quedaste en 4 reps (tope 6)");
  });
});

describe("buildWeightSuggestions — el RIR ya no bloquea subir, solo avisa cuando queda 2+ por debajo del objetivo", () => {
  it("llegó al tope con RIR muy por debajo del objetivo (2+ de diferencia): sube igual, con aviso ámbar", () => {
    const literalSets = [{ reps: "4-8", targetRIR: "2" }];
    const [s] = buildWeightSuggestions(literalSets, [set(50, 8, "0")], 1); // RIR 0, pedía 2: diferencia 2
    expect(s!.mode).toBe("raise");
    expect(s!.warning).toContain("RIR 0");
    expect(s!.warning).toContain("pedía 2");
  });

  it("llegó al tope con RIR apenas por debajo del objetivo (1 de diferencia): sube, sin aviso", () => {
    const literalSets = [{ reps: "4-8", targetRIR: "1" }];
    const [s] = buildWeightSuggestions(literalSets, [set(50, 8, "0")], 1);
    expect(s!.mode).toBe("raise");
    expect(s!.warning).toBeNull();
  });

  it("caso real Hack Squat: ambas series llegan a 6 reps (tope); una con RIR muy por debajo del objetivo — sube igual, con aviso solo para esa serie", () => {
    const literalSets = [
      { reps: "2-6", targetRIR: "0" },
      { reps: "2-6", targetRIR: "2" },
    ];
    const references = [set(65, 6, "1"), set(65, 6, "0")]; // s2: RIR 0, pedía 2 (diferencia 2)
    const [s1, s2] = buildWeightSuggestions(literalSets, references, 1);
    expect(s1!.mode).toBe("raise");
    expect(s2!.mode).toBe("raise");
    expect(s1!.warning).toContain("serie 2");
    expect(s1!.warning).toContain("RIR 0");
    expect(s1!.warning).toContain("pedía 2");
  });
});

describe("buildWeightSuggestions — pesos distintos entre series: igualar antes de subir", () => {
  it("caso del usuario: rango 6-8, RIR objetivo 0, serie 1 a 80kg×8@1 y serie 2 a 75kg×8@1 — serie 1 se mantiene, serie 2 iguala a 80kg", () => {
    const literalSets = [
      { reps: "6-8", targetRIR: "0" },
      { reps: "6-8", targetRIR: "0" },
    ];
    const references = [set(80, 8, "1"), set(75, 8, "1")];
    const [s1, s2] = buildWeightSuggestions(literalSets, references, 2.5);
    expect(s1!.mode).toBe("hold");
    expect(s1!.weightKg).toBe(80);
    expect(s1!.reason).toContain("serie 2");
    expect(s1!.reason).toContain("80kg");
    expect(s2!.mode).toBe("raise");
    expect(s2!.weightKg).toBe(80);
    expect(s2!.estimatedReps).toEqual({ min: 6, max: 7 });
    expect(s2!.reason).toContain("Igualá el peso");
    expect(s2!.reason).toContain("75kg");
  });

  it("la serie liviana NO llegó al tope: no iguala, se repite el peso de esa serie (regla anterior)", () => {
    const literalSets = [
      { reps: "6-8", targetRIR: "0" },
      { reps: "6-8", targetRIR: "0" },
    ];
    const references = [set(80, 8, "1"), set(75, 6, "1")]; // s2: 6 reps, tope 8 (no llegó)
    const [s1, s2] = buildWeightSuggestions(literalSets, references, 2.5);
    expect(s1!.mode).toBe("hold");
    expect(s1!.weightKg).toBe(80);
    expect(s2!.mode).toBe("hold");
    expect(s2!.weightKg).toBe(75);
    expect(s2!.reason).toContain("bajaste el peso entre series");
  });

  it("la serie liviana llegó al tope pero con el RIR muy lejos del objetivo (2+): no iguala, se repite el peso de esa serie", () => {
    const literalSets = [
      { reps: "6-8", targetRIR: "2" },
      { reps: "6-8", targetRIR: "2" },
    ];
    const references = [set(80, 8, "2"), set(75, 8, "0")]; // s2: RIR 0, pedía 2 (diferencia 2)
    const [s1, s2] = buildWeightSuggestions(literalSets, references, 2.5);
    expect(s1!.mode).toBe("hold");
    expect(s2!.mode).toBe("hold");
    expect(s2!.weightKg).toBe(75);
    expect(s2!.reason).toContain("bajaste el peso entre series");
  });

  it("igualar el peso llevaría las reps estimadas debajo del piso: se repite el peso de la serie liviana", () => {
    const literalSets = [
      { reps: "6-8", targetRIR: "0" },
      { reps: "6-8", targetRIR: "0" },
    ];
    const references = [set(100, 8, "1"), set(70, 8, "1")]; // salto de igualación demasiado grande
    const [, s2] = buildWeightSuggestions(literalSets, references, 2.5);
    expect(s2!.mode).toBe("hold");
    expect(s2!.weightKg).toBe(70);
    expect(s2!.reason).toContain("debajo del piso");
  });

  it("peso bajó pero es OTRO grupo de prescripción (backoff set): no dispara igualación", () => {
    const literalSets = [
      { reps: "4-6", targetRIR: "1" },
      { reps: "20", targetRIR: "1" },
    ];
    const references = [set(62.5, 6, "1"), set(40, 20, "1")];
    const [s1, s2] = buildWeightSuggestions(literalSets, references, 2.5);
    expect(s1!.mode).toBe("raise");
    expect(s2!.reason).not.toContain("Igualá el peso");
    expect(s2!.reason).not.toContain("bajaste el peso entre series");
  });

  it("caso real Pull-Up (Wide Grip) semana 1: mismo peso en las 3 series (80kg×6@2, 80kg×6@0, 80kg×5@0), rango 4-6 — sin caída de peso, se evalúa por reps con tolerancia", () => {
    const literalSets = [
      { reps: "4-6", targetRIR: "0" },
      { reps: "4-6", targetRIR: "1" },
      { reps: "4-6", targetRIR: "1" },
    ];
    const references = [set(80, 6, "2"), set(80, 6, "0"), set(80, 5, "0")]; // s3: 5 reps, tope 6 (tolerancia)
    const [s1, s2, s3] = buildWeightSuggestions(literalSets, references, 2.5);
    // Ninguna serie queda bloqueada por la serie 3 (antes de este cambio, antes la serie 3 sola bloqueaba a todo el grupo): cada una se evalúa por su propio salto.
    expect(s1!.reason).not.toContain("suben juntas o no sube ninguna");
    expect(s2!.reason).not.toContain("suben juntas o no sube ninguna");
    expect(s3!.reason).not.toContain("suben juntas o no sube ninguna");
    expect(s1!.mode).toBe("raise");
    expect(s1!.warning).toContain("serie 3");
    expect(s1!.warning).toContain("5 reps");
    // s2 y s3, con el salto completo de 2.5kg, estiman reps por debajo del piso: mantienen con rango extendido (no por el RIR ni por el tope, sino por el salto de peso).
    expect(s2!.mode).toBe("hold");
    expect(s2!.extendedRange).not.toBeNull();
    expect(s3!.mode).toBe("hold");
    expect(s3!.extendedRange).not.toBeNull();
  });
});

describe("buildWeightSuggestions — semana de deload (isDeload)", () => {
  const literalSets = [
    { reps: "4-6", targetRIR: "1" },
    { reps: "4-6", targetRIR: "2" },
  ];
  // Llegó al tope de reps con buen RIR: en una semana normal esto dispara "raise".
  const references = [set(62.5, 6, "1"), set(62.5, 6, "1")];

  it("nunca ofrece subir, aunque se haya llegado al tope de reps", () => {
    const [s1, s2] = buildWeightSuggestions(literalSets, references, 2.5, undefined, true);
    expect(s1!.mode).toBe("hold");
    expect(s2!.mode).toBe("hold");
  });

  it("mantiene el peso de la referencia (la última semana normal) y muestra el aviso de deload", () => {
    const [s1] = buildWeightSuggestions(literalSets, references, 2.5, undefined, true);
    expect(s1!.weightKg).toBe(62.5);
    expect(s1!.reason).toBe(DELOAD_MESSAGE);
    expect(s1!.warning).toBeNull();
  });

  it("una serie con RIR 1 en deload no genera aviso de 'sobró margen' (sin mode raise, sin warning)", () => {
    const [s1] = buildWeightSuggestions(literalSets, references, 2.5, undefined, true);
    expect(s1!.mode).not.toBe("raise");
    expect(s1!.warning).toBeNull();
  });

  it("sin referencia para una serie, no hay sugerencia (null)", () => {
    const [, s2] = buildWeightSuggestions(literalSets, [null, null], 2.5, undefined, true);
    expect(s2).toBeNull();
  });
});
