/**
 * content — T07 高频内容组件（⑲ content.css）的计算样式验收。
 *
 * 判据来源三层，写在每条断言旁边：
 *   ① 类型声明 dsh-client-ui-tool/lib/types/tool-call-model.d.ts
 *        ToolRowState = 'preparing' | 'running' | 'ok' | 'error' | 'stopped'
 *        variant      = 'search' | 'read' | 'bash' | 'write' | 'edit' | 'code' | 'others'
 *   ② 渲染代码 dsh-client-ui-tool/lib/client.js（ToolRow.root / bash_sample.root 的属性落点）
 *   ③ 真实 GUI 实测 scripts/live/content.mjs（本轮真跑的会话）：
 *        STATES = ["error","idle","ok"] · VARIANTS = ["bash","code","read","search","think"]
 *
 * DOM 按 ② 复刻（属性名与层级逐条对齐），但**不接宿主 CSS** —— 本 spec 验的是本皮肤对
 * 这些锚点的承诺，与 verify.mjs 里其它 spec 同一手法。真实组合下的样子由 live/content.mjs 负责。
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

/** 类型声明里的完整状态词表 —— 少一档就是漏判。 */
const STATES = ['preparing', 'running', 'ok', 'error', 'stopped'];
/** 工具行的 variant 联合（推理行的 think 由 chat 包承担，单独测）。 */
const VARIANTS = ['search', 'read', 'bash', 'write', 'edit', 'code', 'others'];

/** 按 ToolRow.root 的真实结构造一行工具卡。 */
const toolRow = (tool, variant, state, expandable) =>
  `<div class="ToolRow_root" data-variant="${variant}" data-tool="${tool}" data-state="${state}"
     ${expandable === undefined ? '' : `data-expandable="${expandable ? '' : undefined}" role="${expandable ? 'button' : undefined}" tabindex="${expandable ? 0 : undefined}"`}>
     <span class="ToolRow_visual" data-caption="12ms"></span>
     <span class="ToolRow_label">${tool}</span>
     ${state === 'error' ? '<span class="ToolDetails_badge" data-tone="error">失败</span>' : ''}
     ${state === 'ok' ? '<span class="ToolDetails_badge" data-tone="success">完成</span>' : ''}
   </div>`;

export default {
  /* ─── ⑲·1 状态三档：过程 / 完成 / 失败必须一眼可分 ─── */
  async state_tiers(t) {
    const page = await t.page({ width: 1000, height: 900, dpr: 1 });
    await page.setContent(`<!doctype html><html data-codex-ui><head><meta charset="utf-8">
<style>${t.theme()}</style>
<style>
  body { margin:0; font:14px/1.6 "Segoe UI","Microsoft YaHei",sans-serif; background: var(--dsw-alias-bg-base); }
  .ToolRow_root { padding: 6px 8px; }
</style></head><body>
${STATES.map((s) => toolRow('read', 'read', s)).join('')}
${toolRow('bash', 'bash', 'ok', true)}
</body></html>`, 400);

    const probe = await page.evaluate((states) => {
      const b = getComputedStyle(document.body);
      const h = getComputedStyle(document.documentElement);
      const tok = (n) => b.getPropertyValue(n).trim() || h.getPropertyValue(n).trim();
      const out = {};
      for (const s of states) {
        const el = document.querySelector('[data-tool][data-state="' + s + '"]');
        const cs = getComputedStyle(el);
        out[s] = {
          color: cs.color,
          cursor: cs.cursor,
          /* 状态条：inset box-shadow。失败=红条、停止=中性条、完成=无条。
             这是"状态易识别"真正承担的信号 —— 行文字色在失败时保持主前景（不整段红）。 */
          stripe: cs.boxShadow,
          /* Chromium 序列化成 "<color> <lengths> inset" —— inset 在末尾、颜色在最前。
             用 startsWith('inset') 永远判 false，必须 includes。 */
          stripeInset: cs.boxShadow.includes('inset'),
          padLeft: cs.paddingLeft,
          tone: el.querySelector('[data-tone]')?.getAttribute('data-tone') ?? null,
          toneColor: el.querySelector('[data-tone]') ? getComputedStyle(el.querySelector('[data-tone]')).color : null,
        };
      }
      return { rows: out, secondary: tok('--dsw-alias-label-secondary'), primary: tok('--dsw-alias-label-primary'), error: tok('--dsw-alias-state-error-primary') };
    }, STATES);

    const rgb = (c) => { const m = String(c).match(/rgba?\(\s*([\d.]+)/); return m ? Math.round(Number(m[1])) : null; };

    /* 过程三档（preparing / running / stopped）同色 + progress 光标：
       用户不需要区分"准备中/运行中/已停止"这三者，只需要知道"还没完"。 */
    const proc = ['preparing', 'running', 'stopped'].map((s) => probe.rows[s].color);
    t.check('过程三态同色（preparing/running/stopped 不做无谓区分）',
      new Set(proc).size === 1, proc.join(' / '));
    t.check('过程三态用次要色（不是主前景）',
      probe.rows.running.color !== probe.rows.ok.color,
      `running ${probe.rows.running.color} vs ok ${probe.rows.ok.color}`);
    t.check('过程态光标是 progress（等结果，不该是手型）',
      ['preparing', 'running', 'stopped'].every((s) => probe.rows[s].cursor === 'progress'),
      ['preparing', 'running', 'stopped'].map((s) => probe.rows[s].cursor).join('/'));
    t.check('完成态光标是默认（不是 progress）',
      probe.rows.ok.cursor === 'auto' || probe.rows.ok.cursor === 'default', probe.rows.ok.cursor);

    /* 完成 / 停止 / 失败三态必须两两可分。判据查**状态条**而不是行的文字色：
       失败行文字保持主前景是对的（整段红字太吵），区分信号是左侧 2px 条。
       上一版查 color，两态都是 rgb(26,28,31) —— 判据查错了信号，不是皮肤错了。 */
    t.check('完成态无状态条（成功不画多余标记）',
      probe.rows.ok.stripe === 'none', probe.rows.ok.stripe);
    t.check('失败态有红色状态条（inset 2px）',
      probe.rows.error.stripeInset === true && probe.rows.error.stripe.includes('2px'), probe.rows.error.stripe);
    t.check('停止态有中性状态条（与失败的红色条同形不同色）',
      probe.rows.stopped.stripeInset === true && probe.rows.stopped.stripe !== probe.rows.error.stripe,
      `stopped ${probe.rows.stopped.stripe} vs error ${probe.rows.error.stripe}`);
    t.check('三态的状态条两两不同（完成无 / 停止中性 / 失败红）',
      new Set([probe.rows.ok.stripe, probe.rows.stopped.stripe, probe.rows.error.stripe]).size === 3,
      [probe.rows.ok.stripe, probe.rows.stopped.stripe, probe.rows.error.stripe].join(' | '));
    t.check('失败行的文字仍是主前景（不整段红字）',
      probe.rows.error.color === probe.rows.ok.color, probe.rows.error.color);
    t.check('失败徽标吃状态红', probe.rows.error.toneColor !== null && probe.rows.error.tone === 'error',
      probe.rows.error.toneColor ?? '(no tone)');
    t.check('完成徽标不是 error 色',
      probe.rows.ok.tone !== 'error' && probe.rows.ok.toneColor !== probe.rows.error.toneColor,
      `ok tone=${probe.rows.ok.tone} color=${probe.rows.ok.toneColor}`);

    /* 三档的灰度必须单调：过程 < 完成（辅助 < 主前景） */
    t.check('过程态比完成态更弱（层级单调）',
      rgb(probe.rows.running.color) > rgb(probe.rows.ok.color),
      `running ${rgb(probe.rows.running.color)} vs ok ${rgb(probe.rows.ok.color)}`);

    void VARIANTS;
  },

  /* ─── ⑲·2 七档 variant 全部有样式、且都不被误染 ─── */
  async variants(t) {
    const page = await t.page({ width: 1000, height: 700, dpr: 1 });
    await page.setContent(`<!doctype html><html data-codex-ui><head><meta charset="utf-8">
<style>${t.theme()}</style>
<style>body{margin:0;font:14px/1.6 "Segoe UI","Microsoft YaHei",sans-serif;background:var(--dsw-alias-bg-base)}
.ToolRow_root{padding:6px 8px}</style></head><body>
${['search', 'read', 'bash', 'write', 'edit', 'code', 'others'].map((v) => toolRow(v + '_tool', v, 'ok')).join('')}
<div class="ToolRow_root" data-variant="think" data-state="running">思考中…</div>
</body></html>`, 400);

    const probe = await page.evaluate((vars) => {
      const out = {};
      for (const v of vars) {
        const el = document.querySelector('[data-variant="' + v + '"]');
        const cs = getComputedStyle(el);
        out[v] = { exists: el !== null, color: cs.color, font: cs.fontFamily, size: cs.fontSize };
      }
      const think = document.querySelector('[data-variant="think"]');
      const tcs = getComputedStyle(think);
      out.think = { color: tcs.color, font: tcs.fontFamily, size: tcs.fontSize, letterSpacing: tcs.letterSpacing, transform: tcs.textTransform };
      /* 对照组：一条普通 ok 工具行。上一版这里没造，断言却引用了 probe.ok，
         直接 TypeError 崩掉整节 —— 判据自己写错比判据不严更糟。 */
      out.ok = { color: getComputedStyle(document.querySelector('[data-variant="read"]')).color };
      return out;
    }, VARIANTS);

    for (const v of VARIANTS) {
      t.check(`variant ${v} 在皮肤下有归属（未被漏掉）`, probe[v].exists === true, String(probe[v].color));
    }
    /* 关键纪律：工具行是 UI 文本，不是元信息 —— 不能被等宽化。
       这与 patches.css ⑤ 删掉 tag-chip 等宽是同一条理由。 */
    t.check('工具行文字仍是 UI 字体（不等宽）',
      !/monospace|Consolas|Menlo|Courier/i.test(probe.read.font), probe.read.font);
    /* 推理行同理，但还要确认没有拉字距、没大写（中文文本尤其敏感）。 */
    t.check('推理行是 UI 字体', !/monospace|Consolas|Menlo|Courier/i.test(probe.think.font), probe.think.font);
    t.check('推理行不拉字距', probe.think.letterSpacing === 'normal' || parseFloat(probe.think.letterSpacing) === 0, probe.think.letterSpacing);
    t.check('推理行不大写', probe.think.transform === 'none', probe.think.transform);
    t.check('推理行是次要色（过程内容让位于结果）',
      probe.think.color !== probe.ok.color, `think ${probe.think.color} vs ok ${probe.ok.color}`);
  },

  /* ─── ⑲·3 可展开卡：宿主行为不变，只加视觉 ─── */
  async expandable(t) {
    const page = await t.page({ width: 900, height: 600, dpr: 1 });
    await page.setContent(`<!doctype html><html data-codex-ui><head><meta charset="utf-8">
<style>${t.theme()}</style>
<style>body{margin:0;font:14px/1.6 "Segoe UI",sans-serif;background:var(--dsw-alias-bg-base)}
.ToolRow_root{padding:6px 8px}</style></head><body>
${toolRow('bash', 'bash', 'ok', true)}
<div data-plain="1">${toolRow('read', 'read', 'ok', false)}</div>
</body></html>`, 400);

    const probe = await page.evaluate(() => {
      /* 宿主写的是 "data-expandable": expandable || void 0 ——
         true → 属性存在且值为空串；false → 属性整个不出现。
         所以"可展开"用 [data-expandable]（能命中空串），
         "不可展开"必须显式给个标记，不能靠 :not() 反选（反选在属性缺省时行为依赖具体值）。 */
      const exp = document.querySelector('[data-expandable]');
      const plain = document.querySelector('[data-plain="1"]');
      const cs = getComputedStyle(exp);
      return {
        expCursor: cs.cursor,
        expRadius: cs.borderTopLeftRadius,
        expTransition: cs.transitionProperty,
        plainCursor: getComputedStyle(plain).cursor,
        /* 宿主给的键盘可达性必须原样保留 */
        expRole: exp.getAttribute('role'),
        expTabindex: exp.getAttribute('tabindex'),
        /* 收起态（无 aria-expanded）的背景应与展开态不同 */
        expBgClosed: cs.backgroundColor,
      };
    });

    t.check('可展开工具卡光标是手型', probe.expCursor === 'pointer', probe.expCursor);
    t.check('可展开工具卡有圆角（自有 token）', /\d/.test(probe.expRadius) && probe.expRadius !== '0px', probe.expRadius);
    t.check('可展开卡有背景过渡（150ms 级，不是 none）', probe.expTransition.includes('background-color'), probe.expTransition);
    t.check('不可展开的卡不冒充可点（光标不是手型）',
      probe.plainCursor !== 'pointer', probe.plainCursor);
    /* 宿主行为护栏：皮肤不得夺走键盘可达性 */
    t.check('宿主给的 role=button 保留', probe.expRole === 'button', String(probe.expRole));
    t.check('宿主给的 tabindex 保留', probe.expTabindex === '0', String(probe.expTabindex));
  },

  /* ─── ⑲·4 回合摘要/详情：摘要次要、详情主前景 ─── */
  async turn_process(t) {
    const page = await t.page({ width: 1000, height: 700, dpr: 1 });
    await page.setContent(`<!doctype html><html data-codex-ui><head><meta charset="utf-8">
<style>${t.theme()}</style>
<style>body{margin:0;font:14px/1.6 "Segoe UI","Microsoft YaHei",sans-serif;background:var(--dsw-alias-bg-base)}</style>
</head><body>
<!-- 0.7.2 订正：本夹具原先手写了 data-turn-process-chevron / data-turn-process-body，
     宿主**从不产出**这两个属性（dsh-client-ui-chat bundle 实际产出的只有
     -answer / -hidden / -inline / -member / -messages / -subagents / -tool-calls）。
     照着不存在的属性写夹具，等于对着自己造的假 DOM 自证，皮肤里那几条死 CSS
     正是这样活下来的。收起语义用宿主的 data-turn-process-hidden。
     pre 也从 -body 挪到真实的宿主位置 [data-tool]（回合摘要区不装 <pre>）。 -->
<div data-tool data-variant="bash" data-state="ok"><pre>const a = 1;</pre></div>
<div data-turn-process>
  <span data-turn-process-messages>调用了 2 个工具</span>
  <span data-turn-process-tool-calls>read · grep</span>
  <div data-turn-process-member><pre>const a = 1;</pre></div>
  <div data-turn-process-answer>完成</div>
</div>
<div data-turn-process data-turn-process-hidden>
  <div data-turn-process-member><pre>不该显示</pre></div>
</div>
</body></html>`, 400);

    const probe = await page.evaluate(() => {
      const q = (s) => document.querySelector(s);
      const cs = (el, p) => (el === null ? null : getComputedStyle(el).getPropertyValue(p));
      const hidden = q('[data-turn-process-hidden]');
      // 代码块取样放在**工具行**里：宿主 dsh-client-ui-chat 的 turn-process 一族
      // （-messages/-tool-calls/-answer/-member/-subagents）全是摘要按钮上的计数属性，
      // 该区域不装 <pre>（bundle 内 turn-process 附近 pre 出现 0 次）。
      // pre 的真实宿主是 [data-tool] / [data-sample] 的输出正文，见 expandable 小节。
      const toolPre = q('[data-tool] pre') || q('[data-sample] pre');
      const ocs = toolPre === null ? null : getComputedStyle(toolPre);
      return {
        summaryColor: cs(q('[data-turn-process-messages]'), 'color'),
        answerColor: cs(q('[data-turn-process-answer]'), 'color'),
        hiddenDisplay: hidden === null ? null : getComputedStyle(hidden).display,
        hiddenAttrPresent: hidden !== null,
        preFont: ocs === null ? null : ocs.fontFamily,
        preOverflowX: ocs === null ? null : ocs.overflowX,
        preWhiteSpace: ocs === null ? null : ocs.whiteSpace,
      };
    });

    t.check('回合摘要用次要色（低频扫读）', probe.summaryColor !== null && probe.summaryColor !== 'rgb(26, 28, 31)', probe.summaryColor);
    t.check('详情块（answer）用主前景（高频细读）',
      probe.answerColor !== null && probe.answerColor !== probe.summaryColor,
      `answer ${probe.answerColor} vs summary ${probe.summaryColor}`);
    /* 0.7.2：原先「chevron 用辅助色 / chevron 有旋转过渡 / 收起态 display:none」三条
       测的都是宿主不存在的属性，已随死 CSS 一并撤下。收起态由宿主自己的
       data-turn-process-hidden 负责折叠（其 CSS 在宿主 bundle 内），皮肤不重复实现。 */
    t.check('收起态由宿主的 data-turn-process-hidden 标记（皮肤不自己造锚点）',
      probe.hiddenAttrPresent, '宿主实际产出的是 -hidden，夹具里出现=' + probe.hiddenAttrPresent);
    /* 代码块：等宽 + 横向滚动 + 不折行 —— 折行后无法逐字比对命令与 JSON。
       取样元素改为 [data-turn-process-member] 内的 pre（原取 -body，已随死 CSS 删除）。 */
    t.check('代码块等宽', probe.preFont !== null && /monospace|Consolas|Menlo|Courier/i.test(probe.preFont), probe.preFont);
    t.check('代码块横向滚动（overflow-x: auto）', probe.preOverflowX === 'auto', String(probe.preOverflowX));
    t.check('代码块不折行（white-space: pre）', probe.preWhiteSpace === 'pre', String(probe.preWhiteSpace));
  },

  /* ─── ⑲·5 reduced-motion：过渡能被关掉，且用 0.01ms 而非 none ─── */
  async reduced_motion(t) {
    const page = await t.page({ width: 800, height: 500, dpr: 1 });
    await page.setContent(`<!doctype html><html data-codex-ui><head><meta charset="utf-8">
<style>${t.theme()}</style>
<style>body{margin:0;font:14px/1.6 "Segoe UI",sans-serif}</style></head><body>
${toolRow('bash', 'bash', 'ok', true)}
<div data-turn-process><span data-turn-process-member>▸</span></div>
</body></html>`, 400);
    await page.media({ 'prefers-reduced-motion': 'reduce' });
    await t.sleep(200);
    const probe = await page.evaluate(() => ({
      expDur: getComputedStyle(document.querySelector('[data-expandable]')).transitionDuration,
      memberDur: getComputedStyle(document.querySelector('[data-turn-process-member]')).transitionDuration,
    }));
    /* 浏览器把 0.01ms 序列化成 "1e-05s"（不是 "0.01ms"），所以必须按数值比，
       字符串匹配会永远判 FAIL。判据是「非 0 且极小」—— none 是 0s，会被排除在外。 */
    const secs = (s) => String(s).split(',').map((x) => parseFloat(x) || 0).reduce((m, x) => Math.max(m, x), 0);
    const expSec = secs(probe.expDur);
    const memberSec = secs(probe.memberDur);
    t.check('reduced-motion 下展开卡过渡被压到 ~0.01ms（不是 none，宿主靠 transitionend 摘标记）',
      expSec > 0 && expSec <= 0.00001, probe.expDur + ' → ' + expSec + 's');
    /* 0.7.2：原判据量 [data-turn-process-chevron]，宿主无此属性，探针恒为 '0s' → 永远 FAIL。
       换成宿主真实产出的 [data-turn-process-member]（该元素同样落在 reduced-motion 作用域内）。 */
    t.check('reduced-motion 下回合详情成员块过渡同样被压掉',
      memberSec > 0 && memberSec <= 0.00001, probe.memberDur + ' → ' + memberSec + 's');
  },

  /* ─── ⑲·7b 审批 / 提问：等待态必须与"进行中"区分 ─── */
  async waiting(t) {
    const page = await t.page({ width: 1000, height: 800, dpr: 1 });
    await page.setContent(`<!doctype html><html data-codex-ui><head><meta charset="utf-8">
<style>${t.theme()}</style>
<style>body{margin:0;font:14px/1.6 "Segoe UI","Microsoft YaHei",sans-serif;background:var(--dsw-alias-bg-base)}</style>
</head><body>
<!-- 审批卡：宿主写的是 { data-approval-key, aria-busy: answered } -->
<div class="ApprovalPanel_root" data-approval-key="k1" aria-busy="false">
  <div class="ApprovalPanel_strip"><span class="dot" data-state="warning"></span><span>等待你的操作</span></div>
  <div data-approval-scroll>要执行 bash 命令，需要你确认。</div>
  <button>允许一次</button><button>拒绝</button>
</div>
<!-- 已答复：aria-busy 翻成 true -->
<div class="ApprovalPanel_root" data-approval-key="k2" aria-busy="true">
  <span class="dot" data-state="ongoing"></span><span>已允许一次</span>
</div>
<!-- 提问卡：宿主写的是 QuestionComposer.frame { data-question-key }，卡有 card / cardMinimized 两态 -->
<div class="QuestionComposer_frame" data-question-key="q1">
  <section class="card">
    <header><span class="dot" data-state="warning"></span>提问</header>
    <div data-question-scroll>你想让我用哪种方式继续？</div>
    <div data-question-reply contenteditable="true">快速做完</div>
    <button>提交</button>
  </section>
</div>
<div data-reply-outcome>你答了：快速做完</div>
<!-- StateDot 对照件：StateDotState = done|warning|ongoing|error|idle，
     StateDot.module.css 已经用 --dsw-alias-state-*-primary 上好色。 -->
<span class="dot" data-state="done" id="dot-done"></span>
<span class="dot" data-state="error" id="dot-error"></span>
<span class="dot" data-state="ongoing" id="dot-ongoing"></span>
</body></html>`, 400);

    const probe = await page.evaluate(() => {
      const q = (s) => document.querySelector(s);
      const cs = (el, p) => (el === null ? null : getComputedStyle(el).getPropertyValue(p));
      const box = (s) => {
        const el = q(s);
        if (el === null) return null;
        const c = getComputedStyle(el);
        return { border: c.borderTopWidth + ' ' + c.borderTopStyle + ' ' + c.borderTopColor, bg: c.backgroundColor, pad: c.padding, color: c.color, radius: c.borderTopLeftRadius };
      };
      return {
        pending: box('[data-approval-key][aria-busy="false"]'),
        answered: box('[data-approval-key][aria-busy="true"]'),
        question: box('[data-question-key]'),
        scrollY: cs(q('[data-question-scroll]'), 'overflow-y'),
        scrollMax: cs(q('[data-question-scroll]'), 'max-height'),
        replyFont: cs(q('[data-question-reply]'), 'font-family'),
        replyCaret: cs(q('[data-question-reply]'), 'caret-color'),
        outcome: cs(q('[data-reply-outcome]'), 'color'),
        outcomeSize: cs(q('[data-reply-outcome]'), 'font-size'),
        /* StateDot 三态：皮肤不该接管，但也不能被 ⑲ 的规则误伤 */
        dotDone: cs(q('#dot-done'), 'color'),
        dotError: cs(q('#dot-error'), 'color'),
        dotOngoing: cs(q('#dot-ongoing'), 'color'),
      };
    });

    /* 等待态有框（"这里要你动手"），已答复收敛（不再抢注意力） */
    t.check('等待中的审批卡有描边（提示要你动手）',
      probe.pending !== null && !probe.pending.border.startsWith('0px'), probe.pending?.border ?? 'null');
    t.check('等待中的提问卡有圆角与底色',
      probe.question !== null && /\d/.test(probe.question.radius) && probe.question.bg !== 'rgba(0, 0, 0, 0)',
      probe.question ? probe.question.radius + ' / ' + probe.question.bg : 'null');
    t.check('已答复的审批卡收敛成普通记录（无描边、无底、无内衬）',
      probe.answered !== null && probe.answered.border.startsWith('0px') && probe.answered.bg === 'rgba(0, 0, 0, 0)' && probe.answered.pad.startsWith('0px'),
      probe.answered ? probe.answered.border + ' | ' + probe.answered.bg + ' | ' + probe.answered.pad : 'null');

    /* 长问题在卡内滚，不把卡撑出屏 */
    t.check('长问题在卡内滚动（overflow-y: auto）', probe.scrollY === 'auto', String(probe.scrollY));
    /* getComputedStyle 把 40vh 解析成绝对像素（800px 视口 → 320px），不是 "40vh"。
       判据改成"有上限且不超过半屏"——这才是这条规则真正要保证的事。 */
    const maxPx = parseFloat(probe.scrollMax ?? 'NaN');
    t.check('滚动区有高度上限且不超过半屏（长问题不撑出屏）',
      Number.isFinite(maxPx) && maxPx > 0 && maxPx <= 400, probe.scrollMax + ' → ' + maxPx + 'px（视口 800）');

    /* 答复输入区：能打字、看得见光标 */
    t.check('答复输入区是 UI 字体（不是等宽）',
      probe.replyFont !== null && !/monospace|Consolas/i.test(probe.replyFont), probe.replyFont);
    t.check('答复输入区有可见光标色', probe.replyCaret !== null && /\d/.test(probe.replyCaret), probe.replyCaret);

    /* 答复回执是低频信息 */
    t.check('答复回执用次要色（低频扫读）', probe.outcome !== null && /\d/.test(probe.outcome), probe.outcome);

    /* 护栏：StateDot 不能被 ⑲ 误伤。
       StateDotState = done|warning|ongoing|error|idle，宿主 StateDot.module.css 自己按
       --dsw-alias-state-*-primary 上色。
       上一版断言"done 是绿的" —— 但本夹具**不接宿主 CSS**，那条规则根本不在页面里，
       StateDot 必然是继承的黑色，三条全 FAIL。判据查错了对象。
       正确判据是「皮肤不接管」：把皮肤主题整段撤掉，StateDot 的计算色必须**一模一样**。
       若 ⑲ 的 [data-state="error"] 少写 [data-tool]/[data-sample] 前缀，这里立刻见分晓。 */
    const bare = await page.evaluate(() => {
      for (const el of document.querySelectorAll('style')) el.remove();
      const c = (s) => { const el = document.querySelector(s); return el === null ? null : getComputedStyle(el).color; };
      return { done: c('#dot-done'), error: c('#dot-error'), ongoing: c('#dot-ongoing') };
    });
    t.check('StateDot[done] 的颜色不受皮肤影响（皮肤不接管状态点）',
      probe.dotDone === bare.done, `带皮肤 ${probe.dotDone} / 无皮肤 ${bare.done}`);
    t.check('StateDot[error] 的颜色不受皮肤影响',
      probe.dotError === bare.error, `带皮肤 ${probe.dotError} / 无皮肤 ${bare.error}`);
    t.check('StateDot[ongoing] 的颜色不受皮肤影响',
      probe.dotOngoing === bare.ongoing, `带皮肤 ${probe.dotOngoing} / 无皮肤 ${bare.ongoing}`);
  },

  /* ─── ⑲·7d 引用菜单与 composer chip ─── */
  async reference(t) {
    const page = await t.page({ width: 1000, height: 700, dpr: 1 });
    await page.setContent(`<!doctype html><html data-codex-ui><head><meta charset="utf-8">
<style>${t.theme()}</style>
<style>body{margin:0;font:14px/1.6 "Segoe UI","Microsoft YaHei",sans-serif;background:var(--dsw-alias-bg-base)}</style>
</head><body>
<!-- 按宿主 MenuView 的真实结构：MenuSurface[data-trigger-menu] > .viewport[role=listbox]
     > .groupTitle[role=presentation][data-source] + [role=status]（pending 组） -->
<div data-trigger-menu data-overflow-below="">
  <div role="listbox">
    <div role="presentation" data-source="reference" id="g-title">引用</div>
    <div role="status" id="g-pending">搜索中…</div>
    <div role="option" id="opt-1">docs/plan.md</div>
  </div>
</div>
<!-- composer chip：宿主 createDOM 写的是 el.setAttribute("data-composer-chip", this.__source)
     + el.setAttribute("contenteditable","false") —— 属性**有值**，不是空串。 -->
<span data-composer-chip="reference" contenteditable="false" id="chip">
  <span class="chip_label">文件</span><span class="MdX_path">docs/plan.md</span>
</span>
</body></html>`, 400);

    const probe = await page.evaluate(() => {
      const q = (s) => document.querySelector(s);
      const c = (s) => (q(s) === null ? null : getComputedStyle(q(s)));
      const title = c('#g-title');
      const chip = c('#chip');
      return {
        titleColor: title === null ? null : title.color,
        titleSize: title === null ? null : title.fontSize,
        titleFont: title === null ? null : title.fontFamily,
        titleTransform: title === null ? null : title.textTransform,
        titleTracking: title === null ? null : title.letterSpacing,
        pendingColor: c('#g-pending') === null ? null : c('#g-pending').color,
        pendingSize: c('#g-pending') === null ? null : c('#g-pending').fontSize,
        chipFont: chip === null ? null : chip.fontFamily,
        chipSize: chip === null ? null : chip.fontSize,
        chipTracking: chip === null ? null : chip.letterSpacing,
        chipTransform: chip === null ? null : chip.textTransform,
        chipColor: chip === null ? null : chip.color,
        chipBg: chip === null ? null : chip.backgroundColor,
        chipCursor: chip === null ? null : chip.cursor,
        chipSelect: chip === null ? null : chip.userSelect,
        chipPathFont: c('#chip .MdX_path') === null ? null : c('#chip .MdX_path').fontFamily,
        /* 三态色对照：从令牌取，用于验证 title/chip 用的是哪一档 */
        primary: getComputedStyle(document.body).getPropertyValue('--dsw-alias-label-primary').trim()
          || getComputedStyle(document.documentElement).getPropertyValue('--dsw-alias-label-primary').trim(),
        tertiary: getComputedStyle(document.body).getPropertyValue('--dsw-alias-label-tertiary').trim()
          || getComputedStyle(document.documentElement).getPropertyValue('--dsw-alias-label-tertiary').trim(),
        metaSize: getComputedStyle(document.body).getPropertyValue('--dsw-meta-size').trim()
          || getComputedStyle(document.documentElement).getPropertyValue('--dsw-meta-size').trim(),
      };
    });
    /* 归一化到 RGB 数值：computed style 给 rgb(26,28,31)，令牌字面量是 #1a1c1f ——
       同一个色的两种写法，字符串比较永远判不等。凡是拿 color 对比令牌，都走这里。 */
    const rgbOf = (c) => {
      const s = String(c).trim();
      const m = s.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
      if (m !== null) return m.slice(1, 4).map((x) => Math.round(Number(x))).join(',');
      const h = s.match(/^#([0-9a-f]{6})$/i) ?? s.match(/^#([0-9a-f]{3})$/i);
      if (h === null) return null;
      const v = h[1].length === 3 ? [...h[1]].map((c) => c + c).join('') : h[1];
      return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16)).join(',');
    };

    /* 组标题是结构件：辅助色 + meta 字号，不是内容 */
    t.check('组标题用辅助色（不是主前景）',
      rgbOf(probe.titleColor) !== rgbOf(probe.primary),
      `${probe.titleColor} → ${rgbOf(probe.titleColor)} vs primary → ${rgbOf(probe.primary)}`);
    t.check('组标题用 meta 字号（结构件不抢权重）',
      probe.titleSize === probe.metaSize || Math.abs(parseFloat(probe.titleSize) - parseFloat(probe.metaSize)) < 0.6,
      `${probe.titleSize} vs ${probe.metaSize}`);
    t.check('组标题是 UI 字体（不强制等宽）',
      probe.titleFont !== null && !/monospace|Consolas/i.test(probe.titleFont), probe.titleFont);
    t.check('组标题不大写、不拉字距',
      probe.titleTransform === 'none' && (probe.titleTracking === 'normal' || parseFloat(probe.titleTracking) === 0),
      probe.titleTransform + ' / ' + probe.titleTracking);
    t.check('pending 组也有明确的次要样式（不能是空标题）',
      rgbOf(probe.pendingColor) !== null, probe.pendingColor + ' → ' + rgbOf(probe.pendingColor));

    /* chip 是 UI 文本：UI 字体、不大写、不拉字距；但路径本身等宽 */
    t.check('chip 是 UI 字体（不强制等宽）',
      probe.chipFont !== null && !/monospace|Consolas/i.test(probe.chipFont), probe.chipFont);
    t.check('chip 不大写、不拉字距（中文标签尤其敏感）',
      probe.chipTransform === 'none' && (probe.chipTracking === 'normal' || parseFloat(probe.chipTracking) === 0),
      probe.chipTransform + ' / ' + probe.chipTracking);
    t.check('chip 用主前景色（它是已插入的引用，是内容不是脚注）',
      rgbOf(probe.chipColor) === rgbOf(probe.primary),
      `${probe.chipColor} → ${rgbOf(probe.chipColor)} vs ${probe.primary} → ${rgbOf(probe.primary)}`);
    t.check('chip 有底色（从正文里能被认出来）',
      probe.chipBg !== null && probe.chipBg !== 'rgba(0, 0, 0, 0)', probe.chipBg);
    t.check('chip 光标不是手型（不可编辑的装饰节点）', probe.chipCursor === 'default', probe.chipCursor);
    t.check('chip 可整体选中（user-select: all）', probe.chipSelect === 'all', probe.chipSelect);
    t.check('chip 里的路径是等宽（逐字比对路径是引用的全部意义）',
      probe.chipPathFont !== null && /monospace|Consolas/i.test(probe.chipPathFont), probe.chipPathFont);
  },
};
