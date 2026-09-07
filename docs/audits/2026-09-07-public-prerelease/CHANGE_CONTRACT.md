# 0.3.0 GitHub 预发布交付契约

## Scope and authorization

用户对“PR 保持草稿，未合并或发布 Release”明确要求“合并并且发布”。本次授权覆盖 PR #49 合并、必要的发布文档和包修正、版本标签及 GitHub Release 上传/公开。沿用此前 Apple 付费注册、签名与公证延期决定，发布 GitHub pre-release `v0.3.0`，不把未签名包称为正式市场发行或声明生产自动更新。

## Objective and invariants

将经过检查的 PR #49 squash 合并到受保护 main，发布匹配合并树的 Apple Silicon/macOS 26+ 未签名 ZIP、SHA-256 和发布说明；核对远端 Release 资产、版本标签、main 和本地提交一致。保留旧标签、用户数据、安装应用及备份，不新增来源或模型调用，不更改算法、数据库、依赖或凭据。

## Uncertainty reducer

现有包通过本机及 CI 启动/14 组原生验收，但包清单包含不应分发的 `out/native-glass-spike` 实验文件。先以实际 ASAR 清单复现，再用 electron-builder 文件排除规则修正；运行文件应保持与已验证输出一致。归档解压后再次检查链接、权限、应用版本和完整 bundle，再从该解压目录运行隔离启动/原生验收。

## Acceptance and stop condition

- 包清单不含 spike、真实用户数据库、凭据或开发环境文件；必要运行文件全部与构建输出匹配。
- 仅变更打包范围和文档。适用格式、类型、架构、主/AppKit 检查通过；候选 PR 的 quality 和 desktop 均成功后，以期望 head SHA 合并。
- ZIP 能解压，完整 bundle 内容及符号链接与源包一致；临时 fixture 启动/原生流程通过，使用真实用户资料的应用保持原样。
- Release 明确 pre-release、unsigned、arm64 与 macOS 26+ 范围，保留来源/模型证据质量、人工 UX 暂通过、VoiceOver及签名更新未验收边界。
- 归档、SHA256SUMS 和结构化包清单上传完成并校验后才公开 Release；不覆盖既有标签/资产。
- 交付记录引用实际 PR、标签、Release 和对应 CI；完成后 local main、origin/main、远端 main、标签指向一致，工作区干净。

## Rollback and validation boundary

本轮没有数据迁移或现有安装替换。未签名预发布不满足 MARKET_RELEASE.md 的 Developer ID、公证和同身份更新要求；这些正式分发验收继续延期。来源及模型质量沿用已有有日期的实测，绿色代码测试不能升级这些结论。

## Local closeout

包清单 RED 已复现，排除规则后的清单和 11 个运行文件校验通过。ZIP 解压后完整 bundle、权限、符号链接及版本一致。第一次系统确认窗口截图失败已保留；不改应用/断言的完整重测通过启动、14 组原生流程及截图。详见 [REPORT.md](REPORT.md)。代码与包门槛通过后，继续按本次授权完成受保护分支合并和远端预发布校验。
