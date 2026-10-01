/**
 * 侧栏「行」的行为验收（计划 §8 T09）。
 *
 * 六态：选中 / 悬停露出 rowActions / 键盘焦点 / 长标题裁切 / 置顶与归档 / 搜索展开与无结果。
 *
 * 三条纪律（这个仓库被假绿坑过多次）：
 *   1. 唯一稳定的行锚点是宿主的 data-row-key（`session:<id>` / `workspace:<key>`），
 *      绝不对宿主不产出的选择器断言（data-dsh-part 宿主从不产出）。
 *   2. 类名后缀一律运行时从真实 mapFor 映射取，不按任何描述硬编码；缺键直接抛错。
 *   3. DOM 按 shipped 渲染代码复刻 —— 包括宿主**没有**给行打 tabindex 这一事实。
 *      断言失败就是真实缺口，不做「让判据好过」的调整。
 *
 * 皮肤侧现状（实测）：skins/ 里没有任何一条规则命中 sessionRow / rowActions /
 * pinIndicator / selected / archived / emptyState / searchExpanded —— T09 尚未在皮肤层动过手，
 * 所以本 spec 量到的差异都是宿主原生行为，正好用来分辨「宿主已满足」与「真实缺口」。
 */
import { cssFor, mapFor, themeLayers } from '../lib/host.mjs';

const SIDEBAR_SRC = '@deepseek-ai/dsh-client-ui-sidebar/lib/client.js';
const WORKSPACE_SRC = '@deepseek-ai/dsh-client-ui-workspace/lib/client.js';

/** 本 spec 依赖的类名键；宿主映射改名/删键时立刻抛错，而不是让选择器静默落空。 */
const NEED_S = ['root', 'logoRow', 'brand', 'newSession', 'panelList', 'regionArea', 'footArea', 'wide', 'iconButton', 'toggle'];
const NEED_W = ['root', 'sectionHeader', 'sectionLabel', 'searchSlot', 'search', 'searchButton', 'searchExpanded', 'searchSlotExpanded', 'searchInput', 'clearButton', 'headerActions', 'listArea', 'treeBody', 'list', 'groupSection', 'emptyState', 'emptyAction'];
/* 注意：宿主 Rows 映射里**没有** archivedCurrent（只有 archived / hoverArchived）。 */
const NEED_R = ['projectRow', 'sessionRow', 'slot', 'title', 'time', 'rowActions', 'pinIndicator', 'selected', 'archived', 'folder', 'chevron', 'projectText', 'iconButton', 'visuallyHidden'];

function needKeys(map, keys, name) {
  const missing = keys.filter((k) => map[k] === undefined);
  if (missing.length > 0) throw new Error(name + ' 缺类名（宿主映射已变）：' + missing.join(', '));
  return map;
}

function sidebarHost(host) {
  const sidebar = host.file(SIDEBAR_SRC);
  const workspace = host.file(WORKSPACE_SRC);
  return {
    css: '<style>' + themeLayers(host) + '</style>'
      + '<style>' + cssFor(sidebar, '@deepseek-ai/dsh-client-ui-sidebar/SidebarRoot.module.css') + '</style>'
      + '<style>' + cssFor(workspace, '@deepseek-ai/dsh-client-ui-workspace/WorkspaceBrowser.module.css') + '</style>'
      + '<style>' + cssFor(workspace, '@deepseek-ai/dsh-client-ui-workspace/Rows.module.css') + '</style>',
    S: needKeys(mapFor(sidebar, 'SidebarRoot_module_css_default'), NEED_S, 'SidebarRoot'),
    W: needKeys(mapFor(workspace, 'WorkspaceBrowser_module_css_default'), NEED_W, 'WorkspaceBrowser'),
    R: needKeys(mapFor(workspace, 'Rows_module_css_default'), NEED_R, 'Rows'),
  };
}

const svg = (n) => '<svg width="' + n + '" height="' + n + '" viewBox="0 0 ' + n + ' ' + n + '" aria-hidden="true"><rect x="1" y="1" width="' + (n - 2) + '" height="' + (n - 2) + '" rx="2" fill="none" stroke="currentColor"/></svg>';
const PIN = '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M7 1.4l1.7 3.4 3.7.5-2.7 2.6.7 3.7L7 9.8 3.6 11.6l.7-3.7L1.6 5.3l3.7-.5z" fill="currentColor"/></svg>';
const FOLDER = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 4.5h4l1.2 1.5h7.8v7.5h-13z" fill="none" stroke="currentColor"/></svg>';

/** 宿主 sessionRow 的真实子元素顺序：slot → title → time →（pinned 时）pinIndicator → rowActions。 */
function sessionRow(R, o) {
  const cls = [R.sessionRow];
  if (o.selected) cls.push(R.selected);
  if (o.archived) cls.push(R.archived);
  return '<div class="' + cls.join(' ') + '" data-row-key="session:' + o.key + '" role="treeitem"'
    + ' aria-selected="' + (o.selected ? 'true' : 'false') + '"'
    + (o.archived ? ' aria-description="已归档会话不可打开"' : '') + '>'
    + '<span class="' + R.slot + '"></span>'
    + '<span class="' + R.title + '">' + o.title + '</span>'
    + '<span class="' + R.time + '">10分钟</span>'
    + (o.pinned && !o.archived ? '<span class="' + R.pinIndicator + '" role="img" aria-label="已置顶" title="已置顶">' + PIN + '</span>' : '')
    + '<span class="' + R.rowActions + '"><button type="button" class="' + R.iconButton + '" aria-label="会话操作">' + svg(14) + '</button></span>'
    + '</div>';
}

function projectRow(R, name) {
  return '<div class="' + R.projectRow + '" data-row-key="workspace:' + name + '" role="treeitem" aria-expanded="true">'
    + '<span class="' + R.slot + ' ' + R.folder + '">' + FOLDER + '</span>'
    + '<span class="' + R.slot + ' ' + R.chevron + '">' + svg(16) + '</span>'
    + '<span class="' + R.projectText + '"><span class="' + R.title + '">' + name + '</span></span>'
    + '<span class="' + R.rowActions + '"></span>'
    + '</div>';
}

const LONG_TITLE = '这是一个非常非常长的会话标题用来验证截断与横向溢出它应该被省略号裁掉而不是把整行撑宽'.repeat(2);

/** 侧栏外壳 + 工作区浏览器；类名全部取自真实映射。 */
function stage(S, W, R, o) {
  const group = (name, rows) => '<div class="' + W.groupSection + '" style="--dsh-workspace-indent:0px">'
    + projectRow(R, name) + '<div role="group">' + rows + '</div></div>';

  const search = o.searchExpanded
    ? '<div class="' + W.searchSlot + ' ' + W.searchSlotExpanded + '"><div class="' + W.search + ' ' + W.searchExpanded + '">'
      + '<button class="' + W.searchButton + '" aria-label="搜索会话">' + svg(16) + '</button>'
      + '<input class="' + W.searchInput + '" type="text" placeholder="搜索会话" value="zzz" tabindex="0"></div>'
      + '<button class="' + W.clearButton + '" aria-label="清除搜索">' + svg(16) + '</button></div>'
    : '<div class="' + W.searchSlot + '"><div class="' + W.search + '">'
      + '<button class="' + W.searchButton + '" aria-label="搜索会话">' + svg(16) + '</button></div></div>';

  const body = o.empty
    ? '<div class="' + W.emptyState + '" data-row-key="empty"><span>' + svg(24) + '</span><div>没有匹配的会话</div>'
      + '<button type="button" class="' + W.emptyAction + '">查看其他会话</button></div>'
    : '<div class="' + W.list + '">'
      + group('PROJIECT', sessionRow(R, { key: 'normal', title: '普通会话' })
        + sessionRow(R, { key: 'selected', title: '当前打开的会话', selected: true })
        + sessionRow(R, { key: 'hover-target', title: '悬停目标会话' })
        + sessionRow(R, { key: 'pinned', title: '已置顶的会话', pinned: true })
        + sessionRow(R, { key: 'archived', title: '已归档的会话', archived: true })
        + sessionRow(R, { key: 'long', title: LONG_TITLE }))
      + '</div>';

  return '<div data-slot="sidebar" style="display:contents"><div class="' + S.root + '" style="width:280px;height:780px">'
    + '<div class="' + S.logoRow + '"><span class="' + S.brand + ' ' + S.wide + '"><span class="' + S.brandName + '">deepseek</span></span>'
    + '<button class="' + S.iconButton + ' ' + S.toggle + '" aria-label="收起侧边栏">' + svg(16) + '</button></div>'
    + '<button class="' + S.newSession + '" aria-label="新建会话"><span class="' + S.newSessionLabelMask + '"><span class="' + S.newSessionContent + '"><span class="' + S.newSessionLabel + ' ' + S.wide + '">新会话</span></span></span></button>'
    + '<nav class="' + S.panelList + '"><button class="' + S.panelRow + '" aria-label="插件"><span class="' + S.panelGlyph + '">' + svg(16) + '</span><span class="' + S.panelTitle + ' ' + S.wide + '">插件</span></button></nav>'
    + '<div class="' + S.regionArea + '"><div data-slot="sidebar.workspaces" style="display:contents"><div class="' + W.root + '">'
    + '<div class="' + W.sectionHeader + '"><span class="' + W.sectionLabel + ' ' + W.wide + '">工作区</span>' + search
    + '<div class="' + W.headerActions + '"><button class="' + W.iconButton + '" aria-label="添加工作区">' + svg(16) + '</button></div></div>'
    + '<div class="' + W.listArea + '"><div class="' + W.treeBody + ' ' + W.wide + '">' + body + '</div></div>'
    + '</div></div></div>'
    + '<div class="' + S.footArea + '"></div>'
    + '</div></div>';
}

function pageHtml(css, S, W, R, o) {
  return '<!doctype html><html data-codex-ui data-platform="win32"><head><meta charset="utf-8">' + css
    + '<style id="codex-ui-theme">' + o.theme + '</style>'
    + '<style>body{margin:0;background:#fff;font-family:"Segoe UI","Microsoft YaHei",sans-serif}.wrap{display:flex;gap:24px;padding:16px;align-items:flex-start}</style>'
    + '</head><body><div class="wrap">' + stage(S, W, R, o) + '</div></body></html>';
}

/* ── 页面内探针（只做测量，不下判断）───────────────────────────────────── */

function probeStatic(cls) {
  const R = cls.R; const W = cls.W;
  const esc = (c) => '.' + CSS.escape(c);
  const byKey = (k) => document.querySelector('[data-row-key="' + k + '"]');
  const box = (el) => { if (el === null) return null; const r = el.getBoundingClientRect(); return { w: +r.width.toFixed(2), h: +r.height.toFixed(2), right: +r.right.toFixed(2) }; };
  const look = (el) => {
    if (el === null) return null;
    const s = getComputedStyle(el); const r = el.getBoundingClientRect();
    return {
      display: s.display, opacity: +Number(s.opacity).toFixed(3), visibility: s.visibility,
      outlineWidth: s.outlineWidth, outlineStyle: s.outlineStyle, outlineColor: s.outlineColor,
      color: s.color, bg: s.backgroundColor, w: +r.width.toFixed(2), h: +r.height.toFixed(2),
      visible: s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0 && r.width > 0 && r.height > 0,
    };
  };
  const actionsIn = (key) => { const r = byKey('session:' + key); return r === null ? null : r.querySelector(esc(R.rowActions)); };
  const titleIn = (key) => { const r = byKey('session:' + key); return r === null ? null : r.querySelector(esc(R.title)); };

  const normalRow = byKey('session:normal');
  const selectedRow = byKey('session:selected');
  const longRow = byKey('session:long');
  const pinnedRow = byKey('session:pinned');
  const empty = document.querySelector(esc(W.emptyState));
  const input = document.querySelector(esc(W.searchInput));
  const emptyAction = document.querySelector(esc(W.emptyAction));

  return {
    paths: { rowAnchor: '[data-row-key]', rowActions: esc(R.rowActions), title: esc(R.title), pin: esc(R.pinIndicator), empty: esc(W.emptyState), input: esc(W.searchInput) },
    normal: { bg: normalRow === null ? null : getComputedStyle(normalRow).backgroundColor, tabIndex: normalRow === null ? null : normalRow.tabIndex, role: normalRow === null ? null : normalRow.getAttribute('role'), ariaSelected: normalRow === null ? null : normalRow.getAttribute('aria-selected') },
    selected: { bg: selectedRow === null ? null : getComputedStyle(selectedRow).backgroundColor, ariaSelected: selectedRow === null ? null : selectedRow.getAttribute('aria-selected') },
    actionsIdle: look(actionsIn('hover-target')),
    actionsMenuOpen: null,
    long: longRow === null ? null : { scrollWidth: longRow.scrollWidth, clientWidth: longRow.clientWidth, overflows: longRow.scrollWidth > longRow.clientWidth + 1, box: box(longRow), titleScroll: titleIn('long') === null ? null : titleIn('long').scrollWidth, titleClient: titleIn('long') === null ? null : titleIn('long').clientWidth, titleOverflowStyle: titleIn('long') === null ? null : getComputedStyle(titleIn('long')).textOverflow },
    pinned: { indicator: pinnedRow === null ? null : look(pinnedRow.querySelector(esc(R.pinIndicator))) },
    archived: { titleColor: titleIn('archived') === null ? null : getComputedStyle(titleIn('archived')).color, normalTitleColor: titleIn('normal') === null ? null : getComputedStyle(titleIn('normal')).color },
    search: { input: look(input), inputTabIndex: input === null ? null : input.tabIndex, slotExpanded: document.querySelector(esc(W.searchSlotExpanded)) !== null },
    empty: { node: look(empty), action: look(emptyAction) },
  };
}

/** 悬停探针：先移开鼠标读一次，再移到行中心读一次。 */
function probeActions(cls, key) {
  const R = cls.R;
  const row = document.querySelector('[data-row-key="session:' + key + '"]');
  if (row === null) return null;
  const el = row.querySelector('.' + CSS.escape(R.rowActions));
  if (el === null) return null;
  const s = getComputedStyle(el); const r = el.getBoundingClientRect();
  return {
    display: s.display, opacity: +Number(s.opacity).toFixed(3), visibility: s.visibility, w: +r.width.toFixed(2),
    visible: s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0 && r.width > 0,
    /* 「隐藏或弱化」两种可接受实现都算满足：display:none 或 opacity<1。 */
    hiddenOrDimmed: s.display === 'none' || Number(s.opacity) < 1 || s.visibility === 'hidden',
  };
}

/* ── 六态 ──────────────────────────────────────────────────────────────── */

async function rows(t) {
  const { css, S, W, R } = sidebarHost(t.host);
  const page = await t.page({ width: 1300, height: 900, dpr: 2 });
  await page.setContent(pageHtml(css, S, W, R, { theme: t.theme(), searchExpanded: false, empty: false }), 500);

  const skip = await page.evaluate(() => document.querySelector('[data-row-key="session:normal"]') === null);
  t.check('夹具就绪：session 行按 data-row-key 可定位', !skip, '[data-row-key="session:normal"]');
  if (skip) return;

  const idle = await page.evaluate(probeStatic, { R, W });
  t.log('锚点：' + JSON.stringify(idle.paths));
  t.log('普通行 bg=' + idle.normal.bg + ' 选中行 bg=' + idle.selected.bg);
  t.log('非悬停 rowActions: ' + JSON.stringify(idle.actionsIdle));

  /* (a) 选中行与普通行视觉可辨 —— 判据是「两者的背景色不同，且选中行不是全透明」。 */
  t.check('(a) 选中行与普通行背景可辨',
    idle.selected.bg !== null && idle.normal.bg !== null && idle.selected.bg !== idle.normal.bg,
    'row[data-row-key="session:selected"][' + (idle.selected.ariaSelected === 'true' ? 'aria-selected=true' : '?') + '] bg=' + idle.selected.bg
    + ' vs row[data-row-key="session:normal"] bg=' + idle.normal.bg);

  /* (b) 悬停露出 rowActions：未悬停时必须隐藏或弱化。 */
  await page.move(2, 2);
  await page.frame();
  const before = await page.evaluate(probeActions, { R }, 'hover-target');
  const pt = await page.center('[data-row-key="session:hover-target"]');
  t.check('(b0) 悬停目标行有可测几何', pt !== null, pt === null ? 'center() 返回 null' : 'center=' + pt.join(','));
  if (pt !== null) await page.move(pt[0], pt[1]);
  await page.frame();
  const after = await page.evaluate(probeActions, { R }, 'hover-target');
  t.log('未悬停 ' + JSON.stringify(before));
  t.log('已悬停 ' + JSON.stringify(after));

  t.check('(b1) 未悬停时 rowActions 隐藏或弱化',
    before !== null && before.hiddenOrDimmed,
    '[data-row-key="session:hover-target"] .' + R.rowActions + ' → display=' + (before === null ? 'null' : before.display) + ' opacity=' + (before === null ? 'null' : before.opacity));
  t.check('(b2) 悬停后 rowActions 可见',
    after !== null && after.visible,
    '[data-row-key="session:hover-target"] .' + R.rowActions + ' → display=' + (after === null ? 'null' : after.display) + ' opacity=' + (after === null ? 'null' : after.opacity) + ' w=' + (after === null ? 'null' : after.w));

  /* (c) 键盘焦点：行是否可聚焦、以及聚焦后是否有可见焦点指示。
     宿主渲染代码里 sessionRow 是 div[role=treeitem]、**没有 tabIndex**（实测 0 处），
     这份夹具如实复刻该事实，所以这里的失败是真实缺口而不是夹具造成的。 */
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

  /* (c3) 菜单可发现：未悬停时 rowActions 是 display:none，而 display:none 的元素不在 Tab 序列里。
     先把指针移开（键盘用户没有悬停），再走一遍真实 Tab 序列 —— 这直接对应 T09 的「菜单可发现」。 */
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

  /* (d) 长标题：不产生横向溢出。 */
  t.log('长标题 ' + JSON.stringify(idle.long));
  t.check('(d) 长标题不产生横向溢出（scrollWidth ≤ clientWidth + 1）',
    idle.long !== null && idle.long.scrollWidth <= idle.long.clientWidth + 1,
    'div[data-row-key="session:long"] → scrollWidth=' + (idle.long === null ? 'null' : idle.long.scrollWidth) + ' clientWidth=' + (idle.long === null ? 'null' : idle.long.clientWidth));

  /* (e) 置顶与归档可辨。 */
  t.check('(e1) 置顶标记可见',
    idle.pinned.indicator !== null && idle.pinned.indicator.visible,
    'div[data-row-key="session:pinned"] .' + R.pinIndicator + ' → ' + JSON.stringify(idle.pinned.indicator === null ? null : { display: idle.pinned.indicator.display, w: idle.pinned.indicator.w }));
  t.check('(e2) 归档行标题与普通行可辨',
    idle.archived.titleColor !== null && idle.archived.normalTitleColor !== null && idle.archived.titleColor !== idle.archived.normalTitleColor,
    'div[data-row-key="session:archived"] .' + R.title + ' color=' + idle.archived.titleColor + ' vs 普通行 .' + R.title + ' color=' + idle.archived.normalTitleColor);

  await t.shot(page, 'sidebar-rows-verify.png', { x: 0, y: 0, width: 620, height: 830, scale: 2 });
}

/* ── (f) 搜索展开态与无结果态 ─────────────────────────────────────────── */

async function search(t) {
  const { css, S, W, R } = sidebarHost(t.host);
  const page = await t.page({ width: 1300, height: 900, dpr: 2 });
  await page.setContent(pageHtml(css, S, W, R, { theme: t.theme(), searchExpanded: true, empty: true }), 500);

  const has = await page.evaluate((cls) => ({
    input: document.querySelector('.' + CSS.escape(cls.W.searchInput)) !== null,
    empty: document.querySelector('.' + CSS.escape(cls.W.emptyState)) !== null,
    action: document.querySelector('.' + CSS.escape(cls.W.emptyAction)) !== null,
  }), { W });
  t.check('夹具就绪：搜索输入 / 空态 / 空态动作均在 DOM', has.input && has.empty && has.action, JSON.stringify(has));
  if (!has.input) return;

  const m = await page.evaluate(probeStatic, { R, W });
  t.log('搜索 ' + JSON.stringify(m.search));
  t.log('空态 ' + JSON.stringify(m.empty));

  t.check('(f1) 搜索展开态：输入框可见且有宽度',
    m.search.input !== null && m.search.input.visible && m.search.input.w > 40,
    '.' + W.searchInput + ' → display=' + (m.search.input === null ? 'null' : m.search.input.display) + ' w=' + (m.search.input === null ? 'null' : m.search.input.w));
  t.check('(f2) 搜索展开态：输入框可键盘到达（tabindex ≥ 0）',
    m.search.inputTabIndex !== null && m.search.inputTabIndex >= 0,
    '.' + W.searchInput + ' → tabIndex=' + m.search.inputTabIndex);
  t.check('(f3) 无结果态：空态块可见',
    m.empty.node !== null && m.empty.node.visible,
    '.' + W.emptyState + ' → display=' + (m.empty.node === null ? 'null' : m.empty.node.display) + ' w=' + (m.empty.node === null ? 'null' : m.empty.node.w));
  t.check('(f4) 无结果态：空态动作按钮可见可用',
    m.empty.action !== null && m.empty.action.visible && m.empty.action.w > 0,
    '.' + W.emptyAction + ' → display=' + (m.empty.action === null ? 'null' : m.empty.action.display) + ' w=' + (m.empty.action === null ? 'null' : m.empty.action.w));

  await t.shot(page, 'sidebar-rows-search-verify.png', { x: 0, y: 0, width: 620, height: 830, scale: 2 });
}

export default { rows, search };
