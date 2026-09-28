<p align="center">
  <img src="assets/screenshots/live-gui.png" alt="codex-ui" width="100%">
</p>

<div align="center">

  # codex-ui

  **让 DSH Web 呈现 Codex 的外观：窗口边缘、侧栏分界、模型选择器与推理功率轨、输入区、主题色**

  [English](README.md) · [更新日志](CHANGELOG.zh-CN.md) · [MIT](LICENSE)

  [![许可证：MIT](https://img.shields.io/badge/许可证-MIT-blue.svg)](LICENSE)
  [![DSH Web Plugin](https://img.shields.io/badge/DSH%20Web-Plugin-0f766e.svg)](https://github.com/deepseek-ai/deepseek-harness)
  [![Node.js 22 或更高](https://img.shields.io/badge/Node.js-22%20%E6%88%96%E6%9B%B4%E9%AB%98-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org/)
  [![CI](https://github.com/rinDBeans/codex-ui/actions/workflows/ci.yml/badge.svg)](https://github.com/rinDBeans/codex-ui/actions/workflows/ci.yml)

</div>

> codex-ui 是社区维护的 DeepSeek Harness（DSH）界面插件，并非 DeepSeek AI 官方产品。

DSH Web 的界面元素按 Codex 复刻：窗口边缘的阴影与发丝线、侧栏分界线、模型与推理等级菜单、输入区结构、浅色与深色主题色。取值来自 Codex 实机截图与取色面板，逐像素测量，测量过程写在 README 的「实测值」一节，参考图存在 `assets/reference/`。

## 宿主兼容性

本工作区对照 DSH `0.1.7-rc.1`（npm 全局安装）与 `0.1.7-rc.2`（Windows 桌面壳的 `app.asar`）开发；
0.6.0 的全套验收在 npm 发布的 `@deepseek-ai/dsh@0.1.7-rc.2` 上跑（真 `dsh web` 实例 + 由它打包的 asar，见「宿主路径」）。
夹具脚本直接读 `app.asar` 里的 shipped CSS，宿主升级后若结构变化，夹具断言会失败。

## 功能

| 编号 | 内容 |
|---|---|
| ⑳ | **模型选择器 B 面**（默认开）：自建组件顶替 composer 的模型位 —— 模型列表（按提供方分组、带说明）+ Codex 推理等级**功率轨**（24px 轨 / 4px 档位点 / 28px 白拇指，真拖拽、←/→/Home/End，档位来自数据）；往返期间乐观显示新档并转圈、列表不清空；触发器档位文字模糊交叉淡入。设置里可关 |
| ⑫ | 模型选择器 A 面（关掉 ⑳ 时的宿主原生菜单）：不透明白菜单（圆角 18px）、行高 28px、行圆角 13px（同心：18 − 内衬 5）、勾选列常驻、pending 转圈 |
| ⑬ | 输入区顶栏消隐、面板按钮保留官方图标 |
| ⑬c | 顶栏两格**放开**：注册在两个槽里的条目恢复渲染（子代理后代计数 / jobs roster / 预设徽标 / 在应用中打开）；视图页签仍隐去。条目本身条件渲染，所以常态顶栏与放开前一致 |
| ⑭ | 输入卡：圆角（卡片 20/25，上栏条 = 卡片同值）、阴影、几何、工具条、hero 布局 |
| ⑯ | 右栏展开选择组件：无描边无底色、行高 52px、图标 20px、快捷键灰底 pill |
| ⑰ | composer 底部控件：加号默认无底色框、悬停才填；模型与权限控件同套悬停胶囊，且与加号一样是**全圆角**（Codex 参考图实测 R = h/2） |
| ② | 侧栏配色对齐 Codex 亮色侧栏；侧栏列对齐工作区列表行 |
| ②c | 会话窗口边缘：0.5px 发丝线加 24px 全向环境影 |
| ②d | 右栏面板：左沿只留发丝线、影只往上泄；压掉 dockkit 的 1px 深边框 |
| ②e | 右分界线拖拽柄：悬停时中段最深、两端淡出的渐变 |
| ⑱ | 插件管理 → codex-ui 组合包页的设置卡：主题 / 强调色 / 背景 / 前景 / UI 字体 / 代码字体 / 半透明侧边栏 / Codex 模型选择器 / 对比度 |

## 界面

浅色：会话窗口边缘与右栏。

![浅色主题](assets/screenshots/live-gui-rightbar.png)

输入区底栏：默认无框，悬停出胶囊。

![底栏控件](assets/screenshots/composer-controls-hover.png)

模型选择器 B 面（真 `dsh web` 实例截图）：模型列表 + 推理等级功率轨，亮 / 暗。

<p><img src="assets/screenshots/model-picker-live.png" alt="模型选择器 · 亮" width="49%"> <img src="assets/screenshots/model-picker-live-dark.png" alt="模型选择器 · 暗" width="49%"></p>

关掉 B 面时，宿主原生菜单（A 面）的 pending 状态。

![模型菜单 pending](assets/screenshots/model-pending.png)

## 安装

```powershell
npm run install:web        # node scripts/install-plugin.mjs --write
npm run install:desktop    # 桌面壳，改完重启应用
npm run build              # 由 skins/codex-ink 重新生成 theme.css 与 client.js

node scripts/install-plugin.mjs                              # 只读体检（默认 web profile）
node scripts/install-plugin.mjs --bundle --write              # 注册方式改成 dsh.profile.bundles，并清掉冗余 insert
node scripts/build.mjs --check                               # 只比对产物是否过期，不落盘
```

安装动作：把 `skins/codex-ink/` 的八份 CSS 作用域化到 `html[data-codex-ui]`，写出 `theme.css`，与 `src/client.template.js`
（内嵌 `src/override.js`、`src/model-picker.js` 与 `src/settings-card.js`）合成 `client.js`，同步到 `profiles/<name>/vendor/codex-ui`，
建 `node_modules/codex-ui` junction，并确保注册方式只有一种。作用域化与拼装只有一份实现，在 `src/build.mjs`。

注册方式二选一，**绝不能同时用**（同时存在会出现两个同名 loader 条目，市场校验判 fail 并把插件停用）：

| 方式 | 写法 | 用在 |
|---|---|---|
| bundle | 包名进 profile `package.json` 的 `dsh.profile.bundles`，由包自带 `cordis.patch.yml` 完成 insert | 桌面壳 profile、web profile（`--bundle`） |
| insert | 在 profile 的 `cordis.patch.yml` 手写 `- insert:` | 免 pnpm install 的临时验证 |

同一份样式正本也可由皮肤加载器收录：

```powershell
node scripts/install-skin.mjs          # 与 $DSH_HOME/skins/codex-ink 逐文件 SHA256 比对
node scripts/install-skin.mjs --write  # 有漂移则覆盖
```

## 目录

| 路径 | 内容 |
|---|---|
| `index.js` `cordis.patch.yml` `package.json` | 插件宿主半与清单 |
| `src/client.template.js` | 浏览器半模板（注入样式、覆盖层与设置卡座位） |
| `src/override.js` | 设置页覆盖层纯函数（无 DOM，夹具直接单测） |
| `src/settings-card.js` | 组合包页那张配置卡（构建期拼进 `client.js`） |
| `src/model-picker.js` | 模型选择器 B 面组件：DOM 顶替席位、弹层、功率轨（纯函数部分由 `check-repo` 直接单测） |
| `src/build.mjs` | 作用域化与产物生成，唯一实现 |
| `theme.css` `client.js` | 生成物，由 `src/build.mjs` 从 `skins/codex-ink/` 写出 |
| `skins/codex-ink/` | 样式正本（skin.css / patches.css / model-picker.css / sidebar-align.css / sidebar-surface.css / window-shadow.css / composer.css / settings.css） |
| `docs/` | 计划与决策留档 |
| `scripts/build.mjs` | 重新生成产物；`--check` 只比对不落盘 |
| `scripts/check-repo.mjs` | 不依赖宿主的仓库体检，CI 入口 |
| `scripts/host-paths.mjs` | 解析 `app.asar`、全局 `@deepseek-ai` 包与 Chromium |
| `scripts/pack-host-asar.mjs` | 没有桌面壳时，把 npm 装的宿主包拼成夹具能读的 `app.asar` |
| `scripts/install-plugin.mjs` `scripts/install-skin.mjs` | 安装器 |
| `scripts/*-verify.mjs` `scripts/live-gui-probe.mjs` `scripts/settings-page-verify.mjs` | 夹具验收与真 GUI 探针 |
| `scripts/make-verify-profile.mjs` | 造一次性验证 profile：插件管理页开着、只挂本插件、不碰现有 profile |
| `assets/reference/` | Codex 实机参考图 |
| `assets/screenshots/` | 验收出图 |
| `.github/workflows/ci.yml` | CI |

## 验收

| 命令 | 覆盖 | 前置 |
|---|---|---|
| `npm run check` | 语法、JSON、清单自洽、产物同源、编码、双语文档成对、机器专属路径 | 无 |
| `node scripts/audit-codex-ink.mjs` | 皮肤结构、36 组 WCAG、彩色白名单 | 无 |
| `node scripts/model-picker-verify.mjs` | ⑫（A 面宿主菜单）与 pending 指示器，20 项 | 无 |
| `node scripts/power-rail-verify.mjs` | ⑳ B 面组件：席位顶替与复原、触发器与弹层几何、功率轨 Codex 逐字几何、拖动中不提交 / 松手对齐提交一次、慢往返（600ms）里不回弹不清空且转圈、键盘四键、焦点环、Escape、换模型带默认档、失败提示、reduced-motion、深色、开关，47 项 | 无（只要 Chromium） |
| `node scripts/rightbar-verify.mjs` | 阴影层、右栏三件套、两条分界线，42 项 | 无 |
| `node scripts/sidebar-align-verify.mjs` | 侧栏列对齐，6 项 | 无 |
| `node scripts/sidebar-surface-verify.mjs` | 侧栏滚动渐隐（Codex mask 斜坡）的机制与观感：4 种状态并排、逐像素还原遮罩 alpha 曲线，13 项 | 无 |
| `node scripts/hero-verify.mjs` | ⑬⑭⑰ 与焦点环、顶栏两格放开，25 项 | 无 |
| `node scripts/composer-shadow-verify.mjs` | ⑱ 输入卡阴影对齐 Codex `--elevation-composer`：亮色三层的几何与 alpha 逐层断言、暗色 inset 且卡外零投影、窄屏远场 80→40px，外加真实渲染像素（衰减半径、卡内顶边亮度）与一条前提自检，23 项 | 无 |
| `node scripts/elevation-verify.mjs` | ⑲ `--dsw-elevation-*` 令牌与 Codex 源码对账：逐层几何与 alpha、第 1 层跟随 stroke、第 2/3 层亮暗同值（Codex 无暗色变体），外加渲染出的菜单面板确实吃到该令牌，19 项 | 无 |
| `node scripts/live-gui-probe.mjs --url <带 token 的 URL>` | 真 GUI：阴影与两条分界线 7 项，加模型位 —— B 面开着时 7 项（顶替、几何、键盘改档写进宿主 store 并改回），关着时量 A 面 pending 窗口 3 项（`--latency` 默认给往返加 800ms，本机往返 <60ms 采不到窗口） | `dsh web` 实例 |
| `node scripts/settings-page-verify.mjs --url <带 token 的 URL>` | 真 GUI：组合包页的设置卡、9 行结构、默认不覆盖、开关与强调色写入、模型选择器关掉后宿主那一格复原、刷新后仍在，共 29 项断言 | `dsh web` 实例（profile 需启用插件管理） |
| `node scripts/theme-flash-probe.mjs --url <带 token 的 URL>` | 按帧采样主题/页面切换时的「有效底色」（沿祖先找第一个不透明底色），看切换过程中是否出现既不属于起点也不属于终点的中间帧（实测 9 段约 720 帧、0 异常） | 同上 |

`npm run check` 不需要宿主。夹具验证在本机跑：取 `app.asar` 的 shipped CSS 加按渲染代码复刻的 DOM，
用 `getComputedStyle` 读值。夹具没有标题栏条、真实 AppFrame 网格与真 RPC，阴影层、分界线悬停与 pending
反馈由真 GUI 探针取证。

### 宿主路径

验收脚本读的是它跑在其中的宿主，三个路径按同一优先级解析：

1. 环境变量 `DSH_ASAR`、`DSH_GLOBAL_MODULES`、`DSH_CHROME`；
2. `scripts/host.local.json`（本机配置，已 gitignore），例：`{ "asar": "D:/.../resources/app.asar" }`；
3. 扫描常见安装位置、Playwright 的浏览器缓存与 `npm root -g`。

仓库里不含任何一台机器的绝对路径（`npm run check` 对 JS、样式与文档逐个扫描，含 `client.js` 里 JSON 转义过的形式）。

没有桌面壳时，用 npm 发布的同一批包拼一份：

```powershell
npm install @deepseek-ai/dsh@0.1.7-rc.2 --prefix <临时目录>
node scripts/pack-host-asar.mjs --from <临时目录>/node_modules --out <临时目录>/app.asar
$env:DSH_ASAR = "<临时目录>/app.asar"; $env:DSH_GLOBAL_MODULES = "<临时目录>/node_modules"
$env:DSH_CHROME = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"   # 没装 Playwright 时用系统 Edge
```

同一个 npm 包也能起真实例：`$env:DSH_HOME = "<临时目录>/home"; node <临时目录>/node_modules/@deepseek-ai/dsh/lib/bin.js web --port 3098 --no-open`
（首次运行会建 web profile；再跑一次 `install-plugin.mjs --profile web --write`）。

真 GUI 探针用法：

```powershell
dsh --profile web --port 3099 --no-open      # 终端打印带 token 的 URL
node scripts/live-gui-probe.mjs --url "http://127.0.0.1:3099/?token=..." --dpr 1.5
```

探针在量 pending 窗口前自己先开一个新会话，断言不过时退出码非 0。token 有存活期，约半小时后返回 401，重起一次取新 token。

## 设置页

官方插件管理的组合包页上那张配置卡（座位 `plugins.bundle.config`，键为**包名** `codex-ui`）。
桌面应用里：侧栏「插件」→「已安装」→ `codex-ui` → 页面上的配置卡；改完即时生效，不需要重启。

![设置页](assets/screenshots/settings-page-accent.png)

深色下同一张卡（主题切到深色后，下面三行自动改为编辑深色那一套，对比度显示深色默认档 60）：

![设置页 · 深色](assets/screenshots/settings-page-dark.png)

| 面板行 | Config 字段 | 默认 | 落点 |
|---|---|---|---|
| 主题 | —（写宿主 `ui-theme` 的 `preference`） | 跟随系统 | `ctx.theme.setTheme()`：整个应用一起切，与「设置 → 通用 → 外观」同一处 |
| 强调色 | `accentLight` / `accentDark` | 空 = 跟随皮肤 | `--dsw-alias-link`、`--dsw-codex-focus` |
| 背景 | `surfaceLight` / `surfaceDark` | 空 | `--dsw-alias-bg-base` |
| 前景 | `inkLight` / `inkDark` | 空 | `--dsw-alias-label-primary` |
| UI 字体 | `fontUi` | 空 | `--dsw-font-family` |
| 代码字体 | `fontCode` | 空 | `--ds-font-family-code` |
| 半透明侧边栏 | `translucentSidebar` | 关 | 侧栏填充与行填充转半透明 |
| Codex 模型选择器 | `modelPicker` | 开 | ⑳ B 面组件接管模型位；关掉即撤走全部自建节点，宿主原生菜单（⑫ A 面）立刻复原 |
| 对比度 | `contrastLight` / `contrastDark` | 45 / 60 | 文本档位与中性 alpha 阶梯 |

- **主题那一行不是卡片自己的界面状态**：写的是宿主 `ui-theme` 的 `preference`，与「设置 → 通用 → 外观」同一处 ——
  切完整应用一起变，刷新后还在。下面三行颜色编辑的是**当前生效的那一套**（`active.colorScheme`）。
- 但它**不走** `theme.setTheme()`：那一步是「先本地乐观发布、随后 `adopt()` 再从设置文档回读」的写法，
  文档往返慢的机器上会依次画出 新值 → 旧值 → 新值，肉眼就是「黑 → 白 → 黑」。卡片改成**先把偏好写进主题插件
  自己的设置文档**（服务内部 `host.set` 那一次写，同一命名空间 `ui-theme` 与字段 `preference`），
  发布方于是只剩 `adopt()`，一次点击只发布一次；控件用本地暂存保持手感，写入未被接受才退回服务入口。
  那 0.8s 的往返不能白等：浏览器半带一层**本地预览** —— 点下去立刻按目标主题应用
  （写的就是宿主本来就会写的两处：`body[data-ds-dark-theme]` 与 `html` 的 `color-scheme`），
  `theme/change` 带着同一个结果回来时幂等地交还；超过 2.5s 没等到就按真值回滚。
  实测点击→变色：**824ms → 22ms**（中位），且序列仍是「亮×n → 暗×m」两段，没有回打。
- 12 个字段全部 `.volatile()`：设置服务只投影标了它的字段，插件管理页也正是靠这一点认得这个条目 ——
  没有 `Config` 就没有这张卡。
- **空值 = 不覆盖**：默认值下覆盖层输出空串、`data-codex-ui-theme` 属性不出现，所以装上不动一个字时，
  样式层与 0.1.x 逐字节相同（这一条是夹具断言）。模型选择器是结构组件，不走覆盖层：它默认开，
  由 `modelPicker` 这一个开关决定，关掉后席位与宿主原生菜单完全交回。
- 覆盖只写在运行时的一条 `<style>` 里，选择器比皮肤多一个属性（特异性 +1），因此不依赖样式表先后顺序，
  `skins/*.css` 一个字不动。
- 改一下即写、没有保存按钮；文本框回车或失焦提交，写后回读确认落地；已覆盖的行显示徽标与「重置」。
- 对比度是**简化实现**：应用用线性 RGB 混合把文本往 ink 拉、并按常量抬升灰阶；这里只做同一方向的两件事 ——
  文本档位按比例混合、发丝线与中性色调家族按比例缩放（夹在 0.5×–2× 之间）。彩色状态色与 diff 底色不参与，
  免得把调色板搬进覆盖层。
- 半透明侧边栏在 Web 上没有窗口层，只能透出页面底色；深色下侧栏与内容同面，开了看不出差别 ——
  所以开关同时把侧栏行填充转半透明，否则整个开关在深色下完全无声。这是如实记录的差距，不是等价实现。
- 画布由皮肤自己画：`html` 与 `body` 在两个主题下都取本皮肤的底色（`html` 那一份用 `:has(body[data-ds-dark-theme])` 跟上 ——
  宿主只把主题标记打在 `body` 上）。切主题后的两帧内关掉全部过渡（`html[data-codex-ui-switching] *`，属性由浏览器半在
  `ctx.on('theme/change')` 时打上）。这两条都是防「闪」：前者堵住「某一帧没人画底」而露出宿主默认画布，后者堵住整页交叉淡出。

## 实测值

### 窗口边缘

`assets/reference/codex-app-reference-1x.png`（1901x1107，DPR 1）：

| 位置 | 切法 | 值 |
|---|---|---|
| 会话窗口左沿 | y=600 | x=340..355 由 238,241,247 渐变到 231,233,239，x=356 单像素 212,215,221 |
| 会话窗口上沿 | x=800 | y=30..45 由 237,242,247 渐变到 232,237,242，y=46 单像素 214,218,224 |
| 右栏面板左沿 | y=600 | x=1437 单像素 237,237,237，两侧纯白 |
| 右栏面板上沿 | x=1700 | y=46 单像素 213,218,224，上方同套渐变 |

发丝线在两份参考图里都是 1 个设备像素，因此写 0.5 CSS px：本机缩放 150%，1px 会栅格化成 2 个设备像素。

| 对象 | box-shadow |
|---|---|
| 会话窗口 | `0 0 0 0.5px var(--dsw-alias-border-l2), 0 0 24px rgba(13,13,13,.05)` |
| 右栏面板 | `0 0 0 0.5px var(--dsw-alias-border-l1), 0 -12px 24px -12px rgba(13,13,13,.05)` |

### 主题色

来源 `assets/reference/codex-theme-light.png`、`codex-theme-dark.png`（Codex 取色面板）。

| 角色 | 浅色 | 深色 | 令牌 |
|---|---|---|---|
| 强调色 | `#339CFF` | `#0169CC` | `--dsw-alias-link` |
| 背景 | `#FFFFFF` | `#111111` | `--dsw-alias-bg-base` |
| 表面（输入卡所坐） | `#FFFFFF` | `#181818` | `--dsw-composer-surface` |
| 前景 | `#1A1C1F` | `#FFFFFF` | `--dsw-alias-label-primary` |
| 悬停底 | `#F2F2F3` | `rgba(255,255,255,.08)` | `--dsw-codex-hover-fill` |

浅色三值来自取色面板 `codex-theme-light.png`；**深色自 0.5.6 起按**两个来源分层**：窗口背景取 Codex 主题取色面板 `codex-theme-dark.png` 上写的 `背景 #111111`，
表面取 `resources/app.asar` 的 `jdi.dark.surface #181818`；前景与 accent 仍取 `jdi`（`ink #ffffff`、`accent #339cff`）。
0.2.0~0.5.5 把这两层并成了 `#181818`，输入卡与背景的落差因此从 Codex 的 18 级掉到 12 级。
深色链接仍是应用的 text-link 令牌 `#0169CC`，没有跟着 accent 走。

深色层级：窗口背景 `#111111` → 侧栏/表面 `#181818` → 层1 `#212121` → 层2 `#282828` → 层3 `#303030`；alpha 家族随之由 `rgba(252,252,252,·)` 抬到 `rgba(255,255,255,·)`
（应用的深色 `--alpha-base` 是 `#fff`）。

### 侧栏配色

来源 `assets/reference/codex-sidebar-reference.png` 点采样。

| 令牌 | 值 |
|---|---|
| `--dsw-alias-bg-sidebar` | `#eef4f9` |
| `--dsw-specific-sidebar-fill` | `#eef4f9` |
| `--dsw-specific-sidebar-nav-item-active` | `#e2e9ed` |
| `--dsw-specific-sidebar-nav-item-hover` | `#e8eef3` |

## 边界

- 夹具验证不是登录态截屏。`dsh web` 的 launch token 有存活期且只在进程内。
- headless 单窗口只有前台页签处理 `:hover`，多页夹具把 web 形态页最后打开。
- 模型位的 B 面（⑳）**不注册 slot**：宿主的 `conversation.input.model` 席位照常渲染，组件把自己的触发器追加进同一席位、
  用一条直接子代 `:has()` 把宿主那一格隐藏；数据与提交只走宿主的 `ctx.modelDirectories`。Codex 功率轨的三个进阶态
  —— 高亮（未开 Fast）、Fast 模式圆点飞出、超出最大档的紫蓝渐变 —— 未做：DSH 没有 Fast 模式，也没有「超出最大档」这一态；
  触发器上 Max 档的紫色（`--color-chart-purple`）同样不做，它在彩色白名单之外。
- ⑯ 保留宿主页签条：整条隐藏会连带去掉全屏与收起按钮。
- 会话行文字列 40px，比工作区行、新会话、插件行短 2px，来自官方 `Rows.module.css` 的 `.sessionRow .title` margin，未改。
- 顶栏两格自 0.3.0 起放开（⑬·3c），因此**会话顶栏会比参考图多出条目**：只有当会话真有子代理 /
  后台 job / 预设 / 工作目录时才出现，此时它同时是"子代理在跑"的唯一可见面。取舍写在 CHANGELOG。
- `composer.css`、`patches.css` 与 `sidebar-surface.css` 使用哈希类名后缀锚点（`[class$=…]`、`[class*=…]`），宿主没有对应 `data-*` 的位置只能如此；
  计数由 `node scripts/build.mjs` 每次自报（0.6.0：composer 18 · patches 12 · sidebar-surface 2，含注释里的提及）。`model-picker.css` 为 0。

## 与 Codex 源码对账

Codex 桌面应用的 webview CSS 在 `resources/app.asar` 的 `webview/assets/app-*.css` 里；公开的 `openai/codex`
仓库是 CLI 与 TUI，不含这套界面。下表取值来自应用 `26.727.4816.0`。

| 值 | Codex | 本皮肤 |
|---|---|---|
| 动效时长 | `--transition-duration-basic: .15s`、`--transition-duration-relaxed: .3s` | `--dsw-motion-fast: 150ms`、`--dsw-motion-slow: 300ms` |
| 缓动 | `--ease-in-out` 与 `--default-transition-timing-function`，同为 `cubic-bezier(.4, 0, .2, 1)` | `--dsw-ease` |
| 焦点环 | `--color-border-focus` = `--blue-300` `#339cff`；深色同色 70% | `--dsw-codex-focus` |
| pending 转圈 | `--animate-spin: spin 1s linear infinite` | `codex-ui-spin 1s linear infinite` |
| 发丝线 | `--shadow-hairline: 0 0 0 .5px #0000001a` | 会话窗口与面板发丝线同为 0.5px 环 |
| 亮色前景 | `--color-text-foreground: #1a1c1f` | `--dsw-alias-label-primary` |
| 控件填充 | `--background-button-secondary-hover`，前景色 8% | 浅色 `#f2f2f3`（实测），深色 `rgba(255,255,255,.08)` |
| composer chip 圆角 | 全圆角胶囊（`codex-composer-chip-hover.png` 逐像素实测 R = h/2 = 21px） | `--dsw-radius-pill`（0.5.0 起显式声明；此前沿用宿主的 `--dsw-radius-sm` = 8px） |
| 功率轨 | `_Track` 24px / 圆角 12 / 前景 10% / `inset 0 0 0 .5px var(--color-border)`；`_Tick` 4px，热区 16px；`_Thumb` 28px 白片 / `.5px` `--color-border-strong` / `0 0 2px #0000001a` | `.codex-mp-track` / `-tick` / `-thumb`，同值；`--color-border` → `--dsw-codex-border`（10% / 12%），`--color-border-strong` → `--dsw-codex-border-strong`（15% / 20%） |
| 功率轨动效 | `.3s cubic-bezier(.23, 1, .32, 1)`，档位变换 `.12s`，拇指首帧 `0s`、16ms 后抬到 `.3s` | 同值（`--codex-mp-*`） |
| 选择器弹层 | 宽 `calc(var(--spacing) * 63.5)` = 254px；入场 `.32s cubic-bezier(.23,1,.32,1) 30ms`，`opacity 0 / scale(.98)` → 1 | 同值；定位照宿主 `place()`：右沿对齐、上方 8px、视口留 12px |
| 字体栈 | —（宿主 `dsh-client-ui-theme` 的 base_css_default） | `skin.css` 逐字声明一次，外观不随宿主版本漂 |

刻意保留的差异：

- 深色基面自 0.2.0 起对齐应用默认值：`jdi.dark.surface = #181818`、`jdi.dark.ink = #ffffff`，层级抬到
  `#212121 / #282828 / #303030`（应用灰阶的 gray-800 / gray-750 / gray-700）。0.1.x 用的取色面板三值
  `#111111 / #FCFCFC` 已不再使用。应用完整灰阶是
  `#0d0d0d / #181818 / #212121 / #282828 / #303030 / #414141 / #4f4f4f / #5d5d5d / #afafaf / #ededed / #f3f3f3 / #f9f9f9 / #fff`。
- 对比度滑块是简化实现（见「设置页」一节），没有复刻应用的 `Rdi + zdi·contrast` 线性混合常量。
- 输入卡圆角 25px 是 `assets/reference/codex-composer-reference.png` 上的实测值。应用 CSS 给多行输入卡 `--radius-3xl`（20px）、
  单行 22px；差额来自截图缩放比，而该比例没有记录。
- 侧栏 280px 由宿主布局决定。Codex 自己的侧栏是 `clamp(240px, 275px, min(520px, calc(100vw - 320px)))`。
- 深色链接保留 `#0169cc`，即应用 `--color-token-text-link-foreground` 的取值；想要 `#339CFF` 现在可以直接在设置页拖强调色。
  应用自身的 `--color-text-accent` 在深色下是 `#99ceff`（`--blue-100`）。

## CI

`.github/workflows/ci.yml` 在 Ubuntu 与 Windows、Node 22 与 24 上跑 `scripts/check-repo.mjs` 与
`scripts/build.mjs --check`。夹具验收与真 GUI 探针要桌面壳与 Chromium，留在本机跑。

## 许可

MIT。