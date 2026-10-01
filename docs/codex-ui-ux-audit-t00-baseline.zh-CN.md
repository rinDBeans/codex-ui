# codex-ui 真实基线复核（T00）— 执行记录

> 采集日期：2026-09-30（Asia/Singapore）。本文是 [codex-ui-ux-audit-plan.zh-CN.md](codex-ui-ux-audit-plan.zh-CN.md) §8 **T00** 的交付物：把「旧截图/夹具推断的基线」换成**当前真实宿主**的实测基线，并据此逐项判定候选。
> 采集方式：把日常 `$DSH_HOME` **整体复制**到 `<TEMP>/codex-ui-audit/real-home` 后从副本启动，**未修改日常 profile**。（本机绝对路径按仓库规矩脱敏，实际值见执行记录，不入库。）原始输出见 `docs/recon/*-real.log`，截图与 manifest 见 `docs/recon/`。

## 1. 环境事实（实测）

| 项 | 实测值 | 取法 |
|---|---|---|
| 宿主 CLI | `dsh 0.2.0-rc.2` | `dsh --version` |
| 官方 Codex 安装包 | `OpenAI.Codex_26.928.2636.0_x64__2p2nqsd0c76g0` | `Get-AppxPackage *Codex*` |
| 日常 profile | `$DSH_HOME/profiles/web` | — |
| codex-ui 实际链接 | `link:<codex-ui 主检出>`（非开发 worktree） | `profiles/web/package.json` |
| 采集用实例 | `http://127.0.0.1:3101`（副本 home） | — |
| 视口 / DPR | 1440×960 / 1.5 | live 脚本默认 |

### 1.1 ⚠️ 插件组合：4 个 bundle 被版本门禁跳过

```
dsh: skipping profile bundle "dshmarket"                      ← 创意工坊
dsh: skipping profile bundle "dsh-llm-verifier"               ← LLM Verifier
dsh: skipping profile bundle "dsh-theme-mineradio"            ← 主题
dsh: skipping profile bundle "@michengai/dsh-archive-manager" ← 已归档会话
```

原因均为与 `dsh 0.2.0-rc.2` 的 peerDependencies 不匹配，且 exact-version exemption 未开启。**直接后果：设置面板少了「创意工坊 / LLM Verifier / 已归档会话」三页，未映射项落入「其他」组。**

这不是 codex-ui 的问题，但它是当前真实基线的一部分——方案 §3 差异矩阵里「侧栏/设置/命令」等区域的前提假设需要按此修正。

## 2. 真实基线实测结果

| 脚本 | 裸 profile（对照） | **真实组合（本基线）** |
|---|---|---|
| `scripts/live/settings-modal.mjs` | 83/94 | **84/94** |
| `scripts/live/gui.mjs` | 14/14 | **12/14** |

### 2.1 settings-modal 的 10 项失败

- **9 项 = 环境缺失，非缺陷**：`EXPECT_GROUPS` 期望的「宠物 / 使用统计 / 创意工坊 / LLM Verifier / 已归档会话」在当前组合里不存在（§1.1 的 4 个 bundle + 会话级页面）。脚本按 T01 的设计「缺页面即非零退出」，**这是真阳性**，不是脚本漂移。
- **1 项 = 真实缺陷**：`Escape 被拦截时返回按钮仍能关掉设置（兜底路径活着）` → **UX-01**。

### 2.2 gui.mjs 的 2 项失败（真实组合才出现）

```
FAIL 侧栏无右边框        [1px rgba(11, 11, 11, 0.1)]   裸 profile 下为 0px
FAIL B 面：改回原档      [Off / Default]                探针改回后落成 Off，非原值
```

两条都需要进一步判定是 codex-ui、第三方插件还是探针自身所致，**未定级**。

## 3. 逐项判定矩阵

判据：**已满足**＝真实基线实测通过；**确认问题**＝有源码级或实测证据；**待核实**＝本轮无证据，需定点采集。

| ID | 判定 | 依据 |
|---|---|---|
| UX-01 关闭兜底 | **确认问题** | 真实组合 live 实测 FAIL；worktree 修复版同一用例 PASS（A/B 对照） |
| UX-02 草稿生命周期 | **确认问题** | `clear()` 只 unset 存储、滑杆 `commit` 不撤草稿（源码级）；配置卡未能在隔离环境渲染，A03 行为验收待补 |
| UX-03 验收脚本路径 | **确认问题** | 修复前 `ENOENT src/settings-modal.js`，修复后 GROUPS 对账通过 |
| UX-04 验收期望漂移 | **确认问题** | 真实实测中列环境影 = **13px**（非 24px）、首档 = **8px**（非 14px） |
| UX-05 保留组件 | **保留，非缺陷** | 真实实测：弹层 254px、触发器高 28px、首档 8px、模型行 117 条、宿主格隐藏；与 T05 冻结断言一致 |
| UX-06 `style.order` | **已复核：当前约束下不可满足，维持取舍** | 宿主按 slots entry 的 `options.order` 排序渲染；但 slots 只暴露 `register/isLive/entries/entriesOfSlot/spec`，**无改动已有 entry order 的 API**，而这些 section 由别的插件注册。实测宿主 DOM 序本就交错（个人/通用设置/编码/模型/集成/内置插件/Agent 预设/其他/Ivory 主题/订阅服务），「按连续顺序分组」做不到。搬宿主节点实测**可行**（切页/搜索/清空三次重渲染都没还原），但违反方案 §7.2「宿主节点不搬移」。⇒ 视觉顺序≠焦点顺序是分组功能的必然代价，代码注释已更正旧理由 |
| UX-07 中文标签依赖 | **已修复（双语实测通过）** | 缺陷复现：English 下宿主项变 `General/Models/Built-in plugins/Agent presets/Ivory Theme/Subscriptions`，插件分组塌成 `["其他"]`。修法：① 自有文案中英成对并按 locale 每次重放重写；② 分组改按 **slot id**（`ctx.slots.entries('settings.section')` 的 `options.id`，与语言无关，条数对得上才用、否则回落标签）。实测 English → `Personal/Coding/Integrations/Other`，中文 → `个人/编码/集成/其他`，归类逐项一致 |
| UX-08 tabs 无条件隐藏 | **确认问题**（源码级） | `patches.css:274` 仍无条件 `display:none`；真实轨迹视图出口未实测 |
| UX-09 / UX-11 | 保留观察 | 方案已排除组件改造 |
| UX-10 旧图/对账表 | **确认问题** | README 对账表版本号与实测版本不一致 |
| UX-12 主题超时 | **确认问题**（源码级） | `settings-card.js` 的 `pendingTheme` 仅在 preference 追平时清除，超时不更新分段 |
| UX-13 正文链接 | **待核实** | 真实环境链接最终对比度未采样 |
| UX-14 等宽 meta | **待核实** | 实际命中的适配器 DOM 未采集 |
| UX-15 输入卡参数 | **待核实** | 单/多行、桌面/浏览器状态未采集 |
| UX-16 非法输入反馈 | **确认问题**（源码级） | `settings-card.js:158` 非法值静默 return，无字段级说明 |

## 4. 保留组件基线（T05）

### 4.1 几何冻结（代码层，`check.mjs` 每次都跑）

```
THUMB_SIZE=16 · 轨热区 30px · 槽 26px/圆角 8px · 填充 8px+(100%-16px)×pos
```

### 4.2 真实 GUI 基线截图（本轮新增，`scripts/live/freeze.mjs`）

在隔离 home 的活实例上点开模型选择器弹层实测（**不预设常量，全部从 computed style 与
getBoundingClientRect 读**）：

| 项 | 实测值 | 与冻结基线 |
|---|---|---|
| 弹层宽 | **254px** | 一致（check 断言 254） |
| 弹层圆角 | **18px** | 一致（自有 token 档） |
| 弹层内衬 / 软影 | `5px` / `0 8px 32px rgba(13,13,13,0.13) + 0 0 0 1px rgba(13,13,13,0.04)` | 与 patches.css ⑫ 一致 |
| 触发器高 | **28px** | 一致 |
| 触发器圆角 / 字号 | `8px` / `13px` | 一致 |
| 宿主那一格 | **已隐藏** | A 面顶替成立 |
| 暗色下触发器高 | **28px**（与亮色逐字相同） | 保留组件不随主题变形 |

> **环境必须随基线一起记**：本机 web profile 同时跑第三方主题 `dsh-ivory`（`body.dsh-ivory`），
> 它用 `!important` 接管部分外壳属性。基线记了 `theme=dsh-ivory`，
> 否则日后分不清"保留组件变了"还是"别人接管了外壳"。

**结论：保留组件在当前真实宿主 + 真实主题组合下形态未变，冻结基线成立。** 截图三张：
`t05-freeze-light.png` / `t05-freeze-popup.png`（弹层展开态）/ `t05-freeze-dark.png`，
数值快照 `t05-freeze.json`。

## 5. 本轮未覆盖 / 待补

1. **逐项「待核实」项**需要定点采集（Tab 顺序、英文 locale、链接对比度、输入卡单/多行、轨迹视图出口）。
2. **macOS / 窄窗 / reduced-motion** 未覆盖。
3. **§2.2 两条 gui.mjs 真实失败**未定级。
4. **T00 的截图 manifest** 已生成（`docs/recon/manifest.json`），但 `osScale` / `rootFontSize` 未记录。

## 5.1 ⚠️ 验证回路本身的缺陷（已修，务必沿用以防再犯）

T00 采集时用 `robocopy C:\<DSH_HOME> → <TEMP>/codex-ui-audit/real-home` 做隔离副本。
**robocopy 会把 pnpm 的 `link:` 解引用成真实目录快照** —— `profiles/web/node_modules/codex-ui`
变成一份**冻结拷贝**。后果：之后所有**插件侧**改动的 live 验证，实际跑的都是复制那一刻的旧代码
（实测该副本的 `client.js` 里 `data-codex-ui-te-ready` / `resetOf` / `tempoTimeout` 标记全为 0）。

**修法**：把那个目录换成指向主检出的 junction ——
`Remove-Item <copy>/node_modules/codex-ui -Recurse -Force` 后
`New-Item -ItemType Junction -Path <该路径> -Target <codex-ui 主检出>`。

**判据**：验证前先 grep 副本的 `client.js`，确认里面有你最新的改动标记；没有就别跑，
否则得到的是假结论（本轮就因此误判过一次「UX-07 修复不生效」）。

> 未受影响的结论：`gui.mjs` 的 13px / 8px / 侧栏边框那几条量的是宿主与皮肤 CSS（脚本侧断言），
> 以及 `settings-modal.mjs` §9a 的 A/B（那一轮裸 profile 用的是真 `link:`，A/B 成立）。

## 5.2 T07 的前置：真实内容样本（已取得，过程见下）

T07 的验收要求「工具 / 技能 / 审批 / 用户问题 / 目标 / 引用**有真实样本**」。本轮实测：

- 宿主锚点在当前版本**全部存在**（静态扫描 `@deepseek-ai/dsh-*`，17/17）：`data-tool` `data-state`
  `data-variant` `data-chat-call-id` `data-subcalls` `data-expandable` `data-approval-key`
  `data-approval-scroll` `data-question-key` `data-question-scroll` `data-question-reply`
  `data-reply-outcome` `data-goal-bar` `data-command-input` `data-trigger-menu`
  `data-composer-chip` `data-trajectory-scroll`。
- 但**渲染不出样本**：隔离 home 的会话在 GUI 里打开后不渲染正文（`[data-chat-flow]` = 0、
  `[data-tool]` = 0），点 `_sessionRow` 无效；会话存档里虽有 709 KB / 800 KB / 1.1 MB / 8.1 MB 的历史，
  宿主客户端却**没有按 URL 打开指定会话的路由**（`location.hash` / `searchParams` 在
  `dsh-client-ui-conversation` 里 0 命中）。

⇒ 要拿真实样本只能**真的跑一轮 agent 任务**生成会话（消耗 API 额度，需用户授权）。
在拿到样本之前，按方案 §0.3 不应开工 T07 的样式改造 —— 那会退化成「凭旧文档假设」。

### 5.2.1 解除过程（三次失败才通，记下来防再犯）

上一轮结论是"取不到真实样本，要用户授权跑一轮任务"。用户授权后，**连踩三个坑**才拿到样本：

| # | 现象（原文） | 真实原因 | 处置 |
|---|---|---|---|
| 1 | `NO_ADAPTER: no adapter registered for provider "token-rhythm"` | 隔离 home 的 headless patch 钉了 `provider: token-rhythm`，本机没装这个 adapter | 改 provider；两次都报 NO_ADAPTER 后才发现真实 id 在 `dsh-llm-deepseek-api-key` 里叫 **`deepseek-official`**（不是 `deepseek`） |
| 2 | `UNSUPPORTED_REASONING_EFFORT: ... does not support reasoning effort "medium"` | `deepseek-flash` 不接受 reasoningEffort | 整项去掉 |
| 3 | 页面报 `本轮运行失败 当前请求的额度已用尽 QUOTA` | `deepseek-official` 余额为负（`provider-snapshots.json` 里 `totalBalance: "-0.41"` CNY） | 换 `bailian`，并**直连端点验证 key 确实可用（HTTP 200）** 才重启 web |

**换 provider 后仍报 QUOTA 的排查**：一度以为配置没生效。用 `dsh --profile web --dump-config | grep -A 6 "id: agent-default-model"`
确认生效值已是 `bailian / deepseek-v4-flash-0731`，且 web 进程启动时间晚于配置 mtime —— **配置没问题**，
是**页面上残留着上一轮的 QUOTA 文案**。下一轮换了个任务就正常了。

> 教训：错误文案**先看它属于哪一轮**。同一页面里旧回合的错误不会被清掉，
> 把它当成本轮结果会得出"换了 provider 还是 QUOTA"的错误结论。

### 5.2.2 真实样本（`scripts/live/content.mjs` 采集）

```
data-tool 4 · data-state 10 · data-chat-call-id 6 · data-subcalls 2
data-expandable 9 · data-variant 9 · data-chat-flow 3

STATES   = ["error", "idle", "ok"]                        ← 真实词表，非从 .d.ts 拼
VARIANTS = ["bash", "code", "read", "search", "think"]
```

真实回合文本（同屏共存成功与失败）：

```
已完成，用时 24秒
代码   List entries in current working directory        失败
运行命令 List entries in current working directory       失败
查找文件 /*                                             （成功）
思考 The bash shell is PowerShell, so `ls -la` failed. Use PowerShell-friendly command…
```

**这解决了上一轮"状态词表只能从 .d.ts 拼零碎片段"的困境**：真实词表只有三档
`ok` / `error` / `idle`，其中 `idle` 挂在页头菜单锚点（`OMoRSG_menuAnchor`）上、不是回合状态，
**回合状态实际只用 `ok` 与 `error` 两档**。`data-variant` 的五档 `bash/code/read/search/think`
正是 T07 要求区分的"工具 / 技能 / 摘要"三类内容。

**仍未取到的样本**（不影响 T07 开工，但要在验收里标为"未覆盖"）：

| 锚点 | 计数 | 原因 |
|---|---|---|
| `data-approval-key` / `data-approval-scroll` | 0 | 本轮任务的工具都在 `approval/policy: auto` 下执行，没触发审批弹窗；要采到得让任务触发一个需人工确认的动作（如写入工作区外的路径） |
| `data-question-key` / `data-question-scroll` / `data-question-reply` / `data-reply-outcome` | 0 | 模型没调 `ask_user_question`；要采到得在 prompt 里明确要求它提问 |
| `data-goal-bar` | 0 | 模型没调 `goal` 工具 |
| `data-trigger-menu` / `data-composer-chip` | 0 | 没输入 `@` 触发引用菜单 |

## 5.3 T08 文本与弹层：本轮已落地（UX-13 / UX-14）

T08 不依赖真实会话样本，是本轮唯一能在夹具里完整闭环的内容改造。已落地并通过验收。

### 5.3.1 复核发现的两个真问题（改前实测）

| 问题 | 改前实测值 | 判据 | 处置 |
|---|---|---|---|
| UX-13：`patches.css` ② 把**所有** `<a>` 染成 `--dsw-alias-link`（#339CFF） | 裸链接 / 导航链接 / 菜单项链接全部 `rgb(51,156,255)` | 正文 link 与装饰 accent 分语义；导航 / 菜单 / 按钮内的 `<a>` 继承父级前景 | 改为 `color: inherit` + 点状下划线；只有 `[data-dsh-part="prose"|"article"] a` 染 alias-link |
| UX-14：⑤ / ⑨ 把 `tag-chip` `tag-badge` `composer-chip` 一并塞进 `font-family: var(--dsw-font-meta)` | 三者 fontFamily = `"SF Mono","JetBrains Mono",…`（8 款等宽栈） | 普通 meta 用 UI 字体；代码 / 路径 / 快捷键保留等宽 | 只有 `chip` / `ref` 保留等宽；三个 UI 标签回到 UI 字体 |

连带删除：⑨ 里 `composer-chip` 的 `text-transform: uppercase` + `letter-spacing`，以及因此空挂的 ⑩ 中文豁免段
（⑩ 存在的唯一目的就是撤销 ⑤ / ⑨ 强加的字距与大写；根因去掉后，豁免本身没有存在意义）。

### 5.3.2 新增交付

| 文件 | 作用 |
|---|---|
| `skins/codex-ink/overlays.css` | ⑱ 浮层：菜单材质（压掉宿主 `blur(40px) saturate(150%)` 的 backdrop-filter）+ 长列表 overflow 局部化 |
| `scripts/fixtures/text-overlay-verify.html` | 纯皮肤层夹具，7 组场景（裸链接 / prose / 导航 / 菜单 / chip / 中文 / 用户覆盖） |
| `scripts/specs/text.mjs` | 29 条断言，分 `link_prose` `chip_meta` `overlay` 三节，亮暗双主题 |
| `scripts/check.mjs` +3 条 | 静态护栏：全局 `a` 不得被染 accent；正文作用域必须存在；UI 标签不得被强制等宽 |

`overlays.css` 已注册进 `scripts/build.mjs` 的 `SKIN_PARTS`（`patches.css` 之后、`model-picker.css` 之前——
不覆盖保留组件，但被后续组件层看见）。`theme.css` 选择器数 358 → 371。

### 5.3.3 浮层的真实锚点与一处**不能做**的部分

静态扫描 83 个宿主 `client.js` 的结果：

| 组件 | 宿主锚点 | 本轮处置 |
|---|---|---|
| 菜单材质 | `[data-menu-material]`（声明 `--dsw-menu-backdrop-filter: blur(40px) saturate(150%)`、`--dsw-elevation-stroke-color`） | **已写**：压成不透明 layer-1；亮色描边 l4→l1、暗色 l3 |
| 建议 / 触发菜单 | `[data-trigger-menu]`（带 `data-overflow-below` 表示下方仍有溢出项） | **已写**：`overflow-y: auto` + `overscroll-behavior: contain` + 细滚动条；**不覆盖**宿主的 inline `max-height` |
| 模型菜单 | `body > div[role="menu"][aria-busy]` | 已在 `patches.css` ⑫，本轮不动 |
| tooltip | 全宿主**仅 1 处** `role="tooltip"`，**无** `data-tooltip` / `data-dsh-part` 之类专属锚点 | **未写** |
| toast | 全宿主 **0 处** `data-toast`；toast 若存在是复用 `role="status"`(66 处) / `role="alert"`(52 处) | **未写** |

**为什么不写 tooltip / toast**：`role="tooltip"` 只有 1 处，而 `role="status"` / `role="alert"` 有 52 / 66 处。
凭 ARIA role 写样式会连带命中无障碍语义容器与实时区，污染面不可控；`data-toast` 则根本不存在。
按方案 §7.2「没有接口的工作形成宿主提案，不做假按钮占位」，这两项列为**宿主提案**，不凭 `data-dsh-part="toast"`
这类自造键写样式 —— 那样只会产出一段永不命中的死 CSS。

> 宿主提案（三选一，宿主侧决定）：① 在 tooltip / toast 组件上加 `data-tooltip` / `data-toast`；
> ② 复用已有的 `data-dsh-part` 契约由 skin-center 适配器补打；③ 本插件提供显式映射，宿主给稳定锚点。
> 在锚点出现之前，`overlays.css` 的 ⑱ 只覆盖菜单与溢出。

### 5.3.4 验收结果（本机实测）

```
npm run check   → ALL PASS (77/77)     74 → 77（+3 条 T08 静态护栏）
npm run verify  → ALL PASS (254/254)   225 → 254（+29 条 T08 断言）
```

亮点实测（`node scripts/verify.mjs text --verbose`）：

- 链接：改前 裸/导航/菜单全部 `rgb(51,156,255)`；改后 裸/导航/菜单 `rgb(26,28,31)`、prose 内 `rgb(51,156,255)`、
  hover 下划线 `none → underline`、用户覆盖 `--dsw-alias-link: #ff0066` 后链接跟到 `rgb(255,0,102)`。
- 等宽：改前 chip = 8 款等宽栈；改后 chip / composer-chip = `"Segoe UI","Microsoft YaHei",sans-serif`，
  `code` / `kbd` / 路径仍 `monospace`。
- 浮层：亮色描边 `rgba(13,13,13,0.07)`(l1) → 暗色 `rgba(255,255,255,0.2)`(l3)；
  填充 `#ffffff` → `#212121`，两次都等于当主题 `--dsw-alias-bg-layer-1` 的解析值；宿主 inline `max-height:220px` 未被覆盖。

**一处必须记下的探测坑**（与 `composer.mjs` 同款）：深色令牌声明在 `body[data-ds-dark-theme]` 上而不是 `:root`。
只查 `documentElement` 会在暗色下拿到**亮色**令牌，导致「填充不跟随」这类假失败。probe 一律 body 为先、html 兜底。

## 5.3b T07 高频内容组件：已落地（⑲ content.css）

### 5.3b.1 判据来源（三层，逐条实测）

| 层 | 来源 | 取得的内容 |
|---|---|---|
| ① 类型声明 | `dsh-client-ui-tool/lib/types/client/tool/models/tool-call-model.d.ts` | `ToolRowState = 'preparing' \| 'running' \| 'ok' \| 'error' \| 'stopped'`；`variant = 'search' \| 'read' \| 'bash' \| 'write' \| 'edit' \| 'code' \| 'others'` |
| ② 渲染代码 | `dsh-client-ui-tool/lib/client.js` | `ToolRow.root{ data-variant, data-tool, data-state }`；`bash_sample.root{ data-sample, data-expandable, role=button, tabIndex }`；`ToolDetails.badge{ data-tone }` |
| ③ 真实 GUI | `scripts/live/content.mjs` | `STATES=["error","idle","ok"]`、`VARIANTS=["bash","code","read","search","think"]` |

**③ 里的 `think` 不在 ① 的 variant 联合里** —— 推理行由 `dsh-client-ui-chat` 的同名属性承担，
是另一个包。所以 variant 分两组处理：工具行七档 + 推理行。类型声明与 GUI 实测**互补**：
声明给全五态，GUI 只观测到 `ok`/`error`（`preparing/running/stopped` 是瞬时态，采样赶不上）。

### 5.3b.2 落地内容

- `skins/codex-ink/content.css`（⑲）：8 组规则 —— 状态三档、七档 variant 归属、tool 元信息、
  可展开卡视觉、代码块等宽不折行、回合摘要/详情层级、失败/不可用、推理行、reduced-motion。
- `scripts/specs/content.mjs`：40 条断言，5 节。
- `scripts/check.mjs` +3 条静态护栏。

**状态设计**：五态收敛成**三档**可辨识 —— 过程（preparing/running/stopped 同色 + progress 光标）、
完成（无状态条）、失败（左侧 2px 红条 + 徽标）。停止态另给一条中性条，
免得"被取消"和"出错"长得一样。失败行**文字仍用主前景**（整段红字太吵），区分信号是状态条。

### 5.3b.3 写这一层时踩的四个坑（都已固化成护栏）

| # | 现象 | 根因 | 护栏 |
|---|---|---|---|
| 1 | 代码块**没等宽** | 写了 `var(--dsw-font-code)`，但 `skin.css` 里**没有**这个令牌（只有 `--dsw-font-meta`）。浏览器丢弃整条声明、静默回落 UI 字体 | `check.mjs`「不得引用 skin.css 里不存在的令牌」——15 个令牌逐个对账 |
| 2 | 详情块与摘要同色 | `[data-turn-process-answer]` 和 `-messages` 被我设成同一个 secondary | 夹具断言「answer 用主前景」 |
| 3 | 判据查错信号 | 我把"状态易识别"实现成左侧红条，断言却查行的 `color` —— 两者都 `rgb(26,28,31))。**值是对的，判据查错了对象** | 改成查 `box-shadow` 状态条，且要求三态两两不同 |
| 4 | 护栏静默失效 | `.d.ts` 路径少写 `client/tool/models/` 三层，`host.read()` 返回 null，护栏降级成"未找到"，**双向对账根本没跑却显示 PASS** | 改成 `assert` 硬失败，并做双向校验（皮肤 ⊆ 宿主 且 宿主 ⊆ 皮肤） |

> 坑 3 与坑 4 是同一类错误：**判据自己有 bug，却报出"通过"**。
> 这比判据不严更危险 —— 不严只会漏过，写错会给出假绿。

### 5.3b.3b 补采四类：拿到提问卡，审批卡三次未触发（如实记录）

#### 拿到的

| 类 | 结果 | 证据 |
|---|---|---|
| **用户提问卡** | ✅ 采到，12.1s 出现 | `data-question-key` 1 · `data-question-scroll` 1；页面文案「等待你的操作 · 你想让我用哪种方式继续？」 |

采样脚本 `live/content.mjs` 加了两个能力，让同一支脚本能采任意一类：
`--wait-for <锚点>`（等哪个锚点出现算采到）、`--auto-reply <文本>`（提问卡代答，否则模型会一直等）、
`--prompt-file <路径>`（见下面的坑）。

#### 没拿到的：审批卡（三次尝试，全部失败）

| # | 做法 | 结果 | 为什么没用 |
|---|---|---|---|
| 1 | 任务写 `%TEMP%\codex-ui-audit` 下的文件 | `data-approval-key` = 0 | 那**就是**工作区 |
| 2 | 显式设 `approval.policy: ask` 后重跑 | 仍 0 | 策略确实生效（session 文件里 `approval/policy :: {"policy":"ask"}`），但见第 3 条 |
| 3 | 写工作区**外**的 `C:/.../Temp/approval-outside-probe.txt` | 仍 0 | **真正原因**见下 |

**真正原因**（`read:` 锚点 `dsh-sandbox/lib/index.js` 的 `approveEscalation`）：

```js
if (mode === effectiveMode) return effectiveMode;          // 模式没变 → 直接放行，不问
if (!(WIDER_MODES[effectiveMode] ?? []).includes(mode)) throw ...
const outcome = await approval.approver.request({...})     // 只有"提权"才会问
```

审批只在**沙箱提权**时触发。写工作区外文件走的是**路径判定**，不升级沙箱模式，
所以 `policy: ask` 也不会弹卡。要触发得让某次调用**显式申请更宽的沙箱模式**
（如从 `workspace-write` 升到 `full`），而本轮用的工具链没有这条路径。

⇒ `content.css` 里 `[data-approval-key]` 那组规则**没有真实样本支撑**，
只有 ② 渲染代码的静态契约（`ApprovalPanel.root{ data-approval-key, aria-busy }`）
和 `specs/content.mjs` 的 `waiting` 一节（按静态契约复刻）。**视觉未在真实组合下验收。**

#### 顺带发现：`data-state` 在宿主里有**两套词表**

同屏实测 `STATES = ["done","error","idle","ok","ongoing","running","preparing","warning"]` —— 八个值来自两个不同的组件：

| 属性 | 词表 | 归属 |
|---|---|---|
| `ToolRow` 的 `data-state` | `preparing \| running \| ok \| error \| stopped` | `dsh-client-ui-tool` |
| `StateDot` 的 `data-state` | `done \| warning \| ongoing \| error \| idle` | `dsh-client-ui-primitives` |

`StateDot.module.css` 自己按 `--dsw-alias-state-*-primary` 上好了色。**同名的 `error` 在两套里语义也不同**
（工具失败 vs 状态点错误）。第一版 `content.css` 的 `[data-state="error"]` 全部带 `[data-tool]`/`[data-sample]`
前缀所以没误伤，但这属于运气。已加静态护栏：

> `check.mjs`「不得用裸的 [data-state] 选择器」—— 当前 14 条规则**全部带宿主锚点前缀**，
> 少写前缀就会把状态点涂成行文字色。

#### 本轮踩的采样坑

| 坑 | 现象 | 处置 |
|---|---|---|
| **prompt 被截断** | 模型收到的任务是「请创建一个文件请创建一个文件」，后半句连路径一起丢 | 中文 + Windows 路径穿过 `bash` → `PowerShell` 两层会被吃掉。加 `--prompt-file` 走文件，绕开引号与编码 |
| `max-height: 40vh` 断言 | 实测 `320px`，断言写死 `/40vh/` 永远 FAIL | `getComputedStyle` 把 vh 解析成绝对像素，判据改成「有上限且 ≤ 半屏」 |
| StateDot 色值断言 | 三条全 FAIL，全是 `rgb(0,0,0)` | **夹具不接宿主 CSS**，那条着色规则根本不在页面里。判据改成「撤掉皮肤后颜色必须一模一样」——验证的是"皮肤不接管"，不是宿主自己什么色 |

### 5.3b.3c 补采引用菜单：拿到，并纠正一处**锚点幻觉**

采样脚本加了第三种模式 `--type-at`：**只往输入框敲文本、不发消息**。
发了菜单就关上了 —— 这与 `--wait-for`（等回合产物）是两类完全不同的采样。
敲一个 `@` 即触发，0 命中等待。

#### 真实结构（`read:` 锚点 `dsh-client-ui-input-trigger/lib/client.js`）

```js
// 触发语法：@path 或 @"path with spaces"；@ 在其他 token 内（邮箱）不算触发
{ trigger: "@", query, quoted, position: "leading" | "inline", span }
// 菜单结构：
MenuSurface[data-trigger-menu][data-overflow-below]
  └ .viewport[role=listbox]
      ├ .groupTitle[role=presentation][data-source]   ← **组标题**才带 data-source
      └ [role=status]                                 ← pending 组占位
```

真实 GUI 采样（`@` 一敲即出）：

```
data-trigger-menu 1 · [data-source] 1 组（source="reference"）· role=listbox 1
role=status 1（pending）· role=option 0（还没输查询词）· data-overflow-below=false
max-height 254px · bg rgb(255,255,255)
```

#### 纠正的一处锚点幻觉

我第一版写的是 `[data-trigger-menu] [data-dsh-part="ref"]`。**宿主从不打 `data-dsh-part`**：

```
扫 83 个宿主 client.js → data-dsh-part 出现 0 次
```

那个键是 **skin-center 适配器**补的。后果：只靠 `[data-dsh-part="xxx"]` 的规则，
在**纯宿主**组合下永不命中。已改为 `[data-source]`（组标题的真实锚点）。

同一问题在 composer chip 上更隐蔽 —— 宿主 `createDOM()` 是：

```js
el.setAttribute("data-composer-chip", this.__source);   // 属性**有值**，不是空串
el.setAttribute("contenteditable", "false");
```

而 `patches.css` 里写的是 `[data-dsh-part="composer-chip"]`。已补 `[data-composer-chip]` 兜底，
**两条并存**（适配器在时用适配器键，纯宿主时用真键）。

#### 真实 GUI 上量到的前后差异

| 项 | 改前 | 改后 |
|---|---|---|
| 组标题 color | `rgb(11,11,11)`（主前景） | `rgb(111,109,104)`（`--dsw-alias-label-tertiary`） |
| 组标题 font-size | `14px` | `11px`（`--dsw-meta-size`） |
| 组标题 text-transform | — | `none`（不强制大写） |

> 这条差异是**在真实宿主 + 真实主题（`dsh-ivory`）下量到的**，
> 是本轮唯一一条"改前 vs 改后"都有真实读数的样式。

#### 护栏

`check.mjs` 新增「锚点归属」一节：抽查 5 个包的真实锚点仍在，
并要求**只靠 `data-dsh-part` 的组件必须另有宿主锚点兜底**（当前 composer-chip 满足）。

#### 本轮自己的流程漏洞

改完 `content.css` **忘了 build**就去跑 live，测出"规则没生效"（`titleColor` 仍是 `rgb(11,11,11)`）。
实际是 `theme.css` 里 0 处 `data-source`。补 build + 重启 dsh web（bundle 在 boot 时加载）后才量到真实差异。

> 与 §5.1 记的 `robocopy` 那次同源：**live 测出的"没生效"要先分清是代码没写对还是产物没重建**。

### 5.3b.4 验收（本机实测）

```
npm run check   ALL PASS (81/81)    78 → 81（+3 条 T07 护栏）
npm run verify  ALL PASS (294/294)  254 → 294（+40 条 T07 断言）
状态双向对账：宿主共 5 个字面量，皮肤五档 = 宿主 ToolRowState
theme.css 选择器 371 → 411
```

**仍未覆盖**（承接 §5.2.2）：审批卡、用户提问卡、目标条、引用菜单的**视觉**未做 ——
这四类的锚点在宿主里存在，但本轮没采到触发它们的真实回合。`content.css` 也没有为它们写样式。

## 5.4 T14 漂移与能力检测（已并入 `check.mjs`）

按方案 §8 的 T14 要求**并入现有设施**：宿主来源仍走 `scripts/lib/host.mjs` 的 `openHost()`，
**没有**新建 `scripts/audit-host.mjs`（那会变成第二条宿主解析路径，违反 §7.2）。
宿主读不到时整节 SKIP 不 FAIL —— 漂移检测是加分项，不能变成 CI 红线。

当前覆盖 **9 个包 / 19 个锚点**，全部命中：

| 包 | 锚点 |
|---|---|
| `dsh-client-ui-conversation` | `data-composer-card` `data-conversation-scroll` `data-conversation-tabs` `data-lexical-editor` `data-side` |
| `dsh-client-ui-chat` | `data-chat-flow` `data-chat-flow-kind` |
| `dsh-client-ui-sidebar-right` | `data-sidebar-right-panel` `data-sidebar-right-guide` `data-sidebar-right-toggle` |
| `dsh-client-ui-settings-general` | `settings.section` |
| `dsh-client-ui-model-selection` | `conversation.input.model` |
| `dsh-client-ui-tool` | `data-tool` `data-state` `data-variant` `data-chat-call-id` |
| `dsh-client-ui-input-trigger` | `data-trigger-menu` |
| `dsh-client-ui-approval` | `data-approval-key` |
| `dsh-client-ui-user-questions` | `data-question-key` |

**这张表第一版写错了三处包名**，T14 立刻报"漂移"——那是本表错、不是宿主变：

- `data-sidebar-right-panel` 在 `dsh-client-ui-sidebar-right`，**不是** `-layout`
- `settings.section` 由各 `dsh-client-ui-settings-*` 子页注册，**不是** `-settings`
- `data-chat-flow` 在 `dsh-client-ui-chat`，**不是** `-conversation`

改法是 `grep -rlF <锚点> <packages>/lib/*.js` 逐个实测归属，不是照名字推。
这恰好证明 T14 有用：写错的表会被立刻抓出来，而不是等皮肤静默失效。

## 6. 关联发现

- 日常 profile 链接的 codex-ui 是**主检出**（commit `7186447`），与开发 worktree 同 base commit；本轮修复已推送到主检出，两端文件 SHA256 全等。
