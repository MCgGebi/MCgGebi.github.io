/**
 * 404 页面壁纸 / 一言加载失败 → 直接忽略，不弹窗、不记录。
 * 同时保证：非 404 上下文的资源错误仍按普通错误处理（回退上一轮规则）。
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let pass = 0, fail = 0;
const ck = (n, c, e) => { if (c) pass++; else { fail++; console.log('  ✗ ' + n + (e ? '  → ' + e : '')); } };

console.log('【1】静态接线');
{
  const utils = read('js/utils.js'), loader = read('js/plugin-loader.js'),
        app = read('js/app.js'), index = read('index.html'),
        nf = read('js/notfound.js'), single = read('404.html');

  ck('utils 暴露 DBP_isQuiet404Asset', /global\.DBP_isQuiet404Asset\s*=/.test(utils));
  ck('utils 暴露 DBP_isQuiet404Reason', /global\.DBP_isQuiet404Reason\s*=/.test(utils));
  ck('★ 判定严格限定 404 上下文', /function in404Context[\s\S]{0,260}?dbp-404/.test(utils) && /if \(!in404Context\(\)\) return false/.test(utils));
  ck('★ 静默标记 data-dbp-quiet404', /data-dbp-quiet404/.test(utils));
  ck('★ 白名单仅 404 专用外站',
    utils.indexOf('loliapi\\.com\\/acg|v1\\.hitokoto\\.cn|api\\.quotable\\.io') !== -1);

  ck('★★ index 早期脚本有等价内联判定', /function __dbpQuiet404/.test(index) && /window\.__DBP_QUIET404/.test(index));
  ck('★★ 早期 error 监听接入静默判定', /addEventListener\('error'[\s\S]{0,160}?__dbpQuiet404\(e\.target/.test(index));
  ck('★★ 早期 unhandledrejection 接入静默判定', /addEventListener\('unhandledrejection'[\s\S]{0,160}?__dbpQuiet404\(null, null, e\.reason\)/.test(index));
  ck('★★ loader 资源监听接入静默判定', /DBP_isQuiet404Asset && global\.DBP_isQuiet404Asset\(e\.target, null\)\) return/.test(loader));
  ck('★★ loader promise 监听接入静默判定', /DBP_isQuiet404Reason && global\.DBP_isQuiet404Reason\(e\.reason\)\) return/.test(loader));
  ck('★★ app errorHandler 接入静默判定', /errorHandler[\s\S]{0,200}?DBP_isQuiet404Reason \(global|errorHandler[\s\S]{0,200}?DBP_isQuiet404Reason/.test(app));

  ck('★★ 404 壁纸 img 带静默标记', /data-dbp-quiet404="wallpaper"/.test(nf));
  ck('★★ 404 onBgError 不再弹 toast', !/在线壁纸加载失败/.test(nf));
  ck('★★ 404 quietErr 打 __dbpQuiet404 标记', /function quietErr[\s\S]{0,140}?__dbpQuiet404 = true/.test(nf));
  ck('★★ 壁纸 fetch 失败用 quietErr', /throw quietErr\('HTTP ' \+ res\.status\)/.test(nf));
  ck('★★ 一言 fetch 失败用 quietErr', /throw quietErr\('HTTP ' \+ r\.status\)/.test(nf));
  ck('★★ 独立 404.html 壁纸失败不再弹提示', !/在线壁纸加载失败/.test(single));
}

console.log('\n【2】判定函数（utils 真实执行）');
{
  const dom = new JSDOM('<!DOCTYPE html><html><body></body>', {
    runScripts: 'outside-only', url: 'http://localhost:8000/#/home', pretendToBeVisual: true
  });
  const w = dom.window;
  w.eval(read('js/utils.js'));

  const img = w.document.createElement('img');
  img.setAttribute('data-dbp-quiet404', 'wallpaper');
  img.src = 'https://www.loliapi.com/acg/';

  ck('★ 非 404 页面 · 带标记的壁纸 → 不忽略（仍算错误）', w.DBP_isQuiet404Asset(img, null) === false);
  ck('★ 非 404 页面 · 外站 URL → 不忽略', w.DBP_isQuiet404Asset(null, 'https://www.loliapi.com/acg/') === false);
  ck('★ 非 404 页面 · reason 标记 → 不忽略', w.DBP_isQuiet404Reason({ __dbpQuiet404: true }) === false);

  w.location.hash = '#/404';
  ck('★★ 404 页面 · 带标记壁纸 → 忽略', w.DBP_isQuiet404Asset(img, null) === true);
  ck('★★ 404 页面 · loliapi URL → 忽略', w.DBP_isQuiet404Asset(null, 'https://www.loliapi.com/acg/') === true);
  ck('★★ 404 页面 · hitokoto URL → 忽略', w.DBP_isQuiet404Asset(null, 'https://v1.hitokoto.cn/?c=i') === true);
  ck('★★ 404 页面 · 其它资源 → 不忽略（回退）', w.DBP_isQuiet404Asset(null, './js/missing-plugin.js') === false);

  const plain = w.document.createElement('img');
  plain.src = './assets/other.png';
  ck('★★ 404 页面 · 无标记的普通资源 → 不忽略', w.DBP_isQuiet404Asset(plain, null) === false);

  ck('★★ 404 页面 · reason 标记 → 忽略', w.DBP_isQuiet404Reason({ __dbpQuiet404: true }) === true);
  ck('★★ 404 页面 · 普通异常 → 不忽略', w.DBP_isQuiet404Reason(new Error('TypeError: x undefined')) === false);

  // 用 DOM 容器（非 hash）也能判定：catch-all 渲染的 404
  w.location.hash = '#/some-unknown-path';
  w.document.body.innerHTML = '<div class="dbp-404"></div>';
  ck('★★ catch-all 渲染的 404（hash 非 #/404）也能判定', w.DBP_isQuiet404Asset(img, null) === true);

  dom.window.close();
}

console.log('\n【3】早期脚本：壁纸 error / promise 不进 __DBP_EARLY_ERRORS');
{
  const html = read('index.html');
  const m = html.match(/window\.__DBP_EARLY_ERRORS = \[\];([\s\S]*?)console\.log\('\[DBP\] 早期错误捕获已就绪/);
  ck('★ 成功抽取早期脚本片段', !!m);
  const dom = new JSDOM('<!DOCTYPE html><html><body></body>', {
    runScripts: 'outside-only', url: 'http://localhost:8000/#/404', pretendToBeVisual: true
  });
  const w = dom.window;
  w.eval('window.__DBP_EARLY_ERRORS = [];' + m[1]);

  const img = w.document.createElement('img');
  img.setAttribute('data-dbp-quiet404', 'wallpaper');
  img.src = 'https://www.loliapi.com/acg/';
  w.document.body.appendChild(img);

  function fireError(target) {
    const ev = new w.Event('error', { bubbles: false });
    Object.defineProperty(ev, 'target', { value: target });
    w.dispatchEvent(ev);
  }
  function fireReject(reason) {
    const ev = new w.Event('unhandledrejection', { bubbles: false });
    Object.defineProperty(ev, 'reason', { value: reason });
    w.dispatchEvent(ev);
  }

  fireError(img);
  fireReject({ __dbpQuiet404: true, message: 'HTTP 404' });
  ck('★★ 壁纸 error 未记录', w.__DBP_EARLY_ERRORS.length === 0, JSON.stringify(w.__DBP_EARLY_ERRORS));

  // 普通资源错误仍记录（回退）
  const other = w.document.createElement('img');
  other.src = './assets/other.png';
  w.document.body.appendChild(other);
  fireError(other);
  fireReject(new Error('TypeError: x undefined'));
  ck('★★ 普通资源 error 仍记录（回退）', w.__DBP_EARLY_ERRORS.length === 2, 'n=' + w.__DBP_EARLY_ERRORS.length);

  // 非 404 上下文：即便带标记也不忽略
  w.location.hash = '#/home';
  w.document.body.innerHTML = '';
  const img2 = w.document.createElement('img');
  img2.setAttribute('data-dbp-quiet404', 'wallpaper');
  w.document.body.appendChild(img2);
  const before = w.__DBP_EARLY_ERRORS.length;
  fireError(img2);
  ck('★★ 非 404 页面带标记资源仍记录', w.__DBP_EARLY_ERRORS.length === before + 1);

  dom.window.close();
}

console.log('\n【4】端到端：404 页面壁纸失败 → 总线无新增、无错误面板、无历史日志');
{
  const html = read('index.html');
  const dom = new JSDOM(html, {
    runScripts: 'outside-only', url: 'http://localhost:8000/', pretendToBeVisual: true,
    beforeParse(w) {
      w.console = { log() {}, error() {}, warn() {}, info() {} };
      w.fetch = function (u) {
        u = String(u);
        // 壁纸 / 一言外站一律失败
        if (/^https?:\/\//i.test(u)) return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve(''), json: () => Promise.reject(new Error('404')) });
        const p = u.replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '').split('?')[0];
        return new Promise(res => fs.readFile(path.join(ROOT, decodeURIComponent(p)), 'utf8', (e, t) =>
          e ? res({ ok: false, status: 404, text: () => Promise.resolve('') })
            : res({ ok: true, status: 200, text: () => Promise.resolve(t), json: () => Promise.resolve(JSON.parse(t)) })));
      };
      w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
      w.scrollTo = function () {};
      w.requestAnimationFrame = fn => setTimeout(fn, 0);
      w.URL.createObjectURL = () => 'blob:fake';
    },
  });
  const w = dom.window, doc = w.document;
  const earlyM = html.match(/window\.__DBP_EARLY_ERRORS = \[\];([\s\S]*?)console\.log\('\[DBP\] 早期错误捕获已就绪/);

  (async function () {
    await new Promise(r => w.addEventListener('load', r));
    if (earlyM) w.eval('window.__DBP_EARLY_ERRORS = [];' + earlyM[1]);
    ['vendor/vue.global.prod.js', 'vendor/vue-router.global.prod.js', 'js/utils.js',
      'js/plugin-loader.js', 'js/notfound.js', 'js/router.js', 'js/app.js',
      'js/settings.js', 'js/announcement.js', 'js/init.js']
      .forEach(f => { try { w.eval(read(f)); } catch (e) { console.log('  [EVAL FAIL]', f, e.message); } });

    await new Promise(r => setTimeout(r, 1600));
    w.location.hash = '#/404';
    await new Promise(r => setTimeout(r, 900));

    const panelBefore = !!doc.querySelector('.dbp-error-panel');
    const before = w.$dbpError.list().length;
    const storeBefore = JSON.parse(w.localStorage.getItem('dbp-error-log') || '[]').length;

    const bg = doc.querySelector('.dbp-404-bg') || doc.createElement('img');
    bg.setAttribute('data-dbp-quiet404', 'wallpaper');
    if (!bg.parentNode) doc.body.appendChild(bg);
    const ev = new w.Event('error', { bubbles: false });
    Object.defineProperty(ev, 'target', { value: bg });
    w.dispatchEvent(ev);
    await new Promise(r => setTimeout(r, 300));

    ck('★★ 壁纸失败后总线无新增错误', w.$dbpError.list().length === before,
      'before=' + before + ' after=' + w.$dbpError.list().length);
    ck('★★ 壁纸失败后历史日志未写入', JSON.parse(w.localStorage.getItem('dbp-error-log') || '[]').length === storeBefore);
    ck('★★ 未新增错误面板', !!doc.querySelector('.dbp-error-panel') === panelBefore);
    ck('★★ 早期错误数组未新增', (w.__DBP_EARLY_ERRORS || []).length === 0,
      'n=' + (w.__DBP_EARLY_ERRORS || []).length);

    // 对照：普通资源失败仍按错误处理（回退）
    const other = doc.createElement('img');
    other.src = './assets/missing-other.png';
    doc.body.appendChild(other);
    const ev2 = new w.Event('error', { bubbles: false });
    Object.defineProperty(ev2, 'target', { value: other });
    w.dispatchEvent(ev2);
    await new Promise(r => setTimeout(r, 200));
    ck('★★ 对照：普通资源失败仍进总线', w.$dbpError.list().length > before,
      w.$dbpError.list().map(e => e.phase + ':' + e.message).join(' | '));

    console.log('\n===== 结果: ' + pass + ' 通过 / ' + fail + ' 失败 =====');
    dom.window.close();
    process.exit(fail ? 1 : 0);
  })().catch(e => { console.error('CRASH', e); process.exit(2); });
}
