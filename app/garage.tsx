import { router } from 'expo-router'
import { Image, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { api, imageUrl, type Listing, type RentalRequest } from '../src/api'
import { formatEgp } from '../src/domain/rental'
import { useSession } from '../src/session'
import { type, useColors } from '../src/theme'
import { Badge, Button, Empty, Icon, RequestRow, SectionTitle, SignInPrompt, SyncStatus, styles } from '../src/ui'
import { usePoll } from '../src/usePoll'

const LISTING_BADGE = { active: ['Live', 'green'], paused: ['Paused', 'gray'], hidden: ['Under review', 'red'] } as const

export default function Garage() {
  const colors = useColors()
  const { user } = useSession()
  const { data, error, updatedAt, refreshing, refresh } = usePoll(user ? async () => {
    const [cars, incoming] = await Promise.all([
      api<{ listings: Listing[] }>('/listings/mine'), api<{ requests: RentalRequest[] }>('/requests?role=owner'),
    ])
    return { cars: cars.listings, incoming: incoming.requests }
  } : null, String(user?.id))

  if (!user) return <SignInPrompt title="Sign in to list a car" onPress={() => router.push('/sign-in')} />
  const pending = data?.incoming.filter((r) => r.status === 'pending') ?? []
  const upcoming = data?.incoming.filter((r) => r.status === 'accepted') ?? []
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.screen}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      {pending.length > 0 && <SectionTitle trailing={<Badge label={`${pending.length} new`} tone="amber" />}>Requests to answer</SectionTitle>}
      {pending.map((r) => <RequestRow key={r.id} request={r} onPress={() => router.push(`/request/${r.id}`)} />)}
      {upcoming.length > 0 && <SectionTitle>Accepted rentals</SectionTitle>}
      {upcoming.map((r) => <RequestRow key={r.id} request={r} onPress={() => router.push(`/request/${r.id}`)} />)}

      <SectionTitle trailing={<Text accessibilityRole="button" onPress={() => router.push('/car/new')} style={[type.callout, { color: colors.ink, fontWeight: '600' }]}>Add car</Text>}>
        Your cars
      </SectionTitle>
      {data?.cars.length === 0 && <Empty title="No cars listed"
        action={<Button icon="plus" title="List a car" onPress={() => router.push('/car/new')} />} />}
      {data?.cars.map((car) => {
        const [label, tone] = LISTING_BADGE[car.status]
        return (
          <Pressable key={car.id} accessibilityRole="button" onPress={() => router.push(`/car/${car.id}`)}
            style={({ pressed }) => [styles.requestRow, { backgroundColor: colors.card, borderColor: colors.separator, opacity: pressed ? 0.85 : 1 }]}>
            <View style={[styles.thumb, { backgroundColor: colors.fill, alignItems: 'center', justifyContent: 'center' }]}>
              {car.photos[0] ? <Image source={{ uri: imageUrl(car.photos[0].url) }} style={{ width: '100%', height: '100%' }} /> : <Icon name="car" size={28} color={colors.tertiary} />}
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[type.headline, { color: colors.ink }]}>{car.make} {car.model} {car.year}</Text>
              <Text style={[type.subheadline, { color: colors.secondary }]}>{formatEgp(car.dailyRateEgp)}/day · {car.district}</Text>
              <Badge label={label} tone={tone} />
            </View>
            <Icon name="chevronRight" size={14} color={colors.tertiary} />
          </Pressable>
        )
      })}
      <SyncStatus updatedAt={updatedAt} error={error} />
    </ScrollView>
  )
}
