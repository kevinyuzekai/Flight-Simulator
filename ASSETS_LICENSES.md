# 资源许可 / Asset Licenses

本文件列出 **天际航线 SkyRoute beta 0.3**（原名“飞行模拟器”）中使用的全部第三方资源、其作者、许可证以及所做的修改。
游戏内也可以在主菜单点击 **「致谢 / 许可」** 查看同样的信息（联网地景开启时，点击画面右下角的署名条也会打开该面板）。

> 代码许可：v0.1 发布包与本仓库目前**都没有附带代码许可证文件**。下面只说明第三方资源的许可，
> 不代表对游戏代码本身授予任何许可。

---

## 1. 真实 3D 机型模型 —— amvlab 3D Aircraft Models (CC BY 4.0)

| 项目 | 内容 |
|---|---|
| 来源仓库 | https://github.com/amvlab/aircraft-models |
| 使用的版本 | commit `91d835e8e851b2317fe79af291c9fed6153fd525`（2026-08-08） |
| 作者 / 版权 | Copyright (c) 2026 amvlab（提交者：Andres Morfin Veytia） |
| 许可证 | Creative Commons Attribution 4.0 International (CC BY 4.0) — https://creativecommons.org/licenses/by/4.0/ |
| 使用的文件 | 仓库自带的**无标志版本** `models/*_nologo.glb` |

### 1.1 机型对应关系

| 游戏机型 | 源文件 | 类型 | 说明 |
|---|---|---|---|
| A350-900 | [`A350_nologo.glb`](https://github.com/amvlab/aircraft-models/blob/91d835e8e851b2317fe79af291c9fed6153fd525/models/A350_nologo.glb) | 直接使用 | 按 A350-900 尺寸缩放（66.8 m / 64.75 m） |
| A350-1000 | 同上 | **派生** | 在 A350 模型上插入机身段：机翼前 3.85 m、机翼后 3.14 m（总长 73.79 m）。并非 A350-1000 的独立模型（例如没有六轮主起落架和加大的后缘襟翼）。 |
| A320neo | [`A320_nologo.glb`](https://github.com/amvlab/aircraft-models/blob/91d835e8e851b2317fe79af291c9fed6153fd525/models/A320_nologo.glb) | 直接使用 | 源模型带大直径发动机短舱与鲨鳍小翼，按 A320neo 尺寸缩放 |
| A321neo | 同上 | **派生** | 在 A320 模型上插入机身段：机翼前 4.27 m、机翼后 2.67 m（总长 44.51 m）。舱门布局仍是 A320 的，不是独立的 A321neo 模型。 |
| B737-800 | [`B737_nologo.glb`](https://github.com/amvlab/aircraft-models/blob/91d835e8e851b2317fe79af291c9fed6153fd525/models/B737_nologo.glb) | 直接使用 | 带融合式翼梢小翼，按 737-800 尺寸缩放 |
| B787-9 | [`B787_nologo.glb`](https://github.com/amvlab/aircraft-models/blob/91d835e8e851b2317fe79af291c9fed6153fd525/models/B787_nologo.glb) | **派生** | 源模型长度相当于 787-8，插入机身段：机翼前 3.05 m、机翼后 3.04 m（总长 62.8 m） |

游戏菜单中，使用真实模型的机型卡片标有「真实模型」，派生的标有「真实模型 · 派生」。

### 1.2 对源模型所做的修改（CC BY 4.0 要求注明修改）

由 `tools/model-build/build_models.py`（仓库内提供）自动完成：

1. **坐标转换**：glTF 源坐标（机头 +X、右翼 +Z）转换为游戏模型坐标（机头 −Z、上 +Y、右翼 +X）；修正了 A320 源模型中 10 个法线朝内的三角面。
2. **按机型真实尺寸缩放**：机身截面按 `config.js` 中的机身直径缩放，机翼按翼展分段缩放，长度按机身全长缩放；机头位置对齐到原程序化模型的机头位置，使驾驶舱视角、灯光、起落架位置保持一致。
3. **派生机型的机身加长**：在机翼前、后各选一处顶点间隙最大的截面切开，把后半部分整体后移（见上表），中间由拉伸的机身蒙皮连接。
4. **风扇分离**：按 UV 圆形区域识别发动机风扇与整流锥三角面，拆成独立的可旋转部件，游戏中随 N1 转动。
5. **涂装重绘（去除商标风格配色）**：源贴图即使是 `_nologo` 版本仍带有接近航空公司的配色，已把机身与垂尾的涂装区域重绘为中性白色，机翼重绘为中性灰色，发动机短舱为浅灰色；另外生成一张遮罩贴图（垂尾 / 腰线 / 机腹），游戏用它按菜单中选择的涂装颜色重新着色。没有添加任何标志、文字或注册号。
6. **压缩与内嵌**：贴图转为 1024² JPEG（遮罩 512² PNG），几何体量化后以 base64 形式写入 `models/*.js`，通过 `<script>` 标签加载，因此**无需联网，并支持 `file://` 直接打开**。
7. **未使用**的部分：源模型没有起落架，游戏仍使用原来程序化生成的起落架、舱门、灯光；舵面（副翼、襟翼、扰流板、升降舵、方向舵）、反推和机翼弯曲动画在真实模型上是静态的（程序化模型上保留原动画）。

### 1.3 署名

> 3D aircraft models: "amvlab 3D Aircraft Models" (A320, A350, B737, B787) by amvlab (Andres Morfin Veytia),
> https://github.com/amvlab/aircraft-models , licensed under CC BY 4.0
> (https://creativecommons.org/licenses/by/4.0/). Modified: converted, rescaled, fuselage-stretched (A350-1000, A321neo, B787-9),
> repainted to a neutral livery and embedded as JavaScript by the SkyRoute (Flight-Simulator) project.

### 1.4 需要注意的地方

- 该仓库于 2026-07-30 创建，作者在仓库中以 CC BY 4.0 发布。我们只能依据作者的许可声明使用，**无法独立核实这些模型最初是否由作者本人制作**（模型材质命名带有 3ds Max 导出痕迹）。我们把这些模型与 FlightGear 衍生的 GPL 模型（fr24 3D models）做过比对：三角面数和几何都明显不同，不是对那些模型的复制。如果日后发现来源问题，可在 `index.html` 中删除 `models/*.js` 的 `<script>` 标签，游戏会自动退回程序化模型；或在地址后加 `?procedural=1`。
- 机型名称（Airbus A350 等）只用于描述，游戏与这些制造商没有关联，也没有获得其认可。

---

## 2. 仍使用程序化模型的机型

以下机型没有找到许可证允许再分发（CC0 / 公有领域 / CC BY）且质量可用的模型，继续使用游戏原有的程序化模型，没有用其他机型的模型冒充：

| 机型 | 原因 |
|---|---|
| B737-MAX8 | amvlab 只有 737NG 外形；MAX 的 LEAP-1B 发动机、锯齿尾喷口和 AT 小翼不同，不能直接替用 |
| A330-300 | 没有找到许可证合适的模型 |
| B777-300ER | 没有找到许可证合适的模型 |
| C919 | 没有找到许可证合适的模型 |
| E190 | 没有找到许可证合适的模型 |

排查过但没有采用的来源：Sketchfab（大量 CC BY 模型需要登录 / API 才能下载，且不少疑似从游戏中提取）、FlightGear 及其衍生的 fr24 3D 模型（GPL v2，许可证不兼容本项目的发布方式）、Poly Pizza / OpenGameArt（只有通用的低多边形飞机）、NASA / Smithsonian 3D（没有这些机型）。

---

## 3. 第三方代码

| 组件 | 版本 | 许可证 |
|---|---|---|
| three.js (`vendor/three.min.js`) | r149 | MIT — https://github.com/mrdoob/three.js/blob/dev/LICENSE |

---

## 4. 其他资源 / 涂装与呼号

地形（离线模式）、天空、云、海洋、音效、仪表和程序化飞机模型都由游戏代码实时生成，不使用外部素材。

beta 0.3.1 的**三维驾驶舱**（`js/cockpit3d.js`：风挡框、遮光板、FCU / MCP、主仪表板、操纵台、侧杆 / 驾驶盘、头顶板、座椅及其 Canvas 贴图）
同样是本项目原创的程序化几何体与代码绘制贴图，不使用任何外部模型、照片或厂商标志；布局只参考公开的一般驾驶舱布置（显示器尺寸、各部件的大致位置）。

**beta 0.3 起**：涂装菜单只使用中性的通用名称（如「经典白」「深海蓝」「日落橙」「森林绿」等，旧存档中的航空公司名称会自动映射到对应的中性涂装），
配色方案不模仿任何真实航空公司，不包含任何标志、文字或商标图形；TCAS / 空中交通的呼号全部为虚构代码
（NIMB、ZEFR、AURA、KITE、LUMO、ORCA、PIKA、SOLA、TERN、VELA、WREN、YUKI），与真实航空公司 ICAO 代码无关。

---

## 5. 联网地景数据（beta 0.3，可选，默认开启，可在菜单「联网地景」或 URL 参数 `?online=0` 关闭）

联网地景**不随游戏分发任何地图数据**：只有在开启时，浏览器才会从下列公开服务按需下载瓦片，并只缓存在浏览器 / 内存中。
网络不可用或请求失败时自动回退到内置程序化地形。画面右下角显示署名条（点击可查看完整署名）。

| 数据 | 服务地址 | 许可 / 条款 | 备注 |
|---|---|---|---|
| 高程 DEM（Terrarium PNG，z ≤ 12） | `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png` — [Terrain Tiles on AWS](https://registry.opendata.aws/terrain-tiles/)（Mapzen / Tilezen joerd） | 各数据源的开放许可，**必须署名**（见下方原文） | AWS 开放数据计划托管，无需密钥；CORS `*` |
| 卫星影像（默认） | EOX `s2cloudless_3857`（WMTS，z ≤ 14）— [Sentinel-2 cloudless 2016](https://s2maps.eu) | **CC BY 4.0**；署名：“Sentinel-2 cloudless – https://s2maps.eu by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016)” | 只有 **2016** 年版是 CC BY 4.0，可商用 |
| 卫星影像（可选） | EOX `s2cloudless-2024_3857` | **CC BY-NC-SA 4.0 —— 仅限非商业用途** | 2017 年及以后的版本均为 NC 许可；菜单中已标注；若将来商业化（例如收费上架）必须改回 2016 版或取得 EOX 商业授权 |
| 卫星影像（可选，低分辨率） | NASA EOSDIS GIBS `BlueMarble_ShadedRelief_Bathymetry`（z ≤ 8） | NASA 数据无使用限制，要求注明来源 | 全球低分辨率底图 |

### 5.1 高程数据必须署名的原文（tilezen/joerd `docs/attribution.md`）

```
* ArcticDEM terrain data DEM(s) were created from DigitalGlobe, Inc., imagery and
  funded under National Science Foundation awards 1043681, 1559691, and 1542736;
* Australia terrain data © Commonwealth of Australia (Geoscience Australia) 2017;
* Austria terrain data © offene Daten Österreichs – Digitales Geländemodell (DGM)
  Österreich;
* Canada terrain data contains information licensed under the Open Government
  Licence – Canada;
* Europe terrain data produced using Copernicus data and information funded by the
  European Union - EU-DEM layers;
* Global ETOPO1 terrain data U.S. National Oceanic and Atmospheric Administration
* Mexico terrain data source: INEGI, Continental relief, 2016;
* New Zealand terrain data Copyright 2011 Crown copyright (c) Land Information New
  Zealand and the New Zealand Government (All rights reserved);
* Norway terrain data © Kartverket;
* United Kingdom terrain data © Environment Agency copyright and/or database right
  2015. All rights reserved;
* United States 3DEP (formerly NED) and global GMTED2010 and SRTM terrain data
  courtesy of the U.S. Geological Survey.
```

### 5.2 使用方式与瓦片使用规范

- 最多 6 个并发请求、每秒最多 24 个新请求、15 秒超时；不再需要的瓦片会取消排队；内存 LRU 缓存（影像 260 块 / 高程 120 块），并利用浏览器 HTTP 缓存（EOX 返回 `max-age` 7 天）。
- 不做批量预下载、不绕过服务端限制、不修改或去除署名。一次静止起步约 250–370 个请求，正常飞行时请求量随移动缓慢增加。
- EOX 的 WMTS 服务是免费的公共服务，没有 SLA；若 EOX 将来限制第三方使用，可在菜单切换到 NASA GIBS 或关闭联网地景。
- **file:// 直接打开**也可以使用：S3 与 GIBS 返回 `Access-Control-Allow-Origin: *`，EOX 会回显请求的 Origin（`null`）。Windows 桌面版使用 `app://skyroute` 源，同样可用（已验证 EOX 回显该 Origin）。

### 5.3 评估过但没有采用的来源

| 来源 | 原因 |
|---|---|
| Esri World Imagery | 使用条款要求 ArcGIS 账户 / 协议（以及 API key），不适合直接在免费分发的开源游戏中调用 |
| USGS National Map 影像（USGSImageryOnly） | 公有领域，但只覆盖美国 |
| Google / Bing / Mapbox 卫星图 | 需要 API key 与付费 / 专有条款，禁止此类缓存与 3D 使用方式 |

### 5.4 已知局限

- Sentinel-2 的分辨率为 10 m，低空时影像较模糊；2016 年的影像早于部分机场改扩建（例如香港国际机场第三跑道在影像中尚不存在，但游戏中的跑道仍按数据库绘制）。
- 高程数据在跑道附近被压平到机场标高，以免跑道“悬空”或“埋入地下”。

---

## 6. 天际航线 SkyRoute 品牌素材（原创）

`assets/brand/` 中的标志与图标（`skyroute_logo*.png`、`skyroute_icon*.png`、`skyroute_app_icon_*.png`，以及由其生成的
`favicon*`、`icon-256.png`、Windows `.ico`、MSIX 磁贴图片）是**应项目作者要求专门制作的原创作品，归项目作者 kevinyuzekai 所有**，
不包含任何航空公司或飞机制造商的标志。本文件中的第三方许可**不适用于**这些品牌素材；未经作者许可，请勿在其他项目中使用。
品牌色：深蓝 `#0B2A5B`、天蓝 `#2EA3F2`、橙色 `#FF8A3D`。
