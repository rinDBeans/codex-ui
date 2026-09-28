#!/usr/bin/env node
/**
 * check-repo.mjs — 不依赖宿主（app.asar / Chromium / dsh 实例）的仓库体检，CI 的入口。
 *
 *   node scripts/check-repo.mjs
 *
 * 覆盖：语法、JSON、包清单自洽、产物与源样式是否同源、样式表卫生、双语文档成对、
 *      文本编码（UTF-8 无 BOM）、源码里是否残留某台机器的绝对路径。
 * 需要宿主的东西（计算样式断言、真 GUI 取证）在 *-verify.mjs / live-gui-probe.mjs 里，
 * 它们读 DSH_ASAR / DSH_GLOBAL_MODULES / DSH_CHROME，本文件不碰。
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, ATTR, PLUGIN_DIR, SKIN_DIR, OVERRIDE_FILE, SETTINGS_FILE, stripExports } from '../src/build.mjs';
import * as override from '../src/override.js';
import * as picker from '../src/model-picker.js';

const HERE = dirname(fileURLToPath(import.meta.url));
let failed = 0;
const ok = (name, extra = '') => console.log('ok   ' + name + (extra ? '  ' + extra : ''));
const bad = (name, detail) => { failed += 1; console.error('FAIL ' + name + '\n     ' + detail); };
const check = (name, fn) => { try { const extra = fn(); ok(name, extra ?? ''); } catch (e) { bad(name, e.message); } };
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const rel = (p) => relative(PLUGIN_DIR, p).replaceAll('\\', '/');

/* ── 1. 运行环境 ───────────────────────────────────────────────────────── */
check('Node >= 22', () => {
  const major = Number(process.versions.node.split('.')[0]);
  assert(major >= 22, '当前 ' + process.versions.node);
  return 'v' + process.versions.node;
});

/* ── 2. 语法：全部 .js / .mjs 能被解析 ─────────────────────────────────── */
const listFiles = (dir, exts) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = join(dir, e.name);
  if (e.isDirectory()) return e.name === 'node_modules' || e.name === 'assets' || e.name === 'preview' ? [] : listFiles(p, exts);
  return exts.some((x) => e.name.endsWith(x)) ? [p] : [];
});
const jsFiles = listFiles(PLUGIN_DIR, ['.js', '.mjs']);
check('语法 ' + jsFiles.length + ' 个 JS 文件', () => {
  for (const file of jsFiles) {
    try {
      execFileSync(process.execPath, ['--check', file], { stdio: ['ignore', 'ignore', 'pipe'] });
    } catch (e) {
      throw new Error(rel(file) + '：' + String(e.stderr ?? e.message).trim().split('\n').slice(-3).join(' '));
    }
  }
});

/* ── 3. JSON ──────────────────────────────────────────────────────────── */
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
const pkg = readJson(join(PLUGIN_DIR, 'package.json'));
const skinJson = readJson(join(SKIN_DIR, 'skin.json'));
check('JSON 可解析', () => 'package.json + skins/codex-ink/skin.json');

/* ── 4. 包清单自洽 ────────────────────────────────────────────────────── */
check('package.json 清单', () => {
  const entries = [...pkg.files, pkg.main, ...Object.values(pkg.exports ?? {}), pkg.dsh?.bundle?.patch];
  for (const e of entries) {
    if (typeof e !== 'string' || e.startsWith('./') === false && e.includes('/') === false) continue;
    const target = join(PLUGIN_DIR, e.replace(/^\.\//, ''));
    assert(fs.existsSync(target), 'files/exports 指向的文件不存在：' + e);
  }
  assert(pkg.license === 'MIT', 'license 应为 MIT');
  assert(String(pkg.repository?.url ?? '').includes('github.com'), 'repository.url 缺失');
  assert(String(pkg.bugs?.url ?? '').includes('github.com'), 'bugs.url 缺失');
  assert(Number(String(pkg.engines?.node ?? '').replace(/[^0-9]/g, '')) >= 22, 'engines.node 应 >= 22');
  return pkg.name + '@' + pkg.version;
});

check('skin.json 清单', () => {
  assert(skinJson.id === 'codex-ink', 'id 应为 codex-ink');
  assert(/^#[0-9a-f]{6}$/i.test(skinJson.accent), 'accent 应为 6 位十六进制色');
  for (const p of [...Object.values(skinJson.contributes ?? {}), ...Object.values(skinJson.preview ?? {})]) {
    assert(fs.existsSync(join(SKIN_DIR, p)), 'skin.json 引用的文件不存在：' + p);
  }
  return skinJson.id + ' accent ' + skinJson.accent;
});

/* ── 5. 产物与源样式同源 ──────────────────────────────────────────────── */
const built = build();
check('theme.css 与源样式一致', () => {
  const committed = fs.readFileSync(join(PLUGIN_DIR, 'theme.css'), 'utf8');
  assert(committed === built.themeCss, '过期：先跑 node scripts/build.mjs');
  return built.scopedBytes + ' B';
});
check('client.js 与源样式一致', () => {
  const committed = fs.readFileSync(join(PLUGIN_DIR, 'client.js'), 'utf8');
  assert(committed === built.clientJs, '过期：先跑 node scripts/build.mjs');
  return built.clientJs.length + ' B';
});
check('client.js 内嵌的就是 theme.css', () => {
  const clientJs = fs.readFileSync(join(PLUGIN_DIR, 'client.js'), 'utf8');
  const m = /const CSS = (".*?");\n/s.exec(clientJs);
  assert(m, 'client.js 里找不到 CSS 字面量');
  assert(JSON.parse(m[1]) === built.themeCss, 'client.js 内嵌 CSS 与 theme.css 不同');
});

/* ── 6. 样式表卫生 ────────────────────────────────────────────────────── */
const themeCss = built.themeCss;
check('theme.css 全部作用域化', () => {
  assert(themeCss.includes(ATTR), '缺少作用域根 ' + ATTR);
  const bare = themeCss.match(/(^|\n)\s*:root\s*[,{]/g);
  assert(bare === null, '残留未作用域的 :root：' + (bare ? bare.length : 0) + ' 处');
  assert(!/@import\s+url\(\s*['"]?https?:/.test(themeCss), '不允许远程 @import');
  assert(!themeCss.includes('__CODEX_UI_CSS__'), '残留模板占位符');
  return themeCss.length + ' B';
});
check('theme.css 花括号配平', () => {
  let depth = 0;
  for (const ch of themeCss) {
    if (ch === '{') depth += 1;
    else if (ch === '}') depth -= 1;
    assert(depth >= 0, '出现多余的 }');
  }
  assert(depth === 0, '有 ' + depth + ' 个 { 未闭合');
});

/* ── 6b. 设置页契约（无宿主，纯函数 + 漂移对账）─────────────────────────── */
/** 从 index.js 里取 Config 的字段名与是否标了 volatile。 */
const configFields = (() => {
  const text = fs.readFileSync(join(PLUGIN_DIR, 'index.js'), 'utf8');
  const body = /export const Config = Schema\.object\(\{([\s\S]*?)\n\}\)/.exec(text);
  if (body === null) throw new Error('index.js 里找不到 Config schema');
  return body[1].split('\n')
    .map((line) => /^\s*([A-Za-z][A-Za-z0-9]*):\s*Schema\.(\w+)\(\)(.*)$/.exec(line))
    .filter((m) => m !== null)
    .map((m) => ({ name: m[1], type: m[2], volatile: m[3].includes('.volatile()') }));
})();
/** 卡片与覆盖层用到的字段名（写死的期望表，改一处忘另一处会在这里断）。 */
const EXPECTED_FIELDS = [
  'accentLight', 'accentDark', 'surfaceLight', 'surfaceDark', 'inkLight', 'inkDark',
  'fontUi', 'fontCode', 'translucentSidebar', 'modelPicker', 'contrastLight', 'contrastDark',
];
check('Config 的 ' + EXPECTED_FIELDS.length + ' 个字段齐全且都是 volatile', () => {
  const names = configFields.map((f) => f.name);
  assert(names.length === EXPECTED_FIELDS.length, '字段数 ' + names.length + '：' + names.join(','));
  for (const want of EXPECTED_FIELDS) assert(names.includes(want), '缺字段 ' + want);
  for (const f of configFields) assert(f.volatile, f.name + ' 没有 .volatile()：设置服务不会投影它，插件管理页也就不认这个条目');
  return names.join(' ');
});
check('覆盖层：默认值不产生任何 CSS', () => {
  assert(override.themeOverrideCss({}) === '', '空值下输出了 CSS，装上就会改外观');
  assert(override.themeOverrideCss({ translucentSidebar: false, modelPicker: true, contrastLight: 45, contrastDark: 60 }) === '', '默认档位下输出了 CSS');
  return '空串';
});
check('覆盖层：色值与字体栈校验', () => {
  assert(override.isHex('#339cff') && override.isHex('#ABCDEF'), '合法十六进制被拒');
  for (const bad of ['339cff', '#339c', '#339cfff', 'red', '', ' #339cff; }', null, undefined]) assert(!override.isHex(bad), '非法色值被接受：' + String(bad));
  assert(override.isFontStack('"Segoe UI", sans-serif'), '合法字体栈被拒');
  for (const bad of ['', 'a;}', 'url(x)', 'a'.repeat(300), 'x<y', 'u\\72l(x)', 'Arial /*', 'Arial */', '"Segoe UI', 'Arial\nx']) {
    assert(!override.isFontStack(bad), '非法字体栈被接受：' + JSON.stringify(String(bad).slice(0, 20)));
  }
  /* 一条开注释的值若漏过校验，深色那一整块覆盖会被吞掉 —— 直接对产物断言。 */
  assert(override.themeOverrideCss({ fontUi: 'Arial /*', accentDark: '#123456' }).includes('#123456'), '注释起始混进字体栈后吞掉了深色覆盖块');
  return 'ok';
});
check('覆盖层：对比度在默认档位是恒等变换', () => {
  for (const [theme, base] of [['light', 45], ['dark', 60]]) {
    const identity = override.contrastEffect(base, theme);
    assert(identity.mix === 0 && identity.scale === 1, theme + ' 默认档位不是恒等：' + JSON.stringify(identity));
    const high = override.contrastEffect(100, theme);
    assert(high.scale > 1 && high.mix > 0, theme + ' 高对比度没有抬升');
    const low = override.contrastEffect(0, theme);
    assert(low.scale < 1 && low.mix < 0, theme + ' 低对比度没有压低');
    assert(low.scale >= override.SCALE_RANGE[0], theme + ' 缩放越界');
  }
  return '恒等 + 上下限';
});
/** 从 skin.css 的某个主题区块里取一个 token 的字面值。 */
const skinBlocks = (() => {
  const lines = fs.readFileSync(join(SKIN_DIR, 'skin.css'), 'utf8').split('\n');
  const darkAt = lines.findIndex((l) => l.trim().startsWith('body[data-ds-dark-theme]'));
  assert(darkAt > 0, 'skin.css 里找不到暗色区块');
  const light = lines.slice(0, darkAt).join('\n');
  const dark = lines.slice(darkAt).join('\n');
  return { light, dark };
})();
check('覆盖层与皮肤对账：文本档位与 alpha 阶梯逐条一致', () => {
  const hex = (block, token) => {
    const m = new RegExp('\\' + token + ':\\s*(#[0-9a-fA-F]{6})').exec(block);
    return m === null ? null : m[1].toLowerCase();
  };
  const rgba = (block, token) => {
    const m = new RegExp('\\' + token + ':\\s*rgba\\(([^)]+)\\)').exec(block);
    return m === null ? null : m[1].replace(/\s/g, '');
  };
  const drift = [];
  for (const theme of ['light', 'dark']) {
    const block = skinBlocks[theme];
    for (const [token, value] of Object.entries(override.LABEL_TIERS[theme])) {
      const found = hex(block, token);
      if (found !== value.toLowerCase()) drift.push(theme + ' ' + token + ' 期望 ' + value + ' 实为 ' + found);
    }
    const rgb = theme === 'light' ? '13,13,13' : '255,255,255';
    for (const [token, alpha] of Object.entries(override.ALPHA_LADDER[theme])) {
      const found = rgba(block, token);
      if (found !== rgb + ',' + alpha) drift.push(theme + ' ' + token + ' 期望 rgba(' + rgb + ',' + alpha + ') 实为 ' + rgba(block, token));
    }
  }
  /* 设置卡色块显示的「跟随皮肤」默认值，也必须就是皮肤里那一支（0.5.6 改了深色底，这里漏改过一次）。 */
  const roles = { accent: '--dsw-alias-link', surface: '--dsw-alias-bg-base', ink: '--dsw-alias-label-primary', sidebar: '--dsw-alias-bg-sidebar' };
  for (const theme of ['light', 'dark']) {
    for (const [role, token] of Object.entries(roles)) {
      const found = hex(skinBlocks[theme], token);
      const want = override.SKIN_DEFAULTS[theme][role].toLowerCase();
      if (found !== want) drift.push(theme + ' SKIN_DEFAULTS.' + role + ' = ' + want + '，skin.css ' + token + ' = ' + found);
    }
  }
  assert(drift.length === 0, drift.join('\n     '));
  const count = Object.keys(override.LABEL_TIERS.light).length + Object.keys(override.LABEL_TIERS.dark).length
    + Object.keys(override.ALPHA_LADDER.light).length + Object.keys(override.ALPHA_LADDER.dark).length;
  return count + ' 条';
});
check('产物里确实带上了设置页与覆盖层', () => {
  const clientJs = fs.readFileSync(join(PLUGIN_DIR, 'client.js'), 'utf8');
  for (const need of ['plugins.bundle.config', 'CodexUiSettingsCard', 'registerSettingsCard', '__override', 'data-codex-ui-theme']) {
    assert(clientJs.includes(need), 'client.js 里缺 ' + need);
  }
  const stripped = stripExports(fs.readFileSync(OVERRIDE_FILE, 'utf8'));
  assert(stripped.includes('function themeOverrideCss'), 'override.js 去掉 export 后丢了函数');
  const card = fs.readFileSync(SETTINGS_FILE, 'utf8');
  assert(!/jsxs\('[a-z]+', \{[^}]*\}, \[/.test(card) && !/jsxs\('[a-z]+', \{ className: '[^']*', key \}, \[/.test(card), 'settings-card.js 又把 children 传成了第三个参数（jsx 运行时那里是 key）');
  return 'client.js ' + clientJs.length + ' B';
});

/* ── 6c. 模型选择器（纯函数 + 样式纪律）────────────────────────────────── */
check('功率轨几何：对齐、比例与像素公式互逆', () => {
  assert(picker.snapIndex(0, 4) === 0 && picker.snapIndex(1, 4) === 3 && picker.snapIndex(0.49, 4) === 1 && picker.snapIndex(0.51, 4) === 2, 'snapIndex 取整错');
  assert(picker.snapIndex(-3, 4) === 0 && picker.snapIndex(9, 4) === 3 && picker.snapIndex(NaN, 4) === 0 && picker.snapIndex(0.7, 1) === 0, 'snapIndex 越界没夹住');
  assert(picker.indexRatio(2, 4) === 2 / 3 && picker.indexRatio(0, 1) === 0.5, 'indexRatio 错');
  const width = 228;
  for (let i = 0; i < 4; i += 1) {
    const px = picker.ratioOffset(picker.indexRatio(i, 4), width);
    assert(picker.snapIndex(picker.offsetRatio(px + 100, 100, width), 4) === i, '第 ' + i + ' 档的像素位置反推不回来');
  }
  assert(picker.ratioOffset(0, width) === picker.THUMB_SIZE / 2 && picker.ratioOffset(1, width) === width - picker.THUMB_SIZE / 2, '拇指行程不是 [14, 宽 − 14]');
  return '4 档 · 行程 [14, ' + (width - 14) + ']';
});
check('功率轨视图：pending 乐观显示、selecting 不重画列表、分组同宿主排序', () => {
  const groups = [
    { id: 'other', name: 'Other', models: [{ id: 'x', name: 'X' }] },
    { id: 'deepseek-official', name: 'DeepSeek', models: [{ id: 'flash', name: 'Flash', reasoning: { defaultEffort: 'high', efforts: [{ id: 'off', name: 'Off' }, { id: 'low', name: 'Low' }, { id: 'high', name: 'High' }, { id: 'max', name: 'Max' }] } }] },
  ];
  const current = { provider: 'deepseek-official', model: 'flash', reasoningEffort: 'low' };
  const idle = picker.viewOf({ groups, current, status: 'ready', pending: null });
  assert(idle.groups[0].id === 'deepseek-official', '分组没按宿主顺序排（deepseek-official 应在前）');
  assert(idle.index === 1 && idle.effective === 'low', '生效档错：' + idle.index);
  const busy = picker.viewOf({ groups, current, status: 'selecting', pending: { ...current, reasoningEffort: 'max' } });
  assert(busy.index === 3 && busy.pendingEffort === true, 'pending 期间轨没按新档乐观显示（会回弹）');
  assert(picker.listSignature(idle) === picker.listSignature({ ...idle, status: 'selecting' }), 'selecting 进了列表签名：改档时卡片会被清空重画');
  const fallback = picker.viewOf({ groups, current: { provider: 'deepseek-official', model: 'flash' }, status: 'ready', pending: null });
  assert(fallback.effective === 'high' && fallback.index === 2, '未存档位时没退到 defaultEffort');
  assert(picker.viewOf(null).groups.length === 0 && picker.sessionIdOf(null, () => 'session-x') === 'session-x', '空快照 / 会话回退处理错');
  return 'ok';
});
check('模型选择器样式只画自建节点，不碰宿主菜单', () => {
  const css = fs.readFileSync(join(SKIN_DIR, 'model-picker.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = [...css.matchAll(/([^{}]+)\{/g)].map((m) => m[1].trim()).filter((s) => s !== '' && !s.startsWith('@') && !/^(from|to|\d+%)$/.test(s));
  const offenders = [];
  for (const group of selectors) {
    for (const sel of group.split(',').map((s) => s.trim())) {
      if (/role="?menu"?\]|body\s*>/.test(sel)) offenders.push(sel + '（挂宿主菜单）');
      else if (!/\.codex-mp-/.test(sel)) offenders.push(sel + '（不是自建节点）');
    }
  }
  assert(offenders.length === 0, offenders.join('\n     '));
  const hasCount = (css.match(/:has\(/g) ?? []).length;
  assert(hasCount === 1, ':has() 应只有席位那一条，实有 ' + hasCount);
  return selectors.length + ' 组选择器';
});
check('产物里带上了模型选择器，且模板经 ctx.inject 等服务', () => {
  const clientJs = fs.readFileSync(join(PLUGIN_DIR, 'client.js'), 'utf8');
  for (const need of ['__modelPicker', 'function installModelPicker', "ctx.inject(['modelDirectories']", 'codex-mp-trigger']) {
    assert(clientJs.includes(need), 'client.js 里缺 ' + need);
  }
  assert(!/const inject = \[[^\]]*modelDirectories/.test(clientJs), 'modelDirectories 进了插件的硬依赖列表：缺这个服务时整个皮肤都不激活');
  return 'ok';
});

/* ── 7. 文档成对 ──────────────────────────────────────────────────────── */
check('双语文档成对', () => {
  const pairs = [['README.md', 'README.zh-CN.md'], ['CHANGELOG.md', 'CHANGELOG.zh-CN.md']];
  for (const [en, zh] of pairs) {
    for (const f of [en, zh]) assert(fs.existsSync(join(PLUGIN_DIR, f)), '缺少 ' + f);
  }
  for (const f of ['skin/README.md'.replace('skin', 'skins/codex-ink'), 'skins/codex-ink/README.zh-CN.md']) {
    assert(fs.existsSync(join(PLUGIN_DIR, f)), '缺少 ' + f);
  }
});

/* ── 8. 文本编码 ──────────────────────────────────────────────────────── */
check('文本为无 BOM 的 UTF-8', () => {
  const files = [...jsFiles, ...listFiles(PLUGIN_DIR, ['.md', '.css', '.json', '.yml'])];
  for (const file of files) {
    const buf = fs.readFileSync(file);
    assert(!(buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf), '带 UTF-8 BOM：' + rel(file));
    try { new TextDecoder('utf-8', { fatal: true }).decode(buf); }
    catch { throw new Error('不是合法 UTF-8：' + rel(file)); }
  }
  return files.length + ' 个文件';
});

/* ── 9. 不留机器专属绝对路径 ──────────────────────────────────────────── */
/* 覆盖 JS、样式与文档：样式注释会被原样拼进 theme.css 与 client.js 发出去（0.5.10 就带着一条
   本机克隆路径），而 client.js 里是 JSON 转义过的 —— 分隔符可能是一个或两个反斜杠。 */
check('源码、样式与文档无机器专属绝对路径', () => {
  const bad = /(?:[A-Za-z]:(?:\\{1,2}|\/)(?:Users|A-part-of-new-software|npm-global|codex-ref|codex-src-tmp|PROJIECT)\b)|(?:\/home\/[^\s'"]+\/)|(?:\/Users\/[^\s'"/]+\/)/g;
  const files = [...jsFiles, ...listFiles(PLUGIN_DIR, ['.css', '.md'])];
  const hits = [];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(bad)) hits.push(rel(file) + ' → ' + m[0]);
  }
  assert(hits.length === 0, hits.join('\n     '));
  return files.length + ' 个文件';
});

console.log('\n' + (failed === 0 ? 'PASS' : 'FAIL') + '：' + (failed === 0 ? '全部通过' : failed + ' 项未通过'));
process.exit(failed === 0 ? 0 : 1);
