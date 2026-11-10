/* ========================================
   DBP-HUB · FA 图标速查 v0.9.20
   演示 definePlugin 最简写法（一行注册）
   ======================================== */
definePlugin('icons', {
  template: `
    <div class="page-plugin">
      <div class="section-title">
        <span class="st-label"><i class="fas fa-icons" style="color:var(--accent);margin-right:6px;"></i>FA 图标速查</span>
      </div>
      <p class="section-desc">点击任意图标即可复制类名（如 <code>fas fa-cube</code>）</p>
      <div class="toolbar">
        <i class="fas fa-search" style="color:var(--text-muted);"></i>
        <input class="form-input" style="max-width:320px;" v-model="kw" placeholder="搜索（如 cube / user / bug）...">
        <select class="form-select" style="max-width:160px;" v-model="cat">
          <option value="">全部分类</option>
          <option v-for="c in cats" :value="c">{{ c }}</option>
        </select>
      </div>
      <div class="grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px;">
        <div v-for="ic in filtered" :key="ic.c" class="icon-cell" @click="copy(ic.c)" :title="ic.c">
          <i :class="ic.c"></i>
          <span>{{ ic.n }}</span>
        </div>
      </div>
      <p v-if="!filtered.length" class="empty-state">没有匹配的图标</p>
    </div>
  `,
  setup: function () {
    var Vue = window.Vue;
    var ref = Vue.ref, computed = Vue.computed;
    var kw = ref('');
    var cat = ref('');

    // 图标数据库（name, class, category）
    var icons = [
      // 通用
      {n:'home',c:'fas fa-house',cat:'通用'},{n:'user',c:'fas fa-user',cat:'通用'},{n:'users',c:'fas fa-users',cat:'通用'},
      {n:'gear',c:'fas fa-gear',cat:'通用'},{n:'gears',c:'fas fa-gears',cat:'通用'},{n:'sliders',c:'fas fa-sliders',cat:'通用'},
      {n:'wrench',c:'fas fa-wrench',cat:'通用'},{n:'tools',c:'fas fa-tools',cat:'通用'},{n:'bell',c:'fas fa-bell',cat:'通用'},
      {n:'star',c:'fas fa-star',cat:'通用'},{n:'heart',c:'fas fa-heart',cat:'通用'},{n:'bookmark',c:'fas fa-bookmark',cat:'通用'},
      {n:'flag',c:'fas fa-flag',cat:'通用'},{n:'tag',c:'fas fa-tag',cat:'通用'},{n:'link',c:'fas fa-link',cat:'通用'},
      {n:'bolt',c:'fas fa-bolt',cat:'通用'},{n:'fire',c:'fas fa-fire',cat:'通用'},{n:'moon',c:'fas fa-moon',cat:'通用'},
      {n:'sun',c:'fas fa-sun',cat:'通用'},{n:'eye',c:'fas fa-eye',cat:'通用'},{n:'lock',c:'fas fa-lock',cat:'通用'},
      {n:'key',c:'fas fa-key',cat:'通用'},{n:'shield',c:'fas fa-shield-halved',cat:'通用'},{n:'globe',c:'fas fa-globe',cat:'通用'},
      {n:'clock',c:'fas fa-clock',cat:'通用'},{n:'calendar',c:'fas fa-calendar',cat:'通用'},{n:'trash',c:'fas fa-trash',cat:'通用'},
      {n:'plus',c:'fas fa-plus',cat:'通用'},{n:'minus',c:'fas fa-minus',cat:'通用'},{n:'check',c:'fas fa-check',cat:'通用'},
      {n:'xmark',c:'fas fa-xmark',cat:'通用'},{n:'arrow-up',c:'fas fa-arrow-up',cat:'通用'},{n:'arrow-down',c:'fas fa-arrow-down',cat:'通用'},
      {n:'arrow-left',c:'fas fa-arrow-left',cat:'通用'},{n:'arrow-right',c:'fas fa-arrow-right',cat:'通用'},{n:'bars',c:'fas fa-bars',cat:'通用'},
      {n:'filter',c:'fas fa-filter',cat:'通用'},{n:'search',c:'fas fa-search',cat:'通用'},{n:'download',c:'fas fa-download',cat:'通用'},
      {n:'upload',c:'fas fa-upload',cat:'通用'},{n:'cloud',c:'fas fa-cloud',cat:'通用'},{n:'envelope',c:'fas fa-envelope',cat:'通用'},
      {n:'inbox',c:'fas fa-inbox',cat:'通用'},{n:'comment',c:'fas fa-comment',cat:'通用'},{n:'comments',c:'fas fa-comments',cat:'通用'},
      {n:'question',c:'fas fa-question',cat:'通用'},{n:'info',c:'fas fa-circle-info',cat:'通用'},{n:'exclamation',c:'fas fa-triangle-exclamation',cat:'状态'},
      {n:'ban',c:'fas fa-ban',cat:'状态'},{n:'bug',c:'fas fa-bug',cat:'状态'},{n:'lightbulb',c:'fas fa-lightbulb',cat:'状态'},
      {n:'thumbs-up',c:'fas fa-thumbs-up',cat:'状态'},{n:'spinner',c:'fas fa-spinner',cat:'状态'},
      // 文件
      {n:'file',c:'fas fa-file',cat:'文件'},{n:'file-text',c:'fas fa-file-lines',cat:'文件'},{n:'file-code',c:'fas fa-file-code',cat:'文件'},
      {n:'file-image',c:'fas fa-file-image',cat:'文件'},{n:'file-pdf',c:'fas fa-file-pdf',cat:'文件'},{n:'folder',c:'fas fa-folder',cat:'文件'},
      {n:'folder-open',c:'fas fa-folder-open',cat:'文件'},{n:'folder-plus',c:'fas fa-folder-plus',cat:'文件'},{n:'archive',c:'fas fa-box-archive',cat:'文件'},
      // 编辑
      {n:'pen',c:'fas fa-pen',cat:'编辑'},{n:'eraser',c:'fas fa-eraser',cat:'编辑'},{n:'paintbrush',c:'fas fa-paint-brush',cat:'编辑'},
      {n:'copy',c:'fas fa-copy',cat:'编辑'},{n:'paste',c:'fas fa-paste',cat:'编辑'},{n:'cut',c:'fas fa-scissors',cat:'编辑'},
      {n:'bold',c:'fas fa-bold',cat:'编辑'},{n:'italic',c:'fas fa-italic',cat:'编辑'},{n:'list-ol',c:'fas fa-list-ol',cat:'编辑'},
      {n:'list-ul',c:'fas fa-list-ul',cat:'编辑'},{n:'align-left',c:'fas fa-align-left',cat:'编辑'},{n:'align-center',c:'fas fa-align-center',cat:'编辑'},
      // 媒体
      {n:'play',c:'fas fa-play',cat:'媒体'},{n:'pause',c:'fas fa-pause',cat:'媒体'},{n:'stop',c:'fas fa-stop',cat:'媒体'},
      {n:'music',c:'fas fa-music',cat:'媒体'},{n:'headphones',c:'fas fa-headphones',cat:'媒体'},{n:'microphone',c:'fas fa-microphone',cat:'媒体'},
      {n:'camera',c:'fas fa-camera',cat:'媒体'},{n:'image',c:'fas fa-image',cat:'媒体'},{n:'video',c:'fas fa-video',cat:'媒体'},
      {n:'film',c:'fas fa-film',cat:'媒体'},{n:'tv',c:'fas fa-tv',cat:'媒体'},{n:'volume',c:'fas fa-volume-high',cat:'媒体'},
      // 游戏 / Minecraft
      {n:'cube',c:'fas fa-cube',cat:'游戏'},{n:'cubes',c:'fas fa-cubes',cat:'游戏'},{n:'gem',c:'fas fa-gem',cat:'游戏'},
      {n:'mountain',c:'fas fa-mountain',cat:'游戏'},{n:'tree',c:'fas fa-tree',cat:'游戏'},{n:'leaf',c:'fas fa-leaf',cat:'游戏'},
      {n:'seedling',c:'fas fa-seedling',cat:'游戏'},{n:'flask',c:'fas fa-flask',cat:'游戏'},{n:'apple',c:'fas fa-apple-whole',cat:'游戏'},
      {n:'carrot',c:'fas fa-carrot',cat:'游戏'},{n:'wheat',c:'fas fa-wheat-alt',cat:'游戏'},{n:'fish',c:'fas fa-fish',cat:'游戏'},
      {n:'horse',c:'fas fa-horse',cat:'游戏'},{n:'pig',c:'fas fa-piggy-bank',cat:'游戏'},{n:'bone',c:'fas fa-bone',cat:'游戏'},
      {n:'skull',c:'fas fa-skull',cat:'游戏'},{n:'ghost',c:'fas fa-ghost',cat:'游戏'},{n:'dragon',c:'fas fa-dragon',cat:'游戏'},
      {n:'wand',c:'fas fa-wand-magic',cat:'游戏'},{n:'bomb',c:'fas fa-bomb',cat:'游戏'},{n:'axe',c:'fas fa-axe',cat:'游戏'},
      {n:'hammer',c:'fas fa-hammer',cat:'游戏'},{n:'bow',c:'fas fa-bow-arrow',cat:'游戏'},{n:'helmet',c:'fas fa-helmet-safety',cat:'游戏'},
      {n:'ring',c:'fas fa-ring',cat:'游戏'},{n:'chest',c:'fas fa-box',cat:'游戏'},{n:'door',c:'fas fa-door-closed',cat:'游戏'},
      {n:'map',c:'fas fa-map',cat:'游戏'},{n:'compass',c:'fas fa-compass',cat:'游戏'},{n:'book',c:'fas fa-book',cat:'游戏'},
      {n:'scroll',c:'fas fa-scroll',cat:'游戏'},{n:'feather',c:'fas fa-feather',cat:'游戏'},{n:'hourglass',c:'fas fa-hourglass-half',cat:'游戏'},
      // 开发
      {n:'code',c:'fas fa-code',cat:'开发'},{n:'terminal',c:'fas fa-terminal',cat:'开发'},{n:'database',c:'fas fa-database',cat:'开发'},
      {n:'server',c:'fas fa-server',cat:'开发'},{n:'desktop',c:'fas fa-desktop',cat:'开发'},{n:'laptop',c:'fas fa-laptop',cat:'开发'},
      {n:'mobile',c:'fas fa-mobile',cat:'开发'},{n:'plug',c:'fas fa-plug',cat:'开发'},{n:'puzzle',c:'fas fa-puzzle-piece',cat:'开发'},
      {n:'brackets',c:'fas fa-brackets-curly',cat:'开发'},{n:'html5',c:'fab fa-html5',cat:'开发'},{n:'css3',c:'fab fa-css3-alt',cat:'开发'},
      {n:'js',c:'fab fa-js-square',cat:'开发'},{n:'vue',c:'fab fa-vuejs',cat:'开发'},{n:'npm',c:'fab fa-npm',cat:'开发'},
      {n:'branch',c:'fas fa-code-branch',cat:'开发'},{n:'commit',c:'fas fa-code-commit',cat:'开发'},{n:'merge',c:'fas fa-code-merge',cat:'开发'},
    ];

    var cats = computed(function () {
      var set = {};
      icons.forEach(function (i) { set[i.cat] = 1; });
      return Object.keys(set);
    });

    var filtered = computed(function () {
      var q = (kw.value || '').toLowerCase().trim();
      return icons.filter(function (i) {
        var ok = !q || i.n.indexOf(q) !== -1 || i.c.indexOf(q) !== -1;
        return ok && (!cat.value || i.cat === cat.value);
      });
    });

    function copy(cls) {
      if (window.copyText) window.copyText(cls);
    }

    return { kw: kw, cat: cat, cats: cats, filtered: filtered, copy: copy };
  },
}, { title: 'FA 图标速查', icon: 'fas fa-icons', version: '0.1.0' });
