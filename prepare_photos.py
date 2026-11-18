#!/usr/bin/env python3
"""Chuẩn bị ảnh cho slideshow (tạm thời, cho tới khi có chức năng import trong trình duyệt).

Đọc ảnh gốc (từ máy ảnh) trong một thư mục, xoay đúng chiều theo EXIF, thu nhỏ,
nén JPEG, tạo thumbnail rồi nhúng tất cả vào photos.js (dạng data URI).
Lý do nhúng: Chrome không cho WebGL đọc ảnh từ file:// nếu chúng là file rời.
Ảnh gốc KHÔNG bị thay đổi.

Cách dùng:
    pip install pillow
    python3 prepare_photos.py /duong/dan/anh_goc
    python3 prepare_photos.py /duong/dan/anh_goc --max 3840      # màn hình 4K
    python3 prepare_photos.py /duong/dan/anh_goc --sort name     # theo tên file
"""
import argparse
import base64
import io
import re
import sys
from datetime import datetime
from pathlib import Path

from PIL import ExifTags, Image, ImageOps

EXTS = {".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"}
HERE = Path(__file__).resolve().parent


def natural_key(p: Path):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", p.name)]


def capture_time(p: Path) -> float:
    """Giờ chụp theo EXIF; nếu không có thì dùng thời gian sửa file."""
    try:
        with Image.open(p) as im:
            exif = im.getexif()
            sub = exif.get_ifd(ExifTags.IFD.Exif)
            raw = sub.get(36867) or exif.get(306)  # DateTimeOriginal / DateTime
            if raw:
                return datetime.strptime(str(raw), "%Y:%m:%d %H:%M:%S").timestamp()
    except Exception:
        pass
    return p.stat().st_mtime


def to_data_uri(im: Image.Image, longest: int, quality: int) -> str:
    im = im.copy()
    im.thumbnail((longest, longest), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=quality, optimize=True, progressive=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("src", type=Path, help="thư mục chứa ảnh gốc")
    ap.add_argument("--max", type=int, default=2560, help="cạnh dài tối đa (mặc định 2560)")
    ap.add_argument("--quality", type=int, default=85, help="chất lượng JPEG (mặc định 85)")
    ap.add_argument("--sort", choices=["time", "name"], default="time", help="thứ tự ảnh (mặc định: giờ chụp)")
    a = ap.parse_args()

    if not a.src.is_dir():
        sys.exit(f"Không tìm thấy thư mục: {a.src}")
    files = [p for p in a.src.iterdir() if p.is_file() and p.suffix.lower() in EXTS]
    if not files:
        sys.exit("Không có ảnh nào trong thư mục.")
    files.sort(key=capture_time if a.sort == "time" else natural_key)

    lines = ["// File này được tạo tự động bởi prepare_photos.py", "window.PHOTOS = ["]
    for i, p in enumerate(files, 1):
        with Image.open(p) as im:
            im = ImageOps.exif_transpose(im)
            if im.mode != "RGB":
                im = im.convert("RGB")
            src = to_data_uri(im, a.max, a.quality)
            thumb = to_data_uri(im, 480, 80)
        lines.append(f'  {{ src: "{src}", thumb: "{thumb}" }},')
        print(f"[{i:>3}/{len(files)}] {p.name}")
    lines.append("];")

    out = HERE / "photos.js"
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"\nXong: {len(files)} ảnh -> {out.name} ({out.stat().st_size / 1024 / 1024:.1f} MB)")


if __name__ == "__main__":
    main()
