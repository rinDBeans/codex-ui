/**
 * 输入区：⑱ 输入卡阴影（composer-shadow）与 ⑬·3 顶栏瘦身 + ⑭ hero + ⑰ 底部控件（hero）。
 * 宿主样式取 dsh-client-ui-conversation 的 ConversationRoot / InputBar 与 agent-preset 的 AgentPresetLabel。
 */
import { cssFor, mapFor } from '../lib/host.mjs';

const CONVERSATION = '@deepseek-ai/dsh-client-ui-conversation/lib/client.js';

/** 会话区与输入栏的宿主样式及类名映射。 */
function conversation(host) {
  const src = host.file(CONVERSATION);
  return {
    css: '<style>' + cssFor(src, '@deepseek-ai/dsh-client-ui-conversation/ConversationRoot.module.css') + '</style>'
      + '<style>' + cssFor(src, '@deepseek-ai/dsh-client-ui-conversation/InputBar.module.css') + '</style>',
    R: mapFor(src, 'ConversationRoot_module_css_default'),
    B: mapFor(src, 'InputBar_module_css_default'),
  };
}

/* ── ⑱ 输入卡阴影 ───────────────────────────────────────────────────────
   判据来源：Codex 桌面端 26.924.2738.0 的 resources/app.asar @67930943 逐字：
     --elevation-composer:      0 0 0 1px #0000000a, 0 2px 8px 0 #0000000a, 0 4px 80px 8px #00000006;
     --elevation-composer-dark: inset 0 0 1px 0 #fff3
     @media (width<40rem) 时远场 80px → 40px
   量四件事：① 亮色三层的几何与 alpha；② 暗色单层 inset 高光、卡外零投影；③ 窄屏远场 40px；
   ④ 真实渲染像素：亮色衰减半径够长（远场真的画出来了）、暗色卡内顶边确实被点亮。 */

/** 深色令牌声明在 body[data-ds-dark-theme] 上（不是 :root），取令牌以 body 为先、html 兜底。 */
function probeCard() {
  const b = getComputedStyle(document.body);
  const h = getComputedStyle(document.documentElement);
  const tok = (n) => b.getPropertyValue(n).trim() || h.getPropertyValue(n).trim();
  const card = document.querySelector('[data-composer-card]');
  const cs = getComputedStyle(card);
  const r = card.getBoundingClientRect();
  return {
    shadow: cs.boxShadow,
    bg: cs.backgroundColor,
    varShadow: getComputedStyle(document.querySelector('[data-conversation-scroll]')).getPropertyValue('--dcu-composer-shadow').trim(),
    canvasBase: tok('--dsw-alias-bg-base'),
    surface: tok('--dsw-composer-surface'),
    dark: document.body.hasAttribute('data-ds-dark-theme'),
    rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
  };
}

/** 把计算值拆成层：inset 标记、长度、alpha。 */
const parseLayers = (s) => s.split(/,(?![^(]*\))/).map((x) => x.trim()).filter(Boolean).map((raw) => {
  const col = raw.match(/rgba?\([^)]*\)/);
  const parts = col === null ? [] : col[0].replace(/^rgba?\(|\)$/g, '').split(',');
  return {
    raw,
    inset: /(^|\s)inset(\s|$)/.test(raw),
    nums: [...raw.matchAll(/(-?\d+(?:\.\d+)?)px/g)].map((m) => parseFloat(m[1])).join(' '),
    alpha: col === null ? null : parts.length === 4 ? parseFloat(parts[3]) : 1,
  };
});
const near = (a, b, tol = 0.006) => Math.abs(a - b) <= tol;
/** 计算色 → 0..255 通道值：color-mix 算成 color(srgb r g b)（0..1），字面量是 rgb(r, g, b)，两种都认。 */
const chan = (c) => {
  const m = String(c).match(/color\(srgb\s+([\d.]+)/);
  if (m) return parseFloat(m[1]) * 255;
  const r = String(c).match(/rgba?\(\s*([\d.]+)/);
  return r ? parseFloat(r[1]) : NaN;
};

async function composerShadow(t) {
  const DSF = 2;
  const { css, R, B } = conversation(t.host);
  const page = await t.page({ width: 1100, height: 700, dpr: DSF });
  /* 舞台底色不写死：交给皮肤自己的令牌，夹具只断言令牌值本身（写死会让画布色失配静默通过）。
     留白放在滚动容器里面：宿主的 .scrollBody 是 overflow-y:auto，真 GUI 里卡片四周都还是滚动区，
     留白放在外面，远场阴影会被滚动容器裁掉（旧夹具只读到了半截宿主样式，才没碰上这一点）。 */
  await page.setContent(`<!doctype html><html data-codex-ui><head><meta charset="utf-8">${css}<style>${t.theme()}</style>
<style>body{margin:0;font:14px/1.5 "Segoe UI","Microsoft YaHei",sans-serif;background:var(--dsw-alias-bg-base)}</style></head><body>
<div class="${R.scrollBody}" data-conversation-scroll style="--dsh-chat-content-width:768px;padding:80px 0 90px">
<div class="${B.root}"><div class="${B.card}" data-composer-card="true"><div class="${B.scroll}" data-input-scroll="true"><div class="${B.grow}">
<div class="${B.input}" data-lexical-editor="true" contenteditable="true"></div>
</div></div></div></div></div></body></html>`, 1200);

  /** 截一张图，返回「某设备像素的 RGB 均值」。 */
  const grab = async () => {
    const img = await page.pixels();
    return (x, y) => { const [r, g, b] = img.rgb(Math.round(x), Math.round(y)); return (r + g + b) / 3; };
  };
  /** 卡片上沿往上 cssPx 的竖直扫描线：每个设备像素一格，相对页面底色的偏离。 */
  const scanAbove = (px, rect, cssPx) => {
    const x = Math.round((rect.x + rect.w / 2) * DSF);
    const yTop = Math.round(rect.y * DSF);
    const base = px(x, 4);
    const prof = [];
    for (let d = 0; d < cssPx * DSF && yTop - d >= 0; d += 1) prof.push([d / DSF, base - px(x, yTop - d)]);
    return prof;
  };

  /* ① 亮色 */
  const light = await page.evaluate(probeCard);
  const L = parseLayers(light.shadow);
  t.log('LIGHT var ' + light.varShadow + ' | calc ' + light.shadow);
  t.check('亮色画布 = #ffffff', light.canvasBase.toLowerCase() === '#ffffff', light.canvasBase);
  /* 亮色卡与页面同色：Codex 亮色靠阴影分层，不靠填充。0.5.7 及以前亮色也叠 5% 墨 = #f4f4f4，比 Codex 暗 11 级。 */
  t.check('亮色输入卡 = #ffffff（与页面同色，不叠罩）', light.bg === 'rgb(255, 255, 255)', light.bg);
  t.check('亮色输入卡 ≠ #f4f4f4（旧值，暗 11 级）', light.bg !== 'rgb(244, 244, 244)', light.bg);
  /* 0.6.3 起按**实测像素**拟合，不再照抄源码 token：环 1 个设备像素（= 0.5 CSS px），近场 0 2px 12px @9%，
     远场 80px 在参考图里量不到，已去掉。判据与拟合过程见 CHANGELOG 0.6.3。 */
  t.check('亮色阴影为两层（环 + 近场；0.6.3 起无 80px 远场）', L.length === 2, L.length + ' 层');
  t.check('亮色两层皆非 inset', L.every((l) => !l.inset), L.map((l) => l.inset).join(','));
  /* 环取 10%（Codex --color-border = --alpha-10），不是源码路径 A 的 3.9%、也不是 0.5.8 的 12%：
     同图内比较与标定渲染两法都指向 ~10.4%。见 composer.css 头注。 */
  t.check('层1 环 = 0 0 0 0.5px @10%（DPR 2 下 1 个设备像素，= Codex 参考图实测）', L[0] !== undefined && !L[0].inset && L[0].nums === '0 0 0 0.5' && near(L[0].alpha, 0.1, 0.015), L[0]?.raw);
  t.check('层2 近场 = 0 2px 12px 0 @9%（拟合 Codex 实测衰减）', L[1] !== undefined && L[1].nums === '0 2 12 0' && near(L[1].alpha, 0.09, 0.01), L[1]?.raw);
  /* 渲染边缘：Codex 参考图与用户截图都落在 220~234；旧值 4% 渲出 241（偏亮）。 */
  const lightPx = await grab();
  const { rect } = light;
  let edge = 255;
  for (let d = 1; d <= 6; d += 1) edge = Math.min(edge, lightPx(Math.round(rect.x * DSF) - d, Math.round((rect.y + rect.h / 2) * DSF)));
  edge = Math.round(edge);
  t.check('亮色卡边缘落在 Codex 实测带内（210~234）', edge >= 210 && edge <= 234, String(edge));
  const lightScan = scanAbove(lightPx, rect, 60);
  const extent = lightScan.filter(([, v]) => v >= 1).map(([d]) => d).pop() ?? 0;
  /* 1px 处量到的其实是环本身（Codex 实测环像素 220，偏离 35），环的判据交给上面的边缘带断言，这里只留信息。 */
  t.log('LIGHT 1px 处（即环像素）偏离 ' + (lightScan.find(([d]) => d === 1)?.[1] ?? 0).toFixed(1) + '，衰减半径 ' + extent + 'px');
  /* 0.6.3：判据从「衰减半径 ≥ 35px」改成「落进 Codex 参考图实测带」。旧口径奖励长尾巴，
     而参考图（DPR 2）里卡下沿 24 个设备像素（= 12 CSS px）就归零了 —— 长尾巴正是要修的东西。
     这里量的是卡**上沿**，近场 0 2px 12px 向下偏 2px，上沿比下沿短一档，带宽取 3~13 CSS px。 */
  t.check('亮色卡上沿衰减半径落在 Codex 实测带内（3~13px）', extent >= 3 && extent <= 13, extent + 'px');

  /* ② 暗色 */
  await page.evaluate(() => document.body.setAttribute('data-ds-dark-theme', ''));
  await t.sleep(400);
  const dark = await page.evaluate(probeCard);
  const D = parseLayers(dark.shadow);
  t.log('DARK var ' + dark.varShadow + ' | calc ' + dark.shadow);
  t.check('暗色画布 = #111111（Codex 主题面板的「背景」）', dark.canvasBase.toLowerCase() === '#111111', dark.canvasBase);
  t.check('暗色表面 = #181818（卡片所坐的面，非窗口背景）', dark.surface.toLowerCase() === '#181818', dark.surface);
  t.check('暗色属性确实生效（前提自检）', dark.dark === true, String(dark.dark));
  t.check('暗色阴影为单层', D.length === 1, D.length + ' 层');
  /* 暗色相反：靠填充分层 —— 5% 白叠 surface #181818 = 35.55（Codex 参考裁图实测 35）。 */
  t.check('暗色输入卡 ≈ 35.55（5% 白叠 #181818；Codex 实测 35）', Math.abs(chan(dark.bg) - 35.55) < 1.0, dark.bg + ' → ' + chan(dark.bg).toFixed(2));
  t.check('暗色输入卡 ≠ 亮色值（两套机制相反）', dark.bg !== light.bg, dark.bg);
  t.check('暗色为 inset 内嵌高光（Codex --elevation-composer-dark）', D.length === 1 && D[0].inset === true, D[0]?.raw);
  t.check('暗色几何 = 0 0 1px 0 @20%（#fff3）', D.length === 1 && D[0].nums === '0 0 1 0' && near(D[0].alpha, 0.2), D[0]?.raw);
  const darkPx = await grab();
  const outer = scanAbove(darkPx, dark.rect, 60).filter(([d]) => d >= 2 && d <= 40).reduce((m, [, v]) => Math.max(m, Math.abs(v)), 0);
  t.check('暗色卡外零投影（2..40px 偏离 ≤ 1）', outer <= 1, outer.toFixed(1));
  /* 卡内顶边应比卡体更亮 —— inset 高光的签名。取 +0px 与 +6px 对比。 */
  const cx = Math.round((dark.rect.x + dark.rect.w / 2) * DSF);
  const top = Math.round(dark.rect.y * DSF);
  const lit = darkPx(cx, top) - darkPx(cx, top + Math.round(6 * DSF));
  t.check('暗色卡内顶边被点亮（比卡体亮 ≥ 2；旧皮肤 36/36 全平）', lit >= 2, lit.toFixed(1));

  /* ③ 窄屏：0.6.3 起没有远场可收（参考图里量不到那层），窄屏与宽屏同值。
     这一段留着是为了挡住「有人又把 80px 远场加回来」：宽窄不一致就是回退。
     必须先摘掉深色属性：暗色分支的 inset 声明特异性更高，会盖掉窄屏覆盖值，
     不摘就测到暗色阴影、断言在错误的前提上「通过」。 */
  await page.evaluate(() => document.body.removeAttribute('data-ds-dark-theme'));
  await page.viewport(600, 700, DSF);
  await t.sleep(500);
  const narrow = await page.evaluate(probeCard);
  const N = parseLayers(narrow.shadow);
  t.check('窄屏段确实回到亮色（前提自检）', narrow.dark === false, 'body 无 data-ds-dark-theme');
  t.check('窄屏（600px）阴影与宽屏逐字相同（无远场可收）', narrow.shadow === light.shadow, narrow.shadow);
  await page.viewport(1100, 700, DSF);
  await t.sleep(400);
  await t.shot(page, 'composer-shadow-verify.png');
}

/* ── ⑬·3 顶栏瘦身 + ⑭ hero + ⑰ 底部控件 ───────────────────────────────── */

/** 顶栏、hero 条、卡片与徽标的计算样式。 */
function probeHero() {
  const H = '[data-slot="conversation.session.header"]';
  const q = (s) => document.querySelector(s);
  const vis = (el) => (el ? el.getClientRects().length > 0 : null);
  const cs = (el, p) => (el ? getComputedStyle(el).getPropertyValue(p) : null);
  const row = q('[data-phase=hero] [class$=_heroWorkspaceRow]');
  const card = q('[data-composer-card]');
  const label = q('[data-slot="conversation.session.header.actions"] span');
  const editor = q('[data-lexical-editor=true]');
  const foot = q('[data-input-scroll]')?.nextElementSibling ?? null;
  return {
    header: {
      title: vis(q(H + ' [class$=_crumbs]')),
      presetBadge: vis(label),
      utilityItem: vis(q('[data-slot="conversation.session.header.utilities"] span')),
      tabs: vis(q(H + ' [data-conversation-tabs]')),
      corner: vis(q('[data-conversation-header-corner]')),
    },
    presetLabel: { color: cs(label, 'color'), bg: cs(label, 'background-color'), radius: cs(label, 'border-top-left-radius'), h: label ? Math.round(label.getBoundingClientRect().height) : null },
    card: { radius: cs(card, 'border-top-left-radius'), token: cs(document.documentElement, '--dsw-radius-card').trim(), bg: cs(card, 'background-color'), padTop: cs(card, 'padding-top') },
    heroRow: { radius: cs(row, 'border-top-left-radius') },
    editor: { minH: cs(editor, 'min-height') },
    footPad: cs(foot, 'padding-bottom'),
  };
}

/** 底部控件（加号 / 触发器）与卡外同款类名的对照件。锚点是哈希类名的后缀（_add / _trigger）。 */
function probeControls() {
  const read = (el) => (el ? { bg: getComputedStyle(el).backgroundColor, radius: getComputedStyle(el).borderTopLeftRadius } : null);
  const pick = (suffix) => [...document.querySelectorAll('[data-composer-card] button')].find((b) => String(b.className).endsWith(suffix));
  return {
    add: read(pick('_add')),
    trig: read(pick('_trigger')),
    trigRaw: read(document.querySelector('[data-host-baseline=trigger]')),
    hoverFill: getComputedStyle(document.querySelector('[data-composer-card]')).getPropertyValue('--dsw-codex-hover-fill').trim(),
  };
}

async function hero(t) {
  const { css, R, B } = conversation(t.host);
  /* ⑬·3c 放开顶栏两格后，槽里的条目用官方真实样式建模：预设徽标来自 agent-preset 的 AgentPresetLabel，
     它只用 --dsw-* 语义令牌取色，「配色跟着皮肤走」能被直接量到。 */
  const presetSrc = t.host.file('@deepseek-ai/dsh-client-ui-agent-preset/lib/client.js');
  const labelCss = cssFor(presetSrc, '@deepseek-ai/dsh-client-ui-agent-preset/AgentPresetLabel.module.css');
  const P = mapFor(presetSrc, 'AgentPresetLabel_module_css_default');
  /* 徽标圆角的宿主原值：rc.1 字面量 6px，rc.2 改成 var(--dsw-radius-xs)（ui-theme 给 4px）。
     断言防的是「皮肤改写了它」，所以期望值从宿主源码现取。 */
  const labelRadius = (() => {
    const decl = /border-radius:([^;]+)/.exec(new RegExp('\\.' + P.label + '\\{([^}]*)\\}').exec(labelCss)?.[1] ?? '');
    if (decl === null) throw new Error('宿主徽标规则里找不到 border-radius：' + P.label);
    const token = /^var\((--[\w-]+)\)$/.exec(decl[1].trim());
    if (token === null) return decl[1].trim();
    const declared = new RegExp(token[1] + ':\\s*([^;}]+)').exec(t.host.file('@deepseek-ai/dsh-client-ui-theme/lib/client.js'));
    if (declared === null) throw new Error('宿主 ui-theme 没有声明 ' + token[1]);
    return declared[1].trim();
  })();

  const chip = (label, glyph) => '<button type="button" style="display:inline-flex;align-items:center;gap:6px;padding:4px 8px;border:0;background:transparent;font:inherit;cursor:pointer">' + glyph + '<span>' + label + '</span></button>';
  const page = await t.page({ width: 1100, height: 760, dpr: 2 });
  /* 宿主底样式复刻：加号常驻 --dsw-alias-bg-layer-2 圆底并全圆角；两个触发器默认透明。触发器圆角按宿主 rc.2 源码
     （model-selection 的 .u91W7W_trigger 与 permission-presets 的 ._5Tq8wa_trigger 都是 --dsw-radius-sm = 8px）；
     本页不引宿主令牌层，所以写字面量。这条基线的意义是「皮肤必须显式压过它」。 */
  await page.setContent(`<!doctype html><html data-codex-ui><head><meta charset="utf-8">${css}<style>${labelCss}</style><style>${t.theme()}</style>
<style>[class$="_add"]{background:var(--dsw-alias-bg-layer-2);border:0;border-radius:999px}[class$="_trigger"]{background:transparent;border:0;border-radius:8px}button{font:inherit}</style>
<style>body{margin:0;background:#fff;font:14px/1.5 "Segoe UI","Microsoft YaHei",sans-serif}.stage{padding:24px 0 40px}
h4{margin:0 0 10px 24px;font:600 12px/18px ui-monospace,Consolas,monospace;color:#8a8a8a}.hdrwrap{margin:0 24px 28px;border-bottom:1px solid #e5e5e5}</style></head><body>
<div class="stage">
<h4>⑬·3 会话分割线（会话名 + 槽位条目 + 右上角按钮；页签仍隐去）</h4>
<div class="hdrwrap"><header class="${R.header}">
  <div class="${R.headerLeading}" data-conversation-header-leading></div>
  <div data-slot="conversation.session.header" style="display:contents">
    <div class="${R.titleRow}">
      <div class="${R.titleCluster}">
        <nav class="${R.crumbs}" aria-label="层级"><span class="${R.crumbSeg}"><span class="${R.crumb} ${R.crumbCurrent}">codexui</span></span></nav>
        <div class="${R.headerActions}"><div data-slot="conversation.session.header.actions" style="display:contents">
          <span class="${P.label}" title="预设徽标（官方 AgentPresetLabel 的真实类名）">✳ Agent-Evo RSI</span>
        </div></div>
      </div>
      <div class="${R.headerUtilities}"><div data-slot="conversation.session.header.utilities" style="display:contents"><span style="font-size:12px;color:#8a8a8a">工具</span></div></div>
      <div class="${R.headerCorner}" data-conversation-header-corner><button type="button" aria-label="展开右栏" style="width:28px;height:28px;border:0;background:transparent;cursor:pointer">▤</button></div>
    </div>
    <div class="${R.tabs}" role="tablist" data-conversation-tabs>
      <button class="${R.tab} ${R.tabActive}" role="tab" aria-selected="true">对话</button><button class="${R.tab}" role="tab">轨迹</button>
    </div>
  </div>
</header></div>
<h4>⑭ 输入框上方的卡片（hero：工作区 / 模式）</h4>
<div class="${R.root}" data-phase="hero"><div class="${R.body}" data-conversation-content data-content-phase="hero">
<div class="${R.scrollBody}" data-conversation-scroll><div class="${R.composerSeat}" data-composer-seat>
<div class="${R.composerStack} ${R.composerHero}">
  <div class="${R.heroWorkspaceRow}">${chip('dsh-agency-agents', '📁')}${chip('Standard mode', '⚙️')}${chip('main', '⑂')}</div>
  <div class="${B.root}"><div class="${B.card}" data-composer-card="true">
    <div class="${B.scroll}" data-input-scroll="true"><div class="${B.grow}">
      <div class="${B.input}" data-lexical-editor="true" data-phase="hero" contenteditable="true"></div>
      <div class="${B.placeholder}" data-composer-placeholder="true">Describe what you want to build... / commands, @ files or sessions</div>
    </div></div>
    <div class="${B.row}"><div class="${B.tools}"><button class="${B.add}">+</button><div class="${B.modes}"><button>Workspace Write</button></div></div>
      <div class="${B.trailing}"><button class="_7KE1Ra_trigger">DeepSeek V4 Flash High</button><button class="${B.primary}" aria-label="发送">↑</button></div></div>
  </div></div>
</div></div></div></div></div>
<h4>⑰ 宿主基线：同款哈希类名、但在 [data-composer-card] 之外（皮肤锚点不命中）</h4>
<div style="margin:0 24px 40px"><button type="button" data-host-baseline="trigger" class="_7KE1Ra_trigger" style="height:28px">DeepSeek V4 Flash High</button></div>
</div></body></html>`, 1200);

  const hdr = await page.evaluate(probeHero);
  /* 焦点环 = Codex --color-border-focus（亮色 #339cff）。先发一次 Tab 让浏览器进入键盘模态，再 focus()，才命中 :focus-visible。 */
  await page.key('Tab', 9);
  await t.sleep(120);
  const focusRing = await page.evaluate(() => {
    const el = [...document.querySelectorAll('[data-composer-card] button')].find((b) => String(b.className).endsWith('_add'));
    el.focus();
    const cs = getComputedStyle(el);
    return cs.outlineColor + ' ' + cs.outlineWidth + ' ' + cs.outlineStyle;
  });
  const idle = await page.evaluate(probeControls);
  /* 悬停要等 :hover 算完、过渡跑完：过渡中 alpha 是小数（实测 0.92 / 0.992），所以要「非透明且连续两次取样相同」才算落定。 */
  const hoverUntil = async (selector, pick) => {
    const [x, y] = await page.center(selector);
    await page.move(x, y);
    let prev = null;
    for (let i = 0; i < 24; i += 1) {
      await t.sleep(100);
      const snap = await page.evaluate(probeControls);
      if (pick(snap) !== 'rgba(0, 0, 0, 0)' && pick(snap) === prev) return snap;
      prev = pick(snap);
    }
    return page.evaluate(probeControls);
  };
  const addHover = await hoverUntil('[data-composer-card] button[class$="_add"]', (s) => s.add.bg);
  const trigHover = await hoverUntil('[data-composer-card] button[class$="_trigger"]', (s) => s.trig.bg);
  t.log('HEADER ' + JSON.stringify(hdr));
  t.log('IDLE ' + JSON.stringify(idle) + ' ADD-H ' + JSON.stringify(addHover.add) + ' TRIG-H ' + JSON.stringify(trigHover.trig));

  /* ⑬·3c：两格放开后槽里的条目真的渲染出来；页签仍隐去（参考图没有页签）。 */
  t.check('会话名仍在', hdr.header.title === true);
  t.check('预设徽标可见（顶栏两格已放开）', hdr.header.presetBadge === true);
  t.check('右侧工具条目可见（顶栏两格已放开）', hdr.header.utilityItem === true);
  /* ⑬ 页签隐去受「出口就绪」门控（T06 / UX-08）：trajectory-exit.js 只在能可靠找回
     对话页签时才盖 data-codex-ui-te-ready。没有它就**必须**看得见页签 —— 这是
     「进了轨迹出不来」的兜底；有它才隐去，⑬ 的视觉不变。两段都要测。 */
  t.check('出口未就绪时页签可见（不会无路可退）', hdr.header.tabs === true);
  await page.evaluate(() => document.body.setAttribute('data-codex-ui-te-ready', ''));
  const hdrReady = await page.evaluate(probeHero);
  t.check('出口就绪时页签隐去（⑬ 视觉保持）', hdrReady.header.tabs === false);
  await page.evaluate(() => document.body.removeAttribute('data-codex-ui-te-ready'));
  t.check('右上角按钮仍在', hdr.header.corner === true);
  /* 期望值不硬编码 rgb：令牌在重锚后是 rgba 字面量，浏览器算出来的徽标色是它
     在顶栏底色上的合成结果。临时元素走一遍 var() 让浏览器自己算，再与徽标比。 */
  const tertiaryExpected = await page.evaluate(() => {
    const el = document.createElement('span');
    el.style.color = 'var(--dsw-alias-label-tertiary)';
    document.body.appendChild(el);
    const c = getComputedStyle(el).color;
    el.remove();
    return c;
  });
  t.log('TERTIARY expected ' + tertiaryExpected);
  /* 徽标圆角同样**不硬编码**：上游 v0.3.0 已把 .SVAs4q_label 的字面量 6px 换成
     var(--dsw-radius-xs)（宿主自己在 dsh-client-ui-theme 里声明该令牌为 4px），皮肤也定义同名令牌。
     写死 6px 会同时冤枉宿主与皮肤 —— 改成「徽标圆角 == 该令牌在本页面的计算值」，临时元素法同配色那条。 */
  const badgeRadiusExpected = await page.evaluate(() => {
    const el = document.createElement('span');
    el.style.borderRadius = 'var(--dsw-radius-xs)';
    document.body.appendChild(el);
    const c = getComputedStyle(el).borderTopLeftRadius;
    el.remove();
    return c;
  });
  t.log('BADGE radius expected ' + badgeRadiusExpected);
  t.check('徽标配色 = 本皮肤 --dsw-alias-label-tertiary', hdr.presetLabel.color === tertiaryExpected, hdr.presetLabel.color + ' vs ' + tertiaryExpected);
  t.check('徽标圆角保持宿主原值 ' + labelRadius + '（未被皮肤改写）', hdr.presetLabel.radius === labelRadius, hdr.presetLabel.radius);
  t.check('徽标高 22px（官方控件高度，未改写）', hdr.presetLabel.h === 22, hdr.presetLabel.h);
  t.check('徽标不填底色（令牌未定义即透明，不另配色）', hdr.presetLabel.bg === 'rgba(0, 0, 0, 0)', hdr.presetLabel.bg);
  /* ⑭ 上栏条（hero 工作区行）只有上面两角是圆角，探在卡片背后与卡片同心叠放。2026-09-28 同屏对照：Codex 条/卡 = 1.03，
     旧值 0.79（条 16 / 卡 20）。现在条与卡片共用 --dsw-radius-card，比值恒为 1。 */
  t.check('上栏条与卡片同值（字面量）', hdr.heroRow.radius === hdr.card.radius, hdr.heroRow.radius + ' / ' + hdr.card.radius);
  t.check('上栏条与卡片同值（比值 = 1）', parseFloat(hdr.heroRow.radius) === parseFloat(hdr.card.radius));
  t.check('上栏条取 --dsw-radius-card（条 = 卡 = 令牌）', hdr.heroRow.radius === hdr.card.token && hdr.heroRow.radius === hdr.card.radius, hdr.card.token);
  /* ⑭·2 纵向留白：2026-09-28 同屏实测总高已对齐，差在卡片上内衬（DSH 22.4 vs Codex 29.25 设备像素）——
     只把上内衬 8 → 12，编辑区与底衬回到宿主原值。 */
  t.check('输入区编辑区 min-height 44（宿主原值）', hdr.editor.minH === '44px', hdr.editor.minH);
  t.check('卡片上内衬 12（Codex 实测）', hdr.card.padTop === '12px', hdr.card.padTop);
  /* 输入卡必须不透明：DSH 的卡浮在会话滚动内容之上，透明会让身后的内容透出来。计算值里出现 "/" 即带 alpha。 */
  t.check('输入卡底不透明（不透视身后会话内容）', !hdr.card.bg.includes('/'), hdr.card.bg);
  t.check('底栏下内衬 8（宿主原值）', hdr.footPad === '8px', hdr.footPad);
  t.check('加号默认无底色框', idle.add.bg === 'rgba(0, 0, 0, 0)', idle.add.bg);
  t.check('加号悬停才出现淡底', addHover.add.bg === 'rgb(242, 242, 243)', addHover.add.bg);
  t.check('加号圆形（999px）', idle.add.radius === '999px', idle.add.radius);
  t.check('触发器默认无底色框', idle.trig.bg === 'rgba(0, 0, 0, 0)', idle.trig.bg);
  t.check('触发器悬停才出现淡底', trigHover.trig.bg === 'rgb(242, 242, 243)', trigHover.trig.bg);
  /* 圆角不交给宿主：Codex 的 composer chip 是全圆角胶囊（参考图实测 R = h/2），卡外同款类名的对照证明这是皮肤写的。 */
  t.check('触发器全圆角胶囊（999px）', idle.trig.radius === '999px', idle.trig.radius);
  t.check('原生对照：卡外同款触发器仍是宿主 8px', idle.trigRaw.radius === '8px', idle.trigRaw.radius);
  t.check('悬停色标 = Codex 实测 #F2F2F3', idle.hoverFill === '#f2f2f3', idle.hoverFill);
  t.check('焦点环 = Codex --color-border-focus', focusRing === 'rgb(51, 156, 255) 2px solid', focusRing);

  await page.move(10, 10);
  await t.sleep(300);
  await t.shot(page, 'hero-verify.png', { x: 0, y: 0, width: 1100, height: 760, scale: 2 });
}

export default { 'composer-shadow': composerShadow, hero };
