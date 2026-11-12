# VoiceOver 专项回撤

2026-11-12。用户指示：“不要做 voiceover 这个功能,之前开发的相关内容全部回撤掉”。

- Orca 已确认停止 `ctx_6b01dc07dca2` / `task_62b74ddfab89`，不是仅发送了停止请求。
- 已移除 Engineer 的 V1 sheet/AX 观察 harness 两个文件。
- 已移除 Manager 的 VoiceOver 专用 AppleScript/Python 驱动、验收与发现文档、原始朗读和首轮摘要。
- 原生 host 和接口没有新增 VoiceOver 专项产品改动；未回退此前的 My sources、I2/I1/I4 或侧栏诊断。
- CUA 已确认系统 VoiceOver 为 off，Allow VoiceOver to be controlled with AppleScript 为 0。
- 专用测试进程已退出；仅清理本专项明确创建的 profile 和三个已知临时编译/采样文件。
  不触碰先前被策略拒绝的批量临时目录。
- 回撤前后对既有产品、测试、配置文件做内容哈希比较，结果见 `evidence/rollback-preserved-code.json`。

VoiceOver 专项不再是待办。不提交、推送、安装或发布。
