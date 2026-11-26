import React from 'react'
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChevronLeft, ExternalLink, Trash2 } from 'lucide-react-native'
import { shortDate } from '@/src/lib/format'
import { openAppByPackage, writeClipboardText } from '@/src/lib/native'
import { useApp } from '@/src/lib/store'
import { usePalette } from '@/src/theme/tokens'
import { Badge, Button, Card, Empty, Screen } from '@/src/ui'

/** 剪贴板收藏：复制原内容后打开对应 App，让 App 自己识别剪贴板里的链接 */
const APP_TARGETS: Record<string, { package: string; name: string }> = {
  小红书: { package: 'com.xingin.xhs', name: '小红书' },
  抖音: { package: 'com.ss.android.ugc.aweme', name: '抖音' },
  微信: { package: 'com.tencent.mm', name: '微信' },
}

export default function CollectionDetailScreen() {
  const p = usePalette()
  const { id } = useLocalSearchParams<{ id: string }>()
  const collections = useApp((s) => s.collections)
  const reviewCollection = useApp((s) => s.reviewCollection)
  const removeCollection = useApp((s) => s.removeCollection)
  const addDuty = useApp((s) => s.addDuty)
  const showToast = useApp((s) => s.showToast)
  const confirm = useApp((s) => s.confirm)
  const item = collections.find((c) => c.id === id)

  if (!item) {
    return (
      <Screen>
        <DetailHeader title="收藏详情" />
        <Empty title="这条收藏不在了" desc="可能已经被删除。" />
      </Screen>
    )
  }

  const openUrl = () => {
    if (!item.url) return
    const url = item.url.startsWith('http') ? item.url : `https://${item.url}`
    void Linking.openURL(url).catch(() => showToast('打不开这个链接'))
  }

  // 小红书/抖音/微信不认直链：把当初复制的原文写回剪贴板，再打开 App 让它自己识别
  const openOriginal = async () => {
    const target = APP_TARGETS[item.source]
    if (!target || !item.clip) {
      openUrl()
      return
    }
    const copied = await writeClipboardText(item.clip)
    if (!copied) {
      openUrl()
      return
    }
    const opened = await openAppByPackage(target.package)
    showToast(opened ? `已复制原文，去${target.name}粘贴打开` : `已复制原文，但没安装${target.name}`)
  }

  const toDuty = async () => {
    const duty = await addDuty({
      title: item.title.slice(0, 40),
      type: '收藏',
      source: '收藏',
      date: new Date().toISOString().slice(0, 10),
      timeLabel: '今天',
      origin: `收藏 · ${item.source}`,
      quote: item.excerpt,
      rule: '从收藏转为待办，今天提醒一次',
    })
    if (duty) {
      await reviewCollection(item.id)
      showToast('已转成待办')
      router.push(`/duty/${duty.id}`)
    }
  }

  const onDelete = async () => {
    const ok = await confirm({
      title: '删除收藏',
      message: '删除后不可恢复。',
      confirmText: '删除',
      tone: 'danger',
    })
    if (!ok) return
    await removeCollection(item.id)
    router.back()
  }

  return (
    <Screen>
      <DetailHeader title="收藏详情" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <Card style={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Badge tone="brand">{item.source}</Badge>
            <Badge>{item.meta}</Badge>
            <Badge tone={item.status === 'inbox' ? 'brand' : 'plain'}>
              {item.status === 'inbox' ? '待回顾' : '已回顾'}
            </Badge>
          </View>
          <Text style={{ marginTop: 12, fontSize: 19, fontWeight: '600', lineHeight: 27, color: p.fg }}>
            {item.title}
          </Text>
          <Text style={{ marginTop: 8, fontSize: 10.5, color: p.muted }}>
            {shortDate(item.createdAt)}
            {item.url ? ` · ${item.url}` : ''}
          </Text>
          {item.type === 'image' && item.imagePath ? (
            <Image
              source={{ uri: item.imagePath.startsWith('file://') ? item.imagePath : `file://${item.imagePath}` }}
              style={{ marginTop: 12, width: '100%', height: 180, borderRadius: 12, backgroundColor: p.surface2 }}
              resizeMode="cover"
            />
          ) : null}
          <Text style={{ marginTop: 14, fontSize: 13, lineHeight: 22, color: p.fg }} selectable>
            {item.excerpt || '（没有更多内容）'}
          </Text>
          {item.note ? (
            <View style={{ marginTop: 12, padding: 10, borderRadius: 10, backgroundColor: p.surface2 }}>
              <Text style={{ fontSize: 10.5, color: p.muted }}>备注</Text>
              <Text style={{ marginTop: 3, fontSize: 12, color: p.fg }}>{item.note}</Text>
            </View>
          ) : null}
        </Card>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 18 }}>
          {item.url ? (
            <Button variant="outline" style={{ flex: 1 }} onPress={() => void openOriginal()}>
              <ExternalLink size={14} color={p.fg} />
              打开原链接
            </Button>
          ) : null}
          {item.status === 'inbox' ? (
            <Button style={{ flex: 1 }} onPress={() => void reviewCollection(item.id).then(() => showToast('已标记回顾'))}>
              标记已回顾
            </Button>
          ) : null}
        </View>
        <Button variant="outline" style={{ marginTop: 10 }} onPress={() => void toDuty()}>
          转成待办
        </Button>
        <Button variant="ghost" style={{ marginTop: 10 }} onPress={onDelete}>
          <Trash2 size={14} color={p.danger} />
          <Text style={{ color: p.danger }}>删除收藏</Text>
        </Button>
      </ScrollView>
    </Screen>
  )
}

function DetailHeader({ title }: { title: string }) {
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
      <Text style={{ fontSize: 15, fontWeight: '600', color: p.fg }}>{title}</Text>
    </View>
  )
}
