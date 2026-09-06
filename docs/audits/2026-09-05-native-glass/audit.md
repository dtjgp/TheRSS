# TheRSS 原生 Liquid Glass 迁移验收

本轮按用户要求先验证小范围原生试点，再扩展到全部适用的材质与浮动交互层。实现采用公开 AppKit API 与自有 Node-API 适配器；论文阅读、表单和数据列表继续由现有 Electron/React 业务界面承载。

## 迁移范围

| 区域                                       | 最终实现                                            | 行为边界                                                                |
| ------------------------------------------ | --------------------------------------------------- | ----------------------------------------------------------------------- |
| 侧栏导航与本地索引状态                     | NSGlassEffectView 内的 NSButton/NSTextField         | Discover、Saved、Analytics、Sources、Settings 与既有导航 guard 共用行为 |
| 顶部栏                                     | 原生实色顶部栏，侧栏切换控件使用 NSGlassEffectView  | 保留 macOS 27 清晰顶部边界、日期、上下文和窗口拖动                      |
| Discover/Saved 详情操作条                  | 原生玻璃与原生 Save、Analyze、Promote、Dismiss 按钮 | 原结果 ID、保存状态、禁用状态、推广确认、分析证据等级保持一致           |
| Undo 提示                                  | 原生玻璃、文本和 Undo 按钮                          | 保留撤销语义、时限及无障碍播报                                          |
| 表单、来源目录、阅读区、分析内容与模态正文 | 普通不透明内容                                      | 不把纸面内容和状态表做成玻璃；原生菜单、确认框沿用现有实现              |
| 不支持的系统、关闭开关、初始化失败         | 原有网页界面与窗口 vibrancy                         | 不改变 SQLite、凭据、模型、来源、导出或知识库行为                       |

`THERSS_NATIVE_GLASS=pilot` 限定侧栏/顶部栏；`full` 为完整适用材质层；`off` 恢复网页实现。默认启用完整模式只面向具备 API 的系统。此次实际环境为 macOS 27.0、Electron 44.1.1、Xcode 26.6/SDK 26.5、Apple Silicon；构建需要提供 NSGlassEffectView 的 SDK，原生模块按构建机架构编译。

## 原生性与架构证据

NSGlassEffectView 的 contentView 真正拥有 AppKit 前景控件，外层使用 NSGlassEffectContainerView。系统无障碍树可以在 HTML 内容之外识别这些原生按钮；本轮实际点击、Tab、方向键、Dismiss 和 Command-Z 验证其行为。此结论不是由 CSS 模糊或网页截图推导。

Chromium 原生根视图保留完整窗口坐标。试验中的 inset NSSplitView 重挂接在窗口调整后出现 viewport 不一致，因此未采用。最终使用普通 AppKit 父视图，玻璃外框保持物理窗口坐标，只在每块玻璃内部的普通内容视图上做 frame/bounds 变换；按钮外框、文字、图标和焦点环共同缩放，玻璃裁切尺寸保持正确。主进程校验调用者、协议、版本与实际窗口/缩放，渲染器不接触原生指针或任意原生调用。

控件仅在当前原生展示确认后才从 DOM 显示和无障碍树中隐藏。延迟事件绑定固定控件 ID、版本及当前会话/条目身份；模态框锁定原生动作，关闭、重载和失败会释放适配器。详细决策见 [ADR 0010](../../decisions/0010-native-glass-material-host.md) 和 [变更契约](CHANGE_CONTRACT.md)。

## 验证与修复

- 有意义的 RED/GREEN 覆盖协议、旧事件、初始化失败、渲染确认、Settings 未保存编辑、实际 Discover DOM 投影、非 BMP 文本、滚动与焦点交接。
- 独立复查发现的 Save/Analyze 遗漏、原生快捷键、重复激活、初始化回退和 Toggle 命中问题已分别修复。原生点击调用原有业务处理器；推广测试仅使用 fixture 预览/确认，不写入真实 vault。
- 窗口缩放截图暴露了逐个放大字体造成的按钮外框裁切；改为整体缩放普通前景内容，同时让玻璃外框保持物理尺寸。Saved 在高缩放下的窄布局同时增加换行、阅读区最小高度及顶部栏下方的动作条停靠位置。
- CI 的显示区高度为 677px，macOS 会限制请求窗口高度；几何验收因此比较 Chromium/原生 host 与实际 BrowserWindow 尺寸，浮动控件在滚入可见区域后再测试。桌面用例串行执行以保留真实焦点和拖拽取消语义。
- 原生模块从源码构建并在 ASAR 外解包；打包 smoke 必须检查 AppKit host 实际激活，单纯出现应用首页不能通过。
- 主进程/渲染桥接专项覆盖率另见 [owned-coverage.json](owned-coverage.json)，不能把 core/shared 的整体覆盖率冒充原生 C++ 或所有组件覆盖率。

最终门禁已通过：`npm run check` 为 66 个文件 / 470 个测试；桌面 6/6；依赖审计 0 漏洞；最新 arm64 包及已安装副本的原生激活 smoke 通过。专项覆盖率为 statements 95.20%、branches 89.18%、functions 95.08%、lines 98.08%，每个新增桥接文件四项均超过 80%。

[verification.json](verification.json) 记录包与原生模块指纹。已安装副本的 app.asar 与原生模块均和测试包相等；2026-09-06T00-38-07-518Z 安装回执为 completed，旧应用及 SQLite 备份存在。Git 提交与分支状态由 Git 历史和本次交付报告提供。

| 渲染证据                        | 截图                                                   |
| ------------------------------- | ------------------------------------------------------ |
| 原生玻璃浅色                    | [saved-light.png](screens/saved-light.png)             |
| 原生玻璃深色                    | [saved-dark.png](screens/saved-dark.png)               |
| 高对比度与减少透明度            | [saved-accessible.png](screens/saved-accessible.png)   |
| 200% 真实玻璃，滚动到详情操作条 | [saved-200-percent.png](screens/saved-200-percent.png) |

这些截图由系统窗口捕获取得，包含 AppKit 前景，使用同一源码构建的隔离 fixture；打包与安装身份另由文件指纹和 smoke 确认。

## 证据限制

实际鼠标、键盘、无障碍控件及窗口材质已经通过对应检查。自动化工具在原生按钮上产生的滚轮事件所有位移字段均为零，连 AppKit 本地事件入口也如此，不能据此判定真实触控板成功或失败。最终滚轮测试创建公开 CGEvent/NSEvent 对象，仅在隔离 fixture 中交给被测原生按钮，验证完整 native/main/renderer 横纵滚动链；不向操作系统投递合成事件。物理触控板惯性与硬件体验保留为未验证边界，无效事件监听器与临时原始诊断已移除。

截图显示的是隔离 fixture，不是当天实际检索结果。最近一次真实来源复检仍是 2026-08-19 的 22/22，本轮未执行实时来源或模型请求，也不提高论文全文证据等级。安装包为个人测试用 unsigned 构建，不声明已签名/公证或生产级自动替换更新。

## 依据

- [Apple: macOS Liquid Glass 与内容所有权](https://developer.apple.com/videos/play/wwdc2025/310/)
- [Apple: macOS 27 设计更新](https://developer.apple.com/videos/play/wwdc2026/289/)
- [Apple: NSEvent scrollingDeltaX](https://developer.apple.com/documentation/appkit/nsevent/scrollingdeltax)
- [Electron 44.1.1 原生窗口实现](https://github.com/electron/electron/blob/v44.1.1/shell/browser/native_window_mac.mm)
- [官方 Node-API headers](https://github.com/nodejs/node-api-headers)
