import { useCallback } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { PlayerNotification } from './contracts'
import { managerApi } from './manager-api'
import type { Session } from './session'
import { useResource } from './use-resource'

export interface ManagerContext {
  session: Session
  accountStatus: string
}

export const useManager = () => useOutletContext<ManagerContext>()

export function useManagedFacility() {
  const { session } = useManager()
  return useResource(useCallback((signal: AbortSignal) => managerApi.facility(session.userId, signal), [session.userId]))
}

export function useManagerBookings(view: 'upcoming' | 'completed') {
  const { session } = useManager()
  return useResource(useCallback((signal: AbortSignal) => managerApi.bookings(session.userId, view, signal), [session.userId, view]))
}

export function useManagerMaintenance() {
  const { session } = useManager()
  return useResource(useCallback((signal: AbortSignal) => managerApi.maintenances(session.userId, signal), [session.userId]))
}

export function managerNoticeCopy(notice: PlayerNotification) {
  // The backend sends identical confirmation notices for manual and Stripe confirmations.
  if (notice.type === 'BOOKING_CONFIRMED') {
    return { title: 'Booking confirmed', message: notice.message?.replace(/has been paid and confirmed\./, 'has been confirmed.') ?? '' }
  }
  return notice
}
