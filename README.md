# DBP-HUB · 方块工具站

纯静态、零运行时依赖的单页站点。插件按需懒加载，支持 JS / HTML（iframe 与 inline 双模式）/ Markdown / 外链（URL）四种注册方式；亮色 / 暗色 / 跟随系统三模主题、自定义主题色、框架内置设置页、公告系统与沉浸式 404。

---

## 功能一览

| 模块 | 说明 |
|---|---|
| **首页** | 方块世界叙事版 Hero、全局搜索（`/` 聚焦）、工具矩阵（树形 / 网格双视图） |
| **插件系统** | 四种类型、无限层级分类、懒加载；编辑器支持拖拽排序、拖出文件夹 |
| **主题** | 亮 / 暗 / 跟随系统（默认跟随系统），8 个 MC 预设色 + 自由取色，顶栏菜单与设置页双向同步 |
| **设置页** | 框架内置，`#/settings`，右上角 ⋮ → 系统 → 设置；含外观、错误日志、数据与缓存、关于 |
| **公告** | 启动后延迟弹出，多公告队列翻页、不再显示（单向）、关于页按 ID 倒序归档 + 每页 5 条分页 |
| **404** | 沉浸式（全屏壁纸、液态玻璃顶栏/侧栏、一言、帮助窗）或极简旧版，设置页可切换 |
| **彩蛋** | 右上角 ⋮ → 系统 →「千万别点」，事件表驱动，点击才加载、每个事件独立持续时间 |
| **错误面板** | 常驻面板 + 设置页日志持久化（最近 20 条，历史记录不触发弹窗） |

---

## 本地运行

```bash
cd dbp-hub
python3 -m http.server 8000
# 或 npm start
```

打开 `http://localhost:8000`。**运行站点不需要安装任何依赖**，`npm install` 只为跑测试（jsdom）。

> 请用本地服务器打开。`file://` 直接双击时 `fetch` 读不到 JSON，编辑器会用「导入 JSON」兜底。

---

## 独立页面

这几个页面**不在菜单、不在路由、站内没有任何入口**，需手动输入地址访问：

| 地址 | 用途 |
|---|---|
| `plugin-editor.html` | 插件编辑器，编辑完导出 `plugins.json` 覆盖原文件即可生效 |
| `announcement-editor.html` | 公告编辑器，支持列表 / 分栏预览 / 弹窗预览 / 草稿，下载 `announcements.json` 覆盖原文件 |
| `404.html` | 独立单文件 404，同款壁纸效果，未注册进主页 |

---

## 配置与扩展

**插件注册** — `js/plugins.json`
四种类型：`js` / `html`（含 `mode: iframe | inline`）/ `markdown` / `url`。外链类型只跳转，不加载文件、不建路由。字段说明见 `插件开发文档.md`。

**彩蛋事件** — `js/easter-eggs.json`
每个事件含数字 `id`、`name`、`type` 与 `duration`：

| duration | 含义 |
|---|---|
| `-1` | 效果持续存在，不自动恢复 |
| `0` | 禁用，随机时不会抽到 |
| `> 0` | 该毫秒数后自动清除 |

新增效果类型需在 `js/easter-egg.js` 的 `handlers` 里加同名函数，通过 `sc.css()` / `sc.el` / `sc.onClean()` 挂资源，保证到期能独立清理。

**公告** — `js/announcements.json`
按 `id` 降序展示；新增更大的 ID 即视为新公告，下次启动会弹出。正文支持 Markdown。「已读」为单向操作，不可撤回。

**主题与玻璃** — 设置页
- 404 页面样式：沉浸式 / 极简
- 404 玻璃透明度（5%~80%，数值越小越通透）
- 404 玻璃模糊度（0~40px）
- 点「恢复默认」后不再写内联变量，此时手写 `styles/main.css` 的兜底值才会生效

**缓存戳** — `index.html` 资源带 `?v=0.9.32`。改动后升这个号（或强刷），否则浏览器会吃旧缓存。

---

## 错误与 404 行为

| 场景 | 处理 |
|---|---|
| 插件**入口文件**加载返回 404 | 直接显示内置 404 页面，不进错误总线、不弹错误窗 |
| 插件内部资源加载失败 | 按普通 `phase:resource` 错误上报，不跳整页 404 |
| 其它错误（500、渲染异常、启动故障等） | 常驻错误面板 + 写入日志，历史记录不会触发弹窗 |
| 404 页面壁纸加载失败 | 静默重试最多 3 次（每次重新取 JSON 换图），全失败用本地 `assets/hero-bg.webp`；不弹窗、不记录 |

**两个 404 别搞混**：站内任意不存在的 `#/路由` 由主页 catch-all 渲染内置 404（沉浸式/极简按设置项）；直接访问服务器上不存在的静态路径，则由服务器返回根目录的 `404.html`。

---

## 目录速览

```
index.html                  入口（全相对路径）
404.html                    独立单文件 404
plugin-editor.html          独立插件编辑器
announcement-editor.html    独立公告编辑器
js/
  plugins.json              菜单与插件注册表
  plugin-loader.js          四种类型的懒加载与错误总线
  router.js / app.js        hash 路由 + 顶栏/侧栏
  notfound.js               内置沉浸式 404
  settings.js               框架内置设置页
  announcement.js           公告系统（announcements.json 配置）
  easter-egg.js             彩蛋引擎（easter-eggs.json 注册事件）
  pages/                    JS 插件
plugins/                     HTML / Markdown 插件源文件
assets/                      hero-bg.webp + 本地字体
styles/main.css              主题、404 玻璃、响应式
vendor/                      Vue / VueRouter / Font Awesome（全本地）
test/                        验证脚本（仅开发用，不参与运行）
```

---

## 测试

```bash
npm install     # 仅安装 jsdom
npm test        # 全量套件
```

也可单独跑：`npm run verify` / `npm run settings` / `npm run egg` 等，脚本清单见 `package.json`。

开发文档见 `插件开发文档.md`。
