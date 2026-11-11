/* ========================================
   DBP-HUB · App v0.9.20
   - 主题管理（light / dark / system）
   - 无限层级可折叠分类树
   - 路由切换平滑回顶部
   - 启动期/运行时错误 → 常驻错误面板（不自动消失，可展开看完整堆栈）
   - 顶栏实时显示当前路由标题（HTML/Markdown 插件标题来源）
   ======================================== */
(function (global) {
  'use strict';

  var APP_VERSION = '0.9.20';
  global.DBP = global.DBP || { version: APP_VERSION, pages: {}, routes: [], nav: [] };
  global.DBP.version = APP_VERSION;

  // ============================================
  // 主题管理
  // ============================================
  var THEME_KEY = 'dbp-theme';
  var DEFAULT_THEME = 'system'; // ★ 默认跟随系统
  var mediaQuery = null;

  function getStoredTheme() {
    var v = null;
    try { v = localStorage.getItem(THEME_KEY); } catch (e) {}
    // ★ 从未设置过 → 跟随系统
    if (!v) { try { localStorage.setItem(THEME_KEY, DEFAULT_THEME); } catch (e) {} return DEFAULT_THEME; }
    return v;
  }
  function resolveTheme(theme) {
    if (theme === 'system') {
      if (window.matchMedia) return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
      return 'dark';
    }
    return theme === 'light' ? 'light' : 'dark';
  }

  // ★ 共享响应式主题状态：顶栏菜单与设置页读的是同一份 ref，改一处两边立刻同步
  function themeState() {
    if (!global.DBP_themeState) {
      var init = getStoredTheme();
      var base = { mode: init, resolved: resolveTheme(init) };
      global.DBP_themeState = (Vue && Vue.reactive) ? Vue.reactive(base) : base;
    }
    return global.DBP_themeState;
  }

  function applyTheme(theme) {
    var resolved = resolveTheme(theme);
    document.documentElement.setAttribute('data-theme', resolved);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolved === 'light' ? '#f5f5f5' : '#1a1a1a');
    if (document.body) {
      document.body.classList.add('theme-transition');
      clearTimeout(window.__dbpThemeTimer);
      window.__dbpThemeTimer = setTimeout(function () { document.body.classList.remove('theme-transition'); }, 350);
    }
    // ★ 同步共享状态（关键：两侧 UI 立刻一致）
    var st = themeState();
    st.mode = theme;
    st.resolved = resolved;
    window.__DBP_THEME = { current: theme, resolved: resolved };
  }
  function setTheme(theme) { try { localStorage.setItem(THEME_KEY, theme); } catch (e) {} applyTheme(theme); }
  function setupSystemListener() {
    if (mediaQuery) return;
    if (!window.matchMedia) return;
    mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    var handler = function () { if (getStoredTheme() === 'system') applyTheme('system'); };
    if (mediaQuery.addEventListener) mediaQuery.addEventListener('change', handler);
    else if (mediaQuery.addListener) mediaQuery.addListener(handler);
  }

  // ★ 导出给设置页 / init.js 使用（此前 init.js 里的 global.applyTheme 调用是空转）
  global.applyTheme = applyTheme;
  global.setTheme = setTheme;
  global.getStoredTheme = getStoredTheme;
  global.resolveTheme = resolveTheme;
  global.themeState = themeState;

  // ============================================
  // 自定义主题色（强调色）
  // ============================================
  var ACCENT_KEY = 'dbp-accent';
  var DEFAULT_ACCENT = '#3b8526';
  var ACCENT_PRESETS = [
    { name: '草方块绿', value: '#3b8526' },
    { name: '钻石青', value: '#4cc8e0' },
    { name: '下界红', value: '#c0392b' },
    { name: '末地紫', value: '#8e44ad' },
    { name: '红石橙', value: '#e67e22' },
    { name: '金锭黄', value: '#d4a017' },
    { name: '深海蓝', value: '#2980b9' },
    { name: '烈焰粉', value: '#f72585' },
  ];

  function getStoredAccent() {
    try { return localStorage.getItem(ACCENT_KEY) || DEFAULT_ACCENT; } catch (e) { return DEFAULT_ACCENT; }
  }

  // 由强调色推导配套变量（暗/亮版本），保证 hover / 边框 / 发光协调
  function applyAccent(color) {
    var c = color || DEFAULT_ACCENT;
    if (!/^#[0-9a-fA-F]{6}$/.test(c)) c = DEFAULT_ACCENT;
    var root = document.documentElement;
    root.style.setProperty('--accent', c);
    // 深色变体（用于 hover / 渐变尾端）
    root.style.setProperty('--accent-dark', shade(c, -0.28));
    // 半透明底（用于选中态背景）
    root.style.setProperty('--accent-dim', hexToRgba(c, 0.14));
    root.style.setProperty('--accent-glow', hexToRgba(c, 0.3));
    root.style.setProperty('--accent-soft', hexToRgba(c, 0.08));
    if (global.DBP_themeState) global.DBP_themeState.accent = c;
    window.__DBP_ACCENT = c;
  }
  function setAccent(color) {
    try { localStorage.setItem(ACCENT_KEY, color); } catch (e) {}
    applyAccent(color);
  }
  function clearAccent() {
    try { localStorage.removeItem(ACCENT_KEY); } catch (e) {}
    applyAccent(DEFAULT_ACCENT);
  }
  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.max(0, Math.min(255, Math.round(r + 255 * amt)));
    g = Math.max(0, Math.min(255, Math.round(g + 255 * amt)));
    b = Math.max(0, Math.min(255, Math.round(b + 255 * amt)));
    return '#' + [r, g, b].map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join('');
  }
  function hexToRgba(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  global.applyAccent = applyAccent;
  global.setAccent = setAccent;
  global.clearAccent = clearAccent;
  global.getStoredAccent = getStoredAccent;
  global.ACCENT_PRESETS = ACCENT_PRESETS;
  global.DEFAULT_ACCENT = DEFAULT_ACCENT;

  // ============================================
  // 公告系统（完整实现在 js/announcement.js，此处仅保留兼容转发）
  // —— 注意：本文件在外层作用域，不能使用 Vue 的 ref（尚未进入 setup）
  // ============================================
  var ANN_KEY = 'dbp-ann-dismissed';
  var ANN_LIST = [];

  function getDismissed() {
    try {
      var raw = localStorage.getItem(ANN_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function dismissAnnouncement(id) {
    try {
      var arr = getDismissed();
      if (arr.indexOf(id) < 0) arr.push(id);
      localStorage.setItem(ANN_KEY, JSON.stringify(arr));
    } catch (e) {}
  }
  function isAnnDismissed(id) { return getDismissed().indexOf(id) >= 0; }

  global.getAnnouncements = function () { return ANN_LIST.slice(); };
  global.dismissAnnouncement = dismissAnnouncement;
  global.isAnnDismissed = isAnnDismissed;
  global.ANN_LIST = ANN_LIST;

  // ============================================
  // BP_START_APP
  // ============================================
  var APP_STARTED = false;

  global.BP_START_APP = function () {
    if (APP_STARTED) { console.warn('[App] BP_START_APP 已调用过，跳过'); return; }

    // 错误收集函数：定义在 try 外，确保 Vue 解构失败时仍可用（防空白屏）
    var startupErrors = null;
    var startupFatal = null;
    function reportStartup(phase, err, fatal) {
      var entry = {
        phase: phase, plugin: null, url: null,
        message: (err && err.message) ? err.message : String(err),
        stack: (err && err.stack) ? String(err.stack) : (new Error().stack || ''),
        time: new Date().toISOString(), fatal: !!fatal,
      };
      console.error('[App] [' + phase + ']', entry.message);
      if (startupErrors && startupErrors.value !== undefined) startupErrors.value = startupErrors.value.concat([entry]);
      if (global.$dbpError && global.$dbpError.push) global.$dbpError.push(entry);
      if (fatal && startupFatal) startupFatal.value = true;
    }

    if (typeof global.Vue === 'undefined') {
      reportStartup('init', new Error('Vue 框架未加载，请检查 vendor/vue.global.prod.js 是否存在'), true);
      return;
    }

    APP_STARTED = true;
    console.log('[App] 开始创建应用 (v' + APP_VERSION + ')...');

    try {
      var Vue = global.Vue;
      var ref = Vue.ref;
      var computed = Vue.computed;
      var reactive = Vue.reactive;
      var onMounted = Vue.onMounted;

      startupErrors = ref([]);
      startupFatal = ref(false);

      var router = global.createRouter();
      if (!router) throw new Error('路由创建失败（createRouter 未定义或 VueRouter 未加载）');

      var categories = reactive((global.getCategories && global.getCategories()) || []);
      var expandedState = reactive({});

      (function initDefaultExpand() {
        var first = true;
        categories.forEach(function (cat) {
          if (cat.type === 'folder') { expandedState[cat.id] = first; first = false; }
        });
      })();

      function toggleCategory(catId) {
        var cur = !!expandedState[catId];
        delete expandedState[catId];
        expandedState[catId] = !cur;
      }
      function isExpanded(catId) { return !!expandedState[catId]; }

      var statsInfo = computed(function () {
        var plugins = (global.getPlugins && global.getPlugins()) || [];
        var totalCats = 0;
        function countFolders(nodes) {
          (nodes || []).forEach(function (n) {
            if (n.type === 'folder') { totalCats++; if (n.children) countFolders(n.children); }
          });
        }
        countFolders(categories);
        var totalLinks = plugins.filter(function (p) { return p.type === 'link'; }).length;
        return { totalPlugins: plugins.length - totalLinks, totalLinks: totalLinks, totalCats: totalCats };
      });

      // 早期错误纳入面板
      var early = (global.__DBP_EARLY_ERRORS || []).map(function (e) {
        return { phase: 'early', plugin: null, url: e.src || null, message: e.msg, stack: '', time: e.time || new Date().toISOString(), fatal: false };
      }).filter(function (e) {
        // ★ 304 是缓存协商的正常响应，不进错误面板
        return !(global.DBP_isNotModified && global.DBP_isNotModified(e.message));
      });
      startupErrors.value = startupErrors.value.concat(early);

      var runtimeErrors = ref([]);
      function syncRuntimeErrors() {
        // ★ 只读本次会话错误：从 localStorage 恢复的历史记录只进设置页日志，
        //   绝不进入常驻错误面板（"旧的不影响弹窗"）
        var bus = global.$dbpError;
        var list = bus ? ((bus.liveList ? bus.liveList() : bus.list()) || []) : [];
        runtimeErrors.value = list.slice();
      }
      setInterval(syncRuntimeErrors, 500);
      syncRuntimeErrors();

      var App = {
        template: global.DBP_APP_TEMPLATE,
        setup: function () {
          // ★ 就近定义生命周期钩子 + 降级兜底：杜绝 "onMounted is not defined"
          var onMounted = Vue.onMounted || function (fn) { Vue.nextTick(fn); };
          var sidebarCollapsed = ref(false);
          var mobileSidebarOpen = ref(false);
          var searchQuery = ref('');
          var menuOpen = ref(false);
          var isLoading = ref(false);

          var currentTheme = getStoredTheme();
          applyTheme(currentTheme); // ★ 内部会写入共享状态
          setupSystemListener();
          // ★ 读共享状态（不是本地 ref）：设置页改主题，菜单这里会立刻跟着变
          var themeMode = computed(function () { return themeState().mode; });
          var resolvedTheme = computed(function () { return themeState().resolved; });

          // ★ 顶栏实时标题：JS/HTML/Markdown 所有插件标题统一由 route.meta.title 驱动
          var pageTitle = ref('');
          var pageIcon = ref('fas fa-cube');
          function syncPageTitle() {
            var r = (router && router.currentRoute) ? router.currentRoute.value : null;
            pageTitle.value = (r && r.meta && r.meta.title) || '';
            pageIcon.value = (r && r.meta && r.meta.icon) || 'fas fa-cube';
          }

          function changeTheme(mode) {
            setTheme(mode); // ★ applyTheme 内部更新共享状态 → 菜单与设置页同时刷新
          }
          function getThemeIcon() {
            if (themeMode.value === 'light') return 'fas fa-sun';
            if (themeMode.value === 'system') return 'fas fa-desktop';
            return 'fas fa-moon';
          }
          function getThemeLabel() {
            if (themeMode.value === 'light') return '亮色模式';
            if (themeMode.value === 'system') return '跟随系统';
            return '暗色模式';
          }

          var flatNavItems = computed(function () {
            var plugins = (global.getPlugins && global.getPlugins()) || [];
            return plugins.map(function (p) {
              return { id: p.id, path: p.path, title: p.title, icon: p.icon || 'fas fa-cube', badge: p.badge || '', badgeClass: p.badgeClass || '' };
            });
          });

          var filteredCategories = computed(function () {
            var q = (searchQuery.value || '').toLowerCase().trim();
            if (!q) return categories;
            function filterNode(nodes) {
              return nodes.map(function (n) {
                var node = Object.assign({}, n);
                if (n.type === 'folder' && n.children) {
                  node.children = filterNode(n.children);
                  var selfMatch = (n.title || '').toLowerCase().indexOf(q) !== -1;
                  if (selfMatch || node.children.length > 0) { expandedState[n.id] = true; return node; }
                  return null;
                }
                if (n.type === 'plugin') {
                  var match = ((n.title || '').toLowerCase().indexOf(q) !== -1) || ((n.id || '').toLowerCase().indexOf(q) !== -1);
                  return match ? node : null;
                }
                // ★ 外链也参与搜索（匹配标题 / id / url）
                if (n.type === 'link') {
                  var m2 = ((n.title || '').toLowerCase().indexOf(q) !== -1)
                       || ((n.id || '').toLowerCase().indexOf(q) !== -1)
                       || ((n.url || '').toLowerCase().indexOf(q) !== -1);
                  return m2 ? node : null;
                }
                return null;
              }).filter(function (n) { return n !== null; });
            }
            return filterNode(categories);
          });

          function toggleSidebar() {
            if (window.innerWidth < 768) mobileSidebarOpen.value = !mobileSidebarOpen.value;
            else sidebarCollapsed.value = !sidebarCollapsed.value;
          }
          function closeMobileSidebar() { mobileSidebarOpen.value = false; }
          function goHome() { if (router) router.push('/home'); closeMobileSidebar(); menuOpen.value = false; }

          // ★ 安全回顶：scrollTo 在部分环境/元素上不存在，做能力检测 + scrollTop 兜底
          function scrollToTop() {
            try {
              var main = document.querySelector('.main-content');
              if (main && typeof main.scrollTo === 'function') { main.scrollTo({ top: 0, behavior: 'smooth' }); return; }
              if (main && 'scrollTop' in main) { main.scrollTop = 0; return; }
              if (typeof window.scrollTo === 'function') { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
              if ('scrollTop' in document.documentElement) document.documentElement.scrollTop = 0;
            } catch (e) { /* 滚动失败不影响页面渲染 */ }
          }

          if (router) {
            router.beforeEach(function (to, from, next) { isLoading.value = true; next(); });
            router.afterEach(function (to, from) {
              isLoading.value = false;
              scrollToTop();
              syncPageTitle();
              syncRuntimeErrors();
            });
          }

          // 打开菜单：若内容超高可滚动，每次打开都回到顶部（避免残留上次滚动位置）
          function resetMenuScroll() {
            var menu = document.getElementById('topbar-menu');
            if (menu && 'scrollTop' in menu) menu.scrollTop = 0;
          }
          function toggleMenu() {
            menuOpen.value = !menuOpen.value;
            if (menuOpen.value) {
              if (Vue.nextTick) Vue.nextTick(resetMenuScroll);
              else setTimeout(resetMenuScroll, 0);
            }
          }
          function closeMenu() { menuOpen.value = false; }

          // ★ 彩蛋：引擎与事件表都不随首屏加载，只有点「千万别点」才注入
          var eggLoading = false;
          function triggerEasterEgg() {
            if (global.DBP_EASTER_EGG && global.DBP_EASTER_EGG.trigger) {
              global.DBP_EASTER_EGG.trigger();
              return;
            }
            if (eggLoading) return;
            eggLoading = true;
            var s = document.createElement('script');
            s.src = './js/easter-egg.js?v=' + APP_VERSION;
            s.onload = function () {
              eggLoading = false;
              if (global.DBP_EASTER_EGG && global.DBP_EASTER_EGG.trigger) global.DBP_EASTER_EGG.trigger();
            };
            s.onerror = function () {
              eggLoading = false;
              if (global.showToast) global.showToast('彩蛋引擎加载失败', 'error');
            };
            document.head.appendChild(s);
          }

          function handleMenu(action) {
            menuOpen.value = false;
            switch (action) {
              case 'home': goHome(); break;
              case 'wiki': window.open('https://zh.minecraft.wiki/', '_blank', 'noopener'); break;
              case 'copy':
                if (navigator.clipboard) navigator.clipboard.writeText(window.location.href).then(function () { global.showToast('链接已复制', 'success'); });
                break;
              case 'about': if (router) router.push('/about'); break;
              // ★ 框架内置设置页（不是插件，路由由 router.js 内置注册）
              case 'settings': if (router) router.push('/settings'); break;
              // ★ 彩蛋：首次点击才动态加载引擎，引擎再 fetch 事件表
              case 'egg': triggerEasterEgg(); break;
              case 'reset':
                if (global.$dbpError && global.$dbpError.clear) global.$dbpError.clear();
                startupErrors.value = [];
                syncRuntimeErrors();
                global.showToast('错误记录已清除', 'success');
                break;
            }
          }

          // ---------- 常驻错误面板 ----------
          // ★ 空值防御：startup/runtime 任一为 undefined 也不至于让渲染函数炸 .length
          var allErrors = computed(function () {
            var seen = {}, out = [];
            ((startupErrors.value || []).concat(runtimeErrors.value || [])).forEach(function (e) {
              if (!e) return;
              var k = e.seq ? 's' + e.seq : null;   // 同一 entry 对象在两处出现时按 seq 去重
              if (k) { if (seen[k]) return; seen[k] = 1; }
              out.push(e);
            });
            return out;
          });
          var errorCount = computed(function () { return (allErrors.value || []).length; });
          // ★ 启动即有错误 → 默认展开，避免用户只看到一条窄条以为"没提示"
          var errorExpanded = ref(errorCount.value > 0);
          // ★ 运行中新出现错误 → 自动展开，保证"触发了就看得见"
          if (Vue.watch) {
            Vue.watch(errorCount, function (n) { if (n > 0) errorExpanded.value = true; });
          }
          var fatalError = computed(function () { return allErrors.value.find(function (e) { return e.fatal; }) || null; });
          var errorSummary = computed(function () {
            var n = errorCount.value;
            if (!n) return '';
            var phases = {};
            allErrors.value.forEach(function (e) { phases[e.phase] = (phases[e.phase] || 0) + 1; });
            return Object.keys(phases).map(function (k) { return k + ':' + phases[k]; }).join(' / ');
          });

          function dismissError(idx) {
            var e = allErrors.value[idx];
            if (e && !e.fatal) {
              var remaining = allErrors.value.filter(function (_, i) { return i !== idx; });
              if (global.$dbpError) {
                if (global.$dbpError.clearLive) global.$dbpError.clearLive();
                else global.$dbpError.clear();
                remaining.forEach(function (x) { global.$dbpError.push(x); });
              }
              startupErrors.value = startupErrors.value.filter(function (_, i) { return i !== idx || (startupErrors.value[i] && startupErrors.value[i].fatal); });
              syncRuntimeErrors();
            }
          }
          function dismissAllErrors() {
            if (fatalError.value) { global.showToast('存在致命错误，请刷新页面', 'warn'); return; }
            var bus = global.$dbpError;
            if (bus && bus.clearLive) bus.clearLive();
            else if (bus && bus.clear) bus.clear();
            startupErrors.value = [];
            syncRuntimeErrors();
          }
          function copyAllErrors() {
            var text = 'DBP-HUB v' + APP_VERSION + ' 错误报告\n';
            text += '时间: ' + new Date().toISOString() + '\n';
            text += '主题: ' + themeMode.value + '\n';
            text += '用户代理: ' + navigator.userAgent + '\n\n';
            allErrors.value.forEach(function (e, i) {
              text += '[' + (i + 1) + '] ' + (e.phase || '?').toUpperCase() + (e.plugin ? ' @' + e.plugin : '') + '\n';
              text += '  消息: ' + e.message + '\n';
              if (e.url) text += '  URL: ' + e.url + '\n';
              if (e.stack) text += '  堆栈:\n' + e.stack + '\n';
              text += '  时间: ' + e.time + '\n\n';
            });
            global.copyText(text);
          }
          function retryAfterError() { window.location.reload(); }

          global.appRouter = router;

          onMounted(function () {
            syncPageTitle();
            document.addEventListener('click', function (e) {
              var menu = document.getElementById('topbar-menu');
              var btn = document.getElementById('topbar-menu-btn');
              if (menu && btn && !menu.contains(e.target) && !btn.contains(e.target)) menuOpen.value = false;
            });
            document.addEventListener('keydown', function (e) {
              if (e.key === 'Escape') { menuOpen.value = false; mobileSidebarOpen.value = false; errorExpanded.value = false; }
            });
          });

          return {
            sidebarCollapsed: sidebarCollapsed, mobileSidebarOpen: mobileSidebarOpen,
            searchQuery: searchQuery, menuOpen: menuOpen, isLoading: isLoading,
            pageTitle: pageTitle, pageIcon: pageIcon,
            themeMode: themeMode, resolvedTheme: resolvedTheme,
            categories: categories, filteredCategories: filteredCategories,
            flatNavItems: flatNavItems, statsInfo: statsInfo,
            expandedState: expandedState,
            toggleCategory: toggleCategory, isExpanded: isExpanded,
            toggleSidebar: toggleSidebar, closeMobileSidebar: closeMobileSidebar,
            goHome: goHome, toggleMenu: toggleMenu, closeMenu: closeMenu, handleMenu: handleMenu,
            changeTheme: changeTheme, getThemeIcon: getThemeIcon, getThemeLabel: getThemeLabel,
            // 错误面板
            startupErrors: startupErrors, runtimeErrors: runtimeErrors, allErrors: allErrors,
            errorCount: errorCount,
            fatalError: fatalError, errorSummary: errorSummary, errorExpanded: errorExpanded,
            dismissError: dismissError, dismissAllErrors: dismissAllErrors,
            copyAllErrors: copyAllErrors, retryAfterError: retryAfterError, reportStartup: reportStartup,
          };
        },
      };

      var app = Vue.createApp(App);

      // ★ 关键：Vue 3 只认 app.config.errorHandler，不 fallback 到 Vue.config.errorHandler。
      //   不在这里挂的话，@click 等事件里抛的错在 prod 下只进 console，永远不会进错误面板。
      app.config.errorHandler = function (err, instance, info) {
        try {
          // ★ 404 页面壁纸 / 一言相关异常：静默忽略，不弹窗、不记录
          if (global.DBP_isQuiet404Reason && global.DBP_isQuiet404Reason(err)) return;
          if (global.$dbpError && global.$dbpError.push) {
            global.$dbpError.push({
              phase: 'render',
              plugin: (instance && instance.$options && instance.$options.name) || null,
              url: String(info || ''),
              message: (err && err.message) ? err.message : String(err),
              stack: (err && err.stack) ? String(err.stack) : '',
              time: new Date().toISOString(),
              fatal: false,
            });
          }
        } catch (e) { /* 上报失败也不能影响运行 */ }
        console.error('[Vue] ' + String(info || '') + ':', err);
      };

      // ★ 安全网：Vue3 模板编译器只把 Math/Date/JSON 等列入全局白名单，
      //   window / document / navigator / localStorage 等都不在其中，
      //   插件模板里写 window.xxx 会被编译成 _ctx.window.xxx → 运行时报错。
      //   这里统一挂到 globalProperties，让这些全局在任意插件模板中都能安全使用。
      ['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'location', 'fetch'].forEach(function (k) {
        try { if (global[k] !== undefined) app.config.globalProperties[k] = global[k]; } catch (e) { /* 忽略不可访问项 */ }
      });
      if (global.DBP_CATEGORY_TREE_COMPONENT) app.component('CategoryTree', global.DBP_CATEGORY_TREE_COMPONENT);
      if (global.DBP_HOME_CATEGORY_NODE) app.component('HomeCategoryNode', global.DBP_HOME_CATEGORY_NODE);
      app.use(router);
      app.mount('#app-root');
      console.log('[App] ✓ Vue 应用已挂载 (v' + APP_VERSION + ')');
    } catch (err) {
      console.error('[App] 致命错误:', err);
      reportStartup('init', err, true);
    }
  };

  global.DBP_VERSION = APP_VERSION;
  global.getAppVersion = function () { return APP_VERSION; };

  // ============================================
  // 根模板
  // ============================================
  global.DBP_APP_TEMPLATE = `
  <div id="app" :class="{ 'sidebar-collapsed': sidebarCollapsed, 'mobile-sidebar-open': mobileSidebarOpen }">
    <header class="topbar">
      <div class="topbar-left">
        <button class="topbar-btn topbar-burger" @click="toggleSidebar" title="切换侧边栏">
          <i class="fas fa-bars"></i>
        </button>
        <div class="topbar-brand" @click="goHome" title="返回首页">
          <i class="fas fa-cube" style="color:var(--accent);"></i>
          <span class="brand-text">DBP-HUB</span>
        </div>
        <!-- ★ 当前页面标题（HTML/Markdown/JS 插件标题统一显示在此，无需插件自带导航栏） -->
        <div v-if="pageTitle" class="topbar-page-title" :title="pageTitle">
          <i :class="pageIcon" style="color:var(--accent);font-size:13px;"></i>
          <span>{{ pageTitle }}</span>
        </div>
      </div>
      <div class="topbar-right">
        <div v-if="isLoading" class="topbar-loading" title="正在加载插件...">
          <i class="fas fa-cube fa-spin" style="font-size:12px;color:var(--accent);"></i>
        </div>
        <button v-if="errorCount" class="topbar-btn topbar-err-btn" :class="{ 'has-fatal': fatalError }" @click="errorExpanded = !errorExpanded" title="查看错误详情">
          <i class="fas" :class="fatalError ? 'fa-times-circle' : 'fa-exclamation-triangle'"></i>
          <span class="topbar-err-count">{{ errorCount }}</span>
        </button>
        <button class="topbar-btn" id="topbar-menu-btn" @click.stop="toggleMenu" title="菜单">
          <i class="fas fa-ellipsis-v"></i>
        </button>
        <div class="topbar-dropdown" id="topbar-menu" :class="{ 'open': menuOpen }">
          <div class="dropdown-group">
            <div class="dropdown-group-title">导航</div>
            <a href="javascript:void(0)" class="dropdown-item" @click="handleMenu('home')"><i class="fas fa-home"></i><span>返回主页</span></a>
            <a href="javascript:void(0)" class="dropdown-item" @click="handleMenu('wiki')"><i class="fas fa-book"></i><span>Minecraft Wiki</span><i class="fas fa-external-link-alt dropdown-ext"></i></a>
          </div>
          <div class="dropdown-divider"></div>
          <div class="dropdown-group">
            <div class="dropdown-group-title">主题</div>
            <a href="javascript:void(0)" class="dropdown-item" @click="changeTheme('light')" :style="themeMode==='light' ? 'color:var(--accent);background:var(--accent-dim)' : ''"><i class="fas fa-sun"></i><span>亮色模式</span><i class="fas fa-check dropdown-ext" v-if="themeMode==='light'"></i></a>
            <a href="javascript:void(0)" class="dropdown-item" @click="changeTheme('dark')" :style="themeMode==='dark' ? 'color:var(--accent);background:var(--accent-dim)' : ''"><i class="fas fa-moon"></i><span>暗色模式</span><i class="fas fa-check dropdown-ext" v-if="themeMode==='dark'"></i></a>
            <a href="javascript:void(0)" class="dropdown-item" @click="changeTheme('system')" :style="themeMode==='system' ? 'color:var(--accent);background:var(--accent-dim)' : ''"><i class="fas fa-desktop"></i><span>跟随系统</span><i class="fas fa-check dropdown-ext" v-if="themeMode==='system'"></i></a>
          </div>
          <div class="dropdown-divider"></div>
          <div class="dropdown-group" v-if="errorCount">
            <div class="dropdown-group-title">错误 ({{ errorCount }})</div>
            <a href="javascript:void(0)" class="dropdown-item" @click="copyAllErrors"><i class="fas fa-copy"></i><span>复制全部错误</span></a>
            <a href="javascript:void(0)" class="dropdown-item" @click="dismissAllErrors" :style="fatalError ? 'opacity:.5;pointer-events:none;' : ''"><i class="fas fa-check-double"></i><span>{{ fatalError ? '存在致命错误' : '清除错误' }}</span></a>
          </div>
          <div class="dropdown-divider"></div>
          <div class="dropdown-group">
            <div class="dropdown-group-title">系统</div>
            <a href="javascript:void(0)" class="dropdown-item" @click="handleMenu('settings')"><i class="fas fa-sliders-h"></i><span>设置</span></a>
            <a href="javascript:void(0)" class="dropdown-item" @click="handleMenu('about')"><i class="fas fa-info-circle"></i><span>关于</span></a>
            <a href="javascript:void(0)" class="dropdown-item egg-item" @click="handleMenu('egg')" title="真的别点"><i class="fas fa-skull"></i><span>千万别点</span><i class="fas fa-dice dropdown-ext"></i></a>
          </div>
        </div>
      </div>
    </header>

    <!-- ★ 常驻错误面板：有错误时一直显示（不自动消失），展开可看 phase/plugin/url/stack/time -->
    <transition name="err-slide">
      <div v-if="errorCount" class="dbp-error-panel" :class="{ 'is-fatal': fatalError, 'is-expanded': errorExpanded }">
        <div class="dbp-error-bar" @click="errorExpanded = !errorExpanded">
          <i class="fas" :class="fatalError ? 'fa-times-circle' : 'fa-exclamation-triangle'"></i>
          <span class="dbp-error-title">{{ fatalError ? '致命错误 — 请刷新页面' : '检测到错误' }}</span>
          <span class="dbp-error-count">{{ errorCount }} 条</span>
          <span class="dbp-error-summary">{{ errorSummary }}</span>
          <div class="dbp-error-actions" @click.stop>
            <button class="dbp-error-btn" @click="copyAllErrors" title="复制完整错误报告"><i class="fas fa-copy"></i></button>
            <button v-if="fatalError" class="dbp-error-btn" @click="retryAfterError" title="刷新页面"><i class="fas fa-redo"></i></button>
            <button v-else class="dbp-error-btn" @click="dismissAllErrors" :style="fatalError ? 'opacity:.5;pointer-events:none;' : ''" title="清除全部（致命错误时禁用）"><i class="fas fa-times"></i></button>
          </div>
          <i class="fas dbp-error-chevron" :class="errorExpanded ? 'fa-chevron-down' : 'fa-chevron-up'"></i>
        </div>
        <div v-if="errorExpanded" class="dbp-error-details">
          <div v-for="(e, idx) in allErrors" :key="idx" class="dbp-error-item" :class="{ 'is-fatal-item': e.fatal }">
            <div class="dbp-error-item-head">
              <span class="dbp-error-phase" :class="'phase-' + (e.phase || '?')">{{ (e.phase || '?').toUpperCase() }}</span>
              <span v-if="e.plugin" class="dbp-error-plugin">@{{ e.plugin }}</span>
              <span v-if="e.url" class="dbp-error-url" :title="e.url">{{ e.url }}</span>
              <span class="dbp-error-time">{{ e.time }}</span>
              <span v-if="e.fatal" class="dbp-error-fatal-badge">FATAL</span>
              <button v-if="!e.fatal" class="dbp-error-btn-sm" @click="dismissError(idx)" title="关闭此条"><i class="fas fa-times"></i></button>
            </div>
            <div class="dbp-error-msg">{{ e.message }}</div>
            <pre v-if="e.stack" class="dbp-error-stack">{{ e.stack }}</pre>
          </div>
        </div>
      </div>
    </transition>

    <div class="mobile-overlay" :class="{ 'open': mobileSidebarOpen }" @click="closeMobileSidebar"></div>

    <aside class="sidebar" :class="{ 'mobile-open': mobileSidebarOpen }">
      <div class="sidebar-header">
        <div class="logo-icon"><i class="fas fa-cube"></i></div>
        <div>
          <div class="logo-text">DBP-HUB</div>
          <div class="logo-sub">Minecraft 工具站 v${APP_VERSION}</div>
        </div>
      </div>
      <div class="sidebar-search">
        <i class="fas fa-search search-icon"></i>
        <input type="text" placeholder="搜索功能..." v-model="searchQuery" />
      </div>
      <nav class="sidebar-nav">
        <category-tree
          v-for="(cat, ci) in filteredCategories"
          :key="cat.id || ci"
          :node="cat" :depth="0"
          :expanded-state="expandedState"
          :toggle-category="toggleCategory"
          :is-expanded="isExpanded"
          :close-mobile="closeMobileSidebar"
        ></category-tree>
      </nav>
      <div class="sidebar-footer">
        <span>DBP-HUB v${APP_VERSION}</span><br>
        <span>{{ statsInfo.totalPlugins }} 个工具<span v-if="statsInfo.totalLinks"> / {{ statsInfo.totalLinks }} 个外链</span> / {{ statsInfo.totalCats }} 个分类</span>
      </div>
    </aside>

    <main class="main-content" @click="closeMobileSidebar">
      <router-view v-slot="{ Component }">
        <transition name="page-fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
  </div>
  `;

  // ============================================
  // 递归分类树组件
  // ============================================
  global.DBP_CATEGORY_TREE_COMPONENT = {
    name: 'CategoryTree',
    props: {
      node: { type: Object, required: true },
      depth: { type: Number, default: 0 },
      expandedState: { type: Object, required: true },
      toggleCategory: { type: Function, required: true },
      isExpanded: { type: Function, required: true },
      closeMobile: { type: Function, default: function () {} },
    },
    template: `
      <div class="cat-node" :class="{ 'cat-folder': node.type==='folder', 'cat-plugin': node.type==='plugin' }">
        <div v-if="node.type === 'folder'"
             class="cat-folder-header"
             :class="{ 'open': isExpanded(node.id) }"
             :style="{ paddingLeft: (12 + depth * 16) + 'px' }"
             @click="onToggle">
          <i class="cat-arrow" :class="isExpanded(node.id) ? 'fas fa-chevron-down' : 'fas fa-chevron-right'"></i>
          <i class="cat-icon" :class="node.icon || 'fas fa-folder'"></i>
          <span class="cat-title">{{ node.title }}</span>
          <span class="cat-count" v-if="countChildren(node) > 0">{{ countChildren(node) }}</span>
        </div>
        <transition-group name="cat-children-fade" tag="div" class="cat-children" v-if="node.type === 'folder'">
          <category-tree
            v-for="(child, idx) in (node.children || [])"
            v-show="isExpanded(node.id)"
            :key="child.id || idx"
            :node="child" :depth="depth + 1"
            :expanded-state="expandedState"
            :toggle-category="toggleCategory"
            :is-expanded="isExpanded"
            :close-mobile="closeMobile"
          ></category-tree>
        </transition-group>
        <a v-if="node.type === 'plugin'"
           :href="'#'+node.path"
           class="nav-item cat-plugin-item"
           :style="{ paddingLeft: (12 + depth * 16 + 20) + 'px' }"
           @click="closeMobile">
          <i class="nav-icon" :class="node.icon || 'fas fa-cube'"></i>
          <span class="nav-label">{{ node.title }}</span>
          <span v-if="node.badge" class="nav-badge" :class="node.badgeClass">{{ node.badge }}</span>
          <span v-if="node.version && node.version !== '0.0.0'" class="nav-version" :title="'插件版本: v'+node.version">v{{ node.version }}</span>
        </a>
        <a v-if="node.type === 'link'"
           :href="node.url"
           :target="node.target || '_blank'"
           rel="noopener noreferrer"
           class="nav-item cat-plugin-item cat-link-item"
           :style="{ paddingLeft: (12 + depth * 16 + 20) + 'px' }"
           :title="node.url"
           @click="onLinkClick(node)">
          <i class="nav-icon" :class="node.icon || 'fas fa-external-link-alt'"></i>
          <span class="nav-label">{{ node.title }}</span>
          <i class="fas fa-arrow-up-right-from-square nav-link-ext"></i>
          <span v-if="node.badge" class="nav-badge" :class="node.badgeClass">{{ node.badge }}</span>
        </a>
      </div>
    `,
    methods: {
      onToggle: function (e) {
        e.preventDefault(); e.stopPropagation();
        if (typeof this.toggleCategory === 'function') this.toggleCategory(this.node.id);
      },
      // ★ 外链：交给原生 <a> 跳转（target 由 node.target 决定），这里只收起移动端侧边栏
      onLinkClick: function (node) {
        if (typeof this.closeMobile === 'function') this.closeMobile();
        if (!node || !node.url) return;
        console.log('[Nav] ↗ 打开外链: ' + node.title + ' → ' + node.url);
      },
      countChildren: function (node) {
        if (!node.children) return 0;
        var count = 0, self = this;
        node.children.forEach(function (c) {
          if (c.type === 'plugin' || c.type === 'link') count++;
          else if (c.type === 'folder') count += self.countChildren(c);
        });
        return count;
      },
    },
  };

  console.log('[App] BP_START_APP 已注册 (v' + APP_VERSION + ')');

})(window);
