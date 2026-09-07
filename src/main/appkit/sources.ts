import {
  sourcePublicationLabel,
  sourcePublicationEvidence,
  hasPublicationMonthOnly
} from '../../shared/sourceDate'
import { sourceHealthLabel, sourceObservationLabel } from '../../shared/sourceHealth'
import type { SourceContentSnapshot, SourceHealth } from '../../shared/api'
import {
  SOURCE_CATALOG,
  SOURCE_PRIORITIES,
  RESEARCH_AXES,
  RESEARCH_AXIS_LABELS,
  type SourceCatalogEntry
} from '../../shared/sourceCatalog'
import { discoverySourceFromCatalogId } from '../../shared/sourceIdentity'
import { SOURCE_GROUPS, sourceGroup } from '../../shared/sourceGroups'
import {
  column,
  Controls,
  heading,
  label,
  readableError,
  row,
  scroll,
  type NativeContext,
  type NativeScreen
} from './common'
import type { NativeNode } from './presentation'
import { ReadingWorkspace } from './readingWorkspace'

export class SourcesScreen implements NativeScreen {
  attention = false
  private readonly controls: Controls
  private query = ''
  private priority = 'all'
  private axis = 'all'
  private group = 'all'
  private focused = SOURCE_CATALOG[0]?.id ?? ''
  private selected = SOURCE_CATALOG[0]?.id ?? ''
  private activated = false
  private snapshot: SourceContentSnapshot | null = null
  private selectedItem = ''
  private busy = false
  private error = ''
  private version = 0
  private disposed = false
  private readonly workspace: ReadingWorkspace
  constructor(private readonly context: NativeContext) {
    this.controls = new Controls(context)
    this.workspace = new ReadingWorkspace(
      context,
      'sources',
      'sources-list',
      'source-detail-description'
    )
  }
  dispose(): void {
    this.disposed = true
    this.version++
  }

  render(): NativeNode {
    const b = this.controls
    const sources = SOURCE_CATALOG.filter((entry) => this.matches(entry))
    if (!sources.some((entry) => entry.id === this.focused)) this.focused = sources[0]?.id ?? ''
    if (sources.length && !sources.some((entry) => entry.id === this.selected)) {
      this.selected = sources[0]!.id
      this.snapshot = null
      this.activated = false
      this.selectedItem = ''
      this.error = ''
      this.busy = false
      this.version++
    }
    const entry = sources.find((entry) => entry.id === this.selected)
    const failedCount = SOURCE_CATALOG.filter((entry) => this.health(entry) === 'failed').length
    const partialCount = SOURCE_CATALOG.filter((entry) => this.health(entry) === 'partial').length
    return column(
      'sources-page',
      [
        ...(!this.workspace.focused ? [heading('sources-title', 'Sources')] : []),
        ...(!this.workspace.focused
          ? [
              label(
                'sources-summary',
                `22 retained sources · ${failedCount} failed · ${partialCount} partial · ${sources.length} match current filters`,
                { weight: 'secondary' }
              ),
              b.input(
                'sources-query',
                'Search sources',
                this.query,
                (query) => {
                  this.query = query
                  this.context.redraw()
                },
                200,
                { placeholder: 'Search source name, research role, origin or access notes' }
              ),
              row('sources-filters', [
                b.select(
                  'sources-group',
                  'Source group',
                  this.group,
                  [
                    { id: 'all', title: 'All source groups' },
                    ...SOURCE_GROUPS.map((group) => ({
                      id: group.id,
                      title: `${group.title} (${group.sources.length})`
                    }))
                  ],
                  (value) => {
                    this.group = value
                    this.context.redraw()
                  },
                  { width: 240 }
                ),
                b.select(
                  'sources-priority',
                  'Source priority',
                  this.priority,
                  [
                    { id: 'all', title: 'All priorities' },
                    ...SOURCE_PRIORITIES.map((id) => ({ id, title: `Priority ${id}` }))
                  ],
                  (value) => {
                    this.priority = value
                    this.context.redraw()
                  },
                  { width: 160 }
                ),
                b.select(
                  'sources-axis',
                  'Research axis',
                  this.axis,
                  [
                    { id: 'all', title: 'All research axes' },
                    ...RESEARCH_AXES.map((id) => ({ id, title: RESEARCH_AXIS_LABELS[id] }))
                  ],
                  (value) => {
                    this.axis = value
                    this.context.redraw()
                  },
                  { width: 260 }
                ),
                b.check('sources-attention', 'Failed or partial', this.attention, (value) => {
                  this.attention = value
                  this.context.redraw()
                })
              ])
            ]
          : []),
        ...(sources.length
          ? this.workspace.navigation('Back to sources')
          : [
              row('sources-empty-recovery', [
                label('sources-filter-empty', 'No sources match these filters.', { flex: 1 }),
                b.button('sources-reset-filters', 'Clear filters', () => {
                  this.query = ''
                  this.group = 'all'
                  this.priority = 'all'
                  this.axis = 'all'
                  this.attention = false
                  this.workspace.back()
                })
              ])
            ]),
        this.workspace.apply({
          id: 'sources-workspace',
          kind: 'split',
          flex: 1,
          width: 290,
          minWidth: 240,
          maxWidth: 420,
          collapseAt: 700,
          children: [
            b.table(
              'sources-list',
              'Research source catalog',
              sources.map((source) => ({
                id: source.id,
                title: source.name,
                subtitle: `${sourceGroup(discoverySourceFromCatalogId(source.id))?.title ?? source.role} · ${sourceHealthLabel(this.health(source), this.healthDetail(source)?.context)}`
              })),
              this.focused,
              (id) => {
                this.focused = id
                this.context.redraw()
              },
              { activate: (id) => this.activate(id) }
            ),
            entry
              ? this.details(entry)
              : column(
                  'sources-empty',
                  [label('sources-empty-message', 'No sources match these filters.')],
                  { flex: 1 }
                )
          ]
        })
      ],
      { flex: 1 }
    )
  }

  async activate(catalogId: string, refresh = false): Promise<void> {
    const entry = SOURCE_CATALOG.find((entry) => entry.id === catalogId)
    const source = entry ? discoverySourceFromCatalogId(entry.id) : null
    if (!entry || !source) return
    const changed = this.selected !== catalogId
    this.selected = catalogId
    this.focused = catalogId
    this.activated = true
    this.workspace.open()
    if (changed) {
      this.snapshot = null
      this.selectedItem = ''
    }
    this.error = ''
    this.busy = true
    const version = ++this.version
    this.context.redraw()
    try {
      let snapshot =
        refresh && source !== 'github'
          ? await this.context.api.refreshSourceContent(source)
          : await this.context.api.getSourceContent(source)
      if (this.disposed || version !== this.version) return
      this.snapshot = snapshot
      this.context.redraw()
      if (!refresh && snapshot.items.length === 0 && source !== 'github') {
        snapshot = await this.context.api.refreshSourceContent(source)
        if (this.disposed || version !== this.version) return
        this.snapshot = snapshot
      }
    } catch (error) {
      if (!this.disposed && version === this.version) this.error = readableError(error)
    } finally {
      if (!this.disposed && version === this.version) {
        try {
          const dashboard = await this.context.api.getDashboard()
          if (!this.disposed && version === this.version) this.context.data.dashboard = dashboard
        } catch {
          /* Keep the original retrieval error and cached content if the local status read fails. */
        }
      }
      if (version === this.version) {
        this.busy = false
        this.context.redraw()
      }
    }
  }
  private health(entry: SourceCatalogEntry): SourceHealth {
    const source = discoverySourceFromCatalogId(entry.id)
    return source ? (this.context.data.dashboard?.sourceHealth[source] ?? 'idle') : 'idle'
  }
  private healthDetail(entry: SourceCatalogEntry) {
    const source = discoverySourceFromCatalogId(entry.id)
    return source ? this.context.data.dashboard?.sourceHealthDetails[source] : undefined
  }
  private needsAttention(entry: SourceCatalogEntry): boolean {
    return ['failed', 'partial'].includes(this.health(entry))
  }
  private matches(entry: SourceCatalogEntry): boolean {
    if (
      this.group !== 'all' &&
      sourceGroup(discoverySourceFromCatalogId(entry.id))?.id !== this.group
    )
      return false
    const query = this.query.trim().toLocaleLowerCase()
    const searchable = [
      entry.name,
      entry.role,
      entry.reason,
      entry.origin,
      entry.accessNote,
      ...entry.researchAxes.map((axis) => RESEARCH_AXIS_LABELS[axis])
    ]
      .join(' ')
      .toLocaleLowerCase()
    return (
      (!query || searchable.includes(query)) &&
      (this.priority === 'all' || entry.priority === this.priority) &&
      (this.axis === 'all' || entry.researchAxes.some((axis) => axis === this.axis)) &&
      (!this.attention || this.needsAttention(entry))
    )
  }

  private details(entry: SourceCatalogEntry): NativeNode {
    const b = this.controls,
      source = discoverySourceFromCatalogId(entry.id),
      snapshot = this.snapshot
    const health = this.healthDetail(entry)
    const item = snapshot?.items.find((item) => item.id === this.selectedItem) ?? snapshot?.items[0]
    const status = snapshot
      ? {
          cached: 'Cached snapshot',
          fetched: 'Freshly fetched',
          partial: 'Fetched · partial',
          no_results: 'Fetched · no results'
        }[snapshot.status]
      : 'No content opened'
    return scroll(
      'sources-detail-scroll',
      column(
        `source-detail-${entry.id}`,
        [
          heading('source-detail-title', entry.name),
          label(
            'source-detail-health',
            `${sourceHealthLabel(this.health(entry), health?.context)} · ${sourceObservationLabel(health)}`,
            { weight: 'secondary' }
          ),
          ...(health?.errorMessage ? [label('source-health-error', health.errorMessage)] : []),
          label(
            'source-observation-boundary',
            'Last recorded outcome; cached content below is separate from this observation.',
            { weight: 'secondary' }
          ),
          b.rich(
            'source-detail-description',
            `${entry.role}\n\n${entry.reason}\n\nPriority: ${entry.priority}\n\nResearch axes: ${entry.researchAxes.map((axis) => RESEARCH_AXIS_LABELS[axis]).join(', ')}\n\nOrigin: ${entry.origin}\n\nAccess: ${entry.accessNote}`
          ),
          row('source-detail-actions', [
            b.button(
              'sources-open-site',
              'Open source website',
              () => this.context.openExternal(entry.url),
              true,
              `source:${entry.id}:open`
            ),
            b.button(
              'sources-refresh',
              'Refresh content',
              () => this.activate(entry.id, true),
              !this.busy && source !== 'github',
              `source:${entry.id}:refresh`
            )
          ]),
          label(
            'source-retrieval-policy',
            source === 'github'
              ? 'Use Discover for query-based GitHub retrieval. This source view is read-only.'
              : source === 'arxiv'
                ? 'arXiv content covers the latest source day.'
                : entry.id === 'folo:611'
                  ? 'Publication months overlapping the 30-day window are included; exact days may be unavailable.'
                  : 'Source content covers a rolling 30-day window.',
            { weight: 'secondary' }
          ),
          ...(!this.activated
            ? [
                label(
                  'sources-activation-hint',
                  'Press Enter or click a source to open its content. Moving keyboard focus does not fetch.'
                )
              ]
            : []),
          ...(this.error ? [label('source-content-error', this.error)] : []),
          ...(snapshot
            ? [
                heading('source-content-heading', status),
                label(
                  'source-content-window',
                  `${snapshot.windowStart} — ${snapshot.windowEnd}\nIndexed: ${snapshot.lastIndexedAt ?? 'Not indexed'} · ${snapshot.returnedCount} returned · ${snapshot.rejectedCount} rejected`,
                  { weight: 'secondary' }
                ),
                ...(snapshot.items.length
                  ? [
                      {
                        ...b.table(
                          'source-content-items',
                          'Read-only source content',
                          snapshot.items.map((item) => ({
                            id: item.id,
                            title: item.title,
                            subtitle: `${sourcePublicationLabel(item)} · ${item.kind ?? 'item'}`
                          })),
                          item?.id ?? '',
                          (id) => {
                            this.selectedItem = id
                            this.context.redraw()
                          }
                        ),
                        flex: 0,
                        height: 210
                      },
                      ...(item
                        ? [
                            heading('source-content-title', item.title),
                            b.button(
                              'source-item-open',
                              'Open original item',
                              () => this.context.openExternal(item.url),
                              true,
                              `source-item:${item.id}:open`
                            ),
                            b.rich(
                              'source-content-summary',
                              `${item.summary}\n\nPublished: ${sourcePublicationEvidence(item)}\nUpdated: ${hasPublicationMonthOnly(item) ? 'Not supplied separately' : item.updatedAt}\n\nSource metadata only.`
                            )
                          ]
                        : [])
                    ]
                  : [label('source-content-empty', 'No items returned for this source window.')])
              ]
            : [])
        ],
        { padding: 18 }
      )
    )
  }
}
