// Local end-to-end check: Miniflare (via wrangler's test harness) serves /api,
// a static server serves the site on armadio.byluke.org, and headless Chrome
// exercises sync. Access is simulated by injecting a JWT signed with a test key
// whose public half is returned for the team certs URL.
import { createTestHarness } from "wrangler";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const here = fileURLToPath(new URL(".", import.meta.url));
const workerDir = join(here, "..");
const siteDir = join(workerDir, "..");
const CERTS_URL = "https://empty-pond-1e04.cloudflareaccess.com/cdn-cgi/access/certs";
const TEAM = "https://empty-pond-1e04.cloudflareaccess.com";
const AUD = "test-audience";
const artifacts = "/opt/cursor/artifacts";
mkdirSync(artifacts, { recursive: true });

const realFetch = globalThis.fetch.bind(globalThis);
let publicJwk;
let privateKey;
let certFetches = 0;

globalThis.fetch = async (input, init) => {
  const url = input instanceof Request ? input.url : String(input);
  if (url.startsWith(CERTS_URL)) {
    certFetches += 1;
    return new Response(JSON.stringify({ keys: [publicJwk] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  return realFetch(input, init);
};

const pair = await generateKeyPair("RS256", { extractable: true });
privateKey = pair.privateKey;
publicJwk = await exportJWK(pair.publicKey);
publicJwk.kid = "e2e-key";
publicJwk.alg = "RS256";
publicJwk.use = "sig";

async function token() {
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({ email: "ada@byluke.org" })
    .setProtectedHeader({ alg: "RS256", kid: "e2e-key" })
    .setIssuer(TEAM)
    .setAudience(AUD)
    .setSubject("e2e-user")
    .setIssuedAt(now - 30)
    .setNotBefore(now - 30)
    .setExpirationTime(now + 60 * 60)
    .sign(privateKey);
}

const harness = createTestHarness({
  workers: [{
    configPath: "./wrangler.toml",
    vars: { ACCESS_AUD: AUD, ALLOWED_EMAILS: "" },
  }],
});

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
};

let apiOffline = false;
const site = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://armadio.byluke.org");
    if (url.pathname.startsWith("/api/")) {
      if (apiOffline) {
        res.destroy();
        return;
      }
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks);
      const headers = new Headers();
      headers.set("cf-access-jwt-assertion", await token());
      if (req.headers["content-type"]) headers.set("content-type", req.headers["content-type"]);
      const upstream = await harness.fetch(`http://armadio.byluke.org${url.pathname}${url.search}`, {
        method: req.method,
        headers,
        body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
      });
      res.statusCode = upstream.status;
      upstream.headers.forEach((value, key) => {
        if (key === "content-encoding" || key === "transfer-encoding") return;
        res.setHeader(key, value);
      });
      res.end(Buffer.from(await upstream.arrayBuffer()));
      return;
    }

    const rel = normalize(decodeURIComponent(url.pathname));
    const filePath = join(siteDir, rel === "/" ? "index.html" : rel);
    if (!filePath.startsWith(siteDir)) {
      res.statusCode = 403;
      res.end("no");
      return;
    }
    const data = await readFile(filePath);
    res.setHeader("content-type", mime[extname(filePath)] || "application/octet-stream");
    res.setHeader("cache-control", "no-store");
    res.end(data);
  } catch (err) {
    if (!res.headersSent) res.statusCode = 404;
    res.end(String(err && err.message ? err.message : err));
  }
});

await new Promise((resolve) => site.listen(4173, "127.0.0.1", resolve));
await harness.listen();

const wardrobe = JSON.parse(await readFile(join(siteDir, "wardrobe.json"), "utf8"));
const version = randomUUID();
const env = await harness.getWorker().getEnv();
await env.WARDROBE.put("current", JSON.stringify({
  items: wardrobe,
  version,
  updatedAt: new Date().toISOString(),
}));

const loaded = await harness.fetch("http://armadio.byluke.org/api/load", {
  headers: { "cf-access-jwt-assertion": await token() },
});
if (loaded.status !== 200) throw new Error(`seed load failed ${loaded.status} ${await loaded.text()}`);
const loadedBody = await loaded.json();
if (loadedBody.items.length !== wardrobe.length) {
  throw new Error(`expected ${wardrobe.length} items, got ${loadedBody.items.length}`);
}
if (certFetches < 1) throw new Error("certs URL was not requested");

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--host-resolver-rules=MAP armadio.byluke.org 127.0.0.1",
  ],
});

const pageErrors = [];
const consoleErrors = [];
function watch(page) {
  page.on("pageerror", (err) => pageErrors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
}

async function openPage() {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  watch(page);
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto("http://armadio.byluke.org:4173/", { waitUntil: "networkidle0", timeout: 20000 });
  await page.waitForFunction(() => {
    const status = document.getElementById("persist-status")?.textContent;
    return status === "SUL SERVER" || status === "CONFLITTO";
  }, { timeout: 15000 });
  return { context, page };
}

async function names(page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem("armadio_clothes") || "[]";
    return JSON.parse(raw).map((item) => item.name);
  });
}

async function addCapo(page, name) {
  await page.$eval('[data-section="sec2-top-shelf"]', (el) => el.click());
  await page.waitForSelector("#cloth-name", { visible: true, timeout: 5000 });
  await page.click("#cloth-name", { clickCount: 3 });
  await page.type("#cloth-name", name);
  await page.click("#btn-submit-cloth");
  await page.waitForFunction((wanted) => {
    const raw = localStorage.getItem("armadio_clothes") || "[]";
    const status = document.getElementById("persist-status")?.textContent;
    const dialog = document.getElementById("conflict-dialog");
    const dialogOpen = dialog && !dialog.hidden;
    return raw.includes(wanted) && (status === "SUL SERVER" || dialogOpen);
  }, { timeout: 10000 }, name);
}

const report = [];
function note(message) {
  report.push(message);
  console.log(message);
}

const first = await openPage();
const count = await first.page.$eval("#db-size-indicator", (el) => el.textContent.trim());
if (count !== `${wardrobe.length} CAPI`) throw new Error(`unexpected count ${count}`);
note(`loaded ${count} from the worker`);

await first.page.evaluate(() => {
  localStorage.setItem("armadio_clothes", "[]");
  localStorage.setItem("armadio_dirty", "1");
  localStorage.removeItem("armadio_version");
});
await first.page.reload({ waitUntil: "networkidle0" });
await first.page.waitForFunction((n) => document.getElementById("db-size-indicator")?.textContent.includes(String(n)), { timeout: 10000 }, wardrobe.length);
const afterEmpty = await names(first.page);
if (afterEmpty.length !== wardrobe.length) {
  throw new Error(`empty local overwrote server: ${afterEmpty.length}`);
}
note("empty local state did not replace the server wardrobe");

const syncedName = `E2E Cappotto ${Date.now()}`;
await addCapo(first.page, syncedName);
const status = await first.page.$eval("#persist-status", (el) => el.textContent.trim());
if (status !== "SUL SERVER") throw new Error(`save status ${status}`);
await first.page.screenshot({ path: join(artifacts, "sync-lock-saved.png") });
note(`saved ${syncedName}`);

const fresh = await openPage();
const freshNames = await names(fresh.page);
if (!freshNames.includes(syncedName)) throw new Error("fresh profile did not see the edit");
await fresh.page.screenshot({ path: join(artifacts, "sync-lock-fresh.png") });
note("fresh browser profile loaded the edit from the worker");

const otherName = `E2E Altro ${Date.now()}`;
await addCapo(fresh.page, otherName);
const localName = `E2E Locale ${Date.now()}`;
await addCapo(first.page, localName);
await first.page.waitForSelector("#conflict-dialog:not([hidden])", { timeout: 10000 });
const conflictText = await first.page.$eval("#conflict-message", (el) => el.textContent.trim());
if (!conflictText.includes("altro dispositivo")) throw new Error(`unexpected conflict copy: ${conflictText}`);
await first.page.screenshot({ path: join(artifacts, "sync-lock-conflict.png") });
note("conflict dialog shown");
await first.page.click("#conflict-reload");
await first.page.waitForFunction(() => document.getElementById("conflict-dialog")?.hidden, { timeout: 10000 });
const reloaded = await names(first.page);
if (reloaded.includes(localName)) throw new Error("reload kept the local edit");
if (!reloaded.includes(otherName)) throw new Error("reload missed the other device");
note("reload kept the other device and dropped the local edit");

const overwriteName = `E2E Sovrascrivi ${Date.now()}`;
const lostName = `E2E Perso ${Date.now()}`;
await addCapo(fresh.page, lostName);
await addCapo(first.page, overwriteName);
await first.page.waitForSelector("#conflict-dialog:not([hidden])", { timeout: 10000 });
await first.page.click("#conflict-overwrite");
await first.page.waitForFunction(() => document.getElementById("persist-status")?.textContent === "SUL SERVER", { timeout: 10000 });
const afterOverwrite = await openPage();
const overwritten = await names(afterOverwrite.page);
if (!overwritten.includes(overwriteName)) throw new Error("overwrite did not reach a fresh profile");
if (overwritten.includes(lostName)) throw new Error("overwrite kept the other device's newer edit");
note("overwrite replaced the server copy");

const beforeOfflineErrors = consoleErrors.length;
apiOffline = true;
const offlineName = `E2E Offline ${Date.now()}`;
await addCapo(afterOverwrite.page, offlineName);
await afterOverwrite.page.waitForFunction((text) => {
  const banner = document.getElementById("sync-banner");
  return banner && !banner.hidden && banner.textContent === text;
}, { timeout: 10000 }, "Modifiche salvate solo su questo dispositivo");
const offlineStatus = await afterOverwrite.page.$eval("#persist-status", (el) => el.textContent.trim());
if (offlineStatus !== "NEL BROWSER") throw new Error(`offline status ${offlineStatus}`);
await afterOverwrite.page.screenshot({ path: join(artifacts, "sync-lock-offline.png") });
note("offline edit stayed on this device");

apiOffline = false;
await afterOverwrite.page.evaluate(() => window.dispatchEvent(new Event("online")));
await afterOverwrite.page.waitForFunction(() => document.getElementById("persist-status")?.textContent === "SUL SERVER", { timeout: 15000 });
const syncedBack = await openPage();
const backNames = await names(syncedBack.page);
if (!backNames.includes(offlineName)) throw new Error("offline edit did not sync after reconnect");
note("offline edit synced after the API returned");

const deletePage = await openPage();
const liveVersion = await deletePage.page.evaluate(() => localStorage.getItem("armadio_version"));
const liveCount = (await names(deletePage.page)).length;
await deletePage.page.evaluate(() => {
  localStorage.setItem("armadio_clothes", "[]");
  localStorage.setItem("armadio_dirty", "1");
  localStorage.setItem("armadio_version", "stale-version");
});
await deletePage.page.reload({ waitUntil: "networkidle0" });
await deletePage.page.waitForSelector("#conflict-dialog:not([hidden])", { timeout: 10000 });
const held = await harness.fetch("http://armadio.byluke.org/api/load", {
  headers: { "cf-access-jwt-assertion": await token() },
});
const heldBody = await held.json();
if (heldBody.items.length !== liveCount) throw new Error("stale empty local state replaced the server");
note("stale empty local state did not replace the server");

await deletePage.page.evaluate((version) => {
  localStorage.setItem("armadio_clothes", "[]");
  localStorage.setItem("armadio_dirty", "1");
  localStorage.setItem("armadio_version", version);
}, liveVersion);
await deletePage.page.reload({ waitUntil: "networkidle0" });
await deletePage.page.waitForFunction(() => {
  const status = document.getElementById("persist-status")?.textContent;
  const count = document.getElementById("db-size-indicator")?.textContent;
  const dialog = document.getElementById("conflict-dialog");
  return status === "SUL SERVER" && count === "0 CAPI" && (!dialog || dialog.hidden);
}, { timeout: 10000 });
note("offline deletion of every item synced");

const unexpected = consoleErrors.slice(0, beforeOfflineErrors).filter((line) => !/fonts\.googleapis|fonts\.gstatic|Failed to load resource/i.test(line));
if (pageErrors.length) throw new Error(`page errors:\n${pageErrors.join("\n")}`);
if (unexpected.length) throw new Error(`console errors:\n${unexpected.join("\n")}`);
note(`console messages before offline: ${JSON.stringify(consoleErrors.slice(0, beforeOfflineErrors))}`);
note(`certs fetched ${certFetches} time(s)`);

await browser.close();
await new Promise((resolve) => site.close(resolve));
await harness.close();
console.log("E2E OK");
