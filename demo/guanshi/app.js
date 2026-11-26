/* ============================================================
   管事 · 高保真交互原型
   纯静态：无外部依赖、可离线打开；数据全部来自 mock.js
   ============================================================ */
(() => {
  "use strict";

  const DB = window.DB;
  const API = window.API;

  /* ---------- 图标（Lucide 风格，内联 SVG） ---------- */

  const ICONS = {
    "calendar-check": '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/>',
    list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
    message: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-4.2-1.1L3 20l1.3-4.4A8.4 8.4 0 1 1 21 11.5Z"/><path d="M8 11h.01"/><path d="M12 11h.01"/><path d="M16 11h.01"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10.3 21a2 2 0 0 0 3.4 0"/>',
    settings: '<path d="M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.3a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4a2 2 0 0 0 .7 2.7l.2.1a2 2 0 0 1 1 1.7v.5a2 2 0 0 1-1 1.7l-.2.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.3a2 2 0 0 1 1 1.7v.2a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.3a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.7v-.5a2 2 0 0 1 1-1.7l.2-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.3a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
    mic: '<path d="M12 19v3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><rect width="6" height="13" x="9" y="2" rx="3"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    "chevron-right": '<path d="m9 18 6-6-6-6"/>',
    "chevron-left": '<path d="m15 18-6-6 6-6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    package: '<path d="M21 8v8l-9 5-9-5V8l9-5 9 5Z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/>',
    sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>',
    cloud: '<path d="M17.5 19H7a5 5 0 0 1-.9-9.9A6 6 0 0 1 17.7 10a4.5 4.5 0 0 1-.2 9Z"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.9 4.9 1.4 1.4"/><path d="m17.7 17.7 1.4 1.4"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.3 17.7-1.4 1.4"/><path d="m19.1 4.9-1.4 1.4"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/>',
    brain: '<path d="M12 5a3 3 0 1 0-5.9.8A3 3 0 0 0 4 9a3 3 0 0 0 .5 5.4A3 3 0 0 0 8 19a3 3 0 0 0 4 .5V5Z"/><path d="M12 5a3 3 0 1 1 5.9.8A3 3 0 0 1 20 9a3 3 0 0 1-.5 5.4A3 3 0 0 1 16 19a3 3 0 0 1-4 .5V5Z"/>',
    refresh: '<path d="M3 12a9 9 0 1 0 9-9 9.8 9.8 0 0 0-6.7 2.7L3 8"/><path d="M3 3v5h5"/>',
    alert: '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    "arrow-right": '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
    zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z"/>'
  };

  const icon = (name, size = 18, cls = "") =>
    `<svg class="icon ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;

  /* ---------- 工具 ---------- */

  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const uid = () => "id-" + Math.random().toString(36).slice(2, 8);

  const PAGE_TITLES = {
    settings: "提醒设置",
    family: "家人与关系",
    memories: "长期记忆",
    model: "大模型接入",
    voice: "语音听写",
    theme: "外观",
    privacy: "数据与隐私"
  };

  /* ---------- 状态 ---------- */

  const S = {
    tab: "today",
    subpage: null,
    sheet: null,
    dialog: null,
    push: null,
    toast: null,
    toastAction: null,
    theme: "light",
    allView: "list",
    filter: "全部",
    calDay: "2026-11-25",
    query: "",
    searchOpen: false,
    messages: [],
    chatLoading: false,
    voice: null,
    onboard: null,
    modelTest: null,
    apiKey: "sk-••••••••••••4f2a",
    style: "standard",
    iflytek: { mode: "online", appId: "", apiKey: "", apiSecret: "" },
    voiceTest: null,
    dutyForm: { title: "", type: "约定", when: "今天 18:00" },
    rev: 0,
    jumpBottom: false,
    unread: false,
    highlight: null,
    colFilter: "全部",
    colQuery: "",
    colSearchOpen: false
  };

  DB.chat.forEach((m) => {
    if (m.duty && !DB.duties.some((d) => d.id === m.duty.id)) DB.duties.push(m.duty);
  });
  S.messages = JSON.parse(JSON.stringify(DB.chat));

  const deviceEl = document.getElementById("device");
  const scrollEl = document.getElementById("screen-scroll");
  const bottomEl = document.getElementById("bottom-slot");
  const overlayEl = document.getElementById("overlay-root");

  let toastTimer = null;
  let pushTimer = null;
  let lastBase = "";

  const darkMq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : { matches: false, addEventListener() {} };
  const resolvedTheme = () => (S.theme === "system" ? (darkMq.matches ? "dark" : "light") : S.theme);
  function applyTheme() {
    deviceEl.dataset.theme = resolvedTheme();
  }
  darkMq.addEventListener?.("change", () => { if (S.theme === "system") { applyTheme(); render(); } });

  /* ---------- 选择器 ---------- */

  const byDate = (iso) => DB.duties.filter((d) => d.date === iso);
  const todayList = () => byDate(DB.today.iso);
  const openToday = () => todayList().filter((d) => d.status === "open");
  const doneToday = () => todayList().filter((d) => d.status === "done");
  const pendingList = () => DB.duties.filter((d) => d.status === "pending");
  const attention = () => todayList().filter((d) => d.status !== "done").length;
  const activeCount = () => DB.duties.filter((d) => d.status !== "done").length;

  function bucketOf(d) {
    if (d.date === "2026-11-25") return 0;
    if (d.date === "2026-11-26") return 1;
    if (d.date >= "2026-11-27" && d.date <= "2026-11-30") return 2;
    return 3;
  }
  const BUCKETS = ["今天", "明天", "本周剩余", "更远"];

  /* ---------- 首页 ---------- */

  function todayScreen() {
    const total = todayList().length;
    const done = doneToday().length;
    const att = attention();
    const pct = total ? done / total : 0;
    const circ = 2 * Math.PI * 27;
    const pending = pendingList();
    const open = openToday().slice().sort((a, b) => a.sort - b.sort);
    const tomorrow = byDate("2026-11-26");

    return `
      <header class="page-head">
        <div class="head-left">
          <img class="brand-mark" src="assets/app-icon.png" alt="管事">
          <p class="head-date">${DB.today.label} · ${DB.today.weekday}</p>
        </div>
        <div style="display:flex;gap:8px">
          <button class="icon-btn" data-action="push-demo" data-kind="briefing" aria-label="查看晨报推送">${icon("bell", 19)}</button>
          <button class="icon-btn plain" data-action="subpage" data-page="settings" aria-label="提醒设置">${icon("settings", 19)}</button>
        </div>
      </header>

      <section class="hero">
        <div class="hero-top">
          <span>今日待办</span>
          <span class="badge">云端已就绪</span>
        </div>
        <div class="hero-body">
          <div>
            <div class="hero-num"><b>${att}</b><span>件待处理</span></div>
            <p class="hero-sub">已完成 ${done} / ${total} · 下次提醒 ${DB.stats.nextPush}</p>
          </div>
          <svg class="ring" viewBox="0 0 64 64" aria-hidden="true">
            <circle class="ring-track" cx="32" cy="32" r="27"/>
            <circle class="ring-bar" cx="32" cy="32" r="27"
              stroke-dasharray="${circ.toFixed(1)}"
              stroke-dashoffset="${(circ * (1 - pct)).toFixed(1)}"/>
          </svg>
        </div>
        <div class="hero-stats">
          <div><span>本周完成率</span><b>${DB.stats.weekRate}%</b></div>
          <div><span>连续记录</span><b>${DB.stats.streak} 天</b></div>
          <div><span>收藏待回顾</span><b>5 条</b></div>
        </div>
      </section>

      <div class="quick-grid">
        <button class="quick-item" data-action="quick-voice">
          <span class="quick-ico brand">${icon("mic", 16)}</span>说一句
        </button>
        <button class="quick-item" data-action="quick-shot">
          <span class="quick-ico">${icon("camera", 16)}</span>发截图
        </button>
        <button class="quick-item" data-action="sheet-new">
          <span class="quick-ico">${icon("plus", 16)}</span>加待办
        </button>
        <button class="quick-item" data-action="sheet-review">
          <span class="quick-ico">${icon("clock", 16)}</span>看复盘
        </button>
      </div>

      ${pending.length ? `
        <div class="section-head">
          <h2>待确认</h2>
          <span class="count">${pending.length} 条 · 来自短信识别</span>
        </div>
        ${pending.map(pendingCard).join("")}
      ` : ""}

      <div class="section-head">
        <h2>待办</h2>
        <button data-action="tab" data-tab="all">全部 ${activeCount()} 件</button>
      </div>
      ${open.length ? `<div class="duty-list">${open.map(dutyRow).join("")}</div>` : `
        <div class="card">
          <div class="empty-state">
            <strong>今天没有待办了</strong>
            <span>说一句话，或者把截图发给我。</span>
          </div>
        </div>`}

      ${done.length ? `
        <div class="section-head">
          <h2>已完成</h2>
          <span class="count">${done.length} 件</span>
        </div>
        <div class="duty-list">${done.map(dutyRow).join("")}</div>
      ` : ""}

      <div class="section-head"><h2>明天</h2><span class="count">${tomorrow.length} 件</span></div>
      ${tomorrow.length ? tomorrow.map((d) => `
        <button class="preview-card" data-action="open-duty" data-id="${d.id}" style="width:100%;text-align:left">
          <span class="preview-ico">${icon("calendar-check", 16)}</span>
          <span class="preview-main">
            <b>${esc(d.title)}</b>
            <span>${esc(d.timeLabel)} · ${esc(d.type)} · 来源 ${esc(d.source)}</span>
          </span>
          <span class="duty-chev">${icon("chevron-right", 15)}</span>
        </button>
      `).join("") : `<div class="preview-card">
          <span class="preview-ico">${icon("calendar-check", 16)}</span>
          <span class="preview-main"><b>明天还没有安排</b><span>今晚复盘时可以顺手规划</span></span>
        </div>`}

      <div class="cloud-note">
        ${icon("cloud", 15)}
        <span>这些提醒由云端发起。即使你现在杀掉 App，18:00 的快递提醒照样会到。</span>
      </div>
    `;
  }

  function dutyRow(d) {
    const done = d.status === "done";
    return `<div class="duty-item${done ? " done" : ""}" data-action="open-duty" data-id="${d.id}">
      <button class="duty-check${done ? " on" : ""}" data-action="toggle-done" data-id="${d.id}" aria-label="标记完成">
        ${icon("check", 12)}
      </button>
      <div class="duty-main" data-action="open-duty" data-id="${d.id}" role="button" tabindex="0">
        <div class="duty-title">${esc(d.title)}</div>
        <div class="duty-meta">
          <span class="duty-time">${esc(d.timeLabel)}</span>
          <i></i><span>${esc(d.type)}</span>
          <i></i><span>${esc(d.source)}</span>
        </div>
      </div>
      <button class="duty-chev" data-action="open-duty" data-id="${d.id}" aria-label="查看详情" style="border:0;background:none;padding:0">
        ${icon("chevron-right", 15)}
      </button>
    </div>`;
  }

  function pendingCard(d) {
    return `<div class="pending-card" style="margin-bottom:8px">
      <div class="pending-top">
        <span class="badge badge-brand">${esc(d.type)}</span>
        <span class="badge">${esc(d.source)}</span>
        <span class="badge badge-ai">${icon("sparkles", 10)} AI ${d.confidence}%</span>
      </div>
      <p class="pending-title">${esc(d.title)}</p>
      <p class="pending-note">菜鸟驿站余姚店 · 取件码 12345<br>${esc(d.origin)}</p>
      <div class="pending-actions">
        <button class="btn btn-outline btn-sm" data-action="open-duty" data-id="${d.id}">查看原文</button>
        <button class="btn btn-primary btn-sm" data-action="confirm-duty" data-id="${d.id}">确认</button>
        <button class="btn btn-ghost btn-sm" data-action="reject-duty" data-id="${d.id}">不是我的</button>
      </div>
    </div>`;
  }

  /* ---------- 全部 ---------- */

  function filteredDuties() {
    let list = DB.duties.slice();
    if (S.filter !== "全部") list = list.filter((d) => d.type === S.filter);
    const q = S.query.trim();
    if (q) list = list.filter((d) => `${d.title}${d.type}${d.origin}`.includes(q));
    list.sort((a, b) => (a.date === b.date ? a.sort - b.sort : a.date.localeCompare(b.date)));
    return list;
  }

  function allScreen() {
    const list = filteredDuties();

    return `
      <header class="page-head">
        <div>
          <h1 class="page-title">清单</h1>
          <p class="page-sub">${activeCount()} 件进行中 · 共 ${DB.duties.length} 件</p>
        </div>
        <button class="icon-btn" data-action="search-toggle" aria-label="搜索">${icon("search", 19)}</button>
      </header>

      <div class="seg">
        <button class="${S.allView === "list" ? "active" : ""}" data-action="seg-view" data-value="list">列表</button>
        <button class="${S.allView === "cal" ? "active" : ""}" data-action="seg-view" data-value="cal">日历</button>
      </div>

      ${S.searchOpen && S.allView === "list" ? `<div class="card" style="padding:0 12px;margin-bottom:10px;display:flex;align-items:center;gap:8px;height:44px">
        ${icon("search", 16)}
        <input class="composer-input" id="search-input" style="border:0;background:transparent;height:40px;padding:0" placeholder="搜待办、类型或来源" value="${esc(S.query)}" />
        <button class="icon-btn plain" data-action="search-toggle" aria-label="收起" style="width:28px;height:28px">${icon("x", 15)}</button>
      </div>` : ""}

      ${S.allView === "list"
        ? `${chipRow()}<div id="all-results">${groupedList(list)}</div>`
        : `${calendarHTML()}${calDayList()}`}
    `;
  }

  function chipRow() {
    const types = ["全部", "快递", "约定", "生日", "节日", "习惯", "学校", "收藏"];
    return `<div class="chip-row">${types
      .map((t) => `<button class="chip ${S.filter === t ? "active" : ""}" data-action="filter" data-value="${t}">${t}</button>`)
      .join("")}</div>`;
  }

  function groupedList(list) {
    if (!list.length) {
      return `<div class="card"><div class="empty-state"><strong>没有匹配的待办</strong><span>换个筛选条件试试。</span></div></div>`;
    }
    let html = "";
    [0, 1, 2, 3].forEach((b) => {
      const items = list.filter((d) => bucketOf(d) === b);
      if (!items.length) return;
      html += `<div class="group-label">${BUCKETS[b]}</div><div class="duty-list">${items.map(dutyRow).join("")}</div>`;
    });
    return html;
  }

  function calendarHTML() {
    const first = new Date(2026, 10, 1).getDay();
    const days = new Date(2026, 11, 0).getDate();
    let cells = "";
    for (let i = 0; i < first; i++) cells += `<span class="cal-cell empty"></span>`;
    for (let d = 1; d <= days; d++) {
      const iso = `2026-11-${String(d).padStart(2, "0")}`;
      const count = byDate(iso).length;
      const cls = ["cal-cell"];
      if (iso === DB.today.iso) cls.push("today");
      if (iso === S.calDay) cls.push("sel");
      cells += `<button class="${cls.join(" ")}" data-action="cal-day" data-date="${iso}">
        ${d}${count ? `<span class="cal-dot"></span>` : ""}
      </button>`;
    }
    return `<div class="calendar">
      <div class="month-row" style="padding:0 2px 10px"><h2>2026 年 11 月</h2><span>${activeCount()} 件进行中</span></div>
      <div class="cal-head">${["日", "一", "二", "三", "四", "五", "六"].map((w) => `<span>${w}</span>`).join("")}</div>
      <div class="cal-grid">${cells}</div>
    </div>`;
  }

  function calDayList() {
    const list = byDate(S.calDay).sort((a, b) => a.sort - b.sort);
    const label = S.calDay.slice(5).replace("-", " 月 ") + " 日";
    if (!list.length) {
      return `<div class="group-label">${label}</div><div class="card"><div class="empty-state"><strong>这一天是空的</strong><span>点右上角加一件，或者换个日期。</span></div></div>`;
    }
    return `<div class="group-label">${label}</div><div class="duty-list">${list.map(dutyRow).join("")}</div>`;
  }

  /* ---------- 收藏 ---------- */

  const SRC_GLYPH = { 抖音: "抖", 微信: "微", 小红书: "红", 网页: "网" };

  function favList() {
    let list = DB.collections.slice();
    if (S.colFilter === "待回顾") list = list.filter((c) => c.status === "inbox");
    else if (S.colFilter === "已回顾") list = list.filter((c) => c.status !== "inbox");
    else if (["抖音", "微信", "小红书", "网页"].includes(S.colFilter)) {
      list = list.filter((c) => c.source === S.colFilter);
    }
    const q = S.colQuery.trim();
    if (q) list = list.filter((c) => `${c.title}${c.excerpt}${c.note}`.includes(q));
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  function collectionRow(c) {
    const reviewed = c.status !== "inbox";
    return `<button class="collection-item${reviewed ? " reviewed" : ""}" data-action="collection-open" data-id="${c.id}">
      <span class="collection-thumb">${SRC_GLYPH[c.source] || "藏"}</span>
      <span class="collection-main">
        <span class="collection-title">${esc(c.title)}</span>
        <span class="collection-meta">${esc(c.source)}<i></i>${esc(c.meta)}<i></i>${esc(c.createdAt.slice(5).replace("-", " 月 "))} 日</span>
        ${c.note ? `<span class="collection-note">备注：${esc(c.note)}</span>` : ""}
      </span>
      ${reviewed ? `<span class="badge">已回顾</span>` : `<span class="badge badge-brand">待回顾</span>`}
    </button>`;
  }

  function favScreen() {
    const all = DB.collections;
    const inbox = all.filter((c) => c.status === "inbox").length;
    const list = favList();
    const filters = ["全部", "待回顾", "已回顾", "抖音", "微信", "小红书", "网页"];

    return `
      <header class="page-head">
        <div>
          <h1 class="page-title">收藏</h1>
          <p class="page-sub">${all.length} 条 · ${inbox} 条待回顾 · 周日 21:00 提醒回顾</p>
        </div>
        <div style="display:flex;gap:8px">
          <button class="icon-btn" data-action="share-sim" aria-label="模拟一次分享">${icon("plus", 19)}</button>
          <button class="icon-btn plain" data-action="col-search-toggle" aria-label="搜索收藏">${icon("search", 19)}</button>
        </div>
      </header>

      ${S.colSearchOpen ? `<div class="card" style="padding:0 12px;margin-bottom:10px;display:flex;align-items:center;gap:8px;height:44px">
        ${icon("search", 16)}
        <input class="composer-input" id="col-search" style="border:0;background:transparent;height:40px;padding:0" placeholder="搜标题、摘要或备注" value="${esc(S.colQuery)}" />
        <button class="icon-btn plain" data-action="col-search-toggle" aria-label="收起" style="width:28px;height:28px">${icon("x", 15)}</button>
      </div>` : ""}

      <div class="share-hint">
        <span class="share-hint-ico">${icon("arrow-right", 16)}</span>
        <span class="share-hint-main">
          <b>在微信、抖音里点「分享」→ 管事</b>
          <span>链接、图片、文字都能收进来，不用复制粘贴</span>
        </span>
        <button class="btn btn-outline btn-sm" data-action="toast" data-text="已打开系统分享设置（演示）">去设置</button>
      </div>

      <div class="chip-row" style="margin-top:12px">
        ${filters.map((f) => `<button class="chip ${S.colFilter === f ? "active" : ""}" data-action="col-filter" data-value="${f}">${f}</button>`).join("")}
      </div>

      <div id="col-results">
        ${list.length
          ? `<div class="collection-list">${list.map(collectionRow).join("")}</div>`
          : `<div class="card"><div class="empty-state"><strong>这里还没有收藏</strong><span>在微信或抖音里点「分享」，选择管事。</span></div></div>`}
      </div>
    `;
  }

  /* ---------- 助手 ---------- */

  function chatScreen() {
    return `
      <div class="chat-intro">
        <img class="brand-mark" src="assets/app-icon.png" alt="管事">
        <div>
          <b>管事</b>
          <span>记得妈妈生日，也记得每周五的车</span>
        </div>
        <button class="icon-btn plain" style="margin-left:auto" data-action="chat-clear" aria-label="清空对话">${icon("trash", 17)}</button>
      </div>

      <div class="messages">
        ${S.messages.map(msgHTML).join("")}
        ${S.chatLoading ? `<div class="msg ai"><div class="bubble typing"><i></i><i></i><i></i></div></div>` : ""}
      </div>

      <div class="quick-chips">
        <button class="chip" data-action="chat-quick" data-text="提醒我明天买一束花">提醒我明天买花</button>
        <button class="chip" data-action="chat-quick" data-text="我每周一都要去杭州上班">每周通勤</button>
        <button class="chip" data-action="chat-quick" data-text="这周我漏了什么">本周回顾</button>
      </div>
    `;
  }

  function msgHTML(m) {
    const flash = S.highlight === m.id ? " flash" : "";
    if (m.role === "me") {
      const body = m.shot
        ? `<div class="shot"><div class="shot-lines"><i></i><i style="width:78%"></i><i style="width:52%"></i></div></div>`
        : `<div class="bubble">${esc(m.text)}</div>`;
      return `<div class="msg me">${body}</div>`;
    }
    let card = "";
    if (m.kind === "briefing") card = briefingCard();
    else if (m.kind === "review") card = reviewCard();
    else if (m.duty) card = dutyCardMsg(m.duty, m.kind === "duty" ? "done" : "edit");

    return `<div class="msg ai${flash}">
      <span class="msg-who">管事</span>
      <div class="bubble">${esc(m.text)}</div>
      ${card}
    </div>`;
  }

  function dutyCardMsg(d, variant = "edit") {
    if (!d) return "";
    let actions;
    if (variant === "done") {
      actions = d.status === "done"
        ? `<span class="badge badge-ok">已完成，不再提醒</span>
           <button class="btn btn-outline btn-sm" data-action="open-duty" data-id="${d.id}">看原文</button>`
        : `<button class="btn btn-primary btn-sm" data-action="toggle-done" data-id="${d.id}">已完成</button>
           <button class="btn btn-outline btn-sm" data-action="snooze" data-id="${d.id}">明天</button>`;
    } else {
      actions = `<button class="btn btn-primary btn-sm" data-action="open-duty" data-id="${d.id}">看详情</button>
                 <button class="btn btn-outline btn-sm" data-action="chat-edit" data-id="${d.id}">改时间</button>`;
    }
    return `<div class="duty-inline">
      <div class="duty-inline-head">${icon("sparkles", 14)}${esc(d.title)}</div>
      <div class="duty-inline-meta">${esc(d.timeLabel)} · 来源 ${esc(d.source)}<br>${esc(d.rule)}</div>
      <div class="duty-inline-actions">${actions}</div>
    </div>`;
  }

  function briefingCard() {
    const list = todayList().filter((d) => d.status !== "done");
    const rows = list.map((d) => `<div class="chat-list-row">
      <button class="duty-check" data-action="toggle-done" data-id="${d.id}" aria-label="标记完成">${icon("check", 12)}</button>
      <span class="chat-list-main"><b>${esc(d.title)}</b><small>${esc(d.timeLabel)} · ${esc(d.type)}</small></span>
    </div>`).join("");
    return `<div class="chat-card">
      <div class="chat-card-head">${icon("calendar-check", 14)}今天 ${list.length} 件事</div>
      ${list.length ? `<div class="chat-list">${rows}</div>` : `<div class="chat-list-empty">今天都做完了。</div>`}
      <div class="chat-card-actions">
        <button class="btn btn-primary btn-sm" data-action="complete-all">全部完成</button>
        <button class="btn btn-outline btn-sm" data-action="tab" data-tab="today">看今日清单</button>
      </div>
    </div>`;
  }

  function reviewCard() {
    const list = todayList();
    const done = list.filter((d) => d.status === "done").length;
    const rows = list.map((d) => `<div class="chat-list-row">
      <span class="chat-list-state">${icon(d.status === "done" ? "check" : "clock", 13)}</span>
      <span class="chat-list-main"><b style="${d.status === "done" ? "color:var(--muted-2);text-decoration:line-through" : ""}">${esc(d.title)}</b></span>
      ${d.status === "done" ? "" : `<button class="btn btn-outline btn-sm" data-action="snooze" data-id="${d.id}">明天</button>`}
    </div>`).join("");
    return `<div class="chat-card">
      <div class="chat-card-head">${icon("clock", 14)}今天完成 ${done} / ${list.length}</div>
      <div class="chat-list">${rows}</div>
      <div class="chat-card-actions">
        <button class="btn btn-outline btn-sm" data-action="tab" data-tab="today">看今日清单</button>
        <button class="btn btn-primary btn-sm" data-action="open-review">完整复盘</button>
      </div>
    </div>`;
  }

  function composerHTML() {
    return `<div class="composer">
      <button class="icon-btn plain" data-action="quick-voice" aria-label="语音输入">${icon("mic", 19)}</button>
      <input class="composer-input" id="chat-input" placeholder="说一句，比如「提醒我明天买花」" />
      <button class="icon-btn plain" data-action="quick-shot" aria-label="发送截图">${icon("camera", 19)}</button>
      <button class="send-btn" data-action="chat-send" aria-label="发送">${icon("send", 16)}</button>
    </div>`;
  }

  /* ---------- 我的 ---------- */

  function meScreen() {
    return `
      <header class="page-head">
        <div>
          <h1 class="page-title">设置</h1>
        </div>
        <button class="icon-btn" data-action="onboard" aria-label="首次引导">${icon("sparkles", 18)}</button>
      </header>

      <div class="me-head">
        <div class="avatar">我</div>
        <div>
          <div class="me-name">${esc(DB.profile.name)}</div>
          <div class="me-sub">
            <span class="badge badge-brand">${esc(DB.profile.plan)}</span>
            <span>已开启云端同步 · ${esc(DB.profile.joined)}加入</span>
          </div>
        </div>
      </div>

      <div class="sub-section">提醒与节奏</div>
      <div class="list-card">
        ${row("bell", "提醒频率", "由云端在最佳时机提醒", `<span class="row-val">标准</span>${icon("chevron-right", 15)}`, `data-action="subpage" data-page="settings"`, "brand")}
        ${row("clock", "每日晨报", "每天一次，汇总今天要做的事", `<span class="row-val mono">07:30</span>${icon("chevron-right", 15)}`, `data-action="subpage" data-page="settings"`)}
        ${row("moon", "免打扰", "22:00 - 07:00 不推送", `<button class="switch on" data-action="toggle" data-key="quiet" aria-label="免打扰"></button>`)}
      </div>

      <div class="sub-section">数据来源</div>
      <div class="list-card">
        ${row("message", "短信", "自动识别快递与取件码，原文不出本机", `<button class="switch on" data-action="toggle" data-key="sms" aria-label="短信"></button>`)}
        ${row("bell", "通知", "从微信、电商通知里发现事项", `<button class="switch on" data-action="toggle" data-key="notify" aria-label="通知"></button>`)}
        ${row("mic", "语音与截图", "只上传转写后的文字", `<button class="switch on" data-action="toggle" data-key="voice" aria-label="语音与截图"></button>`)}
      </div>

      <div class="sub-section">记忆</div>
      <div class="list-card">
        ${row("users", "家人与关系", "3 位家人 · 生日与偏好", `${icon("chevron-right", 15)}`, `data-action="subpage" data-page="family"`)}
        ${row("brain", "长期记忆", "4 条事实与偏好", `${icon("chevron-right", 15)}`, `data-action="subpage" data-page="memories"`)}
      </div>

      <div class="sub-section">模型与语音</div>
      <div class="list-card">
        ${row("key", "大模型接入", `本月用量 ¥${DB.profile.monthCost} · 仅用于理解`, `<span class="row-val">${esc(DB.profile.modelLabel)}</span>${icon("chevron-right", 15)}`, `data-action="subpage" data-page="model"`, "brand")}
        ${row("mic", "语音听写 · 讯飞", "音频只到讯飞，不经过我们", `<span class="row-val">${S.iflytek.appId ? "已配置" : "未配置"}</span>${icon("chevron-right", 15)}`, `data-action="subpage" data-page="voice"`)}
      </div>

      <div class="sub-section">其他</div>
      <div class="list-card">
        ${row("sun", "外观", "亮色 · 暗色 · 跟随系统", `<span class="row-val">${S.theme === "dark" ? "暗色" : S.theme === "system" ? "跟随系统" : "亮色"}</span>${icon("chevron-right", 15)}`, `data-action="subpage" data-page="theme"`)}
        ${row("shield", "保活设置", "关闭电池优化，提醒更可靠", `${icon("chevron-right", 15)}`, `data-action="toast" data-text="已为你打开系统保活引导"`)}
        ${row("download", "数据导出与删除", "你随时可以带走或清空", `${icon("chevron-right", 15)}`, `data-action="subpage" data-page="privacy"`)}
      </div>
    `;
  }

  function row(iconName, title, desc, right, attrs = "", tone = "") {
    const tag = attrs.includes("data-action") ? "button" : "div";
    return `<${tag} class="row" ${attrs}>
      <span class="row-ico ${tone}">${icon(iconName, 16)}</span>
      <span class="row-main">
        <span class="row-title">${title}</span>
        ${desc ? `<span class="row-desc">${desc}</span>` : ""}
      </span>
      ${right || ""}
    </${tag}>`;
  }

  /* ---------- 子页 ---------- */

  function subHead(title) {
    return `<div class="sub-head">
      <button class="icon-btn plain" data-action="back" aria-label="返回" style="width:34px;height:34px">${icon("chevron-left", 19)}</button>
      <h2>${esc(title)}</h2>
    </div>`;
  }

  const SUBPAGES = {
    settings() {
      return `
        <div class="sub-section">提醒频率</div>
        <div class="seg" style="margin-bottom:12px">
          ${[["quiet", "安静"], ["standard", "标准"], ["active", "主动"]]
            .map(([v, l]) => `<button class="${S.style === v || (!S.style && v === "standard") ? "active" : ""}" data-action="style" data-value="${v}">${l}</button>`)
            .join("")}
        </div>
        <div class="form-card">
          <div class="form-row"><span>每日晨报</span><input class="form-input" value="07:30" readonly /></div>
          <div class="form-row"><span>晚间复盘</span><input class="form-input" value="21:00" readonly /></div>
          <div class="form-row"><span>免打扰</span><input class="form-input" value="22:00 - 07:00" readonly /></div>
        </div>
        <p class="form-note">安静：只在临期提醒一次。标准：前 3 天温和、前 1 天明确、当天强提醒。主动：进入最佳窗口就提醒，并每 12 小时跟进一次。</p>
        <div class="sub-section">云端行为</div>
        <div class="list-card">
          ${row("cloud", "杀 App 仍可提醒", "推送走厂商通道，不依赖 App 进程", `<button class="switch on" data-action="toggle" data-key="cloudpush" aria-label="云端推送"></button>`)}
          ${row("refresh", "批量合并提醒", "同一天多件事合成一条推送", `<button class="switch on" data-action="toggle" data-key="merge" aria-label="合并"></button>`)}
        </div>
      `;
    },

    family() {
      return `
        <div class="sub-section">家人</div>
        <div class="list-card">
          ${DB.family.map((f) => `<div class="family-item">
            <div class="family-avatar">${esc(f.name.slice(0, 1))}</div>
            <div class="family-main">
              <b>${esc(f.name)} · ${esc(f.relation)}</b>
              <span>生日 ${esc(f.birthday)} · ${esc(f.note)}</span>
            </div>
            ${icon("chevron-right", 15)}
          </div>`).join("")}
        </div>
        <p class="form-note">生日会自动生成周期待办，提前 7 天与当天各提醒一次。你可以直接对我说「我妈生日 12 月 3 日」来添加。</p>
        <button class="btn btn-outline btn-block" style="margin-top:14px" data-action="toast" data-text="对助手说一句就能添加家人">添加家人</button>
      `;
    },

    memories() {
      return `
        <div class="sub-section">记住的事</div>
        <div class="list-card">
          ${DB.memories.map((m) => `<div class="row">
            <span class="row-ico">${icon("brain", 16)}</span>
            <span class="row-main">
              <span class="row-title">${esc(m.text)}</span>
              <span class="row-desc">类型：${esc(m.kind)}</span>
            </span>
            <button class="icon-btn plain" data-action="forget" data-id="${m.id}" aria-label="忘记这条" style="width:30px;height:30px">${icon("x", 14)}</button>
          </div>`).join("")}
        </div>
        <p class="form-note">记忆只在需要时被检索，不会整段塞进模型。删除后不影响已创建的待办。</p>
      `;
    },

    model() {
      const testing = S.modelTest === "loading";
      return `
        <div class="sub-section">服务商</div>
        <div class="list-card">
          ${[["deepseek", "DeepSeek Chat", "便宜、快，适合识别与日常对话"],
             ["qwen", "通义千问 Plus", "中文理解好，长文本更稳"],
             ["claude", "Claude Sonnet", "复杂约定与多步推理"]]
            .map(([k, name, desc]) => {
              const on = (DB.profile.model || "deepseek") === k;
              return `<button class="model-item ${on ? "on" : ""}" data-action="pick-model" data-value="${k}">
              <span class="dot"></span>
              <span class="m"><b>${name}</b><small>${desc}</small></span>
              ${on ? `<span class="badge badge-brand">当前</span>` : ""}
            </button>`;
            }).join("")}
        </div>

        <div class="sub-section">API Key</div>
        <div class="form-card">
          <div class="form-row"><span>密钥</span><input class="form-input" id="api-key" value="${esc(S.apiKey)}" /></div>
        </div>
        <p class="form-note">Key 加密存放在服务端，只用于转发调用。你也可以完全关闭 AI 功能，退化成纯规则提醒。</p>

        <button class="btn btn-outline btn-block" style="margin-top:14px" data-action="model-test">
          ${testing ? "测试中…" : "测试连接"}
        </button>
        ${S.modelTest && S.modelTest !== "loading"
          ? `<div class="cloud-note" style="margin-top:12px;color:${S.modelTest.ok ? "var(--ok)" : "var(--danger)"}">
              ${icon(S.modelTest.ok ? "check" : "alert", 15)}<span>${esc(S.modelTest.msg)}</span>
            </div>`
          : ""}

        <div class="sub-section">本月用量</div>
        <div class="list-card">
          <div class="row" style="display:block">
            <div style="display:flex;justify-content:space-between;align-items:baseline">
              <span class="row-title">¥${DB.profile.monthCost} / 约 ¥2.00</span>
              <span class="row-desc">${DB.profile.tokenUsed} 万 tokens</span>
            </div>
            <div class="usage-bar"><i style="width:${Math.round((DB.profile.tokenUsed / DB.profile.tokenLimit) * 100)}%"></i></div>
            <div class="row-desc" style="margin-top:8px">规则与模板承担了大部分工作，模型只负责理解自然语言。</div>
          </div>
        </div>
      `;
    },

    voice() {
      const t = S.voiceTest;
      return `
        <div class="sub-section">接入方式</div>
        <div class="seg" style="margin-bottom:12px">
          <button class="${S.iflytek.mode === "online" ? "active" : ""}" data-action="iflytek-mode" data-value="online">在线听写</button>
          <button class="${S.iflytek.mode === "offline" ? "active" : ""}" data-action="iflytek-mode" data-value="offline">离线听写</button>
        </div>

        <div class="sub-section">讯飞开放平台</div>
        <div class="form-card">
          <div class="form-row"><span>AppID</span><input class="form-input" id="iflytek-appid" placeholder="讯飞控制台的 AppID" value="${esc(S.iflytek.appId)}" /></div>
          <div class="form-row"><span>APIKey</span><input class="form-input" id="iflytek-apikey" placeholder="32 位 APIKey" value="${esc(S.iflytek.apiKey)}" /></div>
          <div class="form-row"><span>APISecret</span><input class="form-input" id="iflytek-secret" placeholder="32 位 APISecret" value="${esc(S.iflytek.apiSecret)}" /></div>
        </div>
        <p class="form-note">讯飞只负责把语音转成文字，文本随后交给云端 Agent 理解。在线模式的音频只发往讯飞，离线包完全不出设备；录音不落盘。</p>

        <button class="btn btn-outline btn-block" style="margin-top:14px" data-action="iflytek-test">
          ${t === "loading" ? "测试中…" : "测试连接"}
        </button>
        ${t && t !== "loading"
          ? `<div class="cloud-note" style="margin-top:12px;color:${t.ok ? "var(--ok)" : "var(--danger)"}">
              ${icon(t.ok ? "check" : "alert", 15)}<span>${esc(t.msg)}</span>
            </div>`
          : ""}

        <div class="sub-section">运行说明</div>
        <div class="kv-card">
          <div class="kv"><span>单次时长</span><b>60 秒，超出自动分段</b></div>
          <div class="kv"><span>失败兜底</span><b>切换系统语音识别</b></div>
          <div class="kv"><span>离线包</span><b>${S.iflytek.mode === "offline" ? "已启用 · 约 18MB" : "未启用"}</b></div>
        </div>
      `;
    },

    theme() {
      const opts = [["light", "亮色", "暖纸底，适合白天"], ["dark", "暗色", "低亮度，夜里更舒服"], ["system", "跟随系统", "随手机自动切换"]];
      return `
        <div class="sub-section">外观</div>
        <div class="list-card">
          ${opts.map(([v, name, desc]) => `<button class="row" data-action="theme-set" data-value="${v}">
            <span class="row-ico ${S.theme === v ? "brand" : ""}">${icon(v === "dark" ? "moon" : v === "system" ? "refresh" : "sun", 16)}</span>
            <span class="row-main">
              <span class="row-title">${name}</span>
              <span class="row-desc">${desc}</span>
            </span>
            ${S.theme === v ? `<span class="badge badge-brand">已选</span>` : ""}
          </button>`).join("")}
        </div>
        <p class="form-note">深浅色使用同一套语义色，强调色在暗色下会自动提亮，保证对比度。</p>
      `;
    },

    privacy() {
      return `
        <div class="sub-section">数据分級</div>
        <div class="list-card">
          ${row("shield", "短信原文", "只在手机本地解析，不上传", `<span class="badge">不出本机</span>`)}
          ${row("camera", "图片", "本地 OCR，原图不上传", `<span class="badge">不出本机</span>`)}
          ${row("mic", "语音", "在线听写发往讯飞；离线包不出设备", `<span class="badge">按需</span>`)}
          ${row("cloud", "待办摘要", "加密传输，用于云端调度", `<span class="badge badge-brand">已加密</span>`)}
        </div>
        <p class="form-note">没有自建模型，也就没有我们能看到的聊天内容。模型调用只发送理解所需的必要文本。</p>
        <div class="sub-section">操作</div>
        <div style="display:grid;gap:9px">
          <button class="btn btn-outline btn-block" data-action="toast" data-text="已生成导出文件（演示）">导出全部数据</button>
          <button class="btn btn-ghost btn-block" style="color:var(--danger)" data-action="dialog-delete">清空云端数据</button>
        </div>
      `;
    }
  };

  /* ---------- 弹层 ---------- */

  function overlayHTML() {
    let html = "";
    if (S.push) html += pushHTML();
    if (S.sheet) html += sheetHTML();
    if (S.dialog) html += dialogHTML();
    if (S.voice) html += voiceHTML();
    if (S.onboard !== null) html += onboardHTML();
    if (S.toast) html += toastHTML();
    return html;
  }

  function pushHTML() {
    const p = DB.pushSamples[S.push.kind] || DB.pushSamples.briefing;
    return `<div class="push" data-action="push-open">
      <div class="push-top">
        <span class="push-mark">管</span>
        <span class="app-name">管事</span>
        <span>· 现在</span>
        <button class="icon-btn plain" style="margin-left:auto;width:22px;height:22px" data-action="push-close" aria-label="关闭">${icon("x", 13)}</button>
      </div>
      <div class="push-title">${esc(p.title)}</div>
      <div class="push-lines">${p.lines.map(esc).join("<br>")}</div>
      <div class="push-acts">
        <button class="btn btn-primary btn-sm" data-action="push-open">打开</button>
        <button class="btn btn-outline btn-sm" data-action="push-read">全部已读</button>
      </div>
    </div>`;
  }

  function sheetHTML() {
    const s = S.sheet;
    if (s.kind === "duty") return dutySheet(s.id);
    if (s.kind === "new") return newSheet();
    if (s.kind === "briefing") return briefingSheet();
    if (s.kind === "review") return reviewSheet();
    if (s.kind === "collection") return collectionSheet(s.id);
    return "";
  }

  function collectionSheet(id) {
    const c = DB.collections.find((x) => x.id === id);
    if (!c) return "";
    const reviewed = c.status !== "inbox";
    return `<div class="backdrop" data-action="close"></div>
      <div class="sheet">
        <div class="sheet-grip"></div>
        <div class="sheet-head">
          <div>
            <h3>${esc(c.title)}</h3>
            <p class="sheet-sub">${esc(c.source)} · ${esc(c.meta)} · 收藏于 ${esc(c.createdAt)}</p>
          </div>
          <button class="icon-btn plain" data-action="close" aria-label="关闭" style="width:30px;height:30px">${icon("x", 16)}</button>
        </div>

        <div class="badge-row">
          <span class="badge badge-brand">${esc(c.source)}</span>
          <span class="badge">${c.type === "image" ? "图片" : c.type === "text" ? "文字" : "链接"}</span>
          ${reviewed ? `<span class="badge">已回顾</span>` : `<span class="badge badge-brand">待回顾</span>`}
        </div>

        <p class="sheet-label">摘要</p>
        <blockquote class="quote">${esc(c.excerpt || "这条收藏还没有摘要。")}</blockquote>

        ${c.note ? `<p class="sheet-label">我的备注</p><p class="sheet-text">${esc(c.note)}</p>` : ""}
        ${c.url ? `<p class="sheet-label">原链接</p><p class="sheet-text" style="word-break:break-all">${esc(c.url)}</p>` : ""}

        <div class="sheet-actions">
          ${reviewed
            ? `<button class="btn btn-outline" data-action="collection-delete" data-id="${c.id}">删除</button>`
            : `<button class="btn btn-outline" data-action="collection-review" data-id="${c.id}">标记已回顾</button>`}
          <button class="btn btn-primary" data-action="collection-to-duty" data-id="${c.id}">转成待办</button>
        </div>
      </div>`;
  }

  function dutySheet(id) {
    const d = DB.duties.find((x) => x.id === id);
    if (!d) return "";
    const done = d.status === "done";
    const pending = d.status === "pending";
    return `<div class="backdrop" data-action="close"></div>
      <div class="sheet">
        <div class="sheet-grip"></div>
        <div class="sheet-head">
          <div>
            <h3>${esc(d.title)}</h3>
            <p class="sheet-sub">${esc(d.timeLabel)} · ${esc(d.type)} · 来源 ${esc(d.source)}</p>
          </div>
          <button class="icon-btn plain" data-action="close" aria-label="关闭" style="width:30px;height:30px">${icon("x", 16)}</button>
        </div>

        <div class="badge-row">
          <span class="badge badge-brand">${esc(d.type)}</span>
          <span class="badge">${esc(d.source)}</span>
          ${pending ? `<span class="badge badge-ai">${icon("sparkles", 10)} AI ${d.confidence}%</span>` : ""}
          ${done ? `<span class="badge badge-ok">已完成</span>` : ""}
        </div>

        <div class="kv-card">
          <div class="kv"><span>时间</span><b>${esc(d.timeLabel)}</b></div>
          <div class="kv"><span>状态</span><b>${done ? "已完成" : pending ? "待确认" : "进行中"}</b></div>
          <div class="kv"><span>来源</span><b style="font-size:11.5px">${esc(d.origin)}</b></div>
        </div>

        <p class="sheet-label">来源原文</p>
        <blockquote class="quote">${esc(d.quote)}</blockquote>

        <p class="sheet-label">识别依据</p>
        <p class="sheet-text">${esc(d.rule)}</p>

        <p class="sheet-label">提醒记录</p>
        <ul class="timeline">
          ${(d.history && d.history.length ? d.history : [{ t: "—", s: "暂无提醒记录" }])
            .map((h) => `<li><b>${esc(h.t)}</b><span>${esc(h.s)}</span></li>`).join("")}
        </ul>

        <div class="sheet-actions">
          ${pending
            ? `<button class="btn btn-outline" data-action="reject-duty" data-id="${d.id}">不是我的</button>
               <button class="btn btn-primary" data-action="confirm-duty" data-id="${d.id}">确认加入</button>`
            : done
              ? `<button class="btn btn-outline" data-action="toggle-done" data-id="${d.id}">标记未完成</button>
                 <button class="btn btn-primary" data-action="close">关闭</button>`
              : `<button class="btn btn-outline" data-action="snooze" data-id="${d.id}">明天提醒</button>
                 <button class="btn btn-primary" data-action="toggle-done" data-id="${d.id}">已完成</button>`}
        </div>
      </div>`;
  }

  function newSheet() {
    const types = ["约定", "快递", "生日", "节日", "习惯", "学校", "收藏"];
    const times = ["今天 18:00", "明天 10:00", "周日 21:00"];
    return `<div class="backdrop" data-action="close"></div>
      <div class="sheet">
        <div class="sheet-grip"></div>
        <div class="sheet-head">
          <div><h3>新建待办</h3><p class="sheet-sub">说清楚要做什么，剩下的交给云端</p></div>
          <button class="icon-btn plain" data-action="close" aria-label="关闭" style="width:30px;height:30px">${icon("x", 16)}</button>
        </div>

        <input class="field" id="new-title" placeholder="例如：周五前把车票订了" value="${esc(S.dutyForm.title)}" />

        <p class="sheet-label">类型</p>
        <div class="type-row">
          ${types.map((t) => `<button class="chip ${S.dutyForm.type === t ? "active" : ""}" data-action="form-type" data-value="${t}">${t}</button>`).join("")}
        </div>

        <p class="sheet-label">什么时候</p>
        <div class="time-row">
          ${times.map((t) => `<button class="chip ${S.dutyForm.when === t ? "active" : ""}" data-action="form-when" data-value="${t}">${t}</button>`).join("")}
        </div>

        <div class="sheet-actions">
          <button class="btn btn-outline" data-action="close">取消</button>
          <button class="btn btn-primary" data-action="save-duty">保存</button>
        </div>
      </div>`;
  }

  function briefingSheet() {
    const list = todayList().filter((d) => d.status !== "done");
    return `<div class="backdrop" data-action="close"></div>
      <div class="sheet">
        <div class="sheet-grip"></div>
        <div class="sheet-head">
          <div><h3>今天 ${list.length} 件事</h3><p class="sheet-sub">晨报 · 07:30 由云端推送</p></div>
          <button class="icon-btn plain" data-action="close" aria-label="关闭" style="width:30px;height:30px">${icon("x", 16)}</button>
        </div>
        ${list.length ? `<div class="duty-list">${list.map(dutyRow).join("")}</div>`
          : `<div class="card"><div class="empty-state"><strong>今天都做完了</strong><span>晚上复盘时见。</span></div></div>`}
        <div class="sheet-actions">
          <button class="btn btn-outline" data-action="close">稍后</button>
          <button class="btn btn-primary" data-action="complete-all">全部完成</button>
        </div>
      </div>`;
  }

  function reviewSheet() {
    const list = todayList();
    const done = list.filter((d) => d.status === "done").length;
    return `<div class="backdrop" data-action="close"></div>
      <div class="sheet">
        <div class="sheet-grip"></div>
        <div class="sheet-head">
          <div><h3>今天完成 ${done} / ${list.length}</h3><p class="sheet-sub">${DB.today.label} · ${DB.today.weekday} · 21:00 复盘</p></div>
          <button class="icon-btn plain" data-action="close" aria-label="关闭" style="width:30px;height:30px">${icon("x", 16)}</button>
        </div>

        <div class="list-card" style="margin-bottom:14px">
          ${list.map((d) => `<div class="row" style="align-items:center">
            <span class="row-ico ${d.status === "done" ? "brand" : ""}" style="width:28px;height:28px">${icon(d.status === "done" ? "check" : "clock", 14)}</span>
            <span class="row-main"><span class="row-title" style="${d.status === "done" ? "color:var(--muted-2);text-decoration:line-through" : ""}">${esc(d.title)}</span></span>
            ${d.status === "done" ? "" : `<button class="btn btn-outline btn-sm" data-action="snooze" data-id="${d.id}">明天</button>`}
          </div>`).join("")}
        </div>

        <div class="kv-card">
          <div class="kv"><span>本周完成率</span><b style="color:var(--brand)">${DB.stats.weekRate}%　+${DB.stats.weekDelta}%</b></div>
          <div class="kv"><span>连续记录</span><b>${DB.stats.streak} 天</b></div>
          <div class="kv"><span>漏掉但已顺延</span><b>2 件</b></div>
        </div>

        <div class="sheet-actions">
          <button class="btn btn-outline" data-action="close">关闭</button>
          <button class="btn btn-primary" data-action="push-demo" data-kind="review">预览推送</button>
        </div>
      </div>`;
  }

  function dialogHTML() {
    return `<div class="backdrop" data-action="close"></div>
      <div class="dialog-wrap">
        <div class="dialog">
          <h3>清空云端数据？</h3>
          <p>待办、记忆与对话记录都会被删除。手机本地保留的短信与截图不受影响，删除后无法恢复。</p>
          <div class="dialog-actions">
            <button class="btn btn-outline" data-action="close">取消</button>
            <button class="btn btn-danger" data-action="confirm-delete">确认清空</button>
          </div>
        </div>
      </div>`;
  }

  function voiceHTML() {
    const phase = S.voice.phase;
    return `<div class="voice">
      <div class="voice-card">
        ${phase === "listen" ? `
          <div class="voice-orb">${icon("mic", 30)}</div>
          <div class="voice-title">正在聆听</div>
          <p class="voice-sub">比如：提醒我明天去买一束花</p>
          <div class="wave">${Array.from({ length: 11 }, (_, i) => `<i style="animation-delay:${(i * 0.08).toFixed(2)}s"></i>`).join("")}</div>
          <div class="voice-actions">
            <button class="btn btn-outline" data-action="voice-close">取消</button>
            <button class="btn btn-primary" data-action="voice-finish">说完了</button>
          </div>
        ` : `
          <div class="voice-title">听清了</div>
          <p class="voice-sub">确认后我会建成待办，或者直接发到对话里</p>
          <div class="voice-result">${esc(S.voice.text)}</div>
          <div class="voice-actions">
            <button class="btn btn-outline" data-action="voice-again">重说</button>
            <button class="btn btn-primary" data-action="voice-use">就这样</button>
          </div>
        `}
      </div>
    </div>`;
  }

  function onboardHTML() {
    const step = S.onboard;

    const art0 = `
      <div class="onboard-art">
        <div class="art-row">
          <span class="row-ico brand">${icon("message", 16)}</span>
          <span style="flex:1"><strong>短信里有一条快递</strong><small>菜鸟驿站 · 取件码 12345</small></span>
          <span class="badge badge-ai">已识别</span>
        </div>
        <div class="art-row">
          <span class="row-ico">${icon("clock", 16)}</span>
          <span style="flex:1"><strong>傍晚 18:00 提醒你</strong><small>不需要打开 App</small></span>
        </div>
        <div class="art-preview"><span>本周完成率</span><b>78%</b></div>
      </div>`;

    const art1 = `
      <div class="onboard-art tight">
        <div class="art-row" style="padding:12px 0;border-bottom:1px solid var(--border)">
          <span class="row-ico brand">${icon("message", 16)}</span>
          <span style="flex:1"><strong>短信</strong><small>识别快递与取件码，原文不出本机</small></span>
          <button class="btn btn-outline btn-sm" data-action="perm-allow" data-name="短信">允许</button>
        </div>
        <div class="art-row" style="padding:12px 0;border-bottom:1px solid var(--border)">
          <span class="row-ico brand">${icon("bell", 16)}</span>
          <span style="flex:1"><strong>通知</strong><small>从微信与电商里发现事项</small></span>
          <button class="btn btn-outline btn-sm" data-action="perm-allow" data-name="通知">允许</button>
        </div>
        <div class="art-row" style="padding:12px 0">
          <span class="row-ico brand">${icon("mic", 16)}</span>
          <span style="flex:1"><strong>麦克风</strong><small>说一句就能建待办</small></span>
          <button class="btn btn-outline btn-sm" data-action="perm-allow" data-name="麦克风">允许</button>
        </div>
      </div>`;

    const art2 = `
      <div class="onboard-art">
        <div class="art-row">
          <span class="row-ico brand">${icon("cloud", 16)}</span>
          <span style="flex:1"><strong>云端 Agent 一直醒着</strong><small>你关掉 App，它照样在跑</small></span>
          <span class="badge badge-ok">在线</span>
        </div>
        <div class="art-row">
          <span class="row-ico">${icon("zap", 16)}</span>
          <span style="flex:1"><strong>厂商推送通道</strong><small>不依赖进程存活</small></span>
        </div>
        <div class="art-row">
          <span class="row-ico">${icon("shield", 16)}</span>
          <span style="flex:1"><strong>本地兜底提醒</strong><small>断网也能响</small></span>
        </div>
        <div class="art-preview"><span>下一个提醒</span><b>18:00 · 快递</b></div>
      </div>`;

    const copy = [
      { h: "你只需要顺手，剩下的它来", p: "截图、短信、说一句话，任何入口都能变成待办。它记得住，也会在对的时间提醒你。" },
      { h: "给三个权限，它才看得见", p: "短信用来识别快递，通知用来发现约定，麦克风用来听你说话。短信和通知只在本机解析。" },
      { h: "它住在云端，所以更可靠", p: "提醒不依赖 App 是否运行。早上有晨报，晚上有复盘，中间有该来的提醒。" }
    ][step];

    return `<div class="onboard">
      <div class="onboard-top">
        <img class="brand-mark" src="assets/app-icon.png" alt="管事">
        <button class="icon-btn plain" data-action="onboard-skip" aria-label="跳过">${icon("x", 18)}</button>
      </div>
      ${[art0, art1, art2][step]}
      <div class="onboard-copy"><h2>${copy.h}</h2><p>${copy.p}</p></div>
      <div class="onboard-foot">
        <div class="dots">${[0, 1, 2].map((i) => `<span class="dot-i ${i === step ? "active" : ""}"></span>`).join("")}</div>
        <div class="onboard-actions">
          ${step > 0 ? `<button class="btn btn-outline" data-action="onboard-prev">上一步</button>` : ""}
          <button class="btn btn-primary" data-action="onboard-next">${step === 2 ? "开始使用" : "继续"}</button>
        </div>
      </div>
    </div>`;
  }

  function toastHTML() {
    return `<div class="toast" role="status">
      <span>${esc(S.toast.text)}</span>
      ${S.toast.actionLabel ? `<button class="toast-action" data-action="toast-action">${esc(S.toast.actionLabel)}</button>` : ""}
    </div>`;
  }

  /* ---------- 渲染 ---------- */

  function render() {
    const base = S.subpage ? "sub:" + S.subpage : S.tab;
    const prevTop = scrollEl.scrollTop;
    const changedBase = base !== lastBase;

    document.body.classList.toggle("subpage-open", !!S.subpage);

    if (S.subpage) {
      scrollEl.innerHTML = subHead(PAGE_TITLES[S.subpage] || "") + (SUBPAGES[S.subpage] ? SUBPAGES[S.subpage]() : "");
      bottomEl.innerHTML = "";
    } else if (S.tab === "today") {
      scrollEl.innerHTML = todayScreen();
      bottomEl.innerHTML = "";
    } else if (S.tab === "all") {
      scrollEl.innerHTML = allScreen();
      bottomEl.innerHTML = "";
    } else if (S.tab === "chat") {
      scrollEl.innerHTML = chatScreen();
      bottomEl.innerHTML = composerHTML();
    } else if (S.tab === "fav") {
      scrollEl.innerHTML = favScreen();
      bottomEl.innerHTML = "";
    } else {
      scrollEl.innerHTML = meScreen();
      bottomEl.innerHTML = "";
    }

    document.querySelectorAll(".tab").forEach((tab) => {
      const on = !S.subpage && tab.dataset.tab === S.tab;
      tab.classList.toggle("active", on);
      if (on) tab.setAttribute("aria-current", "page");
      else tab.removeAttribute("aria-current");
    });

    overlayEl.innerHTML = overlayHTML();

    const dot = document.getElementById("chat-dot");
    if (dot) dot.classList.toggle("on", S.unread);

    if (changedBase) scrollEl.scrollTop = 0;
    else if (S.jumpBottom) scrollEl.scrollTop = scrollEl.scrollHeight;
    else scrollEl.scrollTop = prevTop;

    S.jumpBottom = false;
    lastBase = base;
    applyTheme();
  }

  /* ---------- 反馈 ---------- */

  function toast(text, actionLabel, action, ms = 4200) {
    S.toast = { text, actionLabel: actionLabel || "" };
    S.toastAction = action || null;
    render();
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      S.toast = null;
      S.toastAction = null;
      render();
    }, ms);
  }

  function showPush(kind) {
    S.push = { kind };
    S.unread = true;
    render();
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      if (S.push) { S.push = null; render(); }
    }, 9000);
  }

  /* 一条推送 = 助手的一次发言；已存在则复用，不重复刷屏 */
  function pushMessageFor(kind) {
    const existing = S.messages.find((m) => m.pushKind === kind);
    if (existing) return existing;

    const base = { id: uid(), role: "ai", pushKind: kind };
    let msg;
    if (kind === "review") {
      msg = Object.assign(base, { kind: "review", text: "今天先到这里。还有几件没做完，要不要顺延到明天？" });
    } else if (kind === "parcel") {
      msg = Object.assign(base, {
        kind: "duty",
        duty: DB.duties.find((d) => d.id === "d2"),
        text: "快递到驿站了：菜鸟驿站余姚店，取件码 12345。晚点我再提醒你一次。"
      });
    } else {
      msg = Object.assign(base, { kind: "briefing", text: "早上好。今天的事我按时间排好了，你看一眼。" });
    }
    S.messages.push(msg);
    return msg;
  }

  /* ---------- 业务动作 ---------- */

  function sendChat(text) {
    const val = (text || "").trim();
    if (!val || S.chatLoading) return;
    S.messages.push({ id: uid(), role: "me", text: val });
    S.chatLoading = true;
    S.jumpBottom = true;
    S.rev++;
    render();

    API.chat(val).then((reply) => {
      S.chatLoading = false;
      S.messages.push(reply);
      if (reply.duty) DB.duties.push(reply.duty);
      S.jumpBottom = true;
      S.rev++;
      render();
      if (reply.duty) toast("已建成待办", "查看", () => openDuty(reply.duty.id));
    });
  }

  function sendShot() {
    if (S.chatLoading) return;
    S.tab = "chat";
    S.subpage = null;
    S.messages.push({ id: uid(), role: "me", text: "", shot: true });
    S.chatLoading = true;
    S.jumpBottom = true;
    S.rev++;
    render();

    API.readShot().then((res) => {
      S.chatLoading = false;
      S.messages.push(res.reply);
      if (res.reply.duty) DB.duties.push(res.reply.duty);
      S.jumpBottom = true;
      S.rev++;
      render();
      toast("识别完成，待你确认", "去确认", () => openDuty(res.reply.duty.id));
    });
  }

  function openDuty(id) {
    S.sheet = { kind: "duty", id };
    render();
  }

  function toggleDone(id) {
    const d = DB.duties.find((x) => x.id === id);
    if (!d) return;
    const prev = d.status;
    d.status = prev === "done" ? "open" : "done";
    if (S.sheet) S.sheet = null;
    S.rev++;
    render();
    toast(prev === "done" ? "已恢复为未完成" : "已完成", "撤销", () => {
      d.status = prev;
      S.rev++;
      render();
    });
  }

  function confirmDuty(id) {
    const d = DB.duties.find((x) => x.id === id);
    if (!d) return;
    d.status = "open";
    if (S.sheet) S.sheet = null;
    S.rev++;
    render();
    toast("已加入今日待办", "撤销", () => {
      d.status = "pending";
      S.rev++;
      render();
    });
  }

  function rejectDuty(id) {
    const i = DB.duties.findIndex((x) => x.id === id);
    if (i < 0) return;
    const removed = DB.duties.splice(i, 1)[0];
    if (S.sheet) S.sheet = null;
    S.rev++;
    render();
    toast("已忽略，这类识别会降低权重", "撤销", () => {
      DB.duties.splice(i, 0, removed);
      S.rev++;
      render();
    });
  }

  function saveDuty() {
    const input = document.getElementById("new-title");
    const title = (input ? input.value : S.dutyForm.title || "").trim();
    if (!title) {
      toast("先写一句要做什么");
      return;
    }
    const when = S.dutyForm.when;
    const date = when.includes("明天") ? "2026-11-26" : when.includes("周日") ? "2026-11-29" : "2026-11-25";
    const duty = {
      id: uid(),
      type: S.dutyForm.type,
      source: "手动",
      status: "open",
      title,
      date,
      timeLabel: when,
      sort: Number(when.replace(/\D/g, "")) || 1800,
      origin: "手动创建 · 刚刚",
      quote: "你写：" + title,
      rule: "手动待办，按你选的时间提醒一次",
      history: [{ t: "刚刚", s: "手动创建" }]
    };
    DB.duties.push(duty);
    S.sheet = null;
    S.dutyForm = { title: "", type: "约定", when: "今天 18:00" };
    S.rev++;
    render();
    toast("已创建，到点提醒你", "查看", () => openDuty(duty.id));
  }

  /* ---------- 动作表 ---------- */

  const ACTIONS = {
    tab(el) {
      S.tab = el.dataset.tab;
      S.subpage = null;
      S.searchOpen = false;
      if (S.tab === "chat") S.unread = false;
      if (S.tab === "chat") S.jumpBottom = true;
      render();
    },

    subpage(el) {
      S.subpage = el.dataset.page;
      render();
    },

    back() {
      S.subpage = null;
      render();
    },

    "open-duty"(el) {
      if (S.sheet && S.sheet.kind === "duty" && S.sheet.id === el.dataset.id) return;
      openDuty(el.dataset.id);
    },

    "toggle-done"(el) {
      toggleDone(el.dataset.id);
    },

    "confirm-duty"(el) {
      confirmDuty(el.dataset.id);
    },

    "reject-duty"(el) {
      rejectDuty(el.dataset.id);
    },

    "sheet-new"() {
      S.sheet = { kind: "new" };
      render();
    },

    "sheet-briefing"() {
      S.sheet = { kind: "briefing" };
      render();
    },

    "sheet-review"() {
      S.sheet = { kind: "review" };
      render();
    },

    "open-review"() {
      S.sheet = { kind: "review" };
      render();
    },

    "collection-open"(el) {
      S.sheet = { kind: "collection", id: el.dataset.id };
      render();
    },

    "col-filter"(el) {
      S.colFilter = el.dataset.value;
      render();
    },

    "col-search-toggle"() {
      S.colSearchOpen = !S.colSearchOpen;
      if (!S.colSearchOpen) S.colQuery = "";
      render();
      if (S.colSearchOpen) setTimeout(() => document.getElementById("col-search")?.focus(), 30);
    },

    "collection-review"(el) {
      const c = DB.collections.find((x) => x.id === el.dataset.id);
      if (!c) return;
      c.status = "reviewed";
      S.sheet = null;
      render();
      toast("已标记回顾", "撤销", () => {
        c.status = "inbox";
        render();
      });
    },

    "collection-delete"(el) {
      const i = DB.collections.findIndex((x) => x.id === el.dataset.id);
      if (i < 0) return;
      const removed = DB.collections.splice(i, 1)[0];
      S.sheet = null;
      render();
      toast("已删除", "撤销", () => {
        DB.collections.splice(i, 0, removed);
        render();
      });
    },

    "collection-to-duty"(el) {
      const c = DB.collections.find((x) => x.id === el.dataset.id);
      if (!c) return;
      const duty = {
        id: uid(),
        type: "收藏",
        source: "收藏",
        status: "open",
        title: c.title.length > 20 ? c.title.slice(0, 20) + "…" : c.title,
        date: "2026-11-26",
        timeLabel: "明天 10:00",
        sort: 1000,
        origin: `收藏 · ${c.source} · ${c.createdAt}`,
        quote: c.excerpt || c.title,
        rule: "从收藏转成待办，按明天上午 10:00 提醒",
        history: [{ t: "刚刚", s: "从收藏创建" }]
      };
      DB.duties.push(duty);
      c.status = "reviewed";
      S.sheet = null;
      S.rev++;
      render();
      toast("已转成待办：明天 10:00", "查看", () => openDuty(duty.id));
    },

    "share-sim"() {
      const samples = [
        { type: "link", source: "抖音", title: "肩颈僵？每天 5 分钟做这 3 个动作", excerpt: "康复师演示：收下巴、靠墙站、开肩。久坐的人每天做一轮。", url: "v.douyin.com/9k2x", meta: "视频 · 02:41" },
        { type: "link", source: "微信", title: "给孩子挑跳绳，别只看长度", excerpt: "体重 40 公斤以下选 4.5 米，手柄要防滑。体育老师写的。", url: "mp.weixin.qq.com/s/2kL9", meta: "公众号 · 4 分钟" },
        { type: "link", source: "小红书", title: "余姚北站附近 3 家早餐店", excerpt: "出站右转 200 米，豆浆现磨的那家最好吃。", url: "xhslink.com/a/1k9", meta: "笔记 · 收藏 3400" }
      ];
      const pick = samples[Math.floor(Math.random() * samples.length)];
      const item = Object.assign({}, pick, {
        id: uid(),
        note: "",
        status: "inbox",
        createdAt: "2026-11-25"
      });
      DB.collections.unshift(item);
      S.rev++;
      render();
      toast("已收藏 · 周日回顾时提醒你", "查看", () => {
        S.tab = "fav";
        S.sheet = { kind: "collection", id: item.id };
        S.rev++;
        render();
      });
    },

    close() {
      S.sheet = null;
      S.dialog = null;
      render();
    },

    "form-type"(el) {
      const input = document.getElementById("new-title");
      if (input) S.dutyForm.title = input.value;
      S.dutyForm.type = el.dataset.value;
      render();
    },

    "form-when"(el) {
      const input = document.getElementById("new-title");
      if (input) S.dutyForm.title = input.value;
      S.dutyForm.when = el.dataset.value;
      render();
    },

    "save-duty"() {
      saveDuty();
    },

    "complete-all"() {
      todayList().forEach((d) => { if (d.status !== "done") d.status = "done"; });
      S.sheet = null;
      S.rev++;
      render();
      toast("今天全部完成", "撤销", () => {
        todayList().forEach((d) => { if (d.id !== "d0") d.status = d.id === "d2" ? "pending" : "open"; });
        S.rev++;
        render();
      });
    },

    snooze(el) {
      const d = DB.duties.find((x) => x.id === el.dataset.id);
      if (!d) return;
      d.date = "2026-11-26";
      d.timeLabel = "明天 10:00";
      S.sheet = null;
      S.rev++;
      render();
      toast("已顺延到明天上午");
    },

    "chat-send"() {
      const input = document.getElementById("chat-input");
      const text = input ? input.value : "";
      if (input) input.value = "";
      sendChat(text);
    },

    "chat-quick"(el) {
      sendChat(el.dataset.text);
    },

    "chat-clear"() {
      S.messages = [];
      S.rev++;
      render();
      toast("对话已清空", "撤销", () => {
        S.messages = JSON.parse(JSON.stringify(DB.chat));
        S.rev++;
        render();
      });
    },

    "chat-edit"() {
      toast("可以直接说一个新的时间");
    },

    "quick-voice"() {
      S.voice = { phase: "listen", text: "" };
      render();
    },

    "voice-finish"() {
      S.voice = { phase: "result", text: "提醒我明天买一束花" };
      render();
    },

    "voice-again"() {
      S.voice = { phase: "listen", text: "" };
      render();
    },

    "voice-close"() {
      S.voice = null;
      render();
    },

    "voice-use"() {
      const text = S.voice ? S.voice.text : "";
      S.voice = null;
      S.tab = "chat";
      S.subpage = null;
      render();
      sendChat(text);
    },

    "quick-shot"() {
      sendShot();
    },

    "push-demo"(el) {
      S.sheet = null;
      showPush(el.dataset.kind || "briefing");
    },

    "push-open"() {
      const kind = S.push ? S.push.kind : "briefing";
      S.push = null;
      S.sheet = null;
      S.subpage = null;
      S.tab = "chat";
      S.unread = false;
      const msg = pushMessageFor(kind);
      S.highlight = msg.id;
      S.jumpBottom = true;
      S.rev++;
      render();
      setTimeout(() => {
        const el = document.querySelector(".msg.flash");
        if (el) el.classList.remove("flash");
        S.highlight = null;
      }, 2600);
    },

    "push-read"() {
      S.push = null;
      S.unread = false;
      render();
      toast("已标记已读");
    },

    "push-close"() {
      S.push = null;
      render();
    },

    "seg-view"(el) {
      S.allView = el.dataset.value;
      render();
    },

    filter(el) {
      S.filter = el.dataset.value;
      render();
    },

    "cal-day"(el) {
      S.calDay = el.dataset.date;
      render();
    },

    "search-toggle"() {
      S.searchOpen = !S.searchOpen;
      if (!S.searchOpen) S.query = "";
      render();
      if (S.searchOpen) setTimeout(() => document.getElementById("search-input")?.focus(), 30);
    },

    "toast"(el) {
      toast(el.dataset.text || "已完成");
    },

    toggle(el) {
      el.classList.toggle("on");
      toast(el.classList.contains("on") ? "已开启" : "已关闭");
    },

    style(el) {
      S.style = el.dataset.value;
      render();
      toast(el.textContent === "安静" ? "只在临期提醒一次" : el.textContent === "主动" ? "进入最佳窗口就开始提醒" : "前 3 天温和，前 1 天明确");
    },

    "theme-set"(el) {
      S.theme = el.dataset.value;
      render();
      toast("外观已切换");
    },

    theme() {
      const order = ["light", "dark", "system"];
      S.theme = order[(order.indexOf(S.theme) + 1) % 3];
      render();
      toast("外观：" + (S.theme === "dark" ? "暗色" : S.theme === "system" ? "跟随系统" : "亮色"));
    },

    "model-test"() {
      const input = document.getElementById("api-key");
      if (input) S.apiKey = input.value;
      S.modelTest = "loading";
      render();
      API.testKey(S.apiKey).then((res) => {
        S.modelTest = res;
        render();
      });
    },

    "pick-model"(el) {
      DB.profile.model = el.dataset.value;
      DB.profile.modelLabel = { deepseek: "DeepSeek Chat", qwen: "通义千问 Plus", claude: "Claude Sonnet" }[el.dataset.value];
      render();
      toast("已切换到 " + DB.profile.modelLabel);
    },

    "iflytek-mode"(el) {
      S.iflytek.mode = el.dataset.value;
      render();
    },

    "iflytek-test"() {
      ["appid", "apikey", "secret"].forEach((k) => {
        const input = document.getElementById("iflytek-" + k);
        if (!input) return;
        S.iflytek[k === "appid" ? "appId" : k === "apikey" ? "apiKey" : "apiSecret"] = input.value;
      });
      S.voiceTest = "loading";
      render();
      API.testIflytek(S.iflytek).then((res) => {
        S.voiceTest = res;
        render();
      });
    },

    "dialog-delete"() {
      S.dialog = { kind: "delete" };
      render();
    },

    "confirm-delete"() {
      S.dialog = null;
      S.subpage = null;
      render();
      toast("已清空云端数据（演示）");
    },

    forget(el) {
      const i = DB.memories.findIndex((m) => m.id === el.dataset.id);
      if (i < 0) return;
      const removed = DB.memories.splice(i, 1)[0];
      render();
      toast("已忘记这条", "撤销", () => {
        DB.memories.splice(i, 0, removed);
        render();
      });
    },

    onboard() {
      S.onboard = 0;
      render();
    },

    "onboard-next"() {
      S.onboard = Math.min((S.onboard ?? 0) + 1, 2);
      render();
    },

    "onboard-prev"() {
      S.onboard = Math.max((S.onboard ?? 0) - 1, 0);
      render();
    },

    "onboard-skip"() {
      S.onboard = null;
      render();
    },

    "perm-allow"(el) {
      el.textContent = "已允许";
      el.disabled = true;
      toast(`已允许${el.dataset.name}权限（演示）`);
    },

    "toast-action"() {
      const fn = S.toastAction;
      S.toast = null;
      S.toastAction = null;
      clearTimeout(toastTimer);
      if (fn) fn();
      else render();
    }
  };

  /* ---------- 事件 ---------- */

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const fn = ACTIONS[el.dataset.action];
    if (!fn) return;
    e.preventDefault();
    e.stopPropagation();
    fn(el, e);
  });

  document.addEventListener("input", (e) => {
    if (e.target.id === "search-input") {
      S.query = e.target.value;
      const holder = document.getElementById("all-results");
      if (holder) holder.innerHTML = groupedList(filteredDuties());
    }
    if (e.target.id === "col-search") {
      S.colQuery = e.target.value;
      const holder = document.getElementById("col-results");
      if (holder) {
        const list = favList();
        holder.innerHTML = list.length
          ? `<div class="collection-list">${list.map(collectionRow).join("")}</div>`
          : `<div class="card"><div class="empty-state"><strong>没有匹配的收藏</strong><span>换个关键词试试。</span></div></div>`;
      }
    }
    if (e.target.id === "api-key") S.apiKey = e.target.value;
    if (e.target.id === "iflytek-appid") S.iflytek.appId = e.target.value;
    if (e.target.id === "iflytek-apikey") S.iflytek.apiKey = e.target.value;
    if (e.target.id === "iflytek-secret") S.iflytek.apiSecret = e.target.value;
    if (e.target.id === "new-title") S.dutyForm.title = e.target.value;
  });

  document.addEventListener("keydown", (e) => {
    if (e.target.id === "chat-input" && e.key === "Enter") {
      e.preventDefault();
      const text = e.target.value;
      e.target.value = "";
      sendChat(text);
    }
  });

  /* ---------- 启动 ---------- */

  applyTheme();
  render();

  setTimeout(() => {
    const splash = document.getElementById("splash");
    if (splash) splash.classList.add("hide");
  }, 1000);
})();
