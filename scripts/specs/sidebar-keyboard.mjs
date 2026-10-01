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

  t.check('(c1) 会话行可被键盘聚焦（tabIndex ≥ 0）',
    focusProbe.tabIndex >= 0,
    'div[data-row-key="session:normal"][role=treeitem] → tabIndex=' + focusProbe.tabIndex + '（tabindex 属性存在=' + focusProbe.hasTabIndexAttr + '）');
  t.check('(c2) 聚焦后行有可见焦点指示',
    focusProbe.moved && focusProbe.outlineStyle !== 'none' && parseFloat(focusProbe.outlineWidth) > 0,
    'div[data-row-key="session:normal"]:focus-visible → moved=' + focusProbe.moved + ' outline=' + focusProbe.outlineStyle + ' ' + focusProbe.outlineWidth + ' ' + focusProbe.outlineColor);

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
      if (a === null || a === document.body) return { tag: 'BODY', rowKey: null, inActions: false, label: '' };
      const row = a.closest('[data-row-key]');
      const act = a.closest('.' + CSS.escape(cls.R.rowActions));
      return {
        tag: a.tagName,
        label: a.getAttribute('aria-label') || (a.textContent || '').trim().slice(0, 16),
        rowKey: row === null ? null : row.getAttribute('data-row-key'),
        inActions: act !== null,
      };
    }, { R }));
  }
  const reachedRow = order.some((r) => r.rowKey !== null && String(r.rowKey).startsWith('session:'));
  const reachedActions = order.some((r) => r.inActions === true);
  t.log('Tab 序列 ' + JSON.stringify(order.map((r) => r.tag + (r.rowKey ? '[' + r.rowKey + ']' : '') + (r.inActions ? '<actions>' : '') + (r.label ? ':' + r.label : ''))));
  t.check('(c3) Tab 能到达会话行或行内操作按钮（T09「菜单可发现」）',
    reachedRow || reachedActions,
    'Tab 24 步内到达 session 行=' + reachedRow + '、到达行内操作按钮=' + reachedActions);

  await t.shot(page, 'sidebar-keyboard-verify.png', { x: 0, y: 0, width: 620, height: 830, scale: 2 });
}

export default { keyboard };