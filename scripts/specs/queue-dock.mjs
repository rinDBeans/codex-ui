import fs from 'node:fs';
import { join } from 'node:path';
import { cssFor, mapFor, themeLayers } from '../lib/host.mjs';
import { SKIN_DIR, SKIN_PARTS, scopeCss, stripComments } from '../build.mjs';

/**
 * 后续消息队列（QueueDock）并入 Codex 化输入卡 —— T10 补做。
 *
 * 宿主已实现全部能力，本 spec 只验**皮肤有没有把外观接管**：队列面板紧贴输入卡上沿叠放，
 * 顶部圆角必须与卡片同心；面板吃的是宿主菜单的 backdrop-filter 令牌，T08 已在
 * [data-menu-material] 上压成 none，但队列不在那个锚点下，会漏过来。
 *
 * 纪律：类名后缀运行时从真实 mapFor 取，缺键直接抛错；面板锚点只用 data-queue-dock。
 */
const SRC = '@deepseek-ai/dsh-client-ui-conversation/lib/client.js';
const MOD = '@deepseek-ai/dsh-client-ui-conversation/QueueDock.module.css';
const NEED_Q = ['dock', 'panel', 'header', 'count', 'list', 'row', 'preview'];

function needKeys(map, keys, name) {
  const missing = keys.filter((k) => map[k] === undefined);
  if (missing.length > 0) throw new Error(name + ' 缺类名（宿主映射已变）：' + missing.join(', '));
  return map;
}

function dockHost(host) {
  const src = host.file(SRC);
  const Q = needKeys(mapFor(src, 'QueueDock_module_css_default'), NEED_Q, 'QueueDock');
  return {
    css: '<style>' + themeLayers(host) + '</style><style>' + cssFor(src, MOD) + '</style>',
    Q,
  };
}

function skinTheme() {
  return SKIN_PARTS.map((f) => scopeCss(stripComments(fs.readFileSync(join(SKIN_DIR, f), 'utf8')))).join('\n');
}

function buildPage(css, Q, theme, withSkin) {
  const head = '<meta charset="utf-8"><style>body{margin:0;background:linear-gradient(90deg,#f00 0%,#00f 100%)}</style>' + css;
  const skin = withSkin ? '<style>' + theme + '</style>' : '';
  const scope = withSkin ? ' data-codex-ui' : '';
  /* 输入卡必须挂在 [data-conversation-scroll] 下：composer.css 的圆角规则作用域是
     [data-conversation-scroll] [data-composer-card]，裸露的 div 量不到圆角。 */
  const body = '<div data-conversation-scroll><div data-composer-card>input card</div></div>'
    + '<div class="' + Q.dock + '" data-queue-dock="">'
    + '<div class="' + Q.panel + '">'
    + '<button class="' + Q.header + '"><span class="' + Q.count + '">2 queued</span></button>'
    + '<ul class="' + Q.list + '"><li class="' + Q.row + '">'
    + '<span class="' + Q.preview + '">follow-up</span></li></ul>'
    + '</div></div>';
  return '<!doctype html><html' + scope + ' data-platform="win32"><head>' + head + skin + '</head><body>' + body + '</body></html>';
}

function probePanel() {
  const panel = document.querySelector('[data-queue-dock] > div');
  if (panel === null) return null;
  const be = getComputedStyle(panel, ':before');
  const af = getComputedStyle(panel, ':after');
  const p = getComputedStyle(panel);
  return {
    backdrop: be.backdropFilter,
    bg: be.backgroundColor,
    radiusTop: p.borderTopLeftRadius,
    radiusBottom: p.borderBottomLeftRadius,
    stroke: af.borderTopColor,
  };
}

async function dock(t) {
  const { css, Q } = dockHost(t.host);
  const theme = skinTheme();
  const page = await t.page({ width: 900, height: 600, dpr: 1 });
  await page.setContent(buildPage(css, Q, theme, false), 400);
  const hostOnly = await page.evaluate(probePanel);
  await page.setContent(buildPage(css, Q, theme, true), 400);
  const skinned = await page.evaluate(probePanel);
  t.log('无皮肤 ' + JSON.stringify(hostOnly));
  t.log('有皮肤 ' + JSON.stringify(skinned));
  if (skinned === null || hostOnly === null) { t.check('夹具就绪：面板可定位', false, 'null'); return; }

  /* 面板不吃 40px 背景模糊：判据是「有皮肤时为 none」，不是「与宿主不同」——
     后者会被令牌继承蒙混过去（实测宿主与皮肤原本都是 blur(40px) saturate(1.5)）。 */
  t.check('队列面板不吃宿主 40px 背景模糊（T08 同款处置）',
    skinned.backdrop === 'none',
    ':before backdrop=' + skinned.backdrop + '（宿主默认 ' + hostOnly.backdrop + '）');

  /* 顶部圆角必须与**输入卡实测值**同心，下沿贴卡片保持 0。
     判据不能写死 20px：皮肤在 @supports (corner-shape: superellipse(1.5)) 下把
     --dsw-radius-card 升到 25px（skin.css:388-392），写死会在支持的浏览器上假失败。
     所以先量卡片，再断言两者相等。 */
  const cardProbe = await page.evaluate(() => {
    const card = document.querySelector('[data-composer-card]');
    return card === null ? null : getComputedStyle(card).borderTopLeftRadius;
  });
  t.log('输入卡 radius = ' + cardProbe);
  t.check('队列面板顶部圆角与输入卡同心（量卡片，不写死数值）',
    cardProbe !== null && skinned.radiusTop === cardProbe,
    '队列 ' + skinned.radiusTop + ' vs 输入卡 ' + cardProbe);
  t.check('队列面板下沿不圆角（贴住输入卡）',
    parseFloat(skinned.radiusBottom) === 0,
    'radiusBottom=' + skinned.radiusBottom);

  /* 皮肤必须真的接管了底色，否则上面两条可能只是宿主碰巧如此。 */
  t.check('皮肤接管了队列底色（与宿主不同）',
    skinned.bg !== hostOnly.bg,
    'skin ' + skinned.bg + ' vs host ' + hostOnly.bg);

  await t.shot(page, 'queue-dock-verify.png', { x: 0, y: 0, width: 640, height: 300, scale: 2 });
}

export default { dock };
