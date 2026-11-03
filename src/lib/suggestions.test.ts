import { describe, it, expect } from "vitest";
import { buildWeightSuggestions } from "./suggestions";
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
    // e1RM ref = 62.5*(1+7/30) = 77.08; a 65kg: ((77.08/65)-1)*30 - 1 = 4.58 -> ~4-5
    expect(s1!.mode).toBe("raise");
    expect(s1!.weightKg).toBe(65);
    expect(s1!.estimatedReps).toEqual({ min: 4, max: 5 });
    expect(s2!.mode).toBe("raise");
    expect(s2!.weightKg).toBe(65);
  });
});

describe("buildWeightSuggestions — caso Machine Shoulder Press, 50kg×8 @RIR1, rango 6-8, salto 5kg", () => {
  const literalSets = [{ reps: "6-8", targetRIR: "1" }];
  const references = [set(50, 8, "1")];

  it("llega al tope (8) con buen RIR, pero el peso nuevo (55kg) estimaría reps por debajo del piso (6): mantiene con rango extendido 9-10", () => {
    const [s] = buildWeightSuggestions(literalSets, references, 5);
    // e1RM ref = 50*(1+9/30)=65; a 55kg: ((65/55)-1)*30-1 = 4.45 < piso(6)
    expect(s!.mode).toBe("hold");
    expect(s!.weightKg).toBe(50);
    expect(s!.extendedRange).toEqual({ min: 9, max: 10 });
  });

  it("con el interruptor 'extender rango' apagado: mantiene el peso sin mostrar el rango extendido", () => {
    const [s] = buildWeightSuggestions(literalSets, references, 5, { extendRangeEnabled: false, rangeExtensionReps: 2, progressTolerancePct: 1 });
    expect(s!.mode).toBe("hold");
    expect(s!.weightKg).toBe(50);
    expect(s!.extendedRange).toBeNull();
  });

  it("con un salto más chico (2,5kg) el peso nuevo (52,5kg) sí llega al piso: sugiere subir en vez de mantener", () => {
    const [s] = buildWeightSuggestions(literalSets, references, 2.5);
    // e1RM ref = 65; a 52.5kg: ((65/52.5)-1)*30-1 = 6.14 >= piso(6)
    expect(s!.mode).toBe("raise");
    expect(s!.weightKg).toBe(52.5);
    expect(s!.estimatedReps).toEqual({ min: 6, max: 7 });
  });
});

describe("buildWeightSuggestions — reps por debajo del piso la última vez", () => {
  const literalSets = [{ reps: "6-8", targetRIR: "1" }];

  it("1 rep debajo del piso: repetir el peso", () => {
    const [s] = buildWeightSuggestions(literalSets, [set(50, 5, "1")], 5); // piso=6, hizo 5 (1 debajo)
    expect(s!.mode).toBe("hold");
    expect(s!.weightKg).toBe(50);
  });

  it("2 o más reps debajo del piso: bajar un escalón", () => {
    const [s] = buildWeightSuggestions(literalSets, [set(50, 3, "1")], 5); // piso=6, hizo 3 (3 debajo)
    expect(s!.mode).toBe("step-down");
    expect(s!.weightKg).toBe(45);
  });
});

describe("buildWeightSuggestions — un backoff set liviano (ej. 20 reps tras 4-6 pesadas) no bloquea subir en el resto del grupo", () => {
  it("Machine Chest Press real: dos series '4-6' a 62.5kg y una '20' de backoff a 40kg — las '4-6' pueden subir, el backoff se evalúa aparte", () => {
    const literalSets = [
      { reps: "4-6", targetRIR: "1" },
      { reps: "4-6", targetRIR: "2" },
      { reps: "20", targetRIR: "1" },
    ];
    // El peso "bajó" de 62.5 a 40 al pasar al backoff, pero es OTRO grupo de prescripción: no debe contar como "bajaste el peso entre series".
    const references = [set(62.5, 6, "1"), set(62.5, 6, "2"), set(40, 20, "1")];
    const [s1, s2, s3] = buildWeightSuggestions(literalSets, references, 2.5);
    // e1RM ref = 62.5*(1+7/30)=77.08; a 65kg: ((77.08/65)-1)*30-1=4.58 -> sube.
    expect(s1!.mode).toBe("raise");
    expect(s1!.weightKg).toBe(65);
    expect(s2!.mode).toBe("raise");
    expect(s2!.weightKg).toBe(65);
    // El backoff set nunca debe quedar en "hold" por culpa de las series pesadas (ese motivo no debe aparecer).
    expect(s3!.reason).not.toContain("bajaste el peso entre series");
    // Su propio cálculo (rango fijo "20", sin margen): a 42.5kg la estimación (17) queda debajo del piso (20) -> mantiene con rango extendido, por su propia cuenta.
    expect(s3!.mode).toBe("hold");
    expect(s3!.extendedRange).toEqual({ min: 21, max: 22 });
  });

  it("si el peso SÍ bajó entre dos series del MISMO grupo (ambas '4-6'), ese grupo no sube", () => {
    const literalSets = [
      { reps: "4-6", targetRIR: "1" },
      { reps: "4-6", targetRIR: "1" },
    ];
    const references = [set(65, 6, "1"), set(60, 6, "1")]; // bajó de 65 a 60 dentro del mismo grupo "4-6"
    const [s1, s2] = buildWeightSuggestions(literalSets, references, 2.5);
    expect(s1!.mode).toBe("hold");
    expect(s2!.mode).toBe("hold");
    expect(s1!.reason).toContain("bajaste el peso entre series de este mismo rango");
  });
});

describe("buildWeightSuggestions — no sube si bajó el peso entre series o las reps quedaron lejos del tope", () => {
  it("bajó el peso entre series: mantiene (no sube) aunque la primera serie haya llegado al tope", () => {
    const literalSets = [
      { reps: "4-6", targetRIR: "1" },
      { reps: "4-6", targetRIR: "1" },
    ];
    const references = [set(62.5, 6, "1"), set(60, 6, "1")]; // bajó de 62.5 a 60 entre series
    const [s1, s2] = buildWeightSuggestions(literalSets, references, 2.5);
    expect(s1!.mode).toBe("hold");
    expect(s2!.mode).toBe("hold");
  });

  it("las reps quedaron lejos del tope: mantiene, y el motivo dice que ESTA serie no llegó al tope", () => {
    const literalSets = [{ reps: "4-6", targetRIR: "1" }];
    const [s] = buildWeightSuggestions(literalSets, [set(60, 5, "1")], 2.5); // 5 reps, dentro del rango pero no en el tope (6)
    expect(s!.mode).toBe("hold");
    expect(s!.weightKg).toBe(60);
    expect(s!.reason).toContain("te quedaste en 5 reps (tope 6)");
  });
});

describe("buildWeightSuggestions — bug real encontrado en auditoría: el motivo debe corresponder a la regla que decidió, no un texto genérico", () => {
  it("caso del usuario: 8 reps logradas en un rango objetivo 6-8, RIR cumplido, sin bajar peso -> sube (nunca 'mantener')", () => {
    const literalSets = [{ reps: "6-8", targetRIR: "1" }];
    const [s] = buildWeightSuggestions(literalSets, [set(50, 8, "1")], 2.5);
    expect(s!.mode).toBe("raise");
  });

  it("todas las series del grupo llegan al tope y cumplen RIR, pero UNA de ellas bajó el peso: hold, motivo correcto (no el genérico de 'reps lejos')", () => {
    const literalSets = [
      { reps: "4-6", targetRIR: "0" },
      { reps: "4-6", targetRIR: "0" },
    ];
    // Ambas llegan a 6 reps (tope) con RIR 0 (cumple), pero el peso bajó de 65 a 60 entre series: no debe sugerir subir.
    const [s1, s2] = buildWeightSuggestions(literalSets, [set(65, 6, "0"), set(60, 6, "0")], 2.5);
    expect(s1!.mode).toBe("hold");
    expect(s2!.mode).toBe("hold");
    expect(s1!.reason).toContain("bajaste el peso entre series");
  });

  it("caso real Hack Squat: ambas series llegan a 6 reps (tope), pero una de ellas no cumple SU PROPIO RIR objetivo (fue a RIR 0 cuando pedía RIR 2) — no sube, y el motivo no dice 'reps lejos del tope' porque las reps sí llegaron", () => {
    const literalSets = [
      { reps: "4-6", targetRIR: "0" },
      { reps: "4-6", targetRIR: "2" },
    ];
    const references = [set(65, 6, "1"), set(65, 6, "0")]; // set2: RIR logrado 0 < RIR objetivo 2 -> no cumple
    const [s1, s2] = buildWeightSuggestions(literalSets, references, 2.5);
    expect(s1!.mode).toBe("hold");
    expect(s2!.mode).toBe("hold");
    // La serie 1 (propia) está perfecta: el motivo debe señalar que el bloqueo es de la OTRA serie del grupo, no un genérico de "reps lejos".
    expect(s1!.reason).not.toContain("reps quedaron lejos del tope");
    expect(s1!.reason).toContain("serie 2");
    // La serie 2 es la que falla, por su propio RIR (no por reps, que sí llegaron a 6).
    expect(s2!.reason).toContain("RIR 0");
    expect(s2!.reason).toContain("pedía RIR 2");
  });

  it("esta serie no llegó a su propio tope (reps por debajo), aunque el RIR haya sido perfecto: el motivo debe hablar de reps, no de RIR", () => {
    const literalSets = [{ reps: "6-8", targetRIR: "0" }];
    const [s] = buildWeightSuggestions(literalSets, [set(50, 7, "0")], 2.5); // 7 reps < tope 8, RIR 0 cumplido
    expect(s!.mode).toBe("hold");
    expect(s!.reason).toContain("te quedaste en 7 reps (tope 8)");
  });

  it("esta serie llegó al tope pero con menos RIR del pedido (le sobró margen de más, no a propósito): el motivo debe hablar de RIR, no de reps", () => {
    const literalSets = [{ reps: "6-8", targetRIR: "2" }];
    const [s] = buildWeightSuggestions(literalSets, [set(50, 8, "0")], 2.5); // 8 reps = tope, pero RIR 0 < objetivo 2
    expect(s!.mode).toBe("hold");
    expect(s!.reason).toContain("RIR 0");
    expect(s!.reason).toContain("pedía RIR 2");
    expect(s!.reason).toContain("más cerca del fallo de lo pedido");
    expect(s!.reason).not.toContain("te sobró margen");
    expect(s!.reason).not.toContain("tope de esta serie");
  });
});
