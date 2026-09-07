# 直接编辑与直觉操作整改

用户指出 Edit search 阻挡直接修改问题。本轮将搜索框作为持续存在的输入控件，并检查 Discover、Saved、Sources、Data Analytics、Settings、本地搜索与写入弹窗；处理了五类重复操作。

| 已移除的步骤                                | 现在的操作                                                        |
| ------------------------------------------- | ----------------------------------------------------------------- |
| Edit search → 修改 → Done editing           | 在带标签和原生边框的 Research question 中直接修改；按 Search 执行 |
| 四个原生列表上的 Read selected              | 点击条目或按 Return 直接打开；窄窗仍有 Back 返回原位置            |
| 原生/Web 详情中的摘要展开/收起              | 完整已获取摘要直接显示，在既有阅读区域自然滚动                    |
| 本地查找的 Search 和原生重复 Open in TheRSS | 输入后约 250 ms 自动筛选；点击/Return 激活准确的原生本地结果      |
| Sources 的 Open cached content              | 来源列表直接打开内容；Refresh 与外部网站入口各自保留              |

零选中来源时的重复 Choose sources 按钮也已删除，统一使用 Sources 入口。Web 的 Expand and search 改为 Search，使执行动作的名称与原生一致。新草稿、选择的执行端或来源与当前结果不一致时，会显示 Draft not searched，不自动调用模型或来源。

本地搜索继续可编辑，并忽略过时查询、无效短查询和关闭后的响应。初次恢复 Web 历史会话只填充未被用户改过的字段；若用户已开始新检索，旧恢复响应不能覆盖新结果。长摘要展示仍是发现证据，不宣称已阅读全文。

## 审查后保留的操作

Search、Analyze、Refresh、Save provider、更新收藏快照分别执行模型、网络或持久化动作，需要明确触发。来源选择、元数据/检索证据、完整数值表等较大的辅助内容仍按需展开。写入 llm-wiki、删除凭据和未保存修改的确认保留。错误重试、清除筛选和分批加载仍提供独立作用。

非论文从 Saved 分析依赖现有持久化契约；没有通过删除 UI 按钮扩大分析对象或偷偷覆盖收藏快照。Web 回退的本地搜索结果保留原来的外部标题链接行为；本轮未新增其历史记录导航。

## 验证

已通过 `npm run check`：680 项主测试和 103 项 AppKit 专项（存在重叠）；主套件覆盖率 statements/branches/functions/lines 为 91.07/82.21/94.70/93.76%，AppKit 为 89.48/82.36/89.88/92.13%。最初 7 个回归分别证实输入框消失、额外打开步骤、摘要截断及本地查找依赖提交按钮，随后修复通过；新增查询乱序、关闭取消及早期草稿保护。

首次完整回归还发现旧样式测试要求截断摘要、以及一种初次载入时禁用 Web 输入的试验实现会丢失输入。前者依批准契约更新，后者改为保留用户输入。没有放宽数据、来源、键盘或外部写入验证。

桌面八项用例全部覆盖通过：首轮七项通过，后续将 Search 的定位改为 exact 匹配后，剩余一项通过。打包启动、完整原生 13 组流程与已安装应用的 13 组流程均通过。明暗模式、窄窗、中文输入和完整摘要末句已截图/控件检查；15 次本地搜索打开与返回没有意外关闭。

一次原生测试中窗口意外关闭，原因尚未确认，标为未复现事件；后续带追踪的完整流程、15 次重复往返和安装后流程均未复现。保留隔离测试的可选关闭事件追踪，不能把未复现称为已找到并修复根因。

新版已安装并重新打开。保留旧应用和即时数据库备份，11 个真实数据表（包括本轮期间用户新增的记录）与即时备份逐表一致；16 个构建输出与安装来源包匹配。机器可读结果见 [verification.json](verification.json)、[package-verification.json](package-verification.json) 和 [install-verification.json](install-verification.json)。

本轮 UI 验证使用明确的确定性 fixture，没有触发真实模型或来源调用；用户自行使用应用的操作不计入这轮测试。原型只验证输入、草稿和打开逻辑，不作为真实来源证据。主会话在独立阶段审阅了 diff；没有新增依赖、SQLite schema 或 IPC。

通过现有 [草稿 PR #49](https://github.com/dtjgp/TheRSS/pull/49) 交付；远端 CI 以该 PR 当前 head checks 为准。不合并、不创建标签或发布软件 Release。

2026-09-07 用户决定人工验收暂按通过，后续出现问题再调整。按该决定关闭当前人工体验阻塞项，逐项实测细节未另行提交；出现问题时重新打开对应项。此前来源和检索/分析质量限制继续见 [质量报告](../2026-09-07-source-quality/REPORT.md)。

## 当前界面证据

- [用户反馈中的旧入口](screenshots/before-edit-search.png)
- [明色：直接编辑与完整摘要](screenshots/discover-light.png)
- [深色：直接编辑](screenshots/discover-editable-dark.png)
- [窄窗：点击条目进入阅读](screenshots/discover-narrow.png)
- [本地查找：输入即筛选](screenshots/local-search.png)
