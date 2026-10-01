# T10 判定：输入区候选优化 —— 宿主已满足，无需改动

> 判定日期：2026-10-01　｜　依据：方案 §8 T10「复核后定级 / 复核后定级，确认问题后才调整」与 §0.3
> 判据：`node scripts/specs` 静态读宿主包 + `cssFor`/`mapFor` 取真实映射，全部只读，未改任何产品文件。

## 1. 结论

方案 §6.2 列出的输入区能力，宿主**已全部实现**。按 §0.3「宿主已满足的项标『已满足，无需改动』」，
本轮**不对输入区写任何新样式**。皮肤 `composer.css`（8.3 KB）已覆盖卡片几何、底栏控件带、
建议菜单与 hero 布局。

## 2. 逐项证据

| 方案 §6.2 要求 | 宿主实况 | 锚点 / 证据 |
|---|---|---|
| 多行 / 超长 prompt | **已满足** | `dsh-client-ui-conversation/lib/client.js` 的 `editor.module.css`：`min-height:44px; overflow-wrap:anywhere`，编辑区 `[data-composer-input]` 为 `contentEditable` + `role=textbox` |
| 中文 IME（`event.isComposing` 期间不发送） | **已满足** | `registerComposerKeymap()` 在 `compositionstart/end` 上 `toggleAttribute("data-composer-composing")`；宿主 CSS 已有 `.input[data-composer-composing] p:last-child:after{content:none}` 与 `+.placeholder{visibility:hidden}` |
| 发送键策略 | **已满足** | 宿主 `EnterBehaviorRow` 模块（按宿主设置），皮肤只把发送键画成墨色圆点，未改语义 |
| 附件 | **已满足** | `dsh-client-ui-attachment`（`data-variant` 区分形态）；队列侧 `QueueDock` 也有 `attachments`/`file`/`fileIcon` |
| follow-up queue / steer | **已满足** | `data-queue-dock`（`QueueDock.module.css`），含 `pendingRow`/`preview`/`actions`；皮肤未接管其语义 |
| 提及 / 引用建议 | **已满足** | `dsh-client-ui-input-trigger` 的 `data-trigger-menu` + `data-overflow-below`；皮肤 `composer.css` ⑭·4 只调材质与宽度 |
| 工作区数据 | **已满足** | hero 行 `_heroWorkspaceRow`，皮肤只调几何 |

## 3. 保留组件未受影响（T10 硬约束）

本轮**未改** `skins/codex-ink/model-picker.css` 或 `model-picker/` 任何文件；
`check` 的「保留组件基线」一条仍 PASS，轨道/胶囊几何与顶档点阵未变。

## 4. 遗留发现（非本轮改造项）

**圆角档位两套并存、互不桥接。**

- 皮肤自有档：`--dsw-radius-xs/s/m/l/xl/2xl/menu/card/pill`（`skin.css` 声明）。
- 宿主组件档：`--dsw-radius-sm/md/lg`（`ui-theme` 声明）。
- 皮肤**没有**把前者桥接到后者；两者都由 `ui-theme` 兜底解析，**当前不炸**。
  证据：皮肤消费方（`composer.css` 等）用的是 `-s/-m/-l`，宿主 `QueueDock`/`InputBar` 用的是 `-sm/-md/-lg`；
  6 个 `-sm/-md/-lg` 令牌在 `ui-theme` 中均有定义（`node` 读 `dsh-client-ui-theme/lib/client.js` 逐个核对），
  故解析成功。
- 风险：未来宿主若调整 `-sm/-md/-lg` 取值，宿主组件圆角会变而皮肤档位不动，二者脱节。

处置：**本轮不动**。桥接属于「共享 token 变更」，按方案 §0.1 与 §7.2 须经集成 owner 审核，
且需在真实页面确认对齐收益后再做；已在此记录，供后续批次（配合 T15 交付整合）一并评估。

## 5. 复现

```powershell
node scripts/verify.mjs composer   # 现有 shadow / hero 两条，全 PASS
npm run check                     # 85/85（判定前后未变）
```