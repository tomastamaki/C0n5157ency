import type { LogsData } from "../types/logs";

export interface GitHubTarget {
  token: string;
  owner: string;
  repo: string;
  branch: string;
}

export const LOGS_PATH = "data/logs.json";

export class GitHubApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "GitHubApiError";
  }
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

/** Trae data/logs.json del repo. Devuelve null si el archivo todavía no existe. */
export async function fetchLogsFile(target: GitHubTarget): Promise<RemoteLogsFile | null> {
  const res = await fetch(`${apiUrl(target, LOGS_PATH)}?ref=${encodeURIComponent(target.branch)}`, {
    headers: authHeaders(target),
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new GitHubApiError(`GET ${LOGS_PATH} falló: ${res.status} ${await safeMessage(res)}`, res.status);
  }

  const json = await res.json();
  const content = base64ToUtf8(json.content as string);
  return { data: JSON.parse(content) as LogsData, sha: json.sha as string };
}

/**
 * Reemplaza data/logs.json en un solo commit. Si `sha` es null se asume que el
 * archivo no existe todavía y se crea.
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

  const res = await fetch(apiUrl(target, LOGS_PATH), {
    method: "PUT",
    headers: { ...authHeaders(target), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new GitHubApiError(`PUT ${LOGS_PATH} falló: ${res.status} ${await safeMessage(res)}`, res.status);
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

/** Valida token+repo con una llamada liviana, para el botón "probar conexión" de Ajustes. */
export async function testConnection(target: GitHubTarget): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const res = await fetch(`https://api.github.com/repos/${target.owner}/${target.repo}`, {
      headers: authHeaders(target),
    });
    if (res.ok) return { ok: true };
    return { ok: false, message: `${res.status} ${await safeMessage(res)}` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}
