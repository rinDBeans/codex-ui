/**
 * model-picker.js — Codex 模型选择器 B 面（浏览器半，构建期拼进 client.js）。
 *
 * 为什么是**自己的 DOM**：宿主菜单是竖列 radio，横向功率轨必须自建。0.5.0 用纯 CSS 把宿主
 * 菜单重排成轨，~25 条 :has() 挂在一个在 hover / focus / aria-busy 里反复重渲染的 portal 上 ——
 * 切换卡顿、界面简陋，已 revert。这里走「DOM 顶替席位」：
 *   1. 不注册 slot，也不动宿主的 React 树；
 *   2. 自己的触发器追加进 [data-slot="conversation.input.model"]，弹层挂 document.body；
 *   3. 席位里有我们的触发器时，样式表用**一条**直接子代 :has() 把宿主那一格 display:none
 *      （model-picker.css ①）。不打标记属性：React 换掉宿主子节点时标记会丢、宿主控件闪回；
 *      :has() 只看「我们在不在席」，摘掉触发器宿主立刻复原。
 * 数据与提交全部走宿主唯一真源 ctx.modelDirectories，本模块不缓存模型列表。
 *
 * 驱动契约（读 @deepseek-ai/dsh-client-ui-model-selection 0.1.7-rc.2 源码得到）：
 *   models.directoryFor(sessionId)          → ModelDirectory（会话作用域未物化时**会抛**）
 *     dir.store.getSnapshot()                → { current, retainedEffort, groups, status, pending, error }
 *         status  : 'loading' | 'ready' | 'selecting' | 'error'
 *         groups  : [{ id, name, models: [{ id, name, description?, reasoning?: { defaultEffort?, efforts: [{ id, name }] } }] }]
 *         current : { provider, model, reasoningEffort? } | null
 *         pending : 正在往返的那次 selection | null
 *     dir.store.subscribe(fn)                → 退订函数
 *     dir.load()                             → 刷新目录（宿主在每次打开菜单时调一次）
 *     dir.select({ provider, model, reasoningEffort? }) → Promise<{ ok } | { ok:false, error:{ code, message } }>
 *   会话 id：席位祖先上的 data-conversation-session（宿主 ConversationRoot 打的），
 *            取不到再退到 uiSession.current.value.key（主视图那一个会话）。
 *
 * 卡顿的解码：宿主把目录在**整个 selectModel 往返**（实测 ~1.1s）里标成 selecting。
 * 列表的签名里只放「长什么样」的东西，selecting 不在里面 —— 改档位时卡片不重画、不清空；
 * 往返期间轨与触发器按 pending 那一档乐观显示，并在档位名旁转圈（宿主菜单那里一个都不画）。
 */

/** 席位名。 */
export const MODEL_SLOT = 'conversation.input.model';
/** 自建节点的类名根（样式表只画这些类，不碰宿主任何节点）。 */
export const TRIGGER_CLASS = 'codex-mp-trigger';
export const POPOVER_CLASS = 'codex-mp-popover';
/** Codex _ThumbScale 28px：拇指中心的行程是 [14, 宽 − 14]。 */
export const THUMB_SIZE = 28;
/** Codex --model-picker-power-slider-thumb-input-motion-duration：首帧 0s，16ms 后抬到 .3s。 */
export const MOTION_ARM_MS = 16;
/** 弹层定位（宿主 ModelSelect 的 place()：右沿对齐触发器、上方留 8px、视口留 12px）。 */
export const POPOVER_GAP = 8;
export const POPOVER_MARGIN = 12;
/** 宿主给内置模型的说明做了本地化，按同一张表取（宿主 BUILTIN_DESCRIPTION_KEYS）。 */
const BUILTIN_DESCRIPTION_KEYS = {
  'deepseek-account/deepseek-v4-flash': 'option.deepseekV4Flash.description',
  'deepseek-account/deepseek-v4-pro': 'option.deepseekV4Pro.description',
  'deepseek-official/deepseek-v4-flash': 'option.deepseekV4Flash.description',
  'deepseek-official/deepseek-v4-pro': 'option.deepseekV4Pro.description',
};

/**
 * 文案。优先借宿主 model 命名空间（措辞与原生菜单逐字一致，也跟着宿主的语言走）；
 * 宿主没有这把钥匙时才落到这里。键名与宿主相同，en 的两条说明也用来判断「是不是内置原文」。
 */
const COPY = {
  zh: {
    'provider.account': 'DeepSeek Account',
    'trigger.fallback': '请选择模型',
    'trigger.loading': '正在加载模型…',
    'trigger.aria': '选择模型，当前 {model}',
    'trigger.ariaEffort': '选择模型，当前 {model}，推理等级 {effort}',
    'menu.aria': '模型与推理等级',
    'menu.model': '模型',
    'menu.effort': '推理等级',
    'effort.providerDefault': 'Default',
    'error.action': '模型操作失败：{message}',
    'error.sessionInUse': '当前会话已被占用，可能是其他正在运行的 DSH 导致的（如其他 dsh web、桌面端），请退出其他正在运行的 DSH 后重试。',
    'action.reload': '重新加载',
    'empty.models': '没有可用的模型。',
  },
  en: {
    'provider.account': 'DeepSeek Account',
    'option.deepseekV4Flash.description': 'Fast, efficient, and economical; suited to focused, routine, or parallel tasks.',
    'option.deepseekV4Pro.description': 'Stronger agentic coding, knowledge, and difficult reasoning; suited to complex or quality-critical tasks at higher cost.',
    'trigger.fallback': 'Select model',
    'trigger.loading': 'Loading models…',
    'trigger.aria': 'Select model, current {model}',
    'trigger.ariaEffort': 'Select model, current {model}, reasoning effort {effort}',
    'menu.aria': 'Model and reasoning effort',
    'menu.model': 'Model',
    'menu.effort': 'Effort',
    'effort.providerDefault': 'Default',
    'error.action': 'Model operation failed: {message}',
    'error.sessionInUse': 'This session is already in use, possibly by another running DSH instance (such as dsh web or the desktop app). Quit other running DSH instances and try again.',
    'action.reload': 'Reload',
    'empty.models': 'No models available.',
  },
};

/**
 * 松手对齐：连续比例 → 最近档位下标。
 * @param ratio - 0..1（超界夹住，非数当 0）。
 * @param count - 档位数。
 * @returns 0..count-1。
 */
export function snapIndex(ratio, count) {
  if (!Number.isFinite(count) || count <= 1) return 0;
  const clamped = Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0));
  return Math.round(clamped * (count - 1));
}

/**
 * 档位 → 连续比例（拇指、色条与圆点共用的那个 --codex-mp-pos）。单档时居中。
 * @param index - 档位下标。
 * @param count - 档位数。
 * @returns 0..1。
 */
export function indexRatio(index, count) {
  if (!Number.isFinite(count) || count <= 1) return 0.5;
  return Math.min(1, Math.max(0, index / (count - 1)));
}

/**
 * 指针位置 → 连续比例：拇指中心只能走 [thumb/2, width − thumb/2]（Codex _Thumb 的行程）。
 * @param clientX - 指针横坐标。
 * @param left - 轨左沿。
 * @param width - 轨宽。
 * @param thumb - 拇指直径。
 * @returns 0..1。
 */
export function offsetRatio(clientX, left, width, thumb = THUMB_SIZE) {
  if (!Number.isFinite(width) || width <= thumb) return 0;
  return Math.min(1, Math.max(0, (clientX - left - thumb / 2) / (width - thumb)));
}

/**
 * 与 CSS 同一条公式的像素值（夹具与验收用）：calc(14px + (100% − 28px) × ratio)。
 * @param ratio - 0..1。
 * @param width - 轨宽。
 * @param thumb - 拇指直径。
 * @returns 相对轨左沿的 px。
 */
export function ratioOffset(ratio, width, thumb = THUMB_SIZE) {
  return thumb / 2 + (width - thumb) * ratio;
}

/**
 * 分组排序：与宿主菜单同序（deepseek-account → deepseek-official → 其余保持原序）。
 * @param groups - 目录里的分组。
 * @returns 新数组。
 */
export function sortGroups(groups) {
  const rank = (group) => (group.id === 'deepseek-account' ? 0 : group.id === 'deepseek-official' ? 1 : 2);
  return (Array.isArray(groups) ? groups : []).map((group, i) => [group, i])
    .sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1])
    .map(([group]) => group);
}

/**
 * 席位所属的会话 id。
 * @param slot - 席位元素。
 * @param fallback - 取不到时的回退（返回主视图会话 id 的函数）。
 * @returns 会话 id 或 null。
 */
export function sessionIdOf(slot, fallback) {
  const owner = slot !== null && typeof slot.closest === 'function' ? slot.closest('[data-conversation-session]') : null;
  const fromDom = owner === null ? null : owner.getAttribute('data-conversation-session');
  if (typeof fromDom === 'string' && fromDom !== '') return fromDom;
  try {
    const key = typeof fallback === 'function' ? fallback() : null;
    return typeof key === 'string' && key !== '' ? key : null;
  } catch {
    return null;
  }
}

/**
 * 目录快照 → 这一席位要显示的一切（纯函数，宿主 ModelSelect 的派生逻辑逐条对齐）。
 * pending 若是同一模型上的改档，档位按 pending 乐观显示 —— 往返 ~1.1s 里轨不回弹。
 * @param snap - dir.store.getSnapshot()。
 * @returns 视图模型。
 */
export function viewOf(snap) {
  const empty = { groups: [], current: null, choice: null, efforts: [], index: -1, effective: undefined, hasReasoning: false, pending: null, pendingEffort: false, status: 'loading', error: null, retainedEffort: undefined };
  if (snap === undefined || snap === null) return empty;
  const groups = sortGroups(snap.groups);
  const current = snap.current === undefined ? null : snap.current;
  let choice = null;
  if (current !== null) {
    for (const group of groups) {
      const model = (Array.isArray(group.models) ? group.models : []).find((m) => m.id === current.model);
      if (group.id === current.provider && model !== undefined) { choice = { group, model }; break; }
    }
  }
  const reasoning = choice === null || choice.model.reasoning === undefined || choice.model.reasoning === null ? null : choice.model.reasoning;
  const efforts = reasoning === null || !Array.isArray(reasoning.efforts) ? [] : reasoning.efforts;
  const pending = snap.pending === undefined ? null : snap.pending;
  const pendingEffort = pending !== null && current !== null && pending.provider === current.provider && pending.model === current.model
    && pending.reasoningEffort !== current.reasoningEffort;
  const saved = pendingEffort ? pending.reasoningEffort : (current === null ? undefined : current.reasoningEffort);
  const effective = saved !== undefined && saved !== null ? saved : (reasoning === null ? undefined : reasoning.defaultEffort);
  return {
    groups,
    current,
    choice,
    efforts,
    index: efforts.findIndex((level) => level.id === effective),
    effective,
    hasReasoning: reasoning !== null,
    pending,
    pendingEffort,
    status: typeof snap.status === 'string' ? snap.status : 'loading',
    error: typeof snap.error === 'string' && snap.error !== '' ? snap.error : null,
    retainedEffort: snap.retainedEffort,
  };
}

/**
 * 列表签名：只含「列表长什么样」—— 不含 status（selecting 期间不重画），
 * 含 pending 的那一行（行尾转圈要画出来）。
 * @param view - viewOf 的结果。
 * @returns 字符串。
 */
export function listSignature(view) {
  const parts = [view.current === null ? '' : view.current.provider + '/' + view.current.model];
  parts.push(view.pending === null ? '' : view.pending.provider + '/' + view.pending.model);
  parts.push(view.groups.length === 0 ? view.status + ':' + (view.error ?? '') : '');
  for (const group of view.groups) {
    parts.push(group.id + '=' + group.name + ':' + (Array.isArray(group.models) ? group.models.map((m) => m.id + '|' + m.name + '|' + (m.description ?? '')).join(',') : ''));
  }
  return parts.join(';');
}

/**
 * 安装模型选择器。
 * @param env - { models, sessionFallback, locale, enabled?, document?, window? }。
 *              enabled: false 表示先不接管，等 setEnabled(true)（设置文档还没到时用，免得先接管再撤回闪一下）。
 * @returns 句柄：setEnabled / refresh / isActive / dispose。
 */
export function installModelPicker(env) {
  const doc = env.document ?? globalThis.document;
  const win = env.window ?? globalThis.window ?? globalThis;
  const models = env.models;
  const slotSelector = '[data-slot="' + MODEL_SLOT + '"]';
  /** slot 元素 → 席位状态。 */
  const seats = new Map();
  let enabled = env.enabled !== false;
  let disposed = false;
  /** 当前打开弹层的那一个席位。 */
  let openSeat = null;
  let popover = null;
  let listBox = null;
  let errorBox = null;
  let effortBox = null;
  let effortValue = null;
  let rail = null;
  let railSignature = '';
  let lastListSignature = '';
  let armTimer = 0;
  let drag = null;
  /** 最近一次提交失败的文案（弹层顶上那条）。 */
  let failure = null;

  /* ── 文案 ────────────────────────────────────────────────────────────── */
  const hostT = (() => {
    try { return env.locale !== undefined && env.locale !== null && typeof env.locale.bind === 'function' ? env.locale.bind('model') : null; } catch { return null; }
  })();
  const lang = () => {
    let active = null;
    try { active = env.locale ? env.locale.getSnapshot().active : null; } catch { active = null; }
    const tag = typeof active === 'string' ? active : (typeof navigator === 'undefined' ? '' : navigator.language);
    return typeof tag === 'string' && tag.toLowerCase().startsWith('en') ? 'en' : 'zh';
  };
  const fill = (template, params) => (params === undefined ? template : template.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m)));
  /** 先问宿主（返回键名本身即没有），再落本表。 */
  const t = (key, params) => {
    if (hostT !== null) {
      try {
        const hosted = hostT(key, params);
        if (typeof hosted === 'string' && hosted !== key) return hosted;
      } catch { /* 宿主字典缺席就用本表 */ }
    }
    const own = COPY[lang()][key] ?? COPY.zh[key] ?? key;
    return fill(own, params);
  };
  const groupName = (group) => (group.id === 'deepseek-account' ? t('provider.account') : (group.name || group.id));
  /* 内置模型的说明只有宿主字典里有中文；宿主字典缺席时 t() 会把键名原样还回来 —— 那就用目录自带的原文。 */
  const descriptionOf = (group, model) => {
    const key = BUILTIN_DESCRIPTION_KEYS[group.id + '/' + model.id];
    if (key === undefined || model.description !== COPY.en[key]) return model.description;
    const localized = t(key);
    return localized === key ? model.description : localized;
  };

  /* ── DOM 小工具 ─────────────────────────────────────────────────────── */
  const el = (tag, className, text) => {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const CHEVRON = '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const CHECK = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const reducedMotion = () => typeof win.matchMedia === 'function' && win.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── 席位 ────────────────────────────────────────────────────────────── */
  function createSeat(slot) {
    const button = el('button', TRIGGER_CLASS);
    button.type = 'button';
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-expanded', 'false');
    const model = el('span', 'codex-mp-trigger-model');
    const layers = el('span', 'codex-mp-effort-layers');
    layers.setAttribute('aria-hidden', 'true');
    const chevron = el('span', 'codex-mp-trigger-chevron');
    chevron.innerHTML = CHEVRON;
    button.append(model, layers, chevron);
    const seat = { slot, button, model, layers, layerKey: '', sessionId: null, dir: null, off: null };
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      if (openSeat === seat) close(false);
      else open(seat, event.detail === 0);
    });
    button.addEventListener('keydown', (event) => {
      /* 鼠标打开后焦点留在触发器上（宿主也是），Escape 必须在这里也能关 —— 宿主的键盘处理挂在整格根上。 */
      if (event.key === 'Escape' && openSeat === seat) {
        event.preventDefault();
        close(true);
        return;
      }
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        if (openSeat !== seat) open(seat, true);
      }
    });
    return seat;
  }

  /** 换绑会话：退订旧目录，解析新目录并订阅。会话作用域未物化时宿主会抛 —— 吞掉，下一趟再试。 */
  function bind(seat, sessionId) {
    if (seat.off !== null) { try { seat.off(); } catch { /* 目录已随会话作用域销毁 */ } seat.off = null; }
    seat.sessionId = sessionId;
    seat.dir = null;
    if (sessionId === null) return;
    try {
      const dir = models.directoryFor(sessionId);
      if (dir === undefined || dir === null || dir.store === undefined) return;
      seat.dir = dir;
      seat.off = dir.store.subscribe(() => onStore(seat));
    } catch {
      seat.dir = null;
    }
  }

  const snapshotOf = (seat) => {
    if (seat.dir === null) return null;
    try { return seat.dir.store.getSnapshot(); } catch { return null; }
  };

  /** 可以接管：宿主确实渲染了这一格（子代理会话里宿主返回 null，我们也不出头），且目录已有可显示的内容。 */
  const canSeat = (seat, view) => {
    const hostChild = [...seat.slot.children].some((child) => child !== seat.button);
    return hostChild && seat.dir !== null && (view.current !== null || view.groups.length > 0);
  };

  function syncSeat(slot) {
    let seat = seats.get(slot);
    if (seat === undefined) { seat = createSeat(slot); seats.set(slot, seat); }
    const id = sessionIdOf(slot, env.sessionFallback);
    if (id !== seat.sessionId || seat.dir === null) bind(seat, id);
    const view = viewOf(snapshotOf(seat));
    if (!canSeat(seat, view)) {
      if (seat.button.parentElement !== null) seat.button.remove();
      if (openSeat === seat) close(false);
      return;
    }
    paintTrigger(seat, view);
    if (seat.button.parentElement !== slot) slot.appendChild(seat.button);
  }

  function dropSeat(seat) {
    if (openSeat === seat) close(false);
    if (seat.off !== null) { try { seat.off(); } catch { /* ignore */ } }
    seat.button.remove();
    seats.delete(seat.slot);
  }

  /** 全量对账：新席位接上、失联席位撤掉。 */
  function scan() {
    if (disposed || !enabled) return;
    const live = new Set(doc.querySelectorAll(slotSelector));
    for (const seat of [...seats.values()]) if (!live.has(seat.slot) || !seat.slot.isConnected) dropSeat(seat);
    for (const slot of live) syncSeat(slot);
  }

  function onStore(seat) {
    if (disposed || !enabled) return;
    syncSeat(seat.slot);
    if (openSeat === seat) renderPopover();
  }

  /* ── 触发器 ──────────────────────────────────────────────────────────── */
  function effortLabelOf(view) {
    if (!view.hasReasoning) return view.retainedEffort;
    if (view.effective === undefined) return t('effort.providerDefault');
    const level = view.efforts.find((e) => e.id === view.effective);
    return level === undefined ? view.effective : level.name;
  }

  function paintTrigger(seat, view) {
    const waiting = view.current === null && view.status === 'loading';
    const modelLabel = waiting ? t('trigger.loading')
      : view.choice !== null ? view.choice.model.name
        : view.current === null ? t('trigger.fallback') : view.current.provider + '/' + view.current.model;
    const effortLabel = effortLabelOf(view);
    if (seat.model.textContent !== modelLabel) seat.model.textContent = modelLabel;
    /* 档位文字叠层（Codex _ModelPickerTriggerEffortText）：所有档名叠在同一格里，
       当前那层 data-active —— 改档是模糊交叉淡入，不是换文本；格宽 = 最宽的那个名字，不跳宽。 */
    const names = view.hasReasoning ? [...(view.effective === undefined ? [t('effort.providerDefault')] : []), ...view.efforts.map((e) => e.name)] : [];
    if (effortLabel !== undefined && !names.includes(effortLabel)) names.push(effortLabel);
    const key = names.join('\u0000');
    if (key !== seat.layerKey) {
      seat.layerKey = key;
      seat.layers.textContent = '';
      for (const name of names) seat.layers.appendChild(el('span', 'codex-mp-effort-text', name));
    }
    /* 对账在任何元素增删时都会跑（流式输出期间很频繁）：属性只在变了时才写，重复对账不触发样式失效。 */
    for (const layer of seat.layers.children) {
      const active = layer.textContent === effortLabel ? 'true' : 'false';
      if (layer.getAttribute('data-active') !== active) layer.setAttribute('data-active', active);
    }
    if (seat.layers.hidden !== (names.length === 0)) seat.layers.hidden = names.length === 0;
    const title = effortLabel === undefined ? modelLabel : modelLabel + ' · ' + effortLabel;
    if (seat.button.title !== title) seat.button.title = title;
    const aria = waiting ? t('trigger.loading') : view.current === null ? t('trigger.fallback')
      : effortLabel === undefined ? t('trigger.aria', { model: modelLabel }) : t('trigger.ariaEffort', { model: modelLabel, effort: effortLabel });
    if (seat.button.getAttribute('aria-label') !== aria) seat.button.setAttribute('aria-label', aria);
    if (seat.button.hasAttribute('data-pending') !== (view.pending !== null)) seat.button.toggleAttribute('data-pending', view.pending !== null);
  }

  /* ── 弹层 ────────────────────────────────────────────────────────────── */
  function ensurePopover() {
    if (popover !== null) return;
    popover = el('div', POPOVER_CLASS);
    popover.setAttribute('role', 'dialog');
    popover.hidden = true;
    errorBox = el('div', 'codex-mp-error');
    errorBox.setAttribute('role', 'alert');
    errorBox.hidden = true;
    listBox = el('div', 'codex-mp-list');
    listBox.setAttribute('role', 'radiogroup');
    effortBox = el('div', 'codex-mp-effort');
    const head = el('div', 'codex-mp-effort-head');
    head.appendChild(el('span', 'codex-mp-effort-label'));
    effortValue = el('span', 'codex-mp-effort-value');
    head.appendChild(effortValue);
    const container = el('div', 'codex-mp-container');
    rail = el('div', 'codex-mp-root');
    rail.setAttribute('role', 'slider');
    rail.tabIndex = 0;
    const track = el('div', 'codex-mp-track');
    track.appendChild(el('div', 'codex-mp-range'));
    const thumbScale = el('span', 'codex-mp-thumb-scale');
    thumbScale.appendChild(el('span', 'codex-mp-thumb'));
    rail.append(track, thumbScale);
    container.appendChild(rail);
    effortBox.append(head, container);
    popover.append(errorBox, listBox, effortBox);
    popover.addEventListener('keydown', onPopoverKey);
    popover.addEventListener('focusout', onFocusOut);
    wireRail();
    doc.body.appendChild(popover);
  }

  function open(seat, viaKeyboard) {
    if (!enabled || disposed) return;
    if (openSeat !== null && openSeat !== seat) close(false);
    ensurePopover();
    openSeat = seat;
    failure = null;
    lastListSignature = '';
    railSignature = '';
    seat.button.setAttribute('aria-expanded', 'true');
    popover.setAttribute('aria-label', t('menu.aria'));
    listBox.setAttribute('aria-label', t('menu.model'));
    popover.setAttribute('data-reduced-motion', reducedMotion() ? 'true' : 'false');
    /* 首帧不动画（拇指从 0 滑到当前档很难看）：Codex 的 thumb-input-motion-duration 首帧 0s、16ms 后抬到 .3s。 */
    rail.removeAttribute('data-armed');
    popover.hidden = false;
    renderPopover();
    if (armTimer !== 0) win.clearTimeout(armTimer);
    armTimer = win.setTimeout(() => { armTimer = 0; if (rail !== null) rail.setAttribute('data-armed', 'true'); }, MOTION_ARM_MS);
    /* 宿主在打开菜单时刷新一次目录（reload()），这里同样做一次；结果经 store 订阅回来。 */
    if (seat.dir !== null && typeof seat.dir.load === 'function') {
      try { const p = seat.dir.load(); if (p && typeof p.catch === 'function') p.catch(() => {}); } catch { /* 子代理会话会抛：不刷新即可 */ }
    }
    if (viaKeyboard) {
      const checked = listBox.querySelector('[aria-checked="true"]') ?? listBox.querySelector('.codex-mp-row');
      if (checked !== null) checked.focus();
    }
  }

  function close(restoreFocus) {
    if (openSeat === null) return;
    const seat = openSeat;
    openSeat = null;
    drag = null;
    if (popover !== null) popover.hidden = true;
    seat.button.setAttribute('aria-expanded', 'false');
    if (restoreFocus && seat.button.isConnected) seat.button.focus();
  }

  /** 宿主 place() 的同一套：右沿对齐触发器、上方 8px、夹在视口 12px 内。 */
  function place() {
    if (openSeat === null || popover === null || popover.hidden) return;
    const rect = openSeat.button.getBoundingClientRect();
    const w = popover.offsetWidth;
    const h = popover.offsetHeight;
    let x = rect.right - w;
    let y = rect.top - POPOVER_GAP - h;
    if (w > 0) x = Math.min(Math.max(x, POPOVER_MARGIN), win.innerWidth - w - POPOVER_MARGIN);
    if (h > 0) y = Math.min(Math.max(y, POPOVER_MARGIN), win.innerHeight - h - POPOVER_MARGIN);
    popover.style.left = Math.round(x) + 'px';
    popover.style.top = Math.round(y) + 'px';
  }

  function renderPopover() {
    if (openSeat === null || popover === null) return;
    const view = viewOf(snapshotOf(openSeat));
    errorBox.hidden = failure === null;
    errorBox.textContent = failure ?? '';
    const signature = listSignature(view);
    if (signature !== lastListSignature) {
      lastListSignature = signature;
      renderList(view);
    }
    renderEffort(view);
    place();
  }

  function renderList(view) {
    listBox.textContent = '';
    if (view.groups.length === 0) {
      const status = el('div', 'codex-mp-status');
      if (view.status === 'error') {
        status.textContent = t('error.action', { message: view.error ?? '' }) + ' ';
        const retry = el('button', 'codex-mp-retry', t('action.reload'));
        retry.type = 'button';
        retry.addEventListener('click', () => { if (openSeat !== null && openSeat.dir !== null) openSeat.dir.load().catch(() => {}); });
        status.appendChild(retry);
      } else {
        status.textContent = view.status === 'loading' ? t('trigger.loading') : t('empty.models');
      }
      listBox.appendChild(status);
      return;
    }
    const titled = view.groups.length > 1;
    for (const group of view.groups) {
      const list = Array.isArray(group.models) ? group.models : [];
      if (list.length === 0) continue;
      if (titled) listBox.appendChild(el('div', 'codex-mp-group', groupName(group)));
      for (const model of list) listBox.appendChild(buildRow(view, group, model));
    }
  }

  function buildRow(view, group, model) {
    const selected = view.current !== null && view.current.provider === group.id && view.current.model === model.id;
    const pending = view.pending !== null && view.pending.provider === group.id && view.pending.model === model.id && !view.pendingEffort;
    const row = el('button', 'codex-mp-row');
    row.type = 'button';
    row.setAttribute('role', 'radio');
    row.setAttribute('aria-checked', selected ? 'true' : 'false');
    if (pending) row.setAttribute('aria-busy', 'true');
    const copy = el('span', 'codex-mp-row-copy');
    copy.appendChild(el('span', 'codex-mp-row-name', model.name || model.id));
    const description = descriptionOf(group, model);
    if (typeof description === 'string' && description !== '') {
      const desc = el('span', 'codex-mp-row-desc', description);
      desc.title = description;
      copy.appendChild(desc);
    }
    const check = el('span', 'codex-mp-row-check');
    /* pending 行尾换成转圈（宿主此时一个都不画，面板冻着像卡住）；勾选留给已生效的那一行。 */
    if (pending) check.appendChild(el('span', 'codex-mp-spinner'));
    else if (selected) check.innerHTML = CHECK;
    row.append(copy, check);
    row.addEventListener('click', (event) => {
      event.stopPropagation();
      choose(group, model);
    });
    return row;
  }

  /* ── 功率轨 ──────────────────────────────────────────────────────────── */
  function renderEffort(view) {
    const show = view.hasReasoning && view.efforts.length > 0;
    effortBox.hidden = !show;
    if (!show) return;
    effortBox.querySelector('.codex-mp-effort-label').textContent = t('menu.effort');
    effortValue.textContent = '';
    if (view.pendingEffort) effortValue.appendChild(el('span', 'codex-mp-spinner'));
    effortValue.appendChild(el('span', '', effortLabelOf(view) ?? ''));
    rail.setAttribute('aria-label', t('menu.effort'));
    const signature = view.choice.group.id + '/' + view.choice.model.id + ':' + view.efforts.map((e) => e.id).join(',');
    if (signature !== railSignature) {
      railSignature = signature;
      for (const tick of rail.querySelectorAll('.codex-mp-tick')) tick.remove();
      const thumbScale = rail.querySelector('.codex-mp-thumb-scale');
      view.efforts.forEach((level, i) => {
        const tick = el('span', 'codex-mp-tick');
        tick.setAttribute('data-index', String(i));
        tick.title = level.name;
        /* 档位等距落在拇指行程 [14, 宽 − 14] 上 —— 与拇指、色条同一条 calc，零布局读。 */
        tick.style.left = 'calc(' + THUMB_SIZE / 2 + 'px + (100% - ' + THUMB_SIZE + 'px) * ' + indexRatio(i, view.efforts.length) + ')';
        rail.insertBefore(tick, thumbScale);
      });
      rail.setAttribute('aria-valuemin', '0');
      rail.setAttribute('aria-valuemax', String(view.efforts.length - 1));
      rail.setAttribute('data-count', String(view.efforts.length));
    }
    rail.toggleAttribute('data-unset', view.index < 0);
    if (view.index >= 0) {
      rail.setAttribute('aria-valuenow', String(view.index));
      rail.setAttribute('aria-valuetext', view.efforts[view.index].name);
    } else {
      rail.removeAttribute('aria-valuenow');
      rail.setAttribute('aria-valuetext', effortLabelOf(view) ?? '');
    }
    /* 拖动中不让 store 的回调把拇指拽回去。 */
    if (drag === null) paintRail(view.index < 0 ? null : indexRatio(view.index, view.efforts.length));
  }

  /**
   * 画到连续位置：拇指、色条、「已走过」的圆点都由同一个 --codex-mp-pos 驱动。
   * @param ratio - 0..1；null 表示没有生效档（跟随提供方默认），此时拇指与色条藏起、圆点全按未选画。
   */
  function paintRail(ratio) {
    rail.style.setProperty('--codex-mp-pos', String(ratio === null ? 0 : Number(ratio.toFixed(4))));
    const ticks = rail.querySelectorAll('.codex-mp-tick');
    const count = ticks.length;
    ticks.forEach((tick, i) => tick.setAttribute('data-selected', ratio !== null && indexRatio(i, count) <= ratio + 1e-6 ? 'true' : 'false'));
  }

  function currentEfforts() {
    if (openSeat === null) return null;
    const view = viewOf(snapshotOf(openSeat));
    return view.choice === null || view.efforts.length === 0 ? null : view;
  }

  function wireRail() {
    rail.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      const view = currentEfforts();
      if (view === null) return;
      event.preventDefault();
      rail.focus({ preventScroll: true });
      rail.setAttribute('data-keyboard-focused', 'false');
      const rect = rail.getBoundingClientRect();
      drag = { pointerId: event.pointerId, left: rect.left, width: rect.width, count: view.efforts.length, ratio: offsetRatio(event.clientX, rect.left, rect.width) };
      try { rail.setPointerCapture(event.pointerId); } catch { /* 合成事件没有真指针 */ }
      rail.setAttribute('data-dragging', 'true');
      paintRail(drag.ratio);
    });
    rail.addEventListener('pointermove', (event) => {
      if (drag === null || event.pointerId !== drag.pointerId) return;
      drag.ratio = offsetRatio(event.clientX, drag.left, drag.width);
      paintRail(drag.ratio);
    });
    const release = (event, commitIt) => {
      if (drag === null || event.pointerId !== drag.pointerId) return;
      const { count, ratio } = drag;
      drag = null;
      rail.removeAttribute('data-dragging');
      try { if (rail.hasPointerCapture(event.pointerId)) rail.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
      const view = currentEfforts();
      if (view === null) return;
      const index = commitIt ? snapIndex(ratio, count) : view.index;
      paintRail(index < 0 ? null : indexRatio(index, count));
      if (commitIt) chooseEffort(view, index);
    };
    rail.addEventListener('pointerup', (event) => release(event, true));
    rail.addEventListener('pointercancel', (event) => release(event, false));
    /* 捕获意外丢失（节点被换掉、系统手势）按取消处理：退回生效档，不提交半截拖动。 */
    rail.addEventListener('lostpointercapture', (event) => release(event, false));
    rail.addEventListener('keydown', (event) => {
      const view = currentEfforts();
      if (view === null) return;
      const last = view.efforts.length - 1;
      const now = view.index < 0 ? 0 : view.index;
      let next = null;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = Math.max(0, now - 1);
      else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = Math.min(last, now + 1);
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = last;
      if (next === null) return;
      event.preventDefault();
      event.stopPropagation();
      rail.setAttribute('data-keyboard-focused', 'true');
      paintRail(indexRatio(next, view.efforts.length));
      chooseEffort(view, next);
    });
    rail.addEventListener('focus', () => {
      let visible = false;
      try { visible = rail.matches(':focus-visible'); } catch { visible = false; }
      rail.setAttribute('data-keyboard-focused', visible ? 'true' : 'false');
    });
    rail.addEventListener('blur', () => rail.setAttribute('data-keyboard-focused', 'false'));
  }

  /* ── 提交 ────────────────────────────────────────────────────────────── */
  function submit(seat, selection, closeOnOk) {
    if (seat.dir === null) return;
    failure = null;
    let pending;
    try { pending = seat.dir.select(selection); } catch (error) { failure = t('error.action', { message: String(error && error.message ? error.message : error) }); renderPopover(); return; }
    Promise.resolve(pending).then((result) => {
      if (result === undefined || result === null) return;
      if (result.ok) {
        if (closeOnOk && openSeat === seat) close(true);
        return;
      }
      const error = result.error ?? {};
      failure = error.code === 'session/writer-held' ? t('error.sessionInUse') : t('error.action', { message: (error.code ?? '') + ': ' + (error.message ?? '') });
      if (openSeat === seat) renderPopover();
    }, (error) => {
      failure = t('error.action', { message: String(error && error.message ? error.message : error) });
      if (openSeat === seat) renderPopover();
    });
  }

  /** 选模型：同一个就只关掉（宿主 choose()）；否则连带该模型的默认档位一起提交，成功后关。 */
  function choose(group, model) {
    const seat = openSeat;
    if (seat === null) return;
    const view = viewOf(snapshotOf(seat));
    if (view.pending !== null) return;
    if (view.current !== null && view.current.provider === group.id && view.current.model === model.id) { close(true); return; }
    const effort = model.reasoning === undefined || model.reasoning === null ? undefined : model.reasoning.defaultEffort;
    submit(seat, { provider: group.id, model: model.id, ...(effort === undefined ? {} : { reasoningEffort: effort }) }, true);
  }

  /** 改档：同一档不提交；弹层保持打开（轨上可以接着调）。 */
  function chooseEffort(view, index) {
    const seat = openSeat;
    if (seat === null || view.current === null) return;
    const level = view.efforts[index];
    if (level === undefined || level.id === view.effective) return;
    submit(seat, { provider: view.current.provider, model: view.current.model, reasoningEffort: level.id }, false);
  }

  /* ── 键盘与关闭 ─────────────────────────────────────────────────────── */
  function onPopoverKey(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
      return;
    }
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && event.target instanceof win.HTMLElement && event.target.classList.contains('codex-mp-row')) {
      event.preventDefault();
      const rows = [...listBox.querySelectorAll('.codex-mp-row')];
      const at = rows.indexOf(event.target);
      const next = rows[(at + (event.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length];
      if (next !== undefined) next.focus();
    }
  }

  function onFocusOut(event) {
    const to = event.relatedTarget;
    if (openSeat === null || !(to instanceof win.Node)) return;
    if (popover.contains(to) || openSeat.button.contains(to)) return;
    close(false);
  }

  const onPointerDown = (event) => {
    if (openSeat === null) return;
    if (popover !== null && popover.contains(event.target)) return;
    if (openSeat.button.contains(event.target)) return;
    close(false);
  };
  const onViewport = () => place();

  /* ── 生命周期 ───────────────────────────────────────────────────────── */
  /* 只看元素的增删（childList）与会话标记本身：流式输出改的是文本节点，不会打进来；
     回调同步对账，React 换出新席位的那一帧就接上，宿主控件不会先闪一下。 */
  let observer = null;
  if (typeof win.MutationObserver === 'function') {
    /* 自己弹层里的重画（列表、档位）不必对账：跳过目标落在弹层内的记录。 */
    const ours = (node) => popover !== null && (node === popover || popover.contains(node));
    observer = new win.MutationObserver((records) => {
      for (const record of records) {
        if (ours(record.target)) continue;
        if (record.type === 'attributes') { scan(); return; }
        const moved = [...record.addedNodes, ...record.removedNodes];
        if (moved.some((node) => node.nodeType === 1 && !ours(node))) { scan(); return; }
      }
    });
  }
  const start = () => {
    if (observer !== null) observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-conversation-session'] });
    doc.addEventListener('pointerdown', onPointerDown, true);
    win.addEventListener('resize', onViewport);
    win.addEventListener('scroll', onViewport, true);
    scan();
  };
  const stop = () => {
    close(false);
    if (observer !== null) observer.disconnect();
    doc.removeEventListener('pointerdown', onPointerDown, true);
    win.removeEventListener('resize', onViewport);
    win.removeEventListener('scroll', onViewport, true);
    for (const seat of [...seats.values()]) dropSeat(seat);
  };
  if (enabled) start();

  return {
    /** 开关。关掉即撤走所有自建节点与订阅，宿主那一格经 :has() 立刻复原。 */
    setEnabled(next) {
      const value = next !== false;
      if (value === enabled || disposed) return;
      enabled = value;
      if (enabled) start();
      else stop();
    },
    /** 手动对账（验收用）。 */
    refresh() { scan(); },
    /** 是否至少接管着一个席位（验收用）。 */
    isActive() { return enabled && [...seats.values()].some((seat) => seat.button.isConnected); },
    dispose() {
      if (disposed) return;
      stop();
      disposed = true;
      if (armTimer !== 0) win.clearTimeout(armTimer);
      if (popover !== null) popover.remove();
      popover = null;
    },
  };
}
