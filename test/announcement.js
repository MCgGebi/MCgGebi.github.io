const fs=require('fs'),path=require('path');
let JSDOM; try{JSDOM=require('jsdom').JSDOM}catch(e){console.log('需要jsdom');process.exit(0)}
const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
let pass=0,fail=0;const ck=(n,c,e)=>{if(c)pass++;else{fail++;console.log('  ✗ '+n+' → '+(e||''))}};

function makeDom(){
  const dom=new JSDOM(html,{runScripts:'outside-only',url:'http://localhost:8000/',pretendToBeVisual:true,
  beforeParse(w){
    w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
    w.addEventListener('error',()=>{});
  }});
  return dom;
}
function stubFetch(w, annOverride){
  w.fetch=(u)=>{
    let s=String(u).split('?')[0].replace(/^\.\//,'');
    if(annOverride && /announcements\.json/.test(s))
      return Promise.resolve({ok:true,status:200,json:()=>Promise.resolve(annOverride),text:()=>Promise.resolve(JSON.stringify(annOverride))});
    const p=path.join(ROOT,s);
    if(fs.existsSync(p))return Promise.resolve({ok:true,status:200,text:()=>Promise.resolve(fs.readFileSync(p,'utf8')),json:()=>Promise.resolve(JSON.parse(fs.readFileSync(p,'utf8')))});
    return Promise.resolve({ok:false,status:404,text:()=>Promise.resolve(''),json:()=>Promise.reject(new Error('404'))});
  };
}
const THREE={
  version:'0.9.20',
  announcements:[
    {id:1,title:'公告一',subtitle:'副一',date:'2026-09-01',tag:'更新',body:'**一** 内容'},
    {id:2,title:'公告二',subtitle:'副二',date:'2026-09-02',tag:'特性',body:'**二** 内容'},
    {id:3,title:'公告三',subtitle:'副三',date:'2026-09-03',tag:'修复',body:'**三** 内容'}
  ]
};

(async()=>{
console.log('【1】三条未读 → 一次弹窗承载队列');
{
  const dom=makeDom(), w=dom.window;
  ['vendor/vue.global.prod.js','js/utils.js','js/plugin-loader.js','js/announcement.js'].forEach(f=>{
    const p=path.join(ROOT,f); if(fs.existsSync(p)) try{w.eval(fs.readFileSync(p,'utf8'))}catch(e){}
  });
  stubFetch(w,THREE);
  const ok=await w.startAnnouncement(w.Vue,{delay:0});
  await new Promise(r=>setTimeout(r,350));
  const doc=w.document;
  ck('startAnnouncement 返回 true',ok===true);
  ck('只创建了 1 个弹窗容器',doc.querySelectorAll('.ann-host').length===1,'h='+doc.querySelectorAll('.ann-host').length);
  ck('页面上只有 1 个 .ann-modal',doc.querySelectorAll('.ann-modal').length===1,'m='+doc.querySelectorAll('.ann-modal').length);
  ck('显示进度「第 1 / 3 条」',/第 1 \/ 3 条/.test(doc.body.textContent));
  ck('首条为最新（公告三）',/公告三/.test(doc.querySelector('.ann-title').textContent),doc.querySelector('.ann-title').textContent);
  ck('渲染导航区 .ann-nav',!!doc.querySelector('.ann-nav'));
  ck('渲染 3 个进度点',doc.querySelectorAll('.ann-dot').length===3,'d='+doc.querySelectorAll('.ann-dot').length);
  ck('存在「全部已读」按钮',/全部已读/.test(doc.body.textContent));
  ck('主按钮显示「下一条」',/下一条/.test(doc.querySelector('.ann-foot .btn').textContent),doc.querySelector('.ann-foot .btn').textContent);

  console.log('【2】点「下一条」→ 切换内容（不叠加弹窗）');
  doc.querySelector('.ann-foot .btn').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  await new Promise(r=>setTimeout(r,200));
  ck('仍只有 1 个弹窗',doc.querySelectorAll('.ann-modal').length===1);
  ck('进度变为 第 2 / 3 条',/第 2 \/ 3 条/.test(doc.body.textContent));
  ck('内容切换为「公告二」',/公告二/.test(doc.querySelector('.ann-title').textContent));
  ck('第 1 条已写为已读',(w.getReadAnnouncementIds()||[]).indexOf(3)>=0,JSON.stringify(w.getReadAnnouncementIds()));

  console.log('【3】导航按钮 上一条 / 下一条');
  const navs=doc.querySelectorAll('.ann-nav-btn');
  ck('导航按钮 2 个',navs.length===2);
  navs[0].dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  await new Promise(r=>setTimeout(r,180));
  ck('点左箭头回到第 1 条',/第 1 \/ 3 条/.test(doc.body.textContent));
  ck('上一条在第 1 条时禁用',doc.querySelectorAll('.ann-nav-btn')[0].disabled===true);

  console.log('【4】「不再显示」= 标记已读并前进');
  doc.querySelector('.ann-never').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  await new Promise(r=>setTimeout(r,200));
  ck('前进到第 2 条',/第 2 \/ 3 条/.test(doc.body.textContent));
  ck('弹窗未被销毁（还在队列中）',doc.querySelectorAll('.ann-modal').length===1);

  console.log('【5】「全部已读」→ 一次关闭，不再弹后续');
  const allBtn=Array.prototype.slice.call(doc.querySelectorAll('.ann-all'))[0];
  allBtn.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  await new Promise(r=>setTimeout(r,400));
  const ids=w.getReadAnnouncementIds()||[];
  ck('三条全部写入已读',[1,2,3].every(i=>ids.indexOf(i)>=0),JSON.stringify(ids));
  ck('弹窗已销毁',doc.querySelectorAll('.ann-modal').length===0,'m='+doc.querySelectorAll('.ann-modal').length);
  ck('host 容器已移除',doc.querySelectorAll('.ann-host').length===0);

  console.log('【6】全部已读后再次 start 不再弹');
  const again=await w.startAnnouncement(w.Vue,{delay:0});
  await new Promise(r=>setTimeout(r,250));
  ck('再次调用返回 false',again===false);
  ck('没有新弹窗',doc.querySelectorAll('.ann-modal').length===0);
}

console.log('\n【7】并发调用不会叠加多个弹窗');
{
  const dom=makeDom(), w=dom.window;
  ['vendor/vue.global.prod.js','js/utils.js','js/plugin-loader.js','js/announcement.js'].forEach(f=>{
    const p=path.join(ROOT,f); if(fs.existsSync(p)) try{w.eval(fs.readFileSync(p,'utf8'))}catch(e){}
  });
  stubFetch(w,THREE);
  const rs=await Promise.all([w.startAnnouncement(w.Vue,{delay:0}),w.startAnnouncement(w.Vue,{delay:0}),w.startAnnouncement(w.Vue,{delay:0})]);
  await new Promise(r=>setTimeout(r,400));
  ck('并发三次只成功一次',rs.filter(Boolean).length===1,JSON.stringify(rs));
  ck('DOM 中仅 1 个弹窗',w.document.querySelectorAll('.ann-modal').length===1,'m='+w.document.querySelectorAll('.ann-modal').length);
  ck('DOM 中仅 1 个 host',w.document.querySelectorAll('.ann-host').length===1);
}

console.log('\n【8】关闭动画：先播动画再销毁');
{
  const dom=makeDom(), w=dom.window;
  ['vendor/vue.global.prod.js','js/utils.js','js/plugin-loader.js','js/announcement.js'].forEach(f=>{
    const p=path.join(ROOT,f); if(fs.existsSync(p)) try{w.eval(fs.readFileSync(p,'utf8'))}catch(e){}
  });
  stubFetch(w,THREE);
  await w.startAnnouncement(w.Vue,{delay:0});
  await new Promise(r=>setTimeout(r,300));
  const doc=w.document;
  const modal=doc.querySelector('.ann-modal');
  modal.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  doc.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  await new Promise(r=>setTimeout(r,60));
  ck('关闭瞬间 modal 仍在（动画进行中）',doc.querySelectorAll('.ann-modal').length===1);
  ck('已加上 is-closing 类',!!doc.querySelector('.ann-modal.is-closing'));
  await new Promise(r=>setTimeout(r,400));
  ck('动画结束后已销毁',doc.querySelectorAll('.ann-modal').length===0);
}

console.log('\n【9】关于页：已读 / 未读 切换');
{
  const dom=makeDom(), w=dom.window;
  ['vendor/vue.global.prod.js','vendor/vue-router.global.prod.js','js/utils.js','js/plugin-loader.js','js/router.js','js/settings.js','js/announcement.js','js/app.js','js/init.js'].forEach(f=>{
    const p=path.join(ROOT,f); if(fs.existsSync(p)) try{w.eval(fs.readFileSync(p,'utf8'))}catch(e){}
  });
  const pj=JSON.parse(fs.readFileSync(path.join(ROOT,'js/plugins.json'),'utf8'));
  w.eval(`window.__PJ=${JSON.stringify(pj)};`);
  stubFetch(w,THREE);
  try{await w.DBP_BOOTSTRAP()}catch(e){}
  await new Promise(r=>setTimeout(r,400));
  const C=await w.loadPlugin('about');
  const app=w.Vue.createApp(C);
  app.config.globalProperties.window=w;
  const m=w.document.createElement('div'); w.document.body.appendChild(m);
  app.mount(m);
  await new Promise(r=>setTimeout(r,500));
  const toggles=m.querySelectorAll('.ann-read-toggle');
  ck('渲染已读切换按钮',toggles.length===3,'t='+toggles.length);
  ck('初始全部为「标为已读」',Array.prototype.slice.call(toggles).every(b=>/标为已读/.test(b.textContent)));
  toggles[0].dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  await new Promise(r=>setTimeout(r,200));
  ck('点击后变为「已读」',/已读/.test(m.querySelectorAll('.ann-read-toggle')[0].textContent));
  ck('已写入 localStorage',(w.getReadAnnouncementIds()||[]).length>0);
  const t2=m.querySelectorAll('.ann-read-toggle')[0];
  ck('已读后按钮被禁用（不可反向标未读）',t2.disabled===true);
  t2.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  await new Promise(r=>setTimeout(r,200));
  ck('再次点击仍为「已读」（不回退）',/已读/.test(m.querySelectorAll('.ann-read-toggle')[0].textContent));
  ck('localStorage 仍保留该条',(w.getReadAnnouncementIds()||[]).length>0);
}

console.log('\n===== 结果: '+pass+' 通过 / '+fail+' 失败 =====');
process.exit(fail?1:0)})().catch(e=>{console.error('CRASH',e.message,e.stack&&e.stack.slice(0,300));process.exit(2)});
