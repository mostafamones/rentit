import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { SessionProvider } from '../src/session'
import { useReduceMotion } from '../src/a11y'
import { useColors } from '../src/theme'

export default function RootLayout() {
  const colors = useColors()
  const reduceMotion = useReduceMotion()
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{
          headerTintColor: colors.ink, headerTitleStyle: { color: colors.ink }, headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false, contentStyle: { backgroundColor: colors.background }, headerBackButtonDisplayMode: 'minimal',
        }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          {/* A plain themed push (the photo zoom left a detached, letterboxed route mid-transition); a fade with Reduce Motion. */}
          <Stack.Screen name="listing/[id]" options={{ headerShown: false, animation: reduceMotion ? 'fade' : 'default' }} />
          <Stack.Screen name="account" options={{ title: 'Account' }} />
          <Stack.Screen name="garage" options={{ title: 'My cars' }} />
          <Stack.Screen name="search" options={{ title: 'Search' }} />
          <Stack.Screen name="request/[id]" options={{ title: 'Request' }} />
          <Stack.Screen name="car/[id]" options={{ title: 'Your car' }} />
          <Stack.Screen name="book/[id]" options={{ title: 'Choose dates', presentation: 'modal' }} />
          <Stack.Screen name="sign-in" options={{ title: 'Sign in', presentation: 'modal' }} />
        </Stack>
      </SessionProvider>
    </SafeAreaProvider>
  )
}
