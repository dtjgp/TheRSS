# Agent setup

TheRSS 提供一个本地 stdio MCP 服务，让 Codex 和 Claude Code读取同一份候选项与分析上下文。该服务不访问模型密钥，并使用 SQLite 只读连接。

## 前置检查

```bash
cd /Users/dtjgp/Projects/TheRSS
npm run build:mcp
npm run smoke:mcp
```

默认数据库为：

```text
/Users/dtjgp/Library/Application Support/TheRSS/therss.sqlite
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

当前版本有意不提供 MCP 写工具。未来 Zotero/llm-wiki 写回必须另行设计预览、精确目标和用户确认。
