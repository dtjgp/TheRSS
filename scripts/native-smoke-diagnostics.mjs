export function classifyNativeSmokeStderr(chunks) {
  const applicationErrors = [],
    platformDiagnostics = []
  // Observed during CI window recreation; these exact Chromium process-priority
  // failures are retained separately, not discarded. Unknown stderr still fails.
  const processPolicy =
    /^\[\d+:\d{4}\/\d{6}\.\d+:ERROR:base\/process\/process_mac\.cc:\d+\] task_policy_set TASK_(?:CATEGORY|SUPPRESSION)_POLICY: \(os\/kern\) invalid argument \(4\)$/u
  const inputMethod =
    /^\d{4}-\d{2}-\d{2} .* error messaging the mach port for IMKCFRunLoopWakeUpReliable\s*$/u
  for (const line of chunks.join('').split(/\r?\n/u)) {
    if (!line.trim()) continue
    ;(processPolicy.test(line) || inputMethod.test(line)
      ? platformDiagnostics
      : applicationErrors
    ).push(line)
  }
  return { applicationErrors, platformDiagnostics }
}
