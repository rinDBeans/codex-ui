# 宿主提案：侧栏行键盘可达性（T09 发现）

> 提出方：codex-ui 0.7.1 · T09 侧栏组织与密度　｜　日期：2026-10-01　｜　状态：**待宿主侧处理**
> 依据方案 §7.2：「没有接口的工作形成宿主提案，不做假按钮占位」。本文件记录皮肤层**无法**自行修复的缺口。

## 1. 现象

侧栏的会话行 / 工作区行只能靠鼠标打开行操作菜单（⋯）。键盘用户无法到达该菜单，
也无法让焦点落在行上 —— 因为行根本不可聚焦。

实测（`scripts/specs/sidebar-rows.mjs` 的 c1/c2/c3 三条断言，宿主 CSS 与渲染代码均已核对）：

| 项 | 实测 |
|---|---|
| 行元素 | `div[role="treeitem"]`，**无 `tabindex` 属性**（`tabIndex` 实测 -1） |
| 全包 `tabIndex` 出现次数 | 整个 `dsh-client-ui-workspace` bundle 只有 **1** 处，属于搜索框 `searchInput` |
| `rowActions` 宿主样式 | `display:none`，仅在 `:hover` 与 `_menuOpen` 下变 `inline-flex` |
| `:focus-within` 规则 | bundle 内**不存在** |
| Tab 24 步实测 | 只在 5 个侧栏按钮间循环，全部会话行与行内操作按钮均不可达 |

## 2. 为什么皮肤层修不了

`display:none` 的元素不进入 Tab 序列，而**纯 CSS 没有把 `display:none` 变成可聚焦的开关**。
皮肤若用 JS 给行补 `tabindex`，就等于改动宿主的 React 渲染输出 —— 违反方案 §7.2
「宿主节点不搬移、不克隆」。

另有一个次级问题：长会话名的全名靠 `HoverCard`（`openDelayMs: 800`，由 `onPointerEnter` 触发），
键盘路径未确认，同样属于宿主能力范围。

## 3. 建议的宿主改动（任选其一即可闭环）

1. **行可聚焦**：给 `projectRow` / `sessionRow` / `searchResultRow` 加 roving tabindex
   （容器 `tabindex=0` + `aria-activedescendant`，或每行 `tabindex=-1` + ↑↓ 在行间移动焦点）。
2. **焦点时露出操作区**：`rowActions` 增加一条 `:focus-within` 规则，与现有 `:hover` 并列：

   ```css
   .sessionRow:focus-within .rowActions,
   .projectRow:focus-within .rowActions { display: inline-flex; }
   ```

3. **焦点指示**：为行补一条 `:focus-visible` outline（当前 bundle 内唯一一条 `:focus-visible`
   只覆盖搜索按钮，不含行）。

1 与 2 缺一不可：只做 1 不做 2，焦点能进行但按钮仍 `display:none`；只做 2 不做 1，
`:focus-within` 永远不会触发。

## 4. 皮肤侧现状

对应断言已记为 **XFAIL**（不是 FAIL，也不删除）：
`ALL PASS (331/331, 3 条 XFAIL)`。宿主修好后它们会自动转 PASS 并从汇总中消失，无需改动本仓库。

## 5. 复现方式

```powershell
node scripts/verify.mjs sidebar-rows
```

另可直接核对宿主源码：`dsh-client-ui-workspace/lib/client.js`（行渲染处无 `tabIndex`）
与 `Rows.module.css`（`rowActions` 的四条规则无任何 focus 选择器）。