# Agent setup

TheRSS 提供一个本地 stdio MCP 服务，让 Codex 和 Claude Code读取同一份候选项与分析上下文。该服务不访问模型密钥，并使用 SQLite 只读连接。

应用内的 `Analyze with` 还可以直接启动本机已经安装并登录的 Codex CLI 或 Claude Code。它每次创建一个新的受限非交互进程，不会接管已经打开的交互会话。

默认会检查 `PATH`、常见 macOS 安装目录和 NVM。GUI 应用无法发现自定义位置时，可以在启动 TheRSS 前设置绝对路径：

```bash
export THERSS_CODEX_PATH=/absolute/path/to/codex
export THERSS_CLAUDE_PATH=/absolute/path/to/claude
```

在 `Models & Agents` 页面可查看 `detected` 状态；检测成功只表示可执行文件存在，最终调用仍依赖对应 CLI 已经完成登录。

## 前置检查

```bash
cd /Users/dtjgp/Projects/TheRSS
npm run build:mcp
npm run smoke:mcp
```

默认数据库为：

```text
/Users/dtjgp/Library/Application Support/therss/therss.sqlite
```

如果要连接测试数据库，可向 MCP 进程设置 `THERSS_DB_PATH`。

## Codex

Codex 官方支持通过 `codex mcp add <name> -- <stdio command>` 注册本地 stdio 服务：

```bash
codex mcp add therss -- node /Users/dtjgp/Projects/TheRSS/out/mcp/stdio.js
codex mcp list
```

也可在 `~/.codex/config.toml` 中手动配置：

```toml
[mcp_servers.therss]
command = "node"
args = ["/Users/dtjgp/Projects/TheRSS/out/mcp/stdio.js"]
```

官方参考：<https://developers.openai.com/codex/mcp/>

## Claude Code

Claude Code 的 stdio 配置使用 `--` 分隔 Claude 参数和服务命令：

```bash
claude mcp add --transport stdio --scope user therss -- \
  node /Users/dtjgp/Projects/TheRSS/out/mcp/stdio.js
claude mcp list
```

官方参考：<https://code.claude.com/docs/en/mcp>

## 工具与证据边界

| 工具                   | 返回内容                                  | 写权限 |
| ---------------------- | ----------------------------------------- | ------ |
| `list_today_items`     | 排序后的每日论文/项目，可按来源和数量过滤 | 无     |
| `get_item`             | 一个候选项及确定性匹配原因                | 无     |
| `get_analysis_context` | 候选项、最近一次模型分析和显式证据边界    | 无     |

推荐提示词：

```text
先用 therss 的 list_today_items 查看今天的候选项。选出与边缘智能和模型压缩最相关的 3 项，逐项调用 get_analysis_context。明确区分元数据所支持的事实、模型推断和仍需阅读全文或审计源码验证的问题。
```

当前版本有意不提供 MCP 写工具。llm-wiki 论文推送只存在于桌面应用的显式
`preview -> confirm` 交互中，不会因 Codex/Claude 连接了 TheRSS MCP 而获得写权限；Zotero
写回仍未实现。

## llm-wiki 论文推送

默认 vault 路径为 `~/Obsidian/llm-wiki`。如实际位置不同，请在启动 TheRSS 前设置绝对路径：

```bash
export THERSS_LLM_WIKI_PATH=/absolute/path/to/llm-wiki
```

本功能还要求：

- Codex CLI 已安装并登录；
- `pdfinfo` 与 `pdftotext` 可执行；
- vault 的 `System/Configs/Automation_Runtime_Scopes.json` 已注册
  `therss-paper-promotion`，覆盖 `Automation_Conversations`、`Literature/Paper_Notes`、
  `Topics`、`Methods`、`raw/papers`、`raw/paper_records`、`index.md` 与 `log.md`；这两个知识图谱
  目录的持久 writer-scope 扩展必须由 vault 所有者显式授权，否则 live preview 会 fail closed；
- vault 的 AGENTS、schema、paper-ingest SOP、write-governance、L1/L2 templates 与三个索引文件
  均为可读取的普通文件。

首次点击只在临时目录下载/核验 PDF、运行只读 Codex 分析并显示精确相对路径；只有 renderer
确认并通过 Electron main 的原生确认后，才会获取 vault writer lease 并落盘。自动化测试使用
fixture adapter，不访问网络、Codex 或真实 vault。
