# 侧栏失败诊断独立审查

2026-11-12。第 1 轮，核对 `e2e/sidebar-resize.spec.ts`、支持模块与受控失败探针。

## 已确认

- 原产品动作和宽度、存储断言保留；产品源码没有为诊断而修改。
- Node 侧存储跨 reload 的事件；固定容量，打印字符记为 char；只记录 fixture 测试应用。
- 失败原错误重抛；诊断写出失败不会替代原错误；JSON 使用唯一文件名和独立目录。
- 最终状态包含 CSS、ARIA、存储和焦点；探针专用后缀不进入真实常规测试匹配。
- Engineer 记录本阶段完整 check 与 E2E 通过。根因仍未证实，不能记为修复完成。

## 收尾项

1. **trace 仍会丢失。** 支持模块只把 `trace.outputDir` 写入 JSON，并要求下次运行前人工归档。
   之前的历史 trace 正是被后续运行清空。需要在 Playwright 完成 trace 后，自动把真实失败
   的 trace 及关联诊断复制到保留目录；不能只记录一个随后失效的路径。
2. **延迟 observe 的清理。** 初始化未找到 DOM 时，50ms timer 会继续重试；dispose 未取消它。
   如果提前 dispose，之后仍可能注册 MutationObserver。需停止标记、取消 timer，并用探针覆盖。
3. **时序与代码身份。** 当前 renderer 时间是 Node 收到 binding 的时间，没有原事件时间；
   HEAD 加改动文件数量也无法区分两份不同的未提交代码。补充事件 timeStamp/timeOrigin，
   以及相关源文件、测试和锁文件的内容摘要，以便判断新的失败。

允许最小测试 reporter/配置调整来归档完成后的 trace；不改原断言或产品行为。
受控失败后再跑一次探针，确认 JSON 与 trace 均不受下一次输出目录清理影响，原退出码不变。

## 临时目录

Engineer 报告按前缀批量清理被其权限策略拒绝，未提供更具体拒绝原因；未绕过。
要求只读列出本阶段确切目录及归属，不继续重试或换命令删除。该问题不构成更改用户数据的授权。

## 第 2 轮：收尾增量

已核对自动 trace reporter 的输出目录边界、独占创建与原结果保护，初始化停止标记和 timer 清理，
Disposable 的 init script/binding 清理，以及渲染源时间和相关文件哈希。三个第 1 轮问题已关闭。
Manager 只读运行归档 verifier，三个独立目录均关联一致、trace 可读、源与目标哈希一致，
每份记录的渲染事件均有源时间，跨两个文档。`git diff --check` 通过。

另有一项小的证据完整性缺口：reporter 计算 `recordMatches` 后，false 仍会继续复制 trace，
应拒绝关联不一致的附件，避免给错误记录增加归档。要求用不启动 Electron 的 reporter 回归覆盖。
当前正常探针关联均为 true，该项没有推翻已经读取的三份归档证据。

## 第 3 轮：关联保护关闭

已核对 reporter 新增的关联不一致提前返回：不写 trace 或状态；随后正确关联可正常归档。
Engineer 的 Node 级 RED/GREEN 及嵌套 Playwright 对照记录表明，原失败/通过状态和 exit code 保留。
此项关闭。侧栏失败诊断本身可交付，历史失败的触发源仍未知，不能称为根因已解决。
用户随后取消 VoiceOver 专项并要求回撤，其修复任务已停止、专项文件已移除，不再列入待办。
