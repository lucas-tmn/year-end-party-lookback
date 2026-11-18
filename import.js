// Nhập ảnh thật ngay trong trình duyệt (kéo thả hoặc chọn file/thư mục). CHỈ có trên màn hình bắt đầu:
// bảng này nằm ngoài buổi chiếu và tự ẩn hẳn khi bấm "Bắt đầu".
//  - Ảnh được thu nhỏ (cạnh dài tối đa 2560px) và xoay đúng chiều theo EXIF ngay trên máy, không gửi đi đâu.
//  - Ảnh lưu vào IndexedDB của trình duyệt, nên tải lại trang (F5) không bị mất. Bấm "Xóa ảnh đã import" để quay về ảnh nháp.
(() => {
  const $ = (s) => document.querySelector(s);
  const panel = $("#setup"), grid = $("#sgrid"), msg = $("#smsg"), sortSel = $("#ssort"), cnt = $("#scount");
  const fileIn = $("#fileIn"), dirIn = $("#dirIn");
  const MAXW = 2560, THUMB = 480;
  let items = [];       // { key, name, mtime, size, blob, tblob, src, thumb }
  let opts = { onChange() {}, isRunning: () => false, secondsPerPhoto: 2 };
  let busy = false;

  const isImg = (f) => f && (/^image\//.test(f.type) || /\.(jpe?g|png|webp|avif|gif|bmp)$/i.test(f.name));
  const say = (t, err) => { msg.textContent = t || ""; msg.classList.toggle("err", !!err); };

  // ---------- IndexedDB (có thể bị chặn: khi đó chỉ không nhớ sau khi tải lại trang) ----------
  const idb = () => new Promise((res, rej) => {
    try {
      const rq = indexedDB.open("year-end-lookback", 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore("kv");
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    } catch (e) { rej(e); }
  });
  const idbGet = async () => { try { const db = await idb(); return await new Promise((r) => { const q = db.transaction("kv").objectStore("kv").get("photos"); q.onsuccess = () => r(q.result); q.onerror = () => r(null); }); } catch (e) { return null; } };
  const idbSet = async (val) => {
    try {
      const db = await idb();
      await new Promise((r, j) => { const tx = db.transaction("kv", "readwrite"); tx.objectStore("kv")[val ? "put" : "delete"](...(val ? [val, "photos"] : ["photos"])); tx.oncomplete = r; tx.onerror = () => j(tx.error); });
    } catch (e) { say("Không lưu được vào trình duyệt (vẫn dùng được, nhưng tải lại trang sẽ phải import lại).", true); }
  };

  // ---------- xử lý một ảnh ----------
  const toBlob = (c, q) => new Promise((r) => c.toBlob(r, "image/jpeg", q));
  async function convert(file) {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const sc = Math.min(1, MAXW / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * sc)), h = Math.max(1, Math.round(bmp.height * sc));
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d");
    g.imageSmoothingQuality = "high";
    g.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const ts = Math.min(1, THUMB / Math.max(w, h));
    const t = document.createElement("canvas");
    t.width = Math.max(1, Math.round(w * ts)); t.height = Math.max(1, Math.round(h * ts));
    const tg = t.getContext("2d");
    tg.imageSmoothingQuality = "high";
    tg.drawImage(c, 0, 0, t.width, t.height);
    return { blob: await toBlob(c, 0.9), tblob: await toBlob(t, 0.8) };
  }

  const natural = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
  function sortItems() {
    items.sort(sortSel.value === "time" ? (a, b) => (a.mtime - b.mtime) || natural(a, b) : natural);
  }

  function attachUrls(it) { it.src = URL.createObjectURL(it.blob); it.thumb = URL.createObjectURL(it.tblob); }
  function revoke(it) { try { URL.revokeObjectURL(it.src); URL.revokeObjectURL(it.thumb); } catch (e) {} }

  function render() {
    grid.innerHTML = "";
    items.forEach((it, i) => {
      const d = document.createElement("div");
      d.className = "sc";
      d.innerHTML = `<img alt=""><b>${i + 1}</b><button title="Bỏ ảnh này">✕</button>`;
      d.querySelector("img").src = it.thumb;
      d.querySelector("button").addEventListener("click", () => { revoke(it); items.splice(i, 1); commit(); });
      grid.append(d);
    });
    const n = items.length;
    cnt.textContent = n ? `${n} ảnh đã import · khoảng ${Math.round(n * opts.secondsPerPhoto)} giây` : "Chưa import ảnh nào: đang dùng ảnh nháp";
    $("#sclear").disabled = !n;
  }

  async function commit(skipSave) {
    sortItems();
    render();
    opts.onChange(items.length ? items.map((it) => ({ src: it.src, thumb: it.thumb, name: it.name })) : null);
    if (!skipSave) await idbSet(items.length ? items.map(({ name, mtime, size, blob, tblob }) => ({ name, mtime, size, blob, tblob })) : null);
  }

  // ---------- nhận file ----------
  async function addFiles(files) {
    if (opts.isRunning() || busy) return;
    const list = [...files].filter(Boolean);
    const imgs = list.filter(isImg);
    const skipped = list.length - imgs.length;
    const seen = new Set(items.map((i) => i.key));
    const todo = imgs.filter((f) => !seen.has(f.name + "|" + f.size));
    if (!todo.length) { say(imgs.length ? "Các ảnh này đã có trong danh sách." : "Không thấy file ảnh nào (nhận .jpg, .png, .webp).", !imgs.length); return; }
    busy = true; panel.classList.add("busy");
    const failed = [];
    let done = 0, next = 0;
    const worker = async () => {
      while (next < todo.length) {
        const f = todo[next++];
        try {
          const r = await convert(f);
          const it = { key: f.name + "|" + f.size, name: f.name, mtime: f.lastModified || 0, size: f.size, blob: r.blob, tblob: r.tblob };
          attachUrls(it); items.push(it);
        } catch (e) { failed.push(f.name); }
        say(`Đang xử lý ${++done}/${todo.length}…`);
      }
    };
    await Promise.all([worker(), worker()]);
    busy = false; panel.classList.remove("busy");
    await commit();
    const notes = [];
    if (failed.length) notes.push(`Không đọc được ${failed.length} file: ${failed.slice(0, 3).join(", ")}${failed.length > 3 ? "…" : ""} (ảnh HEIC cần đổi sang JPG)`);
    if (skipped) notes.push(`Bỏ qua ${skipped} file không phải ảnh`);
    say(notes.length ? "Xong. " + notes.join(". ") + "." : `Đã thêm ${todo.length - failed.length} ảnh.`, !!failed.length);
  }

  async function filesFromDrop(dt) {
    const entries = [...(dt.items || [])].map((i) => (i.webkitGetAsEntry ? i.webkitGetAsEntry() : null)).filter(Boolean);
    if (!entries.length) return [...dt.files];
    const out = [];
    const walk = async (en) => {
      if (en.isFile) out.push(await new Promise((r) => en.file(r, () => r(null))));
      else if (en.isDirectory) {
        const rd = en.createReader();
        let batch;
        do { batch = await new Promise((r) => rd.readEntries(r, () => r([]))); for (const e of batch) await walk(e); } while (batch.length);
      }
    };
    for (const en of entries) await walk(en);
    return out;
  }

  // ---------- mở/đóng bảng ----------
  const open = () => { if (!opts.isRunning()) panel.classList.remove("hidden"); };
  const close = () => panel.classList.add("hidden");

  function init(o) {
    opts = { ...opts, ...o };
    $("#setupbtn").addEventListener("click", open);
    $("#sclose").addEventListener("click", close);
    $("#spick").addEventListener("click", () => fileIn.click());
    $("#sdir").addEventListener("click", () => dirIn.click());
    fileIn.addEventListener("change", () => { addFiles(fileIn.files); fileIn.value = ""; });
    dirIn.addEventListener("change", () => { addFiles(dirIn.files); dirIn.value = ""; });
    sortSel.addEventListener("change", () => commit());
    $("#sclear").addEventListener("click", () => {
      if (!items.length || !confirm("Xóa toàn bộ ảnh đã import và quay về ảnh nháp?")) return;
      items.forEach(revoke); items = []; commit(); say("");
    });
    // kéo thả: luôn chặn trình duyệt tự mở ảnh; chỉ nhận khi chưa bắt đầu chiếu
    addEventListener("dragover", (e) => { e.preventDefault(); if (!opts.isRunning()) panel.classList.remove("hidden"), panel.classList.add("over"); });
    addEventListener("dragleave", (e) => { if (!e.relatedTarget) panel.classList.remove("over"); });
    addEventListener("drop", async (e) => {
      e.preventDefault(); panel.classList.remove("over");
      if (opts.isRunning()) return;
      panel.classList.remove("hidden");
      addFiles(await filesFromDrop(e.dataTransfer));
    });
    addEventListener("keydown", (e) => {
      if (opts.isRunning()) return;
      if (e.key === "i" || e.key === "I") { panel.classList.contains("hidden") ? open() : close(); }
      else if (e.key === "Escape") close();
    });
    // khôi phục ảnh đã import trước đó
    idbGet().then((saved) => {
      if (Array.isArray(saved) && saved.length) {
        items = saved.filter((s) => s && s.blob && s.tblob).map((s) => { const it = { ...s, key: s.name + "|" + s.size }; attachUrls(it); return it; });
        commit(true);
        say(`Đã khôi phục ${items.length} ảnh đã import trước đó.`);
      } else render();
    });
  }

  window.PhotoImport = { init, close, count: () => items.length };
})();
