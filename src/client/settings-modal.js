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

import { isEnglish } from './host.js';

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
export function installSettingsModal(ctx) {
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
