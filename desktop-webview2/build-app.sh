#!/bin/bash
# 生成 WebView2 外壳内嵌的游戏文件 app/ —— 只做无损处理:
#  1) 同 desktop/sync-game.sh 的文件集合; 2) 删除桌面版用不到的品牌图 (PWA/商店素材);
#  3) A320ceo 槽位与 A320neo 是逐字节相同的模型 → ac_a320ceo.js 改为运行时深拷贝 A320neo (几何完全相同);
#  4) terser 只去注释和空白 (不改写代码、不改名; 模型数据字符串原样); 5) oxipng 无损重压 PNG。
set -euo pipefail
cd "$(dirname "$0")"
GAME="${GAME_DIR:-..}"
TERSER=/workspace/flight-simulator/tools/min/node_modules/.bin/terser
rm -rf app && mkdir -p app
(cd "$GAME" && tar --exclude='./tests' --exclude='./tools' --exclude='./screenshots' --exclude='*.command' \
   --exclude='__pycache__' --exclude='.git' -cf - index.html css js models vendor assets ASSETS_LICENSES.md) | (cd app && tar -xf -)
B=app/assets/brand
rm -rf $B/msix $B/favicon-16.png $B/skyroute_app_icon.ico $B/skyroute_app_icon_1024.png $B/skyroute_app_icon_512.png \
  $B/skyroute_app_icon_120.png $B/skyroute_app_icon_48.png $B/skyroute_icon_transparent.png $B/skyroute_icon_white.png $B/skyroute_logo.png
python3 - <<'PY'
import json
# 0.6.0: ac_a320ceo.js 已在源码中改为别名 (共享 A320neo 几何)
# manifest 仅用于网页 PWA, 其图标已删
m='app/assets/brand/manifest.webmanifest'; j=json.load(open(m)); j['icons']=[i for i in j.get('icons',[]) if '512' not in i['src'] and '1024' not in i['src']]; open(m,'w').write(json.dumps(j,ensure_ascii=False))
PY
find app -name '*.js' ! -name '*.min.js' -print0 | while IFS= read -r -d '' f; do
  "$TERSER" "$f" --ecma 2017 --comments false --no-module -o "$f.tmp" && mv "$f.tmp" "$f"
done
find app -name '*.png' -print0 | xargs -0 -P8 -n4 ~/.cargo/bin/oxipng -q -o max --strip safe
echo "app/: $(find app -type f | wc -l) files, $(du -sb app | cut -f1) bytes"
