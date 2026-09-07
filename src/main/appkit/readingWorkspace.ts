import { Controls, row, type NativeContext } from './common'
import type { NativeNode } from './presentation'

/** AppKit retains both pane instances; compact navigation changes only visibility and layout. */
export class ReadingWorkspace {
  private reading = false
  private readonly controls: Controls
  constructor(
    private readonly context: NativeContext,
    private readonly scope: string,
    private readonly listFocus: string,
    private readonly readingFocus: string
  ) {
    this.controls = new Controls(context)
  }

  get focused(): boolean {
    return this.context.compact() && this.reading
  }
  checkpoint(): () => void {
    const reading = this.reading
    return () => {
      this.reading = reading
      this.context.redraw()
    }
  }
  open(): void {
    this.reading = true
    if (this.context.compact()) this.context.focus(this.readingFocus)
    this.context.redraw()
  }
  back(): void {
    this.reading = false
    this.context.focus(this.listFocus)
    this.context.redraw()
  }
  apply(node: NativeNode): NativeNode {
    return {
      ...node,
      compactPane: this.context.compact() ? (this.reading ? 'detail' : 'list') : undefined
    }
  }
  navigation(backLabel = 'Back to results'): NativeNode[] {
    if (!this.focused) return []
    return [
      row(`${this.scope}-reading-navigation`, [
        this.controls.button(`${this.scope}-back-to-results`, backLabel, () => this.back())
      ])
    ]
  }
}
