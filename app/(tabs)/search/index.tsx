import { Stack } from 'expo-router'
import { useState, useSyncExternalStore } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { api, type Listing } from '../../../src/api'
import {
  DISTRICTS, PRICE_CAPS, TRANSMISSIONS, TRANSMISSION_LABEL, VEHICLE_TYPES, VEHICLE_TYPE_LABEL, formatEgp,
} from '../../../src/domain/rental'
import { type, useColors } from '../../../src/theme'
import { Button, Empty, GlassCapsule, ListingCard, MenuPill, SyncStatus, styles } from '../../../src/ui'
import { usePoll } from '../../../src/usePoll'

const any = { value: '', title: '' }
const areaOptions = [{ ...any, title: 'All Cairo' }, ...DISTRICTS.map((d) => ({ value: d, title: d }))]
const priceOptions = [{ ...any, title: 'Any price' }, ...PRICE_CAPS.map((p) => ({ value: String(p), title: `Up to ${formatEgp(p)}` }))]
const typeOptions = [{ ...any, title: 'Any type' }, ...VEHICLE_TYPES.map((t) => ({ value: t, title: VEHICLE_TYPE_LABEL[t] }))]
const gearOptions = [{ ...any, title: 'Any gearbox' }, ...TRANSMISSIONS.map((t) => ({ value: t, title: TRANSMISSION_LABEL[t] }))]

// One set of filters for the iOS Search tab and Android's search screen, kept while the app runs.
const NO_FILTERS = { district: '', maxPrice: '', vehicleType: '', transmission: '' }
type Filters = typeof NO_FILTERS
let filters = NO_FILTERS
const listeners = new Set<() => void>()
const setFilters = (next: Filters) => { filters = next; listeners.forEach((l) => l()) }
const useFilters = () => useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l) } }, () => filters)

export default function Search() {
  const colors = useColors()
  const current = useFilters()
  const [q, setQ] = useState('')
  const params = new URLSearchParams(Object.entries({ ...current, q: q.trim() }).filter(([, v]) => v)).toString()
  const { data, error, updatedAt, refreshing, refresh } = usePoll(
    () => api<{ listings: Listing[] }>(`/listings${params ? `?${params}` : ''}`).then((r) => r.listings), params)
  const set = (key: keyof Filters) => (value: string) => setFilters({ ...filters, [key]: value })
  const active = Object.values(current).some(Boolean)
  const clear = () => setFilters(NO_FILTERS)

  return (
    <View style={styles.flex}>
      <Stack.SearchBar placeholder="Make, model or area" autoFocus autoCapitalize="none" hideWhenScrolling={false}
        onChangeText={(e) => setQ(e.nativeEvent.text)} onCancelButtonPress={() => setQ('')} onClose={() => setQ('')} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.screen, { paddingBottom: 96 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 16 }} style={{ marginHorizontal: -16, paddingLeft: 16 }}>
          <MenuPill label="Pickup area" value={current.district} options={areaOptions} onSelect={set('district')} highlight={!!current.district} />
          <MenuPill label="Daily price" value={current.maxPrice} options={priceOptions} onSelect={set('maxPrice')} highlight={!!current.maxPrice} />
          <MenuPill label="Vehicle type" value={current.vehicleType} options={typeOptions} onSelect={set('vehicleType')} highlight={!!current.vehicleType} />
          <MenuPill label="Gearbox" value={current.transmission} options={gearOptions} onSelect={set('transmission')} highlight={!!current.transmission} />
          {active && (
            <Pressable accessibilityRole="button" accessibilityLabel="Clear filters" hitSlop={4} onPress={clear}>
              <GlassCapsule interactive style={{ minHeight: 34, paddingHorizontal: 13, justifyContent: 'center' }}>
                <Text style={[type.subheadline, { color: colors.ink, fontWeight: '600' }]}>Clear</Text>
              </GlassCapsule>
            </Pressable>
          )}
        </ScrollView>
        {data && data.length > 0 && (
          <Text accessibilityLiveRegion="polite" style={[type.footnote, { color: colors.secondary }]}>{data.length} {data.length === 1 ? 'car' : 'cars'}</Text>
        )}
        {data?.map((listing) => <ListingCard key={listing.id} listing={listing} />)}
        {data?.length === 0 && (
          <Empty title={q.trim() ? `No cars for “${q.trim()}”` : 'No cars match'}
            action={active ? <Button kind="secondary" title="Clear filters" onPress={clear} /> : undefined} />
        )}
        <SyncStatus updatedAt={updatedAt} error={error} />
      </ScrollView>
    </View>
  )
}
