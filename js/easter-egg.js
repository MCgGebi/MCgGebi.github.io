/* ============================================
   DBP-HUB · 彩蛋引擎（「千万别点」）
   --------------------------------------------
   - 本文件本身由 app.js 在首次点击时动态注入，不随首屏加载
   - 事件注册表 js/easter-eggs.json 也是点击时才 fetch（不主动加载）
   - 每个事件有数字 id + name，触发时弹出提示
   - ★ 每个事件「单独」设置持续时间 duration（毫秒）：
       duration = -1  → 效果永久持续，不自动恢复，只有刷新页面才消失
       duration =  0  → 该事件被禁用（不会被抽到）
       duration >  0  → 经过该毫秒数后自动清理该事件的效果
     —— 各事件的效果互相独立：一个到期消失，不影响其它仍在生效的彩蛋
   ============================================ */
(function (global) {
  'use strict';

  var VERSION = '0.9.20';
  var JSON_URL = './js/easter-eggs.json';
  var SCOPE_ATTR = 'data-egg-scope';

  var registry = null;      // 解析后的事件表（懒加载后缓存）
  var usedIds = [];         // 本次会话已触发过的 id（刷新即重置）
  var scopes = {};          // eggScopeKey -> { style, layer, cleanup[], timers[] }
  var scopeSeq = 0;

  // ============================================
  // 作用域（每个彩蛋独立持有样式与图层，互不干扰）
  // ============================================
  function createScope(key) {
    var style = document.createElement('style');
    style.setAttribute(SCOPE_ATTR, key);
    document.head.appendChild(style);

    var layer = document.createElement('div');
    layer.setAttribute(SCOPE_ATTR, key);
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9998;overflow:hidden;';
    document.body.appendChild(layer);

    var sc = { key: key, style: style, layer: layer, cleanup: [], timers: [] };
    scopes[key] = sc;
    return sc;
  }
  function scopeCss(sc, css) { sc.style.textContent += '\n' + css; }
  function scopeLater(sc, fn, ms) { var t = setTimeout(fn, ms); sc.timers.push(t); return t; }
  function scopeCleanup(sc, fn) { sc.cleanup.push(fn); }
  function destroyScope(key) {
    var sc = scopes[key];
    if (!sc) return;
    sc.timers.forEach(function (t) { clearTimeout(t); });
    sc.cleanup.forEach(function (fn) { try { fn(); } catch (e) {} });
    if (sc.style && sc.style.parentNode) sc.style.parentNode.removeChild(sc.style);
    if (sc.layer && sc.layer.parentNode) sc.layer.parentNode.removeChild(sc.layer);
    delete scopes[key];
  }
  function resetAllEffects() { Object.keys(scopes).forEach(destroyScope); }

  function toast(msg) { if (global.showToast) global.showToast(msg, 'warn'); }
  function randomInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function isEnabled(ev) { return ev.duration !== 0; }
  function isPermanent(ev) { return ev.duration === -1; }

  // ============================================
  // 各事件实现：签名统一为 (sc, ev)
  //   sc.css(...)        只在当前彩蛋作用域内加样式，移除时自动失效
  //   sc.el              当前彩蛋专属图层（自动挂载/移除）
  //   sc.later(fn, ms)   当前彩蛋专属定时器（自动清理）
  //   sc.onClean(fn)     当前彩蛋专属还原逻辑
  // ============================================
  var handlers = {

    // 1/2 —— 跳转链接（瞬时动作，无需清理）
    openUrl: function (sc, ev) {
      var url = (ev.params && ev.params.url) || 'https://zh.minecraft.wiki';
      var win = window.open(url, '_blank', 'noopener,noreferrer');
      if (!win) toast('弹窗被拦截了，链接：' + url);
    },

    // 3 —— 8-bit 音效（Web Audio 合成，无需音频文件）
    sound: function (sc, ev) {
      try {
        var AC = global.AudioContext || global.webkitAudioContext;
        if (!AC) { toast('当前浏览器不支持音效'); return; }
        var ctx = new AC();
        var notes = (ev.params && ev.params.notes) || [523, 659, 784, 1047];
        var wave = (ev.params && ev.params.wave) || 'square';
        var t0 = ctx.currentTime;
        notes.forEach(function (freq, i) {
          var osc = ctx.createOscillator();
          var gain = ctx.createGain();
          osc.type = wave;
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.0001, t0 + i * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.18, t0 + i * 0.12 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.12 + 0.16);
          osc.connect(gain); gain.connect(ctx.destination);
          osc.start(t0 + i * 0.12);
          osc.stop(t0 + i * 0.12 + 0.18);
        });
        sc.later(function () { try { ctx.close(); } catch (e) {} }, notes.length * 200 + 500);
      } catch (e) {
        toast('音效播放失败');
      }
    },

    // 4 —— 文字乱码
    scramble: function (sc, ev) {
      var charset = (ev.params && ev.params.charset) || '!@#$%^&*';
      var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
      var targets = [];
      while (walker.nextNode()) {
        var n = walker.currentNode;
        if (!n.nodeValue || !n.nodeValue.trim()) continue;
        var p = n.parentNode;
        if (!p) continue;
        var tag = (p.tagName || '').toLowerCase();
        if (tag === 'script' || tag === 'style') continue;
        if (p.closest && p.closest('[' + SCOPE_ATTR + ']')) continue; // 不污染彩蛋自身
        targets.push({ node: n, origin: n.nodeValue });
      }
      var iv = setInterval(function () {
        targets.forEach(function (t) {
          var out = '';
          for (var i = 0; i < t.origin.length; i++) {
            out += (t.origin[i] === ' ' || t.origin[i] === '\n')
              ? t.origin[i]
              : charset[randomInt(0, charset.length - 1)];
          }
          t.node.nodeValue = out;
        });
      }, 90);
      sc.onClean(function () {
        clearInterval(iv);
        targets.forEach(function (t) { t.node.nodeValue = t.origin; });
      });
    },

    // 5 —— 二进制代码雨
    matrix: function (sc, ev) {
      var color = (ev.params && ev.params.color) || '#3b8526';
      var fs = (ev.params && ev.params.fontSize) || 16;
      var cv = document.createElement('canvas');
      cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;opacity:.55;';
      sc.el.appendChild(cv);
      var ctx = cv.getContext('2d');
      var cols = 0, drops = [];
      function resize() {
        cv.width = window.innerWidth; cv.height = window.innerHeight;
        cols = Math.floor(cv.width / fs);
        drops = [];
        for (var i = 0; i < cols; i++) drops.push(Math.random() * -50);
      }
      resize();
      global.addEventListener('resize', resize);
      var iv = setInterval(function () {
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.fillStyle = color;
        ctx.font = fs + 'px Consolas, monospace';
        for (var i = 0; i < drops.length; i++) {
          ctx.fillText(Math.random() > 0.5 ? '1' : '0', i * fs, drops[i] * fs);
          if (drops[i] * fs > cv.height && Math.random() > 0.975) drops[i] = 0;
          drops[i]++;
        }
      }, 60);
      sc.onClean(function () { clearInterval(iv); global.removeEventListener('resize', resize); });
    },

    // 6 —— 颜色反转
    invert: function (sc) {
      sc.css('html { filter: invert(1) hue-rotate(180deg) !important; }');
    },

    // 7 —— 炫彩主题
    rainbow: function (sc) {
      sc.css('html { animation: dbpEggRainbow 2.4s linear infinite !important; }' +
             '@keyframes dbpEggRainbow {' +
             '0%{filter:hue-rotate(0deg)}25%{filter:hue-rotate(90deg)}' +
             '50%{filter:hue-rotate(180deg)}75%{filter:hue-rotate(270deg)}100%{filter:hue-rotate(360deg)} }');
    },

    // 8 —— 你屏幕有根毛
    hair: function (sc, ev) {
      var count = (ev.params && ev.params.count) || 1;
      for (var i = 0; i < count; i++) {
        var h = document.createElement('div');
        var len = randomInt(90, 320);
        h.style.cssText = 'position:absolute;width:' + len + 'px;height:' + randomInt(1, 2) + 'px;' +
          'background:#000;opacity:.85;border-radius:2px;' +
          'left:' + randomInt(5, 80) + '%;top:' + randomInt(8, 85) + '%;' +
          'transform:rotate(' + randomInt(-80, 80) + 'deg);box-shadow:0 0 1px rgba(0,0,0,.6);';
        sc.el.appendChild(h);
      }
    },

    // 9 —— 地震模式
    shake: function (sc, ev) {
      var it = (ev.params && ev.params.intensity) || 6;
      sc.css('body { animation: dbpEggShake .12s linear infinite !important; }' +
             '@keyframes dbpEggShake {' +
             '0%{transform:translate(0,0)}25%{transform:translate(' + it + 'px,-' + it + 'px)}' +
             '50%{transform:translate(-' + it + 'px,' + it + 'px)}' +
             '75%{transform:translate(' + it + 'px,' + it + 'px)}100%{transform:translate(0,0)} }');
    },

    // 10 —— 迪厅灯光
    disco: function (sc) {
      var d = document.createElement('div');
      d.style.cssText = 'position:absolute;inset:0;mix-blend-mode:overlay;animation:dbpEggDisco .3s steps(1) infinite;';
      sc.el.appendChild(d);
      sc.css('@keyframes dbpEggDisco{' +
             '0%{background:rgba(255,0,0,.35)}20%{background:rgba(0,255,0,.35)}' +
             '40%{background:rgba(0,255,255,.35)}60%{background:rgba(255,255,0,.35)}' +
             '80%{background:rgba(255,0,255,.35)}100%{background:rgba(0,255,255,.35)} }');
    },

    // 11 —— 撒花庆祝
    confetti: function (sc, ev) {
      var count = (ev.params && ev.params.count) || 60;
      var colors = ['#3b8526', '#f39c12', '#e74c3c', '#3498db', '#9b59b6', '#f1c40f', '#1abc9c'];
      for (var i = 0; i < count; i++) {
        var p = document.createElement('div');
        p.style.cssText = 'position:absolute;width:' + randomInt(6, 11) + 'px;height:' + randomInt(9, 16) + 'px;' +
          'background:' + pick(colors) + ';left:' + randomInt(0, 100) + '%;top:-20px;' +
          'opacity:.95;border-radius:2px;animation:dbpEggFall ' + (randomInt(22, 45) / 10) + 's linear forwards;';
        p.style.animationDelay = (Math.random() * 1.5) + 's';
        sc.el.appendChild(p);
      }
      sc.css('@keyframes dbpEggFall{to{transform:translateY(110vh) rotate(720deg);opacity:.2}}');
    },

    // 12 —— 蓝屏：从左往右、从上到下一块一块铺满，铺满期间与之后都锁定输入
    fakeCrash: function (sc, ev) {
      var p = ev.params || {};
      var text = p.text || 'DBP_HUB_EXCEPTION';
      var COLS = p.cols || 20;
      var ROWS = p.rows || 14;
      var STEP = p.step || 9;          // 每块之间的间隔（毫秒）

      // 全屏容器：吃掉所有指针事件
      var box = document.createElement('div');
      box.style.cssText = 'position:absolute;inset:0;pointer-events:auto;cursor:none;' +
        'user-select:none;-webkit-user-select:none;overflow:hidden;';
      sc.el.appendChild(box);

      // 逐块铺满：外层行、内层列 → 数组顺序即「从上到下，每行从左到右」
      var tiles = [];
      var cw = 100 / COLS, ch = 100 / ROWS;
      for (var r = 0; r < ROWS; r++) {
        for (var c = 0; c < COLS; c++) {
          var t = document.createElement('div');
          t.style.cssText = 'position:absolute;background:#0a2a6b;opacity:0;' +
            'transition:opacity .06s linear;' +
            'left:' + (c * cw) + '%;top:' + (r * ch) + '%;' +
            'width:' + (cw + 0.15) + '%;height:' + (ch + 0.15) + '%;';
          box.appendChild(t);
          tiles.push(t);
        }
      }

      // 铺满后才浮现的崩溃文案
      var info = document.createElement('div');
      info.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;' +
        'align-items:center;justify-content:center;font-family:Consolas,monospace;' +
        'color:#fff;padding:30px;text-align:center;opacity:0;transition:opacity .5s ease;';
      info.innerHTML =
        '<div style="font-size:clamp(48px,12vw,90px);line-height:1;margin-bottom:24px;">:(</div>' +
        '<div style="font-size:clamp(14px,3.4vw,19px);margin-bottom:20px;">你的设备遇到问题，需要重新启动。</div>' +
        '<div style="font-size:clamp(11px,2.6vw,13px);opacity:.75;line-height:2;">' +
        '停止代码：' + text +
        '</div>';
      box.appendChild(info);

      // 逐块点亮
      var i = 0;
      var iv = setInterval(function () {
        if (i >= tiles.length) {
          clearInterval(iv);
          info.style.opacity = '1';
          return;
        }
        tiles[i].style.opacity = '1';
        i++;
      }, STEP);

      // 锁输入：鼠标 / 触摸 / 键盘全部拦下，仅放行刷新与开发者工具
      function allow(e) {
        var k = e.key;
        if (k === 'F5' || k === 'F12') return true;
        if ((e.ctrlKey || e.metaKey) && (k === 'r' || k === 'R')) return true;
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && (k === 'I' || k === 'i')) return true;
        return false;
      }
      function lock(e) {
        if (e.type === 'keydown' && allow(e)) return;   // 留一条刷新的活路
        e.preventDefault();
        e.stopPropagation();
      }
      var LOCK_EVENTS = ['mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu',
                         'wheel', 'touchstart', 'touchend', 'touchmove',
                         'keydown', 'keypress', 'keyup'];
      LOCK_EVENTS.forEach(function (t) { document.addEventListener(t, lock, true); });
      // 页面不可滚动
      sc.css('body { overflow: hidden !important; }');

      sc.onClean(function () {
        clearInterval(iv);
        LOCK_EVENTS.forEach(function (t) { document.removeEventListener(t, lock, true); });
      });
    },

    // 13 —— 弹幕护体
    danmaku: function (sc, ev) {
      var texts = (ev.params && ev.params.texts) || ['666', '前方高能'];
      var iv = setInterval(function () {
        var d = document.createElement('div');
        d.textContent = pick(texts);
        d.style.cssText = 'position:absolute;white-space:nowrap;font-size:' + randomInt(14, 26) + 'px;' +
          'color:' + pick(['#fff', '#3b8526', '#f1c40f', '#e74c3c', '#3498db']) + ';' +
          'text-shadow:0 1px 3px rgba(0,0,0,.8);font-weight:700;' +
          'right:0;top:' + randomInt(5, 85) + '%;transform:translateX(100%);' +
          'animation:dbpEggDanmaku ' + randomInt(5, 10) + 's linear forwards;';
        sc.el.appendChild(d);
        setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 11000);
      }, 420);
      sc.css('@keyframes dbpEggDanmaku{to{transform:translateX(-110vw)}}');
      sc.onClean(function () { clearInterval(iv); });
    },

    // 14 —— 重力失效 / 旋转
    spin: function (sc, ev) {
      var deg = (ev.params && ev.params.deg) || 180;
      sc.css('body { transform: rotate(' + deg + 'deg) !important; transition: transform 1s ease !important; }');
    },

    // 15 —— 呼吸缩放
    pulse: function (sc) {
      sc.css('body { animation: dbpEggPulse 1.6s ease-in-out infinite !important; transform-origin:center center; }' +
             '@keyframes dbpEggPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}');
    },
  };

  // ============================================
  // 加载注册表（点击时才 fetch，不主动加载）
  // ============================================
  function loadRegistry() {
    if (registry) return Promise.resolve(registry);
    return fetch(JSON_URL, { cache: 'no-cache' })
      .then(function (r) {
        // ★ 304 = 缓存未变更，正常响应，不是错误
        if (!(r.ok === true || r.status === 304)) throw new Error('彩蛋注册表加载失败: ' + r.status);
        return r.status === 304 ? null : r.json();
      })
      .then(function (j) {
        registry = (j && j.events) ? j.events : [];
        console.log('[EasterEgg] 注册表已加载，共 ' + registry.length + ' 个事件（含禁用 ' +
          registry.filter(function (e) { return !isEnabled(e); }).length + ' 个）');
        return registry;
      });
  }

  // ============================================
  // 触发：抽一个「已启用且没用过」的事件 → 提示 → 独立计时清理
  // ============================================
  function trigger() {
    return loadRegistry().then(function (list) {
      var enabled = list.filter(isEnabled);
      if (!enabled.length) { toast('所有彩蛋都被禁用了（duration: 0）'); return null; }

      // 每个事件一次会话内只抽一次；一轮抽完自动重开
      var pool = enabled.filter(function (e) { return usedIds.indexOf(e.id) === -1; });
      if (!pool.length) { usedIds = []; pool = enabled.slice(); }

      var ev = pick(pool);
      usedIds.push(ev.id);

      console.log('%c[彩蛋] #' + ev.id + ' ' + ev.name + ' duration=' + ev.duration,
        'color:#f39c12;font-weight:bold');
      toast('🎲 彩蛋 #' + ev.id + '：' + ev.name + (ev.desc ? ' —— ' + ev.desc : ''));

      var fn = handlers[ev.type];
      if (!fn) { toast('未知彩蛋类型: ' + ev.type); return ev; }

      // ★ 独立作用域：样式 / 图层 / 定时器 / 还原逻辑全归这个彩蛋自己
      var key = 'egg-' + ev.id + '-' + (++scopeSeq);
      var sc = createScope(key);
      sc.el = sc.layer; // 别名：handler 里用 sc.el 挂元素
      sc.css = function (css) { scopeCss(sc, css); };
      sc.later = function (f, ms) { return scopeLater(sc, f, ms); };
      sc.onClean = function (f) { scopeCleanup(sc, f); };

      try {
        fn(sc, ev);
      } catch (e) {
        console.error('[EasterEgg] 执行失败:', e);
        toast('彩蛋执行失败：' + e.message);
        destroyScope(key);
        return ev;
      }

      // ★ duration > 0：只清理这一个彩蛋；-1：永不自动清理（刷新才没）
      if (!isPermanent(ev)) sc.later(function () { destroyScope(key); }, ev.duration);
      return ev;
    }).catch(function (err) {
      console.error('[EasterEgg]', err);
      toast('彩蛋加载失败：' + err.message);
      return null;
    });
  }

  global.DBP_EASTER_EGG = {
    version: VERSION,
    trigger: trigger,
    load: loadRegistry,
    reset: function () { usedIds = []; resetAllEffects(); },
    stop: resetAllEffects,
    list: function () { return registry ? registry.slice() : null; },
    // 调试/测试用：当前生效中的彩蛋作用域
    activeScopes: function () { return Object.keys(scopes); },
  };

  console.log('[EasterEgg] 彩蛋引擎已就绪 (v' + VERSION + ')');
})(window);
