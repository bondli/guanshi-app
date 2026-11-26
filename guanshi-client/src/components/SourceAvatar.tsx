import React from 'react'
import { View } from 'react-native'
import { BookOpen, Bookmark, Globe, Image as ImageIcon, MessageCircle, Music2 } from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'

/** 各来源对应的图标与品牌色。用语义图标代替平台注册商标，避免盗链与授权问题 */
const PLATFORMS: Record<string, { icon: LucideIcon; color: string }> = {
  抖音: { icon: Music2, color: '#fe2c55' },
  微信: { icon: MessageCircle, color: '#07c160' },
  小红书: { icon: BookOpen, color: '#ff2442' },
  网页: { icon: Globe, color: '#71717a' },
  截图: { icon: ImageIcon, color: '#71717a' },
  图片: { icon: ImageIcon, color: '#71717a' },
}

export function SourceAvatar({ source, size = 40 }: { source: string; size?: number }) {
  const platform = PLATFORMS[source] || { icon: Bookmark, color: '#c9522a' }
  const Icon = platform.icon
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: `${platform.color}14`,
      }}
    >
      <Icon size={Math.round(size * 0.46)} color={platform.color} strokeWidth={1.9} />
    </View>
  )
}
