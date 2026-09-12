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

## 13. Việc còn lại / bước kế tiếp
- 14 món chưa có bài Wikipedia (com-nieu, mien-cua, pho-tron, hu-tieu-kho, bo-ne, chao-dau-xanh…) — hiện chỉ có điểm + ước tính.
- 13 món dùng hình vẽ SVG thay ảnh (không tìm được ảnh đúng trên Commons).
- Có thể thêm: lưu "thực đơn hôm nay" 3 bữa, chia sẻ ảnh kết quả, lọc theo quán đã lưu, cache ảnh offline (SW không chạy được trên http LAN).
- Muốn GPS thật trên điện thoại: mở **https://192.168.100.13:8443** và bỏ qua cảnh báo chứng chỉ.
