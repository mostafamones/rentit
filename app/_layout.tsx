import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SystemUI from 'expo-system-ui'
import { useEffect, useMemo } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { SessionProvider } from '../src/session'
import { useReduceMotion } from '../src/a11y'
import { useColors, useScheme } from '../src/theme'

export default function RootLayout() {
  const colors = useColors()
  const scheme = useScheme()
  const reduceMotion = useReduceMotion()
  // The navigation theme paints every native screen container; without it they default to white and flash between routes.
  const theme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme
    return { ...base, dark: scheme === 'dark', colors: {
      ...base.colors, primary: colors.ink, background: colors.background, card: colors.background, text: colors.ink, border: colors.separator,
    } }
  }, [scheme, colors])
  // The root window shows through during transitions and gesture-driven dismissals.
  useEffect(() => { SystemUI.setBackgroundColorAsync(colors.background).catch(() => {}) }, [colors.background])
  return (
    <ThemeProvider value={theme}>
      <SafeAreaProvider style={{ backgroundColor: colors.background }}>
        <SessionProvider>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <Stack screenOptions={{
            headerTintColor: colors.ink, headerTitleStyle: { color: colors.ink }, headerStyle: { backgroundColor: colors.background },
            headerShadowVisible: false, contentStyle: { backgroundColor: colors.background }, headerBackButtonDisplayMode: 'minimal',
          }}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            {/* iOS 18+ zooms from the card's photo when the card is a Link.AppleZoom source; otherwise a themed push, a fade with Reduce Motion. */}
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
    </ThemeProvider>
  )
}
