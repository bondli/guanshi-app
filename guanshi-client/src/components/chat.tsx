import React from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import {
  CalendarCheck,
  Camera,
  Check,
  Clock,
  Mic,
  Send,
  Sparkles,
} from 'lucide-react-native'
import type { Duty, Message } from '@/src/lib/types'
import { usePalette } from '@/src/theme/tokens'
import { Badge, Button } from '@/src/ui'

export function MessageBubble({
  message,
  duty,
  todayDuties,
  highlight,
  onToggleDuty,
  onOpenDuty,
  onSnooze,
  onCompleteAll,
  onOpenToday,
}: {
  message: Message
  duty?: Duty
  todayDuties: Duty[]
  highlight?: boolean
  onToggleDuty: (duty: Duty) => void
  onOpenDuty: (duty: Duty) => void
  onSnooze: (duty: Duty) => void
  onCompleteAll: () => void
  onOpenToday: () => void
}) {
  const p = usePalette()
  if (message.role === 'me') {
    return (
      <View style={{ alignItems: 'flex-end', marginBottom: 12 }}>
        <View
          style={{
            maxWidth: '82%',
            backgroundColor: p.brand,
            paddingHorizontal: 13,
            paddingVertical: 9,
            borderRadius: 16,
            borderBottomRightRadius: 5,
          }}
        >
          <Text style={{ color: p.onBrand, fontSize: 13.5, lineHeight: 20 }}>{message.text}</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 10.5, color: p.muted, marginBottom: 5, marginLeft: 2 }}>管事</Text>
      <View
        style={{
          alignSelf: 'flex-start',
          maxWidth: '92%',
          backgroundColor: p.surface,
          borderWidth: highlight ? 1.5 : StyleSheet.hairlineWidth,
          borderColor: highlight ? p.brand : p.border,
          borderRadius: 16,
          borderBottomLeftRadius: 5,
          padding: 13,
          ...(highlight ? { shadowColor: p.brand, shadowOpacity: 0.25, shadowRadius: 10, elevation: 4 } : null),
        }}
      >
        {message.kind === 'briefing' ? (
          <BriefingCard
            text={message.text}
            duties={todayDuties}
            onToggleDuty={onToggleDuty}
            onCompleteAll={onCompleteAll}
            onOpenToday={onOpenToday}
          />
        ) : message.kind === 'review' ? (
          <ReviewCard
            text={message.text}
            duties={todayDuties}
            onSnooze={onSnooze}
            onOpenToday={onOpenToday}
          />
        ) : (
          <>
            <Text style={{ fontSize: 13.5, lineHeight: 21, color: p.fg }}>{message.text}</Text>
            {message.kind === 'duty' && duty ? (
              <DutyInline duty={duty} onOpen={onOpenDuty} onToggle={onToggleDuty} onSnooze={onSnooze} />
            ) : null}
          </>
        )}
      </View>
    </View>
  )
}

function DutyInline({
  duty,
  onOpen,
  onToggle,
  onSnooze,
}: {
  duty: Duty
  onOpen: (duty: Duty) => void
  onToggle: (duty: Duty) => void
  onSnooze: (duty: Duty) => void
}) {
  const p = usePalette()
  const done = duty.status === 'done'
  return (
    <View
      style={{
        marginTop: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: p.border,
        paddingTop: 10,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Sparkles size={14} color={p.brand} />
        <Text style={{ flex: 1, fontSize: 12.5, fontWeight: '600', color: p.fg }}>{duty.title}</Text>
        <Badge tone={done ? 'ok' : 'brand'}>{done ? '已完成' : '待办'}</Badge>
      </View>
      <Text style={{ marginTop: 4, fontSize: 10.5, color: p.muted, lineHeight: 16 }}>
        {duty.timeLabel} · 来源 {duty.source}
        {'\n'}
        {duty.rule}
      </Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        {done ? (
          <Button size="sm" variant="outline" onPress={() => onOpen(duty)}>
            看详情
          </Button>
        ) : (
          <>
            <Button size="sm" onPress={() => onToggle(duty)}>
              已完成
            </Button>
            <Button size="sm" variant="outline" onPress={() => onSnooze(duty)}>
              明天
            </Button>
            <Button size="sm" variant="ghost" onPress={() => onOpen(duty)}>
              详情
            </Button>
          </>
        )}
      </View>
    </View>
  )
}

function BriefingCard({
  text,
  duties,
  onToggleDuty,
  onCompleteAll,
  onOpenToday,
}: {
  text: string
  duties: Duty[]
  onToggleDuty: (duty: Duty) => void
  onCompleteAll: () => void
  onOpenToday: () => void
}) {
  const p = usePalette()
  const open = duties.filter((d) => d.status !== 'done')
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <CalendarCheck size={14} color={p.brand} />
        <Text style={{ fontSize: 12.5, fontWeight: '600', color: p.fg }}>{text.split('\n')[0]}</Text>
      </View>
      <View style={{ marginTop: 8 }}>
        {open.length ? (
          open.map((duty) => (
            <View
              key={duty.id}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}
            >
              <Pressable
                onPress={() => onToggleDuty(duty)}
                style={{
                  width: 18, height: 18, borderRadius: 9,
                  borderWidth: 1.5, borderColor: p.borderStrong,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Check size={10} color="transparent" />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: p.fg }} numberOfLines={1}>{duty.title}</Text>
                <Text style={{ fontSize: 10, color: p.muted, marginTop: 1 }}>{duty.timeLabel} · {duty.type}</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={{ fontSize: 12, color: p.muted, paddingVertical: 6 }}>今天都做完了。</Text>
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        <Button size="sm" onPress={onCompleteAll} disabled={!open.length}>
          全部完成
        </Button>
        <Button size="sm" variant="outline" onPress={onOpenToday}>
          看今日清单
        </Button>
      </View>
    </View>
  )
}

function ReviewCard({
  text,
  duties,
  onSnooze,
  onOpenToday,
}: {
  text: string
  duties: Duty[]
  onSnooze: (duty: Duty) => void
  onOpenToday: () => void
}) {
  const p = usePalette()
  const done = duties.filter((d) => d.status === 'done').length
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Clock size={14} color={p.brand} />
        <Text style={{ fontSize: 12.5, fontWeight: '600', color: p.fg }}>
          {text.split('\n')[0] || `今天完成 ${done} / ${duties.length}`}
        </Text>
      </View>
      <View style={{ marginTop: 8 }}>
        {duties.map((duty) => {
          const isDone = duty.status === 'done'
          return (
            <View
              key={duty.id}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 }}
            >
              {isDone ? <Check size={13} color={p.ok} /> : <Clock size={13} color={p.muted2} />}
              <Text
                style={{
                  flex: 1, fontSize: 12,
                  color: isDone ? p.muted2 : p.fg,
                  textDecorationLine: isDone ? 'line-through' : 'none',
                }}
                numberOfLines={1}
              >
                {duty.title}
              </Text>
              {!isDone ? (
                <Pressable onPress={() => onSnooze(duty)} hitSlop={6}>
                  <Text style={{ fontSize: 11, color: p.brand }}>明天</Text>
                </Pressable>
              ) : null}
            </View>
          )
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        <Button size="sm" variant="outline" onPress={onOpenToday}>
          看今日清单
        </Button>
      </View>
    </View>
  )
}

export function TypingBubble() {
  const p = usePalette()
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 10.5, color: p.muted, marginBottom: 5, marginLeft: 2 }}>管事</Text>
      <View
        style={{
          alignSelf: 'flex-start',
          backgroundColor: p.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: p.border,
          borderRadius: 16,
          borderBottomLeftRadius: 5,
          paddingHorizontal: 14,
          paddingVertical: 12,
        }}
      >
        <ActivityIndicator size="small" color={p.muted} />
      </View>
    </View>
  )
}

export function QuickChips({ onPick }: { onPick: (text: string) => void }) {
  const p = usePalette()
  const chips = [
    { label: '提醒我明天买花', text: '提醒我明天买一束花' },
    { label: '每周通勤', text: '我每周一都要去杭州上班' },
    { label: '本周回顾', text: '这周我漏了什么' },
  ]
  return (
    <View style={{ flexDirection: 'row', gap: 7, paddingHorizontal: 16, paddingVertical: 8 }}>
      {chips.map((chip) => (
        <Pressable
          key={chip.label}
          onPress={() => onPick(chip.text)}
          style={{
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: p.border,
            backgroundColor: p.surface,
            height: 28,
            borderRadius: 999,
            paddingHorizontal: 11,
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 11, color: p.muted }}>{chip.label}</Text>
        </Pressable>
      ))}
    </View>
  )
}

export function Composer({
  value,
  onChangeText,
  onSend,
  onMic,
  onCamera,
  recording,
  partial,
  sending,
}: {
  value: string
  onChangeText: (text: string) => void
  onSend: () => void
  onMic: () => void
  onCamera: () => void
  recording: boolean
  partial: string
  sending: boolean
}) {
  const p = usePalette()
  return (
    <View style={{ backgroundColor: p.bg }}>
      {recording ? (
        <View style={{ alignItems: 'center', paddingTop: 6 }}>
          <Badge tone="brand">正在聆听… {partial ? `「${partial}」` : ''}</Badge>
        </View>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 12,
          paddingVertical: 8,
          backgroundColor: p.surface,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: p.border,
        }}
      >
        <Pressable onPress={onMic} hitSlop={6} style={{ padding: 6 }}>
          <Mic size={20} color={recording ? p.brand : p.muted} />
        </Pressable>
        <TextInput
          value={recording && partial ? partial : value}
          onChangeText={onChangeText}
          editable={!recording}
          placeholder={recording ? '正在听…' : '说一句，比如「提醒我明天买花」'}
          placeholderTextColor={p.muted2}
          style={{
            flex: 1,
            backgroundColor: p.surface2,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: p.border,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 9,
            fontSize: 13,
            color: p.fg,
          }}
          onSubmitEditing={onSend}
          returnKeyType="send"
        />
        <Pressable onPress={onCamera} hitSlop={6} style={{ padding: 6 }}>
          <Camera size={20} color={p.muted} />
        </Pressable>
        <Pressable
          onPress={onSend}
          disabled={sending || (!value.trim() && !partial)}
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            backgroundColor: p.brand,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: sending || (!value.trim() && !partial) ? 0.45 : 1,
          }}
        >
          <Send size={15} color={p.onBrand} />
        </Pressable>
      </View>
    </View>
  )
}
