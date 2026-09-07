# TheRSS

使用入口：[使用说明](docs/USER_GUIDE.md) · [隐私](docs/PRIVACY.md) · [支持与恢复](docs/SUPPORT.md) · [正式发布验证](docs/MARKET_RELEASE.md)。

0.3.0 已加入稳定操作反馈、窄窗单栏阅读、精确本地记录跳转和完整应用包升级校验。当前处于市场发布验收阶段；Developer ID 签名、公证及签名后继包验证尚未完成，未签名包仍属于本机测试分发。

TheRSS 是一个本地优先的研究发现桌面应用：你可以用自然语言描述研究问题，让自定义模型、Codex 或 Claude Code 生成可检查的语义扩展计划，再由 TheRSS 在 22 个通过日期化部署验证的信息源中执行受控检索、筛选和排序。

> 当前是个人测试版（v0.2.0）。arXiv 摘要、GitHub 元数据和模型输出只用于发现与初筛，不能替代全文阅读、代码审计或实验复现。

![TheRSS Discover：本地优先的语义研究检索桌面](docs/images/therss-discover.png)

## Apple-native 界面

macOS 26 及以上默认使用完整 AppKit 界面：Discover、Saved、Settings、Sources、Data Analytics、搜索与写入确认弹窗均由原生控件承载。NSTableView、NSTextView、NSSplitView 和 NSScrollView 负责列表、富文本、布局与滚动；NSSecureTextField 处理新输入的密钥。工作界面没有可见 HTML/CSS，也不依赖 DOM 测量。Electron 保留应用进程和既有业务服务。

应用图标使用用户选定的单色研究文档版本。原始图稿、1024px RGBA 打包母版和 Electron Builder 输入分别保留，打包后的 ICNS 已通过 macOS 系统解码器的 16、32 和 256px 检查。

<img src="assets/brand/therss-icon-v6-mono-selected.png" alt="TheRSS 单色研究文档应用图标" width="144" />

## 当前可用能力

- 在 **Discover** 中输入自然语言研究问题，选择自定义模型、Codex 或 Claude Code 生成受限、可检查的扩展计划。
- 在 **Settings** 的 Personal context pane 中保存本机 Personal Prompt；Discover 会将它作为辅助上下文，但当前问题始终是主指令。
- 从当前 22 个已验证信息源中全选或逐项选择。arXiv/GitHub 执行定向查询；Hugging Face 与 19 个固定 RSS/HTML 来源先获取有界近期内容，再由 TheRSS 本地确定性筛选。
- 来源选择默认收起并显示确切选中数；搜索完成后先展示全宽排名结果，再按需展开检索计划、模型溯源和 22 个来源的独立状态。
- 搜索期间显示 planner 阶段和真实的逐来源完成数；可取消悬挂任务，并只重试 failed、partial 或 canceled 来源，不会再次调用 planner 或重跑成功来源。
- 按论文、GitHub 仓库或其他记录类型筛选结果；只有显式保存后才进入 **Saved**。
- 在 **Data Analytics** 中分别查看 lifetime returned records、最近 7 个本机日历日的返回记录量、保留的历史 Today 统计，以及做过深度分析的内容和所用模型/本地代理；可重开历史 artifact，并看到 current/stale 来源哈希状态。
- 使用 **⌘F / Find Local Research** 搜索本机 SQLite 中的 Saved、Discover 会话和 analysis 内容；该流程不调用模型、来源适配器或网络。
- 在 **Sources** 中浏览和筛选同一组 22 个保留来源（A=7、B=15、C=0）；目录成员资格、日期化验证、当前记录健康和本机缓存时间分别表达。
- 在 **Settings** 配置 OpenAI-compatible（包括兼容的 DeepSeek 端点）或 Anthropic-compatible 模型；保存前可以显式测试连接，并可明确替换或清除受保护凭据。
- 对符合条件的 arXiv 论文使用 **Promote to llm-wiki**：TheRSS 先下载发现记录对应的精确版本 PDF，调用本地 Codex 生成全文分析并展示目标路径预览；只有用户再次确认后，才按照 vault 的治理规则写入 PDF、来源 sidecar、L2 论文笔记、Topic/Method 反向链接和审计记录。
- 通过只读 Model Context Protocol（MCP）服务向 Codex、Claude Code 或其他兼容客户端开放本地候选项。
- 所有 Discover 会话、Saved 状态和分析记录仅保存在本机；当前不提供账号登录或跨设备同步。
- 控件、文本选区和焦点环跟随系统设置中的强调色（System Settings > Appearance），并在用户更改时实时更新；各视图自身的标识色（Discover 蓝、Saved 琥珀、Sources 青、Analytics 靛）保持不变。
- 菜单栏提供 macOS 标准命令：Help 菜单、View 缩放（⌘0/⌘+/⌘-）、Dismiss Selected（⌘⌫）；Save Selected 改用 ⇧⌘D，把 ⌘S 让回给系统通用的“保存”语义。
- 界面统一使用 macOS Apple 系统字体：正文与控件使用 SF Pro Text，展示标题使用 SF Pro Display；应用不再打包第三方字体文件。
- 顶部上下文状态区根据当前页面显示一组紧凑、带文本标签的本地状态：Discover 展示 22 个来源的记录健康，Saved 展示保存数与当前来源过滤，Analytics 明确标注 local-only/no-telemetry，Sources 展示需要关注的来源数，Settings 保留未保存修改提醒；它不新增后台轮询或第二套状态存储。
- 侧栏可以折叠，并支持鼠标拖动或键盘在 184–360 pt 范围内调整宽度；窄窗口自动约束显示宽度，放大后恢复偏好。五个工作区、来源状态和布局控制始终可达。
- Sources 使用紧凑的列表—详情工作区：筛选、选择、来源元数据、部署验证、记录健康、近期内容和失败边界可以并排检查，窄窗口下仍保持可用。
- 原生界面支持明暗外观、高对比度与降低透明度分支、80%–150% 字体缩放；最小窗口在内容不足时使用 AppKit 滚动。SQLite、来源适配器和证据状态契约保持一致。
- 在 macOS 上构建并以可回滚方式安装 `~/Applications/TheRSS Dev.app`，升级前自动备份 SQLite 数据库。

## 立即运行

要求：macOS、Node.js 24.15 以上或 Node.js 26、npm；构建原生材质模块需要提供 NSGlassEffectView 的 macOS 26+ SDK。模块按构建机架构编译。

```bash
git clone https://github.com/dtjgp/TheRSS.git TheRSS
cd TheRSS
npm ci
npm run dev
```

第一次打开后：

1. 在 **Settings** 中按需保存 Personal Prompt，并设置自定义 API 的协议、基础 URL、模型名和 API key；先运行 **Test connection** 再保存。已登录的 Codex 或 Claude Code 也可直接作为本地 runner。
2. 在 **Discover** 中输入研究问题；默认会搜索全部 22 个来源，按需展开来源选择器缩小范围。
3. 选择 runner 后执行扩展搜索；先检查排名结果与匹配原因，再展开 **Search details** 查看计划、溯源和逐来源状态。
4. 把需要继续阅读的记录显式加入 **Saved**，并在条目详情中按需执行分析。
5. 对准备进入知识库的 arXiv 论文点击 **Promote to llm-wiki**；先审阅全文分析等级、blocker 和目标路径，确认无误后再执行本地写入。
6. 在 **Data Analytics** 中区分 lifetime returned records、最近 7 个本机日历日的返回记录量和深度分析记录；点击历史条目可重开原始 artifact 并检查 freshness。
7. 使用 **⌘F** 在本机统一搜索 Saved、Discover 和分析证据。
8. 在 **Sources** 中按名称、优先级、完整研究方向或记录健康检查已部署来源及其近期内容。

API key 不会返回给渲染进程，也不会以明文写入 SQLite；应用使用 Electron `safeStorage` 加密后保存密文。远程模型地址必须使用 HTTPS，只有回环地址可使用 HTTP。

应用不会在启动时隐式发起 22 个来源请求。每次外部检索都由 Discover 中的显式操作触发；失败不会删除上一轮会话或 Saved 数据。

## 0.3.0 预发布下载

[GitHub v0.3.0 预发布](https://github.com/dtjgp/TheRSS/releases/tag/v0.3.0) 提供 Apple Silicon（arm64）、macOS 26+ 的未签名 ZIP、SHA-256 校验文件及包清单。下载包不包含 Developer ID 签名或公证，可能被 macOS 安全策略拦截；安装、升级备份及限制见 [发布说明](docs/audits/2026-09-07-public-prerelease/RELEASE_NOTES.md)。它不是已通过正式市场发行验收的版本。

## 当前验证状态（2026-09-07）

- 主测试 687 项、AppKit 专项 104 项（套件有重叠），桌面 E2E 8 个流程通过；包及安装后的原生工作流各通过 14 组。默认原生入口没有可见 Web 页面。
- 覆盖搜索、22 个来源、保存/撤销、论文及仓库分析、双设置草稿与密钥顺序、原生搜索/写入弹窗、中文组合输入、焦点恢复、关闭重开、布局持久化，以及 820×600 下的 150% 字体。
- 富文本使用原生段落和表格；异常表格或超出样式预算时保留完整纯文本，避免不可信内容放大原生对象分配。深色侧栏截图已单独复审。
- `npm run check` 同时执行主测试套件与 AppKit 专项覆盖率门槛；Objective-C++ 由原生构建和真实控件测试验证，不使用 TypeScript 覆盖率代替。
- `THERSS_UI=web` 显式切回保留的兼容界面。旧 DOM、材质层和 `THERSS_NATIVE_GLASS` 测试仅验证该兼容路径。CI 运行原生行为检查；本地交付另外要求真实窗口截图和视觉检查。
- 本轮使用临时数据目录与确定性 fixtures；没有实时来源/模型调用，没有写入真实 llm-wiki。最近真实来源复检仍保持其原日期边界。
- GitHub 以 unsigned pre-release 方式分发；Apple 签名、公证和同身份自动更新仍未验收。发布包排除早期界面试验文件。

最新交互与来源反馈见 [当前验收](docs/audits/2026-09-07-apple-design-status/REPORT.md)。范围、架构、测试与截图见 [完整 AppKit 迁移审查](docs/audits/2026-09-06-full-appkit/audit.md) 和 [ADR 0011](docs/decisions/0011-complete-appkit-interface.md)。此前的 [原生材质迁移](docs/audits/2026-09-05-native-glass/audit.md) 和 [滚动修复](docs/audits/2026-09-06-native-scroll/audit.md) 是兼容路径的历史记录。

## 模型配置示例

| 场景                | 协议                 | 基础 URL 示例                                           | 模型示例                   |
| ------------------- | -------------------- | ------------------------------------------------------- | -------------------------- |
| OpenAI-compatible   | OpenAI-compatible    | `https://api.openai.com/v1`                             | 供应商支持的模型名         |
| DeepSeek-compatible | OpenAI-compatible    | `https://api.deepseek.com` 或供应商文档指定的 `/v1` URL | `deepseek-chat`            |
| Anthropic           | Anthropic-compatible | `https://api.anthropic.com`                             | 供应商支持的 Claude 模型名 |
| 本机服务            | OpenAI-compatible    | `http://127.0.0.1:11434/v1`                             | 本机服务提供的模型名       |

模型端点和模型名可能变化，请以供应商当前文档为准。TheRSS 会为 OpenAI-compatible 地址追加 `/chat/completions`，为 Anthropic-compatible 地址追加 `/v1/messages`。

## 安装与快速更新

开发时使用热更新：

```bash
npm run dev
```

构建并安装个人测试版：

```bash
npm run install:local
```

该命令会获得本机安装锁、构建未签名应用、备份并校验数据库、校验 Electron Framework 与 `app.asar` 哈希，并原子替换 `~/Applications/TheRSS Dev.app`；旧应用会保留为带时间戳的备份，成功后在 Application Support 中写入结构化回执。同一构建默认拒绝重复安装，确需演练时显式运行 `npm run install:local -- --force`。已有远程仓库后，可在干净的 `main` 工作树运行：

```bash
npm run update:local
```

它只允许 fast-forward 拉取，然后恢复锁定依赖、执行完整质量门禁，再重新安装。详细恢复流程见 [docs/LOCAL_UPDATE.md](docs/LOCAL_UPDATE.md)。

个人开发和本机测试**不需要**加入每年 99 美元的 Apple Developer Program。未签名应用可能触发 Gatekeeper；如确认应用是你刚刚从本项目构建的，可在 Finder 中右键应用并选择“打开”。不要全局关闭 Gatekeeper。面向他人的稳定自动更新需要 Developer ID 签名与公证。

## 连接 Codex / Claude Code

先运行一次 TheRSS 并构建 MCP 服务：

```bash
npm run build:mcp
npm run smoke:mcp
```

随后按 [docs/AGENT_SETUP.md](docs/AGENT_SETUP.md) 配置。当前 MCP 服务只暴露三个只读工具：`list_today_items`、`get_item` 和 `get_analysis_context`；它以只读模式打开本地 SQLite，不提供修改 triage、写回知识库或读取模型密钥的能力。

## 数据库是否需要单独搭建？

不需要。TheRSS 使用随桌面应用运行的本地 SQLite，不需要 PostgreSQL/MySQL、Docker、云数据库或手动执行建表 SQL。

- 第一次启动桌面应用时，Electron 主进程会打开 `app.getPath('userData')/therss.sqlite`；文件不存在时由 `better-sqlite3` 自动创建。
- `ResearchRepository` 随后在事务中执行 `CREATE TABLE IF NOT EXISTS` 和版本兼容迁移，并在迁移后检查外键完整性。
- 已有数据库会在新版本第一次启动时自动迁移；`npm run install:local` 在替换应用前会生成可回滚备份。
- MCP 服务刻意以只读方式连接，不负责创建或迁移数据库。因此配置 MCP 前只需先正常打开一次 TheRSS。

日常使用不需要维护数据库进程。只有迁移设备、手工恢复或排障时，才需要直接处理 SQLite 文件。

## 质量门禁

```bash
npm run check
npm run test:e2e
npm run smoke:sources
npm run smoke:configured-sources
npm run smoke:credentials
npm run smoke:mcp
npm run smoke:package
npm audit --audit-level=high
```

`smoke:sources` 与 `smoke:configured-sources` 会访问真实来源，其他自动化测试使用确定性 fixture。项目要求覆盖率统计范围（`src/core` 与 `src/shared`）的 statements、branches、functions 和 lines 均不低于 80%，该阈值由 `vitest.config.ts` 强制。

## 数据与边界

- 主数据库：`~/Library/Application Support/therss/therss.sqlite`
- 更新备份：`~/Library/Application Support/therss/backups/`
- 安装位置：`~/Applications/TheRSS Dev.app`
- 本地数据库和密钥密文不会提交到 Git。
- 当前版本没有账号登录或云同步入口；更换设备时不会自动迁移本机状态。
- Discover 只让所选模型/本地代理生成受限检索计划；实际外部请求由固定主机、限时限量的 TheRSS 数据源适配器执行。模型输出与源元数据仍是发现证据，不代表全文或代码已经验证。
- “搜索全部 22 个来源”不等于全网或完整历史搜索：固定 feed/API 来源只提供各适配器的有界近期窗口，再接受本地语义筛选。
- Data Analytics 完全读取本地 SQLite，不发送遥测。“搜索结果量”统计每次已完成搜索返回的记录；历史 Today 数据被保留但不会被推测或改写成 Discover。
- Sources 是随应用发布的 22-source 只读目录；原始 105-entry catalog 仅作为休眠版本元数据保留，不代表其余来源已经部署。
- llm-wiki 写回已经实现为本地主进程拥有的确认式能力：预览失败或校验不通过时不会写入 vault；Zotero 写回仍未集成。TheRSS 不替代 Zotero 或 Obsidian。

产品范围见 [PRODUCT.md](PRODUCT.md)，架构见 [docs/DESIGN.md](docs/DESIGN.md)，需求验收见 [docs/REQUIREMENTS_TRACEABILITY.md](docs/REQUIREMENTS_TRACEABILITY.md)。
llm-wiki 推送的证据等级、路径事务和回滚规则见 [docs/capabilities/llm-wiki-paper-promotion.md](docs/capabilities/llm-wiki-paper-promotion.md)。

## License

MIT
