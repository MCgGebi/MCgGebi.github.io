/**
 * 蓝屏彩蛋（fakeCrash）行为验证
 * - 从左往右、从上到下逐块铺满
 * - 铺满期间与之后锁定输入（防误触），但放行刷新键
 * - duration = -1，不自动消失
 */
const fs = require('fs');
const path = require('path');
let JSDOM;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { console.log('请先安装 jsdom: npm install jsdom'); process.exit(0); }

const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const errors = [];
function check(name, cond, extra) {
  if (cond) { pass++; } else { fail++; errors.push('✗ ' + name + (extra ? ' → ' + extra : '')); }
}

const dom = new JSDOM('<!DOCTYPE html><html><body><button id="btn">按钮</button></body></html>', {
  url: 'http://localhost:8000/', pretendToBeVisual: true,
  runScripts: 'outside-only',
});
const w = dom.window;
const doc = w.document;

// 打桩：toast + fetch（注册表）
w.showToast = function () {};
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'js/easter-eggs.json'), 'utf8'));
w.fetch = function () {
  return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(registry); } });
};

w.eval(fs.readFileSync(path.join(ROOT, 'js/easter-egg.js'), 'utf8'));

(async function () {
  console.log('【1】注册表与 duration');
  const fc = registry.events.find(function (e) { return e.type === 'fakeCrash'; });
  check('存在 fakeCrash 事件', !!fc);
  check('★ 蓝屏 duration = -1（不自动消失）', fc && fc.duration === -1, 'duration=' + (fc && fc.duration));
  check('★ 网格参数齐全', fc && fc.params && fc.params.cols && fc.params.rows && fc.params.step,
    JSON.stringify(fc && fc.params));

  console.log('【2】触发蓝屏');
  // 直接调用 handler 不准确，这里走完整 trigger 流程但强制命中 fakeCrash
  const ev = await w.DBP_EASTER_EGG.trigger.call(null);
  // trigger 是随机抽取，未必命中 12；改用内部方式：连续触发直到命中或直接用 list + 直接执行
  // 为保证确定性，这里重新加载一个只含 fakeCrash 的注册表再触发
  const only = { events: [Object.assign({}, fc)] };
  w.fetch = function () { return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(only); } }); };

  // 重置引擎（清掉刚才可能触发的其它事件）
  if (w.DBP_EASTER_EGG.stop) w.DBP_EASTER_EGG.stop();

  // 重新执行引擎脚本（获得干净的 registry 缓存），再触发
  delete w.DBP_EASTER_EGG;
  w.eval(fs.readFileSync(path.join(ROOT, 'js/easter-egg.js'), 'utf8'));
  const ev2 = await w.DBP_EASTER_EGG.trigger();
  check('★ 触发命中 fakeCrash', ev2 && ev2.type === 'fakeCrash', ev2 && ev2.type);

  console.log('【3】逐块铺满');
  const layer = doc.querySelector('div[data-egg-scope]');
  check('创建了彩蛋图层', !!layer);
  const box = layer ? layer.firstElementChild : null;
  const boxKids = box ? Array.prototype.slice.call(box.children) : [];
  // 最后一个子元素是崩溃文案层，其余全是网格块
  const tiles = boxKids.slice(0, boxKids.length - 1);
  const infoEl = boxKids[boxKids.length - 1];
  const expect = fc.params.cols * fc.params.rows;
  check('★ 生成网格块 ' + expect + ' 个', tiles.length === expect, '实际=' + tiles.length);

  if (tiles.length) {
    const first = tiles[0], second = tiles[1];
    const rowLast = tiles[fc.params.cols - 1];      // 第一行最后一列
    const nextRowFirst = tiles[fc.params.cols];     // 第二行第一列
    const last = tiles[tiles.length - 1];           // 最后一块（右下角）

    check('★ 初始全部隐藏（opacity=0）', Array.prototype.every.call(tiles, function (t) { return t.style.opacity === '0'; }));

    // 第一块位置：左上角
    check('★ 首块位于左上角', /left:\s*0%/.test(first.getAttribute('style')) && /top:\s*0%/.test(first.getAttribute('style')),
      first.getAttribute('style'));
    // 第二块：同一行右移
    const firstLeft = parseFloat(/left:\s*([\d.]+)%/.exec(first.getAttribute('style'))[1]);
    const secondLeft = parseFloat(/left:\s*([\d.]+)%/.exec(second.getAttribute('style'))[1]);
    check('★ 第二块在同一行右侧（左→右）', secondLeft > firstLeft && second.style.top === first.style.top,
      'left ' + firstLeft + '→' + secondLeft);
    // 行末 → 下一行行首：top 增大，left 回到 0
    const rowLastTop = parseFloat(/top:\s*([\d.]+)%/.exec(rowLast.getAttribute('style'))[1]);
    const nextRowTop = parseFloat(/top:\s*([\d.]+)%/.exec(nextRowFirst.getAttribute('style'))[1]);
    const nextRowLeft = parseFloat(/left:\s*([\d.]+)%/.exec(nextRowFirst.getAttribute('style'))[1]);
    check('★ 换行后回到行首且下移（上→下）', nextRowTop > rowLastTop && nextRowLeft === 0,
      'top ' + rowLastTop + '→' + nextRowTop + ', left=' + nextRowLeft);
    // 末块在右下角
    const lastLeft = parseFloat(/left:\s*([\d.]+)%/.exec(last.getAttribute('style'))[1]);
    const lastTop = parseFloat(/top:\s*([\d.]+)%/.exec(last.getAttribute('style'))[1]);
    check('★ 末块位于右下角', lastLeft > 0 && lastTop > 0 && lastLeft > firstLeft && lastTop > firstLeft,
      'left=' + lastLeft + ',top=' + lastTop);

    // 文案层：初始隐藏
    check('★ 崩溃文案初始隐藏', !!infoEl && infoEl.style.opacity === '0', infoEl && infoEl.style.opacity);
    check('★ 文案含 :( 表情', !!infoEl && /:\(/.test(infoEl.innerHTML));
    check('★ 文案不含「假的」字样', !!infoEl && !/假的/.test(infoEl.innerHTML));

    console.log('【4】推进计时 → 逐块点亮');
    // jsdom 不跑真实计时，这里手动推进：直接验证定时器存在且逻辑正确即可
    // 通过等待一小段时间让 setInterval 推进若干块
    await new Promise(function (r) { setTimeout(r, 260); });
    const lit = Array.prototype.filter.call(tiles, function (t) { return t.style.opacity === '1'; }).length;
    check('★ 定时器已开始逐块点亮', lit > 0, '已点亮=' + lit);
    const stillHidden = Array.prototype.filter.call(tiles, function (t) { return t.style.opacity === '0'; }).length;
    check('★ 尚未全部铺满（确实是一块一块来）', stillHidden > 0, '剩余=' + stillHidden);
    // 点亮的前 N 块必须是数组前 N 个（严格顺序）
    let ordered = true;
    for (let i = 0; i < tiles.length; i++) {
      if (tiles[i].style.opacity === '0') break;
    }
    for (let i = 0; i < tiles.length - 1; i++) {
      if (tiles[i].style.opacity === '0' && tiles[i + 1].style.opacity === '1') { ordered = false; break; }
    }
    check('★ 点亮顺序严格为数组顺序（无跳块）', ordered);
  }

  console.log('【5】输入锁定');
  // 键盘：普通键应被拦截
  const kd = new w.KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
  doc.dispatchEvent(kd);
  check('★ 普通按键被拦截（defaultPrevented）', kd.defaultPrevented);
  // F5 / Ctrl+R 放行
  const f5 = new w.KeyboardEvent('keydown', { key: 'F5', bubbles: true, cancelable: true });
  doc.dispatchEvent(f5);
  check('★ 放行 F5（留刷新活路）', !f5.defaultPrevented);
  const cr = new w.KeyboardEvent('keydown', { key: 'r', ctrlKey: true, bubbles: true, cancelable: true });
  doc.dispatchEvent(cr);
  check('★ 放行 Ctrl+R', !cr.defaultPrevented);
  // 鼠标
  const mc = new w.MouseEvent('click', { bubbles: true, cancelable: true });
  doc.dispatchEvent(mc);
  check('★ 点击被拦截', mc.defaultPrevented);
  const ctx = new w.MouseEvent('contextmenu', { bubbles: true, cancelable: true });
  doc.dispatchEvent(ctx);
  check('★ 右键菜单被拦截', ctx.defaultPrevented);

  console.log('【6】不自动消失');
  const scopes = w.DBP_EASTER_EGG.activeScopes();
  check('★ 蓝屏作用域仍存活（未被自动清理）', scopes.length > 0, 'scopes=' + scopes.length);
  await new Promise(function (r) { setTimeout(r, 400); });
  check('★ 等待后依然存活（duration=-1 不清理）', w.DBP_EASTER_EGG.activeScopes().length > 0);
  check('★ CSS 锁定页面滚动', /body \{ overflow: hidden/.test(doc.querySelector('style[data-egg-scope]').textContent));

  console.log('【7】清理（stop() 后解除锁定）');
  w.DBP_EASTER_EGG.stop();
  const kd2 = new w.KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
  doc.dispatchEvent(kd2);
  check('★ stop() 后按键不再被拦截', !kd2.defaultPrevented);
  check('★ stop() 后作用域清空', w.DBP_EASTER_EGG.activeScopes().length === 0);

  console.log('\n===== 结果: ' + pass + ' 通过 / ' + fail + ' 失败 =====');
  if (fail) errors.forEach(function (e) { console.log(e); });
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.error('CRASH:', e.message); console.error(e.stack && e.stack.slice(0, 500)); process.exit(2); });
