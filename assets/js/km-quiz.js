// km-Quiz: Für 5 zufällige Sticker die Luftlinie zur Aachener Mitte in km schätzen.
// Punkte pro Sticker je näher an der echten Entfernung (max. 100), Summe = Score.
import { supabase, imageUrlFor } from "./supabase-client.js";
import { submitQuizRun, fetchTopScores, fetchUserBest } from "./quiz.js";
import { escapeHtml, haversineKm, fmtDistanceKm, isVideoPath } from "./sticker-view.js";

const AACHEN = [50.7763, 6.0836];
const ROUNDS = 5;

const el = (id) => document.getElementById(id);
let pool = [];
let picks = [];
let idx = 0;
let score = 0;
let answered = false;

function finderName(s) {
  return s.profiles?.display_name || s.legacy_finder_name || "Anonym";
}

function shuffle(a) {
  const arr = a.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
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

function scoreGuess(guess, actual) {
  const err = Math.abs(guess - actual);
  const rel = err / Math.max(actual, 5); // kleine Distanzen etwas gnädiger
  return Math.max(0, Math.round(100 * (1 - rel)));
}

function showRound() {
  answered = false;
  const s = picks[idx];
  el("kmRound").textContent = `Sticker ${idx + 1} / ${picks.length}`;
  el("kmImage").src = imageUrlFor({ image_path: s.image_path });
  el("kmTitle").textContent = s.title || "(ohne Titel)";
  el("kmFinder").textContent = "gefunden von " + finderName(s);
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
  if (answered) return;
  const guess = parseFloat(el("kmInput").value);
  if (!Number.isFinite(guess) || guess < 0) { el("kmInput").focus(); return; }
  answered = true;
  const s = picks[idx];
  const actual = haversineKm(AACHEN[0], AACHEN[1], s.latitude, s.longitude);
  const pts = scoreGuess(guess, actual);
  score += pts;
  el("kmScore").textContent = String(score);
  el("kmInput").disabled = true;
  el("kmSubmit").classList.add("hidden");
  const fb = el("kmFeedback");
  fb.innerHTML = `Echt: <strong>${fmtDistanceKm(actual)}</strong> · dein Tipp: ${fmtDistanceKm(guess)} → <strong>+${pts}</strong> Punkte`;
  fb.className = "sq-toast show " + (pts >= 50 ? "ok" : "bad");
  const next = el("kmNext");
  next.classList.remove("hidden");
  next.textContent = idx + 1 >= picks.length ? "Ergebnis →" : "Weiter →";
  next.focus();
}

function next() {
  idx++;
  if (idx >= picks.length) { gameOver(); return; }
  showRound();
}

function startGame() {
  picks = shuffle(pool).slice(0, ROUNDS);
  idx = 0; score = 0; answered = false;
  el("kmScore").textContent = "0";
  el("kmGameover").classList.remove("visible");
  el("kmPlay").style.display = "";
  showRound();
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
    box.innerHTML = '<div class="sq-hs-empty">Noch keine Einträge in Runde 2.</div>';
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

async function gameOver() {
  el("kmPlay").style.display = "none";
  el("kmGameover").classList.add("visible");
  el("kmGoScore").textContent = String(score);
  const status = el("kmGoStatus");
  status.hidden = true;
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
  el("kmGoBest").textContent = el("kmMyBest").textContent;
}

// ── Events ────────────────────────────────────────────────
el("kmSubmit").addEventListener("click", submitGuess);
el("kmNext").addEventListener("click", next);
el("kmRestart").addEventListener("click", startGame);
el("kmInput").addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  if (answered) next(); else submitGuess();
});

// ── Init ──────────────────────────────────────────────────
await loadPool();
await refreshMine();
await refreshHs();
if (pool.length < ROUNDS) {
  el("kmPlay").innerHTML =
    `<p style="text-align:center;color:#555;">Noch nicht genug Sticker mit Koordinaten für dieses Quiz (mind. ${ROUNDS} nötig).</p>`;
} else {
  startGame();
}
