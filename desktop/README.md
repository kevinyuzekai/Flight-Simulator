# 天际航线 SkyRoute —— Windows 桌面版 / MSIX 构建

Electron 外壳，把仓库根目录的网页游戏打包进 `app/`，通过自定义协议 `app://skyroute/` 加载（联网地景的 CORS、localStorage、Gamepad API 均可用）。

| 命令 | 作用 |
|---|---|
| `npm install` | 安装 electron 33 / electron-builder 25 / resedit |
| `npm start` | 本地运行（先执行 `GAME_DIR=.. ./sync-game.sh`）|
| `GAME_DIR=.. ./build-win.sh` | 生成 NSIS x64 安装包 `dist/SkyRoute-Setup-beta_v0.3.1-x64.exe`（Linux 上需要 wine）|
| `./build-msix.sh <IdentityName> <Publisher> <PublisherDisplayName> [Version]` | 生成 Microsoft Store 用 MSIX（x64，未签名，商店会签名）|

- `build-msix.sh` 使用 `tools/makemsix`（微软开源 [msix-packaging](https://github.com/microsoft/msix-packaging)，Linux 下 `./makelinux.sh --pack` 编译，
  需把 `makemsix` 和 `libmsix.so` 放到 `tools/`）；在 Windows 上也可用 SDK 的 `makeappx pack /d build-msix\layout /p SkyRoute.msix`。
- 三个身份值在 Partner Center → 产品管理 → 产品标识（Product identity）。清单模板见 `AppxManifest.template.xml`，磁贴图片在 `build/appx/`。
- 安装包与 MSIX 均未做代码签名（SmartScreen 可能提示）。
