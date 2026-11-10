/* ========================================
   DBP-HUB · 关于本站 v0.9.20
   - 常驻「公告」归档区：读取 js/announcements.json，可折叠逐条回看
   - 公告正文为 Markdown，复用全局 renderMarkdown
   ======================================== */
(function (global) {
  'use strict';

  var ABOUT_VERSION = '0.9.20';

  function registerAbout() {
    if (typeof global.definePlugin !== 'function' && typeof global.registerPlugin !== 'function') {
      global._pendingPlugins = global._pendingPlugins || [];
      global._pendingPlugins.push({ __about: true, factory: registerAbout });
      return;
    }

    var Vue = global.Vue;
    var ref = Vue.ref, computed = Vue.computed;

    var AboutPage = {
      name: 'AboutPage',
      template: `
        <div class="page-plugin">
          <div class="section-title">
            <span class="st-label">
              <i class="fas fa-circle-info" style="color:var(--accent);margin-right:6px;"></i>关于本站
            </span>
          </div>

          <!-- ===== 公告（常驻 · 可折叠） ===== -->
          <div class="card open" style="margin-bottom:14px;">
            <div class="card-header" @click="toggleAnnOpen">
              <span class="card-arrow" :class="{ open: annOpen }">&#9654;</span>
              <span class="badge" style="background:var(--warn);color:#1a1a1a;">NEWS</span>
              <span style="flex:1;font-size:12px;color:var(--text-secondary);">
                公告（{{ announcements.length }}）
              </span>
              <span v-if="unreadCount" class="badge" style="background:var(--danger);color:#fff;">
                {{ unreadCount }} 条未读
              </span>
              <button class="btn btn-sm" style="margin-left:8px;" @click.stop="refreshAnn">
                <i class="fas fa-rotate-right"></i> 刷新
              </button>
            </div>
            <div class="card-body" v-show="annOpen">
              <div class="ann-archive" v-if="announcements.length">
                <div class="ann-arch-item"
                     v-for="a in pagedAnnouncements"
                     :key="a.id"
                     :class="{ open: isArchOpen(a.id) }">
                  <button class="ann-arch-head" @click="toggleArch(a.id)">
                    <i class="fas fa-chevron-right"></i>
                    <span class="ann-arch-title">
                      <i :class="a.icon" style="color:var(--accent);margin-right:6px;"></i>
                      {{ a.title }}
                      <span v-if="isNewest(a.id)" class="ann-badge-new"><i class="fas fa-star"></i>最新</span>
                    </span>
                    <span class="ann-arch-date">{{ a.date }}</span>
                    <button class="ann-read-toggle"
                            :class="{ read: isRead(a.id) }"
                            :disabled="isRead(a.id)"
                            :title="isRead(a.id) ? '已读' : '点击标记为已读（不再弹出）'"
                            @click.stop="toggleRead(a.id)">
                      <i :class="isRead(a.id) ? 'fas fa-envelope-open' : 'fas fa-envelope'"></i>
                      {{ isRead(a.id) ? '已读' : '标为已读' }}
                    </button>
                  </button>
                  <div class="ann-arch-body markdown-body" v-show="isArchOpen(a.id)" v-html="renderBody(a.body)"></div>
                </div>
              </div>
              <div class="ann-empty" v-else-if="annLoading">正在加载公告…</div>
              <div class="ann-empty" v-else>暂无公告</div>

              <!-- 分页（条目多时出现） -->
              <div class="ann-pager" v-if="totalPages > 1">
                <button class="ann-pager-btn" :disabled="annPage <= 1" @click="goAnnPage(annPage - 1)" aria-label="上一页">
                  <i class="fas fa-chevron-left"></i>
                </button>
                <template v-for="p in pageList" :key="'p' + p">
                  <span v-if="p === '…'" class="ann-pager-ellipsis">…</span>
                  <button v-else class="ann-pager-btn" :class="{ active: p === annPage }" @click="goAnnPage(p)">{{ p }}</button>
                </template>
                <button class="ann-pager-btn" :disabled="annPage >= totalPages" @click="goAnnPage(annPage + 1)" aria-label="下一页">
                  <i class="fas fa-chevron-right"></i>
                </button>
              </div>
              <div class="ann-pager-info" v-if="announcements.length">
                第 {{ annPage }} / {{ totalPages }} 页 · 共 {{ announcements.length }} 条（{{ annPageSize }} 条/页）
              </div>
              <div class="settings-hint" style="margin-top:10px;">
                公告内容来自 <code>js/announcements.json</code>，新增不同 <code>id</code> 即为新公告。
                在弹窗里点「不再显示」只会屏蔽该条；已读后不可撤回。
              </div>
            </div>
          </div>

          <!-- ===== 站点简介 ===== -->
          <div class="card open" style="margin-bottom:14px;">
            <div class="card-header" @click="toggleInfoOpen">
              <span class="card-arrow" :class="{ open: infoOpen }">&#9654;</span>
              <span class="badge" style="background:var(--accent);color:#fff;">INFO</span>
              <span style="flex:1;font-size:12px;color:var(--text-secondary);">DBP-HUB · Minecraft 工具站</span>
            </div>
            <div class="card-body" v-show="infoOpen" style="line-height:1.8;font-size:13px;color:var(--text-secondary);">
              <p>一个插件式架构的 Minecraft 工具集合，支持四种条目格式：</p>
              <ul style="padding-left:1.5em;margin:8px 0;">
                <li><strong>JS 插件</strong> — <code>definePlugin('id', { template }, opts)</code>，一行注册，缺字段自动补全</li>
                <li><strong>HTML 插件</strong> — iframe（无框全屏）/ inline（自动去重与顶栏重复的标题）双模式</li>
                <li><strong>Markdown 插件</strong> — .md 文件自动转 HTML 渲染，标题显示在顶栏</li>
                <li><strong>外链</strong> — 只跳转，不加载任何文件，不占用页面路由</li>
              </ul>
              <p>
                主版本号 <code v-text="'v' + dbpVersion"></code>，
                每个插件拥有独立版本号；主题支持亮色 / 暗色 / 跟随系统，并可自定义主题色。
              </p>
            </div>
          </div>

          <!-- ===== 快速入口 ===== -->
          <div class="card open" style="margin-bottom:14px;">
            <div class="card-header" @click="toggleQuickOpen">
              <span class="card-arrow" :class="{ open: quickOpen }">&#9654;</span>
              <span class="badge" style="background:var(--blue);color:#fff;">QUICK</span>
              <span style="flex:1;font-size:12px;color:var(--text-secondary);">快速入口</span>
            </div>
            <div class="card-body" v-show="quickOpen">
              <div style="display:flex;flex-wrap:wrap;gap:8px;">
                <button class="btn btn-sm" @click="go('/settings')"><i class="fas fa-sliders-h"></i> 设置</button>
                <a class="btn btn-sm" href="https://zh.minecraft.wiki" target="_blank" rel="noopener noreferrer">
                  <i class="fas fa-book"></i> Minecraft Wiki
                </a>
                <button class="btn btn-sm" @click="focusHomeSearch"><i class="fas fa-magnifying-glass"></i> 搜索工具</button>
              </div>
            </div>
          </div>

          <!-- ===== 开源协议 ===== -->
          <div class="card open">
            <div class="card-header" @click="toggleLicenseOpen">
              <span class="card-arrow" :class="{ open: licenseOpen }">&#9654;</span>
              <span class="badge" style="background:var(--warn);color:#1a1a1a;">LICENSE</span>
              <span style="flex:1;font-size:12px;color:var(--text-secondary);">开源协议与免责</span>
            </div>
            <div class="card-body" v-show="licenseOpen" style="font-size:12px;color:var(--text-muted);line-height:1.8;">
              本工具仅供学习与个人使用。Minecraft 相关内容与素材版权归 Mojang Studios / Microsoft 所有，
              本站不主张任何权利，亦不对数据准确性作任何担保。
            </div>
          </div>
        </div>
      `,
      setup: function () {
        var dbpVersion = ref(ABOUT_VERSION);
        try {
          var v = (global.DBP && global.DBP.version) ||
                  (global.getAppVersion && global.getAppVersion()) || ABOUT_VERSION;
          dbpVersion.value = String(v);
        } catch (e) { /* 取不到就用默认值 */ }

        // 折叠状态
        var annOpen = ref(true);      // 公告区默认展开（常驻且醒目）
        var infoOpen = ref(true);
        var quickOpen = ref(false);
        var licenseOpen = ref(false);
        var openArch = ref({});
        var annLoading = ref(true);

        var announcements = ref([]);
        var readIds = ref([]);
        var annPage = ref(1);
        var annPageSize = 5; // 每页条数

        function loadAnn() {
          annLoading.value = true;
          var p = (typeof global.loadAnnouncements === 'function')
            ? global.loadAnnouncements()
            : Promise.resolve([]);
          return p.then(function (list) {
            announcements.value = list || [];
            readIds.value = (typeof global.getReadAnnouncementIds === 'function')
              ? global.getReadAnnouncementIds() : [];
            annLoading.value = false;
            // 数据变化后回到第一页（新的在最上面）
            annPage.value = 1;
          }).catch(function () {
            announcements.value = [];
            annLoading.value = false;
          });
        }

        var unreadCount = computed(function () {
          return announcements.value.filter(function (a) {
            return readIds.value.indexOf(a.id) < 0;
          }).length;
        });

        function renderBody(md) {
          return (typeof global.renderMarkdown === 'function') ? global.renderMarkdown(md) : '';
        }

        /* ---------- 公告分页 ---------- */
        var totalPages = computed(function () {
          return Math.max(1, Math.ceil(announcements.value.length / annPageSize));
        });
        var pagedAnnouncements = computed(function () {
          // 数据已按 id 降序（新的在前），分页只做切片，不改变顺序
          var start = (annPage.value - 1) * annPageSize;
          return announcements.value.slice(start, start + annPageSize);
        });
        /* 页码列表：页数多时用省略号折叠（1 … 4 5 6 … 20） */
        var pageList = computed(function () {
          var total = totalPages.value, cur = annPage.value, out = [], i;
          if (total <= 7) { for (i = 1; i <= total; i++) out.push(i); return out; }
          out.push(1);
          var s = Math.max(2, cur - 1), e = Math.min(total - 1, cur + 1);
          if (s > 2) out.push('…');
          for (i = s; i <= e; i++) out.push(i);
          if (e < total - 1) out.push('…');
          out.push(total);
          return out;
        });
        function goAnnPage(p) {
          var n = Number(p);
          if (!n || n < 1) n = 1;
          if (n > totalPages.value) n = totalPages.value;
          annPage.value = n;
        }
        /* 列表首条（即最新一条）打「最新」标 */
        function isNewest(id) {
          return announcements.value.length > 0 && announcements.value[0].id === id;
        }
        function isArchOpen(id) { return !!openArch.value[id]; }
        function toggleArch(id) {
          var next = Object.assign({}, openArch.value);
          if (next[id]) delete next[id]; else next[id] = true;
          openArch.value = next;
        }
        function isRead(id) { return readIds.value.indexOf(id) >= 0; }
        /* 只能「标记已读」，不支持反向标回未读 */
        function toggleRead(id) {
          if (isRead(id)) return; // 已读则忽略，不做任何事
          if (typeof global.markAnnouncementRead === 'function') global.markAnnouncementRead(id);
          if (global.showToast) global.showToast('已标记为已读，不再弹出', 'success');
          readIds.value = (typeof global.getReadAnnouncementIds === 'function')
            ? global.getReadAnnouncementIds() : [];
        }
        function refreshAnn() { return loadAnn(); }
        function go(path) {
          if (!path) return;
          if (global.appRouter) global.appRouter.push(path);
          else window.location.hash = '#' + path;
        }
        function focusHomeSearch() {
          go('/');
          setTimeout(function () {
            var el = document.querySelector('.hv-search-input');
            if (el && el.focus) el.focus();
          }, 350);
        }
        function toggleAnnOpen() { annOpen.value = !annOpen.value; }
        function toggleInfoOpen() { infoOpen.value = !infoOpen.value; }
        function toggleQuickOpen() { quickOpen.value = !quickOpen.value; }
        function toggleLicenseOpen() { licenseOpen.value = !licenseOpen.value; }

        // 进入页面即加载公告
        try {
          if (Vue.onMounted) Vue.onMounted(function () { loadAnn(); });
          else loadAnn();
        } catch (e) { loadAnn(); }

        return {
          dbpVersion: dbpVersion,
          annOpen: annOpen, infoOpen: infoOpen, quickOpen: quickOpen, licenseOpen: licenseOpen,
          announcements: announcements, annLoading: annLoading, unreadCount: unreadCount,
          renderBody: renderBody, isArchOpen: isArchOpen, toggleArch: toggleArch, isRead: isRead,
          toggleRead: toggleRead, isNewest: isNewest,
          annPage: annPage, annPageSize: annPageSize, totalPages: totalPages,
          pagedAnnouncements: pagedAnnouncements, pageList: pageList, goAnnPage: goAnnPage,
          refreshAnn: refreshAnn,
          go: go, focusHomeSearch: focusHomeSearch,
          toggleAnnOpen: toggleAnnOpen, toggleInfoOpen: toggleInfoOpen,
          toggleQuickOpen: toggleQuickOpen, toggleLicenseOpen: toggleLicenseOpen,
        };
      },
    };

    var aboutConfig = {
      id: 'about', title: '关于本站', version: ABOUT_VERSION,
      icon: 'fas fa-circle-info', path: '/about',
      component: AboutPage,
      meta: { title: '关于本站', icon: 'fas fa-circle-info' },
    };

    if (typeof global.definePlugin === 'function') global.definePlugin(aboutConfig);
    else if (typeof global.registerPlugin === 'function') global.registerPlugin(aboutConfig);

    console.log('[About] 关于页插件已注册 (v' + ABOUT_VERSION + ')');
  }

  registerAbout();
})(window);
