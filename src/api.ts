import Constants from 'expo-constants'
import * as SecureStore from 'expo-secure-store'
import { withoutSampleSuffix } from './sampleNames'
import type { AccountType, Fuel, ListingStatus, Quote, Range, RequestStatus, Transmission, VehicleType, District } from './domain/rental'

// Dev builds reach the API on the Metro host unless EXPO_PUBLIC_API_URL says otherwise.
const devHost = Constants.expoConfig?.hostUri?.split(':')[0]
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || (devHost ? `http://${devHost}:4000` : 'http://localhost:4000')).replace(/\/$/, '')

export const imageUrl = (path: string | null | undefined) => (path ? `${API_URL}${path}` : undefined)

export type PublicUser = { id: number; name: string; accountType: AccountType; businessName: string | null }
export type Me = PublicUser & { email: string; phone: string }

export type ListingFields = {
  make: string; model: string; year: number; vehicleType: VehicleType; transmission: Transmission; fuel: Fuel
  seats: number; district: District; dailyRateEgp: number; terms: string
}
export type Listing = ListingFields & {
  id: number; status: ListingStatus; featured: boolean; photos: { id: number; url: string }[]; owner: PublicUser; isMine: boolean
}
export type ListingDetail = Listing & { booked: Range[]; blocks: (Range & { id: number })[] }

/** The card's copy of a listing, so the detail hero has its photo on the first frame, before the detail fetch returns. */
export const listingPreviews = new Map<number, Listing>()

export type RentalRequest = {
  id: number; role: 'renter' | 'owner'; status: RequestStatus; statusReason: string | null
  startDate: string; endDate: string; days: number; dailyRateEgp: number; totalEgp: number; note: string
  createdAt: string; updatedAt: string
  listing: { id: number; title: string; district: string; photoUrl: string | null }
  renter: PublicUser; owner: PublicUser
  contact: { name: string; phone: string; email: string } | null
}

export class ApiError extends Error {
  status: number
  data: { quote?: Quote }
  constructor(status: number, message: string, data: object) {
    super(message)
    this.status = status
    this.data = data
  }
}

const TOKEN_KEY = 'rentit.session'
let token: string | null = null

export async function loadToken() {
  token = await SecureStore.getItemAsync(TOKEN_KEY)
  return token
}

export async function saveToken(value: string | null) {
  token = value
  if (value) await SecureStore.setItemAsync(TOKEN_KEY, value)
  else await SecureStore.deleteItemAsync(TOKEN_KEY)
}

export async function api<T>(path: string, init?: { method?: string; body?: object }): Promise<T> {
  let res: Response
  try {
    res = await fetch(API_URL + path, {
      method: init?.method ?? (init?.body ? 'POST' : 'GET'),
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: init?.body ? JSON.stringify(init.body) : undefined,
    })
  } catch {
    throw new ApiError(0, `Can't reach Rentit at ${API_URL}. Check your connection.`, {})
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Request failed (${res.status}).`, data)
  return withoutSampleSuffix(data) as T
}

