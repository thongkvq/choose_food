# CONTEXT SUMMARY — Món Gì Đây? (web gacha chọn món ăn)

_Cập nhật: sau task-11 (v27). Trạng thái: ĐANG CHẠY, đã verify trên LAN + bản tĩnh. Bản production: https://choose-food-paroda.vercel.app_

## 1. Yêu cầu gốc (giữ nguyên ý)
"Web chọn món ăn sáng/trưa/chiều/ăn vặt… quay như gacha, có hình minh hoạ món ăn, món Việt/Tây/Tàu…, món khô/nước/chiên/nướng, hiệu ứng đẹp mắt."
Bổ sung sau đó: quay kiểu **băng chuyền chạy ngang** dừng từ từ; ảnh món **chính xác**; **chỉ dùng trên mobile**; thao tác phải dễ, **có nút bấm để quay**; chọn xong phải hiện **popup thông tin món**; thông tin món **chi tiết**; lấy **thông tin tiếng Anh rồi dịch sang tiếng Việt**; **dùng toạ độ thiết bị** để liệt kê **quán bán món đó gần đây**.

## 2. Chạy & truy cập
    node server.js            # chạy từ thư mục project, tự in URL (đổi cổng: PORT=4322 node server.js)
- HTTP  (LAN)     : http://192.168.100.13:4321      ← dùng hằng ngày
- HTTP  (máy này) : http://127.0.0.1:4321
- HTTPS (LAN)     : https://192.168.100.13:8443     ← **cần để dùng GPS thật** (chứng chỉ tự ký, bấm "Nâng cao → Tiếp tục")
- Bản tĩnh (mô phỏng Vercel, không có `/api`): `node tools/dev/probe-static.mjs 4399`
- `package.json` **không có `scripts`** (cố ý — xem mục 13). Cache đã tắt (`no-cache, must-revalidate`) cho html/js/css/json → F5 là thấy bản mới; gzip bật.

## 3. Kiến trúc & quyết định chính
- **Vanilla JS ES module, không build step, không dependency runtime**; `server.js` là static server + 5 API. Logic tìm quán dùng chung ở `lib/nearby-core.js` (app.js + server.js).
- **Vercel = web TĨNH thuần** (không serverless, `api/` đã bỏ hẳn): `/api/*` trả 404, client tự chuyển sang gọi thẳng Photon / Open-Meteo / ipapi.co.
- **SQLite là nguồn dữ liệu gốc**, export ra `data/dishes.json`; frontend chỉ tải `data/dishes-lite.json` + `data/dishes-detail-*.json` (tách 2 tầng, xem mục 24).
- **307 món** (215 Việt + 92 quốc tế), 6 bữa (sang/trua/xe/toi/khuya/vat), 11 nền ẩm thực, 10 cách chế biến, 4 bậc độ hiếm (45/30/18/7%) + pity 10 lần.
- **Hình minh hoạ**: 23 template SVG vẽ bằng code (`art.js`) + ảnh thật từ Wikipedia/Wikimedia (280 món có ảnh, 27 món dùng SVG).
- **Chỉ quay bằng nút** "🎰 QUAY 1 MÓN" / "⚡ x10" (khung quay đã tắt nhận chạm; không còn vuốt-để-quay).
- **Popup kết quả** tự mở sau khi băng chuyền dừng, render phòng thủ (try/catch + fallback) nên dữ liệu cũ cũng không làm trắng thẻ.

## 4. Dữ liệu mỗi món (trong data/dishes.json + SQLite)
| Trường | Nội dung | Độ phủ (307 món) |
|---|---|---|
| name/emoji/region/meals/style/tags/descr | cơ bản | 307 |
| price/minutes/spicy/veg/weight/tier | thuộc tính gacha | 307 |
| image + imageVia + imageSource | ảnh thật có nguồn (vi-wiki 124 / en-wiki 45 / commons 111) | 280 |
| rating + stars + review | điểm 7.1–9.8 + nhận xét | 307 |
| calories/protein/proteinLabel/fullness/priceRange/bestFor/bestTime/origin/tip | ước tính + gợi ý (ghi rõ "ước tính") | 307 |
| intro + introSource + wikiUrl + introEn | đoạn mở đầu Wikipedia, **đã dịch sang tiếng Việt** | 273 |
| facts {originCountry,cuisine,ingredients,type} | Wikidata | 246 |
| detail[{t,body}] | mục Nguồn gốc/Nguyên liệu/Cách làm/Biến tấu (168 wikipedia + 139 tổng hợp) | 307 |
| vung / dacSan / vungCo | vùng gốc (vn 63 · bac 48 · nam 46 · trung 31 · tây nam bộ 18 · tây nguyên 9 · ngoài VN 92) · 69 đặc sản · vùng đang bán (bắc 163 · trung 166 · nam 169 · tây nam bộ 169 · tây nguyên 155) | 307 |
| kw[] | từ khoá tra quán | 307 |

**Bảng SQLite `dishes`** có đủ các cột trên (đã đồng bộ 307/307 dòng).

## 5. Files (cấu trúc hiện tại)
- `index.html` — khung UI: header, băng chuyền, 1 hàng nút [⚙️ Lọc][🎰 QUAY 1 MÓN][⚡ x10], filter sheet, modal kết quả/10-pull, drawer yêu thích, toast.
- `styles.css` — mobile-first: biến `--card-w/--vp-h`, safe-area, dvh, tap target ≥44px, chế độ gọn cho màn thấp (`max-height:740px`), breakpoint 480/640/1024.
- `app.js` — gacha (weighted + pity + tránh món lặp), quay băng chuyền (WIN_INDEX, easeOutQuint), popup (điểm/giới thiệu/chi tiết/facts/quán gần đây), bộ lọc + vùng miền, yêu thích, lịch sử, thực đơn/nhật ký, PWA, `#mon=<id>`, `ID_LEGACY` (đổi id cũ → slug ASCII).
- `art.js` — 23 template SVG. · `lib/nearby-core.js` — logic tìm quán dùng chung app.js/server.js · `lib/opening-hours.js` (giờ mở cửa OSM) · `lib/saved-places.js` (quán đã lưu) · `lib/group-core.js` (quay nhóm) · `lib/goals-core.js` (mục tiêu calo/ngân sách) · `lib/achievements.js` (thành tựu).
- `server.js` — static + gzip + `/api/whereami` · `/api/weather` · `/api/geocode` · `/api/reverse-geocode` · `/api/nearby` + HTTPS 8443.
- `sw.js` + `manifest.webmanifest` + `icons/` — PWA (cache shell/data/ảnh).
- `data/dishes.json` (nguồn gốc) · `data/dishes.sqlite` · `data/dishes-lite.json` · `data/dishes-detail-0..3.json`.
- `tools/` (xem mục 6) · `README.md` · `CONTEXT_SUMMARY.md` · `vercel.json` · `deploy.sh` · `.vercelignore` · `.gitignore`.

## 6. Công cụ trong tools/ (đã dọn + chia thư mục ở task-04)
Danh sách đầy đủ + cách chạy: **`tools/README.md`**. Tóm tắt:
- `tools/data/` — pipeline chạy lại được: `data-add-dishes.mjs` · `enrich-vung.mjs` · `data-patch-aliases.mjs` · `data-fetch-images.mjs` (tra ảnh vi→en→Commons, có `TARGETS=`/`DRY=1`) · `data-enrich-info.mjs` · `data-fill-detail.mjs` (mục Chi tiết tự tổng hợp, `detailSource "tong-hop"`) · `enrich-dishes.mjs` · `normalize-image-urls.mjs` · `audit-images.mjs` · `verify-images.mjs` · `data-sync-sqlite.mjs` · `data-split.mjs` · `data-validate.mjs` (+ dữ liệu `aliases.json`, `data-new-dishes.json`).
- `tools/test/` — `test-all.mjs` + 34 `test-*.mjs` + `audit-layout.mjs` · `audit-desktop.mjs` · `verify-desktop-mobile.mjs` (**37 file** khi chạy test-all).
- `tools/dev/` — `probe-static.mjs` (server tĩnh mô phỏng Vercel) · `make-icons.mjs` · `screenshots.mjs`.
- `tools/lib/chromium.mjs` — mở chromium thật cho test/dev; nạp Playwright theo `$PLAYWRIGHT_DIR` → `node_modules` project → `$DSH_HOME/profiles/web`, **không hard-code đường dẫn máy**.
- Đã xoá ở task-04 (32 file): `.snapshot-*.json`, `probe.json`, `image-report.json`, `.translate-cache.json`, `screenshots/*.png`, `debug-*`, `diag-*`, `probe-close/layout/render/overpass`, `shot-vung`, `fix-images*`, `strip-wrong-images`, `restore-from-report`, `dedup-images`, `fetch-images`, `enrich-wiki*`, `enrich-sections`, `translate-vi`, `data-report`, `sync-all-to-sqlite`, `sync-vung-sqlite`, `list-candidates`.

## 7. Tính năng người dùng thấy
1. **Băng chuyền ngang** 34 thẻ (phone) / 60 (desktop), hãm phanh easeOutQuint, dừng đúng tâm (đo được lệch 0px), tiếng tick + rung theo nhịp.
2. **Popup kết quả**: ảnh lớn, điểm/10 + sao, nhận xét, **Giới thiệu (Wikipedia)** + Đọc thêm, **📖 Chi tiết** (nguồn gốc/nguyên liệu/cách làm/biến tấu), bảng thông tin (calo, đạm, độ no, giá, vùng miền, quốc gia gốc, ẩm thực, nguyên liệu, loại món, thời gian), "hợp với ai", mẹo, credit ảnh, và **📍 Tìm quán bán món này gần tôi**.
3. **Quán gần đây**: GPS nếu https, không thì theo IP, hoặc **nhập địa chỉ / lat,lng**; Photon lọc quán có tên khớp món, bán kính tự chọn **2.5/5/10/15km**; mỗi quán có khoảng cách, địa chỉ, **giờ mở cửa** + **🔖 lưu quán**, công tắc **🟢 chỉ quán đang mở**, lọc **chỉ món có quán đã lưu**; luôn kèm link Google Maps + ShopeeFood/GrabFood.
4. **Lọc**: bữa ăn, ẩm thực, cách chế biến, chay, không cay, **điểm ≥8.5**, ngân sách, thời gian, tìm kiếm + 9 preset nhanh.
5. **Yêu thích + lịch sử + tiến độ bộ sưu tập + chốt món** (giữ popup kèm ribbon "✓ Đã chốt").
6. **Quay cho nhóm** (2–8 người, chuyền tay gạch món) · **mục tiêu calo/ngân sách** với thanh tiến độ và ưu tiên món vừa mục tiêu · **14 thành tựu** có tiến độ + toast khi mở khoá.

## 8. Bug đã gặp & cách xử lý (chi tiết trong memory)
- `&` trong tên món phá XML SVG → hàm `esc()` cho mọi chỗ nội suy.
- `overflow-x:hidden` trên html/body **+** `overscroll-behavior-y:none` → **chặn hẳn vuốt cuộn** trên Chrome mobile (scrollTo vẫn chạy nên dễ đoán sai).
- `.app-main{z-index:10}` tạo stacking context → bottom sheet bị dock đè, nút "Xong" không bấm được.
- Popup không hiện khi dữ liệu cache bản cũ → render phòng thủ + test `test-olddata.mjs`.
- Khớp ảnh bằng substring (Trimingham chứa "mi", "Lê Văn Miến" chứa "mien") → khớp theo TỪ + danh sách từ cấm.
- Wikimedia chỉ phục vụ thumbnail 500/960/1280 (320/640/800 trả 400).
- Overpass timeout, Nominatim bị chặn → dùng **Photon** (không hỗ trợ `lang=vi` = HTTP 400).
- Khối điều khiển vị trí lấy lại từ `innerHTML` → nhân đôi header (đọc nhầm vị trí) → tách biến `nearbyControlsMemo`.

## 9. Sự cố "nội dung bị chèn mất" (đã sửa)
Triệu chứng người dùng gửi ảnh: trong thẻ kết quả, **các dòng cuối của bảng thông tin biến mất**.
Nguyên nhân thật: `.win-dialog` là `display:flex;flex-direction:column`; `.info-grid` có `overflow:hidden` (để bo góc) nên bị **co lại theo flex-shrink** ⇒ cắt mất ~90px nội dung, mà thẻ **không cuộn được** (scrollHeight == clientHeight) nên không cách nào xem lại.
Sửa: thêm `.win-dialog>*{flex-shrink:0}` (và `.multi-dialog>*`) — sau đó nội dung dài thì chính thẻ cuộn, không mất chữ.
Đo lại (chromium thật): 458×1017 · 390×844 · 375×667 → **không còn phần tử nào bị overflow:hidden cắt**, dòng cuối + dòng meta đều hiện đủ.
Giảm cuộn: bảng thông tin chỉ hiện **6 dòng** (màn <760px: 4 dòng) + nút "＋ Xem thêm N thông tin"; màn thấp clamp review 2 dòng, tip 3 dòng, intro 3 dòng ⇒ cuộn còn 69px (458×1017) / 135px (375×667).
Công cụ phát hiện: `tools/diag-cover.mjs` (đã xoá ở task-04 — bug đã đóng), regression nay do `tools/test/test-clip.mjs` giữ (3 cỡ màn).

## 10. v14 — Thời tiết/giờ · Gu · Nhật ký · Thực đơn hôm nay · Chia sẻ ảnh
- **API mới**: `/api/weather?lat&lng` (Open-Meteo, không cần key, cache 15 phút) trả temp/desc/rain/storm/snow/isDay/hour.
- **chip #ctxChip** dưới hàng nút quay: hiện thời tiết + bữa hiện tại + lý do ưu tiên; bấm để bật/tắt (`mgd.ctxOn`).
- **biasOf(d)** nhân trọng số trong `drawOne`: mưa → món nước/lẩu ×2.2; nóng ≥32° → ngọt/uống/trộn/cuộn ×1.7, nướng/lẩu/chiên ×0.8; lạnh ≤22° → lẩu/nước/nướng/chiên ×1.6; bữa theo giờ ×1.8; gu khẩu vị cộng/trừ tối đa ±35–60%.
  Đo 4000 lần quay: mưa → món nước 14.8% → **30.7%**; nóng → đồ uống 5.1% → 8.1%, lẩu 2.9% → 1.7%.
- **Lưu cục bộ** (localStorage): `mgd.diary` (nhật ký), `mgd.taste` (gu), `mgd.menu` (thực đơn theo ngày), `mgd.wx`, `mgd.ctxOn`.
- **Panel #todayBackdrop**: 3 ô bữa (`MENU_SLOT` map bữa phụ: xế/vặt → trưa, khuya → tối), tổng kcal/đạm/tiền, gợi ý cân bằng, gu, nhật ký 7 ngày, nút xuất ảnh.
- **shareCard()** vẽ canvas 1080×1350 (thực đơn hoặc món) → `navigator.share` files nếu hỗ trợ, không thì tải PNG.
- Popup có thêm **📅 Vào thực đơn**; nút **Quay lại** giờ trừ điểm gu.
- **Hook test**: `window.__mgd = { state, biasOf, pool, drawOne, mealByHour, ALL }` (chỉ đọc) — dùng bởi `tools/test/test-bias.mjs`.
- BUG tự gây khi patch: chèn nhầm 3 dòng khởi tạo vào trong handler chip (chip không hiện) → đã chuyển về cuối IIFE boot cạnh `idleTrack()`.
- Đo lại: panel Hôm nay 458×1017 cao 732px (trọn, không cuộn), 375×667 cuộn 118px, không cắt chữ, không nút <40px; audit bố cục + jsdom + test-clip đều pass.

## 11. v15 — Chuẩn bị deploy Vercel (lịch sử; `api/` sau đó ĐÃ BỎ)
- **Trọng lượng client (lúc đó)**: index.html + styles.css + app.js + art.js + data/dishes.json = **966KB thô → 234KB gzip**. Ảnh **không nằm trong repo** (hotlink từ upload.wikimedia.org) nên không tốn băng thông Vercel. Nay dùng dữ liệu tách 2 tầng → xem mục 23/24.
- ~~`api/_lib.js` + 4 route serverless~~ — **đã xoá toàn bộ `api/`** (mục 13): Vercel chạy tĩnh thuần, chỉ `server.js` của LAN còn `/api/*`.
- **Overpass đổi thành opt-in**: mặc định chỉ chạy Photon (~1.2s); client tự gọi lại kèm `&ov=1` khi không có quán khớp tên món (chờ tối đa 3.5s rồi bỏ qua, vẫn còn link Google Maps). server.js LAN cũng race Overpass 4s.
- **Trên Vercel GPS chạy sẵn** vì có HTTPS (không cần mẹo chứng chỉ tự ký như LAN). Cache trong RAM là theo instance (cold start) + có `s-maxage` ở CDN.
- Deploy: push `main` → Vercel bot tự deploy (không cần CLI/token).

## 12. Đã đẩy lên GitHub (chờ import Vercel)
- Repo: **https://github.com/thongkvq/choose_food** (public), nhánh `main`, **65 file**, ~2 MB.
- Xác thực: **deploy key SSH** `~/.ssh/mongi_deploy` (đã thêm vào repo với quyền ghi); git repo-local đã set
  `core.sshCommand = ssh -i ~/.ssh/mongi_deploy -o IdentitiesOnly=yes`.
- Các commit: khởi tạo → thêm `deploy.sh` + `vercel.json` → bỏ dependency `vercel` khỏi `package.json` (do lúc cài CLI bị npm tự thêm vào) → đơn giản hoá `vercel.json` → loại `tools/` khỏi gói deploy → thêm `tools/test/test-live.mjs`.
- Vercel CLI 59.16.0 nằm ở `node_modules/.bin/vercel` (đã .gitignore/.vercelignore); deploy bằng `VERCEL_TOKEN=... ./deploy.sh` nếu không import qua dashboard.
- Kiểm tra sau deploy: `node tools/test/test-live.mjs https://<tên>.vercel.app` (đã thử trên server LAN: 7/7 endpoint 200, nearby 1.0s).
- Cấu hình import: Framework **Other**, Build Command để trống, Output Directory để trống, Install mặc định.
- **ĐÃ DEPLOY THẬT** (2026-09-12): Vercel bot deploy cả 4 commit cuối, commit status `success`.
  - Deploy URL: `https://choose-food-c3gpyxdko-paroda.vercel.app` (dpl_GPtUbvGrw93ULvT34oYBSKcLxJAc)
  - Alias production: `https://choose-food-paroda.vercel.app` (team/scope **paroda**)
  - ✅ **SITE ĐÃ CHẠY CÔNG KHAI: https://choose-food-paroda.vercel.app** (đã tắt Vercel Authentication)
  - ⚠️ **Kiến trúc trên Vercel = tĩnh thuần**, không dùng serverless function (xem mục 13). Ảnh/JS/CSS/dishes.json tải 200; `/api/*` trả 404 và client tự chuyển sang gọi thẳng dịch vụ.
  - ⚠️ **Đang bật Vercel Authentication (Deployment Protection)** → mọi path trả về trang "Login – Vercel". Muốn public phải vào Settings → Deployment Protection → Vercel Authentication → **Disabled**. Kiểm tra lại bằng `node tools/test/test-live.mjs <url>` sau khi tắt.
  - Cách tìm URL deploy khi không có dashboard: `curl -s https://api.github.com/repos/thongkvq/choose_food/deployments` rồi lấy `statuses` → `environment_url`.

## 13. Vì sao Vercel phải là tĩnh thuần (đã sửa xong)
1. Repo có `package.json` với `"scripts": {"start": "node server.js"}` ⇒ Vercel coi đây là **Node app** và tạo một catch-all function. Vì `server.js` bị `.vercelignore` loại nên function đó chết ⇒ **mọi path 500 FUNCTION_INVOCATION_FAILED** (kể cả `/`, `/app.js`).
2. Thử cấu hình hiện đại (`functions`, `headers`) ⇒ vẫn 500.
3. Thử legacy `builds` (`api/*.js` = @vercel/node, `**/*` = @vercel/static) + `routes` ⇒ file tĩnh 200 nhưng `/api/*` **404** (function không được build).
4. **Giải pháp chốt**: bỏ serverless.
   - `vercel.json`: `{ "version": 2, "builds": [{ "src": "**/*", "use": "@vercel/static" }], "routes": [{ "handle": "filesystem" }] }`
   - `app.js` thêm **lớp API**: `apiMode()` thử `/api/whereami` → nếu không trả JSON thì `API_MODE='direct'`; `apiJSON(path, directFn)` ưu tiên server (LAN có cache), fallback gọi thẳng Photon / Open-Meteo / ipapi.co (cả ba đều CORS `*`), có cache localStorage (weather 15 phút, toạ độ 6 giờ, geocode 24 giờ).
   - Xoá `start` khỏi `package.json`; `api/` vẫn giữ cho server LAN.
5. **Đã kiểm chứng bằng browser thật trên link deploy**: trang nạp, chip thời tiết 25°C (Open-Meteo trực tiếp), quay ra popup (12 dòng thông tin + giới thiệu), GPS → **8 quán "Bánh canh cua" quanh 3km** (Photon trực tiếp), 0 lỗi JS, 0 request lỗi. Script: `tools/test/test-vercel-live.mjs`.

## 14. Việc còn lại / bước kế tiếp (cập nhật ở v26)
- Dữ liệu — `node tools/data/data-validate.mjs` exit 0 (307 món · Lỗi 0 · Cảnh báo 0 · 5/5 file tách khớp từng byte): ảnh **280/307 (91.2%)**, intro 273, facts 246, **detail 307/307** (168 wikipedia gốc + 139 tổng hợp, popup ghi nhãn "Nội dung tổng hợp, có thể chưa đầy đủ").
- Còn **27 món dùng hình vẽ SVG**: đã dò vi-wiki + en-wiki + Commons, không có file nào khớp TRỌN tên món (danh sách + lý do trong `.delegate/task-06.result.md`). Muốn thử thêm: `TARGETS=id1,id2 node tools/data/data-fetch-images.mjs`.
- **intro còn thiếu 34 món**: không có bài Wikipedia khớp trọn tên → giữ trống thay vì bịa (UI ghi nguồn Wikipedia). `facts` 246/307 tương tự (Wikidata không có mục từ).
- Đã xong (không còn trong danh sách chờ): lọc theo quán đã lưu ✓, cache ảnh **300** (không còn 150) ✓, giờ mở cửa OSM ✓, quay nhóm ✓, mục tiêu calo/ngân sách ✓, thành tựu ✓.
- Giới hạn đã biết: `opening_hours` chỉ có ở **~15–20%** quán OSM Việt Nam (Sài Gòn 15.0%, Hà Nội 20.0%) nên đa số quán vẫn ⚪ "chưa rõ giờ"; công tắc "chỉ quán đang mở" không áp cho drawer "Quán đã lưu" (luôn hiện đủ, có badge riêng).
- Điểm sao quán thật vẫn **không có** (OSM không có rating; Google Places cần trả tiền — chủ dự án chốt không trả tiền).
- **Service worker không chạy trên http LAN** — muốn PWA/offline trên điện thoại phải mở qua HTTPS (8443) hoặc dùng bản Vercel. Muốn GPS thật: mở `https://<IP-LAN>:8443` và bỏ qua cảnh báo chứng chỉ.

## 15. v16 — Mặc định ẨN món nước ngoài (yêu cầu: "ăn bình thường, bỏ món Hàn/Nhật")
- Dữ liệu **không bị xoá** (248 món còn nguyên trong SQLite + `data/dishes.json`); chỉ **lọc mặc định**.
- `app.js`: `state.vnOnly = LS.get('mgd.vnOnly', true)` — mặc định **true**; trong `pool()` thêm điều kiện `(!state.vnOnly || d.region === 'vn')`.
- Hàm mới `paintRegionChips()` (chip ngoại thêm class `.foreign-off`) và `setVnOnly(on, notify)` (lưu localStorage + toast + vẽ lại chip + `syncPool` + `idleTrack`).
- Bấm chip ẩm thực ngoại (Nhật/Hàn/…) khi đang bật **tự tắt** chế độ "chỉ món Việt" (xử lý trong `chipRow`); `resetFilters()` bật lại mặc định.
- `index.html`: công tắc **#fVnOnly** "🇻🇳 Chỉ món Việt — ẩn món nước ngoài" đầu nhóm *Thêm* (checked sẵn) + dòng nhắc `.fnote` ở nhóm *Ẩm thực*; `styles.css`: `.chip.foreign-off{opacity:.4;border-style:dashed}`, `.fnote`.
- Số liệu: 160 món Việt / 88 món quốc tế (cn 19, jp 13, fr 10, us 8, kr 9, th 7, tr 6, mx 6, in 5, it 5).
- Test tự động: `node tools/test/test-vnonly.mjs` (chromium thật, 390×844) — PASS: mặc định pool chỉ region `vn`, 6 lần rút ngẫu nhiên 0 món ngoại, 10 chip ngoại bị mờ, tắt công tắc → có lại món ngoại, bấm chip Nhật → chỉ còn jp, "Đặt lại" → về chỉ món Việt, reload nhớ trạng thái qua `mgd.vnOnly`.
- Muốn xoá hẳn món ngoại khỏi dữ liệu thì phải sửa `data/dishes.json` + bảng SQLite `dishes` (chưa làm; các `tools/.snapshot-*.json` đã xoá ở task-04, cần thì lấy lại từ git history).

## 16. v17 — Tìm quán CHỐT 5km + link đặt món ShopeeFood/GrabFood
- **Bán kính tối đa 5km, không mở rộng nữa.** Trước đây thang bán kính là `[r, max(r*2,5000), max(r*4,10000)]` (2.5 → 5 → 10km). Nay chỉ còn **một mức**: `app.js` xin `r=5000`, `server.js` thêm `const MAX_RADIUS = 5000` và `attempts = [Math.min(radius, MAX_RADIUS)]`, `api/nearby.js` y hệt.
- `server.js`: `AREA_RADIUS` 3000 → **5000** (cache Overpass 30 phút theo ô 0.01°, khoá chỉ theo lat/lng); lọc `p.dist <= Math.min(radius, MAX_RADIUS)`; `/api/nearby` mặc định r = 5000 thay vì 2000.
- UI: dòng ghi chú đổi thành "N quán … trong ~5km (tối đa 5km)".
- **Link đặt món** (mới trong `app.js`: hàm `deliveryLinks(dishQ)`, dùng ở cả nhánh thành công và nhánh lỗi): ShopeeFood `https://shopeefood.vn/search?keyword=<món>` (route `/search` lấy từ bundle `app-f182e75cd868fe649223.js` của họ), GrabFood `https://food.grab.com/vn/vi/restaurants?search=<món>`. **Chỉ là link tìm kiếm** — mở app rồi tự đặt, KHÔNG lấy dữ liệu quán từ 2 nền tảng này.
- **Vì sao không lấy được dữ liệu ShopeeFood/GrabFood**: không có API công khai. `gappapi.deliverynow.vn/api/...` (backend ShopeeFood) trả **403** khi không có header ký/device token; shopeefood.vn là SPA (HTML shell chỉ 5.1KB, không có dữ liệu quán); food.grab.com có `__NEXT_DATA__` nhưng danh sách quán do client gọi API nội bộ có auth, HTML không chứa tên quán. Muốn dữ liệu quán thật (tên/địa chỉ/giờ mở/rating) thì dùng **Google Places API** (cần key, có free tier) hoặc giữ OSM/Photon như hiện tại.
- Test (script đã xoá, nay là `test-nearby-radius.mjs`): phần A gọi `/api/nearby?...&r=20000` phải bị chặn còn 5000 (đo được xa nhất 4459m); phần B mở UI thật, quay 1 món, bấm 📍, kiểm tra mọi quán ≤5km + có đủ link ShopeeFood/GrabFood + ghi chú "tối đa 5km". Đã PASS trên LAN `http://127.0.0.1:4321`.

## 17. v18 — Người dùng tự chọn bán kính 2.5 / 5 / 10km
- **Bỏ mức chốt cứng 5km**: nay có **thanh chọn bán kính** trong khối "Tìm quán gần đây" (`radiusChipsHTML()` trong `app.js`, chip `.rad-chip[data-rad]`, mặc định **5km**, nhớ trong `mgd.radius`). Bấm chip khác → tìm lại ngay bằng **vị trí cũ** (không xin GPS lại).
- Server nhận `r` và **làm tròn LÊN** đúng 1 trong 3 mức (`TIERS = [2500, 5000, 10000]`, `snapTier`): xin 1000 → 2500, xin 20000 → 10000. Không tự nới bán kính trong lúc tìm nữa (bỏ thang `r*2, r*4`).
- **Sửa lỗi lọt quán ngoài bán kính**: Photon trả theo ô vuông nên có quán nhích ra ngoài (2.8km khi chọn 2.5km) → thêm `.filter(p => p.dist <= rad)` ở cả 3 nơi (`server.js`, `api/nearby.js`, `dirNearby()` trong `app.js`).
- **Overpass 10km**: kiểu `around:10000` bị Overpass trả **504** (đo 11.5s); đổi sang **bbox** (nam,tây,bắc,đông) cùng vùng chỉ ~2-3.5s, giới hạn `out center` 400/700/1000 theo mức. Thêm 2 gương dự phòng: `overpass.private.coffee`, `overpass.osm.ch` (Overpass hay trả 429 khi hỏi dồn).
- **Nạp nền khi hết giờ**: hạn chờ Overpass theo mức (2.5km→5s, 5km→9s, 10km→15s). Quá hạn thì trả ngay kết quả Photon + `areaWarming: true`, đồng thời **nạp tiếp 60s ở nền** rồi cache 30 phút → UI hiện gợi ý "bấm 🔄 Tìm lại sau ~10 giây là có". Cache Overpass theo ô 0.01° **+ mức bán kính**.
- Test: `node tools/test/test-nearby-radius.mjs [baseUrl]` (thay `test-nearby-5km.mjs` đã xoá) — kiểm API cho cả 5 trường hợp xin r (2500/5000/10000/20000/1000), rồi mở UI thật: đủ 3 chip, mặc định 5km, đổi 2.5km → mọi quán ≤2500m và URL gửi `r=2500`, lưu `mgd.radius`, đổi 10km → ≤10000m, F5 vẫn nhớ. Đã PASS trên LAN.

## 18. v19 — Gợi ý QUÁN CÓ TIẾNG trong 15km (mức bán kính thứ 4)
- **Thêm mức 15km**: `R_TIERS = [2500, 5000, 10000, 15000]` (app) và `TIERS` tương ứng ở `server.js`/`api/nearby.js`; `MAX_RADIUS = 15000`. Overpass `out center` nới giới hạn theo mức: 500/900/1600/**2600**; hạn chờ 15km = **20s**, nạp nền tối đa `ovBudget*4`. Ô 15km quanh Sài Gòn: 2315 POI, **ô lạnh ~3.4s**, gọi lại sau cache 0.25s.
- **"Quán có tiếng" chấm từ dữ liệu mở OSM** (`fameScore()` trong `server.js`, bản sao ở `api/nearby.js`): thương hiệu/chuỗi `brand|operator` +3, `website|contact:website` +2, giờ mở cửa +1, điện thoại +1, địa chỉ +1, khai báo cuisine +1 → trả 2 danh sách:
  - `famousMatch`: fame ≥3 **và** khớp tên món/ẩm thực (tối đa 8) → khối "⭐ Quán có tiếng bán món này".
  - `famousNear`: fame ≥4, không cần khớp món (tối đa 10) → khối "⭐ Quán có tiếng quanh đây".
  - Mỗi quán kèm `why[]` (lý do: "thương hiệu X", "có website", "có giờ mở cửa"…) hiện thành badge vàng trong `.fam-why`; UI ghi rõ **"không phải điểm đánh giá của khách"**.
- **Vì sao không có số sao/đánh giá thật**: OSM gần như không có `stars`/`rating` (đo 2000 POI ở Sài Gòn: wikidata **0**, brand 254, website 128, phone 191, hours 265, addr 745); Wikidata SPARQL "restaurant in bbox Sài Gòn" trả **0 kết quả**; Google Places/Nominatim cần key (Nominatim còn bị mạng này reset). Muốn điểm sao thật thì phải cắm **Google Places API**.
- **Bản tĩnh (Vercel) không có khối này**: Overpass **không gửi CORS header** (`Access-Control-Allow-Origin` trống) nên client không gọi thẳng được; Photon trả về không có tag brand/website. Client tự bỏ qua khối khi server không trả `famousMatch/famousNear`.
- Test: `node tools/test/test-nearby-radius.mjs` nay kiểm thêm 4 chip, API `r=15000` và `r=20000 → 15000`, khối quán có tiếng (có tiêu đề, có lý do, xa nhất ≤15km, có ghi chú nguồn OSM), F5 nhớ mức 15km. Bản tĩnh tự bỏ qua phần quán có tiếng. **PASS trên LAN**.
- **BUG đã sửa (bản tĩnh/Vercel)**: `dirNearby()` còn `Math.min(radius, 10000)` nên chọn 15km vẫn chỉ tìm 10km (ghi chú hiện "~10km"). Đã đổi thành 15000 (commit `66116bd`). Luôn kiểm cả bản tĩnh, không chỉ LAN.

## 19. v20 — Tối ưu MIỄN PHÍ cho "quán có tiếng" (không dùng Google API)
- Chủ dự án chốt: **không trả tiền** cho Google Places → giữ 100% nguồn mở/không key.
- **Phát hiện quan trọng**: Overpass **CÓ CORS cho GET** (`Access-Control-Allow-Origin: *` + `Access-Control-Allow-Methods: GET, POST, OPTIONS` khi request kèm `Origin`) — trước đây thử POST không kèm Origin nên tưởng không có. Nhờ vậy **bản tĩnh Vercel cũng lấy được quán có tiếng**, không cần serverless, không cần key.
- `app.js` thêm `fameScoreOf()`, `fameLists()`, `dirFamous()`: bản tĩnh gọi thẳng `https://overpass-api.de/api/interpreter?data=<QL>` (gương dự phòng kumi), bbox theo đúng mức bán kính (limit 500/900/1600/2600), chạy **song song** với Photon nên không làm chậm kết quả chính.
- **Chấm điểm v2** (giống nhau ở `server.js`, `api/nearby.js`, `app.js`): có tag `wikidata|wikipedia` **+4** (hồ sơ bách khoa), `brand|operator` +3, **≥3 chi nhánh trong vùng +2**, website +2, giờ mở cửa/điện thoại/địa chỉ/loại quán mỗi thứ +1. Ngưỡng: famousMatch ≥4 (và khớp món/ẩm thực), famousNear ≥5.
- **Gộp chi nhánh**: `dedupByName()` gom cùng tên chuẩn hoá, giữ chi nhánh gần nhất, trả `branches` → UI hiện "28 chi nhánh · thương hiệu The Coffee House · 28 chi nhánh trong vùng". Đỡ rác danh sách vì chuỗi trùng lặp.
- Vẫn KHÔNG có sao/đánh giá khách (OSM không có; Foursquare free tier có key miễn phí nhưng thêm phụ thuộc — chưa dùng).
- **Bản tĩnh chạy được nhưng chậm**: đo trong trình duyệt thật — `overpass-api.de` bị **CORS chặn** (net::ERR_FAILED, có lúc treo 137s), `overpass.kumi.systems` **200 OK** (~18s ô lạnh), `overpass.private.coffee` trả XML lỗi, `overpass.osm.ch` chỉ có dữ liệu Thuỵ Sĩ (0 POI ở Sài Gòn). Nên `FAME_SRC` xếp **kumi trước**, api.de sau; parse bằng `text()`+`JSON.parse` để bỏ qua gương trả XML.
- **Không chặn kết quả chính**: quán có tiếng đổ vào `#famSlot` sau (token `state._nearbyToken` chống ghi đè khi người dùng bấm lượt mới); có `localStorage mgd.fame` cache **6 giờ** theo ô 0.01°+bán kính+tên món (tối đa 40 mục) nên lần sau tức thì.

## 20. v21 — Lọc theo VÙNG MIỀN (yêu cầu: "thêm filter chọn món theo vùng miền, ví dụ miền tây nam bộ, miền nam, miền trung, miền bắc")
- **Trường mới `vung`** cho mọi món trong `data/dishes.json` + cột `vung` trong bảng SQLite `dishes` (đã đồng bộ, 248/248, không NULL). 7 giá trị: `bac` 38 · `trung` 17 · `nam` 38 · `tay-nam-bo` 4 · `tay-nguyen` 1 · `vn` 62 (phổ biến cả nước) · `ngoai` 88 (món quốc tế).
- **Gán bằng script chạy lại được**: `node tools/data/enrich-vung.mjs` — bảng phân loại viết tay theo `id` (không đoán bằng từ khoá), món Việt không nằm trong bảng tự rơi vào `vn`, món `region !== "vn"` thành `ngoai`. (Snapshot `.snapshot-before-vung.json` đã xoá ở task-04.)
- **UI**: nhóm **🗺️ Vùng miền** trong filter sheet (`#vungChips`, `chipRow($("#vungChips"), VUNG, state.vung)`), chip: Miền Bắc 🏯 · Miền Trung 🌾 · Miền Nam 🏙️ · Miền Tây Nam Bộ 🛶 · Tây Nguyên ☕ · Cả nước 🇻🇳 · Ngoài Việt Nam 🌍. Bấm nhiều chip cùng lúc.
- **`VUNG_INCLUDE = { nam: ["nam","tay-nam-bo"] }`** — chọn "Miền Nam" là gồm luôn miền Tây Nam Bộ (đúng địa lý). Hàm lọc `vungHit(v)` dùng trong `pool()`; `state.vung` được tính vào `activeFilterCount()`; `resetFilters()` xoá vùng.
- **Chip 🌍 Ngoài Việt Nam** bấm vào thì tự tắt công tắc "chỉ món Việt" (giống chip ẩm thực ngoại); khi `vnOnly` bật, chip này mờ `.foreign-off`.
- **3 preset mới**: `vungBac` 🏯 Món miền Bắc · `vungTrung` 🌾 Món miền Trung · `vungTay` 🛶 Đặc sản miền Tây.
- **Popup**: thêm dòng **🗺️ Vùng miền** (`vungLabel(d.vung)`) và pill trong `.win-meta`; dòng cũ đổi nhãn từ "Vùng miền" → **📍 Xuất xứ** (giữ mô tả chi tiết như "Sài Gòn").
- **Test**: `node tools/test/test-vung.mjs [baseUrl]` — chromium thật 390×844, **12/12 PASS**: Tây Nam Bộ 4 món, Miền Nam 42 (38 nam + 4 tay-nam-bo), Bắc 38, Trung 17, Tây Nguyên 1, Cả nước 62, Bắc+Trung 55, Ngoài VN 88 + tự tắt vnOnly, preset miền Tây 4 món, popup có dòng "Vùng miền=", 0 lỗi JS.
- Hồi quy: `tools/test/test-vnonly.mjs` PASS (mặc định vẫn chỉ món Việt, chip ngoại mờ 10) · `tools/test/audit-layout.mjs` không tràn ngang, tap target ≥44px.
- Lưu ý khi đo bằng chromium trong container: **không có font hệ thống** nên mọi chip đo ra width ~30px và nằm 1 hàng — số đo bề rộng chữ vô nghĩa, chỉ tin số món/pool và logic.
- Bản tĩnh Vercel không cần sửa gì thêm: lọc vùng chạy thuần client trên `data/dishes.json`.
- **Đã deploy v21 (commit `58fbde3`)**: push lên `origin/main` → **Vercel bot tự deploy** (không cần token, không cần CLI). Theo dõi bằng `curl -s https://api.github.com/repos/thongkvq/choose_food/commits/<sha>/status` (pending → success ~35s). Bản production: **https://choose-food-paroda.vercel.app** — đã kiểm: `data/dishes.json` có `vung`, `app.js` có `vungHit`, `tools/test/test-vung.mjs <prod>` **12/12 PASS**, `/api/*` trả 404 là **bình thường** (bản tĩnh, client tự gọi thẳng dịch vụ).

## 21. v22 — FIX "chọn vùng miền xong không quay được" (user báo)
- **Nguyên nhân thật**: chọn vùng + **bữa ăn tự động theo giờ** ra **0 món** (đo lúc 19h: Tây Nguyên 0/1 món, Tây Nam Bộ 2/4) → `syncPool()` khoá nút quay, KHÔNG có thông báo nào ⇒ người dùng thấy "bấm không quay được". Không phải lỗi treo băng chuyền (quay với 2 món vẫn chạy hết 5.2s rồi mở popup bình thường).
- **Sửa**: thêm cờ `state.mealAuto` (true khi bữa do đồng hồ tự chọn ở boot, false khi người dùng bấm chip bữa / preset) + hàm `ensurePlayable()`: pool 0 mà bữa là tự động → **tự bỏ lọc bữa ăn**, toast giải thích ("Bữa Sáng không có món trong vùng này — đã bỏ lọc bữa ăn, còn N món"); còn 0 món thật (bữa do người dùng chọn / nhiều vùng) → toast cảnh báo + **tự mở sheet lọc**. `spinOnce()`/`spinTen()` gọi `ensurePlayable()` trước khi báo lỗi.
- **Chip vùng hiện số món**: `paintVungCounts()` (gọi trong `syncPool`) đếm số món mỗi vùng khi **bỏ qua chính bộ lọc vùng** → nhãn "Miền Bắc 🏯 · 20"; vùng 0 món thêm class `.chip.empty` (mờ + gạch chấm). Refactor `pool()` → `matchDish(d, ignoreVung, q)` để đếm dùng lại.
- Dòng trạng thái khi 0 món đổi thành "⚠️ 0 món khớp lọc — bấm để mở lọc" và **bấm được** để mở sheet.
- **Test**: `tools/test/test-vung.mjs` lên **16/16 PASS**, thêm 4 ca mới: `cuu0Mon` (bữa Sáng + Tây Nguyên → tự bỏ bữa, pool 1, nút quay mở), `quaySauKhiCuu` (quay xong mở popup thật), `khongTuBoBuaNguoiDung` (người dùng tự chọn bữa thì KHÔNG tự bỏ, chỉ báo + mở sheet), `chipHienSoMon`.
- Hồi quy PASS: `test-vnonly.mjs` · `audit-layout.mjs` (không tràn ngang, tap ≥44px) · `test-clip.mjs` (không cắt chữ trong popup 3 cỡ màn).

## 22. v23 — Lọc theo phạm vi bán + gợi ý vị trí (đang hoàn thiện)
- Mục tiêu: vùng lọc theo nơi món đang bán/phổ biến; phở, mì, bánh mì không mất khỏi vùng khác. Dữ liệu dùng vung cho gốc, dacSan cho cờ đặc sản địa phương, vungCo cho vùng bán.
- Dữ liệu hiện tại: 248 món, 160 Việt, 88 quốc tế, 28 đặc sản; vùng bán: Bắc 142 · Trung 140 · Nam 141 · Tây Nam Bộ 141 · Tây Nguyên 133; vung === "vn" 62 món. Đã sửa ID Bánh căn thành banh-can-chay; tools/data/enrich-vung.mjs validate mọi ID map có thật trong data/dishes.json.
- App: matchDish() dùng vungCo với fallback vung; Miền Nam gồm Tây Nam Bộ; Cả nước giữ nghĩa gốc vung=vn; chip đếm dùng cùng helper. Chế độ state.vungGocOnly lọc gốc.
- Vị trí: vungFromPlace() chuẩn hóa tên có dấu, allowlist tỉnh/thành; vungFromCoords() fallback BBox gần đúng; GPS ưu tiên, IP sau; Photon reverse geocode thêm cho GPS chỉ có tọa độ. state.autoVung chỉ hiện gợi ý và nút xác nhận, không ghi đè vùng tay. Thêm api/reverse-geocode.js + route local.
- SQLite: thêm cột dacSan INTEGER, vungCo TEXT; đồng bộ bằng `tools/data/data-sync-sqlite.mjs` (script `sync-vung-sqlite.mjs` đã xoá ở task-04 vì bị thay thế). Kiểm tra không NULL; mẫu phở có đủ 5 vùng, cao lầu/Bánh căn chỉ Trung.
- Test đã PASS: node tools/test/test-vung.mjs (17 checks); syntax `node --check app.js server.js` (thư mục `api/` đã bỏ ở v24). tools/test/test-gps.mjs đã thêm test mapper nhưng chưa chạy hết vì test nearby lâu.
- Còn lại: chạy full regression (GPS, old-data, vnonly, layout, clip), kiểm tra api/reverse-geocode production, review diff, commit/push và chờ Vercel success; cập nhật số liệu README nếu dataset thay đổi.

## 23. v24 (task-03) — Tách dữ liệu lần đầu · PWA offline · tránh món lặp · link chia sẻ món
- **Tách dữ liệu**: `node tools/data/data-split.mjs` sinh `data/dishes-lite.json` (283.2KB thô / **47.4KB gzip**, đủ 308 món) + **4 mảnh** `data/dishes-detail-0..3.json` (620.4KB thô / 173.9KB gzip, ~43.5KB gzip/mảnh). Lần tải đầu **giảm 71.8% thô · 79.8% gzip** (trước: dishes.json 1002.8KB / 235.0KB gzip). `dishes.json` vẫn là **nguồn gốc**, không đổi định dạng.
  - LITE (app.js dùng trước khi mở popup): id, name, emoji, region, vung, dacSan, vungCo, meals, style, art, c1, c2, tags, descr, price, minutes, spicy, veg, weight, tier, image, imageVia, imageSource, rating, stars, calories, protein, proteinLabel, priceRange, fullness, bestFor, bestTime, origin, kw.
  - NẶNG (chỉ tải khi mở popup): review, intro, introSource, wikiUrl, wikiTitle, introEn, facts, detail, tip. Mảnh = `floor(index / detailChunkSize)` (chunkSize ghi trong lite; app đọc lại nên 2 bên không lệch công thức).
  - `buildSplit()` export từ data-split → `tools/data/data-validate.mjs` **so từng byte** 5 file; lệch/thiếu ⇒ lỗi “chưa chạy data-split” (đã thử phá file: báo đúng, khôi phục exit 0). Validate còn kiểm lite KHÔNG chứa trường nặng + mọi id có trong đúng 1 mảnh chi tiết.
- **app.js tải muộn**: `DETAIL {chunks, chunkSize, loaded, loading, failed}`, `loadDetailChunk/ensureDetail/prefetchDetail` (prefetch `requestIdleCallback` sau khi trang nạp xong, mảnh lỗi chỉ thử 1 lần). Popup render **ngay** phần lite; phần nặng đổ vào 3 slot `#heavySlot` (review+intro+detail), `#infoSlot` (bảng thông tin vẽ lại kèm dòng facts), `#tipSlot` — **không mở lại popup, không nhảy lên đầu** (giữ scrollTop; `infoExpanded` giữ trạng thái “Xem thêm”). Chờ có khung `.heavy-loading`; lỗi mạng hiện `.heavy-loading.err` và **vẫn đủ phần lite**.
- **PWA**: `manifest.webmanifest` (tên “Món Gì Đây?”, theme_color #0b0812 = meta theme-color, background #0a0710 = `--bg`), icon sinh bằng `node tools/dev/make-icons.mjs` (SVG → PNG qua chromium, không cần font: `icons/icon-192.png`, `icon-512.png`, `maskable-512.png`, `logo.svg`).
  - `sw.js` VERSION `mgd-v24-1`: HTML/JS/CSS **network-first**, `data/*.json` **stale-while-revalidate**, ảnh `upload.wikimedia.org` **cache-first tối đa 150** (xoá ảnh cũ nhất theo header `x-cached-at`), **KHÔNG cache** Photon/Overpass/Open-Meteo/ipapi; `activate` xoá cache khác VERSION; `install` precache shell + `data/dishes-lite.json`.
  - Đăng ký SW chỉ khi `window.isSecureContext` (http LAN không có SW). Offline: quay món vẫn chạy (lite + shell từ cache), nút 📍 Tìm quán báo “📴 Đang offline…” + vẫn có link Google Maps, `loadWeather()` bỏ gọi mạng; có toast khi `offline`/`online`.
  - `vercel.json`: lúc đó thêm khoá `headers` cho `/sw.js` + `/manifest.webmanifest` — **cách này bị Vercel từ chối** (không được dùng `headers` cùng `routes`), v25 đã chuyển vào `routes` dạng `{src, headers, continue:true}` (xem mục 24). `server.js` + `tools/dev/probe-static.mjs` thêm MIME `.webmanifest`.
- **Tránh món lặp** (công tắc `#fAvoidRecent` trong nhóm *Thêm*, mặc định BẬT, lưu `mgd.avoidRecent`): món đã chốt/nhật ký trong **3 ngày** ×0.15, món vừa quay ra trong **10 lượt** ×0.5 (`state.recentDraws` ← `mgd.recentDraws`, ghi khi quay 1 hoặc x10). **Không loại hẳn** — đo 2000 lần drawOne (pool 20 món): 866 → **185 lần (21.4%)**, vừa quay ra 57.7%, nhật ký cách 4 ngày 97.3%, tắt công tắc 92.1%, pool 3 món đều vừa ăn vẫn ra 300/300.
- **Link chia sẻ món**: `#mon=<id>` (id encode) — mở trang là ra thẳng popup (`openFromHash`, có cả `hashchange`), đóng popup thì `history.replaceState` xoá hash; món không tồn tại → toast “Link không còn món này”. Nút **🔗 Chia sẻ** (cạnh 📤 Chia sẻ ảnh cũ): `navigator.share({title,text,url})` nếu có, không thì copy link + toast. Tap target 64×50px.
- **Test mới**: `tools/test/test-split.mjs` (17 check) · `tools/test/test-pwa.mjs` (28) · `tools/test/test-avoid.mjs` (14) · `tools/test/test-share.mjs` (14). Sửa test cũ theo dữ liệu tách: `test-olddata.mjs` + `test-popup.mjs` (route `dishes-lite.json`, mảnh chi tiết abort, `serviceWorkers: 'block'`), `test-live.mjs` (kiểm lite/detail/manifest thay vì dishes.json).
- **Kết quả**: `node tools/test/test-all.mjs` **30/30 file exit 0** trên cả LAN (`http://127.0.0.1:4322`) và bản tĩnh (`node tools/dev/probe-static.mjs 4399`). Bỏ qua do dịch vụ ngoài sập: **Photon** (`net::ERR_CONNECTION_REFUSED`) → test-api 2 mục, test-live mục Photon, test-nearby-radius khối “quán có tiếng” (Overpass cũng không tới được); **ipapi 429** làm bản tĩnh không lấy được vị trí theo IP. `node tools/data/data-validate.mjs` exit 0; `node --check` 77 file JS/MJS sạch.
- Lưu ý vận hành: server LAN đang chạy sẵn ở cổng **4321** là tiến trình CŨ (ngoài sandbox, không kill được) nên chưa có MIME `.webmanifest` — cần khởi động lại `node server.js` để PWA ăn trên LAN.

## 24. v25 (task-04) — kiểm chứng 2 fix tay · sửa dữ liệu · dọn tools · tài liệu
**a) Kiểm chứng 2 chỗ Claude tự sửa tay ở lượt trước — CẢ HAI ĐÚNG, nay có test canh:**
- `vercel.json`: header của `/sw.js` + `/manifest.webmanifest` nằm **trong `routes`** dạng `{src, headers, continue:true}` trước `{handle:"filesystem"}`; không còn khoá `headers`/`rewrites`/`redirects`/`cleanUrls`/`trailingSlash` đi cùng `routes` (Vercel từ chối deploy nếu có cả hai). `test-pwa.mjs` thêm 2 check tĩnh cho việc này.
- `sw.js` `cacheFirstImage`: tải `fetch(req.url, {mode:'cors', credentials:'omit'})`, chỉ cache khi `res.ok && res.type !== 'opaque'` và `blob.size > 0`, VERSION **`mgd-v24-2`**. Nếu để `no-cors` thì response opaque → blob rỗng → cache-first trả ảnh hỏng mãi.
- **`<img>` của app KHÔNG cần `crossorigin="anonymous"`**: đã đo bằng ảnh Wikimedia THẬT (không mock) — cache `img-mgd-v24-2` giữ **130127B · image/jpeg**, popup hiện **960×638px**, cả khi ONLINE, sau reload, và khi OFFLINE (SW trả bản cache; `cache.match` dùng `ignoreVary`). `test-pwa.mjs` nay **35 check PASS** (trước 28), bỏ mock ảnh.
- Test cũng bắt được 1 test chập chờn: `test-avoid.mjs` đọc toast công tắc trong lúc toast chào mừng ("Đang là <bữa> — đã lọc sẵn cho bạn", hiện ở mốc 600ms sau boot) ghi đè → nay chờ toast chào mừng tắt hẳn rồi mới bấm và **chờ đúng nội dung toast** (timeout 5s).

**b) Dữ liệu (308 món; `data-validate.mjs`: Lỗi 0 · Cảnh báo 0 — trước đó 6 cảnh báo):**
- `chao-ca-loc` ("Cháo cá lóc") bỏ ảnh sai "Cháo cá Quảng Trị (bánh canh cá lóc)" → **`File:Cháo Cá Lóc, Tiền Giang.jpg`** (commons, đã xem ảnh: nồi cháo cá lóc + rau). Thêm `'bánh canh cá lóc'` vào `DENY_TITLES` của `data-fetch-images.mjs` (bánh canh cá lóc ≠ cháo cá lóc).
- `lau-tu-xuyen` ("Lẩu cay Tứ Xuyên") bỏ ảnh "Shanghai hot pots" (lẩu Thượng Hải — khác món) → **`File:Chongqing hotpot.1.jpg`** (nồi lẩu đỏ cay kiểu Tứ Xuyên/Trùng Khánh).
- `com-trang-trung` ("Cơm trắng trứng chiên") bỏ ảnh cơm trắng trơn "WhiteRice.jpg" → **`File:Cơm trứng chiên tại sân bay Phú Bài (tháng 9 năm 2018) (2).jpg`** (cơm + trứng chiên).
- 3 cảnh báo còn lại (`bulgogi`, `canh-kim-chi`, `sashimi`) là **ảnh ĐÚNG**, chỉ lệch tên vì tiêu đề file Commons dùng tên tiếng Anh → thêm alias tiếng Anh (`Bulgogi`, `Kimchi jjigae`, `Sashimi`, `Chongqing hotpot`, `Cơm trứng chiên`…) vào `aliases.json` + `data-patch-aliases.mjs`, không đổi ảnh.
- **Id ASCII**: `cơm-chay` → **`com-chay`** (đổi trong `data/dishes.json`, `aliases.json` gộp 2 khoá). Có **đường tương thích**: `app.js` thêm `ID_LEGACY`/`idNow()`/`idList()` — mọi chỗ đọc dữ liệu người dùng đã lưu (yêu thích `mgd.favs`, lịch sử `mgd.hist`, đã thấy `mgd.seen`, `mgd.recentDraws`, nhật ký `mgd.diary`, thực đơn `mgd.menu`) và link `#mon=<id>` cũ đều đi qua `idNow()`; `dishById()` cũng chuẩn hoá. Lưu lại là ghi ra id mới.
- Sau khi sửa: `node tools/data/data-sync-sqlite.mjs` (308/308) → `node tools/data/data-split.mjs` (lite + 4 mảnh khớp) → `data-validate.mjs` exit 0.
- Tap target: nút **#btnUseGeoVung** trong sheet lọc cao 29px → **≥44px** (`.vung-location-hint button` thêm `min-height:44px; display:inline-flex; align-items:center`).

**c) Dọn `tools/` — 80 file → 50 file (72 → 47 `.mjs`), chia 4 thư mục:**
- `tools/data/` (14) pipeline · `tools/test/` (31) test + audit · `tools/dev/` (3) probe-static/make-icons/screenshots · `tools/lib/chromium.mjs` (mở chromium dùng chung) · **`tools/README.md`** liệt kê từng script + cách chạy + thứ tự pipeline.
- Xoá 32 file: snapshot `.snapshot-*.json` (3), `probe.json`, `image-report.json`, `.translate-cache.json`, 20 ảnh `screenshots/*.png`, `debug-*` (4), `diag-*` (3), `probe-close/layout/render/overpass`, `shot-vung`, `fix-images`/`fix-images2`/`strip-wrong-images`, `restore-from-report`, `dedup-images`, `fetch-images` (bị `data-fetch-images` thay), `enrich-wiki`/`enrich-wiki2`/`enrich-sections`/`translate-vi` (bị `data-enrich-info` thay), `data-report` (đọc snapshot đã xoá), `sync-all-to-sqlite`/`sync-vung-sqlite` (bị `data-sync-sqlite` thay), `list-candidates`.
- **Bỏ hết hard-code đường dẫn máy**: mọi test/dev script dùng `tools/lib/chromium.mjs` (nạp Playwright theo `$PLAYWRIGHT_DIR` → `node_modules` project → `$DSH_HOME/profiles/web`, `$CHROME_BIN` để ép bản chromium); `screenshots.mjs` nhúng font theo `$SHOT_FONT` (không đặt thì chụp thường). Đã grep `var/lib/dsh|ai-workspace|ms-playwright|chromedeps` trong repo → **0 kết quả**.
- Sửa mọi đường dẫn tương đối theo cấu trúc mới (`new URL('../../', import.meta.url)`, `tools/screenshots/`, `tools/data/aliases.json`, `../../art.js`, `../../lib/nearby-core.js`); `test-all.mjs` chạy với `cwd` = thư mục project.
- `.gitignore`: `tools/**/.translate-cache.json`, `tools/screenshots/` + `tools/**/screenshots/`, `tools/**/.snapshot-*.json`, `node_modules`, `data/dishes.sqlite`. `.vercelignore`: vẫn loại `tools/`, thêm `data/dishes.sqlite`. `package.json` **vẫn KHÔNG có mục `scripts`**.

**d) Kết quả chạy toàn bộ:** xem mục 24.1 bên dưới.

### 24.1 KẾT QUẢ CUỐI (task-04)
- `node tools/test/test-all.mjs http://127.0.0.1:4322` (LAN, `node server.js`) — **30/30 file exit 0**.
- `node tools/test/test-all.mjs http://127.0.0.1:4399` (bản tĩnh, `node tools/dev/probe-static.mjs 4399`) — **30/30 file exit 0**.
- **Bỏ qua (dịch vụ ngoài, không tính FAIL)**: `test-api` trên bản tĩnh (đúng thiết kế: không có `/api`); Photon chập chờn (`net::ERR_CONNECTION_REFUSED`) → `test-live` bỏ mục Photon, `test-nearby` không lấy được vị trí theo IP, `test-loc-http` geocode địa chỉ đôi lúc không đổi toạ độ; Overpass không trả dữ liệu → `test-nearby-radius` bỏ khối "quán có tiếng" (đã có `test-fame-mock.mjs` chạy bằng dữ liệu giả, PASS); ipapi 429 ở vài lượt.
- `test-pwa.mjs` (chạy cả LAN và tĩnh) **35/35 check PASS**: ảnh Wikimedia thật trong cache `130127B · image/jpeg`, popup hiện **960×638px** khi online → sau reload → khi offline, **không** rơi về SVG fallback.
- `node tools/data/data-validate.mjs` → exit 0 (308 món · Lỗi 0 · Cảnh báo 0 · 5/5 file tách khớp từng byte).
- `node --check` 52 file JS/MJS trong repo → 0 lỗi. `node tools/dev/make-icons.mjs` chạy lại ra icon y hệt (không đổi file).
- Lưu ý: máy này có tiến trình CŨ đang giữ cổng **4321** (ngoài sandbox, không kill được) nên đã chạy test trên server mới ở **4322** (`PORT=4322 node server.js`); cả 2 server nền đã được dừng sau khi test xong. Không commit/push gì ở lượt này.

## 25. v26 (task-06 → task-08) — dữ liệu đầy đủ · giờ mở cửa + quán đã lưu · quay nhóm · mục tiêu · thành tựu · tài liệu

**a) task-06 — lấp chỗ trống dữ liệu (chỉ `data/` + `tools/data/`)**
- Ảnh thật **278 → 280/308**: `banh-cay` → `File:Bánh cay.JPG`, `goi-ca-trich` → `File:Gỏi Cá Trích.jpg` (Commons). Cả hai từng bị bẫy bỏ dấu trong `DENY_TITLES` ("Bánh cáy"≈"bánh cay") → thêm cơ chế `PIN_TITLE` (ghim đúng tên file, so khớp GIỮ NGUYÊN DẤU). SVG còn **28** món.
- `intro` giữ **274** (34 món không có bài Wikipedia khớp TRỌN tên — thà trống hơn bịa, UI ghi nguồn Wikipedia); `facts` 247.
- **`detail` 169 → 308/308**: script mới `tools/data/data-fill-detail.mjs` (có `--dry`, `--redo`, `SRC=`) dựng mục *Nguồn gốc / Nguyên liệu / Cách làm / Thưởng thức* từ dữ liệu sẵn có của chính món → 139 món gắn **`detailSource: "tong-hop"`**; 169 món cũ gắn `"wikipedia"`; `facts.type` rác của Wikidata bị loại.
- `data-split.mjs`: `detailSource` vào `HEAVY_FIELDS` · `data-sync-sqlite.mjs`: cột `detailSource` + tự `ALTER TABLE` khi bảng cũ thiếu · `data-validate.mjs`: enum `wikipedia|tong-hop`, kiểm lite không chứa trường này. Pipeline đã chạy lại: sync-sqlite → split (5/5 khớp) → validate exit 0.

**b) task-07 — tìm quán: giờ mở cửa + quán đã lưu**
- Module mới: `lib/opening-hours.js` (`parseOpeningHours`, `openStatus`, `isClosedNow`, `fmtMin`) và `lib/saved-places.js` (`placeKey`, `toggleSaved`, `setNote`, `savedForDish`…).
- `lib/nearby-core.js`: thêm `osmKey`, `hoursIndex`, `openForPlace`, `attachHours` (`HOURS_MATCH_M = 60`), `placesFromPhoton`/`poisFromOverpass` trả `nname` + `osm`, `packPoi` thêm `lat/lng/osm`. `server.js` trả thêm `hoursKnown`.
- `app.js`: `shopRowHTML` (badge 🟢/🟡/🔴/⚪ + nút 🔖 ≥46px), `paintNearby` (đổi công tắc chỉ vẽ lại, không gọi mạng), `setOpenOnly`, `savedForDishHTML`/`refreshSavedForDish`, `toggleSavePlace`, `savedPlacesHTML` (drawer ♥, ghi chú được), `savedSet()` cho lọc.
- `index.html`: công tắc `#fHasSavedPlace` (nhóm *Thêm*). `styles.css`: `.shop-row/.save-btn/.shop-hours/.saved-here/.saved-card/.sp-note`. `sw.js`: thêm 2 module vào `SHELL` (**không tăng VERSION**).
- Giới hạn thật: `opening_hours` chỉ có ở **15–20%** quán OSM VN (Sài Gòn 15.0%, Hà Nội 20.0%) → đa số vẫn ⚪ "chưa rõ giờ"; Photon 0% có `opening_hours` trong `extra` nên Overpass là nguồn duy nhất.

**c) task-08 — quay nhóm · mục tiêu calo/ngân sách · thành tựu · nhãn nội dung tổng hợp**
- Module thuần mới (đều có test riêng, không DOM): `lib/group-core.js`, `lib/goals-core.js`, `lib/achievements.js`. `sw.js` `SHELL` thêm 3 file (không tăng VERSION — giữ 300 ảnh offline).
- **Quay nhóm**: nút **👥 Quay nhóm** cạnh 📅 Hôm nay (`#btnGroup` → modal `#groupBackdrop`). Nhập 2–8 tên (`parseNames`: cắt `, ; \n +`, bỏ tên trùng), mỗi người gạch tối đa 0–5 món (mặc định 2) từ **12 món gợi ý** theo bộ lọc hiện tại + ô tìm kiếm + "bỏ qua lượt". Hết lượt → `state.groupVeto` (Set id) lọc trong `pool()` → chạy đúng `spinOnce()` cũ, không viết lại cơ chế quay. Popup thêm `.group-line` "👥 Cả nhóm: An, Bình, Chi" + `<details class="group-veto">` (mặc định thu gọn) liệt kê món bị gạch (hợp các lượt, không trùng). Pool rỗng → màn "Hết món để quay" + nút bỏ gạch từng món. Đóng popup → `closeModals()` xoá `groupVeto`, pool trả lại như cũ.
- **Mục tiêu calo/ngân sách** (`mgd.goals = {kcal, money, week, priority}`): panel 📅 Hôm nay có 3 ô nhập (kcal/ngày, tiền/ngày, tiền/tuần — trống = 0 = không dùng) + thanh "đã dùng / mục tiêu" (`progressRows`, đỏ khi vượt) + công tắc **🎯 Ưu tiên món vừa mục tiêu** (mặc định BẬT). "Đã dùng" = món trong **nhật ký hôm nay** + món đã điền **thực đơn hôm nay**, không tính trùng (`usedTodayIds`). `goalFactor` nhân **×0.4** vào trọng số `drawOne` cho món vượt phần kcal còn lại, **×0.4** nữa nếu vượt phần tiền (vượt cả hai ×0.16) — **không loại khỏi pool**; chip bối cảnh ghi "🎯 ưu tiên vừa mục tiêu (còn 1500 kcal · 120k hôm nay)".
  - **Đo thật** (`test-goals.mjs`, 2000 lần `drawOne`/pool 20 món): món 730 kcal với mục tiêu 500 → **205 → 81 lần (39.5% mốc), hệ số 0.40**; món 160k với ngân sách 60k → **30.3% mốc, hệ số 0.40**; vượt cả hai → **0.160**; tắt công tắc → 98.5% mốc, hệ số 1.00; pool toàn món vượt vẫn ra **300/300** (không loại hẳn).
- **Thành tựu** (`mgd.achv = {unlocked:{id: ts}}`): 14 mục, mỗi mục tiến độ x/y — quay lần đầu · khám phá 50/150 món · chốt 5/20 món · **ăn đủ 5 vùng miền** · chốt 10 món quốc tế · 20 món đặc sản · 5 món chay · **chuỗi 3/7 ngày có nhật ký** (`maxDayStreak`) · **7 ngày liền không lặp món** (`noRepeatRun`) · 10 món yêu thích · đủ 3 bữa hôm nay. Hiện trong panel 📅 Hôm nay (thẻ + thanh tiến độ, 🔒 khi chưa mở); `checkAchv` gọi qua `requestIdleCallback` (`achvLater`) ở các mốc quay/chốt/thêm thực đơn và **làm thinh lúc boot** → toast "🏆 Mở khoá thành tựu" đúng **một lần**.
- **Nhãn nội dung tổng hợp**: `detailBlock(d)` thêm `<p class="detail-src">ℹ️ Nội dung tổng hợp, có thể chưa đầy đủ</p>` **chỉ khi** `d.detailSource === 'tong-hop'`; món `wikipedia` hoặc không có trường hiển thị y như cũ.
- **Test mới**: `test-group.mjs` (25 check) · `test-goals.mjs` (20) · `test-achv.mjs` (15) · `test-detailsrc.mjs` (9) · `test-legacy-id.mjs` (22, task-10). Đều in `PASS`/`FAIL` + `KẾT QUẢ:` và tự exit 1 khi FAIL → `test-all` nhận tự động (37 file).

**d) Tài liệu**
- `README.md`: thêm mục Quay cho nhóm / Mục tiêu / Thành tựu, bảng **khoá localStorage**, 6 module `lib/`, số liệu mới (ảnh 280 · detail 307 · 27 SVG), `data-fill-detail.mjs` trong pipeline, **37 file** test + tên các test mới.
- `CONTEXT_SUMMARY.md`: mục này (v26) + sửa §5/§6/§7/§14 (độ phủ, tools, tính năng, "việc còn lại" đúng hiện trạng).
- `.delegate/BRIEF.md`: bản đồ file (dòng mới: app.js 2473, index.html 292, styles.css 928, sw.js 126, 6 module `lib/`), bảng vùng chức năng app.js vẽ lại theo dòng mới, thêm 6 khoá localStorage, `detailSource` trong HEAVY + schema, `goalFactor` trong công thức trọng số, 36 file test, hằng số `SHELL`/VERSION.

**e) Kết quả kiểm chứng** — xem mục 25.1.

**f) task-10 — gộp món trùng `banh-plan` → `banh-flan`**
- `data/dishes.json`: xoá `banh-plan` ("Bánh plan" — cùng món với "Bánh flan"), `count` 308 → **307**; `banh-flan.kw` thêm **"Bánh plan"** để tìm quán ở miền Nam vẫn ra.
- `tools/data/aliases.json`: bỏ khoá `banh-plan`, gộp tên tra cứu sang `banh-flan` (`Crème caramel`, `Flan`, `Bánh flan`, `Bánh plan`). `data-patch-aliases.mjs`: thay dòng `'banh-plan'` bằng `'banh-flan': ['Bánh flan', 'Bánh plan']` + ghi chú để chạy lại pipeline không tạo lại khoá cũ.
- `app.js`: `ID_LEGACY = { 'cơm-chay': 'com-chay', 'banh-plan': 'banh-flan' }` → yêu thích/lịch sử/nhật ký/thực đơn/quán đã lưu/link `#mon=banh-plan` cũ đều về `banh-flan`.
- Test mới `tools/test/test-legacy-id.mjs` (22 check, không cần mạng): dữ liệu không còn `banh-plan`, kw có "Bánh plan", `#mon=banh-plan` mở popup Bánh flan (hash giữ nguyên), `mgd.favs` chứa id cũ → 1 thẻ Bánh flan, có CẢ HAI id → không nhân đôi, `mgd.hist/seen/recentDraws/diary/menu/savedPlaces` chứa id cũ đều đọc ra `banh-flan`.
- Pipeline đã chạy: `data-sync-sqlite.mjs` (307 dòng, xoá 1 dòng thừa) → `data-split.mjs` (5/5 file) → `data-validate.mjs` exit 0 (Lỗi 0 · Cảnh báo 0).

### 25.1 KẾT QUẢ CUỐI (task-10, chạy lại toàn bộ sau task-05 → task-09)
- `node tools/test/test-all.mjs http://127.0.0.1:4322` (LAN, `PORT=4322 node server.js`) — **37/37 file exit 0 · `TẤT CẢ EXIT 0`**.
- `node tools/test/test-all.mjs http://127.0.0.1:4399` (`node tools/dev/probe-static.mjs 4399`) — **37/37 file exit 0 · `TẤT CẢ EXIT 0`**.
- Không có `FAIL` nào trên cả 2 base. SKIP theo thiết kế (mạng ngoài, không tính FAIL): `test-api` bỏ khối `/api` trên bản tĩnh; `test-nearby-radius` bỏ khối "quán có tiếng" khi Overpass rỗng; các test phụ thuộc Photon/ipapi tự bỏ mục khi dịch vụ không tới được.
- Chạy **đồng thời 2 base** thì `test-fame-mock.mjs` có thể FAIL do tải CPU (chờ ảnh/khung quá hạn); chạy riêng trên LAN **PASS** và lần chạy LAN đơn độc sau đó **36/36 exit 0** ⇒ chập chờn do tải, không phải lỗi chức năng.
- Test mới (cả 2 base đều `KẾT QUẢ: OK`): `test-group` 25 check · `test-goals` 20 · `test-achv` 15 · `test-detailsrc` 9 · `test-legacy-id` 22.
- `audit-layout.mjs` (375/390/458px): **tràn ngang: không · tap target <44px: không**; `test-clip` / `test-touch` / `verify-desktop-mobile` / `audit-desktop` đều exit 0.
- `node tools/data/data-validate.mjs` → exit 0 (307 món · Lỗi 0 · Cảnh báo 0 · 5/5 file tách khớp byte): ảnh 280/307 (91.2%) · intro 273 · facts 246 · detail 307/307 (168 wikipedia + 139 tổng hợp) · SQLite 307/307.
- `node --check` **65 file** JS/MJS → 0 lỗi.

## 26. v27 (task-11) — tìm kiếm món: ô tìm riêng, không dấu, mở thẳng popup

**a) Module thuần `lib/search-core.js` (324 dòng, không I/O)**
- `fold(s)`: chữ thường → NFD bỏ dấu → `đ→d` → gộp khoảng trắng. `fold('Đồ nướng') = 'do nuong'`.
- `buildIndex(dishes)` dựng entry nhẹ: `name/nameWords`, `kw[]`, `tags[]`, `descr`, `origin`, nhãn `VUNG_LABEL`/`REGION_LABEL`/`STYLE_LABEL` (+ alias: "nhật", "hàn", "miền tây", "bắc"…) và `suggWords` cho gợi ý gõ sai. **KHÔNG chụp** `facts.ingredients`/`detail` — lúc tìm mới đọc từ dish (WeakMap cache), nên mảnh nặng tải xong là tìm được ngay, không phải dựng lại index.
- `searchDishes(index, q, {limit})` → `[{dish, score, why}]`; món phải khớp **đủ mọi từ** của query ở bất kỳ trường nào. Điểm từng từ: tên (khớp từ 600 / đầu từ 580 / chứa 430) > `kw` (520/480/400) > tags 430 > vùng/ẩm thực/cách chế biến 400 > mô tả/xuất xứ 300 > nguyên liệu/chi tiết 260; điểm món = **min** các từ. Cộng thêm: tên trùng hẳn 1000 > tên bắt đầu bằng query 800 > mọi từ là đầu một từ trong tên 700 > tên chứa query 520; `kw` trùng hẳn query +90 ("banh plan" → Bánh flan); query **có dấu** thì mỗi từ khớp đúng dấu +30 (tối đa 90) nên "phở" xếp Phở trên "Phô mai…"; hoà thì `rating × 0.4` rồi tên.
- `why` ngắn: `tên khác: Bánh plan`, `từ khoá: chay`, `vùng: Miền Trung`, `ẩm thực: Nhật Bản`, `cách chế biến: Lẩu`, `xuất xứ: Huế`, `mô tả: …`, `nguyên liệu: tôm` (cắt 54 ký tự quanh chỗ khớp).
- `suggestDishes(index, q, n=3)`: Levenshtein trên từ đã bỏ dấu, ngưỡng **≤1 với từ ≤4 ký tự, ≤2 với từ dài hơn** (cắt sớm khi vượt ngưỡng), xếp theo tổng khoảng cách rồi `rating`. `searchWithSuggest` trả `{query, results, suggestions}` (chỉ gợi ý khi 0 kết quả).

**b) Giao diện (`index.html` + `styles.css` + `app.js` vùng 1681–1864)**
- Nút **🔍 `#btnSearch`** ở header (44×44, `aria-label="Tìm kiếm món"`; máy ≤420px thu logo 34px + h1 14px để 4 nút không tràn). Lớp `#searchBackdrop` → `#searchDialog`: **toàn màn hình** trên mobile, **hộp nổi 640px / max 74vh** trên desktop ≥1024px. Mở bằng nút hoặc phím `/`, đóng bằng ✕ / bấm nền / `Esc`; `openSearch()` tự focus ô nhập; `closeSearch()` chỉ mở khoá `body.overflow` khi không còn lớp nào mở.
- Gõ → `renderSearch()` debounce **120 ms**, tối đa **30 dòng**: ảnh 54px (fallback emoji), tên **tô đậm phần khớp** (`hlName`, fold giữ nguyên số ký tự), `why`, bậc R/SR/SSR/UR + ★ + giá + vùng, ♥ nếu đã lưu, nhãn **"ngoài bộ lọc"** khi `!matchDish(d,false,'')`.
- Bấm dòng → `openSearchResult()`: lưu từ khoá, đóng lớp tìm, `openWin(d)` (đúng đường link `#mon=`), **không quay**.
- **Tìm trên TOÀN BỘ món**, bỏ qua mọi bộ lọc kể cả "chỉ món Việt" → "pizza" vẫn ra kèm nhãn "ngoài bộ lọc"; `state.vnOnly` không đổi.
- **🎰 Quay trong N kết quả** (`spinInResults`): đặt `state.searchOnly = Set(id)` → `pool()` trả đúng các món đó (bỏ qua bộ lọc) → `spinOnce()` cũ; băng chuyền dừng thì `spin()` xoá `searchOnly` + `syncPool()` (test: món trúng ∈ kết quả, pool về 85/85 như trước). Nút ẩn khi <2 kết quả.
- Ô trống: **Tìm gần đây** (`mgd.searchHist` ≤8, mỗi từ có ✕ 44px + "Xoá hết") và 8 chip gợi ý (phở, bún, cơm, bánh mì, lẩu, chè, món chay, đồ nướng). 0 kết quả: "Không thấy món …" + "Có phải: …" (bấm để tìm lại).
- Ô `#fSearch` trong sheet Lọc dùng chung `fold()` qua `dishFoldText()` (cache WeakMap): "pho" lọc ra món Phở, tìm thêm trong `kw` + `origin`; hành vi còn lại giữ nguyên.

**c) Khác**: `sw.js` thêm `lib/search-core.js` vào `SHELL` (**không tăng VERSION** `mgd-v24-2`). Hook `window.__mgd` thêm `fold, buildIndex, searchDishes(q,opts), searchWithSuggest, searchIndex, openSearch, closeSearch, renderSearch, searchInput, searchHist, searchOnly, spinInResults, hlName, syncPool`. Phím tắt: `/` mở tìm kiếm, `Esc` đóng (trong ô nhập cũng đóng), `F` vẫn mở ô tìm của sheet Lọc; `isOverlayOpen` đã tính lớp tìm (Space/T không quay khi đang tìm).

**d) Test**: `tools/test/test-search.mjs` — **38 check PASS** (unit 14 + UI 24): fold có `đ`, "pho"→Phở, "phở" > "phô…", "banh mi", "bun bo hue", query nhiều từ, `kw` "banh plan" → Bánh flan, vùng/ẩm thực/cách chế biến/tag, gợi ý "phoo"/"bun bo hu", rác/rỗng không lỗi, ≤30 dòng; UI: nút 🔍 44px, focus, chip, tô đậm, bấm dòng mở đúng popup, pizza xuyên bộ lọc + nhãn, quay trong kết quả (đúng món + pool trả lại), tìm gần đây sau reload + xoá, tìm theo `facts.ingredients` khi đã tải mảnh, `#fSearch` không dấu, 375/390/458px không tràn ngang & tap ≥44px, desktop `/` mở + `Esc` đóng. Test chặn mạng ngoài (open-meteo/ipapi/photon/overpass) nên không phụ thuộc dịch vụ.

### 26.1 KẾT QUẢ CUỐI (task-11)
- `node tools/test/test-all.mjs http://127.0.0.1:4322` (LAN, `PORT=4322 node server.js`) — **38/38 file exit 0 · `TẤT CẢ EXIT 0`** (gồm `test-search` 38 check OK).
- `node tools/test/test-all.mjs http://127.0.0.1:4399` (`node tools/dev/probe-static.mjs 4399`) — **38/38 file exit 0 · `TẤT CẢ EXIT 0`**.
- `audit-layout` (375/390/458px): tràn ngang **không** · tap target <44px **không** (header 4 nút vẫn đủ chỗ).
- `node --check` **67 file** JS/MJS → 0 lỗi. `node tools/data/data-validate.mjs` → exit 0 (307 món · 5/5 file tách khớp byte, dữ liệu không đổi).
- 5 ví dụ query thật (top 3): `pho` → Phở bò · Phở gà · Phở chiên phồng; `banh mi` → Bánh mì thịt · Bánh mì chảo · Bánh mì kẹp kem; `lau` → Lẩu cay Tứ Xuyên · Lẩu mắm miền Tây · Lẩu dê tía tô; `tom` → Tôm rang me · Tom Yum · Bánh xèo tôm nhảy; `nhat` → Ramen Nhật · Trứng hấp kiểu Nhật · Cơm cà ri Nhật.
