import { validateItems } from "./model.js";

export const MAX_BYTES = 1_048_576;
export const HISTORY_LIMIT = 20;

const CURRENT_KEY = "current";
const INDEX_KEY = "history-index";
const HISTORY_ID = /^history:\d{10,16}(?:-[0-9a-f]{8})?$/;

export interface Snapshot {
  items: unknown[];
  version: string | null;
  updatedAt: string | null;
}

export interface HistoryMeta {
  id: string;
  savedAt: string;
  version: string | null;
  count: number;
}

interface HistoryRecord extends Snapshot {
  id: string;
  savedAt: string;
}

function normalizeSnapshot(raw: string | null): Snapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Snapshot>;
    if (!parsed || !Array.isArray(parsed.items)) return null;
    return {
      items: parsed.items,
      version: typeof parsed.version === "string" && parsed.version ? parsed.version : null,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
    };
  } catch {
    return null;
  }
}

export async function readCurrent(kv: KVNamespace): Promise<Snapshot> {
  const snapshot = normalizeSnapshot(await kv.get(CURRENT_KEY));
  return snapshot ?? { items: [], version: null, updatedAt: null };
}

async function readIndex(kv: KVNamespace): Promise<HistoryMeta[]> {
  const raw = await kv.get(INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as HistoryMeta[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => entry && typeof entry.id === "string");
  } catch {
    return [];
  }
}

async function pushHistory(kv: KVNamespace, snapshot: Snapshot): Promise<void> {
  const savedAt = new Date().toISOString();
  let id = `history:${Date.now()}`;
  if (await kv.get(id)) {
    const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
    id = `history:${Date.now()}-${suffix}`;
  }
  const record: HistoryRecord = { ...snapshot, id, savedAt };
  await kv.put(id, JSON.stringify(record));

  const index = await readIndex(kv);
  index.unshift({
    id,
    savedAt,
    version: snapshot.version,
    count: snapshot.items.length,
  });
  const overflow = index.splice(HISTORY_LIMIT);
  await kv.put(INDEX_KEY, JSON.stringify(index));
  await Promise.all(overflow.map((entry) => kv.delete(entry.id)));
}

export type SaveResult =
  | { ok: true; snapshot: Snapshot }
  | { ok: false; conflict: Snapshot };

/**
 * Write items when the client version matches the stored one.
 * A missing current key (version null) accepts a null client version.
 * `force` replaces whatever is stored and is the explicit overwrite path.
 */
export async function saveItems(
  kv: KVNamespace,
  items: unknown[],
  clientVersion: string | null,
  force: boolean,
): Promise<SaveResult> {
  const current = await readCurrent(kv);
  const stored = current.version !== null;
  if (!force && stored && clientVersion !== current.version) {
    return { ok: false, conflict: current };
  }

  if (stored) await pushHistory(kv, current);

  const snapshot: Snapshot = {
    items,
    version: crypto.randomUUID(),
    updatedAt: new Date().toISOString(),
  };
  await kv.put(CURRENT_KEY, JSON.stringify(snapshot));
  return { ok: true, snapshot };
}

export async function listHistory(kv: KVNamespace): Promise<HistoryMeta[]> {
  return readIndex(kv);
}

export async function readHistory(kv: KVNamespace, id: string): Promise<HistoryRecord | null> {
  if (!HISTORY_ID.test(id)) return null;
  const raw = await kv.get(id);
  const snapshot = normalizeSnapshot(raw);
  if (!snapshot || !raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<HistoryRecord>;
    return {
      ...snapshot,
      id,
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : "",
    };
  } catch {
    return null;
  }
}

export async function restoreHistory(
  kv: KVNamespace,
  id: string,
  clientVersion: string | null,
  force: boolean,
): Promise<SaveResult | { error: "bad_id" | "missing" | "invalid"; message?: string }> {
  if (!HISTORY_ID.test(id)) return { error: "bad_id" };
  const record = await readHistory(kv, id);
  if (!record) return { error: "missing" };
  const message = validateItems(record.items);
  if (message) return { error: "invalid", message };
  return saveItems(kv, record.items, clientVersion, force);
}
