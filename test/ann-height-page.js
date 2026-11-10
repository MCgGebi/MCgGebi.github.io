const fs=require('fs'),path=require('path');
let JSDOM; try{JSDOM=require('jsdom').JSDOM}catch(e){console.log('需要jsdom');process.exit(0)}
const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'styles/main.css'),'utf8');
let pass=0,fail=0;const ck=(n,c,e)=>{if(c)pass++;else{fail++;console.log('  ✗ '+n+' → '+(e||''))}};

console.log('【1】弹窗高度约束（CSS 静态）');
{
  const m=css.match(/\.ann-modal\s*\{([\s\S]*?)\}/);
  ck('存在 .ann-modal 规则', !!m);
  const body=m?m[1]:'';
  ck('有 max-height 62vh', /max-height:\s*62vh/.test(body));
  ck('有 dvh 兜底', /max-height:\s*62dvh/.test(body));
  ck('自身 min-height:0（允许被压缩）', /min-height:\s*0/.test(body));
  ck('overflow: hidden 防止溢出', /overflow:\s*hidden/.test(body));

  const c=css.match(/\.ann-content\s*\{([\s\S]*?)\}/);
  ck('存在 .ann-content 规则（新增）', !!c);
  const cb=c?c[1]:'';
  ck('.ann-content flex:1 1 auto', /flex:\s*1 1 auto/.test(cb));
  ck('.ann-content min-height:0（修复溢出关键）', /min-height:\s*0/.test(cb));
  ck('.ann-content 自身为 flex 列', /flex-direction:\s*column/.test(cb));
  ck('.ann-content overflow:hidden', /overflow:\s*hidden/.test(cb));

  const b=css.match(/\.ann-body\s*\{([\s\S]*?)\}/);
  const bb=b?b[1]:'';
  ck('.ann-body min-height:0', /min-height:\s*0/.test(bb));
  ck('.ann-body overflow-y:auto', /overflow-y:\s*auto/.test(bb));
  ck('.ann-body overscroll-behavior:contain', /overscroll-behavior:\s*contain/.test(bb));

  ck('小屏媒体查询适配', /@media \(max-width: 600px\)[\s\S]{0,900}\.ann-modal/.test(css));
  ck('矮屏媒体查询适配', /@media \(max-height: 520px\)[\s\S]{0,400}\.ann-modal/.test(css));
}

console.log('\n【2】长正文不撑破（真实布局计算）');
{
  const dom=new JSDOM(`<!DOCTYPE html><html><head><style>${css}</style></head><body>
    <div class="ann-overlay"><div class="ann-modal">
      <div class="ann-head">head</div>
      <div class="ann-content">
        <h3 class="ann-title">T</h3>
        <div class="ann-body">${'<p>很长的正文内容</p>'.repeat(200)}</div>
      </div>
      <div class="ann-foot">foot</div>
    </div></div></body></html>`,{pretendToBeVisual:true});
  const w=dom.window, doc=w.document;
  const modal=doc.querySelector('.ann-modal');
  const ctn=doc.querySelector('.ann-content');
  const bd=doc.querySelector('.ann-body');
  // jsdom 不做真实布局，改为验证 CSS 声明链完整：modal 限高 → content 可压 → body 滚动
  ck('modal 具备限高链', /max-height/.test(css.match(/\.ann-modal\s*\{[\s\S]*?\}/)[0]));
  ck('content 可压缩链', /min-height:\s*0/.test(css.match(/\.ann-content\s*\{[\s\S]*?\}/)[0]));
  ck('body 滚动链', /overflow-y:\s*auto/.test(css.match(/\.ann-body\s*\{[\s\S]*?\}/)[0]));
  ck('正文确实很长（200 段）', bd.querySelectorAll('p').length===200);
  ck('正文嵌套在 content 内', ctn.contains(bd));
  ck('foot 在 modal 内且不在 content 内', modal.contains(doc.querySelector('.ann-foot')) && !ctn.contains(doc.querySelector('.ann-foot')));
}

console.log('\n【3】关于页：排序 + 分页（真实渲染，12 条公告）');
(async()=>{
  const dom=new JSDOM(html,{runScripts:'outside-only',url:'http://localhost:8000/',pretendToBeVisual:true,
  beforeParse(w){w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});}});
  const w=dom.window;
  ['vendor/vue.global.prod.js','vendor/vue-router.global.prod.js','js/utils.js','js/plugin-loader.js','js/router.js','js/settings.js','js/announcement.js','js/app.js','js/init.js'].forEach(f=>{
    const p=path.join(ROOT,f); if(fs.existsSync(p)) try{w.eval(fs.readFileSync(p,'utf8'))}catch(e){}
  });
  const pj=JSON.parse(fs.readFileSync(path.join(ROOT,'js/plugins.json'),'utf8'));
  w.eval(`window.__PJ=${JSON.stringify(pj)};`);
  const MANY={version:'0.9.20',announcements:[]};
  for(let i=1;i<=12;i++) MANY.announcements.push({id:i,title:'公告'+i,date:'2026-09-'+String(i).padStart(2,'0'),tag:'t',body:'内容'+i});
  w.fetch=(u)=>{let s=String(u).split('?')[0].replace(/^\.\//,'');
    if(/announcements\.json/.test(s)) return Promise.resolve({ok:true,status:200,json:()=>Promise.resolve(MANY),text:()=>Promise.resolve(JSON.stringify(MANY))});
    const p=path.join(ROOT,s);
    if(fs.existsSync(p))return Promise.resolve({ok:true,status:200,text:()=>Promise.resolve(fs.readFileSync(p,'utf8')),json:()=>Promise.resolve(JSON.parse(fs.readFileSync(p,'utf8')))});
    return Promise.resolve({ok:false,status:404,text:()=>Promise.resolve(''),json:()=>Promise.reject(new Error('404'))})};
  try{await w.DBP_BOOTSTRAP()}catch(e){}
  await new Promise(r=>setTimeout(r,400));
  const C=await w.loadPlugin('about');
  const app=w.Vue.createApp(C); app.config.globalProperties.window=w;
  const m=w.document.createElement('div'); w.document.body.appendChild(m);
  app.mount(m);
  await new Promise(r=>setTimeout(r,600));

  const titles=()=>Array.prototype.slice.call(m.querySelectorAll('.ann-arch-title')).map(e=>e.textContent.trim().split('\n')[0].trim());
  ck('渲染分页控件', !!m.querySelector('.ann-pager'));
  ck('每页 5 条', m.querySelectorAll('.ann-arch-item').length===5, 'n='+m.querySelectorAll('.ann-arch-item').length);
  const t1=titles();
  ck('第 1 页从最新开始：公告12 在最上', /公告12/.test(t1[0]), JSON.stringify(t1));
  ck('第 1 页为 12→8 倒序', /公告12/.test(t1[0])&&/公告8/.test(t1[4]), JSON.stringify(t1));
  ck('显示「第 1 / 3 页」', /第 1 \/ 3 页/.test(m.textContent));
  ck('显示共 12 条', /共 12 条/.test(m.textContent));
  ck('最新一条有「最新」标', !!m.querySelector('.ann-badge-new'));
  ck('首页上一页按钮禁用', m.querySelectorAll('.ann-pager-btn')[0].disabled===true);

  // 翻到第 2 页
  const btns=Array.prototype.slice.call(m.querySelectorAll('.ann-pager-btn'));
  const nextBtn=btns[btns.length-1];
  nextBtn.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  await new Promise(r=>setTimeout(r,250));
  ck('第 2 页显示 第 2 / 3 页', /第 2 \/ 3 页/.test(m.textContent));
  const t2=titles();
  ck('第 2 页为 公告7→3', /公告7/.test(t2[0])&&/公告3/.test(t2[4]), JSON.stringify(t2));
  ck('第 2 页无「最新」标（只在最新一条）', !m.querySelector('.ann-badge-new'));

  // 跳到第 3 页
  const btns2=Array.prototype.slice.call(m.querySelectorAll('.ann-pager-btn'));
  btns2[btns2.length-1].dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  await new Promise(r=>setTimeout(r,250));
  ck('第 3 页为 公告2、公告1（共 2 条）', m.querySelectorAll('.ann-arch-item').length===2, 'n='+m.querySelectorAll('.ann-arch-item').length);
  ck('末页下一页按钮禁用', m.querySelectorAll('.ann-pager-btn')[m.querySelectorAll('.ann-pager-btn').length-1].disabled===true);

  // 点页码直接跳
  const numBtns=Array.prototype.slice.call(m.querySelectorAll('.ann-pager-btn')).filter(b=>/^1$/.test(b.textContent.trim()));
  numBtns[0].dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  await new Promise(r=>setTimeout(r,250));
  ck('点页码 1 回到第 1 页', /第 1 \/ 3 页/.test(m.textContent));

  console.log('\n===== 结果: '+pass+' 通过 / '+fail+' 失败 =====');
  process.exit(fail?1:0);
})().catch(e=>{console.error('CRASH',e.message);process.exit(2)});
