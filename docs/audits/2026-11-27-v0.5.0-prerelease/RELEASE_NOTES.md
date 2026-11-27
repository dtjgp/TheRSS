# TheRSS 0.5.0 — 语义检索增强、llm-wiki 全链路集成与结构加固预览

这是面向 **Apple Silicon（arm64）、macOS 26 及以上**的未签名预发布版。它没有 Developer ID 签名或 Apple 公证，不能视为正式市场发行版，也不包含生产自动更新承诺。其他架构和更早的系统没有在本次下载包中验证。

## 本次变化

- **Discover 检索与排序（Wave 2）**：升级至多约束排序模型（`semantic-discover-v3`），新增原生时间范围筛选与最新优先排序控件（#106）；加固 arXiv `429`/超时退避策略（#102）。
- **llm-wiki 深度集成（Wave 3 & Wave 4B/4C）**：
  - **Discover → Daily Papers** 接入本机 `llm-wiki` 每日 arXiv 精选（#90），并支持优先读取版本化 JSON v1 导出（`ArXiv_Daily_<date>.json`，严格 Schema 校验与损坏 fail-closed），缺省时平滑回退至既有 Markdown 简报（`ArXiv_Daily_<date>.md`）（#109）。
  - **列表级状态与筛选（I5）**：Discover 与 Saved 列表通过单次有界批量只读检查显示 `llm-wiki` 归档徽标与筛选器，阅读区支持一键复检与在 Obsidian 中打开（#85、#107）。
  - **Settings › Knowledge Base 面板（P1-6）**：支持配置 `llm-wiki` 知识库路径（`env > custom > default` 优先级）、统一祖先符号链接安全校验以及带修复建议的只读诊断（#107）。
  - **非论文条目 Inbox 捕获（P1-3）**：为 GitHub 仓库、Hugging Face 模型/数据集与研究文章新增确认门控的 `llm-wiki/Inbox/` 捕获流程；预览阶段强制校验 `Automation_Runtime_Scopes.json` 中的 `therss-inbox-capture` 治理授权，写入前经原生系统弹窗二次确认并在 `automation_runtime.py` 租约保护下以 `wx` 原子创建笔记、追加 `log.md` 并写入审计 JSON 与 SQLite 回执（#109）。
  - **论文推送契约对齐**：同步 2026-11-09 vault 目录结构、独立 `log.md` 标题与阅读队列定位，移除废弃的 `index.md` 写入（#79、#94、#95、#96、#97）。
- **原生交互与搜索体验**：支持 **My sources** 默认源与单次搜索源草稿分离、SQL 层级本地搜索作用域与真实截断提示、侧栏宽度持久化恢复（#99），以及窗口重建并发与偏好读取加固（#107、#108）。
- **平台与安全**：升级至 Electron 45.3.0 与异步 `safeStorage`（含密钥轮换重加密与有序清除修复）（#84、#87、#103），完成多处热点文件模块化拆分（`native/appkit/node.mm`、`App.tsx`、`researchRepository.ts` 等）（#107、#108、#109）。

完整列表见 [CHANGELOG](../../../CHANGELOG.md)。

## 下载、校验与使用

下载 `TheRSS-0.5.0-macos-arm64-unsigned.zip`、`SHA256SUMS.txt` 和 `release-manifest.json`。在下载目录执行：

```bash
shasum -a 256 -c SHA256SUMS.txt
```

解压得到 `TheRSS.app`。升级前退出所有 TheRSS 实例，并备份现有应用和 `~/Library/Application Support/therss` 数据目录；不要同时运行不同的副本。已有的开发安装建议继续使用仓库的 `npm run update:local`，由标准安装器生成应用和数据库备份。0.5.0 对 SQLite 仅含向后兼容的增量表（`llm_wiki_inbox_receipt`），不会破坏既有数据。

未签名的下载包可能被 macOS 安全策略拦截。请查看 [Apple 关于未知开发者应用的说明](https://support.apple.com/guide/mac-help/open-a-mac-app-from-an-unknown-developer-mh40616/mac)，或者按仓库 README 从已核验的源码构建。本版本不要求关闭系统安全功能。

> 如需启用真实的非论文 `llm-wiki/Inbox/` 写入，需在你的 `llm-wiki` 仓库 `System/Configs/Automation_Runtime_Scopes.json` 中显式注册 `therss-inbox-capture`（`lock_scopes: ["Automation_Conversations", "Inbox", "log.md"]`）；未注册时应用将保持 fail-closed 安全拦截，不会写入知识库。

## 验证与已知限制

- 代码基线通过 157 文件 / 1,154 项主测试（覆盖率 92.49% 语句 / 84.24% 分支 / 95.62% 函数 / 94.70% 行）、44 文件 / 252 项 AppKit 专项测试、Playwright 桌面 E2E 11/11、Native AppKit 17 组工作流、AppKit 20 组控件验收与 MCP stdio 冒烟；`npm audit --audit-level=high` 报告 0 个高危/严重漏洞。
- 打包归档已在隔离资料目录中完成解压一致性校验、符号链接校验与 `npm run smoke:package`（Web 启动 + 17 组原生工作流）。完整校验哈希与 CI 记录见随附的 `release-manifest.json` 和 [验收报告](REPORT.md)。
- 物理键鼠/VoiceOver 人工走查、真实论文推送实测（`P0-1`）以及 Developer ID 签名、公证和同身份自动升级仍不在本自动化预发布范围内。

问题反馈请使用 [GitHub Issues](https://github.com/dtjgp/TheRSS/issues)；敏感问题请使用 [私密安全报告](https://github.com/dtjgp/TheRSS/security/advisories/new)，不要提交 API key、私人研究记录或数据库。
