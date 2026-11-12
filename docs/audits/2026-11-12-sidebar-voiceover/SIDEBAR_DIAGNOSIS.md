# 侧栏 E2E 间歇失败：离线诊断

日期：2026-11-12。阶段：只读离线诊断（契约：Manager 工作区
`docs/audits/2026-11-12-sidebar-voiceover/CHANGE_CONTRACT.md`）。本阶段未启动 Electron、浏览器或
GUI，未运行 E2E 或 smoke，未发送系统级输入，未修改产品或测试。上一阶段 I2/I1/I4/My sources
的未提交改动保持不变。

## 结论摘要

- **未证实根因。** 现有证据只能排除部分解释，不能确定两次失败的触发源。
- 两次失败对应侧栏代码中两条不同的状态路径。每条路径都有一个可证伪的假设和缺失的证据字段（见下文）。
- 侧栏相关代码与测试自 `b1ea922` 以来没有改动（`App.tsx`、`styles.css`、`AppTopbar.tsx`、
  `e2e/sidebar-resize.spec.ts`、`e2e/quit.spec.ts` 的 `git diff` 为空），因此失败不是本任务改动直接引入的；
  但这并不证明失败来自环境。

## 原始证据

| 运行                              | 结果                              | 失败点                                                                       | 证据                                                                                                         |
| --------------------------------- | --------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| My sources 首轮，最后一次完整 E2E | 8/9，用时 6.0s（正常约 2.1–2.7s） | `sidebar-resize.spec.ts:63`：拖拽后 `aria-valuenow` 期望 288，实际一直是 224 | `docs/audits/2026-11-12-my-sources/evidence/e2e-final-run.log`                                               |
| 审查第 2 轮，完整 E2E             | 8/9，用时 7.0s                    | `:74`：Hide→Show 后宽度期望 296px，实际 304px                                | `.../evidence/r2-e2e-run.log`                                                                                |
| 其余 3 次完整 E2E                 | 9/9                               | —                                                                            | `.../evidence/r1-e2e-run.log`、`r3-e2e-run.log`，以及首轮的第一次运行                                        |
| 单独运行                          | 3/3 + 1/1 + 5/5 通过              | —                                                                            | `.../evidence/r2-e2e-sidebar-investigation-*.log`、`e2e-sidebar-resize-rerun.log`、`r3-sidebar-diagnostic-*` |

- 两次失败都出现在完整序列里，紧接在 `quit.spec.ts` 的两次退出用例之后（该 spec 在 sidebar-resize 之前运行）。
- **失败的 trace 已不存在。** Playwright 每次运行都会清空 `test-results/compatibility`，现在 `find` 查不到 `trace.zip`。
- **上一轮的诊断丢了关键阶段。** `r3-sidebar-diagnostic-summary.json` 的事件数组在测试第 76 行 `page.reload()` 时被清空，只记录了 reload 之后（820px 窄窗口阶段）的 1 次 `ArrowRight`。拖拽和 Hide/Show 阶段（两次失败都发生在这里）没有任何记录。这些运行也都通过了，所以不能作为失败时序的证据。

## 代码事实（`src/renderer/src/App.tsx`、`styles.css`）

1. 会改变宽度的路径只有：
   - `moveSidebarResize`：拖拽中，不写存储；
   - `finishSidebarResize`：写存储；
   - `cancelSidebarResize`：恢复到拖拽开始时的偏好值；
   - `resizeSidebarWithKeyboard`：每次 ±8，Shift 时 ±32，写存储；
   - 窗口尺寸只通过 `maximumSidebarWidth` 封顶，不会让宽度超过偏好值。
2. 缩放手柄同时把 `onPointerCancel` 和 `onLostPointerCapture` 接到 `cancelSidebarResize`。拖拽中任何非预期的 capture 丢失都会把偏好值恢复为起点，之后的移动因 `drag === null` 被忽略。
3. `.app-shell` 对 `grid-template-columns` 有 180ms 过渡，拖拽时（`--sidebar-resizing`）关闭。`.sidebar` 是 `-webkit-app-region: drag`，手柄是 `no-drag`、`z-index: 20`。
4. 收起时手柄带 `hidden`、`tabIndex=-1`。收起前焦点在手柄上（`press('ArrowRight')` 之后）。
5. 测试在拖拽前主动 `BrowserWindow.focus()` 和 `page.bringToFront()`（第 52–53 行），说明拖拽对窗口焦点敏感。

## 对两次失败的分析

### 失败 A：拖拽后仍为 224（期望 288）

- 224 是新 profile 在宽窗口下的默认宽度（`defaultSidebarWidth`）。整个调用记录里值一直是 224，说明宽度从未离开起点，或离开后被恢复。
- 能产生这个结果的代码路径：
  - (a) `pointerdown` 没有命中手柄，拖拽没有开始；
  - (b) 拖拽开始后出现 `pointercancel` 或 `lostpointercapture`，`cancelSidebarResize` 恢复到 224，随后的移动和抬起都被忽略。
- **H-A（可证伪）**：完整序列中，前一个 spec 退出 Electron 后，macOS 的应用激活顺序发生变化，新窗口在拖拽期间失去焦点（应用失活或窗口 blur），Chromium 释放了指针捕获，触发 `lostpointercapture` → 取消。
  - 支持点：只在完整序列中失败；测试本身在拖拽前抢焦点。
  - 推翻条件：失败重现时，拖拽期间没有 `lostpointercapture`、`pointercancel`、窗口 `blur` 或应用 `did-resign-active`，而是根本没有 `pointerdown` 到达手柄（此时应转向 (a)，检查命中区域和 `app-region`）。

### 失败 B：Hide→Show 后为 304（期望 296）

- 调用记录显示 Show 之后宽度从 `84 → 103 → 225.2 → 303.9` 过渡到稳定的 `304px`，说明 304 是状态目标值，不是过渡中被采样的中间值。
- 第 67 行已断言 `localStorage` 为 `'296'` 并通过，所以多出的变化发生在第 67 行之后、Hide 之前或期间。
- 刚好 +8 与一次额外的 `ArrowRight` 一致。但只凭“多一步”不能下结论，因为另一条路径同样可能：拖拽状态没有结束，后续指针移动（`persist=false`）改了宽度。
- **H-B1（可证伪）**：手柄仍有焦点时，又收到一次 `ArrowRight` keydown（来源可能是被测试抢走焦点前用户的真实按键，也可能是其他重发）。
  - 判据：失败时 `localStorage` 应为 `'304'`（键盘路径写存储），keydown 共 2 次。
- **H-B2（可证伪）**：拖拽状态未结束，Hide 或 Show 点击时的指针移动被当作拖拽。
  - 判据：`localStorage` 仍为 `'296'`，有 `drag` 期间的 `pointermove`，且没有对应的 `pointerup`。
  - 静态分析：Show 时手柄是 `hidden`，捕获会丢失并触发取消、恢复起点，按理不会稳定在 304。因此 H-B2 的可能性较低，但未被证据排除。
- 两个假设由 `localStorage` 最终值、keydown 次数和 `isTrusted`、pointer 序列即可区分。现有日志都没有这些字段。

## 下一次必须捕获的字段

全部记录要跨 `page.reload()` 保留：写到 Node 侧（`exposeBinding`），或者每次 reload 后先把已有记录取出再继续。

- **渲染层**：
  - `pointerdown/move/up/cancel`、`gotpointercapture/lostpointercapture`：pointerId、buttons、clientX、isTrusted、timeStamp、target；
  - `keydown/keyup`：key、repeat、isTrusted、timeStamp、`document.activeElement`；
  - `window` 的 focus/blur、`visibilitychange`；
  - `therss.sidebar-width` 的每次写入；
  - 手柄 `aria-valuenow`、`hidden`、`tabIndex` 的变化（MutationObserver）。
- **主进程**：
  - `BrowserWindow` 的 focus/blur/resize；
  - `app` 的 `did-become-active`/`did-resign-active`；
  - 启动时上一个测试 Electron 进程是否已退出（pid）。
- **测试侧**：每个 Playwright 步骤的时间戳，失败时的 `localStorage` 值，保留 `trace.zip`（失败运行的 `outputDir` 需在下次运行前拷出）。

## 最小确定性复现方案（下一阶段执行，需 Manager 释放桌面）

1. **H-A 机制**：在进程内、不激活其他应用的前提下，在 `mouse.down` 和 `mouse.up` 之间让主窗口失焦。可以创建并聚焦同一应用的第二个 BrowserWindow，或调用 `BrowserWindow.blur()`。
   - 断言：出现 `lostpointercapture`，`aria-valuenow` 回到 224。
   - 若复现，说明“拖拽中失焦即取消”是产品设计（取消恢复起点），失败来自测试缺少“拖拽期间保持窗口焦点”的前提。修正应在测试中等待并确认窗口焦点稳定后再拖拽，不改产品断言。若产品方认为失焦不应取消拖拽，则另作决定。
2. **H-B1 机制**：在 `press('ArrowRight')` 后，经 `webContents.sendInputEvent` 在进程内再发送一次 Right keyDown，确认得到 304，且 `localStorage` 为 `'304'`。这只证明机制，不证明真实来源。
3. **完整序列前置条件**：只运行 `e2e/quit.spec.ts` + `e2e/sidebar-resize.spec.ts`，并带上述插桩，做有限次数（例如 5 次，每次保留记录）。
   - 记录 sidebar 测试期间是否出现应用失活或窗口失焦，以及失败时上述字段的值。
   - 若出现失活或失焦，再查明来源（上一个 Electron 退出后的激活转移，还是外部应用）。

**Verifier**：

- 带插桩的有限次数运行中，失败必须与预测的事件序列一致（H-A：`lostpointercapture` 或 `blur` 后回到 224；H-B1：第二次 keydown 后存储为 `'304'`）。
- 修正后的同组合运行，以及一次完整 E2E 9/9。
- `npm run check`。
- 原始断言、容差和重试设置保持不变。

## 未证实与限制

- 两次失败的触发源都未被观察到。H-A、H-B1、H-B2 均为假设。
- 失败运行的 trace 已丢失，无法回溯。
- 本阶段没有任何新运行，也没有修改任何代码或测试。

## 受控阶段结果（2026-11-12，追加）

详见 [REPORT.md](REPORT.md)。

- H-A 按原表述被证伪：同一应用内窗口失焦不会取消拖拽；应用失活的情况未测试。
- H-B1 的机制成立，但来源未观察到。
- H-B2 的结果特征与 304 不符。
- 7 次带记录的运行和 1 次真实完整 E2E 都没有复现，历史根因仍未证实。
