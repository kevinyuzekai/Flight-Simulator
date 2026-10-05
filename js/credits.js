/* =========================================================================
   credits.js —— 关于 / 致谢 / 资源许可面板 (beta 0.2, beta 0.3 增加联网地景署名)
   列出游戏内使用的真实 3D 模型的来源、作者与许可证。
   数据来自 models/*.js 中嵌入的 credit 字段 (FS.Aircraft3D.credits())。
   完整说明见 ASSETS_LICENSES.md。
   ========================================================================= */
(function (global) {
  'use strict';
  var FS = global.FS = global.FS || {};

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function link(url, text) {
    return '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(text || url) + '</a>';
  }

  function render() {
    var box = global.document.getElementById('credits-list');
    if (!box) return;
    var list = (FS.Aircraft3D && FS.Aircraft3D.credits) ? FS.Aircraft3D.credits() : [];
    var types = Object.keys(FS.AIRCRAFT_DB || {});
    var html = '';
    html += '<div class="about-head"><img src="assets/brand/icon-256.png" alt="" width="56" height="56"><div><b>天际航线 SkyRoute</b> v' + esc((FS.CFG && FS.CFG.version) || '') +
      '<br><span class="muted">网页版民航客机飞行模拟器 · 作者 kevinyuzekai · ' + link('https://github.com/kevinyuzekai/Flight-Simulator', 'GitHub') +
      '<br>仅供娱乐，与任何航空公司、飞机制造商或其他飞行模拟软件无关；标志与图标为项目作者拥有的原创作品。</span></div></div>';
    html += '<h3>真实 3D 机型模型</h3>';
    if (!list.length) {
      html += '<p class="muted">未载入任何外部模型，全部机型使用程序化模型。</p>';
    } else {
      html += '<table><tr><th>机型</th><th>源模型</th><th>作者</th><th>许可证</th><th>说明</th></tr>';
      list.forEach(function (c) {
        var cr = c.credit || {};
        var note = c.derived
          ? '派生：在源模型基础上插入机身段 (' + (c.plug ? ('前 ' + c.plug[0].toFixed(2) + ' m / 后 ' + c.plug[1].toFixed(2) + ' m') : '') + ') 以匹配本机型长度，并非该机型的独立模型'
          : '按本机型尺寸缩放';
        html += '<tr><td>' + esc(c.type) + '</td><td>' + link(cr.url, cr.title || c.source) + '</td><td>' + esc(cr.author) +
          '</td><td>' + link(cr.licenseUrl, cr.license) + '</td><td class="muted">' + esc(note) + '；涂装已重绘为无商标的中性白色。' + c.triangles + ' 三角面。</td></tr>';
      });
      html += '</table>';
    }
    var proc = types.filter(function (k) { return !(FS.ModelAssets && FS.ModelAssets[k]); });
    if (proc.length) {
      html += '<h3>程序化模型</h3><p class="muted">以下机型暂未找到许可证可再分发的真实模型，继续使用游戏内程序化生成的模型：' +
        esc(proc.join('、')) + '</p>';
    }
    var SRC = FS.OnlineScenery && FS.OnlineScenery.SOURCES;
    html += '<h3>联网地景数据 (beta 0.3, 仅在开启"联网地景"时在线加载)</h3>';
    html += '<table><tr><th>数据</th><th>来源</th><th>许可 / 条款</th></tr>' +
      '<tr><td>高程 (DEM)</td><td>' + link('https://registry.opendata.aws/terrain-tiles/', 'Terrain Tiles on AWS (Terrarium 格式, Mapzen / Tilezen)') + '</td><td>各数据源许可, 需署名 (见下)</td></tr>' +
      '<tr><td>卫星影像 (默认)</td><td>' + link('https://s2maps.eu', 'Sentinel-2 cloudless 2016 by EOX IT Services GmbH') + ' (Contains modified Copernicus Sentinel data 2016)</td><td>' + link('https://creativecommons.org/licenses/by/4.0/', 'CC BY 4.0') + '</td></tr>' +
      '<tr><td>卫星影像 (可选)</td><td>Sentinel-2 cloudless 2024 by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2024)</td><td>' + link('https://creativecommons.org/licenses/by-nc-sa/4.0/', 'CC BY-NC-SA 4.0') + ' — 仅限非商业用途</td></tr>' +
      '<tr><td>卫星影像 (可选)</td><td>NASA Blue Marble, ' + link('https://earthdata.nasa.gov/gibs', 'NASA EOSDIS GIBS') + '</td><td>NASA 数据, 无使用限制, 请注明来源</td></tr></table>';
    if (SRC && SRC.dem.attributionFull) {
      html += '<p class="muted">高程数据必须署名 (tilezen/joerd attribution.md 原文):</p><ul class="muted small">' +
        SRC.dem.attributionFull.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
    }
    html += '<p class="muted">瓦片请求有并发与速率限制, 并利用浏览器缓存; 关闭"联网地景"或离线时自动使用内置程序化地形, 游戏完全可离线运行。</p>';
    html += '<h3>第三方代码</h3><p class="muted">three.js r149 — MIT License — ' + link('https://github.com/mrdoob/three.js') + '</p>';
    html += '<h3>立体机场</h3><p class="muted">beta 0.3.2：航站楼 / 塔台 / 廊桥 / 停机坪 / 滑行道为程序化生成；' +'主要枢纽（浦东、首都、白云、香港、成田、樟宜、迪拜、希思罗、肯尼迪、洛杉矶等）内置真实布局。' +'开启联网地景时可能从 OpenStreetMap (ODbL) 补充滑行道，失败则回退内置布局。</p>';
    html += '<h3>说明</h3><p class="muted">所有模型均以 JavaScript 形式内嵌在 models/ 目录中，无需联网，可直接用 file:// 打开。' +
      '模型的修改内容 (坐标转换、缩放、机身加长、涂装重绘等) 详见 ASSETS_LICENSES.md。' +
      '涂装菜单中的配色方案均为通用名称，不模仿任何真实航空公司，不包含标志或商标；空中交通的呼号均为虚构。</p>';
    box.innerHTML = html;
  }

  function open() { render(); global.document.getElementById('credits-overlay').classList.remove('hidden'); }
  function close() { global.document.getElementById('credits-overlay').classList.add('hidden'); }

  function init() {
    var b = global.document.getElementById('credits-btn');
    var c = global.document.getElementById('credits-close');
    var ov = global.document.getElementById('credits-overlay');
    if (b) b.addEventListener('click', open);
    if (c) c.addEventListener('click', close);
    if (ov) ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    global.document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && ov && !ov.classList.contains('hidden')) { close(); e.stopPropagation(); }
    }, true);
  }

  FS.Credits = { open: open, close: close, render: render };
  if (global.document.readyState === 'loading') global.document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
