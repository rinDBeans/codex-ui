/**
 * 组合包页（插件管理 → codex-ui）上的配置卡。宿主只以 view:'page' 渲染这个座位。
 * 改一下即写、没有保存按钮；文本框回车或失焦提交，写后回读确认落地；已覆盖的行显示徽标与「重置」。
 * 下面三行颜色编辑的是**当前生效的那一套**（theme.getTheme().active.colorScheme）。
 */
import { cloneElement, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { jsx, jsxs } from 'react/jsx-runtime';
import { Button, SegmentedControl, Switch, Tag } from '@deepseek-ai/dsh-client-ui-primitives';
import { isEnglish } from './host.js';
import { DEFAULT_CONTRAST, SKIN_DEFAULTS, isFontStack, isHex } from './override.js';

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
export function SettingsCard({ scope, theme, themeForm, watchTheme, previewTheme, locale }) {
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
