// Phi thuyền "Next Level": bay ngang, tiến một đoạn sau mỗi lần chuyển ảnh, tới cổng đích ở ảnh cuối.
// Hình tàu là assets/ship.png (thiết kế riêng, mũi hướng phải). Các đường đứt khúc phía sau được vẽ bằng code:
// khi tàu lao tới, các đường dài ra và các đoạn chạy ra phía sau nhanh hơn; khi tàu giữ ảnh, chúng ngắn lại và trôi chậm.
// app.js gọi Ship.set(s, boost) mỗi khung hình: s = 0..1 (tiến độ), boost = 0..1 (đang chuyển ảnh).
(() => {
  const cv = document.getElementById("ship");
  const ctx = cv.getContext("2d");
  const slogan = document.getElementById("slogan");

  const cfg = { n: 30, accent: "#f2b84b", ship: "#ff7a1a", sprite: "assets/ship.png", shipWidth: 1.6 };
  let W = 0, H = 0, U = 0, dpr = 1;
  let s = 0, boost = 0, thrust = 0.3, reached = false, ringT = -1, arrive = 0;
  let last = performance.now(), clock = 0, emitAcc = 0;
  const embers = [], sparks = [];

  // ---- ảnh tàu ----
  // Toạ độ trong ảnh theo tỉ lệ 0..1: mũi tàu ở mép phải (x=1, y≈0.49); đầu ngọn lửa ở mép trái.
  const SPR = { ratio: 900 / 586, noseY: 0.49, tips: [[0.19, 0.2], [0.02, 0.49], [0.175, 0.795]], glows: [[0.27, 0.2], [0.2, 0.49], [0.26, 0.795]] };
  const img = new Image();
  let imgOk = false;
  img.onload = () => { imgOk = true; if (img.naturalWidth) SPR.ratio = img.naturalWidth / img.naturalHeight; };
  img.src = cfg.sprite;

  // ---- đường đứt khúc ----
  // dy: lệch so với trục tàu (đơn vị: chiều cao ảnh tàu); off: điểm bắt đầu lùi vào trong; c: màu; w: độ dày; pat: dãy (đoạn, hở) theo đơn vị U.
  const ORANGE = [255, 138, 31], GREY = [150, 154, 164], LIGHT = [228, 232, 240];
  const lanes = [
    { dy: -0.6, off: 0.2, c: GREY, w: 0.034, len: 1.7, pat: [0.9, 0.14, 0.22, 0.12, 0.5, 0.2], ph: 0.0, v: 1.0, a: 0.85 },
    { dy: -0.5, off: 0.16, c: ORANGE, w: 0.034, len: 1.3, pat: [0.45, 0.12, 0.3, 0.16, 0.18, 0.1, 0.4, 0.2], ph: 0.7, v: 1.15, a: 0.95 },
    { dy: -0.36, off: 0.1, c: LIGHT, w: 0.03, len: 2.1, pat: [1.0, 0.18, 0.35, 0.14], ph: 0.3, v: 0.9, a: 0.5 },
    { dy: -0.22, off: 0.02, c: ORANGE, w: 0.034, len: 1.5, pat: [0.6, 0.14, 0.16, 0.12, 0.35, 0.18], ph: 1.2, v: 1.3, a: 0.95 },
    { dy: 0.22, off: 0.02, c: GREY, w: 0.034, len: 1.9, pat: [0.8, 0.16, 0.28, 0.12, 0.45, 0.2], ph: 0.5, v: 1.05, a: 0.85 },
    { dy: 0.36, off: 0.1, c: ORANGE, w: 0.034, len: 1.4, pat: [0.5, 0.14, 0.2, 0.12, 0.32, 0.16], ph: 1.5, v: 1.25, a: 0.95 },
    { dy: 0.5, off: 0.16, c: LIGHT, w: 0.03, len: 2.3, pat: [1.1, 0.2, 0.3, 0.15], ph: 0.9, v: 0.85, a: 0.5 },
    { dy: 0.6, off: 0.2, c: ORANGE, w: 0.034, len: 1.2, pat: [0.4, 0.12, 0.25, 0.14, 0.15, 0.1, 0.35, 0.18], ph: 0.2, v: 1.1, a: 0.9 }
  ];

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
    const SW = U * cfg.shipWidth, SH = SW / SPR.ratio;
    return { SW, SH, y: H - U * 0.66, startX: W * 0.07, goalX: W * 0.745, R: U * 0.2 };
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

  function drawParticle(p, col, f, size) {
    const a = Math.pow(1 - f, 1.5) * 0.9;
    ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${a})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, size, 0, Math.PI * 2); ctx.fill();
  }

  // một đường đứt khúc: bắt đầu tại (x0,y), kéo về bên trái; các đoạn chạy ra xa tàu theo `phase`
  function drawLane(L, x0, y, phase, lenK, alphaK) {
    const unit = U;
    const pat = L.pat.map((v) => v * unit * 0.5);
    const total = pat.reduce((a, b) => a + b, 0);
    const len = L.len * unit * lenK;
    if (len < 4 || alphaK < 0.02) return;
    const x1 = x0 - len;
    const gr = ctx.createLinearGradient(x0, 0, x1, 0);
    const c = L.c;
    gr.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${L.a * alphaK})`);
    gr.addColorStop(0.6, `rgba(${c[0]},${c[1]},${c[2]},${L.a * alphaK * 0.7})`);
    gr.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
    ctx.strokeStyle = gr;
    ctx.lineWidth = Math.max(1.5, L.w * U * 2.2);
    ctx.lineCap = "round";
    ctx.setLineDash(pat.map((v, i) => (i % 2 === 0 ? Math.max(0.1, v - ctx.lineWidth) : v + ctx.lineWidth)));
    ctx.lineDashOffset = -((phase * L.v) % (total + pat.length * ctx.lineWidth)) - L.ph * unit * 0.5;
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
    ctx.setLineDash([]);
  }

  let phase = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now; clock += dt;
    const g = geo();
    const ac = rgb(cfg.accent), sh = rgb(cfg.ship);

    // tăng tốc khi đang chuyển ảnh; mượt dần về nhịp chậm khi giữ ảnh
    thrust += (0.3 + 0.7 * boost - thrust) * Math.min(1, dt * 7);
    arrive += ((reached ? 1 : 0) - arrive) * Math.min(1, dt * 3);
    const calm = 1 - 0.75 * arrive;          // tới đích: tàu lướt chậm lại, đường đứt khúc thưa dần
    phase += (U * (0.9 + 7.5 * thrust * thrust) * calm) * dt;

    const noseX = g.startX + s * (g.goalX - g.startX);
    const left = noseX - g.SW;
    const bob = Math.sin(clock * 3.2) * U * 0.02;
    const cy = g.y + bob;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // ---- đường bay mờ + chấm mốc cho từng ảnh ----
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,.16)"; ctx.lineWidth = 2; ctx.setLineDash([6, 8]);
    ctx.beginPath(); ctx.moveTo(g.startX - g.SW * 0.2, g.y); ctx.lineTo(g.goalX - g.R, g.y); ctx.stroke();
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

    // ---- các đường đứt khúc phía sau tàu ----
    const lenK = 0.45 + 1.05 * thrust;          // lao tới thì kéo dài
    const alphaK = (0.55 + 0.45 * thrust) * (1 - 0.8 * arrive);
    for (const L of lanes) {
      const x0 = left + g.SW * (0.02 + L.off * 0.35);
      drawLane(L, x0, cy + L.dy * g.SH, phase, lenK, alphaK);
    }

    // ---- tia lửa nhỏ bay ra từ đầu ngọn lửa (các chấm cam như trong thiết kế) ----
    emitAcc += (3 + 22 * thrust) * calm * dt;
    while (emitAcc >= 1) {
      emitAcc -= 1;
      const t = SPR.tips[(Math.random() * SPR.tips.length) | 0];
      embers.push({
        x: left + t[0] * g.SW, y: cy + (t[1] - SPR.noseY) * g.SH + rnd(-3, 3),
        vx: -(U * (0.9 + 3.2 * thrust)) * rnd(0.6, 1.3), vy: rnd(-8, 8),
        age: 0, life: rnd(0.35, 0.8), size: U * 0.035 * rnd(0.7, 1.5)
      });
    }
    ctx.globalCompositeOperation = "lighter";
    for (let i = embers.length - 1; i >= 0; i--) {
      const p = embers[i];
      p.age += dt;
      if (p.age >= p.life) { embers.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      const f = p.age / p.life;
      drawParticle(p, f < 0.5 ? [255, 160, 50] : [230, 80, 25], f, p.size * (1 - 0.5 * f));
    }

    // ---- pháo hoa khi tới đích ----
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

    // ---- thân tàu (ảnh thiết kế) ----
    if (imgOk) {
      ctx.save();
      ctx.translate(noseX, cy);
      ctx.rotate(-0.035 * thrust);
      // ánh lửa nhấp nháy sau các ống phụt (cộng sáng)
      ctx.globalCompositeOperation = "lighter";
      const fl = 0.55 + 0.45 * Math.sin(clock * 41) * Math.sin(clock * 23 + 1);
      for (const q of SPR.glows) {
        const gx = (q[0] - 1) * g.SW, gy = (q[1] - SPR.noseY) * g.SH;
        const rad = g.SH * (0.2 + 0.1 * thrust);
        const rg = ctx.createRadialGradient(gx, gy, 0, gx, gy, rad);
        rg.addColorStop(0, `rgba(255,170,60,${(0.18 + 0.3 * thrust) * (0.7 + 0.5 * fl)})`);
        rg.addColorStop(1, "rgba(255,120,30,0)");
        ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(gx, gy, rad, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.shadowColor = `rgba(${sh[0]},${sh[1]},${sh[2]},.45)`; ctx.shadowBlur = U * 0.14;
      ctx.drawImage(img, -g.SW, -SPR.noseY * g.SH, g.SW, g.SH);
      ctx.restore();
    }
  }
  requestAnimationFrame(frame);

  window.Ship = {
    init(o) { Object.assign(cfg, o || {}); if (o && o.sprite) img.src = o.sprite; },
    set(v, b) {
      s = Math.max(0, Math.min(1, v)); boost = b || 0;
      if (s >= 0.999 && !reached) { reached = true; doBurst(); }
      else if (s < 0.98 && reached) { reached = false; slogan.classList.remove("reached"); }
    },
    reset() {
      s = 0; boost = 0; reached = false; ringT = -1; arrive = 0;
      embers.length = 0; sparks.length = 0;
      slogan.classList.remove("reached");
    }
  };
})();
