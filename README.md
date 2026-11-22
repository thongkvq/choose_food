# 🍜 Món Gì Đây? — Gacha chọn món ăn (băng chuyền roulette)

Web **gacha chọn món**: quay băng chuyền chạy ngang kiểu CS:GO case opening, hãm phanh mượt, dừng đúng
tâm, mở popup thông tin món (ảnh thật + giới thiệu Wikipedia + bảng dinh dưỡng ước tính + **quán bán món đó gần bạn**).
Vanilla JS ES module, **không build step, không dependency runtime**.

- 🌐 **Bản chạy thật (Vercel, tĩnh thuần): https://choose-food-paroda.vercel.app**
- 💻 **Chạy trong LAN**: `node server.js` → `http://127.0.0.1:4321` (điện thoại: `http://<IP-LAN>:4321`)
- 🔒 HTTPS tự ký cho LAN (cần khi muốn dùng **GPS thật** trên điện thoại): đặt `certs/key.pem` + `certs/cert.pem` rồi chạy `node server.js` → `https://<IP-LAN>:8443`

> `package.json` **không có mục `scripts`** (cố ý): từng có `"start": "node server.js"` làm Vercel coi repo là Node app
> → mọi path 500. Chạy tay bằng `node server.js`. Đổi cổng: `PORT=4322 node server.js`.

## Tính năng đang có

**Quay & thẻ kết quả** — 4 bậc phẩm cấp (UR 7% / SSR 18% / SR 30% / R 45%, có pity 10 lần), quay 1 món hoặc x10 (lưới lật thẻ), băng chuyền 34 thẻ (phone) / 60 (desktop) với tiếng tick + rung theo nhịp. Popup tự mở: ảnh lớn, điểm/10 + sao, nhận xét, **Giới thiệu (Wikipedia)** + Đọc thêm, **📖 Chi tiết** (nguồn gốc/nguyên liệu/cách làm/biến tấu) — món có `detailSource: "tong-hop"` hiện thêm dòng *"Nội dung tổng hợp, có thể chưa đầy đủ"* — bảng thông tin, "hợp với ai", mẹo, credit ảnh.

**Quay cho nhóm** — nút **👥 Quay nhóm**: nhập 2–8 tên (nhớ danh sách gần nhất trong `mgd.group`), chuyền tay từng người: mỗi người gạch tối đa 0–5 món (mặc định 2) từ 12 món gợi ý theo bộ lọc hiện tại, có ô tìm kiếm và nút bỏ qua lượt. Hết lượt → quay băng chuyền bình thường trên pool **đã trừ món bị gạch**; popup ghi "👥 Cả nhóm: …" + danh sách món bị gạch (thu gọn). Gạch hết pool → báo rõ và cho bỏ gạch từng món.

**Bộ lọc** — bữa ăn · ẩm thực · cách chế biến · vùng miền (Bắc/Trung/Nam/Tây Nam Bộ/Tây Nguyên/Cả nước/Ngoài VN, có chế độ "chỉ đặc sản gốc") · chay · không cay · điểm ≥8.5 · ngân sách · thời gian · tìm kiếm · preset nhanh · "chỉ món Việt" (mặc định BẬT).

**Ngữ cảnh & thói quen** — chip thời tiết thật (Open-Meteo) + bữa theo giờ nhân trọng số (`biasOf`); gu khẩu vị học từ món đã chốt/bỏ qua; **tránh món lặp** (món đã chốt/nhật ký trong 3 ngày ×0.15, món vừa quay ra trong 10 lượt ×0.5); panel **📅 Hôm nay** (thực đơn 3 bữa, tổng kcal/đạm/tiền, gợi ý cân bằng, nhật ký 7 ngày, xuất ảnh canvas 1080×1350).

**Mục tiêu calo / ngân sách** — trong panel 📅 Hôm nay: đặt kcal/ngày, tiền/ngày và/hoặc tiền/tuần (`mgd.goals`, để trống = không dùng), thanh tiến độ "đã dùng / mục tiêu" cộng từ thực đơn + nhật ký hôm nay, và công tắc **🎯 Ưu tiên món vừa mục tiêu** (mặc định BẬT): món vượt phần còn lại bị **×0.4** trọng số trong `drawOne` (vượt cả kcal lẫn tiền ×0.16) — không bị loại khỏi pool; chip bối cảnh ghi rõ lý do + phần còn lại.

**Thành tựu** — 14 thành tựu tính từ dữ liệu đã có (nhật ký, món đã khám phá, yêu thích, vùng của món, thực đơn hôm nay), mỗi cái có tiến độ x/y; hiện trong panel 📅 Hôm nay, toast một lần khi vừa mở khoá (`mgd.achv`), kiểm tra qua `requestIdleCallback` nên không làm chậm lúc quay.

**Quán gần đây** — GPS (khi https) / theo IP / nhập địa chỉ hoặc `lat,lng`; Photon (OSM) lọc quán khớp tên món, người dùng chọn bán kính **2.5 / 5 / 10 / 15km**; khối **⭐ Quán có tiếng** chấm điểm từ dữ liệu mở OSM; mỗi quán có khoảng cách, địa chỉ, **giờ mở cửa** (OSM `opening_hours`: đang mở / sắp đóng / đã đóng / chưa rõ) + công tắc **🟢 Chỉ quán đang mở** (giữ quán chưa rõ giờ), nút **🔖 lưu quán** (`mgd.savedPlaces` ≤120 quán, ghi chú được, hiện lại trong drawer ♥ và trong popup món ở khối "🔖 Quán quen"), lọc **🔖 Chỉ món có quán đã lưu**, nút chỉ đường, và link tìm trên ShopeeFood/GrabFood (chỉ là link tìm kiếm).

**PWA / offline** — `manifest.webmanifest` + `sw.js`: HTML/JS/CSS network-first, `data/*.json` stale-while-revalidate, **ảnh Wikipedia cache-first (tối đa 300 ảnh)**. Đã cài vào màn hình chính thì **quay được cả khi mất mạng** (dữ liệu lite + ảnh đã cache), phần tìm quán báo "📴 Đang offline" kèm link Google Maps.

**Chia sẻ** — nút 🔗 tạo link `#mon=<id>`; mở link là ra thẳng popup món đó.

### Dữ liệu hiện tại (lấy trực tiếp từ `data/dishes.json`)

| Hạng mục | Số liệu |
|---|---|
| Tổng món | **307** (215 món Việt · 92 món quốc tế: cn 19, jp 13, kr 9, fr 10, us 8, th 7, tr 6, mx 6, in 5, it 5) |
| Ảnh thật (có nguồn) | **280/307 (91.2%)** — 124 vi-wiki · 45 en-wiki · 111 Wikimedia Commons; 27 món dùng hình vẽ SVG (thà hình đúng món còn hơn ảnh sai) |
| Giới thiệu Wikipedia (đã dịch sang tiếng Việt) | 273 |
| Facts Wikidata (quốc gia gốc, ẩm thực, nguyên liệu, loại món) | 246 |
| Mục Chi tiết (nguồn gốc/nguyên liệu/cách làm/biến tấu) | **307/307** — 168 mục lấy từ Wikipedia (`detailSource: "wikipedia"`) + 139 mục tự tổng hợp từ dữ liệu của chính món (`"tong-hop"`, popup ghi rõ "Nội dung tổng hợp") |
| Vùng **gốc**: ngoài VN 92 · nam 46 · bắc 48 · cả nước 63 · trung 31 · tây nam bộ 18 · tây nguyên 9 | đặc sản địa phương: 69 |
| Vùng **đang bán**: bắc 163 · trung 166 · nam 169 · tây nam bộ 169 · tây nguyên 155 | |

## Kiến trúc

```
index.html      khung UI (header, băng chuyền, hàng nút, filter sheet, modal, drawer, toast)
styles.css      mobile-first, tap target ≥44px, safe-area, dvh, theme sáng/tối
app.js          gacha + băng chuyền + popup + lọc + yêu thích/nhật ký/thực đơn + PWA + lớp gọi API
art.js          23 template SVG minh hoạ món (khi không có ảnh thật)
lib/nearby-core.js  logic tìm quán DÙNG CHUNG cho app.js và server.js (chuẩn hoá tên, khoảng cách, khớp món, fame score, ghép giờ mở cửa)
lib/opening-hours.js  phân tích OSM opening_hours -> đang mở / sắp đóng / đã đóng / chưa rõ
lib/saved-places.js   quán đã lưu (mgd.savedPlaces): thêm/xoá/ghi chú/gắn món
lib/group-core.js     quay cho nhóm: chuẩn hoá tên 2–8 người, gợi ý 12 món, trừ món bị gạch
lib/goals-core.js     mục tiêu kcal/ngân sách: tiến độ "đã dùng / mục tiêu", hệ số ×0.4 cho món vượt
lib/achievements.js   14 thành tựu + chuỗi ngày, tính thuần từ nhật ký/thực đơn/món đã khám phá
server.js       server LAN: static + gzip + /api/whereami · /api/weather · /api/geocode · /api/reverse-geocode · /api/nearby + HTTPS 8443
sw.js           service worker (cache shell / data / ảnh Wikimedia)
manifest.webmanifest + icons/   PWA
data/           dishes.json (nguồn gốc) + dishes-lite.json + dishes-detail-0..3.json + dishes.sqlite
tools/          pipeline dữ liệu + test + dev (xem tools/README.md)
```

**Hai chế độ chạy, một code base:**

| | LAN (`node server.js`) | Vercel (tĩnh thuần) |
|---|---|---|
| API | 5 route `/api/*` (có cache trong RAM) | **không có** — `/api/*` trả 404, client tự chuyển sang gọi thẳng Photon / Open-Meteo / ipapi.co (đều CORS `*`) |
| GPS | cần mở bằng HTTPS tự ký 8443 | có HTTPS sẵn → GPS chạy ngay |
| Service worker | chỉ bật khi `isSecureContext` (localhost hoặc https) | có |

### Dữ liệu tách 2 tầng (lần tải đầu nhẹ)

`data/dishes.json` là **nguồn gốc** (1119.2KB thô / 260.9KB gzip). Frontend không tải file này:

- `data/dishes-lite.json` — 282.9KB thô / **47.4KB gzip** (307 món, đủ cho băng chuyền, lọc, gacha, phần đầu popup, thực đơn hôm nay).
- `data/dishes-detail-0..3.json` — 721.7KB thô / 200.2KB gzip, **chỉ tải khi mở popup** (giới thiệu, facts, mục chi tiết, review dài, tip); app prefetch lúc rảnh.

⇒ Lần tải đầu giảm **74.7% thô · 81.8% gzip**. `tools/data/data-validate.mjs` so **từng byte** 4+1 file tách với `dishes.json` để không bao giờ lệch.

### Khoá localStorage (`mgd.*`) — bản mới nhất

| Khoá | Nội dung |
|---|---|
| `mgd.favs` · `mgd.hist` · `mgd.seen` · `mgd.recentDraws` | món yêu thích · vừa quay (≤20) · đã khám phá · 10 món vừa quay ra |
| `mgd.diary` · `mgd.menu` · `mgd.taste` · `mgd.pity` | nhật ký ăn (≤400) · thực đơn hôm nay · gu khẩu vị · bảo hiểm SSR |
| `mgd.goals` | `{kcal, money, week, priority}` — mục tiêu calo/ngân sách (0 = không dùng) |
| `mgd.group` | `{names[], vetoMax}` — danh sách tên nhóm gần nhất + số món mỗi người được gạch |
| `mgd.achv` | `{unlocked:{id: ts}}` — thành tựu đã mở khoá (chỉ toast 1 lần) |
| `mgd.openOnly` · `mgd.savedPlaces` · `mgd.savedOnly` | chỉ quán đang mở · quán đã lưu (≤120) · chỉ món có quán đã lưu |
| `mgd.radius` · `mgd.fame` · `mgd.geo` | bán kính tìm quán · cache quán có tiếng 6h · vị trí theo IP 6h |
| `mgd.vnOnly` · `mgd.vungSelection` · `mgd.vungManual` · `mgd.vungGeo` · `mgd.autoVung` · `mgd.vungGocOnly` | lọc vùng miền / chỉ món Việt |
| `mgd.avoidRecent` · `mgd.sound` · `mgd.theme` · `mgd.ctxOn` · `mgd.wx` | tránh món lặp · âm thanh · theme · ưu tiên bối cảnh · thời tiết gần nhất |

Mọi id món đọc từ localStorage hay link `#mon=` đều đi qua `idNow()` (bảng `ID_LEGACY`).

## Chạy trong LAN

```bash
node server.js                 # http://127.0.0.1:4321 + http://<IP-LAN>:4321 (tự in URL)
PORT=4322 node server.js       # khi 4321 đã bị tiến trình khác chiếm
```

GPS thật trên điện thoại cần HTTPS: tạo `certs/key.pem` + `certs/cert.pem` (SAN = IP LAN) rồi mở `https://<IP-LAN>:8443`, bấm "Nâng cao → Tiếp tục".

## Pipeline dữ liệu

Toàn bộ script nằm trong `tools/data/` (chi tiết từng script: [`tools/README.md`](tools/README.md)).

```bash
node tools/data/data-add-dishes.mjs     # gộp món mới từ tools/data/data-new-dishes.json
node tools/data/enrich-vung.mjs         # gán vung / dacSan / vungCo
node tools/data/data-patch-aliases.mjs  # bổ sung tên tra cứu (aliases.json)
node tools/data/data-fetch-images.mjs   # tra ảnh thật: Wikipedia vi → en → Commons, tiêu đề phải khớp tên món
node tools/data/data-enrich-info.mjs    # intro/wikiUrl (Wikipedia) + facts (Wikidata) + mục detail, dịch EN→VI
node tools/data/data-fill-detail.mjs    # mục Chi tiết tự tổng hợp cho món thiếu (detailSource "tong-hop")
node tools/data/data-sync-sqlite.mjs    # dishes.json → data/dishes.sqlite (bảng dishes)
node tools/data/data-split.mjs          # dishes.json → dishes-lite.json + dishes-detail-*.json
node tools/data/data-validate.mjs       # kiểm tra toàn bộ (exit 1 nếu lỗi)
```

### Nguồn ảnh món ăn (đã kiểm chứng, không đoán mò)

| Bước | Cách làm |
|---|---|
| 1 | Mỗi món có danh sách tên tra cứu (tên gốc + alias Việt/Anh) trong `tools/data/aliases.json` |
| 2 | Tra theo lô 50 tiêu đề/request trên Wikipedia (vi → en), lấy `pageimages` |
| 3 | **Chỉ nhận ảnh khi tiêu đề nguồn khớp trọn tên món** (chuẩn hoá bỏ dấu, so token) + danh sách tiêu đề bị cấm |
| 4 | Món chưa có → tra Wikimedia Commons (`filetype:bitmap <tên món>`), vẫn phải khớp tên |
| 5 | Chống trùng: theo dõi ảnh đã dùng, chọn trong nhóm điểm cao bằng `hash(dish.id)`; `data-validate.mjs` báo lỗi nếu có 2 món dùng 1 ảnh |
| 6 | Lưu `image` + `imageVia` (vi-wiki/en-wiki/commons) + `imageSource` (tiêu đề file) và hiện credit trong thẻ kết quả |

URL luôn ép về **thumbnail Wikimedia** (500/960/1280px — Wikimedia chỉ phục vụ các bậc này). Ảnh lỗi/mất mạng thì `<img onerror>` tự chuyển sang hình vẽ SVG, không vỡ khung. Ảnh **không nằm trong repo** (hotlink `upload.wikimedia.org`), nên băng thông deploy chỉ tốn HTML/JS/CSS/JSON.

## Test

```bash
node server.js &                                   # LAN
node tools/dev/probe-static.mjs 4399 &             # bản tĩnh mô phỏng Vercel (không có /api)
node tools/test/test-all.mjs http://127.0.0.1:4322 # chạy TẤT CẢ test với server LAN
node tools/test/test-all.mjs http://127.0.0.1:4399 # chạy TẤT CẢ test với bản tĩnh
node tools/test/test-all.mjs http://127.0.0.1:4322 pwa,split   # chỉ vài file khớp tên
```

`test-all.mjs` chạy **37 file** (34 `test-*.mjs` + `audit-layout` + `audit-desktop` + `verify-desktop-mobile`) và in bảng tổng hợp exit code. Test mới của v26: `test-group` (quay nhóm), `test-goals` (mục tiêu calo/ngân sách), `test-achv` (thành tựu), `test-detailsrc` (nhãn nội dung tổng hợp), `test-legacy-id` (id món cũ → món mới); v25: `test-opening-hours`, `test-saved-places`.
Test nào cần mạng ngoài (Wikimedia, Photon, Overpass, Open-Meteo, ipapi) sẽ **SKIP kèm lý do** khi dịch vụ đó không tới được — không tính là FAIL.

Playwright/chromium được nạp qua `tools/lib/chromium.mjs` (`$PLAYWRIGHT_DIR` → `node_modules` của project → `$DSH_HOME/profiles/web`; `$CHROME_BIN` để ép bản chromium khác). Không script nào hard-code đường dẫn máy.

## Deploy (Vercel)

Bản production: **https://choose-food-paroda.vercel.app** — cấu hình import: Framework **Other**, Build Command **để trống**, Output Directory **để trống**.

```bash
git push origin main        # Vercel bot tự deploy (không cần token/CLI)
```

- `vercel.json`: `builds: [{src:"**/*", use:"@vercel/static"}]` + `routes` (header cho `/sw.js` và `/manifest.webmanifest` bằng `{src, headers, continue:true}`, rồi `{handle:"filesystem"}`).
  **Vercel KHÔNG cho dùng `headers`/`rewrites`/`redirects`/`cleanUrls`/`trailingSlash` cùng `routes`** → deploy bị từ chối; `test-pwa.mjs` kiểm tĩnh điều này.
- `.vercelignore` loại `tools/`, `certs`, `server.js`, `*.md`, `data/dishes.sqlite`, `node_modules`, `.git`.
- Kiểm tra sau deploy: `node tools/test/test-live.mjs https://choose-food-paroda.vercel.app` và `node tools/test/test-vercel-live.mjs`.
- `/api/*` trả 404 trên Vercel là **bình thường** (bản tĩnh, client tự gọi thẳng dịch vụ ngoài).

## Ghi chú kỹ thuật (bug đã gặp, đừng lặp lại)

- **Đừng thêm `scripts` vào `package.json`** — Vercel sẽ build thành Node app và trả 500 toàn site.
- **Đừng đặt `overflow-x:hidden` trên html/body hay `overscroll-behavior-y:none`** — Chrome mobile chặn hẳn vuốt cuộn.
- **Đừng dùng `headers` cùng `routes` trong `vercel.json`** (deploy bị từ chối).
- **Service worker phải tải ảnh bằng `mode:'cors'`** rồi mới cache: bản `no-cors` trả response *opaque* → `blob()` rỗng → cache ảnh trắng và cache-first trả ảnh hỏng mãi (`test-pwa.mjs` kiểm ảnh thật > 0 byte, cả online lẫn offline).
- `&` trong tên món phá XML của SVG → luôn đi qua `esc()`.
- Khớp ảnh bằng substring rất dễ sai ("Lê Văn Miến" chứa "mien") → khớp theo TỪ + danh sách từ cấm.
- Overpass `around:10000` trả 504 → dùng bbox; Photon không hỗ trợ `lang=vi` (400); Nominatim bị chặn → dùng Photon.
- Container không có font hệ thống → mọi chiều cao chữ phải dựa vào `line-height` tường minh khi đo bằng chromium.

## Thao tác trên điện thoại

- Một hàng nút: **[⚙️ Lọc] [🎰 QUAY 1 MÓN] [⚡ x10]** — chỉ quay bằng nút (khung quay đã tắt nhận chạm, không còn vuốt-để-quay).
- Filter sheet dạng bottom sheet, dock tự ẩn khi sheet mở; tap target mọi nút/chip **≥44px**.
- Màn thấp (≤740px) tự chuyển chế độ gọn; bảng thông tin chỉ hiện 4–6 dòng + nút "＋ Xem thêm".
