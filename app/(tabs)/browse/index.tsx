import { router } from 'expo-router'
import { useState } from 'react'
import { RefreshControl, ScrollView, Text, View } from 'react-native'
import { api, type Listing } from '../../../src/api'
import {
  DISTRICTS, PRICE_CAPS, TRANSMISSIONS, TRANSMISSION_LABEL, VEHICLE_TYPES, VEHICLE_TYPE_LABEL, formatEgp,
} from '../../../src/domain/rental'
import { type, useColors } from '../../../src/theme'
import { Button, Empty, ListingCard, MenuPill, SyncStatus, styles } from '../../../src/ui'
import { usePoll } from '../../../src/usePoll'

const any = { value: '', title: '' }
const areaOptions = [{ ...any, title: 'All Cairo' }, ...DISTRICTS.map((d) => ({ value: d, title: d }))]
const priceOptions = [{ ...any, title: 'Any price' }, ...PRICE_CAPS.map((p) => ({ value: String(p), title: `Up to ${formatEgp(p)}` }))]
const typeOptions = [{ ...any, title: 'Any type' }, ...VEHICLE_TYPES.map((t) => ({ value: t, title: VEHICLE_TYPE_LABEL[t] }))]
const gearOptions = [{ ...any, title: 'Any gearbox' }, ...TRANSMISSIONS.map((t) => ({ value: t, title: TRANSMISSION_LABEL[t] }))]

export default function Browse() {
  const colors = useColors()
  const [filters, setFilters] = useState({ district: '', maxPrice: '', vehicleType: '', transmission: '' })
  const query = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString()
  const { data, error, updatedAt, refreshing, refresh } = usePoll(
    () => api<{ listings: Listing[] }>(`/listings${query ? `?${query}` : ''}`).then((r) => r.listings), query)
  const set = (key: keyof typeof filters) => (value: string) => setFilters((f) => ({ ...f, [key]: value }))
  const active = Object.values(filters).some(Boolean)

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.screen}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <Text style={[type.subheadline, { color: colors.secondary, marginTop: -6 }]}>Daily car rentals across Cairo, from owners and rental businesses.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 16 }} style={{ marginHorizontal: -16, paddingLeft: 16 }}>
        <MenuPill label="Pickup area" value={filters.district} options={areaOptions} onSelect={set('district')} highlight={!!filters.district} />
        <MenuPill label="Daily price" value={filters.maxPrice} options={priceOptions} onSelect={set('maxPrice')} highlight={!!filters.maxPrice} />
        <MenuPill label="Vehicle type" value={filters.vehicleType} options={typeOptions} onSelect={set('vehicleType')} highlight={!!filters.vehicleType} />
        <MenuPill label="Gearbox" value={filters.transmission} options={gearOptions} onSelect={set('transmission')} highlight={!!filters.transmission} />
      </ScrollView>
      {data && (
        <View style={styles.row}>
          <Text style={[type.footnote, { color: colors.secondary }]}>{data.length} {data.length === 1 ? 'car' : 'cars'} available</Text>
          {active && <Text accessibilityRole="button" onPress={() => setFilters({ district: '', maxPrice: '', vehicleType: '', transmission: '' })}
            style={[type.footnote, { color: colors.accent, fontWeight: '600' }]}>Clear filters</Text>}
        </View>
      )}
      {data?.map((listing) => <ListingCard key={listing.id} listing={listing} onPress={() => router.push(`/listing/${listing.id}`)} />)}
      {data?.length === 0 && (
        <Empty title="No cars match" body="Try another area or a higher daily price."
          action={active ? <Button kind="secondary" title="Clear filters" onPress={() => setFilters({ district: '', maxPrice: '', vehicleType: '', transmission: '' })} /> : undefined} />
      )}
      <SyncStatus updatedAt={updatedAt} error={error} />
    </ScrollView>
  )
}
