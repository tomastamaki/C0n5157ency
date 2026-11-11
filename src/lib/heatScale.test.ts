import { describe, it, expect } from "vitest";
import { colorForPct } from "./heatScale";

describe("colorForPct", () => {
  it("coincide exacto con los 5 stops de la escala", () => {
    expect(colorForPct(0)).toBe("rgb(229, 83, 75)"); // #e5534b
    expect(colorForPct(25)).toBe("rgb(240, 138, 75)"); // #f08a4b
    expect(colorForPct(50)).toBe("rgb(240, 194, 75)"); // #f0c24b
    expect(colorForPct(75)).toBe("rgb(155, 207, 91)"); // #9bcf5b
    expect(colorForPct(100)).toBe("rgb(34, 197, 134)"); // #22c586
  });

  it("interpola de forma continua entre dos stops (punto medio)", () => {
    // Medio camino entre 0% (229,83,75) y 25% (240,138,75) -> promedio exacto.
    expect(colorForPct(12.5)).toBe("rgb(235, 111, 75)");
  });

  it("clampea fuera de rango", () => {
    expect(colorForPct(-20)).toBe(colorForPct(0));
    expect(colorForPct(150)).toBe(colorForPct(100));
  });
});
