import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api, imageUrl, type ListingDetail } from '../../src/api'
import { TRANSMISSION_LABEL, VEHICLE_TYPE_LABEL, formatDate, formatEgp } from '../../src/domain/rental'
import { useSession } from '../../src/session'
import { type, useColors } from '../../src/theme'
import { Banner, Button, Card, GlassButton, GlassCapsule, Icon, OwnerLine, Photo as PhotoImage, SyncStatus, styles } from '../../src/ui'
import { usePoll } from '../../src/usePoll'

type Photo = ListingDetail['photos'][number]

export default function ListingScreen() {
  const { id, photo } = useLocalSearchParams<{ id: string; photo?: string }>()
  const colors = useColors()
  const { width } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const { user } = useSession()
  // Opens on the photo the card was showing.
  const [page, setPage] = useState(() => Number(photo) || 0)
  const [viewer, setViewer] = useState(false)
  const { data: l, error, updatedAt } = usePoll(() => api<{ listing: ListingDetail }>(`/listings/${id}`).then((r) => r.listing), `${id}:${user?.id}`)
  const back = () => (router.canGoBack() ? router.back() : router.replace('/browse'))
  const heroHeight = Math.round(width * 1.05)

  const hero = (photos: Photo[], title: string, district?: string) => (
    <View style={{ width, height: heroHeight, backgroundColor: colors.fill }}>
      <Gallery photos={photos} title={title} width={width} height={heroHeight} page={page} onPage={setPage} onOpen={() => setViewer(true)} />
      {district !== undefined && (
        <GlassCapsule style={local.titleBand}>
          <Text accessibilityRole="header" numberOfLines={2} style={[type.title, { color: colors.ink }]}>{title}</Text>
          <View style={styles.row}>
            <View style={styles.meta}>
              <Icon name="pin" size={14} color={colors.ink} />
              <Text style={[type.callout, { color: colors.ink }]}>{district}</Text>
            </View>
            {photos.length > 1 && (
              <View style={local.dots} accessible accessibilityLabel={`Photo ${page + 1} of ${photos.length}`}>
                {photos.map((p, i) => <View key={p.id} style={[local.dot, { backgroundColor: i === page ? colors.ink : colors.tertiary }]} />)}
              </View>
            )}
          </View>
        </GlassCapsule>
      )}
      </View>
  )
  const chrome = (count: number) => (
    <View style={[local.chrome, { top: insets.top + 6 }]} pointerEvents="box-none">
      <GlassButton icon="back" label="Back" onPress={back} />
      {count > 0 && <GlassButton icon="expand" label="View photos full screen" onPress={() => setViewer(true)} />}
    </View>
  )

  if (!l) {
    return (
      <View style={styles.flex}>
        {hero([], '')}
        {chrome(0)}
        <View style={styles.screen}><SyncStatus error={error} /></View>
      </View>
    )
  }
  const title = `${l.make} ${l.model} ${l.year}`
  const upcoming = [...l.booked, ...l.blocks.map((b) => ({ startDate: b.startDate, endDate: b.endDate, block: true }))]
    .sort((a, b) => a.startDate.localeCompare(b.startDate))

  const report = () => {
    if (!user) return router.push('/sign-in')
    Alert.alert('Report listing', undefined, [
      { text: 'Cancel', style: 'cancel' },
      // Android alerts show at most three buttons.
      ...['Misleading photos or details', 'Suspicious or scam'].map((reason) => ({
        text: reason,
        onPress: () => api(`/listings/${l.id}/report`, { body: { reason } })
          .then(() => Alert.alert('Reported'), (e: Error) => Alert.alert('Could not report', e.message)),
      })),
    ])
  }

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} contentInsetAdjustmentBehavior="never">
        {hero(l.photos, title, l.district)}

        <View style={styles.screen}>
          {l.isMine && l.status !== 'active' && <Banner tone="error" text={l.status === 'hidden' ? 'Hidden after a report.' : 'Paused. Renters can’t see this car.'} />}

          <Card style={local.specs}>
            {[
              ['Gearbox', TRANSMISSION_LABEL[l.transmission]], ['Type', VEHICLE_TYPE_LABEL[l.vehicleType]],
              ['Fuel', l.fuel[0].toUpperCase() + l.fuel.slice(1)], ['Seats', String(l.seats)], ['Year', String(l.year)],
            ].map(([k, v]) => (
              <View key={k} style={local.spec} accessible accessibilityLabel={`${k}: ${v}`}>
                <Text style={[type.caption, { color: colors.secondary }]}>{k}</Text>
                <Text style={[type.headline, { color: colors.ink }]}>{v}</Text>
              </View>
            ))}
          </Card>

          <Card><OwnerLine owner={l.owner} size={16} /></Card>

          {!!l.terms && (
            <Card>
              <Text style={[type.headline, { color: colors.ink }]}>Terms</Text>
              <Text style={[type.callout, { color: colors.ink }]}>{l.terms}</Text>
            </Card>
          )}

          <Card>
            <Text style={[type.headline, { color: colors.ink }]}>Availability</Text>
            {upcoming.length === 0
              ? <Text style={[type.callout, { color: colors.secondary }]}>Open</Text>
              : upcoming.map((r) => (
                <Text key={`${r.startDate}${'block' in r}`} style={[type.callout, { color: colors.ink }]}>
                  {'block' in r ? `Unavailable ${formatDate(r.startDate)} – ${formatDate(r.endDate)}` : `Booked ${formatDate(r.startDate)} → ${formatDate(r.endDate)}`}
                </Text>
              ))}
            <Text style={[type.footnote, { color: colors.secondary }]}>Pay the owner at pickup.</Text>
          </Card>

          {!l.isMine && (
            <Text accessibilityRole="button" onPress={report} style={[type.footnote, { color: colors.secondary, textAlign: 'center', padding: 8 }]}>
              Report listing
            </Text>
          )}
          <SyncStatus updatedAt={updatedAt} error={error} />
        </View>
      </ScrollView>
      {chrome(l.photos.length)}

      <View style={[local.bar, { paddingBottom: insets.bottom + 12, backgroundColor: colors.card, borderColor: colors.separator }]}>
        <View style={{ flex: 1 }}>
          <Text style={[type.price, { color: colors.ink }]}>{formatEgp(l.dailyRateEgp)}</Text>
          <Text style={[type.caption, { color: colors.secondary }]}>per day</Text>
        </View>
        <View style={{ flex: 1.3 }}>
          {l.isMine
            ? <Button title="Manage car" onPress={() => router.push(`/car/${l.id}`)} />
            : <Button title={user ? 'Choose dates' : 'Sign in to request'} disabled={l.status !== 'active'}
                onPress={() => router.push(user ? `/book/${l.id}` : '/sign-in')} />}
        </View>
      </View>

      {viewer && <PhotoViewer photos={l.photos} title={title} start={page} onClose={() => setViewer(false)} />}
    </View>
  )
}

/** Swipeable photos; the title band shows the page dots. Tapping a photo opens it full screen. */
function Gallery({ photos, title, width, height, page, onPage, onOpen }: {
  photos: Photo[]; title: string; width: number; height: number; page: number; onPage(i: number): void; onOpen(): void
}) {
  const colors = useColors()
  if (!photos.length) return <View style={[StyleSheet.absoluteFill, local.center]}><Icon name="car" size={48} color={colors.tertiary} /></View>
  return (
    <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} contentOffset={{ x: page * width, y: 0 }}
      onMomentumScrollEnd={(e) => onPage(Math.round(e.nativeEvent.contentOffset.x / width))}>
      {photos.map((p, i) => (
        <Pressable key={p.id} accessibilityRole="imagebutton" accessibilityLabel={`${title}, photo ${i + 1} of ${photos.length}`}
          accessibilityHint="Opens full screen" onPress={onOpen}>
          <PhotoImage uri={imageUrl(p.url)} width={width} height={height} />
        </Pressable>
      ))}
    </ScrollView>
  )
}

function PhotoViewer({ photos, title, start, onClose }: { photos: Photo[]; title: string; start: number; onClose(page: number): void }) {
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const [page, setPage] = useState(start)
  return (
    <Modal visible animationType="fade" onRequestClose={() => onClose(page)} statusBarTranslucent supportedOrientations={['portrait']}>
      <View style={local.viewer}>
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} contentOffset={{ x: start * width, y: 0 }}
          onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}>
          {photos.map((p, i) => (
            <PhotoImage key={p.id} label={`${title}, photo ${i + 1} of ${photos.length}`} uri={imageUrl(p.url)} width={width} height={height} contain />
          ))}
        </ScrollView>
        <View style={[local.chrome, { top: insets.top + 6 }]} pointerEvents="box-none">
          <GlassButton dark icon="close" label="Close photos" onPress={() => onClose(page)} />
          {photos.length > 1 && (
            <GlassCapsule dark style={local.counter}><Text style={[type.footnote, { color: '#FFFFFF', fontWeight: '600' }]}>{page + 1} / {photos.length}</Text></GlassCapsule>
          )}
        </View>
      </View>
    </Modal>
  )
}

const local = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  chrome: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleBand: { position: 'absolute', left: 12, right: 12, bottom: 12, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 12, gap: 4 },
  dots: { flexDirection: 'row', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  specs: { flexDirection: 'row', flexWrap: 'wrap', gap: 0, paddingVertical: 8 },
  spec: { width: '33.33%', paddingVertical: 8, gap: 2 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  viewer: { flex: 1, backgroundColor: '#000000' },
  counter: { paddingHorizontal: 12, paddingVertical: 6 },
})
