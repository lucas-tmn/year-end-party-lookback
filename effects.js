// Thư viện hiệu ứng chuyển ảnh (GLSL).
// Mỗi hiệu ứng là một hàm `vec4 transition(vec2 uv)` theo định dạng của gl-transitions,
// nên có thể dán thêm shader từ gl-transitions.com vào đây.
//
// Biến có sẵn trong shader:
//   progress (0..1), ratio (rộng/cao), accent (màu nhấn của brand, vec3)
//   getFromColor(uv), getToColor(uv)  -> ảnh cũ / ảnh mới (alpha = 0 ở vùng ngoài khung ảnh)
//   hash(vec2), noise(vec2), easeIO(float), PI
window.EFFECTS = [
  {
    id: "crossfade", name: "Crossfade", desc: "Mờ dần, nhẹ nhàng",
    glsl: `
vec4 transition(vec2 uv){
  return mix(getFromColor(uv), getToColor(uv), progress);
}`
  },
  {
    id: "zoomthru", name: "Zoom xuyên", desc: "Phóng vào ảnh cũ, ảnh mới lao ra từ gần",
    glsl: `
vec4 transition(vec2 uv){
  float p = easeIO(progress);
  vec2 c = vec2(0.5);
  vec4 a = getFromColor(c + (uv - c) / (1.0 + p * 1.4));
  vec4 b = getToColor(c + (uv - c) / (1.0 + (1.0 - p) * 0.8));
  return mix(a, b, smoothstep(0.25, 0.75, p));
}`
  },
  {
    id: "ripple", name: "Gợn nước", desc: "Sóng lan từ tâm rồi hiện ảnh mới",
    glsl: `
vec4 transition(vec2 uv){
  vec2 dir = uv - 0.5; dir.x *= ratio;
  float dist = length(dir);
  float amp = sin(progress * PI);
  vec2 off = normalize(dir + 1e-5) * sin(dist * 38.0 - progress * 16.0) * 0.02 * amp;
  off.x /= ratio;
  vec4 a = getFromColor(uv + off);
  vec4 b = getToColor(uv + off * 0.4);
  return mix(a, b, smoothstep(0.2, 0.8, progress));
}`
  },
  {
    id: "glitch", name: "Glitch", desc: "Nhiễu băng, lệch màu RGB (hợp chủ đề công nghệ)",
    glsl: `
vec4 transition(vec2 uv){
  float s = sin(progress * PI);
  float band = floor(uv.y * 28.0);
  float stp = floor(progress * 10.0);
  float h = hash(vec2(band, stp));
  float shift = (h - 0.5) * 0.18 * s * step(0.35, hash(vec2(band, stp + 3.0)));
  vec2 u = vec2(uv.x + shift, uv.y);
  float t = step(hash(vec2(band, 9.0)), progress);
  float sp = 0.012 * s;
  vec4 r = mix(getFromColor(u + vec2(sp, 0.0)), getToColor(u + vec2(sp, 0.0)), t);
  vec4 g = mix(getFromColor(u), getToColor(u), t);
  vec4 b = mix(getFromColor(u - vec2(sp, 0.0)), getToColor(u - vec2(sp, 0.0)), t);
  return vec4(r.r, g.g, b.b, g.a);
}`
  },
  {
    id: "pixelize", name: "Pixelize", desc: "Vỡ thành điểm ảnh rồi rõ nét trở lại",
    glsl: `
vec4 transition(vec2 uv){
  float s = sin(progress * PI);
  vec2 p = uv;
  if (s > 0.03) {
    float size = s * 0.085;
    vec2 cell = vec2(size / ratio, size);
    p = (floor(uv / cell) + 0.5) * cell;
  }
  return mix(getFromColor(p), getToColor(p), smoothstep(0.35, 0.65, progress));
}`
  },
  {
    id: "swirl", name: "Xoáy", desc: "Xoáy tròn quanh tâm",
    glsl: `
vec4 transition(vec2 uv){
  vec2 d = uv - 0.5; d.x *= ratio;
  float r = length(d);
  float a = (1.0 - smoothstep(0.0, 0.75, r)) * sin(progress * PI) * 7.0;
  float cs = cos(a), sn = sin(a);
  d = vec2(cs * d.x - sn * d.y, sn * d.x + cs * d.y);
  d.x /= ratio;
  vec2 u = d + 0.5;
  return mix(getFromColor(u), getToColor(u), smoothstep(0.3, 0.7, progress));
}`
  },
  {
    id: "radial", name: "Mở tròn", desc: "Vòng sáng lan từ tâm, để lộ ảnh mới",
    glsl: `
vec4 transition(vec2 uv){
  vec2 d = (uv - 0.5) * vec2(ratio, 1.0);
  float r = length(d);
  float R = progress * length(vec2(ratio, 1.0) * 0.5) * 1.08;
  float m = 1.0 - smoothstep(R - 0.05, R, r);
  vec4 c = mix(getFromColor(uv), getToColor(uv), m);
  float ring = smoothstep(R - 0.02, R, r) * (1.0 - smoothstep(R, R + 0.012, r)) * sin(progress * PI);
  c.rgb += accent * ring * c.a * 1.4;
  return c;
}`
  },
  {
    id: "stairs", name: "Level up", desc: "Quét lên theo từng bậc thang, viền sáng chạy theo",
    glsl: `
vec4 transition(vec2 uv){
  float n = 9.0;
  float col = floor(uv.x * n) / n;
  float delay = col * 0.45;
  float p = clamp((progress - delay) / 0.55, 0.0, 1.0);
  p = p * p * (3.0 - 2.0 * p);
  float edge = p * 1.04;
  float m = 1.0 - smoothstep(edge - 0.015, edge, uv.y);
  vec4 c = mix(getFromColor(uv), getToColor(uv), m);
  float band = m * (1.0 - m) * 4.0;
  c.rgb += accent * band * 0.9 * c.a;
  return c;
}`
  },
  {
    id: "tiles", name: "Lật ô", desc: "Ảnh vỡ thành ô và lật lần lượt",
    glsl: `
vec4 transition(vec2 uv){
  vec2 g = vec2(floor(7.0 * ratio + 0.5), 7.0);
  vec2 cell = floor(uv * g);
  vec2 lc = fract(uv * g);
  float delay = hash(cell) * 0.45 + (cell.x / g.x) * 0.1;
  float p = clamp((progress - delay) / 0.45, 0.0, 1.0);
  p = p * p * (3.0 - 2.0 * p);
  float sx = abs(cos(p * PI));
  float lx = (lc.x - 0.5) / max(sx, 0.001) + 0.5;
  if (lx < 0.0 || lx > 1.0) return vec4(0.0);
  vec2 u = (cell + vec2(lx, lc.y)) / g;
  vec4 c = (p > 0.5) ? getToColor(u) : getFromColor(u);
  c.rgb *= 0.6 + 0.4 * sx;
  return c;
}`
  },
  {
    id: "doors", name: "Mở cửa", desc: "Ảnh tách đôi như cánh cửa, ảnh mới ở phía sau",
    glsl: `
vec4 transition(vec2 uv){
  float p = easeIO(progress);
  float h = p * 0.5;
  vec2 c = vec2(0.5);
  vec4 res = getToColor(c + (uv - c) / (0.88 + 0.12 * p));
  float e = 1.0;
  if (uv.x < 0.5 - h) { res = getFromColor(uv + vec2(h, 0.0)); e = abs(uv.x - (0.5 - h)); }
  else if (uv.x > 0.5 + h) { res = getFromColor(uv - vec2(h, 0.0)); e = abs(uv.x - (0.5 + h)); }
  res.rgb *= 1.0 - 0.4 * (1.0 - smoothstep(0.0, 0.05, e)) * step(0.001, progress);
  return res;
}`
  },
  {
    id: "whip", name: "Lướt ngang", desc: "Trượt nhanh sang bên với vệt mờ chuyển động",
    glsl: `
vec4 transition(vec2 uv){
  float p = easeIO(progress);
  float bl = 0.07 * sin(progress * PI);
  vec4 acc = vec4(0.0);
  for (int i = 0; i < 10; i++) {
    float o = (float(i) / 9.0 - 0.5) * bl;
    vec4 a = getFromColor(uv + vec2(p + o, 0.0));
    vec4 b = getToColor(uv - vec2(1.0 - p - o, 0.0));
    acc += a + b * (1.0 - a.a);
  }
  return acc / 10.0;
}`
  },
  {
    id: "blinds", name: "Rèm ngang", desc: "Các dải ảnh trượt ngược chiều nhau",
    glsl: `
vec4 transition(vec2 uv){
  float n = 10.0;
  float idx = floor(uv.y * n);
  float dir = mod(idx, 2.0) * 2.0 - 1.0;
  float p = easeIO(progress);
  vec4 a = getFromColor(uv + vec2(dir * p, 0.0));
  vec4 b = getToColor(uv - vec2(dir * (1.0 - p), 0.0));
  return a + b * (1.0 - a.a);
}`
  },
  {
    id: "lightleak", name: "Chớp sáng", desc: "Vệt sáng màu brand quét ngang khi đổi ảnh",
    glsl: `
vec4 transition(vec2 uv){
  float s = sin(progress * PI);
  vec4 c = mix(getFromColor(uv), getToColor(uv), smoothstep(0.25, 0.75, progress));
  float g = exp(-pow((uv.x - (progress * 1.4 - 0.2)) * 2.5, 2.0));
  vec3 leak = mix(accent, vec3(1.0, 0.95, 0.85), 0.4) * g * s * 1.1;
  c.rgb += leak * c.a;
  c.rgb *= 1.0 + 0.1 * s;
  return c;
}`
  },
  {
    id: "burn", name: "Cháy viền", desc: "Ảnh mới lan ra như giấy cháy, viền sáng màu brand",
    glsl: `
vec4 transition(vec2 uv){
  vec2 q = uv * vec2(ratio, 1.0);
  float n = noise(q * 5.0) * 0.6 + noise(q * 13.0) * 0.4;
  float t = progress * 1.3 - 0.15;
  float d = t - n;
  float m = smoothstep(0.0, 0.02, d);
  float band = smoothstep(-0.04, 0.0, d) * (1.0 - smoothstep(0.0, 0.07, d));
  vec4 c = mix(getFromColor(uv), getToColor(uv), m);
  c.rgb += accent * band * 1.5 * c.a + vec3(1.0, 0.9, 0.7) * band * band * 0.6 * c.a;
  return c;
}`
  },

  // ---------------------------------------------------------------------------
  // Hiệu ứng thiết kế riêng: ghép mảnh tam giác (mesh WebGL, không phải fragment thuần).
  // Ảnh mới được ghép từ các mảnh tam giác bay vào từ mọi hướng, xoay và khớp vào đúng chỗ,
  // viền sáng màu brand mờ dần khi mảnh khớp. Ảnh cũ mờ đi phía sau.
  // ---------------------------------------------------------------------------
  {
    id: "_fromfade", hidden: true,
    glsl: `
vec4 transition(vec2 uv){
  return getFromColor(uv) * (1.0 - smoothstep(0.0, 0.55, progress));
}`
  },
  {
    id: "puzzle", name: "Ghép mảnh Ashley", desc: "Ảnh ghép từ các mảnh tam giác bay vào và khớp lại",
    durMs: 1100,
    mesh: {
      bg: "_fromfade",
      rows: 8,
      // Tạo lưới tam giác phủ kín ảnh. Mỗi đỉnh: aPos(2) aCen(2) aRnd(3) aBary(3)
      build(ratio) {
        const rows = this.rows, cols = Math.max(4, Math.round(rows * ratio));
        let seed = 20261118;
        const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
        const out = [];
        const bary = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
        const tri = (v, i) => {
          const cx = (v[0][0] + v[1][0] + v[2][0]) / 3, cy = (v[0][1] + v[1][1] + v[2][1]) / 3;
          const r = [0.55 * rnd() + 0.45 * (i / cols), rnd(), rnd()];
          for (let k = 0; k < 3; k++) out.push(v[k][0], v[k][1], cx, cy, r[0], r[1], r[2], ...bary[k]);
        };
        for (let j = 0; j < rows; j++) {
          for (let i = 0; i < cols; i++) {
            const x0 = i / cols, x1 = (i + 1) / cols, y0 = j / rows, y1 = (j + 1) / rows;
            tri([[x0, y0], [x1, y0], [x0, y1]], i);
            tri([[x1, y1], [x0, y1], [x1, y0]], i);
          }
        }
        return new Float32Array(out);
      },
      vert: `
attribute vec2 aPos; attribute vec2 aCen; attribute vec3 aRnd; attribute vec3 aBary;
uniform float progress, ratio;
varying vec2 vFinal; varying vec3 vBary; varying float vP;
const float PI = 3.14159265359;
void main(){
  float delay = aRnd.x * 0.5;
  float p = clamp((progress - delay) / 0.5, 0.0, 1.0);
  float q = p - 1.0;
  float e = 1.0 + 2.4 * q * q * q + 1.4 * q * q;        // vào nhanh, vượt nhẹ rồi khớp
  vec2 rel = aPos - aCen;
  float ang = (aRnd.y - 0.5) * 2.0 * PI * (1.0 - e);
  vec2 r2 = vec2(rel.x * ratio, rel.y);
  float cs = cos(ang), sn = sin(ang);
  r2 = vec2(cs * r2.x - sn * r2.y, sn * r2.x + cs * r2.y);
  rel = vec2(r2.x / ratio, r2.y);
  float sc = mix(0.15, 1.0, e);
  float a2 = aRnd.z * 2.0 * PI;
  float dist = 0.7 + aRnd.x * 0.5;
  vec2 off = vec2(cos(a2), sin(a2)) * dist * (1.0 - e);
  vec2 pos = aCen + off + rel * sc;
  gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
  vFinal = aPos; vBary = aBary; vP = p;
}`,
      frag: `
precision highp float;
varying vec2 vFinal; varying vec3 vBary; varying float vP;
uniform sampler2D uTo;
uniform float zt;
uniform vec3 accent;
void main(){
  vec2 s = (vFinal - 0.5) / zt + 0.5;
  vec4 c = (s.x < 0.0 || s.x > 1.0 || s.y < 0.0 || s.y > 1.0) ? vec4(0.0) : texture2D(uTo, s);
  float edge = min(vBary.x, min(vBary.y, vBary.z));
  float glow = (1.0 - smoothstep(0.0, 0.07, edge)) * (1.0 - vP);
  c.rgb += accent * glow * c.a * 1.3;
  gl_FragColor = c * smoothstep(0.0, 0.2, vP);
}`
    }
  }
];
