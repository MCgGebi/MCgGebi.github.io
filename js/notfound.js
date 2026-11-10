/* ==========================================================
   DBP-HUB · 框架内置 404 页面（融入主页，不是插件） v0.9.20
   ----------------------------------------------------------
   - 默认「沉浸式」：与独立 404.html 同款视觉与行为
       · loliapi 随机壁纸（?type=json 取 imgurl，原图链接与显示严格同一 URL）
       · 外部一言 hitokoto / quotable 备源 / 本地兜底，带出处，6s 轮换
       · 图片源默认隐藏，悬浮「原图」才浮出气泡，可点击 / Ctrl+点 复制
       · mini 底栏、帮助小窗、面包屑、26px 主操作按钮
     ★ 作用域限定在主内容区：position:absolute inset:0，
       顶栏与侧边栏保持可见，不会遮挡主页导航
   - 可切回「极简」：旧版纯文字 404（原 router.js catch-all 模板）
   - 配置项：localStorage['dbp-404-style'] = immersive | minimal
     设置页「外观与主题 → 404 页面样式」可即时切换
   - 全局：DBP_404Style（响应式）+ DBP_NOTFOUND_COMPONENT
   ========================================================== */
(function (global) {
  'use strict';

  var Vue = global.Vue;
  var ref = Vue && Vue.ref;
  var computed = Vue && Vue.computed;
  var reactive = Vue && Vue.reactive;

  var STORAGE_KEY = 'dbp-404-style';
  var DEFAULT_MODE = 'immersive';
  var API = 'https://www.loliapi.com/acg/';
  var FALLBACK = './assets/hero-bg.webp';
  var QUOTE_MS = 6000;
  var HITOKOTO = 'https://v1.hitokoto.cn/?c=i&c=j';
  var QUOTABLE = 'https://api.quotable.io/random';

  /* ---------------- 配置 store（响应式，设置页与组件共享） -------------- */
  function readMode() {
    try {
      var v = global.localStorage && global.localStorage.getItem(STORAGE_KEY);
      return (v === 'immersive' || v === 'minimal') ? v : DEFAULT_MODE;
    } catch (e) { return DEFAULT_MODE; }
  }

  var state = reactive ? reactive({ mode: readMode() }) : { mode: readMode() };

  global.DBP_404Style = {
    state: state,
    DEFAULT: DEFAULT_MODE,
    STORAGE_KEY: STORAGE_KEY,
    get: function () { return state.mode; },
    set: function (m) {
      if (m !== 'immersive' && m !== 'minimal') m = DEFAULT_MODE;
      state.mode = m;
      try { if (global.localStorage) global.localStorage.setItem(STORAGE_KEY, m); } catch (e) {}
      if (global.showToast) {
        global.showToast('404 页面样式已切换：' + (m === 'immersive' ? '沉浸式' : '极简'), 'success');
      }
      return m;
    },
  };

  /* ---------------- 404 液态玻璃：透明度 / 模糊度（均可配置） ----------------
     glass = 顶栏玻璃底色不透明度%，越小越通透；blur = backdrop-filter 模糊半径 px。
     两项都是默认时（30 / 20）不写任何内联变量，完全由 styles/main.css 的
     var() 兜底值决定 —— 开发者直接手写 CSS 即可生效；设置页调过后才覆盖。
     ------------------------------------------------------------------------ */
  var GLASS_KEY = 'dbp-404-glass';
  var BLUR_KEY = 'dbp-404-blur';
  var GLASS_DEFAULT = 30;
  var BLUR_DEFAULT = 20;
  var VARS = [
    '--dbp404-glass-topbar', '--dbp404-glass-sidebar', '--dbp404-glass-menu',
    '--dbp404-glass-topbar-l', '--dbp404-glass-sidebar-l', '--dbp404-glass-menu-l',
    '--dbp404-glass-sheen', '--dbp404-glass-sheen-l',
    '--dbp404-blur'
  ];
  function clampNum(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function readInt(key, def, lo, hi) {
    try {
      var raw = global.localStorage && global.localStorage.getItem(key);
      if (raw === null || raw === undefined || raw === '') return def;
      var n = parseInt(raw, 10);
      return isNaN(n) ? def : clampNum(n, lo, hi);
    } catch (e) { return def; }
  }
  function makeRgba(r, g, b, a) {
    return 'rgba(' + r + ',' + g + ',' + b + ',' + clampNum(a, 0.02, 0.95).toFixed(3) + ')';
  }
  function applyAll(g, b) {
    try {
      var root = global.document && global.document.documentElement;
      if (!root) return;
      // 全部默认 → 清空内联变量，交还 CSS 手写值
      if (g === GLASS_DEFAULT && b === BLUR_DEFAULT) {
        VARS.forEach(function (k) { root.style.removeProperty(k); });
        return;
      }
      var base = g / 100;
      var vals = [
        makeRgba(14, 19, 27, base),            // 暗色顶栏
        makeRgba(14, 19, 27, base - 0.04),     // 暗色侧栏（略透）
        makeRgba(16, 21, 30, base + 0.10),     // 暗色菜单（略实）
        makeRgba(255, 255, 255, base + 0.14),  // 亮色顶栏
        makeRgba(255, 255, 255, base + 0.10),  // 亮色侧栏
        makeRgba(255, 255, 255, base + 0.32),  // 亮色菜单
        clampNum(base * 0.57, 0.02, 0.6).toFixed(3),        // 暗色高光强度
        clampNum(base * 1.4, 0.05, 0.85).toFixed(3),        // 亮色高光强度
        b + 'px'
      ];
      VARS.forEach(function (k, i) { root.style.setProperty(k, vals[i]); });
    } catch (e) {}
  }
  var glassState = reactive
    ? reactive({ value: readInt(GLASS_KEY, GLASS_DEFAULT, 5, 80), blur: readInt(BLUR_KEY, BLUR_DEFAULT, 0, 40) })
    : { value: readInt(GLASS_KEY, GLASS_DEFAULT, 5, 80), blur: readInt(BLUR_KEY, BLUR_DEFAULT, 0, 40) };
  applyAll(glassState.value, glassState.blur);   // 模块加载即应用，刷新后仍生效

  function persist(key, n) {
    try { if (global.localStorage) global.localStorage.setItem(key, String(n)); } catch (e) {}
  }
  function drop(key) {
    try { if (global.localStorage) global.localStorage.removeItem(key); } catch (e) {}
  }
  global.DBP_404Glass = {
    state: glassState,
    DEFAULT: GLASS_DEFAULT,
    BLUR_DEFAULT: BLUR_DEFAULT,
    STORAGE_KEY: GLASS_KEY,
    BLUR_KEY: BLUR_KEY,
    get: function () { return glassState.value; },
    set: function (v) {
      var n = clampNum(parseInt(v, 10) || GLASS_DEFAULT, 5, 80);
      glassState.value = n;
      persist(GLASS_KEY, n);
      applyAll(glassState.value, glassState.blur);
      return n;
    },
    getBlur: function () { return glassState.blur; },
    setBlur: function (v) {
      var n = clampNum(parseInt(v, 10) || 0, 0, 40);
      glassState.blur = n;
      persist(BLUR_KEY, n);
      applyAll(glassState.value, glassState.blur);
      return n;
    },
    reset: function () {
      glassState.value = GLASS_DEFAULT;
      drop(GLASS_KEY);
      applyAll(glassState.value, glassState.blur);
      return GLASS_DEFAULT;
    },
    resetBlur: function () {
      glassState.blur = BLUR_DEFAULT;
      drop(BLUR_KEY);
      applyAll(glassState.value, glassState.blur);
      return BLUR_DEFAULT;
    },
    /* 供 404 页面挂载时调用：清掉 iframe 插件可能残留的跟随类与变量，
       否则 body.iframe-theme-follow .topbar/.sidebar 会盖住玻璃底色 */
    clearInterference: function () {
      try {
        var body = global.document && global.document.body;
        var root = global.document && global.document.documentElement;
        if (body) body.classList.remove('iframe-theme-follow');
        if (root) ['--iframe-bg', '--iframe-bg-top', '--iframe-bg-side', '--iframe-fg']
          .forEach(function (k) { root.style.removeProperty(k); });
      } catch (e) {}
    },
  };

  /* ---------------- 旧版极简 404（一字未改，保证能"回到旧版"） ---------- */
  var Minimal404 = {
    name: 'DbpMinimal404',
    template:
      '<div class="dbp-404-minimal" style="padding:40px;text-align:center;color:var(--text-muted);">' +
        '<i class="fas fa-exclamation-triangle" style="font-size:48px;margin-bottom:16px;display:block;opacity:.4;"></i>' +
        '<h2>404 - 页面未找到</h2>' +
        '<p>你访问的功能不存在或已被移除</p>' +
        '<a href="#/home" style="color:var(--accent);">← 返回首页</a>' +
      '</div>',
  };

  /* ---------------- 本地兜底短句（网络全挂时用，仍带出处） ---------------- */
  var QUOTES = [
    ['这里什么都没有，但星空还在。', '佚名'],
    ['走错路的时候，顺便看看风景吧。', '佚名'],
    ['404 不是终点，只是还没找到入口。', '佚名'],
    ['有些页面，只存在于想象里。', '佚名'],
    ['别急，回头的路一直都在。', '佚名'],
    ['迷路，也是一种抵达。', '佚名'],
    ['风会把你带到该去的地方。', '佚名'],
    ['今天也要好好吃饭，好好睡觉。', '佚名'],
    ['世界很大，不差这一页。', '佚名'],
    ['你找的东西，也许正在找你。', '鲁米'],
    ['慢一点，也没关系。', '佚名'],
    ['所有的相遇都是久别重逢，除了这一页。', '佚名'],
    ['刷新一下，说不定就有惊喜。', '佚名'],
    ['愿你所念皆如愿，所行皆化坦途。', '佚名'],
    ['此处空白，留给你自己填写。', '佚名'],
    ['月亮不迷路，因为它不赶时间。', '佚名'],
    ['保持好奇，路会自己出现。', '佚名'],
    ['海边的风，替我说了句抱歉。', '佚名'],
    ['这一秒的晚霞，只为你亮着。', '佚名'],
    ['往前走吧，别在这里久留。', '佚名'],
    ['Not all those who wander are lost.', 'J.R.R. Tolkien'],
    ['Every page has an end. Yet we go on reading.', '佚名'],
    ['行到水穷处，坐看云起时。', '王维《终南别业》'],
    ['山重水复疑无路，柳暗花明又一村。', '陆游《游山西村》']
  ];

  /* ---------------- 沉浸式 404 ---------------- */
  var Immersive404 = {
    name: 'DbpImmersive404',
    template: `
      <div class="dbp-404" @mousemove="onMove">
        <img class="dbp-404-bg" ref="bgEl" :src="bgSrc" :class="{loaded:bgLoaded}"
             alt="随机壁纸" data-dbp-quiet404="wallpaper" @load="onBgLoad" @error="onBgError" />
        <div class="dbp-404-veil"></div>
        <div class="dbp-404-grain"></div>
        <div class="dbp-404-glow" ref="glowEl"></div>

        <div class="dbp-404-crumb">
          <span @click="goHome">首页</span> / <span @click="goBack">返回</span>
        </div>

        <div class="dbp-404-stage">
          <div class="dbp-404-num">404</div>
          <div class="dbp-404-sub">page not found</div>
          <h1>页面走丢了</h1>
          <p class="dbp-404-desc">你要找的链接不在这里，不过风景还不错。<br />换个方向，或者就在这里待一会儿。</p>

          <div class="dbp-404-quote" @click="nextQuote" title="点击换一句">
            <div class="dbp-404-qtext" :key="qKey">{{ qtext }}</div>
            <div class="dbp-404-qfrom">{{ qfrom }}</div>
          </div>

          <div class="dbp-404-actions">
            <button class="dbp-404-btn dbp-404-btn-back" @click="goBack" title="返回">&#8592;</button>
            <button class="dbp-404-btn dbp-404-btn-primary" @click="reload">&#8635; 刷新</button>
          </div>
        </div>

        <div class="dbp-404-bottom">
          <div class="dbp-404-left">
            <a class="dbp-404-mini dbp-404-orig" :href="realUrl" target="_blank" rel="noopener noreferrer"
               title="悬浮查看图片源 · 点击打开原图（Ctrl / ⌘ + 点击复制）" @click="onOrigClick">
              原图<span class="dbp-404-srctip" @click.stop.prevent="copySrc">
                <span class="dbp-404-srcurl" title="点击复制">{{ srcText }}</span>
                <span class="dbp-404-srcmeta">{{ metaText }}</span>
              </span>
            </a>
            <button class="dbp-404-mini" @click="changeWallpaper" title="换一张壁纸 (R)">刷新</button>
          </div>
          <div class="dbp-404-right">
            <button class="dbp-404-mini" @click="nextQuote" title="换一句短句">换句</button>
          </div>
        </div>

        <div class="dbp-404-help">
          <div class="dbp-404-helppop" :class="{on:helpOn}">
            <h3>? 这个小页面能做什么</h3>
            <div>
              • 壁纸来自 <b>loliapi</b>，由 <b>JSON</b> 解析图片地址，原图链接与壁纸同一张<br />
              • 悬浮 <b>原图</b> 才显示真实图片源，点它打开原图<br />
              • 点图片源文字可复制，<b>Ctrl / ⌘ + 点原图</b> 也可复制<br />
              • <b>刷新</b> 换壁纸；短句来自 <b>hitokoto</b>，每 <b>6 秒</b> 自动换并带出处<br />
              • <b>Esc</b> 返回 · <b>R</b> 换图 · <b>H</b> 帮助
            </div>
            <div class="dbp-404-helptip">已融入主页：顶栏与侧边栏照常显示。可在「设置 → 404 页面样式」切回旧版极简页面。</div>
          </div>
          <button class="dbp-404-helpbtn" :class="{on:helpOn}" @click="toggleHelp" aria-label="帮助">?</button>
        </div>
      </div>
    `,
    setup: function () {
      var bgEl = ref(null);
      var glowEl = ref(null);
      var bgSrc = ref('');
      var bgLoaded = ref(false);
      var srcText = ref('加载中…');
      var metaText = ref('');
      var realUrl = ref(API);
      var qtext = ref('正在取一句短句…');
      var qfrom = ref('');
      var qKey = ref(0);
      var helpOn = ref(false);

      var usingLocal = false;
      var lastQuote = -1;
      var quoteTicker = null;
      var quoteSeq = 0;

      // ★ 壁纸改为「JSON 取真实图片 URL」：
      //   1) 请求 ?type=json 解析出 imgurl，直接把它作为 <img> 的 src。
      //      「原图」链接与显示的图是同一个 URL，不会再出现两者不一致。
      //   2) JSON 失败 / 无 imgurl / 图片 URL 加载失败(含 404) → 重新请求 JSON
      //      换一张随机图，绝不对同一个坏链接反复重试。
      //   3) 最多额外重试 3 次（共 4 次在线尝试），全失败才用本地兜底图，全程静默。
      var WALLPAPER_MAX_RETRY = 3;
      var RETRY_DELAY = 260;        // 重试间隔，避免瞬间连打
      var wallpaperToken = 0;       // 请求代次：换图 / 卸载后，在途回调自动作废
      var wallpaperRetry = 0;
      var wallpaperTimer = null;

      /* ---------- 壁纸 ---------- */
      function applyBg(src, real, meta) {
        realUrl.value = real || src;
        srcText.value = realUrl.value;
        metaText.value = meta || '';
        bgLoaded.value = false;
        bgSrc.value = src;
        syncWallpaperVar(src);
      }

      /* ★ 壁纸必须挂到 body 层：组件内的 .dbp-404 自带 isolation:isolate +
         祖先 main-content 的 overflow，会把 fixed 壁纸裁剪/关在主内容区里，
         导致顶栏与侧栏底下没有壁纸像素（玻璃透明度再怎么调也看不出来）。
         这里把图同时写成 root 上的 CSS 变量，由 body::before 全视口绘制。 */
      function syncWallpaperVar(src) {
        try {
          var doc = global.document;
          if (!doc || !doc.documentElement || !doc.body) return;
          var abs = src;
          try { abs = new global.URL(src, global.location.href).href; } catch (e) {}
          var safe = String(abs).replace(/["\\\r\n]/g, '');
          doc.documentElement.style.setProperty('--dbp404-wallpaper', 'url("' + safe + '")');
          doc.body.classList.remove('dbp-404-bg-ready');   // 换图先淡出，load 后再淡入
        } catch (e) {}
      }

      function stopWallpaperRetry() {
        if (wallpaperTimer) { clearTimeout(wallpaperTimer); wallpaperTimer = null; }
      }

      function onBgLoad(e) {
        // 成功即停掉待重试，并清零计数（下次换图从 0 开始）
        stopWallpaperRetry();
        wallpaperRetry = 0;
        bgLoaded.value = true;
        try { global.document.body.classList.add('dbp-404-bg-ready'); } catch (e) {}
        var el = e && e.target;
        if (el && el.naturalWidth) metaText.value = el.naturalWidth + '×' + el.naturalHeight;
      }

      /* 统一重试点：JSON 取不到、图片 URL 404，都回到「重新拿一份 JSON」 */
      function retryWallpaper(token) {
        if (token !== wallpaperToken || usingLocal) return;
        if (wallpaperRetry < WALLPAPER_MAX_RETRY) {
          wallpaperRetry += 1;
          stopWallpaperRetry();
          wallpaperTimer = setTimeout(function () {
            wallpaperTimer = null;
            attemptWallpaper(token, wallpaperRetry);
          }, RETRY_DELAY);
        } else {
          usingLocal = true;                 // 兜底图自己的 error 不再触发重试
          applyBg(FALLBACK, FALLBACK);
        }
      }

      function onBgError() {
        // ★ 全程静默：不弹窗、不记录。
        // 图片 URL 404 / 图床挂了 → 重新请求 JSON 换一张，不复用坏链接
        if (usingLocal) { bgLoaded.value = true; return; }
        retryWallpaper(wallpaperToken);
      }

      function quietErr(msg) {
        var e = new Error(msg);
        e.__dbpQuiet404 = true;   // 404 页面内部资源，任何链路上都静默
        return e;
      }

      /* 从 JSON（或纯文本 URL）里提取图片源地址。
         官方 ?type=json 返回 {site,imgurl,width,height}，也兼容 url/pic/img 等字段。 */
      function parseSource(txt) {
        var data = txt;
        if (typeof txt === 'string') {
          var t = txt.trim();
          if (!t) throw quietErr('空响应');
          try { data = JSON.parse(t); } catch (e) { data = t; }
        }
        var d = (data && typeof data === 'object' && data.data && typeof data.data === 'object')
          ? data.data : data;
        var u = '';
        if (typeof d === 'string') u = d.trim();
        else if (d && typeof d === 'object') {
          u = d.imgurl || d.imgUrl || d.imgURL || d.url || d.pic || d.img || d.image || d.src || '';
          if (typeof u !== 'string') u = '';
          else u = u.trim();
        }
        if (!/^https?:\/\//i.test(u)) throw quietErr('无有效 imgurl');
        var meta = '';
        if (d && typeof d === 'object' && d.width && d.height) meta = d.width + '×' + d.height;
        return { img: u, meta: meta };
      }

      function fetchSource(token, retry, mode) {
        var url = API + '?type=' + mode + '&_=' + Date.now() + '_' + retry + '_' + Math.floor(Math.random() * 1e6);
        return global.fetch(url, { cache: 'no-store' }).then(function (res) {
          if (!res.ok) throw quietErr(mode + ' HTTP ' + res.status);
          return res.text();
        }).then(function (txt) {
          if (token !== wallpaperToken) return null;
          return parseSource(txt);
        });
      }

      function attemptWallpaper(token, retry) {
        if (token !== wallpaperToken) return;   // 已被换图 / 卸载作废
        if (!global.fetch) { retryWallpaper(token); return; }

        // 主：JSON 拿 imgurl；失败再退到 ?type=url 纯文本；两者都不行才重新取一份
        fetchSource(token, retry, 'json').then(function (r) {
          if (token !== wallpaperToken) return;
          if (!r) return;
          applyBg(r.img, r.img, r.meta);       // ★ 显示源 = 原图链接，严格一致
        }).catch(function () {
          if (token !== wallpaperToken) return;
          fetchSource(token, retry, 'url').then(function (r2) {
            if (token !== wallpaperToken || !r2) return;
            applyBg(r2.img, r2.img, r2.meta);
          }).catch(function () {
            if (token !== wallpaperToken) return;
            retryWallpaper(token);
          });
        });
      }

      function loadWallpaper(bust) {
        stopWallpaperRetry();
        var token = ++wallpaperToken;
        wallpaperRetry = 0;
        usingLocal = false;
        attemptWallpaper(token, 0);
      }

      function changeWallpaper() {
        loadWallpaper(true);
        nextQuote();
        if (global.showToast) global.showToast('已换一张壁纸', 'info');
      }

      /* ---------- 短句：外部一言 API + 本地兜底（带出处，无进度条） ---------- */
      function renderQuote(text, source, author) {
        qtext.value = text;
        var parts = [];
        if (author) parts.push(author);
        if (source) parts.push('《' + String(source).replace(/^《|》$/g, '') + '》');
        qfrom.value = '—— ' + (parts.length ? parts.join(' · ') : (source || '佚名'));
        qKey.value++; // 重建元素触发淡入
      }

      function fallbackQuote() {
        var i;
        do { i = Math.floor(Math.random() * QUOTES.length); } while (i === lastQuote && QUOTES.length > 1);
        lastQuote = i;
        renderQuote(QUOTES[i][0], QUOTES[i][1], '');
      }

      function fetchJSON(url, ms) {
        return new Promise(function (resolve, reject) {
          var done = false;
          var timer = setTimeout(function () {
            if (!done) { done = true; reject(quietErr('timeout')); }
          }, ms || 3500);
          global.fetch(url, { cache: 'no-store' }).then(function (r) {
            if (!r.ok) throw quietErr('HTTP ' + r.status);
            return r.json();
          }).then(function (d) {
            if (!done) { done = true; clearTimeout(timer); resolve(d); }
          }, function (e) {
            if (!done) { done = true; clearTimeout(timer); reject(e.__dbpQuiet404 ? e : quietErr(String((e && e.message) || e))); }
          });
        });
      }

      function scheduleQuote() {
        clearTimeout(quoteTicker);
        quoteTicker = setTimeout(nextQuote, QUOTE_MS);
      }

      function nextQuote() {
        scheduleQuote();                       // 先排下次，网络慢也不卡轮换
        var seq = ++quoteSeq;
        if (!global.fetch || !global.Promise) { fallbackQuote(); return; }

        function use(d) {
          if (seq !== quoteSeq) return true;
          if (d && d.hitokoto) { renderQuote(d.hitokoto, d.from || '', d.from_who || d.creator || ''); return true; }
          if (d && d.content) { renderQuote(d.content, '', d.author || ''); return true; }
          return false;
        }
        fetchJSON(HITOKOTO, 3500)
          .then(function (d) { if (seq === quoteSeq && !use(d)) fallbackQuote(); })
          .catch(function () {
            if (seq !== quoteSeq) return;
            fetchJSON(QUOTABLE, 3500)
              .then(function (d) { if (seq === quoteSeq && !use(d)) fallbackQuote(); })
              .catch(function () { if (seq === quoteSeq) fallbackQuote(); });
          });
      }

      /* ---------- 交互 ---------- */
      function goHome() { global.location.hash = '#/home'; }
      function goBack() {
        if (global.document.referrer && global.history.length > 1) global.history.back();
        else goHome();
      }
      function reload() { global.location.reload(); }
      function toggleHelp() { helpOn.value = !helpOn.value; }
      function copySrc() {
        var t = realUrl.value;
        if (global.copyText) global.copyText(t);
        else if (global.navigator.clipboard) global.navigator.clipboard.writeText(t).catch(function () {});
        else global.prompt('复制图片源：', t);
        if (global.showToast) global.showToast('已复制图片源地址', 'success');
      }
      function onOrigClick(e) {
        // Ctrl / ⌘ / Shift + 点「原图」直接复制，不打开新窗口
        if (e && (e.ctrlKey || e.metaKey || e.shiftKey)) { e.preventDefault(); copySrc(); }
      }
      function onMove(e) {
        var el = glowEl.value;
        if (!el || !e.currentTarget || !e.currentTarget.getBoundingClientRect) return;
        var r = e.currentTarget.getBoundingClientRect();
        el.style.left = (e.clientX - r.left) + 'px';
        el.style.top = (e.clientY - r.top) + 'px';
      }
      function onKey(e) {
        var tag = ((e.target && e.target.tagName) || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;
        var k = (e.key || '').toLowerCase();
        if (k === 'escape') {
          if (helpOn.value) { helpOn.value = false; return; }
          goBack(); return;
        }
        if (k === 'h' || e.key === '?') { toggleHelp(); return; }
        if (k === 'r') { changeWallpaper(); return; }
        if (e.key === 'ArrowLeft') goBack();
      }

      if (Vue.onMounted) {
        Vue.onMounted(function () {
          /* ★ 仅沉浸式 404：让壁纸铺满整个框架底层，顶栏/侧栏/菜单切换液态玻璃 */
          if (global.DBP_404Glass && global.DBP_404Glass.clearInterference) global.DBP_404Glass.clearInterference();
          try { global.document.body.classList.add('dbp-404-active'); } catch (e) {}
          loadWallpaper(false);
          nextQuote();
          global.document.addEventListener('keydown', onKey);
        });
      }
      if (Vue.onBeforeUnmount) {
        Vue.onBeforeUnmount(function () {
          /* 离开 404（或切到极简模式）立即还原框架外观 */
          try {
            var d = global.document;
            d.body.classList.remove('dbp-404-active');
            d.body.classList.remove('dbp-404-bg-ready');
            d.documentElement.style.removeProperty('--dbp404-wallpaper');
          } catch (e) {}
          clearTimeout(quoteTicker);
          stopWallpaperRetry();
          wallpaperToken++;          // 让在途 fetch / 重试回调全部作废
          global.document.removeEventListener('keydown', onKey);
        });
      }

      return {
        bgEl: bgEl, glowEl: glowEl, bgSrc: bgSrc, bgLoaded: bgLoaded,
        srcText: srcText, metaText: metaText, realUrl: realUrl,
        qtext: qtext, qfrom: qfrom, qKey: qKey, helpOn: helpOn,
        onBgLoad: onBgLoad, onBgError: onBgError, onMove: onMove,
        nextQuote: nextQuote, changeWallpaper: changeWallpaper,
        goHome: goHome, goBack: goBack, reload: reload,
        toggleHelp: toggleHelp, copySrc: copySrc, onOrigClick: onOrigClick,
      };
    },
  };

  /* ---------------- 包装组件：按配置即时切换 ---------------- */
  var NotFoundPage = {
    name: 'DbpNotFoundPage',
    components: { DbpImmersive404: Immersive404, DbpMinimal404: Minimal404 },
    template: '<component :is="current" />',
    setup: function () {
      var current = computed
        ? computed(function () {
            var m = global.DBP_404Style ? global.DBP_404Style.get() : DEFAULT_MODE;
            return m === 'minimal' ? 'DbpMinimal404' : 'DbpImmersive404';
          })
        : ref('DbpImmersive404');
      return { current: current };
    },
  };

  global.DBP_NOTFOUND_COMPONENT = NotFoundPage;
  global.DBP_MINIMAL_404_COMPONENT = Minimal404;
  global.DBP_IMMERSIVE_404_COMPONENT = Immersive404;

  console.log('[NotFound] 内置 404 组件已注册 (默认 ' + DEFAULT_MODE + ')');
})(window);
