/* ========================================
   DBP-HUB · 红石计算器 v0.1.0
   注册项：js/plugins.json → 进阶工具 / 红石系统 / 计算器
   路径：/redstone/calc     src：./js/pages/calc.js
   依赖：全局 Vue3 (window.Vue)、框架 CSS 变量、window.copyText
   零外部请求，纯本地计算
   ======================================== */

definePlugin('calc', {
  template: `
    <div class="page-plugin">
      <div class="section-title">
        <span class="st-label"><i class="fas fa-calculator" style="color:var(--accent);margin-right:6px;"></i>红石计算器</span>
      </div>
      <p class="section-desc">四则运算 + 红石常用换算（刻 / 秒 / 中继器 / 坐标 / 经验），结果可一键复制</p>

      <!-- ① 基础四则运算 -->
      <div class="card open" style="margin-bottom:14px;">
        <div class="card-header" onclick="if(window.toggleCard)toggleCard(this)">
          <span class="badge" style="background:var(--accent);color:#fff;">01</span>
          <span style="flex:1;font-size:12px;">表达式计算</span>
        </div>
        <div class="card-body">
          <div class="toolbar" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
            <input class="form-input" style="flex:1;min-width:180px;" v-model="expr"
                   inputmode="decimal" placeholder="例如：(3 + 5) * 2 / 4" @keyup.enter="focusResult">
            <button class="btn btn-sm" @click="expr = ''">清空</button>
            <button class="btn btn-sm" @click="copy(result.text)" style="background:var(--accent);color:#fff;border:1px solid var(--accent);border-radius:8px;padding:6px 14px;cursor:pointer;">复制结果</button>
          </div>
          <div style="margin-top:10px;padding:14px;border-radius:10px;background:var(--panel);border:1px solid var(--border);font-size:22px;font-weight:700;word-break:break-all;"
               :style="{ color: result.ok ? 'var(--accent)' : 'var(--text-muted)' }">
            {{ result.text }}
          </div>
          <p style="font-size:12px;color:var(--text-muted);margin-top:8px;line-height:1.6;">
            只允许数字和 <code>+ - * / ( ) .</code>，边输入边出结果。除零或含非法字符会提示，不会报错弹窗。
          </p>
        </div>
      </div>

      <!-- ② 时间 / 红石刻换算 -->
      <div class="card open" style="margin-bottom:14px;">
        <div class="card-header" onclick="if(window.toggleCard)toggleCard(this)">
          <span class="badge" style="background:var(--accent);color:#fff;">02</span>
          <span style="flex:1;font-size:12px;">时间 · 红石刻换算</span>
        </div>
        <div class="card-body">
          <div class="toolbar" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
            <input class="form-input" style="flex:1;min-width:130px;" type="number" v-model.number="timeN" placeholder="输入数值">
            <select class="form-select" style="min-width:130px;" v-model="timeUnit">
              <option value="sec">秒 (s)</option>
              <option value="tick">游戏刻 (gt)</option>
              <option value="rtick">红石刻</option>
              <option value="rep">中继器档位</option>
            </select>
          </div>
          <div class="grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-top:10px;">
            <div v-for="r in timeRows" :key="r.k"
                 style="padding:10px 12px;border-radius:10px;background:var(--panel);border:1px solid var(--border);cursor:pointer;"
                 @click="copy(r.v + ' ' + r.u)" :title="'点击复制 ' + r.k">
              <div style="font-size:11px;color:var(--text-muted);">{{ r.k }}</div>
              <div style="font-size:16px;font-weight:700;color:var(--accent);word-break:break-all;">{{ r.v }} <small style="font-size:11px;font-weight:400;">{{ r.u }}</small></div>
            </div>
          </div>
          <p style="font-size:12px;color:var(--text-muted);margin-top:8px;line-height:1.6;">
            1 秒 = 20 游戏刻 = 10 红石刻；1 红石刻 = 2 游戏刻 = 0.1 秒 = 中继器 1 档。
          </p>
        </div>
      </div>

      <!-- ③ 坐标换算 -->
      <div class="card open" style="margin-bottom:14px;">
        <div class="card-header" onclick="if(window.toggleCard)toggleCard(this)">
          <span class="badge" style="background:var(--accent);color:#fff;">03</span>
          <span style="flex:1;font-size:12px;">主世界 ↔ 下界 / 区块坐标</span>
        </div>
        <div class="card-body">
          <div class="toolbar" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
            <label style="font-size:12px;color:var(--text-muted);">X</label>
            <input class="form-input" style="flex:1;min-width:90px;" type="number" v-model.number="cx" placeholder="主世界 X">
            <label style="font-size:12px;color:var(--text-muted);">Z</label>
            <input class="form-input" style="flex:1;min-width:90px;" type="number" v-model.number="cz" placeholder="主世界 Z">
          </div>
          <div class="grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-top:10px;">
            <div v-for="r in coordRows" :key="r.k"
                 style="padding:10px 12px;border-radius:10px;background:var(--panel);border:1px solid var(--border);cursor:pointer;"
                 @click="copy(r.v)" :title="'点击复制 ' + r.k">
              <div style="font-size:11px;color:var(--text-muted);">{{ r.k }}</div>
              <div style="font-size:16px;font-weight:700;color:var(--accent);word-break:break-all;">{{ r.v }}</div>
            </div>
          </div>
          <p style="font-size:12px;color:var(--text-muted);margin-top:8px;line-height:1.6;">
            下界坐标 = 主世界 ÷ 8；区块坐标 = 方块坐标 ÷ 16（向下取整）；区块内偏移 = 坐标 mod 16。
          </p>
        </div>
      </div>

      <!-- ④ 经验等级 -->
      <div class="card open" style="margin-bottom:14px;">
        <div class="card-header" onclick="if(window.toggleCard)toggleCard(this)">
          <span class="badge" style="background:var(--accent);color:#fff;">04</span>
          <span style="flex:1;font-size:12px;">经验等级换算</span>
        </div>
        <div class="card-body">
          <div class="toolbar" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
            <input class="form-input" style="flex:1;min-width:130px;" type="number" min="0" v-model.number="lvl" placeholder="等级，例如 30">
            <button class="btn btn-sm" @click="lvl = 30">30 级</button>
            <button class="btn btn-sm" @click="lvl = 0">归零</button>
          </div>
          <div class="grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-top:10px;">
            <div v-for="r in expRows" :key="r.k"
                 style="padding:10px 12px;border-radius:10px;background:var(--panel);border:1px solid var(--border);cursor:pointer;"
                 @click="copy(r.v)" :title="'点击复制 ' + r.k">
              <div style="font-size:11px;color:var(--text-muted);">{{ r.k }}</div>
              <div style="font-size:16px;font-weight:700;color:var(--accent);word-break:break-all;">{{ r.v }}</div>
            </div>
          </div>
          <p style="font-size:12px;color:var(--text-muted);margin-top:8px;line-height:1.6;">
            Java 版分段公式：0–16 / 17–31 / 32+ 三段不同，附魔 30 级共需 1395 点累计经验。
          </p>
        </div>
      </div>
    </div>
  `,

  setup: function () {
    var Vue = window.Vue;
    var ref = Vue.ref, computed = Vue.computed;

    /* ---------- 工具 ---------- */
    function num(v) {
      var n = Number(v);
      return isFinite(n) ? n : 0;
    }
    // 去掉浮点长尾，保留最多 4 位小数
    function fmt(n, d) {
      if (!isFinite(n)) return '—';
      var p = Math.pow(10, d === undefined ? 4 : d);
      var r = Math.round(n * p) / p;
      return String(r);
    }
    function copy(text) {
      var s = String(text == null ? '' : text);
      if (!s || s === '—') return;
      if (window.copyText) { window.copyText(s); return; }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(s).catch(function () {});
      }
    }

    /* ---------- ① 表达式：白名单 + 安全求值 ---------- */
    var expr = ref('');
    var result = computed(function () {
      var t = String(expr.value || '').trim();
      if (!t) return { ok: false, text: '等待输入…' };
      if (!/^[0-9+\-*/().\s]+$/.test(t)) {
        return { ok: false, text: '含非法字符，只能用数字和 + - * / ( ) .' };
      }
      try {
        var v = evalExpr(t);   // 纯递归下降解析，不用 eval / Function，不受 CSP 限制
        if (!isFinite(v)) return { ok: false, text: '无法计算（除零或式子不完整）' };
        return { ok: true, text: fmt(v) };
      } catch (e) {
        return { ok: false, text: String(e.message) === 'div0' ? '不能除以 0' : '式子不完整，检查一下括号' };
      }
    });

    /* 极简四则解析器：表达式 = 项(加减 项)重复 → 项 = 因子(乘除 因子)重复
       因子 = 数字 / 括号 / 正负号；不依赖 eval，不受 CSP 与隐私插件限制 */
    function evalExpr(src) {
      var s = src.replace(/\s+/g, ''), i = 0;
      function peek() { return s.charAt(i); }
      function factor() {
        if (peek() === '+') { i++; return factor(); }
        if (peek() === '-') { i++; return -factor(); }
        if (peek() === '(') {
          i++;
          var inner = expression();
          if (peek() !== ')') throw new Error('bracket');
          i++;
          return inner;
        }
        var st = i;
        while (i < s.length && /[0-9.]/.test(s.charAt(i))) i++;
        if (st === i) throw new Error('number');
        var n = Number(s.slice(st, i));
        if (!isFinite(n)) throw new Error('number');
        return n;
      }
      function term() {
        var v = factor();
        while (peek() === '*' || peek() === '/') {
          var op = s.charAt(i++), r = factor();
          if (op === '/' && r === 0) throw new Error('div0');
          v = op === '*' ? v * r : v / r;
        }
        return v;
      }
      function expression() {
        var v = term();
        while (peek() === '+' || peek() === '-') {
          var op = s.charAt(i++), r = term();
          v = op === '+' ? v + r : v - r;
        }
        return v;
      }
      var out = expression();
      if (i !== s.length) throw new Error('trailing');
      return out;
    }
    function focusResult() { /* 回车仅触发重算，computed 已自动更新 */ }

    /* ---------- ② 时间 / 红石刻 ---------- */
    var timeN = ref(1);
    var timeUnit = ref('sec');
    var timeRows = computed(function () {
      var n = num(timeN.value);
      var u = timeUnit.value;
      // 统一折算成「游戏刻」
      var gt = u === 'sec' ? n * 20 : u === 'tick' ? n : u === 'rtick' ? n * 2 : n * 2;
      return [
        { k: '游戏刻', v: fmt(gt), u: 'gt' },
        { k: '秒', v: fmt(gt / 20), u: 's' },
        { k: '红石刻', v: fmt(gt / 2), u: 'rt' },
        { k: '中继器档', v: fmt(gt / 2), u: '档' },
        { k: '分钟', v: fmt(gt / 1200), u: 'min' },
        { k: '刻/秒', v: '20', u: 'gt·s⁻¹' }
      ];
    });

    /* ---------- ③ 坐标 ---------- */
    var cx = ref(0), cz = ref(0);
    var coordRows = computed(function () {
      var x = num(cx.value), z = num(cz.value);
      var nx = Math.floor(x / 8), nz = Math.floor(z / 8);
      return [
        { k: '下界坐标', v: nx + ', ' + nz },
        { k: '区块坐标', v: Math.floor(x / 16) + ', ' + Math.floor(z / 16) },
        { k: '区块内偏移', v: ((x % 16) + 16) % 16 + ', ' + ((z % 16) + 16) % 16 },
        { k: '主世界坐标', v: x + ', ' + z },
        { k: '下界返主世界 X', v: fmt(nx * 8) + ' ~ ' + fmt(nx * 8 + 7) },
        { k: '区块 X / Z', v: Math.floor(x / 16) + ' / ' + Math.floor(z / 16) }
      ];
    });

    /* ---------- ④ 经验（Java 版分段公式） ---------- */
    var lvl = ref(30);
    function totalExp(L) {
      if (L <= 16) return L * L + 6 * L;
      if (L <= 31) return 2.5 * L * L - 40.5 * L + 360;
      return 4.5 * L * L - 162.5 * L + 2220;
    }
    function nextExp(L) {
      if (L <= 15) return 2 * L + 7;
      if (L <= 30) return 5 * L - 38;
      return 9 * L - 158;
    }
    var expRows = computed(function () {
      var L = Math.max(0, Math.floor(num(lvl.value)));
      var cur = totalExp(L), nxt = totalExp(L + 1);
      return [
        { k: '当前等级', v: fmt(L, 0) + ' 级' },
        { k: '累计经验', v: fmt(cur, 0) + ' xp' },
        { k: '本级所需', v: fmt(nextExp(L), 0) + ' xp' },
        { k: '升下一级累计', v: fmt(nxt, 0) + ' xp' },
        { k: '距 30 级还差', v: fmt(Math.max(0, 1395 - cur), 0) + ' xp' },
        { k: '30 级累计', v: '1395 xp' }
      ];
    });

    return {
      expr: expr, result: result, focusResult: focusResult, copy: copy,
      timeN: timeN, timeUnit: timeUnit, timeRows: timeRows,
      cx: cx, cz: cz, coordRows: coordRows,
      lvl: lvl, expRows: expRows
    };
  },
}, { title: '计算器', icon: 'fas fa-calculator', version: '0.1.0' });
