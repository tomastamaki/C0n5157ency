import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import programJson from "../data/program.json";
import type { Program } from "../types/program";
import type {
  BodyWeightEntry,
  ExerciseNoteEntry,
  LogsData,
  SleepEntry,
  StepsEntry,
  WaterEntry,
  WorkoutSession,
} from "../types/logs";
import { EMPTY_LOGS } from "../types/logs";
import {
  type AppSettings,
  DEFAULT_SETTINGS,
  loadDirtyFlag,
  loadLogs,
  loadRemoteSha,
  loadSettings,
  normalizeLogs,
  saveDirtyFlag,
  saveLogsLocal,
  saveRemoteSha,
  saveSettings,
} from "../lib/storage";
import { requestPersistentStorage } from "../lib/db";
import { describeGithubError, fetchLogsFile, GitHubApiError, putLogsFile, type GitHubTarget } from "../lib/github";
import { mergeLogs } from "../lib/sync";
import { flattenProgram } from "../lib/schedule";
import { buildExerciseInfoIndex, type ExerciseInfo } from "../lib/program";

const program = programJson as unknown as Program;
const exerciseInfoIndex = buildExerciseInfoIndex(program);

export type SyncStatus = "off" | "idle" | "pending" | "syncing" | "saved" | "error";

const DEBOUNCE_MS = 2500;
const RETRY_DELAYS_MS = [5000, 15000, 60000];

export interface BackupResult {
  ok: boolean;
  message: string;
}

interface AppContextValue {
  program: Program;
  exerciseInfoIndex: Record<string, ExerciseInfo>;
  flatDays: ReturnType<typeof flattenProgram>;
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
  /** Si la sincronización está activa Y hay token/owner/repo cargados. */
  isGithubConfigured: boolean;
  /** Si navigator.storage.persist() fue concedido (null = todavía no se chequeó). */
  storagePersisted: boolean | null;
  logs: LogsData;
  upsertSession: (session: WorkoutSession) => void;
  removeSession: (id: string) => void;
  upsertBodyWeightEntry: (entry: BodyWeightEntry) => void;
  removeBodyWeightEntry: (id: string) => void;
  upsertSleepEntry: (entry: SleepEntry) => void;
  removeSleepEntry: (id: string) => void;
  upsertStepsEntry: (entry: StepsEntry) => void;
  removeStepsEntry: (id: string) => void;
  upsertWaterEntry: (entry: WaterEntry) => void;
  removeWaterEntry: (id: string) => void;
  upsertExerciseNoteEntry: (entry: ExerciseNoteEntry) => void;
  clearAllLogs: () => void;
  syncStatus: SyncStatus;
  syncError: string | null;
  lastSyncedAt: string | null;
  retrySync: () => void;
  exportBackup: () => void;
  importBackup: (file: File) => Promise<BackupResult>;
}

const AppContext = createContext<AppContextValue | null>(null);

function buildTarget(settings: AppSettings): GitHubTarget | null {
  if (!settings.syncEnabled) return null;
  if (!settings.githubToken || !settings.githubOwner || !settings.githubRepo) return null;
  return {
    token: settings.githubToken,
    owner: settings.githubOwner,
    repo: settings.githubRepo,
    branch: settings.githubBranch || "main",
    path: settings.githubPath || "data/logs.json",
  };
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [booting, setBooting] = useState(true);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [logs, setLogs] = useState<LogsData>(EMPTY_LOGS);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("off");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [storagePersisted, setStoragePersisted] = useState<boolean | null>(null);

  const flatDays = useMemo(() => flattenProgram(program), []);

  const remoteShaRef = useRef<string | null>(null);
  const dirtyRef = useRef<boolean>(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryAttempt = useRef(0);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const logsRef = useRef(logs);
  logsRef.current = logs;

  const isGithubConfigured = buildTarget(settings) !== null;

  const clearTimers = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (retryTimer.current) clearTimeout(retryTimer.current);
  }, []);

  const pushNow = useCallback(async (dataToPush: LogsData) => {
    const target = buildTarget(settingsRef.current);
    if (!target) {
      setSyncStatus("off");
      return;
    }

    setSyncStatus("syncing");
    try {
      const newSha = await putLogsFile(target, dataToPush, remoteShaRef.current);
      remoteShaRef.current = newSha;
      void saveRemoteSha(newSha);
      dirtyRef.current = false;
      void saveDirtyFlag(false);
      retryAttempt.current = 0;
      setSyncStatus("saved");
      setSyncError(null);
      setLastSyncedAt(new Date().toISOString());
    } catch (err) {
      if (err instanceof GitHubApiError && err.status === 409) {
        try {
          const remote = await fetchLogsFile(target);
          const remoteData = remote ? (normalizeLogs(remote.data) ?? remote.data) : null;
          const merged = remoteData ? mergeLogs(dataToPush, remoteData) : dataToPush;
          const newSha = await putLogsFile(target, merged, remote?.sha ?? null);
          remoteShaRef.current = newSha;
          void saveRemoteSha(newSha);
          void saveLogsLocal(merged);
          setLogs(merged);
          dirtyRef.current = false;
          void saveDirtyFlag(false);
          retryAttempt.current = 0;
          setSyncStatus("saved");
          setSyncError(null);
          setLastSyncedAt(new Date().toISOString());
          return;
        } catch (mergeErr) {
          scheduleRetry(dataToPush, mergeErr);
          return;
        }
      }
      scheduleRetry(dataToPush, err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scheduleRetry = useCallback(
    (dataToPush: LogsData, err: unknown) => {
      dirtyRef.current = true;
      void saveDirtyFlag(true);
      setSyncStatus("error");
      setSyncError(describeGithubError(err));

      const delay = RETRY_DELAYS_MS[Math.min(retryAttempt.current, RETRY_DELAYS_MS.length - 1)];
      retryAttempt.current += 1;
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(() => {
        void pushNow(dataToPush);
      }, delay);
    },
    [pushNow]
  );

  const scheduleDebouncedPush = useCallback(
    (dataToPush: LogsData) => {
      if (!buildTarget(settingsRef.current)) {
        setSyncStatus("off");
        return;
      }
      setSyncStatus("pending");
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        void pushNow(dataToPush);
      }, DEBOUNCE_MS);
    },
    [pushNow]
  );

  const mutateLogs = useCallback(
    (updater: (prev: LogsData) => LogsData) => {
      setLogs((prev) => {
        const next = updater(prev);
        void saveLogsLocal(next);
        dirtyRef.current = true;
        void saveDirtyFlag(true);
        scheduleDebouncedPush(next);
        return next;
      });
    },
    [scheduleDebouncedPush]
  );

  const upsertSession = useCallback(
    (session: WorkoutSession) => {
      mutateLogs((prev) => {
        const idx = prev.sessions.findIndex((s) => s.id === session.id);
        const sessions = [...prev.sessions];
        if (idx >= 0) sessions[idx] = session;
        else sessions.push(session);
        sessions.sort((a, b) => a.programIndex - b.programIndex);
        return { ...prev, sessions };
      });
    },
    [mutateLogs]
  );

  const removeSession = useCallback(
    (id: string) => {
      mutateLogs((prev) => ({ ...prev, sessions: prev.sessions.filter((s) => s.id !== id) }));
    },
    [mutateLogs]
  );

  const upsertBodyWeightEntry = useCallback(
    (entry: BodyWeightEntry) => {
      mutateLogs((prev) => {
        const idx = prev.bodyWeightEntries.findIndex((e) => e.id === entry.id);
        const entries = [...prev.bodyWeightEntries];
        if (idx >= 0) entries[idx] = entry;
        else entries.push(entry);
        entries.sort((a, b) => a.date.localeCompare(b.date));
        return { ...prev, bodyWeightEntries: entries };
      });
    },
    [mutateLogs]
  );

  const removeBodyWeightEntry = useCallback(
    (id: string) => {
      mutateLogs((prev) => ({ ...prev, bodyWeightEntries: prev.bodyWeightEntries.filter((e) => e.id !== id) }));
    },
    [mutateLogs]
  );

  const upsertSleepEntry = useCallback(
    (entry: SleepEntry) => {
      mutateLogs((prev) => {
        const idx = prev.sleepEntries.findIndex((e) => e.id === entry.id);
        const entries = [...prev.sleepEntries];
        if (idx >= 0) entries[idx] = entry;
        else entries.push(entry);
        entries.sort((a, b) => a.date.localeCompare(b.date));
        return { ...prev, sleepEntries: entries };
      });
    },
    [mutateLogs]
  );

  const removeSleepEntry = useCallback(
    (id: string) => {
      mutateLogs((prev) => ({ ...prev, sleepEntries: prev.sleepEntries.filter((e) => e.id !== id) }));
    },
    [mutateLogs]
  );

  const upsertStepsEntry = useCallback(
    (entry: StepsEntry) => {
      mutateLogs((prev) => {
        const idx = prev.stepsEntries.findIndex((e) => e.id === entry.id);
        const entries = [...prev.stepsEntries];
        if (idx >= 0) entries[idx] = entry;
        else entries.push(entry);
        entries.sort((a, b) => a.date.localeCompare(b.date));
        return { ...prev, stepsEntries: entries };
      });
    },
    [mutateLogs]
  );

  const removeStepsEntry = useCallback(
    (id: string) => {
      mutateLogs((prev) => ({ ...prev, stepsEntries: prev.stepsEntries.filter((e) => e.id !== id) }));
    },
    [mutateLogs]
  );

  const upsertWaterEntry = useCallback(
    (entry: WaterEntry) => {
      mutateLogs((prev) => {
        const idx = prev.waterEntries.findIndex((e) => e.id === entry.id);
        const entries = [...prev.waterEntries];
        if (idx >= 0) entries[idx] = entry;
        else entries.push(entry);
        entries.sort((a, b) => a.date.localeCompare(b.date));
        return { ...prev, waterEntries: entries };
      });
    },
    [mutateLogs]
  );

  const removeWaterEntry = useCallback(
    (id: string) => {
      mutateLogs((prev) => ({ ...prev, waterEntries: prev.waterEntries.filter((e) => e.id !== id) }));
    },
    [mutateLogs]
  );

  const upsertExerciseNoteEntry = useCallback(
    (entry: ExerciseNoteEntry) => {
      mutateLogs((prev) => {
        const idx = prev.exerciseNoteEntries.findIndex((e) => e.id === entry.id);
        const entries = [...prev.exerciseNoteEntries];
        if (idx >= 0) entries[idx] = entry;
        else entries.push(entry);
        return { ...prev, exerciseNoteEntries: entries };
      });
    },
    [mutateLogs]
  );

  const clearAllLogs = useCallback(() => {
    mutateLogs(() => ({ ...EMPTY_LOGS }));
  }, [mutateLogs]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      void saveSettings(next);
      return next;
    });
  }, []);

  const exportBackup = useCallback(() => {
    const payload = {
      exportedAt: new Date().toISOString(),
      settings: { ...settingsRef.current, githubToken: "" },
      logs: logsRef.current,
    };
    downloadJson(`c0n5157ency-respaldo-${new Date().toISOString().slice(0, 10)}.json`, payload);
    updateSettings({ lastExportedAt: new Date().toISOString() });
  }, [updateSettings]);

  const importBackup = useCallback(
    async (file: File): Promise<BackupResult> => {
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const rawLogs = parsed && typeof parsed === "object" && "logs" in parsed ? parsed.logs : parsed;
        const importedLogs = normalizeLogs(rawLogs);
        if (!importedLogs) {
          return { ok: false, message: "El archivo no tiene el formato esperado de un respaldo." };
        }
        mutateLogs(() => importedLogs);
        if (parsed && typeof parsed === "object" && parsed.settings && typeof parsed.settings === "object") {
          const importedSettings = { ...parsed.settings } as Partial<AppSettings>;
          delete importedSettings.githubToken; // nunca pisar el token actual con uno vacío del respaldo
          updateSettings(importedSettings);
        }
        return { ok: true, message: "Respaldo importado correctamente." };
      } catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : String(err) };
      }
    },
    [mutateLogs, updateSettings]
  );

  const retrySync = useCallback(() => {
    retryAttempt.current = 0;
    if (retryTimer.current) clearTimeout(retryTimer.current);
    void pushNow(logsRef.current);
  }, [pushNow]);

  // Arranque: carga settings/logs desde IndexedDB (migrando desde localStorage si hace falta),
  // y pide almacenamiento persistente. Todo lo demás espera a que esto termine.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [loadedSettings, loadedLogs, sha, dirty, persisted] = await Promise.all([
        loadSettings(),
        loadLogs(),
        loadRemoteSha(),
        loadDirtyFlag(),
        requestPersistentStorage(),
      ]);
      if (cancelled) return;
      remoteShaRef.current = sha;
      dirtyRef.current = dirty;
      setSettings(loadedSettings);
      setLogs(loadedLogs);
      setStoragePersisted(persisted);
      setSyncStatus(buildTarget(loadedSettings) ? (dirty ? "pending" : "idle") : "off");
      setBooting(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const reconcile = useCallback(async () => {
    const target = buildTarget(settingsRef.current);
    if (!target) {
      setSyncStatus("off");
      return;
    }

    setSyncStatus("syncing");
    try {
      const remote = await fetchLogsFile(target);
      const current = logsRef.current;

      if (!remote) {
        if (current.sessions.length > 0) {
          const sha = await putLogsFile(target, current, null);
          remoteShaRef.current = sha;
          void saveRemoteSha(sha);
          dirtyRef.current = false;
          void saveDirtyFlag(false);
          setSyncStatus("saved");
          setLastSyncedAt(new Date().toISOString());
        } else {
          setSyncStatus("idle");
        }
        return;
      }

      const remoteData = normalizeLogs(remote.data) ?? remote.data;

      if (dirtyRef.current) {
        const merged = mergeLogs(current, remoteData);
        const sha = await putLogsFile(target, merged, remote.sha);
        remoteShaRef.current = sha;
        void saveRemoteSha(sha);
        void saveLogsLocal(merged);
        setLogs(merged);
        dirtyRef.current = false;
        void saveDirtyFlag(false);
        setSyncStatus("saved");
        setLastSyncedAt(new Date().toISOString());
      } else {
        remoteShaRef.current = remote.sha;
        void saveRemoteSha(remote.sha);
        void saveLogsLocal(remoteData);
        setLogs(remoteData);
        setSyncStatus("saved");
        setLastSyncedAt(new Date().toISOString());
      }
    } catch (err) {
      setSyncStatus("error");
      setSyncError(describeGithubError(err));
    }
  }, []);

  // Reconciliación inicial (y cada vez que cambia la config de sync): concilia el buffer local con GitHub.
  useEffect(() => {
    if (booting) return;
    void reconcile();
    // Solo queremos reconciliar cuando cambia la config de sync, no en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    booting,
    settings.syncEnabled,
    settings.githubToken,
    settings.githubOwner,
    settings.githubRepo,
    settings.githubBranch,
    settings.githubPath,
  ]);

  // Al volver la conexión: reintenta enseguida en vez de esperar el backoff. Al volver a la
  // pestaña: trae lo remoto y fusiona, por si cambió algo en otro dispositivo mientras tanto.
  useEffect(() => {
    if (booting) return;

    function handleOnline() {
      if (dirtyRef.current && buildTarget(settingsRef.current)) {
        retryAttempt.current = 0;
        if (retryTimer.current) clearTimeout(retryTimer.current);
        void pushNow(logsRef.current);
      }
    }
    function handleVisibility() {
      if (document.visibilityState === "visible" && buildTarget(settingsRef.current)) {
        void reconcile();
      }
    }

    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [booting, pushNow, reconcile]);

  useEffect(() => clearTimers, [clearTimers]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", settings.theme === "dark");
  }, [settings.theme]);

  const value: AppContextValue = {
    program,
    exerciseInfoIndex,
    flatDays,
    settings,
    updateSettings,
    isGithubConfigured,
    storagePersisted,
    logs,
    upsertSession,
    removeSession,
    upsertBodyWeightEntry,
    removeBodyWeightEntry,
    upsertSleepEntry,
    removeSleepEntry,
    upsertStepsEntry,
    removeStepsEntry,
    upsertWaterEntry,
    removeWaterEntry,
    upsertExerciseNoteEntry,
    clearAllLogs,
    syncStatus,
    syncError,
    lastSyncedAt,
    retrySync,
    exportBackup,
    importBackup,
  };

  if (booting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <p className="font-mono text-sm text-faint">Cargando…</p>
      </div>
    );
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp debe usarse dentro de <AppProvider>");
  return ctx;
}

export { EMPTY_LOGS };
