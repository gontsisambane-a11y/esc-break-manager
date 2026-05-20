import { useState, useEffect, useCallback, useRef } from "react";

// ── CONFIG ────────────────────────────────────────────────────────────
const SB_URL = "https://uektpsmcgagzxfoxavex.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVla3Rwc21jZ2Fnenhmb3hhdmV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTY0NDcsImV4cCI6MjA5MzU3MjQ0N30.eJ15qDLM2bCCR5zK1eiiKoXx_JJTsPhjuBjZdpoVWW0";
const MANAGER_PIN = "1234";
const HEALTH_MAX_SEC = 600;
const HEALTH_PER_DAY = 3;
const LUNCH_LIMIT = 3;
const H_LIMIT_NORMAL = 2;
const H_LIMIT_PEAK = 1;
const COOLDOWN_SEC = 7200;
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
  available:{ label:"On Duty",       dot:"#27ae60", bg:"#fff",    border:"#e8e8e8" },
  health:   { label:"Health Break",  dot:"#2980b9", bg:"#eaf4fd", border:"#aed6f1" },
  lunch:    { label:"Lunch Break",   dot:"#e07b00", bg:"#fff8ee", border:"#f0c080" },
  pto:      { label:"PTO",           dot:"#8e44ad", bg:"#f5eefb", border:"#d7aef0" },
  sick:     { label:"Sick Day",      dot:"#c0392b", bg:"#fdf0ee", border:"#f5b7b1" },
  off:      { label:"Scheduled Off", dot:"#bbb",    bg:"#f7f7f7", border:"#e8e8e8" },
};
const TZ_C = {
  Central:{bg:"#e8f0fe",text:"#1a4a8a"}, Eastern:{bg:"#e6f4ea",text:"#1a5c35"},
  Pacific:{bg:"#fff3e6",text:"#7a4500"}, SA:{bg:"#fce8f3",text:"#7a1a5c"},
  GMT:{bg:"#e8f4fd",text:"#0d3b6b"},     IST:{bg:"#fef9e7",text:"#7d6608"},
};

// ── UTILS ─────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().split('T')[0];
const todayDay = () => DAYS[new Date().getDay()];
const todayLabel = () => new Date().toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"});
const fmtTime = s => { if(s<=0)return"0:00"; return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`; };
const fmtDur = s => { if(!s||s<=0)return"0m"; const h=Math.floor(s/3600),m=Math.floor((s%3600)/60); return h>0?`${h}h ${m}m`:`${m}m`; };
const elapsedSec = iso => Math.floor((Date.now()-new Date(iso).getTime())/1000);
const fmt12h = t => { if(!t)return'--'; const [h,m]=t.split(':').map(Number); return `${h%12||12}:${m.toString().padStart(2,'0')}${h>=12?'pm':'am'}`; };
// UTC offsets in minutes for current period (May - CDT/EDT/PDT active)
const TZ_OFFSET = { Central:-300, Eastern:-240, Pacific:-420, SA:120, GMT:0, IST:330 };

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
  const [reps,settArr,adHoc,swaps,activeBreaks,todayPTO] = await Promise.all([
    sb("rep_status?select=*&order=id"),
    sb("app_settings?id=eq.1"),
    sb("adhoc_lunch_requests?status=eq.pending&order=created_at.desc"),
    sb("lunch_swaps?status=in.(pending)&order=created_at.desc"),
    sb("break_log?ended_at=is.null&select=*"),
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
  const today = todayStr();
  const todayPTONames = todayPTO.map(p=>p.rep_name);
  for(const r of reps) {
    if(r.updated_at && !r.updated_at.startsWith(today) && (r.health_breaks_today>0||r.health_time_banked>0)) {
      await sbPatch("rep_status",r.id,{health_breaks_today:0,health_time_banked:0,last_break_returned_at:null});
      r.health_breaks_today=0; r.health_time_banked=0; r.last_break_returned_at=null;
    }
    // auto-apply today's PTO from DB
    if(todayPTONames.includes(r.name) && r.status==="available") {
      await sbPatch("rep_status",r.id,{status:"pto",ooo_note:"PTO"});
      r.status="pto"; r.ooo_note="PTO";
    }
  }
  return { reps, settings, adHoc, swaps, activeBreaks };
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
              <div><p style={{margin:0,fontWeight:600,fontSize:14,color:"#1a1a1a"}}>{r.name}</p><p style={{margin:0,fontSize:11,color:"#aaa"}}>{r.timezone} · Breaks today: {r.health_breaks_today||0}/{HEALTH_PER_DAY}</p></div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── MANAGER VIEW ──────────────────────────────────────────────────────
function ManagerView({ data, reload, onLogout }) {
  const { reps, settings, adHoc, swaps, activeBreaks } = data;
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
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:10}}>
          {[
            {n:reps.filter(r=>r.status==="available").length,l:"Available",c:"#27ae60"},
            {n:onHealth,l:`Health (/${hLimit})`,c:onHealth>=hLimit?"#e74c3c":"#2980b9"},
            {n:onLunch,l:`Lunch (/${LUNCH_LIMIT})`,c:onLunch>=LUNCH_LIMIT?"#e74c3c":"#e07b00"},
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
        {tab==="overview"  &&<MgrOverview reps={reps} activeBreaks={activeBreaks} hLimit={hLimit} maxOut={maxOut} reload={reload} fire={fire} settings={settings}/>}
        {tab==="requests"  &&<MgrRequests adHoc={adHoc} swaps={swaps} reps={reps} reload={reload} fire={fire}/>}
        {tab==="team"      &&<MgrTeam reps={reps} settings={settings} reload={reload} fire={fire}/>}
        {tab==="schedules" &&<MgrSchedules reps={reps} reload={reload} fire={fire}/>}
        {tab==="reports"   &&<MgrReports reps={reps}/>}
        {tab==="settings"  &&<MgrSettings settings={settings} reps={reps} reload={reload} fire={fire}/>}
        {tab==="pto"       &&<MgrPTO reps={reps} reload={reload} fire={fire}/> }
      </div>
    </div>
  );
}

// ── MGR: OVERVIEW ─────────────────────────────────────────────────────
function MgrOverview({ reps, activeBreaks, hLimit, maxOut, reload, fire, settings }) {
  const [oooModal, setOooModal] = useState(null);
  const [peakOverride, setPeakOverride] = useState({});

  const handleReturn = async (rep) => {
    const ab = activeBreaks.find(b=>b.rep_id===rep.id);
    const durSec = ab ? elapsedSec(ab.started_at) : 0;
    const newBanked = (rep.health_time_banked||0) + durSec;
    const updates = { status:"available", updated_at: new Date().toISOString() };
    if(rep.status==="health") {
      updates.health_time_banked = newBanked;
      if(newBanked >= HEALTH_MAX_SEC) updates.last_break_returned_at = new Date().toISOString();
      if(rep.health_breaks_today>=HEALTH_PER_DAY) fire("warn",`⚠️ ${rep.name} has used all ${HEALTH_PER_DAY} health breaks today`);
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

  const handleOverridePeak = async (rep) => {
    setPeakOverride(p=>({...p,[rep.id]:!p[rep.id]}));
    fire("info",`Peak limit ${peakOverride[rep.id]?"restored":"overridden"} for ${rep.name}`);
  };

  const onBreak = reps.filter(r=>r.status==="health"||r.status==="lunch");
  const available = reps.filter(r=>r.status==="available");
  const out = reps.filter(r=>["pto","sick","off"].includes(r.status));

  function RepRow({rep}) {
    const cfg=ST[rep.status]||ST.available;
    const isBreak=rep.status==="health"||rep.status==="lunch";
    const isOOO=rep.status==="pto"||rep.status==="sick";
    const isOff=rep.status==="off";
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
      {onBreak.length>0&&<Section title="🌿🥗 On Break" items={onBreak} Row={RepRow} color="#2980b9"/>}
      <Section title="✅ Available" items={available} Row={RepRow} color="#1a5c35"/>
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
            <div key={r.id} style={{background:"#fff8ee",border:"1.5px solid #f0c080",borderRadius:12,padding:"12px 14px",marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
                <div>
                  <p style={{margin:0,fontWeight:600,fontSize:14}}>{r.rep_name}</p>
                  <p style={{margin:"2px 0 0",fontSize:12,color:"#888"}}>Requested: {r.requested_time}</p>
                  {r.approved_for&&<p style={{margin:"2px 0 0",fontSize:11,color:"#aaa"}}>Requested for: {r.approved_for}</p>}
                </div>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={()=>handleAdHoc(r,false)} style={{padding:"6px 12px",borderRadius:8,border:"1.5px solid #f5b7b1",background:"#fdf0ee",cursor:"pointer",fontSize:12,color:"#c0392b",fontWeight:600}}>Decline</button>
                  <button onClick={()=>handleAdHoc(r,true)} style={{padding:"6px 12px",borderRadius:8,border:"none",background:"#1a5c35",cursor:"pointer",fontSize:12,color:"#fff",fontWeight:600}}>Approve</button>
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
          <p style={{fontSize:13,color:"#888",marginBottom:14}}>This will permanently remove {deleteModal.name} and all their break history. Type their name to confirm.</p>
          <input value={deleteConfirm} onChange={e=>setDeleteConfirm(e.target.value)} placeholder={deleteModal.name} style={{width:"100%",padding:"10px 12px",borderRadius:9,border:"1.5px solid #ddd",fontSize:13,marginBottom:14,outline:"none"}}/>
          <div style={{display:"flex",gap:8}}>
            <Btn label="Cancel" onClick={()=>{setDeleteModal(null);setDeleteConfirm("");}} outline color="#888" small/>
            <Btn label="Delete Permanently" onClick={handleDelete} color="#e74c3c"/>
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
        const cooldownActive = (rep.health_time_banked||0)>=HEALTH_MAX_SEC && rep.last_break_returned_at && elapsedSec(rep.last_break_returned_at)<COOLDOWN_SEC;
        const cooldownLeft = cooldownActive ? COOLDOWN_SEC - elapsedSec(rep.last_break_returned_at) : 0;
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
                </div>
                <div style={{display:"flex",gap:10,marginTop:3,flexWrap:"wrap"}}>
                  <span style={{fontSize:10,color:"#aaa"}}>🌿 {rep.health_breaks_today||0}/{HEALTH_PER_DAY} today</span>
                  {cooldownActive&&<span style={{fontSize:10,color:"#e07b00"}}>⏳ Cooldown: {fmtTime(cooldownLeft)}</span>}
                  {(rep.health_time_banked||0)>0&&<span style={{fontSize:10,color:"#888"}}>Banked: {fmtDur(rep.health_time_banked)}</span>}
                </div>
              </div>
              <div style={{display:"flex",gap:5,flexShrink:0}}>
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
          <Btn label="Add Rep" onClick={()=>{if(!form.name.trim()){return;}onAdd({...form,avatar:avatar(form.name),id:Date.now()});}}/>
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
function RepView({ repInfo, data, reload, onLogout }) {
  const { reps, settings, swaps, activeBreaks } = data;
  const [tab, setTab] = useState("my");
  const [toast, setToast] = useState(null);
  const fire = (type,msg) => setToast({type,msg,id:Date.now()});

  const myRep = reps.find(r=>r.id===repInfo.id)||{...repInfo,status:"available",health_breaks_today:0,health_time_banked:0};
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
  const cooldownActive = (myRep.health_time_banked||0)>=HEALTH_MAX_SEC && myRep.last_break_returned_at && elapsedSec(myRep.last_break_returned_at)<COOLDOWN_SEC;
  const cooldownLeft = cooldownActive ? COOLDOWN_SEC - elapsedSec(myRep.last_break_returned_at||new Date().toISOString()) : 0;
  const breaksLeft = HEALTH_PER_DAY - (myRep.health_breaks_today||0);

  const canTakeHealth = healthLeft>0 && capLeft>0 && !cooldownActive && breaksLeft>0 && myRep.status==="available";
  const canTakeLunch = lunchLeft>0 && capLeft>0 && myRep.status==="available";

  const startBreak = async (type) => {
    if(capLeft<=0){fire("declined","Team cap reached — all break slots full");return;}
    if(type==="health"){
      if(healthLeft<=0){fire("declined","Health break slots full");return;}
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
    const updates = {status:type,updated_at:new Date().toISOString()};
    if(type==="health") updates.health_breaks_today=(myRep.health_breaks_today||0)+1;
    await sbPatch("rep_status",repInfo.id,updates);
    await sbPost("break_log",{rep_id:repInfo.id,rep_name:repInfo.name,break_type:type});
    fire("approved",`Enjoy your ${type==="lunch"?"lunch 🥗":"health break 🌿"}!`);
    reload();
  };

  const returnFromBreak = async () => {
    const ab = activeBreaks.find(b=>b.rep_id===repInfo.id);
    const durSec = ab ? elapsedSec(ab.started_at) : 0;
    const newBanked = myRep.status==="health" ? (myRep.health_time_banked||0)+durSec : myRep.health_time_banked||0;
    const updates = {status:"available",updated_at:new Date().toISOString()};
    if(myRep.status==="health") {
      updates.health_time_banked = newBanked;
      if(newBanked>=HEALTH_MAX_SEC) updates.last_break_returned_at = new Date().toISOString();
      if(myRep.health_breaks_today>=HEALTH_PER_DAY) fire("warn","You've used all 3 health breaks for today");
    }
    if(ab) await sb(`break_log?id=eq.${ab.id}`,{method:"PATCH",body:JSON.stringify({ended_at:new Date().toISOString(),duration_seconds:durSec})});
    await sbPatch("rep_status",repInfo.id,updates);
    fire("approved","Welcome back! You're on duty 🎉");
    reload();
  };

  const requestAdHocLunch = async () => {
    await sbPost("adhoc_lunch_requests",{rep_id:repInfo.id,rep_name:repInfo.name,requested_time:new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})});
    fire("info","Ad hoc lunch request sent to manager 📩");
    reload();
  };

  return (
    <div style={{fontFamily:"'Segoe UI',system-ui,sans-serif",minHeight:"100vh",background:"#f4f6f2",paddingBottom:60}}>
      <style>{`@keyframes popIn{from{transform:scale(0.92);opacity:0}to{transform:scale(1);opacity:1}} *{box-sizing:border-box}`}</style>
      {toast&&<Toast key={toast.id} msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}

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
            {icon:"🌿",label:"Health",avail:healthLeft,total:hLimit,color:"#2980b9",extra:`${breaksLeft} left today`},
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
          {[{k:"my",l:"My Break"},{k:"team",l:"Team"},{k:"swaps",l:`Swaps${mySwaps.length>0?` (${mySwaps.length})`:""}`}].map(t=>(
            <button key={t.k} onClick={()=>setTab(t.k)} style={{padding:"11px 14px",border:"none",background:"none",cursor:"pointer",fontSize:13,fontWeight:tab===t.k?700:500,color:tab===t.k?"#1a5c35":mySwaps.length>0&&t.k==="swaps"?"#e07b00":"#999",borderBottom:tab===t.k?"2.5px solid #1a5c35":"2.5px solid transparent",marginBottom:-1.5,transition:"all .15s"}}>{t.l}</button>
          ))}
        </div>
      </div>

      <div style={{padding:"16px 16px",maxWidth:480,margin:"0 auto"}}>
        {tab==="my"&&(
          <RepMyBreak myRep={myRep} myAB={myAB} canTakeHealth={canTakeHealth} canTakeLunch={canTakeLunch} cooldownActive={cooldownActive} cooldownLeft={cooldownLeft} breaksLeft={breaksLeft} startBreak={startBreak} returnFromBreak={returnFromBreak} requestAdHocLunch={requestAdHocLunch} repInfo={repInfo}/>
        )}
        {tab==="team"&&<RepTeam reps={reps} myId={repInfo.id} activeBreaks={activeBreaks}/>}
        {tab==="swaps"&&<RepSwaps myRep={myRep} reps={reps} swaps={swaps} reload={reload} fire={fire} repInfo={repInfo}/>}
      </div>
    </div>
  );
}

function RepMyBreak({ myRep, myAB, canTakeHealth, canTakeLunch, cooldownActive, cooldownLeft, breaksLeft, startBreak, returnFromBreak, requestAdHocLunch, repInfo }) {
  const [showBreakModal, setShowBreakModal] = useState(false);
  const cfg = ST[myRep.status]||ST.available;
  const onBreak = myRep.status==="health"||myRep.status==="lunch";
  const isOOO = myRep.status==="pto"||myRep.status==="sick";
  const isOff = myRep.status==="off";

  return (
    <div>
      {showBreakModal&&(
        <Modal title="Request Break" sub="BREAK REQUEST" onClose={()=>setShowBreakModal(false)}>
          <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
            {[
              {key:"health",icon:"🌿",label:"Health Break",dur:"10 min",avail:canTakeHealth,reason:!canTakeHealth?(cooldownActive?`Cooldown: ${fmtTime(cooldownLeft)}`:`${breaksLeft===0?"No breaks left":"Slots full"}`):null},
              {key:"lunch",icon:"🥗",label:"Lunch Break",dur:"Per schedule",avail:canTakeLunch,reason:!canTakeLunch?"Slots full":null},
            ].map(o=>(
              <div key={o.key} onClick={()=>o.avail&&(startBreak(o.key),setShowBreakModal(false))} style={{border:o.avail?"1.5px solid #ddd":"1.5px solid #f0f0f0",borderRadius:12,padding:"12px 14px",cursor:o.avail?"pointer":"not-allowed",background:o.avail?"#fff":"#f7f7f7",opacity:o.avail?1:0.6}}>
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
              <span style={{fontSize:11,color:"#888"}}>🌿 Today: {myRep.health_breaks_today||0}/{HEALTH_PER_DAY} health breaks</span>
              {cooldownActive&&<span style={{fontSize:11,color:"#e07b00",fontWeight:600}}>⏳ Cooldown: {fmtTime(cooldownLeft)}</span>}
            </div>
            {onBreak?(
              <button onClick={returnFromBreak} style={{width:"100%",padding:"13px",borderRadius:12,border:"none",background:"#1a5c35",color:"#fff",cursor:"pointer",fontSize:15,fontWeight:700}}>I'm back! 👋</button>
            ):(
              <button onClick={()=>setShowBreakModal(true)} style={{width:"100%",padding:"13px",borderRadius:12,border:"none",background:"#1a5c35",color:"#fff",cursor:"pointer",fontSize:15,fontWeight:700}}>Request a Break 🌿</button>
            )}
          </div>
        )}
        {isOOO&&<p style={{margin:"12px 0 0",fontSize:13,color:"#888",textAlign:"center"}}>You're marked as out today. See your manager to update.</p>}
        {isOff&&<p style={{margin:"12px 0 0",fontSize:13,color:"#bbb",textAlign:"center"}}>Today is your scheduled day off. Enjoy! 🎉</p>}
      </div>
    </div>
  );
}

function RepTeam({ reps, myId, activeBreaks }) {
  return (
    <div>
      <p style={{fontSize:10,letterSpacing:1.8,textTransform:"uppercase",color:"#bbb",margin:"0 0 10px",fontWeight:700}}>Team Balances</p>
      <div style={{display:"flex",flexDirection:"column",gap:7}}>
        {reps.map(rep=>{
          const cfg=ST[rep.status]||ST.available;
          const ab=activeBreaks.find(b=>b.rep_id===rep.id&&rep.status==="health");
          const cooldownActive=(rep.health_time_banked||0)>=HEALTH_MAX_SEC&&rep.last_break_returned_at&&elapsedSec(rep.last_break_returned_at)<COOLDOWN_SEC;
          const cooldownLeft=cooldownActive?COOLDOWN_SEC-elapsedSec(rep.last_break_returned_at||new Date().toISOString()):0;
          const isMe=rep.id===myId;
          return (
            <div key={rep.id} style={{background:cfg.bg,border:`1.5px solid ${cfg.border}`,borderRadius:12,padding:"10px 13px"}}>
              <div style={{display:"flex",alignItems:"center",gap:9}}>
                <div style={{width:32,height:32,borderRadius:"50%",background:isMe?"#1a5c35":"#eafaf1",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:isMe?"#fff":"#1a5c35",flexShrink:0}}>{rep.avatar||avatar(rep.name)}</div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:5}}>
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
        })}
      </div>
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
      {view==="manager" && <ManagerView data={data} reload={reload} onLogout={()=>setView("login")}/>}
      {view==="rep"     && <RepView repInfo={currentRep} data={data} reload={reload} onLogout={()=>setView("login")}/>}
    </>
  );
}
