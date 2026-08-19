import type { ReactNode } from 'react'
import type { AnalysisArtifact } from '../../shared/models'
import { PAPER_L1_ANALYSIS_PROMPT_VERSION } from '../../shared/analysis'

function tableCells(line: string): readonly string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

function isTableSeparator(line: string): boolean {
  const cells = tableCells(line)
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.replaceAll(' ', '')))
}

function renderAnalysisBlock(block: string, key: string): ReactNode {
  const lines = block.split('\n').filter((line) => line.trim().length > 0)
  if (lines.length >= 2 && isTableSeparator(lines[1]!)) {
    const headers = tableCells(lines[0]!)
    const rows = lines.slice(2).map(tableCells)
    return (
      <div className="analysis-panel__table-wrap" key={key}>
        <table>
          <thead>
            <tr>
              {headers.map((header, index) => (
                <th key={`${key}-header-${index}`} scope="col">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`${key}-row-${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  <td key={`${key}-cell-${rowIndex}-${cellIndex}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (lines.length > 0 && lines.every((line) => /^\s*[-*]\s+/.test(line))) {
    return (
      <ul key={key}>
        {lines.map((line, index) => (
          <li key={`${key}-item-${index}`}>{line.replace(/^\s*[-*]\s+/, '')}</li>
        ))}
      </ul>
    )
  }

  if (lines.length > 0 && lines.every((line) => /^\s*\d+\.\s+/.test(line))) {
    return (
      <ol key={key}>
        {lines.map((line, index) => (
          <li key={`${key}-item-${index}`}>{line.replace(/^\s*\d+\.\s+/, '')}</li>
        ))}
      </ol>
    )
  }

  return <p key={key}>{lines.join('\n')}</p>
}

function renderAnalysisBody(body: string, key: string): readonly ReactNode[] {
  return body
    .trim()
    .split(/\n{2,}/)
    .filter((block) => block.trim().length > 0)
    .map((block, index) => renderAnalysisBlock(block, `${key}-block-${index}`))
}

function AnalysisContent({ content }: { readonly content: string }) {
  const sections = content
    .trim()
    .split(/(?=^#{1,4}\s+)/m)
    .filter((section) => section.trim().length > 0)

  return (
    <div className="analysis-panel__content">
      {sections.map((section, index) => {
        const match = /^(#{1,4})\s+([^\n]+)\n?([\s\S]*)$/.exec(section.trim())
        if (!match) return renderAnalysisBody(section, `analysis-${index}`)
        const heading = match[2]!.trim()
        const headingLevel = match[1]!.length
        return (
          <section className="analysis-panel__section" key={`analysis-${index}`}>
            {headingLevel <= 2 ? (
              <h3>{heading}</h3>
            ) : headingLevel === 3 ? (
              <h4>{heading}</h4>
            ) : (
              <h5>{heading}</h5>
            )}
            {renderAnalysisBody(match[3]!, `analysis-${index}`)}
          </section>
        )
      })}
    </div>
  )
}

export function Onboarding({ onConfigure }: { readonly onConfigure: () => void }) {
  return (
    <section className="onboarding">
      <p className="eyebrow">FIRST SIGNAL</p>
      <h1>Build your research radar</h1>
      <p>
        Choose the arXiv fields, research phrases, GitHub topics, and languages that deserve your
        attention. TheRSS will keep the ranking explainable.
      </p>
      <button type="button" className="primary-button" onClick={onConfigure}>
        Set research interests
      </button>
      <div className="onboarding__sources" aria-label="Supported sources">
        <span>arXiv Atom</span>
        <span>GitHub Interest Radar</span>
        <span>Local-first</span>
      </div>
    </section>
  )
}

export function AnalysisPanel({ artifact }: { readonly artifact: AnalysisArtifact }) {
  const isPaperL1 = artifact.promptVersion === PAPER_L1_ANALYSIS_PROMPT_VERSION
  return (
    <aside
      className={`analysis-panel ${isPaperL1 ? 'analysis-panel--paper-l1' : ''}`}
      aria-label={isPaperL1 ? 'L1 paper analysis result' : 'Analysis result'}
    >
      <div className="analysis-panel__meta">
        <span>{isPaperL1 ? 'L1 PAPER ANALYSIS' : 'ANALYSIS'}</span>
        <strong>
          {artifact.providerName} · {artifact.model}
        </strong>
        <span>{new Date(artifact.createdAt).toLocaleString()}</span>
        <span>
          prompt {artifact.promptVersion} · source {artifact.sourceHash.slice(0, 12)}
        </span>
      </div>
      <AnalysisContent content={artifact.content} />
      <p>
        {isPaperL1
          ? 'Evidence boundary: provisional L1-formatted analysis generated from abstract-level discovery metadata; this is not a verified full-paper deep read.'
          : 'Evidence boundary: generated from discovery metadata; full-paper or source-code claims remain unverified.'}
      </p>
    </aside>
  )
}
