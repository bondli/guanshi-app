import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Trash2 } from 'lucide-react-native'
import {
  Composer,
  MessageBubble,
  QuickChips,
  TypingBubble,
} from '@/src/components/chat'
import { isSpeechSupported, ensureMicPermission, onSpeechPartial, pickImage, recognizeImage, startCloudSpeech, startSystemSpeech, stopSpeech } from '@/src/lib/native'
import { todayISO } from '@/src/lib/format'
import { useApp } from '@/src/lib/store'
import type { Duty } from '@/src/lib/types'
import { usePalette } from '@/src/theme/tokens'
import { BrandMark, IconButton, Screen } from '@/src/ui'

export default function ChatScreen() {
  const p = usePalette()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ messageId?: string; voice?: string }>()
  const messages = useApp((s) => s.messages)
  const duties = useApp((s) => s.duties)
  const settings = useApp((s) => s.settings)
  const chatLoading = useApp((s) => s.chatLoading)
  const highlight = useApp((s) => s.highlight)
  const sendChat = useApp((s) => s.sendChat)
  const toggleDuty = useApp((s) => s.toggleDuty)
  const snoozeDuty = useApp((s) => s.snoozeDuty)
  const markRead = useApp((s) => s.markRead)
  const setHighlight = useApp((s) => s.setHighlight)
  const clearChat = useApp((s) => s.clearChat)
  const showToast = useApp((s) => s.showToast)
  const confirm = useApp((s) => s.confirm)

  const [input, setInput] = useState('')
  const [recording, setRecording] = useState(false)
  const [partial, setPartial] = useState('')
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView> | null>(null)
  const voiceStarted = useRef(false)

  const todayDuties = duties.filter((d) => d.date === todayISO() && d.status !== 'dropped')
  const dutyMap = new Map(duties.map((d) => [d.id, d]))

  useFocusEffect(
    useCallback(() => {
      markRead()
      if (params.messageId) setHighlight(String(params.messageId))
    }, [markRead, params.messageId, setHighlight]),
  )

  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80)
    return () => clearTimeout(timer)
  }, [messages.length, chatLoading])

  useEffect(() => {
    return onSpeechPartial((payload) => {
      if (payload.text) setPartial(payload.text)
      if (payload.final || payload.error) setRecording(false)
      if (payload.error) showToast(payload.message || '语音识别失败')
    })
  }, [showToast])

  const beginVoice = useCallback(async () => {
    if (recording) {
      stopSpeech()
      return
    }
    if (!isSpeechSupported()) {
      showToast('当前环境不支持语音识别')
      return
    }
    const granted = await ensureMicPermission()
    if (!granted) {
      showToast('需要麦克风权限')
      return
    }
    setRecording(true)
    setPartial('')
    try {
      const creds = settings.iflytek
      const text = creds.appId && creds.apiKey && creds.apiSecret
        ? await startCloudSpeech(creds)
        : await startSystemSpeech()
      if (text) setInput((prev) => (prev ? `${prev} ${text}` : text))
    } catch (error) {
      showToast((error as Error).message || '语音识别失败')
    } finally {
      setRecording(false)
      setPartial('')
    }
  }, [recording, settings.iflytek, showToast])

  useEffect(() => {
    if (params.voice === '1' && !voiceStarted.current) {
      voiceStarted.current = true
      void beginVoice()
    }
  }, [params.voice, beginVoice])

  const handleSend = (text?: string) => {
    const value = (text ?? input).trim()
    if (!value) return
    if (recording) stopSpeech()
    setInput('')
    void sendChat(value)
  }

  const handleCamera = async () => {
    const shot = await pickImage()
    if (!shot || shot.kind !== 'image' || !shot.path) return
    showToast('正在识别截图…')
    const ocr = await recognizeImage(shot.path)
    if (!ocr?.text) {
      showToast('图里没有识别到文字')
      return
    }
    void sendChat(`我发了一张截图，上面写着：${ocr.text.slice(0, 300)}`)
  }

  const onClear = async () => {
    const ok = await confirm({
      title: '清空对话',
      message: '会清掉云端和本机的对话记录，已创建的待办不受影响。',
      confirmText: '清空',
      tone: 'danger',
    })
    if (ok) await clearChat()
  }

  const onCompleteAll = async () => {
    const list = todayDuties.filter((d) => d.status !== 'done')
    for (const duty of list) {
      await toggleDuty(duty.id)
    }
  }

  const onOpenDuty = (duty: Duty) => router.push(`/duty/${duty.id}`)

  return (
    <Screen>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 16,
          paddingTop: insets.top + 10,
          paddingBottom: 10,
          backgroundColor: p.bg,
        }}
      >
        <BrandMark />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: p.fg }}>管事</Text>
          <Text style={{ marginTop: 1, fontSize: 10.5, color: p.muted }} numberOfLines={1}>
            记得亲朋的生日，也记得每周五下班赶车回家
          </Text>
        </View>
        <IconButton icon={<Trash2 size={19} color={p.fg} />} onPress={onClear} label="清空对话" />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              duty={message.dutyId ? dutyMap.get(message.dutyId) : undefined}
              todayDuties={todayDuties}
              highlight={highlight === message.id}
              onToggleDuty={(duty) => void toggleDuty(duty.id)}
              onSnooze={(duty) => void snoozeDuty(duty.id)}
              onOpenDuty={onOpenDuty}
              onCompleteAll={() => void onCompleteAll()}
              onOpenToday={() => router.push('/')}
            />
          ))}
          {chatLoading ? <TypingBubble /> : null}
          {!messages.length ? (
            <View style={{ paddingVertical: 40, alignItems: 'center', gap: 8 }}>
              <BrandMark size={56} />
              <Text style={{ fontSize: 14, fontWeight: '600', color: p.fg }}>今天想做点什么？</Text>
              <Text style={{ fontSize: 12, color: p.muted, textAlign: 'center', lineHeight: 18 }}>
                随口说一句就行。{'把事情交给我，到点我会提醒你。'}
              </Text>
            </View>
          ) : null}
        </ScrollView>

        <QuickChips onPick={handleSend} />
        <Composer
          value={input}
          onChangeText={setInput}
          onSend={() => handleSend()}
          onMic={() => void beginVoice()}
          onCamera={() => void handleCamera()}
          recording={recording}
          partial={partial}
          sending={chatLoading}
        />
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({})
