/* ============================================
   DBP-HUB · 框架内置设置页（不是插件）
   --------------------------------------------
   - 由框架提供，写在 js/settings.js，不进 plugins.json
   - 路由 /settings 由 router.js 内置注册
   - 入口：顶栏右上角 ⋮ 菜单 → 系统 → 设置
   ============================================ */
(function (global) {
  'use strict';

  var SETTINGS_VERSION = '0.9.20';
  var Vue = global.Vue;
  var ref = Vue && Vue.ref;
  var computed = Vue && Vue.computed;

  var SettingsPage = {
    name: 'SettingsPage',
    components: {},
    template: `
      <div class="page-wrapper settings-page">
        <div class="section-title">
          <span class="st-label">
            <i class="fas fa-sliders-h" style="color:var(--accent);margin-right:8px;"></i>设置
          </span>
        </div>
        <p class="section-desc">框架内置页面 · 不属于插件系统 · 所有更改即时生效并保存在本地</p>

        <!-- 外观 -->
        <div class="card open" style="margin-bottom:14px;">
          <div class="card-header" onclick="if(window.toggleCard)toggleCard(this)">
            <span class="card-arrow">&#9654;</span>
            <span class="badge" style="background:var(--accent);color:#fff;">APPEARANCE</span>
            <span style="flex:1;font-size:12px;color:var(--text-secondary);">外观与主题</span>
          </div>
          <div class="card-body">
            <div class="settings-field">
              <div class="settings-field-label">主题模式</div>
              <div class="theme-picker">
                <button class="theme-opt" :class="{ active: themeMode==='light' }" @click="setThemeMode('light')">
                  <i class="fas fa-sun"></i><span>亮色</span>
                </button>
                <button class="theme-opt" :class="{ active: themeMode==='dark' }" @click="setThemeMode('dark')">
                  <i class="fas fa-moon"></i><span>暗色</span>
                </button>
                <button class="theme-opt" :class="{ active: themeMode==='system' }" @click="setThemeMode('system')">
                  <i class="fas fa-desktop"></i><span>跟随系统</span>
                </button>
              </div>
              <div class="settings-hint">当前生效：<strong>{{ resolvedTheme === 'light' ? '亮色' : '暗色' }}</strong>（{{ themeMode==='system' ? '由系统决定' : '手动指定' }}）</div>
            </div>

            <div class="settings-field">
              <div class="settings-field-label">主题色（强调色）</div>
              <div class="accent-picker">
                <button v-for="p in accentPresets" :key="p.value"
                        class="accent-swatch"
                        :class="{ active: accent===p.value }"
                        :style="{ '--sw': p.value }"
                        :title="p.name + ' ' + p.value"
                        @click="setAccentColor(p.value)">
                  <i v-if="accent===p.value" class="fas fa-check"></i>
                </button>
              </div>
              <div class="accent-custom">
                <label class="accent-custom-label">
                  <input type="color" :value="accent" @input="onAccentInput">
                  <span class="accent-custom-btn"><i class="fas fa-palette"></i> 自定义</span>
                </label>
                <code class="accent-hex">{{ accent }}</code>
                <button class="btn btn-sm" @click="resetAccentColor">
                  <i class="fas fa-rotate-left"></i> 恢复默认
                </button>
              </div>
              <div class="settings-hint">主题色会同步应用到按钮、图标、选中态与发光效果，全站即时生效并记住。</div>
            </div>

            <div class="settings-field">
              <div class="settings-field-label">404 页面样式</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button class="btn btn-sm" :class="notFoundStyle==='immersive' ? 'btn-primary' : 'btn-outline'" @click="setNotFoundStyle('immersive')">
                  <i class="fas fa-image"></i> 沉浸式
                </button>
                <button class="btn btn-sm" :class="notFoundStyle==='minimal' ? 'btn-primary' : 'btn-outline'" @click="setNotFoundStyle('minimal')">
                  <i class="fas fa-minus"></i> 极简（旧版）
                </button>
              </div>
              <div class="settings-hint">
                当前：<strong>{{ notFoundStyle==='minimal' ? '极简（旧版）' : '沉浸式' }}</strong>。
                沉浸式是随机壁纸 + 一言 + 帮助小窗的 404 页面，已融入主页（顶栏与侧边栏照常显示）；
                极简是原来的纯文字提示。切换即时生效，并保存在本地。
              </div>
              <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
                <button class="btn btn-outline btn-sm" @click="preview404"><i class="fas fa-eye"></i> 预览 404 页面</button>
              </div>
            </div>

            <div class="settings-field">
              <div class="settings-field-label">404 玻璃透明度 <span style="font-weight:400;color:var(--text-muted);font-size:10px;">（仅沉浸式）</span></div>
              <div class="glass-row">
                <input class="glass-slider" type="range" min="5" max="80" step="1"
                       :value="glass" @input="onGlassInput" aria-label="404 玻璃透明度">
                <code class="glass-val">{{ glass }}%</code>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:9px;">
                <button v-for="p in glassPresets" :key="p.value" class="btn btn-sm"
                        :class="glass===p.value ? 'btn-primary' : 'btn-outline'"
                        @click="setGlass(p.value)">{{ p.label }}</button>
                <button class="btn btn-outline btn-sm" @click="resetGlass"><i class="fas fa-rotate-left"></i> 恢复默认</button>
              </div>
              <div class="settings-hint">
                数值越小越通透（壁纸越明显），越大越实（文字越清晰），默认 30%。
                同时作用于顶栏、侧边栏与右上角菜单的液态玻璃底色，即时生效并记住。
                想手写 CSS 时，先点「恢复默认」，再改 <code>styles/main.css</code> 里 404 块的 <code>var()</code> 兜底值。
              </div>
            </div>

            <div class="settings-field">
              <div class="settings-field-label">404 玻璃模糊度 <span style="font-weight:400;color:var(--text-muted);font-size:10px;">（仅沉浸式）</span></div>
              <div class="glass-row">
                <input class="glass-slider" type="range" min="0" max="40" step="1"
                       :value="glassBlur" @input="onGlassBlurInput" aria-label="404 玻璃模糊度">
                <code class="glass-val">{{ glassBlur }}px</code>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:9px;">
                <button v-for="p in glassBlurPresets" :key="p.value" class="btn btn-sm"
                        :class="glassBlur===p.value ? 'btn-primary' : 'btn-outline'"
                        @click="setGlassBlur(p.value)">{{ p.label }}</button>
                <button class="btn btn-outline btn-sm" @click="resetGlassBlur"><i class="fas fa-rotate-left"></i> 恢复默认</button>
              </div>
              <div class="settings-hint">
                数值越小越清晰（壁纸纹理可见），越大越柔雾，默认 20px，范围 0~40px。
                侧边栏自动 +4px、右侧菜单 +8px，保持层次；即时生效并记住。
              </div>
            </div>
          </div>
        </div>

        <!-- 概览 -->
        <div class="card open" style="margin-bottom:14px;">
          <div class="card-header" onclick="if(window.toggleCard)toggleCard(this)">
            <span class="card-arrow">&#9654;</span>
            <span class="badge" style="background:var(--blue);color:#fff;">OVERVIEW</span>
            <span style="flex:1;font-size:12px;color:var(--text-secondary);">站点概览</span>
          </div>
          <div class="card-body">
            <div class="settings-stats">
              <div class="settings-stat"><div class="ss-value">{{ stats.plugins }}</div><div class="ss-label">JS/HTML/MD 插件</div></div>
              <div class="settings-stat"><div class="ss-value">{{ stats.links }}</div><div class="ss-label">外链</div></div>
              <div class="settings-stat"><div class="ss-value">{{ stats.categories }}</div><div class="ss-label">分类</div></div>
              <div class="settings-stat"><div class="ss-value">{{ stats.maxDepth }}</div><div class="ss-label">最大层级</div></div>
            </div>
            <div class="settings-kv">
              <div class="settings-kv-row"><span>框架版本</span><code>v{{ version }}</code></div>
              <div class="settings-kv-row"><span>Vue</span><code>{{ vueVersion }}</code></div>
              <div class="settings-kv-row"><span>Vue Router</span><code>{{ routerVersion }}</code></div>
              <div class="settings-kv-row"><span>路由模式</span><code>hash（#/path）</code></div>
              <div class="settings-kv-row"><span>插件加载</span><code>点击菜单时按需 fetch</code></div>
            </div>
          </div>
        </div>

        <!-- 错误 -->
        <div class="card open" style="margin-bottom:14px;">
          <div class="card-header" onclick="if(window.toggleCard)toggleCard(this)">
            <span class="card-arrow">&#9654;</span>
            <span class="badge" :style="errorCount ? 'background:var(--danger);color:#fff;' : 'background:var(--accent);color:#fff;'">ERRORS</span>
            <span style="flex:1;font-size:12px;color:var(--text-secondary);">错误日志（{{ errorCount }} / {{ maxErrors }}）</span>
          </div>
          <div class="card-body">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;line-height:1.5;">
              <i class="fas fa-database" style="color:var(--accent);"></i>
              日志持久化保存，仅保留最近 {{ maxErrors }} 条。带「历史」标记的是上次访问留下的记录，<b>不会触发错误弹窗</b>；只有本次会话的新错误会提示。
            </div>
            <div v-if="!errorCount" style="font-size:12px;color:var(--text-muted);">
              <i class="fas fa-circle-check" style="color:var(--accent);"></i> 当前没有错误记录。
            </div>
            <div v-else>
              <div class="settings-error-list">
                <div class="settings-error-item" v-for="(e, i) in errors" :key="i">
                  <span class="se-phase">{{ e.phase }}</span>
                  <span class="se-msg">{{ e.message }}</span>
                  <span v-if="e.restored" class="se-hist" title="历史记录，不会触发弹窗">历史</span>
                  <span class="se-time">{{ e.time }}</span>
                </div>
              </div>
              <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
                <button class="btn btn-outline btn-sm" @click="copyErrors"><i class="fas fa-copy"></i> 复制全部</button>
                <button class="btn btn-danger btn-sm" @click="clearErrors" :disabled="hasFatal">
                  <i class="fas fa-trash"></i> {{ hasFatal ? '存在致命错误（需刷新）' : '清除记录' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 数据与缓存 -->
        <div class="card open" style="margin-bottom:14px;">
          <div class="card-header" onclick="if(window.toggleCard)toggleCard(this)">
            <span class="card-arrow">&#9654;</span>
            <span class="badge" style="background:var(--warn);color:#1a1a1a;">DATA</span>
            <span style="flex:1;font-size:12px;color:var(--text-secondary);">数据与缓存</span>
          </div>
          <div class="card-body">
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button class="btn btn-primary btn-sm" @click="hardReload"><i class="fas fa-rotate-right"></i> 强制刷新（跳过缓存）</button>
              <button class="btn btn-outline btn-sm" @click="clearThemeOnly"><i class="fas fa-palette"></i> 仅重置主题</button>
              <button class="btn btn-outline btn-sm" @click="openEditor"><i class="fas fa-screwdriver-wrench"></i> 打开插件编辑器</button>
            </div>
            <div class="settings-hint" style="margin-top:10px;">
              强制刷新会在地址后追加时间戳参数，绕过浏览器缓存重新拉取所有资源（改完代码看不到效果时用）。
            </div>
            <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border);">
              <div class="settings-field-label" style="color:var(--danger);">危险操作</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
                <button class="btn btn-danger btn-sm" @click="resetAll"><i class="fas fa-bomb"></i> 清空全部本地数据并重载</button>
              </div>
              <div class="settings-hint">将清除主题、错误记录等所有 <code>dbp-*</code> 本地存储项。</div>
            </div>
          </div>
        </div>

        <!-- 关于 -->
        <div class="card open">
          <div class="card-header" onclick="if(window.toggleCard)toggleCard(this)">
            <span class="card-arrow">&#9654;</span>
            <span class="badge" style="background:var(--purple);color:#fff;">ABOUT</span>
            <span style="flex:1;font-size:12px;color:var(--text-secondary);">关于框架</span>
          </div>
          <div class="card-body">
            <p style="font-size:12px;color:var(--text-secondary);line-height:1.9;">
              <strong>DBP-HUB</strong> 是一个纯前端、零构建的 Minecraft 工具站框架。<br>
              支持四种注册类型：<code>JS 插件</code> / <code>HTML 插件（iframe·inline）</code> / <code>Markdown 文档</code> / <code>外链（url）</code>。<br>
              插件按需懒加载：只有点击菜单时才 fetch 对应文件，首屏零浪费。<br>
              资源全部本地化，断网可用。
            </p>
            <div class="page-footer" style="margin-top:14px;">DBP-HUB 设置 · v{{ version }} · 框架内置页面</div>
          </div>
        </div>
      </div>
    `,
    setup: function () {
      var version = ref((global.DBP && global.DBP.version) || SETTINGS_VERSION);
      var tick = ref(0);

      // ★ 与顶栏菜单共享同一份响应式主题状态：任意一侧改动，另一侧立刻同步
      function sharedTheme() {
        if (typeof global.themeState === 'function') return global.themeState();
        return { mode: 'dark', resolved: 'dark' };
      }
      var themeMode = (Vue && Vue.computed)
        ? Vue.computed(function () { return sharedTheme().mode; })
        : ref('dark');
      var resolvedTheme = (Vue && Vue.computed)
        ? Vue.computed(function () { return sharedTheme().resolved; })
        : ref('dark');

      // 进入页面时用当前值兜底刷新一次（防止设置页先于 app 挂载）
      if (typeof global.applyTheme === 'function') global.applyTheme(sharedTheme().mode);

      // ★ 与 app.js 共享主题色（accent）
      var accent = (Vue && Vue.computed)
        ? Vue.computed(function () {
            tick.value;
            if (global.DBP_themeState && global.DBP_themeState.accent) return global.DBP_themeState.accent;
            if (typeof global.getStoredAccent === 'function') return global.getStoredAccent();
            return '#3b8526';
          })
        : ref('#3b8526');
      var accentPresets = ref(
        (typeof global.ACCENT_PRESETS !== 'undefined' && global.ACCENT_PRESETS)
          ? global.ACCENT_PRESETS
          : [
              { name: '草方块绿', value: '#3b8526' },
              { name: '钻石青', value: '#4cc8e0' },
              { name: '下界红', value: '#c0392b' },
              { name: '末地紫', value: '#8e44ad' },
              { name: '红石橙', value: '#e67e22' },
              { name: '金锭黄', value: '#d4a017' },
              { name: '深海蓝', value: '#2980b9' },
              { name: '烈焰粉', value: '#f72585' },
            ]
      );
      function setAccentColor(c) {
        if (typeof global.setAccent === 'function') global.setAccent(c);
        else if (typeof global.applyAccent === 'function') global.applyAccent(c);
        tick.value++;
        if (global.showToast) global.showToast('主题色已应用：' + c, 'success');
      }
      function onAccentInput(e) {
        var v = e && e.target ? e.target.value : null;
        if (v) setAccentColor(v);
      }
      function resetAccentColor() {
        if (typeof global.clearAccent === 'function') global.clearAccent();
        tick.value++;
        if (global.showToast) global.showToast('已恢复默认主题色', 'info');
      }

      function setThemeMode(mode) {
        if (typeof global.setTheme === 'function') global.setTheme(mode);
        else if (typeof global.applyTheme === 'function') global.applyTheme(mode);
        if (global.showToast) global.showToast('主题已切换：' + (mode === 'system' ? '跟随系统' : (mode === 'light' ? '亮色' : '暗色')), 'success');
      }

      // ★ 404 页面样式（与 js/notfound.js 共享同一份响应式状态，切换即时生效）
      var notFoundStyle = computed
        ? computed(function () {
            return global.DBP_404Style ? global.DBP_404Style.get() : 'immersive';
          })
        : ref('immersive');
      function setNotFoundStyle(m) {
        if (global.DBP_404Style && global.DBP_404Style.set) global.DBP_404Style.set(m);
        tick.value++;
      }
      function preview404() { global.location.hash = '#/dbp-404-preview'; }

      // ★ 404 液态玻璃透明度（与 js/notfound.js 共享 DBP_404Glass）
      var glassPresets = ref([
        { label: '通透 12%', value: 12 },
        { label: '标准 30%', value: 30 },
        { label: '扎实 55%', value: 55 },
      ]);
      var glass = ref(global.DBP_404Glass ? global.DBP_404Glass.get() : 30);
      function setGlass(v) {
        glass.value = global.DBP_404Glass ? global.DBP_404Glass.set(v) : v;
        tick.value++;
      }
      function onGlassInput(e) { setGlass(e && e.target ? e.target.value : 30); }
      function resetGlass() {
        glass.value = global.DBP_404Glass ? global.DBP_404Glass.reset() : 30;
        tick.value++;
        if (global.showToast) global.showToast('已恢复默认玻璃透明度（30%）', 'info');
      }

      // ★ 404 液态玻璃模糊度（复用 js/notfound.js 的 DBP_404Glass，与透明度共用一份状态）
      var glassBlurPresets = ref([
        { label: '清晰 6px', value: 6 },
        { label: '标准 20px', value: 20 },
        { label: '柔雾 36px', value: 36 },
      ]);
      var glassBlur = ref(global.DBP_404Glass && global.DBP_404Glass.getBlur
        ? global.DBP_404Glass.getBlur() : 20);
      function setGlassBlur(v) {
        glassBlur.value = (global.DBP_404Glass && global.DBP_404Glass.setBlur)
          ? global.DBP_404Glass.setBlur(v) : v;
        tick.value++;
      }
      function onGlassBlurInput(e) { setGlassBlur(e && e.target ? e.target.value : 20); }
      function resetGlassBlur() {
        glassBlur.value = (global.DBP_404Glass && global.DBP_404Glass.resetBlur)
          ? global.DBP_404Glass.resetBlur() : 20;
        tick.value++;
        if (global.showToast) global.showToast('已恢复默认玻璃模糊度（20px）', 'info');
      }

      var stats = computed(function () {
        tick.value; // 依赖
        var plugins = (typeof global.getPlugins === 'function') ? (global.getPlugins() || []) : [];
        var links = plugins.filter(function (p) { return p.type === 'link'; }).length;
        var cats = 0, maxDepth = 0;
        (function walk(nodes, depth) {
          (nodes || []).forEach(function (n) {
            if (n.type === 'folder') {
              cats++;
              maxDepth = Math.max(maxDepth, depth + 1);
              walk(n.children, depth + 1);
            }
          });
        })((typeof global.getCategories === 'function') ? global.getCategories() : [], 0);
        return { plugins: plugins.length - links, links: links, categories: cats, maxDepth: maxDepth };
      });

      // 错误日志：定时刷新，保证运行期新错误即时出现在设置页
      var errTick = ref(0);
      var errTimer = null;
      errTimer = setInterval(function () { errTick.value++; }, 600);
      if (Vue.onUnmounted) Vue.onUnmounted(function () { if (errTimer) clearInterval(errTimer); });

      // list() = 全部（本次会话 + 持久化的历史）→ 设置页完整日志
      var errors = computed(function () {
        errTick.value; tick.value;
        return (global.$dbpError && typeof global.$dbpError.list === 'function') ? (global.$dbpError.list() || []) : [];
      });
      var errorCount = computed(function () { return (errors.value || []).length; });
      var maxErrors = computed(function () {
        return (global.$dbpError && global.$dbpError.MAX) || 20;
      });
      // ★ 只有本次会话的致命错误才锁住「清除记录」，历史 fatal 不影响
      var hasFatal = computed(function () {
        errTick.value; tick.value;
        var bus = global.$dbpError;
        var live = bus ? ((bus.liveList ? bus.liveList() : bus.list()) || []) : [];
        return live.some(function (e) { return e && e.fatal; });
      });

      function copyErrors() {
        var text = (errors.value || []).map(function (e, i) {
          return '[' + (i + 1) + '] ' + e.phase + ' | ' + e.message + '\n    time: ' + e.time + '\n    stack: ' + (e.stack || '');
        }).join('\n\n');
        if (global.copyText) global.copyText(text || '（无错误）');
        else if (navigator.clipboard) navigator.clipboard.writeText(text);
      }

      function clearErrors() {
        if (hasFatal.value) { if (global.showToast) global.showToast('存在致命错误，请刷新页面', 'warn'); return; }
        var doIt = function () {
          if (global.$dbpError && global.$dbpError.clear) global.$dbpError.clear();
          tick.value++;
          if (global.showToast) global.showToast('错误记录已清除', 'success');
        };
        if (global.showConfirm) global.showConfirm('确定清除全部错误记录？', doIt, function () {});
        else doIt();
      }

      function hardReload() {
        var url = window.location.href.split('#')[0];
        var sep = url.indexOf('?') === -1 ? '?' : '&';
        window.location.href = url + sep + '_t=' + Date.now() + (window.location.hash || '');
        window.location.reload();
      }

      function clearThemeOnly() {
        try { localStorage.removeItem('dbp-theme'); } catch (e) {}
        // ★ 默认改为「跟随系统」（与 app.js 的 DEFAULT_THEME 保持一致）
        if (typeof global.applyTheme === 'function') global.applyTheme('system');
        if (global.showToast) global.showToast('主题已重置为「跟随系统」', 'success');
      }

      function openEditor() {
        window.open('./plugin-editor.html', '_blank', 'noopener');
      }

      function resetAll() {
        var doIt = function () {
          try {
            Object.keys(localStorage).forEach(function (k) {
              if (k.indexOf('dbp-') === 0 || k.indexOf('dbp_') === 0) localStorage.removeItem(k);
            });
          } catch (e) {}
          if (global.showToast) global.showToast('本地数据已清空，正在重载…', 'success');
          setTimeout(function () { window.location.reload(); }, 600);
        };
        if (global.showConfirm) global.showConfirm('将清空主题、错误记录等全部本地数据并重载页面，确定继续？', doIt, function () {});
        else doIt();
      }

      return {
        version: version, themeMode: themeMode, resolvedTheme: resolvedTheme,
        setThemeMode: setThemeMode,
        notFoundStyle: notFoundStyle, setNotFoundStyle: setNotFoundStyle, preview404: preview404,
        glass: glass, glassPresets: glassPresets, setGlass: setGlass, onGlassInput: onGlassInput, resetGlass: resetGlass,
        glassBlur: glassBlur, glassBlurPresets: glassBlurPresets, setGlassBlur: setGlassBlur, onGlassBlurInput: onGlassBlurInput, resetGlassBlur: resetGlassBlur,
        accent: accent, accentPresets: accentPresets,
        setAccentColor: setAccentColor, onAccentInput: onAccentInput, resetAccentColor: resetAccentColor,
        stats: stats, errors: errors, errorCount: errorCount, maxErrors: maxErrors, hasFatal: hasFatal,
        copyErrors: copyErrors, clearErrors: clearErrors,
        hardReload: hardReload, clearThemeOnly: clearThemeOnly, openEditor: openEditor, resetAll: resetAll,
        vueVersion: (global.Vue && global.Vue.version) || '-',
        routerVersion: (global.VueRouter && global.VueRouter.version) || '-',
      };
    },
  };

  global.DBP_SETTINGS_COMPONENT = SettingsPage;
  global.DBP_SETTINGS_ROUTE = {
    path: '/settings',
    name: 'settings',
    component: SettingsPage,
    meta: { title: '设置', icon: 'fas fa-sliders-h', builtin: true, pluginType: 'builtin' },
  };

  console.log('[Settings] 框架内置设置页已注册 (v' + SETTINGS_VERSION + ')');
})(window);
