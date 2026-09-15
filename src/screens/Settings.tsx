import { useState } from "react";
import { useApp } from "../context/AppContext";
import { testConnection } from "../lib/github";
import { SyncIndicator } from "../components/SyncIndicator";

export function SettingsScreen() {
  const { settings, updateSettings } = useApp();
  const [form, setForm] = useState(settings);
  const [testResult, setTestResult] = useState<null | { ok: boolean; message: string }>(null);
  const [testing, setTesting] = useState(false);

  function save() {
    updateSettings(form);
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    const target = {
      token: form.githubToken,
      owner: form.githubOwner,
      repo: form.githubRepo,
      branch: form.githubBranch || "main",
    };
    const result = await testConnection(target);
    setTestResult(result.ok ? { ok: true, message: "Conexión OK" } : { ok: false, message: result.message });
    setTesting(false);
  }

  return (
    <div className="space-y-6 pb-24">
      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 font-semibold text-slate-800 dark:text-slate-100">Programa</h2>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-500 dark:text-slate-400">Fecha de inicio</span>
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </label>
        <p className="mt-2 text-xs text-slate-400">
          Es solo informativa: el próximo día de entrenamiento siempre se calcula por los
          entrenamientos que marcaste como completados o salteados, nunca por la fecha, para
          que nunca se desincronice.
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 font-semibold text-slate-800 dark:text-slate-100">Sincronización con GitHub</h2>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm text-slate-500 dark:text-slate-400">
              Personal Access Token
            </span>
            <input
              type="password"
              autoComplete="off"
              value={form.githubToken}
              onChange={(e) => setForm({ ...form, githubToken: e.target.value })}
              placeholder="github_pat_..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-sm text-slate-500 dark:text-slate-400">Usuario/Org</span>
              <input
                type="text"
                value={form.githubOwner}
                onChange={(e) => setForm({ ...form, githubOwner: e.target.value })}
                placeholder="tomastamaki"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-slate-500 dark:text-slate-400">Repositorio</span>
              <input
                type="text"
                value={form.githubRepo}
                onChange={(e) => setForm({ ...form, githubRepo: e.target.value })}
                placeholder="C0n5157ency"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-500 dark:text-slate-400">Branch</span>
            <input
              type="text"
              value={form.githubBranch}
              onChange={(e) => setForm({ ...form, githubBranch: e.target.value })}
              placeholder="main"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={save}
            className="flex-1 rounded-lg bg-accent-600 py-2 text-sm font-semibold text-white"
          >
            Guardar
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={testing}
            className="flex-1 rounded-lg bg-slate-100 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200"
          >
            {testing ? "Probando…" : "Probar conexión"}
          </button>
        </div>

        {testResult && (
          <p
            className={`mt-2 text-sm ${
              testResult.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
            }`}
          >
            {testResult.message}
          </p>
        )}

        <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
          <SyncIndicator />
        </div>
      </section>

      <p className="text-xs text-slate-400">
        El token se guarda solo en este dispositivo (localStorage) y nunca se sube al
        repositorio. Ver el README para cómo generar un token con permisos mínimos.
      </p>
    </div>
  );
}
