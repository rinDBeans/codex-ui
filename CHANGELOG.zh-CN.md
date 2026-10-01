# 更新日志

[English](CHANGELOG.md)

## 0.7.2 - 2026-10-01

一轮设计系统审查，覆盖输入区、侧栏、右栏、外观控件与命令面。收尾时 `npm run check` 为 **86** 项，
`npm run verify` 为 **358** 项断言（外部独立审查后由 360 减到 358：删掉 3 条测死 CSS 的自证判据，
新增 1 条测真实宿主锚点的判据 —— 数字减少是诚实减少）；下面引用的每个数字、
以及 README 夹具表里的每一行，都取自本机真实运行，不是手工维护的清单。

### ⓪ 独立审查回查：6 处死 CSS、1 处护栏空洞、4 条自证判据

外部审查报告逐条回宿主 bundle 核对后报出问题，本节全部经本机复现与反向验证后处理。

**6 处死 CSS**（皮肤里永不命中的规则）——

- `content.css` 的 `[data-tone="warn"]`：宿主 `ToolDetails.badge` 的 tone 枚举是
  `info/neutral/success/warning/error`，**没有 `warn`**，警告徽标一直吃不到警告色。已改为 `warning`。
  注意令牌名仍是 `--dsw-alias-state-warn-*`（宿主 7 处，`-warning-` 0 处），属性值与令牌名**不可一起改**。
- `[data-turn-process-chevron]`（2 处）、`[data-turn-process-body]`（2 处）：宿主
  `dsh-client-ui-chat` 实际产出的只有 `-answer / -hidden / -inline / -member / -messages / -subagents / -tool-calls`。已删。
- `[data-turn-process][data-expanded="false"]`：宿主是 `expanded || void 0` 的**属性缺席**语义
  （其自身 CSS 用 `:not([data-expanded])`），`="false"` 永不出现。已删。
- `patches.css` 的 `[data-slot="web-ui.plugin.item"]`：全宿主 1043 个 js/css 文件 0 命中。已删。
- `model-picker.css` 的 `[data-disabled="true"]`：`src/` 与宿主均无写入点。已删。

**护栏空洞**：`check.mjs` 9b 计算出 `proposals` 变量却只用在返回字符串里，从未进入 `assert` ——
注释宣称的「必须在 docs/ 里有对应提案」在代码里是空的。已补真实断言：提案数 > 0、
排除项与提案文件一一对应、孤儿提案反向报出；「有断言」改为检测非注释行里的真实调用点。
`verify.mjs` 汇总末尾现在会打印「本次未计入汇总的排除项」，让排除这件事本身留痕。
两次反向验证：删除提案文档、把 4 个 `t.check(` 改名，均如期报红。

**4 条自证判据**（判据自身有 bug，比不严更危险）——

- `content.mjs` 的夹具手写了宿主从不产出的 `data-turn-process-chevron` / `-body`，
  等于对着自己造的假 DOM 测皮肤里那几条死 CSS。改用真实的 `-hidden` / `-member` / `-messages`，
  `pre` 取样点挪到 `[data-tool]`（回合摘要区不装 `<pre>`，bundle 内该区域 `pre` 出现 0 次）。
  撤下 3 条随死 CSS 失效的判据，新增 1 条「收起态由宿主的 `-hidden` 承担」。
- `sidebar-keyboard.mjs` 的 c1 原按 `tabIndex >= 0` 判，而提案认可的两种修法（容器
  `tabindex=0`+`aria-activedescendant`、roving tabindex）落地后行自身 `tabIndex` 恒为 -1 ——
  判据比缺陷还苛刻。改以「`focus()` 后焦点是否真的落到该行」为准。
- c2 原在程序化 `focus()` 之后立即量，此时页面无键盘交互、`:focus-visible` 按规范不匹配；
  改到真实 Tab 序列走完之后量。
- c3 原是 `reachedRow || reachedActions` 的「或」，会在宿主只修行、不给 `.rowActions`
  加 `:focus-within` 时假绿。拆成 c3a（到达行）与 c3b（到达行内按钮）两条，缺一不可。

### ⑭ 后续消息队列并入输入卡

队列贴在输入卡的**上沿**，却一直在吃宿主的菜单材质：它消费的正是菜单那枚 `--dsw-menu-backdrop-filter`，
但它不在 ⑱ 所中和的 `[data-menu-material]` 锚点之下 —— 于是所有菜单都已去掉的 40px 背景模糊，
在它这里活了下来；顶部圆角也和它紧贴的那张卡片不一致。

- 实测（对队列面板取 `getComputedStyle`），改前 → 改后：`backdrop-filter` `blur(40px) saturate(1.5)` → `none`；
  顶部圆角 `16px` → `--dsw-radius-card`（即卡片自身圆角，两条曲线同心）；下沿保持 `0`。
- 底色改走 `--dsw-alias-bg-layer-1`：队列属输入区，不属浮层菜单那一族。
- 外观在 `skins/codex-ink/composer-queue.css`；断言在 `scripts/specs/queue-dock.mjs`。
- 不动宿主任何语义 —— `pendingRow` / `preview` / `editor` / `attachments` / `actions` 保持出厂行为。
  该断言经反向验证：把模糊改回去，它立刻转红。

### ② 侧栏行状态取自宿主自身的语义

宿主给**当前**会话和**被悬停**的会话同一个底色令牌，于是「我正在的会话」与「鼠标划过的会话」长得一模一样 ——
而皮肤此前**没有任何一条行样式**。

- 实测：当前行 `rgba(13, 13, 13, 0.08)`，悬停行 `rgba(13, 13, 13, 0.04)`；宿主两者都是 `0.04`。
- 锚点用宿主的稳定语义 —— `data-row-key`（`session:` / `workspace:` / `empty` / `overflow:`）与 `aria-selected` ——
  不用每次构建都会变的 CSS-Modules 哈希类名。
- 外观在 `skins/codex-ink/sidebar-rows.css`；断言在 `scripts/specs/sidebar-rows.mjs`。
- `sidebar-align.css` 里最后一处祖先位置 `:has()` 已清除，与 `model-picker.css` 早先的约束一致（见下方性能说明）。

### ②d 右栏滚动区跟上皮肤滚动条约定

右栏滚动区此前吃浏览器默认，而菜单早已并到皮肤约定上。现在它同样走 `::-webkit-scrollbar`，
用与菜单相同的令牌（8px、thumb 取 `--dsw-alias-scrollbar-bg-l2`），并加 `overscroll-behavior: contain`，
让滚动面板不会把滚动链带到中列。

- 外观在 `skins/codex-ink/panels.css`；断言在 `scripts/specs/panels.mjs`。
- T11 其余部分无需改动：面板容器、页头、空态、不可用态本就解析到皮肤的 `--dsw-*` 令牌。
- 该文件**不含后代通配符**，只点名具名容器，并有断言把它钉住 —— 右栏底下是文件树、终端与预览，
  这些节点在流式输出时反复重建。

### 外观：选中色块与字号步进器改用皮肤令牌

这两个控件宿主本已实现，也都交给宿主。宿主的 `FontSizeRow` store 持有一个 `fontSize` 与一个单调 `revision`
用来保护写入（`sync(d, fontSize, revision) { if (revision <= d.revision) return; … }`），`AppearanceRow` 则把
三档 `preference` 放在同一个守卫下。**没有重实现任何逻辑，也没有新增配置字段** —— 皮肤只是不再让这两个控件
显示宿主写死的值。

- 选中的外观色块读皮肤的 `--dsw-alias-label-primary`。实测：皮肤 `rgb(26, 28, 31)`，宿主停在 `rgb(173, 178, 184)`。
- 字号步进器的圆角读皮肤的 `--dsw-radius-s`。实测：皮肤 `8px`，宿主停在 `12px`。
- 外观在 `skins/codex-ink/appearance.css`（2 个令牌，均已在 `skin.css` 声明）；断言在 `scripts/specs/appearance.mjs`
  （13 条），含「字号改动穿透到皮肤正文令牌」（21px → 25px）与还原路径。

### 只记录、未修的部分

- **侧栏行菜单键盘够不到。** 会话行渲染为 `div[role="treeitem"]` 且不带 `tabindex`（整个
  `dsh-client-ui-workspace` bundle 只有一处 `tabindex`，属于搜索框），行操作按钮所在的元素默认 `display:none`，
  只在 `:hover`/`menuOpen` 时露出，且没有 `:focus-within` 规则。`display:none` 的元素不在 Tab 序列里，
  纯 CSS 造不出键盘通路。已按宿主提案记在 `docs/host-proposal-sidebar-keyboard.zh-CN.md`；三条断言在
  `scripts/specs/sidebar-keyboard.mjs`，由 `scripts/verify.mjs` 的 `OPT_IN` 集合排除在默认全量之外，
  主门禁保持全绿，缺口仍在册。
- **命令面板交给宿主。** `dsh-client-ui-commands` 只产出一个 `data-*`（`data-plugin-css`）；它的槽出口与别的
  组件共用，面板根 `data-menu-material` 又是全族共享，唯一可区分的手段是拿 `:not([data-trigger-menu])` 去排除
  兄弟 —— 已否决。Ctrl+K 宿主已绑给 `session.search`，且面板不渲染任何键位提示。记在
  `docs/codex-ui-t12-verdict.zh-CN.md`。
- **两套圆角档并存且未桥接。** 皮肤声明 `--dsw-radius-s` / `-m` / `-l`；宿主组件消费 `--dsw-radius-sm` /
  `-md` / `-lg`。两者当前都能解析（宿主 `ui-theme` 层供着第二套），所以没有坏 —— 但宿主调档会让皮肤自有圆角
  与宿主自有圆角脱节。刻意不桥接：那属于共享令牌变更。记在 `docs/codex-ui-t10-verdict.zh-CN.md`。
- **本节内容全部为夹具实测，未在真机 `dsh web` 上验证** —— 没有起过实例。`panels.css` 的滚动条改动在此环境
  更是无法测量：`scripts/lib/cdp.mjs` 启动 Chromium 时带 `--hide-scrollbars`，`offsetWidth - clientWidth`
  恒为 0，「标准滚动条属性与 `::-webkit-scrollbar` 哪条生效」**没有**实测支撑 —— 取舍依据是与 `overlays.css`
  的既有实现保持一致。
## 0.7.1 - 2026-09-29

### ⑬d 「轨迹」视图的退出出口

⑬ 按参考图把会话视图页签条整条隐去（`[data-slot="conversation.session.header"] > [data-conversation-tabs]
{ display: none }`），而 DSH 原生的「轨迹」（`@deepseek-ai/dsh-client-ui-trajectory`）正是那条页签条里的一格。
入口没被删 —— 工具卡展开后的 Inspect 走 `openView('trajectory', callId)` —— 出口却只剩页签条，
于是**进了轨迹就出不来**：真 `dsh web` 实测，切到轨迹后全页可见控件里能切回对话的为零。

- **不动页签条**（那是与参考图的对齐面）：轨迹视图显示时，在视图区左下角浮一个「← 对话」。
  点击就是**点那一格页签本身** —— 与用户手点走同一条 `selectView` 回调，不绕宿主内部 API、
  也不去猜宿主的状态。
- 结构在 `src/client/trajectory-exit.js`，外观在 `skins/codex-ink/trajectory-exit.css`（新增皮肤分片）。
- **「对话是哪一格」先标定再兜底**：视图区在渲染对话时，`aria-selected` 的那一格就是它
  （与界面语言、页签注册顺序都无关，页面一进来就停在对话，正常一次就标定到）；标定不到才退回
  页签文字 `Chat` / `对话`。两者都没有就**不出按钮** —— 宁可不出，也不点错格。
- **页签条哪天重新可见，本层自动让位**（`offsetParent` 判定），不需要跟着改代码。
- 按钮文字直接抄那一格页签的文字，本模块不维护词表。
- 宿主结构不符只 warn 并跳过，这一层会降级，绝不抛。
- 几何锚点取 `[data-slot="conversation.view"]` 的**父元素**：那个 slot 容器是 `display: contents`，
  自己的 rect 恒为 0。

### 排查记录：同一条皮肤规则经两条通道下发

归因时踩到的坑，写下来免得下次再踩：本机同时装着 **plugin 通道**（`style[data-plugin=codex-ui]` 内联的
`codex-ui/theme.css`）与 **skin 通道**（skin-center 注入的
`<link href="/api/skin-center/v2/skins/codex-ink/patches">`），**同一条隐藏规则两份都在**。
所以「禁用可疑样式表」不构成证伪 —— 禁用内联那份后页签条照旧不可见。要归因就得问浏览器本身：
CDP `CSS.getMatchedStylesForNode` 逐条列出命中规则并回溯 `styleSheetId` 到表头，再用一条自插的
`display:flex !important` 确认隐藏完全由 CSS 决定。

## 0.7.0 - 2026-09-28

架构整理（原 PR #3）与设置界面全页化（原 PR #1）一起落在 0.6.4 之上。0.6.2–0.6.4 的东西一样没丢：
结构用新的那一套，原来散在扁平脚本里的判据逐条搬进新脚本，不是删掉。

### 结构（原 PR #3 的重构）

- **客户端模块化**：`src/client.template.js` 删除。入口是 `src/client/index.js`，下面挂 `settings.js`、
  `settings-card.js`、`override.js`、`stylesheet.js`、`theme-preview.js`、`host.js`、`constants.js`
  与 `model-picker/`。`scripts/build.mjs` 里的打包器零依赖，产出的仍是宿主要求的经典脚本
  `window.__ModuleLoader__.load(...)`。加一个功能 = 加一个模块 + 入口一行。
- **工具链收拢成三个入口**：`npm run check`（不依赖宿主）、`npm run verify`（夹具）、`scripts/live/*`（真 GUI）。
  公共部分在 `scripts/lib/`，夹具在 `scripts/specs/*.mjs`。旧的 `check-repo.mjs` / `*-verify.mjs` /
  `live-gui-probe.mjs` / `theme-flash-probe.mjs` 删除；它们的判据是**搬家**，不是删除。
- **祖先位置的 `:has()` 清零**，MutationObserver 收窄：流式输出时的样式重算 4264 → 267 ms（web）、
  9518 → 442 ms（桌面壳）。
- **暗色 `html` 底色从未生效**：作用域化把 `:root:has(body[data-ds-dark-theme])` 变成了永远不匹配的后代选择器。
  现在以 `:root` 开头的复合选择器映射到根自身。

### 设置模态框（原 PR #1 的工作）

- **㉑ 设置对话框全页 Codex 化**：分组侧栏（「← 返回应用」一行、按文字过滤宿主条目的搜索框）、分组标题、
  内容区页头、每个子页面的白卡细边与贴底保存栏。结构在 `src/client/settings-modal.js`，外观在
  `skins/codex-ink/settings-modal.css`。
- **宿主锚点优先**：面板先认宿主自己的 `[data-shortcut-modal="settings"]`，只有找不到才退到第三方
  skin-center 适配器补打的 `[data-dsh-surface="settings"]`。视觉层只挂插件自有的 `[data-cx-sm-panel]` ——
  宿主改锚点只动一个常量，不动样式表。设置界面确实开着却一个锚点都没匹配到时，这一层**发警告**，不静默失效。
- **隐藏态以属性为准**：宿主在选中态搬走时会把导航项的 `className` 整条重写，所以耐久标记是
  `data-cx-sm-hidden`，类名只是给人看的。列表观察器必须开 `subtree` —— 不开时那次 class 重写一条 mutation
  记录都不产生（实测 0 条 vs 5 条）。
- **绝不接管宿主节点**：未知项只做视觉分组，宿主节点不移动、不克隆、不删除。排序走 `style.order`；
  已知代价是键盘 Tab 顺序仍是 DOM 顺序。

### 搬进新结构的部分

- 0.6.2–0.6.4 的模型选择器改动（席位级 `pending`、顶档紫色点阵、16×30 旋钮与「更快/更强」一行）落在
  `src/client/model-picker/{component,view}.js`；夹具的假目录不再假装快照里有 `pending` 字段 ——
  安装中的宿主本来就没有。
- 0.6.3 的实测像素值（侧栏 `#f6f6f6`、中列环境影 13px @7%、输入卡阴影两层）都在，且暗色中列规则**单独保留**：
  亮色那支拟合对暗色不成立，一个令牌表达不了两档。
- `scripts/live/settings-modal.mjs` 与 `scripts/live/settings-sweep.mjs` 是模态框的真 GUI 验收。
  扫掠脚本把「一个设置页都没扫到」当硬故障 —— 旧版在这种情况下报 PASS。
- 0.6.4 的侧栏底色验收搬成 `sidebar-color` 夹具 spec（16 项：亮暗同页、实测像素、层级方向，外加每套一条反例对照）。

### 验收

`npm run check` 67/67 · `node scripts/verify.mjs` 224/224（9 个 spec）。

## 0.6.4 - 2026-09-28

亮暗两套侧栏都换了基准。Codex **没有「侧栏色」令牌**；那一面是半透明遮罩，渲染出来的颜色取决于窗口背后是什么。
两个后果：亮色旧值 `#EEF4F9` 是某次蓝底下的读数；暗色旧值 `#181818` 是**表面**那一层的色，不是侧栏 ——
于是暗色侧栏比窗口背景还亮 7 级，层级方向反了。

### 色差到底从哪来

`app-shared-fa3f1d5d5942.css`（Codex desktop 26.924.2738.0），electron 窗口、左侧板外观非
`content-surface` 时：

```css
.app-shell-left-panel:not([data-app-shell-left-panel-appearance=content-surface]) {
  background: color-mix(in srgb, var(--color-surface-tertiary) 70%, transparent);
}
```

亮色 `--color-surface-tertiary` = `--gray-75` = `#F3F3F3`。叠在白色底上：
`0.7 × 243 + 0.3 × 255 = 246.6 → #F6F6F6`。

`[data-app-shell-page-surface=true]` 另外叠 `--color-surface-secondary`（`#F9F9F9`）的 85%，所以侧栏永远
比主区深一档 —— 层级就是这么来的，没有第二个令牌。

### 实测（每套主题一张截图，避开文字取样）

| 面 | Codex 亮 | codex-ink 旧 | 新 | Codex 暗 | codex-ink 旧 | 新 |
|---|---|---|---|---|---|---|
| 侧栏底 | `#f6f6f6`（246） | `#eef4f9`（238,244,249） | **`#f6f6f6`** | `#0f0f0f`（15） | `#181818`（24） | **`#0f0f0f`** |
| 侧栏选中行 | `#e9eaea`（233） | `#e2e9ed` | **`#e9e9e9`** | `#1f1f1f`（31） | `#282828`（40） | **`#1f1f1f`** |
| 主区底 | `#ffffff` | `#ffffff` | `#ffffff` | `#111111`（17） | `#111111` | `#111111` |
| 侧栏 − 主区 | −9 | −17 | **−9** | −2 | **+7** | **−2** |

亮色：旧值偏差 R −8 / G −2 / B +3 —— 是一层蓝调，那一档读起来是色相变化而不是灰阶变化。
暗色：旧值就是表面色，侧栏反而比背景亮 7 级，方向是反的。
现在两套里侧栏都比主区低一档（255 → 246、17 → 15）。

### 不是源头

引出这一轮的那张截图，是 Codex 自己的**设置 → 外观**面板：每个可见标签都能在 Codex 的 zh-CN 语言包
里找到对应键（`settings.general.appearance.chromeTheme.accent / surface / ink / uiFontFamily /
codeFontFamily / translucentSidebar / contrast`，外加 `import` / `export`）。但它上面那段代码块不是
Codex 的活字符串：`themePreview`、`ThemeConfig`、`sidebar-elevated` 在 Codex 应用包的全部 19,310 个文件里
**零命中**（原始字节搜索，不限扩展名、不限体积），在本仓库的 57,865 个文件里也零命中。Codex 只有
`--color-surface-elevated` 与 `--color-surface-elevated-secondary`，没有 `sidebar-elevated`；包里唯一命中
`ThemeConfig` 的是 mermaid 的 `quadrantDiagram` / `xychartDiagram` 图表构建器。取色机制是上面那条 CSS
遮罩，不是那段代码。

### 改动

- `skins/codex-ink/skin.css`（亮）：`--dsw-alias-bg-sidebar` 与 `--dsw-specific-sidebar-fill` `#eef4f9` →
  `#f6f6f6`；`--dsw-specific-sidebar-nav-item-active` `#e2e9ed` → `#e9e9e9`；
  `--dsw-specific-sidebar-nav-item-hover` `#e8eef3` → `#f0f0f0`。
- `skins/codex-ink/skin.css`（暗）：同样四个令牌 `#181818` → `#0f0f0f`、`#282828` → `#1f1f1f`、
  `#212121` → `#171717`。暗色**表面**令牌不动 —— `--dsw-composer-surface` 仍是 `#181818`，
  输入卡实测仍为 35，与 Codex 同值。
- `src/override.js`：`SKIN_DEFAULTS.light.sidebar` 跟着改 —— 设置卡把它作为「跟随皮肤」的默认值显示，
  `check-repo.mjs` 会对账这两处。
- `scripts/model-picker-verify.mjs`：夹具底色跟着改。
- 新增夹具 `scripts/sidebar-color-verify.mjs`（16 项）：六个面在同一页上以 DPR 2 并排渲染，靠切
  `body[data-ds-dark-theme]` 亮暗各截一次，新值与旧值在同一采样点对读，外加每套主题一组反例对照 ——
  证明夹具分辨得出旧读数与新读数。

### 边界

- 皮肤写的是**合成后的值** `#f6f6f6`，不是字面的 `color-mix(in srgb, #F3F3F3 70%, transparent)`。
  DSH 把侧栏填充画在不止一层上（标题栏条与侧栏都吃 `--dsw-specific-sidebar-fill`），字面 70% 遮罩会
  叠加成另一个结果、且结果随层数变。合成值就是 Codex 在白底上显示的值，而白底正是本皮肤保证的底。
- 暗色**表面**那条链不在本次范围：`#181818` / `#212121` / `#282828` / `#303030` 除输入卡（实测 35，同值）外
  没有对着 Codex 的暗色截图重新量过。
- 暗色侧栏 `#0f0f0f` 是**实测值**，不是推导值。Codex 的暗色遮罩要经 `--color-surface-tertiary`，
  而那个令牌在包里不止一处声明；叠在黑色窗口底上，一个候选算得 13、另一个算得 15，实测是 15。

## 0.6.3 - 2026-09-28

输入卡阴影与窗口边框阴影改为**按实测像素拟合**，不再照抄 Codex 的源码 token —— 两者对不上：
源码 `--elevation-composer` 的 `0 4px 80px 8px` 远场在参考图里量不到，环的 `1px` 在 DPR 2 下
渲成 2 个设备像素，而参考图里只有 1 个。

### 实测（两边同一采样线，DPR 2，单位 = 设备像素）

输入卡（从卡边往外）：

| | 旧值 | 新值 | Codex 参考图 |
|---|---|---|---|
| 环占几个设备像素 | 2 | **1** | 1 |
| 环最深 | 226（Δ29） | **222（Δ33）** | 222（Δ33） |
| 卡下沿 Δ | 8,8,7,7,6,6,5,5,5,4,… | 13,12,11,11,10,9,8,8,7,6,6,5,4,4,3,3,2,2,2,1,1,1,1 | 13,12,11,10,9,8,7,6,5,4,4,4,2,2,2,2,2,1,1,1,1,1,1 |
| 归零距离 | 56（= 28 CSS px） | **24（= 12 CSS px）** | 24 |
| 与 Codex 的绝对差之和 | 147 | **55** | — |

窗口边框（从发丝线往侧栏）：

| | 旧值 | 新值 | Codex 参考图 |
|---|---|---|---|
| 侧栏侧 Δ | 6,6,5,5,5,5,5,4,4,4,4,4,3,3,3,3,3,3,2,2,2,2,2,2 | 8,7,7,6,6,5,5,4,4,4,3,3,2,2,2,2,1,1,1,1,0,0,0,0 | 8,8,6,6,5,5,4,3,3,3,2,2,2,2,2,1,1,1,1,1,1,1,1,1 |
| 归零距离 | 32（= 16 CSS px） | **21（= 10.5 CSS px）** | 26（= 13 CSS px） |
| 与 Codex 的绝对差之和 | 47 | **22** | — |

### 改了什么

- `skins/codex-ink/composer.css`：`--dcu-composer-shadow` 由
  `0 0 0 1px rgba(13,13,13,.1), 0 2px 8px 0 #0000000a, 0 4px 80px 8px #00000006`
  改为 `0 0 0 0.5px rgba(13,13,13,.1), 0 2px 12px 0 rgba(0,0,0,.09)`；
  窄屏段（`max-width: 639px`）的 80→40px 覆盖一并删掉 —— 没有远场可收。
- `skins/codex-ink/window-shadow.css`：中列环境影由 `0 0 24px rgba(13,13,13,.05)`
  收到 `0 0 13px rgba(13,13,13,.07)`；发丝线不动（实测差在 ±4 级，属采样噪声）。
- `scripts/composer-shadow-verify.mjs`：4 条旧判据按新口径重写（三层→两层、环 1px→0.5px、
  近场 8px@4%→12px@9%、衰减半径「≥35px」→「落进 Codex 实测带 3~13px」），20 → 21 项。
- `scripts/rightbar-verify.mjs`：两条断言还钉着拟合前的中列环境影（`0 0 24px @5%`），
  从那次拟合起就一直红着；现改为钉实测值 `0 0 13px @7%`，桌面壳与 web 形态各一条。

### 边界

- **暗色窗口边框影未动**（仍是 `0 0 24px rgba(0,0,0,.5)`）：手上没有暗色的参考截图，
  量不到就改等于目测调参。Codex 的 `--shadow-card` 在暗色下没有覆盖、仍是 5.1% 黑 —— 这一条待实测。
- 拟合用的夹具是 headless Chrome + 宿主真实 CSS Modules + 本皮肤，不是活着的应用；
  但它复现了用户同屏截图里的环（改前夹具 226 / 实机 226、223）。
- 只动了皮肤侧（`skins/codex-ink/*.css`）；DSH 平台侧的基础阴影/描边一行未改。

## 0.6.2 - 2026-09-28

修 0.6.1 那个本地 pending 的**释放时机**：切换回「当前那一档」时，乐观值会被立刻撤掉，
于是先前那次提交一落地就把显示拽回旧档 —— 现象就是「加载期间怎么滑都回弹，只能等加载完」。

### 症状（逐帧复现）

high → max 之后有一段往返窗口。在窗口内切回 high：

```
3:Max 3:Max 3:Max 3:Max 3:Max 3:Max 3:Max   ← 窗口内切回 Max，显示正确
1:Low 1:Low                                  ← 被拽回（前一次提交落地）
3:Max 3:Max 3:Max 3:Max ...                  ← 第二次提交落地才回来
```

### 根因

- 宿主的 `current` 是 **durable next-request projection**（`read:dsh-client-ui-model-selection/lib/types/client/directory.d.ts:14`），
  它**落后于**提交 —— 提交发出去之后、落地之前，`current` 仍是旧档。
- 0.6.1 的 `settlePending` 判据是「`current` 等于 pending 就撤」。**切回当前那一档时这两个值天然相等**
  （pending = 旧档 = 当前 current），于是 pending 在设置的同一帧就被撤掉，乐观保护消失。
- 之后先前那次提交落地，`current` 变成它，显示被拽过去 —— 回弹。等第二次提交也落地才回到目标档。
- 所以这不是宿主的锅，也不是「加载慢」本身：宿主的提交是**按序接受**的（第二次确实发出并最终生效），
  被拽回去的只有**显示**。

### 修法

- pending 只在**本次提交的 RPC 已经落地之后**才允许撤（`seat.pendingSettled`）：
  落地时先置位、再看宿主有没有追平；没追平就留着 pending 等它，而不是当场撤。
- 兜底：宿主迟迟不回显（丢包 / 被更晚的提交取代）挂 `PENDING_ECHO_MS = 12s` 强制撤，
  免得界面卡在一个永不落地的档上。失败路径（异常 / `ok:false`）仍然立即撤 —— 错就是错，
  不能让乐观值盖住失败提示。

### 判据

- `power-rail-verify` 61 → **62 项**：新增「往返窗口内切回原档：全程停在目标档（不回弹）」，
  在夹具的 600ms 往返里逐帧取样 22 次，任何一帧离开目标档就 FAIL。
  修前实测 `3:Max ×7 → 1:Low ×2 → 3:Max ×13`，修后 22 帧全在 `3:Max`。
## 0.6.1 - 2026-09-28

修 0.6.0 的一个**判据错位**：模型选择器的乐观显示建在一个真实宿主并不提供的字段上。

### 症状

改推理档位时，松手后轨会**回弹到旧档**，整段往返（实测 ~1.1s）里底部触发器都停在旧档 —— 也就是
「滑块已切、底部思考还没跟上」。

### 根因

- 安装中的 `@deepseek-ai/dsh-client-ui-model-selection` 是 **0.1.7-rc.1**，它的 `ModelDirectoryState`
  只有六个字段：`{ current, routable, groups, failures, status, error }`（`lib/types/client/directory.d.ts:13-32`）。
  **既没有 `pending` 也没有 `retainedEffort`** —— 这两个词在该包 `client.js` 里各出现 0 次。
- 0.6.0 的 `viewOf()` 读 `snap.pending` 决定乐观档位；字段缺席 ⇒ `pendingEffort` 恒为 false ⇒
  `effective` 永远等于 durable 的 `current.reasoningEffort`。
- 于是 store 的第一次通知（`status → selecting`）会用**旧** current 重画轨。逐帧实测：
  `t=234ms` 轨回到旧档、`t=252ms` 才到新档；`data-pending` 与 `.codex-mp-spinner` 全程未出现。
- 夹具当时按**文档里的 rc.2 契约**造快照，**自己喂了 `pending`**，所以这三条判据在真机上等于没测。

### 修法（只动一个源文件，外观与交互形态不变）

- `viewOf(snap, localPending)` 多一个可选入参：**宿主给了 `pending` 就用宿主的**（将来宿主补上即自动接管），
  没给才用席位自己记的那一笔。
- 席位级 `seat.pending`：`submit()` 提交前记下目标 selection 并**立刻重画**，轨 / 底部触发器 / 弹层档位名
  从这一帧起就是目标档。
- 撤除点三个，全都幂等，且只在「还是本次那一笔」时才撤（晚到的旧响应不会清掉更新的提交）：
  宿主 `current` 追平（`settlePending`，随 store 通知与每轮 scan 跑）、提交成功返回、提交失败或抛异常。

### 判据修正（这条比修法本身重要）

- `scripts/power-rail-verify.mjs` 的假目录**去掉 `pending`**，快照形状与安装中的宿主逐字一致。
  拿修前的源码跑这套夹具：**44/47**，恰好挂在「往返中轨停在新档不回弹」「往返中触发器已按新档显示」
  「换模型往返中行尾转圈」三条上；修后 **47/47**。夹具从此能区分「真乐观」与「只是没测到」。
- `scripts/check-repo.mjs` 的功率轨视图用例补 6 条：无宿主 pending 时采用席位自己那一笔、
  `null` / 省略入参不改变行为、别的模型上的 pending 不污染本模型档位、宿主补上 pending 时优先用宿主的。
- `src/model-picker.js` 顶部驱动契约改为实测口径（0.1.7-rc.1 的六字段），不再照抄不存在的字段。

### ㉑ 推理强度滑杆换成 dsh-claude-style 的形态（只换形态）

**只补这一块、只换形态**：控件仍在弹层里、仍是同一个席位与同一条交互（真拖拽 / 松手对齐 / 键盘四键），
只把轨的外观换成参考图的形态；codex 皮肤其余区域与控件一个没动。

- **形态基准 = dsh-claude-style 的 .dsh-claude-effort-* 规则**（它自己的注释写明对标 Claude Desktop 的
  Effort slider）。几何逐条从它的源码取，不是目测：槽 **26px 厚 / 8px 圆角**（圆角矩形，不是胶囊）；
  填充 = 主文本墨 **26%**、右端方角、止于旋钮中心；刻度 4px、与填充同墨（走过去的被填充吞掉，
  不再分选中/未选中两色）；旋钮 **16×30 / 5px 圆角**白片 + 0 1px 3px 软影（不是圆珠）；
  槽下方多一行**更快 / 更强**（11px caption 色，命名的是方向不是取值）。
- **顶档换成紫色点阵**（apex）：填充与刻度隐去，换上 **5 行方块网格**（1 设备像素缝、0.5 设备像素外边距，
  在整设备像素上解网格 —— 小数 pitch 会被栅格化成交替的缝）；每格的相位/周期/色调由坐标 **hash 散开**
  （不成序，读起来是一片粒子而不是一道扫过的光带）；左端按 smoothstep 溶回裸槽、右端实心；
  旋钮染紫 + 10px 光晕，档位名转紫。顶档紫两套主题各一份（亮 #8b7ad0 / 暗 #9d8ce0）。
- **上一轮那个蓝色扫光已随形态一并删掉** —— 它是按 plugin-effort-slider 移植的，不是参考图的东西；
  顶档现在只有点阵，成品里没有参考图以外的动效。
- **触发判据仍是连续比例**：拉到最右端**松手前**点阵就亮，不等生效档变了才亮；单档模型没有「最高档」。
- 档位名交换按基准的做法：进来的从下方模糊上浮、出去的（ghost 压在原位）向上飘走，每次换档重新起跑。
- 两条关动效的口子照旧：系统 prefers-reduced-motion 与脚本的 data-reduced-motion。

### 判据

- power-rail-verify 53 → **61 项**：槽 26/8、热区 30、填充 26% + 8px 0 0 8px、旋钮 16×30/5px/白片/软影、
  更快更强那一行、圆点行程 [8, 宽−8]、旋钮中心 = 生效档、填充止于旋钮中线、圆点与填充同墨；
  顶档七条（点阵亮起 5×N 格、填充与刻度让位、相位散开 + 8 档色调、羽化 0→1、闪动周期落在 1.45s 散相带、
  旋钮染紫 + 光晕、档位名转紫）；深色三条（槽仍是 26/8、顶档紫换暗色那套、旋钮是紫片不是白片）。
- check-repo 的单元判据从「流光」改成「点阵」：两个 keyframes、三个可挂载类、
  **方块声明块里不出现 --codex-mp-pos**（可复用的硬条件）、8 档色调、顶档紫亮暗各一份、两条关闭口子。
- 顺带修了两个夹具精度问题：关键帧选择器的过滤不认小数百分比（17.24%），
  以及 --codex-mp-apex-* 一开始定义在轨上、而档位名在 head 里读不到它（已改到卡片上）。


- `power-rail-verify` 47 → **53 项**：流光三件套（animation-name / 1.8s / 250% 渐变底）、拇指呼吸同周期、
  强调色确实来自 `--dsw-alias-link`（在渐变串里找得到）、最左端不亮、最右端松手前已亮、reduced-motion 下都停。
- `check-repo` 新增一条结构性判据：两个 keyframes 与可挂载类都在、**单元声明块里不出现 `--codex-mp-pos`**
  （可复用的硬条件）、强调色是单一来源、两条关闭口子都在。
- 顺带修了 `check-repo` 的一个夹具精度问题：keyframes 关键帧选择器的过滤只认单个 `0%`，
  逗号并列的 `0%, 100%` 会被当成 CSS 选择器误报。
## 0.6.1 - 2026-09-28

架构整理：功能不变，流式输出时明显更快，工程脚本收拢成三个入口。重构前后在真 `dsh web` 上把 14 个界面状态逐元素比对计算样式：
除「修正」一节那一处有意的变化外，零差异。

### 性能

- **去掉落在祖先位置的 `:has()`**：侧栏对齐 9 条、侧栏渐隐 2 条、模型选择器席位 1 条；输入区 hero 那条改成固定深度的子代 `:has()`。
  祖先位置的 `:has()` 让会话区每插入一个带 `data-slot` 的节点，Chromium 都要把受影响祖先下的整片子树重配一遍样式。
  模拟流式输出（200 帧，每帧 30 个 span 加 1 个 `data-slot` 节点），5 次取中位：

  | 形态 | 样式重算 | 整段耗时 |
  |---|---|---|
  | web | 4264 → 267 ms | 6.3 → 2.3 s |
  | Windows 桌面壳（标题栏形态） | 9518 → 442 ms | 11.7 → 2.5 s |

  桌面壳形态下皮肤相对裸宿主的额外重算已在噪声以内。新锚点的特异性与旧写法逐条相同，与宿主规则的先后关系不变。
- **模型选择器席位**：原先靠 `席位:has(> .codex-mp-trigger) > :not(触发器)` 隐藏宿主那一格；现在触发器挂进席位时给**席位本身**
  打 `data-codex-ui-seated`，撤走时一起摘掉。标记在席位出口上、不在宿主子节点上，React 换掉宿主子节点不影响它
  （0.6.0 不打标记的顾虑因此不成立；夹具「宿主换掉自己的子节点后仍隐藏」照常通过）。
- **观察器收窄**：模型选择器的 MutationObserver 只在属性变化、席位增删时全量扫描，其余只重同步被触及的席位与尚未落定的席位。
  流式时脚本耗时 47.5 → 10.1 ms。

### 修正

- **深色下 `html` 底色从未生效**：`skin.css` 的 `:root:has(body[data-ds-dark-theme])` 被作用域化成了
  `html[data-codex-ui] :root:has(…)`（后代选择器，永远匹配不到），深色时 `html` 一直是浅色的 `#fff`，只是平时被 `body` 盖住。
  作用域器现在把以 `:root` 开头的复合选择器映射到根本身。这是本版唯一的可见差异：深色状态下 `html` 的底色 `#fff` → `#111111`
  （本来就是这么设计的，见 README「设置页」最后一条）。它单独一个提交（249e6d1），要回退可以单独 revert。

### 结构

- 浏览器半拆成 `src/client/` 下的 ES 模块：`index.js`（`inject` 与 `apply`）、`stylesheet.js`、`settings.js`、`theme-preview.js`、
  `settings-card.js`、`override.js`、`model-picker/{index,component,view}.js`、`constants.js`、`host.js`。
  旧的字符串拼接模板 `src/client.template.js` 与 `src/build.mjs` 删除。加功能 = 一个模块导出 `installXxx(ctx)` + `apply` 里一行。
- `scripts/build.mjs` 是唯一的构建：零依赖打包器把模块按依赖顺序打成 IIFE（相对导入 → 解构，宿主包 → loader 的 `require`），
  样式作为虚拟模块 `codex-ui:theme.css` 内联；不认识的 import / export 写法直接报错。CSS 作用域器认得注释与字符串，产物去掉注释。
- 删掉走不到的代码：设置卡的摘要分支、无 primitives 时的降级与主题回退表，`settings.css` 里对应的 `.cx-row--stack` 与回退样式。
- 样式去重：重复的阴影与底色收成 4 个令牌（`--dsw-codex-ambient`、`--dsw-codex-menu-shadow`、`--dsw-codex-suggest-shadow`、
  `--dsw-codex-suggest-fill`），去掉深色里与浅色同值的重复声明，注释瘦身；八份 CSS 2491 → 约 1820 行。

### 工程

- 脚本从 25 个文件 / 4886 行收成 15 个 / 3356 行，三个入口，公共部分在 `scripts/lib/`（host / cdp / checks）：
  - `scripts/check.mjs`：原 `check-repo.mjs` + `audit-codex-ink.mjs`，60 项，CI 入口；新增 `client.js` 的 DSH 插件契约检查
    （隔离执行一遍：loader id = 包名、`inject` 恰为三个必需服务、内嵌样式与 `theme.css` 一致）与 `peerDependencies` 检查。
  - `scripts/verify.mjs` + `scripts/specs/`：原 8 个 `*-verify.mjs` 夹具，断言名与项数不变，共 195 项；`npm run verify`。
  - `scripts/live/`：`gui.mjs`、`settings.mjs`（并入原 `theme-flash-probe.mjs`：主题切换逐帧无中间帧），新增 `parity.mjs`（改动前后逐元素计算样式对账）。
- **安装改走 DSH 标准的 `dsh plugin add link:`**：删掉 `install-plugin.mjs`、`make-verify-profile.mjs`、`pack-host-asar.mjs`
  （npm 装出来的 `node_modules` 直接就能当夹具宿主）、`make-preview.mjs` 与 `scripts/fixtures/`；`package.json` 去掉 `install:*`、
  加 `verify`，并在 `peerDependencies` 声明 `@deepseek-ai/schemastery`（`index.js` 导入它，由宿主提供）。**迁移**见 README「安装」。
- 夹具修正：旧 hero / composer-shadow 夹具在第一个 `content:""` 处截断了宿主会话根样式（6717 字符只读到 2672）；按全文读后阴影会被
  滚动容器裁掉，夹具改成像真应用一样把留白放在滚动容器里，读数不变（边缘 224、衰减 42px）。0.6.0 上已跑不通的 A 面菜单夹具与
  右栏夹具修好。settings 验收结束时重置全部覆盖，不再污染之后的比对。
- 删掉 `docs/plan-settings-page.zh-CN.md`（已执行的旧计划，结论已在更新日志里）与 README 不再引用的验收截图。

## 0.6.0 - 2026-09-28

模型选择器的 B 面（Codex 推理等级功率轨）落地；外加一轮对照复刻规格的全仓审查，修掉其中查实的问题。

### ⑳ 模型选择器 B 面：自建组件顶替模型位

- **做法是「DOM 顶替席位」，不寄生宿主菜单**（0.5.0 那条 CSS 重排的路卡顿、简陋，已 revert）。
  自己的触发器追加进 `[data-slot="conversation.input.model"]`，弹层挂 `document.body`；席位里有我们的触发器时，
  `model-picker.css` 用**一条**直接子代 `:has()` 把宿主那一格 `display:none`（仍在 React 树里）。不打标记属性 ——
  React 换掉宿主子节点时标记会丢、宿主控件闪回；`:has()` 只看「我们在不在席」，摘掉触发器宿主立刻复原。
- **数据与提交只走宿主**：`ctx.inject(['modelDirectories'], …)` 等服务（与宿主自己挂模型位同一个口子，服务缺席不阻塞皮肤），
  `directoryFor(会话).store` 订阅，`select({ provider, model, reasoningEffort })` 提交。会话 id 取席位祖先的
  `data-conversation-session`（右栏侧边聊天有自己的席位），取不到再退到 `uiSession`。宿主没渲染的席位（子代理会话）不接管。
- **功率轨按 Codex 源码逐字**：轨 24px / 圆角 12 / 前景 10% / `inset .5px` 描边；档位点 4px、热区 16px，走过的 30% 白；
  拇指 28px 白片 / `.5px` 强描边 / `0 0 2px` 微影；已选段强调色、止于拇指中线；主曲线 `.3s cubic-bezier(.23,1,.32,1)`，
  拇指首帧 0s、16ms 后抬到 .3s。弹层宽 254px（`spacing × 63.5`），入场 `.32s … 30ms` 自 `scale(.98)`；
  定位照宿主 `place()`（右沿对齐、上方 8px、视口留 12px）。
- **交互**：真拖拽（按下抓取 → 自由滑动、**不提交** → 松手对齐最近档提交一次），`touch-action: none`；←/→/Home/End；
  键盘焦点把 2px 环画在拇指上；Escape 关闭并还焦点（鼠标打开后焦点在触发器上时也能关）；换模型连带该模型的默认档提交，成功后关弹层。
  档位数与名字全部来自 `reasoning.efforts`。
- **往返期间**（宿主在整个 selectModel 往返里把目录标成 selecting）：列表签名里没有 status，卡片不重画、不清空；
  轨与触发器按 pending 那一档乐观显示，档位名旁转圈（换模型时是那一行行尾转圈）。失败时弹层顶上给宿主同款提示
  （会话被占用单独一句），轨退回生效档。
- 触发器档位文字照 Codex `_ModelPickerTriggerEffortText`：各档名叠在同一格、模糊交叉淡入，宽度不跳。
- 文案先借宿主 `model` 命名空间（与原生菜单逐字一致，内置模型的说明也跟着本地化），宿主字典缺席才用自带表。
- 设置卡新增一行「Codex 模型选择器」（`modelPicker`，**默认开**）。关掉即撤走全部自建节点，宿主原生菜单（⑫ A 面）立刻复原；
  设置文档还没到时不先接管，免得开了又撤闪一下。**Config 因此是 12 个字段**（复刻规格写的是 11 个 + 主题偏好）。
- **没做**：Codex 功率轨的三个进阶态（高亮、Fast 圆点飞出、超出最大档的紫蓝渐变）—— DSH 没有 Fast 模式也没有那一态；
  触发器上 Max 档的紫色不做，它在彩色白名单之外。
- 注：606faea 曾以同名 0.6.0 提交过一次，但只提交了生成物 `client.js`，组件与样式源文件、构建改动、体检与探针都没进仓库，
  随即 revert。本版是完整重做，源码、构建与验收一起入库。

### 审查修正

- **输入卡阴影双真源**：`patches.css` ⑧ 还写着 `[data-composer-card] { box-shadow: var(--dsw-elevation-panel) }`，
  与 `composer.css` ⑭ 的 Codex 三层阴影是同一元素的两个真源（谁生效只看权重）。宿主只在会话滚动区里渲染这张卡，已删。
- **`--dsw-elevation-soft` 不再自造**：0.5.10 的 `0 8px 28px 10% 墨`（暗色 55% 黑）既无读数也无锚点，却落在宿主
  `SegmentedControl` 的选中片上（设置页每个分段控件都背着它）。交还宿主自己的值。
- `--dsw-elevation-stroke` 改为 `0 0 0 .5px var(--dsw-elevation-stroke-color)`（规格原文；计算值不变）。
- **字体栈**在 `skin.css` 逐字声明一次（与宿主 0.1.7-rc.2 的 base_css_default 逐字比对一致），外观不随宿主版本漂。
- **焦点环接到宿主令牌上**：声明 `--dsw-focus-ring-color: var(--dsw-codex-focus)`。宿主 10 条用 box-shadow 画环的组件规则
  此前落回墨色回落值，现在是 Codex 蓝；皮肤自己的环也改读它，于是继承宿主「指针操作不出环」的约定
  （`html[data-input-modality=pointer]` 时宿主把它就地置成 transparent）。
- 新增 `--dsw-codex-border`（10% / 12%）与 `--dsw-codex-border-strong`（15% / 20%），即 Codex 的 `--color-border` / `--color-border-strong`。
- **设置卡深色背景的默认值错了**：`SKIN_DEFAULTS.dark.surface` 停在 `#181818`，而 0.5.6 起深色窗口背景是 `#111111`
  —— 背景色块显示的「跟随皮肤」值与实际不符。已改，`check-repo` 新增逐字段对账 skin.css，漂移即 FAIL。
- `.cx-error` 读的是不存在的 `--dsw-alias-state-error`，「保存没生效」的提示一直是普通文字色；改读 `error-primary`。
- **字体栈校验加固**：`isFontStack` 另挡反斜杠（`u\72l(` 在分词器眼里就是 `url(`）、注释起止（值里开一个注释会把深色覆盖整块吞掉）、
  控制字符与不成对的引号。`check-repo` 对「吞掉深色块」直接断言产物。
- **安装器在新 profile 上写坏 YAML**：dsh rc.2 新建 profile 的 `cordis.patch.yml` 是流式空列表 `[]`，安装器直接在后面接
  `- insert:`，`dsh web` 启动即抛 `failed to parse overlay`。现在空 `[]` 先摘掉，非空流式列表拒绝并提示。
- **产物里带着本机路径**：`composer.css` 注释里的本地克隆路径被原样拼进 `theme.css` 与 `client.js` 发出去，而体检只扫 JS、
  且认不出 JSON 转义后的双反斜杠。体检扩到样式与文档并认两种写法；`docs/` 里的本机路径换成占位符。
- 过期注释：卡片圆角 10px → 12px、「链接 = 墨」→ 强调色、过渡 100ms → 150ms、输入区 14px → 16px、⑫ 行圆角 8 → 13、
  各层头部的 `install-plugin.mjs` → `src/build.mjs`、`build.mjs` 的「五份样式」、皮肤 README 的文件表与「链接是墨色」。

### 验收

- **新增** `scripts/power-rail-verify.mjs`（47 项，只要 Chromium）：真实组件 + 真实 theme.css + 按宿主契约写的假目录，
  `select()` 往返故意放慢到 600ms —— 本机真宿主往返不到 60ms，pending 行为在真 GUI 上来不及量。它量出并修掉了两个问题：
  宿主字典缺席时内置模型说明画出了字典键名；鼠标打开后焦点在触发器上时 Escape 关不掉。
- **新增** `scripts/pack-host-asar.mjs`：没有桌面壳时，把 npm 装的宿主包拼成夹具能读的 `app.asar`（与桌面壳同一批包）。
- `hero-verify.mjs`：「徽标圆角保持官方 6px」写死的是 rc.1 的字面量；rc.2 改成了 `var(--dsw-radius-xs)`（宿主给 4px），
  在 rc.2 上必然 FAIL。期望值改为从宿主源码现取。
- `live-gui-probe.mjs`：新 profile 一进来是两层引导弹层，探针的点击全落在遮罩上 —— 右栏三条断言「实测 none」就是这么来的，
  现在先关弹层。模型位按 B 面量 7 条（顶替、几何、键盘改档写进宿主 store 并改回）；B 面关着时量 A 面 pending，
  `--latency`（默认 800ms）给那一次往返加时延，否则窗口在第一次采样前就结束了。探针改完档位会改回去。
- `settings-page-verify.mjs`：9 行；深色底色断言仍是 0.5.6 之前的 `#181818`，改为 `#111111`；新增开关 5 条
  （关掉后刷新、席位里没有自建触发器、宿主那一格可见，收工复位）。
- 全套（npm `@deepseek-ai/dsh@0.1.7-rc.2` + 由它打包的 asar + Edge/Chromium 153；真 GUI 为同版本 `dsh web`）：
  `check-repo` 23/23 · `audit` 36/36 · `elevation` 19/19 · `composer-shadow` 23/23 · `model-picker` 20 · `power-rail` 47/47 ·
  `rightbar` 42 · `hero` 25 · `sidebar-align` 6/6 · `sidebar-surface` 13/13 · 真 GUI `live-gui-probe` B 面 14/14、A 面 10/10 ·
  `settings-page-verify` 29/29 · `theme-flash-probe` 9 段 0 异常帧（点击→变色中位 23ms）。

## 0.5.10 - 2026-09-28

第三张 Codex 截图让输入卡环的取值**不再依赖设备像素比**就能定下来 —— 也顺带查出 0.5.8 的 12% 偏重。
同一张截图还独立确认了 0.5.8 的白卡。

### ⑱ 输入卡环：12% → 10%

- **环有两条互斥的代码路径**，0.5.7 / 0.5.8 只看了第一条：

  ```css
  /* 路径A —— 默认 / large / single-line */
  box-shadow: var(--composer-layout-surface-shadow);  border: 0 !important;
  /* 路径B —— [data-composer-radius-variant=compact]，后者胜 */
  box-shadow: none;  border: 1px solid var(--color-border) !important;
  ```

  `--color-border` = `--alpha-10`（亮）/ `--alpha-12`（暗），即 **10%** —— 不是路径A 那个 `#0000000a` 环的
  3.9%，也不是 0.5.8 取的 12%。
- **两种互相独立的方法都指向 ~10.4%：**
  - *同图内比较（与 DPR 无关）。* 新截图里 Codex 输入卡的环像素比页面低 **26 级**（`#e4e4e5` vs `#fefefe`）。
    而 0.5.7 那张截图里（环是 4%）皮肤的环像素只低 **16 级**（`#efefef` vs `#ffffff`）。把这 16 级拆成
    近场阴影的约 6 级 + 环本身的约 9.7 级，要够到 26 级需要 α ≈ 10.4%。
  - *标定渲染（DPR 1.25）。* 4% → Δ14、12% → Δ29；插值到 Δ26 得 α ≈ 10.4%。
- 改完渲出的边缘是 **224**，Codex 两次实测落在 220–234（均值 ≈226）。12% 时渲出 220 —— 也在带内，但贴着最暗那头。
- **这张截图同时确认、无需改动的两处**：输入卡内部是 `#fffeff`（占 93.0% 像素）—— 0.5.8 白卡的第三份独立样本；
  主内容面板上沿描边 `#d6dae0`、衰减 1px→231 / 8px→234 / 24px→237 / 30px→240，与上一张逐点复现。
- **右栏：维持原样，但现在有证据了。** Codex 的分界实测是 **1px `#ededed`(237)**、两侧纯白、无影 —— 复现了皮肤注释
  里记录的"单像素 237"。皮肤实现是 `0 0 0 0.5px var(--dsw-alias-border-l1)`（7%）；按实测的 4%→16 级换算，
  7% 落在 235–237，与 Codex 差 ≤2 级。未改。
- **新细节（此前未记录）**：中列与右栏之间还有一条 **13px 宽的 `#ededed` 带**（x 781–793）—— 那是滚动条轨道，
  不是分界线。它与 sidebar-surface 层已经处理的 12px 滚动条槽对得上。
- **仍未取证**：这张截图里**没有**自带表面的弹层 —— 右侧那个列表（文件 / 侧边聊天 / 浏览器 / 终端）直接画在白底上，
  无边框、无阴影。所以 0.5.9 的 `--dsw-elevation-prominent` **依然没有截图证据**。
- 全套：`check-repo` PASS · `audit` ALL PASS (36/36) · `hero-verify` 25 · `model-picker` 20 · `rightbar` 42 ·
  `composer-shadow-verify` 23/23 · `elevation-verify` 19/19 · `sidebar-align` 6/6 · `sidebar-surface` 13/13。

## 0.5.9 - 2026-09-28

把皮肤里每一处阴影都同时对着 Codex 的源码和 Codex 的截图审了一遍，只有**一个**令牌能在没有新取证的前提下对齐。
可见变化很小 —— 这是一次保真度修正，不是缺陷修复。

### ⑲ `--dsw-elevation-*` 与源码双向对账

- 审计覆盖皮肤里全部 12 处阴影面，每处都过"源码令牌"与"截图实测"两道。结果见下节；只有一项现在可动。
- **`--dsw-elevation-prominent` 是自造值，而且它不是边角料。** 宿主在 14 处消费它 —— `.QsffPG_menu`、
  `._7KE1Ra_menu`、`.JObwrW_panel`、`stat-dialog`、`PopupSelectView`、`MenuView` —— 也就是**菜单与面板**。
  Codex 有**同名令牌**，逐字读自 asar 偏移 67930856：

  ```css
  --elevation-prominent: var(--elevation-stroke), 0 3px 7.5px #0000000a, 0 0 20px #0000000d;
  ```

  皮肤原本是自造单层 `0 4px 16px rgba(13,13,13,.08)`。现已逐字对齐。
- **暗色不再覆盖。** Codex 只在 `:root` 声明一次 `--elevation-prominent`、**没有暗色变体**，所以暗色沿用同一份
  字面值。皮肤原先的暗色覆盖（`0 4px 16px rgba(0,0,0,.5)`，50% 黑，零取证）已删除。后果：暗色菜单改为
  "发丝线 + 填充"，不再有沉重外影 —— 与 Codex 暗色的做法一致，0.5.7（输入卡暗色无外影）与 0.5.8（暗色靠
  填充分层）已经证过两次。
- **刻意没改的三处** —— 看起来像候选，但其实已经是对的：
  - `--dsw-elevation-stroke`（亮 8% / 暗 9%）。Codex 的**同名** `--elevation-stroke` 是 `--color-border-strong`
    = 15%/20%，很诱人。但实测否决了它：`codex-theme-dark.png` 里面板分隔线是 `#2f2f2f` on `#1c1c1c` =
    **8.4% 白**，对上皮肤的 9%，也对上 Codex 的 `--shadow-hairline`（亮 8% / 暗 10%）—— **不是** 20% 的
    `--color-border-strong`。改它就是拿一个猜测换另一个猜测，还要波及 32 处消费。
  - `--dsw-elevation-panel` 仍等于 `--dsw-elevation-stroke`（本皮肤的分层选择）。
  - `--dsw-elevation-soft` 在 Codex 里**完全没有对应令牌**，已标注为皮肤自造、待验。
- **新增夹具** `scripts/elevation-verify.mjs`（19 条）把四个令牌在亮暗两套下全部锁住：逐层几何与 alpha 对
  Codex 字面值、第 1 层跟随 stroke、第 2/3 层**亮暗必须逐字相同**（Codex 无暗色变体），并要求渲染出的菜单
  面板确实吃到该令牌。断言一律读**计算值** —— 自定义属性的字面值会省略 `0` spread、颜色写成 hex，
  按字面值断言会因记法差异误判。
- 全套：`check-repo` PASS · `audit` ALL PASS (36/36) · `hero-verify` 25 · `model-picker` 20 · `rightbar` 42 ·
  `composer-shadow-verify` 23/23 · `elevation-verify` 19/19 · `sidebar-align` 6/6 · `sidebar-surface` 13/13。
- **诚实交代**：渲染差异很小 —— 亮色衰减 13px → 14px、峰值 28 → 29；暗色外沿 19.5px → 14px。这次换来的是
  源码保真、以及删掉一处无取证的 50% 黑暗影；它**没有修掉任何你看得见的问题**。

## 0.5.8 - 2026-09-28

亮色输入卡暗了 11 级。Codex 的两个主题用**相反**的机制表达层级，而本皮肤把暗色的模型套到了两边。

### ⑱ 输入卡表面 —— 亮暗机制相反

- **暗色 = 填充分层。** 卡片比页面亮一档：5% 白叠 surface #181818 = 35.55（Codex 自己的暗色裁图
  `layer-codex.png` / `codex-card-ref.png` 实测卡内 #232323 = 35、页面 #111111 = 17，落差 18）。
  暗色还**没有投影** —— 见 0.5.7 的 `inset 0 0 1px 0 #fff3`。
- **亮色 = 阴影分层。** 卡片**与页面同色**（#ffffff），靠环 + 三层阴影立起来，不靠填充。三份独立实测同向：
  - `codex-composer-reference.png` 卡内众数 `#fffeff` 34.3% + `#ffffff` 14.9% + `#fefdfe` 13.2% = **62%**；
  - 用户 2026-09-28 同屏截图卡内众数 `#fffeff` 73.8% + `#fefdfe` 23.0% = **96.8%**；
  - `codex-app-reference.png`（整窗）`#ffffff` 76.5%。
- 本皮肤此前渲染成 `#f4f4f4`（5% 墨叠白），即**比 Codex 暗 11 级**。根因是层级搞混了：0.5.4 照抄的
  `--card: color-mix(in oklab, var(--foreground) 5%, transparent)` 属于 **widget / artifact 契约**
  （从 `codex.exe` 里读出来的），不是应用外壳的输入卡。现在叠罩只用于暗色，亮色直接取表面色。
- **0.5.7 把环改错了。** 它按源码把 12% 的环换成 `#0000000a`（3.9%）。但 `--elevation-composer` 的第一层并不等于
  整条边缘：输入卡**根本没有任何 border 规则**（asar 里对它只设过 `border-radius`），而渲染出来的边缘稳定地比
  3.9% 能达到的更深。两份 Codex 取证一致 —— `codex-composer-reference.png` 卡边 **220–234**、你的截图 **220–234**。
  在**你自己的 DPR（1.25）**下做标定渲染，三层阴影不变、只改环：

  | 环 | 渲染边缘 | 对 Codex 的 220–234 |
  |---|---|---|
  | 4% `#0000000a`（0.5.7） | **241** | 偏亮 7–21 |
  | 8% `#00000014` | 233 | 临界 |
  | **12% `--dsw-alias-border-l2`** | **226** | **命中** |
  | 15% `--dsw-alias-alpha-15` | 221 | 命中 |

  环改回 12%。夹具新增「渲染边缘必须落在 210–234」的断言，防止再次静默回归。
  （旧断言 `1px 处 ≤ 22` 已删除：它是按 DSF=1 + 4% 环标定的，量的其实是**环像素**，而 Codex 的"15"是环**外**一格 ——
  两者不是同一件事。）
- 同一张截图、同一套测法，两边对账：

  | | Codex | 皮肤 0.5.7 | 皮肤 0.5.8 |
  |---|---|---|---|
  | 页面 | `#ffffff` (92.3%) | `#ffffff` | `#ffffff` |
  | 侧栏 | `#f0f3f9` (96.4%) | `#eef4f9` | `#eef4f9`（未改） |
  | **输入卡** | **`#ffffff`** | `#f4f4f4` | **`#ffffff`** |

- `scripts/composer-shadow-verify.mjs` 扩到 23 条：亮色卡必须是 `#ffffff`、暗色卡必须 ≈35.55、且两者必须不同
  （两套机制按构造就是相反的）。同时加了**颜色记法归一** —— `color-mix` 会算成 `color(srgb …)` 而不是
  `rgb(…)`，按后者写断言会因记法差异误判（本次就踩了）。
- 全套：`check-repo` PASS · `audit-codex-ink` ALL PASS (36/36) · `hero-verify` 25 · `model-picker` 20 ·
  `rightbar` 42 · `sidebar-align` 6/6 · `sidebar-surface` 13/13 · `composer-shadow-verify` 23/23。
- 顺带更正 0.5.7 里"`26.727.4816.0` 无 asar"的说法 —— 它有。

## 0.5.7 - 2026-09-28

输入卡阴影此前是从截图上反推的。它其实是 Codex 源码里的一个具名令牌，读到之后一次修掉三件事：
环重了 3 倍、远场整层缺失、以及**暗色根本没有投影**。

### ⑱ 输入卡阴影 —— 读源码，不再拟合图片

- **取证面升级。** 本机两个 Codex 版本都是 Electron，都带 `resources/app.asar`：
  `26.727.4816.0`（211.6 MB）与 `26.924.2738.0`（460.3 MB）。新版的外壳样式表是
  `webview/assets/app-shared-fa3f1d5d5942.css`（1,154,547 B）。*更正（0.5.8）：本条原文说
  `26.727.4816.0` 是原生、无 asar —— 不对，那个版本同样有 asar；它没有的是重设计后的输入卡
  （`--elevation-composer` / `ComposerLayoutRoot` 在它的 CSS 与 JS 里都不存在）。*
- 输入卡阴影是一个**具名令牌**，逐字读自 asar 偏移 67930943：

  ```css
  --elevation-composer:      0 0 0 1px #0000000a, 0 2px 8px 0 #0000000a, 0 4px 80px 8px #00000006;
  --elevation-composer-dark: inset 0 0 1px 0 #fff3
  @media (width<40rem) { --elevation-composer: … 0 4px 40px 8px #00000006 }
  ```
  它只有一个挂载点，并且那个挂载点带着 `border: 0 !important` —— **Codex 的卡片边缘从不使用 border，
  0 模糊环就是边缘本身。**
- 本皮肤的三处修正：
  1. **环重了 3.1 倍** —— `rgba(13,13,13,.12)` → `#0000000a`（3.9%）。
  2. **远场整层缺失** —— 那层 2.4% 的 80px 宽晕在更早一轮被误判成"强行表现"删掉了。Codex 确实有它；
     它没有的是"只有宽层、前面没有近场"。
  3. **暗色是另一套机制** —— Codex 暗色**没有投影**，它用 `inset 0 0 1px 0 #fff3` 从内部把顶边点亮。
     本皮肤此前画的是卡**外**的 `0 0 0 .5px` 环。
- 真实渲染实测（deviceScaleFactor 2，与参考图同一套夹具）：**1px 处偏离 14.0、衰减半径 42px**，
  对上 Codex 的 15.0 / 42px（改前是 32.0 / 9px）。暗色：卡外偏离 **0.0**，卡内顶边 **47** 而卡体 **36**
  （改前 36 / 36，全平）。
- **新增夹具** `scripts/composer-shadow-verify.mjs`（19 条），因为暗色分支此前**完全没有覆盖**。
  它逐层断言几何与 alpha、断言真实渲染像素、并断言窄屏 80→40px 分支；内含一条前提自检，
  确认窄屏段确实退出了暗色 —— 否则暗色规则的特异性更高，会让窄屏断言在错误前提下"通过"。
- `check-repo` PASS · `audit-codex-ink` ALL PASS (36/36) · `hero-verify` 25 · `model-picker` 20 ·
  `rightbar` 42 · `sidebar-align` 6/6 · `sidebar-surface` 13/13 · `composer-shadow-verify` 19/19。

## 0.5.6 - 2026-09-28

深色窗口背景比 Codex 亮了一档 —— 输入卡贴着背景没有层次，根因就在这。

### ⑭ 深色「窗口背景 vs 表面」分层

- `--dsw-alias-bg-base` **#181818 → #111111**（`html`/`body` 两处画布字面值同步改）。
  `--dsw-alias-bg-sidebar` 保持 #181818。
- 依据：`assets/reference/codex-theme-dark.png` 就是 Codex 自己的主题取色面板，上面写着深色主题
  **背景 = #111111** / 前景 = #FCFCFC / 强调色 = #0169CC。渲染实测也一致：Codex 每一张裁图里
  输入卡四周恒为 **17**（= #111111）、卡片内部 **35**；而本皮肤此前渲染成 24 / 36。
- 两个值不冲突 —— 它们是两层。0.1.2 用的就是 #111111，0.5.x 读了 app.asar 的 `jdi.dark.surface`
  之后换成了 #181818；那是 Codex 的**表面色**，不是它的窗口背景。把两层并成一层，
  输入卡与背景的落差就从 Codex 的 **18 级掉到 12 级**。
- 卡片自己那一档保持不变：新增角色令牌 `--dsw-composer-surface`（亮 #ffffff / 暗 #181818），
  5% 罩叠的是**表面**而不是窗口背景。改完实渲：**页面 17、卡片 36**，对上 Codex 的 17 / 35。
- `scripts/hero-verify.mjs` ALL PASS (25)；`audit-codex-ink.mjs` ALL PASS（对比度已按新底色重算）。

## 0.5.5 - 2026-09-28

0.5.4 把输入卡做成了半透明，身后内容会透出来；现在把罩预先合成到基色上。

### ⑭ 输入卡表面

- `--dcu-composer-bg: color-mix(in oklab, var(--dsw-alias-label-primary) 5%, transparent)` →
  **`color-mix(in srgb, var(--dsw-alias-label-primary) 5%, var(--dsw-alias-bg-base))`**。
- 一行里两个独立的错。（1）Codex 的 `--card` 是叠在**不透明画布**上的 5% 罩 —— 它的输入区坐在实底
  页脚里；本皮肤的输入卡浮在会话滚动内容之上，留 `transparent` 就让身后的文件列表透出来（用户截图已复现）。
  （2）在 `oklab` 里插值会压缩亮端：5% 白混进 #181818 落在 34，而 Codex 那边浏览器实际做的是
  sRGB alpha 合成，落在 35.6。实渲暗色卡：**36**，页面 24。
- 亮色：5% 墨混进 #ffffff = 243.55，与 `assets/reference/codex-composer-reference.png` 实测的 240~246 对上。
- `scripts/hero-verify.mjs` 新增 `输入卡底不透明（不透视身后会话内容）` —— 计算值不得带 alpha。25 项全过。

## 0.5.4 - 2026-09-28

调研 Codex 的边框/阴影技术栈，并据此重做输入卡的表面与阴影。

### Codex 实际怎么做的（证据见本条的正文）

- Codex 是原生 `codex.exe`（Tauri/wry），**控件样式表**以明文嵌在二进制里，**应用外壳的样式不在**。
  能读到的那层令牌是「面向 agent 的控件契约」：
  `--shadow-sm: 0 1px 2px -1px rgb(0 0 0 / 8%)` —— **唯一一条阴影令牌** —— 外加
  `--card: color-mix(in oklab, var(--foreground) 5%, transparent)`、
  `--border: light-dark(rgb(26 28 31 / 8%), rgb(255 255 255 / 8.2%))`、
  `--radius: 12.5px` 加比例乘数、以及每个圆角盒子上的 `corner-shape: superellipse(1.5)`。
- 表面是**半透明罩**而不是不透明填充：`--card` = 前景色 5% 叠在身后的东西上。实测对账：
  5% 白叠 #181818 = 35，用户那张 Codex 截图里卡片内部正好 35；亮色 5% 墨叠白 = 243，
  `assets/reference/codex-composer-reference.png` 里条带实测 240~246。
- 浮层/菜单：`border: 1px solid var(--border); box-shadow: none`。焦点：`inset 0 0 0 1px var(--ring)`。
- 输入卡的外晕，按亮色参考图逐像素量：衰减约 20~25px，峰值 2~5% 墨（左 Δ6~10、下 Δ13、右 Δ2），
  边缘另有 1px 约 12% 墨的描边。**暗色完全没有外晕** —— 页面一直是 17，贴到卡边才出现单像素 41。

### ⑭ 输入卡表面与阴影

- `--dcu-composer-bg` 改为 `color-mix(in oklab, var(--dsw-alias-label-primary) 5%, transparent)` ——
  就是 Codex 的 `--card` 公式，一行同时管亮暗 —— 取代原先的不透明
  `--dsw-specific-input-major` / `--dsw-alias-bg-layer-1`。
- 亮色阴影 `0 0 0 1px #0000000a, 0 2px 8px #0000000a, 0 4px 80px 8px #00000006` →
  `0 0 0 1px var(--dsw-alias-border-l2), 0 8px 24px rgba(13,13,13,.05)`。
  原来那层 80px 比实测衰减宽三倍 —— 那是晕，不是边。
- 暗色仍是 0.5px 的 `--dsw-elevation-stroke` 发丝线（Codex 那边没有）。
- 尚未改、列为后续项：菜单/浮层仍带 `0 8px 28px`，而 Codex 用 `box-shadow: none` + 描边；
  焦点环仍是外描边 `outline`，Codex 用的是内嵌环。
- `scripts/hero-verify.mjs` 仍 ALL PASS (24)。

## 0.5.3 - 2026-09-28

0.5.2 的高度改过头了，按用户给的同缩放 DSH / Codex 卡片高度对照回退。

### ⑭ 输入卡高度

- 编辑区 `min-height` 64px → **44px**，底栏 `padding-bottom` 12px → **8px**（都回到宿主原值）。
  卡片 `padding-top` 12px 保留。
- 依据：用户给了 DSH 与 Codex 的输入卡并排图。两块是**同一缩放** —— 卡片角弧曲线数值上几乎完全相同
  （等效圆 R 29.6 vs 29.5，DPR 1.25），这同时也在真实屏幕上复核了 0.5.1 的圆角改动。
  卡片高度：**DSH 182、Codex 149** 设备像素，即 0.5.2 高了 35 设备像素（≈28 CSS px）；
  改之前是 147 对 149 —— 本来就是对上的。
- 真正有差的是**卡片上内衬**：卡片顶 → 占位文字墨迹，DSH 22.4 设备像素、Codex 29.25。
  所以只把 `padding-top` 8 → 12，其余不动。新总高 ≈ 152 对 149（+2%）。
- 0.5.2 的数字是拿**声明栈**（12 + 64 + 4 + 28 + 12）推的，不是量渲染结果；宿主 DOM 会贡献声明栈
  没建模的高度，所以那个栈不能当尺子。这条教训留在变更记录里，不留在 CSS 里。
- `scripts/hero-verify.mjs` 断言改为钉住编辑区 `min-height` 44、卡片 `padding-top` 12、
  底栏 `padding-bottom` 8。24 项全过。

### ⑭ 输入卡表面（沿用 0.5.2）

- 暗色底 `--dsw-alias-bg-layer-1`（#212121）与 `--dsw-elevation-stroke` 发丝线保留：
  同一缩放下实测 DSH 底色 33、Codex 35。

## 0.5.2 - 2026-09-28

输入卡本身：表面与纵向留白，对着用户给的 Codex 输入卡裁图量出来的。

### ⑭ 输入卡表面

- 暗色底 `--dsw-alias-bg-layer-2`（#282828）→ **`--dsw-alias-bg-layer-1`（#212121）**。Codex 那张裁图里
  卡片内部是平铺 #222222；#212121 是本皮肤暗色阶梯上最接近的一档（base #181818 → layer-1 #212121）。
- 暗色边缘：`inset 0 0 1px #fff3`（20% 白的**模糊**内发光）→ **`var(--dsw-elevation-stroke)`**
  （干脆的 `0 0 0 0.5px rgba(255,255,255,.09)` 发丝线）。Codex 的边缘在上、右、下三边都只有单像素行、
  比内部亮 6~7 —— 是一条硬边，不是一圈晕。「描边即层级」本来就是本皮肤各处通行的纪律，
  输入卡是唯一还在用模糊的那一面。
- 亮色主题不动（没有 Codex 亮色输入卡的参考图）。

### ⑭ 输入卡高度

- 编辑区 `min-height` 44px → **64px**，卡片 `padding-top` 8px → **12px**，底栏 `padding-bottom`
  8px → **12px**。
- 依据：把两边都按输入区字号归一（Codex 裁图里 CJK 步进 19.25 设备像素，本皮肤约 18），
  Codex 卡片的编辑区（卡片顶 → 控件行）≈79 CSS px、底部内衬 ≈12；本皮肤原来是 56 与 8。
  三处一改，栈变成 12 + 64 + 4 + 28 + 12 = 120，对上 Codex 的 ≈125。
- 控件尺寸没动（本皮肤是 28px 控件带）；Codex 那一行实测 ≈33px，所以卡片仍比 Codex 矮约 4%。
  `scripts/hero-verify.mjs` 新增三条断言钉住编辑区 `min-height` 64、卡片 `padding-top` 12、
  底栏 `padding-bottom` 12。24 项全过。

## 0.5.1 - 2026-09-28

上栏条的圆角仍然是错的。0.5.0 把它定成「卡片 − 4」，依据是在另一张参考图上目视量出来的弧长；
用户给出的一张同缩放 DSH / Codex 对照图推翻了那个读数。

### ⑬/⑭ 输入卡上栏条

- 上栏条不再有自己的圆角。`--dsw-radius-bar` 直接删除：上栏条
  （`[data-codex-filebar]`、`[data-phase=hero] [class*="_heroWorkspaceRow"]`）与卡片
  （`[data-composer-card]`）现在读同一个 `--dsw-radius-card`，条 ÷ 卡 恒等于 1。
- 证据：用户给的 DSH / Codex 同屏对照是同一缩放的。把四条角弧都量了一遍 —— 角弧曲线法
  （用合成真值标定过，±0.4px），再用角亏损面积积分交叉验证 —— 结果是 Codex 条/卡 = **1.03**
  （29 / 28），而本皮肤 **0.79**（16 / 20）。条比卡片紧约 5px，正是两块面叠在一起时露出的那条对不上的弧。
- 为什么「卡片 − 4」是错的：它来自在另一张参考图上目视读弧长（22 vs 26）。标定后的方法在
  本 `theme.css` 的真实渲染上，对声明值 16 / 20 / 25 分别读出 15.4 / 19.2 / 24.3 ——
  误差在 1px 内。所以弱环是那次目视弧长，不是现在这组数。
- 这条修法刻意不依赖卡片自己的取值：卡片是宿主的 28、皮肤的 20、还是皮肤的 25 + `corner-shape`，
  条都等于卡片，因此 `@supports` 的每一个分支都成立。
- 不设别名令牌：`--dsw-radius-bar: var(--dsw-radius-card)` 会让 `var()` 在声明它的 `body` 上就解析完，
  之后若有人在中层元素上改写 `--dsw-radius-card`，卡片会动而条不动。直接读卡片令牌就没有这个坑。
- `scripts/hero-verify.mjs`：两条上栏条断言改为「条 = 卡（字面量）」「条 = 卡（比值 = 1）」
  以及「条读的是 --dsw-radius-card」。21 项全过。

## 0.5.0 - 2026-09-28

圆角同心：把「内圆角 = 外圆角 − 内衬」写成皮肤纪律，并按它修掉四处失配。

### 圆角纪律（新增）

- 令牌层（`skins/codex-ink/skin.css`）新增 `--dsw-radius-menu: 18px`（浮层菜单）与
  `--dsw-radius-bar`（输入卡上栏条），并把同心公式写进刻度块注释：嵌套圆角一律取
  「外圆角 − 内衬」。
- 依据不是审美，是宿主自己的做法：MenuSurface 面板 16px（`--dsw-radius-lg`）+ 列表内衬 4px
  = 行 12px（`--dsw-radius-md`），原生本来就是同心的；皮肤把行写死成 8px 才是插件改散的。

### ⑫ 模型菜单

- 菜单面板 16px → **18px**。旧版为迁就刻度把参考仓库实测的 18px 折到 `--dsw-radius-l`，
  与输入卡的 20/25px 叠放时两条角弧肉眼可辨（这也是用户报的「圆角没对齐」的一半）。
- 行 / 单元格 8px → **13px**（= 18 − 内衬 5），与面板同心。
- 夹具 `scripts/model-picker-verify.mjs` 新增两条闭环断言：原生对照（宿主菜单 16 / 行 12）、
  「行圆角 = 菜单圆角 − 内衬」；20 项全过。

### ⑰ composer chip

- 模型 / 权限控件 8px（宿主 `--dsw-radius-sm`）→ **全圆角胶囊**；加号一并显式声明 pill。
- 依据：`assets/reference/codex-composer-chip-hover.png` 逐像素复测 —— 胶囊高 42px、最左点 x=13，
  最上一行边界在 x=29（离最左点 16px），正合 R = h/2 = 21 的预测值 16.4；若是 12px 圆角应为 8.6。
  旧版只搬了 Codex 的填充色，没搬圆角。
- 同心算术：卡片 20/25 − 内衬 8 = 12~17，都大于控件高（28px）的一半 14 ⇒ 按纪律本来就该取胶囊。
- 夹具 `scripts/hero-verify.mjs` 把宿主基线从 24px 改为源码值 8px（宿主 rc.2 的
  `.u91W7W_trigger` / `._5Tq8wa_trigger` 都是 `--dsw-radius-sm`），并新增卡外同款类名对照；
  18 项全过。

### ⑬/⑭ 输入卡上栏条（filebar / hero 工作区行）

- 上栏条两角 16px → **21px = 卡片 − 4**（`--dsw-radius-bar`，随卡片的 corner-shape 分支一起变：
  卡片 25 ⇒ 条 21，无 corner-shape 时卡片 20 ⇒ 条 16）。
- 依据：`assets/reference/codex-composer-reference.png` 用描边轨迹（不是阈值）逐像素复测 ——
  条的上左角弧跨 y 24→46 = **22px**，卡的上左角弧跨 y 82→108 = **26px**，即「条 = 卡 − 4」。
  旧值 16px 与卡片的 20/25 差 4~9px，两层叠放时两条角弧肉眼可辨。
- 同时覆盖 `[data-codex-filebar]`（⑬·2）与 `[data-phase=hero] [class*="_heroWorkspaceRow"]`（⑭·1），
  两者是同一族「探在卡片背后的条」。
- 夹具 `scripts/hero-verify.mjs` 新增两条断言：`上栏条圆角 21`、
  `上栏条跟着卡片：条 = 卡 − 4`（读的是计算值，改一边不动另一边就红）；20 项全过。
- 已知缺口（如实记录）：`[data-codex-filebar]` 这个锚点在本机装的所有插件里**没有任何生产者**
  （全盘检索只有 codex-ui 自己的 CSS 提到它），所以 ⑬·2 那条规则当前是空转的；
  hero 工作区行（宿主 `D_tfqW_heroWorkspaceRow`）才是眼下真正可见的那条。

### ⑭ 输入卡与触发菜单

- 删掉 `patches.css` 里 `[data-composer-card] { border-radius: var(--dsw-radius-l) }` 这条第二真源
  （16px）：它与 `composer.css` 的 20px / 25px 超椭圆争同一个元素，谁生效只看选择器权重，
  改一处会静默不生效。
- `[data-trigger-menu]`（@ / 指令建议菜单）12px → 18px，选项行 8px → 13px，与模型菜单同族同公式。

### 验收

- `node scripts/check-repo.mjs` → PASS（19 项）
- `node scripts/model-picker-verify.mjs` → ALL PASS (20)
- `node scripts/hero-verify.mjs` → ALL PASS (18)

## 0.4.0 - 2026-09-27

侧栏「面」：滚动渐隐从宿主那条 24px 覆盖层换成 Codex 的 40px 四段 mask 斜坡。

### 侧栏面（⑱）

- 宿主对同一件事有自己的做法：滚动容器旁边放一条 24px 的绝对定位覆盖层，底色是
  `linear-gradient(transparent → var(--dsw-specific-sidebar-fill))`。Codex 用的是
  `_headerFadeMask_n9nga_1` 的 `--sidebar-scroll-mask-image` —— 直接对内容做 alpha 遮罩。
- **这条改动的理由不是外观**，夹具把话说清楚了：四列并排、逐像素还原遮罩 alpha 曲线，
  不透明底下原生 A 与 codex-ui B 前 24px 逐点差 **≤0.122**、底边亮度差 **8.0/255** —— 两者几乎等价。
  真正的差在半透明侧栏底（设置卡的 `translucentSidebar`）：
  **底边亮度 原生 176.4 / codex-ui 240.3**，宿主那条覆盖层挡不住内容，留下 63.9 的墨色残留，
  mask 则完全免疫（B ↔ Bt 差 3.5）。
- 两处按 DSH 现场的改写都给了依据：① 斜坡的 `footer-edge` 取 100%，因为 DSH 的滚动容器底边
  就是底部固定区的顶边（真 GUI 实测 `listRect.bottom = regionRect.bottom = footRect.y = 844`），
  不像 Codex 那样把 footer 压在滚动内容上；② 不做顶部 8px 渐入，DSH 的分组标题不在滚动容器里，
  滚动视口顶上没有覆盖层，照抄只会让列表首行永远发虚。
- 两层 mask：第一层是斜坡本体、横向只铺 `100% − 12px`；第二层把那 12px 补回不透明。
  `mask-repeat: no-repeat` 下没铺到的区域 mask 值是 0（隐藏），不补第二层会把宿主的滚动条槽整条抹掉。
- 锚点：作用域根用语义锚点 `div:has(> [data-slot="sidebar.workspaces"])`（唯一命中 regionArea）；
  滚动容器与覆盖层没有语义锚点（真 GUI 实测整个 `[data-slot]` 集合里没有它们），
  只能加两个**后缀**锚点 `[class$="_list"]` / `[class$="_fade"]` —— build 报的 hash 锚点数因此 +2。
- `scripts/sidebar-surface-verify.mjs`：13 项断言，含「原生列 mask 为 none」「宿主覆盖层已让位」
  「渐变里有 Codex 的四段 alpha 停点」「第 2 层宽 12px」，以及两条像素级判据。

## 0.3.0 - 2026-09-27

顶栏两格**放开**：槽里的条目恢复渲染 —— 在此之前，派出去的子代理在界面上完全看不见在跑。

### 顶栏（⑬·3c）

- 0.2.x 为了对齐参考图的「只留会话名 + 右上角按钮」，把 `conversation.session.header.actions` 与
  `…utilities` 两个槽出口的内容整块 `display: none`。代价一开始没看出来：官方子代理包把
  **「后代数量触发器」（总数与运行数）** 注册在 actions（id `subagent-catalog`，order -30），
  同一格还有 jobs 的 roster、预设徽标、在应用中打开 —— 一起被关掉了。
- 现在只删掉那两条隐藏规则，其余一个字不改：视图页签仍旧隐去（参考图没有页签）。
- 这些条目**本身就是条件渲染**（没有子代理 / 没有 job / 没有预设 / 没有工作目录时各自返回 null），
  所以常态顶栏与放开前完全一样。真 GUI 的 A/B：空会话下叠加旧规则的顶栏几何
  （header 1138×41、右上角按钮 28×28、页签 display）**逐字段一致**。
- 配色不另配一套：条目只用 `--dsw-*` 语义令牌取色，本皮肤已重锚过这些令牌，因此跟着现在的皮肤走。
  夹具按官方真实类名建模后实测：徽标取色 `rgb(118, 118, 118)` = 皮肤的 `--dsw-alias-label-tertiary`；
  `--dsw-alias-fill-tsp-secondary` 未定义 ⇒ 不填底色；官方自带的高 22px / 圆角 6px / 字号 12px 原样保留
  （这三条是「没被皮肤改写」的防退步断言）。
- `scripts/hero-verify.mjs` 从 8 项扩到 **17 项**：新增会话名仍在、预设徽标可见、工具条目可见、
  页签仍隐去、右上角按钮仍在、徽标取色 / 圆角 / 高度、徽标不填底色。

## 0.2.0 - 2026-09-27

插件管理里那张设置页，加上深色基面按 Codex 应用自身的默认值重锚。

### 设置页（座位 `plugins.bundle.config`）

- 官方插件管理的组合包页上新增配置卡：主题 / 强调色 / 背景 / 前景 / UI 字体 / 代码字体 / 半透明侧边栏 / 对比度。
  座位键是**包名** `codex-ui`，表单命名空间是 **profile 条目 id** `codex-ui`，两者不能混。
- 宿主半新增 `export const Config`：11 个字段全部 `.default(x).volatile()`。设置服务只投影标了 `.volatile()` 的字段，
  也只为带 volatile 字段的条目暴露一份表单 —— 没有它，组合包页上就没有这张卡。
- 覆盖层是纯函数（`src/override.js`）：默认值下输出空串、不打 `data-codex-ui-theme`，装上不动一个字，
  外观与 0.1.2 逐字节相同；有覆盖时写一条运行时 `<style>`，选择器比皮肤多一个属性（特异性 +1），
  `skins/*.css` 一个字不动。
- 改一下即写、没有保存按钮；文本框回车或失焦提交，写后回读确认落地；已覆盖的行有徽标与「重置」。
- 对比度按 Codex 默认档位归一（亮 45 / 暗 60 即原样）：文本档位往 ink 方向混合、中性 alpha 阶梯按比例缩放
  （夹在 0.5×–2×）。**这是简化实现**，没有复刻应用的 `Rdi + zdi·contrast` 线性混合常量，README 如实写明。
- 半透明侧边栏在 Web 上没有窗口层可透，深色下侧栏又与内容同面；开关因此同时把侧栏行填充转半透明，
  免得整个开关在深色下无声。差距如实记录，不当作等价实现。
- 新增 `skins/codex-ink/settings.css`（只取 `--dsw-alias-*` 令牌，零彩色）与 `scripts/settings-page-verify.mjs`
  （真 GUI 13 项断言）。

- 主题行接上宿主主题服务（`ctx.theme`，由 @deepseek-ai/dsh-client-ui-theme 提供）：三档 亮色/深色/跟随系统，
  写的是 `ui-theme` 的 `preference`，与「设置 → 通用 → 外观」同一处 —— 切完整应用一起变、刷新后还在；
  下面三行颜色随之编辑当前生效的那一套。`inject` 增加服务名 `theme`。
- 新增 `scripts/make-verify-profile.mjs`：造一次性验证 profile（插件管理页开着、只挂本插件），
  让 `settings-page-verify` 在任意机器上可复跑。真 GUI 断言 13 → 20 项（补主题切换、深色生效、
  刷新后偏好仍在、收工复位），并改为幂等：每次先清掉上轮残留的覆盖与主题。
- 修两个真 bug，都是真 GUI 断言抓到的：`jsxs(type, props, children)` 的第三参是 **key**（配置卡渲染成空 div）；
  以及把「每次返回新对象」的读数交给 `useSyncExternalStore` —— React 报 #185（最大更新深度），
  宿主只留一行 `slot entry crashed in 'plugins.bundle.config'`，整个座位条目不渲染。

- 防闪加固：画布改由皮肤自持（`html`/`body` 两个主题的底色都自己画，`html` 用 `:has()` 跟上 body 上的主题标记），
  并在 `theme/change` 后两帧内关掉全部过渡（`html[data-codex-ui-switching]`）。实测深色画布从宿主的
  `rgb(16,22,36)` 变成皮肤的 `#181818`。
- 新增 `scripts/theme-flash-probe.mjs`：按帧采样切换过程中的「有效底色」（沿祖先找第一个不透明底色），
  9 段约 720 帧、当前 0 个中间态帧 —— 这类闪屏在无头 Chromium 里复现不出来，探针留着做回归。

- 修「切主题闪两下（黑 → 白 → 黑）」：主题偏好改为**写文档优先**。宿主 `theme.setTheme()` 是「先乐观发布、
  再由 `adopt()` 从设置文档回读」的写法，文档往返慢时会出现 新值 → 旧值 → 新值；卡片改为直接把 `preference`
  写进主题插件自己的设置文档（与服务内部 `host.set` 同路），发布方只剩 `adopt()`，一次点击只发布一次。
  真 GUI 20 项断言全过（含主题切换、刷新后仍在、收工复位）。**注**：本机无头 Chromium 里这条闪屏复现不出来，
  这次修的是唯一能产生该序列的机制，不是"看着好了"。
- 覆盖层加固：设置文档瞬时不可用（`status=loading` / 刚重连）时不再把已生效的覆盖撤掉 —— 那会让用户自己的设置闪一下没了。
- `scripts/theme-flash-probe.mjs` 增加「深浅序列」报告（`L×12 → D×68`），段数多于 2 就是回打。

- 切主题不再等往返：浏览器半加**本地预览**（点下去立刻按目标主题应用 `body[data-ds-dark-theme]` 与
  `html` 的 `color-scheme`，`theme/change` 带同一结果回来时幂等交还，2.5s 等不到就回滚）。
  实测点击→变色 **824ms → 22ms**（中位，探针 4 次采样 22/18/18/31ms），深浅序列仍是两段、无回打。
- `settings-page-verify` 20 → 22 项：新增「点下去 ≤300ms 变色」（预览生效）与「文档落地后预览标记被摘掉」
  （不卡在预览态）两条断言。

### 深色基面

- 背景 `#111111 → #181818`、前景 `#FCFCFC → #FFFFFF`、侧栏 `#171717 → #181818`（与 surface 同面）、
  层1/2/3 `#1f1f1f / #2a2a2a / #353535 → #212121 / #282828 / #303030`、alpha 家族
  `rgba(252,252,252,·) → rgba(255,255,255,·)`。取值来自应用 `resources/app.asar` 里的 `jdi`
  （`surface #181818` / `ink #ffffff`）与生成灰阶；0.1.x 用的取色面板三值不再使用。深色链接仍是应用的
  text-link 令牌 `#0169CC`。
- 皮肤审计 36 组 WCAG 重跑全过（深色底变浅后比值上升，最低一组 4.35）。

### 工程

- `src/build.mjs` 增加两个占位符：覆盖层模块（构建期去掉 `export` 包成 IIFE）与设置卡片；
  出现不支持的 `export` 形式直接抛，不静默漏导出。
- `scripts/check-repo.mjs` 从 13 项加到 19 项：Config 字段齐全且全 volatile、默认值不产生 CSS、色值/字体栈校验、
  对比度恒等与上下限、覆盖层与 `skin.css` 逐条对账（37 条）、产物里确实带上设置页与覆盖层。
- `scripts/install-plugin.mjs` 新增 `--bundle`：把包名写进 `dsh.profile.bundles` 并清掉冗余 `- insert:` 块
  （两条注册路径同时存在会造成重复 loader 条目 id）。web profile 已切到 bundle 注册。
- 修一个真 bug：设置卡片里 `jsxs(type, props, children)` 的第三参其实是 **key**，children 必须放进 props，
  否则渲染出空元素。已加体检断言防复发。

## 0.1.2 - 2026-09-26

按 Codex 桌面应用自身的令牌对齐（应用 `26.727.4816.0`，`resources/app.asar` → `webview/assets/app-*.css`）。

- 动效：`--dsw-motion-fast/base/slow` 100/160/240ms → 150/200/300ms；`--dsw-ease` → `cubic-bezier(.4, 0, .2, 1)`，
  取自 Codex `--transition-duration-basic`、`--transition-duration-relaxed` 与 `--default-transition-timing-function`。
- 焦点环：墨色 → Codex `--color-border-focus`（`#339cff`，深色 `rgba(51,156,255,.7)`），涉及四份样式表。
- pending 转圈：620ms → 1s linear，取自 Codex `--animate-spin`。
- 深色 composer 悬停底：推导的 6% → 8%，取自 `--color-background-button-secondary-hover`。
- `hero-verify`：悬停断言改为等过渡落定；新增焦点环断言（共 8 项）。
- `README` 新增「与 Codex 源码对账」一节，列出各项取值来源与刻意保留的差异。

## 0.1.1 - 2026-09-26

构建、体检与 CI。除模板头注释外，插件渲染结果不变。

- 构建：作用域化与产物生成收进 `src/build.mjs`；`scripts/install-plugin.mjs` 与新增的 `scripts/build.mjs`
  都调它，`theme.css` 与 `client.js` 不会再互相漂移。
- 体检：`scripts/check-repo.mjs`（`npm run check`）校验语法、JSON、清单自洽、产物与源样式同源、样式表卫生、
  文本编码、双语文档成对、机器专属路径，不需要宿主。
- 修 `skins/codex-ink/README.zh-CN.md`：原文件是 GBK 字节被当 UTF-8 写入的乱码且带 BOM，按英文版重写为无 BOM 的 UTF-8。
- 宿主路径：`scripts/host-paths.mjs` 按 `DSH_ASAR` / `DSH_GLOBAL_MODULES` / `DSH_CHROME`、已 gitignore 的
  `scripts/host.local.json`、常见安装位置扫描的次序解析 `app.asar`、全局 `@deepseek-ai` 包与 Chromium；
  四支夹具验收与真 GUI 探针不再写死机器路径。
- 真 GUI 探针：量 pending 窗口前先开一个新会话；对实测到的阴影、两条分界线、pending 窗口断言（10 项），
  量不到的阶段打印 `SKIP`，断言不过退出码非 0。
- CI：`.github/workflows/ci.yml` 在 Ubuntu 与 Windows、Node 22 与 24 上跑上述两条命令。
- npm 脚本：`build`、`check`、`install:web`、`install:desktop`。

## 0.1.0 - 2026-09-26

首个版本。

- 窗口边缘：会话窗口 0.5px 发丝线加 24px 全向环境影；右栏面板左沿只留发丝线、影用负 spread 只往上泄。
- 分界线：右分界线拖拽柄悬停出现中段最深、两端淡出的 2px 渐变；左分界线保持静态发丝线。
- 主题色按 Codex 取色面板复刻：浅色 `#339CFF` / `#FFFFFF` / `#1A1C1F`，深色 `#0169CC` / `#111111` / `#FCFCFC`；深色层级自 `#111111` 重锚。
- ⑰：加号默认无底色框、悬停才填；模型选择器与权限控件加同套悬停胶囊 `#F2F2F3`。
- ⑫：模型菜单对齐 Codex，pending 窗口内行尾勾选换成转圈，光标 progress。
- ⑯：右栏展开选择组件平行化，含 terminal 插件自定义卡的定点规则。
- ⑬⑭：输入区顶栏消隐，输入卡几何、阴影、工具条与 hero 布局。
- ②：侧栏配色与列对齐。
- 安装器与验收脚本：`install-plugin.mjs`（含重复注册检测与清除）、`install-skin.mjs`（SHA256 漂移检测）、
  `audit-codex-ink.mjs`、四支夹具验收、`live-gui-probe.mjs` 真 GUI 探针。
