import type { Bootstrap, Collection, Duty, Family, Memory, Message } from './types'

function iso(offset = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function weekday(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date(y, m - 1, d).getDay()]
}

export function seedBootstrap(): Bootstrap {
  const today = iso()
  const now = Date.now()

  const duty = (
    id: string,
    title: string,
    type: string,
    source: string,
    status: Duty['status'],
    date: string,
    timeLabel: string,
    sort: number,
    origin: string,
    quote: string,
    rule: string,
    extra: Partial<Duty> = {},
  ): Duty => ({
    id, title, type, source, status, date, timeLabel, sort, origin, quote, rule,
    history: [{ t: `今天 07:12`, s: '识别并创建待办' }],
    createdAt: now - 7200_000,
    updatedAt: now,
    ...extra,
  })

  const duties: Duty[] = [
    duty('d0', '预约年度体检', '健康', '手动', 'done', today, '08:10', 810,
      '手动创建 · 昨天 22:14', '你说：这周找时间把体检约了。', '手动待办，按你选的时间提醒一次',
      { doneAt: now - 1800_000 }),
    duty('d1', '带跳绳和彩笔去学校', '学校', '语音', 'open', today, '09:00 前', 900,
      '语音输入 · 今天 07:12', '孩子说：明天要带三支铅笔和跳绳。',
      '识别为「学校物品」，按当天早上提醒；已完成则不再打扰'),
    duty('d2', '取快递 · 菜鸟驿站余姚店', '快递', '短信', 'pending', today, '18:00 前', 1800,
      '短信 · 1069****8888 · 今天 14:32', '【菜鸟驿站】您的包裹已到余姚店，取件码 1-2-345。',
      '提取到取件码 12345；今日 18:00 提醒一次，超 48 小时加强', { confidence: 95 }),
    duty('d3', '给妈妈打个电话', '家庭', '记忆', 'open', today, '今晚', 2100,
      '长期记忆 · 妈妈生日', '你曾说过：妈妈生日，老说肩膀疼。', '生日前 3 天提醒一次，当天再提醒一次'),
    duty('d4', '高铁 杭州东 → 余姚北', '行程', '周期', 'open', iso(2), '周五 18:00', 1800,
      '周期待办 · 每周五', '每周五 杭州 → 余姚北。', '提前 3 天提醒订票，提前 1 天未订则升级提醒'),
    duty('d5', '周回顾：本周收藏 5 条', '收藏', '周期', 'open', iso(3), '周日 21:00', 2100,
      '收藏汇总 · 抖音 3 条、微信 2 条', '5 条收藏均未打开。', '每周日晚批量回顾，不即时打扰'),
    duty('d6', '妈妈生日', '生日', '手动', 'open', iso(7), '12 月 3 日', 1200,
      '手动录入 · 家人与关系', '妈妈 · 老说肩膀疼，喜欢实用礼物。', '提前 7 天与当天各提醒一次'),
    duty('d7', '元旦 · 给爸妈准备礼物', '节日', '周期', 'open', iso(36), '1 月 1 日', 1200,
      '节日日历 · 元旦', '元旦，提前 14 天进入最佳准备窗口。', '提前 14 天提醒准备，提前 3 天再提醒'),
    duty('cd1', '去淘宝挑按摩仪', '约定', '对话', 'open', iso(1), '明天 10:00', 1000,
      '助手对话 · 今天 20:41', '你说：行，那提醒我明天去淘宝看看。',
      '从对话补全为：明天 10:00 · 淘宝 · 按摩仪'),
  ]

  const messages: Message[] = [
    { id: 'c1', role: 'me', text: '我妈老说肩膀疼，元旦想送点什么', createdAt: now - 3600_000, read: 1 },
    { id: 'c2', role: 'ai', text: '按摩仪比较稳妥，三五百元就能买到不错的，颈部的更实用一些。', createdAt: now - 3500_000, read: 1 },
    { id: 'c3', role: 'ai', text: '另外一件事：她生日也快到了，要不要一起准备？', createdAt: now - 3400_000, read: 1 },
    { id: 'c4', role: 'me', text: '行，那提醒我明天去淘宝看看', createdAt: now - 600_000, read: 1 },
    { id: 'c5', role: 'ai', text: '记下了。明天上午 10:00 提醒你去淘宝挑按摩仪。', kind: 'duty', dutyId: 'cd1', createdAt: now - 540_000, read: 0 },
  ]

  const collections: Collection[] = [
    {
      id: 'k1', type: 'link', source: '抖音', status: 'inbox', title: '3 分钟挑对按摩仪，避开这 5 个坑',
      excerpt: '康复师讲的：看按摩头形状、看力度档位、别买只能捶打的。颈部的选 U 型，肩部选披肩式。',
      url: 'v.douyin.com/iR2x9k', note: '', meta: '视频 · 02:14', createdAt: now - 2 * 86400_000,
    },
    {
      id: 'k2', type: 'link', source: '微信', status: 'inbox', title: '冬天孩子咳嗽，家里该备什么',
      excerpt: '儿科医生写的清单：生理盐水喷雾、加湿器、退热贴。反复咳嗽超过一周要去医院。',
      url: 'mp.weixin.qq.com/s/8dK2', note: '问问校医要不要备', meta: '公众号 · 6 分钟', createdAt: now - 3 * 86400_000,
    },
    {
      id: 'k3', type: 'link', source: '小红书', status: 'inbox', title: '余姚北站停车攻略：P2 最便宜',
      excerpt: 'P2 停车场一天 20 元，比 P1 便宜一半，走到进站口 5 分钟。周末要早去。',
      url: 'xhslink.com/a/7f3', note: '', meta: '笔记 · 收藏 1.2 万', createdAt: now - 4 * 86400_000,
    },
    {
      id: 'k4', type: 'link', source: '网页', status: 'reviewed', title: '杭州周末去处：良渚古城遗址公园',
      excerpt: '门票 60，建议上午去，园区很大要坐观光车。适合带孩子看稻田和鹿苑。',
      url: 'www.lzsite.com/visit', note: '', meta: '网页 · 已回顾', createdAt: now - 7 * 86400_000,
    },
    {
      id: 'k5', type: 'link', source: '抖音', status: 'inbox', title: '糖醋排骨的家常做法，不用炒糖色',
      excerpt: '先煎后焖，冰糖直接下锅，最后收汁。孩子说想吃，周末可以做一次。',
      url: 'v.douyin.com/k9Lm2', note: '周末做', meta: '视频 · 01:38', createdAt: now - 9 * 86400_000,
    },
    {
      id: 'k6', type: 'image', source: '微信', status: 'reviewed', title: '家长会通知截图',
      excerpt: '周五下午 3 点家长会，带笔和本子，教室在三楼。',
      url: '', note: '已加进日历', meta: '图片 · 已回顾', createdAt: now - 11 * 86400_000,
    },
  ]

  const memories: Memory[] = [
    { id: 'm1', kind: '习惯', text: '每周一 余姚北 → 杭州，每周五 杭州 → 余姚北', createdAt: now - 1000 },
    { id: 'm2', kind: '事实', text: '妈妈生日 12 月 3 日，老说肩膀疼，喜欢实用礼物', createdAt: now - 2000 },
    { id: 'm3', kind: '偏好', text: '常去驿站：菜鸟驿站余姚店；不喜欢晚上 10 点后收到提醒', createdAt: now - 3000 },
    { id: 'm4', kind: '收藏', text: '本周收藏 5 条：按摩仪测评、儿童咳嗽清单、杭州周末去处…', createdAt: now - 4000 },
  ]

  const family: Family[] = [
    { id: 'f1', name: '妈妈', relation: '母亲', birthday: '12 月 3 日', note: '老说肩膀疼 · 喜欢实用礼物' },
    { id: 'f2', name: '老婆', relation: '配偶', birthday: '4 月 15 日', note: '不喜欢惊喜，喜欢一起挑' },
    { id: 'f3', name: '孩子', relation: '儿子', birthday: '9 月 8 日', note: '三年级 · 周三要带跳绳' },
  ]

  return {
    user: {
      id: 'local', deviceId: 'local', name: '本机用户', plan: '高级版', timezone: 'Asia/Shanghai',
      briefingTime: '07:30', reviewTime: '21:00', quietStart: '22:00', quietEnd: '07:00',
      reminderStyle: 'standard', createdAt: now,
    },
    stats: {
      weekRate: 78, weekDelta: 12, streak: 12, nextPush: '18:00',
      todayTotal: 4, todayDone: 1, collectionInbox: 4,
    },
    duties,
    messages,
    collections,
    memories,
    family,
    unread: 1,
    today: `${today} ${weekday(today)}`,
    festivals: [],
  }
}
