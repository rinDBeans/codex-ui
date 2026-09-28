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
    const CSS = /*__CODEX_UI_CSS__*/ null;
    /** 生成期注入的覆盖层模块（源：src/override.js）。 */
    const __override = /*__CODEX_UI_OVERRIDE__*/ null;
    /** 生成期注入的模型选择器组件（源：src/model-picker.js）。 */
    const __modelPicker = /*__CODEX_UI_MODEL_PICKER__*/ null;
    /* 生成期注入的设置卡片（源：src/settings-card.js）。 */
    /*__CODEX_UI_SETTINGS__*/ null

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
