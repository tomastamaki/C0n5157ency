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
import type { BodyWeightEntry, LogsData, SleepEntry, StepsEntry, WaterEntry, WorkoutSession } from "../types/logs";
import { EMPTY_LOGS } from "../types/logs";
import {
  type AppSettings,
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
import { fetchLogsFile, GitHubApiError, putLogsFile, type GitHubTarget } from "../lib/github";
import { mergeLogs } from "../lib/sync";
import { flattenProgram } from "../lib/schedule";
import { buildExerciseInfoIndex, type ExerciseInfo } from "../lib/program";

const program = programJson as unknown as Program;
const exerciseInfoIndex = buildExerciseInfoIndex(program);

export type SyncStatus = "not-configured" | "idle" | "pending" | "syncing" | "saved" | "error";

const DEBOUNCE_MS = 2500;
const RETRY_DELAYS_MS = [5000, 15000, 60000];

interface AppContextValue {
  program: Program;
  exerciseInfoIndex: Record<string, ExerciseInfo>;
  flatDays: ReturnType<typeof flattenProgram>;
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
  isGithubConfigured: boolean;
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
  clearAllLogs: () => void;
  syncStatus: SyncStatus;
  syncError: string | null;
  lastSyncedAt: string | null;
  retrySync: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function buildTarget(settings: AppSettings): GitHubTarget | null {
  if (!settings.githubToken || !settings.githubOwner || !settings.githubRepo) return null;
  return {
    token: settings.githubToken,
    owner: settings.githubOwner,
    repo: settings.githubRepo,
    branch: settings.githubBranch || "main",
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [logs, setLogs] = useState<LogsData>(() => loadLogs());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const flatDays = useMemo(() => flattenProgram(program), []);

  const remoteShaRef = useRef<string | null>(loadRemoteSha());
  const dirtyRef = useRef<boolean>(loadDirtyFlag());
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryAttempt = useRef(0);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const isGithubConfigured = buildTarget(settings) !== null;

  const clearTimers = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (retryTimer.current) clearTimeout(retryTimer.current);
  }, []);

  const pushNow = useCallback(async (dataToPush: LogsData) => {
    const target = buildTarget(settingsRef.current);
    if (!target) {
      setSyncStatus("not-configured");
      return;
    }

    setSyncStatus("syncing");
    try {
      const newSha = await putLogsFile(target, dataToPush, remoteShaRef.current);
      remoteShaRef.current = newSha;
      saveRemoteSha(newSha);
      dirtyRef.current = false;
      saveDirtyFlag(false);
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
          saveRemoteSha(newSha);
          saveLogsLocal(merged);
          setLogs(merged);
          dirtyRef.current = false;
          saveDirtyFlag(false);
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
      saveDirtyFlag(true);
      setSyncStatus("error");
      setSyncError(err instanceof Error ? err.message : String(err));

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
        saveLogsLocal(next);
        dirtyRef.current = true;
        saveDirtyFlag(true);
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

  const clearAllLogs = useCallback(() => {
    mutateLogs(() => ({ ...EMPTY_LOGS }));
  }, [mutateLogs]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const retrySync = useCallback(() => {
    retryAttempt.current = 0;
    if (retryTimer.current) clearTimeout(retryTimer.current);
    void pushNow(logs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs, pushNow]);

  // Reconciliación inicial: al abrir la app, concilia el buffer local con GitHub.
  useEffect(() => {
    const target = buildTarget(settingsRef.current);
    if (!target) {
      setSyncStatus("not-configured");
      return;
    }

    let cancelled = false;

    (async () => {
      setSyncStatus("syncing");
      try {
        const remote = await fetchLogsFile(target);

        if (cancelled) return;

        if (!remote) {
          if (logs.sessions.length > 0) {
            const sha = await putLogsFile(target, logs, null);
            remoteShaRef.current = sha;
            saveRemoteSha(sha);
            dirtyRef.current = false;
            saveDirtyFlag(false);
            setSyncStatus("saved");
            setLastSyncedAt(new Date().toISOString());
          } else {
            setSyncStatus("idle");
          }
          return;
        }

        const remoteData = normalizeLogs(remote.data) ?? remote.data;

        if (dirtyRef.current) {
          const merged = mergeLogs(logs, remoteData);
          const sha = await putLogsFile(target, merged, remote.sha);
          remoteShaRef.current = sha;
          saveRemoteSha(sha);
          saveLogsLocal(merged);
          setLogs(merged);
          dirtyRef.current = false;
          saveDirtyFlag(false);
          setSyncStatus("saved");
          setLastSyncedAt(new Date().toISOString());
        } else {
          remoteShaRef.current = remote.sha;
          saveRemoteSha(remote.sha);
          saveLogsLocal(remoteData);
          setLogs(remoteData);
          setSyncStatus("saved");
          setLastSyncedAt(new Date().toISOString());
        }
      } catch (err) {
        if (cancelled) return;
        setSyncStatus("error");
        setSyncError(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      cancelled = true;
    };
    // Solo queremos reconciliar una vez al montar (o si cambia la config de GitHub).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.githubToken, settings.githubOwner, settings.githubRepo, settings.githubBranch]);

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
    clearAllLogs,
    syncStatus,
    syncError,
    lastSyncedAt,
    retrySync,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp debe usarse dentro de <AppProvider>");
  return ctx;
}

export { EMPTY_LOGS };
