#!/usr/bin/env bash
# 一键重新部署到生产服务器
set -euo pipefail

# 服务器地址不写死在仓库里，部署时通过环境变量传入
HOST="${HOST:?请指定服务器，例如：HOST=root@1.2.3.4 ./deploy.sh}"
DEST="${DEST:-/var/www/tx-decoder}"

echo "==> 1/3 构建"
npm run build

echo "==> 2/3 上传 dist"
rsync -az --delete -e "ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null" \
  dist/ "$HOST:$DEST/"

echo "==> 3/3 验证"
CODE=$(curl -s -o /dev/null -m 10 -w '%{http_code}' http://149.28.133.245:8090/ 2>/dev/null)
if [ "$CODE" = "200" ]; then
  echo "✅ 部署成功：http://149.28.133.245:8090/"
else
  echo "❌ 验证失败（HTTP $CODE），请检查 nginx"
  exit 1
fi
