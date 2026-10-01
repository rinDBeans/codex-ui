/**
 * 侧栏行键盘可达性 —— 独立可选 spec，**不进默认全量验收**。
 *
 * 为什么拆出来：T09 查实这三条是**宿主缺陷**，皮肤层修不了 ——
 *   · 行是 div[role=treeitem]，整个 dsh-client-ui-workspace bundle 只有 1 处 tabIndex（属于搜索框）；
 *   · .rowActions 默认 display:none，只在 :hover/.menuOpen 露出，没有 :focus-within，
 *     而 display:none 的元素不在 Tab 序列。
 * 纯 CSS 无法让不可聚焦元素获得焦点，也不该用 JS 改宿主 React 节点的属性（方案 §7.2）。
 * 提案见 docs/host-proposal-sidebar-keyboard.zh-CN.md。
 *
 * 为什么不留在全量：它们会**稳定地**报红，而本仓库改不动 —— 长期挂红会淹没真正的回归信号。
 * 断言一条也没删：宿主修好后本 spec 自动转 PASS，届时把它并回 sidebar-rows.mjs 即可。
 *
 *   node scripts/verify.mjs sidebar-keyboard    # 单独跑，看当前缺口
 *   npm run verify                              # 默认全量，不含本 spec
 */
import { pageHtml, sidebarHost } from './sidebar-rows.mjs';

async function keyboard(t) {
  const { css, S, W, R } = sidebarHost(t.host);
  const page = await t.page({ width: 1300, height: 900, dpr: 2 });
  await page.setContent(pageHtml(css, S, W, R, { theme: t.theme(), searchExpanded: false, empty: false }), 500);

  const skip = await page.evaluate(() => document.querySelector('[data-row-key="session:normal"]') === null);
  t.check('夹具就绪：session 行按 data-row-key 可定位', !skip, '[data-row-key="session:normal"]');
  if (skip) return;

  const focusProbe = await page.evaluate(() => {
    const row = document.querySelector('[data-row-key="session:normal"]');
    const before = document.activeElement;
    let moved = false;
    try { row.focus(); moved = document.activeElement === row; } catch { moved = false; }
    const s = getComputedStyle(row);
    return {
      tabIndex: row.tabIndex, hasTabIndexAttr: row.hasAttribute('tabindex'),
      moved, beforeTag: before === null ? null : before.tagName,
      outlineWidth: s.outlineWidth, outlineStyle: s.outlineStyle, outlineColor: s.outlineColor,
    };
  });
  t.log('焦点探针 ' + JSON.stringify(focusProbe));

  /* 判据设计订正（0.7.2，独立审查发现）：
     c1 原写 tabIndex >= 0。宿主提案认可的两种修法（容器 tabindex=0 + aria-activedescendant、
     或 roving tabindex）修完后，**行本身的** tabIndex 仍然是 -1（焦点靠脚本移到代理元素上），
     照原判据会永远红 —— 判据比缺陷还苛刻，等于要求宿主按错的方案修。
     改以「focus() 之后焦点是否真的落到该行」为准：这才是可达性的实际含义。 */
  t.check('(c1) 会话行可被键盘聚焦（focus() 后焦点落到行上）',
    focusProbe.moved,
    'div[data-row-key="session:normal"][role=treeitem] → focus() 后 activeElement 是否为该行='
      + focusProbe.moved + '（tabIndex=' + focusProbe.tabIndex + '，tabindex 属性存在=' + focusProbe.hasTabIndexAttr
      + '；tabIndex 本身不作判据，见上方注释）');

  /* c2 必须在**真实键盘交互之后**量：程序化 focus() 之前页面没有任何键盘输入，
     :focus-visible 按规范不匹配，宿主即使修好也量不到指示。
     所以留到下面 Tab 序列走完之后，用真实 Tab 落地的那个元素去量。 */

  /* (c3) 菜单可发现：键盘用户没有悬停，而 rowActions 是 display:none。
     先把指针移开并 blur，再走一遍真实 Tab 序列。 */
  await page.move(2, 2);
  await page.frame();
  await page.evaluate(() => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); });
  const order = [];
  for (let i = 0; i < 24; i += 1) {
    await page.key('Tab', 9);
    order.push(await page.evaluate((cls) => {
      const a = document.activeElement;
      if (a === null || a === document.body) return { tag: 'BODY', rowKey: null, inActions: false, label: '', focus: null };
      const row = a.closest('[data-row-key]');
      const act = a.closest('.' + CSS.escape(cls.R.rowActions));
      const s = getComputedStyle(a);
      return {
        tag: a.tagName,
        label: a.getAttribute('aria-label') || (a.textContent || '').trim().slice(0, 16),
        rowKey: row === null ? null : row.getAttribute('data-row-key'),
        inActions: act !== null,
        // c2 的判据：真实 Tab 落地元素的可见焦点指示。
        // 同时看元素自身与其最近聚焦容器（roving tabindex 下焦点在代理元素上，
        // 视觉指示可能由 :focus-within 画在行上，所以两处都量）。
        focus: { style: s.outlineStyle, width: s.outlineWidth, color: s.outlineColor, box: s.boxShadow },
        rowFocus: row === null ? null : (() => { const rs = getComputedStyle(row); return { style: rs.outlineStyle, width: rs.outlineWidth, box: rs.boxShadow }; })(),
      };
    }, { R }));
  }
  const reachedRow = order.some((r) => r.rowKey !== null && String(r.rowKey).startsWith('session:'));
  const reachedActions = order.some((r) => r.inActions === true);
  t.log('Tab 序列 ' + JSON.stringify(order.map((r) => r.tag + (r.rowKey ? '[' + r.rowKey + ']' : '') + (r.inActions ? '<actions>' : '') + (r.label ? ':' + r.label : ''))));

  /* c2 延后到这里量（见上方注释）：现在页面已经有过真实 Tab 交互，:focus-visible 会匹配。
     判据取「落地元素自身」与「其所在行」两者中任一有可见指示即可。 */
  const landed = order.filter((r) => r.rowKey !== null && String(r.rowKey).startsWith('session:')).pop() ?? null;
  const vis = (f) => f !== null && ((f.style !== 'none' && parseFloat(f.width) > 0) || (typeof f.box === 'string' && f.box !== 'none'));
  const focusVisible = landed !== null && (vis(landed.focus) || vis(landed.rowFocus));
  t.check('(c2) 键盘 Tab 落到会话行后有可见焦点指示',
    focusVisible,
    landed === null
      ? '24 步 Tab 内没有落到任何 session 行，无法判定焦点指示'
      : '真实 Tab 落地 → 元素 outline=' + landed.focus.style + ' ' + landed.focus.width
        + '、box-shadow=' + landed.focus.box.slice(0, 40) + '；所属行 outline=' + landed.rowFocus.style + ' ' + landed.rowFocus.width
        + '、box-shadow=' + landed.rowFocus.box.slice(0, 40));

  /* c3 拆成两条（原写法是 reachedRow || reachedActions 的「或」）。
     审查指出：提案要求的是「行可达」**且**「行内按钮可达」，缺一不可；
     用「或」判会在宿主只修行、不给 .rowActions 加 :focus-within 时假绿 ——
     菜单对键盘用户依然不可达，而判据却通过了。 */
  t.check('(c3a) Tab 能到达会话行',
    reachedRow,
    '24 步 Tab 内到达 session 行=' + reachedRow + '（逐元素：'
      + order.filter((r) => r.rowKey).map((r) => r.rowKey).join(',') + '）');
  t.check('(c3b) Tab 能到达行内操作按钮（菜单可发现）',
    reachedActions,
    '24 步 Tab 内到达 .rowActions 内的按钮=' + reachedActions
      + '；rowActions 仅 :hover/.menuOpen 露出且无 :focus-within，display:none 不在 Tab 序列'
      + '（修复：给 .rowActions 加 :focus-within，见 host-proposal-sidebar-keyboard）');

  await t.shot(page, 'sidebar-keyboard-verify.png', { x: 0, y: 0, width: 620, height: 830, scale: 2 });
}

export default { keyboard };