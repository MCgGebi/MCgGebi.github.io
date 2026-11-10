/**
 * 「插件内资源加载失败」不得整页跳内置 404 页面。
 *
 * 规则（v0.9.30 收窄后）：
 *   ✅ 只有「插件入口文件」自己的 fetch 返回 HTTP 404 → 跳内置 404 页面
 *   ↩️ 插件内部资源（img/script/link）404、插件脚本内部抛出的错误
 *      （哪怕带 status:404 / 抛 Response / message 含 HTTP 404）
 *      → 一律按普通错误处理：进错误总线、显示常驻错误面板，绝不跳 404
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const tick = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const ck = (n, c, e) => { if (c) pass++; else { fail++; console.log('  ✗ ' + n + (e ? '  → ' + e : '')); } };

console.log('【1】静态接线：所有跳 404 的入口都带「入口文件」标记');
{
  const loader = read('js/plugin-loader.js'), router = read('js/router.js');
  ck('httpError 支持 isEntry 参数', /function httpError\(resp, label, isEntry\)/.test(loader));
  ck('入口标记字段为 __dbpPluginEntry', /e\.__dbpPluginEntry = true/.test(loader));
  ck('isEntry404 要求入口标记', /function isEntry404[\s\S]{0,200}?__dbpPluginEntry === true/.test(loader));
  ck('JS 插件入口 fetch 带 true', /throw httpError\(resp, '插件加载失败: ' \+ meta\.src, true\)/.test(loader));
  ck('Markdown 入口 fetch 带 true', (loader.match(/httpError\(r, 'HTTP ' \+ r\.status \+ ' - ' \+ meta\.src, true\)/g) || []).length === 2);
  ck('plugins.json 不带入口标记', /throw httpError\(resp, 'plugins\.json 加载失败'\);/.test(loader));
  ck('router 要求入口标记', /err\.__dbpPluginEntry === true && \(err\.isNotFound === true \|\| err\.status === 404\)/.test(router));
  ck('report 的 plugin-load 分支要求入口标记', /phase === 'plugin-load' && is404\(err\) && isEntry404\(err\)/.test(loader));
  ck('iframe @error 不再无条件跳 404', !/function onIframeError\(\) \{ if \(global\.DBP_show404\)/.test(loader));
  ck('iframe 预检增加未加载成功保护', /r\.status === 404 && !loaded\.value/.test(loader));
  ck('iframe 内部资源错误按 resource 上报', /hookInnerErrors[\s\S]{0,700}?report\('resource', new Error\('插件内资源加载失败/.test(loader));
  ck('hookInnerErrors 在 mounted 时提前挂', /onMounted[\s\S]{0,260}?hookInnerErrors\(\)/.test(loader));
}

/** 复制 notfound-404 的启动环境，支持对特定 URL 覆盖响应 */
function makeDom(opts) {
  opts = opts || {};
  const html = read('index.html');
  const dom = new JSDOM(html, {
    runScripts: 'outside-only', url: 'http://localhost:8000/', pretendToBeVisual: true,
    beforeParse(w) {
      w.console = { log() {}, error() {}, warn() {}, info() {} };
      w.fetch = function (url, init) {
        const u = String(url);
        const method = (init && init.method) || 'GET';
        if (opts.override && opts.override[u]) {
          const o = opts.override[u];
          return Promise.resolve({ ok: o.ok !== false, status: o.status || 200, url: u,
            text: () => Promise.resolve(o.text || ''),
            blob: () => Promise.resolve({}),
            json: () => Promise.resolve(o.json !== undefined ? o.json : JSON.parse(o.text || '{}')) });
        }
        if (opts.fail && opts.fail(u, method)) {
          return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve(''), json: () => Promise.reject(new Error('404')) });
        }
        if (/^https?:\/\//i.test(u)) {
          return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve(''), json: () => Promise.reject(new Error('404')) });
        }
        const p = u.replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '').split('?')[0];
        return new Promise(res => fs.readFile(path.join(ROOT, decodeURIComponent(p)), 'utf8', (e, t) =>
          e ? res({ ok: false, status: 404, text: () => Promise.resolve(''), json: () => Promise.reject(e) })
            : res({ ok: true, status: 200, text: () => Promise.resolve(t), json: () => Promise.resolve(JSON.parse(t)) })));
      };
      w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
      w.scrollTo = function () {};
      w.requestAnimationFrame = fn => setTimeout(fn, 0);
      w.URL.createObjectURL = () => 'blob:fake';
      w.URL.revokeObjectURL = () => {};
    },
  });
  return dom;
}
function boot(dom) {
  const w = dom.window;
  ['vendor/vue.global.prod.js', 'vendor/vue-router.global.prod.js',
    'js/utils.js', 'js/plugin-loader.js', 'js/notfound.js', 'js/router.js',
    'js/app.js', 'js/settings.js', 'js/announcement.js', 'js/init.js']
    .forEach(f => { try { w.eval(read(f)); } catch (e) { console.log('  [EVAL FAIL]', f, e.message); } });
}

(async function () {
  console.log('\n【2】插件脚本内部抛「带 status:404 的错误」→ 不跳 404');
  {
    const dom = makeDom({
      override: {
        './js/pages/crafting.js': {
          ok: true, status: 200,
          text: "throw Object.assign(new Error('插件内部资源 HTTP 404'), { status: 404, isNotFound: true });"
        }
      }
    });
    const w = dom.window, doc = w.document;
    await new Promise(r => w.addEventListener('load', r));
    boot(dom);
    await tick(1500);
    const before = w.$dbpError.list().length;
    w.location.hash = '#/crafting';
    await tick(1600);

    ck('★★ 没有跳到 #/404', w.location.hash !== '#/404', w.location.hash);
    ck('★★ 没有渲染内置 404 页面', !doc.querySelector('.dbp-404'));
    ck('★★ 走的是普通错误路径（/plugin-error 或错误面板）',
      /\/plugin-error/.test(w.location.hash) || w.$dbpError.list().length > before,
      w.location.hash + ' | n=' + w.$dbpError.list().length);
    ck('★★ 错误已进总线', w.$dbpError.list().length > before,
      w.$dbpError.list().map(e => e.phase + ':' + e.message).join(' | '));
    dom.window.close();
  }

  console.log('\n【3】inline 插件内资源 404 → 普通 resource 错误，不跳 404');
  {
    const dom = makeDom(null);
    const w = dom.window, doc = w.document;
    await new Promise(r => w.addEventListener('load', r));
    boot(dom);
    await tick(1400);
    w.location.hash = '#/html-demo/inline';
    await tick(1200);
    const before = w.$dbpError.list().length;

    const img = doc.createElement('img');
    img.src = './assets/plugin-inner-missing.png';
    doc.body.appendChild(img);
    const ev = new w.Event('error', { bubbles: false });
    Object.defineProperty(ev, 'target', { value: img });
    w.dispatchEvent(ev);
    await tick(250);

    ck('★★ 没跳 #/404', w.location.hash !== '#/404', w.location.hash);
    ck('★★ 按 phase:resource 进总线',
      w.$dbpError.list().slice(before).some(e => e.phase === 'resource'),
      w.$dbpError.list().slice(before).map(e => e.phase + ':' + e.message).join(' | '));
    dom.window.close();
  }

  console.log('\n【4】iframe 插件：元素 error / 内部资源 404 都不跳 404');
  {
    const dom = makeDom(null);
    const w = dom.window, doc = w.document;
    await new Promise(r => w.addEventListener('load', r));
    boot(dom);
    await tick(1400);
    w.location.hash = '#/html-demo/iframe';
    await tick(1400);

    const iframe = doc.querySelector('iframe.html-plugin-iframe-naked');
    ck('★ iframe 插件已渲染', !!iframe);
    const before = w.$dbpError.list().length;

    // 4a. iframe 元素自身的 error（以前 onIframeError 会无条件跳 404）
    if (iframe) {
      iframe.dispatchEvent(new w.Event('error'));
      await tick(200);
    }
    ck('★★ iframe @error 不再跳 #/404', w.location.hash !== '#/404', w.location.hash);
    ck('★★ iframe @error 不产生虚假 runtime 错误',
      !w.$dbpError.list().slice(before).some(e => e.phase === 'runtime'),
      w.$dbpError.list().slice(before).map(e => e.phase + ':' + e.message).join(' | '));

    // 4b. iframe 内部同源资源 404 → hookInnerErrors 按普通错误上报
    if (iframe && iframe.contentWindow && iframe.contentWindow.document) {
      const iw = iframe.contentWindow;
      const idoc = iw.document;
      const ibody = idoc.body || idoc.appendChild(idoc.createElement('body'));
      const innerImg = idoc.createElement('img');
      innerImg.src = './assets/iframe-inner-missing.png';
      ibody.appendChild(innerImg);
      const Ev = iw.Event || w.Event;
      const iev = new Ev('error', { bubbles: false });
      Object.defineProperty(iev, 'target', { value: innerImg });
      iw.dispatchEvent(iev);
      await tick(250);
      ck('★★ iframe 内部资源错误按 phase:resource 上报',
        w.$dbpError.list().slice(before).some(e => e.phase === 'resource' && /插件内资源/.test(e.message)),
        w.$dbpError.list().slice(before).map(e => e.phase + ':' + e.message).join(' | '));
    } else {
      ck('★★ iframe 内部资源错误按 phase:resource 上报', false, 'contentWindow 不可用');
    }
    ck('★★ 4b 之后仍没跳 #/404', w.location.hash !== '#/404', w.location.hash);
    dom.window.close();
  }

  console.log('\n【5】对照：插件「入口文件」404 → 仍然跳内置 404 页面');
  {
    const dom = makeDom({ fail: u => u.indexOf('pages/crafting.js') !== -1 });
    const w = dom.window;
    await new Promise(r => w.addEventListener('load', r));
    boot(dom);
    await tick(1500);
    w.location.hash = '#/crafting';
    await tick(1700);
    ck('★ 入口 404 仍跳 #/404', w.location.hash === '#/404', w.location.hash);
    dom.window.close();
  }
  {
    const dom = makeDom({ fail: (u, m) => m === 'HEAD' && u.indexOf('demo-iframe.html') !== -1 });
    const w = dom.window;
    await new Promise(r => w.addEventListener('load', r));
    boot(dom);
    await tick(1400);
    w.location.hash = '#/html-demo/iframe';
    await tick(1500);
    ck('★ iframe 入口 HTML 404 仍跳 #/404（precheck）', w.location.hash === '#/404', w.location.hash);
    dom.window.close();
  }

  console.log('\n===== 结果: ' + pass + ' 通过 / ' + fail + ' 失败 =====');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
