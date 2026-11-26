import React, { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react-native'
import Svg, { Circle } from 'react-native-svg'
import { DutyList } from '@/src/components/DutyRow'
import { bucketOf, sortDuties, todayISO } from '@/src/lib/format'
import { useApp } from '@/src/lib/store'
import type { Bucket } from '@/src/lib/format'
import type { Duty, Festival } from '@/src/lib/types'
import { usePalette } from '@/src/theme/tokens'
import { Card, Chip, ChipRow, Empty, IconButton, PageHeader, Screen, Seg } from '@/src/ui'

const TYPES = ['全部', '快递', '约定', '生日', '节日', '习惯', '学校', '收藏', '行程', '家庭']
const BUCKETS: Bucket[] = ['今天', '明天', '本周', '以后']

export default function AllScreen() {
  const p = usePalette()
  const duties = useApp((s) => s.duties)
  const festivals = useApp((s) => s.festivals)
  const toggleDuty = useApp((s) => s.toggleDuty)
  const [view, setView] = useState<'list' | 'cal'>('list')
  const [filter, setFilter] = useState('全部')
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(todayISO())
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })

  const activeCount = duties.filter((d) => d.status === 'open').length

  const filtered = useMemo(() => {
    let list = duties.filter((d) => d.status !== 'dropped')
    if (filter !== '全部') list = list.filter((d) => d.type === filter)
    const keyword = query.trim()
    if (keyword) {
      list = list.filter((d) => `${d.title}${d.type}${d.origin}${d.source}`.includes(keyword))
    }
    return sortDuties(list)
  }, [duties, filter, query])

  const groups = BUCKETS.map((bucket) => ({
    bucket,
    list: filtered.filter((d) => bucketOf(d.date) === bucket),
  })).filter((group) => group.list.length)

  const calendarCells = useMemo(() => {
    const first = new Date(month.year, month.month, 1).getDay()
    const days = new Date(month.year, month.month + 1, 0).getDate()
    const cells: (number | null)[] = []
    for (let i = 0; i < first; i += 1) cells.push(null)
    for (let d = 1; d <= days; d += 1) cells.push(d)
    return cells
  }, [month])

  const isoOf = (day: number) =>
    `${month.year}-${String(month.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  // 同一天可能有多个节日（比如清明既是节气又是法定假日），取最贴近节日的一个显示
  const festivalMark = useMemo(() => {
    const rank: Record<Festival['kind'], number> = { lunar: 0, solar: 1, term: 2, legal: 3 }
    const best = new Map<string, Festival>()
    const off = new Map<string, '休' | '班'>()
    for (const item of festivals) {
      if (item.off) off.set(item.date, item.off)
      const current = best.get(item.date)
      if (!current || rank[item.kind] < rank[current.kind]) best.set(item.date, item)
    }
    return { best, off }
  }, [festivals])

  const selectedList = sortDuties(duties.filter((d) => d.date === selected && d.status !== 'dropped'))
  const selectedFestival = festivalMark.best.get(selected)

  const openDuty = (duty: Duty) => router.push(`/duty/${duty.id}`)

  const moveMonth = (delta: number) => {
    setMonth((current) => {
      const next = new Date(current.year, current.month + delta, 1)
      return { year: next.getFullYear(), month: next.getMonth() }
    })
  }

  return (
    <Screen>
      <PageHeader
        title="清单"
        subtitle={`${activeCount} 件进行中 · 共 ${duties.length} 件`}
        right={
          <IconButton
            icon={<Search size={19} color={p.fg} />}
            onPress={() => setSearchOpen((open) => !open)}
            label="搜索"
          />
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28 }}
        keyboardShouldPersistTaps="handled"
      >
        <Seg
          value={view}
          onChange={setView}
          options={[
            { value: 'list', label: '列表' },
            { value: 'cal', label: '日历' },
          ]}
        />

        {searchOpen ? (
          <Card style={{ marginBottom: 10, height: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Search size={16} color={p.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              autoFocus
              placeholder="搜待办、类型或来源"
              placeholderTextColor={p.muted2}
              style={{ flex: 1, fontSize: 13, color: p.fg }}
            />
            <Pressable onPress={() => setSearchOpen(false)} hitSlop={8}>
              <X size={15} color={p.muted} />
            </Pressable>
          </Card>
        ) : null}

        {view === 'list' ? (
          <>
            <ChipRow>
              {TYPES.map((type) => (
                <Chip key={type} label={type} active={filter === type} onPress={() => setFilter(type)} />
              ))}
            </ChipRow>

            {groups.length ? (
              groups.map((group) => (
                <View key={group.bucket}>
                  <Text
                    style={{
                      marginTop: 12, marginBottom: 8, marginLeft: 2,
                      fontSize: 10.5, fontWeight: '600', letterSpacing: 1, color: p.muted2,
                    }}
                  >
                    {group.bucket.toUpperCase()}
                  </Text>
                  <DutyList
                    duties={group.list}
                    onOpen={openDuty}
                    onToggle={(duty) => void toggleDuty(duty.id)}
                  />
                </View>
              ))
            ) : (
              <Card>
                <Empty title="没有匹配的待办" desc="换个筛选条件试试。" />
              </Card>
            )}
          </>
        ) : (
          <>
            <Card padded={false} style={{ padding: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2, paddingBottom: 10 }}>
                <Pressable onPress={() => moveMonth(-1)} hitSlop={8} style={{ padding: 4 }}>
                  <ChevronLeft size={18} color={p.muted} />
                </Pressable>
                <Text style={{ fontSize: 13, fontWeight: '600', color: p.fg }}>
                  {month.year} 年 {month.month + 1} 月
                </Text>
                <Pressable onPress={() => moveMonth(1)} hitSlop={8} style={{ padding: 4 }}>
                  <ChevronRight size={18} color={p.muted} />
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', marginBottom: 6 }}>
                {['日', '一', '二', '三', '四', '五', '六'].map((week) => (
                  <Text
                    key={week}
                    style={{ flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '600', color: p.muted2 }}
                  >
                    {week}
                  </Text>
                ))}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {calendarCells.map((day, index) => {
                  if (!day) return <View key={`empty-${index}`} style={{ width: `${100 / 7}%`, height: 54 }} />
                  const iso = isoOf(day)
                  const selectedDay = iso === selected
                  const isToday = iso === todayISO()
                  const count = duties.filter((d) => d.date === iso && d.status !== 'dropped').length
                  const festival = festivalMark.best.get(iso)
                  const offMark = festivalMark.off.get(iso)
                  return (
                    <Pressable
                      key={iso}
                      onPress={() => setSelected(iso)}
                      style={{
                        width: `${100 / 7}%`,
                        height: 54,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <View
                        style={{
                          width: 30,
                          height: 30,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {selectedDay ? (
                          <Svg
                            width={30}
                            height={30}
                            style={StyleSheet.absoluteFill}
                            pointerEvents="none"
                          >
                            <Circle cx={15} cy={15} r={15} fill={p.brand} />
                          </Svg>
                        ) : null}
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: selectedDay || isToday ? '700' : '400',
                            color: selectedDay ? p.onBrand : isToday ? p.brand : p.fg,
                          }}
                        >
                          {day}
                        </Text>
                      </View>
                      <View
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: 2,
                          marginTop: 2,
                          backgroundColor: count ? (selectedDay ? p.brand : p.brand2) : 'transparent',
                        }}
                      />
                      {festival ? (
                        <Text
                          numberOfLines={1}
                          style={{
                            marginTop: 1,
                            fontSize: 8.5,
                            lineHeight: 10,
                            maxWidth: '100%',
                            color: offMark === '休' ? p.brand : p.muted2,
                            fontWeight: offMark === '休' ? '600' : '400',
                          }}
                        >
                          {festival.name}
                        </Text>
                      ) : null}
                    </Pressable>
                  )
                })}
              </View>
            </Card>

            <Text
              style={{
                marginTop: 16, marginBottom: 8, marginLeft: 2,
                fontSize: 10.5, fontWeight: '600', letterSpacing: 1, color: p.muted2,
              }}
            >
              {selected.slice(5).replace('-', ' 月 ')} 日
              {selectedFestival ? ` · ${selectedFestival.name}` : ''}
            </Text>
            {selectedList.length ? (
              <DutyList
                duties={selectedList}
                onOpen={openDuty}
                onToggle={(duty) => void toggleDuty(duty.id)}
              />
            ) : (
              <Card>
                <Empty title="这一天是空的" desc="说一句，或者把截图发给我，就能加进来。" />
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  )
}
