import type { FlatProgramDay, Program } from "../types/program";
import type { LogsData, WorkoutSession } from "../types/logs";

/**
 * Convierte el programa (bloques -> semanas -> días) en una secuencia plana de
 * 48 días de entrenamiento, en el orden en que aparecen en el programa.
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

export interface WeekDayStatus {
  flatDay: FlatProgramDay;
  session: WorkoutSession | null;
}

/**
 * Dentro de una semana, los 4 días (Upper/Lower/Push/Pull) se pueden hacer en
 * cualquier orden: lo único que importa es completarlos todos antes de pasar
 * a la semana siguiente. Devuelve el estado de cada día de la PRIMERA semana
 * que todavía no está completa (lista vacía si el programa terminó).
 *
 * Solo mira sesiones del ciclo actual: si el programa se reinició, las
 * sesiones de ciclos anteriores no cuentan para este cálculo (quedan solo
 * como referencia en el historial).
 */
export function getCurrentWeekDays(flat: FlatProgramDay[], logs: LogsData, cycle: number): WeekDayStatus[] {
  const finishedByIndex = new Map<number, WorkoutSession>();
  for (const s of logs.sessions) {
    if ((s.cycle ?? 0) !== cycle) continue;
    if (s.status === "completed" || s.status === "skipped") finishedByIndex.set(s.programIndex, s);
  }

  const byWeek = new Map<number, FlatProgramDay[]>();
  for (const fd of flat) {
    if (!byWeek.has(fd.weekNumber)) byWeek.set(fd.weekNumber, []);
    byWeek.get(fd.weekNumber)!.push(fd);
  }

  const weekNumbers = [...byWeek.keys()].sort((a, b) => a - b);
  for (const weekNumber of weekNumbers) {
    const statuses = byWeek.get(weekNumber)!.map((flatDay) => ({
      flatDay,
      session: finishedByIndex.get(flatDay.index) ?? null,
    }));
    if (statuses.some((s) => !s.session)) return statuses;
  }
  return [];
}

/** El primer día pendiente de la semana actual (sugerido por defecto), o null si el programa terminó. */
export function getCurrentFlatDay(flat: FlatProgramDay[], logs: LogsData, cycle: number): FlatProgramDay | null {
  const week = getCurrentWeekDays(flat, logs, cycle);
  if (week.length === 0) return null;
  const pending = week.find((s) => !s.session);
  return (pending ?? week[0]).flatDay;
}

/**
 * La sesión en curso del ciclo actual, sin importar a qué día de qué semana
 * corresponda (solo puede haber una a la vez).
 */
export function findActiveDraft(logs: LogsData, cycle: number): WorkoutSession | null {
  return logs.sessions.find((s) => s.status === "in_progress" && (s.cycle ?? 0) === cycle) ?? null;
}
