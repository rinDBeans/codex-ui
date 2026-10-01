/* codex-ui 0.7.1 —— 由 scripts/build.mjs 从 src/client/ 与 skins/codex-ink/ 生成，勿手改。 */
window.__ModuleLoader__.load({
  id: "codex-ui",
  factory: (require) => {
/* src/client/host.js */
const __src_client_host = (() => {
/**
 * 读宿主服务的两个小工具（设置覆盖层、设置卡、模型选择器共用）。
 */

/**
 * 设置表单的当前值。设置文档还没送达（status=loading、连接刚重连）时 value 是 undefined，
 * 这时返回 undefined，调用方应**保持现状** —— 撤掉已生效的覆盖会让用户的设置闪一下没了。
 * @param form - configForms.get(id) 的结果。
 * @returns 取值对象；未送达时 undefined。
 */
function formValue(form) {
  const value = form.getSnapshot().value;
  return value === undefined ? undefined : (value ?? {});
}

/**
 * 界面语言是不是英文：先问宿主 locale 服务，再问浏览器；认不出就当中文。
 * @param locale - ctx.reflect.get('locale')，可能缺席。
 * @returns true 为英文。
 */
function isEnglish(locale) {
  let active = null;
  try { active = locale?.getSnapshot().active ?? null; } catch { active = null; }
  const tag = typeof active === 'string' ? active : (typeof navigator === 'undefined' ? '' : navigator.language);
  return typeof tag === 'string' && tag.toLowerCase().startsWith('en');
}
return { formValue, isEnglish };
})();

/* src/client/model-picker/view.js */
const __src_client_model_picker_view = (() => {
/**
 * 模型选择器的纯逻辑（无 DOM；check.mjs 直接单测）：功率轨几何、目录快照 → 视图、列表签名。
 *
 * 数据契约（@deepseek-ai/dsh-client-ui-model-selection 0.1.7-rc.1 / rc.2 的 ModelDirectory）：
 *   store.getSnapshot() → { current, routable, groups, failures, status, error }
 *     status  : 'loading' | 'ready' | 'selecting' | 'error'（整个 selectModel 往返都是 selecting）
 *     groups  : [{ id, name, models: [{ id, name, description?, reasoning?: { defaultEffort?, efforts: [{ id, name }] } }] }]
 *     current : { provider, model, reasoningEffort? } | null
 *   **实测更正**：rc.1 的 ModelDirectoryState 只有上面六个字段 —— 既没有 pending 也没有 retainedEffort
 *   （两个词在该包 client.js 里各出现 0 次）。所以乐观显示的实际来源是 viewOf 的第二个参数 localPending
 *   （席位自己记的那一笔）；宿主将来补上 pending 时 snap.pending 会自动接管。
 */

/** 旋钮宽（形态基准 dsh-claude-style 的 16×30 旋钮）：中心的行程是 [8, 宽 − 8]。 */
const THUMB_SIZE = 16;

/**
 * 松手对齐：连续比例 → 最近档位下标。
 * @param ratio - 0..1（超界夹住，非数当 0）。
 * @param count - 档位数。
 * @returns 0..count-1。
 */
function snapIndex(ratio, count) {
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
function indexRatio(index, count) {
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
function offsetRatio(clientX, left, width, thumb = THUMB_SIZE) {
  if (!Number.isFinite(width) || width <= thumb) return 0;
  return Math.min(1, Math.max(0, (clientX - left - thumb / 2) / (width - thumb)));
}

/**
 * 与 CSS 同一条公式的像素值（夹具与验收用）：calc(THUMB_SIZE/2 + (100% − THUMB_SIZE) × ratio)。
 * @param ratio - 0..1。
 * @param width - 轨宽。
 * @param thumb - 拇指直径。
 * @returns 相对轨左沿的 px。
 */
function ratioOffset(ratio, width, thumb = THUMB_SIZE) {
  return thumb / 2 + (width - thumb) * ratio;
}

/**
 * 分组排序：与宿主菜单同序（deepseek-account → deepseek-official → 其余保持原序）。
 * @param groups - 目录里的分组。
 * @returns 新数组。
 */
function sortGroups(groups) {
  const rank = (group) => (group.id === 'deepseek-account' ? 0 : group.id === 'deepseek-official' ? 1 : 2);
  return (Array.isArray(groups) ? groups : []).map((group, i) => [group, i])
    .sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1])
    .map(([group]) => group);
}

/**
 * 席位祖先上宿主 ConversationRoot 打的会话 id；没有则 null。
 * @param slot - 席位元素。
 */
function domSessionOf(slot) {
  const id = slot?.closest?.('[data-conversation-session]')?.getAttribute('data-conversation-session');
  return typeof id === 'string' && id !== '' ? id : null;
}

/**
 * 席位所属的会话 id：先看祖先上的标记（右栏侧边聊天有自己的席位），取不到再退到主视图会话。
 * @param slot - 席位元素。
 * @param fallback - 返回主视图会话 id 的函数。
 * @returns 会话 id 或 null。
 */
function sessionIdOf(slot, fallback) {
  const fromDom = domSessionOf(slot);
  if (fromDom !== null) return fromDom;
  try {
    const key = fallback?.();
    return typeof key === 'string' && key !== '' ? key : null;
  } catch {
    return null;
  }
}

/**
 * 目录快照 → 这一席位要显示的一切（纯函数，宿主 ModelSelect 的派生逻辑逐条对齐）。
 * pending 若是同一模型上的改档，档位按 pending 乐观显示 —— 往返 ~1.1s 里轨不回弹。
 * @param snap - dir.store.getSnapshot()。
 * @param localPending - 席位自己的待生效 selection（宿主快照没有 pending 时用它）。
 *                       宿主给了就用宿主的，两者都缺即 null。
 * @returns 视图模型。
 */
function viewOf(snap, localPending) {
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
  /* 宿主快照优先（将来补上 pending 时自动接管），缺了才用席位自己记的那一笔。 */
  const hosted = snap.pending === undefined || snap.pending === null ? null : snap.pending;
  const pending = hosted !== null ? hosted : (localPending === undefined || localPending === null ? null : localPending);
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
function listSignature(view) {
  const parts = [view.current === null ? '' : view.current.provider + '/' + view.current.model];
  parts.push(view.pending === null ? '' : view.pending.provider + '/' + view.pending.model);
  parts.push(view.groups.length === 0 ? view.status + ':' + (view.error ?? '') : '');
  for (const group of view.groups) {
    parts.push(group.id + '=' + group.name + ':' + (Array.isArray(group.models) ? group.models.map((m) => m.id + '|' + m.name + '|' + (m.description ?? '')).join(',') : ''));
  }
  return parts.join(';');
}
return { THUMB_SIZE, snapIndex, indexRatio, offsetRatio, ratioOffset, sortGroups, domSessionOf, sessionIdOf, viewOf, listSignature };
})();

/* src/client/model-picker/component.js */
const __src_client_model_picker_component = (() => {
const { isEnglish } = __src_client_host;
const { THUMB_SIZE, domSessionOf, indexRatio, listSignature, offsetRatio, sessionIdOf, snapIndex, viewOf } = __src_client_model_picker_view;
/**
 * 模型选择器 B 面的 DOM 组件：Codex 模型列表 + 推理等级功率轨，顶替 composer 的模型位。
 *
 * 为什么是**自己的 DOM**：宿主菜单是竖列 radio，横向功率轨必须自建。0.5.0 用纯 CSS 把宿主
 * 菜单重排成轨，~25 条 :has() 挂在一个在 hover / focus / aria-busy 里反复重渲染的 portal 上 ——
 * 切换卡顿、界面简陋，已 revert。这里走「DOM 顶替席位」：
 *   1. 不注册 slot，也不动宿主的 React 树；
 *   2. 自己的触发器追加进 [data-slot="conversation.input.model"]，弹层挂 document.body；
 *   3. 席位里有我们的触发器时，给**席位出口**打 SEATED_ATTR，样式表据此把宿主那一格 display:none
 *      （model-picker.css ①）。标记打在出口上而不是宿主子节点上：React 换掉自己的子节点时标记不丢；
 *      撤走触发器时摘掉，宿主立刻复原。
 * 数据与提交全部走宿主唯一真源 ctx.modelDirectories，本模块不缓存模型列表。
 * 纯逻辑（几何、快照 → 视图、列表签名）在 ./view.js，本文件只管 DOM 与挂载。
 *
 * 驱动契约（读 @deepseek-ai/dsh-client-ui-model-selection 0.1.7-rc.1 / rc.2 源码得到）：
 *   models.directoryFor(sessionId)          → ModelDirectory（会话作用域未物化时**会抛**）
 *     dir.store.getSnapshot()                → { current, routable, groups, failures, status, error }
 *         status  : 'loading' | 'ready' | 'selecting' | 'error'
 *         groups  : [{ id, name, models: [{ id, name, description?, reasoning?: { defaultEffort?, efforts: [{ id, name }] } }] }]
 *         current : { provider, model, reasoningEffort? } | null
 *     dir.store.subscribe(fn)                → 退订函数
 *     dir.load()                             → 刷新目录（宿主在每次打开菜单时调一次）
 *     dir.select({ provider, model, reasoningEffort? }) → Promise<{ ok } | { ok:false, error:{ code, message } }>
 *   会话 id：席位祖先上的 data-conversation-session（宿主 ConversationRoot 打的），
 *            取不到再退到 uiSession.current.value.key（主视图那一个会话）。
 *
 *   **实测更正**：安装的 0.1.7-rc.1 的 ModelDirectoryState（lib/types/client/directory.d.ts:13-32）
 *   只有上面六个字段 —— 既没有 pending 也没有 retainedEffort（两个词在该包 client.js 里各出现 0 次）。
 *   所以「等宿主的 pending」这条路在这版上恒不触发，乐观显示必须是本模块自己的状态：
 *   席位级 seat.pending（见 settlePending / viewOfSeat）。宿主将来补上 pending 时仍优先用宿主的。
 *
 * 卡顿的解码：宿主把目录在**整个 selectModel 往返**（实测 ~1.1s）里标成 selecting。
 * 列表的签名里只放「长什么样」的东西，selecting 不在里面 —— 改档位时卡片不重画、不清空；
 * 往返期间轨与触发器按**本地 pending** 那一档乐观显示，并在档位名旁转圈（宿主菜单那里一个都不画）。
 *
 * 本地 pending 的因果链（0.5.11 修）：提交时记下目标 selection，宿主的 current 追平或提交失败即撤。
 * 没有它时，store 的第一次通知（status→selecting）会用**旧** current 重画轨，于是松手回弹一帧、
 * 底部触发器整段往返都停在旧档 —— 实测 t=234ms 轨回到旧档、t=252ms 才到新档。
 */



/** 席位选择器（与 view.js 的 MODEL_SLOT 同源；这里只需要字符串）。 */
const SLOT_SELECTOR = '[data-slot="conversation.input.model"]';
/** 我们的触发器在席时打在席位出口上（样式表据此隐藏宿主那一格）。 */
const SEATED_ATTR = 'data-codex-ui-seated';
/** 自建节点的类名根（样式表只画 .codex-mp-*，不碰宿主任何节点）。 */
const TRIGGER_CLASS = 'codex-mp-trigger';
const POPOVER_CLASS = 'codex-mp-popover';
/** Codex --model-picker-power-slider-thumb-input-motion-duration：首帧 0s，16ms 后抬到 .3s。 */
const MOTION_ARM_MS = 16;
/** 本地 pending 的兜底寿命：宿主迟迟不回显（丢包 / 被更晚的提交取代）也不能把界面钉死。 */
const PENDING_ECHO_MS = 12000;
/** 弹层定位照宿主 ModelSelect 的 place()：右沿对齐触发器、上方留 8px、视口留 12px。 */
const POPOVER_GAP = 8;
const POPOVER_MARGIN = 12;
const CHEVRON = '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CHECK = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

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
    'effort.faster': '更快',
    'effort.smarter': '更强',
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
    'effort.faster': 'Faster',
    'effort.smarter': 'Smarter',
    'effort.providerDefault': 'Default',
    'error.action': 'Model operation failed: {message}',
    'error.sessionInUse': 'This session is already in use, possibly by another running DSH instance (such as dsh web or the desktop app). Quit other running DSH instances and try again.',
    'action.reload': 'Reload',
    'empty.models': 'No models available.',
  },
};

/**
 * 挂上模型选择器。
 * @param env - { models: ctx.modelDirectories, sessionFallback: () => 主视图会话 id, locale, enabled? }。
 *              enabled: false 表示先不接管，等 setEnabled(true)（设置文档还没到时用，免得先接管再撤回闪一下）。
 * @returns 句柄：setEnabled / dispose。
 */
function mountModelPicker(env) {
  const models = env.models;
  /* 计时器与 devicePixelRatio 走 env.window：夹具里没有真 window（组件在页面里跑，但定时器要能被夹住）。 */
  const win = env.window ?? globalThis.window ?? globalThis;
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
  let effortText = null;
  let effortGhost = null;
  /** 上一次画出来的档位名（换档时它变成 ghost 飘走）。 */
  let lastEffortLabel = null;
  let endsBox = null;
  let matrix = null;
  /** 点阵已解出的网格签名（设备像素宽@dpr），空串表示还没建。 */
  let matrixSig = '';
  let rail = null;
  let railSignature = '';
  let lastListSignature = '';
  let armTimer = 0;
  let drag = null;
  /** 最近一次提交失败的文案（弹层顶上那条）。 */
  let failure = null;

  /* ── 文案：先借宿主 model 命名空间（返回键名本身即没有），再落本表 ─────── */
  let hostT = null;
  try { hostT = env.locale?.bind?.('model') ?? null; } catch { hostT = null; }
  const fill = (template, params) => (params === undefined ? template : template.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m)));
  const t = (key, params) => {
    if (hostT !== null) {
      try {
        const hosted = hostT(key, params);
        if (typeof hosted === 'string' && hosted !== key) return hosted;
      } catch { /* 宿主字典缺席就用本表 */ }
    }
    return fill(COPY[isEnglish(env.locale) ? 'en' : 'zh'][key] ?? COPY.zh[key] ?? key, params);
  };
  const groupName = (group) => (group.id === 'deepseek-account' ? t('provider.account') : (group.name || group.id));
  /* 内置模型的说明只有宿主字典里有中文；宿主字典缺席时 t() 会把键名原样还回来 —— 那就用目录自带的原文。 */
  const descriptionOf = (group, model) => {
    const key = BUILTIN_DESCRIPTION_KEYS[group.id + '/' + model.id];
    if (key === undefined || model.description !== COPY.en[key]) return model.description;
    const localized = t(key);
    return localized === key ? model.description : localized;
  };

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

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
    /* pending：本席位正在往返的那次 selection（宿主快照没有 pending 时的乐观来源）。 */
    const seat = { slot, button, model, layers, layerKey: '', sessionId: null, fromFallback: false, dir: null, off: null, pending: null, pendingSettled: false, pendingTimer: 0 };
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
    seat.off?.();
    seat.off = null;
    seat.sessionId = sessionId;
    seat.dir = null;
    if (sessionId === null) return;
    try {
      const dir = models.directoryFor(sessionId);
      seat.off = dir.store.subscribe(() => onStore(seat));
      seat.dir = dir;
    } catch {
      seat.dir = null;
    }
  }

  const snapshotOf = (seat) => seat.dir?.store.getSnapshot() ?? null;

  /** 两个 selection 是不是同一档（reasoningEffort 缺失与 undefined 等价）。 */
  const sameSelection = (a, b) => a !== null && b !== null
    && a.provider === b.provider && a.model === b.model
    && (a.reasoningEffort ?? undefined) === (b.reasoningEffort ?? undefined);

  /** 撤掉本地 pending 并重画（幂等；顺带收掉兜底计时器）。 */
  function clearPending(seat) {
    if (seat.pendingTimer !== 0) { win.clearTimeout(seat.pendingTimer); seat.pendingTimer = 0; }
    if (seat.pending === null) return;
    seat.pending = null;
    seat.pendingSettled = false;
    syncSeat(seat.slot);
    if (openSeat === seat) renderPopover();
  }

  /**
   * 宿主的 current 追平本地 pending 就撤掉它。
   *
   * **只有本次提交的 RPC 已经落地之后才允许撤**（seat.pendingSettled）—— 0.6.2 修的：
   * 宿主的 current 是「durable next-request projection」（directory.d.ts:14），它**落后于**提交。
   * 于是「切回当前那一档」时 current 与 pending 天然相等，早先那版会立刻撤掉乐观值，
   * 先前那次提交一落地就把显示拽回旧档 —— 就是「加载期间怎么滑都回弹」。
   */
  function settlePending(seat) {
    if (seat.pending === null || !seat.pendingSettled) return;
    const snap = snapshotOf(seat);
    const current = snap === null || snap.current === undefined ? null : snap.current;
    if (sameSelection(current, seat.pending)) clearPending(seat);
  }

  /** 席位视图：宿主快照 + 席位自己的 pending。所有读席位状态的地方都走这里。 */
  const viewOfSeat = (seat) => viewOf(snapshotOf(seat), seat.pending);

  /** 可以接管：宿主确实渲染了这一格（子代理会话里宿主返回 null，我们也不出头），且目录已有可显示的内容。 */
  const canSeat = (seat, view) => {
    const hostChild = [...seat.slot.children].some((child) => child !== seat.button);
    return hostChild && seat.dir !== null && (view.current !== null || view.groups.length > 0);
  };

  /** 对账一个席位；返回算好的视图（onStore 接着拿去画弹层，不再算第二遍）。 */
  function syncSeat(slot) {
    let seat = seats.get(slot);
    if (seat === undefined) { seat = createSeat(slot); seats.set(slot, seat); }
    const domId = domSessionOf(slot);
    seat.fromFallback = domId === null;
    const id = domId ?? sessionIdOf(null, env.sessionFallback);
    if (id !== seat.sessionId || seat.dir === null) bind(seat, id);
    settlePending(seat);
    const view = viewOfSeat(seat);
    if (!canSeat(seat, view)) {
      unseat(seat);
      if (openSeat === seat) close(false);
      return view;
    }
    paintTrigger(seat, view);
    if (seat.button.parentElement !== slot) slot.appendChild(seat.button);
    if (!slot.hasAttribute(SEATED_ATTR)) slot.setAttribute(SEATED_ATTR, '');
    return view;
  }

  /** 撤下触发器并摘掉席位标记：宿主那一格立刻复原。 */
  function unseat(seat) {
    if (seat.button.parentElement !== null) seat.button.remove();
    seat.slot.removeAttribute(SEATED_ATTR);
  }

  function dropSeat(seat) {
    if (seat.pendingTimer !== 0) { win.clearTimeout(seat.pendingTimer); seat.pendingTimer = 0; }
    if (openSeat === seat) close(false);
    seat.off?.();
    unseat(seat);
    seats.delete(seat.slot);
  }

  /** 全量对账：新席位接上、失联席位撤掉。 */
  function scan() {
    if (disposed || !enabled) return;
    const live = new Set(document.querySelectorAll(SLOT_SELECTOR));
    for (const seat of [...seats.values()]) if (!live.has(seat.slot) || !seat.slot.isConnected) dropSeat(seat);
    for (const slot of live) syncSeat(slot);
  }

  function onStore(seat) {
    if (disposed || !enabled) return;
    const view = syncSeat(seat.slot);
    if (openSeat === seat) renderPopover(view);
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
    /* 档位文字叠层（Codex _ModelPickerTriggerEffortText）：所有档名叠在同一格里，当前那层 data-active ——
       改档是模糊交叉淡入，不是换文本；格宽 = 最宽的那个名字，不跳宽。 */
    const names = view.hasReasoning ? [...(view.effective === undefined ? [t('effort.providerDefault')] : []), ...view.efforts.map((e) => e.name)] : [];
    if (effortLabel !== undefined && !names.includes(effortLabel)) names.push(effortLabel);
    const key = names.join('\u0000');
    if (key !== seat.layerKey) {
      seat.layerKey = key;
      seat.layers.textContent = '';
      for (const name of names) seat.layers.appendChild(el('span', 'codex-mp-effort-text', name));
    }
    /* 属性只在变了时才写：同一视图重复对账不触发样式失效。 */
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
    effortText = el('span', 'codex-mp-value-text');
    effortGhost = el('span', 'codex-mp-effort-ghost');
    effortValue.append(effortText, effortGhost);
    head.appendChild(effortValue);
    const container = el('div', 'codex-mp-container');
    rail = el('div', 'codex-mp-root');
    rail.setAttribute('role', 'slider');
    rail.tabIndex = 0;
    const track = el('div', 'codex-mp-track');
    track.appendChild(el('div', 'codex-mp-range'));
    matrix = el('div', 'codex-mp-matrix');
    track.appendChild(matrix);
    const thumbScale = el('span', 'codex-mp-thumb-scale');
    thumbScale.appendChild(el('span', 'codex-mp-thumb'));
    rail.append(track, thumbScale);
    container.appendChild(rail);
    /* 两端命名的是方向（更快 / 更强），不是取值 —— 形态基准里它们在槽下方一行。 */
    endsBox = el('div', 'codex-mp-ends');
    endsBox.append(el('span', 'codex-mp-ends-faster', t('effort.faster')), el('span', 'codex-mp-ends-smarter', t('effort.smarter')));
    effortBox.append(head, container, endsBox);
    popover.append(errorBox, listBox, effortBox);
    popover.addEventListener('keydown', onPopoverKey);
    popover.addEventListener('focusout', onFocusOut);
    wireRail();
    document.body.appendChild(popover);
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
    popover.setAttribute('data-reduced-motion', matchMedia('(prefers-reduced-motion: reduce)').matches ? 'true' : 'false');
    /* 首帧不动画（拇指从 0 滑到当前档很难看）：Codex 的 thumb-input-motion-duration 首帧 0s、16ms 后抬到 .3s。 */
    rail.removeAttribute('data-armed');
    popover.hidden = false;
    renderPopover();
    clearTimeout(armTimer);
    armTimer = setTimeout(() => { armTimer = 0; rail?.setAttribute('data-armed', 'true'); }, MOTION_ARM_MS);
    /* 宿主在打开菜单时刷新一次目录（reload()），这里同样做一次；结果经 store 订阅回来。子代理会话会拒绝，不刷新即可。 */
    seat.dir?.load().catch(() => {});
    if (viaKeyboard) {
      const checked = listBox.querySelector('[aria-checked="true"]') ?? listBox.querySelector('.codex-mp-row');
      checked?.focus();
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
    if (w > 0) x = Math.min(Math.max(x, POPOVER_MARGIN), innerWidth - w - POPOVER_MARGIN);
    if (h > 0) y = Math.min(Math.max(y, POPOVER_MARGIN), innerHeight - h - POPOVER_MARGIN);
    popover.style.left = Math.round(x) + 'px';
    popover.style.top = Math.round(y) + 'px';
  }

  function renderPopover(view = openSeat === null ? null : viewOfSeat(openSeat)) {
    if (openSeat === null || popover === null) return;
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
        retry.addEventListener('click', () => { openSeat?.dir?.load().catch(() => {}); });
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
    const label = effortLabelOf(view) ?? '';
    /* 换档是**交换**不是替换：进来的从下方模糊上浮，出去的（ghost 压在原位）向上飘走。 */
    if (label !== lastEffortLabel) {
      if (lastEffortLabel !== null) { effortGhost.textContent = lastEffortLabel; rearm(effortGhost); }
      lastEffortLabel = label;
      rearm(effortText);
    }
    effortText.textContent = label;
    const spin = effortValue.querySelector('.codex-mp-spinner');
    if (view.pendingEffort && spin === null) effortValue.insertBefore(el('span', 'codex-mp-spinner'), effortText);
    else if (!view.pendingEffort && spin !== null) spin.remove();
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
        /* 档位等距落在旋钮行程 [8, 宽 − 8] 上 —— 与旋钮、填充同一条 calc，零布局读。 */
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

  /* ── 顶档点阵（形态基准 dsh-claude-style 的 .dsh-claude-effort-matrix）──────────
     算法逐条照搬：5 行方块、1 设备像素缝、0.5 设备像素外边距，在**整设备像素**上解网格
     （小数 pitch 会被栅格化成交替的缝）；每格的相位/周期/色调由坐标 hash 散开，不成序；
     左侧的羽化是静态 opacity，颜色闪动从它上面走过，两者不打架。 */

  /** 坐标 hash → 0..1：先把两个坐标雪崩再取，免得邻居落进规则格点被看成斜带。 */
  function cellUnit(r, c, seed) {
    let h = Math.imul(r + 1, 0x9e3779b1) ^ Math.imul(c + 1, 0x85ebca6b) ^ Math.imul(seed + 1, 0x27d4eb2f);
    h = Math.imul(h ^ (h >>> 15), 0x2545f491);
    h ^= h >>> 13;
    return (h >>> 0) / 4294967296;
  }

  /** 左端溶回裸槽、右端实心的羽化（smoothstep）。 */
  function cellFade(fx) {
    if (fx <= 0.05) return 0;
    if (fx >= 0.75) return 1;
    const t = (fx - 0.05) / 0.7;
    return t * t * (3 - 2 * t);
  }

  /** 按设备像素解网格：5 行 ~4px 方块，余数回填到四边留白，方块保持正方且居中。 */
  function solveMatrix(wDev, dpr) {
    const ROWS = 5;
    const gap = Math.max(1, Math.round(1 * dpr));
    const margin = Math.max(1, Math.round(0.5 * dpr));
    const hDev = Math.round(26 * dpr);
    const block = Math.max(3, Math.floor((hDev - 2 * margin - (ROWS - 1) * gap) / ROWS));
    const cols = Math.max(1, Math.floor((wDev + gap) / (block + gap)));
    const restX = wDev - (cols * block + (cols - 1) * gap);
    const restY = hDev - (ROWS * block + (ROWS - 1) * gap);
    return {
      cols,
      rows: ROWS,
      sq: block / dpr,
      gap: gap / dpr,
      padTop: Math.floor(restY / 2) / dpr,
      padBottom: (restY - Math.floor(restY / 2)) / dpr,
      padLeft: Math.floor(restX / 2) / dpr,
      padRight: (restX - Math.floor(restX / 2)) / dpr,
    };
  }

  /** 给一颗粒子它自己的闪烁：色调、相位、周期全部 hash 散开。 */
  function paintParticle(sq, r, c) {
    sq.setAttribute('data-tone', String(Math.floor(cellUnit(r, c, 1) * 8) % 8));
    sq.style.setProperty('animation-delay', ((cellUnit(r, c, 2) * 1.38 + 0.3).toFixed(3)) + 's', 'important');
    sq.style.setProperty('animation-duration', (1.45 * (0.92 + cellUnit(r, c, 3) * 0.16)).toFixed(3) + 's', 'important');
  }

  /** 轨宽变了或 dpr 变了才重建；轨还没布局（隐藏中）时返回 false，调用方下次再试。 */
  function ensureMatrix() {
    if (matrix === null) return false;
    const track = rail === null ? null : rail.querySelector('.codex-mp-track');
    if (track === null) return false;
    const w = track.clientWidth;
    if (!w) return false;
    const dpr = win.devicePixelRatio > 0 ? win.devicePixelRatio : 1;
    const sig = Math.round(w * dpr) + '@' + dpr;
    if (sig === matrixSig) return true;
    const lay = solveMatrix(Math.round(w * dpr), dpr);
    matrix.textContent = '';
    matrix.style.gap = lay.gap + 'px';
    matrix.style.padding = lay.padTop + 'px ' + lay.padRight + 'px ' + lay.padBottom + 'px ' + lay.padLeft + 'px';
    matrix.style.gridTemplateColumns = 'repeat(' + lay.cols + ', ' + lay.sq + 'px)';
    matrix.style.gridAutoRows = lay.sq + 'px';
    for (let r = 0; r < lay.rows; r += 1) {
      for (let c = 0; c < lay.cols; c += 1) {
        const fx = lay.cols > 1 ? c / (lay.cols - 1) : 1;
        const cell = el('div', 'codex-mp-matrix-cell');
        /* 入场从右端扫进来（旋钮够到的那一端），带一点散相，免得读成一次擦除。 */
        cell.style.setProperty('animation-delay', (((1 - fx) * 0.45 + cellUnit(r, c, 4) * 0.08).toFixed(3)) + 's', 'important');
        const sq = el('div', 'codex-mp-matrix-sq');
        sq.style.opacity = cellFade(fx).toFixed(3);
        paintParticle(sq, r, c);
        cell.appendChild(sq);
        matrix.appendChild(cell);
      }
    }
    matrixSig = sig;
    return true;
  }

  /** 让 CSS 动画重新起跑（换档时名字交换要重播，否则第二次换档不动）。 */
  function rearm(node) {
    if (node === null) return;
    node.style.animation = 'none';
    void node.offsetWidth;
    node.style.animation = '';
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
    /* 顶档（形态基准里的 apex）：拖动中也要亮 —— 拉到最右端即触发，不等松手，所以判据挂在
       **连续比例**上而不是生效档 index 上。单档模型没有「最高档」可言。
       data-tier 同时打在轨上（点阵、旋钮、填充、刻度）与 effortBox 上（档位名转紫）。 */
    const atMax = ratio !== null && count > 1 && ratio >= 1 - 1e-6;
    if (atMax && ensureMatrix()) {
      rail.setAttribute('data-tier', 'max');
      if (effortBox !== null) effortBox.setAttribute('data-tier', 'max');
    } else {
      rail.removeAttribute('data-tier');
      if (effortBox !== null) effortBox.removeAttribute('data-tier');
    }
  }

  function currentEfforts() {
    if (openSeat === null) return null;
    const view = viewOfSeat(openSeat);
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
    rail.addEventListener('focus', () => rail.setAttribute('data-keyboard-focused', rail.matches(':focus-visible') ? 'true' : 'false'));
    rail.addEventListener('blur', () => rail.setAttribute('data-keyboard-focused', 'false'));
  }

  /* ── 提交 ────────────────────────────────────────────────────────────── */
  /**
   * 提交一次 selection。
   *
   * 提交前先把目标记进 seat.pending 并立刻重画：轨 / 触发器 / 弹层档位名从这一帧起就是目标档，
   * 不再等 durable projection。撤除点有三个，全都幂等 ——
   *   1. 宿主的 current 追平（settlePending，随 store 通知与每轮 scan 跑）；
   *   2. 提交成功返回（此时宿主已 syncInputs，current 就是目标档）；
   *   3. 提交失败或抛异常。
   * 只有在 seat.pending 还是本次那一笔时才撤，晚到的旧响应不会清掉更新的提交。
   *
   * @param seat - 席位。
   * @param selection - { provider, model, reasoningEffort? }。
   * @param closeOnOk - 成功后是否收起弹层（换模型收，改档位不收）。
   */
  function submit(seat, selection, closeOnOk) {
    if (seat.dir === null) return;
    failure = null;
    const submitted = {
      provider: selection.provider,
      model: selection.model,
      ...(selection.reasoningEffort === undefined ? {} : { reasoningEffort: selection.reasoningEffort }),
    };
    seat.pending = submitted;
    seat.pendingSettled = false;
    if (seat.pendingTimer !== 0) { win.clearTimeout(seat.pendingTimer); seat.pendingTimer = 0; }
    syncSeat(seat.slot);
    if (openSeat === seat) renderPopover();
    /**
     * 本次提交的 RPC 落地了（不是本次的那一笔就留着）。
     * 成功时**不直接撤**：先允许撤，再看宿主有没有追平；没追平就留着 pending 等它，
     * 并挂一条兜底寿命 —— 否则界面会卡在一个宿主永远不回显的档上。
     * @param force - 失败路径：无论如何撤掉（错就是错，不能让乐观值盖住失败）。
     */
    const release = (force) => {
      if (seat.pending !== submitted) return;
      if (force === true) { clearPending(seat); return; }
      seat.pendingSettled = true;
      settlePending(seat);
      if (seat.pending === null) return;
      seat.pendingTimer = win.setTimeout(() => { seat.pendingTimer = 0; clearPending(seat); }, PENDING_ECHO_MS);
    };
    let pending;
    try { pending = seat.dir.select(selection); } catch (error) {
      release(true);
      failure = t('error.action', { message: String(error && error.message ? error.message : error) });
      renderPopover();
      return;
    }
    Promise.resolve(pending).then((result) => {
      if (result === undefined || result === null) return;
      if (result.ok) {
        release(false);
        if (closeOnOk && openSeat === seat) close(true);
        return;
      }
      release(true);
      const error = result.error ?? {};
      failure = error.code === 'session/writer-held' ? t('error.sessionInUse') : t('error.action', { message: (error.code ?? '') + ': ' + (error.message ?? '') });
      if (openSeat === seat) renderPopover();
    }, (error) => {
      release(true);
      failure = t('error.action', { message: String(error && error.message ? error.message : error) });
      if (openSeat === seat) renderPopover();
    });
  }

  /** 选模型：同一个就只关掉（宿主 choose()）；否则连带该模型的默认档位一起提交，成功后关。 */
  function choose(group, model) {
    const seat = openSeat;
    if (seat === null) return;
    const view = viewOfSeat(seat);
    if (view.pending !== null) return;
    if (view.current !== null && view.current.provider === group.id && view.current.model === model.id) { close(true); return; }
    const effort = model.reasoning?.defaultEffort;
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
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && event.target instanceof HTMLElement && event.target.classList.contains('codex-mp-row')) {
      event.preventDefault();
      const rows = [...listBox.querySelectorAll('.codex-mp-row')];
      const at = rows.indexOf(event.target);
      rows[(at + (event.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length]?.focus();
    }
  }

  function onFocusOut(event) {
    const to = event.relatedTarget;
    if (openSeat === null || !(to instanceof Node)) return;
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
  /* 对账只在「和席位有关的变动」上做全量扫描：新席位出现（加进来的元素是/含席位）、席位离场（删掉的元素是/含席位）、
     会话标记改变；席位自己的子节点变了只对那一个席位。流式输出每段都会插元素，逐次全量扫描是白做。
     还没落定的席位（目录没解析出来、或会话 id 来自主视图回退）仍在任何变动时重试，与全量扫描时同效。
     回调同步执行（不挪到 rAF）：React 换出新席位的那一帧就接上，宿主控件不会先闪一下。 */
  const ours = (node) => popover !== null && (node === popover || popover.contains(node));
  const addsSeat = (node) => node.nodeType === 1 && (node.matches(SLOT_SELECTOR) || node.querySelector(SLOT_SELECTOR) !== null);
  const holdsSeat = (node) => node.nodeType === 1 && [...seats.keys()].some((slot) => node === slot || node.contains(slot));
  const observer = new MutationObserver((records) => {
    const touched = new Set();
    for (const record of records) {
      if (ours(record.target)) continue;
      if (record.type === 'attributes' || [...record.addedNodes].some(addsSeat) || [...record.removedNodes].some(holdsSeat)) {
        scan();
        return;
      }
      const seat = seats.get(record.target);
      if (seat !== undefined) touched.add(seat);
    }
    for (const seat of [...seats.values()]) {
      if (touched.has(seat) || seat.dir === null || seat.fromFallback) syncSeat(seat.slot);
    }
  });
  const start = () => {
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-conversation-session'] });
    document.addEventListener('pointerdown', onPointerDown, true);
    addEventListener('resize', onViewport);
    addEventListener('scroll', onViewport, true);
    scan();
  };
  const stop = () => {
    close(false);
    observer.disconnect();
    document.removeEventListener('pointerdown', onPointerDown, true);
    removeEventListener('resize', onViewport);
    removeEventListener('scroll', onViewport, true);
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
    dispose() {
      if (disposed) return;
      stop();
      disposed = true;
      clearTimeout(armTimer);
      popover?.remove();
      popover = null;
    },
  };
}
return { mountModelPicker };
})();

/* src/client/model-picker/index.js */
const __src_client_model_picker_index = (() => {
const { formValue } = __src_client_host;
const { mountModelPicker } = __src_client_model_picker_component;
/**
 * 模型选择器 B 面接到宿主上。
 *
 * 等 modelDirectories 服务就绪再挂：ctx.inject(deps, fn) 是宿主自己挂 composer 模型位的同一个口子。
 * 它不能进插件的 inject 列表 —— 那里的名字全是必需的，缺一个整个皮肤都不激活；服务撤走时 fn 的
 * 作用域连同我们的节点一起回收。
 * 设置卡的「Codex 模型选择器」（modelPicker，默认开）关掉即 setEnabled(false)：自建节点全撤，宿主那一格立刻复原。
 */



/**
 * @param ctx - 客户端上下文。
 * @param form - 本插件的设置表单；设置那一半没挂上时为 null（此时按默认开）。
 */
function installModelPicker(ctx, form) {
  /** 设置里的开关；设置文档还没到时返回 null（保持现状，不先接管再撤回）。 */
  const wanted = () => {
    if (form === null) return true;
    const value = formValue(form);
    return value === undefined ? null : value.modelPicker !== false;
  };
  ctx.inject(['modelDirectories'], (scope) => {
    const picker = mountModelPicker({
      models: scope.modelDirectories,
      /* 席位祖先上没有 data-conversation-session 时退到主视图会话（uiSession 投影）。 */
      sessionFallback: () => ctx.reflect.get('uiSession')?.current?.value?.key ?? null,
      locale: ctx.reflect.get('locale'),
      enabled: wanted() === true,
    });
    const off = form?.subscribe(() => {
      const next = wanted();
      if (next !== null) picker.setEnabled(next);
    });
    scope.effect(() => () => {
      off?.();
      picker.dispose();
    }, 'codex-ui: model picker');
  });
}
return { installModelPicker };
})();

/* src/client/constants.js */
const __src_client_constants = (() => {
/**
 * 全插件共用的名字。PLUGIN_ID 同时是：npm 包名、__ModuleLoader__ 的 id、设置表单命名空间（profile 条目 id）、
 * 组合包页座位 plugins.bundle.config 的键、style[data-plugin] 的归属标记 —— DSH 要求它们一致。
 */
const PLUGIN_ID = 'codex-ui';

/** 作用域根：theme.css 的每条规则都挂在 html[data-codex-ui] 下，摘掉即整层失效。 */
const ROOT_ATTR = 'data-codex-ui';

/** 设置页有覆盖时打在 <html> 上：覆盖层选择器比皮肤多这一个属性，特异性稳赢。 */
const OVERRIDE_ATTR = 'data-codex-ui-theme';

/** 切主题的那两帧打上：皮肤据此关掉全部过渡，免得整页交叉淡出（看起来就是闪）。 */
const SWITCH_ATTR = 'data-codex-ui-switching';

/** 主题本地预览期间打上（值为预览的那一套）。 */
const PREVIEW_ATTR = 'data-codex-ui-preview';

/** 轨迹出口「就绪」标记：只在能可靠找回对话页签时才打在 <body> 上。
 *  patches.css 的页签隐去规则挂在它下面 —— 认不出页签就不盖，页签保持可见。 */
const TE_READY_ATTR = 'data-codex-ui-te-ready';
return { PLUGIN_ID, ROOT_ATTR, OVERRIDE_ATTR, SWITCH_ATTR, PREVIEW_ATTR, TE_READY_ATTR };
})();

/* src/client/override.js */
const __src_client_override = (() => {
const { OVERRIDE_ATTR, ROOT_ATTR } = __src_client_constants;
/**
 * 设置页写进页面的那一层覆盖（纯函数：无 DOM、无副作用；check.mjs 直接单测）。
 *
 * skins/*.css 是默认值，设置页改的是用户覆盖：覆盖只在运行时以多一个属性的选择器（特异性 +1）
 * 压过皮肤，源样式一个字不动。取值纪律：
 *   · 空串 = 不覆盖；默认值下输出空串 —— 装上不动一个字，外观与没有设置页逐字节相同；
 *   · 颜色只认 6 位十六进制（Codex schema 同为 /^#[0-9a-fA-F]{6}$/）；
 *   · 除用户显式给的强调色外只产出中性 rgba，不引入彩色。
 * 对比度是简化实现（Codex 的 jdi：亮 45 / 暗 60 为原样）：文本档位按比例往 ink 或底色混合，
 * 中性 alpha 阶梯按比例缩放；差距写在 README「与 Codex 源码对账」。
 */


/** Codex 默认对比度：亮 45 / 暗 60。 */
const DEFAULT_CONTRAST = { light: 45, dark: 60 };

/**
 * 皮肤默认值（空串即回落到这里）。surface = 设置页「背景」那一行 = --dsw-alias-bg-base。
 * 必须与 skin.css 一致：check.mjs 逐字段对账，漂移即 FAIL。
 */
const SKIN_DEFAULTS = {
  light: { accent: '#339cff', focus: '#339cff', surface: '#ffffff', ink: '#1a1c1f', sidebar: '#f6f6f6' },
  dark: { accent: '#0169cc', focus: '#339cff', surface: '#111111', ink: '#ffffff', sidebar: '#0f0f0f' },
};

/**
 * 文本档位（次要/辅助/说明/主文本弱化）—— 对比度把它们往 ink（或往底色）拉。
 * 值必须与 skins/codex-ink/skin.css 一致；夹具会核对，改一处忘另一处会 FAIL。
 */
const LABEL_TIERS = {
  light: {
    '--dsw-alias-label-secondary': '#5d5d5d',
    '--dsw-alias-label-primary-dimmed': '#5d5d5d',
    '--dsw-alias-label-tertiary': '#767676',
    '--dsw-alias-label-caption': '#767676',
  },
  dark: {
    '--dsw-alias-label-secondary': '#b4b4b4',
    '--dsw-alias-label-primary-dimmed': '#b4b4b4',
    '--dsw-alias-label-tertiary': '#949494',
    '--dsw-alias-label-caption': '#949494',
  },
};

/**
 * 中性 alpha 家族 —— 对比度按比例缩放它们。
 * 只收中性（亮 rgba(13,13,13,·) / 暗 rgba(255,255,255,·)）：状态色与 diff 底色是**彩色**，
 * 缩放它们等于把调色板搬进本模块，与「彩色只配给状态、且集中在 skin.css」的纪律冲突。
 * 浮层挡板（bg-overlay / bg-mask-drop / specific-menu）与滚动条也不在内：它们不是对比度语义。
 * 同样由夹具与 skin.css 对账。
 */
const ALPHA_LADDER = {
  light: {
    '--dsw-alias-bg-skeleton': 0.05,
    '--dsw-alias-border-l1': 0.07,
    '--dsw-alias-border-l2': 0.12,
    '--dsw-alias-border-l3': 0.18,
    '--dsw-alias-border-l4': 0.24,
    '--dsw-alias-border-l2-darkmode-thin': 0.09,
    '--dsw-alias-button-tool-bar-fill': 0.28,
    '--dsw-alias-button-tool-bar-fill-invisible': 0.18,
    '--dsw-alias-button-tool-bar-hover': 0.36,
    '--dsw-alias-interactive-bg-hover': 0.04,
    '--dsw-alias-interactive-bg-active': 0.08,
    '--dsw-alias-interactive-bg-hover-accent': 0.06,
    '--dsw-alias-state-business-tertiary': 0.08,
    '--dsw-specific-sidebar-nav-item-active-accent': 0.1,
  },
  dark: {
    '--dsw-alias-bg-skeleton': 0.07,
    '--dsw-alias-border-l1': 0.08,
    '--dsw-alias-border-l2': 0.14,
    '--dsw-alias-border-l3': 0.2,
    '--dsw-alias-border-l4': 0.26,
    '--dsw-alias-border-l2-darkmode-thin': 0.1,
    '--dsw-alias-button-tool-bar-fill': 0.22,
    '--dsw-alias-button-tool-bar-fill-invisible': 0.16,
    '--dsw-alias-button-tool-bar-hover': 0.28,
    '--dsw-alias-interactive-bg-hover': 0.06,
    '--dsw-alias-interactive-bg-active': 0.1,
    '--dsw-alias-interactive-bg-hover-accent': 0.08,
    '--dsw-alias-state-business-tertiary': 0.12,
    '--dsw-specific-sidebar-nav-item-active-accent': 0.14,
    /* 本插件自己的悬停填充（0.1.2 起用），深色专属。 */
    '--dsw-codex-hover-fill': 0.08,
  },
};

/** 半透明侧边栏的填充不透明度。 */
const SIDEBAR_ALPHA = 0.72;
/** alpha 缩放的夹取区间：滑到底也不让发丝线彻底消失。 */
const SCALE_RANGE = [0.5, 2];
/** 文本档位混合的上限（按默认对比度归一后的偏移量）。 */
const MIX_RANGE = [0, 0.5];

/** 6 位十六进制色。 */
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * 是否是合法的覆盖色。
 * @param value - 待检查的值。
 * @returns 合法则 true；空串/未定义一律 false（= 不覆盖）。
 */
function isHex(value) {
  return typeof value === 'string' && HEX_RE.test(value.trim());
}

const toRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** 线性插值（逐通道四舍五入），t=0 返回 a、t=1 返回 b。 */
function mixHex(a, b, t) {
  const x = toRgb(a);
  const y = toRgb(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

/** 由十六进制色加 alpha 得到 rgba() 文本。 */
function withAlpha(hex, alpha) {
  const [r, g, b] = toRgb(hex);
  return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + Number(alpha.toFixed(3)) + ')';
}

/**
 * 对比度的影响：文本混合系数与 alpha 缩放系数。
 * @param contrast - 面板上的 0–100。
 * @param theme - 'light' | 'dark'。
 * @returns {{mix: number, scale: number}} 默认对比度下两者都是恒等值（0 / 1）。
 */
function contrastEffect(contrast, theme) {
  const fallback = DEFAULT_CONTRAST[theme];
  const raw = Number(contrast);
  const c = Number.isFinite(raw) ? Math.min(100, Math.max(0, raw)) : fallback;
  const ratio = c / fallback;
  const mix = Math.min(MIX_RANGE[1], Math.abs(ratio - 1) * 0.5) * (ratio >= 1 ? 1 : -1);
  const scale = Math.min(SCALE_RANGE[1], Math.max(SCALE_RANGE[0], ratio));
  return { mix, scale };
}

/**
 * 生成覆盖层 CSS。
 * @param values - configForms 的取值快照（空串表示不覆盖）。
 * @returns CSS 文本；默认值下为空串（不插任何规则）。
 */
function themeOverrideCss(values = {}) {
  const light = [];
  const dark = [];

  /** 每主题一组声明。 */
  const emit = (theme, list) => {
    const d = SKIN_DEFAULTS[theme];
    const accent = isHex(values[theme === 'light' ? 'accentLight' : 'accentDark'])
      ? values[theme === 'light' ? 'accentLight' : 'accentDark'].trim()
      : null;
    const surfaceRaw = values[theme === 'light' ? 'surfaceLight' : 'surfaceDark'];
    const surface = isHex(surfaceRaw) ? surfaceRaw.trim() : null;
    const inkRaw = values[theme === 'light' ? 'inkLight' : 'inkDark'];
    const ink = isHex(inkRaw) ? inkRaw.trim() : null;
    const contrast = values[theme === 'light' ? 'contrastLight' : 'contrastDark'];
    const { mix, scale } = contrastEffect(contrast, theme);
    const effectiveSurface = surface ?? d.surface;
    const effectiveInk = ink ?? d.ink;

    if (accent !== null) {
      list.push(['--dsw-alias-link', accent]);
      /* 焦点环跟着强调色走：亮色实色、暗色 70% —— 与皮肤里的两处默认值同构。 */
      list.push(['--dsw-codex-focus', theme === 'light' ? accent : withAlpha(accent, 0.7)]);
    }
    if (surface !== null) list.push(['--dsw-alias-bg-base', surface]);
    if (ink !== null) list.push(['--dsw-alias-label-primary', ink]);
    if (mix !== 0) {
      const target = mix > 0 ? effectiveInk : effectiveSurface;
      for (const [token, base] of Object.entries(LABEL_TIERS[theme])) {
        list.push([token, mixHex(base, target, Math.abs(mix))]);
      }
    }
    if (scale !== 1) {
      const rgb = theme === 'light' ? '13, 13, 13' : '255, 255, 255';
      for (const [token, base] of Object.entries(ALPHA_LADDER[theme])) {
        list.push([token, 'rgba(' + rgb + ', ' + Number(Math.min(1, base * scale).toFixed(3)) + ')']);
      }
    }
    if (values.translucentSidebar === true) {
      /* 侧栏填充转半透明：与 surface 同面时不改变观感，它只在侧栏压住别的内容时看得见
         —— Web 没有窗口层，这一点如实写进 README，不假装等价于 Codex 的窗口半透明。 */
      const fill = withAlpha(effectiveSurface, SIDEBAR_ALPHA);
      list.push(['--dsw-alias-bg-sidebar', fill]);
      list.push(['--dsw-specific-sidebar-fill', fill]);
      /* 行填充跟着转半透明：面板半透明而行实色会露出「玻璃板上的不透明贴片」。
         深色下侧栏与内容同面时，只有这两行还能把开关的效果显出来。 */
      const rgb = theme === 'light' ? '13, 13, 13' : '255, 255, 255';
      const rowAlpha = theme === 'light' ? [0.04, 0.08] : [0.06, 0.1];
      list.push(['--dsw-specific-sidebar-nav-item-hover', 'rgba(' + rgb + ', ' + Number(Math.min(1, rowAlpha[0] * scale).toFixed(3)) + ')']);
      list.push(['--dsw-specific-sidebar-nav-item-active', 'rgba(' + rgb + ', ' + Number(Math.min(1, rowAlpha[1] * scale).toFixed(3)) + ')']);
    }
  };

  emit('light', light);
  emit('dark', dark);

  /* 字体与主题无关，单独两条。 */
  const fonts = [];
  if (isFontStack(values.fontUi)) fonts.push(['--dsw-font-family', values.fontUi.trim()]);
  if (isFontStack(values.fontCode)) fonts.push(['--ds-font-family-code', values.fontCode.trim()]);

  const blocks = [];
  const fontDecls = fonts.map(([k, v]) => '  ' + k + ': ' + v + ';').join('\n');
  if (light.length > 0 || fontDecls !== '') {
    const decls = [...light.map(([k, v]) => '  ' + k + ': ' + v + ';'), fontDecls].filter((s) => s !== '').join('\n');
    blocks.push(sel('light') + ',\n' + sel('light-body') + ' {\n' + decls + '\n}');
  }
  if (dark.length > 0) {
    const decls = dark.map(([k, v]) => '  ' + k + ': ' + v + ';').join('\n');
    blocks.push(sel('dark') + ' {\n' + decls + '\n}');
  }
  return blocks.join('\n\n');
}

/**
 * 一组合法的字体栈（不许出现会闭合声明、或能改变后文切分的字符）。
 *
 * 值是原样拼进覆盖层 `<style>` 的，所以除了 `; { } < >` 与 `url(` 还要挡三类：
 *   · 反斜杠 —— CSS 转义，`u\72l(` 在分词器眼里就是 `url(`，上面那条字面检查拦不住；
 *   · 注释起止 `/*` `*\/` —— 值里开一个注释会把后面的声明连同深色那一整块一起吞掉；
 *   · 控制字符与不成对的引号 —— 换行会断开字符串记号，半个引号会把后文读成字符串。
 * @param value - 待检查的值。
 * @returns 合法则 true。
 */
function isFontStack(value) {
  if (typeof value !== 'string') return false;
  const s = value.trim();
  if (s === '' || s.length > 200) return false;
  if (/[;{}<>\\]/.test(s) || /url\(/i.test(s) || s.includes('/*') || s.includes('*/')) return false;
  if (/[\u0000-\u001f\u007f]/.test(s)) return false;
  return (s.split('"').length - 1) % 2 === 0 && (s.split("'").length - 1) % 2 === 0;
}

/**
 * 选择器生成：覆盖层比皮肤多一个属性，特异性 +1，因此不依赖样式表先后顺序。
 * @param which - 'light' | 'light-body' | 'dark'。
 * @returns CSS 选择器。
 */
function sel(which) {
  const root = 'html[' + ROOT_ATTR + '][' + OVERRIDE_ATTR + ']';
  if (which === 'light') return root;
  if (which === 'light-body') return root + ' body';
  return root + ' body[data-ds-dark-theme]';
}
return { DEFAULT_CONTRAST, SKIN_DEFAULTS, LABEL_TIERS, ALPHA_LADDER, SIDEBAR_ALPHA, SCALE_RANGE, MIX_RANGE, HEX_RE, isHex, mixHex, withAlpha, contrastEffect, themeOverrideCss, isFontStack };
})();

/* src/client/settings-card.js */
const __src_client_settings_card = (() => {
const { cloneElement, useCallback, useEffect, useMemo, useState, useSyncExternalStore } = require("react");
const { jsx, jsxs } = require("react/jsx-runtime");
const { Button, SegmentedControl, Switch, Tag } = require("@deepseek-ai/dsh-client-ui-primitives");
const { isEnglish } = __src_client_host;
const { DEFAULT_CONTRAST, SKIN_DEFAULTS, isFontStack, isHex } = __src_client_override;
/**
 * 组合包页（插件管理 → codex-ui）上的配置卡。宿主只以 view:'page' 渲染这个座位。
 * 改一下即写、没有保存按钮；文本框回车或失焦提交，写后回读确认落地；已覆盖的行显示徽标与「重置」。
 * 下面三行颜色编辑的是**当前生效的那一套**（theme.getTheme().active.colorScheme）。
 */






const COPY_ZH = {
  intro: '这里的值只覆盖本皮肤（codex-ink）的默认外观，空值即跟随皮肤。',
  theme: '主题',
  themeDesc: '切换应用外观：写的是宿主的主题偏好，与「设置 → 通用 → 外观」同一处',
  light: '亮色',
  dark: '深色',
  system: '跟随系统',
  accent: '强调色',
  accentDesc: '链接与焦点环',
  surface: '背景',
  surfaceDesc: '应用底色',
  ink: '前景',
  inkDesc: '主文本',
  fontUi: 'UI 字体',
  fontUiDesc: '留空跟随 dsh；填字体栈，如 "Segoe UI", sans-serif',
  fontCode: '代码字体',
  fontCodeDesc: '留空跟随 dsh',
  translucent: '半透明侧边栏',
  translucentDesc: '侧栏填充转为半透明；Web 没有窗口层，深色下侧栏与内容同面，看不出差别',
  modelPicker: 'Codex 模型选择器',
  modelPickerDesc: '输入区的模型位换成 Codex 式卡片：模型列表 + 可拖动的推理等级功率轨；关掉则交回宿主自带的菜单',
  contrast: '对比度',
  contrastDesc: '按 Codex 默认档位归一：45（亮）/ 60（暗）即原样',
  overridden: '已覆盖',
  reset: '重置',
  /* 重置按钮带字段名：多个「重置」同名时读屏分不清点的是哪一个（UX-16）。 */
  resetOf: (name) => '重置' + name,
  invalidHex: '不是一个合法色值：写成 #RGB / #RRGGBB / #RRGGBBAA。',
  invalidStack: '字体栈不能为空，写成逗号分隔的族名，例如 Segoe UI, sans-serif。',
  follow: '跟随皮肤',
  failed: '保存没生效，请重试。',
  themeTimeout: '主题切换没等到宿主确认，已按当前生效的主题回退；分段控件不再停在未生效的那一档。',
  unavailable: '这个 dsh 没有把 codex-ui 的配置开放给本页：条目可能在本 profile 里被停用，或连接把偏好留在页面进程内。',
  readOnly: '设置文档是只读的，改动无法保存。',
};
const COPY_EN = {
  intro: 'These values only override the codex-ink skin defaults. Empty means follow the skin.',
  theme: 'Theme',
  themeDesc: 'Switches the app appearance: the host theme preference, the same one as Settings → General → Appearance',
  light: 'Light',
  dark: 'Dark',
  system: 'System',
  accent: 'Accent',
  accentDesc: 'Links and focus ring',
  surface: 'Background',
  surfaceDesc: 'App surface',
  ink: 'Foreground',
  inkDesc: 'Primary text',
  fontUi: 'UI font',
  fontUiDesc: 'Empty follows dsh; e.g. "Segoe UI", sans-serif',
  fontCode: 'Code font',
  fontCodeDesc: 'Empty follows dsh',
  translucent: 'Translucent sidebar',
  translucentDesc: 'Sidebar fill becomes translucent; the Web has no window layer, so in dark it is invisible',
  modelPicker: 'Codex model picker',
  modelPickerDesc: 'Replaces the composer model seat with a Codex-style card: model list plus a draggable reasoning power rail. Off hands the seat back to the host menu.',
  contrast: 'Contrast',
  contrastDesc: 'Normalised to the Codex defaults: 45 (light) / 60 (dark) is unchanged',
  overridden: 'Overridden',
  reset: 'Reset',
  resetOf: (name) => 'Reset ' + name,
  invalidHex: 'Not a valid colour value: use #RGB / #RRGGBB / #RRGGBBAA.',
  invalidStack: 'The font stack cannot be empty; use comma-separated family names, e.g. Segoe UI, sans-serif.',
  follow: 'Follow skin',
  failed: 'The save did not take effect. Please try again.',
  themeTimeout: 'The theme switch was not confirmed by the host, so it was rolled back to the theme actually in effect; the segments no longer sit on the value that never took.',
  unavailable: 'This dsh does not expose codex-ui configuration to this page: the entry may be disabled in this profile, or the connection keeps preferences inside the page process.',
  readOnly: 'The settings document is read-only, so changes cannot be saved.',
};

/** 用户层是否含这一格（= 已覆盖）。 */
const hasUserField = (snapshot, field) => snapshot.user != null && Object.hasOwn(snapshot.user, field);
/** 当前生效值。 */
const fieldValue = (snapshot, field) => snapshot.value?.[field];

/**
 * @param props - 座位注入：scope（本插件表单）、theme（宿主主题服务）、themeForm（ui-theme 表单）、
 *                watchTheme、previewTheme、locale。
 */
function SettingsCard({ scope, theme, themeForm, watchTheme, previewTheme, locale }) {
  const snapshot = useSyncExternalStore(
    useCallback((listener) => scope.subscribe(listener), [scope]),
    () => scope.getSnapshot(),
  );
  /* 宿主的 getTheme() 在两次变更之间返回同一个冻结对象，可直接当快照（useSyncExternalStore 按引用比较）。 */
  const themeSnapshot = useSyncExternalStore(
    useCallback((listener) => watchTheme(() => listener()), [watchTheme]),
    useCallback(() => theme.getTheme(), [theme]),
  );
  const copy = useMemo(() => (isEnglish(locale) ? COPY_EN : COPY_ZH), [locale]);
  /* preference 是偏好档（light/dark/system）；variant 是它当前解析出的那一套。 */
  const preference = themeSnapshot.preference;
  const variant = themeSnapshot.active?.colorScheme === 'dark' ? 'dark' : 'light';
  const [drafts, setDrafts] = useState({});
  /* 字段级错误：非法输入不再静默丢弃，而是挂在对应行上并关联给控件（UX-16）。 */
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  /* 分段控件先显示用户点的那个值：写文档是异步的，不暂存的话控件会滞后一拍。 */
  const [pendingTheme, setPendingTheme] = useState(null);
  /* 主题事务超时/未被接受：分段控件必须回退，并且要有用户能读到的反馈。 */
  const [themeTimedOut, setThemeTimedOut] = useState(false);
  useEffect(() => {
    if (pendingTheme !== null && pendingTheme === preference) setPendingTheme(null);
  }, [pendingTheme, preference]);

  const fieldOf = useCallback((base) => base + (variant === 'light' ? 'Light' : 'Dark'), [variant]);
  /**
   * 切主题。不调 theme.setTheme(id)：它先本地乐观发布、再由 adopt() 从设置文档回读，文档往返慢时会画出
   * 新值 → 旧值 → 新值（「黑 → 白 → 黑」）。这里先把偏好写进主题插件自己的设置文档（与服务内部 host.set
   * 同一命名空间 ui-theme、同一字段 preference），发布方只剩 adopt()，一次点击只发布一次；写入未被接受
   * 才退回服务入口。等往返的那 ~0.8s 由 previewTheme 立刻按目标主题显示。
   */
  const switchTheme = useCallback(async (id) => {
    if (id !== 'light' && id !== 'dark' && id !== 'system') return;
    setThemeTimedOut(false);
    setPendingTheme(id);
    /* 预览结束时才决定分段控件的去留：confirmed=false（超时/卸载回滚）就必须清 pending，
       否则页面已回亮色、分段仍选深色 —— 这是已复现的脱节。 */
    previewTheme(id, (confirmed) => {
      if (confirmed) return;
      setPendingTheme(null);
      setThemeTimedOut(true);
    });
    try {
      if ((await themeForm.set('preference', id)) !== false) return;
    } catch (error) {
      console.warn('[codex-ui] 直接写主题偏好失败，退回服务入口：', error);
    }
    setPendingTheme(null);
    setThemeTimedOut(true);
    try {
      theme.setTheme(id);
    } catch (error) {
      console.warn('[codex-ui] 切主题失败：', error);
    }
  }, [theme, themeForm, previewTheme]);
  const unavailable = snapshot.status === 'unavailable';
  const readOnly = snapshot.writable === false;
  const disabled = saving || unavailable || readOnly;

  /** 写一格或清一格，再回读确认落地。 */
  const persist = useCallback(async (op, landedCheck) => {
    setSaving(true);
    setFailed(false);
    let landed = false;
    try { landed = await landedCheck(await op()); } catch { landed = false; }
    setFailed(!landed);
    setSaving(false);
  }, []);
  const write = useCallback((field, next) => persist(
    () => scope.set(field, next),
    (accepted) => accepted !== false && fieldValue(scope.getSnapshot(), field) === next,
  ), [scope, persist]);
  const clear = useCallback((field) => {
    /* 撤草稿必须与撤存储值同时做：草稿是 shown 的第一优先级（见 contrastRow），
       只 unset 存储值的话，重置后滑杆/读数仍显示旧草稿。 */
    setDrafts((prev) => { const next = { ...prev }; delete next[field]; return next; });
    setErrors((prev) => { if (!Object.hasOwn(prev, field)) return prev; const next = { ...prev }; delete next[field]; return next; });
    return persist(
      () => scope.unset(field),
      () => !hasUserField(scope.getSnapshot(), field),
    );
  }, [scope, persist]);

  /** 提交一个文本/色值草稿：空串写的是清除。 */
  const commitText = useCallback(async (field, draft, validate) => {
    const text = String(draft).trim();
    /* 非法值不再静默 return：挂一条字段级错误，用户才知道为什么不保存。 */
    if (text !== '' && validate(text) === false) {
      const message = validate === isFontStack ? copy.invalidStack : copy.invalidHex;
      setErrors((prev) => (prev[field] === message ? prev : { ...prev, [field]: message }));
      return;
    }
    setErrors((prev) => { if (!Object.hasOwn(prev, field)) return prev; const next = { ...prev }; delete next[field]; return next; });
    setDrafts((prev) => { const next = { ...prev }; delete next[field]; return next; });
    if (text === '') { await clear(field); return; }
    await write(field, text);
  }, [clear, write]);

  const draftOf = (field) => (Object.hasOwn(drafts, field) ? drafts[field] : undefined);
  const setDraft = (field, value) => setDrafts((prev) => ({ ...prev, [field]: value }));

  if (unavailable) {
    return jsx('p', { className: 'cx-note', role: 'status', children: copy.unavailable });
  }

  /** 一行：标签 + 说明 + 覆盖徽标 + 控件；说明与错误用稳定 id 关联到控件。 */
  const row = (key, label, desc, control, field) => {
    const overridden = field !== undefined && hasUserField(snapshot, field);
    const error = field === undefined ? undefined : errors[field];
    /* 稳定 id 的关联链：控件的 aria-describedby → 说明（出错时再加错误）。
       没有它，读屏只念 aria-label，用户不知道「为什么不保存」（UX-16）。 */
    const descId = 'codex-ui-' + key + '-desc';
    const errId = 'codex-ui-' + key + '-err';
    const describedBy = error === undefined ? descId : descId + ' ' + errId;
    const wired = (node) => (node === null || node === undefined || typeof node !== 'object'
      ? node
      : cloneElement(node, { 'aria-describedby': describedBy }));
    return jsxs('div', {
      className: 'cx-row',
      children: [
        jsxs('div', {
          className: 'cx-row__text',
          children: [
            jsxs('div', {
              className: 'cx-row__label',
              children: [
                jsx('span', { children: label }),
                overridden ? jsx(Tag, { tone: 'outline', children: copy.overridden }) : null,
              ],
            }, 'label'),
            desc === null ? null : jsx('div', { className: 'cx-row__desc', id: descId, children: desc }),
            error === undefined ? null : jsx('div', { className: 'cx-error', id: errId, role: 'status', children: error }),
          ],
        }, 'text'),
        jsxs('div', {
          className: 'cx-row__control',
          children: [
            Array.isArray(control) ? control.map(wired) : wired(control),
            overridden ? jsx(Button, { variant: 'ghost', size: 'sm', disabled, onClick: () => clear(field), children: copy.resetOf(label) }) : null,
          ],
        }, 'control'),
      ],
    }, key);
  };

  /** 颜色行：色块 + 十六进制文本框。 */
  const colorRow = (base, label, desc) => {
    const field = fieldOf(base);
    const current = fieldValue(snapshot, field);
    const draft = draftOf(field);
    const text = draft !== undefined ? draft : (isHex(current) ? current : '');
    return row(base, label, desc, [
      jsx('input', {
        key: 'swatch',
        className: 'cx-swatch',
        type: 'color',
        disabled,
        'aria-label': label,
        value: isHex(current) ? current : SKIN_DEFAULTS[variant][base],
        onChange: (event) => write(field, event.target.value),
      }),
      jsx('input', {
        key: 'hex',
        className: 'cx-hex',
        type: 'text',
        disabled,
        spellCheck: false,
        'aria-label': label + ' hex',
        placeholder: copy.follow,
        value: text,
        onChange: (event) => setDraft(field, event.target.value),
        onBlur: () => { if (draftOf(field) !== undefined) commitText(field, draftOf(field), isHex); },
        onKeyDown: (event) => { if (event.key === 'Enter') commitText(field, draftOf(field) ?? text, isHex); },
      }),
    ], field);
  };

  /** 字体行：一条文本输入。 */
  const fontRow = (field, label, desc) => {
    const current = fieldValue(snapshot, field);
    const draft = draftOf(field);
    const text = draft !== undefined ? draft : (typeof current === 'string' ? current : '');
    return row(field, label, desc, jsx('input', {
      className: 'cx-text',
      type: 'text',
      disabled,
      spellCheck: false,
      'aria-label': label,
      placeholder: copy.follow,
      value: text,
      onChange: (event) => setDraft(field, event.target.value),
      onBlur: () => { if (draftOf(field) !== undefined) commitText(field, draftOf(field), isFontStack); },
      onKeyDown: (event) => { if (event.key === 'Enter') commitText(field, draftOf(field) ?? text, isFontStack); },
    }), field);
  };

  /** 对比度行：滑杆 + 读数，拖动时只改草稿，松手/失焦才写。 */
  const contrastRow = () => {
    const field = fieldOf('contrast');
    const shown = draftOf(field) ?? fieldValue(snapshot, field) ?? DEFAULT_CONTRAST[variant];
    /* 提交后必须撤草稿，否则 shown 永远取草稿，保存值与重置都改不动读数；
       顺序与 commitText 的「先撤草稿再写」一致。 */
    const commit = () => {
      const next = draftOf(field);
      if (next === undefined) return;
      setDrafts((prev) => { const copy = { ...prev }; delete copy[field]; return copy; });
      write(field, next);
    };
    return row('contrast', copy.contrast, copy.contrastDesc, [
      jsx('input', {
        key: 'range',
        className: 'cx-range',
        type: 'range',
        min: 0,
        max: 100,
        step: 1,
        disabled,
        'aria-label': copy.contrast,
        value: shown,
        onChange: (event) => setDraft(field, Number(event.target.value)),
        onPointerUp: commit,
        onKeyUp: commit,
        onBlur: commit,
      }),
      jsx('span', { key: 'value', className: 'cx-range__value', children: String(shown) }),
    ], field);
  };

  /** 开关行。 */
  const switchRow = (key, field, label, desc, checked) => row(key, label, desc, jsx(Switch, {
    checked,
    disabled,
    label,
    onChange: (next) => write(field, next),
  }), field);

  return jsxs('div', {
    className: 'cx-form',
    children: [
      jsx('p', { className: 'cx-note', children: copy.intro }),
      row('theme', copy.theme, copy.themeDesc, jsx(SegmentedControl, {
        id: 'codex-ui-theme',
        value: pendingTheme ?? preference,
        label: copy.theme,
        disabled,
        options: [
          { value: 'light', label: copy.light },
          { value: 'dark', label: copy.dark },
          { value: 'system', label: copy.system },
        ],
        onChange: switchTheme,
      })),
      themeTimedOut ? jsx('p', { className: 'cx-note', role: 'status', children: copy.themeTimeout }) : null,
      colorRow('accent', copy.accent, copy.accentDesc),
      colorRow('surface', copy.surface, copy.surfaceDesc),
      colorRow('ink', copy.ink, copy.inkDesc),
      fontRow('fontUi', copy.fontUi, copy.fontUiDesc),
      fontRow('fontCode', copy.fontCode, copy.fontCodeDesc),
      switchRow('translucent', 'translucentSidebar', copy.translucent, copy.translucentDesc, fieldValue(snapshot, 'translucentSidebar') === true),
      /* 默认开：用户层没有这一格（或值不是 false）都算开着。 */
      switchRow('modelPicker', 'modelPicker', copy.modelPicker, copy.modelPickerDesc, fieldValue(snapshot, 'modelPicker') !== false),
      contrastRow(),
      readOnly ? jsx('p', { className: 'cx-note', role: 'status', children: copy.readOnly }) : null,
      failed ? jsx('p', { className: 'cx-error', role: 'status', children: copy.failed }) : null,
    ],
  }, 'form');
}
return { SettingsCard };
})();

/* src/client/theme-preview.js */
const __src_client_theme_preview = (() => {
const { PREVIEW_ATTR, SWITCH_ATTR } = __src_client_constants;
/**
 * 主题切换的两件事：
 *   1. 切换的那两帧打 SWITCH_ATTR，皮肤据此关掉全部过渡（整页交叉淡出看起来就是闪）；
 *   2. 本地预览：设置卡点下去到宿主发布新主题要等一次设置文档往返（实测 ~0.8s）。先按目标主题
 *      写宿主本来就会写的两处（body[data-ds-dark-theme]、html 的 color-scheme），宿主带着同一结果
 *      回来时幂等交还；2.5s 没等到就按宿主真值回滚 —— 预览从不当成结果。
 */


const PREVIEW_TIMEOUT_MS = 2500;

/**
 * @param ctx - 客户端上下文（需要 theme 服务）。
 * @returns previewTheme(target)：target 为 'light' | 'dark' | 'system'。
 */
function installThemePreview(ctx) {
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
return { installThemePreview };
})();

/* src/client/settings.js */
const __src_client_settings = (() => {
const { OVERRIDE_ATTR, PLUGIN_ID } = __src_client_constants;
const { formValue } = __src_client_host;
const { themeOverrideCss } = __src_client_override;
const { SettingsCard } = __src_client_settings_card;
const { installThemePreview } = __src_client_theme_preview;
/**
 * 设置：覆盖层（用户在设置卡改的值 → 一条运行时 <style>）+ 主题预览 + 组合包页的配置卡。
 */






/**
 * @param ctx - 客户端上下文（configForms / theme / slots 都在插件的 inject 里）。
 * @returns 本插件的设置表单（模型选择器的开关也读它）。
 */
function installSettings(ctx) {
  const form = ctx.configForms.get(PLUGIN_ID);
  installOverride(ctx, form);
  const previewTheme = installThemePreview(ctx);
  /* 这些引用只建一次：卡片的 useSyncExternalStore 按订阅函数的身份决定要不要重订。 */
  const themeForm = ctx.configForms.get('ui-theme'); // 主题插件自己的表单，卡片写主题偏好走它（见卡片 switchTheme）
  const watchTheme = (listener) => ctx.on('theme/change', listener);
  ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
    name: 'plugins.bundle.config',
    key: PLUGIN_ID,
    inject: () => ({
      scope: ctx.configForms.get(PLUGIN_ID),
      theme: ctx.theme,
      themeForm,
      watchTheme,
      previewTheme,
      locale: ctx.reflect.get('locale'),
    }),
  }, SettingsCard));
  return form;
}

/** 覆盖层：默认值下是空串且不打属性 —— 与没有设置页逐字节相同。 */
function installOverride(ctx, form) {
  const root = document.documentElement;
  const tag = document.createElement('style');
  tag.dataset.plugin = PLUGIN_ID;
  tag.dataset.pluginCss = PLUGIN_ID + '/settings-override.css';
  document.head.appendChild(tag);
  let last = null;
  const render = () => {
    const values = formValue(form);
    if (values === undefined) return;
    const css = themeOverrideCss(values);
    /* 设置镜像里任何命名空间一变（切主题也算）都会回调这里：同样的 CSS 不重写，免得触发整页样式重算。 */
    if (css === last) return;
    last = css;
    tag.textContent = css;
    root.toggleAttribute(OVERRIDE_ATTR, css !== '');
  };
  render();
  const off = form.subscribe(render);
  ctx.effect(() => () => {
    off();
    tag.remove();
    root.removeAttribute(OVERRIDE_ATTR);
  }, 'codex-ui: settings override');
}
return { installSettings };
})();

/* src/client/settings-modal.js */
const __src_client_settings_modal = (() => {
const { isEnglish } = __src_client_host;
/**
 * settings-modal.js — 设置模态框的 Codex 化「结构层」（纯 DOM 操作、幂等、可降级）。
 *
 * 补上宿主没有的四件东西：侧栏顶部的「← 返回应用」、搜索框、按组插入的分组标题、
 * 以及内容区顶部的页头大标题；并保证关闭重开后完整重放。
 * **视觉一律不在这里做**：新样式挂在 html[data-codex-ui] 下，
 * 由 skins/codex-ink/settings-modal.css 提供，本文件只负责结构与行为。
 *
 * 三条纪律（都是实测踩出来的，别改回去）：
 *   1. **只加不接管**。宿主导航是数据驱动的：往 DOM 里塞一个新按钮**不会**让它成为设置页
 *      （侦察 §i 实测：克隆项存活、点击不崩、但既不切换选中态也不渲染内容）。
 *      所以对未知项一律只做视觉分组，绝不代它处理点击；宿主节点只打属性，不移动、不克隆、不删。
 *   2. **选择器不碰哈希类名**。宿主类名是 CSS-Modules 哈希（VOzbGW_* / oY77xG_* …，每个设置页
 *      还各有一套前缀），只用宿主自带属性（data-shortcut-modal / data-slot）/ tag / 位置索引这些稳定锚点。
 *   3. **任何一步结构不符预期就跳过并 warn，绝不抛**。宿主改版只会让这一层失效，
 *      不会拖垮插件其余功能（皮肤、覆盖层、组合包页配置卡）。
 *
 * 幂等性来自两处（侦察 §i 实测：**切设置项不重建 DOM，关闭再打开整棵 navList 重建**）：
 *   · 每个注入节点都带 data-codex-ui-injected="settings-modal"，创建前先查标记；
 *   · 观察 document.body 的 childList，overlay 被卸载/重建一次就重放一次。
 *
 * ⚠ 取舍一：**顺序调整走 CSS flex order，不移动宿主节点**。
 *   这是**政策选择**（方案 §7.2「宿主节点不搬移、不克隆」），**不是技术限制** —— 2026-09-30 实测：
 *   手工把「订阅服务」搬到「内置插件」之后，切页 / 搜索过滤 / 清空搜索三次重渲染都没有把它还原
 *   （React 按 key 协调自己的子节点，key 顺序没变就不动 DOM）。所以旧注释里
 *   「重排 DOM 顺序会与 React 的 key 协调冲突、重渲染时被还原」**与实测不符**，已更正。
 *   搬节点在技术上可行，但会让宿主节点脱离 React 的模型，取舍上仍选 flex order。
 *   本次探针复核：13 个 navCell 的 inline style 全为空、computed order 全为 0 —— order 是一个
 *   **没有人用过**的布局槽位，所以给宿主 cell 写 style.order 是安全的（React 不认它、也不会覆盖它）。
 *   收益：宿主节点零移动，点击 / 渲染 / 第三方项进出全部原样；代价：键盘 Tab 顺序仍是 DOM 顺序，
 *   视觉顺序 ≠ 焦点顺序，属已知可及性瑕疵（分组本身不改变焦点可达性，只是顺序不同）。
 *
 * ⚠ **为什么不用数据层排序（UX-06 的「只有宿主允许数据层排序时才重排」，2026-09-30 复核）**：
 *   宿主确实按数据层排序渲染 —— dsh-client-ui-settings-general 里是
 *   rows = ctx.slots.entries('settings.section') 取 e.options.order 排序。
 *   但 slots 服务只暴露 register / isLive / entries / entriesOfSlot / spec，
 *   **没有改动已有 entry 的 order 的 API**；而这些 section 由别的插件注册，codex-ui 替不了它们排序。
 *   实测宿主 DOM 序本来就是交错的
 *   （个人 / 通用设置 / 编码 / 模型 / 集成 / 内置插件 / Agent 预设 / 其他 / Ivory 主题 / 订阅服务），
 *   「按连续顺序分组」做不到，要分组就只能重排。
 *   结论：UX-06 在当前约束下**不可满足** —— 维持本取舍，也不用正 tabindex 之类的手段掩盖焦点顺序。
 *   要真正做到「视觉顺序 = 焦点顺序」，唯一路径是允许搬宿主节点（需先改方案 §7.2）。
 *
 * ⚠ 取舍二：**隐藏项用「属性 + 类名」双写**。
 *   本次探针实测（关键，比侦察报告的措辞更具体）：宿主在**选中态从某一项搬走时**会把那一项的
 *   className **整条重写**（oldValue "VOzbGW_navCell VOzbGW_active" → "VOzbGW_navCell"），
 *   而 data-* 属性原样保留。所以：
 *     · 耐久标记是**属性** data-cx-sm-hidden —— CSS 必须以它为准（[data-cx-sm-hidden]）；
 *     · 类名 cx-sm-hidden 只是方便人读的冗余，**不可依赖**。
 *   补回逻辑由下面的列表观察器负责，**它必须开 subtree**（见 observeList 的注释：
 *   不开 subtree 时观察器只上报被观察节点自身的属性变化，子节点的 class 改写一条都收不到，
 *   实测 0 条 vs 5 条）。
 *
 *   ⚠ 结论（C1 与 B2 交叉验证后的定论）：宿主重写 class **确实会产生 mutation 记录**，
 *   只是**必须开 subtree 才收得到**。C1 早先「那次重写不产生任何 mutation 记录」的观测，
 *   是 attributes 观察漏了 subtree 造成的假象，已由 probe4 双向对照证伪（同一时刻：
 *   不开 subtree → 0 条；开 subtree → 5 条，含 class oldValue
 *   "VOzbGW_navCell VOzbGW_active cx-sm-hidden" → "VOzbGW_navCell"）。
 *   因此两道保险同时成立、互为兜底：
 *     · CSS 以**属性** [data-cx-sm-hidden] 为准（耐久，类名被抹也不影响隐藏）；
 *     · JS 在下一帧把类名补回（subtree 观察器驱动），供只认 .cx-sm-hidden 的样式使用。
 */



/* ── 稳定锚点 ─────────────────────────────────────────────────────── */

/**
 * 设置模态框面板锚点（两条都查，前者优先）：
 *   1. [data-shortcut-modal="settings"] —— **宿主自己**盖在面板上的属性
 *      （dsh-client-ui-primitives 的 Dialog 原语统一行为，跨包约定）；
 *   2. [data-dsh-surface="settings"] —— 第三方 skin-center 兼容适配器补盖的语义属性，
 *      其契约文档自声明「非永久公共契约」，且**没装适配器的环境里它根本不存在**
 *      （整层静默失效曾在这条上翻车：PR #1 一审 C 项）。
 * 找到面板后统一补盖 PANEL_ATTR，CSS 只挂这个自有锚点 —— 以后锚点再变只动本文件。
 */
const PANEL_SELECTOR = '[data-shortcut-modal="settings"], [data-dsh-surface="settings"]';
/** 找到面板后补盖的自有锚点：settings-modal.css 里所有面板规则的唯一挂载点。 */
const PANEL_ATTR = 'data-cx-sm-panel';
/** 注入节点统一标记属性；卸载时按它一次性清干净。 */
const ATTR = 'data-codex-ui-injected';
/** 注入节点统一标记值。 */
const MARK = 'settings-modal';
/** 注入节点自报「我是哪一件」——重放时用它找回自己的节点，不靠类名。 */
const PART_ATTR = 'data-cx-sm-part';
/** 被搜索过滤掉的宿主项：属性是耐久标记（React 会重写 className，属性不会）。 */
const HIDDEN_ATTR = 'data-cx-sm-hidden';
/** 同一个隐藏态的类名，给 CSS 的现成钩子；被宿主抹掉后会被补回。 */
const HIDDEN_CLASS = 'cx-sm-hidden';
/** 宿主项上按组打的属性，CSS 与重放共用。 */
const GROUP_ATTR = 'data-cx-sm-group';
/** 兜底组 / 空结果提示的排序位：必须比任何组都大，否则 flex 默认 order:0 会把它顶到最前。 */
const TAIL_ORDER = 999999;
/** 每个分组占据的 order 槽位数。 */
const ORDER_STEP = 1000;

/* ── 分组映射（两个子代理共用的唯一权威） ─────────────────────────────── */

const GROUPS = [
  { id: 'personal', label: '个人', items: ['账号与余额', '通用设置', '皮肤', '宠物', '使用统计'] },
  { id: 'integrations', label: '集成', items: ['内置插件', 'Web 插件', '订阅服务', '记忆系统', '创意工坊'] },
  { id: 'coding', label: '编码', items: ['模型', 'Agent 预设', 'LLM Verifier'] },
  { id: 'archive', label: '已归档', items: ['已归档会话'] },
];
/**
 * 兜底组：映射里没有的项（第三方插件新注册的设置页、宿主将来新增的页）动态归入，
 * 排在所有已知组之后；该组为空则不渲染。**绝不做硬编码白名单**——这正是用户那条硬约束。
 */
const OTHER_GROUP = { id: 'other', label: '其他' };
/** 标签（小写、去空白）→ 组 id。 */
const GROUP_OF_LABEL = new Map();
/**
 * 组 id → { 标签 → 组内名次 }。
 * **组内顺序以映射表的 items 数组为准，不沿用宿主的注册顺序** —— 映射表是唯一权威。
 * 实测差异就在「集成」组：宿主按 order 渲染出来是
 * 内置插件 / 记忆系统 / 订阅服务 / Web 插件 / 创意工坊，映射表要的是
 * 内置插件 / Web 插件 / 订阅服务 / 记忆系统 / 创意工坊。
 * 兜底组没有名次表，保持宿主原序（未知项只做视觉归拢，不替它决定位置）。
 */
const GROUP_RANK = new Map();
for (const group of GROUPS) {
  const rank = new Map();
  group.items.forEach((item, index) => rank.set(item.trim().toLowerCase(), index));
  GROUP_RANK.set(group.id, rank);
  for (const item of group.items) GROUP_OF_LABEL.set(item.trim().toLowerCase(), group.id);
}
/**
 * 组 id → 该组各项的 **slot id**（与 GROUPS[].items 平行同序）。
 * 为什么要它：宿主侧栏项的**文字是按语言解析出来的**（英文环境把「通用设置」渲染成 "General"），
 * 而 slot id（general / models / plugins …）与语言无关，才是稳定身份。
 * 数据来源：ctx.slots.entries('settings.section')，宿主自己也用它的 options.order 排序渲染，
 * 所以这一串 id 与 navList 里的 button **一一对应、同序**。
 * 都不认识的 id 才回落到标签表；标签也不认识 → 「其他」。
 */
const GROUP_IDS = {
  personal: ['account', 'general', 'skin-center', 'pet', 'dsh-usage'],
  integrations: ['plugins', 'web-ui-plugins', 'subscription-hub', 'dsh-mnemon', 'market'],
  coding: ['models', 'agent-presets', 'llm-verifier'],
  archive: ['archived-sessions', 'dsh-session-archive'],
};
/** slot id → 组 id；以及 slot id → 组内名次。 */
const GROUP_OF_ID = new Map();
const GROUP_RANK_ID = new Map();
for (const group of GROUPS) {
  const rank = new Map();
  (GROUP_IDS[group.id] ?? []).forEach((ids, index) => { GROUP_OF_ID.set(ids, group.id); rank.set(ids, index); });
  GROUP_RANK_ID.set(group.id, rank);
}
/* 英文标签兜底（实测值：English 环境下宿主渲染出来的标签）。id 那条路走通时用不到，
   这是宿主哪天不再暴露 id 时的第二道网。 */
for (const [enLabel, groupId] of [['general', 'personal'], ['models', 'coding'], ['built-in plugins', 'integrations'],
  ['agent presets', 'coding'], ['plugins', 'integrations'], ['subscriptions', 'integrations']]) {
  if (!GROUP_OF_LABEL.has(enLabel)) GROUP_OF_LABEL.set(enLabel, groupId);
}

/** 渲染顺序：已知组按 GROUPS 顺序，兜底组永远最后。 */
const GROUP_SEQUENCE = [...GROUPS, OTHER_GROUP];

/**
 * 插件自有文案：**中英成对**（UX-07）。语言由宿主 locale 决定，不能只写中文 ——
 * 英文环境里「← 返回应用」「搜索设置」会和宿主界面语言打架。
 * 不放进 GROUPS 字面量里：那份字面量是 live 脚本对账契约的一部分（见 settings-modal.mjs 的
 * 前置检查按 { id, label, items } 解析），改形状会把 T01 的对账搞崩。
 */
const TEXT = {
  zh: { back: '返回应用', search: '搜索设置', searchPlaceholder: '搜索设置...', empty: '没有匹配的设置项' },
  en: { back: 'Back to app', search: 'Search settings', searchPlaceholder: 'Search settings...', empty: 'No matching settings' },
};
/** 组标题的英文名，按组 id 查；查不到就回落到 GROUPS 里的中文标签。 */
const GROUP_LABEL_EN = { personal: 'Personal', integrations: 'Integrations', coding: 'Coding', archive: 'Archived', other: 'Other' };

/* ── 小工具 ───────────────────────────────────────────────────────── */

/** 归一化标签：去掉首尾空白并压掉内部连续空白后小写。 */
const normalizeLabel = (text) => String(text).replace(/\s+/g, ' ').trim().toLowerCase();

/** 只警告一次，避免宿主改版时把控制台刷满。 */
const warnOnce = (() => {
  const seen = new Set();
  return (key, ...rest) => {
    if (seen.has(key)) return;
    seen.add(key);
    console.warn('[codex-ui] 设置模态框：' + key, ...rest);
  };
})();

/** 写属性，值没变就不写（避免自己把自己的观察器喂成死循环）。 */
function setAttr(el, name, value) {
  if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}

/** 摘属性，本来就没有就不写。 */
function dropAttr(el, name) {
  if (el.hasAttribute(name)) el.removeAttribute(name);
}

/** 设置 inline order，值没变就不写。 */
function setOrder(el, value) {
  const next = String(value);
  if (el.style.order !== next) el.style.order = next;
}

/** 按 PART_ATTR 在直接子节点里找回自己注入的那一件。 */
const findPart = (parent, part) =>
  Array.prototype.find.call(parent.children, (el) => el !== null && el.getAttribute(PART_ATTR) === part) ?? null;

/** 造一个带标记的注入节点。 */
function makeNode(tag, className, part, text) {
  const el = document.createElement(tag);
  el.className = className;
  el.setAttribute(ATTR, MARK);
  if (part !== null && part !== undefined) el.setAttribute(PART_ATTR, part);
  if (text !== undefined && text !== null) el.textContent = text;
  return el;
}

/** navList 里哪些是宿主项：没带我们标记的直接子节点。 */
const hostChildren = (list) => Array.prototype.filter.call(list.children, (el) => el.getAttribute(ATTR) !== MARK);

/**
 * 取宿主项的可见文本。
 * 固定结构是 <button><svg/><span>文本</span></button>（侦察 §b 实测 13 项无例外）；
 * 但**不把它当硬契约**：拿不到就退到最后一个 span，再不行退到 textContent。
 */
function cellLabel(cell) {
  const kids = cell.children;
  if (kids.length === 2 && kids[0].tagName === 'SVG' && kids[1].tagName === 'SPAN') return kids[1].textContent.trim();
  const last = kids.length > 0 ? kids[kids.length - 1] : null;
  if (last !== null && last.tagName === 'SPAN') return last.textContent.trim();
  return cell.textContent.trim();
}

/** 标签 → 组 id；匹配不上就是兜底组。 */
const groupOfLabel = (label) => GROUP_OF_LABEL.get(normalizeLabel(label)) ?? OTHER_GROUP.id;

/**
 * 归类：**slot id 优先**（与语言无关），取不到再按标签（中/英），都不认识进「其他」。
 * @param label - 宿主项当前语言下的可见文字。
 * @param slotId - 由 sectionIdsByOrder() 对齐出来的 slot id；'undefined' 表示这批不可用。
 * @returns 组 id。
 */
const groupOf = (label, slotId) => (
  slotId !== undefined && slotId !== null && GROUP_OF_ID.has(slotId)
    ? GROUP_OF_ID.get(slotId)
    : groupOfLabel(label)
);

/* ── 面板定位（全部走稳定锚点，找不到就返回 null） ────────────────────── */

/** 找设置面板并补盖自有锚点（幂等）；不在 DOM 里返回 null。 */
function findPanel() {
  const panel = document.querySelector(PANEL_SELECTOR);
  if (panel !== null && panel !== undefined) {
    setAttr(panel, PANEL_ATTR, '');
    return panel;
  }
  /* 设置界面确实开着（设置分区槽已在 DOM 里）却一个锚点都匹配不到 —— 这是整层静默失效的
     唯一路径（宿主改版 / 锚点改名），必须显式警告。设置关着时锚点不在是正常的，不警告。 */
  if (document.querySelector('[data-slot="settings.section"]') !== null) {
    warnOnce('设置界面开着，但两个面板锚点（data-shortcut-modal / data-dsh-surface）都没匹配到 —— 结构层本次失效，宿主可能改版了');
  }
  return null;
}

/** 面板的直接子节点里的侧栏 nav。 */
function findNav(panel) {
  return Array.prototype.find.call(panel.children, (el) => el.tagName === 'NAV') ?? null;
}

/**
 * 侧栏里的设置项列表容器。
 * 侦察 §a 实测 nav.children = [navTitle, navList]，且 navList 恒为最后一个子节点；
 * 我们往 nav 里插的都是**前置**节点，所以「最后一个元素子节点」这条判据在我们注入后依然成立。
 */
function findList(nav) {
  const kids = Array.prototype.filter.call(nav.children, (el) => el.getAttribute(ATTR) !== MARK);
  const last = kids.length > 0 ? kids[kids.length - 1] : null;
  if (last === null || last.tagName !== 'DIV') {
    warnOnce('找不到侧栏列表容器（nav 的最后一个子节点不是 div），本次跳过注入', nav);
    return null;
  }
  return last;
}

/* ── 主流程 ───────────────────────────────────────────────────────── */

/** 当前那一次安装的会话；热重载重复安装时先撤旧的。 */
let active = null;

/**
 * 装上设置模态框的结构层。
 * @param ctx - 客户端上下文（只用它的 effect 做卸载回收，没有也能跑，只是不回收）。
 * @returns {() => void} 卸载函数（幂等；重复调用无副作用）。
 */
function installSettingsModal(ctx) {
  if (typeof document === 'undefined' || document === null) return () => {};
  /* 语言由宿主 locale 决定，插件自有文案成对（UX-07）。认不出就当中文。
     每次取用时现读：切语言会引发 DOM 变更，重放时文案自然刷新。 */
  /* 实测（2026-09-30，真实组合）：ctx.reflect.get('locale') 拿得到 LocaleRuntime
     （reflect=object / getSnapshot 存在），而直接访问 ctx.locale 会 THREW —— 它没在 inject 里声明。
     另：页面载入瞬间快照还是 {"active":"zh"}（revision 25），要等设置文档到达才解析成 en，
     所以文案**必须每次重放都重写**，只写一次会永远停在中文。 */
  const locale = (() => { try { return ctx.reflect.get('locale'); } catch { return null; } })();
  const T = () => (isEnglish(locale) ? TEXT.en : TEXT.zh);
  const groupLabelOf = (group) => (isEnglish(locale) ? (GROUP_LABEL_EN[group.id] ?? group.label) : group.label);
  if (active !== null) {
    try { active.dispose(); } catch { /* 撤不干净也不能阻断新的一次安装 */ }
    active = null;
  }

  const rootNode = document.body !== null && document.body !== undefined ? document.body : document.documentElement;
  /** 当前挂着的 navList；换了一棵就重新挂列表观察器。 */
  let observedList = null;
  /** 当前 navList 上的轻量观察器（只跟直接子节点，不深扫）。 */
  let listObserver = null;
  /** 一个待执行的 rAF 句柄。 */
  let pending = null;
  let disposed = false;

  /** 下一帧跑一次；已经有了就不重复排。 */
  const schedule = (fn) => {
    if (pending !== null || disposed) return;
    pending = requestAnimationFrame(() => {
      pending = null;
      if (disposed) return;
      try { fn(); } catch (error) { warnOnce('重放时出错（已吞掉，不影响宿主）', error); }
    });
  };

  /* ── 侧栏顶部：「← 返回应用」+ 搜索框 ─────────────────────────────── */

  /** 派发一次 Escape，走宿主自己的关闭路径。 */
  function pressEscape() {
    const target = document.activeElement !== null && document.activeElement !== document.body
      ? document.activeElement
      : document.body;
    const init = { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true };
    let event;
    try {
      event = new KeyboardEvent('keydown', init);
    } catch (error) {
      /* 老宿主没有 KeyboardEvent 构造器：造一个普通的、把 key 挂上去。 */
      event = new Event('keydown', { bubbles: true, cancelable: true });
      event.key = 'Escape';
    }
    target.dispatchEvent(event);
  }

  /** 结构上的关闭按钮：侦察 §d 实测 [data-slot="settings.close"] 嵌在按钮内部的 span 里。 */
  function closeButton(panel) {
    const seat = panel.querySelector('[data-slot="settings.close"]');
    const button = seat === null || seat === undefined ? null : seat.closest('button');
    return button;
  }

  /**
   * 关闭设置：优先派发 Escape（侦察实测可用），没关掉再兜底点宿主的关闭按钮。
   * 绝不自己 display:none 藏模态 —— 那会让宿主的状态与界面脱节。
   */
  function requestClose(panel) {
    pressEscape();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (disposed) return;
      /* 面板已消失 = Escape 生效，到此为止；仍存在才走下面的宿主关闭按钮兜底。 */
      if (findPanel() === null) return;
      const button = closeButton(panel);
      if (button === null) {
        warnOnce('Escape 没关掉设置，也找不到结构上的关闭按钮，放弃关闭', panel);
        return;
      }
      button.click();
    }));
  }

  /**
   * 把「插件自有文案」按当前宿主语言重写一遍。
   * 必须在**每次重放**时都跑：运行中切语言不会重建我们注入的节点，
   * 只在创建时写一次的版本会永远停在旧语言（实测：切到 English 后按钮仍写「返回应用」）。
   * 改的都是自有节点的文本/属性，宿主节点一个不碰。
   */
  function relabel(list, back, search) {
    const t = T();
    /* ⚠ 必须「值不同才写」：本函数每次重放都跑，而列表观察器开着 subtree + childList，
       无脑写 textContent 会造出新的 mutation → 观察器再调度 inject → 自触发循环。
       宿主项有自己的收敛性（注释见 observeList），这里要保持同一条不变量。 */
    const setText = (el, text) => { if (el.textContent !== text) el.textContent = text; };
    const setAttrIf = (el, name, value) => { if (el.getAttribute(name) !== value) el.setAttribute(name, value); };
    if (back !== null) {
      setAttrIf(back, 'aria-label', t.back);
      const label = back.querySelector('.cx-sm-back-text');
      if (label !== null) setText(label, t.back);
    }
    if (search !== null) {
      const input = findPart(search, 'search-input');
      if (input !== null) {
        setAttrIf(input, 'placeholder', t.searchPlaceholder);
        setAttrIf(input, 'aria-label', t.search);
      }
    }
    for (const group of GROUP_SEQUENCE) {
      const header = findPart(list, 'group:' + group.id);
      if (header !== null) setText(header, groupLabelOf(group));
    }
    const empty = findPart(list, 'empty');
    if (empty !== null) setText(empty, t.empty);
  }

  /** 建「← 返回应用」。 */
  function makeBack(panel) {
    const back = makeNode('div', 'cx-sm-back', 'back');
    back.setAttribute('role', 'button');
    back.setAttribute('tabindex', '0');
    back.setAttribute('aria-label', T().back);
    const arrow = makeNode('span', 'cx-sm-back-icon', null, '\u2190');
    arrow.setAttribute('aria-hidden', 'true');
    const text = makeNode('span', 'cx-sm-back-text', null, T().back);
    back.appendChild(arrow);
    back.appendChild(text);
    back.addEventListener('click', () => requestClose(panel));
    back.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
      event.preventDefault();
      requestClose(panel);
    });
    return back;
  }

  /** 建搜索框。只过滤，不拦事件：input 上的监听器只服务它自己。 */
  function makeSearch(makeFilter) {
    const box = makeNode('div', 'cx-sm-search', 'search');
    const input = makeNode('input', 'cx-sm-search-input', 'search-input');
    input.setAttribute('type', 'search');
    input.setAttribute('placeholder', T().searchPlaceholder);
    input.setAttribute('aria-label', T().search);
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('spellcheck', 'false');
    const run = () => makeFilter(input.value);
    input.addEventListener('input', run);
    input.addEventListener('search', run);     /* type=search 的原生清除按钮走这条 */
    input.addEventListener('change', run);
    box.appendChild(input);
    return box;
  }

  /** 重新取一次宿主项（列表变了之后 cells 会过期）。 */
  const cellsFrom = (list) => Array.prototype.filter.call(
    list.children,
    (el) => el.getAttribute(ATTR) !== MARK && el.tagName === 'BUTTON',
  );

  /* ── 分组：按组插标题 + 用 flex order 排顺序 ──────────────────────── */

  /**
   * 同步分组标题与顺序。**只写属性与 inline order，不移动任何宿主节点。**
   * @param list - navList。
   * @param cells - 宿主项（保持 DOM 顺序）。
   */
  /**
   * 宿主侧栏项的 slot id 序列：ctx.slots.entries('settings.section') 按 options.order 升序
   * —— 与宿主自己的 rows 排序逐字相同，所以与 navList 里的 button 同序。
   * 读不到就返回空数组，调用方整批回落到标签匹配。
   */
  function sectionIdsByOrder() {
    try {
      const rows = ctx.slots.entries('settings.section');
      if (!Array.isArray(rows)) return [];
      return rows
        .map((entry) => {
          const options = entry === null || entry === undefined ? undefined : entry.options;
          return {
            id: options === undefined || options.id === undefined ? '' : options.id,
            order: options === undefined || options.order === undefined ? 0 : options.order,
          };
        })
        .sort((a, b) => a.order - b.order)
        .map((row) => row.id);
    } catch { return []; }
  }

  function syncGroups(list, cells) {
    if (cells.length === 0) return;
    /* 条数与宿主项对得上才敢按位置对齐 id —— 对不上就整批回落标签匹配。
       宁可退回旧行为，也不能拿着错位的 id 分组。 */
    const ids = sectionIdsByOrder();
    const useIds = ids.length === cells.length;
    const buckets = new Map([[OTHER_GROUP.id, []]]);
    for (const group of GROUPS) buckets.set(group.id, []);
    cells.forEach((cell, domIndex) => {
      const label = cellLabel(cell);
      const slotId = useIds ? ids[domIndex] : undefined;
      const id = groupOf(label, slotId);
      setAttr(cell, GROUP_ATTR, id);
      buckets.get(id).push({ cell, domIndex, label, slotId });
    });
    /* 组内顺序：slot id 有名次就用 id 名次（语言无关），否则回落到标签名次；
       都没写到的（不该有，防御性）排在该组末尾，再按宿主原序。 */
    for (const group of GROUPS) {
      const rank = GROUP_RANK.get(group.id);
      const idRank = GROUP_RANK_ID.get(group.id);
      const members = buckets.get(group.id);
      const rankOf = (m) => {
        if (m.slotId !== undefined && idRank.has(m.slotId)) return idRank.get(m.slotId);
        return rank.get(normalizeLabel(m.label)) ?? Number.MAX_SAFE_INTEGER;
      };
      members.sort((a, b) => rankOf(a) - rankOf(b) || a.domIndex - b.domIndex);
    }
    /* 空组不渲染 —— 「账号与余额」未登录时缺位，组里其余项照常。 */
    const rendered = GROUP_SEQUENCE.filter((group) => buckets.get(group.id).length > 0);

    let slot = ORDER_STEP;
    const liveHeaders = new Set();
    for (const group of rendered) {
      const members = buckets.get(group.id);
      const first = members[0].cell;
      let header = findPart(list, 'group:' + group.id);
      if (header === null) {
        header = makeNode('div', 'cx-sm-group', 'group:' + group.id, groupLabelOf(group));
        header.setAttribute(GROUP_ATTR, group.id);
        header.setAttribute('aria-hidden', 'true');
        list.insertBefore(header, first);
      } else {
        /* 标题是自己的节点，可以自由移动：只在位置不对时才动。
           宿主项一个都不动 —— 组内顺序全靠下面的 flex order 实现。 */
        if (header.nextElementSibling !== first) list.insertBefore(header, first);
        /* ⚠ 比较键必须与写入值同源：早先这里写 group.label（中文），而 relabel() 写本地化名，
           两者互相判定「值变了」→ 每次重放都造 mutation → 观察器自触发振荡。
           统一用 groupLabelOf 之后，收敛与 observeList 的不变量一致。 */
        const headerText = groupLabelOf(group);
        if (header.textContent !== headerText) header.textContent = headerText;
      }
      liveHeaders.add(header);
      setAttr(header, GROUP_ATTR, group.id);
      setOrder(header, slot);
      slot += 1;
      for (const member of members) setOrder(member.cell, slot++);
      slot = Math.ceil(slot / ORDER_STEP) * ORDER_STEP;
    }
    /* 已经不该渲染的组标题（组内项被插件摘走了）撤掉。 */
    for (const el of Array.prototype.slice.call(list.children)) {
      if (el.getAttribute(ATTR) !== MARK) continue;
      if (!String(el.getAttribute(PART_ATTR)).startsWith('group:')) continue;
      if (!liveHeaders.has(el)) el.remove();
    }
  }

  /* ── 页头大标题：Codex 的「大标题 + 页级操作」───────────────────── */

  /**
   * 内容列：面板里除侧栏之外的最后一个直接子节点。
   * 侦察 §a 实测面板 children = [nav, content]，content 恒为最后一个。
   */
  function findContent(panel) {
    const kids = Array.prototype.filter.call(
      panel.children,
      (el) => el.tagName !== 'NAV' && el.getAttribute(ATTR) !== MARK,
    );
    const last = kids.length > 0 ? kids[kids.length - 1] : null;
    if (last === null || last.tagName !== 'DIV') {
      warnOnce('找不到内容列（面板最后一个子节点不是 div），本次跳过页头', panel);
      return null;
    }
    return last;
  }

  /**
   * 内容列顶部的 header 行。
   * 判据用**语义座位**而不是位置：里面装着 [data-slot="settings.action"]（宿主唯一稳定的动作座位，侦察 §d）。
   * 判据不成立就返回 null，调用方降级到「插在 options 之前」。
   */
  function findHeader(content) {
    return Array.prototype.find.call(
      content.children,
      (el) => el.getAttribute(ATTR) !== MARK && el.querySelector('[data-slot="settings.action"]') !== null,
    ) ?? null;
  }

  /** 设置页正文容器（滚动区）：装着设置页座位 [data-slot="settings.section"] 的那个子节点。 */
  function findOptions(content, header) {
    const rest = Array.prototype.filter.call(
      content.children,
      (el) => el !== header && el.getAttribute(ATTR) !== MARK,
    );
    return rest.find((el) => el.querySelector('[data-slot="settings.section"]') !== null) ?? rest[0] ?? null;
  }

  /**
   * 当前激活项的标签。
   * 选中态 = aria-current="true"：宿主自己的语义属性（侦察 §b 实测），比哈希类名稳。
   * 兜底顺序：aria-current → data-modal-autofocus → 第一项。
   */
  function activeLabel(cells) {
    const pick = (pred) => {
      for (const cell of cells) if (pred(cell)) return cellLabel(cell);
      return null;
    };
    return pick((cell) => cell.getAttribute('aria-current') === 'true')
      ?? pick((cell) => cell.hasAttribute('data-modal-autofocus'))
      ?? (cells.length > 0 ? cellLabel(cells[0]) : null);
  }

  /** 建页头：div.cx-sm-pagehead > div.cx-sm-title（形态对齐 settings-modal.css §3.2）。 */
  function makePagehead() {
    const head = makeNode('div', 'cx-sm-pagehead', 'pagehead');
    head.appendChild(makeNode('div', 'cx-sm-title', 'pagehead-title'));
    return head;
  }

  /**
   * 同步页头：位置 + 标题文本。
   * 首选挂在 header 行的**最左侧**（与右上角「打开配置文件 ×」同一行，正对 Codex 的
   * 「大标题 + 页级操作」）；header 判据不成立时降级为插在 options 之前；两者都不成立就 warn 跳过。
   */
  function syncPagehead(panel, content, cells) {
    const header = findHeader(content);
    let target = null;
    let before = null;
    if (header !== null) {
      target = header;
      before = header.firstChild;
    } else {
      const options = findOptions(content, null);
      if (options !== null) {
        warnOnce('设置面板的 header 行判据不成立，页头降级插在 options 之前', content);
        target = content;
        before = options;
      }
    }
    if (target === null) {
      warnOnce('找不到能挂页头的位置，本次跳过（只是没有大标题，其余注入照常）', content);
      return;
    }
    let head = panel.querySelector('[' + PART_ATTR + '="pagehead"]');
    if (head === null) {
      head = makePagehead();
      target.insertBefore(head, before);
    } else if (head.parentNode !== target) {
      /* 只搬自己的节点，宿主节点一个不动。 */
      target.insertBefore(head, before);
    }
    const title = findPart(head, 'pagehead-title');
    const label = activeLabel(cells);
    if (title !== null && label !== null && title.textContent !== label) title.textContent = label;
  }

  /* ── 搜索过滤：只加显隐，不移除/替换宿主节点 ──────────────────────── */

  /** 写隐藏态；值没变就不写（否则会把自己的观察器喂成死循环）。 */
  function setHidden(el, hidden) {
    if (hidden) {
      setAttr(el, HIDDEN_ATTR, '');
      if (!el.classList.contains(HIDDEN_CLASS)) el.classList.add(HIDDEN_CLASS);
    } else {
      dropAttr(el, HIDDEN_ATTR);
      if (el.classList.contains(HIDDEN_CLASS)) el.classList.remove(HIDDEN_CLASS);
    }
  }

  /**
   * 按 query 过滤侧栏项。空查询 = 全部恢复。
   * @param list - navList。
   * @param query - 搜索框当前值。
   */
  function applyFilter(list, query) {
    const cells = cellsFrom(list);
    const needle = normalizeLabel(query);
    const visible = new Map();
    for (const cell of cells) {
      const hit = needle === '' || cellLabel(cell).toLowerCase().includes(needle);
      setHidden(cell, !hit);
      if (hit) {
        const id = cell.getAttribute(GROUP_ATTR) ?? OTHER_GROUP.id;
        visible.set(id, (visible.get(id) ?? 0) + 1);
      }
    }
    /* 空分组标题也隐藏：标题的可见性只跟「这一组还有没有命中项」有关。 */
    for (const el of Array.prototype.slice.call(list.children)) {
      if (el.getAttribute(ATTR) !== MARK) continue;
      if (!String(el.getAttribute(PART_ATTR)).startsWith('group:')) continue;
      setHidden(el, (visible.get(el.getAttribute(GROUP_ATTR)) ?? 0) === 0);
    }
    /* 无结果提示：.cx-sm-empty 只在「有查询且一项都没命中」时露出来；
       顺序上也必须钉在最后——flex 默认 order:0，不写这一条它会被排到分组前面去。 */
    let total = 0;
    for (const count of visible.values()) total += count;
    const needed = needle !== '' && total === 0;
    let empty = findPart(list, 'empty');
    if (needed && empty === null) {
      empty = makeNode('div', 'cx-sm-empty', 'empty', T().empty);
      empty.setAttribute('role', 'status');
      list.appendChild(empty);
    }
    if (empty !== null) {
      setOrder(empty, TAIL_ORDER);
      setHidden(empty, !needed);
    }
  }

  /* ── 注入 / 重放 ─────────────────────────────────────────────────── */

  /**
   * 把当前 navList 挂上观察器。它一处扛三件事：
   *   ① 列表增删 —— 插件热插拔设置项时重跑分组与「其他」兜底组；
   *   ② 补回被宿主抹掉的 cx-sm-hidden 类名（耐久标记仍是属性，类名只是给 CSS 的便利钩子）；
   *   ③ **切项时刷新页头标题** —— 宿主把选中态从一项搬到另一项时写的就是 class + aria-current。
   *
   * ⚠ **subtree 是必需项，不是优化**（probe4 双向对照实测）：
   *   MutationObserver 不开 subtree 时，只上报被观察节点自己的属性变化；
   *   navCell 是 navList 的子节点，它们的 class / aria-current 改写一条都收不到 ——
   *   同一时刻不开 subtree 收 0 条、开 subtree 收 5 条。
   *   漏掉它的表现是静默失效：aria-current 变了、页头标题纹丝不动，其余功能全部正常。
   *
   * 不会自激：本文件写自己的属性一律「值没变就不写」（setAttr / setOrder / setHidden），
   * 且 attributeFilter 只认 class 与 aria-current —— 我们自己从不写 aria-current，
   * 也只在隐藏态真的翻转时才动 class，第一轮之后没有新 mutation 可喂给自己（实测收敛）。
   */
  function observeList(list) {
    if (observedList === list && listObserver !== null) return;
    if (listObserver !== null) listObserver.disconnect();
    observedList = list;
    listObserver = new MutationObserver(() => schedule(inject));
    listObserver.observe(list, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'aria-current'],
    });
  }

  /**
   * 重放：找面板 → 补侧栏顶部两件 → 同步分组 → 重挂过滤。
   * 每一步都自带「已经在了就跳过」，所以重复跑不会叠加节点。
   */
  function inject() {
    const panel = findPanel();
    if (panel === null) {
      /* 面板没了：列表观察器跟着失效，断开等下一次重放。 */
      if (listObserver !== null) { listObserver.disconnect(); listObserver = null; observedList = null; }
      return;
    }
    const nav = findNav(panel);
    if (nav === null) {
      warnOnce('设置面板里没有侧栏 nav，本次跳过注入', panel);
      return;
    }
    const list = findList(nav);
    if (list === null) return;
    const cells = cellsFrom(list);
    if (cells.length === 0) {
      warnOnce('侧栏列表里一个设置项都没有，本次跳过分组', list);
      return;
    }
    /* 结构自检：宿主项本该都是 button。出现别的就跳过它，只 warn 不抛。 */
    for (const el of hostChildren(list)) {
      if (el.tagName !== 'BUTTON') warnOnce('侧栏列表里出现了非 button 的子节点，已跳过它（宿主可能改版了）', el);
    }

    /* 返回按钮与搜索框：都放在 nav 的最前面（返回在最上，搜索在它下面）。
       它们排在宿主的「设置」标题之前 —— 只加不挪，宿主原有节点一个不动。 */
    let back = findPart(nav, 'back');
    if (back === null) {
      back = makeBack(panel);
      nav.insertBefore(back, nav.firstChild);
    }
    let search = findPart(nav, 'search');
    if (search === null) {
      search = makeSearch((value) => {
        const current = findList(nav);
        if (current !== null) applyFilter(current, value);
      });
      nav.insertBefore(search, back.nextSibling);
    }

    relabel(list, back, search);
    syncGroups(list, cells);
    const content = findContent(panel);
    if (content !== null) syncPagehead(panel, content, cells);
    const input = findPart(search, 'search-input');
    applyFilter(list, input !== null ? input.value : '');
    observeList(list);
  }

  /* ── 观察 body：面板被卸载/重建时重放 ─────────────────────────────── */

  /* subtree 按任务书开着（防宿主将来给 overlay 套一层壳），但回调里只认 target 就是 body 的
     childList 记录 —— 宿主 overlay 是 body 的直接子节点（侦察 §a + 本次探针复核），
     所以这一条 O(1) 过滤会把页面上其它所有 mutation 全部丢掉，不做任何 DOM 查询。 */
  const bodyObserver = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type !== 'childList') continue;
      if (record.target !== rootNode) continue;
      schedule(inject);
      return;
    }
  });
  bodyObserver.observe(rootNode, { childList: true, subtree: true });

  inject();

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    if (pending !== null) { cancelAnimationFrame(pending); pending = null; }
    if (listObserver !== null) { listObserver.disconnect(); listObserver = null; }
    bodyObserver.disconnect();
    observedList = null;
    /* 注入节点一律带标记，一次清干净；宿主节点只把「我们写上去的那几个属性」摘掉。 */
    for (const el of Array.prototype.slice.call(document.querySelectorAll('[' + ATTR + '="' + MARK + '"]'))) el.remove();
    for (const el of Array.prototype.slice.call(document.querySelectorAll('[' + GROUP_ATTR + ']'))) {
      dropAttr(el, GROUP_ATTR);
      el.style.removeProperty('order');
    }
    for (const el of Array.prototype.slice.call(document.querySelectorAll('[' + HIDDEN_ATTR + ']'))) {
      dropAttr(el, HIDDEN_ATTR);
      el.classList.remove(HIDDEN_CLASS);
    }
    if (active !== null && active.dispose === dispose) active = null;
  };

  if (typeof ctx.effect === 'function') {
    ctx.effect(() => dispose, 'codex-ui: settings modal');
  } else {
    console.warn('[codex-ui] ctx.effect 不可用：设置模态框结构层已挂上，但不会随 fiber 卸载回收。');
  }

  active = { dispose };
  return dispose;
}
return { installSettingsModal };
})();

/* codex-ui:theme.css */
const __codex_ui_theme_css = (() => {
const THEME_CSS = "html[data-codex-ui],\nhtml[data-codex-ui] body {\n  color-scheme: light;\n\n  background-color: #ffffff;\n\n  --dsw-alias-bg-base: #ffffff;\n\n  --dsw-alias-bg-sidebar: #f6f6f6;\n  --dsw-alias-bg-layer-1: #ffffff;\n  --dsw-alias-bg-layer-2: #f1f1ef;\n  --dsw-alias-bg-layer-3: #e5e5e5;\n  --dsw-alias-bg-overlay: rgba(255, 255, 255, 0.88);\n  --dsw-alias-bg-module-platform: #f9f9f9;\n  --dsw-alias-bg-multi-select: #e5e5e5;\n  --dsw-alias-bg-skeleton: rgba(13, 13, 13, 0.05);\n\n  --dsw-alias-border-l1: rgba(13, 13, 13, 0.07);\n  --dsw-alias-border-l2: rgba(13, 13, 13, 0.12);\n  --dsw-alias-border-l3: rgba(13, 13, 13, 0.18);\n  --dsw-alias-border-l4: rgba(13, 13, 13, 0.24);\n  --dsw-alias-border-l2-darkmode-thin: rgba(13, 13, 13, 0.09);\n\n  --dsw-alias-label-primary: #1a1c1f;\n  --dsw-alias-label-primary-dimmed: #5d5d5d;\n  --dsw-alias-label-primary-inverted: #ffffff;\n  --dsw-alias-label-primary-foreground: #ffffff;\n  --dsw-alias-label-primary-bluish: #0d0d0d;\n  --dsw-alias-label-secondary: #5d5d5d;\n  --dsw-alias-label-tertiary: #767676;\n  --dsw-alias-label-caption: #767676;\n  --dsw-alias-label-dimmed: #c9c9c9;\n\n  --dsw-alias-brand-primary: #0d0d0d;\n  --dsw-alias-brand-primary-invert: #ffffff;\n  --dsw-alias-brand-text: #ffffff;\n  --dsw-alias-brand-primary-new-colorprimary-new-color: #0d0d0d;\n  --dsw-alias-link: #339cff;\n\n  --dsw-alias-button-primary-fill: #0d0d0d;\n  --dsw-alias-button-primary-hover: #2a2a2a;\n  --dsw-alias-button-primary-dimmed: #e5e5e5;\n  --dsw-alias-button-contrast-fill: #0d0d0d;\n  --dsw-alias-button-elevated-fill: #ffffff;\n  --dsw-alias-button-floating-fill: #ffffff;\n  --dsw-alias-button-floating-hover: #f1f1ef;\n  --dsw-alias-button-ghost-active-fill: #e5e5e5;\n  --dsw-alias-button-ghost-active-hover: #dcdcdc;\n  --dsw-alias-button-ghost-active-border: #8f8f8f;\n  --dsw-alias-button-info-fill: #0d0d0d;\n  --dsw-alias-button-info-hover: #2a2a2a;\n  --dsw-alias-button-tool-bar-fill: rgba(13, 13, 13, 0.28);\n  --dsw-alias-button-tool-bar-fill-invisible: rgba(13, 13, 13, 0.18);\n  --dsw-alias-button-tool-bar-hover: rgba(13, 13, 13, 0.36);\n\n  --dsw-alias-interactive-bg-hover: rgba(13, 13, 13, 0.04);\n  --dsw-codex-hover-fill: #f2f2f3;\n  --dsw-codex-focus: #339cff;\n\n  --dsw-focus-ring-color: var(--dsw-codex-focus);\n\n  --dsw-codex-border: rgba(13, 13, 13, 0.1);\n  --dsw-codex-border-strong: rgba(13, 13, 13, 0.15);\n  --dsw-alias-interactive-bg-active: rgba(13, 13, 13, 0.08);\n  --dsw-alias-interactive-bg-hover-solid: #f1f1ef;\n  --dsw-alias-interactive-bg-hover-accent: rgba(13, 13, 13, 0.06);\n  --dsw-alias-interactive-bg-hover-danger: rgba(209, 36, 47, 0.08);\n\n  --dsw-alias-markdown-code-block: #f1f1ef;\n  --dsw-alias-markdown-code-block-banner: #e5e5e5;\n  --dsw-alias-markdown-inline-code: #f1f1ef;\n  --dsw-alias-markdown-code-segment-selected: #ffffff;\n  --dsw-alias-markdown-code-segment-unselected: #f1f1ef;\n  --dsw-alias-markdown-citation: #f1f1ef;\n  --dsw-alias-markdown-placeholder: #e5e5e5;\n  --dsw-alias-markdown-tag: #f1f1ef;\n\n  --dsw-alias-state-success-primary: #1a7f37;\n  --dsw-alias-state-success-secondary: #2e9e4c;\n  --dsw-alias-state-success-tertiary: rgba(26, 127, 55, 0.08);\n  --dsw-alias-state-error-primary: #d1242f;\n  --dsw-alias-state-error-secondary: #e5484d;\n  --dsw-alias-state-error-tertiary: rgba(209, 36, 47, 0.08);\n  --dsw-alias-state-warn-primary: #8f5f00;\n  --dsw-alias-state-warn-secondary: #bb8009;\n  --dsw-alias-state-warn-tertiary: rgba(143, 95, 0, 0.08);\n  --dsw-alias-state-warn-label: #8f5f00;\n  --dsw-alias-state-business-primary: #0d0d0d;\n  --dsw-alias-state-business-tertiary: rgba(13, 13, 13, 0.08);\n  --dsw-alias-state-idle-primary: #767676;\n\n  --dsw-alias-code-diff-added: rgba(26, 127, 55, 0.1);\n  --dsw-alias-code-diff-deleted: rgba(209, 36, 47, 0.1);\n  --dsw-alias-file-diff-added-bg: #e6f4e7;\n  --dsw-alias-file-diff-added-gutter: #edf7ed;\n  --dsw-alias-file-diff-added-marker: #1a7f37;\n  --dsw-alias-file-diff-deleted-bg: #fce6e2;\n  --dsw-alias-file-diff-deleted-gutter: #fdece9;\n  --dsw-alias-file-diff-deleted-marker: #d1242f;\n\n  --dsw-alias-bg-mask-drop: rgba(255, 255, 255, 0.7);\n  --dsw-alias-toast-bg: #1e1e1e;\n  --dsw-alias-tooltip-bg: #1e1e1e;\n  --dsw-alias-tooltip-fg: #ffffff;\n  --dsw-alias-hovercard-bg: #ffffff;\n\n  --dsw-alias-scrollbar-bg-l1: rgba(118, 118, 118, 0.3);\n  --dsw-alias-scrollbar-bg-l2: rgba(118, 118, 118, 0.5);\n  --dsw-alias-scrollbar-hover-l1: rgba(13, 13, 13, 0.35);\n  --dsw-alias-scrollbar-hover-l2: rgba(13, 13, 13, 0.5);\n\n  --dsw-specific-sidebar-fill: #f6f6f6;\n  --dsw-specific-sidebar-nav-item-hover: #f0f0f0;\n  --dsw-specific-sidebar-nav-item-active: #e9e9e9;\n  --dsw-specific-sidebar-nav-item-active-accent: rgba(13, 13, 13, 0.1);\n  --dsw-specific-input-major: #ffffff;\n  --dsw-composer-surface: #ffffff;\n  --dsw-specific-login-input: #f9f9f9;\n  --dsw-specific-menu: rgba(255, 255, 255, 0.88);\n  --dsw-specific-selector: #f1f1ef;\n  --dsw-specific-bubble: #f1f1ef;\n  --dsw-specific-bubble-highlight: #e5e5e5;\n  --dsw-specific-tip: #f1f1ef;\n\n  --dsw-shadow-lv1: 0 1px 2px rgba(13, 13, 13, 0.06);\n  --dsw-shadow-lv2: 0 2px 8px rgba(13, 13, 13, 0.08);\n  --dsw-shadow-lv3: 0 8px 24px rgba(13, 13, 13, 0.1);\n  --dsw-linear-gradient-think: linear-gradient(180deg, #ffffff 20.19%, rgba(255, 255, 255, 0) 100%);\n  --dsw-linear-think-select: linear-gradient(180deg, #f1f1ef 20.19%, rgba(241, 241, 239, 0) 100%);\n\n  --dsw-codex-ambient: rgba(13, 13, 13, 0.05);\n  --dsw-codex-menu-shadow: 0 8px 32px rgba(13, 13, 13, 0.13), 0 0 0 1px rgba(13, 13, 13, 0.04);\n  --dsw-codex-suggest-shadow: 0 8px 32px #0002, 0 0 0 1px #0000000a;\n  --dsw-codex-suggest-fill: #fff;\n}\n\nhtml[data-codex-ui-switching] *,\nhtml[data-codex-ui-switching] *::before,\nhtml[data-codex-ui-switching] *::after {\n  transition: none !important;\n}\n\nhtml[data-codex-ui]:has(body[data-ds-dark-theme]) {\n  background-color: #111111;\n}\n\nhtml[data-codex-ui] body[data-ds-dark-theme] {\n  color-scheme: dark;\n  background-color: #111111;\n\n  --dsw-alias-bg-base: #111111;\n  --dsw-alias-bg-sidebar: #0f0f0f;\n  --dsw-alias-bg-layer-1: #212121;\n  --dsw-alias-bg-layer-2: #282828;\n  --dsw-alias-bg-layer-3: #303030;\n  --dsw-alias-bg-overlay: rgba(24, 24, 24, 0.88);\n  --dsw-alias-bg-module-platform: #1f1f1f;\n  --dsw-alias-bg-multi-select: #303030;\n  --dsw-alias-bg-skeleton: rgba(255, 255, 255, 0.07);\n\n  --dsw-alias-border-l1: rgba(255, 255, 255, 0.08);\n  --dsw-alias-border-l2: rgba(255, 255, 255, 0.14);\n  --dsw-alias-border-l3: rgba(255, 255, 255, 0.2);\n  --dsw-alias-border-l4: rgba(255, 255, 255, 0.26);\n  --dsw-alias-border-l2-darkmode-thin: rgba(255, 255, 255, 0.1);\n\n  --dsw-alias-label-primary: #ffffff;\n  --dsw-alias-label-primary-dimmed: #b4b4b4;\n  --dsw-alias-label-primary-inverted: #0d0d0d;\n  --dsw-alias-label-primary-foreground: #0d0d0d;\n  --dsw-alias-label-primary-bluish: #ececec;\n  --dsw-alias-label-secondary: #b4b4b4;\n  --dsw-alias-label-tertiary: #949494;\n  --dsw-alias-label-caption: #949494;\n  --dsw-alias-label-dimmed: #4a4a4a;\n\n  --dsw-alias-brand-primary: #ffffff;\n  --dsw-alias-brand-primary-invert: #0d0d0d;\n  --dsw-alias-brand-text: #0d0d0d;\n  --dsw-alias-brand-primary-new-colorprimary-new-color: #ffffff;\n  --dsw-alias-link: #0169cc;\n\n  --dsw-alias-button-primary-fill: #ffffff;\n  --dsw-alias-button-primary-hover: #d9d9d9;\n  --dsw-alias-button-primary-dimmed: #282828;\n  --dsw-alias-button-contrast-fill: #ececec;\n  --dsw-alias-button-elevated-fill: #212121;\n  --dsw-alias-button-floating-fill: #1f1f1f;\n  --dsw-alias-button-floating-hover: #282828;\n  --dsw-alias-button-ghost-active-fill: #303030;\n  --dsw-alias-button-ghost-active-hover: #383838;\n  --dsw-alias-button-ghost-active-border: #7e7e7e;\n  --dsw-alias-button-info-fill: #ffffff;\n  --dsw-alias-button-info-hover: #d9d9d9;\n  --dsw-alias-button-tool-bar-fill: rgba(255, 255, 255, 0.22);\n  --dsw-alias-button-tool-bar-fill-invisible: rgba(255, 255, 255, 0.16);\n  --dsw-alias-button-tool-bar-hover: rgba(255, 255, 255, 0.28);\n\n  --dsw-alias-interactive-bg-hover: rgba(255, 255, 255, 0.06);\n  --dsw-codex-hover-fill: rgba(255, 255, 255, 0.08);\n  --dsw-codex-focus: rgba(51, 156, 255, 0.7);\n  --dsw-codex-border: rgba(255, 255, 255, 0.12);\n  --dsw-codex-border-strong: rgba(255, 255, 255, 0.2);\n  --dsw-alias-interactive-bg-active: rgba(255, 255, 255, 0.1);\n  --dsw-alias-interactive-bg-hover-solid: #282828;\n  --dsw-alias-interactive-bg-hover-accent: rgba(255, 255, 255, 0.08);\n  --dsw-alias-interactive-bg-hover-danger: rgba(248, 81, 73, 0.12);\n\n  --dsw-alias-markdown-code-block: #1f1f1f;\n  --dsw-alias-markdown-code-block-banner: #141414;\n  --dsw-alias-markdown-inline-code: #282828;\n  --dsw-alias-markdown-code-segment-selected: #303030;\n  --dsw-alias-markdown-code-segment-unselected: #1f1f1f;\n  --dsw-alias-markdown-citation: #212121;\n  --dsw-alias-markdown-placeholder: #282828;\n  --dsw-alias-markdown-tag: #282828;\n\n  --dsw-alias-state-success-primary: #3fb950;\n  --dsw-alias-state-success-secondary: #56d364;\n  --dsw-alias-state-success-tertiary: rgba(63, 185, 80, 0.16);\n  --dsw-alias-state-error-primary: #ff7b72;\n  --dsw-alias-state-error-secondary: #ff9492;\n  --dsw-alias-state-error-tertiary: rgba(255, 123, 114, 0.16);\n  --dsw-alias-state-warn-primary: #d29922;\n  --dsw-alias-state-warn-secondary: #e3b341;\n  --dsw-alias-state-warn-tertiary: rgba(210, 153, 34, 0.16);\n  --dsw-alias-state-warn-label: #d29922;\n  --dsw-alias-state-business-primary: #ececec;\n  --dsw-alias-state-business-tertiary: rgba(255, 255, 255, 0.12);\n  --dsw-alias-state-idle-primary: #7e7e7e;\n\n  --dsw-alias-code-diff-added: rgba(63, 185, 80, 0.14);\n  --dsw-alias-code-diff-deleted: rgba(248, 81, 73, 0.14);\n  --dsw-alias-file-diff-added-bg: #1f3124;\n  --dsw-alias-file-diff-added-gutter: #132016;\n  --dsw-alias-file-diff-added-marker: #41c977;\n  --dsw-alias-file-diff-deleted-bg: #3c1f1b;\n  --dsw-alias-file-diff-deleted-gutter: #28130e;\n  --dsw-alias-file-diff-deleted-marker: #fa423e;\n\n  --dsw-alias-bg-mask-drop: rgba(39, 39, 48, 0.7);\n  --dsw-alias-toast-bg: #282828;\n  --dsw-alias-tooltip-bg: #212121;\n  --dsw-alias-tooltip-fg: #ececec;\n  --dsw-alias-hovercard-bg: #212121;\n\n  --dsw-alias-scrollbar-bg-l1: rgba(160, 160, 160, 0.3);\n  --dsw-alias-scrollbar-bg-l2: rgba(160, 160, 160, 0.5);\n  --dsw-alias-scrollbar-hover-l1: rgba(255, 255, 255, 0.35);\n  --dsw-alias-scrollbar-hover-l2: rgba(255, 255, 255, 0.5);\n\n  --dsw-specific-sidebar-fill: #0f0f0f;\n  --dsw-specific-sidebar-nav-item-hover: #171717;\n  --dsw-specific-sidebar-nav-item-active: #1f1f1f;\n  --dsw-specific-sidebar-nav-item-active-accent: rgba(255, 255, 255, 0.14);\n  --dsw-specific-input-major: #212121;\n  --dsw-composer-surface: #181818;\n  --dsw-specific-login-input: #1f1f1f;\n  --dsw-specific-menu: rgba(24, 24, 24, 0.88);\n  --dsw-specific-selector: #282828;\n  --dsw-specific-bubble: #212121;\n  --dsw-specific-bubble-highlight: #282828;\n  --dsw-specific-tip: #1f1f1f;\n\n  --dsw-shadow-lv1: 0 1px 2px rgba(0, 0, 0, 0.4);\n  --dsw-shadow-lv2: 0 2px 8px rgba(0, 0, 0, 0.5);\n  --dsw-shadow-lv3: 0 8px 24px rgba(0, 0, 0, 0.6);\n  --dsw-linear-gradient-think: linear-gradient(180deg, #212121 20.19%, rgba(33, 33, 33, 0) 100%);\n  --dsw-linear-think-select: linear-gradient(180deg, #1f1f1f 20.19%, rgba(40, 40, 40, 0) 100%);\n\n  --dsw-codex-ambient: rgba(0, 0, 0, 0.5);\n  --dsw-codex-menu-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(236, 236, 236, 0.05);\n  --dsw-codex-suggest-shadow: 0 8px 32px #0003, 0 0 0 1px #ffffff08;\n  --dsw-codex-suggest-fill: #292929;\n}\n\nhtml[data-codex-ui],\nhtml[data-codex-ui] body {\n  --dsw-space-1: 4px;\n  --dsw-space-2: 8px;\n  --dsw-space-3: 12px;\n  --dsw-space-4: 16px;\n  --dsw-space-5: 20px;\n  --dsw-space-6: 24px;\n  --dsw-space-8: 32px;\n\n  --dsw-radius-xs: 4px;\n  --dsw-radius-s: 8px;\n  --dsw-radius-m: 12px;\n  --dsw-radius-l: 16px;\n  --dsw-radius-xl: 20px;\n  --dsw-radius-2xl: 25px;\n  --dsw-radius-menu: 18px;\n\n  --dsw-radius-card: var(--dsw-radius-xl);\n  --dsw-radius-pill: 999px;\n\n  --dsw-content-max-width: 768px;\n\n  --dsw-text-2xs: 11px;\n  --dsw-text-xs: 12.5px;\n  --dsw-text-sm: 13px;\n  --dsw-text-base: 14px;\n  --dsw-text-lg: 16px;\n  --dsw-text-xl: 20px;\n  --dsw-text-2xl: 28px;\n  --dsw-leading-2xs: 1.3;\n  --dsw-leading-xs: 1.4;\n  --dsw-leading-base: 1.65;\n  --dsw-leading-lg: 1.4;\n  --dsw-leading-xl: 1.35;\n  --dsw-leading-2xl: 1.25;\n\n  --dsw-font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", \"PingFang SC\",\n    \"Hiragino Sans GB\", \"Microsoft YaHei\", \"Helvetica Neue\", Helvetica, Arial, sans-serif;\n  --ds-font-family-code: \"SF Mono\", \"JetBrains Mono\", \"Fira Code\", Consolas,\n    \"Liberation Mono\", Menlo, Courier, \"PingFang SC\", \"Microsoft YaHei\";\n\n  --dsw-font-meta: var(--ds-font-family-code);\n  --dsw-meta-size: 11px;\n  --dsw-meta-weight: 500;\n  --dsw-meta-tracking: 0.08em;\n  --dsw-meta-tracking-pill: 0.04em;\n\n  --dsw-motion-fast: 150ms;\n  --dsw-motion-base: 200ms;\n  --dsw-motion-slow: 300ms;\n  --dsw-ease: cubic-bezier(0.4, 0, 0.2, 1);\n\n  --dsh-composer-accessory-radius: var(--dsw-radius-l);\n  --dsh-composer-accessory-bg: var(--dsw-alias-bg-layer-2);\n  --dsh-composer-accessory-color: var(--dsw-alias-label-secondary);\n  --dsh-composer-accessory-border: 0.5px solid var(--dsw-alias-border-l1);\n  --dsh-composer-accessory-shadow: none;\n  --dsh-composer-accessory-blur: 0px;\n}\n\n@supports (corner-shape: superellipse(1.5)) {\n  html[data-codex-ui],\nhtml[data-codex-ui] body {\n    --dsw-radius-card: var(--dsw-radius-2xl);\n  }\n}\n\nhtml[data-codex-ui] body,\nhtml[data-codex-ui] body * {\n  --dsw-elevation-stroke-color: rgba(13, 13, 13, 0.08);\n  --dsw-elevation-stroke: 0 0 0 0.5px var(--dsw-elevation-stroke-color);\n  --dsw-elevation-panel: var(--dsw-elevation-stroke);\n\n  --dsw-elevation-prominent: var(--dsw-elevation-stroke), 0 3px 7.5px #0000000a, 0 0 20px #0000000d;\n}\n\nhtml[data-codex-ui] body[data-ds-dark-theme],\nhtml[data-codex-ui] body[data-ds-dark-theme] * {\n  --dsw-elevation-stroke-color: rgba(255, 255, 255, 0.09);\n}\n\nhtml[data-codex-ui],\nhtml[data-codex-ui] body {\n  --dsw-font-markdown-h1: 600 calc(21px + var(--dsh-content-font-delta)) / calc(30px + var(--dsh-content-font-delta)) var(--dsw-font-family);\n  --dsw-font-markdown-h1-font-weight: 600;\n  --dsw-font-markdown-h2: 600 calc(19px + var(--dsh-content-font-delta)) / calc(28px + var(--dsh-content-font-delta)) var(--dsw-font-family);\n  --dsw-font-markdown-h2-font-weight: 600;\n  --dsw-font-markdown-h3: 600 calc(18px + var(--dsh-content-font-delta)) / calc(26px + var(--dsh-content-font-delta)) var(--dsw-font-family);\n  --dsw-font-markdown-h3-font-weight: 600;\n}\n\nhtml[data-codex-ui] :focus-visible {\n  outline: 2px solid var(--dsw-focus-ring-color);\n  outline-offset: 2px;\n}\n\nhtml[data-codex-ui] a {\n  color: inherit;\n  text-decoration: underline;\n  text-decoration-style: dotted;\n  text-decoration-color: currentColor;\n  text-decoration-thickness: 1px;\n  text-underline-offset: 2px;\n}\n\nhtml[data-codex-ui] button a,\nhtml[data-codex-ui] [role=\"button\"] a,\nhtml[data-codex-ui] [role=\"menuitem\"],\nhtml[data-codex-ui] [role=\"tab\"] a,\nhtml[data-codex-ui] nav a {\n  text-decoration: none;\n}\n\nhtml[data-codex-ui] [data-dsh-part=\"prose\"] a,\nhtml[data-codex-ui] [data-dsh-part=\"article\"] a {\n  color: var(--dsw-alias-link);\n  text-decoration: none;\n  text-underline-offset: 2px;\n  text-decoration-thickness: 1px;\n}\n\nhtml[data-codex-ui] [data-dsh-part=\"prose\"] a:hover,\nhtml[data-codex-ui] [data-dsh-part=\"prose\"] a:focus-visible,\nhtml[data-codex-ui] [data-dsh-part=\"article\"] a:hover,\nhtml[data-codex-ui] [data-dsh-part=\"article\"] a:focus-visible {\n  text-decoration: underline;\n  text-decoration-style: solid;\n}\n\nhtml[data-codex-ui] button,\nhtml[data-codex-ui] a,\nhtml[data-codex-ui] summary,\nhtml[data-codex-ui] [role=\"button\"],\nhtml[data-codex-ui] [role=\"tab\"],\nhtml[data-codex-ui] [role=\"menuitem\"],\nhtml[data-codex-ui] [role=\"option\"] {\n  cursor: pointer;\n}\n\nhtml[data-codex-ui] button,\nhtml[data-codex-ui] a,\nhtml[data-codex-ui] summary,\nhtml[data-codex-ui] [role=\"button\"],\nhtml[data-codex-ui] [role=\"tab\"],\nhtml[data-codex-ui] [role=\"menuitem\"] {\n  transition:\n    background-color var(--dsw-motion-fast) var(--dsw-ease),\n    border-color var(--dsw-motion-fast) var(--dsw-ease),\n    color var(--dsw-motion-fast) var(--dsw-ease),\n    opacity var(--dsw-motion-fast) var(--dsw-ease),\n    box-shadow var(--dsw-motion-fast) var(--dsw-ease);\n}\n\nhtml[data-codex-ui] button:disabled,\nhtml[data-codex-ui] button[aria-disabled=\"true\"],\nhtml[data-codex-ui] [aria-disabled=\"true\"] {\n  cursor: not-allowed;\n  opacity: 0.45;\n}\n\nhtml[data-codex-ui] [data-slot=\"web-ui.plugin.item\"] > *,\nhtml[data-codex-ui] [data-dsh-part=\"card\"],\nhtml[data-codex-ui] [data-dsh-part=\"column\"],\nhtml[data-codex-ui] [data-dsh-part=\"status\"],\nhtml[data-codex-ui] [data-dsh-part=\"today-card\"],\nhtml[data-codex-ui] [data-dsh-part=\"balance-card\"],\nhtml[data-codex-ui] [data-dsh-part=\"trend-card\"],\nhtml[data-codex-ui] [data-dsh-part=\"plan-card\"],\nhtml[data-codex-ui] [data-dsh-part=\"bank-card\"] {\n  background: var(--dsw-alias-bg-layer-1);\n  border: 0.5px solid var(--dsw-alias-border-l1);\n  border-radius: var(--dsw-radius-m);\n  box-shadow: var(--dsw-elevation-panel);\n  padding: var(--dsw-space-4);\n}\n\nhtml[data-codex-ui] [role=\"dialog\"],\nhtml[data-codex-ui] [data-dsh-surface=\"overlay\"] [data-dsh-part=\"panel\"] {\n  border-radius: var(--dsw-radius-l);\n}\n\nhtml[data-codex-ui] [data-dsh-part=\"chip\"],\nhtml[data-codex-ui] [data-dsh-part=\"ref\"] {\n  font-family: var(--dsw-font-meta);\n  font-size: var(--dsw-meta-size);\n  font-weight: var(--dsw-meta-weight);\n  letter-spacing: var(--dsw-meta-tracking-pill);\n  border-radius: var(--dsw-radius-pill);\n}\n\nhtml[data-codex-ui] [data-dsh-part=\"tag-chip\"][data-tag-tone=\"0\"],\nhtml[data-codex-ui] [data-dsh-part=\"tag-badge\"][data-tag-tone=\"0\"] {\n  background: var(--dsw-alias-bg-layer-2);\n  color: var(--dsw-alias-label-secondary);\n}\n\nhtml[data-codex-ui] [data-dsh-part=\"tag-chip\"][data-tag-tone=\"1\"],\nhtml[data-codex-ui] [data-dsh-part=\"tag-badge\"][data-tag-tone=\"1\"] {\n  background: var(--dsw-alias-state-success-tertiary);\n  color: var(--dsw-alias-state-success-primary);\n}\n\nhtml[data-codex-ui] [data-dsh-part=\"tag-chip\"][data-tag-tone=\"2\"],\nhtml[data-codex-ui] [data-dsh-part=\"tag-badge\"][data-tag-tone=\"2\"] {\n  background: var(--dsw-alias-state-warn-tertiary);\n  color: var(--dsw-alias-state-warn-primary);\n}\n\nhtml[data-codex-ui] [data-dsh-part=\"tag-chip\"][data-tag-tone=\"3\"],\nhtml[data-codex-ui] [data-dsh-part=\"tag-badge\"][data-tag-tone=\"3\"] {\n  background: var(--dsw-alias-state-error-tertiary);\n  color: var(--dsw-alias-state-error-primary);\n}\n\nhtml[data-codex-ui] [data-dsh-part=\"tag-chip\"][data-tag-tone=\"4\"],\nhtml[data-codex-ui] [data-dsh-part=\"tag-badge\"][data-tag-tone=\"4\"] {\n  background: var(--dsw-alias-state-business-tertiary);\n  color: var(--dsw-alias-label-primary);\n}\n\nhtml[data-codex-ui] [data-dsh-part=\"tag-chip\"][data-tag-tone=\"5\"],\nhtml[data-codex-ui] [data-dsh-part=\"tag-badge\"][data-tag-tone=\"5\"] {\n  background: var(--dsw-alias-bg-layer-3);\n  color: var(--dsw-alias-label-tertiary);\n}\n\nhtml[data-codex-ui] [data-dsh-surface=\"sidebar\"],\nhtml[data-codex-ui] [data-slot=\"sidebar.workspaces\"] {\n  background-color: var(--dsw-alias-bg-sidebar);\n}\n\nhtml[data-codex-ui] [data-dsh-part=\"sidebar-entry\"],\nhtml[data-codex-ui] [data-dsh-surface=\"sidebar\"] [role=\"button\"] {\n  border-radius: var(--dsw-radius-s);\n}\n\nhtml[data-codex-ui] [data-dsh-surface=\"composer\"] [data-dsh-part=\"composer-input\"] {\n  border-radius: var(--dsw-radius-l);\n}\n\nhtml[data-codex-ui] [data-dsh-part=\"composer-input\"] {\n  font-family: var(--dsw-font-family);\n  line-height: var(--dsw-leading-base);\n}\n\nhtml[data-codex-ui] [data-dsh-part=\"turn-tail\"],\nhtml[data-codex-ui] [data-dsh-part=\"queue-dock\"],\nhtml[data-codex-ui] [data-dsh-part=\"usage-chart\"],\nhtml[data-codex-ui] [data-dsh-part=\"voucher-preview\"] {\n  font-family: var(--dsw-font-meta);\n}\n\n@media (prefers-reduced-motion: reduce) {\n  html[data-codex-ui] *,\nhtml[data-codex-ui] *::before,\nhtml[data-codex-ui] *::after {\n    animation-duration: 0.01ms !important;\n    animation-iteration-count: 1 !important;\n    transition-duration: 0.01ms !important;\n    scroll-behavior: auto !important;\n  }\n}\n\nhtml[data-codex-ui] [data-slot=\"conversation.input.model\"] button:focus-visible {\n  outline: 1px solid var(--dsw-focus-ring-color);\n  outline-offset: 1px;\n  box-shadow: none;\n}\n\nhtml[data-codex-ui] body > div[role=\"menu\"][aria-busy] {\n\n  --dsw-menu-surface-fill: var(--dsw-alias-bg-layer-1);\n  --dsw-menu-backdrop-filter: none;\n\n  background: var(--dsw-alias-bg-layer-1);\n  padding: 5px;\n  border-radius: var(--dsw-radius-menu);\n  box-shadow: var(--dsw-codex-menu-shadow);\n  color: var(--dsw-alias-label-primary);\n}\n\nhtml[data-codex-ui] body > div[role=\"menu\"][aria-busy] button[role=\"menuitem\"],\nhtml[data-codex-ui] body > div[role=\"menu\"][aria-busy] button[role=\"menuitemradio\"] {\n  box-sizing: border-box;\n  min-height: 28px;\n  padding: 4px 9px;\n  gap: 8px;\n  border: 0;\n  border-radius: calc(var(--dsw-radius-menu) - 5px);\n  background: none;\n  color: inherit;\n  font-size: 13px;\n  line-height: 20px;\n  text-align: left;\n}\n\nhtml[data-codex-ui] body > div[role=\"menu\"][aria-busy] button[role=\"menuitem\"]:hover,\nhtml[data-codex-ui] body > div[role=\"menu\"][aria-busy] button[role=\"menuitemradio\"]:hover:not(:disabled),\nhtml[data-codex-ui] body > div[role=\"menu\"][aria-busy] button[role=\"menuitemradio\"][aria-checked=\"true\"] {\n  background: var(--dsw-alias-interactive-bg-active);\n}\n\nhtml[data-codex-ui] body > div[role=\"menu\"][aria-busy] button[role=\"menuitem\"]:focus-visible,\nhtml[data-codex-ui] body > div[role=\"menu\"][aria-busy] button[role=\"menuitemradio\"]:focus-visible {\n  outline: 1px solid var(--dsw-focus-ring-color);\n  outline-offset: -1px;\n  background: var(--dsw-alias-interactive-bg-active);\n}\n\nhtml[data-codex-ui] body > div[role=\"menu\"][aria-busy] button[role=\"menuitemradio\"]:disabled {\n  opacity: 1;\n}\n\nhtml[data-codex-ui] body > div[role=\"menu\"][aria-busy=\"true\"] button[role=\"menuitemradio\"][aria-checked=\"true\"] > span:last-child {\n  position: relative;\n}\n\nhtml[data-codex-ui] body > div[role=\"menu\"][aria-busy=\"true\"] button[role=\"menuitemradio\"][aria-checked=\"true\"] > span:last-child > svg {\n  visibility: hidden;\n}\n\nhtml[data-codex-ui] body > div[role=\"menu\"][aria-busy=\"true\"] button[role=\"menuitemradio\"][aria-checked=\"true\"] > span:last-child::after {\n  content: \"\";\n  position: absolute;\n  inset: 0;\n  box-sizing: border-box;\n  width: 12px;\n  height: 12px;\n  margin: auto;\n  border: 1.5px solid var(--dsw-alias-border-l3);\n  border-top-color: var(--dsw-alias-label-primary);\n  border-radius: 50%;\n  animation: codex-ui-spin 1s linear infinite;\n}\n\nhtml[data-codex-ui] body > div[role=\"menu\"][aria-busy=\"true\"] button[role=\"menuitemradio\"]:disabled {\n  cursor: progress;\n}\n\n@keyframes codex-ui-spin {\n  to {\n    transform: rotate(1turn);\n  }\n}\n\nhtml[data-codex-ui] body[data-codex-ui-te-ready] [data-slot=\"conversation.session.header\"] > [data-conversation-tabs] {\n  display: none;\n}\n\nhtml[data-codex-ui] body[data-codex-ui-te-ready] header:has([data-conversation-header-leading]):has([data-conversation-tabs]) {\n  min-height: 0;\n  padding-bottom: 10px;\n}\n\nhtml[data-codex-ui] [data-dsh-part=\"new-session\"] {\n  border: 0;\n  background: transparent;\n  box-shadow: none;\n  border-radius: var(--dsw-radius-s);\n  justify-content: flex-start;\n  color: var(--dsw-alias-label-primary);\n}\n\nhtml[data-codex-ui] [data-dsh-part=\"new-session\"]:hover {\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n\nhtml[data-codex-ui] [data-slot=\"conversation.composer.dock\"] {\n  display: none;\n}\n\nhtml[data-codex-ui] [data-conversation-header-corner] {\n  margin-left: 0;\n  margin-right: 0;\n}\n\nhtml[data-codex-ui] [data-sidebar-right-expand] svg {\n  transform: scaleX(-1);\n}\n\nhtml[data-codex-ui] [data-animating] {\n  transition: grid-template-columns 500ms cubic-bezier(.16, 1, .3, 1);\n}\n\nhtml[data-codex-ui] [data-animating] [data-side] {\n  transition: left 500ms cubic-bezier(.16, 1, .3, 1);\n}\n\nhtml[data-codex-ui] [data-dragging],\nhtml[data-codex-ui] [data-rightbar-instant],\nhtml[data-codex-ui] [data-rightbar-fullscreen],\nhtml[data-codex-ui] [data-dragging] [data-side],\nhtml[data-codex-ui] [data-rightbar-instant] [data-side],\nhtml[data-codex-ui] [data-rightbar-fullscreen] [data-side] {\n  transition: none;\n}\n\n@media (prefers-reduced-motion: reduce) {\n  html[data-codex-ui] [data-animating],\nhtml[data-codex-ui] [data-animating] [data-side] {\n    transition: none;\n  }\n}\n\nhtml[data-codex-ui] [data-sidebar-right-guide] > span[aria-hidden=\"true\"] {\n  display: none;\n}\n\nhtml[data-codex-ui] [data-sidebar-right-guide]::after {\n  display: none;\n}\n\nhtml[data-codex-ui] [data-sidebar-right-guide-entry] {\n  box-sizing: border-box;\n  width: 380px;\n  max-width: 100%;\n  min-height: 52px;\n  gap: 14px;\n  padding: 0 20px;\n  border: 0;\n  border-radius: var(--dsw-radius-m);\n  background: transparent;\n  color: var(--dsw-alias-label-primary);\n  font-size: 14px;\n}\n\nhtml[data-codex-ui] [data-sidebar-right-guide-entry]:hover {\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n\nhtml[data-codex-ui] [data-sidebar-right-guide-entry] > span:first-child {\n  width: 20px;\n  height: 20px;\n}\n\nhtml[data-codex-ui] [data-sidebar-right-guide-entry] > span:first-child svg {\n  width: 20px;\n  height: 20px;\n}\n\nhtml[data-codex-ui] [data-sidebar-right-guide-entry] > span:nth-child(2) {\n  gap: 0;\n}\n\nhtml[data-codex-ui] [data-sidebar-right-guide-entry] > span:nth-child(2) > span:nth-child(2) {\n  display: none;\n}\n\nhtml[data-codex-ui] [data-sidebar-right-guide-entry=\"terminal\"] > span:nth-child(2) {\n  width: 20px;\n  height: 20px;\n}\n\nhtml[data-codex-ui] [data-sidebar-right-guide-entry=\"terminal\"] > span:nth-child(2) svg {\n  width: 20px;\n  height: 20px;\n}\n\nhtml[data-codex-ui] [data-sidebar-right-guide-entry=\"terminal\"] > span:nth-child(3) > span:nth-child(2) {\n  display: none;\n}\n\nhtml[data-codex-ui] [data-sidebar-right-guide-entry] > span:has(kbd) {\n  display: inline-flex;\n  flex: none;\n  align-items: center;\n  gap: 3px;\n  height: 24px;\n  padding: 0 10px;\n  border-radius: var(--dsw-radius-m);\n  background: var(--dsw-alias-bg-layer-2);\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 12px;\n  line-height: 16px;\n  white-space: nowrap;\n}\n\nhtml[data-codex-ui] [data-sidebar-right-guide-entry] kbd {\n  display: inline;\n  min-width: 0;\n  padding: 0;\n  border: 0;\n  border-radius: 0;\n  background: transparent;\n  color: inherit;\n  font: inherit;\n}\n\nhtml[data-codex-ui] [data-sidebar-right-toggle] {\n  background: var(--dsw-alias-bg-layer-2);\n  border-radius: var(--dsw-radius-m);\n}\n\nhtml[data-codex-ui] [data-composer-card] button[class$=\"_add\"],\nhtml[data-codex-ui] [data-composer-card] button[class$=\"_trigger\"] {\n  transition: background-color var(--dsw-motion-fast) var(--dsw-ease);\n  border-radius: var(--dsw-radius-pill);\n}\n\nhtml[data-codex-ui] [data-composer-card] button[class$=\"_add\"] {\n  background: transparent;\n}\n\nhtml[data-codex-ui] [data-composer-card] button[class$=\"_add\"]:hover,\nhtml[data-codex-ui] [data-composer-card] button[class$=\"_add\"][aria-expanded=\"true\"],\nhtml[data-codex-ui] [data-composer-card] button[class$=\"_trigger\"]:hover,\nhtml[data-codex-ui] [data-composer-card] button[class$=\"_trigger\"][aria-expanded=\"true\"] {\n  background: var(--dsw-codex-hover-fill);\n}\n\nhtml[data-codex-ui] [data-menu-material] {\n  --dsw-menu-backdrop-filter: none;\n  --dsw-menu-surface-fill: var(--dsw-alias-bg-layer-1);\n  --dsw-elevation-stroke-color: var(--dsw-alias-border-l1);\n  background: var(--dsw-alias-bg-layer-1);\n  color: var(--dsw-alias-label-primary);\n}\n\nhtml[data-codex-ui] body[data-ds-dark-theme] [data-menu-material] {\n  --dsw-elevation-stroke-color: var(--dsw-alias-border-l3);\n}\n\nhtml[data-codex-ui] [data-trigger-menu],\nhtml[data-codex-ui] [data-menu-material] {\n  overflow-y: auto;\n  overscroll-behavior: contain;\n\n  scroll-padding-block: 1px;\n}\n\nhtml[data-codex-ui] [data-trigger-menu]::-webkit-scrollbar,\nhtml[data-codex-ui] [data-menu-material]::-webkit-scrollbar {\n  width: 8px;\n}\n\nhtml[data-codex-ui] [data-trigger-menu]::-webkit-scrollbar-thumb,\nhtml[data-codex-ui] [data-menu-material]::-webkit-scrollbar-thumb {\n  background: var(--dsw-alias-border-l3);\n  border-radius: var(--dsw-radius-pill);\n  border: 2px solid transparent;\n  background-clip: content-box;\n}\n\nhtml[data-codex-ui] [data-trigger-menu]::-webkit-scrollbar-thumb:hover,\nhtml[data-codex-ui] [data-menu-material]::-webkit-scrollbar-thumb:hover {\n  background: var(--dsw-alias-border-l4);\n  background-clip: content-box;\n}\n\nhtml[data-codex-ui] [data-trigger-menu][data-overflow-below] {\n  padding-bottom: 5px;\n}\n\nhtml[data-codex-ui] [data-trigger-menu] [role=\"menuitem\"],\nhtml[data-codex-ui] [data-trigger-menu] [role=\"option\"] {\n  min-width: 0;\n  overflow-wrap: anywhere;\n}\n\nhtml[data-codex-ui] [data-tool][data-state=\"preparing\"],\nhtml[data-codex-ui] [data-tool][data-state=\"running\"],\nhtml[data-codex-ui] [data-tool][data-state=\"stopped\"],\nhtml[data-codex-ui] [data-sample][data-state=\"preparing\"],\nhtml[data-codex-ui] [data-sample][data-state=\"running\"],\nhtml[data-codex-ui] [data-sample][data-state=\"stopped\"] {\n  color: var(--dsw-alias-label-secondary);\n  cursor: progress;\n}\n\nhtml[data-codex-ui] [data-tool][data-state=\"ok\"],\nhtml[data-codex-ui] [data-sample][data-state=\"ok\"] {\n  color: var(--dsw-alias-label-primary);\n}\n\nhtml[data-codex-ui] [data-tool][data-state=\"error\"],\nhtml[data-codex-ui] [data-sample][data-state=\"error\"] {\n  color: var(--dsw-alias-label-primary);\n  box-shadow: inset 2px 0 0 0 var(--dsw-alias-state-error-primary);\n  padding-left: calc(var(--dsw-space-3) + 2px);\n}\n\nhtml[data-codex-ui] [data-tool][data-state=\"stopped\"],\nhtml[data-codex-ui] [data-sample][data-state=\"stopped\"] {\n  box-shadow: inset 2px 0 0 0 var(--dsw-alias-border-l3);\n  padding-left: calc(var(--dsw-space-3) + 2px);\n}\n\nhtml[data-codex-ui] [data-tool][data-state=\"error\"] [data-tone=\"error\"],\nhtml[data-codex-ui] [data-sample][data-state=\"error\"] [data-tone=\"error\"],\nhtml[data-codex-ui] [data-tone=\"error\"] {\n  color: var(--dsw-alias-state-error-primary);\n}\n\nhtml[data-codex-ui] [data-tone=\"warn\"] {\n  color: var(--dsw-alias-state-warn-primary);\n}\n\nhtml[data-codex-ui] [data-tone=\"success\"] {\n  color: var(--dsw-alias-state-success-primary);\n}\n\nhtml[data-codex-ui] [data-tool] [data-caption],\nhtml[data-codex-ui] [data-tool] [data-change] {\n  color: var(--dsw-alias-label-tertiary);\n  font-size: var(--dsw-meta-size);\n}\n\nhtml[data-codex-ui] [data-tool][data-expandable],\nhtml[data-codex-ui] [data-sample][data-expandable] {\n  cursor: pointer;\n  border-radius: var(--dsw-radius-s);\n  transition: background-color var(--dsw-motion-fast) var(--dsw-ease);\n}\n\nhtml[data-codex-ui] [data-tool][data-expandable]:hover,\nhtml[data-codex-ui] [data-sample][data-expandable]:hover {\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n\nhtml[data-codex-ui] [data-tool][data-expandable][aria-expanded=\"true\"],\nhtml[data-codex-ui] [data-sample][data-expandable][aria-expanded=\"true\"] {\n  background: var(--dsw-alias-bg-layer-2);\n}\n\nhtml[data-codex-ui] [data-tool] pre,\nhtml[data-codex-ui] [data-sample] pre,\nhtml[data-codex-ui] [data-turn-process-body] pre,\nhtml[data-codex-ui] [data-turn-process-messages] pre {\n\n  font-family: var(--dsw-font-meta);\n  overflow-x: auto;\n  max-width: 100%;\n  white-space: pre;\n}\n\nhtml[data-codex-ui] [data-turn-process] {\n  color: var(--dsw-alias-label-primary);\n}\n\nhtml[data-codex-ui] [data-turn-process-chevron] {\n  color: var(--dsw-alias-label-tertiary);\n  transition: transform var(--dsw-motion-fast) var(--dsw-ease);\n}\n\nhtml[data-codex-ui] [data-turn-process-messages],\nhtml[data-codex-ui] [data-turn-process-tool-calls] {\n  color: var(--dsw-alias-label-secondary);\n  font-size: var(--dsw-meta-size);\n}\n\nhtml[data-codex-ui] [data-turn-process-answer] {\n  color: var(--dsw-alias-label-primary);\n}\n\nhtml[data-codex-ui] [data-turn-process][data-expanded=\"false\"] [data-turn-process-body] {\n  display: none;\n}\n\nhtml[data-codex-ui] [data-error],\nhtml[data-codex-ui] [data-unavailable] {\n  color: var(--dsw-alias-state-error-primary);\n  font-size: var(--dsw-meta-size);\n}\n\nhtml[data-codex-ui] [data-unavailable] {\n  color: var(--dsw-alias-label-tertiary);\n  font-style: normal;\n}\n\nhtml[data-codex-ui] [data-variant=\"think\"] {\n  color: var(--dsw-alias-label-secondary);\n  font-size: var(--dsw-meta-size);\n}\n\nhtml[data-codex-ui] [data-approval-key],\nhtml[data-codex-ui] [data-question-key] {\n  border-radius: var(--dsw-radius-m);\n  color: var(--dsw-alias-label-primary);\n}\n\nhtml[data-codex-ui] [data-approval-key][aria-busy=\"false\"],\nhtml[data-codex-ui] [data-question-key] {\n  border: 0.5px solid var(--dsw-alias-border-l2);\n  background: var(--dsw-alias-bg-layer-1);\n  padding: var(--dsw-space-4);\n}\n\nhtml[data-codex-ui] [data-approval-key][aria-busy=\"true\"] {\n  border: 0;\n  background: none;\n  padding: 0;\n  color: var(--dsw-alias-label-secondary);\n  font-size: var(--dsw-meta-size);\n}\n\nhtml[data-codex-ui] [data-question-reply],\nhtml[data-codex-ui] [data-question-key] [contenteditable=\"true\"],\nhtml[data-codex-ui] [data-question-key] textarea {\n  color: var(--dsw-alias-label-primary);\n  font-family: var(--dsw-font-family);\n  caret-color: var(--dsw-alias-label-primary);\n}\n\nhtml[data-codex-ui] [data-reply-outcome] {\n  color: var(--dsw-alias-label-secondary);\n  font-size: var(--dsw-meta-size);\n}\n\nhtml[data-codex-ui] [data-question-scroll],\nhtml[data-codex-ui] [data-approval-scroll] {\n  overflow-y: auto;\n  overscroll-behavior: contain;\n  max-height: 40vh;\n}\n\nhtml[data-codex-ui] [data-goal-bar] {\n  color: var(--dsw-alias-label-primary);\n  font-size: var(--dsw-meta-size);\n  padding: var(--dsw-space-2) 0;\n  border-bottom: 0.5px solid var(--dsw-alias-border-l1);\n}\n\nhtml[data-codex-ui] [data-command-input] {\n  font-family: var(--dsw-font-family);\n  color: var(--dsw-alias-label-primary);\n}\n\nhtml[data-codex-ui] [data-trigger-menu] [data-source] {\n  color: var(--dsw-alias-label-tertiary);\n  font-size: var(--dsw-meta-size);\n  font-family: var(--dsw-font-family);\n  letter-spacing: normal;\n  text-transform: none;\n}\n\nhtml[data-codex-ui] [data-trigger-menu] [role=\"status\"] {\n  color: var(--dsw-alias-label-tertiary);\n  font-size: var(--dsw-meta-size);\n}\n\nhtml[data-codex-ui] [data-composer-chip],\nhtml[data-codex-ui] [data-dsh-part=\"composer-chip\"] {\n  font-family: var(--dsw-font-family);\n  font-size: inherit;\n  letter-spacing: normal;\n  text-transform: none;\n  color: var(--dsw-alias-label-primary);\n  background: var(--dsw-alias-bg-layer-2);\n  border-radius: var(--dsw-radius-s);\n  padding: 0 var(--dsw-space-2);\n\n  cursor: default;\n  user-select: all;\n}\n\nhtml[data-codex-ui] [data-composer-chip] [class$=\"_path\"] {\n  font-family: var(--dsw-font-meta);\n}\n\n@media (prefers-reduced-motion: reduce) {\n  html[data-codex-ui] [data-turn-process-chevron] {\n    transition-duration: 0.01ms;\n  }\n\n  html[data-codex-ui] [data-tool][data-expandable],\nhtml[data-codex-ui] [data-sample][data-expandable] {\n    transition-duration: 0.01ms;\n  }\n}\n\nhtml[data-codex-ui] [data-slot=\"conversation.input.model\"][data-codex-ui-seated] > :not(.codex-mp-trigger) {\n  display: none;\n}\n\nhtml[data-codex-ui] .codex-mp-trigger {\n  box-sizing: border-box;\n  display: inline-flex;\n  align-items: center;\n  gap: 4px;\n  height: 28px;\n  min-width: 0;\n  max-width: min(360px, 45cqw);\n  padding: 0 4px 0 8px;\n  border: 0;\n  border-radius: var(--dsw-radius-pill);\n  background: transparent;\n  color: var(--dsw-alias-label-secondary);\n  font-family: inherit;\n  font-size: 13px;\n  font-weight: 400;\n  line-height: 20px;\n  cursor: pointer;\n  transition: background-color var(--dsw-motion-fast) var(--dsw-ease);\n}\n\nhtml[data-codex-ui] .codex-mp-trigger:hover,\nhtml[data-codex-ui] .codex-mp-trigger[aria-expanded=\"true\"] {\n  background: var(--dsw-codex-hover-fill);\n}\n\nhtml[data-codex-ui] .codex-mp-trigger-model {\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\nhtml[data-codex-ui] .codex-mp-effort-layers {\n  display: grid;\n  grid-template-columns: max-content;\n  flex-shrink: 1000;\n  width: max-content;\n  min-width: 0;\n  overflow: hidden;\n  color: var(--dsw-alias-label-caption);\n}\n\nhtml[data-codex-ui] .codex-mp-effort-layers[hidden] {\n  display: none;\n}\n\nhtml[data-codex-ui] .codex-mp-effort-text {\n  grid-area: 1 / 1;\n  justify-self: center;\n  opacity: 0;\n  filter: blur(4px);\n  white-space: nowrap;\n  will-change: opacity, filter;\n  transition:\n    opacity var(--dsw-motion-slow) var(--dsw-ease),\n    filter var(--dsw-motion-slow) var(--dsw-ease);\n}\n\nhtml[data-codex-ui] .codex-mp-effort-text[data-active=\"true\"] {\n  opacity: 1;\n  filter: none;\n}\n\nhtml[data-codex-ui] .codex-mp-trigger-chevron {\n  display: inline-flex;\n  flex: none;\n  color: var(--dsw-alias-label-caption);\n  transition: transform 120ms var(--dsw-ease);\n}\n\nhtml[data-codex-ui] .codex-mp-trigger[aria-expanded=\"true\"] .codex-mp-trigger-chevron {\n  transform: rotate(180deg);\n}\n\nhtml[data-codex-ui] .codex-mp-popover {\n  position: fixed;\n  z-index: 1100;\n  box-sizing: border-box;\n  display: flex;\n  flex-direction: column;\n  width: calc(4px * 63.5);\n  max-width: calc(100vw - 24px);\n  max-height: min(360px, 100vh - 96px);\n  padding: 5px;\n  border-radius: var(--dsw-radius-menu);\n  background: var(--dsw-alias-bg-layer-1);\n  color: var(--dsw-alias-label-primary);\n  box-shadow: var(--dsw-codex-menu-shadow);\n  font-size: 13px;\n  line-height: 20px;\n  transform-origin: bottom right;\n  animation: codex-mp-enter 0.32s cubic-bezier(0.23, 1, 0.32, 1) 30ms both;\n}\n\nhtml[data-codex-ui] .codex-mp-popover[hidden] {\n  display: none;\n}\n\nhtml[data-codex-ui] .codex-mp-popover[data-reduced-motion=\"true\"] {\n  animation: none;\n}\n\n@keyframes codex-mp-enter {\n  from {\n    opacity: 0;\n    transform: scale(0.98);\n  }\n\n  to {\n    opacity: 1;\n    transform: none;\n  }\n}\n\nhtml[data-codex-ui] .codex-mp-error {\n  flex: none;\n  margin-bottom: 3px;\n  padding: 6px 9px;\n  border-radius: calc(var(--dsw-radius-menu) - 5px);\n  background: var(--dsw-alias-interactive-bg-hover-danger);\n  color: var(--dsw-alias-state-error-primary);\n  font-size: 11px;\n  line-height: 16px;\n}\n\nhtml[data-codex-ui] .codex-mp-error[hidden] {\n  display: none;\n}\n\nhtml[data-codex-ui] .codex-mp-list {\n  min-height: 0;\n  overflow-y: auto;\n  scrollbar-width: thin;\n}\n\nhtml[data-codex-ui] .codex-mp-status {\n  padding: 8px 9px;\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 12px;\n  line-height: 18px;\n}\n\nhtml[data-codex-ui] .codex-mp-retry {\n  padding: 0;\n  border: 0;\n  background: none;\n  color: inherit;\n  font: inherit;\n  font-weight: 600;\n  cursor: pointer;\n}\n\nhtml[data-codex-ui] .codex-mp-group {\n  padding: 4px 9px 2px;\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 11px;\n  font-weight: 500;\n  line-height: 16px;\n}\n\nhtml[data-codex-ui] .codex-mp-group:not(:first-child) {\n  margin-top: 3px;\n}\n\nhtml[data-codex-ui] .codex-mp-row {\n  box-sizing: border-box;\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  width: 100%;\n  min-height: 28px;\n  padding: 4px 9px;\n  border: 0;\n  border-radius: calc(var(--dsw-radius-menu) - 5px);\n  background: none;\n  color: inherit;\n  font-family: inherit;\n  font-size: 13px;\n  line-height: 20px;\n  text-align: left;\n  cursor: pointer;\n}\n\nhtml[data-codex-ui] .codex-mp-row:hover,\nhtml[data-codex-ui] .codex-mp-row[aria-checked=\"true\"] {\n  background: var(--dsw-alias-interactive-bg-active);\n}\n\nhtml[data-codex-ui] .codex-mp-row:focus-visible {\n  outline: 1px solid var(--dsw-focus-ring-color);\n  outline-offset: -1px;\n  background: var(--dsw-alias-interactive-bg-active);\n}\n\nhtml[data-codex-ui] .codex-mp-row[aria-busy=\"true\"] {\n  cursor: progress;\n}\n\nhtml[data-codex-ui] .codex-mp-row-copy {\n  display: flex;\n  flex: 1;\n  flex-direction: column;\n  min-width: 0;\n}\n\nhtml[data-codex-ui] .codex-mp-row-name {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  font-weight: 500;\n}\n\nhtml[data-codex-ui] .codex-mp-row-desc {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 12px;\n  line-height: 18px;\n}\n\nhtml[data-codex-ui] .codex-mp-row-check {\n  display: grid;\n  flex: 0 0 14px;\n  place-items: center;\n  color: var(--dsw-alias-label-primary);\n}\n\nhtml[data-codex-ui] .codex-mp-spinner {\n  box-sizing: border-box;\n  display: inline-block;\n  flex: none;\n  width: 12px;\n  height: 12px;\n  border: 1.5px solid var(--dsw-alias-border-l3);\n  border-top-color: var(--dsw-alias-label-primary);\n  border-radius: 50%;\n  animation: codex-ui-spin 1s linear infinite;\n}\n\nhtml[data-codex-ui] .codex-mp-effort {\n  flex: none;\n  margin-top: 5px;\n  padding-top: 5px;\n  border-top: 0.5px solid var(--dsw-alias-border-l1);\n}\n\nhtml[data-codex-ui] .codex-mp-effort[hidden] {\n  display: none;\n}\n\nhtml[data-codex-ui] .codex-mp-effort {\n  --codex-mp-apex: #8b7ad0;\n  --codex-mp-apex-flash: #d9d2f5;\n  --codex-mp-apex-ink: #5f51b5;\n}\n\nhtml[data-codex-ui] body[data-ds-dark-theme] .codex-mp-effort {\n  --codex-mp-apex: #9d8ce0;\n  --codex-mp-apex-flash: #e6e0fb;\n  --codex-mp-apex-ink: #b9adf0;\n}\n\nhtml[data-codex-ui] .codex-mp-effort-head {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n  min-height: 28px;\n  padding: 4px 9px;\n  color: var(--dsw-alias-label-secondary);\n}\n\nhtml[data-codex-ui] .codex-mp-effort-value {\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\nhtml[data-codex-ui] .codex-mp-container {\n  position: relative;\n  box-sizing: border-box;\n  display: flex;\n  flex-direction: column;\n  justify-content: center;\n  height: 32px;\n  margin-inline: 2px;\n  padding-block: 2px;\n  padding-inline: 6px;\n}\n\nhtml[data-codex-ui] .codex-mp-root {\n  --codex-mp-motion-duration: 0.18s;\n  --codex-mp-motion-easing: cubic-bezier(0.22, 0.61, 0.36, 1);\n  --codex-mp-tick-transform-duration: 0.12s;\n  --codex-mp-thumb-motion-duration: 0s;\n  position: relative;\n  display: flex;\n  align-items: center;\n  width: 100%;\n  height: 30px;\n  outline: none;\n  touch-action: none;\n  cursor: pointer;\n}\n\nhtml[data-codex-ui] .codex-mp-root[data-armed=\"true\"] {\n  --codex-mp-thumb-motion-duration: var(--codex-mp-motion-duration);\n}\n\nhtml[data-codex-ui] .codex-mp-root[data-dragging=\"true\"],\nhtml[data-codex-ui] .codex-mp-root[data-dragging=\"true\"] .codex-mp-tick {\n  cursor: grabbing;\n}\n\nhtml[data-codex-ui] .codex-mp-root[data-disabled=\"true\"] {\n  opacity: 0.6;\n}\n\nhtml[data-codex-ui] .codex-mp-popover[data-reduced-motion=\"true\"] .codex-mp-root {\n  --codex-mp-motion-duration: 0s;\n  --codex-mp-tick-transform-duration: 0s;\n  --codex-mp-thumb-motion-duration: 0s;\n}\n\nhtml[data-codex-ui] .codex-mp-track {\n  position: relative;\n  flex-grow: 1;\n  height: 30px;\n}\n\nhtml[data-codex-ui] .codex-mp-track::before {\n  content: \"\";\n  position: absolute;\n  left: 0;\n  right: 0;\n  top: 50%;\n  height: 26px;\n  margin-top: -13px;\n  border-radius: 8px;\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n\nhtml[data-codex-ui] .codex-mp-range {\n  position: absolute;\n  left: 0;\n  top: 50%;\n  height: 26px;\n  margin-top: -13px;\n  width: calc(8px + (100% - 16px) * var(--codex-mp-pos, 0));\n  border-radius: 8px 0 0 8px;\n  background: color-mix(in srgb, var(--dsw-alias-label-primary) 26%, transparent);\n  transition: width var(--codex-mp-thumb-motion-duration) var(--codex-mp-motion-easing);\n  pointer-events: none;\n}\n\nhtml[data-codex-ui] .codex-mp-matrix {\n  position: absolute;\n  left: 0;\n  right: 0;\n  top: 50%;\n  height: 26px;\n  margin-top: -13px;\n  border-radius: 8px;\n  overflow: hidden;\n  box-sizing: border-box;\n  display: none;\n  pointer-events: none;\n}\n\nhtml[data-codex-ui] .codex-mp-root[data-tier=\"max\"] .codex-mp-matrix {\n  display: grid;\n  grid-auto-flow: row;\n}\n\nhtml[data-codex-ui] .codex-mp-matrix-cell {\n  animation: codex-mp-cell-in 0.15s ease both;\n}\n\n@keyframes codex-mp-cell-in {\n  from {\n    opacity: 0;\n  }\n\n  to {\n    opacity: 1;\n  }\n}\n\nhtml[data-codex-ui] .codex-mp-matrix-sq {\n  width: 100%;\n  height: 100%;\n  border-radius: 1px;\n  background-color: var(--codex-mp-apex);\n  --codex-mp-flash-light: var(--codex-mp-apex-flash);\n  animation: codex-mp-flash 1.45s infinite ease-in-out;\n}\n\nhtml[data-codex-ui] .codex-mp-matrix-sq[data-tone=\"0\"] { --codex-mp-flash-light: color-mix(in srgb, var(--codex-mp-apex) 62%, var(--codex-mp-apex-flash)); }\nhtml[data-codex-ui] .codex-mp-matrix-sq[data-tone=\"1\"] { --codex-mp-flash-light: color-mix(in srgb, var(--codex-mp-apex) 54%, var(--codex-mp-apex-flash)); }\nhtml[data-codex-ui] .codex-mp-matrix-sq[data-tone=\"2\"] { --codex-mp-flash-light: color-mix(in srgb, var(--codex-mp-apex) 46%, var(--codex-mp-apex-flash)); }\nhtml[data-codex-ui] .codex-mp-matrix-sq[data-tone=\"3\"] { --codex-mp-flash-light: color-mix(in srgb, var(--codex-mp-apex) 38%, var(--codex-mp-apex-flash)); }\nhtml[data-codex-ui] .codex-mp-matrix-sq[data-tone=\"4\"] { --codex-mp-flash-light: color-mix(in srgb, var(--codex-mp-apex) 30%, var(--codex-mp-apex-flash)); }\nhtml[data-codex-ui] .codex-mp-matrix-sq[data-tone=\"5\"] { --codex-mp-flash-light: color-mix(in srgb, var(--codex-mp-apex) 22%, var(--codex-mp-apex-flash)); }\nhtml[data-codex-ui] .codex-mp-matrix-sq[data-tone=\"6\"] { --codex-mp-flash-light: color-mix(in srgb, var(--codex-mp-apex) 14%, var(--codex-mp-apex-flash)); }\nhtml[data-codex-ui] .codex-mp-matrix-sq[data-tone=\"7\"] { --codex-mp-flash-light: color-mix(in srgb, var(--codex-mp-apex) 6%, var(--codex-mp-apex-flash)); }\n\n@keyframes codex-mp-flash {\n  0%,\n  17.24% {\n    background-color: var(--codex-mp-apex);\n  }\n\n  17.25%,\n  50.34% {\n    background-color: var(--codex-mp-flash-light);\n  }\n\n  100% {\n    background-color: var(--codex-mp-apex);\n  }\n}\n\nhtml[data-codex-ui] .codex-mp-tick {\n  position: absolute;\n  top: 50%;\n  width: 4px;\n  height: 4px;\n  margin-top: -2px;\n  border-radius: 50%;\n  background: color-mix(in srgb, var(--dsw-alias-label-primary) 26%, transparent);\n  transform: translateX(-50%);\n  pointer-events: none;\n}\n\nhtml[data-codex-ui] .codex-mp-tick::before {\n  content: \"\";\n  position: absolute;\n  inset: -6px;\n}\n\nhtml[data-codex-ui] .codex-mp-thumb-scale {\n  position: absolute;\n  top: 50%;\n  left: calc(8px + (100% - 16px) * var(--codex-mp-pos, 0));\n  width: 16px;\n  height: 30px;\n  margin-top: -15px;\n  border-radius: 5px;\n  transform: translateX(-50%);\n  pointer-events: none;\n  will-change: left;\n  transition: left var(--codex-mp-thumb-motion-duration) var(--codex-mp-motion-easing);\n}\n\nhtml[data-codex-ui] .codex-mp-thumb {\n  position: absolute;\n  inset: 0;\n  box-sizing: border-box;\n  display: block;\n  border-radius: 5px;\n  background: var(--dsw-static-neutral-bluish-00, #ffffff);\n  box-shadow:\n    0 1px 3px rgb(20 20 19 / 28%),\n    0 0 0 1px rgb(20 20 19 / 6%);\n}\n\nhtml[data-codex-ui] body[data-ds-dark-theme] .codex-mp-thumb {\n  box-shadow:\n    0 1px 3px rgb(0 0 0 / 55%),\n    0 0 0 1px rgb(0 0 0 / 40%);\n}\n\nhtml[data-codex-ui] .codex-mp-root[data-tier=\"max\"] .codex-mp-range,\nhtml[data-codex-ui] .codex-mp-root[data-tier=\"max\"] .codex-mp-tick {\n  opacity: 0;\n}\n\nhtml[data-codex-ui] .codex-mp-root[data-tier=\"max\"] .codex-mp-thumb {\n  background: color-mix(in srgb, var(--codex-mp-apex) 22%, #ffffff);\n  box-shadow:\n    0 0 10px color-mix(in srgb, var(--codex-mp-apex) 80%, transparent),\n    0 0 0 1px color-mix(in srgb, var(--codex-mp-apex) 35%, transparent);\n}\n\nhtml[data-codex-ui] .codex-mp-effort[data-tier=\"max\"] .codex-mp-effort-value {\n  color: var(--codex-mp-apex-ink);\n}\n\nhtml[data-codex-ui] .codex-mp-root[data-keyboard-focused=\"true\"] .codex-mp-thumb-scale {\n  outline: 2px solid var(--dsw-focus-ring-color);\n  outline-offset: 0;\n}\n\nhtml[data-codex-ui] .codex-mp-root[data-unset] .codex-mp-thumb-scale,\nhtml[data-codex-ui] .codex-mp-root[data-unset] .codex-mp-range {\n  visibility: hidden;\n}\n\nhtml[data-codex-ui] .codex-mp-ends {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n  padding: 0 9px 2px;\n  font-size: 11px;\n  line-height: 14px;\n  color: var(--dsw-alias-label-caption);\n}\n\nhtml[data-codex-ui] .codex-mp-value-text {\n  animation: codex-mp-value-in 0.28s ease;\n}\n\nhtml[data-codex-ui] .codex-mp-effort-ghost {\n  position: absolute;\n  left: 0;\n  top: 0;\n  white-space: nowrap;\n  pointer-events: none;\n  color: inherit;\n  animation: codex-mp-value-out 0.28s ease forwards;\n}\n\n@keyframes codex-mp-value-in {\n  from {\n    filter: blur(4px);\n    opacity: 0;\n    transform: translateY(5px);\n  }\n\n  to {\n    filter: blur(0);\n    opacity: 1;\n    transform: translateY(0);\n  }\n}\n\n@keyframes codex-mp-value-out {\n  from {\n    filter: blur(0);\n    opacity: 1;\n    transform: translateY(0);\n  }\n\n  to {\n    filter: blur(4px);\n    opacity: 0;\n    transform: translateY(-5px);\n  }\n}\n\n@media (prefers-reduced-motion: reduce) {\n  html[data-codex-ui] .codex-mp-matrix-cell,\nhtml[data-codex-ui] .codex-mp-matrix-sq,\nhtml[data-codex-ui] .codex-mp-value-text,\nhtml[data-codex-ui] .codex-mp-effort-ghost {\n    animation: none;\n  }\n}\n\nhtml[data-codex-ui] .codex-mp-popover[data-reduced-motion=\"true\"] .codex-mp-matrix-cell,\nhtml[data-codex-ui] .codex-mp-popover[data-reduced-motion=\"true\"] .codex-mp-matrix-sq,\nhtml[data-codex-ui] .codex-mp-popover[data-reduced-motion=\"true\"] .codex-mp-value-text,\nhtml[data-codex-ui] .codex-mp-popover[data-reduced-motion=\"true\"] .codex-mp-effort-ghost {\n  animation: none;\n}\n\nhtml[data-codex-ui] [data-slot=\"sidebar\"] > div:not([class*=\"_collapsed\"]) > button {\n  box-sizing: border-box;\n  height: auto;\n  min-height: 36px;\n  flex: none;\n  background: 0 0;\n  border: none;\n  border-radius: var(--dsw-radius-s);\n  justify-content: flex-start;\n  align-items: center;\n  gap: 6px;\n\n  margin: 0 2px 4px 0;\n  padding: 7px 8px;\n  font: inherit;\n  line-height: 22px;\n  text-align: left;\n  color: var(--dsw-alias-label-primary);\n  cursor: pointer;\n  overflow: hidden;\n}\n\nhtml[data-codex-ui] [data-slot=\"sidebar\"] > div:not([class*=\"_collapsed\"]) > button:hover {\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n\nhtml[data-codex-ui] [data-slot=\"sidebar\"] > div:not([class*=\"_collapsed\"]) > button:focus-visible {\n  outline: 2px solid var(--dsw-focus-ring-color);\n  outline-offset: -2px;\n}\n\nhtml[data-codex-ui] [data-slot=\"sidebar\"] > div:not([class*=\"_collapsed\"]) > button > svg {\n  width: 16px;\n  height: 16px;\n  flex: none;\n}\n\nhtml[data-codex-ui] [data-slot=\"sidebar\"] > div:not([class*=\"_collapsed\"]) > button > span {\n  max-width: none;\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\nhtml[data-codex-ui] [data-slot=\"sidebar\"] > div:not([class*=\"_collapsed\"]) > button > span > span[class*=\"_newSessionContent\"] {\n  justify-content: flex-start;\n  width: auto;\n}\n\nhtml[data-codex-ui] [data-slot=\"sidebar\"] > div:not([class*=\"_collapsed\"]) > button > span > span > svg {\n  width: 16px;\n  height: 16px;\n  flex: none;\n}\n\nhtml[data-codex-ui] [data-slot=\"sidebar\"] > div:not([class*=\"_collapsed\"]) > button > span > span > span {\n  max-width: none;\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\nhtml[data-codex-ui] [data-slot=\"sidebar\"] > div:not([class*=\"_collapsed\"]) > nav > button {\n  gap: 6px;\n  margin-left: 0;\n}\n\nhtml[data-codex-ui] [data-slot=\"sidebar\"] [data-row-key^=\"session:\"],\nhtml[data-codex-ui] [data-slot=\"sidebar\"] [data-row-key^=\"workspace:\"] {\n  border-radius: var(--dsw-radius-s);\n  transition: background-color 120ms var(--ds-ease-in-out, ease-out);\n}\n\nhtml[data-codex-ui] [data-slot=\"sidebar\"] [data-row-key^=\"session:\"][aria-selected=\"true\"] {\n  background: var(--dsw-alias-interactive-bg-active);\n}\n\nhtml[data-codex-ui] [data-slot=\"sidebar\"] [data-row-key^=\"session:\"] [class*=\"_title\"] {\n  min-width: 0;\n}\n\nhtml[data-codex-ui] [data-slot=\"sidebar\"] [data-row-key^=\"session:\"] [data-state] {\n  flex: none;\n}\n\nhtml[data-codex-ui] [data-slot=\"sidebar\"] [data-row-key^=\"overflow:\"] {\n  border-radius: var(--dsw-radius-s);\n  color: var(--dsw-alias-label-caption);\n}\nhtml[data-codex-ui] [data-slot=\"sidebar\"] [data-row-key^=\"overflow:\"]:hover,\nhtml[data-codex-ui] [data-slot=\"sidebar\"] [data-row-key^=\"overflow:\"]:focus-visible {\n  color: var(--dsw-alias-label-primary);\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n\nhtml[data-codex-ui] div > [data-slot=\"sidebar.workspaces\"] [class$=\"_fade\"] {\n  display: none;\n}\n\nhtml[data-codex-ui] div > [data-slot=\"sidebar.workspaces\"] [class$=\"_list\"] {\n  -webkit-mask-image:\n    linear-gradient(\n      to bottom,\n      #000 0,\n      #000 calc(100% - 40px),\n      #000000e0 calc(100% - 24px),\n      #00000085 calc(100% - 12px),\n      #0000002e calc(100% - 4px),\n      #00000000 100%\n    ),\n    linear-gradient(#000, #000);\n  mask-image:\n    linear-gradient(\n      to bottom,\n      #000 0,\n      #000 calc(100% - 40px),\n      #000000e0 calc(100% - 24px),\n      #00000085 calc(100% - 12px),\n      #0000002e calc(100% - 4px),\n      #00000000 100%\n    ),\n    linear-gradient(#000, #000);\n  -webkit-mask-size: calc(100% - var(--dsh-session-list-edge-inset, 12px)) 100%, var(--dsh-session-list-edge-inset, 12px) 100%;\n  mask-size: calc(100% - var(--dsh-session-list-edge-inset, 12px)) 100%, var(--dsh-session-list-edge-inset, 12px) 100%;\n  -webkit-mask-position: 0 0, 100% 0;\n  mask-position: 0 0, 100% 0;\n  -webkit-mask-repeat: no-repeat, no-repeat;\n  mask-repeat: no-repeat, no-repeat;\n}\n\nhtml[data-codex-ui] [data-sidebar-right-panel] ::-webkit-scrollbar {\n  width: 8px;\n  height: 8px;\n}\n\nhtml[data-codex-ui] [data-sidebar-right-panel] ::-webkit-scrollbar-track {\n  background: transparent;\n}\n\nhtml[data-codex-ui] [data-sidebar-right-panel] ::-webkit-scrollbar-thumb {\n  background: var(--dsw-alias-scrollbar-bg-l2);\n  border-radius: var(--dsw-radius-pill);\n  border: 2px solid transparent;\n  background-clip: content-box;\n}\n\nhtml[data-codex-ui] [data-sidebar-right-panel] ::-webkit-scrollbar-thumb:hover {\n  background: var(--dsw-alias-scrollbar-hover-l2);\n  background-clip: content-box;\n}\n\nhtml[data-codex-ui] [data-sidebar-right-panel] [data-dockkit-pane],\nhtml[data-codex-ui] [data-sidebar-right-panel] [class*=\"tabHostBody\"],\nhtml[data-codex-ui] [data-sidebar-right-panel] [class*=\"panelBody\"] {\n  overscroll-behavior: contain;\n}\n\nhtml[data-codex-ui][data-windows-titlebar] div:has(> [data-slot=\"main\"]),\nhtml[data-codex-ui][data-windows-titlebar] div:has(> [data-slot=\"sidebar\"]) + div,\nhtml[data-codex-ui][data-platform=\"win32\"]:not([data-windows-titlebar]) div:has(> [data-slot=\"main\"]),\nhtml[data-codex-ui][data-platform=\"win32\"]:not([data-windows-titlebar]) div:has(> [data-slot=\"sidebar\"]) + div {\n  position: relative;\n  box-shadow:\n    0 0 0 0.5px var(--dsw-alias-border-l2),\n    0 0 13px rgba(13, 13, 13, 0.07);\n}\n\nhtml[data-codex-ui][data-windows-titlebar] body[data-ds-dark-theme] div:has(> [data-slot=\"main\"]),\nhtml[data-codex-ui][data-windows-titlebar] body[data-ds-dark-theme] div:has(> [data-slot=\"sidebar\"]) + div,\nhtml[data-codex-ui][data-platform=\"win32\"]:not([data-windows-titlebar]) body[data-ds-dark-theme] div:has(> [data-slot=\"main\"]),\nhtml[data-codex-ui][data-platform=\"win32\"]:not([data-windows-titlebar]) body[data-ds-dark-theme] div:has(> [data-slot=\"sidebar\"]) + div {\n  box-shadow:\n    0 0 0 0.5px var(--dsw-alias-border-l2),\n    0 0 24px rgba(0, 0, 0, 0.5);\n}\n\nhtml[data-codex-ui][data-windows-titlebar] [data-sidebar-right-panel=\"push\"][data-sidebar-right-open],\nhtml[data-codex-ui][data-platform=\"win32\"]:not([data-windows-titlebar]) [data-sidebar-right-panel=\"push\"][data-sidebar-right-open] {\n  box-shadow:\n    0 0 0 0.5px var(--dsw-alias-border-l1),\n    0 -12px 24px -12px var(--dsw-codex-ambient);\n}\n\nhtml[data-codex-ui] [data-sidebar-right-panel=\"push\"][data-sidebar-right-open] [data-dockkit-pane][data-dockkit-column=\"0\"] {\n  border-left: 0;\n}\n\nhtml[data-codex-ui] [data-side=\"rightbar\"]::before {\n  content: \"\";\n  position: absolute;\n  top: 0;\n  bottom: 0;\n  left: 50%;\n  width: 2px;\n  translate: -50% 0;\n  border-radius: 1px;\n  background: linear-gradient(to bottom, rgba(13, 13, 13, 0.09), rgba(13, 13, 13, 0.27) 50%, rgba(13, 13, 13, 0.09));\n  opacity: 0;\n  scale: 1 0.35;\n  transform-origin: center;\n  transition: opacity var(--dsw-motion-base) var(--dsw-ease), scale var(--dsw-motion-slow) var(--dsw-ease);\n  pointer-events: none;\n}\n\nhtml[data-codex-ui] [data-side=\"rightbar\"]:hover::before {\n  opacity: 1;\n  scale: 1 1;\n}\n\nhtml[data-codex-ui] body[data-ds-dark-theme] [data-side=\"rightbar\"]::before {\n  background: linear-gradient(to bottom, rgba(236, 236, 236, 0.08), rgba(236, 236, 236, 0.24) 50%, rgba(236, 236, 236, 0.08));\n}\n\nhtml[data-codex-ui][data-platform=\"win32\"]:not([data-windows-titlebar]) div:has(> [data-slot=\"sidebar\"]) {\n  border-right-color: var(--dsw-alias-border-l1);\n}\n\nhtml[data-codex-ui] [data-conversation-scroll] {\n  --dsh-composer-card-max-width: calc(var(--dsh-chat-content-width) + 32px);\n  --dsh-composer-side-clearance: 24px;\n\n  --dcu-composer-bg: var(--dsw-composer-surface);\n\n  --dcu-composer-shadow: 0 0 0 0.5px rgba(13, 13, 13, 0.1), 0 2px 12px 0 rgba(0, 0, 0, 0.09);\n}\n\nhtml[data-codex-ui] body[data-ds-dark-theme] [data-conversation-scroll] {\n  --dcu-composer-bg: color-mix(in srgb, var(--dsw-alias-label-primary) 5%, var(--dsw-composer-surface));\n  --dcu-composer-shadow: inset 0 0 1px 0 #fff3;\n}\n\nhtml[data-codex-ui] [data-conversation-scroll] [data-composer-card] {\n  padding-top: 12px;\n  gap: 4px;\n  border: 0;\n  border-radius: var(--dsw-radius-card);\n  background: var(--dcu-composer-bg);\n  box-shadow: var(--dcu-composer-shadow);\n}\n\n@supports (corner-shape: superellipse(1.5)) {\n  html[data-codex-ui] [data-conversation-scroll] [data-composer-card] {\n    corner-shape: superellipse(1.5);\n  }\n}\n\n@media (forced-colors: active) {\n  html[data-codex-ui] [data-conversation-scroll] [data-composer-card] {\n    outline: 1px solid CanvasText;\n  }\n}\n\nhtml[data-codex-ui] [data-conversation-scroll] [data-composer-card] [data-input-scroll] {\n  margin-right: 0;\n}\n\nhtml[data-codex-ui] [data-conversation-scroll] [data-input-scroll] [data-lexical-editor=true] {\n  min-height: 44px;\n  padding: 0 12px;\n}\n\nhtml[data-codex-ui] [data-conversation-scroll] [data-composer-placeholder] {\n  inset: 0 12px auto;\n}\n\nhtml[data-codex-ui] [data-conversation-scroll] [data-composer-card] > [data-input-scroll] + div {\n  padding: 0 8px 8px;\n  gap: 5px;\n}\n\nhtml[data-codex-ui] [data-conversation-scroll] [data-composer-card] > [data-input-scroll] + div > div {\n  gap: 4px;\n}\n\nhtml[data-codex-ui] [data-conversation-scroll] [data-composer-card] > [data-input-scroll] + div > div > div {\n  gap: 4px;\n}\n\nhtml[data-codex-ui] [data-conversation-scroll] [data-composer-card] > [data-input-scroll] + div button:not([role]),\nhtml[data-codex-ui] [data-conversation-scroll] [data-composer-card] > [data-input-scroll] + div select:not([role]) {\n  min-height: 28px;\n  height: 28px;\n}\n\nhtml[data-codex-ui] [data-conversation-scroll] [data-composer-card] > [data-input-scroll] + div button[class$=_primary] {\n  width: 28px;\n  transform: none;\n  background: var(--dsw-alias-label-primary);\n  color: var(--dsw-alias-bg-base);\n}\n\nhtml[data-codex-ui] [data-conversation-scroll] [data-composer-card] > [data-input-scroll] + div button[class$=_primary]:hover:not(:disabled) {\n  background: var(--dsw-alias-label-secondary);\n}\n\nhtml[data-codex-ui] [data-conversation-scroll] [data-composer-card] > [data-input-scroll] + div button:focus-visible,\nhtml[data-codex-ui] [data-conversation-scroll] [data-composer-card] > [data-input-scroll] + div select:focus-visible {\n  outline: 2px solid var(--dsw-focus-ring-color);\n  outline-offset: 2px;\n}\n\nhtml[data-codex-ui] [class*=\"_heroWorkspaceRow\"] button {\n  min-height: 28px;\n  border-radius: var(--dsw-radius-pill);\n  font-size: 13px;\n  line-height: 20px;\n}\n\nhtml[data-codex-ui] [class*=\"_heroWorkspaceRow\"] button:hover,\nhtml[data-codex-ui] [class*=\"_heroWorkspaceRow\"] button[aria-expanded=true] {\n  background: color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent);\n}\n\nhtml[data-codex-ui] [data-conversation-scroll] [data-trigger-menu] {\n  box-sizing: border-box;\n  left: 0;\n  right: 0;\n  width: auto;\n  min-width: 0;\n  max-width: none;\n  padding: 5px;\n  border-radius: var(--dsw-radius-menu);\n  background: var(--dsw-codex-suggest-fill);\n  box-shadow: var(--dsw-codex-suggest-shadow);\n}\n\nhtml[data-codex-ui] [data-conversation-scroll] [data-trigger-menu] > [role=listbox] {\n  box-sizing: border-box;\n  width: 100%;\n  min-width: 0;\n  align-self: stretch;\n  scrollbar-width: thin;\n}\n\nhtml[data-codex-ui] [data-conversation-scroll] [data-trigger-menu] [role=option] {\n  box-sizing: border-box;\n  width: 100%;\n  min-width: 0;\n  min-height: 28px;\n  padding: 4px 9px;\n  gap: 8px;\n  border-radius: calc(var(--dsw-radius-menu) - 5px);\n  font-size: 13px;\n  line-height: 20px;\n}\n\nhtml[data-codex-ui] [data-conversation-scroll] [data-trigger-menu] [role=option][aria-selected=true] {\n  background: color-mix(in srgb, var(--dsw-alias-label-primary) 10%, transparent);\n}\n\nhtml[data-codex-ui] [data-phase=hero] [data-conversation-scroll][class] {\n  --dsh-composer-side-clearance: 16px;\n  justify-content: flex-start;\n  scrollbar-gutter: stable both-edges;\n}\n\nhtml[data-codex-ui] [data-phase=hero] [data-composer-seat] {\n  flex: 1 0 auto;\n  min-height: 100%;\n}\n\nhtml[data-codex-ui] [data-phase=hero] [data-composer-seat] > :has(> * > [class*=\"_composerHero\"]) {\n  display: flex;\n  flex: 1;\n  flex-direction: column;\n}\n\nhtml[data-codex-ui] [data-phase=hero] [class*=\"_composerHero\"] {\n  box-sizing: border-box;\n  flex: 1;\n  width: 100%;\n  max-width: none;\n  min-width: 0;\n  margin-inline: auto;\n  gap: 0;\n  padding-bottom: 32px;\n}\n\nhtml[data-codex-ui] [data-phase=hero] [class*=\"_heroWorkspaceRow\"] {\n  box-sizing: border-box;\n  flex: none;\n  width: min(calc(var(--dsh-composer-card-max-width) + 2 * var(--dsh-composer-side-clearance) - 56px), calc(100% - 56px));\n  align-self: center;\n  justify-content: flex-start;\n  flex-wrap: wrap;\n  gap: 8px;\n  min-height: 48px;\n  margin: 0 28px -10px;\n  padding: 6px 12px 16px;\n  border-radius: var(--dsw-radius-card) var(--dsw-radius-card) 0 0;\n  background: color-mix(in srgb, var(--dsw-alias-label-primary) 4%, var(--dsw-alias-bg-base));\n}\n\nhtml[data-codex-ui] [data-phase=hero] [class*=\"_heroWorkspaceRow\"] > [class$=\"_workspace\"] {\n  min-width: 0;\n  max-width: 100%;\n  font-weight: 400;\n}\n\nhtml[data-codex-ui] [data-queue-dock] [class*=\"_panel\"] {\n  border-radius: var(--dsw-radius-card) var(--dsw-radius-card) 0 0;\n}\n\nhtml[data-codex-ui] [data-queue-dock] [class*=\"_panel\"]::before {\n  backdrop-filter: none;\n  -webkit-backdrop-filter: none;\n}\n\nhtml[data-codex-ui] [data-queue-dock] [class*=\"_panel\"]::after {\n  border-bottom: none;\n}\n\nhtml[data-codex-ui] body[data-ds-dark-theme] [data-queue-dock] [class*=\"_panel\"]::after {\n  border-color: var(--dsw-alias-border-l3);\n}\n\nhtml[data-codex-ui] [data-queue-dock] [class*=\"_panel\"]::before {\n  background: var(--dsw-alias-bg-layer-1);\n}\n\nhtml[data-codex-ui] .cx-form {\n  display: flex;\n  flex-direction: column;\n  margin: 0;\n}\n\nhtml[data-codex-ui] .cx-row {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr) auto;\n  align-items: center;\n  column-gap: 16px;\n  padding: 10px 0;\n  border-bottom: 0.5px solid var(--dsw-alias-border-l1);\n}\n\nhtml[data-codex-ui] .cx-row:last-child {\n  border-bottom: none;\n}\n\nhtml[data-codex-ui] .cx-row__text {\n  min-width: 0;\n}\n\nhtml[data-codex-ui] .cx-row__label {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  color: var(--dsw-alias-label-primary);\n  font-size: 13px;\n  line-height: 20px;\n}\n\nhtml[data-codex-ui] .cx-row__desc {\n  margin-top: 2px;\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 11px;\n  line-height: 16px;\n}\n\nhtml[data-codex-ui] .cx-row__control {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  justify-self: end;\n}\n\nhtml[data-codex-ui] .cx-swatch {\n  width: 24px;\n  height: 24px;\n  padding: 0;\n  border: 0.5px solid var(--dsw-alias-border-l2);\n  border-radius: var(--dsw-radius-s);\n  background: none;\n  cursor: pointer;\n}\n\nhtml[data-codex-ui] .cx-swatch::-webkit-color-swatch-wrapper {\n  padding: 2px;\n}\n\nhtml[data-codex-ui] .cx-swatch::-webkit-color-swatch {\n  border: none;\n  border-radius: calc(var(--dsw-radius-s) - 2px);\n}\n\nhtml[data-codex-ui] .cx-hex {\n  width: 96px;\n  height: 24px;\n  padding: 0 8px;\n  border: 0.5px solid var(--dsw-alias-border-l2);\n  border-radius: var(--dsw-radius-s);\n  background: var(--dsw-alias-bg-base);\n  color: var(--dsw-alias-label-primary);\n  font-family: var(--ds-font-family-code);\n  font-size: 11px;\n  letter-spacing: 0.04em;\n}\n\nhtml[data-codex-ui] .cx-hex:focus-visible {\n  outline: 2px solid var(--dsw-focus-ring-color);\n  outline-offset: 1px;\n}\n\nhtml[data-codex-ui] .cx-text {\n  width: 220px;\n  height: 24px;\n  padding: 0 8px;\n  border: 0.5px solid var(--dsw-alias-border-l2);\n  border-radius: var(--dsw-radius-s);\n  background: var(--dsw-alias-bg-base);\n  color: var(--dsw-alias-label-primary);\n  font-size: 12px;\n}\n\nhtml[data-codex-ui] .cx-text:focus-visible {\n  outline: 2px solid var(--dsw-focus-ring-color);\n  outline-offset: 1px;\n}\n\nhtml[data-codex-ui] .cx-range {\n  width: 160px;\n  accent-color: var(--dsw-alias-link);\n}\n\nhtml[data-codex-ui] .cx-range__value {\n  min-width: 24px;\n  color: var(--dsw-alias-label-secondary);\n  font-family: var(--ds-font-family-code);\n  font-size: 11px;\n  text-align: right;\n}\n\nhtml[data-codex-ui] .cx-note {\n  margin: 0 0 8px;\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 11px;\n  line-height: 16px;\n}\n\nhtml[data-codex-ui] .cx-error {\n  margin: 8px 0 0;\n  color: var(--dsw-alias-state-error-primary);\n  font-size: 11px;\n  line-height: 16px;\n}\n\nhtml[data-codex-ui] [data-slot=\"settings.section\"] [class*=\"_themeCube\"][class*=\"_selected\"] {\n  border-color: var(--dsw-alias-label-primary);\n}\n\nhtml[data-codex-ui] [data-slot=\"settings.section\"] [class*=\"_stepper\"] {\n  border-radius: var(--dsw-radius-s);\n}\n\nhtml[data-codex-ui] {\n\n  --cx-sm-sidebar-w: 236px;\n  --cx-sm-row-h: 46px;\n  --cx-sm-panel-w: 760px;\n  --cx-sm-gutter: 24px;\n  --cx-sm-radius-card: var(--dsw-radius-m, 12px);\n\n  --cx-sm-radius-field: 10px;\n  --cx-sm-radius-pill: 999px;\n\n}\n\n@media (max-width: 900px) {\n  html[data-codex-ui] {\n    --cx-sm-sidebar-w: 196px;\n    --cx-sm-gutter: 14px;\n  }\n}\n\nhtml[data-codex-ui] div[data-cx-sm-panel] {\n  --cx-sm-surface-backdrop: var(--dsw-alias-bg-sidebar);\n\n  --cx-sm-card-edge: var(--dsw-alias-bg-sidebar);\n\n  --dsw-alias-bg-layer-2: var(--dsw-alias-bg-layer-1);\n  --dsw-alias-bg-layer-3: var(--dsw-alias-bg-layer-1);\n}\n\nhtml[data-codex-ui] body[data-ds-dark-theme] div[data-cx-sm-panel] {\n  --cx-sm-card-edge: var(--dsw-alias-border-l1);\n}\n\nhtml[data-codex-ui] div[data-cx-sm-panel] {\n  position: fixed;\n  inset: 0;\n  box-sizing: border-box;\n  width: auto;\n  height: auto;\n  max-width: none;\n  max-height: none;\n  border-radius: 0;\n  box-shadow: none;\n  overflow: hidden;\n\n  background: var(--cx-sm-surface-backdrop);\n}\n\nhtml[data-codex-ui][data-windows-titlebar] div[data-cx-sm-panel] {\n  padding-top: var(--dsh-windows-titlebar-height, 40px);\n}\n\nhtml[data-codex-ui][data-windows-titlebar] div[data-cx-sm-panel] button,\nhtml[data-codex-ui][data-windows-titlebar] div[data-cx-sm-panel] input,\nhtml[data-codex-ui][data-windows-titlebar] div[data-cx-sm-panel] a {\n  -webkit-app-region: no-drag;\n}\n\nhtml[data-codex-ui] div[data-cx-sm-panel] > nav {\n  position: relative;\n  box-sizing: border-box;\n  flex: 0 0 var(--cx-sm-sidebar-w);\n  width: var(--cx-sm-sidebar-w);\n  min-height: 0;\n  padding: 12px 12px 16px;\n  gap: 8px;\n  background: none;\n  overflow: hidden;\n}\n\nhtml[data-codex-ui] div[data-cx-sm-panel] > nav > div:not([data-codex-ui-injected]):not(:has(> button)) {\n  position: absolute;\n  width: 1px;\n  height: 1px;\n  margin: -1px;\n  padding: 0;\n  overflow: hidden;\n  clip-path: inset(50%);\n  white-space: nowrap;\n}\n\nhtml[data-codex-ui] div[data-cx-sm-panel] > nav > div:has(> button),\nhtml[data-codex-ui] div[data-cx-sm-panel] > nav > div:last-child {\n  box-sizing: border-box;\n  min-height: 0;\n  flex: 1 1 auto;\n  gap: 2px;\n}\n\nhtml[data-codex-ui] div[data-cx-sm-panel] > nav > div:has(> button) > button {\n  box-sizing: border-box;\n  width: 100%;\n  min-height: 32px;\n  padding: 6px 10px;\n  gap: 9px;\n  border: 0;\n  border-radius: var(--dsw-radius-s, 8px);\n  background: none;\n  color: var(--dsw-alias-label-secondary);\n  font-size: 14px;\n  line-height: 20px;\n  text-align: left;\n}\n\nhtml[data-codex-ui] div[data-cx-sm-panel] > nav > div:has(> button) > button:hover {\n  background: var(--dsw-alias-interactive-bg-hover);\n  color: var(--dsw-alias-label-primary);\n}\n\nhtml[data-codex-ui] div[data-cx-sm-panel] > nav > div:has(> button) > button[aria-current=\"true\"] {\n  background: var(--dsw-alias-interactive-bg-active);\n  color: var(--dsw-alias-label-primary);\n  font-weight: 500;\n}\n\nhtml[data-codex-ui] div[data-cx-sm-panel] > nav > div:has(> button) > button[aria-current=\"true\"]:hover {\n  background: var(--dsw-alias-interactive-bg-active);\n}\n\nhtml[data-codex-ui] div[data-cx-sm-panel] > nav > div:has(> button) > button:focus-visible {\n  outline-offset: -2px;\n}\n\nhtml[data-codex-ui] div[data-cx-sm-panel] > nav > div:has(> button) > button svg {\n  width: 16px;\n  height: 16px;\n  flex: 0 0 auto;\n  stroke-width: 1.4;\n  opacity: 0.72;\n}\n\nhtml[data-codex-ui] div[data-cx-sm-panel] > nav > div:has(> button) > button:hover svg,\nhtml[data-codex-ui] div[data-cx-sm-panel] > nav > div:has(> button) > button[aria-current=\"true\"] svg {\n  opacity: 1;\n}\n\nhtml[data-codex-ui] .cx-sm-group {\n  margin: 12px 0 4px;\n  padding: 0 10px;\n  color: var(--dsw-alias-label-caption);\n  font-size: 12px;\n  line-height: 18px;\n  font-weight: 500;\n  letter-spacing: 0.01em;\n  user-select: none;\n}\n\nhtml[data-codex-ui] :lang(zh) .cx-sm-group {\n  letter-spacing: 0;\n}\n\nhtml[data-codex-ui] .cx-sm-search + .cx-sm-group {\n  margin-top: 4px;\n}\n\nhtml[data-codex-ui] .cx-sm-back {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  box-sizing: border-box;\n  width: fit-content;\n  min-height: 28px;\n  padding: 2px 6px 2px 4px;\n  border-radius: var(--dsw-radius-s, 8px);\n  color: var(--dsw-alias-label-secondary);\n  font-size: 13px;\n  line-height: 20px;\n  cursor: pointer;\n  user-select: none;\n}\n\nhtml[data-codex-ui] .cx-sm-back:hover {\n  background: var(--dsw-alias-interactive-bg-hover);\n  color: var(--dsw-alias-label-primary);\n}\n\nhtml[data-codex-ui] .cx-sm-back svg {\n  width: 14px;\n  height: 14px;\n  flex: 0 0 auto;\n  stroke-width: 1.6;\n  opacity: 0.8;\n}\n\nhtml[data-codex-ui] .cx-sm-search {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  box-sizing: border-box;\n  width: 100%;\n  height: 32px;\n\n  padding: 0 14px;\n  border: 0;\n  border-radius: var(--cx-sm-radius-pill);\n  background: var(--dsw-alias-bg-layer-1);\n  color: var(--dsw-alias-label-tertiary);\n}\n\nhtml[data-codex-ui] .cx-sm-search:focus-within {\n  box-shadow: inset 0 0 0 1px var(--dsw-alias-border-l3);\n}\n\nhtml[data-codex-ui] .cx-sm-search svg {\n  width: 14px;\n  height: 14px;\n  flex: 0 0 auto;\n  stroke-width: 1.6;\n  opacity: 0.7;\n}\n\nhtml[data-codex-ui] .cx-sm-search input {\n  box-sizing: border-box;\n  flex: 1 1 auto;\n  min-width: 0;\n  height: 100%;\n  padding: 0;\n  border: 0;\n  outline: 0;\n  background: none;\n  color: var(--dsw-alias-label-primary);\n  font: inherit;\n  font-size: 13px;\n  line-height: 20px;\n}\n\nhtml[data-codex-ui] .cx-sm-search input::placeholder {\n  color: var(--dsw-alias-label-caption);\n}\n\nhtml[data-codex-ui] div[data-cx-sm-panel] > div:last-child {\n  box-sizing: border-box;\n  flex: 1 1 auto;\n  min-width: 0;\n  min-height: 0;\n\n  background: var(--dsw-alias-bg-base);\n\n  overflow: hidden;\n}\n\nhtml[data-codex-ui] div[data-cx-sm-panel] > div:last-child > div:first-child {\n  box-sizing: border-box;\n  flex: 0 0 auto;\n  align-items: center;\n  min-height: 52px;\n  padding: 12px var(--cx-sm-gutter) 8px;\n}\n\nhtml[data-codex-ui] div[data-cx-sm-panel] > div:last-child > div:last-child {\n  box-sizing: border-box;\n  flex: 1 1 auto;\n  min-height: 0;\n  padding: 2px var(--cx-sm-gutter) 0;\n}\n\nhtml[data-codex-ui] div[data-cx-sm-panel] > div:last-child > div:last-child [data-slot=\"settings.section\"] > * {\n  box-sizing: border-box;\n  width: 100%;\n  max-width: var(--cx-sm-panel-w);\n  margin-left: auto;\n  margin-right: auto;\n\n  padding-bottom: 40px;\n}\n\nhtml[data-codex-ui] div[data-cx-sm-panel] [data-slot=\"settings.action\"] button {\n  box-sizing: border-box;\n  height: 32px;\n  padding: 0 12px;\n\n  white-space: nowrap;\n  border: 0.5px solid var(--dsw-alias-border-l2);\n  border-radius: var(--dsw-radius-s, 8px);\n  background: var(--dsw-alias-button-elevated-fill);\n  color: var(--dsw-alias-label-primary);\n  font-size: 13px;\n  line-height: 1;\n  cursor: pointer;\n}\n\nhtml[data-codex-ui] div[data-cx-sm-panel] [data-slot=\"settings.action\"] button:hover {\n  background: var(--dsw-alias-interactive-bg-hover);\n  border-color: var(--dsw-alias-border-l3);\n}\n\nhtml[data-codex-ui] div[data-cx-sm-panel] button:has([data-slot=\"settings.close\"]) {\n  display: none;\n}\n\nhtml[data-codex-ui] .cx-sm-pagehead {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 16px;\n  box-sizing: border-box;\n  width: 100%;\n  min-height: 36px;\n  margin: 0 0 12px;\n}\n\nhtml[data-codex-ui] .cx-sm-title,\nhtml[data-codex-ui] .cx-sm-pagehead > h1,\nhtml[data-codex-ui] .cx-sm-pagehead > h2 {\n  margin: 0;\n  padding: 0;\n  color: var(--dsw-alias-label-primary);\n\n  font-size: 20px;\n  line-height: 26px;\n  font-weight: 600;\n  letter-spacing: -0.01em;\n}\n\nhtml[data-codex-ui] :lang(zh) .cx-sm-title,\nhtml[data-codex-ui] :lang(zh) .cx-sm-pagehead > h1,\nhtml[data-codex-ui] :lang(zh) .cx-sm-pagehead > h2 {\n  letter-spacing: 0;\n}\n\nhtml[data-codex-ui] div[data-cx-sm-panel] [data-slot=\"settings.section\"] > * {\n  box-sizing: border-box;\n  width: 100%;\n  gap: 0;\n  padding-top: 2px;\n}\n\nhtml[data-codex-ui] div[data-cx-sm-panel] [data-slot=\"settings.general.item\"] > * {\n  box-sizing: border-box;\n  min-height: var(--cx-sm-row-h);\n  padding: 8px 16px;\n  border-style: solid;\n  border-color: var(--cx-sm-card-edge);\n  border-width: 0.5px 0;\n\n  background: var(--dsw-alias-bg-layer-1);\n  transition: background-color var(--dsw-motion-fast, 150ms) var(--dsw-ease, ease);\n}\n\nhtml[data-codex-ui] div[data-cx-sm-panel] [data-slot=\"settings.section\"] > :first-child > [data-slot=\"settings.general.item\"] > *:first-child {\n  border-top-width: 0.5px;\n  border-left-width: 0.5px;\n  border-right-width: 0.5px;\n  border-radius: var(--cx-sm-radius-card) var(--cx-sm-radius-card) 0 0;\n}\n\nhtml[data-codex-ui] div[data-cx-sm-panel] [data-slot=\"settings.section\"] > :first-child > [data-slot=\"settings.general.item\"] > *:last-child {\n  border-bottom-width: 0.5px;\n  border-left-width: 0.5px;\n  border-right-width: 0.5px;\n  border-radius: 0 0 var(--cx-sm-radius-card) var(--cx-sm-radius-card);\n}\n\n     html[data-codex-ui] .<hash>_card { background: var(--dsw-alias-settings-card-fill) }\n     html[data-codex-ui] .<hash>_cardActive { background: var(--dsw-alias-bg-module-platform) }\n   html[data-codex-ui] —— 它们**吃令牌**，不是硬编码灰。该令牌由宿主主题包 dsh-client-ui-theme 在\n   **body** 上声明为 var(--dsw-alias-settings-card-fill: var(--dsw-alias-bg-layer-2))；\n   本机 app.asar 全文扫描里，该令牌的**声明**只有这一处，另 4 处都是 background 消费点。\n   皮肤把它同名重定义成 layer-1（skin.css：html[data-codex-ui],\nhtml[data-codex-ui] body），\n   特异性与顺序都压过宿主的 body 声明 —— 白卡 / 深色 #212121 因此**自动生效**。\n\n   旧注释怎么错的（一并记下，免得后人再被同一个坑骗）：\n   旧文写「#f3f3f3 硬编码、换色试验证明不走任何令牌」。那个换色试验是在 §4.3 规则**还在**的\n   前提下做的 —— §4.3 以特异性 (0,3,3) 压过宿主的 (0,1,0)，无论令牌被改成什么，卡都会保持\n   §4.3 写死的 layer-1，于是「0 个元素跟随」是这条规则生效的**必然结果**，推不出「卡不读令牌」。\n   定案靠的是宿主源码里那两条 background 声明，不是那个试验。\n   （二审结论见 docs/recon/second-pass-review.md 的 M1/M2。）\n\n   **删除理由**（三条，任一条都够）：\n     ① 同值重复：皮肤已把该令牌定成 layer-1，§1 的 layer-2/3→layer-1 重定向同样落上去，\n        这条规则写的是**同一个值**，三层路径同值，将来改一处根本无法判断谁在生效；\n     ② 覆盖面无意义：它靠特异性 (0,3,3) 压过宿主 .rowCard/.card 的 (0,1,0)，\n        而值相同 —— 赢了也没有任何视觉差异；\n     ③ **会漂**：[class$=\"_card\"] 匹配的是「整条 class 属性以该后缀结尾」，\n        覆盖面随宿主状态类的书写顺序漂移。实测 Agent 预设的选中卡是\n        class=\"rtSEdW_card rtSEdW_cardActive\"（以 _cardActive 结尾）→ 今天**不命中**、\n        靠宿主自己的 .cardActive {background: var(--dsw-alias-bg-module-platform)} html[data-codex-ui] 保住选中底色，\n        纯属侥幸；一旦宿主把状态类挪到前面，选中卡会被压成 layer-1，**选中态视觉当场丢失，\n        而没有任何断言会红**。删除即消除这条会随宿主改版静默劣化的路径。\n\n   删除后的着色机制**唯一**：--dsw-alias-settings-card-fill（skin.css 定义）\n   → 未选中卡 = layer-1（浅 #ffffff / 深 #212121）。选中卡保持宿主自己的\n   bg-module-platform（浅 #f9f9f9）—— 与未选中卡不同色，选中态仍可区分。\n   这条路径由 scripts/settings-modal-verify.mjs 的两条集成断言把守\n   （未选中卡 == var(--dsw-alias-bg-layer-1) 的计算值；选中卡背景 ≠ 未选中卡背景）。 */\n\nhtml[data-codex-ui] div[data-cx-sm-panel] [data-slot=\"settings.section\"] > :first-child > [data-slot=\"settings.general.item\"] > *:not(:first-child):not(:last-child) {\n  border-radius: 0;\n}\n\nhtml[data-codex-ui] div[data-cx-sm-panel] [data-slot=\"settings.general.item\"] > *:hover {\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n\nhtml[data-codex-ui] div[data-cx-sm-panel] [data-slot=\"settings.general.item\"] > * > :first-child > div:not(:first-child) {\n  color: var(--dsw-alias-label-caption);\n}\n\nhtml[data-codex-ui] [data-cx-sm-hidden],\nhtml[data-codex-ui] .cx-sm-hidden {\n  display: none !important;\n}\n\nhtml[data-codex-ui] .cx-sm-empty {\n  box-sizing: border-box;\n  padding: 32px 8px;\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 13px;\n  line-height: 20px;\n  text-align: center;\n}\n\nhtml[data-codex-ui] [data-codex-ui-injected=\"settings-modal\"],\nhtml[data-codex-ui] [data-codex-ui-injected=\"settings-modal\"] * {\n  box-sizing: border-box;\n}\n\nhtml[data-codex-ui] .codex-te-exit {\n  position: fixed;\n  z-index: 1090;\n  box-sizing: border-box;\n  display: inline-flex;\n  align-items: center;\n  height: 26px;\n  padding: 0 11px;\n  border: 0;\n  border-radius: 999px;\n  background: var(--dsw-alias-bg-layer-1);\n  color: var(--dsw-alias-label-secondary);\n  box-shadow: var(--dsw-codex-menu-shadow);\n  font-family: inherit;\n  font-size: 13px;\n  line-height: 20px;\n  white-space: nowrap;\n  cursor: pointer;\n  transition: color var(--dsw-motion-fast), background-color var(--dsw-motion-fast);\n}\n\nhtml[data-codex-ui] .codex-te-exit:hover {\n  color: var(--dsw-alias-label-primary);\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n\nhtml[data-codex-ui] .codex-te-exit:focus-visible {\n  outline: 2px solid var(--dsw-focus-ring-color);\n  outline-offset: 2px;\n}\n\n@media (prefers-reduced-motion: reduce) {\n  html[data-codex-ui] .codex-te-exit {\n    transition: none;\n  }\n}\n";
return { THEME_CSS };
})();

/* src/client/stylesheet.js */
const __src_client_stylesheet = (() => {
const { THEME_CSS } = __codex_ui_theme_css;
const { PLUGIN_ID, ROOT_ATTR } = __src_client_constants;
/**
 * 皮肤样式：打上作用域根属性，注入内联的 theme.css（DSH 只下发 client.js，样式只能随它走）。
 * style[data-plugin] 是宿主的约定：插件卸载、热更新时模块系统会按它收走样式。
 */



function installStylesheet(ctx) {
  const root = document.documentElement;
  root.setAttribute(ROOT_ATTR, '');
  const tag = document.createElement('style');
  tag.dataset.plugin = PLUGIN_ID;
  tag.dataset.pluginCss = PLUGIN_ID + '/theme.css';
  tag.textContent = THEME_CSS;
  document.head.appendChild(tag);
  ctx.effect(() => () => {
    tag.remove();
    root.removeAttribute(ROOT_ATTR);
  }, 'codex-ui: stylesheet');
}
return { installStylesheet };
})();

/* src/client/trajectory-exit.js */
const __src_client_trajectory_exit = (() => {
const { PLUGIN_ID, TE_READY_ATTR } = __src_client_constants;
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
function installTrajectoryExit(ctx) {
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
return { installTrajectoryExit };
})();

/* src/client/index.js */
const __src_client_index = (() => {
const { installModelPicker } = __src_client_model_picker_index;
const { installSettings } = __src_client_settings;
const { installSettingsModal } = __src_client_settings_modal;
const { installStylesheet } = __src_client_stylesheet;
const { installTrajectoryExit } = __src_client_trajectory_exit;
/**
 * codex-ui 浏览器半入口（DSH 客户端插件：导出 inject 与 apply，由 scripts/build.mjs 打成 client.js）。
 *
 * 功能按顺序装配：皮肤样式 → 设置（覆盖层、主题预览、配置卡）→ 模型选择器 → 设置模态框结构层。
 * 样式先挂且不包 try：它是插件本体；其余任何一项失败都只降级，不连累皮肤。
 * 新功能 = src/client/ 下一个模块导出 install(ctx) + 这里一行。
 */






/**
 * cordis **服务名**（不是包名）：loader 逐个等它们就绪，缺一个本插件就不激活。
 * 只放必需的；可有可无的服务（modelDirectories）走 ctx.inject 子作用域。
 */
const inject = ['slots', 'configForms', 'theme'];

function apply(ctx) {
  installStylesheet(ctx);
  let form = null;
  try {
    form = installSettings(ctx);
  } catch (error) {
    console.warn('[codex-ui] 设置页挂载失败，皮肤照常：', error);
  }
  try {
    installModelPicker(ctx, form);
  } catch (error) {
    console.warn('[codex-ui] 模型选择器挂载失败，宿主原生菜单照常：', error);
  }
  /* 设置模态框的结构层（返回按钮 / 搜索 / 分组）：与设置表单彼此独立，谁挂不上都不连累对方。 */
  try {
    installSettingsModal(ctx);
  } catch (error) {
    console.warn('[codex-ui] 设置模态框结构层挂载失败，其余功能照常：', error);
  }
  /* ⑬ 隐去页签条后「轨迹」只剩入口没有出口：浮一个「← 对话」。宿主结构不符就整体不挂。 */
  try {
    installTrajectoryExit(ctx);
  } catch (error) {
    console.warn('[codex-ui] 轨迹退出出口挂载失败，其余功能照常：', error);
  }
}
return { inject, apply };
})();

return { apply: __src_client_index.apply, inject: __src_client_index.inject };
  },
});
