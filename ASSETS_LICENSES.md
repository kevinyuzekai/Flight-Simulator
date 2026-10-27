# 资源许可 / Asset Licenses

本文件列出 **天际航线 SkyRoute beta 0.4 / 0.4.1**（原名“飞行模拟器”；0.4.1 为摇杆热修复，第三方资源与 0.4 相同）中使用的全部第三方资源、其作者、许可证以及所做的修改。
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
| A320neo | **已替换** → Sketchfab [Airnz A320neo](https://sketchfab.com/3d-models/airnz-a320neo-93ab115c239e4e9faaf24f598452e436) by Airnz86 (CC BY 4.0)；见第 2 节表 | 替换 | 中性白 + 玻璃 + 简化；程序化起落架 |
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

## 1.5 中性涂装 + 模型自带起落架的机型

部分机型来自 Sketchfab（CC BY 4.0）；**A330-300** 为用户提供的 OBJ（去涂装中性白 + 玻璃分离）；**A320neo / A320ceo**（自 beta 0.5.3 共用同一模型）为 Sketchfab Airnz86「Airnz A320neo」（CC BY 4.0，MatrixTransform 装配 + 中性白 + 保留 WINDSHIELD/PLASTICGLASS + 简化至约 10 万三角面 + 程序化起落架）。

| 游戏机型 | 源模型 | 作者 | 许可证 | 起落架 |
|---|---|---|---|---|
| A320ceo | 与 A320neo 共用 ["Airnz A320neo"](https://sketchfab.com/3d-models/airnz-a320neo-93ab115c239e4e9faaf24f598452e436)（beta 0.5.3 起） | Airnz86 | CC BY 4.0 | 同 A320neo |
| A320neo | ["Airnz A320neo"](https://sketchfab.com/3d-models/airnz-a320neo-93ab115c239e4e9faaf24f598452e436)（Sketchfab，按 A320neo 尺寸缩放） | Airnz86 | CC BY 4.0 | 程序化（源模型起落架/内饰已丢弃） |
| A321neo | ["airbus a321"](https://sketchfab.com/3d-models/542713418c7f47ce9c71d3d0b23921e3)（原韩亚涂装已去除） | 1883 | CC BY 4.0 | 模型自带 |
| B737-800 | ["737 Max-8 (Free)"](https://sketchfab.com/3d-models/197ae72ceb5441efa91b8bdc2ee37050)（737-800 为同一模型按尺寸缩放） | AMGP3D | CC BY 4.0 | 模型自带 |
| B737-MAX8 | "Free Boeing 737 Max-8 3D Model"（CGTrader #3010493；0.6.0 起，替换上一行的旧 MAX 8 外形）。原 GOL 涂装的文字、标志与橙色均已去除，重绘为波音原厂涂装（白色机身 + 蓝色垂尾 / 小翼，未使用波音商标）；源模型缺失的前机身左半由右半镜像补齐；未减面；贴图无损 WebP 内嵌，不单独附带原始文件 | AMPG | CGTrader Royalty Free | 模型自带（可收放，带减震） |
| B777-300ER | ["Boeing 777- 300ER"](https://sketchfab.com/3d-models/cfe500ad3fb14b9ba950dd5403f57ec1) | Adam.White | CC BY 4.0 | 模型自带 |
| A330-300 | 用户提供 OBJ（去涂装中性白；驾驶舱风挡为程序化 3D 玻璃贴合机头） | user-provided | 用户提供用于 SkyRoute | 程序化 |
| C919 / E190 | SkyRoute 项目自制（blender_bot 在 Blender 中程序化建模，源文件 `assets_src/blender/`） | blender_bot | 项目自有 | 模型自带 |


> "Airnz A320neo" by Airnz86 (https://sketchfab.com/3d-models/airnz-a320neo-93ab115c239e4e9faaf24f598452e436),
> licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).
> Modified by SkyRoute: MatrixTransform assembly, neutral white, glass extras, gear/interior dropped, decimated (~105k tris), rescaled, embedded as `models/ac_a320neo.js`.

修改说明：用户 OBJ 经 `obj_pack/pack_user_obj.py` 转换——机头朝向对齐（鼻尖 −Z）、按 `config.js` 尺寸缩放、航司材质/标志重涂为中性白、玻璃与金属分到 `extras`、起落架几何丢弃改用程序化；A330 驾驶舱风挡由 `buildA330Windshield` 在机头曲面上生成。Sketchfab 来源机型的修改仍按 CC BY 4.0 要求：自动朝向、缩放、去标志、自带起落架拆分。A350-900 / A350-1000 / B787-9 仍为第 1 节 amvlab 无标志模型（程序化起落架）。

### 1.6 驾驶舱

各机型驾驶舱为本项目程序化几何体：空客侧杆 + ECAM、波音驾驶盘 + EICAS，并按系列区分配色、显示器形状（A350 / 787 / C919 / 737 MAX 宽屏）、787 HUD 组合镜、
737 MAX / 787 / E190 无下中央屏。未使用外部驾驶舱模型（检索到的 Sketchfab 候选未采用）。

## 2. 仍使用程序化模型的机型（beta 0.4）

| 机型 | 原因 |
|---|---|
| （无） | C919 / E190 已改用项目自制模型，见 1.5 |

beta 0.3.2 中 B737-MAX8 借用 737-800 外形（「真实模型 · 近似」）的做法在 0.4 中取消，改用上面的独立 737 MAX 8 模型；
B777-300ER 也从程序化模型换成了独立模型；各机型来源见 1.5。

排查过但没有采用的来源：FlightGear 及其衍生的 fr24 3D 模型（GPL v2，许可证不兼容本项目的发布方式）、Poly Pizza / OpenGameArt（只有通用的低多边形飞机）、NASA / Smithsonian 3D（没有这些机型）、Stratosphere Studios 777（CC BY-NC-SA，禁止商用）、Sketchfab 上带航空公司涂装或疑似从游戏中提取的模型（未采用）。

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

**涂装菜单只使用中性的通用名称**（之前加入的航司涂装与垂尾标志已移除）（如「经典白」「深海蓝」「日落橙」「森林绿」等，旧存档中的航空公司名称会自动映射到对应的中性涂装），
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

---

## 7. 立体机场（beta 0.4：OpenStreetMap 数据 + 程序化建筑）

| 项目 | 说明 |
|---|---|
| 数据来源 | [OpenStreetMap](https://www.openstreetmap.org/copyright)，© OpenStreetMap contributors，**ODbL 1.0**（https://opendatacommons.org/licenses/odbl/1-0/） |
| 获取方式 | 构建期用 `tools/osm-airports/fetch-osm.js` 通过 OSM API 0.6 下载各机场跑道外包框附近的数据（原始数据不入库），再由 `build-layouts.js` 提取 `aeroway=terminal/hangar/apron/taxiway/jet_bridge`、`man_made=tower` 等要素，生成 `js/airport-osm-data.js` |
| 衍生数据库 | `js/airport-osm-data.js` 是 OSM 数据的衍生数据库，**同样以 ODbL 1.0 提供**；文件头部带有署名与许可说明 |
| 渲染 | 航站楼、机库等按 OSM 轮廓**程序化挤出**（有 `height` / `building:levels` 标签时按标签，否则按类型估算高度），停机坪、滑行道（含黄色中线）、廊桥、塔台均为程序化几何与 Canvas 贴图，**不是真实建筑模型** |
| 覆盖范围 | 游戏机场库中下载到 OSM 数据的机场（游戏内「致谢 / 许可」面板显示具体数量）；其余机场使用 0.3.2 的手工布局或按跑道自动生成的通用航站区 |
| 游戏内署名 | 「致谢 / 许可」面板中注明 “© OpenStreetMap contributors, ODbL 1.0” |

0.3.2 的 15 座手工布局（ZSPD / ZBAA / ZGGG / VHHH / KJFK / KLAX / EGLL / RJTT / WSSS / OMDB / ZUUU / ZSSS / RJAA / EDDF / LFPG）
仍作为没有 OSM 数据时的后备。联网地景开启时，对没有内置数据的机场仍会尝试在线请求 Overpass API 补充滑行道（失败时静默回退）。

评估过但未嵌入分发的资源：3dassets.dev「Airport Terminal and Ground Operations」套件（CC0，偏卡通风格，与卫星地景风格不一致，故未采用）。

#### Airbus 驾驶舱面板实拍贴图 (`models/tex_cockpit_airbus.js`)
用于 A320 系列 / A330 / A350 / C919 的 FCU 与 EFIS 控制板贴图 (顶板为程序绘制 + 三维开关)（已裁剪、调亮；画面中无航司标志）。动态数值窗口和指示灯由程序叠加绘制。
| 用途 | 原图 | 作者 | 许可 |
|---|---|---|---|
| FCU + EFIS 控制板 | [A340 FCU.jpg](https://commons.wikimedia.org/wiki/File:A340_FCU.jpg) | Kiko Alario Salom | CC BY 2.0 |
