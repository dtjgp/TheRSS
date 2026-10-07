interface SourceDateRecord {
  readonly source: string
  readonly publishedAt: string
  readonly summary?: string
}

/** NCPSD's stored month-start value is a sorting anchor, not evidence of a publication day. */
export function hasPublicationMonthOnly(item: SourceDateRecord): boolean {
  if (item.source !== 'folo:611') return false
  const month = item.summary?.match(/(\d{4})年(\d{1,2})月/u)
  if (!month || Number(month[2]) < 1 || Number(month[2]) > 12) return false
  return item.publishedAt.startsWith(`${month[1]}-${month[2]!.padStart(2, '0')}-01`)
}
export function sourcePublicationDate(item: SourceDateRecord): string {
  return hasPublicationMonthOnly(item) ? item.publishedAt.slice(0, 7) : item.publishedAt
}
export function sourcePublicationLabel(item: SourceDateRecord, localized = false): string {
  return hasPublicationMonthOnly(item)
    ? `${sourcePublicationDate(item)} (month only)`
    : localized
      ? new Date(item.publishedAt).toLocaleDateString()
      : item.publishedAt.slice(0, 10)
}
export function sourcePublicationEvidence(item: SourceDateRecord): string {
  return hasPublicationMonthOnly(item)
    ? `${sourcePublicationDate(item)} (publication month only; exact day unavailable)`
    : item.publishedAt
}
export function publicationIntervalEnd(item: SourceDateRecord): number {
  if (!hasPublicationMonthOnly(item)) return Date.parse(item.publishedAt)
  const date = new Date(item.publishedAt)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1) - 1
}

export function sourceMatchReasons(
  item: SourceDateRecord & { readonly reasons: readonly string[] }
): readonly string[] {
  return hasPublicationMonthOnly(item)
    ? item.reasons.filter(
        (reason) => !/^(?:Published|Updated) (?:today|\d+ days? ago)$/u.test(reason)
      )
    : item.reasons
}

function formatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' })
  } catch {
    // An unsupported locale falls back to the system default rather than failing the view.
    return new Intl.DateTimeFormat(undefined, { ...options, timeZone: 'UTC' })
  }
}

/**
 * A stored date in the user's language and region. Formatted in UTC so the calendar day is the
 * one the ISO display showed; unparseable input is shown as stored (bounded). Display only:
 * evidence fields and citations keep the stored ISO value.
 */
export function formatDisplayDate(value: string, locale: string): string {
  const time = Date.parse(value)
  if (Number.isNaN(time)) return value.slice(0, 64)
  return formatter(locale, { dateStyle: 'medium' }).format(time)
}

/** `sourcePublicationLabel` for display in a locale; a month-only date shows only the month. */
export function sourcePublicationDisplay(item: SourceDateRecord, locale: string): string {
  const time = Date.parse(item.publishedAt)
  if (!hasPublicationMonthOnly(item) || Number.isNaN(time))
    return formatDisplayDate(item.publishedAt, locale)
  return `${formatter(locale, { year: 'numeric', month: 'short' }).format(time)} (month only)`
}
