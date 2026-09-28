# 计划：把模型选择器做成真组件（对齐 dsh-claude-style 的做法）

> **状态：已执行（0.6.0，2026-09-28）。** 组件 `src/model-picker.js`，样式 `skins/codex-ink/model-picker.css`，
> 设置卡开关 `modelPicker`（默认开）。验收：`scripts/power-rail-verify.mjs` 夹具 47/47、`check-repo` 3 条纯函数与样式纪律断言、
> 真 GUI（`dsh web` 0.1.7-rc.2）`live-gui-probe.mjs` B 面 7 条 + `settings-page-verify.mjs` 开关 5 条。
>
> 注：606faea 曾以同名 0.6.0 提交过一次，但那次只提交了生成物 `client.js`，组件与样式的源文件、构建改动、
> 体检与真 GUI 探针都没进仓库（`build.mjs --check` 在它上面必然过期），随即 revert。本次是完整重做。
>
> 与下文计划的出入（都有依据，逐条记在这里）：
>
> | 计划 | 实际 | 为什么 |
> |---|---|---|
> | 给宿主触发器打 `data-*` 标记再隐藏 | 不打标记：一条直接子代 `:has(> .codex-mp-trigger)` 隐藏席位里其余子节点 | React 换掉宿主子节点时标记会丢、宿主控件闪回；`:has()` 只看「我们在不在席」，摘掉触发器宿主立刻复原（夹具「宿主换掉自己的子节点后仍隐藏」一条守着） |
> | 会话 id 读 `uiSession.current.value.key` | 先读席位祖先的 `data-conversation-session`，再退到 `uiSession` | 右栏侧边聊天有自己的 composer 席位，主视图会话 id 对它是错的；宿主 ConversationRoot 本来就把会话 id 打在祖先上 |
> | 1s 轮询 + 席位 childList 观察器 | body 子树 childList 观察器（只看元素增删 + `data-conversation-session`），回调里同步对账 | 流式输出只改文本节点，不会打进来；新席位出现的那一帧就接上，宿主控件不先闪一下 |
> | `ctx.get('modelDirectories')` 取服务 | `ctx.inject(['modelDirectories'], …)` | 宿主自己挂模型位就这么等；服务不在不阻塞皮肤激活，服务撤走时作用域连同节点一起回收 |
> | 卡片 12px 圆角 / 行 34px | 弹层 254px（Codex `spacing × 63.5`）、18px 圆角、行 28px / 13px（⑫ 同心契约） | 与 A 面菜单同一副面孔；宽度是 Codex 源码值 |
> | 往返期间保持列表 | 保持列表 **且** 轨与触发器按 pending 那一档乐观显示、档位名旁转圈 | 只保列表的话，轨在 ~1.1s 往返里会弹回旧档再跳到新档 |

> 起因：0.5.0 用纯 CSS 把宿主菜单的竖列 radio 重排成轨，实测**切换卡顿、界面简陋、不像 Codex**。
> 已 `git revert`（提交 0f49758）。本文记录从 `dsh-claude-style` 里取到的**做法**，以及下一版的落地契约。

## 0. 为什么 0.5.0 那条路是错的（根因，不辩解）

| 症状 | 根因 |
|---|---|
| 切换卡顿 | 那条轨**跑在宿主的菜单上**：约 25 条 `:has()`／`:not(:has())` 长选择器全部挂在 `body > div[role=menu]` 上。`:has()` 会触发后代失效，宿主菜单又在 hover／focus／`aria-busy`（selectModel 往返 ~1.1s）里反复重渲染，每次重算都要把这一串跑一遍。同时我把菜单的 `display`／`height`／`padding` 全改了，等于每次开合都逼 portal 重量一次尺寸与定位。 |
| 界面简陋 | 只重排了宿主那 4 行名字，**没有模型列表、没有按提供方分组、没有说明文案、没有可拖的控件** —— Codex 与 claude-style 的模型选择器这三样都有。 |

结论：模型选择器**必须换成自己的 DOM**，不能寄生在宿主菜单上。

## 1. dsh-claude-style 的做法（可复制的配方）

包位置：`$DSH_HOME/profiles/desktop/node_modules/dsh-claude-style`，实现全在 `lib/client.js`。

### 1.1 夺席位（不抢 slot，靠 DOM 顶替）

源码 `lib/client.js:9349` 附近（`syncModelControl`）：

```text
const slot = document.querySelector('[data-slot="conversation.input.model"]')
removeStrayNodes(slot, '.dsh-claude-model-btn', [modelBtn])
removeStrayNodes(document, 'body > .dsh-claude-model-popover', [modelPop, modelSubPop])
const hostRoot = slot.firstElementChild
if (hostRoot) hostRoot.setAttribute('data-dsh-claude-model-host', '')   // CSS 里 display:none
```

要点：**不注册 slot、不抢 single 座位**。宿主的触发器仍在 React 树里（隐藏即可），自己的按钮与弹层挂在 `slot` 与 `document.body` 上；
`removeStrayNodes` 是热重载防重复的兜底（HMR 会丢掉旧 fiber 的 dispose，上一代的节点还留在 DOM 里）。

### 1.2 数据与提交（宿主唯一真源）

源码 `lib/client.js:9320-9470`（`createModelCatalog`）：

```text
ctx.get('sessions')            → 当前会话 id
  · 0.2 起 sessions.list.current 已废：先读 ctx.get('uiSession').current.value.key，再回退 list.current
ctx.get('modelDirectories').directoryFor(sessionId)  → ModelDirectory（会话未就绪时会抛，要 try/catch）
  dir.load()                   → 拉 catalog（一次 RPC：remote.session.modelCatalog，宿主侧有缓存）
  dir.select({ provider, model, reasoningEffort })     → 提交（异步，拒绝由宿主 toast 报）
  dir.store.getSnapshot()      → { status, groups, current }
      status : 'idle' | 'loading' | 'selecting' | 'error'
      groups : [{ id, name, models: [{ id, name, description,
                  reasoning: { defaultEffort, efforts: [{ id, name }] } }] }]
      current: { provider, model, reasoningEffort? } | null
  dir.store.subscribe(cb)      → 响应式（订阅 store，不要订阅 dir 实例）
```

**卡顿的真正解码**（源码注释原话）：宿主把目录在整个 `selectModel` 往返期间标成 `selecting`，
往返在走网络的适配器上要好几秒。claude-style 的渲染里有一道**签名守卫**：只有在
「一组都没有、也没当前项」时才退化成加载行，否则列表照旧 —— 所以改档位时卡片不会被清空。
这一点我 0.5.0 完全没有处理。

### 1.3 渲染与交互

· 纯 DOM（`buildElement` + `innerHTML` 只用于 SVG），不引 React；每次渲染前算一个签名字符串，签名没变直接 return。
· 弹层挂 `document.body`，`positionAnchoredPopover(trigger, pop, { side: 'above', gap: 6 })`；
  一张卡时开另一张（`closeOtherPopovers(name)`）。
· 悬停 100ms 开、离开 150ms 关；两级卡片之间的间隙算「还在里面」（`pointerInPicker()` 用 rect 扩 8px 判断）。
· 推理等级是**独立的触发器 + 独立的卡片**（源码注释：the effort slider moved to its own card）。
· 设置卡有一行开关（`modelPicker`，默认开）：关掉就把席位与两张卡还给宿主。

## 2. 下一版的落地形态（Codex 外观 + 上面这套机制）

| 层 | 文件 | 内容 |
|---|---|---|
| 组件 | `src/model-picker.js`（新） | 夺席位、建触发器与弹层、订阅目录、提交选择；构建期拼进 `client.js`（与 `settings-card.js` 同一条路径） |
| 样式 | `skins/codex-ink/model-picker.css`（新） | Codex 几何：触发器 28px；卡片 12px 圆角／1px 描边／软影；分组标题；行 34px；**底部功率轨 24px** |
| 功率轨 | 同上 | Codex `_Track`/`_Range`/`_Tick`/`_Thumb` 的**真拖拽**：`pointerdown` 抓取 → `pointermove` 自由滑动（`--model-picker-power-slider-thumb-input-motion-duration` 那条 0.3s 曲线）→ 松手对齐最近档位并提交；`←/→/Home/End` 键盘；档位数与名字来自 `reasoning.efforts` |
| 开关 | `src/settings-card.js` + `src/override.js` | 新增一行「Codex 模型选择器」（默认开），关掉即 `dropModelControl()` 把席位还给宿主 |
| 验收 | 真 GUI 探针 + 夹具 | 见 §3 |

**不做**：二级「更多模型」卡（claude-style 有，Codex 没有）、厂商锁定标与说明文案的本地化表（`model-descriptions.json` 是 claude-style 自带的 40KB 数据，本插件不搬）。

## 3. 验收标准（先写死，免得又「看起来像」）

1. **真 GUI**：`[data-slot="conversation.input.model"]` 下宿主触发器 `display:none`、我们的触发器可见；宿主菜单不再被任何规则命中（`mask-image`/`display` 回到原生）。
2. **拖拽**：CDP `Input.dispatchMouseEvent` 按下 → 移动 3 格 → 松开，读 `dir.store` 的 `current.reasoningEffort` 必须等于第 3 档的 id；期间卡片**不被清空**（行数不变）。
3. **无卡顿**：把 `selectModel` 往返期间的 `aria-busy` 窗口做一次采样，卡片行数与可交互性不变；样式中不再出现挂在宿主菜单上的选择器（`grep` 一条断言）。
4. **夹具**：轨 24px／圆点 4px／拇指 28px／强调色条止于拇指中线，与 0.5.0 那版同样的几何断言（那批断言本身是对的，错的是宿主对象）。
5. **开关**：关掉后宿主触发器恢复可见、我们的节点被清干净、宿主菜单行为与没装插件一致。
