#!/bin/bash
# =============================================================================
#  天际航线 SkyRoute — 构建 Microsoft Store 用 MSIX 包 (x64, 未签名; 上传商店后由微软签名)
#
#  用法:
#    ./build-msix.sh <IdentityName> <Publisher> <PublisherDisplayName> [Version]
#  例:
#    ./build-msix.sh "12345KevinYu.SkyRoute" "CN=1A2B3C4D-1111-2222-3333-444455556666" "Kevin Yu"
#  三个值都在 Partner Center → 应用 → 产品管理 → 产品标识 (Product identity) 页面:
#    Package/Identity/Name           → IdentityName
#    Package/Identity/Publisher      → Publisher        (以 "CN=" 开头)
#    Package/Properties/PublisherDisplayName → PublisherDisplayName
#  不带参数运行时使用占位值 (只能用于测试, 不能上传商店)。
#  Version 默认 0.3.0.0 (商店要求第 4 段为 0; 每次重新提交必须比上次大)。
#  若在商店保留的名称不是 "天际航线 SkyRoute", 用环境变量指定: DISPLAY_NAME="天际航线" ./build-msix.sh ...
#
#  打包工具: tools/makemsix (微软开源 msix-packaging 在 Linux 上编译的 makemsix, 带 pack 功能, MIT 许可)
#  会先调用 electron-builder 生成 dist/win-unpacked (若不存在或加 REBUILD=1)。
#  在 Windows 上也可以改用 Windows SDK 的 makeappx.exe: makeappx pack /d build-msix\layout /p SkyRoute.msix
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")"

IDENTITY_NAME="${1:-SkyRoute.Placeholder}"
PUBLISHER="${2:-CN=00000000-0000-0000-0000-000000000000}"
PUBLISHER_DISPLAY_NAME="${3:-PLACEHOLDER Publisher}"
VERSION="${4:-0.3.0.0}"
# 商店要求清单中的 DisplayName 必须与 Partner Center 中保留的应用名称之一完全一致
DISPLAY_NAME="${DISPLAY_NAME:-天际航线 SkyRoute}"
OUT_DIR="${OUT_DIR:-../msix}"
MAKEMSIX="tools/makemsix"
export LD_LIBRARY_PATH="$PWD/tools${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"

[[ "$PUBLISHER" == CN=* ]] || { echo "错误: Publisher 必须以 CN= 开头 (例: CN=1A2B3C4D-....)"; exit 1; }
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.0$ ]] || { echo "错误: Version 必须形如 1.2.3.0 (第 4 段为 0)"; exit 1; }
if [[ "$IDENTITY_NAME" == "SkyRoute.Placeholder" ]]; then
  echo "警告: 使用占位 Identity —— 生成的包不能上传商店, 请用 Partner Center 中的真实值重新运行。"
fi

if [[ ! -d dist/win-unpacked || "${REBUILD:-0}" == "1" ]]; then
  ./sync-game.sh
  npx electron-builder --win dir --x64
fi

LAYOUT="build-msix/layout"
rm -rf build-msix && mkdir -p "$LAYOUT/assets"
cp -a dist/win-unpacked/. "$LAYOUT/"
mv "$LAYOUT/天际航线.exe" "$LAYOUT/SkyRoute.exe"
# 只放基础文件名的图片 (没有 resources.pri 时 Windows 直接使用这些文件)
for f in StoreLogo Square44x44Logo Square71x71Logo Square150x150Logo Square310x310Logo Wide310x150Logo SplashScreen; do
  cp "build/appx/$f.png" "$LAYOUT/assets/$f.png"
done

xml_escape() { printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' -e 's/"/\&quot;/g'; }
IN="$(xml_escape "$IDENTITY_NAME")" PU="$(xml_escape "$PUBLISHER")" PD="$(xml_escape "$PUBLISHER_DISPLAY_NAME")" VE="$VERSION" DN="$(xml_escape "$DISPLAY_NAME")" \
  node -e '
    const fs=require("fs"); let t=fs.readFileSync("AppxManifest.template.xml","utf8");
    t=t.replace("@IDENTITY_NAME@",process.env.IN).replace("@PUBLISHER@",process.env.PU)
       .replace("@PUBLISHER_DISPLAY_NAME@",process.env.PD).replace("@VERSION@",process.env.VE)
       .split("@DISPLAY_NAME@").join(process.env.DN);
    fs.writeFileSync(process.argv[1],t);' "$LAYOUT/AppxManifest.xml"

mkdir -p "$OUT_DIR"
SAFE_NAME="$(printf '%s' "$IDENTITY_NAME" | tr -c 'A-Za-z0-9._-' '_')"
PKG="$OUT_DIR/SkyRoute_${VERSION}_x64_${SAFE_NAME}.msix"
rm -f "$PKG"
"$MAKEMSIX" pack -d "$LAYOUT" -p "$PKG"
ls -la "$PKG"
sha256sum "$PKG" | tee "$PKG.sha256"
echo "完成: $PKG"
