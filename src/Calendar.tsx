import { Pressable, StyleSheet, Text, View } from 'react-native'
import { addDays, cairoToday } from './domain/rental'
import { type, useColors } from './theme'

const WEEKDAYS = ['Sa', 'Su', 'Mo', 'Tu', 'We', 'Th', 'Fr'] // Egyptian week starts on Saturday

/** Month grids from the current Cairo month. `start`..`end` is highlighted; `taken` days are struck through. */
export function Calendar({ start, end, months = 3, taken, disabled, onPress }: {
  start?: string; end?: string; months?: number
  taken(day: string): boolean; disabled(day: string): boolean; onPress(day: string): void
}) {
  const colors = useColors()
  const today = cairoToday()
  const first = `${today.slice(0, 7)}-01`
  return (
    <View style={{ gap: 18 }}>
      {Array.from({ length: months }, (_, m) => {
        const monthStart = addMonths(first, m)
        const lead = (new Date(`${monthStart}T00:00:00Z`).getUTCDay() + 1) % 7 // Saturday = 0
        const length = new Date(Date.UTC(Number(monthStart.slice(0, 4)), Number(monthStart.slice(5, 7)), 0)).getUTCDate()
        const cells = [...Array<string | null>(lead).fill(null), ...Array.from({ length }, (_, i) => addDays(monthStart, i))]
        return (
          <View key={monthStart} style={{ gap: 6 }}>
            <Text accessibilityRole="header" style={[type.headline, { color: colors.ink }]}>
              {new Date(`${monthStart}T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
            </Text>
            <View style={styles.grid}>
              {WEEKDAYS.map((d) => <Text key={d} style={[type.caption, styles.cell, styles.weekday, { color: colors.tertiary }]}>{d}</Text>)}
              {cells.map((day, i) => {
                if (!day) return <View key={`e${i}`} style={styles.cell} />
                const isTaken = taken(day)
                const off = day < today || disabled(day)
                const edge = day === start || day === end
                const inside = !!start && !!end && day > start && day < end
                return (
                  <Pressable key={day} disabled={off} onPress={() => onPress(day)} accessibilityRole="button"
                    accessibilityLabel={`${new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}${isTaken ? ', unavailable' : ''}${day === start ? ', start' : day === end ? ', end' : ''}`}
                    accessibilityState={{ disabled: off, selected: edge || inside }}
                    style={[styles.cell, inside && { backgroundColor: colors.accentSoft }]}>
                    <View style={[styles.day, edge && { backgroundColor: colors.accent }]}>
                      <Text style={[type.callout, {
                        color: edge ? colors.onAccent : off ? colors.tertiary : colors.ink,
                        textDecorationLine: isTaken ? 'line-through' : 'none', fontWeight: day === today ? '700' : '400',
                      }]}>{Number(day.slice(8))}</Text>
                    </View>
                  </Pressable>
                )
              })}
            </View>
          </View>
        )
      })}
    </View>
  )
}

function addMonths(monthStart: string, n: number) {
  const d = new Date(`${monthStart}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + n)
  return d.toISOString().slice(0, 10)
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, height: 44, alignItems: 'center', justifyContent: 'center' },
  weekday: { height: 24, textAlign: 'center' },
  day: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
})
