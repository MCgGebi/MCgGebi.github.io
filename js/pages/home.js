/* ========================================
   DBP-HUB · 首页 v0.9.20（Haavk / Relink 风格）
   ----------------------------------------
   注：首页通过 plugins.json 的 route 懒加载（与其他插件一致），
   由 router beforeEnter → loadPlugin('home') → fetch 本文件 → definePlugin 注册。
   因此本文件不要立即执行 definePlugin，而是导出一个普通模块，
   由 plugin-loader.js 的 JS 插件执行流程（new Function(code).call(global)）触发注册。

   ★ 首页为 Haavk / Relink 视觉叙事风格，不展示任何框架/架构/版本类字段。
   ======================================== */
(function (global) {
  'use strict';

  var HOME_VERSION = '0.9.20';

  /* ---------- 插件描述与配色（供卡片/搜索展示） ---------- */
  var COLOR_MAP = {
    home:'#3b8526', test:'#2980b9', icons:'#9b59b6', crafting:'#ff8c42', enchant:'#8e44ad',
    brewing:'#e05a4a', seeds:'#5cba47', 'redstone-calc':'#f39c12', 'redstone-sim':'#f39c12',
    'rs-tutor-basic':'#e8a735', 'rs-tutor-advanced':'#e8a735',
    'mob-farm-basic':'#7f8c8d', 'mob-farm-exp':'#e74c3c', 'mob-farm-afk':'#3498db',
    mobs:'#27ae60', 'items-blocks':'#bdc3c7', 'items-food':'#e67e22', 'items-tools':'#95a5a6',
    building:'#bdc3c7', 'pixel-convert':'#9b59b6', 'pixel-palette':'#9b59b6',
    'html-demo-iframe':'#e67e22', 'html-demo-inline':'#3498db', 'pixel-art-tool':'#f72585',
    changelog:'#3b8526', 'mc-guide':'#5cba47', 'dev-notes':'#2980b9',
  };
  var DESC_MAP = {
    home:'站点总览与快速导航', test:'插件系统功能测试场', icons:'Font Awesome 图标速查（200+）',
    crafting:'查询所有合成配方', enchant:'模拟附魔台与经验消耗', brewing:'酿造配方与效果查询',
    seeds:'种子地图与生物群系', 'redstone-calc':'红石电路计算器', 'redstone-sim':'红石电路模拟器',
    'rs-tutor-basic':'基础逻辑门教程', 'rs-tutor-advanced':'高级计时器教程',
    'mob-farm-basic':'基础刷怪塔设计', 'mob-farm-exp':'高效经验农场设计',
    'mob-farm-afk':'AFK 钓鱼场设计', mobs:'生物属性图鉴',
    'items-blocks':'所有方块数据查询', 'items-food':'食物属性与效果', 'items-tools':'工具武器属性对比',
    building:'建筑参考与设计灵感', 'pixel-convert':'图片转像素画方案', 'pixel-palette':'MC 调色板生成器',
    'html-demo-iframe':'iframe 模式演示（无框全屏）',
    'html-demo-inline':'inline 模式演示（自动去重标题）',
    'pixel-art-tool':'像素画绘制工具',
    changelog:'版本更新记录', 'mc-guide':'Minecraft 新手指南', 'dev-notes':'开发笔记',
  };

  /* ---------- Relink 设问（叙事文案） ---------- */
  var QUESTIONS = [
    '一块木头，能推演出多少种合成？',
    '一格红石，能把信号传出多远？',
    '一颗种子，能生成多大的疆域？',
    '一层矿脉，藏着多少未被开采的财富？',
    '一组坐标，能通往多深的地下？',
    '一座建筑，能承载多高的想象？',
  ];

  /* ---------- 两代 Relink ---------- */
  var DIMENSIONS = [
    {
      tag: '主世界', en: 'Overworld',
      desc: '万物生长的起点。草原、海洋、矿洞与村庄在此铺展，也是绝大多数合成与建造的发生地。',
    },
    {
      tag: '下界', en: 'The Nether',
      desc: '烈焰与险境的维度。1 格等于主世界 8 格的距离，石英、烈焰棒与下界合金的唯一产地。',
    },
    {
      tag: '末地', en: 'The End',
      desc: '终末与归途。浮空岛屿、末影龙与末地城，藏着整场冒险最后的答案。',
    },
  ];

  function registerHome() {
    if (typeof global.definePlugin !== 'function' && typeof global.registerPlugin !== 'function') {
      global._pendingPlugins = global._pendingPlugins || [];
      global._pendingPlugins.push({ __home: true, factory: registerHome });
      return;
    }

    var Vue = global.Vue;
    var ref = Vue.ref, computed = Vue.computed, reactive = Vue.reactive;

    /* ========================================
       递归分类树节点（目录视图使用）
       ======================================== */
    var HomeCategoryNode = {
      name: 'HomeCategoryNode',
      props: {
        node: { type: Object, required: true },
        depth: { type: Number, default: 0 },
        expandedState: { type: Object, default: function () { return {}; } },
        toggleCategory: { type: Function, default: function () {} },
        colorMap: { type: Object, default: function () { return COLOR_MAP; } },
        descMap: { type: Object, default: function () { return DESC_MAP; } },
      },
      template: `
        <div class="hc-node" :class="{ 'is-folder': node.type==='folder' }">
          <template v-if="node.type === 'folder'">
            <div class="hc-folder-head"
                 :class="{ 'open': isOpen }"
                 :style="{ paddingLeft: (10 + depth * 18) + 'px' }"
                 @click="onToggle">
              <i class="hc-arrow" :class="isOpen ? 'fas fa-chevron-down' : 'fas fa-chevron-right'"></i>
              <i class="hc-folder-icon" :class="node.icon || 'fas fa-folder'"></i>
              <span class="hc-folder-title">{{ node.title }}</span>
              <span class="hc-count">{{ countPlugins(node) }}</span>
            </div>
            <div class="hc-children" v-show="isOpen">
              <home-category-node
                v-for="(child, idx) in (node.children || [])"
                :key="child.id || idx"
                :node="child" :depth="depth + 1"
                :expanded-state="expandedState"
                :toggle-category="toggleCategory"
              ></home-category-node>
            </div>
          </template>

          <a v-if="node.type === 'plugin'"
             href="javascript:void(0)"
             class="hc-item"
             :style="{ marginLeft: (depth * 18) + 'px' }"
             @click="goPlugin(node)">
            <span class="hc-item-icon" :style="{ color: colorMap[node.id] || 'var(--accent)' }">
              <i :class="node.icon || 'fas fa-cube'"></i>
            </span>
            <span class="hc-item-body">
              <span class="hc-item-title">{{ node.title }}</span>
              <span class="hc-item-desc">{{ descMap[node.id] || '插件功能' }}</span>
            </span>
            <span v-if="node.badge" class="hc-item-badge" :class="node.badgeClass">{{ node.badge }}</span>
          </a>

          <a v-if="node.type === 'link'"
             :href="node.url"
             :target="node.target || '_blank'"
             rel="noopener noreferrer"
             class="hc-item is-link"
             :style="{ marginLeft: (depth * 18) + 'px' }"
             :title="node.url">
            <span class="hc-item-icon" style="color:var(--warn);">
              <i :class="node.icon || 'fas fa-external-link-alt'"></i>
            </span>
            <span class="hc-item-body">
              <span class="hc-item-title">
                {{ node.title }}
                <i class="fas fa-arrow-up-right-from-square" style="font-size:9px;opacity:.6;margin-left:4px;"></i>
              </span>
              <span class="hc-item-desc">{{ node.url }}</span>
            </span>
            <span v-if="node.badge" class="hc-item-badge" :class="node.badgeClass">{{ node.badge }}</span>
          </a>
        </div>
      `,
      computed: {
        isOpen: function () {
          if (this.expandedState && this.node.id in this.expandedState) {
            return !!this.expandedState[this.node.id];
          }
          return this.depth === 0;
        },
      },
      methods: {
        onToggle: function (e) {
          e.preventDefault(); e.stopPropagation();
          if (this.toggleCategory) this.toggleCategory(this.node.id);
        },
        countPlugins: function (node) {
          var count = 0;
          function walk(n) {
            (n.children || []).forEach(function (c) {
              if (c.type === 'plugin' || c.type === 'link') count++;
              else if (c.type === 'folder') walk(c);
            });
          }
          walk(node);
          return count;
        },
        goPlugin: function (node) {
          if (global.appRouter && node.path) global.appRouter.push(node.path);
          else if (node.path) window.location.hash = '#' + node.path;
        },
      },
    };

    /* ========================================
       首页根组件（Haavk / Relink 风格）
       ======================================== */
    var HomePage = {
      name: 'HomePage',
      components: { HomeCategoryNode: HomeCategoryNode },
      template: `
        <div class="hv-home">

          <!-- ===== 天空 · Hero ===== -->
          <section class="hv-sky">
            <div class="hv-bg" aria-hidden="true"></div>
            <div class="hv-stars" aria-hidden="true"></div>
            <div class="hv-horizon" aria-hidden="true"></div>
            <div class="hv-sky-inner">
              <div class="hv-eyebrow">
                <i class="fas fa-cube"></i> BLOCK PROTOCOL
              </div>

              <h1 class="hv-title">
                解码 <em>方块世界</em>
              </h1>
              <p class="hv-sub">Every block has an answer.</p>

              <!-- 搜索（保留工具能力） -->
              <div class="hv-search" :class="{ focused: searchFocused }">
                <i class="fas fa-magnifying-glass hv-search-ico"></i>
                <input
                  ref="searchInput"
                  v-model="searchQuery"
                  class="hv-search-input"
                  placeholder="搜索工具：合成 · 附魔 · 种子 · 红石 · 图鉴"
                  @focus="searchFocused = true"
                  @blur="onSearchBlur"
                  @keydown.enter="goFirstResult"
                  @keydown.esc="searchQuery = ''"
                />
                <span class="hv-kbd">/</span>
                <button v-if="searchQuery" class="hv-search-clear" @click="searchQuery = ''">
                  <i class="fas fa-xmark"></i>
                </button>
              </div>

              <div class="hv-results" v-if="searchResults.length">
                <a v-for="r in searchResults" :key="r.key"
                   class="hv-result"
                   href="javascript:void(0)"
                   @click="openResult(r)">
                  <i :class="r.icon" :style="{ color: r.color }"></i>
                  <span class="hv-result-title">{{ r.title }}</span>
                  <span class="hv-result-sub">{{ r.sub }}</span>
                  <span class="hv-result-kind" :class="r.kind">{{ r.kindText }}</span>
                </a>
              </div>
              <div class="hv-result-empty" v-else-if="searchQuery">没有匹配的工具</div>

              <div class="hv-sky-meta">
                <span><i class="fas fa-cube"></i> Java 1.21</span>
                <span><i class="fas fa-hammer"></i> 合成</span>
                <span><i class="fas fa-bolt"></i> 红石</span>
                <span><i class="fas fa-map"></i> 种子</span>
              </div>
            </div>

            <div class="hv-scroll-hint" aria-hidden="true">
              <i class="fas fa-chevron-down"></i>
            </div>
          </section>

          <!-- ===== 设问 ===== -->
          <section class="hv-section">
            <div class="hv-eyebrow-line">// BLOCK LOGIC</div>
            <h2 class="hv-h2">方寸之间，藏着整个世界的规则</h2>
            <div class="hv-q-grid">
              <div class="hv-q" v-for="(q, i) in questions" :key="i">
                <span class="hv-q-n">{{ pad(i + 1) }}</span>
                <p class="hv-q-text">{{ q }}</p>
              </div>
            </div>
            <p class="hv-lead">
              From a single block, an entire world unfolds.<br>
              Every recipe, every circuit, every seed — decoded.
            </p>
          </section>

          <!-- ===== 两代 ===== -->
          <section class="hv-section">
            <div class="hv-eyebrow-line">// DIMENSIONS</div>
            <h2 class="hv-h2">三个维度，三种法则</h2>
            <div class="hv-gen">
              <article class="hv-gen-c" v-for="g in dimensions" :key="g.tag">
                <div class="hv-gen-tag">{{ g.tag }}</div>
                <div class="hv-gen-en">{{ g.en }}</div>
                <p class="hv-gen-desc">{{ g.desc }}</p>
              </article>
            </div>
            <p class="hv-lead">
              Three dimensions, endless possibilities —<br>
              and every one of them is measurable.
            </p>
          </section>

          <!-- ===== 工具矩阵 ===== -->
          <section class="hv-section" v-if="allTools.length">
            <div class="hv-sec-head">
              <div>
                <div class="hv-eyebrow-line">// TOOL MATRIX</div>
                <h2 class="hv-h2">探索全部工具</h2>
              </div>
              <div class="hv-switch">
                <button :class="{ on: viewMode === 'grid' }" @click="viewMode = 'grid'">
                  <i class="fas fa-table-cells-large"></i> 矩阵
                </button>
                <button :class="{ on: viewMode === 'tree' }" @click="viewMode = 'tree'">
                  <i class="fas fa-sitemap"></i> 目录
                </button>
              </div>
            </div>

            <div class="hv-grid" v-if="viewMode === 'grid'">
              <a v-for="t in allTools" :key="t.key"
                 class="hv-tool"
                 :class="{ 'is-link': t.kind === 'link' }"
                 href="javascript:void(0)"
                 @click="openResult(t)">
                <span class="hv-tool-ico" :style="{ color: t.color }"><i :class="t.icon"></i></span>
                <span class="hv-tool-body">
                  <span class="hv-tool-t">
                    {{ t.title }}
                    <i v-if="t.kind === 'link'" class="fas fa-arrow-up-right-from-square"></i>
                  </span>
                  <span class="hv-tool-d">{{ t.desc }}</span>
                </span>
              </a>
            </div>

            <div class="hv-tree" v-else>
              <home-category-node
                v-for="(node, idx) in categories"
                :key="node.id || idx"
                :node="node"
                :depth="0"
                :expanded-state="expandedState"
                :toggle-category="toggleCategory"
              ></home-category-node>
            </div>
          </section>

          <!-- ===== CTA ===== -->
          <section class="hv-cta">
            <h2 class="hv-cta-title">开始你的世界。</h2>
            <p class="hv-cta-sub">From crafting to redstone — start exploring.</p>
            <button class="hv-btn" @click="focusSearch">
              <i class="fas fa-compass"></i> 开始探索
            </button>
          </section>

          <!-- ===== 页脚 ===== -->
          <footer class="hv-foot">
            <span class="hv-foot-brand"><i class="fas fa-cube"></i> Minecraft Toolkit</span>
            <a class="hv-foot-link"
               href="https://zh.minecraft.wiki" target="_blank" rel="noopener noreferrer">
              <i class="fas fa-book"></i> Minecraft Wiki
            </a>
          </footer>
        </div>
      `,
      setup: function () {
        var searchQuery = ref('');
        var searchFocused = ref(false);
        var viewMode = ref('grid');
        var searchInput = ref(null);
        var questions = ref(QUESTIONS);
        var dimensions = ref(DIMENSIONS);
        var expandedState = reactive({});

        /* ---------- 分类数据 ---------- */
        var categories = computed(function () {
          if (global.getCategories) return (global.getCategories() || []).slice();
          return (global.getPlugins && global.getPlugins()) || [];
        });

        /* ---------- 打平：所有插件 / 外链 ---------- */
        var flatAll = computed(function () {
          var out = [];
          function walk(nodes, trail) {
            (nodes || []).forEach(function (n) {
              var path = trail.concat([n.title]);
              if (n.type === 'plugin') {
                out.push({
                  key: 'p-' + n.id, kind: 'plugin', kindText: '工具', id: n.id,
                  title: n.title, sub: path.slice(0, -1).join(' / ') || '首页',
                  desc: n.desc || DESC_MAP[n.id] || 'Minecraft 实用工具',
                  icon: n.icon || 'fas fa-cube', color: COLOR_MAP[n.id] || '#3b8526',
                  badge: n.badge || '', badgeClass: n.badgeClass || '', target: n.path,
                });
              } else if (n.type === 'link') {
                out.push({
                  key: 'l-' + n.id, kind: 'link', kindText: '外链', id: n.id,
                  title: n.title, sub: n.url,
                  desc: n.desc || '站外资源',
                  icon: n.icon || 'fas fa-external-link-alt', color: '#e8a735',
                  badge: n.badge || '', badgeClass: n.badgeClass || '', target: n.url,
                });
              }
              if (n.children) walk(n.children, path);
            });
          }
          walk(categories.value, []);
          return out;
        });

        var allTools = computed(function () { return flatAll.value; });

        /* ---------- 搜索 ---------- */
        var searchResults = computed(function () {
          var q = searchQuery.value.trim().toLowerCase();
          if (!q) return [];
          return flatAll.value.filter(function (r) {
            return (r.title || '').toLowerCase().indexOf(q) >= 0 ||
                   (r.sub || '').toLowerCase().indexOf(q) >= 0 ||
                   (r.desc || '').toLowerCase().indexOf(q) >= 0 ||
                   (r.id || '').toLowerCase().indexOf(q) >= 0;
          }).slice(0, 20);
        });

        /* ---------- 折叠 / 跳转 ---------- */
        function toggleCategory(id) {
          var next = !expandedState[id];
          delete expandedState[id];
          expandedState[id] = next;
        }
        function go(path) {
          if (!path) return;
          if (global.appRouter) global.appRouter.push(path);
          else window.location.hash = '#' + path;
        }
        function openResult(r) {
          if (!r) return;
          if (r.kind === 'link') {
            if (r.target) window.open(r.target, '_blank', 'noopener,noreferrer');
            return;
          }
          go(r.target);
          searchQuery.value = '';
        }
        function goFirstResult() {
          if (searchResults.value.length) openResult(searchResults.value[0]);
        }
        function focusSearch() {
          if (searchInput.value && searchInput.value.focus) searchInput.value.focus();
        }
        function onSearchBlur() {
          setTimeout(function () { searchFocused.value = false; }, 150);
        }
        function pad(n) { return n < 10 ? '0' + n : '' + n; }

        /* ---------- 快捷键 / 聚焦搜索 ---------- */
        try {
          document.addEventListener('keydown', function (e) {
            if (e.key === '/' && document.activeElement &&
                document.activeElement.tagName !== 'INPUT' &&
                document.activeElement.tagName !== 'TEXTAREA') {
              e.preventDefault(); focusSearch();
            }
          });
        } catch (e) {}

        return {
          searchQuery: searchQuery, searchFocused: searchFocused,
          viewMode: viewMode, searchInput: searchInput,
          questions: questions, dimensions: dimensions,
          expandedState: expandedState, categories: categories,
          allTools: allTools, searchResults: searchResults,
          toggleCategory: toggleCategory, openResult: openResult,
          goFirstResult: goFirstResult, focusSearch: focusSearch,
          onSearchBlur: onSearchBlur, pad: pad,
        };
      },
    };

    var homeConfig = {
      id: 'home', title: '首页', version: HOME_VERSION,
      icon: 'fas fa-house', path: '/',
      component: HomePage,
      meta: { title: '首页', icon: 'fas fa-house' },
    };

    global.DBP_HOME_CATEGORY_NODE = HomeCategoryNode;
    if (typeof global.definePlugin === 'function') global.definePlugin(homeConfig);
    else if (typeof global.registerPlugin === 'function') global.registerPlugin(homeConfig);

    console.log('[Home] 首页插件已注册 (v' + HOME_VERSION + ')');
  }

  registerHome();
})(window);
