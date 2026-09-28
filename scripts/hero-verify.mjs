#!/usr/bin/env node
/**
 * hero-verify.mjs — ⑬·3 顶栏瘦身 + ⑭ 输入区（hero）验收。
 *   用真实 shipped 组件 CSS（ConversationRoot + InputBar）+ 本插件真实 theme.css
 *   渲染两个夹具，断言计算样式并出证据图。
 * 用法：node scripts/hero-verify.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromePath, globalModules, tempDir } from './host-paths.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const WB = dirname(HERE);
const EVID = join(WB, 'assets', 'screenshots');
/** 夹具 HTML 是中间产物，落系统临时目录，不堆进 assets/screenshots/。 */
const FIX = join(tmpdir(), 'codex-ui-fixtures');
const ROOT = join(globalModules(), '@deepseek-ai');
const CONV = join(ROOT, 'dsh-client-ui-conversation', 'lib', 'client.js');
const SRC = fs.readFileSync(CONV, 'utf8');

/** 取某个 .module.css 的内联样式串：按 tagId 回退到最近的一条 `const cssN = "…";`。 */
const cssFor = (moduleFile, src = SRC) => {
  const i = src.indexOf(moduleFile);
  if (i < 0) throw new Error('tagId not found: ' + moduleFile);
  const decl = src.lastIndexOf('const css', i);
  if (decl < 0) throw new Error('css declaration not found for ' + moduleFile);
  const start = src.indexOf('"', decl) + 1;
  const end = src.indexOf('";', start);
  const text = src.slice(start, end).replaceAll('\\"', '"');
  if (!text.includes('{')) throw new Error('css extraction looks wrong for ' + moduleFile);
  return text;
};
/** 取某个 Module_css_default 类映射表。 */
const mapFor = (varName, src = SRC) => {
  const i = src.indexOf('var ' + varName + ' = {');
  if (i < 0) throw new Error('class map not found: ' + varName);
  const start = src.indexOf('{', i);
  const end = src.indexOf('};', start);
  const body = src.slice(start, end + 1);
  const out = {};
  for (const m of body.matchAll(/"([^"]+)":\s*"([^"]+)"/g)) out[m[1]] = m[2];
  return out;
};

const rootCss = cssFor('@deepseek-ai/dsh-client-ui-conversation/ConversationRoot.module.css');
const barCss = cssFor('@deepseek-ai/dsh-client-ui-conversation/InputBar.module.css');
const R = mapFor('ConversationRoot_module_css_default');
const B = mapFor('InputBar_module_css_default');
const theme = fs.readFileSync(join(WB, 'theme.css'), 'utf8');
/* ⑬·3c 放开顶栏两格后，槽里的条目改用**官方真实样式**建模：预设徽标来自 agent-preset 的
   AgentPresetLabel.module.css（class 前缀 PfFEtG_）。它只用 --dsw-* 语义令牌取色，
   所以“配色跟着现在的皮肤走”这条能被夹具直接量到。 */
const AP = fs.readFileSync(join(ROOT, 'dsh-client-ui-agent-preset', 'lib', 'client.js'), 'utf8');
const labelCss = cssFor('@deepseek-ai/dsh-client-ui-agent-preset/AgentPresetLabel.module.css', AP);
const L = mapFor('AgentPresetLabel_module_css_default', AP);
/**
 * 徽标圆角的**宿主原值**：rc.1 在 .label 上写字面量 6px，rc.2 改成 var(--dsw-radius-xs)（宿主 ui-theme
 * 给 4px）。断言防的是「本皮肤改写了它」，所以期望值从宿主源码里现取，不写死某一版的字面量。
 */
const labelRadius = (() => {
  const rule = new RegExp('\\.' + L.label + '\\{([^}]*)\\}').exec(labelCss);
  const decl = rule === null ? null : /border-radius:([^;]+)/.exec(rule[1]);
  if (decl === null) throw new Error('宿主徽标规则里找不到 border-radius：' + L.label);
  const value = decl[1].trim();
  const token = /^var\((--[\w-]+)\)$/.exec(value);
  if (token === null) return value;
  const themeSrc = fs.readFileSync(join(ROOT, 'dsh-client-ui-theme', 'lib', 'client.js'), 'utf8');
  const declared = new RegExp(token[1] + ':\\s*([^;}]+)').exec(themeSrc);
  if (declared === null) throw new Error('宿主 ui-theme 没有声明 ' + token[1]);
  return declared[1].trim();
})();

const chip = (label, glyph) => '<button type="button" style="display:inline-flex;align-items:center;gap:6px;padding:4px 8px;border:0;background:transparent;font:inherit;cursor:pointer">' + glyph + '<span>' + label + '</span></button>';

const page = '<!doctype html><html data-codex-ui><head><meta charset="utf-8">' +
  '<style>' + rootCss + '</style><style>' + barCss + '</style><style>' + labelCss + '</style><style>' + theme + '</style>' +
  /* 宿主底样式复刻：加号常驻 --dsw-alias-bg-layer-2 圆底并全圆角；两个触发器默认透明。
     触发器圆角旧夹具写 24px（2026-09-26 记录）；2026-09-27 复核宿主 rc.2 源码，
     dsh-client-ui-model-selection 的 .u91W7W_trigger 与 dsh-client-ui-permission-presets
     的 ._5Tq8wa_trigger 都是 border-radius: var(--dsw-radius-sm)，而该令牌在
     dsh-client-ui-theme 里只有一处定义 = 8px。夹具按源码取 8px（本页不引宿主令牌层，
     所以写死字面量）；这条基线的意义是「皮肤必须显式压过它」，不是复刻某个历史值。 */
  '<style>[class$="_add"]{background:var(--dsw-alias-bg-layer-2);border:0;border-radius:999px}'
  + '[class$="_trigger"]{background:transparent;border:0;border-radius:8px}button{font:inherit}</style>' +
  '<style>body{margin:0;background:#fff;font:14px/1.5 "Segoe UI","Microsoft YaHei",sans-serif}' +
  '.stage{padding:24px 0 40px}h4{margin:0 0 10px 24px;font:600 12px/18px ui-monospace,Consolas,monospace;color:#8a8a8a}' +
  '.hdrwrap{margin:0 24px 28px;border-bottom:1px solid #e5e5e5}</style></head><body>' +
  '<div class="stage">' +
    '<h4>⑬·3 会话分割线（会话名 + 槽位条目 + 右上角按钮；页签仍隐去）</h4>' +
    '<div class="hdrwrap"><header class="' + R.header + '">' +
      '<div class="' + R.headerLeading + '" data-conversation-header-leading></div>' +
      '<div data-slot="conversation.session.header" style="display:contents">' +
        '<div class="' + R.titleRow + '">' +
          '<div class="' + R.titleCluster + '">' +
            '<nav class="' + R.crumbs + '" aria-label="层级">' +
              '<span class="' + R.crumbSeg + '"><span class="' + R.crumb + ' ' + R.crumbCurrent + '">codexui</span></span>' +
            '</nav>' +
            '<div class="' + R.headerActions + '"><div data-slot="conversation.session.header.actions" style="display:contents">' +
              '<span class="' + L.label + '" title="预设徽标（官方 AgentPresetLabel 的真实类名）">✳ Agent-Evo RSI</span>' +
            '</div></div>' +
          '</div>' +
          '<div class="' + R.headerUtilities + '"><div data-slot="conversation.session.header.utilities" style="display:contents"><span style="font-size:12px;color:#8a8a8a">工具</span></div></div>' +
          '<div class="' + R.headerCorner + '" data-conversation-header-corner><button type="button" aria-label="展开右栏" style="width:28px;height:28px;border:0;background:transparent;cursor:pointer">▤</button></div>' +
        '</div>' +
        '<div class="' + R.tabs + '" role="tablist" data-conversation-tabs>' +
          '<button class="' + R.tab + ' ' + R.tabActive + '" role="tab" aria-selected="true">对话</button>' +
          '<button class="' + R.tab + '" role="tab">轨迹</button>' +
        '</div>' +
      '</div>' +
    '</header></div>' +
    '<h4>⑭ 输入框上方的卡片（hero：工作区 / 模式）</h4>' +
    '<div class="' + R.root + '" data-phase="hero">' +
      '<div class="' + R.body + '" data-conversation-content data-content-phase="hero">' +
        '<div class="' + R.scrollBody + '" data-conversation-scroll>' +
          '<div class="' + R.composerSeat + '" data-composer-seat>' +
            '<div class="' + R.composerStack + ' ' + R.composerHero + '">' +
              '<div class="' + R.heroWorkspaceRow + '">' +
                chip('dsh-agency-agents', '📁') + chip('Standard mode', '⚙️') + chip('main', '⑂') +
              '</div>' +
              '<div class="' + B.root + '">' +
                '<div class="' + B.card + '" data-composer-card="true">' +
                  '<div class="' + B.scroll + '" data-input-scroll="true"><div class="' + B.grow + '">' +
                    '<div class="' + B.input + '" data-lexical-editor="true" data-phase="hero" contenteditable="true"></div>' +
                    '<div class="' + B.placeholder + '" data-composer-placeholder="true">Describe what you want to build... / commands, @ files or sessions</div>' +
                  '</div></div>' +
                  '<div class="' + B.row + '"><div class="' + B.tools + '">' +
                    '<button class="' + B.add + '">+</button><div class="' + B.modes + '"><button>Workspace Write</button></div></div>' +
                    '<div class="' + B.trailing + '"><button class="_7KE1Ra_trigger">DeepSeek V4 Flash High</button><button class="' + B.primary + '" aria-label="发送">↑</button></div></div>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<h4>⑰ 宿主基线：同款哈希类名、但在 [data-composer-card] 之外（皮肤锚点不命中）</h4>' +
    '<div style="margin:0 24px 40px"><button type="button" data-host-baseline="trigger" class="_7KE1Ra_trigger" style="height:28px">DeepSeek V4 Flash High</button></div>' +
  '</div></body></html>';

fs.mkdirSync(FIX, { recursive: true });
fs.mkdirSync(EVID, { recursive: true });
const htmlPath = join(FIX, 'hero-verify.html');
fs.writeFileSync(htmlPath, page);

const CHROME = chromePath();
const PORT = 9347;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// file:// 也吃磁盘缓存：夹具同路径反复改写时会读到旧内容，每次跑前清干净 profile。
const PROFILE = tempDir('dsh-cdp-hero');
fs.rmSync(PROFILE, { recursive: true, force: true });
const child = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT, '--user-data-dir=' + PROFILE, '--no-first-run', '--disable-gpu', '--hide-scrollbars', '--window-size=1100,760', 'about:blank'], { stdio: 'ignore' });
let info; for (let i = 0; i < 60 && !info; i++) { try { const r = await fetch('http://127.0.0.1:' + PORT + '/json/version'); if (r.ok) info = await r.json(); } catch {} if (!info) await sleep(250); }
if (!info) { child.kill(); throw new Error('headless chrome did not start'); }
const ws = new WebSocket(info.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}, sid) => new Promise((res, rej) => { const id = ++seq; pending.set(id, (m) => m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result)); ws.send(JSON.stringify({ id, method, params, ...(sid ? { sessionId: sid } : {}) })); });
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, sessionId);
await send('Emulation.setDeviceMetricsOverride', { width: 1100, height: 760, deviceScaleFactor: 2, mobile: false }, sessionId);
// file:// 也会走 Chrome 的磁盘缓存：同一个路径反复改写夹具时会读到旧版本，加查询串破缓存。
await send('Page.navigate', { url: 'file:///' + htmlPath.replaceAll('\\', '/') + '?v=' + Date.now() }, sessionId);
await sleep(1600);
const probe = fs.readFileSync(join(HERE, 'fixtures', 'hero-verify.probe.js'), 'utf8');
const r = await send('Runtime.evaluate', { expression: probe, returnByValue: true }, sessionId);
const headerRaw = r.result.value;
console.log(headerRaw);

/* ── ⑰ composer 底部控件：默认无框、悬停才出现淡底 ────────────────────────
   模型/权限触发器在真实 DOM 里没有 data-*，锚点是哈希类名的后缀
   （_add / _trigger，见 composer.css 头部备案），夹具按同一个后缀建模。 */
const controls = '(() => {'
  + 'const cs = (el) => el ? getComputedStyle(el) : null;'
  + 'const read = (el) => el ? { w: Math.round(el.getBoundingClientRect().width), bg: cs(el).backgroundColor, radius: cs(el).borderTopLeftRadius } : null;'
  + 'const pick = (suffix) => [...document.querySelectorAll("[data-composer-card] button")].find((b) => String(b.className).endsWith(suffix));'
  + 'return JSON.stringify({'
  + '  add: read(pick("_add")),'
  + '  trig: read(pick("_trigger")),'
  + '  trigRaw: read(document.querySelector("[data-host-baseline=trigger]")),'
  + '  hoverFill: cs(document.querySelector("[data-composer-card]")).getPropertyValue("--dsw-codex-hover-fill").trim(),'
  + '}); })()';
const readControls = async () => {
  const res = (await send('Runtime.evaluate', { expression: controls, returnByValue: true }, sessionId)).result;
  if (res.value === undefined) throw new Error('controls probe failed: ' + JSON.stringify(res));
  return JSON.parse(res.value);
};
const boxOf = async (sel) => (await send('Runtime.evaluate', { expression: '(() => { const b = document.querySelector(' + JSON.stringify(sel) + '); const r = b.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()', returnByValue: true }, sessionId)).result.value;
/* 悬停要等两件事：浏览器把 :hover 算完，以及过渡跑完。
   过渡期间 backgroundColor 的 alpha 是小数（实测 0.92 / 0.992），
   只判断「非透明」会读到中途值，所以改成「非透明且连续两次取样相同」才算落定。 */
const hoverUntil = async (sel, pick) => {
  const box = await boxOf(sel);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y }, sessionId);
  let prev = null;
  for (let i = 0; i < 24; i += 1) {
    await sleep(100);
    const snap = await readControls();
    const now = pick(snap);
    if (now !== 'rgba(0, 0, 0, 0)' && now === prev) return snap;
    prev = now;
  }
  return readControls();
};
/* 焦点环 = Codex --color-border-focus（亮色 #339cff）。
   先发一次 Tab 让浏览器进入键盘模态，再 focus()，按钮才会命中 :focus-visible。 */
await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', windowsVirtualKeyCode: 9, key: 'Tab' }, sessionId);
await send('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: 9, key: 'Tab' }, sessionId);
await sleep(120);
const focusRing = (await send('Runtime.evaluate', {
  expression: '(() => { const el = [...document.querySelectorAll("[data-composer-card] button")].find((b) => String(b.className).endsWith("_add"));'
    + 'el.focus(); const cs = getComputedStyle(el); return cs.outlineColor + " " + cs.outlineWidth + " " + cs.outlineStyle; })()',
  returnByValue: true,
}, sessionId)).result.value;
console.log('FOCUS  outline ' + focusRing);

const idle = await readControls();
const addHover = await hoverUntil('[data-composer-card] button[class$="_add"]', (s) => s.add.bg);
const trigHover = await hoverUntil('[data-composer-card] button[class$="_trigger"]', (s) => s.trig.bg);
console.log('IDLE   ' + JSON.stringify(idle));
console.log('ADD-H  ' + JSON.stringify(addHover.add));
console.log('TRIG-H ' + JSON.stringify(trigHover.trig));
const hdr = JSON.parse(headerRaw);
const checks = [
  /* ⑬·3c：两格放开后，槽里的条目必须真的渲染出来；页签仍旧隐去（参考图没有页签）。 */
  ['会话名仍在', hdr.header.title === true],
  ['预设徽标可见（顶栏两格已放开）', hdr.header.presetBadge === true],
  ['右侧工具条目可见（顶栏两格已放开）', hdr.header.utilityItem === true],
  ['页签仍隐去', hdr.header.tabs === false],
  ['右上角按钮仍在', hdr.header.corner === true],
  ['徽标配色 = 本皮肤 --dsw-alias-label-tertiary', hdr.presetLabel.color === 'rgb(118, 118, 118)'],
  /* 徽标圆角是**宿主自己的值**（rc.1 字面量 6px / rc.2 的 --dsw-radius-xs），不是本皮肤的刻度；这条断言防的是我们误改它。 */
  ['徽标圆角保持宿主原值 ' + labelRadius + '（未被皮肤改写）', hdr.presetLabel.radius === labelRadius],
  ['徽标高 22px（官方控件高度，未改写）', hdr.presetLabel.h === 22],
  ['徽标不填底色（令牌未定义即透明，不另配色）', hdr.presetLabel.bg === 'rgba(0, 0, 0, 0)'],
  /* ⑭ 上栏条（hero 工作区行）只有上面两角是圆角，它探在卡片背后，与卡片同心叠放。
     2026-09-28 同屏对照实测（DSH / Codex 两块同一缩放）：Codex 条/卡 = 1.03，
     本皮肤旧值 条/卡 = 0.79（条 16 / 卡 20）—— 条比卡片紧 5px，就是那两条对不上的角弧。
     现在条与卡片共用 --dsw-radius-card，比值恒为 1；这两条断言防的就是它们再次分家。 */
  ['上栏条与卡片同值（字面量）', hdr.heroRow.radius === hdr.card.radius],
  ['上栏条与卡片同值（比值 = 1）', parseFloat(hdr.heroRow.radius) === parseFloat(hdr.card.radius)],
  ['上栏条取 --dsw-radius-card（条 = 卡 = 令牌）', hdr.heroRow.radius === hdr.card.token && hdr.heroRow.radius === hdr.card.radius],
  /* ⑭·2 输入区纵向留白：2026-09-28 用户同屏对照实测（DPR 1.25，两侧卡片角弧 29.6 / 29.5 完全同形
     ⇒ 同缩放）——Codex 卡 149 设备像素、本皮肤 147，总高本来就对齐；差的是**卡片上内衬**
     （DSH 22.4 vs Codex 29.25）。故只把上内衬 8 → 12，编辑区与底衬回到宿主原值。
     上一版把编辑区抬到 64 是拿「声明栈」推的，实测超了 35 设备像素（≈28 CSS px），已回退。 */
  ['输入区编辑区 min-height 44（宿主原值）', hdr.editor.minH === '44px'],
  ['卡片上内衬 12（Codex 实测）', hdr.card.padTop === '12px'],
  /* 输入卡必须**不透明**：Codex 的 --card 是叠在不透明画布上的，DSH 的卡浮在会话滚动内容之上，
     留 transparent 会让身后的文件列表透出来（2026-09-28 实测复现）。计算值里出现 "/" 即带 alpha。 */
  ['输入卡底不透明（不透视身后会话内容）', !hdr.card.bg.includes('/')],
  ['底栏下内衬 8（宿主原值）', hdr.footPad === '8px'],
  ['加号默认无底色框', idle.add.bg === 'rgba(0, 0, 0, 0)'],
  ['加号悬停才出现淡底', addHover.add.bg === 'rgb(242, 242, 243)'],
  ['加号圆形（999px）', idle.add.radius === '999px'],
  ['触发器默认无底色框', idle.trig.bg === 'rgba(0, 0, 0, 0)'],
  ['触发器悬停才出现淡底', trigHover.trig.bg === 'rgb(242, 242, 243)'],
  /* 圆角不再交给宿主：Codex 的 composer chip 是全圆角胶囊（参考图实测 R = h/2），
     皮肤显式声明 999px。卡外同款类名的对照证明这是皮肤写的、不是宿主给的。 */
  ['触发器全圆角胶囊（999px）', idle.trig.radius === '999px'],
  ['原生对照：卡外同款触发器仍是宿主 8px', idle.trigRaw.radius === '8px'],
  ['悬停色标 = Codex 实测 #F2F2F3', idle.hoverFill === '#f2f2f3'],
  ['焦点环 = Codex --color-border-focus', focusRing === 'rgb(51, 156, 255) 2px solid'],
];
let fail = 0;
for (const [name, ok] of checks) { if (!ok) fail += 1; console.log((ok ? 'PASS ' : 'FAIL ') + name); }
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 10, y: 10 }, sessionId);
await sleep(300);
const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1100, height: 760, scale: 2 } }, sessionId);
fs.writeFileSync(join(EVID, 'hero-verify.png'), Buffer.from(shot.data, 'base64'));
console.log('WROTE', join(EVID, 'hero-verify.png'));
ws.close(); child.kill();
console.log(fail === 0 ? 'ALL PASS (' + checks.length + ')' : fail + ' FAIL');
process.exit(fail === 0 ? 0 : 1);