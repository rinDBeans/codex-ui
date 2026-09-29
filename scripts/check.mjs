#!/usr/bin/env node
/**
 * check.mjs — 不依赖宿主（app.asar / Chromium / dsh 实例）的仓库体检，CI 的入口。
 *
 *   node scripts/check.mjs
 *
 * 覆盖：语法、JSON、包清单与皮肤清单、产物与源码是否同源（等价于 build.mjs --check）、DSH 客户端插件契约、
 *      样式表卫生、设置页与模型选择器的纯函数、皮肤的 WCAG 对比度与彩色白名单、双语文档成对、
 *      文本编码（UTF-8 无 BOM）、源码里是否残留某台机器的绝对路径。
 * 需要宿主的验收（计算样式、像素、真 GUI）在 verify.mjs 与 live/ 里。
 */
import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { join, relative } from 'node:path';
import { build, ROOT, SCOPE, SKIN_DIR, stripComments } from './build.mjs';
import { checklist, summarize } from './lib/checks.mjs';
import * as override from '../src/client/override.js';
import * as picker from '../src/client/model-picker/view.js';

const { results, check, attempt } = checklist();
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const rel = (p) => relative(ROOT, p).replaceAll('\\', '/');
const read = (...parts) => fs.readFileSync(join(ROOT, ...parts), 'utf8');

/* ── 1. 运行环境 ───────────────────────────────────────────────────────── */
attempt('Node >= 22', () => {
  assert(Number(process.versions.node.split('.')[0]) >= 22, '当前 ' + process.versions.node);
  return 'v' + process.versions.node;
});

/* ── 2. 语法：全部 .js / .mjs 能被解析 ─────────────────────────────────── */
const listFiles = (dir, exts) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = join(dir, e.name);
  if (e.isDirectory()) return ['node_modules', 'assets', 'preview', '.git'].includes(e.name) ? [] : listFiles(p, exts);
  return exts.some((x) => e.name.endsWith(x)) ? [p] : [];
});
const jsFiles = listFiles(ROOT, ['.js', '.mjs']);
attempt('语法 ' + jsFiles.length + ' 个 JS 文件', () => {
  for (const file of jsFiles) {
    try {
      execFileSync(process.execPath, ['--check', file], { stdio: ['ignore', 'ignore', 'pipe'] });
    } catch (e) {
      throw new Error(rel(file) + '：' + String(e.stderr ?? e.message).trim().split('\n').slice(-3).join(' '));
    }
  }
});

/* ── 3. 清单 ──────────────────────────────────────────────────────────── */
const readJson = (...parts) => JSON.parse(read(...parts));
const pkg = readJson('package.json');
const skinJson = readJson('skins', 'codex-ink', 'skin.json');
check('JSON 可解析', true, 'package.json + skins/codex-ink/skin.json');

attempt('package.json 清单', () => {
  const entries = [...pkg.files, pkg.main, ...Object.values(pkg.exports ?? {}), pkg.dsh?.bundle?.patch];
  for (const e of entries) {
    if (typeof e !== 'string' || (!e.startsWith('./') && !e.includes('/'))) continue;
    assert(fs.existsSync(join(ROOT, e.replace(/^\.\//, ''))), 'files/exports 指向的文件不存在：' + e);
  }
  assert(pkg.license === 'MIT', 'license 应为 MIT');
  assert(String(pkg.repository?.url ?? '').includes('github.com'), 'repository.url 缺失');
  assert(String(pkg.bugs?.url ?? '').includes('github.com'), 'bugs.url 缺失');
  assert(Number(String(pkg.engines?.node ?? '').replace(/[^0-9]/g, '')) >= 22, 'engines.node 应 >= 22');
  /* 宿主半顶层 import 了 schemastery；link: 安装时插件目录里没有它，靠 peerDependencies 让包管理器从宿主解析。 */
  const imports = [...read('index.js').matchAll(/^import .* from '([^.][^']*)';$/gm)].map((m) => m[1]);
  for (const dep of imports) assert(pkg.peerDependencies?.[dep] !== undefined, 'index.js 引了 ' + dep + '，但 peerDependencies 里没有');
  return pkg.name + '@' + pkg.version + ' · peer ' + imports.join(' ');
});

/* skin-manifest-v2 的必填 / 枚举 / 正则约束（skin-center 按它 fail-closed 地加载 skins/codex-ink）。 */
attempt('skin.json 清单（skin-manifest-v2 结构自检）', () => {
  const ALLOWED = new Set(['$schema', 'skinManifestVersion', 'id', 'name', 'nameEn', 'version', 'author', 'tagline', 'description', 'tags', 'accent', 'order', 'license', 'licenseUrl', 'noticeUrl', 'sourceUrl', 'attribution', 'preview', 'requires', 'contributes', 'facets', 'package', 'wiring', 'bodyAttr']);
  const REL_PATH = /^(?![/])(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*:\/\/)[A-Za-z0-9._\-/]+$/;
  const bad = [];
  for (const k of ['skinManifestVersion', 'id', 'name', 'nameEn', 'version', 'author', 'contributes']) if (!(k in skinJson)) bad.push('缺必填字段 ' + k);
  for (const k of Object.keys(skinJson)) if (!ALLOWED.has(k)) bad.push('未知字段（fail-closed）' + k);
  if (skinJson.skinManifestVersion !== 2) bad.push('skinManifestVersion 必须为 2');
  if (skinJson.id !== 'codex-ink') bad.push('id 应为 codex-ink');
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(skinJson.version)) bad.push('version 不合法 ' + skinJson.version);
  if (!/^#[0-9a-f]{6}$/i.test(skinJson.accent)) bad.push('accent 必须是 #RRGGBB');
  if (!skinJson.contributes?.stylesheet) bad.push('contributes.stylesheet 必填');
  const paths = [...Object.entries(skinJson.contributes ?? {}), ...Object.entries(skinJson.preview ?? {})];
  for (const [key, p] of paths) {
    if (!REL_PATH.test(p)) bad.push(key + ' 必须是皮肤目录内相对路径：' + p);
    else if (!fs.existsSync(join(SKIN_DIR, p))) bad.push('引用的文件不存在：' + p);
  }
  assert(bad.length === 0, bad.join('；'));
  return skinJson.id + ' v' + skinJson.version + ' accent ' + skinJson.accent;
});

/* ── 4. 产物与源码同源 + DSH 客户端插件契约 ──────────────────────────────── */
const built = build();
attempt('theme.css 与源样式一致', () => {
  assert(read('theme.css') === built.themeCss, '过期：先跑 node scripts/build.mjs');
  return built.themeCss.length + ' B';
});
attempt('client.js 与源码一致', () => {
  assert(read('client.js') === built.clientJs, '过期：先跑 node scripts/build.mjs');
  return built.clientJs.length + ' B';
});
/* DSH 真正消费的是这个：经典脚本调用一次 __ModuleLoader__.load，id = 包名，factory 返回 { apply, inject }。
   在隔离环境里执行一遍（包导入给空对象；模块顶层不碰 DOM），直接断言契约。 */
attempt('client.js 符合 DSH 客户端插件契约', () => {
  let plugin = null;
  const window = { __ModuleLoader__: { load: ({ id, factory }) => { plugin = { id, ...factory(() => ({})) }; } } };
  vm.runInNewContext(built.clientJs, { window, console });
  assert(plugin !== null, '没有调用 window.__ModuleLoader__.load');
  assert(plugin.id === pkg.name, 'loader id 应等于包名 ' + pkg.name + '，实为 ' + plugin.id);
  assert(typeof plugin.apply === 'function', 'factory 没有返回 apply');
  /* inject 里的名字全是必需服务，缺一个整个插件就不激活；modelDirectories 必须走 ctx.inject 子作用域。 */
  assert(JSON.stringify(plugin.inject) === JSON.stringify(['slots', 'configForms', 'theme']), 'inject 应为 slots / configForms / theme，实为 ' + JSON.stringify(plugin.inject));
  assert(built.clientJs.includes("ctx.inject(['modelDirectories']"), '模型选择器不再经 ctx.inject 等服务');
  assert(built.clientJs.includes(JSON.stringify(built.themeCss)), 'client.js 内嵌的样式与 theme.css 不同');
  return 'id ' + plugin.id + ' · inject ' + plugin.inject.join(' ');
});

/* ── 5. 样式表卫生 ────────────────────────────────────────────────────── */
const themeCss = built.themeCss;
attempt('theme.css 全部作用域化', () => {
  /* keyframes 里的关键帧选择器不是 CSS 选择器：from / to / 百分比（可以逗号并列，如 `0%, 100%`）。 */
  const selectors = [...themeCss.matchAll(/([^{}]+)\{/g)].map((m) => m[1].trim())
    .filter((s) => s !== '' && !s.startsWith('@') && !s.split(',').every((t) => /^(from|to|[\d.]+%)$/.test(t.trim())))
    .flatMap((s) => s.split(/,\s*\n/));
  const bare = selectors.filter((s) => !s.startsWith('html[data-codex-ui'));
  assert(bare.length === 0, '没挂在 ' + SCOPE + ' 下的选择器：' + bare.slice(0, 5).join(' | '));
  assert(!/@import|url\(/.test(themeCss), '样式里不允许 @import / url()');
  return selectors.length + ' 条选择器';
});
attempt('theme.css 花括号配平', () => {
  let depth = 0;
  for (const ch of themeCss) {
    depth += ch === '{' ? 1 : ch === '}' ? -1 : 0;
    assert(depth >= 0, '出现多余的 }');
  }
  assert(depth === 0, '有 ' + depth + ' 个 { 未闭合');
});

/* ── 6. 设置页契约（纯函数 + 漂移对账）──────────────────────────────────── */
/** 从 index.js 里取 Config 的字段名与是否标了 volatile。 */
const configFields = (() => {
  const body = /export const Config = Schema\.object\(\{([\s\S]*?)\n\}\)/.exec(read('index.js'));
  if (body === null) throw new Error('index.js 里找不到 Config schema');
  return body[1].split('\n')
    .map((line) => /^\s*([A-Za-z][A-Za-z0-9]*):\s*Schema\.(\w+)\(\)(.*)$/.exec(line))
    .filter((m) => m !== null)
    .map((m) => ({ name: m[1], volatile: m[3].includes('.volatile()') }));
})();
/** 卡片与覆盖层用到的字段名（写死的期望表，改一处忘另一处会在这里断）。 */
const EXPECTED_FIELDS = [
  'accentLight', 'accentDark', 'surfaceLight', 'surfaceDark', 'inkLight', 'inkDark',
  'fontUi', 'fontCode', 'translucentSidebar', 'modelPicker', 'contrastLight', 'contrastDark',
];
attempt('Config 的 ' + EXPECTED_FIELDS.length + ' 个字段齐全且都是 volatile', () => {
  const names = configFields.map((f) => f.name);
  assert(names.length === EXPECTED_FIELDS.length, '字段数 ' + names.length + '：' + names.join(','));
  for (const want of EXPECTED_FIELDS) assert(names.includes(want), '缺字段 ' + want);
  for (const f of configFields) assert(f.volatile, f.name + ' 没有 .volatile()：设置服务不会投影它，插件管理页也就不认这个条目');
  return names.join(' ');
});
attempt('覆盖层：默认值不产生任何 CSS', () => {
  assert(override.themeOverrideCss({}) === '', '空值下输出了 CSS，装上就会改外观');
  assert(override.themeOverrideCss({ translucentSidebar: false, modelPicker: true, contrastLight: 45, contrastDark: 60 }) === '', '默认档位下输出了 CSS');
  return '空串';
});
attempt('覆盖层：半透明侧栏钉住设置页背板', () => {
  /* 设置页全屏背板吃 --dsw-alias-bg-sidebar（settings-modal.css §1 裁决为不透明），
     半透明开关把它改写成 rgba 后整页透出主窗口、导航与主侧栏文字重影 —— 必须钉回实色。 */
  const css = override.themeOverrideCss({ translucentSidebar: true });
  assert(css.includes('div[data-cx-sm-panel]'), '半透明开启时缺少设置页面板规则');
  assert(css.includes('--cx-sm-surface-backdrop: ' + override.SKIN_DEFAULTS.light.sidebar), '浅色背板未钉回实色');
  assert(css.includes('--cx-sm-surface-backdrop: ' + override.SKIN_DEFAULTS.dark.sidebar), '深色背板未钉回实色');
  assert(css.includes('--cx-sm-card-edge: ' + override.SKIN_DEFAULTS.light.sidebar), '浅色卡边未钉回实色');
  assert(!/body\[data-ds-dark-theme\] div\[data-cx-sm-panel\] \{[^}]*--cx-sm-card-edge/.test(css), '深色卡边压掉了皮肤的 border-l1 分主题规则');
  return '背板双色 + 浅色卡边';
});
attempt('覆盖层：色值与字体栈校验', () => {
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
attempt('覆盖层：对比度在默认档位是恒等变换', () => {
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
/** skin.css 的亮色 / 暗色两块（暗色从 body[data-ds-dark-theme] 起）。 */
const skinBlocks = (() => {
  const lines = read('skins', 'codex-ink', 'skin.css').split('\n');
  const darkAt = lines.findIndex((l) => l.trim().startsWith('body[data-ds-dark-theme]'));
  if (darkAt <= 0) throw new Error('skin.css 里找不到暗色区块');
  return { light: lines.slice(0, darkAt).join('\n'), dark: lines.slice(darkAt).join('\n') };
})();
attempt('覆盖层与皮肤对账：文本档位与 alpha 阶梯逐条一致', () => {
  const hex = (block, token) => new RegExp('\\' + token + ':\\s*(#[0-9a-fA-F]{6})').exec(block)?.[1].toLowerCase() ?? null;
  const rgba = (block, token) => new RegExp('\\' + token + ':\\s*rgba\\(([^)]+)\\)').exec(block)?.[1].replace(/\s/g, '') ?? null;
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
      if (found !== rgb + ',' + alpha) drift.push(theme + ' ' + token + ' 期望 rgba(' + rgb + ',' + alpha + ') 实为 ' + found);
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
  assert(drift.length === 0, drift.join('；'));
  return Object.values(override.LABEL_TIERS).concat(Object.values(override.ALPHA_LADDER)).reduce((n, o) => n + Object.keys(o).length, 0) + ' 条';
});
attempt('设置卡没把 children 传成 jsx 的第三个参数（那里是 key）', () => {
  const card = read('src', 'client', 'settings-card.js');
  assert(!/jsxs\('[a-z]+', \{[^}]*\}, \[/.test(card) && !/jsxs\('[a-z]+', \{ className: '[^']*', key \}, \[/.test(card), '第三个参数是数组');
});
attempt('宿主半与覆盖层的默认对比度一致', () => {
  const host = read('index.js');
  const light = Number(/DEFAULT_CONTRAST_LIGHT = (\d+)/.exec(host)?.[1]);
  const dark = Number(/DEFAULT_CONTRAST_DARK = (\d+)/.exec(host)?.[1]);
  assert(light === override.DEFAULT_CONTRAST.light && dark === override.DEFAULT_CONTRAST.dark, 'index.js ' + light + '/' + dark + ' ≠ override.js ' + JSON.stringify(override.DEFAULT_CONTRAST));
  return light + ' / ' + dark;
});

/* ── 7. 模型选择器（纯函数 + 样式纪律）─────────────────────────────────── */
attempt('功率轨几何：对齐、比例与像素公式互逆', () => {
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
attempt('功率轨视图：pending 乐观显示、selecting 不重画列表、分组同宿主排序', () => {
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
  /* 安装中的 ModelDirectoryState 没有 pending（directory.d.ts:13-32），乐观显示靠席位自己那一笔。
     这几条是它的判据 —— 去掉 localPending 这条路，前两条立刻 FAIL（夹具已按真宿主形状去掉 pending）。 */
  const local = picker.viewOf({ groups, current, status: 'selecting' }, { provider: 'deepseek-official', model: 'flash', reasoningEffort: 'max' });
  assert(local.index === 3 && local.pendingEffort === true, '宿主没给 pending 时没采用席位自己的 pending（往返会回弹、底部会停在旧档）');
  assert(picker.viewOf({ groups, current, status: 'selecting' }, null).index === 1, 'localPending 为 null 时不该改变行为');
  assert(picker.viewOf({ groups, current, status: 'selecting' }, undefined).index === 1, 'localPending 省略时不该改变行为');
  const foreign = picker.viewOf({ groups, current, status: 'selecting' }, { provider: 'other', model: 'x', reasoningEffort: 'max' });
  assert(foreign.index === 1 && foreign.pendingEffort === false, '别的模型上的 pending 污染了本模型的档位');
  assert(picker.viewOf({ groups, current, status: 'selecting', pending: { ...current, reasoningEffort: 'off' } }, { provider: 'deepseek-official', model: 'flash', reasoningEffort: 'max' }).index === 0,
    '宿主将来补上 pending 时没优先用宿主的');
  assert(picker.viewOf(null).groups.length === 0 && picker.sessionIdOf(null, () => 'session-x') === 'session-x', '空快照 / 会话回退处理错');
  return 'ok';
});
attempt('顶档点阵：可复用动画单元自成一体，且两条关动效的口子都接上', () => {
  const css = stripComments(read('skins', 'codex-ink', 'model-picker.css'));
  /* 单元边界：两个 keyframes + 三个能独立挂载的类。 */
  for (const name of ['codex-mp-cell-in', 'codex-mp-flash']) {
    assert(new RegExp('@keyframes\\s+' + name + '\\b').test(css), '缺 @keyframes ' + name);
  }
  for (const cls of ['codex-mp-matrix', 'codex-mp-matrix-cell', 'codex-mp-matrix-sq']) {
    assert(new RegExp('\\.' + cls + '\\s*[,{]').test(css), '缺可挂载类 .' + cls);
  }
  /* 可复用的判据：方块自身只读 --codex-mp-apex*，不读功率轨几何。 */
  const unit = css.match(/\.codex-mp-matrix-sq\s*\{([^}]*)\}/);
  assert(unit !== null, '找不到 .codex-mp-matrix-sq 的声明块');
  assert(!/--codex-mp-pos|100% - 16px/.test(unit[1]), '点阵单元读了功率轨几何，搬不到别处');
  assert(/--codex-mp-flash-light:\s*var\(--codex-mp-apex-flash\)/.test(unit[1]), '方块闪动的浅色不是单一来源 --codex-mp-apex-flash');
  /* 8 档色调桶：羽化尾巴分级降温，不至于出现几条可见的带。 */
  const tones = new Set([...css.matchAll(/\.codex-mp-matrix-sq\[data-tone="(\d)"\]/g)].map((m) => m[1]));
  assert(tones.size === 8, '色调桶不是 8 档：' + tones.size);
  /* 顶档紫两套主题各一份（形态基准亮 #8b7ad0 / 暗 #9d8ce0）。 */
  assert(/--codex-mp-apex:\s*#8b7ad0/.test(css) && /--codex-mp-apex:\s*#9d8ce0/.test(css), '顶档紫缺亮/暗之一');
  /* 两条关动效的口子：系统偏好 + 脚本打的 data-reduced-motion。 */
  const offs = [...css.matchAll(/([^{}]+)\{([^}]*animation:\s*none[^}]*)\}/g)].map((m) => m[1]);
  assert(offs.some((s) => s.includes('prefers-reduced-motion')), '缺 prefers-reduced-motion 关闭');
  assert(offs.some((s) => s.includes('data-reduced-motion') && s.includes('codex-mp-matrix-sq')), '缺 data-reduced-motion 关闭');
  return '2 个 keyframes · 8 档色调 · 单元不读轨几何 · 两条关闭口子';
});
attempt('模型选择器样式只画自建节点，不碰宿主菜单', () => {
  const css = stripComments(read('skins', 'codex-ink', 'model-picker.css'));
  /* keyframes 里的关键帧选择器不是 CSS 选择器：from / to / 百分比（可以逗号并列，如 `0%, 100%`）。 */
  const selectors = [...css.matchAll(/([^{}]+)\{/g)].map((m) => m[1].trim())
    .filter((s) => s !== '' && !s.startsWith('@') && !s.split(',').every((t) => /^(from|to|\d+(?:\.\d+)?%)$/.test(t.trim())));
  const offenders = [];
  for (const group of selectors) {
    for (const sel of group.split(',').map((s) => s.trim())) {
      if (/role="?menu"?\]|body\s*>/.test(sel)) offenders.push(sel + '（挂宿主菜单）');
      else if (!/\.codex-mp-/.test(sel)) offenders.push(sel + '（不是自建节点）');
    }
  }
  assert(offenders.length === 0, offenders.join('；'));
  const hasCount = (css.match(/:has\(/g) ?? []).length;
  assert(hasCount === 0, 'model-picker.css 里不许有 :has()（落在祖先位置时，会话区每插入一个节点都会让整片子树重配样式），实有 ' + hasCount);
  return selectors.length + ' 组选择器';
});

/* ── 7b. 设置模态框契约（结构层 + 视觉层 + 装配）───────────────────────────
   这一层由两个文件组成（结构层 + 视觉层），且靠构建期装配 —— 任一环断了，浏览器里都只表现为
   「设置界面没变化」，很难从现象反推原因。仓库体检必须在这里就把它抓住。
   结构层现在是一个普通 ES 模块（src/client/settings-modal.js），由 src/client/index.js 导入 ——
   PR #1 原版的占位符拼装（__CODEX_UI_MODAL__）在模块化打包器下不再需要。 */
const MODAL_FILE = join(ROOT, 'src', 'client', 'settings-modal.js');
const MODAL_CSS = join(SKIN_DIR, 'settings-modal.css');

/**
 * 扫一遍 CSS 的每条规则，挑出选择器里带 .cx-sm- 却没挂作用域根的。
 * 逐规则扫而不是正则捞：正则会被注释里的花括号带偏，而作用域漏挂是本层最致命的一类错
 * （漏了前缀 = 规则在宿主默认态下裸奔）。
 * @param css - 已作用域化的样式文本。
 * @returns 越界的选择器片段数组。
 */
const unscopedCxSm = (css) => {
  const bad = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open < 0) break;
    const prelude = css.slice(i, open);
    let depth = 1;
    let j = open + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth += 1;
      else if (css[j] === '}') depth -= 1;
      j += 1;
    }
    const body = css.slice(open + 1, j - 1);
    const close = prelude.lastIndexOf('*/');
    const selText = close >= 0 ? prelude.slice(close + 2) : prelude;
    if (selText.includes('.cx-sm-') && !selText.includes(SCOPE)) bad.push(selText.trim().slice(0, 80));
    if (selText.trim().startsWith('@') && body.includes('{')) bad.push(...unscopedCxSm(body));
    i = j;
  }
  return bad;
};

attempt('设置模态框：两个源文件存在且非空', () => {
  for (const [what, p] of [['结构层', MODAL_FILE], ['视觉层', MODAL_CSS]]) {
    assert(fs.existsSync(p), what + ' 源文件不存在：' + rel(p));
    assert(fs.statSync(p).size > 0, what + ' 源文件是空的：' + rel(p));
  }
  return rel(MODAL_FILE) + ' ' + fs.statSync(MODAL_FILE).size + ' B · '
    + rel(MODAL_CSS) + ' ' + fs.statSync(MODAL_CSS).size + ' B';
});
attempt('设置模态框：结构层被装配进 client.js 且已挂到 apply 上', () => {
  /* 定义与调用缺一不可：模块拼进去了但没人调用，界面同样不会有任何变化。 */
  assert(built.clientJs.includes('function installSettingsModal('),
    'client.js 里没有 installSettingsModal 的定义 —— src/client/index.js 没导入它？');
  assert(/installSettingsModal\(ctx\)/.test(built.clientJs),
    'client.js 里没有 installSettingsModal(ctx) 的调用 —— 模块装配了却没挂到 apply 上，界面不会变');
  assert(/from '\.\/settings-modal\.js'/.test(read('src', 'client', 'index.js')),
    'src/client/index.js 里没有 settings-modal.js 的 import');
  return '定义 + 调用都在';
});
attempt('设置模态框：视觉层进了 theme.css、全部作用域化、隐藏态有属性兜底', () => {
  assert(themeCss.includes('.cx-sm-'), 'theme.css 里一条 .cx-sm-* 规则都没有，视觉层等于没进去');
  const unscoped = unscopedCxSm(themeCss);
  assert(unscoped.length === 0,
    '有 ' + unscoped.length + ' 条 .cx-sm-* 规则没挂作用域根 ' + SCOPE + '：' + unscoped.slice(0, 2).join(' | '));
  /* 隐藏态必须以**属性选择器**为准：宿主在选中态搬家时会把那一项的 className 整条重写，
     类名会被抹掉，只有 data-* 属性留得下来。只写 .cx-sm-hidden 的话，
     筛选态下点一下别的设置项，被隐藏项就会当场复现并永久留在侧栏（集成验证批实测的回归）。 */
  assert(themeCss.includes('[data-cx-sm-hidden]'),
    '隐藏态缺少属性选择器 [data-cx-sm-hidden] —— 宿主重写 className 后类名会丢，被隐藏项会当场复现');
  return '隐藏态含属性兜底';
});
/* 面板锚点契约：形态规则**只**认插件自有锚点 [data-cx-sm-panel]，
   宿主 data-shortcut-modal / 适配器 data-dsh-surface 都只在 JS 的 PANEL_SELECTOR 里出现。
   两层分开断言，是为了让「视觉层写回宿主/适配器锚点」与「结构层丢掉宿主锚点」这两种退化
   各自指向明确 —— 前者是这里，后者在下面那条。 */
attempt('设置模态框：形态规则只挂自有锚点 [data-cx-sm-panel]', () => {
  assert(themeCss.includes('[data-cx-sm-panel]'),
    'theme.css 里找不到 [data-cx-sm-panel] —— 视觉层没挂到插件自有锚点上，面板一改名就整层失效');
  /* 只看本层的选择器文本（theme.css 已去注释）：patches.css 对 [data-dsh-surface="sidebar"|…]
     的规则是它自己的锚点契约，与设置面板无关。 */
  const legacy = [];
  let i = 0;
  while (i < themeCss.length) {
    const open = themeCss.indexOf('{', i);
    if (open < 0) break;
    const selText = themeCss.slice(i, open).trim();
    let depth = 1;
    let j = open + 1;
    while (j < themeCss.length && depth > 0) {
      if (themeCss[j] === '{') depth += 1;
      else if (themeCss[j] === '}') depth -= 1;
      j += 1;
    }
    if (selText.includes('.cx-sm-') && /data-dsh-surface|data-shortcut-modal/.test(selText)) legacy.push(selText.slice(0, 90));
    i = j;
  }
  assert(legacy.length === 0,
    '设置层里有 ' + legacy.length + ' 条规则还挂在宿主/适配器锚点上（应改挂 [data-cx-sm-panel]）：' + legacy.slice(0, 2).join(' | '));
  const scoped = (themeCss.match(/\[data-cx-sm-panel\]/g) ?? []).length;
  assert(scoped > 0, '设置层里没有一条规则挂 [data-cx-sm-panel]');
  return '自有锚点 ' + scoped + ' 处 + 0 条回退锚点规则';
});
attempt('设置模态框：结构层的面板选择器 = 宿主锚点优先、适配器兜底', () => {
  const src = read('src', 'client', 'settings-modal.js');
  const m = /const PANEL_SELECTOR = '([^']+)'/.exec(src);
  assert(m !== null, 'settings-modal.js 里找不到 PANEL_SELECTOR');
  assert(m[1] === '[data-shortcut-modal="settings"], [data-dsh-surface="settings"]',
    'PANEL_SELECTOR 变了（当前 ' + m[1] + '）—— data-shortcut-modal 是宿主自己的属性，必须排在前；'
    + 'data-dsh-surface 是第三方 adapter 补打的兜底，不能升为首选');
  assert(/setAttribute\(panel, PANEL_ATTR, ''\)/.test(src) || /setAttr\(panel, PANEL_ATTR, ''\)/.test(src),
    'findPanel() 没有盖印自有锚点 PANEL_ATTR（data-cx-sm-panel）—— 视觉层的全部形态规则都挂它，盖不上就整层失效');
  assert(src.includes('const PANEL_ATTR'), '找不到 PANEL_ATTR 声明');
  /* 面板锚点失配必须**显式报警**，不能静默失效：设置界面确实开着
     （settings.section 槽在 DOM 里）却一个锚点都没匹配到时，整层注入会无声跳过。 */
  assert(src.includes('[data-slot="settings.section"]'),
    'findPanel() 里找不到「设置界面开着」的判据 —— 锚点全失配时会静默失效，不发警告');
  return m[1];
});
attempt('设置模态框：产物里不残留任何构建占位符', () => {
  const left = ['__CODEX_UI_CSS__', '__CODEX_UI_OVERRIDE__', '__CODEX_UI_SETTINGS__', '__CODEX_UI_MODAL__']
    .filter((ph) => built.clientJs.includes(ph));
  assert(left.length === 0, 'client.js 里残留占位符 ' + left.join(' ') + '（构建没跑，或拼装漏了一环）');
  return '0 个残留占位符（模块化打包器下不再需要模板占位符）';
});

/* ── 8. 皮肤配色：WCAG 对比度与彩色白名单 ──────────────────────────────── */
/** 颜色解析：#rgb / #rrggbb / #rrggbbaa / rgb() / rgba()。 */
function parseColor(input) {
  const s = String(input).trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(s)?.[1];
  if (hex !== undefined) {
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
    return { r: parseInt(full.slice(0, 2), 16), g: parseInt(full.slice(2, 4), 16), b: parseInt(full.slice(4, 6), 16), a: full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1 };
  }
  const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/i.exec(s);
  if (m === null) return null;
  const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  return { r: +m[1], g: +m[2], b: +m[3], a };
}
const over = (fg, bg) => (fg.a >= 1 ? fg : { r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
const luminance = (c) => {
  const f = (v) => { const x = v / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
};
const contrast = (fg, bg) => {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
/** skin.css 里的自定义属性：亮色取 :root / body 块，暗色取 data-ds-dark-theme 块；var() 最多追 4 跳。 */
const tokens = (() => {
  const blocks = [...stripComments(read('skins', 'codex-ink', skinJson.contributes.stylesheet)).matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map((m) => ({ selector: m[1].trim().replace(/\s+/g, ' '), decls: Object.fromEntries(m[2].split(';').filter((d) => d.includes(':')).map((d) => [d.slice(0, d.indexOf(':')).trim(), d.slice(d.indexOf(':') + 1).trim()])) }))
    .filter((b) => !b.selector.startsWith('@'));
  const merge = (pred) => Object.assign({}, ...blocks.filter((b) => pred(b.selector)).map((b) => b.decls));
  const maps = {
    light: merge((s) => /(^|,)\s*(:root|body)\s*(,|$)/.test(s) && !s.includes('data-ds-dark-theme')),
    dark: merge((s) => s.includes('data-ds-dark-theme')),
  };
  const resolve = (map, name, depth = 0) => {
    const raw = map[name];
    if (depth > 4 || raw === undefined) return null;
    const m = /^var\(\s*(--[\w-]+)\s*(?:,\s*([\s\S]+))?\)$/.exec(raw);
    return m === null ? raw : resolve(map, m[1], depth + 1) ?? m[2]?.trim() ?? null;
  };
  return (theme, name) => resolve(maps[theme], name);
})();
/** [标签, 前景令牌, 背景令牌, 最低要求]；3:1 档是辅助 / 占位级文字。 */
const PAIRS = [
  ['亮 · 主文本 / 应用底', '--dsw-alias-label-primary', '--dsw-alias-bg-base', 4.5],
  ['亮 · 主文本 / 侧栏', '--dsw-alias-label-primary', '--dsw-alias-bg-sidebar', 4.5],
  ['亮 · 主文本 / 卡片', '--dsw-alias-label-primary', '--dsw-alias-bg-layer-1', 4.5],
  ['亮 · 主文本 / 嵌套面', '--dsw-alias-label-primary', '--dsw-alias-bg-layer-2', 4.5],
  ['亮 · 次要文本 / 应用底', '--dsw-alias-label-secondary', '--dsw-alias-bg-base', 4.5],
  ['亮 · 次要文本 / 嵌套面', '--dsw-alias-label-secondary', '--dsw-alias-bg-layer-2', 4.5],
  ['亮 · 辅助文本 / 应用底', '--dsw-alias-label-tertiary', '--dsw-alias-bg-base', 3.0],
  ['亮 · 辅助文本 / 嵌套面', '--dsw-alias-label-tertiary', '--dsw-alias-bg-layer-2', 3.0],
  ['亮 · 主按钮字 / 主按钮', '--dsw-alias-label-primary-foreground', '--dsw-alias-button-primary-fill', 4.5],
  ['亮 · 主按钮字 / 主按钮 hover', '--dsw-alias-label-primary-foreground', '--dsw-alias-button-primary-hover', 4.5],
  ['亮 · 成功 / 应用底', '--dsw-alias-state-success-primary', '--dsw-alias-bg-base', 4.5],
  ['亮 · 成功 / 成功底色', '--dsw-alias-state-success-primary', '--dsw-alias-state-success-tertiary', 4.5],
  ['亮 · 错误 / 应用底', '--dsw-alias-state-error-primary', '--dsw-alias-bg-base', 4.5],
  ['亮 · 错误 / 错误底色', '--dsw-alias-state-error-primary', '--dsw-alias-state-error-tertiary', 4.5],
  ['亮 · 警告 / 应用底', '--dsw-alias-state-warn-primary', '--dsw-alias-bg-base', 4.5],
  ['亮 · 警告 / 警告底色', '--dsw-alias-state-warn-primary', '--dsw-alias-state-warn-tertiary', 4.5],
  ['亮 · 墨标签 / 墨底色', '--dsw-alias-label-primary', '--dsw-alias-state-business-tertiary', 4.5],
  ['亮 · 辅助 / 第三档灰', '--dsw-alias-label-tertiary', '--dsw-alias-bg-layer-3', 3.0],
  ['暗 · 主文本 / 应用底', '--dsw-alias-label-primary', '--dsw-alias-bg-base', 4.5],
  ['暗 · 主文本 / 侧栏', '--dsw-alias-label-primary', '--dsw-alias-bg-sidebar', 4.5],
  ['暗 · 主文本 / 卡片', '--dsw-alias-label-primary', '--dsw-alias-bg-layer-1', 4.5],
  ['暗 · 主文本 / 嵌套面', '--dsw-alias-label-primary', '--dsw-alias-bg-layer-2', 4.5],
  ['暗 · 次要文本 / 应用底', '--dsw-alias-label-secondary', '--dsw-alias-bg-base', 4.5],
  ['暗 · 次要文本 / 卡片', '--dsw-alias-label-secondary', '--dsw-alias-bg-layer-1', 4.5],
  ['暗 · 辅助文本 / 卡片', '--dsw-alias-label-tertiary', '--dsw-alias-bg-layer-1', 3.0],
  ['暗 · 辅助文本 / 应用底', '--dsw-alias-label-tertiary', '--dsw-alias-bg-base', 3.0],
  ['暗 · 主按钮字 / 主按钮', '--dsw-alias-label-primary-foreground', '--dsw-alias-button-primary-fill', 4.5],
  ['暗 · 主按钮字 / 主按钮 hover', '--dsw-alias-label-primary-foreground', '--dsw-alias-button-primary-hover', 4.5],
  ['暗 · 成功 / 应用底', '--dsw-alias-state-success-primary', '--dsw-alias-bg-base', 4.5],
  ['暗 · 成功 / 成功底色', '--dsw-alias-state-success-primary', '--dsw-alias-state-success-tertiary', 4.5],
  ['暗 · 错误 / 应用底', '--dsw-alias-state-error-primary', '--dsw-alias-bg-base', 4.5],
  ['暗 · 错误 / 错误底色', '--dsw-alias-state-error-primary', '--dsw-alias-state-error-tertiary', 4.5],
  ['暗 · 警告 / 应用底', '--dsw-alias-state-warn-primary', '--dsw-alias-bg-base', 4.5],
  ['暗 · 警告 / 警告底色', '--dsw-alias-state-warn-primary', '--dsw-alias-state-warn-tertiary', 4.5],
  ['暗 · 亮标签 / 亮底色', '--dsw-alias-label-primary', '--dsw-alias-state-business-tertiary', 4.5],
  ['暗 · 辅助 / 第三档灰', '--dsw-alias-label-tertiary', '--dsw-alias-bg-layer-3', 3.0],
];
/** 半透明背景先叠到页面底上（亮 #ffffff / 暗 #212121），前景再叠到背景上。 */
const PAGE_BASE = { light: { r: 255, g: 255, b: 255, a: 1 }, dark: { r: 33, g: 33, b: 33, a: 1 } };
for (const [label, fgToken, bgToken, min] of PAIRS) {
  attempt(label, () => {
    const theme = label.startsWith('暗') ? 'dark' : 'light';
    const [fgRaw, bgRaw] = [tokens(theme, fgToken), tokens(theme, bgToken)];
    assert(fgRaw !== null && bgRaw !== null, '令牌未解析：' + (fgRaw === null ? fgToken : bgToken));
    const [fg, bg0] = [parseColor(fgRaw), parseColor(bgRaw)];
    assert(fg !== null && bg0 !== null, '颜色无法解析：' + fgRaw + ' / ' + bgRaw);
    const bg = over(bg0, PAGE_BASE[theme]);
    const ratio = contrast(over(fg, bg), bg);
    const grade = ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA-large' : 'FAIL';
    assert(ratio >= min, '对比度 ' + ratio.toFixed(2) + ' < ' + min);
    return ratio.toFixed(2) + ' ' + grade + '（≥ ' + min + '）' + fgRaw + ' on ' + bgRaw;
  });
}
/* chrome 无彩色：patches.css 里的颜色要么是灰（R=G=B），要么就在 skin.css 的调色板里。 */
attempt('彩色白名单：patches.css 不引入 skin.css 调色板之外的彩色', () => {
  const colorsOf = (file) => [...new Set(stripComments(read('skins', 'codex-ink', file)).match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g) ?? [])];
  const key = (c) => [c.r, c.g, c.b].map(Math.round).join(',');
  const palette = new Set(colorsOf(skinJson.contributes.stylesheet).map(parseColor).filter(Boolean).map(key));
  const used = colorsOf(skinJson.contributes.patches);
  const offenders = used.filter((c) => { const p = parseColor(c); return p !== null && !(p.r === p.g && p.g === p.b) && !palette.has(key(p)); });
  assert(offenders.length === 0, '白名单外彩色：' + offenders.join(', '));
  return '调色板 ' + palette.size + ' 色；patches.css 引用 ' + used.length + ' 色';
});

/* ── 9. 文档成对 ──────────────────────────────────────────────────────── */
attempt('双语文档成对', () => {
  for (const f of ['README.md', 'README.zh-CN.md', 'CHANGELOG.md', 'CHANGELOG.zh-CN.md', 'skins/codex-ink/README.md', 'skins/codex-ink/README.zh-CN.md']) {
    assert(fs.existsSync(join(ROOT, f)), '缺少 ' + f);
  }
});

/* ── 10. 文本编码 ─────────────────────────────────────────────────────── */
attempt('文本为无 BOM 的 UTF-8', () => {
  const files = [...jsFiles, ...listFiles(ROOT, ['.md', '.css', '.json', '.yml'])];
  for (const file of files) {
    const buf = fs.readFileSync(file);
    assert(!(buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf), '带 UTF-8 BOM：' + rel(file));
    try { new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { throw new Error('不是合法 UTF-8：' + rel(file)); }
  }
  return files.length + ' 个文件';
});

/* ── 11. 不留机器专属绝对路径 ─────────────────────────────────────────── */
/* 覆盖 JS、样式与文档：样式注释会被原样拼进 theme.css 与 client.js 发出去（0.5.10 就带着一条本机克隆路径），
   而 client.js 里是 JSON 转义过的 —— 分隔符可能是一个或两个反斜杠。 */
attempt('源码、样式与文档无机器专属绝对路径', () => {
  const bad = /(?:[A-Za-z]:(?:\\{1,2}|\/)(?:Users|A-part-of-new-software|npm-global|codex-ref|codex-src-tmp|PROJIECT)\b)|(?:\/home\/[^\s'"]+\/)|(?:\/Users\/[^\s'"/]+\/)/g;
  const files = [...jsFiles, ...listFiles(ROOT, ['.css', '.md'])];
  const hits = files.flatMap((file) => [...fs.readFileSync(file, 'utf8').matchAll(bad)].map((m) => rel(file) + ' → ' + m[0]));
  assert(hits.length === 0, hits.join('；'));
  return files.length + ' 个文件';
});

summarize(results);
