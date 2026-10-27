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

## 边界

未进行 Developer ID 签名、公证、Gatekeeper 分发验证或同身份自动升级验收；本次预发布不完成 `MARKET_RELEASE.md` 的正式市场发行目标。新的原生界面还没有人工验收；VoiceOver、真实输入和其他语言环境未验证。CI 上打包后的原生冒烟测试曾有一次卡在窗口重建组（#68 的第一次运行，30 分钟后被取消）。这是唯一的一次：之后 #68 的两次运行，以及 #69、#70 的运行中，该组都通过了。原因未查明，原生冒烟测试的每一组还没有单独的超时。检索和分析质量仍以 2026-09-07 的有限实测为准。
