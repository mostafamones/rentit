import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Alert, Image, Linking, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { api, imageUrl, type RentalRequest } from '../../src/api'
import { formatDate, formatEgp } from '../../src/domain/rental'
import { useSession } from '../../src/session'
import { type, useColors } from '../../src/theme'
import { Banner, Button, Card, Icon, StatusBadge, SyncStatus, styles } from '../../src/ui'
import { usePoll } from '../../src/usePoll'

export default function RequestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const colors = useColors()
  const { user, ready } = useSession()
  const { data: r, setData, error, updatedAt, refreshing, refresh } = usePoll(
    user ? () => api<{ request: RentalRequest }>(`/requests/${id}`).then((x) => x.request) : null, `${id}:${user?.id}`)
  const [busy, setBusy] = useState<string>()
  const [actionError, setActionError] = useState<string>()

  if (!r) return <View style={styles.screen}><SyncStatus error={ready && !user ? 'Sign in to view this request.' : error} /></View>

  const act = (action: 'accept' | 'decline' | 'cancel', title: string, message: string) =>
    Alert.alert(title, message, [
      { text: 'Back', style: 'cancel' },
      {
        text: title, style: action === 'accept' ? 'default' : 'destructive',
        onPress: async () => {
          setBusy(action)
          setActionError(undefined)
          try {
            setData((await api<{ request: RentalRequest }>(`/requests/${r.id}/${action}`, { body: {} })).request)
          } catch (e) {
            setActionError((e as Error).message)
            refresh()
          } finally {
            setBusy(undefined)
          }
        },
      },
    ])

  const owner = r.role === 'owner'
  const other = owner ? `${r.renter.name} (renter)` : r.owner.businessName ?? r.owner.name
  return (
    <ScrollView contentContainerStyle={styles.screen} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <Pressable accessibilityRole="button" onPress={() => router.push(`/listing/${r.listing.id}`)} style={[styles.row, { justifyContent: 'flex-start', gap: 12 }]}>
        <View style={[styles.thumb, { backgroundColor: colors.fill }]}>
          {r.listing.photoUrl && <Image source={{ uri: imageUrl(r.listing.photoUrl) }} style={{ width: '100%', height: '100%' }} />}
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[type.headline, { color: colors.ink }]}>{r.listing.title}</Text>
          <Text style={[type.subheadline, { color: colors.secondary }]}>Pickup in {r.listing.district}</Text>
          <StatusBadge status={r.status} role={r.role} />
        </View>
        <Icon name="chevronRight" size={14} color={colors.tertiary} />
      </Pressable>

      {r.statusReason && <Banner tone={r.status === 'accepted' ? 'success' : 'info'} text={r.statusReason} />}
      {r.status === 'pending' && owner && <Banner text="Accepting books these dates and declines overlapping requests." />}

      <Card>
        <View style={styles.row}>
          <View style={{ gap: 2 }}>
            <Text style={[type.caption, { color: colors.secondary }]}>Pickup</Text>
            <Text style={[type.headline, { color: colors.ink }]}>{formatDate(r.startDate)}</Text>
          </View>
          <Text style={[type.headline, { color: colors.tertiary }]}>→</Text>
          <View style={{ gap: 2, alignItems: 'flex-end' }}>
            <Text style={[type.caption, { color: colors.secondary }]}>Return</Text>
            <Text style={[type.headline, { color: colors.ink }]}>{formatDate(r.endDate)}</Text>
          </View>
        </View>
        <View style={[styles.row, { borderTopWidth: 1, borderColor: colors.separator, paddingTop: 10 }]}>
          <Text style={[type.callout, { color: colors.secondary }]}>{formatEgp(r.dailyRateEgp)} × {r.days} {r.days === 1 ? 'day' : 'days'}</Text>
          <Text style={[type.price, { color: colors.ink }]}>{formatEgp(r.totalEgp)}</Text>
        </View>
        <Text style={[type.footnote, { color: colors.secondary }]}>Paid to the owner at pickup.</Text>
      </Card>

      <Card>
        <Text style={[type.caption, { color: colors.secondary }]}>{owner ? 'Renter' : 'Owner'}</Text>
        <Text style={[type.headline, { color: colors.ink }]}>{other}</Text>
        {r.note ? <Text style={[type.callout, { color: colors.ink }]}>“{r.note}”</Text> : null}
        {r.contact ? (
          <View style={{ gap: 8 }}>
            <Pressable accessibilityRole="link" onPress={() => Linking.openURL(`tel:${r.contact!.phone.replace(/\s/g, '')}`)} style={styles.meta}>
              <Icon name="phone" size={14} color={colors.ink} />
              <Text style={[type.callout, { color: colors.ink }]}>{r.contact.phone}</Text>
            </Pressable>
            <Pressable accessibilityRole="link" onPress={() => Linking.openURL(`mailto:${r.contact!.email}`)} style={styles.meta}>
              <Icon name="mail" size={14} color={colors.ink} />
              <Text style={[type.callout, { color: colors.ink }]}>{r.contact.email}</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={[type.footnote, { color: colors.secondary }]}>Contact details after acceptance.</Text>
        )}
      </Card>

      {actionError && <Banner tone="error" text={actionError} />}
      {owner && r.status === 'pending' && (
        <View style={{ gap: 10 }}>
          <Button title="Accept and book dates" busy={busy === 'accept'}
            onPress={() => act('accept', 'Accept', `Book ${formatDate(r.startDate)} → ${formatDate(r.endDate)} for ${formatEgp(r.totalEgp)}? Your contact details will be shared with the renter.`)} />
          <Button kind="danger" title="Decline" busy={busy === 'decline'} onPress={() => act('decline', 'Decline', 'Decline this request?')} />
        </View>
      )}
      {(r.status === 'accepted' || (!owner && r.status === 'pending')) && (
        <Button kind="danger" title={owner ? 'Cancel rental' : 'Cancel request'} busy={busy === 'cancel'}
          onPress={() => act('cancel', owner ? 'Cancel rental' : 'Cancel request',
            r.status === 'accepted' ? 'The dates will open up again and the other party will see the cancellation.' : 'Withdraw this request?')} />
      )}
      <SyncStatus updatedAt={updatedAt} error={error} />
    </ScrollView>
  )
}
