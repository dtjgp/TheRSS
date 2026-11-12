# 侧栏间歇失败：受控诊断报告

## 当前结论（审查第 1–2 轮收尾，最新）

这里是唯一的当前结论。下面的“历史”各节只记录当时的状态，凡与本节冲突的，以本节为准。

1. **失败诊断：已完成。** 第 1 轮审查（`REVIEW.md`）提出 3 项，都已关闭，并用受控失败探针验证。第 2 轮增量审查指出 reporter 的一个缺口，也已关闭，见下文“第 2 轮”。第 1 轮的 3 项是：
   - 失败时的 trace 会被自动归档；
   - 提前 `dispose` 时，会取消尚未完成的观察器初始化；
   - 渲染层的源时间与 Node 接收时间分开记录，代码身份按文件内容哈希。
2. **历史根因：仍未知。** 本阶段没有出现新的侧栏失败。224/288 与 304/296 的触发源都没有观察到。H-A 只在“同一应用内窗口失焦”这一表述下被证伪；应用失活的情况没有测试。H-B1 只证明了机制，没有找到来源。
3. **临时目录：未删除。** 批量清理曾被权限策略拒绝。本阶段没有再尝试删除，也没有换命令绕过。只读清单、归属判据和原拒绝文本见 [TEMP_DIRS.md](TEMP_DIRS.md)。
4. **VoiceOver：用户已取消并要求回撤专项。** 对应 worker 任务已确认停止；新增的 V1 验证 harness 已移除，未有 VoiceOver 专项产品源码改动需要回退。临时系统开关已确认关闭；不再进行验收或列为待办。侧栏诊断保留。

没有修改 `src/`、`native/` 下的产品代码。原测试的断言、期望、容差、重试和执行顺序都没有改动。没有提交、推送、安装或发布，也没有新增依赖或修改 CI。

### 审查项与改动

| 审查项                      | 改动                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. trace 自动保留           | 新增 `e2e/support/sidebarTraceArchiveReporter.ts`，注册到 `playwright.config.ts`（保留 list 和 html）和探针配置。它在 `onTestEnd` 中运行，此时 Playwright 已经写完 trace。它只处理带 `sidebar-diagnostics` 附件的结果，从附件读取 `correlationId` 和目录，把 `trace` 附件按实际路径复制到同一目录的 `trace.zip`（`COPYFILE_EXCL`，不覆盖），然后写 `trace-archive.json`（`wx`）。状态文件记录关联 ID、`recordMatches`、`state`（`copied`、`no-trace-attachment`、`source-missing`、`failed`）、源路径和归档路径（相对路径）、字节数和两端的 SHA-256。所有步骤都同步执行并捕获异常，不会改变测试结果。每次失败一个目录：`test-results/sidebar-diagnostics/<时间>-<关联 ID 前 8 位>/`，内含 `diagnostics.json`、`trace.zip`、`trace-archive.json`。 |
| 2. 取消未完成的观察器初始化 | `RENDERER_RECORDER` 增加 `stopped` 标记并保存 50 ms 重试定时器。停止时先设标记、`clearTimeout`，`observe` 和 `send` 都先检查标记。`dispose` 还会移除 init script 和 binding（Playwright 1.64 返回 `Disposable`），所以 dispose 后 reload 不会重新安装记录器。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 3. 时间与代码身份           | 每条渲染层事件带 `sourceClock`（`event.timeStamp` 或无事件时的 `performance.now`）、`sourceTimeStamp`、`sourceTimeOrigin`（该文档的 `performance.timeOrigin`，reload 后会变），Node 端加上 `sourceEpochMs` 和接收时间 `t`。记录中的 `clocks` 字段说明各时间字段的含义。`code.files` 列出 `App.tsx`、`AppTopbar.tsx`、`styles.css`、spec、诊断模块、归档 reporter、`playwright.config.ts`、`package-lock.json` 的 SHA-256、字节数和 git 状态（只有哈希，不含内容）。错误堆栈中的工作目录和主目录分别替换为 `.` 和 `~`。                                                                                                                                                                                                                            |

`e2e/sidebar-resize.spec.ts` 本阶段没有改动。

### 受控失败探针（故意失败不计入产品失败）

命令：`npx playwright test -c e2e/probes/playwright.probe.config.ts`。证据在 `evidence/probe-closeout/`。

- **RED**（`red-early-dispose.log`）：临时去掉停止标记和定时器清理，只运行新用例，exit 1。dispose 之后手柄晚到，仍然收到了 `["resizer-initial", "attribute"]`。运行后已恢复修复，并用 `cmp` 确认与修复版本一致。
- **GREEN，连续 3 次**（`probe-run-{1,2,3}.log`）：每次 exit 1，只有故意失败的用例 ✘；dispose 用例 ✓；提前 dispose 用例 ✓。
  - 提前 dispose：timeline 中没有 `resizer-initial`；手柄晚到并按 ArrowRight 后，产品写入了新宽度，但页面内没有收到任何记录（`[]`），Node 端事件数不变，`setItem` 仍为原生实现。
  - dispose：reload 之后不再安装记录器。
- **归档核对**（`harness/verify-trace-archive.mjs`，只读；`verify-after-run-{1,2,3}.json`，每次 exit 0）。3 个目录都满足以下各项：
  - 记录与状态文件的关联 ID 一致，目录名后缀与 ID 一致；
  - `state: copied`，归档文件与源 trace 的 SHA-256 相同；
  - `unzip -l` 可以读取（`records/*/trace-listing.txt`）；
  - 渲染层 12 条事件全部带源时间，来自 2 个文档（reload 前后）；
  - 8 个代码文件都有哈希。
- **不被清空、不被覆盖**：第 2、3 次运行之后，第 1 次的 3 个文件和第 2 次的文件哈希都没有变化，缺失或改动为 0（`hashes-after-run-{1,2,3}.txt`）。
- **路径**：第 3 次的记录不含绝对路径。第 1、2 次的记录写于路径修正之前，错误堆栈中仍有绝对路径（`pathsSanitized: false`）。这一项单独报告，不计入归档是否通过；`evidence/` 中的副本都已脱敏。
- **归档出错不影响结果**（`reporter-error-paths.*`）：直接调用 reporter，输入为无效 JSON、目录越界、记录缺失、源 trace 缺失、状态文件已存在，都不抛出异常。缺失的情况会写出 `failed` 或 `source-missing` 状态，已存在的状态文件不被覆盖。
- **局限**：trace 中只有测试运行器的步骤（27 个调用）、错误、失败截图、诊断附件和源码，没有 DOM 快照。原因是 `_electron` 启动的应用上下文不受测试运行器的 tracing 控制。本阶段没有为此改动 spec。

### 第 2 轮：拒绝关联 ID 不一致的记录

- **缺口：** 旧 reporter 算出 `recordMatches` 为 false 后仍继续复制。它会把 `trace.zip` 和 `trace-archive.json` 写进别的测试的记录目录，而 `trace-archive.json` 带着错误的 ID。这两个文件都是“不覆盖”写入，所以之后 ID 正确的结果也无法再归档到这个目录。
- **修复：** `e2e/support/sidebarTraceArchiveReporter.ts` 在目标目录中的 `diagnostics.json` 的 `correlationId` 与附件不一致时直接返回。它不向该目录写 trace，也不写状态文件，只向 stderr 输出一行 `sidebar trace archive: rejected <ID 前 8 位>: record ID differs`。结果对象和退出码不受影响。spec 和产品代码都没有改动。
- **回归：** 新增 `e2e/probes/sidebarTraceArchiveReporter.probe.ts`，只在 Node 中运行，不启动 Electron、浏览器或 GUI。运行命令：`npx playwright test -c e2e/probes/playwright.probe.config.ts sidebarTraceArchiveReporter.probe.ts`，可以只选这一个文件。用例的临时目录位于 `test-results/sidebar-trace-reporter-regression/<uuid>/`，结束时由测试自己删除。
  1. 直接调用：先给 ID 不一致的结果，目录中仍只有 `diagnostics.json`，内容不变，结果对象不变；再给 ID 正确的结果，正常归档：`state: copied`、`recordMatches: true`，哈希与源 trace 一致。
  2. 真实运行：嵌套运行一次 Playwright，内含 3 个只用 Node 的用例：ID 不一致、ID 正确、通过。另用一个不注册归档 reporter 的配置作对照。两边的结果都是 `failed, failed, passed`，退出码都是 1。归档的 trace 与 ID 正确那个用例自己的 trace 哈希一致。stderr 中有拒绝行。
- **RED：** 换回旧 reporter 后 exit 1，两个用例都失败。用例 1 中，错误目录多了 `trace-archive.json` 和 `trace.zip`。用例 2 中，状态文件写的是 `wrong-id`，`recordMatches: false`。换回修复版后用 `cmp` 确认一致。
- **GREEN：** 连续 2 次，exit 0，2/2 通过。
- **证据：** `evidence/reporter-r2/`。`test-results/sidebar-diagnostics/` 中已有 3 个归档，9 个文件的哈希在本轮前后相同。只读 `verify-trace-archive.mjs` exit 0。
- **本轮门禁：** `format:check`、`lint`、`typecheck`、`check:architecture` 都是 exit 0。按 Manager 的要求，桌面正在用于 VoiceOver 认证，所以本轮没有运行 `npm run check`（其中包含构建和单元套件）、完整 E2E、smoke 或任何 Electron 探针。这些 GUI 和完整门禁留到 VoiceOver 结束后再评估。下表是第 1 轮的结果，不涵盖本轮改动。
- **桌面状态：** 本轮检查时有 1 个 Electron 进程在运行，启动于 20:49:21，使用 `therss-my-sources-review-*` profile。本 worker 没有启动它，也没有触碰它。

### 门禁（第 1 轮）

| 命令                                                                         | 结果                                                                                                                      |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`（架构、格式、lint、类型检查、主套件、AppKit 套件、构建）     | exit 0。主套件 142 个文件 / 952 个测试，AppKit 套件 40 个文件 / 228 个测试（`evidence/probe-closeout/npm-run-check.log`） |
| 写入证据后再次运行 `format:check`、`lint`、`typecheck`、`check:architecture` | 都是 exit 0（第一次 `format:check` 发现 4 个证据文件格式不对，用 Prettier 只调整了格式）                                  |
| `npm run test:e2e`（真实完整 E2E，1 次）                                     | exit 0，9/9。侧栏用例通过，没有写出新的诊断目录（`evidence/probe-closeout/e2e-full.log`）                                 |
| 完整原生 smoke                                                               | 没有运行（没有原生改动，不在本阶段范围内）                                                                                |

### 剩余事项

- 历史根因：等下一次侧栏自然失败，用自动写出的记录和 trace 区分 H-A（应用失活）、H-B1（多一次按键）或其他原因。
- `test-results/sidebar-diagnostics/` 中现在有 3 个探针目录，用作归档证据，没有删除。以后出现的目录都要按 `diagnostics.json` 中的 `test.title` 区分：探针目录的标题是 “sidebar diagnostics record a controlled failure across a reload”。
- 临时目录要由用户或 Manager 决定是否删除，见 [TEMP_DIRS.md](TEMP_DIRS.md)。

## 失败诊断接入阶段（历史，已被上方结论取代）

本节当时的说法有两处已被上方结论取代：一是 trace 需要人工归档，二是诊断文件采用扁平文件名。

当时的结论：

1. **失败诊断接入：已完成。** 真实的 `e2e/sidebar-resize.spec.ts` 现在默认在有限内存中记录事件，**只在失败时**写出 JSON：一份作为 Playwright 附件，另一份保存在 `test-results/sidebar-diagnostics/`（Playwright 的 `outputDir` 是 `test-results/compatibility`，每次运行只清空后者，前者不受影响，且已被 git 忽略）。
2. **历史根因：仍未证实。** 本阶段没有出现新的侧栏失败，224/288 与 304/296 的触发源仍未观察到。下文受控诊断阶段的事实保留：页面 reload 丢失了诊断记录；H-A 仅以“同一应用内窗口失焦”的表述被证伪，应用失活的情况未测试。

未修改 `src/`、`native/` 产品代码，原测试的断言、期望、容差、重试和执行顺序都没有变：断言行和产品操作行与改动前逐行一致，只增加了阶段标记、记录器启动、`catch` 中的失败写出和 `finally` 中的清理。未提交、推送、安装或发布。

#### 改动文件

- `e2e/support/sidebarDiagnostics.ts`（新增）：
  - 渲染层经 `exposeBinding` 记录事件，跨 reload 保留：pointerdown/up/cancel、got/lost capture、按住按钮时的 pointermove；keydown/up（可打印字符记为 `char`）、repeat、isTrusted、活动元素；window focus/blur、visibility；`therss.sidebar-width` 写入；手柄 ARIA/hidden/tabindex 与 app-shell class 变化；
  - 主进程记录窗口和应用的焦点事件；测试侧记录阶段时间戳；
  - 失败时附带最终 CSS 宽度、ARIA、localStorage、activeElement、`document.hasFocus`、visibility、窗口 bounds 和焦点，代码版本（HEAD、改动路径数、Electron 版本），测试配置摘要，原始错误（去掉颜色码），以及 trace 所在目录；
  - 内存上限 3000 条（超出部分计入 `droppedEvents`）；每次失败使用唯一文件名，以 `wx` 写入，不覆盖旧文件；
  - 每个异步步骤都有超时并捕获异常；`recordFailure` 和 `dispose` 都不会抛出，原失败仍是测试结果；
  - `dispose` 移除渲染层监听、恢复 `setItem`、断开观察器，并移除主进程监听。
- `e2e/sidebar-resize.spec.ts`：接入上述模块，加入阶段标记；`catch` 中先写出诊断再原样抛出原错误；`finally` 中先清理再关闭应用。
- `e2e/probes/sidebarDiagnostics.probe.ts` 与 `e2e/probes/playwright.probe.config.ts`（新增）：受控失败探针，使用 `.probe.ts` 后缀，不在常规套件的匹配范围内（`playwright test --list` 中没有它）。

#### 受控失败探针（不计入产品失败或修复）

- 命令：`npx playwright test -c e2e/probes/playwright.probe.config.ts`，运行 3 次，exit 均为 1。
- 故意失败的用例 ✘：
  - JSON 附件 `sidebar-diagnostics`、trace 与截图都在；
  - `test-results/sidebar-diagnostics/` 中每次新增一份唯一副本，3 次共 3 份，旧副本未被覆盖；
  - 事件跨 reload：2 个 `document-start`，reload 前有 `ArrowRight` 并写入存储 232，reload 后有 `ArrowLeft` 并写入存储 224；
  - 最终状态在记录中（快照时 CSS 宽度为 232px、aria 为 224，是 180ms 过渡中的真实中间状态）；
  - `droppedEvents` 为 0。
- 第二个用例 ✓：`dispose` 后渲染层停止函数被移除，`setItem` 恢复为原生实现，主进程记录对象被清除。
- 探针副本和日志已脱敏，移入 `evidence/probe/`；`test-results/sidebar-diagnostics/` 随后清空，因此那里今后出现的文件都来自真实失败。

#### 门禁（本阶段代码）

| 命令                                                                        | 结果                                                                             |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `npm run check`（含架构、格式、lint、类型检查、主套件与 AppKit 测试、构建） | exit 0。主套件 142 个文件 / 952 个测试；AppKit 套件 40 个文件 / 228 个测试       |
| `npm run test:e2e`（完整，1 次）                                            | exit 0，9/9；侧栏通过，未写出诊断文件。日志：`evidence/e2e-with-diagnostics.log` |
| 完整原生 smoke                                                              | 未运行（没有原生改动，不在本阶段范围）                                           |

#### 剩余事项

- 历史根因待下一次自然失败时，用写出的诊断判别（H-A 应用失活 / H-B1 额外按键 / 其他）。届时还需在下一次运行前，从记录里 `trace.outputDir` 指向的目录归档 trace。
- 本阶段完整 E2E 和单元测试留下的 `$TMPDIR/therss-*` 临时目录未能删除：批量清理被权限策略拒绝，我没有绕过。目录清单见 worker 回报。
- VoiceOver 由 Manager 负责，不在本阶段范围。

## 受控诊断阶段（历史）

日期：2026-11-12。状态：**根因未证实，本项未完成。** 没有修改任何产品代码或测试。未提交、推送、安装或发布。
诊断与假设见 [SIDEBAR_DIAGNOSIS.md](SIDEBAR_DIAGNOSIS.md)；本阶段决定见 [CHANGE_CONTRACT.md](CHANGE_CONTRACT.md)。

### 本阶段做了什么

1. **跨 reload 的事件记录**（`harness/recorder.mjs`）
   - 渲染层事件经 `exposeBinding` 送到 Node，因此 reload 后不会丢失。
   - 记录内容：pointerdown/move/up/cancel、got/lost capture（pointerId、buttons、x、isTrusted、target）；keydown/keyup（键名、repeat、isTrusted、活动元素，可打印字符一律记为 `char`）；window focus/blur、visibility；`therss.sidebar-width` 的写入；手柄 aria-valuenow/hidden/tabindex 以及 app-shell class 的变化。
   - 主进程：BrowserWindow 的 focus/blur/resize/show/hide，`app` 的 did-become/resign-active 和 browser-window-focus/blur。
   - 测试侧：各阶段的时间戳。
   - 只记录 fixture 测试应用内的事件，不涉及其他应用。
2. **机制检查**（`harness/mechanism.diag.spec.mjs`，在进程内进行，不激活其他应用）。
3. **复现尝试**：
   - “两个退出用例 + 带记录的侧栏用例”组合，运行 5 次（`harness/sequence.diag.spec.mjs`），断言与原测试相同，`expect` 数量一致。
   - 证据缺口：历史失败发生在完整序列中，因此另以完整 E2E 顺序（其余 8 个用例 + 带记录的侧栏用例，`harness/full-sequence.config.mjs`）有界运行 2 次。

## 结果

| 检查                                           | 结果                                                                                                                                                                   | 证据                                                 |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| H-A：拖拽中把焦点移到同一应用的另一个窗口      | 主窗口 blur，但指针捕获没有丢失，拖拽完成：288 并写入 `288`。**“窗口失焦即取消拖拽”被证伪。** 应用失活（另一个应用激活）不同于窗口失焦，未测试，因为必须激活其他应用。 | `evidence/mechanism-1-H-A.json`                      |
| H-B1：给获得焦点的手柄再注入一次 Right         | 232→240，写入 `240`。**机制成立**（+8 且持久化），但这不证明历史来源。                                                                                                 | `evidence/mechanism-1-H-B1.json`                     |
| H-B2：拖拽未松开就点击 Hide/Show               | Hide 被吞掉，侧栏没有收起，找不到 Show，宽度变为 321 且未写入存储。**与历史的 304（Hide/Show 都成功）特征不符。**                                                      | `evidence/mechanism-1-H-B2.json`                     |
| 两个退出用例 + 侧栏，5 次                      | 全部 3/3 通过。每次都是：2 次可信 `ArrowRight`（宽窗口 1 次写入 296，窄窗口 1 次受限），存储 `288`、`296`，捕获在 pointerup 后正常释放，没有任何窗口或应用的焦点事件。 | `evidence/sequence-*-sidebar.json`、`sequence-*.log` |
| 完整顺序 + 带记录的侧栏，2 次                  | 全部 11/11 通过，事件序列与上面相同。                                                                                                                                  | `evidence/full-*-sidebar.json`、`full-*.log`         |
| 真实完整 E2E（`npm run test:e2e`，1 次）       | exit 0，9/9                                                                                                                                                            | `evidence/e2e-gate.log`                              |
| `format:check` / `lint` / `check:architecture` | 均 exit 0                                                                                                                                                              | —                                                    |

本阶段没有修改产品代码或测试，因此没有运行 `npm run check`。最近一次 `npm run check`（exit 0）对应同一份产品代码，见 My sources 报告。

## 结论与边界

- **已证实**：
  - 通过的运行有稳定的基线事件序列；
  - 窗口失焦不会取消拖拽；
  - 多一次按键会产生 +8 并写入存储；
  - 未松开的拖拽会吞掉点击，并以不同宽度结束、不写存储。
- **未证实**：两次历史失败（224/288、304/296）的实际触发源。本次 7 次带记录的运行和 1 次真实完整 E2E 都没有复现。
- **仍可能的解释（尚未观察到）**：
  - 224：应用失活（另一个应用激活）导致指针捕获丢失；
  - 304：一次额外的真实 `ArrowRight`，例如测试抢走焦点时用户的按键。
  - 两者都需要在失败发生的那次运行中拿到记录才能判定。
- 因为没有证据，没有做产品或测试修复。没有放宽断言、改容差、加重试或改写期望。

## 若要关闭本项，建议的下一步（需 Manager/用户决定）

- 把 `recorder.mjs` 接入真实的 `e2e/sidebar-resize.spec.ts`：只在失败时把事件记录作为附件写出，断言不变。这样下一次自然出现的失败可以直接判别 H-A 与 H-B1。这会改动测试文件，需要批准。
- 应用失活路径只能通过激活其他应用来验证，这会干扰用户桌面，按约束本阶段未执行。

## 清理

已删除本阶段创建的临时 profile（侧栏、退出、机制检查以及完整顺序和真实 E2E 产生的目录）和 `test-results/sidebar-diag`。没有残留进程。
没有打开或改动 Manager 的 profile；本阶段结束检查时 `CEmo14` 已不存在；我的清理只匹配 `therss-sidebar-*`、`therss-quit-e2e-*` 和真实 E2E 的临时目录前缀，不包含 `therss-my-sources-review-*`，因此不是我删除的。
