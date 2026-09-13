# 🍜 Món Gì Đây? — Gacha Roulette Băng Chuyền Chọn Món Ăn

Web quay gacha theo phong cách **băng chuyền roulette chạy ngang (CS:GO / Casino Case Opening)** với hiệu ứng giảm tốc mượt mà, dừng trúng đích tại vạch trung tâm, âm thanh cơ học tick tick chân thực, pháo hoa rực rỡ và thẻ bài SSR/UR ấn tượng.

## 🚀 Truy cập & Sử dụng

### 1. Link truy cập trực tiếp:
- **Từ máy chủ / máy này:** [http://127.0.0.1:4321](http://127.0.0.1:4321)
- **Từ điện thoại / thiết bị trong mạng LAN:** [http://192.168.100.13:4321](http://192.168.100.13:4321)

*(Chạy lệnh: `npm start` hoặc `node server.js`)*

---

## ✨ Điểm Cải Tiến & Tính Năng Mới (v2.0)

1. **Băng chuyền Roulette Ngang (Horizontal Conveyor Reel)**:
   - Thay thế máy quay tĩnh bằng dải băng chuyền trượt ngang 60 thẻ bài liên tục.
   - **Vật lý giảm tốc (Deceleration Physics)**: Xe chạy nhanh rồi từ từ hãm phanh mượt mà bằng đường cong `easeOutQuart`.
   - **Kim chỉ trung tâm & Vạch laser neon**: Căn chuẩn xác thẻ bài trúng thưởng ngay giữa màn hình.
   - **Âm thanh cơ học (Reel Ticks)**: Mỗi khi một thẻ trượt qua vạch đỏ, âm thanh lách cách vang lên với tần số chậm dần cực kỳ chân thực.
   - **Hiệu ứng trúng thưởng**: Thẻ chiến thắng bừng sáng (`.is-winner`), phóng to, rung nhẹ và bung toé pháo hoa giấy (confetti)!

2. **Giao diện Cyber Gastronomy Đẳng Cấp**:
   - Tông màu đen huyền bí neon kết hợp ánh sáng đèn lồng ấm cúng (`#090711` velvet, cam ớt neon, vàng hoàng kim, xanh mint).
   - Nút bấm arcade 3D nổi bật: **QUAY 1 MÓN 🎰**, **QUAY 10 MÓN ⚡**, **THỬ VẬN MAY 🍀**.
   - Bảng gợi ý nhanh theo hoàn cảnh: *Bữa trưa văn phòng, Cú đêm đói bụng, Ăn vặt đường phố, Ăn chay thanh đạm, Món nước ấm áp...*

3. **Quay 10 Món Cùng Lúc (Multi-Summon SSR Grid)**:
   - Băng chuyền lướt nhanh rồi mở ra giao diện mở 10 thẻ bài lật mặt cực kỳ đã mắt.
   - Sắp xếp thứ tự theo phẩm cấp từ cao xuống thấp. Có nút **"Chốt đại 1 món"**.

4. **Hệ Thống Phẩm Cấp & Bảo Hiểm (Pity SSR)**:
   - **Huyền Thoại (UR)**: 7% (Viền vàng rực lửa, hiệu ứng cực hiếm)
   - **Đặc Sắc (SSR)**: 18% (Viền tím pha lê neon)
   - **Ngon (SR)**: 30% (Viền xanh mint)
   - **Phổ Thông (R)**: 45% (Viền bạc thanh lịch)
   - **Pity 10 lần**: Cứ mỗi 10 lần quay chắc chắn ra ít nhất 1 món SSR hoặc UR!

5. **248 Món Ăn Phong Phú & Minh Hoạ SVG Độc Bản**:
   - Toàn bộ món ăn Việt Nam, Trung Hoa, Nhật Bản, Hàn Quốc, Thái Lan, Ý, Pháp, Mỹ, Mexico, Ấn Độ, Trung Đông.
   - 23 khuôn mẫu vẽ SVG (bát phở, đĩa cơm, xiên nướng, bánh mì, lẩu khói nghi ngút, bánh xèo, sushi, pizza, dimsum...).
## 📷 Nguồn ảnh món ăn (đã kiểm chứng)

Ảnh món ăn **không phải ảnh đoán mò** — mỗi ảnh đều được tra và đối chiếu tên:

| Bước | Cách làm |
|---|---|
| 1 | Mỗi món có danh sách tên tra cứu (tên gốc + alias Việt/Anh) trong `tools/aliases.json` |
| 2 | Tra theo **lô 50 tiêu đề/request** trên Wikipedia (vi → en): `action=query&titles=...&prop=pageimages&pithumbsize=900` |
| 3 | Chỉ nhận ảnh khi **tiêu đề nguồn khớp tên món** (chuẩn hoá bỏ dấu, so token, ngưỡng ≥ 0.6) |
| 4 | Món chưa có → tra Wikimedia Commons (`filetype:bitmap <tên món>`), vẫn phải khớp tên |
| 5 | Chống trùng: theo dõi ảnh đã dùng, chọn trong nhóm điểm cao nhất bằng hash(dish.id); chạy thêm vòng dedup |
| 6 | Mỗi món lưu `image`, `imageVia` (vi-wiki/en-wiki/commons), `imageSource` (tiêu đề nguồn) và hiển thị credit trong thẻ kết quả |

**Kết quả hiện tại:** 235/248 món có ảnh thật có nguồn xác thực (101 Wikipedia tiếng Việt · 45 Wikipedia tiếng Anh · 89 Wikimedia Commons), **0 nhóm ảnh trùng**; 13 món không tìm được ảnh đúng thì dùng hình vẽ SVG (thà hình vẽ đúng món còn hơn ảnh sai).

### Công cụ kiểm chứng
```bash
node tools/fetch-images.mjs     # tra & gán ảnh theo lô (có backoff 429)
node tools/dedup-images.mjs     # tách ảnh trùng, mỗi món một ảnh riêng
node tools/audit-images.mjs     # đối chiếu tên nguồn với tên món + alias
node tools/verify-images.mjs    # kiểm tra URL sống, content-type ảnh, độ trùng
node tools/fix-images.mjs       # sửa ảnh sai theo bộ từ khoá bắt buộc/cấm
node tools/strip-wrong-images.mjs # bỏ hẳn ảnh sai -> app dùng SVG art
node tools/normalize-image-urls.mjs # ép URL về thumbnail 960px, bỏ tham số tracking
```

Ảnh lỗi/mất mạng luôn tự động fallback về hình vẽ SVG (`onerror`), không vỡ khung.
> **Lưu ý về thumbnail:** Wikimedia chỉ phục vụ các bậc ảnh cố định (320/500/640/800/960/1280). App dùng `thumb(url, w)` chọn bậc nhỏ nhất đủ lớn — thẻ băng chuyền dùng 500px, thẻ kết quả dùng 960px.
## 📱 Tối ưu cho điện thoại (v4 — mobile-first)

Web được thiết kế **chỉ cho mobile**, không phải bản desktop thu nhỏ:

| Hạng mục | Cách làm |
|---|---|
| **Dock hành động** | Thanh cố định dưới đáy, nút **QUAY 1 MÓN** to 56px nằm đúng vùng ngón cái; nút ⚙️ Lọc hiện số filter đang bật |
| **Bộ lọc** | Bottom sheet trượt lên (max-height 88dvh), có backdrop, khoá scroll nền, nút **Xong (n món)** |
| **Vùng an toàn** | `env(safe-area-inset-*)` cho tai thỏ / home bar; `viewport-fit=cover` |
| **Đơn vị chiều cao** | `dvh` thay `vh` — không bị thanh URL của iOS cắt mất nội dung |
| **Tap target** | Nút ≥56px, chip 42px, không dùng hiệu ứng chỉ có hover (`@media (hover:hover)`) |
| **Chống zoom lỗi** | `touch-action:manipulation`, chặn double-tap zoom, input `font-size:16px` để iOS không tự phóng |
| **Phản hồi rung** | `navigator.vibrate` — rung nhẹ mỗi thẻ lướt qua, rung mạnh khi trúng UR/SSR |
| **Âm thanh** | Mở khoá `AudioContext` ngay lần chạm đầu (đúng luật iOS/Chrome) |
| **Vuốt để quay** | Vuốt lên trên băng chuyền cũng quay, không cần với tay xuống dock |
| **Hiệu năng** | DPR chặn ở 2, confetti giảm 50% khi màn <700px, băng chuyền 34 thẻ ở phone (60 ở desktop), ảnh `loading=lazy` + width/height chống nhảy layout |
| **Nằm ngang** | `orientation:landscape` + max-height nhỏ → thu gọn băng chuyền, ẩn presets để vẫn thấy nút quay |
| **Dung lượng** | gzip ở server: lần tải đầu **238KB → 59KB** (index 2.9KB + app.js 11.4KB + css 8.2KB + data 37KB) |

Ảnh món ăn dùng bậc thumbnail **500px** cho thẻ băng chuyền và **960px** cho thẻ kết quả (Wikimedia chỉ phục vụ các bậc cố định — xem mục nguồn ảnh).

### Thẻ kết quả (sau khi quay)
- **Popup tự hiện** sau khi băng chuyền dừng, hiển thị thông tin món vừa quay trúng: ảnh lớn 230px, **điểm 7.1–9.8 + sao**, nhận xét, bảng thông tin, "hợp với ai", mẹo ăn, credit ảnh. **ảnh lớn 230px**, **điểm 7.1–9.8 + sao**, nhận xét, bảng 6 dòng thông tin, "hợp với ai", mẹo ăn, credit ảnh.
- **Màn thấp (≤740px)** tự chuyển chế độ gọn (ảnh 150–170px, hàng thông tin thắt lại) để **thấy hết thông tin mà không phải cuộn bên trong** — đã đo trên 360×640, 375×667, 390×844, 458×1017.
- Bấm **CHỐT MÓN NÀY** → thẻ **không đóng**, hiện ribbon "✓ Đã chốt", nút đổi thành "ĐÃ CHỐT"; thông tin món vẫn hiển thị để đọc lại. Nút ✕ luôn bấm được.

## Deploy lên Vercel
Web **nhẹ**: toàn bộ phần client chỉ **966 KB thô → 234 KB gzip** (nặng nhất là `data/dishes.json` 851 KB → 201 KB gzip); **ảnh không nằm trong repo** mà hotlink từ Wikipedia/Wikimedia (235 ảnh), nên băng thông Vercel chỉ tốn phần HTML/JS/CSS/JSON.

Đã chuẩn bị sẵn:
- `api/whereami.js`, `api/weather.js`, `api/geocode.js`, `api/nearby.js` — Vercel Serverless Function (Node runtime), dùng chung `api/_lib.js`.
- `vercel.json` — `maxDuration` cho từng hàm (nearby 30s, whereami 20s, weather/geocode 15s) + cache header cho `data/dishes.json` (1 giờ) và no-store cho html/js/css.
- `.vercelignore` + `.gitignore` — loại `node_modules` (96 MB, không dùng lúc chạy), `tools/screenshots`, `certs`, memory.

Deploy:
    cd '/var/lib/dsh/Choose foody'
    git init && git add -A && git commit -m "Mon Gi Day"
    npx vercel          # đăng nhập, chọn project; lần đầu nên dùng 'npx vercel --prod'

Khác biệt so với chạy LAN:
| | LAN (server.js) | Vercel |
|---|---|---|
| HTTPS | tự ký ở cổng 8443 | có sẵn ⇒ **GPS chạy ngay**, không cần bấm "Tiếp tục" |
| Cache | Map trong RAM, giữ mãi | RAM theo từng instance + `s-maxage` ở CDN |
| Overpass (quán gần nhất) | gọi được | chờ tối đa 3.5s rồi bỏ qua; kết quả chính vẫn là Photon |
| Ảnh món | tải trực tiếp từ Wikipedia | như trên |

### 🌦️ Ưu tiên theo thời tiết & giờ (bật/tắt được)
Chip ngay dưới nút quay hiện **thời tiết thật** (Open-Meteo, không cần API key) + bữa hiện tại, ví dụ *"🌧️ 25°C mưa nhẹ · trời mưa → ưu tiên món nước · đang bữa trưa"*. Bấm chip để **tắt/bật** ưu tiên.
Đo thực tế trong 4000 lần quay:

| Bối cảnh | Thay đổi tỉ lệ |
|---|---|
| Không ưu tiên | món nước 14.8% · nướng 15.6% · ngọt 9.0% |
| **Trời mưa** | món nước **30.7%** (gấp đôi), nướng còn 10.2% |
| **Nóng ≥32°** | đồ uống 5.1% → 8.1%, ngọt 9.0% → 10.2%, lẩu 2.9% → 1.7% |
| **Lạnh ≤22°** | món nước 19.1%, ngọt 9.0% → 3.2% |

Giờ trong ngày cũng nhân 1.8× cho bữa tương ứng (6h → sáng, 11h → trưa, 15h → xế/ăn vặt, 19h → tối, 23h → khuya).

### 📅 Panel "Hôm nay": thực đơn · gu · nhật ký
Nút **📅 Hôm nay** (có badge số món đã ghi trong ngày) mở panel:
- **Thực đơn 3 bữa** (sáng/trưa/tối): mỗi bữa bấm **"🎰 Quay cho bữa này"** là quay và tự điền vào ô đó; có nút quay lại / bỏ.
- **Tổng trong ngày**: kcal · đạm · tiền (ước tính).
- **Cân bằng**: cảnh báo trùng nền ẩm thực, thiếu rau/gỏi, toàn món khô, calo quá cao/thấp, tốn tiền.
- **🧠 Gu của mày**: học từ món đã **chốt** (+1) và **bỏ qua** (nút "Quay lại", −1) → cộng trọng số kiểu món/nền ẩm thực/độ cay vào tỉ lệ quay (giới hạn ±35–60% để không thành một màu).
- **📖 Nhật ký 7 ngày**: món đã ăn kèm bữa.
- **📤 Xuất ảnh thực đơn**: vẽ canvas 1080×1350 → chia sẻ qua Zalo/Messenger hoặc tải PNG. Trong popup kết quả cũng có **📤 Chia sẻ ảnh** cho từng món.

### 🌐 Dịch nội dung tiếng Anh sang tiếng Việt
Các món chỉ có bài Wikipedia tiếng Anh được **dịch sang tiếng Việt** (71 giới thiệu, 99 nhãn nguyên liệu/loại món) qua Google translate endpoint + MyMemory dự phòng, có cache để không dịch lại. Bản gốc tiếng Anh vẫn giữ trong `introEn`/`bodyEn` để đối chiếu. Sau dịch: **234/234 giới thiệu đều là tiếng Việt** (nguồn hiển thị là "Wikipedia tiếng Việt" hoặc "Wikipedia tiếng Anh (đã dịch)"). Công cụ: `tools/translate-vi.mjs`.

### 📍 Vị trí thiết bị & tìm quán quanh đó
| Cách lấy vị trí | Khi nào dùng |
|---|---|
| **GPS của thiết bị** | Khi mở bằng **https://192.168.100.13:8443** (trình duyệt chỉ cho lấy GPS trên https/localhost). Server chạy HTTPS tự ký — bấm "Nâng cao" → "Tiếp tục truy cập". |
| **Theo IP** | Tự động khi mở bằng http (LAN) — sai số cấp thành phố |
| **Nhập tay** | Gõ **địa chỉ** (geocode qua Photon) hoặc **lat,lng** vào ô trong popup |

Popup luôn hiện **toạ độ đang dùng** + nguồn (GPS ±m / theo IP / bạn nhập) để bạn biết kết quả dựa trên đâu.

### 🍜 Quán bán món đó gần bạn
Trong popup có nút **📍 Tìm quán bán món này gần tôi**:
- Vị trí: thử **GPS** trước (chỉ chạy khi https/localhost); qua LAN **http** thì tự lấy **vị trí theo IP** (server gọi ip-api.com) — không cần xin quyền.
- Tìm quán bằng **Photon (OpenStreetMap)**: lọc theo **tên quán khớp tên món** (vd "Phở Nguyên", "Cơm Tấm Tú Mập"), tự mở rộng bán kính 2.5km → 5km → 10km, chỉ nhận địa điểm ăn uống.
- Kết quả: tên quán · khoảng cách · loại · địa chỉ · nút **chỉ đường Google Maps** cho từng quán.
- Luôn kèm nút **🗺️ Xem thêm trên Google Maps** (Google có dữ liệu quán đầy đủ hơn OSM).
- Song song, server cache toàn bộ quán trong 3km (Overpass) để đưa thêm danh sách "quán cùng ẩm thực / gần nhất"; Overpass lỗi thì bỏ qua, không chặn kết quả.

API: `/api/whereami` (vị trí theo IP + hâm nóng khu vực) và `/api/nearby?lat&lng&r&q&kw&cuisine`.

### Chi tiết món (mục lấy từ bài Wikipedia)
Ngoài đoạn giới thiệu, mỗi món còn có nút **📖 Chi tiết** chứa các mục thật từ bài viết: **Nguồn gốc / Lịch sử · Nguyên liệu · Cách chế biến / Trình bày · Biến tấu**. Hiện có **131/248 món** có mục chi tiết (món không có bài thì ẩn nút).

### Thông tin chi tiết thu thập từ Wikipedia + Wikidata
Mỗi món được tra **dữ liệu thật** (không phải văn mẫu):
- **Giới thiệu** (đoạn mở đầu bài Wikipedia tiếng Việt/Anh) — **234/248 món**, có nút "Đọc thêm" + link bài gốc.
- **Wikidata**: quốc gia gốc (145 món), nền ẩm thực, **nguyên liệu chính** (165 món), loại món.
- Dữ liệu nhiễu đã được dọn: bỏ nhãn meta ("món ăn", "thực phẩm", "baked good"…), dịch nhãn tiếng Anh sang tiếng Việt (baker's yeast → men nở, chicken egg → trứng gà…).

Công cụ: `tools/enrich-wiki.mjs` (tra theo lô 20 tiêu đề/request, Wikidata 50 id/request, có backoff 429) và `tools/enrich-wiki2.mjs` (vá món thiếu + dọn nhãn). Tổng chỉ ~40 request cho 248 món.

### Thông tin & đánh giá từng món
Mỗi món có: **điểm 7.1–9.8 kèm sao**, **nhận xét riêng** (48 món tiêu biểu viết tay, còn lại soạn theo vùng ẩm thực + cách chế biến), **năng lượng & đạm (ước tính/phần)**, **độ no 1–5**, **giá tham khảo**, **xuất xứ**, **thời điểm ngon nhất**, **hợp với ai**, **mẹo ăn**. Điểm số tính theo độ "biểu tượng" + độ công phu, **không** theo độ hiếm gacha (phở bò 9.4 dù là món phổ thông). Có preset lọc **⭐ Điểm cao (≥8.5)** và công tắc trong bộ lọc.
Dữ liệu tạo bằng `tools/enrich-dishes.mjs` (chạy lại được, ghi thẳng vào `data/dishes.json` + SQLite).

### 🗺️ Lọc theo vùng miền (mới)
Mỗi món Việt có thêm trường **vung** — vùng miền gốc/đặc trưng — và bộ lọc có nhóm **🗺️ Vùng miền** (bấm được nhiều vùng một lúc):

| Chip | Ý nghĩa | Số món |
|---|---|---|
| 🏯 Miền Bắc | phở, bún chả, bánh cuốn, chả cá Lã Vọng… | 38 |
| 🌾 Miền Trung | bún bò Huế, mì Quảng, cao lầu, bánh bèo… | 17 |
| 🏙️ Miền Nam | cơm tấm, hủ tiếu, bánh xèo, bánh khọt… (**gồm cả miền Tây Nam Bộ**) | 38 + 4 |
| 🛶 Miền Tây Nam Bộ | bún mắm, lẩu cá kèo, bánh canh cua, bánh tét | 4 |
| ☕ Tây Nguyên | bánh tráng nướng Đà Lạt | 1 |
| 🇻🇳 Cả nước | món phổ biến khắp nơi (đồ uống, món cơm nhà, ăn vặt) | 62 |
| 🌍 Ngoài Việt Nam | 88 món quốc tế (bấm vào sẽ tự tắt chế độ "chỉ món Việt") | 88 |

- Chọn **Miền Nam** thì **bao gồm luôn miền Tây Nam Bộ** (bảng `VUNG_INCLUDE` trong `app.js`) — đúng địa lý, không sót món.
- 3 preset nhanh ở trang chính: **🏯 Món miền Bắc**, **🌾 Món miền Trung**, **🛶 Đặc sản miền Tây**.
- Popup kết quả có thêm dòng **🗺️ Vùng miền** (dòng **📍 Xuất xứ** giữ nguyên mô tả chi tiết như "Sài Gòn", "Hội An").
- Dữ liệu phân vùng do `tools/enrich-vung.mjs` gán (chạy lại được, ghi vào `data/dishes.json` + cột `vung` trong bảng SQLite `dishes`).
- **Không bao giờ kẹt "0 món → không quay được"**: app tự chọn bữa theo giờ, nên khi vùng bạn chọn không có món cho bữa đó thì app **tự bỏ lọc bữa ăn** và báo rõ (`ensurePlayable()`); nếu vẫn 0 món (do bạn tự chọn bữa / chọn nhiều vùng) thì hiện cảnh báo + **tự mở sheet lọc**, và chip vùng hiện **số món khớp** (vùng 0 món bị làm mờ, gạch chấm) để thấy ngay vùng nào có gì.
- Test: `node tools/test-vung.mjs [baseUrl]` — 16/16 PASS (đếm đúng từng vùng, Nam gồm Tây Nam Bộ, chọn nhiều vùng, chip ngoại tắt vnOnly, preset, popup, 0 lỗi JS).

### Thao tác trên điện thoại
- **Một hàng nút duy nhất** ngay dưới băng chuyền: **[⚙️ Lọc] [🎰 QUAY 1 MÓN] [⚡ x10]** — chỉ có MỘT nút quay, không trùng lặp, không thanh nổi che nội dung.
- **Chạm vào khung quay KHÔNG quay** (khung đã tắt nhận chạm) — chỉ quay bằng nút. Không còn thao tác vuốt.
- ⚠️ **Đừng đặt `overflow-x:hidden` trên html/body hay `overscroll-behavior-y:none` trên body** — Chrome mobile sẽ **chặn hẳn vuốt cuộn**. Đây từng là lỗi thật của app (xem `tools/diag-scroll2.mjs` để bisect).

- **Chạm vào bất kỳ đâu trên băng chuyền** là quay (kể cả chạm vào thẻ món) — không cần chạm đúng nút.
- Nút **🎰 QUAY 1 MÓN** to ở dock dưới màn hình; nút **CHỐT MÓN** trong thẻ kết quả luôn dính đáy, không bị cuộn mất.
- Kéo để cuộn trang **không** làm quay nhầm (phân biệt chạm <14px và kéo).
- Bộ lọc mở dạng bottom sheet, **dock tự ẩn** khi sheet mở để không chồng lên nút "Xong".

### Bố cục trang (mobile)
Băng chuyền → **Vừa quay** → **Đã lưu** → **Tỉ lệ phẩm chất** → **Mẹo dùng nhanh** → **Nguồn ảnh + Thử vận may** → dock cố định dưới đáy.
Không còn khoảng trống lớn giữa màn hình; đo bằng chromium thật ở 375×667 / 390×844 / 458×1017: khoảng trống giữa các khối < 30px, không tràn ngang, nội dung khớp chiều cao màn.

### Test mobile
```bash
cd /tmp/domtest && node test_mobile.mjs   # jsdom, viewport 390x844, matchMedia hover:none
```