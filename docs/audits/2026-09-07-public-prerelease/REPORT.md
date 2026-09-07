# 0.3.0 未签名预发布验收

用户已明确授权合并 PR #49 并发布 GitHub Release。本次发布目标是 `v0.3.0`、Apple Silicon（arm64）、macOS 26+ 的 unsigned pre-release，保留此前签名/公证延期决定。发布说明见 [RELEASE_NOTES.md](RELEASE_NOTES.md)。

## 包修正和验证

原包清单存在 5 个早期 native-glass 实验文件。实际 ASAR 验证先失败，再增加 electron-builder 排除规则；新包不再包含该目录。没有修改运行时源码、依赖、数据库或签名政策。

- `npm run check` 通过：687 项主测试、104 项 AppKit 测试（套件重叠），架构、格式、类型、覆盖率与构建均通过。
- 新 ASAR 中的 11 个运行文件均与构建输出一致；包路径未发现用户数据库、认证文件或环境文件，运行代码的凭据模式扫描无命中。详见 [package-verification.json](package-verification.json)。这些检查不代替全面安全审计。
- ZIP 为 `TheRSS-0.3.0-macos-arm64-unsigned.zip`，149,040,090 字节。SHA-256 为 `4d75dc3bf6754524e002de903133f4f77a426d504142ee74a8e2a701304da050`。
- 解压前后 663 个 bundle 条目内容和权限一致，14 条符号链接均保留且留在 bundle 内。版本/应用标识正确。详见 [archive-verification.json](archive-verification.json)。
- 从该 ZIP 的实际解压目录运行隔离启动及原生验收，14 组流程全部通过，保留原有数据/焦点/键盘/确认/读取/错误断言。新包没有安装到用户当前资料环境，现有安装和备份保持原样。

第一次归档运行完成 9 组功能检查后，`screencapture` 无法截取系统确认窗口。保留该失败日志；对同一归档重测后，全部原生流程和截图断言通过，没有降低断言或修改应用代码。此次截图失败没有被报告为通过，也没有宣称已修复其系统原因。

## 发布边界与交付

候选代码沿用当前同一 PR 的 CI，并在发布文档/包规则提交后核对新 head 的 quality 与 desktop；合并使用期望 head SHA 防止提交移动。合并树、版本标签和 Release 目标必须一致；资产先作为草稿上传并核对 SHA-256，完成后公开为 pre-release。

远端最终状态以 [PR #49](https://github.com/dtjgp/TheRSS/pull/49)、[v0.3.0 Release](https://github.com/dtjgp/TheRSS/releases/tag/v0.3.0) 及其对应 CI 为准。Release 附带 ZIP、SHA256SUMS.txt 和 release-manifest.json，包含精确目标提交及归档校验值。

未进行 Developer ID 签名、公证、Gatekeeper 分发通过验证或同身份自动升级验收。未知开发者应用可能被系统拦截；这次预发布不完成 MARKET_RELEASE.md 的正式市场发行目标。已有来源/模型质量和 VoiceOver 等边界保留在发布说明中。
