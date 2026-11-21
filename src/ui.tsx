import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect'
import { Link } from 'expo-router'
import { SymbolView } from 'expo-symbols'
import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react'
import {
  AccessibilityInfo, ActivityIndicator, Animated, Easing, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions,
  type StyleProp, type TextInputProps, type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { imageUrl, type Listing, type RentalRequest } from './api'
import { TRANSMISSION_LABEL, VEHICLE_TYPE_LABEL, formatDate, formatEgp, type RequestStatus } from './domain/rental'
import { useReduceMotion, useReduceTransparency } from './a11y'
import { placeMenu, type Rect } from './menuPlacement'
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
  account: { ios: 'person.crop.circle', android: 'account_circle' },
  search: { ios: 'magnifyingglass', android: 'search' },
  back: { ios: 'chevron.left', android: 'arrow_back' },
  expand: { ios: 'arrow.up.left.and.arrow.down.right', android: 'open_in_full' },
  key: { ios: 'key.fill', android: 'key' },
} as const
export type IconName = keyof typeof ICONS

export function Icon({ name, size = 16, color }: { name: IconName; size?: number; color?: string }) {
  const colors = useColors()
  return <SymbolView name={ICONS[name]} size={size} tintColor={color ?? colors.secondary} resizeMode="scaleAspectFit"
    style={{ width: size, height: size }} />
}

// --- Glass: Liquid Glass on iOS 26, a solid surface elsewhere or with Reduce Transparency. ---

const supportsGlass = isLiquidGlassAvailable()

export function useGlass() {
  return supportsGlass && !useReduceTransparency()
}

export function GlassCapsule({ children, style, interactive, dark }: {
  children: ReactNode; style?: StyleProp<ViewStyle>; interactive?: boolean; dark?: boolean
}) {
  const colors = useColors()
  if (useGlass()) {
    return <GlassView isInteractive={interactive} glassEffectStyle="regular" colorScheme={dark ? 'dark' : 'auto'} style={[styles.capsule, style]}>{children}</GlassView>
  }
  const fallback = dark ? { backgroundColor: 'rgba(0,0,0,0.6)' } : { backgroundColor: colors.scrim, borderColor: colors.separator, borderWidth: StyleSheet.hairlineWidth }
  return <View style={[styles.capsule, fallback, style]}>{children}</View>
}

/** Round glass button for chrome laid over photos. */
export function GlassButton({ icon, label, onPress, dark }: { icon: IconName; label: string; onPress(): void; dark?: boolean }) {
  const colors = useColors()
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={6} onPress={onPress}
      style={({ pressed }) => pressed && { opacity: 0.7 }}>
      <GlassCapsule interactive dark={dark} style={styles.glassButton}><Icon name={icon} size={17} color={dark ? '#FFFFFF' : colors.ink} /></GlassCapsule>
    </Pressable>
  )
}

// --- Menu pill: compact glass capsule showing the current choice; opens a menu over it that ticks the choice. ---

export type PillOption<T extends string> = { value: T; title: string }

export function MenuPill<T extends string>({ label, value, options, onSelect, highlight }: {
  label: string; value: T; options: readonly PillOption<T>[]; onSelect(value: T): void; highlight?: boolean
}) {
  const colors = useColors()
  const trigger = useRef<ComponentRef<typeof View>>(null)
  const opened = useRef(0)
  const [menu, setMenu] = useState<{ id: number; anchor: Rect }>()
  const title = options.find((o) => o.value === value)?.title ?? label
  const open = () => trigger.current?.measureInWindow((x, y, width, height) => setMenu({ id: ++opened.current, anchor: { x, y, width, height } }))
  return (
    <>
      <Pressable ref={trigger} accessibilityRole="button" accessibilityLabel={`${label}, ${title}`}
        accessibilityState={{ expanded: !!menu }} hitSlop={4} onPress={open}
        style={({ pressed }) => [styles.pillHost, pressed && { opacity: 0.7 }, menu && { opacity: 0 }]}>
        {highlight ? (
          // An active filter is a solid ink capsule, so it reads as set at a glance.
          <View style={[styles.capsule, styles.pill, { backgroundColor: colors.ink }]}>
            <Text numberOfLines={1} style={[type.subheadline, styles.pillText, { color: colors.background }]}>{title}</Text>
            <Icon name="chevronDown" size={11} color={colors.background} />
          </View>
        ) : (
          <GlassCapsule interactive style={styles.pill}>
            <Text numberOfLines={1} style={[type.subheadline, styles.pillText, { color: colors.ink }]}>{title}</Text>
            <Icon name="chevronDown" size={11} color={colors.secondary} />
          </GlassCapsule>
        )}
      </Pressable>
      {menu && (
        <AnchoredMenu key={menu.id} anchor={menu.anchor} label={label}
          onClosed={(action) => { if (menu.id === opened.current) setMenu(undefined); action?.() }}
          items={options.map((o) => ({ key: o.value, title: o.title, checked: o.value === value, onPress: () => onSelect(o.value) }))} />
      )}
    </>
  )
}

type MenuItem = { key: string; title: string; checked?: boolean; destructive?: boolean; onPress(): void }

/** Opens over its pill and grows from it (a fade with Reduce Motion), as the iOS menu does. */
function AnchoredMenu({ anchor, label, items, onClosed }: {
  anchor: Rect; label: string; items: MenuItem[]; onClosed(action?: () => void): void
}) {
  const colors = useColors()
  const window = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const glass = useGlass()
  const reduceMotion = useReduceMotion()
  const selected = useRef<ComponentRef<typeof View>>(null)
  const progress = useRef(new Animated.Value(0)).current
  const done = useRef(false)
  const place = placeMenu(anchor, window, insets.top, window.height - insets.bottom)
  const run = (toValue: number, then?: () => void) =>
    Animated.timing(progress, { toValue, duration: toValue ? 240 : 160, easing: Easing.out(Easing.cubic), useNativeDriver: true })
      .start(() => then?.())
  useEffect(() => { run(1) }, []) // Grow once on mount.
  const dismiss = (action?: () => void) => {
    if (done.current) return
    done.current = true
    run(0, () => onClosed(action))
  }
  const origin = 'top' in place ? 'top left' : 'bottom left'
  const scale = reduceMotion ? 1 : progress.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] })
  return (
    <Modal transparent visible animationType="none" onRequestClose={() => dismiss()} statusBarTranslucent
      onShow={() => { if (selected.current) AccessibilityInfo.sendAccessibilityEvent(selected.current, 'focus') }}>
      <Pressable accessible={false} style={StyleSheet.absoluteFill} onPress={() => dismiss()} />
      <Animated.View accessibilityViewIsModal accessibilityLabel={label} onAccessibilityEscape={() => dismiss()}
        style={[styles.menu, place, { opacity: progress, transformOrigin: origin, transform: [{ scale }] },
          !glass && { backgroundColor: colors.card, borderColor: colors.separator, borderWidth: StyleSheet.hairlineWidth }]}>
        {glass && <GlassView glassEffectStyle="regular" style={[StyleSheet.absoluteFill, styles.menuFace]} />}
        <ScrollView bounces={false} style={styles.menuScroll} contentContainerStyle={styles.menuList}>
          {items.map((item) => (
            <Pressable key={item.key} ref={item.checked ? selected : undefined} accessibilityRole="menuitem" accessibilityLabel={item.title}
              accessibilityState={{ selected: !!item.checked }} onPress={() => dismiss(item.onPress)}
              style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: colors.fill }]}>
              <Text numberOfLines={2} style={[type.body, styles.flex, { color: item.destructive ? colors.red : colors.ink }]}>{item.title}</Text>
              {item.checked && <Icon name="check" size={16} color={colors.ink} />}
            </Pressable>
          ))}
        </ScrollView>
      </Animated.View>
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
  const [bg, fg] = { info: [colors.fill, colors.ink], error: [colors.redSoft, colors.red], success: [colors.greenSoft, colors.green] }[tone]
  return (
    <View accessibilityRole={tone === 'error' ? 'alert' : undefined} style={[styles.banner, { backgroundColor: bg }]}>
      <Text style={[type.subheadline, { color: fg }]}>{text}</Text>
    </View>
  )
}

/** "Updated 14:05" or the last fetch error, so people know whether what they see is current. */
export function SyncStatus({ updatedAt, error }: { updatedAt?: Date; error?: string }) {
  const colors = useColors()
  if (error) return <Banner tone="error" text={updatedAt ? `Offline since ${clock(updatedAt)}. ${error}` : error} />
  if (!updatedAt) return <ActivityIndicator style={styles.loading} color={colors.secondary} />
  return <Text style={[type.caption, styles.sync, { color: colors.tertiary }]}>Updated {clock(updatedAt)}</Text>
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
    gray: [colors.fill, colors.secondary], blue: [colors.fill, colors.ink],
  }[tone]
  return <View style={[styles.badge, { backgroundColor: bg }]}><Text style={[type.caption, { color: fg, fontWeight: '600' }]}>{label}</Text></View>
}

export function StatusBadge({ status, role }: { status: RequestStatus; role: 'renter' | 'owner' }) {
  const s = STATUS[status]
  return <Badge label={status === 'pending' && role === 'owner' ? 'Needs your reply' : s.label} tone={s.tone} />
}

export const providerLabel = (o: Listing['owner']) => (o.accountType === 'business' ? o.businessName ?? o.name : o.name)

/** Business owners show their business name; the icon beside it says which kind of owner it is. */
export function OwnerLine({ owner, size = 13 }: { owner: Listing['owner']; size?: number }) {
  const colors = useColors()
  const business = owner.accountType === 'business'
  return (
    <View style={styles.meta} accessible accessibilityLabel={`${business ? 'Rental business' : 'Owner'}: ${providerLabel(owner)}`}>
      <Icon name={business ? 'business' : 'person'} size={size - 1} />
      <Text numberOfLines={1} style={[size > 13 ? type.callout : type.footnote, { color: colors.secondary, flexShrink: 1 }]}>{providerLabel(owner)}</Text>
    </View>
  )
}

export const specLine = (l: Pick<Listing, 'transmission' | 'vehicleType' | 'seats'>) =>
  `${TRANSMISSION_LABEL[l.transmission]} · ${VEHICLE_TYPE_LABEL[l.vehicleType]} · ${l.seats} seats`

export function ListingCard({ listing }: { listing: Listing }) {
  const colors = useColors()
  const reduceMotion = useReduceMotion()
  const photo = imageUrl(listing.photos[0]?.url)
  const title = `${listing.make} ${listing.model} ${listing.year}`
  const image = (
    <View style={StyleSheet.flatten([styles.photo, { backgroundColor: colors.fill }])}>
      {photo ? <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <Icon name="car" size={40} color={colors.tertiary} />}
    </View>
  )
  return (
    <Link href={`/listing/${listing.id}`} asChild>
      <Pressable accessibilityRole="button"
        accessibilityLabel={`${listing.featured ? 'Featured, ' : ''}${title}, ${formatEgp(listing.dailyRateEgp)} per day, pickup in ${listing.district}`}
        style={({ pressed }) => [styles.listing, { backgroundColor: colors.card, borderColor: colors.separator, opacity: pressed ? 0.85 : 1 }]}>
        <View>
          {/* iOS 18+ zooms the photo into the listing's hero; elsewhere this is a normal push. */}
          {reduceMotion ? image : <Link.AppleZoom>{image}</Link.AppleZoom>}
          {listing.featured && <GlassCapsule style={styles.overlayTag}><Text style={[type.caption, styles.overlayText, { color: colors.ink }]}>Featured</Text></GlassCapsule>}
          {listing.photos.length > 1 && (
            <GlassCapsule style={[styles.overlayTag, styles.overlayRight]}>
              <Text style={[type.caption, styles.overlayText, { color: colors.ink }]}>{listing.photos.length} photos</Text>
            </GlassCapsule>
          )}
        </View>
        <View style={styles.listingBody}>
          <View style={styles.row}>
            <Text numberOfLines={1} style={[type.headline, styles.flex, { color: colors.ink }]}>{title}</Text>
            <Text style={[type.price, { color: colors.ink }]}>{formatEgp(listing.dailyRateEgp)}<Text style={[type.footnote, { color: colors.secondary, fontWeight: '400' }]}> /day</Text></Text>
          </View>
          <View style={styles.meta}>
            <Icon name="pin" size={13} />
            <Text style={[type.subheadline, { color: colors.ink }]}>{listing.district}</Text>
          </View>
          <Text style={[type.subheadline, { color: colors.secondary }]}>{specLine(listing)}</Text>
          <OwnerLine owner={listing.owner} />
        </View>
      </Pressable>
    </Link>
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
  capsule: { borderRadius: 999, overflow: 'hidden' },
  glassButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  pillHost: { alignSelf: 'flex-start', maxWidth: 220 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 34, paddingHorizontal: 13 },
  pillText: { fontWeight: '600', flexShrink: 1 },
  menu: { position: 'absolute', borderRadius: 20, overflow: 'hidden', elevation: 8, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 18, shadowOffset: { width: 0, height: 6 } },
  menuFace: { borderRadius: 20 },
  menuScroll: { flexShrink: 1 },
  menuList: { paddingVertical: 6 },
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
  overlayTag: { position: 'absolute', top: 10, left: 10, paddingHorizontal: 10, paddingVertical: 4 },
  overlayRight: { left: undefined, right: 10 },
  overlayText: { fontWeight: '600' },
  listingBody: { padding: 14, gap: 6 },
  requestRow: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center' },
  thumb: { width: 72, height: 72, borderRadius: 12, overflow: 'hidden' },
  screen: { padding: 16, gap: 14, paddingBottom: 40 },
  headerButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
})

/** Header options shared by the Browse and Trips stacks: large title, Account at the top right. */
export const tabStackOptions = (colors: ReturnType<typeof useColors>) => ({
  headerLargeTitle: true, headerLargeTitleShadowVisible: false, headerShadowVisible: false, headerTintColor: colors.ink,
  headerStyle: { backgroundColor: colors.background }, headerLargeStyle: { backgroundColor: colors.background },
  headerTitleStyle: { color: colors.ink }, headerLargeTitleStyle: { color: colors.ink }, contentStyle: { backgroundColor: colors.background },
  headerRight: () => <AccountButton />,
})

function AccountButton() {
  const colors = useColors()
  return (
    <Link href="/account" asChild>
      <Pressable accessibilityRole="button" accessibilityLabel="Account" hitSlop={8} style={styles.headerButton}>
        <Icon name="account" size={24} color={colors.ink} />
      </Pressable>
    </Link>
  )
}

export function SignInPrompt({ title, body, onPress }: { title: string; body?: string; onPress(): void }) {
  return <Empty title={title} body={body} action={<Button title="Sign in or create account" onPress={onPress} />} />
}
