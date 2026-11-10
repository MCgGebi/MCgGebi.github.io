/* ========================================
   DBP-HUB · Plugin Loader v0.9.20
   - 三种插件格式：JS / HTML / Markdown
   - JS 插件：definePlugin(id, component, opts) 一行注册
     · 宽松校验：缺字段自动补全，多余字段照单全收，绝不抛校验错误
   - HTML 插件双模式（均无卡片/边框包裹，标题显示在顶栏）：
     · iframe  → 裸 <iframe> 直接铺满 main-content，无任何外框
     · inline  → 内容注入 DOM；自动剥离与顶栏重复的导航/标题，防重叠
   - Markdown 插件：内置零依赖解析器，标题由顶栏显示
   - 错误统一进 $dbpError 总线（phase/plugin/url/stack/time/fatal）
   ======================================== */
(function (global) {
  'use strict';

  var APP_VERSION = '0.9.20';
  global.DBP = global.DBP || { version: APP_VERSION, pages: {}, routes: [], nav: [] };

  // ---------- 注册表 ----------
  var PLUGINS = [];
  var CATEGORIES = [];
  var PLUGIN_COMPONENTS = {};
  var LOADING_PLUGINS = {};
  var READY = false;

  // ★ fetch 失败统一包装：把 HTTP 状态码挂到 Error 上，供 404 判定使用
  //   isEntry=true 仅用于「插件入口文件」自己的 fetch；插件内部资源/脚本抛出的
  //   任何错误（哪怕带 status:404 或 message 含 HTTP 404）都不会带此标记。
  function httpError(resp, label, isEntry) {
    var e = new Error((label || '资源加载失败') + ' (' + resp.status + ')');
    e.status = resp.status;
    e.isNotFound = (resp.status === 404);
    if (isEntry === true) e.__dbpPluginEntry = true;
    return e;
  }
  function is404(err) {
    return global.DBP_is404 ? global.DBP_is404(err) : false;
  }
  // ★ 只有「插件入口文件」的 HTTP 404 才允许改跳内置 404 页面
  function isEntry404(err) {
    return !!(err && err.__dbpPluginEntry === true &&
      (global.DBP_is404 ? global.DBP_is404(err) : (err.isNotFound === true || err.status === 404)));
  }

  function report(phase, err, extra) {
    extra = extra || {};
    // ★ 仅「插件入口文件 404」：不进总线、不弹错误窗，交给内置 404 页面。
    //   插件内部资源 404、框架元数据、渲染/运行时错误一律按普通错误处理。
    if (phase === 'plugin-load' && is404(err) && isEntry404(err)) {
      console.info('[PluginLoader] 插件文件 404 → 转内置 404 页面：' + (extra.url || (err && err.message) || ''));
      return;
    }
    if (global.$dbpError && global.$dbpError.push) {
      global.$dbpError.push({
        phase: phase,
        plugin: extra.plugin || null,
        url: extra.url || null,
        message: (err && err.message) ? err.message : String(err),
        stack: (err && err.stack) ? String(err.stack) : (new Error().stack || ''),
        time: new Date().toISOString(),
        fatal: !!extra.fatal,
      });
    } else {
      console.error('[PluginLoader] [' + phase + ']' + (extra.plugin ? ' @' + extra.plugin : '') + ' ' + (err && err.message || err));
    }
  }

  // ============================================
  // 工具函数
  // ============================================
  function getExt(src) {
    var m = (src || '').match(/\.([a-z0-9]+)(?:[\?#]|$)/i);
    return m ? m[1].toLowerCase() : '';
  }
  function isHtmlPlugin(meta) {
    if (meta.pluginType === 'html') return true;
    var src = meta.src || '';
    return getExt(src) === 'html' || getExt(src) === 'htm';
  }
  function isMarkdownPlugin(meta) {
    if (meta.pluginType === 'markdown' || meta.pluginType === 'md') return true;
    var src = meta.src || '';
    var ext = getExt(src);
    return ext === 'md' || ext === 'markdown';
  }
  function defaultSrc(meta) {
    if (meta.src) return meta.src;
    if (meta.pluginType === 'html') return './plugins/html/' + meta.id + '.html';
    if (meta.pluginType === 'markdown') return './plugins/markdown/' + meta.id + '.md';
    return './js/pages/' + meta.id + '.js';
  }

  // 规范化：补全所有缺失字段，多余字段原样保留（宽松，不抛错）
  function normalize(meta) {
    var n = meta || {};
    if (!n.id) { report('plugin-register', new Error('插件缺少 id 字段'), { fatal: false }); n.id = 'unnamed-' + Date.now(); }

    // ★ 外链类型（type: 'link'）：不加载任何文件，点击直接跳转 URL
    if (n.type === 'link' || (!n.src && !n.component && n.url)) {
      n.type = 'link';
      if (!n.url) { report('plugin-register', new Error('外链条目 "' + n.id + '" 缺少 url 字段'), { fatal: false }); }
      if (!n.title) n.title = n.id;
      if (!n.icon) n.icon = 'fas fa-external-link-alt';
      if (!n.target) n.target = '_blank';
      if (!n.badge) { n.badge = 'URL'; n.badgeClass = 'url'; }
      n.pluginType = 'link';
      n.version = n.version || '';
      return n;
    }

    n.type = 'plugin';
    if (!n.pluginType) {
      var ext = getExt(n.src);
      if (ext === 'html' || ext === 'htm') n.pluginType = 'html';
      else if (ext === 'md' || ext === 'markdown') n.pluginType = 'markdown';
      else n.pluginType = 'js';
    }
    if (!n.src) n.src = defaultSrc(n);
    if (!n.version) n.version = '0.1.0';
    if (!n.title) n.title = n.id;
    if (!n.path) n.path = '/' + n.id.replace(/^\//, '');
    if (!n.icon) n.icon = 'fas fa-cube';
    if (n.pluginType === 'html' && !n.renderMode) n.renderMode = 'iframe';
    return n;
  }

  function flattenTree(nodes) {
    var result = [];
    (nodes || []).forEach(function (node) {
      // ★ plugin 与 link 都进入元数据表（router 会跳过 link，不为其建路由）
      if (node.type === 'plugin' || node.type === 'link') result.push(normalize(node));
      else if (node.type === 'folder' && node.children) result = result.concat(flattenTree(node.children));
    });
    return result;
  }

  // ============================================
  // JS 插件注册（极宽松）
  // ============================================
  function applyRegistration(config) {
    if (!config) { report('plugin-register', new Error('registerPlugin 调用时未传 config')); return; }
    var c = config || {};
    var id = c.id || (c.route && c.route.path && c.route.path.replace(/^\//, '')) || 'unnamed';
    var comp = c.component || (c.route && c.route.component) || null;
    if (!c.route) {
      c.route = {
        path: c.path || ('/' + id),
        name: id, component: comp,
        meta: { title: c.title || id, icon: c.icon || 'fas fa-cube' },
      };
    }
    var meta = PLUGINS.find(function (p) { return p.id === id; });
    if (meta) {
      meta._component = comp; meta._routeConfig = c.route;
      if (c.version) meta.version = c.version;
      // 保留多余自定义字段
      Object.keys(c).forEach(function (k) { if (meta[k] === undefined) meta[k] = c[k]; });
    } else {
      var nm = normalize({
        id: id, title: c.title || id, version: c.version || '0.1.0',
        path: c.route.path || ('/' + id), icon: c.route.meta && c.route.meta.icon || c.icon || 'fas fa-cube',
        pluginType: 'js', src: defaultSrc({ id: id, pluginType: 'js' }),
      });
      nm._component = comp; nm._routeConfig = c.route;
      // 合并多余字段
      Object.keys(c).forEach(function (k) { if (nm[k] === undefined) nm[k] = c[k]; });
      PLUGINS.push(nm);
      console.log('[PluginLoader] ✓ 动态注册插件: ' + id + ' (v' + nm.version + ')');
    }
    PLUGIN_COMPONENTS[id] = comp;
  }

  global.registerPlugin = function (config) {
    if (!config) { report('plugin-register', new Error('registerPlugin 调用时未传 config')); return; }
    if (typeof config === 'function') config = { component: config };
    applyRegistration(config);
  };

  /**
   * definePlugin —— 推荐注册助手（宽松：传啥接啥，不抛校验错误）
   *   definePlugin('crafting', { template: `...` })
   *   definePlugin('crafting', { template, setup }, { title, icon, version, badge })
   *   definePlugin({ id, component, ... })                // 对象形式
   *   definePlugin('id', Component)                        // 仅组件（自动补 title/icon/version）
   */
  global.definePlugin = function (id, component, opts, more) {
    var config = {};
    if (typeof id === 'object' && id !== null && !Array.isArray(id)) {
      config = Object.assign({}, id);  // 对象形式：多余字段原样保留
    } else {
      config.id = id;
      config.component = component || null;
      if (opts && typeof opts === 'object') Object.assign(config, opts);
      if (more && typeof more === 'object') Object.assign(config, more);
    }
    applyRegistration(config);
  };

  // ============================================
  // 轻量 Markdown → HTML 解析器（零依赖）
  // ============================================
  function markdownToHtml(md) {
    if (!md) return '';
    var lines = String(md).replace(/\r\n/g, '\n').split('\n');
    var html = [], i = 0;

    function inline(text) {
      text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
      text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="md-img">');
      text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
      text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
      text = text.replace(/~~([^~]+)~~/g, '<del>$1</del>');
      return text;
    }
    function parseCodeBlock() {
      i++;
      var lang = '', first = lines[i - 1].replace(/^```/, '').trim();
      if (first) lang = first;
      var code = [];
      while (i < lines.length && !lines[i].startsWith('```')) { code.push(lines[i]); i++; }
      i++;
      var cls = lang ? ' class="language-' + lang + '"' : '';
      return '<pre><code' + cls + '>' + (String(code.join('\n')).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')) + '</code></pre>\n';
    }
    function parseTable(headerLine) {
      var headers = headerLine.split('|').map(function (s) { return s.trim(); }).filter(Boolean);
      var rows = []; i += 2;
      while (i < lines.length && lines[i].trim() !== '' && lines[i].indexOf('|') !== -1) {
        var cells = lines[i].split('|').map(function (s) { return s.trim(); }).filter(Boolean);
        rows.push(cells); i++;
      }
      var out = '<table class="md-table"><thead><tr>';
      headers.forEach(function (h) { out += '<th>' + inline(h) + '</th>'; });
      out += '</tr></thead><tbody>';
      rows.forEach(function (row) {
        out += '<tr>';
        row.forEach(function (cell) { out += '<td>' + inline(cell) + '</td>'; });
        out += '</tr>';
      });
      out += '</tbody></table>\n';
      return out;
    }
    function parseList(isOrdered) {
      var items = [], re = isOrdered ? /^\d+\.\s+/ : /^[-*+]\s+/;
      while (i < lines.length && re.test(lines[i])) {
        items.push(lines[i].replace(isOrdered ? /^\d+\.\s+/ : /^[-*+]\s+/, '')); i++;
      }
      var tag = isOrdered ? 'ol' : 'ul', out = '<' + tag + ' class="md-list">';
      items.forEach(function (item) {
        var tm = item.match(/^\[([ x])\]\s+(.*)$/);
        if (tm) out += '<li class="md-task"><input type="checkbox" disabled' + (tm[1] === 'x' ? ' checked' : '') + '> ' + inline(tm[2]) + '</li>';
        else out += '<li>' + inline(item) + '</li>';
      });
      out += '</' + tag + '>\n';
      return out;
    }

    while (i < lines.length) {
      var line = lines[i];
      if (line.trim() === '') { i++; continue; }
      if (line.startsWith('```')) { html.push(parseCodeBlock()); continue; }
      if (/^[-*_]{3,}\s*$/.test(line.trim())) { html.push('<hr class="md-hr">\n'); i++; continue; }
      var h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) { html.push('<h' + h[1].length + ' class="md-h' + h[1].length + '">' + inline(h[2].trim()) + '</h' + h[1].length + '>\n'); i++; continue; }
      if (line.startsWith('>')) { var q = []; while (i < lines.length && lines[i].startsWith('>')) { q.push(lines[i].replace(/^>\s?/, '')); i++; } html.push('<blockquote class="md-quote">' + inline(q.join(' ')) + '</blockquote>\n'); continue; }
      if (line.indexOf('|') !== -1 && i + 1 < lines.length && /^[\s|:-]+$/.test(lines[i + 1])) { html.push(parseTable(line)); continue; }
      if (/^\d+\.\s+/.test(line)) { html.push(parseList(true)); continue; }
      if (/^[-*+]\s+/.test(line)) { html.push(parseList(false)); continue; }
      var para = [line]; i++;
      while (i < lines.length && lines[i].trim() !== '' &&
             !lines[i].startsWith('#') && !lines[i].startsWith('```') &&
             !lines[i].startsWith('>') && !/^[-*+]\s/.test(lines[i]) &&
             !/^\d+\.\s+/.test(lines[i]) && lines[i].indexOf('|') === -1) { para.push(lines[i]); i++; }
      html.push('<p class="md-p">' + inline(para.join(' ')) + '</p>\n');
    }
    return html.join('');
  }

  // ============================================
  // Markdown 插件组件
  // 标题由顶栏显示（route.meta.title），此处只渲染正文 + 操作栏
  // ============================================
  function createMarkdownPluginComponent(meta) {
    var pluginId = meta.id, pluginTitle = meta.title || meta.id, pluginIcon = meta.icon || 'fas fa-file-alt';
    return {
      template: `
      <div class="page-plugin markdown-plugin">
        <div class="markdown-actions-bar" v-if="loaded && !error">
          <button class="md-btn" @click="copyContent" title="复制原始 Markdown">
            <i class="fas fa-copy"></i> 复制
          </button>
          <button class="md-btn" :class="{ active: showSource }" @click="toggleSource">
            <i :class="showSource ? 'fas fa-eye' : 'fas fa-code'"></i> {{ showSource ? '查看渲染' : '查看源码' }}
          </button>
        </div>
        <div v-if="error" class="html-plugin-error">
          <i class="fas fa-exclamation-triangle"></i>
          <span>{{ error }}</span>
          <button class="btn btn-primary btn-sm" @click="loadMarkdown">重试</button>
        </div>
        <div v-if="loaded && !error && !showSource" class="markdown-body" v-html="renderedHtml"></div>
        <pre v-if="loaded && !error && showSource" class="markdown-source" v-text="rawText"></pre>
      </div>`,
      setup: function () {
        var Vue = global.Vue, ref = Vue.ref;
        var renderedHtml = ref(''), rawText = ref(''), loaded = ref(false), error = ref(''), showSource = ref(false);
        function loadMarkdown() {
          loaded.value = false; error.value = '';
          fetch(meta.src, { cache: 'no-cache' })
            .then(function (r) { if (!r.ok) throw httpError(r, 'HTTP ' + r.status + ' - ' + meta.src, true); return r.text(); })
            .then(function (text) { rawText.value = text; renderedHtml.value = markdownToHtml(text); loaded.value = true; error.value = ''; })
            .catch(function (err) {
              // ★ 仅插件入口文件 404：不显示错误框、不进总线，直接显示内置 404 页面
              //   插件内部资源错误不带 __dbpPluginEntry，绝不跳 404
              if (is404(err) && isEntry404(err)) { loaded.value = true; error.value = ''; if (global.DBP_show404) global.DBP_show404(); return; }
              loaded.value = true; error.value = 'Markdown 加载失败: ' + err.message; report('plugin-load', err, { plugin: pluginId, url: meta.src });
            });
        }
        function copyContent() { global.copyText(rawText.value || ''); }
        function toggleSource() { showSource.value = !showSource.value; }
        loadMarkdown();
        return { title: pluginTitle, icon: pluginIcon, renderedHtml: renderedHtml, rawText: rawText, loaded: loaded, error: error, showSource: showSource, loadMarkdown: loadMarkdown, copyContent: copyContent, toggleSource: toggleSource };
      },
    };
  }

  // ============================================
  // HTML 插件组件（双模式）
  //   iframe  → 裸 <iframe> 直接铺满，无卡片、无标题、无边框
  //   inline  → 内容注入 DOM；自动剥离与顶栏重复的标题/导航，防遮挡
  // ============================================
  function createHtmlPluginComponent(meta) {
    var renderMode = (meta.renderMode || 'iframe').toLowerCase();
    var pluginId = meta.id, pluginTitle = meta.title || meta.id;

    if (renderMode === 'iframe') {
      return {
        template: `
        <div class="page-plugin html-plugin html-plugin-iframe-mode">
          <div v-if="error" class="html-plugin-error">
            <i class="fas fa-exclamation-triangle"></i>
            <span>{{ error }}</span>
            <button class="btn btn-primary btn-sm" @click="reloadIframe">重试</button>
          </div>
          <iframe
            v-show="!error"
            ref="iframeRef"
            class="html-plugin-iframe-naked"
            :src="src"
            frameborder="0"
            allowfullscreen
            @load="onIframeLoad"
            @error="onIframeError"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          ></iframe>
        </div>`,
        setup: function () {
          var Vue = global.Vue, ref = Vue.ref;
          var loaded = ref(false), error = ref(''), iframeRef = ref(null);

          /* ---------- 框架颜色跟随 iframe「边缘」颜色（仅当前页面生效） ----------
             思路：在 iframe 内部视口的边缘位置采样（顶部 / 左侧），
             用 elementFromPoint 拿到该点真正命中的元素，再向上冒泡找第一个
             不透明背景色 —— 也就是用户在框架顶栏、侧边栏接缝处实际看到的颜色。

             ★ 严格单向：只「读取」iframe 的颜色来装扮框架自己，
               绝不向 iframe 内部写入任何 style / 修改 DOM，
               iframe 页面保持原样，不受框架主题影响。
          ------------------------------------------------------------------ */
          var FOLLOW_CLASS = 'iframe-theme-follow';
          function parseRGB(str) {
            var v = String(str || '').trim();
            var m = v.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/);
            if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : parseFloat(m[4]) };
            // 兼容部分环境返回 hex（#fff / #ffffff）
            var h = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
            if (h) {
              var t = h[1];
              if (t.length === 3) t = t[0] + t[0] + t[1] + t[1] + t[2] + t[2];
              return { r: parseInt(t.slice(0, 2), 16), g: parseInt(t.slice(2, 4), 16), b: parseInt(t.slice(4, 6), 16), a: 1 };
            }
            return null;
          }
          function luminance(c) { return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255; }
          function rgbStr(c) { return 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')'; }

          /* 在 iframe 内某点采样边缘色：命中元素 → 向上冒泡找首个不透明背景 */
          function sampleEdgeColor(win, doc, px, py) {
            var el = null;
            try { el = doc.elementFromPoint(px, py); } catch (e) { return null; }
            var guard = 0;
            while (el && guard++ < 40) {
              var cs = null;
              try { cs = win.getComputedStyle(el); } catch (e) { return null; }
              if (cs) {
                var c = parseRGB(cs.backgroundColor);
                // 纯白/纯黑不优先采用，避免命中默认底色掩盖真实边缘色
                if (c && c.a >= 0.5) return c;
              }
              el = el.parentElement || (el.parentNode && el.parentNode.nodeType === 1 ? el.parentNode : null);
            }
            return null;
          }

          /* 取 iframe 内部视口尺寸 */
          function iframeViewport(win, doc) {
            var w = 0, h = 0;
            try { w = win.innerWidth || doc.documentElement.clientWidth || 0; } catch (e) {}
            try { h = win.innerHeight || doc.documentElement.clientHeight || 0; } catch (e) {}
            return { w: w, h: h };
          }

          /* 顶部边缘色：沿顶边横向多采样，取第一个有效值（避开边缘 1px 误差） */
          function pickTopEdge(win, doc, vp) {
            var ys = [2, 5, 10, 16, 1];
            var xs = [Math.round(vp.w / 2), Math.round(vp.w * 0.25), Math.round(vp.w * 0.75), 6, Math.max(1, vp.w - 6)];
            for (var a = 0; a < ys.length; a++) {
              for (var b = 0; b < xs.length; b++) {
                var c = sampleEdgeColor(win, doc, xs[b], ys[a]);
                if (c) return c;
              }
            }
            return null;
          }
          /* 左侧边缘色：沿左边纵向多采样 */
          function pickSideEdge(win, doc, vp) {
            var xs = [2, 5, 10, 16, 1];
            var ys = [Math.round(vp.h / 2), Math.round(vp.h * 0.25), Math.round(vp.h * 0.75), 40, Math.max(1, vp.h - 40)];
            for (var a = 0; a < xs.length; a++) {
              for (var b = 0; b < ys.length; b++) {
                var c = sampleEdgeColor(win, doc, xs[a], ys[b]);
                if (c) return c;
              }
            }
            return null;
          }
          /* 主区/整体底色：中心区域采样，回退 body → html */
          function pickMainBg(win, doc) {
            var c = null;
            try {
              var cs = doc.body ? win.getComputedStyle(doc.body) : null;
              if (cs) c = parseRGB(cs.backgroundColor);
              if (!c || c.a < 0.5) {
                var csH = win.getComputedStyle(doc.documentElement);
                c = parseRGB(csH.backgroundColor);
              }
            } catch (e) { return null; }
            return (c && c.a >= 0.5) ? c : null;
          }

          /* 应用：顶栏用顶部边缘色、侧边栏用左侧边缘色、主区用整体底色 */
          function applyEdgeColors(topC, sideC, mainC, fgStr) {
            var root = document.documentElement;
            var base = mainC || topC || sideC;
            if (!base) return false;
            root.style.setProperty('--iframe-bg', rgbStr(base));
            root.style.setProperty('--iframe-bg-top', rgbStr(topC || base));
            root.style.setProperty('--iframe-bg-side', rgbStr(sideC || topC || base));
            // 前景色：优先用 iframe 文字色，否则按顶栏底色亮度推导
            var fc = parseRGB(fgStr);
            if (fc && fc.a >= 0.5) {
              root.style.setProperty('--iframe-fg', rgbStr(fc));
            } else {
              root.style.setProperty('--iframe-fg', luminance(topC || base) > 0.55 ? '#1a1a1a' : '#e0e0e0');
            }
            document.body.classList.add(FOLLOW_CLASS);
            return true;
          }
          function clearFollowColors() {
            var root = document.documentElement;
            root.style.removeProperty('--iframe-bg');
            root.style.removeProperty('--iframe-bg-top');
            root.style.removeProperty('--iframe-bg-side');
            root.style.removeProperty('--iframe-fg');
            document.body.classList.remove(FOLLOW_CLASS);
          }

          /* 主流程：取 iframe 边缘色 → 框架跟随 */
          function tryFollowTheme() {
            var el = iframeRef.value;
            if (!el) return;
            // 注意：只读取 iframe 的颜色用于框架跟随，绝不修改 iframe 内部任何内容
            var doc = null, win = null;
            try {
              win = el.contentWindow;
              doc = el.contentDocument || (win && win.document);
            } catch (e) { return; }
            if (!doc || !win) return;
            var vp = iframeViewport(win, doc);
            if (!vp.w || !vp.h) return;
            var topC = pickTopEdge(win, doc, vp);
            var sideC = pickSideEdge(win, doc, vp);
            var mainC = pickMainBg(win, doc);
            var fgStr = '';
            try {
              var bcs = doc.body ? win.getComputedStyle(doc.body) : null;
              if (bcs) fgStr = bcs.color;
            } catch (e) {}
            applyEdgeColors(topC, sideC, mainC, fgStr);
          }

          // ★ 仅对「插件入口 HTML 文件」做 404 预检：HEAD 明确 404 且 iframe 还没
          //   加载成功时才跳内置 404 页面。插件内部资源（img/script/link）404 不在此列。
          function precheck404() {
            var src = String(meta.src || '');
            if (/^https?:\/\//i.test(src) || !global.fetch) return; // 外站 CORS 不可靠，不预检
            try {
              global.fetch(src, { method: 'HEAD', cache: 'no-cache' }).then(function (r) {
                if (r && r.status === 404 && !loaded.value) {
                  if (global.DBP_show404) global.DBP_show404();
                }
              }).catch(function () { /* 网络异常不当 404 */ });
            } catch (e) { /* 忽略 */ }
          }

          /* ★ iframe 元素的 error 无法区分「入口文件」与「插件内部资源」。
             内部资源 404 属于普通错误，绝不能整页跳内置 404。
             入口文件 404 已由 precheck404() 明确判定；这里不再无条件跳转。 */
          function onIframeError() {
            // 静默：入口 404 交给 precheck404；内部资源 404 交给 hookInnerErrors
          }

          /* ★ 同源 iframe：监听其内部资源加载失败，按普通 phase:resource 错误上报，
             不跳 404、不弹初始化窗（由常驻错误面板承载）。 */
          function hookInnerErrors() {
            var el = iframeRef.value; if (!el) return;
            var win = null;
            try { win = el.contentWindow; } catch (e) { return; }
            if (!win || win.__dbpInnerHooked) return;
            win.__dbpInnerHooked = true;
            try {
              win.addEventListener('error', function (ev) {
                var t = ev.target;
                var tag = String((t && t.tagName) || '').toLowerCase();
                if (tag !== 'img' && tag !== 'script' && tag !== 'link') return;
                var u = String(t.src || t.href || '');
                report('resource', new Error('插件内资源加载失败: ' + u), { plugin: pluginId, url: u });
              }, true);
            } catch (e) {}
          }

          function onIframeLoad() {
            loaded.value = true; error.value = '';
            hookInnerErrors();
            // iframe 首帧样式可能未就绪，延迟一拍再取色
            setTimeout(tryFollowTheme, 120);
            setTimeout(tryFollowTheme, 600);
          }
          function reloadIframe() {
            loaded.value = false; error.value = '';
            if (iframeRef.value) iframeRef.value.src = iframeRef.value.src;
          }
          // 离开页面必须还原框架配色，避免影响其他页面
          if (Vue.onBeforeUnmount) Vue.onBeforeUnmount(clearFollowColors);
          if (Vue.onMounted) Vue.onMounted(function () {
            // 兜底：iframe 可能命中缓存直接 complete
            setTimeout(tryFollowTheme, 300);
            hookInnerErrors();   // 尽早挂上，覆盖 load 之前就失败的内部资源
            precheck404();
          });

          setTimeout(function () { if (!loaded.value) report('plugin-load', new Error('iframe 加载超时（15s）'), { plugin: pluginId, url: meta.src }); }, 15000);
          return { src: meta.src, loaded: loaded, error: error, iframeRef: iframeRef, onIframeLoad: onIframeLoad, onIframeError: onIframeError, reloadIframe: reloadIframe };
        },
      };
    }

    // ---------- inline 模式 ----------
    return {
      template: `
      <div class="page-plugin html-plugin html-plugin-inline-mode" ref="root">
        <div v-if="loading" class="html-inline-loading">
          <i class="fas fa-cube fa-spin"></i> 正在加载...
        </div>
        <div v-if="error" class="html-plugin-error">
          <i class="fas fa-exclamation-triangle"></i>
          <span>{{ error }}</span>
          <button class="btn btn-primary btn-sm" @click="loadHtml">重试</button>
        </div>
        <div v-show="!loading && !error" class="html-plugin-content" ref="content" v-html="htmlContent"></div>
      </div>`,
      setup: function () {
        var Vue = global.Vue, ref = Vue.ref;
        var htmlContent = ref(''), loading = ref(true), error = ref(''), contentRef = ref(null), rootRef = ref(null);

        // 判断元素是否与顶栏标题重复 → 需要剥离，避免导航栏重叠
        function isDuplicateTitle(el) {
          if (!el) return false;
          var text = (el.textContent || '').trim();
          if (!text) return false;
          if (text === pluginTitle) return true;
          if (text.replace(/\s+/g, '') === pluginTitle.replace(/\s+/g, '')) return true;
          // 含「DBP-HUB / 插件」且较短的 H1，视为插件自带页面标题
          if (el.tagName === 'H1' && /DBP-HUB|插件|工具/.test(text) && text.length < 30) return true;
          return false;
        }

        // 剥离与顶栏重复的标题/导航块
        function stripDuplicateHead() {
          var c = contentRef.value; if (!c) return;

          // 1) 顶层 <h1>/<h2> 与顶栏标题重复 → 移除
          var h = c.querySelector(':scope > h1, :scope > h2');
          if (h && isDuplicateTitle(h)) h.parentNode.removeChild(h);

          // 2) <header> / .page-header / .plugin-header 内含重复标题 → 整块移除
          var header = c.querySelector(':scope > header, .page-header, .plugin-header');
          if (header) {
            var titleEl = header.querySelector('h1, h2, .title, [class*="title"]');
            if (isDuplicateTitle(header) || (titleEl && isDuplicateTitle(titleEl))) {
              header.parentNode.removeChild(header);
            }
          }

          // 3) 导航栏：插件自带 <nav> 且与顶栏功能重叠（首页/返回/菜单等）→ 移除，防遮挡
          var nav = c.querySelector(':scope > nav, .plugin-nav, .page-nav, [role="navigation"]');
          if (nav) {
            var navText = (nav.textContent || '').trim();
            if (/首页|返回|主页|菜单|Home|Menu/.test(navText) && navText.length < 40) {
              nav.parentNode.removeChild(nav);
            }
          }
        }

        /* 把插件内部 position:fixed 改为 absolute。
           容器带 transform，本身就是 fixed 的包含块，改后插件自带的
           header / nav 会贴在插件容器顶部（即主页顶栏下方），
           不会再浮到顶栏之上，也不会被顶栏盖住 —— 双向都不重叠。 */
        function neutralizeFixed() {
          var c = contentRef.value; if (!c) return;
          var els = c.querySelectorAll('*');
          for (var i = 0; i < els.length; i++) {
            var el = els[i], pos = '';
            try { pos = window.getComputedStyle(el).position; } catch (e) { continue; }
            if (pos !== 'fixed') continue;
            var cs = null;
            try { cs = window.getComputedStyle(el); } catch (e) {}
            var noTop = !el.style.top && (!cs || cs.top === 'auto' || cs.top === '');
            el.style.setProperty('position', 'absolute', 'important');
            if (noTop) el.style.setProperty('top', '0', 'important');
          }
        }

        // 重新执行内联脚本（v-html 不会执行 script）
        function execScripts() {
          var c = contentRef.value; if (!c) return;
          var scripts = c.querySelectorAll('script');
          scripts.forEach(function (s) {
            var ns = document.createElement('script');
            for (var i = 0; i < s.attributes.length; i++) ns.setAttribute(s.attributes[i].name, s.attributes[i].value);
            ns.textContent = s.textContent; s.parentNode.replaceChild(ns, s);
          });
        }

        function loadHtml() {
          loading.value = true; error.value = '';
          fetch(meta.src, { cache: 'no-cache' })
            .then(function (r) { if (!r.ok) throw httpError(r, 'HTTP ' + r.status + ' - ' + meta.src, true); return r.text(); })
            .then(function (html) {
              htmlContent.value = html; loading.value = false;
              var self = this;
              Vue.nextTick(function () {
                try { stripDuplicateHead(); } catch (e) { report('render', e, { plugin: pluginId, url: meta.src }); }
                try { neutralizeFixed(); } catch (e) { report('render', e, { plugin: pluginId, url: meta.src }); }
                try { execScripts(); } catch (e) { report('render', e, { plugin: pluginId, url: meta.src }); }
              });
            }.bind(this))
            .catch(function (err) {
              // ★ 仅插件入口文件 404：不显示错误框、不进总线，直接显示内置 404 页面
              if (is404(err) && isEntry404(err)) { loading.value = false; error.value = ''; if (global.DBP_show404) global.DBP_show404(); return; }
              loading.value = false; error.value = 'HTML 加载失败: ' + err.message; report('plugin-load', err, { plugin: pluginId, url: meta.src });
            });
        }
        loadHtml();
        return { htmlContent: htmlContent, loading: loading, error: error, content: contentRef, root: rootRef, loadHtml: loadHtml };
      },
    };
  }

  // ============================================
  // 懒加载核心
  // ============================================
  global.loadPlugin = async function (pluginId) {
    if (PLUGIN_COMPONENTS[pluginId]) return PLUGIN_COMPONENTS[pluginId];
    if (LOADING_PLUGINS[pluginId]) return LOADING_PLUGINS[pluginId];

    var meta = PLUGINS.find(function (p) { return p.id === pluginId; });
    if (!meta) { var e = new Error('插件不存在: ' + pluginId); report('plugin-load', e, { plugin: pluginId, fatal: false }); throw e; }

    // ★ 外链类型没有组件可加载：直接返回 null（router 不会为 link 建路由，此处仅为防御）
    if (meta.type === 'link') {
      console.log('[PluginLoader] ↗ 外链条目，无需加载组件: ' + meta.url);
      return null;
    }

    console.log('[PluginLoader] ⏳ 加载插件: ' + pluginId + ' (' + (meta.pluginType || 'js') + ', v' + meta.version + ')');

    var promise;
    if (isMarkdownPlugin(meta)) {
      promise = Promise.resolve(createMarkdownPluginComponent(meta));
    } else if (isHtmlPlugin(meta)) {
      promise = Promise.resolve(createHtmlPluginComponent(meta));
    } else {
      promise = (async function () {
        var resp = await fetch(meta.src, { cache: 'no-cache' });
        if (!resp.ok) throw httpError(resp, '插件加载失败: ' + meta.src, true);
        var code = await resp.text();
        try { new Function(code).call(global); } catch (ex) { report('plugin-register', ex, { plugin: pluginId, url: meta.src, fatal: false }); throw ex; }
        if (!PLUGIN_COMPONENTS[pluginId]) {
          var fallback = global._PLUGIN_COMPONENTS && global._PLUGIN_COMPONENTS[pluginId];
          if (fallback) { PLUGIN_COMPONENTS[pluginId] = fallback; }
          else {
            var ex2 = new Error('插件 ' + pluginId + ' 脚本执行后未注册 component（请用 definePlugin 注册）');
            report('plugin-register', ex2, { plugin: pluginId, url: meta.src, fatal: false });
            throw ex2;
          }
        }
        return PLUGIN_COMPONENTS[pluginId];
      })();
    }

    LOADING_PLUGINS[pluginId] = promise;
    try { var comp = await promise; delete LOADING_PLUGINS[pluginId]; return comp; }
    catch (e) { delete LOADING_PLUGINS[pluginId]; throw e; }
  };

  global.getPluginMeta = function (pluginId) { return PLUGINS.find(function (p) { return p.id === pluginId; }) || null; };

  // ============================================
  // 启动流程（无初始化弹窗；出错 → 错误总线 + 常驻面板）
  // ============================================
  var BOOTSTRAP_RUNNING = false;
  global.DBP_BOOTSTRAP = async function () {
    if (BOOTSTRAP_RUNNING) { console.warn('[PluginLoader] 已在运行，跳过'); return; }
    if (READY) { console.warn('[PluginLoader] 已完成，跳过'); return; }
    BOOTSTRAP_RUNNING = true;

    try {
      var resp = await fetch('./js/plugins.json', { cache: 'no-cache' });
      if (!resp.ok) throw httpError(resp, 'plugins.json 加载失败');
      var config = await resp.json();
      CATEGORIES = config.categories || [];
      APP_VERSION = config.version || APP_VERSION;

      PLUGINS = flattenTree(CATEGORIES);

      // 消费提前调用的 definePlugin / registerPlugin（在 fetch 完成前就执行的）
      var pending = global._pendingPlugins || [];
      pending.forEach(function (c) {
        try { if (c && c.__home && c.factory) c.factory(); else applyRegistration(c); } catch (e) { report('plugin-register', e); }
      });
      global._pendingPlugins = [];

      var jsCount = PLUGINS.filter(function (p) { return !isHtmlPlugin(p) && !isMarkdownPlugin(p); }).length;
      var htmlCount = PLUGINS.filter(isHtmlPlugin).length;
      var mdCount = PLUGINS.filter(isMarkdownPlugin).length;
      console.log('[PluginLoader] 发现 ' + PLUGINS.length + ' 个插件（JS:' + jsCount + ', HTML:' + htmlCount + ', Markdown:' + mdCount + '）');

      // home 插件兜底
      if (!PLUGIN_COMPONENTS['home'] && typeof global._HomePageComponent !== 'undefined' && global._HomePageComponent) {
        PLUGIN_COMPONENTS['home'] = global._HomePageComponent;
        var homeMeta = PLUGINS.find(function (p) { return p.id === 'home'; });
        if (homeMeta) homeMeta._component = global._HomePageComponent;
        console.log('[PluginLoader] ✓ home 插件已通过全局组件兜底注册');
      }

      READY = true;
      BOOTSTRAP_RUNNING = false;
      console.log('[PluginLoader] ✓ 元数据就绪，共 ' + PLUGINS.length + ' 个插件待懒加载');

      if (typeof global.BP_START_APP === 'function') global.BP_START_APP();

    } catch (err) {
      BOOTSTRAP_RUNNING = false;
      report('bootstrap', err, { fatal: true });
      // ★ 关键：即便元数据加载失败，也要尝试挂载应用，
      //   否则 Vue 不起来 → 常驻错误面板不存在 → 用户只看到空白页。
      try {
        if (typeof global.BP_START_APP === 'function') global.BP_START_APP();
      } catch (e2) { report('bootstrap', e2, { fatal: true }); }
      throw err;
    }
  };

  // ============================================
  // 全局 API
  // ============================================
  global.getPlugins = function () { return PLUGINS.slice(); };
  global.getCategories = function () { return CATEGORIES; };
  global.isPluginReady = function () { return READY; };
  global.getAppVersion = function () { return APP_VERSION; };
  global.isHtmlPlugin = isHtmlPlugin;
  global.isMarkdownPlugin = isMarkdownPlugin;
  global.markdownToHtml = markdownToHtml;

  // ★ 外链（type: 'link'）判定与安全跳转
  global.isLinkPlugin = function (meta) { return !!(meta && meta.type === 'link'); };
  global.openLink = function (meta) {
    if (!meta || !meta.url) return false;
    try {
      var win = window.open(meta.url, meta.target || '_blank', 'noopener,noreferrer');
      if (!win && typeof global.showToast === 'function') global.showToast('打开失败：浏览器拦截了弹窗，请手动访问', 'warn');
      return true;
    } catch (e) {
      report('runtime', e, { url: meta.url });
      return false;
    }
  };
  global.definePlugin = global.definePlugin;
  global.createHtmlPluginComponent = createHtmlPluginComponent;
  global.createMarkdownPluginComponent = createMarkdownPluginComponent;

  console.log('[PluginLoader] 插件加载器已就绪 (v' + APP_VERSION + ')');

  // ============================================
  // 前端 Bug 检测（错误统一进总线，不弹初始化遮罩）
  // ============================================
  function installBugDetector() {
    window.addEventListener('error', function (e) {
      // ★ 404 页面的随机壁纸 / 一言加载失败：静默忽略，不进总线、不记录
      if (global.DBP_isQuiet404Asset && global.DBP_isQuiet404Asset(e.target, null)) return;
      var tag = (e.target && e.target.tagName || '').toLowerCase();
      // iframe 元素的 error 无法区分「入口文件」与「插件内部资源」，
      // 交给 iframe 插件自身的 precheck404() / hookInnerErrors() 处理，避免误报 runtime 错误
      if (tag === 'iframe') return;
      if (tag === 'script' || tag === 'link' || tag === 'img') {
        report('resource', new Error('资源加载失败: ' + (e.target.src || e.target.href || 'unknown')), { url: (e.target.src || e.target.href || '') });
      } else {
        report('runtime', e.error || new Error(e.message || 'Unknown error'), { url: (e.filename || '') + ':' + (e.lineno || '?') + ':' + (e.colno || '?') });
      }
    }, true);
    window.addEventListener('unhandledrejection', function (e) {
      if (global.DBP_isQuiet404Reason && global.DBP_isQuiet404Reason(e.reason)) return;
      report('promise', new Error('UnhandledRejection: ' + ((e.reason && e.reason.message) || String(e.reason))));
    });
    if (global.Vue && global.Vue.config) {
      global.Vue.config.errorHandler = function (err, vm, info) { report('render', err, { plugin: (vm && vm.$options && vm.$options.name) || null, url: info }); };
      global.Vue.config.warnHandler = function (msg, vm, trace) { console.warn('[BugDetect] Vue Warn:', msg, trace); };
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installBugDetector);
  else installBugDetector();

})(window);
