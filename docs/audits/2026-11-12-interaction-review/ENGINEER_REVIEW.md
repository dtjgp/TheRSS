# Engineer 只读评审：交互改进 I1–I6

日期：2026-11-12。只读评审完成，未实施。未修改任何仓库文件。

## 基线

- Engineer 与 Manager 的 HEAD 均为 `b1ea9222ee73ba8d8ca5d501846ed2d1e9ced6c0`，无差异。
- Engineer 工作区无未提交改动。Manager 工作区只有未跟踪的 `docs/audits/2026-11-12-interaction-review/`（即评审文档本身）。
- 已读：AGENTS.md、PRODUCT.md、GOALS.md、docs/DEVELOPMENT_WORKFLOW.md、docs/ROADMAP.md、
  skills/therss-ui-improvement/SKILL.md、docs/audits/2026-10-28-llm-wiki-status/PRIORITIES.md，以及下列源码和测试。

## 逐项结论

### I1 本地搜索的应用内打开 —— 缩小（只改提示文案；不加新按钮）。规模：低

- 反证：原生表格**单击已打开记录**。`native/appkit/node.mm:129-136` 的 `TRTable mouseDown` 在非拖拽时调用 `activateRow`，Return/Enter 同样调用。
  `src/main/appkit/localSearch.ts:138-143` 把 `activate` 接到 `openLocalResult`。
  既有契约也记录了这一行为：`docs/audits/2026-09-07-direct-interaction/CHANGE_CONTRACT.md:58`、
  `docs/audits/2026-10-05-record-window/CHANGE_CONTRACT.md:92`（"every single click in these lists" 都会激活行）。
- 目标与返回语义已存在：`presenter.ts:265-296`（`isCurrent` 防旧响应、记录不存在时的提示、Discover 搜索进行中拒绝打开、`localReturn` 保存来源路由）；
  `presenter.ts:533-541` 提供 Back to search results。空白区单击发出空值，`presentation.ts:588` 的 choice 校验会拒绝它（推断，未做运行验证）。
- 实际缺口是可发现性：`localSearch.ts:110` 只写 "Choose a result and press Return to open it"。
  `scripts/smoke-native-appkit.mjs:1278-1279` 只走键盘路径，没有物理单击证据。
  Manager 的观察很可能来自辅助功能选中行（不触发 mouseDown）——这是推断。
- 副作用：用鼠标时单击立即离开结果页，所以 "Open original" 实际只作用于默认第一行或键盘选中的行。可接受；不建议为此改变单击语义。
- 最小范围：提示文案改为“单击或按 Return 在 TheRSS 中打开；Open original 打开所选结果的原始链接”。增加“在 TheRSS 中打开”按钮会与单击重复，拒绝。
- 验收：文案单元测试；在原生应用中做一次**真实鼠标**单击（非 AX），确认打开正确记录，Back to search results 恢复查询、结果和选中项。
  Web 备用路由的 `LocalSearchPanel.tsx` 是否同步文案由用户决定，默认不改。

### I2 Daily Papers 空状态说明 —— 采纳。规模：低

- 状态已区分，不是缺失：`src/shared/llmWikiDaily.ts:33` 有六种状态，`:67-85` 有状态文案。
  `src/core/integrations/llmWikiDaily.ts:157-183` 映射状态：`no-source` 必须 0 篇；`completed`+0 映射为 `no-results`；`partial` 可以 0 篇。`:223` 为 missing，`:233` 为 unavailable。
- 主体留白属实：`src/main/appkit/dailyPapers.ts:93` 只在有论文时渲染列表区；0 篇时只剩状态行和 Refresh。
- Refresh 只重读本地文件（`dailyPapers.ts:58-63, 182-206` → `getLlmWikiDaily`），不运行扫描。
- 最小范围：0 篇或无版本时显示一段次要说明及已有恢复操作。覆盖 no-source、no-results、partial-0、missing、unavailable 和加载失败。
  no-source 必须写成“扫描记录显示公告批次对扫描不可用”，不能写成“今天没有相关论文”，也不推测原因。
  说明 Refresh 只重读本地扫描结果；有版本时保留 Open digest in Obsidian。
- 不纳入：触发扫描、调度、读取更早版本。另外，`readLatest`（`llmWikiDaily.ts:271-288`）在当天存在 no-source 版本时不会回退到前一天的完整版本；改动它会改变读取契约，应另立后续项。
- 用户决定点：Web 备用路由 `src/renderer/src/DailyPapersView.tsx` 也使用这份共享文案。可以把说明放在 shared helper 里让两条路由一致，也可以只改原生路由。
- 验收：每种状态的固定输入测试，检查准确文案且不新增 API 调用；断言 Refresh 只调用 `getLlmWikiDaily`；在窄窗口下做一次原生渲染检查。

### I3 Discover 时间范围与排序 —— 缩小并延后（用户冻结日期语义后再做）。规模：中

- 日期字段各来源含义不同：
  - `src/core/sources/github/githubClient.ts:47-48`：publishedAt 为仓库 `created_at`，updatedAt 为 `pushed_at`。
  - `src/core/sources/huggingface/huggingFaceClient.ts:135,150`：模型和数据集的 publishedAt 是 `lastModified`。
  - `src/core/sources/arxiv/arxivClient.ts:130-131`：published 与 updated（新版本）分开。
  - `src/shared/sourceDate.ts`：NCPSD 只有月份精度。
  - `src/core/sources/catalog/sourceNormalizer.ts:49-52`：缺日期的条目在归一化时被拒绝，所以“缺失日期”主要指月份精度条目和无法解析的旧行。
- 排序已有确定基础：`src/core/storage/discoverSnapshotStore.ts:208` 为 `ORDER BY result_rank ASC, item_id ASC`。排序本身已含近期加权：`src/core/ranking/rankDiscoveryItem.ts:15-38` 用 `updatedAt || publishedAt`，相对排序时刻计算。
- 行副标题只显示 publishedAt（`src/main/appkit/researchMetadata.ts:11-16`）。如果“最新”按 updatedAt 排，行上显示的日期会与排序依据不一致。
- `src/main/appkit/discover.ts` 已有 692 行，接近 800 行上限，需要先抽出视图模型。
- 若用户要做，最窄的一致方案：
  1. 只做“相关度／最新”。“最新”使用与排序近期理由相同的活动日期（updatedAt||publishedAt）；月份精度条目按区间末尾或排到最后（需决定）；同值按 result_rank 排。行上标出所用日期类型。
  2. 7 天／30 天以会话 `createdAt` 为基准，不以当前时间为基准，否则旧会话会变空。界面需说明这是对已存会话的过滤，不是新的检索。
- 用户决定点：每类来源用哪个日期；以会话时间还是当前时间为基准；月份精度条目怎么处理。
- 验收：边界测试（7/30 天端点、月份精度条目、同日期稳定排序、无法解析的日期）；不重跑规划器或适配器；过滤后为空时显示恢复操作。

### I4 本地搜索范围 —— 缩小，可作为首轮候选（需用户确认确有找回需求）。规模：中，无迁移

- 截断问题属实，且比 Manager 描述的更具体：`src/core/storage/localSearchStore.ts:56-117` 三类各自 `LIMIT 25`，合并后按 createdAt 排序，再 `slice(0,50)`。
  如果有 25 条较新的 Discover 行和 25 条较新的分析行，Saved 结果会被全部挤掉。UI 只显示 "N results"（`localSearch.ts:116-119`），不提示截断。
- 契约面：`src/shared/api.ts:112` 的 `searchLocal(query: string)`、`src/shared/ipc.ts:36`、`src/preload/index.ts:104`，以及 `src/main/windowApplication.ts:118-119` 只校验字符串。
  Web 备用 `src/renderer/src/LocalSearchPanel.tsx` 也调用同一 API。
- 最小范围：增加可选参数 `scope ∈ {all, saved, discover, analysis}`，并在 IPC 校验。scope 在 SQL 层生效：跳过其他类别，单一范围的上限提高到 50。默认 all，保持兼容；Web 备用路由不传参数时行为不变。
  同时考虑用 LIMIT+1 返回 `truncated`，用来提示“结果已截断，请细化查询”。不纳入近期搜索。
- 风险：共享类型或 IPC 签名改变会影响两条路由和契约测试；需验证 scope 在截断之前生效。
- 验收：存储测试——构造 30 条较新 Discover + 30 条分析 + 5 条较旧 Saved，all 时 Saved 被挤出（RED，记录现状），scope=saved 时 5 条全部返回；IPC 拒绝非法 scope；无网络或模型调用；原生界面的键盘范围切换。

### I5 列表收录标记 —— 延后。规模：中到高

- 详情区已有收录状态：`src/main/appkit/wikiStatus.ts`。PRODUCT.md:25-30 把收录状态限定在阅读区；列表标记需要改产品契约。
- Manager 写“先验证有界批量查询或缓存方案”，但该方案已存在：`src/core/integrations/llmWikiLibrary.ts:63-184` 做一次有界全库元数据扫描（MAX_FILES 5000，并发 16，30 秒缓存，扫描不完整时返回 unavailable）。
  批量判断“有记录／有笔记链接”可以复用这次扫描，不需要逐行遍历 vault。
- 真正的成本：
  - `note-missing`、level、readStatus 需要逐篇读取笔记头（`llmWikiLibrary.ts:115-131`）。批量版本要么不返回这些字段，要么限制读取数量。
  - 需要新 IPC 端点。
  - 原生行目前只有收藏星标和类型图标（`node.mm` 的 cell 构造），新标记要改 ObjC 原生代码或占用副标题。
  - 只适用于 arXiv 论文。
  - 状态可能过时：未检查、未找到、仅记录、有笔记、不可用必须分开，不能合成一个布尔值。
- 分歧：`PRIORITIES.md` 第 4 项曾把它列为 P1，Manager 现改为 P2。我同意延后，但这个降级需要告知用户。

### I6 Settings 和记录窗口的位置恢复 —— 延后（如做，只恢复 Settings 位置）。规模：低到中

- 现有机制不能直接复用：`src/main/windowState.ts:17-18` 写死最小尺寸 820×600，而 Settings 最小 520×460（`src/main/index.ts:206-212`），记录窗口最小 560×520（`index.ts:123-130`）。直接复用时，`parseWindowState` 会拒绝这些窗口的状态。
- Settings 高度随窗格内容自动适配：`src/main/appkit/settings.ts:135` 设置 `fitWindow`，来自 A2 决策（`docs/audits/2026-10-06-rows-settings-fit/CHANGE_CONTRACT.md`）。恢复高度会与它冲突，所以只能恢复原点。
- 记录窗口按记录键区分，并相对父窗口层叠偏移（`index.ts:114-122`）。按记录保存位置没有意义，最多记住最后一次尺寸。
- 价值取决于使用频率；还要处理多屏、缩放和屏幕移除。

## 建议首轮组合（最多三项）

1. I2（采纳）——价值明确，规模低，不改 API。
2. I1（缩小为文案）——规模很低，并补一次真实鼠标验证。
3. I4（scope 在 SQL 层生效）——前提是用户确认确有找回困难。它已在 ROADMAP 的延后项和 GOALS 的“发布后下一步”中列出，修复真实的截断问题，无迁移。
   如果用户更需要按时间浏览，可用 I3 替换，但必须先冻结日期语义。

明确不纳入：I1 新按钮；I2 中的扫描触发、调度或更早版本浏览；I3 跨来源“完整检索”的说法；I4 近期搜索；I5 全部；I6 全部；Web 备用路由的整体对齐；任何 vault 写入、安装、发布。

## 与 Manager 的分歧

1. I1：Manager 认为应用内打开要先选中再按 Return。代码表明单击已经打开记录，因此不加按钮，只改文案，并补物理单击验证。
2. I3：Manager 建议有条件纳入首轮。我认为日期字段各来源含义不同，用户冻结语义之前应延后。
3. I4：Manager 列为 P2。我认为它修复真实的截断问题，且已在路线图上，可作为首轮第三项。
4. I5：缓存和有界扫描已经存在，成本主要来自产品契约、原生行标记和笔记头读取。另外，PRIORITIES 原先把它列为 P1。
5. I6：Manager 认为可以“复用现有窗口状态机制”；实际需要参数化最小尺寸，并且 Settings 只能恢复位置。

## 需要用户选择

- 首轮第三项：I4、I3 还是不做。
- I2 是否同时改 Web 备用路由。
- I3 若纳入：日期字段、时间基准、月份精度条目的处理方式。
- 排序：GOALS.md 把 P0-1（真实检索质量、真实入库、更新安装版）和 Electron 45 残留风险排在 P1 之前。交互小修是否排在它们前面。

## 检查记录

已运行：两个工作区的 `git rev-parse HEAD` 和 `git status --short`；对文档和源码的只读 Read、grep 和 sed。

未运行：单元测试、`npm run check`、构建、E2E、原生 smoke、启动应用、物理鼠标或 AX 检查、真实检索或模型调用、vault 读写。
I1“单击打开”和“空白区单击被拒绝”两点依据源码和既有契约记录，没有本轮运行证据。
