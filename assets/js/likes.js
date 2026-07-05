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

async function loadLike(id) {
  // Gesamtzahl der Likes (RLS: für alle sichtbar).
  const { count, error } = await supabase
    .from("sticker_likes")
    .select("*", { count: "exact", head: true })
    .eq("sticker_id", id);
  if (error) { console.warn("[likes]", error.message); return { count: 0, liked: false }; }

  let liked = false;
  if (me) {
    const { data } = await supabase
      .from("sticker_likes")
      .select("sticker_id")
      .eq("sticker_id", id)
      .eq("user_id", me.id)
      .maybeSingle();
    liked = !!data;
  }
  return { count: count ?? 0, liked };
}

async function render(id) {
  box.innerHTML = `<button class="like-btn" type="button" disabled>🤍 …</button>`;
  await ensureAuth();
  const { count, liked } = await loadLike(id);
  if (id !== currentId) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "like-btn" + (liked ? " liked" : "");
  btn.innerHTML = `${liked ? "❤️" : "🤍"} <span class="like-count">${count}</span>`;
  btn.title = me ? (liked ? "Gefällt dir nicht mehr" : "Gefällt mir") : "Zum Liken einloggen";
  btn.addEventListener("click", () => toggle(id, liked));
  box.innerHTML = "";
  box.appendChild(btn);
}

async function toggle(id, liked) {
  if (!me) { window.location.href = "login"; return; }
  const query = liked
    ? supabase.from("sticker_likes").delete().eq("sticker_id", id).eq("user_id", me.id)
    : supabase.from("sticker_likes").insert({ sticker_id: id, user_id: me.id });
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
