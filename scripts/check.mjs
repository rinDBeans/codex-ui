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
import { openHost } from './lib/host.mjs';
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

/* ── 6b. 设置卡草稿生命周期（UX-02 回归护栏）──────────────────────────────
   shown = draftOf(field) ?? 权威值 ?? 默认值 —— 草稿是第一优先级。只写存储不清草稿，
   就会出现「保存值已重置、滑杆/读数仍显示旧值」。本轮把两条提交路径（滑杆 commit、
   重置 clear）都改成「先撤草稿、再动权威值」，这里把它们钉住，防止回归。 */
attempt('设置卡：草稿与权威值同收（UX-02 回归护栏）', () => {
  const card = read('src', 'client', 'settings-card.js');
  assert(/const shown = draftOf\(field\) \?\? /.test(card), 'shown 的取值优先级变了（草稿优先是这条修复的前提）');
  assert(/const clear = useCallback\(\(field\) => \{[\s\S]*?delete next\[field\][\s\S]*?scope\.unset\(field\)/.test(card),
    'clear() 没有先撤草稿 —— 重置后滑杆/读数仍会显示旧草稿');
  assert(/const commit = \(\) => \{[\s\S]*?delete copy\[field\][\s\S]*?write\(field, next\)/.test(card),
    '对比度滑杆的 commit() 没有撤草稿 —— 提交后 shown 永远取草稿，保存值/重置都改不动读数');
  return 'shown 草稿优先；clear() 与滑杆 commit() 都先撤草稿再动权威值';
});

/* ── 6c. 主题事务超时回退（UX-12 回归护栏）───────────────────────────────
   写入被接受、但宿主一直没发 theme/change 时，预览会按真值回滚。此时分段控件必须
   跟着回退，否则页面已回亮色、分段仍选深色（已复现的脱节）。这条链路靠
   previewTheme 的结束回调打通，这里钉住它。 */
attempt('设置卡：主题事务超时回退（UX-12 回归护栏）', () => {
  const prev = read('src', 'client', 'theme-preview.js');
  assert(/return \(target, onSettle\)/.test(prev), 'previewTheme 没有接收「预览结束」回调');
  assert(/onSettle\(true\)/.test(prev) && /onSettle\(false\)/.test(prev),
    'previewTheme 没有在「宿主已确认」与「超时回滚」两条路径上都通知调用方');
  const card = read('src', 'client', 'settings-card.js');
  assert(/previewTheme\(id, \(confirmed\) => \{[\s\S]*?setPendingTheme\(null\)/.test(card),
    '主题切换没有在预览结束（超时/回滚）时清 pendingTheme —— 分段控件会停在未生效的那一档');
  assert(card.includes('themeTimedOut'), '主题超时没有用户可见的反馈状态');
  return 'previewTheme 结束回调 → 清 pending + 反馈';
});

/* ── 6d. 字段级错误与无障碍关联（UX-16 回归护栏）─────────────────────────
   非法输入原本直接 return，用户「不清楚为何没保存」；说明与错误也没挂到控件上，
   读屏只念 aria-label。这里钉住：错误要可见、要经 aria-describedby 关联、重置按钮要带字段名。 */
attempt('设置卡：字段级错误与无障碍关联（UX-16 回归护栏）', () => {
  const card = read('src', 'client', 'settings-card.js');
  assert(card.includes('aria-describedby'), '控件没有 aria-describedby —— 说明与错误挂不到控件上');
  assert(/const describedBy = error === undefined \? descId : descId \+ ' ' \+ errId/.test(card),
    '没有「说明 + 错误」的关联链');
  assert(/validate\(text\) === false\) \{[\s\S]*?setErrors/.test(card),
    '非法输入又变回静默丢弃 —— 用户看不到为什么不保存');
  assert(/copy\.resetOf\(label\)/.test(card), '重置按钮没有带字段名（多个「重置」同名，读屏分不清点的是哪个）');
  assert((card.match(/resetOf: \(name\) => /g) ?? []).length === 2, 'resetOf 必须中英各一份');
  return '说明/错误经 aria-describedby 关联；重置按钮含字段名';
});

/* ── 6e. 设置模态框自有文案的语言（UX-07 回归护栏）────────────────────────
   实测：ctx.reflect.get('locale') 拿得到 LocaleRuntime，直接访问 ctx.locale 会 THREW
   （它不在 inject 里）；且载入瞬间快照还是 zh，要等设置文档到达才解析成 en ——
   所以文案必须**每次重放都重写**，只写一次会永远停在中文。 */
attempt('设置模态框：自有文案中英成对且随 locale 刷新（UX-07 回归护栏）', () => {
  const src = read('src', 'client', 'settings-modal.js');
  assert(/ctx\.reflect\.get\('locale'\)/.test(src), 'locale 没经 ctx.reflect.get 取 —— 直接访问 ctx.locale 会 THREW');
  assert(/const TEXT = \{[\s\S]*?zh: \{[\s\S]*?en: \{/.test(src), 'TEXT 表不是中英成对');
  assert(/relabel\(list, back, search\)/.test(src), '重放时没有重写文案 —— 切语言后会停在旧语言');
  assert(/const setText = |const setAttrIf = /.test(src), '重写文案没有「值不同才写」的守卫（会自触发观察器循环）');
  assert(src.includes('GROUP_LABEL_EN'), '组标题没有英文名');
  return 'locale 经 reflect 取；文案中英成对；每次重放重写且有收敛守卫';
});

/* ── 6f. 分组按 slot id，不依赖界面语言（UX-07 Step B 回归护栏）────────────
   宿主把「通用设置」在英文下渲染成 "General"，按标签分组必然塌成「其他」（实测复现过）。
   slot id（general / models / plugins …）与语言无关 —— 宿主自己也用
   ctx.slots.entries('settings.section') 的 options.order 排序渲染，所以能与 navList 的
   button 一一对齐。这里钉住这条链路与它的两道守卫。 */
attempt('设置模态框：分组按 slot id，不依赖界面语言（UX-07 Step B）', () => {
  const src = read('src', 'client', 'settings-modal.js');
  assert(src.includes('GROUP_IDS') && src.includes('GROUP_OF_ID'), '没有 slot id → 组的映射表');
  assert(/ctx\.slots\.entries\('settings\.section'\)/.test(src), '没有读宿主的 settings.section 条目');
  assert(/const useIds = ids\.length === cells\.length/.test(src), '缺「条数对得上才用 id」的守卫（错位会分错组）');
  assert(/const groupOf = \(label, slotId\)/.test(src), '没有 id 优先 / 标签兜底的归类函数');
  assert(/const headerText = groupLabelOf\(group\)/.test(src), '标题比较键与写入值不同源（会与 relabel 互相触发振荡）');
  return 'id 优先 · 标签兜底 · 条数守卫 · 标题单源';
});
attempt('宿主半与覆盖层的默认对比度一致', () => {
  const host = read('index.js');
  const light = Number(/DEFAULT_CONTRAST_LIGHT = (\d+)/.exec(host)?.[1]);
  const dark = Number(/DEFAULT_CONTRAST_DARK = (\d+)/.exec(host)?.[1]);
  assert(light === override.DEFAULT_CONTRAST.light && dark === override.DEFAULT_CONTRAST.dark, 'index.js ' + light + '/' + dark + ' ≠ override.js ' + JSON.stringify(override.DEFAULT_CONTRAST));
  return light + ' / ' + dark;
});

/* ── 6g. 侧栏对齐不留祖先 :has()（T09 / 64f4d60 的性能债）─────────────
   实测依据：:has() 落在祖先位置、且目标是常见元素（span / *）时，会话区每插入一个带
   data-slot 的节点，Chromium 都要把受影响祖先下的全部候选重新匹配一遍 —— 流式插入
   实测整页样式重算 4.3s → 0.27s 就是靠去掉这几条。
   侧栏三条（sidebar-align / sidebar-surface）已全部改写成固定深度子代 + 类名后缀；
   这里钉住它，并顺带对账宿主是否真有那个类名后缀（否则改写会静默失效）。 */
attempt('侧栏样式不留祖先 :has()（T09）', () => {
  const offenders = [];
  for (const f of ['sidebar-align.css', 'sidebar-surface.css']) {
    const css = stripComments(read('skins', 'codex-ink', f));
    if (css.includes(':has(')) offenders.push(f + ' → ' + (css.match(/:has\([^)]*\)/g) ?? []).join(' '));
  }
  assert(offenders.length === 0, '侧栏又出现 :has()（会拖慢流式插入时的样式重算）：' + offenders.join('；'));
  /* 锚点对账：新写法靠宿主 CSS 模块的类名后缀，宿主改哈希前缀不影响后缀。 */
  const align = stripComments(read('skins', 'codex-ink', 'sidebar-align.css'));
  assert(!align.includes(':has(> svg)'), '新会话对齐修正又退回 :has(> svg)');
  let host = null;
  try { host = openHost(); } catch { return '0 条 :has()（宿主不可读，未做类名对账）'; }
  const sidebar = host.read('@deepseek-ai/dsh-client-ui-sidebar/lib/client.js');
  if (sidebar === null) return '0 条 :has()（本机无 dsh-client-ui-sidebar，只作信息）';
  assert(/_collapsed/.test(sidebar), '宿主侧栏已没有 _collapsed 类 —— 侧栏根锚点会静默失效');
  assert(/_newSessionContent/.test(sidebar) && /_newSessionContent\{[^}]*100cqw/.test(sidebar),
    '宿主侧栏已没有 _newSessionContent 或它不再带 width:100cqw —— 对齐修正会打空');
  return '0 条 :has() · _collapsed 与 _newSessionContent 均在宿主中' ;
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
  assert(picker.ratioOffset(0, width) === picker.THUMB_SIZE / 2 && picker.ratioOffset(1, width) === width - picker.THUMB_SIZE / 2,
    '拇指行程不是 [THUMB_SIZE/2, 宽 − THUMB_SIZE/2]（当前 THUMB_SIZE=' + picker.THUMB_SIZE + '）');
  return '4 档 · 行程 [' + picker.THUMB_SIZE / 2 + ', ' + (width - picker.THUMB_SIZE / 2) + ']';
});

/* ── 7b. 保留组件基线冻结（T05）───────────────────────────────────────────
   模型选择器与推理强度胶囊是用户明确认可、本轮及后续都不得改造的组件。
   把它们的关键几何钉在 check 里：后续任何改造顺手改了这些值，CI 立刻红，
   而不是等真 GUI 截图才发现。只钉数值，不约束实现方式。 */
attempt('保留组件基线：模型选择器几何被冻结（T05）', () => {
  assert(picker.THUMB_SIZE === 16,
    'THUMB_SIZE 被改成 ' + picker.THUMB_SIZE + '：用户认可的是 16，不得为迎合官方 28px 圆旋钮而改');
  const mp = stripComments(read('skins', 'codex-ink', 'model-picker.css'));
  assert(/\.codex-mp-track\s*\{[^}]*height:\s*30px/.test(mp), '轨道热区高不是 30px —— 保留组件的几何被改动');
  assert(/\.codex-mp-track::before\s*\{[^}]*height:\s*26px[^}]*border-radius:\s*8px/.test(mp),
    '轨道槽不是 26px / 圆角 8px —— 保留组件的几何被改动');
  assert(mp.includes('width: calc(8px + (100% - 16px) * var(--codex-mp-pos, 0));'),
    '填充宽公式不是 THUMB_SIZE/2 那条 —— 保留组件的几何被改动');
  assert(mp.includes('.codex-mp-matrix-sq'), '顶档点阵被移除（用户明确要求保留）');
  const comp = read('src', 'client', 'model-picker', 'component.js');
  assert(comp.includes("tick.style.left = 'calc(' + THUMB_SIZE / 2 + 'px + (100% - ' + THUMB_SIZE + 'px) * '"),
    '档位点位的像素公式与 THUMB_SIZE 脱钩');
  return 'THUMB_SIZE=16 · 轨热区 30px · 槽 26px/圆角 8px · 填充 8px+(100%−16px)×pos · 顶档点阵在';
});

/* ── 7c. 导航降级安全（T06 / UX-08 回归护栏）─────────────────────────────
   页签条的隐去必须受「出口就绪」门控：只有 trajectory-exit.js 确认能找回对话页签
   时才盖 body[data-codex-ui-te-ready]。否则一旦模块认不出页签（未知语言 / DOM 漂移 /
   压根没装上），用户进了轨迹就出不来。这里钉住这个不变量。 */
attempt('导航降级安全：页签隐去受出口门控（T06 / UX-08）', () => {
  const patches = stripComments(read('skins', 'codex-ink', 'patches.css'));
  const ungated = patches.split('\n')
    .filter((l) => l.includes('[data-conversation-tabs]') && !l.includes('data-codex-ui-te-ready'));
  assert(ungated.length === 0, '存在不受门控的页签规则（出口不可用时用户会无路可退）：' + ungated.slice(0, 2).join(' | '));
  const te = read('src', 'client', 'trajectory-exit.js');
  assert(te.includes('TE_READY_ATTR'), 'trajectory-exit.js 没有用出口就绪标记');
  assert(/setReady\(target !== null\)/.test(te), 'trajectory-exit.js 没有按「能否找回对话页签」开关就绪标记');
  assert(te.includes('setReady(false)'), 'trajectory-exit.js 的清理路径没撤就绪标记（卸载后会留下被隐藏的页签）');
  return '页签隐去挂在 body[data-codex-ui-te-ready] 下，认不出页签即保持可见';
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

/* ── 8b. T08 文本与弹层（UX-13 / UX-14）回归护栏 ─────────────────────────
   三条都是「防止有人把刚修掉的问题改回来」：全局 a 重新被染成 accent、UI 标签重新被强制等宽、
   正文链接的作用域被删掉。判据与 scripts/specs/text.mjs 的 TX-01/02/04 对齐。 */
const patchesCss = stripComments(read('skins', 'codex-ink', 'patches.css'));

attempt('链接：全局 a 不得被强制染 accent（UX-13 / TX-01）', () => {
  /* 顶层裸选择器 `a { ... }` 里的 color 只能是 inherit / currentColor —— 出现 --dsw-alias-link 即为回归。 */
  const bareA = patchesCss.match(/^a\s*\{([^}]*)\}/m);
  assert(bareA !== null, '找不到顶层 a 规则（② 链接）');
  const color = (bareA[1].match(/(?:^|;)\s*color\s*:\s*([^;]+)/) ?? [])[1] ?? '';
  assert(!/var\(--dsw-alias-link\)/.test(color), '顶层 a 又被染成 alias-link：' + color.trim());
  assert(/inherit|currentColor/.test(color), '顶层 a 的 color 应为 inherit/currentColor，实为：' + color.trim());
  return color.trim();
});

attempt('链接：正文语境必须有自己的作用域规则（UX-13 / TX-02）', () => {
  const scoped = [...patchesCss.matchAll(/\[data-dsh-part="(?:prose|article)"\]\s+a/g)];
  assert(scoped.length >= 2, '正文链接作用域规则不足（prose/article 各一条）：' + scoped.length + ' 处');
  const block0 = patchesCss.slice(patchesCss.indexOf('[data-dsh-part="prose"] a'), patchesCss.indexOf('[data-dsh-part="prose"] a') + 400);
  assert(/var\(--dsw-alias-link\)/.test(block0), '正文作用域里没有 alias-link（TX-02 反了）');
  return scoped.length + ' 处';
});

attempt('元信息：UI 标签不得被强制等宽（UX-14 / TX-04）', () => {
  /* 上一版把 tag-chip / tag-badge / composer-chip 一起塞进 font-family: var(--dsw-font-meta)。
     现在只有 chip / ref 是等宽的；三个 UI 标签出现即回归。 */
  const offenders = ['tag-chip', 'tag-badge', 'composer-chip'].filter((part) => {
    const re = new RegExp('[^\\n]*\\[data-dsh-part="' + part + '"\\][^\\n]*', 'g');
    return [...patchesCss.matchAll(re)].some((m) => /font-family\s*:\s*var\(--dsw-font-meta\)/.test(m[0]));
  });
  assert(offenders.length === 0, '又被强制等宽：' + offenders.join(', '));
  const kept = ['chip', 'ref'].filter((part) => new RegExp('font-family\\s*:\\s*var\\(--dsw-font-meta\\)').test(patchesCss));
  assert(kept.length > 0, '连真 chip 的等宽也没了');
  return '等宽保留：' + kept.join('/') + '；UI 标签不强制';
});

/* ── 8c. T14 漂移与能力检测（并入现有设施，不建第二条宿主解析路径）────
   按方案 §8 的 T14：关键锚点缺失就**明确失败**，未知包只作信息。
   宿主来源仍走 scripts/lib/host.mjs 的 openHost()（DSH_ASAR / DSH_GLOBAL_MODULES / 扫描三选一，
   显式给了不存在的路径直接报错）—— 不新建 scripts/audit-host.mjs。
   宿主读不到时（CI 无宿主、路径没配）整节 SKIP，不 FAIL：漂移检测是加分项，不能变成 CI 红线。 */
attempt('T14 宿主锚点：皮肤依赖的契约仍存在', () => {
  let host;
  try {
    host = openHost();
  } catch (e) {
    return 'SKIP 宿主不可读（' + String(e.message).split('\n')[0].slice(0, 80) + '）';
  }
  /* 皮肤真正依赖的宿主锚点。每一项都能在皮肤源码里找到对应选择器 —— 不是凭印象列的。
     缺任何一项都意味着皮肤会静默失效（样式不命中），按 T14 判 FAIL。 */
  /* 包名是**实测**出来的，不是照着名字推的：
       data-sidebar-right-panel 在 dsh-client-ui-sidebar-right（不是 -layout）
       settings.section 由各 dsh-client-ui-settings-* 子页注册（不是 -settings）
       data-side 在 dsh-client-ui-conversation（侧栏/右栏两条分界柄）
     第一版把 layout / settings 当成归属，T14 立刻报"漂移"——那是本表写错，不是宿主变了。 */
  const ANCHORS = [
    ['@deepseek-ai/dsh-client-ui-conversation/lib/client.js', ['data-composer-card', 'data-conversation-scroll', 'data-conversation-tabs', 'data-lexical-editor', 'data-side']],
    /* 会话流容器在 -chat 包（-conversation 里没有），另有更精确的 data-chat-flow-kind（user/steering/…）。 */
    ['@deepseek-ai/dsh-client-ui-chat/lib/client.js', ['data-chat-flow', 'data-chat-flow-kind']],
    ['@deepseek-ai/dsh-client-ui-sidebar-right/lib/client.js', ['data-sidebar-right-panel', 'data-sidebar-right-guide', 'data-sidebar-right-toggle']],
    ['@deepseek-ai/dsh-client-ui-settings-general/lib/client.js', ['settings.section']],
    ['@deepseek-ai/dsh-client-ui-model-selection/lib/client.js', ['conversation.input.model']],
    ['@deepseek-ai/dsh-client-ui-tool/lib/client.js', ['data-tool', 'data-state', 'data-variant', 'data-chat-call-id']],
    ['@deepseek-ai/dsh-client-ui-input-trigger/lib/client.js', ['data-trigger-menu']],
    ['@deepseek-ai/dsh-client-ui-approval/lib/client.js', ['data-approval-key']],
    ['@deepseek-ai/dsh-client-ui-user-questions/lib/client.js', ['data-question-key']],
    /* T10 补做的后续消息队列：皮肤 composer-queue.css 依赖它。
       归属是实测的 —— QueueDock 渲染代码 jsx("div",{ "data-queue-dock":"" })，
       与 composer 在同一个包里（dsh-client-ui-conversation），不是独立包。 */
    ['@deepseek-ai/dsh-client-ui-conversation/lib/client.js', ['data-queue-dock', 'data-composer-input', 'data-composer-composing']],
  ];
  const missing = [];
  const info = [];
  let scanned = 0;
  for (const [pkg, attrs] of ANCHORS) {
    let srcText = null;
    try { srcText = host.read(pkg); } catch { srcText = null; }
    if (srcText === null) { info.push(pkg.replace('@deepseek-ai/', '')); continue; }
    scanned += 1;
    for (const a of attrs) {
      if (!srcText.includes(a)) missing.push(pkg.replace('@deepseek-ai/', '') + ' → ' + a);
    }
  }
  assert(missing.length === 0, '宿主已漂移，皮肤会静默失效：' + missing.join('；'));
  return '已扫 ' + scanned + '/' + ANCHORS.length + ' 个包'
    + (info.length > 0 ? '；本机没有这些包（只作信息）：' + info.join(', ') : '');
});

/* ── 8d. T07 高频内容（⑲ content.css）回归护栏 ──────────────────────────
   三条防回退：① 状态词表必须与宿主类型声明对齐（漏一档就有一类内容没样式）；
   ② 不得引用不存在的令牌（写成 --dsw-font-code 会被浏览器丢弃整条声明、静默回落 UI 字体，
      实测代码块就是这样丢掉了等宽）；③ 失败态必须真的可识别（有状态条 + 有徽标），不能只剩红字。 */
const contentCss = stripComments(read('skins', 'codex-ink', 'content.css'));
const skinCssRaw = read('skins', 'codex-ink', 'skin.css');

attempt('内容：状态词表与宿主 ToolRowState 对齐（T07）', () => {
  /* 权威判据 = dsh-client-ui-tool/lib/types/tool-call-model.d.ts 的 ToolRowState 联合。
     宿主读不到时（CI 无宿主）只校验皮肤侧五档齐全，不判 FAIL。 */
  const REQUIRED = ['preparing', 'running', 'ok', 'error', 'stopped'];
  const missing = REQUIRED.filter((s) => !contentCss.includes('data-state="' + s + '"'));
  assert(missing.length === 0, '皮肤没覆盖这些状态：' + missing.join(', '));
  let host = null;
  try { host = openHost(); } catch { return '皮肤侧五档齐全（宿主不可读，未做双向对账）'; }
  /* 路径里有 client/tool/models/ 三层 —— 第一版写成 lib/types/tool-call-model.d.ts，
     host.read() 返回 null，护栏静默降级成"未找到"、双向对账根本没跑。
     降级不能掩盖路径写错，所以这里直接 assert 而不是 return。 */
  const dts = host.read('@deepseek-ai/dsh-client-ui-tool/lib/types/client/tool/models/tool-call-model.d.ts');
  assert(dts !== null, '读不到宿主的 tool-call-model.d.ts —— 路径又变了，护栏会静默失效');
  /* 只取 ToolRowState 那一行的字面量，别把 variant 联合也吸进来。 */
  const line = (dts.match(/type\s+ToolRowState\s*=\s*([^;]+);/) ?? [])[1];
  assert(line !== undefined, '宿主的 tool-call-model.d.ts 里没有 ToolRowState 联合类型');
  const hostStates = new Set([...line.matchAll(/'([a-z]+)'/g)].map((m) => m[1]));
  const extra = REQUIRED.filter((s) => !hostStates.has(s));
  assert(extra.length === 0, '皮肤覆盖了宿主没有的状态：' + extra.join(', '));
  const uncovered = [...hostStates].filter((s) => !REQUIRED.includes(s));
  assert(uncovered.length === 0, '宿主有这些状态但皮肤没覆盖：' + uncovered.join(', '));
    return '皮肤五档 ⊆ 宿主 ToolRowState（宿主共 ' + hostStates.size + ' 个字面量）';
});

attempt('内容：不得引用 skin.css 里不存在的令牌（T07）', () => {
  /* 教训：content.css 第一版写 var(--dsw-font-code)，skin.css 里没有这个令牌，
     浏览器丢弃整条声明、代码块静默回落 UI 字体，verify 直接测出来。 */
  const declared = new Set([...skinCssRaw.matchAll(/(--dsw-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  const used = new Set([...contentCss.matchAll(/var\((--dsw-[a-z0-9-]+)\)/g)].map((m) => m[1]));
  /* 宿主令牌（--dsh-*）与宿主自带的（--ds-*）不在 skin.css 里声明，不参与对账。 */
  const unknown = [...used].filter((t) => !declared.has(t) && !t.startsWith('--dsh-') && !t.startsWith('--ds-'));
  assert(unknown.length === 0, '引用了 skin.css 未声明的令牌：' + unknown.join(', '));
  return used.size + ' 个令牌全部有定义';
});

attempt('内容：失败态可识别（状态条 + 徽标，不是只有红字）（T07）', () => {
  assert(/\[data-tool\]\[data-state="error"\][\s\S]{0,400}?box-shadow/.test(contentCss),
    '失败态没有状态条 —— 与成功态同色就等于没有状态');
  assert(/\[data-tool\]\[data-state="stopped"\]/.test(contentCss),
    '停止态没单独处理（被取消与出错不能长得一样）');
  assert(/data-tone="error"/.test(contentCss), '没有 data-tone 的映射');
  return 'error 红条 / stopped 中性条 / ok 无条';
});

/* ── 8e. T07 等待态与状态点护栏 ──────────────────────────────────────────
   一条真实的坑：data-state 这个属性名在宿主里有**两套互不相同的词表**——
     · ToolRow 的 data-state   = preparing | running | ok | error | stopped
     · StateDot 的 data-state  = done | warning | ongoing | error | idle
   实测同屏出现过 STATES = ["idle","ok","running","warning"]，就是两套混在一起。
   如果 ⑲ 里写一条裸的 [data-state="error"]，就会把状态点也涂成行文字色。
   下面这条断言把「所有 [data-state] 选择器都必须带宿主锚点前缀」钉死。 */
attempt('内容：不得用裸的 [data-state] 选择器（两套词表同名，会误伤 StateDot）', () => {
  const bare = [...contentCss.matchAll(/^[^\n{}]*\[data-state=/gm)]
    .map((m) => m[0].trim())
    /* 允许的属性锚点前缀：工具行（tool/sample）、回合（turn-process）、审批与提问卡。 */
    .filter((line) => !/\[data-(tool|sample|turn-process|approval-key|question-key)/.test(line));
  assert(bare.length === 0, '这些 [data-state] 规则没带宿主锚点前缀，会命中 StateDot：\n    ' + bare.join('\n    '));
  return contentCss.split('\n').filter((l) => /\[data-state=/.test(l)).length + ' 条规则全部带锚点前缀';
});

attempt('内容：等待态三类必须齐全（审批 / 提问 / 目标）', () => {
  for (const [anchor, why] of [
    ['data-approval-key', '审批卡：球在用户手里，必须与"进行中"区分'],
    ['data-question-key', '提问卡：同上'],
    ['data-goal-bar', '目标条：常驻状态条'],
    ['data-command-input', '命令输入：随目标条出现'],
  ]) {
    assert(contentCss.includes(anchor), '缺 ' + anchor + ' —— ' + why);
  }
  return '审批 / 提问 / 目标 / 命令输入 四类锚点均已处理';
});

/* ── 8f. 锚点归属护栏：宿主锚点 vs skin-center 适配器锚点 ────────────────
   实测结论（扫 83 个宿主 client.js）：**data-dsh-part 出现 0 次**。
   也就是说宿主自己从不打 data-dsh-part —— 那个键是 skin-center 适配器补的。
   后果：只写 [data-dsh-part="xxx"] 的规则，在**纯宿主**组合下永不命中；
   而 codex-ui 的日常组合恰好是"宿主 + 第三方主题"，有没有适配器不确定。
   所以凡是皮肤真正依赖的锚点，必须同时有一条**宿主真有的**锚点可选。
   下面这条把已经查清归属的几个写死，防止后来者继续凭名字猜。 */
attempt('锚点归属：data-dsh-part 宿主不打，真锚点必须另有一条', () => {
  let host = null;
  try { host = openHost(); } catch { return 'SKIP 宿主不可读'; }
  /* 抽查三个已确认归属的：宿主真有的锚点。 */
  const PROVEN = [
    ['@deepseek-ai/dsh-client-ui-conversation/lib/client.js', ['data-composer-chip', 'data-conversation-scroll']],
    ['@deepseek-ai/dsh-client-ui-input-trigger/lib/client.js', ['data-trigger-menu', 'data-source', 'data-overflow-below']],
    ['@deepseek-ai/dsh-client-ui-approval/lib/client.js', ['data-approval-key']],
    ['@deepseek-ai/dsh-client-ui-user-questions/lib/client.js', ['data-question-key', 'data-question-reply']],
    ['@deepseek-ai/dsh-client-ui-tool/lib/client.js', ['data-tool', 'data-state', 'data-variant']],
  ];
  const bad = [];
  for (const [pkg, attrs] of PROVEN) {
    const text = host.read(pkg);
    if (text === null) continue;
    for (const a of attrs) if (!text.includes(a)) bad.push(pkg.replace('@deepseek-ai/', '') + ' → ' + a);
  }
  assert(bad.length === 0, '这些宿主锚点查不到了：' + bad.join('；'));

  /* 反向：content.css 里凡是只靠 data-dsh-part 的组件，必须另有宿主锚点。 */
  const all = read('skins', 'codex-ink', 'content.css');
  const NEED_PARTNER = [
    { part: 'composer-chip', partner: '[data-composer-chip]', why: '宿主 createDOM 写的是 el.setAttribute("data-composer-chip", source)' },
  ];
  const orphans = NEED_PARTNER.filter(({ partner }) => !all.includes(partner));
  assert(orphans.length === 0,
    '这些组件只剩 data-dsh-part 一条路（纯宿主下永不命中）：'
    + orphans.map((o) => o.part + ' 缺 ' + o.partner).join('；'));
  return '5 个包的真锚点均在；composer-chip 有宿主锚点兜底';
});

/* ── 9. 文档成对 ──────────────────────────────────────────────────────── */
attempt('双语文档成对', () => {
  for (const f of ['README.md', 'README.zh-CN.md', 'CHANGELOG.md', 'CHANGELOG.zh-CN.md', 'skins/codex-ink/README.md', 'skins/codex-ink/README.zh-CN.md']) {
    assert(fs.existsSync(join(ROOT, f)), '缺少 ' + f);
  }
});

/* ── 9b. 可选 spec 纪律 ───────────────────────────────────────────────────
   verify.mjs 的 OPT_IN 把某些 spec 排除在默认全量之外。这是一把双刃剑：不加护栏，
   它会变成「把没过的东西藏起来」的万能借口。所以钉死三条：
     ① 排除项必须真实存在（写错名字等于静默不生效）；
     ② 排除项必须**真的**有断言（空壳 spec 占位没有意义）；
     ③ 排除项必须在 docs/ 里有对应提案，否则等于没有归口。
   豁免只对「根因在宿主、本仓库改不动」成立；皮肤自己的失败一律不许进这张表。 */
attempt('可选 spec：排除项存在、有断言、且有宿主提案归口', () => {
  const verifySrc = read('scripts', 'verify.mjs');
  const m = /const OPT_IN = new Set\(\[([^\]]*)\]\)/.exec(verifySrc);
  assert(m !== null, 'verify.mjs 里找不到 OPT_IN 集合');
  const names = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  assert(names.length > 0, 'OPT_IN 是空的 —— 机制没有实际用途，删掉它');
  const bad = [];
  for (const name of names) {
    const file = join(ROOT, 'scripts', 'specs', name + '.mjs');
    if (!fs.existsSync(file)) { bad.push(name + '（spec 不存在，OPT_IN 写错了名字）'); continue; }
    const src = fs.readFileSync(file, 'utf8');
    if (!/t\.(check|attempt)\(/.test(src)) bad.push(name + '（没有任何断言，是个空壳）');
    if (!/host-proposal/.test(src)) bad.push(name + '（没在文件里引用 host-proposal，缺归口）');
  }
  const proposals = listFiles(join(ROOT, 'docs'), ['.md']).filter((f) => /host-proposal/.test(f.split(/[\\/]/).pop()));
  assert(bad.length === 0, bad.join('；'));
  return names.length + ' 个排除项 · 提案 ' + proposals.length + ' 份：' + names.join(' ');
});
/* ── 10. 文本编码 ─────────────────────────────────────────────────────── */
attempt('文本为无 BOM 的 UTF-8', () => {
  const files = [...jsFiles, ...listFiles(ROOT, ['.md', '.css', '.json', '.yml', '.log'])];
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
  const files = [...jsFiles, ...listFiles(ROOT, ['.css', '.md', '.log', '.json'])];
  const hits = files.flatMap((file) => [...fs.readFileSync(file, 'utf8').matchAll(bad)].map((m) => rel(file) + ' → ' + m[0]));
  assert(hits.length === 0, hits.join('；'));
  return files.length + ' 个文件';
});

summarize(results);
