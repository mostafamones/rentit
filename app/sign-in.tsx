import { router } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native'
import { useSession } from '../src/session'
import { type, useColors } from '../src/theme'
import { Banner, Button, Field, MenuPill, styles } from '../src/ui'

export default function SignIn() {
  const colors = useColors()
  const { signIn, register } = useSession()
  const [mode, setMode] = useState<'signin' | 'register'>('signin')
  const [form, setForm] = useState({ email: '', password: '', name: '', phone: '', accountType: 'individual', businessName: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }))

  const submit = async () => {
    setBusy(true)
    setError(undefined)
    try {
      if (mode === 'signin') await signIn(form.email, form.password)
      else await register(form)
      router.back()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
        <MenuPill label="Account" value={mode} onSelect={(m) => { setMode(m); setError(undefined) }}
          options={[{ value: 'signin', title: 'I have an account' }, { value: 'register', title: 'Create an account' }]} />
        <Text style={[type.subheadline, { color: colors.secondary }]}>
          One account can rent cars and list its own. Choose business if you run a rental company.
        </Text>
        {mode === 'register' && (
          <>
            <Field label="Full name" value={form.name} onChangeText={set('name')} autoComplete="name" textContentType="name" />
            <Field label="Mobile number" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" autoComplete="tel"
              placeholder="+20 10 1234 5678" hint="Shared only with the other side of an accepted rental." />
            <View style={{ gap: 6 }}>
              <Text style={[type.footnote, { color: colors.secondary, fontWeight: '600' }]}>Account type</Text>
              <MenuPill label="Account type" value={form.accountType} onSelect={set('accountType')}
                options={[{ value: 'individual', title: 'Individual' }, { value: 'business', title: 'Rental business' }]} />
            </View>
            {form.accountType === 'business' && <Field label="Business name" value={form.businessName} onChangeText={set('businessName')} />}
          </>
        )}
        <Field label="Email" value={form.email} onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
        <Field label="Password" value={form.password} onChangeText={set('password')} secureTextEntry autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          hint={mode === 'register' ? 'At least 8 characters.' : undefined} />
        {error && <Banner tone="error" text={error} />}
        <Button title={mode === 'signin' ? 'Sign in' : 'Create account'} busy={busy} onPress={submit} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
