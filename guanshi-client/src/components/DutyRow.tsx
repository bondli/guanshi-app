import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Check, ChevronRight } from 'lucide-react-native'
import type { Duty } from '@/src/lib/types'
import { usePalette } from '@/src/theme/tokens'

export function DutyRow({
  duty,
  onOpen,
  onToggle,
}: {
  duty: Duty
  onOpen?: () => void
  onToggle?: () => void
}) {
  const p = usePalette()
  const done = duty.status === 'done'
  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 11,
        paddingHorizontal: 14,
        paddingVertical: 13,
        backgroundColor: pressed ? p.surface2 : 'transparent',
      })}
    >
      <Pressable
        onPress={onToggle}
        hitSlop={8}
        style={{
          width: 21,
          height: 21,
          borderRadius: 999,
          borderWidth: 1.5,
          borderColor: done ? p.brand : p.borderStrong,
          backgroundColor: done ? p.brand : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Check size={12} color={done ? '#fff' : 'transparent'} strokeWidth={3} />
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{
            fontSize: 13.5,
            fontWeight: '500',
            lineHeight: 20,
            color: done ? p.muted2 : p.fg,
            textDecorationLine: done ? 'line-through' : 'none',
          }}
        >
          {duty.title}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
          <Text style={{ fontSize: 10.5, fontWeight: '600', color: done ? p.muted2 : p.fg }}>
            {duty.timeLabel}
          </Text>
          <Dot />
          <Text style={{ fontSize: 10.5, color: p.muted }}>{duty.type}</Text>
          <Dot />
          <Text style={{ fontSize: 10.5, color: p.muted }}>{duty.source}</Text>
        </View>
      </View>
      <ChevronRight size={15} color={p.muted2} />
    </Pressable>
  )
}

function Dot() {
  const p = usePalette()
  return <View style={{ width: 2, height: 2, borderRadius: 2, backgroundColor: p.muted2 }} />
}

export function DutyList({
  duties,
  onOpen,
  onToggle,
}: {
  duties: Duty[]
  onOpen?: (duty: Duty) => void
  onToggle?: (duty: Duty) => void
}) {
  const p = usePalette()
  return (
    <View
      style={{
        backgroundColor: p.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: p.border,
        borderRadius: 18,
        overflow: 'hidden',
        shadowColor: '#18181b',
        shadowOpacity: 0.05,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
      }}
    >
      {duties.map((duty, index) => (
        <View
          key={duty.id}
          style={{
            borderBottomWidth: index === duties.length - 1 ? 0 : StyleSheet.hairlineWidth,
            borderBottomColor: p.border,
          }}
        >
          <DutyRow duty={duty} onOpen={() => onOpen?.(duty)} onToggle={() => onToggle?.(duty)} />
        </View>
      ))}
    </View>
  )
}
