# docs/ · 索引

本目录是 codex-ui 的**过程留档**：动手前的侦察、对账与计划，以及可复用的验收基准。
它不随 npm 包发布（`package.json` 的 `files` 不含 `docs`），只服务于读仓库的人。

## 怎么读

- **每份文档顶部都有一行「状态」引用块**，写清它是**现行**还是**历史留档**、对账时点是哪个版本。
  没有状态行的，就是仍按原样有效的参考资料。
- **语言不统一是有意的**：这些文档按当时的内容定语言，没有做中英成对
  （成对要求只覆盖仓库根与 `skins/codex-ink/` 的 6 份 README / CHANGELOG，见 `scripts/check.mjs` 的「双语文档成对」）。
- **历史文档里的数字是当时的读数**，不是现值。行号、体积、断言条数、截图路径都可能已经变了；
  现行数字一律以仓库 README 的「验收」表与 `node scripts/check.mjs` 的实跑输出为准。

## 清单

| 文档 | 语言 | 状态 | 内容 |
|---|---|---|---|
| [codex-ui-ux-audit-plan.zh-CN.md](codex-ui-ux-audit-plan.zh-CN.md) | 中文 | **现行执行方案 · 2026-09-30 · 已按用户修订** | 当前模型选择器与推理强度胶囊完整保留；旧DSH截图仅作历史，先采新版真实GUI再决定改造项。包含源码发现、能力边界、任务依赖、回归保护、验收和执行指令。 |
| [codex-ui-ux-audit-t00-baseline.zh-CN.md](codex-ui-ux-audit-t00-baseline.zh-CN.md) | 中文 | **T00 交付 · 2026-09-30 · 真实宿主实测** | 当前真实基线：宿主版本、profile 组合、被版本门禁跳过的 4 个 bundle、两个 live 脚本的实测结果，以及 UX-01～UX-16 的逐项判定（已满足/确认问题/待核实）。 |
| [codex-ui-audit-handover.zh-CN.md](codex-ui-audit-handover.zh-CN.md) | 中文 | **交接稿 · 2026-10-01** | 上一轮（T00–T08）的会话交接：环境事实、验收基线、五个造成过误判的坑、以及未完成项。**其中「隔离 home 未还原」一条已于 2026-10-01 处理完毕。** |
| [codex-ui-t10-verdict.zh-CN.md](codex-ui-t10-verdict.zh-CN.md) | 中文 | **T10 判定 · 2026-10-01** | 输入区逐项判定：多行/超长、中文 IME、发送键、附件、follow-up queue、提及建议**宿主全部已满足**，故未新增输入区样式。附一处遗留（两套圆角档位未桥接）。 |
| [codex-ui-t12-verdict.zh-CN.md](codex-ui-t12-verdict.zh-CN.md) | 中文 | **T12 判定 · 2026-10-01** | 命令面板**无专属锚点**（commands 全包只产出 1 个 `data-*`），材质已被 T08 接管，故不在皮肤层实现，记为宿主提案。附 Ctrl+K 已被 `session.search` 占用的确证。 |
| [host-proposal-sidebar-keyboard.zh-CN.md](host-proposal-sidebar-keyboard.zh-CN.md) | 中文 | **宿主提案 · 待处理** | 侧栏行键盘不可达：行是 `div[role=treeitem]` 且无 `tabindex`，`rowActions` 默认 `display:none` 且无 `:focus-within`。纯 CSS 修不了，需宿主加 roving tabindex。对应断言在可选 spec `sidebar-keyboard`（不进默认全量）。 |
| [codex-app-ui-inventory.zh-CN.md](codex-app-ui-inventory.zh-CN.md) | 中文 | 参考 · 仍有效 | Codex 桌面应用 UI 层的功能清单（只读调查）：界面组件、交互功能、TUI 侧独有项，以及「给 DSH 插件加哪些」的筛选建议。§5 给了可复跑的三条正则。 |
| [next-components.zh-CN.md](next-components.zh-CN.md) | 中文 | **部分已消费** | 还没做的组件、功能与优化对账稿：令牌级缺口、组件级缺口（50 个客户端包里 19–28 个零锚点）、功能候选、工程优化、够不着的边界，以及建议批次。 |
| [plan-model-picker.zh-CN.md](plan-model-picker.zh-CN.md) | 中文 | **历史 · 已执行（0.6.0）** | 把模型选择器做成真组件的原始计划（对齐 dsh-claude-style 的夺席位 + 宿主唯一真源做法）。实现即功能表里的 ⑳。 |
| [dom-recon-settings-layout.md](dom-recon-settings-layout.md) | 中文 | **历史 · 改造已落地（0.7.0）** | 设置模态框 Codex 化（㉑）动手前的 DOM 侦察基线：容器 selector 链、13 项设置清单、React 重渲染对注入节点的影响实测、风险点与证据附录。 |
| [references/ui-ux-pro-max-quick-reference.md](references/ui-ux-pro-max-quick-reference.md) | 中文 | 参考 · 仍有效 | 交付前自查与验收基准：视觉质量、交互、明暗模式、布局间距、无障碍，以及与本实现的已知张力（验收时显式处理，不静默放过）。 |

## 已知缺口（如实记录，不假装完整）

- `dom-recon-settings-layout.md` 的**截图没有随仓库提交**：它引用的是侦察时那份检出里的
  `docs/recon/` 目录（`01-settings-closed.png` 等 8 张）。正文的 selector 与尺寸读数仍是可复跑的实测值，
  但图片本身在本仓库里不存在。
- `next-components.zh-CN.md` 的**断言条数是历史读数**（例如当时写「设置卡断言 22 条」），
  现行条数以 README「验收」表为准。
- 三份计划/侦察稿描述的工作**都已落地**（⑳ 模型选择器、㉑ 设置模态框、⑬d 轨迹退出出口），
  它们保留的价值是**决策依据**，不是待办清单。
