#!/usr/bin/env node
// Legacy-Migration: liest locations.js.bak, lädt jedes Bild in den Storage-Bucket
// "stickers" unter legacy/<dateiname>, und legt die DB-Row mit is_legacy=true an.
// Idempotent: Unique-Index auf image_path (where is_legacy) verhindert Dubletten.
//
// Usage:
//   export SUPABASE_URL="https://<project-ref>.supabase.co"
//   export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
//   node scripts/import-legacy.js

import { readFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve, basename } from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const BUCKET = "stickers";

const CANDIDATES = [
  resolve(REPO_ROOT, "locations.js.bak"),
  resolve(REPO_ROOT, "locations.js"),
];
let LOCATIONS_JS = null;
for (const p of CANDIDATES) {
  try { await access(p); LOCATIONS_JS = p; break; } catch { /* next */ }
}
if (!LOCATIONS_JS) {
  console.error("Weder locations.js.bak noch locations.js gefunden.");
  process.exit(1);
}

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Fehlende Env: SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY setzen.");
  process.exit(1);
}

const src = await readFile(LOCATIONS_JS, "utf8");
const arrayMatch = src.match(/const\s+locations\s*=\s*(\[[\s\S]*\]);?\s*$/m);
if (!arrayMatch) {
  console.error(`Konnte das locations-Array in ${LOCATIONS_JS} nicht parsen.`);
  process.exit(1);
}
// eslint-disable-next-line no-new-func
const locations = new Function(`return ${arrayMatch[1]};`)();

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function mimeFromExt(ext) {
  const e = ext.toLowerCase();
  if (e === ".webp") return "image/webp";
  if (e === ".png") return "image/png";
  if (e === ".jpg" || e === ".jpeg") return "image/jpeg";
  if (e === ".gif") return "image/gif";
  return "application/octet-stream";
}

let inserted = 0;
let skipped = 0;
let failed = 0;

for (const loc of locations) {
  const localPath = resolve(REPO_ROOT, loc.image);
  const filename = basename(loc.image);
  const storageKey = `legacy/${filename}`;
  const ext = filename.slice(filename.lastIndexOf("."));

  let buf;
  try { buf = await readFile(localPath); }
  catch (e) {
    failed++;
    console.error(`FAIL  ${filename}: lokal nicht gefunden (${localPath})`);
    continue;
  }

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(storageKey, buf, { contentType: mimeFromExt(ext), upsert: true });
  if (upErr) {
    failed++;
    console.error(`FAIL  ${filename}: Upload ${upErr.message}`);
    continue;
  }

  const row = {
    is_legacy: true,
    uploader_id: null,
    legacy_finder_name: loc.finder,
    image_path: storageKey,
    title: loc.title ?? null,
    description: loc.description ?? null,
    latitude: loc.position?.[0] ?? null,
    longitude: loc.position?.[1] ?? null,
    found_at: loc.time instanceof Date ? loc.time.toISOString() : new Date(loc.time).toISOString(),
  };

  const { error } = await supabase.from("stickers").insert(row);
  if (!error) {
    inserted++;
    continue;
  }
  if (error.code === "23505") {
    skipped++;
    continue;
  }
  failed++;
  console.error(`FAIL  ${filename}: ${error.message}`);
}

process.exit(failed > 0 ? 1 : 0);
