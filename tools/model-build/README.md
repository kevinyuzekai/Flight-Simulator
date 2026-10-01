# 模型构建脚本 (beta 0.2)

把 [amvlab/aircraft-models](https://github.com/amvlab/aircraft-models)（CC BY 4.0）的 GLB 源模型转换成游戏使用的
`models/*.js`。游戏运行时**不需要**这些脚本，它们只用于复现或修改模型。许可与修改说明见 `../../ASSETS_LICENSES.md`。

```bash
git clone https://github.com/amvlab/aircraft-models /tmp/amvlab
git -C /tmp/amvlab checkout 91d835e8e851b2317fe79af291c9fed6153fd525
npm i three@0.149.0                                   # plans.js 需要
node plans.js ../.. /tmp/plans.json                   # 导出程序化模型的对齐参数
pip install numpy pillow scipy
AMVLAB_MODELS=/tmp/amvlab/models PLANS_JSON=/tmp/plans.json python3 build_models.py ../../models
```

- `glb.py`：最小的 GLB 读取器（只依赖 numpy）
- `build_models.py`：坐标转换、缩放、派生机型机身加长、风扇拆分、涂装重绘、量化与 base64 内嵌
- `plans.js`：从 `js/aircraft3d.js` 导出各机型的机头位置、起落架高度等参数，使真实模型与程序化起落架/灯光/驾驶舱视角对齐
