#!/usr/bin/env node
/**
 * build.mjs — 生成 client.js（DSH 客户端插件产物）与 theme.css（同一份样式，供夹具与检查读取）。
 *
 *   node scripts/build.mjs           写出产物
 *   node scripts/build.mjs --check   只比对，过期则 exit 1（CI）
 *
 * 两件事，都不依赖第三方包：
 *   1. 样式：按 SKIN_PARTS 顺序拼 skins/codex-ink/*.css，去掉注释，每条选择器加作用域 html[data-codex-ui]；
 *   2. 脚本：把 src/client/ 的 ES 模块打成一个 DSH 要求的经典脚本 ——
 *      window.__ModuleLoader__.load({ id, factory(require) { … return { apply, inject } } })。
 *      每个模块包成一个 IIFE，按依赖顺序排；相对导入变成解构，包导入变成 require()（与宿主包同一时机求值）。
 */
import fs from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
export const SKIN_DIR = join(ROOT, 'skins', 'codex-ink');
export const CLIENT_ENTRY = join(ROOT, 'src', 'client', 'index.js');
/** 作用域根：所有规则挂在它下面，插件卸载（属性摘掉）即整层失效。 */
export const SCOPE = 'html[data-codex-ui]';
/** 拼进 theme.css 的样式，顺序即层叠顺序。 */
export const SKIN_PARTS = [
  'skin.css', // L1 令牌 + L2 排版
  'patches.css', // L3 通用组件契约、宿主模型菜单、输入区顶栏、右栏
  'overlays.css', // L3 浮层：菜单材质与长列表溢出（T08）
  'content.css', // L3 高频内容：工具卡 / 回合摘要详情 / 状态三档（T07）
  'model-picker.css', // L3 模型选择器组件
  'sidebar-align.css', // L3 侧栏对齐
  'sidebar-rows.css', // L3 侧栏行视觉映射（T09）
  'sidebar-surface.css', // L3 侧栏滚动渐隐
  'window-shadow.css', // L3 窗口边缘
  'composer.css', // L3 输入区
  'composer-queue.css', // L3 后续消息队列（QueueDock）并入输入卡那一族
  'settings.css', // L3 插件设置卡
  'settings-modal.css', // L3 设置模态框 Codex 化层
  'trajectory-exit.css', // L3 轨迹视图的退出出口
];
/** 虚拟模块：客户端代码从这里取内联样式（DSH 只下发 client.js，样式必须在 JS 里）。 */
const THEME_MODULE = 'codex-ui:theme.css';

/* ── 样式 ─────────────────────────────────────────────────────────────── */

/** 去掉注释（跳过字符串里的内容），并把因此留下的多余空行收拢。 */
export function stripComments(css) {
  let out = '';
  for (let i = 0; i < css.length; i += 1) {
    const ch = css[i];
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < css.length && css[j] !== ch) j += css[j] === '\\' ? 2 : 1;
      out += css.slice(i, j + 1);
      i = j;
    } else if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      i = end < 0 ? css.length : end + 1;
    } else {
      out += ch;
    }
  }
  return out.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

/** 按顶层逗号切分选择器组（括号、方括号、字符串里的逗号不算）。 */
function splitSelectors(text) {
  const out = [];
  let depth = 0;
  let quote = null;
  let cur = '';
  for (const ch of text) {
    if (quote !== null) { if (ch === quote) quote = null; }
    else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(' || ch === '[') depth += 1;
    else if (ch === ')' || ch === ']') depth -= 1;
    else if (ch === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

/**
 * 单条选择器加作用域：`:root` 开头的就是根本身（`:root:has(…)` → `html[data-codex-ui]:has(…)`）；
 * 已写明 `html[…]` 的原样；其余挂在根下。
 */
function scopeSelector(selector) {
  const s = selector.trim();
  if (s.startsWith(':root')) return SCOPE + s.slice(':root'.length);
  if (s.startsWith('html[')) return s;
  return SCOPE + ' ' + s;
}

/** 内容本身是规则体、不能加前缀的 at 规则。 */
const PASSTHROUGH = new Set(['keyframes', 'font-face', 'property', 'page', 'counter-style']);

/** 找到与 open 处 `{` 配对的 `}` 的下标（跳过字符串）。 */
function matchBrace(css, open) {
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    const ch = css[i];
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < css.length && css[j] !== ch) j += css[j] === '\\' ? 2 : 1;
      i = j;
    } else if (ch === '{') depth += 1;
    else if (ch === '}') { depth -= 1; if (depth === 0) return i; }
  }
  throw new Error('样式里有未闭合的 {');
}

/** 给一段（已去注释的）样式的每条规则加作用域；@media / @supports 递归处理。 */
export function scopeCss(css) {
  let out = '';
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open < 0) { out += css.slice(i); break; }
    const close = matchBrace(css, open);
    const prelude = css.slice(i, open);
    const body = css.slice(open + 1, close);
    const head = prelude.trim();
    const lead = prelude.slice(0, prelude.length - prelude.trimStart().length);
    if (head.startsWith('@')) {
      const name = head.slice(1).split(/[\s({]/)[0].toLowerCase();
      out += lead + head + ' {' + (PASSTHROUGH.has(name) ? body : scopeCss(body)) + '}';
    } else {
      out += lead + splitSelectors(head).map(scopeSelector).join(',\n') + ' {' + body + '}';
    }
    i = close + 1;
  }
  return out;
}

/** 读一份或几份皮肤样式，返回作用域化后的文本。 */
export function buildCss(parts = SKIN_PARTS) {
  return parts.map((file) => scopeCss(stripComments(fs.readFileSync(join(SKIN_DIR, file), 'utf8')))).join('\n');
}

/* ── 脚本 ─────────────────────────────────────────────────────────────── */

const IMPORT_RE = /^import\s+(?:\{([^}]*)\}|\*\s+as\s+([\w$]+))\s+from\s+'([^']+)';?[ \t]*$/gm;
const EXPORT_RE = /^export\s+(const|function|class)\s+([\w$]+)/gm;

/** `a, b as c` → `a, b: c`（解构写法）。 */
const destructure = (names) => names.split(',').map((n) => n.trim()).filter(Boolean)
  .map((n) => n.replace(/^([\w$]+)\s+as\s+([\w$]+)$/, '$1: $2')).join(', ');

/**
 * 把入口及其相对依赖打成「一串按依赖顺序排好的 IIFE」。
 * 只支持两种导入（`import { a, b as c } from '…'`、`import * as ns from '…'`）与
 * `export const|function|class`；出现别的写法直接抛，静默漏掉一个导出比构建失败难查得多。
 * @param entry - 入口文件。
 * @param virtual - 虚拟模块：说明符 → 源码。
 * @returns {{ code: string, entryVar: string, exports: string[] }}
 */
export function bundle(entry, virtual = {}) {
  const done = new Map();
  const visiting = new Set();
  const chunks = [];
  const load = (id) => {
    if (done.has(id)) return done.get(id);
    if (visiting.has(id)) throw new Error('循环依赖：' + id);
    visiting.add(id);
    const isVirtual = Object.hasOwn(virtual, id);
    const source = isVirtual ? virtual[id] : fs.readFileSync(id, 'utf8');
    const label = isVirtual ? id : relative(ROOT, id).replaceAll('\\', '/');
    const header = [];
    let body = source.replace(IMPORT_RE, (_, names, ns, spec) => {
      const from = spec.startsWith('.') ? load(resolve(dirname(id), spec)).name
        : Object.hasOwn(virtual, spec) ? load(spec).name
          : 'require(' + JSON.stringify(spec) + ')';
      header.push('const ' + (ns ?? '{ ' + destructure(names) + ' }') + ' = ' + from + ';');
      return '';
    });
    const exports = [];
    body = body.replace(EXPORT_RE, (_, kind, name) => { exports.push(name); return kind + ' ' + name; });
    const stray = body.match(/^\s*(import|export)\b.*$/m);
    if (stray !== null) throw new Error(label + ' 里有不支持的导入/导出写法：' + stray[0].trim());
    const name = '__' + label.replace(/\.js$/, '').replace(/[^\w$]+/g, '_');
    chunks.push('/* ' + label + ' */\nconst ' + name + ' = (() => {\n' + header.join('\n') + (header.length ? '\n' : '')
      + body.trim() + '\nreturn { ' + exports.join(', ') + ' };\n})();');
    const mod = { name, exports };
    visiting.delete(id);
    done.set(id, mod);
    return mod;
  };
  const root = load(entry);
  return { code: chunks.join('\n\n'), entryVar: root.name, exports: root.exports };
}

/** 生成全部产物，不落盘。 */
export function build() {
  const themeCss = buildCss();
  const pkg = JSON.parse(fs.readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const { code, entryVar, exports } = bundle(CLIENT_ENTRY, { [THEME_MODULE]: 'export const THEME_CSS = ' + JSON.stringify(themeCss) + ';' });
  for (const need of ['apply', 'inject']) {
    if (!exports.includes(need)) throw new Error('src/client/index.js 必须导出 ' + need);
  }
  const clientJs = '/* ' + pkg.name + ' ' + pkg.version + ' —— 由 scripts/build.mjs 从 src/client/ 与 skins/codex-ink/ 生成，勿手改。 */\n'
    + 'window.__ModuleLoader__.load({\n'
    + '  id: ' + JSON.stringify(pkg.name) + ',\n'
    + '  factory: (require) => {\n'
    + code + '\n\n'
    + 'return { apply: ' + entryVar + '.apply, inject: ' + entryVar + '.inject };\n'
    + '  },\n'
    + '});\n';
  return { themeCss, clientJs };
}

/* ── CLI ──────────────────────────────────────────────────────────────── */

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const check = process.argv.includes('--check');
  const { themeCss, clientJs } = build();
  let stale = 0;
  for (const [name, text] of [['theme.css', themeCss], ['client.js', clientJs]]) {
    const path = join(ROOT, name);
    const same = fs.existsSync(path) && fs.readFileSync(path, 'utf8') === text;
    if (!same) stale += 1;
    if (!check && !same) fs.writeFileSync(path, text);
    console.log((same ? 'OK    ' : check ? 'STALE ' : 'WROTE ') + name + '  ' + text.length + ' B');
  }
  if (check && stale > 0) {
    console.error('产物与源码不一致：先跑 node scripts/build.mjs 再提交。');
    process.exit(1);
  }
}
