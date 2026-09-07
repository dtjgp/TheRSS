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
