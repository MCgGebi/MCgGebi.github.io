/**
 * 框架内置设置页（/settings）端到端验证
 * 1. settings.js 作为框架文件加载（不是插件）
 * 2. /settings 是内置路由，不在 plugins.json
 * 3. 顶栏菜单有「设置」入口并能跳转
 * 4. 设置页渲染：主题三选、概览统计、错误区、数据区、关于
 * 5. 主题切换生效（data-theme 变化 + localStorage）
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const fetched = [];
const dom = new JSDOM(html, {
  runScripts: 'outside-only', url: 'http://localhost:8000/', pretendToBeVisual: true,
  beforeParse(window) {
    window.console = { log() {}, error() {}, warn() {}, info() {} };
    const store = {};
    window.localStorage = {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; },
      key: i => Object.keys(store)[i],
      get length() { return Object.keys(store).length; },
    };
    window.fetch = function (url) {
      fetched.push(String(url));
      let p = String(url).replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '').split('?')[0];
      const file = path.join(ROOT, decodeURIComponent(p));
      return new Promise(res => {
        fs.readFile(file, 'utf8', (err, t) => {
          if (err) return res({ ok: false, status: 404, text: () => Promise.resolve(''), json: () => Promise.reject(err) });
          res({ ok: true, status: 200, text: () => Promise.resolve(t), json: () => Promise.resolve(JSON.parse(t)) });
        });
      });
    };
    window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    window.scrollTo = () => {};
    window.requestAnimationFrame = fn => setTimeout(fn, 0);
    window.open = (u) => { fetched.push('OPEN:' + u); return {}; };
  },
});
const w = dom.window;
const load = f => { try { w.eval(fs.readFileSync(path.join(ROOT, f), 'utf8')); } catch (e) { console.log('[EVAL FAIL]', f, e.message); } };

(async function () {
  await new Promise(r => w.addEventListener('load', r));
  ['vendor/vue.global.prod.js', 'vendor/vue-router.global.prod.js', 'js/utils.js', 'js/plugin-loader.js', 'js/router.js', 'js/app.js', 'js/settings.js', 'js/init.js'].forEach(load);
  await new Promise(r => setTimeout(r, 2200));

  let pass = 0, fail = 0;
  const check = (n, c, extra) => { if (c) pass++; else { fail++; console.log('  ✗ ' + n + (extra ? '  → ' + extra : '')); } };
  const doc = w.document;

  console.log('【1】框架内置（非插件）');
  const json = JSON.parse(fs.readFileSync(path.join(ROOT, 'js/plugins.json'), 'utf8'));
  const flat = [];
  (function walk(n) { (n || []).forEach(x => { flat.push(x); if (x.children) walk(x.children); }); })(json.categories);
  check('★ /settings 不在 plugins.json（非插件）', !flat.some(n => n.id === 'settings' || n.path === '/settings'));
  check('★ settings.js 被 index.html 直接引入', /js\/settings\.js/.test(html));
  check('settings.js 不调用 registerPlugin/definePlugin', !/registerPlugin|definePlugin/.test(fs.readFileSync(path.join(ROOT, 'js/settings.js'), 'utf8')));
  check('导出 DBP_SETTINGS_COMPONENT', !!w.DBP_SETTINGS_COMPONENT);
  check('导出 DBP_SETTINGS_ROUTE（path=/settings）', w.DBP_SETTINGS_ROUTE && w.DBP_SETTINGS_ROUTE.path === '/settings');
  check('★ 路由 meta 标记 builtin', w.DBP_SETTINGS_ROUTE && w.DBP_SETTINGS_ROUTE.meta && w.DBP_SETTINGS_ROUTE.meta.builtin === true);

  console.log('【2】路由注册');
  const routes = w.appRouter ? w.appRouter.getRoutes() : [];
  const sr = routes.find(r => r.path === '/settings');
  check('★ 内置路由 /settings 已注册', !!sr, 'paths=' + routes.map(r => r.path).join(','));
  check('路由 name=settings', sr && sr.name === 'settings');
  check('★ 无 beforeEnter 懒加载（内置页不 fetch 文件）', !!(sr && !sr.beforeEnter));

  console.log('【3】顶栏菜单入口');
  const items = Array.from(doc.querySelectorAll('.dropdown-item'));
  const settingsItem = items.find(a => /设置/.test(a.textContent || ''));
  check('★ 顶栏菜单含「设置」入口', !!settingsItem, 'items=' + items.length);
  check('设置入口在「系统」分组内', !!settingsItem && /系统/.test((settingsItem.closest('.dropdown-group') || {}).textContent || ''));
  if (settingsItem) {
    settingsItem.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 1200));
  }
  check('★ 点击后跳转到 /settings', w.appRouter.currentRoute.value.path === '/settings', 'path=' + w.appRouter.currentRoute.value.path);

  console.log('【4】设置页渲染');
  const main = doc.querySelector('.main-content');
  const txt = main ? main.textContent : '';
  check('★ 设置页已渲染', !!doc.querySelector('.settings-page'), 'mainLen=' + (main ? main.innerHTML.length : 0));
  check('含「外观与主题」区块', /外观与主题/.test(txt));
  check('含主题三选（亮色/暗色/跟随系统）', /亮色/.test(txt) && /暗色/.test(txt) && /跟随系统/.test(txt));
  check('含「站点概览」区块', /站点概览/.test(txt));
  check('含插件/外链/分类统计', /JS\/HTML\/MD 插件/.test(txt) && /外链/.test(txt) && /分类/.test(txt));
  check('含「错误日志」区块', /错误日志/.test(txt));
  check('含「数据与缓存」区块', /数据与缓存/.test(txt));
  check('含强制刷新按钮', /强制刷新/.test(txt));
  check('含打开插件编辑器按钮', /插件编辑器/.test(txt));
  check('含「关于框架」区块', /关于框架/.test(txt));
  check('顶栏显示标题「设置」', /设置/.test(doc.querySelector('.topbar').textContent || ''));
  const stats = Array.from(doc.querySelectorAll('.settings-stat .ss-value')).map(e => e.textContent.trim());
  check('★ 统计数字已填充（非空）', stats.length >= 4 && stats.every(s => s !== '' && !isNaN(Number(s))), 'stats=' + stats.join('/'));
  const pluginCount = Number(stats[0] || 0);
  check('插件数 > 0', pluginCount > 0, 'plugins=' + pluginCount);

  console.log('【5】主题切换');
  const opts = Array.from(doc.querySelectorAll('.theme-opt'));
  check('渲染出 3 个主题选项', opts.length === 3, 'count=' + opts.length);
  const lightOpt = opts.find(o => /亮色/.test(o.textContent || ''));
  if (lightOpt) {
    lightOpt.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 400));
  }
  check('★ 点击亮色 → data-theme=light', doc.documentElement.getAttribute('data-theme') === 'light', 'theme=' + doc.documentElement.getAttribute('data-theme'));
  check('★ 主题已持久化到 localStorage', w.localStorage.getItem('dbp-theme') === 'light', 'stored=' + w.localStorage.getItem('dbp-theme'));
  check('选中态样式生效（active）', !!doc.querySelector('.theme-opt.active'));
  const darkOpt = Array.from(doc.querySelectorAll('.theme-opt')).find(o => /暗色/.test(o.textContent || ''));
  if (darkOpt) {
    darkOpt.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 400));
  }
  check('★ 切回暗色 → data-theme=dark', doc.documentElement.getAttribute('data-theme') === 'dark');

  console.log('【6】不加载插件文件');
  const wrong = fetched.filter(u => /settings/.test(u) && /js\/pages\/|plugins\//.test(u));
  check('★ 未把 settings 当作插件去 fetch', wrong.length === 0, wrong.join(','));

  console.log('\n===== 结果: ' + pass + ' 通过 / ' + fail + ' 失败 =====');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
