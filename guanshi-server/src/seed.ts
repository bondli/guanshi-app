import { db } from './db'
import { addDays, atLocal, localDate, newId, now, relativeLabel } from './util'

interface SeedDuty {
  title: string
  type: string
  source: string
  status: 'open' | 'pending' | 'done'
  date: string
  time: string
  timeLabel: string
  sort: number
  origin: string
  quote: string
  rule: string
  confidence?: number
  done?: boolean
}

/** 新用户首次登录时写入一组演示数据，保证开箱就能看到完整体验 */
export function seedUser(userId: string): void {
  const today = localDate()
  const stamp = now()
  const insertDuty = db.prepare(`
    INSERT INTO duties (id,user_id,title,type,source,status,confidence,date,time_label,sort,origin,quote,rule,history,created_at,updated_at,done_at)
    VALUES (@id,@userId,@title,@type,@source,@status,@confidence,@date,@timeLabel,@sort,@origin,@quote,@rule,@history,@createdAt,@updatedAt,@doneAt)
  `)

  const duties: SeedDuty[] = [
    {
      title: '预约年度体检', type: '健康', source: '手动', status: 'done',
      date: today, time: '08:10', timeLabel: '08:10', sort: 810,
      origin: '手动创建 · 昨天 22:14', quote: '你说：这周找时间把体检约了。',
      rule: '手动待办，按你选的时间提醒一次', done: true,
    },
    {
      title: '带跳绳和彩笔去学校', type: '学校', source: '语音', status: 'open',
      date: today, time: '09:00', timeLabel: '09:00 前', sort: 900,
      origin: '语音输入 · 今天 07:12', quote: '孩子说：明天要带三支铅笔和跳绳。',
      rule: '识别为「学校物品」，按当天早上提醒；已完成则不再打扰',
    },
    {
      title: '取快递 · 菜鸟驿站余姚店', type: '快递', source: '短信', status: 'pending',
      date: today, time: '18:00', timeLabel: '18:00 前', sort: 1800,
      origin: '短信 · 1069****8888 · 今天 14:32',
      quote: '【菜鸟驿站】您的包裹已到余姚店，取件码 1-2-345，请于 3 日内领取。',
      rule: '提取到取件码 12345、站点 菜鸟驿站余姚店；今日 18:00 提醒一次，超 48 小时加强',
      confidence: 95,
    },
    {
      title: '给妈妈打个电话', type: '家庭', source: '记忆', status: 'open',
      date: today, time: '20:00', timeLabel: '今晚', sort: 2100,
      origin: '长期记忆 · 妈妈生日 12 月 3 日', quote: '你曾说过：妈妈生日 12 月 3 日，老说肩膀疼。',
      rule: '生日前 3 天提醒一次，当天再提醒一次',
    },
    {
      title: '高铁 杭州东 → 余姚北', type: '行程', source: '周期', status: 'open',
      date: addDays(today, 2), time: '18:00', timeLabel: '周五 18:00', sort: 1800,
      origin: '周期待办 · 每周五', quote: '每周五 杭州 → 余姚北；每周一 余姚北 → 杭州。',
      rule: '提前 3 天提醒订票，提前 1 天未订则升级提醒，当天给车次建议',
    },
    {
      title: '周回顾：本周收藏 5 条', type: '收藏', source: '周期', status: 'open',
      date: addDays(today, 3), time: '21:00', timeLabel: '周日 21:00', sort: 2100,
      origin: '收藏汇总 · 抖音 3 条、微信 2 条', quote: '5 条收藏均未打开，最早一条来自 11 月 18 日。',
      rule: '每周日晚批量回顾，不即时打扰',
    },
    {
      title: '妈妈生日', type: '生日', source: '手动', status: 'open',
      date: addDays(today, 7), time: '12:00', timeLabel: `${addDays(today, 7).slice(5, 7)} 月 ${addDays(today, 7).slice(8)} 日`, sort: 1200,
      origin: '手动录入 · 家人与关系', quote: '妈妈 · 生日 · 老说肩膀疼，喜欢实用礼物。',
      rule: '提前 7 天与当天各提醒一次，附礼物建议',
    },
    {
      title: '元旦 · 给爸妈准备礼物', type: '节日', source: '周期', status: 'open',
      date: addDays(today, 36), time: '12:00', timeLabel: '1 月 1 日', sort: 1200,
      origin: '节日日历 · 元旦 · 距今 36 天', quote: '元旦，提前 14 天进入最佳准备窗口。',
      rule: '提前 14 天提醒准备，提前 3 天再提醒',
    },
  ]

  const ids: string[] = []
  for (const d of duties) {
    const id = newId('d')
    ids.push(id)
    insertDuty.run({
      id,
      userId,
      title: d.title,
      type: d.type,
      source: d.source,
      status: d.status,
      confidence: d.confidence ?? null,
      date: d.date,
      timeLabel: d.timeLabel,
      sort: d.sort,
      origin: d.origin,
      quote: d.quote,
      rule: d.rule,
      history: JSON.stringify([
        { t: relativeLabel(stamp - 3600_000 * 2), s: `${d.source}识别并创建待办` },
      ]),
      createdAt: stamp - 3600_000 * 2,
      updatedAt: stamp,
      doneAt: d.done ? stamp - 1800_000 : null,
    })
  }

  // 对话里落地的那条待办
  const chatDutyId = newId('d')
  insertDuty.run({
    id: chatDutyId,
    userId,
    title: '去淘宝挑按摩仪',
    type: '约定',
    source: '对话',
    status: 'open',
    confidence: null,
    date: addDays(today, 1),
    timeLabel: '明天 10:00',
    sort: 1000,
    origin: '助手对话 · 今天 20:41',
    quote: '你说：行，那提醒我明天去淘宝看看。',
    rule: '从对话补全为：明天 10:00 · 淘宝 · 按摩仪',
    history: JSON.stringify([{ t: relativeLabel(stamp), s: '对话中创建待办' }]),
    createdAt: stamp,
    updatedAt: stamp,
    doneAt: null,
  })

  const insertMessage = db.prepare(`
    INSERT INTO messages (id,user_id,role,text,kind,duty_id,created_at,read)
    VALUES (?,?,?,?,?,?,?,?)
  `)
  const chat: [('me' | 'ai'), string, string | null, string | null][] = [
    ['me', '我妈老说肩膀疼，元旦想送点什么', null, null],
    ['ai', '按摩仪比较稳妥，三五百元就能买到不错的，颈部的更实用一些。', null, null],
    ['ai', '另外一件事：她生日快到了，也快到了，要不要一起准备？', null, null],
    ['me', '行，那提醒我明天去淘宝看看', null, null],
    ['ai', '记下了。明天上午 10:00 提醒你去淘宝挑按摩仪。', 'duty', chatDutyId],
  ]
  chat.forEach(([role, text, kind, dutyId], index) => {
    insertMessage.run(
      newId('m'),
      userId,
      role,
      text,
      kind,
      dutyId,
      stamp - (chat.length - index) * 60_000,
      role === 'me' ? 1 : 0,
    )
  })

  const insertCollection = db.prepare(`
    INSERT INTO collections (id,user_id,type,source,status,title,excerpt,url,note,image_path,meta,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `)
  const collections: [string, string, string, string, string, string, string, string][] = [
    ['link', '抖音', 'inbox', '3 分钟挑对按摩仪，避开这 5 个坑',
      '康复师讲的：看按摩头形状、看力度档位、别买只能捶打的。颈部的选 U 型，肩部选披肩式。',
      'v.douyin.com/iR2x9k', '', '视频 · 02:14'],
    ['link', '微信', 'inbox', '冬天孩子咳嗽，家里该备什么',
      '儿科医生写的清单：生理盐水喷雾、加湿器、退热贴。反复咳嗽超过一周要去医院。',
      'mp.weixin.qq.com/s/8dK2', '问问校医要不要备', '公众号 · 6 分钟'],
    ['link', '小红书', 'inbox', '余姚北站停车攻略：P2 最便宜',
      'P2 停车场一天 20 元，比 P1 便宜一半，走到进站口 5 分钟。周末要早去，10 点后基本满了。',
      'xhslink.com/a/7f3', '', '笔记 · 收藏 1.2 万'],
    ['link', '网页', 'reviewed', '杭州周末去处：良渚古城遗址公园',
      '门票 60，建议上午去，园区很大要坐观光车。适合带孩子看稻田和鹿苑。',
      'www.lzsite.com/visit', '', '网页 · 已回顾'],
    ['link', '抖音', 'inbox', '糖醋排骨的家常做法，不用炒糖色',
      '先煎后焖，冰糖直接下锅，最后收汁。孩子说想吃，周末可以做一次。',
      'v.douyin.com/k9Lm2', '周末做', '视频 · 01:38'],
    ['image', '微信', 'reviewed', '家长会通知截图',
      '周五下午 3 点家长会，带笔和本子，教室在三楼。',
      '', '已加进日历', '图片 · 已回顾'],
  ]
  collections.forEach(([type, source, status, title, excerpt, url, note, meta], index) => {
    insertCollection.run(
      newId('c'), userId, type, source, status, title, excerpt, url, note, null, meta,
      stamp - (index + 1) * 86400_000,
    )
  })

  const insertMemory = db.prepare(
    'INSERT INTO memories (id,user_id,kind,text,created_at) VALUES (?,?,?,?,?)',
  )
  const memories: [string, string][] = [
    ['习惯', '每周一 余姚北 → 杭州，每周五 杭州 → 余姚北'],
    ['事实', '妈妈生日 12 月 3 日，老说肩膀疼，喜欢实用礼物'],
    ['偏好', '常去驿站：菜鸟驿站余姚店；不喜欢晚上 10 点后收到提醒'],
    ['收藏', '本周收藏 5 条：按摩仪测评、儿童咳嗽清单、杭州周末去处…'],
  ]
  memories.forEach(([kind, text], index) => {
    insertMemory.run(newId('m'), userId, kind, text, stamp - index * 60000)
  })

  const insertFamily = db.prepare(
    'INSERT INTO family (id,user_id,name,relation,birthday,note) VALUES (?,?,?,?,?,?)',
  )
  const family: [string, string, string, string][] = [
    ['妈妈', '母亲', '12 月 3 日', '老说肩膀疼 · 喜欢实用礼物'],
    ['老婆', '配偶', '4 月 15 日', '不喜欢惊喜，喜欢一起挑'],
    ['孩子', '儿子', '9 月 8 日', '三年级 · 周三要带跳绳'],
  ]
  family.forEach(([name, relation, birthday, note]) => {
    insertFamily.run(newId('f'), userId, name, relation, birthday, note)
  })

  // 为待确认的快递生成一条待发消息之外的提醒定时器
  const parcelId = ids[2]
  db.prepare(
    'INSERT INTO timers (id,user_id,duty_id,kind,due_at,fired,created_at) VALUES (?,?,?,?,?,0,?)',
  ).run(newId('t'), userId, parcelId, 'remind', atLocal(today, '18:00'), stamp)
}
