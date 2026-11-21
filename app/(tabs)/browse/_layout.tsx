import { Stack } from 'expo-router'
import { useColors } from '../../../src/theme'
import { tabStackOptions } from '../../../src/ui'

export default function Layout() {
  return (
    <Stack screenOptions={tabStackOptions(useColors())}>
      {/* Browse draws its own top row (greeting + Account), so the empty native bar would only push it down. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  )
}
