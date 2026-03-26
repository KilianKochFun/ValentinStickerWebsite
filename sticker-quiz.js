/* ============================================================
   Sticker-Quiz – sticker-quiz.js
   Welcher Sticker ist weiter von Aachen entfernt?
   ============================================================ */

// Aachen Mitte (Elisenbrunnen)
const AACHEN = [50.7753, 6.0839];

// ── Haversine distance in km ──────────────────────────────
function haversine([lat1, lon1], [lat2, lon2]) {
  const R  = 6371;
  const dL = (lat2 - lat1) * Math.PI / 180;
  const dN = (lon2 - lon1) * Math.PI / 180;
  const a  = Math.sin(dL/2)**2 +
             Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dN/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Pre-compute distances once
const stickerData = locations.map(loc => ({
  ...loc,
  dist: haversine(AACHEN, loc.position)
}));

// ── State ─────────────────────────────────────────────────
let streak   = 0;
let pairA    = null;
let pairB    = null;
let locked   = false;

// ── localStorage helpers ──────────────────────────────────
function getHighscores() {
  try { return JSON.parse(localStorage.getItem('sqHighscores') || '[]'); } catch { return []; }
}
function saveHighscore(n) {
  let hs = getHighscores();
  hs.push({ score: n, date: new Date().toLocaleDateString('de-DE') });
  hs.sort((a, b) => b.score - a.score);
  localStorage.setItem('sqHighscores', JSON.stringify(hs.slice(0, 10)));
  return hs;
}
function getBest() {
  const hs = getHighscores();
  return hs.length ? hs[0].score : 0;
}

// ── Pick a random pair (never identical) ─────────────────
function randomPair() {
  const pool = [...stickerData];
  const i    = Math.floor(Math.random() * pool.length);
  let j;
  do { j = Math.floor(Math.random() * pool.length); } while (j === i);
  return [pool[i], pool[j]];
}

// ── Render cards ──────────────────────────────────────────
function renderCards(a, b) {
  ['A','B'].forEach((c, idx) => {
    const s = idx === 0 ? a : b;
    document.getElementById('sqImg' + c).src = s.image;
    document.getElementById('sqImg' + c).alt = s.title;
    const dist = document.getElementById('sqDist' + c);
    dist.textContent = '';
    dist.classList.remove('show');
    document.getElementById('sqCard' + c).className = 'sq-card';
  });
}

// ── Show toast message ────────────────────────────────────
function toast(msg, type) {
  const el = document.getElementById('sqToast');
  el.textContent = msg;
  el.className = 'sq-toast ' + type + ' show';
  setTimeout(() => el.classList.remove('show'), 1800);
}

// ── Reveal distances on both cards ────────────────────────
function revealDistances() {
  ['A','B'].forEach((c, i) => {
    const s = i === 0 ? pairA : pairB;
    const el = document.getElementById('sqDist' + c);
    el.textContent = Math.round(s.dist) + ' km von Aachen';
    el.classList.add('show');
  });
}

// ── Update sticker-dot points display ─────────────────────
const MAX_DOTS = 15;
function updateDots() {
  const container = document.getElementById('sqDots');
  container.innerHTML = '';
  const show = Math.min(streak, MAX_DOTS);
  for (let i = 0; i < show; i++) {
    const img = document.createElement('img');
    img.src = 'img/valentinSticker.webp';
    img.alt = 'Sticker';
    img.className = 'sq-sticker-dot';
    container.appendChild(img);
    // staggered pop-in
    setTimeout(() => img.classList.add('visible'), i * 30);
  }
  if (streak > MAX_DOTS) {
    const span = document.createElement('span');
    span.className = 'sq-dot-overflow';
    span.textContent = '+' + (streak - MAX_DOTS);
    container.appendChild(span);
  }
}

// ── Handle pick ───────────────────────────────────────────
function pick(idx) {    // 0 = A, 1 = B
  if (locked) return;
  locked = true;

  const chosen = idx === 0 ? pairA : pairB;
  const other  = idx === 0 ? pairB : pairA;
  const chosenCard = idx === 0 ? 'sqCardA' : 'sqCardB';
  const otherCard  = idx === 0 ? 'sqCardB' : 'sqCardA';

  document.getElementById('sqCardA').classList.add('disabled');
  document.getElementById('sqCardB').classList.add('disabled');

  revealDistances();

  if (chosen.dist > other.dist) {
    // ✅ Correct
    streak++;
    updateDots();
    document.getElementById('sqCard' + (idx === 0 ? 'A' : 'B')).classList.add('correct');
    toast('✅ Richtig!', 'ok');

    // short confetti burst
    launchConfetti(8);
    showNextBtn(false);

  } else {
    // ❌ Wrong
    document.getElementById('sqCard' + (idx === 0 ? 'A' : 'B')).classList.add('wrong');
    document.getElementById('sqCard' + (idx === 0 ? 'B' : 'A')).classList.add('correct');
    toast('❌ Falsch!', 'bad');
    showNextBtn(true);
  }
}

// ── Show/hide Weiter button ────────────────────────────────
let pendingGameOver = false;
function showNextBtn(isGameOver) {
  pendingGameOver = isGameOver;
  const auto = document.getElementById('sqAutoNext').checked;
  if (auto) {
    setTimeout(() => nextRound(), 2000);
  } else {
    document.getElementById('sqNextBtn').classList.remove('hidden');
  }
}

function nextRound() {
  document.getElementById('sqNextBtn').classList.add('hidden');
  if (pendingGameOver) {
    gameOver();
  } else {
    [pairA, pairB] = randomPair();
    renderCards(pairA, pairB);
    locked = false;
  }
}

// ── Game Over ─────────────────────────────────────────────
function gameOver() {
  // Hide game UI
  document.getElementById('sqCards').style.display    = 'none';
  document.getElementById('sqQuestion').style.display = 'none';
  document.getElementById('sqStreakBar').style.display = 'none';

  const hs        = saveHighscore(streak);
  const best      = hs[0].score;
  const isNewBest = hs.filter(h => h.score === streak).length === 1 && streak === best && streak > 0;

  document.getElementById('sqGoStreak').textContent = streak;
  document.getElementById('sqGoBest').textContent   = best;

  let emoji = '😵', title = 'Game Over!', sub = '';
  if (streak === 0) {
    emoji = '😬'; title = 'Direkt falsch!'; sub = 'Nicht aufgeben – nochmal!';
  } else if (streak < 5) {
    emoji = '😅'; sub = 'Schon ganz gut!';
  } else if (streak < 10) {
    emoji = '👍'; sub = 'Starke Leistung!';
  } else if (streak < 20) {
    emoji = '🔥'; sub = 'Bist du etwa Geograf?!';
  } else {
    emoji = '🧠'; sub = 'Absolutes Geografie-Genie!';
  }

  document.getElementById('sqGoEmoji').textContent = emoji;
  document.getElementById('sqGoTitle').textContent = title;
  document.getElementById('sqGoSub').textContent   = sub;

  // Sticker icons representing collected points
  const goStickers = document.getElementById('sqGoStickers');
  goStickers.innerHTML = '';
  const showCount = Math.min(streak, 20);
  for (let i = 0; i < showCount; i++) {
    const img = document.createElement('img');
    img.src = 'img/valentinSticker.webp';
    img.alt = 'Sticker';
    goStickers.appendChild(img);
  }
  if (streak > 20) {
    const span = document.createElement('span');
    span.style.cssText = 'font-weight:bold;color:var(--color-primary);font-size:1rem;align-self:center';
    span.textContent = '+' + (streak - 20);
    goStickers.appendChild(span);
  }

  if (isNewBest) document.getElementById('sqNewHs').style.display = 'inline-block';
  else document.getElementById('sqNewHs').style.display = 'none';

  document.getElementById('sqGameover').classList.add('visible');
  renderHighscoreList();
}

// ── Start / Restart ───────────────────────────────────────
function startGame() {
  streak = 0;
  locked = false;

  document.getElementById('sqGameover').classList.remove('visible');
  document.getElementById('sqNextBtn').classList.add('hidden');
  document.getElementById('sqCards').style.display    = 'grid';
  document.getElementById('sqQuestion').style.display = 'block';
  document.getElementById('sqStreakBar').style.display = 'flex';

  document.getElementById('sqHsDisplay').textContent = getBest();
  document.getElementById('sqToast').className       = 'sq-toast';
  updateDots();

  [pairA, pairB] = randomPair();
  renderCards(pairA, pairB);
  renderHighscoreList();
}

// ── Highscore list ────────────────────────────────────────
function renderHighscoreList() {
  const hs  = getHighscores();
  const el  = document.getElementById('sqHsList');
  const medals = ['🥇','🥈','🥉'];

  if (hs.length === 0) {
    el.innerHTML = '<div class="sq-hs-empty">Noch kein Highscore – spiel los!</div>';
    return;
  }
  el.innerHTML = hs.map((h, i) => {
    const dotCount = Math.min(h.score, 10);
    const dots     = '<img src="img/valentinSticker.webp" alt="s">'.repeat(dotCount);
    const overflow = h.score > 10 ? `<span class="sq-hs-val" style="font-size:0.8rem">+${h.score-10}</span>` : '';
    return `
      <div class="sq-hs-entry">
        <span class="sq-hs-rank">${medals[i] || (i+1) + '.'}</span>
        <div class="sq-hs-icons">${dots}${overflow}</div>
        <span class="sq-hs-val">${h.score}</span>
        <span class="sq-hs-date">${h.date}</span>
      </div>
    `;
  }).join('');
}

// ── Tiny confetti ──────────────────────────────────────────
(function setupConfetti() {
  const canvas  = document.getElementById('sq-confetti');
  const ctx     = canvas.getContext('2d');
  let particles = [];
  let raf       = null;

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  const stickerImg = new Image();
  stickerImg.src = 'img/valentinSticker.webp';

  function spawnParticles(n) {
    for (let i = 0; i < n; i++) {
      const size = Math.random() * 28 + 18;
      particles.push({
        x:    Math.random() * canvas.width,
        y:    -size,
        vx:   (Math.random() - 0.5) * 5,
        vy:   Math.random() * 3 + 2,
        size: size,
        rot:  Math.random() * 360,
        rv:   (Math.random() - 0.5) * 6,
        life: 1
      });
    }
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles = particles.filter(p => p.life > 0.01);
    particles.forEach(p => {
      p.x   += p.vx;
      p.y   += p.vy;
      p.rot += p.rv;
      p.vy  += 0.1;
      p.life -= 0.013;
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.drawImage(stickerImg, -p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    });
    if (particles.length) raf = requestAnimationFrame(animate);
    else { cancelAnimationFrame(raf); ctx.clearRect(0, 0, canvas.width, canvas.height); }
  }

  window.launchConfetti = function(n) {
    spawnParticles(n * 8);
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(animate);
  };
})();

// ── Hamburger ─────────────────────────────────────────────
document.getElementById('hamburgerBtn').addEventListener('click', () => {
  const m = document.getElementById('mobileMenu');
  m.classList.toggle('hidden');
  m.classList.toggle('visible');
});

// ── Init ──────────────────────────────────────────────────
startGame();
