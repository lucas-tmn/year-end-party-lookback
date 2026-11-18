// Phi thuyền "Next Level": tiến một đoạn sau mỗi lần chuyển ảnh, tới đích ở ảnh cuối.
// app.js gọi Ship.set(s, boost) mỗi khung hình: s = 0..1 (tiến độ), boost = 0..1 (đang tăng tốc).
(() => {
  const cv = document.getElementById("ship");
  const ctx = cv.getContext("2d");
  const slogan = document.getElementById("slogan");

  const cfg = { n: 30, accent: "#f2b84b", ship: "#ff7a1a" };
  let W = 0, H = 0, U = 0, dpr = 1;
  let s = 0, boost = 0, thrust = 0.3, reached = false, ringT = -1;
  let emitAcc = 0, last = performance.now(), clock = 0;
  const flame = [], sparks = [];

  const rnd = (a, b) => a + Math.random() * (b - a);
  function rgb(h) {
    const m = /^#?([0-9a-f]{6})$/i.exec(h) || [0, "ff7a1a"];
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth;
    U = innerHeight * 0.12;
    H = Math.round(innerHeight * 0.34);
    cv.style.height = H + "px";
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
  }
  layout();
  addEventListener("resize", layout);

  const geo = () => {
    const L = U * 0.5;
    return { L, hh: L * 0.3, y: H - U * 0.48, startX: W * 0.07, goalX: W * 0.745, R: U * 0.2 };
  };

  function doBurst() {
    const g = geo();
    const ac = rgb(cfg.accent), sh = rgb(cfg.ship);
    const palette = [ac, sh, [255, 255, 255], [255, 200, 120]];
    for (let i = 0; i < 140; i++) {
      const a = rnd(0, Math.PI * 2), sp = rnd(120, 560);
      sparks.push({
        x: g.goalX, y: g.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.8,
        age: 0, life: rnd(0.8, 1.7), size: rnd(1.5, 4.5) * (U / 130), col: palette[(Math.random() * palette.length) | 0]
      });
    }
    ringT = 0;
    slogan.classList.add("reached");
  }

  function emit(dt, tx, ty) {
    emitAcc += (40 + 260 * thrust) * dt;
    while (emitAcc >= 1) {
      emitAcc -= 1;
      flame.push({
        x: tx + rnd(-2, 2), y: ty + rnd(-U * 0.03, U * 0.03),
        vx: -(60 + 170 * thrust) * rnd(0.6, 1.4), vy: rnd(-22, 22) * (0.5 + thrust),
        age: 0, life: rnd(0.3, 0.8) * (0.7 + 0.5 * thrust),
        size: U * 0.05 * rnd(0.6, 1.4) * (0.6 + 0.6 * thrust)
      });
    }
  }

  function drawParticle(p, col, f, size) {
    const a = Math.pow(1 - f, 1.5) * 0.9;
    ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${a})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, size, 0, Math.PI * 2); ctx.fill();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now; clock += dt;
    const g = geo();
    const ac = rgb(cfg.accent), sh = rgb(cfg.ship);

    thrust += (0.3 + 0.7 * boost - thrust) * Math.min(1, dt * 8);

    // vị trí phi thuyền: mũi tàu tại điểm tick của ảnh hiện tại
    const noseX = g.startX + s * (g.goalX - g.startX);
    const cx = noseX - g.L * 0.6;
    const bob = Math.sin(clock * 3.2) * U * 0.018;
    const cy = g.y + bob;
    const tailX = cx - g.L * 0.34;

    emit(dt, tailX, cy);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // ---- đường bay ----
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,.16)"; ctx.lineWidth = 2; ctx.setLineDash([6, 8]);
    ctx.beginPath(); ctx.moveTo(g.startX - g.L * 0.2, g.y); ctx.lineTo(g.goalX - g.R, g.y); ctx.stroke();
    ctx.restore();
    const n = Math.max(1, cfg.n - 1);
    for (let i = 0; i < cfg.n; i++) {
      const x = g.startX + (cfg.n > 1 ? i / n : 1) * (g.goalX - g.startX);
      const passed = (cfg.n > 1 ? i / n : 1) <= s + 1e-3;
      ctx.beginPath(); ctx.arc(x, g.y, U * 0.03, 0, Math.PI * 2);
      ctx.fillStyle = passed ? `rgba(${ac[0]},${ac[1]},${ac[2]},.95)` : "rgba(255,255,255,.28)";
      ctx.fill();
    }

    // ---- cổng đích ----
    const pulse = 1 + 0.07 * Math.sin(clock * 2.4);
    ctx.lineWidth = 2.5;
    for (let k = 0; k < 2; k++) {
      ctx.strokeStyle = `rgba(${ac[0]},${ac[1]},${ac[2]},${k ? 0.35 : 0.8})`;
      ctx.beginPath(); ctx.arc(g.goalX, g.y, g.R * pulse * (1 + k * 0.45), 0, Math.PI * 2); ctx.stroke();
    }
    const glow = ctx.createRadialGradient(g.goalX, g.y, 0, g.goalX, g.y, g.R * 1.8);
    glow.addColorStop(0, `rgba(${ac[0]},${ac[1]},${ac[2]},${reached ? 0.55 : 0.22})`);
    glow.addColorStop(1, `rgba(${ac[0]},${ac[1]},${ac[2]},0)`);
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(g.goalX, g.y, g.R * 1.8, 0, Math.PI * 2); ctx.fill();

    // ---- lửa đẩy (cộng sáng) ----
    ctx.globalCompositeOperation = "lighter";
    for (let i = flame.length - 1; i >= 0; i--) {
      const p = flame[i];
      p.age += dt;
      if (p.age >= p.life) { flame.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      const f = p.age / p.life;
      const col = f < 0.25 ? [255, 235, 170] : f < 0.6 ? [255, 140, 30] : [200, 40, 15];
      drawParticle(p, col, f, p.size * (1 - 0.6 * f));
    }
    // lõi lửa
    const flick = 0.85 + 0.3 * Math.sin(clock * 38) * Math.random();
    const Lf = g.L * (0.5 + 1.3 * thrust) * flick;
    const grad = ctx.createLinearGradient(tailX, cy, tailX - Lf, cy);
    grad.addColorStop(0, "rgba(255,246,210,.95)");
    grad.addColorStop(0.4, "rgba(255,170,50,.7)");
    grad.addColorStop(1, "rgba(255,90,20,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(tailX + g.L * 0.1, cy - g.hh * 0.42);
    ctx.lineTo(tailX - Lf, cy);
    ctx.lineTo(tailX + g.L * 0.1, cy + g.hh * 0.42);
    ctx.closePath(); ctx.fill();

    // pháo hoa khi tới đích
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.age += dt;
      if (p.age >= p.life) { sparks.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.985; p.vy *= 0.985;
      drawParticle(p, p.col, p.age / p.life, p.size);
    }
    ctx.globalCompositeOperation = "source-over";
    if (ringT >= 0) {
      ringT += dt / 1.1;
      if (ringT >= 1) ringT = -1;
      else {
        ctx.strokeStyle = `rgba(${ac[0]},${ac[1]},${ac[2]},${1 - ringT})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(g.goalX, g.y, g.R + ringT * U * 1.6, 0, Math.PI * 2); ctx.stroke();
      }
    }

    // ---- thân phi thuyền (tam giác, mũi hướng phải) ----
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.05 * thrust);
    const L = g.L, hh = g.hh;
    const bodyGrad = ctx.createLinearGradient(0, -hh, 0, hh);
    bodyGrad.addColorStop(0, `rgb(${Math.min(255, sh[0] + 30)},${Math.min(255, sh[1] + 60)},${Math.min(255, sh[2] + 40)})`);
    bodyGrad.addColorStop(1, `rgb(${sh[0] * 0.78 | 0},${sh[1] * 0.55 | 0},${sh[2] * 0.4 | 0})`);
    ctx.shadowColor = `rgba(${sh[0]},${sh[1]},${sh[2]},.6)`; ctx.shadowBlur = U * 0.12;
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.moveTo(L * 0.6, 0);
    ctx.lineTo(-L * 0.4, -hh);
    ctx.lineTo(-L * 0.2, 0);
    ctx.lineTo(-L * 0.4, hh);
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,.24)";
    ctx.beginPath();
    ctx.moveTo(L * 0.36, 0); ctx.lineTo(-L * 0.12, -hh * 0.5); ctx.lineTo(-L * 0.12, hh * 0.5);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(L * 0.6, 0); ctx.lineTo(-L * 0.4, -hh); ctx.lineTo(-L * 0.2, 0); ctx.lineTo(-L * 0.4, hh);
    ctx.closePath(); ctx.stroke();
    ctx.restore();
  }
  requestAnimationFrame(frame);

  window.Ship = {
    init(o) { Object.assign(cfg, o || {}); },
    set(v, b) {
      s = Math.max(0, Math.min(1, v)); boost = b || 0;
      if (s >= 0.999 && !reached) { reached = true; doBurst(); }
      else if (s < 0.98 && reached) { reached = false; slogan.classList.remove("reached"); }
    },
    reset() {
      s = 0; boost = 0; reached = false; ringT = -1;
      flame.length = 0; sparks.length = 0;
      slogan.classList.remove("reached");
    }
  };
})();
