/**
 * 场景：框架元数据 plugins.json 加载失败（HTTP 404）→ 启动崩溃
 * 期望：错误必须"可见" —— 要么 Vue 应用仍挂载并显示常驻错误面板，要么渲染静态兜底页
 * 注：只有「插件文件」404 才跳 404 页面；框架元数据 404 仍按错误处理（见 notfound-404.js）
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const dom = new JSDOM(html, {
  runScripts: 'outside-only', url: 'http://localhost:8000/', pretendToBeVisual: true,
  beforeParse(window) {
    window.console = { log: function () {}, error: function () {}, warn: function () {}, info: function () {} };
    window.localStorage = { _s: {}, getItem: function (k) { return this._s[k] === undefined ? null : this._s[k]; }, setItem: function (k, v) { this._s[k] = String(v); }, removeItem: function (k) { delete this._s[k]; } };
    window.fetch = function (url) {
      const u = String(url);
      // ★ 制造故障：plugins.json 返回 404（框架元数据，不是插件文件 → 仍算错误）
      if (u.indexOf('plugins.json') !== -1) {
        return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve(''), json: () => Promise.reject(new Error('404')) });
      }
      let p = u.replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '').split('?')[0];
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
  },
});
const w = dom.window;
function load(f) { try { w.eval(fs.readFileSync(path.join(ROOT, f), 'utf8')); } catch (e) { console.log('[EVAL FAIL]', f, e.message); } }

(async function () {
  await new Promise(r => w.addEventListener('load', r));
  ['vendor/vue.global.prod.js', 'vendor/vue-router.global.prod.js', 'js/utils.js', 'js/plugin-loader.js', 'js/router.js', 'js/app.js', 'js/init.js'].forEach(load);
  await new Promise(r => setTimeout(r, 2600));

  let pass = 0, fail = 0;
  const check = (n, c, extra) => { if (c) { pass++; } else { fail++; console.log('  ✗ ' + n + (extra ? '  → ' + extra : '')); } };
  const doc = w.document;
  const root = doc.getElementById('app-root');

  console.log('【启动失败场景】plugins.json → HTTP 404（框架元数据，仍算错误）');
  const busList = w.$dbpError.list();
  check('错误已进总线', busList.length > 0, 'count=' + busList.length);
  check('总线含 bootstrap 阶段错误', busList.some(e => e.phase === 'bootstrap'), busList.map(e => e.phase).join(','));
  check('标记为致命 fatal', busList.some(e => e.fatal === true));

  // 可见性：必须满足其一
  const hasPanel = !!doc.querySelector('.dbp-error-panel');
  const hasFallback = !!doc.querySelector('.dbp-fatal-fallback');
  check('★ 错误可见（面板 或 静态兜底页）', hasPanel || hasFallback,
    'panel=' + hasPanel + ' fallback=' + hasFallback);
  check('★ app-root 有内容（不是空白页）', root && root.children.length > 0);

  if (hasPanel) {
    check('面板显示错误文本', /plugins\.json|404|启动/i.test(doc.querySelector('.dbp-error-panel').textContent),
      doc.querySelector('.dbp-error-panel').textContent.slice(0, 80));
  }
  if (hasFallback) {
    check('兜底页含错误文本', /plugins\.json|404|启动失败/i.test(doc.querySelector('.dbp-fatal-fallback').textContent));
  }

  console.log('\n===== 结果: ' + pass + ' 通过 / ' + fail + ' 失败 =====');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
