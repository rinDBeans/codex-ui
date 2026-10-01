#!/usr/bin/env node
/**
 * verify.mjs — 夹具验收：宿主真实 shipped 样式 + 按宿主渲染代码复刻的 DOM + 本插件样式 / 组件，
 * 在无头 Chromium 里读计算样式、几何与像素，逐条断言。
 *
 *   node scripts/verify.mjs [spec…] [--host <app.asar | node_modules>] [--shots <目录>] [--verbose]
 *
 * spec 即 scripts/specs/<名>.mjs，不写就全跑。每个 spec 默认导出 { 小节名: async (t) => … }，
 * 每个小节独占一个浏览器进程（悬停态只在前台页签里算，小节之间不能共用）。
 * 宿主来源与浏览器见 lib/host.mjs；截图默认写进系统临时目录，--shots 指定别处（例如 assets/screenshots）。
 *
 * 为什么是夹具而不是截真 GUI：launch token 只在宿主进程内存里，桌面壳的 profile 又被 Electron 独占。
 * 真 GUI 的验收在 scripts/live/。
 */
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SKIN_DIR, SKIN_PARTS, scopeCss, stripComments } from './build.mjs';
import { launch, sleep } from './lib/cdp.mjs';
import { checklist, summarize } from './lib/checks.mjs';
import { openHost } from './lib/host.mjs';

const SPEC_DIR = join(dirname(fileURLToPath(import.meta.url)), 'specs');

/**
 * 夹具用的皮肤样式：与 build.mjs 同一条管线（去注释 → 作用域化）。before 对照页要「没有某一段的皮肤」，
 * cuts 按**源文件**里的注释标记剪（产物已去注释）：{ 'patches.css': [['⑫ …', '⑬ …']] }，
 * 从 from 所在注释的起点剪到 to 所在注释的起点；to 为 null 剪到文件尾。
 */
function themeCss(cuts = {}) {
  return SKIN_PARTS.map((file) => {
    let src = fs.readFileSync(join(SKIN_DIR, file), 'utf8');
    for (const [from, to] of cuts[file] ?? []) {
      const at = src.indexOf(from);
      const until = to === null ? src.length : src.indexOf(to, at);
      if (at < 0 || until < 0) throw new Error(file + ' 里找不到标记：' + (at < 0 ? from : to));
      if (src.indexOf(from, at + 1) >= 0) throw new Error(file + ' 里标记不唯一：' + from);
      src = src.slice(0, src.lastIndexOf('/*', at)) + src.slice(to === null ? until : src.lastIndexOf('/*', until));
    }
    return scopeCss(stripComments(src));
  }).join('\n');
}

const opts = { host: undefined, shots: join(tmpdir(), 'codex-ui-shots'), verbose: false };
const named = [];
for (let i = 2; i < process.argv.length; i += 1) {
  const a = process.argv[i];
  if (a === '--verbose') opts.verbose = true;
  else if (a === '--host' || a === '--shots') opts[a.slice(2)] = process.argv[++i];
  else named.push(a);
}
const shots = resolve(opts.shots);
const available = fs.readdirSync(SPEC_DIR).filter((f) => f.endsWith('.mjs')).map((f) => basename(f, '.mjs')).sort();
const wanted = named.length === 0 ? available : named;
const unknown = wanted.filter((name) => !available.includes(name));
if (unknown.length > 0) {
  console.error('没有这个 spec：' + unknown.join(' ') + '。可选：' + available.join(' '));
  process.exit(2);
}
fs.mkdirSync(shots, { recursive: true });

let host = null;
const all = [];
const table = [];
for (const spec of wanted) {
  const sections = (await import(pathToFileURL(join(SPEC_DIR, spec + '.mjs')).href)).default;
  for (const [section, run] of Object.entries(sections)) {
    console.log('\n━━ ' + spec + ' / ' + section);
    const { results, check, xfail } = checklist();
    let browser = null;
    const t = {
      check,
      xfail,
      sleep,
      theme: themeCss,
      log: (...args) => { if (opts.verbose) console.log('   ', ...args); },
      /** 宿主只在用到时才打开（elevation / power-rail 不需要宿主）。 */
      get host() {
        if (host === null) {
          host = openHost(opts.host);
          console.log('宿主 ' + host.label);
        }
        return host;
      },
      async page(viewport) {
        browser ??= await launch();
        return browser.newPage(viewport);
      },
      async shot(page, file, clip) {
        const path = join(shots, file);
        await page.screenshot({ path, clip });
        t.log('截图 ' + path);
      },
    };
    try {
      await run(t);
    } catch (e) {
      check(section + ' 运行出错', false, e.stack ?? e.message);
    } finally {
      await browser?.close();
    }
    all.push(...results);
    /* 汇总行同样不把 XFAIL 计入分母，否则「已知宿主缺陷」会把整节标成 FAIL。 */
    const scored = results.filter((r) => !r.xfail);
    const xf = results.length - scored.length;
    table.push([spec, section, scored.filter((r) => r.ok).length, scored.length, xf]);
  }
}

console.log('\n━━ 汇总（截图在 ' + shots + '）');
for (const [spec, section, pass, total, xf] of table) {
  const tail = xf > 0 ? ', ' + xf + ' XFAIL' : '';
  console.log('  ' + (pass === total ? 'PASS' : 'FAIL') + '  ' + (spec + ' / ' + section).padEnd(32) + pass + '/' + total + tail);
}
summarize(all);
