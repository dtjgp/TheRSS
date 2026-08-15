import type { TheRSSApi } from '../../shared/api'

declare global {
  interface Window {
    therss: TheRSSApi
  }
}

export {}
