/**
 * 根因复现：Vue3 模板里访问 window.DBP 会崩溃
 * 编译产物把 window.DBP 变成 _ctx.window.DBP，而 _ctx.window 默认不存在
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const ROOT = path.join(__dirname, '..');

const dom = new JSDOM('<div id="app"></div>', { runScripts: 'outside-only', url: 'http://localhost/' });
const w = dom.window;
// 捕获 Vue 内部渲染错误（Vue 会 catch 后用 console.error 输出，不向 mount 抛出）
const consoleErrors = [];
w.console = Object.assign({}, console, {
  error: function () { consoleErrors.push(Array.prototype.join.call(arguments, ' ')); },
  warn: function () {}, log: function () {}, info: function () {},
});
// 注入真实 Vue
w.eval(fs.readFileSync(path.join(ROOT, 'vendor/vue.global.prod.js'), 'utf8'));
const Vue = w.Vue;

let pass = 0, fail = 0;
function check(n, c) { if (c) pass++; else { fail++; console.log('  ✗ ' + n); } }

// ---- 1) 未注入 globalProperties：应当报错（页面渲染失败）----
consoleErrors.length = 0;
try {
  const a = Vue.createApp({ template: '<p>{{ window.DBP && window.DBP.version }}</p>' });
  a.mount('#app');
} catch (e) { consoleErrors.push(e.message); }
const crashed = consoleErrors.join('\n');
check('未注入时确实报错（复现 reading DBP）', /reading 'DBP'/.test(crashed));
console.log('  ↳ 复现: ' + (crashed.split('\n')[0] || '(无)').slice(0, 110));

// ---- 2) 注入 window 后：不再报错 ----
consoleErrors.length = 0;
let ok2 = true, html2 = '';
try {
  const a2 = Vue.createApp({ template: '<p>{{ window.DBP && window.DBP.version || "fallback" }}</p>' });
  a2.config.globalProperties.window = w;
  a2.mount('#app');
  html2 = w.document.getElementById('app').innerHTML;
} catch (e) { ok2 = false; html2 = e.message; }
check('注入 window 到 globalProperties 后不再报错', ok2 && !/reading 'DBP'/.test(consoleErrors.join('\n')));
console.log('  ↳ 渲染结果: ' + html2);

// ---- 3) 真实 about.js 组件（修复后）应当正常渲染 ----
let ok3 = true, html3 = '';
try {
  w.localStorage = { getItem: () => null, setItem: () => {} };
  w.fetch = () => Promise.reject(new Error('x'));
  w.Vue = Vue;
  w.eval(fs.readFileSync(path.join(ROOT, 'js/utils.js'), 'utf8'));
  w.eval(fs.readFileSync(path.join(ROOT, 'js/plugin-loader.js'), 'utf8'));
  w.eval(fs.readFileSync(path.join(ROOT, 'js/pages/about.js'), 'utf8'));
  const meta = w.getPlugins ? w.getPlugins().find(p => p.id === 'about') : null;
  check('about 插件已注册', !!meta);
} catch (e) { ok3 = false; console.log('  ↳ setup 异常: ' + e.message); }
check('about.js 加载/注册流程不抛异常', ok3);

console.log('\n===== 结果: ' + pass + ' 通过 / ' + fail + ' 失败 =====');
process.exit(fail ? 1 : 0);
