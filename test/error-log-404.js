const fs = require('fs'), path = require('path'), vm = require('vm');
let JSDOM; try { JSDOM = require('jsdom').JSDOM; } catch (e) { console.log('需要 jsdom'); process.exit(0); }
const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const ck = (n, c, e) => { if (c) pass++; else { fail++; console.log('  ✗ ' + n + ' → ' + (e || '')); } };
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ============================================================
   一、错误总线：持久化 / 最近 20 条 / 旧记录不影响弹窗
   ============================================================ */
console.log('【1】错误日志持久化（真实 localStorage）');
{
  const dom = new JSDOM('<!DOCTYPE html><html><body></body>', {
    runScripts: 'outside-only', url: 'http://localhost:8000/', pretendToBeVisual: true
  });
  const w = dom.window;
  const utils = read('js/utils.js');
  w.eval(utils);
  const bus = w.$dbpError;

  ck('$dbpError 已就绪', !!bus);
  ck('暴露 MAX = 20', bus.MAX === 20);
  ck('暴露 liveList / historyList / clearLive',
    typeof bus.liveList === 'function' && typeof bus.historyList === 'function' && typeof bus.clearLive === 'function');
  ck('初始为空', bus.list().length === 0);

  bus.push({ phase: 'runtime', message: '错误A' });
  bus.push({ phase: 'plugin-load', message: '错误B', fatal: true });
  bus.push({ message: '错误C' });
  ck('push 后 list = 3', bus.list().length === 3);
  ck('push 后 liveList = 3', bus.liveList().length === 3);
  ck('历史为空', bus.historyList().length === 0);
  ck('自动补全 time / phase', !!bus.list()[0].time && bus.list()[2].phase === 'runtime');
  const raw = w.localStorage.getItem('dbp-error-log');
  ck('已写入 localStorage', !!raw && JSON.parse(raw).length === 3);
  ck('存储不含内部 live/restored 标记', !/"live"/.test(raw) && !/"restored"/.test(raw));

  // 模拟刷新页面：重新执行 utils.js
  w.localStorage.setItem('dbp-theme', 'dark');
  w.eval(utils);
  const bus2 = w.$dbpError;
  ck('★ 刷新后日志仍在（持久生效）', bus2.list().length === 3, 'n=' + bus2.list().length);
  ck('★ 恢复记录全部 restored=true', bus2.list().every(e => e.restored === true));
  ck('★ 恢复记录全部 live=false', bus2.list().every(e => e.live === false));
  ck('★★ liveList = 0 → 旧记录不会触发错误弹窗', bus2.liveList().length === 0, 'n=' + bus2.liveList().length);
  ck('historyList = 3', bus2.historyList().length === 3);
  ck('消息与 fatal 保真', bus2.list()[0].message === '错误A' && bus2.list()[1].fatal === true);
  ck('其它 localStorage 键不受影响', w.localStorage.getItem('dbp-theme') === 'dark');

  bus2.push({ message: '新错误D' });
  ck('新增后 liveList = 1', bus2.liveList().length === 1);
  ck('新增后 list = 4', bus2.list().length === 4);
  ck('新记录 restored=false', bus2.liveList()[0].restored === false);

  bus2.clearLive();
  ck('★ clearLive 只清本次会话', bus2.liveList().length === 0 && bus2.list().length === 3);
  ck('clearLive 后历史仍在存储', JSON.parse(w.localStorage.getItem('dbp-error-log')).length === 3);

  bus2.clear();
  ck('clear 清空全部', bus2.list().length === 0);
  ck('clear 清除 localStorage 键', w.localStorage.getItem('dbp-error-log') === null);

  for (let i = 0; i < 25; i++) bus2.push({ message: 'E' + i });
  ck('★★ 超过 20 条只保留最近 20 条', bus2.list().length === 20, 'n=' + bus2.list().length);
  ck('保留的是最新的 E5…E24', bus2.list()[0].message === 'E5' && bus2.list()[19].message === 'E24');
  ck('存储同样只 20 条', JSON.parse(w.localStorage.getItem('dbp-error-log')).length === 20);
  dom.window.close();
}

/* ============================================================
   二、主站接线：面板只读 liveList / 设置页读 list
   ============================================================ */
console.log('\n【2】主站接线');
{
  const app = read('js/app.js'), settings = read('js/settings.js'), utils = read('js/utils.js');
  ck('★ app.js 面板改读 liveList（旧记录不进弹窗）', /bus\.liveList\s*\?\s*bus\.liveList\(\)/.test(app));
  ck('★ app.js 单条关闭用 clearLive（不误删历史）', /clearLive/.test(app));
  ck('★ app.js allErrors 按 seq 去重', /seen\[k\]/.test(app));
  ck('★ utils 持久化写入 localStorage', /localStorage\.setItem\(STORE_KEY/.test(utils));
  ck('★ utils 启动时读取 localStorage', /localStorage\.getItem\(STORE_KEY/.test(utils));
  ck('★ settings 读 list()（含历史）', /\$dbpError\.list\(\)/.test(settings));
  ck('★ settings 显示「历史」标记', /e\.restored/.test(settings) && /历史/.test(settings));
  ck('★ settings 提示「不会触发错误弹窗」', /不会触发错误弹窗/.test(settings));
  ck('★ settings 显示上限 maxErrors', /maxErrors/.test(settings));
  ck('★ settings 的 hasFatal 只看 liveList', /liveList/.test(settings));
  ck('★ settings 定时刷新日志', /errTick/.test(settings) && /setInterval/.test(settings));
  ck('★ 设置页清除用 clear()（含历史）', /\$dbpError\.clear\(\)/.test(settings));
  ck('★ index.html 缓存戳已更新', /\?v=0\.9\.28/.test(read('index.html')));
}

/* ============================================================
   三、404 页面：静态结构 + 语法
   ============================================================ */
console.log('\n【3】404 页面结构');
{
  const html = read('404.html');
  const plugins = read('js/plugins.json'), index = read('index.html'), router = read('js/router.js');
  ck('404.html 存在且完整', /^<!DOCTYPE html>/.test(html) && /<\/html>\s*$/.test(html));
  ck('★★ 独立 404.html 未作为插件注册（主页改用内置组件）', !/404\.html|\/404\b/.test(plugins));
  ck('★★ 主页未直接嵌入独立 404.html 文件', !/404\.html/.test(index));
  ck('★★ router.js 未直接引用独立 404.html 文件', !/404\.html/.test(router));

  // ★ 内置 404：融入主页 + 设置项可切回旧版极简
  const nf = read('js/notfound.js');
  const settings = read('js/settings.js');
  const css = read('styles/main.css');
  ck('★ 内置 404 组件存在（沉浸式 / 极简）',
     /DBP_NOTFOUND_COMPONENT/.test(nf) && /DbpImmersive404/.test(nf) && /DbpMinimal404/.test(nf));
  ck('★ 配置项 dbp-404-style，默认 immersive',
     /dbp-404-style/.test(nf) && /DEFAULT_MODE\s*=\s*'immersive'/.test(nf));
  ck('★ 两种样式可切换', /'immersive'/.test(nf) && /'minimal'/.test(nf));
  ck('★ 旧版极简 404 模板一字保留', /404 - 页面未找到/.test(nf));
  ck('★ 主页引入 notfound.js', /js\/notfound\.js/.test(index));
  ck('★ 路由 catch-all 使用内置组件', /DBP_NOTFOUND_COMPONENT/.test(router) && /:pathMatch/.test(router));
  ck('★ 设置页含样式切换与预览按钮', /setNotFoundStyle/.test(settings) && /preview404/.test(settings));
  ck('★ CSS 作用域 .dbp-404 且不遮挡导航（absolute inset:0）',
     /\.dbp-404\{[\s\S]*?position:absolute; inset:0/.test(css));
  ck('★ 内置版与独立版同为外部一言 + 悬浮图片源气泡',
     /v1\.hitokoto\.cn/.test(nf) && /dbp-404-srctip/.test(nf) && /api\.quotable\.io/.test(nf));
  ck('★ 本地衬线字体已引入主页', /noto-serif-sc\.css/.test(index));

  ck('随机壁纸 API 正确', /https:\/\/www\.loliapi\.com\/acg\//.test(html));
  ck('本地兜底壁纸', /assets\/hero-bg\.webp/.test(html));
  ck('★ 图片源默认不显示（悬浮原图才浮出）',
     /id="wp-src"/.test(html) && /\.src-tip\{/.test(html) &&
     /opacity:0; visibility:hidden/.test(html) && /#wp-orig:hover \.src-tip/.test(html) &&
     !/<footer/.test(html));
  ck('★ 悬浮气泡可点击复制 + Ctrl/⌘ 复制', /tipEl.addEventListener\('click'/.test(html) && /e.ctrlKey \|\| e.metaKey/.test(html));
  ck('显示图片尺寸', /naturalWidth/.test(html) && /id="wp-meta"/.test(html));
  ck('原图跳转按钮', /id="wp-orig"/.test(html) && /target="_blank"/.test(html));
  ck('404 浮动字', /class="num"/.test(html) && /@keyframes floaty/.test(html));
  ck('刷新按钮', /id="btn-refresh"/.test(html));
  ck('返回按钮', /id="btn-back"/.test(html) && /history\.back\(\)/.test(html));
  ck('换壁纸按钮', /id="btn-wallpaper"/.test(html));
  ck('短句定时刷新 6s', /QUOTE_MS\s*=\s*6000/.test(html) && /setTimeout\(nextQuote/.test(html));
  ck('★ 外部一言 API + 英文备源', /v1\.hitokoto\.cn/.test(html) && /api\.quotable\.io/.test(html));
  ck('★ 短句显示出处', /d\.from_who/.test(html) && /qfrom\.textContent\s*=\s*'—— '/.test(html) && /id="qfrom"/.test(html));
  ck('★ 进度条与「一言」标签已移除',
     !/qfoot|qbar|qcount|@keyframes quoteTimer/.test(html) && !/<span>一言<\/span>/.test(html));
  ck('★ 本地开源字体（OFL）+ 仅作用于中央',
     /assets\/fonts\/noto-serif-sc\.css/.test(html) &&
     /font-family:'Noto Serif SC Local'/.test(html) &&
     /\.stage\{[\s\S]*?font-family:'Noto Serif SC Local'/.test(html) &&
     fs.existsSync(path.join(ROOT, 'assets/fonts/OFL.txt')) &&
     fs.readdirSync(path.join(ROOT,'assets/fonts')).filter(f=>f.endsWith('.woff2')).length >= 10);
  const qblock = html.match(/var QUOTES = \[([\s\S]*?)\];/);
  const qnum = qblock ? (qblock[1].match(/'[^']*'/g) || []).length : 0;
  ck('一言文案池 ≥ 20 条', qnum >= 20, 'n=' + qnum);
  ck('帮助小窗（hover + click）', /help-wrap:hover \.help-pop/.test(html) && /help-pop\.on/.test(html));
  ck('帮助按钮 + Esc 关闭', /id="help-btn"/.test(html) && /k === 'escape'/.test(html));
  ck('快捷键 R / H', /k === 'r'/.test(html) && /k === 'h'/.test(html));
  ck('响应式 + 减少动效降级', /@media\(max-width:760px\)/.test(html) && /prefers-reduced-motion/.test(html));
  ck('主题色跟随主页', /dbp-accent/.test(html));

  // 轻量按钮（参考版：底部 mini 按钮，几乎隐形、稀疏、极小）
  const grab = (re) => (html.match(re) || [,''])[1];
  const numOf = (blk, re) => { const m = blk.match(re); return m ? parseFloat(m[1]) : NaN; };
  const miniBlk    = grab(/\n\.mini-btn\{([\s\S]*?)\}/);
  const baseBlk    = grab(/\n\.btn-base\{([\s\S]*?)\}/);
  const helpBlk    = grab(/\n\.help-btn\{([\s\S]*?)\}/);
  const srcBlk     = grab(/\n\.src-tip\{([\s\S]*?)\}/);
  const bottomBlk  = grab(/\n\.bottom-buttons\{([\s\S]*?)\}/);

  ck('★ 主操作按钮高度 ≤ 30px（26）', numOf(baseBlk, /height:([\d.]+)px/) <= 30, 'base=' + baseBlk.match(/height:\d+px/));
  ck('★ 底部 mini 按钮高度 ≤ 22px（20）', numOf(miniBlk, /height:([\d.]+)px/) <= 22);
  ck('★ 底部 mini 按钮字号 ≤ 11px（10）', numOf(miniBlk, /font-size:([\d.]+)px/) <= 11);
  ck('★ 底部 mini 按钮默认降权 opacity < .5', numOf(miniBlk, /opacity:([\d.]+)/) < .5);
  ck('★ 底部 mini 按钮无边框无背景', /background:none/.test(miniBlk) && /border:none/.test(miniBlk));
  ck('★ 主按钮不再是渐变玻璃大块', !/linear-gradient/.test(baseBlk) && !/backdrop-filter/.test(baseBlk));
  ck('★ 主操作栏整组也降权 opacity < 1', numOf(grab(/\n\.action-bar\{([\s\S]*?)\}/), /opacity:([\d.]+)/) < 1);
  ck('★ 底部按钮间距 ≥ 10px（更稀疏）', numOf(grab(/\n\.left-buttons,\.right-buttons\{([\s\S]*?)\}/), /gap:(\d+)px/) >= 10);
  ck('★ 图片源默认完全隐藏（opacity 0）', numOf(srcBlk, /opacity:([\d.]+)/) === 0);
  ck('★ 底栏左右稀疏分布 + 右侧给 ? 留位',
     /justify-content:space-between/.test(bottomBlk) && /margin-right:35px/.test(html));
  ck('★ 图片源是悬浮气泡（非输入框、非常驻）',
     /visibility:hidden/.test(srcBlk) && /position:absolute/.test(srcBlk) && !/footer\{/.test(html));
  ck('★ 原图按钮并入 mini（不再是独立色块）', /class="mini-btn" id="wp-orig"/.test(html));
  ck('★ 帮助按钮缩小到 ≤ 24px（22）', numOf(helpBlk, /width:([\d.]+)px;height:[\d.]+px/) <= 24);
  ck('★ 移动端按钮不再 flex:1 撑满整行', !/\.btn\{flex:1 1 auto/.test(html));
  ck('★ 底部交互元素 ≤ 4 个（不密集）', (html.match(/class="mini-btn"/g) || []).length <= 4);

  // 内联脚本语法检查（编译但不执行）
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  ck('存在内联脚本', !!m);
  try { new vm.Script(m[1]); ck('★ 内联 JS 语法正确', true); }
  catch (e) { ck('★ 内联 JS 语法正确', false, e.message); }
}

/* ============================================================
   四、404 页面：真实运行交互
   ============================================================ */
console.log('\n【4】404 页面真实交互');
{
  const html = read('404.html');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', url: 'http://localhost:8000/404.html',
    pretendToBeVisual: true, resources: undefined
  });
  const w = dom.window, d = w.document;
  // jsdom 无 fetch → 走 img 直连降级路径
  ck('无 fetch 时降级为 img 直连', !w.fetch || typeof w.fetch === 'undefined');
  ck('★ 图片源文本已就绪（但默认隐藏）', /loliapi\.com\/acg/.test(d.getElementById('wp-src').textContent) &&
     /visibility:hidden/.test(html));
  const q1 = d.getElementById('qtext').textContent;
  ck('★ 短句已渲染（非空、非占位）', !!q1 && q1 !== '正在取一句短句…', 'q=' + q1);
  ck('★ 出处已渲染', /^—— /.test(d.getElementById('qfrom').textContent), 'from=' + d.getElementById('qfrom').textContent);
  ck('★ 页面上没有倒计时/进度条元素', !d.getElementById('qcount') && !d.getElementById('qbar') && !d.querySelector('.qfoot'));
  d.getElementById('quote').click();
  const q2 = d.getElementById('qtext').textContent;
  ck('★ 点击一言卡片立即换一句', q2 !== q1, q1 + ' -> ' + q2);

  const btn = d.getElementById('help-btn'), pop = d.getElementById('help-pop');
  btn.click();
  ck('★ 点击 ? 展开帮助', pop.classList.contains('on') && btn.getAttribute('aria-expanded') === 'true');
  d.body.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  ck('★ 点击外部关闭帮助', !pop.classList.contains('on'));
  d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'h', bubbles: true }));
  ck('★ H 键展开帮助', pop.classList.contains('on'));
  d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  ck('★ Esc 关闭帮助', !pop.classList.contains('on'));

  const before = d.getElementById('wp-src').textContent;
  d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'r', bubbles: true }));
  ck('★ R 键换壁纸（URL 带时间戳变化）', d.getElementById('wp-src').textContent !== before);
  ck('★ 原图按钮指向壁纸源', /loliapi\.com/.test(d.getElementById('wp-orig').href));
  ck('三个操作按钮齐全', ['btn-refresh', 'btn-wallpaper', 'btn-back'].every(id => !!d.getElementById(id)));
  dom.window.close();
}

setTimeout(() => {
  console.log('\n===== 结果: ' + pass + ' 通过 / ' + fail + ' 失败 =====');
  process.exit(fail ? 1 : 0);
}, 300);
