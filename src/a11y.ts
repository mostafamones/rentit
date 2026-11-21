import { AccessibilityInfo } from 'react-native'
import { useSyncExternalStore } from 'react'

// One app-wide subscription per setting. Android has no Reduce Transparency, so it stays false there.
function setting(event: 'reduceMotionChanged' | 'reduceTransparencyChanged', read: () => Promise<boolean>) {
  let value = false
  let started = false
  const listeners = new Set<() => void>()
  const update = (next: boolean) => {
    if (next === value) return
    value = next
    listeners.forEach((listener) => listener())
  }
  const subscribe = (listener: () => void) => {
    if (!started) {
      started = true
      AccessibilityInfo.addEventListener(event, update)
      read().then(update, () => {})
    }
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }
  return () => useSyncExternalStore(subscribe, () => value)
}

/** Settings › Accessibility › Reduce Motion: zooms and scales become fades. */
export const useReduceMotion = setting('reduceMotionChanged', () => AccessibilityInfo.isReduceMotionEnabled())
/** Settings › Accessibility › Reduce Transparency: glass becomes a solid surface. */
export const useReduceTransparency = setting('reduceTransparencyChanged', () => AccessibilityInfo.isReduceTransparencyEnabled())
