import { env } from "cloudflare:workers";
import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { exportJWK, generateKeyPair, SignJWT, type JWK } from "jose";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CERTS_URL, TEAM_DOMAIN, parseAllowlist } from "../src/auth";
import worker from "../src/index";
import { HISTORY_LIMIT, MAX_BYTES } from "../src/store";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

let privateKey: CryptoKey;
let publicJwk: JWK;
let certFetches = 0;
const originalFetch = globalThis.fetch.bind(globalThis);

function capo(id: string, name = "Giacca test") {
  return {
    id,
    house: "Milano",
    section: "sec1-top-rail",
    name,
    type: "jacket",
    color: "#111111",
    brand: "Test",
    notes: "",
  };
}

async function sign(overrides: {
  email?: string;
  audience?: string;
  issuer?: string;
  exp?: number;
  key?: CryptoKey;
  kid?: string;
} = {}) {
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({ email: overrides.email ?? "ada@byluke.org" })
    .setProtectedHeader({ alg: "RS256", kid: overrides.kid ?? "test-key" })
    .setIssuer(overrides.issuer ?? TEAM_DOMAIN)
    .setAudience(overrides.audience ?? env.ACCESS_AUD)
    .setSubject("user-ada")
    .setIssuedAt(now - 60)
    .setNotBefore(now - 60)
    .setExpirationTime(overrides.exp ?? now + 3600)
    .sign(overrides.key ?? privateKey);
}

async function call(path: string, init: { method?: string; token?: string | null; body?: unknown } = {}) {
  const headers = new Headers();
  if (init.token) headers.set("Cf-Access-Jwt-Assertion", init.token);
  if (init.body !== undefined) headers.set("content-type", "application/json");
  const request = new IncomingRequest(`https://armadio.byluke.org${path}`, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

async function clearKv() {
  let cursor: string | undefined;
  do {
    const page = await env.WARDROBE.list({ cursor });
    await Promise.all(page.keys.map((key) => env.WARDROBE.delete(key.name)));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
}

beforeAll(async () => {
  const pair = await generateKeyPair("RS256", { extractable: true });
  privateKey = pair.privateKey;
  publicJwk = await exportJWK(pair.publicKey);
  publicJwk.kid = "test-key";
  publicJwk.alg = "RS256";
  publicJwk.use = "sig";

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.startsWith(CERTS_URL)) {
      certFetches += 1;
      return new Response(JSON.stringify({ keys: [publicJwk] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return originalFetch(input, init);
  };
});

beforeEach(async () => {
  await clearKv();
});

describe("access jwt", () => {
  it("accepts a valid token and caches the certs", async () => {
    expect(parseAllowlist("")).toBeNull();
    expect(parseAllowlist(" ada@byluke.org , other@byluke.org ")?.has("ada@byluke.org")).toBe(true);

    const before = certFetches;
    const token = await sign();
    const first = await call("/api/load", { token });
    const second = await call("/api/load", { token: await sign({ email: "Ada@ByLuke.org" }) });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.headers.get("cache-control")).toContain("no-store");
    expect(certFetches).toBe(before + 1);
    const body = await second.json() as { items: unknown[]; version: null };
    expect(body.items).toEqual([]);
    expect(body.version).toBeNull();
  });

  it("rejects a missing token", async () => {
    const response = await call("/api/load");
    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toContain("no-store");
    await expect(response.json()).resolves.toMatchObject({ error: "forbidden", reason: "missing_token" });
  });

  it("rejects a forged signature", async () => {
    const other = await generateKeyPair("RS256", { extractable: true });
    const token = await sign({ key: other.privateKey, kid: "other-key" });
    const response = await call("/api/load", { token });
    expect(response.status).toBe(403);
    const body = await response.json() as { error: string };
    expect(body.error).toBe("forbidden");
  });

  it("rejects an expired token", async () => {
    const token = await sign({ exp: Math.floor(Date.now() / 1000) - 120 });
    const response = await call("/api/load", { token });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ reason: "expired" });
  });

  it("rejects the wrong audience", async () => {
    const token = await sign({ audience: "someone-else" });
    const response = await call("/api/load", { token });
    expect(response.status).toBe(403);
    const body = await response.json() as { error: string; reason: string };
    expect(body.error).toBe("forbidden");
    expect(body.reason).not.toBe("missing_token");
  });

  it("rejects an email outside the allowlist", async () => {
    const token = await sign({ email: "eve@example.com" });
    const response = await call("/api/save", {
      token,
      body: { items: [capo("a")], version: null, force: false },
    });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ reason: "email_not_allowed" });
  });
});

describe("wardrobe api", () => {
  it("round-trips a save and a load", async () => {
    const token = await sign();
    const saved = await call("/api/save", {
      token,
      body: { items: [capo("m1", "Lino")], version: null, force: false },
    });
    expect(saved.status).toBe(200);
    expect(saved.headers.get("cache-control")).toContain("no-store");
    const savedBody = await saved.json() as { version: string; items: number };
    expect(savedBody.items).toBe(1);
    expect(saved.headers.get("etag")).toBe(`"${savedBody.version}"`);

    const loaded = await call("/api/load", { token });
    expect(loaded.status).toBe(200);
    const loadedBody = await loaded.json() as { items: { name: string }[]; version: string };
    expect(loadedBody.version).toBe(savedBody.version);
    expect(loadedBody.items[0].name).toBe("Lino");
    expect(loaded.headers.get("etag")).toBe(`"${savedBody.version}"`);
  });

  it("returns 409 when the version is stale and keeps the stored wardrobe", async () => {
    const token = await sign();
    const first = await call("/api/save", {
      token,
      body: { items: [capo("a", "Prima")], version: null },
    });
    const v1 = (await first.json() as { version: string }).version;
    const second = await call("/api/save", {
      token,
      body: { items: [capo("a", "Seconda")], version: v1 },
    });
    const v2 = (await second.json() as { version: string }).version;

    const conflict = await call("/api/save", {
      token,
      body: { items: [capo("a", "Terza")], version: v1 },
    });
    expect(conflict.status).toBe(409);
    const body = await conflict.json() as { error: string; version: string; items: { name: string }[] };
    expect(body.error).toBe("conflict");
    expect(body.version).toBe(v2);
    expect(body.items[0].name).toBe("Seconda");

    const loaded = await call("/api/load", { token });
    const still = await loaded.json() as { items: { name: string }[]; version: string };
    expect(still.version).toBe(v2);
    expect(still.items[0].name).toBe("Seconda");

    const forced = await call("/api/save", {
      token,
      body: { items: [capo("a", "Terza")], version: v1, force: true },
    });
    expect(forced.status).toBe(200);
    const after = await (await call("/api/load", { token })).json() as { items: { name: string }[] };
    expect(after.items[0].name).toBe("Terza");
  });

  it("lets only one of two concurrent saves win", async () => {
    const token = await sign();
    const first = await call("/api/save", {
      token,
      body: { items: [capo("a", "Base")], version: null },
    });
    const version = (await first.json() as { version: string }).version;
    const [left, right] = await Promise.all([
      call("/api/save", { token, body: { items: [capo("a", "Sinistra")], version } }),
      call("/api/save", { token, body: { items: [capo("a", "Destra")], version } }),
    ]);
    const statuses = [left.status, right.status].sort();
    expect(statuses).toEqual([200, 409]);
    const winner = left.status === 200 ? await left.json() as { version: string } : await right.json() as { version: string };
    const loaded = await (await call("/api/load", { token })).json() as { items: { name: string }[]; version: string };
    expect(loaded.version).toBe(winner.version);
    expect(["Sinistra", "Destra"]).toContain(loaded.items[0].name);
    const history = await (await call("/api/history", { token })).json() as { versions: { id: string }[] };
    expect(history.versions).toHaveLength(1);
    const saved = await (await call(`/api/history?id=${encodeURIComponent(history.versions[0].id)}`, { token })).json() as { items: { name: string }[] };
    expect(saved.items[0].name).toBe("Base");
  });

  it("rejects an empty overwrite that does not know the current version", async () => {
    const token = await sign();
    const saved = await call("/api/save", {
      token,
      body: { items: [capo("a"), capo("b")], version: null },
    });
    const version = (await saved.json() as { version: string }).version;
    const blocked = await call("/api/save", {
      token,
      body: { items: [], version: null },
    });
    expect(blocked.status).toBe(409);
    const allowed = await call("/api/save", {
      token,
      body: { items: [], version },
    });
    expect(allowed.status).toBe(200);
  });

  it("rejects invalid items and payloads over 1 MB", async () => {
    const token = await sign();
    const invalid = await call("/api/save", {
      token,
      body: { items: [{ id: "x" }], version: null },
    });
    expect(invalid.status).toBe(400);

    const huge = "x".repeat(MAX_BYTES + 1);
    const response = await call("/api/save", { token, body: huge });
    expect(response.status).toBe(413);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("keeps the last 20 history entries and can restore one", async () => {
    const token = await sign();
    let version: string | null = null;
    const historyIds: string[] = [];
    for (let i = 0; i < HISTORY_LIMIT + 2; i++) {
      const saved = await call("/api/save", {
        token,
        body: { items: [capo("a", `Versione ${i}`)], version },
      });
      expect(saved.status).toBe(200);
      version = (await saved.json() as { version: string }).version;
      if (i > 0) {
        const listed = await (await call("/api/history", { token })).json() as { versions: { id: string }[] };
        historyIds.push(listed.versions[0].id);
      }
    }

    const history = await (await call("/api/history", { token })).json() as {
      versions: { id: string; count: number }[];
    };
    expect(history.versions).toHaveLength(HISTORY_LIMIT);
    const oldestId = historyIds[0];
    expect(history.versions.some((entry) => entry.id === oldestId)).toBe(false);
    expect(await env.WARDROBE.get(oldestId)).toBeNull();

    const target = history.versions[history.versions.length - 1];
    const detail = await call(`/api/history?id=${encodeURIComponent(target.id)}`, { token });
    expect(detail.status).toBe(200);
    const detailBody = await detail.json() as { items: { name: string }[] };

    const current = await (await call("/api/load", { token })).json() as { version: string };
    const restored = await call("/api/restore", {
      token,
      body: { id: target.id, version: current.version, force: false },
    });
    expect(restored.status).toBe(200);
    const after = await (await call("/api/load", { token })).json() as { items: { name: string }[] };
    expect(after.items[0].name).toBe(detailBody.items[0].name);
    expect(after.items[0].name).not.toBe(`Versione ${HISTORY_LIMIT + 1}`);
  });
});
