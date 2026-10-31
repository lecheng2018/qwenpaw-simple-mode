# 🧘 简洁模式 (Simple Mode)

QwenPaw Console 的**纯前端外观插件**。不改动 Console 任何源码，通过注入一张样式表收敛散乱的按钮与布局。

## 为什么需要它

对 QwenPaw `v2.3.0-beta.1` 的源码勘查结论：

| 症状 | 实测根因 |
|---|---|
| 标题栏按钮挤成两三行 | `PageHeader.extra` 移动端只有 `flex-wrap: wrap`，**没有任何收纳机制** |
| 按钮到处散落 | 全站 499 个按钮，26% 的页面散落在 **4 种以上**容器层级（最高 7 种） |
| 表格横向溢出 | `Sessions` 表 8 列固定宽合计 **1360px**，该页 `.less` **没有 768 断点** |
| iPhone 输入框被 Home Indicator 压住 | Chat Composer **缺少 `env(safe-area-inset-bottom)`** |
| 各页断点不一致 | 全前端并存 **13 个宽度断点**（480/500/520/600/640/720/768/900/960/1000/1024/1025/1050） |

## 简洁模式做了什么

1. **标题栏动作区收敛** — 改为单行横向滚动条，不再换行堆叠
2. **统一断点语义** — 定义 `--sm-bp/--md-bp/--lg-bp/--xl-bp`（480/768/1024/1280）四档
3. **触控目标强化** — 粗指针设备上强制 40–44px 命中区（复用已有的 `--app-hit-touch`）
4. **Composer 安全区** — 补上 `env(safe-area-inset-bottom)`
5. **Composer 按钮行重排**（v0.1.1 新增）— 窄屏下把动作区从「挤在输入框右端、中间大片空白」改成**输入框与按钮各占一行、按钮铺满整行**，项目目录与审批模式折叠为 44px 图标
6. **密度统一** — 标题栏内距 14px、面包屑 19px、工具组零间隙
7. **表格防溢出** — 宽表横向滚动 + 移动端圆角收敛
8. **减弱动效** — 遵循 `prefers-reduced-motion`

## 使用

- **开关**：聊天页右上角出现一个圆点按钮（● 开启 / ○ 关闭），点击切换
- **作用范围**：默认全局；可在浏览器控制台调用 `window.QwenPaw.simpleMode.setScope("mobile")` 限定仅窄屏生效
- **状态持久化**：`localStorage` 的 `qwenpaw.simpleMode.settings`

### 控制台 API

```js
window.QwenPaw.simpleMode.enable()      // 开启
window.QwenPaw.simpleMode.disable()     // 关闭
window.QwenPaw.simpleMode.toggle()      // 切换
window.QwenPaw.simpleMode.isEnabled()   // 查询
window.QwenPaw.simpleMode.setScope("mobile" | "global")
window.QwenPaw.simpleMode.getSettings()
```

## 移动端 Composer 的具体问题

在 390px 的 iPhone 视口下，Chat 输入框底部那一行原本是：

```
[附件][麦克风]              [项目目录 default][智能模式][警告][发送]
        ↑ 这中间是一大片空白，看起来像按钮被吃掉
```

原因（源码实测）：

- `[class$="-sender-actions-list"]` 是 `flex-wrap: nowrap` + `max-width: 100%`
- 项目目录控件是 `flex: 1 1 150px`，会预留 150px 宽度
- 审批模式是带文字标签的下拉

结果动作区被推到输入框最右端，左侧只剩两个按钮，中间形成一条空带。

简洁模式在窄屏下把动作区改成**独占一行、铺满宽度**（`flex-direction: column`），
并把两个带文字的控件折叠成 44px 图标（`font-size: 0` + 固定宽度），
发送按钮仍用 `margin-left: auto` 贴右。

实测（Playwright，iPhone 14 / 390×844）：

| | 修复前 | 修复后 |
|:--|:--|:--|
| 容器 flex-direction | row | **column** |
| 动作区 x 范围 | 234–374（挤在右端） | **72–374（铺满整行）** |
| 项目目录按钮宽度 | 185px（含文字） | **44px（图标）** |
| 审批模式按钮宽度 | 112px（含文字） | **44px（图标）** |
| 视口溢出 | 按钮被挤出 | **无溢出** |

## 实现要点

Console 使用 CSS Modules，`generateScopedName: "[name]__[local]__[hash]"`（构建产物实际为
`[name]-module__[local]__[hash]`）。**hash 只在末尾**，因此局部名稳定，插件统一用属性包含匹配：

```css
[data-page-header] [class*="-module__extra__"] { ... }
```

这与 Console 自身的写法一致（官方 CSS 里就有 `.index-module__pageHeader__huiqN>[class*=extra]`）。

**绝不引用具体 hash**，因此 Console 升级后选择器依然有效。

## 安装

插件目录：`~/.qwenpaw/plugins/simple-mode/`

```
simple-mode/
├── plugin.json      # type: frontend
└── ui/index.js      # 入口（Blob URL 动态加载）
```

安装后需**重启 QwenPaw**（插件在 Console 启动时扫描加载）。

## 兼容性

- 要求 QwenPaw >= 2.0.0
- 纯前端，无后端、无网络请求、不收集任何数据
- 关闭模式即移除 `html.simple-mode` class，样式完全还原
