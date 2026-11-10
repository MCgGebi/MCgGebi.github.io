/**
 * 收窄后的 404 规则：
 *   ✅ 仅「插件文件加载失败（HTTP 404）」→ 直接显示内置 404 页面，不显示错误窗
 *   ↩️ 其它 404（框架元数据 / 图片样式脚本资源 / 早期脚本 / Vue / promise / 历史日志）
 *      全部回退为原来的行为：按普通错误处理，进总线、写日志、正常显示错误窗
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
let pass = 0, fail = 0;
const ck = (n, c, e) => { if (c) pass++; else { fail++; console.log('  ✗ ' + n + (e ? '  → ' + e : '')); } };

/* ============================================================
   1. 静态接线
   ============================================================ */
console.log('【1】静态接线：插件路径跳 404 / 其它路径回退');
{
  const utils = read('js/utils.js'), loader = read('js/plugin-loader.js'),
        router = read('js/router.js'), app = read('js/app.js'),
        init = read('js/init.js'), index = read('index.html');

  // --- 插件加载路径仍保留 404 页面 ---
  ck('utils 暴露 DBP_is404 / DBP_show404', /global\.DBP_is404\s*=\s*is404/.test(utils) && /global\.DBP_show404\s*=/.test(utils));
  ck('★ loader 用 httpError 打 status/isNotFound 标记', /function httpError[\s\S]{0,220}?isNotFound/.test(loader));
  ck('★ JS 插件 fetch 失败抛 httpError', /throw httpError\(resp, '插件加载失败/.test(loader));
  ck('★ plugins.json fetch 失败也抛 httpError（但 bootstrap 不拦）', /throw httpError\(resp, 'plugins\.json/.test(loader));
  ck('★ Markdown 插件入口 404 走 DBP_show404', /is404\(err\) && isEntry404\(err\)\) \{ loaded\.value = true; error\.value = ''; if \(global\.DBP_show404\)/.test(loader));
  ck('★ HTML inline 插件入口 404 走 DBP_show404', /is404\(err\) && isEntry404\(err\)\) \{ loading\.value = false; error\.value = ''; if \(global\.DBP_show404\)/.test(loader));
  ck('★ iframe 插件有 404 预检', /precheck404/.test(loader) && /@error="onIframeError"/.test(loader));
  ck('★ router 仅按显式 404 标记跳 /404', /err\.isNotFound === true \|\| err\.status === 404/.test(router) && /next\(\{ path: '\/404', replace: true \}\)/.test(router));
  // ★★ 本轮收窄：插件「内部」资源 404 不得跳 404
  ck('★★ httpError 支持入口标记', /if \(isEntry === true\) e\.__dbpPluginEntry = true/.test(loader));
  ck('★★ 三处入口 fetch 传 isEntry=true', (loader.match(/httpError\([^)]*, true\)/g) || []).length >= 3);
  ck('★★ plugins.json 不带入口标记', /throw httpError\(resp, 'plugins\.json 加载失败'\);/.test(loader));
  ck('★★ 所有 show404 都要求 isEntry404 或入口 HEAD 判定',
    /is404\(err\) && isEntry404\(err\)\)[\s\S]{0,120}?global\.DBP_show404/.test(loader));
  ck('★★ onIframeError 不再无条件跳 404',
    /function onIframeError\(\)/.test(loader) && !/function onIframeError\(\) \{ if \(global\.DBP_show404\)/.test(loader));
  ck('★★ router 要求 __dbpPluginEntry 入口标记', /err\.__dbpPluginEntry === true && \(err\.isNotFound === true \|\| err\.status === 404\)/.test(router));
  ck('★★ 同源 iframe 内部资源错误按 resource 上报', /hookInnerErrors[\s\S]{0,600}?report\('resource', new Error\('插件内资源加载失败/.test(loader));

  // --- 收窄点：只有 plugin-load 阶段拦 404 ---
  ck('★★ loader report 仅 plugin-load 阶段拦 404', /phase === 'plugin-load' && is404\(err\)/.test(loader));
  ck('★★ bootstrap 恢复 fatal:true（框架元数据 404 仍算错误）', /report\('bootstrap', err, \{ fatal: true \}\)/.test(loader));
  ck('★★ 无 DBP_404_ON_START 标志', !/DBP_404_ON_START/.test(loader + app + init));

  // --- 回退点：其它 404 恢复原行为 ---
  ck('★★ 错误总线 push 不再过滤 404', !/push:\s*function[\s\S]{0,220}?is404/.test(utils));
  ck('★★ 历史日志恢复时不再剔除 404', /return arr\.slice\(-MAX_ERRORS\)\.filter\(function \(e\) \{ return e && typeof e === 'object'; \}\)/.test(utils));
  ck('★★ 资源元素加载失败恢复上报', /report\('resource', new Error\('资源加载失败/.test(loader));
  ck('★★ index 早期资源错误恢复捕获', !/tag === 'script' \|\| tag === 'link' \|\| tag === 'img'\) return/.test(index));
  ck('★★ index unhandledrejection 恢复全量记录', /unhandledrejection[\s\S]{0,260}?__DBP_EARLY_ERRORS\.push[\s\S]{0,140}?UnhandledRejection:/.test(index));
  ck('★★ app 早期错误恢复全量纳入', /var early = \(global\.__DBP_EARLY_ERRORS \|\| \[\]\)\.map/.test(app));
  ck('★★ app reportStartup 无 404 过滤', !/function reportStartup[\s\S]{0,220}?DBP_is404/.test(app));
  ck('★★ app errorHandler 无 404 过滤', !/errorHandler[\s\S]{0,220}?DBP_is404/.test(app));
  ck('★★ init 降级总线恢复全量记录', !/HTTP\\s\*404\|\\\(404\\\)/.test(init));
  ck('★★ init 无静态 404 兜底页', !/renderNotFoundFallback/.test(init));
  ck('★★ init 启动 catch 恢复报错兜底', /report\('bootstrap', err, \{ fatal: true \}\);[\s\S]{0,160}?ensureVisible\(err\)/.test(init));
}

/* ============================================================
   2. 错误总线：404 现在是普通错误（回退之前）
   ============================================================ */
console.log('\n【2】错误总线：404 回退为普通错误');
{
  const dom = new JSDOM('<!DOCTYPE html><html><body></body>', {
    runScripts: 'outside-only', url: 'http://localhost:8000/', pretendToBeVisual: true
  });
  const w = dom.window;
  w.eval(read('js/utils.js'));
  const bus = w.$dbpError;

  ck('行号里的 404 不误判', w.DBP_is404("at app.js:404:11 Cannot read 'x'") === false);
  ck('普通错误不误判', w.DBP_is404('TypeError: x is undefined') === false);
  ck('HTTP 404 仍可识别（供插件路径用）', w.DBP_is404({ status: 404 }) === true);

  bus.push({ phase: 'bootstrap', message: 'plugins.json 加载失败 (404)' });
  bus.push({ phase: 'resource', message: '资源加载失败: ./assets/missing.png' });
  bus.push({ phase: 'render', message: 'HTTP 404 - some api' });
  ck('★★ 404 全部正常进总线（回退）', bus.list().length === 3, 'n=' + bus.list().length);
  ck('★★ 404 正常持久化到历史日志', JSON.parse(w.localStorage.getItem('dbp-error-log')).length === 3);
  ck('★★ 404 正常驱动错误面板', bus.liveList().length === 3);

  // 刷新恢复：历史 404 不剔除
  w.eval(read('js/utils.js'));
  ck('★★ 历史里的 404 恢复时保留', w.$dbpError.list().length === 3);

  w.DBP_show404();
  ck('★ DBP_show404 仍可跳 404 页面（插件路径专用）', w.location.hash === '#/404', w.location.hash);
  dom.window.close();
}

/* ============================================================
   3. 端到端
   ============================================================ */
function makeDom(failMatcher) {
  const html = read('index.html');
  const dom = new JSDOM(html, {
    runScripts: 'outside-only', url: 'http://localhost:8000/', pretendToBeVisual: true,
    beforeParse(window) {
      window.console = { log() {}, error() {}, warn() {}, info() {} };
      window.fetch = function (url) {
        const u = String(url);
        if (failMatcher && failMatcher(u)) {
          return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve(''), json: () => Promise.reject(new Error('404')) });
        }
        // 外站（壁纸 / 一言）模拟 404：内部静默兜底，不应产生错误记录
        if (/^https?:\/\//i.test(u)) {
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
  return dom;
}
function boot(dom) {
  const w = dom.window;
  const files = ['vendor/vue.global.prod.js', 'vendor/vue-router.global.prod.js',
    'js/utils.js', 'js/plugin-loader.js', 'js/notfound.js', 'js/router.js',
    'js/app.js', 'js/settings.js', 'js/announcement.js', 'js/init.js'];
  files.forEach(f => { try { w.eval(read(f)); } catch (e) { console.log('[EVAL FAIL]', f, e.message); } });
}

(async function () {
  console.log('\n【3】插件文件 404 → 显示 404 页面，无错误窗');
  {
    const dom = makeDom(u => u.indexOf('pages/crafting.js') !== -1);
    const w = dom.window, doc = w.document;
    await new Promise(r => w.addEventListener('load', r));
    boot(dom);
    await new Promise(r => setTimeout(r, 1600));

    const before = w.$dbpError.list().length;
    w.location.hash = '#/crafting';
    await new Promise(r => setTimeout(r, 1800));

    ck('★ 插件 404 后地址跳到 #/404', w.location.hash === '#/404', w.location.hash);
    ck('★★ 未新增错误记录', w.$dbpError.list().length === before,
      'before=' + before + ' after=' + w.$dbpError.list().length);
    ck('★★ 无常驻错误面板', !doc.querySelector('.dbp-error-panel'));
    ck('★★ 无 /plugin-error 页面', !/\/plugin-error/.test(String(w.location.hash)));
    ck('★★ 显示内置 404 页面', !!doc.querySelector('.dbp-404') || /404 - 页面未找到/.test(doc.body.textContent),
      (doc.body.textContent || '').slice(0, 100));
    dom.window.close();
  }

  console.log('\n【4】框架元数据 plugins.json 404 → 回退为致命错误，显示错误窗');
  {
    const dom = makeDom(u => u.indexOf('plugins.json') !== -1);
    const w = dom.window, doc = w.document;
    await new Promise(r => w.addEventListener('load', r));
    boot(dom);
    await new Promise(r => setTimeout(r, 2200));

    ck('★★ 错误已进总线（回退）', w.$dbpError.list().length > 0,
      w.$dbpError.list().map(e => e.message).join(' | '));
    ck('★★ 含 bootstrap 致命错误', w.$dbpError.list().some(e => e.phase === 'bootstrap' && e.fatal === true));
    ck('★★ 错误可见（面板 或 静态兜底）',
      !!doc.querySelector('.dbp-error-panel') || !!doc.querySelector('.dbp-fatal-fallback'));
    ck('★★ 错误窗含 plugins.json 404 详情', /plugins\.json|404/.test(doc.body.textContent));
    ck('★★ 未主动跳到 #/404（回退之前：路由表为空时由 catch-all 兜底）',
      w.location.hash !== '#/404', w.location.hash);
    dom.window.close();
  }

  console.log('\n【5】资源元素 404 → 回退为 phase:resource 错误');
  {
    const dom = makeDom(null);
    const w = dom.window;
    await new Promise(r => w.addEventListener('load', r));
    boot(dom);
    await new Promise(r => setTimeout(r, 1400));
    const before = w.$dbpError.list().length;
    const img = w.document.createElement('img');
    img.src = './assets/missing-image.png';
    w.document.body.appendChild(img);
    const ev = new w.Event('error', { bubbles: false });
    Object.defineProperty(ev, 'target', { value: img });
    w.dispatchEvent(ev);
    await new Promise(r => setTimeout(r, 250));
    const added = w.$dbpError.list().slice(before);
    ck('★★ 资源 error 恢复上报', added.some(e => e.phase === 'resource'),
      added.map(e => e.phase + ':' + e.message).join(' | '));
    dom.window.close();
  }

  console.log('\n===== 结果: ' + pass + ' 通过 / ' + fail + ' 失败 =====');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
