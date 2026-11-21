import { Stack } from 'expo-router'
import { useColors } from '../../../src/theme'

export default function Layout() {
  const colors = useColors()
  return (
    <Stack screenOptions={{
      headerLargeTitle: true, headerLargeTitleShadowVisible: false, headerShadowVisible: false, headerTintColor: colors.accent,
      headerStyle: { backgroundColor: colors.background }, headerLargeStyle: { backgroundColor: colors.background },
      headerTitleStyle: { color: colors.ink }, headerLargeTitleStyle: { color: colors.ink }, contentStyle: { backgroundColor: colors.background },
    }}>
      <Stack.Screen name="index" options={{ title: 'Account' }} />
    </Stack>
  )
}
