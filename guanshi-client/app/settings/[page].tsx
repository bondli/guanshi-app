import React, { useEffect, useState } from 'react'
import {
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import * as Notifications from 'expo-notifications'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Check, ChevronLeft, ChevronRight, ExternalLink, X } from 'lucide-react-native'
import { api, getServerPublicKey } from '@/src/lib/api'
import { shortDate } from '@/src/lib/format'
import {
  startCloudSpeech,
  stopSpeech,
  cancelSpeech,
  ensureMicPermission,
  ensureNotificationPermission,
  isNotificationAccessEnabled,
  openNotificationSettings,
} from '@/src/lib/native'
import { useApp } from '@/src/lib/store'
import type { ThemeMode } from '@/src/theme/tokens'
import { usePalette } from '@/src/theme/tokens'
import {
  Badge,
  Button,
  Card,
  Chip,
  Empty,
  FormInput,
  ListCard,
  Muted,
  Row,
  Screen,
  Seg,
  Toggle,
} from '@/src/ui'

const TITLES: Record<string, string> = {
  notify: '提醒与节奏',
  family: '家人与关系',
  memories: '长期记忆',
  model: '云端模型',
  voice: '语音听写',
  theme: '外观',
  privacy: '数据与隐私',
  keepalive: '保活设置',
}

export default function SettingsPage() {
  const p = usePalette()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ page?: string }>()
  const page = typeof params.page === 'string' ? params.page : 'notify'
  const title = TITLES[page] || '设置'

  return (
    <Screen>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 12,
          paddingTop: insets.top + 6,
          paddingBottom: 10,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ padding: 6 }}>
          <ChevronLeft size={20} color={p.fg} />
        </Pressable>
        <Text style={{ fontSize: 15, fontWeight: '600', color: p.fg }}>{title}</Text>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 36 }}
      >
        {page === 'notify' ? <NotifyPage /> : null}
        {page === 'family' ? <FamilyPage /> : null}
        {page === 'memories' ? <MemoriesPage /> : null}
        {page === 'model' ? <ModelPage /> : null}
        {page === 'voice' ? <VoicePage /> : null}
        {page === 'theme' ? <ThemePage /> : null}
        {page === 'privacy' ? <PrivacyPage /> : null}
        {page === 'keepalive' ? <KeepAlivePage /> : null}
        {!TITLES[page] ? <Empty title="页面不存在" desc="返回上一页看看吧。" /> : null}
      </ScrollView>
    </Screen>
  )
}

function SectionTitle({ children }: { children: string }) {
  const p = usePalette()
  return (
    <Text style={{ marginTop: 20, marginBottom: 8, marginLeft: 2, fontSize: 10.5, fontWeight: '600', letterSpacing: 1, color: p.muted2 }}>
      {children}
    </Text>
  )
}

function NotifyPage() {
  const p = usePalette()
  const settings = useApp((s) => s.settings)
  const user = useApp((s) => s.user)
  const saveSettings = useApp((s) => s.saveSettings)
  const showToast = useApp((s) => s.showToast)
  const [merge, setMerge] = useState(true)
  const [tested, setTested] = useState(false)
  const [editing, setEditing] = useState<'briefing' | 'review' | null>(null)
  const [draft, setDraft] = useState('')

  const briefingTime = user?.briefingTime || '07:30'
  const reviewTime = user?.reviewTime || '21:00'

  const changeStyle = async (value: 'quiet' | 'standard' | 'active') => {
    await saveSettings({ reminderStyle: value })
    void api.saveSettings({ reminderStyle: value }).catch(() => undefined)
    showToast('提醒频率已更新')
  }

  const changePush = async (next: boolean) => {
    if (next) {
      const granted = await ensureNotificationPermission()
      if (!granted) {
        showToast('系统通知权限未开启')
        return
      }
    }
    await saveSettings({ push: next })
    if (next) setTested(false)
  }

  const openTime = (kind: 'briefing' | 'review') => {
    setEditing(kind)
    setDraft(kind === 'briefing' ? briefingTime : reviewTime)
  }

  const saveTime = async (kind: 'briefing' | 'review', value: string) => {
    const clean = value.trim()
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(clean)) {
      showToast('时间格式为 HH:mm，例如 07:30')
      return
    }
    try {
      await api.saveSettings(kind === 'briefing' ? { briefingTime: clean } : { reviewTime: clean })
      await useApp.getState().refresh()
      setEditing(null)
      showToast(kind === 'briefing' ? `晨报改为 ${clean}` : `复盘改为 ${clean}`)
    } catch {
      showToast('保存失败，检查云端连接')
    }
  }

  const sendTest = async () => {
    if (!settings.apiBase) return
    const granted = await ensureNotificationPermission()
    if (!granted) {
      showToast('先允许系统通知')
      return
    }
    try {
      const result = await api.testPush('briefing')
      await Notifications.scheduleNotificationAsync({
        content: {
          title: result.title,
          body: '点开这条通知，会回到助手里的同一条消息',
          data: { messageId: result.messageId },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 2,
        },
      })
      await useApp.getState().refresh()
      setTested(true)
      showToast('2 秒后会收到测试通知')
    } catch {
      showToast('推送失败，检查云端连接')
    }
  }

  return (
    <>
      <SectionTitle>提醒频率</SectionTitle>
      <Seg
        value={settings.reminderStyle}
        onChange={(value) => void changeStyle(value)}
        options={[
          { value: 'quiet', label: '安静' },
          { value: 'standard', label: '标准' },
          { value: 'active', label: '主动' },
        ]}
      />
      <Muted style={{ marginTop: 2, marginBottom: 12 }}>
        安静：只在临期提醒一次。标准：前 3 天温和、前 1 天明确、当天强提醒。主动：进入最佳窗口就提醒，并每 12 小时跟进一次。
      </Muted>

      <SectionTitle>每日仪式</SectionTitle>
      <ListCard>
        <TimeRow
          title="每日晨报"
          desc="每天一次，汇总今天要做的事"
          value={briefingTime}
          editing={editing === 'briefing'}
          draft={draft}
          presets={['06:30', '07:00', '07:30', '08:00', '08:30']}
          onPress={() => openTime('briefing')}
          onChangeDraft={setDraft}
          onSave={(value) => void saveTime('briefing', value)}
          onPick={(value) => void saveTime('briefing', value)}
        />
        <TimeRow
          title="晚间复盘"
          desc="一天结束时过一遍完成情况"
          value={reviewTime}
          editing={editing === 'review'}
          draft={draft}
          presets={['20:00', '20:30', '21:00', '21:30', '22:00']}
          onPress={() => openTime('review')}
          onChangeDraft={setDraft}
          onSave={(value) => void saveTime('review', value)}
          onPick={(value) => void saveTime('review', value)}
          last
        />
      </ListCard>

      <SectionTitle>提醒通道</SectionTitle>
      <ListCard>
        <Row
          title="免打扰"
          desc="夜里不打扰，消息仍会留在助手"
          right={<Toggle value={settings.quiet} onChange={(next) => void saveSettings({ quiet: next })} />}
        />
        <Row
          title="系统通知"
          desc="到点提醒通过系统通知送达"
          right={<Toggle value={settings.push} onChange={(next) => void changePush(next)} />}
        />
        <Row
          title="批量合并提醒"
          desc="同一天多件事合成一条推送"
          last
          right={<Toggle value={merge} onChange={setMerge} />}
        />
      </ListCard>
      <Button variant="outline" style={{ marginTop: 14 }} onPress={() => void sendTest()}>
        {tested ? '再测一次推送通道' : '测试云端推送通道'}
      </Button>
    </>
  )
}

function TimeRow({
  title,
  desc,
  value,
  editing,
  draft,
  presets,
  onPress,
  onChangeDraft,
  onSave,
  onPick,
  last,
}: {
  title: string
  desc: string
  value: string
  editing: boolean
  draft: string
  presets: string[]
  onPress: () => void
  onChangeDraft: (text: string) => void
  onSave: (value: string) => void
  onPick: (value: string) => void
  last?: boolean
}) {
  const p = usePalette()
  return (
    <View
      style={{
        borderBottomWidth: last && !editing ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: p.border,
      }}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 14,
          paddingVertical: 13,
          backgroundColor: pressed ? p.surface2 : 'transparent',
        })}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 13.5, fontWeight: '500', color: p.fg }}>{title}</Text>
          <Text style={{ marginTop: 2, fontSize: 10.5, color: p.muted }}>{desc}</Text>
        </View>
        <View
          style={{
            paddingHorizontal: 9,
            paddingVertical: 4,
            borderRadius: 8,
            backgroundColor: editing ? p.brandSoft : p.surface2,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: '600', color: editing ? p.brand : p.fg }}>{value}</Text>
        </View>
        <ChevronRight size={15} color={p.muted2} />
      </Pressable>

      {editing ? (
        <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            {presets.map((preset) => (
              <Chip key={preset} label={preset} active={draft === preset} onPress={() => onPick(preset)} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' }}>
            <TextInput
              value={draft}
              onChangeText={onChangeDraft}
              placeholder="HH:mm"
              placeholderTextColor={p.muted2}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              style={{
                flex: 1,
                height: 38,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: p.borderStrong,
                backgroundColor: p.surface2,
                borderRadius: 10,
                paddingHorizontal: 12,
                fontSize: 13,
                color: p.fg,
              }}
            />
            <Button size="sm" onPress={() => onSave(draft)}>
              保存
            </Button>
          </View>
        </View>
      ) : null}
    </View>
  )
}

function FamilyPage() {
  const p = usePalette()
  const family = useApp((s) => s.family)
  return (
    <>
      <SectionTitle>家人</SectionTitle>
      <ListCard>
        {family.map((person, index) => (
          <View
            key={person.id}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 12,
              paddingHorizontal: 14, paddingVertical: 12,
              borderBottomWidth: index === family.length - 1 ? 0 : StyleSheet.hairlineWidth,
              borderBottomColor: p.border,
            }}
          >
            <View
              style={{
                width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
                backgroundColor: p.brandSoft,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: p.brand }}>{person.name.slice(0, 1)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '500', color: p.fg }}>
                {person.name} · {person.relation}
              </Text>
              <Text style={{ marginTop: 2, fontSize: 10.5, color: p.muted }}>
                生日 {person.birthday} · {person.note}
              </Text>
            </View>
            <Badge tone="brand">生日提醒</Badge>
          </View>
        ))}
      </ListCard>
      {!family.length ? <Empty title="还没有家人信息" desc="对助手说「我妈生日 12 月 3 日」就能加上。" /> : null}
      <Muted style={{ marginTop: 12 }}>
        生日会自动生成周期待办，提前 7 天与当天各提醒一次。你也可以直接对助手说一句来添加家人。
      </Muted>
      <Button variant="outline" style={{ marginTop: 14 }} onPress={() => router.push('/chat')}>
        去对助手说一句
      </Button>
    </>
  )
}

function MemoriesPage() {
  const p = usePalette()
  const memories = useApp((s) => s.memories)
  const forgetMemory = useApp((s) => s.forgetMemory)
  const addMemoryAction = useApp((s) => s.addMemory)
  const [text, setText] = useState('')

  const submit = async () => {
    const value = text.trim()
    if (!value) return
    await addMemoryAction('事实', value)
    setText('')
  }

  return (
    <>
      <SectionTitle>记住的事</SectionTitle>
      <ListCard>
        {memories.map((memory, index) => (
          <View
            key={memory.id}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 10,
              paddingHorizontal: 14, paddingVertical: 12,
              borderBottomWidth: index === memories.length - 1 ? 0 : StyleSheet.hairlineWidth,
              borderBottomColor: p.border,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12.5, lineHeight: 18, color: p.fg }}>{memory.text}</Text>
              <Text style={{ marginTop: 3, fontSize: 10, color: p.muted }}>
                {memory.kind} · {shortDate(memory.createdAt)}
              </Text>
            </View>
            <Pressable onPress={() => void forgetMemory(memory.id)} hitSlop={8}>
              <X size={15} color={p.muted2} />
            </Pressable>
          </View>
        ))}
      </ListCard>
      {!memories.length ? <Empty title="还没有记住什么" desc="聊几句，我会记住有用的事。" /> : null}
      <Muted style={{ marginTop: 10 }}>
        记忆只在需要时被检索，不会整段塞进模型。删除后不影响已创建的待办。
      </Muted>

      <SectionTitle>补一条记忆</SectionTitle>
      <FormInput value={text} onChangeText={setText} placeholder="比如：孩子周三要带跳绳" />
      <Button variant="outline" style={{ marginTop: 10 }} onPress={() => void submit()}>
        记住这条
      </Button>
    </>
  )
}

function ModelPage() {
  const p = usePalette()
  const settings = useApp((s) => s.settings)
  const saveSettings = useApp((s) => s.saveSettings)
  const showToast = useApp((s) => s.showToast)
  const confirm = useApp((s) => s.confirm)
  const online = useApp((s) => s.online)
  const user = useApp((s) => s.user)
  const [base, setBase] = useState(settings.apiBase)
  const [testing, setTesting] = useState(false)
  const [latency, setLatency] = useState<number | null>(null)

  const [llmBase, setLlmBase] = useState(settings.llm.baseUrl)
  const [llmModel, setLlmModel] = useState(settings.llm.model)
  const [llmKey, setLlmKey] = useState(settings.llm.apiKey)
  const [fingerprint, setFingerprint] = useState('')
  const [models, setModels] = useState<string[]>([])
  const [loadingModels, setLoadingModels] = useState(false)

  const save = async () => {
    await saveSettings({ apiBase: base.trim() })
    showToast('服务端地址已保存')
  }

  const test = async () => {
    setTesting(true)
    const started = Date.now()
    try {
      await api.health()
      const key = await getServerPublicKey(true)
      setFingerprint(key.fingerprint)
      setLatency(Date.now() - started)
      showToast('连接成功，传输密钥已同步')
    } catch {
      setLatency(null)
      showToast('连接失败，检查地址与端口')
    } finally {
      setTesting(false)
    }
  }

  const fetchModels = async () => {
    if (!llmKey.trim()) {
      showToast('先填 API Key')
      return
    }
    setLoadingModels(true)
    try {
      const result = await api.listModels({
        baseUrl: llmBase.trim().replace(/\/+$/, ''),
        model: llmModel,
        apiKey: llmKey.trim(),
      })
      setModels(result.models)
      if (result.models.length) {
        if (!llmModel || !result.models.includes(llmModel)) setLlmModel(result.models[0])
        showToast(`找到 ${result.models.length} 个模型`)
      } else {
        showToast('这个服务没有返回可用模型')
      }
    } catch (error) {
      showToast((error as Error).message || '拉取模型失败')
    } finally {
      setLoadingModels(false)
    }
  }

  const saveLlm = async () => {
    if (!llmBase.trim()) {
      showToast('先填服务地址')
      return
    }
    if (!llmKey.trim()) {
      showToast('先填 API Key')
      return
    }
    if (!llmModel.trim()) {
      showToast('先点「获取模型」选一个')
      return
    }
    await saveSettings({
      llm: {
        baseUrl: llmBase.trim().replace(/\/+$/, ''),
        model: llmModel.trim(),
        apiKey: llmKey.trim(),
      },
    })
    showToast('已保存，Key 只存在本机')
  }

  const clearLlm = async () => {
    const ok = await confirm({
      title: '清空模型 Key',
      message: '清空后云端会用规则解析，不再调用模型。',
      confirmText: '清空',
      tone: 'danger',
    })
    if (!ok) return
    setLlmKey('')
    setLlmModel('')
    setModels([])
    await saveSettings({
      llm: { baseUrl: llmBase.trim() || 'https://api.deepseek.com', model: '', apiKey: '' },
    })
    showToast('已清空模型 Key')
  }

  return (
    <>
      <SectionTitle>云端服务</SectionTitle>
      <Card>
        <Muted>Agent 常驻云端，负责理解、记忆、定时与推送。手机端只做采集与展示。</Muted>
        <Text style={{ marginTop: 12, marginBottom: 6, fontSize: 10.5, color: p.muted }}>服务端地址</Text>
        <FormInput value={base} onChangeText={setBase} placeholder="http://192.168.1.10:7777/api" />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <Button style={{ flex: 1 }} onPress={() => void save()}>
            保存
          </Button>
          <Button variant="outline" style={{ flex: 1 }} loading={testing} onPress={() => void test()}>
            测试连接
          </Button>
        </View>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
          <Badge tone={online ? 'ok' : 'warn'}>{online ? '云端在线' : '离线演示'}</Badge>
          <Badge>{settings.llm.apiKey ? settings.llm.model || '未选模型' : '规则解析'}</Badge>
          {latency != null ? <Badge>{latency} ms</Badge> : null}
          {user ? <Badge>ID {user.id.slice(-6)}</Badge> : null}
        </View>
        {fingerprint ? (
          <Text style={{ marginTop: 8, fontSize: 10, color: p.muted2, fontFamily: 'monospace' }}>
            传输密钥指纹 {fingerprint}
          </Text>
        ) : null}
      </Card>

      <SectionTitle>我的模型</SectionTitle>
      <Card>
        <Muted>
          填服务地址和 Key 就够，模型名会自动拉取。Key 只存在这台手机（系统加密存储），每次请求加密后带给云端，云端用完即扔、不落库。
        </Muted>
        <Text style={{ marginTop: 12, marginBottom: 6, fontSize: 10.5, color: p.muted }}>服务地址</Text>
        <FormInput value={llmBase} onChangeText={setLlmBase} placeholder="https://api.deepseek.com" />
        <Text style={{ marginTop: 12, marginBottom: 6, fontSize: 10.5, color: p.muted }}>API Key</Text>
        <FormInput value={llmKey} onChangeText={setLlmKey} placeholder="sk-…" secureTextEntry />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <Button variant="outline" style={{ flex: 1 }} loading={loadingModels} onPress={() => void fetchModels()}>
            {models.length ? '重新获取模型' : '获取模型'}
          </Button>
          <Button style={{ flex: 1 }} onPress={() => void saveLlm()}>
            保存
          </Button>
        </View>

        {models.length ? (
          <>
            <Text style={{ marginTop: 14, marginBottom: 8, fontSize: 10.5, color: p.muted }}>
              选择模型
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
              {models.map((id) => (
                <Chip key={id} label={id} active={llmModel === id} onPress={() => setLlmModel(id)} />
              ))}
            </View>
          </>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
          <Badge tone={settings.llm.apiKey ? 'ok' : 'plain'}>
            {settings.llm.apiKey ? `已配置 ${maskKey(settings.llm.apiKey)}` : '未配置 Key'}
          </Badge>
          {settings.llm.model ? <Badge>{settings.llm.model}</Badge> : null}
          <Badge>RSA-OAEP 加密传输</Badge>
        </View>
        <Button variant="ghost" style={{ marginTop: 12 }} onPress={() => void clearLlm()}>
          清空模型配置
        </Button>
      </Card>

      <SectionTitle>没有 Key 会怎样</SectionTitle>
      <Card>
        <Muted>
          不填 Key 也能用：云端会用规则解析把话变成待办，晨报、复盘、到点提醒都是模板生成、不消耗 token。只是闲聊和复杂语义理解会弱一些。
        </Muted>
      </Card>

      <SectionTitle>说明</SectionTitle>
      <Card>
        <Muted>
          真机调试时，把服务端地址换成电脑的局域网 IP，例如 http://192.168.1.10:7777/api。Android 模拟器默认用 10.0.2.2。
        </Muted>
      </Card>
    </>
  )
}

function maskKey(key: string): string {
  if (key.length <= 8) return '已保存'
  return `${key.slice(0, 4)}…${key.slice(-4)}`
}

function VoicePage() {
  const p = usePalette()
  const settings = useApp((s) => s.settings)
  const saveSettings = useApp((s) => s.saveSettings)
  const showToast = useApp((s) => s.showToast)
  const confirm = useApp((s) => s.confirm)
  const [appId, setAppId] = useState(settings.iflytek.appId)
  const [apiKey, setApiKey] = useState(settings.iflytek.apiKey)
  const [apiSecret, setApiSecret] = useState(settings.iflytek.apiSecret)
  const [result, setResult] = useState('')
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    return () => cancelSpeech()
  }, [])

  const save = async () => {
    await saveSettings({ iflytek: { appId: appId.trim(), apiKey: apiKey.trim(), apiSecret: apiSecret.trim() } })
    showToast('讯飞凭证已保存')
  }

  const test = async () => {
    if (testing) {
      stopSpeech()
      return
    }
    if (!appId.trim() || !apiKey.trim() || !apiSecret.trim()) {
      showToast('先把三项凭证填完整')
      return
    }
    const granted = await ensureMicPermission()
    if (!granted) {
      showToast('需要麦克风权限')
      return
    }
    await saveSettings({ iflytek: { appId: appId.trim(), apiKey: apiKey.trim(), apiSecret: apiSecret.trim() } })
    setTesting(true)
    setResult('')
    try {
      const text = await startCloudSpeech({
        appId: appId.trim(),
        apiKey: apiKey.trim(),
        apiSecret: apiSecret.trim(),
      })
      setResult(text || '没有听清')
    } catch (error) {
      await confirm({
        title: '听写失败',
        message: (error as Error).message || '检查凭证与网络',
        confirmText: '知道了',
        cancelText: null,
      })
    } finally {
      setTesting(false)
    }
  }

  const clear = async () => {
    setAppId('')
    setApiKey('')
    setApiSecret('')
    setResult('')
    await saveSettings({ iflytek: { appId: '', apiKey: '', apiSecret: '' } })
    showToast('已清除讯飞凭证')
  }

  return (
    <>
      <SectionTitle>讯飞语音听写</SectionTitle>
      <Card>
        <Muted>在线听写优先；未配置时自动退回系统语音识别。音频只发往讯飞，不经过我们的服务器。</Muted>
        <Text style={{ marginTop: 12, marginBottom: 6, fontSize: 10.5, color: p.muted }}>APPID</Text>
        <FormInput value={appId} onChangeText={setAppId} placeholder="在讯飞开放平台创建应用后获得" />
        <Text style={{ marginTop: 12, marginBottom: 6, fontSize: 10.5, color: p.muted }}>APIKey</Text>
        <FormInput value={apiKey} onChangeText={setApiKey} placeholder="APIKey" />
        <Text style={{ marginTop: 12, marginBottom: 6, fontSize: 10.5, color: p.muted }}>APISecret</Text>
        <FormInput value={apiSecret} onChangeText={setApiSecret} placeholder="APISecret" secureTextEntry />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <Button style={{ flex: 1 }} onPress={() => void save()}>
            保存
          </Button>
          <Button variant="outline" style={{ flex: 1 }} onPress={() => void test()}>
            {testing ? '停止并查看结果' : '试听一句'}
          </Button>
        </View>
        {result ? (
          <View style={{ marginTop: 12, padding: 10, borderRadius: 10, backgroundColor: p.surface2 }}>
            <Text style={{ fontSize: 10.5, color: p.muted }}>识别结果</Text>
            <Text style={{ marginTop: 3, fontSize: 13, color: p.fg }}>{result}</Text>
          </View>
        ) : null}
        <Button variant="ghost" style={{ marginTop: 12 }} onPress={() => void clear()}>
          清除凭证
        </Button>
      </Card>
    </>
  )
}

function ThemePage() {
  const p = usePalette()
  const theme = useApp((s) => s.settings.theme)
  const setTheme = useApp((s) => s.setTheme)
  const options: { value: ThemeMode; label: string; desc: string }[] = [
    { value: 'light', label: '亮色', desc: '暖纸底色，白天更清爽' },
    { value: 'dark', label: '暗色', desc: '夜里不刺眼' },
    { value: 'system', label: '跟随系统', desc: '随手机深浅色自动切换' },
  ]
  return (
    <>
      <SectionTitle>外观</SectionTitle>
      <ListCard>
        {options.map((option, index) => (
          <Pressable
            key={option.value}
            onPress={() => void setTheme(option.value)}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 12,
              paddingHorizontal: 14, paddingVertical: 14,
              borderBottomWidth: index === options.length - 1 ? 0 : StyleSheet.hairlineWidth,
              borderBottomColor: p.border,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13.5, fontWeight: '500', color: p.fg }}>{option.label}</Text>
              <Text style={{ marginTop: 2, fontSize: 10.5, color: p.muted }}>{option.desc}</Text>
            </View>
            {theme === option.value ? <Check size={17} color={p.brand} /> : null}
          </Pressable>
        ))}
      </ListCard>
    </>
  )
}

function PrivacyPage() {
  const p = usePalette()
  const duties = useApp((s) => s.duties)
  const collections = useApp((s) => s.collections)
  const memories = useApp((s) => s.memories)
  const messages = useApp((s) => s.messages)

  const exportData = async () => {
    const payload = JSON.stringify({ duties, collections, memories, messages }, null, 2)
    await Share.share({ title: '管事数据导出', message: payload })
  }

  return (
    <>
      <SectionTitle>我们采集什么</SectionTitle>
      <Card>
        <Muted>
          短信：只在本机用正则识别快递、取件码等片段，原文不上传。{'\n'}
          通知：只读取你勾选的应用通知，原文不上传。{'\n'}
          语音：音频只发往讯飞做听写，只把文字交给云端。{'\n'}
          截图：端侧 ML Kit OCR 出文字，只上传文字，图片留在本机。
        </Muted>
      </Card>

      <SectionTitle>数据放在哪</SectionTitle>
      <Card>
        <Muted>
          待办、对话、收藏、记忆存放在你部署的云端 SQLite 里；本机只保留只读缓存与加密的凭证。退出或卸载不会自动删除云端数据。
        </Muted>
      </Card>

      <SectionTitle>你的控制权</SectionTitle>
      <Card padded={false}>
        <Row
          title="导出我的数据"
          desc="导出待办、收藏、记忆与对话"
          right={<ExternalLink size={15} color={p.muted2} />}
          onPress={() => void exportData()}
        />
        <Row
          title="通知使用权"
          desc="到系统里查看或关闭"
          last
          right={<ExternalLink size={15} color={p.muted2} />}
          onPress={() => void openNotificationSettings()}
        />
      </Card>
      <Muted style={{ marginTop: 12 }}>
        已知限制：通知监听无法补采历史消息；短信可以在下次启动时补采。
      </Muted>
    </>
  )
}

function KeepAlivePage() {
  const p = usePalette()
  const [enabled, setEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    void isNotificationAccessEnabled().then(setEnabled)
  }, [])

  const steps = [
    '关闭电池优化：设置 → 应用 → 管事 → 电池 → 不受限制',
    '允许自启动：在手机管家的自启动列表里打开管事',
    '后台加锁：最近任务里给管事加锁，避免被一键清理',
    '通知使用权：保持开启，才能持续从通知里发现事项',
  ]

  return (
    <>
      <SectionTitle>当前状态</SectionTitle>
      <Card>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          <Badge tone={enabled ? 'ok' : 'warn'}>{enabled ? '通知使用权已开启' : '通知使用权未开启'}</Badge>
          <Badge>WorkManager 周期补采</Badge>
        </View>
        <Muted style={{ marginTop: 10 }}>
          即使 App 被杀，云端推送仍能到达；短信会在下次启动或周期任务里补采，不丢。
        </Muted>
      </Card>

      <SectionTitle>建议按下述步骤设置</SectionTitle>
      <Card padded={false}>
        {steps.map((step, index) => (
          <View
            key={step}
            style={{
              flexDirection: 'row', gap: 10,
              paddingHorizontal: 14, paddingVertical: 12,
              borderBottomWidth: index === steps.length - 1 ? 0 : StyleSheet.hairlineWidth,
              borderBottomColor: p.border,
            }}
          >
            <View
              style={{
                width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
                backgroundColor: p.brandSoft,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '700', color: p.brand }}>{index + 1}</Text>
            </View>
            <Text style={{ flex: 1, fontSize: 12, lineHeight: 18, color: p.fg }}>{step}</Text>
          </View>
        ))}
      </Card>

      <Button variant="outline" style={{ marginTop: 14 }} onPress={() => void openNotificationSettings()}>
        打开通知使用权设置
      </Button>
      <Button variant="ghost" style={{ marginTop: 8 }} onPress={() => void Linking.openSettings()}>
        打开应用系统设置
      </Button>
    </>
  )
}
