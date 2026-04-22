// Wiederverwendbarer 3D-Punching-Bag. Die Logik stammt aus sticker-quiz.js
// und ist hier als ES-Modul verpackt, damit andere Quizze sie mit-benutzen
// können. Gibt punch() zurück, um den aktuellen "verfügbaren Schläge"-Wert
// extern nachzusetzen (z. B. bei Neustart).
//
// Verwendung:
//   const bag = initPunchingBag({ canvas, onPunch, onEmpty, initialPunches });
//   bag.setPunches(score);  // bei neuem Spiel
//
// onPunch(remaining) wird nach jedem Schlag gefeuert, onEmpty() einmal bei 0.

const HIT_SFX_URL = "sound/Hit.mp3";

let sharedHitAudio = null;
function playHit() {
  try {
    if (!sharedHitAudio) sharedHitAudio = new Audio(HIT_SFX_URL);
    sharedHitAudio.currentTime = 0;
    sharedHitAudio.play().catch(() => {});
  } catch (_) {}
}

export function initPunchingBag({ canvas, initialPunches = 0, onPunch, onEmpty } = {}) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  let cssW = 0, cssH = 0;
  let punchesLeft = initialPunches;

  function setupCanvas() {
    const rect = canvas.getBoundingClientRect();
    cssW = rect.width  || 400;
    cssH = rect.height || 420;
    canvas.width  = cssW * dpr;
    canvas.height = cssH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  setupCanvas();
  window.addEventListener("resize", setupCanvas);

  const stickerImg = new Image();
  stickerImg.src = "img/valentinSticker.webp";

  const v3 = (x, y, z) => ({ x, y, z });
  const vsub = (a, b) => v3(a.x - b.x, a.y - b.y, a.z - b.z);
  const vdot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  const vcross = (a, b) => v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
  const vnorm = (v) => { const l = Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z) || 1; return v3(v.x/l, v.y/l, v.z/l); };
  const rotY = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return v3(v.x*c + v.z*s, v.y, -v.x*s + v.z*c); };
  const rotZ = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return v3(v.x*c - v.y*s, v.x*s + v.y*c, v.z); };
  const rotX = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return v3(v.x, v.y*c - v.z*s, v.y*s + v.z*c); };

  const FOV = 4.5, SCALE = 155, VOFF = -60;
  function project(v) {
    const z = v.z + FOV, s = FOV / Math.max(0.01, z);
    return { x: cssW/2 + v.x*s*SCALE, y: cssH/2 + VOFF - v.y*s*SCALE, z: v.z, s };
  }

  const SEGS = 24, STACKS = 10, BAG_H = 2.0, ROPE_L = 0.55;
  function bagRadius(t) {
    if (t < 0.15) return 0.30 + (t/0.15) * 0.22;
    if (t < 0.45) return 0.52 + ((t-0.15)/0.30) * 0.08;
    if (t < 0.75) return 0.60 - ((t-0.45)/0.30) * 0.12;
    return 0.48 - ((t-0.75)/0.25) * 0.18;
  }
  const bagVerts = [];
  for (let st = 0; st <= STACKS; st++) {
    const t = st / STACKS, y = -t * BAG_H, r = bagRadius(t);
    for (let sg = 0; sg < SEGS; sg++) { const a = (sg/SEGS) * Math.PI*2; bagVerts.push([r*Math.cos(a), y, r*Math.sin(a)]); }
  }
  const BOT_CAP_IDX = bagVerts.length; bagVerts.push([0, -BAG_H, 0]);
  const TOP_CAP_IDX = bagVerts.length; bagVerts.push([0, 0, 0]);
  const bagFaces = [];
  for (let st = 0; st < STACKS; st++) for (let sg = 0; sg < SEGS; sg++) {
    const i0 = st*SEGS + sg, i1 = st*SEGS + (sg+1)%SEGS, i2 = (st+1)*SEGS + (sg+1)%SEGS, i3 = (st+1)*SEGS + sg;
    bagFaces.push({ vi: [i0, i1, i2, i3], t: (st+0.5)/STACKS, sg, cap: false });
  }
  for (let sg = 0; sg < SEGS; sg++) {
    bagFaces.push({ vi: [STACKS*SEGS + sg, BOT_CAP_IDX, STACKS*SEGS + (sg+1)%SEGS], t: 1, sg, cap: true, bot: true });
    bagFaces.push({ vi: [sg, (sg+1)%SEGS, TOP_CAP_IDX], t: 0, sg, cap: true, bot: false });
  }

  const ph = { swX: 0, swZ: 0, vX: 0, vZ: 0, spinY: 0, vSpinY: 0, squish: 0, vSquish: 0 };
  const DAMPING = 0.965, GRAVITY = 0.022, SPIN_DMP = 0.982;
  let particles = [], hitFlash = 0;
  const LIGHT = vnorm(v3(-0.6, 1.2, -1.0));
  const TILES = 4, SEGS_PER_TILE = SEGS / TILES;

  function drawTriTex(img, iw, ih, x0, y0, u0, v0, x1, y1, u1, v1, x2, y2, u2, v2) {
    const sx0 = u0*iw, sy0 = v0*ih, sx1 = u1*iw, sy1 = v1*ih, sx2 = u2*iw, sy2 = v2*ih;
    const denom = sx0*(sy1-sy2) + sx1*(sy2-sy0) + sx2*(sy0-sy1);
    if (Math.abs(denom) < 0.5) return;
    const a = (x0*(sy1-sy2) + x1*(sy2-sy0) + x2*(sy0-sy1)) / denom;
    const b = (y0*(sy1-sy2) + y1*(sy2-sy0) + y2*(sy0-sy1)) / denom;
    const c = (sx0*(x1-x2) + sx1*(x2-x0) + sx2*(x0-x1)) / denom;
    const dd = (sx0*(y1-y2) + sx1*(y2-y0) + sx2*(y0-y1)) / denom;
    const e = (sx0*(sy1*x2 - sy2*x1) + sx1*(sy2*x0 - sy0*x2) + sx2*(sy0*x1 - sy1*x0)) / denom;
    const f = (sx0*(sy1*y2 - sy2*y1) + sx1*(sy2*y0 - sy0*y2) + sx2*(sy0*y1 - sy1*y0)) / denom;
    ctx.save(); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.closePath(); ctx.clip(); ctx.transform(a, b, c, dd, e, f); ctx.drawImage(img, 0, 0, iw, ih); ctx.restore();
  }

  function transformVert(bv) {
    let [x, y, z] = bv;
    const squishBulge = 1 + ph.squish * 0.18 * Math.sin((-y / BAG_H) * Math.PI);
    x *= squishBulge; z *= squishBulge; y *= (1 - ph.squish * 0.06);
    let p = v3(x, y, z); p = rotY(p, ph.spinY);
    p.y += ROPE_L; p = rotZ(p, ph.swX); p = rotX(p, ph.swZ); p.y -= ROPE_L;
    return p;
  }

  function render() {
    ctx.clearRect(0, 0, cssW, cssH);
    const bg = ctx.createLinearGradient(0, 0, 0, cssH);
    bg.addColorStop(0, "#1e1e2a"); bg.addColorStop(1, "#12121a");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, cssW, cssH);
    const bagBotPx = project(transformVert([0, -BAG_H, 0]));
    const glow = ctx.createRadialGradient(bagBotPx.x, bagBotPx.y + 20, 0, bagBotPx.x, bagBotPx.y + 20, 90);
    glow.addColorStop(0, "rgba(200,0,0,0.18)"); glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow; ctx.fillRect(0, 0, cssW, cssH);
    const tw = bagVerts.map((bv) => transformVert(bv));
    const pw = tw.map((v) => project(v));
    const drawList = [];
    for (const face of bagFaces) {
      const tvs = face.vi.map((i) => tw[i]), pvs = face.vi.map((i) => pw[i]);
      const avgZ = tvs.reduce((s, v) => s + v.z, 0) / tvs.length;
      let normal;
      if (face.cap) normal = v3(0, face.bot ? -1 : 1, 0);
      else { const e1 = vsub(tvs[1], tvs[0]), e2 = vsub(tvs[3], tvs[0]); normal = vnorm(vcross(e1, e2)); }
      const toCam = vnorm(v3(-tvs[0].x, -tvs[0].y, FOV - tvs[0].z));
      if (vdot(normal, toCam) < 0) continue;
      const diffuse = Math.max(0, vdot(normal, LIGHT));
      const rimDot = 1 - Math.abs(vdot(normal, toCam));
      const brightness = Math.min(1, 0.22 + diffuse * 0.78 + rimDot * rimDot * 0.12);
      drawList.push({ face, pvs, avgZ, brightness });
    }
    drawList.sort((a, b) => a.avgZ - b.avgZ);
    const iw = stickerImg.complete && stickerImg.naturalWidth > 0 ? stickerImg.naturalWidth : 0;
    const ih = stickerImg.complete && stickerImg.naturalWidth > 0 ? stickerImg.naturalHeight : 0;
    for (const { face, pvs, brightness } of drawList) {
      let ok = true; for (const p of pvs) { if (!isFinite(p.x) || !isFinite(p.y)) { ok = false; break; } } if (!ok) continue;
      if (face.cap) {
        ctx.beginPath(); ctx.moveTo(pvs[0].x, pvs[0].y);
        for (let i = 1; i < pvs.length; i++) ctx.lineTo(pvs[i].x, pvs[i].y);
        ctx.closePath(); const g = Math.floor(80 * brightness); ctx.fillStyle = `rgb(${g},${g},${g})`; ctx.fill();
      } else {
        const uL = (face.sg % SEGS_PER_TILE) / SEGS_PER_TILE, uR = ((face.sg % SEGS_PER_TILE) + 1) / SEGS_PER_TILE;
        const vT = Math.floor(face.t * STACKS) / STACKS, vB = (Math.floor(face.t * STACKS) + 1) / STACKS;
        const [p0, p1, p2, p3] = pvs;
        if (iw > 0) {
          drawTriTex(stickerImg, iw, ih, p0.x, p0.y, uL, vT, p1.x, p1.y, uR, vT, p2.x, p2.y, uR, vB);
          drawTriTex(stickerImg, iw, ih, p0.x, p0.y, uL, vT, p2.x, p2.y, uR, vB, p3.x, p3.y, uL, vB);
        } else {
          ctx.beginPath(); ctx.moveTo(p0.x, p0.y);
          for (let i = 1; i < pvs.length; i++) ctx.lineTo(pvs[i].x, pvs[i].y);
          ctx.closePath(); ctx.fillStyle = `rgb(${Math.floor(185 * brightness)},0,0)`; ctx.fill();
        }
        ctx.beginPath(); ctx.moveTo(pvs[0].x, pvs[0].y);
        for (let i = 1; i < pvs.length; i++) ctx.lineTo(pvs[i].x, pvs[i].y);
        ctx.closePath(); ctx.fillStyle = `rgba(0,0,0,${Math.max(0, 1 - brightness) * 0.72})`; ctx.fill();
        const facingFront = face.sg / SEGS < 0.15 || face.sg / SEGS > 0.85;
        if (facingFront && hitFlash > 0) {
          ctx.beginPath(); ctx.moveTo(pvs[0].x, pvs[0].y);
          for (let i = 1; i < pvs.length; i++) ctx.lineTo(pvs[i].x, pvs[i].y);
          ctx.closePath(); ctx.fillStyle = `rgba(255,80,0,${(hitFlash * 0.35).toFixed(3)})`; ctx.fill();
        }
      }
    }
    const mountPx = { x: cssW/2, y: cssH/2 + VOFF - SCALE * ROPE_L };
    const bagTopPx = project(transformVert([0, 0, 0]));
    ctx.save(); ctx.strokeStyle = "#999"; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(mountPx.x, mountPx.y); ctx.lineTo(bagTopPx.x, bagTopPx.y); ctx.stroke();
    ctx.fillStyle = "#aaa"; ctx.beginPath(); ctx.arc(mountPx.x, mountPx.y, 5, 0, Math.PI*2); ctx.fill(); ctx.restore();
    particles = particles.filter((p) => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.28; p.life--;
      if (p.life <= 0) return false;
      ctx.save(); ctx.globalAlpha = p.life / p.maxLife; ctx.font = `bold ${p.size}px Arial`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(p.emoji, p.x, p.y); ctx.restore();
      return true;
    });
    hitFlash = Math.max(0, hitFlash - 0.06);
  }

  function updatePhysics() {
    ph.vX += -Math.sin(ph.swX) * GRAVITY; ph.vZ += -Math.sin(ph.swZ) * GRAVITY;
    ph.vX *= DAMPING; ph.vZ *= DAMPING; ph.vSpinY *= SPIN_DMP;
    ph.swX = Math.max(-0.85, Math.min(0.85, ph.swX + ph.vX));
    ph.swZ = Math.max(-0.85, Math.min(0.85, ph.swZ + ph.vZ));
    ph.spinY += ph.vSpinY;
    ph.vSquish += -ph.squish * 0.38; ph.vSquish *= 0.68; ph.squish = Math.max(0, ph.squish + ph.vSquish);
  }

  function tryPunch(cx, cy) {
    if (punchesLeft <= 0) return;
    const bagCW = transformVert([0, -BAG_H * 0.5, 0]);
    const bagCP = project(bagCW);
    const dx = cx - bagCP.x, dy = cy - bagCP.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const hitR = SCALE * bagRadius(0.45) * (FOV / (bagCW.z + FOV)) * 1.4;
    if (dist > hitR) return;
    const force = Math.max(0.25, 1.6 - dist/hitR) * 0.20;
    ph.vX += (dx / 130) * force; ph.vZ += (dy / 130) * force; ph.vSpinY += (dx / 130) * force * 0.28;
    ph.vSquish = 0.7; hitFlash = 1.0;
    punchesLeft--;
    playHit();
    const emojis = ["💥", "⚡", "✨", "💫", "🔥", "💪", "👊", "🌟"];
    for (let i = 0; i < 11; i++) {
      const a = Math.random() * Math.PI * 2, spd = 2.5 + Math.random() * 5;
      particles.push({
        x: cx + (Math.random()-0.5) * 16, y: cy + (Math.random()-0.5) * 16,
        vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - 2,
        life: 55 + Math.random() * 45, maxLife: 100,
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
        size: 16 + Math.floor(Math.random() * 14),
      });
    }
    onPunch?.(punchesLeft);
    if (punchesLeft === 0) onEmpty?.();
  }

  canvas.addEventListener("click", (e) => {
    const r = canvas.getBoundingClientRect();
    tryPunch(e.clientX - r.left, e.clientY - r.top);
  });
  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    for (const t of e.changedTouches) tryPunch(t.clientX - r.left, t.clientY - r.top);
  }, { passive: false });

  (function loop() { updatePhysics(); render(); requestAnimationFrame(loop); })();

  return {
    setPunches(n) { punchesLeft = Math.max(0, Math.floor(n || 0)); },
    getPunches() { return punchesLeft; },
  };
}
