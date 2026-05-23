import React, { useState, useEffect, useCallback, useRef } from "react";

// ── CONFIG ────────────────────────────────────────────────────────────
const SB_URL = "https://uektpsmcgagzxfoxavex.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVla3Rwc21jZ2Fnenhmb3hhdmV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTY0NDcsImV4cCI6MjA5MzU3MjQ0N30.eJ15qDLM2bCCR5zK1eiiKoXx_JJTsPhjuBjZdpoVWW0";
const MANAGER_PIN = "2024";
const HUB_ENABLED = True; // flip to true when approved
const HEALTH_MAX_SEC = 600;
const HEALTH_PER_DAY = 3;
const HEALTH_DAILY_BANK = HEALTH_MAX_SEC * HEALTH_PER_DAY; // 1800 sec = 30 min total per day
const LUNCH_LIMIT = 3;
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
const todayLabel = () => { const now=new Date(); const tz=Intl.DateTimeFormat().resolvedOptions().timeZone; const city=tz.split('/').pop().replace(/_/g,' '); return now.toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})+' · '+city; };
const fmtTime = s => { if(s<=0)return"0:00"; return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`; };
const fmtDur = s => { if(!s||s<=0)return"0m"; const h=Math.floor(s/3600),m=Math.floor((s%3600)/60); return h>0?`${h}h ${m}m`:`${m}m`; };
const elapsedSec = iso => Math.floor((Date.now()-new Date(iso).getTime())/1000);
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
  const t = await res.text(); return t ? JSON.parse(t) : [];
}
const sbPatch = (tbl,id,d) => sb(`${tbl}?id=eq.${id}`,{method:"PATCH",body:JSON.stringify(d)});
const sbPost  = (tbl,d)    => sb(tbl,{method:"POST",body:JSON.stringify(d)});
const sbDel   = (tbl,id)   => sb(`${tbl}?id=eq.${id}`,{method:"DELETE"});

async function loadAll() {
  const [reps,settArr,adHoc,swaps,activeBreaks,breakQueue,todayPTO] = await Promise.all([
    sb("rep_status?select=*&order=id"),
    sb("app_settings?id=eq.1"),
    sb("adhoc_lunch_requests?status=eq.pending&order=created_at.desc"),
    sb("lunch_swaps?status=in.(pending)&order=created_at.desc"),
    sb("break_log?ended_at=is.null&select=*"),
    sb(`break_queue?date=eq.${todayStr()}&status=in.(waiting,notified)&order=queued_at`),
    sb(`calloffs?calloff_date=eq.${todayStr()}&reason=eq.pto&select=rep_name`),
  ]);
  const settings = settArr[0]||{id:1,peak_mode:false,custom_limit:null,pto_seeded:false};
  // seed hardcoded PTO once
  if(!settings.pto_seeded) {
    try {
      for(const p of HARDCODED_PTO) {
        const rep = reps.find(r=>r.name===p.rep_name);
        if(rep) await sbPost("calloffs",{rep_id:rep.id,rep_name:p.rep_name,calloff_date:p.pto_date,reason:"pto",note:"Pre-loaded",logged_by:"system"}).catch(()=>{});
      }
      await sbPatch("app_settings",1,{pto_seeded:true});
    } catch(e) { console.warn("PTO seed error",e); }
  }
  // daily reset
  const today = businessDayStr();
  const todayPTONames = todayPTO.map(p=>p.rep_name);
  for(const r of reps) {
    if(r.updated_at && businessDayStr(r.updated_at) !== today && (r.health_breaks_today>0||r.health_time_banked>0)) {
      await sbPatch("rep_status",r.id,{health_breaks_today:0,health_time_today:0,health_time_banked:0,last_break_returned_at:null});
      r.health_breaks_today=0; r.health_time_today=0; r.health_time_banked=0; r.last_break_returned_at=null;
    }
    // auto-apply today's PTO from DB
    if(todayPTONames.includes(r.name) && r.status==="available") {
      await sbPatch("rep_status",r.id,{status:"pto",ooo_note:"PTO"});
      r.status="pto"; r.ooo_note="PTO";
    }
  }
  return { reps, settings, adHoc, swaps, activeBreaks, breakQueue:breakQueue||[] };
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
  const bg={approved:"#1a5c35",declined:"#7a1a1a",info:"#1565a8",ooo:"#7a1a5c",warn:"#b7770d"};
  const ic={approved:"✅",declined:"🚫",info:"ℹ️",ooo:"📅",warn:"⚠️"};
  return <div style={{position:"fixed",bottom:28,left:"50%",transform:"translateX(-50%)",background:bg[type]||"#333",color:"#fff",padding:"11px 22px",borderRadius:12,fontSize:13,fontWeight:500,zIndex:9999,display:"flex",alignItems:"center",gap:10,whiteSpace:"nowrap",boxShadow:"0 4px 24px rgba(0,0,0,0.2)",animation:"popIn .25s ease"}}><span>{ic[type]||"ℹ️"}</span>{msg}</div>;
}

function Modal({ title, sub, onClose, children, wide }) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9000,padding:16}} onClick={onClose}>
      <div style={{background:"#fffdf8",borderRadius:20,padding:"26px 22px",width:"100%",maxWidth:wide?560:340,maxHeight:"90vh",overflowY:"auto",animation:"popIn .22s ease"}} onClick={e=>e.stopPropagation()}>
        {sub&&<p style={{margin:"0 0 2px",fontSize:11,color:"#aaa",letterSpacing:1}}>{sub}</p>}
        <h2 style={{margin:"0 0 18px",fontSize:19,fontWeight:700,color:"#1a1a1a"}}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

function Btn({ label, onClick, color="#1a5c35", disabled, small, outline }) {
  const bg = outline?"transparent":disabled?"#ccc":color;
  const border = outline?`1.5px solid ${color}`:"none";
  const textColor = outline?color:"#fff";
  return <button onClick={onClick} disabled={disabled} style={{padding:small?"6px 12px":"11px 0",width:small?"auto":"100%",borderRadius:9,border,background:bg,color:textColor,cursor:disabled?"not-allowed":"pointer",fontSize:small?12:14,fontWeight:600,opacity:disabled?0.7:1}}>{label}</button>;
}

function StatusDot({ status }) {
  const cfg=ST[status]||ST.available;
  return <span style={{width:7,height:7,borderRadius:"50%",background:cfg.dot,display:"inline-block",flexShrink:0}}/>;
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
        <span style={{fontSize:11,color:"#666"}}>Health break</span>
        <span style={{fontSize:13,fontWeight:700,color}}>{over?`+${fmtTime(Math.abs(remaining))} over`:fmtTime(remaining)+" left"}</span>
      </div>
      <div style={{height:6,background:"#f0f0f0",borderRadius:3,overflow:"hidden"}}>
        <div style={{width:`${pct*100}%`,height:"100%",background:color,borderRadius:3,transition:"width 1s linear"}}/>
      </div>
      {over&&<p style={{margin:"4px 0 0",fontSize:11,color:"#e74c3c",fontWeight:600}}>⚠️ Time exceeded — please return to desk</p>}
    </div>
  );
}

// ── LOGIN ─────────────────────────────────────────────────────────────
function LoginScreen({ onSelect, reps }) {
  const [mode,setMode]=useState("choose");
  const [pin,setPin]=useState("");
  const [pinErr,setPinErr]=useState(false);
  const [search,setSearch]=useState("");
  const filtered=reps.filter(r=>r.name.toLowerCase().includes(search.toLowerCase()));

  if(mode==="choose") return (
    <div style={{minHeight:"100vh",background:"#f4f6f2",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{marginBottom:28,textAlign:"center"}}><div style={{fontSize:48,marginBottom:8}}>🌿</div>
        <h1 style={{margin:"0 0 6px",fontSize:26,fontWeight:800,color:"#1a1a1a"}}>ESC Break Manager</h1>
        <p style={{margin:0,fontSize:14,color:"#888"}}>{todayLabel()}</p>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:12,width:"100%",maxWidth:320}}>
        <button onClick={()=>setMode("pin")} style={{padding:"18px 24px",borderRadius:16,border:"2px solid #1a5c35",background:"#1a5c35",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:28}}>🎛️</span><div style={{textAlign:"left"}}><p style={{margin:0,fontSize:15,fontWeight:700}}>Manager View</p><p style={{margin:0,fontSize:12,opacity:.75}}>Full oversight & controls</p></div>
        </button>
        <button onClick={()=>setMode("rep")} style={{padding:"18px 24px",borderRadius:16,border:"2px solid #e8e8e8",background:"#fff",color:"#1a1a1a",cursor:"pointer",display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:28}}>👤</span><div style={{textAlign:"left"}}><p style={{margin:0,fontSize:15,fontWeight:700}}>Rep View</p><p style={{margin:0,fontSize:12,color:"#999"}}>Request your break</p></div>
        </button>
      </div>
    </div>
  );

  if(mode==="pin") return (
    <div style={{minHeight:"100vh",background:"#f4f6f2",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"#fff",borderRadius:20,padding:"32px 28px",width:"100%",maxWidth:320,boxShadow:"0 4px 24px rgba(0,0,0,.08)"}}>
        <button onClick={()=>setMode("choose")} style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:"#888",marginBottom:20,padding:0}}>← Back</button>
        <div style={{fontSize:36,marginBottom:12,textAlign:"center"}}>🔐</div>
        <h2 style={{margin:"0 0 20px",fontSize:18,fontWeight:700,textAlign:"center"}}>Manager PIN</h2>
        <input type="password" maxLength={4} value={pin} autoFocus
          onChange={e=>{setPin(e.target.value);setPinErr(false);}}
          onKeyDown={e=>{if(e.key==="Enter"){pin===MANAGER_PIN?onSelect("manager"):setPinErr(true);}}}
          placeholder="• • • •"
          style={{width:"100%",boxSizing:"border-box",padding:14,borderRadius:12,border:`1.5px solid ${pinErr?"#e74c3c":"#ddd"}`,fontSize:22,textAlign:"center",letterSpacing:8,outline:"none",marginBottom:8,background:"#fafafa"}}/>
        {pinErr&&<p style={{margin:"0 0 12px",fontSize:12,color:"#e74c3c",textAlign:"center"}}>Incorrect PIN</p>}
        <Btn label="Sign In" onClick={()=>{pin===MANAGER_PIN?onSelect("manager"):setPinErr(true);}}/>
        <p style={{margin:"14px 0 0",fontSize:11,color:"#ccc",textAlign:"center"}}>Default PIN: 1234</p>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:"#f4f6f2",display:"flex",flexDirection:"column",alignItems:"center",padding:24,paddingTop:40}}>
      <div style={{width:"100%",maxWidth:400}}>
        <button onClick={()=>setMode("choose")} style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:"#888",marginBottom:20,padding:0}}>← Back</button>
        <div style={{textAlign:"center",marginBottom:20}}><div style={{fontSize:32,marginBottom:8}}>👤</div><h2 style={{margin:"0 0 4px",fontSize:20,fontWeight:700}}>Who are you?</h2></div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search your name…" style={{width:"100%",boxSizing:"border-box",padding:"11px 14px",borderRadius:12,border:"1.5px solid #ddd",fontSize:14,marginBottom:10,background:"#fff",outline:"none"}}/>
        <div style={{display:"flex",flexDirection:"column",gap:7}}>
          {filtered.map(r=>(
            <button key={r.id} onClick={()=>onSelect("rep",r)} style={{padding:"12px 16px",borderRadius:12,border:"1.5px solid #e8e8e8",background:"#fff",cursor:"pointer",display:"flex",alignItems:"center",gap:12,textAlign:"left"}}>
              <div style={{width:36,height:36,borderRadius:"50%",background:"#eafaf1",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#1a5c35",flexShrink:0}}>{r.avatar||avatar(r.name)}</div>
              <div><p style={{margin:0,fontWeight:600,fontSize:14,color:"#1a1a1a"}}>{r.name}</p><p style={{margin:0,fontSize:11,color:"#aaa"}}>{r.timezone} · Banked: {fmtDur(r.health_time_banked||0)}/10m</p></div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── MANAGER VIEW ──────────────────────────────────────────────────────
function ManagerView({ data, reload, onLogout, centreOpen }) {
  const { reps, settings, adHoc, swaps, activeBreaks, breakQueue=[] } = data;
  const [tab, setTab] = useState("overview");
  const [toast, setToast] = useState(null);
  const fire = (type,msg) => setToast({type,msg,id:Date.now()});

  const activeReps = reps.filter(r=>!["off","pto","sick"].includes(r.status));
  const maxOut = settings.custom_limit ?? Math.floor(activeReps.length * 0.3);
  const totalOut = reps.filter(r=>["health","lunch"].includes(r.status)).length;
  const onHealth = reps.filter(r=>r.status==="health").length;
  const onLunch  = reps.filter(r=>r.status==="lunch").length;
  const hLimit = settings.peak_mode ? H_LIMIT_PEAK : H_LIMIT_NORMAL;
  const notifCount = adHoc.length + swaps.length;

  const tabs = [
    {k:"overview",l:"Overview"},
    {k:"requests",l:`Requests${notifCount>0?` (${notifCount})`:""}`,notif:notifCount>0},
    {k:"team",l:"Team"},
    {k:"schedules",l:"Schedules"},
    {k:"pto",l:"PTO"},
    {k:"reports",l:"Reports"},
    {k:"settings",l:"Settings"},
    {k:"enrolment",l:"📋 Enrolment"},
    {k:"pipeline",l:"📞 Pipeline"},
    ...(HUB_ENABLED?[{k:"hub",l:"🏊 Hub"}]:[]),
  ];

  return (
    <div style={{fontFamily:"'Segoe UI',system-ui,sans-serif",minHeight:"100vh",background:"#f4f6f2",paddingBottom:60}}>
      <style>{`@keyframes popIn{from{transform:scale(0.92);opacity:0}to{transform:scale(1);opacity:1}} *{box-sizing:border-box} button:active{opacity:.8}`}</style>
      {toast&&<Toast key={toast.id} msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}

      {/* Header */}
      <div style={{background:"#1a2e1a",padding:"18px 18px 14px",color:"#fff"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
          <div>
            <span style={{fontSize:10,background:"rgba(255,255,255,.15)",padding:"3px 8px",borderRadius:5,letterSpacing:1.5,fontWeight:700}}>MANAGER</span>
            <h1 style={{margin:"4px 0 2px",fontSize:19,fontWeight:800}}>Team Overview 🎛️</h1>
            <p style={{margin:0,fontSize:11,opacity:.55}}>{todayLabel()}</p>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
            <button onClick={onLogout} style={{padding:"5px 11px",borderRadius:8,border:"1px solid rgba(255,255,255,.2)",background:"transparent",color:"rgba(255,255,255,.7)",cursor:"pointer",fontSize:11}}>Sign Out</button>
            {settings.peak_mode&&<span style={{fontSize:10,background:"#e74c3c",padding:"3px 8px",borderRadius:5,fontWeight:700}}>⚡ PEAK MODE</span>}
          </div>
        </div>
        {!centreOpen&&<div style={{background:"rgba(255,200,0,.15)",borderRadius:8,padding:"6px 12px",marginBottom:10,fontSize:11,color:"#ffd700",fontWeight:600,textAlign:"center"}}>🌙 Centre closed — opens 2:00pm SAST · Showing next shift data</div>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:10}}>
          {[
            {n:reps.filter(r=>r.status==="available"&&centreOpen&&isRepOnShift(r)).length,l:"Available",c:"#27ae60"},
            {n:centreOpen?onHealth:0,l:`Health (/${hLimit})`,c:onHealth>=hLimit?"#e74c3c":"#2980b9"},
            {n:centreOpen?onLunch:0,l:`Lunch (/${LUNCH_LIMIT})`,c:onLunch>=LUNCH_LIMIT?"#e74c3c":"#e07b00"},
            {n:reps.filter(r=>["pto","sick","off"].includes(r.status)).length,l:"Out",c:"#8e44ad"},
          ].map(s=>(
            <div key={s.l} style={{background:"rgba(255,255,255,.1)",borderRadius:10,padding:"7px 6px",textAlign:"center"}}>
              <p style={{margin:0,fontSize:19,fontWeight:800,color:s.c}}>{s.n}</p>
              <p style={{margin:0,fontSize:9,opacity:.65,lineHeight:1.2}}>{s.l}</p>
            </div>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
          {[
            {icon:"👥",label:"Team Cap",val:`${totalOut}/${maxOut} out`,full:totalOut>=maxOut,color:"#8e44ad"},
            {icon:"🌿",label:"Health",val:`${onHealth}/${hLimit}`,full:onHealth>=hLimit,color:"#2980b9"},
            {icon:"🥗",label:"Lunch",val:`${onLunch}/${LUNCH_LIMIT}`,full:onLunch>=LUNCH_LIMIT,color:"#e07b00"},
          ].map(m=>(
            <div key={m.label} style={{background:"rgba(255,255,255,.08)",borderRadius:9,padding:"8px 10px",border:`1px solid ${m.full?"rgba(231,76,60,.5)":"rgba(255,255,255,.1)"}`}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                <span style={{fontSize:10,opacity:.8}}>{m.icon} {m.label}</span>
                <span style={{fontSize:12,fontWeight:700,color:m.full?"#e74c3c":"#fff"}}>{m.val}</span>
              </div>
              <div style={{height:3,background:"rgba(255,255,255,.15)",borderRadius:2}}>
                <div style={{width:`${Math.min((m.full?1:0),1)*100||0}%`,height:"100%",background:m.full?"#e74c3c":m.color,borderRadius:2}}/>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{background:"#fff",borderBottom:"1.5px solid #ebebeb",overflowX:"auto"}}>
        <div style={{display:"flex",padding:"0 16px",minWidth:"max-content"}}>
          {tabs.map(t=>(
            <button key={t.k} onClick={()=>setTab(t.k)} style={{padding:"11px 14px",border:"none",background:"none",cursor:"pointer",fontSize:12,fontWeight:tab===t.k?700:500,color:tab===t.k?"#1a5c35":t.notif?"#e07b00":"#999",borderBottom:tab===t.k?"2.5px solid #1a5c35":"2.5px solid transparent",marginBottom:-1.5,transition:"all .15s",whiteSpace:"nowrap"}}>{t.l}</button>
          ))}
        </div>
      </div>

      <div style={{padding:"0 14px",maxWidth:640,margin:"0 auto"}}>
        {tab==="overview"  &&<MgrOverview reps={reps} activeBreaks={activeBreaks} hLimit={hLimit} maxOut={maxOut} reload={reload} fire={fire} settings={settings} centreOpen={centreOpen}/>}
        {tab==="requests"  &&<MgrRequests adHoc={adHoc} swaps={swaps} reps={reps} reload={reload} fire={fire}/>}
        {tab==="team"      &&<MgrTeam reps={reps} settings={settings} reload={reload} fire={fire}/>}
        {tab==="schedules" &&<MgrSchedules reps={reps} reload={reload} fire={fire}/>}
        {tab==="reports"   &&<MgrReports reps={reps}/>}
        {tab==="settings"  &&<MgrSettings settings={settings} reps={reps} reload={reload} fire={fire}/>}
        {tab==="pto"       &&<MgrPTO reps={reps} reload={reload} fire={fire}/> }
        {tab==="enrolment"&&<EnrolmentBoard reps={reps} reload={reload} fire={fire} currentRepId={null} isManager={true}/>}
        {tab==="pipeline"&&<MgrPipeline reps={reps}/>}
        {tab==="hub"&&HUB_ENABLED&&<HubView isManager={true}/>}
      </div>
    </div>
  );
}

// ── MGR: OVERVIEW ─────────────────────────────────────────────────────
function MgrOverview({ reps, activeBreaks, hLimit, maxOut, reload, fire, settings, centreOpen }) {
  const [oooModal, setOooModal] = useState(null);
  const [peakOverride, setPeakOverride] = useState({});

  const handleReturn = async (rep) => {
    const ab = activeBreaks.find(b=>b.rep_id===rep.id);
    const durSec = ab ? elapsedSec(ab.started_at) : 0;
    const newBanked = (rep.health_time_banked||0) + durSec;
    const updates = { status:"available", updated_at: new Date().toISOString() };
    if(rep.status==="health") {
      if(newBanked >= HEALTH_MAX_SEC) {
        updates.health_time_banked = HEALTH_MAX_SEC; // mark as full
        updates.last_break_returned_at = new Date().toISOString();
        updates.health_breaks_today = (rep.health_breaks_today||0)+1;
        if((rep.health_breaks_today||0)+1>=HEALTH_PER_DAY) fire("warn",`⚠️ ${rep.name} has used all ${HEALTH_PER_DAY} full breaks today`);
      } else {
        updates.health_time_banked = newBanked;
      }
    }
    if(ab) {
      await sb(`break_log?id=eq.${ab.id}`,{method:"PATCH",body:JSON.stringify({ended_at:new Date().toISOString(),duration_seconds:durSec})});
    }
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

  const onBreak = centreOpen ? reps.filter(r=>r.status==="health"||r.status==="lunch") : [];
  const available = reps.filter(r=>r.status==="available" && centreOpen && isRepOnShift(r));
  const offShift = reps.filter(r=>r.status==="available" && (!centreOpen || !isRepOnShift(r)));
  const out = reps.filter(r=>["pto","sick","off"].includes(r.status));

  function RepRow({rep}) {
    const effectiveStatus = (rep.status==="available" && (!centreOpen || !isRepOnShift(rep))) ? "off_shift" : rep.status;
    const cfg=ST[effectiveStatus]||ST.available;
    const isBreak=rep.status==="health"||rep.status==="lunch";
    const isOOO=rep.status==="pto"||rep.status==="sick";
    const isOff=rep.status==="off"||effectiveStatus==="off_shift";
    const tz=TZ_C[rep.timezone]||TZ_C.Central;
    const ab=activeBreaks.find(b=>b.rep_id===rep.id);
    return (
      <div style={{background:cfg.bg,borderRadius:12,padding:"10px 13px",border:`1.5px solid ${cfg.border}`,marginBottom:6}}>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <div style={{width:34,height:34,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,flexShrink:0,background:isOOO?"#ede0f5":isOff?"#eee":isBreak?(rep.status==="health"?"#d6eaf8":"#fdebd0"):"#eafaf1",color:isOOO?"#7a1a5c":isOff?"#bbb":isBreak?(rep.status==="health"?"#1a6291":"#9c5a00"):"#1a5c35"}}>{rep.avatar||avatar(rep.name)}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
              <span style={{fontWeight:600,fontSize:13,color:isOff?"#bbb":"#1a1a1a"}}>{rep.name}</span>
              <span style={{fontSize:9,padding:"2px 5px",borderRadius:4,background:tz.bg,color:tz.text,fontWeight:700}}>{rep.timezone}</span>
              <span style={{fontSize:9,padding:"2px 5px",borderRadius:4,background:cfg.bg,color:cfg.dot,border:`1px solid ${cfg.border}`,fontWeight:600}}>{cfg.label}</span>
              {settings.peak_mode&&rep.status==="health"&&peakOverride[rep.id]&&<span style={{fontSize:9,background:"#fff3cd",color:"#856404",padding:"2px 5px",borderRadius:4}}>Override</span>}
            </div>
            {rep.ooo_note&&<p style={{margin:"2px 0 0",fontSize:10,color:"#aaa"}}>{rep.ooo_note}</p>}
            {rep.status==="health"&&ab&&<HealthTimer startedAt={ab.started_at} bankedSec={rep.health_time_banked||0}/>}
            {rep.status==="health"&&<p style={{margin:"2px 0 0",fontSize:10,color:"#888"}}>Breaks today: {rep.health_breaks_today||0}/{HEALTH_PER_DAY}</p>}
          </div>
          <div style={{display:"flex",gap:5,flexShrink:0,flexDirection:"column",alignItems:"flex-end"}}>
            {isBreak&&<button onClick={()=>handleReturn(rep)} style={{padding:"5px 9px",borderRadius:7,border:"1.5px solid #ddd",background:"#fff",cursor:"pointer",fontSize:11,color:"#555",fontWeight:600}}>Back 👋</button>}
            {isOOO&&<button onClick={()=>handleClear(rep)} style={{padding:"5px 9px",borderRadius:7,border:"1.5px solid #c8a8e0",background:"#f5eefb",cursor:"pointer",fontSize:11,color:"#7a1a5c",fontWeight:600}}>Clear</button>}
            {!isBreak&&!isOOO&&!isOff&&<button onClick={()=>setOooModal(rep)} style={{padding:"5px 9px",borderRadius:7,border:"1.5px solid #ebebeb",background:"#fafafa",cursor:"pointer",fontSize:10,color:"#aaa"}}>Mark Out</button>}
            {settings.peak_mode&&rep.status==="health"&&<button onClick={()=>handleOverridePeak(rep)} style={{padding:"4px 8px",borderRadius:6,border:"1.5px solid #f0ad4e",background:"#fff3cd",cursor:"pointer",fontSize:10,color:"#856404"}}>Override</button>}
            {!isOff&&<button onClick={()=>resetBalance(rep)} style={{padding:"4px 8px",borderRadius:6,border:"1.5px solid #f5b7b1",background:"#fdf0ee",cursor:"pointer",fontSize:10,color:"#c0392b"}}>Reset Breaks</button>}
          </div>
        </div>
      </div>
    );
  }

  // ── Lunch schedule analysis for today ─────────────────────────────
  const todayKey = todayDay();

  // Detect viewer's timezone from browser offset and map to app TZ label
  const viewerOffsetMin = -(new Date().getTimezoneOffset()); // e.g. +120 for SAST
  const viewerTz = Object.entries(TZ_OFFSET).reduce((best,[label,offset])=>
    Math.abs(offset-viewerOffsetMin) < Math.abs((TZ_OFFSET[best]??Infinity)-viewerOffsetMin) ? label : best
  , "Central");

  const lunchSlots = reps
    .filter(r => isRepOnShift(r) && !["off","pto","sick"].includes(r.status))
    .map(r => {
      const sched = (r.lunch_schedule||{})[todayKey];
      if(!sched?.time && !sched?.start) return null;
      const repTz = r.timezone||"Central";
      const converted = sched?.time ? convertLunchTime(sched.time, repTz, viewerTz) : null;
      const shiftStart = sched?.start ? convertLunchTime(sched.start, repTz, viewerTz) : null;
      const shiftEnd   = sched?.end   ? convertLunchTime(sched.end,   repTz, viewerTz) : null;
      return { rep: r, time: converted, shiftStart, shiftEnd, rawTime: sched?.time, repTz, duration: sched?.duration||60 };
    })
    .filter(Boolean);

  // Group by converted time to find conflicts (times now all in viewer's tz)
  const slotGroups = lunchSlots.reduce((acc, x) => {
    acc[x.time] = acc[x.time] || [];
    acc[x.time].push(x);
    return acc;
  }, {});
  const conflictSlots = Object.entries(slotGroups).filter(([,group]) => group.length >= LUNCH_LIMIT);

  return (
    <div style={{marginTop:16}}>
      {oooModal&&(
        <OOOModal rep={oooModal} onClose={()=>setOooModal(null)} onMark={handleMarkOOO}/>
      )}

      {/* Lunch conflict warnings */}
      {conflictSlots.length>0&&(
        <div style={{background:"#fff8ee",border:"1.5px solid #e07b00",borderRadius:12,padding:"12px 14px",marginBottom:14}}>
          <p style={{margin:"0 0 8px",fontSize:12,fontWeight:800,color:"#b85c00"}}>⚠️ Lunch Conflicts Today</p>
          {conflictSlots.map(([time, group])=>(
            <div key={time} style={{marginBottom:6}}>
              <span style={{fontSize:11,fontWeight:700,color:"#b85c00"}}>{fmt12h(time)} {viewerTz} — {group.length} reps scheduled ({LUNCH_LIMIT} max): </span>
              <span style={{fontSize:11,color:"#888"}}>{group.map(x=>x.rep.name).join(", ")}</span>
            </div>
          ))}
          <p style={{margin:"8px 0 0",fontSize:10,color:"#aaa"}}>Ad hoc requests during these windows will push you over the limit.</p>
        </div>
      )}

      {/* Today's lunch schedule strip */}
      {lunchSlots.length>0&&(
        <div style={{background:"#fff",border:"1.5px solid #efefef",borderRadius:12,padding:"12px 14px",marginBottom:14}}>
          <p style={{margin:"0 0 2px",fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:"#bbb"}}>🥗 Today's Lunch Schedule</p>
          <p style={{margin:"0 0 10px",fontSize:10,color:"#ccc"}}>Times shown in your timezone: <strong style={{color:"#aaa"}}>{viewerTz}</strong></p>
          <div style={{display:"flex",flexDirection:"column",gap:5}}>
            {[...lunchSlots].sort((a,b)=>(a.shiftStart||a.time||"").localeCompare(b.shiftStart||b.time||"")).map(({rep,time,shiftStart,shiftEnd,repTz,duration})=>{
              const sameSlotCount = time ? (slotGroups[time]?.length||1) : 1;
              const isConflict = sameSlotCount >= LUNCH_LIMIT;
              const diffTz = repTz !== viewerTz;
              return (
                <div key={rep.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 8px",borderRadius:8,background:isConflict?"#fff8ee":"#f9f9f9",border:`1px solid ${isConflict?"#f0a500":"#eee"}`}}>
                  <div style={{display:"flex",alignItems:"center",gap:7}}>
                    <div style={{width:24,height:24,borderRadius:"50%",background:rep.status==="lunch"?"#e07b00":"#eafaf1",color:rep.status==="lunch"?"#fff":"#1a5c35",fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{rep.avatar||avatar(rep.name)}</div>
                    <div>
                      <div style={{display:"flex",alignItems:"center",gap:5}}>
                        <span style={{fontSize:12,fontWeight:600,color:rep.status==="lunch"?"#e07b00":"#333"}}>{rep.name}</span>
                        {diffTz&&<span style={{fontSize:9,color:"#ccc"}}>{repTz}</span>}
                        {rep.status==="lunch"&&<span style={{fontSize:9,background:"#fdebd0",color:"#9c5a00",padding:"1px 5px",borderRadius:4,fontWeight:700}}>ON LUNCH</span>}
                      </div>
                      {(shiftStart||shiftEnd)&&<div style={{fontSize:10,color:"#aaa",marginTop:1}}>Shift: {shiftStart?fmt12h(shiftStart):"?"} – {shiftEnd?fmt12h(shiftEnd):"?"}</div>}
                    </div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2}}>
                    {isConflict&&<span style={{fontSize:9,color:"#b85c00",fontWeight:700}}>⚠️ {sameSlotCount} at once</span>}
                    {time&&<span style={{fontSize:12,fontWeight:700,color:isConflict?"#b85c00":"#555"}}>🥗 {fmt12h(time)} <span style={{fontSize:10,fontWeight:400,color:"#aaa"}}>{duration===30?"30m":"1hr"}</span></span>}
                    {!time&&<span style={{fontSize:10,color:"#ccc"}}>No lunch set</span>}
                  </div>
                </div>
              );
            })}
          </div>
          {(() => {
            const onShiftCount = reps.filter(r=>isRepOnShift(r)&&!["off","pto","sick"].includes(r.status)).length;
            const noSchedule = onShiftCount - lunchSlots.length;
            return noSchedule > 0 ? <p style={{margin:"8px 0 0",fontSize:10,color:"#ccc"}}>{noSchedule} rep(s) have no schedule set for today.</p> : null;
          })()}
        </div>
      )}

      {onBreak.length>0&&<Section title="🌿🥗 On Break" items={onBreak} Row={RepRow} color="#2980b9"/>}
      {available.length>0&&<Section title="✅ Available" items={available} Row={RepRow} color="#1a5c35"/>}
      {offShift.length>0&&<Section title="🌙 Off Shift" items={offShift} Row={RepRow} color="#999"/>}
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
      <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Note (e.g. back Monday)" style={{width:"100%",padding:"10px 12px",borderRadius:9,border:"1.5px solid #ddd",fontSize:13,marginBottom:14,background:"#fafafa",outline:"none"}}/>
      <div style={{display:"flex",gap:8}}>
        <Btn label="Cancel" onClick={onClose} color="#888" outline small/>
        <Btn label="Mark Absence" onClick={()=>onMark(type,note)} color="#8e44ad"/>
      </div>
    </Modal>
  );
}

// ── MGR: REQUESTS ─────────────────────────────────────────────────────
function MgrRequests({ adHoc, swaps, reps, reload, fire }) {
  const handleAdHoc = async (req, approve) => {
    await sbPatch("adhoc_lunch_requests",req.id,{status:approve?"approved":"declined"});
    if(approve) {
      const rep = reps.find(r=>r.id===req.rep_id);
      if(rep) {
        await sbPatch("rep_status",rep.id,{status:"lunch",updated_at:new Date().toISOString()});
        await sbPost("break_log",{rep_id:rep.id,rep_name:rep.name,break_type:"lunch"});
      }
      fire("approved",`Ad hoc lunch approved for ${req.rep_name}`);
    } else {
      fire("declined",`Ad hoc lunch declined for ${req.rep_name}`);
    }
    reload();
  };

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
        fire("approved",`Lunch swap approved ✓`);
      } else {
        fire("info","Swap declined");
      }
      reload();
    } catch(e) {
      fire("declined",`Error: ${e.message}`);
    }
  };

  const onLunchNow = reps.filter(r=>r.status==="lunch").length;

  return (
    <div style={{marginTop:16}}>
      {adHoc.length===0&&swaps.length===0&&(
        <div style={{textAlign:"center",padding:"44px 0",color:"#bbb"}}>
          <p style={{fontSize:32,margin:"0 0 8px"}}>✅</p>
          <p style={{fontWeight:600,fontSize:15,color:"#888"}}>No pending requests</p>
        </div>
      )}
      {adHoc.length>0&&(
        <div style={{marginBottom:20}}>
          <p style={{fontSize:10,letterSpacing:1.8,textTransform:"uppercase",color:"#e07b00",margin:"0 0 8px",fontWeight:700}}>🥗 Ad Hoc Lunch Requests ({adHoc.length})</p>
          {adHoc.map(r=>(
            <div key={r.id} style={{background:"#fff8ee",border:`1.5px solid ${onLunchNow>=LUNCH_LIMIT?"#e74c3c":"#f0c080"}`,borderRadius:12,padding:"12px 14px",marginBottom:8}}>
              {onLunchNow>=LUNCH_LIMIT&&(
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8,background:"#fdf0ee",borderRadius:8,padding:"6px 10px"}}>
                  <span style={{fontSize:12}}>🚨</span>
                  <span style={{fontSize:11,fontWeight:700,color:"#c0392b"}}>{onLunchNow}/{LUNCH_LIMIT} reps already on lunch — approving this will exceed the limit</span>
                </div>
              )}
              {onLunchNow>0&&onLunchNow<LUNCH_LIMIT&&(
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8,background:"#fff3e0",borderRadius:8,padding:"6px 10px"}}>
                  <span style={{fontSize:11,fontWeight:600,color:"#b85c00"}}>⚠️ {onLunchNow}/{LUNCH_LIMIT} reps currently on lunch</span>
                </div>
              )}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
                <div>
                  <p style={{margin:0,fontWeight:600,fontSize:14}}>{r.rep_name}</p>
                  <p style={{margin:"2px 0 0",fontSize:12,color:"#888"}}>Requested: {r.requested_time}</p>
                  {r.approved_for&&<p style={{margin:"2px 0 0",fontSize:11,color:"#aaa"}}>Requested for: {r.approved_for}</p>}
                </div>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={()=>handleAdHoc(r,false)} style={{padding:"6px 12px",borderRadius:8,border:"1.5px solid #f5b7b1",background:"#fdf0ee",cursor:"pointer",fontSize:12,color:"#c0392b",fontWeight:600}}>Decline</button>
                  <button onClick={()=>handleAdHoc(r,true)} style={{padding:"6px 12px",borderRadius:8,border:"none",background:onLunchNow>=LUNCH_LIMIT?"#c0392b":"#1a5c35",cursor:"pointer",fontSize:12,color:"#fff",fontWeight:600}}>{onLunchNow>=LUNCH_LIMIT?"⚠️ Approve Anyway":"Approve"}</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {swaps.length>0&&(
        <div>
          <p style={{fontSize:10,letterSpacing:1.8,textTransform:"uppercase",color:"#8e44ad",margin:"0 0 8px",fontWeight:700}}>🔄 Lunch Swap Requests ({swaps.length})</p>
          {swaps.map(s=>(
            <div key={s.id} style={{background:"#f5eefb",border:"1.5px solid #d7aef0",borderRadius:12,padding:"12px 14px",marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
                <div>
                  <p style={{margin:0,fontWeight:600,fontSize:14}}>{s.requester_name} ↔ {s.target_name}</p>
                  <p style={{margin:"3px 0 0",fontSize:12,color:"#888"}}>{s.requester_name}: {s.requester_date} · {s.target_name}: {s.target_date}</p>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={()=>handleSwap(s,false)} style={{padding:"6px 12px",borderRadius:8,border:"1.5px solid #f5b7b1",background:"#fdf0ee",cursor:"pointer",fontSize:12,color:"#c0392b",fontWeight:600}}>Decline</button>
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
  const [extraDayModal, setExtraDayModal] = useState(null); // rep

  const today = DAYS[new Date().getDay()]; // e.g. "Mon"

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

  const handleAddExtraDay = async (rep) => {
    const existing = rep.shift_days||[];
    if(existing.includes(today)){fire("info",`${rep.name} already has ${today} scheduled`);setExtraDayModal(null);return;}
    const updated = [...existing, today];
    await sbPatch("rep_status",rep.id,{shift_days:updated,updated_at:new Date().toISOString()});
    fire("approved",`${rep.name} added for ${today} — they'll count as on-shift today`);
    setExtraDayModal(null); reload();
  };

  return (
    <div style={{marginTop:16}}>
      {addModal&&<AddRepModal onClose={()=>setAddModal(false)} onAdd={async(d)=>{await sbPost("rep_status",d);fire("approved",`${d.name} added`);setAddModal(false);reload();}}/>}
      {deleteModal&&(
        <Modal title={`Delete ${deleteModal.name}?`} sub="PERMANENT" onClose={()=>{setDeleteModal(null);setDeleteConfirm("");}}>
          <p style={{fontSize:13,color:"#888",marginBottom:14}}>This will permanently remove {deleteModal.name} and all their break history. Type their name to confirm.</p>
          <input value={deleteConfirm} onChange={e=>setDeleteConfirm(e.target.value)} placeholder={deleteModal.name} style={{width:"100%",padding:"10px 12px",borderRadius:9,border:"1.5px solid #ddd",fontSize:13,marginBottom:14,outline:"none"}}/>
          <div style={{display:"flex",gap:8}}>
            <Btn label="Cancel" onClick={()=>{setDeleteModal(null);setDeleteConfirm("");}} outline color="#888" small/>
            <Btn label="Delete Permanently" onClick={handleDelete} color="#e74c3c"/>
          </div>
        </Modal>
      )}
      {extraDayModal&&(
        <Modal title={`Add extra day for ${extraDayModal.name}?`} sub="EXTRA DAY WORKED" onClose={()=>setExtraDayModal(null)}>
          <p style={{fontSize:13,color:"#666",marginBottom:6}}>
            This will add <strong>{today}</strong> to {extraDayModal.name}'s scheduled days so they count as on-shift today and their time is tracked correctly.
          </p>
          <p style={{fontSize:11,color:"#aaa",marginBottom:16}}>
            Current schedule: <strong>{(extraDayModal.shift_days||[]).join(", ")||"None set"}</strong>
          </p>
          <div style={{display:"flex",gap:8}}>
            <Btn label="Cancel" onClick={()=>setExtraDayModal(null)} outline color="#888" small/>
            <Btn label={`Add ${today} for ${extraDayModal.name}`} onClick={()=>handleAddExtraDay(extraDayModal)} color="#1a5c35"/>
          </div>
        </Modal>
      )}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <p style={{fontSize:10,letterSpacing:1.8,textTransform:"uppercase",color:"#bbb",margin:0,fontWeight:700}}>Team ({reps.length})</p>
        <button onClick={()=>setAddModal(true)} style={{padding:"6px 14px",borderRadius:8,border:"none",background:"#1a5c35",color:"#fff",cursor:"pointer",fontSize:12,fontWeight:600}}>+ Add Rep</button>
      </div>
      {reps.map(rep=>{
        const cfg=ST[rep.status]||ST.available;
        const tz=TZ_C[rep.timezone]||TZ_C.Central;
        const cooldownActive = !!(rep.health_time_banked>=HEALTH_MAX_SEC && rep.last_break_returned_at && elapsedSec(rep.last_break_returned_at)<COOLDOWN_SEC);
        const cooldownLeft = cooldownActive ? COOLDOWN_SEC - elapsedSec(rep.last_break_returned_at) : 0;
        const scheduledToday = (rep.shift_days||[]).includes(today);
        const onShift = isRepOnShift(rep);
        return (
          <div key={rep.id} style={{background:"#fff",border:"1.5px solid #efefef",borderRadius:12,padding:"11px 13px",marginBottom:7}}>
            <div style={{display:"flex",alignItems:"center",gap:9}}>
              <div style={{width:34,height:34,borderRadius:"50%",background:"#eafaf1",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"#1a5c35",flexShrink:0}}>{rep.avatar||avatar(rep.name)}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
                  <span style={{fontWeight:600,fontSize:13}}>{rep.name}</span>
                  <span style={{fontSize:9,padding:"2px 5px",borderRadius:4,background:tz.bg,color:tz.text,fontWeight:700}}>{rep.timezone}</span>
                  <StatusDot status={rep.status}/>
                  <span style={{fontSize:11,color:cfg.dot}}>{cfg.label}</span>
                  {!onShift&&!["off","pto","sick"].includes(rep.status)&&<span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:"#f5f5f5",color:"#bbb",fontWeight:700}}>OFF SHIFT</span>}
                </div>
                <div style={{display:"flex",gap:10,marginTop:3,flexWrap:"wrap"}}>
                  <span style={{fontSize:10,color:"#aaa"}}>🌿 {rep.health_breaks_today||0}/{HEALTH_PER_DAY} today</span>
                  {cooldownActive&&<span style={{fontSize:10,color:"#e07b00"}}>⏳ Cooldown: {fmtTime(cooldownLeft)}</span>}
                  {(rep.health_time_banked||0)>0&&<span style={{fontSize:10,color:"#888"}}>Banked: {fmtDur(rep.health_time_banked)}</span>}
                </div>
              </div>
              <div style={{display:"flex",gap:5,flexShrink:0,flexWrap:"wrap",justifyContent:"flex-end"}}>
                {!scheduledToday&&!["off","pto","sick"].includes(rep.status)&&(
                  <button onClick={()=>setExtraDayModal(rep)} style={{padding:"4px 8px",borderRadius:6,border:"1.5px solid #1a5c35",background:"#f0faf4",cursor:"pointer",fontSize:10,color:"#1a5c35",fontWeight:600}}>+ Extra day</button>
                )}
                <button onClick={()=>handleLogCalloff(rep)} style={{padding:"4px 8px",borderRadius:6,border:"1.5px solid #f5b7b1",background:"#fdf0ee",cursor:"pointer",fontSize:10,color:"#c0392b",fontWeight:600}}>Call-off</button>
                <button onClick={()=>setDeleteModal(rep)} style={{padding:"4px 8px",borderRadius:6,border:"1.5px solid #ddd",background:"#fff",cursor:"pointer",fontSize:10,color:"#aaa"}}>Delete</button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AddRepModal({ onClose, onAdd }) {
  const [form,setForm]=useState({name:"",timezone:"Central",shift_days:[],lunch_schedule:{},health_breaks_today:0,health_time_banked:0,status:"available",ooo_note:""});
  const set = (k,v) => setForm(p=>({...p,[k]:v}));
  const toggleDay = d => set("shift_days",form.shift_days.includes(d)?form.shift_days.filter(x=>x!==d):[...form.shift_days,d]);
  const setDay = (day,field,val) => setForm(prev=>({...prev,lunch_schedule:{...prev.lunch_schedule,[day]:{...(prev.lunch_schedule[day]||{start:"",end:"",time:"",duration:60}),[field]:val}}}));
  return (
    <Modal title="Add Team Member" sub="NEW REP" onClose={onClose} wide>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div>
          <label style={{fontSize:12,color:"#666",display:"block",marginBottom:4}}>Full Name</label>
          <input value={form.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. Jordan Smith" style={{width:"100%",padding:"9px 12px",borderRadius:9,border:"1.5px solid #ddd",fontSize:13,outline:"none"}}/>
        </div>
        <div>
          <label style={{fontSize:12,color:"#666",display:"block",marginBottom:4}}>Timezone</label>
          <select value={form.timezone} onChange={e=>set("timezone",e.target.value)} style={{width:"100%",padding:"9px 12px",borderRadius:9,border:"1.5px solid #ddd",fontSize:13,outline:"none",background:"#fff"}}>
            {TZLIST.map(t=><option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={{fontSize:12,color:"#666",display:"block",marginBottom:6}}>Working Days</label>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {DAYS.map(d=>(
              <div key={d} onClick={()=>toggleDay(d)} style={{padding:"5px 10px",borderRadius:8,border:form.shift_days.includes(d)?"2px solid #1a5c35":"1.5px solid #ddd",background:form.shift_days.includes(d)?"#f0faf4":"#fff",cursor:"pointer",fontSize:12,fontWeight:600,color:form.shift_days.includes(d)?"#1a5c35":"#555"}}>{d}</div>
            ))}
          </div>
        </div>
        {form.shift_days.length>0&&(
          <div>
            <label style={{fontSize:12,color:"#666",display:"block",marginBottom:6}}>Schedule Per Day</label>
            <div style={{display:"grid",gridTemplateColumns:"44px 1fr 1fr 1fr 70px",gap:6,marginBottom:4}}>
              <span style={{fontSize:10,color:"#aaa",fontWeight:600}}>Day</span>
              <span style={{fontSize:10,color:"#aaa",fontWeight:600}}>Start</span>
              <span style={{fontSize:10,color:"#aaa",fontWeight:600}}>End</span>
              <span style={{fontSize:10,color:"#aaa",fontWeight:600}}>Lunch time</span>
              <span style={{fontSize:10,color:"#aaa",fontWeight:600}}>Duration</span>
            </div>
            {form.shift_days.map(d=>(
              <div key={d} style={{display:"grid",gridTemplateColumns:"44px 1fr 1fr 1fr 70px",gap:6,alignItems:"center",marginBottom:7}}>
                <span style={{fontSize:12,fontWeight:700,color:"#1a5c35"}}>{d}</span>
                <div style={{display:"flex",gap:2,alignItems:"center"}}>
                    <select value={((form.lunch_schedule[d]||{}).start||"").split(":")[0]||""} onChange={e=>setDay(d,"start",`${e.target.value.padStart(2,"0")}:${((form.lunch_schedule[d]||{}).start||"").split(":")[1]||"00"}`)} style={{padding:"4px 3px",borderRadius:6,border:"1.5px solid #ddd",fontSize:10,outline:"none",background:"#fff",width:46}}>
                      <option value="">HH</option>
                      {Array.from({length:24},(_,i)=><option key={i} value={String(i).padStart(2,"0")}>{String(i).padStart(2,"0")}</option>)}
                    </select>
                    <span style={{fontSize:11,color:"#bbb"}}>:</span>
                    <select value={((form.lunch_schedule[d]||{}).start||"").split(":")[1]||""} onChange={e=>setDay(d,"start",`${((form.lunch_schedule[d]||{}).start||"").split(":")[0]||"00"}:${e.target.value}`)} style={{padding:"4px 3px",borderRadius:6,border:"1.5px solid #ddd",fontSize:10,outline:"none",background:"#fff",width:42}}>
                      <option value="">MM</option>
                      {["00","15","30","45"].map(m=><option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                <div style={{display:"flex",gap:2,alignItems:"center"}}>
                    <select value={((form.lunch_schedule[d]||{}).end||"").split(":")[0]||""} onChange={e=>setDay(d,"end",`${e.target.value.padStart(2,"0")}:${((form.lunch_schedule[d]||{}).end||"").split(":")[1]||"00"}`)} style={{padding:"4px 3px",borderRadius:6,border:"1.5px solid #ddd",fontSize:10,outline:"none",background:"#fff",width:46}}>
                      <option value="">HH</option>
                      {Array.from({length:24},(_,i)=><option key={i} value={String(i).padStart(2,"0")}>{String(i).padStart(2,"0")}</option>)}
                    </select>
                    <span style={{fontSize:11,color:"#bbb"}}>:</span>
                    <select value={((form.lunch_schedule[d]||{}).end||"").split(":")[1]||""} onChange={e=>setDay(d,"end",`${((form.lunch_schedule[d]||{}).end||"").split(":")[0]||"00"}:${e.target.value}`)} style={{padding:"4px 3px",borderRadius:6,border:"1.5px solid #ddd",fontSize:10,outline:"none",background:"#fff",width:42}}>
                      <option value="">MM</option>
                      {["00","15","30","45"].map(m=><option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                <div style={{display:"flex",gap:2,alignItems:"center"}}>
                    <select value={((form.lunch_schedule[d]||{}).time||"").split(":")[0]||""} onChange={e=>setDay(d,"time",`${e.target.value.padStart(2,"0")}:${((form.lunch_schedule[d]||{}).time||"").split(":")[1]||"00"}`)} style={{padding:"4px 3px",borderRadius:6,border:"1.5px solid #ddd",fontSize:10,outline:"none",background:"#fff",width:46}}>
                      <option value="">HH</option>
                      {Array.from({length:24},(_,i)=><option key={i} value={String(i).padStart(2,"0")}>{String(i).padStart(2,"0")}</option>)}
                    </select>
                    <span style={{fontSize:11,color:"#bbb"}}>:</span>
                    <select value={((form.lunch_schedule[d]||{}).time||"").split(":")[1]||""} onChange={e=>setDay(d,"time",`${((form.lunch_schedule[d]||{}).time||"").split(":")[0]||"00"}:${e.target.value}`)} style={{padding:"4px 3px",borderRadius:6,border:"1.5px solid #ddd",fontSize:10,outline:"none",background:"#fff",width:42}}>
                      <option value="">MM</option>
                      {["00","15","30","45"].map(m=><option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                <select value={(form.lunch_schedule[d]||{}).duration||60} onChange={e=>setDay(d,"duration",parseInt(e.target.value))} style={{padding:"6px 7px",borderRadius:7,border:"1.5px solid #ddd",fontSize:11,outline:"none",background:"#fff"}}>
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
function MgrSchedules({ reps, reload, fire }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});

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
  const setDay = (day,field,val) => setForm(prev=>({...prev,lunch_schedule:{...prev.lunch_schedule,[day]:{...(prev.lunch_schedule[day]||{start:"",end:"",time:"",duration:60}),[field]:val}}}))

  return (
    <div style={{marginTop:16}}>
      {editing&&(
        <Modal title={`Edit ${editing.name}`} sub="SCHEDULE" onClose={()=>setEditing(null)} wide>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div>
                <label style={{fontSize:12,color:"#666",display:"block",marginBottom:4}}>Name</label>
                <input value={form.name} onChange={e=>set("name",e.target.value)} style={{width:"100%",padding:"9px 12px",borderRadius:9,border:"1.5px solid #ddd",fontSize:13,outline:"none"}}/>
              </div>
              <div>
                <label style={{fontSize:12,color:"#666",display:"block",marginBottom:4}}>Timezone</label>
                <select value={form.timezone} onChange={e=>set("timezone",e.target.value)} style={{width:"100%",padding:"9px 12px",borderRadius:9,border:"1.5px solid #ddd",fontSize:13,outline:"none",background:"#fff"}}>
                  {TZLIST.map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={{fontSize:12,color:"#666",display:"block",marginBottom:6}}>Working Days</label>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {DAYS.map(d=>(
                  <div key={d} onClick={()=>toggleDay(d)} style={{padding:"5px 10px",borderRadius:8,border:form.shift_days.includes(d)?"2px solid #1a5c35":"1.5px solid #ddd",background:form.shift_days.includes(d)?"#f0faf4":"#fff",cursor:"pointer",fontSize:12,fontWeight:600,color:form.shift_days.includes(d)?"#1a5c35":"#555"}}>{d}</div>
                ))}
              </div>
            </div>
            {form.shift_days.length>0&&(
              <div>
                <label style={{fontSize:12,color:"#666",display:"block",marginBottom:6}}>Schedule Per Day</label>
                <div style={{display:"grid",gridTemplateColumns:"44px 1fr 1fr 1fr 70px",gap:6,marginBottom:4}}>
                  <span style={{fontSize:10,color:"#aaa",fontWeight:600}}>Day</span>
                  <span style={{fontSize:10,color:"#aaa",fontWeight:600}}>Start</span>
                  <span style={{fontSize:10,color:"#aaa",fontWeight:600}}>End</span>
                  <span style={{fontSize:10,color:"#aaa",fontWeight:600}}>Lunch time</span>
                  <span style={{fontSize:10,color:"#aaa",fontWeight:600}}>Duration</span>
                </div>
                {form.shift_days.map(d=>(
                  <div key={d} style={{display:"grid",gridTemplateColumns:"44px 1fr 1fr 1fr 70px",gap:6,alignItems:"center",marginBottom:7}}>
                    <span style={{fontSize:12,fontWeight:700,color:"#1a5c35"}}>{d}</span>
                    <div style={{display:"flex",gap:2,alignItems:"center"}}>
                    <select value={((form.lunch_schedule[d]||{}).start||"").split(":")[0]||""} onChange={e=>setDay(d,"start",`${e.target.value.padStart(2,"0")}:${((form.lunch_schedule[d]||{}).start||"").split(":")[1]||"00"}`)} style={{padding:"4px 3px",borderRadius:6,border:"1.5px solid #ddd",fontSize:10,outline:"none",background:"#fff",width:46}}>
                      <option value="">HH</option>
                      {Array.from({length:24},(_,i)=><option key={i} value={String(i).padStart(2,"0")}>{String(i).padStart(2,"0")}</option>)}
                    </select>
                    <span style={{fontSize:11,color:"#bbb"}}>:</span>
                    <select value={((form.lunch_schedule[d]||{}).start||"").split(":")[1]||""} onChange={e=>setDay(d,"start",`${((form.lunch_schedule[d]||{}).start||"").split(":")[0]||"00"}:${e.target.value}`)} style={{padding:"4px 3px",borderRadius:6,border:"1.5px solid #ddd",fontSize:10,outline:"none",background:"#fff",width:42}}>
                      <option value="">MM</option>
                      {["00","15","30","45"].map(m=><option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                    <div style={{display:"flex",gap:2,alignItems:"center"}}>
                    <select value={((form.lunch_schedule[d]||{}).end||"").split(":")[0]||""} onChange={e=>setDay(d,"end",`${e.target.value.padStart(2,"0")}:${((form.lunch_schedule[d]||{}).end||"").split(":")[1]||"00"}`)} style={{padding:"4px 3px",borderRadius:6,border:"1.5px solid #ddd",fontSize:10,outline:"none",background:"#fff",width:46}}>
                      <option value="">HH</option>
                      {Array.from({length:24},(_,i)=><option key={i} value={String(i).padStart(2,"0")}>{String(i).padStart(2,"0")}</option>)}
                    </select>
                    <span style={{fontSize:11,color:"#bbb"}}>:</span>
                    <select value={((form.lunch_schedule[d]||{}).end||"").split(":")[1]||""} onChange={e=>setDay(d,"end",`${((form.lunch_schedule[d]||{}).end||"").split(":")[0]||"00"}:${e.target.value}`)} style={{padding:"4px 3px",borderRadius:6,border:"1.5px solid #ddd",fontSize:10,outline:"none",background:"#fff",width:42}}>
                      <option value="">MM</option>
                      {["00","15","30","45"].map(m=><option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                    <div style={{display:"flex",gap:2,alignItems:"center"}}>
                    <select value={((form.lunch_schedule[d]||{}).time||"").split(":")[0]||""} onChange={e=>setDay(d,"time",`${e.target.value.padStart(2,"0")}:${((form.lunch_schedule[d]||{}).time||"").split(":")[1]||"00"}`)} style={{padding:"4px 3px",borderRadius:6,border:"1.5px solid #ddd",fontSize:10,outline:"none",background:"#fff",width:46}}>
                      <option value="">HH</option>
                      {Array.from({length:24},(_,i)=><option key={i} value={String(i).padStart(2,"0")}>{String(i).padStart(2,"0")}</option>)}
                    </select>
                    <span style={{fontSize:11,color:"#bbb"}}>:</span>
                    <select value={((form.lunch_schedule[d]||{}).time||"").split(":")[1]||""} onChange={e=>setDay(d,"time",`${((form.lunch_schedule[d]||{}).time||"").split(":")[0]||"00"}:${e.target.value}`)} style={{padding:"4px 3px",borderRadius:6,border:"1.5px solid #ddd",fontSize:10,outline:"none",background:"#fff",width:42}}>
                      <option value="">MM</option>
                      {["00","15","30","45"].map(m=><option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                    <select value={(form.lunch_schedule[d]||{}).duration||60} onChange={e=>setDay(d,"duration",parseInt(e.target.value))} style={{padding:"6px 7px",borderRadius:7,border:"1.5px solid #ddd",fontSize:11,outline:"none",background:"#fff"}}>
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
      <p style={{fontSize:10,letterSpacing:1.8,textTransform:"uppercase",color:"#bbb",margin:"0 0 10px",fontWeight:700}}>All Reps — click to edit</p>
      {reps.map(rep=>{
        const tz=TZ_C[rep.timezone]||TZ_C.Central;
        const days=(rep.shift_days||[]).join(", ")||"No days set";
        return (
          <div key={rep.id} onClick={()=>startEdit(rep)} style={{background:"#fff",border:"1.5px solid #efefef",borderRadius:12,padding:"11px 14px",marginBottom:7,cursor:"pointer"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:32,height:32,borderRadius:"50%",background:"#eafaf1",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"#1a5c35",flexShrink:0}}>{rep.avatar||avatar(rep.name)}</div>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontWeight:600,fontSize:13}}>{rep.name}</span>
                  <span style={{fontSize:9,padding:"2px 5px",borderRadius:4,background:tz.bg,color:tz.text,fontWeight:700}}>{rep.timezone}</span>
                </div>
                <p style={{margin:"2px 0 0",fontSize:11,color:"#aaa"}}>{days}</p>
              </div>
              <span style={{fontSize:12,color:"#bbb"}}>✏️</span>
            </div>
          </div>
        );
      })}
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
        <button onClick={exportCSV} style={{padding:"7px 14px",borderRadius:8,border:"1.5px solid #1a5c35",background:"#f0faf4",cursor:"pointer",fontSize:12,color:"#1a5c35",fontWeight:600}}>📥 Export Excel</button>
      </div>
      {loading&&<p style={{textAlign:"center",color:"#aaa",padding:"30px 0"}}>Loading…</p>}
      {!loading&&data&&(
        <div>
          <div style={{background:"#fff",borderRadius:12,border:"1.5px solid #efefef",overflow:"hidden"}}>
            <div style={{display:"grid",gridTemplateColumns:"1.5fr 1fr 1fr 1fr 1fr 1fr",gap:0,padding:"8px 12px",background:"#f8f8f8",borderBottom:"1px solid #efefef"}}>
              {["Rep","🌿 Health","Time","🥗 Lunch","🤒 Sick","📵 Off"].map((h,i)=>(
                <span key={i} style={{fontSize:10,fontWeight:700,color:"#999",letterSpacing:0.5}}>{h}</span>
              ))}
            </div>
            {repStats.map(({rep,hb,hMins,lb,sick,calloff})=>(
              <div key={rep.id} style={{display:"grid",gridTemplateColumns:"1.5fr 1fr 1fr 1fr 1fr 1fr",gap:0,padding:"10px 12px",borderBottom:"1px solid #f5f5f5",alignItems:"center"}}>
                <span style={{fontSize:12,fontWeight:600,color:"#1a1a1a"}}>{rep.name}</span>
                <span style={{fontSize:12,color:hb>=HEALTH_PER_DAY?"#e74c3c":"#1a1a1a",fontWeight:hb>=HEALTH_PER_DAY?700:400}}>{hb}</span>
                <span style={{fontSize:11,color:"#888"}}>{hMins}m</span>
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
              <div key={s.label} style={{background:"#fff",borderRadius:12,border:"1.5px solid #efefef",padding:"12px 14px",textAlign:"center"}}>
                <p style={{margin:"0 0 4px",fontSize:22}}>{s.icon}</p>
                <p style={{margin:0,fontSize:20,fontWeight:800,color:"#1a1a1a"}}>{s.val}</p>
                <p style={{margin:0,fontSize:10,color:"#aaa"}}>{s.label}</p>
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
              <label style={{fontSize:12,color:"#666",display:"block",marginBottom:4}}>Rep</label>
              <select value={addForm.rep_id} onChange={e=>setAddForm(p=>({...p,rep_id:e.target.value}))} style={{width:"100%",padding:"9px 12px",borderRadius:9,border:"1.5px solid #ddd",fontSize:13,outline:"none",background:"#fff"}}>
                <option value="">Select rep…</option>
                {reps.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:12,color:"#666",display:"block",marginBottom:4}}>Date</label>
              <input type="date" value={addForm.pto_date} onChange={e=>setAddForm(p=>({...p,pto_date:e.target.value}))} style={{width:"100%",padding:"9px 12px",borderRadius:9,border:"1.5px solid #ddd",fontSize:13,outline:"none"}}/>
            </div>
            <div>
              <label style={{fontSize:12,color:"#666",display:"block",marginBottom:4}}>Note (optional)</label>
              <input value={addForm.note} onChange={e=>setAddForm(p=>({...p,note:e.target.value}))} placeholder="e.g. Annual leave" style={{width:"100%",padding:"9px 12px",borderRadius:9,border:"1.5px solid #ddd",fontSize:13,outline:"none"}}/>
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
        <button onClick={()=>setWeekOffset(p=>p-1)} style={{padding:"6px 12px",borderRadius:8,border:"1.5px solid #ddd",background:"#fff",cursor:"pointer",fontSize:13}}>← Prev</button>
        <span style={{fontSize:13,fontWeight:600,color:"#1a1a1a"}}>
          {weekOffset===0?"This Week":weekOffset===1?"Next Week":weekOffset===-1?"Last Week":`${weekDays[0].toLocaleDateString("en-US",{month:"short",day:"numeric"})} – ${weekDays[6].toLocaleDateString("en-US",{month:"short",day:"numeric"})}`}
        </span>
        <button onClick={()=>setWeekOffset(p=>p+1)} style={{padding:"6px 12px",borderRadius:8,border:"1.5px solid #ddd",background:"#fff",cursor:"pointer",fontSize:13}}>Next →</button>
      </div>

      {/* Weekly grid */}
      <div style={{background:"#fff",borderRadius:14,border:"1.5px solid #efefef",overflow:"hidden",marginBottom:14}}>
        <div style={{display:"grid",gridTemplateColumns:`120px repeat(7,1fr)`,borderBottom:"1px solid #f0f0f0"}}>
          <div style={{padding:"8px 10px",background:"#f8f8f8"}}/>
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
                <div style={{width:22,height:22,borderRadius:"50%",background:"#eafaf1",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:700,color:"#1a5c35",flexShrink:0}}>{rep.avatar||avatar(rep.name)}</div>
                <span style={{fontSize:11,fontWeight:600,color:"#1a1a1a",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{rep.name}</span>
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
                      <button onClick={()=>{setAddForm({rep_id:String(rep.id),pto_date:ds,note:""});setAdding(true);}} style={{fontSize:10,color:"#ccc",background:"none",border:"none",cursor:"pointer",padding:2,borderRadius:4}}>+</button>
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
      <div style={{marginTop:12,padding:"10px 14px",background:"#fff",borderRadius:10,border:"1.5px solid #efefef",display:"flex",gap:16,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:5}}><span style={{fontSize:9,color:"#8e44ad",fontWeight:700,background:"#f5eefb",padding:"2px 6px",borderRadius:4}}>PTO</span><span style={{fontSize:11,color:"#888"}}>Pre-loaded from calendar</span></div>
        <div style={{display:"flex",alignItems:"center",gap:5}}><span style={{fontSize:11,color:"#ccc"}}>+</span><span style={{fontSize:11,color:"#888"}}>Click to add PTO for that day</span></div>
        <div style={{display:"flex",alignItems:"center",gap:5}}><span style={{fontSize:9,color:"#e74c3c"}}>✕</span><span style={{fontSize:11,color:"#888"}}>Click to remove</span></div>
      </div>
    </div>
  );
}

// ── MGR: SETTINGS ─────────────────────────────────────────────────────
function MgrSettings({ settings, reps, reload, fire }) {
  const [customCap, setCustomCap] = useState(settings.custom_limit??Math.floor(reps.length*0.3));

  const togglePeak = async () => {
    await sbPatch("app_settings",1,{peak_mode:!settings.peak_mode,updated_at:new Date().toISOString()});
    fire("info",`Peak mode ${settings.peak_mode?"disabled":"enabled"}`);
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
      <div style={{background:"#fff",borderRadius:14,border:"1.5px solid #efefef",padding:"16px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div>
            <p style={{margin:0,fontWeight:700,fontSize:14}}>⚡ Peak Mode</p>
            <p style={{margin:"3px 0 0",fontSize:12,color:"#888"}}>Limits health breaks to 1 at a time</p>
          </div>
          <div onClick={togglePeak} style={{width:46,height:26,borderRadius:13,background:settings.peak_mode?"#1a5c35":"#ccc",cursor:"pointer",position:"relative",transition:"background .2s"}}>
            <div style={{width:20,height:20,borderRadius:"50%",background:"#fff",position:"absolute",top:3,left:settings.peak_mode?23:3,transition:"left .2s"}}/>
          </div>
        </div>
        {settings.peak_mode&&<p style={{margin:0,fontSize:11,color:"#e74c3c",fontWeight:600}}>⚡ Active — health breaks limited to 1 at a time</p>}
      </div>

      {/* Team Cap */}
      <div style={{background:"#fff",borderRadius:14,border:"1.5px solid #efefef",padding:"16px"}}>
        <p style={{margin:"0 0 4px",fontWeight:700,fontSize:14}}>👥 Team Break Cap</p>
        <p style={{margin:"0 0 12px",fontSize:12,color:"#888"}}>Default: 30% of active team = {Math.floor(reps.length*0.3)} max out at once</p>
        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10}}>
          <input type="number" min={1} max={reps.length} value={customCap} onChange={e=>setCustomCap(parseInt(e.target.value))} style={{width:70,padding:"9px 12px",borderRadius:9,border:"1.5px solid #ddd",fontSize:14,outline:"none",textAlign:"center"}}/>
          <span style={{fontSize:13,color:"#888"}}>max people out at once</span>
        </div>
        <div style={{display:"flex",gap:8}}>
          <Btn label="Reset to 30%" onClick={resetCap} outline color="#888" small/>
          <Btn label="Save Cap" onClick={saveCap} color="#1a5c35" small/>
        </div>
      </div>

      {/* Break Rules Summary */}
      <div style={{background:"#fff",borderRadius:14,border:"1.5px solid #efefef",padding:"16px"}}>
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
              <span style={{fontSize:12,color:"#555",lineHeight:1.5}}>{t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── REP VIEW ──────────────────────────────────────────────────────────
function RepView({ repInfo, data, reload, onLogout, centreOpen }) {
  const { reps, settings, swaps, activeBreaks, breakQueue=[] } = data;
  const [tab, setTab] = useState("my");
  const [toast, setToast] = useState(null);
  const fire = (type,msg) => setToast({type,msg,id:Date.now()});

  const myRep = reps.find(r=>r.id===repInfo.id)||{...repInfo,status:"available",health_breaks_today:0,health_time_banked:0};
  const hasEnrolAccess = !!(myRep?.enrol_role === "enroller" || myRep?.enrol_role === "closer" || reps.some(r=>r.enrol_role==="enroller"&&(r.enrol_visible_to||[]).includes(repInfo.id)));
  const mySwaps = swaps.filter(s=>s.target_id===repInfo.id&&s.status==="pending");
  const onLunch = reps.filter(r=>r.status==="lunch").length;
  const onHealth = reps.filter(r=>r.status==="health").length;
  const activeReps = reps.filter(r=>!["off","pto","sick"].includes(r.status));
  const maxOut = settings.custom_limit ?? Math.floor(activeReps.length*0.3);
  const totalOut = reps.filter(r=>["health","lunch"].includes(r.status)).length;
  const hLimit = settings.peak_mode ? H_LIMIT_PEAK : H_LIMIT_NORMAL;
  const lunchLeft = LUNCH_LIMIT - onLunch;
  const healthLeft = hLimit - onHealth;
  const capLeft = maxOut - totalOut;

  const myAB = activeBreaks.find(b=>b.rep_id===repInfo.id);
  const cooldownActive = !!(myRep.last_break_returned_at && elapsedSec(myRep.last_break_returned_at)<COOLDOWN_SEC);
  const cooldownLeft = cooldownActive ? COOLDOWN_SEC - elapsedSec(myRep.last_break_returned_at||new Date().toISOString()) : 0;
  const timeUsedToday = myRep.health_time_today||0;
  const breaksLeft = HEALTH_PER_DAY - (myRep.health_breaks_today||0);

  const canTakeHealth = healthLeft>0 && capLeft>0 && !cooldownActive && breaksLeft>0 && myRep.status==="available";
  const canTakeLunch = lunchLeft>0 && capLeft>0 && myRep.status==="available";

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
    if(capLeft<=0){
      if(type==="health"&&!myQueueEntry&&breaksLeft>0&&!cooldownActive){
        await joinQueue(); return;
      }
      fire("declined","Team cap reached — all break slots full");return;
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
    const bankedReset = type==="health" && myRep.health_time_banked>=HEALTH_MAX_SEC && !cooldownActive;
    const updates = {status:type,updated_at:new Date().toISOString()};
    if(bankedReset) updates.health_time_banked = 0; // start fresh cycle after cooldown expired
    await sbPatch("rep_status",repInfo.id,updates);
    await sbPost("break_log",{rep_id:repInfo.id,rep_name:repInfo.name,break_type:type});
    fire("approved",`Enjoy your ${type==="lunch"?"lunch 🥗":"health break 🌿"}!`);
    reload();
  };

  const returnFromBreak = async () => {
    const ab = activeBreaks.find(b=>b.rep_id===repInfo.id);
    const durSec = ab ? elapsedSec(ab.started_at) : 0;
    const newBanked = myRep.status==="health" ? (myRep.health_time_banked||0)+durSec : 0;
    const updates = {status:"available",updated_at:new Date().toISOString()};
    if(myRep.status==="health") {
      if(newBanked >= HEALTH_MAX_SEC) {
        updates.health_time_banked = HEALTH_MAX_SEC; // mark as full
        updates.last_break_returned_at = new Date().toISOString();
        updates.health_breaks_today = (myRep.health_breaks_today||0)+1;
        fire("info","10 min banked — 2-hour cooldown now active 🕐");
      } else {
        updates.health_time_banked = newBanked;
      }
    }
    if(ab) await sb(`break_log?id=eq.${ab.id}`,{method:"PATCH",body:JSON.stringify({ended_at:new Date().toISOString(),duration_seconds:durSec})});
    await sbPatch("rep_status",repInfo.id,updates);
    fire("approved","Welcome back! You're on duty 🎉");
    await processQueue();
    reload();
  };

  const requestAdHocLunch = async () => {
    await sbPost("adhoc_lunch_requests",{rep_id:repInfo.id,rep_name:repInfo.name,requested_time:new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})});
    fire("info","Ad hoc lunch request sent to manager 📩");
    reload();
  };

  // ── Callback due notifications ────────────────────────────────────
  const [dueCallbacks, setDueCallbacks] = useState([]);
  const [dismissedCbs, setDismissedCbs] = useState(new Set());

  const checkDueCallbacks = useCallback(async () => {
    try {
      const now = new Date();
      const todayDate = now.toISOString().slice(0,10);
      const nowTime = now.toTimeString().slice(0,5); // "HH:MM"
      const data = await sb(`callbacks?rep_id=eq.${repInfo.id}&status=eq.pending&callback_date=lte.${todayDate}`);
      const due = (data||[]).filter(cb => cb.callback_date < todayDate || (cb.callback_date === todayDate && cb.callback_time <= nowTime));
      setDueCallbacks(due);
    } catch(e) {}
  }, [repInfo.id]);

  useEffect(()=>{
    checkDueCallbacks();
    const t = setInterval(checkDueCallbacks, 60000);
    return ()=>clearInterval(t);
  },[checkDueCallbacks]);

  const dismissCallback = (id) => setDismissedCbs(prev => new Set([...prev, id]));
  const visibleDue = dueCallbacks.filter(cb => !dismissedCbs.has(cb.id));

  return (
    <div style={{fontFamily:"'Segoe UI',system-ui,sans-serif",minHeight:"100vh",background:"#f4f6f2",paddingBottom:60}}>
      <style>{`@keyframes popIn{from{transform:scale(0.92);opacity:0}to{transform:scale(1);opacity:1}} *{box-sizing:border-box}`}</style>
      {toast&&<Toast key={toast.id} msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}

      {/* Callback due banners */}
      {visibleDue.map(cb=>(
        <div key={cb.id} style={{background:"#1a3a5c",color:"#fff",padding:"12px 16px",borderBottom:"2px solid #f0c040",display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
          <div style={{flex:1}}>
            <p style={{margin:"0 0 2px",fontSize:12,fontWeight:800,color:"#f0c040"}}>📞 Callback Due Now</p>
            <p style={{margin:"0 0 2px",fontSize:14,fontWeight:700}}>{cb.parent_name} · {cb.phone}</p>
            {cb.notes&&<p style={{margin:0,fontSize:11,opacity:.8,lineHeight:1.4}}>"{cb.notes}"</p>}
            <p style={{margin:"4px 0 0",fontSize:10,opacity:.55}}>Scheduled {cb.callback_date===new Date().toISOString().slice(0,10)?"today":cb.callback_date} at {fmt12h(cb.callback_time)}</p>
          </div>
          <button onClick={()=>dismissCallback(cb.id)} style={{background:"rgba(255,255,255,.15)",border:"none",color:"#fff",borderRadius:7,padding:"4px 10px",cursor:"pointer",fontSize:11,flexShrink:0}}>Dismiss</button>
        </div>
      ))}

      <div style={{background:"#1a5c35",padding:"20px 18px 16px",color:"#fff"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
          <div>
            <p style={{margin:"0 0 1px",fontSize:10,opacity:.55,letterSpacing:2,textTransform:"uppercase"}}>My Break</p>
            <h1 style={{margin:"0 0 2px",fontSize:21,fontWeight:800}}>Hey, {repInfo.name}! 👋</h1>
            <p style={{margin:0,fontSize:11,opacity:.6}}>{todayLabel()}</p>
          </div>
          <button onClick={onLogout} style={{padding:"6px 11px",borderRadius:9,border:"1px solid rgba(255,255,255,.2)",background:"transparent",color:"rgba(255,255,255,.7)",cursor:"pointer",fontSize:11}}>Switch</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          {[
            {icon:"🌿",label:"Health",avail:healthLeft,total:hLimit,color:"#2980b9",extra:cooldownActive?`Cooldown: ${fmtTime(cooldownLeft)}`:"Available"},
            {icon:"🥗",label:"Lunch",avail:lunchLeft,total:LUNCH_LIMIT,color:"#e07b00",extra:"slots"},
            {icon:"👥",label:"Team Cap",avail:capLeft,total:maxOut,color:"#8e44ad",extra:"slots"},
          ].map(m=>(
            <div key={m.label} style={{background:"rgba(255,255,255,.12)",borderRadius:11,padding:"10px 11px",border:`1px solid ${m.avail===0?"rgba(231,76,60,.5)":"rgba(255,255,255,.15)"}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <span style={{fontSize:18}}>{m.icon}</span>
                <span style={{fontSize:10,background:m.avail===0?"rgba(231,76,60,.25)":"rgba(255,255,255,.15)",padding:"2px 6px",borderRadius:5,fontWeight:700,color:m.avail===0?"#ffaaaa":"rgba(255,255,255,.9)"}}>{m.avail===0?"FULL":`${m.avail} open`}</span>
              </div>
              <p style={{margin:"6px 0 1px",fontSize:11,fontWeight:600,opacity:.9}}>{m.label}</p>
              <p style={{margin:0,fontSize:9,opacity:.55}}>{m.extra}</p>
            </div>
          ))}
        </div>
        {settings.peak_mode&&<div style={{marginTop:10,background:"rgba(231,76,60,.2)",borderRadius:8,padding:"6px 12px",fontSize:11,color:"#ffaaaa",fontWeight:600}}>⚡ Peak mode active — health breaks limited to 1 at a time</div>}

      </div>

      {/* Rep Tabs */}
      <div style={{background:"#fff",borderBottom:"1.5px solid #ebebeb"}}>
        <div style={{display:"flex",padding:"0 16px"}}>
          {[{k:"my",l:"My Break"},{k:"team",l:"Team"},{k:"swaps",l:`Swaps${mySwaps.length>0?` (${mySwaps.length})`:""}`},{k:"callbacks",l:"📞 Callbacks"},...(hasEnrolAccess?[{k:"enrolment",l:"📋 Enrolment"}]:[]),...(HUB_ENABLED?[{k:"hub",l:"🏊 Hub"}]:[])].map(t=>(
            <button key={t.k} onClick={()=>setTab(t.k)} style={{padding:"11px 14px",border:"none",background:"none",cursor:"pointer",fontSize:13,fontWeight:tab===t.k?700:500,color:tab===t.k?"#1a5c35":mySwaps.length>0&&t.k==="swaps"?"#e07b00":"#999",borderBottom:tab===t.k?"2.5px solid #1a5c35":"2.5px solid transparent",marginBottom:-1.5,transition:"all .15s"}}>{t.l}</button>
          ))}
        </div>
      </div>

      <div style={{padding:"16px 16px",maxWidth:480,margin:"0 auto"}}>
        {tab==="my"&&(
          <RepMyBreak myRep={myRep} myAB={myAB} canTakeHealth={canTakeHealth} canTakeLunch={canTakeLunch} cooldownActive={cooldownActive} cooldownLeft={cooldownLeft} breaksLeft={breaksLeft} startBreak={startBreak} returnFromBreak={returnFromBreak} requestAdHocLunch={requestAdHocLunch} repInfo={repInfo} breakQueue={breakQueue} myQueueEntry={myQueueEntry} queuePosition={queuePosition} isNotified={isNotified} acceptSecsLeft={acceptSecsLeft} joinQueue={joinQueue} leaveQueue={leaveQueue} acceptQueuedBreak={acceptQueuedBreak}/>
        )}
        {tab==="team"&&<RepTeam reps={reps} myId={repInfo.id} activeBreaks={activeBreaks} centreOpen={centreOpen}/>}
        {tab==="swaps"&&<RepSwaps myRep={myRep} reps={reps} swaps={swaps} reload={reload} fire={fire} repInfo={repInfo}/>}
        {tab==="callbacks"&&<RepCallbacks repInfo={repInfo} fire={fire}/>}
        {tab==="enrolment"&&<EnrolmentBoard reps={reps} reload={reload} fire={fire} currentRepId={repInfo.id} isManager={false}/>}
        {tab==="hub"&&HUB_ENABLED&&<HubView isManager={false}/>}
      </div>
    </div>
  );
}

function RepMyBreak({ myRep, myAB, canTakeHealth, canTakeLunch, cooldownActive, cooldownLeft, breaksLeft, startBreak, returnFromBreak, requestAdHocLunch, repInfo, breakQueue=[], myQueueEntry, queuePosition=0, isNotified=false, acceptSecsLeft=0, joinQueue, leaveQueue, acceptQueuedBreak }) {
  const [showBreakModal, setShowBreakModal] = useState(false);
  const cfg = ST[myRep.status]||ST.available;
  const onBreak = myRep.status==="health"||myRep.status==="lunch";
  const totalWaiting = breakQueue.filter(q=>q.status==="waiting").length;
  const isOOO = myRep.status==="pto"||myRep.status==="sick";
  const isOff = myRep.status==="off";

  return (
    <div>
      {showBreakModal&&(
        <Modal title="Request Break" sub="BREAK REQUEST" onClose={()=>setShowBreakModal(false)}>
          <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
            {[
              {key:"health",icon:"🌿",label:"Health Break",dur:"10 min",avail:canTakeHealth,reason:!canTakeHealth?(cooldownActive?`Cooldown: ${fmtTime(cooldownLeft)}`:(myQueueEntry?"In queue":"Slots full")):null,queueable:!canTakeHealth&&breaksLeft>0&&!cooldownActive&&!myQueueEntry},
              {key:"lunch",icon:"🥗",label:"Lunch Break",dur:"Per schedule",avail:canTakeLunch,reason:!canTakeLunch?"Slots full":null},
            ].map(o=>(
              <div key={o.key} onClick={()=>{if(o.avail){startBreak(o.key);setShowBreakModal(false);}else if(o.queueable){joinQueue();setShowBreakModal(false);}}} style={{border:o.avail?"1.5px solid #ddd":"1.5px solid #f0f0f0",borderRadius:12,padding:"12px 14px",cursor:o.avail?"pointer":"not-allowed",background:o.avail?"#fff":"#f7f7f7",opacity:o.avail?1:0.6}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:24}}>{o.icon}</span>
                  <div style={{flex:1}}>
                    <p style={{margin:0,fontWeight:600,fontSize:14,color:o.avail?"#1a1a1a":"#aaa"}}>{o.label}</p>
                    <p style={{margin:0,fontSize:11,color:"#aaa"}}>{o.dur}</p>
                    {o.reason&&<p style={{margin:"2px 0 0",fontSize:11,color:"#e74c3c"}}>{o.reason}</p>}
                  </div>
                  {!o.avail&&<span style={{fontSize:10,background:"#fde8e8",color:"#c0392b",padding:"3px 7px",borderRadius:5,fontWeight:700}}>UNAVAILABLE</span>}
                </div>
              </div>
            ))}
          </div>
          <p style={{margin:"0 0 10px",fontSize:12,color:"#aaa",textAlign:"center"}}>Need lunch outside your schedule?</p>
          <Btn label="Request Ad Hoc Lunch 📩" onClick={()=>{requestAdHocLunch();setShowBreakModal(false);}} outline color="#e07b00"/>
        </Modal>
      )}

      <p style={{fontSize:10,letterSpacing:1.8,textTransform:"uppercase",color:"#bbb",margin:"0 0 10px",fontWeight:700}}>My Status</p>
      <div style={{background:cfg.bg,border:`2px solid ${cfg.border}`,borderRadius:18,padding:"20px 18px",marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:isOOO||isOff?0:14}}>
          <div style={{width:48,height:48,borderRadius:"50%",background:isOff?"#eee":onBreak?(myRep.status==="health"?"#d6eaf8":"#fdebd0"):"#eafaf1",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:800,color:isOff?"#bbb":onBreak?(myRep.status==="health"?"#1a6291":"#9c5a00"):"#1a5c35"}}>
            {repInfo.avatar||avatar(repInfo.name)}
          </div>
          <div>
            <p style={{margin:0,fontWeight:700,fontSize:16,color:"#1a1a1a"}}>{repInfo.name}</p>
            <div style={{display:"flex",alignItems:"center",gap:5,marginTop:2}}>
              <StatusDot status={myRep.status}/>
              <span style={{fontSize:12,color:cfg.dot,fontWeight:600}}>{cfg.label}</span>
            </div>
          </div>
        </div>
        {myRep.status==="health"&&myAB&&<HealthTimer startedAt={myAB.started_at} bankedSec={myRep.health_time_banked||0}/>}
        {!isOOO&&!isOff&&(
          <div style={{borderTop:onBreak?"1.5px solid rgba(0,0,0,.06)":"none",paddingTop:onBreak?12:0}}>
            <div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap"}}>
              <span style={{fontSize:11,color:"#888"}}>🌿 {myRep.health_breaks_today||0}/{HEALTH_PER_DAY} full breaks · banked {fmtDur(myRep.health_time_banked||0)}/10m{cooldownActive?` · Cooldown: ${fmtTime(cooldownLeft)}`:""}</span>
              {cooldownActive&&<span style={{fontSize:11,color:"#e07b00",fontWeight:600}}>⏳ Cooldown: {fmtTime(cooldownLeft)}</span>}
            </div>
            {onBreak?(
              <button onClick={returnFromBreak} style={{width:"100%",padding:"13px",borderRadius:12,border:"none",background:"#1a5c35",color:"#fff",cursor:"pointer",fontSize:15,fontWeight:700}}>I'm back! 👋</button>
            ):(
              <>
                <button onClick={()=>setShowBreakModal(true)} style={{width:"100%",padding:"13px",borderRadius:12,border:"none",background:"#1a5c35",color:"#fff",cursor:"pointer",fontSize:15,fontWeight:700}}>Request a Break 🌿</button>
                {myQueueEntry?.status==="waiting"&&(
                  <div style={{background:"#e8f0fe",border:"1.5px solid #aed6f1",borderRadius:12,padding:"12px 13px",marginTop:10,display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:20}}>🕐</span>
                    <div style={{flex:1}}>
                      <p style={{margin:0,fontWeight:700,fontSize:13,color:"#003087"}}>#{queuePosition} in the queue</p>
                      <p style={{margin:"2px 0 0",fontSize:11,color:"#555"}}>{queuePosition===1?"You're up next!":"Waiting for a slot to open"}</p>
                    </div>
                    <button onClick={leaveQueue} style={{padding:"5px 10px",borderRadius:7,border:"1.5px solid #003087",background:"#fff",cursor:"pointer",fontSize:11,color:"#003087",fontWeight:600}}>Leave</button>
                  </div>
                )}
                {isNotified&&(
                  <div style={{background:"#1a5c35",borderRadius:12,padding:"12px 13px",marginTop:10}}>
                    <p style={{margin:"0 0 4px",fontSize:13,fontWeight:700,color:"#fff"}}>🌿 Your break is ready!</p>
                    <p style={{margin:"0 0 10px",fontSize:11,color:"rgba(255,255,255,.7)"}}>Accept within {fmtTime(acceptSecsLeft)} or it passes to the next rep</p>
                    <button onClick={acceptQueuedBreak} style={{width:"100%",padding:"10px",borderRadius:9,border:"none",background:"#fff",color:"#1a5c35",cursor:"pointer",fontSize:13,fontWeight:800}}>Accept Break ✅</button>
                  </div>
                )}
                {breakQueue.filter(q=>q.status==="waiting").length>0&&!myQueueEntry&&(
                  <p style={{margin:"8px 0 0",fontSize:11,color:"#aaa",textAlign:"center"}}>{breakQueue.filter(q=>q.status==="waiting").length} rep{breakQueue.filter(q=>q.status==="waiting").length>1?"s are":" is"} in the health break queue</p>
                )}
              </>
            )}
          </div>
        )}
        {isOOO&&<p style={{margin:"12px 0 0",fontSize:13,color:"#888",textAlign:"center"}}>You're marked as out today. See your manager to update.</p>}
        {isOff&&<p style={{margin:"12px 0 0",fontSize:13,color:"#bbb",textAlign:"center"}}>Today is your scheduled day off. Enjoy! 🎉</p>}
      </div>
    </div>
  );
}

function RepTeam({ reps, myId, activeBreaks, centreOpen }) {
  const [showOffShift, setShowOffShift] = useState(false);

  // Split reps: exclude permanently off/pto/sick, then split by shift
  const activeReps = reps.filter(r => !["off","pto","sick"].includes(r.status));
  const onShift  = activeReps.filter(r => isRepOnShift(r));
  const offShift = activeReps.filter(r => !isRepOnShift(r));

  const RepCard = ({ rep }) => {
    const cfg = ST[rep.status]||ST.available;
    const ab = activeBreaks.find(b=>b.rep_id===rep.id&&rep.status==="health");
    const cooldownActive = !!(rep.health_time_banked>=HEALTH_MAX_SEC&&rep.last_break_returned_at&&elapsedSec(rep.last_break_returned_at)<COOLDOWN_SEC);
    const cooldownLeft = cooldownActive ? COOLDOWN_SEC-elapsedSec(rep.last_break_returned_at||new Date().toISOString()) : 0;
    const isMe = rep.id===myId;
    return (
      <div style={{background:cfg.bg,border:`1.5px solid ${cfg.border}`,borderRadius:12,padding:"10px 13px"}}>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <div style={{width:32,height:32,borderRadius:"50%",background:isMe?"#1a5c35":"#eafaf1",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:isMe?"#fff":"#1a5c35",flexShrink:0}}>{rep.avatar||avatar(rep.name)}</div>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
              <span style={{fontWeight:600,fontSize:13,color:"#1a1a1a"}}>{rep.name}{isMe?" (you)":""}</span>
              <StatusDot status={rep.status}/>
              <span style={{fontSize:11,color:cfg.dot}}>{cfg.label}</span>
            </div>
            <div style={{display:"flex",gap:10,marginTop:3,flexWrap:"wrap"}}>
              <span style={{fontSize:10,color:"#888"}}>🌿 {rep.health_breaks_today||0}/{HEALTH_PER_DAY} breaks</span>
              {cooldownActive&&<span style={{fontSize:10,color:"#e07b00",fontWeight:600}}>⏳ {fmtTime(cooldownLeft)}</span>}
              {(rep.health_time_banked||0)>0&&!cooldownActive&&<span style={{fontSize:10,color:"#aaa"}}>Banked: {fmtDur(rep.health_time_banked)}</span>}
            </div>
            {rep.status==="health"&&ab&&<HealthTimer startedAt={ab.started_at} bankedSec={rep.health_time_banked||0}/>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <p style={{fontSize:10,letterSpacing:1.8,textTransform:"uppercase",color:"#bbb",margin:"0 0 10px",fontWeight:700}}>On Shift ({onShift.length})</p>
      {onShift.length===0&&<p style={{fontSize:13,color:"#bbb",textAlign:"center",padding:"16px 0"}}>No reps currently on shift.</p>}
      <div style={{display:"flex",flexDirection:"column",gap:7,marginBottom:14}}>
        {onShift.map(rep=><RepCard key={rep.id} rep={rep}/>)}
      </div>

      {offShift.length>0&&(
        <>
          <button onClick={()=>setShowOffShift(v=>!v)} style={{width:"100%",padding:"8px 12px",borderRadius:9,border:"1.5px solid #eee",background:"#f9f9f9",cursor:"pointer",fontSize:11,fontWeight:700,color:"#aaa",textAlign:"left",marginBottom:8}}>
            {showOffShift?"▾":"▸"} Off Shift ({offShift.length})
          </button>
          {showOffShift&&(
            <div style={{display:"flex",flexDirection:"column",gap:7,opacity:.7}}>
              {offShift.map(rep=><RepCard key={rep.id} rep={rep}/>)}
            </div>
          )}
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
          <p style={{fontSize:12,color:"#666",margin:"0 0 12px"}}>Your lunch today: <strong style={{color:"#1a5c35"}}>{myTodayLunch()}</strong></p>
          <p style={{fontSize:11,color:"#aaa",margin:"0 0 10px",fontWeight:600,letterSpacing:1,textTransform:"uppercase"}}>Team lunch schedule today</p>
          <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:16}}>
            {reps.filter(r=>r.id!==repInfo.id&&!["off","pto","sick"].includes(r.status)).map(r=>{
              const lunch=theirTodayLunch(r);
              const isSelected=targetId===String(r.id);
              return (
                <div key={r.id} onClick={()=>setTargetId(String(r.id))} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,border:isSelected?"2px solid #8e44ad":"1.5px solid #e8e8e8",background:isSelected?"#f5eefb":"#fff",cursor:"pointer"}}>
                  <div style={{width:30,height:30,borderRadius:"50%",background:"#eafaf1",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"#1a5c35",flexShrink:0}}>{r.avatar||avatar(r.name)}</div>
                  <div style={{flex:1}}>
                    <span style={{fontWeight:600,fontSize:13,color:"#1a1a1a"}}>{r.name}</span>
                    <span style={{fontSize:11,color:"#888",marginLeft:8}}>{lunch}</span>
                  </div>
                  <span style={{fontSize:11,color:"#aaa"}}>🥗 {theirTodayLunch(r)}</span>
                  {isSelected&&<span style={{color:"#8e44ad",fontSize:16}}>✓</span>}
                </div>
              );
            })}
          </div>
          {targetId&&(()=>{
            const t=reps.find(r=>r.id===parseInt(targetId));
            return t?<p style={{fontSize:12,color:"#8e44ad",margin:"0 0 12px",padding:"8px 12px",background:"#f5eefb",borderRadius:8}}>You give: <strong>{myTodayLunch()}</strong> · You get: <strong>{theirTodayLunch(t)}</strong></p>:null;
          })()}
          <div style={{display:"flex",gap:8}}>
            <Btn label="Cancel" onClick={()=>setReqModal(false)} outline color="#888" small/>
            <Btn label="Send Request" onClick={submitSwap} color="#8e44ad"/>
          </div>
        </Modal>
      )}

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <p style={{fontSize:10,letterSpacing:1.8,textTransform:"uppercase",color:"#bbb",margin:0,fontWeight:700}}>Lunch Swaps</p>
        <button onClick={()=>setReqModal(true)} style={{padding:"6px 12px",borderRadius:8,border:"none",background:"#8e44ad",color:"#fff",cursor:"pointer",fontSize:12,fontWeight:600}}>+ Request Swap</button>
      </div>

      {myIncoming.length===0&&myOutgoing.length===0&&(
        <div style={{textAlign:"center",padding:"32px 0",color:"#bbb"}}>
          <p style={{fontSize:24,margin:"0 0 6px"}}>🔄</p>
          <p style={{fontSize:13,color:"#aaa"}}>No pending swaps</p>
        </div>
      )}

      {myIncoming.length>0&&(
        <div style={{marginBottom:16}}>
          <p style={{fontSize:11,color:"#e07b00",fontWeight:600,margin:"0 0 8px"}}>Incoming requests</p>
          {myIncoming.map(s=>{
            const requester=reps.find(r=>r.id===s.requester_id);
            return (
              <div key={s.id} style={{background:"#fff8ee",border:"1.5px solid #f0c080",borderRadius:12,padding:"12px 13px",marginBottom:8}}>
                <p style={{margin:"0 0 2px",fontWeight:600,fontSize:13}}>{s.requester_name} wants to swap lunches</p>
                <p style={{margin:"0 0 8px",fontSize:11,color:"#888"}}>They give: {s.requester_date} · You give: {s.target_date}</p>
                {requester&&<p style={{margin:"0 0 8px",fontSize:11,color:"#aaa"}}>Their lunch today: 🥗 {theirTodayLunch(requester)}</p>}
                <div style={{display:"flex",gap:6}}>
                  <button onClick={()=>declineSwap(s)} style={{flex:1,padding:"7px 0",borderRadius:8,border:"1.5px solid #f5b7b1",background:"#fdf0ee",cursor:"pointer",fontSize:12,color:"#c0392b",fontWeight:600}}>Decline</button>
                  <button onClick={()=>acceptSwap(s)} style={{flex:1,padding:"7px 0",borderRadius:8,border:"none",background:"#8e44ad",cursor:"pointer",fontSize:12,color:"#fff",fontWeight:600}}>Accept ✓</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {myOutgoing.length>0&&(
        <div>
          <p style={{fontSize:11,color:"#aaa",fontWeight:600,margin:"0 0 8px"}}>Sent requests</p>
          {myOutgoing.map(s=>(
            <div key={s.id} style={{background:"#f7f7f7",border:"1.5px solid #e8e8e8",borderRadius:12,padding:"11px 13px",marginBottom:8}}>
              <p style={{margin:"0 0 2px",fontWeight:600,fontSize:13}}>→ {s.target_name}</p>
              <p style={{margin:0,fontSize:11,color:"#aaa"}}>Your slot: {s.requester_date} · Their slot: {s.target_date} · Pending</p>
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
  const fire = (type,msg)=>setToast({type,msg,id:Date.now()});

  const reload = async()=>{
    try{ const d=await loadHubData(); setHubData(d); }
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
  const savePromo=async(f)=>{ if(f.id)await sbPatch("hub_promos",f.id,{title:f.title,code:f.code,rules:f.rules,expires_on:f.expires_on||null,proactive:f.proactive,active:true}); else await sbPost("hub_promos",{title:f.title,code:f.code,rules:f.rules,expires_on:f.expires_on||null,proactive:f.proactive,active:true}); fire("approved","Promo saved"); setEditModal(null); reload(); };
  const deletePromo=async(id)=>{ await sbPatch("hub_promos",id,{active:false}); fire("info","Promo removed"); reload(); };
  const saveClosure=async(f)=>{ if(f.id)await sbPatch("hub_closures",f.id,{location_name:f.location_name,start_date:f.start_date,end_date:f.end_date,reason:f.reason}); else await sbPost("hub_closures",{location_name:f.location_name,start_date:f.start_date,end_date:f.end_date,reason:f.reason}); fire("approved","Closure saved"); setEditModal(null); reload(); };
  const deleteClosure=async(id)=>{ await sbDel("hub_closures",id); fire("info","Closure removed"); reload(); };
  const saveDoc=async(f)=>{ if(f.id)await sbPatch("hub_docs",f.id,{title:f.title,content:f.content,category:f.category,updated_at:new Date().toISOString()}); else await sbPost("hub_docs",{title:f.title,content:f.content,category:f.category,sort_order:0}); fire("approved","Doc saved"); setEditModal(null); reload(); };
  const deleteDoc=async(id)=>{ await sbDel("hub_docs",id); fire("info","Doc removed"); reload(); };
  const saveLoc=async(f)=>{ await sbPatch("hub_locations",f.id,{ext:f.ext,privates:f.privates,pool:f.pool,addr:f.addr}); fire("approved","Location updated"); setEditModal(null); reload(); };
  const saveEvent=async(f)=>{ if(f.id)await sbPatch("hub_events",f.id,{name:f.name,event_date:f.event_date,note:f.note}); else await sbPost("hub_events",{name:f.name,event_date:f.event_date,note:f.note||""}); fire("approved","Event saved"); setEditModal(null); reload(); };
  const deleteEvent=async(id)=>{ await sbDel("hub_events",id); fire("info","Event removed"); reload(); };
  const saveAlert=async(f)=>{ if(f.id)await sbPatch("hub_alerts",f.id,{title:f.title,body:f.body,category:f.category,alert_type:f.alert_type}); else await sbPost("hub_alerts",{title:f.title,body:f.body,category:f.category,alert_type:f.alert_type||"warning",sort_order:0,active:true}); fire("approved","Reminder saved"); setEditModal(null); reload(); };
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

  if(loading) return <div style={{padding:"40px 0",textAlign:"center",color:"#aaa",fontSize:13}}>Loading hub…</div>;

  return (
    <div style={{fontFamily:"'Segoe UI',system-ui,sans-serif",minHeight:"100vh",background:"#f0f4f8",paddingBottom:60}}>
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
      <div style={{background:"#003087",padding:"14px 18px 0",color:"#fff"}}>
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
            style={{width:"100%",boxSizing:"border-box",padding:"10px 36px",borderRadius:10,border:"none",fontSize:13,outline:"none",background:"rgba(255,255,255,.95)",color:"#1a1a1a"}}/>
          {q&&<button onClick={()=>setQ("")} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:16,color:"#aaa"}}>✕</button>}
        </div>
        {/* Tabs */}
        <div style={{display:"flex",gap:0,overflowX:"auto",marginLeft:-18,paddingLeft:18,marginRight:-18}}>
          {allTabs.map(t=>(
            <button key={t.k} onClick={()=>setTab(t.k)} style={{padding:"8px 14px",border:"none",background:"none",cursor:"pointer",fontSize:12,fontWeight:tab===t.k?700:400,color:tab===t.k?"#fff":"rgba(255,255,255,.55)",borderBottom:tab===t.k?"2.5px solid #fff":"2.5px solid transparent",whiteSpace:"nowrap",transition:"all .15s"}}>{t.l}</button>
          ))}
        </div>
      </div>

      <div style={{padding:"14px 14px 0",maxWidth:800,margin:"0 auto"}}>

        {/* HOME / SEARCH RESULTS */}
        {tab==="home"&&(
          <div>
            {/* Active closures banner */}
            {closures.length>0&&(
              <div style={{background:"#fde8e8",border:"1.5px solid #f5b7b1",borderRadius:12,padding:"12px 14px",marginBottom:12}}>
                <p style={{margin:"0 0 8px",fontSize:11,fontWeight:700,color:"#c0392b",letterSpacing:1,textTransform:"uppercase"}}>🚫 Active Closures</p>
                {closures.map((c,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:i<closures.length-1?6:0}}>
                    <div><p style={{margin:0,fontWeight:600,fontSize:13,color:"#7a1a1a"}}>{c.location_name}</p><p style={{margin:0,fontSize:11,color:"#c0392b"}}>{c.start_date} → {c.end_date} · {c.reason}</p></div>
                  </div>
                ))}
              </div>
            )}

            {/* Search results */}
            {term&&(
              <div>
                {matchLoc.length>0&&(
                  <div style={{marginBottom:14}}>
                    <p style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:"#003087",margin:"0 0 8px",fontWeight:700}}>📍 Locations</p>
                    {matchLoc.slice(0,3).map((l,i)=><HubLocCard key={i} loc={l} closures={getClosures(l.name)} isManager={isManager} onEdit={()=>setEditModal({type:"loc",item:l})}/>)}
                  </div>
                )}
                {matchPromo.length>0&&(
                  <div style={{marginBottom:14}}>
                    <p style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:"#c0392b",margin:"0 0 8px",fontWeight:700}}>🎯 Promos</p>
                    {matchPromo.map((p,i)=><HubPromoCard key={i} promo={p} isManager={isManager} onEdit={()=>setEditModal({type:"promo",item:p})}/>)}
                  </div>
                )}
                {matchTeam.length>0&&(
                  <div style={{marginBottom:14}}>
                    <p style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:"#1a5c35",margin:"0 0 8px",fontWeight:700}}>👤 Team</p>
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
                  <div style={{textAlign:"center",padding:"36px 0",color:"#aaa"}}><p style={{fontSize:28,margin:"0 0 6px"}}>🤔</p><p style={{fontWeight:600,fontSize:14,color:"#888"}}>No results for "{q}"</p></div>
                )}
              </div>
            )}

            {/* No search — show dashboard */}
            {!term&&(
              <div>
                {/* Active Promos */}
                {promos.length>0&&(
                  <div style={{marginBottom:16}}>
                    <p style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:"#856404",margin:"0 0 8px",fontWeight:700}}>🎯 Active Promotions</p>
                    {promos.map((p,i)=><HubPromoCard key={i} promo={p} isManager={isManager} onEdit={()=>setEditModal({type:"promo",item:p})}/>)}
                    {isManager&&<button onClick={()=>setEditModal({type:"promo",item:null})} style={{width:"100%",padding:"9px",borderRadius:10,border:"1.5px dashed #ddd",background:"transparent",cursor:"pointer",fontSize:12,color:"#aaa",marginTop:6}}>+ Add Promo</button>}
                  </div>
                )}
                {promos.length===0&&(
                  <div style={{background:"#fffdf8",border:"1.5px solid #f0c080",borderRadius:12,padding:"14px",marginBottom:16,textAlign:"center"}}>
                    <p style={{margin:0,fontSize:13,color:"#856404"}}>🎯 No active promotions right now</p>
                    {isManager&&<button onClick={()=>setEditModal({type:"promo",item:null})} style={{marginTop:8,padding:"6px 14px",borderRadius:8,border:"none",background:"#003087",color:"#fff",cursor:"pointer",fontSize:12,fontWeight:600}}>+ Add Promo</button>}
                  </div>
                )}
                {/* Quick access */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
                  {[
                    {icon:"📍",label:"Find Location & Price",sub:"Search any school",action:()=>setTab("locations"),color:"#003087",bg:"#e8f0fe"},
                    {icon:"🏊",label:"Level Assessment",sub:"Find the right class",action:()=>setTab("levels"),color:"#1a5c35",bg:"#eafaf1"},
                    {icon:"📄",label:"Documents",sub:"Scripts, SOPs, pricing",action:()=>setTab("docs"),color:"#8e44ad",bg:"#f5eefb"},
                    {icon:"👤",label:"Team Extensions",sub:"Copy any extension",action:()=>setTab("team"),color:"#e07b00",bg:"#fff8ee"},
                  ].map((c,i)=>(
                    <div key={i} onClick={c.action} style={{background:"#fff",borderRadius:12,padding:"14px",border:`1.5px solid ${c.bg}`,cursor:"pointer",transition:"all .15s"}}>
                      <span style={{fontSize:22}}>{c.icon}</span>
                      <p style={{margin:"6px 0 2px",fontWeight:600,fontSize:13,color:c.color}}>{c.label}</p>
                      <p style={{margin:0,fontSize:11,color:"#aaa"}}>{c.sub}</p>
                    </div>
                  ))}
                </div>
                {/* Events if any */}
                {events.length>0&&(
                  <div style={{background:"#fff",borderRadius:12,border:"1.5px solid #efefef",padding:"12px 14px",marginBottom:16}}>
                    <p style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:"#e07b00",margin:"0 0 8px",fontWeight:700}}>📅 Upcoming</p>
                    {events.map((e,i)=>(
                      <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:i<events.length-1?6:0}}>
                        <p style={{margin:0,fontSize:13,fontWeight:500}}>{e.name}</p>
                        <span style={{fontSize:11,color:"#888"}}>{e.event_date}{e.note?` · ${e.note}`:""}</span>
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
            <div style={{position:"sticky",top:0,zIndex:10,paddingBottom:10,paddingTop:4,background:"#f0f4f8"}}>
  <div style={{display:"flex",gap:8,marginBottom:8}}>
                <div style={{position:"relative",flex:1}}>
                  <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search by name, region, or extension…"
                    style={{width:"100%",boxSizing:"border-box",padding:"11px 14px",borderRadius:10,border:"1.5px solid #ddd",fontSize:13,outline:"none",background:"#fff"}}/>
                  {q&&<button onClick={()=>setQ("")} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:16,color:"#aaa"}}>✕</button>}
                </div>
              </div>
              <ZipFinder locations={locations} closures={closureMap} isManager={isManager} onEdit={(l)=>setEditModal({type:"loc",item:l})}/>
            </div>
            {matchLoc.length===0&&term&&(
              <p style={{textAlign:"center",color:"#aaa",padding:"30px 0",fontSize:13}}>No locations found for "{q}"</p>
            )}
            {matchLoc.length>0&&Object.entries(matchLoc.reduce((acc,l)=>{if(!acc[l.region])acc[l.region]=[];acc[l.region].push(l);return acc;},{})).map(([region,locs])=>(
              <div key={region} style={{marginBottom:16}}>
                <p style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:"#003087",margin:"0 0 8px",fontWeight:700}}>{region} ({locs.length})</p>
                {locs.map((l,i)=><HubLocCard key={i} loc={l} closures={getClosures(l.name)} isManager={isManager} onEdit={()=>setEditModal({type:"loc",item:l})}/>)}
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
                <p style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:"#555",margin:"0 0 8px",fontWeight:700}}>{cat}</p>
                {catDocs.map((d,i)=><HubDocCard key={i} doc={d} isManager={isManager} onEdit={()=>setEditModal({type:"doc",item:d})}/>)}
              </div>
            ))}
          </div>
        )}

        {/* MANAGER TABS */}
        {tab==="promos"&&isManager&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{background:"#fff3cd",border:"1.5px solid #f0c080",borderRadius:9,padding:"8px 12px",flex:1,marginRight:10}}><p style={{margin:0,fontSize:11,color:"#856404",fontWeight:600}}>⚡ Check expiry dates before applying any promo</p></div>
              <button onClick={()=>setEditModal({type:"promo",item:null})} style={{padding:"8px 14px",borderRadius:8,border:"none",background:"#003087",color:"#fff",cursor:"pointer",fontSize:12,fontWeight:600,whiteSpace:"nowrap"}}>+ Add Promo</button>
            </div>
            {promos.map((p,i)=><HubPromoCard key={i} promo={p} isManager={true} onEdit={()=>setEditModal({type:"promo",item:p})}/>)}
          </div>
        )}
        {tab==="closures"&&isManager&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <p style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:"#c0392b",margin:0,fontWeight:700}}>Active Closures ({closures.length})</p>
              <button onClick={()=>setEditModal({type:"closure",item:null})} style={{padding:"6px 12px",borderRadius:8,border:"none",background:"#c0392b",color:"#fff",cursor:"pointer",fontSize:12,fontWeight:600}}>+ Log Closure</button>
            </div>
            {closures.length===0&&<div style={{textAlign:"center",padding:"30px 0",color:"#bbb"}}><p style={{fontSize:22,margin:"0 0 6px"}}>✅</p><p style={{fontSize:13,color:"#aaa"}}>No active closures</p></div>}
            {closures.map((c,i)=>(
              <div key={i} style={{background:"#fdf0ee",border:"1.5px solid #f5b7b1",borderRadius:12,padding:"12px 14px",marginBottom:7,display:"flex",alignItems:"flex-start",gap:10}}>
                <span style={{fontSize:18}}>🚫</span>
                <div style={{flex:1}}>
                  <p style={{margin:0,fontWeight:600,fontSize:13,color:"#7a1a1a"}}>{c.location_name}</p>
                  <p style={{margin:"2px 0",fontSize:11,color:"#c0392b"}}>{c.start_date} → {c.end_date}</p>
                  <p style={{margin:0,fontSize:11,color:"#888"}}>{c.reason}</p>
                </div>
                <div style={{display:"flex",gap:5}}>
                  <button onClick={()=>setEditModal({type:"closure",item:c})} style={{padding:"4px 8px",borderRadius:6,border:"1.5px solid #ddd",background:"#fff",cursor:"pointer",fontSize:10,color:"#888"}}>Edit</button>
                  <button onClick={()=>deleteClosure(c.id)} style={{padding:"4px 8px",borderRadius:6,border:"1.5px solid #f5b7b1",background:"#fdf0ee",cursor:"pointer",fontSize:10,color:"#c0392b"}}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
        {tab==="team"&&(
          <div>
            <p style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:"#1a5c35",margin:"0 0 10px",fontWeight:700}}>ESC Team Extensions</p>
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
              <div key={i} style={{background:"#fff",borderRadius:12,border:"1.5px solid #efefef",padding:"11px 14px",marginBottom:7,display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:20}}>🏊</span>
                <div style={{flex:1}}><p style={{margin:0,fontWeight:600,fontSize:13}}>{e.name}</p><p style={{margin:"2px 0 0",fontSize:11,color:"#888"}}>{e.event_date}{e.note?` · ${e.note}`:""}</p></div>
                <button onClick={()=>setEditModal({type:"event",item:e})} style={{padding:"4px 8px",borderRadius:6,border:"1.5px solid #ddd",background:"#fff",cursor:"pointer",fontSize:10,color:"#888"}}>Edit</button>
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
      <div style={{background:"#fff",borderRadius:14,border:"1.5px solid #efefef",overflow:"hidden",marginBottom:12}}>
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
              <p style={{margin:"0 0 12px",fontSize:14,color:"#444",fontWeight:500}}>Step 1 — Select swimmer's age:</p>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {AGE_BUCKETS.map((b,i)=>(
                  <button key={i} onClick={()=>goTo(b.node)}
                    style={{padding:"13px 16px",borderRadius:10,border:"1.5px solid #d4eadc",background:"#f4fbf6",cursor:"pointer",fontSize:14,fontWeight:600,color:"#1a5c35",textAlign:"left",display:"flex",alignItems:"center",justifyContent:"space-between",transition:"all .15s"}}>
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
                <div style={{flex:1,height:4,background:"#f0f0f0",borderRadius:4,overflow:"hidden"}}>
                  <div style={{width:`${(node.qNum/node.qTotal)*100}%`,height:"100%",background:"#1a5c35",transition:"width .3s"}}/>
                </div>
                <span style={{fontSize:11,color:"#aaa",whiteSpace:"nowrap"}}>Q{node.qNum} of {node.qTotal}</span>
              </div>

              {/* Question */}
              <div style={{background:"#f4fbf6",borderRadius:10,border:"1.5px solid #d4eadc",padding:"14px 16px",marginBottom:16}}>
                <p style={{margin:"0 0 4px",fontSize:10,color:"#1a5c35",fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>Ask the parent:</p>
                <p style={{margin:0,fontSize:14,fontWeight:600,color:"#1a1a1a",lineHeight:1.6}}>{node.ask}</p>
              </div>

              {/* YES / NO */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                <button onClick={()=>goTo(node.yes)}
                  style={{padding:"18px 12px",borderRadius:12,border:"2px solid #1a5c35",background:"#eafaf1",cursor:"pointer",fontSize:16,fontWeight:800,color:"#1a5c35",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                  ✅ YES
                </button>
                <button onClick={()=>goTo(node.no)}
                  style={{padding:"18px 12px",borderRadius:12,border:"2px solid #c0392b",background:"#fdf0ee",cursor:"pointer",fontSize:16,fontWeight:800,color:"#c0392b",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                  ❌ NO
                </button>
              </div>

              {history.length>0&&<button onClick={goBack} style={{background:"none",border:"none",cursor:"pointer",fontSize:12,color:"#aaa",padding:0}}>← Back</button>}
            </div>
          )}

          {/* RESULT */}
          {isResult&&(
            <div>
              {/* Level badge */}
              <div style={{background:"linear-gradient(135deg,#1a5c35,#2ecc71)",borderRadius:12,padding:"16px",marginBottom:14,textAlign:"center"}}>
                <p style={{margin:"0 0 2px",fontSize:10,color:"rgba(255,255,255,.7)",letterSpacing:1.5,textTransform:"uppercase"}}>Recommended Level</p>
                <p style={{margin:"0 0 6px",fontSize:26,fontWeight:800,color:"#fff"}}>{node.level}</p>
                <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
                  <span style={{fontSize:11,background:"rgba(255,255,255,.2)",color:"#fff",padding:"3px 10px",borderRadius:20}}>Max: {node.max}</span>
                  <span style={{fontSize:11,background:"rgba(255,255,255,.2)",color:"#fff",padding:"3px 10px",borderRadius:20}}>{node.parentIn?"👨‍👩‍👦 Parent in water":"🏊 No parent required"}</span>
                </div>
              </div>

              {/* Script */}
              <div style={{background:"#f4fbf6",borderRadius:10,border:"1.5px solid #d4eadc",padding:"12px 14px",marginBottom:12}}>
                <p style={{margin:"0 0 6px",fontSize:10,fontWeight:700,color:"#1a5c35",letterSpacing:.5,textTransform:"uppercase"}}>📢 Say this to the parent:</p>
                <p style={{margin:0,fontSize:13,color:"#2c3e50",lineHeight:1.7,fontStyle:"italic"}}>"{node.script}"</p>
              </div>

              <div style={{display:"flex",gap:8}}>
                <button onClick={copyScript}
                  style={{flex:1,padding:"12px",borderRadius:10,border:"none",background:copied?"#1a5c35":"#003087",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:700,transition:"background .2s"}}>
                  {copied?"✓ Script Copied to Clipboard!":"📋 Copy Script"}
                </button>
                {history.length>0&&<button onClick={goBack} style={{padding:"12px 14px",borderRadius:10,border:"1.5px solid #ddd",background:"#fff",cursor:"pointer",fontSize:12,color:"#888"}}>← Back</button>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick reference table */}
      <div style={{background:"#fff",borderRadius:12,border:"1.5px solid #efefef",padding:"12px 14px"}}>
        <p style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:"#555",margin:"0 0 10px",fontWeight:700}}>Quick Reference</p>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
            <thead>
              <tr style={{background:"#f4fbf6"}}>
                {["Level","Age","Key skills","Max"].map(h=>(
                  <th key={h} style={{padding:"6px 8px",textAlign:"left",fontWeight:600,color:"#1a5c35",borderBottom:"1.5px solid #d4eadc"}}>{h}</th>
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
                <tr key={i} style={{borderBottom:"1px solid #f5f5f5",background:i%2===0?"#fff":"#fafcff"}}>
                  <td style={{padding:"6px 8px",fontWeight:600,color:"#1a5c35"}}>{l}</td>
                  <td style={{padding:"6px 8px",color:"#555"}}>{a}</td>
                  <td style={{padding:"6px 8px",color:"#555"}}>{s}</td>
                  <td style={{padding:"6px 8px",fontWeight:600,color:"#1a1a1a"}}>{m}</td>
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
    <div style={{background:"#fff",borderRadius:10,border:"1.5px solid #e0e8f5",padding:"12px 14px",marginBottom:8}}>
      <p style={{margin:"0 0 8px",fontSize:11,fontWeight:700,color:"#003087",letterSpacing:.5}}>🔍 Find by Zip Code</p>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <input
          value={zip}
          onChange={e=>search(e.target.value.replace(/[^0-9]/g,"").slice(0,5))}
          placeholder="Enter zip code…"
          maxLength={5}
          style={{flex:1,padding:"9px 12px",borderRadius:9,border:"1.5px solid #ddd",fontSize:14,outline:"none",letterSpacing:2,fontWeight:600}}
        />
        {zip&&<button onClick={()=>{setZip("");setResults(null);}} style={{padding:"9px 12px",borderRadius:9,border:"1.5px solid #ddd",background:"#fff",cursor:"pointer",fontSize:12,color:"#888"}}>Clear</button>}
      </div>
      {zip.length>=3&&results!==null&&(
        <div style={{marginTop:10}}>
          {results.length===0&&(
            <div style={{textAlign:"center",padding:"12px 0",color:"#aaa"}}>
              <p style={{margin:0,fontSize:13}}>No schools found near {zip}</p>
              <p style={{margin:"4px 0 0",fontSize:11}}>Try a nearby zip or search by name above</p>
            </div>
          )}
          {results.length>0&&(
            <div>
              <p style={{margin:"0 0 8px",fontSize:11,color:"#1a5c35",fontWeight:600}}>{results.length} school{results.length>1?"s":""} found near {zip}</p>
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
    <div style={{background:"#fff",borderRadius:12,border:`1.5px solid ${hasClosure?"#f5b7b1":"#e0e8f5"}`,marginBottom:8,overflow:"hidden"}}>
      <div style={{padding:"12px 14px"}}>
        {hasClosure&&closures.map((c,i)=>(
          <div key={i} style={{background:"#fde8e8",borderRadius:7,padding:"5px 9px",marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:12}}>🚫</span>
            <p style={{margin:0,fontSize:11,color:"#c0392b",fontWeight:600}}>{c.start_date} to {c.end_date} · {c.reason}</p>
          </div>
        ))}
        <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:4}}>
              <span style={{fontWeight:700,fontSize:15,color:"#1a1a1a"}}>{loc.name}</span>
              <span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:"#e8f0fe",color:"#003087",fontWeight:700}}>{loc.region}</span>
              <span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:loc.pool==="Salt"?"#fff3cd":"#e8f4fd",color:loc.pool==="Salt"?"#856404":"#0d6efd",fontWeight:700}}>{loc.pool}</span>
              {loc.privates&&<span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:"#eafaf1",color:"#1a5c35",fontWeight:700}}>20min Privates</span>}
            </div>
            <p style={{margin:"0 0 4px",fontSize:11,color:"#aaa"}}>📍 {loc.addr}</p>
            {loc.direct_phone&&<p style={{margin:"0 0 4px",fontSize:12,color:"#1a1a1a",fontWeight:500}}>📞 {loc.direct_phone}</p>}
            {loc.gm_name&&<p style={{margin:"0 0 6px",fontSize:11,color:"#888"}}>👤 GM: {loc.gm_name}</p>}
            {pricing&&(
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:4}}>
                <span style={{fontSize:11,background:"#e8f0fe",color:"#003087",padding:"2px 8px",borderRadius:6,fontWeight:600}}>M–F ${pricing.mf}</span>
                <span style={{fontSize:11,background:"#f0f4f8",color:"#555",padding:"2px 8px",borderRadius:6}}>Sa–Su ${pricing.ss}</span>
                <span style={{fontSize:11,background:"#f5eefb",color:"#8e44ad",padding:"2px 8px",borderRadius:6}}>Private ${pricing.priv}</span>
                <span style={{fontSize:11,background:"#fff8ee",color:"#e07b00",padding:"2px 8px",borderRadius:6}}>ODL ${pricing.odl}</span>
              </div>
            )}
          </div>
          <div style={{textAlign:"right",flexShrink:0}}>
            <p style={{margin:"0 0 6px",fontSize:24,fontWeight:800,color:"#003087",letterSpacing:1}}>{loc.ext}</p>
            <div style={{display:"flex",gap:5,justifyContent:"flex-end",marginBottom:5}}>
              <button onClick={()=>{navigator.clipboard?.writeText(loc.ext);setCopiedExt(true);setTimeout(()=>setCopiedExt(false),1500);}} style={{padding:"5px 11px",borderRadius:7,border:"1.5px solid #003087",background:copiedExt?"#003087":"#e8f0fe",cursor:"pointer",fontSize:11,color:copiedExt?"#fff":"#003087",fontWeight:600,transition:"all .2s"}}>{copiedExt?"✓ Copied":"Copy Ext"}</button>
              {isManager&&<button onClick={onEdit} style={{padding:"5px 8px",borderRadius:7,border:"1.5px solid #ddd",background:"#fff",cursor:"pointer",fontSize:10,color:"#aaa"}}>Edit</button>}
            </div>
            {loc.direct_phone&&(
              <button onClick={()=>{navigator.clipboard?.writeText(loc.direct_phone);setCopiedPhone(true);setTimeout(()=>setCopiedPhone(false),1500);}} style={{padding:"4px 10px",borderRadius:7,border:"1.5px solid #1a5c35",background:copiedPhone?"#1a5c35":"#f0faf4",cursor:"pointer",fontSize:10,color:copiedPhone?"#fff":"#1a5c35",fontWeight:600,transition:"all .2s",width:"100%"}}>{copiedPhone?"✓ Phone Copied":"Copy Phone"}</button>
            )}
          </div>
        </div>
        {/* Expand toggle */}
        {(Object.keys(hours).length>0||instructors.length>0)&&(
          <button onClick={()=>setExpanded(!expanded)} style={{marginTop:8,padding:"5px 0",background:"none",border:"none",cursor:"pointer",fontSize:11,color:"#003087",fontWeight:600,display:"flex",alignItems:"center",gap:4}}>
            {expanded?"▲ Less info":"▼ Hours, pool & instructors"}
          </button>
        )}
      </div>

      {/* Expanded details */}
      {expanded&&(
        <div style={{borderTop:"1px solid #f0f4f8",padding:"12px 14px",background:"#fafcff"}}>
          {/* Hours */}
          {Object.keys(hours).length>0&&(
            <div style={{marginBottom:12}}>
              <p style={{margin:"0 0 8px",fontSize:11,fontWeight:700,color:"#003087",textTransform:"uppercase",letterSpacing:.5}}>🕐 Location Hours</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"3px 10px"}}>
                {days.map(d=>(
                  <div key={d} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"3px 0",borderBottom:"1px solid #f0f0f0"}}>
                    <span style={{color:"#888",fontWeight:500}}>{d.slice(0,3)}</span>
                    <span style={{color:hours[d]==='CLOSED'?"#e74c3c":"#1a1a1a",fontWeight:hours[d]==='CLOSED'?600:400}}>{hours[d]||'—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Pool specs */}
          {(loc.pool_dim||loc.pool_depth)&&(
            <div style={{marginBottom:12,display:"flex",gap:10}}>
              {loc.pool_dim&&<span style={{fontSize:11,background:"#e8f4fd",color:"#0d6efd",padding:"3px 9px",borderRadius:7}}>📐 {loc.pool_dim}</span>}
              {loc.pool_depth&&<span style={{fontSize:11,background:"#e8f4fd",color:"#0d6efd",padding:"3px 9px",borderRadius:7}}>↕ {loc.pool_depth}</span>}
              <span style={{fontSize:11,background:"#fff8ee",color:"#e07b00",padding:"3px 9px",borderRadius:7}}>🌡 90°F</span>
            </div>
          )}
          {/* Special needs & languages highlight */}
          {(snInstructors.length>0||langInstructors.length>0)&&(
            <div style={{marginBottom:12,display:"flex",gap:8,flexWrap:"wrap"}}>
              {snInstructors.length>0&&<span style={{fontSize:11,background:"#eafaf1",color:"#1a5c35",padding:"3px 9px",borderRadius:7,fontWeight:600}}>♿ {snInstructors.length} special needs instructor{snInstructors.length>1?"s":""}</span>}
              {langInstructors.length>0&&<span style={{fontSize:11,background:"#f5eefb",color:"#8e44ad",padding:"3px 9px",borderRadius:7,fontWeight:600}}>🌍 {[...new Set(langInstructors.flatMap(i=>i.lang.split(/[,&\/]/).map(l=>l.trim()).filter(l=>l&&l.toLowerCase()!=='english')))].join(", ")}</span>}
            </div>
          )}
          {/* Instructors */}
          {instructors.length>0&&(
            <div>
              <p style={{margin:"0 0 8px",fontSize:11,fontWeight:700,color:"#003087",textTransform:"uppercase",letterSpacing:.5}}>👩‍🏫 Instructors ({instructors.length})</p>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {instructors.map((ins,i)=>(
                  <div key={i} style={{background:"#fff",borderRadius:9,padding:"8px 10px",border:"1px solid #efefef"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:ins.desc?3:0}}>
                      <span style={{fontWeight:600,fontSize:12}}>{ins.name}</span>
                      {ins.level&&<span style={{fontSize:9,background:ins.level.toLowerCase().includes('manager')?"#e8f0fe":"#f0f4f8",color:ins.level.toLowerCase().includes('manager')?"#003087":"#888",padding:"1px 5px",borderRadius:3,fontWeight:600}}>{ins.level}</span>}
                      {ins.sn==='Y'&&<span style={{fontSize:9,background:"#eafaf1",color:"#1a5c35",padding:"1px 5px",borderRadius:3,fontWeight:600}}>SEN</span>}
                      {ins.lang&&ins.lang.toLowerCase()!=='english'&&ins.lang.toLowerCase()!=='english '&&<span style={{fontSize:9,background:"#f5eefb",color:"#8e44ad",padding:"1px 5px",borderRadius:3}}>{ins.lang}</span>}
                    </div>
                    {ins.desc&&<p style={{margin:0,fontSize:11,color:"#666",lineHeight:1.4}}>{ins.desc}</p>}
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
    <div style={{background:"#fff",borderRadius:12,border:`1.5px solid ${isExpiring?"#f5b7b1":"#f0c080"}`,padding:"12px 14px",marginBottom:8}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:6}}>
            <span style={{fontWeight:700,fontSize:13}}>{promo.title}</span>
            {promo.proactive&&<span style={{fontSize:9,background:"#eafaf1",color:"#1a5c35",padding:"2px 6px",borderRadius:4,fontWeight:700}}>Offer proactively</span>}
            {!promo.proactive&&<span style={{fontSize:9,background:"#fdf0ee",color:"#c0392b",padding:"2px 6px",borderRadius:4,fontWeight:700}}>Customer mentions only</span>}
            {promo.expires_on&&<span style={{fontSize:9,background:isExpiring?"#fde8e8":"#fff3cd",color:isExpiring?"#c0392b":"#856404",padding:"2px 6px",borderRadius:4,fontWeight:700}}>Exp: {promo.expires_on}</span>}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <span style={{fontSize:14,fontWeight:800,color:"#003087",background:"#e8f0fe",padding:"4px 12px",borderRadius:8,letterSpacing:.5}}>{promo.code}</span>
            <button onClick={()=>{navigator.clipboard?.writeText(promo.code);setCopiedCode(true);setTimeout(()=>setCopiedCode(false),1500);}} style={{padding:"4px 10px",borderRadius:7,border:"1.5px solid #003087",background:copiedCode?"#003087":"#fff",cursor:"pointer",fontSize:11,color:copiedCode?"#fff":"#003087",fontWeight:600,transition:"all .2s"}}>{copiedCode?"✓ Copied":"Copy Code"}</button>
          </div>
        </div>
        <div style={{display:"flex",gap:5,flexShrink:0}}>
          {isManager&&<button onClick={e=>{e.stopPropagation();onEdit();}} style={{padding:"4px 8px",borderRadius:6,border:"1.5px solid #ddd",background:"#fff",cursor:"pointer",fontSize:10,color:"#888"}}>Edit</button>}
          <button onClick={()=>setExpanded(!expanded)} style={{padding:"4px 8px",borderRadius:6,border:"1.5px solid #ddd",background:"#fff",cursor:"pointer",fontSize:12,color:"#aaa"}}>{expanded?"▲":"▼"}</button>
        </div>
      </div>
      {expanded&&(
        <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid #f5f5f5"}}>
          <p style={{margin:"0 0 4px",fontSize:10,fontWeight:700,color:"#888",letterSpacing:.5,textTransform:"uppercase"}}>Full Rules</p>
          <p style={{margin:0,fontSize:12,color:"#444",lineHeight:1.7,whiteSpace:"pre-line"}}>{promo.rules}</p>
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
        return <p key={i} style={{margin:"10px 0 4px",fontSize:11,fontWeight:700,color:"#003087",letterSpacing:.5,textTransform:"uppercase"}}>{trimmed}</p>;
      if(trimmed.startsWith('"')&&trimmed.endsWith('"'))
        return <p key={i} style={{margin:"4px 0",fontSize:12,color:"#1a5c35",background:"#f0faf4",borderLeft:"3px solid #1a5c35",padding:"4px 8px",borderRadius:"0 6px 6px 0",lineHeight:1.6}}>{trimmed}</p>;
      if(trimmed.startsWith('☐')||trimmed.startsWith('✓'))
        return <p key={i} style={{margin:"3px 0",fontSize:12,color:"#555",paddingLeft:8}}>{trimmed}</p>;
      if(trimmed.startsWith('→')||trimmed.includes(' → '))
        return <p key={i} style={{margin:"3px 0",fontSize:12,color:"#8e44ad",fontWeight:500,paddingLeft:8}}>{trimmed}</p>;
      if(trimmed.match(/^\d+\./)||trimmed.match(/^(STEP|Step)\s+\d+/))
        return <p key={i} style={{margin:"6px 0 2px",fontSize:12,fontWeight:700,color:"#1a1a1a"}}>{trimmed}</p>;
      return <p key={i} style={{margin:"2px 0",fontSize:12,color:"#444",lineHeight:1.6}}>{trimmed}</p>;
    });
  };

  return (
    <div style={{background:"#fff",borderRadius:12,border:"1.5px solid #efefef",padding:"11px 14px",marginBottom:7}}>
      <div style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}} onClick={()=>setExpanded(!expanded)}>
        <span style={{fontSize:18,flexShrink:0}}>📄</span>
        <div style={{flex:1}}>
          <p style={{margin:0,fontWeight:600,fontSize:13,color:"#1a1a1a"}}>{doc.title}</p>
        </div>
        <div style={{display:"flex",gap:5,flexShrink:0}}>
          {isManager&&<button onClick={e=>{e.stopPropagation();onEdit();}} style={{padding:"3px 8px",borderRadius:6,border:"1.5px solid #ddd",background:"#fff",cursor:"pointer",fontSize:10,color:"#888"}}>Edit</button>}
          <span style={{fontSize:14,color:"#aaa",padding:"3px 6px"}}>{expanded?"▲":"▼"}</span>
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
    <div style={{background:"#fff",borderRadius:12,border:"1.5px solid #efefef",padding:"10px 13px",marginBottom:6,display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
      <div style={{flex:1}}>
        <p style={{margin:"0 0 2px",fontWeight:600,fontSize:13}}>{loc.name}</p>
        <p style={{margin:"0 0 3px",fontSize:11,color:"#aaa"}}>{loc.addr}</p>
        <div style={{display:"flex",gap:10}}>
          <span style={{fontSize:11,color:"#888"}}>Current: <strong style={{color:"#003087"}}>{loc.current}</strong></span>
          <span style={{fontSize:11,color:"#888"}}>New: <strong style={{color:"#8e44ad"}}>{loc.queue}</strong></span>
        </div>
      </div>
      <button onClick={()=>{navigator.clipboard?.writeText(loc.current);setCop(true);setTimeout(()=>setCop(false),1500);}} style={{padding:"5px 10px",borderRadius:7,border:"1.5px solid #ddd",background:cop?"#1a5c35":"#fafafa",cursor:"pointer",fontSize:11,color:cop?"#fff":"#888",fontWeight:600,transition:"all .2s",flexShrink:0}}>{cop?"✓":"Copy"}</button>
    </div>
  );
}

function HubTeamCard({member}) {
  const [copied,setCopied]=useState(false);
  return (
    <div style={{background:"#fff",borderRadius:12,border:"1.5px solid #efefef",padding:"10px 14px",marginBottom:6,display:"flex",alignItems:"center",gap:10}}>
      <div style={{width:32,height:32,borderRadius:"50%",background:"#eafaf1",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"#1a5c35",flexShrink:0}}>{avatar(member.name)}</div>
      <p style={{margin:0,flex:1,fontWeight:600,fontSize:13}}>{member.name}</p>
      <span style={{fontSize:16,fontWeight:800,color:"#1a5c35",marginRight:8}}>{member.ext}</span>
      <button onClick={()=>{navigator.clipboard?.writeText(member.ext);setCopied(true);setTimeout(()=>setCopied(false),1500);}} style={{padding:"5px 10px",borderRadius:7,border:"1.5px solid #1a5c35",background:copied?"#1a5c35":"#f0faf4",cursor:"pointer",fontSize:11,color:copied?"#fff":"#1a5c35",fontWeight:600,transition:"all .2s"}}>{copied?"✓":"Copy"}</button>
    </div>
  );
}


// ── HUB EDIT MODALS ───────────────────────────────────────────────────
function HubPromoModal({item,onClose,onSave,onDelete}) {
  const [f,setF]=useState({title:item?.title||"",code:item?.code||"",rules:item?.rules||"",expires_on:item?.expires_on||"",proactive:item?.proactive||false,id:item?.id});
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  return (
    <Modal title={item?"Edit Promo":"Add Promo"} sub="PROMO" onClose={onClose} wide>
      <div style={{display:"flex",flexDirection:"column",gap:11}}>
        <div><label style={{fontSize:12,color:"#666",display:"block",marginBottom:3}}>Title</label><input value={f.title} onChange={e=>set("title",e.target.value)} style={{width:"100%",padding:"9px 11px",borderRadius:9,border:"1.5px solid #ddd",fontSize:13,outline:"none"}}/></div>
        <div><label style={{fontSize:12,color:"#666",display:"block",marginBottom:3}}>Promo Code</label><input value={f.code} onChange={e=>set("code",e.target.value)} style={{width:"100%",padding:"9px 11px",borderRadius:9,border:"1.5px solid #ddd",fontSize:13,outline:"none"}}/></div>
        <div><label style={{fontSize:12,color:"#666",display:"block",marginBottom:3}}>Full Rules</label><textarea value={f.rules} onChange={e=>set("rules",e.target.value)} rows={5} style={{width:"100%",padding:"9px 11px",borderRadius:9,border:"1.5px solid #ddd",fontSize:12,outline:"none",resize:"vertical",lineHeight:1.6}}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><label style={{fontSize:12,color:"#666",display:"block",marginBottom:3}}>Expiry Date (leave blank = ongoing)</label><input type="date" value={f.expires_on} onChange={e=>set("expires_on",e.target.value)} style={{width:"100%",padding:"9px 11px",borderRadius:9,border:"1.5px solid #ddd",fontSize:13,outline:"none"}}/></div>
          <div style={{display:"flex",alignItems:"center",gap:8,paddingTop:20}}>
            <input type="checkbox" id="proactive" checked={f.proactive} onChange={e=>set("proactive",e.target.checked)} style={{width:16,height:16,cursor:"pointer"}}/>
            <label htmlFor="proactive" style={{fontSize:13,cursor:"pointer"}}>May offer proactively</label>
          </div>
        </div>
        <div style={{display:"flex",gap:8,marginTop:4}}>
          {item&&<Btn label="Remove Promo" onClick={()=>{onDelete(item.id);}} color="#e74c3c" small/>}
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
          <label style={{fontSize:12,color:"#666",display:"block",marginBottom:3}}>Location</label>
          <input value={f.location_name} onChange={e=>set("location_name",e.target.value)} placeholder="e.g. Fort Worth" list="loc-list" style={{width:"100%",padding:"9px 11px",borderRadius:9,border:"1.5px solid #ddd",fontSize:13,outline:"none"}}/>
          <datalist id="loc-list">{locations.map((l,i)=><option key={i} value={l.name}/>)}</datalist>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><label style={{fontSize:12,color:"#666",display:"block",marginBottom:3}}>Start Date</label><input type="date" value={f.start_date} onChange={e=>set("start_date",e.target.value)} style={{width:"100%",padding:"9px 11px",borderRadius:9,border:"1.5px solid #ddd",fontSize:13,outline:"none"}}/></div>
          <div><label style={{fontSize:12,color:"#666",display:"block",marginBottom:3}}>End Date</label><input type="date" value={f.end_date} onChange={e=>set("end_date",e.target.value)} style={{width:"100%",padding:"9px 11px",borderRadius:9,border:"1.5px solid #ddd",fontSize:13,outline:"none"}}/></div>
        </div>
        <div><label style={{fontSize:12,color:"#666",display:"block",marginBottom:3}}>Reason</label><input value={f.reason} onChange={e=>set("reason",e.target.value)} placeholder="e.g. Maintenance, Public Holiday" style={{width:"100%",padding:"9px 11px",borderRadius:9,border:"1.5px solid #ddd",fontSize:13,outline:"none"}}/></div>
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
            style={{border:"2px dashed #8e44ad",borderRadius:12,padding:"18px",textAlign:"center",cursor:"pointer",background:"#f5eefb",transition:"background .2s"}}
          >
            <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md,.csv" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>
            {extracting?(
              <div><p style={{margin:0,fontSize:13,color:"#8e44ad",fontWeight:600}}>Extracting content…</p><p style={{margin:"4px 0 0",fontSize:11,color:"#aaa"}}>This may take a few seconds</p></div>
            ):(
              <div>
                <p style={{margin:0,fontSize:22}}>📂</p>
                <p style={{margin:"6px 0 2px",fontSize:13,fontWeight:600,color:"#8e44ad"}}>Drop a file or click to upload</p>
                <p style={{margin:0,fontSize:11,color:"#aaa"}}>PDF · Word (.docx) · CSV · TXT — category auto-detected from filename</p>
              </div>
            )}
          </div>
        )}
        {uploadErr&&<div style={{background:"#fdf0ee",border:"1.5px solid #f5b7b1",borderRadius:9,padding:"9px 12px"}}><p style={{margin:0,fontSize:12,color:"#c0392b"}}>{uploadErr}</p></div>}
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:10}}>
          <div><label style={{fontSize:12,color:"#666",display:"block",marginBottom:3}}>Document Title</label><input value={f.title} onChange={e=>set("title",e.target.value)} placeholder="Auto-filled from filename" style={{width:"100%",padding:"9px 11px",borderRadius:9,border:"1.5px solid #ddd",fontSize:13,outline:"none"}}/></div>
          <div><label style={{fontSize:12,color:"#666",display:"block",marginBottom:3}}>Category</label>
            <select value={f.category} onChange={e=>set("category",e.target.value)} style={{width:"100%",padding:"9px 11px",borderRadius:9,border:"1.5px solid #ddd",fontSize:13,outline:"none",background:"#fff"}}>
              {cats.map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label style={{fontSize:12,color:"#666",display:"block",marginBottom:3}}>Content {f.content&&<span style={{color:"#1a5c35",fontWeight:600}}>✓ Extracted</span>}</label>
          <textarea value={f.content} onChange={e=>set("content",e.target.value)} rows={10} placeholder="Upload a file above or paste content here…" style={{width:"100%",padding:"9px 11px",borderRadius:9,border:`1.5px solid ${f.content?"#c8e6c9":"#ddd"}`,fontSize:12,outline:"none",resize:"vertical",lineHeight:1.7,fontFamily:"inherit"}}/>
          <p style={{margin:"4px 0 0",fontSize:11,color:"#aaa"}}>Review and edit extracted content before saving.</p>
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
        <div><label style={{fontSize:12,color:"#666",display:"block",marginBottom:3}}>Extension</label><input value={f.ext} onChange={e=>set("ext",e.target.value)} style={{width:"100%",padding:"9px 11px",borderRadius:9,border:"1.5px solid #ddd",fontSize:13,outline:"none"}}/></div>
        <div><label style={{fontSize:12,color:"#666",display:"block",marginBottom:3}}>Address</label><input value={f.addr} onChange={e=>set("addr",e.target.value)} style={{width:"100%",padding:"9px 11px",borderRadius:9,border:"1.5px solid #ddd",fontSize:13,outline:"none"}}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,alignItems:"center"}}>
          <div><label style={{fontSize:12,color:"#666",display:"block",marginBottom:3}}>Pool Type</label>
            <select value={f.pool} onChange={e=>set("pool",e.target.value)} style={{width:"100%",padding:"9px 11px",borderRadius:9,border:"1.5px solid #ddd",fontSize:13,outline:"none",background:"#fff"}}>
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
        <div><label style={{fontSize:12,color:"#666",display:"block",marginBottom:3}}>Event Name</label><input value={f.name} onChange={e=>set("name",e.target.value)} style={{width:"100%",padding:"9px 11px",borderRadius:9,border:"1.5px solid #ddd",fontSize:13,outline:"none"}}/></div>
        <div><label style={{fontSize:12,color:"#666",display:"block",marginBottom:3}}>Date</label><input value={f.event_date} onChange={e=>set("event_date",e.target.value)} placeholder="e.g. Jul 11, 2026" style={{width:"100%",padding:"9px 11px",borderRadius:9,border:"1.5px solid #ddd",fontSize:13,outline:"none"}}/></div>
        <div><label style={{fontSize:12,color:"#666",display:"block",marginBottom:3}}>Note (optional)</label><input value={f.note} onChange={e=>set("note",e.target.value)} placeholder="e.g. Tentative" style={{width:"100%",padding:"9px 11px",borderRadius:9,border:"1.5px solid #ddd",fontSize:13,outline:"none"}}/></div>
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

function QuoteCalculator({locations}) {
  const [locId,    setLocId]    = useState("");
  const [custType, setCustType] = useState("lead");
  const [regUsed,  setRegUsed]  = useState(0);
  // FIX 8: global weeks selector (all lessons same month)
  const [weeks,    setWeeks]    = useState(4);
  const [enrollMo, setEnrollMo] = useState(new Date().getMonth());
  const [students, setStudents] = useState([{id:1,name:"Child 1",lessons:[{id:1,type:"group_mf"}]}]);
  const [promoChecked, setPromoChecked] = useState([]);

  const loc = locations.find(l=>l.id===locId);
  // FIX 10: isEmler checks partner regions
  const isPartner = loc && PARTNER_REGIONS.some(b=>loc.region?.includes(b)||loc.name?.includes(b));
  const isEmler = !!loc && !isPartner;
  const sibExempt = loc && SIBLING_EXEMPT_LOCS.some(n=>loc.name?.includes(n));
  // Sibling discount applies: Emler only, not exempt locations
  const canSibDiscount = isEmler && !sibExempt;

  const getRate = (type) => {
    if(!loc) return 0;
    const lt = LESSON_TYPES.find(t=>t.key===type);
    return lt ? (parseFloat(loc[lt.priceKey])||0) : 0;
  };

  // Student management
  const addStudent  = ()    => setStudents(s=>[...s,{id:Date.now(),name:`Child ${s.length+1}`,lessons:[{id:Date.now(),type:"group_mf"}]}]);
  const remStudent  = (sid) => setStudents(s=>s.filter(st=>st.id!==sid));
  const updStudent  = (sid,f,v) => setStudents(s=>s.map(st=>st.id===sid?{...st,[f]:v}:st));
  const addLesson   = (sid) => setStudents(s=>s.map(st=>st.id===sid?{...st,lessons:[...st.lessons,{id:Date.now(),type:"group_mf"}]}:st));
  const remLesson   = (sid,lid) => setStudents(s=>s.map(st=>st.id===sid?{...st,lessons:st.lessons.filter(l=>l.id!==lid)}:st));
  const updLesson   = (sid,lid,f,v) => setStudents(s=>s.map(st=>st.id===sid?{...st,lessons:st.lessons.map(l=>l.id===lid?{...l,[f]:v}:l)}:st));

  // ── AVAILABLE PROMOS ──────────────────────────────────────────────
  // FIX 1: DIVEIN40 excludes SwimKids (isEmler = false for SwimKids)
  // FIX 11: Day28 and DIVEIN40 both reduce first month — only show one or the other
  const promos = [];
  if(isEmler && enrollMo===5 && custType!=="active")
    promos.push({code:"DIVEIN40",label:"40% Off June Tuition (DIVEIN40)",pct:40,note:"Continuous lessons only — no ODLs or clinics"});
  if(custType!=="active")
    promos.push({code:"REFERRAL",label:"Referral — $50 off per student",fixed:50,note:"New family must mention referrer by name"});
  if(custType==="lead" && !promoChecked.includes("DIVEIN40"))
    promos.push({code:"DAY28",label:"Lead Day 28 — 20% off first month",pct:20,note:"Do NOT offer proactively — customer must mention"});

  const togglePromo = (code) => setPromoChecked(p=>p.includes(code)?p.filter(c=>c!==code):[...p,code]);

  // ── PER-STUDENT CALCULATION ───────────────────────────────────────
  const calcStudent = (student, si) => {
    const lines = student.lessons.map((lesson, li) => {
      const lt    = LESSON_TYPES.find(t=>t.key===lesson.type);
      const rate  = getRate(lesson.type);
      const monthly = lt?.continuous ? rate * weeks : rate * (lesson.type==="clinic" ? 5 : 1);
      const canMulti = li > 0 && lt?.continuous;
      const multiDisc = canMulti ? monthly * 0.10 : 0;
      const afterMulti = monthly - multiDisc;
      // Per-line promo: only continuous non-clinic non-ODL lessons eligible for % promo
      const promoEligible = !!(lt?.continuous && lt?.key !== "clinic");
      return {lt, rate, monthly, multiDisc, afterMulti, promoEligible, net: afterMulti, continuous: lt?.continuous, group: lt?.group};
    });

    const grossMonthly = lines.reduce((s,l)=>s+l.net, 0);

    // Sibling discount ONLY on continuous GROUP lessons
    const groupContinuousTotal = lines.filter(l=>l.group&&l.continuous).reduce((s,l)=>s+l.net,0);
    const sibDisc = (si>0 && canSibDiscount) ? groupContinuousTotal * 0.10 : 0;
    const afterSib = grossMonthly - sibDisc;

    // % promo per eligible line (not a lump sum — transparent to rep)
    let pctPromoLabel = "";
    const pctRate = promoChecked.includes("DIVEIN40") ? 0.40
                  : promoChecked.includes("DAY28")    ? 0.20 : 0;
    if(pctRate > 0) pctPromoLabel = promoChecked.includes("DIVEIN40") ? "DIVEIN40" : "Day28";

    // Build per-line promo discounts (shown per lesson in breakdown)
    const linesWithPromo = lines.map((l,li)=>{
      const sibLineDisc = (l.group && l.continuous && si>0 && canSibDiscount) ? l.net * 0.10 : 0;
      const netAfterSib = l.net - sibLineDisc;
      const promoLineDisc = l.promoEligible ? netAfterSib * pctRate : 0;
      return {...l, sibLineDisc, netAfterSib, promoLineDisc, finalNet: netAfterSib - promoLineDisc};
    });

    const pctPromoDisc = linesWithPromo.reduce((s,l)=>s+l.promoLineDisc, 0);
    const referralDisc = promoChecked.includes("REFERRAL") ? 50 : 0;
    const totalPromoDisc = pctPromoDisc + referralDisc;
    const promoLabel = [pctPromoLabel, promoChecked.includes("REFERRAL")?"Referral":""].filter(Boolean).join(" + ");

    // Reg fee
    const regFee = (regUsed + si) < 2 ? REG_FEE : 0;

    const rawDueToday = regFee + afterSib - totalPromoDisc;
    const dueToday = Math.max(0, rawDueToday);
    const creditNote = rawDueToday < 0 ? Math.abs(rawDueToday) : 0; // credit applied to account
    // FIX 9: two ongoing amounts — months 1-3 (with sibling) vs month 4+ (without)
    const ongoing1to3 = afterSib;  // with sibling discount
    const ongoing4plus = grossMonthly; // sibling discount ends after 3 months

    return {linesWithPromo, lines, grossMonthly, groupContinuousTotal, sibDisc, afterSib, pctPromoDisc, pctRate, referralDisc, totalPromoDisc, promoLabel, regFee, dueToday, creditNote, ongoing1to3, ongoing4plus, hasSibDisc: sibDisc > 0};
  };

  const calcs = students.map((s,i)=>calcStudent(s,i));
  const grandToday   = calcs.reduce((s,c)=>s+c.dueToday, 0);
  const grandOngoing13 = calcs.reduce((s,c)=>s+c.ongoing1to3, 0);
  const grandOngoing4  = calcs.reduce((s,c)=>s+c.ongoing4plus, 0);
  const hasSibDisc = calcs.some(c=>c.hasSibDisc);

  const fmt = (n) => `$${(n||0).toFixed(2)}`;
  const [copied, setCopied] = useState(false);

  const genScript = () => {
    const mo = MONTHS[enrollMo];
    const out = ["\"Today\'s total is " + fmt(grandToday) + ", which includes:\""];
    calcs.forEach((c,i)=>{
      const name = students[i].name||`Child ${i+1}`;
      if(c.regFee>0) out.push(`  • $${REG_FEE} annual registration for ${name}`);
      if(c.regFee===0&&regUsed+i>=2) out.push(`  • Registration fee waived for ${name} — family max reached`);
      c.linesWithPromo.forEach((l,li)=>{
        const lbl = l.lt?.label||"";
        const baseAmt = l.afterMulti||l.net;
        out.push(`  • ${fmt(baseAmt)} ${mo} tuition for ${name} (${lbl}${li>0&&l.continuous?" — 10% multi-class":""})`);
        if((l.sibLineDisc||0)>0) out.push(`    minus ${fmt(l.sibLineDisc)} sibling discount — first 3 full months`);
        if((l.promoLineDisc||0)>0) out.push(`    minus ${fmt(l.promoLineDisc)} ${c.promoLabel} discount — continuous lessons only`);
        if(!(l.promoEligible)&&c.pctRate>0) out.push(`    (promo does not apply to ${l.lt?.key==="clinic"?"clinics":"ODL"})`);
      });
      if(c.referralDisc>0) out.push(`  • Minus $50 Referral discount for ${name}`);
      if((c.creditNote||0)>0) out.push(`  • Note: discount exceeds tuition — ${fmt(c.creditNote)} credit added to account`);
    });
    out.push("");
    if(hasSibDisc){
      out.push(`"For the first 3 months you will be billed ${fmt(grandOngoing13)} on the 20th. From month 4 onwards your billing will be ${fmt(grandOngoing4)}."`);
    } else {
      out.push(`"Going forward you will be billed ${fmt(grandOngoing13)} on the 20th of each month. Months with 5 classes will be slightly higher."`);
    }
    return out.join("\n");
  };

  const copyScript = ()=>{navigator.clipboard?.writeText(genScript().replace(/\\n/g,"\n"));setCopied(true);setTimeout(()=>setCopied(false),2000);};

  return (
    <div style={{fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
      {/* Header */}
      <div style={{background:"linear-gradient(135deg,#003087,#0057b8)",borderRadius:14,padding:"16px",marginBottom:14,color:"#fff"}}>
        <p style={{margin:"0 0 2px",fontSize:10,letterSpacing:1.5,textTransform:"uppercase",opacity:.7}}>Hub Tool</p>
        <p style={{margin:0,fontSize:18,fontWeight:800}}>🧮 Quote Calculator</p>
        <p style={{margin:"4px 0 0",fontSize:12,opacity:.7}}>Build an accurate quote — reads straight to the customer on the call</p>
      </div>

      {/* Step 1 */}
      <div style={{background:"#fff",borderRadius:12,border:"1.5px solid #efefef",padding:"14px",marginBottom:10}}>
        <p style={{margin:"0 0 10px",fontSize:11,fontWeight:700,color:"#003087",textTransform:"uppercase",letterSpacing:.5}}>① Location & Customer</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
          <div>
            <label style={{fontSize:11,color:"#666",display:"block",marginBottom:4}}>Location</label>
            <select value={locId} onChange={e=>setLocId(e.target.value)} style={{width:"100%",padding:"9px 10px",borderRadius:9,border:"1.5px solid #ddd",fontSize:12,outline:"none",background:"#fff"}}>
              <option value="">Select location…</option>
              {[...locations].sort((a,b)=>a.name.localeCompare(b.name)).map(l=>(
                <option key={l.id} value={l.id}>{l.name}{l.region&&l.region!==l.name?` (${l.region})`:""}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{fontSize:11,color:"#666",display:"block",marginBottom:4}}>Customer Type</label>
            <select value={custType} onChange={e=>setCustType(e.target.value)} style={{width:"100%",padding:"9px 10px",borderRadius:9,border:"1.5px solid #ddd",fontSize:12,outline:"none",background:"#fff"}}>
              <option value="lead">New Lead (never enrolled)</option>
              <option value="lapsed">Lapsed (was enrolled before)</option>
              <option value="active">Active Customer</option>
            </select>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
          <div>
            <label style={{fontSize:11,color:"#666",display:"block",marginBottom:4}}>Start Month</label>
            <select value={enrollMo} onChange={e=>setEnrollMo(+e.target.value)} style={{width:"100%",padding:"9px 10px",borderRadius:9,border:"1.5px solid #ddd",fontSize:12,outline:"none",background:"#fff"}}>
              {MONTHS.map((m,i)=><option key={i} value={i}>{m} 2026</option>)}
            </select>
          </div>
          <div>
            {/* FIX 8: global weeks */}
            <label style={{fontSize:11,color:"#666",display:"block",marginBottom:4}}>Weeks this month</label>
            <select value={weeks} onChange={e=>setWeeks(+e.target.value)} style={{width:"100%",padding:"9px 10px",borderRadius:9,border:"1.5px solid #ddd",fontSize:12,outline:"none",background:"#fff"}}>
              <option value={4}>4 weeks (standard)</option>
              <option value={5}>5 weeks (higher month)</option>
            </select>
          </div>
          <div>
            <label style={{fontSize:11,color:"#666",display:"block",marginBottom:4}}>Reg fees used this year</label>
            <select value={regUsed} onChange={e=>setRegUsed(+e.target.value)} style={{width:"100%",padding:"9px 10px",borderRadius:9,border:"1.5px solid #ddd",fontSize:12,outline:"none",background:"#fff"}}>
              <option value={0}>0 — new family</option>
              <option value={1}>1 — one child already enrolled</option>
              <option value={2}>2+ — max already reached</option>
            </select>
          </div>
        </div>
        {loc&&!loc.price_mf&&<div style={{marginTop:10,background:"#fff3cd",border:"1.5px solid #f0c080",borderRadius:8,padding:"8px 12px"}}><p style={{margin:0,fontSize:11,color:"#856404"}}>⚠️ No pricing loaded for this location — run SQL_4_pricing.sql</p></div>}
        {loc&&isPartner&&<div style={{marginTop:10,background:"#e8f0fe",border:"1.5px solid #aed6f1",borderRadius:8,padding:"8px 12px"}}><p style={{margin:0,fontSize:11,color:"#003087"}}>ℹ️ Partner brand — sibling discount auto-applies via ICP. DIVEIN40 not available.</p></div>}
      </div>

      {/* Step 2: Students */}
      <div style={{background:"#fff",borderRadius:12,border:"1.5px solid #efefef",padding:"14px",marginBottom:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <p style={{margin:0,fontSize:11,fontWeight:700,color:"#003087",textTransform:"uppercase",letterSpacing:.5}}>② Students & Lessons</p>
          <button onClick={addStudent} style={{padding:"5px 12px",borderRadius:8,border:"none",background:"#003087",color:"#fff",cursor:"pointer",fontSize:11,fontWeight:600}}>+ Add Child</button>
        </div>
        {students.map((student,si)=>{
          const calc = loc ? calcs[si] : null;
          return (
            <div key={student.id} style={{background:si>0?"#f8faf8":"#f8f9fa",borderRadius:10,padding:"12px",marginBottom:8,border:`1.5px solid ${si>0&&canSibDiscount?"#c8e6c9":"#efefef"}`}}>
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}>
                <input value={student.name} onChange={e=>updStudent(student.id,"name",e.target.value)} style={{flex:1,padding:"7px 10px",borderRadius:8,border:"1.5px solid #ddd",fontSize:13,outline:"none"}} placeholder="Child name"/>
                {si>0&&canSibDiscount&&<span style={{fontSize:10,background:"#eafaf1",color:"#1a5c35",padding:"3px 7px",borderRadius:5,fontWeight:700,whiteSpace:"nowrap"}}>10% off group (3 mo)</span>}
                {si>0&&!canSibDiscount&&isPartner&&<span style={{fontSize:10,background:"#e8f0fe",color:"#003087",padding:"3px 7px",borderRadius:5,fontWeight:700,whiteSpace:"nowrap"}}>ICP auto-sibling</span>}
                {si>0&&<button onClick={()=>remStudent(student.id)} style={{padding:"5px 9px",borderRadius:7,border:"1.5px solid #f5b7b1",background:"#fdf0ee",cursor:"pointer",fontSize:11,color:"#c0392b"}}>Remove</button>}
              </div>
              {student.lessons.map((lesson,li)=>{
                const lt = LESSON_TYPES.find(t=>t.key===lesson.type);
                const rate = getRate(lesson.type);
                const canMultiHere = li>0 && lt?.continuous;
                return (
                  <div key={lesson.id} style={{display:"flex",gap:8,alignItems:"center",marginBottom:6}}>
                    <select value={lesson.type} onChange={e=>updLesson(student.id,lesson.id,"type",e.target.value)} style={{flex:1,padding:"7px 10px",borderRadius:8,border:`1.5px solid ${canMultiHere?"#c8e6c9":"#ddd"}`,fontSize:12,outline:"none",background:"#fff"}}>
                      {LESSON_TYPES.map(t=>{
                        const r = getRate(t.key);
                        // FIX 14: show ⚠️ for lesson types with no price data
                        if(!r && t.priceKey !== "price_mf") return <option key={t.key} value={t.key} disabled style={{color:"#aaa"}}>{t.label} — no price data</option>;
                        return <option key={t.key} value={t.key}>{t.label}{r?` — $${r}/class`:""}</option>;
                      })}
                    </select>
                    {canMultiHere&&<span style={{fontSize:10,color:"#1a5c35",fontWeight:700,whiteSpace:"nowrap"}}>−10%</span>}
                    {!canMultiHere&&li>0&&<span style={{fontSize:10,color:"#aaa",whiteSpace:"nowrap"}}>no disc</span>}
                    {li>0&&<button onClick={()=>remLesson(student.id,lesson.id)} style={{padding:"5px 7px",borderRadius:7,border:"1.5px solid #f5b7b1",background:"#fdf0ee",cursor:"pointer",fontSize:10,color:"#c0392b"}}>✕</button>}
                    {li===0&&<div style={{width:54}}/>}
                  </div>
                );
              })}
              <button onClick={()=>addLesson(student.id)} style={{marginTop:2,padding:"4px 10px",borderRadius:7,border:"1.5px solid #003087",background:"#e8f0fe",cursor:"pointer",fontSize:11,color:"#003087",fontWeight:600}}>+ Lesson</button>
              {calc&&loc&&(
                <p style={{margin:"8px 0 0",fontSize:11,color:"#888"}}>Monthly: {fmt(calc.ongoing1to3)}{calc.hasSibDisc?` (→ ${fmt(calc.ongoing4plus)} from month 4)`:""}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Step 3: Promos */}
      {promos.length>0&&(
        <div style={{background:"#fff",borderRadius:12,border:"1.5px solid #f0c080",padding:"14px",marginBottom:10}}>
          <p style={{margin:"0 0 10px",fontSize:11,fontWeight:700,color:"#856404",textTransform:"uppercase",letterSpacing:.5}}>③ Available Promotions</p>
          {promos.map(p=>(
            <div key={p.code} onClick={()=>togglePromo(p.code)} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"10px 11px",borderRadius:9,border:`1.5px solid ${promoChecked.includes(p.code)?"#1a5c35":"#ddd"}`,background:promoChecked.includes(p.code)?"#eafaf1":"#fff",cursor:"pointer",marginBottom:6}}>
              <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${promoChecked.includes(p.code)?"#1a5c35":"#ddd"}`,background:promoChecked.includes(p.code)?"#1a5c35":"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>
                {promoChecked.includes(p.code)&&<span style={{fontSize:11,color:"#fff",fontWeight:800}}>✓</span>}
              </div>
              <div>
                <p style={{margin:0,fontSize:13,fontWeight:600}}>{p.label}</p>
                <p style={{margin:0,fontSize:10,color:"#888"}}>{p.note}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Step 4: Breakdown */}
      {loc&&(
        <div style={{background:"#fff",borderRadius:12,border:"1.5px solid #efefef",padding:"14px",marginBottom:10}}>
          <p style={{margin:"0 0 12px",fontSize:11,fontWeight:700,color:"#003087",textTransform:"uppercase",letterSpacing:.5}}>④ Quote Breakdown</p>
          {calcs.map((c,i)=>(
            <div key={students[i].id} style={{marginBottom:12,paddingBottom:12,borderBottom:i<calcs.length-1?"1px solid #f5f5f5":"none"}}>
              <p style={{margin:"0 0 6px",fontWeight:700,fontSize:13}}>{students[i].name||`Child ${i+1}`}</p>
              {c.linesWithPromo.map((l,li)=>(
                <div key={li} style={{marginBottom:5,paddingLeft:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#555"}}>
                    <span>{l.lt?.label} ({l.lt?.continuous?`${weeks} × ${fmt(l.rate)}`:`${fmt(l.rate)}/class`}){li>0&&l.continuous?" — 10% multi-class":""}</span>
                    <span style={{fontWeight:500,flexShrink:0,marginLeft:8}}>{fmt(l.afterMulti)}</span>
                  </div>
                  {l.sibLineDisc>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#1a5c35",paddingLeft:8}}><span>Sibling discount −10% (mo 1–3)</span><span>−{fmt(l.sibLineDisc)}</span></div>}
                  {l.promoLineDisc>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#1a5c35",paddingLeft:8}}><span>{c.promoLabel.includes("DIVEIN40")?"DIVEIN40":"Day28"} −{c.promoLabel.includes("DIVEIN40")?"40":"20"}% (eligible lesson)</span><span>−{fmt(l.promoLineDisc)}</span></div>}
                  {!l.promoEligible&&c.pctRate>0&&<div style={{fontSize:10,color:"#e07b00",paddingLeft:8}}>⚠️ Promo does not apply to {l.lt?.key==="clinic"?"clinics":"ODL"}</div>}
                </div>
              ))}
              {c.referralDisc>0&&(
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#1a5c35",marginBottom:3,paddingLeft:8}}>
                  <span>Referral $50 off</span><span>−{fmt(c.referralDisc)}</span>
                </div>
              )}
              {c.regFee>0&&(
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#555",marginBottom:3,paddingLeft:8}}>
                  <span>Annual registration fee</span><span>{fmt(c.regFee)}</span>
                </div>
              )}
              {c.regFee===0&&regUsed+i>=2&&(
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#1a5c35",marginBottom:3,paddingLeft:8}}>
                  <span>Registration fee — waived (max 2/family reached)</span><span>$0.00</span>
                </div>
              )}
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:700,color:"#003087",marginTop:5,paddingTop:5,borderTop:"1px solid #efefef"}}>
                <span>Due today — {students[i].name||`Child ${i+1}`}</span><span>{fmt(c.dueToday)}</span>
              </div>
              {c.creditNote>0&&<div style={{fontSize:11,color:"#1a5c35",marginTop:3,fontStyle:"italic"}}>ℹ️ Discount exceeds tuition — {fmt(c.creditNote)} credit added to account balance</div>}
            </div>
          ))}
          {/* Grand totals */}
          <div style={{background:"#003087",borderRadius:10,padding:"14px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{fontSize:15,fontWeight:800,color:"#fff"}}>TOTAL DUE TODAY</span>
              <span style={{fontSize:24,fontWeight:800,color:"#fff"}}>{fmt(grandToday)}</span>
            </div>
            <div style={{height:"1px",background:"rgba(255,255,255,.2)",marginBottom:8}}/>
            {hasSibDisc ? (
              <>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"rgba(255,255,255,.8)",marginBottom:4}}>
                  <span>Monthly billing — months 1 to 3</span><span style={{fontWeight:700}}>{fmt(grandOngoing13)}</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"rgba(255,255,255,.6)"}}>
                  <span>Monthly billing — month 4 onwards</span><span>{fmt(grandOngoing4)}</span>
                </div>
              </>
            ) : (
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"rgba(255,255,255,.8)"}}>
                <span>Monthly billing (on 20th)</span><span style={{fontWeight:700}}>{fmt(grandOngoing13)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Script */}
      {loc&&students.length>0&&(
        <div style={{background:"#f4fbf6",borderRadius:12,border:"1.5px solid #c8e6c9",padding:"14px",marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <p style={{margin:0,fontSize:11,fontWeight:700,color:"#1a5c35",textTransform:"uppercase",letterSpacing:.5}}>📢 Read to Customer</p>
            <button onClick={copyScript} style={{padding:"5px 12px",borderRadius:8,border:"none",background:copied?"#1a5c35":"#003087",color:"#fff",cursor:"pointer",fontSize:11,fontWeight:600,transition:"background .2s"}}>{copied?"✓ Copied":"Copy Script"}</button>
          </div>
          <div style={{fontSize:13,color:"#2c3e50",lineHeight:1.9}}>
            <p style={{margin:"0 0 6px",fontStyle:"italic"}}>"Today's total is <strong style={{color:"#003087"}}>{fmt(grandToday)}</strong>, which includes:"</p>
            {calcs.map((c,i)=>{
              const name = students[i].name||`Child ${i+1}`;
              return (
                <div key={i} style={{marginBottom:8,paddingLeft:8}}>
                  {c.regFee>0&&<p style={{margin:"0 0 3px"}}>• ${REG_FEE} annual registration for {name}</p>}
                  {c.regFee===0&&regUsed+i>=2&&<p style={{margin:"0 0 3px",color:"#1a5c35"}}>• Registration fee waived for {name} — family max reached</p>}
                  {c.linesWithPromo.map((l,li)=>(
                    <div key={li}>
                      <p style={{margin:"0 0 2px"}}>• {fmt(l.afterMulti)} {MONTHS[enrollMo]} tuition for {name} ({l.lt?.label}{li>0&&l.continuous?" — 10% multi-class":""})</p>
                      {l.sibLineDisc>0&&<p style={{margin:"0 0 2px",paddingLeft:12,color:"#1a5c35"}}>  minus {fmt(l.sibLineDisc)} sibling discount — first 3 full months</p>}
                      {l.promoLineDisc>0&&<p style={{margin:"0 0 2px",paddingLeft:12,color:"#1a5c35"}}>  minus {fmt(l.promoLineDisc)} {c.promoLabel} — continuous lessons only</p>}
                    </div>
                  ))}
                  {c.referralDisc>0&&<p style={{margin:"0 0 3px",color:"#1a5c35"}}>• Minus $50 Referral discount for {name}</p>}
                </div>
              );
            })}
            {hasSibDisc ? (
              <>
                <p style={{margin:"8px 0 3px",fontStyle:"italic"}}>"For the first 3 months you will be billed <strong style={{color:"#003087"}}>{fmt(grandOngoing13)}</strong> on the 20th of each month."</p>
                <p style={{margin:0,fontStyle:"italic"}}>"From month 4 onwards your monthly billing will be <strong style={{color:"#003087"}}>{fmt(grandOngoing4)}</strong>. Months with 5 classes will be slightly higher."</p>
              </>
            ) : (
              <p style={{margin:"8px 0 0",fontStyle:"italic"}}>"Going forward you will be billed <strong style={{color:"#003087"}}>{fmt(grandOngoing13)}</strong> on the 20th of each month. Months with 5 classes will be slightly higher."</p>
            )}
          </div>
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
    error:  {bg:"#fdf0ee",border:"#f5b7b1",icon:"🚨",text:"#c0392b"},
    warning:{bg:"#fffdf8",border:"#f0c080",icon:"⚠️",text:"#856404"},
    info:   {bg:"#e8f0fe",border:"#aed6f1",icon:"ℹ️",text:"#1a4a8a"},
  };

  return (
    <div>
      {/* ENROLLMENT CHECKLIST */}
      <div style={{background:"#fff",borderRadius:14,border:"1.5px solid #efefef",overflow:"hidden",marginBottom:14}}>
        <div style={{background:"#003087",padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
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
        <div style={{height:4,background:"#e0e8f5"}}>
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
              <p style={{margin:"0 0 6px",fontSize:11,fontWeight:700,color:"#555",letterSpacing:.3}}>{cat}</p>
              {items.map(item=>(
                <div key={item.id} onClick={()=>toggle(item.id)}
                  style={{display:"flex",alignItems:"flex-start",gap:10,padding:"8px 10px",borderRadius:9,cursor:"pointer",background:checked[item.id]?"#f0faf4":"#fafafa",border:`1px solid ${checked[item.id]?"#c8e6c9":"#efefef"}`,marginBottom:5,transition:"all .15s"}}>
                  <div style={{width:20,height:20,borderRadius:5,border:`2px solid ${checked[item.id]?"#1a5c35":"#ddd"}`,background:checked[item.id]?"#1a5c35":"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1,transition:"all .15s"}}>
                    {checked[item.id]&&<span style={{fontSize:12,color:"#fff",fontWeight:800}}>✓</span>}
                  </div>
                  <p style={{margin:0,fontSize:12,color:checked[item.id]?"#1a5c35":"#444",lineHeight:1.5,textDecoration:checked[item.id]?"line-through":"none",transition:"all .15s"}}>{item.text}</p>
                </div>
              ))}
            </div>
          ))}
          <button onClick={resetChecklist} style={{width:"100%",padding:"9px",borderRadius:9,border:"1.5px solid #ddd",background:"#fff",cursor:"pointer",fontSize:12,color:"#888",marginTop:4,fontWeight:500}}>
            ↺ Reset for next customer
          </button>
        </div>
      </div>

      {/* RULES REFERENCE */}
      <div style={{marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <p style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:"#c0392b",margin:0,fontWeight:700}}>⚠️ Common Mistakes — Rules</p>
          {isManager&&<button onClick={onAdd} style={{padding:"6px 12px",borderRadius:8,border:"none",background:"#c0392b",color:"#fff",cursor:"pointer",fontSize:12,fontWeight:600}}>+ Add Reminder</button>}
        </div>
        {Object.entries(alertsByCat).map(([cat,catAlerts])=>(
          <div key={cat} style={{marginBottom:12}}>
            <button onClick={()=>setOpenCat(openCat===cat?null:cat)}
              style={{width:"100%",padding:"10px 14px",borderRadius:10,border:"1.5px solid #efefef",background:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:openCat===cat?8:0}}>
              <span style={{fontSize:13,fontWeight:600,color:"#1a1a1a"}}>{cat}</span>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:10,background:"#f0f4f8",color:"#888",padding:"2px 7px",borderRadius:10}}>{catAlerts.length} rules</span>
                <span style={{fontSize:14,color:"#aaa"}}>{openCat===cat?"▲":"▼"}</span>
              </div>
            </button>
            {openCat===cat&&catAlerts.map((a,i)=>{
              const style = typeColors[a.alert_type]||typeColors.warning;
              return (
                <div key={i} style={{background:style.bg,border:`1.5px solid ${style.border}`,borderRadius:10,padding:"11px 14px",marginBottom:7,display:"flex",gap:10,alignItems:"flex-start"}}>
                  <span style={{fontSize:16,flexShrink:0}}>{style.icon}</span>
                  <div style={{flex:1}}>
                    <p style={{margin:"0 0 3px",fontWeight:700,fontSize:13,color:style.text}}>{a.title}</p>
                    <p style={{margin:0,fontSize:12,color:"#444",lineHeight:1.6}}>{a.body}</p>
                  </div>
                  {isManager&&<button onClick={()=>onEdit(a)} style={{padding:"3px 8px",borderRadius:6,border:"1.5px solid #ddd",background:"#fff",cursor:"pointer",fontSize:10,color:"#888",flexShrink:0}}>Edit</button>}
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
        <div><label style={{fontSize:12,color:"#666",display:"block",marginBottom:3}}>Title</label><input value={f.title} onChange={e=>set("title",e.target.value)} style={{width:"100%",padding:"9px 11px",borderRadius:9,border:"1.5px solid #ddd",fontSize:13,outline:"none"}}/></div>
        <div><label style={{fontSize:12,color:"#666",display:"block",marginBottom:3}}>Description</label><textarea value={f.body} onChange={e=>set("body",e.target.value)} rows={3} style={{width:"100%",padding:"9px 11px",borderRadius:9,border:"1.5px solid #ddd",fontSize:12,outline:"none",resize:"vertical",lineHeight:1.6,fontFamily:"inherit"}}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><label style={{fontSize:12,color:"#666",display:"block",marginBottom:3}}>Category</label>
            <select value={f.category} onChange={e=>set("category",e.target.value)} style={{width:"100%",padding:"9px 11px",borderRadius:9,border:"1.5px solid #ddd",fontSize:13,outline:"none",background:"#fff"}}>
              {cats.map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          <div><label style={{fontSize:12,color:"#666",display:"block",marginBottom:3}}>Type</label>
            <select value={f.alert_type} onChange={e=>set("alert_type",e.target.value)} style={{width:"100%",padding:"9px 11px",borderRadius:9,border:"1.5px solid #ddd",fontSize:13,outline:"none",background:"#fff"}}>
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

// ── MANAGER PIPELINE ──────────────────────────────────────────────────────
function MgrPipeline({ reps }) {
  const [callbacks, setCallbacks] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filterRep, setFilterRep] = useState("all");
  const [filterStatus, setFilterStatus] = useState("pending");

  const load = async () => {
    setLoading(true);
    try {
      const data = await sb(`callbacks?order=callback_date.asc,callback_time.asc`);
      setCallbacks(data||[]);
    } catch(e) {}
    setLoading(false);
  };

  useEffect(()=>{ load(); },[]);

  const todayStr2 = () => new Date().toISOString().slice(0,10);
  const isOverdue = cb => cb.status==="pending" && (cb.callback_date < todayStr2() || (cb.callback_date===todayStr2() && cb.callback_time < new Date().toTimeString().slice(0,5)));

  const STATUS_CFG = {
    pending:   {label:"Pending",   bg:"#f0faf4", border:"#b7dfca", dot:"#1a7a45"},
    no_answer: {label:"No Answer", bg:"#fff8ee", border:"#f0c080", dot:"#b85c00"},
    done:      {label:"Done",      bg:"#f5f5f5", border:"#e0e0e0", dot:"#aaa"},
  };

  const repNames = [...new Set(callbacks.map(c=>c.rep_name))].sort();
  const filtered = callbacks.filter(c =>
    (filterRep==="all" || c.rep_name===filterRep) &&
    (filterStatus==="all" || c.status===filterStatus)
  );

  const pending   = callbacks.filter(c=>c.status==="pending").length;
  const noAnswer  = callbacks.filter(c=>c.status==="no_answer").length;
  const overdueN  = callbacks.filter(isOverdue).length;
  const doneN     = callbacks.filter(c=>c.status==="done").length;

  // Group by rep for summary
  const byRep = reps.filter(r=>callbacks.some(c=>c.rep_id===r.id)).map(r=>({
    rep: r,
    pending: callbacks.filter(c=>c.rep_id===r.id&&c.status==="pending").length,
    noAnswer: callbacks.filter(c=>c.rep_id===r.id&&c.status==="no_answer").length,
    overdue: callbacks.filter(c=>c.rep_id===r.id&&isOverdue(c)).length,
    done: callbacks.filter(c=>c.rep_id===r.id&&c.status==="done").length,
  }));

  return (
    <div style={{paddingTop:16}}>
      {/* Summary stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:16}}>
        {[
          {n:pending,  l:"Pending",    c:"#1a7a45"},
          {n:overdueN, l:"Overdue",    c:"#c0392b"},
          {n:noAnswer, l:"No Answer",  c:"#b85c00"},
          {n:doneN,    l:"Done",       c:"#aaa"},
        ].map(s=>(
          <div key={s.l} style={{background:"#fff",borderRadius:10,padding:"10px 8px",textAlign:"center",border:"1.5px solid #efefef"}}>
            <p style={{margin:0,fontSize:20,fontWeight:800,color:s.c}}>{s.n}</p>
            <p style={{margin:0,fontSize:9,color:"#aaa",fontWeight:600,textTransform:"uppercase",letterSpacing:.8}}>{s.l}</p>
          </div>
        ))}
      </div>

      {/* Rep summary cards */}
      {byRep.length>0&&(
        <div style={{background:"#fff",borderRadius:12,border:"1.5px solid #efefef",padding:"12px 14px",marginBottom:16}}>
          <p style={{margin:"0 0 10px",fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:"#bbb"}}>By Rep</p>
          {byRep.map(({rep,pending,noAnswer,overdue,done})=>(
            <div key={rep.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid #f5f5f5"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:28,height:28,borderRadius:"50%",background:"#eafaf1",color:"#1a5c35",fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{rep.avatar||avatar(rep.name)}</div>
                <span style={{fontSize:13,fontWeight:600}}>{rep.name}</span>
              </div>
              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                {overdue>0&&<span style={{fontSize:11,color:"#c0392b",fontWeight:700}}>⚠️ {overdue} overdue</span>}
                {pending>0&&<span style={{fontSize:11,color:"#1a7a45"}}>{pending} pending</span>}
                {noAnswer>0&&<span style={{fontSize:11,color:"#b85c00"}}>{noAnswer} no answer</span>}
                {done>0&&<span style={{fontSize:11,color:"#aaa"}}>{done} done</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        <select value={filterRep} onChange={e=>setFilterRep(e.target.value)} style={{padding:"7px 10px",borderRadius:8,border:"1.5px solid #ddd",fontSize:12,outline:"none",background:"#fff",flex:1}}>
          <option value="all">All reps</option>
          {repNames.map(n=><option key={n} value={n}>{n}</option>)}
        </select>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{padding:"7px 10px",borderRadius:8,border:"1.5px solid #ddd",fontSize:12,outline:"none",background:"#fff",flex:1}}>
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="no_answer">No Answer</option>
          <option value="done">Done</option>
        </select>
      </div>

      {loading&&<p style={{textAlign:"center",color:"#bbb",padding:"30px 0"}}>Loading…</p>}

      {!loading&&filtered.length===0&&(
        <div style={{textAlign:"center",padding:"40px 0",color:"#bbb"}}>
          <p style={{fontSize:32,margin:"0 0 8px"}}>📞</p>
          <p style={{fontWeight:600,fontSize:14,color:"#888"}}>No callbacks match this filter</p>
        </div>
      )}

      {!loading&&filtered.map(cb=>{
        const cfg = STATUS_CFG[cb.status]||STATUS_CFG.pending;
        const overdue = isOverdue(cb);
        const dateLabel = cb.callback_date===todayStr2()?"Today":new Date(cb.callback_date+"T12:00:00").toLocaleDateString([],{weekday:"short",month:"short",day:"numeric"});
        return (
          <div key={cb.id} style={{background:overdue?"#fff4f4":cfg.bg,border:`1.5px solid ${overdue?"#f5b7b1":cfg.border}`,borderRadius:12,padding:"12px 14px",marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:6}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:2}}>
                  <span style={{fontWeight:700,fontSize:14}}>{cb.parent_name}</span>
                  {overdue&&<span style={{fontSize:9,background:"#fdf0ee",color:"#c0392b",padding:"2px 6px",borderRadius:4,fontWeight:700}}>OVERDUE</span>}
                  {cb.status==="done"&&<span style={{fontSize:9,background:"#f5f5f5",color:"#aaa",padding:"2px 6px",borderRadius:4,fontWeight:700}}>DONE</span>}
                  {cb.status==="no_answer"&&<span style={{fontSize:9,background:"#fff8ee",color:"#b85c00",padding:"2px 6px",borderRadius:4,fontWeight:700}}>NO ANSWER</span>}
                </div>
                <span style={{fontSize:12,color:"#1a5c35",fontWeight:600}}>📞 {cb.phone}</span>
                <div style={{display:"flex",gap:8,marginTop:3,flexWrap:"wrap"}}>
                  <span style={{fontSize:11,color:overdue?"#c0392b":"#555",fontWeight:overdue?700:400}}>🗓 {dateLabel} 🕐 {fmt12h(cb.callback_time)}</span>
                </div>
                {cb.notes&&<p style={{margin:"5px 0 0",fontSize:11,color:"#888",lineHeight:1.4}}>{cb.notes}</p>}
              </div>
              <div style={{fontSize:11,color:"#aaa",textAlign:"right",flexShrink:0}}>
                <div style={{fontWeight:600,color:"#555"}}>{cb.rep_name}</div>
                <div style={{fontSize:10}}>Rep</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── CALLBACKS ─────────────────────────────────────────────────────────────
function RepCallbacks({ repInfo, fire }) {
  const [callbacks, setCallbacks] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showAdd, setShowAdd]     = useState(false);
  const [editing, setEditing]     = useState(null); // callback obj
  const [saving, setSaving]       = useState(false);

  const blank = { parent_name:"", phone:"", callback_time:"", callback_date:"", notes:"", status:"pending" };
  const [form, setForm] = useState(blank);
  const set = (k,v) => setForm(p=>({...p,[k]:v}));

  const load = async () => {
    setLoading(true);
    try {
      const data = await sb(`callbacks?rep_id=eq.${repInfo.id}&order=callback_date.asc,callback_time.asc`);
      setCallbacks(data||[]);
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  useEffect(()=>{ load(); },[]);

  const openAdd = () => { setForm(blank); setEditing(null); setShowAdd(true); };
  const openEdit = (cb) => { setForm({...cb}); setEditing(cb); setShowAdd(true); };

  const save = async () => {
    if(!form.parent_name.trim()||!form.phone.trim()||!form.callback_date||!form.callback_time){
      fire("declined","Please fill in name, phone, date and time"); return;
    }
    setSaving(true);
    try {
      if(editing) {
        await sbPatch("callbacks", editing.id, {...form, updated_at:new Date().toISOString()});
        fire("approved","Callback updated");
      } else {
        await sbPost("callbacks", {...form, rep_id:repInfo.id, rep_name:repInfo.name, created_at:new Date().toISOString()});
        fire("approved","Callback added to your pipeline");
      }
      setShowAdd(false); load();
    } catch(e) { fire("declined","Error saving — does the callbacks table exist?"); }
    setSaving(false);
  };

  const updateStatus = async (cb, status) => {
    await sbPatch("callbacks", cb.id, {status, updated_at:new Date().toISOString()});
    fire("info", status==="done"?"✅ Marked as done":status==="no_answer"?"📵 Marked no answer":"↩️ Moved back to pending");
    load();
  };

  const remove = async (cb) => {
    await sb(`callbacks?id=eq.${cb.id}`,{method:"DELETE"});
    fire("info","Removed from pipeline");
    load();
  };

  const todayStr2 = () => new Date().toISOString().slice(0,10);
  const isOverdue = cb => cb.status==="pending" && (cb.callback_date < todayStr2() || (cb.callback_date===todayStr2() && cb.callback_time < new Date().toTimeString().slice(0,5)));

  const pending   = callbacks.filter(c=>c.status==="pending");
  const noAnswer  = callbacks.filter(c=>c.status==="no_answer");
  const done      = callbacks.filter(c=>c.status==="done");

  const STATUS_CFG = {
    pending:   {label:"Pending",   bg:"#f0faf4", border:"#b7dfca", dot:"#1a7a45"},
    no_answer: {label:"No Answer", bg:"#fff8ee", border:"#f0c080", dot:"#b85c00"},
    done:      {label:"Done",      bg:"#f5f5f5", border:"#e0e0e0", dot:"#aaa"},
  };

  if(showAdd) return (
    <div style={{paddingTop:16}}>
      <button onClick={()=>setShowAdd(false)} style={{background:"none",border:"none",cursor:"pointer",color:"#1a5c35",fontWeight:700,fontSize:13,marginBottom:14,padding:0}}>← Back</button>
      <div style={{background:"#fff",borderRadius:14,border:"1.5px solid #efefef",padding:"16px"}}>
        <p style={{margin:"0 0 14px",fontSize:14,fontWeight:800,color:"#1a1a1a"}}>{editing?"Edit Callback":"New Callback"}</p>

        <div style={{display:"flex",flexDirection:"column",gap:11}}>
          <div>
            <label style={{fontSize:11,color:"#888",fontWeight:600,display:"block",marginBottom:4}}>PARENT NAME</label>
            <input value={form.parent_name} onChange={e=>set("parent_name",e.target.value)} placeholder="e.g. Sarah Johnson" style={{width:"100%",padding:"10px 12px",borderRadius:9,border:"1.5px solid #ddd",fontSize:13,outline:"none"}}/>
          </div>
          <div>
            <label style={{fontSize:11,color:"#888",fontWeight:600,display:"block",marginBottom:4}}>PHONE NUMBER</label>
            <input value={form.phone} onChange={e=>set("phone",e.target.value)} placeholder="e.g. 082 555 0123" type="tel" style={{width:"100%",padding:"10px 12px",borderRadius:9,border:"1.5px solid #ddd",fontSize:13,outline:"none"}}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div>
              <label style={{fontSize:11,color:"#888",fontWeight:600,display:"block",marginBottom:4}}>CALL BACK DATE</label>
              <input value={form.callback_date} onChange={e=>set("callback_date",e.target.value)} type="date" min={todayStr2()} style={{width:"100%",padding:"10px 12px",borderRadius:9,border:"1.5px solid #ddd",fontSize:13,outline:"none",background:"#fff"}}/>
            </div>
            <div>
              <label style={{fontSize:11,color:"#888",fontWeight:600,display:"block",marginBottom:4}}>CALL BACK TIME</label>
              <input value={form.callback_time} onChange={e=>set("callback_time",e.target.value)} type="time" style={{width:"100%",padding:"10px 12px",borderRadius:9,border:"1.5px solid #ddd",fontSize:13,outline:"none",background:"#fff"}}/>
            </div>
          </div>
          <div>
            <label style={{fontSize:11,color:"#888",fontWeight:600,display:"block",marginBottom:4}}>NOTES <span style={{fontWeight:400,color:"#bbb"}}>(optional)</span></label>
            <textarea value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="e.g. Mum needs to check with husband — interested in Tuesday swim class, Level 2" rows={3} style={{width:"100%",padding:"10px 12px",borderRadius:9,border:"1.5px solid #ddd",fontSize:13,outline:"none",resize:"vertical",fontFamily:"inherit"}}/>
          </div>
          {editing&&(
            <div>
              <label style={{fontSize:11,color:"#888",fontWeight:600,display:"block",marginBottom:4}}>STATUS</label>
              <div style={{display:"flex",gap:8}}>
                {["pending","no_answer","done"].map(s=>(
                  <div key={s} onClick={()=>set("status",s)} style={{flex:1,padding:"8px 0",textAlign:"center",borderRadius:9,border:`1.5px solid ${form.status===s?STATUS_CFG[s].dot:"#ddd"}`,background:form.status===s?STATUS_CFG[s].bg:"#fff",cursor:"pointer",fontSize:11,fontWeight:600,color:form.status===s?STATUS_CFG[s].dot:"#aaa"}}>
                    {STATUS_CFG[s].label}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{display:"flex",gap:8,marginTop:4}}>
            <button onClick={()=>setShowAdd(false)} style={{flex:1,padding:"11px 0",borderRadius:10,border:"1.5px solid #ddd",background:"#fff",color:"#aaa",fontWeight:700,fontSize:13,cursor:"pointer"}}>Cancel</button>
            <button onClick={save} disabled={saving} style={{flex:2,padding:"11px 0",borderRadius:10,border:"none",background:"#1a5c35",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",opacity:saving?.6:1}}>{saving?"Saving…":editing?"Save Changes":"Add to Pipeline"}</button>
          </div>
        </div>
      </div>
    </div>
  );

  const CallbackCard = ({cb}) => {
    const cfg = STATUS_CFG[cb.status]||STATUS_CFG.pending;
    const overdue = isOverdue(cb);
    const dateLabel = cb.callback_date===todayStr2()?"Today":new Date(cb.callback_date+"T12:00:00").toLocaleDateString([],{weekday:"short",month:"short",day:"numeric"});
    return (
      <div style={{background:overdue?"#fff4f4":cfg.bg,border:`1.5px solid ${overdue?"#f5b7b1":cfg.border}`,borderRadius:12,padding:"12px 14px",marginBottom:8}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
              <span style={{fontWeight:700,fontSize:14,color:"#1a1a1a"}}>{cb.parent_name}</span>
              {overdue&&<span style={{fontSize:9,background:"#fdf0ee",color:"#c0392b",padding:"2px 6px",borderRadius:4,fontWeight:700}}>OVERDUE</span>}
              {cb.status==="done"&&<span style={{fontSize:9,background:"#f5f5f5",color:"#aaa",padding:"2px 6px",borderRadius:4,fontWeight:700}}>DONE</span>}
              {cb.status==="no_answer"&&<span style={{fontSize:9,background:"#fff8ee",color:"#b85c00",padding:"2px 6px",borderRadius:4,fontWeight:700}}>NO ANSWER</span>}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:5,marginTop:4}}>
              <span style={{fontSize:13,color:"#1a5c35",fontWeight:600}}>📞 {cb.phone}</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,marginTop:3,flexWrap:"wrap"}}>
              <span style={{fontSize:12,color:overdue?"#c0392b":"#555",fontWeight:overdue?700:400}}>🗓 {dateLabel}</span>
              <span style={{fontSize:12,color:overdue?"#c0392b":"#555",fontWeight:overdue?700:400}}>🕐 {fmt12h(cb.callback_time)}</span>
            </div>
            {cb.notes&&<p style={{margin:"6px 0 0",fontSize:11,color:"#888",lineHeight:1.4}}>{cb.notes}</p>}
          </div>
          <button onClick={()=>openEdit(cb)} style={{padding:"4px 10px",borderRadius:7,border:"1.5px solid #ddd",background:"#fff",fontSize:11,color:"#888",fontWeight:600,cursor:"pointer",flexShrink:0}}>Edit</button>
        </div>
        {cb.status!=="done"&&(
          <div style={{display:"flex",gap:6,marginTop:10}}>
            {cb.status==="pending"&&<button onClick={()=>updateStatus(cb,"no_answer")} style={{flex:1,padding:"7px 0",borderRadius:8,border:"1.5px solid #f0c080",background:"#fff8ee",cursor:"pointer",fontSize:11,color:"#b85c00",fontWeight:600}}>📵 No Answer</button>}
            {cb.status==="no_answer"&&<button onClick={()=>updateStatus(cb,"pending")} style={{flex:1,padding:"7px 0",borderRadius:8,border:"1.5px solid #ddd",background:"#f9f9f9",cursor:"pointer",fontSize:11,color:"#888",fontWeight:600}}>↩ Reschedule</button>}
            <button onClick={()=>updateStatus(cb,"done")} style={{flex:1,padding:"7px 0",borderRadius:8,border:"none",background:"#1a5c35",cursor:"pointer",fontSize:11,color:"#fff",fontWeight:700}}>✅ Done</button>
            <button onClick={()=>remove(cb)} style={{padding:"7px 10px",borderRadius:8,border:"1.5px solid #f5b7b1",background:"#fdf0ee",cursor:"pointer",fontSize:11,color:"#c0392b",fontWeight:600}}>🗑</button>
          </div>
        )}
        {cb.status==="done"&&(
          <div style={{display:"flex",gap:6,marginTop:10}}>
            <button onClick={()=>updateStatus(cb,"pending")} style={{flex:1,padding:"7px 0",borderRadius:8,border:"1.5px solid #ddd",background:"#f9f9f9",cursor:"pointer",fontSize:11,color:"#888",fontWeight:600}}>↩ Reopen</button>
            <button onClick={()=>remove(cb)} style={{padding:"7px 10px",borderRadius:8,border:"1.5px solid #f5b7b1",background:"#fdf0ee",cursor:"pointer",fontSize:11,color:"#c0392b",fontWeight:600}}>🗑</button>
          </div>
        )}
      </div>
    );
  };

  const overdueCount = pending.filter(isOverdue).length;

  return (
    <div style={{paddingTop:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div>
          <p style={{margin:0,fontSize:10,letterSpacing:1.8,textTransform:"uppercase",color:"#bbb",fontWeight:700}}>📞 My Callbacks</p>
          {overdueCount>0&&<p style={{margin:"2px 0 0",fontSize:11,color:"#c0392b",fontWeight:600}}>⚠️ {overdueCount} overdue</p>}
        </div>
        <button onClick={openAdd} style={{padding:"7px 14px",borderRadius:9,border:"none",background:"#1a5c35",color:"#fff",cursor:"pointer",fontSize:12,fontWeight:700}}>+ Add Callback</button>
      </div>

      {loading&&<p style={{textAlign:"center",color:"#bbb",padding:"30px 0"}}>Loading…</p>}

      {!loading&&callbacks.length===0&&(
        <div style={{textAlign:"center",padding:"40px 0",color:"#bbb"}}>
          <p style={{fontSize:32,margin:"0 0 8px"}}>📞</p>
          <p style={{fontWeight:600,fontSize:15,color:"#888"}}>No callbacks yet</p>
          <p style={{fontSize:12,color:"#bbb",margin:"4px 0 0"}}>Add parents who need to confirm with their spouse before booking.</p>
        </div>
      )}

      {!loading&&pending.length>0&&(
        <div style={{marginBottom:16}}>
          <p style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:"#1a7a45",fontWeight:700,margin:"0 0 8px"}}>Pending ({pending.length})</p>
          {pending.sort((a,b)=>a.callback_date.localeCompare(b.callback_date)||a.callback_time.localeCompare(b.callback_time)).map(cb=><CallbackCard key={cb.id} cb={cb}/>)}
        </div>
      )}

      {!loading&&noAnswer.length>0&&(
        <div style={{marginBottom:16}}>
          <p style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:"#b85c00",fontWeight:700,margin:"0 0 8px"}}>No Answer — Reschedule ({noAnswer.length})</p>
          {noAnswer.map(cb=><CallbackCard key={cb.id} cb={cb}/>)}
        </div>
      )}

      {!loading&&done.length>0&&(
        <div style={{marginBottom:16}}>
          <p style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:"#bbb",fontWeight:700,margin:"0 0 8px"}}>Done ({done.length})</p>
          {done.map(cb=><CallbackCard key={cb.id} cb={cb}/>)}
        </div>
      )}
    </div>
  );
}

// ── ENROLMENT BOARD ───────────────────────────────────────────────────────
function EnrolmentBoard({ reps, reload, fire, currentRepId, isManager }) {
  const [saving, setSaving] = useState(false);
  const [editingEnroller, setEditingEnroller] = useState(null); // {id, name, enrol_visible_to:[]}
  const [pendingVisible, setPendingVisible] = useState([]);

  const myRep = reps.find(r => r.id === currentRepId);
  const amIEnroller = myRep?.enrol_role === "enroller";
  const enrollers = reps.filter(r => r.enrol_role === "enroller");
  const closers = reps.filter(r => r.enrol_role === "closer");
  const myEnrollers = enrollers.filter(r => (r.enrol_visible_to||[]).includes(currentRepId));

  const promoteToEnroller = async (rep) => {
    setSaving(true);
    await sbPatch("rep_status", rep.id, { enrol_role:"enroller", enrol_visible_to:[], enrol_ready:false, updated_at:new Date().toISOString() });
    await reload();
    setSaving(false);
    fire("ok", `${rep.name} is now an Enroller`);
  };

  const removeRole = async (rep) => {
    setSaving(true);
    await sbPatch("rep_status", rep.id, { enrol_role:null, enrol_visible_to:[], enrol_ready:false, updated_at:new Date().toISOString() });
    await reload();
    setSaving(false);
    fire("ok", `${rep.name} role removed`);
  };

  const openEdit = (enroller) => {
    setEditingEnroller(enroller);
    setPendingVisible(enroller.enrol_visible_to||[]);
  };

  const saveVisibility = async () => {
    setSaving(true);
    await sbPatch("rep_status", editingEnroller.id, { enrol_visible_to: pendingVisible, updated_at:new Date().toISOString() });
    await reload();
    setSaving(false);
    setEditingEnroller(null);
    fire("ok","Access updated");
  };

  const toggleReady = async () => {
    if(!myRep) return;
    setSaving(true);
    await sbPatch("rep_status", myRep.id, { enrol_ready: !myRep.enrol_ready, updated_at:new Date().toISOString() });
    await reload();
    setSaving(false);
  };

  const transferToEnroller = async (enroller) => {
    if(!enroller.enrol_ready) return;
    setSaving(true);
    await sbPatch("rep_status", enroller.id, { enrol_ready:false, updated_at:new Date().toISOString() });
    await reload();
    setSaving(false);
    fire("ok", `Transferred to ${enroller.name}`);
  };

  const s = {card:{background:"#fff",borderRadius:12,padding:"14px 16px",marginBottom:10,boxShadow:"0 1px 4px rgba(0,0,0,.07)"},label:{fontSize:11,fontWeight:700,color:"#888",textTransform:"uppercase",letterSpacing:.8,marginBottom:8},chip:(c)=>({display:"inline-block",padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,background:c==="ready"?"#e8f8f0":c==="busy"?"#fdf0f0":"#f2f2f2",color:c==="ready"?"#1a7a45":c==="busy"?"#c0392b":"#777"})};

  // ── Edit visibility screen ──────────────────────────────────────────
  if(editingEnroller) {
    const allClosers = reps.filter(r => r.enrol_role !== "enroller");
    return (
      <div style={{paddingTop:16}}>
        <button onClick={()=>setEditingEnroller(null)} style={{background:"none",border:"none",cursor:"pointer",color:"#1a5c35",fontWeight:700,fontSize:13,marginBottom:12,padding:0}}>← Back</button>
        <div style={s.card}>
          <p style={{...s.label,marginBottom:4}}>Who can see {editingEnroller.name}?</p>
          <p style={{fontSize:12,color:"#aaa",marginBottom:12}}>Select the closers who are allowed to transfer calls to this enroller.</p>
          {allClosers.map(c=>(
            <div key={c.id} onClick={()=>setPendingVisible(v=>v.includes(c.id)?v.filter(x=>x!==c.id):[...v,c.id])} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:9,marginBottom:6,cursor:"pointer",background:pendingVisible.includes(c.id)?"#e8f8f0":"#f7f7f7",border:pendingVisible.includes(c.id)?"1.5px solid #27ae60":"1.5px solid #eee"}}>
              <div style={{width:18,height:18,borderRadius:4,border:"2px solid",borderColor:pendingVisible.includes(c.id)?"#27ae60":"#ccc",background:pendingVisible.includes(c.id)?"#27ae60":"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}>
                {pendingVisible.includes(c.id)&&<span style={{color:"#fff",fontSize:11,fontWeight:900}}>✓</span>}
              </div>
              <span style={{fontSize:13,fontWeight:600,color:"#222"}}>{c.name}</span>
            </div>
          ))}
          {allClosers.length===0&&<p style={{fontSize:13,color:"#bbb",textAlign:"center",padding:"20px 0"}}>No reps assigned as closers yet.</p>}
          <button onClick={saveVisibility} disabled={saving} style={{width:"100%",marginTop:8,padding:"11px 0",borderRadius:10,border:"none",background:"#1a5c35",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",opacity:saving?.6:1}}>
            {saving?"Saving…":"Save access"}
          </button>
        </div>
      </div>
    );
  }

  // ── Manager view ───────────────────────────────────────────────────
  if(isManager) {
    const assignRole = async (rep, role) => {
      setSaving(true);
      await sbPatch("rep_status", rep.id, {
        enrol_role: role,
        enrol_visible_to: role === "enroller" ? (rep.enrol_visible_to||[]) : [],
        enrol_ready: false,
        updated_at: new Date().toISOString(),
      });
      await reload();
      setSaving(false);
      fire("ok", role ? `${rep.name} set as ${role}` : `${rep.name} role removed`);
    };

    const RoleBtn = ({rep, role, label, color}) => {
      const active = rep.enrol_role === role;
      return (
        <button
          onClick={()=>assignRole(rep, active ? null : role)}
          disabled={saving}
          style={{padding:"4px 10px",borderRadius:7,border:`1.5px solid ${active?color:"#ddd"}`,background:active?color:"#fff",color:active?"#fff":"#aaa",fontSize:11,fontWeight:700,cursor:"pointer",opacity:saving?.6:1,transition:"all .15s"}}
        >{active?"✓ ":""}{label}</button>
      );
    };

    return (
      <div style={{paddingTop:16}}>
        {/* Enrollers — with edit access */}
        {enrollers.length>0&&(
          <>
            <p style={s.label}>Enrollers ({enrollers.length})</p>
            {enrollers.map(r=>(
              <div key={r.id} style={s.card}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:34,height:34,borderRadius:"50%",background:"#1a5c35",color:"#fff",fontWeight:700,fontSize:12,display:"flex",alignItems:"center",justifyContent:"center"}}>{r.avatar||r.name.slice(0,2).toUpperCase()}</div>
                    <div>
                      <p style={{margin:0,fontSize:13,fontWeight:700}}>{r.name}</p>
                      <span style={s.chip(r.enrol_ready?"ready":"busy")}>{r.enrol_ready?"🟢 Ready":"🔴 Busy"}</span>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={()=>openEdit(r)} style={{padding:"5px 10px",borderRadius:8,border:"1.5px solid #1a5c35",background:"#fff",color:"#1a5c35",fontSize:11,fontWeight:700,cursor:"pointer"}}>Edit access</button>
                    <button onClick={()=>assignRole(r,null)} disabled={saving} style={{padding:"5px 10px",borderRadius:8,border:"1.5px solid #e74c3c",background:"#fff",color:"#e74c3c",fontSize:11,fontWeight:700,cursor:"pointer"}}>Remove</button>
                  </div>
                </div>
                {(r.enrol_visible_to||[]).length===0&&<p style={{margin:0,fontSize:11,color:"#e07b00",background:"#fff8ee",borderRadius:7,padding:"5px 10px"}}>⚠️ No closers assigned yet — hit Edit access.</p>}
                {(r.enrol_visible_to||[]).length>0&&<p style={{margin:0,fontSize:11,color:"#666"}}>Visible to: {reps.filter(x=>(r.enrol_visible_to||[]).includes(x.id)).map(x=>x.name).join(", ")}</p>}
              </div>
            ))}
          </>
        )}

        {/* All reps — assign either role */}
        <p style={{...s.label,marginTop:enrollers.length>0?18:0}}>All Reps — assign roles</p>
        {reps.map(r=>(
          <div key={r.id} style={{...s.card,display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:30,height:30,borderRadius:"50%",background:"#e8f4ee",color:"#1a5c35",fontWeight:700,fontSize:11,display:"flex",alignItems:"center",justifyContent:"center"}}>{r.avatar||r.name.slice(0,2).toUpperCase()}</div>
              <span style={{fontSize:13,fontWeight:600}}>{r.name}</span>
            </div>
            <div style={{display:"flex",gap:6}}>
              <RoleBtn rep={r} role="enroller" label="Enroller" color="#1a5c35"/>
              <RoleBtn rep={r} role="closer" label="Closer" color="#2980b9"/>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Enroller view (toggle ready) ───────────────────────────────────
  if(amIEnroller) {
    return (
      <div style={{paddingTop:16}}>
        <div style={s.card}>
          <p style={{...s.label,marginBottom:4}}>Your enrolment status</p>
          <p style={{fontSize:12,color:"#888",marginBottom:14}}>Toggle ready when you can take a transfer. Closers will see your status in real time.</p>
          <button onClick={toggleReady} disabled={saving} style={{width:"100%",padding:"13px 0",borderRadius:12,border:"none",background:myRep?.enrol_ready?"#c0392b":"#27ae60",color:"#fff",fontWeight:800,fontSize:15,cursor:"pointer",opacity:saving?.6:1}}>
            {saving?"…":myRep?.enrol_ready?"🔴 Mark as Busy":"🟢 Go Ready"}
          </button>
          <p style={{margin:"10px 0 0",textAlign:"center",fontSize:12,color:"#aaa"}}>{myRep?.enrol_ready?"Closers can see you're available and can transfer now.":"You're marked busy — closers won't transfer to you."}</p>
        </div>
      </div>
    );
  }

  // ── Closer view ────────────────────────────────────────────────────
  const readyEnrollers = myEnrollers.filter(r=>r.enrol_ready);
  return (
    <div style={{paddingTop:16}}>
      <div style={{...s.card,background:readyEnrollers.length>0?"#e8f8f0":"#fdf0f0",border:`1.5px solid ${readyEnrollers.length>0?"#27ae60":"#e74c3c"}`}}>
        <p style={{margin:0,fontSize:15,fontWeight:800,color:readyEnrollers.length>0?"#1a7a45":"#c0392b",marginBottom:2}}>
          {readyEnrollers.length>0?`✅ ${readyEnrollers.length} enroller${readyEnrollers.length>1?"s":""} ready — transfer the call now`:"🔴 No enrollers available — handle it yourself"}
        </p>
        <p style={{margin:"4px 0 0",fontSize:11,color:"#888"}}>{readyEnrollers.length>0?"Tap Transfer after the sale is locked in.":"Check back in a moment or complete the enrolment yourself."}</p>
      </div>
      {myEnrollers.map(r=>(
        <div key={r.id} style={s.card}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:36,height:36,borderRadius:"50%",background:r.enrol_ready?"#1a5c35":"#ddd",color:r.enrol_ready?"#fff":"#888",fontWeight:700,fontSize:12,display:"flex",alignItems:"center",justifyContent:"center"}}>{r.avatar||r.name.slice(0,2).toUpperCase()}</div>
              <div>
                <p style={{margin:0,fontSize:13,fontWeight:700}}>{r.name}</p>
                <span style={s.chip(r.enrol_ready?"ready":"busy")}>{r.enrol_ready?"🟢 Ready":"🔴 Busy"}</span>
              </div>
            </div>
            {r.enrol_ready&&(
              <button onClick={()=>transferToEnroller(r)} disabled={saving} style={{padding:"8px 16px",borderRadius:10,border:"none",background:"#1a5c35",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",opacity:saving?.6:1}}>
                Transfer →
              </button>
            )}
          </div>
        </div>
      ))}
      {myEnrollers.length===0&&<div style={{...s.card,textAlign:"center",color:"#bbb",fontSize:13,padding:"20px 0"}}>No enrollers have been assigned to you yet. Ask your manager to set this up.</div>}
    </div>
  );
}

export default function App() {
  const [view, setView] = useState("login");
  const [currentRep, setCurrentRep] = useState(null);
  const [data, setData] = useState({reps:[],settings:{peak_mode:false,custom_limit:null},adHoc:[],swaps:[],activeBreaks:[]});
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async()=>{
    try {
      const d = await loadAll();
      setData(d);
    } catch(e) {
      console.error("Load error:",e);
    } finally {
      setLoading(false);
    }
  },[]);

  useEffect(()=>{
    reload();
    const interval = setInterval(reload, 15000);
    return ()=>clearInterval(interval);
  },[reload]);

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
      // Centre just closed — clear everyone on break
      const onBreak = data.reps.filter(r=>["health","lunch"].includes(r.status));
      onBreak.forEach(r => sbPatch("rep_status",r.id,{status:"available",updated_at:new Date().toISOString()}).catch(()=>{}));
    } else {
      // Centre just opened — reset daily health counters
      data.reps.forEach(r => sbPatch("rep_status",r.id,{health_breaks_today:0,health_time_banked:0,last_break_returned_at:null,updated_at:new Date().toISOString()}).catch(()=>{}));
    }
  },[centreOpen]);

  if(loading) return (
    <div style={{minHeight:"100vh",background:"#f4f6f2",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12}}>
      <div style={{fontSize:40}}>🌿</div>
      <p style={{color:"#888",fontSize:14}}>Loading team data…</p>
    </div>
  );

  return (
    <>
      <style>{`@keyframes popIn{from{transform:scale(0.92);opacity:0}to{transform:scale(1);opacity:1}} *{box-sizing:border-box}`}</style>
      {view==="login"   && <LoginScreen onSelect={(role,rep)=>{if(role==="manager")setView("manager");else{setCurrentRep(rep);setView("rep");}}} reps={data.reps}/>}
      {view==="manager" && <ManagerView data={data} reload={reload} onLogout={()=>setView("login")} centreOpen={centreOpen}/>}
      {view==="rep"     && <RepView repInfo={currentRep} data={data} reload={reload} onLogout={()=>setView("login")} centreOpen={centreOpen}/>}
    </>
  );
}
