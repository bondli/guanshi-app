/* ============================================================
   管事 · 演示数据
   所有内容均为虚构，仅用于交互演示
   ============================================================ */
window.DB = {
  profile: {
    name: "本机用户",
    plan: "高级版",
    joined: "2026 年 8 月",
    model: "deepseek-chat",
    modelLabel: "DeepSeek Chat",
    monthCost: "0.83",
    tokenUsed: 62,
    tokenLimit: 300
  },

  today: { iso: "2026-11-25", label: "11 月 25 日", weekday: "周三" },

  stats: { weekRate: 78, weekDelta: 12, streak: 12, nextPush: "18:00" },

  duties: [
    {
      id: "d0", type: "健康", source: "手动", status: "done",
      title: "预约年度体检", date: "2026-11-25", timeLabel: "08:10", sort: 810,
      origin: "手动创建 · 昨天 22:14",
      quote: "你说：这周找时间把体检约了。",
      rule: "手动待办，按你选的时间提醒一次",
      history: [
        { t: "昨天 22:14", s: "手动创建" },
        { t: "今天 08:10", s: "已提醒，标记完成" }
      ]
    },
    {
      id: "d1", type: "学校", source: "语音", status: "open",
      title: "带跳绳和彩笔去学校", date: "2026-11-25", timeLabel: "09:00 前", sort: 900,
      origin: "语音输入 · 今天 07:12",
      quote: "孩子说：明天要带三支铅笔和跳绳。",
      rule: "识别为「学校物品」，按当天早上提醒；已完成则不再打扰",
      history: [
        { t: "今天 07:12", s: "语音转写并结构化" },
        { t: "今天 07:12", s: "创建待办，设定 09:00 提醒" }
      ]
    },
    {
      id: "d2", type: "快递", source: "短信", status: "pending", confidence: 95,
      title: "取快递 · 菜鸟驿站余姚店", date: "2026-11-25", timeLabel: "18:00 前", sort: 1800,
      origin: "短信 · 1069****8888 · 今天 14:32",
      quote: "【菜鸟驿站】您的包裹已到余姚店，取件码 1-2-345，请于 3 日内领取。",
      rule: "提取到取件码 12345、站点 菜鸟驿站余姚店；今日 18:00 提醒一次，超 48 小时加强",
      history: [
        { t: "今天 14:32", s: "短信到达，本地正则命中取件码" },
        { t: "今天 14:32", s: "生成待确认待办，等待你点头" }
      ]
    },
    {
      id: "d3", type: "生日", source: "周期", status: "open",
      title: "给妈妈打个电话", date: "2026-11-25", timeLabel: "今晚", sort: 2100,
      origin: "长期记忆 · 妈妈生日 12 月 3 日",
      quote: "你曾说过：妈妈生日 12 月 3 日，老说肩膀疼。",
      rule: "生日前 3 天提醒一次，当天再提醒一次",
      history: [
        { t: "今天 09:00", s: "按生日规则生成提醒" }
      ]
    },
    {
      id: "d4", type: "习惯", source: "周期", status: "open",
      title: "高铁 杭州东 → 余姚北", date: "2026-11-27", timeLabel: "周五 18:00", sort: 1800,
      origin: "周期待办 · 每周五",
      quote: "每周五 杭州 → 余姚北；每周一 余姚北 → 杭州。",
      rule: "提前 3 天提醒订票，提前 1 天未订则升级提醒，当天给车次建议",
      history: [
        { t: "周三 12:00", s: "已提醒订票（提前 3 天）" }
      ]
    },
    {
      id: "d5", type: "收藏", source: "周期", status: "open",
      title: "周回顾：本周收藏 5 条", date: "2026-11-29", timeLabel: "周日 21:00", sort: 2100,
      origin: "收藏汇总 · 抖音 3 条、微信 2 条",
      quote: "5 条收藏均未打开，最早一条来自 11 月 18 日。",
      rule: "每周日晚批量回顾，不即时打扰",
      history: []
    },
    {
      id: "d6", type: "生日", source: "手动", status: "open",
      title: "妈妈生日", date: "2026-12-03", timeLabel: "12 月 3 日", sort: 1200,
      origin: "手动录入 · 家人与关系",
      quote: "妈妈 · 12 月 3 日 · 老说肩膀疼，喜欢实用礼物。",
      rule: "提前 7 天与当天各提醒一次，附礼物建议",
      history: []
    },
    {
      id: "d7", type: "节日", source: "周期", status: "open",
      title: "元旦 · 给爸妈准备礼物", date: "2027-01-01", timeLabel: "1 月 1 日", sort: 1200,
      origin: "节日日历 · 元旦 · 距今 37 天",
      quote: "元旦，提前 14 天进入最佳准备窗口。",
      rule: "提前 14 天提醒准备，提前 3 天再提醒",
      history: []
    }
  ],

  family: [
    { id: "f1", name: "妈妈", relation: "母亲", birthday: "12 月 3 日", note: "老说肩膀疼 · 喜欢实用礼物" },
    { id: "f2", name: "老婆", relation: "配偶", birthday: "4 月 15 日", note: "不喜欢惊喜，喜欢一起挑" },
    { id: "f3", name: "孩子", relation: "儿子", birthday: "9 月 8 日", note: "三年级 · 周三要带跳绳" }
  ],

  collections: [
    {
      id: "k1", type: "link", source: "抖音", status: "inbox",
      title: "3 分钟挑对按摩仪，避开这 5 个坑",
      excerpt: "康复师讲的：看按摩头形状、看力度档位、别买只能捶打的。颈部的选 U 型，肩部选披肩式。",
      url: "v.douyin.com/iR2x9k", note: "", createdAt: "2026-11-23", meta: "视频 · 02:14"
    },
    {
      id: "k2", type: "link", source: "微信", status: "inbox",
      title: "冬天孩子咳嗽，家里该备什么",
      excerpt: "儿科医生写的清单：生理盐水喷雾、加湿器、退热贴。反复咳嗽超过一周要去医院。",
      url: "mp.weixin.qq.com/s/8dK2", note: "问问校医要不要备", createdAt: "2026-11-22", meta: "公众号 · 6 分钟"
    },
    {
      id: "k3", type: "link", source: "小红书", status: "inbox",
      title: "余姚北站停车攻略：P2 最便宜",
      excerpt: "P2 停车场一天 20 元，比 P1 便宜一半，走到进站口 5 分钟。周末要早去，10 点后基本满了。",
      url: "xhslink.com/a/7f3", note: "", createdAt: "2026-11-21", meta: "笔记 · 收藏 1.2 万"
    },
    {
      id: "k4", type: "link", source: "网页", status: "reviewed",
      title: "杭州周末去处：良渚古城遗址公园",
      excerpt: "门票 60，建议上午去，园区很大要坐观光车。适合带孩子看稻田和鹿苑。",
      url: "www.lzsite.com/visit", note: "", createdAt: "2026-11-18", meta: "网页 · 已回顾"
    },
    {
      id: "k5", type: "link", source: "抖音", status: "inbox",
      title: "糖醋排骨的家常做法，不用炒糖色",
      excerpt: "先煎后焖，冰糖直接下锅，最后收汁。孩子说想吃，周末可以做一次。",
      url: "v.douyin.com/k9Lm2", note: "周末做", createdAt: "2026-11-16", meta: "视频 · 01:38"
    },
    {
      id: "k6", type: "image", source: "微信", status: "reviewed",
      title: "家长会通知截图",
      excerpt: "周五下午 3 点家长会，带笔和本子，教室在三楼。",
      url: "", note: "已加进日历", createdAt: "2026-11-14", meta: "图片 · 已回顾"
    }
  ],

  memories: [
    { id: "m1", kind: "习惯", text: "每周一 余姚北 → 杭州，每周五 杭州 → 余姚北" },
    { id: "m2", kind: "事实", text: "妈妈生日 12 月 3 日，老说肩膀疼，喜欢实用礼物" },
    { id: "m3", kind: "偏好", text: "常去驿站：菜鸟驿站余姚店；不喜欢晚上 10 点后收到提醒" },
    { id: "m4", kind: "收藏", text: "本周收藏 5 条：按摩仪测评、儿童跳绳选择、杭州周末去处…" }
  ],

  chat: [
    { id: "c1", role: "me", text: "我妈老说肩膀疼，元旦想送点什么" },
    { id: "c2", role: "ai", text: "按摩仪比较稳妥，三五百元就能买到不错的，颈部的更实用一些。" },
    { id: "c3", role: "ai", text: "另外一件事：她生日是 12 月 3 日，也快到了，要不要一起准备？" },
    { id: "c4", role: "me", text: "行，那提醒我明天去淘宝看看" },
    {
      id: "c5", role: "ai",
      text: "记下了。明天上午 10:00 提醒你去淘宝挑按摩仪。",
      duty: {
        id: "cd1", type: "约定", source: "对话", status: "open",
        title: "去淘宝挑按摩仪", date: "2026-11-26", timeLabel: "明天 10:00", sort: 1000,
        origin: "助手对话 · 今天 20:41",
        quote: "你说：行，那提醒我明天去淘宝看看。",
        rule: "从对话补全为：明天 10:00 · 淘宝 · 按摩仪",
        history: [{ t: "今天 20:41", s: "对话中创建待办" }]
      }
    }
  ],

  pushSamples: {
    briefing: {
      title: "今天 3 件事",
      lines: ["09:00 前　带跳绳和彩笔去学校", "18:00 前　取快递（码 12345）", "今晚　　　给妈妈打电话"]
    },
    parcel: {
      title: "快递该取了",
      lines: ["菜鸟驿站余姚店 · 取件码 12345", "包裹今天 14:32 到站，已等 4 小时"]
    },
    review: {
      title: "今天完成 1 / 4",
      lines: ["学校物品、快递、给妈妈打电话还没完成", "本周完成率 78%，比上周高 12%"]
    }
  }
};
