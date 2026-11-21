import { Stack, router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Alert, Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api, imageUrl, type ListingDetail } from '../../src/api'
import { TRANSMISSION_LABEL, VEHICLE_TYPE_LABEL, formatDate, formatEgp } from '../../src/domain/rental'
import { useSession } from '../../src/session'
import { type, useColors } from '../../src/theme'
import { Badge, Banner, Button, Card, Icon, SyncStatus, providerLabel, styles } from '../../src/ui'
import { usePoll } from '../../src/usePoll'

export default function ListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const colors = useColors()
  const { width } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const { user } = useSession()
  const [page, setPage] = useState(0)
  const { data: l, error, updatedAt } = usePoll(() => api<{ listing: ListingDetail }>(`/listings/${id}`).then((r) => r.listing), `${id}:${user?.id}`)

  if (!l) return <View style={styles.screen}><SyncStatus error={error} /></View>
  const title = `${l.make} ${l.model} ${l.year}`
  const upcoming = [...l.booked, ...l.blocks.map((b) => ({ startDate: b.startDate, endDate: b.endDate, block: true }))]
    .sort((a, b) => a.startDate.localeCompare(b.startDate))

  const report = () => {
    if (!user) return router.push('/sign-in')
    Alert.alert('Report listing', 'What is wrong with this listing?', [
      { text: 'Cancel', style: 'cancel' },
      // Android alerts show at most three buttons.
      ...['Misleading photos or details', 'Suspicious or scam'].map((reason) => ({
        text: reason,
        onPress: () => api(`/listings/${l.id}/report`, { body: { reason } })
          .then(() => Alert.alert('Thanks', 'We will review this listing.'), (e: Error) => Alert.alert('Could not report', e.message)),
      })),
    ])
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title }} />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}>
            {(l.photos.length ? l.photos : [null]).map((p, i) => (
              <View key={p?.id ?? i} style={{ width, aspectRatio: 4 / 3, backgroundColor: colors.fill, alignItems: 'center', justifyContent: 'center' }}>
                {p ? <Image accessibilityLabel={`${title} photo ${i + 1}`} source={{ uri: imageUrl(p.url) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  : <Icon name="car" size={48} color={colors.tertiary} />}
              </View>
            ))}
          </ScrollView>
          {l.photos.length > 1 && (
            <View style={local.dots} accessibilityLabel={`Photo ${page + 1} of ${l.photos.length}`}>
              {l.photos.map((p, i) => <View key={p.id} style={[local.dot, { backgroundColor: i === page ? '#FFFFFF' : 'rgba(255,255,255,0.5)' }]} />)}
            </View>
          )}
        </View>

        <View style={styles.screen}>
          {l.isSample && <Banner text="Sample listing for the pilot. Requests go to a demo account." />}
          {l.isMine && l.status !== 'active' && <Banner tone="error" text={l.status === 'hidden' ? 'Hidden while Rentit reviews a report.' : 'Paused — renters cannot see this car.'} />}
          <View style={{ gap: 4 }}>
            <Text style={[type.title, { color: colors.ink }]}>{title}</Text>
            <View style={styles.meta}>
              <Icon name="pin" size={14} />
              <Text style={[type.callout, { color: colors.secondary }]}>Pickup in {l.district}, Cairo</Text>
            </View>
          </View>
          <View style={styles.row}>
            <Text style={[type.price, { fontSize: 24, color: colors.ink }]}>{formatEgp(l.dailyRateEgp)}<Text style={[type.callout, { color: colors.secondary, fontWeight: '400' }]}> per day</Text></Text>
          </View>

          <Card style={local.specs}>
            {[
              ['Gearbox', TRANSMISSION_LABEL[l.transmission]], ['Type', VEHICLE_TYPE_LABEL[l.vehicleType]],
              ['Fuel', l.fuel[0].toUpperCase() + l.fuel.slice(1)], ['Seats', String(l.seats)], ['Year', String(l.year)],
            ].map(([k, v]) => (
              <View key={k} style={local.spec}>
                <Text style={[type.caption, { color: colors.secondary }]}>{k}</Text>
                <Text style={[type.headline, { color: colors.ink }]}>{v}</Text>
              </View>
            ))}
          </Card>

          <Card>
            <View style={styles.meta}>
              <Icon name={l.owner.accountType === 'business' ? 'business' : 'person'} size={16} color={colors.accent} />
              <Text style={[type.headline, { color: colors.ink }]}>{providerLabel(l.owner)}</Text>
            </View>
            <Badge label={l.owner.accountType === 'business' ? 'Rental business' : 'Private owner'} tone="blue" />
            <Text style={[type.footnote, { color: colors.secondary }]}>Phone and email are shared with you once the owner accepts your request.</Text>
          </Card>

          {!!l.terms && (
            <Card>
              <Text style={[type.headline, { color: colors.ink }]}>Owner's terms</Text>
              <Text style={[type.callout, { color: colors.ink }]}>{l.terms}</Text>
            </Card>
          )}

          <Card>
            <Text style={[type.headline, { color: colors.ink }]}>Availability</Text>
            {upcoming.length === 0
              ? <Text style={[type.callout, { color: colors.secondary }]}>No booked dates yet.</Text>
              : upcoming.map((r) => (
                <Text key={`${r.startDate}${'block' in r}`} style={[type.callout, { color: colors.ink }]}>
                  {'block' in r ? `Unavailable ${formatDate(r.startDate)} – ${formatDate(r.endDate)}` : `Booked ${formatDate(r.startDate)} → returns ${formatDate(r.endDate)}`}
                </Text>
              ))}
            <Text style={[type.footnote, { color: colors.secondary }]}>Price is per day: return date minus pickup date. Pick up 3 May and return 5 May = 2 days. Payment is arranged with the owner at pickup.</Text>
          </Card>

          {!l.isMine && (
            <Text accessibilityRole="button" onPress={report} style={[type.footnote, { color: colors.secondary, textAlign: 'center', padding: 8 }]}>
              Report this listing
            </Text>
          )}
          <SyncStatus updatedAt={updatedAt} error={error} />
        </View>
      </ScrollView>

      <View style={[local.bar, { paddingBottom: insets.bottom + 12, backgroundColor: colors.card, borderColor: colors.separator }]}>
        <View style={{ flex: 1 }}>
          <Text style={[type.price, { color: colors.ink }]}>{formatEgp(l.dailyRateEgp)}</Text>
          <Text style={[type.caption, { color: colors.secondary }]}>per day · {l.district}</Text>
        </View>
        <View style={{ flex: 1.3 }}>
          {l.isMine
            ? <Button title="Manage car" onPress={() => router.push(`/car/${l.id}`)} />
            : <Button title={user ? 'Choose dates' : 'Sign in to request'} disabled={l.status !== 'active'}
                onPress={() => router.push(user ? `/book/${l.id}` : '/sign-in')} />}
        </View>
      </View>
    </View>
  )
}

const local = StyleSheet.create({
  dots: { position: 'absolute', bottom: 12, alignSelf: 'center', flexDirection: 'row', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  specs: { flexDirection: 'row', flexWrap: 'wrap', gap: 0, paddingVertical: 8 },
  spec: { width: '33.33%', paddingVertical: 8, gap: 2 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
})
