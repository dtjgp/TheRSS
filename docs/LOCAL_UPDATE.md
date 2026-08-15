# Local beta update and recovery

## 两种循环

日常开发使用 `npm run dev`，保存前端代码后由 Vite 热更新，不需要重装应用。

需要验证真实 `.app` 时运行：

```bash
npm run install:local
```

它执行以下步骤：构建应用；若数据库存在则调用 SQLite 在线备份；用 macOS `ditto` 复制 bundle 以保留 framework 符号链接；验证关键链接和 `icudtl.dat`；保留上一版应用；最后原子切换安装目录。

## 从 GitHub 更新

仓库配置远程并且工作树干净后运行：

```bash
npm run update:local
```

该命令会依次执行 `git pull --ff-only`、`npm ci`、`npm run check` 和 `npm run install:local`。任一步失败都会停止，不会继续用未验证版本替换应用。

## 恢复

- 数据库备份位于 `~/Library/Application Support/TheRSS/backups/`。
- 旧应用位于 `~/Applications/TheRSS Dev.backup-<timestamp>.app`。
- 如果新版本不能启动，先退出 TheRSS，再把当前 `TheRSS Dev.app` 移到其他明确位置，然后将选定备份重命名为 `TheRSS Dev.app`。
- 如果数据库迁移出现问题，先保留当前数据库，再从对应时间戳备份恢复。不要在应用运行时直接覆盖数据库。

脚本不会自动删除旧备份。定期清理应使用独立、可审查的保留策略，不能在安装失败后扩大删除范围。

## Apple 开发者资质边界

本地构建、测试和个人安装不需要付费 Apple Developer Program。稳定分发给其他用户、减少 Gatekeeper 摩擦以及启用 macOS 自动更新时，再申请 Developer ID、签名和公证。Electron 的 macOS 自动更新机制要求应用已签名：<https://www.electronjs.org/docs/latest/api/auto-updater/>
