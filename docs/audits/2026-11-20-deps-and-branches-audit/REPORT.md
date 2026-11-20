# TheRSS 依赖与本地分支审计

2026-11-20。审计基线为 `dtjgp/release-devops` 和本地 `origin/main`，两者均指向
`692f9e4b60761b9440beaf90590222d5cce0f2b6`。建议先合并 #100，待 #101 在更新后的
`main` 基线上通过 CI 后再合并。五条本地分支的改动均可在 `origin/main` 找到。

## 1. 编号建议

1. **Approve & Merge** — PR #100。核对当前 PR 头提交和必需检查后，优先合并。
   `fast-xml-parser` 5.12.0 覆盖本次扫描发现的生产依赖低危公告。
2. **Hold** — PR #101。#100 合并后，在新基线上核对锁文件并确认 `quality` 和 `desktop`
   通过，再批准合并。两个 PR 都修改同一锁文件。#101 更新 Electron，
   需用合并候选验证原生模块和实际包启动。本次扫描的公告均超出 #101 的修复范围。
3. **Safe to Delete** — `claude/practical-murdock-a51318`，提交 `22c818f`。
   获批后可用 Git 的普通删除保护。
4. **Safe to Delete** — `codex/daily-papers`，提交 `5887620`。补丁已随 #90 合并。
5. **Safe to Delete** — `docs/safe-storage-contract-closeout`，提交 `9f28369`。
   补丁已随 #88 合并。
6. **Safe to Delete** — `fix/safe-storage-residual-risks`，提交 `d450529`。
   补丁已随 #87 合并。
7. **Safe to Delete** — `fix/ncpssd-issue-number-status`，提交 `6a9af64`。
   NCPSD 修复已随 #98 合并，分支额外的侧栏修复已随 #99 合并。
8. **Keep** — 保留 Hono 生产依赖与 minimatch 开发依赖的后续处理项。生产依赖可先验证
   `hono` 4.13.16 和 `@hono/node-server` 2.1.6 是否能在现有 SDK 约束内更新。
   对 minimatch，先检查依赖方支持的版本并验证构建链。npm 建议的
   `electron-builder` 25.1.0 会从 26.18.0 跨主版本降级，应单独评估。

清理建议只覆盖本地分支引用。执行获批清理前，重新核对各分支的提交 ID 和工作树占用情况。
第 4–7 项经过 squash 合并，普通删除保护可能拒绝。若另需保留原始提交身份，保留这些引用。

## 2. Dependabot 更新与 CI

本地快照记录两个 PR 均为 `OPEN`、合并状态为 `CLEAN`。快照中的 diff 有截断。
通过 GitHub 连接器补齐两个文件的完整补丁，并将补丁应用到临时副本。
得到的锁文件 Git blob ID 分别以 `b9a5347` 和 `644cb47` 开头，与快照一致。
CI 结论来自本地快照中的 2026-11-14 UTC 运行。

| PR                                               | `quality`                                                                                      | `desktop`                                                                                      |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [#100](https://github.com/dtjgp/TheRSS/pull/100) | [SUCCESS，11:17:46](https://github.com/dtjgp/TheRSS/actions/runs/43588960802/job/132429386487) | [SUCCESS，11:20:47](https://github.com/dtjgp/TheRSS/actions/runs/43588960802/job/132429387371) |
| [#101](https://github.com/dtjgp/TheRSS/pull/101) | [SUCCESS，11:17:07](https://github.com/dtjgp/TheRSS/actions/runs/43589040898/job/132429640704) | [SUCCESS，11:19:11](https://github.com/dtjgp/TheRSS/actions/runs/43589040898/job/132429640473) |

以下为锁定版本。Vite 同时列出清单中的版本约束。

| PR   | 层级         | 精确变更                                                                                                                                                                                                                                              |
| ---- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #100 | 直接生产依赖 | `fast-xml-parser` 5.11.2 → 5.12.0，`lucide-react` 1.68.0 → 1.72.0                                                                                                                                                                                     |
| #100 | 间接生产依赖 | `is-unsafe` 2.0.0 → 2.0.3，`strnum` 2.4.2 → 2.5.1                                                                                                                                                                                                     |
| #101 | 直接开发依赖 | `@playwright/test` 1.64.1 → 1.65.0，`@testing-library/user-event` 14.6.8 → 14.6.9，`@types/node` 26.6.5 → 26.6.6，`@vitest/coverage-v8` 5.0.5 → 5.1.0                                                                                                 |
| #101 | 直接开发依赖 | `electron` 45.2.3 → 45.3.0，`eslint` 10.13.0 → 10.14.0，`typescript-eslint` 8.72.1 → 8.72.2，`vite` 7.3.7 → 7.3.8（清单 `^7.3.6` → `^7.3.8`），`vitest` 5.0.5 → 5.1.0（清单仍为 `^5.0.5`）                                                            |
| #101 | 间接开发依赖 | `playwright` 和 `playwright-core` 1.64.1 → 1.65.0，`@vitest/mocker` 和 `@vitest/spy` 5.0.5 → 5.1.0，`@vitest/istanbul-lib-coverage` 和 `@vitest/istanbul-lib-report` 1.0.2 → 2.1.0                                                                    |
| #101 | 间接开发依赖 | `@typescript-eslint/` 下的 `eslint-plugin`、`parser`、`project-service`、`scope-manager`、`tsconfig-utils`、`type-utils`、`types`、`typescript-estree`、`utils`、`visitor-keys` 均从 8.72.1 → 8.72.2，`typescript-estree` 下的 `semver` 7.8.5 → 7.8.6 |

#100 将 `fast-xml-parser` 对 `@nodable/entities` 的约束从 `^3.0.1` 调整到 `^3.1.0`，
将对 `fast-xml-builder` 的约束从 `^1.2.0` 调整到 `^1.3.1`。原锁定版本已满足新约束，
分别为 3.1.0 和 1.3.1。两个补丁也包含锁文件的 `peer` 标记调整。

两个 PR 都保留 `better-sqlite3` 13.0.3、`node-api-headers` 1.9.0、全部 `allowScripts`
条目和 `asarUnpack` 配置。#100 的 Electron 仍为 45.2.3。#101 的 Electron 45.3.0
会进入应用包，原生兼容性应由新基线的 `desktop` 检查验证，重点是 AppKit、SQLite
和包内原生模块的加载。锁文件仅能证明版本选择。历史 `desktop` 工作流门禁包含 Electron
端到端、AppKit 控件、无签名打包和包启动测试。

## 3. npm 审计

`npm audit --json --cache /private/tmp/therss-audit-cache` 首次在沙箱内因 DNS 失败退出。
按权限流程重试后，npm registry 返回结果。进程退出码为 1，JSON 含完整审计报告。

| 计数口径                       | Critical | High | Moderate | Low | 合计 |
| ------------------------------ | -------: | ---: | -------: | --: | ---: |
| npm 包条目（含间接受影响条目） |        0 |    0 |       16 |   1 |   17 |
| 唯一公告（去重后的 GHSA）      |        0 |    0 |        8 |   2 |   10 |

npm 以包内最高严重度计包条目。因此 Hono 的一项低危公告记在 Hono 的中危包条目内。
按锁文件的依赖路径，17 个包条目中 3 个属于生产依赖，14 个仅用于开发或构建。

| 公告所在包与锁定版本                                   | 分类                                 | 公告和受影响范围                                                                                                                                                                     | PR 影响                         |
| ------------------------------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| `fast-xml-parser` 5.11.2                               | 直接生产依赖                         | 低，[GHSA-474x-hrwr-fgx4](https://github.com/advisories/GHSA-474x-hrwr-fgx4)，≤5.11.2                                                                                                | #100 的 5.12.0 超出受影响范围。 |
| `@hono/node-server` 2.1.1                              | 生产，经 `@modelcontextprotocol/sdk` | 中，[GHSA-rmxm-3fg6-px4f](https://github.com/advisories/GHSA-rmxm-3fg6-px4f)，≥1.19.10 且 <2.1.3                                                                                     | 两个 PR 均保留 2.1.1。          |
| `@hono/node-server` 2.1.1                              | 同上                                 | 中，[GHSA-qv5m-9pm6-hqp3](https://github.com/advisories/GHSA-qv5m-9pm6-hqp3)、[GHSA-jpvv-r467-5p4w](https://github.com/advisories/GHSA-jpvv-r467-5p4w)，≥2.0.0 且 <2.1.6             | 两个 PR 均保留 2.1.1。          |
| `hono` 4.13.13                                         | 生产，经 `@modelcontextprotocol/sdk` | 中，[GHSA-4m76-xfj5-7975](https://github.com/advisories/GHSA-4m76-xfj5-7975)、[GHSA-46wx-v44x-9hh2](https://github.com/advisories/GHSA-46wx-v44x-9hh2)，<4.13.16                     | 两个 PR 均保留 4.13.13。        |
| `hono` 4.13.13                                         | 同上                                 | 中，[GHSA-h7mg-cq63-vhpq](https://github.com/advisories/GHSA-h7mg-cq63-vhpq)，4.1.4–4.13.15，[GHSA-4h7h-rv7c-7m2v](https://github.com/advisories/GHSA-4h7h-rv7c-7m2v)，4.5.1–4.13.15 | 两个 PR 均保留 4.13.13。        |
| `hono` 4.13.13                                         | 同上                                 | 低，[GHSA-3gg2-335m-rxc6](https://github.com/advisories/GHSA-3gg2-335m-rxc6)，3.12.0–4.13.15                                                                                         | 两个 PR 均保留 4.13.13。        |
| `minimatch` 10.2.6 和 `@electron/universal` 下的 9.0.9 | 仅开发和构建                         | 中，[GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249)，≥7.0.0 且 <11.0.1                                                                                      | 两个 PR 均保留两个版本。        |

npm 还将 minimatch 公告归到以下 13 个仅用于开发或构建的依赖方。它们共用上表中的 GHSA。

| 依赖链            | npm 报告的间接受影响包及基线版本                                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Electron 打包     | `@electron/universal` 2.0.3，`app-builder-lib`、`dmg-builder`、`electron-builder`、`electron-builder-squirrel-windows` 均为 26.18.0 |
| ESLint            | `@eslint/config-array` 0.23.5，`eslint` 10.13.0                                                                                     |
| TypeScript ESLint | `@typescript-eslint/eslint-plugin`、`parser`、`type-utils`、`typescript-estree`、`utils` 及 `typescript-eslint` 均为 8.72.1         |

#101 的 ESLint 10.14.0 和上述 TypeScript ESLint 包的 8.72.2，仍在 npm 报告的
间接受影响范围内。基于本次公告集和 PR 锁文件，两个 PR 合并后预计剩余 16 个中危包条目，
对应 8 项中危和 1 项低危公告。合并候选需复扫才能得到实际计数。Hono 的生产归类来自
锁文件。仓库内可见的 MCP 入口使用 stdio，Hono 的 HTTP 路径可达性本次未验证。

## 4. 本地分支

对每条分支执行 `git log --oneline origin/main..<branch>` 和
`git cherry -v origin/main <branch>`，并检查祖先关系和工作树。审计时五条分支均未签出。
下表的落后和领先按提交历史计算。`-` 表示存在等效补丁，`+` 表示 Git 未找到单独等效补丁。

| 本地分支                              | 落后 / 领先 | 分支独有提交及 `git cherry`                                     | `origin/main` 中的证据            |
| ------------------------------------- | ----------: | --------------------------------------------------------------- | --------------------------------- |
| `claude/practical-murdock-a51318`     |      10 / 0 | 无，分支尖端 `22c818f` 为祖先                                   | 该提交可由 `origin/main` 直接到达 |
| `codex/daily-papers`                  |       7 / 1 | `- 5887620`，Daily Papers 对接 llm-wiki                         | #90，`c0053b7`                    |
| `docs/safe-storage-contract-closeout` |       8 / 1 | `- 9f28369`，更正 safe-storage 契约记录                         | #88，`6344b97`                    |
| `fix/safe-storage-residual-risks`     |       9 / 1 | `- d450529`，轮换密钥重加密与凭据写入顺序                       | #87，`167c4e2`                    |
| `fix/ncpssd-issue-number-status`      |       2 / 2 | `- fa589b8`，NCPSD 空结果状态；`+ 6a9af64`，AppKit 侧栏宽度恢复 | #98，`f79e7c9`；#99，`692f9e4`    |

`6a9af64` 涉及五个文件。与 `origin/main` 比较后，`native/appkit/node.mm`、
`e2e/native-sidebar-resize.spec.ts` 及两份侧栏审计文档逐字节一致。
`native/appkit/bridge.mm` 保留相同的 `layout-divider` 测试入口，主线仅多出六行独立的
`app-resign-active` 测试逻辑。限定这五个路径的 `git range-diff` 将该修复对应到 #99。
本地跟踪引用 `origin/fix/ncpssd-issue-number-status` 仍指向 `fa589b8`，所以 Git 显示
本地领先 1。该提交的功能、回归测试和文档均已进入主线。

## 5. 环境与核查范围

- 本地 Node `v26.13.1` 满足 `package.json` 中的 `^24.15.0 || >=26.0.0`。
  npm 版本为 `11.20.0`。快照所对应的仓库 CI 配置在 `quality` 覆盖 Node 24 和 26，
  在 `desktop` 使用 Node 24。
- 审计 JSON 位于 `/private/tmp/therss-audit-task_d4e7784ad340.json`，SHA-256 为
  `2f655d1a6f62aff36573397368da70c739314edc239ad7f026d95b4300548ab8`。
  PR 快照 `/tmp/therss-pr-100-101.txt` 的 SHA-256 为
  `c59e9b4b996efc0131ed818fcda6e899bc0795c2615bfb96c7273c9b2ffed2a9`。
- 本轮为只读审计。未另跑 `npm audit --audit-level=high`，本次 JSON 的 high 和
  critical 均为 0。未运行本地 `npm run check`、`npm run package:mac` 或
  `npm run smoke:package`，也未生成新包或执行备份与回滚验证。签名和公证前提未评估。
- 唯一工作树交付为本报告。合并、分支清理、推送、安装和发布均待授权。
