# TheRSS Apple 原生体验与产品能力审计

审计日期：2026-08-18

## 0. 结论

TheRSS 已经形成了清晰、可信的本地学术发现产品：核心信息架构成立，Today/Saved 的列表—详情工作区、macOS 隐藏式标题栏、侧栏材质、系统字体、浅深色语义色和证据边界均是正确方向。

但当前只能称为“视觉上接近 macOS”，还不能称为“交互上完整贴合 macOS”。主要差距不在装饰，而在系统命令、设置窗口、分栏操作、状态恢复、撤销、键盘焦点、动态系统外观和可访问性。开始增加大功能之前，应先修复这些核心体验与状态正确性问题。

## 1. 审计范围与证据

### 产品目标

单用户每天打开一个本地应用，获得可解释的 arXiv 论文与 GitHub 仓库收件箱，完成阅读、保存、忽略和显式深度分析；Discover 承担一次性语义扩展检索，Zotero/Obsidian 继续拥有长期文献与知识管理。

### 固定边界

- 单用户、本地优先、SQLite 为运行时事实来源。
- 当前版本无账户登录和云同步。
- 摘要、仓库元数据和模型输出仅是发现或派生证据。
- 分析必须由用户触发并保留 provider/runner、model、prompt version、source hash 和时间戳。
- 不把 TheRSS 扩展成 Zotero、Obsidian、通用新闻阅读器或自动科研写作工具。

### 当前证据

- 产品与工程契约：`PRODUCT.md`、`GOALS.md`、`docs/ROADMAP.md`、`docs/DESIGN.md`、`docs/ENGINEERING_PRACTICES.md`、`docs/REQUIREMENTS_TRACEABILITY.md`。
- 当前实现：Electron main/preload、React renderer、SQLite repositories、renderer/Electron tests 和样式系统。
- 官方对照：Apple Human Interface Guidelines 的 macOS、Sidebars、Split views、Settings、Keyboards、Focus and selection、Accessibility；Electron 当前 Menu、Keyboard Shortcuts、BrowserWindow 文档；WCAG 2.2 对比度与焦点规则。
- 本轮截图：用户已授权并完成项目现有 Playwright Electron fixture；改动前与最终版均覆盖 onboarding、Interests、Today light/dark、Models、Discover 和 Data Analytics，14 张 before/after 与 7 张最终截图均已逐张检查。

## 2. 当前流程健康度

1. **首次启动与 Onboarding — 基本健康**
   - 核心动作明确，来源和 local-first 边界可见。
   - 编辑感很强，但浅色模式的辅助文字与彩色小号标签存在对比度风险。

2. **Interests — 功能健康，平台归属不完整**
   - 字段分组、标签和校验方向正确。
   - 它本质上是设置，不应长期与 Today/Saved 作为同级内容目的地；离开页面也没有未保存修改保护。

3. **Today — 视觉结构强，状态语义存在高优先级缺口**
   - 列表—详情结构适合研究筛选，match reasons 和 evidence boundary 清楚。
   - 选中 `new` 记录不会变成 `viewed`，所以 unread 数量不代表真实阅读活动。
   - Dismiss 立即移除且没有 Undo；全局字母快捷键可能在错误焦点上下文触发。

4. **Saved — 核心能力健康，选择恢复不完整**
   - arXiv/GitHub 共用一个保存架是正确边界。
   - 删除当前选中项后，详情回退到第一条但列表没有选中高亮，形成视觉与状态不一致。

5. **Discover — 检索契约健康，交互风格割裂**
   - bounded plan、来源结果、provenance 和 complete/partial/failed/no-results 区分优秀。
   - 结果仍使用大卡片网格，与 Today/Saved 的列表—详情、快捷键和保存行为不一致。

6. **Models & Agents — 安全边界健康，配置闭环不完整**
   - 密钥不回传 renderer，HTTPS/loopback 限制和本地 CLI 状态正确。
   - 缺少 Test Connection、明确的替换/清除凭据动作和成功反馈；这也更适合作为 Settings pane。

7. **Data Analytics — 证据表达健康**
   - Today/Discover 分开、returned records 与 unique discoveries 分开、历史起点透明。
   - 日期显示未完全本地化；页面视觉语言比 Today 更像仪表板，但尚不构成阻断。

8. **macOS Window / Menu / Keyboard — 部分健康**
   - 隐藏式标题栏、侧栏 vibrancy、窗口缩放和全屏基础能力已存在。
   - 只有 Electron 默认菜单，没有 TheRSS 命令；没有 `Command-,` Settings、View > Show/Hide Sidebar、Refresh、导航、Save/Dismiss/Analyze 菜单项。
   - 侧栏、信号列表和详情之间不能拖动分隔线，也不恢复窗口/分栏状态。

## 3. 严格问题清单

| ID  | 优先级 | 类型       | 已确认问题                                               | 用户影响                                     | 推荐修复                                                                            |
| --- | ------ | ---------- | -------------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------- |
| N1  | P0     | 产品正确性 | 打开 `new` 项不会更新为 `viewed`                         | unread 指标失真，生命周期未闭环              | 在明确选择/阅读后更新 viewed；增加 Unread 过滤和 Mark Unread                        |
| N2  | P0     | 可恢复性   | Dismiss 无 Undo 或恢复入口                               | 一个按键即可永久隐藏记录                     | 实现最近一次 triage Undo，并接入 Edit > Undo；后续可加 Recently Dismissed           |
| N3  | P0     | 原生命令   | 仅有 Electron 通用默认菜单                               | 功能不可从菜单发现，标准快捷键缺失           | 定义原生 App/Edit/View/Window 菜单与 renderer command bridge                        |
| N4  | P0     | 状态真实性 | `sourceHealth` 未显示，侧栏始终绿点                      | partial/failed/stale 被伪装成健康            | 显示每个来源状态、上次成功时间和重试入口；状态点绑定真实快照                        |
| N5  | P0     | 分析连续性 | renderer 不调用已有 `getLatestAnalysis`                  | 重启或切换后无法重新查看已持久化分析         | 选中条目时读取最新分析；显示 stale/source-hash 状态和分析历史入口                   |
| N6  | P0     | 无障碍     | 全局 Arrow/S/D/A 不限定 workspace，焦点不跟随选择        | 键盘与辅助技术用户可能触发意外操作或失去位置 | 使用焦点明确的 listbox/roving tabindex 或范围化命令；菜单公开快捷键                 |
| N7  | P0     | 无障碍     | 小号辅助文字和多种浅色 accent 未达到 4.5:1               | 9–12 px 文本可读性不足                       | 将语义色拆成 decorative accent 与 readable foreground；增加 `prefers-contrast` 契约 |
| N8  | P0     | 响应式状态 | 920 px 以下 CSS 强制折叠但 React 状态不变                | Show/Hide 文案和真实状态冲突，图标无 tooltip | 用单一状态源驱动自动折叠；在窄窗口提供可临时展开的 sidebar                          |
| N9  | P1     | Settings   | Interests/Models 占据主导航且无 `Command-,`              | 与 macOS 心智模型不一致，主导航偏重          | 合并成独立 Settings window/panes；Onboarding 可继续引导到对应 pane                  |
| N10 | P1     | Split view | pane 宽度固定且不可拖动/恢复                             | 无法适配长标题和个人工作习惯                 | 使用可拖动 divider，持久化 sidebar/list width、可见状态和 window bounds             |
| N11 | P1     | 窗口状态   | `visualEffectState` 固定为 `active`                      | 非活动窗口仍像前台窗口                       | 改为 `followWindow`，补 inactive CSS/视觉测试                                       |
| N12 | P1     | 一致性     | Discover 卡片与 Today/Saved workspace 分裂               | 同一类来源记录有两套浏览与保存方式           | 复用列表—详情组件，Discover 额外保留 plan/provenance inspector                      |
| N13 | P1     | 表单反馈   | 错误没有一致 live region；字段无 `aria-invalid`/描述关联 | 错误恢复依赖视觉查找                         | 建立 FormField/ErrorSummary，聚焦第一个错误并宣布状态                               |
| N14 | P1     | 选择状态   | Saved 移除选中项后 detail/list selection 不一致          | 用户不知道当前详情对应哪一行                 | items 变化后同步 selected id 和 DOM focus；加回归测试                               |
| N15 | P1     | 系统偏好   | sidebar 使用固定 per-view icon 色                        | 与用户系统 accent 预期不一致                 | sidebar 统一使用系统/用户 accent；per-view 色只用于内容语义                         |
| N16 | P2     | 工程治理   | 1,859 行单一 CSS，已有重复声明                           | 视觉修复容易互相覆盖                         | 拆成 tokens/shell/workspace/settings/discover/analytics 并增加视觉契约              |

## 4. 对比度与动态外观证据

以下值按当前 CSS token 与白色内容表面计算；多数使用位置为 9–12 px，不属于大号文字：

| 前景                | 对比度 | 判断       |
| ------------------- | -----: | ---------- |
| 60% secondary label | 3.44:1 | 不足       |
| system blue         | 4.02:1 | 小文本不足 |
| system teal         | 2.57:1 | 不足       |
| system cyan         | 2.54:1 | 不足       |
| system green        | 2.22:1 | 不足       |
| saved gold          | 3.65:1 | 小文本不足 |

Apple 系统颜色在原生控件中是动态颜色；把名称和固定 hex 搬到 CSS，并不会自动继承 Increase Contrast、用户 Accent Color、非活动窗口或系统材质行为。因此应保留当前语义 token 思路，但把“装饰色”和“可读文本色”分开，并从 Electron main 显式桥接需要的系统状态。

## 5. 产品能力判断

### 现在就应该补齐

1. **持久化分析重开与 stale 状态**
   - 不是扩张产品，而是把已存储的 `AnalysisArtifact` 真正交还给用户。
   - 需要：latest/history、source-hash 比较、stale 标签、重新分析入口。

2. **本地统一搜索（`Command-F`）**
   - 搜索 Today、Saved、Discover snapshot 和分析元数据；默认不搜索远端、不调用模型。
   - 第一版可只做 SQLite FTS/受限字段查询、source/state/date 过滤，不做语义向量库。

3. **Provider Test Connection**
   - 对保存前配置执行显式、受限、无秘密回显的连通性测试，并区分 DNS、认证、模型不存在、超时和协议不兼容。

4. **原生 Copy/Share 命令**
   - 右键菜单和菜单栏提供 Open in Browser、Copy Link、Copy Citation/Metadata；避免把这些动作塞进更多常驻按钮。

### 修复 P0 后再开发

5. **确认式 Zotero / Obsidian promotion**
   - 只发送用户选中的来源元数据、链接和可选分析引用；不在 TheRSS 内复制笔记系统。
   - 每次写入须明确目标、预览内容、确认和结果状态。

6. **Recently Dismissed / Triage history**
   - 先实现单步 Undo，再考虑有限时间窗口的恢复视图；不需要复杂回收站系统。

### 继续推迟

- **后台关闭时刷新与通知**：先完成跨请求缓存、arXiv/GitHub cooldown、失败退避和用户可控时间窗。
- **学习式推荐**：先保证 viewed/saved/dismissed 数据正确，再设计可解释、可关闭、可回滚的学习。
- **签名自动更新**：等待有效 Developer ID、notarization 和同身份版本升级证据。
- **账户、云同步、社交推荐**：与当前明确的 local-first/no-login 决策冲突，除非用户重新授权产品方向。
- **通用笔记、标签体系、自动论文写作**：会与 Zotero/Obsidian 重叠或越过发现证据边界，不建议加入。

## 6. 推荐实施顺序

### Phase A — Native correctness

- 原生菜单与 command bridge；Settings window；`followWindow`。
- Read/Unread、Dismiss Undo、selection/focus 修复。
- source health 与最新分析恢复。
- 对比度、live regions、field errors、narrow-window 状态修复。

### Phase B — Native workspace

- 可拖动并持久化的 sidebar/list/detail 分栏。
- Discover 复用列表—详情工作区。
- window/view/sidebar/pane restoration。
- 右键菜单、Copy Link/Citation、Provider Test Connection。

### Phase C — Focused capability growth

- 本地统一搜索。
- analysis history 与 stale-analysis hardening。
- 确认式 Zotero/Obsidian promotion。

## 7. 完成标准

- 所有高频命令可从原生菜单发现，并有一致快捷键。
- 完整键盘路径不会依赖全局裸字母监听；焦点和视觉选择一致。
- unread、dismissed、source health、analysis stale 均由真实持久状态驱动。
- 浅色/深色/Increase Contrast/Reduce Motion/窗口 inactive 状态有可执行测试或截图证据。
- 820 px 最小窗口到常用大窗口均无错误折叠、裁切或不可操作控件。
- 单元、集成、renderer、Electron E2E、自动可访问性检查和 package smoke 通过。
- 当前 local-first、no-login/no-sync、evidence-boundary 和 Zotero/Obsidian 非替代边界保持不变。

## 8. Phase 19 实施结果

本轮已完成 P0 原生正确性切片，但不把尚未交付的 P1 能力包装成完成：

- **已完成**：N1 Read-on-selection、N2 最近一次 triage Undo、N3 TheRSS 原生菜单与 typed command bridge、N4 真实分来源 health 及诚实汇总、N5 匹配当前条目的 persisted latest analysis 恢复、N6 workspace-scoped 快捷键与 roving focus、N7 可读 semantic foreground 与 live roles、N8 sidebar 单一受控状态、N11 `followWindow`、N14 选择/焦点恢复。
- **部分完成**：N5 尚无 analysis history/stale hash UI；N7 尚无自动 accessibility scan 和 Increase Contrast 专项桥接；N13 已补全全局/form error 与 loading/status announcement，但字段级 `aria-invalid`/`aria-describedby` 仍需随表单组件化完成。
- **仍待开发**：独立 Settings window 与 unsaved-change protection、可拖动/持久化 split view、window/view/pane restoration、Discover 统一 list-detail、Provider Test Connection、本地 `Command-F` 搜索、右键 Copy/Open 命令、analysis history/stale hardening。
- **验证结果**：`npm run check` 通过 27 个测试文件 / 141 个测试；覆盖率为 Statements 93.55%、Branches 84.10%、Functions 93.95%、Lines 95.74%。Electron fixture 最终 1/1 通过（5.2 秒），并确认被动 read 不显示 HUD、triage HUD 不跨视图泄漏；7 张最终截图无裁切/错位/深色模式阻断。生产依赖审计为 0 vulnerabilities；最终安装版 packaged-app smoke 通过。
- **发布边界**：本地开发安装仍为 unsigned personal beta。有效 Developer ID、notarization 和同身份升级验证仍是公开分发前置门槛。
