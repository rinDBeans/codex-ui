/**
 * 全插件共用的名字。PLUGIN_ID 同时是：npm 包名、__ModuleLoader__ 的 id、设置表单命名空间（profile 条目 id）、
 * 组合包页座位 plugins.bundle.config 的键、style[data-plugin] 的归属标记 —— DSH 要求它们一致。
 */
export const PLUGIN_ID = 'codex-ui';

/** 作用域根：theme.css 的每条规则都挂在 html[data-codex-ui] 下，摘掉即整层失效。 */
export const ROOT_ATTR = 'data-codex-ui';

/** 设置页有覆盖时打在 <html> 上：覆盖层选择器比皮肤多这一个属性，特异性稳赢。 */
export const OVERRIDE_ATTR = 'data-codex-ui-theme';

/** 切主题的那两帧打上：皮肤据此关掉全部过渡，免得整页交叉淡出（看起来就是闪）。 */
export const SWITCH_ATTR = 'data-codex-ui-switching';

/** 主题本地预览期间打上（值为预览的那一套）。 */
export const PREVIEW_ATTR = 'data-codex-ui-preview';

/** 轨迹出口「就绪」标记：只在能可靠找回对话页签时才打在 <body> 上。
 *  patches.css 的页签隐去规则挂在它下面 —— 认不出页签就不盖，页签保持可见。 */
export const TE_READY_ATTR = 'data-codex-ui-te-ready';
