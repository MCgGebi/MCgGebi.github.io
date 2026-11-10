/**
 * 本轮新增功能验证
 * 【1】彩蛋「千万别点」：菜单入口 / 懒加载 / JSON 注册表 / 事件字段完整
 * 【2】主题：默认跟随系统 + 顶栏菜单与设置页共享状态（双向同步）
 * 【3】编辑器拖拽：三区定位(above/inside/below) + 同级排序 + 拖出文件夹
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const fetched = [];
const opened = [];
const dom = new JSDOM(html, {
  runScripts: 'outside-only', url: 'http://localhost:8000/', pretendToBeVisual: true,
  beforeParse(window) {
    const logs = [];
    window.console = { log: m => logs.push(String(m)), error() {}, warn() {}, info() {} };
    const store = {};
    window.localStorage = {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; },
      get length() { return Object.keys(store).length; },
      key: i => Object.keys(store)[i],
    };
    window.fetch = function (url) {
      fetched.push(String(url));
      let p = String(url).replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '').split('?')[0];
      const file = path.join(ROOT, decodeURIComponent(p));
      return new Promise(res => {
        fs.readFile(file, 'utf8', (err, t) => {
          if (err) return res({ ok: false, status: 404, text: () => Promise.resolve(''), json: () => Promise.reject(err) });
          res({ ok: true, status: 200, text: () => Promise.resolve(t), json: () => Promise.resolve(JSON.parse(t)) });
        });
      });
    };
    window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    window.scrollTo = () => {};
    window.requestAnimationFrame = fn => setTimeout(fn, 0);
    window.open = (u) => { opened.push(String(u)); return {}; };
    // 记录 toast
    window.__toasts = [];
  },
});
const w = dom.window;
const load = f => { try { w.eval(fs.readFileSync(path.join(ROOT, f), 'utf8')); } catch (e) { console.log('[EVAL FAIL]', f, e.message); } };

let pass = 0, fail = 0;
const check = (n, c, extra) => { if (c) pass++; else { fail++; console.log('  ✗ ' + n + (extra ? '  → ' + extra : '')); } };

(async function () {
  await new Promise(r => w.addEventListener('load', r));
  ['vendor/vue.global.prod.js', 'vendor/vue-router.global.prod.js', 'js/utils.js',
   'js/plugin-loader.js', 'js/router.js', 'js/app.js', 'js/settings.js', 'js/init.js'].forEach(load);
  await new Promise(r => setTimeout(r, 2200));
  const doc = w.document;

  // ============================================
  console.log('【1】彩蛋：注册表与懒加载');
  // ============================================
  const eggJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'js/easter-eggs.json'), 'utf8'));
  const events = eggJson.events || [];
  check('★ 注册表存在且非空', events.length > 0, 'count=' + events.length);
  check('★ 每个事件都有数字 id', events.every(e => typeof e.id === 'number'), events.map(e => e.id).join(','));
  check('★ 每个事件都有 name', events.every(e => !!e.name));
  check('★ id 不重复', new Set(events.map(e => e.id)).size === events.length);
  check('每个事件都有 type', events.every(e => !!e.type));
  check('包含跳转 B站「中国人会飞」', events.some(e => /BV1QCgK6YEuM/.test(JSON.stringify(e.params || {}))));
  check('包含跳转 Rickroll「Never Gonna Give You Up」', events.some(e => /BV1GJ411x7h7/.test(JSON.stringify(e.params || {}))));
  const typeSet = new Set(events.map(e => e.type));
  check('包含播放音效 sound', typeSet.has('sound'));
  check('包含文字乱码 scramble', typeSet.has('scramble'));
  check('包含二进制代码雨 matrix', typeSet.has('matrix'));
  check('包含颜色反转 invert', typeSet.has('invert'));
  check('包含炫彩主题 rainbow', typeSet.has('rainbow'));
  check('包含你屏幕有根毛 hair', typeSet.has('hair'));

  // ★ 本轮需求：每个事件「单独」设置持续时间 —— -1 永久 / 0 禁用 / >0 自动恢复
  check('★ 每个事件都有 duration 字段', events.every(e => typeof e.duration === 'number'),
    events.filter(e => typeof e.duration !== 'number').map(e => e.id).join(','));
  check('★ duration 只能是 -1 或 0 或正数', events.every(e => e.duration === -1 || e.duration >= 0),
    events.filter(e => !(e.duration === -1 || e.duration >= 0)).map(e => e.id + ':' + e.duration).join(','));
  check('★ 存在 -1（永久持续）事件', events.some(e => e.duration === -1),
    events.filter(e => e.duration === -1).map(e => e.id).join(','));
  check('★ 存在 >0（自动恢复）事件', events.some(e => e.duration > 0),
    events.filter(e => e.duration > 0).map(e => e.id + ':' + e.duration).join(','));
  check('★ 默认全部启用（无 0）', events.every(e => e.duration !== 0),
    events.filter(e => e.duration === 0).map(e => e.id).join(','));

  const eggSrc = fs.readFileSync(path.join(ROOT, 'js/easter-egg.js'), 'utf8');
  check('★ 引擎文件存在', !!eggSrc);
  check('★ 引擎按 duration 单独调度（isPermanent + sc.later）',
    /function isPermanent/.test(eggSrc) && /!isPermanent\(ev\)/.test(eggSrc) && /sc\.later\(function \(\) \{ destroyScope\(key\)/.test(eggSrc));
  check('★ 禁用事件不会被抽到（isEnabled 过滤）', /function isEnabled/.test(eggSrc) && /list\.filter\(isEnabled\)/.test(eggSrc));
  check('★ 每个彩蛋独立作用域 createScope', /function createScope/.test(eggSrc) && /scopes\[key\] = sc/.test(eggSrc));
  check('★ -1 不注册清理定时器', /if \(!isPermanent\(ev\)\)/.test(eggSrc));
  check('★ 提示不含恢复信息（无 N 秒后恢复 / 无刷新恢复）',
    !/秒后自动恢复/.test(eggSrc) && !/刷新才恢复/.test(eggSrc) && !/刷新恢复/.test(eggSrc));
  check('★ toast 只提示事件名与描述', /toast\('🎲 彩蛋 #' \+ ev\.id \+ '：' \+ ev\.name/.test(eggSrc));
  check('★ 假蓝屏不含「假的」提示', !/这是假的/.test(eggSrc) && !/刷新页面可立即恢复/.test(eggSrc));
  const eggRegistry = JSON.parse(fs.readFileSync(path.join(ROOT, 'js/easter-eggs.json'), 'utf8'));
  check('★ 事件表无非假/刷新文案',
    !eggRegistry.events.some(function (e) { return /假的|刷新|恢复/.test((e.name || '') + (e.desc || '')); }));
  check('★ 弹幕文案不含刷新提示',
    !eggRegistry.events.some(function (e) { return (e.params && e.params.texts || []).some(function (t) { return /刷新|恢复/.test(t); }); }));
  check('★ 保留手动 stop()（不自动调用）', /stop: resetAllEffects/.test(eggSrc));
  check('★ 蓝屏锁定交互（pointer-events:auto 吃掉点击）', /pointer-events:auto;cursor:none/.test(eggSrc));
  check('★ 蓝屏逐块铺满（COLS/ROWS/STEP 网格）',
    /var COLS = p\.cols/.test(eggSrc) && /var ROWS = p\.rows/.test(eggSrc) && /var STEP = p\.step/.test(eggSrc));
  check('★ 块顺序为「行外列内」= 从上到下、每行从左到右',
    /for \(var r = 0; r < ROWS; r\+\+\)[\s\S]{0,300}?for \(var c = 0; c < COLS; c\+\+\)/.test(eggSrc));
  check('★ 逐块点亮用定时器推进', /tiles\[i\]\.style\.opacity = '1'/.test(eggSrc));
  check('★ 铺满后才浮现文案', /info\.style\.opacity = '1'/.test(eggSrc));
  check('★ 锁定输入事件（鼠标/触摸/键盘）', /LOCK_EVENTS/.test(eggSrc) && /contextmenu/.test(eggSrc) && /keydown/.test(eggSrc));
  check('★ 锁定用捕获阶段且可清理', /addEventListener\(t, lock, true\)/.test(eggSrc) && /removeEventListener\(t, lock, true\)/.test(eggSrc));
  check('★ 放行刷新键（F5 / Ctrl+R）避免彻底卡死', /k === 'F5'/.test(eggSrc) && /k === 'r'/.test(eggSrc));
  check('★ 蓝屏锁定时禁止页面滚动', /body \{ overflow: hidden/.test(eggSrc));
  const fcEv = eggRegistry.events.find(function (e) { return e.type === 'fakeCrash'; });
  check('★ 蓝屏 duration = -1（不自动消失）', fcEv && fcEv.duration === -1, 'duration=' + (fcEv && fcEv.duration));
  check('★ 蓝屏文案不含「假的」字样', !/假的/.test(eggSrc));
  check('★ index.html 不引用引擎（不主动加载）', !/easter-egg\.js/.test(html));
  check('★ index.html 不引用事件表 JSON（不主动加载）', !/easter-eggs\.json/.test(html));
  check('引擎 fetch 事件表 JSON', /easter-eggs\.json/.test(eggSrc));
  check('★ 每个事件的 type 都有对应 handler', events.every(e => new RegExp('\\b' + e.type + ':\\s*function').test(eggSrc)),
    events.filter(e => !new RegExp('\\b' + e.type + ':\\s*function').test(eggSrc)).map(e => e.type).join(','));

  // ============================================
  console.log('【2】彩蛋：菜单入口与触发');
  // ============================================
  const items = Array.from(doc.querySelectorAll('.dropdown-item'));
  const eggItem = items.find(a => /千万别点/.test(a.textContent || ''));
  check('★ 顶栏菜单含「千万别点」入口', !!eggItem, 'items=' + items.length);
  check('彩蛋入口含骰子图标', !!eggItem && !!eggItem.querySelector('.fa-dice'));
  check('★ 未点击前引擎未加载（无 DBP_EASTER_EGG）', !w.DBP_EASTER_EGG);
  check('★ 未点击前未 fetch 事件表', !fetched.some(u => /easter-eggs\.json/.test(u)));

  // 模拟点击 → 应尝试注入引擎脚本
  if (eggItem) eggItem.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 300));
  const injected = Array.from(doc.querySelectorAll('script')).some(s => /easter-egg\.js/.test(s.src || ''));
  check('★ 点击后才动态注入引擎脚本', injected);

  // 直接加载引擎并触发（jsdom 不会真正拉外部 script）
  load('js/easter-egg.js');
  check('★ 引擎加载后暴露 DBP_EASTER_EGG', !!w.DBP_EASTER_EGG);

  // 强制随机 → 第 1 个事件（openUrl 中国人会飞），避免 canvas 依赖
  const realRandom = w.Math.random;
  w.Math.random = () => 0;
  const ev1 = await w.DBP_EASTER_EGG.trigger();
  w.Math.random = realRandom;
  check('★ 触发返回一个事件对象', !!ev1, JSON.stringify(ev1 && ev1.id));
  check('★ 事件带 id 与 name', !!ev1 && typeof ev1.id === 'number' && !!ev1.name, ev1 ? ev1.name : '');
  check('★ 触发时 fetch 了事件表', fetched.some(u => /easter-eggs\.json/.test(u)));
  check('★ 执行 openUrl 打开了 B站链接', opened.some(u => /bilibili\.com\/video\//.test(u)), opened.join(','));
  check('★ 一次性：已记录用过', (w.DBP_EASTER_EGG.list() || []).length === events.length);

  // ★ 运行期验证三种 duration 语义：-1 永久 / 0 禁用 / >0 到期自动清
  const hairEv = events.find(e => e.type === 'hair');
  const scrambleEv = events.find(e => e.type === 'scramble');
  check('★ 存在 hair 事件（-1 永久）', !!hairEv && hairEv.duration === -1, hairEv ? String(hairEv.duration) : '');
  check('★ 存在 scramble 事件（>0 自动恢复）', !!scrambleEv && scrambleEv.duration > 0, scrambleEv ? String(scrambleEv.duration) : '');

  const EE = w.DBP_EASTER_EGG;
  const scopeCount = () => doc.querySelectorAll('[data-egg-scope]').length;

  // ---------- -1：永久持续 ----------
  if (hairEv) {
    EE.reset();
    const idx = events.indexOf(hairEv);
    const r2 = w.Math.random;
    w.Math.random = () => (idx + 0.5) / events.length;
    const got = await EE.trigger();
    w.Math.random = r2;
    check('★ 随机锁定命中 hair', got && got.type === 'hair', got ? got.type : '(null)');
    check('★ 触发后生成了独立作用域', EE.activeScopes().length === 1, 'scopes=' + EE.activeScopes().length);
    const hairs = doc.querySelectorAll('[data-egg-scope] div').length;
    check('★ 「屏幕毛」已插入 DOM', hairs > 0, 'count=' + hairs);
    await new Promise(r => setTimeout(r, 1500)); // 远超一般 duration
    check('★ -1：等待后仍在（不会自动消失）', EE.activeScopes().length === 1 && doc.querySelectorAll('[data-egg-scope] div').length > 0);
  }

  // ---------- >0：到期只清自己 ----------
  if (scrambleEv) {
    EE.reset(); // 清掉 hair（-1 的也被 stop 清掉，符合 "手动 stop" 语义）
    check('reset 后作用域清空', EE.activeScopes().length === 0, 'scopes=' + EE.activeScopes().length);
    const list = await EE.load();
    const sc = list.find(e => e.type === 'scramble');
    sc.duration = 400; // 临时改成 400ms 便于测试
    const idx = list.indexOf(sc);
    const r3 = w.Math.random;
    w.Math.random = () => (idx + 0.5) / list.length;
    const got = await EE.trigger();
    w.Math.random = r3;
    check('★ 随机锁定命中 scramble', got && got.type === 'scramble', got ? got.type : '(null)');
    check('★ 触发后作用域 +1', EE.activeScopes().length === 1, 'scopes=' + EE.activeScopes().length);
    await new Promise(r => setTimeout(r, 900)); // > 400ms
    check('★ >0：到期后该彩蛋被自动清除', EE.activeScopes().length === 0, 'scopes=' + EE.activeScopes().length);
    sc.duration = 8000; // 还原
  }

  // ---------- 独立性：一个到期不影响另一个 ----------
  if (hairEv && scrambleEv) {
    EE.reset();
    const list = await EE.load();
    const hair = list.find(e => e.type === 'hair');
    const scr = list.find(e => e.type === 'scramble');
    scr.duration = 400;
    const lock = (target) => { const i = list.indexOf(target); return () => (i + 0.5) / list.length; };
    let r = w.Math.random; w.Math.random = lock(hair); await EE.trigger(); w.Math.random = r;
    r = w.Math.random; w.Math.random = lock(scr); await EE.trigger(); w.Math.random = r;
    check('★ 两个彩蛋同时生效', EE.activeScopes().length === 2, 'scopes=' + EE.activeScopes().length);
    await new Promise(r => setTimeout(r, 900));
    check('★ 到期的那个消失，永久的那个还在', EE.activeScopes().length === 1, 'scopes=' + EE.activeScopes().length);
    scr.duration = 8000;
    EE.reset();
  }

  // ---------- 0：禁用，不会被抽到 ----------
  {
    EE.reset();
    const list = await EE.load();
    const orig = list.map(e => e.duration);
    list.forEach(e => { e.duration = 0; });               // 全部禁用
    const none = await EE.trigger();
    check('★ duration=0 时不会被抽到（返回 null）', none === null, JSON.stringify(none));
    check('★ 全禁用时不产生任何效果', EE.activeScopes().length === 0, 'scopes=' + EE.activeScopes().length);
    // 只启用 hair，其余禁用 → 应只可能抽到 hair
    const hair = list.find(e => e.type === 'hair');
    hair.duration = -1;
    const only = await EE.trigger();
    check('★ 仅启用一个时必定抽到它', only && only.type === 'hair', only ? only.type : '(null)');
    list.forEach((e, i) => { e.duration = orig[i]; });    // 还原
    EE.reset();
  }

  // ============================================
  console.log('【3】主题：默认跟随系统');
  // ============================================
  check('★ 默认主题为 system（localStorage）', w.localStorage.getItem('dbp-theme') === 'system',
    'stored=' + w.localStorage.getItem('dbp-theme'));
  check('★ index.html 早期脚本默认 system', /stored \|\| 'system'/.test(html));
  check('app.js DEFAULT_THEME = system', /DEFAULT_THEME = 'system'/.test(fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8')));

  // ============================================
  console.log('【4】主题：菜单与设置页双向同步');
  // ============================================
  check('★ 共享响应式状态存在 DBP_themeState', !!w.DBP_themeState);
  check('共享状态初始 mode=system', w.DBP_themeState && w.DBP_themeState.mode === 'system', w.DBP_themeState && w.DBP_themeState.mode);

  // 4-1 菜单切亮色 → data-theme 变化 + 共享状态更新
  const lightItem = Array.from(doc.querySelectorAll('.dropdown-item')).find(a => /亮色模式/.test(a.textContent || ''));
  check('找到菜单「亮色模式」', !!lightItem);
  if (lightItem) lightItem.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 300));
  check('★ 菜单切亮色 → data-theme=light', doc.documentElement.getAttribute('data-theme') === 'light');
  check('★ 共享状态同步为 light', w.DBP_themeState && w.DBP_themeState.mode === 'light');

  // 4-2 进入设置页 → 应显示当前为亮色（选中态跟随菜单）
  if (w.appRouter) { w.appRouter.push('/settings'); await new Promise(r => setTimeout(r, 1500)); }
  check('★ 已进入设置页', w.appRouter.currentRoute.value.path === '/settings');
  const activeOpt = doc.querySelector('.theme-opt.active');
  check('★ 设置页选中态 = 亮色（与菜单一致）', !!activeOpt && /亮色/.test(activeOpt.textContent || ''),
    activeOpt ? activeOpt.textContent.trim() : '(无选中)');
  const mainTxt = (doc.querySelector('.main-content') || {}).textContent || '';
  check('设置页显示当前生效为亮色', /当前生效：\s*亮色/.test(mainTxt.replace(/\s+/g, ' ')) || /亮色/.test(mainTxt));

  // 4-3 设置页切暗色 → 菜单下拉应立刻反映（反向同步）
  const darkOpts = Array.from(doc.querySelectorAll('.theme-opt')).find(o => /暗色/.test(o.textContent || ''));
  if (darkOpts) darkOpts.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 400));
  check('★ 设置页切暗色 → data-theme=dark', doc.documentElement.getAttribute('data-theme') === 'dark');
  check('★ 共享状态同步为 dark', w.DBP_themeState && w.DBP_themeState.mode === 'dark');

  // 重新打开菜单，检查「暗色模式」项出现勾选
  const menuBtn = doc.querySelector('.topbar-menu-btn') || doc.querySelector('[class*="menu-btn"]');
  if (menuBtn) menuBtn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 400));
  const darkItem = Array.from(doc.querySelectorAll('.dropdown-item')).find(a => /暗色模式/.test(a.textContent || ''));
  check('★ 菜单「暗色模式」出现勾选（反向同步生效）', !!darkItem && !!darkItem.querySelector('.fa-check'),
    darkItem ? (darkItem.querySelector('.fa-check') ? 'has check' : 'no check') : 'not found');

  // ============================================
  console.log('【5】编辑器拖拽（静态断言）');
  // ============================================
  const ed = fs.readFileSync(path.join(ROOT, 'plugin-editor.html'), 'utf8');
  check('★ handleDrop 接收位置参数 pos', /function handleDrop\(target, pos\)/.test(ed));
  check('★ 支持 inside/above/below 三区', /pos === 'inside'/.test(ed) && /pos === 'below'/.test(ed) && /'above'/.test(ed));
  check('★ dragover 按 Y 比例三区判定', /ratio < 0\.28/.test(ed) && /ratio > 0\.72/.test(ed));
  check('★ 同级排序：above 插到目标前', /arr\.splice\(pos === 'below' \? ti \+ 1 : ti, 0, dragNode\)/.test(ed));
  check('★ below 插到目标后', /ti \+ 1/.test(ed));
  check('★ 拖出文件夹：根级放置区 handleRootDrop', /function handleRootDrop/.test(ed));
  check('★ 根级放置：append 到 state.categories', /state\.categories\.push\(dragNode\)/.test(ed));
  check('★ 防止把父级拖进自己的子级', /无法移动到自己的子级/.test(ed));
  check('★ 移除后重新定位目标索引（同数组移动）', /removeNode\(dragId\)[\s\S]{0,300}?arr\.indexOf\(target\)/.test(ed));
  check('★ 拖放指示样式 above/below/inside 齐全', /drop-above/.test(ed) && /drop-below/.test(ed) && /drop-inside/.test(ed));
  check('★ 根级放置高亮样式', /pe-tree-root-drop/.test(ed));
  check('★ dragleave 清理指示', /ondragleave/.test(ed));

  console.log('\n===== 结果: ' + pass + ' 通过 / ' + fail + ' 失败 =====');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
