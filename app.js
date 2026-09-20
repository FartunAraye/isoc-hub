import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, onSnapshot, setDoc, getDoc, deleteDoc, query, where, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* =====================================================================
   1. CONFIG. Paste your Firebase web config here (Project settings > Your apps > Web app).
   These values are safe to be public. Your Firestore rules protect the data.
   ===================================================================== */
const firebaseConfig = {
  apiKey: "AIzaSyBc_mWZ6dZhIzf95wVZPdca5CuOXQ9VZIM",
  authDomain: "isoc-uobd-hub.firebaseapp.com",
  projectId: "isoc-uobd-hub",
  storageBucket: "isoc-uobd-hub.firebasestorage.app",
  messagingSenderId: "30894208208",
  appId: "1:30894208208:web:526cc2e38c31c53aac9ad5",
  measurementId: "G-3J98J9J5KZ"
};

// Shown in the header and hero. Leave `sub` empty to hide it.
const SOCIETY = {
  name: "Islamic Society",
  sub: "",
  tagline: "Faith, friendship and good company."
};

/* =====================================================================
   2. SMALL HELPERS
   ===================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} }
};
const ico = (id) => `<svg class="ico" aria-hidden="true"><use href="#${id}"/></svg>`;
const DAY = 864e5;
const pad = (n) => String(n).padStart(2, "0");
const fmtDay = (d) => d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
const fmtTime = (d) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const hijriToday = () => {
  try { return new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { day: "numeric", month: "long", year: "numeric" }).format(new Date()); }
  catch { return ""; }
};

// Subtle geometric tiling behind everything (eight-pointed stars)
(() => {
  const s = "rgba(201,165,92,0.14)";
  const star = (x, y, r) => `<g transform="translate(${x} ${y})" fill="none" stroke="${s}" stroke-width="1"><rect x="${-r}" y="${-r}" width="${2 * r}" height="${2 * r}"/><rect x="${-r}" y="${-r}" width="${2 * r}" height="${2 * r}" transform="rotate(45)"/></g>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72">${star(36, 36, 14)}${star(0, 0, 14)}${star(72, 0, 14)}${star(0, 72, 14)}${star(72, 72, 14)}<circle cx="36" cy="36" r="2" fill="${s}"/></svg>`;
  document.documentElement.style.setProperty("--pattern", `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
})();

/* =====================================================================
   3. CATEGORIES + STARTER EVENTS
   ===================================================================== */
const CATS = {
  welcome:  { label: "Welcome",          icon: "i-crescent" },
  faith:    { label: "Faith & Learning", icon: "i-book" },
  creative: { label: "Creative",         icon: "i-star" },
  social:   { label: "Social",           icon: "i-lantern" },
  outdoors: { label: "Outdoors",         icon: "i-target" },
  charity:  { label: "Charity",          icon: "i-heart" }
};
const BCOL = { gold: "var(--gold)", amber: "var(--amber)", mint: "#7fd6ad", sky: "#7cc7d6" };
const BCOLORS = Object.keys(BCOL);

const mk = (...texts) => texts.map((text) => ({ id: uid("t"), done: false, text }));

// Your list of ideas. They load as DRAFTS, so nothing is public until the team publishes it.
const SEED = [
  { id: "welcome-week", title: "Welcome Week", cat: "welcome", blurb: "Come and meet the society, see what's planned this year and sign up as a member." },
  { id: "icebreaker", title: "Icebreaker Night", cat: "welcome", blurb: "A relaxed first night to meet the committee and other members." },
  { id: "quran-reflection", title: "Quran Reflection Session", cat: "faith", repeat: "weekly", blurb: "A weekly space to read, reflect and talk about the Quran together." },
  { id: "hifz-competition", title: "Hifz Competition", cat: "faith", blurb: "Recite from memory and be part of a friendly competition." },
  { id: "hadith-competition", title: "Hadith Competition", cat: "faith", blurb: "Test what you know in a friendly hadith competition." },
  { id: "hifz-club", title: "Hifz Club", cat: "faith", blurb: "A supportive group for memorising the Quran." },
  { id: "tajweed-club", title: "Tajweed Club", cat: "faith", blurb: "Improve your recitation with tajweed practice." },
  { id: "heritage-painting", title: "Heritage Painting", cat: "creative", blurb: "A painting session inspired by heritage, in collaboration with the Creative Pod." },
  { id: "tatreez", title: "Tatreez Workshop", cat: "creative", blurb: "Learn tatreez, the traditional Palestinian cross-stitch embroidery. A sample kit is included." },
  { id: "henna", title: "Henna Workshop", cat: "creative", blurb: "Learn henna design with hands-on practice." },
  { id: "zine-making", title: "Zine Making", cat: "creative", blurb: "Make your own zine: write, draw, cut and paste." },
  { id: "cards-muslimahs", title: "Cards for Muslimahs", cat: "creative", blurb: "Make and write cards to share some kindness." },
  { id: "decorate-prayer-room", title: "Decorate the Prayer Room", cat: "creative", blurb: "Help us make the prayer room warm and welcoming." },
  { id: "sip-paint", title: "Sip & Paint", cat: "social", blurb: "A sisters' social night with painting and drinks." },
  { id: "sisters-night-in", title: "Sisters' Night In", cat: "social", blurb: "Henna, cookie decorating, bracelet making and a photobooth." },
  { id: "chai-chat", title: "Chat over Chai (Sisters / Brothers)", cat: "social", blurb: "Relaxed conversation over a cup of chai." },
  { id: "girls-movie-night", title: "Girls Movie Night", cat: "social", blurb: "Snacks, a film and good company." },
  { id: "boys-movie-games", title: "Boys Movie Night / Games Night", cat: "social", blurb: "Films, games and snacks." },
  { id: "family-feud", title: "Family Feud", cat: "social", blurb: "Team up for a society edition of Family Feud." },
  { id: "weakest-link", title: "Weakest Link", cat: "social", blurb: "Quiz-show style fun. Can your team stay strong?" },
  { id: "bbq", title: "Society BBQ", cat: "social", blurb: "Food, friends and fresh air." },
  { id: "eid-carnival", title: "Eid Carnival", cat: "social", blurb: "Games, food and celebration." },
  { id: "horse-riding", title: "Horse Riding", cat: "outdoors", blurb: "A group outing to go horse riding." },
  { id: "archery", title: "Archery", cat: "outdoors", blurb: "Try archery with the society." },
  { id: "tote-bag", title: "Tote Bag Charity", cat: "charity", blurb: "Decorate or buy tote bags to raise money for charity." },
  { id: "bake-sale", title: "Bake Sale", cat: "charity", blurb: "Delicious bakes for a good cause." },
  { id: "charity-week", title: "Charity Week", cat: "charity", blurb: "A week of events and fundraising for charity." },
  { id: "fastathon", title: "Fastathon", cat: "charity", blurb: "Fast for a cause and raise money together." }
];

const SEED_WS = {
  tatreez: {
    tasks: mk(
      "Source the sample-kit materials: Aida/Itameen cloth, DMC floss or pearl cotton, tapestry needles, small scissors, needle threaders, mini hoops",
      "Print instructional booklets and patterns with historic regional motifs and borders",
      "Get free stickers",
      "Set up the projector and choose a video on how to start stitching",
      "Make a post showing what's included in a tatreez sample kit",
      "Make a scrapbook-style post slide with tatreez photos"
    ),
    notes: `Inspiration: PSA at UCF, "Threads of Noor" tatreez workshop.

What's in the sample kit
- Aida/Itameen cloth: grid-based fabric with pre-made holes that make spacing cross-stitches easy
- Quality threads: traditional coloured embroidery floss or pearl cotton (such as DMC)
- Tapestry needles: blunt tips that slide through the grid holes without splitting fibres
- Instructional booklets and patterns: step-by-step guides mapping out historic regional motifs and border designs
- Accessories: small scissors, needle threaders, a mini hoop or frame

Topics to cover
- History of tatreez
- Types of stitch, e.g. falahi cross stitch
- Pieces you can make: bookmarks, thobes

During the workshop: use the projector to show a video on how to start stitching.

Book recommendation (has designs): Palestinian Embroidery by Widad Kawar.

Websites to share
- stitchly.com: create your own stitch patterns
- flosscross.com: a stitch pattern maker
- linasthobe.com: learn tatreez
- tirazain.com: tatreez motifs and patterns
- tatreeztraditions.com: free tatreez courses`
  },
  "sisters-night-in": {
    tasks: mk("Plan the henna station", "Plan cookie decorating", "Get bracelet-making supplies", "Set up the photobooth"),
    notes: "Inspiration: KCL sisters' night in."
  },
  "heritage-painting": { tasks: [], notes: "Collaboration with the Creative Pod." },
  "family-feud": { tasks: [], notes: "Inspiration: ISOC Family Feud." },
  "weakest-link": { tasks: [], notes: "Inspiration: ISOC Weakest Link." },
  "eid-carnival": { tasks: [], notes: "Inspiration: Toronto Met MSA Eid Carnival." },
  "sip-paint": { tasks: [], notes: "Sisters' social night." }
};

const STARTER_TASKS = [
  "Book a venue or room", "Confirm the date and time", "Recruit volunteers",
  "Set the budget", "Design and share the poster", "Promote on Instagram and WhatsApp", "Collect feedback afterwards"
];

/* =====================================================================
   4. NORMALISERS + STATE
   ===================================================================== */
const normEvent = (id, d = {}) => ({
  id,
  title: d.title || "Untitled",
  cat: CATS[d.cat] ? d.cat : "social",
  blurb: d.blurb || "",
  location: d.location || "",
  start: d.start || "",
  durationMin: Number(d.durationMin) || 120,
  repeat: d.repeat === "weekly" ? "weekly" : "none",
  published: d.published === true,
  order: Number.isFinite(d.order) ? d.order : 999
});
const normWs = (d = {}) => ({
  tasks: Array.isArray(d.tasks) ? d.tasks : [],
  budgetTotal: Number(d.budgetTotal) || 0,
  budget: Array.isArray(d.budget) ? d.budget : [],
  budgetDone: !!d.budgetDone,
  notes: d.notes || ""
});

const now0 = new Date();
const S = {
  mode: "local",              // "live" once Firebase is configured
  user: null, isTeam: false,
  view: store.get("isoc-view", "home"),
  events: [], workspace: {}, announcements: [], submissions: [], members: [],
  loaded: { events: false },
  month: { y: now0.getFullYear(), m: now0.getMonth() }, cat: "all",
  askKind: "suggestion",
  teamTab: "events", evFilter: "all", openWs: null, inboxFilter: "new",
  modal: null, drafts: {}, expT: new Set(), expB: new Set(), pendingRender: false
};

const configured = !String(firebaseConfig.apiKey).startsWith("PASTE");
let app, auth, db;
if (configured) {
  try { app = initializeApp(firebaseConfig); auth = getAuth(app); db = getFirestore(app); S.mode = "live"; }
  catch (err) { console.error(err); }
}

/* Demo mode: no Firebase config yet, so show sample content and let you click around. Nothing is saved. */
function loadDemo() {
  S.user = { uid: "demo", email: "you@example.com", displayName: "Demo" };
  S.isTeam = true;
  const at = (d, h, m = 0) => { const x = new Date(); x.setDate(x.getDate() + d); x.setHours(h, m, 0, 0); return x.toISOString(); };
  const live = { "welcome-week": [1, 11], "icebreaker": [3, 18], "quran-reflection": [2, 19], "chai-chat": [5, 17], "tatreez": [8, 17], "bake-sale": [10, 12], "archery": [12, 16], "family-feud": [15, 18], "sisters-night-in": [18, 19] };
  S.events = SEED.map((s, i) => { const l = live[s.id]; return normEvent(s.id, { ...s, order: i, published: !!l, start: l ? at(l[0], l[1]) : "", location: l ? "Main campus" : "" }); });
  SEED.forEach((s) => { S.workspace[s.id] = normWs(SEED_WS[s.id]); });
  S.announcements = [
    { id: "a1", title: "Welcome Week is almost here", body: "Come and say salaam. The full programme is on the calendar.", pinned: true, createdAt: Date.now() - DAY, author: "Team" },
    { id: "a2", title: "Tatreez kits are ready", body: "Sample kits are packed. Bring your patience and your favourite colours.", pinned: false, createdAt: Date.now() - 3 * DAY, author: "Team" }
  ];
  S.members = [{ id: "you@example.com", name: "Demo", email: "you@example.com" }];
  S.loaded.events = true;
}
if (S.mode === "local") loadDemo();

/* =====================================================================
   5. TIME + OCCURRENCES (weekly repeats)
   ===================================================================== */
const evStart = (e) => (e.start ? new Date(e.start) : null);
const dur = (e) => (Number(e.durationMin) || 120) * 60000;
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

function occurrences(e, from, to) {
  const s = evStart(e);
  if (!s || isNaN(s)) return [];
  const out = [];
  const W = 7 * DAY;
  let t = s.getTime();
  if (e.repeat === "weekly") {
    if (t + dur(e) < from.getTime()) t += Math.ceil((from.getTime() - dur(e) - t) / W) * W;
    for (let i = 0; i < 120 && t <= to.getTime(); i++, t += W) {
      if (t + dur(e) >= from.getTime()) out.push({ ev: e, start: new Date(t), end: new Date(t + dur(e)) });
    }
  } else if (t <= to.getTime() && t + dur(e) >= from.getTime()) {
    out.push({ ev: e, start: s, end: new Date(t + dur(e)) });
  }
  return out;
}
function upcoming(list, from, limit) {
  const to = new Date(from.getTime() + 365 * DAY);
  const all = [];
  list.forEach((e) => all.push(...occurrences(e, from, to)));
  all.sort((a, b) => a.start - b.start);
  return all.slice(0, limit);
}
function until(d) {
  const ms = d - Date.now();
  if (ms <= 0) return "Happening now";
  const m = Math.round(ms / 60000);
  if (m < 60) return `In ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `In ${h}h ${m % 60}m`;
  const days = Math.floor(h / 24);
  return `In ${days} day${days > 1 ? "s" : ""}`;
}
const pubEvents = () => S.events.filter((e) => e.published);
const byOrder = (a, b) => a.order - b.order || a.title.localeCompare(b.title);
const sortedAnns = () => [...S.announcements].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.createdAt || 0) - (a.createdAt || 0));
const seenAnn = () => Number(store.get("isoc-ann-seen", "0")) || 0;
const unread = () => S.announcements.filter((a) => (a.createdAt || 0) > seenAnn()).length;
const markSeen = () => store.set("isoc-ann-seen", String(Date.now()));
const ws = (id) => S.workspace[id] || (S.workspace[id] = normWs());

/* =====================================================================
   6. CALENDAR EXPORT (.ics with reminders, Google Calendar link)
   ===================================================================== */
const icsDate = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsEsc = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
function downloadIcs(e, when) {
  const s = when || evStart(e);
  if (!s) return;
  const end = new Date(s.getTime() + dur(e));
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:-//${icsEsc(SOCIETY.name)}//Events//EN`, "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT", `UID:${e.id}-${s.getTime()}@society`, `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(s)}`, `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsEsc(e.title)}`, `LOCATION:${icsEsc(e.location)}`, `DESCRIPTION:${icsEsc(e.blurb)}`,
    ...(e.repeat === "weekly" ? ["RRULE:FREQ=WEEKLY"] : []),
    "BEGIN:VALARM", "TRIGGER:-PT1H", "ACTION:DISPLAY", `DESCRIPTION:${icsEsc(e.title)} starts in an hour`, "END:VALARM",
    "BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY", `DESCRIPTION:${icsEsc(e.title)} is tomorrow`, "END:VALARM",
    "END:VEVENT", "END:VCALENDAR"
  ];
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${e.id}.ics`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function gcalUrl(e, when) {
  const s = when || evStart(e);
  const end = new Date(s.getTime() + dur(e));
  const p = new URLSearchParams({ action: "TEMPLATE", text: e.title, dates: `${icsDate(s)}/${icsDate(end)}`, details: e.blurb || "", location: e.location || "" });
  if (e.repeat === "weekly") p.set("recur", "RRULE:FREQ=WEEKLY");
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

/* =====================================================================
   7. RENDERING
   ===================================================================== */
const dv = (k) => esc(S.drafts[k] || "");
const emblem = () => `<svg class="emblem" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22.5" fill="none" stroke="currentColor" stroke-width="1"/><g fill="none" stroke="currentColor" stroke-width="1.5"><rect x="13" y="13" width="22" height="22"/><rect x="13" y="13" width="22" height="22" transform="rotate(45 24 24)"/></g><circle cx="24" cy="24" r="3.6" fill="currentColor"/></svg>`;
const lantern = () => `<svg class="lantern" viewBox="0 0 64 130" aria-hidden="true"><line x1="32" y1="0" x2="32" y2="46" stroke="currentColor" stroke-width="1.5"/><path d="M22 46h20l5 10v34c0 8-7 14-15 14s-15-6-15-14V56z" fill="rgba(240,200,120,.14)" stroke="currentColor" stroke-width="1.6"/><path d="M19 66h26M19 92h26" stroke="currentColor" stroke-width="1.2"/><circle cx="32" cy="79" r="7" fill="#f0c878"/><path d="M32 104v16" stroke="currentColor" stroke-width="1.2"/><circle cx="32" cy="123" r="3" fill="currentColor"/></svg>`;

function render() {
  if (S.view === "team" && !S.isTeam) S.view = "home";
  const views = { home: homeHtml, calendar: calendarHtml, ask: askHtml, team: teamHtml };
  $("#app").innerHTML = `<div class="wrap">${headerHtml()}${navHtml()}<main>${(views[S.view] || homeHtml)()}</main>
    <footer class="foot"><div class="orn"><i></i>${ico("i-star")}<i></i></div>${esc(SOCIETY.name)}</footer></div>`;
  updateCountdowns();
}

function headerHtml() {
  const hij = hijriToday();
  let auth;
  if (S.mode === "local") auth = `<span class="chip dim">Demo mode</span>`;
  else if (S.user) auth = `<span class="who" title="${esc(S.user.email)}">${esc(S.user.displayName || S.user.email)}${S.isTeam ? " (team)" : ""}</span><button class="btn small" data-act="sign-out">Sign out</button>`;
  else auth = `<button class="btn amber small" data-act="sign-in">Sign in</button>`;
  return `<header class="top">
    <div class="brand">${emblem()}<div><div class="brand-name">${esc(SOCIETY.name)}</div>${SOCIETY.sub ? `<div class="brand-sub">${esc(SOCIETY.sub)}</div>` : ""}</div></div>
    <div class="top-right">
      ${hij ? `<span class="hijri" title="Follows the Umm al-Qura calendar, so it can differ by a day from local moon sighting">${esc(hij)}</span>` : ""}
      <button class="icon-round" data-act="open-notify" aria-label="Notification settings" title="Notification settings">${ico("i-bell")}${notif.enabled ? '<i class="on"></i>' : ""}</button>
      ${auth}
    </div></header>`;
}

function navHtml() {
  const tabs = [["home", "Home"], ["calendar", "Calendar"], ["ask", "Ask & suggest"]];
  if (S.isTeam) tabs.push(["team", "Team workspace"]);
  const n = unread();
  return `<nav class="nav" aria-label="Main">${tabs.map(([k, l]) => `<button class="navbtn${S.view === k ? " is-on" : ""}" data-act="nav" data-v="${k}">${l}${k === "home" && n && S.view !== "home" ? `<span class="badge">${n}</span>` : ""}</button>`).join("")}</nav>`;
}

/* ---------- home ---------- */
function archHtml(o) {
  if (!o) {
    return `<div class="arch">${lantern()}<div class="arch-in"><span class="bigstar">${ico("i-star")}</span><h3>Events are being planned</h3><p class="when" style="justify-content:center">Check back soon, in shā’ Allāh.</p></div></div>`;
  }
  const e = o.ev;
  return `<div class="arch c-${e.cat}">${lantern()}<div class="arch-in">
    <div class="nextlbl">Next up</div>
    <div class="dayn">${o.start.getDate()}</div>
    <div class="mon">${o.start.toLocaleDateString([], { month: "long" })}</div>
    <h3>${esc(e.title)}</h3>
    <div class="when">${ico("i-clock")}${fmtDay(o.start)}, ${fmtTime(o.start)}</div>
    ${e.location ? `<div class="when">${ico("i-pin")}${esc(e.location)}</div>` : ""}
    <div class="until" data-until="${o.start.toISOString()}">${until(o.start)}</div>
    <div><button class="btn small" data-act="open-event" data-id="${esc(e.id)}" data-t="${o.start.getTime()}">Details</button></div>
  </div></div>`;
}

function progRow(o) {
  const e = o.ev, c = CATS[e.cat];
  return `<button class="prow c-${e.cat}" data-act="open-event" data-id="${esc(e.id)}" data-t="${o.start.getTime()}">
    <div class="pdate"><b>${o.start.getDate()}</b><span>${o.start.toLocaleDateString([], { month: "short" })}</span></div>
    <div><div class="ptitle">${esc(e.title)}</div>
      <div class="pmeta"><span>${ico("i-clock")}${fmtDay(o.start)}, ${fmtTime(o.start)}</span>${e.location ? `<span>${ico("i-pin")}${esc(e.location)}</span>` : ""}${e.repeat === "weekly" ? "<span>Every week</span>" : ""}</div></div>
    <span class="chip">${ico(c.icon)}${c.label}</span></button>`;
}

function annHtml(a) {
  const isNew = (a.createdAt || 0) > seenAnn();
  const d = a.createdAt ? new Date(a.createdAt).toLocaleDateString([], { day: "numeric", month: "long" }) : "";
  return `<article class="ann"><div class="ann-h"><h3>${esc(a.title)}</h3>${a.pinned ? '<span class="chip">Pinned</span>' : ""}${isNew ? '<span class="chip new">New</span>' : ""}</div>
    ${a.body ? `<p>${esc(a.body)}</p>` : ""}<div class="when-posted">${esc(d)}</div></article>`;
}

function subscribeHtml() {
  return `<section class="sec"><div class="sec-head"><h2>Email updates</h2><span class="rule"></span></div>
    <div class="card pad" style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;justify-content:space-between">
      <p class="muted small" style="max-width:44ch;margin:0;display:flex;gap:8px;align-items:flex-start">${ico("i-mail")}<span>Get an email when a new event is published or the team posts something. No account needed.</span></p>
      <form data-form="subscribe" style="display:flex;gap:8px;flex:1;min-width:220px;max-width:360px">
        <input class="field" type="email" name="email" required placeholder="you@example.com" aria-label="Email address">
        <button class="btn amber" type="submit">Subscribe</button>
      </form>
    </div></section>`;
}

function homeHtml() {
  const ups = upcoming(pubEvents(), new Date(Date.now() - 0), 8);
  const anns = sortedAnns().slice(0, 4);
  const list = !S.loaded.events ? `<p class="empty">Loading…</p>` : ups.length ? ups.map(progRow).join("") : `<p class="empty">No events are scheduled yet. When the team publishes one, it will show up here.</p>`;
  return `<section class="hero">
      <div>
        <div class="bismillah" lang="ar" dir="rtl">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</div>
        <h1>${esc(SOCIETY.name)}</h1>
        <p class="lead">${esc(SOCIETY.tagline)}</p>
        <div class="cta"><button class="btn amber" data-act="nav" data-v="calendar">See the calendar</button><button class="btn" data-act="nav" data-v="ask">Ask or suggest</button></div>
      </div>
      ${archHtml(ups[0])}
    </section>
    <section class="sec"><div class="sec-head"><h2>Announcements</h2><span class="rule"></span></div>
      ${anns.length ? anns.map(annHtml).join("") : `<p class="empty">Nothing posted yet.</p>`}</section>
    <section class="sec"><div class="sec-head"><h2>Coming up</h2><span class="rule"></span></div>${list}</section>
    ${subscribeHtml()}`;
}

/* ---------- calendar ---------- */
function calendarHtml() {
  const { y, m } = S.month;
  const first = new Date(y, m, 1), last = new Date(y, m + 1, 0, 23, 59, 59);
  const lead = (first.getDay() + 6) % 7;            // week starts Monday
  const days = last.getDate();
  const list = pubEvents().filter((e) => S.cat === "all" || e.cat === S.cat);
  let occ = [];
  list.forEach((e) => occ.push(...occurrences(e, first, last)));
  occ = occ.filter((o) => o.start >= first && o.start <= last).sort((a, b) => a.start - b.start);
  const byDay = {};
  occ.forEach((o) => { const k = o.start.getDate(); (byDay[k] = byDay[k] || []).push(o); });
  const today = new Date();
  const cells = [];
  ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach((d) => cells.push(`<div class="dow">${d}</div>`));
  for (let i = 0; i < lead; i++) cells.push(`<div class="day out"></div>`);
  for (let d = 1; d <= days; d++) {
    const os = byDay[d] || [];
    const isToday = sameDay(new Date(y, m, d), today);
    cells.push(`<div class="day${isToday ? " today" : ""}"><span class="dn">${d}</span>${os.slice(0, 2).map((o) => `<button class="pill c-${o.ev.cat}" data-act="open-event" data-id="${esc(o.ev.id)}" data-t="${o.start.getTime()}" title="${esc(o.ev.title)}"><i class="dot"></i><span>${esc(o.ev.title)}</span></button>`).join("")}${os.length > 2 ? `<span class="more">+${os.length - 2} more</span>` : ""}</div>`);
  }
  const trail = (7 - ((lead + days) % 7)) % 7;
  for (let i = 0; i < trail; i++) cells.push(`<div class="day out"></div>`);
  const tba = list.filter((e) => !e.start);
  const filters = [["all", "All"], ...Object.entries(CATS).map(([k, c]) => [k, c.label])];
  const monthName = first.toLocaleDateString([], { month: "long", year: "numeric" });
  return `<div class="calbar"><div class="calmonth">${esc(monthName)}</div>
      <div class="calnav"><button class="btn small" data-act="cal-prev" aria-label="Previous month">Previous</button><button class="btn small" data-act="cal-today">Today</button><button class="btn small" data-act="cal-next" aria-label="Next month">Next</button></div></div>
    <div class="filters">${filters.map(([k, l]) => `<button class="fbtn c-${k}${S.cat === k ? " is-on" : ""}" data-act="cal-cat" data-c="${k}">${k !== "all" ? ico(CATS[k].icon) : ""}${l}</button>`).join("")}</div>
    <div class="grid">${cells.join("")}</div>
    <section class="sec"><div class="sec-head"><h2>This month</h2><span class="rule"></span></div>
      ${occ.length ? occ.map(progRow).join("") : `<p class="empty">Nothing on this month${S.cat !== "all" ? " in this category" : ""}.</p>`}</section>
    ${tba.length ? `<section class="sec"><div class="sec-head"><h2>Dates to be announced</h2><span class="rule"></span></div>${tba.map((e) => `<button class="prow c-${e.cat}" data-act="open-event" data-id="${esc(e.id)}" data-t=""><div class="pdate"><b>?</b></div><div><div class="ptitle">${esc(e.title)}</div></div><span class="chip">${ico(CATS[e.cat].icon)}${CATS[e.cat].label}</span></button>`).join("")}</section>` : ""}`;
}

/* ---------- ask & suggest ---------- */
function askHtml() {
  const mine = S.submissions.filter((s) => S.user && s.uid === S.user.uid).sort((a, b) => b.createdAt - a.createdAt);
  const form = (S.mode === "live" && !S.user)
    ? `<div class="card pad"><p>Sign in with Google to send us a suggestion or a question.</p><div class="mactions"><button class="btn amber" data-act="sign-in">Sign in</button></div></div>`
    : `<form data-form="ask">
        <div class="kinds">${["suggestion", "question"].map((k) => `<button type="button" class="fbtn${S.askKind === k ? " is-on" : ""}" data-act="ask-kind" data-k="${k}">${k === "suggestion" ? "A suggestion" : "A question"}</button>`).join("")}</div>
        <label class="lbl" for="ask-text">${S.askKind === "suggestion" ? "What would you like to see from the society?" : "What would you like to ask?"}</label>
        <textarea class="field" id="ask-text" name="text" maxlength="800" data-draft="ask-text" required>${dv("ask-text")}</textarea>
        <label class="check-row"><input type="checkbox" name="anon" data-draft="ask-anon" ${S.drafts["ask-anon"] ? "checked" : ""}> Send anonymously</label>
        <p class="muted small" style="margin-top:8px">Anonymous means the team won't see your name in the app. You'll still see any reply below.</p>
        <div class="mactions"><button class="btn amber" type="submit">Send</button></div></form>`;
  const rows = mine.map((s) => `<div class="sub-row"><div class="top-line"><span class="chip">${s.kind === "question" ? "Question" : "Suggestion"}</span><span class="chip ${s.status === "answered" ? "good" : "dim"}">${s.status === "answered" ? "Answered" : "Received"}</span></div>
      <p class="txt">${esc(s.text)}</p>${s.reply ? `<div class="reply"><b>From the team</b><p style="white-space:pre-line">${esc(s.reply)}</p></div>` : ""}</div>`).join("");
  return `<section class="sec"><div class="sec-head"><h2>Ask &amp; suggest</h2><span class="rule"></span></div>
    <p class="muted" style="max-width:60ch">Got an idea for an event, or a question for the committee? Tell us. Messages go to the team only.</p>
    <div class="askgrid"><div>${form}</div>
      <div><h3 style="font:600 28px var(--disp);color:var(--gold-br)">Your messages</h3>${rows || `<p class="empty" style="padding-left:0">Nothing sent yet.</p>`}</div></div></section>`;
}

/* ---------- team ---------- */
function teamHtml() {
  const newN = S.submissions.filter((s) => s.status === "new").length;
  const tabs = [["events", "Events"], ["inbox", `Inbox${newN ? ` (${newN})` : ""}`], ["posts", "Announcements"], ["members", "Members"]];
  const body = { events: teamEventsHtml, inbox: inboxHtml, posts: postsHtml, members: membersHtml }[S.teamTab]();
  return `<div class="subnav">${tabs.map(([k, l]) => `<button class="fbtn${S.teamTab === k ? " is-on" : ""}" data-act="team-tab" data-t="${k}">${l}</button>`).join("")}</div>${body}`;
}

function teamEventsHtml() {
  if (S.openWs) return wsHtml(S.openWs);
  const all = [...S.events].sort(byOrder);
  const drafts = all.filter((e) => !e.published).length;
  const list = all.filter((e) => S.evFilter === "all" || (S.evFilter === "draft" ? !e.published : e.published));
  const f = [["all", `All (${all.length})`], ["draft", `Drafts (${drafts})`], ["pub", `Published (${all.length - drafts})`]];
  return `<div class="toolbar" style="margin-top:14px"><div class="filters" style="margin:0">${f.map(([k, l]) => `<button class="fbtn${S.evFilter === k ? " is-on" : ""}" data-act="ev-filter" data-f="${k}">${l}</button>`).join("")}</div>
      <button class="btn amber small" data-act="new-event">New event</button></div>
    <p class="muted small" style="margin-top:10px">Drafts are only visible to the team. Publish an event when it has a date and you're ready for everyone to see it — publishing also emails your subscriber list.</p>
    ${list.map((e) => {
      const w = S.workspace[e.id], tot = w ? w.tasks.length : 0, done = w ? w.tasks.filter((t) => t.done).length : 0;
      const st = evStart(e);
      return `<button class="card rowbtn c-${e.cat}" data-act="open-ws" data-id="${esc(e.id)}"><div><div class="t">${esc(e.title)}</div>
        <div class="sub"><span>${st ? `${fmtDay(st)}, ${fmtTime(st)}` : "No date yet"}</span>${tot ? `<span>${done} of ${tot} tasks done</span>` : ""}</div></div>
        <div class="side"><span class="chip">${ico(CATS[e.cat].icon)}${CATS[e.cat].label}</span><span class="chip ${e.published ? "good" : "dim"}">${e.published ? "Published" : "Draft"}</span></div></button>`;
    }).join("") || `<p class="empty">No events here.</p>`}`;
}

function wsHtml(id) {
  const ev = S.events.find((e) => e.id === id);
  if (!ev) { S.openWs = null; return teamEventsHtml(); }
  const w = ws(id), st = evStart(ev), c = CATS[ev.cat];
  const tasks = w.tasks, open = tasks.filter((t) => !t.done).length, allDone = tasks.length > 0 && open === 0;
  const spent = w.budget.reduce((s, b) => s + (Number(b.amount) || 0), 0), left = (Number(w.budgetTotal) || 0) - spent;
  const total = Math.max(Number(w.budgetTotal) || 0, spent, 1);
  const segs = w.budget.filter((b) => Number(b.amount) > 0).map((b) => `<span style="width:${100 * b.amount / total}%;background:${BCOL[b.color] || "var(--muted)"}">${esc(b.amount)}</span>`).join("");
  const leftSeg = left > 0 ? `<span class="seg-left" style="width:${100 * left / total}%">${left} left</span>` : "";
  const q = esc(id);

  const taskList = `<ul class="tasks">${tasks.map((t) => `<li class="task${t.done ? " is-done" : ""}"><button class="check" type="button" data-act="toggle-task" data-id="${q}" data-task="${esc(t.id)}" aria-label="Mark done">${ico("i-check")}</button><p class="t">${esc(t.text)}</p><button class="icon-btn" type="button" data-act="remove-task" data-id="${q}" data-task="${esc(t.id)}" aria-label="Remove task">${ico("i-x")}</button></li>`).join("")}</ul>
    <form class="row-form" data-form="add-task" data-id="${q}"><input class="field" name="text" maxlength="200" placeholder="Add a task" aria-label="New task" data-draft="task-${q}" value="${dv("task-" + id)}" autocomplete="off"><button class="btn" type="submit">Add</button></form>
    ${tasks.length === 0 ? `<button class="btn small" style="margin-top:12px" type="button" data-act="starter" data-id="${q}">Add a starter checklist</button>` : ""}`;

  const budgetBody = `<div class="bstat"><div><div class="n">${left} AED</div><div class="muted small">left to spend</div></div>
      <label class="alloc">Allocation <input class="field" type="number" min="0" step="1" value="${esc(w.budgetTotal)}" data-act="budget-total" data-id="${q}" aria-label="Total budget"></label></div>
    <div class="bar">${segs}${leftSeg}</div>
    <ul class="lines">${w.budget.map((b) => `<li class="line"><button class="sw" type="button" data-act="line-color" data-id="${q}" data-line="${esc(b.id)}" style="background:${BCOL[b.color] || "var(--muted)"}" aria-label="Change colour"></button>
      <input class="field" type="text" maxlength="60" value="${esc(b.label)}" data-act="line-label" data-id="${q}" data-line="${esc(b.id)}" aria-label="Item">
      <input class="field" type="number" step="1" value="${esc(b.amount)}" data-act="line-amount" data-id="${q}" data-line="${esc(b.id)}" aria-label="AED">
      <button class="icon-btn" type="button" data-act="remove-line" data-id="${q}" data-line="${esc(b.id)}" aria-label="Remove line">${ico("i-x")}</button></li>`).join("")}</ul>
    <form class="line" data-form="add-line" data-id="${q}" style="margin-top:12px"><span class="sw" style="visibility:hidden"></span>
      <input class="field" name="label" maxlength="60" placeholder="New spend" aria-label="New spend" required><input class="field" name="amount" type="number" step="1" placeholder="AED" aria-label="Amount" required><button class="btn" type="submit">Add</button></form>
    <div style="margin-top:16px;text-align:right"><button class="btn small" type="button" data-act="budget-done" data-id="${q}">${w.budgetDone ? "Reopen budget" : "Mark budget as done"}</button></div>`;

  return `<div class="wshead"><div><button class="btn small" data-act="back-ws">All events</button></div>
      <div class="wsactions"><button class="btn small" data-act="edit-event" data-id="${q}">Edit details</button>
      <button class="btn small ${ev.published ? "" : "amber"}" data-act="toggle-publish" data-id="${q}">${ev.published ? "Unpublish" : "Publish"}</button>
      <button class="btn small danger" data-act="delete-event" data-id="${q}">Delete</button></div></div>
    <div style="margin-top:6px"><h2 style="font:600 44px/1 var(--disp);color:var(--gold-br);margin:8px 0 10px">${esc(ev.title)}</h2>
      <div class="kv"><div><span class="chip">${ico(c.icon)}${c.label}</span><span class="chip ${ev.published ? "good" : "dim"}">${ev.published ? "Published" : "Draft"}</span></div>
      <div>${ico("i-clock")}${st ? `${fmtDay(st)}, ${fmtTime(st)}${ev.repeat === "weekly" ? " (every week)" : ""}` : "No date yet"}</div>
      ${ev.location ? `<div>${ico("i-pin")}${esc(ev.location)}</div>` : ""}</div>
      ${ev.blurb ? `<p style="margin-top:10px;max-width:70ch">${esc(ev.blurb)}</p>` : ""}</div>

    <section class="block"><div class="block-h"><h3>To-do</h3>${allDone
      ? `<button class="count done" type="button" data-act="toggle-done-open" data-id="${q}">${ico("i-check")}Done ${S.expT.has(id) ? "▴" : "▾"}</button>`
      : `<span class="count${open ? " on" : ""}">${open} open</span>`}</div>
      ${allDone && !S.expT.has(id) ? "" : taskList}</section>

    <section class="block"><div class="block-h"><h3>Budget</h3>${w.budgetDone
      ? `<button class="count done" type="button" data-act="toggle-budget-open" data-id="${q}">${ico("i-check")}Done, ${spent} AED spent ${S.expB.has(id) ? "▴" : "▾"}</button>`
      : `<span class="count${left < 0 ? " bad" : ""}">${left} AED left</span>`}</div>
      ${w.budgetDone && !S.expB.has(id) ? "" : `<div class="card pad">${budgetBody}</div>`}</section>

    <section class="block"><div class="block-h"><h3>Notes</h3></div>
      <textarea class="field" style="min-height:240px" data-act="ws-notes" data-id="${q}" placeholder="Ideas, links, materials, run of show…">${esc(w.notes)}</textarea>
      <p class="muted small" style="margin-top:6px">Saves when you click away.</p></section>`;
}

function inboxHtml() {
  const list = [...S.submissions].sort((a, b) => b.createdAt - a.createdAt);
  const counts = { new: list.filter((s) => s.status === "new").length, answered: list.filter((s) => s.status === "answered").length, archived: list.filter((s) => s.status === "archived").length };
  const shown = list.filter((s) => S.inboxFilter === "all" || s.status === S.inboxFilter);
  const f = [["new", `New (${counts.new})`], ["answered", `Answered (${counts.answered})`], ["archived", `Archived (${counts.archived})`], ["all", "All"]];
  return `<div class="filters" style="margin-top:14px">${f.map(([k, l]) => `<button class="fbtn${S.inboxFilter === k ? " is-on" : ""}" data-act="inbox-filter" data-f="${k}">${l}</button>`).join("")}</div>
    ${shown.map((s) => {
      const who = s.anonymous ? "Anonymous" : (s.name || "A member");
      const d = new Date(s.createdAt).toLocaleDateString([], { day: "numeric", month: "short" });
      return `<div class="sub-row"><div class="top-line"><span class="chip">${s.kind === "question" ? "Question" : "Suggestion"}</span><span class="muted small">${esc(who)}, ${esc(d)}</span>${s.status === "answered" ? '<span class="chip good">Answered</span>' : s.status === "archived" ? '<span class="chip dim">Archived</span>' : ""}</div>
        <p class="txt">${esc(s.text)}</p>
        ${s.reply ? `<div class="reply"><b>Your reply</b><p style="white-space:pre-line">${esc(s.reply)}</p></div>` : ""}
        <textarea class="field" style="min-height:70px;margin-top:10px" placeholder="Write a reply (the sender will see it)" data-draft="reply-${esc(s.id)}">${dv("reply-" + s.id)}</textarea>
        <div class="mactions" style="margin-top:10px"><button class="btn small amber" data-act="send-reply" data-id="${esc(s.id)}">Send reply</button>
        ${s.status === "archived" ? `<button class="btn small" data-act="set-status" data-id="${esc(s.id)}" data-s="new">Move to new</button>` : `<button class="btn small" data-act="set-status" data-id="${esc(s.id)}" data-s="archived">Archive</button>`}</div></div>`;
    }).join("") || `<p class="empty">Nothing here.</p>`}`;
}

function postsHtml() {
  const anns = sortedAnns();
  return `<div class="askgrid"><div><h3 style="font:600 28px var(--disp);color:var(--gold-br);margin-top:14px">New announcement</h3>
    <form data-form="announce">
      <label class="lbl" for="an-title">Title</label><input class="field" id="an-title" name="title" maxlength="90" required data-draft="ann-title" value="${dv("ann-title")}">
      <label class="lbl" for="an-body">Message</label><textarea class="field" id="an-body" name="body" maxlength="1200" data-draft="ann-body">${dv("ann-body")}</textarea>
      <label class="check-row"><input type="checkbox" name="pin"> Pin to the top</label>
      <div class="mactions"><button class="btn amber" type="submit">Post</button></div></form>
      <p class="muted small" style="margin-top:10px">Posts show on the Home page for everyone, and email every subscriber automatically.</p></div>
    <div><h3 style="font:600 28px var(--disp);color:var(--gold-br);margin-top:14px">Posted</h3>${anns.map((a) => `<div class="sub-row"><div class="top-line"><b style="font:600 22px var(--disp)">${esc(a.title)}</b>${a.pinned ? '<span class="chip">Pinned</span>' : ""}</div>
      <p class="txt muted small">${esc((a.body || "").slice(0, 140))}</p>
      <div class="mactions" style="margin-top:8px"><button class="btn small" data-act="pin-ann" data-id="${esc(a.id)}">${a.pinned ? "Unpin" : "Pin"}</button><button class="btn small danger" data-act="delete-ann" data-id="${esc(a.id)}">Delete</button></div></div>`).join("") || `<p class="empty" style="padding-left:0">Nothing posted yet.</p>`}</div></div>`;
}

function membersHtml() {
  const me = (S.user?.email || "").toLowerCase();
  const list = [...S.members].sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
  return `<div class="askgrid"><div><h3 style="font:600 28px var(--disp);color:var(--gold-br);margin-top:14px">Team members</h3>
    ${list.map((m) => `<div class="member"><div><div>${esc(m.name || m.email)}</div><div class="muted small">${esc(m.email)}</div></div>${m.email.toLowerCase() === me ? '<span class="chip dim">You</span>' : `<button class="btn small danger" data-act="remove-member" data-id="${esc(m.id)}">Remove</button>`}</div>`).join("") || `<p class="empty" style="padding-left:0">No members yet.</p>`}</div>
    <div><h3 style="font:600 28px var(--disp);color:var(--gold-br);margin-top:14px">Add someone</h3>
    <form data-form="member"><label class="lbl" for="mb-name">Name</label><input class="field" id="mb-name" name="name" maxlength="60" data-draft="mb-name" value="${dv("mb-name")}">
      <label class="lbl" for="mb-email">Google email</label><input class="field" id="mb-email" name="email" type="email" required data-draft="mb-email" value="${dv("mb-email")}">
      <div class="mactions"><button class="btn amber" type="submit">Add to team</button></div></form>
    <p class="muted small" style="margin-top:10px">They need to sign in with that Google account. Team members can see and edit everything in the workspace. Owners listed in firestore.rules always keep access.</p></div></div>`;
}

/* ---------- modals ---------- */
const closeBtn = () => `<button class="icon-round mclose" data-act="close-modal" aria-label="Close">${ico("i-x")}</button>`;
function renderModal() {
  const el = $("#modal");
  if (!S.modal) { el.classList.remove("open"); el.innerHTML = ""; document.body.classList.remove("lock"); return; }
  let inner = "";
  if (S.modal.type === "event") inner = eventModal();
  else if (S.modal.type === "edit") inner = editModal();
  else if (S.modal.type === "notify") inner = notifyModal();
  if (!inner) { S.modal = null; return renderModal(); }
  el.innerHTML = `<div class="mpanel" data-stop="1">${closeBtn()}${inner}</div>`;
  el.dataset.act = "close-bg";
  el.classList.add("open");
  document.body.classList.add("lock");
}

function eventModal() {
  const e = S.events.find((x) => x.id === S.modal.id);
  if (!e) return "";
  const t = S.modal.t ? new Date(Number(S.modal.t)) : evStart(e);
  const c = CATS[e.cat];
  const when = t ? `${fmtDay(t)}, ${fmtTime(t)} to ${fmtTime(new Date(t.getTime() + dur(e)))}` : "Date to be announced";
  return `<div class="c-${e.cat}"><span class="chip">${ico(c.icon)}${c.label}</span></div>
    <h2 style="margin-top:12px">${esc(e.title)}</h2>
    <div class="mlines"><div>${ico("i-clock")}${esc(when)}</div>${e.repeat === "weekly" ? "<div>Repeats every week</div>" : ""}${e.location ? `<div>${ico("i-pin")}${esc(e.location)}</div>` : ""}</div>
    ${e.blurb ? `<p class="body">${esc(e.blurb)}</p>` : ""}
    ${t ? `<div class="mactions"><button class="btn amber" data-act="ics" data-id="${esc(e.id)}" data-t="${t.getTime()}">${ico("i-cal")}Add to calendar</button><a class="btn" target="_blank" rel="noopener" href="${esc(gcalUrl(e, t))}">Google Calendar</a></div>
    <p class="muted small" style="margin-top:12px">Calendar reminders work even when this page is closed. The download includes alerts one day and one hour before.</p>` : ""}`;
}

function editModal() {
  const e = S.modal.id ? S.events.find((x) => x.id === S.modal.id) : null;
  const v = e || { title: "", cat: "social", blurb: "", location: "", start: "", durationMin: 120, repeat: "none", published: false };
  const durs = [30, 60, 90, 120, 180, 240, 480];
  if (!durs.includes(v.durationMin)) durs.push(v.durationMin);
  durs.sort((a, b) => a - b);
  const dl = (m) => (m < 60 ? `${m} min` : m % 60 === 0 ? `${m / 60} hour${m > 60 ? "s" : ""}` : `${(m / 60).toFixed(1)} hours`);
  return `<form data-form="event" data-id="${esc(e ? e.id : "")}"><h2>${e ? "Edit event" : "New event"}</h2>
    <label class="lbl" for="f-title">Title</label><input class="field" id="f-title" name="title" required maxlength="80" value="${esc(v.title)}">
    <div class="two"><div><label class="lbl" for="f-cat">Category</label><select class="field" id="f-cat" name="cat">${Object.entries(CATS).map(([k, c]) => `<option value="${k}"${v.cat === k ? " selected" : ""}>${c.label}</option>`).join("")}</select></div>
      <div><label class="lbl" for="f-rep">Repeats</label><select class="field" id="f-rep" name="repeat"><option value="none"${v.repeat === "none" ? " selected" : ""}>Does not repeat</option><option value="weekly"${v.repeat === "weekly" ? " selected" : ""}>Every week</option></select></div></div>
    <div class="two"><div><label class="lbl" for="f-when">Date and time</label><input class="field" id="f-when" name="when" type="datetime-local" value="${esc(toLocalInput(v.start))}"></div>
      <div><label class="lbl" for="f-dur">Length</label><select class="field" id="f-dur" name="dur">${durs.map((m) => `<option value="${m}"${v.durationMin === m ? " selected" : ""}>${dl(m)}</option>`).join("")}</select></div></div>
    <label class="lbl" for="f-loc">Location</label><input class="field" id="f-loc" name="location" maxlength="80" value="${esc(v.location)}" placeholder="e.g. Prayer room">
    <label class="lbl" for="f-blurb">What everyone will see</label><textarea class="field" id="f-blurb" name="blurb" maxlength="600">${esc(v.blurb)}</textarea>
    <label class="check-row"><input type="checkbox" name="published"${v.published ? " checked" : ""}> Published (visible to everyone)</label>
    <div class="mactions"><button class="btn amber" type="submit">Save</button><button class="btn" type="button" data-act="close-modal">Cancel</button></div></form>`;
}

function notifyModal() {
  const supported = "Notification" in window;
  const perm = supported ? Notification.permission : "unsupported";
  const leads = [[15, "15 minutes before"], [30, "30 minutes before"], [60, "1 hour before"], [180, "3 hours before"], [1440, "1 day before"]];
  return `<h2>Notifications</h2>
    <p class="body">Get a pop-up when an event is about to start, and when the team posts an announcement. Prefer email? Subscribe on the Home page instead — that works even with this page closed.</p>
    <div class="mactions" style="margin-top:14px">${notif.enabled ? `<button class="btn" data-act="notify-off">Turn off</button>` : `<button class="btn amber" data-act="notify-on"${supported ? "" : " disabled"}>Turn on notifications</button>`}</div>
    ${!supported ? `<p class="muted small" style="margin-top:10px">This browser doesn't support notifications. Use “Add to calendar” on an event instead.</p>` : perm === "denied" ? `<p class="muted small" style="margin-top:10px">Notifications are blocked for this site. Allow them in your browser's site settings, then try again.</p>` : ""}
    <label class="lbl" for="lead">Remind me</label><select class="field" id="lead" data-act="notify-lead">${leads.map(([m, l]) => `<option value="${m}"${notif.lead === m ? " selected" : ""}>${l}</option>`).join("")}</select>
    <div class="card pad" style="margin-top:20px"><b style="font:600 20px var(--disp);color:var(--gold-br)">Good to know</b>
      <p class="muted small" style="margin-top:6px">Pop-ups appear while this page is open in a browser tab, including a background tab. To be reminded when the page is closed, open an event and choose “Add to calendar”, or subscribe by email on the Home page. Your phone's calendar will alert you one day and one hour before.</p></div>`;
}

/* =====================================================================
   8. NOTIFICATIONS (in-page pop-ups while the page is open)
   ===================================================================== */
const notif = { enabled: store.get("isoc-notify") === "1", lead: Number(store.get("isoc-lead", "60")) || 60 };
const canNotify = () => "Notification" in window;
let notified = new Set();
try { notified = new Set(JSON.parse(store.get("isoc-notified", "[]"))); } catch {}
const saveNotified = () => store.set("isoc-notified", JSON.stringify([...notified].slice(-200)));

let toastT = 0;
function toast(msg, ms = 3600) {
  const t = $("#toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => { t.hidden = true; }, ms);
}
function fireNotice(title, body, tag) {
  toast(body ? `${title}: ${body}` : title, 7000);
  if (canNotify() && Notification.permission === "granted") { try { new Notification(title, { body, tag }); } catch {} }
}
function checkReminders() {
  if (!notif.enabled || !canNotify() || Notification.permission !== "granted") return;
  const now = Date.now();
  upcoming(pubEvents(), new Date(now - 5 * 60000), 30).forEach((o) => {
    const left = o.start.getTime() - now;
    if (left > notif.lead * 60000 || left < -5 * 60000) return;
    const key = `${o.ev.id}|${o.start.getTime()}`;
    if (notified.has(key)) return;
    notified.add(key); saveNotified();
    const where = o.ev.location ? ` at ${o.ev.location}` : "";
    fireNotice(o.ev.title, left > 0 ? `Starts ${until(o.start).toLowerCase()}${where}` : `Starting now${where}`, key);
  });
}
function updateCountdowns() {
  document.querySelectorAll("[data-until]").forEach((el) => { el.textContent = until(new Date(el.dataset.until)); });
}
async function enableNotifications() {
  if (!canNotify()) { toast("This browser doesn't support notifications."); return; }
  let p = Notification.permission;
  if (p === "default") { try { p = await Notification.requestPermission(); } catch { p = "denied"; } }
  if (p === "granted") { notif.enabled = true; store.set("isoc-notify", "1"); toast("Notifications are on."); checkReminders(); }
  else toast("Notifications are blocked in your browser settings.");
  render(); renderModal();
}
function disableNotifications() { notif.enabled = false; store.set("isoc-notify", "0"); render(); renderModal(); }

/* =====================================================================
   9. SAVING + LIVE SYNC
   ===================================================================== */
let demoNoted = false;
async function put(coll, id, data, merge) {
  if (S.mode === "local") { if (!demoNoted) { demoNoted = true; toast("Demo mode: changes are not saved."); } return true; }
  try { await setDoc(doc(db, coll, id), data, merge ? { merge: true } : undefined); return true; }
  catch (err) { console.error(err); toast(err?.code === "permission-denied" ? "You don't have permission to do that." : "Couldn't save. Check your connection and try again."); return false; }
}
async function del(coll, id) {
  if (S.mode === "local") return true;
  try { await deleteDoc(doc(db, coll, id)); return true; }
  catch (err) { console.error(err); toast("Couldn't delete. Check your connection and try again."); return false; }
}

const dirty = new Set(), timers = {};
function markDirty(id) {
  dirty.add(id);
  clearTimeout(timers[id]);
  timers[id] = setTimeout(() => flushOne(id), 700);
}
function flushOne(id) {
  clearTimeout(timers[id]);
  if (!dirty.has(id)) return;
  dirty.delete(id);
  put("workspace", id, S.workspace[id]);
}
const flushAll = () => [...dirty].forEach(flushOne);
function change(id, fn) { fn(ws(id)); render(); markDirty(id); }
function afterEdit(id) {
  markDirty(id);
  S.pendingRender = true;
  setTimeout(() => { if (S.pendingRender && !typing()) { S.pendingRender = false; render(); } }, 700);
}

function typing() {
  const a = document.activeElement;
  if (a && a.closest && a.closest("#app") && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return true;
  return [...document.querySelectorAll("#app form[data-form] input:not([type=checkbox]), #app form[data-form] textarea")].some((i) => i.value.trim() !== "");
}
let rt = 0;
function refresh() {
  if (typing()) { clearTimeout(rt); rt = setTimeout(refresh, 1500); return; }
  render();
}

let unsubs = [], firstAnn = true, seeded = false;
function subscribe() {
  unsubs.forEach((f) => f()); unsubs = [];
  S.loaded.events = false; firstAnn = true;
  const onErr = (what) => (err) => { console.error(what, err); toast(`Couldn't load ${what}. Check your connection.`); };

  const evQ = S.isTeam ? collection(db, "events") : query(collection(db, "events"), where("published", "==", true));
  unsubs.push(onSnapshot(evQ, (snap) => {
    S.events = snap.docs.map((d) => normEvent(d.id, d.data()));
    S.loaded.events = true;
    if (S.isTeam && snap.empty && !snap.metadata.fromCache) seedDb();
    refresh();
  }, onErr("events")));

  unsubs.push(onSnapshot(collection(db, "announcements"), (snap) => {
    S.announcements = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (store.get("isoc-ann-seen") === null) markSeen();
    if (!firstAnn && notif.enabled) {
      snap.docChanges().forEach((ch) => {
        if (ch.type === "added" && !ch.doc.metadata.hasPendingWrites) fireNotice(`New from ${SOCIETY.name}`, ch.doc.data().title || "", "ann-" + ch.doc.id);
      });
    }
    firstAnn = false;
    refresh();
  }, onErr("announcements")));

  if (S.user) {
    const sq = S.isTeam ? collection(db, "submissions") : query(collection(db, "submissions"), where("uid", "==", S.user.uid));
    unsubs.push(onSnapshot(sq, (snap) => { S.submissions = snap.docs.map((d) => ({ id: d.id, ...d.data() })); refresh(); }, onErr("messages")));
  }
  if (S.isTeam) {
    unsubs.push(onSnapshot(collection(db, "workspace"), (snap) => {
      snap.docChanges().forEach((ch) => {
        const id = ch.doc.id;
        if (ch.doc.metadata.hasPendingWrites || dirty.has(id)) return;
        if (ch.type === "removed") delete S.workspace[id]; else S.workspace[id] = normWs(ch.doc.data());
      });
      refresh();
    }, onErr("the workspace")));
    unsubs.push(onSnapshot(collection(db, "team"), (snap) => {
      S.members = snap.docs.map((d) => ({ id: d.id, name: d.data().name || "", email: d.data().email || d.id }));
      refresh();
    }, onErr("the team list")));
  }
}

async function seedDb() {
  if (seeded) return;
  seeded = true;
  try {
    const b = writeBatch(db);
    SEED.forEach((s, i) => {
      b.set(doc(db, "events", s.id), { title: s.title, cat: s.cat, blurb: s.blurb || "", location: "", start: "", durationMin: 120, repeat: s.repeat || "none", published: false, order: i });
      b.set(doc(db, "workspace", s.id), normWs(SEED_WS[s.id]));
    });
    await b.commit();
    toast("Your event ideas are loaded as drafts.");
  } catch (err) { console.error(err); seeded = false; toast("Couldn't load the starter events."); }
}

async function afterAuth(u) {
  S.user = u; S.isTeam = false; S.submissions = []; S.workspace = {}; S.members = [];
  if (u) {
    try { await getDoc(doc(db, "workspace", "_probe")); S.isTeam = true; } catch { S.isTeam = false; }
  }
  if (S.isTeam && u.email) setDoc(doc(db, "team", u.email.toLowerCase()), { name: u.displayName || "", email: u.email.toLowerCase() }, { merge: true }).catch(() => {});
  if (!S.isTeam && S.view === "team") S.view = "home";
  subscribe();
  render();
}

/* =====================================================================
   10. INTERACTION
   ===================================================================== */
const openModal = (m) => { S.modal = m; renderModal(); };
const closeModal = () => { S.modal = null; renderModal(); };
const scrollTop = () => { try { window.scrollTo({ top: 0 }); } catch {} };

document.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-act]");
  if (S.pendingRender) { S.pendingRender = false; render(); }
  if (!el) return;
  const act = el.dataset.act, id = el.dataset.id;
  if (act === "close-bg" && e.target !== el) return;
  const ev = id ? S.events.find((x) => x.id === id) : null;

  switch (act) {
    case "close-bg": case "close-modal": return closeModal();
    case "nav":
      if (S.view === "home") markSeen();
      S.view = el.dataset.v; store.set("isoc-view", S.view); render(); scrollTop(); return;
    case "sign-in":
      if (S.mode !== "live") return toast("Demo mode: connect Firebase to sign in.");
      try { await signInWithPopup(auth, new GoogleAuthProvider()); }
      catch (err) { if (!["auth/popup-closed-by-user", "auth/cancelled-popup-request"].includes(err.code)) toast("Sign-in failed. " + (err.code || "")); }
      return;
    case "sign-out": if (S.mode === "live") signOut(auth); return;

    case "open-event": return openModal({ type: "event", id, t: el.dataset.t || "" });
    case "new-event": return openModal({ type: "edit", id: "" });
    case "edit-event": return openModal({ type: "edit", id });
    case "open-notify": return openModal({ type: "notify" });
    case "notify-on": return enableNotifications();
    case "notify-off": return disableNotifications();
    case "ics": if (ev) downloadIcs(ev, new Date(Number(el.dataset.t))); return;

    case "cal-prev": { const d = new Date(S.month.y, S.month.m - 1, 1); S.month = { y: d.getFullYear(), m: d.getMonth() }; return render(); }
    case "cal-next": { const d = new Date(S.month.y, S.month.m + 1, 1); S.month = { y: d.getFullYear(), m: d.getMonth() }; return render(); }
    case "cal-today": { const d = new Date(); S.month = { y: d.getFullYear(), m: d.getMonth() }; return render(); }
    case "cal-cat": S.cat = el.dataset.c; return render();

    case "ask-kind": S.askKind = el.dataset.k; return render();

    case "team-tab": S.teamTab = el.dataset.t; return render();
    case "ev-filter": S.evFilter = el.dataset.f; return render();
    case "inbox-filter": S.inboxFilter = el.dataset.f; return render();
    case "open-ws": S.openWs = id; render(); return scrollTop();
    case "back-ws": S.openWs = null; return render();

    case "toggle-task": return change(id, (w) => { const t = w.tasks.find((x) => x.id === el.dataset.task); if (t) t.done = !t.done; });
    case "remove-task": return change(id, (w) => { w.tasks = w.tasks.filter((x) => x.id !== el.dataset.task); });
    case "starter": return change(id, (w) => { w.tasks.push(...STARTER_TASKS.map((text) => ({ id: uid("t"), done: false, text }))); });
    case "toggle-done-open": S.expT.has(id) ? S.expT.delete(id) : S.expT.add(id); return render();
    case "line-color": return change(id, (w) => { const b = w.budget.find((x) => x.id === el.dataset.line); if (b) b.color = BCOLORS[(BCOLORS.indexOf(b.color) + 1) % BCOLORS.length]; });
    case "remove-line": return change(id, (w) => { w.budget = w.budget.filter((x) => x.id !== el.dataset.line); });
    case "budget-done": return change(id, (w) => { w.budgetDone = !w.budgetDone; S.expB.delete(id); });
    case "toggle-budget-open": S.expB.has(id) ? S.expB.delete(id) : S.expB.add(id); return render();

    case "toggle-publish": {
      if (!ev) return;
      ev.published = !ev.published; render();
      if (await put("events", id, { published: ev.published }, true)) toast(ev.published ? "Published. Everyone can see it, and subscribers are being emailed." : "Moved back to drafts.");
      return;
    }
    case "delete-event": {
      if (!ev || !confirm(`Delete “${ev.title}”? This also removes its tasks, budget and notes.`)) return;
      S.events = S.events.filter((x) => x.id !== id); delete S.workspace[id]; S.openWs = null; render();
      await del("events", id); await del("workspace", id);
      return;
    }

    case "send-reply": {
      const s = S.submissions.find((x) => x.id === id); const text = (S.drafts["reply-" + id] || "").trim();
      if (!s || !text) return toast("Write a reply first.");
      s.reply = text.slice(0, 1200); s.status = "answered"; delete S.drafts["reply-" + id]; render();
      if (await put("submissions", id, { reply: s.reply, status: "answered", repliedAt: Date.now() }, true)) toast("Reply sent.");
      return;
    }
    case "set-status": {
      const s = S.submissions.find((x) => x.id === id); if (!s) return;
      s.status = el.dataset.s; render(); await put("submissions", id, { status: s.status }, true); return;
    }
    case "pin-ann": {
      const a = S.announcements.find((x) => x.id === id); if (!a) return;
      a.pinned = !a.pinned; render(); await put("announcements", id, { pinned: a.pinned }, true); return;
    }
    case "delete-ann": {
      if (!confirm("Delete this announcement?")) return;
      S.announcements = S.announcements.filter((x) => x.id !== id); render(); await del("announcements", id); return;
    }
    case "remove-member": {
      const m = S.members.find((x) => x.id === id); if (!m || !confirm(`Remove ${m.name || m.email} from the team?`)) return;
      S.members = S.members.filter((x) => x.id !== id); render(); await del("team", id); return;
    }
  }
});

document.addEventListener("submit", async (e) => {
  const form = e.target.closest("form[data-form]");
  if (!form) return;
  e.preventDefault();
  const fd = new FormData(form), id = form.dataset.id;
  const clean = (v) => String(v ?? "").trim();

  switch (form.dataset.form) {
    case "ask": {
      const text = clean(fd.get("text"));
      if (!text) return;
      if (!S.user) return toast("Please sign in first.");
      const anon = fd.get("anon") === "on";
      const sub = { id: uid("s"), uid: S.user.uid, kind: S.askKind, text: text.slice(0, 800), anonymous: anon, name: anon ? "" : (S.user.displayName || "").slice(0, 60), createdAt: Date.now(), status: "new", reply: "" };
      S.submissions.push(sub); delete S.drafts["ask-text"]; delete S.drafts["ask-anon"]; render();
      const { id: sid, ...data } = sub;
      if (await put("submissions", sid, data)) toast("Jazakum Allahu khayran. The team has received it.");
      else { S.submissions = S.submissions.filter((x) => x.id !== sid); render(); }
      return;
    }
    case "subscribe": {
      const email = clean(fd.get("email")).toLowerCase();
      if (!email.includes("@")) return toast("Enter a valid email address.");
      form.reset();
      if (await put("subscribers", email, { email, subscribedAt: Date.now() }, true)) toast("Subscribed. You'll get an email for new events and posts.");
      return;
    }
    case "add-task": {
      const text = clean(fd.get("text"));
      if (!text) return;
      delete S.drafts["task-" + id];
      change(id, (w) => w.tasks.push({ id: uid("t"), done: false, text: text.slice(0, 200) }));
      setTimeout(() => document.querySelector(`[data-draft="task-${id}"]`)?.focus(), 0);
      return;
    }
    case "add-line": {
      const label = clean(fd.get("label")), amount = Math.round(Number(fd.get("amount")));
      if (!label || !Number.isFinite(amount)) return;
      change(id, (w) => w.budget.push({ id: uid("b"), color: BCOLORS[w.budget.length % BCOLORS.length], label: label.slice(0, 60), amount }));
      return;
    }
    case "announce": {
      const title = clean(fd.get("title"));
      if (!title) return;
      const a = { id: uid("a"), title: title.slice(0, 90), body: clean(fd.get("body")).slice(0, 1200), pinned: fd.get("pin") === "on", createdAt: Date.now(), author: S.user?.displayName || "" };
      S.announcements.push(a); delete S.drafts["ann-title"]; delete S.drafts["ann-body"]; render();
      const { id: aid, ...data } = a;
      if (await put("announcements", aid, data)) toast("Posted. Subscribers are being emailed.");
      return;
    }
    case "member": {
      const email = clean(fd.get("email")).toLowerCase();
      if (!email.includes("@")) return toast("Enter a valid email address.");
      const name = clean(fd.get("name")).slice(0, 60);
      if (!S.members.some((m) => m.id === email)) S.members.push({ id: email, name, email });
      delete S.drafts["mb-name"]; delete S.drafts["mb-email"]; render();
      if (await put("team", email, { name, email })) toast("Added to the team.");
      return;
    }
    case "event": {
      const title = clean(fd.get("title"));
      if (!title) return;
      const existing = id ? S.events.find((x) => x.id === id) : null;
      const when = clean(fd.get("when")), d = when ? new Date(when) : null;
      const data = {
        title: title.slice(0, 80),
        cat: CATS[fd.get("cat")] ? fd.get("cat") : "social",
        blurb: clean(fd.get("blurb")).slice(0, 600),
        location: clean(fd.get("location")).slice(0, 80),
        start: d && !isNaN(d) ? d.toISOString() : "",
        durationMin: Number(fd.get("dur")) || 120,
        repeat: fd.get("repeat") === "weekly" ? "weekly" : "none",
        published: fd.get("published") === "on",
        order: existing ? existing.order : Math.max(-1, ...S.events.map((x) => x.order)) + 1
      };
      const eid = existing ? existing.id : uid("e");
      const next = normEvent(eid, data);
      const i = S.events.findIndex((x) => x.id === eid);
      if (i >= 0) S.events[i] = next; else S.events.push(next);
      if (!existing) { S.view = "team"; S.teamTab = "events"; S.openWs = eid; }
      closeModal(); render();
      if (await put("events", eid, data)) toast("Saved.");
      return;
    }
  }
});

function syncDraft(el) {
  const k = el.dataset && el.dataset.draft;
  if (k) S.drafts[k] = el.type === "checkbox" ? (el.checked ? "1" : "") : el.value;
}
document.addEventListener("input", (e) => syncDraft(e.target));

document.addEventListener("change", (e) => {
  const el = e.target;
  syncDraft(el);
  const act = el.dataset && el.dataset.act;
  if (!act) return;
  const id = el.dataset.id;
  switch (act) {
    case "ws-notes": ws(id).notes = el.value.slice(0, 20000); markDirty(id); return;
    case "budget-total": ws(id).budgetTotal = Math.max(0, Math.round(Number(el.value) || 0)); return afterEdit(id);
    case "line-label": { const b = ws(id).budget.find((x) => x.id === el.dataset.line); if (b && el.value.trim()) b.label = el.value.trim(); return afterEdit(id); }
    case "line-amount": { const b = ws(id).budget.find((x) => x.id === el.dataset.line); if (b) b.amount = Math.round(Number(el.value) || 0); return afterEdit(id); }
    case "notify-lead": notif.lead = Number(el.value) || 60; store.set("isoc-lead", String(notif.lead)); return;
  }
});

document.addEventListener("keydown", (e) => { if (e.key === "Escape" && S.modal) closeModal(); });
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "hidden") return;
  const a = document.activeElement;
  if (a && a.dataset && a.dataset.act === "ws-notes") { ws(a.dataset.id).notes = a.value; markDirty(a.dataset.id); }
  flushAll();
  if (S.view === "home") markSeen();
});
window.addEventListener("pagehide", flushAll);

/* =====================================================================
   11. BOOT
   ===================================================================== */
let shownNext = "";
const nextKey = () => { const o = upcoming(pubEvents(), new Date(), 1)[0]; return o ? `${o.ev.id}|${o.start.getTime()}` : ""; };
function tick() {
  checkReminders();
  updateCountdowns();
  const k = nextKey();
  if (k !== shownNext && !S.modal && !typing()) render();
}
setInterval(tick, 30000);

render();
shownNext = nextKey();
if (S.mode === "live") onAuthStateChanged(auth, (u) => { afterAuth(u); });
else checkReminders();
