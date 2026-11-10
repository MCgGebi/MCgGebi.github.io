const fs=require('fs'),path=require('path');
let JSDOM; try{JSDOM=require('jsdom').JSDOM}catch(e){console.log('需要jsdom');process.exit(0)}
const ROOT=path.join(__dirname,'..');
let pass=0,fail=0;const ck=(n,c,e)=>{if(c)pass++;else{fail++;console.log('  ✗ '+n+' → '+(e||''))}};

/* jsdom 的 iframe 不做真实样式计算，故用受控 mock 注入 contentDocument/contentWindow，
   以验证「取色 → 设置 CSS 变量」这条真实代码路径是否被走到。 */
(async()=>{
console.log('【真实链路：iframeRef 绑定 → 取色 → 框架跟随】');
const dom=new JSDOM('<!DOCTYPE html><html><head><style>:root{--bg:#1a1a1a;--text:#e0e0e0}</style></head><body></body>',
  {runScripts:'outside-only',url:'http://localhost:8000/',pretendToBeVisual:true});
const w=dom.window;
w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
w.eval(fs.readFileSync(path.join(ROOT,'vendor/vue.global.prod.js'),'utf8'));
w.eval(fs.readFileSync(path.join(ROOT,'js/utils.js'),'utf8'));
w.eval(fs.readFileSync(path.join(ROOT,'js/plugin-loader.js'),'utf8'));

const C=w.createHtmlPluginComponent({id:'demo',title:'Demo',pluginType:'html',renderMode:'iframe',src:'./x.html'});
const app=w.Vue.createApp(C);
const m=w.document.createElement('div'); w.document.body.appendChild(m);
app.mount(m);
await new Promise(r=>setTimeout(r,150));
const ifr=m.querySelector('iframe');
ck('组件渲染出 iframe 元素', !!ifr);

/* 安装受控 mock：body 背景 rgb(20,60,100)，文字白 */
const mockDoc={ head:{appendChild(){injected.push(1);return null;}},
  documentElement:{}, body:{},
  createElement(t){return {setAttribute(){},textContent:''};},
  elementFromPoint(){return mockDoc.body;} };   // 无分层结构：边缘=整体底色
const injected=[];
Object.defineProperty(ifr,'contentDocument',{get(){return mockDoc;},configurable:true});
Object.defineProperty(ifr,'contentWindow',{get(){return {document:mockDoc,
  innerWidth: 800, innerHeight: 600,
  getComputedStyle(el){ return el===mockDoc.body
    ? {backgroundColor:'rgb(20, 60, 100)', color:'rgb(255, 255, 255)'}
    : {backgroundColor:'rgba(0, 0, 0, 0)', color:'rgb(255, 255, 255)'}; }};},configurable:true});

ifr.dispatchEvent(new w.Event('load'));
await new Promise(r=>setTimeout(r,900));

const root=w.document.documentElement;
const bg=root.style.getPropertyValue('--iframe-bg');
const fg=root.style.getPropertyValue('--iframe-fg');
const follow=w.document.body.classList.contains('iframe-theme-follow');
console.log('  实际: --iframe-bg='+(bg||'空')+' | --iframe-fg='+(fg||'空')+' | followClass='+follow);

ck('★ 取色链路被走到：设置了 --iframe-bg', !!bg, 'bg='+bg);
ck('★ 背景值正确 rgb(20,60,100)', /20,\s*60,\s*100/.test(bg), 'bg='+bg);
ck('★ 前景色取自 iframe 文字色', /255,\s*255,\s*255/.test(fg), 'fg='+fg);
ck('★ body 加上 iframe-theme-follow', follow===true);

console.log('\n【透明 iframe → 框架只读，不注入任何内容】');
const dom2=new JSDOM('<!DOCTYPE html><html><head><style>:root{--bg:#101010;--text:#eeeeee}</style></head><body></body>',
  {runScripts:'outside-only',url:'http://localhost:8000/',pretendToBeVisual:true});
const w2=dom2.window; w2.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
w2.eval(fs.readFileSync(path.join(ROOT,'vendor/vue.global.prod.js'),'utf8'));
w2.eval(fs.readFileSync(path.join(ROOT,'js/utils.js'),'utf8'));
w2.eval(fs.readFileSync(path.join(ROOT,'js/plugin-loader.js'),'utf8'));
const C2=w2.createHtmlPluginComponent({id:'demo2',title:'Demo2',pluginType:'html',renderMode:'iframe',src:'./y.html'});
const m2=w2.document.createElement('div'); w2.document.body.appendChild(m2);
w2.Vue.createApp(C2).mount(m2);
await new Promise(r=>setTimeout(r,150));
const ifr2=m2.querySelector('iframe');
const stylesInjected=[];
const mockDoc2={ head:{appendChild(n){stylesInjected.push(n.textContent);return n;}},
  documentElement:{}, body:{}, createElement(){return {setAttribute(){},textContent:''};},
  elementFromPoint(){return null;} };
Object.defineProperty(ifr2,'contentDocument',{get(){return mockDoc2;},configurable:true});
Object.defineProperty(ifr2,'contentWindow',{get(){return {document:mockDoc2,
  innerWidth: 800, innerHeight: 600,
  getComputedStyle(){return {backgroundColor:'rgba(0, 0, 0, 0)', color:'rgb(0, 0, 0)'};}};},configurable:true});
ifr2.dispatchEvent(new w2.Event('load'));
await new Promise(r=>setTimeout(r,900));
console.log('  注入的 style 数: '+stylesInjected.length);
  ck('★ 透明 iframe 也不注入任何 style（内部颜色不受影响）', stylesInjected.length===0, 'n='+stylesInjected.length);
  ck('★ 不设置 --iframe-bg-top（无边缘色可取）', !w2.document.documentElement.style.getPropertyValue('--iframe-bg-top'));
  ck('★ 不设置 --iframe-bg', !w2.document.documentElement.style.getPropertyValue('--iframe-bg'));
  ck('★ 不加跟随类（无可跟随颜色）', !w2.document.body.classList.contains('iframe-theme-follow'));

console.log('\n===== 结果: '+pass+' 通过 / '+fail+' 失败 =====');
process.exit(fail?1:0);
})().catch(e=>{console.error('CRASH',e.message,e.stack);process.exit(2)});
