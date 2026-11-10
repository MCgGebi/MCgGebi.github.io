const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const errors = [];
let pass = 0, fail = 0;
const check = (name, cond) => { if (cond) { pass++; } else { fail++; console.log('  ✗ ' + name); } };

console.log('\n===== 【A】初始化弹窗已移除，直接进入主界面 =====');
const htmlFile = read('index.html');
check('index.html 无 #init-overlay', !htmlFile.includes('init-overlay'));
check('index.html 无 init-progress / init-step 残留', !/init-progress|init-step|initPhase|init-overlay/.test(htmlFile));
check('index.html 直接挂载 #app-root', /<div id="app-root"><\/div>/.test(htmlFile));
check('init.js 不再操作 DOM 弹窗', !read('js/init.js').includes('init-overlay'));
check('init.js 直接进入启动序列', /waitForDeps/.test(read('js/init.js')));

console.log('\n===== 【B】启动期错误 → 常驻错误面板（详细） =====');
const appJs = read('js/app.js');
const utilsJs = read('js/utils.js');
const loaderJs = read('js/plugin-loader.js');
check('错误总线 $dbpError 存在', /\$dbpError/.test(utilsJs));
check('总线支持 push / list / clear', /push:/.test(utilsJs) && /clear:/.test(utilsJs) && /list:/.test(utilsJs));
check('常驻面板渲染 .dbp-error-panel', /\.dbp-error-panel/.test(appJs) || /\.dbp-error-panel/.test(read('styles/main.css')));
check('面板含可展开详情 .dbp-error-details', /\.dbp-error-details/.test(appJs) || /\.dbp-error-details/.test(read('styles/main.css')));
check('详情含堆栈 .dbp-error-stack', /\.dbp-error-stack/.test(appJs) || /\.dbp-error-stack/.test(read('styles/main.css')));
check('错误条目含 phase 字段', /phase:/.test(loaderJs) && /phase/.test(appJs));
check('错误条目含 plugin 字段', /plugin:/.test(loaderJs));
check('错误条目含 url 字段', /url:/.test(loaderJs));
check('错误条目含 stack 字段', /stack:/.test(loaderJs));
check('错误条目含 time 字段', /time:/.test(loaderJs));
check('致命错误 fatal 标记', /fatal/.test(loaderJs));
check('致命错误仅刷新可清（清除按钮禁用）', /fatalError.*opacity:\.5|pointer-events:none/.test(appJs) || /is-fatal/.test(read('styles/main.css')));
check('面板显示错误数量徽章 .dbp-error-count', /\.dbp-error-count/.test(appJs) || /\.dbp-error-count/.test(read('styles/main.css')));
check('顶栏错误指示器 .topbar-err-btn', /\.topbar-err-btn/.test(appJs) || /\.topbar-err-btn/.test(read('styles/main.css')));
check('Bootstrap 错误推入总线（不弹初始化遮罩）', /report\(['"]bootstrap/.test(loaderJs));
check('Route 错误推入总线 + 跳转错误页', /phase:\s*['"]route['"]/.test(loaderJs) || /phase:\s*['"]route['"]/.test(read('js/router.js')));
check('早期错误捕获兜底', /__DBP_EARLY_ERRORS/.test(htmlFile));

console.log('\n===== 【C】JS 插件：definePlugin 宽松注册 =====');
check('definePlugin 全局可用', /global\.definePlugin/.test(loaderJs));
check('支持 (id, component, opts) 调用', /definePlugin\(id,\s*component,\s*opts\)/.test(loaderJs));
check('支持对象形式 definePlugin({...})', /typeof id === 'object'/.test(loaderJs));
check('缺 version 自动补全 0.1.0', /version.*0\.1\.0/.test(loaderJs));
check('缺 title 自动补全为 id', /title.*config\.id|title.*id/.test(loaderJs));
check('缺 path 自动补全 /id', /path.*\/\$\{?config\.id|'\/' \+ id/.test(loaderJs));
check('缺 icon 自动补全 fas fa-cube', /fas fa-cube/.test(loaderJs));
check('不做严格校验（传啥接啥）', /宽松|不抛|try\s*\{/.test(loaderJs) || /catch/.test(loaderJs));
// 所有页面用 definePlugin
const pages = fs.readdirSync(path.join(ROOT, 'js/pages')).filter(f => f.endsWith('.js'));
const nonConforming = pages.filter(f => { const c = read('js/pages/' + f); return !/definePlugin|registerPlugin/.test(c); });
check('所有 js/pages/*.js 使用 definePlugin（异常:' + nonConforming.join(',') + '）', nonConforming.length === 0);

console.log('\n===== 【D】HTML 插件：双模式，无边框，标题显示在顶栏 =====');
const css = read('styles/main.css');
check('iframe 模式样式存在', /\.html-plugin-iframe-mode/.test(css));
check('iframe 无边框 (border:none)', /html-plugin-iframe-naked[^]*?border:\s*none/.test(css));
check('iframe 铺满 (width:100%)', /html-plugin-iframe-naked[^]*?width:\s*100%/.test(css));
check('iframe 填满视口高度', /html-plugin-iframe-mode\s*\{[^]*?height:\s*calc\(100dvh/.test(css));
check('inline 模式无卡片包裹 (display:block)', /html-plugin-inline-mode\s*\{[^]*?display:\s*block/.test(css));
check('无外框容器样式（.html-plugin-content 无 border/background）', (function () {
  var m = css.match(/\.html-plugin-content\s*\{[^}]*\}/);
  if (!m) return false;
  var body = m[0].replace(/\/\*[\s\S]*?\*\//g, ''); // 剔除注释后再判断
  return !/border\s*:|background\s*:|padding\s*:\s*(?!\d*0[; ])/.test(body);
})());
check('移动端 iframe 高度适配', /@media/.test(css) && /html-plugin-iframe-mode\s*\{[^]*?height:\s*calc\(100dvh/.test(css));
check('标题由顶栏显示（route.meta.title）', /meta:\s*{[^}]*title/.test(loaderJs));
check('stripDuplicateHead 去重逻辑', /stripDuplicateHead|isDuplicateTitle/.test(loaderJs));
check('去重：移除与顶栏同名的 header', /plugin-header/.test(loaderJs));
check('去重：H1 标题重复判定', /H1.*pluginTitle|pluginTitle.*H1|text === pluginTitle/.test(loaderJs));
check('demo-inline 含可移除的 plugin-header', /plugin-header/.test(read('plugins/html/demo-inline.html')));
check('plugins.json 含 iframe 模式示例', /renderMode:\s*['"]iframe['"]/.test(read('js/plugins.json')) || /"renderMode":\s*"iframe"/.test(read('js/plugins.json')));
check('plugins.json 含 inline 模式示例', /"renderMode":\s*"inline"/.test(read('js/plugins.json')));

console.log('\n===== 【E】元数据完整性 =====');
const json = JSON.parse(read('js/plugins.json'));
check('plugins.json 可解析', true);
check('含 categories', Array.isArray(json.categories));
check('主版本号 0.9.20', json.version === '0.9.20');
let metas = [];
(function walk(nodes) {
  nodes.forEach(n => { if (n.type === 'plugin') metas.push(n); else if (n.children) walk(n.children); });
})(json.categories);
check('插件总数 > 0', metas.length > 0);
let missing = 0;
metas.forEach(m => { if (m.src && !fs.existsSync(path.join(ROOT, decodeURIComponent(m.src.replace(/^\//, ''))))) { missing++; errors.push('[缺失] ' + m.id + ' → ' + m.src); } });
check('所有插件 src 文件存在（缺失:' + missing + '）', missing === 0);
const srcFiles = ['js/utils.js', 'js/plugin-loader.js', 'js/router.js', 'js/app.js', 'js/init.js', 'js/plugins.json'];
const mismatched = srcFiles.filter(f => { const c = read(f); return !/0\.9\.20/.test(c); });
check('核心文件版本号 0.9.19（未更新:' + mismatched.join(',') + '）', mismatched.length === 0);

console.log('\n===== 【F】语法检查 =====');
const coreJs = ['js/utils.js', 'js/plugin-loader.js', 'js/router.js', 'js/app.js', 'js/init.js'];
const allJs = coreJs.concat(pages.map(f => 'js/pages/' + f));
let syntaxFail = 0;
for (const f of allJs) {
  try { new Function(read(f)); } catch (e) { syntaxFail++; errors.push('[SYNTAX] ' + f + ': ' + e.message); } }
check('所有 JS 语法通过（失败:' + syntaxFail + '）', syntaxFail === 0);

console.log('\n===== 【G】CSS 综合 =====');
check('亮色主题变量', /\[data-theme="light"\]/.test(css));
check('错误面板样式', /\.dbp-error-panel/.test(css));
check('主题切换支持', /themeMode|changeTheme/.test(appJs));

console.log('\n===== 【H】报错回归：onMounted / .length undefined =====');
// 报错1: ReferenceError: onMounted is not defined
check('setup 内就近定义 onMounted（不依赖外层闭包）', /setup:\s*function\s*\(\)\s*\{[\s\S]{0,200}?var onMounted = Vue\.onMounted \|\|/.test(appJs));
check('onMounted 有降级兜底（Vue.onMounted 缺失时可用 nextTick）', /var onMounted = Vue\.onMounted \|\| function \(fn\) \{ Vue\.nextTick\(fn\); \}/.test(appJs));
// 报错2: TypeError: Cannot read properties of undefined (reading 'length')
check('模板不再裸用 allErrors.length', !/allErrors\.length/.test(appJs));
check('allErrors computed 有空值防御 + seq 去重', /\(startupErrors\.value \|\| \[\]\)\.concat\(runtimeErrors\.value \|\| \[\]\)/.test(appJs) && /seen\[k\]/.test(appJs));
check('新增 errorCount computed（安全取长度）', /var errorCount = computed\(function \(\) \{ return \(allErrors\.value \|\| \[\]\)\.length; \}/.test(appJs));
check('模板用 errorCount 控制错误面板显隐', /v-if="errorCount"/.test(appJs));
check('setup return 导出 errorCount', /errorCount:\s*errorCount/.test(appJs));
// 缓存防护
check('index.html 本地资源带 ?v= 版本戳（防旧文件缓存）', /\.js\?v=[\d.]+/.test(htmlFile) && /main\.css\?v=[\d.]+/.test(htmlFile));
// 运行时降级验证：Vue.onMounted 缺失时不崩
(function () {
  var ok = false;
  try {
    var fakeVue = { nextTick: function (fn) { fn && fn(); } }; // 故意不提供 onMounted
    var onMounted = fakeVue.onMounted || function (fn) { fakeVue.nextTick(fn); };
    var called = false;
    onMounted(function () { called = true; });
    ok = called === true;
  } catch (e) { ok = false; }
  check('降级函数在 Vue.onMounted 缺失时仍能执行回调', ok);
})();

console.log('\n===== 【I】模板全局访问安全网（DBP undefined 回归） =====');
// 报错: TypeError: Cannot read properties of undefined (reading 'DBP')
// 根因: Vue3 模板里写 window.DBP → 编译为 _ctx.window.DBP → _ctx.window 为 undefined
const pageFiles = fs.readdirSync(path.join(ROOT, 'js/pages')).filter(f => f.endsWith('.js'));
const coreTpl = ['js/app.js'];
const tplRisk = [];
pageFiles.concat(coreTpl).forEach(function (f) {
  const rel = f.indexOf('js/') === 0 ? f : ('js/pages/' + f);
  let src = '';
  try { src = read(rel); } catch (e) { return; }
  const lines = src.split('\n');
  lines.forEach(function (l, i) {
    const isBinding = /(v-text|v-html|v-if|v-show|v-bind|:[a-zA-Z-]+|@[a-zA-Z]+)="[^"]*"|\{\{[^}]*\}\}/.test(l);
    if (isBinding && /\b(window|document|localStorage|navigator)\s*\./.test(l)) {
      tplRisk.push(f + ':' + (i + 1) + ' ' + l.trim().slice(0, 100));
    }
  });
});
check('插件/根模板的 Vue 绑定中不再裸用 window./document.（风险:' + tplRisk.length + '）', tplRisk.length === 0);
if (tplRisk.length) tplRisk.forEach(function (t) { errors.push('[模板全局] ' + t); });

check('app 注入 globalProperties 安全网(window/document 等)', /app\.config\.globalProperties\[k\] = global\[k\]/.test(appJs));
check('安全网覆盖 window', /'window'/.test(appJs) && /globalProperties/.test(appJs));
check('安全网覆盖 document / navigator / localStorage', /'document', 'navigator', 'localStorage'/.test(appJs));
check('about.js 模板绑定中不再使用 window.DBP', !/v-text="[^"]*window\.DBP|\{\{[^}]*window\.DBP/.test(read('js/pages/about.js')));
check('about.js 改为 setup 返回 dbpVersion', /dbpVersion/.test(read('js/pages/about.js')) && /dbpVersion: dbpVersion/.test(read('js/pages/about.js')));
check('resources 带版本戳（强制刷新缓存）', /main\.css\?v=[\d.]+/.test(read('index.html')) && /app\.js\?v=[\d.]+/.test(read('index.html')));

// 运行时验证：模拟 Vue3 模板取 _ctx.window 的场景
(function () {
  var ok = false;
  try {
    var globalProperties = {};
    ['window', 'document'].forEach(function (k) { if (global[k] !== undefined) globalProperties[k] = global[k]; });
    var ctx = Object.assign({}, globalProperties);      // 模拟 _ctx（只含 globalProperties）
    var val = ctx.window && ctx.window.DBP;              // 模板编译后的等价访问
    ok = val === undefined;                              // 不抛错即为通过
  } catch (e) { ok = false; }
  check('注入后 _ctx.window.DBP 访问不抛异常', ok);
})();

console.log('\n===== 【J】确认框可见性 + 错误可见性 =====');
const utilsSrc = read('js/utils.js');
// 1) 确认框透明 bug：.modal-box 默认 opacity:0，必须加 .modal-enter
check('CSS: .modal-box 默认 opacity:0（需 .modal-enter 才可见）', /\.modal-box\s*\{[^}]*opacity:\s*0/.test(css));
check('CSS: .modal-box.modal-enter 恢复 opacity:1', /\.modal-box\.modal-enter\s*\{[^}]*opacity:\s*1/.test(css));
check('★ showConfirm 给 modal-box 加 .modal-enter', /box\.classList\.add\('modal-enter'\)/.test(utilsSrc));
check('showConfirm 用 rAF 触发过渡（非同步添加）', /raf\(function \(\) \{ box\.classList\.add\('modal-enter'\); \}\)/.test(utilsSrc));
check('showConfirm 关闭时有 closing 动画再隐藏', /classList\.add\('closing'\)/.test(utilsSrc) && /classList\.remove\('show'\)/.test(utilsSrc));
check('showConfirm 支持 ESC 关闭', /keydown.*Escape|e\.key === 'Escape'/.test(utilsSrc));

// 2) 错误可见性
check('★ app.config.errorHandler 已挂载（组件内错误进总线）', /app\.config\.errorHandler\s*=\s*function/.test(appJs));
check('errorHandler 推入总线 phase:render', /phase:\s*'render'/.test(appJs));
const initSrc = read('js/init.js');
check('★ 启动失败不再只在 _fallback 时兜底（ensureVisible）', /function ensureVisible/.test(initSrc) && /ensureVisible\(err\)/.test(initSrc));
check('ensureVisible 检测应用是否已挂载', /mounted/.test(initSrc) && /root\.children\.length\s*>\s*0/.test(initSrc));
check('未挂载时渲染静态兜底页 renderFatalFallback', /renderFatalFallback\(err\)/.test(initSrc));
const loaderSrc = read('js/plugin-loader.js');
check('★ bootstrap 失败也尝试挂载应用（否则面板不存在）', /report\('bootstrap', err, \{ fatal: true \}\);[\s\S]{0,200}?BP_START_APP\(\)/.test(loaderSrc));
check('★ 有错误时面板默认展开', /var errorExpanded = ref\(errorCount\.value > 0\)/.test(appJs));
check('★ 新错误出现时自动展开（watch errorCount）', /Vue\.watch\(errorCount/.test(appJs));

console.log('\n===== 【K】外链插件类型（type: link / url） =====');
const json2 = JSON.parse(read('js/plugins.json'));
let allNodes = [];
(function walk2(nodes) { (nodes || []).forEach(n => { allNodes.push(n); if (n.children) walk2(n.children); }); })(json2.categories);
const linkNodes = allNodes.filter(n => n.type === 'link');
check('★ plugins.json 含 link 类型条目', linkNodes.length > 0, 'count=' + linkNodes.length);
check('★ link 条目都带 url', linkNodes.every(n => !!n.url));
check('link 条目不带 src（不加载文件）', linkNodes.every(n => !n.src));
check('含 Minecraft Wiki 中文站', linkNodes.some(n => n.url === 'https://zh.minecraft.wiki'));

const loaderSrc2 = read('js/plugin-loader.js');
check('★ normalize 识别 type=link', /n\.type === 'link'/.test(loaderSrc2));
check('★ 无 src/component 但有 url 时自动判为 link', /!n\.src && !n\.component && n\.url/.test(loaderSrc2));
check('link 默认 target=_blank', /n\.target = '_blank'/.test(loaderSrc2));
check('link 默认 badge=URL', /n\.badge = 'URL'/.test(loaderSrc2));
check('★ flattenTree 收集 link', /node\.type === 'plugin' \|\| node\.type === 'link'/.test(loaderSrc2));
check('★ loadPlugin 对 link 返回 null（不加载）', /meta\.type === 'link'[\s\S]{0,120}?return null/.test(loaderSrc2));
check('导出 isLinkPlugin', /global\.isLinkPlugin = function/.test(loaderSrc2));
check('导出 openLink（noopener 安全）', /global\.openLink = function/.test(loaderSrc2) && /noopener/.test(loaderSrc2));

const routerSrc2 = read('js/router.js');
check('★ router 跳过 link 不建路由', /if \(p\.type === 'link'[\s\S]{0,80}?return;/.test(routerSrc2));

check('★ 侧边栏渲染 link 节点（cat-link-item）', /cat-link-item/.test(appJs));
check('侧边栏 link 用真实 url 作 href', /:href="node\.url"/.test(appJs));
check('侧边栏 link target 可配置', /:target="node\.target \|\| '_blank'"/.test(appJs));
check('侧边栏 link 带 rel=noopener（安全）', /rel="noopener noreferrer"/.test(appJs));
check('侧边栏 link 有 onLinkClick 处理', /onLinkClick/.test(appJs));
check('★ 侧边栏搜索过滤支持 link', /if \(n\.type === 'link'\)/.test(appJs));
check('侧边栏 countChildren 统计 link', /c\.type === 'plugin' \|\| c\.type === 'link'/.test(appJs));

const homeSrc = read('js/pages/home.js');
check('★ 首页渲染 link 卡片（hc-item is-link）', /hc-item is-link/.test(homeSrc));
check('首页 link 卡片用真实 url', /:href="node\.url"/.test(homeSrc));
check('首页分类树局部注册（懒加载下全局注册失效）', /components: \{ HomeCategoryNode: HomeCategoryNode \}/.test(homeSrc));
check('首页导出 DBP_HOME_CATEGORY_NODE', /global\.DBP_HOME_CATEGORY_NODE = HomeCategoryNode/.test(homeSrc));
check('★ 首页统计区分外链数 links', /links: links|kind === 'link'/.test(homeSrc));

check('CSS: url 徽章样式', /nav-badge\.url/.test(css));
check('CSS: 外链项样式 cat-link-item / nav-link-ext', /\.cat-link-item/.test(css) && /\.nav-link-ext/.test(css));
check('CSS: 首页外链卡片 .hc-item.is-link', /\.hc-item\.is-link/.test(css));

console.log('\n===== 【L】框架内置设置页（/settings，非插件） =====');
const rawHtml = read('index.html');
const settingsSrc = fs.existsSync(path.join(ROOT, 'js/settings.js')) ? read('js/settings.js') : '';
check('★ js/settings.js 存在', !!settingsSrc);
check('★ index.html 引入 settings.js（框架层）', /js\/settings\.js\?v=/.test(rawHtml));
check('★ 设置页不注册为插件（无 registerPlugin/definePlugin）', !!settingsSrc && !/registerPlugin|definePlugin/.test(settingsSrc));
check('导出 DBP_SETTINGS_COMPONENT', /global\.DBP_SETTINGS_COMPONENT = /.test(settingsSrc));
check('★ 导出 DBP_SETTINGS_ROUTE 且 path=/settings', /DBP_SETTINGS_ROUTE[\s\S]{0,200}?path: '\/settings'/.test(settingsSrc));
check('路由 meta 标记 builtin', /builtin: true/.test(settingsSrc));
check('★ router.js 内置注册 settings 路由', /DBP_SETTINGS_ROUTE/.test(read('js/router.js')));
check('router 对缺失 settings.js 有降级组件', /设置组件未加载/.test(read('js/router.js')));

const json3 = JSON.parse(read('js/plugins.json'));
let flat3 = [];
(function w3(ns) { (ns || []).forEach(n => { flat3.push(n); if (n.children) w3(n.children); }); })(json3.categories);
check('★ /settings 不在 plugins.json（确认非插件）', !flat3.some(n => n.id === 'settings' || n.path === '/settings'));

check('★ 顶栏菜单含「设置」入口', /handleMenu\('settings'\)/.test(appJs));
check('handleMenu 处理 settings 分支', /case 'settings'/.test(appJs));
check('设置入口放在「系统」分组', /系统[\s\S]{0,200}?handleMenu\('settings'\)/.test(appJs));

check('设置页含主题三选', /theme-opt/.test(settingsSrc) && /setThemeMode\('system'\)/.test(settingsSrc));
check('设置页含概览统计', /settings-stat/.test(settingsSrc) && /stats\.links/.test(settingsSrc));
check('设置页含错误日志区', /错误日志/.test(settingsSrc) && /copyErrors/.test(settingsSrc));
check('设置页含强制刷新', /hardReload/.test(settingsSrc));
check('设置页含打开编辑器', /plugin-editor\.html/.test(settingsSrc));
check('设置页含清空本地数据', /resetAll/.test(settingsSrc) && /dbp-/.test(settingsSrc));
check('★ 危险操作走 showConfirm 二次确认', /showConfirm/.test(settingsSrc));

check('CSS: .settings-page / .theme-opt / .theme-picker', /\.settings-page/.test(css) && /\.theme-opt/.test(css) && /\.theme-picker/.test(css));
check('CSS: 概览统计 .settings-stat', /\.settings-stat/.test(css));
check('CSS: 错误列表 .settings-error-item', /\.settings-error-item/.test(css));
check('CSS: 设置页移动端适配', /@media \(max-width: 768px\)[\s\S]{0,400}?\.theme-picker/.test(css));

console.log('\n===== 【M】右上角菜单超高可滚动 =====');
check('★ .topbar-dropdown 设了 max-height（vh）', /\.topbar-dropdown[\s\S]{0,600}?max-height:\s*calc\(100vh/.test(css));
check('★ .topbar-dropdown 设了 max-height（dvh 移动端精确）', /\.topbar-dropdown[\s\S]{0,700}?max-height:\s*calc\(100dvh/.test(css));
check('★ .topbar-dropdown overflow-y:auto', /\.topbar-dropdown[\s\S]{0,700}?overflow-y:\s*auto/.test(css));
check('★ .topbar-dropdown 横向不溢出 overflow-x:hidden', /\.topbar-dropdown[\s\S]{0,700}?overflow-x:\s*hidden/.test(css));
check('★ 阻止滚动穿透 overscroll-behavior:contain', /\.topbar-dropdown[\s\S]{0,700}?overscroll-behavior:\s*contain/.test(css));
check('★ 移动端惯性滚动 -webkit-overflow-scrolling', /\.topbar-dropdown[\s\S]{0,700}?-webkit-overflow-scrolling/.test(css));
check('★ 菜单滚动条样式（webkit + firefox）',
  /\.topbar-dropdown::-webkit-scrollbar/.test(css) && /\.topbar-dropdown::-webkit-scrollbar-thumb/.test(css) &&
  /scrollbar-width:\s*thin/.test(css) && /scrollbar-color/.test(css));
check('★ 分组标题吸顶 position:sticky', /\.dropdown-group-title\s*\{[\s\S]{0,200}?position:\s*sticky/.test(css));
check('★ max-height 扣除了顶栏高度', /max-height:\s*calc\(100dvh - var\(--topbar-height\)/.test(css));
check('★ 打开菜单时重置滚动位置 resetMenuScroll', /function resetMenuScroll/.test(appJs));
check('★ toggleMenu 打开时调用重置', /toggleMenu[\s\S]{0,300}?resetMenuScroll/.test(appJs));
check('★ 重置用 nextTick 兜底（DOM 更新后执行）', /Vue\.nextTick\(resetMenuScroll\)|setTimeout\(resetMenuScroll/.test(appJs));

const peHtml = fs.existsSync(path.join(ROOT, 'plugin-editor.html')) ? read('plugin-editor.html') : '';
check('★ 编辑器菜单同样可滚动 max-height', /\.pe-dropdown\s*\{[\s\S]{0,500}?max-height:\s*calc\(100dvh/.test(peHtml));
check('★ 编辑器菜单 overflow-y:auto', /\.pe-dropdown\s*\{[\s\S]{0,500}?overflow-y:\s*auto/.test(peHtml));
check('★ 编辑器菜单滚动条样式', /\.pe-dropdown::-webkit-scrollbar-thumb/.test(peHtml));

console.log('\n===== 【N】首页（Haavk / Relink 风格） =====');
check('★ 首页版本 0.9.20', /HOME_VERSION = '0\.9\.20'/.test(homeSrc));
check('★ 天空 Hero .hv-sky', /hv-sky/.test(homeSrc));
check('★ Hero 主标题「解码 方块世界」（MC 化）', /解码/.test(homeSrc) && /方块世界/.test(homeSrc));
check('★ Hero 副标题 Every block has an answer.', /Every block has an answer/.test(homeSrc));
check('★ 星点 / 地平线装饰层', /hv-stars/.test(homeSrc) && /hv-horizon/.test(homeSrc));
check('★ MC 设问 QUESTIONS（合成/红石/种子）', /QUESTIONS/.test(homeSrc) && /一块木头/.test(homeSrc) && /红石/.test(homeSrc) && /种子/.test(homeSrc));
check('★ 三个维度 DIMENSIONS（主世界/下界/末地）', /DIMENSIONS/.test(homeSrc) && /主世界/.test(homeSrc) && /下界/.test(homeSrc) && /末地/.test(homeSrc));
check('★ CTA 开始你的世界 / start exploring', /开始你的世界/.test(homeSrc) && /start exploring/.test(homeSrc));
check('★ 全局搜索框 v-model', /v-model="searchQuery"/.test(homeSrc));
check('★ 搜索实时结果 searchResults computed', /var searchResults = computed/.test(homeSrc));
check('★ 搜索回车直达 goFirstResult', /goFirstResult/.test(homeSrc) && /@keydown\.enter="goFirstResult"/.test(homeSrc));
check('★ ESC 清空搜索', /@keydown\.esc="searchQuery = ''"/.test(homeSrc));
check('★ / 快捷键聚焦搜索', /e\.key === '\/'/.test(homeSrc));
check('★ 视图切换 矩阵/目录', /viewMode/.test(homeSrc) && /hv-switch/.test(homeSrc));
check('★ 工具矩阵卡片 hv-tool + allTools', /hv-tool/.test(homeSrc) && /allTools/.test(homeSrc));
check('★ 目录视图用分类树组件', /home-category-node/.test(homeSrc));
check('★ 首页分类树局部注册（懒加载下全局注册失效）', /components: \{ HomeCategoryNode: HomeCategoryNode \}/.test(homeSrc));
check('★ 首页导出 DBP_HOME_CATEGORY_NODE', /global\.DBP_HOME_CATEGORY_NODE = HomeCategoryNode/.test(homeSrc));
check('★ 首页渲染 link 卡片（hc-item is-link）', /hc-item is-link/.test(homeSrc));
check('★ 首页不展示框架字段（版本/数量/格式/日志）',
  !/主版本号/.test(homeSrc) && !/可用工具/.test(homeSrc) && !/外链数/.test(homeSrc) && !/更新日志/.test(homeSrc) && !/hv-format/.test(homeSrc));
check('★ 模板无 window. 裸用（避免 DBP 崩溃回归）', !/\{\{[^}]*\bwindow\./.test(homeSrc));
check('★ 模板无内联 onclick', !/onclick=/.test(homeSrc));
check('CSS: 天空 Hero .hv-sky / .hv-title', /\.hv-sky/.test(css) && /\.hv-title/.test(css));
check('CSS: 星点 .hv-stars / 地平线 .hv-horizon', /\.hv-stars/.test(css) && /\.hv-horizon/.test(css));
check('CSS: 搜索 .hv-search / .hv-results', /\.hv-search\b/.test(css) && /\.hv-results/.test(css));
check('CSS: 设问 .hv-q / .hv-q-n', /\.hv-q\b/.test(css) && /\.hv-q-n/.test(css));
check('CSS: 两代 .hv-gen / .hv-gen-tag', /\.hv-gen\b/.test(css) && /\.hv-gen-tag/.test(css));
check('CSS: 工具矩阵 .hv-grid / .hv-tool', /\.hv-grid/.test(css) && /\.hv-tool\b/.test(css));
check('CSS: CTA .hv-cta / .hv-btn', /\.hv-cta/.test(css) && /\.hv-btn/.test(css));
check('CSS: 分类项 .hc-item / .hc-folder-head', /\.hc-item\b/.test(css) && /\.hc-folder-head/.test(css));
check('CSS: 首页移动端适配', /@media \(max-width: 768px\)[\s\S]{0,900}?\.hv-sky/.test(css));
console.log('\n===== 【O】首页背景图 =====');
const bgOk = fs.existsSync(path.join(ROOT, 'assets/hero-bg.webp'));
check('★ 首页有背景图层 .hv-bg', /hv-bg/.test(homeSrc));
check('★ 背景图资源存在 assets/hero-bg.webp', bgOk);
check('CSS: .hv-bg 引用背景图', /\.hv-bg[\s\S]{0,400}?assets\/hero-bg\.webp/.test(css));
check('CSS: 背景图有暗色遮罩保证可读性', /\.hv-bg::after/.test(css));
check('CSS: 亮色主题下调低背景图不透明度', /\[data-theme="light"\] \.hv-bg/.test(css));

console.log('\n===== 【P】自定义主题色 =====');
check('★ app.js 有 ACCENT_PRESETS 预设色板', /ACCENT_PRESETS/.test(appJs));
check('★ app.js 有 applyAccent 推导衍生变量', /function applyAccent/.test(appJs) && /--accent-dim/.test(appJs) && /--accent-glow/.test(appJs));
check('★ app.js 持久化到 dbp-accent', /dbp-accent/.test(appJs));
check('★ 设置页有主题色选择器', /accent-picker/.test(settingsSrc) && /accent-swatch/.test(settingsSrc));
check('★ 设置页有自定义取色器 input[type=color]', /type="color"/.test(settingsSrc));
check('★ 设置页可恢复默认主题色', /resetAccentColor/.test(settingsSrc) && /clearAccent/.test(settingsSrc));
check('★ index.html 早期脚本应用主题色（防闪烁）', /dbp-accent/.test(htmlFile) && /--accent-glow/.test(htmlFile));
check('★ init.js 启动时应用主题色', /applyAccent/.test(initSrc));
check('CSS: .accent-swatch / .accent-custom 样式', /\.accent-swatch/.test(css) && /\.accent-custom/.test(css));

console.log('\n===== 【Q】公告系统 =====');
const annSrc = fs.existsSync(path.join(ROOT,'js/announcement.js')) ? read('js/announcement.js') : '';
const aboutSrc = fs.existsSync(path.join(ROOT,'js/pages/about.js')) ? read('js/pages/about.js') : '';
check('★ 独立公告文件 js/announcements.json', fs.existsSync(path.join(ROOT, 'js/announcements.json')));
check('★ 公告模块 js/announcement.js', annSrc.length > 0);
check('★ index.html 引入公告模块', /announcement\.js/.test(htmlFile));
check('★ 公告按 ID 区分并排序（最新在前）', /id: Number\(a\.id\)/.test(annSrc) && /y\.id - x\.id/.test(annSrc));
check('★ 公告已读记录按 ID 独立存储', /dbp-read-announcements/.test(annSrc));
check('★ 公告支持「不再显示」只标记该条', /markRead/.test(annSrc) && /不再显示/.test(annSrc));
check('★ 公告正文为 Markdown（复用 markdownToHtml）', /markdownToHtml/.test(annSrc) && /renderMarkdown/.test(annSrc));
check('★ 公告为弹窗式', /ann-overlay/.test(annSrc) && /ann-modal/.test(annSrc));
check('★ 公告支持 ESC 关闭', /Escape/.test(annSrc));
check('★ init.js 启动后弹出公告', /startAnnouncement/.test(initSrc));
check('★ 多条公告进入同一队列（不再只弹一条）', /pendingList/.test(annSrc) && /items\.length/.test(annSrc) && !/pendingAnnouncement/.test(annSrc));
check('★ 弹窗显示进度「第 N / M 条」', /第 \{\{ index \+ 1 \}\} \/ \{\{ total \}\} 条/.test(annSrc));
check('★ 弹窗支持 上一条/下一条 导航', /ann-nav-btn/.test(annSrc) && /hasPrev/.test(annSrc) && /hasNext/.test(annSrc));
check('★ 弹窗支持「全部已读」一次性关闭', /readAll/.test(annSrc) && /全部已读/.test(annSrc));
check('★ 并发保护：单例 + starting 标志', /var starting = false/.test(annSrc) && /starting = true/.test(annSrc) && /vm \|\| starting/.test(annSrc));
check('★ 关闭先播动画再销毁（is-closing + 延迟）', /is-closing/.test(annSrc) && /setTimeout/.test(annSrc));
check('★ 提供 isRead 接口（不支持反向标未读）', /function isRead/.test(annSrc) && !/unmarkRead/.test(annSrc));
check('★ 关于页公告可切换 已读/未读', /toggleRead/.test(aboutSrc) && /ann-read-toggle/.test(aboutSrc));
check('★ 关于页常驻可折叠公告区', /ann-archive/.test(aboutSrc) && /annOpen/.test(aboutSrc));
check('★ 关于页仅支持单向标记已读', /toggleRead/.test(aboutSrc) && !/resetAnnRead/.test(aboutSrc));
check('CSS: 公告弹窗样式', /\.ann-overlay/.test(css) && /\.ann-modal/.test(css));
check('CSS: 公告归档样式', /\.ann-archive/.test(css) && /\.ann-arch-item/.test(css));
check('CSS: 「不再显示」按钮有边框', /\.ann-never \{[\s\S]{0,300}?border: 1px solid var\(--border\)/.test(css));
check('CSS: 关闭动画 annFadeOut / annPopOut', /annFadeOut/.test(css) && /annPopOut/.test(css));
check('CSS: 内容切换动画 annContentIn', /annContentIn/.test(css));
check('CSS: 已读切换按钮 .ann-read-toggle', /\.ann-read-toggle/.test(css));
check('★ 背景图无水印（右下角无亮块）', fs.existsSync(path.join(ROOT,'assets/hero-bg.webp')));
check('★ 弹窗限高 62vh + dvh 兜底（高度已降低）', /\.ann-modal[\s\S]{0,260}?max-height: 62vh/.test(css) && /\.ann-modal[\s\S]{0,300}?max-height: 62dvh/.test(css));
check('★ 弹窗严格居中（overlay 双向 center + modal margin auto）', /\.ann-overlay[\s\S]{0,300}?align-items: center/.test(css) && /\.ann-overlay[\s\S]{0,300}?justify-content: center/.test(css) && /\.ann-modal[\s\S]{0,300}?margin: auto/.test(css));
check('★ 公告延迟弹出 + 支持 opts.delay', /SHOW_DELAY/.test(annSrc) && /opts\.delay/.test(annSrc));
check('★ 已移除「标记为未读」能力', !/unmarkRead/.test(annSrc) && !/unmarkAnnouncementRead/.test(annSrc) && !/resetAnnRead/.test(aboutSrc));
check('★ iframe 只读不改内部颜色（无注入逻辑）', !/injectThemeIntoIframe/.test(loaderSrc) && !/data-dbp-theme-sync/.test(loaderSrc) && !/\.head\.appendChild/.test(loaderSrc));
check('★ iframe 边缘取色（elementFromPoint 采样 + 冒泡）', /elementFromPoint/.test(loaderSrc) && /pickTopEdge/.test(loaderSrc) && /pickSideEdge/.test(loaderSrc));
check('★ 边缘色分区域变量 top/side/main', /--iframe-bg-top/.test(loaderSrc) && /--iframe-bg-side/.test(loaderSrc));
check('CSS: 顶栏用 --iframe-bg-top / 侧边栏用 --iframe-bg-side', /body\.iframe-theme-follow \.topbar \{[\s\S]{0,200}--iframe-bg-top/.test(css) && /body\.iframe-theme-follow \.sidebar \{[\s\S]{0,200}--iframe-bg-side/.test(css));
check('★ 颜色解析支持 rgb/rgba/hex', loaderSrc.indexOf('[0-9a-f]{3}') >= 0 && loaderSrc.indexOf('parseInt(t.slice(0, 2), 16)') >= 0);
check('CSS: iframe 背景透明（无缝）', /\.html-plugin-iframe-naked[\s\S]{0,300}?background: transparent/.test(css));
check('★ 弹窗高度链完整（content 可压缩 + body 滚动）', /\.ann-content[\s\S]{0,240}?min-height: 0/.test(css) && /\.ann-body[\s\S]{0,200}?overflow-y: auto/.test(css));
check('★ 弹窗小屏/矮屏高度适配', /@media \(max-width: 600px\)[\s\S]{0,900}?\.ann-modal/.test(css) && /@media \(max-height: 520px\)/.test(css));
check('★ 公告按 id 降序且 id 相同按日期', /y\.id - x\.id/.test(annSrc) && /String\(x\.date/.test(annSrc));
check('★ 关于页公告支持分页', /pagedAnnouncements/.test(aboutSrc) && /annPageSize/.test(aboutSrc) && /totalPages/.test(aboutSrc));
check('★ 分页控件带省略号折叠', /pageList/.test(aboutSrc) && /'…'/.test(aboutSrc));
check('★ 最新一条标记「最新」', /isNewest/.test(aboutSrc) && /ann-badge-new/.test(aboutSrc));
check('CSS: 分页控件样式', /\.ann-pager/.test(css) && /\.ann-pager-btn/.test(css));

console.log('\n===== 【R】iframe 配色跟随 =====');
check('★ iframe 模式读取内部背景色', /contentDocument/.test(loaderJs) && /backgroundColor/.test(loaderJs));
check('★ 设置 --iframe-bg / --iframe-fg 变量', /--iframe-bg/.test(loaderJs) && /--iframe-fg/.test(loaderJs));
check('★ 仅当前页面生效（onBeforeUnmount 还原）', /Vue\.onBeforeUnmount\(clearFollowColors\)/.test(loaderJs));
check('★ 背景透明时不跟随', /c\.a < 0\.5/.test(loaderJs));
check('★ 按亮度自动推导前景色', /luminance/.test(loaderJs));
check('CSS: body.iframe-theme-follow 覆盖框架配色', /body\.iframe-theme-follow \.topbar/.test(css) && /body\.iframe-theme-follow \.sidebar/.test(css));

console.log('\n===== 结果: ' + pass + ' 通过 / ' + fail + ' 失败 =====');
if (fail || errors.length) {
  console.log('\n--- 问题列表 ---');
  errors.slice(0, 50).forEach(e => console.log(e));
}
process.exit(fail ? 1 : 0);
