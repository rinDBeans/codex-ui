# codex-ink · 墨白终端

代码方向为 Codex / ChatGPT。这是 codex-ui 插件的样式正本：`scripts/build.mjs` 读本目录的十份 CSS，把选择器作用域化到
`html[data-codex-ui]`，写出 `theme.css` 并内联进 `client.js`；安装见仓库 README（`dsh plugin add link:`）。同一份目录也满足
Skin v2 清单格式，可由皮肤加载器单独收录。

## 文件

| 文件 | 层 | 内容 |
|---|---|---|
| `skin.json` | 清单 | id、accent、明暗预览图 |
| `skin.css` | L1 令牌 + L2 排版 | `--dsw-alias-*` 重映射；spacing / radius / 字阶 / motion / elevation 令牌层 |
| `patches.css` | L3 组件 | 焦点环、链接、卡片契约、mono pill 徽标、tag tone 归一、reduced-motion、⑫ 宿主模型菜单（A 面）、⑬ 输入区顶栏与卡片、⑯ 右栏展开选择组件、⑰ composer 控件悬停 |
| `model-picker.css` | L3 模型选择器组件 | B 面：`src/client/model-picker/` 自建的触发器、弹层与推理等级功率轨（Codex `_Track` / `_Tick` / `_Thumb` 逐字几何）；只画 `.codex-mp-*` 与席位的一条隐藏规则，不碰宿主菜单。验收 `scripts/verify.mjs model-picker` |
| `sidebar-align.css` | L3 侧栏对齐 | 新会话行与插件行落到工作区列表行的两条竖线（图标列 20px、文字列 42px）；选择器同时覆盖 rc.1 扁平 DOM 与 rc.2 嵌套 DOM |
| `overlays.css` | L3 浮层 | 浮层材质：把宿主的 `blur(40px) saturate(150%)` 压成不透明层；长列表溢出局部化到 `[data-trigger-menu]`。验收 `scripts/verify.mjs text` |
| `content.css` | L3 会话内容 | 工具行、回合摘要/详情、状态三档；状态词表与宿主 `ToolRowState` 联合对账。验收 `scripts/verify.mjs content` |
| `sidebar-rows.css` | L3 侧栏行 | 用宿主语义属性（`[data-row-key^="session:"]`、`[aria-selected="true"]`）把既有行状态映射成视觉；并把选中底色与悬停底色分开（宿主默认两者同一令牌）。验收 `scripts/verify.mjs sidebar-rows` |
| `composer-queue.css` | L3 后续消息队列 | 把宿主的 `data-queue-dock` 面板并入输入卡那一族：顶部圆角跟 `--dsw-radius-card`，按 `overlays.css` 先例去掉 40px 背景糊影。验收 `scripts/verify.mjs queue-dock` |
| `panels.css` | L3 右栏面板 | 滚动区按皮肤滚动条约定走 `::-webkit-scrollbar`，令牌与 `overlays.css` 同源；无后代通配符。验收 `scripts/verify.mjs panels` |
| `appearance.css` | L3 外观与字号 | 皮肤色板没覆盖到的两处宿主行：选中的外观格与字号步进器圆角。复用宿主自己的 `FontSizeRow` store 与 `AppearanceRow`，不新增配置字段。验收 `scripts/verify.mjs appearance` |
| `sidebar-surface.css` | L3 侧栏面 | 侧栏滚动渐隐：把宿主那条 24px 覆盖层让位，改用 Codex 的 40px 四段 mask 斜坡（挂在滚动容器上，右侧 12px 让开滚动条槽）。验收 `scripts/verify.mjs sidebar` |
| `window-shadow.css` | L3 窗口边缘 | 会话窗口 0.5px 发丝线加 24px 环境影；右栏面板左沿只留 0.5px 发丝线、影只往上泄；右分界线拖拽柄悬停渐变 |
| `composer.css` | L3 输入区 | 卡片几何与表面、编辑区 44px、底部控件行 28px、候选菜单、hero 布局。本层允许使用 `[class*=…]` 后缀锚点 |
| `settings.css` | L3 设置页 | 插件管理 → 组合包页那张配置卡的版式（`.cx-*`） |
| `settings-modal.css` | L3 设置模态框 | ㉑ 设置对话框的全页 Codex 化：分组侧栏、搜索框、页头、发丝线白卡、粘底保存条。隐藏态靠持久 `data-*` 属性兜底，宿主重写 `className` 也不失效。结构来自 `src/client/settings-modal.js` |
| `trajectory-exit.css` | L3 轨迹退出出口 | ⑬d 的「← 对话」浮标：轨迹视图显示时浮在视图区左下角，让 ⑬ 隐去页签条之后该视图仍有出口。结构来自 `src/client/trajectory-exit.js` |
| `preview/` | 资源 | 明暗预览图 |

## 设计规则

1. chrome 以墨色为主：按钮与选中态都是墨色；浅色主题主按钮为墨底白字，深色反转。例外只有强调色：链接（浅 `#339CFF` / 深 `#0169CC`）、焦点环（Codex `--color-border-focus`，`#339CFF`，深色 70%）与功率轨的已选段。
2. 灰阶承担层级。浅色 `#FFFFFF → #F1F1EF → #E5E5E5`；深色 `#111111 → #181818 → #212121 → #282828`（窗口背景 `#111111`、**表面** `#181818`；输入卡坐在表面上，分隔靠 0.5px 发丝线）。侧栏是另一条链：浅 `#F6F6F6` / 深 `#0F0F0F`，两套里都比主区低一档。
3. 浅色侧栏 `#F6F6F6` = Codex 的 `--color-surface-tertiary`（`#F3F3F3`）以 70% 叠白（Codex 没有侧栏令牌，那一面是半透明遮罩），激活行 `#E9E9E9`，悬停 `#F0F0F0`。
4. 元信息（token 数、模型名、时间戳、徽标、路径、快捷键）用 `--ds-font-family-code`、11px、`.04em`/`.08em` 字距；`:lang(zh)` 下中文免字距与大写。
5. 圆角与间距取自 `--dsw-radius-*` 与 `--dsw-space-*`。卡片用 0.5px 描边代替投影。
6. 动效为 150 / 200 / 300ms，缓动 `cubic-bezier(.4, 0, .2, 1)`（取自 Codex 应用的 `--transition-duration-*` 与 `--default-transition-timing-function`）；`prefers-reduced-motion` 下直接跳到终态。
7. 彩色白名单：state 三色、diff 红绿、徽标底色（state 色 8% 到 16% 透明度），以及强调色本身（链接、焦点环、功率轨）。任务板 6 档 tag tone 归到 state 三色加墨色与灰色。

## 第三方插件的令牌契约

1. 颜色只用 `var(--dsw-alias-*)`，不写十六进制字面量。
2. 圆角与间距只用 `var(--dsw-radius-*)` 与 `var(--dsw-space-*)`。
3. 悬停把背景抬高一级；不加自定义投影。
4. 不使用白名单外的彩色。
5. 元信息用 `var(--dsw-font-meta)` 与 `--dsw-meta-size`、`--dsw-meta-tracking`。

## 验收

```bash
node scripts/check.mjs
```

其中与本目录有关的几项：`skin.json` 结构、实测 36 组 WCAG 对比度、`patches.css` 的彩色白名单。
当前结果：36/36 通过，19 组 AAA，白名单外彩色 0 个。

## 安装

```powershell
dsh plugin --profile web add link:<仓库绝对路径>   # 插件路径，主用法
node scripts/install-skin.mjs --write             # 皮肤加载器路径：同步到 $DSH_HOME/skins/codex-ink
```

## 未覆盖

- Shiki 语法高亮未在此去饱和：高亮器自己内联发色。本层只通过 `--dsw-alias-markdown-code-block` 一类令牌约束代码块底色。
- `patches.css` 能通过加载器安全管道并被正确作用域化，但没有单独在真 GUI 上应用过；单独应用会改写皮肤选择。
