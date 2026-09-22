# DSH Chat Enhancement

## 0.3.51：工作区外 Markdown 预览

文件卡片和文件引用中的 Markdown 预览支持本机绝对路径，也支持以当前会话工作目录解析的相对路径及上级目录路径。无工作目录的会话仍可预览绝对路径。文件必须存在、为普通 Markdown 文件且使用 UTF-8 编码；继续执行 maxMarkdownBytes 大小上限。补齐预览原语所需的本地化文案，代码块和脚注可正常渲染。

Markdown previews accept local absolute paths and paths resolved relative to the session workspace, including parent directories. Sessions without a workspace may preview absolute paths. Regular-file, Markdown extension, UTF-8 and maxMarkdownBytes checks remain enforced.

## 0.3.49：正文代码定位链接

Agent 可在回复正文使用 `[73–74 行](<C:/workspace/project/file.js#L73-L74>)` 引用已核验的代码范围；单行写 `#L73`，路径也可相对当前会话工作区。点击后打开 DSH 原有右侧代码预览器，加载到末行、定位起始行，并使用主题颜色短暂高亮。再次点击会重新定位。`chat-enhancement.codeReferenceHighlightMs` 设置高亮时间，默认 1600 毫秒，范围 100–10000。

正文链接渲染配套 Markdown 增强 0.1.5；只处理显式本地文件行号链接，不猜测裸行号对应文件。HTTP 链接仍按普通网页链接处理。文件读取、分页、重新加载及折行继续由原预览器管理；文件不存在时显示原预览器错误。代码高亮适用于 DSH 代码预览格式，其他文档仍由各自预览器显示。

## 0.3.48：恢复阶段与超时重试

恢复行显示读取列表、检查记录、核验、挂载或续作阶段，以及本阶段处理数量和当前会话等待秒数。细线使用当前阶段的实际计数；未知总量显示流动线。悬停可查看当前会话身份及失败原因。

列表读取、观察、挂载和子会话续作的等待使用 `recoveryReadTimeoutMs`（默认 30000 毫秒）。超时后保留原批次供重试；未完成的挂载或续作调用复用原 Promise，观察句柄迟到时释放。检查重试只重读失败项。客户端请求超时后解除按钮禁用，可重新查询；自动恢复仍不投递提示消息。

The recovery row reports listing, scanning, validation, loading and resumption stages with processed counts and elapsed waiting time. The thin line reflects the current stage; unknown totals remain indeterminate. Hover reveals the session identity and failure detail. `recoveryReadTimeoutMs` bounds each Host wait (default 30000 ms). Retry retains the batch and reuses unresolved loading/resumption calls, disposes late observation handles and rescans only failed records. A client timeout enables querying again. Recovery continues without synthetic prompts.

## 0.3.47：目标耗时与完成统计

耗时显示最多两个带名称的单位，例如 2小时23分、6分55秒；不足一分钟只显示秒。

Elapsed time uses at most two named units, such as 2h23m or 6m55s; durations under one minute show seconds only.

目标栏实时显示从创建起的耗时，编辑目标不会重置时间。复用公开 GoalBar 和编辑弹窗，保留暂停、恢复、编辑和清除。完成轮次的最后一条回复显示“目标已完成”、累计 token 和总耗时；刷新、分页、新建目标后仍保留历史统计。

时间包含等待和暂停，完成时计至收尾轮结束。token 来自本会话目标创建后到收尾轮结束的已记录请求，包含重试、输入、缓存和输出，不重复累加 reasoning，不包含子会话。提供商缺少用量时标为“已记录 ≥”，不把缺失量当作零消耗。

The goal bar shows elapsed wall time from creation, retaining the public goal controls and edit dialog. The final reply of the completion turn displays goal completion, cumulative tokens and elapsed time. Full-log projections retain summaries across reloads, pagination and replacement goals. Time includes waiting and pauses through the closing turn. Tokens cover recorded input, cache and output usage, including retries, in this session only; missing provider usage is explicitly marked as a lower bound.

## 0.3.43：保留队列的中断恢复

冷恢复保留的子会话回报和待处理输入继续在原会话消费，不再把空闲队列误判成正在运行。中断轮次身份检查仍阻止重复启动。

Persisted pending input resumes in the original interrupted session. An idle queue no longer counts as an active run; exact turn checks still reject duplicate starts.

## 0.3.42：自动续跑中断迭代

宿主启动后自动扫描并恢复最近中断的会话，不投递恢复提示。已有活动目标复用官方目标迭代；普通会话与可续作子会话使用 `continueInterrupted`，保留原会话及父子关系。手动暂停、取消、完成及运行中的任务不重复启动。`recoveryAutoResume` 默认为 `true`，可在插件配置中关闭。

需要配套宿主公开续跑能力，补丁在 `host-patches/prompt-free-recovery.patch`。缺少能力时报告恢复失败，不回退为提示投递。已存在的恢复消息保留在历史中。

The Host automatically resumes interrupted sessions without a recovery prompt. Active goals reuse the official goal driver; ordinary and continuable child sessions retain their original identities through `continueInterrupted`. Paused, cancelled, completed and running work is not restarted. The required Host patch is bundled; unsupported drivers fail explicitly. Set `recoveryAutoResume: false` to disable automatic recovery.

## 0.3.41：停止重复分组刷新

操作与思考分组仅更新变化的文字、属性和样式；忽略两个分组自身的按钮变更及聊天以外的 DOM 更新，避免互相触发扫描。推理自动展开仅监听状态与展开属性，不再被其他插件的样式写入触发。

Activity groups update changed presentation values and ignore their own buttons and unrelated page mutations. Reasoning expansion observes state and expansion attributes instead of all styling changes.

## 0.3.40：恢复进度线

恢复提示底部显示 2px 细线，按服务端已恢复与待恢复数量更新；等待首个回执时显示流动效果，完成或失败后收起。支持减少动态效果偏好。进度表示会话续作已接收，不表示业务任务完成。

A 2px line below the recovery prompt tracks accepted session resumptions. It animates while waiting for the first result, respects reduced motion, and disappears on completion or failure. It does not track task completion.

## 0.3.39：恢复时间判定

冷会话重启后挂载会追加元数据；恢复检查改用中断轮次的结束时间，避免漏掉已挂载但未续作的会话。CLI 返回逐会话检查或恢复错误，便于定位部分失败。保留 0.3.38 的提问图文、图片识别及对话控件。

## 0.3.38：提问图文与对话控件

配合主动提问 0.1.6，问题说明和选项说明支持 Markdown 图文混排。此版本同时包含图片真实格式识别、后台任务说明、推理结束延迟 3 秒折叠及主题开关。保留 0.3.37 的中断会话恢复功能。

## 0.3.37：重启恢复会话

进入网页后异步检查 DSH 启动前一小时内意外中断的会话，在会话列表底部显示一行「是否恢复意外中断会话 ✓ ×」。勾选向原会话提交续作，叉号忽略当前 Host 插件实例的提示；多标签页共享批次。检查不阻塞页面，恢复前重读记录并检查运行状态及输入队列，避免重复续作。

已完成、主动取消、一次性子会话不进入候选。可续作子会话保留原父身份，已完成的普通父会话只挂载 Agent；无法挂载的父会话和部分失败保留重试入口。恢复回执表示已接收，不是任务业务完成。默认查启动前一小时，可在插件 config 设置 recoveryLookbackMs（3600000）、recoveryPollIntervalMs（1500）、recoveryReadTimeoutMs（30000），均为正整数毫秒。

运维 CLI 复用同一检查和恢复接口：

```powershell
node <plugin>/scripts/recover-sessions.mjs check --base-url <本机DSH地址> --dsh-home <DSH_HOME>
node <plugin>/scripts/recover-sessions.mjs recover --base-url <本机DSH地址> --dsh-home <DSH_HOME>
```

check 等待检查结束，recover 自动确认一次并等待批次结束；默认总超时十分钟，可用 --timeout-ms 调整。失败退出码为 2，连接和参数错误为 1。CLI 仅访问本机地址，认证留在内存。本版包含 Host 服务，安装后重启并刷新网页。

验证覆盖合成中断、主动取消、继承历史、双击去重、失败重试、原父子身份、CLI 和实际 Cordis/Typert 注册卸载，以及构建产物的真实 UI 原语。

## 0.3.36: 模型与提供商标签

运行状态扩展槽 `conversation.chat.running-status` 可显示当前轮最近一次实际请求的模型与提供商，等待首个请求记录时不借用上一轮模型；工具执行期间保留该轮最后一次实际调用。目录只提供显示名称，下一轮选择不改变正在运行的路由标签。此位置需要宿主提供该扩展槽；没有槽时不会插入运行标签。

存在模型重定向存档时，尾注显示“已重定向 · 实际模型 · 提供商”，悬停查看“原模型 · 提供商 → 实际模型 · 提供商”。来源读取 `dsh-provider-visibility` 的历史投影，目标必须与该回复的实际请求路由一致才显示重定向。改规则、移除规则或切换当前模型不会改变旧回复的路由；旧记录缺少来源时只显示已记录的实际模型。

消息尾部显示“模型名称 · 提供商”，与输入框使用相同目录名称，保留大小写、空格和连字符。模型和提供商身份取自该条助手消息的历史 requestConfig；切换输入框模型不会改写历史标签。目录中找不到对应名称时显示记录的 ID。

公开的 DSH 插件，为聊天中的媒体和 Markdown 文件提供页内预览。

## 更新日志

### 0.3.35

- 图片预览顶部的下载、悬浮／全屏切换、关闭按钮改为图标，保留悬停提示和无障碍名称。
- 已构建客户端产物，现有测试 21 项通过、1 项跳过；无需配置或数据迁移，安装后重新加载插件并刷新页面。

### 0.3.34

- `show_image` 卡片不再显示「展示图片 · 路径」和「宽 × 高」，只保留可点击预览图。音频/视频卡片的标题和大小仍保留。
- 验证：构建客户端产物后跑现有测试；升级后需重新加载插件并刷新页面。未新增持久化迁移。
### Unreleased

- 非阻塞提问支持图文混排：问题说明 `detail` 和选项 `description` 使用 `![图片说明](https://example.com/image.png)`；本地文件使用绝对路径，如 `![示意图](<C:/work folder/image.png>)`。文字可写在图片前后，标签 `label` 保持短纯文本。此功能需要同时更新 `dsh-proactive-questioning` 的公开内容插槽；图片加载失败显示替代文字，点击图片不会选择答案。

调用示例：`queue_user_question({"questions":[{"id":"layout","question":"选择哪个布局？","detail":"下面是整体位置。\n\n![整体](https://example.com/overview.png)\n\n请比较两种布局。","options":[{"label":"方案 A","description":"按钮靠左。\n\n![方案 A](https://example.com/a.png)\n\n适合单手操作。"},{"label":"方案 B","description":"按钮居中。\n\n![方案 B](https://example.com/b.png)"}]}]})`。

- DSH 启动后自动检查启动前一小时内意外中断的会话，并在原会话直接续跑，不投递恢复消息。检查不阻塞页面；多标签页共享同一批次，失败项保留重试入口。关闭 `recoveryAutoResume` 后可手动检查和恢复。
- 已完成、主动取消、正在运行及一次性子会话不会重复恢复。可续作子会话通过原父会话地址恢复；无法挂载的父会话、读取失败和部分恢复失败保留重试入口。恢复成功指请求已接收，不代表原任务已完成。窄侧栏隐藏该行，展开后显示。
- 在 `chat-enhancement` 插件的 `config` 中可调整 `recoveryLookbackMs`（默认 `3600000`）、`recoveryPollIntervalMs`（默认 `1500`）和 `recoveryReadTimeoutMs`（默认 `30000`），均为正整数毫秒。检查按会话逐一异步读取日志；不会改写历史记录。此功能包含 Host 服务，安装后须重启 DSH 并刷新网页。

- 对话增强设置中的四个勾选框改用官方主题化 `Switch`，保留设置值、禁用状态和可访问名称。

- 推理自动展开的行在结束后默认保持 3 秒再折叠；重新开始推理时取消旧计时，重复界面更新不延长等待。关闭开关立即折叠，卸载或移除行会清理计时器。配置字段为 `chat-enhancement.reasoningCollapseDelayMs`，默认 `3000`。

- 后台任务列表支持 bash、pwsh 的调用说明，复用“显示模型自述的本次调用说明”开关。说明来自当前会话中与任务编号、原命令和启动时间匹配的工具记录；记录缺失或开关关闭时显示命令。悬停保留原命令及状态，列表继续展示耗时、失败原因和已结束任务。通过公开 header action 替换入口实现，卸载后恢复官方列表。

- 支持内容与扩展名不一致的 PNG、JPEG、WebP、GIF 图片，例如 QQ 保存的 `.png` 文件实际包含 JPEG。按文件签名纠正 MIME，保留原文件名；损坏图片和超限图片仍由官方附件服务拒绝。
- bundle 停用 `attachment-local`，由 `chat-enhancement-attachments` 继承官方存储实现。保存、历史读取、普通文件、压缩和存储目录保持官方行为。自定义附件限制或 `dshHome` 配置应移到 `chat-enhancement-attachments` 条目；卸载后恢复原条目。
- 安装更新并重载宿主后生效。

### 0.3.33

- 修复「长链路任务里选了中文、几十步之后又变回英文思考」：光靠系统提示约束不住。一次漂移会让那条英文回复进入历史，之后每一步读到的上下文都以英文为主，于是自我强化——实测有一轮 157 步的会话再也没回到中文。
- 新增**语言漂移提醒**（设置 → 对话增强 → 语言漂移提醒，默认「发现漂移时才提醒」）。插件在 `agent/pre-step` 里检查上一步助手输出的汉字占比（只统计汉字与拉丁字母，忽略数字、标点、emoji 与代码符号），低于 `0.2` 就判定为漂移，把一句**目标语言原话**的极短提醒挂到下一条消息上。三个可选值：`onDrift`（默认）／`always`（每一步都提醒）／`off`（完全不注入）。
- 提醒写成目标语言本身，这是关键：一句英文的「请用中文」正是模型跟着跑偏的东西。默认 `onDrift` 而非每步注入，因为提醒会留在对话历史里、之后每一步都要重发，`always` 更稳但更费上下文。
- 注入走官方 `agent-instructions` 范式——**改写 `decision.messages`**，而不是往 `agent.inbox` 里 prepend。后者要到**下一步**才被 claim，晚一步就拦不住刚检测到的漂移。同一时刻只保留一条提醒：新的替换旧的，模型回到目标语言后不再产生新的。
- 语言分区 order 从 9800 调到 **10300**（`DEPLOYMENT_PERSONA_SUFFIX` 10200 之后，即除 persona 后缀外最后一个）。单步 A/B 实测无差别，成本为零，但长上下文里语言规则不再排在约 1.9k 字符英文之前。
- 语言指令增补一条反漂移规则：输出语言不跟随工具结果、代码或更早的其它语言回复。
- 设置页的两行选择器合并为一个 `SettingPicker`；语言为「跟随对话」时漂移提醒行显示为禁用，并就地说明原因。
- 验证：22 项单元测试通过，另有 `scripts/verify-anchor-wiring.mjs` 的 18 项接线检查——它驱动 `apply()` 真正注册出来的 `agent/pre-step` handler，覆盖「漂移才注入 / 干净不注入 / 已有提醒被替换而非累加 / `reject` 决策原样透传 / 各模式读实时设置」等纯函数测不到的路径。未新增持久化迁移；升级后需重新加载插件并刷新页面。

### 0.3.32

- 新增「对话增强 → 思考行」开关：**推理中自动展开**。默认关闭。开启后，思考进行中的 Thinking 行自动展开显示全文并跟随最新内容；思考一结束立即恢复成默认的折叠摘要。
- 完全由插件实现，**不需要官方补丁**，也不需要重启宿主——浏览器侧读设置即时生效。
- 实现取的是「驱动 DSH 自带控件」而不是「接管渲染」：DSH 的 Think 行把展开态存在 React 的 `useState` 里，`data-expanded` 只是它的投影，因此插件点的是那一行自己的 `[data-disclosure-row][data-expandable]` 展开目标（`DisclosureRow` 在 `expandOnRowClick` 下把整行作为按钮）。展开内容、折叠态 24px 定高、`aria-expanded` 与 `hidden="until-found"` 仍全部由官方渲染器决定，插件不改任何官方源码、不写 `data-expanded`。
- 只碰它自己开过的行：控制器用 `WeakSet` 记住自动展开的实例，结算时只收起这些。**你手动展开的行不会被自动收起**；关闭开关同样只收起自动展开的那批。
- 设置项由 Host 持久化（`chat-enhancement` 命名空间的 `expandReasoningWhileRunning`，默认 `false`），因此与其它偏好一样跨刷新、跨标签页、跨浏览器一致。
- **选区批注改走附件**：批注不再拼成草稿文本，而是作为一份 `批注-<序号或时间>.json` 附件进入输入区，因此不占用聊天上下文；附件卡片可点击重新打开该批注继续编辑。走的是 `ctx.conversation.addAttachmentFiles(sessionId, files)`——`IConversation` 上专为「插件自己产出文件」提供的官方入口，与用户选文件时的路径一致，草稿文本、引用芯片和其它附件都不受影响，也不会自动发送。载荷是带 `schema` 标记的 JSON，记录引用原文、批注内容与目标坐标（`msgKey` / `msgKind` / `seq`）。
- 验证：18 项测试通过（含思考行「展开 → 结算 → 收起」全链路行为测试，以及批注附件载荷、JSON 往返、拒绝路径的契约测试）。未新增持久化迁移；升级后需重新加载插件并刷新页面。

### 0.3.31

- 新增「对话增强 → 工具行」开关：给每个工具声明一个可选的 `description` 参数，模型用一句话说明本次调用要做什么，工具行就显示这句话（bash 一直是这样显示的）。默认打开。
- 模型那一半完全由插件完成：在 `system-prompt/assemble` 瀑布里把该属性注入**装配后**的工具 schema，不碰任何官方工具定义。执行侧安全——`parameterSchemaSpecToJsonSchema` 的参数根对象不写 `additionalProperties`，JSON Schema 视为开放，各工具自己的解析只取认识的键，所以带上 description 的调用与不带的行为完全一致。属性排在最前，因为客户端对未知工具的摘要回退是按位置取「第一个字符串参数」。
- **显示那一半需要官方补丁**：`patches/2026-09-16-tool-row-description.patch`（4 个文件，基线 commit `c291e7961a`）。内容是 `SUMMARY_KEYS` 各 variant 前置 `description`，以及 `ToolRow` 把「描述」与「可点击的文件路径」拆成两个元素——原先行的折叠行只有一个文本槽，文件行里它就是那个可点开的路径标签。官方 `packages/client/ui-tool` 的 307 项测试在打补丁后全过。
- 补丁**不参与任何安装流程**：它与 pin/Import 无关，要按下面「官方补丁」一节手工 apply 并重建客户端产物；`lib/` 被官方 gitignore，所以每台机器都得自己构建。
- 未打补丁时模型仍会填写 description，只是界面上看不到（设置页那段说明已经写明），所以开关打开不会造成错误显示。

### 0.3.30

- 修复「选了简体中文、思考仍然是英文」：原先的指令整段是英文写的（`Write everything you say to the user in Simplified Chinese`），而模型看到的是满屏英文指令加英文工具输出，于是思考语言跟着上下文走。现在每个语言都自带**用该语言书写的祈使句**（`native` 字段），排在分区第一行，指令本身就是目标语言。
- 语言分区的 order 从 **30 移到 9800**（`DELIVERABLE_FILE_REFERENCES` 9000 与 `STRUCTURED_OUTPUT` 9900 之间，即提示词末尾附近）。语言是与满屏英文指令竞争的输出规则，实测排在部署指令段（25–30）里时被忽略；DSH 把 persona suffix 放在最后（10200）也是同一个理由。
- 指令新增「Do not fall back to English for thinking」，直接堵掉「上下文是英文所以我用英文想」这条退路；仍明确点名 reasoning 与可见回复都要用目标语言，并保留代码、路径、命令、日志、引文不翻译的约束。
- 测试补齐：每个可选语言必须自带非空 `native`（缺一条就等于那个语言选了没用）、母语句必须排在分区首行、分区 order 必须 > 9000。
- 未新增持久化数据或配置迁移；升级后需重新加载插件并刷新页面。

### 0.3.29

- 语言下拉改为 DSH 主题化控件：原生 `<select>` 的弹出列表由操作系统绘制，`--dsw-*` 令牌管不到它，在深色主题下会弹出一块浅色的系统菜单。现在改用公开原语 `Menu`（与「通用设置」里的界面语言行同一个）承载列表，触发按钮用 `Button`（`variant: outline`、`size: sm`），颜色、悬停、禁用态全部来自主题令牌，浅色/深色/自定义主题一致。
- 列表走 portal，避免被设置面板的滚动容器裁切；键盘可达（`aria-haspopup="menu"`、`aria-expanded`、Escape 关闭）。组件抽出为 `LanguagePicker`，活动语言名与回退逻辑复用语言目录的 `languageEntry()`。
- 未新增持久化数据或配置迁移；升级后需重新加载插件并刷新页面。

### 0.3.28

- 设置菜单新增一个「对话增强」分区，本插件的全部偏好都收在里面（原先独立占一项的「媒体播放」并入其中）：上半部分选择模型思考与回复使用的语言，下半部分保留媒体展示自动播放开关。语言可选跟随对话（默认）、简体中文、繁體中文、English、日本語、한국어、Français、Deutsch、Español、Português、Italiano、Nederlands、Polski、Svenska、Русский、Українська、Türkçe、العربية、עברית、हिन्दी、ไทย、Tiếng Việt、Bahasa Indonesia、Bahasa Melayu。语言与「通用设置」中的界面语言互不影响。
- 语言以 Host 设置项（`chat-enhancement` 命名空间的 `language` 字段）持久化，由 Host 侧注册一个 `systemPrompt` 动态分区读取。分区文本是求值函数而不是常量，因此在每次模型步骤重新装配时读取当前值：改完立即作用于后续步骤，不需要重开会话或重启 DSH；选「跟随对话」或存了本版本不认识的值时该分区为空文本，`renderPrompt` 会丢弃它，与从未配置过该偏好的部署完全一致。
- 语言目录 `src/languages.js` 是 Host 与浏览器两半的唯一来源：Host 用它生成指令，浏览器用它渲染下拉项，避免两份列表各自漂移。新增语言只需加一条。
- 指令同时约束可见回复与思考语言，并明确保留代码、标识符、路径、命令、日志和引文原文不翻译；对话中临时指定别的语言只覆盖那一轮。
- 未新增持久化以外的数据迁移；升级后需重新加载插件并刷新页面。

### 0.3.27

- 在每条已定稿助手回复的操作行中显示该轮实际使用的模型名，位置在分支按钮之后、「用时」之前；悬停显示 `provider · model · reasoningEffort`。模型取自 Trajectory 的 assistant 节点 `requestConfig`（按 `messageId` 匹配），而不是会话的当前选择——同一会话内切换模型后，历史回复仍显示各自当时的模型。
- 注册在 `conversation.chat.assistant-actions`（list 槽位，按 id 追加），不替换 DSH 原生操作行。**未**使用 `conversation.chat.turnTail`：那是 chain 槽位，按 priority 单选选举，注册进去会顶掉 `ui-deliverables` 的产出文件行。
- Trajectory 未装配或消息无 `requestConfig` 时不渲染任何内容，保持原生尾部不变；不新增持久化数据或配置迁移。
- 修复 `declares the media bundle` 测试在 `core.autocrlf` 检出下的假失败：断言前归一化 host 源码换行为 LF。
- 验证：7 项单元测试通过（新增 2 项覆盖徽章取值与槽位契约），`node --check lib/client.js` 通过。真实页面验收独立于这些测试。

### 0.3.26 — Unreleased

- 修复批注编辑面板点击外部空白不关闭：捕获阶段处理外部按下，不受 Markdown 预览停止冒泡影响；内部点击保留面板，关闭后清除旧选区以防抬起鼠标立即重开。
- 修复批注面板和输入区的透明背景，使用 DSH 已定义的 `bg-layer-2` 与 `bg-base` 主题令牌，不引入固定颜色。
- DOM 回归覆盖外部关闭、内部保持及旧选区不重开；无服务器 Playwright fixture 验证真实 DSH 浅/深主题的计算背景不透明。此验证不代替安装后实际页面验收。

### 0.3.25

- 增加聊天及 Markdown 预览选区批注：选中文字后点击「批注」，输入多行意见，再「添加到聊天」；引用与批注追加到当前草稿，最后由用户手动发送。
- 追加复用 DSH 会话输入事件，保留已有文本、引用芯片及附件；会话切换、命令模式或提交冲突不会将批注误写入其他会话。
- 浏览器产物通过 `npm run build:client` 从源码生成。
- 没有新增持久化数据或配置迁移；安装后需重新加载插件并刷新页面。批注作为普通用户消息文本发送，引用原文和批注会占用相应上下文。
- 验证：10 项单元及 React/DOM 测试通过，真实 DSH 编辑器集成验证引用芯片与附件保留、零自动发送；页面与主题验收独立于这些测试。

### 0.3.24

- 修复媒体自动播放：进入或切换聊天、恢复历史工具结果时保持静音，仅在当前聊天已打开后由 Agent 新完成媒体展示调用时尝试播放。
- 设置项文案明确为“Agent 展示时自动播放”，并说明浏览器自动播放策略仍可能拦截有声播放。
- 不再注册 DSH 已内置的 `read_image` 工具视图，避免刷新时发生重复键冲突而中断其余媒体视图的初始化。

## 范围

- `show_image` 将当前 DSH 文件系统后端可访问的图片（包括已挂载的 NAS 共享）保存为 DSH 受管附件，并作为原生图片工具结果写入会话；Agent 可主动向用户展示结果。
- 图片缩略图可打开基于受管附件原始字节的全屏预览；右上角提供下载和关闭，左右滑动、方向键或两侧按钮可按当前会话中的图片顺序查看上一张、下一张。
- 单击预览图片可隐藏悬浮、下载、关闭、翻页和尺寸控件，再次单击恢复；滑动翻页不会触发控件显隐。
- 原图预览左上角可切换为固定悬浮窗；悬浮窗默认占约 38% 屏高，拖动底部横线可在 20%–78% 屏高间调整，图片会在可用区域内保持比例同步缩放。停留在最后一张时，新展示的图片会自动成为当前预览，主动切回较早图片后则保持当前位置。
- `show_video` 在当前 DSH 进程中暂存 MP4/WebM，并以会话绑定的随机令牌供聊天端播放；浏览器不会得到原始路径。
- `show_audio` 使用相同的会话绑定读取协议展示 MP3、WAV、M4A、AAC、OGG、Opus 和 FLAC；聊天端使用原生音频控件播放。
- 设置 → 对话增强 → 媒体展示提供“Agent 展示音频/视频时自动播放”开关，写入 DSH Host 设置并在所有会话和浏览器间共享；默认均关闭。开启后，只在当前聊天已经打开、Agent 新完成 `show_audio` / `show_video` 调用时尝试播放，进入聊天、切换聊天或恢复历史消息不会播放；浏览器仍可能按自身策略阻止未交互页面的有声自动播放。
- 设置 → 对话增强 → “思考与回复语言”下拉：选定语言后，Host 向系统提示注入一段语言分区（排在提示词末尾附近），约束模型的思考与可见回复语言；默认“跟随对话”不注入任何内容。分区第一行用目标语言书写，因此指令语言本身与要求一致。这是模型语言偏好，与“通用设置”里的界面语言互不影响。改动从下一个模型步骤起生效，无需重开会话或重启；代码、路径、命令、日志与引文原文始终保留原样。极少数对语言指令遵循很弱的模型可能仍用英文思考，那属于模型行为而非设置未生效。
- 设置 → 对话增强 → 思考行 → “推理中自动展开”：开启后（默认关闭）思考中的 Thinking 行自动展开显示全文，思考结束立即恢复成折叠摘要。纯浏览器侧实现，不依赖官方补丁；开启即时生效，无需重启宿主。
- 设置 → 对话增强 → “语言漂移提醒”：默认“发现漂移时才提醒”。插件在每一步开始前检查上一步助手回复的汉字占比，低于阈值就往下一条消息里补一句目标语言的原话提醒。提醒会留在历史里、之后每一步都要重发，所以默认只在真的漂移时触发；“每一步都提醒”更稳但更费上下文，“不提醒”则完全不注入。语言选“跟随对话”时本项不生效（没有可漂移的目标语言），界面上置灰并就地说明。
- 设置 → 对话增强 → 工具行 → “显示模型自述的本次调用说明”：给每个工具声明可选 `description` 参数，模型用一句话说明本次调用要做什么，工具行显示这句话。默认打开。显示效果需要仓库 `patches/` 里的官方补丁（见「官方补丁」一节）；未打补丁时模型仍会填写，界面只显示原来的路径或参数。
- 三个展示工具均声明显式对象根 JSON Schema，兼容要求标准工具参数结构的模型提供商。
- 聊天内的 `.md` / `.markdown` 文件芯片（包括已生成文件和文件引用）点击后显示页内 Markdown 预览，不再交给本机默认应用。
- 连续三项及以上工具调用和上下文注入默认折叠为一行执行摘要；只收起较早记录，最新一项无论运行中或已完成都保留在摘要后面，下一项出现后才并入摘要。展开后保留 DSH 原有工具卡片、参数、输出、媒体预览和子调用，不替换官方工具渲染器。
- 同一聊天流内连续三项及以上思考才会合并为一组；少于三项不生成摘要，摘要展开状态按聊天流稳定保存，最新一项始终显示在摘要后面。
- 每条已定稿助手回复的操作行显示该轮实际使用的模型名（悬停展示 provider 与推理档位），位置在分支按钮后、「用时」前。该值来自该条消息自己的 `requestConfig`，因此历史回复会保留各自当时的模型。
- 图片、视频和音频展示卡不参与折叠，始终留在聊天中；其前后的普通工具调用仍可收起。
- Markdown 预览读取本机常规 UTF-8 文件；绝对路径可位于会话工作目录外，相对路径按当前会话工作目录解析。非 Markdown 文件和超限内容会被拒绝。
- 图片预览只读取该会话日志中已经记录的 DSH 附件 ID；NAS 路径只由 Host 文件系统后端读取，浏览器不会直接访问网络共享。
- 浏览器通过会话授权的 `readAttachment` 获取字节，并在内存中创建、释放 `blob:` URL。
- 不读取 `file://`，不直接访问本机或 NAS 路径，不保存文件内容或个人配置。

音频和视频缓存仅在 DSH 运行期间有效，且默认单文件上限均为 50 MiB。Markdown 默认读取上限为 2 MiB。可通过该插件的 `maxAudioBytes`、`maxVideoBytes`、`maxMarkdownBytes` 配置调整；不要把本机路径、NAS 路径或凭据写入共享配置。插件通过 `./typert` 为媒体和 Markdown 读取导出严格的 Host Remote 描述，预览服务在根 Host 上下文完成注册；已存在和后续打开的会话均通过相同的 Host 端点读取预览数据。PDF 仍需要独立的受管读取协议。

## 官方补丁（工具行自述）

`patches/` 目录里的补丁改的是 **DeepSeek Harness 官方源码**，不是本插件的一部分。它们与本插件的
pin / Import 完全无关，必须手工应用并在该机器上重建客户端产物 —— 官方把 `lib/` 列进了
`.gitignore`，**补丁不含构建产物**。

补丁说明：

| 补丁 | 基线 | 内容 |
| --- | --- | --- |
| `2026-09-16-tool-row-description.patch` | `c291e7961a`（4 个文件） | 工具行显示模型自述：`tool-call-model.ts` 的 `SUMMARY_KEYS` 各 variant 前置 `description` 并新增 `ToolRowModel.summaryIsDescription`；`ToolRow.tsx` 在描述存在时把描述与可点击路径拆成两个元素；`file-mutation-row.tsx` / `read-family-row.tsx` 传入该标记。配套模型侧由插件 `toolDescriptions` 开关完成，补丁只负责显示。 |

应用与重建（`$HARNESS` 指本机 harness 检出，**不要写死路径**）：

```bash
cd "$HARNESS"
git apply --check "<插件仓库>/patches/2026-09-16-tool-row-description.patch"   # 先 check，不落盘
git apply        "<插件仓库>/patches/2026-09-16-tool-row-description.patch"

# 只重建 ui-tool 一个包，避免碰其它包（官方规定的完整顺序见下）
node ./node_modules/typescript/bin/tsc -b packages/client/ui-tool/tsconfig.json
cd packages/client/ui-tool && node ../../../node_modules/tsdown/dist/run.mjs --env.DSH_BUILD_FACE client
```

客户端产物是**按请求读盘**的，所以重建后刷新浏览器即可，**不需要重启宿主**；宿主侧的变化（插件
`toolDescriptions`）才需要重启。验证：`packages/client/ui-tool/lib/client.js` 里应能搜到
`summaryIsDescription`（局部变量会被 minify 改名，所以用这个**属性名/字符串**当探针，别用变量名）。

官方规定的完整构建顺序（改到别的 client 包时用这条）：

```
tsc -b tsconfig.host.json → tsdown --env.DSH_BUILD_FACE host
  → tsc -b tsconfig.client.json → tsdown --env.DSH_BUILD_FACE client
```

**注意**：`tsc -b packages/client/ui-tool/tsconfig.json` 的 emit 才是 tsdown 的入口
（`DSH_BUILD_FACE=client` 时客户端 bundle 的 entry 是 `lib/types/client/index.js`），所以漏了
tsc 这一步，tsdown 打出来的还是旧代码。另外 `tsc -b` 会连带重建 ui-tool 引用到的项目，本机
`packages/client/ui-conversation` 有一处既有的类型错误会让它 exit 2 —— 但 ui-tool 自己的 emit 仍然
完成，检查 `lib/types/.../tool-call-model.js` 里有新代码即可。

**上游更新后要重放**：先 `git pull` 再 `git apply`（顺序反了会被 pull 覆盖）。`--check` 失败时用
`git apply --3way` 或 `--reject` 处理冲突，然后重新走一遍重建与验证。

## 选区批注

在同一聊天流或 Markdown 预览内选择文字，点击选区附近的「批注」。面板保存选中文字，编辑批注时不依赖浏览器仍保留选区。「添加到聊天」把这条批注作为一份 `批注-<序号或时间>.json` 附件交给输入区（不自动发送），不再把引用与意见拼成草稿文本——批注因此不占用聊天上下文，附件卡片可点击重新打开这条批注继续编辑。可重复添加多条，草稿里已有的文本、引用芯片和其它附件都不受影响。Enter 换行，Ctrl/Cmd+Enter 添加，Escape、「取消」或点击面板外部关闭并丢弃未添加批注；输入法确认不会触发添加。空白批注不能添加。编辑器、输入框内的选文以及跨聊天流选文不会触发。

批注面板是当前会话的临时状态，切换会话或刷新会丢弃尚未添加的批注。添加失败（会话已切换、输入区处于命令或提交中等）时保留文字并显示重试提示。附件走 `ctx.conversation.addAttachmentFiles()`——`IConversation` 上为「插件自己产出文件」提供的官方入口，与用户选文件时同一条路径，因此上传、预览与提交行为一致。载荷是带 `schema` 标记的 JSON，记录引用原文、批注内容与目标坐标（`msgKey` / `msgKind` / `seq`），模型侧可直接读该文件而无需用户再粘贴上下文。除这份附件外不建立第二份批注存储。

## 安装

```powershell
pnpm dsh plugin --profile web add github:vb2250158/dsh-chat-enhancement#<commit>
```

安装后重启 DSH。私有插件索引应固定提交，不要使用浮动分支。

## 验证

```powershell
npm run build:client
npm test
node --check lib/client.js
npm pack --dry-run
```

真实输入编辑器集成测试：设置 `DSH_SOURCE_ROOT` 为具有已构建 `ui-conversation` 的 DSH 源码目录，然后执行 `node tests/annotations-editor.integration.mjs`，验证实际引用芯片、附件保留与零自动提交。

DOM 测试使用已有开发依赖：将 `DSH_TEST_DEPENDENCY_ROOT` 指向能够解析 `react`、`react-dom/client`、`jsdom` 的开发包目录，再运行 `npm test`。未设置时 DOM 测试会明确跳过，不能视为浏览器验收。构建后的 `lib/client.js` 随包发布，源码改动后必须重新构建。

语言漂移提醒的接线检查：`node scripts/verify-anchor-wiring.mjs`（需 `DSH_SOURCE_ROOT` 指向含 `@deepseek-ai/dsh-llm` 的 DSH 源码目录）。它驱动 `apply()` 注册出来的真实 `agent/pre-step` handler 并断言返回的 `decision`，覆盖单元测试测不到的注册路径、实时设置读取、提醒替换而非累加、以及 `reject` 决策的透传。

背景浏览器回归：设置 `DSH_PLAYWRIGHT_ROOT` 为已有 Playwright 包目录、`DSH_SOURCE_ROOT` 为 DSH 源码目录，运行 `node tests/annotations-background.integration.mjs`。测试直接加载实际主题 CSS 并读取浏览器计算颜色，不启动服务器，不访问用户会话。

## 许可证

MIT。
