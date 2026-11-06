import {
  llmWikiDailyOriginalUrl,
  llmWikiDailyPaperLabel,
  llmWikiDailyStatusText,
  type LlmWikiDailyOpenRequest,
  type LlmWikiDailyPaper,
  type LlmWikiDailySnapshot
} from '../../shared/llmWikiDaily'
import { column, Controls, heading, label, row, scroll, type NativeContext } from './common'
import type { NativeNode } from './presentation'
import { ReadingWorkspace } from './readingWorkspace'

export class DailyPapersScreen {
  private readonly controls: Controls
  private readonly workspace: ReadingWorkspace
  private snapshot: LlmWikiDailySnapshot | null = null
  private selected = ''
  private loading = false
  private error = ''
  private opening = false
  private version = 0

  constructor(private readonly context: NativeContext) {
    this.controls = new Controls(context)
    this.workspace = new ReadingWorkspace(
      context,
      'daily-papers',
      'daily-papers-list',
      'daily-papers-open-original'
    )
  }

  async enter(): Promise<void> {
    this.workspace.back()
    const read = this.read()
    this.context.focus('daily-papers-back')
    await read
  }

  leave(): void {
    this.version++
    this.loading = false
    this.opening = false
    this.error = ''
  }

  render(back: () => void): NativeNode {
    const b = this.controls
    const snapshot = this.snapshot
    const edition = snapshot?.edition
    const paper = edition?.papers.find(({ arxivId }) => arxivId === this.selected)
    return column(
      'daily-papers',
      [
        row('daily-papers-header', [
          b.button('daily-papers-back', 'Back to Discover', back),
          label('daily-papers-title', 'Daily Papers', { weight: 'title', flex: 1 }),
          b.button(
            'daily-papers-refresh',
            'Refresh',
            () => this.read(),
            !this.loading && !this.opening
          )
        ]),
        label('daily-papers-source', 'llm-wiki · Daily ArXiv Scan', { weight: 'secondary' }),
        ...(this.loading
          ? [label('daily-papers-loading', 'Checking local scan…', { weight: 'secondary' })]
          : []),
        ...(snapshot
          ? [
              label('daily-papers-status', llmWikiDailyStatusText(snapshot)),
              row('daily-papers-edition-actions', [
                label(
                  'daily-papers-checked',
                  `Checked ${new Intl.DateTimeFormat(this.context.locale, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(snapshot.checkedAt))}`,
                  { weight: 'secondary', flex: 1 }
                ),
                ...(edition
                  ? [
                      b.button(
                        'daily-papers-open-digest',
                        'Open digest in Obsidian',
                        () => this.open({ date: edition.date }),
                        !this.opening && !this.loading,
                        `daily-papers-open-digest:${edition.date}`
                      )
                    ]
                  : [])
              ])
            ]
          : []),
        ...(this.error ? [label('daily-papers-error', this.error)] : []),
        ...(edition?.papers.length && paper
          ? [
              ...this.workspace.navigation('Back to papers'),
              this.workspace.apply(
                b.split('daily-papers-split', 'discover', [
                  b.table(
                    'daily-papers-list',
                    'Selected arXiv papers',
                    edition.papers.map((item) => ({
                      id: item.arxivId,
                      title: item.title,
                      subtitle: llmWikiDailyPaperLabel(item)
                    })),
                    paper.arxivId,
                    (id) => this.select(id),
                    {
                      activate: (id) => {
                        this.select(id)
                        this.workspace.open()
                      }
                    }
                  ),
                  this.details(paper, edition.date)
                ])
              )
            ]
          : [])
      ],
      { flex: 1, padding: 12 }
    )
  }

  private details(paper: LlmWikiDailyPaper, date: string): NativeNode {
    const b = this.controls
    return scroll(
      'daily-papers-detail',
      column(
        'daily-papers-detail-body',
        [
          heading('daily-papers-paper-title', paper.title),
          label('daily-papers-priority', llmWikiDailyPaperLabel(paper), { weight: 'secondary' }),
          row('daily-papers-paper-actions', [
            ...(paper.canOpenNote
              ? [
                  {
                    ...b.button(
                      'daily-papers-open-note',
                      'Open note in Obsidian',
                      () => this.open({ date, arxivId: paper.arxivId }),
                      !this.opening && !this.loading,
                      `daily-papers-open-note:${date}:${paper.arxivId}`
                    ),
                    emphasis: 'primary' as const
                  }
                ]
              : []),
            b.button(
              'daily-papers-open-original',
              'Open on arXiv',
              () => this.context.openExternal(llmWikiDailyOriginalUrl(paper.arxivId)),
              true,
              `daily-papers-open-original:${date}:${paper.arxivId}`
            )
          ]),
          ...(paper.reason
            ? [
                label('daily-papers-why', 'Why selected', { weight: 'bold' }),
                label('daily-papers-reason', paper.reason)
              ]
            : []),
          label(
            'daily-papers-evidence',
            paper.canOpenNote
              ? 'The scan ranks reading priority. Check the note for evidence and reading status.'
              : 'The scan ranks reading priority. An identity-checked note is not available.',
            { weight: 'secondary' }
          )
        ],
        { padding: 12 }
      )
    )
  }

  private select(id: string): void {
    this.selected = id
    this.error = ''
    this.context.redraw()
  }

  private async read(): Promise<void> {
    const version = ++this.version
    this.loading = true
    this.error = ''
    this.opening = false
    this.context.redraw()
    try {
      const snapshot = await this.context.api.getLlmWikiDaily()
      if (this.version !== version) return
      const edition = snapshot.edition
      if (edition?.date !== this.snapshot?.edition?.date) this.selected = ''
      this.snapshot = snapshot
      if (!edition?.papers.some(({ arxivId }) => arxivId === this.selected))
        this.selected = edition?.papers[0]?.arxivId ?? ''
    } catch {
      if (this.version !== version) return
      this.snapshot = null
      this.error = 'Daily Papers could not be loaded. Try Refresh.'
    } finally {
      if (this.version === version) {
        this.loading = false
        this.context.redraw()
      }
    }
  }

  private async open(request: LlmWikiDailyOpenRequest): Promise<void> {
    const version = this.version
    this.opening = true
    this.error = ''
    this.context.redraw()
    try {
      await this.context.api.openLlmWikiDaily(request)
    } catch {
      if (this.version === version && (!request.arxivId || request.arxivId === this.selected))
        this.error = 'Obsidian could not open this item. Check Obsidian and refresh the edition.'
    } finally {
      if (this.version === version) {
        this.opening = false
        this.context.redraw()
      }
    }
  }
}
