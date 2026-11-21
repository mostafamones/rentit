import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { SessionProvider } from '../src/session'
import { useColors } from '../src/theme'

export default function RootLayout() {
  const colors = useColors()
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{
          headerTintColor: colors.accent, headerTitleStyle: { color: colors.ink }, headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false, contentStyle: { backgroundColor: colors.background }, headerBackButtonDisplayMode: 'minimal',
        }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="listing/[id]" options={{ title: '' }} />
          <Stack.Screen name="request/[id]" options={{ title: 'Request' }} />
          <Stack.Screen name="car/[id]" options={{ title: 'Your car' }} />
          <Stack.Screen name="book/[id]" options={{ title: 'Choose dates', presentation: 'modal' }} />
          <Stack.Screen name="sign-in" options={{ title: 'Sign in', presentation: 'modal' }} />
        </Stack>
      </SessionProvider>
    </SafeAreaProvider>
  )
}
