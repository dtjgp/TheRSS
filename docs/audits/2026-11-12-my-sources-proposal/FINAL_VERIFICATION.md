# My sources 交付与验证

2026-11-12。状态：Engineer 工作区实现完成，Manager 独立差异审查和本轮原生交互复核完成。
代码位于 `/Users/dtjgp/orca/workspaces/TheRSS/Engineer`，基于 `b1ea922` 加未提交改动。
保留上一轮 I2/I1/I4；未提交、推送、安装或发布。

## 最终行为

- Sources 的 `My sources · N/22` 管理默认检索来源，保存到 SQLite。
- Discover 的 `Sources for this search · N/22` 使用独立草稿，Apply 只改变本次来源。
- 查找、Only selected、Select shown/Clear shown 只操作当前显示项；0 项不能保存或应用。
- Cancel/Escape 丢弃未应用改动。默认保存失败保留草稿；读取失败不静默全选。
- 保存新默认仅在本次来源仍等于旧默认且没有活动任务时同步；否则保留并提示。
- 来源弹出框在应用失去前台时关闭并取消未应用草稿；回前台不自动打开。
- 重启从默认组合开始；旧会话、历史重试、Saved、Daily Papers 的范围不被改写。

## 当前代码门禁

以下为已核对的 Engineer 记录，没有用历史通过替代当前结果：

| 检查                       | 最新结果                                                                     |
| -------------------------- | ---------------------------------------------------------------------------- |
| `npm run check`            | exit 0；主套件 952、AppKit 228；包含格式、lint、类型、架构、构建和覆盖率要求 |
| 完整 E2E                   | exit 0，9/9                                                                  |
| 完整原生 smoke             | exit 0，17/17 组                                                             |
| 后台关闭专项               | exit 0，13/13 条断言                                                         |
| Manager `git diff --check` | exit 0                                                                       |

原始报告及日志位于 Engineer 工作区
`docs/audits/2026-11-12-my-sources/REPORT.md`、`evidence/r3-*.log`。
原生后台通知测试动作仅在显式 fixture 进程可调用；生产路径不能调用该动作。
观察者使用弱引用，并在关闭与析构时移除。没有新增依赖或外部服务。

## Manager 的原生 CUA 复核

使用当前 build 和隔离 profile；规划、来源获取为固定数据，偏好使用真实 SQLite。
没有使用 System Events/osascript 脚本，没有操作其他用户应用，也没有真实模型、来源或 vault 写入。

前一轮已验证 sheet 的查找与可见项批量取消、隐藏选中项保持、Tab/空格、Escape 焦点返回、
0 项禁用及单一默认保存。此次补齐：

1. 重开原 profile，默认仍为之前保存的 arXiv 1/22；旧结果独立标明 3/22。
2. 打开本次来源，Select shown 得到未应用的 22 项；Command-H 隐藏测试应用后，
   AX 中弹出框消失，本次仍 1/22，研究问题未变。返回未自动打开。
3. 将隐藏窗口恢复到前台时，单纯 AX 按钮动作未恢复活动状态；通过实际鼠标点击来源按钮
   重新打开后，显示已应用的 1 项，证明刚才的 22 项未应用草稿已丢弃。
4. 在前台来源查找框输入 `github`，仅查找框改变为 `github`、显示 1 项；
   研究问题 `Synthetic structured pruning check CUA` 不变。
5. 勾选 GitHub 并 Apply 后，本次 2/22、默认仍 1/22；切页到 Sources，入口仍 1/22。
6. Sources 中 Restore all 并保存 22/22；回 Discover，本次仍 2/22，问题和 runner 保留，
   显示默认已变更但当前来源保留的提示。旧结果仍标明原 3/22。
7. 点击 Search，仅执行固定数据的 arXiv/GitHub 两个来源，显示 2/2 完成，
   本次控件仍 2/22。关闭后以同一 profile 重启，下一次来源恢复默认 22/22；
   已有结果继续标明只搜索过 2/22。
8. 退出测试应用，确认 PID 66212、67163 均已退出。只读 SQLite 查询确认默认 22 项，
   最新会话的实际来源仅 `arxiv`、`github`，各 1 条结果。

数据库证据见 [manager-native-final.json](evidence/manager-native-final.json)。
CUA 的实际图像和 AX 观察保留在会话工具记录；没有把 fixture 的 fill 当成真实键入证据。
这里验证的是 Command-H 隐藏/返回的真实前后台转换，没有进行用户其他应用之间的切换矩阵。

## 保留的限制

- 侧栏 E2E 曾在完整运行中间歇失败（累计 2/5）；最新完整运行通过。
  单独诊断未复现，原因仍未知，没有删断言、放宽容差或声称已解决。
- 用户已取消并回撤 VoiceOver 专项；不再列入本轮范围。没有运行安装包、发布门禁或真实外部检索。
- 本轮结果允许交付本地实现，不表示已经安装到用户日常使用的应用。

## 清理

验证进程已退出。带 `review-app.json` 标记的专用 profile 在证据归档后删除；
保留任务文档、截图、门禁日志及只读查询摘要。没有删除真实应用数据或仓库改动。
