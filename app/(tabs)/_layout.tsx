import { NativeTabs } from 'expo-router/native-tabs'
import { Platform } from 'react-native'
import { useColors } from '../../src/theme'

export default function TabsLayout() {
  const colors = useColors()
  return (
    <NativeTabs tintColor={colors.ink}>
      <NativeTabs.Trigger name="browse">
        <NativeTabs.Trigger.Label>Browse</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'car', selected: 'car.fill' }} md="directions_car" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="trips">
        <NativeTabs.Trigger.Label>Trips</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="calendar" md="event_note" />
      </NativeTabs.Trigger>
      {/* iOS draws the search role as its own bottom-right control, apart from the tabs. Android uses a floating
          search button on Browse instead, so the tab bar keeps exactly two tabs there. */}
      <NativeTabs.Trigger name="search" role="search" hidden={Platform.OS !== 'ios'}>
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
