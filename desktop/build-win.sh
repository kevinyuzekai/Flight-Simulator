#!/bin/bash
# 构建 Windows x64 NSIS 安装包 (在 Linux 上即可构建, 需要 wine 仅用于 NSIS 卸载程序的生成)
set -euo pipefail
cd "$(dirname "$0")"
export WINEDEBUG=-all
./sync-game.sh
rm -rf dist
npx electron-builder --win nsis --x64
ls -la dist
