#!/usr/bin/env node
/**
 * power-rail-verify.mjs — 模型选择器 B 面（src/model-picker.js + model-picker.css）的夹具验收。
 *
 * 不需要宿主：真实的 theme.css + 真实的组件模块（构建期同一条 stripExports 路径包成 IIFE），
 * 配一个按宿主契约写的假 modelDirectories —— select() 的往返**故意放慢到 600ms**，
 * 本机真宿主往返不到 60ms，pending 期间的行为在真 GUI 上根本来不及量。
 * 指针与键盘都走 CDP 的真输入事件（setPointerCapture 只认真指针）。
 *
 * 覆盖：席位顶替与复原、触发器几何、弹层几何与入场动画、功率轨 Codex 逐字几何、
 *      拖动中不提交 / 松手对齐提交一次、pending 不回弹不清空且有转圈、键盘四键、
 *      焦点环、Escape、换模型带默认档、失败提示、reduced-motion、深色、开关。
 *
 * 用法：node scripts/power-rail-verify.mjs [--no-shot]
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromePath, tempDir } from './host-paths.mjs';
import { MODEL_PICKER_EXPORTS, MODEL_PICKER_FILE, stripExports } from '../src/build.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const WB = dirname(HERE);
const EVID = join(WB, 'assets', 'screenshots');
const SHOT = !process.argv.includes('--no-shot');
const theme = fs.readFileSync(join(WB, 'theme.css'), 'utf8');
const pickerIife = '(() => {\n' + stripExports(fs.readFileSync(MODEL_PICKER_FILE, 'utf8'), 'model-picker.js')
  + '\nreturn { ' + MODEL_PICKER_EXPORTS.join(', ') + ' };\n})()';

/* 假目录：字段、状态机与返回值照 dsh-client-ui-model-selection 0.1.7-rc.2 的 ModelDirectory.select()。 */
const fake = `
const EFFORTS = [{ id: 'off', name: 'Off' }, { id: 'low', name: 'Low' }, { id: 'high', name: 'High' }, { id: 'max', name: 'Max' }];
const GROUPS = [{ id: 'deepseek-official', name: 'DeepSeek', models: [
  { id: 'deepseek-v4-flash', name: 'DeepSeek-V4-Flash', description: 'Fast, efficient, and economical; suited to focused, routine, or parallel tasks.', reasoning: { defaultEffort: 'high', efforts: EFFORTS } },
  { id: 'deepseek-v4-pro', name: 'DeepSeek-V4-Pro', reasoning: { defaultEffort: 'max', efforts: EFFORTS } },
  { id: 'plain', name: 'Plain' },
] }];
const makeStore = (initial) => {
  let state = initial; const subs = new Set();
  return { getSnapshot: () => state, subscribe: (fn) => { subs.add(fn); return () => subs.delete(fn); },
    update: (patch) => { state = { ...state, ...patch }; subs.forEach((fn) => fn()); } };
};
const dir = {
  store: makeStore({ groups: GROUPS, current: { provider: 'deepseek-official', model: 'deepseek-v4-flash', reasoningEffort: 'high' }, status: 'ready', pending: null, error: null }),
  calls: [], delay: 600, fail: null,
  load() { return Promise.resolve(this.store.getSnapshot()); },
  select(selection) {
    this.calls.push(selection);
    this.store.update({ status: 'selecting', pending: selection, error: null });
    return new Promise((resolve) => setTimeout(() => {
      if (this.fail !== null) {
        const error = this.fail; this.fail = null;
        this.store.update({ status: 'error', pending: null, error: error.code + ': ' + error.message });
        resolve({ ok: false, error }); return;
      }
      this.store.update({ status: 'ready', pending: null, current: { ...selection } });
      resolve({ ok: true });
    }, this.delay));
  },
};
window.__dir = dir;
window.__picker = __mp.installModelPicker({
  models: { directoryFor: (id) => { if (id !== 'session-a') throw new Error('ui-model-selection: session "' + id + '" resolved no scope'); return dir; } },
  sessionFallback: () => null,
  locale: null,
});
`;

const page = '<!doctype html><html data-codex-ui lang="zh-CN"><head><meta charset="utf-8">'
  + '<style>' + theme + '</style>'
  + '<style>body{margin:0;height:100vh;font:13px/1.5 "Segoe UI","Microsoft YaHei",sans-serif;background:var(--dsw-alias-bg-base)}'
  + '.stage{position:fixed;left:40px;right:40px;bottom:30px}'
  + '[data-composer-card]{display:flex;flex-direction:column}'
  + '.bar{display:flex;justify-content:flex-end;align-items:center;gap:4px}'
  + '._7KE1Ra_root{display:flex}._7KE1Ra_trigger{height:28px;border:0;background:none}</style>'
  + '</head><body>'
  + '<div data-conversation-session="session-a"><div data-conversation-scroll class="stage"><div data-composer-card>'
  + '<div data-input-scroll style="height:44px"></div>'
  + '<div class="bar"><div><div data-slot="conversation.input.model" style="display:contents">'
  + '<div class="_7KE1Ra_root"><button type="button" class="_7KE1Ra_trigger">Host seat</button></div>'
  + '</div></div></div>'
  + '</div></div></div>'
  /* 子代理会话：宿主在那里返回 null（席位是空的），组件不许出头。 */
  + '<div data-conversation-session="session-sub"><div data-slot="conversation.input.model" style="display:contents" id="sub-seat"></div></div>'
  + '<script>const __mp = ' + pickerIife + ';\n' + fake + '</script>'
  + '</body></html>';

fs.mkdirSync(join(tmpdir(), 'codex-ui-fixtures'), { recursive: true });
const htmlPath = join(tmpdir(), 'codex-ui-fixtures', 'power-rail-verify.html');
fs.writeFileSync(htmlPath, page);

const PORT = 9357;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PROFILE = tempDir('dsh-cdp-power-rail');
fs.rmSync(PROFILE, { recursive: true, force: true });
const child = spawn(chromePath(), ['--headless=new', '--remote-debugging-port=' + PORT, '--user-data-dir=' + PROFILE, '--no-first-run', '--disable-gpu', '--hide-scrollbars', '--window-size=900,640', 'about:blank'], { stdio: 'ignore' });
let info; for (let i = 0; i < 60 && !info; i++) { try { const r = await fetch('http://127.0.0.1:' + PORT + '/json/version'); if (r.ok) info = await r.json(); } catch {} if (!info) await sleep(250); }
if (!info) { child.kill(); throw new Error('headless chrome did not start'); }
const ws = new WebSocket(info.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0; const waiting = new Map();
const pageErrors = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.method === 'Runtime.exceptionThrown') pageErrors.push(String(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).slice(0, 300));
  if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
};
const send = (method, params = {}, sid) => new Promise((res, rej) => { const id = ++seq; waiting.set(id, (m) => m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result)); ws.send(JSON.stringify({ id, method, params, ...(sid ? { sessionId: sid } : {}) })); });
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
const S = (method, params) => send(method, params, sessionId);
const evalJs = async (expr) => {
  const r = await S('Runtime.evaluate', { expression: expr, returnByValue: true });
  if (r.exceptionDetails) throw new Error('page: ' + JSON.stringify(r.exceptionDetails).slice(0, 400));
  return r.result.value;
};
const J = async (expr) => JSON.parse(await evalJs('JSON.stringify(' + expr + ')'));
const mouse = async (type, x, y, buttons = 0) => S('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' ? (buttons ? 'left' : 'none') : 'left', buttons, clickCount: 1 });
const click = async (x, y) => { await mouse('mouseMoved', x, y); await mouse('mousePressed', x, y, 1); await mouse('mouseReleased', x, y, 0); };
const key = async (k, code) => {
  await S('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code: k, windowsVirtualKeyCode: code });
  await S('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k, windowsVirtualKeyCode: code });
};
const center = async (sel) => J('(() => { const r = document.querySelector(' + JSON.stringify(sel) + ').getBoundingClientRect(); return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)]; })()');
const media = async (reduced) => S('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }] });

await S('Page.enable');
await S('Runtime.enable');
/* DPR 2：0.5px 的 border 在 DPR 1 下会被 Chromium 抬成 1 个设备像素，量不出发丝线（其余夹具同为 2）。 */
await S('Emulation.setDeviceMetricsOverride', { width: 900, height: 640, deviceScaleFactor: 2, mobile: false });
await media(false);
await S('Page.navigate', { url: 'file:///' + htmlPath.replaceAll('\\', '/') + '?v=' + Date.now() });
await sleep(1200);

const results = [];
const check = (name, ok, detail) => results.push([name, !!ok, detail]);
const near = (a, b, tol = 0.6) => Math.abs(a - b) <= tol;

/** 一次取全弹层 / 轨的几何与状态。 */
const STATE = `(() => {
  const q = (s) => document.querySelector(s);
  const box = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height, r: b.right, b: b.bottom }; };
  const cs = (e, p) => e ? getComputedStyle(e).getPropertyValue(p) : null;
  const pop = q('.codex-mp-popover'); const root = q('.codex-mp-root'); const trig = q('.codex-mp-trigger');
  return {
    open: pop !== null && !pop.hidden,
    pop: box(pop), trig: box(trig), root: box(root), track: box(q('.codex-mp-track')), range: box(q('.codex-mp-range')),
    thumb: box(q('.codex-mp-thumb-scale')),
    ticks: [...document.querySelectorAll('.codex-mp-tick')].map((t) => ({ ...box(t), sel: t.dataset.selected, color: cs(t, 'background-color') })),
    rows: document.querySelectorAll('.codex-mp-row').length,
    checked: [...document.querySelectorAll('.codex-mp-row')].map((r) => r.getAttribute('aria-checked')),
    now: root ? root.getAttribute('aria-valuenow') : null,
    pos: root ? root.style.getPropertyValue('--codex-mp-pos') : null,
    value: q('.codex-mp-effort-value') ? q('.codex-mp-effort-value').textContent : null,
    spinner: !!q('.codex-mp-effort-value .codex-mp-spinner'),
    trigEffort: trig ? [...trig.querySelectorAll('.codex-mp-effort-text')].filter((e) => e.dataset.active === 'true').map((e) => e.textContent).join() : null,
    trigModel: trig ? trig.querySelector('.codex-mp-trigger-model').textContent : null,
    expanded: trig ? trig.getAttribute('aria-expanded') : null,
    error: q('.codex-mp-error') && !q('.codex-mp-error').hidden ? q('.codex-mp-error').textContent : null,
    calls: window.__dir.calls.length, lastCall: window.__dir.calls.at(-1) ?? null, status: window.__dir.store.getSnapshot().status,
    focus: document.activeElement ? document.activeElement.className : null,
    kbd: root ? root.dataset.keyboardFocused ?? null : null,
    thumbOutline: cs(q('.codex-mp-thumb-scale'), 'outline'),
  };
})()`;
const state = () => J(STATE);

/* ── 1. 席位顶替 ───────────────────────────────────────────────────────── */
const seat = await J(`(() => {
  const slot = document.querySelector('[data-conversation-session="session-a"] [data-slot="conversation.input.model"]');
  const host = slot.querySelector('._7KE1Ra_root'); const ours = slot.querySelector('.codex-mp-trigger');
  const cs = ours ? getComputedStyle(ours) : null;
  return { host: getComputedStyle(host).display, ours: ours !== null, h: ours ? ours.getBoundingClientRect().height : 0,
    radius: cs ? cs.borderTopLeftRadius : null, bg: cs ? cs.backgroundColor : null,
    sub: document.getElementById('sub-seat').children.length, text: ours ? ours.textContent : '' };
})()`);
check('席位里有自建触发器', seat.ours, seat.text);
check('宿主那一格 display:none（仍在 DOM 里）', seat.host === 'none', seat.host);
check('宿主没渲染的席位（子代理会话）不接管', seat.sub === 0, seat.sub + ' 个子节点');
check('触发器 28px 高、全圆角胶囊、默认透明', near(seat.h, 28) && seat.radius === '999px' && seat.bg === 'rgba(0, 0, 0, 0)', JSON.stringify(seat));

/* ── 2. 弹层与轨几何 ───────────────────────────────────────────────────── */
const [tx, ty] = await center('.codex-mp-trigger');
await click(tx, ty);
await sleep(80);
const anim = await J(`(() => { const cs = getComputedStyle(document.querySelector('.codex-mp-popover')); return { name: cs.animationName, dur: cs.animationDuration, delay: cs.animationDelay, ease: cs.animationTimingFunction, origin: cs.transformOrigin }; })()`);
await sleep(500);
let st = await state();
const popStyle = await J(`(() => { const cs = getComputedStyle(document.querySelector('.codex-mp-popover')); return { radius: cs.borderTopLeftRadius, pad: cs.paddingTop, shadow: cs.boxShadow, bg: cs.backgroundColor }; })()`);
check('点触发器打开弹层（aria-expanded=true）', st.open && st.expanded === 'true', JSON.stringify({ open: st.open, expanded: st.expanded }));
check('弹层宽 254px（Codex spacing × 63.5）', near(st.pop.w, 254), st.pop.w);
check('弹层在触发器上方 8px、右沿对齐（宿主 place()）', near(st.trig.y - st.pop.b, 8, 1) && near(st.trig.r, st.pop.r, 1), 'gap=' + (st.trig.y - st.pop.b) + ' right=' + (st.trig.r - st.pop.r));
check('弹层 18px 圆角 + 内衬 5px + 菜单软影', popStyle.radius === '18px' && popStyle.pad === '5px' && /0px 8px 32px/.test(popStyle.shadow), JSON.stringify(popStyle));
check('入场 .32s cubic-bezier(.23,1,.32,1) 30ms，从右下角长出', anim.name === 'codex-mp-enter' && anim.dur === '0.32s' && anim.delay === '0.03s' && /0\.23, 1, 0\.32, 1/.test(anim.ease), JSON.stringify(anim));
check('列表三行、当前模型打勾', st.rows === 3 && st.checked[0] === 'true', JSON.stringify(st.checked));
/* 宿主字典缺席（本夹具 locale 为 null）时，内置模型的说明要落回目录原文，不能把字典键名画出来。 */
const desc = await evalJs('(document.querySelector(".codex-mp-row-desc") || {}).textContent || null');
check('说明文字是目录原文、不是字典键名', typeof desc === 'string' && desc.startsWith('Fast, efficient') && !desc.startsWith('option.'), desc);
const railStyle = await J(`(() => { const t = getComputedStyle(document.querySelector('.codex-mp-track')); const th = getComputedStyle(document.querySelector('.codex-mp-thumb'));
  const c = getComputedStyle(document.querySelector('.codex-mp-container')); const rg = getComputedStyle(document.querySelector('.codex-mp-range'));
  return { tRadius: t.borderTopLeftRadius, tBg: t.backgroundColor, tRing: t.boxShadow, thBg: th.backgroundColor, thBorder: th.borderTopWidth + ' ' + th.borderTopStyle, thShadow: th.boxShadow,
    cH: c.height, cPad: c.paddingTop + ' ' + c.paddingLeft, rRadius: rg.borderTopLeftRadius + ' ' + rg.borderTopRightRadius, touch: getComputedStyle(document.querySelector('.codex-mp-root')).touchAction }; })()`);
check('轨 24px 高、12px 圆角', near(st.track.h, 24) && railStyle.tRadius === '12px', st.track.h + ' / ' + railStyle.tRadius);
check('轨底 = 前景 10%、0.5px 内描边', /0\.1\)$/.test(railStyle.tBg) && /inset/.test(railStyle.tRing) && /0\.5px/.test(railStyle.tRing), railStyle.tBg + ' | ' + railStyle.tRing);
check('容器 32px、上下 2 / 左右 6；根 28px、touch-action none', railStyle.cH === '32px' && railStyle.cPad === '2px 6px' && near(st.root.h, 28) && railStyle.touch === 'none', JSON.stringify(railStyle));
/* 描边断言**声明值**：Chromium 153 把 0.5px 的 border 在计算值里取整成 1px（DPR 2 也一样），
   Codex 源码同样写的是 border .5px、跑在同一个引擎上，渲染结果一致；计算值量不出「写的是不是 0.5」。 */
const thumbDecl = await evalJs(`(() => { for (const sheet of document.styleSheets) for (const rule of sheet.cssRules) {
  if (rule.selectorText && / \\.codex-mp-thumb$/.test(rule.selectorText)) return rule.style.getPropertyValue('border'); }
  return null; })()`);
check('拇指 28px 白圆片、声明 0.5px 描边、0 0 2px 微影', near(st.thumb.w, 28) && railStyle.thBg === 'rgb(255, 255, 255)' && /^0\.5px solid/.test(thumbDecl ?? '') && /0px 0px 2px/.test(railStyle.thShadow), JSON.stringify({ w: st.thumb.w, bg: railStyle.thBg, decl: thumbDecl, computed: railStyle.thBorder }));
check('档位圆点 4px × 4 个', st.ticks.length === 4 && st.ticks.every((t) => near(t.w, 4) && near(t.h, 4)), st.ticks.length);
const W = st.root.w;
const expectX = (i) => st.root.x + 14 + (W - 28) * i / 3;
check('圆点等距落在拇指行程 [14, 宽 − 14] 上', st.ticks.every((t, i) => near(t.x + t.w / 2, expectX(i))), st.ticks.map((t) => Math.round((t.x + t.w / 2 - st.root.x) * 10) / 10).join(' / '));
check('拇指中心 = 生效档（High = 第 3 档）', near(st.thumb.x + 14, expectX(2)) && st.now === '2', 'thumb=' + (st.thumb.x + 14 - st.root.x) + ' now=' + st.now);
check('强调色条止于拇指中线、只圆左侧两角', near(st.range.r, st.thumb.x + 14) && railStyle.rRadius === '12px 0px', 'range.r=' + st.range.r + ' thumb=' + (st.thumb.x + 14));
check('走过的圆点 30% 白、没走到的另一色', st.ticks[0].sel === 'true' && st.ticks[3].sel === 'false' && st.ticks[0].color === 'rgba(255, 255, 255, 0.3)' && st.ticks[3].color !== st.ticks[0].color, st.ticks.map((t) => t.sel + ':' + t.color).join(' | '));
if (SHOT) {
  const s = await S('Page.captureScreenshot', { format: 'png', clip: { x: st.pop.x - 20, y: st.pop.y - 20, width: st.pop.w + 40, height: st.trig.b - st.pop.y + 40, scale: 1 } });
  fs.writeFileSync(join(EVID, 'power-rail-verify.png'), Buffer.from(s.data, 'base64'));
}

/* ── 3. 拖动：中途不提交、松手对齐提交一次；pending 不回弹、不清空、有转圈 ───── */
const thumbX = Math.round(st.thumb.x + 14), railY = Math.round(st.root.y + st.root.h / 2);
await mouse('mouseMoved', thumbX, railY);
await mouse('mousePressed', thumbX, railY, 1);
for (const x of [thumbX - 30, thumbX - 80, Math.round(st.root.x - 20)]) { await mouse('mouseMoved', x, railY, 1); await sleep(30); }
st = await state();
check('拖动中不提交（select 调用 0 次）', st.calls === 0, 'calls=' + st.calls);
check('拖动中拇指跟随指针（越界夹到 0）', st.pos === '0', 'pos=' + st.pos);
await mouse('mouseReleased', Math.round(st.root.x - 20), railY, 0);
await sleep(120);
st = await state();
check('松手提交一次、对齐到最左档 off', st.calls === 1 && st.lastCall && st.lastCall.reasoningEffort === 'off', JSON.stringify(st.lastCall));
check('往返中（selecting）轨停在新档、不回弹', st.status === 'selecting' && st.now === '0' && st.pos === '0', 'status=' + st.status + ' now=' + st.now);
check('往返中列表不清空', st.rows === 3, 'rows=' + st.rows);
check('往返中档位名旁转圈、触发器已按新档显示', st.spinner && st.trigEffort === 'Off', 'spinner=' + st.spinner + ' trig=' + st.trigEffort);
await sleep(800);
st = await state();
check('往返结束：转圈撤掉、弹层仍开着（改档不关）', !st.spinner && st.open && st.now === '0' && st.value === 'Off', JSON.stringify({ spinner: st.spinner, open: st.open, value: st.value }));

/* ── 4. 键盘 ───────────────────────────────────────────────────────────── */
await evalJs('document.querySelector(".codex-mp-root").focus()');
await key('ArrowRight', 39);
await sleep(700);
st = await state();
check('→ 进一档（low）', st.lastCall.reasoningEffort === 'low' && st.now === '1', JSON.stringify(st.lastCall));
check('键盘焦点：拇指上 2px 焦点环（offset 0）', st.kbd === 'true' && /2px/.test(st.thumbOutline) && /solid/.test(st.thumbOutline), st.thumbOutline);
await key('End', 35);
await sleep(700);
st = await state();
check('End 到最后一档（max）', st.lastCall.reasoningEffort === 'max' && st.now === '3', JSON.stringify(st.lastCall));
const before = st.calls;
await key('End', 35);
await sleep(200);
st = await state();
check('同一档不重复提交', st.calls === before, 'calls ' + before + ' → ' + st.calls);
await key('Home', 36);
await sleep(700);
st = await state();
check('Home 回第一档（off）', st.lastCall.reasoningEffort === 'off' && st.now === '0', JSON.stringify(st.lastCall));

/* ── 5. 失败：宿主把会话占用报回来 ───────────────────────────────────────── */
await evalJs('window.__dir.fail = { code: "session/writer-held", message: "held" }; "ok"');
await key('ArrowRight', 39);
await sleep(800);
st = await state();
check('提交失败：弹层顶上出现占用提示', st.error !== null && /(已被占用|already in use)/.test(st.error), st.error);
check('提交失败：轨退回生效档', st.now === '0', 'now=' + st.now);

/* ── 6. Escape / 换模型 ───────────────────────────────────────────────── */
await key('Escape', 27);
await sleep(150);
st = await state();
check('Escape 关闭并把焦点还给触发器', !st.open && st.expanded === 'false' && st.focus === 'codex-mp-trigger', JSON.stringify({ open: st.open, focus: st.focus }));
await click(tx, ty);
await sleep(500);
const [rx, ry] = await J(`(() => { const r = document.querySelectorAll('.codex-mp-row')[1].getBoundingClientRect(); return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)]; })()`);
await click(rx, ry);
await sleep(120);
const rowBusy = await J(`(() => { const r = document.querySelectorAll('.codex-mp-row')[1]; return { busy: r.getAttribute('aria-busy'), spin: !!r.querySelector('.codex-mp-spinner') }; })()`);
check('换模型往返中：那一行行尾转圈', rowBusy.busy === 'true' && rowBusy.spin, JSON.stringify(rowBusy));
await sleep(800);
st = await state();
check('换模型连带该模型的默认档提交（pro → max）', st.lastCall.model === 'deepseek-v4-pro' && st.lastCall.reasoningEffort === 'max', JSON.stringify(st.lastCall));
check('换模型成功后关弹层、触发器换名', !st.open && st.trigModel === 'DeepSeek-V4-Pro' && st.trigEffort === 'Max', st.trigModel + ' · ' + st.trigEffort);

/* ── 7. reduced-motion ─────────────────────────────────────────────────── */
await media(true);
await click(tx, ty);
await sleep(300);
const rm = await J(`(() => { const p = document.querySelector('.codex-mp-popover'); return { attr: p.dataset.reducedMotion, anim: getComputedStyle(p).animationName, thumb: getComputedStyle(document.querySelector('.codex-mp-thumb-scale')).transitionDuration }; })()`);
check('reduced-motion：入场动画取消、拇指不过渡', rm.attr === 'true' && rm.anim === 'none' && /^0s|^1e-05s|0\.00001s/.test(rm.thumb), JSON.stringify(rm));
/* 鼠标打开后焦点在触发器上：Escape 也得关（宿主的键盘处理挂在整格根上）。 */
const focusBefore = await evalJs('document.activeElement ? document.activeElement.className : null');
await key('Escape', 27);
await sleep(150);
st = await state();
check('鼠标打开后（焦点在触发器）Escape 也能关', focusBefore === 'codex-mp-trigger' && !st.open, 'focus=' + focusBefore + ' open=' + st.open);
await media(false);

/* ── 8. 深色 ───────────────────────────────────────────────────────────── */
await evalJs('document.body.setAttribute("data-ds-dark-theme", ""); "ok"');
await click(tx, ty);
await sleep(500);
const dark = await J(`(() => { const p = getComputedStyle(document.querySelector('.codex-mp-popover')); const th = getComputedStyle(document.querySelector('.codex-mp-thumb'));
  return { shadow: p.boxShadow, bg: p.backgroundColor, thumb: th.backgroundColor, border: th.borderTopColor, track: getComputedStyle(document.querySelector('.codex-mp-track')).boxShadow }; })()`);
st = await state();
check('深色下弹层打开', st.open && near(st.pop.w, 254), 'open=' + st.open);
check('深色：菜单影 50% 黑 + 5% 亮环（暗色靠填充分层）', /rgba\(0, 0, 0, 0\.5\) 0px 8px 32px/.test(dark.shadow) && dark.bg === 'rgb(33, 33, 33)', JSON.stringify(dark));
check('深色：拇指仍是白片、描边 20% 白、轨环 12% 白', dark.thumb === 'rgb(255, 255, 255)' && dark.border === 'rgba(255, 255, 255, 0.2)' && /rgba\(255, 255, 255, 0\.12\)/.test(dark.track), JSON.stringify(dark));
if (SHOT) {
  const p = await state();
  const s = await S('Page.captureScreenshot', { format: 'png', clip: { x: p.pop.x - 20, y: p.pop.y - 20, width: p.pop.w + 40, height: p.trig.b - p.pop.y + 40, scale: 1 } });
  fs.writeFileSync(join(EVID, 'power-rail-verify-dark.png'), Buffer.from(s.data, 'base64'));
}
await key('Escape', 27);
await evalJs('document.body.removeAttribute("data-ds-dark-theme"); "ok"');

/* ── 9. 开关 ───────────────────────────────────────────────────────────── */
await evalJs('window.__picker.setEnabled(false); "ok"');
await sleep(100);
const off = await J(`(() => ({ ours: document.querySelectorAll('.codex-mp-trigger').length, host: getComputedStyle(document.querySelector('._7KE1Ra_root')).display }))()`);
check('关掉：自建触发器撤走、宿主那一格复原', off.ours === 0 && off.host !== 'none', JSON.stringify(off));
await evalJs('window.__picker.setEnabled(true); "ok"');
await sleep(100);
const on = await J(`(() => ({ ours: document.querySelectorAll('.codex-mp-trigger').length, host: getComputedStyle(document.querySelector('._7KE1Ra_root')).display }))()`);
check('再打开：重新接管', on.ours === 1 && on.host === 'none', JSON.stringify(on));
/* React 换掉宿主子节点：标记不会丢，因为根本没有标记 —— 只看我们在不在席。 */
await evalJs(`(() => { const slot = document.querySelector('[data-conversation-session="session-a"] [data-slot="conversation.input.model"]');
  const fresh = document.createElement('div'); fresh.className = '_7KE1Ra_root'; fresh.innerHTML = '<button class="_7KE1Ra_trigger">Host seat 2</button>';
  slot.querySelector('._7KE1Ra_root').replaceWith(fresh); return 'ok'; })()`);
await sleep(50);
const swapped = await J(`(() => { const h = document.querySelector('._7KE1Ra_root'); return { host: getComputedStyle(h).display, ours: document.querySelectorAll('.codex-mp-trigger').length }; })()`);
check('宿主换掉自己的子节点后仍隐藏、不闪回', swapped.host === 'none' && swapped.ours === 1, JSON.stringify(swapped));
check('页面没有未捕获异常', pageErrors.length === 0, pageErrors.join(' | ') || '0');

ws.close(); child.kill();
let pass = 0;
for (const [n, ok, d] of results) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? '   [' + String(d).slice(0, 160) + ']' : '')); if (ok) pass += 1; }
console.log('\n' + (pass === results.length ? 'ALL PASS' : 'FAILED') + ' (' + pass + '/' + results.length + ')');
process.exit(pass === results.length ? 0 : 1);
