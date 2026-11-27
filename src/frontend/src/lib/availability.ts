import { discoveryApi } from './api'
import type { Slot } from './contracts'

export interface AvailabilityDay {
  date: string
  slots?: Slot[]
  error?: string
}

const cache = new Map<string, { storedAt: number; slots: Slot[] }>()
const cacheLimit = 84
const freshness = 40_000

export function invalidateAvailability(courtID: string) {
  for (const key of cache.keys()) {
    if (key.startsWith(courtID + ':')) cache.delete(key)
  }
}

export async function loadAvailability(courtID: string, dates: string[], signal: AbortSignal): Promise<AvailabilityDay[]> {
  return Promise.all(dates.slice(0, 7).map(async date => {
    const key = courtID + ':' + date
    const cached = cache.get(key)
    if (cached && Date.now() - cached.storedAt < freshness) return { date, slots: cached.slots }
    try {
      const slots = await discoveryApi.courtSlots(courtID, date, signal)
      if (!signal.aborted) {
        cache.delete(key)
        cache.set(key, { storedAt: Date.now(), slots })
        if (cache.size > cacheLimit) {
          const first = cache.keys().next().value
          if (first) cache.delete(first)
        }
      }
      return { date, slots }
    } catch (error) {
      if (signal.aborted) throw error
      return { date, error: 'Availability could not be loaded.' }
    }
  }))
}
