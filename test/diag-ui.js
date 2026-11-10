/**
 * 诊断：1) showConfirm 弹窗是否透明  2) 错误面板是否显示
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
  },
});
const w = dom.window;
function load(f) { try { w.eval(fs.readFileSync(path.join(ROOT, f), 'utf8')); } catch (e) { console.log('[EVAL FAIL]', f, e.message); } }

(async function () {
  await new Promise(r => w.addEventListener('load', r));
  ['vendor/vue.global.prod.js', 'vendor/vue-router.global.prod.js', 'js/utils.js', 'js/plugin-loader.js', 'js/router.js', 'js/app.js', 'js/init.js'].forEach(load);
  await new Promise(r => setTimeout(r, 2200));

  let pass = 0, fail = 0;
  const check = (n, c, extra) => { if (c) { pass++; } else { fail++; console.log('  ✗ ' + n + (extra ? '  → ' + extra : '')); } };
  const doc = w.document;

  console.log('【诊断1】showConfirm 弹窗');
  let okClicked = false;
  w.showConfirm('诊断确认框', function () { okClicked = true; }, function () {});
  await new Promise(r => setTimeout(r, 300));
  const overlay = doc.getElementById('modal-confirm');
  const box = overlay && overlay.querySelector('.modal-box');
  check('overlay 存在', !!overlay);
  check('overlay 已加 .show', overlay && overlay.classList.contains('show'), overlay ? overlay.className : 'n/a');
  check('modal-box 存在', !!box);
  check('★ modal-box 有 .modal-enter（决定 opacity:1）', box && box.classList.contains('modal-enter'), box ? 'class=' + box.className : 'n/a');
  const cs = box ? w.getComputedStyle(box) : null;
  check('★ modal-box computed opacity = 1', cs && cs.opacity === '1', cs ? 'opacity=' + cs.opacity : 'n/a');

  console.log('【诊断2】错误面板（推入一条错误）');
  w.$dbpError.push({ phase: 'test', plugin: 'diag', url: '/diag', message: '诊断用测试错误', stack: 'diag stack', fatal: false });
  await new Promise(r => setTimeout(r, 900));   // 等 setInterval 500ms 同步
  const panel = doc.querySelector('.dbp-error-panel');
  check('★ 面板已渲染', !!panel);
  check('面板含错误信息', panel && /诊断用测试错误/.test(panel.textContent), panel ? panel.textContent.slice(0, 60) : 'n/a');
  const pcs = panel ? w.getComputedStyle(panel) : null;
  check('面板 display 非 none', pcs && pcs.display !== 'none', pcs ? 'display=' + pcs.display : 'n/a');
  check('面板 opacity 非 0', pcs && pcs.opacity !== '0', pcs ? 'opacity=' + pcs.opacity : 'n/a');
  // 面板在 DOM 树中的位置
  if (panel) {
    const parent = panel.parentElement;
    check('面板父元素为 #app', parent && parent.id === 'app', parent ? (parent.id || parent.className) : 'n/a');
  }

  console.log('【诊断3】toast');
  w.showToast('诊断 toast', 'error');
  await new Promise(r => setTimeout(r, 200));
  const toast = doc.querySelector('.dbp-toast');
  check('toast 已渲染', !!toast);
  check('toast 已加 .show', toast && toast.classList.contains('show'), toast ? toast.className : 'n/a');

  console.log('【诊断4】组件内抛错 → 进错误面板（测试页"触发运行时错误"）');
  const before = w.$dbpError.list().length;
  // 模拟 Vue 事件处理器抛错：走 app.config.errorHandler
  const appInst = doc.querySelector('#app').__vue_app__ || (w.document.getElementById('app-root') && w.document.getElementById('app-root').__vue_app__);
  if (appInst && appInst.config && typeof appInst.config.errorHandler === 'function') {
    appInst.config.errorHandler(new Error('诊断用组件错误'), null, 'diagnostic handler');
  } else {
    // 拿不到 app 实例时，直接验证 window error 监听（plugin-loader 的 bug detector）
    try { throw new Error('诊断用组件错误'); } catch (e) { w.dispatchEvent(new w.ErrorEvent('error', { message: e.message, error: e })); }
  }
  await new Promise(r => setTimeout(r, 900));
  const after = w.$dbpError.list().length;
  check('★ 组件内错误已进入总线', after > before, 'before=' + before + ' after=' + after);
  check('★ 面板展示该错误', /诊断用组件错误/.test(doc.body.textContent), (doc.querySelector('.dbp-error-panel') || {}).textContent ? doc.querySelector('.dbp-error-panel').textContent.slice(0, 80) : '(面板无文本)');

  console.log('\n===== 诊断结果: ' + pass + ' 通过 / ' + fail + ' 失败 =====');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
