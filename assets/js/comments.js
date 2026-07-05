// Kommentare pro Sticker – angezeigt im Vollbild-Modal auf der Startseite.
// Das Backend (Tabelle `comments` + RLS) existiert bereits in Supabase;
// hier ist ausschließlich die Oberfläche.
//
// Ablauf: script.js feuert beim Öffnen des Modals ein `sticker:open`-Event
// (mit der Sticker-id im detail) und beim Schließen ein `sticker:close`-Event.
import { supabase, currentUser, currentProfile } from "./supabase-client.js";

const box = document.getElementById("modalComments");

let me = null;         // Auth-User oder null
let myProfile = null;  // Profil (für is_admin) oder null
let authReady = null;  // Promise – Auth nur einmal laden
let currentStickerId = null;

function ensureAuth() {
  if (!authReady) {
    authReady = (async () => {
      me = await currentUser();
      myProfile = me ? await currentProfile() : null;
    })();
  }
  return authReady;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
}

async function loadComments(stickerId) {
  const { data, error } = await supabase
    .from("comments")
    .select("id, body, created_at, author_id, profiles:author_id(display_name)")
    .eq("sticker_id", stickerId)
    .eq("is_hidden", false)
    .order("created_at", { ascending: true });
  if (error) { console.error("[comments]", error); return null; }
  return data ?? [];
}

function commentItemHtml(c) {
  const name = c.profiles?.display_name || "Anonym";
  const canDelete = me && (c.author_id === me.id || myProfile?.is_admin);
  return `
    <li class="comment-item">
      <div class="comment-head">
        <span class="comment-author">${escapeHtml(name)}</span>
        <span class="comment-date">${fmtDate(c.created_at)}</span>
        ${canDelete ? `<button type="button" class="comment-delete" data-id="${c.id}" title="Kommentar löschen" aria-label="Kommentar löschen">🗑️</button>` : ""}
      </div>
      <p class="comment-body">${escapeHtml(c.body)}</p>
    </li>
  `;
}

async function render(stickerId) {
  box.hidden = false;
  box.innerHTML = `<h3 class="comments-title">💬 Kommentare</h3><p class="comments-loading">Lade…</p>`;

  await ensureAuth();
  const comments = await loadComments(stickerId);

  // Falls zwischenzeitlich ein anderer Sticker geöffnet (oder geschlossen) wurde: abbrechen.
  if (stickerId !== currentStickerId) return;

  if (comments === null) {
    box.innerHTML = `<h3 class="comments-title">💬 Kommentare</h3>
      <p class="comments-empty">Kommentare konnten nicht geladen werden.</p>`;
    return;
  }

  // Galerie-/Karten-Zähler aktuell halten.
  document.dispatchEvent(new CustomEvent("comment:changed", { detail: { id: stickerId, count: comments.length } }));

  const listHtml = comments.length
    ? `<ul class="comments-list">${comments.map(commentItemHtml).join("")}</ul>`
    : `<p class="comments-empty">Noch keine Kommentare – schreib den ersten!</p>`;

  const formHtml = me
    ? `
      <form class="comment-form">
        <textarea name="body" rows="2" maxlength="1000" required placeholder="Kommentar schreiben…"></textarea>
        <button type="submit">Absenden</button>
        <p class="comment-error" hidden></p>
      </form>`
    : `<p class="comments-login"><a href="login">Einloggen</a>, um zu kommentieren.</p>`;

  box.innerHTML = `
    <h3 class="comments-title">💬 Kommentare (${comments.length})</h3>
    ${listHtml}
    ${formHtml}
  `;

  box.querySelectorAll(".comment-delete").forEach((btn) => {
    btn.addEventListener("click", () => deleteComment(btn.dataset.id, stickerId));
  });

  const form = box.querySelector(".comment-form");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errEl = form.querySelector(".comment-error");
      errEl.hidden = true;
      const body = form.body.value.trim();
      if (!body) return;
      const submitBtn = form.querySelector("button");
      submitBtn.disabled = true;
      const { error } = await supabase.from("comments").insert({
        sticker_id: stickerId,
        author_id: me.id,
        body,
      });
      submitBtn.disabled = false;
      if (error) {
        errEl.textContent = "Konnte nicht gesendet werden: " + error.message;
        errEl.hidden = false;
        return;
      }
      form.body.value = "";
      if (stickerId === currentStickerId) render(stickerId);
    });
  }
}

async function deleteComment(id, stickerId) {
  if (!confirm("Kommentar wirklich löschen?")) return;
  const { error } = await supabase.from("comments").delete().eq("id", id);
  if (error) { alert("Löschen fehlgeschlagen: " + error.message); return; }
  if (stickerId === currentStickerId) render(stickerId);
}

document.addEventListener("sticker:open", (e) => {
  const id = e.detail?.id ?? null;
  currentStickerId = id;
  if (!id) {
    box.hidden = true;
    box.innerHTML = "";
    return;
  }
  render(id);
});

document.addEventListener("sticker:close", () => {
  currentStickerId = null;
  box.hidden = true;
  box.innerHTML = "";
});
