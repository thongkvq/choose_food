#!/usr/bin/env bash
# deploy.sh — đẩy web lên Vercel. Cần token: https://vercel.com/account/tokens
# Dùng:  VERCEL_TOKEN=xxxx ./deploy.sh            (deploy bản production)
#        VERCEL_TOKEN=xxxx ./deploy.sh preview    (deploy bản xem trước)
set -euo pipefail
cd "$(dirname "$0")"

VC="./node_modules/.bin/vercel"
[ -x "$VC" ] || { echo "Thiếu Vercel CLI — chạy: npm i vercel --no-audit --no-fund"; exit 1; }

if [ -z "${VERCEL_TOKEN:-}" ]; then
  echo "Chưa có VERCEL_TOKEN."
  echo "1) Vào https://vercel.com/account/tokens -> Create Token (scope: cá nhân hoặc team)"
  echo "2) Chạy lại:  VERCEL_TOKEN=xxxx ./deploy.sh"
  exit 1
fi

MODE="${1:-prod}"
echo "== Kiểm tra token =="
"$VC" whoami --token "$VERCEL_TOKEN"

echo "== Liên kết project mon-gi-day =="
"$VC" link --yes --project mon-gi-day --token "$VERCEL_TOKEN" || true

echo "== Kiểm tra cấu hình trước khi đẩy =="
"$VC" build --token "$VERCEL_TOKEN" || echo "(bỏ qua bước build cục bộ nếu CLI không hỗ trợ)"

if [ "$MODE" = "preview" ]; then
  echo "== Deploy bản xem trước =="
  "$VC" deploy --yes --token "$VERCEL_TOKEN"
else
  echo "== Deploy PRODUCTION =="
  "$VC" deploy --prod --yes --token "$VERCEL_TOKEN"
fi
