import React, { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { ArrowRight, Bookmark, Link2, Search, X } from 'lucide-react-native'
import { SourceAvatar } from '@/src/components/SourceAvatar'
import { firstLine, shortDate } from '@/src/lib/format'
import { inferSource } from '@/src/lib/native'
import { useApp } from '@/src/lib/store'
import type { Collection } from '@/src/lib/types'
import { usePalette } from '@/src/theme/tokens'
import {
  Badge,
  Button,
  Card,
  Chip,
  ChipRow,
  Empty,
  FormInput,
  IconButton,
  PageHeader,
  Screen,
  Sheet,
} from '@/src/ui'

const FILTERS = ['全部', '待回顾', '已回顾', '抖音', '微信', '小红书', '网页']

export default function FavScreen() {
  const p = usePalette()
  const collections = useApp((s) => s.collections)
  const addCollection = useApp((s) => s.addCollection)
  const showToast = useApp((s) => s.showToast)
  const [filter, setFilter] = useState('全部')
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [text, setText] = useState('')

  const inbox = collections.filter((c) => c.status === 'inbox').length

  const list = useMemo(() => {
    let items = collections
    if (filter === '待回顾') items = items.filter((c) => c.status === 'inbox')
    else if (filter === '已回顾') items = items.filter((c) => c.status !== 'inbox')
    else if (['抖音', '微信', '小红书', '网页'].includes(filter)) {
      items = items.filter((c) => c.source === filter)
    }
    const keyword = query.trim()
    if (keyword) items = items.filter((c) => `${c.title}${c.excerpt}${c.note}`.includes(keyword))
    return [...items].sort((a, b) => b.createdAt - a.createdAt)
  }, [collections, filter, query])

  const submit = async () => {
    const value = text.trim()
    if (!value) return
    const url = value.match(/https?:\/\/[^\s]+/)?.[0] || ''
    await addCollection({
      title: firstLine(value).slice(0, 60),
      type: 'link',
      source: inferSource(value, url),
      excerpt: value.slice(0, 240),
      url,
      meta: url ? '链接 · 手动' : '文字 · 手动',
    })
    setText('')
    setAddOpen(false)
    showToast('已收进收藏')
  }

  return (
    <Screen>
      <PageHeader
        title="收藏"
        subtitle={`${collections.length} 条 · ${inbox} 条待回顾 · 周日 21:00 提醒回顾`}
        right={
          <IconButton
            icon={<Search size={19} color={p.fg} />}
            onPress={() => setSearchOpen((open) => !open)}
            label="搜索收藏"
          />
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28 }}
        keyboardShouldPersistTaps="handled"
      >
        {searchOpen ? (
          <Card style={{ marginBottom: 10, height: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Search size={16} color={p.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              autoFocus
              placeholder="搜标题、摘要或备注"
              placeholderTextColor={p.muted2}
              style={{ flex: 1, fontSize: 13, color: p.fg }}
            />
            <Pressable onPress={() => setSearchOpen(false)} hitSlop={8}>
              <X size={15} color={p.muted} />
            </Pressable>
          </Card>
        ) : null}

        <View
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 10,
            padding: 12, borderRadius: 12,
            borderWidth: 1, borderStyle: 'dashed', borderColor: p.borderStrong,
            backgroundColor: p.surface2,
          }}
        >
          <View
            style={{
              width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
              backgroundColor: p.brandSoft,
            }}
          >
            <ArrowRight size={16} color={p.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: p.fg }}>
              微信、抖音、小红书里「复制链接」，回到管事就会提示收藏
            </Text>
            <Text style={{ marginTop: 2, fontSize: 10.5, color: p.muted }}>
              其他 App 也可直接分享给管事，浏览器、图片都行
            </Text>
          </View>
          <Button size="sm" variant="outline" onPress={() => setAddOpen(true)}>
            手动收
          </Button>
        </View>

        <View style={{ marginTop: 12 }}>
          <ChipRow>
            {FILTERS.map((item) => (
              <Chip key={item} label={item} active={filter === item} onPress={() => setFilter(item)} />
            ))}
          </ChipRow>
        </View>

        {list.length ? (
          <View
            style={{
              backgroundColor: p.surface,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: p.border,
              borderRadius: 18,
              overflow: 'hidden',
            }}
          >
            {list.map((item, index) => (
              <CollectionRow
                key={item.id}
                item={item}
                last={index === list.length - 1}
                onPress={() => router.push(`/collection/${item.id}`)}
              />
            ))}
          </View>
        ) : (
          <Card style={{ marginTop: 4 }}>
            <Empty title="这里还没有收藏" desc="微信复制链接后回到管事，或在其他 App 里分享给管事。" />
          </Card>
        )}
      </ScrollView>

      <Sheet visible={addOpen} onClose={() => setAddOpen(false)} title="收一条收藏">
        <Text style={{ fontSize: 11, lineHeight: 17, color: p.muted, marginBottom: 10 }}>
          粘贴链接或文字；也可以从微信、抖音直接分享进来，会自动带上来源。
        </Text>
        <FormInput
          value={text}
          onChangeText={setText}
          multiline
          placeholder="https://… 或一段想留下的话"
        />
        <Button style={{ marginTop: 14 }} onPress={() => void submit()}>
          收藏
        </Button>
      </Sheet>
    </Screen>
  )
}

function CollectionRow({
  item,
  last,
  onPress,
}: {
  item: Collection
  last: boolean
  onPress: () => void
}) {
  const p = usePalette()
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 11,
        padding: 13,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: p.border,
        backgroundColor: pressed ? p.surface2 : 'transparent',
      })}
    >
      <SourceAvatar source={item.source} size={40} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 13.5, fontWeight: '500', lineHeight: 19, color: p.fg }} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={{ marginTop: 3, fontSize: 10.5, color: p.muted }} numberOfLines={1}>
          {item.source} · {item.meta} · {shortDate(item.createdAt)}
        </Text>
        {item.note ? (
          <Text style={{ marginTop: 3, fontSize: 10.5, color: p.muted }} numberOfLines={1}>
            备注：{item.note}
          </Text>
        ) : null}
      </View>
      <Badge tone={item.status === 'inbox' ? 'brand' : 'plain'}>
        {item.status === 'inbox' ? '待回顾' : '已回顾'}
      </Badge>
    </Pressable>
  )
}
