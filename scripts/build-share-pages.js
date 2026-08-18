#!/usr/bin/env node
// Erzeugt pro Sticker eine kleine Seite s/<id>.html mit eigenen og:-Tags.
//
// Warum: valentinsticker.de ist statisch (GitHub Pages), es kann also keine
// Vorschau pro URL zur Laufzeit erzeugen. Die og:-Tags in index.html sind fest
// verdrahtet — geteilte Links sehen in WhatsApp deshalb alle gleich aus.
// Diese Seiten enthalten Titel, Finder und das echte Bild und leiten Menschen
// sofort auf /?sticker=<id> weiter. Crawler lesen nur die Tags und folgen der
// Weiterleitung nicht.
//
// Sticker, die noch keine Seite haben (frisch hochgeladen), fängt 404.html ab.
//
// Ausführen:
//   cd scripts
//   node build-share-pages.js            # schreibt ../s/
//   node build-share-pages.js --dry-run  # zeigt nur, was entstünde
//
// Braucht keinen Service-Key: die Sticker sind öffentlich lesbar.

import { readdir, mkdir, writeFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "..", "s");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://hyrrryazboxkfimcunzu.supabase.co";
const ANON_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_RgW1PAzg2JZ5Yk4vdCv7xA_WtZKlWDv";
const BUCKET = "stickers";
const SITE = "https://www.valentinsticker.de";
const FALLBACK_IMAGE = `${SITE}/img/valentinSticker.webp`;
// Alle Sticker liegen damit unter 300 KB (größter: 263 KB).
const PREVIEW_PARAMS = "?width=1200&height=1200&resize=contain&quality=75";

const DRY = process.argv.includes("--dry-run");

const isVideo = (p) => /\.(mp4|webm|mov|m4v|ogg)$/i.test(p || "");

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function page(sticker) {
  const { id, title, description, finder, found_at, image_path } = sticker;
  const safeTitle = escapeHtml(title || "Valentin-Sticker");
  const datum = found_at ? new Date(found_at).toLocaleDateString("de-DE") : null;
  const desc = escapeHtml(
    [description, finder ? `Gefunden von ${finder}${datum ? ` am ${datum}` : ""}.` : null]
      .filter(Boolean).join(" ") || "Ein gefundener Valentin-Sticker."
  );
  const media = image_path
    ? `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${image_path}`
    : FALLBACK_IMAGE;
  // Fürs Vorschaubild die verkleinerte Fassung nehmen: WhatsApp zeigt keine
  // Vorschau mehr, wenn das Bild grob über 600 KB liegt – die Originale hier
  // gehen bis ~5 MB. `contain` erhält das Seitenverhältnis (nur `width` allein
  // lässt der Transformer die Höhe stehen und verzerrt das Bild).
  const preview = image_path
    ? `${SUPABASE_URL}/storage/v1/render/image/public/${BUCKET}/${image_path}${PREVIEW_PARAMS}`
    : FALLBACK_IMAGE;
  // Videos taugen nicht als og:image – dann zeigt die Vorschau das Logo.
  // In Attributen muss & als &amp; stehen – die Vorschau-URL hat Query-Parameter.
  const image = escapeHtml(isVideo(image_path) ? FALLBACK_IMAGE : preview);
  const mediaAttr = escapeHtml(media);
  const target = `${SITE}/?sticker=${id}`;

  return `<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeTitle} – Valentinsticker.de</title>
    <link rel="icon" href="${SITE}/img/valentinSticker.webp" type="image/webp" />
    <link rel="canonical" href="${target}" />

    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Valentinsticker.de" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:url" content="${SITE}/s/${id}.html" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${desc}" />
    <meta name="twitter:image" content="${image}" />
${isVideo(image_path) ? `    <meta property="og:video" content="${mediaAttr}" />\n` : ""}
    <!-- Weiterleitung bewusst NUR per JavaScript, ohne meta-refresh: Crawler
         führen kein JS aus und bleiben deshalb garantiert auf dieser Seite und
         ihren og:-Tags. Einer Meta-Refresh-Weiterleitung würden viele folgen und läsen dann die
         generischen Tags von index.html. -->
    <script>window.location.replace(${JSON.stringify(target)});</script>
    <link rel="stylesheet" href="${SITE}/style.css" />
  </head>
  <body style="text-align:center;padding:40px 20px;font-family:Arial,sans-serif;">
    <img src="${SITE}/img/valentinSticker.webp" alt="" width="80" height="80" />
    <p>Weiter zu <a href="${target}">${safeTitle}</a> …</p>
  </body>
</html>
`;
}

// ── Sticker holen ────────────────────────────────────────────────────────────
const url = `${SUPABASE_URL}/rest/v1/stickers?select=` +
  "id,title,description,image_path,found_at,legacy_finder_name,profiles:uploader_id(display_name)" +
  "&is_hidden=eq.false&order=found_at.desc";

const res = await fetch(url, { headers: { apikey: ANON_KEY } });
if (!res.ok) {
  console.error(`Sticker konnten nicht geladen werden: HTTP ${res.status}`);
  process.exit(1);
}
const rows = await res.json();
if (!Array.isArray(rows) || rows.length === 0) {
  console.error("Keine Sticker erhalten – Abbruch, damit nichts gelöscht wird.");
  process.exit(1);
}

const stickers = rows.map((r) => ({
  ...r,
  finder: r.profiles?.display_name || r.legacy_finder_name || "Anonym",
}));

if (DRY) {
  console.log(`${stickers.length} Seiten würden nach s/ geschrieben:`);
  for (const s of stickers) console.log(`  s/${s.id}.html  ${s.title ?? "(ohne Titel)"}`);
  process.exit(0);
}

// ── Verzeichnis auffrischen ──────────────────────────────────────────────────
// Nur .html-Dateien in s/ anfassen – das Verzeichnis gehört komplett diesem
// Skript, aber alles andere bleibt trotzdem unangetastet.
if (!existsSync(OUT_DIR)) await mkdir(OUT_DIR, { recursive: true });

const vorhanden = (await readdir(OUT_DIR)).filter((f) => f.endsWith(".html"));
const sollen = new Set(stickers.map((s) => `${s.id}.html`));
let entfernt = 0;
for (const f of vorhanden) {
  if (!sollen.has(f)) { await unlink(join(OUT_DIR, f)); entfernt++; }
}

for (const s of stickers) {
  await writeFile(join(OUT_DIR, `${s.id}.html`), page(s), "utf8");
}

console.log(`${stickers.length} Seiten in s/ geschrieben.`);
if (entfernt) console.log(`${entfernt} verwaiste Seite(n) entfernt (Sticker gelöscht oder versteckt).`);
console.log("Nicht vergessen: s/ committen und pushen, sonst sind die Seiten nicht online.");
