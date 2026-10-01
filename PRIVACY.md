# 天际航线 SkyRoute 隐私政策 / Privacy Policy

生效日期：2026 年 10 月 1 日

天际航线 SkyRoute（以下简称“本应用”，包括网页版、Windows 安装版与 Microsoft Store 版）由个人开发者 kevinyuzekai 开发。
我们重视你的隐私，本政策说明本应用如何处理信息。

## 1. 我们不收集个人信息

- 本应用**没有账号系统**，不要求注册或登录。
- 本应用**不收集、不存储、不上传**任何个人信息（姓名、邮箱、电话、通讯录、精确位置、照片等），也不包含广告、统计分析或崩溃上报 SDK。
- 本应用没有自己的服务器，开发者无法看到你的任何使用数据。

## 2. 保存在你设备上的数据

游戏设置（例如所选机型、涂装、联网地景开关、键位与摇杆映射）只保存在你设备本地的浏览器存储（localStorage）中，
不会发送给开发者或任何第三方。卸载应用或清除浏览器数据即可删除。

## 3. 联网地景（可选功能）

开启“联网地景”（默认开启，可在主菜单关闭）时，本应用会根据飞机当前的位置，直接从下列第三方公开服务下载地图瓦片（高程与卫星影像）：

| 服务 | 提供方 | 隐私说明 |
|---|---|---|
| Terrain Tiles（`s3.amazonaws.com`） | Amazon Web Services（AWS 开放数据计划） | https://aws.amazon.com/privacy/ |
| Sentinel-2 cloudless（`tiles.maps.eox.at`） | EOX IT Services GmbH | https://eox.at/privacy-policy/ |
| NASA GIBS（`gibs.earthdata.nasa.gov`，仅在选择该影像源时） | NASA | https://www.nasa.gov/privacy/ |

与访问任何网站一样，这些服务在提供瓦片时会收到你的 **IP 地址**、请求的瓦片坐标（可大致反映游戏中飞机所在的地理区域，而不是你本人的位置）
以及浏览器的常规请求信息（如 User-Agent）。这些信息由上述服务商按各自的隐私政策处理，开发者无法获取。
关闭“联网地景”后，本应用不会发出任何网络请求（Windows 版点击外部链接时会用系统浏览器打开）。

## 4. 游戏手柄与飞行摇杆

本应用通过浏览器的 Gamepad API 读取手柄 / 摇杆的按键和轴数据，仅用于在本地控制游戏，不会保存或传输。

## 5. 儿童隐私

本应用不收集任何人的个人信息，包括 13 岁以下儿童。

## 6. 政策变更

如本政策有更新，将在本页面发布新版本并更新生效日期。

## 7. 联系方式

如有疑问，请在 GitHub 提交 Issue：https://github.com/kevinyuzekai/Flight-Simulator/issues

---

**English summary:** SkyRoute does not collect, store or transmit any personal data and has no accounts, ads or analytics.
Settings stay in local storage on your device. When the optional "online scenery" feature is enabled, map tiles are downloaded
directly from AWS (Terrain Tiles), EOX IT Services (Sentinel-2 cloudless) and optionally NASA GIBS; these providers receive your
IP address and the requested tile coordinates under their own privacy policies. Gamepad/joystick input is processed locally only.
Contact: https://github.com/kevinyuzekai/Flight-Simulator/issues
