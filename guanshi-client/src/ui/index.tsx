import React from 'react'
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { X } from 'lucide-react-native'
import { useApp } from '@/src/lib/store'
import { font, radius, shadow, usePalette, type Palette } from '@/src/theme/tokens'

export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const p = usePalette()
  return <View style={[{ flex: 1, backgroundColor: p.bg }, style]}>{children}</View>
}

export function BrandMark({ size = 38 }: { size?: number }) {
  return (
    <Image
      source={require('../../assets/icon.png')}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        shadowColor: '#c9522a',
        shadowOpacity: 0.5,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
      }}
    />
  )
}

export function PageHeader({
  title,
  subtitle,
  brand,
  dateText,
  right,
}: {
  title?: string
  subtitle?: string
  brand?: boolean
  dateText?: string
  right?: React.ReactNode
}) {
  const p = usePalette()
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.header, { backgroundColor: p.bg, paddingTop: insets.top + 10 }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        {brand ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <BrandMark />
            {dateText ? (
              <Text style={{ fontSize: 11.5, fontWeight: '600', letterSpacing: 1, color: p.muted }}>
                {dateText}
              </Text>
            ) : null}
          </View>
        ) : (
          <>
            <Text style={{ fontSize: 25, fontWeight: '600', color: p.fg }}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={{ marginTop: 5, fontSize: 12, color: p.muted }}>{subtitle}</Text>
            ) : null}
          </>
        )}
      </View>
      {right ? <View style={{ flexDirection: 'row', gap: 8 }}>{right}</View> : null}
    </View>
  )
}

export function IconButton({
  icon,
  onPress,
  plain,
  label,
}: {
  icon: React.ReactNode
  onPress?: () => void
  plain?: boolean
  label?: string
}) {
  const p = usePalette()
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        {
          backgroundColor: plain ? 'transparent' : p.surface,
          borderColor: plain ? 'transparent' : p.border,
          opacity: pressed ? 0.7 : 1,
          transform: [{ scale: pressed ? 0.95 : 1 }],
        },
        plain ? null : shadow.card,
      ]}
    >
      {icon}
    </Pressable>
  )
}

export function Card({
  children,
  style,
  padded = true,
}: {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  padded?: boolean
}) {
  const p = usePalette()
  return (
    <View
      style={[
        {
          backgroundColor: p.surface,
          borderColor: p.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: radius.lg,
          padding: padded ? 14 : 0,
        },
        shadow.card,
        style,
      ]}
    >
      {children}
    </View>
  )
}

type Tone = 'plain' | 'brand' | 'ok' | 'warn' | 'danger'

export function Badge({ tone = 'plain', children }: { tone?: Tone; children: React.ReactNode }) {
  const p = usePalette()
  const map = {
    plain: { bg: p.surface2, fg: p.muted, border: p.border },
    brand: { bg: p.brandSoft, fg: p.brand, border: 'transparent' },
    ok: { bg: p.okSoft, fg: p.ok, border: 'transparent' },
    warn: { bg: p.warnSoft, fg: p.warn, border: 'transparent' },
    danger: { bg: p.dangerSoft, fg: p.danger, border: 'transparent' },
  }[tone]
  return (
    <View
      style={{
        backgroundColor: map.bg,
        borderColor: map.border,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: radius.pill,
        paddingHorizontal: 8,
        paddingVertical: 3,
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ fontSize: 10, fontWeight: '600', color: map.fg }}>{children}</Text>
    </View>
  )
}

export function Button({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  style,
  loading,
}: {
  children: React.ReactNode
  onPress?: () => void
  variant?: 'primary' | 'outline' | 'ghost' | 'danger'
  size?: 'md' | 'sm'
  disabled?: boolean
  style?: StyleProp<ViewStyle>
  loading?: boolean
}) {
  const p = usePalette()
  const bg =
    variant === 'primary' ? p.brand : variant === 'danger' ? p.danger : variant === 'outline' ? p.surface : 'transparent'
  const fg =
    variant === 'primary' ? p.onBrand : variant === 'danger' ? '#fff' : variant === 'ghost' ? p.muted : p.fg
  return (
    <Pressable
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        {
          height: size === 'sm' ? 34 : 42,
          paddingHorizontal: size === 'sm' ? 12 : 16,
          borderRadius: size === 'sm' ? 10 : radius.base,
          backgroundColor: bg,
          borderWidth: variant === 'outline' ? StyleSheet.hairlineWidth : 0,
          borderColor: p.borderStrong,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 6,
          opacity: disabled ? 0.5 : pressed ? 0.82 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={fg} /> : null}
      {React.Children.map(children, (child) =>
        typeof child === 'string' || typeof child === 'number' ? (
          <Text style={{ fontSize: size === 'sm' ? 12 : 14, fontWeight: '600', color: fg }}>{child}</Text>
        ) : (
          child
        ),
      )}
    </Pressable>
  )
}

export function SectionHead({
  title,
  count,
  action,
  onPress,
}: {
  title: string
  count?: string
  action?: string
  onPress?: () => void
}) {
  const p = usePalette()
  return (
    <View style={styles.sectionHead}>
      <Text style={{ fontSize: 14, fontWeight: '600', color: p.fg }}>{title}</Text>
      {count ? <Text style={{ fontSize: 11, color: p.muted }}>{count}</Text> : null}
      {action ? (
        <Pressable onPress={onPress} hitSlop={8}>
          <Text style={{ fontSize: 12, color: p.muted }}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  const p = usePalette()
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        height: 30,
        paddingHorizontal: 12,
        borderRadius: radius.pill,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: active ? p.fg : p.border,
        backgroundColor: active ? p.fg : p.surface,
        justifyContent: 'center',
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Text style={{ fontSize: 11.5, fontWeight: active ? '600' : '400', color: active ? p.bg : p.muted }}>
        {label}
      </Text>
    </Pressable>
  )
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 7, paddingVertical: 4, paddingRight: 8 }}
      style={{ marginBottom: 10, flexGrow: 0 }}
    >
      {children}
    </ScrollView>
  )
}

export function Seg<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  const p = usePalette()
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: p.seg,
        borderRadius: 11,
        padding: 3,
        gap: 3,
        marginBottom: 12,
      }}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={{
              flex: 1,
              height: 30,
              borderRadius: 8,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: active ? p.surface : 'transparent',
              ...(active ? shadow.card : {}),
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '600', color: active ? p.fg : p.muted }}>
              {option.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

export function Toggle({ value, onChange }: { value: boolean; onChange: (next: boolean) => void }) {
  const p = usePalette()
  return (
    <Pressable
      onPress={() => onChange(!value)}
      style={{
        width: 44,
        height: 26,
        borderRadius: 13,
        backgroundColor: value ? p.brand : p.borderStrong,
        padding: 3,
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: '#fff',
          alignSelf: value ? 'flex-end' : 'flex-start',
          shadowColor: '#000',
          shadowOpacity: 0.15,
          shadowRadius: 2,
          shadowOffset: { width: 0, height: 1 },
          elevation: 2,
        }}
      />
    </Pressable>
  )
}

export function Row({
  icon,
  title,
  desc,
  right,
  onPress,
  tone,
  last,
}: {
  icon?: React.ReactNode
  title: string
  desc?: string
  right?: React.ReactNode
  onPress?: () => void
  tone?: 'brand'
  last?: boolean
}) {
  const p = usePalette()
  const rowStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
    borderBottomColor: p.border,
  }
  const body = (
    <>
      {icon ? (
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: tone === 'brand' ? p.brandSoft : p.surface2,
            borderWidth: tone === 'brand' ? 0 : StyleSheet.hairlineWidth,
            borderColor: p.border,
          }}
        >
          {icon}
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 13.5, fontWeight: '500', color: p.fg }}>{title}</Text>
        {desc ? (
          <Text style={{ marginTop: 2, fontSize: 10.5, color: p.muted, lineHeight: 15 }}>{desc}</Text>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>{right}</View>
    </>
  )
  if (!onPress) return <View style={rowStyle}>{body}</View>
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: p.border }}
      style={({ pressed }) => [rowStyle, { backgroundColor: pressed ? p.surface2 : 'transparent' }]}
    >
      {body}
    </Pressable>
  )
}

export function ListCard({ children }: { children: React.ReactNode }) {
  return (
    <Card padded={false} style={{ overflow: 'hidden' }}>
      {children}
    </Card>
  )
}

export function Empty({ title, desc }: { title: string; desc?: string }) {
  const p = usePalette()
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 32, gap: 8 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: p.fg }}>{title}</Text>
      {desc ? (
        <Text style={{ fontSize: 11, color: p.muted, textAlign: 'center', lineHeight: 17 }}>{desc}</Text>
      ) : null}
    </View>
  )
}

export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  const p = usePalette()
  const insets = useSafeAreaInsets()
  const anim = React.useRef(new Animated.Value(0)).current

  React.useEffect(() => {
    if (!visible) {
      anim.setValue(0)
      return
    }
    Animated.timing(anim, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [visible, anim])

  const panelStyle = {
    transform: [
      {
        translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [48, 0] }),
      },
    ],
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: p.overlay, opacity: anim }]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>
        <Animated.View
          style={[
            {
              backgroundColor: p.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingHorizontal: 18,
              paddingTop: 16,
              paddingBottom: Math.max(18, insets.bottom + 10),
              maxHeight: '88%',
            },
            shadow.sheet,
            panelStyle,
          ]}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <View style={{ width: 36 }} />
            <Text style={{ fontSize: 14, fontWeight: '600', color: p.fg }}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={18} color={p.muted} />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 8 }}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  )
}

export function FormInput({
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  autoCapitalize = 'none',
  multiline,
  keyboardType,
}: {
  value: string
  onChangeText: (text: string) => void
  placeholder?: string
  secureTextEntry?: boolean
  autoCapitalize?: 'none' | 'sentences'
  multiline?: boolean
  keyboardType?: 'default' | 'url'
}) {
  const p = usePalette()
  return (
    <View
      style={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: p.borderStrong,
        backgroundColor: p.surface2,
        borderRadius: radius.base,
        paddingHorizontal: 12,
        paddingVertical: multiline ? 10 : 0,
        minHeight: multiline ? 84 : 44,
      }}
    >
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={p.muted2}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        multiline={multiline}
        keyboardType={keyboardType}
        style={{
          color: p.fg,
          fontSize: 13,
          paddingVertical: multiline ? 0 : 12,
          minHeight: multiline ? 64 : undefined,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
    </View>
  )
}

export function Muted({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const p = usePalette()
  return <Text style={[{ fontSize: 11.5, color: p.muted, lineHeight: 18 }, style]}>{children}</Text>
}

export function ConfirmDialog() {
  const p = usePalette()
  const dialog = useApp((s) => s.dialog)
  const resolveDialog = useApp((s) => s.resolveDialog)

  return (
    <Modal visible={!!dialog} transparent animationType="fade" statusBarTranslucent onRequestClose={() => resolveDialog(false)}>
      <View style={{ flex: 1, backgroundColor: p.overlay, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <View
          style={{
            width: '100%',
            maxWidth: 320,
            backgroundColor: p.surface,
            borderRadius: 18,
            paddingTop: 20,
            paddingHorizontal: 20,
            paddingBottom: 14,
            ...shadow.sheet,
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '600', color: p.fg, textAlign: 'center' }}>
            {dialog?.title || ''}
          </Text>
          {dialog?.message ? (
            <Text
              style={{
                marginTop: 8,
                fontSize: 12.5,
                lineHeight: 19,
                color: p.muted,
                textAlign: 'center',
              }}
            >
              {dialog.message}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 18 }}>
            {dialog?.cancelText === null ? null : (
              <Pressable
                onPress={() => resolveDialog(false)}
                style={({ pressed }) => ({
                  flex: 1,
                  height: 40,
                  borderRadius: 11,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: p.borderStrong,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ fontSize: 13, fontWeight: '500', color: p.fg }}>
                  {dialog?.cancelText || '取消'}
                </Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => resolveDialog(true)}
              style={({ pressed }) => ({
                flex: 1,
                height: 40,
                borderRadius: 11,
                backgroundColor: p.brand,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.82 : 1,
              })}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: p.onBrand }}>
                {dialog?.confirmText || '确定'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

export function ToastView() {
  const toast = useApp((s) => s.toast)
  const p = usePalette()
  const insets = useSafeAreaInsets()
  if (!toast) return null
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 92, alignItems: 'center' }}>
      <View
        style={{
          backgroundColor: 'rgba(23,23,26,0.94)',
          paddingHorizontal: 14,
          paddingVertical: 9,
          borderRadius: 999,
          maxWidth: '86%',
        }}
      >
        <Text style={{ color: '#fff', fontSize: 12 }}>{toast}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingTop: 22,
    paddingBottom: 10,
    paddingHorizontal: 2,
  },
})
