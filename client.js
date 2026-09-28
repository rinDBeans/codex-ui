/**
 * codex-ui — Browser half（唯一样式源是 skins/codex-ink，经 src/build.mjs 生成；本文件是模板，勿手改）。
 *
 * 职责四件：
 *   1. 把 skins/codex-ink 的整套 Codex 化样式（L1/L2 令牌 + L3 组件层 + 设置页层）
 *      以作用域 html[data-codex-ui] 注入到文档，并在卸载时完整收回；
 *   2. 把设置页的取值渲染成一层覆盖（多一个属性 ⇒ 特异性压过皮肤，源样式一个字不动）；
 *   3. 在官方插件管理的组合包页（座位 plugins.bundle.config）注册那张配置卡；
 *   4. 用自建组件顶替 composer 的模型位（Codex 模型列表 + 推理等级功率轨），设置里可关。
 * 不依赖 skin-center / dsh-web-all：样式文本随本文件一起下发，无外部请求。
 */
window.__ModuleLoader__.load({
  id: 'codex-ui',
  factory: (require) => {
    /** 插件 id：style 标签归属标记，同时也是组合包座位的键。 */
    const PLUGIN_ID = 'codex-ui';
    /** 作用域根属性：所有规则都挂在它下面，卸载即整层失效。 */
    const ROOT_ATTR = 'data-codex-ui';
    /**
     * 切主题时临时打的属性：皮肤里有一条 `html[data-codex-ui-switching] * { transition: none }`。
     * 主题切换会让整个页面的 token 同时换值，若各处还有 background/color 过渡，就是一次交叉淡出 ——
     * 元素半旧半新的那几帧看起来就是「闪」。打上它、过两个 rAF 摘掉，切换变成一次到位。
     */
    const SWITCH_ATTR = 'data-codex-ui-switching';
    /**
     * 本地预览标记：用户点了主题之后，宿主要把偏好写进设置文档、再回读，实测往返 ~0.8s。
     * 这一层让「点下去」与「变颜色」之间不等那个往返：立刻按目标主题应用，
     * 等 `theme/change` 带着同一个结果回来就交还给宿主；超时没等到就按真值回滚。
     * 它只写宿主本来就会写的两处（body[data-ds-dark-theme] 与 html 的 color-scheme），
     * 因此确认到达时是幂等的，不会出现第二次跳变。
     */
    const PREVIEW_ATTR = 'data-codex-ui-preview';
    /** 预览等待上限：够一次文档往返（实测 ~0.8s）再多给一倍余量。 */
    const PREVIEW_TIMEOUT_MS = 2500;
    /** 生成期注入的样式表文本。 */
    const CSS = "/* ==== L1/L2 令牌与排版层（源：skins/codex-ink/skin.css）==== */\n/* ============================================================================\n   codex-ink（墨白终端）· L1 令牌层 + L2 排版层\n   ----------------------------------------------------------------------------\n   设计母题：OpenAI Codex / ChatGPT 系 —— 界面消失，只剩内容与光标。\n   黑白灰是 chrome，彩色只配给状态。\n\n   本文件只做两件事：\n     1) 把官方 --dsw-alias-* / --dsw-specific-* 语义令牌重映射到墨白灰阶；\n     2) 补齐官方缺失的 spacing / radius / typography-scale / motion / elevation 令牌层。\n\n   纪律：\n     · 不出现任何 url()、@import、远程地址、内联 JS（skin-center 安全管线白名单）；\n     · 亮色令牌同时落在 :root 与 body —— 官方亮色令牌声明在 body 上，\n       只写 :root 会被 body 自身声明盖掉（加载器会把本文件强制限定在\n       html[data-dsh-skin=\"codex-ink\"] 之下，从而取得高于官方的特异性）；\n     · 彩色白名单：state 三色 + diff 红绿 + 徽标底色 + 焦点环（Codex --color-border-focus 蓝 #339CFF），\n      其余一律墨/灰。\n   ========================================================================== */\n\n/* ── 亮色主题 ────────────────────────────────────────────────────────────── */html[data-codex-ui],html[data-codex-ui] body{\n  color-scheme: light;\n\n  /* 画布自持：底色由本皮肤自己画在 html 与 body 上，不指望宿主那一帧是否已把 token 换好。\n     主题切换时的闪，十有八九是「某一帧没人画底」—— 那时露出的是 UA/宿主的默认画布色。 */\n  background-color: #ffffff;\n\n  /* 底色：白 → #F9F9F9 → #F1F1EF → #E5E5E5 四档灰阶即层级 */\n  --dsw-alias-bg-base: #ffffff;\n  --dsw-alias-bg-sidebar: #eef4f9; /* Codex 亮色侧栏实测取样（350×1377 截图点采样 = #EEF4F9） */\n  --dsw-alias-bg-layer-1: #ffffff;\n  --dsw-alias-bg-layer-2: #f1f1ef;\n  --dsw-alias-bg-layer-3: #e5e5e5;\n  --dsw-alias-bg-overlay: rgba(255, 255, 255, 0.88);\n  --dsw-alias-bg-module-platform: #f9f9f9;\n  --dsw-alias-bg-multi-select: #e5e5e5;\n  --dsw-alias-bg-skeleton: rgba(13, 13, 13, 0.05);\n\n  /* 描边：发丝即层级 */\n  --dsw-alias-border-l1: rgba(13, 13, 13, 0.07);\n  --dsw-alias-border-l2: rgba(13, 13, 13, 0.12);\n  --dsw-alias-border-l3: rgba(13, 13, 13, 0.18);\n  --dsw-alias-border-l4: rgba(13, 13, 13, 0.24);\n  --dsw-alias-border-l2-darkmode-thin: rgba(13, 13, 13, 0.09);\n\n  /* 文字：墨 / 次墨 / 辅墨。前景取 Codex 浅色主题的「前景」实测值 #1A1C1F\n     （冷调，不是纯黑；取色面板截图 assets/reference/codex-theme-light.png）。 */\n  --dsw-alias-label-primary: #1a1c1f;\n  --dsw-alias-label-primary-dimmed: #5d5d5d;\n  --dsw-alias-label-primary-inverted: #ffffff;\n  --dsw-alias-label-primary-foreground: #ffffff;\n  --dsw-alias-label-primary-bluish: #0d0d0d;\n  --dsw-alias-label-secondary: #5d5d5d;\n  --dsw-alias-label-tertiary: #767676;\n  --dsw-alias-label-caption: #767676;\n  --dsw-alias-label-dimmed: #c9c9c9;\n\n  /* 主行动 = 墨块（全界面视觉重量最高的元素，无需任何品牌色） */\n  --dsw-alias-brand-primary: #0d0d0d;\n  --dsw-alias-brand-primary-invert: #ffffff;\n  --dsw-alias-brand-text: #ffffff;\n  --dsw-alias-brand-primary-new-colorprimary-new-color: #0d0d0d;\n  /* 强调色 = Codex 浅色主题「强调色」实测值 #339CFF，只上链接；\n     主行动按钮在 Codex 里仍是墨色胶囊，故 brand-primary 不动。 */\n  --dsw-alias-link: #339cff;\n\n  --dsw-alias-button-primary-fill: #0d0d0d;\n  --dsw-alias-button-primary-hover: #2a2a2a;\n  --dsw-alias-button-primary-dimmed: #e5e5e5;\n  --dsw-alias-button-contrast-fill: #0d0d0d;\n  --dsw-alias-button-elevated-fill: #ffffff;\n  --dsw-alias-button-floating-fill: #ffffff;\n  --dsw-alias-button-floating-hover: #f1f1ef;\n  --dsw-alias-button-ghost-active-fill: #e5e5e5;\n  --dsw-alias-button-ghost-active-hover: #dcdcdc;\n  --dsw-alias-button-ghost-active-border: #8f8f8f;\n  --dsw-alias-button-info-fill: #0d0d0d;\n  --dsw-alias-button-info-hover: #2a2a2a;\n  --dsw-alias-button-tool-bar-fill: rgba(13, 13, 13, 0.28);\n  --dsw-alias-button-tool-bar-fill-invisible: rgba(13, 13, 13, 0.18);\n  --dsw-alias-button-tool-bar-hover: rgba(13, 13, 13, 0.36);\n\n  /* 交互底色：背景升一档，无位移无阴影 */\n  --dsw-alias-interactive-bg-hover: rgba(13, 13, 13, 0.04);\n  /* composer 控件悬停底：Codex 实测 #F2F2F3（冷中性，不是本层灰阶的暖 #F1F1EF）。 */\n  --dsw-codex-hover-fill: #f2f2f3;\n  /* 焦点环：Codex --color-border-focus = --blue-300 = #339cff（亮色直接取色） */\n  --dsw-codex-focus: #339cff;\n  /* 宿主的焦点环令牌接到 Codex 焦点色上。宿主 ui-theme 的 :focus-visible 与 10 条用\n     box-shadow 画环的组件规则都读 var(--dsw-focus-ring-color, 墨色回落)，而宿主从不在根上\n     声明它 —— 不接的话那 10 处聚焦时是墨色内环。宿主在指针操作时会把它就地置成 transparent\n     （html[data-input-modality=pointer] … :focus-visible），本皮肤的环也读这个令牌，\n     所以同一条「鼠标点击不出环」的宿主约定对皮肤一样生效。\n     var() 在声明它的元素上解析：body 上读到的是 body 自己的 --dsw-codex-focus，\n     深色那一档（70%）因此不需要再写一遍。 */\n  --dsw-focus-ring-color: var(--dsw-codex-focus);\n  /* Codex 的两条中性描边（app.asar 令牌，CHANGELOG 0.5.9 / 0.5.10 取证）：\n       --color-border        = --alpha-10（亮）/ --alpha-12（暗）\n       --color-border-strong = 15%（亮）/ 20%（暗）\n     输入卡环与功率轨描边用前者，功率轨拇指用后者。 */\n  --dsw-codex-border: rgba(13, 13, 13, 0.1);\n  --dsw-codex-border-strong: rgba(13, 13, 13, 0.15);\n  --dsw-alias-interactive-bg-active: rgba(13, 13, 13, 0.08);\n  --dsw-alias-interactive-bg-hover-solid: #f1f1ef;\n  --dsw-alias-interactive-bg-hover-accent: rgba(13, 13, 13, 0.06);\n  --dsw-alias-interactive-bg-hover-danger: rgba(209, 36, 47, 0.08);\n\n  /* Markdown / 代码 */\n  --dsw-alias-markdown-code-block: #f1f1ef;\n  --dsw-alias-markdown-code-block-banner: #e5e5e5;\n  --dsw-alias-markdown-inline-code: #f1f1ef;\n  --dsw-alias-markdown-code-segment-selected: #ffffff;\n  --dsw-alias-markdown-code-segment-unselected: #f1f1ef;\n  --dsw-alias-markdown-citation: #f1f1ef;\n  --dsw-alias-markdown-placeholder: #e5e5e5;\n  --dsw-alias-markdown-tag: #f1f1ef;\n\n  /* 状态：彩色白名单的唯一合法来源 */\n  --dsw-alias-state-success-primary: #1a7f37;\n  --dsw-alias-state-success-secondary: #2e9e4c;\n  --dsw-alias-state-success-tertiary: rgba(26, 127, 55, 0.08);\n  --dsw-alias-state-error-primary: #d1242f;\n  --dsw-alias-state-error-secondary: #e5484d;\n  --dsw-alias-state-error-tertiary: rgba(209, 36, 47, 0.08);\n  --dsw-alias-state-warn-primary: #8f5f00;\n  --dsw-alias-state-warn-secondary: #bb8009;\n  --dsw-alias-state-warn-tertiary: rgba(143, 95, 0, 0.08);\n  --dsw-alias-state-warn-label: #8f5f00;\n  --dsw-alias-state-business-primary: #0d0d0d;\n  --dsw-alias-state-business-tertiary: rgba(13, 13, 13, 0.08);\n  --dsw-alias-state-idle-primary: #767676;\n\n  /* diff：白名单内的红绿 */\n  --dsw-alias-code-diff-added: rgba(26, 127, 55, 0.1);\n  --dsw-alias-code-diff-deleted: rgba(209, 36, 47, 0.1);\n  --dsw-alias-file-diff-added-bg: #e6f4e7;\n  --dsw-alias-file-diff-added-gutter: #edf7ed;\n  --dsw-alias-file-diff-added-marker: #1a7f37;\n  --dsw-alias-file-diff-deleted-bg: #fce6e2;\n  --dsw-alias-file-diff-deleted-gutter: #fdece9;\n  --dsw-alias-file-diff-deleted-marker: #d1242f;\n\n  /* 浮层 / 提示 */\n  --dsw-alias-bg-mask-drop: rgba(255, 255, 255, 0.7);\n  --dsw-alias-toast-bg: #1e1e1e;\n  --dsw-alias-tooltip-bg: #1e1e1e;\n  --dsw-alias-tooltip-fg: #ffffff;\n  --dsw-alias-hovercard-bg: #ffffff;\n\n  /* 滚动条：thumb = label-tertiary 30% / 50% */\n  --dsw-alias-scrollbar-bg-l1: rgba(118, 118, 118, 0.3);\n  --dsw-alias-scrollbar-bg-l2: rgba(118, 118, 118, 0.5);\n  --dsw-alias-scrollbar-hover-l1: rgba(13, 13, 13, 0.35);\n  --dsw-alias-scrollbar-hover-l2: rgba(13, 13, 13, 0.5);\n\n  /* 具体面 */\n  --dsw-specific-sidebar-fill: #eef4f9; /* 与 --dsw-alias-bg-sidebar 同源：Codex 亮色侧栏实测 */\n  --dsw-specific-sidebar-nav-item-hover: #e8eef3; /* 侧栏底 ↔ 选中行的中点（推导值，非取样） */\n  --dsw-specific-sidebar-nav-item-active: #e2e9ed; /* Codex 选中行（PROJIECT）实测取样 */\n  --dsw-specific-sidebar-nav-item-active-accent: rgba(13, 13, 13, 0.1);\n  --dsw-specific-input-major: #ffffff;\n  /* 输入卡所坐的「表面色」。卡片底 = 5% 前景叠这个色（Codex 的 --card 公式）。\n     亮色 = 5% 墨叠白 = 243.55（参考图 codex-composer-reference.png 实测 240~246）。 */\n  --dsw-composer-surface: #ffffff;\n  --dsw-specific-login-input: #f9f9f9;\n  --dsw-specific-menu: rgba(255, 255, 255, 0.88);\n  --dsw-specific-selector: #f1f1ef;\n  --dsw-specific-bubble: #f1f1ef;\n  --dsw-specific-bubble-highlight: #e5e5e5;\n  --dsw-specific-tip: #f1f1ef;\n\n  --dsw-shadow-lv1: 0 1px 2px rgba(13, 13, 13, 0.06);\n  --dsw-shadow-lv2: 0 2px 8px rgba(13, 13, 13, 0.08);\n  --dsw-shadow-lv3: 0 8px 24px rgba(13, 13, 13, 0.1);\n  --dsw-linear-gradient-think: linear-gradient(180deg, #ffffff 20.19%, rgba(255, 255, 255, 0) 100%);\n  --dsw-linear-think-select: linear-gradient(180deg, #f1f1ef 20.19%, rgba(241, 241, 239, 0) 100%);\n}\n\n/* 切主题的那一两帧关掉全部过渡：交叉淡出（元素一半旧色一半新色）看起来就是「闪」。\n   属性由浏览器半在 ctx.on('theme/change') 时打上，两个 rAF 后摘掉。 */html[data-codex-ui-switching] *,html[data-codex-ui-switching] *::before,html[data-codex-ui-switching] *::after{\n  transition: none !important;\n}\n\n/* html 在最外层，读不到 body 上那份深色令牌，只能用 :has() 自己取一次。 */html[data-codex-ui] :root:has(body[data-ds-dark-theme]){\n  background-color: #111111;\n}\n\n/* ── 暗色主题 ─────────────────────────────────────────────────────────────\n   两个来源各管一半，别再把它们合成一个（0.1.2~0.5.5 就是合错了）：\n     · 窗口**背景** = 主题取色面板（assets/reference/codex-theme-dark.png）里写的\n       「背景 #111111 / 前景 #FCFCFC / 强调色 #0169CC」；\n     · **表面** = app.asar 的 jdi.dark.surface #181818（卡片、侧栏这类抬起来的面）。\n   实测对账：用户给的 Codex 截图里，输入卡四周的背景恒为 17 = #111111 ✓，\n   卡片内部 35 = 5% 前景叠 #181818 ✓ —— 两个值同时成立，只有「背景/表面分层」能解释。\n   0.5.5 及以前把背景也写成 #181818，于是卡片与背景只差 12 级（Codex 差 18 级），\n   层次感就是这么丢的。\n   层级：背景 #111111 → 侧栏/表面 #181818 → 层1 #212121 → 层2 #282828 → 层3 #303030。\n   alpha 家族由 252 抬到 255（Codex 深色 --alpha-base = #fff）。 */html[data-codex-ui] body[data-ds-dark-theme]{\n  color-scheme: dark;\n\n  /* 画布自持（深色）：宿主只把 data-ds-dark-theme 打在 body 上，所以 html 那一份用 :has() 跟上。\n     这里重复一次字面值而不是引用令牌 —— 令牌就定义在 body 上，html 自己读不到它的深色值。 */\n  background-color: #111111;\n\n  /* 窗口背景取主题面板的 #111111；侧栏/表面取 jdi.dark.surface #181818。\n     输入卡坐在**表面**上（--dsw-composer-surface），不是坐在窗口背景上 —— 见下。 */\n  --dsw-alias-bg-base: #111111;\n  --dsw-alias-bg-sidebar: #181818;\n  --dsw-alias-bg-layer-1: #212121;\n  --dsw-alias-bg-layer-2: #282828;\n  --dsw-alias-bg-layer-3: #303030;\n  --dsw-alias-bg-overlay: rgba(24, 24, 24, 0.88);\n  --dsw-alias-bg-module-platform: #1f1f1f;\n  --dsw-alias-bg-multi-select: #303030;\n  --dsw-alias-bg-skeleton: rgba(255, 255, 255, 0.07);\n\n  --dsw-alias-border-l1: rgba(255, 255, 255, 0.08);\n  --dsw-alias-border-l2: rgba(255, 255, 255, 0.14);\n  --dsw-alias-border-l3: rgba(255, 255, 255, 0.2);\n  --dsw-alias-border-l4: rgba(255, 255, 255, 0.26);\n  --dsw-alias-border-l2-darkmode-thin: rgba(255, 255, 255, 0.1);\n\n  --dsw-alias-label-primary: #ffffff;\n  --dsw-alias-label-primary-dimmed: #b4b4b4;\n  --dsw-alias-label-primary-inverted: #0d0d0d;\n  --dsw-alias-label-primary-foreground: #0d0d0d;\n  --dsw-alias-label-primary-bluish: #ececec;\n  --dsw-alias-label-secondary: #b4b4b4;\n  --dsw-alias-label-tertiary: #949494;\n  --dsw-alias-label-caption: #949494;\n  --dsw-alias-label-dimmed: #4a4a4a;\n\n  --dsw-alias-brand-primary: #ffffff;\n  --dsw-alias-brand-primary-invert: #0d0d0d;\n  --dsw-alias-brand-text: #0d0d0d;\n  --dsw-alias-brand-primary-new-colorprimary-new-color: #ffffff;\n  --dsw-alias-link: #0169cc; /* Codex 深色主题「强调色」实测值 */\n\n  --dsw-alias-button-primary-fill: #ffffff;\n  --dsw-alias-button-primary-hover: #d9d9d9;\n  --dsw-alias-button-primary-dimmed: #282828;\n  --dsw-alias-button-contrast-fill: #ececec;\n  --dsw-alias-button-elevated-fill: #212121;\n  --dsw-alias-button-floating-fill: #1f1f1f;\n  --dsw-alias-button-floating-hover: #282828;\n  --dsw-alias-button-ghost-active-fill: #303030;\n  --dsw-alias-button-ghost-active-hover: #383838;\n  --dsw-alias-button-ghost-active-border: #7e7e7e;\n  --dsw-alias-button-info-fill: #ffffff;\n  --dsw-alias-button-info-hover: #d9d9d9;\n  --dsw-alias-button-tool-bar-fill: rgba(255, 255, 255, 0.22);\n  --dsw-alias-button-tool-bar-fill-invisible: rgba(255, 255, 255, 0.16);\n  --dsw-alias-button-tool-bar-hover: rgba(255, 255, 255, 0.28);\n\n  --dsw-alias-interactive-bg-hover: rgba(255, 255, 255, 0.06);\n  /* 深色悬停底：Codex --color-background-button-secondary-hover = --gray-0 8% = #ffffff14。 */\n  --dsw-codex-hover-fill: rgba(255, 255, 255, 0.08);\n  /* 焦点环：Codex 深色 --color-border-focus = --blue-300 70%，即 #339cffb3。 */\n  --dsw-codex-focus: rgba(51, 156, 255, 0.7);\n  --dsw-codex-border: rgba(255, 255, 255, 0.12);\n  --dsw-codex-border-strong: rgba(255, 255, 255, 0.2);\n  --dsw-alias-interactive-bg-active: rgba(255, 255, 255, 0.1);\n  --dsw-alias-interactive-bg-hover-solid: #282828;\n  --dsw-alias-interactive-bg-hover-accent: rgba(255, 255, 255, 0.08);\n  --dsw-alias-interactive-bg-hover-danger: rgba(248, 81, 73, 0.12);\n\n  --dsw-alias-markdown-code-block: #1f1f1f;\n  --dsw-alias-markdown-code-block-banner: #141414;\n  --dsw-alias-markdown-inline-code: #282828;\n  --dsw-alias-markdown-code-segment-selected: #303030;\n  --dsw-alias-markdown-code-segment-unselected: #1f1f1f;\n  --dsw-alias-markdown-citation: #212121;\n  --dsw-alias-markdown-placeholder: #282828;\n  --dsw-alias-markdown-tag: #282828;\n\n  --dsw-alias-state-success-primary: #3fb950;\n  --dsw-alias-state-success-secondary: #56d364;\n  --dsw-alias-state-success-tertiary: rgba(63, 185, 80, 0.16);\n  --dsw-alias-state-error-primary: #ff7b72;\n  --dsw-alias-state-error-secondary: #ff9492;\n  --dsw-alias-state-error-tertiary: rgba(255, 123, 114, 0.16);\n  --dsw-alias-state-warn-primary: #d29922;\n  --dsw-alias-state-warn-secondary: #e3b341;\n  --dsw-alias-state-warn-tertiary: rgba(210, 153, 34, 0.16);\n  --dsw-alias-state-warn-label: #d29922;\n  --dsw-alias-state-business-primary: #ececec;\n  --dsw-alias-state-business-tertiary: rgba(255, 255, 255, 0.12);\n  --dsw-alias-state-idle-primary: #7e7e7e;\n\n  --dsw-alias-code-diff-added: rgba(63, 185, 80, 0.14);\n  --dsw-alias-code-diff-deleted: rgba(248, 81, 73, 0.14);\n  --dsw-alias-file-diff-added-bg: #1f3124;\n  --dsw-alias-file-diff-added-gutter: #132016;\n  --dsw-alias-file-diff-added-marker: #41c977;\n  --dsw-alias-file-diff-deleted-bg: #3c1f1b;\n  --dsw-alias-file-diff-deleted-gutter: #28130e;\n  --dsw-alias-file-diff-deleted-marker: #fa423e;\n\n  --dsw-alias-bg-mask-drop: rgba(39, 39, 48, 0.7);\n  --dsw-alias-toast-bg: #282828;\n  --dsw-alias-tooltip-bg: #212121;\n  --dsw-alias-tooltip-fg: #ececec;\n  --dsw-alias-hovercard-bg: #212121;\n\n  --dsw-alias-scrollbar-bg-l1: rgba(160, 160, 160, 0.3);\n  --dsw-alias-scrollbar-bg-l2: rgba(160, 160, 160, 0.5);\n  --dsw-alias-scrollbar-hover-l1: rgba(255, 255, 255, 0.35);\n  --dsw-alias-scrollbar-hover-l2: rgba(255, 255, 255, 0.5);\n\n  --dsw-specific-sidebar-fill: #181818;\n  --dsw-specific-sidebar-nav-item-hover: #212121;\n  --dsw-specific-sidebar-nav-item-active: #282828;\n  --dsw-specific-sidebar-nav-item-active-accent: rgba(255, 255, 255, 0.14);\n  --dsw-specific-input-major: #212121;\n  /* 深色表面 = jdi.dark.surface #181818（**不是**窗口背景 #111111）：\n     5% 白叠 #181818 = 35.55 → 36，实测 Codex 卡片内部 35 ✓。 */\n  --dsw-composer-surface: #181818;\n  --dsw-specific-login-input: #1f1f1f;\n  --dsw-specific-menu: rgba(24, 24, 24, 0.88);\n  --dsw-specific-selector: #282828;\n  --dsw-specific-bubble: #212121;\n  --dsw-specific-bubble-highlight: #282828;\n  --dsw-specific-tip: #1f1f1f;\n\n  --dsw-shadow-lv1: 0 1px 2px rgba(0, 0, 0, 0.4);\n  --dsw-shadow-lv2: 0 2px 8px rgba(0, 0, 0, 0.5);\n  --dsw-shadow-lv3: 0 8px 24px rgba(0, 0, 0, 0.6);\n  --dsw-linear-gradient-think: linear-gradient(180deg, #212121 20.19%, rgba(33, 33, 33, 0) 100%);\n  --dsw-linear-think-select: linear-gradient(180deg, #1f1f1f 20.19%, rgba(40, 40, 40, 0) 100%);\n}\n\n/* ── 官方缺失的令牌层：空间 / 圆角 / 字阶 / 动效 ─────────────────────────── */html[data-codex-ui],html[data-codex-ui] body{\n  /* 4px 网格（新增 12/20 密档，比 Claude 方向紧一档） */\n  --dsw-space-1: 4px;\n  --dsw-space-2: 8px;\n  --dsw-space-3: 12px;\n  --dsw-space-4: 16px;\n  --dsw-space-5: 20px;\n  --dsw-space-6: 24px;\n  --dsw-space-8: 32px;\n\n  /* 圆角刻度（唯一真源）：所有可见边框的圆角都从这里取，各层只准引用、不准再写 px。\n     角色 → 刻度：\n       xs   行内小片 / 菜单项\n       s    控件（按钮 / 列表行 / 页签）\n       m    卡片 / 浮层（菜单、下拉、tooltip）\n       l    面板 / 模态（取 16px，与宿主窗口内容块同值 —— dsh-client-ui-layout 的\n            --dsh-windows-content-radius: 16px）\n       xl   输入卡（无 corner-shape 时的回退值）\n       2xl  输入卡（corner-shape: superellipse 版；超椭圆要更大数值才视觉等圆）\n       menu 浮层菜单（模型菜单 / 触发菜单：参考仓库 composer-tool-menus 实测 18px，\n            比输入卡基准 20px 小 2px —— 与 Codex 自身 18/20 的关系一致）\n       pill 徽标 / 圆形按钮\n\n     同心纪律（2026-09-27 定，改圆角前先读这一段）：\n       嵌套圆角 = 外圆角 − 内衬。浮层菜单内衬 5px ⇒ 行圆角取\n       calc(var(--dsw-radius-menu) - 5px) = 13px。宿主原生菜单本来就是同心的\n       （MenuSurface 16px − 列表内衬 4px = 行 12px），本层不得再把它改散。\n       卡片内控件（模型 / 权限 chip）到卡片边的内衬是 8px，20/25 − 8 = 12~17，\n       大于控件高（28px）的一半 ⇒ 按同心规则控件必须取全圆角（pill），\n       与 assets/reference/codex-composer-chip-hover.png 实测 R = h/2 一致。 */\n  --dsw-radius-xs: 4px;\n  --dsw-radius-s: 8px;\n  --dsw-radius-m: 12px;\n  --dsw-radius-l: 16px;\n  --dsw-radius-xl: 20px;\n  --dsw-radius-2xl: 25px;\n  --dsw-radius-menu: 18px;\n  /* 输入卡圆角（单一真源）：卡片本体与它的上栏条共用这一个令牌，谁都不许再自己写数。 */\n  --dsw-radius-card: var(--dsw-radius-xl);\n  /* 上栏条（⑬·2 filebar / ⑭ hero 工作区行）只有上面两角是圆角，它探出在卡片背后，\n     与卡片同心叠放 —— 所以它取的是卡片的圆角本身，不是「卡片 − 4」。\n\n     2026-09-28 复核（用户提供的 DSH / Codex 同屏对照图，两块同一缩放）：\n     用合成真值标定过的角弧曲线法（±0.4px）+ 角亏损面积法逐像素量四条角弧，\n     Codex 条/卡 = 1.03（条 29 / 卡 28），本皮肤旧值 条/卡 = 0.79（条 16 / 卡 20）。\n     旧的「卡片 − 4」来自另一张参考图上的目视弧长，量错了：条并不比卡片紧，\n     它和卡片一样圆。比值 0.79 就是用户看到的那两条对不上的角弧。 */\n  /* 条不另立令牌：⑬·2 filebar 与 ⑭ hero 工作区行直接引用 --dsw-radius-card。\n     若写成 --dsw-radius-bar: var(--dsw-radius-card) 这种别名，var() 会在声明它的\n     body 上就解析完，之后再有人在中层元素上改写 --dsw-radius-card，条不会跟着变\n     —— 实测（scripts 之外的靶场）能复现「条 25 / 卡 20」的分家。 */\n  --dsw-radius-pill: 999px;\n\n  --dsw-content-max-width: 768px;\n\n  /* 字阶（§3.2）：11 / 12.5 / 14 / 16 / 20 / 28 */\n  --dsw-text-2xs: 11px;\n  --dsw-text-xs: 12.5px;\n  --dsw-text-sm: 13px;\n  --dsw-text-base: 14px;\n  --dsw-text-lg: 16px;\n  --dsw-text-xl: 20px;\n  --dsw-text-2xl: 28px;\n  --dsw-leading-2xs: 1.3;\n  --dsw-leading-xs: 1.4;\n  --dsw-leading-base: 1.65;\n  --dsw-leading-lg: 1.4;\n  --dsw-leading-xl: 1.35;\n  --dsw-leading-2xl: 1.25;\n\n  /* 字体栈（原样照抄宿主 dsh-client-ui-theme 的 base_css_default，0.1.7-rc.2 逐字比对一致）。\n     本皮肤自己声明一次，外观就不随宿主版本漂：UI 栈系统字体优先 + 中文回退链，\n     代码栈等宽优先 + 中文回退，两条都保留中文回退。设置页 fontUi / fontCode 覆盖的就是这两个令牌。 */\n  --dsw-font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", \"PingFang SC\",\n    \"Hiragino Sans GB\", \"Microsoft YaHei\", \"Helvetica Neue\", Helvetica, Arial, sans-serif;\n  --ds-font-family-code: \"SF Mono\", \"JetBrains Mono\", \"Fira Code\", Consolas,\n    \"Liberation Mono\", Menlo, Courier, \"PingFang SC\", \"Microsoft YaHei\";\n\n  /* 元信息 mono 规约：等宽 + 大写 + 加宽字距（Codex TUI 血统） */\n  --dsw-font-meta: var(--ds-font-family-code);\n  --dsw-meta-size: 11px;\n  --dsw-meta-weight: 500;\n  --dsw-meta-tracking: 0.08em;\n  --dsw-meta-tracking-pill: 0.04em;\n\n  /* 动效：取 Codex 应用自身的时长与曲线（26.727.4816.0 的 app-*.css）\n     fast  ← --transition-duration-basic: .15s\n     base  ← DSH 自带 --ds-transition-duration: .2s（Codex 用 duration-200 工具类）\n     slow  ← --transition-duration-relaxed: .3s\n     ease  ← --ease-in-out 与 --default-transition-timing-function，两者同值 */\n  --dsw-motion-fast: 150ms;\n  --dsw-motion-base: 200ms;\n  --dsw-motion-slow: 300ms;\n  --dsw-ease: cubic-bezier(0.4, 0, 0.2, 1);\n\n  /* 输入区配件（skin-center 共享适配器消费的变量） */\n  --dsh-composer-accessory-radius: var(--dsw-radius-l);\n  --dsh-composer-accessory-bg: var(--dsw-alias-bg-layer-2);\n  --dsh-composer-accessory-color: var(--dsw-alias-label-secondary);\n  --dsh-composer-accessory-border: 0.5px solid var(--dsw-alias-border-l1);\n  --dsh-composer-accessory-shadow: none;\n  --dsh-composer-accessory-blur: 0px;\n}\n\n/* corner-shape 分支：卡片升到 25px 超椭圆，上栏条因为引用的是同一个令牌而自动跟随，\n   不需要第二处数字。卡片那一条 @supports 在 composer.css ⑭·1，两条必须同开同关。 */\n@supports (corner-shape: superellipse(1.5)) {html[data-codex-ui],html[data-codex-ui] body{\n    --dsw-radius-card: var(--dsw-radius-2xl);\n  }\n}\n\n/* ── elevation：描边即层级，阴影近零 ─────────────────────────────────────── */\n/* 官方把 --dsw-elevation-* 声明在 body, body * 上，因此必须同样覆盖到 body *，\n   否则每个后代元素都会用自身声明盖掉从 body 继承下来的值。 */html[data-codex-ui] body,html[data-codex-ui] body *{\n  --dsw-elevation-stroke-color: rgba(13, 13, 13, 0.08);\n  /* 描边几何引用颜色令牌，而不是把同一个 rgba 再抄一遍：颜色只有上一行这一个真源，\n     亮暗两套各改一处即可（Codex 原文 --elevation-stroke 同样是「几何 + 颜色令牌」）。\n     同一元素上声明、同一元素上解析，所以 body * 上逐元素都取到本元素的颜色。 */\n  --dsw-elevation-stroke: 0 0 0 0.5px var(--dsw-elevation-stroke-color);\n  --dsw-elevation-panel: var(--dsw-elevation-stroke);\n  /* Codex --elevation-prominent 逐字（app.asar @67930856）：\n       var(--elevation-stroke), 0 3px 7.5px #0000000a, 0 0 20px #0000000d\n     旧值 0 4px 16px rgba(13,13,13,.08) 是自造单层，几何与层数都与 Codex 不同。\n     这个令牌是**宿主菜单与面板**的主阴影（.QsffPG_menu / ._7KE1Ra_menu / .JObwrW_panel\n     等 14 处消费），不是边角料。 */\n  --dsw-elevation-prominent: var(--dsw-elevation-stroke), 0 3px 7.5px #0000000a, 0 0 20px #0000000d;\n  /* --dsw-elevation-soft **不覆盖**，交还宿主自己的值（stroke + 0 4px 16px #00000008 + 0 0 24px #00000008）。\n     Codex 没有同名令牌（只有 stroke / stroke-subtle / prominent / sidebar / composer / composer-dark），\n     0.5.10 及以前这里写的 0 8px 28px 10% 墨（暗色 55% 黑）既无截图读数也无源码锚点，\n     却落在宿主 SegmentedControl 的选中片上 —— 设置页每个分段控件都背着一团自造的大影。\n     宿主值里的第一层仍是 var(--dsw-elevation-stroke)，所以描边照样跟本皮肤走。 */\n}html[data-codex-ui] body[data-ds-dark-theme],html[data-codex-ui] body[data-ds-dark-theme] *{\n  --dsw-elevation-stroke-color: rgba(255, 255, 255, 0.09);\n  --dsw-elevation-stroke: 0 0 0 0.5px var(--dsw-elevation-stroke-color);\n  --dsw-elevation-panel: var(--dsw-elevation-stroke);\n  /* 这里**不再覆盖** --dsw-elevation-prominent**：Codex 只在 :root 声明一次、没有暗色变体，\n     所以暗色沿用同一份字面值。后果是暗色菜单不再有 50% 黑的大外影，只剩发丝线 + 填充 ——\n     与 Codex 暗色的整体做法一致（0.5.7 已证输入卡暗色无外影，0.5.8 已证暗色靠填充分层）。\n     原先的 0 4px 16px rgba(0,0,0,.5) 无任何取证。 */\n}\n\n/* ── 排版层：标题字重 600 封顶 ───────────────────────────────────────────── */\n/* 官方 markdown 标题是 700；Codex 无衬线无重标题，层级靠灰阶 + 字号。\n   官方把字排令牌声明在 body 上，故同样写在 body 上（字号仍挂\n   --dsh-content-font-delta，用户调字号不破比例）。 */html[data-codex-ui],html[data-codex-ui] body{\n  --dsw-font-markdown-h1: 600 calc(21px + var(--dsh-content-font-delta)) / calc(30px + var(--dsh-content-font-delta)) var(--dsw-font-family);\n  --dsw-font-markdown-h1-font-weight: 600;\n  --dsw-font-markdown-h2: 600 calc(19px + var(--dsh-content-font-delta)) / calc(28px + var(--dsh-content-font-delta)) var(--dsw-font-family);\n  --dsw-font-markdown-h2-font-weight: 600;\n  --dsw-font-markdown-h3: 600 calc(18px + var(--dsh-content-font-delta)) / calc(26px + var(--dsh-content-font-delta)) var(--dsw-font-family);\n  --dsw-font-markdown-h3-font-weight: 600;\n}html[data-codex-ui] body[data-ds-dark-theme]{\n  --dsw-font-markdown-h1: 600 calc(21px + var(--dsh-content-font-delta)) / calc(30px + var(--dsh-content-font-delta)) var(--dsw-font-family);\n  --dsw-font-markdown-h1-font-weight: 600;\n  --dsw-font-markdown-h2: 600 calc(19px + var(--dsh-content-font-delta)) / calc(28px + var(--dsh-content-font-delta)) var(--dsw-font-family);\n  --dsw-font-markdown-h2-font-weight: 600;\n  --dsw-font-markdown-h3: 600 calc(18px + var(--dsh-content-font-delta)) / calc(26px + var(--dsh-content-font-delta)) var(--dsw-font-family);\n  --dsw-font-markdown-h3-font-weight: 600;\n}\n\n\n/* ==== L3 组件层（源：skins/codex-ink/patches.css）==== */\n/* ============================================================================\n   codex-ink（墨白终端）· L3 组件层契约\n   ----------------------------------------------------------------------------\n   治理目标（对应方案 §7）：\n     ① 卡片统一契约：纯描边 + 12px 圆角（--dsw-radius-m）+ 近零阴影 + 16px padding；\n     ② 徽标/chip 统一 mono pill；\n     ③ 彩色白名单归一：插件自带调色板收敛到 state 三色 + 墨灰；\n     ④ hover = 背景升一档，禁自创投影；\n     ⑤ 焦点环、cursor、动效时长三条 a11y/交互底线。\n\n   锚点纪律：优先使用 skin-center 语义属性契约\n   （data-dsh-surface / data-dsh-part / data-dsh-plugin / data-slot）。\n   宿主没有 data-* 的位置（⑰ 加号与两个触发器）才退到 CSS-Modules 类名的\n   **后缀**写法（方括号 class 属性后缀匹配），只依赖语义后缀、不依赖随构建变化的哈希前缀；\n   哈希全名一律不用。计数由 src/build.mjs 每次构建自报。\n   ========================================================================== */\n\n/* ── ① 焦点环：2px Codex 强调蓝 + 2px offset（--color-border-focus，亮 #339cff / 暗 70%）\n   颜色读宿主的 --dsw-focus-ring-color（skin.css 已把它接到 --dsw-codex-focus）：宿主在指针\n   操作时就地把它置成 transparent，读令牌才能继承这条「鼠标点击不出环」的约定。 ── */html[data-codex-ui] :focus-visible{\n  outline: 2px solid var(--dsw-focus-ring-color);\n  outline-offset: 2px;\n}\n\n/* ── ② 链接 = 强调色（--dsw-alias-link）+ hover 下划线 ──────────────────── */html[data-codex-ui] a{\n  color: var(--dsw-alias-link);\n  text-decoration: none;\n  text-underline-offset: 2px;\n  text-decoration-thickness: 1px;\n}html[data-codex-ui] a:hover,html[data-codex-ui] a:focus-visible{\n  text-decoration: underline;\n}\n\n/* ── ③ 可点击元素：cursor + 150ms 干脆过渡（--dsw-motion-fast） ─────────── */html[data-codex-ui] button,html[data-codex-ui] a,html[data-codex-ui] summary,html[data-codex-ui] [role=\"button\"],html[data-codex-ui] [role=\"tab\"],html[data-codex-ui] [role=\"menuitem\"],html[data-codex-ui] [role=\"option\"]{\n  cursor: pointer;\n}html[data-codex-ui] button,html[data-codex-ui] a,html[data-codex-ui] summary,html[data-codex-ui] [role=\"button\"],html[data-codex-ui] [role=\"tab\"],html[data-codex-ui] [role=\"menuitem\"]{\n  transition:\n    background-color var(--dsw-motion-fast) var(--dsw-ease),\n    border-color var(--dsw-motion-fast) var(--dsw-ease),\n    color var(--dsw-motion-fast) var(--dsw-ease),\n    opacity var(--dsw-motion-fast) var(--dsw-ease),\n    box-shadow var(--dsw-motion-fast) var(--dsw-ease);\n}html[data-codex-ui] button:disabled,html[data-codex-ui] button[aria-disabled=\"true\"],html[data-codex-ui] [aria-disabled=\"true\"]{\n  cursor: not-allowed;\n  opacity: 0.45;\n}\n\n/* ── ④ 卡片统一契约：描边即层级 ─────────────────────────────────────────── */html[data-codex-ui] [data-slot=\"web-ui.plugin.item\"] > *,html[data-codex-ui] [data-dsh-part=\"card\"],html[data-codex-ui] [data-dsh-part=\"column\"],html[data-codex-ui] [data-dsh-part=\"status\"],html[data-codex-ui] [data-dsh-part=\"today-card\"],html[data-codex-ui] [data-dsh-part=\"balance-card\"],html[data-codex-ui] [data-dsh-part=\"trend-card\"],html[data-codex-ui] [data-dsh-part=\"plan-card\"],html[data-codex-ui] [data-dsh-part=\"bank-card\"]{\n  background: var(--dsw-alias-bg-layer-1);\n  border: 0.5px solid var(--dsw-alias-border-l1);\n  border-radius: var(--dsw-radius-m);\n  box-shadow: var(--dsw-elevation-panel);\n  padding: var(--dsw-space-4);\n}\n\n/* 弹层 / 模态：大圆角（阴影交给宿主的 elevation 令牌，本层不另画） */html[data-codex-ui] [role=\"dialog\"],html[data-codex-ui] [data-dsh-surface=\"overlay\"] [data-dsh-part=\"panel\"]{\n  border-radius: var(--dsw-radius-l);\n}\n\n/* ── ⑤ 徽标 / chip：统一 mono pill ──────────────────────────────────────── */html[data-codex-ui] [data-dsh-part=\"composer-chip\"],html[data-codex-ui] [data-dsh-part=\"chip\"],html[data-codex-ui] [data-dsh-part=\"ref\"],html[data-codex-ui] [data-dsh-part=\"tag-chip\"],html[data-codex-ui] [data-dsh-part=\"tag-badge\"]{\n  font-family: var(--dsw-font-meta);\n  font-size: var(--dsw-meta-size);\n  font-weight: var(--dsw-meta-weight);\n  letter-spacing: var(--dsw-meta-tracking-pill);\n  border-radius: var(--dsw-radius-pill);\n}\n\n/* ── ⑥ 彩色白名单归一：task-board 六档 tag tone 收敛到 state 三色 + 墨灰 ── */html[data-codex-ui] [data-dsh-part=\"tag-chip\"][data-tag-tone=\"0\"],html[data-codex-ui] [data-dsh-part=\"tag-badge\"][data-tag-tone=\"0\"]{\n  background: var(--dsw-alias-bg-layer-2);\n  color: var(--dsw-alias-label-secondary);\n}html[data-codex-ui] [data-dsh-part=\"tag-chip\"][data-tag-tone=\"1\"],html[data-codex-ui] [data-dsh-part=\"tag-badge\"][data-tag-tone=\"1\"]{\n  background: var(--dsw-alias-state-success-tertiary);\n  color: var(--dsw-alias-state-success-primary);\n}html[data-codex-ui] [data-dsh-part=\"tag-chip\"][data-tag-tone=\"2\"],html[data-codex-ui] [data-dsh-part=\"tag-badge\"][data-tag-tone=\"2\"]{\n  background: var(--dsw-alias-state-warn-tertiary);\n  color: var(--dsw-alias-state-warn-primary);\n}html[data-codex-ui] [data-dsh-part=\"tag-chip\"][data-tag-tone=\"3\"],html[data-codex-ui] [data-dsh-part=\"tag-badge\"][data-tag-tone=\"3\"]{\n  background: var(--dsw-alias-state-error-tertiary);\n  color: var(--dsw-alias-state-error-primary);\n}html[data-codex-ui] [data-dsh-part=\"tag-chip\"][data-tag-tone=\"4\"],html[data-codex-ui] [data-dsh-part=\"tag-badge\"][data-tag-tone=\"4\"]{\n  background: var(--dsw-alias-state-business-tertiary);\n  color: var(--dsw-alias-label-primary);\n}html[data-codex-ui] [data-dsh-part=\"tag-chip\"][data-tag-tone=\"5\"],html[data-codex-ui] [data-dsh-part=\"tag-badge\"][data-tag-tone=\"5\"]{\n  background: var(--dsw-alias-bg-layer-3);\n  color: var(--dsw-alias-label-tertiary);\n}\n\n/* ── ⑦ 侧栏：比主区深/浅一档的整面 ─────────────────────────────────────── */html[data-codex-ui] [data-dsh-surface=\"sidebar\"],html[data-codex-ui] [data-slot=\"sidebar.workspaces\"]{\n  background-color: var(--dsw-alias-bg-sidebar);\n}\n\n/* 侧栏行 hover = 背景升一档，无位移无阴影 */html[data-codex-ui] [data-dsh-part=\"sidebar-entry\"],html[data-codex-ui] [data-dsh-surface=\"sidebar\"] [role=\"button\"]{\n  border-radius: var(--dsw-radius-s);\n}\n\n/* ── ⑧ 输入区：工具不是主角，16px 圆角（--dsw-radius-l）+ 纯描边 ─────────────\n   卡片（[data-composer-card]）的**圆角与阴影**只在 ⑭ 层（composer.css）声明一处：\n   圆角 20px（corner-shape 可用时 25px 超椭圆），阴影是 Codex --elevation-composer 三层。\n   旧版这里还各写过一次 —— 圆角 var(--dsw-radius-l)=16px、阴影 var(--dsw-elevation-panel) ——\n   与 ⑭ 层构成同一元素的第二真源，谁生效只看选择器权重。两条都已删：宿主只在会话滚动区里\n   渲染这张卡（真 GUI 实测 1 张、且在 [data-conversation-scroll] 内），⑭ 层全覆盖。 */html[data-codex-ui] [data-dsh-surface=\"composer\"] [data-dsh-part=\"composer-input\"]{\n  border-radius: var(--dsw-radius-l);\n}html[data-codex-ui] [data-dsh-part=\"composer-input\"]{\n  font-family: var(--dsw-font-family);\n  line-height: var(--dsw-leading-base);\n}\n\n/* ── ⑨ 元信息 mono 化：token 数 / 模型名 / 时间戳 / 路径 / 快捷键 ───────── */html[data-codex-ui] [data-dsh-part=\"turn-tail\"],html[data-codex-ui] [data-dsh-part=\"queue-dock\"],html[data-codex-ui] [data-dsh-part=\"usage-chart\"],html[data-codex-ui] [data-dsh-part=\"voucher-preview\"]{\n  font-family: var(--dsw-font-meta);\n}\n\n/* 微标签：11px / 大写 / .08em —— 仅作用于纯拉丁元信息锚点 */html[data-codex-ui] [data-dsh-part=\"composer-chip\"]{\n  text-transform: uppercase;\n  letter-spacing: var(--dsw-meta-tracking);\n}\n\n/* ── ⑩ CJK 豁免：中文不做字距加宽、不做大写（:lang(zh) 选择器） ────────── */html[data-codex-ui] :lang(zh) [data-dsh-part=\"composer-chip\"],html[data-codex-ui] :lang(zh) [data-dsh-part=\"chip\"],html[data-codex-ui] :lang(zh) [data-dsh-part=\"ref\"],html[data-codex-ui] :lang(zh) [data-dsh-part=\"tag-chip\"],html[data-codex-ui] :lang(zh) [data-dsh-part=\"tag-badge\"]{\n  letter-spacing: 0;\n  text-transform: none;\n}\n\n/* ── ⑪ reduced-motion：瞬时终态 ─────────────────────────────────────────── */\n@media (prefers-reduced-motion: reduce) {html[data-codex-ui] *,html[data-codex-ui] *::before,html[data-codex-ui] *::after{\n    animation-duration: 0.01ms !important;\n    animation-iteration-count: 1 !important;\n    transition-duration: 0.01ms !important;\n    scroll-behavior: auto !important;\n  }\n}\n\n/* ═══════════════════════════════════════════════════════════════════════════\n   ⑫ Codex 模型选择器（composer 模型位 conversation.input.model）\n   ---------------------------------------------------------------------------\n   形态对齐 MichengAI/dsh-codex-ui：\n     · 触发器 = 宿主原生形态（模型名 + 强度 + chevron），本层不重绘，\n       只把焦点环归一成一条细线。旧版藏 chevron、改 mono 字体、压 24px 高，\n       实测与仓库截图 conversation-light.png 的触发器不符，全部撤掉。\n     · 菜单面板 = 仓库 composer-tool-menus 的皮肤契约：不透明白 + 18px 圆角 +\n       软影 0 8px 32px + 1px 描边环；行 28px、内衬 4px 9px、圆角 13px（同心：18 − 内衬 5）、\n       hover 淡填充。旧版 TUI 编号行、页脚提示行、隐藏勾选列一并废弃。\n     · 设置卡的「Codex 模型选择器」开着时，这一席位由 model-picker.css 的自建组件顶替，\n       本段只在开关关掉（或组件没挂上）时作用于宿主原生菜单 —— 即 A 面退化路径\n       （B 面组件见 docs/plan-model-picker.zh-CN.md）。\n     · 选中行 = 淡填充 + 勾选图标；pending 行 = 行尾 StateDot 转圈。\n       旧版把行尾整列 display:none，点强度后转圈被藏、全列表又被全局\n       disabled 规则压到 45% 透明度 —— 点了像没反应，这就是「选择推理\n       强度时出现延迟」的全部成因。宿主 selectModel 的往返时长 CSS 改不了，\n       但反馈必须即时可见。\n   锚点纪律：触发器 data-slot；菜单 body > div[role=menu][aria-busy]\n   （菜单经 createPortal 挂 document.body；aria-busy 恒在，用于排除\n   primitives 的通用菜单）。不用 CSS-Modules 哈希类名。\n   ═══════════════════════════════════════════════════════════════════════════ */\n\n/* ── ⑫·1 触发器：只归一焦点环（官方 box-shadow 环 + 全局 2px outline → 1px 细线） ── */html[data-codex-ui] [data-slot=\"conversation.input.model\"] button:focus-visible{\n  outline: 1px solid var(--dsw-focus-ring-color);\n  outline-offset: 1px;\n  box-shadow: none;\n}\n\n/* ── ·2 菜单面板：不透明白 + 圆角 + 软影（参考仓库 composer-tool-menus 实测 18px\n      = --dsw-radius-menu。旧版把它折到刻度 l=16，结果菜单 16 与输入卡 20/25 叠在\n      一起时两条角弧肉眼可辨；改回实测值后与卡片只差 2px，正是 Codex 自己\n      菜单 18 / 卡片 20 的关系。影 0 8px 32px #0002 + 环 1px #0000000a）────── */html[data-codex-ui] body > div[role=\"menu\"][aria-busy]{\n  --dsw-menu-surface-fill: var(--dsw-alias-bg-layer-1);\n  --dsw-menu-backdrop-filter: none;\n  /* rc.1 的填充挂在菜单元素自身（specific-menu 半透明），rc.2 挂在\n     MenuSurface 的 material 子层 —— 两边都压成不透明白。 */\n  background: var(--dsw-alias-bg-layer-1);\n  padding: 5px;\n  border-radius: var(--dsw-radius-menu);\n  box-shadow: 0 8px 32px rgba(13, 13, 13, 0.13), 0 0 0 1px rgba(13, 13, 13, 0.04);\n  color: var(--dsw-alias-label-primary);\n}html[data-codex-ui] body[data-ds-dark-theme] > div[role=\"menu\"][aria-busy]{\n  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(236, 236, 236, 0.05);\n}\n\n/* ── ⑫·3 行契约：根面板两 cell（模型 / 推理强度）与选项行共用 ──────────────\n   圆角按同心纪律取「面板 18 − 内衬 5 = 13」。旧版写 8px（--dsw-radius-s）：\n   面板 16、行 8 的两条角弧不同心，行看起来比面板\"方\"——宿主原生是同心的\n   （MenuSurface 16 − 列表内衬 4 = 行 12），这条是皮肤自己改散的，已收回。 */html[data-codex-ui] body > div[role=\"menu\"][aria-busy] button[role=\"menuitem\"],html[data-codex-ui] body > div[role=\"menu\"][aria-busy] button[role=\"menuitemradio\"]{\n  box-sizing: border-box;\n  min-height: 28px;\n  padding: 4px 9px;\n  gap: 8px;\n  border: 0;\n  border-radius: calc(var(--dsw-radius-menu) - 5px);\n  background: none;\n  color: inherit;\n  font-size: 13px;\n  line-height: 20px;\n  text-align: left;\n}html[data-codex-ui] body > div[role=\"menu\"][aria-busy] button[role=\"menuitem\"]:hover,html[data-codex-ui] body > div[role=\"menu\"][aria-busy] button[role=\"menuitemradio\"]:hover:not(:disabled),html[data-codex-ui] body > div[role=\"menu\"][aria-busy] button[role=\"menuitemradio\"][aria-checked=\"true\"]{\n  background: var(--dsw-alias-interactive-bg-active);\n}\n\n/* 键盘焦点：全局 2px 环在菜单内不贴行盒，改 1px 内描线 */html[data-codex-ui] body > div[role=\"menu\"][aria-busy] button[role=\"menuitem\"]:focus-visible,html[data-codex-ui] body > div[role=\"menu\"][aria-busy] button[role=\"menuitemradio\"]:focus-visible{\n  outline: 1px solid var(--dsw-focus-ring-color);\n  outline-offset: -1px;\n  background: var(--dsw-alias-interactive-bg-active);\n}\n\n/* pending：全局 button:disabled 的 45% 透明度会把整列洗灰（看起来像卡住），\n   还原为 1，反馈交给行尾转圈 + 勾选；非当前行靠官方 dimmed 色区分 */html[data-codex-ui] body > div[role=\"menu\"][aria-busy] button[role=\"menuitemradio\"]:disabled{\n  opacity: 1;\n}\n\n/* pending 指示器：宿主在 aria-busy 窗口内把整列 disabled，但**不渲染任何转圈**。\n   2026-09-26 在真实 GUI（0.1.7-rc.x，headless Chromium 打 127.0.0.1:3099）实测：\n   点「推理等级」后第 60ms 菜单 aria-busy=true、6 行全 disabled、checked 已乐观\n   移到新值，而 document.getAnimations() 在菜单内为 0 —— 面板冻着不动约 1.1s 才关闭。\n   宿主 selectModel 的往返时长 CSS 改不了，能改的是这 1.1s 里必须看得见「在写」。\n   做法：pending 行行尾的勾选换成转圈（勾选已乐观前移，此处正好空出来），\n   并把 disabled 的 not-allowed 光标换成 progress。 */html[data-codex-ui] body > div[role=\"menu\"][aria-busy=\"true\"] button[role=\"menuitemradio\"][aria-checked=\"true\"] > span:last-child{\n  position: relative;\n}html[data-codex-ui] body > div[role=\"menu\"][aria-busy=\"true\"] button[role=\"menuitemradio\"][aria-checked=\"true\"] > span:last-child > svg{\n  visibility: hidden;\n}html[data-codex-ui] body > div[role=\"menu\"][aria-busy=\"true\"] button[role=\"menuitemradio\"][aria-checked=\"true\"] > span:last-child::after{\n  content: \"\";\n  position: absolute;\n  inset: 0;\n  box-sizing: border-box;\n  width: 12px;\n  height: 12px;\n  margin: auto;\n  border: 1.5px solid var(--dsw-alias-border-l3);\n  border-top-color: var(--dsw-alias-label-primary);\n  border-radius: 50%;\n  /* Codex --animate-spin = spin 1s linear infinite（本插件保留自己的 keyframe 名）。 */\n  animation: codex-ui-spin 1s linear infinite;\n}html[data-codex-ui] body > div[role=\"menu\"][aria-busy=\"true\"] button[role=\"menuitemradio\"]:disabled{\n  cursor: progress;\n}\n\n@keyframes codex-ui-spin {\n  to {\n    transform: rotate(1turn);\n  }\n}\n\n/* ═══════════════════════════════════════════════════════════════════════════\n   ⑬ Codex 式输入区（圆角 / 阴影 / 顶栏消隐 / 面板按钮图标）\n   ---------------------------------------------------------------------------\n   参考图 assets/reference/codex-composer-reference.png（1208×263）实测：\n     · 页面底 #ffffff；卡片填充 #ffffff\n     · 卡片下沿阴影 ≈ #fbfbfb（极淡、宽而散）；卡片左描边 ≈ #e1e1e1 发丝线\n     · 卡片上栏（PROJECT 条）填充 #f5f5f5，顶圆角、左右各内缩 ≈24px\n     · 卡片圆角：白底白卡无法逐像素定值，按角弧轮廓落在 24–28px，取下沿 24px\n   ═══════════════════════════════════════════════════════════════════════════ */\n\n/* ⑬·1 输入卡：几何与表面已移交 ⑭ 层（skins/codex-ink/composer.css）。\n   那一层从 MichengAI/dsh-codex-ui 原样移植：20px 圆角（corner-shape 可用时 25px 超椭圆）、\n   无边框、三层极淡投影；选择器优先级与层序都在本条之上，故此处不再重复声明，避免双真源。\n   旧值留档：24px 圆角 / 1px border-l1 / 0 1px 2px + 0 14px 36px。 */\n\n/* ⑬·2 输入卡上方的 Codex 条（文件/工作区选择栏）形态契约\n   seat: conversation.input.dock（「Full-width entries above the composer card」）。\n   内容由客户端插件填入并打 [data-codex-filebar] 标记——只按标记上形，\n   避免把既有 QueueDock / TodoDock / GoalDock 也画成灰条。 */html[data-codex-ui] [data-codex-filebar]{\n  box-sizing: border-box;\n  width: calc(100% - 48px);\n  margin: 0 auto -12px;\n  padding: 8px 16px 22px;\n  border-radius: var(--dsw-radius-card) var(--dsw-radius-card) 0 0;\n  background: #f5f5f5;\n  color: var(--dsw-alias-label-secondary);\n  font-family: var(--dsw-font-meta);\n  font-size: 12px;\n  line-height: 20px;\n}html[data-codex-ui] body[data-ds-dark-theme] [data-codex-filebar]{\n  background: #262626;\n}\n\n/* ⑬·3 顶栏瘦身：分割线上只留会话名 + 右上角按钮\n   官方 ConversationSessionHeader 的真实结构（rc1，读 dsh-client-ui-conversation 的 JSX）：\n     div.titleRow\n       ├ div.titleCluster\n       │   ├ nav.crumbs          ← 会话名（crumbSeg / crumbCurrent），保留\n       │   └ div.headerActions   ← renderSlot(\"conversation.session.header.actions\")：预设徽标 / 任务列表，隐去\n       ├ div.headerUtilities     ← renderSlot(\"...utilities\")，隐去\n       └ div.headerCorner[data-conversation-header-corner] ← 右栏展开按钮 / 会话日志，保留\n     div.tabs[role=tablist][data-conversation-tabs]   ← 视图页签，隐去\n   titleRow 的官方布局是 titleCluster（flex:1）+ utilities + corner，\n   故去掉旧版的 justify-content:flex-end —— 标题要留在左边。\n\n   ⚠ 本注释块里**不能出现花括号**（左右都不行）：src/build.mjs 的\n   scopeCss 是按「下一个左花括号」做括号配对的，注释里混进一个花括号就会把\n   后面的规则整段错位 —— 实测表现为紧随其后的规则被重复加 html[data-codex-ui]\n   前缀而失效、整份 theme.css 花括号数不平衡。所以注释里只写行式记法。 */\n/* ⑬·3c 顶栏两格**放开**（0.3.0）：槽出口里的条目恢复渲染。\n   0.2.x 为了对齐参考图「只留会话名 + 右上角按钮」，这里把两格的槽出口内容整块 display:none。\n   代价是派出去的子代理在界面上完全看不见在跑：官方子代理包把「后代数量触发器」注册在\n   conversation.session.header.actions（id subagent-catalog，order -30），同一格还有\n   jobs 的 roster、预设徽标、在应用中打开 —— 一起被关掉了。\n   现在放开。这些条目**本身都是条件渲染**（没有子代理 / 没有 job / 没有预设 / 没有工作目录时\n   各自返回 null），所以常态顶栏仍旧是「会话名 + 右上角按钮」，只有真有东西时才多出条目。\n   配色不动：条目只用 --dsw-* 语义令牌（--dsw-alias-label-tertiary、--dsw-alias-interactive-bg-hover、\n   --dsw-alias-border-l4 …），本皮肤已重锚这些令牌，因此跟着现在的配色走，不需要另配一套色。\n   出口恒为 div[data-slot=槽名][style=display:contents]，不需要也不应该改出口本身。\n   ⚠ 本部注释里不能出现花括号（src/build.mjs 的 scopeCss 按花括号配对）。 */html[data-codex-ui] [data-slot=\"conversation.session.header\"] > [data-conversation-tabs]{\n  display: none;\n}\n\n/* ⑬·3b 顶栏**真正**瘦身：把被隐藏页签仍占着的那条 min-height 收掉。\n   官方规则 .wSkVaW_header:where(:not(:has(.wSkVaW_tabs))) 用 :has() 判断有没有页签，\n   但 :has() 只看元素树、**不看 display** —— 上面那条 display:none 之后 .tabs 还在树里，\n   于是 min-height:76px 与 padding-bottom:0 一直生效：页签没了，76px 空带还在，\n   分割线被顶到空带下方，看起来就是\"上方空了一大块 / 分割线太高\"。\n   这里按同一语义手动补上。header 元素本身没有 data-*，用它内部稳定的子锚点 :has 定位\n   （data-conversation-header-leading，见 dsh-client-ui-conversation/lib/client.js:16223）。\n   必须再带 :has([data-conversation-tabs])：hero/空白态下 showTabs=false，页签根本不渲染，\n   官方 .wSkVaW_headerBlank 给的 min-height:0 与 padding-bottom:0 才是对的；\n   不带这个条件会反过来给空白顶栏塞 10px 下内边距（实测踩到过）。 */html[data-codex-ui] header:has([data-conversation-header-leading]):has([data-conversation-tabs]){\n  min-height: 0;\n  padding-bottom: 10px;\n}\n\n/* ⑬·6 「新会话」：参考图里 New chat 是**无边框行**（图标 + 文字，hover 浅填充），\n   DSH 默认是带描边的整宽按钮 → 去掉描边与底色，改成行。\n   锚点 data-dsh-part=\"new-session\" 由 skin-center 兼容适配器补打（不依赖本地化文案）。 */html[data-codex-ui] [data-dsh-part=\"new-session\"]{\n  border: 0;\n  background: transparent;\n  box-shadow: none;\n  border-radius: var(--dsw-radius-s);\n  justify-content: flex-start;\n  color: var(--dsw-alias-label-primary);\n}html[data-codex-ui] [data-dsh-part=\"new-session\"]:hover{\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n\n/* ⑬·5 卡下方统计行（DSH 独有：轮数/步数 · tok/s · 缓存命中）——参考图没有这一行。\n   要恢复：把下面这条注释掉即可。 */html[data-codex-ui] [data-slot=\"conversation.composer.dock\"]{\n  display: none;\n}\n\n/* ⑬·4 右上角面板按钮：**用官方图标**，不再手绘。\n   旧版把官方 svg display:none 掉、用纯 CSS 画了个「圆角方框 + 竖分割线」——\n   1.2px 描边配 16px 图标的视觉重量对不上，比官方图标糙。\n   查了 MichengAI/dsh-codex-ui：**它也没换这个图标**。它只做两件事\n   （src/client/conversation-header.ts:26）：\n     ① 归零角落插槽的边距补偿 —— 官方 .headerCorner 是 margin-left:8px + margin-right:-16px，\n        配合 header 的 padding-right:28px 把按钮顶到距右 12px；归零后回到 28px 内缩。\n     ② 用 order 重排，绝不物理搬移 React 节点（搬了会 NotFoundError 白屏）。\n   所以这里：撤掉手绘方框、恢复官方 svg，只补两点 —— 位置归零 + 展开态也镜像成 panel-right。\n\n   为什么镜像：官方展开按钮用**未镜像**的 IconPanelLeftOutlineRegular，收起按钮用\n   collapseGlyph 的 scaleX(-1) 镜像版 —— 同一块面板的两个状态图标朝向不一致。\n   参考图 assets/reference/codex-app-reference.png 右上角是 panel-right，故把展开态也镜像过来。\n   锚点 data-sidebar-right-expand 见 dsh-client-ui-sidebar-right 的 ExpandButton。 */html[data-codex-ui] [data-conversation-header-corner]{\n  margin-left: 0;\n  margin-right: 0;\n}html[data-codex-ui] [data-sidebar-right-expand] svg{\n  transform: scaleX(-1);\n}\n\n/* ═══════════════════════════════════════════════════════════════════════════\n   ⑮ 侧栏开合动效参数（对齐 Codex 手感）\n   ---------------------------------------------------------------------------\n   宿主本来就animate：AppFrame 是 grid-template-columns: 侧栏 / 1fr / 右栏，\n   开合时给 frame 打 [data-animating]，grid-template-columns 的 transitionend 到了\n   才摘掉（dsh-client-ui-layout/lib/client.js:270-298）。\n   默认参数 --ds-transition-duration-slow = .3s、--ds-ease-in-out = cubic-bezier(.4,0,.2,1)。\n   Codex 实测手感是 500ms + expo-out（MichengAI/dsh-codex-ui 用同值），这里换掉。\n   锚点全用稳定 data 属性：data-animating / data-dragging / data-side。\n   ⚠ 不要用 [class*=…]：frame 的类名是 CSS-Modules 哈希，随构建变。\n   ═══════════════════════════════════════════════════════════════════════════ */\n/* 只改**参数**，不改宿主\"关掉动画\"的开关。宿主有四个状态要求 transition:none：\n   data-dragging（拖拽中，逐帧跟随指针）、data-rightbar-instant（右栏退出全屏，瞬时）、\n   data-rightbar-fullscreen、以及 reduced-motion。\n   注意本层被作用域化成 html[data-codex-ui] [data-animating] = (0,2,1)，\n   会**盖过**宿主的 .pI_x6G_frame[data-rightbar-instant] = (0,2,0) —— 所以必须显式还回去，\n   否则右栏退出全屏会被强行加上动画（实测踩到过）。 */html[data-codex-ui] [data-animating]{\n  transition: grid-template-columns 500ms cubic-bezier(.16, 1, .3, 1);\n}\n\n/* 两侧拖拽柄都要覆盖：只写 [data-side=\"sidebar\"] 会让右栏柄停在宿主的 .3s，\n   与 frame 的 500ms 脱同步（柄和面板各走各的）。 */html[data-codex-ui] [data-animating] [data-side]{\n  transition: left 500ms cubic-bezier(.16, 1, .3, 1);\n}html[data-codex-ui] [data-dragging],html[data-codex-ui] [data-rightbar-instant],html[data-codex-ui] [data-rightbar-fullscreen],html[data-codex-ui] [data-dragging] [data-side],html[data-codex-ui] [data-rightbar-instant] [data-side],html[data-codex-ui] [data-rightbar-fullscreen] [data-side]{\n  transition: none;\n}\n\n@media (prefers-reduced-motion: reduce) {html[data-codex-ui] [data-animating],html[data-codex-ui] [data-animating] [data-side]{\n    transition: none;\n  }\n}\n\n/* ═══════════════════════════════════════════════════════════════════════════\n   ⑯ 右栏「展开时选择组件」= 空栏 guide（对齐 Codex 右栏展开参考图实测）\n   ---------------------------------------------------------------------------\n   参考图实测（488×1120，DPR=1，侧栏面板宽 474）：\n     · 条目行：宽 380 居中、行高 52、行距 14（pitch 66）、无描边无底色、圆角 12\n     · 图标列 20×20（条目左沿内缩 20），图标 ↔ 文字 gap 14\n     · 标题 14px 单行；参考图没有描述行\n     · 快捷键：右侧灰底 pill，68×24、圆角 12、底 ≈ #f3f3f4、字 12px 辅墨\n     · 无罗盘 hero；内容块真·垂直居中（宿主底部 10% 占位要去掉）\n   锚点：data-sidebar-right-guide / data-sidebar-right-guide-entry（官方稳定\n   属性），行内结构用位置伪类 + :has(kbd)，不用哈希类名。\n   ═══════════════════════════════════════════════════════════════════════════ */\n\n/* 罗盘 hero：参考图无 */html[data-codex-ui] [data-sidebar-right-guide] > span[aria-hidden=\"true\"]{\n  display: none;\n}\n\n/* 底部 10% 占位 → 真居中 */html[data-codex-ui] [data-sidebar-right-guide]::after{\n  display: none;\n}\n\n/* 条目：胶囊 → 平行 */html[data-codex-ui] [data-sidebar-right-guide-entry]{\n  box-sizing: border-box;\n  width: 380px;\n  max-width: 100%;\n  min-height: 52px;\n  gap: 14px;\n  padding: 0 20px;\n  border: 0;\n  border-radius: var(--dsw-radius-m);\n  background: transparent;\n  color: var(--dsw-alias-label-primary);\n  font-size: 14px;\n}html[data-codex-ui] [data-sidebar-right-guide-entry]:hover{\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n\n/* 图标列 20×20（宿主按有无描述画 22/26，拉回参考值） */html[data-codex-ui] [data-sidebar-right-guide-entry] > span:first-child{\n  width: 20px;\n  height: 20px;\n}html[data-codex-ui] [data-sidebar-right-guide-entry] > span:first-child svg{\n  width: 20px;\n  height: 20px;\n}html[data-codex-ui] [data-sidebar-right-guide-entry] > span:nth-child(2){\n  gap: 0;\n}\n\n/* 描述行：仅当它存在时隐藏（nth-child(2) 不存在即标题独占） */html[data-codex-ui] [data-sidebar-right-guide-entry] > span:nth-child(2) > span:nth-child(2){\n  display: none;\n}\n\n/* 终端行是 terminal 插件注册的自定义卡（TerminalGuide），不是标准卡：\n   子序为 button.main（absolute 点击层）→ span.icon → span.text → keys，\n   上面按标准卡子序写的图标/描述规则对它全部落空，按 kind 属性另点。\n   标题旁的 chevron 是选 Shell 菜单入口，功能件保留。 */html[data-codex-ui] [data-sidebar-right-guide-entry=\"terminal\"] > span:nth-child(2){\n  width: 20px;\n  height: 20px;\n}html[data-codex-ui] [data-sidebar-right-guide-entry=\"terminal\"] > span:nth-child(2) svg{\n  width: 20px;\n  height: 20px;\n}html[data-codex-ui] [data-sidebar-right-guide-entry=\"terminal\"] > span:nth-child(3) > span:nth-child(2){\n  display: none;\n}\n\n/* 快捷键 → 灰底 pill（宿主 plain 变体是无底文字键） */html[data-codex-ui] [data-sidebar-right-guide-entry] > span:has(kbd){\n  display: inline-flex;\n  flex: none;\n  align-items: center;\n  gap: 3px;\n  height: 24px;\n  padding: 0 10px;\n  border-radius: var(--dsw-radius-m);\n  background: var(--dsw-alias-bg-layer-2);\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 12px;\n  line-height: 16px;\n  white-space: nowrap;\n}html[data-codex-ui] [data-sidebar-right-guide-entry] kbd{\n  display: inline;\n  min-width: 0;\n  padding: 0;\n  border: 0;\n  border-radius: 0;\n  background: transparent;\n  color: inherit;\n  font: inherit;\n}\n\n/* 收起按钮（▢）：参考图常驻灰底圆方（参考 42px，受页签条行高限制取 28，\n   形态对齐、尺寸如实记录） */html[data-codex-ui] [data-sidebar-right-toggle]{\n  background: var(--dsw-alias-bg-layer-2);\n  border-radius: var(--dsw-radius-m);\n}\n\n/* ═══════════════════════════════════════════════════════════════════════════\n   ⑰ composer 底部控件：默认无框，悬停整块淡底\n   ---------------------------------------------------------------------------\n   需求：Codex 的加号控件默认**没有**背景框，只有鼠标悬停才出现；\n   模型选择器与权限控件照它的悬停形态复刻。\n   参考图 assets/reference/codex-composer-plus.png（65×84）与 codex-composer-chip-hover.png（144×58）：\n\n     · 加号：40px 直径圆形，悬停时才填 --dsw-codex-hover-fill（实测 #F2F2F3）。\n     · 悬停胶囊：整块填充 242,242,243，**没有描边**（逐像素量了外沿：白 255 → 243 → 242，\n       没有更深的环）；左右弧顶到弧顶 41px，全圆角。\n     · 圆角：胶囊**全圆角**。2026-09-27 逐像素复测 codex-composer-chip-hover.png：\n       胶囊高 42px、最左点 x=13，而最上一行的边界在 x=29 —— 离最左点 16px，正合\n       R=h/2=21 的预测值 16.4；若真是 12px 圆角则应为 8.6。旧版只搬了填充色，\n       圆角留在宿主的 --dsw-radius-sm=8px，于是 28px 高的控件配 20/25px 的输入卡\n       不成同心（同心值 20−8=12、25−8=17，都 > 控件高的一半 14）—— 已补 pill。\n\n   锚点：加号按钮没有 data-* 只有哈希类名，按 composer.css 已备案的「后缀锚点」写法取\n   button[class$=\"_add\"]；两个触发器（模型 _7KE1Ra_trigger / 权限 iWlSmW_trigger）\n   同样按后缀取 button[class$=\"_trigger\"]，整条规则限定在 [data-composer-card] 内。\n   实测（真 GUI，2026-09-26）：加号 idle 与 hover 同为 rgb(241,241,239) —— 常驻灰底，\n   就是「多了个背景框」；两个触发器 idle 透明、hover rgba(13,13,13,.04)，与参考图同形。\n   圆角不交给宿主：宿主 rc.2 的 .u91W7W_trigger / ._5Tq8wa_trigger 都是\n   --dsw-radius-sm=8px（且历史版本换过值），皮肤显式写 pill 才与宿主版本无关。\n   ═══════════════════════════════════════════════════════════════════════════ */html[data-codex-ui] [data-composer-card] button[class$=\"_add\"],html[data-codex-ui] [data-composer-card] button[class$=\"_trigger\"]{\n  transition: background-color var(--dsw-motion-fast) var(--dsw-ease);\n}\n\n/* 圆角：Codex 的 composer chip 是全圆角胶囊（参考图实测 R = h/2）。加号宿主自带\n   999px，一并显式声明，免得宿主改值后悄悄变方。 */html[data-codex-ui] [data-composer-card] button[class$=\"_add\"],html[data-codex-ui] [data-composer-card] button[class$=\"_trigger\"]{\n  border-radius: var(--dsw-radius-pill);\n}\n\n/* 加号：撤掉宿主常驻的 --dsw-alias-bg-layer-2 灰底 */html[data-codex-ui] [data-composer-card] button[class$=\"_add\"]{\n  background: transparent;\n}html[data-codex-ui] [data-composer-card] button[class$=\"_add\"]:hover,html[data-codex-ui] [data-composer-card] button[class$=\"_add\"][aria-expanded=\"true\"],html[data-codex-ui] [data-composer-card] button[class$=\"_trigger\"]:hover,html[data-codex-ui] [data-composer-card] button[class$=\"_trigger\"][aria-expanded=\"true\"]{\n  background: var(--dsw-codex-hover-fill);\n}\n\n\n\n/* ==== L3 模型选择器组件（源：skins/codex-ink/model-picker.css）==== */\n/* ============================================================================\n   codex-ink（墨白终端）· L3 模型选择器组件（B 面：功率轨）\n   ----------------------------------------------------------------------------\n   源文件：skins/codex-ink/model-picker.css\n   消费者：src/model-picker.js（自建 DOM，不是宿主的菜单）。\n   由 src/build.mjs 与其余各层一起拼接，并作用域化到 html[data-codex-ui]；\n   本文件写裸选择器，注释里不写花括号（scopeCss 按花括号配对）。\n\n   纪律（0.5.0 卡顿的教训，check-repo 有一条断言守着）：\n     · 本层只画自建节点（.codex-mp-*），外加宿主席位的**一条**隐藏规则；\n     · 一条选择器都不挂宿主的菜单 portal（body 直属的 role=menu），\n       也不改宿主菜单的 display / height / padding。\n\n   取值来源：\n     Codex = app.asar 模型选择器实现块 _Root_xwb5v_19 / _Track_xwb5v_212 /\n             _Tick_xwb5v_40 / _Thumb_xwb5v_12 的逐字值（复刻提示词第六节）；\n     宿主  = dsh-client-ui-model-selection 0.1.7-rc.2 的 ModelSelect.module.css\n             （触发器几何与 z-index 照抄，好让我们的触发器在工具条里与原生那一格同位同高）；\n     本皮肤 = 已有令牌（⑫ 菜单面板契约、⑰ 胶囊、同心圆角）。\n   ============================================================================ */\n\n\n/* ── ① 席位顶替 ─────────────────────────────────────────────────────────\n   我们的触发器在席时，宿主那一格隐藏（仍在 React 树里，生命周期不动）。\n   直接子代 :has() 的失效范围只有席位自己的几个子节点，不是 0.5.0 那种挂在\n   portal 菜单上的长链。触发器一摘（设置里关掉、或组件卸载），宿主那一格立刻复原。 */html[data-codex-ui] [data-slot=\"conversation.input.model\"]:has(> .codex-mp-trigger) > :not(.codex-mp-trigger){\n  display: none;\n}\n\n\n/* ── ② 触发器：模型名 + 档位名 + chevron ─────────────────────────────────\n   几何照宿主 _7KE1Ra_trigger（高 28、内衬 0 4 0 8、gap 4、13px/20px、\n   max-width min(360px, 45cqw)），外观走 ⑰ 的 Codex 胶囊：全圆角、默认透明无描边、\n   悬停或展开才填 --dsw-codex-hover-fill。焦点环由 ⑫·1 的席位规则统一画（1px 细线）。 */html[data-codex-ui] .codex-mp-trigger{\n  box-sizing: border-box;\n  display: inline-flex;\n  align-items: center;\n  gap: 4px;\n  height: 28px;\n  min-width: 0;\n  max-width: min(360px, 45cqw);\n  padding: 0 4px 0 8px;\n  border: 0;\n  border-radius: var(--dsw-radius-pill);\n  background: transparent;\n  color: var(--dsw-alias-label-secondary);\n  font-family: inherit;\n  font-size: 13px;\n  font-weight: 400;\n  line-height: 20px;\n  cursor: pointer;\n  transition: background-color var(--dsw-motion-fast) var(--dsw-ease);\n}html[data-codex-ui] .codex-mp-trigger:hover,html[data-codex-ui] .codex-mp-trigger[aria-expanded=\"true\"]{\n  background: var(--dsw-codex-hover-fill);\n}html[data-codex-ui] .codex-mp-trigger-model{\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n/* 档位文字叠层（Codex _ModelPickerTriggerEffortText 逐字）：各档名叠在同一格，\n   格宽取最宽的名字；当前那层清晰，其余 opacity 0 + blur(--blur-xs = 4px)。\n   改档因此是模糊交叉淡入，不是换文本，触发器宽度也不跳。 */html[data-codex-ui] .codex-mp-effort-layers{\n  display: grid;\n  grid-template-columns: max-content;\n  flex-shrink: 1000;\n  width: max-content;\n  min-width: 0;\n  overflow: hidden;\n  color: var(--dsw-alias-label-caption);\n}html[data-codex-ui] .codex-mp-effort-layers[hidden]{\n  display: none;\n}html[data-codex-ui] .codex-mp-effort-text{\n  grid-area: 1 / 1;\n  justify-self: center;\n  opacity: 0;\n  filter: blur(4px);\n  white-space: nowrap;\n  will-change: opacity, filter;\n  transition:\n    opacity var(--dsw-motion-slow) var(--dsw-ease),\n    filter var(--dsw-motion-slow) var(--dsw-ease);\n}html[data-codex-ui] .codex-mp-effort-text[data-active=\"true\"]{\n  opacity: 1;\n  filter: none;\n}\n\n/* chevron：宿主 _7KE1Ra_chevron 的 .12s 翻转 */html[data-codex-ui] .codex-mp-trigger-chevron{\n  display: inline-flex;\n  flex: none;\n  color: var(--dsw-alias-label-caption);\n  transition: transform 120ms var(--dsw-ease);\n}html[data-codex-ui] .codex-mp-trigger[aria-expanded=\"true\"] .codex-mp-trigger-chevron{\n  transform: rotate(180deg);\n}\n\n\n/* ── ③ 弹层 ─────────────────────────────────────────────────────────────\n   宽：Codex calc(var(--spacing) * 63.5)，--spacing = 4px ⇒ 254px。\n   入场：Codex .32s cubic-bezier(.23, 1, .32, 1) 30ms both，opacity 0 / scale(.98) → 1；\n         弹层在触发器上方、右沿对齐，所以从右下角长出来。\n   面板：⑫·2 的菜单契约 —— 不透明 layer-1 + 18px 圆角 + 内衬 5px + 0 8px 32px 软影 + 1px 环。\n   z-index / max-height 照宿主 _7KE1Ra_menu。 */html[data-codex-ui] .codex-mp-popover{\n  position: fixed;\n  z-index: 1100;\n  box-sizing: border-box;\n  display: flex;\n  flex-direction: column;\n  width: calc(4px * 63.5);\n  max-width: calc(100vw - 24px);\n  max-height: min(360px, 100vh - 96px);\n  padding: 5px;\n  border-radius: var(--dsw-radius-menu);\n  background: var(--dsw-alias-bg-layer-1);\n  color: var(--dsw-alias-label-primary);\n  box-shadow: 0 8px 32px rgba(13, 13, 13, 0.13), 0 0 0 1px rgba(13, 13, 13, 0.04);\n  font-size: 13px;\n  line-height: 20px;\n  transform-origin: bottom right;\n  animation: codex-mp-enter 0.32s cubic-bezier(0.23, 1, 0.32, 1) 30ms both;\n}html[data-codex-ui] body[data-ds-dark-theme] .codex-mp-popover{\n  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(236, 236, 236, 0.05);\n}html[data-codex-ui] .codex-mp-popover[hidden]{\n  display: none;\n}html[data-codex-ui] .codex-mp-popover[data-reduced-motion=\"true\"]{\n  animation: none;\n}\n\n@keyframes codex-mp-enter {\n  from {\n    opacity: 0;\n    transform: scale(0.98);\n  }\n\n  to {\n    opacity: 1;\n    transform: none;\n  }\n}\n\n/* 提交失败那一条（宿主 _7KE1Ra_error 的底色、字色、11px/16px；圆角按同心取 18 − 5） */html[data-codex-ui] .codex-mp-error{\n  flex: none;\n  margin-bottom: 3px;\n  padding: 6px 9px;\n  border-radius: calc(var(--dsw-radius-menu) - 5px);\n  background: var(--dsw-alias-interactive-bg-hover-danger);\n  color: var(--dsw-alias-state-error-primary);\n  font-size: 11px;\n  line-height: 16px;\n}html[data-codex-ui] .codex-mp-error[hidden]{\n  display: none;\n}\n\n\n/* ── ④ 模型列表：行几何同 ⑫·3（28px / 4px 9px / gap 8 / 圆角 18 − 5 = 13） ── */html[data-codex-ui] .codex-mp-list{\n  min-height: 0;\n  overflow-y: auto;\n  scrollbar-width: thin;\n}html[data-codex-ui] .codex-mp-status{\n  padding: 8px 9px;\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 12px;\n  line-height: 18px;\n}html[data-codex-ui] .codex-mp-retry{\n  padding: 0;\n  border: 0;\n  background: none;\n  color: inherit;\n  font: inherit;\n  font-weight: 600;\n  cursor: pointer;\n}\n\n/* 分组标题：宿主 _7KE1Ra_groupTitle 的 11px/16px/500 辅墨；横向内衬对齐行文字的 9px */html[data-codex-ui] .codex-mp-group{\n  padding: 4px 9px 2px;\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 11px;\n  font-weight: 500;\n  line-height: 16px;\n}html[data-codex-ui] .codex-mp-group:not(:first-child){\n  margin-top: 3px;\n}html[data-codex-ui] .codex-mp-row{\n  box-sizing: border-box;\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  width: 100%;\n  min-height: 28px;\n  padding: 4px 9px;\n  border: 0;\n  border-radius: calc(var(--dsw-radius-menu) - 5px);\n  background: none;\n  color: inherit;\n  font-family: inherit;\n  font-size: 13px;\n  line-height: 20px;\n  text-align: left;\n  cursor: pointer;\n}html[data-codex-ui] .codex-mp-row:hover,html[data-codex-ui] .codex-mp-row[aria-checked=\"true\"]{\n  background: var(--dsw-alias-interactive-bg-active);\n}\n\n/* 键盘焦点：菜单内改 1px 内描线（全局 2px 环不贴行盒） */html[data-codex-ui] .codex-mp-row:focus-visible{\n  outline: 1px solid var(--dsw-focus-ring-color);\n  outline-offset: -1px;\n  background: var(--dsw-alias-interactive-bg-active);\n}html[data-codex-ui] .codex-mp-row[aria-busy=\"true\"]{\n  cursor: progress;\n}html[data-codex-ui] .codex-mp-row-copy{\n  display: flex;\n  flex: 1;\n  flex-direction: column;\n  min-width: 0;\n}html[data-codex-ui] .codex-mp-row-name{\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  font-weight: 500;\n}\n\n/* 说明：宿主 _7KE1Ra_status 的 12px/18px 辅墨，单行截断（全文在 title 里） */html[data-codex-ui] .codex-mp-row-desc{\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 12px;\n  line-height: 18px;\n}html[data-codex-ui] .codex-mp-row-check{\n  display: grid;\n  flex: 0 0 14px;\n  place-items: center;\n  color: var(--dsw-alias-label-primary);\n}\n\n/* pending 转圈：与 ⑫ 同一副（12px / 1.5px 环 / 顶边前景色 / Codex --animate-spin 1s linear） */html[data-codex-ui] .codex-mp-spinner{\n  box-sizing: border-box;\n  display: inline-block;\n  flex: none;\n  width: 12px;\n  height: 12px;\n  border: 1.5px solid var(--dsw-alias-border-l3);\n  border-top-color: var(--dsw-alias-label-primary);\n  border-radius: 50%;\n  animation: codex-ui-spin 1s linear infinite;\n}\n\n\n/* ── ⑤ 推理等级：标题行 + 功率轨 ─────────────────────────────────────────\n   与列表之间一条 0.5px l1 发丝线（发丝即层级）；标题行与菜单行同高同衬。 */html[data-codex-ui] .codex-mp-effort{\n  flex: none;\n  margin-top: 5px;\n  padding-top: 5px;\n  border-top: 0.5px solid var(--dsw-alias-border-l1);\n}html[data-codex-ui] .codex-mp-effort[hidden]{\n  display: none;\n}html[data-codex-ui] .codex-mp-effort-head{\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n  min-height: 28px;\n  padding: 4px 9px;\n  color: var(--dsw-alias-label-secondary);\n}html[data-codex-ui] .codex-mp-effort-value{\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n/* Codex _Container：高 32 / 上下 2 / 左右 6 / 外边 2，纵向居中 */html[data-codex-ui] .codex-mp-container{\n  position: relative;\n  box-sizing: border-box;\n  display: flex;\n  flex-direction: column;\n  justify-content: center;\n  height: 32px;\n  margin-inline: 2px;\n  padding-block: 2px;\n  padding-inline: 6px;\n}\n\n/* Codex _Root：高 28、整宽、居中；touch-action: none 必须写，否则移动端手势被滚动抢走。\n   动效令牌逐字：主曲线 .3s cubic-bezier(.23, 1, .32, 1)，档位变换 .12s，\n   拇指跟随时长首帧 0s（脚本 16ms 后打 data-armed 抬到 .3s，打开时不从 0 滑过来）。 */html[data-codex-ui] .codex-mp-root{\n  --codex-mp-motion-duration: 0.3s;\n  --codex-mp-motion-easing: cubic-bezier(0.23, 1, 0.32, 1);\n  --codex-mp-tick-transform-duration: 0.12s;\n  --codex-mp-thumb-motion-duration: 0s;\n\n  position: relative;\n  display: flex;\n  align-items: center;\n  width: 100%;\n  height: 28px;\n  outline: none;\n  touch-action: none;\n  cursor: pointer;\n}html[data-codex-ui] .codex-mp-root[data-armed=\"true\"]{\n  --codex-mp-thumb-motion-duration: var(--codex-mp-motion-duration);\n}html[data-codex-ui] .codex-mp-root[data-dragging=\"true\"],html[data-codex-ui] .codex-mp-root[data-dragging=\"true\"] .codex-mp-tick{\n  cursor: grabbing;\n}html[data-codex-ui] .codex-mp-root[data-disabled=\"true\"]{\n  opacity: 0.6;\n}html[data-codex-ui] .codex-mp-popover[data-reduced-motion=\"true\"] .codex-mp-root{\n  --codex-mp-motion-duration: 0s;\n  --codex-mp-tick-transform-duration: 0s;\n  --codex-mp-thumb-motion-duration: 0s;\n}\n\n/* Codex _Track：24px 高、12px 圆角、前景 10% 底、0.5px 内描边（--color-border） */html[data-codex-ui] .codex-mp-track{\n  position: relative;\n  flex-grow: 1;\n  height: 24px;\n  overflow: hidden;\n  border-radius: 12px;\n  background: color-mix(in srgb, var(--dsw-alias-label-primary) 10%, transparent);\n  box-shadow: inset 0 0 0 0.5px var(--dsw-codex-border);\n}\n\n/* Codex _Range：强调色，只圆左侧两角，止于拇指中线。\n   位置公式与拇指、圆点同一条：calc(14px + (100% − 28px) × pos)。 */html[data-codex-ui] .codex-mp-range{\n  position: absolute;\n  top: 0;\n  inset-inline-start: 0;\n  width: calc(14px + (100% - 28px) * var(--codex-mp-pos, 0));\n  height: 100%;\n  border-radius: 12px 0 0 12px;\n  background: var(--dsw-alias-link);\n  transition: width var(--codex-mp-thumb-motion-duration) var(--codex-mp-motion-easing);\n}\n\n/* Codex _Tick：4px 圆点，热区 16px（::before 外扩 6px）；走过的 30% 白，没走到的 description 50% */html[data-codex-ui] .codex-mp-tick{\n  position: absolute;\n  top: 50%;\n  width: 4px;\n  height: 4px;\n  border-radius: 50%;\n  background: currentColor;\n  color: color-mix(in srgb, var(--dsw-alias-label-tertiary) 50%, transparent);\n  transform: translate(-50%, -50%);\n  transition:\n    transform var(--codex-mp-tick-transform-duration) var(--codex-mp-motion-easing),\n    filter var(--codex-mp-tick-transform-duration) var(--codex-mp-motion-easing);\n}html[data-codex-ui] .codex-mp-tick::before{\n  content: \"\";\n  position: absolute;\n  inset: -6px;\n}html[data-codex-ui] .codex-mp-tick:hover{\n  filter: brightness(0.85);\n  transform: translate(-50%, -50%) scale(2);\n}html[data-codex-ui] .codex-mp-tick[data-selected=\"true\"]{\n  color: #ffffff4d;\n}\n\n/* Codex _ThumbScale + _Thumb：28px 定位盒 + 白色圆片（0.5px 强描边 + 0 0 2px 10% 微影）。\n   白片亮暗同色，Codex 原样如此。 */html[data-codex-ui] .codex-mp-thumb-scale{\n  position: absolute;\n  top: 50%;\n  left: calc(14px + (100% - 28px) * var(--codex-mp-pos, 0));\n  width: 28px;\n  height: 28px;\n  border-radius: 50%;\n  transform: translate(-50%, -50%);\n  pointer-events: none;\n  will-change: left;\n  transition: left var(--codex-mp-thumb-motion-duration) var(--codex-mp-motion-easing);\n}html[data-codex-ui] .codex-mp-thumb{\n  position: absolute;\n  inset: 0;\n  box-sizing: border-box;\n  display: block;\n  border: 0.5px solid var(--dsw-codex-border-strong);\n  border-radius: 50%;\n  background: #fff;\n  box-shadow: 0 0 2px #0000001a;\n}\n\n/* 键盘焦点：Codex outline 2px + offset 0，画在拇指上（不是全局那条 2px + 2px） */html[data-codex-ui] .codex-mp-root[data-keyboard-focused=\"true\"] .codex-mp-thumb-scale{\n  outline: 2px solid var(--dsw-focus-ring-color);\n  outline-offset: 0;\n}\n\n/* 没有生效档（跟随提供方默认）：拇指与色条不画，只剩轨与圆点 */html[data-codex-ui] .codex-mp-root[data-unset] .codex-mp-thumb-scale,html[data-codex-ui] .codex-mp-root[data-unset] .codex-mp-range{\n  visibility: hidden;\n}\n\n\n/* ==== L3 侧栏对齐层（源：skins/codex-ink/sidebar-align.css）==== */\n/* ============================================================================\n   codex-ink（墨白终端）· L3 侧栏对齐层\n   ----------------------------------------------------------------------------\n   源文件：skins/codex-ink/sidebar-align.css\n   由 src/build.mjs 与 skin.css / patches.css 一起拼接，并作用域化到\n   html[data-codex-ui]。因此本文件写「裸选择器」——不要自己再加 html[...] 前缀，\n   那会被 scopeCss 判为已作用域而直通，永不命中。\n\n   目标（三条，不多做）：\n     ① 品牌行 —— 完全不动。保留官方 fish 标与名称，不注册 sidebar.brand.* 洞。\n     ② New Session 行 —— 压成列表行，图标/文字落到「工作区」下方列表行的两条竖线上。\n     ③ 全局面板行（插件…）—— 同一组竖线。\n\n   目标列（相对侧栏根 div 左边缘，实测值见 scripts/sidebar-align-verify.mjs）：\n     图标列 20px = 列表行左边缘 12px + padding-inline-start 8px\n     文字列 42px = 20px + 图标 16px + gap 6px\n   对照：工作区行（projectRow）实测 20 / 42，会话行（sessionRow）实测 20 / 40。\n\n   锚点纪律（遵守 patches.css 头部的约定）：\n     本层只用 skin-center 语义契约 data-slot + 结构伪类，\n     不使用 CSS-Modules 哈希类名，不触发\n     \"reliance on CSS-Modules hash class names\" 警告。\n\n     官方侧栏的 New Session 按钮不是 slot 内容，没有 data-slot 可挂；\n     但 Tooltip 只克隆锚点、不加包装元素，故它仍是侧栏根 div 唯一的直接\n     button 子元素，用\n         div:has([data-slot=\"sidebar.workspaces\"]) > button\n     定位。折叠态用 sidebar.toggle.badge 出口的存在与否排除 ——\n     官方只在 !wide（折叠）时才 renderSlot 该出口。\n\n   官方真实值（rc1 0.1.7-rc.1，取自 dsh-client-ui-sidebar 内联 css）。\n   为免触发 scopeCss 的括号解析，这里用行式记法，不写花括号：\n\n     _newSession        高度 height:38px\n                        边框 .5px solid var(--dsw-alias-border-l3)\n                        底色 var(--dsw-alias-button-elevated-fill)\n                        对齐 justify-content:center\n                        gap 6px ／ margin 0 2px 12px ／ padding 8px 16px\n                        字体 14px / 500 ／ line-height 22px\n     _newSession:hover  底色 var(--dsw-alias-button-floating-hover)\n     _newSessionLabel   white-space:nowrap ／ max-width:200px ／ overflow:hidden\n\n     _panelRow          box-sizing:border-box ／ min-height:36px\n                        底色 0 0 ／ 边框 none ／ 圆角 12px\n                        对齐 justify-content 未设（即 flex-start）\n                        gap 8px ／ margin 0 2px ／ padding 7px 8px\n                        字体 font:inherit ／ line-height:22px ／ text-align:left\n     _panelRow:hover    底色 var(--dsw-alias-interactive-bg-hover)\n     _panelRow:focus-visible  2px solid var(--dsw-alias-label-primary)，offset -2px\n     _panelTitle        text-overflow:ellipsis ／ white-space:nowrap\n                        min-width:0 ／ overflow:hidden\n     _panelList         flex-direction:column ／ gap:4px ／ margin-bottom:8px\n   ============================================================================ */\n\n\n/* ── ① 品牌行：刻意留空 ──────────────────────────────────────────────────\n   官方 logoRow / brandIdentity / brandMark / brandName / fallbackBrandName\n   全部原样生效。本层不写任何相关规则。 */\n\n\n/* ── ② New Session → 压成列表行，落到「工作区」下方列表行的两条竖线 ────────\n   展开态判定：侧栏根 div 含 sidebar.workspaces 出口，\n   且不含 sidebar.toggle.badge 出口。\n\n   官方 New Session 是 38px 居中主按钮：margin 0 2px 12px / padding 8px 12px /\n   justify-content:center，图标停在中线（实测 108px），与列表行差 88px。 */html[data-codex-ui] div:has([data-slot=\"sidebar.workspaces\"]):not(:has([data-slot=\"sidebar.toggle.badge\"])) > button{\n  box-sizing: border-box;\n\n  /* 高度：38px → min-height:36px */\n  height: auto;\n  min-height: 36px;\n  flex: none;\n\n  /* 外观：主按钮 → 列表行 */\n  background: 0 0;\n  border: none;\n  border-radius: var(--dsw-radius-s);\n\n  /* 排版：居中主按钮 → 左对齐列表行 */\n  justify-content: flex-start;\n  align-items: center;\n  gap: 6px;\n  /* 左边距归零：行左边缘与列表行同为 12px，图标才落到 20px。\n     桌面壳（html[data-windows-titlebar]）官方自己也写 margin-left:0，那条\n     (0,4,0) 比本层 (0,3,3) 更高 —— 桌面端本来就吃到 0。这里显式写 0，\n     让 web profile（无 titlebar）与桌面端落到同一条竖线上。 */\n  margin: 0 2px 4px 0;\n  padding: 7px 8px;\n  font: inherit;\n  line-height: 22px;\n  text-align: left;\n  color: var(--dsw-alias-label-primary);\n  cursor: pointer;\n  overflow: hidden;\n}html[data-codex-ui] div:has([data-slot=\"sidebar.workspaces\"]):not(:has([data-slot=\"sidebar.toggle.badge\"])) > button:hover{\n  background: var(--dsw-alias-interactive-bg-hover);\n}html[data-codex-ui] div:has([data-slot=\"sidebar.workspaces\"]):not(:has([data-slot=\"sidebar.toggle.badge\"])) > button:focus-visible{\n  outline: 2px solid var(--dsw-focus-ring-color);\n  outline-offset: -2px;\n}\n\n/* 图标：官方 newSession 用 14px，panelGlyph 用 16px → 统一 16px（rc.1 扁平结构） */html[data-codex-ui] div:has([data-slot=\"sidebar.workspaces\"]):not(:has([data-slot=\"sidebar.toggle.badge\"])) > button > svg{\n  width: 16px;\n  height: 16px;\n  flex: none;\n}\n\n/* 标签：官方只设了 max-width:200px → 补齐 panelTitle 的省略行为（rc.1 扁平结构） */html[data-codex-ui] div:has([data-slot=\"sidebar.workspaces\"]):not(:has([data-slot=\"sidebar.toggle.badge\"])) > button > span{\n  max-width: none;\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n\n/* ── ②·b New Session · rc.2 嵌套结构 ─────────────────────────────────────\n   0.1.7-rc.2（桌面壳在跑的那一代）在按钮里又套了两层：\n     button > span(newSessionLabelMask) > span(newSessionContent) > svg + span(newSessionLabel)\n   官方在 newSessionContent 上写死 width:100cqw + justify-content:center，\n   并把按钮设成 container-type:inline-size —— 于是只把 button 改成 flex-start\n   压不住它，图标仍旧停在按钮中线。这里把这一层拉回左对齐。 */html[data-codex-ui] div:has([data-slot=\"sidebar.workspaces\"]):not(:has([data-slot=\"sidebar.toggle.badge\"])) > button > span > span:has(> svg){\n  justify-content: flex-start;\n  width: auto;\n}\n\n/* 图标（rc.2 嵌在内容容器里，与 rc.1 同一条 16px 契约） */html[data-codex-ui] div:has([data-slot=\"sidebar.workspaces\"]):not(:has([data-slot=\"sidebar.toggle.badge\"])) > button > span > span > svg{\n  width: 16px;\n  height: 16px;\n  flex: none;\n}\n\n/* 标签（rc.2 又深一层；span.keys 的键帽是 kbd，不会命中这条） */html[data-codex-ui] div:has([data-slot=\"sidebar.workspaces\"]):not(:has([data-slot=\"sidebar.toggle.badge\"])) > button > span > span > span{\n  max-width: none;\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n\n/* ── ③ 全局面板行（插件…）→ 同两条竖线 ───────────────────────────────────\n   侧栏根 div 的直接 nav 子元素就是 panelList；它的每个直接 button 是一行面板。\n   官方 panelRow 是 margin:0 2px / padding:7px 8px / gap:8px\n   → 图标 22px、文字 46px，比列表行右移 2px / 4px。 */html[data-codex-ui] div:has([data-slot=\"sidebar.workspaces\"]):not(:has([data-slot=\"sidebar.toggle.badge\"])) > nav > button{\n  gap: 6px;\n  margin-left: 0;\n}\n\n\n/* ==== L3 侧栏面层（源：skins/codex-ink/sidebar-surface.css）==== */\n/* ============================================================================\n   codex-ink（墨白终端）· L3 侧栏面层\n   ----------------------------------------------------------------------------\n   源文件：skins/codex-ink/sidebar-surface.css\n   由 scripts/build.mjs 与 skin.css / patches.css 一起拼接，并作用域化到\n   html[data-codex-ui]。因此本文件写「裸选择器」——不要自己再加 html[...] 前缀。\n\n   组件：**侧栏滚动渐隐**（Codex 的 --sidebar-scroll-mask-image）。\n   验收：scripts/sidebar-surface-verify.mjs（夹具 A/B + 像素斜坡）。\n\n   ── 为什么是「面」而不是「样式」 ──────────────────────────────────────────\n   宿主对同一件事有自己的实现：滚动容器旁边放一个 24px 的绝对定位覆盖层，\n   底色是 linear-gradient(transparent → var(--dsw-specific-sidebar-fill))。\n   覆盖层成立的前提是**底色不透明**；本皮肤支持侧栏半透明\n   （src/override.js 的 SIDEBAR_ALPHA 会改写 --dsw-specific-sidebar-fill 的 alpha），\n   一旦半透明，覆盖层就只能糊上一层半透明的色，内容在它下面仍然看得见。\n   Codex 用的是 mask：直接对内容做 alpha 遮罩，与底色是否透明无关。\n   所以本层把宿主那条覆盖层让位，换成 Codex 的 mask 形状。\n\n   ── Codex 原文（codex-app-initial.css，_headerFadeMask_n9nga_1） ──────────\n   为免触发 scopeCss 的括号解析，这里用行式记法，不写花括号：\n\n     --edge-fade-distance                  calc(var(--spacing) * 10)\n     --sidebar-scroll-footer-edge          calc(100% - var(--sidebar-footer-height))\n     --sidebar-scroll-footer-fade-distance calc(var(--spacing) * 10)      → 40px\n     --sidebar-scroll-footer-fade-start    calc(footer-edge - fade-distance)\n     --sidebar-scroll-header-mask-distance var(--sidebar-scroll-header-fade-distance,\n                                             var(--sidebar-scroll-header-spacing, spacing*2))\n     --sidebar-scroll-mask-image           linear-gradient(to bottom,\n                                             transparent 0,\n                                             transparent <header-mask-start>,\n                                             black <header-mask-start + header-mask-distance>,\n                                             black <footer-fade-start>,\n                                             #000000e0 <footer-edge - spacing*6>,\n                                             #00000085 <footer-edge - spacing*3>,\n                                             #0000002e <footer-edge - spacing>,\n                                             transparent <footer-edge>,\n                                             transparent 100%)\n     -webkit-mask-image / mask-image       var(--sidebar-scroll-mask-image)\n     mask-size                             100% 100% ／ mask-repeat: no-repeat\n\n   --spacing 是 Tailwind 的 4px 刻度（Codex 根块 --padding-panel-base: spacing*3 = 12px\n   可反推）。于是底部那段斜坡在 40px 内四段收敛：1 → 0.878 → 0.522 → 0.180 → 0。\n\n   ── 两处按 DSH 现场的改写（逐条给依据） ──────────────────────────────────\n   ① footer-edge 取 100%，不取 calc(100% - footer 高度)。\n      Codex 的滚动视口与底部固定区**同层**（footer 压在滚动内容之上），\n      所以它的斜坡要在 footer 顶边就收敛完；DSH 的 regionArea 与 footArea\n      是 flex 列的**上下两块**，滚动容器底边本身就是 footArea 的顶边\n      （真 GUI 实测：regionArea y=154 h=690 → 底边 844；footArea y=844）。\n      所以 100% 就是 Codex 的 footer-edge，不需要再减。\n   ② 顶部不做渐入。\n      Codex 的 header-mask-start 默认 0、距离 8px，是给「吸顶分组标题」用的：\n      内容从标题下面滚过去时在顶部渐隐。DSH 的分组标题（工作区表头）不在滚动\n      容器里，是常驻的一行，滚动视口顶上没有任何覆盖层——照抄这 8px 只会让\n      列表第一行永远发虚。Codex 自己在 _stickySectionHeaders 上也把这段距离\n      收到 spacing/2（2px）。\n\n   ── 锚点纪律 ────────────────────────────────────────────────────────────\n   宿主没有给侧栏列表发任何语义锚点（真 GUI 实测：整个 [data-slot] 集合里\n   只有 sidebar.*、settings.*、conversation.* 这些席位出口，滚动容器与覆盖层\n   都没有 data-*）。本层因此分两类：\n     · 作用域根：div:has(> [data-slot=\"sidebar.workspaces\"]) —— 语义锚点，\n       唯一命中 regionArea；沿用 sidebar-align.css 已经建立的用法。\n     · 容器/覆盖层：副作用后缀锚点 class 后缀 _list / _fade（选择器写作方括号\n       class 属性后缀匹配）。\n       后缀是 CSS-Modules 的**源类名**（哈希前缀每次构建会变：桌面壳 asar 是\n       n_2Q3W_/MnE-JG_，npm 全局安装是 hHd-Xa_/bhn1Oq_），所以后缀形式\n       跨版本反而比哈希全名稳。代价是 build.mjs 的 hash 锚点计数 +2，\n       与 patches.css / composer.css 已有的 29 处同一类，写在这里备查。\n   ============================================================================ */\n\n\n/* ── ① 宿主那条 24px 覆盖层让位 ───────────────────────────────────────────\n   它刷的是 --dsw-specific-sidebar-fill。半透明底时它挡不住内容，\n   且与下面的 mask 叠加会变成双渐隐（实测见验收脚本的 A/B 像素读数）。\n   只在本层作用域内摘除，区域外一律不动。 */html[data-codex-ui] div:has(> [data-slot=\"sidebar.workspaces\"]) [class$=\"_fade\"]{\n  display: none;\n}\n\n\n/* ── ② 滚动容器：Codex 的 mask 斜坡 ──────────────────────────────────────\n   两层 mask，默认 mask-composite: add 叠加：\n     第一层 = 斜坡本体，横向只铺到「列表右内边距」为止；\n     第二层 = 右侧那一条不透明遮罩。\n   为什么分两层：mask-image 配 mask-repeat: no-repeat 时，图像没铺到的区域\n   mask 值是 0（= 隐藏），所以只写第一层会把右侧 12px（宿主的滚动条槽，\n   由 --dsh-session-list-edge-inset / scrollbar-gutter: stable 预留）\n   整条抹掉。第二层把那一条补回不透明，宿主「渐隐不压滚动条」的既有取舍\n   就被保住了 —— 宿主的覆盖层也是 right: var(--dsh-session-list-edge-inset)。 */html[data-codex-ui] div:has(> [data-slot=\"sidebar.workspaces\"]) [class$=\"_list\"]{\n  -webkit-mask-image:\n    linear-gradient(\n      to bottom,\n      #000 0,\n      #000 calc(100% - 40px),\n      #000000e0 calc(100% - 24px),\n      #00000085 calc(100% - 12px),\n      #0000002e calc(100% - 4px),\n      #00000000 100%\n    ),\n    linear-gradient(#000, #000);\n  mask-image:\n    linear-gradient(\n      to bottom,\n      #000 0,\n      #000 calc(100% - 40px),\n      #000000e0 calc(100% - 24px),\n      #00000085 calc(100% - 12px),\n      #0000002e calc(100% - 4px),\n      #00000000 100%\n    ),\n    linear-gradient(#000, #000);\n  -webkit-mask-size: calc(100% - var(--dsh-session-list-edge-inset, 12px)) 100%, var(--dsh-session-list-edge-inset, 12px) 100%;\n  mask-size: calc(100% - var(--dsh-session-list-edge-inset, 12px)) 100%, var(--dsh-session-list-edge-inset, 12px) 100%;\n  -webkit-mask-position: 0 0, 100% 0;\n  mask-position: 0 0, 100% 0;\n  -webkit-mask-repeat: no-repeat, no-repeat;\n  mask-repeat: no-repeat, no-repeat;\n}\n\n\n/* ==== L3 窗口边缘阴影层（源：skins/codex-ink/window-shadow.css）==== */\n/* ============================================================================\n   codex-ink · L3 窗口边缘阴影层\n   ----------------------------------------------------------------------------\n   源文件：skins/codex-ink/window-shadow.css。src/build.mjs 把本文件的选择器\n   作用域化到 html[data-codex-ui] 后拼进 client.js 的内嵌样式表，所以这里写裸选择器：\n   自己再加 html[...] 前缀会被 scopeCss 判为已作用域而直通，永远不命中。\n   注释里禁止出现花括号 —— scopeCss 按「下一个左花括号」做括号配对。\n\n   目标（三条，不多做）：\n     1. 会话窗口（AppFrame 中列）：0.5px 发丝线 + 24px 全向环境影（左沿糊到侧栏、上沿糊进标题栏条）；\n     2. 右栏面板：同样的顶沿，但**左边框只留发丝线、不带影**；\n     3. 右栏分界线拖拽柄悬停时的中段渐变聚焦。\n\n   取值依据（Codex 应用截图逐像素实测，非估计）：\n     assets/reference/codex-app-reference.png（1901x1107，DPR 1）\n      · 会话窗口左沿  y=600：侧栏侧 x=340..355 由 238,241,247 渐变到 231,233,239（约 15px 渐变），\n                    x=356 单像素发丝线 212,215,221，x=357 起纯白。\n      · 会话窗口上沿  x=800：y=30..45 由 237,242,247 渐变到 232,237,242，y=46 发丝线 214,218,224。\n      · 右栏面板左沿  y=600：x=1437 单像素 237,237,237，两侧都是纯白 —— **没有影**。\n      · 右栏面板上沿  x=1700：与中列同一套渐变 + 发丝线（y=46 处 213,218,224）。\n    结论：发丝线是 1 个设备像素，中列取 12% 墨（l2）、面板取 7% 墨（l1）；\n          软影只出现在中列的左/上沿与面板的上沿，面板左沿不糊影。\n          本层按 DPR 折算成 0.5 CSS px 的发丝线：1.5 倍缩放下落到约 1 个设备像素，\n          与参考图同档；写成 1px 会在 1.5 倍缩放下被栅格化成 2 个像素（偏粗）。\n\n   锚点（只用宿主语义属性，不用 CSS-Modules 哈希类名）：\n     中列     div:has(> [data-slot=\"main\"])；main 面板未注册时退回\n              div:has(> [data-slot=\"sidebar\"]) + div（侧栏列的下一个兄弟）。\n     右栏面板 [data-sidebar-right-panel=\"push\"][data-sidebar-right-open]。\n     拖拽柄   [data-side=\"rightbar\"]，宽 8px、骑跨分界线。\n\n   层序：标题栏拖拽条是 .frame 的绝对定位伪元素，静态定位的中列会被它盖住。\n   本层给中列补 position: relative 抬进定位层，靠 DOM 顺序压过它 —— 上沿的影因此\n   才画得到标题栏条上。右栏面板是宿主 absolute 拉伸的元素（top:0 / bottom:0），\n   切勿再叠 position: relative：会覆盖 absolute、面板塌成内容高度（已出过一次事故）。\n   ============================================================================ */\n\n/* ── ① 会话窗口（中列）：0.5px 发丝线 + 24px 全向环境影 ─────────────────────\n   范围：Windows 桌面壳（html[data-windows-titlebar]）与 win32 的浏览器形态。\n   macOS 是 vibrancy 透底，加外投影会脏，不生效。 */html[data-codex-ui][data-windows-titlebar] div:has(> [data-slot=\"main\"]),html[data-codex-ui][data-windows-titlebar] div:has(> [data-slot=\"sidebar\"]) + div,html[data-codex-ui][data-platform=\"win32\"]:not([data-windows-titlebar]) div:has(> [data-slot=\"main\"]),html[data-codex-ui][data-platform=\"win32\"]:not([data-windows-titlebar]) div:has(> [data-slot=\"sidebar\"]) + div{\n  position: relative;\n  box-shadow:\n    0 0 0 0.5px var(--dsw-alias-border-l2),\n    0 0 24px rgba(13, 13, 13, 0.05);\n}html[data-codex-ui][data-windows-titlebar] body[data-ds-dark-theme] div:has(> [data-slot=\"main\"]),html[data-codex-ui][data-windows-titlebar] body[data-ds-dark-theme] div:has(> [data-slot=\"sidebar\"]) + div,html[data-codex-ui][data-platform=\"win32\"]:not([data-windows-titlebar]) body[data-ds-dark-theme] div:has(> [data-slot=\"main\"]),html[data-codex-ui][data-platform=\"win32\"]:not([data-windows-titlebar]) body[data-ds-dark-theme] div:has(> [data-slot=\"sidebar\"]) + div{\n  box-shadow:\n    0 0 0 0.5px var(--dsw-alias-border-l2),\n    0 0 24px rgba(0, 0, 0, 0.5);\n}\n\n/* ── ② 右栏（push 模式）：左边框只留发丝线，影只往上泄 ─────────────────────\n   参考图实测：面板左沿 x=1437 是单像素 237,237,237、两侧纯白 —— 左沿不糊影，\n   所以这里不给全向影；顶沿仍与中列同套，用负 spread 把水平方向与下方收掉，\n   只在面板上沿留一段约 12px 的渐变（影盒左沿被收进面板 12px 内，左沿残余覆盖约\n   0.008，肉眼为零）。栏内 dockkit 叠的那条 .5px l4 深边框一并压成 0。 */html[data-codex-ui][data-windows-titlebar] [data-sidebar-right-panel=\"push\"][data-sidebar-right-open],html[data-codex-ui][data-platform=\"win32\"]:not([data-windows-titlebar]) [data-sidebar-right-panel=\"push\"][data-sidebar-right-open]{\n  box-shadow:\n    0 0 0 0.5px var(--dsw-alias-border-l1),\n    0 -12px 24px -12px rgba(13, 13, 13, 0.05);\n}html[data-codex-ui][data-windows-titlebar] body[data-ds-dark-theme] [data-sidebar-right-panel=\"push\"][data-sidebar-right-open],html[data-codex-ui][data-platform=\"win32\"]:not([data-windows-titlebar]) body[data-ds-dark-theme] [data-sidebar-right-panel=\"push\"][data-sidebar-right-open]{\n  box-shadow:\n    0 0 0 0.5px var(--dsw-alias-border-l1),\n    0 -12px 24px -12px rgba(0, 0, 0, 0.5);\n}\n\n/* 宿主 dockkit 给右栏的 pane 画了一条 1px l4（24% 墨，实测合成值 197 —— 比参考图的\n   单像素 237 深两档），它落在面板左沿外侧，就是「边框又粗又重」的来源之一。\n   真实锚点是 pane 自身：SECTION[data-dockkit-pane][data-dockkit-column=\"0\"]，\n   插在 [data-dockkit-host=\"dock\"] 的 tabCell 里 —— 旧版按 host 的 div 直选子元素，\n   选择器从来没命中过。压成 0，左沿只留面板自己的 0.5px l1 发丝线。 */html[data-codex-ui] [data-sidebar-right-panel=\"push\"][data-sidebar-right-open] [data-dockkit-pane][data-dockkit-column=\"0\"]{\n  border-left: 0;\n}\n\n/* ── ③ 右栏分界线拖拽柄：悬停时的中段渐变聚焦 ─────────────────────────────\n   静态：边界只有那 0.5px 发丝线，淡且细。\n   悬停：柄内居中画 2px 竖向线，中段最深、两端淡出，入场自中间向两端展开。\n   实测 assets/reference/codex-rightbar-edge-hover.png（111x842，DPR 1）：\n     柄心列 y=560 处 x=65/66 = 213,214,214 / 198,198,199（中段最深）\n     同一列 y=20 处 x=65/66 = 239,239,240 / 222,222,222（向两端淡出）\n   左分界线（侧栏 ↔ 中列）没有这条悬停线：参考图里它始终是一条静态发丝线。 */html[data-codex-ui] [data-side=\"rightbar\"]::before{\n  content: \"\";\n  position: absolute;\n  top: 0;\n  bottom: 0;\n  left: 50%;\n  width: 2px;\n  translate: -50% 0;\n  border-radius: 1px;\n  background: linear-gradient(to bottom, rgba(13, 13, 13, 0.09), rgba(13, 13, 13, 0.27) 50%, rgba(13, 13, 13, 0.09));\n  opacity: 0;\n  scale: 1 0.35;\n  transform-origin: center;\n  transition: opacity var(--dsw-motion-base) var(--dsw-ease), scale var(--dsw-motion-slow) var(--dsw-ease);\n  pointer-events: none;\n}html[data-codex-ui] [data-side=\"rightbar\"]:hover::before{\n  opacity: 1;\n  scale: 1 1;\n}html[data-codex-ui] body[data-ds-dark-theme] [data-side=\"rightbar\"]::before{\n  background: linear-gradient(to bottom, rgba(236, 236, 236, 0.08), rgba(236, 236, 236, 0.24) 50%, rgba(236, 236, 236, 0.08));\n}\n\n/* ── ④ 浏览器形态（win32，无标题栏条）────────────────────────────────────\n   宿主给侧栏列画的是 .5px l3（18% 墨），比桌面壳（border-right: none）深一档，\n   与中列的 0.5px l2 发丝线叠在一起会变成双层深线，压到 l1。 */html[data-codex-ui][data-platform=\"win32\"]:not([data-windows-titlebar]) div:has(> [data-slot=\"sidebar\"]){\n  border-right-color: var(--dsw-alias-border-l1);\n}\n\n\n/* ==== L3 输入区完整层（源：skins/codex-ink/composer.css）==== */\n/* ============================================================================\n   codex-ink（墨白终端）· L3 输入区完整层\n   ----------------------------------------------------------------------------\n   源文件：skins/codex-ink/composer.css\n   由 src/build.mjs 与其余各层一起拼接，并作用域化到 html[data-codex-ui]。\n   本文件写「裸选择器」——不要自己再加 html[...] 前缀，那会被 scopeCss 直通。\n\n   来源（上游仓库 MichengAI/dsh-codex-ui 的源码；行号是移植时那一版的）：\n     · src/client/CodexSidebar.tsx          L119-L137  → ⑭·1 ⑭·2 ⑭·3\n     · src/client/composer-tool-menus.ts    L6-L30     → ⑭·4（仅官方锚点部分）\n     · src/client/new-conversation-style.ts L3-L14     → ⑭·5\n\n   兼容性核对（对 rc1 0.1.7-rc.1 的 shipped 包逐条 grep，不是照抄）：\n     上游 README 只声明兼容到 0.1.6-alpha.2。逐条核对后，以下锚点在本机 rc1 上\n     不存在，一律**不移植**，免得留死规则：\n       ✗ [data-input-mirror]                      rc1 无此属性（conversation 包 0 命中）\n       ✗ [class*=\"_rail\"]（附件轨道补偿）           rc1 无此类名段\n       ✗ [class*=\"_selected\"] / [class*=\"_footer\"] rc1 无此类名段\n       ✗ [data-dcu-tool-menu] / [data-gitgraph-popover]  由上游 JS 观察器打标，\n         本插件不含该半，规则永远不会命中 → 弹窗换肤留在「待移植 JS 半」清单\n       ✗ .dcu-home-*                            上游自有组件的类名，本皮肤没有这些节点\n     实测存在的锚点（本条全部基于它们）：\n       ✓ [data-composer-card] [data-input-scroll] [data-composer-placeholder]\n         [data-lexical-editor=true] [data-conversation-scroll] [data-composer-seat]\n         [data-trigger-menu] [data-phase]（取值 settling / hero / active）\n\n   锚点纪律例外（必须说清）：\n     ⑭·4 ⑭·5 用到 [class*=\"_heroWorkspaceRow\"] / [class*=\"_composerHero\"] /\n     [class$=\"_workspace\"] / [class$=\"_primary\"]。这类 CSS-Modules 哈希类名在\n     patches.css 头部是被禁止的——那条禁令针对 **skin-center 加载器**的\n     \"reliance on CSS-Modules hash class names\" 告警。本层走**插件路径**\n     （client.js 直接注入 style 标签），不经加载器，故放行。\n     已尽量取「后缀锚点」写法（[class$=_primary]），只依赖语义后缀、不依赖哈希前缀；\n     语义名若被上游改掉，由 scripts/hero-verify.mjs 的实测值暴露。\n     hero 区没有 data-* 可用：jYtg_G_heroWorkspaceRow / jYtg_G_composerHero 只有类名。\n   ============================================================================ */\n\n/* ── ⑭·1 卡片几何与表面 ───────────────────────────────────────────────────\n   上游把输入区放宽到 chat 内容宽 + 32px，左右留白 24px；卡片 20px 圆角（浏览器\n   支持 corner-shape 时升到 25px 超椭圆）。\n\n   表面：**亮暗两套机制相反** —— 这是本层最容易搞错的地方。\n\n   暗色 = 填充分层。卡片比页面亮一档：5% 白叠 surface #181818 = 35.6 → 36\n   （Codex 暗色参考裁图 layer-codex.png / codex-card-ref.png 众数实测：卡内\n   #232323 = 35、页面 #111111 = 17，落差 18）。暗色**没有投影**，见下方 inset 高光。\n\n   亮色 = 阴影分层，卡片**与页面同色**（都是 #ffffff）。三份独立实测同向：\n     codex-composer-reference.png 卡内众数 #fffeff/#ffffff/#fefdfe 合计 62%；\n     用户 2026-09-28 同屏截图卡内众数 #fffeff 73.8% + #fefdfe 23.0% = 96.8%；\n     codex-app-reference.png 整窗 #ffffff 76.5%。\n   0.5.6 及以前在亮色也叠了 5% 墨（= #f4f4f4，比实测暗 11 级），是把暗色模型错套到\n   亮色上。照抄的 --card: 5% foreground 属于 **widget 层**（codex.exe 的 artifact\n   契约），不是应用外壳的输入卡；外壳令牌里亮色 --gray-fixed-0 = #ffffff 与实测吻合\n   （--color-surface-elevated-secondary = gray-50 = #f9f9f9 差 5 级，不采用）。\n   该令牌映射本身仍是推断，见 CHANGELOG 0.5.8 的边界说明。\n\n   阴影按源码逐字取 Codex 的 --elevation-composer（见下方声明）。0.5.4 那轮把\n   0 4px 80px 8px 判为「比实测宽三倍」并删掉，是误判 —— Codex 确有该层（第三层，\n   仅 2.4% 墨），缺的是它前面的 8px 近场。0.5.7 已恢复三层。\n   注：亮色参考图里卡片边缘实测约 12% 墨，而源码的环只有 #0000000a = 4%，两者不一致；\n   本皮肤按源码取 4%，该差异未解释，见 CHANGELOG 0.5.8 边界说明。 */html[data-codex-ui] [data-conversation-scroll]{\n  --dsh-composer-card-max-width: calc(var(--dsh-chat-content-width) + 32px);\n  --dsh-composer-side-clearance: 24px;\n  /* 亮色**不叠罩**：直接取表面色（= #ffffff）—— Codex 亮色卡与页面同色，见上。\n     仍写成不透明实色、不用 transparent：DSH 的输入卡浮在会话滚动内容之上，\n     留 transparent 会让身后的文件列表透出来（实测已复现）。 */\n  --dcu-composer-bg: var(--dsw-composer-surface);\n  /* 阴影逐字取 Codex 的 --elevation-composer（app.asar @67930943）：\n       0 0 0 1px ...          环：源码里输入卡有**两条互斥路径** ——\n                                 路径A（默认/large/single-line）box-shadow: var(--elevation-composer)\n                                 路径B（[data-composer-radius-variant=compact]）\n                                   box-shadow: none; border: 1px solid var(--color-border) !important\n                               实测走的是 B。而 --color-border = --alpha-10（亮）/ --alpha-12（暗）。\n                               两种方法同时指向 10%：\n                                 · 同图内比较（DPR 无关）：Codex 环像素比页面低 26 级；\n                                   本皮肤 4% 环低 16 级 → 反推 α ≈ 10.4%；\n                                 · 标定渲染（DPR 1.25）：4% → Δ14、12% → Δ29 → 插值 α ≈ 10.4%。\n                               0.5.8 取 12% 偏重（渲成 Δ29~35）；0.5.10 按上两法收到 10%。\n                               0.5.7 曾按路径A 取 4%，那是只看了三层里的第一层。\n       0 2px 8px 0 #0000000a 近场：8px 模糊 / 2px 位移，墨压在这一层\n       0 4px 80px 8px #00000006 远场：80px 宽晕、仅 2.4%，负责\"浮起来\"的空气感\n     三层缺一不可：只有远场会糊，只有环会像贴纸（本皮肤此前正是后者）。 */\n  --dcu-composer-shadow: 0 0 0 1px rgba(13, 13, 13, 0.1), 0 2px 8px 0 #0000000a, 0 4px 80px 8px #00000006;\n}\n\n/* 暗色：Codex 的 --elevation-composer-dark 是 inset 0 0 1px 0 #fff3 —— **完全外无投影**，\n   改用 1px 内嵌高光把顶边点亮（实测 Codex 卡体 36、顶边 40，本皮肤此前内侧全平 36/36）。\n   机制差异：外描边读作\"画了一条线\"，内嵌高光读作\"边被光打到\"，后者才是 Codex 的层次来源。\n   外层 0.5px 发丝线一并撤掉：暗色下 Codex 卡外就是页面底色，无任何环。 */html[data-codex-ui] body[data-ds-dark-theme] [data-conversation-scroll]{\n  /* 叠罩**只用于暗色**：5% 白叠 surface #181818 = 35.6 → 36（Codex 实测 35）。\n     用 srgb 插值不用 oklab —— 浏览器那边就是 sRGB alpha 合成，oklab 会压到 34。\n     基色取 --dsw-composer-surface（#181818 = Codex 的 surface），**不是**\n     --dsw-alias-bg-base：后者是窗口背景 #111111，叠上去只有 29，卡片就不分层了。 */\n  --dcu-composer-bg: color-mix(in srgb, var(--dsw-alias-label-primary) 5%, var(--dsw-composer-surface));\n  --dcu-composer-shadow: inset 0 0 1px 0 #fff3;\n}html[data-codex-ui] [data-conversation-scroll] [data-composer-card]{\n  padding-top: 12px;\n  gap: 4px;\n  border: 0;\n  border-radius: var(--dsw-radius-card);\n  background: var(--dcu-composer-bg);\n  box-shadow: var(--dcu-composer-shadow);\n}\n\n@supports (corner-shape: superellipse(1.5)) {html[data-codex-ui] [data-conversation-scroll] [data-composer-card]{\n    border-radius: var(--dsw-radius-card);\n    corner-shape: superellipse(1.5);\n  }\n}\n\n@media (max-width: 639px) {html[data-codex-ui] [data-conversation-scroll]{\n    /* Codex 在 width<40rem 时把远场 80px 收到 40px（阈值同为 640，与本查询一致） */\n    --dcu-composer-shadow: 0 0 0 1px rgba(13, 13, 13, 0.1), 0 2px 8px 0 #0000000a, 0 4px 40px 8px #00000006;\n  }\n}\n\n@media (forced-colors: active) {html[data-codex-ui] [data-conversation-scroll] [data-composer-card]{\n    outline: 1px solid CanvasText;\n  }\n}\n\n/* ── ⑭·2 输入区几何：44px 编辑区 + 12px 内缩，占位元素与正文同轴 ────────── */html[data-codex-ui] [data-conversation-scroll] [data-composer-card] [data-input-scroll]{\n  margin-right: 0;\n}html[data-codex-ui] [data-conversation-scroll] [data-input-scroll] [data-lexical-editor=true]{\n  min-height: 44px;\n  padding: 0 12px;\n}html[data-codex-ui] [data-conversation-scroll] [data-composer-placeholder]{\n  inset: 0 12px auto;\n}\n\n/* ── ⑭·3 底栏行与发送键：28px 控件带，发送键改墨色圆点、无位移 ────────────\n   卡内结构是 card > [data-input-scroll] + row，故用相邻兄弟定位底栏。 */html[data-codex-ui] [data-conversation-scroll] [data-composer-card] > [data-input-scroll] + div{\n  padding: 0 8px 8px;\n  gap: 5px;\n}html[data-codex-ui] [data-conversation-scroll] [data-composer-card] > [data-input-scroll] + div > div{\n  gap: 4px;\n}html[data-codex-ui] [data-conversation-scroll] [data-composer-card] > [data-input-scroll] + div > div > div{\n  gap: 4px;\n}html[data-codex-ui] [data-conversation-scroll] [data-composer-card] > [data-input-scroll] + div :is(button, select):not([role]){\n  min-height: 28px;\n  height: 28px;\n}html[data-codex-ui] [data-conversation-scroll] [data-composer-card] > [data-input-scroll] + div button[class$=_primary]{\n  width: 28px;\n  transform: none;\n  background: var(--dsw-alias-label-primary);\n  color: var(--dsw-alias-bg-base);\n}html[data-codex-ui] [data-conversation-scroll] [data-composer-card] > [data-input-scroll] + div button[class$=_primary]:hover:not(:disabled){\n  background: var(--dsw-alias-label-secondary);\n}html[data-codex-ui] [data-conversation-scroll] [data-composer-card] > [data-input-scroll] + div :is(button, select):focus-visible{\n  outline: 2px solid var(--dsw-focus-ring-color);\n  outline-offset: 2px;\n}\n\n/* ── ⑭·4 工具条与建议菜单（只保留官方锚点能命中的部分） ────────────────────\n   hero 的工作区行按钮 → Codex 胶囊；@ / 指令建议菜单 → 与输入区同宽，\n   圆角走浮层刻度 --dsw-radius-menu（18px），与模型菜单同一族；\n   旧值 12px（--dsw-radius-m）与菜单族的 18 不同源，已收回。 */html[data-codex-ui] [class*=\"_heroWorkspaceRow\"] button{\n  min-height: 28px;\n  border-radius: var(--dsw-radius-pill);\n  font-size: 13px;\n  line-height: 20px;\n}html[data-codex-ui] [class*=\"_heroWorkspaceRow\"] button:hover,html[data-codex-ui] [class*=\"_heroWorkspaceRow\"] button[aria-expanded=true]{\n  background: color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent);\n}html[data-codex-ui] [data-conversation-scroll] [data-trigger-menu]{\n  box-sizing: border-box;\n  left: 0;\n  right: 0;\n  width: auto;\n  min-width: 0;\n  max-width: none;\n  padding: 5px;\n  border-radius: var(--dsw-radius-menu);\n  background: #fff;\n  box-shadow: 0 8px 32px #0002, 0 0 0 1px #0000000a;\n}html[data-codex-ui] body[data-ds-dark-theme] [data-conversation-scroll] [data-trigger-menu]{\n  background: #292929;\n  box-shadow: 0 8px 32px #0003, 0 0 0 1px #ffffff08;\n}html[data-codex-ui] [data-conversation-scroll] [data-trigger-menu] > [role=listbox]{\n  box-sizing: border-box;\n  width: 100%;\n  min-width: 0;\n  align-self: stretch;\n  scrollbar-width: thin;\n}\n\n/* 选项行圆角同「浮层 18 − 内衬 5 = 13」，与 ⑫·3 的菜单行同一公式 */html[data-codex-ui] [data-conversation-scroll] [data-trigger-menu] [role=option]{\n  box-sizing: border-box;\n  width: 100%;\n  min-width: 0;\n  min-height: 28px;\n  padding: 4px 9px;\n  gap: 8px;\n  border-radius: calc(var(--dsw-radius-menu) - 5px);\n  font-size: 13px;\n  line-height: 20px;\n}html[data-codex-ui] [data-conversation-scroll] [data-trigger-menu] [role=option][aria-selected=true]{\n  background: color-mix(in srgb, var(--dsw-alias-label-primary) 10%, transparent);\n}\n\n/* ── ⑭·5 新建页（hero）：输入区占满、工作区行贴在卡片上沿 ─────────────────\n   上游的 .dcu-home-* 建议卡属于它自己的组件，本皮肤没有这些节点，不移植；\n   container 声明只为那些卡片服务，一并省掉。 */html[data-codex-ui] [data-phase=hero] [data-conversation-scroll][class]{\n  --dsh-composer-side-clearance: 16px;\n  justify-content: flex-start;\n  scrollbar-gutter: stable both-edges;\n}html[data-codex-ui] [data-phase=hero] [data-composer-seat]{\n  flex: 1 0 auto;\n  min-height: 100%;\n}html[data-codex-ui] [data-phase=hero] [data-composer-seat] > :has([class*=\"_composerHero\"]){\n  display: flex;\n  flex: 1;\n  flex-direction: column;\n}html[data-codex-ui] [data-phase=hero] [class*=\"_composerHero\"]{\n  box-sizing: border-box;\n  flex: 1;\n  width: 100%;\n  max-width: none;\n  min-width: 0;\n  margin-inline: auto;\n  gap: 0;\n  padding-bottom: 32px;\n}html[data-codex-ui] [data-phase=hero] [class*=\"_heroWorkspaceRow\"]{\n  box-sizing: border-box;\n  flex: none;\n  width: min(calc(var(--dsh-composer-card-max-width) + 2 * var(--dsh-composer-side-clearance) - 56px), calc(100% - 56px));\n  align-self: center;\n  justify-content: flex-start;\n  flex-wrap: wrap;\n  gap: 8px;\n  min-height: 48px;\n  margin: 0 28px -10px;\n  padding: 6px 12px 16px;\n  /* 上栏条圆角 = 卡片圆角（同一个 --dsw-radius-card）：它探在卡片背后，只有上面两角可见，\n     与卡片同心叠放。旧值 16px（卡片 20）时 条/卡 = 0.79，而 Codex 实测 1.03\n     —— 条比卡片紧 5px 就是那两条对不上的角弧。 */\n  border-radius: var(--dsw-radius-card) var(--dsw-radius-card) 0 0;\n  background: color-mix(in srgb, var(--dsw-alias-label-primary) 4%, var(--dsw-alias-bg-base));\n}html[data-codex-ui] [data-phase=hero] [class*=\"_heroWorkspaceRow\"] > [class$=\"_workspace\"]{\n  min-width: 0;\n  max-width: 100%;\n  font-weight: 400;\n}\n\n\n/* ==== L3 插件设置页层（源：skins/codex-ink/settings.css）==== */\n/* ============================================================================\n   codex-ink · L3 插件设置页层\n   ----------------------------------------------------------------------------\n   官方插件管理 → 组合包页里那块配置卡的版式（座位 plugins.bundle.config）。\n   取色只用 --dsw-alias-* / --dsw-specific-* 令牌，**不引入任何彩色** —— 与\n   skin.css 的「无彩色 chrome」纪律一致；唯一的彩色是强调色本身，由设置值给。\n\n   为什么放在皮肤层而不是卡片内联：这一层同样受 html[data-codex-ui] 作用域约束，\n   进同一份 theme.css，可被体检脚本与审计脚本一起看见。\n   ========================================================================== */html[data-codex-ui] .cx-form{\n  display: flex;\n  flex-direction: column;\n  margin: 0;\n}html[data-codex-ui] .cx-row{\n  display: grid;\n  grid-template-columns: minmax(0, 1fr) auto;\n  align-items: center;\n  column-gap: 16px;\n  padding: 10px 0;\n  border-bottom: 0.5px solid var(--dsw-alias-border-l1);\n}html[data-codex-ui] .cx-row:last-child{\n  border-bottom: none;\n}html[data-codex-ui] .cx-row__text{\n  min-width: 0;\n}html[data-codex-ui] .cx-row__label{\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  color: var(--dsw-alias-label-primary);\n  font-size: 13px;\n  line-height: 20px;\n}html[data-codex-ui] .cx-row__desc{\n  margin-top: 2px;\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 11px;\n  line-height: 16px;\n}html[data-codex-ui] .cx-row__control{\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  justify-self: end;\n}html[data-codex-ui] .cx-row--stack .cx-row__control{\n  justify-self: stretch;\n}html[data-codex-ui] .cx-swatch{\n  width: 24px;\n  height: 24px;\n  padding: 0;\n  border: 0.5px solid var(--dsw-alias-border-l2);\n  border-radius: var(--dsw-radius-s, 6px);\n  background: none;\n  cursor: pointer;\n}html[data-codex-ui] .cx-swatch::-webkit-color-swatch-wrapper{\n  padding: 2px;\n}html[data-codex-ui] .cx-swatch::-webkit-color-swatch{\n  border: none;\n  border-radius: calc(var(--dsw-radius-s, 6px) - 2px);\n}html[data-codex-ui] .cx-hex{\n  width: 96px;\n  height: 24px;\n  padding: 0 8px;\n  border: 0.5px solid var(--dsw-alias-border-l2);\n  border-radius: var(--dsw-radius-s, 6px);\n  background: var(--dsw-alias-bg-base);\n  color: var(--dsw-alias-label-primary);\n  font-family: var(--ds-font-family-code);\n  font-size: 11px;\n  letter-spacing: 0.04em;\n}html[data-codex-ui] .cx-hex:focus-visible{\n  outline: 2px solid var(--dsw-focus-ring-color);\n  outline-offset: 1px;\n}html[data-codex-ui] .cx-text{\n  width: 220px;\n  height: 24px;\n  padding: 0 8px;\n  border: 0.5px solid var(--dsw-alias-border-l2);\n  border-radius: var(--dsw-radius-s, 6px);\n  background: var(--dsw-alias-bg-base);\n  color: var(--dsw-alias-label-primary);\n  font-size: 12px;\n}html[data-codex-ui] .cx-text:focus-visible{\n  outline: 2px solid var(--dsw-focus-ring-color);\n  outline-offset: 1px;\n}html[data-codex-ui] .cx-range{\n  width: 160px;\n  accent-color: var(--dsw-alias-link);\n}html[data-codex-ui] .cx-range__value{\n  min-width: 24px;\n  color: var(--dsw-alias-label-secondary);\n  font-family: var(--ds-font-family-code);\n  font-size: 11px;\n  text-align: right;\n}html[data-codex-ui] .cx-note{\n  margin: 0 0 8px;\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 11px;\n  line-height: 16px;\n}html[data-codex-ui] .cx-error{\n  margin: 8px 0 0;\n  /* 旧值读的是 --dsw-alias-state-error —— 这个令牌宿主与本皮肤都没有，于是永远落到回退的\n     主文本色，「保存没生效」的提示看起来跟普通说明一样。改读真实存在的 error-primary。 */\n  color: var(--dsw-alias-state-error-primary);\n  font-size: 11px;\n  line-height: 16px;\n}\n";
    /** 生成期注入的覆盖层模块（源：src/override.js）。 */
    const __override = (() => {
/**
 * override.js — 设置页写进页面的那一层覆盖（纯函数：无 DOM、无副作用、可单测）。
 *
 * 为什么要单独一层：skins/*.css 是**默认值**，设置页改的是**用户覆盖**。
 * 把用户值写回源样式会让「默认长什么样」无法回答，也无法一键还原，
 * 所以覆盖只在运行时以多一个属性的选择器（特异性 +1）压过皮肤，源文件一个字不动。
 *
 * 取值纪律：
 *   · 空串 = 不覆盖（退默认层），默认值下本模块输出空串 —— 「装上不动一个字也不改外观」是夹具断言；
 *   · 颜色只认 6 位十六进制（与 Codex schema 的 /^#[0-9a-fA-F]{6}$/ 一致）；
 *   · 本模块**不产生任何彩色**：除强调色（用户显式指定）外只有中性 rgba，与皮肤的「无彩色 chrome」纪律一致。
 *
 * Codex 侧依据（app.asar 的 jdi / IOe）：
 *   dark  { accent:#339cff, contrast:60, ink:#ffffff, surface:#181818 }
 *   light { accent:#339cff, contrast:45, ink:#1a1c1f, surface:#ffffff }
 * 对比度是**简化实现**：Codex 用线性 RGB 混合把文本往 ink 拉、并按同一常量抬升灰阶；
 * 这里只做两件可解释的事 —— 文本档位按同一方向混合、发丝线与色调家族按比例缩放。
 * 差距写在 README 的「与 Codex 源码对账」一节，不含糊。
 */

/** 覆盖层生效时打在 <html> 上的第二个属性（比皮肤自身多一个属性 ⇒ 特异性稳赢）。 */
const OVERRIDE_ATTR = 'data-codex-ui-theme';
/** 皮肤自身的根属性，与 src/build.mjs 的 ATTR 同源。 */
const SKIN_ATTR = 'data-codex-ui';
/** 设置表单的命名空间 = profile 条目 id（= 包名）。 */
const SETTINGS_ENTRY_ID = 'codex-ui';

/** Codex 默认对比度：亮 45 / 暗 60。 */
const DEFAULT_CONTRAST = { light: 45, dark: 60 };

/**
 * 皮肤默认值（空串即回落到这里）。surface = 设置页「背景」那一行 = --dsw-alias-bg-base。
 * 深色 surface 自 0.5.6 起是窗口背景 #111111（#181818 是表面/侧栏那一层）；这里曾停在 #181818，
 * 设置卡的背景色块因此显示错的默认值。check-repo 现在逐字段对账 skin.css，漂移即 FAIL。
 */
const SKIN_DEFAULTS = {
  light: { accent: '#339cff', focus: '#339cff', surface: '#ffffff', ink: '#1a1c1f', sidebar: '#eef4f9' },
  dark: { accent: '#0169cc', focus: '#339cff', surface: '#111111', ink: '#ffffff', sidebar: '#181818' },
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
    blocks.push(sel(SKIN_ATTR, 'light') + ',\n' + sel(SKIN_ATTR, 'light-body') + ' {\n' + decls + '\n}');
  }
  if (dark.length > 0) {
    const decls = dark.map(([k, v]) => '  ' + k + ': ' + v + ';').join('\n');
    blocks.push(sel(SKIN_ATTR, 'dark') + ' {\n' + decls + '\n}');
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
 * @param attr - 皮肤根属性名。
 * @param which - 'light' | 'light-body' | 'dark'。
 * @returns CSS 选择器。
 */
function sel(attr, which) {
  const root = 'html[' + attr + '][' + OVERRIDE_ATTR + ']';
  if (which === 'light') return root;
  if (which === 'light-body') return root + ' body';
  return root + ' body[data-ds-dark-theme]';
}

return { OVERRIDE_ATTR, SKIN_ATTR, SETTINGS_ENTRY_ID, DEFAULT_CONTRAST, SKIN_DEFAULTS, LABEL_TIERS, ALPHA_LADDER, SIDEBAR_ALPHA, SCALE_RANGE, MIX_RANGE, HEX_RE, isHex, mixHex, withAlpha, contrastEffect, themeOverrideCss, isFontStack, sel };
})();
    /** 生成期注入的模型选择器组件（源：src/model-picker.js）。 */
    const __modelPicker = (() => {
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
const MODEL_SLOT = 'conversation.input.model';
/** 自建节点的类名根（样式表只画这些类，不碰宿主任何节点）。 */
const TRIGGER_CLASS = 'codex-mp-trigger';
const POPOVER_CLASS = 'codex-mp-popover';
/** Codex _ThumbScale 28px：拇指中心的行程是 [14, 宽 − 14]。 */
const THUMB_SIZE = 28;
/** Codex --model-picker-power-slider-thumb-input-motion-duration：首帧 0s，16ms 后抬到 .3s。 */
const MOTION_ARM_MS = 16;
/** 弹层定位（宿主 ModelSelect 的 place()：右沿对齐触发器、上方留 8px、视口留 12px）。 */
const POPOVER_GAP = 8;
const POPOVER_MARGIN = 12;
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
 * 与 CSS 同一条公式的像素值（夹具与验收用）：calc(14px + (100% − 28px) × ratio)。
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
 * 席位所属的会话 id。
 * @param slot - 席位元素。
 * @param fallback - 取不到时的回退（返回主视图会话 id 的函数）。
 * @returns 会话 id 或 null。
 */
function sessionIdOf(slot, fallback) {
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
function viewOf(snap) {
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
function listSignature(view) {
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
function installModelPicker(env) {
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

return { MODEL_SLOT, TRIGGER_CLASS, POPOVER_CLASS, THUMB_SIZE, MOTION_ARM_MS, POPOVER_GAP, POPOVER_MARGIN, snapIndex, indexRatio, offsetRatio, ratioOffset, sortGroups, sessionIdOf, viewOf, listSignature, installModelPicker };
})();
    /* 生成期注入的设置卡片（源：src/settings-card.js）。 */
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


    /**
     * 这里导出的是 cordis **服务名**，与 package.json 的 dsh.client.inject 不是一回事：
     *   · package.json 的 dsh.client.inject 列**包名**，只用于客户端模块图排序；
     *   · 本处导出的 inject 列**服务名**，loader 拿它逐个 ctx.get() 判断依赖是否就绪，
     *     缺一个这条 entry 就永远停在 pending，整个 web boot 报
     *     `1 entry did not activate` 直接起不来。
     * 曾把包名 `@deepseek-ai/dsh-client-ui-slots` 写在这里。而 0.1.7 的客户端里它是
     * 静态模块、不注册同名服务（服务名是 `slots`，由 @deepseek-ai/dsh-client-ui-renderer
     * 提供），于是 entry 卡死、桌面端白屏报错。对照官方与第三方插件（dshmarket、
     * dsh-chatgpt-subscription、dsh-client-ui-model-capabilities）：导出的 inject
     * 一律是 ["slots", "locale", "remote", …] 这种短服务名。
     *
     * `configForms` 由 @deepseek-ai/dsh-client-ui-settings 提供（其构造器里 super(ctx, "configForms")），
     * 是组合包页那张配置卡的读写通道；本插件的 engines 锁定了带它的宿主版本，故直接声明。
     *
     * `theme` 由 @deepseek-ai/dsh-client-ui-theme 提供（`ctx.provide("theme", …)`），是宿主主题偏好的
     * **唯一写入口**：卡片上那一行「主题」写的就是它，与「设置 → 通用 → 外观」同一处，
     * 所以切完整个应用一起变，不是卡片自己的界面状态。
     */
    const inject = ['slots', 'configForms', 'theme'];

    /**
     * 注入样式表并打上作用域根属性。
     *
     * 关键：**没有 effect 也要把样式留着**。旧版这里写的是 else dispose()，
     * 即「ctx.effect 不可用 → 注入完立刻删掉，连 data-codex-ui 一起收回」——
     * 表现就是插件完全没生效、控制台一行报错都没有，是最难查的一种失败。
     * 现在降级为「注入但不可回收 + 一条 warn」。
     *
     * @param ctx - 客户端上下文。
     */
    function apply(ctx) {
      const root = document.documentElement;
      root.setAttribute(ROOT_ATTR, '');
      const tag = document.createElement('style');
      tag.dataset.plugin = PLUGIN_ID;
      tag.dataset.pluginCss = PLUGIN_ID + '/theme.css';
      tag.textContent = CSS;
      document.head.appendChild(tag);
      const dispose = () => {
        tag.remove();
        root.removeAttribute(ROOT_ATTR);
      };
      if (typeof ctx.effect === 'function') {
        ctx.effect(() => dispose, 'codex-ui: stylesheet');
      } else {
        console.warn('[codex-ui] ctx.effect 不可用：样式已注入，但不会随 fiber 卸载回收。');
      }
      /* 设置页那一半：任何一步失败都只降级，不能连皮肤一起拖下水。 */
      let formScope = null;
      try {
        formScope = installSettings(ctx, root);
      } catch (error) {
        console.warn('[codex-ui] 设置页挂载失败，皮肤照常：', error);
      }
      /* 模型选择器同理：挂不上就把席位留给宿主原生菜单（A 面样式照常生效）。 */
      try {
        installModelPicker(ctx, formScope);
      } catch (error) {
        console.warn('[codex-ui] 模型选择器挂载失败，宿主原生菜单照常：', error);
      }
    }

    /**
     * 模型选择器 B 面（src/model-picker.js）。
     *
     * 等宿主的 modelDirectories 服务就绪再装：ctx.inject(deps, fn) 是宿主自己挂 composer 模型位的
     * 同一个口子（dsh-client-ui-model-selection 也是这么等的）。服务不在时不阻塞本插件激活 ——
     * 不能把它写进上面的 inject 列表，那样缺一个服务整个皮肤都停在 pending；服务撤走时 fn 的作用域
     * 连同我们的节点一起回收。
     * 设置卡的「Codex 模型选择器」（modelPicker，默认开）关掉 → setEnabled(false)：自建节点全撤，
     * 宿主那一格经 model-picker.css ① 的 :has() 立刻复原。
     * @param ctx - 客户端上下文。
     * @param formScope - 本插件的设置表单；没有设置服务时为 null（此时按默认开）。
     */
    function installModelPicker(ctx, formScope) {
      if (typeof ctx.inject !== 'function') {
        console.warn('[codex-ui] ctx.inject 不可用：模型选择器不挂，宿主原生菜单照常。');
        return;
      }
      /** 设置文档里的开关；文档还没到时返回 null（保持现状，不先接管再撤回）。 */
      const wanted = () => {
        if (formScope === null) return true;
        const snapshot = formScope.getSnapshot();
        if (snapshot !== undefined && snapshot !== null && snapshot.value === undefined) return null;
        const value = snapshot === undefined || snapshot === null || snapshot.value === null ? {} : snapshot.value;
        return value.modelPicker !== false;
      };
      ctx.inject(['modelDirectories'], (scope) => {
        const picker = __modelPicker.installModelPicker({
          models: scope.modelDirectories,
          /* 席位祖先上没有 data-conversation-session 时退到主视图会话（uiSession 投影）。 */
          sessionFallback: () => {
            const ui = ctx.reflect.get('uiSession');
            const current = ui === undefined || ui === null ? null : ui.current;
            return current === undefined || current === null || current.value === undefined || current.value === null ? null : current.value.key;
          },
          locale: ctx.reflect.get('locale'),
          enabled: wanted() === true,
        });
        const sync = () => {
          const next = wanted();
          if (next !== null) picker.setEnabled(next);
        };
        const off = formScope !== null && typeof formScope.subscribe === 'function' ? formScope.subscribe(sync) : null;
        scope.effect(() => () => {
          if (typeof off === 'function') off();
          picker.dispose();
        }, 'codex-ui: model picker');
      });
    }

    /**
     * 挂上覆盖层与组合包页的配置卡。
     * @param ctx - 客户端上下文。
     * @param root - <html>。
     * @returns 本插件的设置表单（模型选择器的开关也读它）；没有设置服务时 null。
     */
    function installSettings(ctx, root) {
      const forms = ctx.configForms === undefined || ctx.configForms === null ? null : ctx.configForms;
      const scope = forms === null ? null : forms.get(__override.SETTINGS_ENTRY_ID);
      if (scope === null || scope === undefined) {
        /* 没有设置服务：不注册座位、不加覆盖层，皮肤照常。 */
        console.warn('[codex-ui] 没有 configForms 服务：设置页不可用，皮肤照常。');
        return null;
      }
      const tag = document.createElement('style');
      tag.dataset.plugin = PLUGIN_ID;
      tag.dataset.pluginCss = PLUGIN_ID + '/settings-override.css';
      document.head.appendChild(tag);
      const render = () => {
        const snapshot = scope.getSnapshot();
        /* 文档还没到（status=loading / 连接刚重连）时 value 是 undefined。
           这时**保持现状**：把已生效的覆盖撤掉会让用户看到自己的设置闪一下没了。
           真正的「没有覆盖」是 value 存在且字段为空 —— 那条路径照旧清空。 */
        if (snapshot !== undefined && snapshot !== null && snapshot.value === undefined) return;
        const values = snapshot === undefined || snapshot === null || snapshot.value === null ? {} : snapshot.value;
        const css = __override.themeOverrideCss(values);
        tag.textContent = css;
        /* 没有覆盖时连属性一起摘掉：默认态与「没装设置页」逐字节相同。 */
        if (css === '') root.removeAttribute(__override.OVERRIDE_ATTR);
        else root.setAttribute(__override.OVERRIDE_ATTR, '');
      };
      render();
      const off = typeof scope.subscribe === 'function' ? scope.subscribe(render) : null;
      if (typeof ctx.effect === 'function') {
        ctx.effect(() => () => {
          if (typeof off === 'function') off();
          tag.remove();
          root.removeAttribute(__override.OVERRIDE_ATTR);
        }, 'codex-ui: settings override');
      }
      /* 切主题时关掉过渡：交叉淡出看起来就是「闪」。两帧后摘掉，切换变成一次到位。 */
      const suppressTransitions = () => {
        root.setAttribute(SWITCH_ATTR, '');
        requestAnimationFrame(() => requestAnimationFrame(() => root.removeAttribute(SWITCH_ATTR)));
      };

      /* ── 主题的本地预览 ──────────────────────────────────────────────────
         点下去到变色原本要等一次设置文档往返（实测 780–824ms）。这里把目标主题先应用掉，
         宿主稍后带着同样结果回来时幂等地交还给它。 */
      let preview = null;
      let previewTimer = 0;
      /** 按宿主自己的方式打主题：body 上的 palette 属性 + html 的 color-scheme。 */
      const applyScheme = (scheme) => {
        if (typeof document.body.toggleAttribute === 'function') document.body.toggleAttribute('data-ds-dark-theme', scheme === 'dark');
        root.style.colorScheme = scheme;
      };
      /** 目标偏好 → 实际那一套（system 跟随系统，与宿主同一套解析规则）。 */
      const schemeOf = (target) => {
        if (target === 'dark' || target === 'light') return target;
        return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      };
      /**
       * 结束预览。
       * @param confirmed - true 表示宿主已经带着同一个结果发布过，文档就是真相；
       *                    false 表示等超时了，按宿主当前的真值回滚，绝不把预览当成结果。
       */
      const endPreview = (confirmed) => {
        if (preview === null) return;
        if (previewTimer !== 0) { clearTimeout(previewTimer); previewTimer = 0; }
        preview = null;
        root.removeAttribute(PREVIEW_ATTR);
        if (confirmed) return;
        try {
          const active = themeServiceActive();
          if (active !== null) applyScheme(active);
        } catch { /* 读不到服务就保持现状，不做二次猜测 */ }
      };
      /** 宿主主题服务当前解析出的那一套；读不到返回 null。 */
      const themeServiceActive = () => {
        const snap = ctx.theme === undefined || ctx.theme === null ? null : ctx.theme.getTheme();
        const scheme = snap === undefined || snap === null || snap.active === undefined || snap.active === null ? null : snap.active.colorScheme;
        return scheme === 'dark' || scheme === 'light' ? scheme : null;
      };
      /**
       * 立刻按目标主题显示（不等文档往返）。
       * @param target - 'light' | 'dark' | 'system'。
       */
      const previewTheme = (target) => {
        if (target !== 'light' && target !== 'dark' && target !== 'system') return;
        const scheme = schemeOf(target);
        preview = { target, scheme };
        root.setAttribute(PREVIEW_ATTR, scheme);
        suppressTransitions();
        applyScheme(scheme);
        if (previewTimer !== 0) clearTimeout(previewTimer);
        previewTimer = setTimeout(() => endPreview(false), PREVIEW_TIMEOUT_MS);
      };

      if (typeof ctx.on === 'function' && typeof ctx.effect === 'function') {
        ctx.effect(() => ctx.on('theme/change', (snapshot) => {
          suppressTransitions();
          const scheme = snapshot === undefined || snapshot === null || snapshot.active === undefined || snapshot.active === null ? null : snapshot.active.colorScheme;
          /* 发布结果与预览一致 ⇒ 文档已落地，交还给宿主（幂等，看不见第二次跳变）。 */
          if (preview !== null && scheme === preview.scheme) endPreview(true);
        }), 'codex-ui: theme change');
        ctx.effect(() => () => endPreview(false), 'codex-ui: theme preview cleanup');
      }
      registerSettingsCard(ctx, CodexUiSettingsCard, {
        theme: ctx.theme,
        /* 主题插件自己的设置表单（命名空间 ui-theme，字段 preference）。
           卡片写主题偏好走它，而不是 theme.setTheme() —— 原因见 settings-card.js 里的注释。 */
        themeForm: typeof ctx.configForms.get === 'function' ? ctx.configForms.get('ui-theme') : null,
        /* 主题变更走宿主事件：layout 侧也是 ctx.on("theme/change", …) 这一个口子。 */
        watchTheme: (listener) => (typeof ctx.on === 'function' ? ctx.on('theme/change', listener) : () => {}),
        /* 点下去立刻按目标主题显示，文档往返在背后跑。 */
        previewTheme,
      });
      return scope;
    }

    return { apply, inject, PLUGIN_ID };
  },
});
