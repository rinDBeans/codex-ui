# codex-ui UX 审计 · 会话交接

> 交接时间：2026-10-01
> 唯一工作副本：`<codex-ui 主检出>`（分支 `main`，HEAD `7186447`）
> 已删除：`design-system/dsh-workbench/plugin/codex-ui`（PR#3 旧检出，0.6.5，已备份后删除）

---

> **占位符对照**（本文件遵守仓库的「不得含本机绝对路径」守卫，故用占位符；
> 真实值请在本机替换，或直接看 §6 环境事实）：
> `<codex-ui 主检出>` = 本机 codex-ui 主检出目录 ·
> `<TEMP>` = 系统临时目录 ·
> `<DSH_HOME>` = `~/.dsh` ·
> `<dsh-workbench/plugin>` = 原 PR#3 检出所在目录（已删）

## 0. 新会话第一件事

```bash
cd "<codex-ui 主检出>"
export DSH_CHROME="<ms-playwright 缓存>/chromium-1234/chrome-win64/chrome.exe"

npm run check     # 期望 ALL PASS (84/84)
npm run build     # 改过 skins/ 或 src/ 后必须跑，产物是 theme.css / client.js
npm run verify    # 期望 ALL PASS (317/317)，需要 DSH_CHROME
```

**Git 状态**：27 个改动未提交（17 个已跟踪修改 + 10 个新文件），`git diff --stat` = 1288 插入 / 155 删除。
**下一步第一件事建议**：先把现有改动提交一个 WIP commit，再继续 T08 之后的任务。

---

## 1. 仓库收敛（本次已完成）

项目曾有两份 codex-ui，实测**不是重复，是分岔的两条线**：

| | `PROJIECT/codex-ui` | `design-system/.../plugin/codex-ui` |
|---|---|---|
| 分支 | `main` | `pr3-rebased` |
| 版本 | 0.7.1 | 0.6.5 |
| 状态 | 27 个未提交改动 | 干净 |

**取舍结论**：保留 `main`，删除 PR 分支检出。依据（三条独有提交逐一核对）：

| PR 提交 | 判定 | 依据 |
|---|---|---|
| `411f168` 复合 `:root` 作用域化 | A **已有** | `scripts/build.mjs` 的 `scopeSelector` 里就有 `if (s.startsWith(':root'))` |
| `64f4d60` 去祖先 `:has()`（4.3s→0.27s） | A **已吸收 95%** | 主体改写（`div:has(> * > [data-slot=sidebar.workspaces]):not(:has(...))` → `[data-slot="sidebar"] > div:not([class*="_collapsed"])`）A 已是新写法 |
| `1372e27` rebase PR#3 | A **已超越** | 其上游 `39ec999` 是 A 的祖先；`client.js` 两者差 1448 行 |

**备份**（删除前导出，`docs/archive/`）：
`pr3-411f168.patch` · `pr3-64f4d60.patch` · `pr3-1372e27.patch` · `pr3-branches.bundle`（4.6 MB，完整历史）
恢复方式：`git am docs/archive/pr3-64f4d60.patch` 或 `git clone docs/archive/pr3-branches.bundle`

### 一件尚未处理的事

`skins/codex-ink/sidebar-align.css:55` 还残留一处祖先 `:has(> svg)`：

```css
[data-slot="sidebar"] > div:not([class*="_collapsed"]) > button > span > span:has(> svg) {
  justify-content: flex-start; width: auto;
}
```

这是 rc.2 专用的对齐修正（rc.2 在按钮里多套了两层 `labelMask > content`），**不是 bug**，
只是没跟上 `64f4d60` 的性能优化。**改之前必须先实测能用什么锚点替代** —— 没验证过不要动。
建议并入 T09（侧栏任务）一起做。

---

## 2. 当前进度

| 任务 | 状态 | 说明 |
|---|---|---|
| T00 基线与复核 | ✅ | 产出两份文档，见 §3 |
| T01 真实验收链修复 | ✅ | UX-03/04 |
| T02 设置值一致性 | ✅ | UX-02/12/16 |
| T03 设置导航/关闭/语言 | ✅ | UX-01/07 ✅；**UX-06 关闭为已接受的取舍** |
| T04 模型组件 | ⛔ 方案已取消 | 用户要求保留该组件 |
| T05 保留组件回归保护 | ✅ | 代码断言 + 真实 GUI 基线截图 |
| T06 隐藏与降级安全 | ✅ | live 用例在 hero 态会 SKIP（无 tabs 节点） |
| T07 高频内容组件 | ✅ 部分 | 工具卡/回合/提问卡/引用菜单已做；**审批卡未采到样本** |
| T08 文本与弹层 | ✅ 部分 | 链接/等宽/菜单已做；**tooltip/toast 无宿主契约** |
| T09–T15 | ⬜ 未开始 | |

**验收基线**：`npm run check` 84/84 · `npm run verify` 317/317

---

## 3. 必读文档

| 文档 | 行数 | 内容 |
|---|---|---|
| `docs/codex-ui-ux-audit-plan.zh-CN.md` | 472 | 完整方案：UX-01..UX-16 判定、任务单 T00–T15、验收矩阵 §7.1/§10 |
| `docs/codex-ui-ux-audit-t00-baseline.zh-CN.md` | 472 | 真实基线：环境事实、逐项判定、**§5.1 验证回路缺陷**、§5.2 T07 取样过程、§5.3 T08、§5.4 T14 |
| `docs/recon/` | — | T00 截图与 manifest |
| `docs/archive/` | — | PR#3 备份（见 §1） |

---

## 4. 五个必须知道的坑（每一条都造成过误判）

### 4.1 live 测出的"没生效"要先分清是代码错还是产物没重建

改完 `skins/` **忘了 `npm run build`** 就跑 live，量出"CSS 规则没生效"。
实际是 `theme.css` 里根本没有那条规则（构建产物）。
**bundle 在 dsh web boot 时加载** —— 换 `theme.css` 必须重启实例。
处置：跑 live 前先 `grep` 一下产物里有没有你的标记。

### 4.2 副本可能跑的是冻结的旧代码

`robocopy` 复制 pnpm `link:` 时会把软链**解引用成真实目录快照**，
于是测试副本跑的是改动前的代码，据此得出过"UX-07 修复不生效"的错误结论。
**判据**：跑 live 前先 grep 副本的 `client.js`，确认有你最新的标记；没有就别跑。
当前副本已是 Junction：`Remove-Item` 后 `New-Item -ItemType Junction -Path <副本路径> -Target <主检出>`。

### 4.3 判据自己有 bug 却报"通过"—— 比判据不严更危险

本轮踩了 4 次，全部是**判据查错了对象**：

| 现象 | 真相 |
|---|---|
| 状态条判据说"ok 与 error 同色" | 值是对的，区分信号是 `box-shadow` 状态条不是 `color` |
| `.d.ts` 护栏显示"宿主类型声明未找到"仍 PASS | 路径少写 `client/tool/models/` 三层，`host.read()` 返回 null，**双向对账根本没跑** |
| StateDot 色值断言全 FAIL | 夹具**不接宿主 CSS**，那条规则根本不在页面里。判据该验"皮肤不接管" |
| `max-height: 40vh` 断言永远 FAIL | `getComputedStyle` 把 vh 解析成绝对像素（800px 视口 → `320px`） |

**纪律**：护栏的降级分支不能掩盖路径写错 —— 用 `assert` 硬失败，不要 `return` 降级。

### 4.4 `data-dsh-part` 宿主从不打

扫 83 个宿主 `client.js`：**`data-dsh-part` 出现 0 次**。那个键是 **skin-center 适配器**补的。
后果：只写 `[data-dsh-part="xxx"]` 的规则在**纯宿主**组合下永不命中。
**纪律**：皮肤真正依赖的组件必须同时有一条宿主真有的锚点（如 `[data-composer-chip]`）。
已有护栏：`check.mjs` 的「锚点归属」一节。

### 4.5 `data-state` 在宿主里有两套同名词表

| 属性 | 词表 | 归属包 |
|---|---|---|
| `ToolRow` 的 `data-state` | `preparing｜running｜ok｜error｜stopped` | `dsh-client-ui-tool` |
| `StateDot` 的 `data-state` | `done｜warning｜ongoing｜error｜idle` | `dsh-client-ui-primitives` |

同屏会同时出现（实测 `["done","error","idle","ok","ongoing","preparing","running","warning"]`），
同名的 `error` 语义还不同。**所有 `[data-state]` 规则必须带宿主锚点前缀**。
已有护栏：`check.mjs`「不得用裸的 [data-state] 选择器」（当前 14 条全部合规）。

---

## 5. 未完成 / 待决

### 5.1 T07 审批卡：无真实样本

三次尝试全部失败，根因已定位（`read:` 锚点 `dsh-sandbox/lib/index.js` 的 `approveEscalation`）：

```js
if (mode === effectiveMode) return effectiveMode;        // 模式没变 → 直接放行
const outcome = await approval.approver.request({...})   // 只有"提权"才问
```

审批**只在沙箱提权时触发**。写工作区外文件走路径判定，不升级沙箱模式 ⇒ `policy: ask` 也不弹。
要触发需让某次调用显式申请更宽模式（`workspace-write` → `full`）。
⇒ `content.css` 的 `[data-approval-key]` 规则**无真实样本支撑**，仅静态契约 + 夹具断言。

### 5.2 T07 目标条：仅静态契约

`data-goal-bar` / `data-command-input` 宿主存在，未采到触发样本。

### 5.3 T08 tooltip/toast：无宿主契约

扫 83 个宿主 bundle：`data-toast` **0 处**；`role="tooltip"` 仅 1 处，而 `role="status"`(66)/`role="alert"`(52) 遍布。
凭 ARIA role 写样式会命中无障碍实时区。**按方案 §7.2 不做假占位**，已列为宿主提案（记在 T00 §5.3.3）。

### 5.4 hero 工作区行被第三方主题接管

`dsh-ivory` 用 `!important` 抢了布局（`margin: 8px auto 0 !important`），
导致我们 `composer.css:190` 的"探在卡背后"叠放设计失效，工作区行整块露在输入卡下方。
**这是环境冲突，不是 codex-ui 的 bug**（`composer.css` 本轮未改）。
`specs/composer.mjs:346-348` 只断言圆角相同、**从不断言叠放几何** —— 这是漏检点。
可选处置：改成不依赖叠放几何的独立 meta 行，或在 spec 补"不得与卡重叠"的断言。

### 5.5 隔离 home 的临时改动（未还原）

测试用隔离 home：`<TEMP>/codex-ui-audit\real-home`

| 文件 | 改动 | 备份 |
|---|---|---|
| `profiles/headless/cordis.patch.yml` | provider → `deepseek-official` | `.bak-token-rhythm` |
| `profiles/web/cordis.patch.yml` | provider → `bailian`；`approval.policy: ask` | `.bak-pre-t07`、`.bak-pre-approval` |

另：`<TEMP>/codex-ui-audit\real-home\profiles\web\node_modules\codex-ui` 是指向主检出的 Junction。

**你的日常 home `<DSH_HOME>` 未被改动。**

---

## 6. 环境事实

| 项 | 值 |
|---|---|
| dsh | `0.2.0-rc.2`（`<dsh 全局安装目录>`） |
| Chromium | `<ms-playwright 缓存>/chromium-1234/chrome-win64/chrome.exe` |
| 宿主解析 | `scripts/lib/host.mjs` 的 `openHost()`；**不要**建 `scripts/host.local.json` 指向 `app.asar`（asar 里没有 `.d.ts`，会让 T07 护栏失败） |
| 真实 profile | 跑第三方主题 `dsh-ivory`（`body.dsh-ivory`），用 `!important` 接管部分外壳属性 |
| 版本门挡住的 bundle | `dshmarket` `dsh-llm-verifier` `dsh-theme-mineradio` `@michengai/dsh-archive-manager` |

**提交前必须跑 `npm run check`** —— 它有「源码、样式与文档无机器专属绝对路径」一条，
文档里写了本机绝对路径会 FAIL（用 `<TEMP>` `<DSH_HOME>` `<codex-ui 主检出>` 占位）。
