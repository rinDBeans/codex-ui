#!/usr/bin/env node
/**
 * live/content.mjs — T07 高频内容组件的**真实样本**取证（tools/skills/approval/questions/goals/references）。
 *
 *   node scripts/live/content.mjs --url "http://127.0.0.1:3188/?token=…" [--shots <目录>] [--prompt "…"]
 *
 * 为什么必须真 GUI：T07 的全部验收（摘要/详情/等待/失败/取消、按钮与答复可用、状态易识别）
 * 都发生在**真实会话流**里。verify.mjs 的夹具复刻不出宿主的工具卡 / 审批卡 / 提问卡 ——
 * 它们的内容来自真实 agent 回合，DOM 由 dsh-client-ui-tool / approval / user-questions 三个包现渲。
 *
 * 采集方式：在真 GUI 里发一条会触发多次工具调用的消息，等它跑完，然后把每个内容锚点的
 * **结构 + 计算样式 + 状态词表**抓下来。抓不到就如实报 0 —— 不用夹具数据冒充真实样本。
 *
 * 取不到样本时（模型不可用 / 审批策略不弹 / 预设无工具）脚本整体 SKIP，不 FAIL：
 * 宿主行为不在本仓库管辖内，硬判失败会制造假红。
 */
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clickByText, dismissOnboarding, launch, login, openHome, sleep } from '../lib/cdp.mjs';
import { checklist, summarize } from '../lib/checks.mjs';

const arg = (name, fallback) => {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const TOKEN_URL = arg('url', '');
const SHOTS = arg('shots', join(tmpdir(), 'codex-ui-shots'));
/* prompt 优先从 --prompt-file 读：中文 + Windows 路径穿过 bash → PowerShell 两层会被截断
   （实测只传到"请创建一个文件请创建一个文件"就断了，后半句连同路径一起丢）。
   走文件能同时绕开引号转义与编码问题。 */
const PROMPT_FILE = arg('prompt-file', '');
const PROMPT = PROMPT_FILE !== ''
  ? fs.readFileSync(PROMPT_FILE, 'utf8').trim()
  : arg('prompt', '用 read 工具读取 profiles/web/package.json，然后用 grep 在该目录里找 name 字段，最后用一句话总结。');
const RUN_MS = Number(arg('run-ms', '150000'));
/* 等哪个锚点出现才算采到（默认 data-tool）。三类覆盖用同一个脚本采：
   --wait-for data-question-key 采提问卡、data-approval-key 采审批卡、data-trigger-menu 采引用菜单。 */
const WAIT_FOR = arg('wait-for', 'data-tool');
/* 提问类需要脚本代答，否则模型会一直等；这里提供一个自动回答。 */
const AUTO_REPLY = arg('auto-reply', '');
/* --type-at <文本>：只把文本敲进输入框触发内联组件（@ 引用菜单 / 斜杠命令），
   **不发消息**。发了菜单就关上了 —— 这与 --wait-for 是两类完全不同的采样。
   典型用法：--type-at "@" --wait-for data-trigger-menu */
const TYPE_AT = arg('type-at', '');
if (TOKEN_URL === '') {
  console.error('缺少 --url "http://127.0.0.1:<port>/?token=…"（dsh web 启动时打印）');
  process.exit(2);
}
fs.mkdirSync(SHOTS, { recursive: true });

/* T07 验收要求的内容锚点。value 缺失即该类样本没采到 —— 如实报 0，不猜。 */
const ANCHORS = {
  tool: 'data-tool',
  toolState: 'data-state',
  toolCall: 'data-chat-call-id',
  subcalls: 'data-subcalls',
  expandable: 'data-expandable',
  approval: 'data-approval-key',
  approvalScroll: 'data-approval-scroll',
  question: 'data-question-key',
  questionScroll: 'data-question-scroll',
  questionReply: 'data-question-reply',
  replyOutcome: 'data-reply-outcome',
  goalBar: 'data-goal-bar',
  triggerMenu: 'data-trigger-menu',
  composerChip: 'data-composer-chip',
  trajectoryScroll: 'data-trajectory-scroll',
  chatFlow: 'data-chat-flow',
  variant: 'data-variant',
};

/** 页内采集：每个锚点的出现次数、状态词表、以及前若干个节点的计算样式摘要。 */
const probe = (anchors) => {
  const out = { counts: {}, states: {}, variants: {}, samples: {} };
  for (const [k, attr] of Object.entries(anchors)) {
    const nodes = [...document.querySelectorAll('[' + attr + ']')];
    out.counts[k] = nodes.length;
    if (nodes.length === 0) continue;
    if (k === 'toolState') out.states = [...new Set(nodes.map((n) => n.getAttribute(attr)))].sort();
    if (k === 'variant') out.variants = [...new Set(nodes.map((n) => n.getAttribute(attr)))].sort();
    out.samples[k] = nodes.slice(0, 3).map((n) => {
      const cs = getComputedStyle(n);
      const r = n.getBoundingClientRect();
      const label = (n.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 60);
      return {
        attr: Object.fromEntries([...n.attributes].map((a) => [a.name, a.value.slice(0, 40)])),
        text: label,
        box: { w: Math.round(r.width), h: Math.round(r.height) },
        style: {
          bg: cs.backgroundColor, color: cs.color, radius: cs.borderTopLeftRadius,
          font: cs.fontFamily.split(',')[0], size: cs.fontSize, border: cs.borderTopWidth + ' ' + cs.borderTopStyle,
          pad: cs.padding, display: cs.display, overflowY: cs.overflowY,
        },
      };
    });
  }
  /* 失败态取证：error / idle 节点的文本 + 祖先 class 链。上一轮 data-state=error 只有一个计数，
     读不出原因；把文本和祖先抓下来才知道是模型不可用、provider 没配、还是权限被拒。
     class 名可能带哈希后缀，只取前两段做定位，不做选择器契约。 */
  /* 错误节点的文案不在自身：_dot_xxx 是纯装饰点，文字在兄弟节点。
     所以除了锚点本身，还要把每个 flowItem 的 innerText 与所有 class 含 error 的元素文本都抓出来。 */
  out.errorText = [...document.querySelectorAll('[class*="rror"]')]
    .map((n) => (n.textContent ?? '').trim().replace(/\s+/g, ' '))
    .filter((s) => s.length > 0 && s.length < 400);
  out.flowItems = [...document.querySelectorAll('[data-chat-flow] [class*="flowItem"], [data-chat-flow] > *')].map((n) => (n.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 400));
  out.errors = [...document.querySelectorAll('[data-state="error"], [data-state="idle"]')].map((n) => {
    const chain = [];
    for (let e = n, i = 0; e !== null && i < 5; e = e.parentElement, i += 1) {
      chain.push(String(e.className || e.tagName).split(/\s+/).slice(0, 2).join('.'));
    }
    return { state: n.getAttribute('data-state'), text: (n.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 300), chain };
  });
  out.visibleText = (document.querySelector('[data-chat-flow]')?.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 600);
  return out;
};


/** 提问卡代答：优先点提交按钮，否则在输入区插文本再发 Enter。 */
async function autoAnswer(page, text) {
  const done = await page.evaluate((t) => {
    const frame = document.querySelector('[data-question-key]');
    if (frame === null) return false;
    const editable = frame.querySelector('[data-question-reply]') ?? frame.querySelector('[contenteditable="true"]') ?? frame.querySelector('textarea');
    if (editable === null) return false;
    editable.focus();
    if (editable.isContentEditable) {
      document.execCommand('insertText', false, t);
      editable.dispatchEvent(new InputEvent('input', { bubbles: true, data: t, inputType: 'insertText' }));
    } else {
      const setter = Object.getOwnPropertyDescriptor(editable.constructor.prototype, 'value')?.set;
      setter?.call(editable, t);
      editable.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return true;
  }, text);
  if (!done) return false;
  await sleep(300);
  const box = await page.evaluate(() => {
    const frame = document.querySelector('[data-question-key]');
    if (frame === null) return null;
    const btn = [...frame.querySelectorAll('button')].find((b) => /^(提交|发送|确认|Send|Submit|OK)$/i.test((b.textContent ?? '').trim()));
    if (btn === null) return null;
    const r = btn.getBoundingClientRect();
    return [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)];
  });
  if (box !== null) await page.click(box[0], box[1]);
  else await page.key('Enter', 13);
  await sleep(600);
  return true;
}

const { results, check } = checklist();
const browser = await launch();
let code = 0;
try {
  const page = await browser.newPage({ width: 1440, height: 900, dpr: 1 });
  await login(page, TOKEN_URL);
  await openHome(page, new URL(TOKEN_URL).origin);
  await dismissOnboarding(page);
  await sleep(2500);

  /* 前置自检：会话区在不在。取不到会话区就没法采内容样本 —— 这是环境问题不是产品问题。 */
  const boot = await page.evaluate(() => ({
    sidebar: document.querySelectorAll('[data-slot=sidebar]').length,
    composer: document.querySelectorAll('[data-composer-card]').length,
    editor: document.querySelectorAll('[data-lexical-editor=true]').length,
    body: (document.body.className || '(none)'),
  }));
  console.log('BOOT ' + JSON.stringify(boot));
  check('会话区已挂载（否则内容样本无从采集）', boot.composer > 0 || boot.editor > 0, JSON.stringify(boot));

  /* 新建会话：点侧栏「新建」；点不到就说明已在空白会话里，直接发。 */
  await clickByText(page, '^(新建|New|新会话|New chat)$', 'button, a');
  await sleep(1200);

  /* 模式 A：--type-at —— 只输入不发送，用于采内联组件（引用菜单 / 斜杠命令）。 */
  if (TYPE_AT !== '') {
    const typed = await page.evaluate((text) => {
      const ed = document.querySelector('[data-lexical-editor=true]');
      if (ed === null) return { ok: false, why: 'no editor' };
      ed.focus();
      document.execCommand('insertText', false, text);
      ed.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
      return { ok: true };
    }, TYPE_AT);
    console.log('TYPED ' + JSON.stringify(typed));
    check('已敲入触发文本（不发送）', typed.ok === true, JSON.stringify(typed));
    const dl = Date.now() + 20000;
    let found = 0;
    while (Date.now() < dl) {
      found = await page.evaluate((a) => document.querySelectorAll('[' + a + ']').length, WAIT_FOR);
      if (found > 0) break;
      await sleep(700);
    }
    check('T07 真实样本：' + WAIT_FOR + ' 出现', found > 0, '命中 ' + found);
    const ref = await page.evaluate(() => {
      const menu = document.querySelector('[data-trigger-menu]');
      if (menu === null) return null;
      const cs = getComputedStyle(menu);
      return {
        overflowBelow: menu.hasAttribute('data-overflow-below'),
        sources: [...menu.querySelectorAll('[data-source]')].map((n) => ({ source: n.getAttribute('data-source'), text: (n.textContent ?? '').trim().slice(0, 40) })),
        groups: menu.querySelectorAll('[data-source]').length,
        pending: menu.querySelectorAll('[role="status"]').length,
        listbox: menu.querySelectorAll('[role="listbox"]').length,
        options: menu.querySelectorAll('[role="option"]').length,
        titleColor: menu.querySelector('[data-source]') === null ? null : getComputedStyle(menu.querySelector('[data-source]')).color,
        titleSize: menu.querySelector('[data-source]') === null ? null : getComputedStyle(menu.querySelector('[data-source]')).fontSize,
        titleFont: menu.querySelector('[data-source]') === null ? null : getComputedStyle(menu.querySelector('[data-source]')).fontFamily,
        titleTransform: menu.querySelector('[data-source]') === null ? null : getComputedStyle(menu.querySelector('[data-source]')).textTransform,
        maxH: cs.maxHeight,
        bg: cs.backgroundColor,
      };
    });
    console.log('REFMENU ' + JSON.stringify(ref, null, 1));
    await page.screenshot({ path: join(SHOTS, 'live-refmenu.png') });
    fs.writeFileSync(join(SHOTS, 'live-refmenu.json'), JSON.stringify(ref, null, 2), 'utf8');
    if (ref !== null) {
      check('组标题挂在 [data-source] 上（不是 [data-dsh-part]）', ref.groups > 0, 'groups=' + ref.groups);
      check('组标题是 UI 字体且不大写',
        ref.titleFont !== null && !/monospace|Consolas/i.test(ref.titleFont) && ref.titleTransform === 'none',
        (ref.titleFont ?? '') + ' / ' + (ref.titleTransform ?? ''));
      check('菜单是 listbox（有 ARIA 角色）', ref.listbox > 0, String(ref.listbox));
    }
    console.log('TYPED-MODE 结束（未发送消息）');
  } else {
  /* 模式 B：发一条必然触发多次工具调用的消息。 */
  const sent = await page.evaluate(async (text) => {
    const ed = document.querySelector('[data-lexical-editor=true]');
    if (ed === null) return { ok: false, why: 'no editor' };
    ed.focus();
    /* lexical: 直接派发 beforeinput/input 不如用 execCommand 插入真实文本节点 */
    document.execCommand('insertText', false, text);
    ed.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
    await new Promise((r) => setTimeout(r, 300));
    /* 发送：优先找发送键，否则 Enter。 */
    const send = document.querySelector('[data-slot="conversation.composer"] button[type=submit]')
      ?? document.querySelector('[data-composer-card] button[class$="_send"]');
    if (send !== null) { send.click(); return { ok: true, how: 'click' }; }
    ed.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    return { ok: true, how: 'enter' };
  }, PROMPT);
  console.log('SENT ' + JSON.stringify(sent));
  check('消息已发出（点发送键或 Enter）', sent.ok === true, JSON.stringify(sent));

  /* 等回合跑完：轮询 data-tool 出现，最长 RUN_MS。 */
  const deadline = Date.now() + RUN_MS;
  const t0 = Date.now();
  let hitAt = null;
  while (Date.now() < deadline) {
    const n = await page.evaluate((a) => document.querySelectorAll('[' + a + ']').length, WAIT_FOR);
    if (n > 0) { hitAt = Date.now(); break; }
    /* 提问类：模型在等回答，脚本代填一段再继续等下一个锚点。 */
    if (AUTO_REPLY !== '') await autoAnswer(page, AUTO_REPLY);
    await sleep(2000);
  }
  if (hitAt === null) {
    check('T07 真实样本：' + WAIT_FOR + ' 出现', false, 'RUN_MS 内命中 0（该类样本本轮没触发）');
  } else {
    check('T07 真实样本：' + WAIT_FOR + ' 出现', true, '用时 ' + ((hitAt - t0) / 1000).toFixed(1) + 's');
    await sleep(Math.min(45000, Math.max(0, deadline - Date.now())));
  }

  const data = await page.evaluate(probe, ANCHORS);
  console.log('COUNTS ' + JSON.stringify(data.counts));
  console.log('STATES ' + JSON.stringify(data.states));
  console.log('VARIANTS ' + JSON.stringify(data.variants));
  console.log('ERRORS ' + JSON.stringify(data.errors ?? [], null, 1));
  console.log('FLOWTEXT ' + JSON.stringify(data.visibleText ?? ''));
  console.log('ERRTEXT ' + JSON.stringify(data.errorText ?? [], null, 1));
  console.log('FLOWITEMS ' + JSON.stringify(data.flowItems ?? [], null, 1));
  await page.screenshot({ path: join(SHOTS, 'live-content.png') });
  fs.writeFileSync(join(SHOTS, 'live-content.json'), JSON.stringify(data, null, 2), 'utf8');
  console.log('样本已写 ' + join(SHOTS, 'live-content.json'));

  /* 只有采到工具卡才继续断言「状态易识别」这类视觉命题；否则整体 SKIP。 */
  if (data.counts.tool > 0) {
    check('工具卡带 data-state（状态可判别）', (data.states ?? []).length > 0, JSON.stringify(data.states));
    check('工具卡状态词表不含未定义值', (data.states ?? []).every((s) => /^(preparing|running|ok|error|cancelled|pending|done|success|failure)$/.test(s)), JSON.stringify(data.states));
  } else {
    check('工具卡带 data-state（状态可判别）', null, 'SKIP：没有真实工具样本');
    check('工具卡状态词表不含未定义值', null, 'SKIP：没有真实工具样本');
  }
  if (data.counts.chatFlow > 0) {
    check('会话流容器存在（data-chat-flow）', true, String(data.counts.chatFlow));
  } else {
    check('会话流容器存在（data-chat-flow）', false, 'data-chat-flow = 0');
  }
  for (const [k, n] of Object.entries(data.counts)) {
    if (k === 'chatFlow') continue;
    console.log('  SAMPLE ' + k.padEnd(16) + ' = ' + n);
  }
  } /* 模式 B 结束 */
} catch (e) {
  check('content live 运行出错', false, e.stack ?? e.message);
  code = 1;
} finally {
  await browser.close();
}
summarize(results);
process.exit(code || 0);
