import {
  llmWikiArxivId,
  llmWikiLibraryStatusSchema,
  type LlmWikiLibraryStatus
} from '../../shared/llmWikiLibrary'
import { column, Controls, label, readableError, row, type NativeContext } from './common'
import type { NativeNode } from './presentation'

/** A small read-only handoff block inside the existing research reader. */
export class WikiStatus {
  private arxivId: string | null = null
  private result: LlmWikiLibraryStatus | null = null
  private busy = false
  private opening = false
  private error = ''
  private version = 0
  private disposed = false
  private readonly controls: Controls
  constructor(
    private readonly context: NativeContext,
    private readonly prefix: string
  ) {
    this.controls = new Controls(context)
  }
  select(item: { source: string; kind?: string; url: string } | null): void {
    const id = item ? llmWikiArxivId(item) : null
    if (id === this.arxivId) return
    this.version++
    this.arxivId = id
    this.result = null
    this.error = ''
    this.opening = false
    this.busy = false
    if (id) void this.refresh(false)
  }
  dispose(): void {
    this.disposed = true
    this.version++
  }
  get visible(): boolean {
    return !!this.arxivId
  }
  async refresh(force = true): Promise<void> {
    if (!this.arxivId || this.disposed) return
    const version = ++this.version,
      id = this.arxivId
    this.busy = true
    this.error = ''
    this.context.redraw()
    try {
      const result = llmWikiLibraryStatusSchema.parse(
        await this.context.api.getLlmWikiStatus({ arxivId: id, refresh: force })
      )
      if (!this.disposed && version === this.version && result.arxivId === id) this.result = result
    } catch (error) {
      if (!this.disposed && version === this.version) {
        this.error = readableError(error)
        this.result = null
      }
    } finally {
      if (!this.disposed && version === this.version) {
        this.busy = false
        this.context.redraw()
      }
    }
  }
  render(): NativeNode {
    const prefix = `${this.prefix}-wiki`,
      result = this.result
    if (!this.arxivId) return column(prefix, [])
    const titles = {
      'not-found': 'No llm-wiki paper record found',
      recorded: 'In llm-wiki',
      'note-missing': 'llm-wiki note missing',
      ambiguous: 'Multiple llm-wiki records',
      unavailable: 'llm-wiki unavailable'
    }
    const title = this.busy
      ? 'Checking llm-wiki…'
      : result
        ? titles[result.status]
        : 'llm-wiki status unavailable'
    return column(
      prefix,
      [
        label(
          `${prefix}-status`,
          `${title}${result?.status === 'recorded' ? (result.notePath ? ` · ${result.level ?? 'Paper note'}${result.readStatus ? ` · Vault status: ${result.readStatus}` : ''}` : ' · Paper record only') : ''}`,
          { weight: 'bold' }
        ),
        ...(result && !this.busy
          ? [
              label(
                `${prefix}-checked`,
                `Checked ${new Intl.DateTimeFormat(this.context.locale, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(result.checkedAt))} · Paper metadata only`,
                { weight: 'secondary', textStyle: 'footnote' }
              )
            ]
          : []),
        ...(result?.notePath || result?.recordPath
          ? [
              label(`${prefix}-path`, result.notePath ?? result.recordPath!, {
                weight: 'secondary',
                textStyle: 'footnote'
              })
            ]
          : []),
        ...(this.error || result?.reason
          ? [label(`${prefix}-reason`, this.error || result!.reason!, { weight: 'secondary' })]
          : []),
        row(`${prefix}-actions`, [
          ...(result?.status === 'recorded'
            ? [
                this.controls.button(
                  `${prefix}-open`,
                  this.opening ? 'Opening Obsidian…' : 'Open in Obsidian',
                  () => this.open(),
                  !this.busy && !this.opening
                )
              ]
            : []),
          {
            ...this.controls.button(
              `${prefix}-refresh`,
              'Recheck llm-wiki',
              () => this.refresh(),
              !this.busy && !this.opening
            ),
            emphasis: 'quiet'
          }
        ])
      ],
      { surface: 'inset', padding: 10, gap: 6 }
    )
  }
  private async open(): Promise<void> {
    if (!this.arxivId || this.opening) return
    const version = this.version,
      id = this.arxivId
    this.opening = true
    this.error = ''
    this.context.redraw()
    try {
      await this.context.api.openLlmWikiNote(id)
    } catch (error) {
      if (!this.disposed && version === this.version) this.error = readableError(error)
    } finally {
      if (!this.disposed && version === this.version) {
        this.opening = false
        this.context.redraw()
      }
    }
  }
}
