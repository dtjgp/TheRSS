# My sources 独立实施审查

2026-11-12。第 1 轮。审查对象：Engineer 的 `b1ea922` 加未提交改动。
保留上一轮 I2/I1/I4；本轮尚未完成 Manager 原生实操复核。

## 结论

主体设计符合批准方案：SQLite 独立默认偏好、初始化一次、共享来源选择逻辑、
主进程校验、原生默认 sheet 与本次搜索草稿分离。以下问题修复前不关闭任务。

1. **R1 / 必修：Web 切页丢失已应用的本次来源与研究问题。**
   `App.tsx` 按页面卸载 Discover，`useDiscoverSources.ts` 的来源和
   `DiscoverView.tsx` 的问题/runner 都是组件局部状态。Sources 保存默认再返回时，
   自定义组合被默认覆盖；未执行的研究问题也会回到旧会话。
   这不满足批准契约的临时组合保持及“切换页面不丢研究问题”。
   Engineer 契约中的已知限制未获用户批准，须移除并修复。
   需覆盖未自定义时同步新默认、自定义时保持且提示、活动任务保持、历史读取不覆盖、
   导航保持问题和 runner，以及新启动从默认初始化。
2. **R2 / 必修：Web 模态对话框缺少 Tab 焦点约束。**
   `MySourcesDialog.tsx` 只设置初始焦点和 Escape；`aria-modal=true` 不会限制键盘焦点。
   Tab/Shift+Tab 可到背景导航，卸载未保存草稿。需按项目已有模式约束焦点，
   保持 Escape/Cancel/保存后的焦点返回，保存中也不能逃到背景操作。
3. **R3 / 必修：原生保存中仍可用 Escape/导航关闭 sheet。**
   `MySourcesSheet` 保存时禁用 Cancel，但 `NativeModals.blocksNavigation`
   只保护 promotion。通用 sheet Escape 仍调用 `close()`，会在保存未完成时标记 dismissed；
   写入继续，成功提示或失败重试被隐藏。需用最小通用关闭约束保护此 sheet 的保存阶段，
   成功后正常关闭，失败后保留草稿并恢复 Cancel/Escape。用可控延迟保存测试验证。

## 已核对的证据与门禁

- 读取共享类型、存储/迁移、IPC/主进程桥接、原生偏好/选择/sheet/Discover、
  Web 默认与本次选择路径及相应测试；历史重试仍沿用服务层已存来源与计划。
- Engineer 报告：`npm run check` exit 0（938 主套件、224 AppKit）；
  完整原生 smoke 本轮 17/17 通过；专项 16 条断言和 9 张截图分开计数。
- 最后完整 E2E 8/9：sidebar-resize 拖拽失败；单项重跑 1/1。
  原因未调查，不归因为环境，也不把单项通过写成全套通过。
- 修复会产生新代码。要求重跑适用回归和 `npm run check`，再运行一次完整 E2E；
  原生关闭约束改变后重跑相关原生检查。所有失败保留退出码与日志，不削弱断言。
- 上述门禁为 Engineer 提供的记录；Manager 尚未独立进行这轮原生鼠标/键盘输入。

## 范围

Engineer 继续拥有 Engineer 工作区的实现、测试和实施报告；Manager 维护本审查记录。
不增加新功能或新依赖，不修改上一轮范围，不提交、推送、安装或发布。

## 第 2 轮：R1–R3 增量及原生 CUA

已读取 R1 的 Web 会话及真实导航测试、R2 的共用焦点循环和对话框、R3 的 sheet busy
约束和延迟保存测试。R1/R2 的已报告问题已按批准契约修复。保存失败仍保留草稿。
最终代码记录：主套件 948、AppKit 226；完整 E2E 9/9，均 exit 0。
完整原生 smoke 两次 exit 1：Settings 缩放 1.3/1.5 不符；第二次第 15 组 key-window
检查记录 `appActive=0`。第 15–17 组未完整执行；不能以早一版通过替代当前门禁。

### 新的实际输入发现

使用当前 build 的固定数据 helper，独立启动 PID 38723，临时 profile：
`/var/folders/d9/50r202r14gbc_shcxg960xrh0000gn/T/therss-my-sources-review-CEmo14`。
通过 CUA 原生界面操作，未调用真实来源、模型或 vault。

- 已验证升级初始化 3/22，来源 sheet 初始焦点，查找 `github` 后 Clear shown 只移除
  GitHub，隐藏的两项保持；Escape 丢弃改动，入口仍 3/22 且焦点返回。
- Tab/空格开启 Only selected 后显示 3 项；Clear shown 后 0 项，保存禁用并显示原因。
- 重新显示全部、只选 arXiv 并保存，入口 1/22；Discover 未自定义的下一次搜索同步 1/22，
  旧结果仍显示 3 项，旁边说明旧范围 3/22、下一次 1/22。
- **R4 / 必修：Discover 弹出框真实键入落到研究问题。** 打开本次来源弹出框后，AX 报告
  Find sources 为焦点，但 `typeText('github')` 将原问题追加 `github`，来源查找仍为空。
  再点击该查找框后 Command-A + 输入，把研究问题替换为 `github`；鼠标坐标尝试亦未恢复。
  Escape 关闭后焦点停在研究问题。该现象需要 Engineer 定位，区分应用焦点和自动化激活路径，
  用实际键盘事件证明输入仅改变查找，不能仅用 fixture 的 fill/firstResponderId 断言通过。
- **R3 尚有菜单路径缺口。** `NativeModals.openDocument()` 仅保护 promotion，
  `NativePresenter.command('open-help')` 可直接替换 busy sheet；`canOpenSearch` 亦未保护 busy
  sheet。需覆盖这些入口，保证保存中的反馈不被替换或隐藏。
- **R1 的活动任务标记仍有导航缺口。** 新 `session.running` 是非订阅的全局布尔值，
  重回 Discover 时 `isSearching` 仍从 false 开始。此时可再点 Search；主进程拒绝第二个请求后，
  第二次调用的 finally 会执行 `setRunning(false)`，首个请求仍运行。随后保存新默认会错误地
  同步本次草稿。需让活动任务状态跨导航可见，并按 run ID/有效所有者结束；至少阻止
  页面重建造成的重复启动。增加可控首个 pending run、往返、重复启动/拒绝、保存默认回归。

本次仅完成部分 CUA 复核；未验证临时来源 Apply、冲突保存和重启保持，也未做 VoiceOver。
已用 Command-Q 关闭 PID 38723，`ps` 确认退出。保留带 review-app.json 标记的 profile
供下一轮复现，不触及真实用户数据。发现问题后停止继续操作，待修复后复核增量。

## 第 3 轮结论及用户继续指示

已完成上一轮增量审查，不进入无界循环评审：

- R1 关闭：Web 会话改为可订阅的 run ID，第二个启动被拒绝，非所属 run 无法清除标记；
  重回 Discover 后 Search 保持禁用，相关导航、默认保存和 run 归属测试有覆盖。
- R3 关闭：帮助和本地搜索与 busy sheet 共用保护，新增成功/失败两种待完成保存测试。
- R4 部分修复：Escape 的独立 cancel 动作返回来源按钮。Native 的只读诊断字段不含研究问题或秘密。
  应用切换后输入可能进入研究问题的高优先级问题仍未关闭，不能宣称原生验收完成。
- Engineer 最新记录：`npm run check` exit 0（952 主套件、228 AppKit）；原生专项 16 条断言及
  9 次截图；完整原生 smoke 加焦点前置检查后 17/17 exit 0。原有产品断言保留。
  过去两次 smoke 失败与窗口焦点路由相符，但该推断不能单独证明所有历史失败的根因。
- 最新完整 E2E exit 1、8/9：侧栏重新展开后 304px/296px 不符；单独三次通过不替代完整门禁。
- Engineer 用系统级按键复现了应用切换问题，同时发现桌面有人使用。Manager 本轮仅查看代码、
  测试与日志，没有启动该脚本或发送系统级按键。真实输入不再无人值守运行。

原任务在此保留未完成结论，符合 `docs/DEVELOPMENT_WORKFLOW.md` 的三轮停止规则。
用户随后明确指示“继续运行，网络已经恢复了”。据此继续一个有界的保护修复与门禁定位切片，
不再探索无效的恢复焦点方案；具体范围见 `CONTINUATION_CONTRACT.md`。

## 继续切片复核与关闭

已核对后台观察者生命周期、仅 fixture 可调用的新动作、13 条后台关闭断言及当前完整门禁日志。
未发现该增量新增的高优先级问题。Manager 用 CUA 的 Command-H/恢复窗口验证了实际前后台
转换、未应用草稿取消、前台查找不改问题、临时/默认隔离、冲突保存、固定数据检索与重启。
完整证据和保留限制见 `FINAL_VERIFICATION.md`。原 R4 以后台取消策略关闭；
侧栏历史间歇失败根因仍待查，最新完整 E2E 通过不等于该稳定性问题已解决。
