// km-Quiz (Sudden Death, endlos): Für jeden Sticker die EXAKTE Luftlinie zur
// Aachener Mitte in km auf 2 Nachkommastellen eintippen. Genau richtig → weiter,
// Score +1. Ein Fehler → Runde vorbei. Score = richtige Tipps in Folge.
import { supabase, imageUrlFor } from "./supabase-client.js";
import { submitQuizRun, fetchTopScores, fetchUserBest } from "./quiz.js";
import { escapeHtml, haversineKm, isVideoPath } from "./sticker-view.js";

const AACHEN = [50.7763, 6.0836];
const DECIMALS = 2;

const el = (id) => document.getElementById(id);
let pool = [];
let current = null;
let lastId = null;
let score = 0;
let over = false;

function finderName(s) {
  return s.profiles?.display_name || s.legacy_finder_name || "Anonym";
}

async function loadPool() {
  const { data } = await supabase
    .from("stickers")
    .select("id, title, image_path, latitude, longitude, legacy_finder_name, profiles:uploader_id(display_name)")
    .eq("is_hidden", false);
  pool = (data ?? []).filter(
    (s) => Number.isFinite(s.latitude) && Number.isFinite(s.longitude) && !isVideoPath(s.image_path)
  );
}

function pickSticker() {
  let s = pool[Math.floor(Math.random() * pool.length)];
  let guard = 0;
  while (pool.length > 1 && s.id === lastId && guard++ < 10) {
    s = pool[Math.floor(Math.random() * pool.length)];
  }
  lastId = s.id;
  return s;
}

function showSticker() {
  over = false;
  current = pickSticker();
  el("kmImage").src = imageUrlFor({ image_path: current.image_path });
  el("kmTitle").textContent = current.title || "(ohne Titel)";
  el("kmFinder").textContent = "gefunden von " + finderName(current);
  const input = el("kmInput");
  input.value = "";
  input.disabled = false;
  const fb = el("kmFeedback");
  fb.textContent = "";
  fb.className = "sq-toast";
  el("kmSubmit").classList.remove("hidden");
  el("kmNext").classList.add("hidden");
  input.focus();
}

function submitGuess() {
  if (over || el("kmInput").disabled) return;
  const raw = el("kmInput").value.trim().replace(",", ".");
  const guess = parseFloat(raw);
  if (!Number.isFinite(guess) || guess < 0) { el("kmInput").focus(); return; }
  const actual = haversineKm(AACHEN[0], AACHEN[1], current.latitude, current.longitude);
  const correct = guess.toFixed(DECIMALS) === actual.toFixed(DECIMALS);
  el("kmInput").disabled = true;
  el("kmSubmit").classList.add("hidden");
  if (correct) {
    score++;
    el("kmScore").textContent = String(score);
    const fb = el("kmFeedback");
    fb.innerHTML = `✅ Genau richtig: <strong>${actual.toFixed(DECIMALS)} km</strong>!`;
    fb.className = "sq-toast show ok";
    const next = el("kmNext");
    next.classList.remove("hidden");
    next.textContent = "Nächster Sticker →";
    next.focus();
  } else {
    gameOver(actual, guess);
  }
}

function next() {
  if (!over) showSticker();
}

function startGame() {
  score = 0;
  over = false;
  el("kmScore").textContent = "0";
  el("kmGameover").classList.remove("visible");
  el("kmPlay").style.display = "";
  showSticker();
}

async function refreshMine() {
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) { el("kmMyBest").textContent = "0"; return; }
  const best = await fetchUserBest(user.id, "distance_km");
  el("kmMyBest").textContent = String(best?.score ?? 0);
}

async function refreshHs() {
  const scores = await fetchTopScores("distance_km", 10);
  const medals = ["🥇", "🥈", "🥉"];
  const box = el("kmHsList");
  if (!scores.length) {
    box.innerHTML = '<div class="sq-hs-empty">Noch keine Einträge in dieser Runde.</div>';
    return;
  }
  box.innerHTML = scores.map((s, i) => {
    const date = new Date(s.played_at).toLocaleDateString("de-DE");
    return `<div class="sq-hs-entry">
      <span class="sq-hs-rank">${medals[i] || (i + 1) + "."}</span>
      <a class="sq-hs-name" href="profile?id=${encodeURIComponent(s.user_id)}">${escapeHtml(s.display_name)}</a>
      <span class="sq-hs-val" style="margin-left:auto;">${s.score}</span>
      <span class="sq-hs-date">${date}</span>
    </div>`;
  }).join("");
}

async function gameOver(actual, guess) {
  over = true;
  el("kmPlay").style.display = "none";
  el("kmGameover").classList.add("visible");
  el("kmGoScore").textContent = String(score);
  el("kmGoReveal").innerHTML =
    `Dein Tipp: <strong>${guess.toFixed(DECIMALS)} km</strong> · richtig war: <strong>${actual.toFixed(DECIMALS)} km</strong>`;
  const status = el("kmGoStatus");
  status.hidden = true;
  if (score > 0) {
    const res = await submitQuizRun("distance_km", score);
    if (res.saved) {
      status.textContent = "Im Highscore gespeichert ✔";
      status.hidden = false;
      await refreshMine();
      await refreshHs();
    } else if (res.reason === "guest") {
      status.innerHTML = 'Nicht gespeichert – <a href="login">einloggen</a> für den Highscore.';
      status.hidden = false;
    }
  } else {
    status.textContent = "0 Treffer – schaff mindestens einen für den Highscore. 😉";
    status.hidden = false;
  }
  el("kmGoBest").textContent = el("kmMyBest").textContent;
}

// ── Events ────────────────────────────────────────────────
el("kmSubmit").addEventListener("click", submitGuess);
el("kmNext").addEventListener("click", next);
el("kmRestart").addEventListener("click", startGame);
el("kmInput").addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  if (el("kmInput").disabled) next(); else submitGuess();
});

// ── Init ──────────────────────────────────────────────────
await loadPool();
await refreshMine();
await refreshHs();
if (pool.length < 1) {
  el("kmPlay").innerHTML =
    '<p style="text-align:center;color:#555;">Noch keine Sticker mit Koordinaten für dieses Quiz.</p>';
} else {
  startGame();
}
