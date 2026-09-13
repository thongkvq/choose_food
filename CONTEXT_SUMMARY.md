# CONTEXT SUMMARY — Món Gì Đây? (web gacha chọn món ăn)

_Cập nhật: bản cô đọng. Trạng thái: ĐANG CHẠY, đã verify._

## 1. Yêu cầu gốc (giữ nguyên ý)
"Web chọn món ăn sáng/trưa/chiều/ăn vặt… quay như gacha, có hình minh hoạ món ăn, món Việt/Tây/Tàu…, món khô/nước/chiên/nướng, hiệu ứng đẹp mắt."
Bổ sung sau đó: quay kiểu **băng chuyền chạy ngang** dừng từ từ; ảnh món **chính xác**; **chỉ dùng trên mobile**; thao tác phải dễ, **có nút bấm để quay**; chọn xong phải hiện **popup thông tin món**; thông tin món **chi tiết**; lấy **thông tin tiếng Anh rồi dịch sang tiếng Việt**; **dùng toạ độ thiết bị** để liệt kê **quán bán món đó gần đây**.

## 2. Chạy & truy cập
    cd '/var/lib/dsh/Choose foody' && node server.js      # job nền, tự in URL
- HTTP  (LAN)     : http://192.168.100.13:4321      ← dùng hằng ngày
- HTTP  (máy này) : http://127.0.0.1:4321
- HTTPS (LAN)     : https://192.168.100.13:8443     ← **cần để dùng GPS thật** (chứng chỉ tự ký, bấm "Nâng cao → Tiếp tục")
- Port đổi bằng `PORT` / `HTTPS_PORT`. Cert: `certs/key.pem` + `certs/cert.pem` (openssl, SAN = IP LAN).
- Đã tắt cache (`no-cache, must-revalidate`) cho html/js/css/json → F5 là thấy bản mới. gzip bật: lần tải đầu ~59KB (thô 238KB).

## 3. Kiến trúc & quyết định chính
- **Vanilla JS ES module, không build step, không dependency**; `server.js` là static server + 3 API.
- **SQLite là nguồn dữ liệu gốc**, export ra `data/dishes.json` cho frontend (không hardcode món trong JS).
- **248 món**, 6 bữa (sang/trua/xe/toi/khuya/vat), 11 nền ẩm thực, 10 cách chế biến, 4 bậc độ hiếm (45/30/18/7%) + pity 10 lần.
- **Hình minh hoạ**: 23 template SVG vẽ bằng code (`art.js`) + ảnh thật từ Wikipedia/Wikimedia (235 món có ảnh, 13 món dùng SVG).
- **Chỉ quay bằng nút** "🎰 QUAY 1 MÓN" / "⚡ x10" (khung quay đã tắt nhận chạm; không còn vuốt-để-quay).
- **Popup kết quả** tự mở sau khi băng chuyền dừng, render phòng thủ (try/catch + fallback) nên dữ liệu cũ cũng không làm trắng thẻ.

## 4. Dữ liệu mỗi món (trong data/dishes.json + SQLite)
| Trường | Nội dung | Độ phủ |
|---|---|---|
| name/emoji/region/meals/style/tags/descr | cơ bản | 248 |
| price/minutes/spicy/veg/weight/tier | thuộc tính gacha | 248 |
| image + imageVia + imageSource | ảnh thật có nguồn (vi-wiki/en-wiki/commons) | 235 |
| rating + stars + review | điểm 7.1–9.8 + nhận xét (48 món viết tay) | 248 |
| calories/protein/proteinLabel/fullness/priceRange/bestFor/bestTime/origin/tip | ước tính + gợi ý (ghi rõ "ước tính") | 248 |
| intro + introSource + wikiUrl + introEn | đoạn mở đầu Wikipedia, **đã dịch sang tiếng Việt** | 234 |
| facts {originCountry,cuisine,ingredients,type} | Wikidata | 215 |
| detail[{t,body}] | mục Nguồn gốc/Nguyên liệu/Cách làm/Biến tấu | 131 |
| kw[] | từ khoá tra quán | 248 |

**Bảng SQLite `dishes`** có đủ các cột trên (đã đồng bộ; intro 234, facts 215, detail 131, introEn 71).

## 5. Files
- `index.html` — khung UI: header, băng chuyền, 1 hàng nút [⚙️ Lọc][🎰 QUAY 1 MÓN][⚡ x10], filter sheet, modal kết quả/10-pull, drawer yêu thích, toast.
- `styles.css` — mobile-first: biến `--card-w/--vp-h`, safe-area, dvh, tap target ≥44px, chế độ gọn cho màn thấp (`max-height:740px`), breakpoint 480/640/1024.
- `app.js` — gacha (weighted + pity), quay băng chuyền (WIN_INDEX, easeOutQuint), popup (điểm/giới thiệu/chi tiết/facts/quán gần đây), bộ lọc, yêu thích, lịch sử, confetti, âm thanh, rung.
- `art.js` — 23 template SVG.
- `server.js` — static + gzip + `/api/whereami` (vị trí theo IP + hâm nóng khu vực) + `/api/nearby` (lọc quán theo món, Photon + Overpass) + `/api/geocode` (địa chỉ → toạ độ) + HTTPS 8443.
- `data/dishes.json`, `certs/`, `tools/*` (xem mục 6), `README.md`, `CONTEXT_SUMMARY.md`.

## 6. Công cụ trong tools/
Thu thập dữ liệu: `fetch-images.mjs` (ảnh theo lô từ Wikipedia) · `dedup-images.mjs` · `normalize-image-urls.mjs` (ép thumbnail 500/960px) · `fix-images.mjs`+`fix-images2.mjs`+`strip-wrong-images.mjs` (sửa/bỏ ảnh sai) · `enrich-dishes.mjs` (điểm, dinh dưỡng ước tính) · `enrich-wiki.mjs`+`enrich-wiki2.mjs` (giới thiệu + Wikidata) · `enrich-sections.mjs` (mục chi tiết) · `translate-vi.mjs` (dịch EN→VI) · `audit-images.mjs` · `verify-images.mjs`.
Kiểm thử (chromium thật, mượn chromedeps): `audit-layout.mjs` (bố cục 3 cỡ màn) · `diag-scroll.mjs`/`diag-scroll2.mjs` (bisect lỗi cuộn) · `test-touch.mjs` · `test-popup.mjs` · `test-olddata.mjs` (dữ liệu cache cũ) · `test-result-card.mjs` · `test-detail.mjs` · `test-intro.mjs` · `test-nearby.mjs` · `test-gps.mjs` · `test-loc-http.mjs` · `screenshots.mjs` (ảnh chụp vào `tools/screenshots/`).
Chạy chromium thật khi thiếu lib:
    const require = createRequire('/srv/ai-workspaces/dsh-home/profiles/web/');  // playwright
    chromium.launch({ executablePath: '/var/lib/dsh/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
      args: ['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'],
      env: { ...process.env, LD_LIBRARY_PATH: '/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu:/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu/alsa-lib:/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu/gbm' } })
    // container KHÔNG có font hệ thống (fc-list = 0) → mọi chiều cao chữ phải dựa vào line-height tường minh; ảnh chụp sẽ không hiện chữ

## 7. Tính năng người dùng thấy
1. **Băng chuyền ngang** 34 thẻ (phone) / 60 (desktop), hãm phanh easeOutQuint, dừng đúng tâm (đo được lệch 0px), tiếng tick + rung theo nhịp.
2. **Popup kết quả**: ảnh lớn, điểm/10 + sao, nhận xét, **Giới thiệu (Wikipedia)** + Đọc thêm, **📖 Chi tiết** (nguồn gốc/nguyên liệu/cách làm/biến tấu), bảng thông tin (calo, đạm, độ no, giá, vùng miền, quốc gia gốc, ẩm thực, nguyên liệu, loại món, thời gian), "hợp với ai", mẹo, credit ảnh, và **📍 Tìm quán bán món này gần tôi**.
3. **Quán gần đây**: GPS nếu https, không thì theo IP, hoặc **nhập địa chỉ / lat,lng**; Photon lọc quán có tên khớp món, mở rộng 2.5→5→10km; mỗi quán có khoảng cách, địa chỉ, nút chỉ đường; luôn kèm link Google Maps.
4. **Lọc**: bữa ăn, ẩm thực, cách chế biến, chay, không cay, **điểm ≥8.5**, ngân sách, thời gian, tìm kiếm + 9 preset nhanh.
5. **Yêu thích + lịch sử + tiến độ bộ sưu tập + chốt món** (giữ popup kèm ribbon "✓ Đã chốt").

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
Công cụ phát hiện: `tools/diag-cover.mjs` (liệt kê khối bị cắt + đo độ phủ), `tools/test-clip.mjs` (kiểm tra 3 cỡ màn).

## 10. v14 — Thời tiết/giờ · Gu · Nhật ký · Thực đơn hôm nay · Chia sẻ ảnh
- **API mới**: `/api/weather?lat&lng` (Open-Meteo, không cần key, cache 15 phút) trả temp/desc/rain/storm/snow/isDay/hour.
- **chip #ctxChip** dưới hàng nút quay: hiện thời tiết + bữa hiện tại + lý do ưu tiên; bấm để bật/tắt (`mgd.ctxOn`).
- **biasOf(d)** nhân trọng số trong `drawOne`: mưa → món nước/lẩu ×2.2; nóng ≥32° → ngọt/uống/trộn/cuộn ×1.7, nướng/lẩu/chiên ×0.8; lạnh ≤22° → lẩu/nước/nướng/chiên ×1.6; bữa theo giờ ×1.8; gu khẩu vị cộng/trừ tối đa ±35–60%.
  Đo 4000 lần quay: mưa → món nước 14.8% → **30.7%**; nóng → đồ uống 5.1% → 8.1%, lẩu 2.9% → 1.7%.
- **Lưu cục bộ** (localStorage): `mgd.diary` (nhật ký), `mgd.taste` (gu), `mgd.menu` (thực đơn theo ngày), `mgd.wx`, `mgd.ctxOn`.
- **Panel #todayBackdrop**: 3 ô bữa (`MENU_SLOT` map bữa phụ: xế/vặt → trưa, khuya → tối), tổng kcal/đạm/tiền, gợi ý cân bằng, gu, nhật ký 7 ngày, nút xuất ảnh.
- **shareCard()** vẽ canvas 1080×1350 (thực đơn hoặc món) → `navigator.share` files nếu hỗ trợ, không thì tải PNG.
- Popup có thêm **📅 Vào thực đơn**; nút **Quay lại** giờ trừ điểm gu.
- **Hook test**: `window.__mgd = { state, biasOf, pool, drawOne, mealByHour, ALL }` (chỉ đọc) — dùng bởi `tools/test-bias.mjs`.
- BUG tự gây khi patch: chèn nhầm 3 dòng khởi tạo vào trong handler chip (chip không hiện) → đã chuyển về cuối IIFE boot cạnh `idleTrack()`.
- Đo lại: panel Hôm nay 458×1017 cao 732px (trọn, không cuộn), 375×667 cuộn 118px, không cắt chữ, không nút <40px; audit bố cục + jsdom + test-clip đều pass.

## 11. v15 — Chuẩn bị deploy Vercel
- **Trọng lượng client**: index.html 11KB + styles.css 42KB + app.js 62KB + art.js 20KB + data/dishes.json 851KB = **966KB thô → 234KB gzip** (~59KB gzip cho phần code, 201KB cho JSON món). Ảnh **không nằm trong repo** (235 ảnh hotlink từ upload.wikimedia.org) nên không tốn băng thông Vercel.
- **Đã tạo**: `api/_lib.js` (norm/distM/jsonFetch/cached/setCache/withTimeout + whereAmI/weather/geocode/photonSearch/overpassNear), `api/whereami.js`, `api/weather.js`, `api/geocode.js`, `api/nearby.js`, `vercel.json` (maxDuration: nearby 30s, whereami 20s, weather/geocode 15s; cache header cho data/dishes.json và no-store cho html/js/css), `.vercelignore` + `.gitignore` (loại node_modules 96MB, tools/screenshots, certs, memory).
- **Overpass đổi thành opt-in**: mặc định `/api/nearby` chỉ chạy Photon (~1.2s); client tự gọi lại kèm `&ov=1` khi không có quán nào khớp tên món (khi đó chờ tối đa 3.5s, hết giờ thì bỏ qua, vẫn còn link Google Maps). server.js LAN cũng race Overpass 4s.
- **Test handler bằng Node** (không cần Vercel CLI): `tools/test-vercel-fn.mjs` giả lập `{query}` + `res.status().json()` — whereami/weather/nearby/geocode đều 200, thiếu lat/lng trả 400; `tools/test-vercel-speed.mjs` đo thời gian (1.2s thường / 3.5s khi ov=1).
- **Trên Vercel GPS chạy sẵn** vì có HTTPS (không cần mẹo chứng chỉ tự ký như LAN). Cache trong RAM là theo instance (cold start) + có `s-maxage` ở CDN.
- Deploy: `git init && git add -A && git commit -m "Mon Gi Day" && npx vercel --prod`.

## 12. Đã đẩy lên GitHub (chờ import Vercel)
- Repo: **https://github.com/thongkvq/choose_food** (public), nhánh `main`, **65 file**, ~2 MB.
- Xác thực: **deploy key SSH** `~/.ssh/mongi_deploy` (đã thêm vào repo với quyền ghi); git repo-local đã set
  `core.sshCommand = ssh -i ~/.ssh/mongi_deploy -o IdentitiesOnly=yes`.
- Các commit: khởi tạo → thêm `deploy.sh` + `vercel.json` → bỏ dependency `vercel` khỏi `package.json` (do lúc cài CLI bị npm tự thêm vào) → đơn giản hoá `vercel.json` → loại `tools/` khỏi gói deploy → thêm `tools/test-live.mjs`.
- Vercel CLI 59.16.0 nằm ở `node_modules/.bin/vercel` (đã .gitignore/.vercelignore); deploy bằng `VERCEL_TOKEN=... ./deploy.sh` nếu không import qua dashboard.
- Kiểm tra sau deploy: `node tools/test-live.mjs https://<tên>.vercel.app` (đã thử trên server LAN: 7/7 endpoint 200, nearby 1.0s).
- Cấu hình import: Framework **Other**, Build Command để trống, Output Directory để trống, Install mặc định.
- **ĐÃ DEPLOY THẬT** (2026-09-12): Vercel bot deploy cả 4 commit cuối, commit status `success`.
  - Deploy URL: `https://choose-food-c3gpyxdko-paroda.vercel.app` (dpl_GPtUbvGrw93ULvT34oYBSKcLxJAc)
  - Alias production: `https://choose-food-paroda.vercel.app` (team/scope **paroda**)
  - ✅ **SITE ĐÃ CHẠY CÔNG KHAI: https://choose-food-paroda.vercel.app** (đã tắt Vercel Authentication)
  - ⚠️ **Kiến trúc trên Vercel = tĩnh thuần**, không dùng serverless function (xem mục 13). Ảnh/JS/CSS/dishes.json tải 200; `/api/*` trả 404 và client tự chuyển sang gọi thẳng dịch vụ.
  - ⚠️ **Đang bật Vercel Authentication (Deployment Protection)** → mọi path trả về trang "Login – Vercel". Muốn public phải vào Settings → Deployment Protection → Vercel Authentication → **Disabled**. Kiểm tra lại bằng `node tools/test-live.mjs <url>` sau khi tắt.
  - Cách tìm URL deploy khi không có dashboard: `curl -s https://api.github.com/repos/thongkvq/choose_food/deployments` rồi lấy `statuses` → `environment_url`.

## 13. Vì sao Vercel phải là tĩnh thuần (đã sửa xong)
1. Repo có `package.json` với `"scripts": {"start": "node server.js"}` ⇒ Vercel coi đây là **Node app** và tạo một catch-all function. Vì `server.js` bị `.vercelignore` loại nên function đó chết ⇒ **mọi path 500 FUNCTION_INVOCATION_FAILED** (kể cả `/`, `/app.js`).
2. Thử cấu hình hiện đại (`functions`, `headers`) ⇒ vẫn 500.
3. Thử legacy `builds` (`api/*.js` = @vercel/node, `**/*` = @vercel/static) + `routes` ⇒ file tĩnh 200 nhưng `/api/*` **404** (function không được build).
4. **Giải pháp chốt**: bỏ serverless.
   - `vercel.json`: `{ "version": 2, "builds": [{ "src": "**/*", "use": "@vercel/static" }], "routes": [{ "handle": "filesystem" }] }`
   - `app.js` thêm **lớp API**: `apiMode()` thử `/api/whereami` → nếu không trả JSON thì `API_MODE='direct'`; `apiJSON(path, directFn)` ưu tiên server (LAN có cache), fallback gọi thẳng Photon / Open-Meteo / ipapi.co (cả ba đều CORS `*`), có cache localStorage (weather 15 phút, toạ độ 6 giờ, geocode 24 giờ).
   - Xoá `start` khỏi `package.json`; `api/` vẫn giữ cho server LAN.
5. **Đã kiểm chứng bằng browser thật trên link deploy**: trang nạp, chip thời tiết 25°C (Open-Meteo trực tiếp), quay ra popup (12 dòng thông tin + giới thiệu), GPS → **8 quán "Bánh canh cua" quanh 3km** (Photon trực tiếp), 0 lỗi JS, 0 request lỗi. Script: `tools/test-vercel-live.mjs`.

## 14. Việc còn lại / bước kế tiếp
- 14 món chưa có bài Wikipedia (com-nieu, mien-cua, pho-tron, hu-tieu-kho, bo-ne, chao-dau-xanh…) — hiện chỉ có điểm + ước tính.
- 13 món dùng hình vẽ SVG thay ảnh (không tìm được ảnh đúng trên Commons).
- Có thể thêm: lưu "thực đơn hôm nay" 3 bữa, chia sẻ ảnh kết quả, lọc theo quán đã lưu, cache ảnh offline (SW không chạy được trên http LAN).
- Muốn GPS thật trên điện thoại: mở **https://192.168.100.13:8443** và bỏ qua cảnh báo chứng chỉ.

## 15. v16 — Mặc định ẨN món nước ngoài (yêu cầu: "ăn bình thường, bỏ món Hàn/Nhật")
- Dữ liệu **không bị xoá** (248 món còn nguyên trong SQLite + `data/dishes.json`); chỉ **lọc mặc định**.
- `app.js`: `state.vnOnly = LS.get('mgd.vnOnly', true)` — mặc định **true**; trong `pool()` thêm điều kiện `(!state.vnOnly || d.region === 'vn')`.
- Hàm mới `paintRegionChips()` (chip ngoại thêm class `.foreign-off`) và `setVnOnly(on, notify)` (lưu localStorage + toast + vẽ lại chip + `syncPool` + `idleTrack`).
- Bấm chip ẩm thực ngoại (Nhật/Hàn/…) khi đang bật **tự tắt** chế độ "chỉ món Việt" (xử lý trong `chipRow`); `resetFilters()` bật lại mặc định.
- `index.html`: công tắc **#fVnOnly** "🇻🇳 Chỉ món Việt — ẩn món nước ngoài" đầu nhóm *Thêm* (checked sẵn) + dòng nhắc `.fnote` ở nhóm *Ẩm thực*; `styles.css`: `.chip.foreign-off{opacity:.4;border-style:dashed}`, `.fnote`.
- Số liệu: 160 món Việt / 88 món quốc tế (cn 19, jp 13, fr 10, us 8, kr 9, th 7, tr 6, mx 6, in 5, it 5).
- Test tự động: `node tools/test-vnonly.mjs` (chromium thật, 390×844) — PASS: mặc định pool chỉ region `vn`, 6 lần rút ngẫu nhiên 0 món ngoại, 10 chip ngoại bị mờ, tắt công tắc → có lại món ngoại, bấm chip Nhật → chỉ còn jp, "Đặt lại" → về chỉ món Việt, reload nhớ trạng thái qua `mgd.vnOnly`.
- Muốn xoá hẳn 88 món ngoại khỏi dữ liệu thì phải sửa `data/dishes.json` + bảng SQLite `dishes` (chưa làm — có thể khôi phục từ `tools/.snapshot-before-fix.json`).

## 16. v17 — Tìm quán CHỐT 5km + link đặt món ShopeeFood/GrabFood
- **Bán kính tối đa 5km, không mở rộng nữa.** Trước đây thang bán kính là `[r, max(r*2,5000), max(r*4,10000)]` (2.5 → 5 → 10km). Nay chỉ còn **một mức**: `app.js` xin `r=5000`, `server.js` thêm `const MAX_RADIUS = 5000` và `attempts = [Math.min(radius, MAX_RADIUS)]`, `api/nearby.js` y hệt.
- `server.js`: `AREA_RADIUS` 3000 → **5000** (cache Overpass 30 phút theo ô 0.01°, khoá chỉ theo lat/lng); lọc `p.dist <= Math.min(radius, MAX_RADIUS)`; `/api/nearby` mặc định r = 5000 thay vì 2000.
- UI: dòng ghi chú đổi thành "N quán … trong ~5km (tối đa 5km)".
- **Link đặt món** (mới trong `app.js`: hàm `deliveryLinks(dishQ)`, dùng ở cả nhánh thành công và nhánh lỗi): ShopeeFood `https://shopeefood.vn/search?keyword=<món>` (route `/search` lấy từ bundle `app-f182e75cd868fe649223.js` của họ), GrabFood `https://food.grab.com/vn/vi/restaurants?search=<món>`. **Chỉ là link tìm kiếm** — mở app rồi tự đặt, KHÔNG lấy dữ liệu quán từ 2 nền tảng này.
- **Vì sao không lấy được dữ liệu ShopeeFood/GrabFood**: không có API công khai. `gappapi.deliverynow.vn/api/...` (backend ShopeeFood) trả **403** khi không có header ký/device token; shopeefood.vn là SPA (HTML shell chỉ 5.1KB, không có dữ liệu quán); food.grab.com có `__NEXT_DATA__` nhưng danh sách quán do client gọi API nội bộ có auth, HTML không chứa tên quán. Muốn dữ liệu quán thật (tên/địa chỉ/giờ mở/rating) thì dùng **Google Places API** (cần key, có free tier) hoặc giữ OSM/Photon như hiện tại.
- Test: `node tools/test-nearby-5km.mjs [baseUrl]` — phần A gọi `/api/nearby?...&r=20000` phải bị chặn còn 5000 (đo được xa nhất 4459m); phần B mở UI thật, quay 1 món, bấm 📍, kiểm tra mọi quán ≤5km + có đủ link ShopeeFood/GrabFood + ghi chú "tối đa 5km". Đã PASS trên LAN `http://127.0.0.1:4321`.

## 17. v18 — Người dùng tự chọn bán kính 2.5 / 5 / 10km
- **Bỏ mức chốt cứng 5km**: nay có **thanh chọn bán kính** trong khối "Tìm quán gần đây" (`radiusChipsHTML()` trong `app.js`, chip `.rad-chip[data-rad]`, mặc định **5km**, nhớ trong `mgd.radius`). Bấm chip khác → tìm lại ngay bằng **vị trí cũ** (không xin GPS lại).
- Server nhận `r` và **làm tròn LÊN** đúng 1 trong 3 mức (`TIERS = [2500, 5000, 10000]`, `snapTier`): xin 1000 → 2500, xin 20000 → 10000. Không tự nới bán kính trong lúc tìm nữa (bỏ thang `r*2, r*4`).
- **Sửa lỗi lọt quán ngoài bán kính**: Photon trả theo ô vuông nên có quán nhích ra ngoài (2.8km khi chọn 2.5km) → thêm `.filter(p => p.dist <= rad)` ở cả 3 nơi (`server.js`, `api/nearby.js`, `dirNearby()` trong `app.js`).
- **Overpass 10km**: kiểu `around:10000` bị Overpass trả **504** (đo 11.5s); đổi sang **bbox** (nam,tây,bắc,đông) cùng vùng chỉ ~2-3.5s, giới hạn `out center` 400/700/1000 theo mức. Thêm 2 gương dự phòng: `overpass.private.coffee`, `overpass.osm.ch` (Overpass hay trả 429 khi hỏi dồn).
- **Nạp nền khi hết giờ**: hạn chờ Overpass theo mức (2.5km→5s, 5km→9s, 10km→15s). Quá hạn thì trả ngay kết quả Photon + `areaWarming: true`, đồng thời **nạp tiếp 60s ở nền** rồi cache 30 phút → UI hiện gợi ý "bấm 🔄 Tìm lại sau ~10 giây là có". Cache Overpass theo ô 0.01° **+ mức bán kính**.
- Test: `node tools/test-nearby-radius.mjs [baseUrl]` (thay `test-nearby-5km.mjs` đã xoá) — kiểm API cho cả 5 trường hợp xin r (2500/5000/10000/20000/1000), rồi mở UI thật: đủ 3 chip, mặc định 5km, đổi 2.5km → mọi quán ≤2500m và URL gửi `r=2500`, lưu `mgd.radius`, đổi 10km → ≤10000m, F5 vẫn nhớ. Đã PASS trên LAN.

## 18. v19 — Gợi ý QUÁN CÓ TIẾNG trong 15km (mức bán kính thứ 4)
- **Thêm mức 15km**: `R_TIERS = [2500, 5000, 10000, 15000]` (app) và `TIERS` tương ứng ở `server.js`/`api/nearby.js`; `MAX_RADIUS = 15000`. Overpass `out center` nới giới hạn theo mức: 500/900/1600/**2600**; hạn chờ 15km = **20s**, nạp nền tối đa `ovBudget*4`. Ô 15km quanh Sài Gòn: 2315 POI, **ô lạnh ~3.4s**, gọi lại sau cache 0.25s.
- **"Quán có tiếng" chấm từ dữ liệu mở OSM** (`fameScore()` trong `server.js`, bản sao ở `api/nearby.js`): thương hiệu/chuỗi `brand|operator` +3, `website|contact:website` +2, giờ mở cửa +1, điện thoại +1, địa chỉ +1, khai báo cuisine +1 → trả 2 danh sách:
  - `famousMatch`: fame ≥3 **và** khớp tên món/ẩm thực (tối đa 8) → khối "⭐ Quán có tiếng bán món này".
  - `famousNear`: fame ≥4, không cần khớp món (tối đa 10) → khối "⭐ Quán có tiếng quanh đây".
  - Mỗi quán kèm `why[]` (lý do: "thương hiệu X", "có website", "có giờ mở cửa"…) hiện thành badge vàng trong `.fam-why`; UI ghi rõ **"không phải điểm đánh giá của khách"**.
- **Vì sao không có số sao/đánh giá thật**: OSM gần như không có `stars`/`rating` (đo 2000 POI ở Sài Gòn: wikidata **0**, brand 254, website 128, phone 191, hours 265, addr 745); Wikidata SPARQL "restaurant in bbox Sài Gòn" trả **0 kết quả**; Google Places/Nominatim cần key (Nominatim còn bị mạng này reset). Muốn điểm sao thật thì phải cắm **Google Places API**.
- **Bản tĩnh (Vercel) không có khối này**: Overpass **không gửi CORS header** (`Access-Control-Allow-Origin` trống) nên client không gọi thẳng được; Photon trả về không có tag brand/website. Client tự bỏ qua khối khi server không trả `famousMatch/famousNear`.
- Test: `node tools/test-nearby-radius.mjs` nay kiểm thêm 4 chip, API `r=15000` và `r=20000 → 15000`, khối quán có tiếng (có tiêu đề, có lý do, xa nhất ≤15km, có ghi chú nguồn OSM), F5 nhớ mức 15km. Bản tĩnh tự bỏ qua phần quán có tiếng. **PASS trên LAN**.
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
- **Gán bằng script chạy lại được**: `node tools/enrich-vung.mjs` — bảng phân loại viết tay theo `id` (không đoán bằng từ khoá), món Việt không nằm trong bảng tự rơi vào `vn`, món `region !== "vn"` thành `ngoai`. Snapshot trước khi sửa: `tools/.snapshot-before-vung.json`.
- **UI**: nhóm **🗺️ Vùng miền** trong filter sheet (`#vungChips`, `chipRow($("#vungChips"), VUNG, state.vung)`), chip: Miền Bắc 🏯 · Miền Trung 🌾 · Miền Nam 🏙️ · Miền Tây Nam Bộ 🛶 · Tây Nguyên ☕ · Cả nước 🇻🇳 · Ngoài Việt Nam 🌍. Bấm nhiều chip cùng lúc.
- **`VUNG_INCLUDE = { nam: ["nam","tay-nam-bo"] }`** — chọn "Miền Nam" là gồm luôn miền Tây Nam Bộ (đúng địa lý). Hàm lọc `vungHit(v)` dùng trong `pool()`; `state.vung` được tính vào `activeFilterCount()`; `resetFilters()` xoá vùng.
- **Chip 🌍 Ngoài Việt Nam** bấm vào thì tự tắt công tắc "chỉ món Việt" (giống chip ẩm thực ngoại); khi `vnOnly` bật, chip này mờ `.foreign-off`.
- **3 preset mới**: `vungBac` 🏯 Món miền Bắc · `vungTrung` 🌾 Món miền Trung · `vungTay` 🛶 Đặc sản miền Tây.
- **Popup**: thêm dòng **🗺️ Vùng miền** (`vungLabel(d.vung)`) và pill trong `.win-meta`; dòng cũ đổi nhãn từ "Vùng miền" → **📍 Xuất xứ** (giữ mô tả chi tiết như "Sài Gòn").
- **Test**: `node tools/test-vung.mjs [baseUrl]` — chromium thật 390×844, **12/12 PASS**: Tây Nam Bộ 4 món, Miền Nam 42 (38 nam + 4 tay-nam-bo), Bắc 38, Trung 17, Tây Nguyên 1, Cả nước 62, Bắc+Trung 55, Ngoài VN 88 + tự tắt vnOnly, preset miền Tây 4 món, popup có dòng "Vùng miền=", 0 lỗi JS.
- Hồi quy: `tools/test-vnonly.mjs` PASS (mặc định vẫn chỉ món Việt, chip ngoại mờ 10) · `tools/audit-layout.mjs` không tràn ngang, tap target ≥44px.
- Lưu ý khi đo bằng chromium trong container: **không có font hệ thống** nên mọi chip đo ra width ~30px và nằm 1 hàng — số đo bề rộng chữ vô nghĩa, chỉ tin số món/pool và logic.
- Bản tĩnh Vercel không cần sửa gì thêm: lọc vùng chạy thuần client trên `data/dishes.json`.
- **Đã deploy v21 (commit `58fbde3`)**: push lên `origin/main` → **Vercel bot tự deploy** (không cần token, không cần CLI). Theo dõi bằng `curl -s https://api.github.com/repos/thongkvq/choose_food/commits/<sha>/status` (pending → success ~35s). Bản production: **https://choose-food-paroda.vercel.app** — đã kiểm: `data/dishes.json` có `vung`, `app.js` có `vungHit`, `tools/test-vung.mjs <prod>` **12/12 PASS**, `/api/*` trả 404 là **bình thường** (bản tĩnh, client tự gọi thẳng dịch vụ).

## 21. v22 — FIX "chọn vùng miền xong không quay được" (user báo)
- **Nguyên nhân thật**: chọn vùng + **bữa ăn tự động theo giờ** ra **0 món** (đo lúc 19h: Tây Nguyên 0/1 món, Tây Nam Bộ 2/4) → `syncPool()` khoá nút quay, KHÔNG có thông báo nào ⇒ người dùng thấy "bấm không quay được". Không phải lỗi treo băng chuyền (quay với 2 món vẫn chạy hết 5.2s rồi mở popup bình thường).
- **Sửa**: thêm cờ `state.mealAuto` (true khi bữa do đồng hồ tự chọn ở boot, false khi người dùng bấm chip bữa / preset) + hàm `ensurePlayable()`: pool 0 mà bữa là tự động → **tự bỏ lọc bữa ăn**, toast giải thích ("Bữa Sáng không có món trong vùng này — đã bỏ lọc bữa ăn, còn N món"); còn 0 món thật (bữa do người dùng chọn / nhiều vùng) → toast cảnh báo + **tự mở sheet lọc**. `spinOnce()`/`spinTen()` gọi `ensurePlayable()` trước khi báo lỗi.
- **Chip vùng hiện số món**: `paintVungCounts()` (gọi trong `syncPool`) đếm số món mỗi vùng khi **bỏ qua chính bộ lọc vùng** → nhãn "Miền Bắc 🏯 · 20"; vùng 0 món thêm class `.chip.empty` (mờ + gạch chấm). Refactor `pool()` → `matchDish(d, ignoreVung, q)` để đếm dùng lại.
- Dòng trạng thái khi 0 món đổi thành "⚠️ 0 món khớp lọc — bấm để mở lọc" và **bấm được** để mở sheet.
- **Test**: `tools/test-vung.mjs` lên **16/16 PASS**, thêm 4 ca mới: `cuu0Mon` (bữa Sáng + Tây Nguyên → tự bỏ bữa, pool 1, nút quay mở), `quaySauKhiCuu` (quay xong mở popup thật), `khongTuBoBuaNguoiDung` (người dùng tự chọn bữa thì KHÔNG tự bỏ, chỉ báo + mở sheet), `chipHienSoMon`.
- Hồi quy PASS: `test-vnonly.mjs` · `audit-layout.mjs` (không tràn ngang, tap ≥44px) · `test-clip.mjs` (không cắt chữ trong popup 3 cỡ màn).

## 22. v23 — Lọc theo phạm vi bán + gợi ý vị trí (đang hoàn thiện)
- Mục tiêu: vùng lọc theo nơi món đang bán/phổ biến; phở, mì, bánh mì không mất khỏi vùng khác. Dữ liệu dùng vung cho gốc, dacSan cho cờ đặc sản địa phương, vungCo cho vùng bán.
- Dữ liệu hiện tại: 248 món, 160 Việt, 88 quốc tế, 28 đặc sản; vùng bán: Bắc 142 · Trung 140 · Nam 141 · Tây Nam Bộ 141 · Tây Nguyên 133; vung === "vn" 62 món. Đã sửa ID Bánh căn thành banh-can-chay; tools/enrich-vung.mjs validate mọi ID map có thật trong data/dishes.json.
- App: matchDish() dùng vungCo với fallback vung; Miền Nam gồm Tây Nam Bộ; Cả nước giữ nghĩa gốc vung=vn; chip đếm dùng cùng helper. Chế độ state.vungGocOnly lọc gốc.
- Vị trí: vungFromPlace() chuẩn hóa tên có dấu, allowlist tỉnh/thành; vungFromCoords() fallback BBox gần đúng; GPS ưu tiên, IP sau; Photon reverse geocode thêm cho GPS chỉ có tọa độ. state.autoVung chỉ hiện gợi ý và nút xác nhận, không ghi đè vùng tay. Thêm api/reverse-geocode.js + route local.
- SQLite: thêm cột dacSan INTEGER, vungCo TEXT; đồng bộ 248/248 bằng tools/sync-vung-sqlite.mjs. Kiểm tra không NULL; mẫu phở có đủ 5 vùng, cao lầu/Bánh căn chỉ Trung.
- Test đã PASS: node tools/test-vung.mjs http://127.0.0.1:4321 (17 checks); syntax node --check app.js server.js api/_lib.js api/reverse-geocode.js. tools/test-gps.mjs đã thêm test mapper nhưng chưa chạy hết vì test nearby lâu.
- Còn lại: chạy full regression (GPS, old-data, vnonly, layout, clip), kiểm tra api/reverse-geocode production, review diff, commit/push và chờ Vercel success; cập nhật số liệu README nếu dataset thay đổi.
