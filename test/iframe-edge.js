const fs=require('fs'),path=require('path');
let JSDOM; try{JSDOM=require('jsdom').JSDOM}catch(e){console.log('需要jsdom');process.exit(0)}
const ROOT=path.join(__dirname,'..');
let pass=0,fail=0;const ck=(n,c,e)=>{if(c)pass++;else{fail++;console.log('  ✗ '+n+' → '+(e||''))}};

function boot(){
  const dom=new JSDOM('<!DOCTYPE html><html><head><style>:root{--bg:#1a1a1a;--text:#e0e0e0;--nav-bg:#111}</style></head><body></body>',
    {runScripts:'outside-only',url:'http://localhost:8000/',pretendToBeVisual:true});
  const w=dom.window;
  w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
  w.eval(fs.readFileSync(path.join(ROOT,'vendor/vue.global.prod.js'),'utf8'));
  w.eval(fs.readFileSync(path.join(ROOT,'js/utils.js'),'utf8'));
  w.eval(fs.readFileSync(path.join(ROOT,'js/plugin-loader.js'),'utf8'));
  return w;
}
/* 构造 mock：iframe 内有一个顶部深色 banner + 左侧浅色栏 + 中间主区 */
function mockIframe(w, ifr, cfg){
  const mk=(bg,parent)=>({backgroundColor:bg,color:cfg.fg||'#fff',parentElement:parent||null});
  const bodyBg = mk(cfg.main);
  const banner = mk(cfg.top, bodyBg);          // 顶部横幅
  const side   = mk(cfg.side, bodyBg);         // 左侧栏
  const htmlEl = mk('rgba(0, 0, 0, 0)', null);
  const doc={documentElement:htmlEl, body:bodyBg, head:{appendChild(){return null;}},
    createElement(){return {setAttribute(){},textContent:''};},
    // 命中点：顶部区域→banner，左侧区域→side，其余→body
    elementFromPoint(x,y){ return (y < cfg.bannerH) ? banner : (x < cfg.sideW ? side : bodyBg); }};
  const win={innerWidth:cfg.w, innerHeight:cfg.h, document:doc,
    getComputedStyle(el){ return el && el.backgroundColor!==undefined
      ? {backgroundColor:el.backgroundColor, color:(el===bodyBg?(cfg.fg||'#ffffff'):'#ffffff')}
      : {backgroundColor:'rgba(0, 0, 0, 0)', color:'#ffffff'}; }};
  Object.defineProperty(ifr,'contentDocument',{get(){return doc;},configurable:true});
  Object.defineProperty(ifr,'contentWindow',{get(){return win;},configurable:true});
  return {doc,win,banner,side,bodyBg};
}

async function t1(){
console.log('【1】边缘取色：顶栏接 iframe 上边缘、侧边栏接左边缘');
  const w=boot();
  const C=w.createHtmlPluginComponent({id:'e1',title:'E1',pluginType:'html',renderMode:'iframe',src:'./a.html'});
  const m=w.document.createElement('div'); w.document.body.appendChild(m);
  w.Vue.createApp(C).mount(m);
  await new Promise(r=>setTimeout(r,150));
  const ifr=m.querySelector('iframe');
  mockIframe(w, ifr, {w:800,h:600,bannerH:60,sideW:50,
    top:'rgb(10, 30, 60)', side:'rgb(200, 220, 240)', main:'rgb(30, 30, 35)', fg:'#ffffff'});
  ifr.dispatchEvent(new w.Event('load'));
  await new Promise(r=>setTimeout(r,900));

  const root=w.document.documentElement;
  const top=root.style.getPropertyValue('--iframe-bg-top');
  const side=root.style.getPropertyValue('--iframe-bg-side');
  const bg=root.style.getPropertyValue('--iframe-bg');
  const fg=root.style.getPropertyValue('--iframe-fg');
  console.log('  实际: top='+(top||'空')+' | side='+(side||'空')+' | bg='+(bg||'空')+' | fg='+(fg||'空'));

  ck('★ 顶部边缘色取自 iframe 上边缘（深色 banner）', /10,\s*30,\s*60/.test(top), 'top='+top);
  ck('★ 左侧边缘色取自 iframe 左边缘（浅色栏）', /200,\s*220,\s*240/.test(side), 'side='+side);
  ck('★ 主区色取自 iframe 整体底色', /30,\s*30,\s*35/.test(bg), 'bg='+bg);
  ck('★ 三个区域颜色各不相同（真边缘采样，非统一底色）', top!==side && side!==bg, top+' / '+side+' / '+bg);
  ck('★ 前景色取自 iframe 文字色', /255,\s*255,\s*255/.test(fg), 'fg='+fg);
  ck('★ body 已挂载跟随类', w.document.body.classList.contains('iframe-theme-follow'));

}
async function t2(){
console.log('\n【2】CSS 变量被正确消费（顶栏/侧边栏各用各的）');
  const css=fs.readFileSync(path.join(ROOT,'styles/main.css'),'utf8');
  const tb=css.match(/body\.iframe-theme-follow \.topbar \{([\s\S]*?)\}/);
  const sb=css.match(/body\.iframe-theme-follow \.sidebar \{([\s\S]*?)\}/);
  const mc=css.match(/body\.iframe-theme-follow \.main-content \{([\s\S]*?)\}/);
  ck('顶栏消费 --iframe-bg-top', tb && /var\(--iframe-bg-top/.test(tb[1]));
  ck('侧边栏消费 --iframe-bg-side', sb && /var\(--iframe-bg-side/.test(sb[1]));
  ck('主区消费 --iframe-bg', mc && /var\(--iframe-bg\b/.test(mc[1]));
  ck('顶栏有过渡动画（接缝变化平滑）', tb && /transition: background/.test(tb[1]));
  ck('侧边栏有过渡动画', sb && /transition: background/.test(sb[1]));
  ck('回退链完整：无边缘色时退回 --iframe-bg', tb && /var\(--iframe-bg-top, var\(--iframe-bg, var\(--nav-bg\)\)\)/.test(tb[1]));

}
async function t3(){
console.log('\n【3】透明 iframe → 绝不修改 iframe 内部（严格单向）');
  const w=boot();
  const C=w.createHtmlPluginComponent({id:'e2',title:'E2',pluginType:'html',renderMode:'iframe',src:'./b.html'});
  const m=w.document.createElement('div'); w.document.body.appendChild(m);
  w.Vue.createApp(C).mount(m);
  await new Promise(r=>setTimeout(r,150));
  const ifr=m.querySelector('iframe');
  const injected=[];
  const doc={documentElement:{backgroundColor:'rgba(0, 0, 0, 0)'},
    body:{backgroundColor:'rgba(0, 0, 0, 0)'},
    head:{appendChild(n){injected.push(n.textContent);return n;}},
    createElement(){return {setAttribute(){},textContent:''};},
    elementFromPoint(){return null;}};
  const win={innerWidth:800,innerHeight:600,document:doc,
    getComputedStyle(el){return {backgroundColor:(el&&el.backgroundColor)||'rgba(0, 0, 0, 0)',color:'#000'};}};
  Object.defineProperty(ifr,'contentDocument',{get(){return doc;},configurable:true});
  Object.defineProperty(ifr,'contentWindow',{get(){return win;},configurable:true});
  ifr.dispatchEvent(new w.Event('load'));
  await new Promise(r=>setTimeout(r,900));
  ck('★ 不再向 iframe 注入任何 style', injected.length===0, '注入数='+injected.length);
  ck('★ 透明时不设置边缘变量（保持框架原样）', !w.document.documentElement.style.getPropertyValue('--iframe-bg-top'));
  ck('★ 透明时不加跟随类', !w.document.body.classList.contains('iframe-theme-follow'));
}

async function t4(){
console.log('\n【4】离开页面清理干净');
  const w=boot();
  const C=w.createHtmlPluginComponent({id:'e3',title:'E3',pluginType:'html',renderMode:'iframe',src:'./c.html'});
  const m=w.document.createElement('div'); w.document.body.appendChild(m);
  const app=w.Vue.createApp(C); app.mount(m);
  await new Promise(r=>setTimeout(r,150));
  const ifr=m.querySelector('iframe');
  mockIframe(w, ifr, {w:800,h:600,bannerH:60,sideW:50,
    top:'rgb(10, 30, 60)', side:'rgb(200, 220, 240)', main:'rgb(30, 30, 35)'});
  ifr.dispatchEvent(new w.Event('load'));
  await new Promise(r=>setTimeout(r,700));
  ck('跟随生效中', !!w.document.documentElement.style.getPropertyValue('--iframe-bg-top'));
  app.unmount();
  await new Promise(r=>setTimeout(r,200));
  const root=w.document.documentElement;
  ck('卸载后清除 --iframe-bg-top', !root.style.getPropertyValue('--iframe-bg-top'));
  ck('卸载后清除 --iframe-bg-side', !root.style.getPropertyValue('--iframe-bg-side'));
  ck('卸载后清除 --iframe-bg', !root.style.getPropertyValue('--iframe-bg'));
  ck('卸载后移除跟随类', !w.document.body.classList.contains('iframe-theme-follow'));

}

(async function run(){
  await t1(); await t2(); await t3(); await t4();
  console.log('\n===== 结果: '+pass+' 通过 / '+fail+' 失败 =====');
  process.exit(fail?1:0);
})().catch(e=>{console.error('CRASH',e.message,e.stack);process.exit(2)});
