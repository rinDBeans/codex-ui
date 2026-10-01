# codex-ui 审查简报（交给独立审查 AI）

> 用途：把本轮 15 个未推送提交交给**没参与过开发**的 AI 做独立审查。
> 本文件按仓库规矩不含本机绝对路径，占位符：`<codex-ui 仓库>` = 本仓库根；`<npm 全局 node_modules>` = 宿主包的上层 node_modules（`npm root -g` 的结果）。
> 撰写时间：2026-10-01　｜　仓库：`<codex-ui 仓库>`　｜　分支：`main`
> HEAD：`1c9b5aa`　｜　领先 `origin/main` **15 个提交**（尚未推送）　｜　工作树干净

---

## 0. 给审查者的一句话背景

codex-ui 是一个 **DSH 宿主插件**（不是独立客户端）：它用 CSS + 少量 JS 适配器改变宿主的观感与交互，
**不重造功能**。因此本轮大量工作的结论是「宿主已满足，无需改动」——这本身是需要审查的判断，
请重点核对第 3 节的每一条「已满足」是否真的成立。

---

## 1. 范围与基线

```text
改动规模：64 files changed, 11077 insertions(+), 175 deletions(-)
基线提交：origin/main = 7186447（0.7.1 发布态）
当前 HEAD：1c9b5aa
```

本轮开始时的工作树有 **27 项未提交改动**（1288 插入 / 155 删除），是上一位 agent 的 T00–T08 成果。
第 1 个提交 `6597c88` 是把那些改动整体收成一个 WIP commit，**不是本轮新增的工作**。
审查时建议从 `6597c88` 之后开始看（即 `c384ba8..1c9b5aa`，13 个提交），
但 `6597c88` 本身也值得抽查——它是一次性收编 27 项未经细审的改动。

**验收基线（本机实测，审查者可复跑）：**

```powershell
npm run check     # ALL PASS (86/86)   —— 不依赖宿主，CI 入口
npm run verify    # ALL PASS (360/360) —— 需要 DSH_CHROME 环境变量
```

`verify` 需要 `DSH_CHROME` 指向一个 Chromium（Playwright 缓存里那个即可）。

---

## 2. 15 个提交

| 提交 | 内容 |
|---|---|
| `1c9b5aa` | T15 交付整合：README/CHANGELOG 双语对齐、补齐过时分片清单与限制声明 |
| `88b66ba` | T13 外观格与字号步进器并入皮肤档位（appearance 13/13） |
| `c243a79` | T11 右栏滚动区并入皮肤滚动条约定（panels 12/12） |
| `1867532` | T12 命令面板判为宿主提案；清掉误提交进仓库的探测脚本 |
| `90f3539` | T14 漂移表补上队列与输入区锚点（10 个包） |
| `bece8fa` | T10 补做：后续消息队列并入输入卡那一族（queue-dock 4/4） |
| `6c0cc45` | T10 判定：输入区判为「宿主已满足，无需改动」 |
| `1ff30ba` | 键盘三条断言拆成可选 spec，主基线回到全绿 |
| `674798b` | 回滚：撤掉 xfail 通道，验收只保留 PASS/FAIL 两态 |
| `1d4dd06` | 按用户决定把 T09 键盘三条改回硬 FAIL |
| `f0783b6` | T09 键盘三条转 xfail + 宿主提案 + 删孤儿夹具 |
| `7f7b8cb` | 引入 xfail 通道（**后被 674798b 撤销**） |
| `c98863d` | T09 侧栏行视觉映射 + 键盘可达性取证 |
| `c384ba8` | T09 清掉最后一处祖先 `:has()`，补漂移对账护栏 |
| `6597c88` | WIP：收编 T00–T08 的 27 项既有改动 |

---

## 3. 请重点核对：六条「宿主已满足」的判断

这些是本轮**最需要独立复核**的部分。每一条的判定依据都写在 `docs/` 对应文件里，
但那些文档由写代码的同一批 agent 产出，存在自证风险。

| 任务 | 判断 | 依据文档 |
|---|---|---|
| T09 侧栏 | 搜索/长名遮罩/归档/置顶/行菜单/宽度控制**宿主全有**，皮肤只做视觉映射 | （无独立文档，见 `skins/codex-ink/sidebar-rows.css` 注释） |
| T10 输入区 | 多行/超长/中文 IME/发送键/附件/队列/提及**宿主全有** | `docs/codex-ui-t10-verdict.zh-CN.md` |
| T11 右栏 | 容器/页头/空态/不可用态**宿主已满足**，唯一缺口是滚动区 | `scripts/specs/panels.mjs` |
| T12 命令 | **无专属锚点**，不可在皮肤层实现 | `docs/codex-ui-t12-verdict.zh-CN.md` |
| T13 外观 | 字号/外观偏好**宿主 store 已实现**，皮肤不加字段 | `skins/codex-ink/appearance.css` 注释 |
| §5.4 主题冲突 | `dsh-ivory` 用 `!important` 抢布局，判定为**环境冲突非本项目 bug** | （交接文档 §5.4） |

**审查建议**：至少抽查 T10 的 IME 一条——它声称宿主自带 `[data-composer-composing]` 的占位符隐藏 CSS。
可在 `<npm 全局 node_modules>/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js` 里搜该属性。

---

## 4. 已知未解问题（作者主动记录，非隐瞒）

### 4.1 宿主提案：侧栏行键盘不可达 ⭐

`docs/host-proposal-sidebar-keyboard.zh-CN.md`。证据：

- 行是 `div[role="treeitem"]`，**无 `tabindex`**；整个 `dsh-client-ui-workspace` bundle 只有 1 处 `tabIndex`，属于搜索框。
- `.rowActions` 默认 `display:none`，只在 `:hover`/`.menuOpen` 露出，**无 `:focus-within`**。
- `display:none` 元素不在 Tab 序列 ⇒ 键盘用户打不开行菜单。
- 纯 CSS 修不了（不可聚焦元素无法用 CSS 获得焦点），JS 改宿主属性又违反「宿主节点不搬移/不克隆」。

对应三条断言在 `scripts/specs/sidebar-keyboard.mjs`，**被 `scripts/verify.mjs` 的 `OPT_IN` 排除在默认全量之外**。

### 4.2 命令面板无稳定锚点

`docs/codex-ui-t12-verdict.zh-CN.md`。另附一条既成事实：**Ctrl+K 已被宿主绑给 `session.search`**
（`dsh-client-ui-workspace` 里 `KeyK` + `["primary"]`），且命令面板**不渲染任何键位提示**。

### 4.3 两套圆角档位未桥接

皮肤用 `--dsw-radius-s/m/l`，宿主组件用 `--dsw-radius-sm/md/lg`。
**当前两边都能解析**（`ui-theme` 提供宿主档位），不会炸；但宿主将来调档会让两者脱节。
桥接属共享令牌变更，未做。

### 4.4 T13 半条未交付

方案 §6.5 的「外观入口更易找到」需改 `src/client/`，本轮未做，
且**没有用 CSS 伪造入口**（§7.2 禁止假按钮占位）。

---

## 5. 审查者应当知道的三条方法论约束

这些决定了很多「看起来奇怪」的设计是刻意的，不是疏漏。

### 5.1 `data-dsh-part` 宿主从不产出

扫 71–83 个宿主 bundle，该属性出现 **0 次**——它是 skin-center 适配器补的。
只靠它的规则在纯宿主下永不命中。已有护栏（`check.mjs`「锚点归属」）。

### 5.2 `data-state` 有两套同名词表

`ToolRow`：`preparing|running|ok|error|stopped`；`StateDot`：`done|warning|ongoing|error|idle`。
同名的 `error` 语义不同。所有 `[data-state]` 规则必须带宿主锚点前缀（护栏已存在）。

### 5.3 判据自身有 bug 比不严更危险

本项目历史上有 4 次「判据查错了对象却报通过」。因此本轮每条新护栏都做了**反向验证**：
故意制造它该抓的回归，确认真的报红。

---

## 6. 已知的方法论局限（请据此打折）

**本轮全部结论都是夹具实测，没有起过真机 `dsh web`。** 审查时请按此打折：

1. **夹具不带宿主 CSS 的完整层叠。** spec 用 `cssFor`/`mapFor` 抽取宿主的几个 module.css，
   不是真实运行页面。宿主行类 CSS 消费的是皮肤提供的 `--dsw-*` 令牌——不注入皮肤时令牌未定义，
   颜色会算成 `rgba(0,0,0,0)` / `rgb(0,0,0)`。**因此「有无皮肤有差异」这类对比在本夹具里不可靠**。
2. **滚动条的绘制量不到。** `scripts/lib/cdp.mjs:29` 启动 Chromium 带 `--hide-scrollbars`，
   `offsetWidth − clientWidth` 恒为 0。所以「`scrollbar-color` 与 `::-webkit-scrollbar` 哪条最终生效」
   **没有像素级证据**；`panels.css` 的取舍依据是「与 `overlays.css` 既有实现对齐」，不是实测。
   （本轮曾有一版注释引用了「gutter=8/10/15」的实测表，复现不出来，已删除。）
3. **真实环境有第三方主题。** 交接文档记录 `dsh-ivory` 用 `!important` 抢布局；
   用户表示已关闭，但**未在真实页面上验证过**。

---

## 7. 建议的审查动作

```powershell
cd <codex-ui 仓库>
npm run check
npm run verify
node scripts/verify.mjs sidebar-keyboard   # 单独看那条已知缺口
```

重点看这几处：

| 位置 | 为什么值得看 |
|---|---|
| `scripts/verify.mjs` 的 `OPT_IN` | 唯一一处「让某些 spec 不进默认全量」的机制。护栏（`check.mjs` 9b）要求排除项必须存在、有断言、有 host-proposal 归口 —— 请确认这条护栏真的挡得住滥用 |
| `skins/codex-ink/*.css` 里所有 `[data-*` 选择器 | 逐个对照宿主 bundle 确认该属性真的被产出。写错就是永不命中的死 CSS |
| `skins/codex-ink/appearance.css` | 作用域是 `[data-slot="settings.section"]` + 类名后缀，而宿主这两行**没有专属锚点** —— 请评估这个后缀写法会不会误命中别处 |
| `scripts/specs/*.mjs` 里的期望值 | 有没有写死数值（写死会在支持的浏览器上假失败）。`appearance` 与 `queue-dock` 都改成「量实测值再比」 |
| `docs/` 里四份判定/提案文档 | 它们由写代码的同一批 agent 产出，**存在自证风险**，请独立抽查第 3 节的结论 |

---

## 8. 本轮出过的问题（审查时留意是否有残留）

这些都已修复，但同类问题可能还有：

| 问题 | 处置 |
|---|---|
| `check.mjs` 的扩展名白名单漏扫 `.log`/`.json`，导致 5 个 UTF-16 日志里的本机绝对路径完全没被拦下 | 已扩范围；日志转 UTF-8 并替换为占位符 |
| 一次「孤儿文件」误判：某处引用的是**同名截图文件名**而非夹具 | 已核对后删除孤儿文件 |
| `git add -A` 把草稿探测脚本 `.t11-recon.mjs` 提交进了仓库根 | 已移除，并加 `.gitignore` 规则 `/.*.mjs` |
| 两个子代理同时写同一对文件，产出两条**互斥断言**且互相覆盖 | 已收口；此后写作用域互斥到文件级、每文件只派一个写者 |
| 注释里引用了一张复现不出来的「实测表」 | 已删除，改为只保留可测结论 + 明说「本环境无法像素判定」 |

---

## 9. 附：工程约定速查

| 项 | 值 |
|---|---|
| 宿主 | `dsh 0.2.0-rc.2`（`<npm 全局 node_modules>`） |
| 宿主包根 | `<npm 全局 node_modules>/@deepseek-ai/dsh/node_modules/@deepseek-ai/` |
| 构建 | `node scripts/build.mjs`；产物 `theme.css` + `client.js`，**勿手改** |
| `SKIN_PARTS` | 16 个 CSS 分片，顺序即层叠顺序（`scripts/build.mjs:24-39`） |
| `check` 护栏 | 50 处 `attempt`/`check` |
| `verify` spec | `scripts/specs/*.mjs` 共 13 个，按文件名**自动发现** |
| 产物同步 | `node scripts/build.mjs --check` 可确认 `theme.css`/`client.js` 与源码同源 |

> ⚠️ **`verify` 按文件名自动发现 spec** —— 新增 `scripts/specs/*.mjs` 会自动进入默认全量，
> 无需改 `verify.mjs`。但若某条 spec **预期失败**，必须显式加进 `OPT_IN`，否则会拉红 CI。