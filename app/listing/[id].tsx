import { Link, router, useLocalSearchParams } from 'expo-router'
import { useState, type ReactNode } from 'react'
import { Alert, LayoutAnimation, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { api, imageUrl, listingPreviews, type ListingDetail } from '../../src/api'
import { TRANSMISSION_LABEL, VEHICLE_TYPE_LABEL, formatDate, formatEgp } from '../../src/domain/rental'
import { useSession } from '../../src/session'
import { type, useColors } from '../../src/theme'
import { heroHeight, pageAt } from '../../src/media'
import { Banner, Button, Card, GlassButton, GlassCapsule, Icon, OwnerLine, Photo as PhotoImage, SyncStatus, ZoomFrame, photoAspects, styles } from '../../src/ui'
import { usePoll } from '../../src/usePoll'
import { useReduceMotion } from '../../src/a11y'

type Photo = ListingDetail['photos'][number]

export default function ListingScreen() {
  const { id, photo } = useLocalSearchParams<{ id: string; photo?: string }>()
  const colors = useColors()
  const { width, height: screenHeight } = useWindowDimensions()
  const reduceMotion = useReduceMotion()
  const insets = useSafeAreaInsets()
  const { user } = useSession()
  // Opens on the photo the card was showing.
  const [page, setPage] = useState(() => Number(photo) || 0)
  const [viewer, setViewer] = useState(false)
  const { data: l, error, updatedAt } = usePoll(() => api<{ listing: ListingDetail }>(`/listings/${id}`).then((r) => r.listing), `${id}:${user?.id}`)
  const back = () => (router.canGoBack() ? router.back() : router.replace('/browse'))
  // Re-renders when a photo's size first becomes known; the sizes themselves live in photoAspects.
  const [, setSized] = useState(0)

  // Until the detail arrives, the hero shows the card's copy so the zoom lands on the same photo from the first frame.
  const preview = l ?? listingPreviews.get(Number(id))
  const photos = preview?.photos ?? []
  const title = preview ? `${preview.make} ${preview.model} ${preview.year}` : ''
  const shown = Math.min(page, Math.max(0, photos.length - 1))
  // Sized by the photo the pager rests on, so it changes once per swipe, never per scroll event.
  const heroH = heroHeight(width, screenHeight, photoAspects.get(imageUrl(photos[shown]?.url) ?? ''))
  const onPage = (i: number) => {
    if (i !== page && !reduceMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setPage(i)
  }

  // One stable tree from loading to loaded; the zoom lands on an empty frame over the gallery, so photos never sit inside
  // the transition's native wrapper and show even if it registers nothing.
  // The title sits under the photo so it never covers the car.
  const hero = (
    <>
      <View collapsable={false} style={{ width, height: heroH, backgroundColor: colors.fill }}>
        <Gallery photos={photos} title={title} width={width} height={heroH} vignette={56} page={page} onPage={onPage}
          onAspect={() => setSized((n) => n + 1)} onOpen={() => setViewer(true)} />
        <Link.AppleZoomTarget><ZoomFrame width={width} height={heroH} /></Link.AppleZoomTarget>
      </View>
    </>
  )
  // One continuous panel below the photo; it rises over the photo's bottom edge just enough to show its rounded corners.
  const panel = (children: ReactNode) => (
    <View style={[local.panel, { backgroundColor: colors.background }]}>
      {preview && (
        <View style={local.titleBlock}>
          <Text accessibilityRole="header" numberOfLines={2} style={[type.title, { color: colors.ink }]}>{title}</Text>
          <View style={styles.row}>
            <View style={styles.meta}>
              <Icon name="pin" size={14} color={colors.secondary} />
              <Text style={[type.callout, { color: colors.secondary }]}>{preview.district}</Text>
            </View>
            {photos.length > 1 && (
              <Text accessibilityLabel={`Photo ${shown + 1} of ${photos.length}`} style={[type.footnote, { color: colors.secondary, fontVariant: ['tabular-nums'] }]}>
                {shown + 1} / {photos.length}
              </Text>
            )}
          </View>
        </View>
      )}
      <View style={styles.screen}>{children}</View>
    </View>
  )
  const chrome = (
    <View style={[local.chrome, { top: 6 }]} pointerEvents="box-none">
      <GlassButton icon="back" label="Back" onPress={back} />
      {photos.length > 0 && <GlassButton icon="expand" label="View photos full screen" onPress={() => setViewer(true)} />}
    </View>
  )

  if (!l) {
    return (
      <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={{ paddingBottom: 120 }} contentInsetAdjustmentBehavior="never">
          {hero}
          {panel(<SyncStatus error={error} />)}
        </ScrollView>
        {chrome}
      </SafeAreaView>
    )
  }
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
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} contentInsetAdjustmentBehavior="never">
        {hero}

        {panel(<>
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
        </>)}
      </ScrollView>
      {chrome}

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

      {viewer && <PhotoViewer photos={l.photos} title={title} start={shown} onClose={() => setViewer(false)} />}
    </SafeAreaView>
  )
}

/** Swipeable photos; the title below shows the page count. Tapping a photo opens it full screen. */
function Gallery({ photos, title, width, height, vignette, page, onPage, onAspect, onOpen }: {
  photos: Photo[]; title: string; width: number; height: number; vignette: number; page: number; onPage(i: number): void; onAspect(): void; onOpen(): void
}) {
  const colors = useColors()
  // The opening page is applied once at mount; passing it on every render can jump or blank the pager mid-swipe.
  const [start] = useState(page)
  if (!photos.length) return <View style={[StyleSheet.absoluteFill, local.center]}><Icon name="car" size={48} color={colors.tertiary} /></View>
  return (
    <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ width, height }}
      contentOffset={{ x: Math.min(start, photos.length - 1) * width, y: 0 }}
      onMomentumScrollEnd={(e) => onPage(pageAt(e.nativeEvent.contentOffset.x, width, photos.length))}>
      {photos.map((p, i) => (
        <Pressable key={p.id} style={{ width, height }} accessibilityRole="imagebutton" accessibilityLabel={`${title}, photo ${i + 1} of ${photos.length}`}
          accessibilityHint="Opens full screen" onPress={onOpen}>
          <PhotoImage uri={imageUrl(p.url)} width={width} height={height} poster vignette={vignette} onAspect={onAspect} />
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
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ width, height }} contentOffset={{ x: start * width, y: 0 }}
          onMomentumScrollEnd={(e) => setPage(pageAt(e.nativeEvent.contentOffset.x, width, photos.length))}>
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
  // Short overlap: covers only the photo's bottom 16pt so the corners read against it.
  panel: { marginTop: -16, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderCurve: 'continuous' },
  titleBlock: { paddingHorizontal: 16, paddingTop: 18, gap: 4 },
  specs: { flexDirection: 'row', flexWrap: 'wrap', gap: 0, paddingVertical: 8 },
  spec: { width: '33.33%', paddingVertical: 8, gap: 2 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  viewer: { flex: 1, backgroundColor: '#000000' },
  counter: { paddingHorizontal: 12, paddingVertical: 6 },
})
