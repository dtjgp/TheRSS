# TheRSS 0.3.0 — Native research desk preview

这是面向 **Apple Silicon（arm64）、macOS 26 及以上**的未签名预发布版。它没有 Developer ID 签名或 Apple 公证，不能视为正式市场发行版，也不包含生产自动更新承诺。其他架构和更早系统未在本次下载包中验证。

## 本次变化

- 完整 AppKit 工作界面：Discover、Saved、Sources、Data Analytics、Settings 和本地查找使用原生控件、列表、富文本及弹窗。
- 研究问题可直接编辑；点击或按 Return 阅读记录，长摘要自然滚动，窄窗保留清晰的返回路径。
- Command-F 按输入筛选已有记录，并打开对应收藏、搜索会话或历史分析；返回时保留上下文。
- Sources 比较最近的有效来源读取与 Discover 记录，明确显示时间、原因及失败/部分/无匹配状态，移除常驻全局 attention 提示。
- Saved 可显式采用更新的本地来源快照，保留收藏时间与历史分析；旧分析在来源变化后显示过时提示。
- 修复退出流程、设置草稿、来源解析和日期精度问题，并加强分析的证据边界提示。

## 下载、校验与使用

下载 `TheRSS-0.3.0-macos-arm64-unsigned.zip`、`SHA256SUMS.txt` 和 `release-manifest.json`。在下载目录执行：

```bash
shasum -a 256 -c SHA256SUMS.txt
```

解压得到 `TheRSS.app`。升级前退出所有 TheRSS 实例，并保留现有应用与 `~/Library/Application Support/therss` 数据目录的备份；不要同时运行不同副本。现有开发安装建议继续使用仓库的 `npm run install:local`，由标准安装器生成应用和数据库备份。

未签名下载可能被 macOS 安全策略拦截。请查看 [Apple 关于未知开发者应用的说明](https://support.apple.com/guide/mac-help/open-a-mac-app-from-an-unknown-developer-mh40616/mac)，或按仓库 README 从已核验源码构建。本版本不要求关闭系统安全功能。

可使用已登录的本机 Codex/Claude Code，或在 Settings 配置自己的模型提供方。包内没有开发者 API key、个人研究数据库或预设账号。检索和分析由用户显式启动。

## 验证与已知限制

代码基线通过 687 项主测试、104 项 AppKit 测试（套件有重叠）、8 个桌面流程，以及打包/安装后的 14 组原生验收。发布归档另行解压检查运行文件与符号链接，并用隔离资料验证启动和原生流程；完整结果见随附清单与对应 CI。

9 月 7 日的有限实测包含 6 次检索（469 条返回记录）和 4 次分析尝试：2 次完成输出通过该样本的来源审阅，1 次证据越界，1 次超时。复合查询的直接相关性仍有限；人工检索精度与召回率未测量，新增论文提示约束也没有在该预算内真实重跑。部分来源仍有访问或日期解析限制，例如当日 NBER 失败、NCPSD 部分数据；这些是有日期的观察，不是当前或未来可用性保证。

人工 UX 按用户决定暂通过，后续问题会重新打开对应项。VoiceOver、付费模型接口、Developer ID、公证及同身份自动升级仍延期。摘要与模型分析不能替代全文证据核验。

问题反馈请使用 [GitHub Issues](https://github.com/dtjgp/TheRSS/issues)；敏感问题请使用 [私密安全报告](https://github.com/dtjgp/TheRSS/security/advisories/new)，避免提交 API key、私人研究记录或数据库。
