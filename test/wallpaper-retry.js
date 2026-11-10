/**
 * 404 在线壁纸加载失败 → 最多重试 3 次（首次 + 3 次重试 = 4 次在线尝试），
 * 全部失败才使用本地兜底图；全程静默（不弹窗、不进错误总线、不写历史日志）。
 * 覆盖：融入主页的 js/notfound.js + 独立 404.html。
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const tick = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const ck = (n, c, e) => { if (c) pass++; else { fail++; console.log('  ✗ ' + n + (e ? '  → ' + e : '')); } };

console.log('【1】静态接线（两个 404 版本同构）');
{
  const nf = read('js/notfound.js'), single = read('404.html');

  for (const [label, src] of [['内置 404', nf], ['独立 404.html', single]]) {
    ck(label + ' · 重试上限为 3', /WALLPAPER_MAX_RETRY\s*=\s*3/.test(src));
    ck(label + ' · 有重试间隔常量', /RETRY_DELAY\s*=\s*\d+/.test(src));
    ck(label + ' · 拆出 attemptWallpaper', /function attemptWallpaper\(token, retry, bust\)/.test(src));
    ck(label + ' · 重试 URL 带唯一 bust', /\?_=' \+ Date\.now\(\) \+ '_' \+ retry/.test(src));
    ck(label + ' · 失败先判重试、达上限才兜底',
      /[Rr]etry < WALLPAPER_MAX_RETRY/.test(src) && /applyBg\(FALLBACK, FALLBACK/.test(src));
    ck(label + ' · onBgLoad 停止待重试并清零',
      /function onBgLoad[\s\S]{0,220}?stopWallpaperRetry\(\)[\s\S]{0,120}?[Rr]etry\s*=\s*0/.test(src) ||
      /function onWallpaperLoad[\s\S]{0,220}?stopWallpaperRetry\(\)[\s\S]{0,120}?[Rr]etry\s*=\s*0/.test(src));
    ck(label + ' · token 作废在途回调', /if \(token !== [\w.]+[Tt]oken\) return/.test(src));
    ck(label + ' · 换图时重置计数', /loadWallpaper\(bust\)[\s\S]{0,240}?[Rr]etry = 0/.test(src));
    ck(label + ' · 仍无失败 toast', !/showToast\(['"]在线壁纸加载失败/.test(src));
  }
  ck('内置 404 · 壁纸 img 仍带静默标记', /data-dbp-quiet404="wallpaper"/.test(nf));
  ck('内置 404 · fetch 失败仍打静默标记', /throw quietErr\('HTTP ' \+ res\.status\)/.test(nf));
  ck('内置 404 · 卸载清理待重试', /onBeforeUnmount[\s\S]{0,220}?stopWallpaperRetry\(\)[\s\S]{0,120}?wallpaperToken\+\+/.test(nf));
}

/** 构造一个可控环境：手动驱动 setup()，模拟 img 的 load / error */
function makeEnv(secondSucceeds) {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body>', {
    runScripts: 'outside-only', url: 'http://localhost:8000/#/404', pretendToBeVisual: true
  });
  const w = dom.window;
  w.console = { log() {}, warn() {}, error() {}, info() {} };
  const calls = [], toasts = [];
  w.showToast = m => toasts.push(String(m));
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  w.scrollTo = function () {};
  w.URL.createObjectURL = () => 'blob:fake-wallpaper';
  w.URL.revokeObjectURL = () => {};
  w.fetch = function (u) {
    const url = String(u);
    if (/loliapi\.com\/acg/.test(url)) {
      calls.push(url);
      if (secondSucceeds && calls.length >= 2) {
        return Promise.resolve({
          ok: true, status: 200, url: 'https://cdn.example.com/wall.jpg',
          blob: () => Promise.resolve({ fake: true }),
          text: () => Promise.resolve(''), json: () => Promise.resolve({})
        });
      }
      return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('') });
    }
    // 一言 API 一律失败（走本地兜底短句），不干扰壁纸计数
    return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve(''), json: () => Promise.reject(new Error('404')) });
  };
  w.eval(read('vendor/vue.global.prod.js'));
  w.eval(read('js/utils.js'));
  w.eval(read('js/notfound.js'));
  const api = w.DBP_IMMERSIVE_404_COMPONENT.setup();
  return { w, dom, calls, toasts, api };
}

(async function () {
  console.log('\n【2】真实行为：4 次在线尝试全失败 → 兜底图');
  {
    const env = makeEnv(false);
    const busBefore = env.w.$dbpError.list().length;
    const storeBefore = JSON.parse(env.w.localStorage.getItem('dbp-error-log') || '[]').length;

    env.api.changeWallpaper();              // 触发首次在线加载
    for (let i = 0; i < 4; i++) {
      await tick(40);                       // 等 fetch 失败 → applyBg(在线 URL)
      env.api.onBgError();                 // 模拟 <img> error
      await tick(340);                     // 等 260ms 重试定时器
    }
    await tick(400);                       // 确认没有第 5 次请求

    ck('★ 在线尝试恰好 4 次（首次 + 3 次重试）', env.calls.length === 4, 'n=' + env.calls.length);
    ck('★ 每次重试 URL 都不同（绕过失败缓存）', new Set(env.calls).size === 4, env.calls.join(' | '));
    ck('★ 重试 URL 带 _1/_2/_3 编号', /_3/.test(env.calls[3] || ''), env.calls[3]);
    ck('★ 4 次全失败后切到兜底图', env.api.bgSrc.value === './assets/hero-bg.webp', env.api.bgSrc.value);
    ck('★ 兜底后不再发起在线请求', env.calls.length === 4);
    ck('★★ 全程不弹失败提示', !env.toasts.some(t => /失败|兜底/.test(t)), env.toasts.join(' | '));
    ck('★★ 全程不进错误总线', env.w.$dbpError.list().length === busBefore,
      'before=' + busBefore + ' after=' + env.w.$dbpError.list().length);
    ck('★★ 全程不写历史日志',
      JSON.parse(env.w.localStorage.getItem('dbp-error-log') || '[]').length === storeBefore);
    env.dom.window.close();
  }

  console.log('\n【3】真实行为：第 2 次成功 → 立即停止重试');
  {
    const env = makeEnv(true);
    env.api.changeWallpaper();
    await tick(40);
    env.api.onBgError();                   // 第 1 次失败 → 安排 1 次重试
    await tick(340);                       // 第 2 次在线请求（成功）
    await tick(40);
    env.api.onBgLoad();                    // 模拟图片加载成功
    await tick(450);                       // 不应再有第 3 次

    ck('★ 只发起 2 次在线请求', env.calls.length === 2, 'n=' + env.calls.length);
    ck('★ 显示的是在线图（blob），不是兜底图', /^blob:/.test(env.api.bgSrc.value), env.api.bgSrc.value);
    ck('★ 成功后不再重试', env.calls.length === 2);
    env.dom.window.close();
  }

  console.log('\n【4】真实行为：主动换图打断在途重试并重置计数');
  {
    const env = makeEnv(false);
    env.api.changeWallpaper();
    await tick(40);
    env.api.onBgError();                   // retry=1，260ms 后本会重试
    env.api.changeWallpaper();             // 换一张：清定时器 + token++ + retry=0
    await tick(500);

    ck('★ 只有 1 次首次 + 1 次换图请求（旧重试已作废）', env.calls.length === 2, 'n=' + env.calls.length);
    ck('★ 换图后未误切兜底图', env.api.bgSrc.value !== './assets/hero-bg.webp', env.api.bgSrc.value);
    env.dom.window.close();
  }

  console.log('\n===== 结果: ' + pass + ' 通过 / ' + fail + ' 失败 =====');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
