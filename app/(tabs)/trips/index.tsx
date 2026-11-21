import { router } from 'expo-router'
import { RefreshControl, ScrollView } from 'react-native'
import { api, type RentalRequest } from '../../../src/api'
import { useSession } from '../../../src/session'
import { Button, Empty, RequestRow, SectionTitle, SignInPrompt, SyncStatus, styles } from '../../../src/ui'
import { usePoll } from '../../../src/usePoll'

export default function Trips() {
  const { user } = useSession()
  const { data, error, updatedAt, refreshing, refresh } = usePoll(
    user ? () => api<{ requests: RentalRequest[] }>('/requests?role=renter').then((r) => r.requests) : null, String(user?.id))

  if (!user) return <SignInPrompt title="Sign in to see your trips" onPress={() => router.push('/sign-in')} />
  const open = data?.filter((r) => r.status === 'pending' || r.status === 'accepted') ?? []
  const past = data?.filter((r) => r.status === 'declined' || r.status === 'cancelled') ?? []
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.screen}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      {data?.length === 0 && <Empty title="No trips yet"
        action={<Button kind="secondary" title="Browse cars" onPress={() => router.navigate('/browse')} />} />}
      {open.length > 0 && <SectionTitle>Active</SectionTitle>}
      {open.map((r) => <RequestRow key={r.id} request={r} onPress={() => router.push(`/request/${r.id}`)} />)}
      {past.length > 0 && <SectionTitle>Closed</SectionTitle>}
      {past.map((r) => <RequestRow key={r.id} request={r} onPress={() => router.push(`/request/${r.id}`)} />)}
      <SyncStatus updatedAt={updatedAt} error={error} />
    </ScrollView>
  )
}
