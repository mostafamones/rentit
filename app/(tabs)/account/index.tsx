import { router } from 'expo-router'
import { ScrollView, Text } from 'react-native'
import { API_URL } from '../../../src/api'
import { useSession } from '../../../src/session'
import { type, useColors } from '../../../src/theme'
import { Badge, Button, Card, SignInPrompt, styles } from '../../../src/ui'

export default function Account() {
  const colors = useColors()
  const { user, signOut } = useSession()
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.screen}>
      {user ? (
        <Card>
          <Text style={[type.title, { color: colors.ink }]}>{user.name}</Text>
          {user.businessName && <Text style={[type.callout, { color: colors.ink }]}>{user.businessName}</Text>}
          <Badge label={user.accountType === 'business' ? 'Business account' : 'Individual account'} tone="blue" />
          <Text style={[type.callout, { color: colors.secondary }]}>{user.email}</Text>
          <Text style={[type.callout, { color: colors.secondary }]}>{user.phone}</Text>
          <Text style={[type.footnote, { color: colors.secondary }]}>Your phone and email are shown only to the other side of an accepted rental.</Text>
        </Card>
      ) : (
        <SignInPrompt title="Browse without an account" body="Sign in to request cars or list your own." onPress={() => router.push('/sign-in')} />
      )}
      <Card>
        <Text style={[type.headline, { color: colors.ink }]}>How Rentit works</Text>
        {[
          'Prices are per day, in Egyptian pounds. Days = return date minus pickup date.',
          'A request doesn’t hold the car. The dates are booked only when the owner accepts.',
          'The total you see is locked into your request, even if the owner changes the price later.',
          'Payment and deposit are arranged with the owner at pickup. Rentit does not take payments.',
        ].map((line) => <Text key={line} style={[type.callout, { color: colors.ink }]}>• {line}</Text>)}
      </Card>
      {user && <Button kind="secondary" title="Sign out" onPress={signOut} />}
      <Text style={[type.caption, { color: colors.tertiary, textAlign: 'center' }]}>Pilot build · server {API_URL}</Text>
    </ScrollView>
  )
}
