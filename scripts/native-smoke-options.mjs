/**
 * AppKit launch options shared by the native smokes.
 *
 * THERSS_NATIVE_LEGACY_SCROLLERS=1 shows legacy scroll bars, which take width from the content,
 * as on a Mac without a trackpad (CI runners). The argument applies to the app process only; the
 * system setting does not change.
 */
export function nativeSmokeAppKitOptions(env) {
  const legacyScrollers = env.THERSS_NATIVE_LEGACY_SCROLLERS === '1'
  return { legacyScrollers, args: legacyScrollers ? ['-AppleShowScrollBars', 'Always'] : [] }
}
