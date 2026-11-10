const fs=require('fs'),path=require('path');
let JSDOM; try { JSDOM = require('jsdom').JSDOM; } catch (e) { console.log('请先安装 jsdom'); process.exit(0); }
const ROOT = path.join(__dirname, '..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
let pass=0,fail=0;const ck=(n,c,e)=>{if(c)pass++;else{fail++;console.log('  ✗ '+n+' → '+(e||''))}};
const dom=new JSDOM(html,{runScripts:'outside-only',url:'http://localhost:8000/',pretendToBeVisual:true,
beforeParse(w){w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}})}});
const w=dom.window;
const files=['vendor/vue.global.prod.js','vendor/vue-router.global.prod.js','js/utils.js','js/plugin-loader.js','js/router.js','js/settings.js','js/app.js','js/init.js'];
(async()=>{
for(const f of files){const p=path.join(ROOT,f);if(fs.existsSync(p)){try{w.eval(fs.readFileSync(p,'utf8'))}catch(e){console.log('加载失败',f,e.message)}}}
const pj=JSON.parse(fs.readFileSync(path.join(ROOT,'js/plugins.json'),'utf8'));
w.eval(`window.__PJ=${JSON.stringify(pj)};`);
w.fetch=(u)=>{let s=String(u).split('?')[0].replace(/^\.\//,'');const p=path.join(ROOT,s);
 if(fs.existsSync(p))return Promise.resolve({ok:true,status:200,text:()=>Promise.resolve(fs.readFileSync(p,'utf8')),json:()=>Promise.resolve(JSON.parse(fs.readFileSync(p,'utf8')))});
 return Promise.resolve({ok:false,status:404,text:()=>Promise.resolve(''),json:()=>Promise.reject(new Error('404'))})};
try{await w.DBP_BOOTSTRAP()}catch(e){console.log('BOOT err',e.message)}
await new Promise(r=>setTimeout(r,400));
const doc=w.document;
console.log('【1】应用启动');
ck('应用已挂载',!!doc.getElementById('app-root')&&doc.getElementById('app-root').innerHTML.length>200);

console.log('【2】加载并渲染首页（Haavk 风格）');
try{
  const C=await w.loadPlugin('home');
  ck('loadPlugin(home) 返回组件',!!(C&&C.template));
  const app=w.Vue.createApp(C);
  app.config.globalProperties.window=w;
  const mount=doc.createElement('div');doc.body.appendChild(mount);
  app.mount(mount);
  await new Promise(r=>setTimeout(r,250));
  const out=mount.textContent,oh=mount.innerHTML;

  console.log('【3】天空 Hero 文案（MC 化 · 保留科技感）');
  ck('渲染主标题「解码 方块世界」',/解码/.test(out)&&/方块世界/.test(out));
  ck('渲染副标题 Every block has an answer.',/Every block has an answer/.test(out));
  ck('渲染 eyebrow BLOCK PROTOCOL',/BLOCK PROTOCOL/.test(out));
  ck('存在天空容器 .hv-sky',!!mount.querySelector('.hv-sky'));
  ck('存在背景图层 .hv-bg',!!mount.querySelector('.hv-bg'));
  ck('存在星点层 .hv-stars',!!mount.querySelector('.hv-stars'));
  ck('存在地平线光带 .hv-horizon',!!mount.querySelector('.hv-horizon'));
  ck('存在滚动提示 .hv-scroll-hint',!!mount.querySelector('.hv-scroll-hint'));
  ck('Hero 含 MC 元信息标签',mount.querySelectorAll('.hv-sky-meta span').length>0);

  console.log('【4】Relink 叙事区块（MC 设问 + 三维度）');
  ck('渲染设问区标题',/方寸之间/.test(out));
  ck('设问 6 条',mount.querySelectorAll('.hv-q').length===6,'q='+mount.querySelectorAll('.hv-q').length);
  ck('设问编号 01~06',/01/.test(out)&&/06/.test(out));
  ck('设问含「一块木头，能推演出多少种合成？」',/一块木头/.test(out));
  ck('设问含红石与种子',/红石/.test(out)&&/种子/.test(out));
  ck('渲染 From a single block, an entire world unfolds.',/From a single block, an entire world unfolds/.test(out));
  ck('渲染维度区块标题',/三个维度/.test(out));
  ck('维度卡片 3 个',mount.querySelectorAll('.hv-gen-c').length===3,'g='+mount.querySelectorAll('.hv-gen-c').length);
  ck('含主世界/下界/末地',/主世界/.test(out)&&/下界/.test(out)&&/末地/.test(out));
  ck('维度含 Overworld/The Nether/The End',/Overworld/.test(out)&&/The Nether/.test(out)&&/The End/.test(out));

  console.log('【5】工具矩阵（功能保留）');
  ck('渲染「探索全部工具」',/探索全部工具/.test(out));
  ck('工具卡片数量 > 0',mount.querySelectorAll('.hv-tool').length>0,'t='+mount.querySelectorAll('.hv-tool').length);
  ck('存在视图切换按钮 2 个',mount.querySelectorAll('.hv-switch button').length===2,'b='+mount.querySelectorAll('.hv-switch button').length);

  console.log('【6】CTA / 页脚');
  ck('CTA 开始你的世界。',/开始你的世界/.test(out));
  ck('CTA start exploring',/start exploring/.test(out));
  ck('存在 CTA 按钮 .hv-btn',!!mount.querySelector('.hv-btn'));
  ck('页脚含 Minecraft Wiki',/Minecraft Wiki/.test(out)&&!!mount.querySelector('.hv-foot-link'));

  console.log('【7】不出现框架字段');
  ck('无「可用工具」统计',!/可用工具/.test(out));
  ck('无「主版本号」',!/主版本号/.test(out));
  ck('无「更新日志」时间轴区块',!mount.querySelector('.hv-timeline')&&!mount.querySelector('.hv-tl-item'));
  ck('无「四种插件格式」说明',!/四种插件格式/.test(out));
  ck('无「插件编辑器」入口',!/插件编辑器/.test(out));

  console.log('【8】交互：搜索');
  const input=mount.querySelector('.hv-search-input');
  ck('存在搜索框',!!input);
  if(input){input.value='合成';input.dispatchEvent(new w.Event('input'));await new Promise(r=>setTimeout(r,180));
    ck('搜索出现结果',mount.querySelectorAll('.hv-result').length>0,'r='+mount.querySelectorAll('.hv-result').length);
    ck('搜索结果含「合成查询」',/合成查询/.test(mount.textContent));}

  console.log('【9】交互：切换到目录视图');
  const btns=mount.querySelectorAll('.hv-switch button');
  if(btns.length===2){btns[1].dispatchEvent(new w.MouseEvent('click',{bubbles:true}));await new Promise(r=>setTimeout(r,200));
    ck('目录视图渲染分类树 .hv-tree',!!mount.querySelector('.hv-tree'));
    ck('目录视图含文件夹节点',mount.querySelectorAll('.hc-folder-head').length>0,'f='+mount.querySelectorAll('.hc-folder-head').length);
    ck('目录视图含条目 .hc-item',mount.querySelectorAll('.hc-item').length>0,'i='+mount.querySelectorAll('.hc-item').length);}
}catch(e){ck('home 渲染无异常',false,e.message);console.log(e.stack&&e.stack.slice(0,400))}
console.log('\n===== 结果: '+pass+' 通过 / '+fail+' 失败 =====');
process.exit(fail?1:0)})().catch(e=>{console.error('CRASH',e.message);process.exit(2)});
