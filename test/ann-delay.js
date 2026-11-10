const fs=require('fs'),path=require('path');
let JSDOM; try{JSDOM=require('jsdom').JSDOM}catch(e){console.log('需要jsdom');process.exit(0)}
const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'styles/main.css'),'utf8');
const annSrc=fs.readFileSync(path.join(ROOT,'js/announcement.js'),'utf8');
let pass=0,fail=0;const ck=(n,c,e)=>{if(c)pass++;else{fail++;console.log('  ✗ '+n+' → '+(e||''))}};

console.log('【1】延迟弹出');
{
  ck('存在延迟常量 SHOW_DELAY', /SHOW_DELAY\s*=\s*\d+/.test(annSrc));
  const m=annSrc.match(/SHOW_DELAY\s*=\s*(\d+)/);
  ck('默认延迟 650ms', m && +m[1]===650, m&&m[1]);
  ck('支持 opts.delay 覆盖', /opts\.delay/.test(annSrc));
  ck('延迟使用 setTimeout 包裹', /setTimeout\(function \(\) \{ resolve\(queue\)/.test(annSrc));
}

console.log('\n【2】入场动画（CSS）');
{
  ck('overlay 淡入 annFade', /@keyframes annFade/.test(css) && /animation: annFade/.test(css));
  ck('modal 弹入 annPop', /@keyframes annPop/.test(css) && /animation: annPop/.test(css));
  ck('内容切换淡入 annContentIn', /@keyframes annContentIn/.test(css));
  ck('退场动画 annFadeOut/annPopOut', /@keyframes annFadeOut/.test(css) && /@keyframes annPopOut/.test(css));
}

console.log('\n【3】高度降低 + 居中');
{
  const m=css.match(/\.ann-modal\s*\{([\s\S]*?)\}/);
  const b=m?m[1]:'';
  ck('高度上限 62vh（原 78vh）', /max-height:\s*62vh/.test(b));
  ck('dvh 兜底 62dvh', /max-height:\s*62dvh/.test(b));
  ck('不再有 78vh', !/max-height:\s*78vh/.test(b));
  ck('modal margin:auto 居中兜底', /margin:\s*auto/.test(b));
  ck('modal align-self:center', /\.ann-modal \{\s*align-self: center/.test(css));
  const o=css.match(/\.ann-overlay\s*\{([\s\S]*?)\}/);
  const ob=o?o[1]:'';
  ck('overlay 水平居中 justify-content:center', /justify-content:\s*center/.test(ob));
  ck('overlay 垂直居中 align-items:center', /align-items:\s*center/.test(ob));
  ck('overlay 支持 safe-area', /env\(safe-area-inset/.test(ob));
  ck('小屏也居中（不再 flex-end）', !/@media \(max-width: 600px\)[\s\S]{0,200}align-items:\s*flex-end/.test(css));
}

console.log('\n【4】去掉「标记为未读」');
{
  const aboutSrc=fs.readFileSync(path.join(ROOT,'js/pages/about.js'),'utf8');
  ck('announcement.js 无 unmarkRead', !/unmarkRead/.test(annSrc));
  ck('未导出 unmarkAnnouncementRead', !/unmarkAnnouncementRead/.test(annSrc));
  ck('about.js 无 unmarkAnnouncementRead 调用', !/unmarkAnnouncementRead/.test(aboutSrc));
  ck('about.js 无 resetAnnRead', !/resetAnnRead/.test(aboutSrc));
  ck('已读按钮 disabled（不可反向）', /:disabled="isRead\(a\.id\)"/.test(aboutSrc));
  ck('toggleRead 对已读直接 return', /if \(isRead\(id\)\) return/.test(aboutSrc));
  ck('按钮文案为「标为已读」', /标为已读/.test(aboutSrc));
  ck('提示语说明已读不可撤回', /已读后不可撤回/.test(aboutSrc));
}

console.log('\n【5】iframe 颜色无缝融合');
{
  const plSrc=fs.readFileSync(path.join(ROOT,'js/plugin-loader.js'),'utf8');
  ck('iframe 元素背景透明', /\.html-plugin-iframe-naked[\s\S]{0,300}?background: transparent/.test(css));
  ck('亮色主题不再强制刷白', !/\[data-theme="light"\] \.html-plugin-iframe-naked \{ background: #fff/.test(css));
  ck('正向跟随：设置 --iframe-bg/--iframe-fg', /--iframe-bg/.test(plSrc) && /--iframe-fg/.test(plSrc));
  ck('CSS 消费 --iframe-bg（顶栏/侧边栏/主区）', /body\.iframe-theme-follow \.topbar[\s\S]{0,200}--iframe-bg/.test(css));
  ck('★ iframe 只读：无 injectThemeIntoIframe 注入', !/injectThemeIntoIframe/.test(plSrc));
  ck('★ iframe 只读：无 data-dbp-theme-sync 注入标记', !/data-dbp-theme-sync/.test(plSrc));
  ck('★ iframe 只读：不向 iframe 写 color-scheme', !/doc\.head/.test(plSrc) && !/\.head\.appendChild/.test(plSrc));
  ck('透明时回退读 html 背景', /getComputedStyle\(doc\.documentElement\)/.test(plSrc));
  ck('★ 边缘采样：elementFromPoint + 向上冒泡', /elementFromPoint/.test(plSrc) && /parentElement/.test(plSrc));
  ck('★ 分区域边缘变量 top/side', /--iframe-bg-top/.test(plSrc) && /--iframe-bg-side/.test(plSrc));
  ck('离开页面清理跟随色', /clearFollowColors/.test(plSrc) && /onBeforeUnmount\(clearFollowColors\)/.test(plSrc));
}

console.log('\n【6】真实延迟弹出行为');
(async()=>{
  const dom=new JSDOM(html,{runScripts:'outside-only',url:'http://localhost:8000/',pretendToBeVisual:true,
  beforeParse(w){w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});}});
  const w=dom.window;
  ['vendor/vue.global.prod.js','js/utils.js','js/plugin-loader.js','js/announcement.js'].forEach(f=>{
    const p=path.join(ROOT,f); if(fs.existsSync(p)) try{w.eval(fs.readFileSync(p,'utf8'))}catch(e){}
  });
  const ONE={version:'0.9.20',announcements:[{id:99,title:'延迟公告',date:'2026-09-29',tag:'测试',body:'正文'}]};
  w.fetch=(u)=>{let s=String(u).split('?')[0].replace(/^\.\//,'');
    if(/announcements\.json/.test(s)) return Promise.resolve({ok:true,status:200,json:()=>Promise.resolve(ONE),text:()=>Promise.resolve(JSON.stringify(ONE))});
    const p=path.join(ROOT,s);
    if(fs.existsSync(p))return Promise.resolve({ok:true,status:200,text:()=>Promise.resolve(fs.readFileSync(p,'utf8')),json:()=>Promise.resolve(JSON.parse(fs.readFileSync(p,'utf8')))});
    return Promise.resolve({ok:false,status:404,text:()=>Promise.resolve(''),json:()=>Promise.reject(new Error('404'))})};

  const t0=Date.now();
  const pr=w.startAnnouncement(w.Vue); // 默认延迟
  await new Promise(r=>setTimeout(r,150));
  ck('150ms 时还未弹出（延迟生效）', w.document.querySelectorAll('.ann-modal').length===0);
  await pr;
  const dt=Date.now()-t0;
  ck('最终成功弹出', w.document.querySelectorAll('.ann-modal').length===1);
  ck('实际延迟 ≥ 500ms（实测 '+dt+'ms）', dt>=500, 'dt='+dt);
  ck('弹窗带动画类结构（overlay+modal）', !!w.document.querySelector('.ann-overlay') && !!w.document.querySelector('.ann-modal'));

  console.log('\n===== 结果: '+pass+' 通过 / '+fail+' 失败 =====');
  process.exit(fail?1:0);
})().catch(e=>{console.error('CRASH',e.message);process.exit(2)});
