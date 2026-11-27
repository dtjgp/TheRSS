import type {
  LlmWikiInboxPreview,
  LlmWikiInboxReceipt,
  LlmWikiInboxStatus
} from '../../shared/llmWikiInbox'
import { column, type Controls, label, row } from './common'
import type { NativeNode } from './presentation'

const INBOX_RECEIPT_STATUS: Record<LlmWikiInboxStatus, readonly [string, boolean]> = {
  running: ['In progress', false],
  completed: ['Completed', false],
  partial: ['Partially completed', true],
  blocked: ['Blocked', true],
  'no-change': ['No change', false],
  'no-source': ['No source', true],
  skipped: ['Skipped', false],
  failed: ['Failed', true]
}

export function renderInboxPreviewSections(
  controls: Controls,
  preview: LlmWikiInboxPreview
): NativeNode[] {
  const paths = preview.intendedPaths
  const blockers = preview.blockers
  return [
    column(
      'inbox-capture-summary',
      [
        label('inbox-capture-title', preview.title, { textStyle: 'headline', wrap: true }),
        label(
          'inbox-capture-destination',
          `${preview.vaultLabel} · ${preview.destination} (${preview.kind} from ${preview.source})`,
          { weight: 'secondary', wrap: true }
        ),
        label('inbox-capture-url', preview.url, { weight: 'secondary', wrap: true })
      ],
      { surface: 'inset', padding: 12, gap: 6 }
    ),
    ...(blockers.length
      ? [
          column(
            'inbox-capture-blockers',
            [
              row('inbox-capture-blockers-row', [
                {
                  id: 'inbox-capture-blockers-symbol',
                  kind: 'symbol',
                  symbol: 'exclamationmark.circle',
                  title: 'Blocked',
                  size: 16
                },
                label(
                  'inbox-capture-blockers-heading',
                  `${blockers.length} ${blockers.length === 1 ? 'blocker prevents' : 'blockers prevent'} this write`,
                  { weight: 'bold', flex: 1 }
                )
              ]),
              controls.rich(
                'inbox-capture-blockers-list',
                blockers.map((item) => `- ${item}`).join('\n')
              )
            ],
            { gap: 4 }
          )
        ]
      : [label('inbox-capture-blockers', 'No blockers', { weight: 'secondary' })]),
    label(
      'inbox-capture-paths-heading',
      paths.length
        ? `Will write ${paths.length} ${paths.length === 1 ? 'file' : 'files'}`
        : 'No paths approved',
      { weight: 'bold' }
    ),
    ...(paths.length
      ? [controls.rich('inbox-capture-paths', paths.map((path) => `- ${path}`).join('\n'))]
      : []),
    label('inbox-capture-evidence-heading', 'Evidence boundary', { weight: 'bold' }),
    label('inbox-capture-evidence', preview.evidenceBoundary, { wrap: true }),
    label('inbox-capture-technical-heading', 'Technical details', { weight: 'bold' }),
    controls.rich(
      'inbox-capture-technical',
      `Source hash: ${preview.sourceHash}\nContract hash: ${preview.contractHash}\nExpires: ${preview.expiresAt}`
    )
  ]
}

export function renderInboxReceiptSection(
  controls: Controls,
  receipt: LlmWikiInboxReceipt,
  previous: boolean
): NativeNode[] {
  const [phrase, attention] = INBOX_RECEIPT_STATUS[receipt.status]
  return [
    row('inbox-capture-receipt-status-row', [
      ...(attention
        ? [
            {
              id: 'inbox-capture-receipt-status-symbol',
              kind: 'symbol' as const,
              symbol: 'exclamationmark.circle' as const,
              title: phrase,
              size: 16
            }
          ]
        : []),
      label('inbox-capture-receipt-status', phrase, { weight: 'bold', flex: 1 })
    ]),
    controls.rich(
      'inbox-capture-receipt-text',
      `## ${previous ? 'Previous receipt' : 'Operation receipt'}\nEvidence: ${receipt.evidenceTier}\n\n${receipt.summary}\n\nCreated:\n${receipt.createdPaths.map((path) => `- ${path}`).join('\n')}\n\nUpdated:\n${receipt.updatedPaths.map((path) => `- ${path}`).join('\n')}\n\nAudit: ${receipt.auditPath ?? 'Unavailable'}\n\n${receipt.blockers.join('\n')}`
    )
  ]
}
