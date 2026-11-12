# 我的信息源（My sources）实施报告

日期：2026-11-12，Europe/Rome。基线：`b1ea922`，加上用户已批准、尚未提交的 I2/I1/I4 改动
（清单与哈希见 [BASELINE_STATUS.txt](BASELINE_STATUS.txt)）。契约：[CHANGE_CONTRACT.md](CHANGE_CONTRACT.md)。

状态：见下方“当前结论”（审查第 2 轮修复后，2026-11-12）。之后的章节按阶段保留历史记录；其中的数字只代表当时的代码，不是当前结论。

## 当前结论（继续切片：后台关闭保护，最新）

这是唯一的当前结论。范围依据 Manager 的 `CONTINUATION_CONTRACT.md`。未安装、未提交、未推送、未发布，未调用真实来源、模型或 vault，没有打开或改动 Manager 的 profile `CEmo14`。

### 本切片变更

- **R4 方案甲**：应用失去前台时，原生 Discover 来源弹出框按 Cancel 关闭，丢弃未应用的勾选；研究问题、runner、已应用的本次来源和 SQLite 默认都不变，回到前台也不会自动重开。
  - 在 `native/appkit/popover.mm` 中，弹出框显示时注册 `NSApplicationDidResignActiveNotification` 观察者，并在 close、did-close 和 dealloc 时移除，因此不会留下悬空观察者，也不会误关重新打开的弹出框。
  - 后台关闭只发送普通 `close`，不跳过锚点抑制、不发 `cancel`，也不抢回前台。
- **测试设施**：`native/appkit/bridge.mm` 新增 fixture 动作 `app-resign-active`，只在 fixture 宿主内发出应用自己的通知，不激活其他应用、不发系统级输入。
- **验证**：
  - 新增 `scripts/popover-background-check.mjs`。
  - 原生 smoke 第 2 组新增后台关闭断言（`scripts/smoke-native-appkit.mjs`）。
- **真实输入脚本已停用**：`popover-keyboard-check.mjs` 需显式设置 `THERSS_ALLOW_REAL_INPUT=1` 才会运行，不得无人值守运行，也不接入任何门禁。
- 上一轮真实键盘检查没有单独的原始日志，只有报告中的记录；本轮未补造历史输出。

### RED/GREEN

| 检查                                                  | RED（实际）                                             | GREEN                                                 |
| ----------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------- |
| `popover-background-check.mjs`（fixture，进程内通知） | 3/7：通知后弹出框仍打开，“它不会自行重开”和后续步骤失败 | 12/12；补充“重新打开后再次失去前台也会关闭”后为 13/13 |

GREEN 覆盖的内容：

- 后台关闭后，已应用的 21/22 不变；
- 研究问题不变；
- 没有弹出框时再收到通知无影响；
- 重新打开显示已应用的组合；
- 重新打开的弹出框不会被旧观察者关闭；
- 前台查找、Cancel、外部点击关闭、Apply 照常可用；
- SQLite 默认未被写入（origin 仍为 `all-sources`，22 项）。

Escape 的焦点回归由上一轮单元测试覆盖，本轮仍通过。

### 门禁（最终代码）

| 门禁                        | 结果                                                                                                      |
| --------------------------- | --------------------------------------------------------------------------------------------------------- |
| `npm run check`             | exit 0。主套件 142 个文件 / 952 个测试；AppKit 套件 40 个文件 / 228 个测试；覆盖率与上一轮相同，均达标    |
| 完整 E2E（运行 1 次）       | exit 0，9/9。日志：[evidence/r3-e2e-run.log](evidence/r3-e2e-run.log)                                     |
| 完整原生 smoke（运行 1 次） | exit 0，17/17。日志：[evidence/r3-native-smoke-run.log](evidence/r3-native-smoke-run.log)                 |
| 后台关闭检查（最终 build）  | exit 0，13/13。日志：[evidence/r3-popover-background-check.log](evidence/r3-popover-background-check.log) |

### 侧栏 E2E 定位（仍未关闭）

- **代码层面**：`App.tsx` 的侧栏代码本任务未改。224/288 的失败值等于拖拽起始宽度，与 `cancelSidebarResize`（pointercancel）恢复起点的行为一致；304/296 恰好多一次 8px 键盘步进。
- **带记录的单独运行**：临时诊断副本（已删除）运行 5 次，全部通过。每次只有 1 次可信的 `ArrowRight`，没有窗口失焦或 pointercancel。摘要：[evidence/r3-sidebar-diagnostic-summary.json](evidence/r3-sidebar-diagnostic-summary.json)。
  - 局限：页面 reload 会清掉 reload 之前（拖拽阶段）的渲染层记录。
- **结论**：失败只出现在完整 E2E 序列中，本任务累计 2/5 次完整运行失败，本次通过。外部焦点或输入是可能的机制，但没有直接证据，因此不作归因，也不改测试或断言。

### 剩余手工验证

- R4 跨应用的真实输入验收没有执行：失去前台后关闭、回来不自动打开、打字进入研究问题。需由 Manager 在条件允许时用其工具执行。
- 未做 VoiceOver 实测。

## 审查第 2 轮修复阶段的结论（历史，已被“当前结论”取代）

本节记录第 2 轮修复时的结果，已被上方“当前结论”取代。

| 门禁                                            | 结果                                                                                                                                                                                           |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                                 | exit 0。主套件 142 个文件 / 952 个测试；覆盖率：语句 92.02%、分支 83.73%、函数 95.37%、行 94.56%。AppKit 套件 40 个文件 / 228 个测试；覆盖率：语句 90.31%、分支 85.07%、函数 87.72%、行 92.59% |
| 完整 E2E（运行 1 次）                           | **exit 1，8/9**：`sidebar-resize.spec.ts:74` 隐藏再显示侧栏后宽度为 304px，期望 296px。日志：[evidence/r2-e2e-run.log](evidence/r2-e2e-run.log)。                                              |
| 完整原生 smoke（运行 1 次，加入焦点前提检查后） | exit 0，17/17 组。日志：[evidence/r2-native-smoke-run.log](evidence/r2-native-smoke-run.log)                                                                                                   |
| 原生专项 `my-sources-render.mjs`                | exit 0：16 条断言全部通过，另有 9 次截图                                                                                                                                                       |
| 真实键盘检查 `popover-keyboard-check.mjs`       | 不完全通过，见 R4                                                                                                                                                                              |

关于 E2E 失败：

- 侧栏代码（`App.tsx`）在本任务中未改动。
- 该 spec 单独运行 3 次均通过（[evidence/r2-e2e-sidebar-investigation-1..3.log](evidence/)）；本任务的 4 次完整 E2E 中有 2 次在该 spec 的不同步骤失败（拖拽 224/288，以及这次的 304/296）。
- 原因未查明，不作环境归因，也不把单项通过当作全套通过。当前完整 E2E 门禁未通过。

### 第 2 轮修复

- **R3 菜单与本地搜索绕过**
  - `NativeModals.openDocument` 和 `canOpenSearch` 增加对 busy sheet 的保护：帮助、本地搜索、导航或另一个 sheet 都不能替换或隐藏正在保存的 My sources sheet。
  - 用可控的待完成保存测试覆盖成功和失败两种结果；失败后 sheet 恢复为普通 sheet，帮助可以正常替换它。
  - 测试：`src/main/appkit/mySources.saving.test.ts` 第 3 例，先 RED（保存中帮助替换了 sheet）后 GREEN。
- **R1 运行标记归属**
  - Web 会话改为保存当前 run 的 ID，并可订阅：`startRun` 在已有 run 时拒绝新的 run；`finishRun` 只由该 run 的所有者清除。
  - `DiscoverView` 用会话中的 run 判断是否在搜索：页面重建后，Search 按钮仍为 “Searching…” 且禁用，不能再次启动；重建后的视图沿用该 run 的 ID（进度和取消），run 结束后重新读取最近会话。
  - 测试：`App.discoverSession.test.tsx` 第 4 例（首个 run 未完成 + 页面往返 + 不能再次启动 + 保存默认）和 `discoverSession.test.ts` 第 3 例（拒绝第二个 run，且第二个 run 不能清除第一个），均先 RED 后 GREEN。
- **R4 Discover 弹出框的键盘输入（部分修复，仍未关闭）**
  - **复现方法**：新增 `scripts/popover-keyboard-check.mjs`，通过 System Events 发送真实鼠标点击和真实按键（不使用 fixture fill）。
  - **前台正常使用时**：弹出框打开后，真实输入只改变来源查找框，研究问题不变；Command-A 后输入只替换查找框内容。
  - **已修复：Escape 后焦点回到研究问题。**
    - 原生弹出框新增可选的 `cancel` 动作：Escape 关闭时发送 `cancel`，点击外部关闭时仍发送 `close`。
    - Discover 收到 `cancel` 时丢弃草稿，并把焦点交给来源按钮。
    - 真实 Escape 已验证：`firstResponderId=discover-source-picker`，来源保持 22/22。另有单元测试。
  - **未修复：应用切换后输入进入研究问题。** 弹出框打开时切到其他应用再切回（Command-Tab，或自动化工具每次激活应用时），弹出框仍打开，原生状态也报告其窗口为 key，但真实按键进入研究问题，两次运行结果一致。这与 Manager 的现象一致。
    - 证据（新增的只读诊断字段）：此时 `NSApp.keyWindow` 是 Electron 主窗口，当前文本输入上下文不在弹出框窗口（`inputInPopover=false`）。
    - 我尝试了 5 种原生恢复方法，都无效，已全部撤回，未留在代码中：激活后重设 key 窗口和 first responder、显式切换输入上下文、延迟执行、先让锚点窗口成为 key（会引起通知循环）、重新显示弹出框。
  - **测试安全问题**：真实按键注入是系统级的。本轮发现用户正在使用本机（前台曾是 WeChat，测试中途出现过用户的输入），因此我停止了真实按键实验。脚本现在每次按键前都会检查前台应用，否则中止，但只能在无人使用的桌面上运行。
  - **需要的决定**：
    - 方案甲：应用失去前台时关闭弹出框并丢弃草稿（改变原“切换应用保持弹出框”的设计）；
    - 方案乙：继续研究 AppKit 行为（需要独占桌面）。
    - 两者都需要在独占桌面上用真实输入验证。
- **完整 smoke 失败的定位与修正**
  - Zoom 菜单命令发往获得焦点的窗口；应用不在前台时没有获得焦点的窗口，命令会落到第一个窗口（`src/main/index.ts:583`）。这解释了 Settings 缩放只到 1.3。
  - 第 15 组的报错本身写明 `appActive=0`：按键在应用不活动时被 AppKit 丢弃。
  - 本轮观察到其他应用（WeChat、Chrome）在前台。
  - 修正：smoke 在 Zoom 菜单命令和按键前增加 `ensureFocused`，聚焦并确认目标窗口，失败时报“前提不满足”。产品断言未改。
  - 修正后完整运行 1 次：17/17。

### 第 2 轮文件变化

- 原生：
  - `native/appkit/popover.mm`：Escape 的 `cancel` 动作；只读诊断字段 `inputInPopover`、`appKeyIsPopover`。
  - `src/main/appkit/presentation.ts`：弹出框可选 `cancel`。
  - `src/main/appkit/discover.ts`：Escape 取消并把焦点交给来源按钮。
  - `src/main/appkit/modals.ts`：busy sheet 保护。
- Web：
  - `src/renderer/src/discoverSession.ts`：run 归属。
  - `src/renderer/src/DiscoverView.tsx`：使用共享 run。
- 测试：
  - `src/main/appkit/mySources.saving.test.ts`、`src/main/appkit/discoverSourceScope.test.ts`
  - `src/renderer/src/App.discoverSession.test.tsx`、`src/renderer/src/discoverSession.test.ts`
- 脚本：`scripts/smoke-native-appkit.mjs`（焦点前提检查）、`docs/audits/2026-11-12-my-sources/scripts/popover-keyboard-check.mjs`（新增）
- 证据：`docs/audits/2026-11-12-my-sources/evidence/r2-*.log`

Manager 的复核 profile（`therss-my-sources-review-CEmo14`）本轮未打开，也未改动。复核 helper 与上一轮相同，当前 build 已包含本轮代码。

### 当前剩余限制

- R4 的应用切换输入路由未修复，需要决定修复方案，并在独占桌面上用真实输入验证。
- 完整 E2E 当前 8/9（`sidebar-resize`，原因未查明）。
- 未做 VoiceOver 实测，物理鼠标和键盘复核由 Manager 负责。

## 首次实施：已实现的行为

- **共享偏好（SQLite）**
  - 新表 `discover_source_preference`（单行）保存默认来源、来源 origin 和时间。
  - 主进程用 Zod 校验保存请求：1–22 个当前来源。
  - 重复 ID 规则：整条请求无效，不写入，不静默去重。未知、非法类型和 0 项同样拒绝。
  - 读取时，不再受支持的旧 ID 列为 `unavailable`；未来新增来源不会自动加入。
  - Native 和 Web 通过同一 API（`getDiscoverSourcePreference` / `saveDiscoverSourcePreference`）读写。
    未使用 NativePreferences 或 localStorage。
- **首次启用**
  - 表缺失时（新库或升级），在迁移事务内初始化一次：取最近一个检索过来源的会话；没有则取全部 22 个。
  - 初始化不执行检索。此后会话不会再覆盖默认。
- **Sources：`My sources · N/22` 入口打开原生 sheet “Default search sources”**
  - 共享选择器：按名称、研究用途或分组查找；Only selected；Select shown / Clear shown 只作用于当前显示项；分组标题显示“已选/总数”；每项显示真实名称和目录中的用途。
  - 底部：已选数量；0 项时就近提示 “Select at least one source to save.”；Restore all（只改草稿）、Cancel、Save default sources。
  - Escape 和 Cancel 不保存，焦点回到入口。
  - 保存失败时保留草稿，可重试。保存成功后关闭 sheet 并提示，不启动检索。
  - 偏好读取失败时，入口显示 “not loaded” 和说明；再次点击会重读。
- **Discover**
  - 按钮为 `Sources for this search · N/22`，打开既有弹出框，内含同一选择器和独立草稿。
  - 提供 Use defaults（只改草稿）、Cancel、Apply to this search；关闭弹出框等同 Cancel。
  - 模式行显示 “Using your default sources” 或 “Custom for this search · default M/22”。
  - 旧结果的来源范围与下一次搜索不同时，提示 “These results searched X of 22 sources. The next search uses Y of 22 sources.”
- **状态规则**
  - 启动时，草稿取自默认来源。`load()` 和 `openLocal()` 打开的历史会话不再改写草稿。
  - 保存新默认时：若草稿等于旧默认且没有进行中的任务，草稿同步到新默认；否则保留草稿和任务，并提示可用 Use defaults。
  - 搜索完成后不跳回默认组合。
  - 历史重试仍只用该会话自己的失败、部分完成或已取消来源，以及原计划；不改草稿。
  - 偏好读取失败时：草稿为空，搜索被阻止，提供 Retry，不会静默全选。
  - 迟到的读取响应不覆盖已保存的值。
- **Web 备用路由**
  - `SourceChooser` 由 Discover（内联面板，含 Apply / Cancel / Use defaults / Escape）和 Sources 的 `My sources` 对话框共用。
  - 沿用原有的可访问名称：“Choose sources, N of 22 selected”、“Search sources”、“Search <名称>”。
- **未改动**：检索服务、Sources 的单独浏览和刷新、Daily Papers、Saved 及旧结果数据，以及上一轮 I2/I1/I4 的行为。

## 首次实施：渲染检查中发现并修复的问题

1. sheet 说明文字被截断为单行。原因是 `maxLines` 配合尾部截断在 AppKit 中只显示一行。本轮新增的标签改为正常换行。
2. 820×600 窗口下 sheet 的 Save/Cancel 被裁掉。选择器列表改为在 sheet 中占据剩余高度，底部按钮始终可见；弹出框中的列表高度从 330 改为 280。

两项都已重新渲染确认。

## 首次实施：RED/GREEN

| 切片                                          | RED（实际失败原因）                                                   | GREEN                                                   |
| --------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------- |
| 存储与迁移 `discoverSourcePreference.test.ts` | 4/4 失败：`no such table: discover_source_preference`，保存方法不存在 | 4/4；存储目录共 53/53                                   |
| 应用/IPC `windowApplication.contract.test.ts` | 1 失败：`getDiscoverSourcePreference is not a function`               | 8/8                                                     |
| Native Discover `discoverSourceScope.test.ts` | 9/9 失败（缺少按钮标题、模式行、Apply 等）                            | 9/9；openLocal 用例在实现后补写，未单独跑 RED，共 10/10 |
| Native My sources `mySources.test.ts`         | 5/5 失败：`screen.load is not a function`                             | 5/5                                                     |
| Native 窗口集成 `mySources.presenter.test.ts` | 实现后补写，未单独跑 RED                                              | 1/1                                                     |
| 共享选择逻辑 `sourceChoice.test.ts`           | 与实现同时编写，未单独跑 RED                                          | 2/2                                                     |
| Web `App.mySources.test.tsx`                  | 3/3 失败                                                              | 3/3                                                     |

服务层“未选来源不调用”“重试只跑原失败来源并复用计划”已有覆盖（`discoverService.test.ts:310`、`:240`），本功能未改动服务层。
原生专项检查还从 SQLite 读取实际会话来源，确认只请求了已应用的 3 个来源。

既有测试的修改都记录在契约的验收变更表中：

- 5 个原生测试和 2 个 Web 测试：因整组切换按钮移除、需要 Apply、默认优先于会话而改写。
- E2E 和原生 smoke 中的来源步骤：同上。
- 4 处测试桩：仅补充新的 API 方法。

## 迁移与回退证据

- 升级路径：测试先删除新表、写入较早会话，再重新迁移，结果由最近会话初始化（origin `latest-session`）。
  再迁移一次时，较新的会话不会覆盖已有默认。原生检查在真实应用中重复了这一过程：删表后启动，得到 3/22。
- 回退：新表是增量的（`CREATE TABLE IF NOT EXISTS`），旧版本会忽略它。还原本轮文件后，该表只是闲置，不影响其他表和数据。

## 首次实施阶段的门禁（历史记录，已被后续结果取代）

| 命令                                                                | 结果                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`（最终代码）                                         | exit 0。主套件 138 个文件 / 938 个测试；覆盖率：语句 92.02%、分支 83.73%、函数 95.37%、行 94.56%。AppKit 套件 39 个文件 / 224 个测试；覆盖率：语句 90.17%、分支 84.83%、函数 87.69%、行 92.57%。架构、格式、lint、类型检查、构建均通过。 |
| `npm run test:e2e` 第 1 次（原生 UI 修正之前）                      | exit 0，9/9                                                                                                                                                                                                                              |
| `npm run test:e2e` 第 2 次（最终代码）                              | **exit 1，8/9**：`sidebar-resize.spec.ts:63` 拖拽后期望 288，实际 224。原始日志：[evidence/e2e-final-run.log](evidence/e2e-final-run.log)                                                                                                |
| `npx playwright test e2e/sidebar-resize.spec.ts`（只重跑这一个）    | exit 0，1/1。日志：[evidence/e2e-sidebar-resize-rerun.log](evidence/e2e-sidebar-resize-rerun.log)。本轮未改侧边栏代码；失败原因未调查，不作确定归因。                                                                                    |
| `node scripts/smoke-native-appkit.mjs`（完整原生 smoke，运行 1 次） | exit 0，17/17 组。日志：[evidence/native-smoke-run.log](evidence/native-smoke-run.log)。上一轮的失败根因仍未知；一次通过不代表已稳定。                                                                                                   |
| 原生专项检查 `scripts/my-sources-render.mjs`                        | exit 0：16 条行为断言全部通过，另有 9 次截图捕获（两者分开计数，不是 25 个测试）。在最终代码上运行。记录：[evidence/my-sources-check.json](evidence/my-sources-check.json)                                                               |
| `npx eslint docs/audits/2026-11-12-my-sources/scripts/`             | 无错误                                                                                                                                                                                                                                   |
| `npm ci`                                                            | 上一轮已按锁文件安装；本轮没有新增依赖                                                                                                                                                                                                   |

## 截图（新鲜渲染，固定数据和临时 profile）

[evidence/screens/](evidence/screens/)，共 9 张：

- 宽窗口浅色：Discover 自定义组合、Sources 入口、sheet、0 项状态、默认变更后保留自定义草稿、重启后的范围说明。
- 窄窗口深色：Discover 弹出框、sheet、长中文来源名称查找。

完整的状态 JSON 在被 git 忽略的 `test-results/my-sources-2026-11-12/`。

已覆盖的焦点与键盘：

- 打开 sheet 时焦点在查找框（`firstResponderId`）。
- Escape 取消后焦点回到 `sources-my-sources`。
- 打开 Discover 弹出框时焦点在查找框（沿用原有行为）。

## Manager 验证 helper

`node docs/audits/2026-11-12-my-sources/scripts/open-my-sources-app.mjs [--fresh | --profile=<dir>]`（项目根目录，先 `npm run build`）。

- **默认场景**：先做一次固定数据检索（3 个来源），再删除偏好表以模拟升级，然后启动应用。首个默认来源应为 3/22。
- **`--fresh`**：全新 profile，默认 22/22。
- **服务**：规划和来源获取使用内置固定数据，点 Search 不联网、不调模型；偏好使用真实 SQLite。
- **外部打开拦截**：复用上一轮的 `intercept-open-external.cjs`，所有外部打开记入 profile 下的 `intercepted-open-external.jsonl`。
- **输出**：PID、Electron.app 路径、profile 和数据库路径。
- **可复核项**：保存、Cancel/Escape、临时组合、重启后的默认（Command-Q 后运行 helper 输出中的 `reopen` 命令，即 `--profile=<同一目录>`，不重新准备数据）、旧结果范围提示。
- **本轮自测**：启动后进程存活，拦截脚本已加载，SQLite 中为 `["arxiv","github","folo:302"]`、origin `latest-session`，窗口标题为 TheRSS。随后已关闭并删除该 profile，没有留下运行中的应用。

## 首次实施阶段的剩余限制（历史）

- 原生选择器的可访问名称沿用复选框标题，用途说明是独立标签，没有合并进朗读文本。未做 VoiceOver 实测。
- 未做物理鼠标或键盘复核，由 Manager 负责。
- 未做安装包测试、真实检索、模型调用或 vault 访问。未运行 `npm audit`（无依赖变化）。
- 完整 E2E 最后一次为 8/9（见上），完整原生 smoke 仅运行 1 次。

## 首次实施阶段相对初始工作区的文件变化

本轮首次改动：

- 新增产品源码：
  - `src/shared/discoverSourcePreference.ts`、`src/shared/sourceChoice.ts`
  - `src/core/storage/discoverSourcePreferenceStore.ts`
  - `src/main/appkit/{discoverSourceScope,sourceChooser,sourcePreferences,mySources}.ts`
  - `src/renderer/src/{SourceChooser,MySourcesDialog,DiscoverSourcesControl}.tsx`、`src/renderer/src/useDiscoverSources.ts`
- 删除：`src/main/appkit/discoverSources.ts`（被共享选择器取代）。
- 修改：
  - `src/core/storage/researchSchema.ts`、`src/shared/ipc.ts`、`src/main/windowApplicationRuntime.ts`
  - `src/main/appkit/{common,discover,modals,presenter,sources,testSupport}.ts`
  - `src/renderer/src/{DiscoverView,SourceCatalogView}.tsx`、`src/renderer/src/styles/sources.css`
- 测试：
  - 新增：`src/core/storage/discoverSourcePreference.test.ts`、`src/shared/sourceChoice.test.ts`、`src/main/appkit/{discoverSourceScope,mySources,mySources.presenter}.test.ts`、`src/renderer/src/App.mySources.test.tsx`
  - 修改：`src/main/appkit/{discover,discover.polish,discover.recovery,workflows}.test.ts`、`src/renderer/src/{App,SettingsView,SourceCatalogView}.test.tsx`、`src/renderer/src/App.testSupport.ts`
- 脚本：`e2e/desktop.spec.ts`、`scripts/smoke-native-appkit.mjs`
- 任务目录：`docs/audits/2026-11-12-my-sources/`（契约、报告、基线、脚本、证据）

上一轮已改、本轮再次修改的文件（上一轮内容均保留，只追加本功能相关部分）：

- `PRODUCT.md`
- `src/shared/api.ts`、`src/preload/index.ts`
- `src/main/windowApplication.ts`、`src/main/windowApplication.contract.test.ts`、`src/main/appkit/presenter.test.ts`
- `src/core/storage/researchRepository.ts`
- `src/renderer/src/styles/discover.css`

上一轮其余 36 个文件本轮未改动，哈希与基线一致。

## 审查第 1 轮修复（R1–R3，历史阶段）

审查记录：Manager 工作区 `docs/audits/2026-11-12-my-sources-proposal/IMPLEMENTATION_REVIEW.md`。
上文“剩余限制”中原有的两条 Web 例外（切页后草稿重置、对话框无 Tab 约束）未获批准，已删除并修复。

### 修复内容

- **R1 Web 切页保持**
  - 新增 `src/renderer/src/discoverSession.ts`：每个渲染进程（按 API bridge）一个会话，保存未提交的问题和 runner、本次来源、运行中标记和默认变更提示。
  - 会话跨页面保留，重启结束；不写入偏好。默认来源仍只存在 SQLite，并经主进程读写。
  - `useDiscoverSources` 改为订阅该会话（`useSyncExternalStore`）。`DiscoverView` 从会话恢复问题和 runner，搜索与重试期间标记运行中。
  - `MySourcesEntry` 通过同一会话保存默认，因此 Web 端也执行与原生相同的同步规则：
    - 本次来源未自定义且没有进行中的任务时，跟随新默认；
    - 已自定义或有进行中的任务时，保持本次来源并提示。
  - 迟到的读取不覆盖已保存的默认，旧会话不改写草稿。
- **R2 Web 焦点约束**
  - 把 `LocalSearchPanel` 已有的焦点循环抽成 `src/renderer/src/focusTrap.ts`，两处共用。
  - My sources 对话框中 Tab / Shift+Tab 首尾回环，不会进入背景。
  - 保存中所有控件禁用（包括查找框和 Only selected），焦点停在对话框本身，Escape 无效。
  - 保存成功、Cancel 或 Escape 后，焦点回到入口按钮。
- **R3 原生保存中的关闭约束**
  - `NativeSheet` 增加可选的 `busy`；sheet 处于 busy 时，`NativeModals.blocksNavigation` 为真，Escape、导航和打开其他 sheet 都不能结束它。
  - `MySourcesSheet` 只在保存期间 busy。成功后先解除 busy，再关闭 sheet 并提示；失败后解除 busy，保留草稿，Cancel 和 Escape 恢复可用。
  - promotion 的原有保护不变，普通只读文档 sheet 不受影响（既有测试通过）。

### RED/GREEN

| 项                                                                                    | RED（实际失败原因）                                                                            | GREEN                              |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------- |
| R3 `src/main/appkit/mySources.saving.test.ts`（可控的待完成保存，成功和失败各一例）   | 2/2 失败：保存中 Escape 后 modal 已关闭（`expected undefined to be 'Default search sources'`） | 2/2；AppKit 226/226                |
| R2 `src/renderer/src/MySourcesDialog.focus.test.tsx`                                  | 2/3 失败：焦点循环和保存中焦点保持的断言不成立                                                 | 3/3；LocalSearchPanel 回归共 13/13 |
| R1 `src/renderer/src/App.discoverSession.test.tsx`（真实导航往返）                    | 3/3 失败：问题丢失，新默认未同步（找不到 `1 of 22`），缺少提示                                 | 3/3                                |
| R1 `src/renderer/src/discoverSession.test.ts`（迟到读取、读取失败、运行中、保存失败） | 与实现同时编写，未单独跑 RED                                                                   | 2/2                                |

关于“进行中的任务”这一例：第一次 RED 失败的直接原因是测试前置条件缺失（默认测试 API 没有旧会话，问题为空，Search 按钮被禁用）。
补上输入问题后，在新代码上通过；在旧代码上未重跑。我推断它会因缺少提示而失败，但这是推断，没有执行验证。

### 第 1 轮修复阶段的门禁（历史记录，已被“当前结论”取代）

| 命令                                    | 结果                                                                                                                                                                                                                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run check`                         | exit 0。主套件 142 个文件 / 948 个测试；覆盖率：语句 92.02%、分支 83.73%、函数 95.37%、行 94.56%。AppKit 套件 40 个文件 / 226 个测试；覆盖率：语句 90.18%、分支 84.85%、函数 87.70%、行 92.58%                                                                           |
| `npm run test:e2e`（完整运行 1 次）     | exit 0，9/9（包括 sidebar-resize）。日志：[evidence/r1-e2e-run.log](evidence/r1-e2e-run.log)                                                                                                                                                                             |
| 原生专项 `my-sources-render.mjs`        | exit 0：16/16 条断言，9/9 次截图（输出在 `test-results/my-sources-r1/`）                                                                                                                                                                                                 |
| 完整原生 smoke 第 1 次                  | **exit 1**：第 1–5 组通过；第 6 组（Settings 窗口）断言 “Zoom In reaches zoom 1.5” 失败，实际 1.3。日志：[evidence/r1-native-smoke-run-1.log](evidence/r1-native-smoke-run-1.log)                                                                                        |
| 完整原生 smoke 第 2 次（有界重跑 1 次） | **exit 1**：第 1–14 组通过，包括上一次失败的第 6 组和 promotion 关闭保护组；第 15 组报 “Fixture button window is not the key window; AppKit drops the key press (visible=1 appActive=0)”。日志：[evidence/r1-native-smoke-run-2.log](evidence/r1-native-smoke-run-2.log) |

完整原生 smoke 本轮没有通过，第 15–17 组本轮也没有执行完成。

- **代码层面的证据**：Settings 的缩放路径（`settingsPresenter.zoom`、运行时命令路由）本轮未修改；Settings 窗口不会打开 sheet，因此不受 `busy` 约束影响。第 15–17 组（Saved 快照更新、Sources 记录、Daily Papers）不涉及 sheet 关闭。
- **观察到的现象**：第二次失败时记录到 `appActive=0`。
- **结论**：以上不足以排除回归，也不归因为环境；根因待查。

### 本轮（审查修复）文件变化

- 新增：
  - `src/renderer/src/discoverSession.ts`、`src/renderer/src/focusTrap.ts`
  - 测试：`src/renderer/src/discoverSession.test.ts`、`src/renderer/src/App.discoverSession.test.tsx`、`src/renderer/src/MySourcesDialog.focus.test.tsx`、`src/main/appkit/mySources.saving.test.ts`
- 修改：
  - 原生：`src/main/appkit/{common,modals,mySources}.ts`
  - Web：`src/renderer/src/{DiscoverView,DiscoverSourcesControl,MySourcesDialog,SourceChooser,LocalSearchPanel}.tsx`、`src/renderer/src/useDiscoverSources.ts`
  - 文档：`docs/audits/2026-11-12-my-sources/{CHANGE_CONTRACT,REPORT}.md`
- 证据：`docs/audits/2026-11-12-my-sources/evidence/r1-*.log`

### Manager 复核

`node docs/audits/2026-11-12-my-sources/scripts/open-my-sources-app.mjs [--fresh | --profile=<dir>]` 可在当前 build（`out/`，最终代码，构建于 18:06）上启动隔离应用。
本轮已用 `--fresh` 自测：可以启动，拦截脚本已加载；测完已关闭并删除 profile。物理鼠标和键盘复核留给 Manager。

### 第 1 轮修复阶段的剩余限制（历史）

- 完整原生 smoke 未通过（见上）。
- 未做 VoiceOver 实测，未做物理输入复核。
- Web 端在切到其他页面期间，进行中的检索不显示进度；回到 Discover 时显示最近一次会话（既有行为）。本次来源和提示规则由会话保证。
