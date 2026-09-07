export interface LocalBetaInstallReceipt {
  schemaVersion: 1
  status: 'completed'
  applicationVersion: string
  completedAt: string
  targetApp: string
  previousApp: string | null
  databasePath: string
  databaseBackup: string | null
  databasePreserved: boolean
  sourceAsarSha256: string
  installedAsarSha256: string
  sourceBundleSha256: string
  installedBundleSha256: string
  receiptPath: string
}

export interface LocalBetaInstallOptions {
  applicationsDirectory: string
  applicationVersion: string
  copyApp?: (source: string, destination: string) => void | Promise<void>
  databasePath: string
  force?: boolean
  isAppRunning?: (applicationPath: string) => boolean
  processId: number
  sourceApp: string
  timestamp: string
}

export function installLocalBeta(options: LocalBetaInstallOptions): Promise<LocalBetaInstallReceipt>
