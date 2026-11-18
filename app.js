(() => {
  "use strict";

  // ===================== Config =====================
  const U = window.CONFIG || {};
  const C = {
    title: "Year End Party", subtitle: "Look back",
    secondsPerPhoto: 2, transitionMs: 700, zoom: 1.05, shuffle: false,
    transitions: null, transitionOrder: "cycle", perPhoto: {},
    chapters: {}, music: "", musicVolume: 0.7,
    closingTitle: "Cảm ơn mọi người", closingText: "",
    ...U,
    frame: { x: 0.07, top: 0.12, bottom: 0.12, radius: 18, ...(U.frame || {}) },
    brand: { logo: "assets/logo.svg", slogan: "Next Level", color1: "#0b1530", color2: "#17316b", accent: "#f2b84b", ship: "#ff7a1a", ...(U.brand || {}) }
  };

  const EFFECTS = window.EFFECTS || [];
  const byId = Object.fromEntries(EFFECTS.map((e) => [e.id, e]));
  const VISIBLE = EFFECTS.filter((e) => !e.hidden);
  let photos = (window.PHOTOS || []).slice();
  if (C.shuffle) photos.sort(() => Math.random() - 0.5);
  const N = photos.length;

  const $ = (s) => document.querySelector(s);
  const canvas = $("#gl"), bar = $("#bar i"), chapter = $("#chapter");
  const endEl = $("#end"), mosaic = $("#mosaic"), startEl = $("#start");

  // ===================== Brand =====================
  const root = document.documentElement.style;
  root.setProperty("--c1", C.brand.color1);
  root.setProperty("--c2", C.brand.color2);
  root.setProperty("--accent", C.brand.accent);
  $("#logo").src = C.brand.logo;
  $("#slogan").textContent = C.brand.slogan;
  $("#bigtext").textContent = C.brand.slogan;
  $("#t").textContent = C.title;
  $("#s").textContent = C.subtitle;
  $("#endtext h1").textContent = C.closingTitle;
  $("#endtext p").textContent = C.closingText;

  function fail(msg) {
    $("#s").textContent = msg;
    $("#go").style.display = "none";
  }
  if (!N) { fail("Chưa có ảnh. Chạy prepare_photos.py để tạo photos.js."); return; }

  const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: true });
  if (!gl) { fail("Trình duyệt không hỗ trợ WebGL. Hãy dùng Chrome hoặc Edge bản mới."); return; }

  const hex3 = (h) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(h || "");
    const n = m ? parseInt(m[1], 16) : 0xf2b84b;
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  };
  const ACCENT = hex3(C.brand.accent);

  // ===================== WebGL setup =====================
  const VERT = `attribute vec2 aPos; varying vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const PRELUDE = `precision highp float;
varying vec2 vUv;
uniform sampler2D uFrom, uTo;
uniform float progress, ratio, zf, zt;
uniform vec3 accent;
const float PI = 3.14159265359;
vec4 getFromColor(vec2 uv){
  vec2 s = (uv - 0.5) / zf + 0.5;
  if (s.x < 0.0 || s.x > 1.0 || s.y < 0.0 || s.y > 1.0) return vec4(0.0);
  return texture2D(uFrom, s);
}
vec4 getToColor(vec2 uv){
  vec2 s = (uv - 0.5) / zt + 0.5;
  if (s.x < 0.0 || s.x > 1.0 || s.y < 0.0 || s.y > 1.0) return vec4(0.0);
  return texture2D(uTo, s);
}
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float easeIO(float t){ return t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0; }
`;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const programs = new Map();
  function program(id) {
    if (programs.has(id)) return programs.get(id);
    let P = null;
    try {
      const fs = compile(gl.FRAGMENT_SHADER, PRELUDE + byId[id].glsl + "\nvoid main(){ gl_FragColor = transition(vUv); }");
      const p = gl.createProgram();
      gl.attachShader(p, vs); gl.attachShader(p, fs);
      gl.bindAttribLocation(p, 0, "aPos");
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const u = (n) => gl.getUniformLocation(p, n);
      P = { p, uFrom: u("uFrom"), uTo: u("uTo"), progress: u("progress"), ratio: u("ratio"), zf: u("zf"), zt: u("zt"), accent: u("accent") };
    } catch (e) {
      console.error("Shader lỗi [" + id + "]:", e.message);
      if (id !== "crossfade") P = program("crossfade");
    }
    programs.set(id, P);
    return P;
  }

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  function makeTex() {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return t;
  }
  const blank = makeTex();
  gl.bindTexture(gl.TEXTURE_2D, blank);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
  const texPool = [makeTex(), makeTex(), makeTex()];

  function upload(tex, src) {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  }

  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.min(2560, Math.round(innerWidth * dpr));
    canvas.width = W;
    canvas.height = Math.round((W * innerHeight) / innerWidth);
  }
  resizeCanvas();

  function render(fromTex, toTex, effectId, p, zf, zt) {
    renderQuad(fromTex, toTex, effectId, p, zf, zt);
  }

  function renderQuad(fromTex, toTex, effectId, p, zf, zt) {
    const P = program(effectId);
    if (!P) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(P.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fromTex); gl.uniform1i(P.uFrom, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, toTex); gl.uniform1i(P.uTo, 1);
    gl.uniform1f(P.progress, p);
    gl.uniform1f(P.ratio, canvas.width / canvas.height);
    gl.uniform1f(P.zf, zf);
    gl.uniform1f(P.zt, zt);
    gl.uniform3f(P.accent, ACCENT[0], ACCENT[1], ACCENT[2]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // ===================== Photo cards (ảnh trong khung, nền trong suốt) =====================
  function loadImg(src) {
    const im = new Image();
    im.src = src;
    return im.decode().then(() => im);
  }

  async function buildCard(i) {
    const img = await loadImg(photos[i].src);
    const W = canvas.width, H = canvas.height, k = W / 1920;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d");
    const fx = C.frame.x * W, ft = C.frame.top * H, fb = C.frame.bottom * H;
    const aw = W - 2 * fx, ah = H - ft - fb;
    const s = Math.min(aw / img.naturalWidth, ah / img.naturalHeight);
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    const x = (W - w) / 2, y = ft + (ah - h) / 2, r = C.frame.radius * k;
    const path = () => { g.beginPath(); g.roundRect(x, y, w, h, r); };

    g.save();
    g.shadowColor = "rgba(0,0,0,.55)"; g.shadowBlur = 44 * k; g.shadowOffsetY = 14 * k;
    path(); g.fillStyle = "#000"; g.fill();
    g.restore();
    g.save(); path(); g.clip(); g.drawImage(img, x, y, w, h); g.restore();
    g.lineWidth = 3 * k; g.strokeStyle = "rgba(255,255,255,.85)"; path(); g.stroke();
    return c;
  }

  const holder = new Map(); // photo index -> { tex, promise, ready }
  function acquire(i) {
    let h = holder.get(i);
    if (h) return h.promise;
    const used = new Set([...holder.values()].map((x) => x.tex));
    const tex = texPool.find((t) => !used.has(t));
    h = { tex, ready: false, promise: null };
    h.promise = buildCard(i).then((card) => {
      if (holder.get(i) !== h) return null;
      upload(tex, card);
      h.ready = true;
      return tex;
    });
    holder.set(i, h);
    return h.promise;
  }
  const texOf = (i) => { const h = holder.get(i); return h && h.ready ? h.tex : null; };
  const keepOnly = (set) => { for (const i of [...holder.keys()]) if (!set.has(i)) holder.delete(i); };

  // ===================== Timeline =====================
  const dur = C.secondsPerPhoto * 1000;
  const transMs = Math.min(C.transitionMs, dur * 0.9);
  const holdMs = dur - transMs;
  // Mỗi hiệu ứng có thể có thời lượng chuyển cảnh riêng (durMs). Phần "giữ ảnh" của ảnh trước đó
  // được rút ngắn tương ứng, nên tổng thời gian mỗi ảnh vẫn là secondsPerPhoto.
  const transOf = (id) => Math.min((byId[id] && byId[id].durMs) || transMs, dur * 0.8);
  let pending = null; // { target, effect }: hiệu ứng đã chọn cho lần chuyển kế tiếp
  const easeIO = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const sAt = (i) => (N > 1 ? Math.max(0, i) / (N - 1) : 1); // tiến độ phi thuyền theo chỉ số ảnh
  const zoomOf = (age) => 1 + (C.zoom - 1) * Math.max(0, Math.min(1, age / dur));

  let cur = -1, phase = "idle", t = 0, tr = null, ageCur = 0;
  let paused = false, running = false, done = false, busy = false, prefetched = false;
  let timeScale = 1, previewLock = false, labOpen = false, pausedBeforeLab = false;
  let audio = null, muted = false;

  // ---- chọn hiệu ứng ----
  let enabled = (Array.isArray(C.transitions) && C.transitions.length ? C.transitions : VISIBLE.map((e) => e.id)).filter((id) => byId[id] && !byId[id].hidden);
  let cyc = 0, lastEffect = null;
  function pickEffect(target) {
    if (C.perPhoto && byId[C.perPhoto[target]]) return C.perPhoto[target];
    if (!enabled.length) return "crossfade";
    if (C.transitionOrder === "random") {
      let id;
      do { id = enabled[Math.floor(Math.random() * enabled.length)]; } while (enabled.length > 1 && id === lastEffect);
      return (lastEffect = id);
    }
    return enabled[cyc++ % enabled.length];
  }

  async function startTransition(target, effect) {
    if (busy || phase === "trans") return;
    busy = true;
    try {
      keepOnly(new Set([cur, target].filter((i) => i >= 0)));
      const tex = await acquire(target);
      if (!tex) return;
      tr = { to: target, effect, ageTo: 0, texTo: tex, dur: transOf(effect) };
      phase = "trans"; t = 0;
      showChapter(target);
    } catch (e) {
      console.error(e);
    } finally {
      busy = false;
    }
  }

  function endTransition() {
    cur = tr.to; ageCur = tr.ageTo; tr = null;
    phase = "hold"; t = 0; prefetched = false; pending = null;
    bar.style.width = ((cur + 1) / N) * 100 + "%";
    keepOnly(new Set([cur]));
  }

  function prefetch() {
    prefetched = true;
    const nx = cur + 1;
    keepOnly(new Set([cur].concat(nx < N ? [nx] : [])));
    if (nx < N) { acquire(nx).catch(console.error); pending = { target: nx, effect: pickEffect(nx) }; }
    else pending = null;
  }

  function showChapter(i) {
    const label = C.chapters && C.chapters[i];
    if (label) {
      chapter.textContent = label;
      chapter.classList.add("show");
      setTimeout(() => chapter.classList.remove("show"), Math.max(900, dur - 200));
    } else {
      chapter.classList.remove("show");
    }
  }

  // ---- vòng lặp chính ----
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(100, now - last) * timeScale;
    last = now;
    if (!running || previewLock) return;

    if (phase === "hold" && !done) {
      if (!paused) { ageCur += dt; t += dt; }
      if (!prefetched) prefetch();
      const hm = pending ? dur - transOf(pending.effect) : holdMs;
      if (!paused && t >= hm) {
        t = hm;
        if (!busy) {
          const target = cur + 1;
          if (target >= N) finish(); else startTransition(target, pending ? pending.effect : pickEffect(target));
        }
      }
    } else if (phase === "trans") {
      t += dt; ageCur += dt; tr.ageTo += dt;
      if (t >= tr.dur) endTransition();
    }

    // phi thuyền: tiến theo hiệu ứng chuyển cảnh, đứng ở điểm tick của ảnh đang hiện
    if (window.Ship) {
      let s = sAt(cur);
      if (phase === "trans" && tr) s = sAt(cur) + (sAt(tr.to) - sAt(cur)) * easeIO(Math.min(1, t / tr.dur));
      Ship.set(s, phase === "trans" ? 1 : 0);
    }

    if (phase === "trans") {
      const a = cur >= 0 ? texOf(cur) : blank;
      const b = texOf(tr.to) || tr.texTo;
      if (a && b) render(a, b, tr.effect, Math.min(1, t / tr.dur), zoomOf(ageCur), zoomOf(tr.ageTo));
    } else if (phase === "hold") {
      const a = texOf(cur);
      if (a) render(a, a, "crossfade", 0, zoomOf(ageCur), zoomOf(ageCur));
      else acquire(cur).catch(console.error);
    }
  }

  // ===================== End / mosaic =====================
  function finish() {
    if (done) return;
    done = true;
    fadeAudio(0, 2500);
    if (!mosaic.children.length) buildMosaic();
    endEl.classList.add("show");
    bar.style.width = "100%";
  }
  function buildMosaic() {
    const screenAR = innerWidth / innerHeight;
    let cols = 1, best = Infinity;
    for (let c = 2; c <= Math.min(N, 14); c++) {
      const r = Math.ceil(N / c), empty = c * r - N;
      const score = empty * 2 + Math.abs(Math.log(((screenAR * r) / c) / 1.5)) * 6;
      if (score < best) { best = score; cols = c; }
    }
    const rows = Math.ceil(N / cols);
    mosaic.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    mosaic.style.gridTemplateRows = `repeat(${rows}, minmax(0, 1fr))`;
    photos.forEach((p, i) => {
      const im = new Image();
      im.src = p.thumb || p.src;
      im.style.animationDelay = i * 45 + "ms";
      mosaic.append(im);
    });
  }
  function restart() {
    endEl.classList.remove("show");
    done = false; cur = -1; phase = "idle"; tr = null; ageCur = 0; cyc = 0; prefetched = false; pending = null;
    holder.clear();
    if (window.Ship) Ship.reset();
    bar.style.width = "0";
    if (audio && !muted) { audio.currentTime = 0; audio.volume = C.musicVolume; audio.play().catch(() => {}); }
    startTransition(0, "crossfade");
  }

  // ===================== Audio =====================
  function setupAudio() {
    if (!C.music) return;
    audio = new Audio(C.music);
    audio.volume = 0; audio.loop = true;
  }
  function fadeAudio(target, ms) {
    if (!audio) return;
    const from = audio.volume, t0 = performance.now();
    (function step(tt) {
      const k = Math.min(1, (tt - t0) / ms);
      audio.volume = Math.max(0, Math.min(1, from + (target - from) * k));
      if (k < 1) requestAnimationFrame(step); else if (target === 0) audio.pause();
    })(t0);
  }
  function toggleMute() {
    if (!audio) return;
    muted = !muted;
    if (muted) fadeAudio(0, 300); else { audio.play().catch(() => {}); fadeAudio(C.musicVolume, 300); }
  }

  // ===================== Điều khiển =====================
  function navigate(delta) {
    if (!running || phase !== "hold") return;
    if (done) { if (delta < 0) { endEl.classList.remove("show"); done = false; } return; }
    let target = cur + delta;
    if (labOpen) target = (target + N) % N;
    if (target < 0) return;
    if (target >= N) { finish(); return; }
    startTransition(target, delta === 1 && pending && pending.target === target ? pending.effect : pickEffect(target));
  }
  function togglePause() {
    if (!running || done) return;
    paused = !paused;
    document.body.classList.toggle("paused", paused);
  }
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
  };
  async function keepAwake() { try { if (navigator.wakeLock) await navigator.wakeLock.request("screen"); } catch (e) {} }

  async function start() {
    if (running) return;
    running = true;
    setupAudio();
    if (audio) audio.play().then(() => fadeAudio(C.musicVolume, 1500)).catch(() => {});
    keepAwake();
    toggleFullscreen();
    startEl.classList.add("hide");
    startTransition(0, "crossfade");
  }

  $("#go").addEventListener("click", start);
  document.addEventListener("keydown", (e) => {
    if (!running) { if (e.key === "Enter") start(); return; }
    switch (e.key) {
      case " ": e.preventDefault(); togglePause(); break;
      case "ArrowRight": case "PageDown": navigate(1); break;
      case "ArrowLeft": case "PageUp": navigate(-1); break;
      case "f": case "F": toggleFullscreen(); break;
      case "m": case "M": toggleMute(); break;
      case "r": case "R": restart(); break;
      case "t": case "T": toggleLab(); break;
    }
  });

  let idleT;
  const wake = () => { document.body.classList.remove("idle"); clearTimeout(idleT); idleT = setTimeout(() => document.body.classList.add("idle"), 2000); };
  document.addEventListener("mousemove", wake); wake();

  let rz;
  function doResize() {
    if (phase === "trans") { rz = setTimeout(doResize, 300); return; }
    resizeCanvas(); holder.clear(); prefetched = false;
  }
  addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(doResize, 250); });

  // ===================== Bảng thử hiệu ứng =====================
  const lab = $("#lab"), list = $("#fxlist"), msg = $("#fxmsg");
  VISIBLE.forEach((e) => {
    const row = document.createElement("div");
    row.className = "fx";
    row.innerHTML = `<label><input type="checkbox" data-id="${e.id}"><div><b>${e.name}</b><span>${e.desc}</span></div></label><button title="Phát thử">▶</button>`;
    row.querySelector("input").checked = enabled.includes(e.id);
    row.querySelector("button").addEventListener("click", () => {
      if (phase !== "hold") return;
      startTransition((cur + 1) % N, e.id);
    });
    list.append(row);
  });
  const syncEnabled = () => { enabled = [...list.querySelectorAll("input:checked")].map((i) => i.dataset.id); cyc = 0; };
  list.addEventListener("change", syncEnabled);
  $("#fxall").addEventListener("click", () => { list.querySelectorAll("input").forEach((i) => (i.checked = true)); syncEnabled(); });
  $("#fxnone").addEventListener("click", () => { list.querySelectorAll("input").forEach((i) => (i.checked = false)); syncEnabled(); });
  $("#slow").addEventListener("change", (e) => { timeScale = e.target.checked ? 1 / 3 : 1; });
  $("#fxcopy").addEventListener("click", async () => {
    const txt = "transitions: [" + enabled.map((id) => `"${id}"`).join(", ") + "],";
    try { await navigator.clipboard.writeText(txt); msg.textContent = "Đã copy. Dán vào config.js"; }
    catch (e) { msg.textContent = txt; }
  });
  function toggleLab() {
    labOpen = !labOpen;
    lab.classList.toggle("hidden", !labOpen);
    document.body.classList.toggle("lab-open", labOpen);
    if (labOpen) { pausedBeforeLab = paused; paused = true; document.body.classList.add("paused"); }
    else { paused = pausedBeforeLab; document.body.classList.toggle("paused", paused); timeScale = 1; $("#slow").checked = false; }
  }

  // ===================== Hook cho kiểm thử =====================
  window.__slideshow = {
    state: () => ({ cur, phase, t, done, paused }),
    async preview(id, p) {
      previewLock = true;
      const a = cur >= 0 ? cur : 0, b = (a + 1) % N;
      keepOnly(new Set([a, b]));
      await Promise.all([acquire(a), acquire(b)]);
      render(texOf(a), texOf(b), id, p, 1.02, 1.0);
    },
    unlock() { previewLock = false; },
    effects: () => VISIBLE.map((e) => e.id)
  };
  if (window.Ship) Ship.init({ n: N, accent: C.brand.accent, ship: C.brand.ship });

  requestAnimationFrame(frame);
})();
