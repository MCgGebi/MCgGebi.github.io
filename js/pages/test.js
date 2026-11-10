/* ========================================
   DBP-HUB · 插件测试场 v0.9.20
   演示 definePlugin 宽松写法的各种姿势 + 常用 API
   ======================================== */
definePlugin('test', {
  template: `
    <div class="page-plugin">
      <div class="section-title">
        <span class="st-label"><i class="fas fa-flask" style="color:var(--accent);margin-right:6px;"></i>插件测试场</span>
      </div>
      <p class="section-desc">测试 definePlugin 各种写法与框架 API（v0.9.20）</p>

      <div class="card open" style="margin-bottom:14px;">
        <div class="card-header" onclick="if(window.toggleCard)toggleCard(this)">
          <span class="badge" style="background:var(--accent);color:#fff;">写法 1</span>
          <span style="flex:1;font-size:12px;">最简：definePlugin(id, {template})</span>
        </div>
        <div class="card-body">
          <pre class="md-code"><code>definePlugin('my-tool', {
  template: \`&lt;div class="page-plugin"&gt;...&lt;/div&gt;\`
});</code></pre>
          <p style="font-size:12px;color:var(--text-muted);">缺字段自动补全：version=0.1.0、path=/my-tool、icon=fas fa-cube、title=my-tool</p>
        </div>
      </div>

      <div class="card open" style="margin-bottom:14px;">
        <div class="card-header" onclick="if(window.toggleCard)toggleCard(this)">
          <span class="badge" style="background:var(--blue);color:#fff;">写法 2</span>
          <span style="flex:1;font-size:12px;">带 options（推荐）</span>
        </div>
        <div class="card-body">
          <pre class="md-code"><code>definePlugin('my-tool', { template }, {
  title: '我的工具', icon: 'fas fa-star',
  version: '1.0.0', badge: 'NEW', badgeClass: 'new'
});</code></pre>
        </div>
      </div>

      <div class="card open" style="margin-bottom:14px;">
        <div class="card-header" onclick="if(window.toggleCard)toggleCard(this)">
          <span class="badge" style="background:var(--purple);color:#fff;">写法 3</span>
          <span style="flex:1;font-size:12px;">对象形式（含 setup）</span>
        </div>
        <div class="card-body">
          <pre class="md-code"><code>definePlugin({
  id: 'counter', title: '计数器', icon: 'fas fa-plus',
  setup() {
    var count = Vue.ref(0);
    return { count, inc: function(){ count.value++; } };
  },
  template: \`&lt;button @click="inc"&gt;{{ count }}&lt;/button&gt;\`
});</code></pre>
        </div>
      </div>

      <div class="section-title" style="margin-top:8px;">
        <span class="st-label"><i class="fas fa-cubes" style="color:var(--accent);margin-right:6px;"></i>API 测试</span>
      </div>

      <div class="toolbar" style="margin-bottom:14px;">
        <button class="btn btn-primary btn-sm" @click="showToast"><i class="fas fa-bell"></i> showToast</button>
        <button class="btn btn-outline btn-sm" @click="showConfirm"><i class="fas fa-question"></i> showConfirm</button>
        <button class="btn btn-outline btn-sm" @click="copyDemo"><i class="fas fa-copy"></i> copyText</button>
        <button class="btn btn-outline btn-sm" @click="throwError"><i class="fas fa-bug"></i> 触发运行时错误</button>
      </div>

      <div class="card open">
        <div class="card-header" onclick="if(window.toggleCard)toggleCard(this)">
          <span class="card-arrow">&#9654;</span>
          <span class="badge" style="background:var(--warn);color:#fff;">计数器演示</span>
          <span style="flex:1;font-size:12px;">setup() + ref + v-model</span>
        </div>
        <div class="card-body">
          <div style="display:flex;align-items:center;gap:12px;">
            <button class="btn btn-outline btn-sm" @click="count--">−</button>
            <span style="font-size:24px;font-weight:700;min-width:48px;text-align:center;color:var(--accent);">{{ count }}</span>
            <button class="btn btn-primary btn-sm" @click="count++">+</button>
            <span style="font-size:11px;color:var(--text-muted);margin-left:12px;">双向绑定测试 →</span>
            <input class="form-input" style="max-width:160px;" type="number" v-model.number="count">
          </div>
          <p style="font-size:11px;color:var(--text-muted);margin-top:10px;">
            当前主题：<code>{{ theme }}</code> → 切换顶栏主题按钮，颜色会随之变化
          </p>
        </div>
      </div>
    </div>
  `,
  setup: function () {
    var Vue = window.Vue;
    var ref = Vue.ref, onMounted = Vue.onMounted;

    var count = ref(0);

    // 读取当前主题（与顶栏双向同步）
    var theme = ref((function () {
      try { return localStorage.getItem('dbp-theme') || 'dark'; } catch(e) { return 'dark'; }
    })());

    onMounted(function () {
      // 监听主题变化（storage 事件跨标签，此处轮询兜底）
      var timer = setInterval(function () {
        try {
          var t = localStorage.getItem('dbp-theme') || 'dark';
          if (t !== theme.value) theme.value = t;
        } catch(e) {}
      }, 500);
      // 组件销毁时清理（Vue3 setup 返回的函数即为 unmount 钩子 → 此处简化，页面级不严格）
      return function () { clearInterval(timer); };
    });

    function showToast() {
      (window.showToast || window.showAlert)('这是一条 toast 通知', 'success');
    }
    function showConfirm() {
      window.showConfirm('确认执行此操作吗？', function () {
        window.showToast && window.showToast('已确认', 'success');
      });
    }
    function copyDemo() {
      window.copyText && window.copyText('definePlugin 示例文本 ' + new Date().toLocaleTimeString());
    }
    function throwError() {
      // 故意抛错 → 被 Vue errorHandler 捕获 → 进入常驻错误面板
      try { JSON.parse('{invalid json'); } catch (e) { throw e; }
    }

    return { count: count, theme: theme, showToast: showToast, showConfirm: showConfirm, copyDemo: copyDemo, throwError: throwError };
  },
}, { title: '插件测试场', icon: 'fas fa-flask', version: '0.9.10' });
