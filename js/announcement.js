/* ==================================================================
   DBP-HUB · 公告系统 v0.9.20（框架内置，非插件）
   ------------------------------------------------------------------
   - 数据源：js/announcements.json（独立文件，可单独编辑）
   - 每条公告以 id 区分；新增 id 即为「新公告」，会正常弹出
   - 「不再显示」只把当前这条 id 写入已读列表，不影响后续新公告
   - 正文字段 body 为 Markdown，复用 plugin-loader 的 markdownToHtml
   - 关于页可读取全部公告做归档（可折叠回看）
   ================================================================== */
(function (global) {
  'use strict';

  var ANNOUNCEMENT_VERSION = '0.9.20';
  var SRC = './js/announcements.json';
  var READ_KEY = 'dbp-read-announcements';

  var cache = { list: [], loaded: false, loading: null };

  /* ---------- 已读 id 列表（localStorage，按 id 独立记录） ---------- */
  function getReadIds() {
    try {
      var raw = localStorage.getItem(READ_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.map(Number).filter(function (n) { return !isNaN(n); }) : [];
    } catch (e) { return []; }
  }
  function markRead(id) {
    var ids = getReadIds();
    if (ids.indexOf(Number(id)) < 0) ids.push(Number(id));
    try { localStorage.setItem(READ_KEY, JSON.stringify(ids)); } catch (e) {}
  }
  function markAllRead() {
    var ids = cache.list.map(function (a) { return Number(a.id); });
    try { localStorage.setItem(READ_KEY, JSON.stringify(ids)); } catch (e) {}
  }
  function isRead(id) {
    return getReadIds().indexOf(Number(id)) >= 0;
  }
  function resetRead() {
    try { localStorage.removeItem(READ_KEY); } catch (e) {}
  }

  /* ---------- 加载公告数据 ---------- */
  function loadAnnouncements() {
    if (cache.loaded) return Promise.resolve(cache.list);
    if (cache.loading) return cache.loading;
    cache.loading = fetch(SRC)
      .then(function (r) {
        // ★ 304 = 缓存未变更，是正常的 HTTP 响应，不是错误（Response.ok 只认 2xx）
        if (!(r.ok === true || r.status === 304)) throw new Error('announcements.json 加载失败 (HTTP ' + r.status + ')');
        return r.status === 304 ? null : r.json();  // 304 无 body，走空列表
      })
      .then(function (json) {
        var raw = (json && json.announcements) || [];
        cache.list = raw
          .filter(function (a) { return a && a.id !== undefined && a.id !== null; })
          .map(function (a) {
            return {
              id: Number(a.id),
              title: a.title || '公告',
              subtitle: a.subtitle || '',
              date: a.date || '',
              tag: a.tag || '公告',
              icon: a.icon || 'fas fa-bullhorn',
              body: a.body || '',
            };
          })
          // 新的排上面：先按 id 降序，id 相同再按日期降序
          .sort(function (x, y) {
            if (y.id !== x.id) return y.id - x.id;
            var dx = String(x.date || ''), dy = String(y.date || '');
            if (dy !== dx) return dy < dx ? -1 : 1;
            return 0;
          });
        cache.loaded = true;
        return cache.list;
      })
      .catch(function (e) {
        cache.loading = null;
        cache.list = [];
        cache.loaded = true;
        if (global.pushError) {
          global.pushError({ phase: 'announcement', message: e.message, fatal: false });
        }
        return [];
      });
    return cache.loading;
  }

  /* ---------- Markdown → HTML（复用插件加载器，带兜底） ---------- */
  function renderMarkdown(md) {
    if (!md) return '';
    if (typeof global.markdownToHtml === 'function') {
      try { return global.markdownToHtml(md); } catch (e) { /* 落到兜底 */ }
    }
    // 兜底：转义后保留换行
    return String(md)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  }

  /* ---------- 取出所有未读公告（按 id 降序：最新在前） ---------- */
  function pendingList(list) {
    var read = getReadIds();
    return (list || []).filter(function (a) { return read.indexOf(a.id) < 0; });
  }

  /* ---------- 弹窗组件（支持多条队列 + 关闭动画） ---------- */
  var AnnouncementModal = {
    name: 'AnnouncementModal',
    props: {
      items: { type: Array, default: function () { return []; } },
    },
    emits: ['close', 'read'],
    template: `
      <div class="ann-overlay" :class="{ 'is-closing': closing }" @click.self="close">
        <div class="ann-modal" role="dialog" aria-modal="true" :class="{ 'is-closing': closing }">
          <div class="ann-head">
            <span class="ann-tag"><i :class="item.icon"></i> {{ item.tag }}</span>
            <span class="ann-date" v-if="item.date">{{ item.date }}</span>
            <span class="ann-progress" v-if="total > 1">第 {{ index + 1 }} / {{ total }} 条</span>
            <button class="ann-x" @click="close" aria-label="关闭">
              <i class="fas fa-xmark"></i>
            </button>
          </div>

          <div class="ann-content" :key="item.id">
            <h3 class="ann-title">{{ item.title }}</h3>
            <p class="ann-sub" v-if="item.subtitle">{{ item.subtitle }}</p>
            <div class="ann-body markdown-body" v-html="renderedBody"></div>
          </div>

          <div class="ann-foot">
            <label class="ann-never" @click="dismiss">
              <i class="fas fa-bell-slash"></i> 不再显示
            </label>
            <div class="ann-nav" v-if="total > 1">
              <button class="ann-nav-btn" :disabled="!hasPrev" @click="prev" aria-label="上一条">
                <i class="fas fa-chevron-left"></i>
              </button>
              <span class="ann-dots">
                <i v-for="(n, i) in items" :key="n.id"
                   class="ann-dot" :class="{ on: i === index, done: i < index }"></i>
              </span>
              <button class="ann-nav-btn" :disabled="!hasNext" @click="next" aria-label="下一条">
                <i class="fas fa-chevron-right"></i>
              </button>
            </div>
            <button class="ann-all" v-if="total > 1" @click="readAll">
              <i class="fas fa-check-double"></i> 全部已读
            </button>
            <button class="btn btn-primary" @click="advance">
              <i class="fas fa-check"></i> {{ hasNext ? '下一条' : '我知道了' }}
            </button>
          </div>
        </div>
      </div>
    `,
    data: function () {
      return { index: 0, closing: false };
    },
    computed: {
      total: function () { return this.items.length; },
      item: function () { return this.items[this.index] || { tag: '', body: '' }; },
      hasPrev: function () { return this.index > 0; },
      hasNext: function () { return this.index < this.total - 1; },
      renderedBody: function () { return renderMarkdown(this.item && this.item.body); },
    },
    methods: {
      /* 标记当前这条已读（告知外层同步 localStorage） */
      markCurrent: function () {
        this.$emit('read', this.item && this.item.id);
      },
      /* 主按钮：有下一条则前进，否则关闭 */
      advance: function () {
        this.markCurrent();
        if (this.hasNext) this.goNext(); else this.close();
      },
      goNext: function () {
        if (this.hasNext) this.index += 1;
      },
      next: function () { this.markCurrent(); this.goNext(); },
      prev: function () {
        if (this.hasPrev) this.index -= 1;
      },
      /* 「不再显示」：标记已读后，有下一条则前进，否则关闭 */
      dismiss: function () {
        this.markCurrent();
        if (this.hasNext) this.goNext(); else this.close();
      },
      readAll: function () {
        var self = this;
        this.items.forEach(function (n) { self.$emit('read', n.id); });
        this.close();
      },
      /* 关闭：先播淡出动画，动画结束再通知外层销毁 */
      close: function () {
        if (this.closing) return;
        this.closing = true;
        var self = this;
        setTimeout(function () { self.$emit('close'); }, 220);
      },
    },
    mounted: function () {
      var self = this;
      this.__esc = function (e) { if (e.key === 'Escape') self.close(); };
      document.addEventListener('keydown', this.__esc);
    },
    beforeUnmount: function () {
      if (this.__esc) document.removeEventListener('keydown', this.__esc);
    },
  };

  /* ---------- 挂载到独立容器并启动（单例 + 并发保护 + 延迟弹出） ---------- */
  var vm = null;
  var starting = false;
  var SHOW_DELAY = 650;   // 启动后延迟多久弹出（ms），避开首屏渲染抢占
  var OPEN_ANIM = 200;    // 入场动画时长（ms），与 CSS annPop 保持一致

  function startAnnouncement(Vue, opts) {
    // 已有实例或正在启动 → 直接返回，避免多条公告叠加弹出
    if (!Vue || vm || starting) return Promise.resolve(false);
    starting = true;
    var delay = (opts && typeof opts.delay === 'number') ? opts.delay : SHOW_DELAY;
    return loadAnnouncements().then(function (list) {
      var queue = pendingList(list);
      if (!queue.length) { starting = false; return false; }

      // 等待一小会儿再弹出：让首屏先渲染完，观感更自然
      return new Promise(function (resolve) {
        setTimeout(function () { resolve(queue); }, delay);
      });
    }).then(function (queue) {
      if (!queue) { return false; }

      var host = document.createElement('div');
      host.className = 'ann-host';
      document.body.appendChild(host);

      var app = Vue.createApp({
        components: { AnnouncementModal: AnnouncementModal },
        template: `
          <announcement-modal
            v-if="items.length"
            :items="items"
            @close="onClose"
            @read="onRead"
          ></announcement-modal>
        `,
        data: function () { return { items: queue.slice() }; },
        methods: {
          onRead: function (id) { markRead(id); },
          onClose: function () { destroy(); },
        },
      });
      function destroy() {
        try { app.unmount(); } catch (e) {}
        if (host && host.parentNode) host.parentNode.removeChild(host);
        vm = null;
        starting = false;
      }
      vm = app.mount(host);
      starting = false;
      return true;
    })['catch'](function () { starting = false; return false; });
  }

  /* ---------- 对外 API ---------- */
  global.loadAnnouncements = loadAnnouncements;
  global.getAnnouncements = function () { return cache.list.slice(); };
  global.renderMarkdown = renderMarkdown;
  global.getReadAnnouncementIds = getReadIds;
  global.markAnnouncementRead = markRead;
  global.isAnnouncementRead = isRead;
  global.markAllAnnouncementsRead = markAllRead;
  global.resetAnnouncements = resetRead;
  global.startAnnouncement = startAnnouncement;
  global.ANNOUNCEMENT_VERSION = ANNOUNCEMENT_VERSION;
  global.DBP_ANNOUNCEMENT_MODAL = AnnouncementModal;

  console.log('[Announcement] 公告系统已就绪 (v' + ANNOUNCEMENT_VERSION + ')');
})(window);
