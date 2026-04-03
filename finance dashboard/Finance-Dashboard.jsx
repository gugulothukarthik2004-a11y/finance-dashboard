import { useState, useMemo, useEffect } from "react";

// ── FORMATTERS ────────────────────────────────────────────────────────────────
const fINR = (n) => "₹" + Math.round(n).toLocaleString("en-IN");
const fShort = (n) => {
  if (n >= 10000000) return "₹" + (n / 10000000).toFixed(2) + " Cr";
  if (n >= 100000)   return "₹" + (n / 100000).toFixed(1) + " L";
  if (n >= 1000)     return "₹" + (n / 1000).toFixed(1) + "K";
};

// ── SEED DATA ─────────────────────────────────────────────────────────────────
const CATEGORIES = [
  "Food & Dining","Transport","Shopping","Housing",
  "Healthcare","Entertainment","Freelance","Salary","Investments","Utilities"
];
const COLORS = {
  "Food & Dining":"#FF6B35","Transport":"#4ECDC4","Shopping":"#A855F7",
  "Housing":"#06B6D4","Healthcare":"#F43F5E","Entertainment":"#F59E0B",
  "Freelance":"#10B981","Salary":"#3B82F6","Investments":"#8B5CF6","Utilities":"#6B7280"
};
const ICONS = {
  "Food & Dining":"🍛","Transport":"🛺","Shopping":"🛍","Housing":"🏠",
  "Healthcare":"💊","Entertainment":"🎬","Freelance":"💼","Salary":"💰",
  "Investments":"📈","Utilities":"⚡"
};
const DESCS = {
  "Food & Dining":  ["Zomato Order","Swiggy Delivery","BigBasket","DMart","Haldiram's","Local Restaurant","Café Coffee Day","Blinkit Groceries"],
  "Transport":      ["Ola Cab","Rapido Ride","Metro Card Recharge","BMTC Monthly Pass","Petrol — Indian Oil","Auto Fare","IndiGo Flight","Uber"],
  "Shopping":       ["Flipkart","Meesho","Myntra","Amazon India","Nykaa","Ajio","Reliance Smart","Decathlon"],
  "Housing":        ["Monthly Rent","Electricity — BESCOM","Jio Fiber Bill","Water Bill","Society Maintenance","LPG Cylinder"],
  "Healthcare":     ["Apollo Pharmacy","Cult.fit Membership","1mg Medicine Order","Doctor Consultation","Practo Appointment"],
  "Entertainment":  ["Netflix India","Disney+ Hotstar","BookMyShow","Spotify Premium","SonyLiv","ZEE5"],
  "Utilities":      ["BSNL Postpaid","Gas Cylinder","Municipal Tax","DTH Recharge","Mobile Recharge"],
  "Salary":         ["Monthly Salary","Performance Bonus","Payroll — HDFC"],
  "Freelance":      ["Client Payment","Upwork Earnings","Project Invoice","Consulting Fee","Toptal Payout"],
  "Investments":    ["Zerodha Dividend","Groww SIP Return","Mutual Fund Payout","FD Interest","Gold Bond Gain"]
};

const rng = (n) => { let x = Math.sin(n) * 10000; return x - Math.floor(x); };

const genTransactions = () => {
  const txs = []; let id = 1;
  for (let mo = 0; mo < 6; mo++) {
    const rawM  = 3 - mo;
    const month = rawM <= 0 ? rawM + 12 : rawM;
    const year  = rawM <= 0 ? 2025 : 2026;
    const days  = new Date(year, month, 0).getDate();
    const count = 22 + Math.floor(rng(mo * 37) * 10);
    for (let i = 0; i < count; i++) {
      const isInc  = rng(id * 13 + 7) > 0.82;
      const pool   = isInc
        ? ["Salary","Freelance","Investments"]
        : ["Food & Dining","Transport","Shopping","Housing","Healthcare","Entertainment","Utilities"];
      const cat    = pool[Math.floor(rng(id * 31 + 3) * pool.length)];
      const day    = 1 + Math.floor(rng(id * 17 + 5) * days);
      const amt    =
        cat === "Salary"       ? 55000 + rng(id) * 15000
        : cat === "Freelance"  ?  8000 + rng(id) * 25000
        : cat === "Investments"?  2000 + rng(id) * 12000
        : cat === "Housing"    ? (rng(id) < 0.08 ? 18000 : 800 + rng(id) * 4000)
        :                          400 + rng(id) * 5000;
      txs.push({
        id: id++,
        date: new Date(year, month - 1, day).toISOString().split("T")[0],
        description: (DESCS[cat] || ["Transaction"])[Math.floor(rng(id * 7) * (DESCS[cat]||["Transaction"]).length)],
        category: cat,
        amount: parseFloat(amt.toFixed(2)),
        type: isInc ? "income" : "expense"
      });
    }
  }
  return txs.sort((a, b) => b.date.localeCompare(a.date));
};

const INITIAL_TXS = genTransactions();

// Purge any old Hindi-language data from previous versions
const HINDI_RE = /[\u0900-\u097F]/;
["pf_txs","pf_role","pf_dark","fd2_txs","fd2_role","fd2_dark","fd_txs","fd_role","fd_dark"].forEach(k => {
  try {
    const v = localStorage.getItem(k);
    if (v && HINDI_RE.test(v)) localStorage.removeItem(k);
  } catch {}
});

// Use versioned keys so stale data never bleeds in
const load = (k, d) => { try { const v = localStorage.getItem("pt3_" + k); return v ? JSON.parse(v) : d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem("pt3_" + k, JSON.stringify(v)); } catch {} };

// ── SPARKLINE ─────────────────────────────────────────────────────────────────
const Sparkline = ({ data, color }) => {
  if (!data || data.length < 2) return null;
  const mn = Math.min(...data), mx = Math.max(...data), rr = mx - mn || 1;
  const W = 72, H = 30;
  const pts = data.map((v, i) =>
    `${(i / (data.length - 1)) * W},${H - ((v - mn) / rr) * (H - 4) - 2}`
  ).join(" ");
  return (
    <svg width={W} height={H} style={{ overflow: "visible" }}>
      <polyline points={`0,${H} ${pts} ${W},${H}`} fill={color} fillOpacity="0.15" stroke="none" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};

// ── DONUT CHART ───────────────────────────────────────────────────────────────
const Donut = ({ data }) => {
  const tot = data.reduce((s, d) => s + d.v, 0);
  let a = -Math.PI / 2;
  const cx = 52, cy = 52, r = 40, inn = 25;
  return (
    <svg width={104} height={104}>
      {data.map((d, i) => {
        const sw  = (d.v / tot) * Math.PI * 2;
        const x1  = cx + r * Math.cos(a), y1 = cy + r * Math.sin(a);
        a += sw;
        const x2  = cx + r * Math.cos(a), y2 = cy + r * Math.sin(a);
        const lg  = sw > Math.PI ? 1 : 0;
        const xi1 = cx + inn * Math.cos(a - sw), yi1 = cy + inn * Math.sin(a - sw);
        const xi2 = cx + inn * Math.cos(a),      yi2 = cy + inn * Math.sin(a);
        return (
          <path key={i}
            d={`M${x1},${y1} A${r},${r} 0 ${lg},1 ${x2},${y2} L${xi2},${yi2} A${inn},${inn} 0 ${lg},0 ${xi1},${yi1} Z`}
            fill={d.color}
          />
        );
      })}
      <circle cx={cx} cy={cy} r={inn - 2} fill="var(--card)" />
    </svg>
  );
};

// ── TREND LINE ────────────────────────────────────────────────────────────────
const TrendLine = ({ points: months }) => {
  const vals = months.map(m => m.balance);
  const mn = Math.min(...vals), mx = Math.max(...vals), rr = mx - mn || 1;
  const W = 480, H = 96, p = 10;
  const pts = vals.map((v, i) => [
    Math.round(p + (i / (vals.length - 1)) * (W - p * 2)),
    Math.round(H - p - ((v - mn) / rr) * (H - p * 2))
  ]);
  const dPath = pts.map((pt, i) =>
    i === 0 ? `M${pt[0]},${pt[1]}`
    : `C${pts[i-1][0]+22},${pts[i-1][1]} ${pt[0]-22},${pt[1]} ${pt[0]},${pt[1]}`
  ).join(" ");
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H + 26}`} preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#6366f1" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0"    />
        </linearGradient>
      </defs>
      <path d={`${dPath} L${pts[pts.length-1][0]},${H+4} L${pts[0][0]},${H+4} Z`} fill="url(#tg)" />
      <path d={dPath} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" />
      {pts.map((pt, i) => (
        <g key={i}>
          <circle cx={pt[0]} cy={pt[1]} r="4" fill="var(--card)" stroke="#6366f1" strokeWidth="2" />
          <text x={pt[0]} y={H + 20} textAnchor="middle" fontSize="10" fill="var(--muted)">
            {months[i].label}
          </text>
        </g>
      ))}
    </svg>
  );
};

// ── BAR CHART ─────────────────────────────────────────────────────────────────
const BarChart = ({ months }) => {
  const mx  = Math.max(...months.flatMap(m => [m.income, m.expense])) || 1;
  const H   = 108, bw = 13, gap = 4, grp = bw * 2 + gap + 20;
  return (
    <svg width="100%" viewBox={`0 0 ${months.length * grp} ${H + 22}`} preserveAspectRatio="xMidYMid meet">
      {months.map((m, i) => {
        const x  = i * grp;
        const ih = Math.max(2, Math.round((m.income  / mx) * H));
        const eh = Math.max(2, Math.round((m.expense / mx) * H));
        return (
          <g key={i}>
            <rect x={x}        y={H - ih} width={bw} height={ih} rx="3" fill="#10B981" opacity="0.82" />
            <rect x={x+bw+gap} y={H - eh} width={bw} height={eh} rx="3" fill="#F43F5E" opacity="0.82" />
            <text x={x + bw} y={H + 16} textAnchor="middle" fontSize="9" fill="var(--muted)">{m.label}</text>
          </g>
        );
      })}
    </svg>
  );
};

// ── MODAL ─────────────────────────────────────────────────────────────────────
const Modal = ({ open, onClose, title, children }) => {
  if (!open) return null;
  return (
    <div
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:300,
               display:"flex", alignItems:"center", justifyContent:"center",
               padding:"1rem", backdropFilter:"blur(6px)" }}
      onClick={onClose}
    >
      <div
        style={{ background:"var(--card)", border:"1px solid var(--border)", borderRadius:20,
                 padding:"1.5rem", width:"100%", maxWidth:440 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.25rem" }}>
          <span style={{ fontWeight:800, fontSize:"1rem", color:"var(--fg)" }}>{title}</span>
          <button onClick={onClose}
            style={{ background:"var(--hover)", border:"none", borderRadius:8, width:30, height:30,
                     cursor:"pointer", color:"var(--muted)", fontSize:18, fontFamily:"inherit" }}>
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [role,   setRole]   = useState(() => load("role",  "viewer"));
  const [txs,    setTxs]    = useState(() => load("txs",   INITIAL_TXS));
  const [tab,    setTab]    = useState("dash");
  const [dark,   setDark]   = useState(() => load("dark",  false));
  const [search, setSearch] = useState("");
  const [fType,  setFType]  = useState("all");
  const [fCat,   setFCat]   = useState("all");
  const [sortBy, setSortBy] = useState("date");
  const [asc,    setAsc]    = useState(false);
  const [modal,  setModal]  = useState(false);
  const [editTx, setEditTx] = useState(null);
  const [delId,  setDelId]  = useState(null);
  const [form,   setForm]   = useState({ date:"", description:"", category:"Food & Dining", amount:"", type:"expense" });
  const [errs,   setErrs]   = useState({});
  const isAdmin = role === "admin";

  useEffect(() => { save("txs",  txs);  }, [txs]);
  useEffect(() => { save("role", role); }, [role]);
  useEffect(() => { save("dark", dark); }, [dark]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const cm = "2026-03", pm = "2026-02";
    const cur  = txs.filter(t => t.date.startsWith(cm));
    const prev = txs.filter(t => t.date.startsWith(pm));
    const sum  = (arr, type) => arr.filter(t => t.type === type).reduce((s, t) => s + t.amount, 0);

    const catMap = {};
    txs.filter(t => t.type === "expense").forEach(t => {
      catMap[t.category] = (catMap[t.category] || 0) + t.amount;
    });
    const catArr = Object.entries(catMap).sort((a, b) => b[1] - a[1]);

    const months = Array.from({ length: 6 }, (_, i) => {
      const d   = new Date(2026, 2 - (5 - i), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      const inc = sum(txs.filter(t => t.date.startsWith(key)), "income");
      const exp = sum(txs.filter(t => t.date.startsWith(key)), "expense");
      return { label: d.toLocaleString("default", { month:"short" }), income:inc, expense:exp, balance:inc-exp, key };
    });

    let run = 0;
    const runBal = months.map(m => { run += m.balance; return { label: m.label, balance: run }; });

    return {
      balance: sum(txs,"income") - sum(txs,"expense"),
      curInc:  sum(cur,"income"),
      curExp:  sum(cur,"expense"),
      prevExp: sum(prev,"expense"),
      catArr, months, runBal
    };
  }, [txs]);

  // ── Filtered transactions ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let r = [...txs];
    if (search) r = r.filter(t =>
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.category.toLowerCase().includes(search.toLowerCase())
    );
    if (fType !== "all") r = r.filter(t => t.type === fType);
    if (fCat  !== "all") r = r.filter(t => t.category === fCat);
    return r.sort((a, b) => {
      const v = sortBy === "date"     ? a.date.localeCompare(b.date)
              : sortBy === "amount"   ? a.amount - b.amount
              :                         a.category.localeCompare(b.category);
      return asc ? v : -v;
    });
  }, [txs, search, fType, fCat, sortBy, asc]);

  // ── Insights ──────────────────────────────────────────────────────────────
  const ins = useMemo(() => {
    const expChg  = stats.prevExp > 0 ? ((stats.curExp - stats.prevExp) / stats.prevExp) * 100 : 0;
    const savRate = stats.curInc  > 0 ? ((stats.curInc  - stats.curExp)  / stats.curInc)  * 100 : 0;
    const tot     = stats.catArr.reduce((s, c) => s + c[1], 0);
    return {
      expChg, savRate,
      topCat: stats.catArr[0],
      topPct: stats.catArr[0] ? (stats.catArr[0][1] / tot) * 100 : 0,
      avgExp: stats.months.reduce((s, m) => s + m.expense, 0) / 6
    };
  }, [stats]);

  // ── Form helpers ──────────────────────────────────────────────────────────
  const openAdd  = () => {
    setEditTx(null);
    setForm({ date: new Date().toISOString().split("T")[0], description:"", category:"Food & Dining", amount:"", type:"expense" });
    setErrs({});
    setModal(true);
  };
  const openEdit = (tx) => {
    setEditTx(tx);
    setForm({ date:tx.date, description:tx.description, category:tx.category, amount:String(tx.amount), type:tx.type });
    setErrs({});
    setModal(true);
  };
  const validate = () => {
    const e = {};
    if (!form.date)                                    e.date        = "Required";
    if (!form.description.trim())                      e.description = "Required";
    if (!form.amount || isNaN(+form.amount) || +form.amount <= 0) e.amount = "Enter a valid amount";
    setErrs(e);
    return !Object.keys(e).length;
  };
  const saveForm = () => {
    if (!validate()) return;
    if (editTx) setTxs(p => p.map(t => t.id === editTx.id ? { ...t, ...form, amount: parseFloat(form.amount) } : t));
    else        setTxs(p => [{ id: Date.now(), ...form, amount: parseFloat(form.amount) }, ...p]);
    setModal(false);
  };
  const exportCSV = () => {
    const rows = filtered.map(t =>
      `${t.date},"${t.description}",${t.category},${t.type},${t.amount}`
    ).join("\n");
    const a = document.createElement("a");
    a.href     = URL.createObjectURL(new Blob(["Date,Description,Category,Type,Amount (INR)\n" + rows], { type:"text/csv" }));
    a.download = "transactions.csv";
    a.click();
  };

  // ── Theme ─────────────────────────────────────────────────────────────────
  const T = dark ? {
    "--bg":"#090D18","--card":"#0F1623","--card2":"#161E2E",
    "--border":"rgba(255,255,255,0.07)","--fg":"#EEF2FF",
    "--sub":"#94A3B8","--muted":"#475569","--hover":"rgba(255,255,255,0.04)"
  } : {
    "--bg":"#F5F4F0","--card":"#FFFFFF","--card2":"#EEECE7",
    "--border":"rgba(0,0,0,0.07)","--fg":"#1C1917",
    "--sub":"#57534E","--muted":"#A8A29E","--hover":"rgba(0,0,0,0.03)"
  };
  const acc = dark ? "#818CF8" : "#4F46E5";
  const grn = dark ? "#34D399" : "#059669";
  const red = dark ? "#FB7185" : "#E11D48";

  const INP = {
    width:"100%", padding:"9px 12px", borderRadius:10,
    border:"1.5px solid var(--border)", background:"var(--card2)",
    color:"var(--fg)", fontSize:14, outline:"none",
    boxSizing:"border-box", fontFamily:"inherit"
  };
  const LBL = {
    fontSize:11, fontWeight:700, color:"var(--muted)", marginBottom:5,
    display:"block", letterSpacing:"0.08em", textTransform:"uppercase"
  };

  return (
    <div style={{ ...T, "--acc":acc, "--grn":grn, "--red":red,
                  minHeight:"100vh", background:"var(--bg)", color:"var(--fg)",
                  fontFamily:"'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar { width:3px; }
        ::-webkit-scrollbar-thumb { background:var(--border); border-radius:3px; }
        .tr:hover  { background:var(--hover) !important; }
        .nt        { transition:all .15s; }
        .nt:hover  { opacity:.8; }
        .nt.on     { background:var(--acc) !important; color:#fff !important; }
        .ch:hover  { transform:translateY(-2px); transition:transform .18s; }
        .ba        { transition:opacity .15s, transform .1s; }
        .ba:hover  { opacity:.85; }
        .ba:active { transform:scale(.97); }
        @keyframes fi { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .fi { animation:fi .28s ease forwards; }
        input:focus, select:focus {
          border-color:var(--acc) !important;
          box-shadow:0 0 0 3px rgba(99,102,241,.15) !important;
          outline:none;
        }
        select option { background:#0F1623; }
        @media(max-width:640px) {
          .hm  { display:none !important; }
          .g3  { grid-template-columns:1fr 1fr !important; }
          .g2  { grid-template-columns:1fr !important; }
        }
      `}</style>

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <header style={{
        background:"var(--card)", borderBottom:"1px solid var(--border)",
        padding:"0 1.25rem", height:58, display:"flex", alignItems:"center",
        justifyContent:"space-between", position:"sticky", top:0, zIndex:100, gap:12
      }}>
        {/* Logo */}
        <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
          <div style={{
            width:38, height:38, borderRadius:11,
            background:`linear-gradient(135deg,${acc},${grn})`,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:20, fontWeight:900, color:"#fff"
          }}>₹</div>
          <div>
            <div style={{ fontWeight:800, fontSize:"0.95rem", letterSpacing:"-0.04em", lineHeight:1.1 }}>
              PaisaTrack
            </div>
            <div style={{ fontSize:9, color:"var(--muted)", letterSpacing:"0.1em", fontWeight:700 }}>
              PERSONAL FINANCE
            </div>
          </div>
        </div>

        {/* Nav tabs */}
        <div style={{ display:"flex", gap:3, background:"var(--card2)", borderRadius:12, padding:3, border:"1px solid var(--border)" }}>
          {[
            { id:"dash",     emoji:"◈", label:"Overview"     },
            { id:"txns",     emoji:"⊞", label:"Transactions" },
            { id:"insights", emoji:"◉", label:"Insights"     },
          ].map(n => (
            <button key={n.id} className={`nt${tab===n.id?" on":""}`} onClick={() => setTab(n.id)}
              style={{
                display:"flex", alignItems:"center", gap:5, padding:"6px 13px",
                borderRadius:9, border:"none", cursor:"pointer", fontSize:12, fontWeight:700,
                background:"transparent", color:tab===n.id?"#fff":"var(--sub)",
                fontFamily:"inherit", whiteSpace:"nowrap"
              }}>
              <span>{n.emoji}</span><span className="hm">{n.label}</span>
            </button>
          ))}
        </div>

        {/* Right controls */}
        <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
          <div style={{
            display:"flex", alignItems:"center", gap:6, background:"var(--card2)",
            borderRadius:10, padding:"5px 10px", fontSize:12, fontWeight:700,
            border:"1px solid var(--border)"
          }}>
            <span>{role==="admin"?"🛡":"👤"}</span>
            <select value={role} onChange={e => setRole(e.target.value)}
              style={{ border:"none", background:"transparent", color:"var(--fg)",
                       fontSize:12, fontWeight:700, cursor:"pointer", outline:"none", fontFamily:"inherit" }}>
              <option value="viewer">Viewer</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button onClick={() => setDark(!dark)}
            style={{ width:36, height:36, borderRadius:10, border:"1px solid var(--border)",
                     background:"var(--card2)", cursor:"pointer", fontSize:15 }}>
            {dark ? "☀️" : "🌙"}
          </button>
        </div>
      </header>

      <main style={{ maxWidth:1080, margin:"0 auto", padding:"1.5rem 1rem" }} className="fi">

        {/* ════════════════════════ OVERVIEW ════════════════════════ */}
        {tab === "dash" && <>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:"1.25rem" }}>
            <div>
              <div style={{ fontSize:"1.45rem", fontWeight:800, letterSpacing:"-0.04em", lineHeight:1.1 }}>
                Good morning 👋
              </div>
              <div style={{ fontSize:12, color:"var(--sub)", marginTop:3 }}>March 2026</div>
            </div>
            {isAdmin && (
              <button className="ba" onClick={openAdd}
                style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 16px",
                         borderRadius:11, background:acc, border:"none", color:"#fff",
                         fontWeight:800, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
                + Add Transaction
              </button>
            )}
          </div>

          {/* Summary cards */}
          <div className="g3" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:14 }}>
            {[
              { label:"Total Balance",    v:stats.balance, c:acc, spark:stats.runBal.map(r=>r.balance), tag:"All time net"  },
              { label:"Monthly Income",   v:stats.curInc,  c:grn, spark:stats.months.map(m=>m.income),  tag:"March 2026"   },
              { label:"Monthly Expenses", v:stats.curExp,  c:red, spark:stats.months.map(m=>m.expense), tag:"March 2026"   },
            ].map(c => (
              <div key={c.label} className="ch"
                style={{ background:"var(--card)", borderRadius:16, padding:"1.1rem 1.15rem", border:"1px solid var(--border)" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div>
                    <div style={{ fontSize:10, fontWeight:800, color:"var(--muted)",
                                  letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:7 }}>
                      {c.label}
                    </div>
                    <div style={{ fontSize:"1.5rem", fontWeight:800, letterSpacing:"-0.04em", color:c.c, lineHeight:1 }}>
                      {fShort(c.v)}
                    </div>
                    <div style={{ fontSize:11, color:"var(--muted)", marginTop:5 }}>{c.tag}</div>
                  </div>
                  <Sparkline data={c.spark} color={c.c} />
                </div>
              </div>
            ))}
          </div>

          {/* Trend + Donut */}
          <div className="g2" style={{ display:"grid", gridTemplateColumns:"1.65fr 1fr", gap:12, marginBottom:14 }}>
            <div style={{ background:"var(--card)", borderRadius:16, padding:"1.1rem", border:"1px solid var(--border)" }}>
              <div style={{ fontSize:10, fontWeight:800, color:"var(--muted)",
                            letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:14 }}>
                Balance Trend
              </div>
              <TrendLine points={stats.runBal} />
            </div>
            <div style={{ background:"var(--card)", borderRadius:16, padding:"1.1rem", border:"1px solid var(--border)" }}>
              <div style={{ fontSize:10, fontWeight:800, color:"var(--muted)",
                            letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:10 }}>
                Spending Breakdown
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <Donut data={stats.catArr.slice(0,6).map(([k,v]) => ({ v, color: COLORS[k]||"#888" }))} />
                <div style={{ flex:1, minWidth:0 }}>
                  {stats.catArr.slice(0,5).map(([k,v]) => (
                    <div key={k} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
                      <div style={{ width:7, height:7, borderRadius:"50%", background:COLORS[k]||"#888", flexShrink:0 }} />
                      <span style={{ fontSize:11, color:"var(--sub)", flex:1, overflow:"hidden",
                                     textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{k}</span>
                      <span style={{ fontSize:11, fontWeight:800, color:"var(--fg)", flexShrink:0 }}>{fShort(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Bar chart */}
          <div style={{ background:"var(--card)", borderRadius:16, padding:"1.1rem",
                        border:"1px solid var(--border)", marginBottom:14 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <div style={{ fontSize:10, fontWeight:800, color:"var(--muted)",
                            letterSpacing:"0.08em", textTransform:"uppercase" }}>
                6-Month Income vs Expenses
              </div>
              <div style={{ display:"flex", gap:12, fontSize:11, color:"var(--muted)" }}>
                <span style={{ display:"flex", alignItems:"center", gap:4 }}>
                  <span style={{ width:8, height:8, borderRadius:2, background:grn, display:"inline-block" }} /> Income
                </span>
                <span style={{ display:"flex", alignItems:"center", gap:4 }}>
                  <span style={{ width:8, height:8, borderRadius:2, background:red, display:"inline-block" }} /> Expenses
                </span>
              </div>
            </div>
            <BarChart months={stats.months} />
          </div>

          {/* Recent transactions */}
          <div style={{ background:"var(--card)", borderRadius:16, border:"1px solid var(--border)", overflow:"hidden" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                          padding:"12px 16px", borderBottom:"1px solid var(--border)" }}>
              <span style={{ fontSize:10, fontWeight:800, color:"var(--muted)",
                             letterSpacing:"0.08em", textTransform:"uppercase" }}>
                Recent Transactions
              </span>
              <button onClick={() => setTab("txns")}
                style={{ fontSize:12, color:acc, background:"none", border:"none",
                         cursor:"pointer", fontWeight:800, fontFamily:"inherit" }}>
                View all →
              </button>
            </div>
            {txs.slice(0, 6).map((t, i) => (
              <div key={t.id} className="tr"
                style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 16px",
                         borderBottom: i < 5 ? "1px solid var(--border)" : "none" }}>
                <div style={{ width:36, height:36, borderRadius:10,
                              background:`${COLORS[t.category]}18`,
                              display:"flex", alignItems:"center", justifyContent:"center",
                              fontSize:17, flexShrink:0 }}>
                  {ICONS[t.category]}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:13, whiteSpace:"nowrap",
                                overflow:"hidden", textOverflow:"ellipsis" }}>
                    {t.description}
                  </div>
                  <div style={{ fontSize:11, color:"var(--muted)", marginTop:1 }}>
                    {t.category} · {t.date}
                  </div>
                </div>
                <div style={{ fontSize:14, fontWeight:800, flexShrink:0,
                              color: t.type==="income" ? grn : red }}>
                  {t.type==="income" ? "+" : "−"}{fINR(t.amount)}
                </div>
              </div>
            ))}
          </div>
        </>}

        {/* ════════════════════════ TRANSACTIONS ════════════════════════ */}
        {tab === "txns" && <>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
            <div style={{ fontSize:"1.45rem", fontWeight:800, letterSpacing:"-0.04em" }}>Transactions</div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={exportCSV}
                style={{ display:"flex", alignItems:"center", gap:5, padding:"8px 13px",
                         borderRadius:10, border:"1.5px solid var(--border)", background:"var(--card)",
                         color:"var(--sub)", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                ↓ Export CSV
              </button>
              {isAdmin && (
                <button className="ba" onClick={openAdd}
                  style={{ padding:"8px 16px", borderRadius:10, background:acc, border:"none",
                           color:"#fff", fontWeight:800, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
                  + Add
                </button>
              )}
            </div>
          </div>

          {/* Filter bar */}
          <div style={{ background:"var(--card)", borderRadius:14, padding:"12px 14px",
                        border:"1px solid var(--border)", marginBottom:12,
                        display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
            <div style={{ flex:1, minWidth:150, display:"flex", alignItems:"center", gap:8,
                          background:"var(--card2)", borderRadius:10, padding:"0 12px",
                          border:"1.5px solid var(--border)" }}>
              <span style={{ fontSize:13, color:"var(--muted)" }}>🔍</span>
              <input placeholder="Search transactions..."
                value={search} onChange={e => setSearch(e.target.value)}
                style={{ ...INP, border:"none", background:"transparent", padding:"8px 0" }} />
            </div>
            <select value={fType} onChange={e => setFType(e.target.value)}
              style={{ ...INP, width:"auto", minWidth:120, padding:"8px 10px" }}>
              <option value="all">All Types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
            <select value={fCat} onChange={e => setFCat(e.target.value)}
              style={{ ...INP, width:"auto", minWidth:140, padding:"8px 10px" }}>
              <option value="all">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              style={{ ...INP, width:"auto", minWidth:120, padding:"8px 10px" }}>
              <option value="date">Sort: Date</option>
              <option value="amount">Sort: Amount</option>
              <option value="category">Sort: Category</option>
            </select>
            <button onClick={() => setAsc(a => !a)}
              style={{ padding:"8px 10px", borderRadius:10, border:"1.5px solid var(--border)",
                       background:"var(--card2)", cursor:"pointer", color:"var(--sub)", fontSize:15 }}>
              {asc ? "↑" : "↓"}
            </button>
          </div>

          {/* Table */}
          <div style={{ background:"var(--card)", borderRadius:14, border:"1px solid var(--border)", overflow:"hidden" }}>
            {/* Header */}
            <div style={{ display:"grid", gridTemplateColumns:"110px 1fr 140px 80px 130px 56px",
                          gap:8, padding:"9px 16px", borderBottom:"1px solid var(--border)",
                          fontSize:9, fontWeight:800, color:"var(--muted)",
                          textTransform:"uppercase", letterSpacing:"0.09em" }}>
              <span>Date</span>
              <span>Description</span>
              <span className="hm">Category</span>
              <span className="hm">Type</span>
              <span style={{ textAlign:"right" }}>Amount</span>
              <span />
            </div>

            {filtered.length === 0 ? (
              <div style={{ padding:"3rem", textAlign:"center", color:"var(--muted)" }}>
                <div style={{ fontSize:36, marginBottom:8 }}>🔍</div>
                <div style={{ fontWeight:700 }}>No transactions found</div>
              </div>
            ) : filtered.map((t, i) => (
              <div key={t.id} className="tr"
                style={{ display:"grid", gridTemplateColumns:"110px 1fr 140px 80px 130px 56px",
                         gap:8, padding:"10px 16px",
                         borderBottom: i < filtered.length-1 ? "1px solid var(--border)" : "none",
                         alignItems:"center", fontSize:13 }}>
                <span style={{ color:"var(--muted)", fontSize:11 }}>{t.date}</span>
                <div style={{ display:"flex", alignItems:"center", gap:9, minWidth:0 }}>
                  <span style={{ fontSize:16, flexShrink:0 }}>{ICONS[t.category]}</span>
                  <span style={{ fontWeight:700, overflow:"hidden",
                                 textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {t.description}
                  </span>
                </div>
                <span className="hm">
                  <span style={{ background:`${COLORS[t.category]}20`, color:COLORS[t.category],
                                 padding:"3px 9px", borderRadius:999, fontSize:11, fontWeight:700 }}>
                    {t.category}
                  </span>
                </span>
                <span className="hm"
                  style={{ fontSize:10, fontWeight:800, textTransform:"uppercase",
                           letterSpacing:"0.05em", color: t.type==="income" ? grn : red }}>
                  {t.type}
                </span>
                <span style={{ textAlign:"right", fontWeight:800, color: t.type==="income" ? grn : red }}>
                  {t.type==="income" ? "+" : "−"}{fINR(t.amount)}
                </span>
                <div style={{ display:"flex", gap:2, justifyContent:"flex-end" }}>
                  {isAdmin && (
                    <button onClick={() => openEdit(t)} title="Edit"
                      style={{ background:"none", border:"none", cursor:"pointer", fontSize:13, padding:3, borderRadius:6 }}>
                      ✏️
                    </button>
                  )}
                  {isAdmin && (
                    <button onClick={() => setDelId(t.id)} title="Delete"
                      style={{ background:"none", border:"none", cursor:"pointer", fontSize:13, padding:3, borderRadius:6 }}>
                      🗑
                    </button>
                  )}
                </div>
              </div>
            ))}

            <div style={{ padding:"10px 16px", borderTop:"1px solid var(--border)",
                          display:"flex", justifyContent:"space-between",
                          fontSize:12, color:"var(--muted)", fontWeight:700 }}>
              <span>{filtered.length} transactions</span>
              <span>Net: <span style={{ color:"var(--fg)", fontWeight:800 }}>
                {fINR(filtered.reduce((s,t) => s + (t.type==="income" ? t.amount : -t.amount), 0))}
              </span></span>
            </div>
          </div>
        </>}

        {/* ════════════════════════ INSIGHTS ════════════════════════ */}
        {tab === "insights" && <>
          <div style={{ fontSize:"1.45rem", fontWeight:800, letterSpacing:"-0.04em", marginBottom:"1.25rem" }}>
            Insights 🔮
          </div>

          {/* Metric cards */}
          <div className="g3" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:14 }}>
            {[
              { label:"Savings Rate",          v:`${ins.savRate.toFixed(1)}%`, tag:"March 2026",    e:"💰", good:ins.savRate>20 },
              { label:"Expense Change (MoM)",  v:`${ins.expChg>=0?"+":""}${ins.expChg.toFixed(1)}%`, tag:"vs Feb 2026", e:"📊", good:ins.expChg<0 },
              { label:"Avg Monthly Expense",   v:fShort(ins.avgExp),           tag:"Last 6 months", e:"🧮", good:null },
            ].map(m => (
              <div key={m.label} className="ch"
                style={{ background:"var(--card)", borderRadius:16, padding:"1.1rem", border:"1px solid var(--border)" }}>
                <div style={{ fontSize:24, marginBottom:8 }}>{m.e}</div>
                <div style={{ fontSize:10, fontWeight:800, color:"var(--muted)",
                              textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:4 }}>
                  {m.label}
                </div>
                <div style={{ fontSize:"1.4rem", fontWeight:800, letterSpacing:"-0.03em",
                              color: m.good===null ? "var(--fg)" : m.good ? grn : red }}>
                  {m.v}
                </div>
                <div style={{ fontSize:11, color:"var(--muted)", marginTop:4 }}>{m.tag}</div>
              </div>
            ))}
          </div>

          <div className="g2" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
            {/* Category bars */}
            <div style={{ background:"var(--card)", borderRadius:16, padding:"1.1rem", border:"1px solid var(--border)" }}>
              <div style={{ fontSize:10, fontWeight:800, color:"var(--muted)",
                            textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:14 }}>
                Spending by Category
              </div>
              {stats.catArr.slice(0, 8).map(([k, v]) => {
                const pct = (v / stats.catArr.reduce((s, c) => s + c[1], 0)) * 100;
                return (
                  <div key={k} style={{ marginBottom:11 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5, fontSize:12 }}>
                      <span style={{ color:"var(--sub)", fontWeight:600 }}>{ICONS[k]} {k}</span>
                      <span style={{ fontWeight:800, color:"var(--fg)" }}>{fINR(v)}</span>
                    </div>
                    <div style={{ height:5, borderRadius:4, background:"var(--card2)", overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${pct}%`, borderRadius:4, background:COLORS[k]||"#888" }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Observation cards */}
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {[
                {
                  icon:"🔥", title:"Top Spending Category",
                  body: ins.topCat
                    ? `${ins.topCat[0]} accounts for ${ins.topPct.toFixed(1)}% of total spending (${fINR(ins.topCat[1])}).`
                    : "No data",
                  ac:"#FF6B35"
                },
                {
                  icon:"📅", title:"Month-over-Month",
                  body: `March expenses are ${Math.abs(ins.expChg).toFixed(1)}% ${ins.expChg>=0?"higher":"lower"} than February. ${ins.expChg<0?"Great job! 🎉":"Consider reviewing your spend."}`,
                  ac: ins.expChg < 0 ? grn : red
                },
                {
                  icon:"💡", title:"Savings Tip",
                  body: ins.savRate < 20
                    ? `Your savings rate is ${ins.savRate.toFixed(1)}%. Try to reach the 20% benchmark.`
                    : `${ins.savRate.toFixed(1)}% savings rate — above the 20% goal. Keep it up! 🎉`,
                  ac: ins.savRate >= 20 ? grn : "#F59E0B"
                },
                {
                  icon:"📊", title:"Budget Forecast",
                  body: `At current pace, avg monthly expense is ${fShort(ins.avgExp)} and avg income is ${fShort(stats.months.reduce((s,m)=>s+m.income,0)/6)}.`,
                  ac: acc
                },
              ].map(o => (
                <div key={o.title}
                  style={{ background:"var(--card)", borderRadius:14, padding:"0.85rem 1rem",
                           border:"1px solid var(--border)", borderLeft:`3px solid ${o.ac}` }}>
                  <div style={{ fontSize:12, fontWeight:800, color:o.ac, marginBottom:4 }}>
                    {o.icon} {o.title}
                  </div>
                  <div style={{ fontSize:13, color:"var(--sub)", lineHeight:1.55 }}>{o.body}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly table */}
          <div style={{ background:"var(--card)", borderRadius:16, border:"1px solid var(--border)", overflow:"hidden" }}>
            <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--border)",
                          fontSize:10, fontWeight:800, color:"var(--muted)",
                          textTransform:"uppercase", letterSpacing:"0.08em" }}>
              Monthly Summary
            </div>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                <thead>
                  <tr style={{ borderBottom:"1px solid var(--border)" }}>
                    {["Month","Income","Expenses","Net Savings","Savings Rate"].map(h => (
                      <th key={h} style={{ padding:"9px 16px", textAlign:"right", fontWeight:800,
                                          color:"var(--muted)", fontSize:9, textTransform:"uppercase",
                                          letterSpacing:"0.08em", whiteSpace:"nowrap" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...stats.months].reverse().map(m => {
                    const net = m.income - m.expense;
                    const sr  = m.income > 0 ? ((net / m.income) * 100).toFixed(1) : "-";
                    return (
                      <tr key={m.key} className="tr" style={{ borderBottom:"1px solid var(--border)" }}>
                        <td style={{ padding:"10px 16px", fontWeight:700, color:"var(--sub)" }}>{m.label}</td>
                        <td style={{ padding:"10px 16px", textAlign:"right", fontWeight:800, color:grn }}>{fINR(m.income)}</td>
                        <td style={{ padding:"10px 16px", textAlign:"right", fontWeight:800, color:red }}>{fINR(m.expense)}</td>
                        <td style={{ padding:"10px 16px", textAlign:"right", fontWeight:800,
                                     color: net >= 0 ? grn : red }}>
                          {net >= 0 ? "+" : ""}{fINR(net)}
                        </td>
                        <td style={{ padding:"10px 16px", textAlign:"right", fontWeight:800,
                                     color: +sr >= 20 ? grn : "#F59E0B" }}>
                          {sr}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>}
      </main>

      {/* ── ADD / EDIT MODAL ──────────────────────────────────────────────────── */}
      <Modal open={modal} onClose={() => setModal(false)}
        title={editTx ? "Edit Transaction" : "Add Transaction"}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <div style={{ gridColumn:"1/-1" }}>
            <label style={LBL}>Description</label>
            <input
              style={{ ...INP, borderColor: errs.description ? red : undefined }}
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="e.g. Zomato order"
            />
            {errs.description && <div style={{ fontSize:11, color:red, marginTop:3 }}>{errs.description}</div>}
          </div>
          <div>
            <label style={LBL}>Amount (₹)</label>
            <input type="number" min="0"
              style={{ ...INP, borderColor: errs.amount ? red : undefined }}
              value={form.amount}
              onChange={e => setForm({ ...form, amount: e.target.value })}
              placeholder="0.00"
            />
            {errs.amount && <div style={{ fontSize:11, color:red, marginTop:3 }}>{errs.amount}</div>}
          </div>
          <div>
            <label style={LBL}>Date</label>
            <input type="date"
              style={{ ...INP, borderColor: errs.date ? red : undefined }}
              value={form.date}
              onChange={e => setForm({ ...form, date: e.target.value })}
            />
            {errs.date && <div style={{ fontSize:11, color:red, marginTop:3 }}>{errs.date}</div>}
          </div>
          <div>
            <label style={LBL}>Type</label>
            <select style={INP} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </div>
          <div style={{ gridColumn:"1/-1" }}>
            <label style={LBL}>Category</label>
            <select style={INP} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map(c => <option key={c} value={c}>{ICONS[c]} {c}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display:"flex", gap:8, marginTop:"1.25rem", justifyContent:"flex-end" }}>
          <button onClick={() => setModal(false)}
            style={{ padding:"9px 18px", borderRadius:10, border:"1.5px solid var(--border)",
                     background:"transparent", color:"var(--sub)", cursor:"pointer",
                     fontSize:13, fontWeight:700, fontFamily:"inherit" }}>
            Cancel
          </button>
          <button className="ba" onClick={saveForm}
            style={{ padding:"9px 20px", borderRadius:10, background:acc, border:"none",
                     color:"#fff", fontWeight:800, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
            {editTx ? "Save Changes" : "Add Transaction"}
          </button>
        </div>
      </Modal>

      {/* ── DELETE CONFIRM ────────────────────────────────────────────────────── */}
      <Modal open={!!delId} onClose={() => setDelId(null)} title="Delete Transaction?">
        <p style={{ color:"var(--sub)", fontSize:14, lineHeight:1.6, marginBottom:"1.25rem" }}>
          This action cannot be undone. The transaction will be permanently removed.
        </p>
        <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
          <button onClick={() => setDelId(null)}
            style={{ padding:"9px 18px", borderRadius:10, border:"1.5px solid var(--border)",
                     background:"transparent", color:"var(--sub)", cursor:"pointer",
                     fontSize:13, fontWeight:700, fontFamily:"inherit" }}>
            Cancel
          </button>
          <button onClick={() => { setTxs(p => p.filter(t => t.id !== delId)); setDelId(null); }}
            style={{ padding:"9px 20px", borderRadius:10, background:red, border:"none",
                     color:"#fff", fontWeight:800, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
            Delete
          </button>
        </div>
      </Modal>

      {/* Role badge */}
      <div style={{
        position:"fixed", bottom:14, right:14,
        background: isAdmin ? acc : "var(--card)",
        color: isAdmin ? "#fff" : "var(--sub)",
        padding:"5px 12px", borderRadius:999, fontSize:11, fontWeight:800,
        border:"1px solid var(--border)", letterSpacing:"0.05em", zIndex:50,
        display:"flex", alignItems:"center", gap:5
      }}>
        {isAdmin ? "🛡 ADMIN" : "👤 VIEWER"}
      </div>
    </div>
  );
}
