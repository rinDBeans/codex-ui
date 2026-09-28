# 下一批：还没做的组件、功能与优化（对账稿）

> 本文是一次**只读对账**，不动任何皮肤文件。所有数字都由第 0 节的命令在本机现跑得出，
> 不是估计值；未能实测的效果断言一律标注「待实测」并附验收命令。

## 0. 证据怎么来的

三份输入：Codex 桌面应用的 webview 产物（`<codex-ref>/codex-app*.css`、`codex-theme-generated.css`、
`app-*.js` 提取件）、Codex 公开仓库（`<openai-codex 克隆>`，Rust CLI/TUI + app-server，**不含**桌面界面）、
宿主 DSH `0.1.7-rc.2` 的 `app.asar`（`dsh-client-ui-*` 共 52 个包的 shipped JS/CSS）。

三条可复跑的对账命令（脚本在 `<codex-ref>/`，临时候选，见 §4.2）：

| 脚本 | 回答什么 |
|---|---|
| `token-diff2.mjs` / `token-diff3.mjs` | 宿主声明的 `--dsw-*` 里，皮肤没重锚的是哪些（395 → 168 已声明） |
| `host-token-usage2.mjs` | 每个令牌**到底有没有消费者**、被哪些包消费多少次 |
| `coverage-matrix.mjs` | 皮肤锚点（`data-*` / 哈希类名）**在哪些包的 DOM 里出现过** |

结论先行：**皮肤对「壳」已经够用，真正的缺口在内容组件。** 本轮先证伪了一条我自己最看好的假设
（焦点环「两套颜色」），保留下来的令牌级发现只有三条，且都不是「可见的错」，而是「按现在的写法改不动」——
见 §1。

## 1. 令牌级缺口（改一行、覆盖一片）

宿主把外观做成两层：`--dsw-static-*`（原语）→ `--dsw-alias-*`（语义）。我们重锚的是**语义层**
（86 条 alias + 11 条 specific + 5 条 elevation），原语层 0 条——这个纪律是对的，但有三处语义令牌
**直接指向原语**，于是我们够不到。

| # | 项 | 证据 | 结论 |
|---|---|---|---|
| 1.1 | ~~键盘焦点环是两套~~ → **已证伪并清除** | 宿主在 50 个 `client.js` 里有 **108 条 class 级 `:focus-visible` 规则**（162 个类，28 个包），特异性 (0,2,0)，用 `var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary))`；但皮肤 ① 是**属性作用域**规则，特异性更高 | **实测（真 GUI）**：`button._brand` 强制 `:focus-visible` 后 = `rgb(51,156,255) 2px solid offset 2px`；就地注入一条与宿主逐字相同的 class 级规则，颜色**不变**（仍蓝）→ 皮肤赢，全场统一，不需要动 |
| 1.1b | ~~残留：10 条用 `box-shadow: inset` 画环的规则**不吃皮肤 ①**~~ → **0.6.0 已做**：`skin.css` 声明 `--dsw-focus-ring-color: var(--dsw-codex-focus)`，皮肤自己的环也改读它（顺带继承宿主「指针操作不出环」的约定） | 108 条里有 **10 条**是 box-shadow（deliverables / model-selection / permission-presets / schedule / settings-models / settings-plugin-inventory / trajectory）；`--dsw-focus-ring-color` 未定义 → 落回 fallback = 我们重锚的墨色 | 这些组件聚焦时会「墨色内环 + 蓝色外框」同时出现。**1 条声明**可消除（把 `--dsw-focus-ring-color` 定义成 `var(--dsw-codex-focus)`），属可选打磨 |
| 1.2 | **圆角家族错位**（陷阱，不是外观问题） | 宿主消费 `-sm` 101、`-md` 74、`-lg` 63、`-xs` 19、`-xl` 24、`-panel` 6；皮肤的 `-s/-m/-l` 在宿主里是 0 消费者，值恰好相同(8/12/16) | 改 `--dsw-radius-m` 不会动宿主任何组件。要么重锚 4 个长名，要么写进 README 当纪律 |
| 1.3 | `--dsw-motion-*` / `--dsw-ease` 是**我们自造的刻度** | 宿主 `--dsw-motion-*`、`--dsw-duration-*`、`--dsw-ease` 消费数均为 **0** | 无害，但别误读成「宿主动效开关」；动效实际靠 ⑬·7 的选择器覆盖 |
| 1.4 | 直接指向原语的语义令牌（**候选，待定点实测**） | `--dsw-alias-menu-icon`(暗) ← `--dsw-static-neutral-bluish-800`；`--dsw-alias-bg-document-preview` ← `bluish-100/950`；`--dsw-alias-label-document-preview` ← `bluish-700/300`；`--dsw-alias-onboarding-accent: #3964fe`；`--dsw-alias-toast-label`、`--dsw-alias-tooltip-key-bg` | 「指向原语」是确凿的；「真渲染里露蓝」**本轮没取到点**：探针在 light 模式下读到 `--dsw-alias-bg-document-preview = #43454a`（一个暗色值）而 `--dsw-alias-menu-icon` 读不到，说明这些令牌的声明作用域不是 body。补一次定点取样再决定动不动 |

已对账清楚、**不用动**的：diff 8 条令牌全覆盖；滚动条 4 条全覆盖；`--dsw-font-base-16-*` /
`--dsw-font-markdown-code-font-family` 都指向 `--ds-font-family-code` / `--dsw-font-family`，
所以设置页的字体两条**确实**一路走到正文与代码块（不需要再补）。

## 2. 组件级缺口：50 个客户端包里 19–28 个零锚点

`coverage-matrix.mjs` 拿皮肤用到的 **39 个 `data-*` 锚点 + 3 个具名哈希类 + 10 个 `[class$=…]` 后缀**，
去每个 `dsh-client-ui-*` 包的 `lib/client.js`（50 个包有这一入口）里找：

| 口径 | 有命中 | 零锚点 |
|---|---|---|
| 只算 `data-*` + 具名哈希类 | 22 | 28 |
| 再加 `[class$=…]` 后缀（宽松） | 31 | 19 |

两个口径指向同一批**日常可见却没有一条规则**的组件（下表按可见度排）。命中数 = 1 的包
（`jobs`、`plan`、`attachment`、`permission-presets`、`shortcuts`、`sidebar-browser` 等）是
「某条通用后缀碰巧命中」，不算真覆盖，需要逐个复核后才敢说做了。

| 优先级 | 包 | 为什么 |
|---|---|---|
| P0 | `tool`、`approval`、`skill` | 每轮对话都会出现的内容卡（工具调用 / 审批 / 技能），零锚点 |
| P1 | `reference`、`session`、`goal`、`commands` | 引用卡 / 会话 / 目标 / 命令面板 |
| P2 | `settings-shell`、`settings`、`settings-agent-loop`、`settings-plugins`、`settings-plugin-inventory`、`settings-subagent`、`settings-web-search` | 设置各分区外壳；我们只给自己那张卡写了 `cx-*` 样式 |
| P2 | `sidebar-files`、`sidebar-documentpreview` | 侧栏页签容器已被 ⑯ 覆盖，页签**内容**没有 |
| P3 | `brand-official`、`open-in-app`、`directory-picker-native` | 低频或宿主原生控件 |
| 已覆盖·不动 | `conversation`(22) `sidebar-right`(13) `layout`(8) `sidebar`(6) `settings-account`(6) `workspace`(5) `sidebar-terminal`(4) `schedule`(4) … | — |

注意口径：零锚点 ≠ 一定难看。`data-dsh-part` / `data-slot` 这类锚点让**第三方插件**贡献的卡片
自动吃到 ④ 卡片契约；第一方组件不发这些属性，所以「零锚点」的准确含义是
**我们没有任何一条规则是冲着它写的**，只剩继承与通用规则。

## 3. 功能候选（超出现有边界，需要你先拍板）

现状边界很清楚：本插件 = **皮肤 + 一张设置卡**（座位 `plugins.bundle.config`），不做结构。
上游 `@michengai/dsh-codex-ui` 1.1.16（工作区 `dsh-codex-ui\` 的克隆，67 个客户端文件）走的是另一条路：
结构插件——侧栏树/置顶/拖拽排序、会话重命名·归档·删除·fork、头部搜索、轮次导航、输入历史（空输入框 ↑/↓）、
usage 统计、About 里装更新配套插件、命令面板、工作区切换、hover 提示、composer 宽度、新建页建议。

它已经证明这些座位可用：`sidebar`、`sidebar.workspaces`、`sidebar.panellist`、`sidebar.footer.action`、
`conversation.input.dock`、`conversation.session.header.utilities`、`settings.section`、`main`。
**但 `sidebar` 这类 single 座位是互斥的**（后注册者赢），两者同装会抢座位。

| 候选 | 宿主接口 | 上游先例 | 建议 |
|---|---|---|---|
| 字号（宿主 `theme` 服务已暴露 `fontSize`，我们没放出来） | 已有 | 有 | **做**：设置卡第 9 行，与主题同一条写入路径 |
| 命令面板 / 快捷键表外观 | 纯 CSS | 有（结构） | **做**：属 §2 的 P1，不需要抢座位 |
| 内容卡（tool / approval / skill）外观 | 纯 CSS | 部分 | **做**：性价比最高的一批 |
| 轮次导航 / 输入历史 / 侧栏树 / 会话管理 | 需抢 single 座位 | 有 | **不做**：与上游重复，且座位冲突 |
| 预设 / 导入导出 / 取色器 | — | 无 | **不做**：此前已定，属过度设计 |

## 4. 工程优化

### 4.1 显式锚点漂移检查（建议入库）
皮肤引用的哈希类名锚点由 `node scripts/build.mjs` 自报。0.4.0 现场读数：`patches.css` 11 +
`sidebar-surface.css` 2 + `composer.css` 18，其余五份 0（README「边界」另有记法，计数口径不同；
本文档早先写的 patches 12 是 0.3.0 之前的读数，已按现跑值更正）。宿主升级
（本机同时存在 `0.1.7-rc.1` 与 `rc.2`，仓库根还躺着三份升级计划）时，这些锚点消失只会表现成
「某个角突然不圆了」，不会报错。做法：从 `app.asar` 抽全量类名清单，比对皮肤引用的
哈希锚点 + `data-*` 锚点，缺失即 FAIL。代价小、收益是**把静默视觉回归变成一条红色断言**。

### 4.2 覆盖矩阵脚本入库
把 §2 的 `coverage-matrix.mjs` 整理成 `scripts/audit-coverage.mjs`（只读 `app.asar`，不需要宿主），
输出「包 × 锚点」矩阵与「零锚点包」清单。它不进断言、只做信息输出，但当缺口看板足够用。

### 4.3 对比度仍是简化实现
README 已承认：只做「文本往 ink 混合 + alpha 按比例缩放」，没有复刻应用的 `Rdi + zdi·contrast`
线性混合常量。要贴近需要把 Codex 的混合常量搬进来，收益只在滑块两端可见——**先不做**。

## 5. 够不着的（如实列出，不假装能做）

- Codex 的**窗口级半透明/毛玻璃**：那是 Electron 窗口层，Web 宿主没有这一层，只能做侧栏填充半透明。
- Codex 的 `--corner-shape: superellipse()` 全应用一致性：宿主只声明不消费，我们只在输入卡上用过。
- Codex 的**语法高亮主题**：宿主没有 `syntax` 类令牌，markdown 代码块走 `--dsw-alias-markdown-code-*`（已覆盖），
  真正的 token 着色由渲染器自带主题决定，不在皮肤管辖内。

## 6. 建议的批次

| 批次 | 内容 | 验收 |
|---|---|---|
| P0 | §1.4 定点实测（决定动不动那批令牌）+ §1.2 圆角家族对齐（4 条声明，消除陷阱）+ §1.1b 10 条 box-shadow 环的颜色 | `npm run check` + 真 GUI 取样；§1.4 的取样命令见下 |
| P1 | §2 的 P0/P1 组件（tool / approval / skill / reference / commands / settings-* …） | 每项一条真 GUI 断言（沿用 `live-gui-probe.mjs` 的写法） |
| P2 | 字号行 + §4.1 漂移检查 + §4.2 覆盖矩阵 | 设置卡断言从 22 条扩到 24 条；漂移检查进 `npm run check` |
| 不做 | §3 的「不做」列 + §5 | — |

P0 是**声明级别**的改动（§1.1b 一条、§1.2 四条），风险最低，做完复跑现有 22 条设置卡断言即可；
P1 才是真正「补组件」的工作量所在。

## 7. 本轮真 GUI 实测记录（可复跑）

临时 profile + 真 GUI（步骤与 `settings-page-verify.mjs` 相同）：

```
node scripts/build.mjs && node scripts/make-verify-profile.mjs
$env:DSH_HOME = "$env:TEMP\codex-ui-verify-home"
node scripts/install-plugin.mjs --profile verify --write
dsh --profile verify --port 3098 --no-open      # 终端会打印带 token 的 URL
node <codex-ref>/focus-ring-probe.mjs     --url "<URL>" --chrome "<Chromium>" --dialog
node <codex-ref>/focus-mimic-probe.mjs   --url "<URL>" --chrome "<Chromium>"
```

读到的原文：

| 读数 | 值 |
|---|---|
| `button._brand` 强制 `:focus-visible` | `rgb(51,156,255) 2px solid offset 2px`（= 皮肤 ① 的强调蓝） |
| 同元素再叠一条宿主形态的 class 级规则 | 仍 `rgb(51,156,255) 2px solid offset 2px` → 皮肤规则赢，§1.1 假设**证伪** |
| `--dsw-focus-ring-color`（元素上） | `(未定义)` → 宿主 98 条 outline 规则落回 fallback，但被皮肤 ① 覆盖；10 条 box-shadow 规则不被覆盖（§1.1b） |
| `--dsw-radius-md` / `--dsw-radius-m`（body 上） | `12px` / `12px`（长名=宿主值，短名=皮肤值，同值不同家族） |
| `--dsw-codex-focus` / `--dsw-alias-state-business-primary` | `#339cff` / `#0d0d0d` |
| `--dsw-alias-bg-base` / `--dsw-alias-label-primary` | `#ffffff` / `#1a1c1f`（light 模式） |
| `--dsw-alias-bg-document-preview` | `#43454a`（偏蓝的暗色值出现在 light 模式下 → 令牌作用域不是 body，§1.4 待定点） |
| 皮肤构建自报哈希锚点 | patches.css 11 + sidebar-surface.css 2 + composer.css 18 |

**被证伪的假设要留档**：我最初从「宿主 96 处消费 `--dsw-focus-ring-color` + 皮肤把
`--dsw-alias-state-business-primary` 重锚成墨色」推出「未补丁面板是墨色环」，静态推理成立、
**级联结果不成立**——因为皮肤 ① 带属性作用域，特异性高于宿主所有 class 级规则。这类结论只能实测。
## 8. 本轮已做：侧栏「面」（0.4.0）

清单 §1 的「侧栏」一行写的是「侧栏面与折叠触发」。清点下来：

| 项 | 结论 |
|---|---|
| 折叠触发 | **不动**。宿主 `data-dsh-responsive-part="sidebar-toggle"` 就是一个 28px ghost 图标按钮，hover 有底色，折叠态 36px；与 Codex 的 `size=toolbar color=ghost` 同形，没有可补的差。 |
| 侧栏行几何 | **不动**（会改现有观感，见 §3 的边界纪律）。宿主实测：新会话/面板行 36px、工作区行 34px、会话行 32px，圆角 12px；Codex 参考图约 42px 行高。要做必须先拍板。 |
| 侧栏面 = 滚动渐隐 | **已做**（⑱ `skins/codex-ink/sidebar-surface.css`）。 |

**这一项的诚实结论（可复跑：`node scripts/sidebar-surface-verify.mjs`）**：宿主那 24px 覆盖层
与 Codex 的 40px mask 斜坡前 24px **逐点差 ≤0.122**，底边亮度差 8.0/255 —— 按外观判据它**不值得做**。
做它的理由是机制：覆盖层靠不透明底色成立，而本皮肤有 `translucentSidebar` 开关
（`--dsw-specific-sidebar-fill` 变 `rgba(…,0.72)`）；夹具四列并排实测，半透明底下
**底边亮度 原生 176.4 / codex-ui 240.3**，覆盖层留下 63.9 的墨色残留，mask 完全免疫。
另外 `[data-platform=darwin]` 下宿主整条覆盖层 `display:none`，mask 不挑平台。

下一步的候选顺序（都需要先拍板，因为都动现有观感）：行几何（36/34/32 → 42）→ 工作区行的选中胶囊
（宿主 `Rows.module.css` 里只有 `sessionRow._selected`，`projectRow` 没有选中态，需查 ui-workspace 是否发状态）。
