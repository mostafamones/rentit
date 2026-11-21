import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native'
import { Calendar } from '../../src/Calendar'
import { api, ApiError, type ListingDetail, type RentalRequest } from '../../src/api'
import {
  MAX_RENTAL_DAYS, addDays, daysBetween, formatDate, formatEgp, isDayTaken, quote, rentalHitsBlock, rentalsOverlap,
} from '../../src/domain/rental'
import { type, useColors } from '../../src/theme'
import { Banner, Button, Card, Field, SyncStatus, styles } from '../../src/ui'

export default function Book() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const colors = useColors()
  const [listing, setListing] = useState<ListingDetail>()
  const [loadError, setLoadError] = useState<string>()
  const [start, setStart] = useState<string>()
  const [end, setEnd] = useState<string>()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    api<{ listing: ListingDetail }>(`/listings/${id}`).then((r) => setListing(r.listing), (e: Error) => setLoadError(e.message))
  }, [id])
  if (!listing) return <View style={styles.screen}><SyncStatus error={loadError} /></View>

  const free = (s: string, e: string) => !listing.booked.some((r) => rentalsOverlap(r, { startDate: s, endDate: e }))
    && !listing.blocks.some((b) => rentalHitsBlock({ startDate: s, endDate: e }, b))
  const taken = (day: string) => isDayTaken(day, listing.booked, listing.blocks)
  // Picking a return date: any later day whose range back to pickup is free. Otherwise: a free pickup day.
  const choosingReturn = !!start && !end
  const disabled = (day: string) => choosingReturn && day > start
    ? daysBetween(start, day) > MAX_RENTAL_DAYS || !free(start, day)
    : taken(day)
  const press = (day: string) => {
    setError(undefined)
    if (choosingReturn && day > start) setEnd(day)
    else { setStart(day); setEnd(undefined) }
  }
  const q = start && end ? quote(start, end, listing.dailyRateEgp) : undefined

  const send = async () => {
    if (!start || !end || !q) return
    setBusy(true)
    setError(undefined)
    try {
      const { request } = await api<{ request: RentalRequest }>('/requests', {
        body: { listingId: listing.id, startDate: start, endDate: end, note, expectedTotalEgp: q.totalEgp },
      })
      router.dismiss()
      router.push(`/request/${request.id}`)
    } catch (e) {
      if (e instanceof ApiError && e.data.quote) {
        setListing({ ...listing, dailyRateEgp: e.data.quote.dailyRateEgp }) // owner changed the rate; show the new quote
      }
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={80}>
      <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
        <Text style={[type.headline, { color: colors.ink }]}>{listing.make} {listing.model} · {formatEgp(listing.dailyRateEgp)} per day</Text>
        <Text style={[type.subheadline, { color: colors.secondary }]}>
          {!start ? 'Tap your pickup date.' : !end ? 'Now tap your return date.' : 'Tap another date to start over.'} Crossed-out days are already booked.
        </Text>
        <Card>
          <View style={styles.row}>
            <View style={{ gap: 2 }}>
              <Text style={[type.caption, { color: colors.secondary }]}>Pickup</Text>
              <Text style={[type.headline, { color: colors.ink }]}>{start ? formatDate(start) : '—'}</Text>
            </View>
            <Text style={[type.headline, { color: colors.tertiary }]}>→</Text>
            <View style={{ gap: 2, alignItems: 'flex-end' }}>
              <Text style={[type.caption, { color: colors.secondary }]}>Return</Text>
              <Text style={[type.headline, { color: colors.ink }]}>{end ? formatDate(end) : start ? `from ${formatDate(addDays(start, 1))}` : '—'}</Text>
            </View>
          </View>
        </Card>
        <Calendar start={start} end={end} taken={taken} disabled={disabled} onPress={press} />

        {q && (
          <Card>
            <Text style={[type.headline, { color: colors.ink }]}>Your quote</Text>
            <View style={styles.row}>
              <Text style={[type.callout, { color: colors.secondary }]}>{formatEgp(q.dailyRateEgp)} × {q.days} {q.days === 1 ? 'day' : 'days'}</Text>
              <Text style={[type.price, { color: colors.ink }]}>{formatEgp(q.totalEgp)}</Text>
            </View>
            <Text style={[type.footnote, { color: colors.secondary }]}>
              This total is locked into your request. Days = return date minus pickup date. Pay the owner at pickup; deposits follow their terms.
            </Text>
          </Card>
        )}
        <Field label="Note to the owner (optional)" value={note} onChangeText={setNote} multiline maxLength={500}
          placeholder="Pickup time, where you're driving, questions…" />
        {error && <Banner tone="error" text={error} />}
        <Button title={q ? `Send request · ${formatEgp(q.totalEgp)}` : 'Choose dates'} disabled={!q} busy={busy} onPress={send} />
        <Text style={[type.footnote, { color: colors.secondary, textAlign: 'center' }]}>
          Sending a request doesn't hold the car. The dates are yours once the owner accepts.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
