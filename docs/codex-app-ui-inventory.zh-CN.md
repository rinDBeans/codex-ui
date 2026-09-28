# Codex 桌面应用 UI 层功能清单（只读调查）

> 用途：为「往 DSH 插件里加哪些组件 / 功能」做筛选底表。
> 本轮**只读**：没有改动任何既有文件；所有锚点都能用 §5 的三条正则在本机复跑。

## 0. 调查对象与判据

| 输入 | 体量 | 说明 |
|---|---|---|
| `<codex-ref>/codex-app.css` | 627 KB | 应用主样式（Tailwind 产物 + Monaco/vscode 令牌） |
| `<codex-ref>/codex-app-initial.css` | 100 KB | **语义层**：203 个 `_Name_hash_N` 形式的 CSS-Modules 类 |
| `<codex-ref>/codex-app-initial.js` | 14.8 MB | 命令注册表与 DOM 契约（`codex.command.*` 只在这里出现） |
| `<codex-ref>/codex-register.js` | 5.1 MB | 注册表引导；`codex.*` 键 0 个（命名空间不在这里） |
| `<codex-ref>/codex-model-picker.css` / `codex-composer.css` / `codex-theme-generated.css` | 12/46/93 KB | 模型选择器、composer、生成的主题令牌 |
| `<openai-codex 克隆>`（`openai/codex`） | 4925 `.rs` + 1429 `.snap` | Rust CLI/TUI；**不含**桌面界面，桌面界面只在 asar 里 |

**判据（怎么分「界面层」与「需要宿主能力」）**

1. **界面层**＝shipped CSS/JS 里能 grep 到 class、`data-*`、token 三选一，**且数据在渲染时已在 DOM**（状态属性、结构类名、伪类、`aria-*`）。
2. **需要宿主能力**＝JS 里对应一条通道或持久化命名空间（`thread/*`、`git.*`、`fs/readFile`、`realtimeVoice.*`、`interactive/*`），DOM 只是结果，插件拿不到输入源。
3. 行号锚点只在 `.rs` 里可用：CSS/JS 是压缩单行产物，锚点一律给可复制的 grep 串。

## 1. 界面组件

| 组件 | 作用 | 证据锚点（可 grep） | 层级 |
|---|---|---|---|
| 应用外壳 + 标签条 | 多标签、应用菜单栏、主内容框、顶部分界渐隐 | `data-app-shell-tabs` `data-app-shell-tab-strip-controller` `data-app-shell-main-surface` `data-app-shell-main-content-top-fade` `_ApplicationMenuTopBar_zbk1f_3` `_MainContentFrame_zbk1f_191` | 纯 CSS（结构宿主给） |
| 侧栏 | 侧栏面与折叠触发 | `codex.command.toggleSidebar` `data-app-shell-sidebar-trigger` `--sidebar-scroll-*`(6) | 纯 CSS（动作为宿主） |
| 命令面板（cmdk） | ⌘K 面板、空态、加载态 | `data-cmdk-root` `data-cmdk-list` `data-cmdk-empty` `data-command-menu-loading` `data-command-menu-empty-state`；token 家族 `command-menu` | 纯 CSS+DOM |
| 模型选择器 | 触发器 + 功率滑杆 + Fast 粒子轨 | `data-model-picker-power-slider` `data-max-effort` `_Track_m3zgh_423` `_ThumbInput_m3zgh_231` `_FastTrackParticles_1ibg9_1` `ModelPickerTrigger*`；token `--model-picker-*` `--particle-*` | 纯 CSS+DOM |
| 输入区 composer | 工具条、附件、图片、提及、悬浮卡 | `codex.command.composer.*` `attachmentsDefault` `data-file-reference` `data-inline-mention-interactive` `_floatingComposerInset_` | CSS+DOM |
| 底部面板 / 终端 | 下方面板与终端页 | `toggleBottomPanel` `toggleTerminal` `data-codex-xterm`（xterm 155 处） | DOM 可做，PTY 需宿主 |
| 浏览器面板 | 内嵌浏览器、地址栏、页面批注 | `toggleBrowserPanel` `openBrowserTab` `focusBrowserAddressBar` `data-browser-sidebar-address-input` `data-browser-comment-editor-surface` | 需宿主（webview） |
| 文件树面板 | 项目行、文件树 | `toggleFileTreePanel` `data-project-row` `data-projects-rows` `data-appgen-row` | DOM 可做，读盘需宿主 |
| Review / Diff 面板 | diff 视图、跳行、批注 | `openReviewTab` `toggleReviewPanel` `goToLine` `--codex-diffs-*`(4) `vscode-editor:5` `data-pierre-editor-annotation` | DOM 可做，diff 数据需宿主 |
| Markdown 渲染层 | 标题 1–6、表格、Mermaid、KaTeX | `_markdownContent_n4vg1_147` `_heading1_n4vg1_277` `_tableWideBlock_n4vg1_77` `_mermaidBlock_` `data-mermaid-overflow`（katex 类 390 个） | 纯 CSS |
| 代码块编辑 | 编辑器框架与装饰 | `data-composer-code-block` `ProseMirror`(114 次) `pierre`(91 次) `--codeblock-syntax-*`(5) | 纯 CSS |
| 任务清单 | 复选列表 | `_taskList_` `_taskListItem_` `data-task-list-item` `--vscode-charts-*`(8) | 纯 CSS |
| 设置 / 控制窗口 | 设置、MCP、个性化 | `codex.command.settings` `mcpSettings` `personalitySettings` `openControlWindow` | DOM+宿主（读写配置） |
| 弹窗 / 浮层 | 模态、下拉、过渡态 | `_Overlay_1pmya_95` `_modal_` `--modal-backdrop-*`(5) `data-transition-state` `data-entering*` `data-exiting*` | 纯 CSS |
| 基础控件 | 开关 / 分段 / 滑杆 / 单选 | `--switch-track-*`(7) `--switch-thumb-*`(5) `--segmented-control-*`(6) `--slider-*` `--radio-group-*`(10) | 纯 CSS |
| Fast 模式开关 | 首页 Fast 按钮与点阵过渡 | `_FastModeToggle*` `data-fast-mode` `data-fast-mode-enabled` `data-fast-mode-dot-transition` | 纯 CSS |
| 视图切换 | 简单 / 高级视图轨道 | `_AdvancedView` `_SimpleView` `_ViewToggle*` `_ViewPanel` `_ViewTrack` | 纯 CSS |
| 线程内查找 | 命中高亮与占位 | `data-thread-find-target` `_Match_sh1gm_1` `_Placeholder_xaac8_23` `findInThread` | 纯 CSS+DOM |
| 首页工具条 / 项目选择 | 项目下拉、清空、运行环境后缀 | `_homeUtilityBar_2l838_2` `_dropdownLabelCategory_2l838_2` `data-project-selector-icon` `_runLocationEnvironmentSuffix_` | 纯 CSS |
| 状态与告警 | 进度药丸、用量超额、就绪脉冲 | `_statusPillProgress` `_UltraUsageWarning*` `data-ultra-warning-visible` `_readyPulse*` | 纯 CSS |
| 无障碍键盘提示 | 键盘控制与播报 | `_KeyboardControl` `_KeyboardAnnouncement` `data-keyboard-focused` | 纯 CSS |
| 宠物 / 快速聊天 / 侧边聊天 | 浮层类附加窗口 | `openPetOverlay` `quickChat` `openSideChat` `hotkeyWindow` | 需宿主 |

## 2. 交互功能

| 功能 | 证据锚点 | 层级 |
|---|---|---|
| 命令注册表（97 条） | `codex.command.*`(97) + `codex.commandMenuTitle.*`(49) + `codex.commandDescription.*`(95) | 面板纯 CSS；动作需宿主 |
| 线程 / 会话管理 | `newThread` `archiveThread` `forkThread` `toggleThreadPin` `previousThread` `nextThread` `previousRecentThread` `openThreadInNewWindow` `thread1..thread9` | 需宿主 |
| 查找 | `findInThread` `searchChats` | 需宿主（命中数据） |
| 快捷键表 | `keyboardShortcuts` `showKeyboardShortcuts`；键位串 107 个（`Mod-1`…`Mod-9`、`Mod-Enter`、`Ctrl-ArrowUp`、`Cmd-ArrowDown`） | 表格纯 CSS，绑定需宿主 |
| 审批 | `approval.approve` `approval.decline`（approval 886 处） | 需宿主 |
| 计划模式 / Worktree 模式 | `composer.togglePlanMode` `composer.toggleWorktreeMode`（worktree 1052 处） | 需宿主（开关态可 CSS） |
| 推理强度 / Fast | `composer.cycleReasoningEffort` `composer.increase/decreaseReasoningEffort` `composer.toggleFastMode` | 需宿主 |
| 语音与听写 | `composer.startVoiceMode` `composer.startDictation` `globalDictationHold` `globalDictationToggle` `realtimeVoice.*`（语音 579 处） | 需宿主 |
| Git 动作 | `git.commit` `git.createBranch` `git.create/merge/openPullRequest` | 需宿主 |
| 任务管理 | `manageTasks` `newProjectlessTask` `data-task-list-item` | 需宿主 |
| 技能 | `openSkills` `forceReloadSkills` | 需宿主 |
| MCP / 配置 | `mcpSettings` `personalitySettings` `openControlWindow` | 需宿主 |
| 进程管理 | `openProcessManager`（55 处） | 需宿主 |
| 导入外部 agent | `importExternalAgent` `externalAgentConfig/*` | 需宿主 |
| 多智能体 | `multiAgent` / `subagent`（307 处） | 需宿主 |
| 应用级撤销 / 重做 | `undoAppAction` `redoAppAction` | 需宿主 |
| 浏览器批注 | `data-browser-comment-*`（8 个锚点） | 需宿主 |
| 反馈 / 登出 / 运行时安装 | `feedback` `logOut` `installPrimaryRuntime` | 需宿主 |

## 3. TUI 侧独有（`codex-rs/tui`，桌面应用无对应形态）

| 项 | 作用 | 证据锚点 |
|---|---|---|
| 62 条斜杠命令 | `/model /ide /permissions /keymap /vim /elevate-sandbox /auto-review /memories /skills /hooks /review /rename /new /archive /delete /resume /fork /worktree /init /compact /recap /plan /voice /goal /agents /side /btw /copy /export /raw /tui /diff /mention /status /daemon /warnings /cd /pwd /usage /debug-config /title /statusline /theme /pets /mcp /apps /plugins /logout /quit /exit /feedback /rollout /ps /stop /clear /test-approval /multi-agents /memory-drop /memory-update` | `codex-rs/tui/src/slash_command.rs:12`–`:368`（`pub enum SlashCommand`，`#[strum(serialize_all = "kebab-case")]`） |
| 键位系统 | 自定义键位与设置向导 | `tui/src/keymap.rs`(4084 行) `tui/src/keymap_setup/` |
| 主题选择器 | `/theme` 交互式选主题 | `tui/src/theme_picker.rs`(631 行) |
| 状态指示器 | `/status` `/usage` 面板 | `tui/src/status_indicator_widget.rs`(584 行) `tui/src/status/` |
| diff 渲染 | 终端内 diff 与模型 | `tui/src/diff_render.rs`(2746 行) `tui/src/diff_model.rs` |
| 会话恢复选择器 | 带 transcript 预览 | `tui/src/resume_picker.rs`(7326 行) `tui/src/resume_picker_transcript_preview.rs` |
| 分析面板族 | plan / summary / task / tool / tokens + 绘图 | `tui/src/analytics/`（`plan_panel` `summary_panel` `task_panel` `tool_panel` `plot/annotations`） |
| 半屏分页器 | transcript 分页覆盖层 | `tui/src/pager_overlay.rs`(580 行) |
| transcript cells | 历史单元 + 1429 个快照 | `tui/src/history_cell/mod.rs`(376 行) + `history_cell/snapshots/` |
| 无障碍与终端特性 | 屏幕阅读器、终端超链接、富文本剪贴板 | `tui/src/screen_reader.rs` `screen_reader_windows.rs` `terminal_hyperlinks/` `clipboard_html.rs` |
| 空态动画 / 动效 | shimmer、motion、空态 | `tui/src/empty_state_animation/` `shimmer.rs` `motion.rs` |
| 宠物 | 状态宠物 | `tui/src/pets/` |

## 4. 给 DSH 插件的筛选建议

- **能由皮肤插件独立完成**（只依赖类名 / token / `data-*` 与已有 DOM）：cmdk 面板、模型选择器、Markdown / 代码块 / 表格 / Mermaid、任务清单、弹窗与基础控件、Fast 开关、视图切换、查找高亮、首页工具条、状态告警、键盘提示。
- **必须放弃或等宿主开口子**：终端 PTY、浏览器 webview、文件树读盘、diff 数据、审批、语音 / 听写、git、任务、进程管理、多智能体、撤销栈。
- **最快的可行性判据**：带 `data-*` 的 111 项基本可 CSS 命中；只出现在 97 条命令注册表里的，绝大多数是**动作**而不是外观。

## 5. 复跑方法（三条正则 + 一处 Rust 枚举）

```js
// 1) 命令注册表（只在 codex-app-initial.js 里）
[...js.matchAll(/"codex\.command\.([a-zA-Z0-9_.-]{2,70})"/g)]           // 97 条
// 2) 语义类（codex-app-initial.css）：_Name_hash_N
[...css.matchAll(/\._([A-Za-z][A-Za-z0-9]*)_[a-z0-9]{5}_\d+/g)]         // 203 个
// 3) DOM 契约：CSS 侧 111 个、JS 侧 343 个
[...css.matchAll(/\[data-([a-z][a-z0-9-]{2,50})/g)]
[...js.matchAll(/["'](data-[a-z][a-z0-9-]{2,50})["']/g)]
```

TUI 枚举：读 `codex-rs/tui/src/slash_command.rs`，从 `pub enum SlashCommand {` 到下一个顶格 `}`，
取每行形如 `    Variant,` 的项 —— 实测 **62** 项，枚举体是 **L12–L86**（文件共 367 行）。

## 6. 已知局限与更正

- **更正**：上一轮口头汇报里写的「61 条斜杠命令」是捕获窗口截断导致的少数一项，实测为 **62**；
  同一处口头汇报里的「L12–L368」也是同一个截断造成的，枚举体实际到 L86（367 行的文件不可能有 368 行）。
- `codex.command.*` 只在 `codex-app-initial.js` 出现；`codex-register.js` 里 0 条 —— 换文件扫会得到空结果。
- 斜杠命令的字面量（`/model` 等）不在 `slash_command.rs` 里，由 `strum` 的 `serialize_all = "kebab-case"` 生成，所以对字符串 grep 会落空。
- CSS/JS 均为压缩单行产物，**没有行号锚点**，只有 grep 串。
- 计数类数字（155 / 498 / 886 / 1052 / 579 / 307）是关键词在 `codex-app-initial.js` 里的出现次数，属**存在性证据**，不等于组件数量。
