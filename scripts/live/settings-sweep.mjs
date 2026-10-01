#!/usr/bin/env node
/**
 * settings-pages-sweep.mjs — 逐个打开全部设置页，亮/暗各截一张，并做布局健康检查。
 *
 * 用途：设置模态的「全页 Codex 化」改的是内容区（卡片行、页头、留白）。内容区行卡片化用了
 * 结构兜底选择器，**有可能在某些页误伤**（把分组容器 / 表单布局也卡片化，导致表单挤压、控件错位）。
 * 这个脚本就是用来逐页把这件事看清楚的：截图留证 + 自动量一批布局指标。
 *
 * 用法：
 *   node scripts/live/settings-sweep.mjs --url "http://127.0.0.1:3199/?token=..." [--out docs/recon] [--prefix c1] [--min-pages 1]
 *
 * 产物：<out>/<prefix>-<序号>-<页名>-<light|dark>.png + 控制台一份逐页健康报告。
 * 退出码：只有「硬故障」（扫不到设置项 / 打不开页 / 页面空白 / 控件被裁剪到不可用）才非 0；
 *         可疑但需要人眼判断的，只报告不失败。
 *         ⚠️ **扫不到设置项本身就是硬故障**：宿主一定会注册设置项，0 项意味着侧栏没渲染出来
 *         或结构层整体失效。旧版对空列表只是「循环一轮都不跑」→ hardFail 恒为 0 → 退出码 0，
 *         即「什么都没测」却报 PASS，是本脚本最容易骗过 CI 的假阳性路径（二审 M3 指出）。
 *         现在 labels.length === 0（或少于 --min-pages）直接非零退出。
 */
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { chromePath } from '../lib/host.mjs';
/* lib/host.mjs 不导出 tempDir：这里就地生成一个唯一临时 profile 目录。 */
const tempDir = (name) => fs.mkdtempSync(join(tmpdir(), name + '-'));

const HERE = dirname(fileURLToPath(import.meta.url));
const WB = dirname(dirname(HERE));
const arg = (name, fallback) => {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fallback;
};
const TOKEN_URL = arg('url', '');
const OUT_DIR = arg('out', join(WB, 'docs', 'recon'));
const PREFIX = arg('prefix', 'c1');
const CHROME = arg('chrome', '') || chromePath();
const PORT = Number(arg('cdp-port', '9344'));
const DPR = Number(arg('dpr', '1.5'));
/* 期望扫到的设置项下限。宿主一定会注册设置项（通用设置/模型/内置插件…），
   本环境实测 13 项（见 docs/recon/c1-sweep-report.json）；默认 1 已经是「有就行」的最低线，
   要钉住本环境的具体页数就显式传 --min-pages 13。 */
const MIN_PAGES = Number(arg('min-pages', '1'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!TOKEN_URL) { console.error('缺少 --url "http://127.0.0.1:<port>/?token=..."'); process.exit(2); }

const origin = new URL(TOKEN_URL).origin;
const grab = (url) => new Promise((resolve, reject) => {
  const u = new URL(url);
  http.get({ hostname: u.hostname, port: u.port, path: u.pathname + u.search }, (res) => {
    resolve((res.headers['set-cookie'] || [''])[0]);
    res.resume();
  }).on('error', reject);
});
const cookie = (await grab(TOKEN_URL)).split(';')[0];
if (!cookie.includes('=')) { console.error('拿不到 dsh-auth cookie，token 可能已过期：' + TOKEN_URL); process.exit(2); }
fs.mkdirSync(OUT_DIR, { recursive: true });

const child = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + tempDir('dsh-cdp-sweep'), '--no-first-run',
  '--no-default-browser-check', '--disable-gpu', '--window-size=1440,960', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
let info;
for (let i = 0; i < 60 && !info; i += 1) {
  try { const r = await fetch('http://127.0.0.1:' + PORT + '/json/version'); if (r.ok) info = await r.json(); } catch { /* 未就绪 */ }
  if (!info) await sleep(250);
}
if (!info) { console.error('Chromium 没起来：' + CHROME); process.exit(2); }
const ws = new WebSocket(info.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0;
const waiting = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  const fn = waiting.get(m.id);
  if (fn) { waiting.delete(m.id); fn(m); }
};
const send = (method, params = {}, sid) => new Promise((res, rej) => {
  const id = ++seq;
  waiting.set(id, (m) => (m.error ? rej(new Error(method + ': ' + JSON.stringify(m.error))) : res(m.result)));
  ws.send(JSON.stringify({ id, method, params, ...(sid ? { sessionId: sid } : {}) }));
});
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
  if (r.exceptionDetails !== undefined && r.exceptionDetails !== null) {
    throw new Error('页面内求值抛错：' + String(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text).slice(0, 300));
  }
  return r.result.value;
};
const click = async (x, y) => {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }, sessionId);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }, sessionId);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }, sessionId);
};

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, sessionId);
await send('Runtime.enable', {}, sessionId);
await send('Network.enable', {}, sessionId);
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 960, deviceScaleFactor: DPR, mobile: false }, sessionId);
const eq = cookie.indexOf('=');
await send('Network.setCookie', { name: cookie.slice(0, eq), value: cookie.slice(eq + 1), domain: new URL(origin).hostname, path: '/', httpOnly: true }, sessionId);
await send('Page.navigate', { url: origin + '/' }, sessionId);
await sleep(11000);

/** 页面内工具：把布局体检需要的一切都算好返回。自包含，只挂在 window 上。 */
function sweepInstall() {
  const panel = () => document.querySelector('[data-shortcut-modal="settings"]');
  const nav = () => { const p = panel(); return p === null ? null : Array.from(p.children).find((e) => e.tagName === 'NAV') || null; };
  const list = () => {
    const n = nav();
    if (n === null) return null;
    const hit = Array.from(n.children).filter((e) => e.getAttribute('data-codex-ui-injected') !== 'settings-modal').pop();
    return hit === undefined ? null : hit;
  };
  const cells = () => { const l = list(); return l === null ? [] : Array.from(l.children).filter((e) => e.tagName === 'BUTTON'); };
  const content = () => { const p = panel(); return p === null ? null : Array.from(p.children).filter((e) => e.tagName !== 'NAV').pop() || null; };

  /** 当前页名：取内容区里第一个非空文本块。 */
  const pageTitle = () => {
    const c = content();
    if (c === null) return null;
    const t = (c.innerText || '').split('\n').map((s) => s.trim()).find((s) => s !== '');
    return t === undefined ? null : t;
  };
  const items = () => cells().map((el) => el.textContent.trim());

  const openSettings = () => { const b = document.querySelector('button[aria-label="设置"]'); if (b === null) return false; b.click(); return true; };
  const panelCount = () => document.querySelectorAll('[data-shortcut-modal="settings"]').length;
  const setDark = (on) => { if (on) document.body.setAttribute('data-ds-dark-theme', ''); else document.body.removeAttribute('data-ds-dark-theme'); };

  const itemBox = (text) => {
    const el = cells().find((c) => c.textContent.trim() === text);
    if (el === undefined) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  };

  /**
   * 布局健康指标。目标是把「肉眼可疑」的页自动挑出来，而不是替代人眼看截图。
   * 关心的四类：
   *   contentEmpty  —— 内容区几乎没文字（页没渲染出来 / 被压成 0 宽）
   *   textOverflow  —— 有元素把文本溢出到祖先之外（挤压的典型信号）
   *   tinyControls  —— 交互控件被压到过小（< 16px 的任一维）
   *   zeroWidthRows —— 页面根的子项里出现 0 宽/0 高（布局塌陷）
   */
  const health = () => {
    const c = content();
    if (c === null) return null;
    const cr = c.getBoundingClientRect();
    const body = (c.innerText || '').trim();
    const overflowing = [];
    const tiny = [];
    const collapsed = [];
    const benign = [];
    /* 只看内容区，且只看有实际盒子的元素。
       display:contents 的包装元素（宿主的 data-slot 座位）本来就没有盒子 —— 跳过，否则每页都误报。 */
    for (const el of c.querySelectorAll('*')) {
      if (getComputedStyle(el).display === 'contents') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      const tag = el.tagName;
      /* 原生勾选框/单选框/滑杆本来就小，不是布局问题 —— 排除掉，否则误报会淹没真信号。 */
      const type = (el.getAttribute('type') || '').toLowerCase();
      const nativeSmall = tag === 'INPUT' && ['checkbox', 'radio', 'range', 'hidden', 'file', 'color'].includes(type);
      if (!nativeSmall && (r.width < 16 || r.height < 16)) {
        const interactive = tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT' || el.getAttribute('role') === 'button';
        if (interactive) {
          tiny.push({ tag: tag, cls: String(el.className).slice(0, 40), w: Math.round(r.width), h: Math.round(r.height),
            text: (el.textContent || '').trim().slice(0, 20) });
        }
      }
      /* 溢出分两级，别混为一谈：
         · escaped —— 元素盒子**越出内容区**（右边界超了 / 左边界缩了）。这是真信号：
           内容被推到可视区外，或被裁掉。
         · benign —— 元素内容比它自己的盒子宽，但盒子仍在内容区里、溢出的那点朝内侧空白摊开。
           **不影响可读性**。实测依据：皮肤页 ul.sectionList 内容需 931px、盒子 900px，
           但盒子右边界离内容区右边界还有 260px，溢出的 31px 只是画进了空白 —— 无裁剪、无滚动条。
           只作信息记录，不计入可疑。 */
      if (r.right > cr.right + 2 || r.left < cr.left - 2) {
        overflowing.push({ tag: tag, cls: String(el.className).slice(0, 40),
          right: Math.round(r.right), contentRight: Math.round(cr.right), text: (el.textContent || '').trim().slice(0, 30) });
      } else if (el.scrollWidth > el.clientWidth + 8 && el.clientWidth > 0) {
        const cs = getComputedStyle(el);
        if (cs.overflowX === 'visible' && cs.textOverflow !== 'ellipsis' && cs.whiteSpace !== 'nowrap') {
          benign.push({ tag: tag, cls: String(el.className).slice(0, 40),
            scrollW: el.scrollWidth, clientW: el.clientWidth, text: (el.textContent || '').trim().slice(0, 30) });
        }
      }
    }
    /* 页面根的直接子项有没有塌成 0 */
    const root = c.querySelector('[data-slot="settings.section"]');
    const rootKid = root === null ? null : root.firstElementChild;
    if (rootKid !== null) {
      for (const k of rootKid.children) {
        const r = k.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) collapsed.push({ tag: k.tagName, cls: String(k.className).slice(0, 40) });
      }
    }
    return {
      title: pageTitle(),
      textLen: body.length,
      contentW: Math.round(cr.width),
      contentH: Math.round(cr.height),
      text: body.slice(0, 160).replace(/\n/g, ' | '),
      overflowing: overflowing.slice(0, 6),
      benignOverflow: benign.slice(0, 6),
      tiny: tiny.slice(0, 6),
      collapsed: collapsed.slice(0, 6),
      rowCount: rootKid === null ? 0 : rootKid.children.length,
    };
  };

  window.__sweep = {
    openSettings: openSettings, panelCount: panelCount, setDark: setDark, items: items,
    itemBox: itemBox, health: health, pageTitle: pageTitle, list: list,
  };
}
await evaluate('(' + sweepInstall.toString() + ')()');

const dismissOnboarding = async () => {
  for (let round = 0; round < 8; round += 1) {
    const box = await evaluate('(() => {'
      + 'const re = /^(继续|稍后配置|跳过|知道了)$/;'
      + 'const el = [...document.querySelectorAll("button")].find((e) =>'
      + ' re.test((e.getAttribute("aria-label") || e.textContent || "").trim()) && e.offsetParent !== null);'
      + 'if (!el) return null; const r = el.getBoundingClientRect();'
      + 'return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()');
    if (box === null) return;
    await click(box.x, box.y);
    await sleep(1200);
  }
};
const clickItem = async (label) => {
  const box = await evaluate('window.__sweep.itemBox(' + JSON.stringify(label) + ')');
  if (box === null) return false;
  await click(box.x, box.y);
  await sleep(1400);
  return true;
};
const screenshot = async (file) => {
  const s = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
  fs.writeFileSync(join(OUT_DIR, file), Buffer.from(s.data, 'base64'));
};

/** 文件名里的页名：去掉不能做文件名的字符。 */
const slug = (name) => name.replace(/[\\/:*?"<>|\s]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 30);

await dismissOnboarding();
await sleep(800);
await evaluate('window.__sweep.openSettings()');
await sleep(2500);

const labels = await evaluate('window.__sweep.items()');
console.log('侧栏共 ' + labels.length + ' 项：' + JSON.stringify(labels));

/* 空通过防护（先于任何截图/循环）：一项都没有 = 侧栏没渲染 / 结构层失效。
   此时下面的 for 循环一次都不进，报告为空、hardFail = 0、退出码 0 —— 假阳性。
   少于 --min-pages 同理（页数变少意味着宿主改版或部分页面注册失败，同样不该静默放过）。 */
if (labels.length === 0) {
  console.error('FAIL 侧栏一个设置项都没扫到 —— 设置面板没渲染出来，或结构层整体失效。');
  console.error('     这不是「没有异常」，是「什么都没测」：宿主一定会注册设置项，不会存在 0 项的合法场景。');
  console.error('     排查：设置模态是否打开（button[aria-label="设置"]）、'
    + '面板锚点 [data-shortcut-modal="settings"] / [data-dsh-surface="settings"] 是否命中、'
    + 'src/client/settings-modal.js 是否打出了 [codex-ui] 警告。');
  ws.close(); child.kill();
  process.exit(1);
}
if (labels.length < MIN_PAGES) {
  console.error('FAIL 侧栏只有 ' + labels.length + ' 项，少于 --min-pages ' + MIN_PAGES
    + '（宿主注册的设置项变少了，可能是改版或部分页面注册失败）');
  console.error('     扫到的：' + JSON.stringify(labels));
  ws.close(); child.kill();
  process.exit(1);
}

let hardFail = 0;
const report = [];
for (let i = 0; i < labels.length; i += 1) {
  const label = labels[i];
  const okClick = await clickItem(label);
  if (!okClick) { console.error('FAIL 点不到设置项：' + label); hardFail += 1; continue; }
  await sleep(900);
  const light = await evaluate('window.__sweep.health()');
  if (light === null) { console.error('FAIL 内容区没找到：' + label); hardFail += 1; continue; }
  await screenshot(PREFIX + '-' + String(i).padStart(2, '0') + '-' + slug(label) + '-light.png');
  await evaluate('window.__sweep.setDark(true)');
  await sleep(800);
  const dark = await evaluate('window.__sweep.health()');
  await screenshot(PREFIX + '-' + String(i).padStart(2, '0') + '-' + slug(label) + '-dark.png');
  await evaluate('window.__sweep.setDark(false)');
  await sleep(400);

  /* 硬故障判定：内容区没文字、或整页宽度塌掉。 */
  const empty = light.textLen < 12;
  const narrow = light.contentW < 200;
  if (empty || narrow) hardFail += 1;
  const flag = empty ? '  ← 内容为空' : (narrow ? '  ← 内容区过窄' : '');
  report.push({
    i: i, label: label, light: light, dark: dark,
    suspicious: light.overflowing.length > 0 || light.tiny.length > 0 || light.collapsed.length > 0,
    empty: empty, narrow: narrow,
  });
  console.log('[' + String(i).padStart(2, '0') + '] ' + label.padEnd(12)
    + ' 内容 ' + light.contentW + '×' + light.contentH + ' / 正文 ' + light.textLen + ' 字 / 子项 ' + light.rowCount
    + (light.overflowing.length > 0 ? ' / 溢出 ' + light.overflowing.length : '')
    + (light.tiny.length > 0 ? ' / 小控件 ' + light.tiny.length : '')
    + (light.collapsed.length > 0 ? ' / 塌陷 ' + light.collapsed.length : '')
    + flag);
}

await evaluate('window.__sweep.setDark(false)');
await sleep(300);

/* ── 汇总 ─────────────────────────────────────────────────────────────── */
console.log('\n===== 逐页布局报告 =====');
for (const r of report) {
  const issues = [];
  if (r.empty) issues.push('内容区没有文字（页可能没渲染）');
  if (r.narrow) issues.push('内容区宽度 < 200px（布局塌陷）');
  for (const o of r.light.overflowing) issues.push('文本溢出：<' + o.tag + ' class=' + o.cls + '> ' + o.scrollW + '>' + o.clientW + ' 「' + o.text + '」');
  for (const t of r.light.tiny) issues.push('控件过小：<' + t.tag + '> ' + t.w + '×' + t.h + ' 「' + t.text + '」');
  for (const c of r.light.collapsed) issues.push('子项塌陷：<' + c.tag + ' class=' + c.cls + '>');
  if (issues.length === 0) { console.log('[' + String(r.i).padStart(2, '0') + '] ' + r.label + '：未见异常'); continue; }
  console.log('[' + String(r.i).padStart(2, '0') + '] ' + r.label + '：' + issues.length + ' 项可疑');
  for (const s of issues) console.log('      · ' + s);
}
const suspicious = report.filter((r) => r.suspicious);
const benignPages = report.filter((r) => r.light.benignOverflow.length > 0);
if (benignPages.length > 0) {
  console.log('\n（以下为「盒子内溢出但未越界」，实测不影响可读性，仅记录：）');
  for (const r of benignPages) {
    const b = r.light.benignOverflow[0];
    console.log('  · ' + r.label + '：<' + b.tag + ' class=' + b.cls + '> 内容 ' + b.scrollW + 'px / 盒子 ' + b.clientW + 'px');
  }
}
console.log('\n截图 ' + (report.length * 2) + ' 张 → ' + OUT_DIR);
console.log('硬故障 ' + hardFail + ' 项；需人眼复核 ' + suspicious.length + ' 页'
  + (suspicious.length > 0 ? '：' + suspicious.map((r) => r.label).join('、') : ''));
fs.writeFileSync(join(OUT_DIR, PREFIX + '-sweep-report.json'), JSON.stringify(report, null, 1));
console.log('明细 JSON：' + join(OUT_DIR, PREFIX + '-sweep-report.json'));
console.log('\n' + (hardFail === 0 ? 'PASS：全部页面打开且内容区正常' : 'FAIL：' + hardFail + ' 项硬故障'));
ws.close(); child.kill();
process.exit(hardFail === 0 ? 0 : 1);
