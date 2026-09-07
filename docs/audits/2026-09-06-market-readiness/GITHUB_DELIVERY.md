# GitHub 源码交付（2026-09-07）

已将 `codex/market-readiness` 推送到 `dtjgp/TheRSS`，并创建指向 `main` 的 [草稿 PR #49](https://github.com/dtjgp/TheRSS/pull/49)。按用户要求保留草稿状态，尚未合并。私密漏洞报告已开启，入口见 [安全报告说明](../../SECURITY.md#vulnerability-reporting)。

功能代码及本机验收对应提交 `c045954aa4a1dd61755c0652801026d9cb2ddeb2`；本次后续提交更新交付和安全文档。已核对功能源文件无漂移，并保留本机安装包和数据验证。CI 的具体提交与运行结果由 [PR 检查页](https://github.com/dtjgp/TheRSS/pull/49/checks) 维护，交付时核对远端分支、PR head 与本地提交一致。

此前自动审批对 GitHub 操作的本地范围限制，已由用户最新的独立“执行”指令解除。此次启用设置、推送和创建草稿 PR 均在该授权后执行。未创建 GitHub Release、签名发行包或合并到 `main`；Apple 付费发行仍按原决定暂缓。

功能代码提交的 [CI 运行](https://github.com/dtjgp/TheRSS/actions/runs/34098567900) 中 `quality` 和 `desktop` 均通过；后续文档提交的最新结果仍以 PR 检查页为准。

本机软件的版本、备份、真实 CLI、退出与重开证据保留在 [LOCAL_ACCEPTANCE.md](LOCAL_ACCEPTANCE.md)。来源稳定性和人工/其他平台验收边界仍见 [整体记录](REPORT.md)。
