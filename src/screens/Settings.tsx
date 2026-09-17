import { useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { testConnection } from "../lib/github";
import { SyncIndicator } from "../components/SyncIndicator";
import { ThemeToggle } from "../components/ThemeToggle";
import { getAllExerciseNames } from "../lib/history";
import { guessIncrementKg } from "../lib/increments";

export function SettingsScreen() {
  const { settings, updateSettings, program } = useApp();
  const [form, setForm] = useState(settings);
  const [testResult, setTestResult] = useState<null | { ok: boolean; message: string }>(null);
  const [testing, setTesting] = useState(false);
  const [showIncrements, setShowIncrements] = useState(false);

  const exercises = useMemo(() => getAllExerciseNames(program), [program]);
  const [incrementsForm, setIncrementsForm] = useState(settings.exerciseIncrements);

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

  function saveIncrements() {
    updateSettings({ exerciseIncrements: incrementsForm });
  }

  return (
    <div className="space-y-6 pb-24">
      <section className="rounded-card border border-border bg-surface p-4 shadow-elevated-sm">
        <h2 className="mb-3 font-semibold text-ink">Apariencia</h2>
        <ThemeToggle />
      </section>

      <section className="rounded-card border border-border bg-surface p-4 shadow-elevated-sm">
        <h2 className="mb-3 font-semibold text-ink">Programa</h2>
        <label className="block">
          <span className="mb-1 block text-sm text-faint">Fecha de inicio</span>
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            className="w-full rounded-pill border border-border bg-surface2 px-3 py-2 text-ink"
          />
        </label>
        <p className="mt-2 text-xs text-muted">
          Es solo informativa: el próximo día de entrenamiento siempre se calcula por los
          entrenamientos que marcaste como completados o salteados, nunca por la fecha, para
          que nunca se desincronice.
        </p>
      </section>

      <section className="rounded-card border border-border bg-surface p-4 shadow-elevated-sm">
        <h2 className="mb-3 font-semibold text-ink">Sincronización con GitHub</h2>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm text-faint">Personal Access Token</span>
            <input
              type="password"
              autoComplete="off"
              value={form.githubToken}
              onChange={(e) => setForm({ ...form, githubToken: e.target.value })}
              placeholder="github_pat_..."
              className="w-full rounded-pill border border-border bg-surface2 px-3 py-2 font-mono text-sm text-ink"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-sm text-faint">Usuario/Org</span>
              <input
                type="text"
                value={form.githubOwner}
                onChange={(e) => setForm({ ...form, githubOwner: e.target.value })}
                placeholder="tomastamaki"
                className="w-full rounded-pill border border-border bg-surface2 px-3 py-2 text-sm text-ink"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-faint">Repositorio</span>
              <input
                type="text"
                value={form.githubRepo}
                onChange={(e) => setForm({ ...form, githubRepo: e.target.value })}
                placeholder="C0n5157ency"
                className="w-full rounded-pill border border-border bg-surface2 px-3 py-2 text-sm text-ink"
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-sm text-faint">Branch</span>
            <input
              type="text"
              value={form.githubBranch}
              onChange={(e) => setForm({ ...form, githubBranch: e.target.value })}
              placeholder="main"
              className="w-full rounded-pill border border-border bg-surface2 px-3 py-2 text-sm text-ink"
            />
          </label>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={save}
            className="flex-1 rounded-pill bg-primary py-2 text-sm font-semibold text-white"
          >
            Guardar
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={testing}
            className="flex-1 rounded-pill bg-surface2 py-2 text-sm font-semibold text-ink disabled:opacity-50"
          >
            {testing ? "Probando…" : "Probar conexión"}
          </button>
        </div>

        {testResult && (
          <p className={`mt-2 text-sm ${testResult.ok ? "text-success" : "text-red-500"}`}>
            {testResult.message}
          </p>
        )}

        <div className="mt-4 border-t border-border pt-3">
          <SyncIndicator />
        </div>
      </section>

      <section className="rounded-card border border-border bg-surface p-4 shadow-elevated-sm">
        <button
          type="button"
          onClick={() => setShowIncrements((s) => !s)}
          className="flex w-full items-center justify-between font-semibold text-ink"
        >
          <span>Incrementos de peso por ejercicio</span>
          <span className="text-sm font-normal text-faint">{showIncrements ? "ocultar" : "mostrar"}</span>
        </button>
        <p className="mt-1 text-xs text-muted">
          Se usan para sugerir el próximo peso según el RIR de la vez anterior. Si no
          ajustás uno, se infiere por el nombre del ejercicio (por defecto 2.5kg).
        </p>

        {showIncrements && (
          <>
            <div className="mt-3 max-h-96 space-y-2 overflow-y-auto pr-1">
              {exercises.map((name) => (
                <div key={name} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted">{name}</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={incrementsForm[name] ?? guessIncrementKg(name)}
                    onChange={(e) =>
                      setIncrementsForm({ ...incrementsForm, [name]: Number(e.target.value) })
                    }
                    className="w-20 rounded-pill border border-border bg-surface2 px-2 py-1 text-right font-mono text-ink"
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={saveIncrements}
              className="mt-3 w-full rounded-pill bg-primary py-2 text-sm font-semibold text-white"
            >
              Guardar incrementos
            </button>
          </>
        )}
      </section>

      <p className="text-xs text-muted">
        El token se guarda solo en este dispositivo (localStorage) y nunca se sube al
        repositorio. Ver el README para cómo generar un token con permisos mínimos.
      </p>
    </div>
  );
}
