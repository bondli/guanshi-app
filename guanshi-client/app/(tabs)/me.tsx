import React from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import Constants from 'expo-constants'
import {
  Bell,
  Brain,
  ChevronRight,
  Download,
  Key,
  MessageSquare,
  Mic,
  Moon,
  Shield,
  Sparkles,
  Sun,
  User,
  Users,
} from 'lucide-react-native'
import { api } from '@/src/lib/api'
import {
  isNotificationAccessEnabled,
  openNotificationSettings,
  requestSmsPermission,
} from '@/src/lib/native'
import { useApp } from '@/src/lib/store'
import { usePalette } from '@/src/theme/tokens'
import {
  Badge,
  IconButton,
  ListCard,
  PageHeader,
  Row,
  Screen,
  Toggle,
} from '@/src/ui'

export default function MeScreen() {
  const p = usePalette()
  const user = useApp((s) => s.user)
  const online = useApp((s) => s.online)
  const settings = useApp((s) => s.settings)
  const saveSettings = useApp((s) => s.saveSettings)
  const showToast = useApp((s) => s.showToast)
  const confirm = useApp((s) => s.confirm)

  const go = (page: string) => router.push(`/settings/${page}`)

  const onQuiet = async (next: boolean) => {
    await saveSettings({ quiet: next })
    void api
      .saveSettings({ quietStart: next ? '22:00' : '00:00', quietEnd: next ? '07:00' : '00:00' })
      .catch(() => undefined)
  }

  const onSms = async (next: boolean) => {
    if (!next) {
      await saveSettings({ sms: false })
      return
    }
    const granted = await requestSmsPermission()
    if (!granted) {
      await confirm({
        title: '需要短信权限',
        message: '拒绝后无法自动识别快递和取件码。可以到系统设置里重新打开。',
        confirmText: '知道了',
        cancelText: null,
      })
      return
    }
    await saveSettings({ sms: true })
    showToast('已开启短信识别')
  }

  const onNotify = async (next: boolean) => {
    if (!next) {
      await saveSettings({ notify: false })
      return
    }
    const enabled = await isNotificationAccessEnabled()
    if (!enabled) {
      const go = await confirm({
        title: '需要通知使用权',
        message: '开启后，才能从微信、电商通知里发现事项。只在本机读取，原文不上传。',
        confirmText: '去开启',
      })
      if (go) void openNotificationSettings()
      return
    }
    await saveSettings({ notify: true })
    showToast('已开启通知识别')
  }

  const themeLabel = settings.theme === 'dark' ? '暗色' : settings.theme === 'system' ? '跟随系统' : '亮色'
  const appVersion = Constants.expoConfig?.version || '0.0.0'

  return (
    <Screen>
      <PageHeader
        title="设置"
        right={
          <IconButton
            icon={<Sparkles size={18} color={p.muted} />}
            plain
            onPress={() => router.push('/onboarding')}
            label="查看首次引导"
          />
        }
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}>
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 12,
            padding: 14, borderRadius: 18,
            backgroundColor: p.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: p.border,
          }}
        >
          <View
            style={{
              width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center',
              backgroundColor: p.brandSoft,
            }}
          >
            <User size={22} color={p.brand} strokeWidth={1.8} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: p.fg }} numberOfLines={1}>
              {user?.id || '本机用户'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 }}>
              <Badge tone="brand">{user?.plan || '高级版'}</Badge>
              <Text style={{ fontSize: 10.5, color: p.muted }} numberOfLines={1}>
                {online ? '已连接云端 · 杀 App 也能提醒' : '离线演示模式 · 等待云端连接'}
              </Text>
            </View>
          </View>
        </View>

        <SectionTitle>提醒与节奏</SectionTitle>
        <ListCard>
          <Row
            icon={<Bell size={16} color={p.brand} />}
            title="提醒频率"
            desc={`晨报 ${user?.briefingTime || '07:30'} · 复盘 ${user?.reviewTime || '21:00'}`}
            tone="brand"
            right={<><Text style={{ fontSize: 11, color: p.muted }}>{styleLabel(settings.reminderStyle)}</Text><ChevronRight size={15} color={p.muted2} /></>}
            onPress={() => go('notify')}
          />
          <Row
            icon={<Moon size={16} color={p.muted} />}
            title="免打扰"
            desc="22:00 - 07:00 不推送"
            last
            right={<Toggle value={settings.quiet} onChange={(next) => void onQuiet(next)} />}
          />
        </ListCard>

        <SectionTitle>数据来源</SectionTitle>
        <ListCard>
          <Row
            icon={<MessageSquare size={16} color={p.muted} />}
            title="短信"
            desc="识别快递与取件码，原文不出本机"
            right={<Toggle value={settings.sms} onChange={(next) => void onSms(next)} />}
          />
          <Row
            icon={<Bell size={16} color={p.muted} />}
            title="通知"
            desc="从微信、电商通知里发现事项"
            right={<Toggle value={settings.notify} onChange={(next) => void onNotify(next)} />}
          />
          <Row
            icon={<Mic size={16} color={p.muted} />}
            title="语音与截图"
            desc="只上传转写后的文字"
            last
            right={<Toggle value={settings.voice} onChange={(next) => void saveSettings({ voice: next })} />}
          />
        </ListCard>

        <SectionTitle>记忆</SectionTitle>
        <ListCard>
          <Row
            icon={<Users size={16} color={p.muted} />}
            title="家人与关系"
            desc="生日与偏好，自动生成周期提醒"
            right={<ChevronRight size={15} color={p.muted2} />}
            onPress={() => go('family')}
          />
          <Row
            icon={<Brain size={16} color={p.muted} />}
            title="长期记忆"
            desc="只记得有用的事，可随时删除"
            last
            right={<ChevronRight size={15} color={p.muted2} />}
            onPress={() => go('memories')}
          />
        </ListCard>

        <SectionTitle>模型与语音</SectionTitle>
        <ListCard>
          <Row
            icon={<Key size={16} color={p.brand} />}
            title="云端模型"
            desc="用自己的 Key，加密后随请求上送"
            tone="brand"
            right={<><Text style={{ fontSize: 11, color: p.muted }}>{settings.llm.apiKey ? settings.llm.model : '规则解析'}</Text><ChevronRight size={15} color={p.muted2} /></>}
            onPress={() => go('model')}
          />
          <Row
            icon={<Mic size={16} color={p.muted} />}
            title="语音听写"
            desc="音频只到讯飞，不存服务端"
            last
            right={<><Text style={{ fontSize: 11, color: p.muted }}>{settings.iflytek.appId ? '已配置' : '未配置'}</Text><ChevronRight size={15} color={p.muted2} /></>}
            onPress={() => go('voice')}
          />
        </ListCard>

        <SectionTitle>其他</SectionTitle>
        <ListCard>
          <Row
            icon={<Sun size={16} color={p.muted} />}
            title="外观"
            desc="亮色 · 暗色 · 跟随系统"
            right={<><Text style={{ fontSize: 11, color: p.muted }}>{themeLabel}</Text><ChevronRight size={15} color={p.muted2} /></>}
            onPress={() => go('theme')}
          />
          <Row
            icon={<Shield size={16} color={p.muted} />}
            title="保活设置"
            desc="关闭电池优化，提醒更可靠"
            right={<ChevronRight size={15} color={p.muted2} />}
            onPress={() => go('keepalive')}
          />
          <Row
            icon={<Download size={16} color={p.muted} />}
            title="数据与隐私"
            desc="你随时可以带走或清空"
            last
            right={<ChevronRight size={15} color={p.muted2} />}
            onPress={() => go('privacy')}
          />
        </ListCard>

        <Text style={{ marginTop: 18, textAlign: 'center', fontSize: 10.5, color: p.muted2 }}>
          管事 v{appVersion} · 你的事，我来管
        </Text>
      </ScrollView>
    </Screen>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  const p = usePalette()
  return (
    <Text
      style={{
        marginTop: 20, marginBottom: 8, marginLeft: 2,
        fontSize: 10.5, fontWeight: '600', letterSpacing: 1, color: p.muted2,
      }}
    >
      {String(children).toUpperCase()}
    </Text>
  )
}

function styleLabel(value: string): string {
  if (value === 'quiet') return '安静'
  if (value === 'active') return '主动'
  return '标准'
}
