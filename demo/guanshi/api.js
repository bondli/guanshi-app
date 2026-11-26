/* ============================================================
   管事 · 模拟接口层
   真实项目里这里是云端 Agent（pi-agent-core）的 HTTP 调用；
   原型中用定时器模拟网络延迟与流式返回。
   ============================================================ */
window.API = (() => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const uid = () => "id-" + Math.random().toString(36).slice(2, 8);

  /* 对话：根据关键词返回一条回复，必要时附带一条待办 */
  async function chat(text) {
    await wait(700 + Math.random() * 600);

    if (/提醒|记下|别忘了|明天|待办/.test(text)) {
      return {
        id: uid(),
        role: "ai",
        text: "记下了。明天上午 10:00 提醒你，到时会推送到手机，不需要打开 App。",
        duty: {
          id: uid(),
          type: "约定",
          source: "对话",
          status: "open",
          title: text.length > 22 ? text.slice(0, 22) + "…" : text,
          date: "2026-11-26",
          timeLabel: "明天 10:00",
          sort: 1000,
          origin: "助手对话 · 刚刚",
          quote: "你说：" + text,
          rule: "从对话补全为：明天上午 10:00；到点推送，无需打开 App",
          history: [{ t: "刚刚", s: "对话中创建待办" }]
        }
      };
    }

    if (/漏|回顾|本周|完成/.test(text)) {
      return {
        id: uid(),
        role: "ai",
        text: "这周你完成了 8 件，漏掉 2 件：周三的快递、周五的订票。要我把这两件顺延到明天上午吗？"
      };
    }

    if (/每周|每天|习惯/.test(text)) {
      return {
        id: uid(),
        role: "ai",
        text: "好，我按每周重复建。以后提前 3 天提醒你，连续两次忽略会自动降频。",
        duty: {
          id: uid(),
          type: "习惯",
          source: "对话",
          status: "open",
          title: "每周通勤（余姚北 ↔ 杭州）",
          date: "2026-11-27",
          timeLabel: "每周五 18:00",
          sort: 1800,
          origin: "助手对话 · 刚刚",
          quote: "你说：" + text,
          rule: "周期性待办 · 提前 3 天提醒订票",
          history: [{ t: "刚刚", s: "对话中创建周期待办" }]
        }
      };
    }

    if (/礼|送|生日|妈妈|爸爸/.test(text)) {
      return {
        id: uid(),
        role: "ai",
        text: "送礼我给两个方向：实用型可以看按摩仪、护颈枕；仪式感就鲜花加一顿饭。要我提醒你什么时候买吗？"
      };
    }

    return {
      id: uid(),
      role: "ai",
      text: "我在。你可以直接说事，也可以发一张聊天截图，我把它变成待办。"
    };
  }

  /* 截图识别：返回一张“图片消息”和解析出的待办 */
  async function readShot() {
    await wait(1200);
    return {
      message: { id: uid(), role: "me", text: "识别这张截图", shot: true },
      reply: {
        id: uid(),
        role: "ai",
        text: "截图里是和张三的聊天。我理解成：下周三（12 月 3 日）一起吃晚饭。要建待办吗？",
        duty: {
          id: uid(),
          type: "约定",
          source: "截图",
          status: "pending",
          confidence: 92,
          title: "和张三吃晚饭",
          date: "2026-12-03",
          timeLabel: "下周三 19:00", sort: 1900,
          origin: "截图识别 · 刚刚",
          quote: "张三：下周三晚上有空吗？老地方吃个饭。你：好。",
          rule: "从截图中提取到「下周三」「晚饭」；建议 19:00，可改",
          history: [{ t: "刚刚", s: "端侧 OCR 后由云端理解" }]
        }
      }
    };
  }

  /* 模型连通性测试 */
  async function testKey(key) {
    await wait(1100);
    if (!key || key.length < 8) return { ok: false, msg: "Key 太短，至少 8 位" };
    return { ok: true, msg: "连接成功 · 延迟 412ms · deepseek-chat" };
  }

  /* 讯飞语音听写连通性测试 */
  async function testIflytek(cfg) {
    await wait(950);
    if (!cfg.appId || cfg.appId.length < 4) return { ok: false, msg: "请先填写讯飞 AppID" };
    if (!cfg.apiKey || cfg.apiKey.length < 8) return { ok: false, msg: "APIKey 不完整" };
    return {
      ok: true,
      msg: cfg.mode === "offline"
        ? "连接成功 · 离线听写包已授权 · 首次加载 6.2s"
        : "连接成功 · 在线听写 · 延迟 268ms"
    };
  }

  return { chat, readShot, testKey, testIflytek, wait };
})();
