# T12 判定：命令发现与快捷键 —— 宿主提案，不在皮肤层实现

> 判定日期：2026-10-01　｜　依据：方案 §8 T12 与 §0.3 / §7.2
> 证据：静态读 `dsh-client-ui-commands` 与 `dsh-client-ui-shortcuts` 的随包 bundle。
> 局限：未起运行时抓 DOM，挂载点为**契约级**结论；但「无锚点」的判定基于 bundle 根本不产出该 token，静态即可确证。

## 1. 结论

**T12 不在皮肤层实现。** 三条理由都可举证，任一条都足以否决：

1. **没有面板专属锚点。** `dsh-client-ui-commands` 全包只产出 **1** 个 `data-*`：`data-plugin-css`。
2. **面板材质 T08 已接管。** `overlays.css` 的 `[data-menu-material]` 已把 `--dsw-menu-backdrop-filter` 压成 `none`；
   皮肤再做只剩内部排版，而内部元素**零 `data-*`**，只有哈希类名。
3. **快捷键那一半必须走宿主。** 插件不得另建命令注册表（§7.2）。

## 2. 挂载点与可用锚点

| 层级 | 实际产出 | 可用性 |
|---|---|---|
| 槽出口 | `<div data-slot="conversation.input.overlay" style="display:contents">` | **共享**：input-trigger 与 message-feedback 也挂这里 |
| 面板根 | `MenuSurface` → `data-menu-material="translucent"` | **全族共享**：所有菜单共用 |
| 面板内部 | 仅哈希类名 + ARIA role | 无 `data-*` |

唯一区分手段是排除法：`[data-slot="conversation.input.overlay"] [data-menu-material]:not([data-trigger-menu])`，
即**靠兄弟组件不变**——违反 §7.2「稳定语义属性优先」。不采用。

## 3. 状态映射（供宿主提案参考）

| 状态 | 类名键 | 可用锚点 |
|---|---|---|
| 面板根 | `card` | `[data-menu-material]`（共享） |
| 搜索框 | `search` | `input[type=text]` + `aria-label` |
| 列表容器 | `viewport` | `role="listbox"` + `aria-label` |
| 行 / 选中行 | `row` / `rowActive` | `role="option"` + `aria-selected` |
| 错误 + 重试 | `error` / `errorText` / `retry` | `role="alert"`；重试是 `button` |
| 勾选 / 徽标 / 详情 / 状态 / 分组标题 | `check` `badge` `detail` `status` `label` | **无** |

注：`status` 一个类同时承载「加载中 / 应用中 / 无选项」三态，无独立锚点。

## 4. Ctrl+K：冲突是既成事实，不是风险

- `dsh-client-ui-workspace` 已把 `KeyK` + `["primary"]` 绑给 **`session.search`**。
  整个 `@deepseek-ai` client bundle 集合里 `KeyK` 只出现这一次。
- 面板**不显示任何键位提示**（`shortcut` 在 commands bundle 中出现 **0 次**），
  所以方案 §6.5「快捷键提示必须与实际绑定一致」在面板上无着力点。

## 5. 宿主提案（三选一）

1. 给 `PopupSelectView` 根加 `data-command-popup`；或让槽注册 id（`command-popup`）落到 DOM 的 entry 级标记上。
2. 若要暴露「命令发现」，由宿主提供稳定的命令清单渲染位；插件只经 `commandUi` 注册真实命令，不复制注册表。
3. Ctrl+K：宿主决定是让给命令面板，还是保持 `session.search` 并在面板上不承诺键位。

## 6. 若日后坚持在皮肤层做

唯一可辩护的范围：以 `[data-slot="conversation.input.overlay"] [data-menu-material]:not([data-trigger-menu])` 为根，
用 `role="listbox" / "option" / "alert"` + `aria-selected` 做**只读外观统一**，
并在 `check` 加护栏对账 `data-trigger-menu` 仍在（否则排除法失效会误伤触发器菜单）。**不得**使用哈希类名。