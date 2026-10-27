# 0.4.0 未签名预发布验收

用户在 2026-10-27 选择"三个 PR 合并后发布"，并要求公开前先审阅发布说明。本次目标是 `v0.4.0`、Apple Silicon（arm64）、macOS 26+ 的 unsigned pre-release，保留此前的签名/公证延期决定。发布说明见 [RELEASE_NOTES.md](RELEASE_NOTES.md)。

## 范围

`v0.4.0` 包含 v0.3.0 之后合并到 `main` 的 #58、#63、#64、#65、#67、#68、#69、#70，以及本 PR 的版本号和文档改动。本 PR 只修改 `package.json` 和 `package-lock.json` 的版本号（3 行），以及 CHANGELOG、README 和本目录的文档。没有修改运行时源码、依赖、数据库或签名政策。Dependabot 在打包期间新开的 #71（`@modelcontextprotocol/sdk` 补丁）不在本次范围内。

## 候选包验证（2026-10-27，Apple M3 Max，Node 24.13.0）

候选树是 `main` `7581ac9` 加上本 PR 的版本号改动。

- `npm ci`、`npm run check`：770 项主测试、162 项 AppKit 测试通过（两套测试有重叠），架构、格式、类型、覆盖率和构建都通过。主测试覆盖率：语句 91.25%、分支 82.66%、函数 94.81%、行 93.91%。
- `npm audit --audit-level=high`：0 个漏洞。
- `npm run package:mac`：未签名，没有 Developer ID 身份，符合预期。打包规则只包含 `out/**`、`package.json` 和生产依赖，本目录的文档不进入包。
- `app.asar` 中 11 个运行文件的 SHA-256 都和构建输出一致；没有 `native-glass-spike` 实验文件，也没有用户数据库。
- ZIP 用 `ditto -c -k --keepParent` 生成，再用 `ditto -x -k` 解压。665 个 bundle 条目的内容和权限、14 个符号链接都和源 bundle 一致，所有链接都在 bundle 内。bundle 版本为 0.4.0，标识为 `dev.dtjgp.therss`。
- bundle 内容哈希（按路径、类型、权限和内容计算）：`5897e79e5bd6503f0ecaa51839f3077c8a6f88f81f12554bca8c59fe9c531171`。#68 合并前的试打包得到同一个值，说明 `electron-builder` 26.18 和开发依赖更新没有改变应用内容。
- 用隔离资料从**解压后的应用**运行 `npm run smoke:package`：Web 路线启动通过，16 组原生流程全部通过。没有安装到用户当前的资料环境。

验证工具在一次反向测试中把单个文件的权限改掉，比较结果准确报告了该文件，内容哈希也随之改变。

## 发布方法

合并后，在合并提交上重新执行 `npm ci` 和 `npm run package:mac`，再生成发布用 ZIP。该 ZIP 的 bundle 内容哈希必须等于上面的值，否则停止发布。ZIP 的字节哈希会因归档时间戳而不同，所以只记录在 Release 附带的 `SHA256SUMS.txt` 和 `release-manifest.json` 中。

资产先作为草稿上传，下载后核对 SHA-256，并在用户审阅发布说明后才公开为 pre-release。合并提交、`v0.4.0` 标签和 Release 目标必须一致。

## 合并后打包、草稿和本机安装（2026-10-27）

- #72 以 `a95e5bf` 合并，合并后的内容树 `1c6cd8b` 与候选树相同。PR CI（run 40496371386）的 `quality` 和 `desktop` 都通过。
- 在 `a95e5bf` 上重新执行 `npm ci` 和 `npm run package:mac`。新 ZIP 的 bundle 内容哈希等于 `5897e79…`；665 个条目、14 个符号链接、11 个运行文件的检查都通过。
- 草稿 Release `v0.4.0` 指向 `a95e5bf`，带 ZIP、`SHA256SUMS.txt` 和 `release-manifest.json`。下载这三个资产后，`shasum -a 256 -c` 全部通过，manifest 与本地文件相同。
- 本机安装：`npm run install:local` 的安装步骤用同一个包把 `~/Applications/TheRSS Dev.app` 更新为 0.4.0。安装器保留了旧应用和数据库备份，回执中的 `app.asar` 和 bundle 哈希一致。去掉顶层目录名后，已安装应用与发布 ZIP 中的应用逐项相同（665 个条目，0 个差异）。11 个用户数据表的行数与安装前备份相同，`integrity_check` 为 `ok`。
- 已安装应用的 `smoke:package`（隔离资料）：第一次运行在第 14 组失败，输入框中是 `bi`，不是测试写入的组合文字；第二次运行未作修改，Web 启动和全部 16 组原生流程通过，但之后有 6 张原生截图因 `screencapture` 报告 "could not create image from window" 而失败。两次运行期间本机有用户键盘和触控板活动，这可能是原因，但没有证实。已安装应用的截图检查仍未通过，需要在无人操作时重跑。

## 公开发布（2026-10-27）

- 用户批准了发布说明，并保留中文标题。
- `main` CI（[run 40515580398](https://github.com/dtjgp/TheRSS/actions/runs/40515580398)）在 `a95e5bf` 上通过，`quality` 和 `desktop` 都成功。
- `release-manifest.json` 的 `verification.mainCI` 从 `in_progress` 改为 `success`，并记录两个任务的结果；manifest 没有其他改动，ZIP 没有改动。重新生成的 `SHA256SUMS.txt` 覆盖 ZIP 和新 manifest。
- 替换草稿中的两个文件后，下载全部三个资产，`shasum -a 256 -c` 全部通过，下载文件与本地文件相同。
- [`v0.4.0`](https://github.com/dtjgp/TheRSS/releases/tag/v0.4.0) 于 2026-10-27 17:12:38 UTC 公开为 pre-release，没有标记为 Latest。标签指向 `a95e5bf`。

## 边界

未进行 Developer ID 签名、公证、Gatekeeper 分发验证或同身份自动升级验收；本次预发布不完成 `MARKET_RELEASE.md` 的正式市场发行目标。新的原生界面还没有人工验收；VoiceOver、真实输入和其他语言环境未验证。CI 上打包后的原生冒烟测试曾有一次卡在窗口重建组（#68 的第一次运行，30 分钟后被取消）。这是唯一的一次：之后 #68 的两次运行，以及 #69、#70 的运行中，该组都通过了。原因未查明，原生冒烟测试的每一组还没有单独的超时。检索和分析质量仍以 2026-09-07 的有限实测为准。
