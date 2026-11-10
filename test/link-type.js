/**
 * 外链插件类型（type: 'link'）端到端验证
 * 1. plugins.json 中的 link 被正确解析
 * 2. router 不为 link 建路由（不加载任何文件）
 * 3. 侧边栏渲染出 link 节点：href = 真实 url，target=_blank，带 noopener
 * 4. 首页渲染出 link 卡片
 * 5. 点击 link 不触发 loadPlugin（不会去 fetch .js/.html/.md）
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
    window.console = { log: function () {}, error: function () {}, warn: function () {}, info: function () {} };
    window.localStorage = { _s: {}, getItem: function (k) { return this._s[k] === undefined ? null : this._s[k]; }, setItem: function (k, v) { this._s[k] = String(v); }, removeItem: function (k) { delete this._s[k]; } };
    window.fetch = function (url) {
      fetched.push(String(url));
      let p = String(url).replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '').split('?')[0];
      const file = path.join(ROOT, decodeURIComponent(p));
      return new Promise(function (resolve) {
        fs.readFile(file, 'utf8', function (err, t) {
          if (err) return resolve({ ok: false, status: 404, text: () => Promise.resolve(''), json: () => Promise.reject(err) });
          resolve({ ok: true, status: 200, text: () => Promise.resolve(t), json: () => Promise.resolve(JSON.parse(t)) });
        });
      });
    };
    window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    window.scrollTo = function () {};
    window.requestAnimationFrame = function (fn) { return setTimeout(fn, 0); };
    window.open = function (url) { fetched.push('OPEN:' + url); return {}; };
  },
});
const w = dom.window;
function load(f) { try { w.eval(fs.readFileSync(path.join(ROOT, f), 'utf8')); } catch (e) { console.log('[EVAL FAIL]', f, e.message); } }

(async function () {
  await new Promise(r => w.addEventListener('load', r));
  ['vendor/vue.global.prod.js', 'vendor/vue-router.global.prod.js', 'js/utils.js', 'js/plugin-loader.js', 'js/router.js', 'js/app.js', 'js/init.js'].forEach(load);
  await new Promise(r => setTimeout(r, 2200));

  let pass = 0, fail = 0;
  const check = (n, c, extra) => { if (c) pass++; else { fail++; console.log('  ✗ ' + n + (extra ? '  → ' + extra : '')); } };
  const doc = w.document;

  console.log('【1】元数据解析');
  const plugins = w.getPlugins();
  const links = plugins.filter(p => p.type === 'link');
  check('★ 解析出 link 类型条目', links.length > 0, 'count=' + links.length);
  check('link 条目都有 url', links.every(l => !!l.url), links.map(l => l.id + ':' + l.url).join(', '));
  check('link 默认 target=_blank', links.every(l => l.target === '_blank'));
  check('link 有默认 badge=URL', links.every(l => l.badge === 'URL'));
  check('link 有默认图标', links.every(l => !!l.icon));
  check('★ link 未被误加 src（不加载文件）', links.every(l => !l.src));
  const wiki = links.find(l => l.id === 'mcwiki');
  check('Minecraft Wiki 链接正确', wiki && wiki.url === 'https://zh.minecraft.wiki', wiki ? wiki.url : 'n/a');

  console.log('【2】路由层面');
  const routes = (w.appRouter && w.appRouter.getRoutes) ? w.appRouter.getRoutes() : [];
  const linkRoutes = routes.filter(r => links.some(l => l.id === r.name));
  check('★ router 未为 link 建路由', linkRoutes.length === 0, 'routeCount=' + linkRoutes.length);
  check('isLinkPlugin 判定正确', w.isLinkPlugin && w.isLinkPlugin(links[0]) === true && w.isLinkPlugin(plugins.find(p => p.type === 'plugin')) === false);

  console.log('【3】侧边栏渲染');
  const sidebarLinks = doc.querySelectorAll('.sidebar a.cat-link-item');
  check('★ 侧边栏渲染出外链项', sidebarLinks.length > 0, 'count=' + sidebarLinks.length);
  if (sidebarLinks.length) {
    const first = sidebarLinks[0];
    const href = first.getAttribute('href');
    check('★ href 是真实外链（非 #/ 路由）', href && /^https?:\/\//.test(href), 'href=' + href);
    check('target=_blank', first.getAttribute('target') === '_blank');
    check('rel 含 noopener（安全）', /noopener/.test(first.getAttribute('rel') || ''));
    check('含外链角标图标', !!first.querySelector('.nav-link-ext'));
    check('外链图标为 warn 色（CSS 类存在）', !!first.querySelector('.nav-icon'));
  }

  console.log('【4】首页渲染');
  // 进入首页
  if (w.appRouter) { w.appRouter.push('/home'); await new Promise(r => setTimeout(r, 1200)); }
  // 矩阵视图（默认）：外链以 .hv-tool.is-link 呈现
  const gridLinks = doc.querySelectorAll('.hv-tool.is-link');
  check('★ 首页矩阵视图渲染出外链卡片', gridLinks.length > 0, 'count=' + gridLinks.length);
  // 切到目录视图：外链以 .hc-item.is-link 呈现
  const sw = doc.querySelectorAll('.hv-switch button');
  if (sw.length === 2) { sw[1].dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await new Promise(r => setTimeout(r, 400)); }
  const cards = doc.querySelectorAll('.hc-item.is-link, .home-link-card');
  check('★ 首页目录视图渲染出外链卡片', cards.length > 0, 'count=' + cards.length);
  if (cards.length) {
    const href = cards[0].getAttribute('href');
    check('首页外链 href 正确', href && /^https?:\/\//.test(href), 'href=' + href);
    check('首页外链 target=_blank', cards[0].getAttribute('target') === '_blank');
  }
  const footer = doc.body.textContent || '';
  check('侧边栏统计含外链数', /个外链/.test(footer) || /外部链接/.test(footer), footer.match(/\d+ 个外链/) ? footer.match(/\d+ 个外链/)[0] : '(未匹配)');

  console.log('【5】不加载任何插件文件');
  // 统计所有指向 js/pages 或 plugins/ 的 fetch
  const pluginFetches = fetched.filter(u => /js\/pages\/|plugins\/html\/|plugins\/markdown\//.test(u));
  const linkIds = links.map(l => l.id);
  const wronglyLoaded = pluginFetches.filter(u => linkIds.some(id => u.indexOf(id) !== -1));
  check('★ 没有为 link 发起过插件文件请求', wronglyLoaded.length === 0, wronglyLoaded.join(', '));

  console.log('\n===== 结果: ' + pass + ' 通过 / ' + fail + ' 失败 =====');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
