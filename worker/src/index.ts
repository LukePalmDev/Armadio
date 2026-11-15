import { authenticate } from "./auth";
import { empty, json } from "./http";
import { validateItems } from "./model.js";
import { listHistory, MAX_BYTES, readCurrent, readHistory, restoreHistory, saveItems } from "./store";

interface SaveBody {
  items: unknown;
  version: string | null;
  force: boolean;
}

function log(event: Record<string, unknown>): void {
  console.log(JSON.stringify(event));
}

async function readLimited(request: Request): Promise<Uint8Array | Response> {
  const declared = request.headers.get("content-length");
  if (declared !== null && Number(declared) > MAX_BYTES) {
    return json({ error: "too_large", message: "Il payload supera 1 MB." }, 413);
  }
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      return json({ error: "too_large", message: "Il payload supera 1 MB." }, 413);
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function parseVersion(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.length > 0 && value.length <= 80) return value;
  return undefined;
}

async function parseSaveBody(request: Request): Promise<SaveBody | Response> {
  const bytes = await readLimited(request);
  if (bytes instanceof Response) return bytes;
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return json({ error: "invalid", message: "JSON non valido." }, 400);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return json({ error: "invalid", message: "Il payload deve essere un oggetto con items e version." }, 400);
  }
  const body = parsed as Record<string, unknown>;
  const version = parseVersion(body.version);
  if (version === undefined) {
    return json({ error: "invalid", message: "version non valida." }, 400);
  }
  if (body.force !== undefined && typeof body.force !== "boolean") {
    return json({ error: "invalid", message: "force non valido." }, 400);
  }
  const message = validateItems(body.items);
  if (message) return json({ error: "invalid", message }, 400);
  return { items: body.items, version, force: body.force === true };
}

function snapshotBody(snapshot: { items: unknown[]; version: string | null }) {
  return { items: snapshot.items, version: snapshot.version };
}

async function handleLoad(env: Env): Promise<Response> {
  const snapshot = await readCurrent(env.WARDROBE);
  return json(snapshotBody(snapshot), 200, snapshot.version);
}

async function handleSave(request: Request, env: Env): Promise<Response> {
  const parsed = await parseSaveBody(request);
  if (parsed instanceof Response) return parsed;
  const result = await saveItems(env.WARDROBE, parsed.items as unknown[], parsed.version, parsed.force);
  if (!result.ok) {
    log({ message: "save conflict", version: result.conflict.version });
    return json(
      {
        error: "conflict",
        message: "L'armadio è stato modificato su un altro dispositivo.",
        ...snapshotBody(result.conflict),
      },
      409,
      result.conflict.version,
    );
  }
  log({ message: "saved", count: result.snapshot.items.length, version: result.snapshot.version });
  return json(
    { status: "ok", items: result.snapshot.items.length, version: result.snapshot.version },
    200,
    result.snapshot.version,
  );
}

async function handleHistory(url: URL, env: Env): Promise<Response> {
  const id = url.searchParams.get("id");
  if (id) {
    const record = await readHistory(env.WARDROBE, id);
    if (!record) return json({ error: "not_found", message: "Versione non trovata." }, 404);
    return json(
      { id: record.id, savedAt: record.savedAt, version: record.version, items: record.items },
      200,
      record.version,
    );
  }
  const versions = await listHistory(env.WARDROBE);
  return json({ versions }, 200);
}

async function readRestoreBody(request: Request): Promise<{ id: string; version: string | null; force: boolean } | Response> {
  const bytes = await readLimited(request);
  if (bytes instanceof Response) return bytes;
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return json({ error: "invalid", message: "JSON non valido." }, 400);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return json({ error: "invalid", message: "Il payload deve essere un oggetto." }, 400);
  }
  const body = parsed as Record<string, unknown>;
  if (typeof body.id !== "string" || !body.id) {
    return json({ error: "invalid", message: "id mancante." }, 400);
  }
  const version = parseVersion(body.version);
  if (version === undefined) return json({ error: "invalid", message: "version non valida." }, 400);
  if (body.force !== undefined && typeof body.force !== "boolean") {
    return json({ error: "invalid", message: "force non valido." }, 400);
  }
  return { id: body.id, version, force: body.force === true };
}

async function handleRestoreRequest(request: Request, env: Env): Promise<Response> {
  const parsed = await readRestoreBody(request);
  if (parsed instanceof Response) return parsed;
  const result = await restoreHistory(env.WARDROBE, parsed.id, parsed.version, parsed.force);
  if ("error" in result) {
    if (result.error === "missing" || result.error === "bad_id") {
      return json({ error: "not_found", message: "Versione non trovata." }, 404);
    }
    return json({ error: "invalid", message: result.message ?? "Versione non valida." }, 400);
  }
  if (!result.ok) {
    return json(
      {
        error: "conflict",
        message: "L'armadio è stato modificato su un altro dispositivo.",
        ...snapshotBody(result.conflict),
      },
      409,
      result.conflict.version,
    );
  }
  log({ message: "restored", id: parsed.id, version: result.snapshot.version, count: result.snapshot.items.length });
  return json(
    { status: "ok", items: result.snapshot.items.length, version: result.snapshot.version, wardrobe: snapshotBody(result.snapshot) },
    200,
    result.snapshot.version,
  );
}

export default {
  async fetch(request, env, _ctx): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) {
      return json({ error: "not_found", message: "Percorso non trovato." }, 404);
    }

    if (request.method === "OPTIONS") return empty(204);

    const identity = await authenticate(request, env);
    if (identity instanceof Response) return identity;

    try {
      if (url.pathname === "/api/load" && request.method === "GET") return await handleLoad(env);
      if (url.pathname === "/api/save" && request.method === "POST") return await handleSave(request, env);
      if (url.pathname === "/api/history" && request.method === "GET") return await handleHistory(url, env);
      if (url.pathname === "/api/restore" && request.method === "POST") return await handleRestoreRequest(request, env);
      if (
        (url.pathname === "/api/load" && request.method !== "GET") ||
        (url.pathname === "/api/save" && request.method !== "POST") ||
        (url.pathname === "/api/history" && request.method !== "GET") ||
        (url.pathname === "/api/restore" && request.method !== "POST")
      ) {
        return json({ error: "method_not_allowed", message: "Metodo non consentito." }, 405);
      }
      return json({ error: "not_found", message: "Percorso non trovato." }, 404);
    } catch (err) {
      console.error(JSON.stringify({
        message: "request failed",
        path: url.pathname,
        error: err instanceof Error ? err.message : String(err),
      }));
      return json({ error: "error", message: "Errore interno." }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
