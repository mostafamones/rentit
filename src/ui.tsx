import { SymbolView } from 'expo-symbols'
import { useRef, useState, type ComponentRef, type ReactNode } from 'react'
import {
  ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions,
  type StyleProp, type TextInputProps, type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { imageUrl, type Listing, type RentalRequest } from './api'
import { TRANSMISSION_LABEL, VEHICLE_TYPE_LABEL, formatDate, formatEgp, type RequestStatus } from './domain/rental'
import { type, useColors } from './theme'

const ICONS = {
  chevronDown: { ios: 'chevron.down', android: 'keyboard_arrow_down' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right' },
  check: { ios: 'checkmark', android: 'check' },
  pin: { ios: 'mappin.and.ellipse', android: 'location_on' },
  car: { ios: 'car.fill', android: 'directions_car' },
  business: { ios: 'building.2.fill', android: 'business' },
  person: { ios: 'person.fill', android: 'person' },
  calendar: { ios: 'calendar', android: 'calendar_month' },
  phone: { ios: 'phone.fill', android: 'call' },
  mail: { ios: 'envelope.fill', android: 'mail' },
  flag: { ios: 'flag', android: 'flag' },
  plus: { ios: 'plus', android: 'add' },
  close: { ios: 'xmark', android: 'close' },
  photo: { ios: 'photo.badge.plus', android: 'add_photo_alternate' },
  warning: { ios: 'exclamationmark.triangle.fill', android: 'warning' },
} as const
export type IconName = keyof typeof ICONS

export function Icon({ name, size = 16, color }: { name: IconName; size?: number; color?: string }) {
  const colors = useColors()
  return <SymbolView name={ICONS[name]} size={size} tintColor={color ?? colors.secondary} resizeMode="scaleAspectFit"
    style={{ width: size, height: size }} />
}

// --- Menu pill: compact capsule showing the current choice; opens an anchored menu that ticks it. ---

export type PillOption<T extends string> = { value: T; title: string }

export function MenuPill<T extends string>({ label, value, options, onSelect, highlight }: {
  label: string; value: T; options: readonly PillOption<T>[]; onSelect(value: T): void; highlight?: boolean
}) {
  const colors = useColors()
  const trigger = useRef<ComponentRef<typeof View>>(null)
  const [anchor, setAnchor] = useState<{ x: number; y: number; width: number; height: number }>()
  const title = options.find((o) => o.value === value)?.title ?? label
  const open = () => trigger.current?.measureInWindow((x, y, width, height) => setAnchor({ x, y, width, height }))
  return (
    <>
      <Pressable ref={trigger} accessibilityRole="button" accessibilityLabel={`${label}, ${title}`} accessibilityHint="Opens choices"
        accessibilityState={{ expanded: !!anchor }} hitSlop={4} onPress={open}
        style={({ pressed }) => [styles.pill, {
          backgroundColor: highlight ? colors.accentSoft : colors.card, borderColor: highlight ? colors.accent : colors.separator,
          opacity: pressed ? 0.7 : 1,
        }]}>
        <Text numberOfLines={1} style={[type.subheadline, styles.pillText, { color: highlight ? colors.accent : colors.ink }]}>{title}</Text>
        <Icon name="chevronDown" size={11} color={highlight ? colors.accent : colors.secondary} />
      </Pressable>
      {anchor && (
        <AnchoredMenu anchor={anchor} label={label} onClose={() => setAnchor(undefined)}
          items={options.map((o) => ({ key: o.value, title: o.title, checked: o.value === value, onPress: () => onSelect(o.value) }))} />
      )}
    </>
  )
}

type MenuItem = { key: string; title: string; checked?: boolean; destructive?: boolean; onPress(): void }

function AnchoredMenu({ anchor, label, items, onClose }: {
  anchor: { x: number; y: number; width: number; height: number }; label: string; items: MenuItem[]; onClose(): void
}) {
  const colors = useColors()
  const window = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const width = Math.min(260, window.width - 32)
  const left = Math.max(16, Math.min(anchor.x, window.width - width - 16))
  const below = anchor.y + anchor.height + 6
  const spaceBelow = window.height - insets.bottom - below - 16
  const openUp = spaceBelow < 200 && anchor.y - insets.top > spaceBelow
  const maxHeight = openUp ? anchor.y - insets.top - 22 : spaceBelow
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable accessible={false} style={StyleSheet.absoluteFill} onPress={onClose} />
      <View accessibilityViewIsModal accessibilityLabel={label} onAccessibilityEscape={onClose}
        style={[styles.menu, {
          left, width, maxHeight, backgroundColor: colors.card, borderColor: colors.separator,
          ...(openUp ? { bottom: window.height - anchor.y + 6 } : { top: below }),
        }]}>
        <Text style={[type.footnote, styles.menuLabel, { color: colors.secondary }]}>{label}</Text>
        <ScrollView bounces={false}>
          {items.map((item) => (
            <Pressable key={item.key} accessibilityRole="menuitem" accessibilityLabel={item.title} accessibilityState={{ selected: !!item.checked }}
              onPress={() => { onClose(); item.onPress() }}
              style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: colors.fill }]}>
              <Text numberOfLines={2} style={[type.body, styles.flex, { color: item.destructive ? colors.red : colors.ink, fontWeight: item.checked ? '600' : '400' }]}>
                {item.title}
              </Text>
              {item.checked && <Icon name="check" size={16} color={colors.accent} />}
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  )
}

// --- Basics ---

export function Button({ title, onPress, kind = 'primary', busy, disabled, icon }: {
  title: string; onPress(): void; kind?: 'primary' | 'secondary' | 'danger' | 'plain'; busy?: boolean; disabled?: boolean; icon?: IconName
}) {
  const colors = useColors()
  const bg = { primary: colors.accent, secondary: colors.card, danger: colors.redSoft, plain: 'transparent' }[kind]
  const fg = { primary: colors.onAccent, secondary: colors.accent, danger: colors.red, plain: colors.accent }[kind]
  const off = disabled || busy
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!off, busy: !!busy }} disabled={off} onPress={onPress}
      style={({ pressed }) => [styles.button, {
        backgroundColor: bg, borderColor: kind === 'secondary' ? colors.separator : bg, opacity: off ? 0.5 : pressed ? 0.75 : 1,
      }]}>
      {busy ? <ActivityIndicator color={fg} /> : (
        <>
          {icon && <Icon name={icon} size={16} color={fg} />}
          <Text style={[type.headline, { color: fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  )
}

export function Field({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  const colors = useColors()
  return (
    <View style={styles.field}>
      <Text style={[type.footnote, styles.fieldLabel, { color: colors.secondary }]}>{label}</Text>
      <TextInput placeholderTextColor={colors.tertiary} accessibilityLabel={label} {...props}
        style={[type.body, styles.input, { color: colors.ink, backgroundColor: colors.card, borderColor: colors.separator },
          props.multiline && styles.multiline]} />
      {hint && <Text style={[type.caption, { color: colors.secondary }]}>{hint}</Text>}
    </View>
  )
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const colors = useColors()
  return <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.separator }, style]}>{children}</View>
}

export function SectionTitle({ children, trailing }: { children: string; trailing?: ReactNode }) {
  const colors = useColors()
  return (
    <View style={styles.sectionTitle}>
      <Text accessibilityRole="header" style={[type.headline, { color: colors.ink }]}>{children}</Text>
      {trailing}
    </View>
  )
}

export function Banner({ text, tone = 'info' }: { text: string; tone?: 'info' | 'error' | 'success' }) {
  const colors = useColors()
  const [bg, fg] = { info: [colors.accentSoft, colors.accent], error: [colors.redSoft, colors.red], success: [colors.greenSoft, colors.green] }[tone]
  return (
    <View accessibilityRole={tone === 'error' ? 'alert' : undefined} style={[styles.banner, { backgroundColor: bg }]}>
      <Text style={[type.subheadline, { color: fg }]}>{text}</Text>
    </View>
  )
}

/** "Updated 14:05" or the last fetch error, so people know whether what they see is current. */
export function SyncStatus({ updatedAt, error }: { updatedAt?: Date; error?: string }) {
  const colors = useColors()
  if (error) return <Banner tone="error" text={updatedAt ? `Offline — showing data from ${clock(updatedAt)}. ${error}` : error} />
  if (!updatedAt) return <ActivityIndicator style={styles.loading} color={colors.secondary} />
  return <Text style={[type.caption, styles.sync, { color: colors.tertiary }]}>Updated {clock(updatedAt)} · refreshes automatically</Text>
}

const clock = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  const colors = useColors()
  return (
    <View style={styles.empty}>
      <Text style={[type.headline, { color: colors.ink, textAlign: 'center' }]}>{title}</Text>
      {body && <Text style={[type.subheadline, { color: colors.secondary, textAlign: 'center' }]}>{body}</Text>}
      {action}
    </View>
  )
}

const STATUS: Record<RequestStatus, { label: string; tone: 'amber' | 'green' | 'red' | 'gray' }> = {
  pending: { label: 'Waiting for owner', tone: 'amber' },
  accepted: { label: 'Accepted', tone: 'green' },
  declined: { label: 'Declined', tone: 'red' },
  cancelled: { label: 'Cancelled', tone: 'gray' },
}

export function Badge({ label, tone }: { label: string; tone: 'amber' | 'green' | 'red' | 'gray' | 'blue' }) {
  const colors = useColors()
  const [bg, fg] = {
    amber: [colors.amberSoft, colors.amber], green: [colors.greenSoft, colors.green], red: [colors.redSoft, colors.red],
    gray: [colors.fill, colors.secondary], blue: [colors.accentSoft, colors.accent],
  }[tone]
  return <View style={[styles.badge, { backgroundColor: bg }]}><Text style={[type.caption, { color: fg, fontWeight: '600' }]}>{label}</Text></View>
}

export function StatusBadge({ status, role }: { status: RequestStatus; role: 'renter' | 'owner' }) {
  const s = STATUS[status]
  return <Badge label={status === 'pending' && role === 'owner' ? 'Needs your reply' : s.label} tone={s.tone} />
}

export const providerLabel = (o: Listing['owner']) => (o.accountType === 'business' ? o.businessName ?? o.name : o.name)

export function ListingCard({ listing, onPress }: { listing: Listing; onPress(): void }) {
  const colors = useColors()
  const photo = imageUrl(listing.photos[0]?.url)
  const title = `${listing.make} ${listing.model} ${listing.year}`
  return (
    <Pressable accessibilityRole="button" onPress={onPress}
      accessibilityLabel={`${title}, ${formatEgp(listing.dailyRateEgp)} per day, pickup in ${listing.district}`}
      style={({ pressed }) => [styles.listing, { backgroundColor: colors.card, borderColor: colors.separator, opacity: pressed ? 0.85 : 1 }]}>
      <View style={[styles.photo, { backgroundColor: colors.fill }]}>
        {photo ? <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <Icon name="car" size={40} color={colors.tertiary} />}
        {listing.isSample && <View style={styles.sampleTag}><Badge label="Sample listing" tone="gray" /></View>}
      </View>
      <View style={styles.listingBody}>
        <View style={styles.row}>
          <Text numberOfLines={1} style={[type.headline, styles.flex, { color: colors.ink }]}>{title}</Text>
          <Text style={[type.price, { color: colors.ink }]}>{formatEgp(listing.dailyRateEgp)}<Text style={[type.footnote, { color: colors.secondary, fontWeight: '400' }]}> /day</Text></Text>
        </View>
        <View style={styles.meta}>
          <Icon name="pin" size={13} />
          <Text style={[type.subheadline, { color: colors.secondary }]}>{listing.district}</Text>
          <Text style={[type.subheadline, { color: colors.tertiary }]}>·</Text>
          <Text style={[type.subheadline, { color: colors.secondary }]}>
            {TRANSMISSION_LABEL[listing.transmission]} · {VEHICLE_TYPE_LABEL[listing.vehicleType]} · {listing.seats} seats
          </Text>
        </View>
        <View style={styles.meta}>
          <Icon name={listing.owner.accountType === 'business' ? 'business' : 'person'} size={12} />
          <Text numberOfLines={1} style={[type.footnote, { color: colors.secondary }]}>
            {listing.owner.accountType === 'business' ? 'Rental business' : 'Private owner'} · {providerLabel(listing.owner)}
          </Text>
        </View>
      </View>
    </Pressable>
  )
}

export function RequestRow({ request, onPress }: { request: RentalRequest; onPress(): void }) {
  const colors = useColors()
  const photo = imageUrl(request.listing.photoUrl)
  const who = request.role === 'owner' ? request.renter.name : request.listing.district
  return (
    <Pressable accessibilityRole="button" onPress={onPress}
      style={({ pressed }) => [styles.requestRow, { backgroundColor: colors.card, borderColor: colors.separator, opacity: pressed ? 0.85 : 1 }]}>
      <View style={[styles.thumb, { backgroundColor: colors.fill }]}>
        {photo && <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} />}
      </View>
      <View style={[styles.flex, { gap: 3 }]}>
        <Text numberOfLines={1} style={[type.headline, { color: colors.ink }]}>{request.listing.title}</Text>
        <Text style={[type.subheadline, { color: colors.secondary }]}>{formatDate(request.startDate)} → {formatDate(request.endDate)} · {who}</Text>
        <View style={styles.row}>
          <StatusBadge status={request.status} role={request.role} />
          <Text style={[type.subheadline, { color: colors.ink, fontWeight: '600' }]}>{formatEgp(request.totalEgp)}</Text>
        </View>
      </View>
    </Pressable>
  )
}

export const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 34, paddingHorizontal: 13, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, maxWidth: 220 },
  pillText: { fontWeight: '600', flexShrink: 1 },
  menu: { position: 'absolute', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', paddingBottom: 6, elevation: 8, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 18, shadowOffset: { width: 0, height: 6 } },
  menuLabel: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingHorizontal: 16, paddingVertical: 8 },
  button: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', minHeight: 50, paddingHorizontal: 18, borderRadius: 14, borderWidth: 1 },
  field: { gap: 6 },
  fieldLabel: { fontWeight: '600' },
  input: { minHeight: 48, paddingHorizontal: 14, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  multiline: { minHeight: 96, paddingTop: 12, textAlignVertical: 'top' },
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 10 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  banner: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  sync: { textAlign: 'center' },
  loading: { marginVertical: 24 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 40, paddingHorizontal: 24 },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  listing: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  photo: { aspectRatio: 16 / 10, alignItems: 'center', justifyContent: 'center' },
  sampleTag: { position: 'absolute', top: 10, left: 10 },
  listingBody: { padding: 14, gap: 6 },
  requestRow: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center' },
  thumb: { width: 72, height: 72, borderRadius: 12, overflow: 'hidden' },
  screen: { padding: 16, gap: 14, paddingBottom: 40 },
})

export function SignInPrompt({ title, body, onPress }: { title: string; body: string; onPress(): void }) {
  return <Empty title={title} body={body} action={<Button title="Sign in or create account" onPress={onPress} />} />
}
