# Year End Look Back (v3)

Slideshow ảnh chạy trên trình duyệt, không cần internet. Chuyển ảnh bằng WebGL (15 hiệu ứng),
nền thương hiệu Ashley cố định, và phi thuyền cam bay dần tới đích "Next Level" theo từng ảnh.

## Cấu trúc

| File | Vai trò |
|------|---------|
| `index.html`, `style.css` | Khung trang, lớp thương hiệu (nền, logo, slogan), màn hình bắt đầu/kết thúc |
| `app.js` | Engine: WebGL, timeline, điều khiển, bảng thử hiệu ứng |
| `effects.js` | Thư viện hiệu ứng: 14 shader GLSL (định dạng gl-transitions) |
| `ship.js` | Phi thuyền (ảnh `assets/ship.png`), đường đứt khúc chuyển động, đường bay, cổng đích và pháo hoa |
| `assets/ship.png` | Hình phi thuyền thiết kế riêng, đã xoay ngang, nền trong suốt (thay file này để đổi tàu) |
| `config.js` | Mọi thông số: nhịp chiếu, hiệu ứng, màu brand, slogan, nhạc |
| `assets/logo.svg` | Logo Ashley (tam giác cam, vector) |
| `photos.js` | Danh sách ảnh (hiện là ảnh demo) |
| `prepare_photos.py` | Tạm thời: nén ảnh gốc và ghi `photos.js` (sẽ thay bằng import trong trình duyệt) |

## Dùng

1. (Khi có ảnh thật) `pip install pillow` rồi `python3 prepare_photos.py /duong/dan/anh_goc`
2. Mở `index.html` bằng Chrome hoặc Edge, bấm **Bắt đầu**.
3. Nhấn **T** để mở bảng thử hiệu ứng: bấm ▶ để xem từng hiệu ứng, bỏ chọn cái không thích,
   bật "Chậm ×3" để xem kỹ, rồi **Copy config** và dán dòng `transitions: [...]` vào `config.js`.

## Phi thuyền "Next Level"

Phi thuyền là hình thiết kế riêng (`assets/ship.png`, mũi hướng phải), bay ngang trên đường bay ở dưới cùng.
Mỗi ảnh là một chấm; mỗi lần chuyển ảnh tàu bay tới chấm kế tiếp. Các đường đứt khúc phía sau tàu được vẽ bằng code:
khi tàu lao tới chúng dài ra và các đoạn chạy ra sau nhanh hơn, khi giữ ảnh chúng ngắn lại và trôi chậm.
Tới ảnh cuối, tàu vào cổng "Next Level", slogan bừng sáng, pháo hoa nổ ra và các đường đứt khúc thưa dần.
Chỉnh kích thước tàu bằng `shipWidth` trong `ship.js`, vị trí/màu/độ dài từng đường trong mảng `lanes`.

## Phím tắt

Space: tạm dừng · ← / →: ảnh trước/sau · F: toàn màn hình · M: nhạc · R: chiếu lại · T: bảng hiệu ứng

## Thêm hiệu ứng mới

Hiệu ứng shader: thêm một mục vào `effects.js` với hàm `vec4 transition(vec2 uv)` (có thể dán từ
gl-transitions.com, kiểm tra license từng shader). 

## Chạy thử với ảnh demo

`photos.js` (ảnh thật) được git bỏ qua vì repo là public. Để thử nhanh:

```
pip install pillow
python3 tools/make_demo_photos.py demo_src      # tạo 30 ảnh giả
python3 prepare_photos.py demo_src --sort name  # ghi photos.js
```

## Lưu ý

- Repo public: không commit ảnh thật của buổi tiệc, và cân nhắc việc đưa logo Ashley chính thức vào repo
  (hiện `assets/logo.svg` chỉ là placeholder).

- Ảnh được nhúng vào `photos.js` vì Chrome không cho WebGL đọc ảnh rời từ `file://`.
  Chức năng import trong trình duyệt sẽ không cần bước này.
- Thử trên đúng laptop và projector trước buổi tiệc. Tắt chế độ ngủ và thông báo của máy.
