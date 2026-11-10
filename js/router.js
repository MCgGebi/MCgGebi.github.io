/* ========================================
   DBP-HUB · Router v0.9.20
   - JS / HTML(iframe&inline) / Markdown 三种插件路由
   - 加载失败 → 记录到 $dbpError 总线（常驻面板渲染，含完整 stack）
                  同时跳转 /plugin-error 页展示详情
   - route.meta 携带 title/icon/pluginType，驱动顶栏标题显示
   ======================================== */
(function (global) {
  'use strict';

  global.createRouter = function () {
    var VueRouter = global.VueRouter;
    if (!VueRouter) {
      console.error('[Router] VueRouter 未定义！');
      return null;
    }

    var plugins = (global.getPlugins && global.getPlugins()) || [];
    console.log('[Router] 构建路由，插件数: ' + plugins.length);

    var LoadingComp = {
      template: `
      <div class="page-plugin" style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;gap:16px;min-height:300px;">
        <i class="fas fa-cube" style="font-size:36px;color:var(--accent);animation:spin 1.5s linear infinite;"></i>
        <div style="font-size:13px;color:var(--text-muted);">{{ loadingText }}</div>
      </div>`,
      setup: function () { return { loadingText: '正在加载插件...' }; },
    };

    var ErrorComp = {
      props: ['error', 'pluginId', 'pluginType', 'phase', 'stack'],
      template: `
      <div class="page-plugin">
        <div class="card open" style="border-color:rgba(220,53,69,.4);">
          <div class="card-header">
            <span class="badge" style="background:var(--danger);color:#fff;">ERROR</span>
            <span style="flex:1;font-size:12px;">插件加载失败</span>
          </div>
          <div class="card-body" style="display:flex;flex-direction:column;gap:12px;font-size:13px;">
            <div style="font-weight:600;color:var(--danger);">{{ error || '未知错误' }}</div>
            <div v-if="pluginType" style="font-size:11px;color:var(--accent);">类型: {{ pluginType }}</div>
            <div v-if="phase" style="font-size:11px;color:var(--text-muted);">阶段: {{ phase }}</div>
            <pre v-if="stack" style="background:var(--panel-2);border:1px solid var(--border);border-radius:var(--radius);padding:12px;font-size:11px;color:var(--text-muted);max-height:240px;overflow:auto;white-space:pre-wrap;">{{ stack }}</pre>
            <div style="display:flex;gap:8px;">
              <button class="btn btn-primary btn-sm" @click="retry"><i class="fas fa-redo"></i> 重试</button>
              <button class="btn btn-outline btn-sm" @click="copyReport"><i class="fas fa-copy"></i> 复制错误报告</button>
            </div>
          </div>
        </div>
      </div>`,
      setup: function (props) {
        function retry() { window.location.reload(); }
        function copyReport() {
          var text = '插件: ' + (props.pluginId || '?') + '\n类型: ' + (props.pluginType || '?') + '\n阶段: ' + (props.phase || '?') + '\n\n' + (props.stack || props.error || '');
          if (window.copyText) window.copyText(text); else navigator.clipboard.writeText(text);
        }
        return { retry: retry, copyReport: copyReport };
      },
    };

    var routes = [{ path: '/', redirect: '/home' }];

    plugins.forEach(function (p) {
      // ★ 外链条目（type: 'link'）不建路由：点击侧边栏直接 window.open 跳转，不进 SPA
      if (p.type === 'link' || (global.isLinkPlugin && global.isLinkPlugin(p))) return;

      var routePath = p.path || ('/' + p.id);
      if (routePath.charAt(0) !== '/') routePath = '/' + routePath;
      var isHtml = global.isHtmlPlugin ? global.isHtmlPlugin(p) : false;
      var isMd = global.isMarkdownPlugin ? global.isMarkdownPlugin(p) : false;
      var typeLabel = isMd ? 'markdown' : (isHtml ? 'html' : 'js');

      routes.push({
        path: routePath, name: p.id,
        // ★ 顶栏标题来源：route.meta.title —— HTML/Markdown 插件标题也由此显示在主页导航栏
        meta: { title: p.title || p.id, icon: p.icon || 'fas fa-cube', pluginId: p.id, pluginType: typeLabel, renderMode: p.renderMode || 'iframe' },
        component: LoadingComp,
        beforeEnter: async function (to, from, next) {
          var pluginId = p.id;
          try {
            console.log('[Router] 进入 ' + routePath + '，加载插件: ' + pluginId + ' (' + typeLabel + ')');
            var comp = await global.loadPlugin(pluginId);
            var matched = to.matched[0];
            if (matched) matched.components.default = comp;
            next();
          } catch (err) {
            // ★ 仅「插件入口文件本身加载失败（HTTP 404）」：不进总线、不跳 /plugin-error、
            //   不显示错误窗，直接由 catch-all 渲染内置 404 页面。
            //   ★ 必须有 __dbpPluginEntry 入口标记：插件脚本内部抛出的错误
            //     （哪怕带 status:404 / 抛的是 Response 对象 / message 含 HTTP 404）
            //     一律按普通错误处理，绝不整页跳 404。
            if (err && err.__dbpPluginEntry === true && (err.isNotFound === true || err.status === 404)) {
              console.info('[Router] 插件文件 404 → 显示内置 404 页面：' + (p.src || pluginId));
              next({ path: '/404', replace: true });
              return;
            }
            console.error('[Router] 插件加载失败:', pluginId, err.message);
            // ★ 推入错误总线：常驻面板渲染，含 phase/plugin/url/stack
            if (global.$dbpError && global.$dbpError.push) {
              global.$dbpError.push({
                phase: 'route',
                plugin: pluginId,
                url: (p.src || ''),
                message: err.message,
                stack: (err.stack || ''),
                time: new Date().toISOString(),
                fatal: false,
              });
            }
            next({
              path: '/plugin-error',
              query: { msg: err.message, id: pluginId, type: typeLabel, stack: encodeURIComponent(err.stack || ''), phase: 'route' },
            });
          }
        },
      });
    });

    // ★ 框架内置路由：设置页（不是插件，不进 plugins.json）
    if (global.DBP_SETTINGS_ROUTE) {
      routes.push(global.DBP_SETTINGS_ROUTE);
    } else {
      routes.push({
        path: '/settings', name: 'settings',
        meta: { title: '设置', icon: 'fas fa-sliders-h', builtin: true },
        component: { template: '<div style="padding:40px;text-align:center;color:var(--text-muted);">设置组件未加载（js/settings.js 缺失）</div>' },
      });
    }

    routes.push({
      path: '/plugin-error',
      name: 'plugin-error',
      component: ErrorComp,
      props: function (route) {
        return {
          error: route.query.msg || '加载失败',
          pluginId: route.query.id || '',
          pluginType: route.query.type || '',
          phase: route.query.phase || 'route',
          stack: route.query.stack ? decodeURIComponent(route.query.stack) : '',
        };
      },
    });

    // ★ 旧版极简 404：保留原模板作为兜底（js/notfound.js 未加载时使用）
    var Minimal404Fallback = {
      template: '<div style="padding:40px;text-align:center;color:var(--text-muted);">' +
                '<i class="fas fa-exclamation-triangle" style="font-size:48px;margin-bottom:16px;display:block;opacity:.4;"></i>' +
                '<h2>404 - 页面未找到</h2>' +
                '<p>你访问的功能不存在或已被移除</p>' +
                '<a href="#/home" style="color:var(--accent);">← 返回首页</a></div>',
    };

    // ★ 内置 404：默认沉浸式（随机壁纸 / 一言 / mini 底栏），可在设置页切回旧版极简
    //   组件由 js/notfound.js 提供，样式作用域限定在主内容区，不遮挡顶栏与侧边栏
    routes.push({
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      meta: { title: '404', icon: 'fas fa-triangle-exclamation', builtin: true },
      component: global.DBP_NOTFOUND_COMPONENT || Minimal404Fallback,
      props: false,
    });

    var router = VueRouter.createRouter({
      history: VueRouter.createWebHashHistory(),
      routes: routes,
      scrollBehavior: function () { return { top: 0, behavior: 'smooth' }; },
    });

    // 路由切换：更新文档标题 + 通知错误面板刷新
    router.afterEach(function (to) {
      var title = (to.meta && to.meta.title) || 'DBP-HUB';
      document.title = title + ' · DBP-HUB';
    });

    return router;
  };

  console.log('[Router] createRouter() 已定义 (v0.9.20)');

})(window);
