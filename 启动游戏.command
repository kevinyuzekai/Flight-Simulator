#!/bin/bash
# ==========================================================================
#  天际航线 SkyRoute — 启动脚本 (macOS)
#  双击本文件即可在浏览器中打开模拟器。
#  默认使用本地 HTTP 服务器 (推荐), 若不可用则回退到 file:// 直接打开。
# ==========================================================================

cd "$(dirname "$0")" || exit 1

PORT=8899
URL="http://127.0.0.1:${PORT}/index.html"

echo "=============================================="
echo "  天际航线 SkyRoute"
echo "=============================================="
echo ""

# 找一个可用的 Python
PY=""
for p in python3 /usr/bin/python3 /usr/local/bin/python3 python; do
  if command -v "$p" >/dev/null 2>&1; then PY="$p"; break; fi
done

if [ -n "$PY" ]; then
  echo "正在启动本地服务器 $URL ..."
  # 后台启动服务器
  "$PY" -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
  SERVER_PID=$!

  # 等待服务器就绪
  for i in $(seq 1 30); do
    if curl -s -o /dev/null "http://127.0.0.1:${PORT}/index.html" 2>/dev/null; then
      break
    fi
    sleep 0.2
  done

  echo "服务器已就绪 (PID $SERVER_PID)"
  echo "按 Ctrl+C 结束服务器。"
  echo ""

  # 打开浏览器
  open "$URL"

  # 保持脚本运行, Ctrl+C 时关闭服务器
  trap 'echo ""; echo "正在关闭服务器..."; kill $SERVER_PID 2>/dev/null; exit 0' INT TERM
  wait $SERVER_PID
else
  echo "未找到 Python, 直接以 file:// 方式打开 (功能相同, 只是地址栏不同)"
  open "index.html"
fi
