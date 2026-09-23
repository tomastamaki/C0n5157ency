import { EMPTY_LOGS, type LogsData } from "../types/logs";

export type ThemeMode = "light" | "dark";

export interface AppSettings {
  githubToken: string;
  githubOwner: string;
  githubRepo: string;
  githubBranch: string;
  startDate: string; // YYYY-MM-DD
  theme: ThemeMode;
  /** Incremento de peso (kg) sugerido por ejercicio; si no está, se infiere por nombre. */
  exerciseIncrements: Record<string, number>;
  /** Se incrementa al "reiniciar el programa" desde Ajustes; las sesiones nuevas quedan marcadas con este número. */
  programCycle: number;
  /**
   * Sustituciones elegidas desde la vista previa del entrenamiento, antes de
   * arrancarlo. Clave `${flatDayIndex}-${groupIndexInDay}` -> nombre elegido.
   * Se consumen (y se borran) al tocar "Empezar entrenamiento".
   */
  pendingSubstitutions: Record<string, string>;
  /** Si ya se vio (o saltó) la introducción. No bloquea volver a verla desde Ajustes. */
  onboardingSeen: boolean;
}

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
}

export const DEFAULT_SETTINGS: AppSettings = {
  githubToken: "",
  githubOwner: "",
  githubRepo: "",
  githubBranch: "main",
  startDate: new Date().toISOString().slice(0, 10),
  theme: systemPrefersDark() ? "dark" : "light",
  exerciseIncrements: {},
  programCycle: 0,
  pendingSubstitutions: {},
  onboardingSeen: false,
};

const SETTINGS_KEY = "minmax.settings.v1";
const LOGS_KEY = "minmax.logs.v1";
const LOGS_SHA_KEY = "minmax.logs.sha.v1";
const LOGS_DIRTY_KEY = "minmax.logs.dirty.v1";

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

/** Completa arrays que pueden faltar en datos guardados antes de agregarse (sesiones viejas, sync con GitHub, etc). */
export function normalizeLogs(parsed: unknown): LogsData | null {
  if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as LogsData).sessions)) return null;
  const p = parsed as Partial<LogsData>;
  return {
    version: 1,
    sessions: p.sessions ?? [],
    bodyWeightEntries: Array.isArray(p.bodyWeightEntries) ? p.bodyWeightEntries : [],
    sleepEntries: Array.isArray(p.sleepEntries) ? p.sleepEntries : [],
  };
}

export function loadLogs(): LogsData {
  try {
    const raw = localStorage.getItem(LOGS_KEY);
    if (!raw) return { ...EMPTY_LOGS };
    return normalizeLogs(JSON.parse(raw)) ?? { ...EMPTY_LOGS };
  } catch {
    return { ...EMPTY_LOGS };
  }
}

export function saveLogsLocal(logs: LogsData): void {
  localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
}

/** El SHA del blob de GitHub la última vez que se leyó/escribió con éxito. */
export function loadRemoteSha(): string | null {
  return localStorage.getItem(LOGS_SHA_KEY);
}

export function saveRemoteSha(sha: string | null): void {
  if (sha) localStorage.setItem(LOGS_SHA_KEY, sha);
  else localStorage.removeItem(LOGS_SHA_KEY);
}

/** Marca si hay cambios locales que todavía no se confirmaron en GitHub. */
export function loadDirtyFlag(): boolean {
  return localStorage.getItem(LOGS_DIRTY_KEY) === "1";
}

export function saveDirtyFlag(dirty: boolean): void {
  if (dirty) localStorage.setItem(LOGS_DIRTY_KEY, "1");
  else localStorage.removeItem(LOGS_DIRTY_KEY);
}
