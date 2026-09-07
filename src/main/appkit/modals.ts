import {
  localSearchQuerySchema,
  type LocalSearchResponse,
  type LocalSearchResult
} from '../../shared/localSearch'
import type {
  LlmWikiPromotionPreview,
  LlmWikiPromotionReceipt
} from '../../shared/llmWikiPromotion'
import { sourceDisplayName } from '../../shared/sourceIdentity'
import {
  column,
  Controls,
  heading,
  label,
  readableError,
  row,
  scroll,
  type NativeContext
} from './common'
import type { NativeNode } from './presentation'

const resultKey = (item: LocalSearchResult): string => `${item.kind}:${item.id}`

export class NativeModals {
  private readonly controls: Controls
  private kind: 'search' | 'promotion' | 'document' | null = null
  private version = 0
  private query = ''
  private response: LocalSearchResponse | null = null
  private selectedResult = ''
  private busy = false
  private opening = false
  private message = ''
  private document = { title: '', content: '' }
  private itemId = ''
  private sessionId: string | undefined
  private preview: LlmWikiPromotionPreview | null = null
  private receipt: LlmWikiPromotionReceipt | null = null
  private consumed = false
  private disposed = false
  private searchTimer: ReturnType<typeof setTimeout> | undefined
  focus: string | undefined

  constructor(private readonly context: NativeContext) {
    this.controls = new Controls(context)
  }
  get visible(): boolean {
    return this.kind !== null
  }
  get blocksNavigation(): boolean {
    return this.kind === 'promotion' && this.busy
  }
  get canOpenSearch(): boolean {
    return this.kind !== 'promotion'
  }
  openSearch(restore = false): void {
    if (this.kind === 'promotion') return
    this.clearSearchTimer()
    this.version++
    this.kind = 'search'
    if (!restore) {
      this.query = ''
      this.response = null
      this.selectedResult = ''
    }
    this.message = ''
    this.busy = false
    this.opening = false
    this.focus =
      restore && this.response?.results.length ? 'local-search-results' : 'local-search-query'
    this.context.redraw()
  }
  openDocument(title: string, content: string): void {
    if (this.kind === 'promotion') return
    this.clearSearchTimer()
    this.version++
    this.kind = 'document'
    this.document = { title, content }
    this.busy = false
    this.message = ''
    this.focus = 'modal-close'
    this.context.redraw()
  }
  dispose(): void {
    this.clearSearchTimer()
    this.disposed = true
    this.version++
    this.kind = null
  }
  async close(): Promise<void> {
    if (this.blocksNavigation) return
    this.clearSearchTimer()
    if (this.kind === 'promotion' && this.preview?.previewId && !this.consumed)
      await this.cancelPromotion()
    this.version++
    this.kind = null
    this.busy = false
    this.focus = undefined
    this.context.redraw()
  }

  async openPromotion(itemId: string, sessionId?: string): Promise<void> {
    if (this.blocksNavigation) return
    await this.close()
    this.kind = 'promotion'
    this.itemId = itemId
    this.sessionId = sessionId
    this.preview = null
    this.receipt = null
    this.consumed = false
    this.message = ''
    this.busy = true
    const version = ++this.version
    this.context.redraw()
    try {
      this.receipt = await this.context.api.getLatestLlmWikiPromotion(itemId).catch(() => null)
      const preview = await this.context.api.previewLlmWikiPromotion(itemId, sessionId)
      if (!this.disposed && version === this.version) this.preview = preview
    } catch (error) {
      if (!this.disposed && version === this.version) this.message = readableError(error)
    } finally {
      if (version === this.version) {
        this.busy = false
        this.focus = 'modal-close'
        this.context.redraw()
      }
    }
  }

  render(): NativeNode | undefined {
    if (!this.kind) return undefined
    const b = this.controls
    const title =
      this.kind === 'search'
        ? 'Find Local Research'
        : this.kind === 'promotion'
          ? 'Promote paper to llm-wiki'
          : this.document.title
    const closeAction = this.context.presentation.action(
      `modal-close:${this.kind}:${this.version}`,
      () => this.close()
    )
    return column(
      `modal-${this.kind}`,
      [
        heading('modal-heading', title),
        ...(this.message ? [label('modal-message', this.message)] : []),
        ...(this.kind === 'search'
          ? this.searchContent()
          : this.kind === 'promotion'
            ? this.promotionContent()
            : [
                scroll(
                  'document-modal-scroll',
                  column(
                    'document-modal-body',
                    [b.rich('document-modal-content', this.document.content)],
                    { padding: 4 }
                  )
                )
              ]),
        row('modal-footer', [
          b.button(
            'modal-close',
            this.kind === 'promotion' && this.preview?.previewId && !this.consumed
              ? 'Cancel preview'
              : 'Close',
            () => this.close(),
            !this.blocksNavigation,
            `modal-close:${this.kind}:${this.version}`
          )
        ])
      ],
      { title, padding: 22, flex: 1, context: closeAction }
    )
  }

  private searchContent(): NativeNode[] {
    const b = this.controls,
      response = this.response
    const selected =
      response?.results.find((item) => resultKey(item) === this.selectedResult) ??
      response?.results[0]
    return [
      row('local-search-input-row', [
        b.input(
          'local-search-query',
          'Search saved items, sessions and analyses',
          this.query,
          (query) => this.changeQuery(query),
          200,
          {
            flex: 1,
            enabled: !this.opening,
            activate: this.context.presentation.action('local-search-enter', () => this.search())
          }
        )
      ]),
      label(
        'local-search-instructions',
        this.opening
          ? 'Opening local record…'
          : this.busy
            ? 'Searching local records…'
            : 'Type 2–200 characters to search locally. Click a result or press Return on it to open.',
        { weight: 'secondary' }
      ),
      ...(response
        ? [
            label(
              'local-search-result-count',
              `${response.results.length} ${response.results.length === 1 ? 'result' : 'results'} for “${response.query}”`
            )
          ]
        : []),
      ...(response?.results.length
        ? [
            b.table(
              'local-search-results',
              'Local research results',
              response.results.map((item) => ({
                id: resultKey(item),
                title: item.title,
                subtitle: `${{ saved: 'Saved item', discover: 'Search session', analysis: 'Stored analysis' }[item.kind]} · ${sourceDisplayName(item.source)} · ${item.createdAt.slice(0, 10)}`
              })),
              selected ? resultKey(selected) : '',
              (id) => {
                this.selectedResult = id
                this.context.redraw()
              },
              {
                activate: (id) => {
                  this.selectedResult = id
                  return this.openLocalResult()
                }
              }
            ),
            ...(selected
              ? [
                  label('local-search-selected-detail', selected.detail),
                  row('local-search-result-actions', [
                    b.button(
                      'local-search-open',
                      'Open original',
                      () => this.context.openExternal(selected.url),
                      true,
                      `local-result:${selected.id}:open`
                    )
                  ])
                ]
              : [])
          ]
        : [
            column(
              'local-search-empty',
              [
                label(
                  'local-search-empty-message',
                  response
                    ? 'No matching local records.'
                    : 'Search Saved research, Discover sessions and stored analyses.'
                )
              ],
              { flex: 1 }
            )
          ])
    ]
  }
  private clearSearchTimer(): void {
    if (this.searchTimer !== undefined) clearTimeout(this.searchTimer)
    this.searchTimer = undefined
  }
  private changeQuery(query: string): void {
    if (this.opening) return
    this.clearSearchTimer()
    this.version++
    this.query = query
    this.response = null
    this.selectedResult = ''
    this.message = ''
    this.busy = false
    if (localSearchQuerySchema.safeParse(query).success)
      this.searchTimer = setTimeout(() => {
        this.searchTimer = undefined
        void this.search()
      }, 250)
    this.context.redraw()
  }
  private async openLocalResult(): Promise<void> {
    const selected =
      this.response?.results.find((item) => resultKey(item) === this.selectedResult) ??
      this.response?.results[0]
    if (!selected || this.busy || this.kind !== 'search') return
    const version = this.version
    const isCurrent = () => !this.disposed && version === this.version && this.kind === 'search'
    this.busy = true
    this.opening = true
    this.message = ''
    this.context.redraw()
    try {
      const message = await this.context.openLocal(selected.target, isCurrent)
      if (isCurrent() && message) this.message = message
    } catch (error) {
      if (isCurrent()) this.message = readableError(error)
    } finally {
      if (isCurrent()) {
        this.busy = false
        this.opening = false
        this.context.redraw()
      }
    }
  }
  private async search(): Promise<void> {
    this.clearSearchTimer()
    const parsed = localSearchQuerySchema.safeParse(this.query)
    if (!parsed.success || this.busy || this.kind !== 'search' || this.disposed) return
    const version = this.version
    this.busy = true
    this.message = ''
    this.context.redraw()
    try {
      const response = await this.context.api.searchLocal(parsed.data)
      if (!this.disposed && version === this.version) {
        this.response = response
        this.selectedResult = response.results[0] ? resultKey(response.results[0]) : ''
      }
    } catch (error) {
      if (!this.disposed && version === this.version) this.message = readableError(error)
    } finally {
      if (version === this.version) {
        this.busy = false
        this.context.redraw()
      }
    }
  }
  private promotionContent(): NativeNode[] {
    const b = this.controls,
      preview = this.preview,
      receipt = this.receipt
    return [
      ...(this.busy
        ? [
            label(
              'promotion-progress',
              this.consumed
                ? 'Completing the selected operation…'
                : 'Preparing the PDF and write preview…'
            )
          ]
        : []),
      scroll(
        'promotion-scroll',
        column(
          'promotion-document',
          [
            ...(preview
              ? [
                  b.rich(
                    'promotion-preview-text',
                    `# ${preview.title}\n\nDestination: ${preview.vaultLabel}\nReview level: ${preview.level ?? 'Blocked'}\n\n${preview.routingRationale}\n\n## Evidence boundary\n${preview.evidenceBoundary}\n\n## Intended paths\n${preview.intendedPaths.map((path) => `- ${path}`).join('\n') || 'No paths approved.'}\n\n## PDF verification\n${preview.pdf ? `${preview.pdf.pageCount} pages · ${preview.pdf.byteSize} bytes\nSHA-256: ${preview.pdf.sha256}` : 'No verified PDF.'}\n\n## Blockers\n${preview.blockers.map((blocker) => `- ${blocker}`).join('\n') || 'None'}\n\nSource hash: ${preview.sourceHash}\nContract hash: ${preview.contractHash}\nExpires: ${preview.expiresAt}`
                  )
                ]
              : []),
            ...(receipt
              ? [
                  b.rich(
                    'promotion-receipt-text',
                    `## ${preview ? 'Previous receipt' : 'Operation receipt'}\nStatus: ${receipt.status}\nEvidence: ${receipt.evidenceTier}\n\n${receipt.summary}\n\nCreated:\n${receipt.createdPaths.map((path) => `- ${path}`).join('\n')}\n\nUpdated:\n${receipt.updatedPaths.map((path) => `- ${path}`).join('\n')}\n\nAudit: ${receipt.auditPath ?? 'Unavailable'}\n\n${receipt.blockers.join('\n')}`
                  )
                ]
              : [])
          ],
          { padding: 4 }
        )
      ),
      ...(preview?.ready && preview.previewId && !this.consumed
        ? [
            b.button(
              'promotion-confirm',
              'Confirm previewed write…',
              () => this.confirmPromotion(),
              !this.busy,
              `promotion-confirm:${preview.previewId}`
            )
          ]
        : []),
      ...(!this.busy && (!preview || this.consumed || !preview.ready)
        ? [
            b.button('promotion-new-preview', 'Create a new preview', () =>
              this.openPromotion(this.itemId, this.sessionId)
            )
          ]
        : [])
    ]
  }
  private async confirmPromotion(): Promise<void> {
    const id = this.preview?.previewId
    if (!id || !this.preview?.ready || this.consumed || this.busy) return
    this.consumed = true
    this.busy = true
    this.message = ''
    this.context.redraw()
    try {
      this.receipt = await this.context.api.confirmLlmWikiPromotion(id)
    } catch (error) {
      this.message = readableError(error)
    } finally {
      this.preview = null
      this.busy = false
      this.context.redraw()
    }
  }
  private async cancelPromotion(): Promise<void> {
    const id = this.preview?.previewId
    if (!id || this.consumed || this.busy) return
    this.consumed = true
    this.busy = true
    this.context.redraw()
    try {
      this.receipt = await this.context.api.cancelLlmWikiPromotion(id)
    } catch (error) {
      this.context.notify(readableError(error), 'error')
    } finally {
      this.preview = null
      this.busy = false
      this.context.redraw()
    }
  }
}
