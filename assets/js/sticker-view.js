// Gemeinsame Formatter und Haversine-Distanz.
// Die eigentliche URL-Auflösung bleibt in supabase-client.imageUrlFor.
import { imageUrlFor } from "./supabase-client.js";

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

export function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
}

export function fmtDistanceKm(km) {
  if (!Number.isFinite(km)) return "?";
  if (km < 10) return km.toFixed(2) + " km";
  if (km < 100) return km.toFixed(1) + " km";
  return Math.round(km) + " km";
}

export function haversineKm(lat1, lon1, lat2, lon2) {
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return NaN;
  const R = 6371;
  const dL = (lat2 - lat1) * Math.PI / 180;
  const dN = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dL / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dN / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Vollständige Sticker-Karte (Bild + Titel + Meta). Wird in account.html,
// profile.html und quiz-Ergebnisansicht verwendet. Bei clickable=true liefert
// die Karte ein <button>-Element mit data-Attributen, das per Event-Delegation
// in einem Lightbox-Modal geöffnet werden kann.
export function stickerCardHtml(s, { showMeta = true, clickable = false } = {}) {
  const url = imageUrlFor({ image_path: s.image_path });
  const title = escapeHtml(s.title || "(ohne Titel)");
  const description = escapeHtml(s.description || "");
  const meta = showMeta ? `
    <h4>${title}${s.is_hidden ? '<span class="hidden-badge">versteckt</span>' : ""}</h4>
    <p>${description}</p>
    <small>${s.latitude?.toFixed?.(4) ?? "?"}, ${s.longitude?.toFixed?.(4) ?? "?"} – ${fmtDate(s.found_at)}${s.is_legacy ? " – Legacy" : ""}</small>
  ` : "";
  if (clickable) {
    return `
      <button type="button" class="sticker-card sticker-card-btn"
        data-sticker-url="${url}"
        data-sticker-title="${title}"
        data-sticker-description="${description}"
        data-sticker-meta="${s.latitude?.toFixed?.(4) ?? "?"}, ${s.longitude?.toFixed?.(4) ?? "?"} – ${fmtDate(s.found_at)}${s.is_legacy ? " – Legacy" : ""}">
        <img src="${url}" alt="" loading="lazy" />
        ${meta}
      </button>
    `;
  }
  return `
    <div class="sticker-card">
      <img src="${url}" alt="" loading="lazy" />
      ${meta}
    </div>
  `;
}
