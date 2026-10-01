# 资源许可 / Asset Licenses

本文件列出 **飞行模拟器 beta 0.2** 中使用的全部第三方资源、其作者、许可证以及所做的修改。
游戏内也可以在主菜单点击 **「致谢 / 许可」** 查看同样的信息。

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
> repainted to a neutral livery and embedded as JavaScript by the Flight-Simulator project.

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

## 4. 其他资源

地形、天空、云、海洋、音效、仪表和程序化飞机模型都由游戏代码实时生成，不使用外部素材。

涂装菜单中以航空公司命名的选项（沿用自 v0.1）**只是配色方案**，不包含任何标志、文字或商标图形；TCAS 交通流的呼号使用了真实航空公司的 ICAO 代码格式（沿用自 v0.1）。
