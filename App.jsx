import { useState, useEffect, useCallback } from "react";

const SUPABASE_URL = "https://uektpsmcgagzxfoxavex.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVla3Rwc21jZ2Fnenhmb3hhdmV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTY0NDcsImV4cCI6MjA5MzU3MjQ0N30.eJ15qDLM2bCCR5zK1eiiKoXx_JJTsPhjuBjZdpoVWW0";

const TODAY = new Date(2026, 4, 15);
const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const TODAY_DAY = DAY_NAMES[TODAY.getDay()];
const TODAY_LABEL = TODAY.toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"});
const LUNCH_LIMIT = 3;
const HEALTH_LIMIT = 2;
const MANAGER_PIN = "1234";

const REPS_DATA = [
  { id:1,  name:"Amanda",   avatar:"AM", tz:"Central", lunch:"12:30pm Sat (30 min)",                                    offDays:["Thu","Sun"] },
  { id:2,  name:"Andrea",   avatar:"AN", tz:"Central", lunch:"12pm Mon/Tue (1 hr) · 1pm Wed/Thu/Fri (1 hr)",           offDays:["Sat","Sun"] },
  { id:3,  name:"Darryl",   avatar:"DA", tz:"Eastern", lunch:"3pm Mon–Fri (1 hr)",                                     offDays:["Sat","Sun"] },
  { id:4,  name:"Deonte",   avatar:"DE", tz:"Central", lunch:"2pm Mon–Fri (1 hr)",                                     offDays:["Sat","Sun"] },
  { id:5,  name:"Heather",  avatar:"HE", tz:"Central", lunch:"11am Mon (1 hr) · 12pm Wed (1 hr)",                      offDays:["Tue","Fri","Sun"] },
  { id:6,  name:"Jordan",   avatar:"JO", tz:"Central", lunch:"1pm Mon/Tue/Fri (1 hr) · 1pm Sat (30 min) · 1:30pm Sun (30 min)", offDays:["Wed","Thu"] },
  { id:7,  name:"Kelly",    avatar:"KE", tz:"Pacific", lunch:"12pm Mon–Thu (1 hr) · 1pm Fri (1 hr)",                  offDays:["Sat","Sun"] },
  { id:8,  name:"Leah",     avatar:"LE", tz:"Central", lunch:"1pm Mon/Tue/Wed (1 hr) · 2pm Thu (1 hr) · 1pm Sun (30 min)", offDays:["Fri","Sat"] },
  { id:9,  name:"Lungile",  avatar:"LU", tz:"SA",      lunch:"6pm Thu–Mon (1 hr)",                                    offDays:["Tue","Wed"] },
  { id:10, name:"Marcel",   avatar:"MA", tz:"SA",      lunch:"10pm Mon (30 min) · 9pm Tue (30 min) · 10pm Wed (30 min)", offDays:["Sat","Sun"] },
  { id:11, name:"Rebecca",  avatar:"RE", tz:"Eastern", lunch:"1pm Mon/Tue/Thu/Fri (1 hr) · 2pm Wed (1 hr)",           offDays:["Sat","Sun"] },
  { id:12, name:"Likhona",  avatar:"LI", tz:"SA",      lunch:"7pm Sat/Sun/Mon/Tue/Wed (1 hr)",                        offDays:["Thu","Fri"] },
  { id:13, name:"Shadrack", avatar:"SH", tz:"SA",      lunch:"8pm Fri/Sat/Sun/Mon/Tue (1 hr)",                        offDays:["Wed","Thu"] },
  { id:14, name:"Mike",     avatar:"MI", tz:"Central", lunch:"1pm Mon–Fri (1 hr)",                                    offDays:["Sat","Sun"] },
  { id:15, name:"Rickey",   avatar:"RI", tz:"Eastern", lunch:"4pm Mon–Fri (1 hr)",                                    offDays:["Sat","Sun"] },
  { id:16, name:"Mpho",     avatar:"MP", tz:"SA",      lunch:"8pm Fri/Sat/Sun/Mon/Tue (1 hr)",                        offDays:["Wed","Thu"] },
  { id:17, name:"Mbali",    avatar:"MB", tz:"SA",      lunch:"8pm Mon–Fri (1 hr)",                                    offDays:["Sat","Sun"] },
  { id:18, name:"Pamela",   avatar:"PA", tz:"Eastern", lunch:"5:30pm Mon–Fri (30 min)",                               offDays:["Sat","Sun"] },
];

const PTO_DATA = {
  "2026-4-8":["Andrea"],"2026-4-9":["Andrea"],"2026-4-10":["Andrea","Amanda"],"2026-4-11":["Amanda"],
  "2026-4-16":["Marcel"],"2026-4-17":["Marcel"],
  "2026-4-23":["Andrea"],"2026-4-24":["Andrea"],"2026-4-27":["Andrea"],"2026-4-28":["Jordan"],
  "2026-5-9":["Amanda"],"2026-5-11":["Amanda"],
  "2026-5-16":["Heather"],"2026-5-17":["Heather"],
  "2026-5-18":["Heather","Kelly","Mike","Darryl"],
  "2026-5-19":["Heather","Kelly"],
  "2026-5-20":["Heather","Kelly"],
  "2026-5-21":["Heather"],
  "2026-5-22":["Heather","Rebecca"],
  "2026-5-23":["Heather"],
  "2026-5-25":["Rebecca"],"2026-5-26":["Rebecca"],
  "2026-6-8":["Amanda"],"2026-6-9":["Amanda"],"2026-6-10":["Amanda"],
};

const TZ_C = { Central:{bg:"#e8f0fe",text:"#1a4a8a"}, Eastern:{bg:"#e6f4ea",text:"#1a5c35"}, Pacific:{bg:"#fff3e6",text:"#7a4500"}, SA:{bg:"#fce8f3",text:"#7a1a5c"} };
const ST = {
  available:{ label:"On Duty",       dot:"#27ae60", bg:"#fff",    border:"#e8e8e8" },
  health:   { label:"Health Break",  dot:"#2980b9", bg:"#eaf4fd", border:"#aed6f1" },
  lunch:    { label:"Lunch Break",   dot:"#e07b00", bg:"#fff8ee", border:"#f0c080" },
  pto:      { label:"PTO",           dot:"#8e44ad", bg:"#f5eefb", border:"#d7aef0" },
  sick:     { label:"Sick Day",      dot:"#c0392b", bg:"#fdf0ee", border:"#f5b7b1" },
  off:      { label:"Scheduled Off", dot:"#bbb",    bg:"#f7f7f7", border:"#e8e8e8" },
};

function todayKey() { return `${TODAY.getFullYear()}-${TODAY.getMonth()+1}-${TODAY.getDate()}`; }

// ── Supabase helpers ──────────────────────────────────────────────────
async function sbFetch(path, options={}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
      ...(options.headers||{}),
    },
  });
  if(!res.ok) { const e = await res.text(); throw new Error(e); }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

async function loadStatuses() {
  return sbFetch("rep_status?select=id,name,status,ooo_note&order=id");
}

async function updateStatus(id, status, oooNote="") {
  return sbFetch(`rep_status?id=eq.${id}`, {
    method:"PATCH",
    body: JSON.stringify({ status, ooo_note: oooNote, updated_at: new Date().toISOString() }),
  });
}

async function logBreakStart(repId, repName, breakType) {
  return sbFetch("break_log", {
    method:"POST",
    body: JSON.stringify({ rep_id: repId, rep_name: repName, break_type: breakType }),
  });
}

async function logBreakEnd(repId) {
  const logs = await sbFetch(`break_log?rep_id=eq.${repId}&ended_at=is.null&order=started_at.desc&limit=1`);
  if(logs && logs.length > 0) {
    await sbFetch(`break_log?id=eq.${logs[0].id}`, {
      method:"PATCH",
      body: JSON.stringify({ ended_at: new Date().toISOString() }),
    });
  }
}

function mergeWithLocal(dbRows) {
  const todayPTO = PTO_DATA[todayKey()]||[];
  return REPS_DATA.map(rep => {
    const row = dbRows.find(r => r.id === rep.id);
    const dbStatus = row?.status || "available";
    const dbNote = row?.ooo_note || "";
    const defaultStatus = rep.offDays.includes(TODAY_DAY) ? "off"
                        : todayPTO.includes(rep.name) ? "pto"
                        : "available";
    return {
      ...rep,
      oooNote: dbNote,
      status: dbStatus === "available" ? defaultStatus : dbStatus,
    };
  });
}

// ── Shared components ─────────────────────────────────────────────────
function Toast({ msg, type, onDone }) {
  useState(()=>{ const t=setTimeout(onDone,3200); return ()=>clearTimeout(t); });
  const bg={approved:"#1a5c35",declined:"#7a1a1a",info:"#1565a8",ooo:"#7a1a5c"};
  const ic={approved:"✅",declined:"🚫",info:"ℹ️",ooo:"📅"};
  return (
    <div style={{position:"fixed",bottom:28,left:"50%",transform:"translateX(-50%)",background:bg[type],color:"#fff",padding:"11px 22px",borderRadius:12,fontSize:13,fontWeight:500,zIndex:9999,display:"flex",alignItems:"center",gap:10,whiteSpace:"nowrap",boxShadow:"0 4px 24px rgba(0,0,0,0.2)",animation:"popIn .25s ease"}}>
      <span>{ic[type]}</span>{msg}
    </div>
  );
}

function BreakModal({ rep, onClose, onConfirm, lunchLeft, healthLeft }) {
  const [sel,setSel]=useState(null);
  const opts=[
    {key:"health",icon:"🌿",label:"Health Break",dur:"15 min",avail:healthLeft>0},
    {key:"lunch", icon:"🥗",label:"Lunch Break", dur:rep.lunch, avail:lunchLeft>0},
  ];
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.38)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9000}} onClick={onClose}>
      <div style={{background:"#fffdf8",borderRadius:20,padding:"28px 24px",width:320,animation:"popIn .22s ease"}} onClick={e=>e.stopPropagation()}>
        <p style={{margin:"0 0 2px",fontSize:11,color:"#aaa",letterSpacing:1}}>BREAK REQUEST</p>
        <h2 style={{margin:"0 0 18px",fontSize:20,fontWeight:700,color:"#1a1a1a"}}>{rep.name}</h2>
        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
          {opts.map(o=>(
            <div key={o.key} onClick={()=>o.avail&&setSel(o.key)} style={{border:sel===o.key?"2px solid #1a5c35":`1.5px solid ${o.avail?"#ddd":"#f0f0f0"}`,borderRadius:12,padding:"12px 14px",cursor:o.avail?"pointer":"not-allowed",background:!o.avail?"#f7f7f7":sel===o.key?"#f0faf4":"#fff",opacity:o.avail?1:0.6}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:24}}>{o.icon}</span>
                <div style={{flex:1}}>
                  <p style={{margin:0,fontWeight:600,fontSize:14,color:o.avail?"#1a1a1a":"#aaa"}}>{o.label}</p>
                  <p style={{margin:0,fontSize:11,color:"#aaa"}}>{o.dur}</p>
                </div>
                {!o.avail&&<span style={{fontSize:10,background:"#fde8e8",color:"#c0392b",padding:"3px 8px",borderRadius:6,fontWeight:700}}>FULL</span>}
                {sel===o.key&&<span style={{color:"#1a5c35",fontSize:18}}>✓</span>}
              </div>
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={onClose} style={{flex:1,padding:"10px 0",borderRadius:9,border:"1.5px solid #ddd",background:"#fff",cursor:"pointer",fontSize:13,color:"#666",fontWeight:500}}>Cancel</button>
          <button disabled={!sel} onClick={()=>sel&&onConfirm(sel)} style={{flex:2,padding:"10px 0",borderRadius:9,border:"none",background:sel?"#1a5c35":"#ccc",cursor:sel?"pointer":"not-allowed",fontSize:14,color:"#fff",fontWeight:700}}>Start Break 🌿</button>
        </div>
      </div>
    </div>
  );
}

function OOOModal({ rep, onClose, onMark }) {
  const [type,setType]=useState("pto");
  const [note,setNote]=useState("");
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.38)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9000}} onClick={onClose}>
      <div style={{background:"#fffdf8",borderRadius:20,padding:"28px 24px",width:320,animation:"popIn .22s ease"}} onClick={e=>e.stopPropagation()}>
        <p style={{margin:"0 0 2px",fontSize:11,color:"#aaa",letterSpacing:1}}>MARK ABSENCE</p>
        <h2 style={{margin:"0 0 18px",fontSize:20,fontWeight:700,color:"#1a1a1a"}}>{rep.name}</h2>
        <div style={{display:"flex",gap:8,marginBottom:14}}>
          {[{k:"pto",l:"PTO ✈️"},{k:"sick",l:"Sick 🤒"}].map(o=>(
            <div key={o.k} onClick={()=>setType(o.k)} style={{flex:1,padding:"11px 0",textAlign:"center",border:type===o.k?"2px solid #8e44ad":"1.5px solid #ddd",borderRadius:12,cursor:"pointer",background:type===o.k?"#f5eefb":"#fff",fontWeight:600,fontSize:13,color:type===o.k?"#7a1a5c":"#555"}}>
              {o.l}
            </div>
          ))}
        </div>
        <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Note (e.g. back Monday)" style={{width:"100%",boxSizing:"border-box",padding:"10px 12px",borderRadius:9,border:"1.5px solid #ddd",fontSize:13,marginBottom:16,background:"#fafafa",outline:"none"}}/>
        <div style={{display:"flex",gap:8}}>
          <button onClick={onClose} style={{flex:1,padding:"10px 0",borderRadius:9,border:"1.5px solid #ddd",background:"#fff",cursor:"pointer",fontSize:13,color:"#666",fontWeight:500}}>Cancel</button>
          <button onClick={()=>onMark(type,note)} style={{flex:2,padding:"10px 0",borderRadius:9,border:"none",background:"#8e44ad",cursor:"pointer",fontSize:14,color:"#fff",fontWeight:700}}>Mark Absence</button>
        </div>
      </div>
    </div>
  );
}

function LoginScreen({ onSelect }) {
  const [mode,setMode]=useState("choose");
  const [pin,setPin]=useState("");
  const [pinErr,setPinErr]=useState(false);
  const [repSearch,setRepSearch]=useState("");
  const filteredReps=REPS_DATA.filter(r=>r.name.toLowerCase().includes(repSearch.toLowerCase()));

  if(mode==="choose") return (
    <div style={{minHeight:"100vh",background:"#f4f6f2",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{marginBottom:28,textAlign:"center"}}>
        <div style={{fontSize:48,marginBottom:8}}>🌿</div>
        <h1 style={{margin:"0 0 6px",fontSize:26,fontWeight:800,color:"#1a1a1a"}}>ESC Break Manager</h1>
        <p style={{margin:0,fontSize:14,color:"#888"}}>{TODAY_LABEL}</p>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:12,width:"100%",maxWidth:320}}>
        <button onClick={()=>setMode("manager-pin")} style={{padding:"18px 24px",borderRadius:16,border:"2px solid #1a5c35",background:"#1a5c35",color:"#fff",cursor:"pointer",fontSize:16,fontWeight:700,display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:28}}>🎛️</span>
          <div style={{textAlign:"left"}}>
            <p style={{margin:0,fontSize:15,fontWeight:700}}>Manager View</p>
            <p style={{margin:0,fontSize:12,opacity:0.75}}>Full team oversight & controls</p>
          </div>
        </button>
        <button onClick={()=>setMode("rep-select")} style={{padding:"18px 24px",borderRadius:16,border:"2px solid #e8e8e8",background:"#fff",color:"#1a1a1a",cursor:"pointer",fontSize:16,fontWeight:700,display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:28}}>👤</span>
          <div style={{textAlign:"left"}}>
            <p style={{margin:0,fontSize:15,fontWeight:700}}>Rep View</p>
            <p style={{margin:0,fontSize:12,color:"#999"}}>Request your break</p>
          </div>
        </button>
      </div>
    </div>
  );

  if(mode==="manager-pin") return (
    <div style={{minHeight:"100vh",background:"#f4f6f2",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"#fff",borderRadius:20,padding:"32px 28px",width:"100%",maxWidth:320,boxShadow:"0 4px 24px rgba(0,0,0,0.08)"}}>
        <button onClick={()=>{setMode("choose");setPin("");setPinErr(false);}} style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:"#888",marginBottom:20,padding:0,display:"flex",alignItems:"center",gap:4}}>← Back</button>
        <div style={{fontSize:36,marginBottom:12,textAlign:"center"}}>🔐</div>
        <h2 style={{margin:"0 0 6px",fontSize:18,fontWeight:700,textAlign:"center",color:"#1a1a1a"}}>Manager PIN</h2>
        <p style={{margin:"0 0 20px",fontSize:13,color:"#aaa",textAlign:"center"}}>Enter your 4-digit PIN</p>
        <input type="password" maxLength={4} value={pin} onChange={e=>{setPin(e.target.value);setPinErr(false);}} onKeyDown={e=>{if(e.key==="Enter"){if(pin===MANAGER_PIN){onSelect("manager");}else{setPinErr(true);setPin("");}}}} placeholder="• • • •" style={{width:"100%",boxSizing:"border-box",padding:"14px",borderRadius:12,border:`1.5px solid ${pinErr?"#e74c3c":"#ddd"}`,fontSize:22,textAlign:"center",letterSpacing:8,outline:"none",marginBottom:8,background:"#fafafa"}} autoFocus/>
        {pinErr&&<p style={{margin:"0 0 12px",fontSize:12,color:"#e74c3c",textAlign:"center"}}>Incorrect PIN. Try again.</p>}
        <button onClick={()=>{if(pin===MANAGER_PIN){onSelect("manager");}else{setPinErr(true);setPin("");}}} style={{width:"100%",padding:"13px",borderRadius:12,border:"none",background:"#1a5c35",color:"#fff",cursor:"pointer",fontSize:15,fontWeight:700,marginTop:4}}>Sign In</button>
        <p style={{margin:"14px 0 0",fontSize:11,color:"#ccc",textAlign:"center"}}>Demo PIN: 1234</p>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:"#f4f6f2",display:"flex",flexDirection:"column",alignItems:"center",padding:24,paddingTop:40}}>
      <div style={{width:"100%",maxWidth:400}}>
        <button onClick={()=>setMode("choose")} style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:"#888",marginBottom:20,padding:0,display:"flex",alignItems:"center",gap:4}}>← Back</button>
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{fontSize:36,marginBottom:8}}>👤</div>
          <h2 style={{margin:"0 0 4px",fontSize:20,fontWeight:700,color:"#1a1a1a"}}>Who are you?</h2>
          <p style={{margin:0,fontSize:13,color:"#aaa"}}>Select your name to continue</p>
        </div>
        <input value={repSearch} onChange={e=>setRepSearch(e.target.value)} placeholder="Search your name…" style={{width:"100%",boxSizing:"border-box",padding:"11px 14px",borderRadius:12,border:"1.5px solid #ddd",fontSize:14,marginBottom:12,background:"#fff",outline:"none"}}/>
        <div style={{display:"flex",flexDirection:"column",gap:7}}>
          {filteredReps.map(r=>(
            <button key={r.id} onClick={()=>onSelect("rep",r)} style={{padding:"13px 16px",borderRadius:12,border:"1.5px solid #e8e8e8",background:"#fff",cursor:"pointer",display:"flex",alignItems:"center",gap:12,textAlign:"left"}}>
              <div style={{width:36,height:36,borderRadius:"50%",background:"#eafaf1",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#1a5c35",flexShrink:0}}>{r.avatar}</div>
              <div>
                <p style={{margin:0,fontWeight:600,fontSize:14,color:"#1a1a1a"}}>{r.name}</p>
                <p style={{margin:0,fontSize:11,color:"#aaa"}}>{r.tz} · Lunch: {r.lunch}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ManagerView({ reps, setReps, onLogout, loading }) {
  const [breakModal,setBreakModal]=useState(null);
  const [oooModal,setOooModal]=useState(null);
  const [toast,setToast]=useState(null);
  const [tab,setTab]=useState("active");
  const [search,setSearch]=useState("");

  const onLunch=reps.filter(r=>r.status==="lunch").length;
  const onHealth=reps.filter(r=>r.status==="health").length;
  const oooCount=reps.filter(r=>r.status==="pto"||r.status==="sick").length;
  const offCount=reps.filter(r=>r.status==="off").length;
  const active=reps.filter(r=>!["off","pto","sick"].includes(r.status));
  const out=reps.filter(r=>["off","pto","sick"].includes(r.status));
  const fire=(type,msg)=>setToast({type,msg,id:Date.now()});

  const handleConfirm=async(breakType)=>{
    const left=breakType==="lunch"?LUNCH_LIMIT-onLunch:HEALTH_LIMIT-onHealth;
    if(left<=0){fire("declined",`${breakType==="lunch"?"Lunch":"Health break"} slots are full.`);setBreakModal(null);return;}
    await updateStatus(breakModal.id, breakType);
    await logBreakStart(breakModal.id, breakModal.name, breakType);
    setReps(p=>p.map(r=>r.id===breakModal.id?{...r,status:breakType}:r));
    fire("approved",`${breakModal.name} started a ${breakType==="lunch"?"lunch 🥗":"health 🌿"} break.`);
    setBreakModal(null);
  };

  const handleReturn=async(id)=>{
    const rep=reps.find(r=>r.id===id);
    await updateStatus(id,"available");
    await logBreakEnd(id);
    setReps(p=>p.map(r=>r.id===id?{...r,status:"available"}:r));
    fire("approved",`${rep.name} is back on duty. 🎉`);
  };

  const handleConfirmOOO=async(type,note)=>{
    await updateStatus(oooModal.id, type, note);
    setReps(p=>p.map(r=>r.id===oooModal.id?{...r,status:type,oooNote:note}:r));
    fire("ooo",`${oooModal.name} marked as ${type==="pto"?"PTO ✈️":"Sick Day 🤒"}`);
    setOooModal(null);setTab("out");
  };

  const handleClearOOO=async(id)=>{
    const rep=reps.find(r=>r.id===id);
    await updateStatus(id,"available","");
    setReps(p=>p.map(r=>r.id===id?{...r,status:"available",oooNote:""}:r));
    fire("info",`${rep.name} is back on duty.`);
  };

  function RepRow({rep}){
    const cfg=ST[rep.status]||ST.available;
    const onBreak=rep.status==="health"||rep.status==="lunch";
    const isOOO=rep.status==="pto"||rep.status==="sick";
    const isOff=rep.status==="off";
    const tz=TZ_C[rep.tz]||TZ_C.Central;
    if(!rep.name.toLowerCase().includes(search.toLowerCase())) return null;
    return (
      <div style={{background:cfg.bg,borderRadius:13,padding:"11px 14px",border:`1.5px solid ${cfg.border}`,marginBottom:6}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:36,height:36,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0,background:isOOO?"#ede0f5":isOff?"#eee":onBreak?(rep.status==="health"?"#d6eaf8":"#fdebd0"):"#eafaf1",color:isOOO?"#7a1a5c":isOff?"#bbb":onBreak?(rep.status==="health"?"#1a6291":"#9c5a00"):"#1a5c35"}}>{rep.avatar}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
              <span style={{fontWeight:600,fontSize:13,color:isOff?"#bbb":"#1a1a1a"}}>{rep.name}</span>
              <span style={{fontSize:9,padding:"2px 6px",borderRadius:5,background:tz.bg,color:tz.text,fontWeight:700}}>{rep.tz}</span>
              <span style={{fontSize:9,padding:"2px 6px",borderRadius:5,background:cfg.bg,color:cfg.dot,border:`1px solid ${cfg.border}`,fontWeight:600}}>{cfg.label}</span>
            </div>
            {!isOOO&&!isOff&&<p style={{margin:"2px 0 0",fontSize:10,color:"#ccc"}}>🥗 {rep.lunch}</p>}
            {rep.oooNote&&<p style={{margin:"2px 0 0",fontSize:10,color:"#aaa"}}>{rep.oooNote}</p>}
          </div>
          <div style={{display:"flex",gap:6,flexShrink:0}}>
            {onBreak&&<button onClick={()=>handleReturn(rep.id)} style={{padding:"5px 10px",borderRadius:7,border:"1.5px solid #ddd",background:"#fff",cursor:"pointer",fontSize:11,color:"#555",fontWeight:600}}>Back 👋</button>}
            {isOOO&&<button onClick={()=>handleClearOOO(rep.id)} style={{padding:"5px 10px",borderRadius:7,border:"1.5px solid #c8a8e0",background:"#f5eefb",cursor:"pointer",fontSize:11,color:"#7a1a5c",fontWeight:600}}>Clear</button>}
            {!onBreak&&!isOOO&&!isOff&&(
              <>
                <button onClick={()=>setBreakModal(rep)} style={{padding:"5px 10px",borderRadius:7,border:"1.5px solid #c8e6c9",background:"#f1f8f3",cursor:"pointer",fontSize:11,color:"#1a5c35",fontWeight:600}}>Break</button>
                <button onClick={()=>setOooModal(rep)} style={{padding:"5px 10px",borderRadius:7,border:"1.5px solid #ebebeb",background:"#fafafa",cursor:"pointer",fontSize:11,color:"#aaa",fontWeight:500}}>Out</button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  const Section=({title,items,color})=>items.length===0?null:(
    <div style={{marginBottom:16}}>
      <p style={{fontSize:10,letterSpacing:1.8,textTransform:"uppercase",color:color||"#bbb",margin:"0 0 7px",fontWeight:700}}>{title} ({items.length})</p>
      {items.map(r=><RepRow key={r.id} rep={r}/>)}
    </div>
  );

  return (
    <div style={{fontFamily:"'Segoe UI',system-ui,sans-serif",minHeight:"100vh",background:"#f4f6f2",paddingBottom:60}}>
      <style>{`@keyframes popIn{from{transform:scale(0.92);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
      {breakModal&&<BreakModal rep={breakModal} onClose={()=>setBreakModal(null)} onConfirm={handleConfirm} lunchLeft={LUNCH_LIMIT-onLunch} healthLeft={HEALTH_LIMIT-onHealth}/>}
      {oooModal&&<OOOModal rep={oooModal} onClose={()=>setOooModal(null)} onMark={handleConfirmOOO}/>}
      {toast&&<Toast key={toast.id} msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}
      <div style={{background:"#1a2e1a",padding:"20px 18px 16px",color:"#fff"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
          <div>
            <span style={{fontSize:10,background:"rgba(255,255,255,0.15)",padding:"3px 8px",borderRadius:5,letterSpacing:1.5,fontWeight:700}}>MANAGER</span>
            <h1 style={{margin:"4px 0 2px",fontSize:20,fontWeight:800}}>Team Overview 🎛️</h1>
            <p style={{margin:0,fontSize:11,opacity:0.55}}>{TODAY_LABEL}</p>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
            <button onClick={onLogout} style={{padding:"6px 12px",borderRadius:8,border:"1px solid rgba(255,255,255,0.2)",background:"transparent",color:"rgba(255,255,255,0.7)",cursor:"pointer",fontSize:11}}>Sign Out</button>
            <div style={{display:"flex",gap:6}}>
              {[{n:oooCount,l:"OOO"},{n:offCount,l:"Off"}].map(s=>(
                <div key={s.l} style={{textAlign:"center",background:"rgba(255,255,255,0.1)",borderRadius:8,padding:"6px 10px"}}>
                  <p style={{margin:0,fontSize:16,fontWeight:700}}>{s.n}</p>
                  <p style={{margin:0,fontSize:9,opacity:0.6}}>{s.l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
          {[
            {n:reps.filter(r=>r.status==="available").length,l:"Available",c:"#27ae60"},
            {n:onHealth,l:`Health (/${HEALTH_LIMIT})`,c:onHealth>=HEALTH_LIMIT?"#e74c3c":"#2980b9"},
            {n:onLunch,l:`Lunch (/${LUNCH_LIMIT})`,c:onLunch>=LUNCH_LIMIT?"#e74c3c":"#e07b00"},
            {n:oooCount+offCount,l:"Out",c:"#8e44ad"},
          ].map(s=>(
            <div key={s.l} style={{background:"rgba(255,255,255,0.1)",borderRadius:10,padding:"8px 6px",textAlign:"center"}}>
              <p style={{margin:0,fontSize:20,fontWeight:800,color:s.c}}>{s.n}</p>
              <p style={{margin:0,fontSize:9,opacity:0.65,lineHeight:1.2}}>{s.l}</p>
            </div>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {[
            {icon:"🌿",label:"Health",count:onHealth,limit:HEALTH_LIMIT,color:"#2980b9"},
            {icon:"🥗",label:"Lunch", count:onLunch, limit:LUNCH_LIMIT,  color:"#e07b00"},
          ].map(m=>(
            <div key={m.label} style={{background:"rgba(255,255,255,0.08)",borderRadius:10,padding:"10px 12px",border:`1px solid ${m.count>=m.limit?"rgba(231,76,60,0.5)":"rgba(255,255,255,0.1)"}`}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <span style={{fontSize:11,opacity:0.8}}>{m.icon} {m.label}</span>
                <span style={{fontSize:15,fontWeight:700,color:m.count>=m.limit?"#e74c3c":"#fff"}}>{m.count}<span style={{fontSize:11,opacity:0.5}}>/{m.limit}</span></span>
              </div>
              <div style={{height:4,background:"rgba(255,255,255,0.15)",borderRadius:3}}>
                <div style={{width:`${Math.min(m.count/m.limit,1)*100}%`,height:"100%",background:m.count>=m.limit?"#e74c3c":m.color,borderRadius:3,transition:"width .3s"}}/>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{background:"#fff",borderBottom:"1.5px solid #ebebeb"}}>
        <div style={{display:"flex",padding:"0 18px"}}>
          {[{k:"active",l:`On Duty (${active.length})`},{k:"out",l:`Out (${out.length})`}].map(t=>(
            <button key={t.k} onClick={()=>setTab(t.k)} style={{padding:"11px 14px",border:"none",background:"none",cursor:"pointer",fontSize:13,fontWeight:tab===t.k?700:500,color:tab===t.k?"#1a5c35":"#999",borderBottom:tab===t.k?"2.5px solid #1a5c35":"2.5px solid transparent",marginBottom:-1.5,transition:"all .15s"}}>{t.l}</button>
          ))}
        </div>
        <div style={{padding:"8px 18px 10px"}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search rep name…" style={{width:"100%",boxSizing:"border-box",padding:"8px 12px",borderRadius:9,border:"1.5px solid #e8e8e8",fontSize:13,outline:"none",background:"#fafafa"}}/>
        </div>
      </div>
      <div style={{padding:"0 14px",maxWidth:620,margin:"0 auto"}}>
        {loading&&<p style={{textAlign:"center",color:"#aaa",padding:"30px 0",fontSize:13}}>Loading team status…</p>}
        {!loading&&tab==="active"&&(
          <div style={{marginTop:16}}>
            <Section title="🌿 On Break" items={active.filter(r=>r.status==="health"||r.status==="lunch")} color="#2980b9"/>
            <Section title="✅ Available" items={active.filter(r=>r.status==="available")} color="#1a5c35"/>
          </div>
        )}
        {!loading&&tab==="out"&&(
          <div style={{marginTop:16}}>
            {out.length===0?(
              <div style={{textAlign:"center",padding:"44px 0",color:"#bbb"}}>
                <p style={{fontSize:32,margin:"0 0 8px"}}>🎉</p>
                <p style={{fontWeight:600,fontSize:15,color:"#888",margin:0}}>Everyone's in!</p>
              </div>
            ):(
              <>
                <Section title="✈️ PTO"          items={out.filter(r=>r.status==="pto")}  color="#8e44ad"/>
                <Section title="🤒 Sick Day"      items={out.filter(r=>r.status==="sick")} color="#c0392b"/>
                <Section title="📅 Scheduled Off" items={out.filter(r=>r.status==="off")}  color="#aaa"/>
              </>
            )}
          </div>
        )}
        <div style={{marginTop:16,padding:"12px 14px",background:"#fff",borderRadius:12,border:"1.5px solid #efefef"}}>
          <p style={{margin:"0 0 7px",fontSize:10,letterSpacing:1.8,textTransform:"uppercase",color:"#ccc",fontWeight:700}}>Break Rules</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
            {[["🌿","Health — max 2 · 15 min"],["🥗","Lunch — max 3 · per schedule"],["✈️","PTO — manager only"],["🤒","Sick Day — manager only"]].map(([i,t],n)=>(
              <div key={n} style={{display:"flex",gap:5,alignItems:"flex-start"}}>
                <span style={{fontSize:11}}>{i}</span><span style={{fontSize:11,color:"#aaa",lineHeight:1.4}}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RepView({ rep, reps, setReps, onLogout, loading }) {
  const [breakModal,setBreakModal]=useState(false);
  const [toast,setToast]=useState(null);
  const myRep=reps.find(r=>r.id===rep.id)||{...rep,status:"available",oooNote:""};
  const onLunch=reps.filter(r=>r.status==="lunch").length;
  const onHealth=reps.filter(r=>r.status==="health").length;
  const lunchLeft=LUNCH_LIMIT-onLunch;
  const healthLeft=HEALTH_LIMIT-onHealth;
  const cfg=ST[myRep.status]||ST.available;
  const onBreak=myRep.status==="health"||myRep.status==="lunch";
  const isOOO=myRep.status==="pto"||myRep.status==="sick";
  const isOff=myRep.status==="off";
  const fire=(type,msg)=>setToast({type,msg,id:Date.now()});

  const handleConfirm=async(breakType)=>{
    const left=breakType==="lunch"?lunchLeft:healthLeft;
    if(left<=0){fire("declined",`Sorry, ${breakType==="lunch"?"lunch":"health break"} slots are full!`);setBreakModal(false);return;}
    await updateStatus(rep.id, breakType);
    await logBreakStart(rep.id, rep.name, breakType);
    setReps(p=>p.map(r=>r.id===rep.id?{...r,status:breakType}:r));
    fire("approved",`Enjoy your ${breakType==="lunch"?"lunch 🥗":"health break 🌿"}!`);
    setBreakModal(false);
  };

  const handleReturn=async()=>{
    await updateStatus(rep.id,"available");
    await logBreakEnd(rep.id);
    setReps(p=>p.map(r=>r.id===rep.id?{...r,status:"available"}:r));
    fire("approved","Welcome back! You're on duty. 🎉");
  };

  const SlotDot=({avail,total,color})=>(
    <div style={{display:"flex",gap:5,justifyContent:"center",marginTop:6}}>
      {Array.from({length:total}).map((_,i)=>(
        <div key={i} style={{width:10,height:10,borderRadius:"50%",background:i<(total-(avail??total))?color:"rgba(255,255,255,0.25)",transition:"background .3s"}}/>
      ))}
    </div>
  );

  return (
    <div style={{fontFamily:"'Segoe UI',system-ui,sans-serif",minHeight:"100vh",background:"#f4f6f2",paddingBottom:60}}>
      <style>{`@keyframes popIn{from{transform:scale(0.92);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
      {breakModal&&<BreakModal rep={myRep} onClose={()=>setBreakModal(false)} onConfirm={handleConfirm} lunchLeft={lunchLeft} healthLeft={healthLeft}/>}
      {toast&&<Toast key={toast.id} msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}
      <div style={{background:"#1a5c35",padding:"22px 20px 20px",color:"#fff"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
          <div>
            <p style={{margin:"0 0 1px",fontSize:10,opacity:0.55,letterSpacing:2,textTransform:"uppercase"}}>My Break</p>
            <h1 style={{margin:"0 0 2px",fontSize:22,fontWeight:800}}>Hey, {rep.name}! 👋</h1>
            <p style={{margin:0,fontSize:11,opacity:0.6}}>{TODAY_LABEL}</p>
          </div>
          <button onClick={onLogout} style={{padding:"7px 12px",borderRadius:9,border:"1px solid rgba(255,255,255,0.2)",background:"transparent",color:"rgba(255,255,255,0.7)",cursor:"pointer",fontSize:11}}>Switch</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {[
            {icon:"🌿",label:"Health Break",avail:healthLeft,total:HEALTH_LIMIT,color:"#2980b9",dur:"15 min"},
            {icon:"🥗",label:"Lunch Break", avail:lunchLeft, total:LUNCH_LIMIT,  color:"#e07b00",dur:"per schedule"},
          ].map(m=>(
            <div key={m.label} style={{background:"rgba(255,255,255,0.12)",borderRadius:13,padding:"13px 14px",border:`1px solid ${m.avail===0?"rgba(231,76,60,0.5)":"rgba(255,255,255,0.15)"}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <span style={{fontSize:22}}>{m.icon}</span>
                <span style={{fontSize:10,background:m.avail===0?"rgba(231,76,60,0.25)":"rgba(255,255,255,0.15)",padding:"3px 8px",borderRadius:6,fontWeight:700,color:m.avail===0?"#ffaaaa":"rgba(255,255,255,0.9)"}}>
                  {m.avail===0?"FULL":`${m.avail} open`}
                </span>
              </div>
              <p style={{margin:"8px 0 1px",fontSize:12,fontWeight:600,opacity:0.9}}>{m.label}</p>
              <p style={{margin:0,fontSize:10,opacity:0.55}}>{m.dur}</p>
              <SlotDot avail={m.avail} total={m.total} color={m.color}/>
            </div>
          ))}
        </div>
      </div>
      <div style={{padding:"20px 18px",maxWidth:480,margin:"0 auto"}}>
        {loading&&<p style={{textAlign:"center",color:"#aaa",padding:"20px 0",fontSize:13}}>Loading…</p>}
        {!loading&&(
          <>
            <p style={{fontSize:10,letterSpacing:1.8,textTransform:"uppercase",color:"#bbb",margin:"0 0 10px",fontWeight:700}}>My Status</p>
            <div style={{background:cfg.bg,border:`2px solid ${cfg.border}`,borderRadius:18,padding:"22px 20px",marginBottom:16}}>
              <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:isOOO||isOff?0:16}}>
                <div style={{width:52,height:52,borderRadius:"50%",background:isOff?"#eee":onBreak?(myRep.status==="health"?"#d6eaf8":"#fdebd0"):"#eafaf1",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:800,color:isOff?"#bbb":onBreak?(myRep.status==="health"?"#1a6291":"#9c5a00"):"#1a5c35"}}>
                  {rep.avatar}
                </div>
                <div>
                  <p style={{margin:0,fontWeight:700,fontSize:17,color:"#1a1a1a"}}>{rep.name}</p>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginTop:3}}>
                    <span style={{width:8,height:8,borderRadius:"50%",background:cfg.dot,display:"inline-block"}}/>
                    <span style={{fontSize:13,color:cfg.dot,fontWeight:600}}>{cfg.label}</span>
                  </div>
                </div>
              </div>
              {!isOOO&&!isOff&&(
                <div style={{borderTop:"1.5px solid rgba(0,0,0,0.06)",paddingTop:14}}>
                  <p style={{margin:"0 0 6px",fontSize:11,color:"#aaa"}}>Scheduled lunch: <strong style={{color:"#555"}}>{rep.lunch}</strong></p>
                  {onBreak?(
                    <button onClick={handleReturn} style={{width:"100%",padding:"13px",borderRadius:12,border:"none",background:"#1a5c35",color:"#fff",cursor:"pointer",fontSize:15,fontWeight:700}}>I'm back! 👋</button>
                  ):(
                    <button onClick={()=>setBreakModal(true)} style={{width:"100%",padding:"13px",borderRadius:12,border:"none",background:"#1a5c35",color:"#fff",cursor:"pointer",fontSize:15,fontWeight:700}}>Request a Break 🌿</button>
                  )}
                </div>
              )}
              {isOOO&&<p style={{margin:"14px 0 0",fontSize:13,color:"#888",textAlign:"center"}}>You're marked as out today. See your manager to update.</p>}
              {isOff&&<p style={{margin:"14px 0 0",fontSize:13,color:"#bbb",textAlign:"center"}}>Today is your scheduled day off. Enjoy! 🎉</p>}
            </div>
            {!isOff&&!isOOO&&(
              <div style={{background:"#fff",borderRadius:14,border:"1.5px solid #efefef",padding:"14px 16px",marginBottom:12}}>
                <p style={{margin:"0 0 10px",fontSize:10,letterSpacing:1.8,textTransform:"uppercase",color:"#bbb",fontWeight:700}}>Who's on break right now</p>
                {reps.filter(r=>(r.status==="health"||r.status==="lunch")&&r.id!==rep.id).length===0?(
                  <p style={{margin:0,fontSize:13,color:"#bbb"}}>Nobody's on break — slots are wide open!</p>
                ):(
                  <div style={{display:"flex",flexDirection:"column",gap:7}}>
                    {reps.filter(r=>(r.status==="health"||r.status==="lunch")&&r.id!==rep.id).map(r=>{
                      const s=ST[r.status];
                      return (
                        <div key={r.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",background:s.bg,borderRadius:10,border:`1px solid ${s.border}`}}>
                          <div style={{width:30,height:30,borderRadius:"50%",background:r.status==="health"?"#d6eaf8":"#fdebd0",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:r.status==="health"?"#1a6291":"#9c5a00"}}>{r.avatar}</div>
                          <div>
                            <p style={{margin:0,fontWeight:600,fontSize:13,color:"#1a1a1a"}}>{r.name}</p>
                            <p style={{margin:0,fontSize:11,color:s.dot}}>{s.label}</p>
                          </div>
                          <span style={{marginLeft:"auto",fontSize:15}}>{r.status==="health"?"🌿":"🥗"}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {(()=>{
              const oooToday=reps.filter(r=>(r.status==="pto"||r.status==="sick")&&r.id!==rep.id);
              const offToday=reps.filter(r=>r.status==="off"&&r.id!==rep.id);
              if(oooToday.length===0&&offToday.length===0) return null;
              return (
                <div style={{background:"#fff",borderRadius:14,border:"1.5px solid #efefef",padding:"14px 16px"}}>
                  <p style={{margin:"0 0 10px",fontSize:10,letterSpacing:1.8,textTransform:"uppercase",color:"#bbb",fontWeight:700}}>Out today</p>
                  <div style={{display:"flex",flexDirection:"column",gap:7}}>
                    {oooToday.map(r=>{
                      const s=ST[r.status];
                      return (
                        <div key={r.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",background:s.bg,borderRadius:10,border:`1px solid ${s.border}`}}>
                          <div style={{width:30,height:30,borderRadius:"50%",background:r.status==="pto"?"#ede0f5":"#fde8e4",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:r.status==="pto"?"#7a1a5c":"#c0392b"}}>{r.avatar}</div>
                          <div style={{flex:1}}>
                            <p style={{margin:0,fontWeight:600,fontSize:13,color:"#1a1a1a"}}>{r.name}</p>
                            <p style={{margin:0,fontSize:11,color:s.dot}}>{s.label}{r.oooNote?` · ${r.oooNote}`:""}</p>
                          </div>
                          <span style={{fontSize:15}}>{r.status==="pto"?"✈️":"🤒"}</span>
                        </div>
                      );
                    })}
                    {offToday.map(r=>(
                      <div key={r.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",background:"#f7f7f7",borderRadius:10,border:"1px solid #e8e8e8"}}>
                        <div style={{width:30,height:30,borderRadius:"50%",background:"#eee",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"#bbb"}}>{r.avatar}</div>
                        <div style={{flex:1}}>
                          <p style={{margin:0,fontWeight:600,fontSize:13,color:"#bbb"}}>{r.name}</p>
                          <p style={{margin:0,fontSize:11,color:"#ccc"}}>Scheduled day off</p>
                        </div>
                        <span style={{fontSize:15}}>📅</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [view,setView]=useState("login");
  const [currentRep,setCurrentRep]=useState(null);
  const [reps,setReps]=useState([]);
  const [loading,setLoading]=useState(true);

  const fetchReps = useCallback(async()=>{
    try {
      const rows = await loadStatuses();
      setReps(mergeWithLocal(rows));
    } catch(e) {
      console.error("Supabase load error:",e);
      // fallback to local
      const todayPTO=PTO_DATA[todayKey()]||[];
      setReps(REPS_DATA.map(r=>({...r,oooNote:"",status:r.offDays.includes(TODAY_DAY)?"off":todayPTO.includes(r.name)?"pto":"available"})));
    } finally {
      setLoading(false);
    }
  },[]);

  useEffect(()=>{
    fetchReps();
    // Poll every 15 seconds for live updates
    const interval = setInterval(fetchReps, 15000);
    return ()=>clearInterval(interval);
  },[fetchReps]);

  const handleSelect=(role,rep=null)=>{
    if(role==="manager"){setView("manager");}
    else{setCurrentRep(rep);setView("rep");}
  };

  return (
    <>
      <style>{`@keyframes popIn{from{transform:scale(0.92);opacity:0}to{transform:scale(1);opacity:1}} *{box-sizing:border-box}`}</style>
      {view==="login"&&<LoginScreen onSelect={handleSelect}/>}
      {view==="manager"&&<ManagerView reps={reps} setReps={setReps} onLogout={()=>setView("login")} loading={loading}/>}
      {view==="rep"&&<RepView rep={currentRep} reps={reps} setReps={setReps} onLogout={()=>setView("login")} loading={loading}/>}
    </>
  );
}
