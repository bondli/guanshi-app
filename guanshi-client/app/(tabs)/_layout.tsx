import React from 'react'
import { Pressable, View, type PressableProps } from 'react-native'
import { Tabs } from 'expo-router'
import { Bookmark, CalendarCheck, LayoutList, MessageCircle, User } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useApp } from '@/src/lib/store'
import { usePalette } from '@/src/theme/tokens'

function ChatIcon({ color, size }: { color: string | null; size: number }) {
  const unread = useApp((s) => s.unread)
  const p = usePalette()
  return (
    <View>
      <MessageCircle size={size} color={color ?? p.muted} strokeWidth={1.8} />
      {unread > 0 ? (
        <View
          style={{
            position: 'absolute',
            top: -2,
            right: -3,
            width: 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: p.brand,
            borderWidth: 1.5,
            borderColor: p.tabbar,
          }}
        />
      ) : null}
    </View>
  )
}

/** 底部 tab 用无涟漪按钮，点击只做轻微缩放，不出现水波纹 */
function TabButton({ children, style, onPress, onLongPress, accessibilityState, accessibilityLabel }: PressableProps) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityState={accessibilityState}
      accessibilityLabel={accessibilityLabel}
      android_ripple={{ color: 'transparent', borderless: false }}
      style={({ pressed }) => [
        style as never,
        { flex: 1, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.62 : 1 },
      ]}
    >
      {children}
    </Pressable>
  )
}

export default function TabsLayout() {
  const p = usePalette()
  const insets = useSafeAreaInsets()
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: p.bg },
        tabBarActiveTintColor: p.brand,
        tabBarInactiveTintColor: p.muted,
        tabBarHideOnKeyboard: true,
        tabBarButton: (props) => <TabButton {...props} />,
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: '600', marginTop: 1 },
        tabBarStyle: {
          backgroundColor: p.tabbar,
          borderTopColor: p.border,
          borderTopWidth: 0.5,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 6,
        },
        tabBarItemStyle: { paddingVertical: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '今日',
          tabBarIcon: ({ color, size }) => <CalendarCheck size={size} color={color} strokeWidth={1.8} />,
        }}
      />
      <Tabs.Screen
        name="all"
        options={{
          title: '全部',
          tabBarIcon: ({ color, size }) => <LayoutList size={size} color={color} strokeWidth={1.8} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: '助手',
          tabBarIcon: ({ color, size }) => <ChatIcon color={color as string | null} size={size} />,
        }}
      />
      <Tabs.Screen
        name="fav"
        options={{
          title: '收藏',
          tabBarIcon: ({ color, size }) => <Bookmark size={size} color={color} strokeWidth={1.8} />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: '我的',
          tabBarIcon: ({ color, size }) => <User size={size} color={color} strokeWidth={1.8} />,
        }}
      />
    </Tabs>
  )
}
