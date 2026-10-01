/**
 * 主题切换的两件事：
 *   1. 切换的那两帧打 SWITCH_ATTR，皮肤据此关掉全部过渡（整页交叉淡出看起来就是闪）；
 *   2. 本地预览：设置卡点下去到宿主发布新主题要等一次设置文档往返（实测 ~0.8s）。先按目标主题
 *      写宿主本来就会写的两处（body[data-ds-dark-theme]、html 的 color-scheme），宿主带着同一结果
 *      回来时幂等交还；2.5s 没等到就按宿主真值回滚 —— 预览从不当成结果。
 */
import { PREVIEW_ATTR, SWITCH_ATTR } from './constants.js';

const PREVIEW_TIMEOUT_MS = 2500;

/**
 * @param ctx - 客户端上下文（需要 theme 服务）。
 * @returns previewTheme(target)：target 为 'light' | 'dark' | 'system'。
 */
export function installThemePreview(ctx) {
  const root = document.documentElement;
  let preview = null;
  let timer = 0;

  const suppressTransitions = () => {
    root.setAttribute(SWITCH_ATTR, '');
    requestAnimationFrame(() => requestAnimationFrame(() => root.removeAttribute(SWITCH_ATTR)));
  };
  const applyScheme = (scheme) => {
    document.body.toggleAttribute('data-ds-dark-theme', scheme === 'dark');
    root.style.colorScheme = scheme;
  };
  /** 偏好 → 实际那一套（system 跟随系统，与宿主同一套解析）。 */
  const schemeOf = (target) => (target === 'dark' || target === 'light' ? target
    : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  /** 宿主主题服务当前解析出的那一套。 */
  const activeScheme = () => {
    const scheme = ctx.theme.getTheme()?.active?.colorScheme;
    return scheme === 'dark' || scheme === 'light' ? scheme : null;
  };
  /** @param confirmed - true：宿主已发布同一结果；false：超时或卸载，按宿主真值回滚。 */
  const endPreview = (confirmed) => {
    if (preview === null) return;
    clearTimeout(timer);
    timer = 0;
    const { onSettle } = preview;
    preview = null;
    root.removeAttribute(PREVIEW_ATTR);
    if (confirmed) {
      try { if (onSettle !== null) onSettle(true); } catch { /* 回调不许连累流程 */ }
      return;
    }
    try {
      const active = activeScheme();
      if (active !== null) applyScheme(active);
    } catch { /* 读不到服务就保持现状 */ }
    try { if (onSettle !== null) onSettle(false); } catch { /* 回调不许连累回滚 */ }
  };

  ctx.effect(() => ctx.on('theme/change', (snapshot) => {
    suppressTransitions();
    if (preview !== null && snapshot?.active?.colorScheme === preview.scheme) endPreview(true);
  }), 'codex-ui: theme change');
  ctx.effect(() => () => endPreview(false), 'codex-ui: theme preview cleanup');

  /**
   * @param target - 'light' | 'dark' | 'system'。
   * @param onSettle - 预览结束时的回调：true = 宿主发布了同一结果；false = 超时/卸载按真值回滚。
   *   分段控件靠它清 pending —— 没有这个回调，超时后页面回亮色、控件还停在深色（已复现的脱节）。
   */
  return (target, onSettle) => {
    if (target !== 'light' && target !== 'dark' && target !== 'system') return;
    const scheme = schemeOf(target);
    preview = { scheme, onSettle: typeof onSettle === 'function' ? onSettle : null };
    root.setAttribute(PREVIEW_ATTR, scheme);
    suppressTransitions();
    applyScheme(scheme);
    clearTimeout(timer);
    timer = setTimeout(() => endPreview(false), PREVIEW_TIMEOUT_MS);
  };
}
