# GitHub 源码交付（2026-09-07）

已将 `codex/market-readiness` 推送到 `dtjgp/TheRSS`，并创建指向 `main` 的 [草稿 PR #49](https://github.com/dtjgp/TheRSS/pull/49)。按用户要求保留草稿状态，尚未合并。私密漏洞报告已开启，入口见 [安全报告说明](../../SECURITY.md#vulnerability-reporting)。

功能代码及本机验收对应提交 `c045954aa4a1dd61755c0652801026d9cb2ddeb2`；本次后续提交更新交付和安全文档。已核对功能源文件无漂移，并保留本机安装包和数据验证。CI 的具体提交与运行结果由 [PR 检查页](https://github.com/dtjgp/TheRSS/pull/49/checks) 维护，交付时核对远端分支、PR head 与本地提交一致。

此前自动审批对 GitHub 操作的本地范围限制，已由用户最新的独立“执行”指令解除。此次启用设置、推送和创建草稿 PR 均在该授权后执行。未创建 GitHub Release、签名发行包或合并到 `main`；Apple 付费发行仍按原决定暂缓。

功能代码提交的 [CI 运行](https://github.com/dtjgp/TheRSS/actions/runs/34098567900) 中 `quality` 和 `desktop` 均通过；后续文档提交的最新结果仍以 PR 检查页为准。

本机软件的版本、备份、真实 CLI、退出与重开证据保留在 [LOCAL_ACCEPTANCE.md](LOCAL_ACCEPTANCE.md)。来源稳定性和人工/其他平台验收边界仍见 [整体记录](REPORT.md)。

## 非发行验收后续提交（2026-09-07）

本次后续提交继续使用 `codex/market-readiness` 和草稿 PR #49，覆盖官方资讯适配、来源状态/缓存、真实执行端分析证据与来源变化核验。当前本地门槛为 630/90 测试、桌面 8/8、包及安装后的原生流程 12/12；实际 Codex/Claude 与安装数据证据见 [本轮验收](REMAINING_ACCEPTANCE.md)。准确远端提交和 CI 结果以 [PR 检查页](https://github.com/dtjgp/TheRSS/pull/49/checks) 为准。保持草稿状态，不包含合并、标签或软件 Release。

## 直接交互与 Apple 来源反馈交付（2026-09-07）

用户对“将尚未同步的两次本地提交推送，并更新草稿 PR #49”明确回复“授权,开始解决”。此前缺少本次授权的阻塞已解除，提交 `199be74439fa2d2a58932bf2d5d4aefde15dfaad`（直接交互）及 `541cbdb06296c5d87281cadd911831539bf109ef`（最新来源状态与项目 Apple 参考）已推送，PR 正文与仓库的 `PR.md` 一致。该段之后的交付收尾仅更新文档状态。

当前功能验证为 687 项主测试、104 项 AppKit 测试、8 个桌面流程及新包/实际安装包各 14 组原生验收。安装前后全部 11 张用户数据表一致。推送钩子通过 lint、typecheck、687 项测试和构建，重新生成的 16 个输出与已安装应用内容一致。来源状态、设计参考和实际截图见 [最新报告](../2026-09-07-apple-design-status/REPORT.md)。

PR 保持 open/draft，目标仍为 `main`，没有合并、标签或 Release。每个最终提交的 CI 结果仅以 [当前 PR 检查页](https://github.com/dtjgp/TheRSS/pull/49/checks) 为准；旧提交的成功结果不替代当前提交的验证。人工 UX 暂通过决定、来源/模型质量限制和正式 Apple 发行延期均继续保留。
