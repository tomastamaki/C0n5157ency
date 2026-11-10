import { describe, it, expect } from "vitest";
import { getLiteralWorkingSets } from "./program";
import { isDeloadWeek } from "./recommendation";
import programJson from "../data/program.json";
import type { Program } from "../types/program";

const program = programJson as Program;

function groupFor(weekNumber: number, dayName: string, exerciseName: string) {
  const week = program.blocks.flatMap((b) => b.weeks).find((w) => w.weekNumber === weekNumber)!;
  const day = week.days.find((d) => d.name === dayName)!;
  return day.exerciseGroups.find((g) => g.exercise === exerciseName)!;
}

describe("RIR objetivo por semana/ejercicio/serie (columnas N/O/P del Excel)", () => {
  it("la semana 7 (deload) repite el RIR objetivo más alto de la semana 1 (intro)", () => {
    const week1 = getLiteralWorkingSets(groupFor(1, "Upper", "Machine Chest Press")).map((s) => s.targetRIR);
    const week7 = getLiteralWorkingSets(groupFor(7, "Upper", "Machine Chest Press")).map((s) => s.targetRIR);
    expect(week1).toEqual(week7);
  });

  it("Machine Chest Press: semana 7 pide RIR 1 y 2 por serie; semana 8 pide RIR 0 y 0", () => {
    const week7 = getLiteralWorkingSets(groupFor(7, "Upper", "Machine Chest Press"));
    const week8 = getLiteralWorkingSets(groupFor(8, "Upper", "Machine Chest Press"));
    expect(week7[0].targetRIR).toBe("1");
    expect(week7[1].targetRIR).toBe("2");
    expect(week8[0].targetRIR).toBe("0");
    expect(week8[1].targetRIR).toBe("0");
  });

  it("Hack Squat: el objetivo pasa de 1/2 (sem. 4) a 0/2 (sem. 5), y vuelve a 2/3 en la semana 7 (deload)", () => {
    const week4 = getLiteralWorkingSets(groupFor(4, "Lower", "Hack Squat")).map((s) => s.targetRIR);
    const week5 = getLiteralWorkingSets(groupFor(5, "Lower", "Hack Squat")).map((s) => s.targetRIR);
    const week7 = getLiteralWorkingSets(groupFor(7, "Lower", "Hack Squat")).map((s) => s.targetRIR);
    expect(week4).toEqual(["1", "2"]);
    expect(week5).toEqual(["0", "2"]);
    expect(week7).toEqual(["2", "3"]);
  });

  it("solo la semana 7 está marcada como deload en todo el programa", () => {
    const deloadWeeks = program.blocks
      .flatMap((b) => b.weeks)
      .filter((w) => isDeloadWeek(program, w.weekNumber))
      .map((w) => w.weekNumber);
    expect(deloadWeeks).toEqual([7]);
  });
});
