import { Stack } from 'expo-router'
import { useColors } from '../../../src/theme'
import { tabStackOptions } from '../../../src/ui'

export default function Layout() {
  return (
    <Stack screenOptions={tabStackOptions(useColors())}>
      <Stack.Screen name="index" options={{ title: 'Search' }} />
    </Stack>
  )
}
