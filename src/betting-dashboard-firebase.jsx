import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, update, remove, onValue } from "firebase/database";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const DISCORD_WEBHOOK = "YOUR_DISCORD_WEBHOOK_URL";
const ADMIN_KEY = "ADMIN-SECRET-2024";

// ─── FIREBASE ─────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyDWCocrc2qgY2idBQau9qzcmDp3EaRZEMQ",
  authDomain: "bettingbot-ca973.firebaseapp.com",
  databaseURL: "https://bettingbot-ca973-default-rtdb.firebaseio.com",
  projectId: "bettingbot-ca973",
  storageBucket: "bettingbot-ca973.firebasestorage.app",
  messagingSenderId: "485350620703",
  appId: "1:485350620703:web:9db4a712e30428b2e39f2a",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const fbGet = async (path) => {
  const snap = await get(ref(db, path));
  return snap.exists() ? snap.val() : null;
};
const fbSet = (path, val) => set(ref(db, path), val);
const fbUpdate = (path, val) => update(ref(db, path), val);
const fbRemove = (path) => remove(ref(db, path));
const fbListen = (path, cb) => onValue(ref(db, path), snap => cb(snap.exists() ? snap.val() : null));

// ─── DEFAULT SHAPES ───────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  stake: 10, maxDailyBets: 20, stopLoss: 100, targetProfit: 200,
  autoRestart: true, stealth: false, sites: [], strategy: "value",
  oddsMin: 1.5, oddsMax: 5.0, betDelay: 3, notifications: true,
  vpn: false, currency: "USD",
};
const DEFAULT_STATS = {
  balance: 1000, todayProfit: 0, totalProfit: 0, totalBets: 0,
  wonBets: 0, lostBets: 0, winRate: 0, avgOdds: 0, streak: 0,
  bestDay: 0, worstDay: 0, roi: 0, volume: 0, openBets: 0, pendingProfit: 0,
};
const emptyAccount = (key) => ({
  key, username: null, website: null, connected: false,
  settings: { ...DEFAULT_SETTINGS },
  stats: { ...DEFAULT_STATS },
  dailyReports: [],
  createdAt: Date.now(),
});

const SUPPORTED_SITES = [
  "Bet365","Betfair","William Hill","Pinnacle","1xBet","Unibet",
  "Betway","DraftKings","FanDuel","BetMGM","PointsBet","Bwin",
  "888sport","Coral","Ladbrokes","Paddy Power","Smarkets","Matchbook"
];
const STRATEGIES = [
  { id: "value", label: "Value Betting", desc: "Find edges where odds exceed true probability" },
  { id: "arb", label: "Arbitrage", desc: "Lock in profit across multiple bookmakers" },
  { id: "surebets", label: "Surebets", desc: "Zero-risk guaranteed returns" },
  { id: "middles", label: "Middles", desc: "Win both sides with line movement" },
  { id: "dutching", label: "Dutching", desc: "Back multiple outcomes proportionally" },
  { id: "kelly", label: "Kelly Criterion", desc: "Optimal stake sizing by edge" },
];

async function sendDiscord(content) {
  if (!DISCORD_WEBHOOK || DISCORD_WEBHOOK === "YOUR_DISCORD_WEBHOOK_URL") return;
  try {
    await fetch(DISCORD_WEBHOOK, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
  } catch (e) { console.warn("Discord webhook failed", e); }
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #050508; --bg2: #0a0a12; --bg3: #0f0f1a;
    --surface: #13131f; --surface2: #1a1a2e;
    --border: rgba(99,102,241,0.15); --border2: rgba(99,102,241,0.3);
    --accent: #6366f1; --accent2: #8b5cf6; --accent3: #06b6d4;
    --green: #10d98a; --red: #f43f5e; --orange: #f59e0b;
    --text: #e8e8f0; --text2: #9494b0; --text3: #5a5a78;
    --glow: 0 0 20px rgba(99,102,241,0.4); --glow2: 0 0 40px rgba(99,102,241,0.2);
  }
  body { background: var(--bg); color: var(--text); font-family: 'Syne', sans-serif; min-height: 100vh; overflow-x: hidden; }
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: var(--bg); }
  ::-webkit-scrollbar-thumb { background: var(--accent); border-radius: 10px; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
  @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
  @keyframes glow { 0%,100%{box-shadow:0 0 5px var(--accent)} 50%{box-shadow:0 0 25px var(--accent),0 0 50px var(--accent)} }
  @keyframes ticker { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
  @keyframes float { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-6px)} }
  @keyframes borderGlow { 0%,100%{border-color:rgba(99,102,241,0.3)} 50%{border-color:rgba(99,102,241,0.8)} }
  @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
`;

// ─── UI COMPONENTS ────────────────────────────────────────────────────────────
function BgEffects() {
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(99,102,241,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,0.04) 1px,transparent 1px)", backgroundSize: "40px 40px" }} />
      <div style={{ position: "absolute", top: "-20%", left: "50%", transform: "translateX(-50%)", width: "800px", height: "500px", background: "radial-gradient(ellipse,rgba(99,102,241,0.12) 0%,transparent 70%)" }} />
      <div style={{ position: "absolute", bottom: "-10%", right: "10%", width: "500px", height: "400px", background: "radial-gradient(ellipse,rgba(139,92,246,0.08) 0%,transparent 70%)" }} />
    </div>
  );
}

function StatusPill({ connected }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 16px", background: connected ? "rgba(16,217,138,0.1)" : "rgba(244,63,94,0.1)", border: `1px solid ${connected ? "rgba(16,217,138,0.4)" : "rgba(244,63,94,0.4)"}`, borderRadius: 100, fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", fontFamily: "'JetBrains Mono', monospace", color: connected ? "#10d98a" : "#f43f5e", animation: connected ? "borderGlow 2s ease-in-out infinite" : "none" }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: connected ? "#10d98a" : "#f43f5e", animation: connected ? "pulse 1.5s ease-in-out infinite" : "none", boxShadow: connected ? "0 0 8px #10d98a" : "none" }} />
      {connected ? "BOT CONNECTED" : "BOT OFFLINE"}
    </div>
  );
}

function StatCard({ label, value, color = "#6366f1", icon, delay = 0, prefix = "", suffix = "" }) {
  const [displayed, setDisplayed] = useState(0);
  const numVal = parseFloat(String(value).replace(/[^0-9.-]/g, "")) || 0;
  useEffect(() => {
    const duration = 1000, start = performance.now();
    const animate = (now) => {
      const p = Math.min((now - start) / duration, 1);
      setDisplayed(numVal * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(animate);
    };
    const t = setTimeout(() => requestAnimationFrame(animate), delay);
    return () => clearTimeout(t);
  }, [numVal, delay]);
  const fmt = (n) => {
    if (suffix === "%") return n.toFixed(1);
    if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + "k";
    return n.toFixed(2);
  };
  // Handle non-numeric display like "5/2"
  const isNumeric = !String(value).includes("/");
  return (
    <div style={{ background: "linear-gradient(135deg, var(--surface) 0%, var(--surface2) 100%)", border: "1px solid var(--border)", borderRadius: 16, padding: "20px 22px", position: "relative", overflow: "hidden", animation: `fadeUp 0.5s ease both`, animationDelay: `${delay}ms`, transition: "transform 0.2s, border-color 0.2s, box-shadow 0.2s", cursor: "default" }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.borderColor = color; e.currentTarget.style.boxShadow = `0 8px 30px ${color}22`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${color}, transparent)` }} />
      <div style={{ position: "absolute", top: 16, right: 16, fontSize: 22, opacity: 0.3 }}>{icon}</div>
      <div style={{ fontSize: 11, color: "var(--text3)", letterSpacing: "0.1em", marginBottom: 8, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-0.02em" }}>
        {isNumeric ? `${prefix}${fmt(displayed)}${suffix}` : value}
      </div>
    </div>
  );
}

function Toggle({ value, onChange, label }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
      <div onClick={() => onChange(!value)} style={{ width: 44, height: 24, borderRadius: 12, background: value ? "var(--accent)" : "var(--surface2)", border: `1px solid ${value ? "var(--accent)" : "var(--border)"}`, position: "relative", transition: "all 0.3s", boxShadow: value ? "var(--glow)" : "none", flexShrink: 0 }}>
        <div style={{ position: "absolute", top: 3, left: value ? 23 : 3, width: 16, height: 16, borderRadius: "50%", background: "white", transition: "left 0.3s", boxShadow: "0 1px 4px rgba(0,0,0,0.4)" }} />
      </div>
      <span style={{ fontSize: 13, color: "var(--text2)" }}>{label}</span>
    </label>
  );
}

function Slider({ label, value, min, max, step = 1, onChange, prefix = "", suffix = "", color = "#6366f1" }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: "var(--text2)" }}>{label}</span>
        <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color, fontWeight: 600 }}>{prefix}{value}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} style={{ width: "100%", height: 4, borderRadius: 2, appearance: "none", outline: "none", background: `linear-gradient(90deg, ${color} ${((value - min) / (max - min)) * 100}%, var(--surface2) 0%)`, cursor: "pointer" }} />
    </div>
  );
}

function SiteCheckbox({ site, checked, onChange }) {
  return (
    <div onClick={() => onChange(!checked)} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${checked ? "var(--accent)" : "var(--border)"}`, background: checked ? "rgba(99,102,241,0.15)" : "transparent", cursor: "pointer", fontSize: 12, fontWeight: 600, color: checked ? "var(--accent)" : "var(--text2)", transition: "all 0.2s", userSelect: "none" }}>
      {checked ? "✓ " : ""}{site}
    </div>
  );
}

function TabBtn({ label, active, onClick, icon }) {
  return (
    <button onClick={onClick} style={{ padding: "10px 20px", borderRadius: 10, border: active ? "1px solid var(--accent)" : "1px solid transparent", background: active ? "rgba(99,102,241,0.15)" : "transparent", color: active ? "var(--accent)" : "var(--text2)", cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.2s", display: "flex", alignItems: "center", gap: 6, boxShadow: active ? "var(--glow)" : "none" }}>
      <span>{icon}</span>{label}
    </button>
  );
}

function FieldInput({ label, value, onChange, type = "text", placeholder = "", readonly = false, mono = false }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <div style={{ fontSize: 11, color: "var(--text3)", letterSpacing: "0.08em", marginBottom: 6, fontWeight: 600 }}>{label}</div>}
      <input type={type} value={value} onChange={e => onChange?.(e.target.value)} readOnly={readonly} placeholder={placeholder}
        style={{ width: "100%", background: readonly ? "var(--bg2)" : "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", color: readonly ? "var(--text2)" : "var(--text)", fontSize: 13, fontFamily: mono ? "'JetBrains Mono', monospace" : "inherit", outline: "none", transition: "border-color 0.2s, box-shadow 0.2s" }}
        onFocus={e => { if (!readonly) { e.target.style.borderColor = "var(--accent)"; e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.15)"; } }}
        onBlur={e => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
      />
    </div>
  );
}

function FieldSelect({ label, value, onChange, options }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <div style={{ fontSize: 11, color: "var(--text3)", letterSpacing: "0.08em", marginBottom: 6, fontWeight: 600 }}>{label}</div>}
      <select value={value} onChange={e => onChange(e.target.value)} style={{ width: "100%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", color: "var(--text)", fontSize: 13, outline: "none", cursor: "pointer" }}>
        {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Btn({ children, onClick, variant = "primary", size = "md", disabled = false, fullWidth = false }) {
  const colors = {
    primary: { bg: "var(--accent)", color: "white", hover: "#4f46e5" },
    ghost: { bg: "transparent", color: "var(--accent)", hover: "rgba(99,102,241,0.1)" },
    danger: { bg: "rgba(244,63,94,0.15)", color: "#f43f5e", hover: "rgba(244,63,94,0.25)" },
    success: { bg: "rgba(16,217,138,0.15)", color: "#10d98a", hover: "rgba(16,217,138,0.25)" },
  };
  const c = colors[variant];
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ padding: size === "sm" ? "7px 14px" : "11px 22px", borderRadius: 10, border: `1px solid ${variant === "primary" ? "transparent" : "currentColor"}`, background: c.bg, color: c.color, fontSize: size === "sm" ? 12 : 14, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, transition: "all 0.2s", fontFamily: "inherit", width: fullWidth ? "100%" : "auto", letterSpacing: "0.02em" }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = c.hover; }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.background = c.bg; }}>
      {children}
    </button>
  );
}

function Ticker({ account }) {
  const s = account?.stats || DEFAULT_STATS;
  const items = account ? [
    `💰 Balance: $${s.balance.toFixed(2)}`,
    `📈 Today: ${s.todayProfit >= 0 ? "+" : ""}$${s.todayProfit.toFixed(2)}`,
    `🎯 Win Rate: ${s.winRate.toFixed(1)}%`,
    `📊 Total Bets: ${s.totalBets}`,
    `🔥 Streak: ${s.streak}`,
    `💹 ROI: ${s.roi.toFixed(1)}%`,
    `⚡ Open Bets: ${s.openBets}`,
    `🏆 Best Day: +$${s.bestDay.toFixed(2)}`,
  ] : ["🤖 BettingBot Pro — Enter your key to access your dashboard"];
  const text = [...items, ...items].join("   •   ");
  return (
    <div style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", padding: "8px 0", overflow: "hidden" }}>
      <div style={{ display: "inline-block", whiteSpace: "nowrap", animation: "ticker 30s linear infinite", fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "var(--text2)", letterSpacing: "0.05em" }}>{text}</div>
    </div>
  );
}

function ReportRow({ r }) {
  const pos = r.profit >= 0;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 1fr 1fr 1fr 1fr", gap: 12, padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", alignItems: "center", transition: "background 0.2s" }}
      onMouseEnter={e => e.currentTarget.style.background = "var(--surface2)"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
      <span style={{ color: "var(--text3)" }}>{r.date}</span>
      <span style={{ color: pos ? "#10d98a" : "#f43f5e", fontWeight: 700 }}>{pos ? "+" : ""}${r.profit.toFixed(2)}</span>
      <span style={{ color: "var(--text2)" }}>{r.bets} bets</span>
      <span style={{ color: "#6366f1" }}>{r.winRate.toFixed(0)}% WR</span>
      <span style={{ color: "var(--text2)" }}>${r.volume.toFixed(0)} vol</span>
      <span style={{ color: "var(--orange)" }}>{r.site || "Multi"}</span>
    </div>
  );
}

// ─── KEY SCREEN ───────────────────────────────────────────────────────────────
function KeyScreen({ onEnter }) {
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handleSubmit = async () => {
    const k = key.trim();
    if (!k) return setErr("Enter your access key");
    setLoading(true);
    setErr("");
    try {
      const acc = await fbGet(`accounts/${k}`);
      if (acc) {
        onEnter(k, acc);
      } else {
        setErr("Invalid key. Contact your administrator.");
      }
    } catch (e) {
      setErr("Connection error. Check your internet and try again.");
      console.error(e);
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1 }}>
      <div style={{ width: "100%", maxWidth: 440, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 24, padding: 40, animation: "fadeUp 0.6s ease both", boxShadow: "0 40px 80px rgba(0,0,0,0.5), var(--glow2)" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg, var(--accent), var(--accent2))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 16px", boxShadow: "var(--glow), 0 8px 20px rgba(0,0,0,0.4)", animation: "float 3s ease-in-out infinite" }}>⚡</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em" }}>BettingBot Pro</h1>
          <p style={{ color: "var(--text3)", fontSize: 13, marginTop: 6 }}>Enter your access key to continue</p>
        </div>
        <div style={{ marginBottom: 20 }}>
          <input type="text" value={key} onChange={e => setKey(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} placeholder="XXXX-XXXX-XXXX-XXXX"
            style={{ width: "100%", background: "var(--bg2)", border: `1px solid ${err ? "var(--red)" : "var(--border)"}`, borderRadius: 12, padding: "14px 18px", color: "var(--text)", fontSize: 16, fontFamily: "'JetBrains Mono', monospace", outline: "none", letterSpacing: "0.1em", textAlign: "center", transition: "all 0.2s" }}
            onFocus={e => { e.target.style.borderColor = "var(--accent)"; e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.2)"; }}
            onBlur={e => { e.target.style.borderColor = err ? "var(--red)" : "var(--border)"; e.target.style.boxShadow = "none"; }} />
          {err && <div style={{ color: "var(--red)", fontSize: 12, marginTop: 8, textAlign: "center" }}>{err}</div>}
        </div>
        <Btn onClick={handleSubmit} disabled={loading} fullWidth>{loading ? "⟳ Verifying..." : "Access Dashboard →"}</Btn>
        <div style={{ marginTop: 24, padding: 14, borderRadius: 10, background: "rgba(99,102,241,0.08)", border: "1px solid var(--border)", fontSize: 11, color: "var(--text3)", textAlign: "center", lineHeight: 1.6 }}>
          Keys are provided by the administrator.<br />Each key is linked to a single account and website.
        </div>
      </div>
    </div>
  );
}

// ─── SETUP SCREEN ─────────────────────────────────────────────────────────────
function SetupScreen({ keyVal, onComplete }) {
  const [username, setUsername] = useState("");
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handleSetup = async () => {
    if (!username.trim() || !website.trim()) return setErr("Both fields are required");
    setLoading(true);
    try {
      const existing = await fbGet(`accounts/${keyVal}`);
      const acc = { ...existing, username: username.trim(), website: website.trim() };
      await fbSet(`accounts/${keyVal}`, acc);
      await sendDiscord(`🆕 **New User Setup**\n> **Key:** \`${keyVal}\`\n> **Username:** ${username}\n> **Website:** ${website}\n> **Time:** ${new Date().toUTCString()}`);
      onComplete(acc);
    } catch (e) {
      setErr("Failed to save. Check your connection.");
      console.error(e);
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1 }}>
      <div style={{ width: "100%", maxWidth: 440, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 24, padding: 40, animation: "fadeUp 0.6s ease both", boxShadow: "0 40px 80px rgba(0,0,0,0.5)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔑</div>
          <h2 style={{ fontSize: 22, fontWeight: 800 }}>First Time Setup</h2>
          <p style={{ color: "var(--text3)", fontSize: 13, marginTop: 6 }}>Set up your account. This can only be done once.</p>
        </div>
        <div style={{ padding: 14, borderRadius: 10, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", fontSize: 12, color: "var(--orange)", marginBottom: 20 }}>
          ⚠️ Your username and website cannot be changed after setup.
        </div>
        <FieldInput label="USERNAME" value={username} onChange={setUsername} placeholder="your_username" />
        <FieldInput label="BETTING WEBSITE" value={website} onChange={setWebsite} placeholder="e.g. Bet365, Betfair..." />
        {err && <div style={{ color: "var(--red)", fontSize: 12, marginBottom: 12 }}>{err}</div>}
        <Btn onClick={handleSetup} disabled={loading || !username || !website} fullWidth>{loading ? "Setting up..." : "Complete Setup →"}</Btn>
      </div>
    </div>
  );
}

// ─── ADMIN PANEL ──────────────────────────────────────────────────────────────
function AdminPanel({ onClose }) {
  const [tab, setTab] = useState("keys");
  const [store, setStore] = useState({});
  const [newKey, setNewKey] = useState("");
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("success");
  const [repKey, setRepKey] = useState("");
  const [report, setReport] = useState({ date: new Date().toISOString().split("T")[0], profit: 0, bets: 10, winRate: 60, volume: 200, site: "" });
  const [editKey, setEditKey] = useState("");
  const [editStats, setEditStats] = useState(null);
  const [discordKey, setDiscordKey] = useState("");
  const [discordAction, setDiscordAction] = useState("running");

  const refresh = async () => {
    const data = await fbGet("accounts");
    setStore(data || {});
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, []);

  const flash = (text, type = "success") => { setMsg(text); setMsgType(type); setTimeout(() => setMsg(""), 3500); };

  const genKey = () => setNewKey(Array.from({ length: 4 }, () => Math.random().toString(36).substr(2, 4).toUpperCase()).join("-"));

  const saveKey = async () => {
    if (!newKey) return;
    await fbSet(`accounts/${newKey}`, emptyAccount(newKey));
    await refresh();
    flash(`Key ${newKey} created!`);
    setNewKey("");
  };

  const deleteKey = async (k) => {
    if (!confirm(`Delete key ${k}? This cannot be undone.`)) return;
    await fbRemove(`accounts/${k}`);
    await refresh();
    flash(`Key ${k} deleted`, "warn");
  };

  const addReport = async () => {
    if (!repKey) return flash("Select a user first", "warn");
    const acc = await fbGet(`accounts/${repKey}`);
    if (!acc) return flash("User not found", "warn");
    const stats = { ...DEFAULT_STATS, ...acc.stats };
    const dailyReports = [{ ...report }, ...(acc.dailyReports || [])];
    stats.todayProfit = report.profit;
    stats.totalProfit += report.profit;
    stats.totalBets += report.bets;
    stats.wonBets += Math.round(report.bets * report.winRate / 100);
    stats.lostBets += Math.round(report.bets * (1 - report.winRate / 100));
    stats.balance += report.profit;
    stats.volume += report.volume;
    if (report.profit > stats.bestDay) stats.bestDay = report.profit;
    if (report.profit < stats.worstDay) stats.worstDay = report.profit;
    stats.winRate = stats.totalBets > 0 ? (stats.wonBets / stats.totalBets) * 100 : report.winRate;
    stats.roi = stats.volume > 0 ? (stats.totalProfit / stats.volume) * 100 : 0;
    await fbUpdate(`accounts/${repKey}`, { stats, dailyReports });
    await refresh();
    flash("Daily report added & stats updated ✓");
  };

  const deleteReport = async (key, idx) => {
    const acc = await fbGet(`accounts/${key}`);
    const dailyReports = [...(acc.dailyReports || [])];
    dailyReports.splice(idx, 1);
    await fbUpdate(`accounts/${key}`, { dailyReports });
    await refresh();
    flash("Report deleted");
  };

  const loadEditStats = async (key) => {
    setEditKey(key);
    if (!key) return;
    const acc = await fbGet(`accounts/${key}`);
    if (acc) setEditStats({ ...DEFAULT_STATS, ...acc.stats });
  };

  const saveEditStats = async () => {
    if (!editKey || !editStats) return;
    await fbUpdate(`accounts/${editKey}/stats`, editStats);
    await refresh();
    flash("Stats saved for " + (store[editKey]?.username || editKey) + " ✓");
  };

  const handleDiscordCommand = async () => {
    if (!discordKey) return flash("Enter a key", "warn");
    const acc = await fbGet(`accounts/${discordKey}`);
    if (!acc) return flash("Key not found", "warn");
    await fbUpdate(`accounts/${discordKey}`, { connected: discordAction === "running" });
    await refresh();
    flash(`${discordKey} → ${discordAction === "running" ? "CONNECTED" : "OFFLINE"}`);
  };

  const accounts = Object.values(store);
  const setupAccounts = accounts.filter(a => a.username);

  const statFields = [
    { key: "balance", label: "Balance ($)" }, { key: "todayProfit", label: "Today's Profit ($)" },
    { key: "totalProfit", label: "Total Profit ($)" }, { key: "totalBets", label: "Total Bets" },
    { key: "wonBets", label: "Won Bets" }, { key: "lostBets", label: "Lost Bets" },
    { key: "winRate", label: "Win Rate (%)" }, { key: "avgOdds", label: "Avg Odds" },
    { key: "streak", label: "Current Streak" }, { key: "bestDay", label: "Best Day ($)" },
    { key: "worstDay", label: "Worst Day ($)" }, { key: "roi", label: "ROI (%)" },
    { key: "volume", label: "Volume ($)" }, { key: "openBets", label: "Open Bets" },
    { key: "pendingProfit", label: "Pending Profit ($)" },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.88)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 900, maxHeight: "94vh", background: "var(--bg2)", border: "1px solid var(--border2)", borderRadius: 20, overflow: "hidden", display: "flex", flexDirection: "column", animation: "fadeUp 0.3s ease" }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(135deg, rgba(99,102,241,0.12), transparent)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>🛡️</span>
            <h2 style={{ fontSize: 18, fontWeight: 800 }}>Admin Panel</h2>
            <span style={{ fontSize: 11, color: "var(--text3)", fontFamily: "monospace", marginLeft: 8 }}>{accounts.length} keys · {setupAccounts.length} active</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text2)", cursor: "pointer", fontSize: 22 }}>✕</button>
        </div>

        <div style={{ display: "flex", gap: 6, padding: "10px 24px", borderBottom: "1px solid var(--border)", flexShrink: 0, flexWrap: "wrap" }}>
          {[{ id: "keys", label: "Keys", icon: "🔑" }, { id: "stats", label: "Edit Stats", icon: "✏️" }, { id: "reports", label: "Daily Reports", icon: "📊" }, { id: "discord", label: "Discord Cmd", icon: "🤖" }].map(t => <TabBtn key={t.id} label={t.label} icon={t.icon} active={tab === t.id} onClick={() => setTab(t.id)} />)}
        </div>

        {msg && (
          <div style={{ padding: "9px 24px", fontSize: 13, flexShrink: 0, background: msgType === "warn" ? "rgba(245,158,11,0.1)" : "rgba(16,217,138,0.1)", borderBottom: `1px solid ${msgType === "warn" ? "rgba(245,158,11,0.25)" : "rgba(16,217,138,0.2)"}`, color: msgType === "warn" ? "var(--orange)" : "#10d98a" }}>
            {msgType === "warn" ? "⚠️" : "✓"} {msg}
          </div>
        )}

        <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>

          {tab === "keys" && (
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: "var(--text2)" }}>GENERATE NEW KEY</h3>
              <div style={{ display: "flex", gap: 10, marginBottom: 28 }}>
                <input value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="Click Generate or type custom key"
                  style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", color: "var(--text)", fontSize: 14, fontFamily: "'JetBrains Mono', monospace", outline: "none" }} />
                <Btn onClick={genKey} variant="ghost">Generate</Btn>
                <Btn onClick={saveKey} disabled={!newKey}>Save Key</Btn>
              </div>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "var(--text2)" }}>ALL KEYS ({accounts.length})</h3>
              {accounts.length === 0 && <div style={{ color: "var(--text3)", fontSize: 13, textAlign: "center", padding: 40 }}>No keys yet. Generate one above.</div>}
              {accounts.map(acc => (
                <div key={acc.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border)", marginBottom: 8, background: "var(--surface)" }}>
                  <div>
                    <span style={{ fontFamily: "monospace", color: "var(--accent)", fontWeight: 700, fontSize: 14, marginRight: 14 }}>{acc.key}</span>
                    <span style={{ fontSize: 12, color: "var(--text3)" }}>{acc.username ? `${acc.username} · ${acc.website}` : "⏳ Not setup yet"}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 11, fontFamily: "monospace", color: acc.connected ? "#10d98a" : "var(--text3)" }}>{acc.connected ? "● LIVE" : "○ OFFLINE"}</span>
                    {acc.username && acc.stats && <span style={{ fontSize: 11, color: "var(--text3)", fontFamily: "monospace" }}>${(acc.stats.balance || 0).toFixed(0)}</span>}
                    <Btn onClick={() => deleteKey(acc.key)} variant="danger" size="sm">Delete</Btn>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "stats" && (
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: "var(--text2)" }}>DIRECTLY EDIT USER STATS</h3>
              <p style={{ fontSize: 12, color: "var(--text3)", marginBottom: 18, lineHeight: 1.6 }}>Select a user, edit any value, then click Save. Changes appear instantly on their dashboard.</p>
              <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
                <select value={editKey} onChange={e => loadEditStats(e.target.value)} style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", color: "var(--text)", fontSize: 13, outline: "none", cursor: "pointer" }}>
                  <option value="">-- Select a user --</option>
                  {setupAccounts.map(a => <option key={a.key} value={a.key}>{a.username} ({a.key})</option>)}
                </select>
                {editKey && <Btn onClick={saveEditStats} variant="success">💾 Save All Stats</Btn>}
              </div>
              {!editKey && <div style={{ textAlign: "center", padding: 40, color: "var(--text3)", fontSize: 13 }}>Select a user above to edit their stats</div>}
              {editKey && editStats && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    {statFields.map(({ key, label }) => (
                      <div key={key}>
                        <div style={{ fontSize: 10, color: "var(--text3)", letterSpacing: "0.08em", marginBottom: 5, fontWeight: 600 }}>{label}</div>
                        <input type="number" value={editStats[key] ?? 0} onChange={e => setEditStats(p => ({ ...p, [key]: Number(e.target.value) }))} step="0.01"
                          style={{ width: "100%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", color: "var(--accent)", fontSize: 13, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, outline: "none" }}
                          onFocus={e => e.target.style.borderColor = "var(--accent)"}
                          onBlur={e => e.target.style.borderColor = "var(--border)"} />
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 20 }}>
                    <Btn onClick={saveEditStats} fullWidth variant="success">💾 Save All Stats for {setupAccounts.find(a => a.key === editKey)?.username}</Btn>
                  </div>
                </>
              )}
            </div>
          )}

          {tab === "reports" && (
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, color: "var(--text2)" }}>ADD DAILY REPORT</h3>
              <p style={{ fontSize: 12, color: "var(--text3)", marginBottom: 16 }}>Adding a report automatically updates the user's cumulative stats.</p>
              <FieldSelect label="SELECT USER" value={repKey} onChange={setRepKey} options={[{ id: "", label: "-- Select a user --" }, ...setupAccounts.map(a => ({ id: a.key, label: `${a.username} (${a.key})` }))]} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
                {[{ label: "DATE", key: "date", type: "date" }, { label: "PROFIT / LOSS ($)", key: "profit", type: "number" }, { label: "TOTAL BETS", key: "bets", type: "number" }, { label: "WIN RATE (%)", key: "winRate", type: "number" }, { label: "VOLUME ($)", key: "volume", type: "number" }, { label: "SITE", key: "site", type: "text" }].map(({ label, key, type }) => (
                  <div key={key}>
                    <div style={{ fontSize: 10, color: "var(--text3)", letterSpacing: "0.08em", marginBottom: 5, fontWeight: 600 }}>{label}</div>
                    <input type={type} value={report[key]} onChange={e => setReport(r => ({ ...r, [key]: type === "number" ? Number(e.target.value) : e.target.value }))} placeholder={key === "site" ? "Bet365" : ""}
                      style={{ width: "100%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", color: "var(--text)", fontSize: 13, outline: "none" }}
                      onFocus={e => e.target.style.borderColor = "var(--accent)"}
                      onBlur={e => e.target.style.borderColor = "var(--border)"} />
                  </div>
                ))}
              </div>
              <Btn onClick={addReport} disabled={!repKey} fullWidth>➕ Add Report & Update Stats</Btn>
              {repKey && (() => {
                const reports = store[repKey]?.dailyReports || [];
                return reports.length > 0 ? (
                  <div style={{ marginTop: 24 }}>
                    <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: "var(--text2)" }}>EXISTING REPORTS FOR {store[repKey]?.username?.toUpperCase()} ({reports.length})</h4>
                    <div style={{ background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "110px 90px 70px 80px 90px 90px 36px", gap: 8, padding: "8px 14px", background: "var(--bg2)", fontSize: 10, color: "var(--text3)", letterSpacing: "0.08em", fontWeight: 600 }}>
                        <span>DATE</span><span>PROFIT</span><span>BETS</span><span>WIN RATE</span><span>VOLUME</span><span>SITE</span><span></span>
                      </div>
                      {reports.map((r, i) => (
                        <div key={i} style={{ display: "grid", gridTemplateColumns: "110px 90px 70px 80px 90px 90px 36px", gap: 8, padding: "10px 14px", borderTop: "1px solid var(--border)", fontSize: 12, fontFamily: "monospace", alignItems: "center" }}>
                          <span style={{ color: "var(--text3)" }}>{r.date}</span>
                          <span style={{ color: r.profit >= 0 ? "#10d98a" : "#f43f5e", fontWeight: 700 }}>{r.profit >= 0 ? "+" : ""}${r.profit.toFixed(2)}</span>
                          <span>{r.bets}</span>
                          <span style={{ color: "var(--accent)" }}>{r.winRate}%</span>
                          <span>${r.volume}</span>
                          <span style={{ color: "var(--text3)" }}>{r.site || "Multi"}</span>
                          <button onClick={() => deleteReport(repKey, i)} style={{ background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.3)", borderRadius: 6, color: "#f43f5e", cursor: "pointer", fontSize: 13, padding: "2px 6px" }}>✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
          )}

          {tab === "discord" && (
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: "var(--text2)" }}>DISCORD BOT COMMANDS</h3>
              <p style={{ fontSize: 12, color: "var(--text3)", marginBottom: 20, lineHeight: 1.7 }}>Simulate <code style={{ color: "var(--accent)" }}>/running (key)</code> and <code style={{ color: "var(--accent)" }}>/stop (key)</code> here.</p>
              <FieldInput label="USER KEY" value={discordKey} onChange={setDiscordKey} placeholder="USER-KEY-HERE" mono />
              <FieldSelect label="COMMAND" value={discordAction} onChange={setDiscordAction} options={[{ id: "running", label: "🟢 /running — Mark bot as Connected" }, { id: "stop", label: "🔴 /stop — Mark bot as Offline" }]} />
              <Btn onClick={handleDiscordCommand} disabled={!discordKey} fullWidth>Execute Command</Btn>
              <div style={{ marginTop: 24, padding: 18, background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", letterSpacing: "0.08em", marginBottom: 10 }}>ALL USER STATUS</div>
                {setupAccounts.length === 0 && <div style={{ color: "var(--text3)", fontSize: 12 }}>No active users</div>}
                {setupAccounts.map(acc => (
                  <div key={acc.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ fontSize: 13 }}>{acc.username}</span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Btn size="sm" variant={acc.connected ? "ghost" : "success"} onClick={async () => { await fbUpdate(`accounts/${acc.key}`, { connected: true }); await refresh(); flash(`${acc.username} → CONNECTED`); }}>Connect</Btn>
                      <Btn size="sm" variant={!acc.connected ? "ghost" : "danger"} onClick={async () => { await fbUpdate(`accounts/${acc.key}`, { connected: false }); await refresh(); flash(`${acc.username} → OFFLINE`); }}>Stop</Btn>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
function Dashboard({ account: initAccount, keyVal, onLogout }) {
  const [account, setAccount] = useState(initAccount);
  const [tab, setTab] = useState("overview");
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS, ...(initAccount.settings || {}) });
  const [saved, setSaved] = useState(false);
  const [sending, setSending] = useState(false);

  // Live listener — updates dashboard instantly when admin changes anything
  useEffect(() => {
    const unsub = fbListen(`accounts/${keyVal}`, (data) => {
      if (data) {
        setAccount(data);
        setSettings({ ...DEFAULT_SETTINGS, ...(data.settings || {}) });
      }
    });
    return () => unsub();
  }, [keyVal]);

  const saveSettings = async () => {
    setSending(true);
    await fbUpdate(`accounts/${keyVal}`, { settings });
    await sendDiscord(
      `⚙️ **Settings Updated**\n> **User:** ${account.username} (\`${keyVal}\`)\n> **Strategy:** ${settings.strategy}\n> **Stake:** $${settings.stake}\n> **Stop Loss:** $${settings.stopLoss}\n> **Target:** $${settings.targetProfit}\n> **Time:** ${new Date().toUTCString()}`
    );
    setSending(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const updateSetting = (k, v) => setSettings(s => ({ ...s, [k]: v }));
  const toggleSite = (site, checked) => setSettings(s => ({ ...s, sites: checked ? [...(s.sites || []), site] : (s.sites || []).filter(x => x !== site) }));

  const stats = { ...DEFAULT_STATS, ...(account.stats || {}) };
  const reports = Array.isArray(account.dailyReports) ? account.dailyReports : [];

  const TABS = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "settings", label: "Settings", icon: "⚙️" },
    { id: "reports", label: "Reports", icon: "📋" },
    { id: "analytics", label: "Analytics", icon: "📈" },
  ];

  return (
    <div style={{ position: "relative", zIndex: 1, minHeight: "100vh" }}>
      <header style={{ background: "rgba(10,10,18,0.9)", backdropFilter: "blur(20px)", borderBottom: "1px solid var(--border)", padding: "0 24px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, var(--accent), var(--accent2))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, boxShadow: "var(--glow)" }}>⚡</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.02em" }}>BettingBot Pro</div>
              <div style={{ fontSize: 10, color: "var(--text3)", fontFamily: "monospace" }}>{account.username} • {account.website}</div>
            </div>
            <StatusPill connected={account.connected} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 11, color: "var(--text3)", fontFamily: "monospace" }}>KEY: {keyVal}</span>
            <Btn onClick={onLogout} variant="ghost" size="sm">Logout</Btn>
          </div>
        </div>
      </header>

      <Ticker account={account} />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 24px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 28, flexWrap: "wrap" }}>
          {TABS.map(t => <TabBtn key={t.id} label={t.label} icon={t.icon} active={tab === t.id} onClick={() => setTab(t.id)} />)}
        </div>

        {tab === "overview" && (
          <div style={{ animation: "fadeUp 0.4s ease" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 28 }}>
              <StatCard label="BALANCE" value={stats.balance} prefix="$" color="#10d98a" icon="💰" delay={0} />
              <StatCard label="TODAY'S P&L" value={stats.todayProfit} prefix={stats.todayProfit >= 0 ? "+$" : "-$"} color={stats.todayProfit >= 0 ? "#10d98a" : "#f43f5e"} icon="📈" delay={50} />
              <StatCard label="TOTAL PROFIT" value={stats.totalProfit} prefix="$" color="#6366f1" icon="💹" delay={100} />
              <StatCard label="WIN RATE" value={stats.winRate} suffix="%" color="#f59e0b" icon="🎯" delay={150} />
              <StatCard label="TOTAL BETS" value={stats.totalBets} color="#06b6d4" icon="🎲" delay={200} />
              <StatCard label="WON / LOST" value={`${stats.wonBets}/${stats.lostBets}`} color="#8b5cf6" icon="⚔️" delay={250} />
              <StatCard label="ROI" value={stats.roi} suffix="%" color="#f43f5e" icon="📊" delay={300} />
              <StatCard label="OPEN BETS" value={stats.openBets} color="#f59e0b" icon="⚡" delay={350} />
              <StatCard label="PENDING" value={stats.pendingProfit} prefix="$" color="#06b6d4" icon="⏳" delay={400} />
              <StatCard label="STREAK" value={stats.streak} suffix=" W" color="#10d98a" icon="🔥" delay={450} />
              <StatCard label="BEST DAY" value={stats.bestDay} prefix="+$" color="#10d98a" icon="🏆" delay={500} />
              <StatCard label="WORST DAY" value={Math.abs(stats.worstDay)} prefix="-$" color="#f43f5e" icon="📉" delay={550} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
                <div style={{ fontSize: 11, color: "var(--text3)", letterSpacing: "0.1em", marginBottom: 16, fontWeight: 600 }}>ACTIVE CONFIGURATION</div>
                {[
                  ["Strategy", STRATEGIES.find(s => s.id === settings.strategy)?.label || settings.strategy],
                  ["Stake Size", `$${settings.stake}`],
                  ["Daily Bet Limit", settings.maxDailyBets],
                  ["Stop Loss", `$${settings.stopLoss}`],
                  ["Target Profit", `$${settings.targetProfit}`],
                  ["Odds Range", `${settings.oddsMin} – ${settings.oddsMax}`],
                  ["Auto Restart", settings.autoRestart ? "✓ Enabled" : "✗ Disabled"],
                  ["Stealth Mode", settings.stealth ? "✓ Active" : "✗ Off"],
                  ["VPN", settings.vpn ? "✓ Active" : "✗ Off"],
                  ["Currency", settings.currency],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                    <span style={{ color: "var(--text2)" }}>{k}</span>
                    <span style={{ fontWeight: 600, fontFamily: "monospace", color: "var(--accent)" }}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
                <div style={{ fontSize: 11, color: "var(--text3)", letterSpacing: "0.1em", marginBottom: 16, fontWeight: 600 }}>ACTIVE SITES ({(settings.sites || []).length})</div>
                {(settings.sites || []).length === 0 ? (
                  <div style={{ color: "var(--text3)", fontSize: 13, textAlign: "center", padding: 20 }}>No sites selected — go to Settings to add</div>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {(settings.sites || []).map(s => <span key={s} style={{ padding: "6px 12px", borderRadius: 8, background: "rgba(99,102,241,0.15)", border: "1px solid var(--accent)", fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>{s}</span>)}
                  </div>
                )}
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 11, color: "var(--text3)", letterSpacing: "0.1em", marginBottom: 12, fontWeight: 600 }}>RECENT ACTIVITY</div>
                  {reports.slice(0, 5).length === 0 ? <div style={{ color: "var(--text3)", fontSize: 12 }}>No activity yet</div> : reports.slice(0, 5).map((r, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
                      <span style={{ color: "var(--text3)" }}>{r.date}</span>
                      <span style={{ color: r.profit >= 0 ? "#10d98a" : "#f43f5e", fontWeight: 700 }}>{r.profit >= 0 ? "+" : ""}${r.profit.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "settings" && (
          <div style={{ animation: "fadeUp 0.4s ease" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div>
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20, marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, color: "var(--accent)" }}>⚡ BETTING STRATEGY</div>
                  {STRATEGIES.map(s => (
                    <div key={s.id} onClick={() => updateSetting("strategy", s.id)} style={{ padding: "12px 14px", borderRadius: 10, marginBottom: 8, cursor: "pointer", border: `1px solid ${settings.strategy === s.id ? "var(--accent)" : "var(--border)"}`, background: settings.strategy === s.id ? "rgba(99,102,241,0.12)" : "transparent", transition: "all 0.2s" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: settings.strategy === s.id ? "var(--accent)" : "var(--text)" }}>{s.label}</div>
                      <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{s.desc}</div>
                    </div>
                  ))}
                </div>
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20, marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, color: "#f59e0b" }}>🎯 RISK MANAGEMENT</div>
                  <Slider label="Stake Size" value={settings.stake} min={1} max={500} step={1} onChange={v => updateSetting("stake", v)} prefix="$" color="#6366f1" />
                  <Slider label="Max Daily Bets" value={settings.maxDailyBets} min={1} max={100} onChange={v => updateSetting("maxDailyBets", v)} color="#f59e0b" />
                  <Slider label="Stop Loss" value={settings.stopLoss} min={10} max={2000} step={10} onChange={v => updateSetting("stopLoss", v)} prefix="$" color="#f43f5e" />
                  <Slider label="Target Profit" value={settings.targetProfit} min={10} max={5000} step={10} onChange={v => updateSetting("targetProfit", v)} prefix="$" color="#10d98a" />
                  <Slider label="Bet Delay (sec)" value={settings.betDelay} min={0} max={30} onChange={v => updateSetting("betDelay", v)} suffix="s" color="#06b6d4" />
                </div>
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, color: "#06b6d4" }}>📐 ODDS FILTER</div>
                  <Slider label="Min Odds" value={settings.oddsMin} min={1.01} max={5} step={0.05} onChange={v => updateSetting("oddsMin", v)} color="#6366f1" />
                  <Slider label="Max Odds" value={settings.oddsMax} min={1.5} max={50} step={0.5} onChange={v => updateSetting("oddsMax", v)} color="#8b5cf6" />
                  <FieldSelect label="CURRENCY" value={settings.currency} onChange={v => updateSetting("currency", v)} options={["USD","EUR","GBP","AUD","CAD","BTC"].map(c => ({ id: c, label: c }))} />
                </div>
              </div>
              <div>
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20, marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: "#10d98a" }}>🌐 SUPPORTED BOOKMAKERS</div>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 14 }}>Select all sites you want the bot to operate on</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {SUPPORTED_SITES.map(s => <SiteCheckbox key={s} site={s} checked={(settings.sites || []).includes(s)} onChange={v => toggleSite(s, v)} />)}
                  </div>
                </div>
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20, marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, color: "#8b5cf6" }}>🤖 BOT OPTIONS</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <Toggle value={settings.autoRestart} onChange={v => updateSetting("autoRestart", v)} label="Auto-restart on disconnect" />
                    <Toggle value={settings.stealth} onChange={v => updateSetting("stealth", v)} label="Stealth mode (randomize patterns)" />
                    <Toggle value={settings.notifications} onChange={v => updateSetting("notifications", v)} label="Discord notifications" />
                    <Toggle value={settings.vpn} onChange={v => updateSetting("vpn", v)} label="VPN integration" />
                  </div>
                </div>
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20, marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, color: "var(--text3)" }}>🔒 ACCOUNT (LOCKED)</div>
                  <FieldInput label="USERNAME" value={account.username || ""} readonly />
                  <FieldInput label="WEBSITE" value={account.website || ""} readonly />
                  <FieldInput label="ACCESS KEY" value={keyVal} readonly mono />
                </div>
                <Btn onClick={saveSettings} disabled={sending} fullWidth>
                  {sending ? "⟳ Sending..." : saved ? "✓ Settings Saved!" : "💾 Save Settings & Notify Admin"}
                </Btn>
              </div>
            </div>
          </div>
        )}

        {tab === "reports" && (
          <div style={{ animation: "fadeUp 0.4s ease" }}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>📋 DAILY PERFORMANCE REPORTS</div>
                <div style={{ fontSize: 11, color: "var(--text3)" }}>{reports.length} reports</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 1fr 1fr 1fr 1fr", gap: 12, padding: "10px 16px", background: "var(--bg2)", fontSize: 10, color: "var(--text3)", letterSpacing: "0.1em", fontWeight: 600 }}>
                <span>DATE</span><span>PROFIT</span><span>BETS</span><span>WIN RATE</span><span>VOLUME</span><span>SITE</span>
              </div>
              {reports.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: "var(--text3)", fontSize: 13 }}>No reports yet. Your admin will add daily reports here.</div>
              ) : reports.map((r, i) => <ReportRow key={i} r={r} />)}
            </div>
          </div>
        )}

        {tab === "analytics" && (
          <div style={{ animation: "fadeUp 0.4s ease" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>📈 PROFIT CURVE</div>
                {reports.length < 2 ? (
                  <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text3)", fontSize: 12 }}>Need at least 2 daily reports</div>
                ) : (
                  <svg viewBox="0 0 400 160" style={{ width: "100%", height: 160 }}>
                    {(() => {
                      const pts = [...reports].reverse();
                      const profits = pts.map((_, i) => pts.slice(0, i + 1).reduce((a, r) => a + r.profit, 0));
                      const minP = Math.min(0, ...profits), maxP = Math.max(0, ...profits), range = maxP - minP || 1;
                      const toX = i => 20 + (i / (pts.length - 1)) * 360;
                      const toY = v => 140 - ((v - minP) / range) * 120;
                      const path = profits.map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(v)}`).join(" ");
                      const fill = profits.map((v, i) => `${toX(i)} ${toY(v)}`).join(" L ") + ` L ${toX(pts.length - 1)} 150 L 20 150`;
                      return (<>
                        <defs><linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" /><stop offset="100%" stopColor="#6366f1" stopOpacity="0" /></linearGradient></defs>
                        <polyline points={fill} fill="url(#pg)" />
                        <path d={path} fill="none" stroke="#6366f1" strokeWidth="2" />
                        {profits.map((v, i) => <circle key={i} cx={toX(i)} cy={toY(v)} r={3} fill={v >= 0 ? "#10d98a" : "#f43f5e"} />)}
                      </>);
                    })()}
                  </svg>
                )}
              </div>
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>🎯 WIN/LOSS BREAKDOWN</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 40 }}>
                  <svg viewBox="0 0 100 100" width="120" height="120">
                    {(() => {
                      const total = stats.wonBets + stats.lostBets || 1, wr = stats.wonBets / total;
                      const r = 40, cx = 50, cy = 50, angle = wr * Math.PI * 2;
                      const x = cx + r * Math.sin(angle), y = cy - r * Math.cos(angle), large = angle > Math.PI ? 1 : 0;
                      return (<>
                        <circle cx={cx} cy={cy} r={r} fill="rgba(244,63,94,0.3)" />
                        <path d={`M ${cx} ${cy - r} A ${r} ${r} 0 ${large} 1 ${x} ${y} Z`} fill="rgba(16,217,138,0.8)" />
                        <circle cx={cx} cy={cy} r={25} fill="var(--surface)" />
                        <text x={cx} y={cy + 4} textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">{(wr * 100).toFixed(0)}%</text>
                      </>);
                    })()}
                  </svg>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{ width: 12, height: 12, borderRadius: 3, background: "#10d98a", display: "inline-block" }} />
                      <span style={{ fontSize: 12, color: "var(--text2)" }}>Won: <b style={{ color: "#10d98a" }}>{stats.wonBets}</b></span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 12, height: 12, borderRadius: 3, background: "#f43f5e", display: "inline-block" }} />
                      <span style={{ fontSize: 12, color: "var(--text2)" }}>Lost: <b style={{ color: "#f43f5e" }}>{stats.lostBets}</b></span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 8 }}>Avg odds: {stats.avgOdds.toFixed(2)}<br />Volume: ${stats.volume.toFixed(0)}</div>
                  </div>
                </div>
              </div>
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20, gridColumn: "span 2" }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>📊 PERFORMANCE METRICS</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
                  {[
                    { label: "Profit Factor", value: stats.wonBets > 0 ? (stats.totalProfit / Math.max(1, Math.abs(stats.worstDay))).toFixed(2) : "0.00" },
                    { label: "Avg Bet Size", value: `$${settings.stake}` },
                    { label: "Max Drawdown", value: `$${Math.abs(stats.worstDay).toFixed(2)}` },
                    { label: "Sharpe Ratio", value: (stats.roi / 20).toFixed(2) },
                    { label: "Kelly %", value: `${(((stats.winRate / 100) * 2 - 1) * 100).toFixed(1)}%` },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ textAlign: "center", padding: 16, background: "var(--bg2)", borderRadius: 12, border: "1px solid var(--border)" }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: "var(--accent)", fontFamily: "monospace" }}>{value}</div>
                      <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 4, letterSpacing: "0.05em" }}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("key");
  const [currentKey, setCurrentKey] = useState(null);
  const [account, setAccount] = useState(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminInput, setAdminInput] = useState("");
  const [showAdminLogin, setShowAdminLogin] = useState(false);

  const handleKeyEnter = (key, acc) => {
    setCurrentKey(key);
    if (!acc.username) {
      setScreen("setup");
    } else {
      setAccount(acc);
      setScreen("dashboard");
    }
  };

  const handleSetupComplete = (acc) => { setAccount(acc); setScreen("dashboard"); };
  const handleLogout = () => { setScreen("key"); setCurrentKey(null); setAccount(null); };
  const handleAdminLogin = () => {
    if (adminInput === ADMIN_KEY) { setAdminOpen(true); setShowAdminLogin(false); setAdminInput(""); }
    else alert("Invalid admin key");
  };

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <BgEffects />
      <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 200 }}>
        {!showAdminLogin ? (
          <button onClick={() => setShowAdminLogin(true)} style={{ width: 42, height: 42, borderRadius: "50%", background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text3)", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text3)"; }}
            title="Admin">🛡️</button>
        ) : (
          <div style={{ display: "flex", gap: 8, background: "var(--surface)", padding: 8, borderRadius: 12, border: "1px solid var(--border)", animation: "fadeUp 0.2s ease" }}>
            <input autoFocus type="password" value={adminInput} onChange={e => setAdminInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAdminLogin()} placeholder="Admin key"
              style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", color: "var(--text)", fontSize: 12, outline: "none", width: 120 }} />
            <button onClick={handleAdminLogin} style={{ background: "var(--accent)", border: "none", borderRadius: 8, padding: "6px 10px", color: "white", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>→</button>
            <button onClick={() => setShowAdminLogin(false)} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: 14 }}>✕</button>
          </div>
        )}
      </div>
      {adminOpen && <AdminPanel onClose={() => setAdminOpen(false)} />}
      {screen === "key" && <KeyScreen onEnter={handleKeyEnter} />}
      {screen === "setup" && <SetupScreen keyVal={currentKey} onComplete={handleSetupComplete} />}
      {screen === "dashboard" && account && <Dashboard account={account} keyVal={currentKey} onLogout={handleLogout} />}
    </>
  );
}
