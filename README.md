# TheRSS

TheRSS 是一个本地优先的学术信息收件箱：它把 arXiv 论文和 GitHub 项目按你的研究兴趣汇总成一份可解释的每日推荐，并允许你用自定义模型 API、Codex 或 Claude Code继续分析候选内容。

> 当前是个人测试版（v0.1.0）。arXiv 摘要、GitHub 元数据和模型输出只用于发现与初筛，不能替代全文阅读、代码审计或实验复现。

## 当前可用能力

- 配置 arXiv 分类、关键词和排除词。
- 配置 GitHub 关键词、topic 和编程语言；结果明确称为 **GitHub Interest Radar**，不冒充 GitHub 官方 Trending。
- 已配置兴趣后，每个本机日历日第一次打开会自动刷新两类来源；也可手动重试，得到去重、确定性排序的 Today 列表。
- 查看每个候选项的匹配原因，按来源筛选，并保存或忽略。
- 配置 OpenAI-compatible（包括兼容的 DeepSeek 端点）或 Anthropic-compatible 模型并生成带来源信息的分析记录。
- 通过只读 Model Context Protocol（MCP）服务向 Codex、Claude Code 或其他兼容客户端开放本地候选项。
- 在 macOS 上构建并以可回滚方式安装 `~/Applications/TheRSS Dev.app`，升级前自动备份 SQLite 数据库。

## 立即运行

要求：macOS、Node.js 24.15 以上或 Node.js 26、npm。

```bash
git clone https://github.com/dtjgp/TheRSS.git TheRSS
cd TheRSS
npm ci
npm run dev
```

第一次打开后：

1. 在 **Interests** 中设置关注方向。
2. 回到 **Today**，点击 **Refresh sources**。
3. 如需模型分析，在 **Models & Agents** 中设置协议、基础 URL、模型名和 API key。
4. 回到 **Today**，对候选项点击 **Analyze**。

API key 不会返回给渲染进程，也不会以明文写入 SQLite；应用使用 Electron `safeStorage` 加密后保存密文。远程模型地址必须使用 HTTPS，只有回环地址可使用 HTTP。

完成首次配置后，后续每天打开应用会在当天尚未刷新时自动更新一次；同一天重复打开不会产生重复启动请求。如果自动刷新失败，旧收件箱仍会保留，可用 **Refresh sources** 手动重试。

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

该命令会构建未签名应用、备份数据库、校验 Electron Framework 包结构，并原子替换 `~/Applications/TheRSS Dev.app`；旧应用会保留为带时间戳的备份。已有远程仓库后，可在干净的 `main` 工作树运行：

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

## 质量门禁

```bash
npm run check
npm run test:e2e
npm run smoke:sources
npm run smoke:credentials
npm run smoke:mcp
npm run smoke:package
npm audit --audit-level=high
```

`smoke:sources` 会访问真实 arXiv 和 GitHub，其他自动化测试使用确定性 fixture。项目要求自有代码的 statements、branches、functions 和 lines 覆盖率均不低于 80%。

## 数据与边界

- 主数据库：`~/Library/Application Support/TheRSS/therss.sqlite`
- 更新备份：`~/Library/Application Support/TheRSS/backups/`
- 安装位置：`~/Applications/TheRSS Dev.app`
- 本地数据库和密钥密文不会提交到 Git。
- Zotero 和 llm-wiki 的确认式写回属于后续版本；TheRSS 不替代 Zotero 或 Obsidian。

产品范围见 [PRODUCT.md](PRODUCT.md)，架构见 [docs/DESIGN.md](docs/DESIGN.md)，需求验收见 [docs/REQUIREMENTS_TRACEABILITY.md](docs/REQUIREMENTS_TRACEABILITY.md)。

## License

MIT
