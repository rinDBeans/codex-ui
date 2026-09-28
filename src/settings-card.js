/* ============================================================================
   设置卡片：Codex 主题面板（座位 plugins.bundle.config）
   ----------------------------------------------------------------------------
   构建期由 src/build.mjs 拼进 client.js 的 factory 体内 —— 这里可以直接用
   外层的 require、__override、PLUGIN_ID，也**不要**写成独立模块。

   契约（照 dsh-chat-ux 的同一座位实现）：
     · 座位键 = npm 包名 codex-ui；表单命名空间 = profile 条目 id，两者都是 'codex-ui'；
     · 改一下即写、没有保存按钮；文本框回车或失焦提交；写后回读确认落地；
     · 「已覆盖」= 用户层含该字段；「重置」= unset 掉用户层那一格；
     · view === 'summary' 时只回一行摘要（组合包页折叠态用）。
     · 「主题」那一行写的是**宿主主题偏好**，走 ctx.theme 服务（@deepseek-ai/dsh-client-ui-theme
       用 ctx.provide("theme", …) 提供）：getTheme() → { preference, active:{ colorScheme }, themes }，
       setTheme(id) 是唯一用户偏好写入口（id ∈ light/dark/system），变更经 ctx.on('theme/change') 广播。
       下面三行颜色编辑的是**当前生效的那一套**（active.colorScheme），不是另一套的暂存。
   ========================================================================== */

const REACT = (() => {
  try { return require('react'); } catch { return null; }
})();
const JSX = (() => {
  try { return require('react/jsx-runtime'); } catch { return null; }
})();
const PRIMITIVES = (() => {
  try { return require('@deepseek-ai/dsh-client-ui-primitives'); } catch { return null; }
})();

/** 三组颜色字段：面板一行 = 亮/暗两个 Config 字段。 */
const COLOR_ROWS = [
  ['accent', 'accentLight', 'accentDark'],
  ['surface', 'surfaceLight', 'surfaceDark'],
  ['ink', 'inkLight', 'inkDark'],
];

/** 文案。zh 为底，en 覆盖 —— 认不出英文就落中文。 */
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
  follow: '跟随皮肤',
  failed: '保存没生效，请重试。',
  unavailable: '这个 dsh 没有把 codex-ui 的配置开放给本页：条目可能在本 profile 里被停用，或连接把偏好留在页面进程内。',
  readOnly: '设置文档是只读的，改动无法保存。',
  noPrimitives: '这个 dsh 没有提供设置控件包（@deepseek-ai/dsh-client-ui-primitives），无法渲染表单。',
  summary: (parts) => parts.join(' · '),
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
  follow: 'Follow skin',
  failed: 'The save did not take effect. Please try again.',
  unavailable: 'This dsh does not expose codex-ui configuration to this page: the entry may be disabled in this profile, or the connection keeps preferences inside the page process.',
  readOnly: 'The settings document is read-only, so changes cannot be saved.',
  noPrimitives: 'This dsh ships no settings primitives package (@deepseek-ai/dsh-client-ui-primitives), so the form cannot render.',
  summary: (parts) => parts.join(' · '),
};

/** 用户层是否含这一格（= 已覆盖）。 */
function hasUserField(snapshot, field) {
  const user = snapshot === undefined || snapshot === null ? null : snapshot.user;
  return user !== undefined && user !== null && Object.prototype.hasOwnProperty.call(user, field);
}

/** 取当前生效值。 */
function fieldValue(snapshot, field) {
  const value = snapshot === undefined || snapshot === null ? null : snapshot.value;
  return value === undefined || value === null ? undefined : value[field];
}

/** 认语言：先问 locale 服务，再问浏览器，认不出英文就中文。 */
function pickCopy(locale) {
  let active = null;
  try { active = locale ? locale.getSnapshot().active : null; } catch { active = null; }
  const tag = active !== null && active !== undefined ? active : (typeof navigator === 'undefined' ? null : navigator.language);
  return typeof tag === 'string' && tag.toLowerCase().startsWith('en') ? COPY_EN : COPY_ZH;
}

/**
 * 读宿主主题快照的**原始对象**。
 * 必须是稳定引用：useSyncExternalStore 按引用比较快照，每次 new 一个对象会把它推进
 * 「getSnapshot 每次都在变」的死循环（React 直接抛错、卡片整个不渲染）。
 * 宿主自己的 getTheme() 在两次变更之间就返回同一个冻结对象，所以直接透传；
 * 读失败时回落到下面这个模块级常量（也是稳定引用）。
 * @param service - ctx.theme。
 * @returns 宿主快照，或固定的回落对象。
 */
const THEME_FALLBACK = Object.freeze({ preference: null, active: Object.freeze({ colorScheme: null }) });
function themeSnapshotOf(service) {
  try {
    const snap = service.getTheme();
    return snap === undefined || snap === null ? THEME_FALLBACK : snap;
  } catch {
    return THEME_FALLBACK;
  }
}

/**
 * 渲染 codex-ui 的配置。
 * @param props - 座位注入的 scope / theme / watchTheme / locale，以及宿主给的视图。
 * @returns 表单，或组合包页要的一行摘要。
 */
function CodexUiSettingsCard({ scope, theme, themeForm, watchTheme, previewTheme, locale, view }) {
  if (REACT === null || JSX === null) {
    return JSX === null && REACT === null ? null : null;
  }
  const { useCallback, useMemo, useState, useSyncExternalStore } = REACT;
  const { jsx, jsxs } = JSX;
  const snapshot = useSyncExternalStore(
    useCallback((listener) => scope.subscribe(listener), [scope]),
    () => scope.getSnapshot(),
  );
  /* 订阅走宿主事件；快照用宿主的稳定对象，派生值在渲染里算（见 themeSnapshotOf 的注释）。 */
  const themeSnapshot = useSyncExternalStore(
    useCallback((listener) => {
      if (typeof watchTheme !== 'function') return () => {};
      return watchTheme(() => listener());
    }, [watchTheme]),
    useCallback(() => themeSnapshotOf(theme), [theme]),
  );
  const copy = useMemo(() => pickCopy(locale), [locale]);
  /* preference 是偏好档（light/dark/system）；variant 是它当前解析出的那一套。 */
  const preference = themeSnapshot.preference;
  const scheme = themeSnapshot.active === undefined || themeSnapshot.active === null ? null : themeSnapshot.active.colorScheme;
  const onBody = typeof document !== 'undefined' && document.body !== null && document.body.hasAttribute('data-ds-dark-theme') ? 'dark' : 'light';
  const variant = scheme === 'dark' || scheme === 'light' ? scheme : onBody;
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  /* 分段控件上先显示用户点的那个值：写文档是异步的，不暂存的话控件会滞后一拍。 */
  const [pendingTheme, setPendingTheme] = useState(null);
  const { useEffect } = REACT;
  useEffect(() => {
    if (pendingTheme !== null && pendingTheme === preference) setPendingTheme(null);
  }, [pendingTheme, preference]);

  const fieldOf = useCallback((base) => base + (variant === 'light' ? 'Light' : 'Dark'), [variant]);
  /**
   * 切主题。
   *
   * 不调 `theme.setTheme(id)`：那是「先本地乐观发布、再让 adopt() 从文档回读」的写法 ——
   * 文档往返慢的时候会依次画出 新值 → 旧值 → 新值（用户看到的「黑 → 白 → 黑」）。
   * 这里改成**先把偏好写进主题插件自己的设置文档**（宿主源码里的命名空间 `ui-theme`、
   * 字段 `preference`，与服务内部 host.set 的那一次写完全同路），
   * 于是发布方只剩服务自己的 adopt()，一次点击只会发布一次。
   * 写入未被接受才退回服务入口，保证功能不会因为这条捷径失效。
   *
   * 那 0.8s 的往返不能白等：点下去先让浏览器半**本地预览**目标主题（立刻变颜色），
   * 宿主确认到达时那边会幂等地交还，所以既快又不会二次跳变。
   * @param id - 'light' | 'dark' | 'system'。
   */
  const switchTheme = useCallback(async (id) => {
    if (id !== 'light' && id !== 'dark' && id !== 'system') return;
    setPendingTheme(id);
    if (typeof previewTheme === 'function') previewTheme(id);
    const canWriteForm = themeForm !== null && themeForm !== undefined && typeof themeForm.set === 'function';
    if (canWriteForm) {
      try {
        if ((await themeForm.set('preference', id)) !== false) return;
      } catch (error) {
        console.warn('[codex-ui] 直接写主题偏好失败，退回服务入口：', error);
      }
    }
    setPendingTheme(null);
    try {
      theme.setTheme(id);
    } catch (error) {
      console.warn('[codex-ui] 切主题失败：', error);
    }
  }, [theme, themeForm]);
  const unavailable = snapshot.status === 'unavailable';
  const readOnly = snapshot.writable === false;
  const disabled = saving || unavailable || readOnly;

  /** 写入一格并回读确认。 */
  const write = useCallback(async (field, next) => {
    setSaving(true);
    setFailed(false);
    let landed = false;
    try {
      const accepted = await scope.set(field, next);
      landed = accepted !== false && fieldValue(scope.getSnapshot(), field) === next;
    } catch { landed = false; }
    setFailed(!landed);
    setSaving(false);
  }, [scope]);

  /** 清掉用户层的覆盖。 */
  const clear = useCallback(async (field) => {
    setSaving(true);
    setFailed(false);
    let landed = false;
    try {
      await scope.unset(field);
      landed = !hasUserField(scope.getSnapshot(), field);
    } catch { landed = false; }
    setFailed(!landed);
    setSaving(false);
  }, [scope]);

  /** 提交一个文本/色值草稿：空串写的是清除。 */
  const commitText = useCallback(async (field, draft, validate) => {
    const text = String(draft).trim();
    if (text !== '' && validate(text) === false) return;
    setDrafts((prev) => { const next = { ...prev }; delete next[field]; return next; });
    if (text === '') { await clear(field); return; }
    await write(field, text);
  }, [clear, write]);

  const draftOf = (field) => (Object.prototype.hasOwnProperty.call(drafts, field) ? drafts[field] : undefined);
  const setDraft = (field, value) => setDrafts((prev) => ({ ...prev, [field]: value }));

  if (view === 'summary') {
    const accent = fieldValue(snapshot, fieldOf('accent'));
    const contrast = fieldValue(snapshot, fieldOf('contrast'));
    const parts = [];
    if (__override.isHex(accent)) parts.push(accent);
    parts.push(copy.contrast + ' ' + String(contrast ?? __override.DEFAULT_CONTRAST[variant]));
    return jsx('span', { children: copy.summary(parts) });
  }
  if (unavailable) {
    return jsx('p', { className: 'cx-note', role: 'status', children: copy.unavailable });
  }
  if (PRIMITIVES === null) {
    return jsx('p', { className: 'cx-note', role: 'status', children: copy.noPrimitives });
  }
  const { Button, SegmentedControl, Switch, Tag } = PRIMITIVES;

  /** 一行：标签 + 说明 + 覆盖徽标 + 控件。 */
  const row = (key, label, desc, control, field) => jsxs('div', {
    className: 'cx-row',
    children: [
      jsxs('div', {
        className: 'cx-row__text',
        children: [
          jsxs('div', {
            className: 'cx-row__label',
            children: [
              jsx('span', { children: label }),
              field !== undefined && hasUserField(snapshot, field) ? jsx(Tag, { tone: 'outline', children: copy.overridden }) : null,
            ],
          }, 'label'),
          desc === null ? null : jsx('div', { className: 'cx-row__desc', children: desc }),
        ],
      }, 'text'),
      jsxs('div', {
        className: 'cx-row__control',
        children: [
          control,
          field !== undefined && hasUserField(snapshot, field)
            ? jsx(Button, { variant: 'ghost', size: 'sm', disabled, onClick: () => clear(field), children: copy.reset })
            : null,
        ],
      }, 'control'),
    ],
  }, key);

  /** 颜色行：色块 + 十六进制文本框。 */
  const colorRow = (base, label, desc) => {
    const field = fieldOf(base);
    const current = fieldValue(snapshot, field);
    const draft = draftOf(field);
    const text = draft !== undefined ? draft : (__override.isHex(current) ? current : '');
    return row(base, label, desc, [
      jsx('input', {
        key: 'swatch',
        className: 'cx-swatch',
        type: 'color',
        disabled,
        'aria-label': label,
        value: __override.isHex(current) ? current : __override.SKIN_DEFAULTS[variant][base],
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
        onBlur: () => { if (draftOf(field) !== undefined) commitText(field, draftOf(field), __override.isHex); },
        onKeyDown: (event) => { if (event.key === 'Enter') commitText(field, draftOf(field) ?? text, __override.isHex); },
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
      onBlur: () => { if (draftOf(field) !== undefined) commitText(field, draftOf(field), __override.isFontStack); },
      onKeyDown: (event) => { if (event.key === 'Enter') commitText(field, draftOf(field) ?? text, __override.isFontStack); },
    }), field);
  };

  /** 对比度行：滑杆 + 读数，拖动时只改草稿，松手/失焦才写。 */
  const contrastRow = () => {
    const field = fieldOf('contrast');
    const current = fieldValue(snapshot, field);
    const base = current === undefined || current === null ? __override.DEFAULT_CONTRAST[variant] : current;
    const draft = draftOf(field);
    const shown = draft !== undefined ? draft : base;
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
        onPointerUp: () => { if (draftOf(field) !== undefined) write(field, draftOf(field)); },
        onKeyUp: () => { if (draftOf(field) !== undefined) write(field, draftOf(field)); },
        onBlur: () => { if (draftOf(field) !== undefined) write(field, draftOf(field)); },
      }),
      jsx('span', { key: 'value', className: 'cx-range__value', children: String(shown) }),
    ], field);
  };

  const translucent = fieldValue(snapshot, 'translucentSidebar') === true;

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
    colorRow('accent', copy.accent, copy.accentDesc),
    colorRow('surface', copy.surface, copy.surfaceDesc),
    colorRow('ink', copy.ink, copy.inkDesc),
    fontRow('fontUi', copy.fontUi, copy.fontUiDesc),
    fontRow('fontCode', copy.fontCode, copy.fontCodeDesc),
    row('translucent', copy.translucent, copy.translucentDesc, jsx(Switch, {
      checked: translucent,
      disabled,
      label: copy.translucent,
      onChange: (next) => write('translucentSidebar', next),
    }), 'translucentSidebar'),
    row('modelPicker', copy.modelPicker, copy.modelPickerDesc, jsx(Switch, {
      /* 默认开：用户层没有这一格（或值不是 false）都算开着。 */
      checked: fieldValue(snapshot, 'modelPicker') !== false,
      disabled,
      label: copy.modelPicker,
      onChange: (next) => write('modelPicker', next),
    }), 'modelPicker'),
    contrastRow(),
    readOnly ? jsx('p', { className: 'cx-note', role: 'status', children: copy.readOnly }) : null,
    failed ? jsx('p', { className: 'cx-error', role: 'status', children: copy.failed }) : null,
    ],
  }, 'form');
}

/**
 * 把卡片挂到组合包页的座位上。
 * @param ctx - 客户端上下文。
 * @param Card - 卡片组件。
 * @param extras - 额外的注入面（宿主 theme 服务、它的设置表单、变更订阅）。
 */
function registerSettingsCard(ctx, Card, extras = {}) {
  ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
    name: 'plugins.bundle.config',
    key: PLUGIN_ID,
    inject: () => ({
      scope: ctx.configForms.get(__override.SETTINGS_ENTRY_ID),
      /* 宿主主题服务、它的设置表单、变更订阅、本地预览：卡片上「主题」那一行的读写通道。 */
      theme: extras.theme,
      themeForm: extras.themeForm,
      watchTheme: extras.watchTheme,
      previewTheme: extras.previewTheme,
      /* locale 缺席时 inject 会给 undefined，卡片自己回落到浏览器语言。 */
      locale: ctx.reflect.get('locale'),
    }),
  }, Card));
}
