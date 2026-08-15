export type SourceHealth = 'idle' | 'refreshing' | 'healthy' | 'partial' | 'failed'
export type TriageState = 'new' | 'viewed' | 'saved' | 'dismissed'

export interface DashboardItem {
  readonly id: string
  readonly source: 'arxiv' | 'github'
  readonly title: string
  readonly summary: string
  readonly url: string
  readonly publishedAt: string
  readonly score: number
  readonly triageState: TriageState
  readonly reasons: readonly string[]
}

export interface DashboardSnapshot {
  readonly date: string
  readonly profileName: string | null
  readonly lastRefreshAt: string | null
  readonly sourceHealth: {
    readonly arxiv: SourceHealth
    readonly github: SourceHealth
  }
  readonly counts: {
    readonly total: number
    readonly arxiv: number
    readonly github: number
    readonly unread: number
  }
  readonly items: readonly DashboardItem[]
}

export interface TheRSSApi {
  getDashboard(): Promise<DashboardSnapshot>
  getInterestProfile(): Promise<InterestProfile | null>
  saveInterestProfile(profile: InterestProfile): Promise<DashboardSnapshot>
  refresh(): Promise<DashboardSnapshot>
  setTriageState(id: string, state: TriageState): Promise<DashboardSnapshot>
}
import type { InterestProfile } from '../core/interests/interestProfile'
