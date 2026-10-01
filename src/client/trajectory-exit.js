/**
 * 「轨迹」视图的退出出口。
 *
 * 背景（现场实测）：皮肤 ⑬ 按参考图把会话视图页签条整条隐去
 * （`[data-slot="conversation.session.header"] > [data-conversation-tabs] { display: none }`），
 * 而「轨迹」正是那条页签条里的一格。入口没被删 —— 工具卡展开后的 Inspect 走
 * `openView('trajectory', callId)` —— 出口却只剩页签条，于是进了轨迹就出不来。
 *
 * 本模块不动页签条本身，只在**轨迹视图显示时**浮一个「← 对话」；点击就是**点那一格页签本身**
 * —— 与用户手点走同一条 `selectView` 回调，不绕宿主内部 API、也不去猜宿主的状态。
 *
 * **页签条的隐去（⑬）由本模块门控**（T06 / UX-08）：只有在「能可靠找回对话页签」时才盖
 * `body[data-codex-ui-te-ready]`，patches.css 的隐去规则挂在它下面。认不出就**不盖**，
 * 页签保持可见 —— 宁可多一条页签，也不能让用户进了轨迹出不来。
 *
 * 三处宿主依赖，任一不符就整体不挂（只 warn，不抛、不连累皮肤）：
 *   · 页签条 `[data-conversation-tabs] [role="tab"]`（ui-conversation 渲染，皮肤只负责隐藏）
 *   · 轨迹视图的标记 `[data-trajectory-scroll] / [data-trajectory-row-key] / [data-timeline-record-index]`
 *   · 对话视图的标记 `[data-chat-flow] / [data-chat-node-key] / [data-chat-anchor-key]`
 *
 * 「对话是哪一格」两级认法：先**标定** —— 视图区在渲染对话时，`aria-selected` 的那一格就是它，
 * 与界面语言、页签注册顺序都无关（页面一进来就停在对话，正常一次就标定到）；标定不到再退回页签
 * 文字 `Chat` / `对话`。两者都没有就不出按钮 —— 宁可不出，也不点错格。
 *
 * 几何锚点取 `[data-slot="conversation.view"]` 的**父元素**：那个 slot 容器是 `display: contents`，
 * 自己的 rect 恒为 0。
 */
import { PLUGIN_ID, TE_READY_ATTR } from './constants.js';

/** 宿主页签条：皮肤只把它 display:none，节点与 React 回调都还在。 */
const TABLIST = '[data-conversation-tabs]';
/** 当前视图的容器（display: contents，只当查询根用）。 */
const VIEW = '[data-slot="conversation.view"]';
/** 轨迹视图的标记：ui-trajectory 自己的 scrollport / 虚拟行 / 时间轴。 */
const TRAJECTORY_MARK = '[data-trajectory-scroll], [data-trajectory-row-key], [data-timeline-record-index]';
/** 对话视图的标记：ui-chat 自己的节点流。用来把「对话是哪一格页签」认出来。 */
const CHAT_MARK = '[data-chat-flow], [data-chat-node-key], [data-chat-anchor-key]';
/** 标定失败时的兜底：页签文字。只认两种官方语言，认不出就不出按钮。 */
const CHAT_LABEL = /^(chat|对话)$/i;
/** 浮出按钮的 class（样式在 skins/codex-ink/trajectory-exit.css）。 */
const BUTTON_CLASS = 'codex-te-exit';

/**
 * @param ctx - 客户端上下文。
 */
export function installTrajectoryExit(ctx) {
  const doc = globalThis.document;
  if (doc === undefined) return;

  const tabs = () => [...doc.querySelectorAll(TABLIST + ' [role="tab"]')];
  const viewRoot = () => doc.querySelector(VIEW);
  const selectedTab = () => tabs().find((tab) => tab.getAttribute('aria-selected') === 'true') ?? null;

  /** 标定到的对话页签；节点被 React 换掉（isConnected 为假）就作废重标。 */
  let calibrated = null;
  let button = null;
  let frame = 0;
  let watched = null;
  let resize = null;

  /** 该点哪一格才回得去。 */
  const chatTab = () => {
    if (calibrated !== null && calibrated.isConnected) return calibrated;
    return tabs().find((tab) => CHAT_LABEL.test(tab.textContent.trim())) ?? null;
  };

  const drop = () => {
    button?.remove();
    button = null;
  };

  const schedule = () => { if (frame === 0) frame = requestAnimationFrame(sync); };

  /** 出口就绪标记：CSS 的页签隐去规则挂在它下面。 */
  const setReady = (on) => {
    const body = doc.body;
    if (body === null) return;
    if (on) body.setAttribute(TE_READY_ATTR, '');
    else body.removeAttribute(TE_READY_ATTR);
  };

  const sync = () => {
    frame = 0;
    const root = viewRoot();
    if (root === null) { setReady(false); drop(); return; }
    /* 标定：视图区正在渲染对话时，被选中的那一格就是对话页签。 */
    if (root.querySelector(CHAT_MARK) !== null) calibrated = selectedTab();
    /* 「能不能可靠找回对话页签」才是允许隐去页签条的唯一前提。
       认不出（未知语言 / 标定失败 / DOM 漂移）就不盖就绪标记 —— 页签保持可见，
       用户永远有出口；宁可多一条页签，也不能让人进了轨迹出不来。 */
    const target = chatTab();
    setReady(target !== null);
    if (target === null) { drop(); return; }
    if (root.querySelector(TRAJECTORY_MARK) === null) { drop(); return; }

    if (button === null) {
      button = doc.createElement('button');
      button.type = 'button';
      button.className = BUTTON_CLASS;
      button.dataset.plugin = PLUGIN_ID;
      button.addEventListener('click', () => { chatTab()?.click(); });
      doc.body.appendChild(button);
    }
    /* 按钮文字直接抄那一格页签的文字：语言跟着宿主走，本模块不维护词表。 */
    button.textContent = '← ' + (target.textContent.trim() || '对话');

    /* 几何：viewArea 是 view slot 的父元素（slot 容器是 display:contents，自己 rect 恒为 0）。 */
    const box = root.parentElement ?? root;
    const rect = box.getBoundingClientRect();
    if (rect.width === 0) { drop(); return; }
    button.style.left = Math.round(rect.left + 12) + 'px';
    button.style.top = Math.round(rect.top + rect.height - 46) + 'px';

    if (watched !== box) {
      watched = box;
      resize?.disconnect();
      if (typeof ResizeObserver === 'function') {
        resize = new ResizeObserver(schedule);
        resize.observe(box);
      }
    }
  };

  /* 宿主的结构变化（切视图、流式新增节点、aria-selected 翻转）都从这里来，rAF 合并。 */
  const observer = new MutationObserver(schedule);
  if (doc.body !== null) observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-selected'] });
  /* 视口 / 侧栏 / 右栏的变化不产生 DOM 变更，单独听。 */
  const onResize = () => schedule();
  globalThis.addEventListener?.('resize', onResize, { passive: true });

  schedule();

  ctx.effect(() => () => {
    observer.disconnect();
    globalThis.removeEventListener?.('resize', onResize);
    resize?.disconnect();
    if (frame !== 0) cancelAnimationFrame(frame);
    setReady(false);   /* 卸载必须撤标记：否则页签会一直是被隐藏的状态 */
    drop();
  }, 'codex-ui: trajectory exit');
}
