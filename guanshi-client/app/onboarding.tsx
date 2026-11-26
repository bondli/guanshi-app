import React, { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import {
  Bell,
  CalendarCheck,
  Camera,
  Check,
  Cloud,
  MessageCircle,
  MessageSquare,
  Mic,
  Moon,
  Sun,
} from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useApp } from '@/src/lib/store'
import { usePalette } from '@/src/theme/tokens'
import { Badge, BrandMark, Button, Screen } from '@/src/ui'

const STEPS = [
  {
    title: '把事情交给我',
    desc: '短信、通知、截图，随口说的一句话，都能变成待办。不用记在本子上，也不用反复提醒自己。',
  },
  {
    title: '到点我会提醒',
    desc: '提醒由云端发起，走系统推送。即使你把 App 杀掉，18:00 的快递提醒照样会到。',
  },
  {
    title: '早晚各一次',
    desc: '早上 07:30 告诉你今天做什么，晚上 21:00 陪你复盘。做完的划掉，没做的顺延到明天。',
  },
]

export default function OnboardingScreen() {
  const p = usePalette()
  const insets = useSafeAreaInsets()
  const completeOnboarding = useApp((s) => s.completeOnboarding)
  const [step, setStep] = useState(0)

  const finish = async () => {
    await completeOnboarding()
    router.replace('/')
  }

  const next = () => {
    if (step === STEPS.length - 1) void finish()
    else setStep(step + 1)
  }

  return (
    <Screen>
      <View style={{ flex: 1, paddingTop: insets.top + 12, paddingHorizontal: 24, paddingBottom: insets.bottom + 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <BrandMark size={34} />
            <Text style={{ fontFamily: 'serif', fontSize: 20, fontWeight: '600', color: p.fg }}>管事</Text>
          </View>
          <Pressable onPress={() => void finish()} hitSlop={10}>
            <Text style={{ fontSize: 12, color: p.muted }}>跳过</Text>
          </Pressable>
        </View>

        <View style={{ flex: 1, justifyContent: 'center', gap: 28 }}>
          <View
            style={{
              borderRadius: 28,
              backgroundColor: p.surface,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: p.border,
              padding: 20,
              minHeight: 330,
              justifyContent: 'center',
              shadowColor: '#18181b',
              shadowOpacity: 0.06,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 12 },
              elevation: 3,
            }}
          >
            {step === 0 ? <StepSources /> : null}
            {step === 1 ? <StepPush /> : null}
            {step === 2 ? <StepRituals /> : null}
          </View>

          <View style={{ gap: 10 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', letterSpacing: 1.5, color: p.brand }}>
              {`0${step + 1} / 0${STEPS.length}`}
            </Text>
            <Text style={{ fontFamily: 'serif', fontSize: 28, fontWeight: '600', color: p.fg }}>
              {STEPS[step].title}
            </Text>
            <Text style={{ fontSize: 13.5, lineHeight: 22, color: p.muted }}>{STEPS[step].desc}</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {STEPS.map((_, index) => (
                <View
                  key={index}
                  style={{
                    width: index === step ? 18 : 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: index === step ? p.brand : p.borderStrong,
                  }}
                />
              ))}
            </View>
            <Button onPress={next} style={{ minWidth: 128 }}>
              {step === STEPS.length - 1 ? '开始使用' : '下一步'}
            </Button>
          </View>
        </View>
      </View>
    </Screen>
  )
}

function StepSources() {
  const p = usePalette()
  const rows = [
    { icon: <MessageSquare size={16} color={p.brand} />, title: '快递短信', desc: '取件码 1-2-345 · 今晚 18:00 提醒', badge: '短信' },
    { icon: <Bell size={16} color={p.fg} />, title: '家长会通知', desc: '周五 15:00 · 带笔和本子', badge: '通知' },
    { icon: <Camera size={16} color={p.fg} />, title: '截图里的安排', desc: '端侧 OCR · 只上传文字', badge: '截图' },
    { icon: <Mic size={16} color={p.fg} />, title: '「提醒我明天买花」', desc: '说一句就记下，不用打字', badge: '语音' },
  ]
  return (
    <View style={{ gap: 9 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <BrandMark size={30} />
        <Text style={{ fontSize: 12, fontWeight: '600', color: p.fg }}>今天收到的线索</Text>
        <View style={{ flex: 1 }} />
        <Badge tone="brand">AI 整理</Badge>
      </View>
      {rows.map((row) => (
        <View
          key={row.title}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 10,
            borderWidth: StyleSheet.hairlineWidth, borderColor: p.border,
            borderRadius: 12, padding: 11, backgroundColor: p.surface2,
          }}
        >
          <View
            style={{
              width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
              backgroundColor: p.surface,
            }}
          >
            {row.icon}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: p.fg }} numberOfLines={1}>{row.title}</Text>
            <Text style={{ marginTop: 2, fontSize: 10, color: p.muted }} numberOfLines={1}>{row.desc}</Text>
          </View>
          <Badge>{row.badge}</Badge>
        </View>
      ))}
    </View>
  )
}

function StepPush() {
  const p = usePalette()
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 12, color: p.muted }}>现在 18:00</Text>
        <Badge tone="brand">云端发起</Badge>
      </View>
      <View
        style={{
          borderRadius: 16, backgroundColor: p.surface2,
          borderWidth: StyleSheet.hairlineWidth, borderColor: p.border,
          padding: 14, gap: 10,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <BrandMark size={26} />
          <Text style={{ fontSize: 11, fontWeight: '600', color: p.fg }}>管事</Text>
          <Text style={{ marginLeft: 'auto', fontSize: 10, color: p.muted }}>刚刚</Text>
        </View>
        <Text style={{ fontSize: 13.5, fontWeight: '600', color: p.fg }}>该去取快递了</Text>
        <Text style={{ fontSize: 12, lineHeight: 18, color: p.muted }}>
          18:00 到点了：取快递 · 菜鸟驿站余姚店{'\n'}取件码 1-2-345
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
          <View style={{ flex: 1, height: 32, borderRadius: 9, backgroundColor: p.brand, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: p.onBrand }}>已完成</Text>
          </View>
          <View style={{ flex: 1, height: 32, borderRadius: 9, borderWidth: StyleSheet.hairlineWidth, borderColor: p.borderStrong, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 11, color: p.fg }}>明天</Text>
          </View>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 11, borderRadius: 12, backgroundColor: p.brandSoft }}>
        <Cloud size={16} color={p.brand} />
        <Text style={{ flex: 1, fontSize: 11, lineHeight: 17, color: p.brand }}>
          杀掉 App 也能收到。点通知会直接进入助手，看到这条消息本身。
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <Badge tone="ok"><Check size={10} /> 云端常驻</Badge>
        <Badge>厂商通道</Badge>
        <Badge>免打扰 22:00-07:00</Badge>
      </View>
    </View>
  )
}

function StepRituals() {
  const p = usePalette()
  const rituals = [
    {
      icon: <Sun size={16} color={p.warn} />,
      time: '07:30',
      title: '晨报',
      lines: ['09:00 前 带跳绳和彩笔', '18:00 前 取快递', '今晚 给妈妈打电话'],
    },
    {
      icon: <Moon size={16} color={p.brand} />,
      time: '21:00',
      title: '复盘',
      lines: ['今天完成 1 / 4', '学校物品、快递还没完成', '本周完成率 78%'],
    },
  ]
  return (
    <View style={{ gap: 12 }}>
      {rituals.map((ritual) => (
        <View
          key={ritual.title}
          style={{
            borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: p.border,
            backgroundColor: p.surface2, padding: 14, gap: 8,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View
              style={{
                width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
                backgroundColor: p.surface,
              }}
            >
              {ritual.icon}
            </View>
            <Text style={{ fontSize: 12.5, fontWeight: '600', color: p.fg }}>{ritual.title}</Text>
            <Text style={{ marginLeft: 'auto', fontSize: 11, color: p.muted }}>{ritual.time}</Text>
          </View>
          {ritual.lines.map((line) => (
            <View key={line} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
              <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: p.brand, marginTop: 6 }} />
              <Text style={{ flex: 1, fontSize: 11.5, lineHeight: 17, color: p.muted }}>{line}</Text>
            </View>
          ))}
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
        <Badge>模板生成</Badge>
        <Badge>0 token</Badge>
        <Badge tone="brand">同一条对话线索</Badge>
      </View>
    </View>
  )
}
