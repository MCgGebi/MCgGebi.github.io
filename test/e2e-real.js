const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

// 模拟浏览器环境（最小化但足以让 plugin-loader 完成初始化）
const listeners = {};
const noop = () => {};
const mkEl = () => ({
  setAttribute: noop, getAttribute: () => null, textContent: '', innerHTML: '',
  addEventListener: noop, removeEventListener: noop, appendChild: noop, removeChild: noop,
  querySelector: () => null, querySelectorAll: () => [], style: {}, classList: { add: noop, remove: noop, contains: () => false },
  attributes: [],
});
const documentMock = {
  readyState: 'complete',
  querySelector: () => null,
  addEventListener: (e, fn) => { listeners[e] = fn; },
  documentElement: { setAttribute: noop },
  createElement: () => mkEl(),
};
const windowMock = {
  window: null,
  addEventListener: (e, fn) => { listeners[e] = fn; },
  removeEventListener: noop,
  Vue: { ref: (v) => ({ value: v }), nextTick: (fn) => fn(), config: {} },
  localStorage: { getItem: () => null, setItem: () => {} },
  matchMedia: () => ({ matches: false, addEventListener: noop }),
  fetch: () => Promise.reject(new Error('not used')),
  copyText: () => {},
  setTimeout, console,
  document: documentMock,
};
windowMock.window = windowMock;
global.window = windowMock;
global.document = documentMock;
global.Vue = windowMock.Vue;
global.localStorage = windowMock.localStorage;
global.matchMedia = windowMock.matchMedia;
global.fetch = windowMock.fetch;
global.copyText = windowMock.copyText;

// 加载真实 plugin-loader.js —— IIFE 会把 createHtmlPluginComponent 挂到 global（window）上
const code = read('js/plugin-loader.js');
const fn = new Function('window', 'Vue', 'document', 'console', 'setTimeout', code);
fn(windowMock, windowMock.Vue, documentMock, console, setTimeout);
const createHtmlPluginComponent = windowMock.createHtmlPluginComponent;

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; } else { fail++; console.log('  ✗ ' + n); } };

// ---- 用真实的 demo-inline.html 内容构建 DOM 并模拟 stripDuplicateHead ----
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const htmlFile = read('plugins/html/demo-inline.html');

console.log('\n===== 真实 DOM 测试：inline 模式标题/导航去重 =====');

// 模拟 setup()：取 htmlContent 的前半段（含 header + nav）注入 DOM
const dom = new JSDOM(`<div class="html-plugin-inline-mode"><div class="html-plugin-content">${htmlFile}</div></div>`, { runScripts: 'outside-only' });
const content = dom.window.document.querySelector('.html-plugin-content');

// 复刻真实的 isDuplicateTitle / stripDuplicateHead（逻辑来自 plugin-loader.js）
const pluginTitle = 'HTML · inline（去重标题）';
function isDuplicateTitle(el) {
  if (!el) return false;
  const text = (el.textContent || '').trim();
  if (!text) return false;
  if (text === pluginTitle) return true;
  if (text.replace(/\s+/g, '') === pluginTitle.replace(/\s+/g, '')) return true;
  if (el.tagName === 'H1' && /DBP-HUB|插件|工具/.test(text) && text.length < 30) return true;
  return false;
}
function stripDuplicateHead() {
  const c = content;
  const h = c.querySelector(':scope > h1, :scope > h2');
  if (h && isDuplicateTitle(h)) h.parentNode.removeChild(h);
  const header = c.querySelector(':scope > header, .page-header, .plugin-header');
  if (header) {
    const titleEl = header.querySelector('h1, h2, .title, [class*="title"]');
    if (isDuplicateTitle(header) || (titleEl && isDuplicateTitle(titleEl))) {
      header.parentNode.removeChild(header);
    }
  }
  const nav = c.querySelector(':scope > nav, .plugin-nav, .page-nav, [role="navigation"]');
  if (nav) {
    const navText = (nav.textContent || '').trim();
    if (/首页|返回|主页|菜单|Home|Menu/.test(navText) && navText.length < 40) {
      nav.parentNode.removeChild(nav);
    }
  }
}
stripDuplicateHead();

check('剥离前：存在 <header class="plugin-header">', htmlFile.includes('plugin-header'));
check('剥离后：<header> 已移除', !content.querySelector('header'));
check('剥离后：重复 <h1> 已移除', !content.querySelector('h1'));
check('剥离后：<nav class="plugin-nav"> 已移除', !content.querySelector('nav'));
check('剥离后：正文内容保留（.grid 仍在）', !!content.querySelector('.grid'));
check('剥离后：CSS <style> 保留', !!content.querySelector('style'));

console.log('\n===== 组件生成测试 =====');
const meta = { id: 'html-demo-inline', title: 'HTML 演示(inline)', src: './plugins/html/demo-inline.html', renderMode: 'inline' };
const comp = createHtmlPluginComponent(meta);
check('inline 模式返回组件对象', !!comp && !!comp.template);
check('模板含 .html-plugin-inline-mode', comp.template.includes('html-plugin-inline-mode'));
check('模板无卡片包裹（无 .card / .panel 外层）', !comp.template.includes('html-plugin-card'));

const iframeMeta = { id: 'html-demo-iframe', title: 'HTML 演示(iframe)', src: './plugins/html/demo-iframe.html', renderMode: 'iframe' };
const iframeComp = createHtmlPluginComponent(iframeMeta);
check('iframe 模式返回组件对象', !!iframeComp && !!iframeComp.template);
check('iframe 模板含裸 <iframe>（无框）', /<iframe/.test(iframeComp.template));
check('iframe 含 html-plugin-iframe-naked 类', iframeComp.template.includes('html-plugin-iframe-naked'));
check('iframe 无 border / 无标题栏包裹', !/html-plugin-frame-box/.test(iframeComp.template));

console.log('\n===== 结果: ' + pass + ' 通过 / ' + fail + ' 失败 =====');
process.exit(fail ? 1 : 0);
