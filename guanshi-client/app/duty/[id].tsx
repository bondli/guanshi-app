import React from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChevronLeft, Clock, Trash2 } from 'lucide-react-native'
import { useApp } from '@/src/lib/store'
import { usePalette } from '@/src/theme/tokens'
import { Badge, Button, Card, Empty, Screen } from '@/src/ui'

export default function DutyDetailScreen() {
  const p = usePalette()
  const { id } = useLocalSearchParams<{ id: string }>()
  const duties = useApp((s) => s.duties)
  const toggleDuty = useApp((s) => s.toggleDuty)
  const snoozeDuty = useApp((s) => s.snoozeDuty)
  const dropDuty = useApp((s) => s.dropDuty)
  const purgeDuty = useApp((s) => s.purgeDuty)
  const confirm = useApp((s) => s.confirm)
  const duty = duties.find((d) => d.id === id)

  if (!duty) {
    return (
      <Screen>
        <DetailHeader title="待办详情" />
        <Empty title="这条待办不在了" desc="可能已经被删除或合并。" />
      </Screen>
    )
  }

  const done = duty.status === 'done'

  const onDrop = async () => {
    const ok = await confirm({
      title: '不再提醒',
      message: '这条待办会从清单里移除，历史记录仍可恢复。',
      confirmText: '不再提醒',
      tone: 'danger',
    })
    if (!ok) return
    await dropDuty(duty.id)
    router.back()
  }

  const onPurge = async () => {
    const ok = await confirm({
      title: '彻底删除',
      message: '删除后无法恢复，这条待办和它未触发的提醒都会被清除。',
      confirmText: '删除',
      tone: 'danger',
    })
    if (!ok) return
    await purgeDuty(duty.id)
    router.back()
  }

  return (
    <Screen>
      <DetailHeader
        title="待办详情"
        right={
          <Pressable onPress={onPurge} hitSlop={8} style={{ padding: 6 }}>
            <Trash2 size={18} color={p.danger} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <Card style={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            <Badge tone="brand">{duty.type}</Badge>
            <Badge>{duty.source}</Badge>
            {duty.status === 'pending' ? <Badge tone="warn">待确认</Badge> : null}
            {done ? <Badge tone="ok">已完成</Badge> : null}
          </View>
          <Text
            style={{
              marginTop: 12, fontSize: 20, fontWeight: '600', lineHeight: 28, color: p.fg,
              textDecorationLine: done ? 'line-through' : 'none',
            }}
          >
            {duty.title}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <Clock size={13} color={p.brand} />
            <Text style={{ fontSize: 12, color: p.muted }}>
              {duty.timeLabel} · {duty.date}
            </Text>
          </View>
        </Card>

        <SectionLabel>为什么会有这条</SectionLabel>
        <Card>
          <InfoLine label="来源" value={duty.origin} />
          {duty.quote ? <InfoLine label="原话" value={duty.quote} /> : null}
          <InfoLine label="提醒规则" value={duty.rule} last />
        </Card>

        <SectionLabel>处理记录</SectionLabel>
        <Card>
          {duty.history.length ? (
            duty.history.map((item, index) => (
              <View
                key={`${item.t}-${index}`}
                style={{
                  flexDirection: 'row', gap: 10, paddingVertical: 7,
                  borderBottomWidth: index === duty.history.length - 1 ? 0 : StyleSheet.hairlineWidth,
                  borderBottomColor: p.border,
                }}
              >
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: p.brand, marginTop: 6 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, color: p.fg }}>{item.s}</Text>
                  <Text style={{ marginTop: 2, fontSize: 10.5, color: p.muted }}>{item.t}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={{ fontSize: 12, color: p.muted }}>还没有处理记录。</Text>
          )}
        </Card>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 20 }}>
          <Button style={{ flex: 1 }} onPress={() => void toggleDuty(duty.id)}>
            {done ? '恢复待办' : '标记完成'}
          </Button>
          {!done ? (
            <Button variant="outline" style={{ flex: 1 }} onPress={() => void snoozeDuty(duty.id)}>
              明天再说
            </Button>
          ) : null}
        </View>
        <Button variant="ghost" style={{ marginTop: 10 }} onPress={onDrop}>
          不再提醒
        </Button>
      </ScrollView>
    </Screen>
  )
}

function DetailHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  const p = usePalette()
  const insets = useSafeAreaInsets()
  return (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 12, paddingTop: insets.top + 6, paddingBottom: 10,
      }}
    >
      <Pressable onPress={() => router.back()} hitSlop={8} style={{ padding: 6 }}>
        <ChevronLeft size={20} color={p.fg} />
      </Pressable>
      <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: p.fg }}>{title}</Text>
      {right}
    </View>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  const p = usePalette()
  return (
    <Text style={{ marginTop: 18, marginBottom: 8, marginLeft: 2, fontSize: 11, fontWeight: '600', color: p.muted2 }}>
      {children}
    </Text>
  )
}

function InfoLine({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const p = usePalette()
  return (
    <View
      style={{
        paddingVertical: 8,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: p.border,
      }}
    >
      <Text style={{ fontSize: 10.5, color: p.muted }}>{label}</Text>
      <Text style={{ marginTop: 3, fontSize: 12, lineHeight: 18, color: p.fg }}>{value}</Text>
    </View>
  )
}
