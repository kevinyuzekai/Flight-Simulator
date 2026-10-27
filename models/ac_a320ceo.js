/* A320ceo 槽位: 与 ac_a320neo.js 相同的 Airnz86 模型 (beta 0.5.3)
   0.6.0: 几何数据与 ac_a320neo.js 逐字节相同, 改为别名以缩小包体 (无损, 同一模型)
   模型: "Airnz A320neo", 作者 Airnz86, 许可 CC BY 4.0 — 见 ASSETS_LICENSES.md */
(function (g) { var FS = g.FS = g.FS || {}; FS.ModelAssets = FS.ModelAssets || {};
var src = FS.ModelAssets["A320neo"]; if (!src) return;
var c = {}; for (var k in src) c[k] = src[k]; c.key = "A320ceo";
FS.ModelAssets["A320ceo"] = c;
})(typeof window !== "undefined" ? window : globalThis);
