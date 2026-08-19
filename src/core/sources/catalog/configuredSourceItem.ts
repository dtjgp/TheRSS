export type ConfiguredSourceItemKind = 'model' | 'dataset' | 'paper' | 'article' | 'post'

export interface ConfiguredSourceItem {
  readonly id: string
  readonly sourceId: string
  readonly externalId: string
  readonly kind: ConfiguredSourceItemKind
  readonly title: string
  readonly summary: string
  readonly url: string
  readonly publishedAt: string
  readonly authors: readonly string[]
  readonly tags: readonly string[]
  readonly metrics: Readonly<Record<string, number>>
}
