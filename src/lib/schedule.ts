import type { FlatProgramDay, Program } from "../types/program";
import type { LogsData } from "../types/logs";

/**
 * Convierte el programa (bloques -> semanas -> días) en una secuencia plana de
 * 48 días de entrenamiento, en el orden en que se hacen.
 */
export function flattenProgram(program: Program): FlatProgramDay[] {
  const totalWeeks = program.blocks.reduce((sum, b) => sum + b.weeks.length, 0);
  const flat: FlatProgramDay[] = [];
  let index = 0;

  program.blocks.forEach((block, blockIndex) => {
    block.weeks.forEach((week, weekIndex) => {
      week.days.forEach((day, dayIndex) => {
        flat.push({
          index,
          blockIndex,
          weekIndex,
          dayIndex,
          blockName: block.name,
          weekLabel: week.label,
          weekNumber: week.weekNumber,
          totalWeeks,
          day,
        });
        index += 1;
      });
    });
  });

  return flat;
}

/**
 * El progreso real del programa se basa en cuántas sesiones ya se
 * completaron o saltearon (no en la fecha del calendario ni en sesiones
 * "en curso"). Así, si un día se saltea o se entrena tarde, el "próximo
 * día" nunca se desincroniza: avanza un lugar por cada sesión que el
 * usuario cierra, ni más ni menos.
 */
export function getNextProgramIndex(logs: LogsData): number {
  return logs.sessions.filter((s) => s.status === "completed" || s.status === "skipped").length;
}

export function getCurrentFlatDay(
  flat: FlatProgramDay[],
  logs: LogsData
): FlatProgramDay | null {
  const nextIndex = getNextProgramIndex(logs);
  if (nextIndex >= flat.length) return null;
  return flat[nextIndex];
}

export function isProgramComplete(flat: FlatProgramDay[], logs: LogsData): boolean {
  return getNextProgramIndex(logs) >= flat.length;
}
