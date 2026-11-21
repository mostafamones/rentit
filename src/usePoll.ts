import { useFocusEffect } from 'expo-router'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'

const POLL_MS = 15_000

type PollResult<T> = { key: string; data?: T; error?: string }

/** Loads on focus and every 15 s. The key includes any account or filter that changes the result. */
export function usePoll<T>(load: (() => Promise<T>) | null, key: string) {
  const [result, setResult] = useState<PollResult<T>>()
  const [refreshingKey, setRefreshingKey] = useState<string>()
  const current = useRef({ load, key })
  const version = useRef(0)
  useLayoutEffect(() => {
    current.current = { load, key }
  }, [load, key])

  const refresh = useCallback(async (manual = false) => {
    const { load, key } = current.current
    if (!load) return
    const requestVersion = ++version.current
    const isCurrent = () => requestVersion === version.current && current.current.key === key
    if (manual) setRefreshingKey(key)
    try {
      const data = await load()
      if (isCurrent()) setResult({ key, data })
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      if (isCurrent()) setResult((previous) => ({ ...(previous?.key === key ? previous : undefined), key, error }))
    } finally {
      if (isCurrent()) setRefreshingKey(undefined)
    }
  }, [])

  const setData = (data: T) => {
    if (current.current.key !== key) return
    version.current++
    setRefreshingKey(undefined)
    setResult({ key, data })
  }

  useFocusEffect(useCallback(() => {
    void refresh()
    const timer = setInterval(() => void refresh(), POLL_MS)
    return () => {
      clearInterval(timer)
      version.current++
    }
  }, [refresh, key]))

  const visible = load && result?.key === key ? result : undefined
  return { data: visible?.data, setData, error: visible?.error,
    refreshing: refreshingKey === key, refresh: () => refresh(true) }
}
