// Gemeinsame Logik für Beschreibungs- und Titel-Quiz.
// Jede Runde: eine Hinweis-Karte (Titel ODER Beschreibung) + 3 Sticker-Bilder.
// Klick auf das richtige Sticker-Bild → Punkt. Erster Fehler = Game Over.
//
// Erwartet window.QUIZ_MODE ∈ {"description","title"} (gesetzt in der HTML-Seite
// vor dem Script-Import).

import { supabase, imageUrlFor, currentProfile } from "./supabase-client.js";
import { submitQuizRun, fetchTopScores, fetchUserBest } from "./quiz.js";
import { escapeHtml } from "./sticker-view.js";
import { initPunchingBag } from "./punching-bag.js";

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

const MODE = window.QUIZ_MODE;
if (MODE !== "description" && MODE !== "title") {
  throw new Error("QUIZ_MODE muss 'description' oder 'title' sein.");
}

const CLUE_FIELD = MODE === "description" ? "description" : "title";
const MIN_LEN = MODE === "description" ? 20 : 3;

// ── State ─────────────────────────────────────────────────
let pool = [];
let streak = 0;
let locked = false;
let current = null;  // { correct, options: [sticker,sticker,sticker], idx }
let profile = null;
let topScores = [];
let myBest = 0;
let runSubmitted = false;

// ── DOM ───────────────────────────────────────────────────
const optionsEl = document.getElementById("gqOptions");
const clueEl    = document.getElementById("gqClue");
const clueText  = document.getElementById("gqClueText");
const scoreEl   = document.getElementById("gqScore");
const myBestEl  = document.getElementById("gqMyBest");
const toastEl   = document.getElementById("gqToast");
const nextBtn   = document.getElementById("gqNextBtn");
const goBox     = document.getElementById("gqGameover");
const goScore   = document.getElementById("gqGoScore");
const goBest    = document.getElementById("gqGoBest");
const goStatus  = document.getElementById("gqGoStatus");
const restartBtn= document.getElementById("gqRestartBtn");
const hsList    = document.getElementById("gqHsList");
const punchBtn  = document.getElementById("gqPunchBtn");
const punchSec  = document.getElementById("gqPunchSection");
const punchRem  = document.getElementById("gqPunchRemaining");
const punchBack = document.getElementById("gqPunchBack");
const bagCanvas = document.getElementById("gqBagCanvas");
const autoNextEl = document.getElementById("gqAutoNext");
let bag = null;
let pendingScore = 0;

// ── Helpers ───────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function toast(msg, type) {
  toastEl.textContent = msg;
  toastEl.className = "sq-toast " + type + " show";
  setTimeout(() => toastEl.classList.remove("show"), 1400);
}

function renderRound() {
  const clue = current.correct[CLUE_FIELD] ?? "";
  clueEl.className = "gq-clue " + MODE;
  clueText.textContent = clue;

  optionsEl.innerHTML = "";
  current.options.forEach((sticker, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "gq-option";
    btn.innerHTML = `<img src="${imageUrlFor({ image_path: sticker.image_path })}" alt="" loading="lazy" />`;
    btn.addEventListener("click", () => pick(i));
    optionsEl.appendChild(btn);
  });
}

function pick(i) {
  if (locked) return;
  locked = true;
  const buttons = optionsEl.querySelectorAll(".gq-option");
  buttons.forEach((b) => b.classList.add("disabled"));
  const correct = current.correctIndex;
  if (i === correct) {
    buttons[i].classList.add("correct");
    streak++;
    scoreEl.textContent = streak;
    toast("✅ Richtig!", "ok");
    if (autoNextEl?.checked) {
      setTimeout(nextRound, 700);
    } else {
      nextBtn.classList.remove("hidden");
    }
  } else {
    buttons[i].classList.add("wrong");
    buttons[correct].classList.add("correct");
    toast("❌ Falsch!", "bad");
    setTimeout(gameOver, 900);
  }
}

function nextRound() {
  if (pool.length < 3) { gameOver(); return; }
  // Wahl: ein zufälliger "richtiger" Sticker, zwei andere als Distraktoren.
  const correct = pool[Math.floor(Math.random() * pool.length)];
  const distractors = shuffle(pool.filter((s) => s.id !== correct.id)).slice(0, 2);
  const options = shuffle([correct, ...distractors]);
  const correctIndex = options.findIndex((s) => s.id === correct.id);
  current = { correct, options, correctIndex };
  locked = false;
  nextBtn.classList.add("hidden");
  renderRound();
}

async function gameOver() {
  locked = true;
  document.getElementById("gqPlayArea").style.display = "none";
  pendingScore = streak;
  goScore.textContent = streak;
  const best = Math.max(myBest, streak);
  goBest.textContent = best;
  const isNewBest = streak > 0 && streak > myBest;
  if (punchBtn) punchBtn.disabled = streak === 0;
  // Neues Schläge-Budget in den Bag laden (falls er schon existiert).
  // Beim allerersten Öffnen übernimmt initPunchingBag das über initialPunches.
  if (bag) bag.setPunches(streak);
  if (isNewBest) playSound("highscore");
  else playSound("lost");

  goStatus.hidden = true;
  goStatus.className = "sq-save-status";

  if (!profile) {
    goStatus.innerHTML =
      'Score nicht gespeichert – <a href="login">einloggen</a>, um in die Highscore-Liste zu kommen.';
    goStatus.hidden = false;
  } else if (streak > 0 && !runSubmitted) {
    const res = await submitQuizRun(MODE, streak);
    runSubmitted = true;
    if (res.saved) {
      myBest = Math.max(myBest, streak);
      goStatus.textContent = isNewBest
        ? "🎉 Neuer persönlicher Highscore gespeichert!"
        : "Score gespeichert.";
      goStatus.classList.add("ok");
      goStatus.hidden = false;
    } else {
      goStatus.textContent = "Speichern fehlgeschlagen: " + (res.reason || "unbekannt");
      goStatus.classList.add("err");
      goStatus.hidden = false;
    }
  }

  goBox.classList.add("visible");
  await refreshHighscores();
}

async function refreshHighscores() {
  topScores = await fetchTopScores(MODE, 10);
  const medals = ["🥇","🥈","🥉"];
  if (!topScores.length) {
    hsList.innerHTML = '<div class="sq-hs-empty">Noch kein Highscore – spiel los!</div>';
    return;
  }
  hsList.innerHTML = topScores.map((h, i) => {
    const date = new Date(h.played_at).toLocaleDateString("de-DE");
    return `
      <div class="sq-hs-entry">
        <span class="sq-hs-rank">${medals[i] || (i+1)+'.'}</span>
        <a class="sq-hs-name" href="profile?id=${encodeURIComponent(h.user_id)}">${escapeHtml(h.display_name)}</a>
        <span class="sq-hs-val" style="margin-left:auto;">${h.score}</span>
        <span class="sq-hs-date">${date}</span>
      </div>
    `;
  }).join("");
}

function restart() {
  streak = 0;
  runSubmitted = false;
  pendingScore = 0;
  scoreEl.textContent = "0";
  goBox.classList.remove("visible");
  if (punchSec) punchSec.classList.add("hidden");
  // Bag auf 0 stellen; frisches Schläge-Budget kommt erst nach dem nächsten
  // gameOver() per bag.setPunches(pendingScore).
  if (bag) bag.setPunches(0);
  document.getElementById("gqPlayArea").style.display = "block";
  nextRound();
}

function openPunchingBag() {
  if (pendingScore === 0) return;
  goBox.classList.remove("visible");
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
  // Beim erneuten Öffnen: nicht zurücksetzen, sondern mit Rest weitermachen.
  // Der Bag hält seinen internen Zähler ohnehin – wir synchronisieren nur.
  updatePunchRemaining(bag.getPunches());
  if (punchBtn && bag.getPunches() === 0) punchBtn.disabled = true;
}

function closePunchingBag() {
  punchSec.classList.add("hidden");
  goBox.classList.add("visible");
}

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

// ── Boot ──────────────────────────────────────────────────
async function boot() {
  // Alle sichtbaren Sticker mit nicht-leerem clue-Feld laden.
  const { data, error } = await supabase
    .from("stickers")
    .select("id, title, description, image_path, latitude, longitude, found_at, is_legacy")
    .eq("is_hidden", false)
    .not(CLUE_FIELD, "is", null);
  if (error) {
    clueText.textContent = "Konnte Sticker nicht laden. Bitte Seite neu laden.";
    return;
  }
  pool = (data ?? []).filter((s) => (s[CLUE_FIELD] ?? "").trim().length >= MIN_LEN);
  if (pool.length < 3) {
    clueText.textContent = `Zu wenig Sticker mit ${MODE === "description" ? "Beschreibung" : "Titel"} im Pool (min. 3 nötig).`;
    return;
  }

  profile = await currentProfile();
  if (profile) {
    const best = await fetchUserBest(profile.id, MODE);
    if (best?.score) myBest = best.score;
    myBestEl.textContent = myBest;
  } else {
    myBestEl.textContent = "–";
  }

  nextBtn.addEventListener("click", nextRound);
  restartBtn.addEventListener("click", restart);
  if (punchBtn)  punchBtn.addEventListener("click", openPunchingBag);
  if (punchBack) punchBack.addEventListener("click", closePunchingBag);
  await refreshHighscores();
  nextRound();
}
boot();
