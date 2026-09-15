# Min-Max Tracker

Webapp personal (un solo usuario, sin login) para trackear el programa
**Min-Max Phase 2: Peak Physique (4x/semana)** de Jeff Nippard. Pensada para
usarse desde el celular en el gimnasio (mobile-first) y desde la compu para
revisar el historial.

- Vite + React + TypeScript + Tailwind CSS.
- Sin backend: los registros de entrenamiento se guardan como `data/logs.json`
  en este mismo repositorio de GitHub, vía la API REST de GitHub (Contents API).
- Deploy gratuito en GitHub Pages.

## Cómo funciona el progreso

El "día de hoy" del programa **no se calcula por fecha de calendario**, sino
por cuántos entrenamientos ya marcaste como completados o salteados. Así, si
entrenás tarde, saltás un día, o entrenás dos días seguidos, el programa nunca
se desincroniza: siempre avanza un lugar por cada sesión que cerrás. La fecha
de inicio en Ajustes es solo informativa.

Solo se loguean **series de trabajo** (peso, reps, RIR). Las series de
calentamiento se muestran como instrucción ("2-3 series livianas") pero no se
registran individualmente, porque el programa no las usa para progresión.

## 1. Generar el `program.json` a partir del Excel

El Excel de origen (`Min-Max_Phase_2_-_4x.xlsx`) se parsea una sola vez a
`src/data/program.json`, que la app consume directamente.

Requisitos: Python 3 + `openpyxl` (`pip install openpyxl`).

```bash
python scripts/parse_program.py
# o con una ruta de Excel distinta (ej. si cambiás de fase/programa):
python scripts/parse_program.py "ruta/a/Otro_Programa.xlsx"
```

Esto sobrescribe `src/data/program.json`. Revisá la consola: si aparece algún
`[warn]` significa que una fila no encajó con el patrón esperado (cantidad de
series de trabajo vs. valores de RIR) y conviene revisarla a mano en el Excel.

**Si el layout de columnas cambia** entre programas (otro orden, otras
columnas), hay que ajustar `COL` y la lógica de `scripts/parse_program.py`.

## 2. Correr la app en local

Requiere [Node.js](https://nodejs.org/) 18+.

```bash
npm install
npm run dev
```

Abre en `http://localhost:5173/C0n5157ency/` (el path incluye el nombre del
repo porque así queda configurado el `base` para GitHub Pages).

## 3. Generar un GitHub Personal Access Token

La app necesita un token para poder escribir `data/logs.json` en este repo
desde el navegador (se pega una sola vez en Ajustes y queda guardado solo en
`localStorage` de tu dispositivo; nunca se commitea ni se envía a nadie más
que a la API de GitHub).

1. Anda a **GitHub → Settings → Developer settings → Personal access tokens
   → Fine-grained tokens → Generate new token**.
2. **Repository access**: "Only select repositories" → elegí únicamente este
   repo (`C0n5157ency`).
3. **Permissions → Repository permissions → Contents**: `Read and write`.
   No hace falta ningún otro permiso.
4. Generá el token, copialo, y pegalo en la app: **Ajustes → Personal Access
   Token**, junto con tu usuario de GitHub y el nombre del repo.
5. Tocá "Probar conexión" para confirmar que funciona.

Si el token vence o se revoca, la app sigue guardando todo en `localStorage`
como buffer local (nunca perdés un registro) y reintenta sincronizar cuando
generás uno nuevo.

## 4. Deploy a GitHub Pages

El repo incluye un workflow (`.github/workflows/deploy.yml`) que buildea y
publica automáticamente en cada push a `main`.

1. En GitHub, andá a **Settings → Pages** y elegí **Source: GitHub Actions**.
2. Hacé push a `main` (o corré el workflow manualmente desde la pestaña
   Actions).
3. La app queda publicada en `https://<tu-usuario>.github.io/C0n5157ency/`.

Si el repo cambia de nombre, actualizá el `base` en [vite.config.ts](vite.config.ts)
para que coincida.

## Estructura del proyecto

```
scripts/parse_program.py   # Excel -> src/data/program.json
src/data/program.json      # Programación completa (generada, no editar a mano)
src/types/                 # Tipos de programa y de logs
src/lib/                   # Lógica: schedule, github API, sync/merge, storage
src/context/AppContext.tsx # Estado global: settings, logs, sincronización
src/screens/                # Hoy / Historial / Ajustes
src/components/            # ExerciseCard, RIRSelector, RestTimer, etc.
```
