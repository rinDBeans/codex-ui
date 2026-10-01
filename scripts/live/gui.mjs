#!/usr/bin/env node
/**
 * live/gui.mjs — 对真实 dsh web 实例取证：窗口阴影层、两条分界线、右栏面板，以及模型位。
 *
 *   node scripts/live/gui.mjs --url "http://127.0.0.1:3099/?token=…" [--shot <png>] [--dpr 2] [--latency 800]
 *
 * 为什么要有这一支：verify.mjs 的夹具里没有标题栏条、没有真的 AppFrame 网格、也没有真的 RPC；
 * 阴影层、分界线悬停、模型位的往返只能在真 GUI 上验收。
 * 模型位两种形态：设置卡的「Codex 模型选择器」开着（默认）时量 B 面（自建组件顶替席位、几何、
 * 键盘改档写进宿主 store 再改回）；关着时量 A 面宿主菜单的 pending 窗口 —— 本机往返不到 60ms，
 * --latency 给这一次往返加时延（默认 800ms，0 = 不加），不然采不到窗口。
 * 浏览器形态没有桌面壳的 preload，这里补打 data-windows-titlebar / data-platform，CSS 层等价。
 */
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { clickByText, dismissOnboarding, launch, login, sleep } from '../lib/cdp.mjs';
import { checklist, summarize } from '../lib/checks.mjs';

const arg = (name, fallback) => {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const TOKEN_URL = arg('url', '');
const SHOT = arg('shot', join(tmpdir(), 'codex-ui-shots', 'live-gui.png'));
const DPR = Number(arg('dpr', '2'));
const LATENCY = Number(arg('latency', '800'));
if (TOKEN_URL === '') {
  console.error('缺少 --url "http://127.0.0.1:<port>/?token=…"（dsh web 启动时打印）');
  process.exit(2);
}

/** 中列 / 侧栏 / 右栏面板与两条分界线柄的计算样式。 */
function probeFrame() {
  const cs = (el, p) => (el ? getComputedStyle(el, p) : null);
  const line = (el) => (el ? { opacity: cs(el, '::before').opacity, width: cs(el, '::before').width, grad: /linear-gradient/.test(cs(el, '::before').backgroundImage) } : null);
  const center = document.querySelector('div:has(> [data-slot=main])');
  const side = document.querySelector('div:has(> [data-slot=sidebar])');
  const panel = document.querySelector('[data-sidebar-right-panel]');
  return {
    centerShadow: cs(center).boxShadow,
    dark: document.body.hasAttribute('data-ds-dark-theme'),
    /* 主题插件（dsh-ivory / dsh-taojian …）会在 body 上挂类名并用 !important 接管外壳属性；
       基线必须记下它，否则分不清「codex-ink 变了」还是「别人接管了」。 */
    theme: document.body.className || '(none)',
    centerRadius: cs(center).borderTopLeftRadius,
    sidebarBorder: cs(side).borderRightWidth + ' ' + cs(side).borderRightColor,
    panelShadow: panel ? cs(panel).boxShadow : null,
    handleLeft: line(document.querySelector('[data-side=sidebar]')),
    handleRight: line(document.querySelector('[data-side=rightbar]')),
  };
}

/** B 面：席位里我们的触发器、宿主那一格是否隐藏。 */
function probeSeat() {
  const slot = document.querySelector('[data-slot="conversation.input.model"]');
  const mine = slot.querySelector(':scope > .codex-mp-trigger');
  const r = mine.getBoundingClientRect();
  const others = [...slot.children].filter((c) => c !== mine);
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), h: r.height, hostHidden: others.length > 0 && others.every((c) => getComputedStyle(c).display === 'none') };
}

/** B 面弹层：宽、行数、档位圆点与拇指相对轨左沿的位置。 */
function probePopover() {
  const p = document.querySelector('.codex-mp-popover');
  if (!p || p.hidden) return null;
  const root = p.querySelector('.codex-mp-root');
  const rr = root.getBoundingClientRect();
  const th = root.querySelector('.codex-mp-thumb-scale').getBoundingClientRect();
  return {
    w: p.getBoundingClientRect().width,
    rows: p.querySelectorAll('.codex-mp-row').length,
    ticks: [...root.querySelectorAll('.codex-mp-tick')].map((t) => { const b = t.getBoundingClientRect(); return b.left + b.width / 2 - rr.left; }),
    now: Number(root.getAttribute('aria-valuenow')),
    thumb: th.left + th.width / 2 - rr.left,
  };
}

/** 宿主自己的触发器标题（被隐藏的那一格）：B 面改档后看宿主的 store 有没有跟着变。 */
const hostTitle = () => document.querySelector('[data-slot="conversation.input.model"] > :not(.codex-mp-trigger) button')?.title ?? null;

/** A 面：宿主模型触发器与菜单。 */
const hostTrigger = () => {
  const b = document.querySelector('[data-slot="conversation.input.model"] button');
  const r = b?.getBoundingClientRect();
  return r && r.width > 0 ? { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), text: b.textContent } : null;
};
/** A 面 pending 窗口内的一帧快照。 */
function pendingSnapshot(t0) {
  const m = document.querySelector('body > div[role=menu]');
  const row = m?.querySelector('button[role=menuitemradio][aria-checked=true]') ?? null;
  const spin = row ? getComputedStyle(row.lastElementChild, '::after') : null;
  return {
    t: Math.round(performance.now() - t0),
    menu: m !== null, busy: m ? m.getAttribute('aria-busy') : '-',
    disabled: m ? m.querySelectorAll('button[role=menuitemradio]:disabled').length : 0,
    spinner: spin && spin.content !== 'none' ? spin.animationName + ' ' + spin.width : 'none',
  };
}
const MENU = 'body > div[role=menu] button';
/** 菜单项按全文精确匹配（文字里可能有正则元字符）。 */
const exact = (text) => '^' + text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$';

const browser = await launch();
const { results, check } = checklist();
try {
  const page = await browser.newPage({ width: 1280, height: 800, dpr: DPR });
  await login(page, TOKEN_URL);
  await page.evaluate(() => {
    const html = document.documentElement;
    html.setAttribute('data-windows-titlebar', '');
    html.setAttribute('data-platform', 'win32');
    html.style.setProperty('--dsh-windows-titlebar-height', '40px');
  });
  await sleep(1000);
  /* 新 profile（没配 API Key、没点过内测声明）一进来就是两层引导弹层，后面的点击全落在遮罩上。 */
  for (const text of await dismissOnboarding(page)) console.log('DISMISS ' + text);

  const idle = await page.evaluate(probeFrame);
  console.log('IDLE  ' + JSON.stringify(idle));
  let panel = null;
  if (await clickByText(page, '^打开右侧边栏$') !== null) {
    await sleep(1200);
    panel = await page.evaluate(probeFrame);
    console.log('PANEL ' + JSON.stringify(panel));
  } else {
    console.log('SKIP 右侧边栏：找不到「打开右侧边栏」按钮（可能已开着）');
  }

  /* 没有打开的会话时，composer 的模型槽指向工作区选择器，没有推理档位 —— 先开一个空会话。 */
  if (await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '新会话'); b?.click(); return b !== undefined; })) {
    console.log('NEW 点了新会话，等 composer 就绪');
    await sleep(2500);
  }
  const face = await page.waitFor(() => {
    const slot = document.querySelector('[data-slot="conversation.input.model"]');
    return slot === null ? null : slot.querySelector(':scope > .codex-mp-trigger') ? 'B' : 'A';
  }, { timeout: 10000, interval: 1000 });

  let bFace = null;
  let pendingSnaps = [];
  if (face === 'B') {
    bFace = { seat: await page.evaluate(probeSeat) };
    await page.click(bFace.seat.x, bFace.seat.y);
    await sleep(900);
    bFace.open = await page.evaluate(probePopover);
    console.log('B-FACE ' + JSON.stringify(bFace));
    if (bFace.open !== null && bFace.open.ticks.length >= 2) {
      const before = await page.evaluate(hostTitle);
      const [there, back] = bFace.open.now > 0 ? [['ArrowLeft', 37], ['ArrowRight', 39]] : [['ArrowRight', 39], ['ArrowLeft', 37]];
      await page.evaluate(() => document.querySelector('.codex-mp-root').focus());
      await page.key(...there);
      await sleep(1500);
      bFace.changed = { before, after: await page.evaluate(hostTitle), mine: await page.evaluate(() => document.querySelector('.codex-mp-trigger').title), rows: await page.evaluate(() => document.querySelectorAll('.codex-mp-row').length) };
      await page.key(...back);
      await sleep(1500);
      bFace.restored = await page.evaluate(hostTitle);
      console.log('B-FACE 改档 ' + JSON.stringify(bFace.changed) + ' 复原 ' + bFace.restored);
    }
    await page.key('Escape', 27);
    await sleep(300);
  } else if (face === 'A') {
    const trigger = await page.waitFor(hostTrigger, { timeout: 20000, interval: 1000 });
    if (trigger !== null) { await page.click(trigger.x, trigger.y); await sleep(900); }
    if (trigger === null || await clickByText(page, '推理|Reasoning', MENU) === null) {
      console.log('SKIP 模型菜单：菜单里找不到推理档位按钮');
    } else {
      await sleep(700);
      const options = await page.evaluate(() => [...document.querySelectorAll('body > div[role=menu] button[role=menuitemradio]')].map((b) => ({ text: b.textContent.trim(), checked: b.getAttribute('aria-checked') === 'true' })));
      const pick = options.find((o) => !o.checked);
      const original = options.find((o) => o.checked);
      if (pick === undefined) console.log('SKIP 模型菜单：所有档位都处于选中态，无待切换项');
      else {
        /* 用 CDP 给这一次往返加时延，把 pending 窗口拉回真实机器上的量级（实测 ~1.1s）。 */
        if (LATENCY > 0) await page.send('Network.emulateNetworkConditions', { offline: false, latency: LATENCY, downloadThroughput: -1, uploadThroughput: -1 });
        const t0 = await page.evaluate(() => performance.now());
        await clickByText(page, exact(pick.text), MENU);
        for (let i = 0; i < 6; i += 1) {
          await sleep(60);
          const snap = await page.evaluate(pendingSnapshot, t0);
          pendingSnaps.push(snap);
          console.log('PENDING ' + JSON.stringify(snap));
          if (!snap.menu) break;
        }
        if (LATENCY > 0) await page.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
        /* 改回原档：探针不留现场。 */
        await sleep(Math.max(1500, LATENCY * 2));
        const again = await page.evaluate(hostTrigger);
        if (original !== undefined && again !== null) {
          await page.click(again.x, again.y);
          await sleep(700);
          if (await clickByText(page, '推理|Reasoning', MENU) !== null) {
            await sleep(600);
            if (await clickByText(page, exact(original.text), MENU) !== null) { await sleep(1200); console.log('RESTORE 推理档位改回 ' + original.text); }
          }
        }
      }
    }
  } else {
    console.log('SKIP 模型位：composer 的 conversation.input.model 槽没出现（会话未就绪）');
  }

  /* 只对这次真的量到的状态判定。 */
  /* 中列环境影浅/深两套基线（window-shadow.css:54 亮 13px @7% / :64 暗 24px @50%）。
     旧断言写死 24px，亮色下必失败 —— 按当前主题分别验证，不改控件去迎合脚本。 */
  const centerAmbient = idle.dark ? '24px' : '13px';
  check('中列 0.5px 发丝线 + ' + centerAmbient + ' 环境影（' + (idle.dark ? '暗' : '亮') + '）',
    /\.5px/.test(idle.centerShadow) && idle.centerShadow.includes(centerAmbient),
    idle.centerShadow + ' dark=' + idle.dark);
  check('中列圆角 16px', idle.centerRadius === '16px', idle.centerRadius);
  /* 侧栏右边框：codex-ink 的既定行为是**保留宿主那条发丝线、只把它压到 l1**
     （window-shadow.css:108 的注释写得很明确），不是把它去掉。
     旧断言写死 "0px"，只在「宿主没画 + 没有主题插件接管」的裸环境里成立；
     真实组合里 dsh-ivory 以 !important 画了 0.5px（CDP 匹配规则实测：
     body.dsh-ivory:not(.dshcs-contract-mismatch) .pI_x6G_sidebarCol{border-right:.5px solid var(--cl-border)!important}），
     于是成了假失败 —— 那是别人的属性，不是 codex-ink 的。
     改判为「发丝线」契约：≤1px 才算通过，粗线仍旧算回归；并把主题类名带进输出。 */
  const sideBorderW = parseFloat(String(idle.sidebarBorder)) || 0;
  check('侧栏右边框是发丝线（≤1px，非粗线）',
    sideBorderW <= 1,
    idle.sidebarBorder + ' · theme=' + idle.theme);
  check('左分界线无悬停渐变', idle.handleLeft !== null && idle.handleLeft.grad === false, JSON.stringify(idle.handleLeft));
  /* 右栏已开着时（宿主记得上一次状态），IDLE 那一帧就能量到面板。 */
  const panelState = panel ?? (idle.panelShadow && idle.panelShadow !== 'none' ? idle : null);
  if (panelState !== null) {
    check('右栏面板左沿发丝线', /\.5px/.test(String(panelState.panelShadow)), panelState.panelShadow);
    check('右栏面板影只往上泄（负 spread）', /-12px 24px -12px/.test(String(panelState.panelShadow)), panelState.panelShadow);
    check('右分界线带渐变', panelState.handleRight !== null && panelState.handleRight.grad === true, JSON.stringify(panelState.handleRight));
  }
  /* ── T06 / UX-08：页签隐去受「出口就绪」门控 ────────────────────────────
     ⑬ 隐去页签的前提，是 trajectory-exit.js 能可靠找回对话页签（盖 body[data-codex-ui-te-ready]）。
     两段都验：就绪时隐去（⑬ 视觉保持）；把标记摘掉后必须**重新可见**
     —— 摘掉还看不见，说明隐去是写死的，认不出页签的用户就无路可退。 */
  const navProbe = await page.evaluate(() => {
    const tabs = document.querySelector('[data-conversation-tabs]');
    return {
      hasNode: tabs !== null,
      ready: document.body.hasAttribute('data-codex-ui-te-ready'),
      visible: tabs !== null && tabs.offsetParent !== null,
    };
  });
  if (navProbe.hasNode) {
    check('T06 出口就绪标记已盖（找得回对话页签）', navProbe.ready === true, JSON.stringify(navProbe));
    check('T06 就绪时页签隐去（⑬ 视觉保持）', navProbe.visible === false, JSON.stringify(navProbe));
    const afterDrop = await page.evaluate(() => {
      document.body.removeAttribute('data-codex-ui-te-ready');
      const tabs = document.querySelector('[data-conversation-tabs]');
      return { visible: tabs !== null && tabs.offsetParent !== null };
    });
    check('T06 摘掉标记后页签重新可见（不会无路可退）', afterDrop.visible === true, JSON.stringify(afterDrop));
    await page.evaluate(() => document.body.setAttribute('data-codex-ui-te-ready', ''));
  } else {
    console.log('SKIP T06 导航：当前页没有页签条节点（hero/空白态），本组不判定');
  }

  if (pendingSnaps.length > 0) {
    check('pending 窗口内 aria-busy', pendingSnaps.some((x) => x.busy === 'true'), JSON.stringify(pendingSnaps.map((x) => x.busy)));
    check('pending 窗口内整列 disabled', pendingSnaps.some((x) => x.disabled >= 2), JSON.stringify(pendingSnaps.map((x) => x.disabled)));
    check('pending 转圈在跑', pendingSnaps.some((x) => /codex-ui-spin/.test(x.spinner)), JSON.stringify(pendingSnaps.map((x) => x.spinner)));
  }
  if (bFace !== null) {
    check('B 面：自建触发器在席、宿主那一格隐藏', bFace.seat.hostHidden === true && Math.round(bFace.seat.h) === 28, JSON.stringify(bFace.seat));
    check('B 面：弹层 254px、有模型行', bFace.open !== null && Math.round(bFace.open.w) === 254 && bFace.open.rows >= 1, JSON.stringify(bFace.open));
    if (bFace.open !== null && bFace.open.ticks.length >= 2) {
      const ticks = bFace.open.ticks;
      const step = (ticks.at(-1) - ticks[0]) / (ticks.length - 1);
      /* 首档 = THUMB_SIZE/2 = 8px（view.js:15 THUMB_SIZE=16；component.js:542 同式）。
         旧断言写死 14px 是 THUMB_SIZE=28 时代的残留 —— 不把控件改成 28px 圆旋钮来迎合它。 */
      check('B 面：档位等距、首档在 8px', Math.abs(ticks[0] - 8) <= 1 && ticks.every((x, i) => Math.abs(x - (ticks[0] + step * i)) <= 1), JSON.stringify(ticks));
      check('B 面：拇指落在生效档上', Math.abs(bFace.open.thumb - ticks[bFace.open.now]) <= 1, bFace.open.thumb + ' vs ' + ticks[bFace.open.now]);
      check('B 面：键盘改档写进宿主的 store（宿主自己的触发器标题跟着变）', bFace.changed.after !== null && bFace.changed.after !== bFace.changed.before && bFace.changed.mine === bFace.changed.after, JSON.stringify(bFace.changed));
      check('B 面：改档往返中列表不清空', bFace.changed.rows === bFace.open.rows, bFace.changed.rows + ' / ' + bFace.open.rows);
      check('B 面：改回原档（探针不留现场）', bFace.restored === bFace.changed.before, bFace.restored + ' / ' + bFace.changed.before);
    }
  }
  console.log('模型位：' + (bFace !== null ? 'B 面自建选择器' : pendingSnaps.length > 0 ? 'A 面宿主菜单' : '未量到（见上面的 SKIP）'));
  fs.mkdirSync(dirname(SHOT), { recursive: true });
  await page.screenshot({ path: SHOT });
  console.log('截图 ' + SHOT);
} catch (e) {
  check('探针运行出错', false, e.stack ?? e.message);
} finally {
  await browser.close();
}
summarize(results);
