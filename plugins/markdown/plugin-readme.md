# DBP-HUB 插件开发文档

> **版本**：v0.9.4  
> **适用**：DBP-HUB 单页应用框架  
> **最后更新**：2026-08-14

---

## 📖 目录

- [一、插件系统概述](#一插件系统概述)
- [二、快速开始（30 秒上手）](#二快速开始30-秒上手)
- [三、JS 插件开发](#三js-插件开发)
- [四、HTML 插件开发](#四html-插件开发)
- [五、plugins.json 完整配置](#五pluginsjson-完整配置)
- [六、框架 API 参考](#六框架-api-参考)
- [七、样式规范与可用类](#七样式规范与可用类)
- [八、图标使用指南](#八图标使用指南)
- [九、调试与排错](#九调试与排错)
- [十、最佳实践](#十最佳实践)
- [附录：完整模板下载](#附录完整模板下载)

---

## 一、插件系统概述

### 1.1 两种插件格式

DBP-HUB 支持两种插件格式，**完全兼容、可混用**：

| 对比项 | JS 插件 | HTML 插件 |
|---|---|---|
| **文件格式** | `.js` | `.html` |
| **存放位置** | `js/pages/xxx.js` | `plugins/html/xxx.html` |
| **注册方式** | IIFE + `registerPlugin()` | `plugins.json` 声明即可 |
| **渲染方式** | Vue 组件（响应式） | iframe 或 inline 注入 |
| **适合场景** | 深度集成、数据驱动、复杂交互 | 快速移植旧工具、第三方页面、独立样式 |
| **可用框架 API** | ✅ 全部（路由/模态框/工具函数） | ⚠️ 仅 iframe 内可用部分 |
| **加载方式** | 点击菜单时 `fetch` + `eval` | 点击菜单时 `fetch` + 插入 DOM |
| **样式隔离** | ❌ 共享框架 CSS | ✅ iframe 完全隔离 / inline 部分共享 |
| **开发难度** | ⭐⭐⭐（需懂 Vue） | ⭐（会写 HTML 就行） |

### 1.2 加载流程

```
用户点击菜单
    ↓
router beforeEnter 守卫触发
    ↓
plugin-loader.js → loadPlugin(pluginId)
    ↓
读取 plugins.json 中的插件元数据
    ↓
判断 pluginType
    ├─ "js" → fetch('./js/pages/xxx.js') → new Function(code).call(window) → registerPlugin()
    └─ "html" → fetch('./plugins/html/xxx.html') → 根据 renderMode 渲染
                    ├─ "iframe" → 创建 <iframe sandbox> 加载
                    └─ "inline" → v-html 注入 + 执行 <script>
    ↓
插件注册完成 → Vue 组件渲染 → 页面显示
```

### 1.3 目录结构

```
dbp-hub/
├── index.html                    ← 框架入口（不用改）
├── js/
│   ├── plugin-loader.js          ← 插件加载器（不用改）
│   ├── router.js                 ← 路由管理（不用改）
│   ├── app.js                    ← 应用核心（不用改）
│   ├── init.js                   ← 初始化逻辑（不用改）
│   ├── utils.js                  ← 工具函数（不用改）
│   ├── plugins.json              ← ⭐ 插件注册表（你要改这里）
│   └── pages/                    ← ⭐ JS 插件目录
│       ├── home.js
│       ├── crafting.js
│       └── your-plugin.js        ← 你的 JS 插件放这里
├── plugins/
│   └── html/                     ← ⭐ HTML 插件目录
│       ├── demo-iframe.html
│       ├── demo-inline.html
│       └── your-tool.html        ← 你的 HTML 插件放这里
├── styles/
│   └── main.css                  ← 全局样式（不用改）
└── vendor/                       ← 第三方库（不用改）
    ├── vue.global.prod.js
    ├── vue-router.global.prod.js
    └── font-awesome.min.css
```

---

## 二、快速开始（30 秒上手）

### 2.1 JS 插件 — 3 步搞定

**第 1 步**：创建 `js/pages/my-tool.js`，复制下面的**最简模板**：

```javascript
(function (global) {
  'use strict';
  var Vue = global.Vue;

  // 页面组件
  var MyToolPage = {
    template: `
      <div class="page-wrapper">
        <div class="section-title">
          <span class="st-label">
            <i class="fas fa-star" style="color:var(--accent);margin-right:8px;"></i>
            我的工具
          </span>
        </div>
        <p class="section-desc">一句话描述这个工具做什么</p>

        <div class="card open">
          <div class="card-header" onclick="toggleCard(this)">
            <span class="card-arrow">▶</span>
            <span class="badge" style="background:var(--accent);color:#fff;">MAIN</span>
            <span style="flex:1;font-size:12px;color:#ccc;">主要内容</span>
          </div>
          <div class="card-body">
            <p>在这里写你的内容，支持所有 HTML 标签</p>
            <button class="btn btn-primary" @click="sayHi">点我</button>
            <p v-if="msg" style="margin-top:10px;color:var(--accent)">{{ msg }}</p>
          </div>
        </div>
      </div>
    `,
    setup: function () {
      var msg = Vue.ref('');
      function sayHi() { msg.value = '你好，DBP-HUB！'; }
      return { msg: msg, sayHi: sayHi };
    }
  };

  // 注册到框架
  global.registerPlugin({
    id: 'my-tool',
    title: '我的工具',
    version: '0.1.0',
    route: {
      path: '/my-tool',
      component: MyToolPage,
      meta: { title: '我的工具', icon: 'fas fa-star' }
    },
    nav: {
      group: '常用工具',
      groupOrder: 1,
      item: {
        path: '/my-tool',
        title: '我的工具',
        icon: 'fas fa-star',
        badge: 'NEW',
        badgeClass: 'new'
      }
    }
  });
})(window);
```

**第 2 步**：打开 `js/plugins.json`，在对应分组的 `children` 里加一行：

```json
{
  "id": "common",
  "title": "常用工具",
  "type": "folder",
  "defaultExpanded": true,
  "children": [
    { "id": "home", "type": "plugin", "title": "首页", "icon": "fas fa-home", "path": "/home" },
    { "id": "my-tool", "type": "plugin", "title": "我的工具", "icon": "fas fa-star", "path": "/my-tool", "badge": "NEW", "badgeClass": "new" }
  ]
}
```

**第 3 步**：刷新浏览器 → 侧边栏出现「我的工具」→ 点击 → 自动加载 ✅

---

### 2.2 HTML 插件 — 2 步搞定

**第 1 步**：创建 `plugins/html/my-tool.html`，写普通 HTML 就行：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>我的工具</title>
  <style>
    /* 这里写你的样式，iframe 模式下完全隔离 */
    body { font-family: sans-serif; padding: 20px; background: #1a1a2e; color: #eee; }
    .btn { padding: 10px 20px; background: #3b8526; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
    .btn:hover { background: #4a9c30; }
    .result { margin-top: 15px; padding: 15px; background: #16213e; border-radius: 8px; }
  </style>
</head>
<body>
  <h1>🎮 我的 MC 工具</h1>
  <p>这是一个纯 HTML 插件，不需要写 JS 包装。</p>
  <button class="btn" onclick="calculate()">计算</button>
  <div class="result" id="output">点击按钮看结果</div>

  <script>
    function calculate() {
      var r = Math.random() * 100;
      document.getElementById('output').innerHTML =
        '随机结果: <strong style="color:#4cc8e0">' + r.toFixed(2) + '</strong>';
    }
  </script>
</body>
</html>
```

**第 2 步**：打开 `js/plugins.json`，加一行配置：

```json
{
  "id": "my-tool-html",
  "type": "plugin",
  "title": "我的HTML工具",
  "icon": "fas fa-file-code",
  "path": "/my-tool-html",
  "pluginType": "html",
  "renderMode": "iframe",
  "src": "./plugins/html/my-tool.html",
  "version": "0.1.0"
}
```

刷新浏览器 → 点击菜单 → 自动加载 ✅

---

## 三、JS 插件开发

### 3.1 完整文件结构

```javascript
(function (global) {
  'use strict';

  // ─── 1. 依赖获取 ───
  var Vue = global.Vue;
  var ref = Vue.ref;
  var computed = Vue.computed;
  var reactive = Vue.reactive;

  // ─── 2. 页面组件 ───
  var MyPluginPage = {
    // 模板（HTML + Vue 指令）
    template: `...`,

    // 组合式 API（相当于原来的 data + methods + computed）
    setup: function () {
      // 响应式数据
      var count = ref(0);
      var list = reactive([...]);

      // 计算属性
      var total = computed(function () { return list.length; });

      // 方法
      function add() { count.value++; }
      function remove(i) { list.splice(i, 1); }

      // ⚠️ 必须 return 出去才能在模板中使用
      return { count: count, list: list, total: total, add: add, remove: remove };
    }
  };

  // ─── 3. 注册插件 ───
  global.registerPlugin({
    id: 'my-plugin',
    title: '我的插件',
    version: '0.1.0',
    route: { ... },
    nav: { ... }
  });

})(window);
```

### 3.2 模板编写规则

#### ✅ 允许使用的 Vue 特性

```html
<!-- 数据绑定 -->
<p>{{ message }}</p>
<input v-model="search" placeholder="搜索...">

<!-- 条件渲染 -->
<div v-if="loading">加载中...</div>
<div v-else-if="error">出错了</div>
<div v-else>内容</div>

<!-- 列表渲染 -->
<tr v-for="(item, index) in filtered" :key="item.id">
  <td>{{ index + 1 }}</td>
  <td>{{ item.name }}</td>
</tr>

<!-- 事件绑定（禁止 onclick，必须用 @click） -->
<button @click="save">保存</button>
<button @click="del(item.id)">删除</button>

<!-- 属性绑定 -->
<a :href="link">链接</a>
<div :class="{ active: isActive }">动态样式</div>

<!-- 双向绑定数字 -->
<input type="range" class="native-range" v-model.number="value">
```

#### ❌ 禁止事项

| 禁止写法 | 原因 | 正确写法 |
|---|---|---|
| `onclick="fn()"` | 内联事件在懒加载中不安全 | `@click="fn"` |
| `document.getElementById()` | 破坏响应式 | `ref()` + `v-model` |
| `alert()` / `confirm()` | 阻塞主线程 | `global.showAlert()` / `global.showConfirm()` |
| `location.href = '#'` | 绕过路由 | `router.push('/path')` |
| 绝对路径 `/img/x.png` | 部署路径不确定 | 相对路径或 Font Awesome 图标 |
| `<style>` 标签 | 污染全局样式 | 用 `style` 属性或申请全局类 |
| `window.xxx = ...` | 全局污染 | 在 `setup()` 内定义 |

### 3.3 setup() 中的数据管理

```javascript
setup: function () {
  // ── 基础响应式值 ──
  var search = ref('');
  var count = ref(0);
  var selected = ref(null);

  // ── 响应式对象/数组 ──
  var form = reactive({ name: '', value: 0 });
  var list = ref([...]);  // 数组用 ref 也行

  // ── 计算属性 ──
  var filtered = computed(function () {
    if (!search.value) return list.value;
    var q = search.value.toLowerCase();
    return list.value.filter(function (x) {
      return x.name.toLowerCase().includes(q);
    });
  });

  // ── 方法 ──
  function add() {
    list.value.push({ name: '新项', value: 0 });
  }

  function remove(index) {
    list.value.splice(index, 1);
  }

  // ── 生命周期 ──
  // Vue 3 setup 本身就相当于 created
  // 如果需要 mounted：
  Vue.onMounted(function () {
    console.log('页面已挂载');
  });

  // ── 必须 return ──
  return {
    search: search,
    count: count,
    selected: selected,
    form: form,
    list: list,
    filtered: filtered,
    add: add,
    remove: remove
  };
}
```

### 3.4 使用框架 API

```javascript
setup: function () {
  // ── 弹出提示 ──
  function showTip() {
    global.showAlert('操作成功！', '提示');
  }

  // ── 确认对话框 ──
  function confirmDelete() {
    global.showConfirm('确定删除吗？', function () {
      // 确认回调
      global.showAlert('已删除', '提示');
    }, function () {
      // 取消回调
      console.log('取消了');
    });
  }

  // ── 路由跳转 ──
  function goToCrafting() {
    global.router.push('/crafting');
  }

  // ── 复制到剪贴板 ──
  function copyText() {
    if (global.copyToClipboard) {
      global.copyToClipboard('要复制的文本');
      global.showAlert('已复制', '提示');
    }
  }

  return { showTip: showTip, confirmDelete: confirmDelete, goToCrafting: goToCrafting, copyText: copyText };
}
```

### 3.5 完整实战示例：附魔模拟器

```javascript
(function (global) {
  'use strict';
  var Vue = global.Vue;
  var ref = Vue.ref;
  var computed = Vue.computed;

  var EnchantPage = {
    template: `
      <div class="page-wrapper">
        <div class="section-title">
          <span class="st-label">
            <i class="fas fa-magic" style="color:var(--accent);margin-right:8px;"></i>
            附魔模拟器
          </span>
        </div>
        <p class="section-desc">模拟附魔台效果，预测附魔结果</p>

        <!-- 配置区 -->
        <div class="card open" style="margin-bottom:14px;">
          <div class="card-header" onclick="toggleCard(this)">
            <span class="card-arrow">▶</span>
            <span class="badge" style="background:var(--blue);color:#fff;">CONFIG</span>
            <span style="flex:1;font-size:12px;color:#ccc;">附魔配置</span>
          </div>
          <div class="card-body">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div class="form-group">
                <label class="form-label">物品类型</label>
                <select class="form-select" v-model="itemType">
                  <option value="sword">钻石剑</option>
                  <option value="pickaxe">钻石镐</option>
                  <option value="bow">弓</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">附魔等级: {{ level }}</label>
                <input type="range" class="native-range" min="1" max="30" v-model.number="level">
              </div>
            </div>
          </div>
        </div>

        <!-- 结果区 -->
        <div class="card open">
          <div class="card-header" onclick="toggleCard(this)">
            <span class="card-arrow">▶</span>
            <span class="badge" style="background:var(--accent);color:#fff;">RESULT</span>
            <span style="flex:1;font-size:12px;color:#ccc;">预测结果</span>
          </div>
          <div class="card-body">
            <div v-if="enchants.length === 0" style="color:#888;text-align:center;padding:20px;">
              点击「模拟附魔」查看结果
            </div>
            <table v-else class="data-table">
              <thead>
                <tr><th>附魔</th><th>等级</th><th>概率</th></tr>
              </thead>
              <tbody>
                <tr v-for="e in enchants" :key="e.name">
                  <td><i class="fas fa-sparkles" style="color:var(--accent)"></i> {{ e.name }}</td>
                  <td>{{ e.level }}</td>
                  <td>{{ e.chance }}%</td>
                </tr>
              </tbody>
            </table>
            <button class="btn btn-primary" style="margin-top:12px;" @click="simulate">
              <i class="fas fa-dice"></i> 模拟附魔
            </button>
          </div>
        </div>
      </div>
    `,
    setup: function () {
      var itemType = ref('sword');
      var level = ref(15);
      var enchants = ref([]);

      // 附魔池（简化版）
      var pools = {
        sword: [
          { name: '锋利', max: 5 }, { name: '火焰附加', max: 2 },
          { name: '抢夺', max: 3 }, { name: '击退', max: 2 },
          { name: '亡灵杀手', max: 5 }, { name: '节肢杀手', max: 5 }
        ],
        pickaxe: [
          { name: '时运', max: 3 }, { name: '效率', max: 5 },
          { name: '精准采集', max: 1 }, { name: '耐久', max: 3 }
        ],
        bow: [
          { name: '力量', max: 5 }, { name: '冲击', max: 2 },
          { name: '火矢', max: 1 }, { name: '无限', max: 1 }
        ]
      };

      function simulate() {
        var pool = pools[itemType.value] || [];
        var count = 1 + Math.floor(Math.random() * 3); // 1~3 个附魔
        var result = [];
        var used = {};

        for (var i = 0; i < count; i++) {
          var idx = Math.floor(Math.random() * pool.length);
          if (used[idx]) continue;
          used[idx] = true;
          var enchant = pool[idx];
          var lvl = 1 + Math.floor(Math.random() * enchant.max);
          var chance = Math.min(80, 20 + level.value * 2);
          result.push({ name: enchant.name, level: lvl, chance: chance });
        }

        enchants.value = result;
      }

      return { itemType: itemType, level: level, enchants: enchants, simulate: simulate };
    }
  };

  global.registerPlugin({
    id: 'enchant-sim',
    title: '附魔模拟器',
    version: '0.1.0',
    route: {
      path: '/enchant-sim',
      component: EnchantPage,
      meta: { title: '附魔模拟器', icon: 'fas fa-magic' }
    },
    nav: {
      group: '常用工具',
      groupOrder: 1,
      item: {
        path: '/enchant-sim',
        title: '附魔模拟器',
        icon: 'fas fa-magic',
        badge: 'NEW',
        badgeClass: 'new'
      }
    }
  });
})(window);
```

---

## 四、HTML 插件开发

### 4.1 两种渲染模式

| 模式 | 配置值 | 原理 | 样式隔离 | JS 隔离 | 适用场景 |
|---|---|---|---|---|---|
| **iframe** | `"renderMode": "iframe"` | 在 `<iframe sandbox>` 中加载 | ✅ 完全隔离 | ✅ 完全隔离 | 独立工具、第三方页面、需要独立样式 |
| **inline** | `"renderMode": "inline"` | 通过 `v-html` 注入到框架 DOM | ❌ 共享框架 CSS | ⚠️ 脚本可执行但共享全局 | 快速原型、简单页面、想继承框架主题 |

### 4.2 iframe 模式（推荐）

#### 配置

```json
{
  "id": "my-iframe-tool",
  "type": "plugin",
  "title": "我的iframe工具",
  "icon": "fas fa-cube",
  "path": "/my-iframe-tool",
  "pluginType": "html",
  "renderMode": "iframe",
  "src": "./plugins/html/my-tool.html",
  "version": "0.1.0"
}
```

#### HTML 文件写法（完全自由的普通 HTML）

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>红石计算器</title>
  <style>
    /* ✅ 样式完全独立，不会影响框架 */
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #1a1a2e, #16213e);
      color: #eee;
      padding: 24px;
      min-height: 100vh;
    }
    h1 { color: #e74c3c; margin-bottom: 16px; }
    .panel {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 16px;
    }
    .calc-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-top: 12px;
    }
    .calc-btn {
      padding: 16px;
      font-size: 18px;
      border: none;
      border-radius: 8px;
      background: #e74c3c;
      color: #fff;
      cursor: pointer;
      transition: all 0.2s;
    }
    .calc-btn:hover { background: #c0392b; transform: scale(1.05); }
    .calc-display {
      width: 100%;
      padding: 16px;
      font-size: 24px;
      text-align: right;
      background: #0d1117;
      color: #4cc8e0;
      border: 2px solid #333;
      border-radius: 8px;
      margin-bottom: 12px;
    }
  </style>
</head>
<body>
  <h1>🔴 红石计算器</h1>

  <div class="panel">
    <input class="calc-display" id="display" value="0" readonly>
    <div class="calc-grid">
      <button class="calc-btn" onclick="press('7')">7</button>
      <button class="calc-btn" onclick="press('8')">8</button>
      <button class="calc-btn" onclick="press('9')">9</button>
      <button class="calc-btn" onclick="press('4')">4</button>
      <button class="calc-btn" onclick="press('5')">5</button>
      <button class="calc-btn" onclick="press('6')">6</button>
      <button class="calc-btn" onclick="press('1')">1</button>
      <button class="calc-btn" onclick="press('2')">2</button>
      <button class="calc-btn" onclick="press('3')">3</button>
      <button class="calc-btn" onclick="clearDisplay()">C</button>
      <button class="calc-btn" onclick="press('0')">0</button>
      <button class="calc-btn" onclick="calculate()">=</button>
    </div>
  </div>

  <div class="panel">
    <h3>📝 使用说明</h3>
    <p style="margin-top:8px;color:#aaa;line-height:1.6;">
      这是一个 iframe 模式的 HTML 插件示例。<br>
      样式完全独立，不会影响外部框架。<br>
      你可以写任何普通的 HTML/CSS/JS。
    </p>
  </div>

  <script>
    var display = document.getElementById('display');
    var current = '0';

    function press(val) {
      if (current === '0') current = val;
      else current += val;
      display.value = current;
    }

    function clearDisplay() {
      current = '0';
      display.value = current;
    }

    function calculate() {
      try {
        current = String(eval(current));
        display.value = current;
      } catch(e) {
        display.value = 'Error';
        current = '0';
      }
    }
  </script>
</body>
</html>
```

#### iframe 安全沙箱

框架自动为 iframe 添加以下 sandbox 属性：

```html
<iframe sandbox="allow-scripts allow-same-origin allow-forms allow-popups">
```

| 权限 | 说明 |
|---|---|
| `allow-scripts` | 允许执行 JS |
| `allow-same-origin` | 允许访问同源资源（fetch 本地文件） |
| `allow-forms` | 允许表单提交 |
| `allow-popups` | 允许 `window.open()` |

> ⚠️ 如需额外权限（如摄像头），需在 `plugin-loader.js` 的 `createHtmlPluginComponent()` 中修改 sandbox 属性。

### 4.3 inline 模式

#### 配置

```json
{
  "id": "my-inline-tool",
  "type": "plugin",
  "title": "我的inline工具",
  "icon": "fas fa-code",
  "path": "/my-inline-tool",
  "pluginType": "html",
  "renderMode": "inline",
  "src": "./plugins/html/my-inline.html",
  "version": "0.1.0"
}
```

#### HTML 文件写法（注意样式命名空间）

```html
<!-- inline 模式：HTML 会被注入到框架 DOM 中 -->
<!-- ⚠️ 样式可能和框架冲突，建议加前缀 -->

<style>
  .my-tool-wrap { padding: 16px; }
  .my-tool-wrap h2 { color: var(--accent); margin-bottom: 12px; }
  .my-tool-wrap .tool-btn {
    padding: 8px 16px;
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 6px;
    cursor: pointer;
  }
  .my-tool-wrap .tool-btn:hover { opacity: 0.85; }
  .my-tool-wrap .output {
    margin-top: 12px;
    padding: 12px;
    background: var(--panel-2);
    border-radius: 8px;
    min-height: 60px;
  }
</style>

<div class="my-tool-wrap">
  <h2>🎨 快速颜色生成器</h2>
  <p style="color:#aaa;margin-bottom:12px;">点击按钮生成随机 MC 颜色代码</p>
  <button class="tool-btn" onclick="genColor()">生成颜色</button>
  <div class="output" id="colorOut">等待生成...</div>
</div>

<script>
  function genColor() {
    var colors = ['#3b8526','#4cc8e0','#e74c3c','#f39c12','#9b59b6','#1abc9c'];
    var c = colors[Math.floor(Math.random() * colors.length)];
    document.getElementById('colorOut').innerHTML =
      '<span style="color:' + c + ';font-size:20px;font-weight:bold;">' + c + '</span>' +
      '<br><span style="color:#888;font-size:12px;">MC 颜色代码</span>';
  }
</script>
```

#### inline vs iframe 对比

| 特性 | iframe | inline |
|---|---|---|
| 样式隔离 | ✅ 完全隔离 | ❌ 可能冲突（加命名空间） |
| JS 隔离 | ✅ 独立全局 | ⚠️ 共享 `window`（可能污染） |
| 可用框架 CSS 变量 | ❌ 需自己定义 | ✅ 可直接用 `var(--accent)` |
| 可用框架组件 | ❌ 不行 | ⚠️ 部分可用 |
| 调试难度 | 需进 iframe 检查 | 直接在父页面看 |
| 加载速度 | 稍慢（多一层文档） | 更快（直接注入） |
| 推荐度 | ⭐⭐⭐⭐⭐（默认推荐） | ⭐⭐⭐（特殊场景） |

### 4.4 HTML 插件访问框架功能

由于沙箱限制，iframe 中的 HTML **不能直接调用**框架的 `showAlert` 等 API。如需通信，使用 `postMessage`：

```html
<!-- iframe 内的 HTML -->
<script>
  // 发送消息给父框架
  function notifyParent(msg) {
    parent.postMessage({ type: 'dbp-notify', message: msg }, '*');
  }

  // 请求父框架显示提示
  function showAlert(msg) {
    parent.postMessage({ type: 'dbp-alert', message: msg }, '*');
  }

  // 接收父框架消息
  window.addEventListener('message', function(e) {
    if (e.data.type === 'dbp-init') {
      console.log('收到框架初始化数据:', e.data.payload);
    }
  });
</script>
```

> 框架侧已内置 `message` 监听，支持 `dbp-alert` 和 `dbp-notify` 两种消息类型。

---

## 五、plugins.json 完整配置

### 5.1 文件结构

```json
{
  "version": "0.9.4",
  "plugins": [
    { "...": "插件配置项（见下方）" }
  ]
}
```

### 5.2 JS 插件配置项

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | ✅ | 唯一标识符，如 `"crafting"` |
| `type` | string | ✅ | 固定 `"plugin"` |
| `title` | string | ✅ | 菜单显示名称 |
| `icon` | string | ✅ | Font Awesome 图标类，如 `"fas fa-hammer"` |
| `path` | string | ✅ | 路由路径，如 `"/crafting"` |
| `pluginType` | string | ❌ | 省略或 `"js"` 表示 JS 插件 |
| `src` | string | ❌ | JS 插件自动推断为 `./js/pages/{id}.js` |
| `version` | string | ✅ | 插件版本号，如 `"0.1.0"` |
| `badge` | string | ❌ | 徽章文字，如 `"NEW"`、`"HOT"` |
| `badgeClass` | string | ❌ | 徽章样式：`"new"` / `"hot"` / `"update"` |

### 5.3 HTML 插件配置项

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | ✅ | 唯一标识符 |
| `type` | string | ✅ | 固定 `"plugin"` |
| `title` | string | ✅ | 菜单显示名称 |
| `icon` | string | ✅ | Font Awesome 图标类 |
| `path` | string | ✅ | 路由路径 |
| `pluginType` | string | ✅ | 固定 `"html"` |
| `renderMode` | string | ✅ | `"iframe"` 或 `"inline"` |
| `src` | string | ✅ | HTML 文件路径，如 `"./plugins/html/xxx.html"` |
| `version` | string | ✅ | 插件版本号 |

### 5.4 分组（文件夹）配置

```json
{
  "id": "tools",
  "title": "进阶工具",
  "type": "folder",
  "defaultExpanded": false,
  "children": [
    { "...": "子插件或子文件夹" }
  ]
}
```

| 字段 | 说明 |
|---|---|
| `id` | 分组唯一 ID |
| `title` | 分组显示名称 |
| `type` | `"folder"` 表示分组 |
| `defaultExpanded` | 默认是否展开（`true`/`false`） |
| `children` | 子项数组（可嵌套文件夹） |

### 5.5 完整 plugins.json 示例

```json
{
  "version": "0.9.4",
  "plugins": [
    {
      "id": "common",
      "title": "常用工具",
      "type": "folder",
      "defaultExpanded": true,
      "children": [
        { "id": "home", "type": "plugin", "title": "首页", "icon": "fas fa-home", "path": "/home" },
        { "id": "crafting", "type": "plugin", "title": "合成查询", "icon": "fas fa-hammer", "path": "/crafting", "badge": "HOT", "badgeClass": "hot" },
        { "id": "enchant-sim", "type": "plugin", "title": "附魔模拟器", "icon": "fas fa-magic", "path": "/enchant-sim", "badge": "NEW", "badgeClass": "new" }
      ]
    },
    {
      "id": "tools",
      "title": "进阶工具",
      "type": "folder",
      "defaultExpanded": false,
      "children": [
        { "id": "seed-map", "type": "plugin", "title": "种子地图", "icon": "fas fa-map", "path": "/seed-map" },
        {
          "id": "redstone",
          "title": "红石系统",
          "type": "folder",
          "defaultExpanded": false,
          "children": [
            { "id": "redstone-calc", "type": "plugin", "title": "红石计算器", "icon": "fas fa-calculator", "path": "/redstone-calc" },
            { "id": "redstone-sim", "type": "plugin", "title": "电路模拟器", "icon": "fas fa-microchip", "path": "/redstone-sim", "badge": "NEW", "badgeClass": "new" }
          ]
        }
      ]
    },
    {
      "id": "html-demos",
      "title": "HTML 插件示例",
      "type": "folder",
      "defaultExpanded": false,
      "children": [
        { "id": "demo-iframe", "type": "plugin", "title": "iframe 演示", "icon": "fas fa-window-restore", "path": "/html-demo/iframe", "pluginType": "html", "renderMode": "iframe", "src": "./plugins/html/demo-iframe.html", "version": "0.1.0" },
        { "id": "demo-inline", "type": "plugin", "title": "inline 演示", "icon": "fas fa-window-maximize", "path": "/html-demo/inline", "pluginType": "html", "renderMode": "inline", "src": "./plugins/html/demo-inline.html", "version": "0.1.0" },
        { "id": "pixel-art", "type": "plugin", "title": "像素画工具", "icon": "fas fa-paint-brush", "path": "/html-demo/pixel-art", "pluginType": "html", "renderMode": "iframe", "src": "./plugins/html/pixel-art.html", "version": "0.1.0" }
      ]
    }
  ]
}
```

---

## 六、框架 API 参考

### 6.1 全局变量

| 变量 | 来源 | 说明 |
|---|---|---|
| `window.Vue` | vendor/vue.global.prod.js | Vue 3 全局对象 |
| `window.VueRouter` | vendor/vue-router.global.prod.js | Vue Router 全局对象 |
| `window.registerPlugin` | js/app.js | 注册插件的函数 |
| `window.router` | js/router.js | 路由实例 |
| `window.showAlert` | js/utils.js | 弹出提示框 |
| `window.showConfirm` | js/utils.js | 弹出确认框 |
| `window.copyToClipboard` | js/utils.js | 复制到剪贴板 |
| `window.APP_VERSION` | js/app.js | 框架主版本号 |

### 6.2 registerPlugin() 参数

```javascript
registerPlugin({
  id: string,           // 必填：唯一ID
  title: string,         // 必填：显示名称
  version: string,       // 必填：插件版本
  route: {              // 必填：路由配置
    path: string,        // 路由路径
    component: object,   // Vue 组件对象
    meta: {              // 路由元信息
      title: string,     // 页面标题
      icon: string       // 图标类
    }
  },
  nav: {                // 必填：导航配置
    group: string,       // 所属分组名
    groupOrder: number,  // 分组排序（数字越小越靠前）
    item: {              // 菜单项配置
      path: string,      // 链接路径
      title: string,     // 显示名称
      icon: string,      // 图标类
      badge: string,     // 可选：徽章文字
      badgeClass: string // 可选：badge/hot/new/update
    }
  }
});
```

### 6.3 工具函数

```javascript
// 弹出提示
global.showAlert('操作成功！', '提示');

// 确认对话框
global.showConfirm('确定删除吗？',
  function () { /* 确认回调 */ },
  function () { /* 取消回调 */ }
);

// 复制到剪贴板
global.copyToClipboard('要复制的文本');

// 路由跳转
global.router.push('/crafting');

// 折叠卡片（框架内置，HTML 中可直接用）
toggleCard(element);  // 传入 .card-header 元素
```

### 6.4 Vue 3 API（JS 插件可用）

```javascript
// 响应式
Vue.ref(value)              // 基础类型响应式
Vue.reactive(object)         // 对象/数组响应式
Vue.computed(fn)             // 计算属性
Vue.watch(source, callback)  // 监听器

// 生命周期
Vue.onMounted(fn)            // 挂载后
Vue.onUnmounted(fn)          // 卸载后
Vue.onUpdated(fn)             // 更新后

// 工具
Vue.nextTick(fn)             // 下次 DOM 更新后
```

---

## 七、样式规范与可用类

### 7.1 CSS 变量（主题色）

```css
/* 主色 */
var(--accent)       /* 主绿色 #3b8526 */
var(--accent-hover) /* 悬停绿色 #4a9c30 */
var(--accent-soft)  /* 浅绿背景 */

/* 功能色 */
var(--blue)         /* 蓝色 #3498db */
var(--red)          /* 红色 #e74c3c */
var(--green)        /* 绿色 #2ecc71 */
var(--yellow)       /* 黄色 #f1c40f */
var(--orange)       /* 橙色 #e67e22 */
var(--purple)       /* 紫色 #9b59b6 */
var(--cyan)         /* 青色 #1abc9c */

/* 背景/文字 */
var(--bg)           /* 主背景 #0d1117 */
var(--panel)        /* 面板背景 #161b22 */
var(--panel-2)      /* 二级面板 #1c2333 */
var(--text)         /* 主文字 #e0e0e0 */
var(--text-2)       /* 次要文字 #aaa */
var(--text-3)       /* 三级文字 #666 */
var(--border)       /* 边框色 #333 */
```

### 7.2 可用组件类

| 类名 | 用途 | 示例 |
|---|---|---|
| `.page-wrapper` | 页面最外层容器 | `<div class="page-wrapper">` |
| `.section-title` | 页面大标题区 | 含 `.st-label` 子元素 |
| `.st-label` | 标题标签（带左侧色条） | `<span class="st-label">标题</span>` |
| `.section-desc` | 标题下方的描述文字 | `<p class="section-desc">` |
| `.card` | 折叠卡片容器 | `<div class="card open">` |
| `.card-header` | 卡片头部（点击折叠） | `onclick="toggleCard(this)"` |
| `.card-body` | 卡片内容区 | 自动展开/收起 |
| `.card-arrow` | 折叠箭头 | 自动旋转 |
| `.form-group` | 表单行容器 | 包含 label + input |
| `.form-label` | 表单标签 | `<label class="form-label">` |
| `.form-input` | 文本输入框 | `<input class="form-input">` |
| `.form-select` | 下拉选择框 | `<select class="form-select">` |
| `.btn` | 基础按钮 | 配合 `.btn-primary` 等 |
| `.btn-primary` | 主按钮（绿色） | `<button class="btn btn-primary">` |
| `.btn-danger` | 危险按钮（红色） | `<button class="btn btn-danger">` |
| `.btn-ghost` | 幽灵按钮（透明） | `<button class="btn btn-ghost">` |
| `.data-table` | 数据表格 | 自动暗色主题 |
| `.badge` | 徽章标签 | 配合 `style="background:..."` |
| `.native-range` | 原生滑块（推荐） | 自动填充色 + 发光 |
| `.toolbar` | 工具栏容器 | 横向排列按钮 |
| `.modal-overlay` | 模态框遮罩 | 框架自动管理 |
| `.modal-box` | 模态框内容 | 框架自动管理 |

### 7.3 布局辅助

```html
<!-- 两列网格 -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">

<!-- 三列网格 -->
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">

<!-- 弹性布局 -->
<div style="display:flex;gap:8px;align-items:center;">

<!-- 居中 -->
<div style="display:flex;justify-content:center;align-items:center;">

<!-- 滚动容器 -->
<div style="max-height:400px;overflow-y:auto;">
```

---

## 八、图标使用指南

### 8.1 获取图标

1. 访问 [Font Awesome 图标库](https://fontawesome.com/search)
2. 搜索关键词（如 "sword"、"fire"、"diamond"）
3. 复制图标类名（如 `fas fa-gem`）

### 8.2 常用 MC 相关图标推荐

| 场景 | 图标类 | 预览 |
|---|---|---|
| 首页 | `fas fa-home` | 🏠 |
| 合成 | `fas fa-hammer` | 🔨 |
| 附魔 | `fas fa-magic` | 🪄 |
| 红石 | `fas fa-bolt` | ⚡ |
| 种子/地图 | `fas fa-map` | 🗺️ |
| 酿造 | `fas fa-flask` | 🧪 |
| 生物 | `fas fa-paw` | 🐾 |
| 物品/方块 | `fas fa-cube` | 🎲 |
| 钻石/宝石 | `fas fa-gem` | 💎 |
| 工具 | `fas fa-wrench` | 🔧 |
| 设置 | `fas fa-cog` | ⚙️ |
| 搜索 | `fas fa-search` | 🔍 |
| 刷新 | `fas fa-sync` | 🔄 |
| 下载 | `fas fa-download` | ⬇️ |
| 上传 | `fas fa-upload` | ⬆️ |
| 复制 | `fas fa-copy` | 📋 |
| 删除 | `fas fa-trash` | 🗑️ |
| 编辑 | `fas fa-edit` | ✏️ |
| 眼睛/查看 | `fas fa-eye` | 👁️ |
| 星星/收藏 | `fas fa-star` | ⭐ |
| 警告 | `fas fa-exclamation-triangle` | ⚠️ |
| 信息 | `fas fa-info-circle` | ℹ️ |
| 勾选 | `fas fa-check` | ✅ |
| 叉号 | `fas fa-times` | ❌ |
| 时钟 | `fas fa-clock` | 🕐 |
| 计算器 | `fas fa-calculator` | 🧮 |
| 调色板 | `fas fa-palette` | 🎨 |
| 像素画 | `fas fa-th` | ▦ |
| 数据库 | `fas fa-database` | 🗄️ |
| 代码 | `fas fa-code` | </> |

### 8.3 在模板中使用

```html
<!-- 基础用法 -->
<i class="fas fa-gem"></i>

<!-- 带颜色 -->
<i class="fas fa-gem" style="color:var(--accent)"></i>

<!-- 带大小和颜色 -->
<i class="fas fa-star" style="color:#f1c40f;font-size:20px;"></i>

<!-- 作为按钮图标 -->
<button class="btn btn-primary">
  <i class="fas fa-download"></i> 下载
</button>

<!-- 动态绑定 -->
<i :class="item.icon" :style="{color: item.color}"></i>
```

---

## 九、调试与排错

### 9.1 常见问题速查

| 症状 | 可能原因 | 解决方案 |
|---|---|---|
| 插件加载了但不显示 | `registerPlugin` 没被调用 | 检查 JS 语法错误、确认 IIFE 执行 |
| 点击菜单没反应 | `path` 不匹配 | 检查 `plugins.json` 的 `path` 和 `route.path` 一致 |
| 图标显示成方块 | Font Awesome 未加载 | 检查 `vendor/font-awesome.min.css` 路径 |
| 图标显示成 "F1B2" | `font-weight` 不是 900 | 检查 CSS 中 `.fas` 的 `font-weight` |
| 滑块不显示 | 没用 `.native-range` 类 | 添加 `class="native-range"` |
| 控制台报 `registerPlugin is not defined` | 插件在框架之前加载 | 确认插件是懒加载（不在 index.html 中引用） |
| HTML 插件 404 | `src` 路径错误 | 用相对路径 `./plugins/html/xxx.html` |
| iframe 插件样式不生效 | CSS 写在 `<body>` 外 | 确保 `<style>` 在 `<head>` 中 |
| inline 插件脚本不执行 | 脚本在 `</body>` 前 | 框架会执行所有 `<script>` 标签 |

### 9.2 调试技巧

```javascript
// 在插件 setup() 中打印调试信息
setup: function () {
  console.log('[MyPlugin] setup 执行了');

  // 检查数据
  Vue.watch(search, function (val) {
    console.log('[MyPlugin] search 变化:', val);
  });

  // 检查组件挂载
  Vue.onMounted(function () {
    console.log('[MyPlugin] 组件已挂载');
    console.log('[MyPlugin] DOM:', document.querySelector('.page-wrapper'));
  });

  // ...
}
```

### 9.3 错误面板

框架内置错误检测，以下情况会自动弹出错误面板：

- JS 运行时错误（自动捕获）
- 未处理的 Promise 拒绝
- 资源加载失败（404）
- 插件加载超时（15 秒）
- Vue 渲染错误

错误面板提供：
- 📋 **一键复制错误信息**
- 🔄 **刷新页面按钮**（致命错误时）
- 📖 **展开/收起详细堆栈**

---

## 十、最佳实践

### 10.1 代码组织

```
✅ 推荐：
   setup() 中按区域分组：
   1. 响应式数据（ref / reactive）
   2. 计算属性（computed）
   3. 方法（function）
   4. 生命周期（onMounted / onUnmounted）
   5. return 出口

❌ 避免：
   在模板中写复杂表达式
   在 setup() 中混用大量 var
   不 return 就在模板中用
```

### 10.2 性能优化

```javascript
// ✅ 用 computed 缓存计算结果
var filtered = computed(function () {
  return list.value.filter(/* ... */);
});

// ✅ 大列表用虚拟滚动或分页
// ❌ 一次渲染 1000+ 行表格

// ✅ 防抖搜索
var search = ref('');
var debouncedSearch = ref('');
var timer = null;
Vue.watch(search, function (val) {
  clearTimeout(timer);
  timer = setTimeout(function () { debouncedSearch.value = val; }, 300);
});
```

### 10.3 用户体验

```javascript
// ✅ 操作反馈
function save() {
  // 模拟异步
  setTimeout(function () {
    global.showAlert('保存成功！', '提示');
  }, 500);
}

// ✅ 危险操作二次确认
function deleteItem(id) {
  global.showConfirm('确定删除这项吗？此操作不可恢复。', function () {
    // 执行删除
  });
}

// ✅ 加载状态
var loading = ref(false);
function fetchData() {
  loading.value = true;
  // ...异步操作
  loading.value = false;
}
```

### 10.4 版本管理

| 场景 | 版本号变化 | 示例 |
|---|---|---|
| 新增插件 | 插件版本 `0.1.0` | 初始版本 |
| 小修小补 | `+0.0.1` | `0.1.0` → `0.1.1` |
| 新增功能 | `+0.1.0` | `0.1.1` → `0.2.0` |
| 大改/重构 | `+1.0.0` | `0.2.0` → `1.0.0` |
| 框架升级 | 主版本 `+0.1.0` | `0.9.4` → `1.0.0` |

---

## 附录：完整模板下载

### A. JS 插件最简模板

```javascript
(function (global) {
  'use strict';
  var Vue = global.Vue;

  var PageComponent = {
    template: `
      <div class="page-wrapper">
        <div class="section-title">
          <span class="st-label">
            <i class="fas fa-star" style="color:var(--accent);margin-right:8px;"></i>
            插件标题
          </span>
        </div>
        <p class="section-desc">插件描述</p>
        <div class="card open">
          <div class="card-header" onclick="toggleCard(this)">
            <span class="card-arrow">▶</span>
            <span class="badge" style="background:var(--accent);color:#fff;">MAIN</span>
            <span style="flex:1;font-size:12px;color:#ccc;">内容</span>
          </div>
          <div class="card-body">
            <p>Hello DBP-HUB!</p>
          </div>
        </div>
      </div>
    `,
    setup: function () {
      return {};
    }
  };

  global.registerPlugin({
    id: 'my-plugin',
    title: '我的插件',
    version: '0.1.0',
    route: {
      path: '/my-plugin',
      component: PageComponent,
      meta: { title: '我的插件', icon: 'fas fa-star' }
    },
    nav: {
      group: '常用工具',
      groupOrder: 1,
      item: {
        path: '/my-plugin',
        title: '我的插件',
        icon: 'fas fa-star'
      }
    }
  });
})(window);
```

### B. HTML 插件最简模板（iframe）

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>我的HTML插件</title>
  <style>
    body { font-family: sans-serif; padding: 20px; background: #1a1a2e; color: #eee; }
    .btn { padding: 10px 20px; background: #3b8526; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
    .btn:hover { background: #4a9c30; }
  </style>
</head>
<body>
  <h1>我的 HTML 插件</h1>
  <p>写任何你想要的 HTML/CSS/JS</p>
  <button class="btn" onclick="alert('Hello!')">点我</button>
</body>
</html>
```

### C. 给 AI 用的转换 Prompt

```
把下面这段 HTML 转成 DBP-HUB v0.9.4 插件，要求：

如果是 JS 插件：
1. 用 IIFE 包起来，调用 global.registerPlugin
2. 数据用 Vue ref + computed，不要用 document.querySelector
3. 表格用 .data-table，输入框用 .form-input，滑块用 .native-range + v-model.number
4. 折叠卡片用 toggleCard(this) 标准结构
5. 不要写 <html>/<head>/<body>，不要内联 onclick
6. 菜单分组填"数据库"，图标用 Font Awesome
7. 输出完整 js/pages/xxx.js 代码

如果是 HTML 插件：
1. 保持完整 HTML 结构（<!DOCTYPE> + <html> + <head> + <body>）
2. 样式写在 <head> 的 <style> 中
3. 脚本写在 <body> 末尾的 <script> 中
4. 告诉我用 iframe 还是 inline 模式
5. 输出完整 plugins/html/xxx.html 代码

【粘贴你的 HTML 代码】
```

---

<div align="center" style="margin-top:40px;padding:20px;border-top:1px solid #333;color:#666;">

**DBP-HUB 插件开发文档 v0.9.4**  
最后更新：2026-08-14

</div>
