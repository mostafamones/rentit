import { Stack, router } from 'expo-router'
import { useState, useSyncExternalStore } from 'react'
import { Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { api, type Listing } from '../../../src/api'
import {
  DISTRICTS, PRICE_CAPS, TRANSMISSIONS, TRANSMISSION_LABEL, VEHICLE_TYPES, VEHICLE_TYPE_LABEL, formatEgp,
} from '../../../src/domain/rental'
import { useSession } from '../../../src/session'
import { type, useColors } from '../../../src/theme'
import { Button, Empty, GlassCapsule, Icon, ListingCard, MenuPill, SectionTitle, SyncStatus, styles } from '../../../src/ui'
import { usePoll } from '../../../src/usePoll'

const any = { value: '', title: '' }
const areaOptions = [{ ...any, title: 'All Cairo' }, ...DISTRICTS.map((d) => ({ value: d, title: d }))]
const priceOptions = [{ ...any, title: 'Any price' }, ...PRICE_CAPS.map((p) => ({ value: String(p), title: `Up to ${formatEgp(p)}` }))]
const typeOptions = [{ ...any, title: 'Any type' }, ...VEHICLE_TYPES.map((t) => ({ value: t, title: VEHICLE_TYPE_LABEL[t] }))]
const gearOptions = [{ ...any, title: 'Any gearbox' }, ...TRANSMISSIONS.map((t) => ({ value: t, title: TRANSMISSION_LABEL[t] }))]

// Browse and Search share one set of filters, so switching between them keeps the pills as they were.
const NO_FILTERS = { district: '', maxPrice: '', vehicleType: '', transmission: '' }
type Filters = typeof NO_FILTERS
let filters = NO_FILTERS
const listeners = new Set<() => void>()
const setFilters = (next: Filters) => { filters = next; listeners.forEach((l) => l()) }
const useFilters = () => useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l) } }, () => filters)

export default function Browse() {
  return <ListingsScreen />
}

export function ListingsScreen({ search }: { search?: boolean }) {
  const colors = useColors()
  const { user } = useSession()
  const current = useFilters()
  const [q, setQ] = useState('')
  const params = new URLSearchParams(Object.entries({ ...current, q: search ? q.trim() : '' }).filter(([, v]) => v)).toString()
  const { data, error, updatedAt, refreshing, refresh } = usePoll(
    () => api<{ listings: Listing[] }>(`/listings${params ? `?${params}` : ''}`).then((r) => r.listings), params)
  const set = (key: keyof Filters) => (value: string) => setFilters({ ...filters, [key]: value })
  const active = Object.values(current).some(Boolean)
  const clear = () => setFilters(NO_FILTERS)
  const featured = !search && !active ? data?.filter((l) => l.featured) ?? [] : []
  const rest = featured.length ? data?.filter((l) => !l.featured) : data
  const first = user?.name.split(' ')[0]

  return (
    <View style={styles.flex}>
      {search
        ? <Stack.SearchBar placeholder="Make, model or area" autoFocus autoCapitalize="none" hideWhenScrolling={false}
            onChangeText={(e) => setQ(e.nativeEvent.text)} onCancelButtonPress={() => setQ('')} onClose={() => setQ('')} />
        : <Stack.Screen options={{ title: user ? `Welcome back, ${first}` : 'Welcome' }} />}
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
        {featured.length > 0 && <SectionTitle>Featured</SectionTitle>}
        {featured.map((listing) => <ListingCard key={listing.id} listing={listing} />)}
        {featured.length > 0 && !!rest?.length && <SectionTitle>All cars</SectionTitle>}
        {(search || active) && data && data.length > 0 && (
          <Text accessibilityLiveRegion="polite" style={[type.footnote, { color: colors.secondary }]}>{data.length} {data.length === 1 ? 'car' : 'cars'}</Text>
        )}
        {rest?.map((listing) => <ListingCard key={listing.id} listing={listing} />)}
        {data?.length === 0 && (
          <Empty title={search && q.trim() ? `No cars for “${q.trim()}”` : 'No cars match'}
            action={active ? <Button kind="secondary" title="Clear filters" onPress={clear} /> : undefined} />
        )}
        <SyncStatus updatedAt={updatedAt} error={error} />
      </ScrollView>
      {/* iOS has the system search tab at the bottom right; Android gets the same action as a floating button. */}
      {!search && Platform.OS !== 'ios' && (
        <Pressable accessibilityRole="button" accessibilityLabel="Search cars" onPress={() => router.push('/search')}
          style={({ pressed }) => [{ position: 'absolute', right: 16, bottom: 16, opacity: pressed ? 0.8 : 1 }]}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', elevation: 6 }}>
            <Icon name="search" size={24} color={colors.background} />
          </View>
        </Pressable>
      )}
    </View>
  )
}
