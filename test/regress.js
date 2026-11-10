/**
 * DBP-HUB 报错回归测试（真实 jsdom + 真实 Vue）
 * 针对用户实际报错：
 *   1) ReferenceError: onMounted is not defined
 *   2) TypeError: Cannot read properties of undefined (reading 'length')
 * 做法：加载真实 index.html 与全部脚本，但在 app.js 执行前「故意」删掉 Vue.onMounted，
 *       模拟异常/旧版环境，验证应用依然能挂载、不抛上述两个错误。
 */
const fs = require('fs');
const path = require('path');
let JSDOM;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { console.log('请先安装 jsdom: npm install jsdom'); process.exit(0); }

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const errors = [], logs = [];

function makeDom(disableOnMounted) {
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
        let p = String(url).replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '').split('?')[0];
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
  return dom;
}

function run(disableOnMounted, label) {
  return new Promise(function (resolve) {
    const dom = makeDom(disableOnMounted);
    const window = dom.window;
    function load(file) {
      const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
      try { window.eval(code); } catch (e) { errors.push('[EVAL ' + file + '] ' + e.message); }
    }
    window.addEventListener('load', function () {
      ['vendor/vue.global.prod.js', 'vendor/vue-router.global.prod.js', 'js/utils.js', 'js/plugin-loader.js', 'js/router.js'].forEach(load);
      if (disableOnMounted) { delete window.Vue.onMounted; }   // ★ 制造异常环境
      ['js/app.js', 'js/init.js'].forEach(load);
      setTimeout(function () {
        const doc = window.document;
        resolve({
          label: label,
          window: window,
          mounted: doc.getElementById('app-root') && doc.getElementById('app-root').children.length > 0,
          hasApp: !!doc.getElementById('app'),
          sidebar: !!doc.querySelector('.sidebar'),
          mainLen: (doc.querySelector('.main-content') || {}).innerHTML ? doc.querySelector('.main-content').innerHTML.length : 0,
        });
      }, 2200);
    });
  });
}

(async function main() {
  let pass = 0, fail = 0;
  function check(name, cond) { if (cond) pass++; else { fail++; console.log('  ✗ ' + name); } }

  console.log('【场景1】正常环境（Vue.onMounted 可用）');
  const r1 = await run(false, 'normal');
  check('应用已挂载', r1.mounted);
  check('#app 存在', r1.hasApp);
  check('侧边栏渲染', r1.sidebar);
  check('主内容非空', r1.mainLen > 100);

  console.log('【场景2】异常环境（故意删除 Vue.onMounted）');
  const r2 = await run(true, 'no-onMounted');
  check('删除后依然挂载成功（降级生效）', r2.mounted);
  check('删除后 #app 存在', r2.hasApp);
  check('删除后侧边栏渲染', r2.sidebar);
  check('删除后主内容非空', r2.mainLen > 100);

  const allErrText = errors.join('\n');
  check('未出现 "onMounted is not defined"', !/onMounted is not defined/.test(allErrText));
  check("未出现 \"reading 'length'\" 类错误", !/reading 'length'/.test(allErrText));

  // ★ 真实渲染 about 页（本次崩溃点：模板里 window.DBP → _ctx.window undefined）
  console.log('【场景3】渲染「关于本站」页（window.DBP 崩溃点回归）');
  try {
    if (r1.window.appRouter) {
      r1.window.appRouter.push('/about');
      await new Promise(function (r) { setTimeout(r, 1200); });
    }
    const doc = r1.window.document;
    const txt = doc.body.textContent || '';
    check('about 页已渲染（含"关于本站"）', /关于本站/.test(txt));
    check('about 页渲染出版本号 v0.9.19', /v0\.9\.20/.test(txt));
    const errAfter = errors.join('\n');
    check("about 渲染未触发 reading 'DBP'", !/reading 'DBP'/.test(errAfter));
    check('about 渲染未新增 JS 错误', !/\[EVAL/.test(errAfter));
  } catch (e) {
    check('about 页渲染流程不抛异常', false);
  }

  console.log('\n===== 结果: ' + pass + ' 通过 / ' + fail + ' 失败 =====');
  if (fail || errors.length) {
    console.log('\n--- errors ---');
    errors.slice(0, 20).forEach(function (e) { console.log(e); });
  }
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.error('CRASH:', e); process.exit(2); });
