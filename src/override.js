/**
 * override.js — 设置页写进页面的那一层覆盖（纯函数：无 DOM、无副作用、可单测）。
 *
 * 为什么要单独一层：skins/*.css 是**默认值**，设置页改的是**用户覆盖**。
 * 把用户值写回源样式会让「默认长什么样」无法回答，也无法一键还原，
 * 所以覆盖只在运行时以多一个属性的选择器（特异性 +1）压过皮肤，源文件一个字不动。
 *
 * 取值纪律：
 *   · 空串 = 不覆盖（退默认层），默认值下本模块输出空串 —— 「装上不动一个字也不改外观」是夹具断言；
 *   · 颜色只认 6 位十六进制（与 Codex schema 的 /^#[0-9a-fA-F]{6}$/ 一致）；
 *   · 本模块**不产生任何彩色**：除强调色（用户显式指定）外只有中性 rgba，与皮肤的「无彩色 chrome」纪律一致。
 *
 * Codex 侧依据（app.asar 的 jdi / IOe）：
 *   dark  { accent:#339cff, contrast:60, ink:#ffffff, surface:#181818 }
 *   light { accent:#339cff, contrast:45, ink:#1a1c1f, surface:#ffffff }
 * 对比度是**简化实现**：Codex 用线性 RGB 混合把文本往 ink 拉、并按同一常量抬升灰阶；
 * 这里只做两件可解释的事 —— 文本档位按同一方向混合、发丝线与色调家族按比例缩放。
 * 差距写在 README 的「与 Codex 源码对账」一节，不含糊。
 */

/** 覆盖层生效时打在 <html> 上的第二个属性（比皮肤自身多一个属性 ⇒ 特异性稳赢）。 */
export const OVERRIDE_ATTR = 'data-codex-ui-theme';
/** 皮肤自身的根属性，与 src/build.mjs 的 ATTR 同源。 */
export const SKIN_ATTR = 'data-codex-ui';
/** 设置表单的命名空间 = profile 条目 id（= 包名）。 */
export const SETTINGS_ENTRY_ID = 'codex-ui';

/** Codex 默认对比度：亮 45 / 暗 60。 */
export const DEFAULT_CONTRAST = { light: 45, dark: 60 };

/**
 * 皮肤默认值（空串即回落到这里）。surface = 设置页「背景」那一行 = --dsw-alias-bg-base。
 * 深色 surface 自 0.5.6 起是窗口背景 #111111（#181818 是表面/侧栏那一层）；这里曾停在 #181818，
 * 设置卡的背景色块因此显示错的默认值。check-repo 现在逐字段对账 skin.css，漂移即 FAIL。
 */
export const SKIN_DEFAULTS = {
  light: { accent: '#339cff', focus: '#339cff', surface: '#ffffff', ink: '#1a1c1f', sidebar: '#eef4f9' },
  dark: { accent: '#0169cc', focus: '#339cff', surface: '#111111', ink: '#ffffff', sidebar: '#181818' },
};

/**
 * 文本档位（次要/辅助/说明/主文本弱化）—— 对比度把它们往 ink（或往底色）拉。
 * 值必须与 skins/codex-ink/skin.css 一致；夹具会核对，改一处忘另一处会 FAIL。
 */
export const LABEL_TIERS = {
  light: {
    '--dsw-alias-label-secondary': '#5d5d5d',
    '--dsw-alias-label-primary-dimmed': '#5d5d5d',
    '--dsw-alias-label-tertiary': '#767676',
    '--dsw-alias-label-caption': '#767676',
  },
  dark: {
    '--dsw-alias-label-secondary': '#b4b4b4',
    '--dsw-alias-label-primary-dimmed': '#b4b4b4',
    '--dsw-alias-label-tertiary': '#949494',
    '--dsw-alias-label-caption': '#949494',
  },
};

/**
 * 中性 alpha 家族 —— 对比度按比例缩放它们。
 * 只收中性（亮 rgba(13,13,13,·) / 暗 rgba(255,255,255,·)）：状态色与 diff 底色是**彩色**，
 * 缩放它们等于把调色板搬进本模块，与「彩色只配给状态、且集中在 skin.css」的纪律冲突。
 * 浮层挡板（bg-overlay / bg-mask-drop / specific-menu）与滚动条也不在内：它们不是对比度语义。
 * 同样由夹具与 skin.css 对账。
 */
export const ALPHA_LADDER = {
  light: {
    '--dsw-alias-bg-skeleton': 0.05,
    '--dsw-alias-border-l1': 0.07,
    '--dsw-alias-border-l2': 0.12,
    '--dsw-alias-border-l3': 0.18,
    '--dsw-alias-border-l4': 0.24,
    '--dsw-alias-border-l2-darkmode-thin': 0.09,
    '--dsw-alias-button-tool-bar-fill': 0.28,
    '--dsw-alias-button-tool-bar-fill-invisible': 0.18,
    '--dsw-alias-button-tool-bar-hover': 0.36,
    '--dsw-alias-interactive-bg-hover': 0.04,
    '--dsw-alias-interactive-bg-active': 0.08,
    '--dsw-alias-interactive-bg-hover-accent': 0.06,
    '--dsw-alias-state-business-tertiary': 0.08,
    '--dsw-specific-sidebar-nav-item-active-accent': 0.1,
  },
  dark: {
    '--dsw-alias-bg-skeleton': 0.07,
    '--dsw-alias-border-l1': 0.08,
    '--dsw-alias-border-l2': 0.14,
    '--dsw-alias-border-l3': 0.2,
    '--dsw-alias-border-l4': 0.26,
    '--dsw-alias-border-l2-darkmode-thin': 0.1,
    '--dsw-alias-button-tool-bar-fill': 0.22,
    '--dsw-alias-button-tool-bar-fill-invisible': 0.16,
    '--dsw-alias-button-tool-bar-hover': 0.28,
    '--dsw-alias-interactive-bg-hover': 0.06,
    '--dsw-alias-interactive-bg-active': 0.1,
    '--dsw-alias-interactive-bg-hover-accent': 0.08,
    '--dsw-alias-state-business-tertiary': 0.12,
    '--dsw-specific-sidebar-nav-item-active-accent': 0.14,
    /* 本插件自己的悬停填充（0.1.2 起用），深色专属。 */
    '--dsw-codex-hover-fill': 0.08,
  },
};

/** 半透明侧边栏的填充不透明度。 */
export const SIDEBAR_ALPHA = 0.72;
/** alpha 缩放的夹取区间：滑到底也不让发丝线彻底消失。 */
export const SCALE_RANGE = [0.5, 2];
/** 文本档位混合的上限（按默认对比度归一后的偏移量）。 */
export const MIX_RANGE = [0, 0.5];

/** 6 位十六进制色。 */
export const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * 是否是合法的覆盖色。
 * @param value - 待检查的值。
 * @returns 合法则 true；空串/未定义一律 false（= 不覆盖）。
 */
export function isHex(value) {
  return typeof value === 'string' && HEX_RE.test(value.trim());
}

const toRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** 线性插值（逐通道四舍五入），t=0 返回 a、t=1 返回 b。 */
export function mixHex(a, b, t) {
  const x = toRgb(a);
  const y = toRgb(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

/** 由十六进制色加 alpha 得到 rgba() 文本。 */
export function withAlpha(hex, alpha) {
  const [r, g, b] = toRgb(hex);
  return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + Number(alpha.toFixed(3)) + ')';
}

/**
 * 对比度的影响：文本混合系数与 alpha 缩放系数。
 * @param contrast - 面板上的 0–100。
 * @param theme - 'light' | 'dark'。
 * @returns {{mix: number, scale: number}} 默认对比度下两者都是恒等值（0 / 1）。
 */
export function contrastEffect(contrast, theme) {
  const fallback = DEFAULT_CONTRAST[theme];
  const raw = Number(contrast);
  const c = Number.isFinite(raw) ? Math.min(100, Math.max(0, raw)) : fallback;
  const ratio = c / fallback;
  const mix = Math.min(MIX_RANGE[1], Math.abs(ratio - 1) * 0.5) * (ratio >= 1 ? 1 : -1);
  const scale = Math.min(SCALE_RANGE[1], Math.max(SCALE_RANGE[0], ratio));
  return { mix, scale };
}

/**
 * 生成覆盖层 CSS。
 * @param values - configForms 的取值快照（空串表示不覆盖）。
 * @returns CSS 文本；默认值下为空串（不插任何规则）。
 */
export function themeOverrideCss(values = {}) {
  const light = [];
  const dark = [];

  /** 每主题一组声明。 */
  const emit = (theme, list) => {
    const d = SKIN_DEFAULTS[theme];
    const accent = isHex(values[theme === 'light' ? 'accentLight' : 'accentDark'])
      ? values[theme === 'light' ? 'accentLight' : 'accentDark'].trim()
      : null;
    const surfaceRaw = values[theme === 'light' ? 'surfaceLight' : 'surfaceDark'];
    const surface = isHex(surfaceRaw) ? surfaceRaw.trim() : null;
    const inkRaw = values[theme === 'light' ? 'inkLight' : 'inkDark'];
    const ink = isHex(inkRaw) ? inkRaw.trim() : null;
    const contrast = values[theme === 'light' ? 'contrastLight' : 'contrastDark'];
    const { mix, scale } = contrastEffect(contrast, theme);
    const effectiveSurface = surface ?? d.surface;
    const effectiveInk = ink ?? d.ink;

    if (accent !== null) {
      list.push(['--dsw-alias-link', accent]);
      /* 焦点环跟着强调色走：亮色实色、暗色 70% —— 与皮肤里的两处默认值同构。 */
      list.push(['--dsw-codex-focus', theme === 'light' ? accent : withAlpha(accent, 0.7)]);
    }
    if (surface !== null) list.push(['--dsw-alias-bg-base', surface]);
    if (ink !== null) list.push(['--dsw-alias-label-primary', ink]);
    if (mix !== 0) {
      const target = mix > 0 ? effectiveInk : effectiveSurface;
      for (const [token, base] of Object.entries(LABEL_TIERS[theme])) {
        list.push([token, mixHex(base, target, Math.abs(mix))]);
      }
    }
    if (scale !== 1) {
      const rgb = theme === 'light' ? '13, 13, 13' : '255, 255, 255';
      for (const [token, base] of Object.entries(ALPHA_LADDER[theme])) {
        list.push([token, 'rgba(' + rgb + ', ' + Number(Math.min(1, base * scale).toFixed(3)) + ')']);
      }
    }
    if (values.translucentSidebar === true) {
      /* 侧栏填充转半透明：与 surface 同面时不改变观感，它只在侧栏压住别的内容时看得见
         —— Web 没有窗口层，这一点如实写进 README，不假装等价于 Codex 的窗口半透明。 */
      const fill = withAlpha(effectiveSurface, SIDEBAR_ALPHA);
      list.push(['--dsw-alias-bg-sidebar', fill]);
      list.push(['--dsw-specific-sidebar-fill', fill]);
      /* 行填充跟着转半透明：面板半透明而行实色会露出「玻璃板上的不透明贴片」。
         深色下侧栏与内容同面时，只有这两行还能把开关的效果显出来。 */
      const rgb = theme === 'light' ? '13, 13, 13' : '255, 255, 255';
      const rowAlpha = theme === 'light' ? [0.04, 0.08] : [0.06, 0.1];
      list.push(['--dsw-specific-sidebar-nav-item-hover', 'rgba(' + rgb + ', ' + Number(Math.min(1, rowAlpha[0] * scale).toFixed(3)) + ')']);
      list.push(['--dsw-specific-sidebar-nav-item-active', 'rgba(' + rgb + ', ' + Number(Math.min(1, rowAlpha[1] * scale).toFixed(3)) + ')']);
    }
  };

  emit('light', light);
  emit('dark', dark);

  /* 字体与主题无关，单独两条。 */
  const fonts = [];
  if (isFontStack(values.fontUi)) fonts.push(['--dsw-font-family', values.fontUi.trim()]);
  if (isFontStack(values.fontCode)) fonts.push(['--ds-font-family-code', values.fontCode.trim()]);

  const blocks = [];
  const fontDecls = fonts.map(([k, v]) => '  ' + k + ': ' + v + ';').join('\n');
  if (light.length > 0 || fontDecls !== '') {
    const decls = [...light.map(([k, v]) => '  ' + k + ': ' + v + ';'), fontDecls].filter((s) => s !== '').join('\n');
    blocks.push(sel(SKIN_ATTR, 'light') + ',\n' + sel(SKIN_ATTR, 'light-body') + ' {\n' + decls + '\n}');
  }
  if (dark.length > 0) {
    const decls = dark.map(([k, v]) => '  ' + k + ': ' + v + ';').join('\n');
    blocks.push(sel(SKIN_ATTR, 'dark') + ' {\n' + decls + '\n}');
  }
  return blocks.join('\n\n');
}

/**
 * 一组合法的字体栈（不许出现会闭合声明、或能改变后文切分的字符）。
 *
 * 值是原样拼进覆盖层 `<style>` 的，所以除了 `; { } < >` 与 `url(` 还要挡三类：
 *   · 反斜杠 —— CSS 转义，`u\72l(` 在分词器眼里就是 `url(`，上面那条字面检查拦不住；
 *   · 注释起止 `/*` `*\/` —— 值里开一个注释会把后面的声明连同深色那一整块一起吞掉；
 *   · 控制字符与不成对的引号 —— 换行会断开字符串记号，半个引号会把后文读成字符串。
 * @param value - 待检查的值。
 * @returns 合法则 true。
 */
export function isFontStack(value) {
  if (typeof value !== 'string') return false;
  const s = value.trim();
  if (s === '' || s.length > 200) return false;
  if (/[;{}<>\\]/.test(s) || /url\(/i.test(s) || s.includes('/*') || s.includes('*/')) return false;
  if (/[\u0000-\u001f\u007f]/.test(s)) return false;
  return (s.split('"').length - 1) % 2 === 0 && (s.split("'").length - 1) % 2 === 0;
}

/**
 * 选择器生成：覆盖层比皮肤多一个属性，特异性 +1，因此不依赖样式表先后顺序。
 * @param attr - 皮肤根属性名。
 * @param which - 'light' | 'light-body' | 'dark'。
 * @returns CSS 选择器。
 */
export function sel(attr, which) {
  const root = 'html[' + attr + '][' + OVERRIDE_ATTR + ']';
  if (which === 'light') return root;
  if (which === 'light-body') return root + ' body';
  return root + ' body[data-ds-dark-theme]';
}
