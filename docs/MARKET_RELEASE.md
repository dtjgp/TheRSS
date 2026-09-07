# macOS 市场发布验证

市场发布与本机未签名测试是不同的交付状态。当前目标的逐项验收由 [市场化改动契约](audits/2026-09-06-market-readiness/CHANGE_CONTRACT.md) 管理。没有完整证据时，不把个人测试包称为正式发行版。

## 代码与产品门禁

发布候选必须通过 `npm run check`、完整兼容界面 E2E、真实 AppKit 工作流与控件验收、依赖审查、来源状态检查及包级启动测试。验证应覆盖宽窄窗口、150% 字体、浅深色、焦点、中文输入、长文本、真实单元格可见性和错误恢复。

本机安装须保留应用与数据库备份，并检查完整性及安装后的包哈希。后续签名身份验证不代替这些产品和数据检查。

## 签名与公证前提

需要有效的 Developer ID Application 证书和已配置的 `notarytool` 钥匙串 profile。使用下列入口检查；它不会导入私钥、创建账号或上传应用：

```bash
npm run release:preflight -- --notary-profile YOUR_PROFILE
```

存在多个身份时，通过 `--identity` 指定名称或证书指纹。也可使用已有的 `CSC_NAME` 与 `THERSS_NOTARY_PROFILE`。不在项目文件、命令日志或聊天中保存密码和私钥。

缺少身份或 profile 时，命令以失败状态退出并列出阻塞项。这个检查只判断签名前提，不证明产品已经可发布。

## 构建、签名及分发检查

按当前 electron-builder 配置使用选定 Developer ID 签名。保留 Hardened Runtime，不使用开发调试授权。通过 `notarytool` 提交应用归档，记录提交 ID；等待已有提交完成，不因观察超时重复上传。接受后向应用附加并验证 ticket，再生成最终分发归档。

构建结果必须经过真实验证：

```bash
npm run release:verify -- --app /absolute/path/TheRSS.app
npm run release:verify -- --app /absolute/path/new/TheRSS.app --previous /absolute/path/baseline/TheRSS.app
```

验证器实际调用 `codesign`、`stapler` 和 Gatekeeper，拒绝未签名、自签名、未公证、错误应用标识、开发调试权限，以及签名团队不一致或版本未前进的后继包。

身份检查通过后，仍须在隔离的数据目录实际启动旧版、保存测试记录、升级至新版并核对数据、配置和原生工作流，再演练恢复。仅比较签名或版本号不能证明升级过程成功。

正式归档应包含版本、SHA-256、支持范围、发布说明、隐私及支持入口。对外发布前复核这份实际产物与已验证提交的一致性。自动替换更新仍需自己的签名旧版到新版实测，不能从未签名安装器测试推导为通过。

Apple 对 Developer ID、Hardened Runtime 和公证票据的要求见 [公证说明](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)；electron-builder 的签名选项以项目锁定依赖和其 [macOS 文档](https://www.electron.build/mac/) 为准。
