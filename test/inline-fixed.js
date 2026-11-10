const fs=require('fs'),path=require('path');
let JSDOM; try{JSDOM=require('jsdom').JSDOM}catch(e){console.log('需要jsdom');process.exit(0)}
const ROOT=path.join(__dirname,'..');
let pass=0,fail=0;const ck=(n,c,e)=>{if(c)pass++;else{fail++;console.log('  ✗ '+n+' → '+(e||''))}};

console.log('【1】iframe：只读不写（绝不改 iframe 内部颜色）');
{
  const src=fs.readFileSync(path.join(ROOT,'js/plugin-loader.js'),'utf8');
  ck('★ 不再有任何 createElement(style) 注入', !/createElement\('style'\)/.test(src));
  ck('★ 不再向 iframe 文档 appendChild', !/\.head\.appendChild/.test(src) && !/doc\.head/.test(src));
  ck('★ 无反向注入函数残留', !/injectThemeIntoIframe/.test(src));
  ck('★ 无 data-dbp-theme-sync 注入标记', !/data-dbp-theme-sync/.test(src));
  ck('★ iframe 文档仅用于读取（contentDocument 只出现在读取处）',
     (src.match(/contentDocument/g)||[]).length<=2, 'count='+(src.match(/contentDocument/g)||[]).length);
  const css=fs.readFileSync(path.join(ROOT,'styles/main.css'),'utf8');
  ck('★ iframe 元素背景透明（不抢色，也不改内部）', /\.html-plugin-iframe-naked[\s\S]{0,200}background: transparent/.test(css));
}

console.log('\n【2】inline：插件自带 fixed 导航栏不再与顶栏重叠');
(async()=>{
  const dom=new JSDOM('<!DOCTYPE html><html><head><style>:root{--topbar-height:48px}</style></head><body></body>',
    {runScripts:'outside-only',url:'http://localhost:8000/',pretendToBeVisual:true});
  const w=dom.window;
  w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
  w.eval(fs.readFileSync(path.join(ROOT,'vendor/vue.global.prod.js'),'utf8'));
  w.eval(fs.readFileSync(path.join(ROOT,'js/utils.js'),'utf8'));
  w.eval(fs.readFileSync(path.join(ROOT,'js/plugin-loader.js'),'utf8'));

  // 提供 fetch：返回带 fixed 导航栏 + fixed 侧栏的插件 HTML
  const pluginHtml = `
    <header class="plugin-header" style="position:fixed;left:0;right:0;height:56px;background:#333">
      <span>我的插件导航</span>
    </header>
    <nav style="position:fixed;top:56px;left:0;width:120px">工具列表</nav>
    <main style="margin-left:130px"><h3>正文</h3><p>内容</p></main>
    <div style="position:relative">普通块</div>`;
  w.fetch = () => Promise.resolve({ ok:true, status:200, text:()=>Promise.resolve(pluginHtml) });

  const C=w.createHtmlPluginComponent({id:'inline1',title:'我的插件',pluginType:'html',renderMode:'inline',src:'./p.html'});
  const m=w.document.createElement('div'); w.document.body.appendChild(m);
  w.Vue.createApp(C).mount(m);
  await new Promise(r=>setTimeout(r,400));

  const c=m.querySelector('.html-plugin-content');
  ck('内容已注入', !!c && c.innerHTML.length>0);
  const header=c.querySelector('header.plugin-header');
  const nav=c.querySelector('nav');
  ck('★ fixed header 被改为 absolute', header && header.style.position==='absolute', header&&header.style.position);
  ck('★ fixed nav 被改为 absolute', nav && nav.style.position==='absolute', nav&&nav.style.position);
  ck('★ 未指定 top 的 fixed 元素补 top:0（贴容器顶部=顶栏下方）', header && header.style.top==='0px', header&&header.style.top);
  ck('★ 已指定 top 的保留原值 56px', nav && nav.style.top==='56px', 'nav.top='+(nav&&nav.style.top));
  const plain=c.querySelector('main');
  ck('★ 非 fixed 元素不受影响', plain && plain.style.position==='', plain&&plain.style.position);

  const css=fs.readFileSync(path.join(ROOT,'styles/main.css'),'utf8');
  const blk=css.match(/\.html-plugin-inline-mode \{([\s\S]*?)\}/);
  ck('★ 容器 transform 创建包含块', blk && /transform: translateZ\(0\)/.test(blk[1]));
  ck('★ 容器 position: relative（absolute 定位基准）', blk && /position: relative/.test(blk[1]));
  ck('★ 容器 isolation 隔离层叠', blk && /isolation: isolate/.test(blk[1]));
  const tb=css.match(/\n\.topbar \{([\s\S]*?)\}/);
  ck('★ 顶栏 z-index 高于 inline 容器（160 > 1）', tb && /z-index: 160/.test(tb[1]));
})();

console.log('\n【3】inline：重复标题仍被剥离');
(async()=>{
  const dom=new JSDOM('<!DOCTYPE html><html><body></body>',{runScripts:'outside-only',url:'http://localhost:8000/',pretendToBeVisual:true});
  const w=dom.window; w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
  w.eval(fs.readFileSync(path.join(ROOT,'vendor/vue.global.prod.js'),'utf8'));
  w.eval(fs.readFileSync(path.join(ROOT,'js/utils.js'),'utf8'));
  w.eval(fs.readFileSync(path.join(ROOT,'js/plugin-loader.js'),'utf8'));
  const html=`<h1>我的插件</h1><header class="plugin-header"><h2>我的插件</h2></header><section style="position:fixed">悬浮</section><p>正文</p>`;
  w.fetch=()=>Promise.resolve({ok:true,status:200,text:()=>Promise.resolve(html)});
  const C=w.createHtmlPluginComponent({id:'i2',title:'我的插件',pluginType:'html',renderMode:'inline',src:'./q.html'});
  const m=w.document.createElement('div'); w.document.body.appendChild(m);
  w.Vue.createApp(C).mount(m);
  await new Promise(r=>setTimeout(r,400));
  const c=m.querySelector('.html-plugin-content');
  ck('与顶栏同名的 h1 已移除', !c.querySelector('h1'));
  ck('含重复标题的 header 已移除', !c.querySelector('header.plugin-header'));
  const sec=c.querySelector('section');
  ck('★ 内部 fixed 元素改 absolute', sec && sec.style.position==='absolute', sec&&sec.style.position);
  ck('正文保留', !!c.querySelector('p'));
})();

setTimeout(()=>{console.log('\n===== 结果: '+pass+' 通过 / '+fail+' 失败 =====');process.exit(fail?1:0)},500);
