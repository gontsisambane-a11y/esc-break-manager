import React, { useState, useEffect, useCallback, useRef } from "react";

// ── EXECO THEME SYSTEM ────────────────────────────────────────────────
const THEMES = {
  dark: {
    bg:        "#0d1b2e",
    bgCard:    "#0f2440",
    bgSurf:    "#162d4a",
    bgHover:   "#1a3555",
    border:    "rgba(59,130,246,0.15)",
    borderHi:  "rgba(59,130,246,0.35)",
    accent:    "#3b82f6",
    accentHi:  "#60a5fa",
    accentDim: "rgba(59,130,246,0.12)",
    green:     "#10b981",
    greenDim:  "rgba(16,185,129,0.12)",
    amber:     "#f59e0b",
    amberDim:  "rgba(245,158,11,0.12)",
    red:       "#ef4444",
    redDim:    "rgba(239,68,68,0.12)",
    textPri:   "#f0f6ff",
    textSec:   "#7a9cbf",
    textMut:   "#3d5a78",
    radius:    "12px",
    radiusSm:  "8px",
    radiusLg:  "16px",
  },
  light: {
    bg:        "#f0f4f8",
    bgCard:    "#ffffff",
    bgSurf:    "#f4f7fb",
    bgHover:   "#e8eef5",
    border:    "rgba(59,130,246,0.2)",
    borderHi:  "rgba(59,130,246,0.4)",
    accent:    "#2563eb",
    accentHi:  "#3b82f6",
    accentDim: "rgba(37,99,235,0.08)",
    green:     "#059669",
    greenDim:  "rgba(5,150,105,0.08)",
    amber:     "#d97706",
    amberDim:  "rgba(217,119,6,0.08)",
    red:       "#dc2626",
    redDim:    "rgba(220,38,38,0.08)",
    textPri:   "#0f172a",
    textSec:   "#475569",
    textMut:   "#94a3b8",
    radius:    "12px",
    radiusSm:  "8px",
    radiusLg:  "16px",
  }
};

// Global theme state — read from localStorage, default dark
let _theme = (typeof localStorage !== "undefined" && localStorage.getItem("esc_theme")) || "dark";
let _themeListeners = [];

function getDS() { return THEMES[_theme]; }
function setTheme(t) {
  _theme = t;
  if(typeof localStorage !== "undefined") localStorage.setItem("esc_theme", t);
  document.body.style.background = THEMES[t].bg;
  document.body.style.color = THEMES[t].textPri;
  _themeListeners.forEach(fn => fn(t));
}

function useTheme() {
  const [theme, setT] = useState(_theme);
  useEffect(()=>{
    const fn = (t) => setT(t);
    _themeListeners.push(fn);
    return ()=>{ _themeListeners = _themeListeners.filter(f=>f!==fn); };
  },[]);
  return [theme, (t)=>setTheme(t)];
}

// DS is now a proxy — always reads current theme
const DS = new Proxy({}, { get: (_,k) => THEMES[_theme][k] });

function ThemeToggle({ size="normal" }) {
  const [theme, setT] = useTheme();
  const isDark = theme === "dark";
  const s = size === "small";
  return (
    <button
      onClick={()=>setT(isDark?"light":"dark")}
      title={isDark?"Switch to light mode":"Switch to dark mode"}
      style={{
        display:"flex",alignItems:"center",gap:s?4:6,
        padding:s?"4px 10px":"6px 12px",
        borderRadius:DS.radiusSm,
        border:`1px solid ${DS.border}`,
        background:"transparent",
        color:DS.textSec,
        cursor:"pointer",
        fontSize:s?11:12,
        fontWeight:500,
        transition:"all .15s",
        flexShrink:0,
      }}
    >
      <span style={{fontSize:s?13:15}}>{isDark?"☀️":"🌙"}</span>
      {!s&&<span>{isDark?"Day":"Night"}</span>}
    </button>
  );
}

function buildGStyle(t) {
  const d = THEMES[t];
  return `
  * { box-sizing: border-box; }
  @keyframes popIn { from { transform: scale(0.95) translateY(4px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
  @keyframes slideUp { from { transform: translateY(8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .5; } }
  body { background: ${d.bg}; color: ${d.textPri}; font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif; transition: background .2s, color .2s; }
  input, select, textarea {
    background: ${d.bgSurf} !important; color: ${d.textPri} !important;
    border: 1px solid ${d.border} !important; border-radius: ${d.radiusSm} !important;
    padding: 9px 12px !important; outline: none !important; transition: border-color .15s;
  }
  input:focus, select:focus, textarea:focus { border-color: ${d.accent} !important; }
  select option { background: ${d.bgCard}; color: ${d.textPri}; }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: ${d.border}; border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: ${d.borderHi}; }
  table { border-collapse: collapse; }
  th { background: ${d.bgSurf} !important; color: ${d.textSec} !important; border-bottom: 1px solid ${d.border} !important; }
  td { border-bottom: 1px solid ${d.border} !important; color: ${d.textPri} !important; background: transparent !important; }
`;
}

// gStyle is now computed dynamically — components use useTheme() to re-render
const gStyle = buildGStyle(_theme);



// ── AI INSIGHTS ENGINE ────────────────────────────────────────────────
async function callClaude(prompt, system="You are an operations analyst for a swim school enrollment call centre. Be concise, specific, and actionable. Never use bullet points — write in plain short sentences. Max 2 sentences unless instructed otherwise.") {
  const res = await fetch("/api/claude", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({
      model:"claude-sonnet-4-20250514",
      max_tokens:300,
      system,
      messages:[{role:"user",content:prompt}]
    })
  });
  const data = await res.json();
  return data.content?.[0]?.text||"";
}

// 1. BREAK RECOMMENDATION — shown on rep screen
// ── KPI QUERY HOOK ────────────────────────────────────────────────────
// Each component fetches only what it needs — no global 66k row load
const KPI_SELECT = "hs_deal_id,hs_agent_name,hs_call_timestamp,hs_call_disposition_label,hs_call_direction,contact_preferred_location,deal_stage";

async function fetchKpi(filters) {
  const pageSize = 1000;
  let allRows = [], from = 0;
  const qs = Object.entries(filters||{}).filter(([,v])=>v).map(([k,v])=>`${k}=${v}`).join("&");
  while(true) {
    const res = await fetch(
      `${SB_URL}/rest/v1/kpi_bookings?select=${KPI_SELECT}${qs?`&${qs}`:""}&order=hs_call_timestamp.asc&limit=${pageSize}&offset=${from}`,
      { headers:{ apikey:SB_KEY, Authorization:`Bearer ${SB_KEY}`, Accept:"application/json" } }
    );
    const chunk = await res.json();
    if(!Array.isArray(chunk)||!chunk.length) break;
    allRows = allRows.concat(chunk);
    if(chunk.length < pageSize) break;
    from += pageSize;
  }
  return allRows;
}

function useKpiQuery(filterKey, filterVal, since) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(()=>{
    setLoading(true);
    const filters = {};
    if(filterKey) filters[filterKey] = filterVal;
    if(since) filters["hs_call_timestamp"] = `gte.${since}`;
    fetchKpi(filters)
      .then(r=>{ setRows(r); setLoading(false); })
      .catch(()=>setLoading(false));
  }, [filterKey, filterVal, since]);
  return { rows, loading };
}

// Get date string N days ago in CT
function ctDaysAgo(n) {
  const d = new Date(new Date().toLocaleString("en-US",{timeZone:"America/Chicago"}));
  d.setDate(d.getDate()-n);
  return d.toISOString().split("T")[0];
}

function BreakRecommendation({ repName, reps, settings, onAdmin, onLunch, onHealth, canTakeAdmin, canTakeHealth, cooldownActive }) {
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(()=>{
    if(!repName) return;
    const key = `break_rec_${repName}_${new Date().toISOString().slice(0,13)}`;
    const cached = sessionStorage.getItem(key);
    if(cached){ setInsight(cached); return; }

    setLoading(true);
    const activeCount = reps.filter(r=>r.status==="available"&&(r.rep_stage||"active")!=="not_started").length;
    const totalCount = reps.filter(r=>(r.rep_stage||"active")!=="not_started").length;
    const hour = new Date().getHours();
    const ctHour = ((hour*60 - 300) % 1440) / 60;
    const isPeak = ctHour>=14&&ctHour<17;

    const paid_disps = ["Registered","Registered: Eval/L1O","Registered: Eval/WBO","Outbound - Registered"];

    callClaude(`Rep: ${repName}. Team available: ${activeCount}/${totalCount}. Current CT hour: ${ctHour.toFixed(0)}. Peak window (3-5pm CT): ${isPeak}. On health: ${onHealth}. On lunch: ${onLunch}. On admin: ${onAdmin}. Can take health break: ${canTakeHealth}. On cooldown: ${cooldownActive}. Can take admin: ${canTakeAdmin}. Peak mode: ${settings.peak_mode}.

Give a one-sentence recommendation: is now a good time to take a break, do admin, or stay on the phones? Consider team coverage and call volume timing.`)
      .then(text=>{ setInsight(text); sessionStorage.setItem(key,text); setLoading(false); })
      .catch(()=>setLoading(false));
  },[repName]);

  if(!insight&&!loading) return null;
  return (
    <div style={{background:DS.accentDim,border:`1px solid ${DS.borderHi}`,borderRadius:DS.radiusSm,padding:"8px 12px",marginTop:10,display:"flex",gap:8,alignItems:"flex-start"}}>
      <span style={{fontSize:12,color:DS.accent,flexShrink:0,marginTop:1}}>AI</span>
      <p style={{margin:0,fontSize:11,color:DS.textPri,lineHeight:1.5}}>
        {loading?"Analysing team coverage…":insight}
      </p>
    </div>
  );
}

// 2. COACHING NUDGE — shown on rep KPI widget
function CoachingNudge({ repName, weeks }) {
  const [nudge, setNudge] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(()=>{
    if(!repName||weeks.length<2) return;
    const key = `nudge_${repName}_${new Date().toISOString().slice(0,10)}`;
    const cached = sessionStorage.getItem(key);
    if(cached){ setNudge(cached); return; }

    setLoading(true);
    const recent = weeks.slice(-4).map(w=>`Week ${w.wk}: ${w.calls} calls, paid CVR ${w.paidCvr}%, total CVR ${w.totalCvr}%`).join(". ");
    const trend = weeks.length>=2 ? weeks[weeks.length-1].totalCvr - weeks[weeks.length-2].totalCvr : 0;

    callClaude(`Rep: ${repName}. Performance last 4 weeks: ${recent}. Week on week change: ${trend>0?"+":""}${trend.toFixed(1)}%. Paid CVR target: 20%. Total CVR target: 45%.

Give ONE specific, actionable coaching insight in one sentence. If above target, reinforce what's working. If below, give a concrete technique to improve. Do not mention the rep's name.`)
      .then(text=>{ setNudge(text); sessionStorage.setItem(key,text); setLoading(false); })
      .catch(()=>setLoading(false));
  },[repName]);

  if(!nudge&&!loading) return null;
  return (
    <div onClick={()=>setOpen(!open)} style={{background:DS.accentDim,border:`1px solid ${DS.borderHi}`,borderRadius:DS.radiusSm,padding:"6px 10px",marginTop:8,cursor:"pointer",display:"flex",gap:6,alignItems:"flex-start"}}>
      <span style={{fontSize:10,color:DS.accent,fontWeight:700,flexShrink:0,marginTop:1}}>AI</span>
      <p style={{margin:0,fontSize:10,color:DS.textPri,lineHeight:1.5}}>{loading?"Generating coaching insight…":nudge}</p>
    </div>
  );
}

// 3. ADHOC DECISION SUPPORT — shown in MgrRequests when reviewing
function AdHocDecisionSupport({ req, reps, settings }) {
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(()=>{
    if(!req) return;
    setLoading(true);
    const activeCount = reps.filter(r=>r.status==="available"&&(r.rep_stage||"active")!=="not_started").length;
    const onLunchNow = reps.filter(r=>r.status==="lunch").length;
    const totalActive = reps.filter(r=>(r.rep_stage||"active")!=="not_started").length;
    const prefTime = req.preferred_time ? `Preferred CT: ${req.preferred_time} ${req.rep_timezone}` : "No preferred time given";
    const ctHour = new Date().getHours() - 5;
    const isPeak = ctHour>=14&&ctHour<17;

    callClaude(`Manager is deciding whether to approve an ad hoc lunch for ${req.rep_name}. ${prefTime}. Current time CT: ~${ctHour}:00. Peak window (3-5pm CT): ${isPeak}. Currently on lunch: ${onLunchNow}. Available agents: ${activeCount}/${totalActive}. Peak mode: ${settings.peak_mode}. Note from rep: "${req.note||"none"}".

One sentence: should the manager approve now, delay, or decline? Consider call volume risk and coverage.`)
      .then(text=>{ setInsight(text); setLoading(false); })
      .catch(()=>setLoading(false));
  },[req?.id]);

  if(!insight&&!loading) return null;
  return (
    <div style={{background:DS.accentDim,border:`1px solid ${DS.borderHi}`,borderRadius:DS.radiusSm,padding:"7px 10px",marginBottom:8,display:"flex",gap:6,alignItems:"flex-start"}}>
      <span style={{fontSize:10,color:DS.accent,fontWeight:700,flexShrink:0,marginTop:1}}>AI</span>
      <p style={{margin:0,fontSize:11,color:DS.textPri,lineHeight:1.5}}>{loading?"Assessing coverage risk…":insight}</p>
    </div>
  );
}

// 4. WEEKLY TEAM SUMMARY — shown in KPI tab after CSV upload
function WeeklyTeamSummary({ reps }) {
  const since = ctDaysAgo(14);
  const { rows: kpiRows, loading: kpiLoading } = useKpiQuery(null, null, since);
  const [summary, setSummary] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  if(kpiLoading) return <p style={{fontSize:11,color:DS.textMut,padding:"8px 0"}}>Loading summary…</p>;

  const generate = async () => {
    if(generating||generated) return;
    setGenerating(true);

    const PAID = ["Registered","Registered: Eval/L1O","Registered: Eval/WBO","Outbound - Registered"];
    const TRIAL = ["Registered: Trial","Outbound - Trial"];

    const getWeek = ts => { const d=new Date(ts); const day=d.getDay(); const m=new Date(d); m.setDate(d.getDate()-(day===0?6:day-1)); return m.toISOString().split("T")[0]; };
    const weeks = [...new Set(kpiRows.map(r=>getWeek(r.hs_call_timestamp)))].sort().slice(-2);

    const weekStats = weeks.map(wk => {
      const rows = kpiRows.filter(r=>getWeek(r.hs_call_timestamp)===wk);
      const paid = rows.filter(r=>PAID.includes(r.hs_call_disposition_label)).length;
      const trial = rows.filter(r=>TRIAL.includes(r.hs_call_disposition_label)).length;
      return { wk, calls:rows.length, paid, trial, paidCvr:(paid/rows.length*100).toFixed(1), totalCvr:((paid+trial)/rows.length*100).toFixed(1) };
    });

    const activeFirstNames = new Set(reps.map(r=>r.name));
    const agentStats = [...new Set(kpiRows.map(r=>r.hs_agent_name))].filter(n=>{ const fn=n?.split(" ")[0]; return activeFirstNames.has(fn); }).map(name=>{
      const thisWk = kpiRows.filter(r=>r.hs_agent_name===name&&getWeek(r.hs_call_timestamp)===weeks[weeks.length-1]);
      const lastWk = weeks.length>1 ? kpiRows.filter(r=>r.hs_agent_name===name&&getWeek(r.hs_call_timestamp)===weeks[weeks.length-2]) : [];
      const cvr = r => r.length ? ((r.filter(x=>PAID.includes(x.hs_call_disposition_label)).length+r.filter(x=>TRIAL.includes(x.hs_call_disposition_label)).length)/r.length*100).toFixed(1) : null;
      return { name, thisCvr:cvr(thisWk), lastCvr:cvr(lastWk), calls:thisWk.length };
    }).filter(a=>a.thisCvr!==null);

    const top3 = [...agentStats].sort((a,b)=>parseFloat(b.thisCvr)-parseFloat(a.thisCvr)).slice(0,3).map(a=>`${a.name} ${a.thisCvr}%`).join(", ");
    const flagged = agentStats.filter(a=>parseFloat(a.thisCvr)<40).map(a=>`${a.name} ${a.thisCvr}%`).join(", ");
    const improved = agentStats.filter(a=>a.lastCvr&&parseFloat(a.thisCvr)-parseFloat(a.lastCvr)>5).map(a=>`${a.name} +${(parseFloat(a.thisCvr)-parseFloat(a.lastCvr)).toFixed(1)}%`).join(", ");

    const prompt = `Weekly ESC team performance summary. Targets: Paid CVR 20%, Total CVR 45%.

${weekStats.map(w=>`Week ${w.wk}: ${w.calls} calls, paid CVR ${w.paidCvr}%, total CVR ${w.totalCvr}%`).join(". ")}.
Top performers this week: ${top3||"none"}. Below 40% total CVR: ${flagged||"none"}. Most improved vs last week: ${improved||"none"}.

Write a 3-4 sentence plain-English team summary a manager would send to leadership. Cover overall trend, standouts, and one specific action item. Be direct and use names.`;

    callClaude(prompt, "You are a sales operations analyst. Write in plain sentences, no bullet points, no headers. Tone is professional but direct.")
      .then(text=>{ setSummary(text); setGenerating(false); setGenerated(true); })
      .catch(()=>setGenerating(false));
  };

  return (
    <div style={{background:DS.bgSurf,border:`1px solid ${DS.border}`,borderRadius:DS.radius,padding:"14px",marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:summary?12:0}}>
        <div>
          <p style={{margin:0,fontSize:13,fontWeight:600,color:DS.textPri}}>AI Weekly Summary</p>
          <p style={{margin:"2px 0 0",fontSize:11,color:DS.textSec}}>Plain-English team performance digest</p>
        </div>
        {!generated&&<button onClick={generate} disabled={generating} style={{padding:"7px 14px",borderRadius:DS.radiusSm,background:DS.accent,color:"#fff",border:"none",cursor:generating?"default":"pointer",fontSize:12,fontWeight:600,opacity:generating?.7:1}}>
          {generating?"Generating…":"Generate"}
        </button>}
      </div>
      {summary&&<p style={{margin:0,fontSize:13,color:DS.textPri,lineHeight:1.7,borderTop:`1px solid ${DS.border}`,paddingTop:12}}>{summary}</p>}
    </div>
  );
}


const SB_URL      = "https://uektpsmcgagzxfoxavex.supabase.co";
const SB_KEY      = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVla3Rwc21jZ2Fnenhmb3hhdmV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTY0NDcsImV4cCI6MjA5MzU3MjQ0N30.eJ15qDLM2bCCR5zK1eiiKoXx_JJTsPhjuBjZdpoVWW0";
const MANAGER_PIN = "2024";
const GCHAT_WEBHOOK = "https://chat.googleapis.com/v1/spaces/AAQAlhZ78sc/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=unQNBzB1gxvogk1UoVUAsTW83LoDxosTGVQfz_3b8Ss";
const HUB_ENABLED = true;

const gchatPing = (text) => fetch(GCHAT_WEBHOOK,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text})}).catch(e=>console.warn("GChat ping failed",e));

// Notification event definitions — key, label, default channel
const NOTIF_EVENTS = [
  {k:"peak_mode",        l:"⚡ Peak mode activated",         ch:"main"},
  {k:"admin_mode",       l:"🗂️ Admin time opened",           ch:"main"},
  {k:"hub_promo",        l:"🎯 New promo added",             ch:"main"},
  {k:"hub_closure",      l:"🚫 School closure logged",       ch:"main"},
  {k:"hub_location",     l:"📍 Location updated",            ch:"main"},
  {k:"hub_pricing",      l:"💰 Pricing updated",             ch:"main"},
  {k:"hub_alert",        l:"🔔 New reminder added",          ch:"main"},
  {k:"client_urgent",    l:"🚨 Urgent client submission",    ch:"both"},
  {k:"client_submission",l:"📤 New client submission (queue)",ch:"execo"},
  {k:"adhoc_request",    l:"🥗 Ad hoc lunch requested",      ch:"execo"},
  {k:"adhoc_approved",   l:"✅ Ad hoc lunch approved",       ch:"execo"},
  {k:"adhoc_declined",   l:"❌ Ad hoc lunch declined",       ch:"execo"},
  {k:"swap_approved",    l:"🔄 Lunch swap approved",         ch:"execo"},
];

// Smart pinger — checks notif_prefs before firing
function makePinger(notifPrefs={}, execoWebhook=null){
  const isOn=(key)=>notifPrefs[key]!==false; // default ON
  const execoPing=(text)=>{ if(execoWebhook) fetch(execoWebhook,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text})}).catch(()=>{}); };
  return {
    main:  (key,text)=>{ if(isOn(key)) gchatPing(text); },
    execo: (key,text)=>{ if(isOn(key)) execoPing(text); },
    both:  (key,text)=>{ if(isOn(key)){ gchatPing(text); execoPing(text); } },
    any:   (key,text,ch="main")=>{
      if(!isOn(key)) return;
      if(ch==="main"||ch==="both") gchatPing(text);
      if(ch==="execo"||ch==="both") execoPing(text);
    }
  };
}
// ── CALL VOLUME INTELLIGENCE ─────────────────────────────────────────
// Derived from 125,241 calls Jan 2024–Jun 2026
const CALL_VOL_WEEKDAY = {7:0.4,8:3.7,9:6.5,10:9.6,11:10.3,12:10.0,13:9.2,14:9.4,15:11.1,16:11.1,17:8.8,18:5.6,19:2.6};
const CALL_VOL_WEEKEND = {7:0.5,8:8.5,9:10.2,10:12.1,11:13.0,12:12.4,13:11.8,14:10.5,15:8.2,16:4.1,17:2.1,18:1.2};
const PEAK_WD = new Set([10,11,12,13,14,15,16,17]);
const PEAK_WE = new Set([8,9,10,11,12,13,14]);
const HIGH_WD = new Set([9,18]);

function getCallRisk() {
  const ct = new Date(new Date().toLocaleString("en-US",{timeZone:"America/Chicago"}));
  const h = ct.getHours(), d = ct.getDay();
  const isWE = d===0||d===6;
  const vol = isWE ? CALL_VOL_WEEKEND : CALL_VOL_WEEKDAY;
  const pct = vol[h]||0;
  if((isWE?PEAK_WE:PEAK_WD).has(h)) return {level:"peak",  label:"Peak hours — phones are busy",  color:DS.red,   pct};
  if(!isWE&&HIGH_WD.has(h))          return {level:"high",  label:"High volume window",             color:DS.amber, pct};
  if(pct < 3 || pct === 0)           return {level:"safe",  label:"Quiet window — good time for breaks", color:DS.green, pct};
  return                                    {level:"normal",label:"Normal volume",                  color:DS.textSec,pct};
}

const HEALTH_MAX_SEC = 600;
const HEALTH_PER_DAY = 3;
const HEALTH_DAILY_BANK = HEALTH_MAX_SEC * HEALTH_PER_DAY; // 1800 sec = 30 min total per day
const LUNCH_LIMIT = 2;
const ADMIN_DURATION_SEC = 1800; // 30 minutes
const H_LIMIT_NORMAL = 2;
const H_LIMIT_PEAK = 1;
const COOLDOWN_SEC = 7200;
const QUEUE_ACCEPT_SEC = 120; // 2 min to accept a queued break
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const TZLIST = ["Central","Eastern","Pacific","SA","GMT","IST"];
const HARDCODED_PTO = [
  {rep_name:"Andrea",pto_date:"2026-04-08"},{rep_name:"Andrea",pto_date:"2026-04-09"},
  {rep_name:"Andrea",pto_date:"2026-04-10"},{rep_name:"Amanda",pto_date:"2026-04-10"},
  {rep_name:"Amanda",pto_date:"2026-04-11"},{rep_name:"Marcel",pto_date:"2026-04-16"},
  {rep_name:"Marcel",pto_date:"2026-04-17"},{rep_name:"Andrea",pto_date:"2026-04-23"},
  {rep_name:"Andrea",pto_date:"2026-04-24"},{rep_name:"Andrea",pto_date:"2026-04-27"},
  {rep_name:"Jordan",pto_date:"2026-04-28"},{rep_name:"Amanda",pto_date:"2026-05-09"},
  {rep_name:"Amanda",pto_date:"2026-05-11"},{rep_name:"Heather",pto_date:"2026-05-16"},
  {rep_name:"Heather",pto_date:"2026-05-17"},{rep_name:"Heather",pto_date:"2026-05-18"},
  {rep_name:"Kelly",pto_date:"2026-05-18"},{rep_name:"Mike",pto_date:"2026-05-18"},
  {rep_name:"Darryl",pto_date:"2026-05-18"},{rep_name:"Heather",pto_date:"2026-05-19"},
  {rep_name:"Kelly",pto_date:"2026-05-19"},{rep_name:"Heather",pto_date:"2026-05-20"},
  {rep_name:"Kelly",pto_date:"2026-05-20"},{rep_name:"Heather",pto_date:"2026-05-21"},
  {rep_name:"Heather",pto_date:"2026-05-22"},{rep_name:"Rebecca",pto_date:"2026-05-22"},
  {rep_name:"Heather",pto_date:"2026-05-23"},{rep_name:"Rebecca",pto_date:"2026-05-25"},
  {rep_name:"Rebecca",pto_date:"2026-05-26"},{rep_name:"Amanda",pto_date:"2026-06-08"},
  {rep_name:"Amanda",pto_date:"2026-06-09"},{rep_name:"Amanda",pto_date:"2026-06-10"},
];
const ST = {
  available: { label:"On Duty",       dot:"#27ae60", bg:"#fff",    border:"#e8e8e8" },
  health:    { label:"Health Break",  dot:"#2980b9", bg:"#eaf4fd", border:"#aed6f1" },
  lunch:     { label:"Lunch Break",   dot:"#e07b00", bg:"#fff8ee", border:"#f0c080" },
  pto:       { label:"PTO",           dot:"#8e44ad", bg:"#f5eefb", border:"#d7aef0" },
  sick:      { label:"Sick Day",      dot:"#c0392b", bg:"#fdf0ee", border:"#f5b7b1" },
  off:       { label:"Scheduled Off", dot:"#bbb",    bg:"#f7f7f7", border:"#e8e8e8" },
  off_shift: { label:"Off Shift",     dot:"#999",    bg:"#f2f2f2", border:"#e0e0e0" },
};
const STAGE_CFG = {
  active:      { label:"Active",       bg:"#eafaf1", text:"#1a7a45", border:"#b7dfca" },
  training:    { label:"Training",     bg:"#fff8ee", text:"#b85c00", border:"#f0c080" },
  not_started: { label:"Not Started",  bg:"#f5f5f5", text:"#888",    border:"#ddd"    },
  ramping:     { label:"Ramping",      bg:"#eff6ff", text:"#1d4ed8", border:"#bfdbfe"  },
};
const TZ_C = {
  Central:{bg:"#e8f0fe",text:"#1a4a8a"}, Eastern:{bg:"#e6f4ea",text:"#1a5c35"},
  Pacific:{bg:"#fff3e6",text:"#7a4500"}, SA:{bg:"#fce8f3",text:"#7a1a5c"},
  GMT:{bg:"#e8f4fd",text:"#0d3b6b"},     IST:{bg:"#fef9e7",text:"#7d6608"},
};

// ── UTILS ─────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().split('T')[0];
const RESET_HOUR_UTC = 4; // Reset at 4am UTC (6am SA) — safely after 3am SA shift end
const businessDayStr = (isoDate) => {
  const d = new Date(isoDate || Date.now());
  const adjusted = new Date(d.getTime() - RESET_HOUR_UTC * 3600 * 1000);
  return adjusted.toISOString().split('T')[0];
};
const todayDay = () => DAYS[new Date().getDay()];
const TZ_IANA = { Central:"America/Chicago", Eastern:"America/New_York", Pacific:"America/Los_Angeles", SA:"Africa/Johannesburg", GMT:"Europe/London", IST:"Asia/Kolkata" };
const todayLabel = (repTz) => {
  const iana = repTz ? (TZ_IANA[repTz]||"America/Chicago") : Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = new Date();
  const date = now.toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric",timeZone:iana});
  const time = now.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",timeZone:iana,hour12:true});
  const city = iana.split("/").pop().replace(/_/g," ");
  return `${date} · ${time} ${city}`;
};
const fmtTime = s => { if(s<=0)return"0:00"; return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`; };
const fmtDur = s => { if(!s||s<=0)return"0m"; const h=Math.floor(s/3600),m=Math.floor((s%3600)/60); return h>0?`${h}h ${m}m`:`${m}m`; };
const elapsedSec = iso => {
  if(!iso) return 0;
  const d = new Date(iso);
  if(isNaN(d.getTime())) return 0;
  const elapsed = Math.floor((Date.now()-d.getTime())/1000);
  // Guard against future timestamps or impossibly large values (> 8 hours = bad data)
  if(elapsed < 0 || elapsed > 28800) return 0;
  return elapsed;
};
const fmt12h = t => { if(!t)return'--'; const [h,m]=t.split(':').map(Number); return `${h%12||12}:${m.toString().padStart(2,'0')}${h>=12?'pm':'am'}`; };
// UTC offsets in minutes for current period (May - CDT/EDT/PDT active)
const TZ_OFFSET = { Central:-300, Eastern:-240, Pacific:-420, SA:120, GMT:0, IST:330 };

// ── CALL CENTRE HOURS (all times in SAST = UTC+2) ────────────────────
function getCentreStatus() {
  const now = new Date();
  const sastOffset = 120; // UTC+2 in minutes
  const localOffset = -now.getTimezoneOffset();
  const sast = new Date(now.getTime() + (sastOffset - localOffset) * 60000);
  const day = sast.getDay(); // 0=Sun,1=Mon...6=Sat
  const h = sast.getHours();
  const totalMin = h * 60 + sast.getMinutes();
  const openMin = 14 * 60; // 2:00pm SAST

  // Centre crosses midnight: open 2pm, closes 3am next day (weekday) or 11pm same day (weekend)
  // After midnight (0:00-2:59): still the previous day's shift — check previous day
  // Treat 00:00-02:59 as belonging to the previous calendar day's shift
  let isOpen = false;
  if (totalMin < 3 * 60) {
    // Past midnight — still open if yesterday was a weekday (Mon-Fri shift closes at 3am)
    const prevDay = day === 0 ? 6 : day - 1;
    const prevWasWeekday = prevDay >= 1 && prevDay <= 5;
    isOpen = prevWasWeekday; // Sat/Sun shift closes at 11pm so never open past midnight
  } else if (totalMin >= openMin) {
    // After 2pm — open regardless of day
    const isWeekday = day >= 1 && day <= 5;
    const closeMin = isWeekday ? 24 * 60 + 3 * 60 : 23 * 60; // weekday closes at 3am next day, weekend 11pm
    isOpen = totalMin < (isWeekday ? 24 * 60 : closeMin);
    if (!isWeekday) isOpen = totalMin < closeMin;
    else isOpen = true; // after 2pm on weekday, always open (closes past midnight handled above)
  }
  return { isOpen, sast };
}

function isRepOnShift(rep) {
  // Get current time in rep's own timezone
  const tzOffset = TZ_OFFSET[rep.timezone||"Central"] ?? -300;
  const localOffset = -(new Date().getTimezoneOffset());
  const repNow = new Date(Date.now() + (tzOffset - localOffset) * 60000);
  const repDay = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][repNow.getDay()];
  const repH = repNow.getHours();
  const repM = repNow.getMinutes();
  const nowMin = repH * 60 + repM;

  // Check if today is a scheduled working day
  const shiftDays = rep.shift_days||[];
  if(shiftDays.length > 0 && !shiftDays.includes(repDay)) return false;

  // Check shift start/end times for today
  const sched = (rep.lunch_schedule||{})[repDay];
  if(!sched?.start || !sched?.end) return true; // no times set, assume on shift if day matches

  const [startH, startM] = sched.start.split(":").map(Number);
  const [endH, endM]     = sched.end.split(":").map(Number);
  const startMin = startH * 60 + startM;
  const endMin   = endH   * 60 + endM;

  if(endMin > startMin) {
    // Normal shift — doesn't cross midnight
    return nowMin >= startMin && nowMin < endMin;
  } else {
    // Crosses midnight (e.g. 14:00–03:00)
    return nowMin >= startMin || nowMin < endMin;
  }
}

function convertLunchTime(timeStr, fromTz, toTz) {
  if(!timeStr||!timeStr.includes(":")) return timeStr||"--";
  const [h,m] = timeStr.split(":").map(Number);
  const fromOffset = TZ_OFFSET[fromTz]??0;
  const toOffset   = TZ_OFFSET[toTz]??0;
  const diffMin = toOffset - fromOffset;
  const totalMin = h*60 + m + diffMin;
  const adjH = ((totalMin/60|0) % 24 + 24) % 24;
  const adjM = ((totalMin % 60) + 60) % 60;
  return `${String(adjH).padStart(2,"0")}:${String(adjM).padStart(2,"0")}`;
}

function inLunchWindow(rep) {
  const day = DAYS[new Date().getDay()];
  const sched = (rep.lunch_schedule||{})[day];
  if(!sched?.time) return true;
  const [h,m] = sched.time.split(':').map(Number);
  const nowMin = new Date().getHours()*60+new Date().getMinutes();
  const schedMin = h*60+m;
  const durMin = sched.duration||60;
  return nowMin >= schedMin-15 && nowMin <= schedMin+durMin+15;
}
const avatar = name => name.split(" ").map(p=>p[0]?.toUpperCase()||"").join("").slice(0,2)||"??";

// ── SUPABASE ──────────────────────────────────────────────────────────
async function sb(path, opts={}) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...opts, headers:{ apikey:SB_KEY, Authorization:`Bearer ${SB_KEY}`, "Content-Type":"application/json", Prefer:"return=representation", ...(opts.headers||{}) }
  });
  if(!res.ok) throw new Error(await res.text());
  const body = await res.text();
  return body ? JSON.parse(body) : [];
}
const sbPatch = (tbl,id,d) => sb(`${tbl}?id=eq.${id}`,{method:"PATCH",body:JSON.stringify(d)});
const sbPost  = (tbl,d)    => sb(tbl,{method:"POST",body:JSON.stringify(d)});
const sbDel   = (tbl,id)   => sb(`${tbl}?id=eq.${id}`,{method:"DELETE"});

// SOC 2 CC7.2 — Audit logging

async function loadAll() {
  // Close any stale open break_log entries from previous days on every poll
  const todayStart = new Date();
  todayStart.setHours(0,0,0,0);
  sb(`break_log?ended_at=is.null&started_at=lt.${todayStart.toISOString()}`,{
    method:"PATCH",
    body:JSON.stringify({ended_at:new Date().toISOString(),duration_seconds:0})
  }).catch(()=>{});

  const [reps,settArr,adHoc,swaps,activeBreaks,breakQueue] = await Promise.all([
    sb("rep_status?select=*&order=id"),
    sb("app_settings?id=eq.1"),
    sb("adhoc_lunch_requests?status=eq.pending&order=created_at.desc"),
    sb("lunch_swaps?status=in.(pending)&order=created_at.desc"),
    sb("break_log?ended_at=is.null&select=*"),
    sb(`break_queue?date=eq.${todayStr()}&status=in.(waiting,notified)&order=queued_at`),
  ]);
  const settings = settArr[0]||{id:1,peak_mode:false,custom_limit:null,pto_seeded:false,admin_mode:false,admin_limit:null};
  // Auto-fix reps stuck on break/admin from a previous day
  const todayStr2 = new Date().toISOString().split("T")[0];
  const stuckReps = reps.filter(r=>
    ["health","lunch","admin"].includes(r.status) &&
    r.updated_at &&
    new Date(r.updated_at).toISOString().split("T")[0] < todayStr2
  );
  if(stuckReps.length) {
    await Promise.all(stuckReps.map(r=>sbPatch("rep_status",r.id,{
      status:"available",
      health_breaks_today:0,
      health_time_today:0,
      health_time_banked:0,
      last_break_returned_at:null,
    })));
    stuckReps.forEach(r=>{ r.status="available"; r.health_breaks_today=0; r.health_time_today=0; r.health_time_banked=0; });
  }

  return { reps, settings, adHoc, swaps, activeBreaks:activeBreaks.filter(b=>reps.find(r=>r.id===b.rep_id&&["health","lunch"].includes(r.status))), breakQueue:breakQueue||[] };
}

// Daily reset — runs once on app load only, not on every poll
async function runDailyReset(reps, settings) {
  const today = businessDayStr();
  const todayPTO = await sb(`calloffs?calloff_date=eq.${todayStr()}&reason=eq.pto&select=rep_name`).catch(()=>[]);
  const todayPTONames = (todayPTO||[]).map(p=>p.rep_name);

  if(!settings.pto_seeded) {
    try {
      for(const p of HARDCODED_PTO) {
        const rep = reps.find(r=>r.name===p.rep_name);
        if(rep) await sbPost("calloffs",{rep_id:rep.id,rep_name:p.rep_name,calloff_date:p.pto_date,reason:"pto",note:"Pre-loaded",logged_by:"system"}).catch(()=>{});
      }
      await sbPatch("app_settings",1,{pto_seeded:true});
    } catch(e) { console.warn("PTO seed error",e); }
  }

  // Close ANY open break_log entries from previous days first
  const openLogs = await sb(`break_log?ended_at=is.null&select=id,started_at`).catch(()=>[]);
  const staleLogPatches = (openLogs||[])
    .filter(l=>{
      const d = new Date(l.started_at);
      const logDay = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      return logDay < todayStr();
    })
    .map(l=>sb(`break_log?id=eq.${l.id}`,{method:"PATCH",body:JSON.stringify({ended_at:new Date().toISOString(),duration_seconds:0})}));
  if(staleLogPatches.length) await Promise.all(staleLogPatches);

  const patches = [];
  for(const r of reps) {
    const isNewDay = r.updated_at && businessDayStr(r.updated_at) !== today;
    if(isNewDay && (r.health_breaks_today>0||r.health_time_banked>0||r.health_time_today>0)) {
      patches.push(sbPatch("rep_status",r.id,{health_breaks_today:0,health_time_today:0,health_time_banked:0,last_break_returned_at:null}));
      r.health_breaks_today=0; r.health_time_today=0; r.health_time_banked=0; r.last_break_returned_at=null;
    }
    if(isNewDay && ["health","lunch","admin"].includes(r.status)) {
      patches.push(sbPatch("rep_status",r.id,{status:"available",updated_at:new Date().toISOString()}));
      r.status="available";
    }
    if(todayPTONames.includes(r.name) && r.status==="available") {
      patches.push(sbPatch("rep_status",r.id,{status:"pto",ooo_note:"PTO"}));
      r.status="pto"; r.ooo_note="PTO";
    }
  }
  await Promise.all(patches);
}

async function loadReportData(start, end) {
  const [logs, calloffs] = await Promise.all([
    sb(`break_log?started_at=gte.${start}T00:00:00&started_at=lte.${end}T23:59:59&select=*&order=started_at`),
    sb(`calloffs?calloff_date=gte.${start}&calloff_date=lte.${end}&select=*&order=calloff_date`),
  ]);
  return { logs, calloffs };
}

// ── SHARED COMPONENTS ─────────────────────────────────────────────────
function Toast({ msg, type, onDone }) {
  useEffect(()=>{ const t=setTimeout(onDone,3500); return()=>clearTimeout(t); },[]);
  const cfg = {
    approved: {bg:"rgba(16,185,129,0.15)",border:"rgba(16,185,129,0.3)",icon:"✓"},
    declined:  {bg:"rgba(239,68,68,0.15)", border:"rgba(239,68,68,0.3)", icon:"✕"},
    info:      {bg:"rgba(59,130,246,0.15)",border:"rgba(59,130,246,0.3)",icon:"·"},
    ooo:       {bg:"rgba(245,158,11,0.15)",border:"rgba(245,158,11,0.3)",icon:"·"},
    warn:      {bg:"rgba(245,158,11,0.15)",border:"rgba(245,158,11,0.3)",icon:"⚠"},
  };
  const c = cfg[type]||cfg.info;
  return (
    <div style={{position:"fixed",bottom:28,left:"50%",transform:"translateX(-50%)",
      background:DS.bgCard,border:`1px solid ${c.border}`,color:DS.textPri,
      padding:"11px 20px",borderRadius:DS.radius,fontSize:13,fontWeight:500,
      zIndex:9999,display:"flex",alignItems:"center",gap:10,whiteSpace:"nowrap",
      boxShadow:"0 8px 32px rgba(0,0,0,0.4)",animation:"slideUp .2s ease"}}>
      <span style={{color:c.border,fontSize:16,fontWeight:700}}>{c.icon}</span>{msg}
    </div>
  );
}

function Modal({ title, sub, onClose, children, wide }) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9000,padding:16}} onClick={onClose}>
      <div style={{background:DS.bgCard,border:`1px solid ${DS.border}`,borderRadius:DS.radiusLg,padding:"24px 22px",width:"100%",maxWidth:wide?580:360,maxHeight:"90vh",overflowY:"auto",animation:"popIn .2s ease"}} onClick={e=>e.stopPropagation()}>
        {sub&&<p style={{margin:"0 0 2px",fontSize:10,color:DS.textMut,letterSpacing:2,textTransform:"uppercase"}}>{sub}</p>}
        <h2 style={{margin:"0 0 18px",fontSize:17,fontWeight:600,color:DS.textPri}}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

function Btn({ label, onClick, color, disabled, small, outline }) {
  const bg = disabled ? DS.bgSurf : outline ? "transparent" : (color||DS.accent);
  const border = outline ? `1px solid ${color||DS.borderHi}` : "1px solid transparent";
  const textColor = disabled ? DS.textMut : outline ? (color||DS.accent) : "#fff";
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: small?"7px 14px":"11px 0",
      width: small?"auto":"100%",
      borderRadius: DS.radiusSm,
      border, background:bg, color:textColor,
      cursor: disabled?"not-allowed":"pointer",
      fontSize: small?12:13,
      fontWeight:600,
      letterSpacing:".01em",
      transition:"all .15s",
    }}>{label}</button>
  );
}

function StatusDot({ status }) {
  const cfg=ST[status]||ST.available;
  return <span style={{width:6,height:6,borderRadius:"50%",background:cfg.dot,display:"inline-block",flexShrink:0}}/>;
}

// ── HEALTH BREAK TIMER ────────────────────────────────────────────────
function HealthTimer({ startedAt, bankedSec }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(()=>{
    const update=()=>setElapsed(elapsedSec(startedAt));
    update();
    const t=setInterval(update,1000);
    return()=>clearInterval(t);
  },[startedAt]);
  const totalUsed = bankedSec + elapsed;
  const remaining = HEALTH_MAX_SEC - totalUsed;
  const pct = Math.min(totalUsed/HEALTH_MAX_SEC,1);
  const over = remaining < 0;
  const color = over?"#e74c3c":remaining<120?"#e07b00":"#2980b9";
  return (
    <div style={{marginTop:10}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
        <span style={{fontSize:11,color:DS.textSec}}>Health break</span>
        <span style={{fontSize:13,fontWeight:700,color}}>{over?`+${fmtTime(Math.abs(remaining))} over`:fmtTime(remaining)+" left"}</span>
      </div>
      <div style={{height:6,background:DS.bgSurf,borderRadius:3,overflow:"hidden"}}>
        <div style={{width:`${pct*100}%`,height:"100%",background:color,borderRadius:3,transition:"width 1s linear"}}/>
      </div>
      {over&&<p style={{margin:"4px 0 0",fontSize:11,color:"#e74c3c",fontWeight:600}}>⚠️ Time exceeded — please return to desk</p>}
    </div>
  );
}

// ── LOGIN ─────────────────────────────────────────────────────────────
function LoginScreen({ onSelect, reps, users=[] }) {
  const [theme] = useTheme();
  const gStyle = buildGStyle(theme);
  const [mode,setMode]=useState("choose");
  const [pin,setPin]=useState("");
  const [username,setUsername]=useState("");
  const [pinErr,setPinErr]=useState(false);
  const [search,setSearch]=useState("");
  const filtered=reps.filter(r=>r.name&&r.name.toLowerCase().includes(search.toLowerCase()));

  const tryMgrLogin = async () => {
    const user = users.find(u=>u.username===username&&u.pin===pin&&u.role==="management");
    const legacyOk = !username && pin===MANAGER_PIN;

    // Check lockout
    if(user?.locked_until && new Date(user.locked_until) > new Date()){
      const mins = Math.ceil((new Date(user.locked_until)-new Date())/60000);
      setPinErr(true);
      return;
    }

    if(user) {
      await sbPatch("app_users",user.id,{failed_attempts:0,locked_until:null}).catch(()=>{});
      onSelect("manager", null, user);
    } else if(legacyOk) {
      onSelect("manager", null, {username:"management",display_name:"Management",role:"management"});
    } else {
      // Increment failed attempts
      if(user) {
        const attempts = (user.failed_attempts||0) + 1;
        const lockUntil = attempts >= 5 ? new Date(Date.now() + 15*60*1000).toISOString() : null;
        await sbPatch("app_users",user.id,{failed_attempts:attempts,locked_until:lockUntil}).catch(()=>{});
      }
      setPinErr(true);
    }
  };

  const tryTeamLeadLogin = async () => {
    const user = users.find(u=>u.username===username&&u.pin===pin&&u.role==="team_lead");
    if(user){
      await sbPatch("app_users",user.id,{failed_attempts:0,locked_until:null}).catch(()=>{});
      onSelect("team_lead",null,user);
    } else { setPinErr(true); }
  };

  const tryClientLogin = async () => {
    const user = users.find(u=>u.username===username&&u.pin===pin&&u.role==="client");
    const found = users.find(u=>u.username===username&&u.role==="client");

    if(found?.locked_until && new Date(found.locked_until) > new Date()){
      setPinErr(true);
      return;
    }
    if(user) {
      await sbPatch("app_users",user.id,{failed_attempts:0,locked_until:null}).catch(()=>{});
      onSelect("client", null, user);
    } else {
      if(found) {
        const attempts = (found.failed_attempts||0) + 1;
        const lockUntil = attempts >= 5 ? new Date(Date.now()+15*60*1000).toISOString() : null;
        await sbPatch("app_users",found.id,{failed_attempts:attempts,locked_until:lockUntil}).catch(()=>{});
      }
      setPinErr(true);
    }
  };

  if(mode==="choose") return (
    <div style={{minHeight:"100vh",background:DS.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <style>{gStyle}</style>
      <div style={{position:"absolute",top:16,right:16}}><ThemeToggle size="small"/></div>
      <div style={{marginBottom:36,textAlign:"center"}}>
        <div style={{fontSize:13,fontWeight:700,color:DS.accent,letterSpacing:3,textTransform:"uppercase",marginBottom:12}}>execo</div>
        <h1 style={{margin:"0 0 8px",fontSize:28,fontWeight:700,color:DS.textPri,letterSpacing:"-.5px"}}>ESC Operations</h1>
        <p style={{margin:0,fontSize:13,color:DS.textSec}}>{todayLabel()}</p>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8,width:"100%",maxWidth:300}}>
        {[
          {mode:"pin",       label:"Manager",       sub:"Full oversight & controls",     icon:"⬡"},
          {mode:"team_lead", label:"Team Lead",      sub:"Team view & flag issues",       icon:"◇"},
          {mode:"rep",       label:"Rep",            sub:"Your breaks & performance",     icon:"◎"},
          {mode:"client",    label:"Client portal",  sub:"Hub content management",        icon:"◈"},
        ].map(b=>(
          <button key={b.mode} onClick={()=>setMode(b.mode)} style={{padding:"16px 20px",borderRadius:DS.radius,border:`1px solid ${DS.border}`,background:DS.bgCard,color:DS.textPri,cursor:"pointer",display:"flex",alignItems:"center",gap:14,textAlign:"left",transition:"all .15s"}}>
            <div style={{width:36,height:36,borderRadius:DS.radiusSm,background:DS.accentDim,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:DS.accent,flexShrink:0}}>{b.icon}</div>
            <div><p style={{margin:0,fontSize:14,fontWeight:600,color:DS.textPri}}>{b.label}</p><p style={{margin:"1px 0 0",fontSize:11,color:DS.textSec}}>{b.sub}</p></div>
          </button>
        ))}
      </div>
    </div>
  );

  const authCard = (title, sub, onSubmit, accentColor=DS.accent) => (
    <div style={{minHeight:"100vh",background:DS.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:DS.bgCard,border:`1px solid ${DS.border}`,borderRadius:DS.radiusLg,padding:"32px 28px",width:"100%",maxWidth:320,animation:"popIn .2s ease"}}>
        <button onClick={()=>{setMode("choose");setPin("");setUsername("");setPinErr(false);}} style={{background:"none",border:"none",cursor:"pointer",fontSize:12,color:DS.textSec,marginBottom:24,padding:0,display:"flex",alignItems:"center",gap:6}}>← Back</button>
        <div style={{marginBottom:24}}>
          <p style={{margin:"0 0 4px",fontSize:11,color:accentColor,letterSpacing:2,textTransform:"uppercase",fontWeight:600}}>{sub}</p>
          <h2 style={{margin:0,fontSize:20,fontWeight:700,color:DS.textPri}}>{title}</h2>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:4}}>
          <input value={username} onChange={e=>{setUsername(e.target.value);setPinErr(false);}} placeholder="Username" style={{width:"100%",fontSize:13}}/>
          <input type="password" maxLength={8} value={pin} autoFocus
            onChange={e=>{setPin(e.target.value);setPinErr(false);}}
            onKeyDown={e=>{if(e.key==="Enter") onSubmit();}}
            placeholder="PIN" style={{width:"100%",fontSize:20,textAlign:"center",letterSpacing:10,background:`${DS.bgSurf} !important`}}/>
        </div>
        {pinErr&&<p style={{margin:"0 0 12px",fontSize:12,color:DS.red,textAlign:"center"}}>Incorrect credentials</p>}
        <Btn label="Sign in" onClick={onSubmit} color={accentColor}/>
      </div>
    </div>
  );

  if(mode==="pin") return authCard("Manager sign in", "Management access", tryMgrLogin);
  if(mode==="team_lead") return authCard("Team Lead sign in", "Team lead access", tryTeamLeadLogin, DS.green);
  if(mode==="client") return authCard("Client portal", "Emler — Hub management", tryClientLogin, DS.accentHi);

  return (
    <div style={{minHeight:"100vh",background:DS.bg,display:"flex",flexDirection:"column",alignItems:"center",padding:24,paddingTop:48}}>
      <div style={{width:"100%",maxWidth:380}}>
        <button onClick={()=>setMode("choose")} style={{background:"none",border:"none",cursor:"pointer",fontSize:12,color:DS.textSec,marginBottom:24,padding:0}}>← Back</button>
        <h2 style={{margin:"0 0 4px",fontSize:20,fontWeight:700,color:DS.textPri}}>Who are you?</h2>
        <p style={{margin:"0 0 16px",fontSize:13,color:DS.textSec}}>Select your name to continue</p>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…" style={{width:"100%",marginBottom:12,fontSize:13}}/>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {filtered.map(r=>(
            <button key={r.id} onClick={()=>onSelect("rep",r)} style={{padding:"12px 16px",borderRadius:DS.radius,border:`1px solid ${DS.border}`,background:DS.bgCard,cursor:"pointer",display:"flex",alignItems:"center",gap:12,textAlign:"left",transition:"all .15s"}}>
              <div style={{width:38,height:38,borderRadius:"50%",background:DS.accentDim,border:`1px solid ${DS.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:DS.accent,flexShrink:0}}>{r.avatar||avatar(r.name)}</div>
              <div>
                <p style={{margin:0,fontWeight:600,fontSize:14,color:DS.textPri}}>{r.name}</p>
                <p style={{margin:0,fontSize:11,color:DS.textSec}}>{r.timezone}</p>
              </div>
              <div style={{marginLeft:"auto",fontSize:11,color:DS.textMut}}>{fmtDur(r.health_time_banked||0)}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── MANAGER VIEW ──────────────────────────────────────────────────────
function ManagerView({ data, reload, onLogout, centreOpen, currentUser, submissions=[], pendingCount=0, kpiFileName=null, setKpiFileName }) {
  const { reps, settings, adHoc, swaps, activeBreaks, breakQueue=[] } = data;
  const [tab, setTab] = useState("overview");
  const [toast, setToast] = useState(null);
  const [theme] = useTheme(); // re-render on theme change
  const gStyle = buildGStyle(theme); // empty deps — only run once on mount

  const KPI_COLS = ["hs_deal_id","hs_agent_name","hs_call_timestamp","hs_call_disposition_label","hs_call_direction","contact_preferred_location","deal_stage"];

  const setKpiRowsPersist = async (rows) => {
    if(!Array.isArray(rows)||!rows.length) return;
    const stripped = rows.map(r=>{ const o={}; KPI_COLS.forEach(k=>{ o[k]=r[k]||null; }); return o; });
    console.log(`Upserting ${stripped.length} rows to kpi_bookings...`);
    for(let i=0;i<stripped.length;i+=500){
      const chunk=stripped.slice(i,i+500);
      const res = await fetch(`${SB_URL}/rest/v1/kpi_bookings`,{
        method:"POST",
        headers:{ apikey:SB_KEY, Authorization:`Bearer ${SB_KEY}`, "Content-Type":"application/json", "Prefer":"resolution=merge-duplicates,return=minimal" },
        body:JSON.stringify(chunk)
      });
      if(!res.ok){ const err=await res.text(); console.error(`KPI upsert chunk ${i/500} failed:`,res.status,err); }
      else { console.log(`KPI chunk ${Math.floor(i/500)+1} saved (${chunk.length} rows)`); }
    }
  };

  const setKpiFileNamePersist = async (name) => {
    setKpiFileName(name);
    await fetch(`${SB_URL}/rest/v1/kpi_upload_meta`,{
      method:"POST",
      headers:{ apikey:SB_KEY, Authorization:`Bearer ${SB_KEY}`, "Content-Type":"application/json", "Prefer":"resolution=merge-duplicates,return=minimal" },
      body:JSON.stringify({id:1, last_filename:name, last_uploaded_at:new Date().toISOString()})
    }).catch(e=>console.error("KPI meta save failed:",e));
  };

  const clearKpiData = async () => {
    setKpiFileName(null);
    await sb("kpi_bookings?id=gte.0",{method:"DELETE"}).catch(()=>{});
    await sb("kpi_upload_meta?id=eq.1",{method:"PATCH",body:JSON.stringify({last_filename:null,total_rows:0})}).catch(()=>{});
  };
  const fire = (type,msg) => setToast({type,msg,id:Date.now()});

  const activeReps = reps.filter(r=>!["off","pto","sick"].includes(r.status)&&(r.rep_stage||"active")!=="not_started");
  const maxOut = settings.custom_limit ?? Math.max(2, Math.floor(activeReps.length * 0.3));
  const totalOut = reps.filter(r=>["health","lunch","admin"].includes(r.status)).length;
  const onHealth = reps.filter(r=>r.status==="health").length;
  const onLunch  = reps.filter(r=>r.status==="lunch").length;
  const onAdmin  = reps.filter(r=>r.status==="admin").length;
  const adminLimit = settings.admin_limit ?? 2;
  const hLimit = settings.peak_mode ? H_LIMIT_PEAK : H_LIMIT_NORMAL;
  const notifCount = adHoc.length + swaps.length;

  const tabs = [
    {k:"overview",l:"Overview"},
    {k:"requests",l:`Requests${notifCount>0?` (${notifCount})`:""}`,notif:notifCount>0},
    {k:"team",l:"Team"},
    {k:"schedules",l:"Schedules"},
    {k:"pto",l:"PTO"},
    {k:"reports",l:"Reports"},
    {k:"kpi",l:"📊 KPI"},
    {k:"submissions",l:`🏊 Hub Queue${pendingCount>0?` (${pendingCount})`:""}`,notif:pendingCount>0},
    {k:"users",l:"👥 Users"},
    {k:"settings",l:"Settings"},
    ...(HUB_ENABLED?[{k:"hub",l:"🏊 Hub"}]:[]),
  ];

  return (
    <div style={{fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",minHeight:"100vh",background:DS.bg,paddingBottom:60}}>
      <style>{gStyle}</style>
      {toast&&<Toast key={toast.id} msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}

      {/* Header */}
      <div style={{background:DS.bgCard,borderBottom:`1px solid ${DS.border}`,padding:"14px 18px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{fontSize:11,fontWeight:700,color:DS.accent,letterSpacing:2,textTransform:"uppercase"}}>execo</div>
            <div style={{width:1,height:16,background:DS.border}}/>
            <div>
              <p style={{margin:0,fontSize:13,fontWeight:600,color:DS.textPri}}>ESC Operations</p>
              <p style={{margin:0,fontSize:11,color:DS.textSec}}>{todayLabel()}</p>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {settings.peak_mode&&<span style={{fontSize:10,background:DS.redDim,color:DS.red,padding:"3px 10px",borderRadius:DS.radiusSm,fontWeight:700,border:`1px solid ${DS.red}40`,letterSpacing:.5}}>⚡ PEAK</span>}
            <ThemeToggle size="small"/>
            <span style={{fontSize:11,color:DS.textSec}}>{currentUser?.display_name||"Manager"}</span>
            <button onClick={onLogout} style={{padding:"5px 12px",borderRadius:DS.radiusSm,border:`1px solid ${DS.border}`,background:"transparent",color:DS.textSec,cursor:"pointer",fontSize:11}}>Sign out</button>
          </div>
        </div>

        {!centreOpen&&<div style={{background:DS.amberDim,border:`1px solid ${DS.amber}30`,borderRadius:DS.radiusSm,padding:"6px 12px",marginBottom:10,fontSize:11,color:DS.amber,fontWeight:600}}>Centre closed — opens 2:00pm SAST</div>}

        {centreOpen&&(()=>{
          const risk = getCallRisk();
          return (
            <div style={{background:`${risk.color}15`,border:`1px solid ${risk.color}30`,borderRadius:DS.radiusSm,padding:"6px 12px",marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:11,color:risk.color,fontWeight:600}}>
                {risk.level==="peak"?"⚡ Peak hours":risk.level==="high"?"▲ High volume":risk.level==="safe"?"✓ Quiet window":"● Normal volume"} — {risk.pct>0?`~${risk.pct}% of calls/hr`:"outside operating hours"}
              </span>
              {risk.level==="peak"&&!settings.peak_mode&&<span style={{fontSize:10,color:risk.color,opacity:.8}}>Consider enabling Peak Mode →</span>}
              {risk.level==="safe"&&settings.peak_mode&&<span style={{fontSize:10,color:risk.color,opacity:.8}}>Consider disabling Peak Mode →</span>}
            </div>
          );
        })()}

        {/* Stats row */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:10}}>
          {[
            {n:reps.filter(r=>r.status==="available"&&centreOpen&&isRepOnShift(r)&&(r.rep_stage||"active")!=="not_started").length,l:"Available",c:DS.green},
            {n:centreOpen?onHealth:0,l:`Health (/${hLimit})`,c:onHealth>=hLimit?DS.red:DS.accent},
            {n:centreOpen?onLunch:0,l:`Lunch (/${LUNCH_LIMIT})`,c:onLunch>=LUNCH_LIMIT?DS.red:DS.amber},
            {n:reps.filter(r=>["pto","sick","off"].includes(r.status)).length,l:"Out",c:DS.textSec},
          ].map(s=>(
            <div key={s.l} style={{background:DS.bgSurf,borderRadius:DS.radiusSm,padding:"8px 10px",border:`1px solid ${DS.border}`}}>
              <p style={{margin:0,fontSize:20,fontWeight:700,color:s.c,lineHeight:1}}>{s.n}</p>
              <p style={{margin:"3px 0 0",fontSize:10,color:DS.textMut}}>{s.l}</p>
            </div>
          ))}
        </div>

        {/* Capacity row */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6}}>
          {[
            {label:"Team Cap",val:`${totalOut}/${maxOut}`,full:totalOut>=maxOut},
            {label:"Health",val:`${onHealth}/${hLimit}`,full:onHealth>=hLimit},
            {label:"Lunch",val:`${onLunch}/${LUNCH_LIMIT}`,full:onLunch>=LUNCH_LIMIT},
            {label:"Admin",val:settings.admin_mode?`${onAdmin}/${adminLimit}`:"Off",full:settings.admin_mode&&onAdmin>=adminLimit},
          ].map(m=>(
            <div key={m.label} style={{background:m.full?DS.redDim:DS.bgSurf,borderRadius:DS.radiusSm,padding:"6px 10px",border:`1px solid ${m.full?DS.red+"40":DS.border}`}}>
              <p style={{margin:0,fontSize:10,color:DS.textMut}}>{m.label}</p>
              <p style={{margin:"2px 0 0",fontSize:13,fontWeight:700,color:m.full?DS.red:DS.textPri}}>{m.val}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{background:DS.bgCard,borderBottom:`1px solid ${DS.border}`,overflowX:"auto"}}>
        <div style={{display:"flex",padding:"0 16px",minWidth:"max-content"}}>
          {tabs.map(t=>(
            <button key={t.k} onClick={()=>setTab(t.k)} style={{
              padding:"11px 14px",border:"none",background:"none",cursor:"pointer",
              fontSize:12,fontWeight:tab===t.k?600:400,
              color:tab===t.k?DS.accent:t.notif?DS.amber:DS.textSec,
              borderBottom:tab===t.k?`2px solid ${DS.accent}`:"2px solid transparent",
              marginBottom:-1,transition:"all .15s",whiteSpace:"nowrap",
            }}>{t.l}</button>
          ))}
        </div>
      </div>

      <div style={{padding:"0 14px",maxWidth:720,margin:"0 auto"}}>
        {tab==="overview"  &&<MgrOverview reps={reps} activeBreaks={activeBreaks} hLimit={hLimit} maxOut={maxOut} reload={reload} fire={fire} settings={settings} centreOpen={centreOpen} onAdmin={onAdmin} adminLimit={adminLimit}/>}
        {tab==="requests"  &&<MgrRequests adHoc={adHoc} swaps={swaps} reps={reps} reload={reload} fire={fire} settings={settings}/>}
        {tab==="team"      &&<MgrTeam reps={reps} settings={settings} reload={reload} fire={fire}/>}
        {tab==="schedules" &&<MgrSchedules reps={reps} reload={reload} fire={fire}/>}
        {tab==="reports"   &&<MgrReports reps={reps}/>}
        {tab==="kpi"        &&<MgrKPI reps={reps} kpiFileName={kpiFileName} setKpiFileName={setKpiFileNamePersist} clearKpiData={clearKpiData}/>}
        {tab==="submissions"&&<MgrSubmissions submissions={submissions} reload={reload} fire={fire} currentUser={currentUser} settings={settings}/>}
        {tab==="users"      &&<MgrUsers reload={reload} fire={fire}/>}
        {tab==="settings"  &&<MgrSettings settings={settings} reps={reps} reload={reload} fire={fire}/>}
        {tab==="pto"       &&<MgrPTO reps={reps} reload={reload} fire={fire}/> }
        {tab==="hub"&&HUB_ENABLED&&<HubView isManager={true}/>}
      </div>
    </div>
  );
}

// ── MGR: OVERVIEW ─────────────────────────────────────────────────────
function MgrOverview({ reps, activeBreaks, hLimit, maxOut, reload, fire, settings, centreOpen, onAdmin=0, adminLimit=1 }) {
  const [oooModal, setOooModal] = useState(null);
  const [peakOverride, setPeakOverride] = useState({});

  const handleReturn = async (rep) => {
    const ab = activeBreaks.find(b=>b.rep_id===rep.id);
    const durSec = ab ? elapsedSec(ab.started_at) : 0;
    const newBanked = (rep.health_time_banked||0) + Math.min(durSec, HEALTH_MAX_SEC);
    const updates = { status:"available", updated_at: new Date().toISOString() };
    if(rep.status==="health") {
      updates.health_time_banked = Math.min(newBanked, HEALTH_MAX_SEC);
      updates.last_break_returned_at = new Date().toISOString();
      updates.health_breaks_today = (rep.health_breaks_today||0)+1;
      if((rep.health_breaks_today||0)+1>=HEALTH_PER_DAY) fire("warn",`⚠️ ${rep.name} has used all ${HEALTH_PER_DAY} full breaks today`);
    }
    // Close all open break_log entries for this rep (catches stuck entries)
    await sb(`break_log?rep_id=eq.${rep.id}&ended_at=is.null`,{method:"PATCH",body:JSON.stringify({ended_at:new Date().toISOString(),duration_seconds:Math.min(durSec,HEALTH_MAX_SEC)})});
    await sbPatch("rep_status",rep.id,updates);
    fire("approved",`${rep.name} is back on duty`);
    reload();
  };

  const handleMarkOOO = async (type, note) => {
    await sbPatch("rep_status",oooModal.id,{status:type,ooo_note:note,updated_at:new Date().toISOString()});
    if(type==="sick") {
      await sbPost("calloffs",{rep_id:oooModal.id,rep_name:oooModal.name,calloff_date:todayStr(),reason:"sick",note,logged_by:"manager"});
    }
    fire("ooo",`${oooModal.name} marked as ${type==="pto"?"PTO ✈️":"Sick Day 🤒"}`);
    setOooModal(null); reload();
  };

  const handleClear = async (rep) => {
    await sbPatch("rep_status",rep.id,{status:"available",ooo_note:"",updated_at:new Date().toISOString()});
    fire("info",`${rep.name} is back on duty`);
    reload();
  };

  const resetBalance = async (rep) => {
    await sbPatch("rep_status",rep.id,{health_breaks_today:0,health_time_banked:0,last_break_returned_at:null,updated_at:new Date().toISOString()});
    fire("approved",`${rep.name}'s break balance reset ✅`); reload();
  };

  const handleOverridePeak = async (rep) => {
    setPeakOverride(p=>({...p,[rep.id]:!p[rep.id]}));
    fire("info",`Peak limit ${peakOverride[rep.id]?"restored":"overridden"} for ${rep.name}`);
  };

  const onHealth_ = centreOpen ? reps.filter(r=>r.status==="health") : [];
  const onLunch_  = centreOpen ? reps.filter(r=>r.status==="lunch")  : [];
  const onAdmin_  = centreOpen ? reps.filter(r=>r.status==="admin")  : [];
  const onBreak   = [...onHealth_, ...onLunch_, ...onAdmin_];
  const available = reps.filter(r=>r.status==="available" && centreOpen && isRepOnShift(r) && (r.rep_stage||"active")!=="not_started");
  const offShift  = reps.filter(r=>r.status==="available" && (!centreOpen || !isRepOnShift(r)) && (r.rep_stage||"active")!=="not_started");
  const inTraining = reps.filter(r=>r.status==="available" && r.rep_stage==="not_started");
  const out = reps.filter(r=>["pto","sick","off"].includes(r.status));

  function RepRow({rep}) {
    const effectiveStatus = (rep.status==="available" && (!centreOpen || !isRepOnShift(rep))) ? "off_shift" : rep.status;
    const cfg=ST[effectiveStatus]||ST.available;
    const isBreak=rep.status==="health"||rep.status==="lunch"||rep.status==="admin";
    const isAdmin=rep.status==="admin";
    const isOOO=rep.status==="pto"||rep.status==="sick";
    const isOff=rep.status==="off"||effectiveStatus==="off_shift";
    const tz=TZ_C[rep.timezone]||TZ_C.Central;
    const ab=activeBreaks.find(b=>b.rep_id===rep.id);
    return (
      <div style={{background:cfg.bg,borderRadius:12,padding:"10px 13px",border:`1.5px solid ${cfg.border}`,marginBottom:6}}>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <div style={{width:34,height:34,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,flexShrink:0,background:isOOO?"#ede0f5":isOff?"#eee":isAdmin?"#dbeafe":isBreak?(rep.status==="health"?"#d6eaf8":"#fdebd0"):"#eafaf1",color:isOOO?"#7a1a5c":isOff?"#bbb":isAdmin?"#1d4ed8":isBreak?(rep.status==="health"?"#1a6291":"#9c5a00"):"#1a5c35"}}>{rep.avatar||avatar(rep.name)}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
              <span style={{fontWeight:600,fontSize:13,color:isOff?"#bbb":"#1a1a1a"}}>{rep.name}</span>
              <span style={{fontSize:9,padding:"2px 5px",borderRadius:4,background:tz.bg,color:tz.text,fontWeight:700}}>{rep.timezone}</span>
              <span style={{fontSize:9,padding:"2px 5px",borderRadius:4,background:cfg.bg,color:cfg.dot,border:`1px solid ${cfg.border}`,fontWeight:600}}>{cfg.label}</span>
              {settings.peak_mode&&rep.status==="health"&&peakOverride[rep.id]&&<span style={{fontSize:9,background:DS.amberDim,color:DS.amber,padding:"2px 5px",borderRadius:4}}>Override</span>}
              {rep.rep_stage&&rep.rep_stage!=="active"&&<span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:(STAGE_CFG[rep.rep_stage]||STAGE_CFG.active).bg,color:(STAGE_CFG[rep.rep_stage]||STAGE_CFG.active).text,border:`1px solid ${(STAGE_CFG[rep.rep_stage]||STAGE_CFG.active).border}`,fontWeight:700}}>{rep.rep_stage==="training"?"🎓 Training":rep.rep_stage==="not_started"?"⏳ Not Started":rep.rep_stage==="ramping"?"📈 Ramping":"Unknown"}</span>}
            </div>
            {rep.ooo_note&&<p style={{margin:"2px 0 0",fontSize:10,color:DS.textMut}}>{rep.ooo_note}</p>}
            {rep.status==="health"&&ab&&<HealthTimer startedAt={ab.started_at} bankedSec={rep.health_time_banked||0}/>}
            {rep.status==="health"&&<p style={{margin:"2px 0 0",fontSize:10,color:DS.textSec}}>Breaks today: {rep.health_breaks_today||0}/{HEALTH_PER_DAY}</p>}
            {rep.status==="admin"&&ab&&<p style={{margin:"2px 0 0",fontSize:10,color:"#1d4ed8"}}>🗂️ Admin — {fmtDur(elapsedSec(ab.started_at))} / 30m</p>}
          </div>
          <div style={{display:"flex",gap:5,flexShrink:0,flexDirection:"column",alignItems:"flex-end"}}>
            {isBreak&&<button onClick={()=>handleReturn(rep)} style={{padding:"5px 9px",borderRadius:7,border:`1px solid ${DS.border}`,background:DS.bgSurf,cursor:"pointer",fontSize:11,color:DS.textSec,fontWeight:600}}>Back 👋</button>}
            {isOOO&&<button onClick={()=>handleClear(rep)} style={{padding:"5px 9px",borderRadius:7,border:"1.5px solid #c8a8e0",background:DS.accentDim,cursor:"pointer",fontSize:11,color:"#7a1a5c",fontWeight:600}}>Clear</button>}
            {!isBreak&&!isOOO&&!isOff&&<button onClick={()=>setOooModal(rep)} style={{padding:"5px 9px",borderRadius:7,border:"1.5px solid #ebebeb",background:DS.bgSurf,cursor:"pointer",fontSize:10,color:DS.textMut}}>Mark Out</button>}
            {settings.peak_mode&&rep.status==="health"&&<button onClick={()=>handleOverridePeak(rep)} style={{padding:"4px 8px",borderRadius:6,border:"1.5px solid #f0ad4e",background:DS.amberDim,cursor:"pointer",fontSize:10,color:DS.amber}}>Override</button>}
            {!isOff&&<button onClick={()=>resetBalance(rep)} style={{padding:"4px 8px",borderRadius:6,border:"1.5px solid #f5b7b1",background:DS.redDim,cursor:"pointer",fontSize:10,color:DS.red}}>Reset Breaks</button>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{marginTop:16}}>
      {oooModal&&(
        <OOOModal rep={oooModal} onClose={()=>setOooModal(null)} onMark={handleMarkOOO}/>
      )}
      {onHealth_.length>0&&<Section title="🌿 Health Break" items={onHealth_} Row={RepRow} color={DS.accent}/>}
      {onLunch_.length>0&&<Section title="🥗 On Lunch" items={onLunch_} Row={RepRow} color={DS.amber}/>}
      {onAdmin_.length>0&&<Section title="🗂️ Admin Time" items={onAdmin_} Row={RepRow} color={DS.accentHi}/>}
      {available.length>0&&<Section title="✅ Available" items={available} Row={RepRow} color="#1a5c35"/>}
      {offShift.length>0&&<Section title="🌙 Off Shift" items={offShift} Row={RepRow} color="#999"/>}
      {inTraining.length>0&&<Section title="🎓 Training / Not Started / Ramping" items={inTraining} Row={RepRow} color="#b85c00"/>}
      {out.length>0&&<Section title="Out Today" items={out} Row={RepRow} color="#8e44ad"/>}
    </div>
  );
}

function Section({ title, items, Row, color }) {
  if(!items.length) return null;
  return (
    <div style={{marginBottom:18}}>
      <p style={{fontSize:10,letterSpacing:1.8,textTransform:"uppercase",color:color||"#bbb",margin:"0 0 8px",fontWeight:700}}>{title} ({items.length})</p>
      {items.map(r=><Row key={r.id} rep={r}/>)}
    </div>
  );
}

function OOOModal({ rep, onClose, onMark }) {
  const [type,setType]=useState("pto");
  const [note,setNote]=useState("");
  return (
    <Modal title={rep.name} sub="MARK ABSENCE" onClose={onClose}>
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        {[{k:"pto",l:"PTO ✈️"},{k:"sick",l:"Sick 🤒"}].map(o=>(
          <div key={o.k} onClick={()=>setType(o.k)} style={{flex:1,padding:"10px 0",textAlign:"center",border:type===o.k?"2px solid #8e44ad":"1.5px solid #ddd",borderRadius:12,cursor:"pointer",background:type===o.k?"#f5eefb":"#fff",fontWeight:600,fontSize:13,color:type===o.k?"#7a1a5c":"#555"}}>{o.l}</div>
        ))}
      </div>
      <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Note (e.g. back Monday)" style={{width:"100%",padding:"10px 12px",borderRadius:9,border:`1px solid ${DS.border}`,fontSize:13,marginBottom:14,background:DS.bgSurf,outline:"none"}}/>
      <div style={{display:"flex",gap:8}}>
        <Btn label="Cancel" onClick={onClose} color="#888" outline small/>
        <Btn label="Mark Absence" onClick={()=>onMark(type,note)} color="#8e44ad"/>
      </div>
    </Modal>
  );
}

// ── MGR: REQUESTS ─────────────────────────────────────────────────────
function AdHocImpactSummary({ req, reps, settings }) {
  const TZ_OFFSET = {"Central":-300,"Eastern":-240,"Pacific":-420,"SA":120};

  // Convert requested time to CT minutes
  const getCtMins = () => {
    if(!req.preferred_time) {
      const ct = new Date(new Date().toLocaleString("en-US",{timeZone:"America/Chicago"}));
      return ct.getHours()*60 + ct.getMinutes();
    }
    const [h,m] = req.preferred_time.split(":").map(Number);
    const repOffset = TZ_OFFSET[req.rep_timezone||"Central"];
    return ((h*60+m - repOffset) + 1440) % 1440;
  };

  const ctMins = getCtMins();
  const ctHour = Math.floor(ctMins/60);
  const isWE = new Date().getDay()===0||new Date().getDay()===6;
  const vol = isWE ? CALL_VOL_WEEKEND : CALL_VOL_WEEKDAY;
  const pct = vol[ctHour]||0;
  const risk = (isWE?PEAK_WE:PEAK_WD).has(ctHour) ? "peak" : HIGH_WD.has(ctHour) ? "high" : "low";
  const riskColor = risk==="peak"?DS.red:risk==="high"?DS.amber:DS.green;
  const riskLabel = risk==="peak"?"⚡ Peak hours":risk==="high"?"▲ High volume":"✓ Quiet window";

  // Who's already on lunch or scheduled during this window
  const day = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date().getDay()];
  const alreadyOnLunch = reps.filter(r=>r.status==="lunch").map(r=>r.name);
  const scheduledDuring = reps.filter(r=>{
    if(r.name===req.rep_name) return false;
    const sched = r.lunch_schedule?.[day];
    if(!sched?.time) return false;
    const [lh,lm] = sched.time.split(":").map(Number);
    const lOffset = TZ_OFFSET[r.timezone||"Central"];
    const lUtcMin = ((lh*60+lm - lOffset) + 1440) % 1440;
    const dur = sched.duration||60;
    const reqUtcMin = ((ctMins - TZ_OFFSET["Central"]) + 1440) % 1440;
    return reqUtcMin >= lUtcMin && reqUtcMin < lUtcMin+dur;
  }).map(r=>r.name);

  // Active reps right now
  const activeReps = reps.filter(r=>!["off","pto","sick"].includes(r.status));
  const currentlyAvailable = reps.filter(r=>r.status==="available").length;
  const afterApproval = currentlyAvailable - 1;
  const totalOffPhones = alreadyOnLunch.length + scheduledDuring.length + 1; // +1 for this rep

  return (
    <div style={{background:DS.bgSurf,borderRadius:DS.radiusSm,padding:"10px 12px",margin:"8px 0",border:`1px solid ${riskColor}30`}}>
      <p style={{margin:"0 0 8px",fontSize:10,fontWeight:700,color:DS.textMut,textTransform:"uppercase",letterSpacing:1}}>Impact if approved</p>

      {/* Call volume risk */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
        <span style={{fontSize:11,color:DS.textSec}}>Call volume at {Math.floor(ctMins/60)%12||12}{ctMins<12*60||ctMins>=24*60?"am":"pm"} CT</span>
        <span style={{fontSize:11,fontWeight:700,color:riskColor,background:`${riskColor}15`,padding:"2px 8px",borderRadius:4}}>{riskLabel} {pct>0?`~${pct}%`:""}</span>
      </div>

      {/* Coverage impact */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
        <span style={{fontSize:11,color:DS.textSec}}>Reps available after</span>
        <span style={{fontSize:11,fontWeight:700,color:afterApproval<=2?DS.red:afterApproval<=4?DS.amber:DS.green}}>{afterApproval} of {activeReps.length} on phones</span>
      </div>

      {/* Others already off */}
      {scheduledDuring.length>0&&(
        <div style={{marginBottom:4}}>
          <span style={{fontSize:10,color:DS.textMut}}>Also on lunch this window: </span>
          <span style={{fontSize:10,color:DS.amber,fontWeight:600}}>{scheduledDuring.join(", ")}</span>
        </div>
      )}
      {alreadyOnLunch.length>0&&(
        <div style={{marginBottom:4}}>
          <span style={{fontSize:10,color:DS.textMut}}>Currently on lunch: </span>
          <span style={{fontSize:10,color:DS.amber,fontWeight:600}}>{alreadyOnLunch.join(", ")}</span>
        </div>
      )}

      {/* Summary verdict */}
      <div style={{marginTop:8,padding:"6px 10px",borderRadius:DS.radiusSm,background:`${riskColor}10`,border:`1px solid ${riskColor}20`}}>
        <p style={{margin:0,fontSize:11,color:riskColor,fontWeight:600}}>
          {risk==="peak"&&afterApproval<=3 ? "⚠️ High risk — peak hours with low coverage" :
           risk==="peak" ? "⚠️ Peak hours — approve only if necessary" :
           risk==="high"&&afterApproval<=3 ? "⚡ Caution — above average volume, thin coverage" :
           afterApproval<=2 ? "⚠️ Very thin coverage — only 2 reps on phones" :
           "✓ Coverage looks acceptable for this time"}
        </p>
      </div>
    </div>
  );
}

function MgrRequests({ adHoc, swaps, reps, reload, fire, settings={} }) {
  const TZ_OFFSET = {"Central":-300,"Eastern":-240,"Pacific":-420,"SA":120};
  const MGR_TZ = "Central"; // manager always views in CT

  // Convert rep's preferred time to CT
  const toMgrTz = (timeStr, repTz) => {
    if(!timeStr) return null;
    try {
      const [h,m] = timeStr.split(":").map(Number);
      const repOffset = TZ_OFFSET[repTz]||TZ_OFFSET["Central"];
      const mgrOffset = TZ_OFFSET[MGR_TZ];
      const utcMin = h*60+m - repOffset;
      const ctMin = ((utcMin + mgrOffset) + 1440) % 1440;
      return `${String(Math.floor(ctMin/60)).padStart(2,"0")}:${String(ctMin%60).padStart(2,"0")} CT`;
    } catch { return timeStr; }
  };

  // Check if preferred time falls in peak window
  const isPeak = (timeStr, repTz) => {
    if(!timeStr) return false;
    const [h,m] = timeStr.split(":").map(Number);
    const repOffset = TZ_OFFSET[repTz]||TZ_OFFSET["Central"];
    const utcMin = ((h*60+m - repOffset) + 1440) % 1440;
    return (utcMin>=14*60&&utcMin<16*60)||(utcMin>=19*60&&utcMin<21*60);
  };

  // Count who's on lunch at requested time
  const conflictsAtTime = (timeStr, repTz) => {
    if(!timeStr) return [];
    const [h,m] = timeStr.split(":").map(Number);
    const repOffset = TZ_OFFSET[repTz]||TZ_OFFSET["Central"];
    const reqUtcMin = ((h*60+m - repOffset) + 1440) % 1440;
    const day = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date().getDay()];
    return reps.filter(r=>{
      const sched = r.lunch_schedule?.[day];
      if(!sched?.time) return false;
      const [lh,lm] = sched.time.split(":").map(Number);
      const lOffset = TZ_OFFSET[r.timezone]||TZ_OFFSET["Central"];
      const lUtcMin = ((lh*60+lm - lOffset) + 1440) % 1440;
      const dur = sched.duration||60;
      return reqUtcMin >= lUtcMin && reqUtcMin < lUtcMin+dur;
    }).map(r=>r.name);
  };

  const EXECO_WEBHOOK = settings.execo_webhook;
  const ping = makePinger(settings.notif_prefs||{}, EXECO_WEBHOOK);
  const excooPing = (key, text) => ping.execo(key, text);

  const handleAdHoc = async (req, approve) => {
    await sbPatch("adhoc_lunch_requests",req.id,{status:approve?"approved":"declined"});
    if(approve) {
      const rep = reps.find(r=>r.id===req.rep_id);
      if(rep) {
        await sbPatch("rep_status",rep.id,{status:"lunch",updated_at:new Date().toISOString()});
        await sbPost("break_log",{rep_id:rep.id,rep_name:rep.name,break_type:"lunch"});
      }
      const ctTime = req.preferred_time ? toMgrTz(req.preferred_time, req.rep_timezone||"Central") : "now";
      excooPing("adhoc_approved",`✅ Ad hoc lunch *approved* for ${req.rep_name} at ${ctTime}${req.note?` — "${req.note}"`:""}`);
      fire("approved",`Ad hoc lunch approved for ${req.rep_name}`);
    } else {
      excooPing("adhoc_declined",`❌ Ad hoc lunch *declined* for ${req.rep_name}`);
      fire("declined",`Ad hoc lunch declined for ${req.rep_name}`);
    }
    reload();
  };

  // Ping Execo when new adhoc request arrives — triggered from rep side
  // (we detect new requests by checking if any lack an execo_pinged flag)

  const handleSwap = async (swap, approve) => {
    try {
      await sb(`lunch_swaps?id=eq.${swap.id}`,{method:"PATCH",body:JSON.stringify({status:approve?"approved":"declined"})});
      if(approve) {
        const repA = reps.find(r=>r.id===swap.requester_id);
        const repB = reps.find(r=>r.id===swap.target_id);
        if(repA&&repB) {
          const day = todayDay();
          const schA = JSON.parse(JSON.stringify(repA.lunch_schedule||{}));
          const schB = JSON.parse(JSON.stringify(repB.lunch_schedule||{}));
          const tmpA = schA[day]||null;
          schA[day] = schB[day]||null;
          schB[day] = tmpA;
          await sbPatch("rep_status",repA.id,{lunch_schedule:schA});
          await sbPatch("rep_status",repB.id,{lunch_schedule:schB});
        }
        excooPing("swap_approved",`🔄 Lunch swap *approved* — ${swap.requester_name} ↔ ${swap.target_name}`);
        fire("approved",`Lunch swap approved ✓`);
      } else {
        fire("info","Swap declined");
      }
      reload();
    } catch(e) {
      fire("declined",`Error: ${e.message}`);
    }
  };

  return (
    <div style={{marginTop:16}}>
      {adHoc.length===0&&swaps.length===0&&(
        <div style={{textAlign:"center",padding:"44px 0",color:DS.textMut}}>
          <p style={{fontSize:32,margin:"0 0 8px"}}>✅</p>
          <p style={{fontWeight:600,fontSize:15,color:DS.textSec}}>No pending requests</p>
        </div>
      )}
      {adHoc.length>0&&(
        <div style={{marginBottom:20}}>
          <p style={{fontSize:10,letterSpacing:1.8,textTransform:"uppercase",color:"#e07b00",margin:"0 0 8px",fontWeight:700}}>🥗 Ad Hoc Lunch Requests ({adHoc.length})</p>
          {adHoc.map(r=>{
            const ctTime = r.preferred_time ? toMgrTz(r.preferred_time, r.rep_timezone||"Central") : null;
            const peak = r.preferred_time && isPeak(r.preferred_time, r.rep_timezone||"Central");
            const conflicts = r.preferred_time ? conflictsAtTime(r.preferred_time, r.rep_timezone||"Central") : [];
            const onLunchNow = reps.filter(x=>x.status==="lunch").length;
            const capLeft = (settings.custom_limit??Math.floor(reps.filter(x=>!["off","pto","sick"].includes(x.status)).length*0.3)) - reps.filter(x=>["health","lunch","admin"].includes(x.status)).length;

            return (
              <div key={r.id} style={{background:DS.amberDim,border:`1px solid ${peak?DS.red:DS.amber}40`,borderRadius:12,padding:"12px 14px",marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8,marginBottom:10}}>
                  <div>
                    <p style={{margin:0,fontWeight:700,fontSize:14}}>{r.rep_name}</p>
                    <p style={{margin:"2px 0 0",fontSize:11,color:DS.textSec}}>Requested at: {r.requested_time} · TZ: {r.rep_timezone||"Central"}</p>
                    {r.note&&<p style={{margin:"4px 0 0",fontSize:12,color:DS.textSec,fontStyle:"italic"}}>"{r.note}"</p>}
                  </div>
                </div>

                {/* Preferred time */}
                {ctTime&&(
                  <div style={{background:DS.bgCard,borderRadius:8,padding:"8px 10px",marginBottom:8,border:"1px solid #f0c080"}}>
                    <p style={{margin:0,fontSize:12,fontWeight:600,color:DS.textPri}}>⏰ Preferred time: <span style={{color:"#e07b00"}}>{r.preferred_time} {r.rep_timezone} → {ctTime}</span></p>
                  </div>
                )}

                {/* Impact Summary with real call volume data */}
                <AdHocImpactSummary req={r} reps={reps} settings={settings}/>

                <div style={{display:"flex",gap:6}}>
                  <button onClick={()=>handleAdHoc(r,false)} style={{padding:"7px 14px",borderRadius:DS.radiusSm,border:`1px solid ${DS.red}40`,background:DS.redDim,cursor:"pointer",fontSize:12,color:DS.red,fontWeight:600}}>Decline</button>
                  <button onClick={()=>handleAdHoc(r,true)} style={{flex:1,padding:"7px",borderRadius:DS.radiusSm,border:"none",background:DS.accent,cursor:"pointer",fontSize:12,color:"#fff",fontWeight:600}}>Approve</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {swaps.length>0&&(
        <div>
          <p style={{fontSize:10,letterSpacing:1.8,textTransform:"uppercase",color:"#8e44ad",margin:"0 0 8px",fontWeight:700}}>🔄 Lunch Swap Requests ({swaps.length})</p>
          {swaps.map(s=>(
            <div key={s.id} style={{background:DS.accentDim,border:"1.5px solid #d7aef0",borderRadius:12,padding:"12px 14px",marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
                <div>
                  <p style={{margin:0,fontWeight:600,fontSize:14}}>{s.requester_name} ↔ {s.target_name}</p>
                  <p style={{margin:"3px 0 0",fontSize:12,color:DS.textSec}}>{s.requester_name}: {s.requester_date} · {s.target_name}: {s.target_date}</p>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={()=>handleSwap(s,false)} style={{padding:"6px 12px",borderRadius:8,border:"1.5px solid #f5b7b1",background:DS.redDim,cursor:"pointer",fontSize:12,color:DS.red,fontWeight:600}}>Decline</button>
                  <button onClick={()=>handleSwap(s,true)} style={{padding:"6px 12px",borderRadius:8,border:"none",background:"#8e44ad",cursor:"pointer",fontSize:12,color:"#fff",fontWeight:600}}>Approve</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── MGR: TEAM ─────────────────────────────────────────────────────────
function MgrTeam({ reps, settings, reload, fire }) {
  const [addModal, setAddModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const handleDelete = async () => {
    if(deleteConfirm!==deleteModal.name){fire("declined","Name doesn't match");return;}
    await sbDel("rep_status",deleteModal.id);
    await sb(`break_log?rep_id=eq.${deleteModal.id}`,{method:"DELETE"});
    await sb(`calloffs?rep_id=eq.${deleteModal.id}`,{method:"DELETE"});
    fire("info",`${deleteModal.name} removed`);
    setDeleteModal(null); setDeleteConfirm(""); reload();
  };

  const handleLogCalloff = async (rep) => {
    await sbPatch("rep_status",rep.id,{status:"sick",ooo_note:"Call-off",updated_at:new Date().toISOString()});
    await sbPost("calloffs",{rep_id:rep.id,rep_name:rep.name,calloff_date:todayStr(),reason:"call_off",note:"Logged by manager",logged_by:"manager"});
    fire("ooo",`${rep.name} logged as call-off`);
    reload();
  };

  return (
    <div style={{marginTop:16}}>
      {addModal&&<AddRepModal onClose={()=>setAddModal(false)} onAdd={async(d)=>{await sbPost("rep_status",d);fire("approved",`${d.name} added`);setAddModal(false);reload();}}/>}
      {deleteModal&&(
        <Modal title={`Delete ${deleteModal.name}?`} sub="PERMANENT" onClose={()=>{setDeleteModal(null);setDeleteConfirm("");}}>
          <p style={{fontSize:13,color:DS.textSec,marginBottom:14}}>This will permanently remove {deleteModal.name} and all their break history. Type their name to confirm.</p>
          <input value={deleteConfirm} onChange={e=>setDeleteConfirm(e.target.value)} placeholder={deleteModal.name} style={{width:"100%",padding:"10px 12px",borderRadius:9,border:`1px solid ${DS.border}`,fontSize:13,marginBottom:14,outline:"none"}}/>
          <div style={{display:"flex",gap:8}}>
            <Btn label="Cancel" onClick={()=>{setDeleteModal(null);setDeleteConfirm("");}} outline color="#888" small/>
            <Btn label="Delete Permanently" onClick={handleDelete} color="#e74c3c"/>
          </div>
        </Modal>
      )}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <p style={{fontSize:10,letterSpacing:1.8,textTransform:"uppercase",color:DS.textMut,margin:0,fontWeight:700}}>Team ({reps.length})</p>
        <button onClick={()=>setAddModal(true)} style={{padding:"6px 14px",borderRadius:8,border:"none",background:"#1a5c35",color:"#fff",cursor:"pointer",fontSize:12,fontWeight:600}}>+ Add Rep</button>
      </div>
      {reps.map(rep=>{
        const cfg=ST[rep.status]||ST.available;
        const tz=TZ_C[rep.timezone]||TZ_C.Central;
        const cooldownActive = !!(rep.health_time_banked>=HEALTH_MAX_SEC && rep.last_break_returned_at && elapsedSec(rep.last_break_returned_at)<COOLDOWN_SEC);
        const cooldownLeft = cooldownActive ? COOLDOWN_SEC - elapsedSec(rep.last_break_returned_at) : 0;
        const stage = rep.rep_stage||"active";
        const stageCfg = STAGE_CFG[stage]||STAGE_CFG.active;
        return (
          <div key={rep.id} style={{background:DS.bgCard,border:`1px solid ${DS.border}`,borderRadius:12,padding:"11px 13px",marginBottom:7}}>
            <div style={{display:"flex",alignItems:"center",gap:9}}>
              <div style={{width:34,height:34,borderRadius:"50%",background:DS.greenDim,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:DS.green,flexShrink:0}}>{rep.avatar||avatar(rep.name)}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
                  <span style={{fontWeight:600,fontSize:13}}>{rep.name}</span>
                  <span style={{fontSize:9,padding:"2px 5px",borderRadius:4,background:tz.bg,color:tz.text,fontWeight:700}}>{rep.timezone}</span>
                  <StatusDot status={rep.status}/>
                  <span style={{fontSize:11,color:cfg.dot}}>{cfg.label}</span>
                </div>
                <div style={{display:"flex",gap:6,marginTop:4,alignItems:"center",flexWrap:"wrap"}}>
                  <select
                    value={stage}
                    onChange={async e=>{
                      await sbPatch("rep_status",rep.id,{rep_stage:e.target.value,updated_at:new Date().toISOString()});
                      if(e.target.value==="ramping"){
                        const dateStr = prompt("Enter ramp start date (YYYY-MM-DD):", new Date().toISOString().split("T")[0]);
                        if(dateStr) await sbPatch("rep_status",rep.id,{ramp_start_date:dateStr,updated_at:new Date().toISOString()});
                      }
                      fire("info",`${rep.name} → ${STAGE_CFG[e.target.value]?.label}`);
                      reload();
                    }}
                    style={{fontSize:10,padding:"2px 7px",borderRadius:6,border:`1.5px solid ${stageCfg.border}`,background:stageCfg.bg,color:stageCfg.text,fontWeight:700,cursor:"pointer",outline:"none"}}
                  >
                    <option value="active">✅ Active</option>
                    <option value="training">🎓 Training</option>
                    <option value="not_started">⏳ Not Started</option>
                    <option value="ramping">📈 Ramping</option>
                  </select>
                  <span style={{fontSize:10,color:DS.textMut}}>🌿 {rep.health_breaks_today||0}/{HEALTH_PER_DAY} today</span>
                  {cooldownActive&&<span style={{fontSize:10,color:"#e07b00"}}>⏳ {fmtTime(cooldownLeft)}</span>}
                </div>
              </div>
              <div style={{display:"flex",gap:5,flexShrink:0}}>
                <button onClick={()=>handleLogCalloff(rep)} style={{padding:"4px 8px",borderRadius:6,border:"1.5px solid #f5b7b1",background:DS.redDim,cursor:"pointer",fontSize:10,color:DS.red,fontWeight:600}}>Call-off</button>
                <button onClick={()=>setDeleteModal(rep)} style={{padding:"4px 8px",borderRadius:6,border:`1px solid ${DS.border}`,background:DS.bgSurf,cursor:"pointer",fontSize:10,color:DS.textMut}}>Delete</button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AddRepModal({ onClose, onAdd }) {
  const [form,setForm]=useState({name:"",timezone:"Central",shift_days:[],lunch_schedule:{},health_breaks_today:0,health_time_banked:0,status:"available",ooo_note:"",rep_stage:"not_started",ramp_start_date:""});
  const set = (k,v) => setForm(p=>({...p,[k]:v}));
  const toggleDay = d => set("shift_days",form.shift_days.includes(d)?form.shift_days.filter(x=>x!==d):[...form.shift_days,d]);
  const setDay = (day,field,val) => setForm(prev=>({...prev,lunch_schedule:{...prev.lunch_schedule,[day]:{...(prev.lunch_schedule[day]||{start:"",end:"",time:"",duration:60}),[field]:val}}}));
  return (
    <Modal title="Add Team Member" sub="NEW REP" onClose={onClose} wide>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div>
            <label style={{fontSize:12,color:DS.textSec,display:"block",marginBottom:4}}>Full Name</label>
            <input value={form.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. Jordan Smith" style={{width:"100%",padding:"9px 12px",borderRadius:9,border:`1px solid ${DS.border}`,fontSize:13,outline:"none"}}/>
          </div>
          <div>
            <label style={{fontSize:12,color:DS.textSec,display:"block",marginBottom:4}}>Stage</label>
            <select value={form.rep_stage} onChange={e=>set("rep_stage",e.target.value)} style={{width:"100%",padding:"9px 12px",borderRadius:9,border:`1.5px solid ${(STAGE_CFG[form.rep_stage]||STAGE_CFG.active).border}`,background:(STAGE_CFG[form.rep_stage]||STAGE_CFG.active).bg,color:(STAGE_CFG[form.rep_stage]||STAGE_CFG.active).text,fontSize:13,outline:"none",fontWeight:600}}>
              <option value="not_started">⏳ Not Started</option>
              <option value="training">🎓 Training</option>
              <option value="active">✅ Active</option>
              <option value="ramping">📈 Ramping</option>
            </select>
          </div>
        </div>
        {form.rep_stage==="ramping"&&(
          <div>
            <label style={{fontSize:12,color:"#1d4ed8",display:"block",marginBottom:4,fontWeight:600}}>📈 Ramp Start Date</label>
            <input type="date" value={form.ramp_start_date} onChange={e=>set("ramp_start_date",e.target.value)}
              style={{width:"100%",padding:"9px 12px",borderRadius:9,border:"1.5px solid #bfdbfe",fontSize:13,outline:"none",background:"#eff6ff",color:"#1d4ed8"}}/>
            <p style={{margin:"4px 0 0",fontSize:10,color:DS.textSec}}>Week 1 targets start from this date</p>
          </div>
        )}
        <div>
          <label style={{fontSize:12,color:DS.textSec,display:"block",marginBottom:4}}>Timezone</label>
          <select value={form.timezone} onChange={e=>set("timezone",e.target.value)} style={{width:"100%",padding:"9px 12px",borderRadius:9,border:`1px solid ${DS.border}`,fontSize:13,outline:"none",background:DS.bgCard}}>
            {TZLIST.map(t=><option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={{fontSize:12,color:DS.textSec,display:"block",marginBottom:6}}>Working Days</label>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {DAYS.map(d=>(
              <div key={d} onClick={()=>toggleDay(d)} style={{padding:"5px 10px",borderRadius:8,border:form.shift_days.includes(d)?"2px solid #1a5c35":"1.5px solid #ddd",background:form.shift_days.includes(d)?"#f0faf4":"#fff",cursor:"pointer",fontSize:12,fontWeight:600,color:form.shift_days.includes(d)?"#1a5c35":"#555"}}>{d}</div>
            ))}
          </div>
        </div>
        {form.shift_days.length>0&&(
          <div>
            <label style={{fontSize:12,color:DS.textSec,display:"block",marginBottom:6}}>Schedule Per Day</label>
            <div style={{display:"grid",gridTemplateColumns:"44px 1fr 1fr 1fr 70px",gap:6,marginBottom:4}}>
              <span style={{fontSize:10,color:DS.textMut,fontWeight:600}}>Day</span>
              <span style={{fontSize:10,color:DS.textMut,fontWeight:600}}>Start</span>
              <span style={{fontSize:10,color:DS.textMut,fontWeight:600}}>End</span>
              <span style={{fontSize:10,color:DS.textMut,fontWeight:600}}>Lunch time</span>
              <span style={{fontSize:10,color:DS.textMut,fontWeight:600}}>Duration</span>
            </div>
            {form.shift_days.map(d=>(
              <div key={d} style={{display:"grid",gridTemplateColumns:"44px 1fr 1fr 1fr 70px",gap:6,alignItems:"center",marginBottom:7}}>
                <span style={{fontSize:12,fontWeight:700,color:DS.green}}>{d}</span>
                <div style={{display:"flex",gap:2,alignItems:"center"}}>
                    <select value={((form.lunch_schedule[d]||{}).start||"").split(":")[0]||""} onChange={e=>setDay(d,"start",`${e.target.value.padStart(2,"0")}:${((form.lunch_schedule[d]||{}).start||"").split(":")[1]||"00"}`)} style={{padding:"4px 3px",borderRadius:6,border:`1px solid ${DS.border}`,fontSize:10,outline:"none",background:DS.bgCard,width:46}}>
                      <option value="">HH</option>
                      {Array.from({length:24},(_,i)=><option key={i} value={String(i).padStart(2,"0")}>{String(i).padStart(2,"0")}</option>)}
                    </select>
                    <span style={{fontSize:11,color:DS.textMut}}>:</span>
                    <select value={((form.lunch_schedule[d]||{}).start||"").split(":")[1]||""} onChange={e=>setDay(d,"start",`${((form.lunch_schedule[d]||{}).start||"").split(":")[0]||"00"}:${e.target.value}`)} style={{padding:"4px 3px",borderRadius:6,border:`1px solid ${DS.border}`,fontSize:10,outline:"none",background:DS.bgCard,width:42}}>
                      <option value="">MM</option>
                      {["00","15","30","45"].map(m=><option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                <div style={{display:"flex",gap:2,alignItems:"center"}}>
                    <select value={((form.lunch_schedule[d]||{}).end||"").split(":")[0]||""} onChange={e=>setDay(d,"end",`${e.target.value.padStart(2,"0")}:${((form.lunch_schedule[d]||{}).end||"").split(":")[1]||"00"}`)} style={{padding:"4px 3px",borderRadius:6,border:`1px solid ${DS.border}`,fontSize:10,outline:"none",background:DS.bgCard,width:46}}>
                      <option value="">HH</option>
                      {Array.from({length:24},(_,i)=><option key={i} value={String(i).padStart(2,"0")}>{String(i).padStart(2,"0")}</option>)}
                    </select>
                    <span style={{fontSize:11,color:DS.textMut}}>:</span>
                    <select value={((form.lunch_schedule[d]||{}).end||"").split(":")[1]||""} onChange={e=>setDay(d,"end",`${((form.lunch_schedule[d]||{}).end||"").split(":")[0]||"00"}:${e.target.value}`)} style={{padding:"4px 3px",borderRadius:6,border:`1px solid ${DS.border}`,fontSize:10,outline:"none",background:DS.bgCard,width:42}}>
                      <option value="">MM</option>
                      {["00","15","30","45"].map(m=><option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                <div style={{display:"flex",gap:2,alignItems:"center"}}>
                    <select value={((form.lunch_schedule[d]||{}).time||"").split(":")[0]||""} onChange={e=>setDay(d,"time",`${e.target.value.padStart(2,"0")}:${((form.lunch_schedule[d]||{}).time||"").split(":")[1]||"00"}`)} style={{padding:"4px 3px",borderRadius:6,border:`1px solid ${DS.border}`,fontSize:10,outline:"none",background:DS.bgCard,width:46}}>
                      <option value="">HH</option>
                      {Array.from({length:24},(_,i)=><option key={i} value={String(i).padStart(2,"0")}>{String(i).padStart(2,"0")}</option>)}
                    </select>
                    <span style={{fontSize:11,color:DS.textMut}}>:</span>
                    <select value={((form.lunch_schedule[d]||{}).time||"").split(":")[1]||""} onChange={e=>setDay(d,"time",`${((form.lunch_schedule[d]||{}).time||"").split(":")[0]||"00"}:${e.target.value}`)} style={{padding:"4px 3px",borderRadius:6,border:`1px solid ${DS.border}`,fontSize:10,outline:"none",background:DS.bgCard,width:42}}>
                      <option value="">MM</option>
                      {["00","15","30","45"].map(m=><option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                <select value={(form.lunch_schedule[d]||{}).duration||60} onChange={e=>setDay(d,"duration",parseInt(e.target.value))} style={{padding:"6px 7px",borderRadius:7,border:`1px solid ${DS.border}`,fontSize:11,outline:"none",background:DS.bgCard}}>
                  <option value={30}>30m</option><option value={60}>1hr</option>
                </select>
              </div>
            ))}
          </div>
        )}
        <div style={{display:"flex",gap:8,marginTop:4}}>
          <Btn label="Cancel" onClick={onClose} outline color="#888" small/>
          <Btn label="Add Rep" onClick={()=>{if(!form.name.trim()){return;}const{id:_,...d}=form;onAdd({...d,avatar:avatar(form.name)});}}/>
        </div>
      </div>
    </Modal>
  );
}

// ── MGR: SCHEDULES ────────────────────────────────────────────────────
function LunchOptimiser({ reps, reload, fire }) {
  const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const today = DAYS[new Date().getDay()];
  const [day, setDay] = useState(today);
  const [applying, setApplying] = useState({});
  const [applied, setApplied] = useState({});

  function ctMinutes(h, m, tz) {
    const offsets = {Central:0, Eastern:1, Pacific:-2, SA:7, GMT:5, IST:-5};
    return h*60 + m - (offsets[tz]||0)*60;
  }
  function fmtCT(mins) {
    const norm = ((mins%1440)+1440)%1440;
    const h = Math.floor(norm/60), m = norm%60;
    return `${h%12||12}:${String(m).padStart(2,"0")}${h>=12?"pm":"am"}`;
  }
  function fmtTime(mins) {
    const norm = ((mins%1440)+1440)%1440;
    const h = Math.floor(norm/60), m = norm%60;
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
  }
  function volRisk(ctMin) {
    const h = Math.floor(((ctMin%1440)+1440)%1440/60);
    const isWE = new Date().getDay()===0||new Date().getDay()===6;
    const vol = isWE ? CALL_VOL_WEEKEND : CALL_VOL_WEEKDAY;
    const pct = vol[h]||0;
    if((isWE?PEAK_WE:PEAK_WD).has(h)) return {level:"peak", color:DS.red, pct, h};
    if(!isWE&&HIGH_WD.has(h)) return {level:"high", color:DS.amber, pct, h};
    return {level:"ok", color:DS.green, pct, h};
  }

  // Get scheduled reps for selected day
  const scheduled = reps
    .filter(r=>!["off","pto","sick"].includes(r.status) && (r.lunch_schedule||{})[day]?.time)
    .map(r=>{
      const s = r.lunch_schedule[day];
      const [h,m] = s.time.split(":").map(Number);
      const dur = s.duration||60;
      const startCT = ctMinutes(h, m, r.timezone||"Central");
      return { id:r.id, name:r.name, tz:r.timezone||"Central", localTime:s.time, dur, startCT, endCT:startCT+dur };
    });

  // Generate suggestions
  const suggestions = [];

  // 1. Conflict: two reps overlapping
  for(let i=0;i<scheduled.length;i++){
    for(let j=i+1;j<scheduled.length;j++){
      const a=scheduled[i], b=scheduled[j];
      if(a.startCT < b.endCT && b.startCT < a.endCT){
        // Find best alternative for the later one
        const mover = a.startCT > b.startCT ? a : b;
        const stayer = a.startCT > b.startCT ? b : a;
        // Try slots 30 min before or after with lowest risk
        const candidates = [-60,-30,30,60,90].map(delta=>{
          const newCT = mover.startCT + delta;
          const risk = volRisk(newCT);
          // Check no new conflicts
          const hasConflict = scheduled.some(r=>r.id!==mover.id && newCT < r.endCT && (newCT+mover.dur) > r.startCT);
          return {delta, newCT, risk, hasConflict};
        }).filter(c=>!c.hasConflict).sort((a,b)=>a.risk.pct-b.risk.pct);

        if(candidates.length>0){
          const best = candidates[0];
          // Convert back to local time for mover
          const offsets = {Central:0, Eastern:1, Pacific:-2, SA:7, GMT:5, IST:-5};
          const localMins = ((best.newCT + (offsets[mover.tz]||0)*60) % 1440 + 1440) % 1440;
          suggestions.push({
            id: `conflict-${i}-${j}`,
            type: "conflict",
            title: `${a.name} & ${b.name} overlap`,
            desc: `Both off phones ${fmtCT(Math.max(a.startCT,b.startCT))} CT. Move ${mover.name}'s lunch to ${fmtCT(best.newCT)} CT (${fmtTime(localMins)} ${mover.tz}).`,
            risk: best.risk,
            action: { repId: mover.id, day, newTime: fmtTime(localMins) },
            severity: "high"
          });
        } else {
          suggestions.push({
            id: `conflict-${i}-${j}`,
            type: "conflict",
            title: `${a.name} & ${b.name} overlap`,
            desc: `Both off phones ${fmtCT(Math.max(a.startCT,b.startCT))} CT. No clean alternative found — manual adjustment needed.`,
            risk: {level:"peak", color:DS.red},
            action: null,
            severity: "high"
          });
        }
      }
    }
  }

  // 2. Peak-hour lunches
  scheduled.forEach(r=>{
    const risk = volRisk(r.startCT);
    if(risk.level==="peak"){
      // Find best alternative
      const candidates = [-90,-60,-30,30,60,90].map(delta=>{
        const newCT = r.startCT + delta;
        const newRisk = volRisk(newCT);
        const hasConflict = scheduled.some(s=>s.id!==r.id && newCT < s.endCT && (newCT+r.dur) > s.startCT);
        return {delta, newCT, risk:newRisk, hasConflict};
      }).filter(c=>!c.hasConflict && c.risk.level!=="peak").sort((a,b)=>a.risk.pct-b.risk.pct);

      if(candidates.length>0){
        const best = candidates[0];
        const offsets = {Central:0, Eastern:1, Pacific:-2, SA:7, GMT:5, IST:-5};
        const localMins = ((best.newCT + (offsets[r.tz]||0)*60) % 1440 + 1440) % 1440;
        // Skip if already covered by conflict suggestion
        const alreadyFlagged = suggestions.some(s=>s.action?.repId===r.id);
        if(!alreadyFlagged){
          suggestions.push({
            id: `peak-${r.id}`,
            type: "peak",
            title: `${r.name} lunching at peak (${fmtCT(r.startCT)} CT)`,
            desc: `~${risk.pct}% of daily calls happen at this hour. Suggest moving to ${fmtCT(best.newCT)} CT (${fmtTime(localMins)} ${r.tz}) — ~${best.risk.pct}% volume.`,
            risk: best.risk,
            action: { repId: r.id, day, newTime: fmtTime(localMins) },
            severity: "medium"
          });
        }
      }
    }
  });

  const approveChange = async (sug) => {
    if(!sug.action) return;
    setApplying(p=>({...p,[sug.id]:true}));
    const rep = reps.find(r=>r.id===sug.action.repId);
    if(!rep) return;
    const updatedSchedule = {...(rep.lunch_schedule||{})};
    updatedSchedule[sug.action.day] = {...(updatedSchedule[sug.action.day]||{}), time: sug.action.newTime};
    await sbPatch("rep_status", rep.id, {lunch_schedule: updatedSchedule});
    setApplied(p=>({...p,[sug.id]:true}));
    setApplying(p=>({...p,[sug.id]:false}));
    fire("approved", `${rep.name}'s lunch updated to ${sug.action.newTime}`);
    reload();
  };

  return (
    <div style={{background:DS.bgCard,border:`1px solid ${DS.border}`,borderRadius:DS.radius,padding:"14px",marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div>
          <p style={{margin:0,fontSize:13,fontWeight:600,color:DS.textPri}}>🥗 Lunch Schedule Optimiser</p>
          <p style={{margin:"2px 0 0",fontSize:11,color:DS.textSec}}>AI-powered suggestions based on real call volume · {scheduled.length} reps scheduled</p>
        </div>
        <select value={day} onChange={e=>setDay(e.target.value)} style={{padding:"6px 10px",fontSize:12,borderRadius:DS.radiusSm}}>
          {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d=><option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {suggestions.length===0&&scheduled.length>0&&(
        <div style={{background:DS.greenDim,border:`1px solid ${DS.green}30`,borderRadius:DS.radiusSm,padding:"10px 14px",display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:16}}>✓</span>
          <p style={{margin:0,fontSize:12,color:DS.green,fontWeight:600}}>All lunches look good for {day} — no conflicts or peak-hour issues detected.</p>
        </div>
      )}

      {suggestions.length===0&&scheduled.length===0&&(
        <p style={{margin:0,fontSize:12,color:DS.textMut,textAlign:"center",padding:"12px 0"}}>No lunch schedules set for {day} — go to the rep schedules below to add them.</p>
      )}

      {suggestions.map(sug=>(
        <div key={sug.id} style={{background:DS.bgSurf,border:`1px solid ${sug.severity==="high"?DS.red+"40":DS.amber+"40"}`,borderRadius:DS.radiusSm,padding:"12px 14px",marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
            <div style={{flex:1}}>
              <p style={{margin:"0 0 4px",fontSize:12,fontWeight:700,color:sug.severity==="high"?DS.red:DS.amber}}>
                {sug.severity==="high"?"⚠️":"⚡"} {sug.title}
              </p>
              <p style={{margin:"0 0 8px",fontSize:12,color:DS.textSec,lineHeight:1.5}}>{sug.desc}</p>
              {sug.action&&<p style={{margin:0,fontSize:10,color:DS.textMut}}>
                New time: <strong style={{color:sug.risk.color}}>{sug.action.newTime}</strong> local · volume risk: <strong style={{color:sug.risk.color}}>{sug.risk.pct>0?`~${sug.risk.pct}%`:"off-hours"}</strong>
              </p>}
            </div>
            {sug.action&&(
              applied[sug.id]
                ? <span style={{fontSize:11,color:DS.green,fontWeight:600,flexShrink:0}}>✓ Applied</span>
                : <button onClick={()=>approveChange(sug)} disabled={applying[sug.id]} style={{padding:"7px 16px",borderRadius:DS.radiusSm,background:DS.accent,color:"#fff",border:"none",cursor:"pointer",fontSize:12,fontWeight:600,flexShrink:0,opacity:applying[sug.id]?.7:1}}>
                    {applying[sug.id]?"Applying…":"Approve"}
                  </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}


// ── MGR: SCHEDULES ────────────────────────────────────────────────────
function MgrSchedules({ reps, reload, fire }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});

  const exportSchedules = () => {
    // Header row
    const headers = ["Name","Timezone","Stage","Working Days","Sun Start","Sun End","Sun Lunch","Sun Dur","Mon Start","Mon End","Mon Lunch","Mon Dur","Tue Start","Tue End","Tue Lunch","Tue Dur","Wed Start","Wed End","Wed Lunch","Wed Dur","Thu Start","Thu End","Thu Lunch","Thu Dur","Fri Start","Fri End","Fri Lunch","Fri Dur","Sat Start","Sat End","Sat Lunch","Sat Dur"];
    const rows = [headers];
    reps.forEach(rep => {
      const sched = rep.lunch_schedule||{};
      const stage = rep.rep_stage||"active";
      const row = [
        rep.name,
        rep.timezone||"Central",
        stage==="active"?"Active":stage==="training"?"Training":"Not Started",
        (rep.shift_days||[]).join(", "),
      ];
      DAYS.forEach(d => {
        const ds = sched[d]||{};
        row.push(ds.start||"", ds.end||"", ds.time||"", ds.duration||"");
      });
      rows.push(row);
    });
    const csv = rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv],{type:"text/csv"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href=url; a.download=`esc-schedules-${todayStr()}.csv`; a.click();
    URL.revokeObjectURL(url);
    fire("approved","Schedule exported ✅");
  };

  const startEdit = (rep) => {
    setEditing(rep);
    setForm({
      name: rep.name,
      timezone: rep.timezone||"Central",
      shift_days: rep.shift_days||[],
      lunch_schedule: rep.lunch_schedule||{},
    });
  };

  const save = async () => {
    await sbPatch("rep_status",editing.id,{...form,avatar:avatar(form.name),updated_at:new Date().toISOString()});
    fire("approved",`${form.name}'s schedule updated`);
    setEditing(null); reload();
  };

  const set = (k,v) => setForm(p=>({...p,[k]:v}));
  const toggleDay = d => set("shift_days",form.shift_days.includes(d)?form.shift_days.filter(x=>x!==d):[...form.shift_days,d]);
  const setDay = (day,field,val) => setForm(prev=>({...prev,lunch_schedule:{...prev.lunch_schedule,[day]:{...(prev.lunch_schedule[day]||{start:"",end:"",time:"",duration:60}),[field]:val}}}));

  const todayKey = DAYS[new Date().getDay()];

  // Detect viewer timezone using Intl
  const ianaZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const viewerTz = ianaZone.includes("Johannesburg")||ianaZone.includes("Africa") ? "SA"
    : ianaZone.includes("Pacific") ? "Pacific"
    : ianaZone.includes("Eastern") ? "Eastern"
    : ianaZone.includes("Central") ? "Central"
    : ianaZone.includes("London")||ianaZone.includes("GMT") ? "GMT"
    : ianaZone.includes("Kolkata")||ianaZone.includes("India") ? "IST"
    : "SA";

  const inToday = reps
    .filter(r => (r.shift_days||[]).includes(todayKey))
    .map(r => {
      const sched = (r.lunch_schedule||{})[todayKey];
      const repTz = r.timezone||"Central";
      const start = sched?.start ? convertLunchTime(sched.start, repTz, viewerTz) : null;
      const end   = sched?.end   ? convertLunchTime(sched.end,   repTz, viewerTz) : null;
      const lunch = sched?.time  ? convertLunchTime(sched.time,  repTz, viewerTz) : null;
      return { rep:r, start, end, lunch, repTz, lunchDur: sched?.duration||60 };
    })
    .sort((a,b) => (a.start||"99:99").localeCompare(b.start||"99:99"));

  const notInToday = reps.filter(r => !(r.shift_days||[]).includes(todayKey) && !["pto","sick","off"].includes(r.status));
  const oooToday   = reps.filter(r => ["pto","sick","off"].includes(r.status));

  return (
    <div style={{marginTop:16}}>
      <LunchOptimiser reps={reps}/>
      {editing&&(
        <Modal title={`Edit ${editing.name}`} sub="SCHEDULE" onClose={()=>setEditing(null)} wide>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div>
                <label style={{fontSize:12,color:DS.textSec,display:"block",marginBottom:4}}>Name</label>
                <input value={form.name} onChange={e=>set("name",e.target.value)} style={{width:"100%",padding:"9px 12px",borderRadius:9,border:`1px solid ${DS.border}`,fontSize:13,outline:"none"}}/>
              </div>
              <div>
                <label style={{fontSize:12,color:DS.textSec,display:"block",marginBottom:4}}>Timezone</label>
                <select value={form.timezone} onChange={e=>set("timezone",e.target.value)} style={{width:"100%",padding:"9px 12px",borderRadius:9,border:`1px solid ${DS.border}`,fontSize:13,outline:"none",background:DS.bgCard}}>
                  {TZLIST.map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={{fontSize:12,color:DS.textSec,display:"block",marginBottom:6}}>Working Days</label>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {DAYS.map(d=>(
                  <div key={d} onClick={()=>toggleDay(d)} style={{padding:"5px 10px",borderRadius:8,border:form.shift_days.includes(d)?"2px solid #1a5c35":"1.5px solid #ddd",background:form.shift_days.includes(d)?"#f0faf4":"#fff",cursor:"pointer",fontSize:12,fontWeight:600,color:form.shift_days.includes(d)?"#1a5c35":"#555"}}>{d}</div>
                ))}
              </div>
            </div>
            {form.shift_days.length>0&&(
              <div>
                <label style={{fontSize:12,color:DS.textSec,display:"block",marginBottom:6}}>Schedule Per Day <span style={{fontWeight:400,color:DS.textMut}}>(times in rep's timezone: {form.timezone})</span></label>
                <div style={{display:"grid",gridTemplateColumns:"44px 1fr 1fr 1fr 70px",gap:6,marginBottom:4}}>
                  <span style={{fontSize:10,color:DS.textMut,fontWeight:600}}>Day</span>
                  <span style={{fontSize:10,color:DS.textMut,fontWeight:600}}>Start</span>
                  <span style={{fontSize:10,color:DS.textMut,fontWeight:600}}>End</span>
                  <span style={{fontSize:10,color:DS.textMut,fontWeight:600}}>Lunch time</span>
                  <span style={{fontSize:10,color:DS.textMut,fontWeight:600}}>Duration</span>
                </div>
                {form.shift_days.map(d=>(
                  <div key={d} style={{display:"grid",gridTemplateColumns:"44px 1fr 1fr 1fr 70px",gap:6,alignItems:"center",marginBottom:7}}>
                    <span style={{fontSize:12,fontWeight:700,color:DS.green}}>{d}</span>
                    <div style={{display:"flex",gap:2,alignItems:"center"}}>
                      <select value={((form.lunch_schedule[d]||{}).start||"").split(":")[0]||""} onChange={e=>setDay(d,"start",`${e.target.value.padStart(2,"0")}:${((form.lunch_schedule[d]||{}).start||"").split(":")[1]||"00"}`)} style={{padding:"4px 3px",borderRadius:6,border:`1px solid ${DS.border}`,fontSize:10,outline:"none",background:DS.bgCard,width:46}}>
                        <option value="">HH</option>{Array.from({length:24},(_,i)=><option key={i} value={String(i).padStart(2,"0")}>{String(i).padStart(2,"0")}</option>)}
                      </select>
                      <span style={{fontSize:11,color:DS.textMut}}>:</span>
                      <select value={((form.lunch_schedule[d]||{}).start||"").split(":")[1]||""} onChange={e=>setDay(d,"start",`${((form.lunch_schedule[d]||{}).start||"").split(":")[0]||"00"}:${e.target.value}`)} style={{padding:"4px 3px",borderRadius:6,border:`1px solid ${DS.border}`,fontSize:10,outline:"none",background:DS.bgCard,width:42}}>
                        <option value="">MM</option>{["00","15","30","45"].map(m=><option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div style={{display:"flex",gap:2,alignItems:"center"}}>
                      <select value={((form.lunch_schedule[d]||{}).end||"").split(":")[0]||""} onChange={e=>setDay(d,"end",`${e.target.value.padStart(2,"0")}:${((form.lunch_schedule[d]||{}).end||"").split(":")[1]||"00"}`)} style={{padding:"4px 3px",borderRadius:6,border:`1px solid ${DS.border}`,fontSize:10,outline:"none",background:DS.bgCard,width:46}}>
                        <option value="">HH</option>{Array.from({length:24},(_,i)=><option key={i} value={String(i).padStart(2,"0")}>{String(i).padStart(2,"0")}</option>)}
                      </select>
                      <span style={{fontSize:11,color:DS.textMut}}>:</span>
                      <select value={((form.lunch_schedule[d]||{}).end||"").split(":")[1]||""} onChange={e=>setDay(d,"end",`${((form.lunch_schedule[d]||{}).end||"").split(":")[0]||"00"}:${e.target.value}`)} style={{padding:"4px 3px",borderRadius:6,border:`1px solid ${DS.border}`,fontSize:10,outline:"none",background:DS.bgCard,width:42}}>
                        <option value="">MM</option>{["00","15","30","45"].map(m=><option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div style={{display:"flex",gap:2,alignItems:"center"}}>
                      <select value={((form.lunch_schedule[d]||{}).time||"").split(":")[0]||""} onChange={e=>setDay(d,"time",`${e.target.value.padStart(2,"0")}:${((form.lunch_schedule[d]||{}).time||"").split(":")[1]||"00"}`)} style={{padding:"4px 3px",borderRadius:6,border:`1px solid ${DS.border}`,fontSize:10,outline:"none",background:DS.bgCard,width:46}}>
                        <option value="">HH</option>{Array.from({length:24},(_,i)=><option key={i} value={String(i).padStart(2,"0")}>{String(i).padStart(2,"0")}</option>)}
                      </select>
                      <span style={{fontSize:11,color:DS.textMut}}>:</span>
                      <select value={((form.lunch_schedule[d]||{}).time||"").split(":")[1]||""} onChange={e=>setDay(d,"time",`${((form.lunch_schedule[d]||{}).time||"").split(":")[0]||"00"}:${e.target.value}`)} style={{padding:"4px 3px",borderRadius:6,border:`1px solid ${DS.border}`,fontSize:10,outline:"none",background:DS.bgCard,width:42}}>
                        <option value="">MM</option>{["00","15","30","45"].map(m=><option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <select value={(form.lunch_schedule[d]||{}).duration||60} onChange={e=>setDay(d,"duration",parseInt(e.target.value))} style={{padding:"6px 7px",borderRadius:7,border:`1px solid ${DS.border}`,fontSize:11,outline:"none",background:DS.bgCard}}>
                      <option value={30}>30m</option><option value={60}>1hr</option>
                    </select>
                  </div>
                ))}
              </div>
            )}
            <div style={{display:"flex",gap:8,marginTop:4}}>
              <Btn label="Cancel" onClick={()=>setEditing(null)} outline color="#888" small/>
              <Btn label="Save Changes" onClick={save} color="#1a5c35"/>
            </div>
          </div>
        </Modal>
      )}

      {/* ── TODAY'S ROSTER ── */}
      <div style={{background:DS.bgCard,border:`1px solid ${DS.border}`,borderRadius:12,padding:"12px 14px",marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <p style={{margin:0,fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:DS.textMut}}>📅 Today's Roster — {todayKey}</p>
          <span style={{fontSize:10,color:DS.textMut}}>Your tz: <strong style={{color:DS.textMut}}>{viewerTz}</strong></span>
        </div>

        {inToday.length===0&&(
          <p style={{fontSize:12,color:DS.textMut,textAlign:"center",padding:"8px 0"}}>Nobody scheduled for {todayKey}. ({reps.filter(r=>(r.shift_days||[]).includes(todayKey)).length} matched)</p>
        )}

        {inToday.map(({rep,start,end,lunch,repTz,lunchDur})=>{
          const tz = TZ_C[rep.timezone]||TZ_C.Central;
          const diffTz = repTz !== viewerTz;
          return (
            <div key={rep.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${DS.border}`}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:30,height:30,borderRadius:"50%",background:DS.greenDim,color:DS.green,fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{rep.avatar||avatar(rep.name)}</div>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
                    <span style={{fontSize:13,fontWeight:600}}>{rep.name}</span>
                    {diffTz&&<span style={{fontSize:9,padding:"1px 5px",borderRadius:4,background:tz.bg,color:tz.text,fontWeight:700}}>{rep.timezone}</span>}
                    <StatusDot status={rep.status}/>
                  </div>
                  {lunch&&<span style={{fontSize:10,color:"#b85c00"}}>🥗 {fmt12h(lunch)}{lunchDur===30?" · 30m":" · 1hr"}</span>}
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                {(start||end)
                  ? <span style={{fontSize:12,fontWeight:700,color:DS.textPri}}>{start?fmt12h(start):"?"} – {end?fmt12h(end):"?"}</span>
                  : <span style={{fontSize:11,color:DS.textMut}}>No times set</span>
                }
              </div>
            </div>
          );
        })}

        {notInToday.length>0&&(
          <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid #f0f0f0"}}>
            <p style={{margin:"0 0 6px",fontSize:10,color:DS.textMut,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Not scheduled today ({notInToday.length})</p>
            <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
              {notInToday.map(r=><span key={r.id} style={{fontSize:11,background:DS.bgSurf,color:DS.textMut,padding:"3px 9px",borderRadius:20}}>{r.name}</span>)}
            </div>
          </div>
        )}
        {oooToday.length>0&&(
          <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid #f0f0f0"}}>
            <p style={{margin:"0 0 6px",fontSize:10,color:DS.red,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Out today ({oooToday.length})</p>
            <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
              {oooToday.map(r=><span key={r.id} style={{fontSize:11,background:DS.redDim,color:DS.red,padding:"3px 9px",borderRadius:20}}>{r.name}</span>)}
            </div>
          </div>
        )}
      </div>

      {/* ── ALL REPS LIST ── */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"0 0 10px"}}>
        <p style={{fontSize:10,letterSpacing:1.8,textTransform:"uppercase",color:DS.textMut,margin:0,fontWeight:700}}>All Reps — tap to edit</p>
        <button onClick={exportSchedules} style={{padding:"6px 13px",borderRadius:8,border:"1.5px solid #1a5c35",background:DS.greenDim,cursor:"pointer",fontSize:12,color:DS.green,fontWeight:600}}>📥 Export CSV</button>
      </div>
      {reps.map(rep=>{
        const tz=TZ_C[rep.timezone]||TZ_C.Central;
        const days=(rep.shift_days||[]).join(", ")||"No days set";
        const todaySched = (rep.lunch_schedule||{})[todayKey];
        const repTz = rep.timezone||"Central";
        const startConverted = todaySched?.start ? convertLunchTime(todaySched.start, repTz, viewerTz) : null;
        const endConverted   = todaySched?.end   ? convertLunchTime(todaySched.end,   repTz, viewerTz) : null;
        const scheduledToday = (rep.shift_days||[]).includes(todayKey);
        return (
          <div key={rep.id} onClick={()=>startEdit(rep)} style={{background:DS.bgCard,border:`1px solid ${DS.border}`,borderRadius:12,padding:"11px 14px",marginBottom:7,cursor:"pointer"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:32,height:32,borderRadius:"50%",background:DS.greenDim,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:DS.green,flexShrink:0}}>{rep.avatar||avatar(rep.name)}</div>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                  <span style={{fontWeight:600,fontSize:13}}>{rep.name}</span>
                  <span style={{fontSize:9,padding:"2px 5px",borderRadius:4,background:tz.bg,color:tz.text,fontWeight:700}}>{rep.timezone}</span>
                  {scheduledToday&&<span style={{fontSize:9,background:DS.greenDim,color:DS.green,padding:"2px 6px",borderRadius:4,fontWeight:700}}>IN TODAY</span>}
                </div>
                <p style={{margin:"2px 0 0",fontSize:11,color:DS.textMut}}>{days}</p>
                {scheduledToday&&startConverted&&<p style={{margin:"2px 0 0",fontSize:11,color:DS.textSec}}>Today: {fmt12h(startConverted)} – {endConverted?fmt12h(endConverted):"?"} <span style={{color:DS.textMut}}>({viewerTz})</span></p>}
              </div>
              <span style={{fontSize:12,color:DS.textMut}}>✏️</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── MGR: REPORTS ──────────────────────────────────────────────────────
function generatePIPReport({pipAgent,pipFrom,pipTo,kpiRows,PAID_TARGET,TOTAL_TARGET,PAID_DISPS,TRIAL_DISPS,getWeekKey}) {
  if(!pipAgent||!pipFrom||!pipTo){ alert("Select an agent and date range first"); return; }
  const from=new Date(pipFrom+"T00:00:00Z"), to=new Date(pipTo+"T23:59:59Z");
  const agRows=kpiRows.filter(r=>r.hs_agent_name===pipAgent&&new Date(r.hs_call_timestamp)>=from&&new Date(r.hs_call_timestamp)<=to);
  const weekMap={};
  agRows.forEach(r=>{
    const wk=getWeekKey(r.hs_call_timestamp);
    if(!weekMap[wk]) weekMap[wk]={calls:0,paid:0,trial:0};
    weekMap[wk].calls++;
    if(PAID_DISPS.has(r.hs_call_disposition_label)) weekMap[wk].paid++;
    if(TRIAL_DISPS.has(r.hs_call_disposition_label)) weekMap[wk].trial++;
  });
  const weeks=Object.entries(weekMap).sort(([a],[b])=>a.localeCompare(b));
  const totalCalls=agRows.length;
  const totalPaid=agRows.filter(r=>PAID_DISPS.has(r.hs_call_disposition_label)).length;
  const totalTrial=agRows.filter(r=>TRIAL_DISPS.has(r.hs_call_disposition_label)).length;
  const totalPaidCvr=totalCalls?(totalPaid/totalCalls*100).toFixed(1):0;
  const totalCvr2=totalCalls?((totalPaid+totalTrial)/totalCalls*100).toFixed(1):0;
  const cvColor=(v,t)=>parseFloat(v)>=t?"#1a5c35":parseFloat(v)>=t-5?"#b85c00":"#c0392b";
  const cvBg=(v,t)=>parseFloat(v)>=t?"#eafaf1":parseFloat(v)>=t-5?"#fff8ee":"#fdf0ee";
  const weekRows=weeks.map(([wk,d])=>{
    const pc=(d.paid/d.calls*100).toFixed(1);
    const tc=((d.paid+d.trial)/d.calls*100).toFixed(1);
    const status=parseFloat(tc)>=TOTAL_TARGET?"On target":parseFloat(tc)>=TOTAL_TARGET-5?"Watch":"Below target";
    return "<tr><td>"+wk+"</td><td>"+d.calls+"</td><td>"+d.paid+"</td><td>"+d.trial+"</td>"
      +"<td><span class='badge' style='background:"+cvBg(pc,PAID_TARGET)+";color:"+cvColor(pc,PAID_TARGET)+"'>"+pc+"%</span></td>"
      +"<td><span class='badge' style='background:"+cvBg(tc,TOTAL_TARGET)+";color:"+cvColor(tc,TOTAL_TARGET)+"'>"+tc+"%</span></td>"
      +"<td>"+status+"</td></tr>";
  }).join("");
  const html="<!DOCTYPE html><html><head><title>Performance Report - "+pipAgent+"</title>"
    +"<style>body{font-family:Arial,sans-serif;margin:0;padding:28px;color:#1a1a1a;font-size:13px;}"
    +"h1{font-size:20px;color:#003087;margin:0 0 4px;}.sub{color:#888;font-size:12px;margin:0 0 20px;}"
    +"table{width:100%;border-collapse:collapse;margin-bottom:20px;}"
    +"th{background:#003087;color:#fff;padding:8px 10px;font-size:11px;text-align:left;}"
    +"td{padding:7px 10px;border-bottom:1px solid #eee;font-size:12px;}"
    +"tr:nth-child(even) td{background:#f9f9f9;}"
    +".badge{display:inline-block;padding:2px 8px;border-radius:4px;font-weight:700;font-size:11px;}"
    +".footer{margin-top:30px;font-size:10px;color:#bbb;border-top:1px solid #eee;padding-top:10px;}"
    +".sg{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin-bottom:20px;}"
    +".sc{border-radius:8px;padding:12px;text-align:center;}.sc .n{font-size:22px;font-weight:800;}.sc .l{font-size:10px;color:#888;margin-top:2px;}"
    +"@media print{body{padding:16px;}.np{display:none;}}</style></head><body>"
    +"<div class='np' style='margin-bottom:16px;'><button onclick='window.print()' style='padding:8px 20px;background:#003087;color:#fff;border:none;border-radius:6px;cursor:pointer;'>Print / Save PDF</button></div>"
    +"<h1>Performance Report - "+pipAgent+"</h1>"
    +"<p class='sub'>Period: "+pipFrom+" to "+pipTo+" | Generated "+new Date().toLocaleDateString()+"</p>"
    +"<p class='sub' style='margin-top:-12px;color:#c0392b;font-size:11px;'>CONFIDENTIAL - FOR MANAGEMENT USE ONLY</p>"
    +"<div class='sg'>"
    +"<div class='sc' style='background:#e8f0fe;'><div class='n' style='color:#003087;'>"+totalCalls+"</div><div class='l'>Total Calls</div></div>"
    +"<div class='sc' style='background:#eafaf1;'><div class='n' style='color:#1a5c35;'>"+totalPaid+"</div><div class='l'>Paid Enrollments</div></div>"
    +"<div class='sc' style='background:"+cvBg(totalPaidCvr,PAID_TARGET)+";'><div class='n' style='color:"+cvColor(totalPaidCvr,PAID_TARGET)+";'>"+totalPaidCvr+"%</div><div class='l'>Paid CVR (target "+PAID_TARGET+"%)</div></div>"
    +"<div class='sc' style='background:"+cvBg(totalCvr2,TOTAL_TARGET)+";'><div class='n' style='color:"+cvColor(totalCvr2,TOTAL_TARGET)+";'>"+totalCvr2+"%</div><div class='l'>Total CVR (target "+TOTAL_TARGET+"%)</div></div>"
    +"</div>"
    +"<p style='font-size:11px;font-weight:700;color:#003087;text-transform:uppercase;margin:20px 0 8px;'>Weekly Breakdown</p>"
    +"<table><thead><tr><th>Week of</th><th>Calls</th><th>Paid</th><th>Trial</th><th>Paid CVR</th><th>Total CVR</th><th>vs Target</th></tr></thead><tbody>"+weekRows+"</tbody></table>"
    +"<p style='font-size:11px;font-weight:700;color:#003087;text-transform:uppercase;margin:20px 0 8px;'>Period Summary vs Baseline</p>"
    +"<table><thead><tr><th>Metric</th><th>Actual</th><th>Target</th><th>Gap</th><th>Status</th></tr></thead><tbody>"
    +"<tr><td>Paid CVR</td><td>"+totalPaidCvr+"%</td><td>"+PAID_TARGET+"%</td>"
    +"<td style='color:"+cvColor(totalPaidCvr,PAID_TARGET)+"'>"+(parseFloat(totalPaidCvr)-PAID_TARGET).toFixed(1)+"%</td>"
    +"<td>"+(parseFloat(totalPaidCvr)>=PAID_TARGET?"Met":"Not met")+"</td></tr>"
    +"<tr><td>Total CVR</td><td>"+totalCvr2+"%</td><td>"+TOTAL_TARGET+"%</td>"
    +"<td style='color:"+cvColor(totalCvr2,TOTAL_TARGET)+"'>"+(parseFloat(totalCvr2)-TOTAL_TARGET).toFixed(1)+"%</td>"
    +"<td>"+(parseFloat(totalCvr2)>=TOTAL_TARGET?"Met":"Not met")+"</td></tr>"
    +"</tbody></table>"
    +"<div class='footer'>ESC Break Manager · Auto-generated · "+new Date().toISOString()+"</div>"
    +"</body></html>";
  const w=window.open("","_blank");
  w.document.write(html);
  w.document.close();
}

// ── MGR: KPI DASHBOARD ────────────────────────────────────────────────
function PipCallCount({pipAgent,pipFrom,pipTo,kpiRows}) {
  if(!pipAgent||!pipFrom||!pipTo) return null;
  const from=new Date(pipFrom+"T00:00:00Z"); const to=new Date(pipTo+"T23:59:59Z");
  const count=kpiRows.filter(r=>r.hs_agent_name===pipAgent&&new Date(r.hs_call_timestamp)>=from&&new Date(r.hs_call_timestamp)<=to).length;
  return <p style={{margin:"0 0 14px",fontSize:12,color:DS.green,fontWeight:600}}>✅ {count} calls found for {pipAgent} in this period</p>;
}

function LunchTodayBanner({myRep}) {
  const DAYS_SHORT=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const todayKey=DAYS_SHORT[new Date().getDay()];
  const sched=(myRep.lunch_schedule||{})[todayKey];
  const lunchTime=sched?.time;
  const dur=sched?.duration||60;
  if(!lunchTime) return null;
  const [lh,lm]=lunchTime.split(":").map(Number);
  const endMin=lh*60+lm+dur;
  const endStr=`${String(Math.floor(endMin/60)%24).padStart(2,"0")}:${String(endMin%60).padStart(2,"0")}`;
  return (
    <div style={{background:DS.amberDim,border:`1px solid ${DS.amber}40`,borderRadius:12,padding:"10px 14px",marginBottom:10,display:"flex",alignItems:"center",gap:10}}>
      <span style={{fontSize:20}}>🥗</span>
      <div>
        <p style={{margin:0,fontSize:12,fontWeight:700,color:"#b85c00"}}>Your lunch today</p>
        <p style={{margin:0,fontSize:14,fontWeight:800,color:"#7a3d00"}}>{lunchTime} – {endStr} <span style={{fontSize:11,fontWeight:400,color:"#b85c00"}}>({dur}min)</span></p>
      </div>
    </div>
  );
}

// ── MGR: KPI DASHBOARD ────────────────────────────────────────────────
function MgrKPI({ reps=[], setKpiRows, kpiFileName=null, setKpiFileName, clearKpiData }) {
  const [kpiTab, setKpiTab]   = useState("summary");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  // Fetch last 90 days only — not all 66k rows
  const since = ctDaysAgo(90);
  const { rows: kpiRows, loading: kpiLoading } = useKpiQuery(null, null, since);

  const PAID_DISPS  = new Set(["Registered","Registered: Eval/L1O","Registered: Eval/WBO","Outbound - Registered"]);
  const TRIAL_DISPS = new Set(["Registered: Trial","Outbound - Trial"]);
  // Full name mapping — rep.name is first name, hs_agent_name is full name
  // Keep all known agents for historical data but mark deleted ones
  const ALL_AGENTS = new Set(["Amanda Beydoun","Andrea Burtman","Dalvin Hogg","Darryl Shipman",
    "Deonte Epps","Heather Baker","Jordan DiDonato","Kelly Perez","Leah Lopez","Likhona Nyumbeka",
    "Lungile Cewu","Marcel Matthee","Mbali Mbata","Mpho Ndaba","Pamela Martin","Phiwe Khasa",
    "Rebecca Jaffier","Shadrack Kondile","Mike Garcia"]);
  // Active agents — derived from reps in DB (first name match)
  const activeFirstNames = new Set(reps.map(r=>r.name));
  const ACTIVE_AGENTS = new Set([...ALL_AGENTS].filter(fullName=>{
    const first = fullName.split(" ")[0];
    return activeFirstNames.has(first);
  }));
  const ESC_AGENTS = ALL_AGENTS; // keep all for upload filtering
  const NEW_JOINERS  = reps.filter(r=>r.rep_stage==="ramping").map(r=>r.name);
  const RAMP_START_MAP = Object.fromEntries(reps.filter(r=>r.rep_stage==="ramping").map(r=>[r.name, r.ramp_start_date ? new Date(r.ramp_start_date+"T00:00:00Z") : new Date("2026-05-29T00:00:00Z")]));
  const PAID_TARGET  = 20;
  const TOTAL_TARGET = 45;
  const RAMP_TARGETS = {1:{paid:10,total:20,dates:"29 May – 04 Jun"},2:{paid:15,total:30,dates:"05 Jun – 11 Jun"},3:{paid:18,total:38,dates:"12 Jun – 18 Jun"},4:{paid:20,total:45,dates:"19 Jun – 25 Jun"}};

  // PDF / PIP state
  const [pipAgent,   setPipAgent]   = useState("");
  const [pipFrom,    setPipFrom]    = useState("");
  const [pipTo,      setPipTo]      = useState("");

  const parseCSV = (text) => {
    const lines = text.trim().split("\n");
    const headers = lines[0].split(",").map(h=>h.replace(/^"|"$/g,"").trim());

    const rawRows = lines.slice(1).map(line=>{
      const vals = []; let cur="", inQ=false;
      for(let c of line){ if(c==='"'){inQ=!inQ;}else if(c===','&&!inQ){vals.push(cur.trim());cur="";}else{cur+=c;} }
      vals.push(cur.trim());
      const obj={};
      headers.forEach((h,i)=>{ obj[h]=vals[i]||""; });
      return obj;
    });

    // Detect CSV format
    const isCallsFormat = headers.includes("agent_name") && headers.includes("start_time");
    const isHubSpotFormat = headers.includes("hs_agent_name") && headers.includes("hs_call_timestamp");

    if(isCallsFormat) {
      // Map calls CSV columns to our KPI schema
      // call_id → hs_deal_id, agent_name → hs_agent_name, start_time → hs_call_timestamp
      // call_result → hs_call_disposition_label, direction → hs_call_direction
      // caller_location → contact_preferred_location
      const RESULT_MAP = {
        "Contact Hung Up": "Connected",
        "Connected": "Connected",
        "Registered": "Registered",
        "Registered: Trial": "Registered: Trial",
        "Registered: Eval/L1O": "Registered: Eval/L1O",
        "Registered: Eval/WBO": "Registered: Eval/WBO",
        "Outbound - Registered": "Outbound - Registered",
        "Outbound - Trial": "Outbound - Trial",
      };
      return rawRows.map(r=>({
        hs_deal_id:                  r.call_id || r.session_id || "",
        hs_agent_name:               r.agent_name || "",
        hs_call_timestamp:           r.start_time || "",
        hs_call_disposition_label:   RESULT_MAP[r.call_result] || r.call_result || "",
        hs_call_direction:           r.direction || "",
        contact_preferred_location:  r.caller_location || r.point_of_contact || "",
        deal_stage:                  "",
      }));
    }

    if(isHubSpotFormat) {
      return rawRows; // already in correct format
    }

    // Unknown format — return as-is and let filter handle it
    return rawRows;
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if(!file) return;
    e.target.value = "";
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = parseCSV(ev.target.result);
        const newRows = parsed.filter(r=>ESC_AGENTS.has(r.hs_agent_name));
        console.log(`KPI upload: ${parsed.length} rows parsed, ${newRows.length} matched ESC agents`);
        // Upload to Supabase — deduplication handled by unique constraint on hs_deal_id
        const KPI_COLS = ["hs_deal_id","hs_agent_name","hs_call_timestamp","hs_call_disposition_label","hs_call_direction","contact_preferred_location","deal_stage"];
        const stripped = newRows.map(r=>{ const o={}; KPI_COLS.forEach(k=>{ o[k]=r[k]||null; }); return o; });
        for(let i=0;i<stripped.length;i+=500){
          const chunk=stripped.slice(i,i+500);
          const res = await fetch(`${SB_URL}/rest/v1/kpi_bookings`,{
            method:"POST",
            headers:{ apikey:SB_KEY, Authorization:`Bearer ${SB_KEY}`, "Content-Type":"application/json", "Prefer":"resolution=merge-duplicates,return=minimal" },
            body:JSON.stringify(chunk)
          });
          if(!res.ok){ const err=await res.text(); console.error(`KPI chunk ${i/500} failed:`,res.status,err); }
          else { console.log(`KPI chunk ${Math.floor(i/500)+1} saved (${chunk.length} rows)`); }
        }
        await setKpiFileName(file.name);
        console.log("KPI save complete");
      } catch(err) {
        console.error("KPI upload error:", err);
      } finally {
        setUploading(false);
      }
    };
    reader.readAsText(file);
  };

  const toCT = (ts) => new Date(new Date(ts).toLocaleString("en-US",{timeZone:"America/Chicago"}));
  const ctStr = (d) => { const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),dd=String(d.getDate()).padStart(2,"0"); return `${y}-${m}-${dd}`; };
  const getWeekKey = (ts) => {
    const d = toCT(ts);
    const day = d.getDay();
    const mon = new Date(d); mon.setDate(d.getDate()-(day===0?6:day-1));
    return ctStr(mon);
  };
  const getMonthKey = (ts) => { const d=toCT(ts); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; };
  const getRampWeek = (ts, agentName) => {
    const start = RAMP_START_MAP[agentName] || new Date("2026-05-29T00:00:00Z");
    const diff = new Date(ts) - start;
    if(diff<0) return null;
    return Math.min(Math.floor(diff/(7*24*3600*1000))+1, 4);
  };

  const agg = (filterFn, groupFn) => {
    const map = {};
    kpiRows.filter(r=>!filterFn||filterFn(r)).forEach(r=>{
      const key = groupFn(r);
      if(!key) return;
      if(!map[key]) map[key]={calls:0,paid:0,trial:0};
      map[key].calls++;
      if(PAID_DISPS.has(r.hs_call_disposition_label))  map[key].paid++;
      if(TRIAL_DISPS.has(r.hs_call_disposition_label)) map[key].trial++;
    });
    return map;
  };

  const cvr = (paid,trial,calls) => calls>0?((paid+trial)/calls*100).toFixed(1):null;
  const paidCvr = (paid,calls) => calls>0?(paid/calls*100).toFixed(1):null;

  const cvrColor = (val, target) => {
    if(val===null) return {bg:"#f5f5f5",fg:"#bbb"};
    const v=parseFloat(val);
    if(v>=target) return {bg:"#eafaf1",fg:"#1a5c35"};
    if(v>=target-5) return {bg:"#fff8ee",fg:"#b85c00"};
    return {bg:"#fdf0ee",fg:"#c0392b"};
  };

  const kpiTabs = [{k:"summary",l:"Summary"},{k:"monthly",l:"Monthly"},{k:"weekly",l:"Weekly"},{k:"ramp",l:"📈 Ramp"},{k:"pip",l:"📄 PIP PDF"}];

  const generatePIP = () => generatePIPReport({pipAgent,pipFrom,pipTo,kpiRows,PAID_TARGET,TOTAL_TARGET,PAID_DISPS,TRIAL_DISPS,getWeekKey});

  // Summary data
  const summaryMap = agg(null, r=>r.hs_agent_name);
  const summaryData = Object.entries(summaryMap)
    .filter(([name])=>ACTIVE_AGENTS.has(name))
    .map(([name,d])=>({name,calls:d.calls,paid:d.paid,trial:d.trial,
      paidCvr:paidCvr(d.paid,d.calls),totalCvr:cvr(d.paid,d.trial,d.calls)}))
    .sort((a,b)=>parseFloat(b.totalCvr||0)-parseFloat(a.totalCvr||0));

  // Monthly data
  const monthlyMap = agg(null, r=>r.hs_agent_name+"||"+getMonthKey(r.hs_call_timestamp));
  const allMonths = [...new Set(Object.keys(monthlyMap).map(k=>k.split("||")[1]))].sort().slice(-6);
  const monthlyAgents = [...new Set(Object.keys(monthlyMap).map(k=>k.split("||")[0]))].filter(n=>ACTIVE_AGENTS.has(n)).sort();

  // Weekly data
  const weeklyMap = agg(null, r=>r.hs_agent_name+"||"+getWeekKey(r.hs_call_timestamp));
  const allWeeks = [...new Set(Object.keys(weeklyMap).map(k=>k.split("||")[1]))].sort().slice(-8);
  const weeklyAgents = [...new Set(Object.keys(weeklyMap).map(k=>k.split("||")[0]))].filter(n=>ACTIVE_AGENTS.has(n)).sort();

  // Ramp data
  const rampMap = agg(r=>NEW_JOINERS.includes(r.hs_agent_name), r=>r.hs_agent_name+"||"+getRampWeek(r.hs_call_timestamp, r.hs_agent_name));

  const Cell = ({val,target,small}) => {
    const {bg,fg} = cvrColor(val,target);
    return <div style={{background:bg,color:fg,fontWeight:700,fontSize:small?10:12,padding:"4px 6px",borderRadius:6,textAlign:"center",minWidth:44}}>{val!==null?`${val}%`:"—"}</div>;
  };

  const thStyle = {fontSize:10,fontWeight:700,color:DS.textMut,padding:"6px 8px",background:DS.bgSurf,borderBottom:`1px solid ${DS.border}`,textAlign:"center",whiteSpace:"nowrap"};
  const tdStyle = {fontSize:11,padding:"7px 8px",borderBottom:`1px solid ${DS.border}`,textAlign:"center"};
  const nameStyle = {fontSize:12,fontWeight:600,color:DS.textPri,padding:"7px 8px",borderBottom:`1px solid ${DS.border}`,textAlign:"left",whiteSpace:"nowrap"};

  if(kpiLoading) return (
    <div style={{marginTop:16,background:DS.bgCard,borderRadius:14,border:`1px solid ${DS.border}`,padding:"32px 20px",textAlign:"center"}}>
      <p style={{fontSize:28,margin:"0 0 8px"}}>📊</p>
      <p style={{fontSize:13,color:DS.textMut}}>Loading KPI data…</p>
    </div>
  );

  if(!kpiRows.length) return (
    <div style={{marginTop:16}}>
      <div style={{background:DS.bgCard,borderRadius:14,border:`1px solid ${DS.border}`,padding:"32px 20px",textAlign:"center"}}>
        <p style={{fontSize:28,margin:"0 0 8px"}}>📊</p>
        <p style={{fontSize:15,fontWeight:700,color:DS.textPri,margin:"0 0 6px"}}>KPI Dashboard</p>
        <p style={{fontSize:12,color:DS.textSec,margin:"0 0 20px"}}>Export your bookings CSV from Supabase daily and upload here. Data is stored and shared across all devices.</p>
        <button onClick={()=>fileRef.current?.click()} style={{padding:"10px 24px",borderRadius:10,background:DS.accent,color:"#fff",border:"none",cursor:"pointer",fontSize:13,fontWeight:700}}>
          {uploading?"Processing…":"📂 Upload Bookings CSV"}
        </button>
        <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} style={{display:"none"}}/>
        <p style={{fontSize:10,color:DS.textMut,marginTop:12}}>Supabase → Table Editor → bookings → Export CSV</p>
      </div>
    </div>
  );

  // Calculate date range from data
  const dates = kpiRows.map(r=>new Date(r.hs_call_timestamp)).filter(d=>!isNaN(d));
  const minDate = dates.length ? new Date(Math.min(...dates)).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : "";
  const maxDate = dates.length ? new Date(Math.max(...dates)).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : "";

  return (
    <div style={{marginTop:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div>
          <p style={{margin:0,fontSize:13,fontWeight:700,color:DS.textPri}}>📊 KPI Dashboard</p>
          <p style={{margin:0,fontSize:10,color:DS.textMut}}>{kpiRows.length.toLocaleString()} records · {minDate} – {maxDate}</p>
          {kpiFileName&&<p style={{margin:0,fontSize:9,color:DS.textMut}}>Last upload: {kpiFileName}</p>}
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>fileRef.current?.click()} style={{padding:"7px 14px",borderRadius:9,background:DS.accentDim,border:`1px solid ${DS.borderHi}`,color:DS.accent,cursor:"pointer",fontSize:11,fontWeight:700}}>
            {uploading?"Adding…":"➕ Add CSV"}
          </button>
          <button onClick={()=>clearKpiData&&clearKpiData()} style={{padding:"7px 14px",borderRadius:9,background:DS.redDim,border:`1px solid ${DS.red}40`,color:DS.red,cursor:"pointer",fontSize:11,fontWeight:700}}>
            🗑 Clear All
          </button>
        </div>
        <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} style={{display:"none"}}/>
      </div>

      {/* Baseline pills */}
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        {[{l:"Paid CVR baseline",v:"20%",c:"#1a5c35"},{l:"Total CVR baseline",v:"45%",c:"#1d4ed8"}].map(p=>(
          <div key={p.l} style={{background:DS.bgSurf,border:`1px solid ${p.c}20`,borderRadius:8,padding:"5px 10px",display:"flex",gap:6,alignItems:"center"}}>
            <span style={{fontSize:14,fontWeight:800,color:p.c}}>{p.v}</span>
            <span style={{fontSize:10,color:DS.textSec}}>{p.l}</span>
          </div>
        ))}
      </div>

      {/* AI Weekly Summary */}
      <WeeklyTeamSummary reps={reps}/>

      {/* Sub tabs */}
      <div style={{display:"flex",borderBottom:"1.5px solid #ebebeb",marginBottom:14,overflowX:"auto"}}>
        {kpiTabs.map(t=>(
          <button key={t.k} onClick={()=>setKpiTab(t.k)} style={{padding:"9px 14px",border:"none",background:"none",cursor:"pointer",fontSize:12,fontWeight:kpiTab===t.k?700:500,color:kpiTab===t.k?"#1a5c35":"#999",borderBottom:kpiTab===t.k?"2.5px solid #1a5c35":"2.5px solid transparent",marginBottom:-1.5,whiteSpace:"nowrap"}}>{t.l}</button>
        ))}
      </div>

      {/* SUMMARY */}
      {kpiTab==="summary"&&(
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",background:DS.bgCard,borderRadius:12,overflow:"hidden",border:`1px solid ${DS.border}`}}>
            <thead>
              <tr>
                {["Agent","Calls","Paid","Trial","Paid CVR","Trial CVR","Total CVR"].map(h=>(
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summaryData.map(d=>(
                <tr key={d.name}>
                  <td style={nameStyle}>{d.name}</td>
                  <td style={tdStyle}>{d.calls.toLocaleString()}</td>
                  <td style={tdStyle}>{d.paid}</td>
                  <td style={tdStyle}>{d.trial}</td>
                  <td style={{...tdStyle,padding:4}}><Cell val={d.paidCvr} target={PAID_TARGET}/></td>
                  <td style={tdStyle}>{d.trial>0?(d.trial/d.calls*100).toFixed(1)+"%":"—"}</td>
                  <td style={{...tdStyle,padding:4}}><Cell val={d.totalCvr} target={TOTAL_TARGET}/></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{fontSize:10,color:DS.textMut,marginTop:8,textAlign:"center"}}>Green = at/above baseline · Amber = within 5pts · Red = 5pts+ below</p>
        </div>
      )}

      {/* MONTHLY */}
      {kpiTab==="monthly"&&(
        <div style={{overflowX:"auto"}}>
          <p style={{fontSize:10,color:DS.textSec,marginBottom:8}}>Top = Paid CVR · Bottom = Total CVR · Last 6 months</p>
          <table style={{borderCollapse:"collapse",background:DS.bgCard,borderRadius:12,overflow:"hidden",border:`1px solid ${DS.border}`,minWidth:"100%"}}>
            <thead>
              <tr>
                <th style={{...thStyle,textAlign:"left"}}>Agent</th>
                {allMonths.map(m=><th key={m} style={thStyle}>{m.slice(5)}</th>)}
              </tr>
            </thead>
            <tbody>
              {monthlyAgents.map(agent=>(
                <tr key={agent}>
                  <td style={nameStyle}>{agent}</td>
                  {allMonths.map(m=>{
                    const d=monthlyMap[agent+"||"+m];
                    if(!d) return <td key={m} style={{...tdStyle,color:"#ddd"}}>—</td>;
                    const pc=paidCvr(d.paid,d.calls); const tc=cvr(d.paid,d.trial,d.calls);
                    const {bg,fg}=cvrColor(tc,TOTAL_TARGET);
                    return <td key={m} style={{...tdStyle,padding:3}}>
                      <div style={{background:bg,borderRadius:6,padding:"3px 5px",textAlign:"center"}}>
                        <div style={{fontSize:10,color:fg,fontWeight:700}}>{pc}%</div>
                        <div style={{fontSize:11,color:fg,fontWeight:800}}>{tc}%</div>
                      </div>
                    </td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* WEEKLY */}
      {kpiTab==="weekly"&&(
        <div style={{overflowX:"auto"}}>
          <p style={{fontSize:10,color:DS.textSec,marginBottom:8}}>Top = Paid CVR · Bottom = Total CVR · Last 8 weeks (week starting Mon)</p>
          <table style={{borderCollapse:"collapse",background:DS.bgCard,borderRadius:12,overflow:"hidden",border:`1px solid ${DS.border}`,minWidth:"100%"}}>
            <thead>
              <tr>
                <th style={{...thStyle,textAlign:"left"}}>Agent</th>
                {allWeeks.map(w=><th key={w} style={thStyle}>{w.slice(5)}</th>)}
              </tr>
            </thead>
            <tbody>
              {weeklyAgents.map(agent=>(
                <tr key={agent}>
                  <td style={nameStyle}>{agent}</td>
                  {allWeeks.map(w=>{
                    const d=weeklyMap[agent+"||"+w];
                    if(!d) return <td key={w} style={{...tdStyle,color:"#ddd"}}>—</td>;
                    const pc=paidCvr(d.paid,d.calls); const tc=cvr(d.paid,d.trial,d.calls);
                    const {bg,fg}=cvrColor(tc,TOTAL_TARGET);
                    return <td key={w} style={{...tdStyle,padding:3}}>
                      <div style={{background:bg,borderRadius:6,padding:"3px 5px",textAlign:"center"}}>
                        <div style={{fontSize:10,color:fg,fontWeight:700}}>{pc}%</div>
                        <div style={{fontSize:11,color:fg,fontWeight:800}}>{tc}%</div>
                      </div>
                    </td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* RAMP TRACKER */}
      {kpiTab==="ramp"&&(
        <div>
          {/* Target table */}
          <div style={{background:DS.bgCard,borderRadius:12,border:`1px solid ${DS.border}`,overflow:"hidden",marginBottom:16}}>
            <div style={{padding:"10px 14px",borderBottom:"1.5px solid #efefef",background:DS.bgSurf}}>
              <p style={{margin:0,fontSize:12,fontWeight:700,color:DS.textPri}}>Ramp Targets — All started 29 May 2026</p>
            </div>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr>
                  <th style={thStyle}>Metric</th>
                  {[1,2,3,4].map(w=><th key={w} style={thStyle}>Week {w}<br/><span style={{fontWeight:400,fontSize:9}}>{RAMP_TARGETS[w].dates}</span></th>)}
                </tr>
              </thead>
              <tbody>
                {[{l:"Paid CVR target",k:"paid"},{l:"Total CVR target",k:"total"}].map(row=>(
                  <tr key={row.k}>
                    <td style={{...nameStyle,fontSize:11}}>{row.l}</td>
                    {[1,2,3,4].map(w=>(
                      <td key={w} style={{...tdStyle,fontWeight:700,color:DS.green}}>{RAMP_TARGETS[w][row.k]}%</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Per agent ramp */}
          {NEW_JOINERS.length===0&&(
            <div style={{background:DS.bgCard,borderRadius:12,border:`1px solid ${DS.border}`,padding:"24px",textAlign:"center"}}>
              <p style={{fontSize:20,margin:"0 0 8px"}}>📈</p>
              <p style={{fontSize:13,fontWeight:600,color:DS.textPri,margin:"0 0 4px"}}>No agents currently ramping</p>
              <p style={{fontSize:11,color:DS.textMut,margin:0}}>Tag an agent as Ramping in the Team tab to track their progress here</p>
            </div>
          )}
          {NEW_JOINERS.map(agent=>{
            const agRows = kpiRows.filter(r=>r.hs_agent_name===agent);
            const rampStart = RAMP_START_MAP[agent];
            const rampStartStr = rampStart ? rampStart.toISOString().split("T")[0] : "29 May 2026";
            return (
              <div key={agent} style={{background:DS.bgCard,borderRadius:12,border:`1px solid ${DS.border}`,overflow:"hidden",marginBottom:14}}>
                <div style={{padding:"10px 14px",borderBottom:"1.5px solid #efefef",background:DS.bgSurf,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <p style={{margin:0,fontSize:13,fontWeight:700,color:DS.green}}>{agent}</p>
                  <p style={{margin:0,fontSize:10,color:DS.textMut}}>{agRows.length} total calls · started {rampStartStr}</p>
                </div>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead>
                    <tr>
                      {["Week","Dates","Calls","Paid","Trial","Paid CVR","Total CVR","P.Target","T.Target","Status"].map(h=>(
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[1,2,3,4].map(wk=>{
                      const wkRows = agRows.filter(r=>getRampWeek(r.hs_call_timestamp, agent)===wk);
                      const calls=wkRows.length;
                      const paid=wkRows.filter(r=>PAID_DISPS.has(r.hs_call_disposition_label)).length;
                      const trial=wkRows.filter(r=>TRIAL_DISPS.has(r.hs_call_disposition_label)).length;
                      const pc=calls?paidCvr(paid,calls):null;
                      const tc=calls?cvr(paid,trial,calls):null;
                      const pt=RAMP_TARGETS[wk].paid; const tt=RAMP_TARGETS[wk].total;
                      const upcoming=calls===0;
                      const status=upcoming?"Upcoming":parseFloat(tc)>=tt?"On Track ✅":parseFloat(tc)>=tt-5?"Watch ⚠️":"Below 🔴";
                      const statusColor=upcoming?"#bbb":parseFloat(tc||0)>=tt?"#1a5c35":parseFloat(tc||0)>=tt-5?"#b85c00":"#c0392b";
                      return (
                        <tr key={wk} style={{background:upcoming?"#fafafa":"#fff"}}>
                          <td style={{...tdStyle,color:upcoming?"#ccc":"#1a1a1a",fontWeight:700}}>W{wk}</td>
                          <td style={{...tdStyle,fontSize:10,color:DS.textSec}}>{RAMP_TARGETS[wk].dates}</td>
                          <td style={tdStyle}>{upcoming?"—":calls}</td>
                          <td style={tdStyle}>{upcoming?"—":paid}</td>
                          <td style={tdStyle}>{upcoming?"—":trial}</td>
                          <td style={{...tdStyle,padding:3}}>{upcoming?<span style={{color:"#ddd"}}>—</span>:<Cell val={pc} target={pt} small/>}</td>
                          <td style={{...tdStyle,padding:3}}>{upcoming?<span style={{color:"#ddd"}}>—</span>:<Cell val={tc} target={tt} small/>}</td>
                          <td style={{...tdStyle,color:DS.green,fontWeight:600}}>{pt}%</td>
                          <td style={{...tdStyle,color:"#1d4ed8",fontWeight:600}}>{tt}%</td>
                          <td style={{...tdStyle,fontWeight:700,color:statusColor,fontSize:11}}>{status}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {/* PIP PDF */}
      {kpiTab==="pip"&&(
        <div>
          <div style={{background:DS.bgCard,borderRadius:12,border:`1px solid ${DS.border}`,padding:"20px",marginBottom:14}}>
            <p style={{margin:"0 0 4px",fontSize:14,fontWeight:700,color:DS.textPri}}>📄 Performance Report Generator</p>
            <p style={{margin:"0 0 16px",fontSize:12,color:DS.textSec}}>Generate a printable PDF report for any agent over a custom date range. Use for PIPs, reviews or coaching sessions.</p>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:16}}>
              <div>
                <label style={{fontSize:11,color:DS.textSec,display:"block",marginBottom:4,fontWeight:600}}>Agent</label>
                <select value={pipAgent} onChange={e=>setPipAgent(e.target.value)} style={{width:"100%",padding:"9px 10px",borderRadius:9,border:`1px solid ${DS.border}`,fontSize:13,outline:"none",background:DS.bgCard}}>
                  <option value="">Select agent…</option>
                  {[...ACTIVE_AGENTS].sort().map(n=><option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:11,color:DS.textSec,display:"block",marginBottom:4,fontWeight:600}}>From</label>
                <input type="date" value={pipFrom} onChange={e=>setPipFrom(e.target.value)} style={{width:"100%",padding:"9px 10px",borderRadius:9,border:`1px solid ${DS.border}`,fontSize:13,outline:"none"}}/>
              </div>
              <div>
                <label style={{fontSize:11,color:DS.textSec,display:"block",marginBottom:4,fontWeight:600}}>To</label>
                <input type="date" value={pipTo} onChange={e=>setPipTo(e.target.value)} style={{width:"100%",padding:"9px 10px",borderRadius:9,border:`1px solid ${DS.border}`,fontSize:13,outline:"none"}}/>
              </div>
            </div>

            <PipCallCount pipAgent={pipAgent} pipFrom={pipFrom} pipTo={pipTo} kpiRows={kpiRows}/>

            <button onClick={generatePIP} disabled={!pipAgent||!pipFrom||!pipTo}
              style={{padding:"11px 24px",borderRadius:10,background:pipAgent&&pipFrom&&pipTo?"#003087":"#ccc",color:"#fff",border:"none",cursor:pipAgent&&pipFrom&&pipTo?"pointer":"default",fontSize:13,fontWeight:700}}>
              📄 Generate PDF Report
            </button>
            <p style={{margin:"8px 0 0",fontSize:10,color:DS.textMut}}>Opens in a new tab — use browser Print (Cmd+P / Ctrl+P) and select "Save as PDF"</p>
          </div>

          <div style={{background:DS.amberDim,border:"1.5px solid #f0c080",borderRadius:12,padding:"12px 14px"}}>
            <p style={{margin:0,fontSize:12,color:DS.amber,fontWeight:600}}>⚠️ PIP guidance</p>
            <p style={{margin:"4px 0 0",fontSize:11,color:DS.amber}}>This report shows call data only. For a formal PIP you should also include call recordings, coaching session notes, and HR sign-off. This document is a performance data supplement, not a standalone PIP document.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── MGR: REPORTS ──────────────────────────────────────────────────────
function MgrReports({ reps }) {
  const [period, setPeriod] = useState("daily");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const getRange = () => {
    const today = new Date();
    const fmt = d => d.toISOString().split('T')[0];
    if(period==="daily") return {start:fmt(today),end:fmt(today)};
    if(period==="weekly") {
      const mon = new Date(today); mon.setDate(today.getDate()-today.getDay()+1);
      return {start:fmt(mon),end:fmt(today)};
    }
    const firstDay = new Date(today.getFullYear(),today.getMonth(),1);
    return {start:fmt(firstDay),end:fmt(today)};
  };

  const load = async () => {
    setLoading(true);
    const {start,end} = getRange();
    const d = await loadReportData(start,end);
    setData(d); setLoading(false);
  };

  useEffect(()=>{load();},[period]);

  const exportCSV = () => {
    if(!data) return;
    const rows = [["Rep Name","Health Breaks","Health Time (min)","Lunch Breaks","Sick Days","Call-offs"]];
    reps.forEach(rep=>{
      const hb = data.logs.filter(l=>l.rep_id===rep.id&&l.break_type==="health");
      const lb = data.logs.filter(l=>l.rep_id===rep.id&&l.break_type==="lunch");
      const sick = data.calloffs.filter(c=>c.rep_id===rep.id&&c.reason==="sick");
      const calloff = data.calloffs.filter(c=>c.rep_id===rep.id&&c.reason==="call_off");
      const hMins = Math.round(hb.reduce((a,l)=>{const s=l.duration_seconds||0;return a+s;},0)/60);
      rows.push([rep.name,hb.length,hMins,lb.length,sick.length,calloff.length]);
    });
    const csv = rows.map(r=>r.map(c=>`"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv],{type:"text/csv"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href=url; a.download=`esc-breaks-${period}-${todayStr()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const repStats = reps.map(rep=>{
    if(!data) return {rep,hb:0,hMins:0,lb:0,sick:0,calloff:0};
    const hb=data.logs.filter(l=>l.rep_id===rep.id&&l.break_type==="health");
    const lb=data.logs.filter(l=>l.rep_id===rep.id&&l.break_type==="lunch");
    const sick=data.calloffs.filter(c=>c.rep_id===rep.id&&c.reason==="sick");
    const calloff=data.calloffs.filter(c=>c.rep_id===rep.id&&c.reason==="call_off");
    const hMins=Math.round(hb.reduce((a,l)=>a+(l.duration_seconds||0),0)/60);
    return {rep,hb:hb.length,hMins,lb:lb.length,sick:sick.length,calloff:calloff.length};
  });

  return (
    <div style={{marginTop:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{display:"flex",gap:6}}>
          {["daily","weekly","monthly"].map(p=>(
            <button key={p} onClick={()=>setPeriod(p)} style={{padding:"7px 14px",borderRadius:8,border:period===p?"none":"1.5px solid #ddd",background:period===p?"#1a5c35":"#fff",color:period===p?"#fff":"#555",cursor:"pointer",fontSize:12,fontWeight:600,textTransform:"capitalize"}}>{p}</button>
          ))}
        </div>
        <button onClick={exportCSV} style={{padding:"7px 14px",borderRadius:8,border:"1.5px solid #1a5c35",background:DS.greenDim,cursor:"pointer",fontSize:12,color:DS.green,fontWeight:600}}>📥 Export Excel</button>
      </div>
      {loading&&<p style={{textAlign:"center",color:DS.textMut,padding:"30px 0"}}>Loading…</p>}
      {!loading&&data&&(
        <div>
          <div style={{background:DS.bgCard,borderRadius:12,border:`1px solid ${DS.border}`,overflow:"hidden"}}>
            <div style={{display:"grid",gridTemplateColumns:"1.5fr 1fr 1fr 1fr 1fr 1fr",gap:0,padding:"8px 12px",background:DS.bgSurf,borderBottom:"1px solid #efefef"}}>
              {["Rep","🌿 Health","Time","🥗 Lunch","🤒 Sick","📵 Off"].map((h,i)=>(
                <span key={i} style={{fontSize:10,fontWeight:700,color:DS.textMut,letterSpacing:0.5}}>{h}</span>
              ))}
            </div>
            {repStats.map(({rep,hb,hMins,lb,sick,calloff})=>(
              <div key={rep.id} style={{display:"grid",gridTemplateColumns:"1.5fr 1fr 1fr 1fr 1fr 1fr",gap:0,padding:"10px 12px",borderBottom:`1px solid ${DS.border}`,alignItems:"center"}}>
                <span style={{fontSize:12,fontWeight:600,color:DS.textPri}}>{rep.name}</span>
                <span style={{fontSize:12,color:hb>=HEALTH_PER_DAY?"#e74c3c":"#1a1a1a",fontWeight:hb>=HEALTH_PER_DAY?700:400}}>{hb}</span>
                <span style={{fontSize:11,color:DS.textSec}}>{hMins}m</span>
                <span style={{fontSize:12}}>{lb}</span>
                <span style={{fontSize:12,color:sick>0?"#c0392b":"#888"}}>{sick}</span>
                <span style={{fontSize:12,color:calloff>0?"#e07b00":"#888"}}>{calloff}</span>
              </div>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginTop:14}}>
            {[
              {label:"Total Health Breaks",val:repStats.reduce((a,s)=>a+s.hb,0),icon:"🌿"},
              {label:"Total Lunch Breaks",val:repStats.reduce((a,s)=>a+s.lb,0),icon:"🥗"},
              {label:"Absences",val:repStats.reduce((a,s)=>a+s.sick+s.calloff,0),icon:"📵"},
            ].map(s=>(
              <div key={s.label} style={{background:DS.bgCard,borderRadius:12,border:`1px solid ${DS.border}`,padding:"12px 14px",textAlign:"center"}}>
                <p style={{margin:"0 0 4px",fontSize:22}}>{s.icon}</p>
                <p style={{margin:0,fontSize:20,fontWeight:800,color:DS.textPri}}>{s.val}</p>
                <p style={{margin:0,fontSize:10,color:DS.textMut}}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── MGR: PTO ──────────────────────────────────────────────────────────
function MgrPTO({ reps, reload, fire }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [ptoEntries, setPtoEntries] = useState([]);
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState({rep_id:"",pto_date:"",note:""});

  const getWeekDays = (offset=0) => {
    const today = new Date();
    const mon = new Date(today);
    mon.setDate(today.getDate() - today.getDay() + 1 + offset*7);
    return Array.from({length:7},(_,i)=>{ const d=new Date(mon); d.setDate(mon.getDate()+i); return d; });
  };

  const weekDays = getWeekDays(weekOffset);
  const weekStart = weekDays[0].toISOString().split('T')[0];
  const weekEnd   = weekDays[6].toISOString().split('T')[0];

  useEffect(()=>{
    sb(`calloffs?calloff_date=gte.${weekStart}&calloff_date=lte.${weekEnd}&reason=eq.pto&select=*&order=calloff_date`)
      .then(setPtoEntries).catch(()=>{});
  },[weekOffset,weekStart,weekEnd]);

  const addPTO = async () => {
    const rep = reps.find(r=>r.id===parseInt(addForm.rep_id));
    if(!rep||!addForm.pto_date){fire("declined","Select a rep and date");return;}
    await sbPost("calloffs",{rep_id:rep.id,rep_name:rep.name,calloff_date:addForm.pto_date,reason:"pto",note:addForm.note||"",logged_by:"manager"});
    fire("approved",`PTO added for ${rep.name}`);
    setAdding(false); setAddForm({rep_id:"",pto_date:"",note:""});
    const updated = await sb(`calloffs?calloff_date=gte.${weekStart}&calloff_date=lte.${weekEnd}&reason=eq.pto&select=*&order=calloff_date`);
    setPtoEntries(updated);
  };

  const removePTO = async (id, name) => {
    await sbDel("calloffs",id);
    fire("info",`PTO removed for ${name}`);
    setPtoEntries(p=>p.filter(e=>e.id!==id));
  };

  const dayNames = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

  return (
    <div style={{marginTop:16}}>
      {adding&&(
        <Modal title="Add PTO" sub="NEW ENTRY" onClose={()=>setAdding(false)}>
          <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:14}}>
            <div>
              <label style={{fontSize:12,color:DS.textSec,display:"block",marginBottom:4}}>Rep</label>
              <select value={addForm.rep_id} onChange={e=>setAddForm(p=>({...p,rep_id:e.target.value}))} style={{width:"100%",padding:"9px 12px",borderRadius:9,border:`1px solid ${DS.border}`,fontSize:13,outline:"none",background:DS.bgCard}}>
                <option value="">Select rep…</option>
                {reps.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:12,color:DS.textSec,display:"block",marginBottom:4}}>Date</label>
              <input type="date" value={addForm.pto_date} onChange={e=>setAddForm(p=>({...p,pto_date:e.target.value}))} style={{width:"100%",padding:"9px 12px",borderRadius:9,border:`1px solid ${DS.border}`,fontSize:13,outline:"none"}}/>
            </div>
            <div>
              <label style={{fontSize:12,color:DS.textSec,display:"block",marginBottom:4}}>Note (optional)</label>
              <input value={addForm.note} onChange={e=>setAddForm(p=>({...p,note:e.target.value}))} placeholder="e.g. Annual leave" style={{width:"100%",padding:"9px 12px",borderRadius:9,border:`1px solid ${DS.border}`,fontSize:13,outline:"none"}}/>
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <Btn label="Cancel" onClick={()=>setAdding(false)} outline color="#888" small/>
            <Btn label="Add PTO" onClick={addPTO} color="#8e44ad"/>
          </div>
        </Modal>
      )}

      {/* Week nav */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <button onClick={()=>setWeekOffset(p=>p-1)} style={{padding:"6px 12px",borderRadius:8,border:`1px solid ${DS.border}`,background:DS.bgSurf,cursor:"pointer",fontSize:13}}>← Prev</button>
        <span style={{fontSize:13,fontWeight:600,color:DS.textPri}}>
          {weekOffset===0?"This Week":weekOffset===1?"Next Week":weekOffset===-1?"Last Week":`${weekDays[0].toLocaleDateString("en-US",{month:"short",day:"numeric"})} – ${weekDays[6].toLocaleDateString("en-US",{month:"short",day:"numeric"})}`}
        </span>
        <button onClick={()=>setWeekOffset(p=>p+1)} style={{padding:"6px 12px",borderRadius:8,border:`1px solid ${DS.border}`,background:DS.bgSurf,cursor:"pointer",fontSize:13}}>Next →</button>
      </div>

      {/* Weekly grid */}
      <div style={{background:DS.bgCard,borderRadius:14,border:`1px solid ${DS.border}`,overflow:"hidden",marginBottom:14}}>
        <div style={{display:"grid",gridTemplateColumns:`120px repeat(7,1fr)`,borderBottom:"1px solid #f0f0f0"}}>
          <div style={{padding:"8px 10px",background:DS.bgSurf}}/>
          {weekDays.map((d,i)=>{
            const isToday=d.toISOString().split('T')[0]===todayStr();
            return (
              <div key={i} style={{padding:"6px 4px",background:isToday?"#f0faf4":"#f8f8f8",textAlign:"center",borderLeft:"1px solid #f0f0f0"}}>
                <p style={{margin:0,fontSize:10,color:isToday?"#1a5c35":"#999",fontWeight:isToday?700:600}}>{dayNames[i]}</p>
                <p style={{margin:0,fontSize:11,fontWeight:600,color:isToday?"#1a5c35":"#555"}}>{d.getDate()}</p>
              </div>
            );
          })}
        </div>
        {reps.map(rep=>{
          const rowPTO = ptoEntries.filter(e=>e.rep_id===rep.id);
          return (
            <div key={rep.id} style={{display:"grid",gridTemplateColumns:`120px repeat(7,1fr)`,borderBottom:"1px solid #f8f8f8"}}>
              <div style={{padding:"7px 10px",display:"flex",alignItems:"center",gap:6}}>
                <div style={{width:22,height:22,borderRadius:"50%",background:DS.greenDim,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:700,color:DS.green,flexShrink:0}}>{rep.avatar||avatar(rep.name)}</div>
                <span style={{fontSize:11,fontWeight:600,color:DS.textPri,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{rep.name}</span>
              </div>
              {weekDays.map((d,i)=>{
                const ds=d.toISOString().split('T')[0];
                const pto=rowPTO.find(e=>e.calloff_date===ds);
                const isToday=ds===todayStr();
                return (
                  <div key={i} style={{padding:"5px 3px",textAlign:"center",borderLeft:"1px solid #f8f8f8",background:pto?"#f5eefb":isToday?"#fafff8":"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {pto?(
                      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                        <span style={{fontSize:9,color:"#8e44ad",fontWeight:700}}>PTO</span>
                        <button onClick={()=>removePTO(pto.id,rep.name)} style={{fontSize:9,color:"#e74c3c",background:"none",border:"none",cursor:"pointer",padding:0,lineHeight:1}}>✕</button>
                      </div>
                    ):(
                      <button onClick={()=>{setAddForm({rep_id:String(rep.id),pto_date:ds,note:""});setAdding(true);}} style={{fontSize:10,color:DS.textMut,background:"none",border:"none",cursor:"pointer",padding:2,borderRadius:4}}>+</button>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <button onClick={()=>setAdding(true)} style={{width:"100%",padding:"11px",borderRadius:12,border:"none",background:"#8e44ad",color:"#fff",cursor:"pointer",fontSize:14,fontWeight:700}}>+ Add PTO Entry</button>

      {/* Legend */}
      <div style={{marginTop:12,padding:"10px 14px",background:DS.bgCard,borderRadius:10,border:`1px solid ${DS.border}`,display:"flex",gap:16,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:5}}><span style={{fontSize:9,color:"#8e44ad",fontWeight:700,background:DS.accentDim,padding:"2px 6px",borderRadius:4}}>PTO</span><span style={{fontSize:11,color:DS.textSec}}>Pre-loaded from calendar</span></div>
        <div style={{display:"flex",alignItems:"center",gap:5}}><span style={{fontSize:11,color:DS.textMut}}>+</span><span style={{fontSize:11,color:DS.textSec}}>Click to add PTO for that day</span></div>
        <div style={{display:"flex",alignItems:"center",gap:5}}><span style={{fontSize:9,color:"#e74c3c"}}>✕</span><span style={{fontSize:11,color:DS.textSec}}>Click to remove</span></div>
      </div>
    </div>
  );
}

// ── MGR: SETTINGS ─────────────────────────────────────────────────────
function MgrSettings({ settings, reps, reload, fire }) {
  const [customCap, setCustomCap] = useState(settings.custom_limit??Math.floor(reps.length*0.3));
  const activeReps = reps.filter(r=>!["off","pto","sick"].includes(r.status)&&(r.rep_stage||"active")!=="not_started");
  const [adminLimit, setAdminLimit] = useState(settings.admin_limit??2);
  const notifPrefs = settings.notif_prefs||{};
  const ping = makePinger(notifPrefs, settings.execo_webhook);

  const togglePeak = async () => {
    const newVal = !settings.peak_mode;
    await sbPatch("app_settings",1,{peak_mode:newVal,updated_at:new Date().toISOString()});
    fire("info",`Peak mode ${newVal?"enabled":"disabled"}`);
    if(newVal) ping.main("peak_mode","⚡ *Volume is building — back to the phones!* Peak mode is now active. Let's keep those calls answered 💪");
    reload();
  };

  const toggleAdmin = async () => {
    const newVal = !settings.admin_mode;
    await sbPatch("app_settings",1,{admin_mode:newVal,updated_at:new Date().toISOString()});
    fire("info",`Admin mode ${newVal?"enabled":"disabled"}`);
    if(newVal) ping.main("admin_mode","🗂️ *Admin time is open!* Calls are quiet — jump into the break app and tap Admin Time to take a 30-min slot for emails and tickets. Watch for the banner 👀");
    reload();
  };

  const saveAdminLimit = async () => {
    await sbPatch("app_settings",1,{admin_limit:adminLimit,updated_at:new Date().toISOString()});
    fire("approved","Admin limit updated");
    reload();
  };

  const resetAdminLimit = async () => {
    await sbPatch("app_settings",1,{admin_limit:null,updated_at:new Date().toISOString()});
    setAdminLimit(2);
    fire("info","Admin limit reset to 2");
    reload();
  };

  const saveCap = async () => {
    await sbPatch("app_settings",1,{custom_limit:customCap,updated_at:new Date().toISOString()});
    fire("approved","Team cap updated");
    reload();
  };

  const resetCap = async () => {
    await sbPatch("app_settings",1,{custom_limit:null,updated_at:new Date().toISOString()});
    setCustomCap(Math.floor(reps.length*0.3));
    fire("info","Cap reset to 30% default");
    reload();
  };

  return (
    <div style={{marginTop:16,display:"flex",flexDirection:"column",gap:14}}>
      {/* Peak Mode */}
      <div style={{background:DS.bgCard,borderRadius:14,border:`1px solid ${DS.border}`,padding:"16px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div>
            <p style={{margin:0,fontWeight:700,fontSize:14}}>⚡ Peak Mode</p>
            <p style={{margin:"3px 0 0",fontSize:12,color:DS.textSec}}>Limits health breaks to 1 at a time</p>
          </div>
          <div onClick={togglePeak} style={{width:46,height:26,borderRadius:13,background:settings.peak_mode?"#1a5c35":"#ccc",cursor:"pointer",position:"relative",transition:"background .2s"}}>
            <div style={{width:20,height:20,borderRadius:"50%",background:DS.bgCard,position:"absolute",top:3,left:settings.peak_mode?23:3,transition:"left .2s"}}/>
          </div>
        </div>
        {settings.peak_mode&&<p style={{margin:0,fontSize:11,color:"#e74c3c",fontWeight:600}}>⚡ Active — health breaks limited to 1 at a time</p>}
      </div>

      {/* Admin Time */}
      <div style={{background:DS.bgCard,borderRadius:14,border:`1px solid ${DS.border}`,padding:"16px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div>
            <p style={{margin:0,fontWeight:700,fontSize:14}}>🗂️ Admin Time</p>
            <p style={{margin:"3px 0 0",fontSize:12,color:DS.textSec}}>Allow reps to take 30-min admin slots for emails and tickets</p>
          </div>
          <div onClick={toggleAdmin} style={{width:46,height:26,borderRadius:13,background:settings.admin_mode?"#1d4ed8":"#ccc",cursor:"pointer",position:"relative",transition:"background .2s",flexShrink:0}}>
            <div style={{width:20,height:20,borderRadius:"50%",background:DS.bgCard,position:"absolute",top:3,left:settings.admin_mode?23:3,transition:"left .2s"}}/>
          </div>
        </div>
        {settings.admin_mode&&<>
          <p style={{margin:"0 0 8px",fontSize:12,color:DS.textSec}}>Active team: {activeReps.length}</p>
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10}}>
            <input type="number" min={1} max={activeReps.length} value={adminLimit} onChange={e=>setAdminLimit(parseInt(e.target.value)||1)} style={{width:70,padding:"9px 12px",borderRadius:9,border:`1px solid ${DS.border}`,fontSize:14,outline:"none",textAlign:"center"}}/>
            <span style={{fontSize:13,color:DS.textSec}}>max people on admin at once</span>
          </div>
          <div style={{display:"flex",gap:8}}>
            <Btn label="Reset to 2" onClick={resetAdminLimit} outline color="#888" small/>
            <Btn label="Save Limit" onClick={saveAdminLimit} color="#1d4ed8" small/>
          </div>
          <p style={{margin:"10px 0 0",fontSize:11,color:"#1d4ed8",fontWeight:600}}>🗂️ Active — best windows: 7–9am CT and after 6pm CT</p>
        </>}
      </div>

      {/* Notification Preferences */}
      <div style={{background:DS.bgCard,borderRadius:14,border:`1px solid ${DS.border}`,padding:"16px"}}>
        <p style={{margin:"0 0 4px",fontWeight:700,fontSize:14}}>🔔 GChat Notification Preferences</p>
        <p style={{margin:"0 0 14px",fontSize:12,color:DS.textSec}}>Choose which events ping GChat. All are on by default.</p>
        {["main","execo"].map(ch=>(
          <div key={ch} style={{marginBottom:14}}>
            <p style={{margin:"0 0 8px",fontSize:11,fontWeight:700,color:DS.textSec,textTransform:"uppercase",letterSpacing:.5}}>
              {ch==="main"?"📢 Main ESC Space":"👔 Execo Managers Space"}
            </p>
            {NOTIF_EVENTS.filter(e=>e.ch===ch||e.ch==="both").map(e=>{
              const isOn = notifPrefs[e.k]!==false;
              return (
                <div key={e.k} onClick={async()=>{
                  const updated={...notifPrefs,[e.k]:!isOn};
                  await sbPatch("app_settings",1,{notif_prefs:updated,updated_at:new Date().toISOString()});
                  reload();
                }} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",borderRadius:8,background:isOn?"#f8f8f8":"#fdf0ee",marginBottom:5,cursor:"pointer",border:`1px solid ${isOn?"#eee":"#f5b7b1"}`}}>
                  <span style={{fontSize:12,color:isOn?"#1a1a1a":"#888"}}>{e.l}</span>
                  <div style={{width:36,height:20,borderRadius:10,background:isOn?"#1a5c35":"#ccc",position:"relative",transition:"background .2s",flexShrink:0}}>
                    <div style={{width:16,height:16,borderRadius:"50%",background:DS.bgCard,position:"absolute",top:2,left:isOn?18:2,transition:"left .2s"}}/>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <button onClick={async()=>{
          await sbPatch("app_settings",1,{notif_prefs:{},updated_at:new Date().toISOString()});
          fire("info","All notifications reset to on");
          reload();
        }} style={{padding:"7px 14px",borderRadius:8,border:`1px solid ${DS.border}`,background:DS.bgSurf,cursor:"pointer",fontSize:11,color:DS.textSec,fontWeight:600}}>Reset all to ON</button>
      </div>
      <div style={{background:DS.bgCard,borderRadius:14,border:`1px solid ${DS.border}`,padding:"16px"}}>
        <p style={{margin:"0 0 4px",fontWeight:700,fontSize:14}}>🔔 Execo Managers GChat</p>
        <p style={{margin:"0 0 12px",fontSize:12,color:DS.textSec}}>Separate space for ad hoc lunch requests and approvals — for when you are unavailable</p>
        <input value={settings.execo_webhook||""} onChange={async e=>{
          await sbPatch("app_settings",1,{execo_webhook:e.target.value||null,updated_at:new Date().toISOString()});
          reload();
        }} placeholder="Paste GChat webhook URL…"
          style={{width:"100%",boxSizing:"border-box",padding:"9px 12px",borderRadius:9,border:`1px solid ${DS.border}`,fontSize:12,outline:"none"}}/>
        {settings.execo_webhook&&<p style={{margin:"6px 0 0",fontSize:11,color:DS.green,fontWeight:600}}>✅ Execo webhook active</p>}
      </div>
      <div style={{background:DS.bgCard,borderRadius:14,border:`1px solid ${DS.border}`,padding:"16px"}}>
        <p style={{margin:"0 0 4px",fontWeight:700,fontSize:14}}>👥 Team Break Cap</p>
        <p style={{margin:"0 0 12px",fontSize:12,color:DS.textSec}}>Default: 30% of active team = {Math.floor(reps.length*0.3)} max out at once</p>
        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10}}>
          <input type="number" min={1} max={reps.length} value={customCap} onChange={e=>setCustomCap(parseInt(e.target.value))} style={{width:70,padding:"9px 12px",borderRadius:9,border:`1px solid ${DS.border}`,fontSize:14,outline:"none",textAlign:"center"}}/>
          <span style={{fontSize:13,color:DS.textSec}}>max people out at once</span>
        </div>
        <div style={{display:"flex",gap:8}}>
          <Btn label="Reset to 30%" onClick={resetCap} outline color="#888" small/>
          <Btn label="Save Cap" onClick={saveCap} color="#1a5c35" small/>
        </div>
      </div>

      {/* Break Rules Summary */}
      <div style={{background:DS.bgCard,borderRadius:14,border:`1px solid ${DS.border}`,padding:"16px"}}>
        <p style={{margin:"0 0 10px",fontWeight:700,fontSize:14}}>📋 Current Rules</p>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {[
            ["🌿","Health break: 10 min max, 3 per day per rep"],
            ["⏳","2-hour cooldown after full 10 min used"],
            ["🥗","Lunch: max 3 out at once"],
            ["👥",`Team cap: ${customCap} people out at once (30%)`],
            ["⚡",`Peak mode: ${settings.peak_mode?"ON (max 1 health break)":"OFF"}`],
          ].map(([i,t],n)=>(
            <div key={n} style={{display:"flex",gap:8,alignItems:"flex-start"}}>
              <span style={{fontSize:14}}>{i}</span>
              <span style={{fontSize:12,color:DS.textSec,lineHeight:1.5}}>{t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── REP VIEW ──────────────────────────────────────────────────────────
function RepView({ repInfo, data, reload, onLogout, centreOpen }) {
  const { reps, settings, swaps, activeBreaks, breakQueue=[], adHoc=[] } = data;
  const [tab, setTab] = useState("my");
  const [toast, setToast] = useState(null);
  const fire = (type,msg) => setToast({type,msg,id:Date.now()});
  const [theme] = useTheme();
  const gStyle = buildGStyle(theme);

  const myRep = reps.find(r=>r.id===repInfo.id)||{...repInfo,status:"available",health_breaks_today:0,health_time_banked:0};
  const mySwaps = swaps.filter(s=>s.target_id===repInfo.id&&s.status==="pending");
  const onLunch  = reps.filter(r=>r.status==="lunch").length;
  const onHealth = reps.filter(r=>r.status==="health").length;
  const activeReps = reps.filter(r=>!["off","pto","sick"].includes(r.status));
  const maxOut = settings.custom_limit ?? Math.max(3, Math.floor(activeReps.length*0.3));
  const totalOut = reps.filter(r=>["health","lunch","admin"].includes(r.status)).length;
  const hLimit = settings.peak_mode ? H_LIMIT_PEAK : H_LIMIT_NORMAL;
  const lunchLeft = LUNCH_LIMIT - onLunch;
  const healthLeft = hLimit - onHealth;
  const capLeft = Math.max(0, maxOut - totalOut);

  const myAB = activeBreaks.find(b=>b.rep_id===repInfo.id);
  const cooldownActive = !!(myRep.health_time_banked>=HEALTH_MAX_SEC && myRep.last_break_returned_at && elapsedSec(myRep.last_break_returned_at)<COOLDOWN_SEC);
  const cooldownLeft = cooldownActive ? COOLDOWN_SEC - elapsedSec(myRep.last_break_returned_at||new Date().toISOString()) : 0;
  const timeUsedToday = myRep.health_time_today||0;
  const breaksLeft = HEALTH_PER_DAY - (myRep.health_breaks_today||0);

  const canTakeHealth = healthLeft>0 && !cooldownActive && breaksLeft>0 && myRep.status==="available";
  const canTakeLunch  = lunchLeft>0 && capLeft>0 && myRep.status==="available";
  const adminLimit    = settings.admin_limit ?? 2;
  const onAdmin       = reps.filter(r=>r.status==="admin").length;
  const canTakeAdmin  = !!settings.admin_mode && onAdmin<adminLimit && myRep.status==="available";

  // Queue helpers
  const myQueueEntry = breakQueue.find(q=>q.rep_id===repInfo.id);
  const queuePosition = myQueueEntry?.status==="waiting" ? breakQueue.filter(q=>q.status==="waiting"&&q.queued_at<=myQueueEntry.queued_at).length : 0;
  const isNotified = myQueueEntry?.status==="notified";
  const notifiedSecsAgo = isNotified ? elapsedSec(myQueueEntry.notified_at) : 0;
  const acceptSecsLeft = isNotified ? Math.max(0, QUEUE_ACCEPT_SEC - notifiedSecsAgo) : 0;

  const joinQueue = async () => {
    if(myQueueEntry) return;
    await sbPost("break_queue",{rep_id:repInfo.id,rep_name:repInfo.name,status:"waiting",date:todayStr()});
    fire("info","You're in the queue! We'll alert you when a slot opens 🌿");
    reload();
  };

  const leaveQueue = async () => {
    if(!myQueueEntry) return;
    await sbPatch("break_queue",myQueueEntry.id,{status:"cancelled"});
    fire("info","Removed from queue");
    reload();
  };

  const acceptQueuedBreak = async () => {
    if(!myQueueEntry) return;
    await sbPatch("break_queue",myQueueEntry.id,{status:"accepted"});
    const updates = {status:"health",updated_at:new Date().toISOString()};
    await sbPatch("rep_status",repInfo.id,updates);
    await sbPost("break_log",{rep_id:repInfo.id,rep_name:repInfo.name,break_type:"health"});
    fire("approved","Enjoy your health break 🌿");
    reload();
  };

  const processQueue = async () => {
    // expire any notifications older than QUEUE_ACCEPT_SEC
    const expired = breakQueue.filter(q=>q.status==="notified"&&elapsedSec(q.notified_at)>=QUEUE_ACCEPT_SEC);
    for(const e of expired) await sbPatch("break_queue",e.id,{status:"expired"});
    // notify the next waiting rep
    const waiting = breakQueue.filter(q=>q.status==="waiting").sort((a,b)=>new Date(a.queued_at)-new Date(b.queued_at));
    if(waiting.length>0) await sbPatch("break_queue",waiting[0].id,{status:"notified",notified_at:new Date().toISOString()});
  };

  const startBreak = async (type) => {
    if(type!=="health" && capLeft<=0){
      fire("declined","Team cap reached — all break slots full");return;
    }
    if(type==="health"&&capLeft<=0){
      if(!myQueueEntry&&breaksLeft>0&&!cooldownActive){
        await joinQueue(); return;
      }
    }
    if(type==="health"){
      if(healthLeft<=0){
        if(!myQueueEntry&&breaksLeft>0&&!cooldownActive){
          await joinQueue(); return;
        }
        fire("declined","Health break slots full");return;
      }
      if(cooldownActive){fire("declined",`Cooldown active — ${fmtTime(cooldownLeft)} remaining`);return;}
    if(breaksLeft<=0){fire("declined","You've used all 3 health breaks today");return;}
  
    }
    if(type==="lunch"){
      if(lunchLeft<=0){fire("declined","Lunch slots full");return;}
      if(!inLunchWindow(myRep)){
        await sbPost("adhoc_lunch_requests",{rep_id:repInfo.id,rep_name:repInfo.name,requested_time:new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})});
        fire("info","Outside your lunch window — ad hoc request sent to manager 📩");
        reload(); return;
      }
    }
    if(type==="admin"){
      
      if(onAdmin>=adminLimit){fire("declined","Admin slots full — too many reps on admin");return;}
    }
    const bankedReset = type==="health" && myRep.health_time_banked>=HEALTH_MAX_SEC && !cooldownActive;
    const updates = {status:type,updated_at:new Date().toISOString()};
    if(bankedReset) updates.health_time_banked = 0; // start fresh cycle after cooldown expired
    await sbPatch("rep_status",repInfo.id,updates);
    await sbPost("break_log",{rep_id:repInfo.id,rep_name:repInfo.name,break_type:type});
    fire("approved",`Enjoy your ${type==="lunch"?"lunch 🥗":type==="admin"?"admin time 🗂️":"health break 🌿"}!`);
    reload();
  };

  const returnFromBreak = async () => {
    const ab = activeBreaks.find(b=>b.rep_id===repInfo.id);
    const durSec = ab ? elapsedSec(ab.started_at) : 0;
    const newBanked = myRep.status==="health" ? (myRep.health_time_banked||0)+durSec : 0;
    const updates = {status:"available",updated_at:new Date().toISOString()};
    if(myRep.status==="health") {
      if(newBanked >= HEALTH_MAX_SEC) {
        updates.health_time_banked = HEALTH_MAX_SEC;
        updates.last_break_returned_at = new Date().toISOString();
        updates.health_breaks_today = (myRep.health_breaks_today||0)+1;
        fire("info","10 min banked — 2-hour cooldown now active 🕐");
      } else {
        updates.health_time_banked = newBanked;
      }
    }
    if(ab) await sb(`break_log?id=eq.${ab.id}`,{method:"PATCH",body:JSON.stringify({ended_at:new Date().toISOString(),duration_seconds:durSec})});
    await sbPatch("rep_status",repInfo.id,updates);
    fire("approved",myRep.status==="admin"?"Admin time done — welcome back! 🗂️":"Welcome back! You're on duty 🎉");
    await processQueue();
    reload();
  };

  const requestAdHocLunch = async (preferredTime, note) => {
    const tz = myRep.timezone||"Central";
    await sbPost("adhoc_lunch_requests",{
      rep_id:repInfo.id,
      rep_name:repInfo.name,
      requested_time:new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),
      preferred_time:preferredTime||null,
      rep_timezone:tz,
      note:note||null,
    });
    // Ping Execo managers space
    const repPing = makePinger(settings.notif_prefs||{}, settings.execo_webhook);
    repPing.execo("adhoc_request","🥗 *Ad hoc lunch request* from *"+repInfo.name+"* ("+tz+"). "+(preferredTime?"Preferred: "+preferredTime+" "+tz:"No preferred time given")+(note?" — \""+note+"\"":"")+". Awaiting manager approval.");
    fire("info","Ad hoc lunch request sent to manager 📩");
    reload();
  };

  return (
    <div style={{fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",minHeight:"100vh",background:DS.bg,paddingBottom:60}}>
      <style>{gStyle}</style>
      {toast&&<Toast key={toast.id} msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}

      {/* Header */}
      <div style={{background:DS.bgCard,borderBottom:`1px solid ${DS.border}`,padding:"16px 18px 14px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div>
            <p style={{margin:0,fontSize:10,color:DS.accent,letterSpacing:2,textTransform:"uppercase",fontWeight:600}}>execo · esc</p>
            <h1 style={{margin:"2px 0 1px",fontSize:20,fontWeight:700,color:DS.textPri}}>Hey, {repInfo.name}</h1>
            <p style={{margin:0,fontSize:11,color:DS.textSec}}>{todayLabel(myRep?.timezone)}</p>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <ThemeToggle size="small"/>
            <button onClick={onLogout} style={{padding:"6px 12px",borderRadius:DS.radiusSm,border:`1px solid ${DS.border}`,background:"transparent",color:DS.textSec,cursor:"pointer",fontSize:11}}>Switch</button>
          </div>
        </div>

        {/* Capacity tiles */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6}}>
          {[
            {label:"Health",avail:healthLeft,total:hLimit,sub:cooldownActive?fmtTime(cooldownLeft):"available"},
            {label:"Lunch",avail:lunchLeft,total:LUNCH_LIMIT,sub:"slots"},
            {label:"Team",avail:capLeft,total:maxOut,sub:"slots"},
            {label:"Admin",avail:adminLimit-onAdmin,total:adminLimit,sub:"slots"},
          ].map(m=>(
            <div key={m.label} style={{background:m.avail===0?DS.redDim:DS.bgSurf,borderRadius:DS.radiusSm,padding:"8px 10px",border:`1px solid ${m.avail===0?DS.red+"40":DS.border}`}}>
              <p style={{margin:"0 0 2px",fontSize:10,color:DS.textMut}}>{m.label}</p>
              <p style={{margin:0,fontSize:13,fontWeight:700,color:m.avail===0?DS.red:DS.textPri}}>{m.avail===0?"Full":`${m.avail}/${m.total}`}</p>
              <p style={{margin:0,fontSize:9,color:DS.textMut}}>{m.sub}</p>
            </div>
          ))}
        </div>

        {settings.peak_mode&&<div style={{marginTop:10,background:DS.redDim,border:`1px solid ${DS.red}30`,borderRadius:DS.radiusSm,padding:"6px 12px",fontSize:11,color:DS.red,fontWeight:600}}>⚡ Peak mode — health breaks limited to 1 at a time</div>}
        <div style={{marginTop:10}}><RepKPI repName={repInfo.name}/></div>
        <BreakRecommendation repName={repInfo.name} reps={reps} settings={settings} onAdmin={onAdmin} onLunch={onLunch} onHealth={onHealth} canTakeAdmin={canTakeAdmin} canTakeHealth={canTakeHealth} cooldownActive={cooldownActive}/>
      </div>

      {/* Rep Tabs */}
      <div style={{background:DS.bgCard,borderBottom:`1px solid ${DS.border}`}}>
        <div style={{display:"flex",padding:"0 16px"}}>
          {[{k:"my",l:"My Break"},{k:"team",l:"Team"},{k:"swaps",l:`Swaps${mySwaps.length>0?` (${mySwaps.length})`:""}`},...(HUB_ENABLED?[{k:"hub",l:"Hub"}]:[])].map(t=>(
            <button key={t.k} onClick={()=>setTab(t.k)} style={{
              padding:"11px 14px",border:"none",background:"none",cursor:"pointer",
              fontSize:12,fontWeight:tab===t.k?600:400,
              color:tab===t.k?DS.accent:mySwaps.length>0&&t.k==="swaps"?DS.amber:DS.textSec,
              borderBottom:tab===t.k?`2px solid ${DS.accent}`:"2px solid transparent",
              marginBottom:-1,transition:"all .15s",
            }}>{t.l}</button>
          ))}
        </div>
      </div>

      <div style={{padding:"16px",maxWidth:480,margin:"0 auto"}}>
        {tab==="my"&&(
          <RepMyBreak myRep={myRep} myAB={myAB} canTakeHealth={canTakeHealth} canTakeLunch={canTakeLunch} canTakeAdmin={canTakeAdmin} cooldownActive={cooldownActive} cooldownLeft={cooldownLeft} breaksLeft={breaksLeft} startBreak={startBreak} returnFromBreak={returnFromBreak} requestAdHocLunch={requestAdHocLunch} repInfo={repInfo} breakQueue={breakQueue} myQueueEntry={myQueueEntry} queuePosition={queuePosition} isNotified={isNotified} acceptSecsLeft={acceptSecsLeft} joinQueue={joinQueue} leaveQueue={leaveQueue} acceptQueuedBreak={acceptQueuedBreak} settings={settings}/>
        )}
        {tab==="team"&&<RepTeam reps={reps} myId={repInfo.id} activeBreaks={activeBreaks}/>}
        {tab==="swaps"&&<RepSwaps myRep={myRep} reps={reps} swaps={swaps} reload={reload} fire={fire} repInfo={repInfo}/>}
      </div>
      {tab==="hub"&&HUB_ENABLED&&<HubView isManager={false}/>}
    </div>
  );
}

function RepKPI({ repName, agentFullName }) {
  const PAID_DISPS  = new Set(["Registered","Registered: Eval/L1O","Registered: Eval/WBO","Outbound - Registered"]);
  const TRIAL_DISPS = new Set(["Registered: Trial","Outbound - Trial"]);
  const PAID_TARGET  = 20;
  const TOTAL_TARGET = 45;
  const [tab, setTab] = useState("week");

  const since = ctDaysAgo(90);
  const agentKey = agentFullName ? "hs_agent_name" : "hs_agent_name";
  const agentVal = agentFullName
    ? `eq.${encodeURIComponent(agentFullName)}`
    : `ilike.*${encodeURIComponent(repName?.split(" ")[0]||"")}*`;
  const { rows: myRows, loading } = useKpiQuery(agentKey, agentVal, since);

  if(loading) return (
    <div style={{background:DS.bgSurf,borderRadius:DS.radiusSm,padding:"12px 14px",border:`1px solid ${DS.border}`,textAlign:"center"}}>
      <p style={{margin:0,fontSize:11,color:DS.textMut}}>Loading your stats…</p>
    </div>
  );
  if(!myRows.length) return null;

  // ── helpers ──────────────────────────────────────────────────────────
  function ctDate(ts) {
    return new Date(new Date(ts).toLocaleString("en-US",{timeZone:"America/Chicago"}));
  }
  // Extract YYYY-MM-DD directly from the CT date object — do NOT use toISOString() which converts back to UTC
  function dateStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    const day = String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${day}`;
  }

  // Week key = Sunday of that week (week ends Sunday)
  function weekEndingSunday(d) {
    const day = d.getDay(); // 0=Sun
    const sun = new Date(d);
    sun.setDate(d.getDate() + (day===0 ? 0 : 7-day));
    return dateStr(sun);
  }

  function calcStats(rows) {
    const calls = rows.length;
    const paid  = rows.filter(r=>PAID_DISPS.has(r.hs_call_disposition_label)).length;
    const trial = rows.filter(r=>TRIAL_DISPS.has(r.hs_call_disposition_label)).length;
    return {
      calls, paid, trial,
      paidCvr:  calls ? parseFloat((paid/calls*100).toFixed(1)) : 0,
      trialCvr: calls ? parseFloat((trial/calls*100).toFixed(1)) : 0,
      totalCvr: calls ? parseFloat(((paid+trial)/calls*100).toFixed(1)) : 0,
    };
  }

  function color(val, target) {
    if(val >= target)     return DS.green;
    if(val >= target - 5) return DS.amber;
    return DS.red;
  }
  function bg(val, target) {
    if(val >= target)     return DS.greenDim;
    if(val >= target - 5) return DS.amberDim;
    return DS.redDim;
  }
  function border(val, target) {
    if(val >= target)     return DS.green+"30";
    if(val >= target - 5) return DS.amber+"30";
    return DS.red+"30";
  }

  // ── WEEKLY ───────────────────────────────────────────────────────────
  // Build all weeks ending Sunday
  const weekMap = {};
  myRows.forEach(r=>{
    const d = ctDate(r.hs_call_timestamp);
    const wk = weekEndingSunday(d);
    if(!weekMap[wk]) weekMap[wk] = [];
    weekMap[wk].push(r);
  });
  const weeks = Object.entries(weekMap)
    .sort(([a],[b])=>a.localeCompare(b))
    .map(([wk, rows])=>({wk, ...calcStats(rows)}));

  // Previous completed week = last full week before current week ending Sunday
  const todayCT = ctDate(new Date());
  const currentWeekKey = weekEndingSunday(todayCT);
  const completedWeeks = weeks.filter(w=>w.wk < currentWeekKey);
  const lastWeek = completedWeeks[completedWeeks.length-1];
  const prevWeek = completedWeeks[completedWeeks.length-2];

  // ── DAILY (previous shift) ────────────────────────────────────────────
  const dayMap = {};
  myRows.forEach(r=>{
    const d = ctDate(r.hs_call_timestamp);
    const dk = dateStr(d);
    if(!dayMap[dk]) dayMap[dk]=[];
    dayMap[dk].push(r);
  });
  const allDays = Object.keys(dayMap).sort();
  const todayStr = dateStr(todayCT);
  // Previous shift = most recent day with calls, excluding today
  const prevShiftKey = [...allDays].reverse().find(d=>d < todayStr);
  const prevShiftRows = prevShiftKey ? dayMap[prevShiftKey] : [];
  const prevShiftStats = calcStats(prevShiftRows);
  const prevShiftLabel = prevShiftKey
    ? new Date(prevShiftKey+"T12:00:00Z").toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"})
    : null;

  // ── MONTHLY ──────────────────────────────────────────────────────────
  const monthMap = {};
  myRows.forEach(r=>{
    const d = ctDate(r.hs_call_timestamp);
    const mk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    if(!monthMap[mk]) monthMap[mk]=[];
    monthMap[mk].push(r);
  });
  const months = Object.entries(monthMap)
    .sort(([a],[b])=>a.localeCompare(b))
    .map(([mk, rows])=>{
      const [y,m] = mk.split("-");
      const label = new Date(parseInt(y), parseInt(m)-1, 1).toLocaleDateString("en-US",{month:"long",year:"numeric"});
      return {mk, label, ...calcStats(rows)};
    });
  const currentMonthKey = `${todayCT.getFullYear()}-${String(todayCT.getMonth()+1).padStart(2,"0")}`;
  const prevMonths = months.filter(m=>m.mk <= currentMonthKey).slice(-3);

  // ── STAT TILE ─────────────────────────────────────────────────────────
  function StatTile({label, val, target, sub}) {
    return (
      <div style={{background:bg(val,target),borderRadius:DS.radiusSm,padding:"10px 12px",border:`1px solid ${border(val,target)}`}}>
        <p style={{margin:"0 0 2px",fontSize:10,color:DS.textMut}}>{label}</p>
        <p style={{margin:"0 0 2px",fontSize:22,fontWeight:700,color:color(val,target),lineHeight:1}}>{val}%</p>
        <p style={{margin:0,fontSize:9,color:DS.textMut}}>{sub}</p>
      </div>
    );
  }

  function StatsBlock({stats, label, sub}) {
    if(!stats||!stats.calls) return (
      <div style={{padding:"16px 0",textAlign:"center"}}>
        <p style={{margin:0,fontSize:12,color:DS.textMut}}>No calls recorded{label?` for ${label}`:""}</p>
      </div>
    );
    return (
      <div>
        <p style={{margin:"0 0 8px",fontSize:11,color:DS.textSec}}>{stats.calls} calls · {stats.paid} paid · {stats.trial} trial{sub?` · ${sub}`:""}</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <StatTile label="Paid CVR" val={stats.paidCvr} target={PAID_TARGET} sub={`Target ${PAID_TARGET}% · ${stats.paidCvr>=PAID_TARGET?"✓ Met":`${Math.abs(stats.paidCvr-PAID_TARGET).toFixed(1)}% away`}`}/>
          <StatTile label="Total CVR" val={stats.totalCvr} target={TOTAL_TARGET} sub={`Target ${TOTAL_TARGET}% · ${stats.totalCvr>=TOTAL_TARGET?"✓ Met":`${Math.abs(stats.totalCvr-TOTAL_TARGET).toFixed(1)}% away`}`}/>
        </div>
      </div>
    );
  }

  return (
    <div style={{background:DS.bgSurf,borderRadius:DS.radiusSm,padding:"12px 14px",border:`1px solid ${DS.border}`}}>
      <p style={{margin:"0 0 10px",fontSize:10,color:DS.textMut,textTransform:"uppercase",letterSpacing:1.5,fontWeight:600}}>📊 My Performance</p>

      {/* Tab bar */}
      <div style={{display:"flex",gap:4,marginBottom:12,background:DS.bg,borderRadius:DS.radiusSm,padding:3}}>
        {[{k:"week",l:"Weekly"},{k:"day",l:"Previous Shift"},{k:"month",l:"Monthly"}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)} style={{flex:1,padding:"5px 0",borderRadius:6,border:"none",background:tab===t.k?DS.bgCard:"transparent",color:tab===t.k?DS.textPri:DS.textMut,cursor:"pointer",fontSize:11,fontWeight:tab===t.k?600:400,transition:"all .15s"}}>
            {t.l}
          </button>
        ))}
      </div>

      {/* WEEKLY */}
      {tab==="week"&&(
        lastWeek ? (
          <div>
            <p style={{margin:"0 0 8px",fontSize:11,color:DS.textSec,fontWeight:600}}>
              Week ending {new Date(lastWeek.wk+"T12:00:00Z").toLocaleDateString("en-US",{month:"short",day:"numeric"})}
            </p>
            <StatsBlock stats={lastWeek}/>
            {prevWeek&&(
              <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${DS.border}`}}>
                <p style={{margin:"0 0 6px",fontSize:10,color:DS.textMut}}>Previous week · ending {new Date(prevWeek.wk+"T12:00:00Z").toLocaleDateString("en-US",{month:"short",day:"numeric"})}</p>
                <div style={{display:"flex",gap:10}}>
                  {[{l:"Paid CVR",v:prevWeek.paidCvr,t:PAID_TARGET},{l:"Total CVR",v:prevWeek.totalCvr,t:TOTAL_TARGET}].map(m=>(
                    <div key={m.l} style={{flex:1,background:DS.bgSurf,borderRadius:DS.radiusSm,padding:"6px 10px",border:`1px solid ${DS.border}`}}>
                      <p style={{margin:"0 0 2px",fontSize:9,color:DS.textMut}}>{m.l}</p>
                      <p style={{margin:0,fontSize:16,fontWeight:700,color:color(m.v,m.t)}}>{m.v}%</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : <p style={{margin:0,fontSize:12,color:DS.textMut,textAlign:"center",padding:"12px 0"}}>No completed week data yet</p>
      )}

      {/* PREVIOUS SHIFT */}
      {tab==="day"&&(
        prevShiftKey ? (
          <div>
            <p style={{margin:"0 0 8px",fontSize:11,color:DS.textSec,fontWeight:600}}>{prevShiftLabel}</p>
            <StatsBlock stats={prevShiftStats}/>
          </div>
        ) : <p style={{margin:0,fontSize:12,color:DS.textMut,textAlign:"center",padding:"12px 0"}}>No previous shift data found</p>
      )}

      {/* MONTHLY */}
      {tab==="month"&&(
        prevMonths.length ? (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {[...prevMonths].reverse().map((m,i)=>(
              <div key={m.mk}>
                <p style={{margin:"0 0 6px",fontSize:11,color:i===0?DS.textPri:DS.textSec,fontWeight:i===0?600:400}}>{m.label}{i===0?" (current)":""}</p>
                <div style={{display:"flex",gap:8}}>
                  {[{l:"Paid CVR",v:m.paidCvr,t:PAID_TARGET},{l:"Total CVR",v:m.totalCvr,t:TOTAL_TARGET}].map(s=>(
                    <div key={s.l} style={{flex:1,background:bg(s.v,s.t),borderRadius:DS.radiusSm,padding:"8px 10px",border:`1px solid ${border(s.v,s.t)}`}}>
                      <p style={{margin:"0 0 2px",fontSize:9,color:DS.textMut}}>{s.l}</p>
                      <p style={{margin:"0 0 2px",fontSize:18,fontWeight:700,color:color(s.v,s.t),lineHeight:1}}>{s.v}%</p>
                      <p style={{margin:0,fontSize:9,color:DS.textMut}}>{m.calls} calls</p>
                    </div>
                  ))}
                </div>
                {i < prevMonths.length-1&&<div style={{height:1,background:DS.border,marginTop:12}}/>}
              </div>
            ))}
          </div>
        ) : <p style={{margin:0,fontSize:12,color:DS.textMut,textAlign:"center",padding:"12px 0"}}>No monthly data yet</p>
      )}
    </div>
  );
}


function AdHocLunchModal({ onSubmit, onClose }) {
  const [preferredTime, setPreferredTime] = useState("");
  const [note, setNote] = useState("");
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:DS.bgCard,border:`1px solid ${DS.border}`,borderRadius:DS.radiusLg,padding:"24px 20px",width:"100%",maxWidth:340,animation:"popIn .2s ease"}}>
        <p style={{margin:"0 0 2px",fontSize:11,color:DS.accent,fontWeight:600,textTransform:"uppercase",letterSpacing:1.5}}>Ad Hoc Request</p>
        <p style={{margin:"0 0 4px",fontSize:16,fontWeight:700,color:DS.textPri}}>Request Lunch</p>
        <p style={{margin:"0 0 18px",fontSize:12,color:DS.textSec}}>Outside your scheduled window. Suggest a preferred time.</p>
        <div style={{marginBottom:12}}>
          <label style={{fontSize:11,color:DS.textSec,display:"block",marginBottom:6,fontWeight:600}}>Preferred time (your timezone)</label>
          <input type="time" value={preferredTime} onChange={e=>setPreferredTime(e.target.value)} style={{width:"100%",fontSize:14}}/>
          <p style={{margin:"4px 0 0",fontSize:10,color:DS.textMut}}>Optional — manager will convert to their timezone</p>
        </div>
        <div style={{marginBottom:16}}>
          <label style={{fontSize:11,color:DS.textSec,display:"block",marginBottom:6,fontWeight:600}}>Note (optional)</label>
          <input value={note} onChange={e=>setNote(e.target.value)} placeholder="e.g. Running late, still active on calls" style={{width:"100%",fontSize:13}}/>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={onClose} style={{flex:1,padding:"10px",borderRadius:DS.radiusSm,border:`1px solid ${DS.border}`,background:"transparent",color:DS.textSec,cursor:"pointer",fontSize:13,fontWeight:600}}>Cancel</button>
          <button onClick={()=>onSubmit(preferredTime,note)} style={{flex:2,padding:"10px",borderRadius:DS.radiusSm,border:"none",background:DS.accent,color:"#fff",cursor:"pointer",fontSize:13,fontWeight:600}}>Send Request</button>
        </div>
      </div>
    </div>
  );
}


function RepMyBreak({ myRep, myAB, canTakeHealth, canTakeLunch, canTakeAdmin=false, cooldownActive, cooldownLeft, breaksLeft, startBreak, returnFromBreak, requestAdHocLunch, repInfo, breakQueue=[], myQueueEntry, queuePosition=0, isNotified=false, acceptSecsLeft=0, joinQueue, leaveQueue, acceptQueuedBreak, settings={} }) {
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [showAdHocModal, setShowAdHocModal] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const cfg = ST[myRep.status]||ST.available;
  const onBreak = myRep.status==="health"||myRep.status==="lunch"||myRep.status==="admin";
  const totalWaiting = breakQueue.filter(q=>q.status==="waiting").length;
  const isOOO = myRep.status==="pto"||myRep.status==="sick";
  const isOff = myRep.status==="off";

  // Countdown timer for lunch and admin (30 min = 1800s, lunch varies)
  useEffect(()=>{
    if(!onBreak||myRep.status==="health") return; // health has its own timer
    const start = myAB?.started_at ? new Date(myAB.started_at) : new Date(myRep.updated_at||Date.now());
    const tick = ()=>setElapsed(Math.floor((Date.now()-start.getTime())/1000));
    tick();
    const t = setInterval(tick, 1000);
    return ()=>clearInterval(t);
  },[onBreak, myRep.status, myAB?.started_at]);

  const ADMIN_DUR = 30*60; // 30 min in seconds
  const LUNCH_DUR = 60*60; // 60 min default
  const breakDur = myRep.status==="admin" ? ADMIN_DUR : LUNCH_DUR;
  const remaining = Math.max(0, breakDur - elapsed);
  const overtime = elapsed > breakDur;

  return (
    <div>
      {showBreakModal&&(
        <Modal title="Request Break" sub="BREAK REQUEST" onClose={()=>setShowBreakModal(false)}>
          <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
            {[
              {key:"health",icon:"🌿",label:"Health Break",dur:"10 min",avail:canTakeHealth,reason:!canTakeHealth?(cooldownActive?`Cooldown: ${fmtTime(cooldownLeft)}`:(myQueueEntry?"In queue":"Slots full")):null,queueable:!canTakeHealth&&breaksLeft>0&&!cooldownActive&&!myQueueEntry},
              {key:"lunch",icon:"🥗",label:"Lunch Break",dur:"Per schedule",avail:canTakeLunch,reason:!canTakeLunch?"Slots full":null},
              {key:"admin",icon:"🗂️",label:"Admin Time",dur:"30 min",avail:canTakeAdmin,reason:!canTakeAdmin?"Slots full":null},
            ].map(o=>(
              <div key={o.key} onClick={()=>{if(o.avail){startBreak(o.key);setShowBreakModal(false);}else if(o.queueable){joinQueue();setShowBreakModal(false);}}} style={{border:`1px solid ${o.avail?DS.border:DS.border}`,borderRadius:DS.radius,padding:"12px 14px",cursor:o.avail?"pointer":"default",background:o.avail?DS.bgSurf:DS.bg,opacity:o.avail?1:0.5}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:24}}>{o.icon}</span>
                  <div style={{flex:1}}>
                    <p style={{margin:0,fontWeight:600,fontSize:14,color:o.avail?DS.textPri:DS.textMut}}>{o.label}</p>
                    <p style={{margin:0,fontSize:11,color:DS.textSec}}>{o.dur}</p>
                    {o.reason&&<p style={{margin:"2px 0 0",fontSize:11,color:DS.red}}>{o.reason}</p>}
                  </div>
                  {o.avail&&<span style={{fontSize:12,color:DS.accent}}>→</span>}
                  {!o.avail&&o.queueable&&<span style={{fontSize:10,background:DS.accentDim,color:DS.accent,padding:"3px 7px",borderRadius:DS.radiusSm,fontWeight:600}}>Queue</span>}
                  {!o.avail&&!o.queueable&&<span style={{fontSize:10,background:DS.redDim,color:DS.red,padding:"3px 7px",borderRadius:DS.radiusSm,fontWeight:600}}>Full</span>}
                </div>
              </div>
            ))}
          </div>
          <button onClick={()=>{setShowBreakModal(false); setShowAdHocModal(true);}} style={{width:"100%",padding:"10px",borderRadius:DS.radiusSm,border:`1px solid ${DS.border}`,background:"transparent",color:DS.textSec,cursor:"pointer",fontSize:12}}>
            Need lunch outside your schedule? →
          </button>
        </Modal>
      )}
      {showAdHocModal&&<AdHocLunchModal onSubmit={(time,note)=>{requestAdHocLunch(time,note);setShowAdHocModal(false);}} onClose={()=>setShowAdHocModal(false)}/>}

      <p style={{fontSize:10,letterSpacing:1.8,textTransform:"uppercase",color:DS.textMut,margin:"0 0 10px",fontWeight:700}}>My Status</p>
      {/* Today's lunch time banner */}
      <LunchTodayBanner myRep={myRep}/>
      <div style={{background:cfg.bg,border:`2px solid ${cfg.border}`,borderRadius:18,padding:"20px 18px",marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:isOOO||isOff?0:14}}>
          <div style={{width:48,height:48,borderRadius:"50%",background:isOff?"#eee":onBreak?(myRep.status==="health"?"#d6eaf8":"#fdebd0"):"#eafaf1",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:800,color:isOff?"#bbb":onBreak?(myRep.status==="health"?"#1a6291":"#9c5a00"):"#1a5c35"}}>
            {repInfo.avatar||avatar(repInfo.name)}
          </div>
          <div>
            <p style={{margin:0,fontWeight:700,fontSize:16,color:DS.textPri}}>{repInfo.name}</p>
            <div style={{display:"flex",alignItems:"center",gap:5,marginTop:2}}>
              <StatusDot status={myRep.status}/>
              <span style={{fontSize:12,color:cfg.dot,fontWeight:600}}>{cfg.label}</span>
            </div>
          </div>
        </div>
        {myRep.status==="health"&&myAB&&<HealthTimer startedAt={myAB.started_at} bankedSec={myRep.health_time_banked||0}/>}
        {(myRep.status==="lunch"||myRep.status==="admin")&&(
          <div style={{background:overtime?DS.redDim:DS.bgSurf,borderRadius:DS.radiusSm,padding:"10px 14px",marginBottom:12,border:`1px solid ${overtime?DS.red+"40":DS.border}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:12,color:overtime?DS.red:DS.textSec,fontWeight:600}}>
                {myRep.status==="admin"?"🗂️ Admin Time":"🥗 Lunch Break"}
              </span>
              <span style={{fontSize:20,fontWeight:800,color:overtime?DS.red:DS.textPri,fontVariantNumeric:"tabular-nums"}}>
                {overtime?"+":""}{fmtTime(overtime?elapsed-breakDur:remaining)}
              </span>
            </div>
            <div style={{marginTop:6,height:4,borderRadius:2,background:DS.bgHover,overflow:"hidden"}}>
              <div style={{height:"100%",borderRadius:2,background:overtime?DS.red:elapsed/breakDur>0.8?DS.amber:DS.accent,width:`${Math.min(100,(elapsed/breakDur)*100)}%`,transition:"width .5s"}}/>
            </div>
            {overtime&&<p style={{margin:"4px 0 0",fontSize:10,color:DS.red,fontWeight:600}}>⚠️ Over time — please wrap up and return</p>}
          </div>
        )}
        {!isOOO&&!isOff&&(
          <div style={{borderTop:onBreak?`1px solid ${DS.border}`:"none",paddingTop:onBreak?12:0}}>
            <div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap"}}>
              <span style={{fontSize:11,color:DS.textSec}}>🌿 {myRep.health_breaks_today||0}/{HEALTH_PER_DAY} full breaks · banked {fmtDur(myRep.health_time_banked||0)}/10m{cooldownActive?` · Cooldown: ${fmtTime(cooldownLeft)}`:""}</span>
              {cooldownActive&&<span style={{fontSize:11,color:DS.amber,fontWeight:600}}>⏳ Cooldown: {fmtTime(cooldownLeft)}</span>}
            </div>
            {onBreak?(
              <button onClick={returnFromBreak} style={{width:"100%",padding:"13px",borderRadius:12,border:"none",background:overtime?DS.red:DS.green,color:"#fff",cursor:"pointer",fontSize:15,fontWeight:700}}>
                {overtime?"Return Now ⚠️":"I'm back! 👋"}
              </button>
            ):(
              <>
                <button onClick={()=>setShowBreakModal(true)} style={{width:"100%",padding:"13px",borderRadius:12,border:"none",background:"#1a5c35",color:"#fff",cursor:"pointer",fontSize:15,fontWeight:700}}>Request a Break 🌿</button>
                {myQueueEntry?.status==="waiting"&&(
                  <div style={{background:DS.accentDim,border:"1.5px solid #aed6f1",borderRadius:12,padding:"12px 13px",marginTop:10,display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:20}}>🕐</span>
                    <div style={{flex:1}}>
                      <p style={{margin:0,fontWeight:700,fontSize:13,color:DS.accent}}>#{queuePosition} in the queue</p>
                      <p style={{margin:"2px 0 0",fontSize:11,color:DS.textSec}}>{queuePosition===1?"You're up next!":"Waiting for a slot to open"}</p>
                    </div>
                    <button onClick={leaveQueue} style={{padding:"5px 10px",borderRadius:7,border:"1.5px solid #003087",background:DS.bgSurf,cursor:"pointer",fontSize:11,color:DS.accent,fontWeight:600}}>Leave</button>
                  </div>
                )}
                {isNotified&&(
                  <div style={{background:"#1a5c35",borderRadius:12,padding:"12px 13px",marginTop:10}}>
                    <p style={{margin:"0 0 4px",fontSize:13,fontWeight:700,color:"#fff"}}>🌿 Your break is ready!</p>
                    <p style={{margin:"0 0 10px",fontSize:11,color:"rgba(255,255,255,.7)"}}>Accept within {fmtTime(acceptSecsLeft)} or it passes to the next rep</p>
                    <button onClick={acceptQueuedBreak} style={{width:"100%",padding:"10px",borderRadius:9,border:"none",background:DS.bgCard,color:DS.green,cursor:"pointer",fontSize:13,fontWeight:800}}>Accept Break ✅</button>
                  </div>
                )}
                {breakQueue.filter(q=>q.status==="waiting").length>0&&!myQueueEntry&&(
                  <p style={{margin:"8px 0 0",fontSize:11,color:DS.textMut,textAlign:"center"}}>{breakQueue.filter(q=>q.status==="waiting").length} rep{breakQueue.filter(q=>q.status==="waiting").length>1?"s are":" is"} in the health break queue</p>
                )}
              </>
            )}
          </div>
        )}
        {isOOO&&<p style={{margin:"12px 0 0",fontSize:13,color:DS.textSec,textAlign:"center"}}>You're marked as out today. See your manager to update.</p>}
        {isOff&&<p style={{margin:"12px 0 0",fontSize:13,color:DS.textMut,textAlign:"center"}}>Today is your scheduled day off. Enjoy! 🎉</p>}
      </div>
    </div>
  );
}

function RepTeam({ reps, myId, activeBreaks }) {
  const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const todayDay = DAYS[new Date().getDay()];

  const onShiftToday = reps.filter(r=>{
    const shiftDays = r.shift_days||[];
    if(shiftDays.length===0) return !["off","pto","sick"].includes(r.status);
    return shiftDays.includes(todayDay);
  });
  const notInToday = reps.filter(r=>{
    const shiftDays = r.shift_days||[];
    if(shiftDays.length===0) return false;
    return !shiftDays.includes(todayDay);
  });

  const TZ_OFFSET = {Central:0, Eastern:1, Pacific:-2, SA:-7};
  function toCtMins(timeStr, tz) {
    if(!timeStr) return null;
    const [h,m] = timeStr.split(":").map(Number);
    return ((h*60+m) + (TZ_OFFSET[tz]||0)*60 + 1440) % 1440;
  }
  function fmtMins(mins) {
    if(mins===null||mins===undefined) return "";
    const norm = ((mins%1440)+1440)%1440;
    const h = Math.floor(norm/60), m = norm%60;
    return `${h%12||12}${m?`:${String(m).padStart(2,"0")}`:""}${h>=12?"pm":"am"}`;
  }

  const RepCard = ({rep}) => {
    const cfg=ST[rep.status]||ST.available;
    const ab=activeBreaks.find(b=>b.rep_id===rep.id&&rep.status==="health");
    const cooldownActive=!!(rep.health_time_banked>=HEALTH_MAX_SEC&&rep.last_break_returned_at&&elapsedSec(rep.last_break_returned_at)<COOLDOWN_SEC);
    const cooldownLeft=cooldownActive?COOLDOWN_SEC-elapsedSec(rep.last_break_returned_at||new Date().toISOString()):0;
    const isMe=rep.id===myId;
    const sched = rep.lunch_schedule?.[todayDay];
    const startCT = toCtMins(sched?.start, rep.timezone||"Central");
    const endCT   = toCtMins(sched?.end,   rep.timezone||"Central");
    const shiftStr = startCT!==null&&endCT!==null ? `${fmtMins(startCT)}–${fmtMins(endCT)} CT` : "";
    return (
      <div style={{background:cfg.bg,border:`1.5px solid ${cfg.border}`,borderRadius:12,padding:"10px 13px"}}>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <div style={{width:32,height:32,borderRadius:"50%",background:isMe?"#1a5c35":"#eafaf1",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:isMe?"#fff":"#1a5c35",flexShrink:0}}>{rep.avatar||avatar(rep.name)}</div>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:5}}>
              <span style={{fontWeight:600,fontSize:13,color:DS.textPri}}>{rep.name}{isMe?" (you)":""}</span>
              <StatusDot status={rep.status}/>
              <span style={{fontSize:11,color:cfg.dot}}>{cfg.label}</span>
            </div>
            <div style={{display:"flex",gap:10,marginTop:3,flexWrap:"wrap"}}>
              {shiftStr&&<span style={{fontSize:10,color:DS.textSec}}>🕐 {shiftStr}</span>}
              <span style={{fontSize:10,color:DS.textSec}}>🌿 {rep.health_breaks_today||0}/{HEALTH_PER_DAY} breaks</span>
              {cooldownActive&&<span style={{fontSize:10,color:"#e07b00",fontWeight:600}}>⏳ {fmtTime(cooldownLeft)}</span>}
              {(rep.health_time_banked||0)>0&&!cooldownActive&&<span style={{fontSize:10,color:DS.textMut}}>Banked: {fmtDur(rep.health_time_banked)}</span>}
            </div>
            {rep.status==="health"&&ab&&<HealthTimer startedAt={ab.started_at} bankedSec={rep.health_time_banked||0}/>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <p style={{fontSize:10,letterSpacing:1.8,textTransform:"uppercase",color:DS.textMut,margin:"0 0 10px",fontWeight:700}}>
        On Shift Today — {todayDay} ({onShiftToday.length})
      </p>
      <div style={{display:"flex",flexDirection:"column",gap:7,marginBottom:16}}>
        {onShiftToday.map(rep=><RepCard key={rep.id} rep={rep}/>)}
        {onShiftToday.length===0&&<p style={{fontSize:12,color:DS.textMut,textAlign:"center",padding:"8px 0"}}>No one scheduled today</p>}
      </div>

      {notInToday.length>0&&(
        <>
          <p style={{fontSize:10,letterSpacing:1.8,textTransform:"uppercase",color:DS.textMut,margin:"0 0 8px",fontWeight:700}}>
            Not In Today ({notInToday.length})
          </p>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {notInToday.map(r=>(
              <span key={r.id} style={{fontSize:11,color:DS.textMut,background:DS.bgSurf,border:`1px solid ${DS.border}`,padding:"4px 10px",borderRadius:DS.radiusSm}}>
                {r.name}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function RepSwaps({ myRep, reps, swaps, reload, fire, repInfo }) {
  const [reqModal, setReqModal] = useState(false);
  const [targetId, setTargetId] = useState("");
  const [myDate, setMyDate] = useState("");
  const [theirDate, setTheirDate] = useState("");

  const myIncoming = swaps.filter(s=>s.target_id===repInfo.id&&s.status==="pending");
  const myOutgoing = swaps.filter(s=>s.requester_id===repInfo.id&&s.status==="pending");

  const myTodayLunch = () => { const d=(repInfo.lunch_schedule||{})[DAYS[new Date().getDay()]]; return d?.time?fmt12h(d.time)+(d.duration===30?" (30m)":" (1hr)")+" "+repInfo.timezone:"Not set"; };
  const theirTodayLunch = (rep) => { const d=(rep.lunch_schedule||{})[DAYS[new Date().getDay()]]; if(!d?.time) return "Not set"; const converted=convertLunchTime(d.time, rep.timezone||"Central", repInfo.timezone||"Central"); const sameZone=(rep.timezone||"Central")===(repInfo.timezone||"Central"); return fmt12h(converted)+(d.duration===30?" (30m)":" (1hr)")+(sameZone?"":" "+repInfo.timezone); };
  const submitSwap = async () => {
    const target = reps.find(r=>r.id===parseInt(targetId));
    if(!target){fire("declined","Select a rep to swap with");return;}
    const myLunch = myTodayLunch();
    const theirLunch = theirTodayLunch(target);
    await sbPost("lunch_swaps",{requester_id:repInfo.id,requester_name:repInfo.name,target_id:target.id,target_name:target.name,requester_date:myLunch,target_date:theirLunch,status:"pending"});
    fire("info",`Swap request sent to ${target.name}`);
    setReqModal(false); reload();
  };

  const acceptSwap = async (swap) => {
    try {
      await sb(`lunch_swaps?id=eq.${swap.id}`,{method:"PATCH",body:JSON.stringify({status:"accepted"})});
      const repA=reps.find(r=>r.id===swap.requester_id);
      const repB=reps.find(r=>r.id===swap.target_id);
      if(repA&&repB){
        const day=todayDay();
        const schA=JSON.parse(JSON.stringify(repA.lunch_schedule||{}));
        const schB=JSON.parse(JSON.stringify(repB.lunch_schedule||{}));
        const tmpA=schA[day]||null;
        schA[day]=schB[day]||null;
        schB[day]=tmpA;
        await sbPatch("rep_status",repA.id,{lunch_schedule:schA});
        await sbPatch("rep_status",repB.id,{lunch_schedule:schB});
      }
      fire("approved","Lunch swap accepted! Schedules updated for today.");
      reload();
    } catch(e) {
      fire("declined",`Error: ${e.message}`);
    }
  };

  const declineSwap = async (swap) => {
    await sb(`lunch_swaps?id=eq.${swap.id}`,{method:"PATCH",body:JSON.stringify({status:"declined"})});
    fire("info","Swap declined");
    reload();
  };

  return (
    <div>
      {reqModal&&(
        <Modal title="Request Lunch Swap" sub="SWAP REQUEST" onClose={()=>setReqModal(false)} wide>
          <p style={{fontSize:12,color:DS.textSec,margin:"0 0 12px"}}>Your lunch today: <strong style={{color:DS.green}}>{myTodayLunch()}</strong></p>
          <p style={{fontSize:11,color:DS.textMut,margin:"0 0 10px",fontWeight:600,letterSpacing:1,textTransform:"uppercase"}}>Team lunch schedule today</p>
          <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:16}}>
            {reps.filter(r=>r.id!==repInfo.id&&!["off","pto","sick"].includes(r.status)).map(r=>{
              const lunch=theirTodayLunch(r);
              const isSelected=targetId===String(r.id);
              return (
                <div key={r.id} onClick={()=>setTargetId(String(r.id))} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,border:isSelected?"2px solid #8e44ad":"1.5px solid #e8e8e8",background:isSelected?"#f5eefb":"#fff",cursor:"pointer"}}>
                  <div style={{width:30,height:30,borderRadius:"50%",background:DS.greenDim,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:DS.green,flexShrink:0}}>{r.avatar||avatar(r.name)}</div>
                  <div style={{flex:1}}>
                    <span style={{fontWeight:600,fontSize:13,color:DS.textPri}}>{r.name}</span>
                    <span style={{fontSize:11,color:DS.textSec,marginLeft:8}}>{lunch}</span>
                  </div>
                  <span style={{fontSize:11,color:DS.textMut}}>🥗 {theirTodayLunch(r)}</span>
                  {isSelected&&<span style={{color:"#8e44ad",fontSize:16}}>✓</span>}
                </div>
              );
            })}
          </div>
          {targetId&&reps.find(r=>r.id===parseInt(targetId))&&(
            <p style={{fontSize:12,color:"#8e44ad",margin:"0 0 12px",padding:"8px 12px",background:DS.accentDim,borderRadius:8}}>
              You give: <strong>{myTodayLunch()}</strong> · You get: <strong>{theirTodayLunch(reps.find(r=>r.id===parseInt(targetId)))}</strong>
            </p>
          )}
          <div style={{display:"flex",gap:8}}>
            <Btn label="Cancel" onClick={()=>setReqModal(false)} outline color="#888" small/>
            <Btn label="Send Request" onClick={submitSwap} color="#8e44ad"/>
          </div>
        </Modal>
      )}

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <p style={{fontSize:10,letterSpacing:1.8,textTransform:"uppercase",color:DS.textMut,margin:0,fontWeight:700}}>Lunch Swaps</p>
        <button onClick={()=>setReqModal(true)} style={{padding:"6px 12px",borderRadius:8,border:"none",background:"#8e44ad",color:"#fff",cursor:"pointer",fontSize:12,fontWeight:600}}>+ Request Swap</button>
      </div>

      {myIncoming.length===0&&myOutgoing.length===0&&(
        <div style={{textAlign:"center",padding:"32px 0",color:DS.textMut}}>
          <p style={{fontSize:24,margin:"0 0 6px"}}>🔄</p>
          <p style={{fontSize:13,color:DS.textMut}}>No pending swaps</p>
        </div>
      )}

      {myIncoming.length>0&&(
        <div style={{marginBottom:16}}>
          <p style={{fontSize:11,color:"#e07b00",fontWeight:600,margin:"0 0 8px"}}>Incoming requests</p>
          {myIncoming.map(s=>{
            const requester=reps.find(r=>r.id===s.requester_id);
            return (
              <div key={s.id} style={{background:DS.amberDim,border:`1px solid ${DS.amber}40`,borderRadius:12,padding:"12px 13px",marginBottom:8}}>
                <p style={{margin:"0 0 2px",fontWeight:600,fontSize:13}}>{s.requester_name} wants to swap lunches</p>
                <p style={{margin:"0 0 8px",fontSize:11,color:DS.textSec}}>They give: {s.requester_date} · You give: {s.target_date}</p>
                {requester&&<p style={{margin:"0 0 8px",fontSize:11,color:DS.textMut}}>Their lunch today: 🥗 {theirTodayLunch(requester)}</p>}
                <div style={{display:"flex",gap:6}}>
                  <button onClick={()=>declineSwap(s)} style={{flex:1,padding:"7px 0",borderRadius:8,border:"1.5px solid #f5b7b1",background:DS.redDim,cursor:"pointer",fontSize:12,color:DS.red,fontWeight:600}}>Decline</button>
                  <button onClick={()=>acceptSwap(s)} style={{flex:1,padding:"7px 0",borderRadius:8,border:"none",background:"#8e44ad",cursor:"pointer",fontSize:12,color:"#fff",fontWeight:600}}>Accept ✓</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {myOutgoing.length>0&&(
        <div>
          <p style={{fontSize:11,color:DS.textMut,fontWeight:600,margin:"0 0 8px"}}>Sent requests</p>
          {myOutgoing.map(s=>(
            <div key={s.id} style={{background:DS.bgSurf,border:`1px solid ${DS.border}`,borderRadius:12,padding:"11px 13px",marginBottom:8}}>
              <p style={{margin:"0 0 2px",fontWeight:600,fontSize:13}}>→ {s.target_name}</p>
              <p style={{margin:0,fontSize:11,color:DS.textMut}}>Your slot: {s.requester_date} · Their slot: {s.target_date} · Pending</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── APP ROOT ──────────────────────────────────────────────────────────

// ── HUB SUPABASE ─────────────────────────────────────────────────────
async function loadHubData() {
  const today = todayStr();
  const [promos,closures,docs,locations,events,alerts] = await Promise.all([
    sb("hub_promos?active=eq.true&order=created_at").catch(()=>[]),
    sb(`hub_closures?end_date=gte.${today}&order=start_date`).catch(()=>[]),
    sb("hub_docs?order=sort_order,created_at").catch(()=>[]),
    sb("hub_locations?order=sort_order").catch(()=>[]),
    sb("hub_events?order=created_at").catch(()=>[]),
    sb("hub_alerts?active=eq.true&order=sort_order").catch(()=>[]),
  ]);
  return {
    promos: promos.filter(p=>!p.expires_on||p.expires_on>=today),
    closures, docs, alerts,
    locations: locations.length>0?locations:HUB_LOCATIONS_FALLBACK,
    events: events.length>0?events:HUB_EVENTS_FALLBACK,
  };
}

const HUB_LOCATIONS_FALLBACK = [
  {region:"Austin",name:"Anderson Mill",ext:"5001",privates:true,pool:"Chlorine",addr:"13492 N HWY 183 #500, Austin, TX",zip:"78750"},
  {region:"Austin",name:"Cedar Park",ext:"1801",privates:true,pool:"Chlorine",addr:"1310 E Whitestone Blvd #590, Cedar Park, TX",zip:"78613"},
  {region:"DFW 2",name:"Fort Worth",ext:"1201",privates:true,pool:"Chlorine",addr:"6250 Southwest Blvd, Fort Worth, TX",zip:"76109"},
  {region:"Houston",name:"Katy",ext:"2601",privates:false,pool:"Chlorine",addr:"6823 S Fry Rd #200, Katy, TX",zip:"77494"},
  {region:"San Antonio",name:"Stone Oak",ext:"1096",privates:true,pool:"Chlorine",addr:"20210 Stone Oak Pkwy #204, San Antonio, TX",zip:"78258"},
];
const HUB_EVENTS_FALLBACK = [];


const HUB_PARTNERS = [
  {brand:"AQUAfin Swim School",locations:[
    {name:"Fleming Island",current:"10112",queue:"10111",addr:"2276 Village Square Pkwy, Fleming Island, FL"},
    {name:"Mandarin",current:"10115",queue:"10114",addr:"3993 San Jose Park Dr, Jacksonville, FL"},
    {name:"Ponte Vedra (Nocatee)",current:"10117",queue:"10116",addr:"820 Commed Blvd, Orange City, FL"},
    {name:"St. Augustine",current:"10119",queue:"10118",addr:"130 Center Place Way, St. Augustine, FL"},
    {name:"St. Johns Bluff",current:"10121",queue:"10120",addr:"2006 St. Johns Bluff Rd S, Jacksonville, FL"},
  ]},
  {brand:"AQua Wave",locations:[{name:"Lake Forest",current:"10077",queue:"10078",addr:"27025 Burbank, Lake Forest, CA"}]},
  {brand:"Charlotte Swim Academy",locations:[{name:"Charlotte",current:"10107",queue:"10106",addr:"9315-A Monroe Rd, Charlotte, NC"}]},
  {brand:"King's Swim Academy",locations:[
    {name:"San Carlos",current:"2107",queue:"1207",addr:"1119 Industrial Rd, San Carlos, CA"},
    {name:"San Mateo",current:"1607",queue:"1107",addr:"57 E 40th Ave, San Mateo, CA"},
  ]},
  {brand:"Little Flippers",locations:[
    {name:"Natick",current:"2607",queue:"3207",addr:"7 Strathmore Rd, Natick, MA"},
    {name:"Winchester",current:"8007",queue:"2307",addr:"29 East St, Winchester, MA"},
  ]},
  {brand:"Njswim",locations:[
    {name:"Brick",current:"10080",queue:"10079",addr:"1930 Route 88, Brick, NJ"},
    {name:"Florham Park",current:"10094",queue:"10093",addr:"139 Brooklake Rd, Florham Park, NJ"},
    {name:"Lakeside-Roxbury",current:"10082",queue:"10081",addr:"143 Lakeside Blvd, Landing, NJ"},
    {name:"Manasquan",current:"10098",queue:"10097",addr:"1904 Atlantic Ave, Manasquan, NJ"},
    {name:"Sparta",current:"10084",queue:"10083",addr:"350 Sparta Ave, Sparta, NJ"},
    {name:"Turnersville",current:"10086",queue:"10085",addr:"3501 NJ-42, Turnersville, NJ"},
  ]},
  {brand:"SwimKids",locations:[
    {name:"Gainesville",current:"10048",queue:"10047",addr:"13555 Wellington Center Cir, Gainesville, VA"},
    {name:"Leesburg",current:"1407",queue:"7007",addr:"681 Potomac Station Dr, Leesburg, VA"},
    {name:"Woodbridge",current:"10045",queue:"10044",addr:"14531 Potomac Mills Rd, Woodbridge, VA"},
  ]},
  {brand:"Swim To Shore",locations:[{name:"Murrieta",current:"10130",queue:"10129",addr:"25395 Madison Ave, Murrieta, CA"}]},
];

const HUB_TEAM = [
  {name:"Joe Huffman",ext:"1098"},{name:"Andrea Dow-Johnson",ext:"9313"},
  {name:"Gontsi Sambane",ext:"9329"},{name:"Andrea Burtman",ext:"1080"},
  {name:"Leah Lopez",ext:"1088"},{name:"Rebecca Jaffier",ext:"9044"},
  {name:"Jordan DiDonato",ext:"9299"},{name:"Heather Baker",ext:"9307"},
  {name:"Amanda Beydoun",ext:"9308"},{name:"Kelly Perez",ext:"9314"},
  {name:"Marcel Matthee",ext:"9316"},{name:"Deonte Epps",ext:"9320"},
  {name:"Lungile Cewu",ext:"9330"},{name:"Darryl Shipman",ext:"9331"},
  {name:"Rickey Jones",ext:"9337"},{name:"Likhona Nyumbeka",ext:"9340"},
  {name:"Mike Slobin",ext:"9338"},{name:"Shadrack Kondile",ext:"9339"},
  {name:"Pamela Martin",ext:"9346"},
];

// Level assessment decision tree
const LEVEL_TREE = {
  start: { q:"How old is the swimmer?", type:"age" },
  result_bb: { level:"Bathtime Babies", max:"10 pairs (parent+child)", script:"Based on their age, [name] is perfect for our Bathtime Babies program. This is a parent participation class for ages 2–5 months. Max size is 10 child/parent pairs. You'll learn activities to enjoy during bathtime and acclimate your little one to water. You'll see their strength and balance improve in just a few weeks!" },
  result_1a: { level:"Level 1A", max:"6 pairs (parent in water)", script:"[Name] is perfect for Level 1A. This is a parent participation class — you'll be in the water with them. Max size is 6 child/parent pairs. In Level 1A, [name] will learn 5–6 seconds of underwater breath control. We also teach water safety, which is always our top priority." },
  result_1b: { level:"Level 1B", max:"6 pairs (parent in water)", script:"[Name] is perfect for Level 1B. This is a parent participation class — you'll be in the water with them. Max size is 6 child/parent pairs. In Level 1B, [name] will learn 8–10 seconds of underwater breath control. We also teach water safety, which is always our top priority." },
  result_2:  { level:"Level 2", max:"4 swimmers (no parent)", script:"Since [name] has experience, I recommend Level 2. This is NOT a parent participation class — you'll watch from the side or observation room. Max size is 4 students. [Name] will work on independent kicking for 5 feet, backfloating for 10 seconds, independent rollovers, and 8–10 seconds of breath control. We also teach water safety at this level." },
  result_3:  { level:"Level 3", max:"4 swimmers", script:"[Name] is perfect for Level 3. In this class they'll learn to kick 5 feet without a flotation device and hold their breath for 8–10 seconds underwater. Max size is 4 swimmers. We also teach water safety at this level." },
  result_4:  { level:"Level 4", max:"4 swimmers", script:"Since [name] has experience, I recommend Level 4. In this level they'll learn to kick 10 feet through the water and start to learn a rollover breath. Max size is 4 swimmers. We also teach water safety at this level." },
  result_6:  { level:"Level 6", max:"4 swimmers", script:"[Name] is perfect for Level 6. In this class they'll learn to kick 15 feet with 10 seconds of breath control, backfloat independently, and jump into the water, turn around, and safely climb out. Max size is 4 swimmers. We also teach water safety at this level." },
  result_7:  { level:"Level 7", max:"4 swimmers", script:"[Name] is perfect for Level 7. In this class they'll learn to swim independently, get front and rollover breaths, and kick and glide on their back. Max size is 4 swimmers. We also teach water safety at this level." },
  result_8:  { level:"Level 8", max:"4 swimmers", script:"[Name] is perfect for Level 8. In this level they'll learn freestyle arms with side breathing for 20 feet, the elementary backstroke, and to tread water. Max size is 4 swimmers. We also teach water safety at this level." },
  result_9:  { level:"Level 9", max:"4 swimmers", script:"[Name] is perfect for Level 9. In this level they'll learn freestyle with bilateral breathing on both sides, and backstroke for the full length of the pool. Max size is 4 swimmers." },
  result_10: { level:"Level 10", max:"4 swimmers", script:"[Name] is perfect for Level 10. In this level they'll learn freestyle, backstroke, butterfly kick, and breaststroke kick for the full length of the pool. Max size is 4 swimmers." },
  result_11: { level:"Level 11", max:"4 swimmers", script:"[Name] is perfect for Level 11. In this level they'll learn to swim all four strokes — freestyle, backstroke, butterfly, and breaststroke — for the full length of the pool. Max size is 4 swimmers." },
  result_stp:{ level:"Swim Team Prep", max:"Varies", script:"It sounds like [name] is ready for Swim Team Prep! In this class they'll work on conditioning and legal techniques for all four competitive swimming strokes in a swim team-style environment." },
  result_adult:{level:"Adult Lessons", max:"4 swimmers", script:"[Name/You are] perfect for our Adult level. This class is customized to meet your specific swimming goals! On the first day, your instructor will take a few minutes to discuss current skill level and get an idea of your goals for the class." },
};

function getLevelFromAge(ageMonths, answers) {
  if(ageMonths <= 5)  return "result_bb";
  if(ageMonths <= 16) return "result_1a";
  if(ageMonths <= 23) return "result_1b";
  // 24+ months need qualifying questions
  if(ageMonths >= 144) return "result_adult"; // 12+
  const ageYears = ageMonths / 12;
  if(answers.length === 0) return null; // need questions
  if(ageYears < 3) {
    // 2 years old: can they hold breath 8-10s and kick 5ft?
    return answers[0] === "yes" ? "result_2" : "result_1b";
  }
  if(ageYears < 4) {
    // 3 years old: same question
    return answers[0] === "yes" ? "result_4" : "result_3";
  }
  // 4-11 years: up to 5 questions
  if(answers[0] === "no")  return "result_6";
  if(answers[1] === "no")  return "result_7";
  if(answers[2] === "no")  return "result_8";
  if(answers[3] === "no")  return "result_9";
  if(answers[4] === "no")  return "result_10";
  if(answers[5] === "no")  return "result_11";
  return "result_stp";
}

function getQuestion(ageMonths, step) {
  const ageYears = ageMonths / 12;
  if(ageYears < 3) return { q:"Can they hold their breath underwater for 8–10 seconds AND kick 5 feet without a flotation device?", step:0 };
  if(ageYears < 4) return { q:"Can they hold their breath for 8–10 seconds AND kick 5 feet without a flotation device?", step:0 };
  const qs = [
    "Can they jump in the water, kick for 10 feet, and backfloat independently?",
    "Can they swim freestyle arms independently over 10 feet with an independent breath?",
    "Can they swim freestyle with rhythmic side breathing for 20 feet, elementary backstroke, and tread water independently?",
    "Can they swim freestyle while breathing on both sides AND backstroke for the full pool length (~25 yards)?",
    "Can they swim freestyle, backstroke, butterfly kick, AND breaststroke kick for the full pool length?",
    "Can they swim all four strokes — freestyle, backstroke, butterfly, AND breaststroke — for the full pool length?",
  ];
  return { q: qs[step] || null, step };
}

// ── HUB VIEW ──────────────────────────────────────────────────────────
function HubView({ isManager }) {
  const [hubData,setHubData] = useState({promos:[],closures:[],docs:[],locations:[],events:[]});
  const [loading,setLoading] = useState(true);
  const [q,setQ] = useState("");
  const [tab,setTab] = useState("home");
  const [editModal,setEditModal] = useState(null);
  const [toast,setToast] = useState(null);
  const [hubSettings,setHubSettings] = useState({});
  const fire = (type,msg)=>setToast({type,msg,id:Date.now()});
  const ping = makePinger(hubSettings.notif_prefs||{}, hubSettings.execo_webhook);

  const reload = async()=>{
    try{
      const d=await loadHubData(); setHubData(d);
      const s=await sb("app_settings?id=eq.1").catch(()=>[]);
      if(s?.[0]) setHubSettings(s[0]);
    }
    catch(e){ console.error(e); }
    finally{ setLoading(false); }
  };
  useEffect(()=>{ reload(); },[]);

  const term = q.toLowerCase().trim();
  const {promos,closures,docs,locations,events,alerts=[]} = hubData;

  const matchLoc    = locations.filter(l=>!term||(l.name+l.region+l.ext+l.addr).toLowerCase().includes(term));
  const matchPromo  = promos.filter(p=>!term||(p.title+p.code+p.rules).toLowerCase().includes(term));
  const matchTeam   = HUB_TEAM.filter(t=>!term||(t.name+t.ext).toLowerCase().includes(term));
  const matchDocs   = docs.filter(d=>!term||(d.title+(d.content||"")).toLowerCase().includes(term));
  const matchPartner= HUB_PARTNERS.filter(p=>!term||p.brand.toLowerCase().includes(term)||p.locations.some(l=>(l.name+l.current).toLowerCase().includes(term)));

  const closureMap = closures.reduce((acc,c)=>{ const k=c.location_name.toLowerCase(); if(!acc[k])acc[k]=[]; acc[k].push(c); return acc; },{});
  const getClosures = n => closureMap[n.toLowerCase()]||[];

  // CRUD
  const savePromo=async(f)=>{
    const isNew = !f.id;
    const payload={title:f.title,code:f.code,rules:f.rules,expires_on:f.expires_on||null,proactive:f.proactive,active:true,
      discount_pct:f.discount_pct||0,discount_fixed:f.discount_fixed||0,discount_type:f.discount_type||"pct",
      applies_to:f.applies_to||"continuous",one_class_only:f.one_class_only||false,multi_class_still:f.multi_class_still!==false,
      customer_types:f.customer_types||["lead","lapsed"],month_restriction:f.month_restriction||null,
      requires_mention:f.requires_mention||false,show_scenarios:f.show_scenarios||false,
    };
    if(f.id) await sbPatch("hub_promos",f.id,payload); else await sbPost("hub_promos",payload);
    if(isNew) ping.main("hub_promo",`🎯 *New promo added to the Hub!* "${f.title}"${f.code?` — Code: \`${f.code}\``:""}. Check the Hub for details and talk track.`);
    fire("approved","Promo saved"); setEditModal(null); reload();
  };
  const deletePromo=async(id)=>{ await sbPatch("hub_promos",id,{active:false}); fire("info","Promo removed"); reload(); };
  const saveClosure=async(f)=>{
    const isNew = !f.id;
    if(f.id) await sbPatch("hub_closures",f.id,{location_name:f.location_name,start_date:f.start_date,end_date:f.end_date,reason:f.reason});
    else await sbPost("hub_closures",{location_name:f.location_name,start_date:f.start_date,end_date:f.end_date,reason:f.reason});
    if(isNew) ping.main("hub_closure",`🚫 *School closure logged:* ${f.location_name} — ${f.start_date} to ${f.end_date}. Reason: ${f.reason}. Do not book enrollments for this location during this period.`);
    fire("approved","Closure saved"); setEditModal(null); reload();
  };
  const deleteClosure=async(id)=>{ await sbDel("hub_closures",id); fire("info","Closure removed"); reload(); };
  const saveDoc=async(f)=>{ if(f.id)await sbPatch("hub_docs",f.id,{title:f.title,content:f.content,category:f.category,updated_at:new Date().toISOString()}); else await sbPost("hub_docs",{title:f.title,content:f.content,category:f.category,sort_order:0}); fire("approved","Doc saved"); setEditModal(null); reload(); };
  const deleteDoc=async(id)=>{ await sbDel("hub_docs",id); fire("info","Doc removed"); reload(); };
  const saveLoc=async(f)=>{
    await sbPatch("hub_locations",f.id,{ext:f.ext,privates:f.privates,pool:f.pool,addr:f.addr});
    ping.main("hub_location",`📍 *Location updated in the Hub:* ${f.name} — details have changed. Check the Hub for the latest info.`);
    fire("approved","Location updated"); setEditModal(null); reload();
  };
  const saveEvent=async(f)=>{ if(f.id)await sbPatch("hub_events",f.id,{name:f.name,event_date:f.event_date,note:f.note}); else await sbPost("hub_events",{name:f.name,event_date:f.event_date,note:f.note||""}); fire("approved","Event saved"); setEditModal(null); reload(); };
  const deleteEvent=async(id)=>{ await sbDel("hub_events",id); fire("info","Event removed"); reload(); };
  const saveAlert=async(f)=>{
    const isNew = !f.id;
    if(f.id) await sbPatch("hub_alerts",f.id,{title:f.title,body:f.body,category:f.category,alert_type:f.alert_type});
    else await sbPost("hub_alerts",{title:f.title,body:f.body,category:f.category,alert_type:f.alert_type||"warning",sort_order:0,active:true});
    if(isNew) ping.main("hub_alert",`🔔 *New reminder in the Hub:* "${f.title}" — ${f.body}`);
    fire("approved","Reminder saved"); setEditModal(null); reload();
  };
  const deleteAlert=async(id)=>{ await sbPatch("hub_alerts",id,{active:false}); fire("info","Reminder removed"); reload(); };

  const repTabs = [
    {k:"home",l:"🏠 Home"},
    {k:"locations",l:"📍 Locations"},
    {k:"levels",l:"🏊 Level Tool"},
    {k:"calc",l:"🧮 Calculator"},
    {k:"docs",l:"📄 Docs"},
    {k:"reminders",l:"📋 Reminders"},
  ];
  const mgrOnlyTabs = isManager ? [
    {k:"promos",l:"🎯 Promos"},
    {k:"closures",l:"🚫 Closures"},
    {k:"team",l:"👤 Team"},
    {k:"partners",l:"🤝 Partners"},
    {k:"events",l:"📅 Events"},
    {k:"alerts_mgr",l:"⚠️ Reminders"},
  ] : [];
  const allTabs = [...repTabs,...mgrOnlyTabs];

  if(loading) return <div style={{padding:"40px 0",textAlign:"center",color:DS.textMut,fontSize:13}}>Loading hub…</div>;

  return (
    <div style={{fontFamily:"'Segoe UI',system-ui,sans-serif",minHeight:"100vh",background:DS.bg,paddingBottom:60}}>
      <style>{`@keyframes popIn{from{transform:scale(0.92);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
      {toast&&<Toast key={toast.id} msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}

      {/* Edit Modals */}
      {editModal?.type==="promo"&&<HubPromoModal item={editModal.item} onClose={()=>setEditModal(null)} onSave={savePromo} onDelete={deletePromo}/>}
      {editModal?.type==="closure"&&<HubClosureModal item={editModal.item} locations={locations} onClose={()=>setEditModal(null)} onSave={saveClosure} onDelete={deleteClosure}/>}
      {editModal?.type==="doc"&&<HubDocModal item={editModal.item} onClose={()=>setEditModal(null)} onSave={saveDoc} onDelete={deleteDoc}/>}
      {editModal?.type==="loc"&&<HubLocModal item={editModal.item} onClose={()=>setEditModal(null)} onSave={saveLoc}/>}
      {editModal?.type==="event"&&<HubEventModal item={editModal.item} onClose={()=>setEditModal(null)} onSave={saveEvent} onDelete={deleteEvent}/>}
      {editModal?.type==="alert"&&<HubAlertModal item={editModal.item} onClose={()=>setEditModal(null)} onSave={saveAlert} onDelete={deleteAlert}/>}

      {/* Header */}
      <div style={{background:DS.accent,padding:"14px 18px 0",color:"#fff"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
          <span style={{fontSize:22}}>🏊</span>
          <div style={{flex:1}}>
            <p style={{margin:0,fontSize:11,opacity:.6,letterSpacing:1.5,textTransform:"uppercase"}}>Emler Knowledge Hub</p>
            {isManager&&<span style={{fontSize:9,background:"rgba(255,255,255,.2)",padding:"1px 6px",borderRadius:3,fontWeight:700,letterSpacing:1}}>MANAGER</span>}
          </div>
          {closures.length>0&&<span style={{background:"#e74c3c",color:"#fff",fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:20}}>⚠️ {closures.length} Closure{closures.length>1?"s":""}</span>}
        </div>
        {/* Search */}
        <div style={{position:"relative",marginBottom:12}}>
          <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:15,opacity:.5}}>🔍</span>
          <input value={q} onChange={e=>{setQ(e.target.value);if(e.target.value)setTab("home");}}
            placeholder="Search anything — location, price, promo code…"
            style={{width:"100%",boxSizing:"border-box",padding:"10px 36px",borderRadius:10,border:"none",fontSize:13,outline:"none",background:"rgba(255,255,255,.1)",color:"#fff"}}/>
          {q&&<button onClick={()=>setQ("")} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:16,color:DS.textMut}}>✕</button>}
        </div>
        {/* Tabs */}
        <div style={{display:"flex",gap:0,overflowX:"auto",marginLeft:-18,paddingLeft:18,marginRight:-18}}>
          {allTabs.map(t=>(
            <button key={t.k} onClick={()=>setTab(t.k)} style={{padding:"8px 14px",border:"none",background:"none",cursor:"pointer",fontSize:12,fontWeight:tab===t.k?700:400,color:tab===t.k?"#fff":"rgba(255,255,255,.55)",borderBottom:tab===t.k?"2.5px solid #fff":"2.5px solid transparent",whiteSpace:"nowrap",transition:"all .15s"}}>{t.l}</button>
          ))}
        </div>
      </div>

      <div style={{padding:"14px 20px 0",maxWidth:1200,margin:"0 auto"}}>

        {/* HOME / SEARCH RESULTS */}
        {tab==="home"&&(
          <div>
            {/* Active closures banner */}
            {closures.length>0&&(
              <div style={{background:DS.redDim,border:`1px solid ${DS.red}40`,borderRadius:12,padding:"12px 14px",marginBottom:12}}>
                <p style={{margin:"0 0 8px",fontSize:11,fontWeight:700,color:DS.red,letterSpacing:1,textTransform:"uppercase"}}>🚫 Active Closures</p>
                {closures.map((c,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:i<closures.length-1?6:0}}>
                    <div><p style={{margin:0,fontWeight:600,fontSize:13,color:DS.textPri}}>{c.location_name}</p><p style={{margin:0,fontSize:11,color:DS.red}}>{c.start_date} → {c.end_date} · {c.reason}</p></div>
                  </div>
                ))}
              </div>
            )}

            {/* Search results */}
            {term&&(
              <div>
                {matchLoc.length>0&&(
                  <div style={{marginBottom:14}}>
                    <p style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:DS.accent,margin:"0 0 8px",fontWeight:700}}>📍 Locations</p>
                    {matchLoc.slice(0,3).map((l,i)=><HubLocCard key={i} loc={l} closures={getClosures(l.name)} isManager={isManager} onEdit={()=>setEditModal({type:"loc",item:l})}/>)}
                  </div>
                )}
                {matchPromo.length>0&&(
                  <div style={{marginBottom:14}}>
                    <p style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:DS.red,margin:"0 0 8px",fontWeight:700}}>🎯 Promos</p>
                    {matchPromo.map((p,i)=><HubPromoCard key={i} promo={p} isManager={isManager} onEdit={()=>setEditModal({type:"promo",item:p})}/>)}
                  </div>
                )}
                {matchTeam.length>0&&(
                  <div style={{marginBottom:14}}>
                    <p style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:DS.green,margin:"0 0 8px",fontWeight:700}}>👤 Team</p>
                    {matchTeam.map((t,i)=><HubTeamCard key={i} member={t}/>)}
                  </div>
                )}
                {matchDocs.length>0&&(
                  <div style={{marginBottom:14}}>
                    <p style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:"#8e44ad",margin:"0 0 8px",fontWeight:700}}>📄 Docs</p>
                    {matchDocs.slice(0,3).map((d,i)=><HubDocCard key={i} doc={d} isManager={isManager} onEdit={()=>setEditModal({type:"doc",item:d})}/>)}
                  </div>
                )}
                {matchLoc.length===0&&matchPromo.length===0&&matchTeam.length===0&&matchDocs.length===0&&(
                  <div style={{textAlign:"center",padding:"36px 0",color:DS.textMut}}><p style={{fontSize:28,margin:"0 0 6px"}}>🤔</p><p style={{fontWeight:600,fontSize:14,color:DS.textSec}}>No results for "{q}"</p></div>
                )}
              </div>
            )}

            {/* No search — show dashboard */}
            {!term&&(
              <div>
                {/* Active Promos */}
                {promos.length>0&&(
                  <div style={{marginBottom:16}}>
                    <p style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:DS.amber,margin:"0 0 8px",fontWeight:700}}>🎯 Active Promotions</p>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:10}}>
                      {promos.map((p,i)=><HubPromoCard key={i} promo={p} isManager={isManager} onEdit={()=>setEditModal({type:"promo",item:p})}/>)}
                    </div>
                    {isManager&&<button onClick={()=>setEditModal({type:"promo",item:null})} style={{width:"100%",padding:"9px",borderRadius:10,border:"1.5px dashed #ddd",background:"transparent",cursor:"pointer",fontSize:12,color:DS.textMut,marginTop:6}}>+ Add Promo</button>}
                  </div>
                )}
                {promos.length===0&&(
                  <div style={{background:DS.amberDim,border:`1px solid ${DS.amber}40`,borderRadius:12,padding:"14px",marginBottom:16,textAlign:"center"}}>
                    <p style={{margin:0,fontSize:13,color:DS.amber}}>🎯 No active promotions right now</p>
                    {isManager&&<button onClick={()=>setEditModal({type:"promo",item:null})} style={{marginTop:8,padding:"6px 14px",borderRadius:8,border:"none",background:DS.accent,color:"#fff",cursor:"pointer",fontSize:12,fontWeight:600}}>+ Add Promo</button>}
                  </div>
                )}
                {/* Quick access */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
                  {[
                    {icon:"📍",label:"Find Location & Price",sub:"Search any school",action:()=>setTab("locations"),color:DS.accent,bg:"#e8f0fe"},
                    {icon:"🏊",label:"Level Assessment",sub:"Find the right class",action:()=>setTab("levels"),color:DS.green,bg:"#eafaf1"},
                    {icon:"📄",label:"Documents",sub:"Scripts, SOPs, pricing",action:()=>setTab("docs"),color:"#8e44ad",bg:"#f5eefb"},
                    {icon:"👤",label:"Team Extensions",sub:"Copy any extension",action:()=>setTab("team"),color:"#e07b00",bg:"#fff8ee"},
                  ].map((c,i)=>(
                    <div key={i} onClick={c.action} style={{background:DS.bgCard,borderRadius:12,padding:"14px",border:`1px solid ${c.bg}40`,cursor:"pointer",transition:"all .15s"}}>
                      <span style={{fontSize:22}}>{c.icon}</span>
                      <p style={{margin:"6px 0 2px",fontWeight:600,fontSize:13,color:c.color}}>{c.label}</p>
                      <p style={{margin:0,fontSize:11,color:DS.textMut}}>{c.sub}</p>
                    </div>
                  ))}
                </div>
                {/* Events if any */}
                {events.length>0&&(
                  <div style={{background:DS.bgCard,borderRadius:12,border:`1px solid ${DS.border}`,padding:"12px 14px",marginBottom:16}}>
                    <p style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:"#e07b00",margin:"0 0 8px",fontWeight:700}}>📅 Upcoming</p>
                    {events.map((e,i)=>(
                      <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:i<events.length-1?6:0}}>
                        <p style={{margin:0,fontSize:13,fontWeight:500}}>{e.name}</p>
                        <span style={{fontSize:11,color:DS.textSec}}>{e.event_date}{e.note?` · ${e.note}`:""}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* LOCATIONS */}
        {tab==="locations"&&(
          <div>
            <div style={{position:"sticky",top:0,zIndex:10,paddingBottom:10,paddingTop:4,background:DS.bg}}>
  <div style={{display:"flex",gap:8,marginBottom:8}}>
                <div style={{position:"relative",flex:1}}>
                  <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search by name, region, or extension…"
                    style={{width:"100%",boxSizing:"border-box",padding:"11px 14px",borderRadius:10,border:`1px solid ${DS.border}`,fontSize:13,outline:"none",background:DS.bgCard}}/>
                  {q&&<button onClick={()=>setQ("")} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:16,color:DS.textMut}}>✕</button>}
                </div>
              </div>
              <ZipFinder locations={locations} closures={closureMap} isManager={isManager} onEdit={(l)=>setEditModal({type:"loc",item:l})}/>
            </div>
            {matchLoc.length===0&&term&&(
              <p style={{textAlign:"center",color:DS.textMut,padding:"30px 0",fontSize:13}}>No locations found for "{q}"</p>
            )}
            {matchLoc.length>0&&Object.entries(matchLoc.reduce((acc,l)=>{if(!acc[l.region])acc[l.region]=[];acc[l.region].push(l);return acc;},{})).map(([region,locs])=>(
              <div key={region} style={{marginBottom:16}}>
                <p style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:DS.accent,margin:"0 0 8px",fontWeight:700}}>{region} ({locs.length})</p>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:10}}>
                  {locs.map((l,i)=><HubLocCard key={i} loc={l} closures={getClosures(l.name)} isManager={isManager} onEdit={()=>setEditModal({type:"loc",item:l})}/>)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* LEVEL TOOL */}
        {tab==="levels"&&<LevelTool/>}

        {/* DOCS */}
        {tab==="docs"&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <p style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:"#8e44ad",margin:0,fontWeight:700}}>Documents ({docs.length})</p>
              {isManager&&<button onClick={()=>setEditModal({type:"doc",item:null})} style={{padding:"6px 12px",borderRadius:8,border:"none",background:"#8e44ad",color:"#fff",cursor:"pointer",fontSize:12,fontWeight:600}}>+ Add Doc</button>}
            </div>
            {/* Group by category */}
            {Object.entries(docs.reduce((acc,d)=>{const cat=d.category||"General";if(!acc[cat])acc[cat]=[];acc[cat].push(d);return acc;},{})).map(([cat,catDocs])=>(
              <div key={cat} style={{marginBottom:16}}>
                <p style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:DS.textSec,margin:"0 0 8px",fontWeight:700}}>{cat}</p>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:10}}>
                  {catDocs.map((d,i)=><HubDocCard key={i} doc={d} isManager={isManager} onEdit={()=>setEditModal({type:"doc",item:d})}/>)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* MANAGER TABS */}
        {tab==="promos"&&isManager&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{background:DS.amberDim,border:"1.5px solid #f0c080",borderRadius:9,padding:"8px 12px",flex:1,marginRight:10}}><p style={{margin:0,fontSize:11,color:DS.amber,fontWeight:600}}>⚡ Check expiry dates before applying any promo</p></div>
              <button onClick={()=>setEditModal({type:"promo",item:null})} style={{padding:"8px 14px",borderRadius:8,border:"none",background:DS.accent,color:"#fff",cursor:"pointer",fontSize:12,fontWeight:600,whiteSpace:"nowrap"}}>+ Add Promo</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:10}}>
              {promos.map((p,i)=><HubPromoCard key={i} promo={p} isManager={true} onEdit={()=>setEditModal({type:"promo",item:p})}/>)}
            </div>
          </div>
        )}
        {tab==="closures"&&isManager&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <p style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:DS.red,margin:0,fontWeight:700}}>Active Closures ({closures.length})</p>
              <button onClick={()=>setEditModal({type:"closure",item:null})} style={{padding:"6px 12px",borderRadius:8,border:"none",background:"#c0392b",color:"#fff",cursor:"pointer",fontSize:12,fontWeight:600}}>+ Log Closure</button>
            </div>
            {closures.length===0&&<div style={{textAlign:"center",padding:"30px 0",color:DS.textMut}}><p style={{fontSize:22,margin:"0 0 6px"}}>✅</p><p style={{fontSize:13,color:DS.textMut}}>No active closures</p></div>}
            {closures.map((c,i)=>(
              <div key={i} style={{background:DS.redDim,border:"1.5px solid #f5b7b1",borderRadius:12,padding:"12px 14px",marginBottom:7,display:"flex",alignItems:"flex-start",gap:10}}>
                <span style={{fontSize:18}}>🚫</span>
                <div style={{flex:1}}>
                  <p style={{margin:0,fontWeight:600,fontSize:13,color:DS.textPri}}>{c.location_name}</p>
                  <p style={{margin:"2px 0",fontSize:11,color:DS.red}}>{c.start_date} → {c.end_date}</p>
                  <p style={{margin:0,fontSize:11,color:DS.textSec}}>{c.reason}</p>
                </div>
                <div style={{display:"flex",gap:5}}>
                  <button onClick={()=>setEditModal({type:"closure",item:c})} style={{padding:"4px 8px",borderRadius:6,border:`1px solid ${DS.border}`,background:DS.bgSurf,cursor:"pointer",fontSize:10,color:DS.textSec}}>Edit</button>
                  <button onClick={()=>deleteClosure(c.id)} style={{padding:"4px 8px",borderRadius:6,border:"1.5px solid #f5b7b1",background:DS.redDim,cursor:"pointer",fontSize:10,color:DS.red}}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
        {tab==="team"&&(
          <div>
            <p style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:DS.green,margin:"0 0 10px",fontWeight:700}}>ESC Team Extensions</p>
            {HUB_TEAM.map((t,i)=><HubTeamCard key={i} member={t}/>)}
          </div>
        )}
        {tab==="partners"&&(
          <div>
            {HUB_PARTNERS.map((p,i)=>(
              <div key={i} style={{marginBottom:16}}>
                <p style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:"#8e44ad",margin:"0 0 8px",fontWeight:700}}>{p.brand}</p>
                {p.locations.map((l,j)=><PartnerLocRow key={j} loc={l}/>)}
              </div>
            ))}
          </div>
        )}
        {tab==="events"&&isManager&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <p style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:"#e07b00",margin:0,fontWeight:700}}>Events & Openings</p>
              <button onClick={()=>setEditModal({type:"event",item:null})} style={{padding:"6px 12px",borderRadius:8,border:"none",background:"#e07b00",color:"#fff",cursor:"pointer",fontSize:12,fontWeight:600}}>+ Add Event</button>
            </div>
            {events.map((e,i)=>(
              <div key={i} style={{background:DS.bgCard,borderRadius:12,border:`1px solid ${DS.border}`,padding:"11px 14px",marginBottom:7,display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:20}}>🏊</span>
                <div style={{flex:1}}><p style={{margin:0,fontWeight:600,fontSize:13}}>{e.name}</p><p style={{margin:"2px 0 0",fontSize:11,color:DS.textSec}}>{e.event_date}{e.note?` · ${e.note}`:""}</p></div>
                <button onClick={()=>setEditModal({type:"event",item:e})} style={{padding:"4px 8px",borderRadius:6,border:`1px solid ${DS.border}`,background:DS.bgSurf,cursor:"pointer",fontSize:10,color:DS.textSec}}>Edit</button>
              </div>
            ))}
          </div>
        )}

        {/* CALCULATOR */}
        {tab==="calc"&&<QuoteCalculator locations={locations} activePromos={promos}/>}

        {/* REMINDERS — rep view */}
        {tab==="reminders"&&(
          <RemindersTab alerts={alerts} isManager={false}/>
        )}

        {/* REMINDERS — manager edit */}
        {tab==="alerts_mgr"&&isManager&&(
          <RemindersTab alerts={alerts} isManager={true} onAdd={()=>setEditModal({type:"alert",item:null})} onEdit={(a)=>setEditModal({type:"alert",item:a})}/>
        )}
      </div>
    </div>
  );
}

// ── LEVEL TOOL ────────────────────────────────────────────────────────
// Decision tree nodes — each node is either a question or a result
const LEVEL_NODES = {
  // Entry point
  start: { type:"age" },

  // Age-based direct results (no questions needed)
  bathtime: { type:"result", level:"Bathtime Babies", max:"10 child/parent pairs", parentIn:true,
    script:"Based on their age, [name] is perfect for our Bathtime Babies program. This is a parent participation class for ages 2 to 5 months. The maximum size is 10 child/parent pairs. In this class you'll learn different activities to enjoy during bathtime and acclimate your little one to water. You'll see their strength and balance improve remarkably in just a few weeks!" },
  l1a: { type:"result", level:"Level 1A", max:"6 child/parent pairs", parentIn:true,
    script:"[Name] is perfect for our Level 1A class. This is a parent participation class — you'll be in the water with them. The maximum size is 6 child/parent pairs. In Level 1A, [name] will learn 5 to 6 seconds of underwater breath control. We also teach water safety at this level since that's always our top priority." },
  l1b: { type:"result", level:"Level 1B", max:"6 child/parent pairs", parentIn:true,
    script:"[Name] is perfect for our Level 1B class. This is a parent participation class — you'll be in the water with them. The maximum size is 6 child/parent pairs. In Level 1B, [name] will learn 8 to 10 seconds of underwater breath control. We also teach water safety at this level since that's always our top priority." },
  l2:  { type:"result", level:"Level 2", max:"4 swimmers", parentIn:false,
    script:"Since [name] has swimming experience, I recommend Level 2. This is NOT a parent participation class — you'll be watching from the side or the observation room. The maximum size is 4 students. [Name] will work on independent kicking for 5 feet, backfloating for 10 seconds, independent rollovers, and maintaining 8 to 10 seconds of breath control. We also teach water safety at this level." },
  l3:  { type:"result", level:"Level 3", max:"4 swimmers", parentIn:false,
    script:"[Name] is perfect for our Level 3 class. In this class they'll learn to kick 5 feet through the water without a flotation device and hold their breath for 8 to 10 seconds underwater. Maximum of 4 swimmers per class. We also teach water safety at this level." },
  l4:  { type:"result", level:"Level 4", max:"4 swimmers", parentIn:false,
    script:"Since [name] has swimming experience, I recommend Level 4. In this level they'll learn to kick 10 feet through the water and start to learn a rollover breath. Maximum of 4 swimmers per class. We also teach water safety at this level." },
  l6:  { type:"result", level:"Level 6", max:"4 swimmers", parentIn:false,
    script:"[Name] is perfect for our Level 6 class. In this class they'll learn to kick 15 feet with 10 seconds of breath control, backfloat independently, and jump into the water, turn around to the wall, and safely climb out. Maximum of 4 swimmers per class. We also teach water safety at this level." },
  l7:  { type:"result", level:"Level 7", max:"4 swimmers", parentIn:false,
    script:"[Name] is perfect for our Level 7 class. In this class they'll learn to swim independently, get front and rollover breaths, and kick and glide on their back. Maximum of 4 swimmers per class. We also teach water safety at this level." },
  l8:  { type:"result", level:"Level 8", max:"4 swimmers", parentIn:false,
    script:"[Name] is perfect for our Level 8 class. In this level they'll learn to swim freestyle with side breathing for 20 feet, the elementary backstroke, and to tread water. Maximum of 4 swimmers per class. We also teach water safety at this level." },
  l9:  { type:"result", level:"Level 9", max:"4 swimmers", parentIn:false,
    script:"[Name] is perfect for our Level 9 class. In this level they'll learn freestyle with bilateral breathing on both sides, and backstroke for the full length of the pool. Maximum of 4 swimmers per class." },
  l10: { type:"result", level:"Level 10", max:"4 swimmers", parentIn:false,
    script:"[Name] is perfect for our Level 10 class. In this level they'll learn freestyle, backstroke, butterfly kick, and breaststroke kick for the full length of the pool. Maximum of 4 swimmers per class." },
  l11: { type:"result", level:"Level 11", max:"4 swimmers", parentIn:false,
    script:"[Name] is perfect for our Level 11 class. In this level they'll learn all four strokes — freestyle, backstroke, butterfly, and breaststroke — for the full length of the pool. Maximum of 4 swimmers per class." },
  stp: { type:"result", level:"Swim Team Prep", max:"Varies", parentIn:false,
    script:"It sounds like [name] is ready for Swim Team Prep! In this class they'll work on conditioning and legal techniques for all four competitive swimming strokes in a swim team-style environment." },
  adult:{ type:"result", level:"Adult Lessons", max:"4 swimmers", parentIn:false,
    script:"[Name is / You are] perfect for our Adult level. This class is customized to meet your specific swimming goals! On the first day your instructor will take a few minutes to discuss current skill level and get an idea of goals for the class." },

  // Questions
  q_2yr: { type:"question", qNum:1, qTotal:1,
    ask:"Can [name] hold their breath underwater for 8 to 10 seconds AND kick 5 feet without a flotation device?",
    yes:"l2", no:"l1b" },
  q_3yr: { type:"question", qNum:1, qTotal:1,
    ask:"Can [name] hold their breath underwater for 8 to 10 seconds AND kick 5 feet without a flotation device?",
    yes:"l4", no:"l3" },
  q_411_1: { type:"question", qNum:1, qTotal:6,
    ask:"Can [name] jump in the water, kick for 10 feet, and backfloat independently?",
    yes:"q_411_2", no:"l6" },
  q_411_2: { type:"question", qNum:2, qTotal:6,
    ask:"Can [name] swim with freestyle arms independently over 10 feet with an independent breath?",
    yes:"q_411_3", no:"l7" },
  q_411_3: { type:"question", qNum:3, qTotal:6,
    ask:"Can [name] swim freestyle with rhythmic side breathing for 20 feet, swim elementary backstroke, AND tread water independently?",
    yes:"q_411_4", no:"l8" },
  q_411_4: { type:"question", qNum:4, qTotal:6,
    ask:"Can [name] swim freestyle while breathing on both sides AND swim backstroke for the full length of the pool (about 25 yards)?",
    yes:"q_411_5", no:"l9" },
  q_411_5: { type:"question", qNum:5, qTotal:6,
    ask:"Can [name] swim freestyle, backstroke, butterfly kick, AND breaststroke kick for the full length of the pool?",
    yes:"q_411_6", no:"l10" },
  q_411_6: { type:"question", qNum:6, qTotal:6,
    ask:"Can [name] swim all four full strokes — freestyle, backstroke, butterfly, AND breaststroke — for the full length of the pool?",
    yes:"stp", no:"l11" },
};

const AGE_BUCKETS = [
  { label:"2–5 months",   node:"bathtime" },
  { label:"6–16 months",  node:"l1a" },
  { label:"17–23 months", node:"l1b" },
  { label:"2 years old",  node:"q_2yr" },
  { label:"3 years old",  node:"q_3yr" },
  { label:"4–11 years",   node:"q_411_1" },
  { label:"12+ years",    node:"adult" },
];

function LevelTool() {
  const [nodeKey, setNodeKey] = useState(null);
  const [history, setHistory]  = useState([]);
  const [copied, setCopied]    = useState(false);

  const node = nodeKey ? LEVEL_NODES[nodeKey] : null;
  const isResult   = node?.type === "result";
  const isQuestion = node?.type === "question";

  const goTo = (key) => {
    setHistory(h => [...h, nodeKey]);
    setNodeKey(key);
    setCopied(false);
  };

  const goBack = () => {
    const prev = [...history];
    const last = prev.pop();
    setHistory(prev);
    setNodeKey(last || null);
    setCopied(false);
  };

  const reset = () => { setNodeKey(null); setHistory([]); setCopied(false); };

  const copyScript = () => {
    if(node?.script) { navigator.clipboard?.writeText(node.script); setCopied(true); setTimeout(()=>setCopied(false),2000); }
  };

  return (
    <div>
      {/* Tool card */}
      <div style={{background:DS.bgCard,borderRadius:14,border:`1px solid ${DS.border}`,overflow:"hidden",marginBottom:12}}>
        {/* Header */}
        <div style={{background:"#1a5c35",padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <p style={{margin:0,fontSize:10,color:"rgba(255,255,255,.6)",letterSpacing:1.5,textTransform:"uppercase"}}>Level Assessment</p>
            <p style={{margin:"2px 0 0",fontSize:15,fontWeight:700,color:"#fff"}}>🏊 Find the Right Class</p>
          </div>
          {nodeKey&&<button onClick={reset} style={{padding:"5px 12px",borderRadius:8,border:"1.5px solid rgba(255,255,255,.3)",background:"transparent",cursor:"pointer",fontSize:11,color:"rgba(255,255,255,.8)",fontWeight:600}}>Start Over</button>}
        </div>

        <div style={{padding:"16px"}}>

          {/* STEP 1 — Age selection */}
          {!nodeKey&&(
            <div>
              <p style={{margin:"0 0 12px",fontSize:14,color:DS.textSec,fontWeight:500}}>Step 1 — Select swimmer's age:</p>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {AGE_BUCKETS.map((b,i)=>(
                  <button key={i} onClick={()=>goTo(b.node)}
                    style={{padding:"13px 16px",borderRadius:10,border:`1px solid ${DS.green}40`,background:DS.greenDim,cursor:"pointer",fontSize:14,fontWeight:600,color:DS.green,textAlign:"left",display:"flex",alignItems:"center",justifyContent:"space-between",transition:"all .15s"}}>
                    {b.label}
                    <span style={{fontSize:16,opacity:.5}}>→</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2 — Question */}
          {isQuestion&&(
            <div>
              {/* Progress */}
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
                <div style={{flex:1,height:4,background:DS.bgSurf,borderRadius:4,overflow:"hidden"}}>
                  <div style={{width:`${(node.qNum/node.qTotal)*100}%`,height:"100%",background:"#1a5c35",transition:"width .3s"}}/>
                </div>
                <span style={{fontSize:11,color:DS.textMut,whiteSpace:"nowrap"}}>Q{node.qNum} of {node.qTotal}</span>
              </div>

              {/* Question */}
              <div style={{background:DS.greenDim,borderRadius:10,border:`1px solid ${DS.green}40`,padding:"14px 16px",marginBottom:16}}>
                <p style={{margin:"0 0 4px",fontSize:10,color:DS.green,fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>Ask the parent:</p>
                <p style={{margin:0,fontSize:14,fontWeight:600,color:DS.textPri,lineHeight:1.6}}>{node.ask}</p>
              </div>

              {/* YES / NO */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                <button onClick={()=>goTo(node.yes)}
                  style={{padding:"18px 12px",borderRadius:12,border:"2px solid #1a5c35",background:DS.greenDim,cursor:"pointer",fontSize:16,fontWeight:800,color:DS.green,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                  ✅ YES
                </button>
                <button onClick={()=>goTo(node.no)}
                  style={{padding:"18px 12px",borderRadius:12,border:"2px solid #c0392b",background:DS.redDim,cursor:"pointer",fontSize:16,fontWeight:800,color:DS.red,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                  ❌ NO
                </button>
              </div>

              {history.length>0&&<button onClick={goBack} style={{background:"none",border:"none",cursor:"pointer",fontSize:12,color:DS.textMut,padding:0}}>← Back</button>}
            </div>
          )}

          {/* RESULT */}
          {isResult&&(
            <div>
              {/* Level badge */}
              <div style={{background:`linear-gradient(135deg,${DS.green},${DS.accent})`,borderRadius:12,padding:"16px",marginBottom:14,textAlign:"center"}}>
                <p style={{margin:"0 0 2px",fontSize:10,color:"rgba(255,255,255,.7)",letterSpacing:1.5,textTransform:"uppercase"}}>Recommended Level</p>
                <p style={{margin:"0 0 6px",fontSize:26,fontWeight:800,color:"#fff"}}>{node.level}</p>
                <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
                  <span style={{fontSize:11,background:"rgba(255,255,255,.2)",color:"#fff",padding:"3px 10px",borderRadius:20}}>Max: {node.max}</span>
                  <span style={{fontSize:11,background:"rgba(255,255,255,.2)",color:"#fff",padding:"3px 10px",borderRadius:20}}>{node.parentIn?"👨‍👩‍👦 Parent in water":"🏊 No parent required"}</span>
                </div>
              </div>

              {/* Script */}
              <div style={{background:DS.greenDim,borderRadius:10,border:`1px solid ${DS.green}40`,padding:"12px 14px",marginBottom:12}}>
                <p style={{margin:"0 0 6px",fontSize:10,fontWeight:700,color:DS.green,letterSpacing:.5,textTransform:"uppercase"}}>📢 Say this to the parent:</p>
                <p style={{margin:0,fontSize:13,color:"#2c3e50",lineHeight:1.7,fontStyle:"italic"}}>"{node.script}"</p>
              </div>

              <div style={{display:"flex",gap:8}}>
                <button onClick={copyScript}
                  style={{flex:1,padding:"12px",borderRadius:10,border:"none",background:copied?DS.green:DS.accent,color:"#fff",cursor:"pointer",fontSize:13,fontWeight:700,transition:"background .2s"}}>
                  {copied?"✓ Script Copied to Clipboard!":"📋 Copy Script"}
                </button>
                {history.length>0&&<button onClick={goBack} style={{padding:"12px 14px",borderRadius:10,border:`1px solid ${DS.border}`,background:DS.bgSurf,cursor:"pointer",fontSize:12,color:DS.textSec}}>← Back</button>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick reference table */}
      <div style={{background:DS.bgCard,borderRadius:12,border:`1px solid ${DS.border}`,padding:"12px 14px"}}>
        <p style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:DS.textSec,margin:"0 0 10px",fontWeight:700}}>Quick Reference</p>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
            <thead>
              <tr style={{background:DS.greenDim}}>
                {["Level","Age","Key skills","Max"].map(h=>(
                  <th key={h} style={{padding:"6px 8px",textAlign:"left",fontWeight:600,color:DS.green,borderBottom:"1.5px solid #d4eadc"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["Bathtime Babies","2–5 mo","Bathtime acclimation","10 pairs"],
                ["Level 1A","6–16 mo","5–6s breath control","6 pairs"],
                ["Level 1B","17–23 mo","8–10s breath control","6 pairs"],
                ["Level 2","2 yrs + exp","Kick 5ft, backfloat","4"],
                ["Level 3","3 yrs, no exp","Kick 5ft, 8–10s breath","4"],
                ["Level 4","3 yrs + exp","Kick 10ft, rollover","4"],
                ["Level 6","4–11, no exp","Kick 15ft, backfloat, jump","4"],
                ["Level 7","4–11","Freestyle arms + breath","4"],
                ["Level 8","4–11","Side breathing 20ft, backstroke","4"],
                ["Level 9","4–11","Bilateral breathing, backstroke","4"],
                ["Level 10","4–11","All 4 stroke kicks","4"],
                ["Level 11","4–11","All 4 full strokes","4"],
                ["Swim Team Prep","6+, post-L11","Competitive conditioning","Varies"],
                ["Adult","12+","Customized to goals","4"],
              ].map(([l,a,s,m],i)=>(
                <tr key={i} style={{borderBottom:`1px solid ${DS.border}`,background:i%2===0?DS.bgCard:DS.bgSurf}}>
                  <td style={{padding:"6px 8px",fontWeight:600,color:DS.green}}>{l}</td>
                  <td style={{padding:"6px 8px",color:DS.textSec}}>{a}</td>
                  <td style={{padding:"6px 8px",color:DS.textSec}}>{s}</td>
                  <td style={{padding:"6px 8px",fontWeight:600,color:DS.textPri}}>{m}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


// ── ZIP FINDER ────────────────────────────────────────────────────────
function ZipFinder({ locations, closures, isManager, onEdit }) {
  const [zip, setZip] = useState("");
  const [results, setResults] = useState(null);

  const search = (val) => {
    setZip(val);
    if(val.length < 3) { setResults(null); return; }
    const matches = locations.filter(l => l.zip && l.zip.startsWith(val));
    if(matches.length > 0) { setResults(matches); return; }
    if(val.length >= 5) {
      const nearby = locations.filter(l => l.zip && l.zip.slice(0,3) === val.slice(0,3));
      setResults(nearby);
    } else {
      setResults([]);
    }
  };

  const getClosures = n => (closures[n.toLowerCase()])||[];

  return (
    <div style={{background:DS.bgCard,borderRadius:10,border:`1px solid ${DS.border}`,padding:"12px 14px",marginBottom:8}}>
      <p style={{margin:"0 0 8px",fontSize:11,fontWeight:700,color:DS.accent,letterSpacing:.5}}>🔍 Find by Zip Code</p>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <input
          value={zip}
          onChange={e=>search(e.target.value.replace(/[^0-9]/g,"").slice(0,5))}
          placeholder="Enter zip code…"
          maxLength={5}
          style={{flex:1,padding:"9px 12px",borderRadius:9,border:`1px solid ${DS.border}`,fontSize:14,outline:"none",letterSpacing:2,fontWeight:600}}
        />
        {zip&&<button onClick={()=>{setZip("");setResults(null);}} style={{padding:"9px 12px",borderRadius:9,border:`1px solid ${DS.border}`,background:DS.bgSurf,cursor:"pointer",fontSize:12,color:DS.textSec}}>Clear</button>}
      </div>
      {zip.length>=3&&results!==null&&(
        <div style={{marginTop:10}}>
          {results.length===0&&(
            <div style={{textAlign:"center",padding:"12px 0",color:DS.textMut}}>
              <p style={{margin:0,fontSize:13}}>No schools found near {zip}</p>
              <p style={{margin:"4px 0 0",fontSize:11}}>Try a nearby zip or search by name above</p>
            </div>
          )}
          {results.length>0&&(
            <div>
              <p style={{margin:"0 0 8px",fontSize:11,color:DS.green,fontWeight:600}}>{results.length} school{results.length>1?"s":""} found near {zip}</p>
              {results.map((l,i)=><HubLocCard key={i} loc={l} closures={getClosures(l.name)} isManager={isManager} onEdit={()=>onEdit(l)}/>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── HUB CARDS ─────────────────────────────────────────────────────────
function HubLocCard({loc,closures,isManager,onEdit}) {
  const [copiedExt,setCopiedExt]=useState(false);
  const [copiedPhone,setCopiedPhone]=useState(false);
  const [expanded,setExpanded]=useState(false);
  const pricing = (loc.price_mf||loc.price_ss) ? {mf:loc.price_mf,ss:loc.price_ss,priv:loc.price_priv,semi:loc.price_semi,odl:loc.price_odl,priv20:loc.price_priv20} : null;
  const hasClosure=closures&&closures.length>0;
  const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const hours = loc.hours || {};
  const instructors = loc.instructors || [];
  const snInstructors = instructors.filter(i=>i.sn==='Y');
  const langInstructors = instructors.filter(i=>i.lang&&i.lang.toLowerCase()!=='english'&&i.lang.toLowerCase()!=='english ');
  return (
    <div style={{background:DS.bgCard,borderRadius:12,border:`1px solid ${hasClosure?DS.red+"40":DS.border}`,marginBottom:8,overflow:"hidden"}}>
      <div style={{padding:"12px 14px"}}>
        {hasClosure&&closures.map((c,i)=>(
          <div key={i} style={{background:DS.redDim,borderRadius:7,padding:"5px 9px",marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:12}}>🚫</span>
            <p style={{margin:0,fontSize:11,color:DS.red,fontWeight:600}}>{c.start_date} to {c.end_date} · {c.reason}</p>
          </div>
        ))}
        <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:4}}>
              <span style={{fontWeight:700,fontSize:15,color:DS.textPri}}>{loc.name}</span>
              <span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:DS.accentDim,color:DS.accent,fontWeight:700}}>{loc.region}</span>
              <span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:loc.pool==="Salt"?DS.amberDim:DS.accentDim,color:loc.pool==="Salt"?DS.amber:DS.accent,fontWeight:700}}>{loc.pool}</span>
              {loc.privates&&<span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:DS.greenDim,color:DS.green,fontWeight:700}}>20min Privates</span>}
            </div>
            <p style={{margin:"0 0 4px",fontSize:11,color:DS.textMut}}>📍 {loc.addr}</p>
            {loc.direct_phone&&<p style={{margin:"0 0 4px",fontSize:12,color:DS.textPri,fontWeight:500}}>📞 {loc.direct_phone}</p>}
            {loc.gm_name&&<p style={{margin:"0 0 6px",fontSize:11,color:DS.textSec}}>👤 GM: {loc.gm_name}</p>}
            {pricing&&(
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:4}}>
                <span style={{fontSize:11,background:DS.accentDim,color:DS.accent,padding:"2px 8px",borderRadius:6,fontWeight:600}}>M–F ${pricing.mf}</span>
                <span style={{fontSize:11,background:DS.bg,color:DS.textSec,padding:"2px 8px",borderRadius:6}}>Sa–Su ${pricing.ss}</span>
                <span style={{fontSize:11,background:DS.accentDim,color:"#8e44ad",padding:"2px 8px",borderRadius:6}}>Private ${pricing.priv}</span>
                <span style={{fontSize:11,background:DS.amberDim,color:DS.amber,padding:"2px 8px",borderRadius:6}}>ODL ${pricing.odl}</span>
              </div>
            )}
          </div>
          <div style={{textAlign:"right",flexShrink:0}}>
            <p style={{margin:"0 0 6px",fontSize:24,fontWeight:800,color:DS.accent,letterSpacing:1}}>{loc.ext}</p>
            <div style={{display:"flex",gap:5,justifyContent:"flex-end",marginBottom:5}}>
              <button onClick={()=>{navigator.clipboard?.writeText(loc.ext);setCopiedExt(true);setTimeout(()=>setCopiedExt(false),1500);}} style={{padding:"5px 11px",borderRadius:7,border:"1.5px solid #003087",background:copiedExt?DS.accent:DS.accentDim,cursor:"pointer",fontSize:11,color:copiedExt?"#fff":DS.accent,fontWeight:600,transition:"all .2s"}}>{copiedExt?"✓ Copied":"Copy Ext"}</button>
              {isManager&&<button onClick={onEdit} style={{padding:"5px 8px",borderRadius:7,border:`1px solid ${DS.border}`,background:DS.bgSurf,cursor:"pointer",fontSize:10,color:DS.textMut}}>Edit</button>}
            </div>
            {loc.direct_phone&&(
              <button onClick={()=>{navigator.clipboard?.writeText(loc.direct_phone);setCopiedPhone(true);setTimeout(()=>setCopiedPhone(false),1500);}} style={{padding:"4px 10px",borderRadius:7,border:"1.5px solid #1a5c35",background:copiedPhone?DS.green:DS.greenDim,cursor:"pointer",fontSize:10,color:copiedPhone?"#fff":DS.green,fontWeight:600,transition:"all .2s",width:"100%"}}>{copiedPhone?"✓ Phone Copied":"Copy Phone"}</button>
            )}
          </div>
        </div>
        {/* Expand toggle */}
        {(Object.keys(hours).length>0||instructors.length>0)&&(
          <button onClick={()=>setExpanded(!expanded)} style={{marginTop:8,padding:"5px 0",background:"none",border:"none",cursor:"pointer",fontSize:11,color:DS.accent,fontWeight:600,display:"flex",alignItems:"center",gap:4}}>
            {expanded?"▲ Less info":"▼ Hours, pool & instructors"}
          </button>
        )}
      </div>

      {/* Expanded details */}
      {expanded&&(
        <div style={{borderTop:`1px solid ${DS.border}`,padding:"12px 14px",background:DS.bgSurf}}>
          {/* Hours */}
          {Object.keys(hours).length>0&&(
            <div style={{marginBottom:12}}>
              <p style={{margin:"0 0 8px",fontSize:11,fontWeight:700,color:DS.accent,textTransform:"uppercase",letterSpacing:.5}}>🕐 Location Hours</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"3px 10px"}}>
                {days.map(d=>(
                  <div key={d} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"3px 0",borderBottom:"1px solid #f0f0f0"}}>
                    <span style={{color:DS.textSec,fontWeight:500}}>{d.slice(0,3)}</span>
                    <span style={{color:hours[d]==='CLOSED'?"#e74c3c":"#1a1a1a",fontWeight:hours[d]==='CLOSED'?600:400}}>{hours[d]||'—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Pool specs */}
          {(loc.pool_dim||loc.pool_depth)&&(
            <div style={{marginBottom:12,display:"flex",gap:10}}>
              {loc.pool_dim&&<span style={{fontSize:11,background:DS.accentDim,color:DS.accent,padding:"3px 9px",borderRadius:7}}>📐 {loc.pool_dim}</span>}
              {loc.pool_depth&&<span style={{fontSize:11,background:DS.accentDim,color:DS.accent,padding:"3px 9px",borderRadius:7}}>↕ {loc.pool_depth}</span>}
              <span style={{fontSize:11,background:DS.amberDim,color:DS.amber,padding:"3px 9px",borderRadius:7}}>🌡 90°F</span>
            </div>
          )}
          {/* Special needs & languages highlight */}
          {(snInstructors.length>0||langInstructors.length>0)&&(
            <div style={{marginBottom:12,display:"flex",gap:8,flexWrap:"wrap"}}>
              {snInstructors.length>0&&<span style={{fontSize:11,background:DS.greenDim,color:DS.green,padding:"3px 9px",borderRadius:7,fontWeight:600}}>♿ {snInstructors.length} special needs instructor{snInstructors.length>1?"s":""}</span>}
              {langInstructors.length>0&&<span style={{fontSize:11,background:DS.accentDim,color:"#8e44ad",padding:"3px 9px",borderRadius:7,fontWeight:600}}>🌍 {[...new Set(langInstructors.flatMap(i=>i.lang.split(/[,&\/]/).map(l=>l.trim()).filter(l=>l&&l.toLowerCase()!=='english')))].join(", ")}</span>}
            </div>
          )}
          {/* Instructors */}
          {instructors.length>0&&(
            <div>
              <p style={{margin:"0 0 8px",fontSize:11,fontWeight:700,color:DS.accent,textTransform:"uppercase",letterSpacing:.5}}>👩‍🏫 Instructors ({instructors.length})</p>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {instructors.map((ins,i)=>(
                  <div key={i} style={{background:DS.bgSurf,borderRadius:9,padding:"8px 10px",border:`1px solid ${DS.border}`}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:ins.desc?3:0}}>
                      <span style={{fontWeight:600,fontSize:12}}>{ins.name}</span>
                      {ins.level&&<span style={{fontSize:9,background:ins.level.toLowerCase().includes("manager")?DS.accentDim:DS.bgSurf,color:ins.level.toLowerCase().includes("manager")?DS.accent:DS.textSec,padding:"1px 5px",borderRadius:3,fontWeight:600}}>{ins.level}</span>}
                      {ins.sn==='Y'&&<span style={{fontSize:9,background:DS.greenDim,color:DS.green,padding:"1px 5px",borderRadius:3,fontWeight:600}}>SEN</span>}
                      {ins.lang&&ins.lang.toLowerCase()!=='english'&&ins.lang.toLowerCase()!=='english '&&<span style={{fontSize:9,background:DS.accentDim,color:"#8e44ad",padding:"1px 5px",borderRadius:3}}>{ins.lang}</span>}
                    </div>
                    {ins.desc&&<p style={{margin:0,fontSize:11,color:DS.textSec,lineHeight:1.4}}>{ins.desc}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function HubPromoCard({promo,isManager,onEdit}) {
  const [expanded,setExpanded]=useState(false);
  const [copiedCode,setCopiedCode]=useState(false);
  const isExpiring = promo.expires_on && (new Date(promo.expires_on)-new Date())/(1000*60*60*24) < 7;
  return (
    <div style={{background:DS.bgCard,borderRadius:12,border:`1.5px solid ${isExpiring?"#f5b7b1":"#f0c080"}`,padding:"12px 14px",marginBottom:8}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:6}}>
            <span style={{fontWeight:700,fontSize:13}}>{promo.title}</span>
            {promo.proactive&&<span style={{fontSize:9,background:DS.greenDim,color:DS.green,padding:"2px 6px",borderRadius:4,fontWeight:700}}>Offer proactively</span>}
            {!promo.proactive&&<span style={{fontSize:9,background:DS.redDim,color:DS.red,padding:"2px 6px",borderRadius:4,fontWeight:700}}>Customer mentions only</span>}
            {promo.expires_on&&<span style={{fontSize:9,background:isExpiring?"#fde8e8":"#fff3cd",color:isExpiring?"#c0392b":"#856404",padding:"2px 6px",borderRadius:4,fontWeight:700}}>Exp: {promo.expires_on}</span>}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <span style={{fontSize:14,fontWeight:800,color:DS.accent,background:DS.accentDim,padding:"4px 12px",borderRadius:8,letterSpacing:.5}}>{promo.code}</span>
            <button onClick={()=>{navigator.clipboard?.writeText(promo.code);setCopiedCode(true);setTimeout(()=>setCopiedCode(false),1500);}} style={{padding:"4px 10px",borderRadius:7,border:"1.5px solid #003087",background:copiedCode?"#003087":"#fff",cursor:"pointer",fontSize:11,color:copiedCode?"#fff":"#003087",fontWeight:600,transition:"all .2s"}}>{copiedCode?"✓ Copied":"Copy Code"}</button>
          </div>
        </div>
        <div style={{display:"flex",gap:5,flexShrink:0}}>
          {isManager&&<button onClick={e=>{e.stopPropagation();onEdit();}} style={{padding:"4px 8px",borderRadius:6,border:`1px solid ${DS.border}`,background:DS.bgSurf,cursor:"pointer",fontSize:10,color:DS.textSec}}>Edit</button>}
          <button onClick={()=>setExpanded(!expanded)} style={{padding:"4px 8px",borderRadius:6,border:`1px solid ${DS.border}`,background:DS.bgSurf,cursor:"pointer",fontSize:12,color:DS.textMut}}>{expanded?"▲":"▼"}</button>
        </div>
      </div>
      {expanded&&(
        <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid #f5f5f5"}}>
          <p style={{margin:"0 0 4px",fontSize:10,fontWeight:700,color:DS.textSec,letterSpacing:.5,textTransform:"uppercase"}}>Full Rules</p>
          <p style={{margin:0,fontSize:12,color:DS.textSec,lineHeight:1.7,whiteSpace:"pre-line"}}>{promo.rules}</p>
        </div>
      )}
    </div>
  );
}

function HubDocCard({doc,isManager,onEdit}) {
  const [expanded,setExpanded]=useState(false);
  // Simple formatter: ALL CAPS lines → bold header, lines with → → highlighted
  const formatContent=(text)=>{
    if(!text) return null;
    return text.split('\n').map((line,i)=>{
      const trimmed=line.trim();
      if(!trimmed) return <div key={i} style={{height:6}}/>;
      if(trimmed.match(/^[═─]{3,}/)) return <hr key={i} style={{border:"none",borderTop:"1px solid #efefef",margin:"6px 0"}}/>;
      if(trimmed===trimmed.toUpperCase()&&trimmed.length>3&&!trimmed.includes('$')&&!trimmed.match(/^\d/))
        return <p key={i} style={{margin:"10px 0 4px",fontSize:11,fontWeight:700,color:DS.accent,letterSpacing:.5,textTransform:"uppercase"}}>{trimmed}</p>;
      if(trimmed.startsWith('"')&&trimmed.endsWith('"'))
        return <p key={i} style={{margin:"4px 0",fontSize:12,color:DS.green,background:DS.greenDim,borderLeft:"3px solid #1a5c35",padding:"4px 8px",borderRadius:"0 6px 6px 0",lineHeight:1.6}}>{trimmed}</p>;
      if(trimmed.startsWith('☐')||trimmed.startsWith('✓'))
        return <p key={i} style={{margin:"3px 0",fontSize:12,color:DS.textSec,paddingLeft:8}}>{trimmed}</p>;
      if(trimmed.startsWith('→')||trimmed.includes(' → '))
        return <p key={i} style={{margin:"3px 0",fontSize:12,color:"#8e44ad",fontWeight:500,paddingLeft:8}}>{trimmed}</p>;
      if(trimmed.match(/^\d+\./)||trimmed.match(/^(STEP|Step)\s+\d+/))
        return <p key={i} style={{margin:"6px 0 2px",fontSize:12,fontWeight:700,color:DS.textPri}}>{trimmed}</p>;
      return <p key={i} style={{margin:"2px 0",fontSize:12,color:DS.textSec,lineHeight:1.6}}>{trimmed}</p>;
    });
  };

  return (
    <div style={{background:DS.bgCard,borderRadius:12,border:`1px solid ${DS.border}`,padding:"11px 14px",marginBottom:7}}>
      <div style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}} onClick={()=>setExpanded(!expanded)}>
        <span style={{fontSize:18,flexShrink:0}}>📄</span>
        <div style={{flex:1}}>
          <p style={{margin:0,fontWeight:600,fontSize:13,color:DS.textPri}}>{doc.title}</p>
        </div>
        <div style={{display:"flex",gap:5,flexShrink:0}}>
          {isManager&&<button onClick={e=>{e.stopPropagation();onEdit();}} style={{padding:"3px 8px",borderRadius:6,border:`1px solid ${DS.border}`,background:DS.bgSurf,cursor:"pointer",fontSize:10,color:DS.textSec}}>Edit</button>}
          <span style={{fontSize:14,color:DS.textMut,padding:"3px 6px"}}>{expanded?"▲":"▼"}</span>
        </div>
      </div>
      {expanded&&doc.content&&(
        <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid #f5f5f5",maxHeight:500,overflowY:"auto"}}>
          {formatContent(doc.content)}
        </div>
      )}
    </div>
  );
}


function PartnerLocRow({loc}) {
  const [cop,setCop]=useState(false);
  return (
    <div style={{background:DS.bgCard,borderRadius:12,border:`1px solid ${DS.border}`,padding:"10px 13px",marginBottom:6,display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
      <div style={{flex:1}}>
        <p style={{margin:"0 0 2px",fontWeight:600,fontSize:13}}>{loc.name}</p>
        <p style={{margin:"0 0 3px",fontSize:11,color:DS.textMut}}>{loc.addr}</p>
        <div style={{display:"flex",gap:10}}>
          <span style={{fontSize:11,color:DS.textSec}}>Current: <strong style={{color:DS.accent}}>{loc.current}</strong></span>
          <span style={{fontSize:11,color:DS.textSec}}>New: <strong style={{color:"#8e44ad"}}>{loc.queue}</strong></span>
        </div>
      </div>
      <button onClick={()=>{navigator.clipboard?.writeText(loc.current);setCop(true);setTimeout(()=>setCop(false),1500);}} style={{padding:"5px 10px",borderRadius:7,border:`1px solid ${DS.border}`,background:cop?"#1a5c35":"#fafafa",cursor:"pointer",fontSize:11,color:cop?"#fff":"#888",fontWeight:600,transition:"all .2s",flexShrink:0}}>{cop?"✓":"Copy"}</button>
    </div>
  );
}

function HubTeamCard({member}) {
  const [copied,setCopied]=useState(false);
  return (
    <div style={{background:DS.bgCard,borderRadius:12,border:`1px solid ${DS.border}`,padding:"10px 14px",marginBottom:6,display:"flex",alignItems:"center",gap:10}}>
      <div style={{width:32,height:32,borderRadius:"50%",background:DS.greenDim,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:DS.green,flexShrink:0}}>{avatar(member.name)}</div>
      <p style={{margin:0,flex:1,fontWeight:600,fontSize:13}}>{member.name}</p>
      <span style={{fontSize:16,fontWeight:800,color:DS.green,marginRight:8}}>{member.ext}</span>
      <button onClick={()=>{navigator.clipboard?.writeText(member.ext);setCopied(true);setTimeout(()=>setCopied(false),1500);}} style={{padding:"5px 10px",borderRadius:7,border:"1.5px solid #1a5c35",background:copied?"#1a5c35":"#f0faf4",cursor:"pointer",fontSize:11,color:copied?"#fff":"#1a5c35",fontWeight:600,transition:"all .2s"}}>{copied?"✓":"Copy"}</button>
    </div>
  );
}


// ── HUB EDIT MODALS ───────────────────────────────────────────────────
function HubPromoModal({item,onClose,onSave,onDelete}) {
  const [f,setF]=useState({
    title:              item?.title||"",
    code:               item?.code||"",
    rules:              item?.rules||"",
    expires_on:         item?.expires_on||"",
    proactive:          item?.proactive||false,
    discount_pct:       item?.discount_pct||0,
    discount_fixed:     item?.discount_fixed||0,
    discount_type:      item?.discount_type||"pct",
    applies_to:         item?.applies_to||"continuous",
    one_class_only:     item?.one_class_only||false,
    multi_class_still:  item?.multi_class_still||true,
    customer_types:     item?.customer_types||["lead","lapsed"],
    month_restriction:  item?.month_restriction||"",
    requires_mention:   item?.requires_mention||false,
    show_scenarios:     item?.show_scenarios||false,
    location_restriction: item?.location_restriction||"",  // e.g. "Solon" — blank = all locations
    first_month_only:   item?.first_month_only||false,     // discount applies to first month only
    id:                 item?.id,
  });
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const toggleCustType=(t)=>set("customer_types", f.customer_types.includes(t) ? f.customer_types.filter(x=>x!==t) : [...f.customer_types,t]);

  const MONTHS_LIST = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  return (
    <Modal title={item?"Edit Promo":"Add Promo"} sub="PROMO" onClose={onClose} wide>
      <div style={{display:"flex",flexDirection:"column",gap:13}}>

        {/* Basic info */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><label style={{fontSize:11,color:DS.textSec,fontWeight:600,display:"block",marginBottom:3}}>PROMO TITLE</label><input value={f.title} onChange={e=>set("title",e.target.value)} placeholder="e.g. June Dive In" style={{width:"100%",padding:"9px 11px",borderRadius:9,border:`1px solid ${DS.border}`,fontSize:13,outline:"none"}}/></div>
          <div><label style={{fontSize:11,color:DS.textSec,fontWeight:600,display:"block",marginBottom:3}}>PROMO CODE</label><input value={f.code} onChange={e=>set("code",e.target.value)} placeholder="e.g. DIVEIN40" style={{width:"100%",padding:"9px 11px",borderRadius:9,border:`1px solid ${DS.border}`,fontSize:13,outline:"none"}}/></div>
        </div>

        {/* Discount settings */}
        <div style={{background:DS.greenDim,border:`1px solid ${DS.green}40`,borderRadius:10,padding:"12px 14px"}}>
          <p style={{margin:"0 0 10px",fontSize:11,fontWeight:700,color:DS.green,textTransform:"uppercase",letterSpacing:.5}}>💰 Discount Settings</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
            <div>
              <label style={{fontSize:11,color:DS.textSec,fontWeight:600,display:"block",marginBottom:3}}>DISCOUNT TYPE</label>
              <select value={f.discount_type} onChange={e=>set("discount_type",e.target.value)} style={{width:"100%",padding:"9px 11px",borderRadius:9,border:`1px solid ${DS.border}`,fontSize:12,outline:"none",background:DS.bgCard}}>
                <option value="pct">% off tuition</option>
                <option value="one_class_pct">% off — 1 class/week only</option>
                <option value="fixed">Fixed $ off per student</option>
              </select>
            </div>
            <div>
              {(f.discount_type==="pct"||f.discount_type==="one_class_pct")
                ? <><label style={{fontSize:11,color:DS.textSec,fontWeight:600,display:"block",marginBottom:3}}>DISCOUNT %</label><input type="number" min={1} max={100} value={f.discount_pct} onChange={e=>set("discount_pct",+e.target.value)} style={{width:"100%",padding:"9px 11px",borderRadius:9,border:`1px solid ${DS.border}`,fontSize:13,outline:"none"}}/></>
                : <><label style={{fontSize:11,color:DS.textSec,fontWeight:600,display:"block",marginBottom:3}}>DISCOUNT AMOUNT ($)</label><input type="number" min={1} value={f.discount_fixed} onChange={e=>set("discount_fixed",+e.target.value)} style={{width:"100%",padding:"9px 11px",borderRadius:9,border:`1px solid ${DS.border}`,fontSize:13,outline:"none"}}/></>
              }
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div>
              <label style={{fontSize:11,color:DS.textSec,fontWeight:600,display:"block",marginBottom:3}}>APPLIES TO</label>
              <select value={f.applies_to} onChange={e=>set("applies_to",e.target.value)} style={{width:"100%",padding:"9px 11px",borderRadius:9,border:`1px solid ${DS.border}`,fontSize:12,outline:"none",background:DS.bgCard}}>
                <option value="continuous">Continuous classes only (no ODL/clinic)</option>
                <option value="group">Group classes only</option>
                <option value="all">All lesson types</option>
              </select>
            </div>
            {f.discount_type==="one_class_pct"&&(
              <div style={{display:"flex",alignItems:"center",gap:8,paddingTop:18}}>
                <input type="checkbox" id="multi_still" checked={f.multi_class_still} onChange={e=>set("multi_class_still",e.target.checked)} style={{width:16,height:16,cursor:"pointer"}}/>
                <label htmlFor="multi_still" style={{fontSize:12,cursor:"pointer",lineHeight:1.4}}>Other classes still get 10% multi-class</label>
              </div>
            )}
          </div>
          {f.discount_type==="one_class_pct"&&(
            <div style={{marginTop:10}}>
              <input type="checkbox" id="show_scen" checked={f.show_scenarios} onChange={e=>set("show_scenarios",e.target.checked)} style={{width:16,height:16,cursor:"pointer",marginRight:8}}/>
              <label htmlFor="show_scen" style={{fontSize:12,cursor:"pointer"}}>Show 1/2/3 class/week scenario selector in calculator</label>
            </div>
          )}
        </div>

        {/* Restrictions */}
        <div style={{background:DS.amberDim,border:`1px solid ${DS.amber}40`,borderRadius:10,padding:"12px 14px"}}>
          <p style={{margin:"0 0 10px",fontSize:11,fontWeight:700,color:DS.amber,textTransform:"uppercase",letterSpacing:.5}}>🔒 Restrictions</p>
          <div style={{marginBottom:10}}>
            <label style={{fontSize:11,color:DS.textSec,fontWeight:600,display:"block",marginBottom:6}}>VALID FOR</label>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {[{k:"lead",l:"New leads"},{k:"lapsed",l:"Lapsed"},{k:"active",l:"Active"}].map(t=>(
                <div key={t.k} onClick={()=>toggleCustType(t.k)} style={{padding:"5px 12px",borderRadius:8,border:`1.5px solid ${f.customer_types.includes(t.k)?"#e07b00":"#ddd"}`,background:f.customer_types.includes(t.k)?"#fff8ee":"#fff",cursor:"pointer",fontSize:12,fontWeight:600,color:f.customer_types.includes(t.k)?"#b85c00":"#888"}}>
                  {f.customer_types.includes(t.k)?"✓ ":""}{t.l}
                </div>
              ))}
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div>
              <label style={{fontSize:11,color:DS.textSec,fontWeight:600,display:"block",marginBottom:3}}>MONTH RESTRICTION</label>
              <select value={f.month_restriction} onChange={e=>set("month_restriction",e.target.value)} style={{width:"100%",padding:"9px 11px",borderRadius:9,border:`1px solid ${DS.border}`,fontSize:12,outline:"none",background:DS.bgCard}}>
                <option value="">Any month</option>
                {MONTHS_LIST.map((m,i)=><option key={i} value={String(i)}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:11,color:DS.textSec,fontWeight:600,display:"block",marginBottom:3}}>EXPIRY DATE</label>
              <input type="date" value={f.expires_on} onChange={e=>set("expires_on",e.target.value)} style={{width:"100%",padding:"9px 11px",borderRadius:9,border:`1px solid ${DS.border}`,fontSize:13,outline:"none"}}/>
            </div>
          </div>
          <div style={{display:"flex",gap:16,marginTop:10,flexWrap:"wrap"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input type="checkbox" id="proactive2" checked={f.proactive} onChange={e=>set("proactive",e.target.checked)} style={{width:16,height:16,cursor:"pointer"}}/>
              <label htmlFor="proactive2" style={{fontSize:12,cursor:"pointer"}}>May offer proactively</label>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input type="checkbox" id="req_mention" checked={f.requires_mention} onChange={e=>set("requires_mention",e.target.checked)} style={{width:16,height:16,cursor:"pointer"}}/>
              <label htmlFor="req_mention" style={{fontSize:12,cursor:"pointer"}}>Customer must mention it</label>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input type="checkbox" id="first_mo" checked={f.first_month_only} onChange={e=>set("first_month_only",e.target.checked)} style={{width:16,height:16,cursor:"pointer"}}/>
              <label htmlFor="first_mo" style={{fontSize:12,cursor:"pointer"}}>First month only</label>
            </div>
          </div>
          <div style={{marginTop:10}}>
            <label style={{fontSize:11,color:DS.textSec,fontWeight:600,display:"block",marginBottom:3}}>LOCATION RESTRICTION <span style={{fontWeight:400,color:DS.textMut}}>(blank = all locations)</span></label>
            <input value={f.location_restriction} onChange={e=>set("location_restriction",e.target.value)} placeholder="e.g. Solon — leave blank for all locations" style={{width:"100%",padding:"9px 11px",borderRadius:9,border:`1px solid ${DS.border}`,fontSize:12,outline:"none"}}/>
          </div>
        </div>

        {/* Full rules text */}
        <div><label style={{fontSize:11,color:DS.textSec,fontWeight:600,display:"block",marginBottom:3}}>FULL RULES (shown when expanded)</label><textarea value={f.rules} onChange={e=>set("rules",e.target.value)} rows={4} placeholder="Full terms and conditions as stated in the promo brief…" style={{width:"100%",padding:"9px 11px",borderRadius:9,border:`1px solid ${DS.border}`,fontSize:12,outline:"none",resize:"vertical",lineHeight:1.6}}/></div>

        <div style={{display:"flex",gap:8,marginTop:4}}>
          {item&&<Btn label="Remove Promo" onClick={()=>onDelete(item.id)} color="#e74c3c" small/>}
          <div style={{flex:1}}/>
          <Btn label="Cancel" onClick={onClose} outline color="#888" small/>
          <Btn label="Save Promo" onClick={()=>onSave(f)} color="#003087" small/>
        </div>
      </div>
    </Modal>
  );
}

function HubClosureModal({item,locations,onClose,onSave,onDelete}) {
  const [f,setF]=useState({location_name:item?.location_name||"",start_date:item?.start_date||todayStr(),end_date:item?.end_date||todayStr(),reason:item?.reason||"",id:item?.id});
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  return (
    <Modal title={item?"Edit Closure":"Log Closure"} sub="POOL CLOSURE" onClose={onClose}>
      <div style={{display:"flex",flexDirection:"column",gap:11}}>
        <div>
          <label style={{fontSize:12,color:DS.textSec,display:"block",marginBottom:3}}>Location</label>
          <input value={f.location_name} onChange={e=>set("location_name",e.target.value)} placeholder="e.g. Fort Worth" list="loc-list" style={{width:"100%",padding:"9px 11px",borderRadius:9,border:`1px solid ${DS.border}`,fontSize:13,outline:"none"}}/>
          <datalist id="loc-list">{locations.map((l,i)=><option key={i} value={l.name}/>)}</datalist>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><label style={{fontSize:12,color:DS.textSec,display:"block",marginBottom:3}}>Start Date</label><input type="date" value={f.start_date} onChange={e=>set("start_date",e.target.value)} style={{width:"100%",padding:"9px 11px",borderRadius:9,border:`1px solid ${DS.border}`,fontSize:13,outline:"none"}}/></div>
          <div><label style={{fontSize:12,color:DS.textSec,display:"block",marginBottom:3}}>End Date</label><input type="date" value={f.end_date} onChange={e=>set("end_date",e.target.value)} style={{width:"100%",padding:"9px 11px",borderRadius:9,border:`1px solid ${DS.border}`,fontSize:13,outline:"none"}}/></div>
        </div>
        <div><label style={{fontSize:12,color:DS.textSec,display:"block",marginBottom:3}}>Reason</label><input value={f.reason} onChange={e=>set("reason",e.target.value)} placeholder="e.g. Maintenance, Public Holiday" style={{width:"100%",padding:"9px 11px",borderRadius:9,border:`1px solid ${DS.border}`,fontSize:13,outline:"none"}}/></div>
        <div style={{display:"flex",gap:8,marginTop:4}}>
          {item&&<Btn label="Remove" onClick={()=>onDelete(item.id)} color="#e74c3c" small/>}
          <div style={{flex:1}}/>
          <Btn label="Cancel" onClick={onClose} outline color="#888" small/>
          <Btn label="Save Closure" onClick={()=>onSave(f)} color="#c0392b" small/>
        </div>
      </div>
    </Modal>
  );
}

function HubDocModal({item,onClose,onSave,onDelete}) {
  const [f,setF]=useState({title:item?.title||"",content:item?.content||"",category:item?.category||"General",id:item?.id});
  const [extracting,setExtracting]=useState(false);
  const [uploadErr,setUploadErr]=useState("");
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const cats=["General","Scripts","SOPs","Pricing","Levels","FAQs","Policies"];
  const fileRef=useRef();

  const detectCategory=(name)=>{
    const n=name.toLowerCase();
    if(n.includes("script")||n.includes("call")||n.includes("objection")) return "Scripts";
    if(n.includes("sop")||n.includes("procedure")||n.includes("how to")||n.includes("birthday")||n.includes("sibling")||n.includes("unavail")) return "SOPs";
    if(n.includes("pric")||n.includes("tuition")||n.includes("fee")) return "Pricing";
    if(n.includes("level")||n.includes("skill")||n.includes("assess")) return "Levels";
    if(n.includes("faq")||n.includes("question")) return "FAQs";
    if(n.includes("polic")||n.includes("max avail")||n.includes("declined")||n.includes("payment")) return "Policies";
    return "General";
  };

  const csvToText=(csv)=>{
    return csv.split("\n").map(row=>{
      const cells=row.split(",").map(c=>c.replace(/^"|"$/g,"").trim());
      return cells.filter(Boolean).join("  |  ");
    }).filter(Boolean).join("\n");
  };

  const loadScript=(src)=>new Promise((res,rej)=>{
    if(document.querySelector(`script[src="${src}"]`)){res();return;}
    const s=document.createElement("script");s.src=src;s.onload=res;s.onerror=rej;document.head.appendChild(s);
  });

  const extractPDF=async(file)=>{
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
    window.pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    const ab=await file.arrayBuffer();
    const pdf=await window.pdfjsLib.getDocument({data:ab}).promise;
    let text="";
    for(let i=1;i<=pdf.numPages;i++){
      const page=await pdf.getPage(i);
      const tc=await page.getTextContent();
      text+=tc.items.map(t=>t.str).join(" ")+("\n");
    }
    return text.trim();
  };

  const extractDocx=async(file)=>{
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js");
    const ab=await file.arrayBuffer();
    const result=await window.mammoth.extractRawText({arrayBuffer:ab});
    return result.value.trim();
  };

  const handleFile=async(file)=>{
    if(!file)return;
    setUploadErr("");setExtracting(true);
    try{
      const ext=file.name.split(".").pop().toLowerCase();
      const title=file.name.replace(/\.[^.]+$/,"");
      const cat=detectCategory(file.name);
      let text="";
      if(["txt","md"].includes(ext)){
        text=await file.text();
      } else if(ext==="csv"){
        const raw=await file.text();
        text=csvToText(raw);
      } else if(ext==="pdf"){
        text=await extractPDF(file);
      } else if(ext==="docx"){
        text=await extractDocx(file);
      } else {
        setUploadErr("Unsupported file type. Use PDF, Word (.docx), CSV, or TXT.");
        setExtracting(false);return;
      }
      setF({...f,title,content:text,category:cat,id:f.id});
    } catch(e){
      setUploadErr("Could not extract file content. Try downloading as plain text (.txt) from Google Docs and uploading that.");
      console.error(e);
    }
    setExtracting(false);
  };

  return (
    <Modal title={item?"Edit Document":"Add Document"} sub="DOC" onClose={onClose} wide>
      <div style={{display:"flex",flexDirection:"column",gap:11}}>
        {!item&&(
          <div
            onClick={()=>fileRef.current?.click()}
            onDragOver={e=>e.preventDefault()}
            onDrop={e=>{e.preventDefault();handleFile(e.dataTransfer.files[0]);}}
            style={{border:"2px dashed #8e44ad",borderRadius:12,padding:"18px",textAlign:"center",cursor:"pointer",background:DS.accentDim,transition:"background .2s"}}
          >
            <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md,.csv" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>
            {extracting?(
              <div><p style={{margin:0,fontSize:13,color:"#8e44ad",fontWeight:600}}>Extracting content…</p><p style={{margin:"4px 0 0",fontSize:11,color:DS.textMut}}>This may take a few seconds</p></div>
            ):(
              <div>
                <p style={{margin:0,fontSize:22}}>📂</p>
                <p style={{margin:"6px 0 2px",fontSize:13,fontWeight:600,color:"#8e44ad"}}>Drop a file or click to upload</p>
                <p style={{margin:0,fontSize:11,color:DS.textMut}}>PDF · Word (.docx) · CSV · TXT — category auto-detected from filename</p>
              </div>
            )}
          </div>
        )}
        {uploadErr&&<div style={{background:DS.redDim,border:"1.5px solid #f5b7b1",borderRadius:9,padding:"9px 12px"}}><p style={{margin:0,fontSize:12,color:DS.red}}>{uploadErr}</p></div>}
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:10}}>
          <div><label style={{fontSize:12,color:DS.textSec,display:"block",marginBottom:3}}>Document Title</label><input value={f.title} onChange={e=>set("title",e.target.value)} placeholder="Auto-filled from filename" style={{width:"100%",padding:"9px 11px",borderRadius:9,border:`1px solid ${DS.border}`,fontSize:13,outline:"none"}}/></div>
          <div><label style={{fontSize:12,color:DS.textSec,display:"block",marginBottom:3}}>Category</label>
            <select value={f.category} onChange={e=>set("category",e.target.value)} style={{width:"100%",padding:"9px 11px",borderRadius:9,border:`1px solid ${DS.border}`,fontSize:13,outline:"none",background:DS.bgCard}}>
              {cats.map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label style={{fontSize:12,color:DS.textSec,display:"block",marginBottom:3}}>Content {f.content&&<span style={{color:DS.green,fontWeight:600}}>✓ Extracted</span>}</label>
          <textarea value={f.content} onChange={e=>set("content",e.target.value)} rows={10} placeholder="Upload a file above or paste content here…" style={{width:"100%",padding:"9px 11px",borderRadius:9,border:`1.5px solid ${f.content?"#c8e6c9":"#ddd"}`,fontSize:12,outline:"none",resize:"vertical",lineHeight:1.7,fontFamily:"inherit"}}/>
          <p style={{margin:"4px 0 0",fontSize:11,color:DS.textMut}}>Review and edit extracted content before saving.</p>
        </div>
        <div style={{display:"flex",gap:8,marginTop:4}}>
          {item&&<Btn label="Delete Doc" onClick={()=>onDelete(item.id)} color="#e74c3c" small/>}
          <div style={{flex:1}}/>
          <Btn label="Cancel" onClick={onClose} outline color="#888" small/>
          <Btn label="Save Doc" onClick={()=>onSave(f)} color="#8e44ad" small/>
        </div>
      </div>
    </Modal>
  );
}

function HubLocModal({item,onClose,onSave}) {
  const [f,setF]=useState({id:item?.id,ext:item?.ext||"",privates:item?.privates||false,pool:item?.pool||"Chlorine",addr:item?.addr||""});
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  return (
    <Modal title={`Edit — ${item?.name}`} sub="LOCATION" onClose={onClose}>
      <div style={{display:"flex",flexDirection:"column",gap:11}}>
        <div><label style={{fontSize:12,color:DS.textSec,display:"block",marginBottom:3}}>Extension</label><input value={f.ext} onChange={e=>set("ext",e.target.value)} style={{width:"100%",padding:"9px 11px",borderRadius:9,border:`1px solid ${DS.border}`,fontSize:13,outline:"none"}}/></div>
        <div><label style={{fontSize:12,color:DS.textSec,display:"block",marginBottom:3}}>Address</label><input value={f.addr} onChange={e=>set("addr",e.target.value)} style={{width:"100%",padding:"9px 11px",borderRadius:9,border:`1px solid ${DS.border}`,fontSize:13,outline:"none"}}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,alignItems:"center"}}>
          <div><label style={{fontSize:12,color:DS.textSec,display:"block",marginBottom:3}}>Pool Type</label>
            <select value={f.pool} onChange={e=>set("pool",e.target.value)} style={{width:"100%",padding:"9px 11px",borderRadius:9,border:`1px solid ${DS.border}`,fontSize:13,outline:"none",background:DS.bgCard}}>
              <option>Chlorine</option><option>Salt</option>
            </select>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,paddingTop:18}}>
            <input type="checkbox" id="priv" checked={f.privates} onChange={e=>set("privates",e.target.checked)} style={{width:16,height:16,cursor:"pointer"}}/>
            <label htmlFor="priv" style={{fontSize:13,cursor:"pointer"}}>20-min privates</label>
          </div>
        </div>
        <div style={{display:"flex",gap:8,marginTop:4}}>
          <Btn label="Cancel" onClick={onClose} outline color="#888" small/>
          <Btn label="Save Changes" onClick={()=>onSave(f)} color="#003087"/>
        </div>
      </div>
    </Modal>
  );
}

function HubEventModal({item,onClose,onSave,onDelete}) {
  const [f,setF]=useState({name:item?.name||"",event_date:item?.event_date||"",note:item?.note||"",id:item?.id});
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  return (
    <Modal title={item?"Edit Event":"Add Event"} sub="EVENT" onClose={onClose}>
      <div style={{display:"flex",flexDirection:"column",gap:11}}>
        <div><label style={{fontSize:12,color:DS.textSec,display:"block",marginBottom:3}}>Event Name</label><input value={f.name} onChange={e=>set("name",e.target.value)} style={{width:"100%",padding:"9px 11px",borderRadius:9,border:`1px solid ${DS.border}`,fontSize:13,outline:"none"}}/></div>
        <div><label style={{fontSize:12,color:DS.textSec,display:"block",marginBottom:3}}>Date</label><input value={f.event_date} onChange={e=>set("event_date",e.target.value)} placeholder="e.g. Jul 11, 2026" style={{width:"100%",padding:"9px 11px",borderRadius:9,border:`1px solid ${DS.border}`,fontSize:13,outline:"none"}}/></div>
        <div><label style={{fontSize:12,color:DS.textSec,display:"block",marginBottom:3}}>Note (optional)</label><input value={f.note} onChange={e=>set("note",e.target.value)} placeholder="e.g. Tentative" style={{width:"100%",padding:"9px 11px",borderRadius:9,border:`1px solid ${DS.border}`,fontSize:13,outline:"none"}}/></div>
        <div style={{display:"flex",gap:8,marginTop:4}}>
          {item&&<Btn label="Remove" onClick={()=>onDelete(item.id)} color="#e74c3c" small/>}
          <div style={{flex:1}}/>
          <Btn label="Cancel" onClick={onClose} outline color="#888" small/>
          <Btn label="Save Event" onClick={()=>onSave(f)} color="#e07b00" small/>
        </div>
      </div>
    </Modal>
  );
}




// ── QUOTE CALCULATOR ──────────────────────────────────────────────────
const LESSON_TYPES = [
  {key:"group_mf",   label:"Group (M–F)",          priceKey:"price_mf",       continuous:true,  group:true},
  {key:"group_ss",   label:"Group (Sa–Su)",         priceKey:"price_ss",       continuous:true,  group:true},
  {key:"swim_tm_mf", label:"Swim Team (M–F)",       priceKey:"price_st_mf",    continuous:true,  group:true},
  {key:"swim_tm_ss", label:"Swim Team (Sa–Su)",     priceKey:"price_st_ss",    continuous:true,  group:true},
  {key:"private_30", label:"Private (30 min)",      priceKey:"price_priv",     continuous:true,  group:false},
  {key:"semi",       label:"Semi-Private (30m)",    priceKey:"price_semi",     continuous:true,  group:false},
  {key:"adaptive",   label:"Private Adaptive",      priceKey:"price_adaptive", continuous:true,  group:false},
  {key:"private_20", label:"Private (20 min)",      priceKey:"price_priv20",   continuous:true,  group:false},
  {key:"odl_mf",     label:"ODL (M–F)",             priceKey:"price_odl",      continuous:false, group:false},
  {key:"odl_ss",     label:"ODL (Sa–Su)",           priceKey:"price_odl_ss",   continuous:false, group:false},
  {key:"clinic",     label:"Swim Clinic (per wk)",  priceKey:"price_clinic",   continuous:false, group:false},
];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
// FIX 1+10: SwimKids IS a partner brand — added to list
const PARTNER_REGIONS = ["AQUAfin","AQua Wave","Charlotte Swim","King","Little Flippers","Njswim","Swim To Shore","SwimKids"];
const SIBLING_EXEMPT_LOCS = ["Gig Harbor","Henderson","Olympia"]; // ICP auto-applies here
const REG_FEE = 35;

function QuoteCalculator({locations, activePromos=[]}) {
  const BILLING_DAY = 20;
  const DAYS_SHORT  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const MONTHS      = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  const SIB_DISCOUNT_LOCS = new Set([
    "San Carlos","San Mateo","Murrieta",
    "Fleming Island","Mandarin","Nocatee","St Augustine","St Johns Bluff",
    "Natick","Winchester","Henderson",
    "Brick","Florham Park","Lakeside","Manasquan","Sparta","Turnersville",
    "Gainesville","Leesburg","Woodbridge",
    "Gig Harbor","Olympia","Fitchburg","West Madison",
  ]);

  const ALL_TYPES = [
    {key:"group_mf",   label:"Group (M–F)",        priceKey:"price_mf",       cat:"cont",    isGroup:true},
    {key:"group_ss",   label:"Group (Sa–Su)",       priceKey:"price_ss",       cat:"cont",    isGroup:true},
    {key:"team_mf",    label:"Swim Team (M–F)",     priceKey:"price_st_mf",    cat:"cont",    isGroup:false},
    {key:"team_ss",    label:"Swim Team (Sa–Su)",    priceKey:"price_st_ss",    cat:"cont",    isGroup:false},
    {key:"private_30", label:"Private (30m)",        priceKey:"price_priv",     cat:"private", noDiscount:true},
    {key:"semi",       label:"Semi-Private (30m)",   priceKey:"price_semi",     cat:"private", noDiscount:true},
    {key:"adaptive",   label:"Private Adaptive",     priceKey:"price_adaptive", cat:"private", noDiscount:true},
    {key:"private_20", label:"Private (20m)",        priceKey:"price_priv20",   cat:"private", noDiscount:true},
    {key:"odl_mf",    label:"ODL (M–F)",             priceKey:"price_odl",      cat:"odl",     noDiscount:true, flat:true, surcharge:5},
    {key:"odl_ss",    label:"ODL (Sa–Su)",            priceKey:"price_odl_ss",   cat:"odl",     noDiscount:true, flat:true, surcharge:5},
    {key:"clinic",    label:"Swim Clinic",            priceKey:"price_clinic",   cat:"clinic",  noDiscount:true, flat:true},
  ];

  const [locId,        setLocId]        = useState("");
  const [locSearch,    setLocSearch]    = useState("");
  const [enrollDate,   setEnrollDate]   = useState("");
  const [custType,     setCustType]     = useState("lead");
  const [numKids,      setNumKids]      = useState(1);
  const [promoChecked, setPromoChecked] = useState([]);
  const [copied,       setCopied]       = useState(false);

  // Groups: each group has { id, type, day1, day2, qty (sessions for flat), count (kids in this group) }
  const [groups, setGroups] = useState([
    {id:1, type:"group_mf", day1:"", day2:"", qty:1, count:1}
  ]);

  const loc = locations.find(l=>l.id===locId);
  const hasSibDiscount = loc ? SIB_DISCOUNT_LOCS.has(loc.name) : false;
  const getRate = (priceKey, surcharge=0) => loc ? (parseFloat(loc[priceKey])||0) + surcharge : 0;
  const totalAssigned = groups.reduce((s,g)=>s+g.count,0);

  const updateGroup = (id, field, val) => setGroups(prev=>prev.map(g=>g.id===id?{...g,[field]:val}:g));
  const addGroup    = () => setGroups(prev=>[...prev, {id:Date.now(),type:"group_mf",day1:"",day2:"",qty:1,count:1}]);
  const removeGroup = (id) => { if(groups.length>1) setGroups(prev=>prev.filter(g=>g.id!==id)); };

  // ── DATE HELPERS ──────────────────────────────────────────────────────
  function countDayInRange(dayOfWeek, startDate, endDate) {
    if(!startDate||!endDate||startDate>endDate) return 0;
    let count=0, d=new Date(startDate.getTime());
    while(d.getDay()!==parseInt(dayOfWeek)) d.setDate(d.getDate()+1);
    while(d<=endDate){count++;d.setDate(d.getDate()+7);}
    return count;
  }
  function lastDayOfMonth(y,m){ const d=new Date(y,m+1,0); d.setHours(23,59,59,999); return d; }

  // ── PROMOS ────────────────────────────────────────────────────────────
  const eligiblePromos = activePromos.filter(p=>{
    if(!p.discount_pct&&!p.discount_fixed) return false;
    let ct=p.customer_types;
    if(typeof ct==="string"){try{ct=JSON.parse(ct);}catch{ct=ct?[ct]:[]; }}
    if(ct?.length&&!ct.includes(custType)) return false;
    if(p.month_restriction&&p.month_restriction!==""){
      const em=enrollDate?new Date(enrollDate+"T12:00:00").getMonth():-1;
      if(String(p.month_restriction)!==String(em)) return false;
    }
    if(p.location_restriction&&p.location_restriction.trim()){
      if(!loc||!loc.name.toLowerCase().includes(p.location_restriction.toLowerCase())) return false;
    }
    return true;
  });

  const applyPromos = (amount, classCount, isFirstMonth, isCont, isGroup) => {
    const checked = eligiblePromos.filter(p=>promoChecked.includes(p.code));
    let total = amount;
    checked.forEach(p=>{
      if(p.first_month_only&&!isFirstMonth) return;
      const at=p.applies_to||"continuous";
      if(at==="continuous"&&!isCont) return;
      if(at==="group"&&!isGroup) return;
      const dtype=p.discount_type||(p.discount_fixed?"fixed":"pct");
      if(dtype==="pct"){
        if(p.one_class_only){total-=(amount/(classCount||1))*(p.discount_pct/100);}
        else{total-=total*(p.discount_pct/100);}
      } else if(dtype==="fixed"){total-=p.discount_fixed;}
    });
    return Math.max(0,total);
  };

  // ── CALC ──────────────────────────────────────────────────────────────
  const calcGroup = (g, enroll, endCurr, startNxt, endNxt) => {
    const ti = ALL_TYPES.find(t=>t.key===g.type);
    if(!ti) return null;
    const rate = getRate(ti.priceKey, ti.surcharge||0);
    const isCont = ti.cat==="cont";
    const isFlat = !!ti.flat;
    const d2 = g.day2&&g.day2!==g.day1?g.day2:null;
    const rate2 = d2&&isCont&&ti.isGroup ? rate*0.9 : rate;
    // Sibling discount: apply to all kids in this group if sibling discount eligible
    // and this isn't the first group (first group = first kid)
    const groupIdx = groups.findIndex(x=>x.id===g.id);
    const isFirstGroup = groupIdx===0;
    const sibMult = (hasSibDiscount&&isCont&&ti.isGroup&&!isFirstGroup) ? 0.9 : 1.0;

    let raw_curr, raw_next, cc_curr=0, cc_next=0, counts={};
    if(isFlat){
      raw_curr = rate * g.qty;
      raw_next = raw_curr;
      cc_curr = g.qty; cc_next = g.qty;
    } else {
      if(!g.day1) return null;
      const c1c=countDayInRange(g.day1,enroll,endCurr);
      const c2c=d2?countDayInRange(d2,enroll,endCurr):0;
      const c1n=countDayInRange(g.day1,startNxt,endNxt);
      const c2n=d2?countDayInRange(d2,startNxt,endNxt):0;
      raw_curr=c1c*rate+c2c*rate2;
      raw_next=c1n*rate+c2n*rate2;
      cc_curr=c1c+c2c; cc_next=c1n+c2n;
      counts={c1c,c2c,c1n,c2n};
    }

    const perKid_curr = ti.noDiscount ? raw_curr*sibMult : applyPromos(raw_curr*sibMult, cc_curr, true, isCont, !!ti.isGroup);
    const perKid_next = ti.noDiscount ? raw_next*sibMult : applyPromos(raw_next*sibMult, cc_next, false, isCont, !!ti.isGroup);

    return {ti, rate, rate2, d2, sibMult, isFlat,
            perKid_curr, perKid_next,
            total_curr: perKid_curr * g.count,
            total_next: perKid_next * g.count,
            counts};
  };

  const calc = () => {
    if(!loc||!enrollDate) return null;
    const incomplete = groups.some(g=>{ const ti=ALL_TYPES.find(t=>t.key===g.type); return !ti?.flat&&!g.day1; });
    if(incomplete) return null;

    const enroll=new Date(enrollDate+"T12:00:00");
    const y=enroll.getFullYear(),m=enroll.getMonth();
    const isBeforeBilling=enroll.getDate()<BILLING_DAY;
    const nextMon=m===11?0:m+1, nextYr=m===11?y+1:y;
    const endCurr=lastDayOfMonth(y,m);
    const startNxt=new Date(nextYr,nextMon,1);
    const endNxt=lastDayOfMonth(nextYr,nextMon);

    const groupResults=groups.map(g=>({g,r:calcGroup(g,enroll,endCurr,startNxt,endNxt)})).filter(x=>x.r);
    const regFeeTotal=Math.min(numKids,2)*REG_FEE;
    const total_curr=groupResults.reduce((s,x)=>s+x.r.total_curr,0);
    const total_next=groupResults.reduce((s,x)=>s+x.r.total_next,0);
    const today_amount=(isBeforeBilling?total_curr:total_curr+total_next)+regFeeTotal;
    const auto_amount=isBeforeBilling?total_next:0;

    return {isBeforeBilling,groupResults,regFeeTotal,total_curr,total_next,today_amount,auto_amount,
            currentMonthName:MONTHS[m],nextMonthName:MONTHS[nextMon],billingDate:`${MONTHS[m]} ${BILLING_DAY}`};
  };

  const result = calc();
  const fmt = n=>`$${(+n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,",")}`;

  const buildScript = () => {
    if(!result||!loc) return "";
    const {isBeforeBilling,groupResults,regFeeTotal,today_amount,auto_amount,
           currentMonthName,nextMonthName,billingDate,total_curr,total_next} = result;
    let s = "";

    groupResults.forEach(({g,r})=>{
      const d1l = g.day1?DAYS_SHORT[parseInt(g.day1)]:"";
      const d2l = r.d2!==null?DAYS_SHORT[parseInt(r.d2)]:null;
      const kw = g.count===1?"child":`${g.count} children`;

      s += `For ${kw} in ${r.ti.label}`;
      if(!r.isFlat&&d1l){ s+=` on ${d1l}s`; if(d2l) s+=` and ${d2l}s`; }
      s += `, the rate is ${fmt(r.rate)} per class`;
      if(d2l) s += ` for ${d1l}s and ${fmt(r.rate2)} for ${d2l}s — that includes our 10% multi-day discount`;
      if(r.sibMult<1) s += `. A 10% sibling discount also applies`;
      s += `.\n`;

      if(!r.isFlat&&r.counts){
        const {c1c,c2c}=r.counts;
        s += `In ${currentMonthName} from your start date, there ${c1c===1?"is":"are"} ${c1c} ${d1l} class${c1c!==1?"es":""}`;
        if(d2l&&c2c>0) s+=` and ${c2c} ${d2l} class${c2c!==1?"es":""}`;
        s += ` — ${fmt(r.perKid_curr)} per child`;
        if(g.count>1) s+=`, ${fmt(r.total_curr)} for ${g.count} children`;
        s += `.\n`;
      } else if(r.isFlat){
        s+=`That's ${g.qty} session${g.qty!==1?"s":""} at ${fmt(r.rate)} each — ${fmt(r.total_curr)} total.\n`;
      }
      s+=`\n`;
    });

    if(isBeforeBilling){
      s+=`Your ${currentMonthName} tuition comes to ${fmt(total_curr)}, plus a one-time registration fee of ${fmt(regFeeTotal)}`;
      if(numKids>2) s+=` — that covers two children, and the third onwards is free`;
      s+=`. So the amount due today would be ${fmt(today_amount)}.\n\n`;
      s+=`On ${billingDate}, ${fmt(auto_amount)} would be automatically charged for ${nextMonthName}. After that, billing runs on the 20th of each month for the following month.`;
    } else {
      s+=`Since we're past the 20th, today covers ${currentMonthName} remaining classes (${fmt(total_curr)}) plus the full month of ${nextMonthName} (${fmt(total_next)}), `;
      s+=`plus the one-time registration fee of ${fmt(regFeeTotal)}`;
      if(numKids>2) s+=` — two children covered, third and beyond are free`;
      s+=`. Total due today: ${fmt(today_amount)}.\n\n`;
      s+=`After that, billing runs on the 20th of each month for the following month.`;
    }
    return s;
  };

  const copyScript = ()=>{ navigator.clipboard.writeText(buildScript()).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);}); };
  const filteredLocs = [...locations].filter(l=>(l.name||"").toLowerCase().includes(locSearch.toLowerCase())&&l.price_mf).sort((a,b)=>a.name.localeCompare(b.name));

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12,paddingTop:8}}>

      {/* 1 — Location */}
      <div style={{background:DS.bgCard,borderRadius:DS.radius,border:`1px solid ${DS.border}`,padding:14}}>
        <p style={{margin:"0 0 10px",fontSize:11,fontWeight:700,color:DS.textMut,textTransform:"uppercase",letterSpacing:1}}>1 · Location</p>
        <input value={locSearch} onChange={e=>{setLocSearch(e.target.value);setLocId("");}} placeholder="Search location…" style={{width:"100%",marginBottom:8}}/>
        {!locId&&(
          <div style={{maxHeight:200,overflowY:"auto",display:"flex",flexDirection:"column",gap:3}}>
            {filteredLocs.map(l=>(
              <div key={l.id} onClick={()=>{setLocId(l.id);setLocSearch(l.name||"");}} style={{padding:"7px 10px",borderRadius:DS.radiusSm,background:DS.bgSurf,border:`1px solid ${DS.border}`,cursor:"pointer",fontSize:12}}>
                <span style={{fontWeight:600,color:DS.textPri}}>{l.name}</span>
                {l.region&&<span style={{color:DS.textMut,fontSize:11}}> · {l.region}</span>}
              </div>
            ))}
          </div>
        )}
        {loc&&<p style={{margin:"4px 0 0",fontSize:11,color:DS.green}}>✓ {loc.name} · {loc.region||loc.state}{hasSibDiscount?" · 🏷️ Sibling discount available":""}</p>}
      </div>

      {/* 2 — Customer + kids */}
      {loc&&(
        <div style={{background:DS.bgCard,borderRadius:DS.radius,border:`1px solid ${DS.border}`,padding:14}}>
          <p style={{margin:"0 0 10px",fontSize:11,fontWeight:700,color:DS.textMut,textTransform:"uppercase",letterSpacing:1}}>2 · Customer & Children</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:8}}>
            <div>
              <p style={{margin:"0 0 6px",fontSize:11,color:DS.textSec}}>Customer type</p>
              <div style={{display:"flex",gap:6}}>
                {[{k:"lead",l:"New"},{k:"lapsed",l:"Lapsed"}].map(c=>(
                  <div key={c.k} onClick={()=>setCustType(c.k)} style={{flex:1,padding:"7px",borderRadius:DS.radiusSm,textAlign:"center",background:custType===c.k?DS.accentDim:DS.bgSurf,border:`1px solid ${custType===c.k?DS.accent:DS.border}`,cursor:"pointer",fontSize:12,fontWeight:600,color:custType===c.k?DS.accent:DS.textSec}}>{c.l}</div>
                ))}
              </div>
            </div>
            <div>
              <p style={{margin:"0 0 6px",fontSize:11,color:DS.textSec}}>Total children</p>
              <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                {[1,2,3,4,5,6,7,8,9,10].map(n=>(
                  <div key={n} onClick={()=>setNumKids(n)} style={{width:32,height:32,borderRadius:DS.radiusSm,display:"flex",alignItems:"center",justifyContent:"center",background:numKids===n?DS.accent:DS.bgSurf,border:`1px solid ${numKids===n?DS.accent:DS.border}`,cursor:"pointer",fontSize:13,fontWeight:700,color:numKids===n?"#fff":DS.textSec}}>{n}</div>
                ))}
              </div>
            </div>
          </div>
          <p style={{margin:0,fontSize:10,color:DS.textMut}}>Registration fee: {fmt(Math.min(numKids,2)*REG_FEE)} {numKids>2?"(2 children max — 3rd+ free)":""}</p>
        </div>
      )}

      {/* 3 — Enrollment Date */}
      {loc&&(
        <div style={{background:DS.bgCard,borderRadius:DS.radius,border:`1px solid ${DS.border}`,padding:14}}>
          <p style={{margin:"0 0 10px",fontSize:11,fontWeight:700,color:DS.textMut,textTransform:"uppercase",letterSpacing:1}}>3 · Start Date</p>
          <input type="date" value={enrollDate} onChange={e=>setEnrollDate(e.target.value)} style={{width:"100%"}}/>
          {enrollDate&&(()=>{
            const d=new Date(enrollDate+"T12:00:00"),after=d.getDate()>=BILLING_DAY;
            return <div style={{marginTop:8,padding:"7px 10px",borderRadius:DS.radiusSm,background:after?DS.amberDim:DS.greenDim,border:`1px solid ${after?DS.amber+"40":DS.green+"40"}`}}>
              <p style={{margin:0,fontSize:11,color:after?DS.amber:DS.green,fontWeight:600}}>
                {after?`⚡ On/after 20th — collect ${MONTHS[d.getMonth()]} + ${MONTHS[d.getMonth()===11?0:d.getMonth()+1]} today`:`✓ Before 20th — collect ${MONTHS[d.getMonth()]} remaining today only`}
              </p>
            </div>;
          })()}
        </div>
      )}

      {/* 4 — Groups */}
      {loc&&enrollDate&&(
        <div style={{background:DS.bgCard,borderRadius:DS.radius,border:`1px solid ${DS.border}`,padding:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div>
              <p style={{margin:0,fontSize:11,fontWeight:700,color:DS.textMut,textTransform:"uppercase",letterSpacing:1}}>4 · Lesson Groups</p>
              <p style={{margin:"3px 0 0",fontSize:10,color:totalAssigned!==numKids?DS.amber:DS.textMut}}>
                {totalAssigned} of {numKids} child{numKids>1?"ren":""} assigned{totalAssigned!==numKids?` — ${Math.abs(numKids-totalAssigned)} ${totalAssigned<numKids?"unassigned":"over"}`:` ✓`}
              </p>
            </div>
            <button onClick={addGroup} style={{padding:"5px 12px",borderRadius:DS.radiusSm,border:`1px solid ${DS.accent}`,background:DS.accentDim,color:DS.accent,cursor:"pointer",fontSize:11,fontWeight:600}}>+ Add Group</button>
          </div>

          {groups.map((g,gi)=>{
            const ti=ALL_TYPES.find(t=>t.key===g.type);
            const isCont=ti?.cat==="cont";
            const isFlat=!!ti?.flat;

            return (
              <div key={g.id} style={{background:DS.bgSurf,borderRadius:DS.radiusSm,border:`1px solid ${DS.border}`,padding:12,marginBottom:8}}>

                {/* Header: group label + kid count + remove */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <span style={{fontSize:12,fontWeight:700,color:DS.accent}}>Group {gi+1}</span>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:11,color:DS.textSec}}>Kids:</span>
                    <div style={{display:"flex",gap:4}}>
                      {[1,2,3,4,5,6,7,8,9,10].slice(0,Math.max(numKids,1)).map(n=>(
                        <div key={n} onClick={()=>updateGroup(g.id,"count",n)} style={{width:26,height:26,borderRadius:DS.radiusSm,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,cursor:"pointer",background:g.count===n?DS.accent:DS.bgHover,color:g.count===n?"#fff":DS.textMut,border:`1px solid ${g.count===n?DS.accent:DS.border}`}}>{n}</div>
                      ))}
                    </div>
                    {groups.length>1&&<button onClick={()=>removeGroup(g.id)} style={{background:"none",border:"none",color:DS.textMut,cursor:"pointer",fontSize:18,padding:"0 4px",lineHeight:1}}>×</button>}
                  </div>
                </div>

                {/* Lesson type */}
                <p style={{margin:"0 0 6px",fontSize:10,color:DS.textMut}}>Lesson type</p>
                <div style={{display:"flex",flexDirection:"column",gap:3,marginBottom:10}}>
                  {ALL_TYPES.filter(t=>getRate(t.priceKey)>0).map(t=>(
                    <div key={t.key} onClick={()=>{updateGroup(g.id,"type",t.key);updateGroup(g.id,"day2","");}} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 10px",borderRadius:DS.radiusSm,background:g.type===t.key?DS.accentDim:DS.bg,border:`1px solid ${g.type===t.key?DS.accent:DS.border}`,cursor:"pointer"}}>
                      <span style={{fontSize:11,fontWeight:600,color:g.type===t.key?DS.accent:DS.textSec}}>{t.label}</span>
                      <span style={{fontSize:12,fontWeight:700,color:g.type===t.key?DS.accent:DS.green}}>{fmt(getRate(t.priceKey,t.surcharge||0))}<span style={{fontSize:9,fontWeight:400,color:DS.textMut}}>{t.flat?"/session":"/class"}</span></span>
                    </div>
                  ))}
                </div>

                {/* Day picker */}
                {!isFlat&&(
                  <>
                    <p style={{margin:"0 0 6px",fontSize:10,color:DS.textMut}}>Class day</p>
                    <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:isCont&&ti?.isGroup?8:0}}>
                      {DAYS_SHORT.map((d,i)=>(
                        <div key={i} onClick={()=>{updateGroup(g.id,"day1",String(i));if(String(i)===g.day2)updateGroup(g.id,"day2","");}} style={{padding:"5px 9px",borderRadius:DS.radiusSm,background:g.day1===String(i)?DS.accent:DS.bgHover,border:`1px solid ${g.day1===String(i)?DS.accent:DS.border}`,cursor:"pointer",fontSize:11,fontWeight:600,color:g.day1===String(i)?"#fff":DS.textSec}}>{d}</div>
                      ))}
                    </div>
                    {isCont&&ti?.isGroup&&g.day1!==""&&(
                      <>
                        <p style={{margin:"6px 0 6px",fontSize:10,color:DS.textMut}}>2nd day <span style={{color:DS.amber}}>−10%</span> (optional)</p>
                        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                          <div onClick={()=>updateGroup(g.id,"day2","")} style={{padding:"5px 9px",borderRadius:DS.radiusSm,background:g.day2===""?DS.bgHover:DS.bgSurf,border:`1px solid ${DS.border}`,cursor:"pointer",fontSize:11,color:DS.textMut}}>None</div>
                          {DAYS_SHORT.map((d,i)=>String(i)!==g.day1&&(
                            <div key={i} onClick={()=>updateGroup(g.id,"day2",String(i))} style={{padding:"5px 9px",borderRadius:DS.radiusSm,background:g.day2===String(i)?DS.amber:DS.bgHover,border:`1px solid ${g.day2===String(i)?DS.amber:DS.border}`,cursor:"pointer",fontSize:11,fontWeight:600,color:g.day2===String(i)?"#fff":DS.textSec}}>{d}</div>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* Session qty for flat types */}
                {isFlat&&(
                  <>
                    <p style={{margin:"0 0 6px",fontSize:10,color:DS.textMut}}>Sessions</p>
                    <div style={{display:"flex",gap:4}}>
                      {[1,2,3,4,5].map(n=>(
                        <div key={n} onClick={()=>updateGroup(g.id,"qty",n)} style={{width:32,height:32,borderRadius:DS.radiusSm,display:"flex",alignItems:"center",justifyContent:"center",background:g.qty===n?DS.accentDim:DS.bgHover,border:`1px solid ${g.qty===n?DS.accent:DS.border}`,cursor:"pointer",fontSize:12,fontWeight:700,color:g.qty===n?DS.accent:DS.textSec}}>{n}</div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 5 — Promos */}
      {loc&&enrollDate&&eligiblePromos.length>0&&(
        <div style={{background:DS.bgCard,borderRadius:DS.radius,border:`1px solid ${DS.border}`,padding:14}}>
          <p style={{margin:"0 0 10px",fontSize:11,fontWeight:700,color:DS.textMut,textTransform:"uppercase",letterSpacing:1}}>5 · Promotions</p>
          {eligiblePromos.map(p=>{
            const checked=promoChecked.includes(p.code);
            const dtype=p.discount_type||(p.discount_fixed?"fixed":"pct");
            return (
              <div key={p.code} onClick={()=>setPromoChecked(pc=>checked?pc.filter(c=>c!==p.code):[...pc,p.code])} style={{display:"flex",gap:10,padding:"9px 10px",borderRadius:DS.radiusSm,background:checked?DS.accentDim:DS.bgSurf,border:`1px solid ${checked?DS.accent:DS.border}`,cursor:"pointer",marginBottom:6}}>
                <div style={{width:16,height:16,borderRadius:4,background:checked?DS.accent:DS.bgHover,border:`2px solid ${checked?DS.accent:DS.border}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:2}}>
                  {checked&&<span style={{fontSize:9,color:"#fff"}}>✓</span>}
                </div>
                <div>
                  <p style={{margin:"0 0 1px",fontSize:12,fontWeight:600,color:DS.textPri}}>{p.title}{p.requires_mention&&<span style={{fontSize:9,color:DS.amber}}> · customer must mention</span>}</p>
                  <p style={{margin:0,fontSize:10,color:DS.textSec}}>{dtype==="pct"?`${p.discount_pct}% off${p.one_class_only?" (1st class only)":""}${p.first_month_only?" (1st month only)":""}`:
                   `$${p.discount_fixed} off`}{p.location_restriction?` · ${p.location_restriction} only`:""}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Result */}
      {result&&(
        <div style={{background:DS.bgCard,borderRadius:DS.radius,border:`1px solid ${DS.accent}40`,padding:14}}>
          <p style={{margin:"0 0 12px",fontSize:11,fontWeight:700,color:DS.textMut,textTransform:"uppercase",letterSpacing:1}}>Quote Summary</p>

          <div style={{background:DS.bgSurf,borderRadius:DS.radiusSm,padding:"10px 12px",marginBottom:8}}>
            <p style={{margin:"0 0 8px",fontSize:12,fontWeight:700,color:DS.textPri}}>Due today — {result.currentMonthName}</p>

            {result.groupResults.map(({g,r},i)=>(
              <div key={g.id} style={{marginBottom:8,paddingBottom:8,borderBottom:i<result.groupResults.length-1?`1px solid ${DS.border}`:"none"}}>
                <p style={{margin:"0 0 3px",fontSize:11,fontWeight:600,color:DS.textSec}}>
                  Group {groups.findIndex(x=>x.id===g.id)+1} · {g.count} child{g.count>1?"ren":""} · {r.ti.label}
                  {r.sibMult<1&&<span style={{color:DS.amber,fontSize:10}}> · −10% sibling</span>}
                </p>
                {!r.isFlat&&r.counts.c1c>0&&(
                  <p style={{margin:"0 0 2px",fontSize:10,color:DS.textMut}}>
                    {r.counts.c1c} {DAYS_SHORT[parseInt(g.day1)]} class{r.counts.c1c!==1?"es":""}
                    {r.d2&&r.counts.c2c>0?` + ${r.counts.c2c} ${DAYS_SHORT[parseInt(r.d2)]} class${r.counts.c2c!==1?"es":""}`:""} @ {fmt(r.rate)}{r.d2?` / ${fmt(r.rate2)}`:""}
                  </p>
                )}
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <span style={{fontSize:11,color:DS.textMut}}>{fmt(r.perKid_curr)} × {g.count} child{g.count>1?"ren":""}</span>
                  <span style={{fontSize:11,fontWeight:700,color:DS.textPri}}>{fmt(r.total_curr)}</span>
                </div>
              </div>
            ))}

            {!result.isBeforeBilling&&result.total_next>0&&(
              <div style={{borderTop:`1px solid ${DS.amber}40`,paddingTop:8,marginTop:4,marginBottom:8}}>
                <p style={{margin:"0 0 6px",fontSize:11,fontWeight:700,color:DS.amber}}>{result.nextMonthName} (past billing date)</p>
                {result.groupResults.map(({g,r})=>(
                  <div key={g.id} style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                    <span style={{fontSize:11,color:DS.textMut}}>Group {groups.findIndex(x=>x.id===g.id)+1} · {g.count} child{g.count>1?"ren":""}</span>
                    <span style={{fontSize:11,fontWeight:600,color:DS.amber}}>{fmt(r.total_next)}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{borderTop:`1px solid ${DS.border}`,paddingTop:8,marginTop:4}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <span style={{fontSize:11,color:DS.textMut}}>Registration fee ({Math.min(numKids,2)} child{Math.min(numKids,2)>1?"ren":""}{numKids>2?" · 3rd+ free":""})</span>
                <span style={{fontSize:11,color:DS.textMut}}>{fmt(result.regFeeTotal)}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <span style={{fontSize:13,fontWeight:700,color:DS.textPri}}>Total due today</span>
                <span style={{fontSize:18,fontWeight:800,color:DS.accent}}>{fmt(result.today_amount)}</span>
              </div>
            </div>
          </div>

          {result.isBeforeBilling&&result.auto_amount>0&&(
            <div style={{background:DS.bgSurf,borderRadius:DS.radiusSm,padding:"10px 12px",marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <p style={{margin:"0 0 2px",fontSize:11,fontWeight:700,color:DS.textSec}}>Auto-billed on {result.billingDate}</p>
                  <p style={{margin:0,fontSize:11,color:DS.textMut}}>{result.nextMonthName} · {numKids} child{numKids>1?"ren":""}</p>
                </div>
                <span style={{fontSize:15,fontWeight:700,color:DS.textPri}}>{fmt(result.auto_amount)}</span>
              </div>
            </div>
          )}

          {/* Script preview */}
          <div style={{background:DS.bgSurf,borderRadius:DS.radiusSm,padding:"12px 14px",marginBottom:8,border:`1px solid ${DS.border}`}}>
            <p style={{margin:"0 0 8px",fontSize:10,fontWeight:700,color:DS.textMut,textTransform:"uppercase",letterSpacing:1}}>Rep Script</p>
            <p style={{margin:0,fontSize:12,color:DS.textSec,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{buildScript()}</p>
          </div>

          <button onClick={copyScript} style={{width:"100%",padding:"10px",borderRadius:DS.radiusSm,border:"none",background:copied?DS.green:DS.accent,color:"#fff",cursor:"pointer",fontSize:12,fontWeight:700}}>
            {copied?"✓ Copied!":"📋 Copy Rep Script"}
          </button>
        </div>
      )}
    </div>
  );
}







// ── REMINDERS TAB ─────────────────────────────────────────────────────
const CHECKLIST_ITEMS = [
  {id:"loc",   cat:"📍 Location",      text:"Confirmed correct location with customer"},
  {id:"nomu",  cat:"📍 Location",      text:"Class is NOT marked Makeup Only"},
  {id:"ptype", cat:"🎯 Promo Code",    text:"Promo applied to TUITION only (not reg fee, ODL, or clinic)"},
  {id:"pmont", cat:"🎯 Promo Code",    text:"Month-specific promo applied to THAT month only (not multiple)"},
  {id:"pone",  cat:"🎯 Promo Code",    text:"Only ONE promo per charge"},
  {id:"pcode", cat:"🎯 Promo Code",    text:"Not using a site-only promo code"},
  {id:"sib3",  cat:"👶 Sibling Disc.", text:"Sibling discount = first FULL 3 months (not partial first month)"},
  {id:"sibauto",cat:"👶 Sibling Disc.","text":"NOT manually applied at Gig Harbor, Henderson, or Olympia"},
  {id:"sibtype",cat:"👶 Sibling Disc.","text":"NOT applied to clinics or ODLs — continuous classes only"},
  {id:"asof",  cat:"💳 Charges",       text:"As Of Date set to 1st of each future month"},
  {id:"ccat",  cat:"💳 Charges",       text:"Charge Category = Tuition - [Month Year] (NOT Clinic/Parent Portal)"},
  {id:"pay",   cat:"💳 Charges",       text:"Card on file OR payment collected today"},
  {id:"hs",    cat:"🔗 HubSpot",       text:'If no payment: "Enrolled - Did Not Collect Payment" selected in HubSpot'},
  {id:"log",   cat:"🔗 HubSpot",       text:"Call logged with correct DNR/outcome reason"},
  {id:"stage", cat:"🔗 HubSpot",       text:"Deal stage updated correctly (Trial vs Registration)"},
  {id:"odlu",  cat:"📅 ODLs",         text:"$5 ODL upcharge quoted to customer"},
  {id:"odlslot",cat:"📅 ODLs",        text:"ODL scheduled in regular class slot (NOT clinic slot)"},
];

function RemindersTab({alerts, isManager, onAdd, onEdit}) {
  const [checked, setChecked] = useState({});
  const [openCat, setOpenCat] = useState(null);
  const toggle = (id) => setChecked(p=>({...p,[id]:!p[id]}));
  const resetChecklist = () => setChecked({});
  const doneCount = Object.values(checked).filter(Boolean).length;
  const totalCount = CHECKLIST_ITEMS.length;

  // Group alerts by category
  const alertsByCat = (alerts||[]).reduce((acc,a)=>{
    if(!acc[a.category]) acc[a.category]=[];
    acc[a.category].push(a);
    return acc;
  },{});

  const typeColors = {
    error:  {bg:DS.redDim,   border:DS.red+"40",   icon:"🚨", text:DS.red},
    warning:{bg:DS.amberDim, border:DS.amber+"40", icon:"⚠️", text:DS.amber},
    info:   {bg:DS.accentDim,border:DS.accent+"40",icon:"ℹ️", text:DS.accent},
  };

  return (
    <div>
      {/* ENROLLMENT CHECKLIST */}
      <div style={{background:DS.bgCard,borderRadius:14,border:`1px solid ${DS.border}`,overflow:"hidden",marginBottom:14}}>
        <div style={{background:DS.accent,padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <p style={{margin:0,fontSize:10,color:"rgba(255,255,255,.6)",letterSpacing:1.5,textTransform:"uppercase"}}>Before you submit</p>
            <p style={{margin:"2px 0 0",fontSize:15,fontWeight:700,color:"#fff"}}>📋 Enrollment Checklist</p>
          </div>
          <div style={{textAlign:"right"}}>
            <p style={{margin:0,fontSize:18,fontWeight:800,color:doneCount===totalCount?"#2ecc71":"#fff"}}>{doneCount}/{totalCount}</p>
            {doneCount===totalCount&&<p style={{margin:0,fontSize:10,color:"#2ecc71",fontWeight:700}}>ALL CLEAR ✓</p>}
          </div>
        </div>
        {/* Progress bar */}
        <div style={{height:4,background:DS.bgSurf}}>
          <div style={{width:`${(doneCount/totalCount)*100}%`,height:"100%",background:doneCount===totalCount?"#2ecc71":"#003087",transition:"width .3s"}}/>
        </div>
        <div style={{padding:"12px 14px"}}>
          {/* Group by category */}
          {Object.entries(CHECKLIST_ITEMS.reduce((acc,item)=>{
            if(!acc[item.cat]) acc[item.cat]=[];
            acc[item.cat].push(item);
            return acc;
          },{})).map(([cat,items])=>(
            <div key={cat} style={{marginBottom:10}}>
              <p style={{margin:"0 0 6px",fontSize:11,fontWeight:700,color:DS.textSec,letterSpacing:.3}}>{cat}</p>
              {items.map(item=>(
                <div key={item.id} onClick={()=>toggle(item.id)}
                  style={{display:"flex",alignItems:"flex-start",gap:10,padding:"8px 10px",borderRadius:9,cursor:"pointer",background:checked[item.id]?DS.greenDim:DS.bgSurf,border:`1px solid ${checked[item.id]?DS.green+"40":DS.border}`,marginBottom:5,transition:"all .15s"}}>
                  <div style={{width:20,height:20,borderRadius:5,border:`2px solid ${checked[item.id]?DS.green:DS.textMut}`,background:checked[item.id]?DS.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1,transition:"all .15s"}}>
                    {checked[item.id]&&<span style={{fontSize:12,color:"#fff",fontWeight:800}}>✓</span>}
                  </div>
                  <p style={{margin:0,fontSize:12,color:checked[item.id]?DS.green:DS.textSec,lineHeight:1.5,textDecoration:checked[item.id]?"line-through":"none",transition:"all .15s"}}>{item.text}</p>
                </div>
              ))}
            </div>
          ))}
          <button onClick={resetChecklist} style={{width:"100%",padding:"9px",borderRadius:9,border:`1px solid ${DS.border}`,background:DS.bgSurf,cursor:"pointer",fontSize:12,color:DS.textSec,marginTop:4,fontWeight:500}}>
            ↺ Reset for next customer
          </button>
        </div>
      </div>

      {/* RULES REFERENCE */}
      <div style={{marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <p style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:DS.red,margin:0,fontWeight:700}}>⚠️ Common Mistakes — Rules</p>
          {isManager&&<button onClick={onAdd} style={{padding:"6px 14px",borderRadius:8,border:"none",background:DS.accent,color:"#fff",cursor:"pointer",fontSize:12,fontWeight:600,flexShrink:0,position:"relative",zIndex:2}}>+ Add Reminder</button>}
        </div>
        {Object.entries(alertsByCat).map(([cat,catAlerts])=>(
          <div key={cat} style={{marginBottom:12}}>
            <button onClick={()=>setOpenCat(openCat===cat?null:cat)}
              style={{width:"100%",padding:"10px 14px",borderRadius:10,border:`1px solid ${DS.border}`,background:DS.bgSurf,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:openCat===cat?8:0}}>
              <span style={{fontSize:13,fontWeight:600,color:DS.textPri}}>{cat}</span>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:10,background:DS.bg,color:DS.textSec,padding:"2px 7px",borderRadius:10}}>{catAlerts.length} rules</span>
                <span style={{fontSize:14,color:DS.textMut}}>{openCat===cat?"▲":"▼"}</span>
              </div>
            </button>
            {openCat===cat&&catAlerts.map((a,i)=>{
              const style = typeColors[a.alert_type]||typeColors.warning;
              return (
                <div key={i} style={{background:style.bg,border:`1.5px solid ${style.border}`,borderRadius:10,padding:"11px 14px",marginBottom:7,display:"flex",gap:10,alignItems:"flex-start"}}>
                  <span style={{fontSize:16,flexShrink:0}}>{style.icon}</span>
                  <div style={{flex:1}}>
                    <p style={{margin:"0 0 3px",fontWeight:700,fontSize:13,color:style.text}}>{a.title}</p>
                    <p style={{margin:0,fontSize:12,color:DS.textSec,lineHeight:1.6}}>{a.body}</p>
                  </div>
                  {isManager&&<button onClick={()=>onEdit(a)} style={{padding:"3px 8px",borderRadius:6,border:`1px solid ${DS.border}`,background:DS.bgSurf,cursor:"pointer",fontSize:10,color:DS.textSec,flexShrink:0}}>Edit</button>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── HUB ALERT MODAL ───────────────────────────────────────────────────
function HubAlertModal({item,onClose,onSave,onDelete}) {
  const [f,setF]=useState({title:item?.title||"",body:item?.body||"",category:item?.category||"General",alert_type:item?.alert_type||"warning",id:item?.id});
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const cats=["Promos","Sibling Discount","Charges","Location","HubSpot","ODLs","General"];
  return (
    <Modal title={item?"Edit Reminder":"Add Reminder"} sub="REMINDER" onClose={onClose} wide>
      <div style={{display:"flex",flexDirection:"column",gap:11}}>
        <div><label style={{fontSize:12,color:DS.textSec,display:"block",marginBottom:3}}>Title</label><input value={f.title} onChange={e=>set("title",e.target.value)} style={{width:"100%",padding:"9px 11px",borderRadius:9,border:`1px solid ${DS.border}`,fontSize:13,outline:"none"}}/></div>
        <div><label style={{fontSize:12,color:DS.textSec,display:"block",marginBottom:3}}>Description</label><textarea value={f.body} onChange={e=>set("body",e.target.value)} rows={3} style={{width:"100%",padding:"9px 11px",borderRadius:9,border:`1px solid ${DS.border}`,fontSize:12,outline:"none",resize:"vertical",lineHeight:1.6,fontFamily:"inherit"}}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><label style={{fontSize:12,color:DS.textSec,display:"block",marginBottom:3}}>Category</label>
            <select value={f.category} onChange={e=>set("category",e.target.value)} style={{width:"100%",padding:"9px 11px",borderRadius:9,border:`1px solid ${DS.border}`,fontSize:13,outline:"none",background:DS.bgCard}}>
              {cats.map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          <div><label style={{fontSize:12,color:DS.textSec,display:"block",marginBottom:3}}>Type</label>
            <select value={f.alert_type} onChange={e=>set("alert_type",e.target.value)} style={{width:"100%",padding:"9px 11px",borderRadius:9,border:`1px solid ${DS.border}`,fontSize:13,outline:"none",background:DS.bgCard}}>
              <option value="error">🚨 Error (red)</option>
              <option value="warning">⚠️ Warning (amber)</option>
              <option value="info">ℹ️ Info (blue)</option>
            </select>
          </div>
        </div>
        <div style={{display:"flex",gap:8,marginTop:4}}>
          {item&&<Btn label="Remove" onClick={()=>onDelete(item.id)} color="#e74c3c" small/>}
          <div style={{flex:1}}/>
          <Btn label="Cancel" onClick={onClose} outline color="#888" small/>
          <Btn label="Save Reminder" onClick={()=>onSave(f)} color="#c0392b" small/>
        </div>
      </div>
    </Modal>
  );
}

// ── MGR: SUBMISSION QUEUE ─────────────────────────────────────────────
function MgrSubmissions({ submissions=[], reload, fire, currentUser, settings={} }) {
  const [filter, setFilter] = useState("pending");
  const [flags, setFlags] = useState([]);
  const [flagFilter, setFlagFilter] = useState("open");
  const [activeSection, setActiveSection] = useState("submissions");
  const TYPE_LABELS = {promo:"🎯 Promo",closure:"🚫 Closure",location:"📍 Location",pricing:"💰 Pricing",alert:"🔔 Reminder"};
  const FLAG_TYPE_LABELS = {pricing:"💰 Pricing",location:"📍 Location",promo:"🎯 Promo",closure:"🚫 Closure",reminder:"🔔 Reminder",other:"📋 Other"};
  const ping = makePinger(settings.notif_prefs||{}, settings.execo_webhook);

  useEffect(()=>{
    sb("hub_flags?order=submitted_at.desc").then(r=>setFlags(r||[])).catch(()=>{});
  },[]);

  const resolveFlag = async (flag, action) => {
    await sbPatch("hub_flags", flag.id, {
      status: action,
      reviewed_by: currentUser?.display_name||"Manager",
      reviewed_at: new Date().toISOString()
    });
    setFlags(f=>f.map(fl=>fl.id===flag.id?{...fl,status:action}:fl));
    fire("approved", action==="resolved"?"Flag marked resolved":"Flag dismissed");
  };

  const filtered = submissions.filter(s=>filter==="all"||s.status===filter);

  const approve = async (s) => {
    const p = s.payload;
    try {
      if(s.type==="promo"){
        if(p.id) await sbPatch("hub_promos",p.id,p); else await sbPost("hub_promos",{...p,active:true});
        ping.main("hub_promo",`🎯 *New promo added to the Hub!* "${p.title}"${p.code?` — Code: \`${p.code}\``:""}. Check the Hub for details.`);
      } else if(s.type==="closure"){
        await sbPost("hub_closures",p);
        ping.main("hub_closure",`🚫 *School closure:* ${p.location_name} — ${p.start_date} to ${p.end_date}. ${p.reason}`);
      } else if(s.type==="location"){
        await sbPatch("hub_locations",p.id,p);
        ping.main("hub_location",`📍 *Location updated:* ${p.name} — check the Hub for latest details.`);
      } else if(s.type==="pricing"){
        const updates={};
        ["price_mf","price_ss","price_priv","price_semi","price_priv20","price_odl",
         "price_odl_ss","price_clinic","price_st_mf","price_st_ss","price_adaptive","reg_fee"
        ].forEach(k=>{ if(p[k]!==""&&p[k]!=null) updates[k]=parseFloat(p[k]); });
        await sbPatch("hub_locations",p.id,updates);
        ping.main("hub_pricing",`💰 *Pricing updated:* ${p.name} — new rates now live in the calculator.`);
      } else if(s.type==="alert"){
        await sbPost("hub_alerts",{...p,active:true,sort_order:0});
        ping.main("hub_alert",`🔔 *New reminder:* "${p.title}" — ${p.body}`);
      }
      await sbPatch("hub_submissions",s.id,{status:"approved",reviewed_by:currentUser?.display_name||"Manager",reviewed_at:new Date().toISOString()});
      fire("approved","Submission approved and published ✅");
      reload();
    } catch(e) { fire("declined","Error applying submission"); }
  };

  const reject = async (s) => {
    await sbPatch("hub_submissions",s.id,{status:"rejected",reviewed_by:currentUser?.display_name||"Manager",reviewed_at:new Date().toISOString()});
    fire("info","Submission rejected");
    reload();
  };

  return (
    <div style={{marginTop:16}}>
      {/* Section toggle */}
      <div style={{display:"flex",gap:6,marginBottom:14}}>
        {[
          {k:"submissions", l:`🏊 Client Submissions${submissions.filter(s=>s.status==="pending").length>0?` (${submissions.filter(s=>s.status==="pending").length})`:""}`},
          {k:"flags",       l:`🚩 Team Lead Flags${flags.filter(f=>f.status==="open").length>0?` (${flags.filter(f=>f.status==="open").length})`:""}`},
        ].map(s=>(
          <button key={s.k} onClick={()=>setActiveSection(s.k)} style={{padding:"7px 16px",borderRadius:DS.radiusSm,border:`1px solid ${activeSection===s.k?DS.accent:DS.border}`,background:activeSection===s.k?DS.accentDim:"transparent",color:activeSection===s.k?DS.accent:DS.textSec,cursor:"pointer",fontSize:12,fontWeight:activeSection===s.k?600:400}}>
            {s.l}
          </button>
        ))}
      </div>

      {/* SUBMISSIONS */}
      {activeSection==="submissions"&&<>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <p style={{margin:0,fontSize:13,fontWeight:700,color:DS.textPri}}>🏊 Hub Submission Queue</p>
          <div style={{display:"flex",gap:6}}>
            {["pending","approved","rejected","all"].map(f=>(
              <button key={f} onClick={()=>setFilter(f)} style={{padding:"5px 12px",borderRadius:8,border:`1px solid ${filter===f?DS.accent:DS.border}`,background:filter===f?DS.accentDim:"transparent",color:filter===f?DS.accent:DS.textSec,cursor:"pointer",fontSize:11,fontWeight:600,textTransform:"capitalize"}}>{f}</button>
            ))}
          </div>
        </div>

      {filtered.length===0&&<div style={{background:DS.bgCard,borderRadius:12,border:`1px solid ${DS.border}`,padding:"28px",textAlign:"center"}}><p style={{fontSize:20,margin:"0 0 6px"}}>✅</p><p style={{fontSize:13,color:DS.textMut}}>No {filter} submissions</p></div>}

      {filtered.map(s=>(
        <div key={s.id} style={{background:DS.bgCard,borderRadius:12,border:`1.5px solid ${s.urgent?"#e74c3c":"#efefef"}`,padding:"14px",marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <span style={{fontSize:12,fontWeight:700,color:DS.accent}}>{TYPE_LABELS[s.type]||s.type}</span>
              {s.urgent&&<span style={{fontSize:10,background:DS.redDim,color:DS.red,padding:"2px 8px",borderRadius:4,fontWeight:700}}>🚨 URGENT</span>}
              <span style={{fontSize:11,color:DS.textMut}}>{new Date(s.submitted_at).toLocaleString()}</span>
            </div>
            <span style={{fontSize:11,fontWeight:600,color:s.status==="pending"?"#b85c00":s.status==="approved"?"#1a5c35":"#c0392b",background:s.status==="pending"?"#fff8ee":s.status==="approved"?"#eafaf1":"#fdf0ee",padding:"2px 8px",borderRadius:4}}>{s.status}</span>
          </div>
          <div style={{background:DS.bgSurf,borderRadius:8,padding:"10px 12px",marginBottom:10,fontSize:12,color:DS.textSec}}>
            <p style={{margin:"0 0 4px",fontWeight:600}}>{s.payload.title||s.payload.location_name||s.payload.name||"Update"}</p>
            {s.payload.rules&&<p style={{margin:"0 0 2px",color:DS.textSec}}>{s.payload.rules}</p>}
            {s.payload.reason&&<p style={{margin:"0 0 2px",color:DS.textSec}}>{s.payload.reason}</p>}
            {s.payload.body&&<p style={{margin:"0 0 2px",color:DS.textSec}}>{s.payload.body}</p>}
            {s.payload.code&&<p style={{margin:"0 0 2px",color:DS.accent,fontWeight:600}}>Code: {s.payload.code}</p>}
            {s.payload.expires_on&&<p style={{margin:"0 0 2px",color:DS.textSec}}>Expires: {s.payload.expires_on}</p>}
          </div>
          <p style={{margin:"0 0 8px",fontSize:11,color:DS.textMut}}>Submitted by: {s.submitted_by}</p>
          {s.reviewed_by&&<p style={{margin:"0 0 8px",fontSize:11,color:DS.textMut}}>Reviewed by: {s.reviewed_by}</p>}
          {s.status==="pending"&&(
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>approve(s)} style={{flex:1,padding:"9px",borderRadius:9,background:"#1a5c35",color:"#fff",border:"none",cursor:"pointer",fontSize:12,fontWeight:700}}>✅ Approve & Publish</button>
              <button onClick={()=>reject(s)} style={{padding:"9px 16px",borderRadius:9,background:DS.redDim,color:DS.red,border:"1.5px solid #c0392b",cursor:"pointer",fontSize:12,fontWeight:700}}>Reject</button>
            </div>
          )}
        </div>
      ))}
      </>}

      {/* FLAGS */}
      {activeSection==="flags"&&<>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <p style={{margin:0,fontSize:13,fontWeight:700,color:DS.textPri}}>🚩 Team Lead Flags</p>
          <div style={{display:"flex",gap:6}}>
            {["open","resolved","dismissed","all"].map(f=>(
              <button key={f} onClick={()=>setFlagFilter(f)} style={{padding:"5px 12px",borderRadius:8,border:`1px solid ${flagFilter===f?DS.accent:DS.border}`,background:flagFilter===f?DS.accentDim:"transparent",color:flagFilter===f?DS.accent:DS.textSec,cursor:"pointer",fontSize:11,fontWeight:600,textTransform:"capitalize"}}>{f}</button>
            ))}
          </div>
        </div>

        {flags.filter(f=>flagFilter==="all"||f.status===flagFilter).length===0&&(
          <div style={{background:DS.bgCard,borderRadius:12,border:`1px solid ${DS.border}`,padding:"28px",textAlign:"center"}}>
            <p style={{fontSize:20,margin:"0 0 6px"}}>✅</p>
            <p style={{fontSize:13,color:DS.textMut}}>No {flagFilter} flags</p>
          </div>
        )}

        {flags.filter(f=>flagFilter==="all"||f.status===flagFilter).map(flag=>(
          <div key={flag.id} style={{background:DS.bgCard,borderRadius:12,border:`1px solid ${flag.status==="open"?DS.amber+"40":DS.border}`,padding:"14px",marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <span style={{fontSize:12,fontWeight:700,color:DS.amber}}>{FLAG_TYPE_LABELS[flag.type]||flag.type}</span>
                <span style={{fontSize:11,color:DS.textMut}}>by {flag.submitted_by} · {new Date(flag.submitted_at).toLocaleString()}</span>
              </div>
              <span style={{fontSize:10,fontWeight:600,color:flag.status==="open"?DS.amber:flag.status==="resolved"?DS.green:DS.textMut,background:flag.status==="open"?DS.amberDim:flag.status==="resolved"?DS.greenDim:DS.bgSurf,padding:"2px 8px",borderRadius:4,textTransform:"uppercase"}}>{flag.status}</span>
            </div>
            <p style={{margin:"0 0 4px",fontSize:13,fontWeight:600,color:DS.textPri}}>{flag.title}</p>
            <p style={{margin:"0 0 10px",fontSize:12,color:DS.textSec,lineHeight:1.5}}>{flag.description}</p>
            {flag.status==="open"&&(
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>resolveFlag(flag,"resolved")} style={{padding:"6px 14px",borderRadius:DS.radiusSm,border:"none",background:DS.green,color:"#fff",cursor:"pointer",fontSize:11,fontWeight:600}}>✓ Mark Resolved</button>
                <button onClick={()=>resolveFlag(flag,"dismissed")} style={{padding:"6px 14px",borderRadius:DS.radiusSm,border:`1px solid ${DS.border}`,background:"transparent",color:DS.textMut,cursor:"pointer",fontSize:11}}>Dismiss</button>
              </div>
            )}
            {flag.reviewed_by&&<p style={{margin:"8px 0 0",fontSize:10,color:DS.textMut}}>{flag.status} by {flag.reviewed_by} · {new Date(flag.reviewed_at).toLocaleString()}</p>}
          </div>
        ))}
      </>}
    </div>
  );
}

// ── MGR: USERS & ROLES ────────────────────────────────────────────────
function MgrUsers({ reload, fire }) {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({username:"",pin:"",role:"client",display_name:""});
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    sb("app_users?order=created_at").then(u=>{setUsers(u||[]);setLoading(false);}).catch(()=>setLoading(false));
  },[]);

  const save = async () => {
    if(!form.username||!form.pin){fire("declined","Username and PIN required");return;}
    await sbPost("app_users",{...form,updated_at:new Date().toISOString()});
    fire("approved","User added");
    setForm({username:"",pin:"",role:"client",display_name:""});
    const u=await sb("app_users?order=created_at").catch(()=>[]);
    setUsers(u||[]);
    reload();
  };

  const remove = async (id) => {
    if(!window.confirm("Remove this user?")) return;
    await sbDel("app_users",id);
    const u=await sb("app_users?order=created_at").catch(()=>[]);
    setUsers(u||[]);
    fire("info","User removed");
    reload();
  };

  const ROLE_COLORS = {management:{bg:"#eafaf1",fg:"#1a5c35"},client:{bg:"#e8f0fe",fg:"#003087"}};

  return (
    <div style={{marginTop:16}}>
      <p style={{margin:"0 0 12px",fontSize:14,fontWeight:700,color:DS.textPri}}>👥 Users & Roles</p>

      {/* Add user form */}
      <div style={{background:DS.bgCard,borderRadius:12,border:`1px solid ${DS.border}`,padding:"16px",marginBottom:16}}>
        <p style={{margin:"0 0 12px",fontSize:12,fontWeight:700,color:DS.textSec,textTransform:"uppercase",letterSpacing:.5}}>Add User</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
          <div>
            <label style={{fontSize:11,color:DS.textSec,display:"block",marginBottom:4}}>Display Name</label>
            <input value={form.display_name} onChange={e=>setForm({...form,display_name:e.target.value})} placeholder="e.g. Andrea Johnson"
              style={{width:"100%",boxSizing:"border-box",padding:"9px 12px",borderRadius:9,border:`1px solid ${DS.border}`,fontSize:13,outline:"none"}}/>
          </div>
          <div>
            <label style={{fontSize:11,color:DS.textSec,display:"block",marginBottom:4}}>Username</label>
            <input value={form.username} onChange={e=>setForm({...form,username:e.target.value.toLowerCase()})} placeholder="e.g. emler"
              style={{width:"100%",boxSizing:"border-box",padding:"9px 12px",borderRadius:9,border:`1px solid ${DS.border}`,fontSize:13,outline:"none"}}/>
          </div>
          <div>
            <label style={{fontSize:11,color:DS.textSec,display:"block",marginBottom:4}}>PIN</label>
            <input type="password" value={form.pin} onChange={e=>setForm({...form,pin:e.target.value})} placeholder="Set a PIN"
              style={{width:"100%",boxSizing:"border-box",padding:"9px 12px",borderRadius:9,border:`1px solid ${DS.border}`,fontSize:13,outline:"none"}}/>
          </div>
          <div>
            <label style={{fontSize:11,color:DS.textSec,display:"block",marginBottom:4}}>Role</label>
            <select value={form.role} onChange={e=>setForm({...form,role:e.target.value})} style={{width:"100%",padding:"9px 12px",borderRadius:9,border:`1px solid ${DS.border}`,fontSize:13,outline:"none",background:DS.bgCard}}>
              <option value="client">🏊 Client (Hub content only)</option>
              <option value="team_lead">◇ Team Lead (Team view + flag issues)</option>
              <option value="management">🎛️ Management (Full access)</option>
            </select>
          </div>
        </div>
        <Btn label="Add User" onClick={save} color="#003087"/>
      </div>

      {/* User list */}
      {loading?<p style={{textAlign:"center",color:DS.textMut,fontSize:13}}>Loading…</p>:users.map(u=>(
        <div key={u.id} style={{background:DS.bgCard,borderRadius:12,border:`1px solid ${DS.border}`,padding:"12px 14px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <div style={{width:36,height:36,borderRadius:"50%",background:(ROLE_COLORS[u.role]||{bg:"#eee"}).bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>
              {u.role==="management"?"🎛️":"🏊"}
            </div>
            <div>
              <p style={{margin:0,fontWeight:700,fontSize:13,color:DS.textPri}}>{u.display_name||u.username}</p>
              <p style={{margin:0,fontSize:11,color:DS.textMut}}>@{u.username} · <span style={{color:(ROLE_COLORS[u.role]||{fg:"#888"}).fg,fontWeight:600}}>{u.role}</span></p>
            </div>
          </div>
          <button onClick={()=>remove(u.id)} style={{padding:"5px 12px",borderRadius:8,background:DS.redDim,border:"1.5px solid #c0392b",color:DS.red,cursor:"pointer",fontSize:11,fontWeight:600}}>Remove</button>
        </div>
      ))}
    </div>
  );
}

// ── CLIENT VIEW (Emler) ───────────────────────────────────────────────
// ── TEAM LEAD VIEW ────────────────────────────────────────────────────
function FlagModal({ currentUser, onClose }) {
  const [type, setType] = useState("pricing");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const FLAG_TYPES = [
    {k:"pricing",    l:"💰 Pricing"},
    {k:"location",   l:"📍 Location"},
    {k:"promo",      l:"🎯 Promo"},
    {k:"closure",    l:"🚫 Closure"},
    {k:"reminder",   l:"🔔 Reminder"},
    {k:"other",      l:"📋 Other"},
  ];

  const submit = async () => {
    if(!title.trim()||!description.trim()) return;
    setSubmitting(true);
    await sbPost("hub_flags",{
      type, title, description,
      submitted_by: currentUser?.display_name||currentUser?.username||"Team Lead",
      status:"open"
    });
    setDone(true);
    setSubmitting(false);
    setTimeout(onClose, 1500);
  };

  return (
    <Modal title="Flag an Issue" sub="TEAM LEAD · HUB QUALITY" onClose={onClose}>
      {done ? (
        <div style={{textAlign:"center",padding:"20px 0"}}>
          <p style={{fontSize:24,margin:"0 0 8px"}}>✓</p>
          <p style={{fontSize:13,color:DS.green,fontWeight:600}}>Flag submitted — manager will review</p>
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div>
            <label style={{fontSize:11,color:DS.textSec,display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:.5}}>Category</label>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
              {FLAG_TYPES.map(t=>(
                <div key={t.k} onClick={()=>setType(t.k)} style={{padding:"7px 10px",borderRadius:DS.radiusSm,border:`1px solid ${type===t.k?DS.accent:DS.border}`,background:type===t.k?DS.accentDim:DS.bgSurf,cursor:"pointer",fontSize:12,color:type===t.k?DS.accent:DS.textSec,textAlign:"center",fontWeight:type===t.k?600:400}}>
                  {t.l}
                </div>
              ))}
            </div>
          </div>
          <div>
            <label style={{fontSize:11,color:DS.textSec,display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:.5}}>What's wrong? *</label>
            <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Leawood pricing is outdated" style={{width:"100%"}}/>
          </div>
          <div>
            <label style={{fontSize:11,color:DS.textSec,display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:.5}}>Details *</label>
            <textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3} placeholder="Describe exactly what's wrong or missing, and what it should say…" style={{width:"100%",resize:"vertical"}}/>
          </div>
          <Btn label={submitting?"Submitting…":"Submit Flag"} onClick={submit} disabled={submitting||!title.trim()||!description.trim()} color={DS.accent}/>
        </div>
      )}
    </Modal>
  );
}

// ── TODAY'S ROSTER ───────────────────────────────────────────────────
function TodaysRoster({ reps }) {
  const TZ_OFFSET = {Central:0, Eastern:1, Pacific:-2, SA:-7};
  const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const day = DAYS[new Date().getDay()];

  function toCtMins(timeStr, tz) {
    if(!timeStr) return null;
    const [h,m] = timeStr.split(":").map(Number);
    return ((h*60+m) + (TZ_OFFSET[tz]||0)*60 + 1440) % 1440;
  }
  function fmtMins(mins) {
    if(mins===null||mins===undefined) return "";
    const norm = ((mins%1440)+1440)%1440;
    const h = Math.floor(norm/60), m = norm%60;
    return `${h%12||12}${m?`:${String(m).padStart(2,"0")}`:""}${h>=12?"pm":"am"}`;
  }

  const STATUS_COLOR = {
    available:DS.green, health:DS.accent, lunch:DS.amber,
    admin:DS.accentHi, off:DS.textMut, pto:DS.textMut, sick:DS.red,
  };
  const STATUS_LABEL = {
    available:"Available", health:"Health break", lunch:"On lunch",
    admin:"Admin", off:"Off", pto:"PTO", sick:"Sick/Call-off",
  };

  // Only reps scheduled to work today based on shift_days
  const scheduledToday = reps.filter(r=>{
    const shiftDays = r.shift_days||[];
    // If no shift days set, fall back to showing everyone not off
    if(shiftDays.length===0) return !["off","pto","sick"].includes(r.status);
    return shiftDays.includes(day);
  });

  const onShift  = scheduledToday.filter(r=>!["off","pto","sick"].includes(r.status));
  const offToday = scheduledToday.filter(r=>["off","pto","sick"].includes(r.status));

  // Also show anyone currently on break who isn't scheduled (edge case)
  const extraOnBreak = reps.filter(r=>
    ["health","lunch","admin"].includes(r.status) &&
    !scheduledToday.find(s=>s.id===r.id)
  );

  const displayReps = [...onShift, ...extraOnBreak].sort((a,b)=>{
    const aStart = toCtMins(a.lunch_schedule?.[day]?.start, a.timezone||"Central");
    const bStart = toCtMins(b.lunch_schedule?.[day]?.start, b.timezone||"Central");
    return (aStart||999)-(bStart||999);
  });

  return (
    <div style={{background:DS.bgCard,borderRadius:DS.radius,border:`1px solid ${DS.border}`,padding:14,marginBottom:14}}>
      <p style={{margin:"0 0 12px",fontSize:10,fontWeight:700,color:DS.textMut,textTransform:"uppercase",letterSpacing:1.5}}>
        Today's Roster — {day} · {displayReps.length} on shift
      </p>

      {displayReps.length===0&&(
        <p style={{margin:0,fontSize:12,color:DS.textMut,textAlign:"center",padding:"8px 0"}}>No reps scheduled today</p>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {displayReps.map(r=>{
          const color = STATUS_COLOR[r.status]||DS.textSec;
          const sched = r.lunch_schedule?.[day];
          const startCT = toCtMins(sched?.start, r.timezone||"Central");
          const endCT   = toCtMins(sched?.end,   r.timezone||"Central");
          const lunchCT = toCtMins(sched?.time,  r.timezone||"Central");
          return (
            <div key={r.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",background:DS.bgSurf,borderRadius:DS.radiusSm,border:`1px solid ${DS.border}`}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:7,height:7,borderRadius:"50%",background:color,flexShrink:0}}/>
                <div>
                  <p style={{margin:0,fontSize:12,fontWeight:600,color:DS.textPri}}>{r.name}</p>
                  <p style={{margin:0,fontSize:10,color:DS.textMut}}>
                    {r.timezone||"Central"}
                    {startCT!==null&&endCT!==null ? ` · ${fmtMins(startCT)}–${fmtMins(endCT)} CT` : ""}
                    {lunchCT!==null ? ` · lunch ${fmtMins(lunchCT)}` : ""}
                  </p>
                </div>
              </div>
              <span style={{fontSize:10,fontWeight:600,color,background:`${color}15`,padding:"2px 8px",borderRadius:4}}>
                {STATUS_LABEL[r.status]||r.status}
              </span>
            </div>
          );
        })}
      </div>

      {offToday.length>0&&(
        <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${DS.border}`}}>
          <p style={{margin:0,fontSize:10,color:DS.textMut}}>
            Scheduled off today: {offToday.map(r=>`${r.name} (${r.status})`).join(" · ")}
          </p>
        </div>
      )}
    </div>
  );
}

function TeamLeadView({ currentUser, data, reload, onLogout }) {
  const { reps, settings, adHoc, swaps, activeBreaks } = data;
  const [tab, setTab] = useState("overview");
  const [toast, setToast] = useState(null);
  const [showFlag, setShowFlag] = useState(false);
  const [theme] = useTheme();
  const gStyle = buildGStyle(theme);
  const fire = (type,msg)=>setToast({type,msg,id:Date.now()});

  const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const todayDay = DAYS[new Date().getDay()];
  const scheduledToday = reps.filter(r=>{
    const shiftDays = r.shift_days||[];
    if(shiftDays.length===0) return !["off","pto","sick"].includes(r.status);
    return shiftDays.includes(todayDay);
  });

  const onHealth = scheduledToday.filter(r=>r.status==="health").length;
  const onLunch  = scheduledToday.filter(r=>r.status==="lunch").length;
  const onAdmin  = scheduledToday.filter(r=>r.status==="admin").length;
  const available = scheduledToday.filter(r=>r.status==="available").length;

  const TABS = [
    {k:"overview", l:"Overview"},
    {k:"requests", l:`Requests${adHoc.filter(r=>r.status==="pending").length>0?` (${adHoc.filter(r=>r.status==="pending").length})`:""}`},
    {k:"team",     l:"Team"},
  ];

  return (
    <div style={{fontFamily:"'Inter',-apple-system,sans-serif",minHeight:"100vh",background:DS.bg,paddingBottom:60}}>
      <style>{gStyle}</style>
      {toast&&<Toast key={toast.id} msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}
      {showFlag&&<FlagModal currentUser={currentUser} onClose={()=>setShowFlag(false)}/>}

      {/* Header */}
      <div style={{background:DS.bgCard,borderBottom:`1px solid ${DS.border}`,padding:"14px 18px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{fontSize:11,fontWeight:700,color:DS.accent,letterSpacing:2,textTransform:"uppercase"}}>execo</div>
            <div style={{width:1,height:16,background:DS.border}}/>
            <div>
              <p style={{margin:0,fontSize:13,fontWeight:600,color:DS.textPri}}>Team Lead — ESC</p>
              <p style={{margin:0,fontSize:11,color:DS.textSec}}>{currentUser?.display_name||"Team Lead"} · {todayLabel()}</p>
            </div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <button onClick={()=>setShowFlag(true)} style={{padding:"6px 12px",borderRadius:DS.radiusSm,border:`1px solid ${DS.amber}40`,background:DS.amberDim,color:DS.amber,cursor:"pointer",fontSize:11,fontWeight:600}}>
              🚩 Flag Issue
            </button>
            <ThemeToggle size="small"/>
            <button onClick={onLogout} style={{padding:"5px 12px",borderRadius:DS.radiusSm,border:`1px solid ${DS.border}`,background:"transparent",color:DS.textSec,cursor:"pointer",fontSize:11}}>Sign out</button>
          </div>
        </div>

        {/* Stats */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
          {[
            {n:available, l:"Available", c:DS.green},
            {n:onHealth,  l:"Health break", c:onHealth>0?DS.accent:DS.textMut},
            {n:onLunch,   l:"On lunch", c:onLunch>0?DS.amber:DS.textMut},
            {n:onAdmin,   l:"Admin time", c:onAdmin>0?DS.accentHi:DS.textMut},
          ].map(s=>(
            <div key={s.l} style={{background:DS.bgSurf,borderRadius:DS.radiusSm,padding:"8px 10px",border:`1px solid ${DS.border}`}}>
              <p style={{margin:0,fontSize:20,fontWeight:700,color:s.c,lineHeight:1}}>{s.n}</p>
              <p style={{margin:"3px 0 0",fontSize:10,color:DS.textMut}}>{s.l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{background:DS.bgCard,borderBottom:`1px solid ${DS.border}`}}>
        <div style={{display:"flex",padding:"0 16px"}}>
          {TABS.map(t=>(
            <button key={t.k} onClick={()=>setTab(t.k)} style={{padding:"11px 14px",border:"none",background:"none",cursor:"pointer",fontSize:12,fontWeight:tab===t.k?600:400,color:tab===t.k?DS.accent:DS.textSec,borderBottom:tab===t.k?`2px solid ${DS.accent}`:"2px solid transparent",marginBottom:-1,transition:"all .15s"}}>
              {t.l}
            </button>
          ))}
        </div>
      </div>

      <div style={{padding:"16px",maxWidth:720,margin:"0 auto"}}>
        {tab==="overview"&&(
          <>
            <TodaysRoster reps={reps}/>
            <MgrOverview reps={reps} activeBreaks={activeBreaks} hLimit={settings.peak_mode?1:2} maxOut={settings.custom_limit??Math.max(2,Math.floor(reps.filter(r=>!["off","pto","sick"].includes(r.status)).length*0.3))} reload={reload} fire={fire} settings={settings} centreOpen={true} onAdmin={onAdmin} adminLimit={settings.admin_limit??2} readOnly={true}/>
          </>
        )}
        {tab==="requests"&&<MgrRequests adHoc={adHoc} swaps={swaps} reps={reps} reload={reload} fire={fire} settings={settings}/>}
        {tab==="team"&&<MgrTeam reps={reps} settings={settings} reload={reload} fire={fire} readOnly={true}/>}
      </div>
    </div>
  );
}

function ClientView({ currentUser, data, reload, onLogout }) {
  const [tab, setTab] = useState("home");
  const [toast, setToast] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [locations, setLocations] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [type, setType] = useState("promo");
  const [urgentWord, setUrgentWord] = useState("");
  const fire = (t,m)=>setToast({type:t,msg:m,id:Date.now()});

  // Promo state — identical fields to HubPromoModal
  const [promo, setPromo] = useState({
    title:"",code:"",rules:"",expires_on:"",proactive:false,
    discount_pct:0,discount_fixed:0,discount_type:"pct",
    applies_to:"continuous",one_class_only:false,multi_class_still:true,
    customer_types:["lead","lapsed"],month_restriction:"",
    requires_mention:false,show_scenarios:false
  });
  const setP=(k,v)=>setPromo(p=>({...p,[k]:v}));
  const toggleCT=(t)=>setP("customer_types",promo.customer_types.includes(t)?promo.customer_types.filter(x=>x!==t):[...promo.customer_types,t]);

  // Closure state
  const [closure, setClosure] = useState({location_name:"",start_date:"",end_date:"",reason:""});
  const setC=(k,v)=>setClosure(p=>({...p,[k]:v}));

  // Location state — identical fields to HubLocModal
  const [loc, setLoc] = useState({id:null,name:"",ext:"",privates:false,pool:"Chlorine",addr:""});
  const setL=(k,v)=>setLoc(p=>({...p,[k]:v}));

  // Alert state
  const [alert, setAlert] = useState({title:"",body:"",category:"general",alert_type:"warning"});
  const setA=(k,v)=>setAlert(p=>({...p,[k]:v}));

  // Pricing state
  const [pricing, setPricing] = useState({
    id:null, name:"",
    price_mf:"", price_ss:"", price_priv:"", price_semi:"",
    price_priv20:"", price_odl:"", price_odl_ss:"",
    price_clinic:"", price_st_mf:"", price_st_ss:"", price_adaptive:"",
    reg_fee:""
  });
  const setPR=(k,v)=>setPricing(p=>({...p,[k]:v}));

  const [urgent, setUrgent] = useState(false);

  const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const [appSettings, setAppSettings] = useState({});

  useEffect(()=>{
    const who=encodeURIComponent(currentUser?.display_name||currentUser?.username||"client");
    sb("hub_submissions?submitted_by=eq."+who+"&order=submitted_at.desc&limit=50").then(s=>setSubmissions(s||[])).catch(()=>{});
    sb("hub_locations?order=name").then(l=>setLocations(l||[])).catch(()=>{});
    sb("app_settings?id=eq.1").then(r=>setAppSettings(r?.[0]||{})).catch(()=>{});
  },[]);

  const submit = async () => {
    if(urgent && urgentWord.toUpperCase()!=="URGENT"){fire("declined","Type URGENT to confirm");return;}
    setSubmitting(true);
    let payload={};
    if(type==="promo") payload={...promo,active:true};
    else if(type==="closure") payload={...closure};
    else if(type==="location") payload={...loc};
    else if(type==="pricing") payload={...pricing};
    else if(type==="alert") payload={...alert,active:true,sort_order:0};

    await sbPost("hub_submissions",{type,payload,submitted_by:currentUser?.display_name||currentUser?.username||"client",urgent,status:"pending"});

    const clientPing = makePinger(appSettings.notif_prefs||{}, appSettings.execo_webhook);
    if(urgent){
      clientPing.both("client_urgent","🚨 *URGENT Hub submission from "+(currentUser?.display_name||"client")+"!* "+(payload.title||payload.location_name||"Update")+" — requires immediate review.");
    } else {
      clientPing.execo("client_submission","📤 *New Hub submission from "+(currentUser?.display_name||"client")+"* — "+TYPE_LABELS[type]+": "+(payload.title||payload.location_name||payload.name||"Update")+". Awaiting manager approval.");
    }

    fire("approved",urgent?"Urgent submission sent 🚨":"Submitted for approval ✅");
    setPromo({title:"",code:"",rules:"",expires_on:"",proactive:false,discount_pct:0,discount_fixed:0,discount_type:"pct",applies_to:"continuous",one_class_only:false,multi_class_still:true,customer_types:["lead","lapsed"],month_restriction:"",requires_mention:false,show_scenarios:false});
    setClosure({location_name:"",start_date:"",end_date:"",reason:""});
    setLoc({id:null,name:"",ext:"",privates:false,pool:"Chlorine",addr:""});
    setPricing({id:null,name:"",price_mf:"",price_ss:"",price_priv:"",price_semi:"",price_priv20:"",price_odl:"",price_odl_ss:"",price_clinic:"",price_st_mf:"",price_st_ss:"",price_adaptive:"",reg_fee:""});
    setUrgent(false); setUrgentWord("");
    setSubmitting(false);
    const who=encodeURIComponent(currentUser?.display_name||currentUser?.username||"client");
    const s=await sb("hub_submissions?submitted_by=eq."+who+"&order=submitted_at.desc&limit=50").catch(()=>[]);
    setSubmissions(s||[]);
    reload();
  };

  const S={fontSize:13,outline:"none",width:"100%",boxSizing:"border-box",padding:"9px 12px",borderRadius:9,border:`1px solid ${DS.border}`};
  const lbl=(t)=><label style={{fontSize:11,color:DS.textSec,fontWeight:600,display:"block",marginBottom:4,textTransform:"uppercase"}}>{t}</label>;
  const g2=(a,b)=><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>{a}{b}</div>;

  const clientTabs=[{k:"home",l:"📤 Submit"},{k:"history",l:"📋 My Submissions"}];
  const STATUS_CFG={pending:{bg:"#fff8ee",fg:"#b85c00"},approved:{bg:"#eafaf1",fg:"#1a5c35"},rejected:{bg:"#fdf0ee",fg:"#c0392b"}};
  const TYPE_LABELS={promo:"🎯 Promo",closure:"🚫 Closure",location:"📍 Location",pricing:"💰 Pricing",alert:"🔔 Reminder"};

  return (
    <div style={{fontFamily:"'Segoe UI',system-ui,sans-serif",minHeight:"100vh",background:DS.bg,paddingBottom:60}}>
      <style>{`*{box-sizing:border-box}`}</style>
      {toast&&<Toast key={toast.id} msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}
      <div style={{background:DS.accent,padding:"16px 18px 0",color:"#fff"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:24}}>🏊</span>
            <div><p style={{margin:0,fontSize:13,fontWeight:700}}>Emler Hub Portal</p><p style={{margin:0,fontSize:11,opacity:.6}}>{currentUser?.display_name||currentUser?.username}</p></div>
          </div>
          <button onClick={onLogout} style={{padding:"6px 12px",borderRadius:8,border:"1px solid rgba(255,255,255,.3)",background:"transparent",color:"rgba(255,255,255,.8)",cursor:"pointer",fontSize:11}}>Sign Out</button>
        </div>
        <div style={{display:"flex"}}>
          {clientTabs.map(t=><button key={t.k} onClick={()=>setTab(t.k)} style={{padding:"8px 16px",border:"none",background:"none",cursor:"pointer",fontSize:12,fontWeight:tab===t.k?700:400,color:tab===t.k?"#fff":"rgba(255,255,255,.55)",borderBottom:tab===t.k?"2.5px solid #fff":"2.5px solid transparent",marginBottom:-1.5}}>{t.l}</button>)}
        </div>
      </div>

      <div style={{padding:"16px",maxWidth:640,margin:"0 auto"}}>

        {tab==="home"&&<div>
          {/* Type selector */}
          <div style={{background:DS.bgCard,borderRadius:12,border:`1px solid ${DS.border}`,padding:"14px",marginBottom:12}}>
            <p style={{margin:"0 0 10px",fontSize:11,fontWeight:700,color:DS.textSec,textTransform:"uppercase",letterSpacing:.5}}>Submission type</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              {[{k:"promo",l:"🎯 Promo"},{k:"closure",l:"🚫 Closure"},{k:"location",l:"📍 Location Update"},{k:"pricing",l:"💰 Pricing Update"},{k:"alert",l:"🔔 Reminder"}].map(t=>(
                <div key={t.k} onClick={()=>setType(t.k)} style={{padding:"10px 12px",borderRadius:10,border:`2px solid ${type===t.k?"#003087":"#eee"}`,background:type===t.k?"#e8f0fe":"#fff",cursor:"pointer",fontWeight:type===t.k?700:500,fontSize:13,color:type===t.k?"#003087":"#555"}}>{t.l}</div>
              ))}
            </div>
          </div>

          {/* PROMO — identical to HubPromoModal */}
          {type==="promo"&&<div style={{background:DS.bgCard,borderRadius:12,border:`1px solid ${DS.border}`,padding:"16px",marginBottom:12,display:"flex",flexDirection:"column",gap:12}}>
            {g2(<div>{lbl("Promo Title *")}<input value={promo.title} onChange={e=>setP("title",e.target.value)} placeholder="e.g. June Dive In" style={S}/></div>,
               <div>{lbl("Promo Code")}<input value={promo.code} onChange={e=>setP("code",e.target.value)} placeholder="e.g. DIVEIN40" style={S}/></div>)}

            <div style={{background:DS.greenDim,border:`1px solid ${DS.green}40`,borderRadius:10,padding:"12px",display:"flex",flexDirection:"column",gap:10}}>
              <p style={{margin:0,fontSize:11,fontWeight:700,color:DS.green,textTransform:"uppercase"}}>💰 Discount Settings</p>
              {g2(
                <div>{lbl("Discount Type")}<select value={promo.discount_type} onChange={e=>setP("discount_type",e.target.value)} style={{...S,background:DS.bgCard}}>
                  <option value="pct">% off tuition</option>
                  <option value="one_class_pct">% off — 1 class/week only</option>
                  <option value="fixed">Fixed $ off per student</option>
                </select></div>,
                <div>{(promo.discount_type==="pct"||promo.discount_type==="one_class_pct")
                  ?<>{lbl("Discount %")}<input type="number" min={1} max={100} value={promo.discount_pct} onChange={e=>setP("discount_pct",+e.target.value)} style={S}/></>
                  :<>{lbl("Discount Amount ($)")}<input type="number" min={1} value={promo.discount_fixed} onChange={e=>setP("discount_fixed",+e.target.value)} style={S}/></>
                }</div>
              )}
              <div>{lbl("Applies To")}<select value={promo.applies_to} onChange={e=>setP("applies_to",e.target.value)} style={{...S,background:DS.bgCard}}>
                <option value="continuous">Continuous classes only (no ODL/clinic)</option>
                <option value="group">Group classes only</option>
                <option value="all">All lesson types</option>
              </select></div>
            </div>

            <div style={{background:DS.amberDim,border:`1px solid ${DS.amber}40`,borderRadius:10,padding:"12px",display:"flex",flexDirection:"column",gap:10}}>
              <p style={{margin:0,fontSize:11,fontWeight:700,color:DS.amber,textTransform:"uppercase"}}>🔒 Restrictions</p>
              <div>{lbl("Valid For")}
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {[{k:"lead",l:"New leads"},{k:"lapsed",l:"Lapsed"},{k:"active",l:"Active"}].map(t=>(
                    <div key={t.k} onClick={()=>toggleCT(t.k)} style={{padding:"5px 12px",borderRadius:8,border:`1.5px solid ${promo.customer_types.includes(t.k)?"#e07b00":"#ddd"}`,background:promo.customer_types.includes(t.k)?"#fff8ee":"#fff",cursor:"pointer",fontSize:12,fontWeight:600,color:promo.customer_types.includes(t.k)?"#b85c00":"#888"}}>
                      {promo.customer_types.includes(t.k)?"✓ ":""}{t.l}
                    </div>
                  ))}
                </div>
              </div>
              {g2(
                <div>{lbl("Month Restriction")}<select value={promo.month_restriction} onChange={e=>setP("month_restriction",e.target.value)} style={{...S,background:DS.bgCard}}>
                  <option value="">Any month</option>
                  {MONTHS.map((m,i)=><option key={i} value={String(i)}>{m}</option>)}
                </select></div>,
                <div>{lbl("Expiry Date")}<input type="date" value={promo.expires_on} onChange={e=>setP("expires_on",e.target.value)} style={S}/></div>
              )}
              <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                <label style={{display:"flex",alignItems:"center",gap:6,fontSize:12,cursor:"pointer"}}><input type="checkbox" checked={promo.proactive} onChange={e=>setP("proactive",e.target.checked)}/> May offer proactively</label>
                <label style={{display:"flex",alignItems:"center",gap:6,fontSize:12,cursor:"pointer"}}><input type="checkbox" checked={promo.requires_mention} onChange={e=>setP("requires_mention",e.target.checked)}/> Customer must mention it</label>
              </div>
            </div>

            <div>{lbl("Full Rules")}<textarea value={promo.rules} onChange={e=>setP("rules",e.target.value)} rows={3} placeholder="Full terms as stated in the promo brief…" style={{...S,resize:"vertical"}}/></div>
          </div>}

          {/* CLOSURE */}
          {type==="closure"&&<div style={{background:DS.bgCard,borderRadius:12,border:`1px solid ${DS.border}`,padding:"16px",marginBottom:12,display:"flex",flexDirection:"column",gap:12}}>
            <div>{lbl("Location *")}<select value={closure.location_name} onChange={e=>setC("location_name",e.target.value)} style={{...S,background:DS.bgCard}}>
              <option value="">Select location…</option>
              {locations.map(l=><option key={l.id} value={l.name}>{l.name}</option>)}
            </select></div>
            {g2(<div>{lbl("From *")}<input type="date" value={closure.start_date} onChange={e=>setC("start_date",e.target.value)} style={S}/></div>,
               <div>{lbl("To *")}<input type="date" value={closure.end_date} onChange={e=>setC("end_date",e.target.value)} style={S}/></div>)}
            <div>{lbl("Reason *")}<input value={closure.reason} onChange={e=>setC("reason",e.target.value)} placeholder="e.g. Pool maintenance" style={S}/></div>
          </div>}

          {/* LOCATION — identical fields to HubLocModal */}
          {type==="location"&&<div style={{background:DS.bgCard,borderRadius:12,border:`1px solid ${DS.border}`,padding:"16px",marginBottom:12,display:"flex",flexDirection:"column",gap:12}}>
            <div>{lbl("Location *")}<select value={loc.id!=null?String(loc.id):""} onChange={e=>{
              const val=e.target.value;
              if(!val){setLoc({id:null,name:"",ext:"",privates:false,pool:"Chlorine",addr:""});return;}
              const found=locations.find(l=>String(l.id)===val);
              if(found) setLoc({id:found.id,name:found.name,ext:found.ext||"",privates:found.privates||false,pool:found.pool||"Chlorine",addr:found.addr||""});
            }} style={{...S,background:DS.bgCard}}>
              <option value="">Select location…</option>
              {locations.map(l=><option key={l.id} value={String(l.id)}>{l.name}</option>)}
            </select>
            {locations.length===0&&<p style={{margin:"4px 0 0",fontSize:11,color:DS.textMut}}>Loading locations…</p>}
            </div>
            {loc.id!=null&&loc.name&&<>
              {g2(<div>{lbl("Extension")}<input value={loc.ext} onChange={e=>setL("ext",e.target.value)} placeholder="e.g. 1001" style={S}/></div>,
                 <div>{lbl("Pool Type")}<select value={loc.pool} onChange={e=>setL("pool",e.target.value)} style={{...S,background:DS.bgCard}}>
                   <option value="Chlorine">Chlorine</option><option value="Salt">Salt water</option><option value="Therapy">Therapy pool</option>
                 </select></div>)}
              <div>{lbl("Address")}<input value={loc.addr} onChange={e=>setL("addr",e.target.value)} placeholder="Full street address" style={S}/></div>
              <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,cursor:"pointer"}}><input type="checkbox" checked={loc.privates} onChange={e=>setL("privates",e.target.checked)}/> Offers private lessons</label>
            </>}
          </div>}

          {/* PRICING */}
          {type==="pricing"&&<div style={{background:DS.bgCard,borderRadius:12,border:`1px solid ${DS.border}`,padding:"16px",marginBottom:12,display:"flex",flexDirection:"column",gap:12}}>
            <div>{lbl("Location *")}<select value={pricing.id!=null?String(pricing.id):""} onChange={e=>{
              const found=locations.find(l=>String(l.id)===e.target.value);
              if(found) setPricing({
                id:found.id,name:found.name,
                price_mf:found.price_mf||"",price_ss:found.price_ss||"",
                price_priv:found.price_priv||"",price_semi:found.price_semi||"",
                price_priv20:found.price_priv20||"",price_odl:found.price_odl||"",
                price_odl_ss:found.price_odl_ss||"",price_clinic:found.price_clinic||"",
                price_st_mf:found.price_st_mf||"",price_st_ss:found.price_st_ss||"",
                price_adaptive:found.price_adaptive||"",reg_fee:found.reg_fee||""
              });
            }} style={{...S,background:DS.bgCard}}>
              <option value="">Select location…</option>
              {locations.map(l=><option key={l.id} value={String(l.id)}>{l.name}</option>)}
            </select></div>

            {pricing.id!=null&&pricing.name&&<>
              <div style={{background:DS.greenDim,border:`1px solid ${DS.green}40`,borderRadius:10,padding:"12px",display:"flex",flexDirection:"column",gap:10}}>
                <p style={{margin:0,fontSize:11,fontWeight:700,color:DS.green,textTransform:"uppercase"}}>📅 Group / Continuous (per month)</p>
                {g2(
                  <div>{lbl("Group Mon–Fri ($)")}<input type="number" value={pricing.price_mf} onChange={e=>setPR("price_mf",e.target.value)} placeholder="e.g. 189" style={S}/></div>,
                  <div>{lbl("Group Sat–Sun ($)")}<input type="number" value={pricing.price_ss} onChange={e=>setPR("price_ss",e.target.value)} placeholder="e.g. 189" style={S}/></div>
                )}
                {g2(
                  <div>{lbl("Swim Team Mon–Fri ($)")}<input type="number" value={pricing.price_st_mf} onChange={e=>setPR("price_st_mf",e.target.value)} placeholder="e.g. 199" style={S}/></div>,
                  <div>{lbl("Swim Team Sat–Sun ($)")}<input type="number" value={pricing.price_st_ss} onChange={e=>setPR("price_st_ss",e.target.value)} placeholder="e.g. 199" style={S}/></div>
                )}
              </div>

              <div style={{background:DS.accentDim,border:"1.5px solid #bfdbfe",borderRadius:10,padding:"12px",display:"flex",flexDirection:"column",gap:10}}>
                <p style={{margin:0,fontSize:11,fontWeight:700,color:"#1d4ed8",textTransform:"uppercase"}}>👤 Private / Semi-Private (per month)</p>
                {g2(
                  <div>{lbl("Private 30 min ($)")}<input type="number" value={pricing.price_priv} onChange={e=>setPR("price_priv",e.target.value)} placeholder="e.g. 299" style={S}/></div>,
                  <div>{lbl("Private 20 min ($)")}<input type="number" value={pricing.price_priv20} onChange={e=>setPR("price_priv20",e.target.value)} placeholder="e.g. 249" style={S}/></div>
                )}
                {g2(
                  <div>{lbl("Semi-Private 30 min ($)")}<input type="number" value={pricing.price_semi} onChange={e=>setPR("price_semi",e.target.value)} placeholder="e.g. 259" style={S}/></div>,
                  <div>{lbl("Private Adaptive ($)")}<input type="number" value={pricing.price_adaptive} onChange={e=>setPR("price_adaptive",e.target.value)} placeholder="e.g. 349" style={S}/></div>
                )}
              </div>

              <div style={{background:DS.amberDim,border:`1px solid ${DS.amber}40`,borderRadius:10,padding:"12px",display:"flex",flexDirection:"column",gap:10}}>
                <p style={{margin:0,fontSize:11,fontWeight:700,color:"#b85c00",textTransform:"uppercase"}}>📋 ODL / Clinic / Fees</p>
                {g2(
                  <div>{lbl("ODL Mon–Fri ($)")}<input type="number" value={pricing.price_odl} onChange={e=>setPR("price_odl",e.target.value)} placeholder="e.g. 89" style={S}/></div>,
                  <div>{lbl("ODL Sat–Sun ($)")}<input type="number" value={pricing.price_odl_ss} onChange={e=>setPR("price_odl_ss",e.target.value)} placeholder="e.g. 89" style={S}/></div>
                )}
                {g2(
                  <div>{lbl("Swim Clinic (per wk) ($)")}<input type="number" value={pricing.price_clinic} onChange={e=>setPR("price_clinic",e.target.value)} placeholder="e.g. 49" style={S}/></div>,
                  <div>{lbl("Registration Fee ($)")}<input type="number" value={pricing.reg_fee} onChange={e=>setPR("reg_fee",e.target.value)} placeholder="e.g. 25" style={S}/></div>
                )}
              </div>
              <p style={{margin:0,fontSize:11,color:DS.textSec}}>💡 Leave a field blank to keep the current price unchanged. Only filled fields will be updated.</p>
            </>}
          </div>}

          {/* ALERT */}
          {type==="alert"&&<div style={{background:DS.bgCard,borderRadius:12,border:`1px solid ${DS.border}`,padding:"16px",marginBottom:12,display:"flex",flexDirection:"column",gap:12}}>
            <div>{lbl("Title *")}<input value={alert.title} onChange={e=>setA("title",e.target.value)} placeholder="e.g. New pricing effective June 1" style={S}/></div>
            <div>{lbl("Details *")}<textarea value={alert.body} onChange={e=>setA("body",e.target.value)} rows={3} placeholder="Full details for the team…" style={{...S,resize:"vertical"}}/></div>
            {g2(<div>{lbl("Category")}<select value={alert.category} onChange={e=>setA("category",e.target.value)} style={{...S,background:DS.bgCard}}>
              <option value="general">General</option><option value="pricing">Pricing</option><option value="operations">Operations</option><option value="promos">Promos</option>
            </select></div>,
            <div>{lbl("Type")}<select value={alert.alert_type} onChange={e=>setA("alert_type",e.target.value)} style={{...S,background:DS.bgCard}}>
              <option value="warning">⚠️ Warning</option><option value="info">ℹ️ Info</option><option value="success">✅ Positive</option>
            </select></div>)}
          </div>}

          {/* Urgent toggle */}
          <div style={{background:DS.redDim,borderRadius:10,padding:"12px",border:"1.5px solid #f5b7b1",marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:urgent?10:0}}>
              <div><p style={{margin:0,fontSize:12,fontWeight:700,color:DS.red}}>🚨 Mark as Urgent</p><p style={{margin:"2px 0 0",fontSize:11,color:DS.textSec}}>Bypasses approval — pings manager immediately</p></div>
              <div onClick={()=>setUrgent(!urgent)} style={{width:42,height:24,borderRadius:12,background:urgent?"#c0392b":"#ccc",cursor:"pointer",position:"relative",transition:"background .2s"}}>
                <div style={{width:18,height:18,borderRadius:"50%",background:DS.bgCard,position:"absolute",top:3,left:urgent?21:3,transition:"left .2s"}}/>
              </div>
            </div>
            {urgent&&<input value={urgentWord} onChange={e=>setUrgentWord(e.target.value)} placeholder='Type "URGENT" to confirm'
              style={{...S,border:`1.5px solid ${urgentWord.toUpperCase()==="URGENT"?"#c0392b":"#ddd"}`,background:DS.bgCard}}/>}
          </div>

          <button onClick={submit} disabled={submitting} style={{width:"100%",padding:"12px",borderRadius:10,background:DS.accent,color:"#fff",border:"none",cursor:submitting?"default":"pointer",fontSize:13,fontWeight:700,opacity:submitting?.7:1}}>
            {submitting?"Submitting…":"📤 Submit for Approval"}
          </button>
        </div>}

        {tab==="history"&&<div>
          {submissions.length===0&&<div style={{background:DS.bgCard,borderRadius:12,border:`1px solid ${DS.border}`,padding:"28px",textAlign:"center"}}><p style={{fontSize:20,margin:"0 0 6px"}}>📋</p><p style={{fontSize:13,color:DS.textMut}}>No submissions yet</p></div>}
          {submissions.map(s=>(
            <div key={s.id} style={{background:DS.bgCard,borderRadius:12,border:`1px solid ${DS.border}`,padding:"14px",marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <span style={{fontSize:12,fontWeight:700,color:DS.accent}}>{TYPE_LABELS[s.type]||s.type}</span>
                  {s.urgent&&<span style={{fontSize:10,background:DS.redDim,color:DS.red,padding:"2px 6px",borderRadius:4,fontWeight:700}}>🚨 URGENT</span>}
                </div>
                <span style={{fontSize:11,fontWeight:600,color:(STATUS_CFG[s.status]||{}).fg,background:(STATUS_CFG[s.status]||{}).bg,padding:"2px 8px",borderRadius:4}}>{s.status}</span>
              </div>
              <p style={{margin:"0 0 4px",fontWeight:600,fontSize:13}}>{s.payload?.title||s.payload?.location_name||s.payload?.name||"Update"}</p>
              <p style={{margin:0,fontSize:11,color:DS.textMut}}>{new Date(s.submitted_at).toLocaleString()}</p>
              {s.reviewed_by&&<p style={{margin:"4px 0 0",fontSize:11,color:DS.textSec}}>Reviewed by {s.reviewed_by}</p>}
            </div>
          ))}
        </div>}
      </div>
    </div>
  );
}


export default function App() {
  const [view, setView] = useState("login");
  const [currentRep, setCurrentRep] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [data, setData] = useState({reps:[],settings:{peak_mode:false,custom_limit:null},adHoc:[],swaps:[],activeBreaks:[]});
  const [users, setUsers] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [kpiFileName, setKpiFileName] = useState(null);

  const reload = useCallback(async()=>{
    try {
      const [d, u, subs] = await Promise.all([
        loadAll(),
        sb("app_users?order=created_at").catch(()=>[]),
        sb("hub_submissions?order=submitted_at.desc&limit=100").catch(()=>[]),
      ]);
      setData(d);
      setUsers(u||[]);
      setSubmissions(subs||[]);
    } catch(e) {
      console.error("Load error:",e);
    } finally {
      setLoading(false);
    }
  },[]);

  useEffect(()=>{
    // Run daily reset once then start polling
    const init = async () => {
      try {
        const d = await loadAll();
        await runDailyReset(d.reps, d.settings);
      } catch(e) { console.error("Init error:",e); }
      reload();
    };
    init();
    sb("kpi_upload_meta?id=eq.1").then(r=>{ if(r?.[0]?.last_filename) setKpiFileName(r[0].last_filename); }).catch(()=>{});
    const interval = setInterval(reload, 30000);
    return ()=>clearInterval(interval);
  },[]);

  const [centreOpen, setCentreOpen] = useState(getCentreStatus().isOpen);

  // Check centre status every minute
  useEffect(()=>{
    const check = () => {
      const { isOpen } = getCentreStatus();
      setCentreOpen(isOpen);
    };
    check();
    const t = setInterval(check, 60000);
    return () => clearInterval(t);
  },[]);

  // Auto-clear active breaks when centre closes; reset when centre opens
  useEffect(()=>{
    if(data.reps.length === 0) return;
    if(!centreOpen) {
      const onBreak = data.reps.filter(r=>["health","lunch"].includes(r.status));
      onBreak.forEach(r => sbPatch("rep_status",r.id,{status:"available",updated_at:new Date().toISOString()}).catch(()=>{}));
    } else {
      data.reps.forEach(r => sbPatch("rep_status",r.id,{health_breaks_today:0,health_time_banked:0,last_break_returned_at:null,updated_at:new Date().toISOString()}).catch(()=>{}));
    }
  },[centreOpen]);

  // Session timeout — auto logout after 8 hours — must be before any early return
  const SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000;
  const lastActivityRef = React.useRef(Date.now());

  useEffect(()=>{
    const updateActivity = () => { lastActivityRef.current = Date.now(); };
    window.addEventListener("click", updateActivity);
    window.addEventListener("keydown", updateActivity);
    const check = setInterval(()=>{
      if(view !== "login" && Date.now() - lastActivityRef.current > SESSION_TIMEOUT_MS){
        setView("login"); setCurrentUser(null); setCurrentRep(null);
      }
    }, 60000);
    return ()=>{ clearInterval(check); window.removeEventListener("click",updateActivity); window.removeEventListener("keydown",updateActivity); };
  },[view]);

  if(loading) return (
    <div style={{minHeight:"100vh",background:DS.bg,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12}}>
      <div style={{fontSize:11,fontWeight:700,color:DS.accent,letterSpacing:3,textTransform:"uppercase"}}>execo</div>
      <p style={{color:DS.textSec,fontSize:13}}>Loading…</p>
    </div>
  );

  const pendingCount = submissions.filter(s=>s.status==="pending").length;

  return (
    <>
      <style>{gStyle}</style>
      {view==="login"     && <LoginScreen onSelect={(role,rep,user)=>{
        if(role==="manager"){setCurrentUser(user);setView("manager");}
        else if(role==="client"){setCurrentUser(user);setView("client");}
        else if(role==="team_lead"){setCurrentUser(user);setView("team_lead");}
        else{setCurrentRep(rep);setView("rep");}
      }} reps={data.reps} users={users}/>}
      {view==="manager"   && <ManagerView data={data} reload={reload} onLogout={()=>{setView("login");setCurrentUser(null);}} centreOpen={centreOpen} currentUser={currentUser} submissions={submissions} pendingCount={pendingCount} kpiFileName={kpiFileName} setKpiFileName={setKpiFileName}/>}
      {view==="team_lead" && <TeamLeadView currentUser={currentUser} data={data} reload={reload} onLogout={()=>{setView("login");setCurrentUser(null);}}/>}
      {view==="rep"       && <RepView repInfo={currentRep} data={data} reload={reload} onLogout={()=>setView("login")} centreOpen={centreOpen}/>}
      {view==="client"    && <ClientView currentUser={currentUser} data={data} reload={reload} onLogout={()=>{setView("login");setCurrentUser(null);}}/>}
    </>
  );
}
