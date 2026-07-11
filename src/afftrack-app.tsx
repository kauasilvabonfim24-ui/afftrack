import { useState, useEffect, useCallback, useRef } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import { supabase } from "./lib/supabase";

interface ClickEvent { ts: number; ref: string; }
interface AffLink {
  id: string; name: string; url: string; short: string; code: string;
  platform: string; productValue: number; commission: number;
  valuePerClick: number; clicks: number; clicksByDay: Record<string, number>;
  clickEvents: ClickEvent[]; lastClick: number | null; createdAt: number;
}

const SHORT_BASE = (typeof window !== "undefined" ? window.location.origin : "") + "/r/";

const PLATFORMS = [
  { label: "Hotmart", color: "#FF6B35", commission: 50 },
  { label: "Kiwify", color: "#7C3AED", commission: 50 },
  { label: "Eduzz", color: "#0EA5E9", commission: 40 },
  { label: "Monetizze", color: "#10B981", commission: 40 },
  { label: "Amazon", color: "#FF9900", commission: 8 },
  { label: "Shopee", color: "#EE4D2D", commission: 10 },
  { label: "Mercado Livre", color: "#FFE600", commission: 8 },
  { label: "Outro", color: "#6B7280", commission: 30 },
];

const PIE_COLORS = ["#6C47FF","#FF47A3","#00D4AA","#FFB347","#FF6B35","#0EA5E9","#10B981"];
const CUSTOM_PLT_KEY = "afftrack:customPlatforms";
const CUSTOM_COLORS = ["#F472B6","#22D3EE","#A78BFA","#FB923C","#34D399","#FBBF24","#F87171","#60A5FA"];
type Platform = { label: string; color: string; commission: number };

function loadCustomPlatforms(): Platform[] {
  if (typeof window === "undefined") return [];
  try { const raw = localStorage.getItem(CUSTOM_PLT_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function saveCustomPlatforms(list: Platform[]) {
  try { localStorage.setItem(CUSTOM_PLT_KEY, JSON.stringify(list)); } catch {}
}
function useCustomPlatforms(): [Platform[], (name: string) => void] {
  const [custom, setCustom] = useState<Platform[]>([]);
  useEffect(() => { setCustom(loadCustomPlatforms()); }, []);
  const add = (name: string) => {
    const trimmed = name.trim(); if (!trimmed) return;
    setCustom(prev => {
      if (prev.some(p => p.label.toLowerCase() === trimmed.toLowerCase())) return prev;
      if (PLATFORMS.some(p => p.label.toLowerCase() === trimmed.toLowerCase())) return prev;
      const next = [...prev, { label: trimmed, color: CUSTOM_COLORS[prev.length % CUSTOM_COLORS.length], commission: 30 }];
      saveCustomPlatforms(next); return next;
    });
  };
  return [custom, add];
}
function platformInfo(label: string, custom: Platform[]): Platform {
  return PLATFORMS.find(p => p.label === label) || custom.find(p => p.label === label) || PLATFORMS[7];
}

const genCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();
const todayKey = () => new Date().toLocaleDateString("pt-BR");
const fmtMoney = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtNum = (v: number) => new Intl.NumberFormat("pt-BR").format(v);
const fmtDate = (ts: number) => new Date(ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const fmtRelative = (ts: number | null) => {
  if (!ts) return "Sem cliques ainda";
  const diff = Math.max(0, Date.now() - ts);
  const s = Math.floor(diff / 1000);
  if (s < 60) return "agora mesmo";
  const m = Math.floor(s / 60); if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60); if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24); if (d < 30) return `há ${d} ${d === 1 ? "dia" : "dias"}`;
  const mo = Math.floor(d / 30); return `há ${mo} ${mo === 1 ? "mês" : "meses"}`;
};

async function fetchAll(): Promise<AffLink[]> {
  const [{ data: links }, { data: events }] = await Promise.all([
    supabase.from("links").select("*").order("created_at", { ascending: false }),
    supabase.from("click_events").select("link_id, clicked_at, referrer"),
  ]);
  if (!links) return [];
  const eventsByLink: Record<string, ClickEvent[]> = {};
  (events || []).forEach((e: any) => {
    const ts = new Date(e.clicked_at).getTime();
    (eventsByLink[e.link_id] ||= []).push({ ts, ref: e.referrer || "Direto" });
  });
  return links.map((l: any) => {
    const evs = (eventsByLink[l.id] || []).sort((a, b) => a.ts - b.ts);
    const clicksByDay: Record<string, number> = {};
    evs.forEach(e => { const k = new Date(e.ts).toLocaleDateString("pt-BR"); clicksByDay[k] = (clicksByDay[k] || 0) + 1; });
    return {
      id: l.id, name: l.name, url: l.url, short: SHORT_BASE + l.short, code: l.short,
      platform: l.platform, productValue: Number(l.product_value), commission: Number(l.commission),
      valuePerClick: Number(l.value_per_click), clicks: Number(l.clicks || 0),
      clicksByDay, clickEvents: evs, lastClick: evs.length ? evs[evs.length - 1].ts : null,
      createdAt: new Date(l.created_at).getTime(),
    } as AffLink;
  });
}

export default function App() {
  const [links, setLinks] = useState<AffLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"home" | "create" | "detail">("home");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>("default");
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const linksRef = useRef(links);
  linksRef.current = links;

  useEffect(() => { if ("Notification" in window) setNotifPerm(Notification.permission); }, []);

  const refresh = useCallback(async () => { const data = await fetchAll(); setLinks(data); return data; }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => { try { await refresh(); } finally { if (!cancelled) setLoading(false); } })();
    const ch = supabase.channel("afftrack-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "links" }, () => refresh())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "click_events" }, async (payload) => {
        const linkId = (payload.new as { link_id?: string })?.link_id;
        if (linkId) setLinks(prev => prev.map((l: AffLink) => l.id === linkId ? { ...l, clicks: l.clicks + 1 } : l));
        refresh();
      }).subscribe();
    let lastTotal = -1;
    const poll = async () => {
      const { count, error } = await supabase.from("click_events").select("*", { count: "exact", head: true });
      if (error) return;
      const current = count ?? 0;
      if (lastTotal === -1) { lastTotal = current; return; }
      if (current > lastTotal) { lastTotal = current; refresh(); }
    };
    const pollId = setInterval(poll, 10000);
    const onVisibility = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { cancelled = true; supabase.removeChannel(ch); clearInterval(pollId); document.removeEventListener("visibilitychange", onVisibility); };
  }, [refresh]);

  const showToast = (msg: string, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const requestNotif = async () => {
    if (!(window as any).OneSignal) return showToast("OneSignal não carregou", "error");
    await (window as any).OneSignal.Notifications.requestPermission();
    const permission = (window as any).OneSignal.Notifications.permission;
    setNotifPerm(permission ? "granted" : "default");
    permission ? showToast("Notificações ativadas! 🔔") : showToast("Permissão negada", "error");
  };

  const copyLink = (short: string) => { navigator.clipboard?.writeText(short); showToast("Link copiado! 📋"); };

  const deleteLink = async (id: string) => {
    setLinks(prev => prev.filter(l => l.id !== id)); setView("home");
    const { error } = await supabase.from("links").delete().eq("id", id);
    if (error) { showToast("Erro ao remover", "error"); refresh(); } else showToast("Link removido");
  };

  const createLink = async (input: { name: string; url: string; platform: string; productValue: number; commission: number; valuePerClick: number }) => {
    const code = genCode();
    const { error } = await supabase.from("links").insert({ name: input.name, url: input.url, short: code, platform: input.platform, product_value: input.productValue, commission: input.commission, value_per_click: input.valuePerClick, clicks: 0 });
    if (error) { showToast("Erro ao criar", "error"); return; }
    setView("home"); showToast("Link criado! 🚀"); refresh();
  };

  const updateLink = async (id: string, input: { name: string; url: string; platform: string; productValue: number; commission: number; valuePerClick: number }) => {
    const { error } = await supabase.from("links").update({ name: input.name, url: input.url, platform: input.platform, product_value: input.productValue, commission: input.commission, value_per_click: input.valuePerClick }).eq("id", id);
    if (error) { showToast("Erro ao atualizar", "error"); return; }
    showToast("Link atualizado ✅"); refresh();
  };

  const selectedLink = links.find(l => l.id === selectedId) ?? null;

  if (loading) return (
    <div className="app-root" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <div style={{ textAlign: "center", color: "#888" }}><div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div><p style={{ fontSize: 14 }}>Carregando métricas…</p></div>
    </div>
  );

  return (
    <div className="app-root">
      {toast && <Toast msg={toast.msg} type={toast.type} />}
      {view === "home" && <HomeView links={links} notifPerm={notifPerm} onRequestNotif={requestNotif} onNew={() => setView("create")} onSelect={id => { setSelectedId(id); setView("detail"); }} onCopy={copyLink} />}
      {view === "create" && <CreateView onSave={createLink} onBack={() => setView("home")} />}
      {view === "detail" && selectedLink && <DetailView link={selectedLink} onBack={() => setView("home")} onCopy={copyLink} onDelete={() => deleteLink(selectedLink.id)} onUpdate={(input) => updateLink(selectedLink.id, input)} />}
      <BottomNav active={view === "detail" ? "home" : view} onHome={() => { setView("home"); setSelectedId(null); }} onNew={() => setView("create")} />
    </div>
  );
}

function Toast({ msg, type }: { msg: string; type: string }) {
  return <div className={`toast ${type === "error" ? "toast-error" : "toast-ok"}`}>{msg}</div>;
}

function BottomNav({ active, onHome, onNew }: { active: string; onHome: () => void; onNew: () => void }) {
  return (
    <nav className="bottom-nav">
      <button onClick={onHome} className={active === "home" ? "nav-btn active" : "nav-btn"}><HomeIcon /><span>Dashboard</span></button>
      <button onClick={onNew} className={active === "create" ? "nav-btn active" : "nav-btn"}><PlusIcon /><span>Novo Link</span></button>
    </nav>
  );
}

function HomeView({ links, notifPerm, onRequestNotif, onNew, onSelect, onCopy }: { links: AffLink[]; notifPerm: string; onRequestNotif: () => void; onNew: () => void; onSelect: (id: string) => void; onCopy: (s: string) => void }) {
  const totalClicks = links.reduce((s, l) => s + l.clicks, 0);
  const totalEarnings = links.reduce((s, l) => s + l.clicks * l.valuePerClick, 0);
  const todayClicks = links.reduce((s, l) => s + (l.clicksByDay[todayKey()] || 0), 0);
  const days7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const k = d.toLocaleDateString("pt-BR");
    return { label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), total: links.reduce((s, l) => s + (l.clicksByDay[k] || 0), 0) };
  });
  return (
    <div className="scroll-view">
      <header className="page-header">
        <div><p className="eyebrow">Afiliado Pro</p><h1 className="brand">AffTrack</h1></div>
        <button onClick={onRequestNotif} className={notifPerm === "granted" ? "notif-btn active" : "notif-btn"}><BellIcon />{notifPerm === "granted" ? "Ativo" : "Ativar"}</button>
      </header>
      <section className="stats-grid">
        <StatCard label="Total Cliques" value={fmtNum(totalClicks)} sub="todos os links" color="#6C47FF" emoji="🖱️" />
        <StatCard label="Ganhos Est." value={fmtMoney(totalEarnings)} sub="por comissão" color="#00D4AA" emoji="💰" />
        <StatCard label="Links Ativos" value={fmtNum(links.length)} sub="encurtados" color="#FF47A3" emoji="🔗" />
        <StatCard label="Hoje" value={fmtNum(todayClicks)} sub="cliques hoje" color="#FFB347" emoji="⚡" />
      </section>
      {links.length > 0 && (
        <div className="card chart-card">
          <p className="card-label">Cliques — 7 dias</p>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={days7} barSize={18}>
              <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6C47FF" /><stop offset="100%" stopColor="#FF47A3" /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2E" />
              <XAxis dataKey="label" tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip contentStyle={{ background: "#1A1A2E", border: "none", borderRadius: 8, fontSize: 12 }} itemStyle={{ color: "#6C47FF" }} />
              <Bar dataKey="total" fill="url(#bg)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {links.length > 0 && (
        <div className="links-section">
          <p className="card-label" style={{ marginBottom: 12 }}>🏆 Top Links</p>
          {[...links].sort((a, b) => b.clicks - a.clicks).slice(0, 10).map((l, i) => {
            const plt = PLATFORMS.find(p => p.label === l.platform) || PLATFORMS[7];
            return (
              <div key={l.id} className="link-card" onClick={() => onSelect(l.id)} style={{ padding: "10px 14px", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: i < 3 ? "#FFB347" : "#555", width: 22 }}>#{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="link-name" style={{ fontSize: 13 }}>{l.name}</p>
                    <span className="platform-badge" style={{ background: plt.color + "22", color: plt.color, borderColor: plt.color + "44" }}>{l.platform}</span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 15, fontWeight: 800, color: "#6C47FF" }}>{fmtNum(l.clicks)}</p>
                    <p style={{ fontSize: 10, color: "#555" }}>cliques</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <LinksSection links={links} onNew={onNew} onSelect={onSelect} onCopy={onCopy} />
    </div>
  );
}

function LinksSection({ links, onNew, onSelect, onCopy }: { links: AffLink[]; onNew: () => void; onSelect: (id: string) => void; onCopy: (s: string) => void }) {
  const [customPlatforms] = useCustomPlatforms();
  const [filter, setFilter] = useState<string>("Todos");
  const usedPlatforms = Array.from(new Set(links.map(l => l.platform)));
  const filters = ["Todos", ...usedPlatforms];
  const filtered = filter === "Todos" ? links : links.filter(l => l.platform === filter);
  return (
    <section className="links-section">
      <div className="section-header">
        <p className="card-label">Meus Links</p>
        <button onClick={onNew} className="btn-grad btn-sm"><PlusIcon /> Novo</button>
      </div>
      {links.length > 0 && filters.length > 1 && (
        <div className="platform-scroll" style={{ marginBottom: 12 }}>
          {filters.map(f => {
            const color = f === "Todos" ? "#6C47FF" : platformInfo(f, customPlatforms).color;
            const active = filter === f;
            return <button key={f} onClick={() => setFilter(f)} className="platform-chip" style={{ borderColor: active ? color : "#333", background: active ? color + "22" : "#13131A", color: active ? color : "#666" }}>{f}</button>;
          })}
        </div>
      )}
      {links.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔗</div>
          <p className="empty-title">Nenhum link ainda</p>
          <p className="empty-sub">Crie seu primeiro link e rastreie cliques em tempo real!</p>
          <button onClick={onNew} className="btn-grad" style={{ marginTop: 16 }}>Criar Primeiro Link</button>
        </div>
      ) : filtered.length === 0 ? <div className="empty-state"><p className="empty-sub">Nenhum link para {filter}</p></div>
        : filtered.map(l => <LinkCard key={l.id} link={l} onSelect={() => onSelect(l.id)} onCopy={() => onCopy(l.short)} />)}
    </section>
  );
}

function StatCard({ label, value, sub, color, emoji }: { label: string; value: string; sub: string; color: string; emoji: string }) {
  return <div className="stat-card"><div className="stat-emoji">{emoji}</div><div className="stat-value" style={{ color }}>{value}</div><div className="stat-label">{label}</div><div className="stat-sub">{sub}</div></div>;
}

function LinkCard({ link, onSelect, onCopy }: { link: AffLink; onSelect: () => void; onCopy: () => void }) {
  const plt = PLATFORMS.find(p => p.label === link.platform) || PLATFORMS[7];
  const today = link.clicksByDay[todayKey()] || 0;
  return (
    <div className="link-card" onClick={onSelect}>
      <div className="link-card-top">
        <div className="link-meta">
          <div className="link-badges">
            <span className="platform-badge" style={{ background: plt.color + "22", color: plt.color, borderColor: plt.color + "44" }}>{link.platform}</span>
            {today > 0 && <span className="today-badge">⚡ {today} hoje</span>}
          </div>
          <p className="link-name">{link.name}</p>
          <p className="link-short">{link.short}</p>
          <p className="link-short" style={{ color: link.lastClick ? "#888" : "#444", marginTop: 2 }}>⏱ {fmtRelative(link.lastClick)}</p>
        </div>
        <button className="copy-btn" onClick={e => { e.stopPropagation(); onCopy(); }}><CopyIcon /></button>
      </div>
      <div className="link-stats">
        <MiniStat label="Cliques" value={fmtNum(link.clicks)} />
        <MiniStat label="Ganhos Est." value={fmtMoney(link.clicks * link.valuePerClick)} color="#00D4AA" />
        <MiniStat label="Comissão" value={`${link.commission}%`} color="#FF47A3" />
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return <div className="mini-stat"><p className="mini-val" style={{ color: color || "#fff" }}>{value}</p><p className="mini-lbl">{label}</p></div>;
}

function CreateView({ onSave, onBack }: { onSave: (i: { name: string; url: string; platform: string; productValue: number; commission: number; valuePerClick: number }) => void; onBack: () => void }) {
  const [customPlatforms, addCustomPlatform] = useCustomPlatforms();
  const [name, setName] = useState(""); const [url, setUrl] = useState("");
  const [platform, setPlatform] = useState("Hotmart"); const [prodVal, setProdVal] = useState("");
  const [comm, setComm] = useState("50"); const [errors, setErrors] = useState<Record<string, string>>({});
  const [addingCustom, setAddingCustom] = useState(false); const [customName, setCustomName] = useState("");
  const allPlatforms = [...PLATFORMS, ...customPlatforms];
  const estPerClick = prodVal && comm ? +prodVal * (+comm / 100) * 0.015 : 0;
  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Obrigatório";
    if (!url.trim()) e.url = "Obrigatório"; else { try { new URL(url); } catch { e.url = "URL inválida"; } }
    if (!prodVal || isNaN(+prodVal) || +prodVal <= 0) e.prodVal = "Valor inválido";
    if (!comm || isNaN(+comm) || +comm <= 0 || +comm > 100) e.comm = "Entre 1 e 100";
    setErrors(e); return !Object.keys(e).length;
  };
  const handleSave = () => { if (!validate()) return; onSave({ name: name.trim(), url: url.trim(), platform, productValue: +prodVal, commission: +comm, valuePerClick: +prodVal * (+comm / 100) * 0.015 }); };
  return (
    <div className="scroll-view">
      <header className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} className="back-btn">←</button>
          <div><h2 className="page-title">Novo Link</h2><p className="page-sub">Encurte e monitore em tempo real</p></div>
        </div>
      </header>
      <div className="form-body">
        <div className="form-group">
          <label className="field-label">Plataforma</label>
          <div className="platform-scroll">
            {allPlatforms.map(p => (
              <button key={p.label} onClick={() => { setPlatform(p.label); setComm(String(p.commission)); }} className="platform-chip"
                style={{ borderColor: platform === p.label ? p.color : "#333", background: platform === p.label ? p.color + "22" : "#13131A", color: platform === p.label ? p.color : "#666" }}>{p.label}</button>
            ))}
            <button onClick={() => setAddingCustom(v => !v)} className="platform-chip" style={{ borderColor: "#6C47FF", background: "#6C47FF11", color: "#6C47FF" }}>+ Adicionar</button>
          </div>
          {addingCustom && (
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <input className="field-input" style={{ flex: 1 }} value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Nome da plataforma" />
              <button className="btn-grad btn-sm" onClick={() => { const n = customName.trim(); if (!n) return; addCustomPlatform(n); setPlatform(n); setCustomName(""); setAddingCustom(false); }}>Salvar</button>
            </div>
          )}
        </div>
        <Field label="Nome do Produto" value={name} onChange={setName} placeholder="Ex: Curso de Marketing Digital" error={errors.name} />
        <Field label="Link Original do Afiliado" value={url} onChange={setUrl} placeholder="https://..." error={errors.url} />
        <div className="two-col">
          <Field label="Valor do Produto (R$)" value={prodVal} onChange={setProdVal} placeholder="197" type="number" error={errors.prodVal} />
          <Field label="Comissão (%)" value={comm} onChange={setComm} placeholder="50" type="number" error={errors.comm} />
        </div>
        {estPerClick > 0 && (
          <div className="estimate-card">
            <p className="card-label">Estimativa de Ganhos</p>
            <div className="estimate-grid">
              <EstItem label="por clique*" value={fmtMoney(estPerClick)} color="#6C47FF" />
              <EstItem label="100 cliques" value={fmtMoney(estPerClick * 100)} color="#00D4AA" />
              <EstItem label="por venda" value={fmtMoney(+prodVal * (+comm / 100))} color="#FF47A3" />
              <EstItem label="10 vendas" value={fmtMoney(+prodVal * (+comm / 100) * 10)} color="#FFB347" />
            </div>
            <p className="estimate-note">*Estimativa com conversão de 1,5%</p>
          </div>
        )}
        <button onClick={handleSave} className="btn-grad btn-full">🚀 Criar Link</button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", error }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string; error?: string }) {
  return (
    <div className="form-group">
      <label className="field-label">{label}</label>
      <input className={`field-input${error ? " field-error" : ""}`} type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      {error && <p className="error-msg">{error}</p>}
    </div>
  );
}

function EstItem({ label, value, color }: { label: string; value: string; color: string }) {
  return <div className="est-item"><p className="est-val" style={{ color }}>{value}</p><p className="est-lbl">{label}</p></div>;
}

type UpdateInput = { name: string; url: string; platform: string; productValue: number; commission: number; valuePerClick: number };

function DetailView({ link, onBack, onCopy, onDelete, onUpdate }: { link: AffLink; onBack: () => void; onCopy: (s: string) => void; onDelete: () => void; onUpdate: (i: UpdateInput) => void }) {
  const [customPlatforms] = useCustomPlatforms();
  const plt = platformInfo(link.platform, customPlatforms);
  const today = link.clicksByDay[todayKey()] || 0;
  const [editing, setEditing] = useState(false);
  const [period, setPeriod] = useState<"7" | "30" | "month">("7");
  const periodData = (() => {
    const now = new Date(); let start: Date; let days: number;
    if (period === "7") { start = new Date(); start.setDate(now.getDate() - 6); days = 7; }
    else if (period === "30") { start = new Date(); start.setDate(now.getDate() - 29); days = 30; }
    else { start = new Date(now.getFullYear(), now.getMonth(), 1); days = Math.floor((now.getTime() - start.getTime()) / 86400000) + 1; }
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const k = d.toLocaleDateString("pt-BR");
      return { label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), cliques: link.clicksByDay[k] || 0 };
    });
  })();
  const hoursData = Array.from({ length: 24 }, (_, h) => ({ label: `${h}h`, cliques: 0 }));
  (link.clickEvents || []).forEach(e => { const h = new Date(e.ts).getHours(); hoursData[h].cliques++; });
  const refCount: Record<string, number> = {};
  (link.clickEvents || []).forEach(e => { refCount[e.ref] = (refCount[e.ref] || 0) + 1; });
  const pieData = Object.entries(refCount).map(([name, value]) => ({ name, value }));
  return (
    <div className="scroll-view">
      <header className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
          <button onClick={onBack} className="back-btn">←</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="link-badges" style={{ marginBottom: 4 }}>
              <span className="platform-badge" style={{ background: plt.color + "22", color: plt.color, borderColor: plt.color + "44" }}>{link.platform}</span>
              {link.lastClick && <span className="date-note">{fmtDate(link.lastClick)}</span>}
            </div>
            <h2 className="link-name">{link.name}</h2>
          </div>
        </div>
        <button onClick={() => setEditing(true)} className="delete-btn" style={{ marginRight: 8 }}><EditIcon /></button>
        <button onClick={onDelete} className="delete-btn"><TrashIcon /></button>
      </header>
      {editing && <EditModal link={link} onClose={() => setEditing(false)} onSave={(input) => { onUpdate(input); setEditing(false); }} />}
      <div className="short-bar">
        <span className="short-url">{link.short}</span>
        <button onClick={() => onCopy(link.short)} className="btn-grad btn-sm"><CopyIcon />Copiar</button>
      </div>
      <div className="detail-body">
        <div className="stats-grid">
          <StatCard label="Total Cliques" value={fmtNum(link.clicks)} sub="desde a criação" color="#6C47FF" emoji="🖱️" />
          <StatCard label="Ganhos Est." value={fmtMoney(link.clicks * link.valuePerClick)} sub="por comissão" color="#00D4AA" emoji="💰" />
          <StatCard label="Hoje" value={fmtNum(today)} sub="cliques hoje" color="#FFB347" emoji="⚡" />
          <StatCard label="Por Venda" value={fmtMoney(link.productValue * link.commission / 100)} sub={`${link.commission}%`} color="#FF47A3" emoji="🎯" />
        </div>
        <div className="card chart-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 8px 8px" }}>
            <p className="card-label" style={{ margin: 0, padding: 0 }}>Cliques por período</p>
            <div style={{ display: "flex", gap: 6 }}>
              {([["7", "7 dias"], ["30", "30 dias"], ["month", "Mês atual"]] as const).map(([v, l]) => (
                <button key={v} onClick={() => setPeriod(v)} className="platform-chip" style={{ padding: "4px 10px", fontSize: 10, borderColor: period === v ? "#6C47FF" : "#333", background: period === v ? "#6C47FF22" : "#13131A", color: period === v ? "#6C47FF" : "#666" }}>{l}</button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={periodData}>
              <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#6C47FF" /><stop offset="100%" stopColor="#FF47A3" /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2E" />
              <XAxis dataKey="label" tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis hide />
              <Tooltip contentStyle={{ background: "#1A1A2E", border: "none", borderRadius: 8, fontSize: 12 }} itemStyle={{ color: "#6C47FF" }} />
              <Line type="monotone" dataKey="cliques" stroke="url(#lg)" strokeWidth={3} dot={{ fill: "#6C47FF", r: 3 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card chart-card">
          <p className="card-label">⏰ Horários com mais cliques</p>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={hoursData} barSize={8}>
              <defs><linearGradient id="hg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#00D4AA" /><stop offset="100%" stopColor="#6C47FF" /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2E" />
              <XAxis dataKey="label" tick={{ fill: "#555", fontSize: 9 }} axisLine={false} tickLine={false} interval={2} />
              <YAxis hide />
              <Tooltip contentStyle={{ background: "#1A1A2E", border: "none", borderRadius: 8, fontSize: 12 }} itemStyle={{ color: "#00D4AA" }} />
              <Bar dataKey="cliques" fill="url(#hg)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {pieData.length > 0 && (
          <div className="card">
            <p className="card-label">Origens dos Cliques</p>
            <div className="pie-row">
              <PieChart width={120} height={120}>
                <Pie data={pieData} cx={55} cy={55} innerRadius={30} outerRadius={55} dataKey="value" paddingAngle={3}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
              </PieChart>
              <div className="pie-legend">
                {pieData.map((d, i) => (
                  <div key={d.name} className="pie-row-item">
                    <div className="pie-dot" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="pie-name">{d.name}</span><span className="pie-val">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {(link.clickEvents || []).length > 0 && (
          <div className="card">
            <p className="card-label">Atividade Recente</p>
            {[...link.clickEvents].reverse().slice(0, 8).map((e, i, arr) => (
              <div key={i} className="activity-row" style={{ borderBottom: i < arr.length - 1 ? "1px solid #1A1A2E" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div className="activity-dot" /><span className="activity-ref">via {e.ref}</span></div>
                <span className="activity-ts">{fmtDate(e.ts)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EditModal({ link, onClose, onSave }: { link: AffLink; onClose: () => void; onSave: (i: UpdateInput) => void }) {
  const [customPlatforms, addCustomPlatform] = useCustomPlatforms();
  const [name, setName] = useState(link.name); const [url, setUrl] = useState(link.url);
  const [platform, setPlatform] = useState(link.platform); const [prodVal, setProdVal] = useState(String(link.productValue));
  const [comm, setComm] = useState(String(link.commission)); const [errors, setErrors] = useState<Record<string, string>>({});
  const [addingCustom, setAddingCustom] = useState(false); const [customName, setCustomName] = useState("");
  const allPlatforms = [...PLATFORMS, ...customPlatforms];
  if (!allPlatforms.some(p => p.label === platform)) allPlatforms.push({ label: platform, color: "#6B7280", commission: +comm || 30 });
  const handleSave = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Obrigatório";
    if (!url.trim()) e.url = "Obrigatório"; else { try { new URL(url); } catch { e.url = "URL inválida"; } }
    if (!prodVal || isNaN(+prodVal) || +prodVal <= 0) e.prodVal = "Valor inválido";
    if (!comm || isNaN(+comm) || +comm <= 0 || +comm > 100) e.comm = "Entre 1 e 100";
    setErrors(e); if (Object.keys(e).length) return;
    onSave({ name: name.trim(), url: url.trim(), platform, productValue: +prodVal, commission: +comm, valuePerClick: +prodVal * (+comm / 100) * 0.015 });
  };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#0F0F17", width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", borderRadius: "16px 16px 0 0", border: "1px solid #1E1E2E", padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 className="page-title" style={{ margin: 0 }}>Editar Link</h2>
          <button onClick={onClose} className="back-btn">✕</button>
        </div>
        <div className="form-group">
          <label className="field-label">Plataforma</label>
          <div className="platform-scroll">
            {allPlatforms.map(p => (
              <button key={p.label} onClick={() => { setPlatform(p.label); setComm(String(p.commission)); }} className="platform-chip"
                style={{ borderColor: platform === p.label ? p.color : "#333", background: platform === p.label ? p.color + "22" : "#13131A", color: platform === p.label ? p.color : "#666" }}>{p.label}</button>
            ))}
            <button onClick={() => setAddingCustom(v => !v)} className="platform-chip" style={{ borderColor: "#6C47FF", background: "#6C47FF11", color: "#6C47FF" }}>+ Adicionar</button>
          </div>
          {addingCustom && (
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <input className="field-input" style={{ flex: 1 }} value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Nome da plataforma" />
              <button className="btn-grad btn-sm" onClick={() => { const n = customName.trim(); if (!n) return; addCustomPlatform(n); setPlatform(n); setCustomName(""); setAddingCustom(false); }}>Salvar</button>
            </div>
          )}
        </div>
        <Field label="Nome do Produto" value={name} onChange={setName} placeholder="Ex: Curso" error={errors.name} />
        <Field label="URL do Afiliado" value={url} onChange={setUrl} placeholder="https://..." error={errors.url} />
        <div className="two-col">
          <Field label="Valor (R$)" value={prodVal} onChange={setProdVal} placeholder="197" type="number" error={errors.prodVal} />
          <Field label="Comissão (%)" value={comm} onChange={setComm} placeholder="50" type="number" error={errors.comm} />
        </div>
        <button onClick={handleSave} className="btn-grad btn-full" style={{ marginTop: 12 }}>💾 Salvar Alterações</button>
      </div>
    </div>
  );
}

const w = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", width: 20, height: 20 };
const HomeIcon = () => <svg {...w}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>;
const PlusIcon = () => <svg {...w}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
const CopyIcon = () => <svg {...w} width={16} height={16}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>;
const BellIcon = () => <svg {...w}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>;
const TrashIcon = () => <svg {...w} width={16} height={16}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>;
const EditIcon = () => <svg {...w} width={16} height={16}><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>;
