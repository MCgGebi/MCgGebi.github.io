/* ========================================
   DBP-HUB · Init v0.9.20
   - 无任何初始化弹窗：脚本就绪后立即挂载应用，直接进入主界面
   - 启动期任何错误 → 推入 $dbpError 总线（phase/plugin/url/stack/time/fatal）
     → 由 app.js 的常驻错误面板渲染，不自动消失、可展开查看完整堆栈
   - 致命错误：禁用「清除」、仅刷新可清
   ======================================== */
(function (global) {
  'use strict';

  var APP_VERSION = '0.9.20';

  // 确保错误总线可用（utils.js 未加载时降级为内存数组 + 控制台）
  var _fallback = !global.$dbpError;
  if (_fallback) {
    var _buf = [];
    global.$dbpError = {
      list: function () { return _buf.slice(); },
      push: function (e) {
        var entry = typeof e === 'object' && e !== null ? e : { message: String(e) };
        entry.time = entry.time || new Date().toISOString();
        entry.phase = entry.phase || 'bootstrap';
        _buf.push(entry);
        console.error('[DBP] (bus fallback)', entry.phase, entry.message);
        return entry;
      },
      clear: function () { _buf = []; },
    };
  }

  function report(phase, err, extra) {
    extra = extra || {};
    global.$dbpError.push({
      phase: phase,
      plugin: extra.plugin || null,
      url: extra.url || null,
      message: (err && err.message) ? err.message : String(err),
      stack: (err && err.stack) || (new Error().stack || ''),
      time: new Date().toISOString(),
      fatal: !!extra.fatal,
    });
  }

  function waitForDeps(timeoutMs) {
    return new Promise(function (resolve, reject) {
      var start = Date.now();
      function check() {
        if (typeof global.Vue !== 'undefined' && typeof global.VueRouter !== 'undefined') { resolve(); return; }
        if (Date.now() - start > timeoutMs) { reject(new Error('依赖加载超时（vendor/vue.global.prod.js 或 vue-router 未就绪）')); return; }
        setTimeout(check, 50);
      }
      check();
    });
  }

  // 极早失败兜底：连 Vue 都没加载时，渲染内联降级页（仍推错误总线）
  function renderFatalFallback(err) {
    report('bootstrap', err, { fatal: true });
    var host = document.getElementById('app-root') || document.body;
    if (host.querySelector('.dbp-fatal-fallback')) return;
    var div = document.createElement('div');
    div.className = 'dbp-fatal-fallback';
    div.innerHTML =
      '<div style="position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:var(--bg,#1a1a1a);color:var(--text,#eee);font-family:sans-serif;padding:40px;text-align:center;z-index:9999;">' +
      '<i class="fas fa-bug" style="font-size:40px;color:#e05a4a;"></i>' +
      '<div style="font-size:18px;font-weight:600;">DBP-HUB 启动失败</div>' +
      '<div style="font-size:12px;color:#aaa;max-width:560px;line-height:1.7;">' + (err && err.message || '未知错误') + '</div>' +
      '<pre style="text-align:left;background:#111;padding:14px;border-radius:8px;font-size:11px;color:#d4d4d4;max-width:720px;overflow:auto;">' + (err && err.stack || '').replace(/</g, '&lt;') + '</pre>' +
      '<button onclick="location.reload()" style="padding:8px 24px;border:none;border-radius:6px;background:#3b8526;color:#fff;cursor:pointer;">刷新页面</button>' +
      '</div>';
    host.appendChild(div);
  }

  // ★ 应用没挂载成功时的可见兜底：错误不能只躺在控制台里
  function ensureVisible(err) {
    var root = document.getElementById('app-root');
    var mounted = root && root.children && root.children.length > 0 && !root.querySelector('.dbp-fatal-fallback');
    // 情况1：Vue 应用已挂载 → 常驻错误面板会显示，无需处理
    if (mounted) return;
    // 情况2：应用没起来 → 渲染静态兜底页，保证错误信息一定可见
    renderFatalFallback(err);
  }

  function start() {
    console.log('[Init] 启动序列开始 (v' + APP_VERSION + ')...');

    // 主题尽早应用（避免首屏闪烁）；失败也继续，不阻断启动
    try { if (typeof global.applyTheme === 'function') global.applyTheme(localStorage.getItem('dbp-theme') || 'dark'); } catch (e) {}
    // 自定义主题色尽早应用（与 index.html 早期脚本协同，防闪烁）
    try { if (typeof global.applyAccent === 'function') global.applyAccent(global.getStoredAccent ? global.getStoredAccent() : '#3b8526'); } catch (e) {}

    waitForDeps(15000)
      .then(function () { if (typeof global.DBP_BOOTSTRAP !== 'function') throw new Error('DBP_BOOTSTRAP 未定义（plugin-loader.js 未加载或路径错误）'); return global.DBP_BOOTSTRAP(); })
      .then(function () {
        console.log('[Init] ✓ 启动完成 (v' + APP_VERSION + ')');
        // 启动完成后弹出公告（未读的全部进入同一个弹窗队列；失败不阻断使用）
        return (typeof global.startAnnouncement === 'function')
          ? global.startAnnouncement(global.Vue) : Promise.resolve(false);
      })
      .then(function (shown) {
        if (shown) {
          var n = (typeof global.getAnnouncements === 'function')
            ? (global.getAnnouncements() || []).filter(function (a) {
                return typeof global.isAnnouncementRead === 'function'
                  ? !global.isAnnouncementRead(a.id) : true;
              }).length : 0;
          console.log('[Init] 已弹出公告' + (n > 1 ? '（' + n + ' 条未读）' : ''));
        }
      })
      .catch(function (err) {
        console.error('[Init] 启动失败:', err && err.message || err);
        report('bootstrap', err, { fatal: true });
        // ★ 不再只在 _fallback 时兜底：只要应用没挂载起来，就必须让用户看见错误
        ensureVisible(err);
      });

    // 终极兜底：20s 后仍无内容 → 视为初始化死锁，记录详细错误
    setTimeout(function () {
      var root = document.getElementById('app-root');
      if (root && (!root.children || root.children.length === 0)) {
        var e = new Error('应用初始化超时（20s）：plugins.json 路径错误 / Vue 脚本加载失败 / 插件脚本抛错');
        report('bootstrap', e, { fatal: true });
        ensureVisible(e);
      }
    }, 20000);
  }

  // 兼容旧调用方：统一转入总线
  global.showInitError = function (err, isFatal) {
    report((err && err.__phase) || 'legacy', err, { fatal: !!isFatal });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

})(window);
