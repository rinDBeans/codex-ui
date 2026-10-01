#!/usr/bin/env node
/**
 * live/freeze.mjs — T05 保留组件的**真实 GUI 基线**：模型选择器弹层 + 推理强度胶囊。
 *
 *   node scripts/live/freeze.mjs --url "http://127.0.0.1:3189/?token=…" [--shots <目录>]
 *
 * 干什么：把方案 §8 的 T05「冻结当前形态」落成**可复核的截图 + 数值**。
 * 模型选择器与推理强度胶囊是用户明确要求保留的两个控件；本脚本只读、只拍，不改任何行为。
 * 数值全部来自 computed style 与 getBoundingClientRect，不写死常量。
 *
 * 为什么不在 verify 夹具里做：夹具是"按宿主渲染代码复刻的 DOM"，几何能被复刻，但**真实组合**里
 * 还有主题插件（dsh-ivory）用 !important 接管外壳、还有设置卡的覆盖层写入。
 * 保留组件在真实组合下是否仍是自己画的那个，只能在真 GUI 上量。
 */
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dismissOnboarding, launch, login, openHome, sleep } from '../lib/cdp.mjs';
import { checklist, summarize } from '../lib/checks.mjs';

const arg = (name, fallback) => {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const TOKEN_URL = arg('url', '');
const SHOTS = arg('shots', join(tmpdir(), 'codex-ui-shots'));
if (TOKEN_URL === '') {
  console.error('缺少 --url "http://127.0.0.1:<port>/?token=…"');
  process.exit(2);
}
fs.mkdirSync(SHOTS, { recursive: true });

/** 两个保留控件的几何 + 样式全量快照。 */
const probe = () => {
  const box = (el) => {
    if (el === null) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
      radius: cs.borderTopLeftRadius, bg: cs.backgroundColor, border: cs.borderTopWidth + ' ' + cs.borderTopColor,
      font: cs.fontFamily.split(',')[0], size: cs.fontSize, pad: cs.padding, shadow: cs.boxShadow.slice(0, 80),
    };
  };
  /* 自建组件：模型选择器触发器是 .codex-mp-trigger；推理强度胶囊是 .codex-mp-power* 系列 */
  const trigger = document.querySelector('.codex-mp-trigger');
  const slot = document.querySelector('[data-slot="conversation.input.model"]');
  const pop = document.querySelector('.codex-mp-pop, [class*="codex-mp"][class*="pop"]');
  const power = document.querySelector('[class*="codex-mp-power"]');
  const hostHidden = slot === null ? null
    : [...slot.children].filter((c) => !c.classList.contains('codex-mp-trigger'))
      .every((c) => getComputedStyle(c).display === 'none');
  return {
    theme: document.body.className || '(none)',
    dark: document.body.hasAttribute('data-ds-dark-theme'),
    trigger: box(trigger),
    power: box(power ?? trigger?.querySelector('[class*="power"]') ?? null),
    pop: box(pop),
    hostHidden,
    /* 轨道几何：滑轨热区与滑块尺寸（check.mjs 的冻结断言对的就是这两个数） */
    rail: (() => {
      const el = document.querySelector('.codex-mp-power, [class*="power"][class*="rail"]');
      if (el === null) return null;
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    })(),
  };
};

const { results, check } = checklist();
const browser = await launch();
try {
  const page = await browser.newPage({ width: 1440, height: 900, dpr: 2 });
  await login(page, TOKEN_URL);
  await openHome(page, new URL(TOKEN_URL).origin);
  await dismissOnboarding(page);
  await sleep(2500);

  const closed = await page.evaluate(probe);
  console.log('CLOSED ' + JSON.stringify(closed, null, 1));
  check('模型选择器触发器在真实 GUI 上存在', closed.trigger !== null, JSON.stringify(closed.trigger));
  if (closed.trigger === null) throw new Error('触发器不在 —— 该 profile 可能关掉了自建模型选择器（设置卡开关）');
  check('宿主那一格被隐藏（A 面已顶替）', closed.hostHidden === true, String(closed.hostHidden));

  /* 记录主题插件接管情况 —— 保留组件的"未变"结论必须连同环境一起记，否则分不清是谁变的。 */
  console.log('THEME ' + closed.theme);

  /* 亮色基线截图 */
  if (!closed.dark) await page.screenshot({ path: join(SHOTS, 't05-freeze-light.png') });

  /* 展开弹层：点触发器 → 量弹层 → 截图 → Esc 收 */
  const trig = await page.center('.codex-mp-trigger');
  if (trig !== null) {
    await page.click(trig[0], trig[1]);
    await sleep(600);
    const open = await page.evaluate(probe);
    console.log('OPEN ' + JSON.stringify({ pop: open.pop, rail: open.rail }, null, 1));
    check('弹层打开后有几何', open.pop !== null, JSON.stringify(open.pop));
    if (open.pop !== null) {
      /* 冻结基线的关键数字：从实测里取，不预设。 */
      check('弹层宽 254px（check 冻结基线）', open.pop.w === 254, open.pop.w + 'px');
      check('弹层圆角是自有 token（18px 档）', /18|19|20/.test(open.pop.radius), open.pop.radius);
    }
    await page.screenshot({ path: join(SHOTS, 't05-freeze-popup.png') });
    await page.key('Escape', 27);
    await sleep(500);
  }

  /* 暗色基线 */
  await page.evaluate(() => document.body.setAttribute('data-ds-dark-theme', ''));
  await sleep(700);
  const dark = await page.evaluate(probe);
  check('暗色下触发器仍在且高度不变（保留组件不随主题变形）',
    dark.trigger !== null && dark.trigger.h === closed.trigger.h, (dark.trigger?.h) + ' vs ' + closed.trigger.h);
  await page.screenshot({ path: join(SHOTS, 't05-freeze-dark.png') });

  fs.writeFileSync(join(SHOTS, 't05-freeze.json'), JSON.stringify({ closed, dark, shot_dir: SHOTS }, null, 2), 'utf8');
  console.log('基线已写 ' + join(SHOTS, 't05-freeze.json'));
} catch (e) {
  check('freeze live 运行出错', false, e.stack ?? e.message);
} finally {
  await browser.close();
}
summarize(results);
