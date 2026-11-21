import { router } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { api, type RentalRequest } from '../src/api'
import { useSession } from '../src/session'
import { APPEARANCE_PREFS, setAppearancePref, type, useAppearancePref, useColors } from '../src/theme'
import { Badge, Button, Card, Icon, SignInPrompt, styles } from '../src/ui'
import { usePoll } from '../src/usePoll'

export default function Account() {
  const colors = useColors()
  const { user, signOut } = useSession()
  const { data: incoming } = usePoll(user
    ? () => api<{ requests: RentalRequest[] }>('/requests?role=owner').then((r) => r.requests.filter((x) => x.status === 'pending').length)
    : null, String(user?.id))
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.screen}>
      {user ? (
        <Card>
          <Text style={[type.title, { color: colors.ink }]}>{user.name}</Text>
          {user.businessName && <Text style={[type.callout, { color: colors.ink }]}>{user.businessName}</Text>}
          <Text style={[type.callout, { color: colors.secondary }]}>{user.email}</Text>
          <Text style={[type.callout, { color: colors.secondary }]}>{user.phone}</Text>
        </Card>
      ) : (
        <SignInPrompt title="Sign in to rent or list a car" onPress={() => router.push('/sign-in')} />
      )}
      {user && (
        <Pressable accessibilityRole="button" accessibilityLabel={`My cars and requests${incoming ? `, ${incoming} new` : ''}`}
          onPress={() => router.push('/garage')}
          style={({ pressed }) => [styles.requestRow, { backgroundColor: colors.card, borderColor: colors.separator, opacity: pressed ? 0.85 : 1 }]}>
          <Icon name="key" size={18} color={colors.ink} />
          <Text style={[type.body, styles.flex, { color: colors.ink }]}>My cars and requests</Text>
          {!!incoming && <Badge label={`${incoming} new`} tone="amber" />}
          <Icon name="chevronRight" size={14} color={colors.tertiary} />
        </Pressable>
      )}
      <Appearance />
      <Card>
        <Text style={[type.headline, { color: colors.ink }]}>Renting terms</Text>
        {[
          'Daily prices in EGP. Days = return date minus pickup date.',
          'Dates are booked only when the owner accepts.',
          'Your quoted total is locked when you send a request.',
          'Payment and deposit are settled with the owner at pickup.',
        ].map((line) => <Text key={line} style={[type.callout, { color: colors.ink }]}>• {line}</Text>)}
      </Card>
      {user && <View><Button kind="secondary" title="Sign out" onPress={signOut} /></View>}
    </ScrollView>
  )
}

const PREF_LABEL = { system: 'System', light: 'Light', dark: 'Dark' }

function Appearance() {
  const colors = useColors()
  const pref = useAppearancePref()
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Appearance" style={[styles.card, local.group, { backgroundColor: colors.card, borderColor: colors.separator }]}>
      <Text accessibilityRole="header" style={[type.headline, local.groupTitle, { color: colors.ink }]}>Appearance</Text>
      {APPEARANCE_PREFS.map((p, i) => (
        <Pressable key={p} accessibilityRole="radio" accessibilityState={{ checked: p === pref }} onPress={() => setAppearancePref(p)}
          style={({ pressed }) => [styles.menuItem, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.separator },
            pressed && { backgroundColor: colors.fill }]}>
          <Text style={[type.body, styles.flex, { color: colors.ink }]}>{PREF_LABEL[p]}</Text>
          {p === pref && <Icon name="check" size={16} color={colors.ink} />}
        </Pressable>
      ))}
    </View>
  )
}

const local = StyleSheet.create({
  group: { padding: 0, gap: 0, overflow: 'hidden' },
  groupTitle: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
})
