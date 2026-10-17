/* 天际航线 SkyRoute — 检查更新 (beta 0.5.1)
   启动时 (每天最多一次) 和手动「检查更新」时读取 GitHub Releases (含预发布),
   有新版本时显示不阻塞的小提示; 离线或出错时静默。商店版 (?store=1) 按钮打开 Microsoft Store 页面。 */
(function (global) {
  'use strict';
  var FS = global.FS = global.FS || {};
  var API = 'https://api.github.com/repos/kevinyuzekai/Flight-Simulator/releases?per_page=20';
  var KEY = 'skyroute.updateCheck';
  var DAY = 24 * 3600 * 1000;
  var STORE_URL = 'ms-windows-store://pdp/?productid=9P25XZZM8JXT';
  var STORE_WEB = 'https://apps.microsoft.com/detail/9P25XZZM8JXT';

  function curVersion() { return String((FS.CFG && FS.CFG.version) || '0'); }
  /** 'beta_v0.5.1' / '0.5.1-beta' → [0,5,1] */
  function parse(v) {
    var m = String(v || '').match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
    return m ? [+m[1], +(m[2] || 0), +(m[3] || 0)] : null;
  }
  function cmp(a, b) { for (var i = 0; i < 3; i++) { if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1; } return 0; }
  function isStore() {
    try { return /[?&]store=1\b/.test(global.location.search); } catch (e) { return false; }
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function snippet(body) {
    var t = String(body || '').replace(/<[^>]*>/g, ' ').replace(/[#*`|>]/g, ' ').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
    var lines = t.split('\n').map(function (l) { return l.replace(/\s+/g, ' ').trim(); }).filter(function (l) { return l && !/^[-\s:]+$/.test(l) && !/^(下载|文件|校验)/.test(l); });
    var s = lines.slice(0, 2).join(' · ');
    return s.length > 160 ? s.slice(0, 157) + '…' : s;
  }

  function toast(html, ms) {
    var d = global.document; if (!d || !d.body) return;
    var old = d.getElementById('update-toast'); if (old) old.remove();
    var el = d.createElement('div');
    el.id = 'update-toast';
    el.setAttribute('role', 'status');
    el.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:9999;max-width:360px;padding:12px 14px;' +
      'background:rgba(11,42,91,0.95);color:#fff;border:1px solid rgba(255,255,255,0.25);border-radius:10px;' +
      'font:13px/1.5 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,0.35)';
    el.innerHTML = html + '<button type="button" data-x style="position:absolute;top:4px;right:8px;background:none;border:0;color:#fff;font-size:16px;cursor:pointer" aria-label="关闭">×</button>';
    el.querySelector('[data-x]').onclick = function () { el.remove(); };
    d.body.appendChild(el);
    if (ms) setTimeout(function () { if (el.parentNode) el.remove(); }, ms);
    return el;
  }

  function showNew(rel, ver) {
    var store = isStore();   // 商店版: 按钮打开 Microsoft Store 页面 (以 GitHub 最新版本作为信号)
    var url = store ? STORE_URL : (rel.html_url || 'https://github.com/kevinyuzekai/Flight-Simulator/releases');
    var title = store ? ('微软商店有新版本 ' + esc(ver) + '，点击前往更新') : ('发现新版本 ' + esc(ver) + '（当前 ' + esc(curVersion()) + '）');
    var el = toast('<div style="font-weight:600;margin-bottom:4px;padding-right:16px">' + title + '</div>' +
      '<div style="opacity:0.85;margin-bottom:8px">' + esc(snippet(rel.body)) + '</div>' +
      '<button type="button" data-open style="background:#3b82f6;color:#fff;border:0;border-radius:6px;padding:5px 12px;cursor:pointer">' + (store ? '前往微软商店' : '查看发布页') + '</button>', 30000);
    if (el) el.querySelector('[data-open]').onclick = function () {
      // Electron: setWindowOpenHandler → shell.openExternal (ms-windows-store: 失败时主进程回退到网页版商店)
      var w = null;
      try { w = global.open(url, '_blank', 'noopener'); } catch (e) { /* */ }
      el.remove();
    };
  }

  /** manual=true 时无论结果都给出提示 */
  function check(manual) {
    if (!global.fetch) { if (manual) toast('无法检查更新', 4000); return Promise.resolve(null); }
    var cur = parse(curVersion());
    return global.fetch(API, { headers: { Accept: 'application/vnd.github+json' } }).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    }).then(function (list) {
      var best = null, bv = null;
      (list || []).forEach(function (rel) {
        if (!rel || rel.draft) return;
        var v = parse(rel.tag_name); if (!v) return;
        if (!bv || cmp(v, bv) > 0) { best = rel; bv = v; }
      });
      try { global.localStorage.setItem(KEY, String(Date.now())); } catch (e) { /* */ }
      if (best && cur && cmp(bv, cur) > 0) { showNew(best, bv.join('.')); return best; }
      if (manual) toast('已是最新版本（' + esc(curVersion()) + '）', 4000);
      return null;
    }).catch(function () {
      if (manual) toast('检查更新失败，请检查网络连接', 4000);
      return null;
    });
  }

  function autoCheck() {
    try { if (/[?&](noupdate=1)/.test(global.location.search) || global.__FS_TEST__) return; } catch (e) { /* */ }
    var last = 0;
    try { last = +global.localStorage.getItem(KEY) || 0; } catch (e) { /* */ }
    if (Date.now() - last < DAY) return;
    setTimeout(function () { check(false); }, 4000);
  }

  FS.Update = { check: check, autoCheck: autoCheck, _parse: parse, _cmp: cmp };

  var d = global.document;
  if (d && d.addEventListener) {
    var go = function () {
      var b = d.getElementById('check-update-btn');
      if (b) b.addEventListener('click', function () { check(true); });
      autoCheck();
    };
    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', go); else go();
  }
})(typeof window !== 'undefined' ? window : this);
