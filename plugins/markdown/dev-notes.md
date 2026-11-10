# DBP-HUB 开发笔记

## 架构概览
- **单页应用**：Vue 3 + Vue Router（hash 模式）
- **插件系统**：三种格式（JS / HTML / Markdown），全部懒加载
- **主题系统**：暗色（默认）/ 亮色 / 跟随系统

## 核心文件
| 文件 | 职责 |
|---|---|
| `index.html` | 入口，加载核心 JS + 早期主题脚本 |
| `js/plugin-loader.js` | 插件注册表 + 懒加载 + Markdown 解析器 |
| `js/router.js` | 从插件元数据构建路由，beforeEnter 中加载 |
| `js/app.js` | Vue 根组件 + 侧边栏 + 主题切换 |
| `js/utils.js` | 模态框 / 确认框 / 折叠卡片工具 |
| `js/init.js` | 启动流程 + 进度条 + 错误面板 |
| `js/plugins.json` | 插件注册表（分类树） |

## 版本号规则
- **主版本**（`APP_VERSION`）：框架整体版本，控制核心文件
- **插件版本**（`version` 字段）：每个插件独立版本号
- 修改框架 → 主版本 +0.0.1
- 修改插件 → 该插件 version +0.0.1

## 已知限制
- iframe 插件无法访问 Vue 响应式数据
- Markdown 解析器不支持嵌套表格
- 编辑器无法直写磁盘（浏览器安全限制）

## 发布日期
2026-08-14
