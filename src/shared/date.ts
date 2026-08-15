export function localDateKey(date: Date): string {
  if (!Number.isFinite(date.getTime())) throw new Error('Cannot format an invalid date')

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isTimestampOnLocalDate(timestamp: string, dateKey: string): boolean {
  const date = new Date(timestamp)
  return Number.isFinite(date.getTime()) && localDateKey(date) === dateKey
}
