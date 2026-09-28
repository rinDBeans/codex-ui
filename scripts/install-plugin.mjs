#!/usr/bin/env node
/**
 * install-plugin.mjs — 把 <workbench>/plugin/codex-ui 安装进某个 profile（默认 web）。
 *
 * 做四件事（默认只读体检，--write 才落盘）：
 *   1. 调 src/build.mjs，把 skins/codex-ink 的五份样式作用域化到 html[data-codex-ui]，
 *      写成 plugin/codex-ui/theme.css；
 *   2. 把同一份 CSS 内嵌进 client.template.js，写成 plugin/codex-ui/client.js；
 *   3. 在 profiles/<name>/node_modules 建立指向插件目录的 junction，使其可按包名解析；
 *   4. 在 profiles/<name>/cordis.patch.yml 里确保存在 insert 条目（按 id 幂等）。
 *
 * 用法：
 *   node scripts/install-plugin.mjs                       # 只读体检（默认 web profile）
 *   node scripts/install-plugin.mjs --write               # 落盘
 *   node scripts/install-plugin.mjs --profile desktop --write
 *   node scripts/install-plugin.mjs --bundle --write      # 把包名写进 dsh.profile.bundles（并清掉冗余 insert）
 *
 * --profile <name> 选目标 profile（默认 web）。桌面壳（Electron）的 profile 名是
 * desktop；它由 Electron 独占，CLI 的 `dsh plugin --profile desktop` 会被硬拒绝，
 * 所以桌面端只能走本脚本直接落文件，改完需重启应用才生效。
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { build, SKIN_PARTS } from '../src/build.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const WB = dirname(HERE);
const PLUGIN_DIR = WB;
const HOME = process.env.DSH_HOME && process.env.DSH_HOME.trim() !== '' ? process.env.DSH_HOME : join(homedir(), '.dsh');
/** 目标 profile 名：--profile <name>，缺省 web。 */
const PROFILE_NAME = (() => {
  const i = process.argv.indexOf('--profile');
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  return v !== undefined && v.trim() !== '' ? v.trim() : 'web';
})();
const PROFILE = join(HOME, 'profiles', PROFILE_NAME);
const INSTALL_DIR = join(PROFILE, 'vendor', 'codex-ui');
const LINK = join(PROFILE, 'node_modules', 'codex-ui');
const PROFILE_PKG = join(PROFILE, 'package.json');
/** 装到 profile 的文件（client.template.js 是源码，不装）。 */
const SHIPPED = ['package.json', 'index.js', 'cordis.patch.yml', 'client.js', 'theme.css'];
const PATCH = join(PROFILE, 'cordis.patch.yml');
const write = process.argv.includes('--write');
/** --bundle：把包名写进 profile 的 dsh.profile.bundles，而不是往 patch 里手写 insert。 */
const wantBundle = process.argv.includes('--bundle');
/* 去 BOM：PowerShell 的 Set-Content -Encoding UTF8 会写 BOM，JSON.parse 见到它会直接抛。 */
let pkgText = fs.readFileSync(PROFILE_PKG, 'utf8').replace(/^\uFEFF/, '');

/**
 * 把 codex-ui 追加进 dsh.profile.bundles，保留原文件的缩进与顺序。
 * @param text - profile package.json 原文。
 * @returns 新文本；已经在数组里则返回 null。
 */
function addToBundles(text) {
  const bundles = JSON.parse(text)?.dsh?.profile?.bundles;
  if (!Array.isArray(bundles)) throw new Error('profile 没有 dsh.profile.bundles 数组：' + PROFILE_PKG);
  if (bundles.includes('codex-ui')) return null;
  const open = text.indexOf('[', text.indexOf('"bundles"'));
  let depth = 0;
  let i = open;
  for (; i < text.length; i += 1) {
    if (text[i] === '[') depth += 1;
    else if (text[i] === ']') { depth -= 1; if (depth === 0) break; }
  }
  /* 闭合方括号前的空白先摘掉：数组末尾本来就没有逗号，靠它判断要不要补。 */
  const head = text.slice(0, i).trimEnd();
  const tail = text.slice(i);
  const next = head + (head.endsWith('[') ? '' : ',') + '\n        "codex-ui"\n      ' + tail;
  JSON.parse(next); /* 兜底：写坏 JSON 就当场抛，别落盘 */
  return next;
}
/**
 * 往 profile 的 cordis.patch.yml 追加一个块式（`- insert:`）列表项。
 *
 * dsh 0.1.7-rc.2 新建 profile 时写进去的是**流式空列表** `[]`（前面三行注释）。
 * 直接在它后面接 `- insert:` 会得到「流式节点 + 块式序列」两个顶层节点，YAML 解析失败，
 * `dsh web` 在 boot 阶段就抛 `failed to parse overlay ... cordis.patch.yml`，整个实例起不来。
 * 所以：空的 `[]` 先摘掉再追加；非空的流式列表无法安全续写，直接拒绝，让人手动改。
 * @param text - 原文。
 * @param block - 以换行开头的块式列表项文本。
 * @returns 新文本。
 */
function appendBlockList(text, block) {
  const lines = text.split(/\r?\n/);
  const content = lines.filter((line) => line.trim() !== '' && !line.trim().startsWith('#'));
  if (content.some((line) => line.trim().startsWith('[') && !/^\[\s*\]$/.test(line.trim()))) {
    throw new Error(PATCH + ' 是非空的流式列表（[...]），无法安全追加块式条目；请改成块式 `- ` 列表后重跑。');
  }
  const kept = lines.filter((line) => !/^\s*\[\s*\]\s*$/.test(line));
  return kept.join(text.includes('\r\n') ? '\r\n' : '\n').replace(/\s*$/, '') + block;
}

if (wantBundle) {
  if (!write) {
    console.log('BUNDLE  : 计划把 codex-ui 写进 dsh.profile.bundles（--write 才落盘）');
  } else {
    const next = addToBundles(pkgText);
    if (next === null) console.log('BUNDLE  : 已在 dsh.profile.bundles 中，跳过');
    else { fs.writeFileSync(PROFILE_PKG, next); pkgText = next; console.log('BUNDLE  : 已写入 dsh.profile.bundles'); }
  }
}

/* ── 生成 ──────────────────────────────────────────────────────────────── */
/* 作用域化与拼装只有一份实现，在 src/build.mjs；安装产物与 CI 校验同源。 */
const { themeCss, clientJs, sources, scopedBytes, hashAnchors } = build();
const sourceBytes = Object.values(sources).reduce((a, b) => a + b, 0);

/* ── 报告 ──────────────────────────────────────────────────────────────── */
console.log('profile  : ' + PROFILE);
console.log('plugin   : ' + PLUGIN_DIR);
console.log('css      : 源 ' + sourceBytes + ' B → 作用域化 ' + scopedBytes + ' B');
/* 哈希类名计数：patches.css 禁 [class*=…]，本层按上游移植放行——把账摊开，不藏着。 */
console.log('hash 锚点: ' + SKIN_PARTS.map(([f]) => f.replace('.css', '') + '=' + hashAnchors[f]).join(' '));
console.log('client.js: ' + clientJs.length + ' B');
console.log('link     : ' + LINK);
console.log('patch    : ' + PATCH);
const patchText = fs.readFileSync(PATCH, 'utf8');
/**
 * 注册方式二选一，绝不能同时用 —— 这是本插件最容易踩的坑：
 *   bundle 路径：包名写进 profile package.json 的 dsh.profile.bundles，
 *                由包自带 cordis.patch.yml 完成 insert（dshmarket 市场走这条）；
 *   insert 路径：在 profile 的 cordis.patch.yml 里手写 - insert:
 *                （web profile 走这条：免 pnpm install、改完即热加载）。
 * 两条同时存在 → loader 出现两个同名条目，市场校验判 fail 并直接把插件停用，
 * 日志原话：duplicate loader entry id "codex-ui" (2 rows) / 重复的 loader 条目 id "codex-ui"。
 */
const inBundles = (() => {
  try {
    return (JSON.parse(pkgText)?.dsh?.profile?.bundles ?? []).includes('codex-ui');
  } catch {
    return false;
  }
})();
/** profile patch 里 codex-ui 的冗余 - insert: 块数量（inBundles 时全部冗余）。 */
const dupInserts = (() => {
  const lines = patchText.split(/\r?\n/);
  let n = 0;
  for (let i = 0; i < lines.length - 2; i += 1) {
    if (lines[i].trim() === '- insert:' && (lines[i + 1] ?? '').trim() === '- id: codex-ui') n += 1;
  }
  return n;
})();
/* 允许缩进：insert 块里的 "- id: codex-ui" 带 4 空格缩进。 */
const registered = inBundles || /^\s*-\s*id:\s*['"]?codex-ui['"]?\s*$/m.test(patchText);
console.log('注册方式: ' + (inBundles ? 'bundle（package.json 的 dsh.profile.bundles）' : 'insert（profile cordis.patch.yml）'));
console.log('patch 条目: ' + (registered ? '已注册' : '缺失（--write 时补）') +
  (dupInserts > 0 ? '；- insert: 块 ' + dupInserts + ' 处' + (inBundles ? '（与 bundle 冲突，冗余，--write 时清除）' : '') : ''));

if (!write) {
  console.log('\nDRY RUN：加 --write 落盘（生成 client.js / theme.css / junction / patch 条目）');
  process.exit(registered ? 0 : 1);
}

fs.writeFileSync(join(PLUGIN_DIR, 'theme.css'), themeCss);
fs.writeFileSync(join(PLUGIN_DIR, 'client.js'), clientJs);
console.log('WROTE client.js + theme.css');

// 同步到 profile 的 vendor/（正本仍在 workbench；vendor 是安装副本）
fs.mkdirSync(INSTALL_DIR, { recursive: true });
for (const name of SHIPPED) {
  fs.copyFileSync(join(PLUGIN_DIR, name), join(INSTALL_DIR, name));
}
console.log('SYNCED ' + SHIPPED.length + ' 个文件 → ' + INSTALL_DIR);

// node_modules/codex-ui → vendor/codex-ui（按包名可解析；不跑 pnpm）
const linkTarget = fs.existsSync(LINK) ? fs.realpathSync.native(LINK) : null;
if (linkTarget !== INSTALL_DIR) {
  if (linkTarget !== null) {
    execFileSync('powershell.exe', ['-NoProfile', '-Command', `Remove-Item -LiteralPath '${LINK}' -Force -Recurse`], { stdio: 'inherit' });
  }
  fs.mkdirSync(dirname(LINK), { recursive: true });
  execFileSync('powershell.exe', ['-NoProfile', '-Command',
    `New-Item -ItemType Junction -Path '${LINK}' -Target '${INSTALL_DIR}' | Out-Null`], { stdio: 'inherit' });
  console.log('LINKED ' + LINK + ' → ' + INSTALL_DIR);
} else {
  console.log('junction 已指向 vendor，跳过');
}

// profile package.json 声明 link 依赖（让将来的 pnpm install 能重建这个链接）
if (!pkgText.includes('"dependencies"') || !/"codex-ui"\s*:/.test(pkgText)) {
  /* 空 dependencies 时不能补尾逗号，否则写出非法 JSON —— 分两支插。 */
  const EMPTY_DEPS = /("dependencies"\s*:\s*\{)\s*\}/;
  const patched = EMPTY_DEPS.test(pkgText)
    ? pkgText.replace(EMPTY_DEPS, '$1\n    "codex-ui": "link:./vendor/codex-ui"\n  }')
    : pkgText.replace(/("dependencies"\s*:\s*\{)/, '$1\n    "codex-ui": "link:./vendor/codex-ui",');
  JSON.parse(patched);
  fs.writeFileSync(PROFILE_PKG, patched);
  console.log('DECLARED "codex-ui": "link:./vendor/codex-ui" 到 profile package.json');
} else {
  console.log('profile package.json 已声明，跳过');
}

/**
 * 先清除冗余 - insert: 块 —— 但仅在 bundle 路径已覆盖时。
 * inBundles 为假时这段 insert 是唯一的注册来源，删掉等于把插件摘掉（web profile 就是这种形状）。
 */
if (inBundles) {
  const lines = patchText.split(/\r?\n/);
  let removed = 0;
  for (let i = 0; i < lines.length - 2; i += 1) {
    if (lines[i].trim() === '- insert:' && (lines[i + 1] ?? '').trim() === '- id: codex-ui') {
      lines.splice(i, 3);
      removed += 1;
      i -= 1;
    }
  }
  if (removed > 0) {
    fs.writeFileSync(PATCH, lines.join(patchText.includes('\r\n') ? '\r\n' : '\n'));
    console.log('REMOVED ' + removed + ' 处冗余 - insert: 块（bundle 路径已覆盖）');
  }
}

if (!registered) {
  if (inBundles) {
    console.log('已在 dsh.profile.bundles 中，无需 patch 条目');
  } else {
    const block = [
      '',
      '# codex-ui：独立的 Codex 化客户端插件（自带样式表，不依赖 dsh-web-all 皮肤系统）',
      '# 注意：本 profile 未把 codex-ui 列进 dsh.profile.bundles，故此处手写 insert。',
      '# 若将来它被列入 bundles，必须删掉本块 —— 两条同时存在会造成重复 loader 条目 id。',
      '- insert:',
      "    - id: codex-ui",
      "      name: 'codex-ui'",
      '',
    ].join('\n');
    fs.writeFileSync(PATCH, appendBlockList(fs.readFileSync(PATCH, 'utf8'), block));
    console.log('APPENDED patch entry 到 cordis.patch.yml');
  }
} else if (inBundles) {
  console.log('patch 条目已由 bundle 提供，跳过');
} else {
  console.log('patch 条目已存在，跳过');
}
console.log('\nOK：插件已安装（若未自动热加载，重启 dsh web 生效）');
