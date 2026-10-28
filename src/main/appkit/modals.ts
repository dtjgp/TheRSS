import type {
  LlmWikiPromotionPreview,
  LlmWikiPromotionReceipt,
  LlmWikiPromotionStatus
} from '../../shared/llmWikiPromotion'
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

/** Receipt status phrase, and whether the outcome needs the user's attention. */
const RECEIPT_STATUS: Record<LlmWikiPromotionStatus, readonly [string, boolean]> = {
  running: ['In progress', false],
  completed: ['Completed', false],
  partial: ['Partially completed', true],
  blocked: ['Blocked', true],
  'no-change': ['No change', false],
  'no-source': ['No source', true],
  skipped: ['Skipped', false],
  failed: ['Failed', true]
}

export class NativeModals {
  private readonly controls: Controls
  private kind: 'promotion' | 'document' | null = null
  private version = 0
  private busy = false
  private message = ''
  private document = { title: '', content: '' }
  private itemId = ''
  private sessionId: string | undefined
  private preview: LlmWikiPromotionPreview | null = null
  private receipt: LlmWikiPromotionReceipt | null = null
  private consumed = false
  // The final confirmation is a standard macOS alert. It waits until the window's current
  // sheet ends, so the preview sheet steps aside until the confirmation and write finish.
  private confirming = false
  private disposed = false
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
  openDocument(title: string, content: string): void {
    if (this.kind === 'promotion') return
    this.version++
    this.kind = 'document'
    this.document = { title, content }
    this.busy = false
    this.message = ''
    this.focus = 'modal-close'
    this.context.redraw()
  }
  dispose(): void {
    this.disposed = true
    this.version++
    this.kind = null
  }
  async close(): Promise<void> {
    if (this.blocksNavigation) return
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
    if (!this.kind || this.confirming) return undefined
    const b = this.controls
    const title = this.kind === 'promotion' ? 'Promote paper to llm-wiki' : this.document.title
    const closeAction = this.context.presentation.action(
      `modal-close:${this.kind}:${this.version}`,
      () => this.close()
    )
    return column(
      `modal-${this.kind}`,
      [
        heading('modal-heading', title),
        ...(this.message ? [label('modal-message', this.message)] : []),
        ...(this.kind === 'promotion'
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
        // macOS sheet order: actions sit at the trailing edge with the primary action last.
        row('modal-footer', [
          label('modal-footer-spacer', '', { flex: 1 }),
          ...(this.kind === 'promotion' ? this.promotionSecondaryActions() : []),
          {
            ...b.button(
              'modal-close',
              this.kind === 'promotion' && this.preview?.previewId && !this.consumed
                ? 'Cancel preview'
                : 'Close',
              () => this.close(),
              !this.blocksNavigation,
              `modal-close:${this.kind}:${this.version}`
            ),
            // Return closes read-only documents only; the promotion sheet guards a vault write.
            ...(this.kind === 'document' ? { shortcut: 'return' as const } : {})
          },
          ...(this.kind === 'promotion' ? this.promotionPrimaryAction() : [])
        ])
      ],
      { title, padding: 22, flex: 1, context: closeAction }
    )
  }

  private promotionContent(): NativeNode[] {
    const preview = this.preview,
      receipt = this.receipt
    return [
      ...(this.busy ? [this.promotionProgress()] : []),
      scroll(
        'promotion-scroll',
        column(
          'promotion-document',
          [
            ...(preview ? this.previewSections(preview) : []),
            ...(receipt ? this.receiptSection(receipt, !!preview) : [])
          ],
          { padding: 4, gap: 12 }
        )
      )
    ]
  }
  private promotionProgress(): NativeNode {
    const text = this.consumed
      ? 'Completing the selected operation…'
      : 'Preparing the PDF and write preview…'
    return row('promotion-progress-row', [
      { id: 'promotion-progress-indicator', kind: 'progress', title: text },
      label('promotion-progress', text, { weight: 'secondary', flex: 1 })
    ])
  }
  /** What will be written and what stops it come first; hashes stay available at the end. */
  private previewSections(preview: LlmWikiPromotionPreview): NativeNode[] {
    const b = this.controls,
      paths = preview.intendedPaths,
      blockers = preview.blockers
    return [
      column(
        'promotion-summary',
        [
          label('promotion-paper-title', preview.title, { textStyle: 'headline', wrap: true }),
          label(
            'promotion-destination',
            `${preview.vaultLabel} · Review level ${preview.level ?? 'Blocked'}`,
            { weight: 'secondary', wrap: true }
          ),
          label('promotion-rationale', preview.routingRationale, { wrap: true })
        ],
        { surface: 'inset', padding: 12, gap: 6 }
      ),
      ...(blockers.length
        ? [
            column(
              'promotion-blockers',
              [
                row('promotion-blockers-row', [
                  {
                    id: 'promotion-blockers-symbol',
                    kind: 'symbol',
                    symbol: 'exclamationmark.circle',
                    title: 'Blocked',
                    size: 16
                  },
                  label(
                    'promotion-blockers-heading',
                    `${blockers.length} ${blockers.length === 1 ? 'blocker prevents' : 'blockers prevent'} this write`,
                    { weight: 'bold', flex: 1 }
                  )
                ]),
                b.rich('promotion-blockers-list', blockers.map((item) => `- ${item}`).join('\n'))
              ],
              { gap: 4 }
            )
          ]
        : [label('promotion-blockers', 'No blockers', { weight: 'secondary' })]),
      label(
        'promotion-paths-heading',
        paths.length
          ? `Will write ${paths.length} ${paths.length === 1 ? 'file' : 'files'}`
          : 'No paths approved',
        { weight: 'bold' }
      ),
      ...(paths.length
        ? [b.rich('promotion-paths', paths.map((path) => `- ${path}`).join('\n'))]
        : []),
      label('promotion-evidence-heading', 'Evidence boundary', { weight: 'bold' }),
      label('promotion-evidence', preview.evidenceBoundary, { wrap: true }),
      label('promotion-technical-heading', 'Technical details', { weight: 'bold' }),
      b.rich(
        'promotion-technical',
        `${preview.pdf ? `PDF: ${preview.pdf.pageCount} pages · ${preview.pdf.byteSize} bytes\nSHA-256: ${preview.pdf.sha256}` : 'No verified PDF.'}\n\nSource hash: ${preview.sourceHash}\nContract hash: ${preview.contractHash}\nExpires: ${preview.expiresAt}`
      )
    ]
  }
  private receiptSection(receipt: LlmWikiPromotionReceipt, previous: boolean): NativeNode[] {
    const [phrase, attention] = RECEIPT_STATUS[receipt.status]
    return [
      row('promotion-receipt-status-row', [
        ...(attention
          ? [
              {
                id: 'promotion-receipt-status-symbol',
                kind: 'symbol' as const,
                symbol: 'exclamationmark.circle' as const,
                title: phrase,
                size: 16
              }
            ]
          : []),
        label('promotion-receipt-status', phrase, { weight: 'bold', flex: 1 })
      ]),
      this.controls.rich(
        'promotion-receipt-text',
        `## ${previous ? 'Previous receipt' : 'Operation receipt'}\nEvidence: ${receipt.evidenceTier}\n\n${receipt.summary}\n\nCreated:\n${receipt.createdPaths.map((path) => `- ${path}`).join('\n')}\n\nUpdated:\n${receipt.updatedPaths.map((path) => `- ${path}`).join('\n')}\n\nAudit: ${receipt.auditPath ?? 'Unavailable'}\n\n${receipt.blockers.join('\n')}`
      )
    ]
  }
  private promotionSecondaryActions(): NativeNode[] {
    const preview = this.preview
    return !this.busy && (!preview || this.consumed || !preview.ready)
      ? [
          this.controls.button('promotion-new-preview', 'Create a new preview', () =>
            this.openPromotion(this.itemId, this.sessionId)
          )
        ]
      : []
  }
  private promotionPrimaryAction(): NativeNode[] {
    const preview = this.preview
    return preview?.ready && preview.previewId && !this.consumed
      ? [
          {
            ...this.controls.button(
              'promotion-confirm',
              'Write to llm-wiki…',
              () => this.confirmPromotion(),
              !this.busy,
              `promotion-confirm:${preview.previewId}`
            ),
            emphasis: 'primary'
          }
        ]
      : []
  }
  private async confirmPromotion(): Promise<void> {
    const id = this.preview?.previewId
    if (!id || !this.preview?.ready || this.consumed || this.busy) return
    this.consumed = true
    this.busy = true
    this.confirming = true
    this.message = ''
    this.context.redraw()
    try {
      this.receipt = await this.context.api.confirmLlmWikiPromotion(id)
    } catch (error) {
      this.message = readableError(error)
    } finally {
      this.preview = null
      this.busy = false
      this.confirming = false
      this.focus = 'modal-close'
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
