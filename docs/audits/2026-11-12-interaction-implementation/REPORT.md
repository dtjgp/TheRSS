# 交互改进实施报告：I2、I1、I4

日期：2026-11-12，Europe/Rome。基线提交：`b1ea922`。变更契约：[CHANGE_CONTRACT.md](CHANGE_CONTRACT.md)。

状态：三项均已实施，单元、组件、E2E 和原生专项检查均通过。未安装、未提交、未推送、未发布。
完整的原生 AppKit smoke 门禁未通过，根因未知，不能据此宣布已排除回归；详见“未通过与未运行的检查”。
Manager 第 1 轮差异审查未发现高严重度代码问题；第 2 轮收尾见文末。

## 已完成的行为

### I2：Daily Papers 空状态

- 共享函数 `llmWikiDailyEmptyState`（`src/shared/llmWikiDaily.ts`）给出标题和说明，原生和 Web 两条路由共用。
  覆盖 no-results、no-source、partial 且 0 篇、missing、unavailable 和读取异常。
- 每条说明都以 “Refresh rereads the local scan result. It does not run the scan.” 结尾。
- no-source 的说明是 “The scan recorded that the arXiv announcement batch was not available to it.
  This does not show that no relevant papers were announced.”，不写成“没有相关论文”。
- 读取进行中（首次读取和 Refresh）不显示任何最终空状态，只保留原状态行。
- 日期、计数、Open digest、Refresh 和 Back 均保留。原生路由的读取失败改为在同一空状态中说明，不再单独显示错误标签。
- 未改 `readLatest` 回退策略，未增加扫描触发、调度或历史版本浏览。

### I1：原生本地搜索提示

- 提示文案改为：“Type 2–200 characters. Click a result or press Return to open it in TheRSS. Open
  original opens the selected result’s original link.”
- 未加新按钮，未改单击、Return 或返回的语义。Web 文案未改。

### I4：本地搜索范围与截断提示

- 查询层：`searchLocal(query, scope?)`，scope 为 `all | saved | discover | analysis`，省略时为 `all`。
  scope 决定 SQL 读取哪些类别，不是对合并后 50 条结果的过滤。
  - `all` 保留每类 25 条、合并最多 50 条、原有排序和 Discover 去重。
  - 单一范围最多 50 条。
  - 每类查询多取一行（LIMIT+1）；某类超出上限或合并后超过 50 条时，`truncated` 才为 true。
- IPC：main 用 Zod 校验 scope；非法值（`recent`、`null`、数字、`SAVED`）被拒绝，且不调用存储层。
  preload 在 scope 省略时保持原来的单参数调用。
- 原生界面：
  - 新增分段控件（All / Saved / Search sessions / Analyses）。切换范围时保留查询并立即重新搜索，旧范围的迟到响应被丢弃。
  - 清空搜索后范围回到 All；打开结果再按 Back to search results，保留查询、范围和选中行。
  - 截断提示只在 `truncated` 为 true 时显示；范围内无结果时，空状态写明范围，并提示切换到 All。
- Web 界面：不增加范围控件，仍按 all 搜索；`truncated` 为 true 时显示共享的截断说明。
- 无数据库迁移、新依赖、网络或模型调用，也没有近期搜索功能。

### 实施中发现并修复的可见缺陷

1. 范围分段控件在宽窗口被拉伸到整行，各段宽度不均。现放进一行，保持自然宽度，与 Discover 的结果类型控件一致。重新渲染后已确认。
2. 查询少于 2 个字符或正在打开记录时切换范围，原先不重绘，原生控件可能与状态不一致。先补 RED 测试，再修为总是重绘。

## 变更文件

- 产品源码：
  - `src/shared/localSearch.ts`、`src/shared/api.ts`、`src/shared/llmWikiDaily.ts`
  - `src/core/storage/localSearchStore.ts`、`src/core/storage/researchRepository.ts`
  - `src/main/windowApplication.ts`、`src/preload/index.ts`
  - `src/main/appkit/localSearch.ts`、`src/main/appkit/dailyPapers.ts`
  - `src/renderer/src/LocalSearchPanel.tsx`、`src/renderer/src/DailyPapersView.tsx`、`src/renderer/src/styles/discover.css`
- 新测试：
  - `src/core/storage/localSearchScope.test.ts`
  - `src/main/appkit/localSearchScope.test.ts`、`src/main/appkit/dailyPapersEmpty.test.ts`
  - `src/renderer/src/LocalSearchPanel.truncation.test.tsx`、`src/renderer/src/DailyPapersView.empty.test.tsx`
  - `src/shared/llmWikiDaily.test.ts`、`src/shared/localSearch.test.ts`
- 修改的既有测试（理由见契约中的验收变更记录）：
  - `src/main/windowApplication.contract.test.ts`：默认 scope 改为 `'all'`，并新增显式 scope 和非法 scope 断言。
  - `src/main/appkit/dailyPapers.test.ts`：读取失败改由空状态断言，并新增“不声称 0 篇”的断言。
  - 另有 8 个测试文件只在测试桩中补了 `scope` 和 `truncated` 字段，没有删除或弱化任何断言。
- 文档：`PRODUCT.md`（本地搜索、Daily Papers 和成功指标三处），以及本任务目录。
- 刻意未改：原生 ObjC 代码、`readLatest`、数据库 schema、Web 范围控件、Web 的 I1 文案、I3、I5、I6。
- 所有改动文件均不超过 800 行（`localSearch.ts` 312 行，`dailyPapers.ts` 256 行）。

## RED/GREEN 与命令

| 切片    | RED（实际失败原因）                                                            | GREEN                                               |
| ------- | ------------------------------------------------------------------------------ | --------------------------------------------------- |
| I4 存储 | `localSearchScope.test.ts` 3/3 失败：`scope` 为 undefined，非法 scope 未被拒绝 | 6/6（含原有存储测试）                               |
| I4 IPC  | 契约测试失败：未收到 `('edge','all')`                                          | 7/7                                                 |
| I4 原生 | `localSearchScope.test.ts` 5/5 失败：缺少 `local-search-scope`                 | 5/5；补充的重绘用例先 RED 1/6，修复后 6/6           |
| I4 Web  | 截断说明未显示                                                                 | 通过                                                |
| I2 共享 | `llmWikiDailyEmptyState is not a function`（8 个用例）                         | 8/8                                                 |
| I2 原生 | `dailyPapersEmpty.test.ts` 7/7 失败                                            | 7/7；原有读取错误断言按契约修改后，Daily 相关 11/11 |
| I2 Web  | `DailyPapersView.empty.test.tsx` 7/7 失败                                      | 7/7                                                 |

## 完整门禁

- `npm ci`（按现有锁文件安装，工作区原本没有 node_modules；无新增依赖）：exit 0。
- `npm run check`（最终代码）：exit 0。
  - 主套件 132 个文件、912 个测试；覆盖率：语句 91.94%、分支 83.73%、函数 95.25%、行 94.51%。
  - AppKit 套件 36 个文件、207 个测试；覆盖率：语句 90%、分支 84.86%、函数 87.24%、行 92.35%。
  - 架构检查、格式、lint、类型检查和构建均通过。
- 最后加入任务目录脚本后，单独重跑 `check:architecture`、`format:check` 和 `lint`：均为 exit 0。
- `npm run test:e2e`（Electron，Web 备用路由和原生 glass，临时 profile）：9/9 通过，exit 0。
- 原生专项检查 `scripts/interaction-render.mjs`：一次运行产生 53 条检查记录，全部通过，exit 0；其中 33 条是行为断言，20 条是截图捕获，不是 53 个独立测试。在最终代码上运行了两次。

## 新鲜渲染证据与隔离验证应用

- 截图和状态 JSON：
  - `/Users/dtjgp/orca/workspaces/TheRSS/Engineer/test-results/interaction-2026-11-12-final/`：20 张截图，每张附状态 JSON。目录被 git 忽略。
  - `/Users/dtjgp/orca/workspaces/TheRSS/Engineer/docs/audits/2026-11-12-interaction-implementation/evidence/`：6 张关键截图和去除路径后的 `render-check.json`。
- 覆盖范围：宽窗口 1360×880 和窄窗口 820×600。
  - 本地搜索：all 截断、Saved 范围、Analyses 范围、范围内无结果、打开记录后返回。
  - Daily Papers：五种状态。
  - 暗色窄窗口：本地搜索和 no-source。
- 重新运行（项目根目录，先 `npm run build`）：
  - `node docs/audits/2026-11-12-interaction-implementation/scripts/interaction-render.mjs <输出目录>`
- 隔离方式：
  - 临时 `--user-data-dir`。
  - 临时合成 vault（只有 `AGENTS.md`、`_schema.md` 和当天的合成 digest），通过 `THERSS_LLM_WIKI_PATH` 指定。
  - 合成 SQLite 行，标题都带 “Synthetic”。
  - 第一阶段用固定数据模式运行一次 Discover，生成有效会话，不访问网络。
  - 第二阶段关闭主服务的固定数据模式，用真实的只读 Daily 读取器读合成 vault。只有原生窗口以控件驱动标志重建，以便脚本操作控件。
  - `shell.openExternal` 被替换，检查结果显示没有打开任何外部 URL。
- Daily Papers 返回检查：`node docs/audits/2026-11-12-interaction-implementation/scripts/daily-back-check.mjs <项目根目录> <次数>`。

## 未通过与未运行的检查

- 原生 AppKit smoke（`scripts/smoke-native-appkit.mjs`，固定数据和临时 profile）在本次桌面环境下没有一次完整通过：
  - 运行 1：第 1–13 组通过，包括本地搜索组；第 14 组（窗口重建）时应用以 `NSInvalidArgumentException: Invalid number value (infinite) in JSON write` 崩溃。
  - 运行 2（不截图）：第 1–16 组通过，包括窗口重建组；第 17 组 Daily Papers 在“返回后草稿恢复”一步等待超时。
  - 运行 3：第 1–5 组通过；第 6 组 Settings 窗口报 `Object has been destroyed`。
  - 基线 b1ea922 的干净副本：第 1 组就报 `discover-query` 等待超时。
  - 用同样步骤单独重复第 17 组：本分支 3/3 通过，基线 3/3 通过，最终代码上再跑 1/1 通过。
  - 结论：失败的第 17 组步骤单独复现时通过，但完整门禁未通过。失败点每次不同、基线也失败，这与环境或时序问题一致，但只是假设：根因未知，不能宣布已排除回归。崩溃根因未调查，相关既有记录见 `docs/audits/2026-10-27-native-smoke-hang/NOTES.md`。
  - 候选三次的原始日志已保存到 [evidence/smoke-logs/](evidence/smoke-logs/)（`candidate-run-1.log` 至 `candidate-run-3.log`）。这些都是固定数据运行；保存时把临时目录和用户主目录替换为 `$TMPDIR` 和 `~`，检查后未发现密钥、令牌或日用数据。
  - 基线运行的原始日志已不存在：第 1 轮清理临时文件时，它随基线副本 `$TMPDIR/therss-baseline-b1ea922/` 一起被删除。基线结果只剩第 1 轮会话中记录的摘要（第 1 组 `discover-query` 等待超时）。
- 未运行：
  - 真实鼠标或物理输入。范围控件由 fixture 动作驱动；单击打开的基线由 Manager 用坐标点击确认过。
  - VoiceOver 朗读。
  - Web 备用路由的新截图（只有组件测试和 E2E）。
  - 安装包或安装、真实检索、模型、真实 vault。
  - `npm audit`（未改依赖）。

## 独立审查（自审）

- 产品契约：只实现获批范围；PRODUCT.md 已同步。
- 安全与输入：scope 在 IPC 边界由 Zod 校验；SQL 仍全部参数化，LIMIT 也作为参数传入；没有新的网络或文件访问。
- 测试：未弱化断言。两处既有断言因契约变化而修改，已记录理由，并都加强了覆盖。
- 回退：还原上述文件即可；无迁移、无持久数据变化。
- 尚未做独立 reviewer 的差异评审（流程第 7 步）。建议提交前由 Manager 或独立审查者完成。

## UI 检查发现（只报告，未实现）

依据：本次原生 smoke 的新鲜截图 `test-results/appkit-native-2026-11-12/`，以及上述渲染证据。

| ID  | 界面                      | 证据与影响                                                                                                                                 | 优先级 | 最小建议                                                                            | 是否值得做       |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ----------------------------------------------------------------------------------- | ---------------- |
| U2  | Settings → Model Provider | `settings-provider.png`：Clear credential（删除凭据）与普通按钮同样式，夹在连接测试和 Local agents 之间；Local agents 用了大标题，层级偏重 | P2     | 把 Clear credential 移到 API key 旁，用 destructive 样式；Local agents 改为小节标题 | 值得，需单独契约 |
| U3  | Saved                     | `saved-repository.png`：没有可用更新时，禁用的 “Update saved snapshot” 和说明仍占顶部；“Source details” 与正文左缘略不对齐                 | P3     | 无更新时只保留一行次要说明；对齐 Source details                                     | 可做，价值中低   |
| U4  | 本地搜索                  | 范围内无结果时，“0 results for …” 与空状态标题重复                                                                                         | P3     | 0 条时隐藏计数行                                                                    | 可做，价值低     |
| U5  | Daily Papers              | 空状态时，状态行（如 “Announcement batch unavailable to the scan · 0 selected”）与空状态标题重复同一短语                                   | P3     | 保持现状：状态行承载日期和计数，空状态解释原因                                      | 暂不做           |
| U6  | Discover                  | Daily Papers 入口位于 composer 右下角，与 Search 不在同一行                                                                                | P3     | 先观察使用                                                                          | 暂不做           |

Sources 列表在窄窗口下未发现阻断问题。

U1 已撤回：`src/main/appkit/discover.ts:452` 的 Search 已设置 `emphasis: 'primary'`。截图里按钮呈灰色，是因为窗口处于非激活状态，不是缺陷，因此不做代码修改。

## 第 2 轮收尾（相对第 1 轮的变更）

- `PRODUCT.md`：本地搜索“单击或 Return 在 TheRSS 内打开”限定为原生路径，并写明 Web 备用路由打开原始链接。
- 本报告：
  - 撤回 U1。
  - 把 53/53 改述为原生专项检查记录（含截图捕获）。
  - 把完整 smoke 的结论改为：专项通过，完整门禁未通过，环境或时序只是假设。
- `evidence/smoke-logs/`：候选三次的原始日志。
- 新增临时验证 helper，仅放在任务目录，未改产品源码：
  - `scripts/intercept-open-external.cjs`：用 `electron -r` 预加载，在应用主模块运行前替换 `shell.openExternal`、`openPath` 和 `showItemInFolder`，每次调用记录为一行 JSON。
  - `scripts/open-verification-app.mjs`：新建合成 profile 和 vault，用当前 build 启动并保持运行的应用。
- 实际命令：
  - `npx prettier --write PRODUCT.md docs/audits/2026-11-12-interaction-implementation`
  - `npx eslint docs/audits/2026-11-12-interaction-implementation/scripts`
  - `npm run format:check`、`npm run lint`、`npm run check:architecture`
  - `node docs/audits/2026-11-12-interaction-implementation/scripts/open-verification-app.mjs no-source`
- 本轮未重跑单元测试、`npm run check`、E2E 或完整 smoke。本轮只改了文档和任务目录内的临时 helper，产品源码未变。

## 保持打开的隔离验证应用

- 用途：供 Manager 用物理鼠标和键盘复核。它不是已安装的 TheRSS Dev.app，也不使用日用数据库。
- 启动命令（项目根目录）：`node docs/audits/2026-11-12-interaction-implementation/scripts/open-verification-app.mjs [no-source|completed-empty|partial|missing|unavailable]`。
  每次运行都新建 profile 和 vault。
- 本次实例：
  - Electron.app：`/Users/dtjgp/orca/workspaces/TheRSS/Engineer/node_modules/electron/dist/Electron.app`
  - PID：97329，进程名 Electron，窗口标题 TheRSS。
  - 运行的 build：本工作区 `out/`，由最终代码构建。
  - profile：`/var/folders/d9/50r202r14gbc_shcxg960xrh0000gn/T/therss-cua-profile-swNLHW`
    - 数据库在其中的 `therss.sqlite`；启动摘要在其中的 `verification-app.json`。
  - vault：`/var/folders/d9/50r202r14gbc_shcxg960xrh0000gn/T/therss-cua-vault-EhlDJt`
  - 外部打开拦截记录：profile 下的 `intercepted-open-external.jsonl`。
  - 应用标准输出和错误：profile 下的 `app-stdio.log`。
- 数据（只读核对）：
  - Saved 5 条（较旧）；Discover 会话 1 个，含 33 条结果（3 条固定数据结果和 30 条 Synthetic 结果）；分析 30 条（较新）。
  - Daily digest 为当天的 `no-source`。替换 vault 中的 digest 文件后按 Refresh，可切换到其他状态。
- 运行方式：
  - 主服务不在固定数据模式：范围 SQL 是真实查询，Daily 读取器是真实的只读读取器（读合成 vault）。
  - 原生 host 不带 fixture 标志，因此物理输入路径与正常应用一致。
  - 拦截 helper 已加载（记录首行为 `helper-loaded`），目前没有拦截到任何外部打开。
- 初始状态：
  - 应用打开后在 Discover，恢复了上面的合成会话。窗口位置 (80, 92)，尺寸 1360×848，由 System Events 只读读取。
  - 没有预先输入 pruning：原生 host 不带 fixture 标志时，脚本无法操作控件；为保证物理输入的真实性，我选择不带该标志。
  - 复核步骤：按 Command-F，输入 `pruning`，All 应列出 50 条且不含 Saved，并显示截断说明；切换到 Saved 应列出 5 条较旧的 Saved 记录。
  - 本轮没有为初始界面截图核对。
- 关闭：Command-Q 或 `kill 97329`。完成后删除上述 profile 和 vault 目录。
