# TheRSS 使用说明

TheRSS 把研究问题转换为可检查的检索计划，在内置研究来源中查找论文、代码和相关信息。研究记录保存在本机；摘要与模型分析都有各自的证据边界。

## 第一次使用

1. 打开 Settings。可选的 Personal context 用于保存研究方向和筛选偏好。
2. 选择执行方式：自己的模型服务，或已安装并完成其自身登录配置的 Codex CLI / Claude Code。检测到可执行程序不代表其账号已经登录。
3. 使用模型服务时，填写名称、协议、基础 URL、模型名和所需的 API key。Test connection 测试当前草稿，Save provider 才会保存修改。
4. 在 Discover 输入研究问题，选择来源，再按 Search。按钮不可用时，旁边会说明缺少问题、来源还是执行方式。

不要把密钥写入 Personal context。模型检索会把研究问题和所选背景发送给执行端，详见 [隐私说明](PRIVACY.md)。

## 检索、阅读与收藏

- Sources 按研究用途分组，可在选择器内查找名称。这个查找框仅筛选来源选项，不修改研究问题。
- 搜索完成后，查询区会收紧。Edit search 恢复编辑；未提交的修改会与当前结果区别显示。
- 选择结果查看摘要、证据边界和匹配理由。完整来源字段及排序分值在 Source details 中保留；分值不是可信度或研究质量评分。
- Save / Unsave 可逆。顶部反馈不会挤动阅读区域，Undo 可以恢复上一次分拣操作。
- 在 Saved 选择记录后，Update saved snapshot 可以采用同一条目的较新本地检索快照。它保留收藏时间和全部历史分析，不调用模型或联网。没有新快照时需先重新检索；来源内容变化后，旧分析会显示过时提示。
- Analyze 是单独的显式操作，不会因为阅读或收藏自动运行。保存过的分析会显示加载状态及来源哈希检查结果；来源变化时需重新评估旧分析。
- 窄窗口下，点击条目或按 Return 进入单栏阅读，使用 Back to results 返回原列表。宽窗口保留可调整的列表与详情分栏。
- 部分来源失败时，成功结果仍保留。Search details 记录每个来源的结果，Retry incomplete 只重试未完成来源。

## 找回本地记录

Command-F 打开 Find Local Research，检索收藏、已保存的搜索会话和分析文本。它不调用模型或外部来源。

Open in TheRSS 打开对应本地记录；历史分析按其固定 ID 打开。Back to search results 返回原查询及选择，并恢复原工作区中未提交的搜索草稿。Open original 是另一个动作，用于打开来源网站。记录失效时会说明原因，不会偷偷跳到一个不同的最新结果。

## 来源与统计

Sources 展示内置来源目录、记录的检查状态和时间。移动键盘焦点只预览来源；点击或按 Return 才打开内容。刷新失败会保留已有缓存，并更新失败状态。空筛选可以直接清除筛选。

NCPSD 有些记录只提供出版年月，界面会显示 month only；30 天窗口按该月份的可能日期区间纳入。缺少日期的期号记录不会伪造日期。NBER 详情不可访问时会保留失败说明与已有缓存。

Data Analytics 使用本机记录。Returned 包含每次检索返回的记录，重复检索会重复计数；Analyses 是存储的分析次数，不等于独立论文数。Show daily values 提供各日期的完整数值。

## 可选的 llm-wiki 集成

arXiv 论文可以进入独立的写入预览。只有符合既定模板和写入规则的 llm-wiki 知识库才能使用该能力，普通 Obsidian 文件夹不会自动满足条件。

默认位置为 `~/Obsidian/llm-wiki`，维护者可通过 `THERSS_LLM_WIKI_PATH` 指定已有库。预览会显示目标路径、PDF 检查、证据等级和阻塞原因；最终确认前不会进行规范笔记写入。该流程可能调用已配置的 Codex 服务处理论文文本。

## 快捷键与显示

| 操作             | 快捷键                |
| ---------------- | --------------------- |
| Discover / Saved | Command-1 / Command-2 |
| 本地查找         | Command-F             |
| Settings         | Command-comma         |
| 显示或隐藏侧栏   | Control-Command-S     |
| 收藏当前条目     | Shift-Command-D       |
| 分析当前条目     | Shift-Command-A       |
| 丢弃当前收藏条目 | Command-Backspace     |
| 关闭弹窗         | Escape                |

View 菜单支持缩放。应用跟随系统外观，并支持提高对比度和减少透明度。原生文本控件使用标准复制、粘贴、撤销和中文输入法操作。

安装、备份和恢复见 [本地更新说明](LOCAL_UPDATE.md)，问题反馈见 [支持说明](SUPPORT.md)。
