import { ApiError, apiRequest, discoveryApi, playerApi } from './api'
import type { Booking, BookingStatus, Court, Facility } from './contracts'

export type FacilityUpdate = Pick<Facility, 'name' | 'location' | 'openingTime' | 'closingTime'>
export type CourtUpdate = Omit<Court, 'courtID' | 'managerId' | 'facilityId' | 'maintenanceFrom' | 'maintenanceTo'>
export interface CourtSlot { startTime: string; endTime: string; display: string }

export interface ManagerBooking {
  bookingID: string
  courtName: string
  sportType: string
  playerName: string
  playerEmail: string
  bookingDate: string
  timeSlot: string
  totalCost: number
  status: BookingStatus
}

export interface MaintenanceWindow {
  courtID: string
  courtName: string
  sportType: string
  status: string
  maintenanceFrom: string
  maintenanceTo: string | null
}

type MaintenanceDates = Pick<MaintenanceWindow, 'maintenanceFrom' | 'maintenanceTo'>
const encode = encodeURIComponent
const maintenancePath = (id: string) => `/api/manager/courts/${encode(id)}/schedule-maintenance` as const

export const managerApi = {
  async facility(managerID: string, signal: AbortSignal) {
    const owned = await apiRequest<Facility>('/api/facilities/mine', { signal })
    if (owned.managerId !== managerID) throw new ApiError('Courtly could not verify the assigned facility.')
    const detail = await discoveryApi.facility(owned.facilityID, signal)
    if (detail.facility.managerId !== managerID || detail.facility.facilityID !== owned.facilityID) {
      throw new ApiError('Courtly could not verify the assigned facility.')
    }
    return { facility: detail.facility, courts: detail.courts.filter(court =>
      court.managerId === managerID && court.facilityId === owned.facilityID) }
  },
  updateFacility: (id: string, data: FacilityUpdate) =>
    apiRequest<Facility>(`/api/facilities/${encode(id)}`, { method: 'PUT', body: data }),
  saveCourt: (data: CourtUpdate, id?: string) => id
    ? apiRequest<Court>(`/api/courts/${encode(id)}`, { method: 'PUT', body: data })
    : apiRequest<Court>('/api/courts', { method: 'POST', body: data }),
  deleteCourt: (id: string) => apiRequest<{ deleted: boolean }>(`/api/courts/${encode(id)}`, { method: 'DELETE' }),
  slots: (id: string, signal?: AbortSignal) => apiRequest<CourtSlot[]>(`/api/courts/${encode(id)}/slots`, { authenticated: false, signal }),
  bookings: (managerID: string, view: 'upcoming' | 'completed', signal?: AbortSignal) =>
    apiRequest<ManagerBooking[]>(`/api/manager/bookings/${view}`, { query: { managerID }, signal }),
  confirmBooking: (id: string) => apiRequest<Booking>(`/api/bookings/${encode(id)}/confirm`, { method: 'PUT' }),
  cancelBooking: playerApi.cancel,
  maintenances: (managerID: string, signal?: AbortSignal) =>
    apiRequest<MaintenanceWindow[]>('/api/manager/courts/maintenances', { query: { managerID }, signal }),
  scheduleMaintenance: (id: string, data: MaintenanceDates) =>
    apiRequest<MaintenanceDates & { courtID: string; message: string }>(maintenancePath(id), { method: 'POST', body: data }),
  cancelMaintenance: (id: string) => apiRequest<{ message: string }>(maintenancePath(id), { method: 'DELETE' }),
}
