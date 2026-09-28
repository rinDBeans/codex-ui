/**
 * build.mjs — 由 skins/codex-ink 的源样式生成 theme.css 与 client.js。
 *
 * 只有这一处实现作用域化与拼装。安装脚本（scripts/install-plugin.mjs）与 CI 校验
 * （scripts/check-repo.mjs）都调用它，产物一致性与安装结果由同一条代码路径决定。
 *
 * 四样东西拼进 client.js：
 *   1. skins/codex-ink 的样式（SKIN_PARTS 那八份，作用域化后内嵌）；
 *   2. src/override.js —— 设置页的覆盖层纯函数（构建期去掉 export 关键字，包成 IIFE）；
 *   3. src/model-picker.js —— 模型选择器 B 面组件（同上，包成 IIFE）；
 *   4. src/settings-card.js —— 组合包页那张配置卡（直接拼进 factory 体内）。
 *
 * 作用域化规则：
 *   :root          → html[data-codex-ui]
 *   html[...]      → 原样（已带作用域）
 *   其它选择器      → html[data-codex-ui] 前缀
 *   @keyframes / @font-face / @property / @page / @counter-style → 原样直通，不加前缀
 */
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** src/ 目录。 */
export const HERE = dirname(fileURLToPath(import.meta.url));
/** 插件根目录。 */
export const PLUGIN_DIR = dirname(HERE);
/** 皮肤源目录。 */
export const SKIN_DIR = join(PLUGIN_DIR, 'skins', 'codex-ink');
/** 作用域根选择器。 */
export const ATTR = 'html[data-codex-ui]';
/** 模板里的样式占位符（连同 null 一起替换，未替换的模板本身也是可解析的 JS）。 */
export const CSS_PLACEHOLDER = '/*__CODEX_UI_CSS__*/ null';
/** 覆盖层模块占位符。 */
export const OVERRIDE_PLACEHOLDER = '/*__CODEX_UI_OVERRIDE__*/ null';
/** 设置卡片占位符。 */
export const SETTINGS_PLACEHOLDER = '/*__CODEX_UI_SETTINGS__*/ null';
/** 模型选择器模块占位符。 */
export const MODEL_PICKER_PLACEHOLDER = '/*__CODEX_UI_MODEL_PICKER__*/ null';
/** 模板文件。 */
export const TEMPLATE = join(HERE, 'client.template.js');
/** 覆盖层纯函数模块（同时被夹具直接 import 做单测）。 */
export const OVERRIDE_FILE = join(HERE, 'override.js');
/** 设置卡片片段。 */
export const SETTINGS_FILE = join(HERE, 'settings-card.js');
/** 模型选择器组件（同时被 check-repo 直接 import 单测纯函数）。 */
export const MODEL_PICKER_FILE = join(HERE, 'model-picker.js');
/**
 * 拼进 theme.css 的源文件，顺序即层叠顺序。
 * [文件名, 该层的说明] —— 说明写进分隔注释。
 */
export const SKIN_PARTS = [
  ['skin.css', 'L1/L2 令牌与排版层'],
  ['patches.css', 'L3 组件层'],
  ['model-picker.css', 'L3 模型选择器组件'],
  ['sidebar-align.css', 'L3 侧栏对齐层'],
  ['sidebar-surface.css', 'L3 侧栏面层'],
  ['window-shadow.css', 'L3 窗口边缘阴影层'],
  ['composer.css', 'L3 输入区完整层'],
  ['settings.css', 'L3 插件设置页层'],
];

/** 单条选择器作用域化。 */
export const scopeSelector = (sel) => {
  const s = sel.trim();
  if (s === '') return sel;
  if (s === ':root') return ATTR;
  if (s.startsWith('html[')) return s;
  return ATTR + ' ' + s;
};

/** 按顶层逗号切分选择器组（括号、方括号内的逗号不算）。 */
export const splitSelectors = (text) => {
  const out = []; let depth = 0, cur = '';
  for (const ch of text) {
    if (ch === '(' || ch === '[') depth += 1;
    else if (ch === ')' || ch === ']') depth -= 1;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
};

/** 内容本身就是选择器或规则体、不能加前缀的 at 规则。 */
const PASSTHROUGH = new Set(['keyframes', 'font-face', 'property', 'page', 'counter-style']);

/** 递归作用域化一段 CSS。 */
export function scopeCss(css) {
  let i = 0, out = '';
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open < 0) { out += css.slice(i); break; }
    const prelude = css.slice(i, open);
    let depth = 1, j = open + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth += 1;
      else if (css[j] === '}') depth -= 1;
      j += 1;
    }
    const body = css.slice(open + 1, j - 1);
    const close = prelude.lastIndexOf('*/');
    const comments = close >= 0 ? prelude.slice(0, close + 2) : '';
    const selText = close >= 0 ? prelude.slice(close + 2) : prelude;
    const trimmed = selText.trim();
    if (trimmed.startsWith('@')) {
      const name = trimmed.slice(1).split(/[\s({]/)[0].toLowerCase();
      out += comments + selText + '{' + (PASSTHROUGH.has(name) ? body : scopeCss(body)) + '}';
    } else if (trimmed === '') {
      out += comments + '{' + body + '}';
    } else {
      out += comments + splitSelectors(selText).map(scopeSelector).join(',') + '{' + body + '}';
    }
    i = j;
  }
  return out;
}

/** 哈希类名锚点计数（[class=、[class*=、[class$=、[class^=]）。 */
export const hashAnchors = (text) => (text.match(/\[class[$*^]?=/g) ?? []).length;

/**
 * 去掉顶层 export 关键字，好把 ESM 模块包成 IIFE 拼进客户端产物。
 * 只认 `export const` / `export function` 两种形式；出现别的 export 形式就抛 ——
 * 静默漏掉一个导出会变成运行时的 undefined，比构建失败难查得多。
 * @param source - 模块源码。
 * @param name - 报错时用的文件名。
 * @returns 去掉 export 的源码。
 */
export function stripExports(source, name = 'override.js') {
  const rest = source.replace(/^export (const|function) /gm, '$1 ');
  const leftovers = rest.match(/^\s*export\b.*$/gm);
  if (leftovers !== null) throw new Error(name + ' 里有不支持的导出形式：' + leftovers.join(' / '));
  return rest;
}

/** 覆盖层模块暴露给客户端的名字（settings-card.js 按它取用）。 */
export const OVERRIDE_EXPORTS = [
  'OVERRIDE_ATTR', 'SKIN_ATTR', 'SETTINGS_ENTRY_ID', 'DEFAULT_CONTRAST', 'SKIN_DEFAULTS',
  'LABEL_TIERS', 'ALPHA_LADDER', 'SIDEBAR_ALPHA', 'SCALE_RANGE', 'MIX_RANGE', 'HEX_RE',
  'isHex', 'mixHex', 'withAlpha', 'contrastEffect', 'themeOverrideCss', 'isFontStack', 'sel',
];

/** 模型选择器模块暴露给客户端的名字（模板只用 installModelPicker，其余留给验收探针）。 */
export const MODEL_PICKER_EXPORTS = [
  'MODEL_SLOT', 'TRIGGER_CLASS', 'POPOVER_CLASS', 'THUMB_SIZE', 'MOTION_ARM_MS', 'POPOVER_GAP', 'POPOVER_MARGIN',
  'snapIndex', 'indexRatio', 'offsetRatio', 'ratioOffset', 'sortGroups', 'sessionIdOf', 'viewOf', 'listSignature',
  'installModelPicker',
];

/**
 * 把一个 ESM 模块包成 IIFE 表达式（占位符落在 `const x = …` 的右值上，所以只给表达式）。
 * @param file - 模块路径。
 * @param label - 报错时用的文件名。
 * @param names - 要暴露的名字。
 * @returns 表达式源码。
 */
const iife = (file, label, names) => '(() => {\n'
  + stripExports(fs.readFileSync(file, 'utf8'), label)
  + '\nreturn { ' + names.join(', ') + ' };\n})()';

/**
 * 生成产物，不落盘。
 * @returns {{themeCss: string, clientJs: string, sources: Record<string, number>, scopedBytes: number, hashAnchors: Record<string, number>}}
 */
export function build() {
  const sources = {};
  const anchors = {};
  const blocks = SKIN_PARTS.map(([file, label]) => {
    const text = fs.readFileSync(join(SKIN_DIR, file), 'utf8');
    sources[file] = text.length;
    anchors[file] = hashAnchors(text);
    return '/* ==== ' + label + '（源：skins/codex-ink/' + file + '）==== */\n' + text;
  });
  const themeCss = scopeCss(blocks.join('\n\n'));
  const tplSrc = fs.readFileSync(TEMPLATE, 'utf8');
  for (const [name, placeholder] of [['样式', CSS_PLACEHOLDER], ['覆盖层', OVERRIDE_PLACEHOLDER], ['模型选择器', MODEL_PICKER_PLACEHOLDER], ['设置卡片', SETTINGS_PLACEHOLDER]]) {
    if (!tplSrc.includes(placeholder)) throw new Error('模板缺少' + name + '占位符 ' + placeholder + '：' + TEMPLATE);
  }
  /* 占位符本身就落在 `const __override = …` / `const __modelPicker = …` 的右值位置。 */
  const overrideModule = iife(OVERRIDE_FILE, 'override.js', OVERRIDE_EXPORTS);
  const pickerModule = iife(MODEL_PICKER_FILE, 'model-picker.js', MODEL_PICKER_EXPORTS);
  const settingsCard = fs.readFileSync(SETTINGS_FILE, 'utf8');
  /* 用函数式替换：CSS 里的 $& / $' 等序列不会被当成替换模式展开。 */
  const clientJs = tplSrc
    .replace(CSS_PLACEHOLDER, () => JSON.stringify(themeCss))
    .replace(OVERRIDE_PLACEHOLDER, () => overrideModule)
    .replace(MODEL_PICKER_PLACEHOLDER, () => pickerModule)
    .replace(SETTINGS_PLACEHOLDER, () => settingsCard);
  return { themeCss, clientJs, sources, scopedBytes: themeCss.length, hashAnchors: anchors };
}
