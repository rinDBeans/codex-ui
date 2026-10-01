import fs from 'node:fs';
import { join } from 'node:path';
import { cssFor, frontendCss, mapFor, themeLayers } from '../lib/host.mjs';
import { SKIN_DIR, SKIN_PARTS, scopeCss, stripComments } from '../build.mjs';

/**
 * 右栏面板的「容器 / 页头 / 空态 / 不可用态 / 滚动」—— 方案 §8 T11。
 *
 * 与既有的 rightbar.mjs 分工：那一支管**面板外沿**（阴影、发丝线、分界柄）与展开引导条目；
 * 本支管**面板内部的状态面**。两边都量同一份真实宿主 CSS，不重复断言。
 *
 * 两条被夹具坑过的教训（都写进断言里，防止后来者重犯）：
 *   1. 宿主 .panel 是 pointer-events:none，靠 dockkit 的 ._float_ / ._tabHost_ 把交互开回来。
 *      把展开按钮直接挂在 .panel 下会量到 pointer-events:none —— 那是夹具不忠实，不是宿主缺陷。
 *   2. 空态的外观来自 dockkit 的类（_emptyTabHost_ 底色 / _empty_ 文字），
 *      宿主从不按 [data-dockkit-empty] 写样式。只挂 data 属性会量到全透明。
 *
 * 纪律：类名运行时从真实 mapFor / dockkit 前端样式表取，缺键抛错；判据与**解析后的皮肤令牌值**比，
 * 不与「另一个元素」比（后者会因为两边都透明而空过）。
 */
const RIGHT_SRC = '@deepseek-ai/dsh-client-ui-sidebar-right/lib/client.js';
const PANELS_FILE = 'panels.css';
const SKIN_FILE = 'skin.css';

const NEED_P = ['panel', 'panelBody', 'tabBody', 'tabTitle', 'unavailable', 'iconButton', 'collapseGlyph'];

function needKeys(map, keys, name) {
  const missing = keys.filter((k) => map[k] === undefined);
  if (missing.length > 0) throw new Error(name + ' 缺类名（宿主映射已变）：' + missing.join(', '));
  return map;
}

function panelHost(host) {
  const right = host.file(RIGHT_SRC);
  const front = frontendCss(host);
  const hash = /\._tabCell_(\w+?)_\d+/.exec(front)?.[1];
  if (hash === undefined) throw new Error('前端样式表里找不到 dockkit 的 _tabCell_ 类名');
  const dockCss = [...front.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => m[1].includes('_' + hash + '_')).map((m) => m[0]).join('\n');
  const dock = (key) => {
    const m = new RegExp('\\._' + key + '_(\\w+-?)').exec(dockCss);
    if (m === null) throw new Error('dockkit 里没有类名 ' + key);
    return '_' + key + '_' + m[1];
  };
  return {
    css: '<style>' + themeLayers(host) + '</style>'
      + '<style>' + cssFor(right, '@deepseek-ai/dsh-client-ui-sidebar-right/SidebarRight.module.css') + '</style>'
      + '<style>' + dockCss + '</style>',
    P: needKeys(mapFor(right, 'SidebarRight_module_css_default'), NEED_P, 'SidebarRight'),
    D: Object.fromEntries(['tabCell', 'tabHost', 'tabHostHeader', 'tabHostBody', 'stripTabs', 'pane', 'float', 'emptyTabHost', 'empty']
      .map((k) => [k, dock(k)])),
  };
}

function skinTheme() {
  /* 走 build.mjs 的 SKIN_PARTS —— 与生产同一条加载路径（不自己拼绝对路径、不绕开主题层）。
     panels.css 尚未登记时（登记由集成方负责）按**推荐位置**插入：sidebar-surface.css 之后、
     window-shadow.css 之前；而不是简单追加到末尾 —— 否则夹具量到的层叠顺序与登记后的生产
     顺序不一致。实测本文件的规则只作用于 [data-sidebar-right-panel] 下的 scrollbar 属性，
     与其它 SKIN_PARTS 文件没有选择器重叠，故此处位置对结果是中性的；按推荐位插入是为了
     让夹具与生产**逐字同序**，而不是依赖这个中性结论。 */
  const parts = [...SKIN_PARTS];
  if (fs.existsSync(join(SKIN_DIR, PANELS_FILE)) && !parts.includes(PANELS_FILE)) {
    const at = parts.indexOf('window-shadow.css');
    parts.splice(at < 0 ? parts.length : at, 0, PANELS_FILE);
  }
  return parts.map((f) => scopeCss(stripComments(fs.readFileSync(join(SKIN_DIR, f), 'utf8')))).join('\n');
}

const svg = (size) => '<svg width="' + size + '" height="' + size + '" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 3h12v10H2z" fill="none" stroke="currentColor"/></svg>';

function buildPage(css, P, D, theme, withSkin) {
  const scope = withSkin ? ' data-codex-ui' : '';
  const skin = withSkin ? '<style>' + theme + '</style>' : '';
  const header = '<div class="' + D.tabHostHeader + '">'
    + '<div class="' + D.stripTabs + '"><span class="' + P.tabTitle + '" data-sidebar-right-tab="t1" data-sidebar-right-occurrence="o1">'
    + '这是一个故意很长的页签名用来验证裁切行为不会撑破页头与右栏</span></div>'
    + '<button type="button" class="' + P.iconButton + '" aria-label="全屏" data-sidebar-right-mode="fullscreen">' + svg(15) + '</button>'
    + '<button type="button" class="' + P.iconButton + '" aria-label="收起右栏" data-sidebar-right-toggle="true">' + svg(15) + '</button>'
    + '</div>';
  const filler = Array.from({ length: 60 }, (_, i) => '<div>line ' + i + '</div>').join('');
  const pane = '<section class="' + D.pane + '" data-dockkit-pane="p1" data-dockkit-pane-active="true">'
    + '<div class="' + D.tabHost + '">' + header
    + '<div class="' + D.tabHostBody + '" style="height:200px;overflow-y:auto"><div class="' + P.tabBody + '" data-sidebar-right-tab="t1">' + filler + '</div></div>'
    + '<p class="' + P.unavailable + '" data-sidebar-right-unavailable="true">此页签暂不可用</p>'
    + '</div></section>';
  const expandBtn = '<button type="button" class="' + P.iconButton + '" aria-label="展开右栏" data-sidebar-right-expand="true">' + svg(15) + '</button>';
  const empty = '<div class="' + D.emptyTabHost + '" data-dockkit-empty="true">'
    + '<div class="' + D.empty + '">右栏还没有打开任何页签</div></div>';
  const body = '<div class="' + P.panel + '" data-sidebar-right-panel="push" data-sidebar-right-open="true" '
    + 'data-sidebar-right-session="s1" style="width:420px;height:600px">'
    + '<div class="' + D.float + '" data-dockkit-float="f1">' + expandBtn + '</div>'
    + '<div class="' + D.tabCell + '" data-dockkit-host="dock" data-dockkit-column="0">' + pane + '</div>'
    + empty
    + '</div>';
  return '<!doctype html><html' + scope + ' data-platform="win32"><head><meta charset="utf-8">' + css + skin
    + '<style>body{margin:0;background:var(--dsw-alias-bg-base,#fff)}</style></head><body>' + body + '</body></html>';
}

function probe() {
  const q = (s) => document.querySelector(s);
  const cs = (el, p) => (el === null ? null : getComputedStyle(el, p));
  const box = (el) => { if (el === null) return null; const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; };
  const tok = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const emptyEl = q('[data-dockkit-empty]');
  const emptyText = emptyEl === null ? null : emptyEl.firstElementChild;
  const un = q('[data-sidebar-right-unavailable]');
  const expand = q('[data-sidebar-right-expand]');
  const toggle = q('[data-sidebar-right-toggle]');
  const title = q('[data-sidebar-right-tab]');
  const header = title === null ? null : title.closest('[class*="tabHostHeader"]');
  const scroller = q('[class*="tabHostBody"]');
  return {
    tokens: {
      bgBase: tok('--dsw-alias-bg-base'),
      labelTertiary: tok('--dsw-alias-label-tertiary'),
      labelSecondary: tok('--dsw-alias-label-secondary'),
    },
    empty: emptyEl === null ? null : { bg: cs(emptyEl).backgroundColor, textColor: emptyText === null ? null : cs(emptyText).color, box: box(emptyEl) },
    un: un === null ? null : { color: cs(un).color, display: cs(un).display, size: cs(un).fontSize },
    expand: expand === null ? null : { display: cs(expand).display, pe: cs(expand).pointerEvents, box: box(expand), color: cs(expand).color },
    toggle: toggle === null ? null : { display: cs(toggle).display, pe: cs(toggle).pointerEvents, box: box(toggle) },
    title: title === null ? null : { display: cs(title).display },
    header: header === null ? null : { sw: header.scrollWidth, cw: header.clientWidth },
    scroller: scroller === null ? null : { w: cs(scroller).scrollbarWidth, c: cs(scroller).scrollbarColor, ov: cs(scroller).overflowY },
  };
}

function staticRules() {
  const file = join(SKIN_DIR, PANELS_FILE);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, 'utf8');
  const css = stripComments(raw);
  const skinRaw = fs.readFileSync(join(SKIN_DIR, SKIN_FILE), 'utf8');
  const declared = new Set([...skinRaw.matchAll(/(--dsw-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  const used = [...new Set([...css.matchAll(/var\((--dsw-[a-z0-9-]+)/g)].map((m) => m[1]))];
  const undeclared = used.filter((t) => !declared.has(t));
  const hides = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim();
    const body = m[2];
    if (/display\s*:\s*none/.test(body) || /pointer-events\s*:\s*none/.test(body)) {
      if (/expand|toggle|iconButton/.test(sel)) hides.push(sel.slice(0, 70));
    }
  }
  /* 滚动条判据的**唯一事实来源**：panels.css 只用 ::-webkit-scrollbar 一条路径。
     实测（headless Chromium，量滚动条占位 offsetWidth−clientWidth）证明：只要出现非 auto 的
     scrollbar-color 或 scrollbar-width，Chromium 就让整条 ::-webkit-scrollbar 伪元素路径失效
     （::-webkit-scrollbar{display:none} 单用时 gutter=0，加上任一标准属性后回到 10/15）。
     所以「细」与「皮肤取色」都必须由伪元素承担，标准属性一条也不许写。
     这里对**去注释后的 CSS** 取实际声明 —— 本文件注释里大量提到这两个属性名，不能按文本匹配。 */
  const stdScrollbar = [...css.matchAll(/(?:^|[;{])\s*(scrollbar-color|scrollbar-width)\s*:\s*([^;}]*)/g)]
    .map((m) => (m[1] + ': ' + m[2].trim()).slice(0, 60));
  const thumbBlock = /::\-webkit-scrollbar-thumb\s*(?::hover)?\s*\{([^}]*)\}/.exec(css);
  const thumbToken = thumbBlock === null ? null : (/var\((--dsw-alias-scrollbar-[a-z0-9-]+)\)/.exec(thumbBlock[1]) || [])[1];
  const webkitBar = /::\-webkit-scrollbar\s*\{([^}]*)\}/.exec(css);
  const webkitWidth = webkitBar === null ? null : ((/width\s*:\s*([0-9.]+px)/.exec(webkitBar[1]) || [])[1] || null);
  return {
    declared: declared.size, used, undeclared, hides, bytes: raw.length,
    thumbToken,
    thumbUsesSkinToken: thumbToken !== null && declared.has(thumbToken),
    stdScrollbar,
    webkitWidth,
    universalSelectors: (css.match(/\] \*/g) || []).length,
  };
}

async function panels(t) {
  const { css, P, D } = panelHost(t.host);
  const theme = skinTheme();
  const page = await t.page({ width: 1280, height: 720, dpr: 1 });
  await page.setContent(buildPage(css, P, D, theme, false), 500);
  const host0 = await page.evaluate(probe);
  await page.setContent(buildPage(css, P, D, theme, true), 500);
  const sk = await page.evaluate(probe);
  t.log('无皮肤 ' + JSON.stringify(host0));
  t.log('有皮肤 ' + JSON.stringify(sk));
  if (host0 === null || sk === null) { t.check('夹具就绪：面板可定位', false, 'null'); return; }

  /* ── 1. 空态与面板同族 ────────────────────────────────────────────────
     判据绑**解析后的皮肤令牌值**，不与另一个元素比 —— 两边都透明时会空过（第一版就空过了）。 */
  const toRgb = (hex) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
    if (m === null) return hex;
    const n = parseInt(m[1], 16);
    return 'rgb(' + ((n >> 16) & 255) + ', ' + ((n >> 8) & 255) + ', ' + (n & 255) + ')';
  };
  t.check('空态底色 = 皮肤 bg-base（不是透出页面底）',
    sk.empty !== null && sk.empty.bg === toRgb(sk.tokens.bgBase),
    'empty=' + (sk.empty === null ? 'null' : sk.empty.bg) + ' 期望 bg-base=' + toRgb(sk.tokens.bgBase));
  t.check('空态文字 = 皮肤 label-tertiary（不是浏览器默认黑）',
    sk.empty !== null && sk.empty.textColor === toRgb(sk.tokens.labelTertiary),
    'text=' + (sk.empty === null ? 'null' : sk.empty.textColor) + ' 期望 tertiary=' + toRgb(sk.tokens.labelTertiary));

  /* ── 2. 不可用态 ──────────────────────────────────────────────────── */
  t.check('不可用态可见且有文字层级，颜色为皮肤 label-tertiary',
    sk.un !== null && sk.un.display !== 'none' && parseFloat(sk.un.size) >= 12 && sk.un.color === toRgb(sk.tokens.labelTertiary),
    sk.un === null ? 'null' : 'display=' + sk.un.display + ' size=' + sk.un.size + ' color=' + sk.un.color);

  /* ── 3. 交互控件不被样式破坏（只做样式的硬约束） ────────────────────── */
  t.check('展开按钮保持可达（未 display:none / 未禁用指针）',
    sk.expand !== null && sk.expand.display !== 'none' && sk.expand.pe !== 'none',
    sk.expand === null ? 'null' : 'display=' + sk.expand.display + ' pe=' + sk.expand.pe);
  t.check('收起按钮保持可达（未 display:none / 未禁用指针）',
    sk.toggle !== null && sk.toggle.display !== 'none' && sk.toggle.pe !== 'none',
    sk.toggle === null ? 'null' : 'display=' + sk.toggle.display + ' pe=' + sk.toggle.pe);
  t.check('展开按钮保持 28px 命中区',
    sk.expand !== null && sk.expand.box !== null && sk.expand.box.w === 28 && sk.expand.box.h === 28,
    JSON.stringify(sk.expand === null ? null : sk.expand.box));

  /* ── 4. 长页名不撑破页头 ──────────────────────────────────────────── */
  t.check('长页名不产生横向溢出（页头 scrollWidth ≤ clientWidth）',
    sk.header !== null && sk.header.sw <= sk.header.cw + 1,
    sk.header === null ? 'null' : 'header sw=' + sk.header.sw + ' cw=' + sk.header.cw);

  /* ── 5. 滚动区与皮肤同一套滚动条处理 ────────────────────────────────
     皮肤只在 [data-trigger-menu] / [data-menu-material] 上给了细滚动条（overlays.css ⑱）；
     右栏滚动区若吃浏览器默认，就会与同屏其他区域不一致。判据：细滚动条 + 用皮肤滚动条令牌上色。 */
  /* 判据为什么不在这一层判：本夹具启动时带 --hide-scrollbars（cdp.mjs:29），滚动条既不绘制
     也不占位，而「细」现由 ::-webkit-scrollbar{width:8px} 承担 —— 那条伪元素在本夹具里量不到。
     若在此断言 computed scrollbar-width === 'thin'，就会把「按决定不写标准属性」判成失败，
     等于用判据否决决定本身。所以这里只把实测值打出来备查，判分统一在下面那条静态断言。 */
  t.log('右栏滚动区 computed: scrollbar-width=' + (sk.scroller === null ? 'null' : sk.scroller.w)
    + ' scrollbar-color=' + (sk.scroller === null ? 'null' : sk.scroller.c)
    + '（按决定两者都应为 auto：panels.css 不写标准属性，细与取色由 ::-webkit-scrollbar 负责）');
  /* ── 6. panels.css 静态纪律 ───────────────────────────────────────── */
  const st = staticRules();
  t.check('panels.css 存在且被本次测量加载', st !== null, st === null ? '未找到 ' + PANELS_FILE : st.bytes + ' B');
  if (st === null) return;
  t.check('panels.css 只引用 skin.css 已声明的 --dsw-* 令牌',
    st.undeclared.length === 0,
    '引用 ' + st.used.length + ' 个令牌；未声明：' + (st.undeclared.length === 0 ? '（无）' : st.undeclared.join(' ')));
  t.check('panels.css 不隐藏/不禁用交互控件（只做样式）',
    st.hides.length === 0,
    st.hides.length === 0 ? '未命中 expand/toggle' : st.hides.join(' | '));
  /* ── 本 spec 关于滚动条的**唯一一条**断言 ─────────────────────────────
     事实：panels.css 只用 ::-webkit-scrollbar 一条路径，不写 scrollbar-color，也不写 scrollbar-width。
     判据直接读 CSS 里**实际存在**的声明（去注释之后），因此与文件内容同真同假：
       往 panels.css 加回任一标准属性      → 这条立刻变红；
       删掉 ::-webkit-scrollbar 的 width    → 这条变红；
       删掉 thumb 的皮肤令牌               → 这条变红。
     旧的「两条路径取色同源」已删除：按实测，两条路径不可能同时生效，
     它描述的是一个不存在的状态（详见 panels.css 顶部那段实测记录）。 */
  t.check('panels.css 只用 ::-webkit-scrollbar 一条路径（不写 scrollbar-color / scrollbar-width），width 与取色都在该路径上',
    st.stdScrollbar.length === 0 && st.webkitWidth !== null && st.thumbUsesSkinToken === true,
    st.stdScrollbar.length > 0
      ? '写了标准滚动条属性（会让整条伪元素路径失效）：' + st.stdScrollbar.join(' | ')
      : 'webkit width=' + st.webkitWidth + ' · thumb 取色=' + st.thumbToken + '（skin.css 已声明）');

  /* 静态纪律：不许出现后代通配符。本仓库被这类选择器咬过一次（docs/archive/pr3-64f4d60.patch：
     去掉「落在祖先位置、目标又是常见元素」的选择器后，真实流式基准 RecalcStyle 4264ms → 267ms，-94%）。
     右栏底下是文件树 / 终端 / 预览，节点数以千计且流式反复重建，通配符代价最高。 */
  t.check('panels.css 不使用后代通配符（性能：流式重建时避免全子树重配）',
    st.universalSelectors === 0,
    '通配符 ' + st.universalSelectors + ' 处');
  /* 判据收敛记录（防止再摆回去）：本文件历史上同时存在过两条**互斥**断言 ——
       A「两条路径取色同源」      要求 scrollbar-color 存在且与 thumb 同令牌；
       B「不写继承的 scrollbar-color」要求它不存在。
     同一份 panels.css 不可能同时满足，通过与否取决于哪条先被读到。现已收敛为**上面唯一一条**：
     既断言标准属性一条不写，又断言伪元素路径确实带着 width 与皮肤令牌。
     以后换决定只改那一条，不要再新增第二条滚动条断言。 */


  await t.shot(page, 'panels-verify.png', { x: 0, y: 0, width: 900, height: 640, scale: 2 });
}

export default { panels };