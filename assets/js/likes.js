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

async function loadLike(id) {
  // Gesamtzahl der Likes (RLS: für alle sichtbar).
  const { count, error } = await supabase
    .from("sticker_likes")
    .select("*", { count: "exact", head: true })
    .eq("sticker_id", id);
  if (error) { console.warn("[likes]", error.message); return { count: 0, liked: false }; }

  const { data } = await supabase
    .from("sticker_likes")
    .select("sticker_id")
    .eq("sticker_id", id)
    .eq(me ? "user_id" : "guest_hash", me ? me.id : await getGuestHash())
    .maybeSingle();
  return { count: count ?? 0, liked: !!data };
}

async function render(id) {
  box.innerHTML = `<button class="like-btn" type="button" disabled>👍 …</button>`;
  await ensureAuth();
  const { count, liked } = await loadLike(id);
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
