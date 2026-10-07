import type { LogsData } from "../types/logs";

export interface GitHubTarget {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  /** Ruta del archivo de datos dentro del repo, ej. "data/logs.json". */
  path: string;
}

export const DEFAULT_LOGS_PATH = "data/logs.json";

export class GitHubApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "GitHubApiError";
  }
}

/** Mensaje en español, accionable, para mostrar en el indicador de sync ante un error de GitHub. */
export function describeGithubError(err: unknown): string {
  if (err instanceof GitHubApiError) {
    switch (err.status) {
      case 401:
        return "Token inválido o vencido. Generá uno nuevo en GitHub (Settings → Developer settings → Personal access tokens) y pegalo de nuevo en Ajustes.";
      case 403:
        return "El token no tiene permiso para escribir en este repositorio. Revisá que tenga permiso de contenido (Contents: Read and write) sobre ese repo.";
      case 404:
        return "No se encontró el repositorio o la rama. Revisá el usuario/organización, el nombre del repo y la rama en Ajustes.";
      case 409:
        return "Conflicto al guardar (otro dispositivo escribió primero). Reintentando con los cambios fusionados.";
      default:
        return `Error de GitHub (${err.status}): ${err.message}`;
    }
  }
  if (err instanceof Error) {
    if (err.message.toLowerCase().includes("fetch") || err.message.toLowerCase().includes("network")) {
      return "Sin conexión a internet. Se reintenta solo cuando vuelva.";
    }
    return err.message;
  }
  return String(err);
}

function apiUrl(target: GitHubTarget, path: string): string {
  return `https://api.github.com/repos/${target.owner}/${target.repo}/contents/${path}`;
}

function authHeaders(target: GitHubTarget): HeadersInit {
  return {
    Authorization: `Bearer ${target.token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

// Codifica UTF-8 -> base64 sin romper con caracteres no-ASCII (tildes, etc).
function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function base64ToUtf8(base64: string): string {
  const binary = atob(base64.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export interface RemoteLogsFile {
  data: LogsData;
  sha: string;
}

/** Trae el archivo de datos del repo. Devuelve null si el archivo todavía no existe. */
export async function fetchLogsFile(target: GitHubTarget): Promise<RemoteLogsFile | null> {
  const res = await fetch(`${apiUrl(target, target.path)}?ref=${encodeURIComponent(target.branch)}`, {
    headers: authHeaders(target),
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new GitHubApiError(`GET ${target.path} falló: ${res.status} ${await safeMessage(res)}`, res.status);
  }

  const json = await res.json();
  const content = base64ToUtf8(json.content as string);
  return { data: JSON.parse(content) as LogsData, sha: json.sha as string };
}

/**
 * Reemplaza el archivo de datos en un solo commit. Si `sha` es null se asume
 * que el archivo no existe todavía y se crea.
 */
export async function putLogsFile(
  target: GitHubTarget,
  data: LogsData,
  sha: string | null
): Promise<string> {
  const body = {
    message: `chore: actualizar registros de entrenamiento (${new Date().toISOString()})`,
    content: utf8ToBase64(JSON.stringify(data, null, 2)),
    branch: target.branch,
    ...(sha ? { sha } : {}),
  };

  const res = await fetch(apiUrl(target, target.path), {
    method: "PUT",
    headers: { ...authHeaders(target), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new GitHubApiError(`PUT ${target.path} falló: ${res.status} ${await safeMessage(res)}`, res.status);
  }

  const json = await res.json();
  return json.content.sha as string;
}

async function safeMessage(res: Response): Promise<string> {
  try {
    const json = await res.json();
    return json.message ?? res.statusText;
  } catch {
    return res.statusText;
  }
}

/** Valida token + acceso al repo + permiso de escritura, para el botón "probar conexión" de Ajustes. */
export async function testConnection(target: GitHubTarget): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const repoRes = await fetch(`https://api.github.com/repos/${target.owner}/${target.repo}`, {
      headers: authHeaders(target),
    });
    if (!repoRes.ok) {
      return { ok: false, message: describeGithubError(new GitHubApiError(await safeMessage(repoRes), repoRes.status)) };
    }
    const repoJson = await repoRes.json();
    if (repoJson.permissions && repoJson.permissions.push === false) {
      return { ok: false, message: "El token puede leer el repo pero no tiene permiso de escritura (push)." };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, message: describeGithubError(err) };
  }
}
