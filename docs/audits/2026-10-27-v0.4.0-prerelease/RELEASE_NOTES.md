# TheRSS 0.4.0 — Apple 原生窗口结构预览

这是面向 **Apple Silicon（arm64）、macOS 26 及以上**的未签名预发布版。它没有 Developer ID 签名或 Apple 公证，不能视为正式市场发行版，也不包含生产自动更新承诺。其他架构和更早的系统没有在本次下载包中验证。

## 本次变化

- **窗口结构**：窗口顶部是统一的工具栏，显示当前页面标题和本地搜索框。侧栏改为 source list，四个工作区可以用 Command-1 到 Command-4 切换。Settings 改为独立窗口（Command-comma）。双击结果会在单独的只读窗口中打开记录。
- **Discover**：搜索时显示原生进度条和 Cancel 按钮。结果类型用分段控件筛选。来源选择改为弹出面板。工作区按窗口大小排布，不再分页，只有列表和阅读区滚动。
- **列表和阅读**：结果行显示类型图标和 Saved 星标。空页面显示原生的图标、标题、说明和操作按钮。文字使用 macOS 系统文字样式，日期按系统语言显示。
- **分享和拖拽**：带 `https:` 链接的记录可以用 Share 发送到其他应用，也可以把列表行拖到其他应用。
- **修复**：标题和副标题的行布局；Settings 窗口适配每个面板，缩放后会重新适配；Search details、提示和 Analytics 使用易读的文字。
- **依赖和安全**：Electron 44.9.3、Zod 4.6.7、React 19.3.1、Vitest 5.0.5。`npm audit` 报告 0 个漏洞。
- **测试可靠性**：Web E2E 流程有单独的 90 秒时间上限和分阶段报告；原生冒烟测试能识别一种已知的 Chromium 诊断日志；来源健康检查按来源分别报告结果。

完整列表见 [CHANGELOG](../../../CHANGELOG.md)。

## 下载、校验与使用

下载 `TheRSS-0.4.0-macos-arm64-unsigned.zip`、`SHA256SUMS.txt` 和 `release-manifest.json`。在下载目录执行：

```bash
shasum -a 256 -c SHA256SUMS.txt
```

解压得到 `TheRSS.app`。升级前退出所有 TheRSS 实例，并备份现有应用和 `~/Library/Application Support/therss` 数据目录；不要同时运行不同的副本。已有的开发安装建议继续使用仓库的 `npm run install:local`，由标准安装器生成应用和数据库备份。0.4.0 没有数据库迁移。

未签名的下载包可能被 macOS 安全策略拦截。请查看 [Apple 关于未知开发者应用的说明](https://support.apple.com/guide/mac-help/open-a-mac-app-from-an-unknown-developer-mh40616/mac)，或者按仓库 README 从已核验的源码构建。本版本不要求关闭系统安全功能。

可以使用已登录的本机 Codex/Claude Code，或者在 Settings 中配置自己的模型提供方。包内没有开发者 API key、个人研究数据库或预设账号。检索和分析都由用户显式启动。

## 验证与已知限制

代码基线（`v0.4.0` 标签指向的提交）通过 770 项主测试和 162 项 AppKit 测试（两套测试有重叠），`npm audit` 报告 0 个漏洞。CI 的 `desktop` 任务运行 Electron E2E、打包和打包后的原生冒烟测试。发布归档另外解压检查了 665 个 bundle 条目的内容、权限和 14 个符号链接，并用隔离资料从解压后的应用运行启动和 16 组原生流程。完整结果见随附的清单和对应 CI。

2026-10-06 的外观验收覆盖了深色和浅色模式、最小窗口和打包应用，共 60 张截图。新的原生界面**还没有经过人工验收**。VoiceOver 朗读、真实鼠标和键盘输入、`en-US` 以外的语言环境都没有验证。CI 上打包后的原生冒烟测试有两次卡在"窗口重建"那一组：一次在发布前（同一 PR 重跑后通过），一次在发布后的依赖更新 PR 中。其他运行中该组都通过；原因还没有查明。

检索和分析质量没有变化，仍以 2026-09-07 的有限实测为准：复合查询的直接相关性有限，人工检索精度和召回率没有测量。摘要和模型分析不能代替全文证据核验。部分来源有访问或日期解析限制，这些是有日期的观察，不是当前或未来可用性的保证。

Developer ID、公证和同身份自动升级仍然延期。

问题反馈请使用 [GitHub Issues](https://github.com/dtjgp/TheRSS/issues)；敏感问题请使用 [私密安全报告](https://github.com/dtjgp/TheRSS/security/advisories/new)，不要提交 API key、私人研究记录或数据库。
