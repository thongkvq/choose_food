# tools/ — công cụ dữ liệu, test và dev của "Món Gì Đây?"

Toàn bộ công cụ là script Node ESM thuần, **không cần cài gì thêm** (`node >= 20`; SQLite dùng `node:sqlite`).
Thư mục này **bị `.vercelignore` loại** nên không lên bản deploy.

```
tools/
  data/   pipeline dữ liệu món ăn (chạy lại được, ghi vào data/)
  test/   test tự động + audit bố cục (chromium thật) — xem test-all.mjs
  dev/    công cụ dev: server tĩnh mô phỏng Vercel, sinh icon, chụp ảnh
  lib/    thư viện dùng chung cho script trong tools/ (mở chromium)
  screenshots/  ảnh chụp do test/dev sinh ra (đã .gitignore)
```

Các script đọc `data/dishes.json` và ghi `data/*.json` bằng đường dẫn **tương đối theo vị trí file**
(qua `import.meta.url`), nên chạy được từ bất kỳ thư mục nào. Không script nào hard-code đường dẫn máy.

---

## data/ — pipeline dữ liệu

| Script | Làm gì | Chạy |
|---|---|---|
| `data-add-dishes.mjs` | Gộp món mới trong `data-new-dishes.json` vào `data/dishes.json` (idempotent: id/tên đã có thì bỏ qua) | `node tools/data/data-add-dishes.mjs` → sau đó chạy `enrich-vung.mjs` |
| `enrich-vung.mjs` | Gán `vung` / `dacSan` / `vungCo` cho MỌI món (bảng phân loại viết tay theo id, có kiểm id phải tồn tại) | `node tools/data/enrich-vung.mjs` |
| `data-patch-aliases.mjs` | Hợp nhất (union) tên tra cứu vào `aliases.json`, không xoá alias cũ | `node tools/data/data-patch-aliases.mjs` |
| `data-fetch-images.mjs` | Tra **ảnh thật** cho món thiếu ảnh: Wikipedia vi → en → Commons, tiêu đề nguồn phải khớp trọn tên món, ép thumbnail 960px, không dùng lại ảnh của món khác | `node tools/data/data-fetch-images.mjs` · tra lại vài món: `TARGETS=id1,id2 node …` · xem trước: thêm `DRY=1` |
| `data-enrich-info.mjs` | Điền chỗ trống: `intro` + `introSource` + `wikiUrl` + `wikiTitle` (Wikipedia), `facts` (Wikidata), `detail` (mục trong wikitext); bài tiếng Anh được dịch sang tiếng Việt (cache ở `tools/data/.translate-cache.json`) | `node tools/data/data-enrich-info.mjs` |
| `enrich-dishes.mjs` | Ước tính điểm/sao/nhận xét, calo–đạm, giá, thời điểm ăn, mẹo (đánh dấu rõ là "ước tính") | `node tools/data/enrich-dishes.mjs` |
| `normalize-image-urls.mjs` | Chuẩn hoá URL ảnh về thumbnail Wikimedia đúng bậc (500/960/1280), bỏ query tracking | `node tools/data/normalize-image-urls.mjs` |
| `audit-images.mjs` | Đối chiếu tên file nguồn với tên món + alias, in báo cáo độ khớp (không gọi mạng) | `node tools/data/audit-images.mjs` |
| `verify-images.mjs` | Kiểm URL ảnh còn sống + content-type + mức trùng (chậm, có backoff 429) | `node tools/data/verify-images.mjs` |
| `data-split.mjs` | Tách `dishes.json` → `dishes-lite.json` (lần tải đầu) + `dishes-detail-0..3.json` (mở popup mới tải). Chạy lại là tất định; đổi `CHUNKS` trong file nếu muốn nhiều mảnh hơn | `node tools/data/data-split.mjs` |
| `data-sync-sqlite.mjs` | Đồng bộ `data/dishes.json` → `data/dishes.sqlite` (bảng `dishes`, xoá dòng thừa) | `node tools/data/data-sync-sqlite.mjs` |
| `data-validate.mjs` | Kiểm dữ liệu: id duy nhất/ASCII, enum hợp lệ, ảnh (URL thumbnail, không trùng, nguồn khớp tên), JSON ↔ SQLite, và 5 file đã tách khớp **từng byte** với `dishes.json`. Exit 1 nếu có lỗi | `node tools/data/data-validate.mjs` |

Dữ liệu dùng chung: `aliases.json` (tên tra cứu theo id), `data-new-dishes.json` (đầu vào của `data-add-dishes.mjs`).

**Thứ tự pipeline khi thêm/sửa món:**
`data-add-dishes.mjs` → `enrich-vung.mjs` → `data-patch-aliases.mjs` → `data-fetch-images.mjs` → `data-enrich-info.mjs` → `data-sync-sqlite.mjs` → `data-split.mjs` → `data-validate.mjs`.

---

## test/ — test tự động (chromium thật)

Chạy một file: `node tools/test/<tên>.mjs [baseUrl]` (mặc định `http://127.0.0.1:4321`).
Chạy TẤT CẢ: `node tools/test/test-all.mjs [baseUrl]` — hoặc chỉ vài file: `node tools/test/test-all.mjs http://127.0.0.1:4399 pwa,split`.

| Script | Kiểm gì |
|---|---|
| `test-all.mjs` | Chạy mọi `test-*.mjs` + 3 audit bên dưới, in tổng hợp exit code theo từng file |
| `test-pwa.mjs` | PWA/offline: manifest + icon, chiến lược cache của `sw.js`, ảnh **Wikimedia thật** được cache với nội dung > 0 byte và hiện đúng (online → reload → offline, không rơi về SVG fallback), `vercel.json` không trộn `routes` với `headers/rewrites/redirects/cleanUrls/trailingSlash` |
| `test-split.mjs` | Tách dữ liệu: lần tải đầu không tải `dishes.json`, popup mở ngay bằng lite rồi điền phần chi tiết, lỗi mạng vẫn đủ phần lite |
| `test-avoid.mjs` | "Tránh món đã ăn gần đây": đo 2000 lần quay, món vừa ăn/vừa quay ra bị giảm trọng số, tắt công tắc thì trở lại bình thường |
| `test-share.mjs` | Link chia sẻ `#mon=<id>`: mở link ra đúng popup, đóng thì xoá hash, nút 🔗 dùng `navigator.share` hoặc copy |
| `test-vung.mjs` | Bộ lọc vùng miền: đếm món theo vùng, tự bỏ lọc bữa khi 0 món, chip hiện số món, popup có dòng vùng |
| `test-vnonly.mjs` | Công tắc "chỉ món Việt" mặc định BẬT, chip ngoại bị mờ, nhớ trạng thái |
| `test-nearby-radius.mjs` | 4 mức bán kính 2.5/5/10/15km: API làm tròn lên đúng mức, UI đổi chip, không lọt quán ngoài bán kính, khối "quán có tiếng" |
| `test-fame-mock.mjs` | Khối "quán có tiếng" + danh sách quán khớp món bằng dữ liệu GIẢ (chặn mạng) — test được cả khi Photon/Overpass sập |
| `test-nearby-core.mjs` | Unit test `lib/nearby-core.js` (chuẩn hoá tên, khoảng cách, khớp món) — không cần mạng, không cần server |
| `test-api.mjs` | 5 route `/api/*` của server LAN (whereami/weather/geocode/nearby/reverse-geocode) |
| `test-gps.mjs` | GPS giả + `vungFromPlace()`/`vungFromCoords()` (mặc định chạy trên HTTPS tự ký 8443, truyền base URL khác để dùng LAN/tĩnh) |
| `test-loc-http.mjs` | Nhập vị trí bằng tay (địa chỉ / lat,lng) trên http LAN |
| `test-olddata.mjs` | Dữ liệu cache CŨ (thiếu trường mới) vẫn mở popup bình thường |
| `test-popup.mjs`, `test-detail.mjs`, `test-intro.mjs`, `test-touch.mjs`, `test-lock.mjs`, `test-dialog.mjs`, `test-result-card.mjs` | Popup kết quả: chạm/vuốt, mở–đóng, khoá/chốt món, mục Chi tiết, Giới thiệu, thẻ kết quả ở nhiều cỡ màn |
| `test-clip.mjs` | Không cắt mất chữ trong popup ở 3 cỡ màn |
| `test-today.mjs`, `test-today-ui.mjs` | Chip bối cảnh (thời tiết/giờ) + panel "Hôm nay" (thực đơn, kcal, nhật ký) |
| `test-bias.mjs` | Bias theo thời tiết: đo 4000 lần quay cho mưa/nóng/lạnh |
| `test-live.mjs` | Kiểm web sau khi deploy (hoặc LAN/tĩnh): HTML/JS/CSS/lite/manifest/ảnh, dung lượng |
| `test-vercel-live.mjs` | Mở browser thật trên bản production: nạp trang, chip thời tiết, quay ra popup, GPS → quán gần đây |
| `audit-layout.mjs` | Bố cục 3 cỡ màn điện thoại: tràn ngang, phần tử chồng nhau, tap target < 44px |
| `audit-desktop.mjs` | Bố cục ở các cỡ màn desktop |
| `verify-desktop-mobile.mjs` | Đo + chụp ảnh cả desktop lẫn mobile (ảnh vào `tools/screenshots/`) |

`lib/chromium.mjs` nạp Playwright theo thứ tự `$PLAYWRIGHT_DIR` → `node_modules` của project → `$DSH_HOME/profiles/web`
và dùng đúng chromium mà Playwright đã cài (`$CHROME_BIN` để ép bản khác). Test nào cần mạng ngoài
(Wikimedia, Photon, Overpass, Open-Meteo) sẽ **SKIP** kèm lý do khi dịch vụ đó không tới được.

---

## dev/ — công cụ dev

| Script | Làm gì | Chạy |
|---|---|---|
| `probe-static.mjs` | Server TĨNH thuần (không `/api`, đúng như bản Vercel) để chạy test ở chế độ tĩnh; trả MIME `.webmanifest` | `node tools/dev/probe-static.mjs [port]` (mặc định 4399) |
| `make-icons.mjs` | Sinh `icons/icon-192.png`, `icon-512.png`, `maskable-512.png`, `logo.svg` từ SVG vẽ bằng code (render bằng chromium) | `node tools/dev/make-icons.mjs` |
| `screenshots.mjs` | Chụp ảnh app ở 2 cỡ màn (ảnh vào `tools/screenshots/`). Container không có font hệ thống nên tự nhúng font từ `$SHOT_FONT` nếu biến này được đặt | `node tools/dev/screenshots.mjs [baseUrl]` |

---

## Quy trình kiểm tra trước khi deploy

```bash
node server.js &                                  # LAN (đổi cổng: PORT=4322 node server.js)
node tools/dev/probe-static.mjs 4399 &            # bản tĩnh (mô phỏng Vercel)
node tools/test/test-all.mjs http://127.0.0.1:4322
node tools/test/test-all.mjs http://127.0.0.1:4399
node tools/data/data-validate.mjs                 # exit 0
```
