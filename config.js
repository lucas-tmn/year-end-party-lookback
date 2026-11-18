// Chỉnh các thông số của slideshow tại đây. Không cần sửa app.js.
window.CONFIG = {
  title: "Year End Party 2026",
  subtitle: "Look back",

  // ---- Nhịp chiếu ----
  secondsPerPhoto: 2,   // tổng thời gian mỗi ảnh (giây), gồm cả lúc chuyển cảnh
  transitionMs: 700,    // thời gian chuyển cảnh (ms)
  zoom: 1.05,           // zoom nhẹ khi ảnh đang hiện; 1 = tắt
  shuffle: false,       // true = xáo trộn thứ tự ảnh

  // ---- Hiệu ứng chuyển ảnh ----
  // Danh sách id hiệu ứng được dùng (để null = dùng tất cả). Nhấn phím T khi đang chiếu
  // để mở bảng thử hiệu ứng, chọn xong bấm "Copy config" rồi dán vào đây.
  transitions: null,
  transitionOrder: "cycle",   // "cycle" = lần lượt, "random" = ngẫu nhiên (không lặp liền kề)
  perPhoto: {},               // ép hiệu ứng cho ảnh cụ thể. Ví dụ: { 29: "radial" } (ảnh số 30)

  // ---- Khung ảnh (tỉ lệ so với màn hình). Phần ngoài khung là nền thương hiệu ----
  frame: { x: 0.156, top: 0.175, bottom: 0.225, radius: 18 },

  // ---- Thương hiệu (cố định trong suốt buổi chiếu) ----
  brand: {
    logo: "assets/logo.svg",   // thay bằng file logo Ashley chính thức (SVG hoặc PNG nền trong suốt)
    slogan: "Next Level",
    color1: "#0b1530",         // màu nền (đậm)
    color2: "#17316b",         // màu nền (sáng hơn)
    accent: "#f2b84b",         // màu nhấn: viền sáng của hiệu ứng, slogan
    ship: "#ff7a1a"            // màu phi thuyền (cam)
  },

  // Nhãn chương hiện ở góc dưới trái khi tới ảnh số N (đếm từ 0).
  // Ví dụ: { 0: "Check-in", 8: "Biểu diễn", 18: "Lucky draw", 26: "Ảnh tập thể" }
  chapters: {},

  // File nhạc nền (đặt cạnh index.html), để trống nếu không dùng. Ví dụ: "music.mp3"
  music: "",
  musicVolume: 0.7,

  closingTitle: "Cảm ơn mọi người",
  closingText: "Hẹn gặp lại năm sau"
};
