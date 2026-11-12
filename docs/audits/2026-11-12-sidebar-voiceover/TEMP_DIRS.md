# 本 worker 创建、未删除的临时目录（只读清单）

日期：2026-11-12。本文件只读列出目录，**未删除任何目录，也未再尝试清理**。

`$TMPDIR` = `/var/folders/d9/50r202r14gbc_shcxg960xrh0000gn/T/`。下表中每个目录的绝对路径是 `$TMPDIR` 加上目录名。
创建时间是 `stat` 的 birth time（本地时间 CET，+0100）。

## 归属判据

只列出同时满足以下三条的目录。三条都只读核对，不按前缀推断归属。

1. 创建时间落在本 worker 已记录的运行窗口内。窗口取自日志文件的 birth time 和最后修改时间。
2. 该前缀由本次运行中的一个确定位置创建（见“创建者”一列）。
3. 每个窗口内的目录数等于该运行固定会创建的数量：完整 E2E 8 个，`npm run check` 12 个（`therss-native-prefs-` 8 个，`therss-llm-wiki-promotion-` 4 个）。

另外，`therss-native-full-0Y5EJE/Preferences` 的内容含本 worktree 路径，这是一个直接标记。其他目录内没有找到 worktree 路径，归属只依据上面三条。

`$TMPDIR` 中共有 402 个 `therss-*` 目录。除下表所列以外，本文件不认领其他任何目录，包括 19:46–19:47 创建的一批：它们的来源没有核实。

## 本任务（task_8908ea649508）

运行窗口：`npm run check` 20:43:48–20:44:16（exit 0）；完整 E2E 20:44:20–20:45:04（exit 0，9/9）。

| 目录                               | 创建时间 | 创建者                                                       |
| ---------------------------------- | -------- | ------------------------------------------------------------ |
| `therss-llm-wiki-promotion-Ie1YYv` | 20:44:02 | `npm run check` 单元测试，经 `llmWikiVaultPrepare.ts:80`     |
| `therss-llm-wiki-promotion-V4ySN0` | 20:44:02 | 同上                                                         |
| `therss-llm-wiki-promotion-fZz7wL` | 20:44:02 | 同上                                                         |
| `therss-llm-wiki-promotion-5wp9E3` | 20:44:03 | 同上                                                         |
| `therss-native-prefs-PdnxD9`       | 20:44:04 | `npm run check`，`src/main/appkit/preferences.test.ts`       |
| `therss-native-prefs-mqJDbl`       | 20:44:04 | 同上                                                         |
| `therss-native-prefs-nOiR58`       | 20:44:04 | 同上                                                         |
| `therss-native-prefs-zBbNih`       | 20:44:04 | 同上                                                         |
| `therss-native-prefs-Nem5NY`       | 20:44:08 | 同上                                                         |
| `therss-native-prefs-imlnpT`       | 20:44:08 | 同上                                                         |
| `therss-native-prefs-ppCJZ6`       | 20:44:08 | 同上                                                         |
| `therss-native-prefs-vYUepV`       | 20:44:08 | 同上                                                         |
| `therss-e2e-6p46rK`                | 20:44:30 | 完整 E2E，`e2e/desktop.spec.ts:11`                           |
| `therss-appearance-7qasMU`         | 20:44:49 | 完整 E2E，`e2e/macos-appearance.spec.ts:31`                  |
| `therss-native-e2e-x5ayCh`         | 20:44:51 | 完整 E2E，`e2e/native-glass.spec.ts:113`                     |
| `therss-native-full-0Y5EJE`        | 20:44:55 | 完整 E2E，`e2e/native-glass.spec.ts:366`（含 worktree 标记） |
| `therss-quit-e2e-co2BO5`           | 20:44:59 | 完整 E2E，`e2e/quit.spec.ts:10`                              |
| `therss-quit-e2e-lssjcj`           | 20:45:00 | 同上                                                         |
| `therss-sidebar-e2e-mGXrAu`        | 20:45:01 | 完整 E2E，`e2e/sidebar-resize.spec.ts:9`                     |
| `therss-source-navigation-43mQ8f`  | 20:45:03 | 完整 E2E，`e2e/sources-navigation.spec.ts:8`                 |

探针的 profile（`therss-sidebar-probe-*`）由探针自己的 `finally` 删除。删除只发生在测试代码内，不是批量清理。核对后剩余 0 个。

## 上一阶段（同一 worker、同一 worktree，失败诊断接入阶段）

运行窗口：`npm run check` 结束于完整 E2E 开始之前；完整 E2E 在 20:31:55 开始（时间来自当时的命令记录）。数量同样是 12 + 8。

- `npm run check`：`therss-llm-wiki-promotion-{IrEhsT,QZPFE9,SZXa1j,xn2tjo}`（20:31:36）；
  `therss-native-prefs-{YqiQux,1M0K6m,YXketA,aI9H07}`（20:31:38–39）；
  `therss-native-prefs-{88waQb,WWBILN,WqVIdc,c9ieeI}`（20:31:42）。
- 完整 E2E：`therss-e2e-S6uE2K`（20:32:06），`therss-appearance-lxxXEF`（20:32:25），
  `therss-native-e2e-0l3kh7`（20:32:27），`therss-native-full-nF6T8i`（20:32:31），
  `therss-quit-e2e-{pT8ir3,8DoMMm}`（20:32:35–37），`therss-sidebar-e2e-GzOdOF`（20:32:37），
  `therss-source-navigation-MgV9MD`（20:32:39）。

## 进程

检查时间是本任务的完整 E2E 结束之后。`pgrep -x Electron` 返回 0 个进程。`lsof` 中没有打开的文件句柄指向 `$TMPDIR/therss*`（0 条）。

## 原拒绝文本

时间：2026-11-12T19:32:58Z。当时被拒绝的命令要按前缀和 `-newer` 时间批量执行 `rm -rf`。以下为原文；原文中没有用户信息或凭据，不需要脱敏：

> Permission for this action was denied by the Claude Code auto mode classifier. Reason: [Shared Scratch Sweep]. If you have other tasks that don't depend on this action, continue working on those. IMPORTANT: You _may_ attempt to accomplish this action using other tools that might naturally be used to accomplish this goal, e.g. using head instead of cat. But you _should not_ attempt to work around this denial in malicious ways, e.g. do not use your ability to run tests to execute non-test actions. You should only try to work around this restriction in reasonable ways that do not attempt to bypass the intent behind this denial. If you believe this capability is essential to complete the user's request, first try a safer method. Get as much of the rest of the task done as you can, then STOP and explain to the user what you were trying to do and why you need this permission. Let the user decide how to proceed. To allow this type of action in the future, the user can add a permission rule for Bash to their settings.

拒绝文本只给出分类名 “Shared Scratch Sweep”，没有给出更具体的原因。本文件不补充原因。删除这些目录需要用户或 Manager 决定。
