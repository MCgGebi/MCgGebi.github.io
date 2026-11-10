/**
 * DBP-HUB 启动验证脚本（交付版）
 * 用法：在 dbp-hub 目录下先 `npm install jsdom`，然后 `node verify.js`
 * 验证内容：vendor 加载 → 启动链路 → 首屏渲染 → 遮罩残留 → 插件文件完整性 → Markdown 插件
 */
const fs = require('fs');
const path = require('path');
let JSDOM;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { console.log('请先安装 jsdom: npm install jsdom'); process.exit(0); }

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const errors = [], logs = [];

const dom = new JSDOM(html, {
  runScripts: 'outside-only', url: 'http://localhost:8000/', pretendToBeVisual: true,
  beforeParse(window) {
    window.console = {
      log: function () { logs.push(Array.prototype.join.call(arguments, ' ')); },
      error: function () { errors.push(Array.prototype.join.call(arguments, ' ')); },
      warn: function () { logs.push('[W] ' + Array.prototype.join.call(arguments, ' ')); },
      info: function () {},
    };
    window.localStorage = { _s: {}, getItem: function (k) { return this._s[k] === undefined ? null : this._s[k]; }, setItem: function (k, v) { this._s[k] = String(v); }, removeItem: function (k) { delete this._s[k]; } };
    window.fetch = function (url) {
      let p = String(url).replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '');
      const file = path.join(ROOT, decodeURIComponent(p));
      return new Promise(function (resolve) {
        fs.readFile(file, 'utf8', function (err, t) {
          if (err) { resolve({ ok: false, status: 404, text: function () { return Promise.resolve(''); }, json: function () { return Promise.reject(err); } }); return; }
          resolve({ ok: true, status: 200, text: function () { return Promise.resolve(t); }, json: function () { return Promise.resolve(JSON.parse(t)); } });
        });
      });
    };
    window.matchMedia = function () { return { matches: false, media: '', addEventListener: function () {}, removeEventListener: function () {}, addListener: function () {}, removeListener: function () {} }; };
    window.scrollTo = function () {};
  },
});
const window = dom.window;

function load(file) {
  const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
  try { window.eval(code); } catch (e) { errors.push('[EVAL ' + file + '] ' + e.message); }
}

(async function main() {
  await new Promise(function (r) { window.addEventListener('load', r); });
  ['vendor/vue.global.prod.js', 'vendor/vue-router.global.prod.js', 'js/utils.js', 'js/plugin-loader.js', 'js/router.js', 'js/app.js', 'js/init.js'].forEach(load);
  await new Promise(function (r) { setTimeout(r, 2600); });

  const doc = window.document;
  let pass = 0, fail = 0;
  function check(name, cond) { if (cond) pass++; else { fail++; console.log('  ✗ ' + name); } }

  console.log('【1】首屏渲染（空白问题回归）');
  check('app-root 已挂载内容', doc.getElementById('app-root').children.length > 0);
  check('#app 存在', !!doc.getElementById('app'));
  check('侧边栏渲染', !!doc.querySelector('.sidebar'));
  check('main-content 有内容', (doc.querySelector('.main-content') || {}).innerHTML.length > 100);
  check('无初始化遮罩残留', !doc.getElementById('init-overlay'));
  check('无致命错误面板', !doc.querySelector('.dbp-error-panel.is-fatal'));
  check('启动期零错误', window.$dbpError && window.$dbpError.list().length === 0);

  console.log('【2】插件完整性');
  const metas = window.getPlugins ? window.getPlugins() : [];
  let missing = 0;
  metas.forEach(function (m) { if (m.src && !fs.existsSync(path.join(ROOT, decodeURIComponent(m.src.replace(/^\//, ''))))) { missing++; errors.push('[缺失] ' + m.id + ' → ' + m.src); } });
  check('所有插件 src 文件存在 (缺失:' + missing + ')', missing === 0);
  check('插件总数 > 0', metas.length > 0);

  console.log('【3】Markdown / HTML 插件');
  const md = metas.find(function (m) { return (m.pluginType || '') === 'markdown'; });
  check('存在 markdown 插件', !!md);
  if (md) { try { const C = await window.loadPlugin(md.id); check('loadPlugin(md) 返回组件', !!(C && C.template)); } catch (e) { errors.push('[MD] ' + e.message); check('loadPlugin(md) 不抛错', false); } }

  console.log('\n【4】右上角菜单超高可滚动');
  const menuEl = doc.getElementById('topbar-menu');
  const menuBtn = doc.getElementById('topbar-menu-btn');
  check('菜单元素存在', !!menuEl);
  if (menuEl && menuBtn) {
    // jsdom 无真实布局，用可写 scrollTop 记录「是否被重置」
    let writes = [];
    let st = 0;
    Object.defineProperty(menuEl, 'scrollTop', {
      configurable: true,
      get: function () { return st; },
      set: function (v) { st = v; writes.push(v); }
    });
    st = 888; writes = [];           // 假装上次滚到了 888
    menuBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await new Promise(function (r) { setTimeout(r, 60); });
    check('★ 打开菜单时把滚动位置重置为 0', writes.length > 0 && st === 0, 'writes=' + JSON.stringify(writes));
    check('★ 菜单已展开', menuEl.className.indexOf('open') !== -1, menuEl.className);
  }

  console.log('\n===== 结果: ' + pass + ' 通过 / ' + fail + ' 失败 =====');
  if (fail || errors.length) {
    console.log('\n--- errors ---'); errors.forEach(function (e) { console.log(e); });
    console.log('\n--- 末尾日志 ---'); logs.slice(-10).forEach(function (l) { console.log(l); });
  }
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.error('CRASH:', e); process.exit(2); });
