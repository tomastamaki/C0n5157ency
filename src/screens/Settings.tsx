import { useMemo, useRef, useState } from "react";
import { useApp } from "../context/AppContext";
import { testConnection } from "../lib/github";
import { SyncIndicator } from "../components/SyncIndicator";
import { ThemeToggle } from "../components/ThemeToggle";
import { getAllExerciseNames } from "../lib/history";
import { guessIncrementKg } from "../lib/increments";

const DAYS_30_MS = 30 * 24 * 60 * 60 * 1000;

export function SettingsScreen({ onShowOnboarding }: { onShowOnboarding: () => void }) {
  const { settings, updateSettings, program, clearAllLogs, storagePersisted, exportBackup, importBackup } = useApp();
  const [form, setForm] = useState(settings);
  const [testResult, setTestResult] = useState<null | { ok: boolean; message: string }>(null);
  const [testing, setTesting] = useState(false);
  const [showIncrements, setShowIncrements] = useState(false);
  const [importResult, setImportResult] = useState<null | { ok: boolean; message: string }>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      path: form.githubPath || "data/logs.json",
    };
    const result = await testConnection(target);
    setTestResult(result.ok ? { ok: true, message: "Conexión OK: el token puede leer y escribir en el repo." } : { ok: false, message: result.message });
    setTesting(false);
  }

  function saveIncrements() {
    updateSettings({ exerciseIncrements: incrementsForm });
  }

  function handleClearAllData() {
    if (
      !window.confirm(
        "¿Borrar TODOS los datos de entrenamiento? Se elimina por completo el historial, los PRs y el progreso. Esta acción no se puede deshacer."
      )
    ) {
      return;
    }
    clearAllLogs();
  }

  function handleRestartProgram() {
    if (
      !window.confirm(
        "¿Reiniciar el programa desde la Semana 1 (Intro Week)? Tu historial actual se conserva como referencia en Historial, pero deja de contar para el progreso, la racha y las alertas actuales."
      )
    ) {
      return;
    }
    updateSettings({
      programCycle: settings.programCycle + 1,
      startDate: new Date().toISOString().slice(0, 10),
    });
  }

  async function handleImportFile(file: File) {
    if (
      !window.confirm(
        "¿Reemplazar todos tus datos actuales con los del archivo de respaldo? Esta acción no se puede deshacer."
      )
    ) {
      return;
    }
    const result = await importBackup(file);
    setImportResult(result);
  }

  const daysSinceExport = settings.lastExportedAt ? (Date.now() - new Date(settings.lastExportedAt).getTime()) / DAYS_30_MS : null;
  const showBackupNudge = !settings.syncEnabled && (daysSinceExport === null || daysSinceExport >= 1);

  return (
    <div className="space-y-6 pb-24">
      <section className="rounded-card border border-border bg-surface p-4 shadow-elevated-sm">
        <h2 className="mb-3 font-semibold text-ink">Apariencia</h2>
        <ThemeToggle />
      </section>

      <section className="rounded-card border border-border bg-surface p-4 shadow-elevated-sm">
        <h2 className="mb-1 font-semibold text-ink">Ayuda</h2>
        <p className="mb-3 text-xs text-muted">
          RIR, cómo completar una serie, agregar la app a tu pantalla de inicio, y un resumen del
          programa.
        </p>
        <button
          type="button"
          onClick={onShowOnboarding}
          className="w-full rounded-pill bg-surface2 py-2 text-sm font-semibold text-ink"
        >
          Ver introducción de nuevo
        </button>
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
        <h2 className="mb-1 font-semibold text-ink">Guardado</h2>
        <p className="mb-3 text-xs text-muted">
          Todos tus datos se guardan en este dispositivo (IndexedDB) y la app funciona completa
          sin necesidad de configurar nada acá abajo.
        </p>

        <div className="flex items-center justify-between gap-2 rounded-block border border-border bg-surface2 px-3 py-2">
          <span className="text-sm text-ink">Almacenamiento persistente</span>
          <span
            className={`rounded-pill px-2 py-0.5 text-xs font-semibold ${
              storagePersisted ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
            }`}
          >
            {storagePersisted === null ? "revisando…" : storagePersisted ? "concedido" : "no concedido"}
          </span>
        </div>

        {!settings.syncEnabled && showBackupNudge && (
          <p className="mt-3 rounded-block border border-warning/30 bg-warning/5 p-2.5 text-xs text-warning">
            {settings.lastExportedAt
              ? "Hace más de 30 días que no exportás un respaldo. Tus datos solo están en este dispositivo."
              : "Todavía no exportaste ningún respaldo. Tus datos solo están en este dispositivo."}
          </p>
        )}

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={exportBackup}
            className="flex-1 rounded-pill bg-surface2 py-2 text-sm font-semibold text-ink"
          >
            Exportar respaldo
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 rounded-pill bg-surface2 py-2 text-sm font-semibold text-ink"
          >
            Importar respaldo
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImportFile(file);
              e.target.value = "";
            }}
          />
        </div>
        {settings.lastExportedAt && (
          <p className="mt-1 text-xs text-faint">Último respaldo: {new Date(settings.lastExportedAt).toLocaleString("es-AR")}</p>
        )}
        {importResult && (
          <p className={`mt-2 text-sm ${importResult.ok ? "text-success" : "text-red-500"}`}>{importResult.message}</p>
        )}
      </section>

      <section className="rounded-card border border-border bg-surface p-4 shadow-elevated-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-ink">Sincronización (opcional)</h2>
          <button
            type="button"
            role="switch"
            aria-checked={form.syncEnabled}
            onClick={() => {
              const next = { ...form, syncEnabled: !form.syncEnabled };
              setForm(next);
              updateSettings({ syncEnabled: next.syncEnabled });
            }}
            className={`relative h-6 w-11 shrink-0 rounded-pill transition-colors ${
              form.syncEnabled ? "bg-primary" : "bg-surface2"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                form.syncEnabled ? "translate-x-[22px]" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {!form.syncEnabled ? (
          <p className="mt-2 text-xs text-muted">
            Tus datos solo están en este dispositivo. Exportá un respaldo de vez en cuando o
            activá la sincronización para tenerlos también en GitHub (y poder usar la app desde
            otro dispositivo).
          </p>
        ) : (
          <>
            <p className="mt-2 text-xs text-muted">
              Recomendado: usá un repositorio privado separado solo para tus datos — el repo de
              la app es público.
            </p>
            <div className="mt-3 space-y-3">
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
                    placeholder="mis-datos-privados"
                    className="w-full rounded-pill border border-border bg-surface2 px-3 py-2 text-sm text-ink"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
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
                <label className="block">
                  <span className="mb-1 block text-sm text-faint">Ruta del archivo</span>
                  <input
                    type="text"
                    value={form.githubPath}
                    onChange={(e) => setForm({ ...form, githubPath: e.target.value })}
                    placeholder="data/logs.json"
                    className="w-full rounded-pill border border-border bg-surface2 px-3 py-2 font-mono text-sm text-ink"
                  />
                </label>
              </div>
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

            <div className="mt-4 border-t border-border pt-3">
              <p className="mb-1 text-sm font-medium text-ink">Configurar otro dispositivo</p>
              <ol className="list-decimal space-y-1 pl-4 text-xs text-muted">
                <li>Abrí la app en el otro dispositivo.</li>
                <li>Andá a Ajustes → Sincronización (opcional) y activá el interruptor.</li>
                <li>Pegá el mismo token, usuario/org, repositorio, branch y ruta de acá.</li>
                <li>Tocá "Probar conexión" y después "Guardar": va a traer y fusionar los datos automáticamente.</li>
              </ol>
              <p className="mt-2 text-xs text-faint">
                El token da acceso de escritura a ese repo — no lo compartas ni lo pegues en
                ningún lado público.
              </p>
            </div>
          </>
        )}
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

      <section className="rounded-card border border-red-500/30 bg-red-500/5 p-4 shadow-elevated-sm">
        <h2 className="mb-1 font-semibold text-red-500">Zona de riesgo</h2>
        <p className="mb-3 text-xs text-muted">Estas acciones son irreversibles.</p>

        <div className="space-y-3">
          <div>
            <button
              type="button"
              onClick={handleRestartProgram}
              className="w-full rounded-pill border border-warning/40 bg-warning/10 py-2 text-sm font-semibold text-warning"
            >
              Reiniciar programa (mantener historial)
            </button>
            <p className="mt-1 text-xs text-muted">
              Vuelve a la Semana 1 hoy mismo. Lo ya registrado queda visible en Historial, pero
              no cuenta más para el progreso, la racha ni las alertas.
            </p>
          </div>

          <div>
            <button
              type="button"
              onClick={handleClearAllData}
              className="w-full rounded-pill border border-red-500/40 bg-red-500/10 py-2 text-sm font-semibold text-red-500"
            >
              Borrar todos los datos de sesiones
            </button>
            <p className="mt-1 text-xs text-muted">
              Elimina por completo el historial, los PRs y el progreso. La app queda como recién
              instalada.
            </p>
          </div>
        </div>
      </section>

      <p className="text-xs text-muted">
        El token se guarda solo en este dispositivo y nunca se sube al repositorio. Ver el README
        para cómo generar un token con permisos mínimos.
      </p>
    </div>
  );
}
