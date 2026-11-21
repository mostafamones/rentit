import { router } from 'expo-router'
import { Platform, Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api, type Listing } from '../../../src/api'
import { useSession } from '../../../src/session'
import { type, useColors } from '../../../src/theme'
import { AccountButton, Empty, Icon, ListingCard, SectionTitle, SyncStatus, styles } from '../../../src/ui'
import { usePoll } from '../../../src/usePoll'

/** Browse: a welcome, a rail of featured cars, then every car. Searching and filtering live on Search. */
export default function Browse() {
  const colors = useColors()
  const { user } = useSession()
  const { width } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const { data, error, refreshing, refresh } = usePoll(
    () => api<{ listings: Listing[] }>('/listings').then((r) => r.listings), 'browse')
  const featured = data?.filter((l) => l.featured) ?? []
  // Narrower than the screen so the next card peeks in and the rail reads as scrollable.
  const railCard = Math.round(Math.min(width * 0.62, 280))
  const first = user?.name.split(' ')[0]

  return (
    <View style={styles.flex}>
      {/* No native header: iOS insets the scroll view for the status bar and tab bar itself; Android pads by the inset. */}
      <ScrollView contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.screen, Platform.OS === 'ios'
          ? { paddingTop: 8 }
          : { paddingTop: insets.top + 8, paddingBottom: 76 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <View style={styles.row}>
          <Text accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit
            style={[type.largeTitle, styles.flex, { color: colors.ink }]}>{first ? `Welcome back, ${first}` : 'Welcome'}</Text>
          <AccountButton />
        </View>
        {featured.length > 0 && (
          <>
            <SectionTitle>Featured</SectionTitle>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast" snapToInterval={railCard + 12}
              snapToAlignment="start" style={{ marginHorizontal: -16 }} contentContainerStyle={{ gap: 12, paddingHorizontal: 16, paddingBottom: 8 }}>
              {featured.map((listing) => <ListingCard key={listing.id} listing={listing} width={railCard} />)}
            </ScrollView>
          </>
        )}
        {!!data?.length && <SectionTitle>All cars</SectionTitle>}
        {data?.map((listing) => <ListingCard key={listing.id} listing={listing} />)}
        {data?.length === 0 && <Empty title="No cars listed yet" />}
        <SyncStatus loading={data === undefined} error={error} />
      </ScrollView>
      {/* iOS has the system search tab at the bottom right; Android gets the same action as a floating button. */}
      {Platform.OS !== 'ios' && (
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
