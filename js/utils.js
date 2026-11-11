/* ========================================
   DBP-HUB · Utils v0.9.20
   - Toast 通知（不阻塞、自动消失）
   - 确认框 showConfirm
   - 折叠卡片 toggleCard
   - 复制到剪贴板 copyText
   - 全局错误总线 $dbpError（启动期 + 运行时统一收集）
     每条: { phase, plugin, url, message, stack, time, fatal }
   - 无严格校验：调用方传啥都接，缺失字段自动补全
   ======================================== */
(function (global) {
  'use strict';

  global.DBP = global.DBP || { version: '0.9.20', pages: {}, routes: [], nav: [] };
  global.DBP.version = '0.9.20';

  // ---------- 错误总线（持久存储 · 仅保留最近 20 条） ----------
  // 单一事实源：启动期（init/app/loader/router）与运行时（window error / unhandledrejection / Vue errorHandler）
  // 全部汇入此处。
  //
  // 两类记录：
  //   live     = true   → 本次会话新产生，会驱动 app.js 的常驻错误面板（弹窗/顶栏红点/自动展开）
  //   restored = true   → 从 localStorage 恢复的上次访问记录，只出现在设置页日志里，
  //                       绝不触发弹窗（"旧的不影响弹窗"）
  // 设置页读 list()（全部，含历史）；app.js 面板读 liveList()（仅本次会话）。
  var STORE_KEY = 'dbp-error-log';
  var MAX_ERRORS = 20;
  var seq = 0;

  /* ------------------------------------------------------------
     ★ 仅供「插件文件加载失败」判定使用（plugin-loader / router 调用）。
       只有插件加载路径会据此改跳内置 404 页面；其它任何 404 仍按普通错误处理。
       普通报错里出现的行号（如 app.js:404:11）不会被误判。
     ------------------------------------------------------------ */
  function is404(x) {
    if (x && typeof x === 'object') {
      if (x.isNotFound === true || x.notFound === true || x.status === 404 || x.statusCode === 404) return true;
      if (x.message !== undefined) return is404(x.message);
      return false;
    }
    var s = String(x == null ? '' : x);
    return /HTTP\s*404|404\s*Not\s*Found|\(404\)/i.test(s);
  }
  global.DBP_is404 = is404;

  /* ------------------------------------------------------------
     ★ 304 Not Modified 是 HTTP 缓存协商的正常响应，不是错误。
       fetch 的 Response.ok 只认 2xx，304 会得到 false，必须单独放行；
       否则任何 `if (!r.ok) throw` 都会把它当成加载失败上报。
       注意：行号/列号里的 304（如 app.js:304:11）不会被误判。
     ------------------------------------------------------------ */
  function isNotModified(x) {
    if (x && typeof x === 'object') {
      if (x.status === 304 || x.statusCode === 304 || x.notModified === true) return true;
      if (x.message !== undefined) return isNotModified(x.message);
      return false;
    }
    var s = String(x == null ? '' : x);
    return /HTTP\s*304|304\s*Not\s*Modified|\(304\)/i.test(s);
  }
  global.DBP_isNotModified = isNotModified;

  /* 统一的 HTTP 成功判定：2xx 或 304 都算成功（304 无响应体，调用方需短路） */
  global.DBP_isHttpOk = function (r) {
    return !!(r && (r.ok === true || (global.DBP_isNotModified && global.DBP_isNotModified(r))));
  };

  /* ------------------------------------------------------------
     ★ 404 页面内部资源（随机壁纸 / 一言）加载失败：直接忽略。
       不进错误总线、不写历史日志、不弹错误窗、不弹 toast。
       判定严格限定在「当前确实处于 404 页面」+「带静默标记或属于
       404 专用外站」，不会影响其它页面的资源错误处理。
       早期脚本（index.html）里有一份等价内联版，因为 utils.js 尚未加载。
     ------------------------------------------------------------ */
  function in404Context() {
    try {
      if (/^#\/404\/?$/.test(String(global.location && global.location.hash || ''))) return true;
      return !!(global.document && global.document.querySelector && global.document.querySelector('.dbp-404'));
    } catch (e) { return false; }
  }
  global.DBP_isQuiet404Asset = function (target, url) {
    try {
      if (!in404Context()) return false;
      if (target && target.getAttribute && target.getAttribute('data-dbp-quiet404') !== null) return true;
      var u = String(url || (target && (target.src || target.href)) || '');
      return /loliapi\.com\/acg|v1\.hitokoto\.cn|api\.quotable\.io/i.test(u);
    } catch (e) { return false; }
  };
  global.DBP_isQuiet404Reason = function (reason) {
    try {
      if (!in404Context()) return false;
      if (reason && reason.__dbpQuiet404 === true) return true;
      return /loliapi\.com\/acg|v1\.hitokoto\.cn|api\.quotable\.io/i.test(String((reason && reason.message) || reason || ''));
    } catch (e) { return false; }
  };

  /* 仅插件加载失败时调用：改跳内置 404 页面（由 catch-all 路由渲染） */
  global.DBP_show404 = function () {
    try {
      if (global.location) {
        var h = String(global.location.hash || '');
        if (h !== '#/404' && h !== '#/404/') { global.location.hash = '#/404'; return true; }
        return false;
      }
    } catch (e) { /* 非 SPA 环境静默降级 */ }
    return false;
  };

  function clonePlain(e) {
    var c = {};
    for (var k in e) {
      if (Object.prototype.hasOwnProperty.call(e, k) && k !== 'live' && k !== 'restored' && k !== 'seq') c[k] = e[k];
    }
    return c;
  }

  function loadPersisted() {
    try {
      if (!global.localStorage) return [];
      var raw = global.localStorage.getItem(STORE_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr.slice(-MAX_ERRORS).filter(function (e) { return e && typeof e === 'object' && !isNotModified(e); }).map(function (e) {
        var c = clonePlain(e);
        c.live = false;        // ★ 历史记录不属于本次会话
        c.restored = true;     // ★ 设置页据此显示「历史」标记
        c.seq = ++seq;
        return c;
      });
    } catch (e) { return []; }
  }

  function persist() {
    try {
      if (!global.localStorage) return;
      global.localStorage.setItem(STORE_KEY, JSON.stringify(errors.slice(-MAX_ERRORS).map(clonePlain)));
    } catch (e) { /* 隐私模式 / 配额满：静默降级为纯内存 */ }
  }

  var errors = loadPersisted();

  global.$dbpError = {
    MAX: MAX_ERRORS,
    STORE_KEY: STORE_KEY,
    // 全部记录（含历史）→ 设置页日志
    list: function () { return errors.slice(); },
    // 仅本次会话 → 常驻错误面板（旧记录不会触发弹窗）
    liveList: function () { return errors.filter(function (e) { return !!e.live; }); },
    // 仅历史记录
    historyList: function () { return errors.filter(function (e) { return !e.live; }); },
    push: function (e) {
      var entry = (typeof e === 'object' && e !== null) ? e : { message: String(e) };
      // ★ 304 是缓存协商的正常响应：不记录、不持久化、不触发错误面板
      if (isNotModified(entry)) return null;
      entry.time = entry.time || new Date().toISOString();
      entry.phase = entry.phase || 'runtime';
      if (entry.message instanceof Error) entry.message = entry.message.message;
      entry.message = String(entry.message || '(无错误信息)');
      entry.live = true;
      entry.restored = false;
      entry.seq = ++seq;
      errors.push(entry);
      if (errors.length > MAX_ERRORS) errors = errors.slice(-MAX_ERRORS); // ★ 仅保留最近 20 条
      persist();
      return entry;
    },
    // 只清本次会话（面板「清除」用），保留历史日志
    clearLive: function () {
      errors = errors.filter(function (e) { return !e.live; });
      persist();
    },
    // 清全部，含持久化的历史（设置页「清除记录」用）
    clear: function () {
      errors = [];
      try { if (global.localStorage) global.localStorage.removeItem(STORE_KEY); } catch (e) {}
    },
  };

  // ---------- Toast ----------
  function ensureHost() {
    var host = document.getElementById('dbp-toast-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'dbp-toast-host';
      host.className = 'dbp-toast-host';
      (document.body || document.documentElement).appendChild(host);
    }
    return host;
  }
  function showToast(msg, type) {
    type = type || 'info';
    var host = ensureHost();
    var el = document.createElement('div');
    el.className = 'dbp-toast dbp-toast-' + type;
    var icon = type === 'error' ? 'fa-exclamation-triangle'
      : type === 'success' ? 'fa-check-circle'
      : type === 'warn' ? 'fa-exclamation-circle' : 'fa-info-circle';
    el.innerHTML = '<i class="fas ' + icon + '"></i><span></span>';
    el.querySelector('span').textContent = msg;
    host.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('show'); });
    setTimeout(function () {
      el.classList.remove('show');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 260);
    }, 3200);
    return el;
  }
  global.showAlert = function (msg, title, type) {
    if (title && typeof title === 'string' && title !== '提示' && title !== '错误' && title !== '成功') type = title;
    showToast(msg, type || 'info');
  };
  global.showToast = showToast;
  global.closeAlert = function () {};

  // ---------- 确认框 ----------
  function showConfirm(msg, onOK, onCancel) {
    var overlay = document.getElementById('modal-confirm');
    var msgEl = document.getElementById('modal-confirm-msg');
    if (!overlay || !msgEl) {
      if (window.confirm(msg)) { try { onOK && onOK(); } catch (e) {} }
      return;
    }
    msgEl.textContent = msg;
    // ★ .modal-box 默认 opacity:0 / scale(.95)，必须加 .modal-enter 才会显现
    var box = overlay.querySelector('.modal-box');
    overlay.classList.remove('closing');
    overlay.classList.add('show');
    if (box) {
      box.classList.remove('modal-enter');
      var raf = (typeof requestAnimationFrame === 'function') ? requestAnimationFrame : function (fn) { setTimeout(fn, 16); };
      raf(function () { box.classList.add('modal-enter'); });
    }
    var okBtn = document.getElementById('modal-confirm-ok');
    var cancelBtn = document.getElementById('modal-confirm-cancel');
    var closeBtn = document.getElementById('modal-confirm-close');
    function clean() {
      // 关闭动画：先加 .closing（opacity→0），动画结束再真正隐藏
      overlay.classList.add('closing');
      setTimeout(function () {
        overlay.classList.remove('show');
        overlay.classList.remove('closing');
        if (box) box.classList.remove('modal-enter');
      }, 200);
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancelFn);
      closeBtn.removeEventListener('click', onCancelFn);
    }
    function onOk() { clean(); try { onOK && onOK(); } catch (e) {} }
    function onCancelFn() { clean(); try { onCancel && onCancel(); } catch (e) {} }
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancelFn);
    closeBtn.addEventListener('click', onCancelFn);
    // ESC 关闭
    function onEsc(e) { if (e.key === 'Escape') { document.removeEventListener('keydown', onEsc); onCancelFn(); } }
    document.addEventListener('keydown', onEsc);
  }
  global.showConfirm = showConfirm;

  // ---------- 折叠卡片 ----------
  global.toggleCard = function (header) {
    var card = header && header.parentElement;
    if (card) card.classList.toggle('open');
  };

  // ============================================
  // 全局设置（localStorage 持久化 + 变更广播）
  // 放在 utils.js 是为了让 app.js 启动时就能读到（设置页本身是懒加载的）
  // ============================================
  var SETTINGS_KEY = 'dbp-settings';
  var SETTINGS_DEFAULTS = {
    theme: 'dark',              // light / dark / system
    sidebarExpandFirst: true,   // 侧边栏默认展开第一个分类
    showVersionBadge: true,     // 侧边栏显示插件版本号
    linkNewTab: true,           // 外链默认新标签打开
    pageAnim: true,             // 页面切换动画
    smoothScroll: true,         // 切换页面平滑回顶
  };

  var DBPSettings = {
    defaults: SETTINGS_DEFAULTS,
    all: function () {
      var out = {};
      try {
        var raw = localStorage.getItem(SETTINGS_KEY);
        var saved = raw ? JSON.parse(raw) : {};
        Object.keys(SETTINGS_DEFAULTS).forEach(function (k) {
          out[k] = (saved[k] !== undefined) ? saved[k] : SETTINGS_DEFAULTS[k];
        });
      } catch (e) {
        Object.keys(SETTINGS_DEFAULTS).forEach(function (k) { out[k] = SETTINGS_DEFAULTS[k]; });
      }
      return out;
    },
    get: function (key) {
      var a = DBPSettings.all();
      return (key in a) ? a[key] : undefined;
    },
    set: function (key, value) {
      var a = DBPSettings.all();
      a[key] = value;
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(a)); } catch (e) {}
      // 广播变更，让 app.js / 设置页等立即响应
      try {
        window.dispatchEvent(new CustomEvent('dbp-settings-change', { detail: { key: key, value: value, all: a } }));
      } catch (e) {}
      return a;
    },
    setMany: function (obj) {
      var a = DBPSettings.all();
      Object.keys(obj || {}).forEach(function (k) { a[k] = obj[k]; });
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(a)); } catch (e) {}
      try { window.dispatchEvent(new CustomEvent('dbp-settings-change', { detail: { key: null, value: null, all: a } })); } catch (e) {}
      return a;
    },
    // 同步主题到既有主题系统（dbp-theme），避免两套存储打架
    syncTheme: function () {
      var t = DBPSettings.get('theme');
      try { localStorage.setItem('dbp-theme', t); } catch (e) {}
      if (typeof global.applyTheme === 'function') global.applyTheme(t);
      return t;
    },
    reset: function () {
      try { localStorage.removeItem(SETTINGS_KEY); } catch (e) {}
      var a = DBPSettings.all();
      DBPSettings.syncTheme();
      try { window.dispatchEvent(new CustomEvent('dbp-settings-change', { detail: { key: null, value: null, all: a } })); } catch (e) {}
      return a;
    },
    export: function () {
      return JSON.stringify({ _dbpSettings: true, version: '0.9.20', settings: DBPSettings.all() }, null, 2);
    },
    import: function (text) {
      var data = JSON.parse(text);
      var s = data && data.settings ? data.settings : data;
      if (!s || typeof s !== 'object') throw new Error('格式不正确：缺少 settings 字段');
      var clean = {};
      Object.keys(SETTINGS_DEFAULTS).forEach(function (k) {
        if (s[k] !== undefined) clean[k] = s[k];
      });
      DBPSettings.setMany(clean);
      DBPSettings.syncTheme();
      return clean;
    },
  };
  global.DBPSettings = DBPSettings;

  // 启动时把已保存的设置应用到 DOM（body class 等）
  (function applyBodyClasses() {
    try {
      var s = DBPSettings.all();
      document.body.classList.toggle('hide-version-badge', !s.showVersionBadge);
      document.body.classList.toggle('no-page-anim', !s.pageAnim);
    } catch (e) {}
  })();

  window.addEventListener('dbp-settings-change', function (e) {
    try {
      var s = (e && e.detail && e.detail.all) || DBPSettings.all();
      document.body.classList.toggle('hide-version-badge', !s.showVersionBadge);
      document.body.classList.toggle('no-page-anim', !s.pageAnim);
    } catch (err) {}
  });

  // ---------- 复制到剪贴板 ----------
  global.copyText = function (text) {
    text = String(text == null ? '' : text);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(
        function () { showToast('已复制到剪贴板', 'success'); },
        function () { showToast('复制失败', 'error'); }
      );
    }
    try {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      showToast('已复制到剪贴板', 'success');
    } catch (e) {
      showToast('复制失败：' + e.message, 'error');
    }
  };

  console.log('[Utils] 工具函数已就绪 (v0.9.20)');

})(window);
