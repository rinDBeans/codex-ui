/**
 * text — T08 文本与弹层统一（UX-13 / UX-14）的纯皮肤层验收。
 *
 * 不接宿主（openHost）：夹具只摆出「皮肤契约要求宿主/适配器打的语义属性」，
 * 验收的是本皮肤的承诺在 Chromium 计算样式里是否兑现。这与 sidebar-color 同一条
 * 纪律——夹具 HTML 自给自足，判据改动必须同时改 CHANGELOG 与 README 的表。
 *
 *   ① 全局 <a> 默认不染色（TX-01）
 *   ② [data-dsh-part="prose"] a 染 alias-link + hover 下划线（TX-02）
 *   ③ 导航/菜单/按钮里的 <a> 保持 UI 颜色（TX-03）
 *   ④ chip / tag / composer-chip 不被强制 mono（TX-04）
 *   ⑤ 中文豁免 chip 的 letter-spacing / uppercase（TX-05）
 *   ⑥ code / kbd / 文件路径仍是 meta 等宽（TX-06）
 *   ⑦ 用户 token 覆盖 alias-link 后链接色跟变（TX-07）
 *
 * 做法：
 *   - "前"版用 t.theme(cuts) 剪掉 patches.css 的某段规则；"后"版用 t.theme() 默认。
 *   - 切「前/后」是为了给夹具分辨力：判据要能在两版之间至少一项明确不同（否则判定不可靠）。
 *   - 像素对比没意义——本夹具测的是规则，不是视觉；视觉留到 live/ 真宿主下取。
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const FIXTURE = join(ROOT, 'scripts/fixtures/text-overlay-verify.html');

/* patches.css 注释里 "前/后" 裁剪标记。改 patches.css 注释时同步改这里。
   chip / meta 那一组 ⑤⑨⑩ 的修改是"删除等宽"——前后对比无意义（删除前 chip = UI 字体、
   删除后 chip 仍 = UI 字体），所以只对 ② 链接留一个 BEFORE marker 给 link_prose 用。 */
const BEFORE_MARKERS = [
  ['/* ② 链接', '/* ③ 可点元素'],
];

function loadFixture() {
  return fs.readFileSync(FIXTURE, 'utf8');
}

/** 取得元素某条样式；存在性兜底：取不到返回 null。 */
const styleOf = (page, selector, prop) => page.evaluate(([s, p]) => {
  const el = document.querySelector(s);
  if (!el) return null;
  return getComputedStyle(el).getPropertyValue(p);
}, [selector, prop]);

/** 取得元素字族 / token 解析值。 */
const familyOf = (page, selector) => page.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) return null;
  return getComputedStyle(el).fontFamily;
}, selector);

export default {
  /* ─── 前/后对比：先跑 "before"，再跑 "after"，断言规则前/后行为差异 ─── */
  async link_prose(t) {
    const fixture = loadFixture();
    /* 前 */
    const before = await render(t, fixture, { cuts: { 'patches.css': [['/* ② 链接', '/* ③ 可点元素']] } });
    const aBare   = await styleOf(before, '#a-bare',        'color');
    const aProse  = await styleOf(before, '#a-prose',       'color');
    t.log('BEFORE  a-bare color=' + aBare + ' | a-prose color=' + aProse);
    /* 当前规则：全局 a 染 alias-link；"前"切掉链接规则后所有 a 不该变色。 */
    t.check('前：裸链接未染色（保持父级前景，不是 alias-link）',
      aBare !== null && aBare === 'rgb(26, 28, 31)', aBare);
    t.check('前：prose 内链接不是 alias-link（切掉 ② 后没有强制规则）',
      aProse !== null && aProse !== 'rgb(51, 156, 255)', aProse);

    /* 后 */
    const after = await render(t, fixture, {});
    const aBareA  = await styleOf(after, '#a-bare',  'color');
    const aProseA = await styleOf(after, '#a-prose', 'color');
    t.log('AFTER   a-bare color=' + aBareA + ' | a-prose color=' + aProseA);
    /* T08 后：
         - 裸链接保持 UI 颜色（TX-01）：仍是父级前景，不是 alias-link；
         - prose 内链接染 alias-link（TX-02）：--dsw-alias-link = #339cff。 */
    t.check('后：裸链接未染色（TX-01）',
      aBareA !== null && aBareA === 'rgb(26, 28, 31)', aBareA);
    t.check('后：prose 内链接染色为 alias-link（TX-02）',
      aProseA !== null && aProseA === 'rgb(51, 156, 255)', aProseA);

    /* 导航 / 菜单链接：保持 UI 颜色（TX-03）—— 前后都该等于父级前景 */
    const aNavA = await styleOf(after, '#a-nav', 'color');
    const aMenuA = await styleOf(after, '#a-menu', 'color');
    t.check('后：导航链接保持 UI 颜色（TX-03）',
      aNavA !== null && aNavA === 'rgb(26, 28, 31)', aNavA);
    t.check('后：菜单链接保持 UI 颜色（TX-03）',
      aMenuA !== null && aMenuA === 'rgb(26, 28, 31)', aMenuA);

    /* hover 下划线（TX-02 动态） */
    const beforeHover = await styleOf(after, '#a-prose-hover', 'text-decoration-line');
    /* text-decoration-line: 在 no-underline 状态下默认 "none" */
    t.check('后：默认 prose 链接无下划线（依赖 :hover 才显示）',
      beforeHover !== null && beforeHover === 'none', beforeHover);
    /* 模拟悬停：移到远处，再移到元素中心（page.move + page.center 是 cdp.mjs 的接口） */
    await after.move(0, 0);
    await t.sleep(20);
    const target = await after.center('#a-prose-hover');
    if (target !== null) {
      await after.move(target[0], target[1]);
      await t.sleep(80);
    }
    const afterHover = await styleOf(after, '#a-prose-hover', 'text-decoration-line');
    t.check('后：hover 后 prose 链接出现下划线（TX-02）',
      afterHover !== null && afterHover.includes('underline'), afterHover);

    /* 用户覆盖（TX-07）：同节点改 alias-link 后颜色跟变 */
    await after.evaluate(() => {
      const host = document.querySelector('.override-link-host');
      host.style.setProperty('--dsw-alias-link', '#ff0066');
    });
    await t.sleep(20);
    const aOver = await styleOf(after, '#a-overridden', 'color');
    t.check('后：用户覆盖 --dsw-alias-link 后 prose 链接色跟变（TX-07）',
      aOver !== null && aOver === 'rgb(255, 0, 102)', aOver);
  },

  /* ─── chip / meta：④ / ⑥ / ⑤ ── */
  async chip_meta(t) {
    const fixture = loadFixture();
    /* 后：默认皮肤。chip / tag / composer-chip 不被强 mono；code / kbd / path 仍为 meta。 */
    const after = await render(t, fixture, {});
    const chipAfter = await familyOf(after, '#chip-2');
    const compAfter = await familyOf(after, '#composer-chip');
    const codeAfter = await familyOf(after, '#code-inline');
    const kbdAfter = await familyOf(after, '#kbd-1');
    const pathAfter = await familyOf(after, '#code-path');
    t.log('AFTER   chip-2 fontFamily=' + chipAfter + ' | composer-chip fontFamily=' + compAfter
      + ' | code fontFamily=' + codeAfter + ' | kbd fontFamily=' + kbdAfter + ' | path fontFamily=' + pathAfter);

    /* T08 后：
         - tag-chip / tag-badge / composer-chip **不再**被强 mono（TX-04）—— 默认 UI 字体；
         - code / kbd / 路径仍是 meta 等宽（TX-06）。
       关键："前" chip 是字符串；"后" chip 也是字符串 —— 字符串比较不可靠。
       改用 "前后是否一致" 作为分辨力：前 = 后 表示修改没生效，前后不等才算生效。
       但我们**希望**前后都保持 UI 字体：⑤⑨ 的 mono 化是当前渲染的副作用，应当删掉。
       因此：
         - AFTER chip / composer-chip font-family = UI 字体（Segoe UI/Microsoft YaHei/sans-serif）；
         - AFTER code / kbd / path = meta 字体（不是 UI 字体）。
         - BEFORE chip 也 = UI 字体（因为切掉了）；不影响 "AFTER chip 仍是 UI" 的判定。
    */
    t.check('后：tag-chip 不被强 mono（TX-04，UI 字体）',
      isUiFamily(chipAfter), chipAfter);
    t.check('后：composer-chip 不被强 mono（TX-04，UI 字体）',
      isUiFamily(compAfter), compAfter);
    t.check('后：code 仍为 meta 等宽（TX-06）',
      isMetaFamily(codeAfter), codeAfter);
    t.check('后：kbd 仍为 meta 等宽（TX-06）',
      isMetaFamily(kbdAfter), kbdAfter);
    t.check('后：文件路径 仍为 meta 等宽（TX-06）',
      isMetaFamily(pathAfter), pathAfter);

    /* 中文豁免：composer-chip 在 :lang(zh) 下不再被强 letter-spacing / uppercase（TX-05）。
       切掉 ⑤⑨ 后中文豁免 ⑩ 自然空挂；切掉 ⑩ 后 chip 不再带 letter-spacing 才是真豁免。
       本断言只对 "后" 测 —— 即便 ⑩ 还在，letter-spacing 也是 normal。 */
    const ls = await styleOf(after, '#composer-chip-zh', 'letter-spacing');
    const tt = await styleOf(after, '#composer-chip-zh', 'text-transform');
    t.check('后：中文 composer-chip letter-spacing 为 normal（TX-05）',
      ls !== null && (ls === 'normal' || parseFloat(ls) === 0), ls);
    t.check('后：中文 composer-chip text-transform 为 none（TX-05）',
      tt !== null && tt === 'none', tt);
  },
  /* ─── ⑱ 浮层（overlays.css）：菜单材质与长列表溢出 ─── */
  async overlay(t) {
    const page = await t.page({ width: 1100, height: 700, dpr: 1 });
    await page.setContent(`<!doctype html><html data-codex-ui><head><meta charset="utf-8">
<style>${t.theme()}</style>
<style>
  body { margin:0; font:14px/1.6 "Segoe UI","Microsoft YaHei",sans-serif; background: var(--dsw-alias-bg-base); }
  /* 宿主菜单的**真实**契约：material 层声明 --dsw-menu-backdrop-filter: blur(40px) saturate(150%)，
     描边走 --dsw-elevation-stroke-color。这里按宿主原文复刻，不做简化。 */
  [data-menu-material] {
    --dsw-menu-backdrop-filter: blur(40px) saturate(150%);
    --dsw-elevation-stroke: 0 0 0 .5px var(--dsw-elevation-stroke-color);
    --dsw-elevation-stroke-color: var(--dsw-alias-border-l4);
    max-height: 220px;
  }
  [data-trigger-menu] { max-height: 220px; }
  ul { margin:0; padding:4px; list-style:none; }
  li { padding:4px 9px; }
  /* 保留组件对照件：模型选择器 / 推理强度胶囊。它们**不能**被 overlays.css 碰到。 */
  [data-slot="conversation.input.model"] button { padding: 2px 8px; }
</style></head><body>
  <div data-menu-material id="material">
    <div data-trigger-menu id="trigger">
      <ul>${Array.from({ length: 24 }, (_, i) => `<li role="menuitem">选项 ${i + 1} · 一些很长的路径文本/very/long/path.txt</li>`).join('')}</ul>
    </div>
  </div>
  <div data-slot="conversation.input.model"><button id="keep-model">保留控件</button></div>
</body></html>`, 500);

    const probe = await page.evaluate(() => {
      const m = document.querySelector('#material');
      const g = document.querySelector('#trigger');
      const cs = (el) => getComputedStyle(el);
      const b = getComputedStyle(document.body);
      const h = getComputedStyle(document.documentElement);
      const tok = (n) => b.getPropertyValue(n).trim() || h.getPropertyValue(n).trim();
      return {
        backdrop: cs(m).getPropertyValue('--dsw-menu-backdrop-filter').trim(),
        fill: cs(m).getPropertyValue('--dsw-menu-surface-fill').trim(),
        stroke: cs(m).getPropertyValue('--dsw-elevation-stroke-color').trim(),
        bg: cs(m).backgroundColor,
        color: cs(m).color,
        /* 令牌本身：body 为先、html 兜底 —— 深色令牌声明在 body[data-ds-dark-theme] 上（不是 :root），
           只查 documentElement 在暗色下拿到的是亮色值。同一手法见 composer.mjs 的 probeCard。 */
        tokenLayer1: tok('--dsw-alias-bg-layer-1'),
        triggerOverflowY: cs(g).overflowY,
        overscroll: cs(g).overscrollBehavior,
        maxHeightKept: g.style.maxHeight === '' ? cs(g).maxHeight : g.style.maxHeight,
        // 保留组件的对照：overlays.css 里不得出现这两个锚点
        keepModelOverflow: cs(document.querySelector('#keep-model')).overflow,
        keepModelFont: cs(document.querySelector('#keep-model')).fontFamily,
      };
    });
    t.log('material: backdrop=' + probe.backdrop + ' | fill=' + probe.fill + ' | stroke=' + probe.stroke
      + ' | bg=' + probe.bg + ' | overflowY=' + probe.triggerOverflowY + ' | maxHeight=' + probe.maxHeightKept);

    t.check('⑱ 菜单材质的 backdrop-filter 被压为 none（不泛蓝、不透底）',
      probe.backdrop === 'none', probe.backdrop);
    /* getComputedStyle 返回**已解析**的自定义属性值（#ffffff），不是 var(...) 字面量 ——
       所以"跟随令牌"的判据是「解析值 === 令牌解析值」，不是字符串里出现 var(。
       后面再改一次令牌，值必须跟着变，那才是真正的跟随。 */
    t.check('⑱ 菜单填充的解析值 = 令牌 --dsw-alias-bg-layer-1 的解析值（跟随语义令牌）',
      probe.fill === probe.tokenLayer1, 'fill=' + probe.fill + ' token=' + probe.tokenLayer1);
    t.check('⑱ 亮色描边降到 l1（宿主默认 l4 太重）',
      probe.stroke === 'rgba(13, 13, 13, 0.07)', probe.stroke);
    t.check('⑱ 长列表溢出局部化到菜单自身（overflow-y: auto）',
      probe.triggerOverflowY === 'auto', probe.triggerOverflowY);
    t.check('⑱ 滚动不外溢到页面（overscroll-behavior: contain）',
      probe.overscroll === 'contain', probe.overscroll);
    t.check('⑱ 不覆盖宿主按视口定的 max-height（inline style 保留）',
      probe.maxHeightKept === '220px', probe.maxHeightKept);
    t.check('⑱ 保留组件（模型选择器）未被浮层规则改动 overflow',
      probe.keepModelOverflow === 'visible', probe.keepModelOverflow);

    /* 暗色：只切 body[data-ds-dark-theme]，不重排版（与 sidebar-color / composer 同一手法）。
       判据：① 描边从 l1 提到 l3（暗色下 l1 = rgba(255,255,255,0.07) 几乎看不见）；
              ② 填充跟随暗色 layer-1（#212121），不是亮色的 #ffffff；
              ③ 亮/暗两次的 stroke 必须不同 —— 相同就说明暗色分支根本没生效。 */
    await page.evaluate(() => document.body.setAttribute('data-ds-dark-theme', ''));
    await t.sleep(350);
    const dark = await page.evaluate(() => {
      const m = document.querySelector('#material');
      const cs = getComputedStyle(m);
      const b = getComputedStyle(document.body);
      const h = getComputedStyle(document.documentElement);
      const tok = (n) => b.getPropertyValue(n).trim() || h.getPropertyValue(n).trim();
      return {
        stroke: cs.getPropertyValue('--dsw-elevation-stroke-color').trim(),
        fill: cs.getPropertyValue('--dsw-menu-surface-fill').trim(),
        bg: cs.backgroundColor,
        tokenLayer1: tok('--dsw-alias-bg-layer-1'),
        tokenBorderL3: tok('--dsw-alias-border-l3'),
        tokenBorderL1: tok('--dsw-alias-border-l1'),
        dark: document.body.hasAttribute('data-ds-dark-theme'),
      };
    });
    t.log('DARK material: stroke=' + dark.stroke + ' | fill=' + dark.fill + ' | bg=' + dark.bg);
    t.check('暗色分支确实生效（前提自检）', dark.dark === true, String(dark.dark));
    t.check('暗色描边 = 暗色 l3 令牌（skin.css 的 body[data-ds-dark-theme] 段）',
      dark.stroke === dark.tokenBorderL3, 'stroke=' + dark.stroke + ' l3=' + dark.tokenBorderL3);
    t.check('暗色描边不是 l1（l1 在暗底上几乎不可见）',
      dark.stroke !== dark.tokenBorderL1, 'stroke=' + dark.stroke + ' l1=' + dark.tokenBorderL1);
    t.check('暗色描边与亮色不同（相同 = 分支没生效）', dark.stroke !== probe.stroke, dark.stroke + ' vs ' + probe.stroke);
    t.check('暗色填充跟随暗色 layer-1 令牌',
      dark.fill === dark.tokenLayer1 && dark.fill !== probe.fill, 'fill=' + dark.fill + ' token=' + dark.tokenLayer1);
    t.check('暗色背景是深色，不是亮色 #ffffff',
      dark.bg === 'rgb(33, 33, 33)', dark.bg);
  },
};

/** UI 字体 = "Segoe UI" / "Microsoft YaHei" / sans-serif 等，meta 不在这些里。 */
function isUiFamily(family) {
  if (!family) return false;
  /* meta 字体是 monospace 系（Consolas / Menlo / monospace）—— 这里以 *不包含* monospace 作为 UI 标志 */
  return !/monospace|consolas|menlo|courier/i.test(family);
}
function isMetaFamily(family) {
  if (!family) return false;
  return /monospace|consolas|menlo|courier/i.test(family);
}

async function render(t, html, opts) {
  const page = await t.page({ width: 1280, height: 1100, dpr: 1 });
  /* 把 fixture HTML 包进 data-codex-ui 里；只接皮肤主题，不接宿主。 */
  await page.setContent(html.replace('<html data-codex-ui>', '<html data-codex-ui data-platform="win32">')
    .replace('</head>', '<style>' + t.theme(opts.cuts ?? {}) + '</style></head>'), 500);
  return page;
}
