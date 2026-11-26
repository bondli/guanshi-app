import React, { useMemo, useState } from 'react'
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { Bell, CalendarCheck, Camera, Check, ChevronRight, Clock, Cloud, Mic, Plus } from 'lucide-react-native'
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg'
import { DutyList } from '@/src/components/DutyRow'
import { addDaysISO, dateLabel, todayISO, weekdayCN } from '@/src/lib/format'
import { useApp } from '@/src/lib/store'
import type { Duty } from '@/src/lib/types'
import { usePalette } from '@/src/theme/tokens'
import {
  Badge,
  Button,
  Card,
  Chip,
  Empty,
  FormInput,
  IconButton,
  PageHeader,
  Screen,
  SectionHead,
  Sheet,
} from '@/src/ui'

function Ring({ pct }: { pct: number }) {
  const p = usePalette()
  const r = 27
  const circumference = 2 * Math.PI * r
  return (
    <Svg width={64} height={64} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Circle cx={32} cy={32} r={r} stroke={p.ringTrack} strokeWidth={5} fill="none" />
      <Circle
        cx={32}
        cy={32}
        r={r}
        stroke={p.ringBar}
        strokeWidth={5}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${circumference}`}
        strokeDashoffset={circumference * (1 - pct)}
      />
    </Svg>
  )
}

function QuickItem({
  icon,
  label,
  brand,
  onPress,
}: {
  icon: React.ReactNode
  label: string
  brand?: boolean
  onPress: () => void
}) {
  const p = usePalette()
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: 'center',
        gap: 7,
        paddingVertical: 11,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: p.border,
        backgroundColor: pressed ? p.surface2 : p.surface,
      })}
    >
      <View
        style={{
          width: 32, height: 32, borderRadius: 10,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: brand ? p.brandSoft : p.surface2,
          borderWidth: brand ? 0 : StyleSheet.hairlineWidth,
          borderColor: p.border,
        }}
      >
        {icon}
      </View>
      <Text style={{ fontSize: 11, color: p.muted }}>{label}</Text>
    </Pressable>
  )
}

export default function TodayScreen() {
  const p = usePalette()
  const duties = useApp((s) => s.duties)
  const stats = useApp((s) => s.stats)
  const messages = useApp((s) => s.messages)
  const refreshing = useApp((s) => s.refreshing)
  const toggleDuty = useApp((s) => s.toggleDuty)
  const confirmDuty = useApp((s) => s.confirmDuty)
  const dropDuty = useApp((s) => s.dropDuty)
  const addDuty = useApp((s) => s.addDuty)
  const ingestScreenshot = useApp((s) => s.ingestScreenshot)
  const refresh = useApp((s) => s.refresh)
  const setHighlight = useApp((s) => s.setHighlight)
  const showToast = useApp((s) => s.showToast)

  const [addOpen, setAddOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [dayOffset, setDayOffset] = useState(0)
  const [time, setTime] = useState('10:00')

  const today = todayISO()
  const tomorrow = addDaysISO(1)
  const todayDuties = duties.filter((d) => d.date === today && d.status !== 'dropped')
  const pending = todayDuties.filter((d) => d.status === 'pending')
  const open = todayDuties.filter((d) => d.status === 'open').sort((a, b) => a.sort - b.sort)
  const done = todayDuties.filter((d) => d.status === 'done')
  const tomorrowDuties = duties.filter((d) => d.date === tomorrow && d.status !== 'dropped')
  const attention = pending.length + open.length

  const dateText = useMemo(() => {
    const [, m, d] = today.split('-')
    return `${Number(m)} 月 ${Number(d)} 日 · ${weekdayCN(today)}`
  }, [today])

  const openDuty = (duty: Duty) => router.push(`/duty/${duty.id}`)

  const onBell = () => {
    const last = [...messages].reverse().find((m) => m.role === 'ai')
    if (last) setHighlight(last.id)
    router.push('/chat')
  }

  const onQuickVoice = () => router.push('/chat?voice=1')
  const onQuickShot = () => void ingestScreenshot()
  const onReview = () => setReviewOpen(true)

  const submitAdd = async () => {
    if (!title.trim()) return
    const label = dayOffset === 0 ? '今天' : dayOffset === 1 ? '明天' : '后天'
    await addDuty({
      title: title.trim(),
      type: '其他',
      source: '手动',
      date: addDaysISO(dayOffset),
      timeLabel: `${label} ${time}`,
      rule: '按你选的时间提醒一次',
      sort: Number(time.replace(':', '')),
    })
    setTitle('')
    setAddOpen(false)
    showToast('已加入待办')
  }

  return (
    <Screen>
      <PageHeader
        brand
        dateText={dateText}
        right={<IconButton icon={<Bell size={19} color={p.fg} />} onPress={onBell} label="查看晨报" />}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={p.brand} />
        }
      >
        <LinearGradient
          colors={['#2f1c15', '#241612', '#1a110d']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.62, y: 1 }}
          style={{ borderRadius: 24, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20, overflow: 'hidden' }}
        >
          <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
            <Defs>
              <RadialGradient id="heroGlow" cx="92%" cy="-18%" rx="58%" ry="62%">
                <Stop offset="0" stopColor="#f08a59" stopOpacity="0.55" />
                <Stop offset="1" stopColor="#f08a59" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroGlow)" />
          </Svg>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 12, color: p.heroMuted }}>今日待办</Text>
            <View
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 4,
                paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.14)',
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '600', color: '#f6c9b2' }}>云端已就绪</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                <Text style={{ fontFamily: 'serif', fontSize: 46, lineHeight: 50, fontWeight: '600', color: p.heroText }}>
                  {attention}
                </Text>
                <Text style={{ fontSize: 12, color: p.heroMuted }}>件待处理</Text>
              </View>
              <Text style={{ marginTop: 6, fontSize: 11.5, color: p.heroMuted }}>
                已完成 {done.length} / {todayDuties.length} · 下次提醒 {stats.nextPush}
              </Text>
            </View>
            <Ring pct={todayDuties.length ? done.length / todayDuties.length : 0} />
          </View>

          <View
            style={{
              flexDirection: 'row', gap: 22, marginTop: 18, paddingTop: 14,
              borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.1)',
            }}
          >
            {[
              ['本周完成率', `${stats.weekRate}%`],
              ['连续记录', `${stats.streak} 天`],
              ['收藏待回顾', `${stats.collectionInbox} 条`],
            ].map(([label, value]) => (
              <View key={label} style={{ gap: 3 }}>
                <Text style={{ fontSize: 10, color: 'rgba(247,243,239,0.52)' }}>{label}</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: p.heroText }}>{value}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <QuickItem icon={<Mic size={16} color={p.brand} />} label="说一句" brand onPress={onQuickVoice} />
          <QuickItem icon={<Camera size={16} color={p.fg} />} label="发截图" onPress={onQuickShot} />
          <QuickItem icon={<Plus size={16} color={p.fg} />} label="加待办" onPress={() => setAddOpen(true)} />
          <QuickItem icon={<Clock size={16} color={p.fg} />} label="看复盘" onPress={onReview} />
        </View>

        {pending.length ? (
          <>
            <SectionHead title="待确认" count={`${pending.length} 条 · 来自短信识别`} />
            {pending.map((duty) => (
              <View
                key={duty.id}
                style={{
                  marginBottom: 8,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderStyle: 'dashed',
                  borderColor: p.brand,
                  backgroundColor: p.brandSoft,
                  padding: 14,
                }}
              >
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                  <Badge tone="brand">{duty.type}</Badge>
                  <Badge>{duty.source}</Badge>
                  <Badge tone="brand">AI {duty.confidence ?? 90}%</Badge>
                </View>
                <Text style={{ marginTop: 9, fontSize: 14, fontWeight: '600', color: p.fg }}>{duty.title}</Text>
                <Text style={{ marginTop: 5, fontSize: 11, lineHeight: 17, color: p.muted }}>
                  {duty.timeLabel} · {duty.origin}
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                  <Button variant="outline" size="sm" style={{ flex: 1 }} onPress={() => openDuty(duty)}>
                    查看原文
                  </Button>
                  <Button size="sm" style={{ flex: 1 }} onPress={() => void confirmDuty(duty.id)}>
                    确认
                  </Button>
                  <Button variant="ghost" size="sm" style={{ flex: 1 }} onPress={() => void dropDuty(duty.id)}>
                    不是我的
                  </Button>
                </View>
              </View>
            ))}
          </>
        ) : null}

        <SectionHead
          title="待办"
          action={`全部 ${duties.filter((d) => d.status === 'open').length} 件`}
          onPress={() => router.push('/all')}
        />
        {open.length ? (
          <DutyList duties={open} onOpen={openDuty} onToggle={(d) => void toggleDuty(d.id)} />
        ) : (
          <Card>
            <Empty title="今天没有待办了" desc="说一句话，或者把截图发给我。" />
          </Card>
        )}

        {done.length ? (
          <>
            <SectionHead title="已完成" count={`${done.length} 件`} />
            <DutyList duties={done} onOpen={openDuty} onToggle={(d) => void toggleDuty(d.id)} />
          </>
        ) : null}

        <SectionHead title="明天" count={`${tomorrowDuties.length} 件`} />
        {tomorrowDuties.length ? (
          tomorrowDuties.map((duty) => (
            <Pressable
              key={duty.id}
              onPress={() => openDuty(duty)}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 11,
                paddingHorizontal: 14, paddingVertical: 13, marginBottom: 8,
                backgroundColor: pressed ? p.surface2 : p.surface,
                borderWidth: StyleSheet.hairlineWidth, borderColor: p.border, borderRadius: 12,
              })}
            >
              <View
                style={{
                  width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: p.surface2, borderWidth: StyleSheet.hairlineWidth, borderColor: p.border,
                }}
              >
                <CalendarCheck size={16} color={p.muted} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 12.5, fontWeight: '600', color: p.fg }} numberOfLines={1}>
                  {duty.title}
                </Text>
                <Text style={{ marginTop: 2, fontSize: 10.5, color: p.muted }}>
                  {duty.timeLabel} · {duty.type} · 来源 {duty.source}
                </Text>
              </View>
              <ChevronRight size={15} color={p.muted2} />
            </Pressable>
          ))
        ) : (
          <View
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 11, padding: 14,
              borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: p.border, backgroundColor: p.surface,
            }}
          >
            <View
              style={{
                width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
                backgroundColor: p.surface2, borderWidth: StyleSheet.hairlineWidth, borderColor: p.border,
              }}
            >
              <CalendarCheck size={16} color={p.muted} />
            </View>
            <View>
              <Text style={{ fontSize: 12.5, fontWeight: '600', color: p.fg }}>明天还没有安排</Text>
              <Text style={{ marginTop: 2, fontSize: 10.5, color: p.muted }}>今晚复盘时可以顺手规划</Text>
            </View>
          </View>
        )}

      </ScrollView>

      <Sheet visible={addOpen} onClose={() => setAddOpen(false)} title="加一件待办">
        <FormInput value={title} onChangeText={setTitle} placeholder="要做什么？比如「给妈妈买个护肩」" />
        <Text style={{ marginTop: 14, marginBottom: 8, fontSize: 11, color: p.muted }}>哪天</Text>
        <View style={{ flexDirection: 'row', gap: 7 }}>
          {['今天', '明天', '后天'].map((label, index) => (
            <Chip key={label} label={label} active={dayOffset === index} onPress={() => setDayOffset(index)} />
          ))}
        </View>
        <Text style={{ marginTop: 14, marginBottom: 8, fontSize: 11, color: p.muted }}>几点</Text>
        <View style={{ flexDirection: 'row', gap: 7 }}>
          {['09:00', '12:00', '18:00', '20:00'].map((value) => (
            <Chip key={value} label={value} active={time === value} onPress={() => setTime(value)} />
          ))}
        </View>
        <Button style={{ marginTop: 18 }} onPress={() => void submitAdd()}>
          加入待办
        </Button>
      </Sheet>

      <Sheet visible={reviewOpen} onClose={() => setReviewOpen(false)} title="今天复盘">
        <Text style={{ fontSize: 12, color: p.muted, marginBottom: 10 }}>
          {dateLabel(today)} · 完成 {done.length} / {todayDuties.length}
        </Text>
        {todayDuties.map((duty) => (
          <View key={duty.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 }}>
            <View
              style={{
                width: 20, height: 20, borderRadius: 10,
                backgroundColor: duty.status === 'done' ? p.brand : 'transparent',
                borderWidth: 1.5, borderColor: duty.status === 'done' ? p.brand : p.borderStrong,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Check size={11} color={duty.status === 'done' ? '#fff' : 'transparent'} strokeWidth={3} />
            </View>
            <Text
              style={{
                flex: 1, fontSize: 13, color: duty.status === 'done' ? p.muted2 : p.fg,
                textDecorationLine: duty.status === 'done' ? 'line-through' : 'none',
              }}
              numberOfLines={1}
            >
              {duty.title}
            </Text>
            {duty.status !== 'done' ? (
              <Pressable onPress={() => void toggleDuty(duty.id)} hitSlop={6}>
                <Text style={{ fontSize: 11, color: p.brand }}>完成</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
        {!todayDuties.length ? <Empty title="今天没有安排" desc="明天再开始也不迟。" /> : null}
        <Button variant="outline" style={{ marginTop: 12 }} onPress={() => void refresh().then(() => setReviewOpen(false))}>
          刷新复盘
        </Button>
      </Sheet>
    </Screen>
  )
}
