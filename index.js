/**
 * codex-ui — Host half.
 *
 * 两件事：
 *   1. 声明一条可挂载的 entry（样式与结构全部在浏览器半完成）；
 *   2. 导出 `Config` —— 设置服务只投影标了 `.volatile()` 的字段，也**只为带 volatile 字段的
 *      条目**暴露一份表单；官方插件管理页正是靠这一点才认得这个条目。没有 `Config`，
 *      组合包页上就没有那张配置卡（这一点是读 dsh-chat-ux 的宿主半与
 *      @deepseek-ai/dsh-client-ui-plugin-manager 的 README 得到的，不是猜的）。
 *      字段值的消费者全在浏览器里：host 侧不看这些值，只负责让它们可被持久化。
 *
 * ⚠ 两条硬约束，都是实测踩出来的，别改回去 —— 违反任一条的症状完全相同：
 *   `dsh: warning: 1 entry did not activate` / `codex-ui (codex-ui): failed to import`，
 *   宿主 entry 不激活 → 浏览器半进不了 boot manifest → 插件看起来「完全没生效」。
 *
 *   1. 必须用 **ESM 具名导出**。loader 用 import() 加载 entry，只认具名导出。
 *      旧的 CommonJS `module.exports = { apply, ... }` 在 ESM 下只产生 default，
 *      具名 apply 是 undefined。
 *   2. **不许用 createRequire / require**。本文件经 Cordis 的 internal.import 加载，
 *      在那里 `createRequire(import.meta.url)` 会抛（import.meta.url 不是普通
 *      file: 模块 URL）。要引包就用顶层 `import` —— 下面引 schemastery 走的正是这条路，
 *      它由 profile 的 node_modules 提升解析得到（与 dsh-chat-ux 同一形状）。
 *
 * 定位方式（可复跑）：
 *   临时 DSH_HOME + profiles/desktop-verify，
 *   `node <dsh>/lib/bin.js --profile desktop-verify --port 3081 --no-open`，
 *   看 stderr 有没有 did not activate。
 */
import Schema from '@deepseek-ai/schemastery';

/** entry 名，与 package.json 的 name 一致。 */
export const name = 'codex-ui';

/** 设置页命名空间 = 本 entry 的 id（= profile 里 `- id: codex-ui` 那一行）。 */
export const ENTRY_ID = 'codex-ui';

/** Codex 默认对比度（app.asar 的 jdi）：亮 45 / 暗 60。浏览器半有一份同样的常量。 */
export const DEFAULT_CONTRAST_LIGHT = 45;
export const DEFAULT_CONTRAST_DARK = 60;

/**
 * 这一行的配置 schema。
 *
 * 颜色字段的默认值是**空串**：空 = 不覆盖，退到皮肤自己的默认值（亮 #339cff / 暗 #0169cc 等）。
 * 因此装上不动一个字，外观与不带设置页时逐字节相同。
 * 字段名带 Light/Dark 后缀：面板上是一行，落盘是两格，靠分段控件切换编辑哪一格。
 */
export const Config = Schema.object({
  accentLight: Schema.string().default('').volatile(),
  accentDark: Schema.string().default('').volatile(),
  surfaceLight: Schema.string().default('').volatile(),
  surfaceDark: Schema.string().default('').volatile(),
  inkLight: Schema.string().default('').volatile(),
  inkDark: Schema.string().default('').volatile(),
  fontUi: Schema.string().default('').volatile(),
  fontCode: Schema.string().default('').volatile(),
  translucentSidebar: Schema.boolean().default(false).volatile(),
  /* 默认开：装上即由自建组件接管 composer 的模型位（模型列表 + 推理等级功率轨）。
     关掉即撤走全部自建节点，宿主原生的模型菜单立刻复原（皮肤给它的 A 面样式照常）。 */
  modelPicker: Schema.boolean().default(true).volatile(),
  contrastLight: Schema.number().default(DEFAULT_CONTRAST_LIGHT).volatile(),
  contrastDark: Schema.number().default(DEFAULT_CONTRAST_DARK).volatile(),
});

/** 宿主半不再需要注册任何服务；保留空 apply 以满足 entry 契约。 */
export function apply() {}
