#!/usr/bin/env node
/**
 * settings-page-verify.mjs — 对真 GUI 取证：官方插件管理 → codex-ui 组合包页上那张设置卡。
 *
 * 为什么必须真 GUI：座位 plugins.bundle.config 只在插件管理页存在时才出现，卡片的注入面
 * （scope / locale）由那一页的 owner 提供，夹具复刻不出来。
 *
 * 用法：
 *   1) DSH_HOME=<临时家> dsh --profile <p> --port 3098 --no-open   （终端打印带 token 的 URL）
 *   2) node scripts/settings-page-verify.mjs --url "http://127.0.0.1:3098/?token=..." [--out x.png]
 *
 * --explore 只把候选可点元素与页面文本打出来，用于定位入口，不做断言。
 */
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromePath, tempDir } from './host-paths.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const WB = dirname(HERE);
const arg = (name, fallback) => {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fallback;
};
const flag = (name) => process.argv.includes('--' + name);
const TOKEN_URL = arg('url', '');
const OUT = arg('out', join(WB, 'assets', 'screenshots', 'settings-page.png'));
const CHROME = arg('chrome', '') || chromePath();
const PORT = Number(arg('cdp-port', '9341'));
const DPR = Number(arg('dpr', '1.5'));
const EXPLORE = flag('explore');
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

const child = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + tempDir('dsh-cdp-settings'), '--no-first-run',
  '--no-default-browser-check', '--disable-gpu', '--window-size=1280,900', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
let info;
for (let i = 0; i < 60 && !info; i += 1) { try { const r = await fetch('http://127.0.0.1:' + PORT + '/json/version'); if (r.ok) info = await r.json(); } catch { /* 未就绪 */ } if (!info) await sleep(250); }
if (!info) { console.error('Chromium 没起来：' + CHROME); process.exit(2); }
const ws = new WebSocket(info.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0; const waiting = new Map();
/** 页面控制台与未捕获异常：座位注册失败只留一条 warn，不抓就什么都看不见。 */
const pageLogs = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) {
    pageLogs.push('console.' + m.params.type + ': ' + m.params.args.map((a) => String(a.value ?? a.description ?? '')).join(' ').slice(0, 300));
  }
  if (m.method === 'Runtime.exceptionThrown') {
    pageLogs.push('exception: ' + String(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).slice(0, 300));
  }
  const fn = waiting.get(m.id);
  if (fn) { waiting.delete(m.id); fn(m); }
};
const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const id = ++seq;
  waiting.set(id, (m) => (m.error ? rej(new Error(method + ': ' + JSON.stringify(m.error))) : res(m.result)));
  ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
});
const evaluate = async (expression, sessionId) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId)).result.value;
const click = async (x, y, sessionId) => {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }, sessionId);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }, sessionId);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }, sessionId);
};

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, sessionId);
await send('Runtime.enable', {}, sessionId);
await send('Network.enable', {}, sessionId);
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: DPR, mobile: false }, sessionId);
const eq = cookie.indexOf('=');
await send('Network.setCookie', { name: cookie.slice(0, eq), value: cookie.slice(eq + 1), domain: new URL(origin).hostname, path: '/', httpOnly: true }, sessionId);
await send('Page.navigate', { url: origin + '/' }, sessionId);
await sleep(11000);

/** 按可见文本点一个元素。 */
const clickByText = async (pattern, sessionId) => evaluate('(() => {'
  + 'const re = new RegExp(' + JSON.stringify(pattern) + ');'
  + 'const els = [...document.querySelectorAll("button, a, [role=tab], [role=menuitem]")];'
  + 'const el = els.find((e) => (re.test(e.getAttribute("aria-label") || "") || re.test(e.textContent.trim())) && e.offsetParent !== null);'
  + 'if (!el) return null;'
  + 'const r = el.getBoundingClientRect();'
  + 'return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), text: (el.getAttribute("aria-label") || el.textContent.trim()).slice(0, 40) };'
  + '})()', sessionId);

const candidates = await evaluate('(() => [...document.querySelectorAll("button, a, [role=tab], [role=menuitem]")]'
  + '.filter((e) => e.offsetParent !== null)'
  + '.map((e) => (e.getAttribute("aria-label") || "") + " | " + e.textContent.trim().slice(0, 30))'
  + '.filter((t) => t.trim() !== "|")'
  + '.slice(0, 80))()', sessionId);
console.log('BOOT candidates: ' + JSON.stringify(candidates));

/** 关掉启动时的引导弹层：内测声明 → 配置 API Key。刷新后它们会再出现一次，所以抽成函数。 */
const dismissOnboarding = async () => {
  for (let round = 0; round < 5; round += 1) {
    const dismiss = await clickByText('^(继续|稍后配置|跳过|知道了)$', sessionId);
    if (dismiss === null) return;
    await click(dismiss.x, dismiss.y, sessionId);
    await sleep(1200);
    console.log('DISMISS ' + dismiss.text);
  }
};
await dismissOnboarding();

/* ── 进插件管理页 ─────────────────────────────────────────────────────── */
const entry = await clickByText('^插件$', sessionId);
if (entry === null) { console.error('FAIL 侧栏里没有「插件」入口：插件管理页在本 profile 里被停用了'); process.exit(1); }
await click(entry.x, entry.y, sessionId);
await sleep(2000);
console.log('PLUGINS page candidates: ' + JSON.stringify(await evaluate('(() => [...document.querySelectorAll("button, a, [role=tab], [role=menuitem], [role=button]")]'
  + '.filter((e) => e.offsetParent !== null)'
  + '.map((e) => (e.getAttribute("aria-label") || "") + " | " + e.textContent.trim().slice(0, 40))'
  + '.slice(0, 60))()', sessionId)));
console.log('PLUGINS text: ' + JSON.stringify((await evaluate('document.body.innerText.slice(0, 3000)', sessionId))));

if (EXPLORE) {
  const shot = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
  fs.writeFileSync(OUT, Buffer.from(shot.data, 'base64'));
  console.log('SHOT ' + OUT);
  ws.close(); child.kill();
  process.exit(0);
}

/* ── 断言 ─────────────────────────────────────────────────────────────── */
let failed = 0;
const ok = (name, extra = '') => console.log('ok   ' + name + (extra ? '  ' + extra : ''));
const bad = (name, detail) => { failed += 1; console.error('FAIL ' + name + '\n     ' + detail); };
const check = (name, cond, detail) => (cond ? ok(name, typeof detail === 'string' ? detail : '') : bad(name, String(detail)));
const shot = async (file) => {
  const s = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
  fs.writeFileSync(file, Buffer.from(s.data, 'base64'));
};
/** 读一个自定义属性的计算值。 */
const cssVar = (name) => evaluate('getComputedStyle(document.documentElement).getPropertyValue(' + JSON.stringify(name) + ').trim()', sessionId);
/** 按 aria-label 点一个元素。 */
const clickByLabel = async (label) => {
  const box = await evaluate('(() => { const el = document.querySelector("[aria-label=" + JSON.stringify(' + JSON.stringify(label) + ') + "]");'
    + 'if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()', sessionId);
  if (box === null) return null;
  await click(box.x, box.y, sessionId);
  return box;
};

/* 打开 codex-ui 的组合包页 */
const open = await clickByText('^查看 codex-ui$', sessionId);
if (open === null) { console.error('FAIL 已安装分组里没有 codex-ui 的「查看」入口'); process.exit(1); }
await click(open.x, open.y, sessionId);
await sleep(2500);
console.log('BUNDLE text: ' + JSON.stringify((await evaluate('document.body.innerText.slice(0, 1200)', sessionId))));

if (flag('dump')) {
  console.log('FORM HTML: ' + JSON.stringify((await evaluate('(document.querySelector(".cx-form") || {outerHTML:null}).outerHTML.slice(0, 2500)', sessionId))));
  await shot(OUT);
  ws.close(); child.kill();
  process.exit(0);
}
/** 有没有残留覆盖：覆盖层打了属性就说明用户层还有东西。 */
const overridden = () => evaluate('document.documentElement.hasAttribute("data-codex-ui-theme")', sessionId);
/** 清掉所有已有覆盖，让每次运行都从默认态开始（幂等：反复点「重置」直到属性消失）。 */
const resetAll = async () => {
  for (let round = 0; round < 20; round += 1) {
    if ((await overridden()) === false) return round;
    const box = await evaluate('(() => {'
      + 'const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "重置" && x.offsetParent !== null);'
      + 'if (!b) return null; const r = b.getBoundingClientRect();'
      + 'return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()', sessionId);
    if (box === null) return round;
    await click(box.x, box.y, sessionId);
    await sleep(800);
  }
  return 20;
};
/* 等宿主把设置文档送达：覆盖层要等 scope 有值才打属性，早读会把「还没到」当成「没有覆盖」。 */
await sleep(4000);
if (await overridden()) {
  const rounds = await resetAll();
  await sleep(600);
  console.log('RESET 清了 ' + rounds + ' 轮，残留覆盖=' + (await overridden()));
}
/* 起始态固定为亮色：主题控件就在这一页上，先摆平它再断言默认值。 */
const segmentNow = await evaluate('(() => { const t = document.querySelector("[role=tab][aria-selected=true]"); return t === null ? null : t.textContent.trim(); })()', sessionId);
if (segmentNow !== null && segmentNow !== '亮色') {
  const box = await clickByText('^亮色$', sessionId);
  if (box !== null) { await click(box.x, box.y, sessionId); await sleep(1200); console.log('RESET 主题回亮色（原 ' + segmentNow + '）'); }
}

const shape = JSON.parse(await evaluate('(() => {'
  + 'const rows = [...document.querySelectorAll(".cx-row")];'
  + 'return JSON.stringify({'
  + '  form: document.querySelectorAll(".cx-form").length,'
  + '  rows: rows.length,'
  + '  labels: rows.map((r) => (r.querySelector(".cx-row__label") || {}).textContent || ""),'
  + '  overrideAttr: document.documentElement.hasAttribute("data-codex-ui-theme"),'
  + '  sidebar: getComputedStyle(document.documentElement).getPropertyValue("--dsw-alias-bg-sidebar").trim(),'
  + '  link: getComputedStyle(document.documentElement).getPropertyValue("--dsw-alias-link").trim(),'
  + '}); })()', sessionId));
check('组合包页上有配置卡', shape.form === 1, JSON.stringify(shape));
check('九行：主题/强调色/背景/前景/UI 字体/代码字体/半透明侧边栏/Codex 模型选择器/对比度', shape.rows === 9 && shape.labels.length === 9, JSON.stringify(shape.labels));
check('默认值下不产生覆盖（无 data-codex-ui-theme）', shape.overrideAttr === false, 'attr=' + shape.overrideAttr);
/* 读 body 上的生效值：深色的链接默认是 #0169cc，与亮色不同，读 html 会永远看到亮色那一份。 */
const bodyLink = await evaluate('getComputedStyle(document.body).getPropertyValue("--dsw-alias-link").trim()', sessionId);
check('默认强调色仍是皮肤给的那一支（亮 #339cff / 暗 #0169cc）', ['#339cff', '#0169cc'].includes(bodyLink.toLowerCase()), 'link=' + bodyLink);
await shot(OUT.replace(/\.png$/, '-default.png'));

/* 拨「半透明侧边栏」 */
const toggled = await clickByLabel('半透明侧边栏');
check('找到半透明侧边栏开关', toggled !== null, JSON.stringify(toggled));
await sleep(1500);
const afterToggle = JSON.parse(await evaluate('(() => {'
  + 'const root = document.documentElement;'
  + 'return JSON.stringify({'
  + '  overrideAttr: root.hasAttribute("data-codex-ui-theme"),'
  + '  sidebar: getComputedStyle(root).getPropertyValue("--dsw-alias-bg-sidebar").trim(),'
  + '  tag: ([...document.querySelectorAll("style")].find((s) => s.dataset.pluginCss === "codex-ui/settings-override.css") || { textContent: "" }).textContent'
  + '}); })()', sessionId));
check('开覆盖后打上 data-codex-ui-theme', afterToggle.overrideAttr === true, JSON.stringify(afterToggle).slice(0, 300));
check('侧栏填充转为半透明 rgba(255,255,255,0.72)', afterToggle.sidebar.replace(/\s/g, '') === 'rgba(255,255,255,0.72)', 'sidebar=' + afterToggle.sidebar);
check('覆盖样式表只写覆盖项', afterToggle.tag.includes('--dsw-alias-bg-sidebar') && afterToggle.tag.includes('data-codex-ui-theme'), afterToggle.tag.slice(0, 200));
await shot(OUT.replace(/\.png$/, '-translucent.png'));

/* 写一个强调色：焦点 + 输入 + 回车 */
const hexBox = await clickByLabel('强调色 hex');
check('找到强调色的十六进制输入框', hexBox !== null, JSON.stringify(hexBox));
if (hexBox !== null) {
  await send('Input.insertText', { text: '#ff0000' }, sessionId);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 }, sessionId);
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 }, sessionId);
  await sleep(1500);
  const link = await cssVar('--dsw-alias-link');
  check('回车提交后强调色生效', link.toLowerCase() === '#ff0000', 'link=' + link);
  const marked = await evaluate('!!document.querySelector(".cx-row .cx-row__label span:nth-child(2)")', sessionId);
  check('该行显示「已覆盖」徽标', marked === true, 'marked=' + marked);
  await shot(OUT.replace(/\.png$/, '-accent.png'));
}

/* 关掉「Codex 模型选择器」：刷新后在首页量宿主那一格是否复原（组合包页上没有输入区可量）。 */
const pickerSwitch = () => evaluate('(() => { const el = document.querySelector("[aria-label=\\"Codex 模型选择器\\"]"); return el === null ? null : (el.getAttribute("aria-checked") ?? String(el.checked)); })()', sessionId);
check('模型选择器开关默认开着', (await pickerSwitch()) === 'true', 'checked=' + (await pickerSwitch()));
const pickerOff = await clickByLabel('Codex 模型选择器');
check('找到模型选择器开关', pickerOff !== null, JSON.stringify(pickerOff));
await sleep(1500);
check('开关写入后显示为关', (await pickerSwitch()) === 'false', 'checked=' + (await pickerSwitch()));

/* ── 主题那一行：写的是宿主主题偏好，整个应用一起变 ───────────────────── */
/** 读分段控件当前选中的那一段文本。 */
const selectedSegment = () => evaluate('(() => {'
  + 'const tab = document.querySelector("[role=tab][aria-selected=true]");'
  + 'return tab === null ? null : tab.textContent.trim(); })()', sessionId);
/** 读 body 上的令牌：深色令牌落在 body 上，不在 html。 */
const bodyVar = (name) => evaluate('getComputedStyle(document.body).getPropertyValue(' + JSON.stringify(name) + ').trim()', sessionId);

const beforeTheme = { segment: await selectedSegment(), base: await bodyVar('--dsw-alias-bg-base'), dark: await evaluate('document.body.hasAttribute("data-ds-dark-theme")', sessionId) };
console.log('THEME 切换前 ' + JSON.stringify(beforeTheme));
check('主题行存在且显示了当前偏好', beforeTheme.segment !== null, 'segment=' + beforeTheme.segment);

const toDark = await clickByText('^深色$', sessionId);
check('找到「深色」分段', toDark !== null, JSON.stringify(toDark));
if (toDark !== null) {
  /* 预览层：点下去要**立刻**变色，而不是等设置文档往返（那一次实测 780–824ms）。 */
  await click(toDark.x, toDark.y, sessionId);
  const t0 = Date.now();
  let flipMs = null;
  for (let i = 0; i < 50; i += 1) {
    if (await evaluate('document.body.hasAttribute("data-ds-dark-theme")', sessionId)) { flipMs = Date.now() - t0; break; }
    await sleep(40);
  }
  console.log('THEME 点击 → 变色 ' + flipMs + 'ms');
  check('点下去立刻变色（≤300ms，预览层生效）', flipMs !== null && flipMs <= 300, 'flip=' + flipMs + 'ms');
  await sleep(1500);
  const settled = await evaluate('({ preview: document.documentElement.getAttribute("data-codex-ui-preview"), scheme: document.documentElement.style.colorScheme })', sessionId);
  check('文档落地后预览标记被摘掉（没有卡在预览态）', settled.preview === null, JSON.stringify(settled));
  const swatchExpr = '(() => { const el = [...document.querySelectorAll(".cx-swatch")].find((x) => x.getAttribute("aria-label") === "背景"); return el === undefined ? null : el.value; })()';
  const dark = {
    dark: await evaluate('document.body.hasAttribute("data-ds-dark-theme")', sessionId),
    base: await bodyVar('--dsw-alias-bg-base'),
    segment: await selectedSegment(),
    swatch: await evaluate(swatchExpr, sessionId),
  };
  console.log('THEME 切到深色 ' + JSON.stringify(dark));
  check('切深色后整个应用进了深色（body[data-ds-dark-theme]）', dark.dark === true, JSON.stringify(dark));
  /* 深色窗口背景自 0.5.6 起是 #111111（#181818 是表面/侧栏那一层）。 */
  check('深色底色生效 #111111', String(dark.base).toLowerCase() === '#111111', 'base=' + dark.base);
  check('分段显示深色', dark.segment === '深色', 'segment=' + dark.segment);
  check('下面三行改为编辑深色那一套（背景色块 = #111111）', String(dark.swatch).toLowerCase() === '#111111', 'swatch=' + dark.swatch);
  await shot(OUT.replace(/\.png$/, '-dark.png'));
}

/* 刷新后覆盖仍在（设置是持久化的，不是页面内存） */
await send('Page.navigate', { url: origin + '/' }, sessionId);
await sleep(11000);
const afterReload = JSON.parse(await evaluate('(() => {'
  + 'const root = document.documentElement;'
  + 'return JSON.stringify({'
  + '  overrideAttr: root.hasAttribute("data-codex-ui-theme"),'
  + '  link: getComputedStyle(root).getPropertyValue("--dsw-alias-link").trim(),'
  + '  sidebar: getComputedStyle(root).getPropertyValue("--dsw-alias-bg-sidebar").trim(),'
  + '  skin: root.hasAttribute("data-codex-ui")'
  + '}); })()', sessionId));
check('刷新后皮肤仍生效', afterReload.skin === true, JSON.stringify(afterReload));
check('刷新后覆盖仍在（强调色 #ff0000）', afterReload.link.toLowerCase() === '#ff0000', 'link=' + afterReload.link);
check('刷新后侧栏半透明仍在', afterReload.sidebar.replace(/\s/g, '') === 'rgba(255,255,255,0.72)', 'sidebar=' + afterReload.sidebar);
check('刷新后主题仍是深色（写的是宿主偏好，不是页面状态）', await evaluate('document.body.hasAttribute("data-ds-dark-theme")', sessionId) === true, JSON.stringify(afterReload));
const seatOff = JSON.parse(await evaluate('(() => { const slot = document.querySelector("[data-slot=\\"conversation.input.model\\"]");'
  + 'return JSON.stringify({ slot: slot !== null, ours: document.querySelectorAll(".codex-mp-trigger").length,'
  + '  host: slot === null ? null : [...slot.children].filter((c) => getComputedStyle(c).display !== "none").length }); })()', sessionId));
check('选择器关着：席位里没有自建触发器、宿主那一格可见', seatOff.slot === true && seatOff.ours === 0 && seatOff.host >= 1, JSON.stringify(seatOff));

/* 收工把主题还给亮色：刷新后已经在首页，先走回组合包页，别留下深色现场。 */
const onCard = async () => (await evaluate('document.querySelectorAll(".cx-form").length', sessionId)) > 0;
await dismissOnboarding();
if (!(await onCard())) {
  const back = await clickByText('^插件$', sessionId);
  if (back !== null) { await click(back.x, back.y, sessionId); await sleep(2200); }
  const reopen = await clickByText('^查看 codex-ui$', sessionId);
  if (reopen !== null) { await click(reopen.x, reopen.y, sessionId); await sleep(2500); }
}
const toLight = await clickByText('^亮色$', sessionId);
if (toLight !== null) { await click(toLight.x, toLight.y, sessionId); await sleep(1500); }
/* 模型选择器开关还原：清掉用户层那一格（点这一行的「重置」），回到默认开。 */
const pickerReset = await evaluate('(() => { const row = [...document.querySelectorAll(".cx-row")].find((r) => (r.querySelector(".cx-row__label") || {}).textContent?.includes("Codex 模型选择器"));'
  + 'const b = row === undefined ? null : [...row.querySelectorAll("button")].find((x) => x.textContent.trim() === "重置");'
  + 'if (!b) return null; const r = b.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()', sessionId);
if (pickerReset !== null) { await click(pickerReset.x, pickerReset.y, sessionId); await sleep(1200); }
check('收工复位：模型选择器回到默认开', (await pickerSwitch()) === 'true', 'checked=' + (await pickerSwitch()));
const restored = { segment: await selectedSegment(), base: await bodyVar('--dsw-alias-bg-base') };
console.log('THEME 复位 ' + JSON.stringify(restored));
check('收工复位回亮色', String(restored.base).toLowerCase() === '#ffffff' && restored.segment === '亮色', JSON.stringify(restored));

if (pageLogs.length > 0) console.log('\nPAGE LOGS:\n  ' + pageLogs.slice(0, 12).join('\n  '));
console.log('\n' + (failed === 0 ? 'PASS：全部通过' : 'FAIL：' + failed + ' 项未通过'));
ws.close(); child.kill();
process.exit(failed === 0 ? 0 : 1);
