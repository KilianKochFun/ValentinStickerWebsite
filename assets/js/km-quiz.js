// km-Quiz (Sudden Death, endlos): Für jeden Sticker die EXAKTE Luftlinie zur
// Aachener Mitte in km auf 2 Nachkommastellen eintippen. Genau richtig → weiter,
// Score +1. Ein Fehler → Runde vorbei. Score = richtige Tipps in Folge.
import { supabase, imageUrlFor } from "./supabase-client.js";
import { submitQuizRun, fetchTopScores, fetchUserBest } from "./quiz.js";
import { escapeHtml, haversineKm, isVideoPath } from "./sticker-view.js";
import { initPunchingBag } from "./punching-bag.js";

const AACHEN = [50.7763, 6.0836];
const DECIMALS = 2;

const SFX = {
  hit:       new Audio("sound/Hit.mp3"),
  lost:      new Audio("sound/Lost.mp3"),
  highscore: new Audio("sound/Highscore.mp3"),
};
function playSound(name) {
  try {
    const s = SFX[name];
    s.currentTime = 0;
    s.play().catch(() => {});
  } catch (_) {}
}

const el = (id) => document.getElementById(id);
let pool = [];
let current = null;
let lastId = null;
let score = 0;
let over = false;
let myBest = 0;
let pendingScore = 0; // Schläge-Budget für den Punching-Bag
let bag = null;

// Punching-Bag-DOM
const punchBtn  = el("kmPunchBtn");
const punchSec  = el("kmPunchSection");
const punchRem  = el("kmPunchRemaining");
const punchBack = el("kmPunchBack");
const bagCanvas = el("kmBagCanvas");

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
  pendingScore = 0;
  el("kmScore").textContent = "0";
  el("kmGameover").classList.remove("visible");
  if (punchSec) punchSec.classList.add("hidden");
  if (bag) bag.setPunches(0);
  el("kmPlay").style.display = "";
  showSticker();
}

async function refreshMine() {
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) { myBest = 0; el("kmMyBest").textContent = "0"; return; }
  const best = await fetchUserBest(user.id, "distance_km");
  myBest = best?.score ?? 0;
  el("kmMyBest").textContent = String(myBest);
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
  el("kmGoScore").textContent = String(score);
  el("kmGoReveal").innerHTML =
    `Dein Tipp: <strong>${guess.toFixed(DECIMALS)} km</strong> · richtig war: <strong>${actual.toFixed(DECIMALS)} km</strong>`;
  const isNewBest = score > 0 && score > myBest;
  el("kmGoBest").textContent = String(Math.max(myBest, score));

  // Punching-Bag: so viele Schläge wie Treffer.
  pendingScore = score;
  if (punchBtn) punchBtn.disabled = score === 0;
  if (bag) bag.setPunches(score);

  playSound(isNewBest ? "highscore" : "lost");

  const status = el("kmGoStatus");
  status.hidden = true;
  if (score > 0) {
    const res = await submitQuizRun("distance_km", score);
    if (res.saved) {
      myBest = Math.max(myBest, score);
      status.textContent = isNewBest ? "🎉 Neuer persönlicher Highscore gespeichert!" : "Score gespeichert ✔";
      status.hidden = false;
      el("kmMyBest").textContent = String(myBest);
      await refreshHs();
    } else if (res.reason === "guest") {
      status.innerHTML = 'Nicht gespeichert – <a href="login">einloggen</a> für den Highscore.';
      status.hidden = false;
    }
  } else {
    status.textContent = "0 Treffer – schaff mindestens einen für den Highscore. 😉";
    status.hidden = false;
  }

  el("kmGameover").classList.add("visible");
}

// ── Punching Bag ──────────────────────────────────────────
function updatePunchRemaining(n) {
  if (!punchRem) return;
  const remaining = typeof n === "number" ? n : bag?.getPunches() ?? 0;
  if (remaining > 0) {
    punchRem.textContent = `Noch ${remaining} Schlag${remaining !== 1 ? "e" : ""} übrig`;
    punchRem.style.color = "#555";
  } else {
    punchRem.textContent = "🎉 Alle Schläge verbraucht!";
    punchRem.style.color = "#2e7d32";
  }
}

function openPunchingBag() {
  if (pendingScore === 0) return;
  el("kmGameover").classList.remove("visible");
  punchSec.classList.remove("hidden");
  if (!bag) {
    bag = initPunchingBag({
      canvas: bagCanvas,
      initialPunches: pendingScore,
      onPunch: (remaining) => {
        updatePunchRemaining(remaining);
        pendingScore = remaining;
        if (remaining === 0 && punchBtn) punchBtn.disabled = true;
      },
      onEmpty: () => {
        updatePunchRemaining(0);
        if (punchBtn) punchBtn.disabled = true;
      },
    });
  }
  updatePunchRemaining(bag.getPunches());
  if (punchBtn && bag.getPunches() === 0) punchBtn.disabled = true;
}

function closePunchingBag() {
  punchSec.classList.add("hidden");
  el("kmGameover").classList.add("visible");
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
if (punchBtn)  punchBtn.addEventListener("click", openPunchingBag);
if (punchBack) punchBack.addEventListener("click", closePunchingBag);

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
