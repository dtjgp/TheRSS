# 0.5.0 未签名预发布验收

用户在 2026-11-27 授权完成所有非 Deferred 项并发布 `v0.5.0` 未签名预发布版及更新本机 `~/Applications/TheRSS Dev.app`。本次目标是 `v0.5.0`、Apple Silicon（arm64）、macOS 26+ 的 unsigned pre-release，保留此前的签名/公证延期决定。发布说明见 [RELEASE_NOTES.md](RELEASE_NOTES.md)。

## 范围

`v0.5.0` 包含 `v0.4.0` 之后合并到 `main` 的 PR #71–#109（含 Electron 45.3.0 与异步 `safeStorage`、Daily Papers 接入与版本化 JSON v1 契约、`semantic-discover-v3` 与原生时间/排序控件、Discover/Saved 列表级 `llm-wiki` 徽标与筛选、Settings Knowledge Base 面板、P1-3 非论文 `llm-wiki/Inbox/` 捕获、热点拆分与窗口重建加固、arXiv 429 韧性与依赖安全更新），以及本 PR 的版本号和文档改动。本 PR 只修改 `package.json`、`package-lock.json` 版本号与发布文档，不修改运行时源码、依赖、数据库或签名策略。

## 候选包验证（2026-11-27，Apple Silicon arm64，macOS）

候选树是 `main` `eada4339c9b717af7d8869b3081561115c60f1fb` 加上本 PR 的版本号与发布文档改动。

- `npm run check`：157 文件 / 1,154 项主测试（覆盖率：语句 92.49%、分支 84.24%、函数 95.62%、行 94.70%）、44 文件 / 252 项 AppKit 专项测试（覆盖率：语句 89.95%、分支 84.14%、函数 87.46%、行 92.38%）全部通过；架构（`<= 800` 行）、格式、Lint、类型检查与全量构建全部通过。
- `npm audit --audit-level=high`：0 个高危/严重漏洞。
- `npm run test:e2e`：11/11 Playwright 桌面 E2E 通过；`smoke-appkit-controls.mjs` 20/20 组通过；`npm run smoke:mcp` 通过。
- `npm run package:mac`：未签名（无 Developer ID 身份），`CFBundleShortVersionString` 为 `0.5.0`，`CFBundleIdentifier` 为 `dev.dtjgp.therss`。
- `app.asar` SHA-256：`846620d081a72e1e5c3cf6a7bf166656922be9f02937e9f5856df3b5be3e0233`。
- bundle 内容哈希（按路径、类型、权限和内容计算，共 665 个条目、14 个全包内符号链接）：`ea2a5922bb7387f9e82f7d030e12ec5001b6b01a9aeb6f13b3d54338f5be128d`。
- ZIP 由 `ditto -c -k --keepParent` 生成并由 `ditto -x -k` 解压复核，解压后 bundle 内容哈希与源包完全一致。
- 隔离资料 `npm run smoke:package`：Web 启动与 17 组原生工作流全部通过（待合入后最终确认）。

## 发布方法

合并后，在合并提交上重新执行 `npm ci` 和 `npm run package:mac`，确认重建包与候选 bundle 内容哈希一致，随后生成发布用 `TheRSS-0.5.0-macos-arm64-unsigned.zip`、`release-manifest.json` 和 `SHA256SUMS.txt`。待 `main` CI（`quality` 与 `desktop`）全部通过后公开为 `v0.5.0` pre-release，下载全部资产核对 `shasum -a 256 -c SHA256SUMS.txt`，最后在干净 `main` 上执行 `npm run update:local` 更新本机 `~/Applications/TheRSS Dev.app`。

## 边界

未进行 Developer ID 签名、公证、Gatekeeper 分发验证或同身份自动升级验收；未修改用户真实 `/Users/dtjgp/Obsidian/llm-wiki` 知识库（`therss-inbox-capture` 保持 fail-closed 直到用户显式注册治理权限）。物理键鼠/VoiceOver 人工走查与真实论文推送实测（`P0-1`）仍作为独立的人工验收项保留。
