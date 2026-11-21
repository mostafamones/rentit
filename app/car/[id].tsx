import * as ImagePicker from 'expo-image-picker'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { Calendar } from '../../src/Calendar'
import { api, imageUrl, type ListingDetail, type ListingFields } from '../../src/api'
import {
  DISTRICTS, FUELS, TRANSMISSIONS, TRANSMISSION_LABEL, VEHICLE_TYPES, VEHICLE_TYPE_LABEL, formatDate, isDayTaken,
} from '../../src/domain/rental'
import { type, useColors } from '../../src/theme'
import { Badge, Banner, Button, Card, Field, Icon, MenuPill, SectionTitle, SyncStatus, styles } from '../../src/ui'

type Form = Record<'make' | 'model' | 'year' | 'seats' | 'dailyRateEgp' | 'terms', string> &
  Pick<ListingFields, 'vehicleType' | 'transmission' | 'fuel' | 'district'>

const EMPTY: Form = {
  make: '', model: '', year: '', seats: '5', dailyRateEgp: '', terms: '',
  vehicleType: 'sedan', transmission: 'automatic', fuel: 'petrol', district: 'Maadi',
}

const toForm = (l: ListingDetail): Form => ({
  make: l.make, model: l.model, year: String(l.year), seats: String(l.seats), dailyRateEgp: String(l.dailyRateEgp), terms: l.terms,
  vehicleType: l.vehicleType, transmission: l.transmission, fuel: l.fuel, district: l.district,
})

const opts = <T extends string>(values: readonly T[], label: (v: T) => string = (v) => v[0].toUpperCase() + v.slice(1)) =>
  values.map((value) => ({ value, title: label(value) }))

export default function CarEditor() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const isNew = id === 'new'
  const colors = useColors()
  const [listing, setListing] = useState<ListingDetail>()
  const [form, setForm] = useState<Form>(EMPTY)
  const [loadError, setLoadError] = useState<string>()
  const [busy, setBusy] = useState<string>()
  const [error, setError] = useState<string>()
  const [saved, setSaved] = useState(false)
  const [blocking, setBlocking] = useState(false)

  const load = () => api<{ listing: ListingDetail }>(`/listings/${id}`).then((r) => { setListing(r.listing); setForm(toForm(r.listing)) },
    (e: Error) => setLoadError(e.message))
  useEffect(() => { if (!isNew) load() }, [id])
  if (!isNew && !listing) return <View style={styles.screen}><SyncStatus error={loadError} /></View>

  const set = (key: keyof Form) => (value: string) => { setSaved(false); setForm((f) => ({ ...f, [key]: value })) }
  const run = async (key: string, work: () => Promise<void>) => {
    setBusy(key)
    setError(undefined)
    try { await work() } catch (e) { setError((e as Error).message) } finally { setBusy(undefined) }
  }

  const save = () => run('save', async () => {
    const body = { ...form, year: Number(form.year), seats: Number(form.seats), dailyRateEgp: Number(form.dailyRateEgp) }
    if (isNew) {
      const { listing: created } = await api<{ listing: ListingDetail }>('/listings', { body })
      router.replace(`/car/${created.id}`)
    } else {
      await api(`/listings/${id}`, { method: 'PATCH', body })
      await load()
      setSaved(true)
    }
  })

  const addPhoto = () => run('photo', async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, base64: true, allowsEditing: true, aspect: [4, 3] })
    const asset = picked.canceled ? undefined : picked.assets[0]
    if (!asset?.base64) return
    await api(`/listings/${id}/photos`, { body: { base64: asset.base64, mimeType: asset.mimeType ?? 'image/jpeg' } })
    await load()
  })

  const removePhoto = (photoId: number) => Alert.alert('Remove photo?', undefined, [
    { text: 'Keep', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: () => run('photo', async () => { await api(`/listings/${id}/photos/${photoId}`, { method: 'DELETE' }); await load() }) },
  ])

  const setStatus = (status: 'active' | 'paused') => run('status', async () => {
    await api(`/listings/${id}`, { method: 'PATCH', body: { status } })
    await load()
  })

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen options={{ title: isNew ? 'List a car' : `${listing!.make} ${listing!.model}` }} />
      <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
        {listing && (
          <Card>
            <View style={styles.row}>
              <Text style={[type.headline, { color: colors.ink }]}>Visibility</Text>
              <Badge label={{ active: 'Live', paused: 'Paused', hidden: 'Under review' }[listing.status]}
                tone={{ active: 'green', paused: 'gray', hidden: 'red' }[listing.status] as 'green'} />
            </View>
            {listing.status === 'hidden'
              ? <Text style={[type.callout, { color: colors.secondary }]}>Hidden after a report. Contact Rentit to restore it.</Text>
              : listing.status === 'active'
                ? <Button kind="secondary" title="Pause listing" busy={busy === 'status'} onPress={() => setStatus('paused')} />
                : <Button title="Publish listing" busy={busy === 'status'} disabled={!listing.photos.length} onPress={() => setStatus('active')} />}
            {listing.status === 'paused' && !listing.photos.length && <Text style={[type.footnote, { color: colors.secondary }]}>Add at least one photo to publish.</Text>}
            {listing.status === 'active' && (
              <Text accessibilityRole="link" onPress={() => router.push(`/listing/${listing.id}`)} style={[type.callout, { color: colors.accent }]}>View as renters see it</Text>
            )}
          </Card>
        )}

        {listing && (
          <>
            <SectionTitle trailing={<Text style={[type.footnote, { color: colors.secondary }]}>{listing.photos.length}/6</Text>}>Photos</SectionTitle>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {listing.photos.map((p, i) => (
                <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`Remove photo ${i + 1}`} onPress={() => removePhoto(p.id)}>
                  <Image source={{ uri: imageUrl(p.url) }} style={{ width: 120, height: 90, borderRadius: 12 }} />
                  <View style={{ position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 12, padding: 4 }}>
                    <Icon name="close" size={12} color="#FFFFFF" />
                  </View>
                </Pressable>
              ))}
              {listing.photos.length < 6 && (
                <Pressable accessibilityRole="button" accessibilityLabel="Add photo" onPress={addPhoto} disabled={busy === 'photo'}
                  style={{ width: 120, height: 90, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.accent, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <Icon name="photo" size={22} color={colors.accent} />
                  <Text style={[type.caption, { color: colors.accent }]}>{busy === 'photo' ? 'Uploading…' : 'Add photo'}</Text>
                </Pressable>
              )}
            </ScrollView>
          </>
        )}

        <SectionTitle>Car details</SectionTitle>
        <View style={styles.row}>
          <View style={{ flex: 1 }}><Field label="Make" value={form.make} onChangeText={set('make')} placeholder="Hyundai" /></View>
          <View style={{ flex: 1 }}><Field label="Model" value={form.model} onChangeText={set('model')} placeholder="Elantra" /></View>
        </View>
        <View style={styles.row}>
          <View style={{ flex: 1 }}><Field label="Year" value={form.year} onChangeText={set('year')} keyboardType="number-pad" maxLength={4} placeholder="2022" /></View>
          <View style={{ flex: 1 }}><Field label="Seats" value={form.seats} onChangeText={set('seats')} keyboardType="number-pad" maxLength={2} /></View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <MenuPill label="Vehicle type" value={form.vehicleType} options={opts(VEHICLE_TYPES, (v) => VEHICLE_TYPE_LABEL[v])} onSelect={set('vehicleType')} />
          <MenuPill label="Gearbox" value={form.transmission} options={opts(TRANSMISSIONS, (v) => TRANSMISSION_LABEL[v])} onSelect={set('transmission')} />
          <MenuPill label="Fuel" value={form.fuel} options={opts(FUELS)} onSelect={set('fuel')} />
          <MenuPill label="Pickup area" value={form.district} options={opts(DISTRICTS, (v) => `Pickup: ${v}`)} onSelect={set('district')} />
        </View>
        <Field label="Daily price (EGP)" value={form.dailyRateEgp} onChangeText={set('dailyRateEgp')} keyboardType="number-pad" placeholder="2000" />
        <Field label="Rental terms" value={form.terms} onChangeText={set('terms')} multiline maxLength={1000}
          placeholder="Deposit, documents needed, km per day, fuel policy…" />
        {error && <Banner tone="error" text={error} />}
        {saved && <Banner tone="success" text="Saved." />}
        <Button title={isNew ? 'Create listing' : 'Save changes'} busy={busy === 'save'} onPress={save} />

        {listing && (
          <>
            <SectionTitle trailing={<Text accessibilityRole="button" onPress={() => setBlocking(true)} style={[type.callout, { color: colors.accent, fontWeight: '600' }]}>Block dates</Text>}>
              Unavailable dates
            </SectionTitle>
            {listing.blocks.map((b) => (
              <View key={b.id} style={[styles.row, { paddingVertical: 6 }]}>
                <Text style={[type.callout, { color: colors.ink }]}>{formatDate(b.startDate)} – {formatDate(b.endDate)}</Text>
                <Text accessibilityRole="button" accessibilityLabel={`Unblock ${formatDate(b.startDate)} to ${formatDate(b.endDate)}`}
                  onPress={() => run('block', async () => { await api(`/listings/${id}/blocks/${b.id}`, { method: 'DELETE' }); await load() })}
                  style={[type.callout, { color: colors.red }]}>Unblock</Text>
              </View>
            ))}
            {listing.booked.map((b) => (
              <Text key={b.startDate} style={[type.callout, { color: colors.secondary }]}>Rented {formatDate(b.startDate)} → {formatDate(b.endDate)}</Text>
            ))}
            {blocking && <BlockDates listing={listing} onClose={() => setBlocking(false)} onSaved={load} />}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function BlockDates({ listing, onClose, onSaved }: { listing: ListingDetail; onClose(): void; onSaved(): Promise<void> }) {
  const colors = useColors()
  const [start, setStart] = useState<string>()
  const [end, setEnd] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const press = (day: string) => {
    if (start && !end && day >= start) setEnd(day)
    else { setStart(day); setEnd(undefined) }
  }
  const save = async () => {
    setBusy(true)
    try {
      await api(`/listings/${listing.id}/blocks`, { body: { startDate: start, endDate: end ?? start } })
      await onSaved()
      onClose()
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.screen, { paddingTop: 24 }]}>
        <View style={styles.row}>
          <Text style={[type.title, { color: colors.ink }]}>Block dates</Text>
          <Text accessibilityRole="button" onPress={onClose} style={[type.callout, { color: colors.accent }]}>Cancel</Text>
        </View>
        <Text style={[type.subheadline, { color: colors.secondary }]}>
          {start ? `${formatDate(start)}${end && end !== start ? ` – ${formatDate(end)}` : ''} · tap a later day to extend` : 'Tap the first day to block.'}
        </Text>
        <Calendar start={start} end={end ?? start} months={4} taken={(d) => isDayTaken(d, listing.booked, listing.blocks)}
          disabled={() => false} onPress={press} />
        {error && <Banner tone="error" text={error} />}
        <Button title="Block these dates" disabled={!start} busy={busy} onPress={save} />
      </ScrollView>
    </Modal>
  )
}
