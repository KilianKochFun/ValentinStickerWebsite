// Likes/Reaktionen pro Sticker – im Vollbild-Modal auf der Startseite.
// Backend: Tabelle `sticker_likes` (siehe Migration 0006_likes.sql).
// Solange die Migration nicht eingespielt ist, schlagen die Abfragen still
// fehl und der Button zeigt einfach 0 – die restliche Seite bleibt heil.
import { supabase, currentUser } from "./supabase-client.js";

const box = document.getElementById("modalLikes");

let me = null;
let authReady = null;
let currentId = null;

function ensureAuth() {
  if (!authReady) authReady = (async () => { me = await currentUser(); })();
  return authReady;
}

// Gäste (ohne Login): zufälliges Geheimnis pro Browser. In der DB liegt nur
// dessen SHA-256 (guest_hash), Setzen/Entfernen läuft über die RPC guest_like_set.
let guestSecret = null;
let guestHash = null;

function hasGuestSecret() {
  if (guestSecret) return true;
  try { return !!localStorage.getItem("guestLikeSecret"); } catch (_) { return false; }
}

function getGuestSecret() {
  if (guestSecret) return guestSecret;
  const key = "guestLikeSecret";
  try { guestSecret = localStorage.getItem(key); } catch (_) {}
  if (!guestSecret) {
    guestSecret = crypto.randomUUID() + crypto.randomUUID();
    try { localStorage.setItem(key, guestSecret); } catch (_) {}
  }
  return guestSecret;
}

async function getGuestHash() {
  if (!guestHash) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(getGuestSecret()));
    guestHash = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return guestHash;
}

// Eigene Likes zusätzlich im localStorage merken (Liste der Sticker-IDs): Der
// Like-Status steht beim Öffnen sofort da, und die Galerie markiert eigene Likes
// (script.js liest denselben Key). Die DB bleibt maßgeblich und gleicht die Liste ab.
const LIKED_KEY = "likedStickers";

function readLiked() {
  try { return new Set(JSON.parse(localStorage.getItem(LIKED_KEY) || "[]")); } catch (_) { return new Set(); }
}

function writeLiked(set) {
  try {
    if (set.size) localStorage.setItem(LIKED_KEY, JSON.stringify([...set]));
    else localStorage.removeItem(LIKED_KEY);
  } catch (_) {}
  document.dispatchEvent(new CustomEvent("likes:mine"));
}

function rememberLike(id, liked) {
  const set = readLiked();
  if (liked === set.has(id)) return;
  if (liked) set.add(id); else set.delete(id);
  writeLiked(set);
}

// Beim Laden einmal alle eigenen Likes aus der DB holen und die Liste abgleichen.
// Gäste ohne Kennung haben noch nie geliked – dann nichts anlegen.
async function syncMyLikes() {
  await ensureAuth();
  if (!me && !hasGuestSecret()) { writeLiked(new Set()); return; }
  const { data, error } = await supabase
    .from("sticker_likes")
    .select("sticker_id")
    .eq(me ? "user_id" : "guest_hash", me ? me.id : await getGuestHash());
  if (error) { console.warn("[likes]", error.message); return; }
  writeLiked(new Set(data.map((r) => r.sticker_id)));
}
syncMyLikes();

async function loadLike(id) {
  // Gesamtzahl der Likes (RLS: für alle sichtbar).
  const { count, error } = await supabase
    .from("sticker_likes")
    .select("*", { count: "exact", head: true })
    .eq("sticker_id", id);
  if (error) { console.warn("[likes]", error.message); return { count: 0, liked: false }; }

  if (!me && !hasGuestSecret()) return { count: count ?? 0, liked: false };
  const { data } = await supabase
    .from("sticker_likes")
    .select("sticker_id")
    .eq("sticker_id", id)
    .eq(me ? "user_id" : "guest_hash", me ? me.id : await getGuestHash())
    .maybeSingle();
  return { count: count ?? 0, liked: !!data };
}

async function render(id) {
  // Sofort den lokal gemerkten Status zeigen, bis die DB geantwortet hat.
  const cached = readLiked().has(id);
  box.innerHTML = `<button class="like-btn${cached ? " liked" : ""}" type="button" disabled>👍 …</button>`;
  await ensureAuth();
  const { count, liked } = await loadLike(id);
  rememberLike(id, liked);
  if (id !== currentId) return;

  // Galerie-Karten-Zähler aktuell halten (script.js hört darauf).
  document.dispatchEvent(new CustomEvent("like:changed", { detail: { id, count } }));

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "like-btn" + (liked ? " liked" : "");
  btn.innerHTML = `👍 <span class="like-label">Like</span> <span class="like-count">${count}</span>`;
  btn.title = liked ? "Gefällt dir nicht mehr" : "Gefällt mir";
  btn.addEventListener("click", () => toggle(id, liked));
  box.innerHTML = "";
  box.appendChild(btn);
}

async function toggle(id, liked) {
  let query;
  if (!me) query = supabase.rpc("guest_like_set", { p_sticker_id: id, p_secret: getGuestSecret(), p_like: !liked });
  else if (liked) query = supabase.from("sticker_likes").delete().eq("sticker_id", id).eq("user_id", me.id);
  else query = supabase.from("sticker_likes").insert({ sticker_id: id, user_id: me.id });
  const { error } = await query;
  if (error) { alert("Aktion fehlgeschlagen: " + error.message); return; }
  rememberLike(id, !liked);
  if (id === currentId) render(id);
}

document.addEventListener("sticker:open", (e) => {
  currentId = e.detail?.id ?? null;
  if (currentId) render(currentId);
  else box.innerHTML = "";
});

document.addEventListener("sticker:close", () => {
  currentId = null;
  box.innerHTML = "";
});
