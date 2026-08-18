#!/usr/bin/env node
// Füllt `country_code` (und daraus `continent`) für Sticker, bei denen es fehlt.
//
// Geocodiert wird genau einmal pro Sticker und das Ergebnis landet in der DB —
// die Website selbst fragt nie einen Geocoder, sie liest nur die Spalte.
//
// Quelle: Nominatim (OpenStreetMap). Deren Nutzungsregeln verlangen maximal
// eine Anfrage pro Sekunde und einen aussagekräftigen User-Agent; beides hält
// das Skript ein. Bei ein paar Dutzend Stickern dauert der Lauf < 1 Minute.
//
// Ausführen (Key bleibt in deinem Terminal, nicht im Chat):
//   cd scripts
//   SUPABASE_SERVICE_ROLE_KEY="<dein-service-role-key>" node backfill-countries.js
//
// Optionen:
//   --all      auch Sticker neu geocodieren, die schon einen country_code haben
//   --dry-run  nur anzeigen, was passieren würde (schreibt nichts)

import { createClient } from "@supabase/supabase-js";
import { CONTINENT_BY_COUNTRY, countryName } from "../assets/js/countries.js";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://hyrrryazboxkfimcunzu.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY) {
  console.error("Fehlt: SUPABASE_SERVICE_ROLE_KEY (Env-Variable) setzen.");
  process.exit(1);
}

const ALL = process.argv.includes("--all");
const DRY = process.argv.includes("--dry-run");
const USER_AGENT = "ValentinStickerWebsite/1.0 (+https://valentinsticker.de)";
const RATE_LIMIT_MS = 1100; // Nominatim: max. 1 Anfrage/Sekunde

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// zoom=3 liefert die Landesebene – wir brauchen nichts Feineres und belasten
// Nominatim so am wenigsten.
async function reverseCountry(lat, lon) {
  const url = "https://nominatim.openstreetmap.org/reverse?" + new URLSearchParams({
    format: "jsonv2", lat, lon, zoom: 3, addressdetails: 1,
  });
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  const cc = (await res.json())?.address?.country_code;
  return cc ? cc.toUpperCase() : null;
}

let query = supabase
  .from("stickers")
  .select("id, title, latitude, longitude, country_code")
  .not("latitude", "is", null)
  .not("longitude", "is", null)
  .order("found_at", { ascending: true });
if (!ALL) query = query.is("country_code", null);

const { data: rows, error } = await query;
if (error) {
  console.error("Laden fehlgeschlagen:", error.message);
  process.exit(1);
}
if (!rows.length) {
  console.log("Nichts zu tun – alle Sticker haben schon einen Ländercode.");
  process.exit(0);
}

console.log(`${rows.length} Sticker zu geocodieren${DRY ? " (Trockenlauf)" : ""}…\n`);

let ok = 0;
const failed = [];
for (const [i, row] of rows.entries()) {
  if (i > 0) await sleep(RATE_LIMIT_MS);
  let cc = null;
  try {
    cc = await reverseCountry(row.latitude, row.longitude);
  } catch (e) {
    failed.push({ row, reason: e.message });
    console.log(`  ✗ ${row.title ?? row.id}: ${e.message}`);
    continue;
  }
  if (!cc) {
    failed.push({ row, reason: "kein Land gefunden (Meer?)" });
    console.log(`  ✗ ${row.title ?? row.id}: kein Land gefunden`);
    continue;
  }

  const continent = CONTINENT_BY_COUNTRY[cc] ?? null;
  console.log(`  ✓ ${(row.title ?? row.id).padEnd(42)} ${cc}  ${countryName(cc)}`);
  if (DRY) { ok++; continue; }

  const { error: upErr } = await supabase
    .from("stickers")
    .update({ country_code: cc, continent })
    .eq("id", row.id);
  if (upErr) {
    failed.push({ row, reason: upErr.message });
    console.log(`     ↳ Schreiben fehlgeschlagen: ${upErr.message}`);
    continue;
  }
  ok++;
}

console.log(`\nFertig: ${ok} von ${rows.length} gesetzt.`);
if (failed.length) {
  console.log(`${failed.length} offen – im Admin von Hand nachtragen:`);
  for (const f of failed) console.log(`  - ${f.row.title ?? f.row.id} (${f.reason})`);
  process.exit(1);
}
