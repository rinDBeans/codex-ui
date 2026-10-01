import fs from 'node:fs';
import { join } from 'node:path';
import { cssFor, mapFor, themeLayers } from '../lib/host.mjs';
import { SKIN_DIR, SKIN_PARTS, scopeCss, stripComments } from '../build.mjs';

/**
 * 外观与字号两行（T13）。
 *
 * T13 的实质功能宿主已实现（FontSizeRow 的真实 store、AppearanceRow 的三格偏好），
 * 本 spec 只验两件事：
 *   ① 皮肤把这两行里**绕过皮肤色板**的地方接回自己的令牌（这是本文件存在的理由）；
 *   ② 字号改动能真的穿透到皮肤的内容排版令牌（方案 §8 T13「字号修改/刷新/重置正确」）。
 *
 * 纪律（本仓库被假绿坑过多次）：
 *   · 类名后缀运行时从真实 mapFor 取，缺键直接抛错，不按任何描述硬编码；
 *   · 「有皮肤 / 无皮肤」两侧都量，皮肤没做到就让它红，绝不放宽判据凑绿；
 *   · 滚动条那种夹具量不到的东西不写「实测」——本文件只断言 getComputedStyle 能证伪的量。
 */
const THEME = '@deepseek-ai/dsh-client-ui-theme/lib/client.js';
const NEED_F = ['row', 'rowText', 'title', 'desc', 'control', 'stepper', 'value', 'unit', 'arrows', 'arrow'];
const NEED_A = ['group', 'title', 'cubeRow', 'themeCube', 'selected'];
const APPEARANCE = 'appearance.css';

function needKeys(map, keys, name) {
  const missing = keys.filter((k) => map[k] === undefined);
  if (missing.length > 0) throw new Error(name + ' 缺类名（宿主映射已变）：' + missing.join(', '));
  return map;
}

function themeHost(host) {
  const src = host.file(THEME);
  return {
    css: '<style>' + themeLayers(host) + '</style>'
      + '<style>' + cssFor(src, '@deepseek-ai/dsh-client-ui-theme/FontSizeRow.module.css') + '</style>'
      + '<style>' + cssFor(src, '@deepseek-ai/dsh-client-ui-theme/AppearanceRow.module.css') + '</style>',
    F: needKeys(mapFor(src, 'FontSizeRow_module_css_default'), NEED_F, 'FontSizeRow'),
    A: needKeys(mapFor(src, 'AppearanceRow_module_css_default'), NEED_A, 'AppearanceRow'),
  };
}

/**
 * 皮肤样式表。appearance.css 由集成 owner 登记进 SKIN_PARTS；
 * 未登记时按**推荐位**（settings.css 之后）插入，使夹具与登记后的生产层叠顺序一致 ——
 * 这样本 spec 在登记前后都测的是同一个顺序，不会出现「本地绿、集成后红」。
 */
function skinParts() {
  if (SKIN_PARTS.includes(APPEARANCE)) return SKIN_PARTS;
  const at = SKIN_PARTS.indexOf('settings.css');
  const out = SKIN_PARTS.slice();
  out.splice(at < 0 ? out.length : at + 1, 0, APPEARANCE);
  return out;
}

function skinCss() {
  return skinParts()
    .map((f) => scopeCss(stripComments(fs.readFileSync(join(SKIN_DIR, f), 'utf8'))))
    .join('\n');
}

function buildPage(hostCss, F, A, theme, withSkin) {
  const scope = withSkin ? ' data-codex-ui' : '';
  const skin = withSkin ? '<style>' + theme + '</style>' : '';
  const cube = (label, selected) => '<button type="button" class="'
    + A.themeCube + (selected ? ' ' + A.selected : '') + '" aria-pressed="' + (selected ? 'true' : 'false') + '">'
    + '<span>' + label + '</span></button>';
  const arrow = (d) => '<button type="button" class="' + F.arrow + '" aria-label="' + d + '"></button>';
  const body = '<div data-slot="settings.section">'
    + '<div class="' + A.group + '"><div class="' + A.title + '">外观</div>'
    + '<div class="' + A.cubeRow + '">' + cube('跟随系统', false) + cube('浅色', true) + cube('深色', false) + '</div></div>'
    + '<div class="' + F.row + '"><div class="' + F.rowText + '">'
    + '<div class="' + F.title + '">字号</div><div class="' + F.desc + '">调整对话内容的显示大小</div></div>'
    + '<div class="' + F.control + '"><div class="' + F.stepper + '" data-probe="stepper">'
    + '<span class="' + F.value + '" data-probe="value">14</span><span class="' + F.unit + '">px</span>'
    + '<div class="' + F.arrows + '" data-probe="arrows">' + arrow('增大') + arrow('减小') + '</div>'
    + '</div></div></div>'
    + '<p data-probe="prose" style="font:var(--dsw-font-markdown-h1);margin:0">正文样本</p>'
    + '</div>';
  return '<!doctype html><html' + scope + ' data-platform="win32"><head><meta charset="utf-8">'
    + '<style>body{margin:0;background:#fff}</style></head><body>' + hostCss + skin + body + '</body></html>';
}

/** 只做测量，不下判断。 */
function probe() {
  const q = (raw) => (raw === undefined || raw === null) ? null : raw;
  const cube = document.querySelector('[class*="_themeCube"][class*="_selected"]');
  const plain = document.querySelector('[class*="_themeCube"]:not([class*="_selected"])');
  const stepper = document.querySelector('[data-probe="stepper"]');
  const arrows = document.querySelector('[data-probe="arrows"]');
  const prose = document.querySelector('[data-probe="prose"]');
  const cs = (el) => (el === null ? null : getComputedStyle(el));
  /* 令牌要**解析后**再比：getPropertyValue 返回声明原文（#1a1c1f），
     而 borderTopColor 返回 rgb(26,28,31)，两者字符串永不相等。
     用一个临时元素把令牌喂进真实属性，读回计算值。 */
  const resolveToken = (tok, prop) => {
    const d = document.createElement('div');
    d.style.setProperty(prop, 'var(' + tok + ')');
    document.body.appendChild(d);
    const v = getComputedStyle(d).getPropertyValue(prop).trim();
    d.remove();
    return v;
  };
  return {
    selectedBorder: q(cube === null ? null : cs(cube).borderTopColor),
    plainBorder: q(plain === null ? null : cs(plain).borderTopColor),
    stepperRadius: q(stepper === null ? null : cs(stepper).borderTopLeftRadius),
    stepperBg: q(stepper === null ? null : cs(stepper).backgroundColor),
    arrowsOpacity: q(arrows === null ? null : cs(arrows).opacity),
    arrowsDisplay: q(arrows === null ? null : cs(arrows).display),
    arrowFocusable: arrows === null ? null : !!(arrows.querySelector('button') && !arrows.querySelector('button').disabled),
    proseSize: q(prose === null ? null : cs(prose).fontSize),
    tokenLabelPrimary: resolveToken('--dsw-alias-label-primary', 'color'),
    tokenRadiusS: resolveToken('--dsw-radius-s', 'border-top-left-radius'),
  };
}

export default {
  appearance: async (t) => {
    const { css, F, A } = themeHost(t.host);
    const theme = skinCss();
    const page = await t.page({ width: 900, height: 620, dpr: 1 });

    await page.setContent(buildPage(css, F, A, theme, false), 400);
    const hostOnly = await page.evaluate(probe);
    await page.setContent(buildPage(css, F, A, theme, true), 400);
    const skinned = await page.evaluate(probe);
    t.log('无皮肤 ' + JSON.stringify(hostOnly));
    t.log('有皮肤 ' + JSON.stringify(skinned));
    if (hostOnly === null || skinned === null) {
      t.check('夹具就绪：两行均可定位', false, 'probe 返回 null');
      return;
    }
    t.check('夹具就绪：两行均可定位',
      skinned.selectedBorder !== null && skinned.stepperRadius !== null && skinned.plainBorder !== null,
      'selected=' + skinned.selectedBorder + ' stepper=' + skinned.stepperRadius);

    /* ── A. 判别性断言：没有 appearance.css 就应该红 ────────────────────── */

    /* ① 选中的外观格：宿主用静态令牌 --dsw-static-neutral-bluish-400 (#adb2b8，带蓝调)，
       皮肤全文件不声明任何 --dsw-static-*，所以这是这两行里唯一绕过皮肤色板的一处。
       判据写成「等于皮肤 label-primary 的解析值」而不是「不等于宿主值」——
       后者会被任何无关改动蒙混过关。 */
    t.check('选中的外观格用皮肤 label-primary（不是宿主静态蓝调令牌）',
      skinned.tokenLabelPrimary !== '' && skinned.selectedBorder === skinned.tokenLabelPrimary
        && skinned.selectedBorder !== hostOnly.selectedBorder,
      'skin=' + skinned.selectedBorder + ' host=' + hostOnly.selectedBorder
        + ' 期望=' + skinned.tokenLabelPrimary);

    /* 未选中格必须仍与选中格可辨（防止把两者写成一个颜色） */
    t.check('选中格与未选中格仍然可辨',
      skinned.selectedBorder !== skinned.plainBorder,
      'selected=' + skinned.selectedBorder + ' plain=' + skinned.plainBorder);

    /* ② 步进器圆角：宿主 --dsw-radius-md(12px) → 皮肤档位 --dsw-radius-s(8px)，
       与皮肤自有设置卡控件（settings.css 的 .cx-hex/.cx-text）同一档。 */
    t.check('字号步进器圆角用皮肤档位 --dsw-radius-s',
      skinned.tokenRadiusS !== '' && skinned.stepperRadius === skinned.tokenRadiusS
        && skinned.stepperRadius !== hostOnly.stepperRadius,
      'skin=' + skinned.stepperRadius + ' host=' + hostOnly.stepperRadius
        + ' 期望=' + skinned.tokenRadiusS);

    /* ── B. 守卫断言：皮肤不得损伤宿主既有行为 ─────────────────────────── */

    /* 宿主自己写了 .stepper:hover .arrows, .stepper:focus-within .arrows{opacity:1}。
       键盘可达性本来是好的（与 T09 侧栏行不同），这里守卫它别被皮肤写坏。 */
    const arrowsBefore = skinned.arrowsOpacity;
    /* 夹具没有 page.focus()，直接在页面里调 .focus()。 */
    const focused = await page.evaluate(() => {
      /* 必须限定 button：'[class*="_arrow"]' 会先命中容器 _arrows（它是 _arrow 的超串），
         容器不可聚焦 → focus() 静默失败。 */
      const b = document.querySelector('button[class*="_arrow"]');
      if (b === null) return false;
      b.focus();
      return document.activeElement === b;
    });
    await page.frame();
    const afterFocus = await page.evaluate(() => {
      const a = document.querySelector('[data-probe="arrows"]');
      return a === null ? null : getComputedStyle(a).opacity;
    });
    t.check('步进器箭头在键盘聚焦时露出（宿主行为未被皮肤损伤）',
      focused === true && afterFocus !== null && Number(afterFocus) > Number(arrowsBefore),
      'focused=' + focused + ' opacity ' + arrowsBefore + ' → ' + afterFocus);

    t.check('步进器与箭头未被隐藏、未禁用指针',
      skinned.arrowsDisplay !== 'none' && skinned.arrowFocusable === true,
      'arrows display=' + skinned.arrowsDisplay + ' focusable=' + skinned.arrowFocusable);

    /* ── C. 字号穿透：方案 §8 T13「字号修改/刷新/重置正确」 ─────────────── */

    /* 宿主把字号下发成 --dsh-content-font-size → --dsh-content-font-delta；
       皮肤的内容排版令牌（--dsw-font-markdown-h1 等）消费该 delta。
       这里把字号从默认 14px 调到 18px，断言皮肤令牌驱动的正文尺寸精确 +4px。 */
    const base = skinned.proseSize;
    await page.evaluate(() => { document.documentElement.style.setProperty('--dsh-content-font-size', '18px'); });
    await page.frame();
    const bumped = await page.evaluate(() => {
      const p = document.querySelector('[data-probe="prose"]');
      return p === null ? null : getComputedStyle(p).fontSize;
    });
    await page.evaluate(() => { document.documentElement.style.removeProperty('--dsh-content-font-size'); });
    await page.frame();
    const restored = await page.evaluate(() => {
      const p = document.querySelector('[data-probe="prose"]');
      return p === null ? null : getComputedStyle(p).fontSize;
    });
    t.log('字号探针 默认=' + base + ' → 18px=' + bumped + ' → 还原=' + restored);
    t.check('字号改动穿透到皮肤内容排版令牌（+4px）',
      base !== null && bumped !== null && parseFloat(bumped) - parseFloat(base) === 4,
      base + ' → ' + bumped);
    t.check('字号还原后回到原值（重置路径）',
      restored === base,
      '还原=' + restored + ' 原始=' + base);

    /* ── D. 静态纪律 ───────────────────────────────────────────────────── */

    const file = join(SKIN_DIR, APPEARANCE);
    if (!fs.existsSync(file)) {
      t.check('appearance.css 存在且被本次测量加载', false, '未找到 ' + APPEARANCE);
      return;
    }
    const raw = fs.readFileSync(file, 'utf8');
    const css2 = stripComments(raw);
    const skinRaw = fs.readFileSync(join(SKIN_DIR, 'skin.css'), 'utf8');
    const declared = new Set([...skinRaw.matchAll(/(--dsw-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
    const used = [...new Set([...css2.matchAll(/var\((--dsw-[a-z0-9-]+)/g)].map((m) => m[1]))];
    const undeclared = used.filter((x) => !declared.has(x));
    const universal = (css2.match(/\]\s*\*/g) || []).length
      + (css2.match(/(^|[\s,{])\*\s*(?=[,{])/g) || []).length;
    const hides = (css2.match(/display\s*:\s*none|pointer-events\s*:\s*none/g) || []).length;

    t.check('appearance.css 存在且被本次测量加载', true, raw.length + ' B');
    /* 这条**故意**要求真正登记进 SKIN_PARTS：本 spec 的夹具带了「未登记则按推荐位插入」的兜底，
       所以它能在登记前跑绿 —— 但那样生产 theme.css 里根本没有这些规则。
       不查这一条，就会出现「夹具绿、线上无样式」的假绿（本仓库已被同类问题坑过）。
       登记是集成 owner 的事，不是本 spec 能自己修的。 */
    t.check('appearance.css 已登记进 SKIN_PARTS（否则规则进不了生产 theme.css）',
      SKIN_PARTS.includes(APPEARANCE),
      SKIN_PARTS.includes(APPEARANCE) ? '已登记（第 ' + (SKIN_PARTS.indexOf(APPEARANCE) + 1) + ' 位）'
        : '未登记 —— 请由集成 owner 加入 SKIN_PARTS（推荐紧跟 settings.css 之后）');
    t.check('appearance.css 只引用 skin.css 已声明的 --dsw-* 令牌',
      undeclared.length === 0,
      '引用 ' + used.length + ' 个；未声明：' + (undeclared.length === 0 ? '（无）' : undeclared.join(' ')));
    t.check('appearance.css 不含后代通配选择器（性能：避免全子树重配）',
      universal === 0,
      '通配符 ' + universal + ' 处');
    t.check('appearance.css 未隐藏或禁用任何交互控件',
      hides === 0,
      hides === 0 ? '未出现 display:none / pointer-events:none' : hides + ' 处');

    await t.shot(page, 'appearance-verify.png', { x: 0, y: 0, width: 760, height: 420, scale: 2 });
  },
};
