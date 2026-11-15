import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateItems } from "./src/model.js";

const here = dirname(fileURLToPath(import.meta.url));
const wardrobePath = join(here, "..", "wardrobe.json");
const checkOnly = process.argv.includes("--check");

const items = JSON.parse(await readFile(wardrobePath, "utf8"));
const error = validateItems(items);
if (error) {
  console.error(error);
  process.exit(1);
}

const snapshot = {
  items,
  version: randomUUID(),
  updatedAt: new Date().toISOString(),
};

if (checkOnly) {
  console.log(`wardrobe.json valido: ${items.length} capi`);
  process.exit(0);
}

console.log(`Carico ${items.length} capi nella chiave KV "current" (sovrascrive il valore remoto).`);
const dir = await mkdtemp(join(tmpdir(), "armadio-seed-"));
const path = join(dir, "current.json");
await writeFile(path, JSON.stringify(snapshot));

const child = spawn(
  "npx",
  ["wrangler", "kv", "key", "put", "current", "--path", path, "--binding", "WARDROBE", "--remote"],
  { cwd: here, stdio: "inherit" },
);

child.on("exit", (code) => process.exit(code ?? 1));
