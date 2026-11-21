// Shared by the mobile app and the API server (Node 22 runs this file directly via type stripping),
// so only erasable TypeScript syntax here: no enums, namespaces or parameter properties.

export const DISTRICTS = [
  'Downtown', 'Zamalek', 'Garden City', 'Maadi', 'Heliopolis', 'Nasr City', 'New Cairo',
  'Mohandessin', 'Dokki', 'Sheikh Zayed', '6th of October', 'Shorouk',
] as const
export type District = (typeof DISTRICTS)[number]

export const VEHICLE_TYPES = ['sedan', 'hatchback', 'suv', 'van', 'pickup'] as const
export type VehicleType = (typeof VEHICLE_TYPES)[number]
export const VEHICLE_TYPE_LABEL: Record<VehicleType, string> = {
  sedan: 'Sedan', hatchback: 'Hatchback', suv: 'SUV', van: 'Van / Minibus', pickup: 'Pickup',
}

export const TRANSMISSIONS = ['automatic', 'manual'] as const
export type Transmission = (typeof TRANSMISSIONS)[number]
export const TRANSMISSION_LABEL: Record<Transmission, string> = { automatic: 'Automatic', manual: 'Manual' }

export const FUELS = ['petrol', 'diesel', 'hybrid', 'electric', 'natural gas'] as const
export type Fuel = (typeof FUELS)[number]

export type AccountType = 'individual' | 'business'
export type ListingStatus = 'active' | 'paused' | 'hidden'
export type RequestStatus = 'pending' | 'accepted' | 'declined' | 'cancelled'

/** Daily-rate ceilings offered by the browse filter, in whole EGP. */
export const PRICE_CAPS = [1500, 2500, 4000, 6000] as const

export const MAX_RENTAL_DAYS = 60

// Dates are Cairo calendar dates as 'YYYY-MM-DD' strings. No times, no time zones.
// A rental runs from the pickup date to the return date; it is charged per day:
//   days = return date − pickup date (pickup 3 May, return 5 May = 2 days).
// The car is occupied on [pickup, return): another rental may pick up on a previous return date.
// An owner block covers start..end inclusive.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false
  return toDateString(parseDate(value)) === value // rejects 2026-02-30
}

function parseDate(value: string) {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function addDays(value: string, days: number) {
  const date = parseDate(value)
  date.setUTCDate(date.getUTCDate() + days)
  return toDateString(date)
}

export function daysBetween(from: string, to: string) {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86_400_000)
}

/** Today's date in Cairo. */
export function cairoToday(now = new Date()) {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export type Quote = { days: number; dailyRateEgp: number; totalEgp: number }

export function quote(pickup: string, ret: string, dailyRateEgp: number): Quote {
  const days = daysBetween(pickup, ret)
  return { days, dailyRateEgp, totalEgp: days * dailyRateEgp }
}

/** Returns an error message, or undefined when the date range is a valid rental. */
export function validateRentalDates(pickup: unknown, ret: unknown, today = cairoToday()): string | undefined {
  if (!isDate(pickup) || !isDate(ret)) return 'Choose a pickup and a return date.'
  if (pickup < today) return 'Pickup date is in the past.'
  const days = daysBetween(pickup, ret)
  if (days < 1) return 'Return date must be after the pickup date.'
  if (days > MAX_RENTAL_DAYS) return `Rentals are limited to ${MAX_RENTAL_DAYS} days.`
  return undefined
}

export type Range = { startDate: string; endDate: string }

/** Two rentals [pickup, return) overlap. */
export function rentalsOverlap(a: Range, b: Range) {
  return a.startDate < b.endDate && b.startDate < a.endDate
}

/** A rental [pickup, return) touches an inclusive block start..end. */
export function rentalHitsBlock(rental: Range, block: Range) {
  return rental.startDate <= block.endDate && block.startDate < rental.endDate
}

/** True when the car is unavailable on `day` given accepted rentals and owner blocks. */
export function isDayTaken(day: string, rentals: Range[], blocks: Range[]) {
  return rentals.some((r) => r.startDate <= day && day < r.endDate) || blocks.some((b) => b.startDate <= day && day <= b.endDate)
}

export function formatEgp(amount: number) {
  return `EGP ${amount.toLocaleString('en-US')}`
}

export function formatDate(value: string) {
  return parseDate(value).toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' })
}
