#!/usr/bin/env node
/**
 * settings-modal-verify.mjs — 设置模态框「结构层 + 视觉层」的真 GUI 验收。
 *
 * 覆盖两件交付物的集成结果：
 *   · src/client/settings-modal.js         结构层（返回按钮 / 搜索框 / 分组标题 / 排序 / 过滤）
 *   · skins/codex-ink/settings-modal.css   视觉层（注入节点的样式是否真的命中）
 *
 * 为什么必须真 GUI：分组与过滤改的是宿主 navList 的真实子节点，而宿主的 React 重渲染行为
 * （关闭重开整棵重建、选中态搬家时整条重写 className）只有在真宿主里才成立，夹具复刻不出来。
 * 夹具能测纯函数，测不了这一层。
 *
 * 用法：
 *   1) DSH_HOME=<临时家> dsh --profile <p> --port 3199 --no-open   （终端打印带 token 的 URL）
 *   2) node scripts/live/settings-modal.mjs --url "http://127.0.0.1:3199/?token=..."
 *
 * 可选：
 *   --out <dir>     截图目录（默认 docs/recon）
 *   --cdp-port <n>  CDP 调试端口（默认 9343）
 *   --dpr <n>       设备像素比（默认 1.5）
 *   --explore       只把现场结构打出来，不做断言
 *
 * 幂等：脚本自己收尾（清搜索框、摘暗色、关模态），反复跑结果一致。
 * 退出码：非 0 = 有断言未通过。
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
const flag = (name) => process.argv.includes('--' + name);
const TOKEN_URL = arg('url', '');
const OUT_DIR = arg('out', join(WB, 'docs', 'recon'));
const CHROME = arg('chrome', '') || chromePath();
const PORT = Number(arg('cdp-port', '9343'));
const DPR = Number(arg('dpr', '1.5'));
const EXPLORE = flag('explore');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!TOKEN_URL) { console.error('缺少 --url "http://127.0.0.1:<port>/?token=..."'); process.exit(2); }

/* ── 契约快照：分组映射表 ─────────────────────────────────────────────────
   这是 src/client/settings-modal.js 里 GROUPS 的期望值。下面有一道「与源文件对账」的前置检查：
   源文件改了映射而这里没跟着改，脚本会**先报错**而不是拿旧快照去测新实现。 */
const EXPECT_GROUPS = [
  { id: 'personal', label: '个人', items: ['账号与余额', '通用设置', '皮肤', '宠物', '使用统计'] },
  { id: 'integrations', label: '集成', items: ['内置插件', 'Web 插件', '订阅服务', '记忆系统', '创意工坊'] },
  { id: 'coding', label: '编码', items: ['模型', 'Agent 预设', 'LLM Verifier'] },
  { id: 'archive', label: '已归档', items: ['已归档会话'] },
];
/* 环境相关缺位按可选处理：「账号与余额」只在已存凭据时才注册；「皮肤」是第三方 skin-center
   的设置页，没装/禁用该适配器的环境里整个条目不存在（无适配器负向验证的实测）。 */
const OPTIONAL_ITEMS = new Set(['账号与余额', '皮肤']);

{
  const src = fs.readFileSync(join(WB, 'src', 'client', 'settings-modal.js'), 'utf8');
  const block = /const GROUPS = \[([\s\S]*?)\n\];/.exec(src);
  if (block === null) {
    console.error('前置检查失败：src/client/settings-modal.js 里找不到 GROUPS 字面量，契约快照无法对账');
    process.exit(2);
  }
  const actual = [...block[1].matchAll(/\{ id: '([a-z]+)', label: '([^']+)', items: \[([^\]]*)\] \}/g)]
    .map((m) => ({ id: m[1], label: m[2], items: m[3].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean) }));
  if (JSON.stringify(actual) !== JSON.stringify(EXPECT_GROUPS)) {
    console.error('前置检查失败：脚本里的 EXPECT_GROUPS 与 src/client/settings-modal.js 的 GROUPS 已经不一致。');
    console.error('  源文件：' + JSON.stringify(actual));
    console.error('  脚本内：' + JSON.stringify(EXPECT_GROUPS));
    console.error('  改映射是行为变更 —— 请同步更新本脚本顶部的 EXPECT_GROUPS。');
    process.exit(2);
  }
}

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
  '--user-data-dir=' + tempDir('dsh-cdp-settings-modal'), '--no-first-run',
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
const send = (method, params = {}, sid) => new Promise((res, rej) => {
  const id = ++seq;
  waiting.set(id, (m) => (m.error ? rej(new Error(method + ': ' + JSON.stringify(m.error))) : res(m.result)));
  ws.send(JSON.stringify({ id, method, params, ...(sid ? { sessionId: sid } : {}) }));
});
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
  if (r.exceptionDetails !== undefined && r.exceptionDetails !== null) {
    throw new Error('页面内求值抛错：' + String(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text).slice(0, 400));
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

/* ── 页面内的取值 API ────────────────────────────────────────────────────
   整段作为**一个自包含闭包**注进页面，挂到 window.__cxs 上。
   必须自包含：这些函数在浏览器里跑，引用不到本文件的任何作用域。
   selector 一律走稳定锚点 —— **宿主优先**：data-shortcut-modal="settings"（宿主自己盖在面板上的
   属性）、data-slot / aria-current / role / tag / 位置索引；适配器的 data-dsh-surface="settings"
   只作兜底（第三方 skin-center 补打，契约自称非永久公共契约，不是唯一锚点、也不是首选）。
   面板定位的**唯一权威来源**是 src/client/settings-modal.js 的 PANEL_SELECTOR，本文件不重复实现它，
   只断言它盖出来的自有锚点 [data-cx-sm-panel] 确实在。
   不碰宿主哈希类名（CSS-Modules，每次构建都变）。 */


function cxsInstall() {
  /** 侧栏列表容器：nav 里最后一个「不是我们注入的」子节点。 */
  const list = () => {
    const panel = document.querySelector('[data-shortcut-modal="settings"]');
    if (panel === null) return null;
    const nav = Array.from(panel.children).find((el) => el.tagName === 'NAV');
    if (nav === undefined) return null;
    const hit = Array.from(nav.children)
      .filter((el) => el.getAttribute('data-codex-ui-injected') !== 'settings-modal').pop();
    return hit === undefined ? null : hit;
  };
  /**
   * 一个宿主项的「真实可见性」——读 **computed display**，不是读属性也不是读类名。
   * 只认属性的断言会漏掉「类名被宿主抹掉、属性还在但没人认」这一类故障（C1 实测踩过）。
   */
  const visible = (el) => getComputedStyle(el).display !== 'none';
  /** 视觉顺序：inline order 优先，没有就取 computed。 */
  const order = (el) => (el.style.order !== '' ? Number(el.style.order) : Number(getComputedStyle(el).order));
  const hostCells = (l) => Array.from(l.children).filter((el) => el.tagName === 'BUTTON');
  const byText = (l, text) => hostCells(l).find((el) => el.textContent.trim() === text) || null;

  const snapshot = () => {
    const l = list();
    if (l === null) return null;
    const nav = l.parentElement;
    const items = Array.from(l.children).map((el, i) => ({
      i: i,
      tag: el.tagName,
      part: el.getAttribute('data-cx-sm-part'),
      group: el.getAttribute('data-cx-sm-group'),
      text: (el.textContent || '').trim(),
      order: order(el),
      injected: el.getAttribute('data-codex-ui-injected') === 'settings-modal',
      hidden: !visible(el),
      display: getComputedStyle(el).display,
      hasHiddenAttr: el.hasAttribute('data-cx-sm-hidden'),
      hasHiddenClass: el.classList.contains('cx-sm-hidden'),
    }));
    const flow = items.slice().sort((a, b) => a.order - b.order || a.i - b.i);
    const back = nav.querySelector('[data-cx-sm-part="back"]');
    const input = nav.querySelector('[data-cx-sm-part="search-input"]');
    return {
      items: items,
      flow: flow,
      hostItems: items.filter((r) => !r.injected && r.tag === 'BUTTON'),
      headers: items.filter((r) => r.injected && String(r.part).indexOf('group:') === 0),
      hasBack: back !== null,
      backText: back === null ? null : back.textContent.trim(),
      backAria: back === null ? null : back.getAttribute('aria-label'),
      backIndex: Array.from(nav.children).findIndex((el) => el.getAttribute('data-cx-sm-part') === 'back'),
      searchIndex: Array.from(nav.children).findIndex((el) => el.getAttribute('data-cx-sm-part') === 'search'),
      titleIndex: Array.from(nav.children).findIndex((el) => el.tagName === 'DIV'
        && el.getAttribute('data-codex-ui-injected') !== 'settings-modal' && el.querySelector('button') === null),
      placeholder: input === null ? null : input.placeholder,
      /* 「属性说该隐藏、但实际渲染出来了」= 隐藏态失效，单独点名。 */
      leaked: items.filter((r) => r.hasHiddenAttr && r.display !== 'none').map((r) => r.text),
      /* 每个注入件在整份文档里的出现次数（重复 / 孤儿都靠它抓）。 */
      uniq: Array.from(document.querySelectorAll('[data-cx-sm-part]')).reduce((acc, el) => {
        const k = el.getAttribute('data-cx-sm-part');
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {}),
      injectedCount: document.querySelectorAll('[data-codex-ui-injected="settings-modal"]').length,
      activeLabel: (() => {
        const el = hostCells(l).find((c) => c.getAttribute('aria-current') === 'true');
        return el === undefined ? null : el.textContent.trim();
      })(),
    };
  };

  /** 注入节点的样式命中（视觉层的真凭据，不是读 CSS 源码）。 */
  const styleHits = () => {
    const pick = (sel, props) => {
      const el = document.querySelector(sel);
      if (el === null) return { present: false };
      const cs = getComputedStyle(el);
      const out = { present: true };
      for (const p of props) out[p] = cs[p];
      return out;
    };
    return {
      back: pick('[data-cx-sm-part="back"]', ['display', 'fontSize', 'cursor', 'color']),
      group: pick('[data-cx-sm-part^="group:"]', ['display', 'fontSize', 'color']),
      search: pick('[data-cx-sm-part="search"]', ['display', 'height', 'borderTopLeftRadius', 'paddingLeft']),
      searchInput: pick('[data-cx-sm-part="search-input"]', ['fontSize', 'height']),
      hasAttrSelector: Array.from(document.querySelectorAll('style[data-plugin="codex-ui"]'))
        .map((s) => s.textContent).join('').indexOf('[data-cx-sm-hidden]') >= 0,
    };
  };

  /**
   * 内容列里页头的形态。
   * 注入形态（B2 契约）：header 行 > 最左侧 div.cx-sm-pagehead[data-cx-sm-part="pagehead"]
   *                                                     > div.cx-sm-title[data-cx-sm-part="pagehead-title"]
   * 判据同样读**计算样式**：标题必须真的比正文大，否则「注入了但没有视觉」也算不合格。
   */
  const pagehead = () => {
    const panel = document.querySelector('[data-shortcut-modal="settings"]');
    if (panel === null) return null;
    const content = Array.from(panel.children).filter((e) => e.tagName !== 'NAV').pop() || null;
    if (content === null) return null;
    const head = document.querySelector('[data-cx-sm-part="pagehead"]');
    const title = document.querySelector('[data-cx-sm-part="pagehead-title"]');
    if (head === null || title === null) return { present: false, headCount: document.querySelectorAll('[data-cx-sm-part="pagehead"]').length };
    const parent = head.parentElement;
    const hs = getComputedStyle(title);
    const rowCs = getComputedStyle(parent);
    const firstInRow = parent.firstElementChild === head;
    const rowIsHeader = parent.querySelector('[data-slot="settings.action"]') !== null;
    /* 内容列里所有非注入子节点的首行文本 —— 用来证明「页头没有把宿主原有结构顶掉」。 */
    return {
      present: true,
      headCount: document.querySelectorAll('[data-cx-sm-part="pagehead"]').length,
      titleCount: document.querySelectorAll('[data-cx-sm-part="pagehead-title"]').length,
      text: title.textContent.trim(),
      fontSize: hs.fontSize,
      fontWeight: hs.fontWeight,
      display: hs.display,
      parentIsDirectChildOfContent: parent.parentElement === content,
      parentHasActionSeat: rowIsHeader,
      firstInRow: firstInRow,
      rowIsFlex: rowCs.display === 'flex',
      headClass: head.className,
      titleClass: title.className,
      tag: title.tagName,
    };
  };

  /** 某个宿主项的屏幕中心点（点它用真实鼠标事件，不用 el.click()）。 */
  const itemBox = (text) => {
    const l = list();
    if (l === null) return null;
    const el = byText(l, text);
    if (el === null) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  };

  /** 设置搜索框的值，并派发真实 input 事件（等价于用户输入）。 */
  const setQuery = (value) => {
    const el = document.querySelector('[data-cx-sm-part="search-input"]');
    if (el === null) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  };

  /** 往列表里塞一个「第三方」项（结构克隆自真实宿主项），返回是否成功。 */
  const injectUnknown = (text) => {
    const l = list();
    if (l === null) return false;
    const proto = hostCells(l)[0];
    if (proto === undefined) return false;
    const clone = proto.cloneNode(true);
    const span = clone.querySelector('span');
    if (span !== null) span.textContent = text;
    clone.removeAttribute('aria-current');
    l.appendChild(clone);
    return true;
  };
  const removeUnknown = (text) => {
    const l = list();
    if (l === null) return false;
    const el = byText(l, text);
    if (el === null) return false;
    el.remove();
    return true;
  };

  /**
   * 行内文字层级：标题必须仍是 label-primary/14px，说明才是 caption 灰。
   *
   * 这个探针是为一个**真实回归**补的：早先 §4.4 写成「行内所有 div」，
   * 把标题一起染成 caption 灰并压到 12px，整页标题层级塌掉，而当时的 69 项断言
   * 没有任何一条覆盖标题层级 —— 全绿也没拦住。所以这里同时取
   * 「令牌基准值」（把 var() 解析成具体色）与实际计算值对比，
   * 而不是硬编码 rgb，主题切换后依然成立。
   */
  const rowType = () => {
    const proxy = document.createElement('div');
    proxy.style.cssText = 'position:absolute;left:-9999px';
    document.body.appendChild(proxy);
    const val = (n) => { proxy.style.color = 'rgb(1, 2, 3)'; proxy.style.color = 'var(' + n + ')'; return getComputedStyle(proxy).color; };
    const primary = val('--dsw-alias-label-primary');
    const caption = val('--dsw-alias-label-caption');
    proxy.remove();
    const rows = [...document.querySelectorAll('[data-slot="settings.general.item"] > *')];
    const titles = [];
    const descs = [];
    const stray = [];
    for (const row of rows) {
      const textEl = [...row.children].find((c) => [...c.children].some((k) => k.tagName === 'DIV'));
      if (textEl === undefined) continue;
      const divs = [...textEl.children].filter((k) => k.tagName === 'DIV');
      if (divs[0] !== undefined) {
        const cs = getComputedStyle(divs[0]);
        titles.push({ text: divs[0].textContent.trim().slice(0, 10), fs: cs.fontSize, color: cs.color });
      }
      if (divs[1] !== undefined) {
        const cs = getComputedStyle(divs[1]);
        descs.push({ text: divs[1].textContent.trim().slice(0, 10), fs: cs.fontSize, color: cs.color });
      }
    }
    /* 控件区的纯数字（如字号步进的 14）不该被文字层级规则顺手染灰压小 */
    for (const el of document.querySelectorAll('[data-slot="settings.general.item"] *')) {
      if (el.children.length === 0 && /^\d+$/.test((el.textContent || '').trim())) {
        const cs = getComputedStyle(el);
        stray.push({ text: el.textContent.trim(), fs: cs.fontSize, color: cs.color });
      }
    }
    return { primary, caption, titleCount: titles.length, descCount: descs.length,
             titles, descs, stray };
  };

  /** 打开设置：点宿主那个 aria-label=设置 的按钮。 */
  const openSettings = () => {
    const b = document.querySelector('button[aria-label="设置"]');
    if (b === null) return false;
    b.click();
    return true;
  };
  /**
   * 面板的**自有锚点**盖印状态（本轮锚点迁移的集成证据）。
   * data-cx-sm-panel 是 src/client/settings-modal.js 的 findPanel() 找到面板后盖的，
   * 视觉层全部形态规则都挂在它下面 —— 它没盖上的话，整份 settings-modal.css 不命中任何元素。
   */
  const panelStamp = () => {
    const panels = [...document.querySelectorAll('[data-cx-sm-panel]')];
    const host = [...document.querySelectorAll('[data-shortcut-modal="settings"], [data-dsh-surface="settings"]')];
    return {
      count: panels.length,
      attr: panels.length > 0 ? panels[0].getAttribute('data-cx-sm-panel') : null,
      hostCount: host.length,
      sameNode: panels.length > 0 && host.length > 0 && panels[0] === host[0],
      shortcutModal: panels.length > 0 ? panels[0].getAttribute('data-shortcut-modal') : null,
      surface: panels.length > 0 ? panels[0].getAttribute('data-dsh-surface') : null,
    };
  };

  /**
   * 令牌的**计算值**（临时元素法，同 rowType 那条的老办法）：挂一个探针在 body 上，
   * 用 color 读 var(--token) 的解析结果 —— 不写死 rgb，换主题/换皮肤都不假失败。
   * 为什么用 color 读：自定义属性不能自引用（在探针上把 --x 设成 var(--x) 会变成无效值），
   * 但把**别的**属性设成 var(--x) 是安全的，读回来的就是该令牌在当前上下文里的真实取值。
   */
  const tokenValue = (name) => {
    const el = document.createElement('div');
    el.style.cssText = 'position:absolute;left:-9999px';
    document.body.appendChild(el);
    const read = (n) => {
      el.style.color = 'var(' + n + ')';
      const v = getComputedStyle(el).color;
      el.style.removeProperty('color');
      return v;
    };
    const out = { layer1: read('--dsw-alias-bg-layer-1'), layer2: read('--dsw-alias-bg-layer-2') };
    out[name] = read(name);
    el.remove();
    return out;
  };

  /**
   * 设置页里的行卡片（「模型」页 rowCard / 「Agent 预设」页 card）的着色状态。
   * 这两页**没有**通用语义锚点，宿主类名是哈希，所以取元素按类令牌（_rowCard / _card 后缀令牌）匹配
   * —— 注意：settings-modal.css §4.3 那条同名规则**已删除**（见该处删除记录），
   * 这里的选择器只用来**读**计算样式，不用来写样式。
   * 选中判定：aria-selected / aria-checked，或 class 里带 Active / Selected / Checked
   * （实测 Agent 预设页的选中卡在 class 里带一个 *_cardActive 状态类；
   *  宿主哈希前缀不写进本文件 —— 它每次构建都变，写下来只会误导后人）。
   */
  const cardState = (token) => {
    /* 类**令牌**匹配，不是 [class$=…] 后缀匹配：选中卡的 class 是 "<hash>_card <hash>_cardActive"，
       以 _cardActive 结尾 —— 后缀匹配会把它整条漏掉（实测：4 张卡只命中 3+1 张未选中的，
       selected=null 假失败）。这正是 settings-modal.css §4.3 删除记录里那条漂移陷阱，
       读样式时同样会咬人。token 传 '_rowCard' / '_card'。 */
    const re = new RegExp('(^|\\s)[\\w-]+' + token + '(?=\\s|$)');
    const cards = [...document.querySelectorAll('li')].filter((el) => typeof el.className === 'string' && re.test(el.className));
    const isSel = (el) => el.matches('[aria-selected="true"], [aria-checked="true"], [aria-current="true"]')
      || /(Active|Selected|Checked)/.test(el.getAttribute('class') || '');
    const info = (el) => ({
      cls: String(el.getAttribute('class') || '').slice(0, 70),
      bg: getComputedStyle(el).backgroundColor,
      selected: isSel(el),
    });
    const visible = cards.filter((el) => el.getBoundingClientRect().width > 0);
    const pick = visible.find((el) => !isSel(el)) || null;
    const selected = visible.find((el) => isSel(el)) || null;
    return { total: cards.length, visible: visible.length,
             pick: pick === null ? null : info(pick),
             selected: selected === null ? null : info(selected),
             all: visible.map(info) };
  };

  const panelCount = () => document.querySelectorAll('[data-shortcut-modal="settings"]').length;
  const orphanCount = () => document.querySelectorAll('[data-codex-ui-injected="settings-modal"]').length;
  const setDark = (on) => {
    if (on) document.body.setAttribute('data-ds-dark-theme', '');
    else document.body.removeAttribute('data-ds-dark-theme');
  };
  window.__cxs = {
    list: list, visible: visible, snapshot: snapshot, styleHits: styleHits, itemBox: itemBox,
    pagehead: pagehead,
    setQuery: setQuery, injectUnknown: injectUnknown, removeUnknown: removeUnknown,
    openSettings: openSettings, panelCount: panelCount, rowType: rowType, orphanCount: orphanCount, setDark: setDark,
    panelStamp: panelStamp, tokenValue: tokenValue, cardState: cardState,
  };
}
await evaluate('(' + cxsInstall.toString() + ')()');

/** 引导弹层：内测声明 / 配置 API Key，重复点直到没有。 */
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

const openSettings = async () => { await evaluate('window.__cxs.openSettings()'); await sleep(2200); };
const clickItem = async (label) => {
  const box = await evaluate('window.__cxs.itemBox(' + JSON.stringify(label) + ')');
  if (box === null) return null;
  await click(box.x, box.y);
  await sleep(1500);
  return box;
};
const setQuery = async (value) => { await evaluate('window.__cxs.setQuery(' + JSON.stringify(value) + ')'); await sleep(900); };
const screenshot = async (file) => {
  const s = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
  fs.writeFileSync(join(OUT_DIR, file), Buffer.from(s.data, 'base64'));
  return file;
};

/* ── 断言基建 ─────────────────────────────────────────────────────────── */
let failed = 0;
let passed = 0;
const ok = (name, extra = '') => { passed += 1; console.log('ok   ' + name + (extra ? '  ' + extra : '')); };
const bad = (name, detail) => { failed += 1; console.error('FAIL ' + name + '\n     ' + detail); };
const check = (name, cond, detail) => (cond ? ok(name, typeof detail === 'string' ? detail : '') : bad(name, String(detail)));
/** 只报第一处差异所在的整串，免得刷屏。 */
const checkEqual = (name, got, want) => {
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  check(name, a === b, a === b ? '' : 'got  = ' + a + '\n     want = ' + b);
};

await dismissOnboarding();
await sleep(800);
await openSettings();
await sleep(1500);

const snap0 = await evaluate('window.__cxs.snapshot()');
if (snap0 === null || snap0 === undefined) {
  console.error('FAIL 设置面板或侧栏列表没找到：结构层可能整体没生效（看下面 console 里的 [codex-ui] warn）');
  console.log('\nPAGE LOGS:\n  ' + pageLogs.slice(0, 15).join('\n  '));
  ws.close(); child.kill();
  process.exit(1);
}

/** 期望的可见视觉流：按分组映射表展开，再挖掉本环境缺位的可选项。 */
const EXPECT_FLOW = EXPECT_GROUPS.flatMap((g) => [[g.id, g.label]].concat(g.items.map((t) => [g.id, t])))
  .filter((row) => !OPTIONAL_ITEMS.has(row[1]) || snap0.hostItems.some((r) => r.text === row[1]));

if (EXPLORE) {
  console.log('SNAPSHOT: ' + JSON.stringify(snap0, null, 1));
  console.log('STYLE HITS: ' + JSON.stringify(await evaluate('window.__cxs.styleHits()'), null, 1));
  await screenshot('c1-explore.png');
  ws.close(); child.kill();
  process.exit(0);
}

const flowOf = (snap) => snap.flow.filter((r) => !r.hidden).map((r) => [r.group, r.text]);
const headerFlowOf = (snap) => snap.flow
  .filter((r) => r.injected && String(r.part).indexOf('group:') === 0 && !r.hidden).map((r) => r.text);

/* ── 1. 侧栏骨架 ───────────────────────────────────────────────────────── */
console.log('\n── 1 侧栏骨架 ──');
console.log('  宿主项 ' + snap0.hostItems.length + ' 个，注入件 ' + snap0.injectedCount + ' 个');
check('返回按钮存在、文案与无障碍名正确',
  snap0.hasBack && snap0.backText.indexOf('返回应用') >= 0 && snap0.backAria === '返回应用',
  'text=' + snap0.backText + ' aria=' + snap0.backAria);
check('顺序：返回在最上 → 搜索框 → 宿主标题 → 列表',
  snap0.backIndex === 0 && snap0.searchIndex === 1 && snap0.titleIndex === 2,
  'back=' + snap0.backIndex + ' search=' + snap0.searchIndex + ' title=' + snap0.titleIndex);
check('搜索框占位符正确', snap0.placeholder === '搜索设置...', 'placeholder=' + snap0.placeholder);
checkEqual('分组标题按 个人/集成/编码/已归档 顺序出现', headerFlowOf(snap0), ['个人', '集成', '编码', '已归档']);

/* ── 2. 分组内项序与映射表一致 ─────────────────────────────────────────── */
console.log('\n── 2 分组与项序 ──');
const gotFlow = flowOf(snap0);
if (JSON.stringify(gotFlow) !== JSON.stringify(EXPECT_FLOW)) {
  /* 只报第一处不一致，否则一次错位会把后面全刷成「错」。 */
  const at = gotFlow.findIndex((row, i) => JSON.stringify(row) !== JSON.stringify(EXPECT_FLOW[i]));
  console.error('     第 ' + at + ' 项起不一致：got=' + JSON.stringify(gotFlow.slice(at, at + 3))
    + ' want=' + JSON.stringify(EXPECT_FLOW.slice(at, at + 3)));
}
checkEqual('可见视觉流与分组映射表逐项一致', gotFlow, EXPECT_FLOW);

const personalItems = gotFlow.filter((r) => r[0] === 'personal' && r[1] !== '个人').map((r) => r[1]);
const hasAccount = snap0.hostItems.some((r) => r.text === '账号与余额');
check('「账号与余额」缺位时，个人组其余项正常、组标题仍在',
  personalItems.length >= 2 && headerFlowOf(snap0)[0] === '个人',
  'hasAccount=' + hasAccount + ' 个人组=' + JSON.stringify(personalItems));
console.log('  （本实例「账号与余额」' + (hasAccount ? '存在' : '缺位') + '；两种都算通过，验的是组内其余项不受影响）');

/* ── 3. 视觉层：注入节点的样式真的命中 ─────────────────────────────────── */
console.log('\n── 3 视觉层命中 ──');
const hits = await evaluate('window.__cxs.styleHits()');
check('返回按钮有样式命中（flex + 13px + pointer）',
  hits.back.present && hits.back.display === 'flex' && hits.back.fontSize === '13px' && hits.back.cursor === 'pointer',
  JSON.stringify(hits.back));
check('分组标题有样式命中（12px 小字）', hits.group.present && hits.group.fontSize === '12px', JSON.stringify(hits.group));
/* 打磨轮（web 端整体密度下调一号）把搜索框从 34px 压到 32px，
   形态判据（flex + 灰填充 + 圆角）不变，只更新高度期望值。 */
check('搜索框有样式命中（flex + 32px 高）',
  hits.search.present && hits.search.display === 'flex' && hits.search.height === '32px', JSON.stringify(hits.search));
check('搜索输入框有样式命中（13px）', hits.searchInput.present && hits.searchInput.fontSize === '13px', JSON.stringify(hits.searchInput));
/* 搜索框 = 全圆角胶囊（用户指名）。
   注意：getComputedStyle 返回的是**声明值的解析结果**，浏览器不会在这里把 999px
   夹到半高（夹取只发生在绘制时）—— 所以期望值就是 999px，不是 16px。
   与「方形井」的 10px 档必须分得开，否则胶囊退化成圆角矩形也看不出来。 */
check('搜索框是全圆角胶囊（计算半径 999px，非 10px 的方形井档）',
  hits.search.borderTopLeftRadius === '999px' && hits.search.borderTopLeftRadius !== '10px',
  JSON.stringify({ radius: hits.search.borderTopLeftRadius, height: hits.search.height }));
check('胶囊两侧内衬加宽（14px，图标与文字不贴弧）',
  hits.search.paddingLeft === '14px', 'paddingLeft=' + hits.search.paddingLeft);


/* ── 3b. 页头大标题（B2 注入 · 契约：.cx-sm-pagehead > .cx-sm-title）──────── */
console.log('\n── 3b 页头大标题 ──');
const ph0 = await evaluate('window.__cxs.pagehead()');
check('页头存在且唯一（未重复注入）', ph0.present && ph0.headCount === 1 && ph0.titleCount === 1,
  JSON.stringify(ph0));
check('页头挂在内容列的直接子节点（header 行）上', ph0.parentIsDirectChildOfContent === true, JSON.stringify(ph0));
check('页头在最左、与右上角操作座位同一行（Codex 的「大标题 + 页级操作」形态）',
  ph0.firstInRow === true && ph0.parentHasActionSeat === true,
  'firstInRow=' + ph0.firstInRow + ' hasActionSeat=' + ph0.parentHasActionSeat);
check('标题文本 = 当前激活项的 label', ph0.text === snap0.activeLabel,
  'title=' + JSON.stringify(ph0.text) + ' active=' + JSON.stringify(snap0.activeLabel));
check('标题真的有视觉（字号明显大于正文 13px）',
  parseFloat(ph0.fontSize) >= 20, 'fontSize=' + ph0.fontSize + ' weight=' + ph0.fontWeight);
check('页头类名与视觉层契约一致（.cx-sm-pagehead / .cx-sm-title，视觉层才有命中）',
  ph0.headClass === 'cx-sm-pagehead' && ph0.titleClass === 'cx-sm-title',
  ph0.headClass + ' / ' + ph0.titleClass);

/* ── 3c. 打磨轮新增形态：桌面标题栏让位 / 内容居中 / 灰白层次与合并卡 ── */
console.log('\n── 3c 打磨轮形态（桌面标题栏 · 居中 · 层次）──');

/* 桌面端（Windows 无边框）宿主会在 <html> 打 data-windows-titlebar 并内联标题栏高度。
   这里**模拟**那个状态：面板必须整体下移 40px，否则内容与标题栏/窗口按钮重叠。 */
const winTitlebar = await evaluate(`(() => {
  const root = document.documentElement;
  const had = root.hasAttribute('data-windows-titlebar');
  const prev = root.style.getPropertyValue('--dsh-windows-titlebar-height');
  root.setAttribute('data-windows-titlebar', '');
  root.style.setProperty('--dsh-windows-titlebar-height', '40px');
  const panel = document.querySelector('[data-shortcut-modal="settings"]');
  const out = { paddingTop: getComputedStyle(panel).paddingTop, height: Math.round(panel.getBoundingClientRect().height) };
  if (!had) root.removeAttribute('data-windows-titlebar');
  if (prev) root.style.setProperty('--dsh-windows-titlebar-height', prev);
  else root.style.removeProperty('--dsh-windows-titlebar-height');
  return out;
})()`);
check('模拟桌面标题栏时面板 padding-top = 40px（内容整体下移，不与标题栏碰撞）',
  winTitlebar.paddingTop === '40px', JSON.stringify(winTitlebar));
check('标题栏让位只加内边距、面板仍是整屏高（不缩高、不露底）',
  winTitlebar.height === 960, JSON.stringify(winTitlebar));

/* 内容居中：Codex 的设置正文是一根窄柱，水平居中于侧栏之外的剩余空间。 */
const centring = await evaluate(`(() => {
  const panel = document.querySelector('[data-shortcut-modal="settings"]');
  const content = [...panel.children].filter((e) => e.tagName !== 'NAV').pop();
  const root = content === null ? null : content.querySelector('[data-slot="settings.section"] > *');
  if (root === null) return { present: false };
  const r = root.getBoundingClientRect(), c = content.getBoundingClientRect();
  return { present: true, rootWidth: Math.round(r.width), contentWidth: Math.round(c.width),
           left: Math.round(r.x - c.x), right: Math.round(c.right - r.right),
           maxWidth: getComputedStyle(root).maxWidth };
})()`);
check('内容容器收窄到 760px 且水平居中（左右留白大致相等）',
  centring.present === true && centring.rootWidth === 760 && Math.abs(centring.left - centring.right) <= 2,
  JSON.stringify(centring));
check('内容容器的 max-width 真的生效（不是打在 display:contents 包装上）',
  centring.maxWidth === '760px', JSON.stringify(centring));

/* 灰背板 + 白内容面板的层次骨架，以及「连续行合并成一张卡」的圆角分布。 */
const surface = await evaluate(`(() => {
  const panel = document.querySelector('[data-shortcut-modal="settings"]');
  const content = [...panel.children].filter((e) => e.tagName !== 'NAV').pop();
  const rows = [...panel.querySelectorAll('[data-slot="settings.general.item"] > *')];
  const cs = (el) => getComputedStyle(el);
  const filterOf = (el) => cs(el).backdropFilter || cs(el).webkitBackdropFilter || 'none';
  return {
    panelBg: cs(panel).backgroundColor, panelFilter: filterOf(panel),
    contentBg: cs(content).backgroundColor, contentRadius: cs(content).borderRadius,
    contentBorder: cs(content).borderTopWidth + ' ' + cs(content).borderTopStyle,
    contentMargin: cs(content).margin,
    rowCount: rows.length,
    firstRadius: rows.length > 0 ? cs(rows[0]).borderRadius : null,
    lastRadius: rows.length > 0 ? cs(rows[rows.length - 1]).borderRadius : null,
    middleRadius: rows.length > 2 ? cs(rows[1]).borderRadius : null,
    rowBg: rows.length > 0 ? cs(rows[0]).backgroundColor : null,
    rowBorderTopColor: rows.length > 0 ? cs(rows[0]).borderTopColor : null,
    rowBorderLeftWidth: rows.length > 0 ? cs(rows[0]).borderLeftWidth : null,
    rowBorderTopWidth: rows.length > 0 ? cs(rows[0]).borderTopWidth : null,
    midBorderLeftWidth: rows.length > 2 ? cs(rows[1]).borderLeftWidth : null,
    lastBorderLeftWidth: rows.length > 0 ? cs(rows[rows.length - 1]).borderLeftWidth : null,
  };
})()`);
/* 背板必须**不透明**（用户裁决 2026-09-27，真机实测教训）：
   设置页是全页铺满的 overlay，底下压着主窗口内容 —— 用户装了会画壁纸的宠物插件，
   78% alpha + blur + saturate 会把壁纸色揉进设置页的灰，整页比 #f9f9f9 更深且偏色，
   而且随用户壁纸变化。铺满全窗的 overlay 用毛玻璃没有任何视觉受益，只赔确定性。
   用户原话「卡片内是白色，边框（页面）带有 #f9f9f9 即可」—— 页面颜色必须钉死。
   历史：本条曾是「毛玻璃生效：背板有 backdrop-filter，且底色是半透明」，
   随本轮改为不透明一并作废（毛玻璃是更早「居中弹窗」时代的诉求，全页化后不成立）。
   断言仍令牌相对：alpha=1 且 RGB 对账 bg-sidebar 令牌，不写死 rgb(249,249,249)。 */
check('背板不透明：无 backdrop-filter，且底色 alpha = 1（颜色钉死，不吃环境色）',
  !/blur/.test(surface.panelFilter)
  && /^rgb\(/.test(String(surface.panelBg).trim()),
  'filter=' + surface.panelFilter + ' / 背板=' + surface.panelBg);
/* 内容列现在是「平铺的白」，但仍然**不是**浮起面板：有轮廓就还是「面板」，
   有 gutter 就会在四周露背板、重现那条缝。所以平铺的形态断言原样保留。 */
check('内容列是 flush 平铺：无圆角、无描边、无 gutter',
  /^0px(\s|$)/.test(String(surface.contentRadius).trim())
  && /^0px none$/.test(String(surface.contentBorder).trim())
  && /^0px( 0px){0,3}$/.test(String(surface.contentMargin).trim()),
  'radius=' + surface.contentRadius + ' / border=' + surface.contentBorder + ' / margin=' + surface.contentMargin);
check('连续行合并成一张卡：首行上圆角 + 末行下圆角 + 中间行无圆角',
  surface.rowCount > 2
  && /^12px 12px/.test(surface.firstRadius)
  && /12px 12px$/.test(surface.lastRadius)
  && surface.middleRadius === '0px',
  JSON.stringify(surface));
/* 背板 = 主界面侧栏（两屏并排同色）：
   用户实测「设置页左栏 #ededed vs 主界面侧栏 #f9f9f9，差异明显」，
   本轮把 --cx-sm-surface-backdrop 由 bg-layer-3 换成 bg-sidebar。
   这里直接对账：设置页背板计算色 === 主界面侧栏那一面（同一令牌、同一合成）。
   断言写成「两边相等」而不是写死 rgb(249,249,249) —— 令牌相对，换皮肤不假失败；
   同时也与 layer-3 对比，确保没有退回旧令牌。 */
const panelBgNow = await evaluate('getComputedStyle(document.querySelector(\'[data-shortcut-modal="settings"]\')).backgroundColor');
/** 把计算色归一成不透明的 "rgb(r, g, b)"，只比颜色本身、不比写法。
    背板已改回**不透明**（见上文「背板不透明」那条），计算值本就是 "rgb(r, g, b)"；
    这个函数保留是为了让对账不依赖写法（color(srgb …) / rgba(…) / #hex 都认），
    与用户要的证据（左栏计算色 = 侧栏令牌实测值）口径一致。
    注意：它**只看 RGB 三通道、不看 alpha**，所以「不透明」必须由专门那条断言把守。 */
const rgbOnly = (s) => {
  const t = String(s).trim();
  const cm = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(t);
  if (cm !== null) return 'rgb(' + [cm[1], cm[2], cm[3]].map((v) => Math.round(parseFloat(v) * 255)).join(', ') + ')';
  const rg = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(t);
  if (rg !== null) return 'rgb(' + [rg[1], rg[2], rg[3]].map((v) => Math.round(parseFloat(v))).join(', ') + ')';
  const hx = /^#([0-9a-f]{6})$/i.exec(t);
  if (hx !== null) return 'rgb(' + [0, 2, 4].map((i) => parseInt(hx[1].slice(i, i + 2), 16)).join(', ') + ')';
  return t;
};
const bodyToken = (name) => evaluate('getComputedStyle(document.body).getPropertyValue("' + name + '").trim()');
const sidebarTok = await bodyToken("--dsw-alias-bg-sidebar");
const layer3Tok = await bodyToken("--dsw-alias-bg-layer-3");
/* 形态定稿（用户 2026-09-27 确认，Codex 参考图）：**侧栏灰 + 内容区白平铺 + 白卡浅细边**。
   内容列取 bg-base 平铺（浅 #ffffff；深 #111111 —— 上游 0.5.6 起深色窗口底与表面分层，
   彼时 #181818 与侧栏同面的时代已结束），保持 flush。
   演进：此条曾是「白内容面板 + 不同背板」（两个面）→「整页同面、内容列不吃底色」
   （整页灰，用户 2026-09-27 否决）→ 现在这条。
   断言令牌相对 —— 对账 --dsw-alias-bg-base，不写死 rgb(255,255,255)。
   ⚠️ 位置有约束：rgbOnly / bodyToken 在本段才声明，这几条断言必须待在它们之后（否则 TDZ）。 */
const bgBaseTok = await bodyToken("--dsw-alias-bg-base");
check('内容列 = bg-base 平铺（浅 #ffffff / 深 #111111）',
  rgbOnly(surface.contentBg) === rgbOnly(bgBaseTok),
  'contentBg=' + rgbOnly(surface.contentBg) + ' / --dsw-alias-bg-base=' + bgBaseTok);
/* 浅色下内容列与背板**分色**（白 ≠ 侧栏那一档），这正是定稿形态要的层次来源。 */
check('浅色内容列与背板分色（内容白 ≠ 侧栏色）',
  rgbOnly(surface.contentBg) !== rgbOnly(panelBgNow),
  'contentBg=' + rgbOnly(surface.contentBg) + ' / 背板=' + rgbOnly(panelBgNow));
/* 浅色卡边 = bg-sidebar 那一档（上游 0.6.4 起浅色侧栏 #f6f6f6）：白卡浮在白底上，靠这条细边划出卡的边界
   （用户原话「边框带有 #f9f9f9 即可」，Codex 参考图那一版）。
   对账 bg-sidebar 令牌而不是写死 rgb(249,249,249)；左右边也必须在（卡的侧轮廓）。 */
const sidebarTokLight = await bodyToken("--dsw-alias-bg-sidebar");
/* 宽度不写死 0.5px：Chromium 把边框宽度吸附到设备像素，dpr>1 时 0.5px 的计算值会读成 1px。
   改断「左右边存在、且与上下同宽」—— 语义等价且不吃 DPR。 */
check('浅色卡边 = bg-sidebar 细边，且左右边齐全',
  surface.rowBorderTopColor !== null
  && rgbOnly(surface.rowBorderTopColor) === rgbOnly(sidebarTokLight)
  && surface.rowBorderLeftWidth !== '0px'
  && surface.rowBorderLeftWidth === surface.rowBorderTopWidth
  && surface.lastBorderLeftWidth !== '0px',
  '卡边=' + rgbOnly(surface.rowBorderTopColor) + ' / --dsw-alias-bg-sidebar=' + sidebarTokLight
  + ' / 首行左=' + surface.rowBorderLeftWidth + ' 上=' + surface.rowBorderTopWidth + ' / 末行左=' + surface.lastBorderLeftWidth);
/* 中间行不给左右边，行间发丝线才是一条完整直线。 */
check('卡内中间行不画左右边（发丝线不断口）', surface.midBorderLeftWidth === '0px',
  '中间行左边宽=' + surface.midBorderLeftWidth);
check('背板与主界面侧栏同色（设置页左栏 = 主界面侧栏面）',
  rgbOnly(panelBgNow) === rgbOnly(sidebarTok),
  '左栏计算色=' + rgbOnly(panelBgNow) + ' / --dsw-alias-bg-sidebar=' + sidebarTok);
check('背板已不是 layer-3（没有退回旧令牌）',
  rgbOnly(panelBgNow) !== rgbOnly(layer3Tok),
  '左栏计算色=' + rgbOnly(panelBgNow) + ' / --dsw-alias-bg-layer-3=' + layer3Tok);
/* 形态定稿下层次由「侧栏灰 vs 内容白」的分色承担（见上文那条），
   这里只确认背板与内容列确实分处两色，且背板 = bg-sidebar —— 层次没塌。 */

/* ── 3d. 锚点迁移集成 + 卡着色令牌路径（PR #1 二审修复）────────────────── */
console.log('\n── 3d 自有锚点盖印 · 卡着色令牌路径 ──');

/* (a) 面板在插件注入后带上自有锚点 data-cx-sm-panel。
   本轮把面板锚点从「仅适配器的 data-dsh-surface="settings"」迁到
   「宿主 data-shortcut-modal="settings" 优先、适配器兜底」，定位到面板后由
   src/client/settings-modal.js 的 findPanel() 盖上自有锚点；settings-modal.css 的全部形态规则
   都改挂它 —— 它没盖上，整份视觉层就不命中任何元素（这正是本轮迁移的风险点）。
   一条断言同时钉三件事：盖了、盖在真正的面板节点上（与宿主锚点是同一个节点）、没盖重。 */
const stamped = await evaluate('window.__cxs.panelStamp()');
check('面板被盖印自有锚点 data-cx-sm-panel（锚点迁移的集成证据）',
  stamped.count === 1 && stamped.attr === '' && stamped.sameNode === true,
  JSON.stringify(stamped));

/* (b)(c) §4.3 那条 class 后缀规则**已删除**（见 skins/codex-ink/settings-modal.css 的删除记录）。
   模型 / Agent 预设两页的卡现在唯一的着色机制是宿主令牌 --dsw-alias-settings-card-fill
   （宿主主题在 body 上声明为 bg-layer-2；本皮肤在 skin.css 里显式定义成 bg-layer-1）。
   下面两条合起来证明：令牌路径活着，且选中态没有被它抹平。
   ⚠️ 必须先走回「模型」页：前面那些断言把现场切到了别的设置页，而这两页的卡是宿主自建结构，
   通用设置页上根本没有 _rowCard / _card。 */
await clickItem('模型');
const tokenProbe = await evaluate('window.__cxs.tokenValue("--dsw-alias-settings-card-fill")');
const modelCards = await evaluate('window.__cxs.cardState("_rowCard")');
check('模型页未选中卡的背景 = var(--dsw-alias-bg-layer-1) 的计算值（令牌路径活着）',
  modelCards.pick !== null && modelCards.pick.bg === tokenProbe.layer1,
  '卡=' + JSON.stringify(modelCards.pick && modelCards.pick.bg) + ' / layer-1=' + tokenProbe.layer1
  + ' / 卡数 可见/总=' + modelCards.visible + '/' + modelCards.total);

/* 选中态仍可区分：切到「Agent 预设」——实测该页 4 张卡里有 1 张带状态类
   （class = <hash>_card + 一个 *_cardActive 状态类），是全设置面板里唯一能同时量到
   「未选中 vs 选中」的页。
   断言要求两者都存在且不同色：宿主若改实现把选中底色画丢，这一条会红。 */
await clickItem('Agent 预设');
const agentCards = await evaluate('window.__cxs.cardState("_card")');
check('Agent 预设页：选中卡背景 ≠ 未选中卡背景（选中态未被令牌路径抹平）',
  agentCards.pick !== null && agentCards.selected !== null
  && agentCards.pick.bg !== agentCards.selected.bg,
  '未选中=' + JSON.stringify(agentCards.pick && agentCards.pick.bg)
  + ' / 选中=' + JSON.stringify(agentCards.selected && agentCards.selected.bg)
  + ' / 卡数 可见/总=' + agentCards.visible + '/' + agentCards.total);
/* 两页的未选中卡必须落在同一档（同走 settings-card-fill → layer-1）：
   §4.3 删除后，这条是「模型页与 Agent 预设页白卡一致」的唯一保证。 */
check('模型页与 Agent 预设页的未选中卡同为 layer-1 一档（两页白卡一致）',
  modelCards.pick !== null && agentCards.pick !== null && modelCards.pick.bg === agentCards.pick.bg,
  '模型=' + JSON.stringify(modelCards.pick && modelCards.pick.bg)
  + ' / Agent=' + JSON.stringify(agentCards.pick && agentCards.pick.bg));
await clickItem(snap0.activeLabel);

/* ✕ 关闭按钮已隐藏：宿主那个按钮不该再可见。
   只认计算 display —— 宿主若只是把它缩成 0 尺寸，那是另一种失败，不该被放过。
   兜底路径不受影响：Escape 优先，settings-modal.js 的 button.click() 对 display:none 仍生效。 */
const closeInfo = await evaluate('(() => { const btn = document.querySelector(\'[data-shortcut-modal="settings"] button:has([data-slot="settings.close"])\'); if (btn === null) return { present: false, display: null }; const cs = getComputedStyle(btn); return { present: true, display: cs.display, rectW: btn.getBoundingClientRect().width }; })()');
check('右上角 ✕ 关闭按钮已隐藏（Codex 无此按钮，← 返回应用承担退出）',
  closeInfo.present === true && closeInfo.display === 'none',
  JSON.stringify(closeInfo));

/* 切项跟随：换一个设置项，标题文本必须跟着变。 */
const otherLabel = snap0.hostItems.map((r) => r.text).find((t) => t !== snap0.activeLabel);
await clickItem(otherLabel);
const ph1 = await evaluate('window.__cxs.pagehead()');
const activeAfterSwitch = (await evaluate('window.__cxs.snapshot()')).activeLabel;
check('切项后标题跟随更新', ph1.text === activeAfterSwitch && ph1.text === otherLabel,
  'title=' + JSON.stringify(ph1.text) + ' active=' + JSON.stringify(activeAfterSwitch) + ' clicked=' + JSON.stringify(otherLabel));
check('切项后页头仍唯一（没有叠加出第二个）', ph1.headCount === 1, 'headCount=' + ph1.headCount);
await clickItem(snap0.activeLabel);


/* 行内文字层级：标题 14px/label-primary，说明 12px/label-caption。
   这条专治「文字层级规则误伤标题」——上一版就这么坏过，69 项全绿也没拦住。 */
const typeLight = await evaluate('window.__cxs.rowType()');
check('行标题恢复 14px 且为 label-primary（未被文字层级规则染灰压小）',
  typeLight.titleCount > 0
  && typeLight.titles.every((r) => r.fs === '14px' && r.color === typeLight.primary),
  JSON.stringify({ primary: typeLight.primary, titles: typeLight.titles.slice(0, 3) }));
check('行内说明为 12px 且压到 label-caption 档（与标题明显分层）',
  typeLight.descCount > 0
  && typeLight.descs.every((r) => r.fs === '12px' && r.color === typeLight.caption)
  && typeLight.caption !== typeLight.primary,
  JSON.stringify({ caption: typeLight.caption, descs: typeLight.descs.slice(0, 3) }));
check('标题与说明确实是两个不同层级（不是同色同号）',
  typeLight.titles.every((tt) => typeLight.descs.every((dd) => dd.color !== tt.color && dd.fs !== tt.fs)),
  JSON.stringify({ title0: typeLight.titles[0], desc0: typeLight.descs[0] }));
check('控件区裸数字未被文字层级规则误伤（仍为 label-primary，不被压成 caption 灰）',
  typeLight.stray.every((r) => r.color === typeLight.primary),
  JSON.stringify(typeLight.stray));

/* ── 4. 搜索过滤 ───────────────────────────────────────────────────────── */
console.log('\n── 4 搜索过滤 ──');
await setQuery('模型');
const f1 = await evaluate('window.__cxs.snapshot()');
checkEqual('过滤命中精确：只剩「模型」', f1.hostItems.filter((r) => !r.hidden).map((r) => r.text), ['模型']);
checkEqual('空分组标题被隐藏，只留命中的「编码」', headerFlowOf(f1), ['编码']);
check('过滤只改显隐，宿主节点一个不少', f1.hostItems.length === snap0.hostItems.length,
  f1.hostItems.length + ' vs ' + snap0.hostItems.length);
check('被隐藏项确实不可见（computed display:none）', f1.leaked.length === 0, '复现项=' + JSON.stringify(f1.leaked));
await screenshot('c1-04-search-filter.png');

await setQuery('zzzz-nothing-here');
const f2 = await evaluate('window.__cxs.snapshot()');
check('无结果提示出现、且排在视觉流最后',
  f2.flow.filter((r) => r.part === 'empty' && !r.hidden).length === 1
  && f2.flow.filter((r) => !r.hidden).slice(-1)[0].part === 'empty',
  JSON.stringify(f2.flow.filter((r) => !r.hidden).map((r) => [r.part, r.text])));
check('无结果时所有宿主项都被隐藏', f2.hostItems.every((r) => r.hidden),
  JSON.stringify(f2.hostItems.filter((r) => !r.hidden).map((r) => r.text)));
await screenshot('c1-05-search-empty.png');

await setQuery('');
const f3 = await evaluate('window.__cxs.snapshot()');
check('清空后全部恢复', f3.hostItems.every((r) => !r.hidden) && f3.leaked.length === 0,
  '仍隐藏=' + JSON.stringify(f3.hostItems.filter((r) => r.hidden).map((r) => r.text)));
checkEqual('清空后视觉流回到映射表序列', flowOf(f3), EXPECT_FLOW);

/* ── 5. 隐藏态耐久性（C1 回归：类名被宿主抹掉时不能复现） ──────────────── */
console.log('\n── 5 隐藏态耐久性（真实交互路径回归）──');
/*
  造出故障前提：过滤到某个可见项，此时**当前选中项**处于被隐藏状态；
  然后点那个可见项 —— 宿主会把选中态搬走，并对被隐藏项整条重写 className（抹掉我们的类名）。
  修复前：该类名是唯一的隐藏钩子，于是被隐藏项当场 display:flex 复现、此后永久可见。
  修复后：隐藏由 [data-cx-sm-hidden] 属性兜底，类名被抹也不影响。
*/
const activeLabel = snap0.activeLabel;
const targetLabel = snap0.hostItems.map((r) => r.text).find((t) => t !== activeLabel && t !== '已归档会话');
check('找到用于构造场景的可见项', targetLabel !== undefined, 'target=' + targetLabel + ' active=' + activeLabel);
if (targetLabel !== undefined) {
  await setQuery(targetLabel);
  const beforeClick = await evaluate('window.__cxs.snapshot()');
  const victims = beforeClick.items.filter((r) => r.hasHiddenAttr).map((r) => r.text);
  check('构造出故障前提：存在被隐藏项，且当前选中项就在其中',
    victims.length > 0 && victims.indexOf(activeLabel) >= 0,
    '选中项=' + activeLabel + ' 被隐藏=' + JSON.stringify(victims));
  await clickItem(targetLabel);
  const afterClick = await evaluate('window.__cxs.snapshot()');
  check('选中态搬家后，被隐藏项不因类名被抹掉而复现',
    afterClick.leaked.length === 0, '复现项=' + JSON.stringify(afterClick.leaked));
  check('被隐藏项仍是「属性 + 计算样式」一致（display:none）',
    afterClick.items.filter((r) => r.hasHiddenAttr).every((r) => r.display === 'none'),
    JSON.stringify(afterClick.items.filter((r) => r.hasHiddenAttr && r.display !== 'none').map((r) => r.text)));
  await screenshot('c1-06-hidden-durability.png');
  await setQuery('');
}

/* ── 6. 切项 / 关闭重开：注入存活且不叠加 ──────────────────────────────── */
console.log('\n── 6 切项 / 关闭重开 ──');
/* 基准必须在**切项前一刻**现取：搜索测试合法地多出一个 .cx-sm-empty 提示节点，
   拿「刚打开设置时」的计数当基准会把那个合法增量误判成重复注入。 */
const preSwitch = (await evaluate('window.__cxs.snapshot()')).injectedCount;
await clickItem('皮肤');
const s1 = await evaluate('window.__cxs.snapshot()');
check('切设置项后返回按钮与搜索框存活', s1.hasBack && s1.searchIndex === 1,
  'back=' + s1.backIndex + ' search=' + s1.searchIndex);
check('切设置项后 4 个分组标题仍在', s1.headers.filter((r) => !r.hidden).length === 4,
  s1.headers.map((r) => r.text).join('/'));
check('切设置项不产生重复注入节点', s1.injectedCount === preSwitch, s1.injectedCount + ' vs ' + preSwitch);
/* 计数相等还不够 —— 数量对但同一件注入了两遍也会相等。逐件查唯一性。 */
check('切设置项后每个注入件仍全局唯一（无重复节点）',
  Object.values(s1.uniq).every((n) => n === 1), JSON.stringify(s1.uniq));

await evaluate('document.body.focus()');
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }, sessionId);
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }, sessionId);
await sleep(1800);
const closed = await evaluate('window.__cxs.panelCount()');
check('Esc 关闭设置', closed === 0, 'panel count=' + closed);
const orphans = await evaluate('window.__cxs.orphanCount()');
check('关闭后注入节点随面板一起消失（不留孤儿）', orphans === 0, 'orphans=' + orphans);

await openSettings();
await sleep(1500);
const r1 = await evaluate('window.__cxs.snapshot()');
check('重开后完整重放（返回 + 搜索 + 4 标题）',
  r1.hasBack && r1.searchIndex === 1 && r1.headers.length === 4,
  'back=' + r1.hasBack + ' search=' + r1.searchIndex + ' headers=' + r1.headers.length);
check('重放不叠加：每个注入件全局唯一', Object.values(r1.uniq).every((n) => n === 1), JSON.stringify(r1.uniq));
check('重放后无残留空结果提示',
  r1.items.filter((r) => r.part === 'empty' && !r.hidden).length === 0,
  JSON.stringify(r1.items.filter((r) => r.part === 'empty').map((r) => [r.hidden, r.display])));
checkEqual('重放后视觉流仍与映射表一致', flowOf(r1), EXPECT_FLOW);
const phReopen = await evaluate('window.__cxs.pagehead()');
check('重开后页头完整重放且不重复（head/标题各 1 个）',
  phReopen.present && phReopen.headCount === 1 && phReopen.titleCount === 1, JSON.stringify(phReopen));
check('重开后标题回到当前激活项', phReopen.text === r1.activeLabel,
  'title=' + JSON.stringify(phReopen.text) + ' active=' + JSON.stringify(r1.activeLabel));
await screenshot('c1-07-reopen-replay.png');

/* ── 7. 第三方项动态插入 → 「其他」组 ──────────────────────────────────── */
console.log('\n── 7 未知项兜底 ──');
const beforeUnknown = await evaluate('window.__cxs.snapshot()');
const injected = await evaluate('window.__cxs.injectUnknown("第三方测试项")');
check('能模拟第三方插件插入一个新设置项', injected === true, 'injected=' + injected);
await sleep(1500);
const u1 = await evaluate('window.__cxs.snapshot()');
const unknown = u1.items.find((r) => r.text === '第三方测试项');
check('未知项落「其他」组', unknown !== undefined && unknown.group === 'other', JSON.stringify(unknown));
check('「其他」组标题存在', u1.headers.some((r) => r.part === 'group:other'),
  u1.headers.map((r) => r.part).join('/'));
check('「其他」排在所有已知组之后（视觉流末尾）',
  u1.flow.filter((r) => !r.hidden).slice(-1)[0].group === 'other',
  JSON.stringify(u1.flow.filter((r) => !r.hidden).slice(-3).map((r) => [r.group, r.text])));
check('原有宿主项一个没打乱', u1.hostItems.length === beforeUnknown.hostItems.length + 1,
  u1.hostItems.length + ' vs ' + (beforeUnknown.hostItems.length + 1));
await screenshot('c1-08-third-party.png');

await evaluate('window.__cxs.removeUnknown("第三方测试项")');
await sleep(1500);
const u2 = await evaluate('window.__cxs.snapshot()');
check('移除未知项后「其他」组标题消失（不留孤儿）', u2.headers.every((r) => r.part !== 'group:other'),
  u2.headers.map((r) => r.part).join('/'));
check('移除后宿主项数回到原状', u2.hostItems.length === beforeUnknown.hostItems.length,
  u2.hostItems.length + ' vs ' + beforeUnknown.hostItems.length);
check('宿主项在 DOM 里没被我们动过（仍是列表的直接子节点、仍是 button）',
  u2.hostItems.every((r) => r.tag === 'BUTTON'), JSON.stringify(u2.hostItems.map((r) => r.tag)));

/* ── 8. 暗色主题下结构断言同样成立 ─────────────────────────────────────── */
console.log('\n── 8 暗色主题 ──');
await evaluate('window.__cxs.setDark(true)');
await sleep(1000);
const dark = await evaluate('window.__cxs.snapshot()');
const darkHits = await evaluate('window.__cxs.styleHits()');
checkEqual('暗色下 4 个分组标题仍在且顺序不变', headerFlowOf(dark), ['个人', '集成', '编码', '已归档']);
check('暗色下返回按钮与搜索框仍在', dark.hasBack && dark.searchIndex === 1,
  'back=' + dark.hasBack + ' search=' + dark.searchIndex);
checkEqual('暗色下视觉流与映射表一致', flowOf(dark), EXPECT_FLOW);
check('暗色下注入节点仍有样式命中（不是透明无字）',
  darkHits.back.present && darkHits.group.present
  && darkHits.back.color !== 'rgba(0, 0, 0, 0)' && darkHits.group.color !== 'rgba(0, 0, 0, 0)',
  JSON.stringify({ back: darkHits.back.color, group: darkHits.group.color }));
check('暗色下被隐藏项依然不可见', dark.leaked.length === 0, JSON.stringify(dark.leaked));
const typeDark = await evaluate('window.__cxs.rowType()');
check('暗色下行标题仍是 label-primary/14px，说明仍是 caption/12px（不随主题塌陷）',
  typeDark.titleCount > 0 && typeDark.descs.length > 0
  && typeDark.titles.every((r) => r.fs === '14px' && r.color === typeDark.primary)
  && typeDark.descs.every((r) => r.fs === '12px' && r.color === typeDark.caption)
  && typeDark.primary !== typeDark.caption,
  JSON.stringify({ primary: typeDark.primary, caption: typeDark.caption,
                   title0: typeDark.titles[0], desc0: typeDark.descs[0] }));
const phDark = await evaluate('window.__cxs.pagehead()');
check('暗色下页头仍在、文本仍跟随激活项、仍是唯一',
  phDark.present && phDark.headCount === 1 && phDark.text === dark.activeLabel,
  JSON.stringify(phDark));
/* 暗色下同样要成立：背板跟主界面侧栏走，且与内容面板不同面（层次不能塌）。 */
const panelBgDark = await evaluate('getComputedStyle(document.querySelector(\'[data-shortcut-modal="settings"]\')).backgroundColor');
const sidebarDark = await evaluate('getComputedStyle(document.body).getPropertyValue("--dsw-alias-bg-sidebar").trim()');
const contentBgDark = await evaluate('(() => { const p = document.querySelector(\'[data-shortcut-modal="settings"]\'); const c = [...p.children].filter((e) => e.tagName !== "NAV").pop(); return getComputedStyle(c).backgroundColor; })()');
check('暗色下背板仍与主界面侧栏同色',
  rgbOnly(panelBgDark) === rgbOnly(sidebarDark),
  '左栏计算色=' + rgbOnly(panelBgDark) + ' / --dsw-alias-bg-sidebar=' + sidebarDark);
/* 暗色同样必须不透明：上面那条只比 RGB、不比 alpha，半透明也能骗过它，
   而「被壁纸染成偏色」在深色下同样是这个成因。 */
const panelFilterDark = await evaluate('(() => { const p = document.querySelector(\'[data-shortcut-modal="settings"]\'); const cs = getComputedStyle(p); return cs.backdropFilter || cs.webkitBackdropFilter || "none"; })()');
check('暗色下背板同样不透明：无 backdrop-filter，且底色 alpha = 1',
  !/blur/.test(panelFilterDark) && /^rgb\(/.test(String(panelBgDark).trim()),
  'filter=' + panelFilterDark + ' / 背板=' + panelBgDark);
/* 深色卡边沿用 border-l1（白色 8%）—— 浅色那条侧栏色边画在深色卡上等于没有边。
   这条同时守住「深色没有被浅色取值污染」。 */
const rowBgDark = await evaluate('(() => { const r = document.querySelector(\'[data-shortcut-modal="settings"] [data-slot="settings.general.item"] > *\'); return r === null ? null : getComputedStyle(r).backgroundColor; })()');
/* 暗色：内容列 = bg-base（令牌相对）。上游 0.5.6 把深色窗口底改成 #111111、表面/侧栏留 #181818
   —— 内容列（#111111）与侧栏（#181818）**分层**是上游的新现实，「深色通体一色」的设计注记
   随之作废（皮肤跟踪令牌，不把旧的层级钉死）。这条只断内容列跟住 bg-base；
   分层事实写进证据文案，不断言 ≠（上游哪天再合并层级不该红我们）。 */
const bgBaseDark = await evaluate('getComputedStyle(document.body).getPropertyValue("--dsw-alias-bg-base").trim()');
check('暗色下内容列 = bg-base（令牌相对；与侧栏分层是上游 0.5.6 起的现实）',
  rgbOnly(contentBgDark) === rgbOnly(bgBaseDark),
  '内容列=' + rgbOnly(contentBgDark) + ' / bg-base=' + bgBaseDark + ' / 侧栏=' + rgbOnly(panelBgDark));
check('暗色下分组卡仍是浮起的一层（卡色 ≠ 整页面色）',
  rowBgDark !== null && rgbOnly(rowBgDark) !== rgbOnly(panelBgDark),
  '卡=' + rgbOnly(rowBgDark) + ' / 面=' + rgbOnly(panelBgDark));
const rowEdgeDark = await evaluate('(() => { const r = document.querySelector(\'[data-shortcut-modal="settings"] [data-slot="settings.general.item"] > *\'); return r === null ? null : getComputedStyle(r).borderTopColor; })()');
const borderL1Dark = await evaluate('getComputedStyle(document.body).getPropertyValue("--dsw-alias-border-l1").trim()');
check('暗色卡边仍是 border-l1 白色发丝（未被浅色侧栏色边污染）',
  rowEdgeDark !== null && rgbOnly(rowEdgeDark) === rgbOnly(borderL1Dark)
  && rgbOnly(rowEdgeDark) !== rgbOnly(sidebarDark),
  '暗色卡边=' + rgbOnly(rowEdgeDark) + ' / border-l1=' + rgbOnly(borderL1Dark) + ' / 侧栏=' + rgbOnly(sidebarDark));
const closeDark = await evaluate('(() => { const b = document.querySelector(\'[data-shortcut-modal="settings"] button:has([data-slot="settings.close"])\'); return b === null ? null : getComputedStyle(b).display; })()');
check('暗色下 ✕ 仍隐藏', closeDark === 'none', 'display=' + closeDark);
await screenshot('c1-09-dark.png');
await evaluate('window.__cxs.setDark(false)');
await sleep(700);

/* ── 9. 返回按钮点击关闭 ───────────────────────────────────────────────── */
console.log('\n── 9 返回按钮行为 ──');
const backBox = await evaluate('(() => { const el = document.querySelector("[data-cx-sm-part=\'back\']");'
  + 'if (el === null) return null; const r = el.getBoundingClientRect();'
  + 'return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()');
check('能找到返回按钮', backBox !== null, JSON.stringify(backBox));
if (backBox !== null) {
  await click(backBox.x, backBox.y);
  await sleep(1800);
  const afterBack = await evaluate('window.__cxs.panelCount()');
  check('点返回按钮 → 设置模态关闭', afterBack === 0, 'panel count=' + afterBack);
  const orphansAfter = await evaluate('window.__cxs.orphanCount()');
  check('关闭后不留注入孤儿', orphansAfter === 0, 'orphans=' + orphansAfter);
}

/* ── 9a. Escape 被拦截时的兜底关闭（UX-01 / A02 后半）────────────────────
   修复前的分支写反：`if (findPanel() !== null) return;` 注释却写「Escape 生效了」，
   于是「Escape 没关掉 → 点宿主关闭按钮」这条兜底**永远不执行**。
   这里在 window 捕获阶段吞掉 Escape（模拟被宿主/浏览器拦截），再点返回按钮：
   修好了才关得掉；条件写反时面板会留在原地。 */
console.log('\n── 9a Escape 被拦截时的兜底 ──');
await openSettings();
await sleep(1200);
await evaluate("window.__cxsBlockEscape = (e) => { if (e.key === 'Escape') e.stopImmediatePropagation(); };"
  + " window.addEventListener('keydown', window.__cxsBlockEscape, true);");
const backBlocked = await evaluate("(() => { const el = document.querySelector(\"[data-cx-sm-part='back']\");"
  + " if (el === null) return null; const r = el.getBoundingClientRect();"
  + " return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()");
check('拦截态下仍能找到返回按钮', backBlocked !== null, JSON.stringify(backBlocked));
if (backBlocked !== null) {
  await click(backBlocked.x, backBlocked.y);
  await sleep(1800);
  const afterBlocked = await evaluate('window.__cxs.panelCount()');
  check('Escape 被拦截时返回按钮仍能关掉设置（兜底路径活着）', afterBlocked === 0, 'panel count=' + afterBlocked);
}
await evaluate("window.removeEventListener('keydown', window.__cxsBlockEscape, true)");


/* 收尾：恢复干净现场，保证脚本幂等可复跑。 */
await openSettings();
await sleep(1200);
await setQuery('');
await evaluate('window.__cxs.setDark(false)');
await sleep(400);

/* ── 10. console 零报错 ────────────────────────────────────────────────── */
console.log('\n── 10 console ──');
/* 白名单：逐条写明理由的宿主/环境既有噪音，基线里同样存在。
   不是「把 error 都放行」—— 除这些之外任何 error / exception 一律算失败。 */
const NOISE = [
  { re: /Failed to load resource.*(404|Not Found)/i, why: '宿主静态资源 404，基线即有' },
  { re: /favicon/i, why: 'favicon 缺失，与插件无关' },
  { re: /ERR_CONNECTION_REFUSED.*(sockjs|hot-update|__vite)/i, why: 'HMR / 开发服务器残留' },
];
const errs = pageLogs.filter((l) => l.startsWith('error') || l.startsWith('exception'));
const unexpected = errs.filter((l) => !NOISE.some((n) => n.re.test(l)));
check('console 零报错（已剔除 ' + NOISE.length + ' 类宿主既有噪音）', unexpected.length === 0,
  unexpected.slice(0, 8).join('\n     '));
if (errs.length > unexpected.length) console.log('  （已白名单 ' + (errs.length - unexpected.length) + ' 条宿主噪音）');
const codexWarns = pageLogs.filter((l) => l.indexOf('[codex-ui]') >= 0);
check('注入层没有打出 [codex-ui] 警告（结构自检全部通过）', codexWarns.length === 0,
  codexWarns.slice(0, 5).join('\n     '));

/* ── 汇总 ─────────────────────────────────────────────────────────────── */
console.log('\n' + (failed === 0 ? 'PASS：全部通过' : 'FAIL：' + failed + ' 项未通过')
  + '（共 ' + (passed + failed) + ' 项，通过 ' + passed + '）');
console.log('截图目录：' + OUT_DIR);
ws.close(); child.kill();
process.exit(failed === 0 ? 0 : 1);
