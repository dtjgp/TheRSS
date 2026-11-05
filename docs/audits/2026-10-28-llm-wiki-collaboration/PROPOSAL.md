# TheRSS × llm-wiki 深度协同：交互方案

- 日期：2026-10-28
- 状态：设计提案，待用户确认 D1–D5 后再写 Change Contract 并实现
- 原型：[`prototype.html`](prototype.html)（浏览器打开；数据为示意 fixture，不是 vault 真实记录）
- 依据：[ADR 0008](../../decisions/0008-confirmation-gated-llm-wiki-promotion.md)、`PRODUCT.md`、
  `skills/therss-ui-improvement/`、llm-wiki 的 `AGENTS.md`、`_schema.md`、
  `System/Reference/Operations/Vault_Write_Governance.md`、
  `System/Configs/Automation_Runtime_Scopes.json`（2026-10-28 只读核对）

## 1. 问题

当前联动只有一个方向、一个动作：选中一篇 arXiv 论文 → 预览 → 确认写入 llm-wiki。TheRSS 不知道 vault
里已经有什么，所以：

1. Discover/Saved 里看不出一篇论文是否已在 vault 中（vault 已有 1098 条带 `arxiv_id` 的
   `raw/paper_records`，其中大部分由 `daily-arxiv-scan` 写入）。用户只能打开预览才发现重复。
2. 写入后没有回看路径：TheRSS 不显示 note 路径、阅读状态，也不能打开 Obsidian。note 被移动或删除后，
   回执仍显示 completed。
3. vault 中已经整理好的研究上下文（Projects、Topics、Methods、`ArXiv_Scan_Keywords.md`）不能用于
   Discover 的检索计划。
4. 非 arXiv 记录（GitHub、RSS、Hugging Face）没有进入 vault 的路径。
5. 多篇论文只能逐篇预览和确认。

## 2. 设计原则

- **不替代 Obsidian**（PRODUCT 非目标）。TheRSS 不浏览、不编辑、不渲染 note 正文；需要阅读时跳转到
  Obsidian。
- **不加侧栏工作区**（决策 D5-A：保留侧栏 + 列表-详情）。新能力放在现有表面：详情区、结果栏、
  Saved 工具栏、Settings 窗口。
- **读多写少，写必确认**。读取只限白名单目录的 frontmatter 字段；写入仍由 Electron main 在
  writer lease 下执行，并显示准确路径。
- **状态显式**：区分"未检查 / 不在 vault / 已在 vault / 回执存在但 note 丢失 / vault 不可用"，
  不把旧扫描结果当作当前事实，始终显示扫描时间。
- **vault 内容视为不可信输入**：字段有长度上限，仅作为纯文本显示，不能改变路径、工具或策略。
- 视觉参数沿用已确认的 `3 / 2 / 7`，使用系统控件、SF Symbols 和语义色，不引入新依赖。

## 3. 交互方案

### 3.1 详情区：llm-wiki 状态块（原型场景 1）

位置：详情区操作按钮行下方、摘要上方。一个紧凑的信息块，内容随状态变化：

| 状态                         | 显示                                                                    | 操作                                               |
| ---------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------- |
| 不在 llm-wiki                | 未找到同一 `arxiv_id` 的 record 或 note；扫描时间                       | 操作行中保留 "Preview llm-wiki promotion…"         |
| 已在 llm-wiki（TheRSS 写入） | note 路径、L1/L2、证据等级、`status`/`decision`、回执时间与 prompt 版本 | Open in Obsidian / Reveal in Finder / Show receipt |
| 已在 llm-wiki（其他来源）    | note 路径、L1/L2、写入来源（如 `daily-arxiv-scan`）、阅读状态           | Open in Obsidian / Reveal in Finder；隐藏推送按钮  |
| 回执存在但 note 丢失         | 警告色；回执路径、扫描结果、"TheRSS 没有修改它"                         | Scan again / Preview llm-wiki promotion…           |
| vault 不可用                 | 错误色；具体原因（如治理文件缺失）                                      | Open llm-wiki Settings；推送被阻止，相关笔记不检查 |

列表行在元数据行末尾加一个书本符号和文字"In llm-wiki · L2"。状态必须有文字等价物，不能只靠颜色。

阅读状态（`status: unread|reading|read`、`decision`）取自 vault，标注为 vault 记录的值；TheRSS 不写这些字段。

### 3.2 详情区：Related in llm-wiki（原型场景 1 下半部分）

位于 "Why this matches" 之后，可折叠。列出与当前记录相关的 Topic / Method / Project note，每行给出
**确定性匹配理由**（例如"标题词 structured pruning 匹配 Method 标题"），并提供 Open in Obsidian。

- 匹配只用 note 标题、`aliases`、`tags`、`related` 与记录的标题/摘要词项做词项匹配，可测试、无模型调用
  （符合 "Domain ranking is deterministic"）。
- 底部固定说明："只匹配标题、别名和标签，不读取 note 正文"。
- 这一节也为推送预览提供反向链接候选，用户在确认前可以看到。

### 3.3 Discover：llm-wiki context（原型场景 2）

在查询栏 `Codex CLI ▾`、`Sources (22/22)` 旁增加 `llm-wiki context ▾`。它是一个与 Sources 选择器同构的
popover：搜索框 + 分组勾选（Projects、Topics、Methods、Daily scan keywords）+ 每组 Clear group。

- 默认不选。只在本次 Discover 中，把选中项的标题、别名、关键词作为有界标签加入 planner 输入；不发送
  note 正文。
- popover 底部明确写出接收方："会随本次搜索发送给 Codex CLI"。选中远程模型提供方时，接收方显示
  该提供方名称。
- `Search details` 的计划来源中记录：所选上下文、vault 扫描时间、契约哈希。planner prompt 版本相应升级。
- 结果栏增加 `llm-wiki: All / Not in llm-wiki / In llm-wiki` 过滤器，只过滤已持久化的会话，不重新运行
  模型或数据源（与现有记录类型过滤一致）。

### 3.4 Saved：批量推送队列（原型场景 3）

Saved 列表支持多选，并提供同样的 `llm-wiki` 过滤器。工具栏按钮 `Preview promotion (n)…` 打开一个 sheet：

1. **预览**：每篇论文一行，显示路由（L1/L2）、PDF 校验结果和状态（Ready / Blocked: 原因 / 已在
   llm-wiki）。被阻止的行不可勾选。"Intended paths" 折叠区列出全部准确路径。确认按钮写明数量：
   `Promote 2 papers`。
2. **执行**：逐篇写入，每篇单独持有 writer lease，每行显示进度。按钮变为
   `Stop after current paper`，不支持中途打断正在写入的论文。
3. **结束**：标题汇总 completed / partial / skipped 数量；每篇有独立回执；partial 行可以重试。

底层复用现有的单篇 preview/confirm 契约，不新增写入规则。

### 3.5 发送到 llm-wiki Inbox（原型场景 4）

对任意记录（GitHub 仓库、RSS 文章、Hugging Face、arXiv）提供 `Send to llm-wiki Inbox…`。sheet 显示：

- 新文件：`Inbox/Research_Feeds/TheRSS/<date>__<source>__<slug>.md`（只新建，不修改已有文件）；
- frontmatter：`type: inbox`、`status: unprocessed`、`source: therss`、`relevance`、`linked_to`（取自
  Related in llm-wiki）；
- 正文：标题、链接、来源时间、匹配理由、Discover 问题；只含元数据，不含 README 或网页正文；
- 可选的一行备注。

这一方案符合 vault 规则："`Inbox/` 是唯一的 feed/clip/note 入口"、"源头运行写入带日期、只追加的文件"。
后续由 llm-wiki 的 triage 处理。**前提：vault 所有者先在 `Automation_Runtime_Scopes.json` 登记
`therss-inbox-handoff`，并更新 SOP**（`Vault_Write_Governance.md:193`）。登记前，此按钮显示为不可用，
并在 Settings 中说明原因。

### 3.6 Settings：llm-wiki 窗格（原型场景 5）

Settings 窗口目前有 Personal Context、Model Provider 两个窗格，新增第三个 `llm-wiki` 窗格：

- Vault 路径（Choose… 使用原生打开面板）与 Open in Obsidian；
- 契约检查：治理文件、`therss-paper-promotion` 写入范围、L1/L2 模板，附检查时间；
- 索引：最近一次只读扫描的数量与时间，`Scan now`；明确列出读取的目录和**永不读取**的目录
  （`Life/`、`.obsidian`、`.runtime`、`.claude`）；
- 推送历史：回执数量与 `Show receipts`；
- Inbox handoff 的登记状态。

## 4. 数据与边界

| 项目     | 方案                                                                                                                                                                                                                          |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 读取范围 | 白名单：`raw/paper_records`、`Literature/Paper_Notes`、`Topics`、`Methods`、`Projects/*/Current_State.md` 与项目页、`System/Configs/ArXiv_Scan_Keywords.md`。只读 frontmatter 和标题，字段有长度上限；拒绝 symlink 和越界路径 |
| 存储     | SQLite 新增可重建的派生缓存表（vault 相对路径、类型、`arxiv_id`、标题、别名、标签、`status`、`decision`、mtime、内容哈希、扫描 ID）。回滚：删除该表，不影响其他数据                                                           |
| 扫描时机 | 首次使用相关界面时扫描一次；每次推送后扫描；用户点击 Scan now。不做后台监听或定时扫描（PRODUCT 中后台刷新仍为后续能力）                                                                                                       |
| 去重键   | `raw/paper_records.arxiv_id`（版本号归一化），再以 `paper_note` 字段定位 note，以 `raw/papers/` 判断 PDF 是否归档；与 vault 的去重顺序一致                                                                                    |
| IPC      | 新增有类型、schema 校验的只读调用：状态查询、相关笔记、上下文候选、扫描；renderer 不接触文件系统                                                                                                                              |
| 跳转     | `obsidian://open?vault=<name>&file=<相对路径>`，由 main 用 `isSafeLlmWikiRelativePath` 校验后打开；Reveal in Finder 走原生 API                                                                                                |
| 写入     | 单篇推送沿用 ADR 0008。批量推送是同一事务的顺序调用。Inbox handoff 是新的写入者，需要单独的 ADR 和 vault 侧登记                                                                                                               |

## 5. 实施切片（每片独立可交付、可回滚）

| 切片 | 内容                                                                   | 写 vault | 关键验证                                                                                   |
| ---- | ---------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------ |
| S1   | 只读索引 + 详情状态块 + 列表标记 + 结果过滤 + Settings 窗格 + 回执漂移 | 否       | fixture vault 的 RED/GREEN；五种状态的 presenter 测试；原生截图：浅/深色、窄宽度、高对比度 |
| S2   | Related in llm-wiki + Discover context（含 provenance 和 prompt 版本） | 否       | 匹配器单元测试；计划输入哈希与 provenance 测试；无上下文时行为不变                         |
| S3   | Saved 多选 + 批量推送队列                                              | 是       | 顺序执行、Stop after current、部分失败、每篇回执的 E2E fixture；不触碰真实 vault           |
| S4   | Send to llm-wiki Inbox                                                 | 是       | 先完成 vault 侧登记与 ADR；新建文件 only 的测试；lease 与 log 闭环                         |

S1 不依赖 vault 侧变更，风险最低，价值最直接，建议先做。

## 6. 需要你决定的事项

| 编号 | 问题                                                           | 建议                                               | 不决定时的默认行为                     |
| ---- | -------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------- |
| D1   | 是否允许 TheRSS 只读扫描第 4 节白名单目录的 frontmatter        | 允许                                               | 不实现 S1/S2                           |
| D2   | vault 上下文标签是否可以发送给所选 planner（可能是远程模型）   | 允许，但默认不选，且每次搜索都需要用户显式勾选     | S2 只做 Related，不做 Discover context |
| D3   | 是否需要批量推送队列                                           | 需要，放在 S3                                      | 保持逐篇推送                           |
| D4   | 是否在 vault 中登记 `therss-inbox-handoff` 并新增 Inbox 子目录 | 同意，但作为单独的 vault 变更，由你在 vault 中确认 | 不实现 S4                              |
| D5   | PRODUCT 中的未决问题"是否提供 Obsidian companion view"         | 不做 companion view，改用 obsidian:// 跳转         | 保持未决                               |

## 7. 终止条件

- S1：fixture 测试和原生截图通过后，如果真实 vault 扫描超过 2 s，或状态与 vault 实际不符，就停止扩展，
  先修复索引。
- S2：人工检查 20 条结果的 Related 列表。如果超过一半的条目没有用，就删除 Related 节，只保留状态块。
- 任何切片都不得削弱 ADR 0008 的确认、lease 和回执语义。
