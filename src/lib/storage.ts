import { EMPTY_LOGS, type LogsData } from "../types/logs";
import { migrateLegacySessionNotes } from "./exerciseNotes";
import { idbDelete, idbGet, idbSet } from "./db";
import { DEFAULT_LOGS_PATH } from "./github";

export type ThemeMode = "light" | "dark";

export interface AppSettings {
  /** Si la sincronización con GitHub está activa. Apagada por defecto: la app funciona completa solo con el dispositivo. */
  syncEnabled: boolean;
  githubToken: string;
  githubOwner: string;
  githubRepo: string;
  githubBranch: string;
  /** Ruta del archivo de datos dentro del repo. */
  githubPath: string;
  startDate: string; // YYYY-MM-DD
  theme: ThemeMode;
  /** Incremento de peso (kg) sugerido por ejercicio; si no está, se infiere por nombre. */
  exerciseIncrements: Record<string, number>;
  /** Se incrementa al "reiniciar el programa" desde Ajustes; las sesiones nuevas quedan marcadas con este número. */
  programCycle: number;
  /**
   * Variante elegida como predeterminada para cada ejercicio prescripto por
   * el programa. Clave: nombre del ejercicio original/prescripto. Valor:
   * nombre de la variante elegida (puede ser una sustitución o el original
   * mismo). Se usa en todos lados donde aparezca ese ejercicio — vista
   * previa, sesión activa, semanas siguientes, sugerencias, historial, PRs —
   * hasta que se vuelva a cambiar. No afecta las sesiones ya guardadas, que
   * conservan el ejercicio que realmente se hizo en su momento.
   */
  exerciseVariantDefaults: Record<string, string>;
  /** Si ya se vio (o saltó) la introducción. No bloquea volver a verla desde Ajustes. */
  onboardingSeen: boolean;
  /** Meta diaria de pasos, editable desde Lifestyle. */
  dailyStepsTarget: number;
  /** Meta diaria de agua en litros, editable desde Lifestyle. */
  dailyWaterTargetLiters: number;
  /** Última vez que se exportó un respaldo manual (ISO), para el aviso de "hace mucho que no exportás". */
  lastExportedAt: string | null;
}

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
}

export const DEFAULT_SETTINGS: AppSettings = {
  syncEnabled: false,
  githubToken: "",
  githubOwner: "",
  githubRepo: "",
  githubBranch: "main",
  githubPath: DEFAULT_LOGS_PATH,
  startDate: new Date().toISOString().slice(0, 10),
  theme: systemPrefersDark() ? "dark" : "light",
  exerciseIncrements: {},
  programCycle: 0,
  exerciseVariantDefaults: {},
  onboardingSeen: false,
  dailyStepsTarget: 8000,
  dailyWaterTargetLiters: 2.5,
  lastExportedAt: null,
};

// Claves dentro del object store de IndexedDB.
const SETTINGS_KEY = "settings";
const LOGS_KEY = "logs";
const LOGS_SHA_KEY = "remoteSha";
const LOGS_DIRTY_KEY = "dirtyFlag";
const MIGRATION_FLAG_KEY = "migratedFromLocalStorageV1";

// Claves viejas de localStorage (versión previa a IndexedDB). Se leen una
// sola vez para migrar y después se dejan intactas como copia de seguridad
// (nunca se borran), hasta que se confirme que la migración a IndexedDB
// funciona bien en la práctica.
const LEGACY_SETTINGS_KEY = "minmax.settings.v1";
const LEGACY_LOGS_KEY = "minmax.logs.v1";
const LEGACY_SHA_KEY = "minmax.logs.sha.v1";
const LEGACY_DIRTY_KEY = "minmax.logs.dirty.v1";

let migrationDone: Promise<void> | null = null;

/** Copia lo que haya en localStorage (versión vieja) a IndexedDB, una sola vez. Nunca borra el localStorage original. */
function migrateFromLocalStorageIfNeeded(): Promise<void> {
  if (!migrationDone) {
    migrationDone = (async () => {
      try {
        const already = await idbGet<boolean>(MIGRATION_FLAG_KEY);
        if (already) return;

        const rawSettings = localStorage.getItem(LEGACY_SETTINGS_KEY);
        if (rawSettings) await idbSet(SETTINGS_KEY, JSON.parse(rawSettings));

        const rawLogs = localStorage.getItem(LEGACY_LOGS_KEY);
        if (rawLogs) await idbSet(LOGS_KEY, JSON.parse(rawLogs));

        const rawSha = localStorage.getItem(LEGACY_SHA_KEY);
        if (rawSha) await idbSet(LOGS_SHA_KEY, rawSha);

        const rawDirty = localStorage.getItem(LEGACY_DIRTY_KEY);
        if (rawDirty) await idbSet(LOGS_DIRTY_KEY, rawDirty === "1");

        await idbSet(MIGRATION_FLAG_KEY, true);
      } catch {
        // Si algo falla acá no hay nada que perder: localStorage queda intacto y se puede
        // reintentar la migración en el próximo arranque (no se marca como hecha).
      }
    })();
  }
  return migrationDone;
}

/** Completa colecciones que pueden faltar en datos guardados antes de agregarse (sesiones viejas, sync con GitHub, etc), y migra notas viejas por sesión al historial por ejercicio. */
export function normalizeLogs(parsed: unknown): LogsData | null {
  if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as LogsData).sessions)) return null;
  const p = parsed as Partial<LogsData>;
  const base: LogsData = {
    version: 1,
    sessions: p.sessions ?? [],
    bodyWeightEntries: Array.isArray(p.bodyWeightEntries) ? p.bodyWeightEntries : [],
    sleepEntries: Array.isArray(p.sleepEntries) ? p.sleepEntries : [],
    stepsEntries: Array.isArray(p.stepsEntries) ? p.stepsEntries : [],
    waterEntries: Array.isArray(p.waterEntries) ? p.waterEntries : [],
    exerciseNoteEntries: Array.isArray(p.exerciseNoteEntries) ? p.exerciseNoteEntries : [],
  };
  return migrateLegacySessionNotes(base);
}

export async function loadSettings(): Promise<AppSettings> {
  await migrateFromLocalStorageIfNeeded();
  try {
    const raw = await idbGet<Partial<AppSettings>>(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...raw } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await idbSet(SETTINGS_KEY, settings);
}

export async function loadLogs(): Promise<LogsData> {
  await migrateFromLocalStorageIfNeeded();
  try {
    const raw = await idbGet<unknown>(LOGS_KEY);
    if (!raw) return { ...EMPTY_LOGS };
    return normalizeLogs(raw) ?? { ...EMPTY_LOGS };
  } catch {
    return { ...EMPTY_LOGS };
  }
}

export async function saveLogsLocal(logs: LogsData): Promise<void> {
  await idbSet(LOGS_KEY, logs);
}

/** El SHA del blob de GitHub la última vez que se leyó/escribió con éxito. */
export async function loadRemoteSha(): Promise<string | null> {
  return (await idbGet<string>(LOGS_SHA_KEY)) ?? null;
}

export async function saveRemoteSha(sha: string | null): Promise<void> {
  if (sha) await idbSet(LOGS_SHA_KEY, sha);
  else await idbDelete(LOGS_SHA_KEY);
}

/** Marca si hay cambios locales que todavía no se confirmaron en GitHub. */
export async function loadDirtyFlag(): Promise<boolean> {
  return (await idbGet<boolean>(LOGS_DIRTY_KEY)) ?? false;
}

export async function saveDirtyFlag(dirty: boolean): Promise<void> {
  await idbSet(LOGS_DIRTY_KEY, dirty);
}
