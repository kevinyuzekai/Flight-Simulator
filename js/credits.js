/* =========================================================================
   credits.js —— 致谢 / 资源许可面板 (beta 0.2)
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
    html += '<h3>第三方代码</h3><p class="muted">three.js r149 — MIT License — ' + link('https://github.com/mrdoob/three.js') + '</p>';
    html += '<h3>说明</h3><p class="muted">所有模型均以 JavaScript 形式内嵌在 models/ 目录中，无需联网，可直接用 file:// 打开。' +
      '模型的修改内容 (坐标转换、缩放、机身加长、涂装重绘等) 详见 ASSETS_LICENSES.md。' +
      '涂装菜单中以航空公司命名的配色方案仅为配色，不包含任何标志或商标。</p>';
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
