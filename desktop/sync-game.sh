#!/bin/bash
# 把游戏 (../game) 复制到 app/ —— 只复制运行所需文件 (不含测试/工具/截图)
set -euo pipefail
cd "$(dirname "$0")"
GAME="${GAME_DIR:-../game}"   # 在仓库中使用: GAME_DIR=.. ./sync-game.sh
rm -rf app && mkdir -p app
(cd "$GAME" && tar --exclude='./tests' --exclude='./tools' --exclude='./screenshots' --exclude='*.command' \
   --exclude='__pycache__' --exclude='.git' -cf - index.html css js models vendor assets ASSETS_LICENSES.md) | (cd app && tar -xf -)
echo "app/: $(find app -type f | wc -l) files, $(du -sh app | cut -f1)"
