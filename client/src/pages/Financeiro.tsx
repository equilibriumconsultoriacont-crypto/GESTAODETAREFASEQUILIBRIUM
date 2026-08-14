import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowLeft, Wallet, Receipt, Repeat, QrCode, PlusCircle, Pencil, Trash2, Search, Lock,
  CheckCircle2, RotateCcw, TrendingUp, Clock, AlertTriangle, X, Send, Mail, Play, Pause, TrendingDown, Scale, Eye, MessageCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

const C = {
  bg: "#0a0f0e", panel: "#0f1a19", panelHi: "#132321", border: "#1e3a37", borderHi: "#2b5551",
  text: "#e8f0ef", textMuted: "#8fa5a1", textFaint: "#5c716d",
  brand: "#2f8f9e", brandSoft: "rgba(47,143,158,.14)", brandText: "#a9dbe3",
  green: "#34d399", greenSoft: "rgba(52,211,153,.13)",
  amber: "#e0a458", amberSoft: "rgba(224,164,88,.14)",
  danger: "#f87171", dangerSoft: "rgba(248,113,113,.12)",
};
const brl = (v: any) => "R$ " + Number(String(v ?? 0).replace(",", ".")).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fieldStyle: React.CSSProperties = { width: "100%", background: C.panelHi, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", color: C.text, fontSize: 14, outline: "none" };
const labelStyle: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 6 };
const ghostBtn: React.CSSProperties = { background: "transparent", border: `1px solid ${C.border}`, color: C.textMuted, borderRadius: 10, padding: "10px 16px", fontSize: 14, cursor: "pointer" };
const primaryBtn: React.CSSProperties = { background: C.brand, color: "#04211f", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 700, fontSize: 14, cursor: "pointer" };
const iconBtn: React.CSSProperties = { width: 34, height: 34, borderRadius: 9, border: `1px solid ${C.border}`, background: C.panelHi, color: C.textMuted, cursor: "pointer", display: "grid", placeItems: "center" };

const STATUS_LABEL: Record<string, { label: string; color: string; soft: string }> = {
  rascunho: { label: "Rascunho", color: C.textMuted, soft: "rgba(143,165,161,.14)" },
  aberto: { label: "Aberto", color: C.brandText, soft: C.brandSoft },
  enviado: { label: "Enviado", color: "#7dd3fc", soft: "rgba(125,211,252,.13)" },
  em_conferencia: { label: "Em conferência", color: C.amber, soft: C.amberSoft },
  pago: { label: "Pago", color: C.green, soft: C.greenSoft },
  vencido: { label: "Vencido", color: C.danger, soft: C.dangerSoft },
  cancelado: { label: "Cancelado", color: C.textFaint, soft: "rgba(92,113,109,.14)" },
};

type Tab = "painel" | "titulos" | "pagar" | "honorarios" | "recebimento";

export default function FinanceiroPage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<Tab>("painel");

  // Notificação de comprovante aguardando conferência (estilo WhatsApp): badge, título da aba e
  // aviso quando um novo comprovante chega.
  const [pend, setPend] = useState(0);
  const prevPend = useRef<number | null>(null);
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {});
    const load = () =>
      fetch("/api/financeiro/pendencias", { credentials: "include" })
        .then((r) => r.json())
        .then((d) => {
          const c = d?.count || 0;
          if (prevPend.current !== null && c > prevPend.current) {
            const novos = c - prevPend.current;
            toast.success(novos === 1 ? "Novo comprovante recebido — confira em Contas a Receber" : `${novos} novos comprovantes para conferir`);
            if ("Notification" in window && Notification.permission === "granted") {
              try { new Notification("Comprovante para aprovar", { body: "Um cliente enviou um comprovante de pagamento." }); } catch {}
            }
          }
          prevPend.current = c;
          setPend(c);
        })
        .catch(() => {});
    load();
    const iv = setInterval(load, 15000);
    return () => clearInterval(iv);
  }, []);
  useEffect(() => { document.title = pend > 0 ? `(${pend}) Financeiro` : "Financeiro"; return () => { document.title = "Financeiro"; }; }, [pend]);

  if (loading) return <div style={{ minHeight: "100dvh", background: C.bg, display: "grid", placeItems: "center", color: C.textMuted }}>Carregando…</div>;
  if (!user || (user as any).role !== "admin") {
    return (
      <div style={{ minHeight: "100dvh", background: C.bg, display: "grid", placeItems: "center", padding: 24 }}>
        <div style={{ textAlign: "center", maxWidth: 380 }}>
          <Lock size={40} style={{ color: C.textFaint, margin: "0 auto 14px" }} />
          <div style={{ color: C.text, fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Acesso restrito</div>
          <div style={{ color: C.textMuted, fontSize: 14, marginBottom: 18 }}>Só administradores acessam o Financeiro.</div>
          <button onClick={() => setLocation("/")} style={primaryBtn}>Voltar à Plataforma</button>
        </div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: "painel", label: "Painel", icon: TrendingUp },
    { key: "titulos", label: "Contas a Receber", icon: Receipt },
    { key: "pagar", label: "Contas a Pagar", icon: TrendingDown },
    { key: "honorarios", label: "Honorários", icon: Repeat },
    { key: "recebimento", label: "Recebimento (PIX)", icon: QrCode },
  ];

  return (
    <div style={{ minHeight: "100dvh", background: C.bg, color: C.text, fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 10, background: "rgba(10,15,14,.86)", backdropFilter: "blur(10px)", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "14px 20px", display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/">
            <button style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.panelHi, border: `1px solid ${C.border}`, color: C.textMuted, borderRadius: 10, padding: "8px 12px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              <ArrowLeft size={15} /> Plataforma
            </button>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: C.brandSoft, display: "grid", placeItems: "center" }}>
              <Wallet size={17} style={{ color: C.brandText }} />
            </div>
            <h1 style={{ fontSize: 18, fontWeight: 750 }}>Financeiro</h1>
          </div>
        </div>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 20px 12px", display: "flex", gap: 6, overflowX: "auto" }}>
          {tabs.map(({ key, label, icon: Icon }) => {
            const on = tab === key;
            return (
              <button key={key} onClick={() => setTab(key)}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 999, whiteSpace: "nowrap",
                  border: `1px solid ${on ? C.brand : C.border}`, background: on ? C.brand : "transparent",
                  color: on ? "#04211f" : C.textMuted, fontSize: 13, fontWeight: 650, cursor: "pointer" }}>
                <Icon size={15} /> {label}
                {key === "titulos" && pend > 0 && (
                  <span style={{ minWidth: 18, height: 18, padding: "0 5px", borderRadius: 9, background: "#ef4444", color: "#fff", fontSize: 11, fontWeight: 700, display: "grid", placeItems: "center" }}>{pend > 99 ? "99+" : pend}</span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "22px 20px 60px" }}>
        {tab === "painel" && <PainelTab onGo={setTab} />}
        {tab === "titulos" && <TitulosTab />}
        {tab === "pagar" && <PayablesTab />}
        {tab === "honorarios" && <HonorariosTab />}
        {tab === "recebimento" && <RecebimentoTab />}
      </main>
    </div>
  );
}

function SectionHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>{title}</h2>
        <p style={{ fontSize: 13, color: C.textMuted, marginTop: 3 }}>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

/* ── Painel ── */
function PainelTab({ onGo }: { onGo: (t: Tab) => void }) {
  const { data } = trpc.financeiro.dashboard.useQuery(undefined, { refetchOnWindowFocus: true, refetchInterval: 45_000 });
  const { data: charts } = trpc.financeiro.dashboardCharts.useQuery(undefined, { refetchOnWindowFocus: true, refetchInterval: 60_000 });
  const cards = [
    { label: "A receber", value: brl(data?.aReceber ?? 0), icon: Clock, color: C.brandText, soft: C.brandSoft, onClick: () => onGo("titulos") },
    { label: "Recebido", value: brl(data?.recebido ?? 0), icon: CheckCircle2, color: C.green, soft: C.greenSoft, onClick: () => onGo("titulos") },
    { label: "A pagar", value: brl(data?.aPagar ?? 0), icon: TrendingDown, color: C.amber, soft: C.amberSoft, onClick: () => onGo("pagar") },
    { label: "Saldo (recebido − pago)", value: brl(data?.saldo ?? 0), icon: Scale, color: Number(String(data?.saldo ?? 0).replace(",", ".")) < 0 ? C.danger : C.green, soft: Number(String(data?.saldo ?? 0).replace(",", ".")) < 0 ? C.dangerSoft : C.greenSoft },
    { label: "Vencidos", value: String(data?.vencidos ?? 0), icon: AlertTriangle, color: C.danger, soft: C.dangerSoft, onClick: () => onGo("titulos") },
    { label: "Em conferência", value: String(data?.emConferencia ?? 0), icon: Receipt, color: C.amber, soft: C.amberSoft, onClick: () => onGo("titulos") },
    { label: "Honorários ativos", value: String(data?.honorariosAtivos ?? 0), icon: Repeat, color: C.brandText, soft: C.brandSoft, onClick: () => onGo("honorarios") },
  ];

  const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const labelOf = (k: string) => { const [y, m] = k.split("-"); return `${MES[Number(m) - 1]}/${y.slice(2)}`; };
  const sumFor = (arr: any[] | undefined, k: string) => (arr || []).find((r) => r.mes === k)?.total ?? 0;
  const now = new Date();

  // Fluxo projetado: mês atual + próximos 2
  const projKeys = [0, 1, 2].map((i) => keyOf(new Date(now.getFullYear(), now.getMonth() + i, 1)));
  const fluxoData = projKeys.map((k) => ({ mes: labelOf(k), "A receber": sumFor(charts?.recFuturo, k), "A pagar": sumFor(charts?.pagFuturo, k) }));
  const projReceber = projKeys.reduce((s, k) => s + sumFor(charts?.recFuturo, k), 0);
  const projPagar = projKeys.reduce((s, k) => s + sumFor(charts?.pagFuturo, k), 0);

  // Histórico: últimos 6 meses
  const histKeys = [5, 4, 3, 2, 1, 0].map((i) => keyOf(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  const mensalData = histKeys.map((k) => ({ mes: labelOf(k), Recebido: sumFor(charts?.recebidoMensal, k), Pago: sumFor(charts?.pagoMensal, k) }));

  const topCat = (arr: any[] | undefined) => [...(arr || [])].sort((a, b) => b.total - a.total).slice(0, 6);
  const catRec = topCat(charts?.catReceita);
  const catDesp = topCat(charts?.catDespesa);
  const maxRec = Math.max(1, ...catRec.map((c) => c.total));
  const maxDesp = Math.max(1, ...catDesp.map((c) => c.total));

  const tipStyle = { background: C.panelHi, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 12 };
  const CardBox = ({ title, children }: { title: string; children: any }) => (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18 }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  );

  return (
    <div>
      <SectionHeader title="Dashboard" subtitle="Visão geral, projeção de caixa e desempenho do escritório." />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 12 }}>
        {cards.map((c) => (
          <div key={c.label} onClick={c.onClick} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, cursor: c.onClick ? "pointer" : "default" }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: c.soft, display: "grid", placeItems: "center", marginBottom: 12 }}>
              <c.icon size={18} style={{ color: c.color }} />
            </div>
            <div style={{ fontSize: 21, fontWeight: 750 }}>{c.value}</div>
            <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 2 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Fluxo de caixa projetado */}
      <div style={{ marginTop: 16 }}>
        <CardBox title="Fluxo de caixa projetado — próximos 3 meses">
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 6 }}>
            <div><span style={{ fontSize: 12, color: C.textMuted }}>Entradas previstas</span><div style={{ fontSize: 18, fontWeight: 750, color: C.green }}>{brl(projReceber)}</div></div>
            <div><span style={{ fontSize: 12, color: C.textMuted }}>Saídas previstas</span><div style={{ fontSize: 18, fontWeight: 750, color: C.amber }}>{brl(projPagar)}</div></div>
            <div><span style={{ fontSize: 12, color: C.textMuted }}>Saldo previsto</span><div style={{ fontSize: 18, fontWeight: 750, color: projReceber - projPagar < 0 ? C.danger : C.green }}>{brl(projReceber - projPagar)}</div></div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={fluxoData} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis dataKey="mes" tick={{ fill: C.textMuted, fontSize: 12 }} axisLine={{ stroke: C.border }} tickLine={false} />
              <YAxis tick={{ fill: C.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => "R$" + (v >= 1000 ? (v / 1000).toFixed(0) + "k" : v)} width={48} />
              <Tooltip contentStyle={tipStyle} formatter={(v: any) => brl(v)} cursor={{ fill: "rgba(255,255,255,.03)" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="A receber" fill={C.brand} radius={[4, 4, 0, 0]} />
              <Bar dataKey="A pagar" fill={C.amber} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardBox>
      </div>

      {/* Receita x Despesa histórico */}
      <div style={{ marginTop: 16 }}>
        <CardBox title="Recebido × Pago — últimos 6 meses">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={mensalData} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis dataKey="mes" tick={{ fill: C.textMuted, fontSize: 12 }} axisLine={{ stroke: C.border }} tickLine={false} />
              <YAxis tick={{ fill: C.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => "R$" + (v >= 1000 ? (v / 1000).toFixed(0) + "k" : v)} width={48} />
              <Tooltip contentStyle={tipStyle} formatter={(v: any) => brl(v)} cursor={{ fill: "rgba(255,255,255,.03)" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Recebido" fill={C.green} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Pago" fill={C.danger} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardBox>
      </div>

      {/* Por categoria */}
      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        <CardBox title="Receita por categoria">
          {catRec.length === 0 ? <div style={{ color: C.textFaint, fontSize: 13 }}>Sem dados ainda.</div> : catRec.map((c) => (
            <div key={c.categoria} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}><span style={{ color: C.textMuted }}>{c.categoria}</span><span style={{ fontWeight: 650 }}>{brl(c.total)}</span></div>
              <div style={{ height: 7, background: C.panelHi, borderRadius: 4, overflow: "hidden" }}><div style={{ height: "100%", width: `${(c.total / maxRec) * 100}%`, background: C.green, borderRadius: 4 }} /></div>
            </div>
          ))}
        </CardBox>
        <CardBox title="Despesa por categoria">
          {catDesp.length === 0 ? <div style={{ color: C.textFaint, fontSize: 13 }}>Sem dados ainda.</div> : catDesp.map((c) => (
            <div key={c.categoria} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}><span style={{ color: C.textMuted }}>{c.categoria}</span><span style={{ fontWeight: 650 }}>{brl(c.total)}</span></div>
              <div style={{ height: 7, background: C.panelHi, borderRadius: 4, overflow: "hidden" }}><div style={{ height: "100%", width: `${(c.total / maxDesp) * 100}%`, background: C.amber, borderRadius: 4 }} /></div>
            </div>
          ))}
        </CardBox>
      </div>
    </div>
  );
}

/* ── Contas a Receber ── */
function TitulosTab() {
  const utils = trpc.useUtils();
  const { data: titulos = [], refetch, isLoading } = trpc.financeiro.listTitulos.useQuery({});
  const { data: clientsCfg = [] } = trpc.financeiro.clientsWithConfig.useQuery();
  const createMut = trpc.financeiro.createTitulo.useMutation();
  const cancelMut = trpc.financeiro.cancelTitulo.useMutation();
  const baixaMut = trpc.financeiro.baixaManual.useMutation();
  const reverterMut = trpc.financeiro.reverterBaixa.useMutation();
  const enviarMut = trpc.financeiro.enviarCobranca.useMutation();
  const enviarWaMut = trpc.financeiro.enviarCobrancaWhatsApp.useMutation();
  const deleteMut = trpc.financeiro.deleteTitulo.useMutation();
  const conferirMut = trpc.financeiro.conferirComprovante.useMutation();
  const [conferindo, setConferindo] = useState<any>(null);
  const { data: comprovantes = [] } = trpc.financeiro.listPayments.useQuery({ tituloId: conferindo?.id ?? 0 }, { enabled: !!conferindo });
  // atualiza painel + lista após qualquer ação
  const refreshAll = () => { refetch(); utils.financeiro.dashboard.invalidate(); utils.financeiro.listTitulos.invalidate(); };

  const [query, setQuery] = useState("");
  const [statusF, setStatusF] = useState("todos");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(null);
  const [baixaFor, setBaixaFor] = useState<any>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (titulos as any[]).filter((t) =>
      (statusF === "todos" || t.status === statusF) &&
      (!q || (t.clientName ?? "").toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q))
    );
  }, [titulos, query, statusF]);

  const openCreate = () => {
    setForm({ clientId: "", kind: "eventual", description: "", amount: "", competencia: "", dueDate: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10), sendDate: "" });
    setOpen(true);
  };
  const save = async () => {
    if (!form.clientId) return toast.error("Escolha o cliente");
    if (!form.description.trim()) return toast.error("Informe a descrição");
    if (!form.amount) return toast.error("Informe o valor");
    try {
      await createMut.mutateAsync({
        clientId: Number(form.clientId), kind: form.kind, description: form.description,
        amount: form.amount, competencia: form.competencia || undefined,
        dueDate: form.dueDate, sendDate: form.sendDate || undefined,
      });
      toast.success("Conta a receber criada"); setOpen(false); refreshAll();
    } catch (e: any) { toast.error(e?.message || "Não foi possível criar"); }
  };
  const cancel = async (t: any) => { if (!confirm("Cancelar esta conta a receber?")) return; try { await cancelMut.mutateAsync({ id: t.id }); toast.success("Cancelada"); refreshAll(); } catch (e: any) { toast.error(e?.message); } };
  const reverter = async (t: any) => { if (!confirm("Reverter a baixa? A conta volta para 'aberto'.")) return; try { await reverterMut.mutateAsync({ tituloId: t.id }); toast.success("Baixa revertida"); refreshAll(); } catch (e: any) { toast.error(e?.message); } };
  const doBaixa = async () => {
    try { await baixaMut.mutateAsync({ tituloId: baixaFor.id, amount: baixaFor._amount || undefined, paidDate: baixaFor._paidDate || undefined, method: baixaFor._method || undefined, note: baixaFor._note || undefined }); toast.success("Baixa registrada"); setBaixaFor(null); refreshAll(); }
    catch (e: any) { toast.error(e?.message || "Não foi possível dar baixa"); }
  };
  const enviar = async (t: any) => {
    if (!confirm(`Enviar a cobrança de ${brl(t.amount)} por e-mail para ${t.clientName}?`)) return;
    try { const r: any = await enviarMut.mutateAsync({ tituloId: t.id }); toast.success(`Cobrança enviada para ${r?.to || "o cliente"}`); refreshAll(); }
    catch (e: any) { toast.error(e?.message || "Não foi possível enviar"); }
  };
  const enviarWa = async (t: any) => {
    if (!confirm(`Enviar a cobrança de ${brl(t.amount)} pelo WhatsApp para ${t.clientName}?`)) return;
    try { await enviarWaMut.mutateAsync({ tituloId: t.id }); toast.success("Cobrança enviada pelo WhatsApp"); refreshAll(); }
    catch (e: any) { toast.error(e?.message || "Não foi possível enviar pelo WhatsApp"); }
  };
  const excluir = async (t: any) => {
    if (!confirm(`Excluir DEFINITIVAMENTE este lançamento de ${t.clientName}? Não dá para desfazer.`)) return;
    try { await deleteMut.mutateAsync({ id: t.id }); toast.success("Lançamento excluído"); refreshAll(); }
    catch (e: any) { toast.error(e?.message || "Não foi possível excluir"); }
  };
  const conferir = async (decisao: "confirmar" | "rejeitar") => {
    const pay = (comprovantes as any[]).find((p) => p.status === "aguardando_conferencia") || (comprovantes as any[])[0];
    if (!pay) return toast.error("Nenhum comprovante para conferir");
    if (decisao === "rejeitar" && !confirm("Rejeitar o comprovante? A cobrança volta para 'enviado'.")) return;
    try { await conferirMut.mutateAsync({ paymentId: pay.id, decisao }); toast.success(decisao === "confirmar" ? "Comprovante confirmado — baixa dada" : "Comprovante rejeitado"); setConferindo(null); refreshAll(); }
    catch (e: any) { toast.error(e?.message || "Não foi possível conferir"); }
  };

  return (
    <div>
      <SectionHeader title="Contas a receber" subtitle="Honorários e serviços a cobrar. Você pode dar baixa manual e reverter se precisar."
        action={<button onClick={openCreate} style={{ ...primaryBtn, display: "inline-flex", alignItems: "center", gap: 7 }}><PlusCircle size={16} /> Nova conta</button>} />

      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={16} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: C.textFaint }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por cliente ou descrição…"
            style={{ ...fieldStyle, paddingLeft: 38 }} />
        </div>
        <select value={statusF} onChange={(e) => setStatusF(e.target.value)} style={{ ...fieldStyle, width: "auto", cursor: "pointer" }}>
          <option value="todos">Todos os status</option>
          {Object.keys(STATUS_LABEL).map((s) => (<option key={s} value={s}>{STATUS_LABEL[s].label}</option>))}
        </select>
      </div>

      {isLoading ? <div style={{ color: C.textFaint, textAlign: "center", padding: 40 }}>Carregando…</div>
        : filtered.length === 0 ? <div style={{ color: C.textFaint, textAlign: "center", padding: 40 }}>Nenhuma conta a receber {query || statusF !== "todos" ? "com esse filtro" : "ainda"}.</div>
        : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((t: any) => {
              const st = STATUS_LABEL[t.status] || STATUS_LABEL.aberto;
              return (
                <div key={t.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 650, fontSize: 14.5 }}>{t.clientName || "—"}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: st.color, background: st.soft, padding: "2px 8px", borderRadius: 6 }}>{st.label}</span>
                      {t.kind === "honorario" && <span style={{ fontSize: 10.5, fontWeight: 600, color: C.brandText, background: C.brandSoft, padding: "2px 7px", borderRadius: 5 }}>Honorário</span>}
                    </div>
                    <div style={{ fontSize: 12.5, color: C.textFaint, marginTop: 3 }}>
                      {t.description}{t.competencia ? ` · ${t.competencia}` : ""} · vence {new Date(t.dueDate).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 750, color: t.status === "pago" ? C.green : C.text }}>{brl(t.amount)}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {t.status === "em_conferencia" && (
                      <button onClick={() => setConferindo(t)} title="Conferir comprovante" style={{ ...iconBtn, color: C.amber, borderColor: "rgba(224,164,88,.4)", background: C.amberSoft }}><Eye size={15} /></button>
                    )}
                    {t.status !== "cancelado" && t.status !== "pago" && (
                      <button onClick={() => enviar(t)} disabled={enviarMut.isPending} title="Enviar cobrança por e-mail" style={{ ...iconBtn, color: "#7dd3fc", borderColor: "rgba(125,211,252,.3)" }}><Send size={15} /></button>
                    )}
                    {t.status !== "cancelado" && t.status !== "pago" && (
                      <button onClick={() => enviarWa(t)} disabled={enviarWaMut.isPending} title="Enviar cobrança pelo WhatsApp" style={{ ...iconBtn, color: "#25d366", borderColor: "rgba(37,211,102,.35)" }}><MessageCircle size={15} /></button>
                    )}
                    {t.status === "pago" ? (
                      <button onClick={() => reverter(t)} title="Reverter baixa" style={{ ...iconBtn, color: C.amber }}><RotateCcw size={15} /></button>
                    ) : t.status !== "cancelado" ? (
                      <button onClick={() => setBaixaFor({ ...t, _amount: t.amount, _paidDate: new Date().toISOString().slice(0, 10), _method: "pix" })} title="Dar baixa (pago)" style={{ ...iconBtn, color: C.green, borderColor: "rgba(52,211,153,.3)" }}><CheckCircle2 size={15} /></button>
                    ) : null}
                    {t.status !== "cancelado" && t.status !== "pago" && (
                      <button onClick={() => cancel(t)} title="Cancelar" style={{ ...iconBtn, color: C.danger }}><Trash2 size={15} /></button>
                    )}
                    {t.status === "cancelado" && (
                      <button onClick={() => excluir(t)} disabled={deleteMut.isPending} title="Excluir definitivamente" style={{ ...iconBtn, color: C.danger, borderColor: "rgba(248,113,113,.4)", background: C.dangerSoft }}><Trash2 size={15} /></button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      {/* Nova conta */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[88vh] overflow-y-auto" style={{ background: C.panel, borderColor: C.border, color: C.text }}>
          <DialogHeader><DialogTitle style={{ color: C.text }}>Nova conta a receber</DialogTitle></DialogHeader>
          {form && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 4 }}>
              <div>
                <label style={labelStyle}>Cliente</label>
                <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} style={{ ...fieldStyle, cursor: "pointer" }}>
                  <option value="">Selecione…</option>
                  {(clientsCfg as any[]).map((c) => (<option key={c.clientId} value={c.clientId}>{c.name}</option>))}
                </select>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Tipo</label>
                  <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} style={{ ...fieldStyle, cursor: "pointer" }}>
                    <option value="eventual">Serviço eventual</option>
                    <option value="honorario">Honorário</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Valor (R$)</label>
                  <input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0,00" style={fieldStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Descrição</label>
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex.: Abertura de empresa, Honorário mensal…" style={fieldStyle} />
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Vencimento</label>
                  <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} style={{ ...fieldStyle, colorScheme: "dark" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Competência (opcional)</label>
                  <input value={form.competencia} onChange={(e) => setForm({ ...form, competencia: e.target.value })} placeholder="MM/AAAA" style={fieldStyle} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button onClick={() => setOpen(false)} style={ghostBtn}>Cancelar</button>
                <button onClick={save} disabled={createMut.isPending} style={primaryBtn}>Criar</button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Baixa manual */}
      <Dialog open={!!baixaFor} onOpenChange={(v) => { if (!v) setBaixaFor(null); }}>
        <DialogContent className="max-w-md" style={{ background: C.panel, borderColor: C.border, color: C.text }}>
          <DialogHeader><DialogTitle style={{ color: C.text }}>Dar baixa (marcar como pago)</DialogTitle></DialogHeader>
          {baixaFor && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 4 }}>
              <p style={{ fontSize: 13, color: C.textMuted }}>{baixaFor.clientName} · {baixaFor.description}</p>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Valor recebido</label>
                  <input value={baixaFor._amount} onChange={(e) => setBaixaFor({ ...baixaFor, _amount: e.target.value })} style={fieldStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Data</label>
                  <input type="date" value={baixaFor._paidDate} onChange={(e) => setBaixaFor({ ...baixaFor, _paidDate: e.target.value })} style={{ ...fieldStyle, colorScheme: "dark" }} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Forma</label>
                <select value={baixaFor._method} onChange={(e) => setBaixaFor({ ...baixaFor, _method: e.target.value })} style={{ ...fieldStyle, cursor: "pointer" }}>
                  <option value="pix">PIX</option><option value="boleto">Boleto</option><option value="dinheiro">Dinheiro</option><option value="transferencia">Transferência</option><option value="manual">Outro</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button onClick={() => setBaixaFor(null)} style={ghostBtn}>Cancelar</button>
                <button onClick={doBaixa} disabled={baixaMut.isPending} style={{ ...primaryBtn, background: C.green }}>Confirmar baixa</button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Conferência de comprovante */}
      <Dialog open={!!conferindo} onOpenChange={(v) => { if (!v) setConferindo(null); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" style={{ background: C.panel, borderColor: C.border, color: C.text }}>
          <DialogHeader><DialogTitle style={{ color: C.text }}>Conferir comprovante</DialogTitle></DialogHeader>
          {conferindo && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 4 }}>
              <p style={{ fontSize: 13, color: C.textMuted }}>{conferindo.clientName} · {conferindo.description} · <strong style={{ color: C.text }}>{brl(conferindo.amount)}</strong></p>
              {(comprovantes as any[]).length === 0 ? (
                <div style={{ color: C.textFaint, textAlign: "center", padding: 20, fontSize: 13 }}>Carregando comprovante…</div>
              ) : (
                (comprovantes as any[]).map((p) => (
                  <div key={p.id} style={{ background: C.panelHi, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 12, color: C.textFaint, marginBottom: 8 }}>
                      Enviado {p.submittedByClient ? "pelo cliente" : "manualmente"} · {p.createdAt ? new Date(p.createdAt).toLocaleString("pt-BR") : ""}
                      {p.status !== "aguardando_conferencia" && ` · ${p.status === "confirmado" ? "✓ confirmado" : "✗ rejeitado"}`}
                    </div>
                    {p.comprovanteUrl ? (
                      String(p.comprovanteUrl).startsWith("data:image") ? (
                        <a href={p.comprovanteUrl} target="_blank" rel="noreferrer"><img src={p.comprovanteUrl} alt="comprovante" style={{ width: "100%", borderRadius: 8, border: `1px solid ${C.border}` }} /></a>
                      ) : (
                        <a href={p.comprovanteUrl} target="_blank" rel="noreferrer" download={`comprovante-${p.id}.pdf`} style={{ display: "inline-block", background: C.brandSoft, color: C.brandText, borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>📄 Abrir comprovante (PDF)</a>
                      )
                    ) : <span style={{ fontSize: 13, color: C.textFaint }}>Sem arquivo anexado</span>}
                  </div>
                ))
              )}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button onClick={() => conferir("rejeitar")} disabled={conferirMut.isPending} style={{ ...ghostBtn, color: C.danger, borderColor: "rgba(248,113,113,.4)" }}>Rejeitar</button>
                <button onClick={() => conferir("confirmar")} disabled={conferirMut.isPending} style={{ ...primaryBtn, background: C.green }}>Confirmar e dar baixa</button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Honorários (config por cliente) ── */
function HonorariosTab() {
  const utils = trpc.useUtils();
  const { data: rows = [], refetch, isLoading } = trpc.financeiro.clientsWithConfig.useQuery();
  const upsertMut = trpc.financeiro.upsertClientConfig.useMutation();
  const ativarMut = trpc.financeiro.ativarHonorario.useMutation();
  const pausarMut = trpc.financeiro.pausarHonorario.useMutation();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<any>(null);
  const ymNow = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
  const [activating, setActivating] = useState<any>(null);
  const [firstMonth, setFirstMonth] = useState(ymNow());

  const confirmAtivar = async () => {
    if (!activating) return;
    const [y, m] = (firstMonth || ymNow()).split("-");
    const comp = `${m}/${y}`; // MM/AAAA
    try {
      const res: any = await ativarMut.mutateAsync({ clientId: activating.clientId, competencia: comp });
      toast.success(res?.recurring ? `Ativado — 1º honorário de ${res?.competencia} gerado; os próximos meses seguem automáticos` : `Honorário de ${res?.competencia} gerado (mês único)`);
      setActivating(null); refetch(); utils.financeiro.dashboard.invalidate(); utils.financeiro.listTitulos.invalidate();
    } catch (e: any) { toast.error(e?.message || "Não foi possível ativar"); }
  };
  const pausar = async (r: any) => {
    if (!confirm(`Pausar a recorrência de ${r.name}? Não gera mais cobranças automáticas (as já criadas permanecem).`)) return;
    try { await pausarMut.mutateAsync({ clientId: r.clientId }); toast.success("Recorrência pausada"); refetch(); }
    catch (e: any) { toast.error(e?.message); }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows as any[]).filter((r) => !q || (r.name ?? "").toLowerCase().includes(q));
  }, [rows, query]);

  const save = async () => {
    try {
      await upsertMut.mutateAsync({
        clientId: editing.clientId,
        hasHonorario: !!editing.hasHonorario,
        honorarioValue: editing.hasHonorario ? String(editing.honorarioValue || "0") : undefined,
        dueDay: editing.hasHonorario && editing.dueDay ? Number(editing.dueDay) : undefined,
        sendDay: editing.hasHonorario && editing.sendDay ? Number(editing.sendDay) : undefined,
        weekendRule: editing.weekendRule || "mantem",
        recurring: editing.recurring !== false,
        autoSend: editing.autoSend !== false,
        billingEmail: editing.billingEmail || "",
      });
      toast.success("Honorário configurado"); setEditing(null); refetch(); utils.financeiro.dashboard.invalidate();
    } catch (e: any) { toast.error(e?.message || "Não foi possível salvar"); }
  };

  return (
    <div>
      <SectionHeader title="Honorários por cliente" subtitle="Clientes vêm do módulo de Tarefas. Configure aqui quem tem honorário mensal, o valor e as datas." />
      <div style={{ position: "relative", marginBottom: 14 }}>
        <Search size={16} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: C.textFaint }} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar cliente…" style={{ ...fieldStyle, paddingLeft: 38 }} />
      </div>

      {isLoading ? <div style={{ color: C.textFaint, textAlign: "center", padding: 40 }}>Carregando…</div>
        : filtered.length === 0 ? <div style={{ color: C.textFaint, textAlign: "center", padding: 40 }}>Nenhum cliente encontrado. Cadastre clientes no módulo de Tarefas.</div>
        : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((r: any) => (
              <div key={r.clientId} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 650, fontSize: 14.5 }}>{r.name}</div>
                  <div style={{ fontSize: 12.5, color: C.textFaint, marginTop: 2 }}>
                    {r.hasHonorario
                      ? <>{brl(r.honorarioValue)} · vence dia {r.dueDay || "—"} · cobra dia {r.sendDay || "—"} · {r.recurring !== false ? "recorrente" : "mês único"}</>
                      : "Sem honorário mensal configurado"}
                  </div>
                </div>
                {r.hasHonorario && (
                  r.activated
                    ? <span style={{ fontSize: 10.5, fontWeight: 700, color: C.green, background: C.greenSoft, padding: "3px 9px", borderRadius: 6 }}>▶ Ativo{r.recurring !== false ? " (recorrente)" : ""}</span>
                    : r.honorarioValue && r.dueDay
                      ? <span style={{ fontSize: 10.5, fontWeight: 700, color: C.amber, background: C.amberSoft, padding: "3px 9px", borderRadius: 6 }}>Configurado — pausado</span>
                      : <span style={{ fontSize: 10.5, fontWeight: 700, color: C.textFaint, background: "rgba(92,113,109,.14)", padding: "3px 9px", borderRadius: 6 }}>Falta configurar</span>
                )}
                {r.hasHonorario && r.honorarioValue && r.dueDay && (
                  r.activated
                    ? <button onClick={() => pausar(r)} disabled={pausarMut.isPending} title="Pausar recorrência"
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, padding: "7px 11px", borderRadius: 9, border: `1px solid ${C.border}`, background: "transparent", color: C.textMuted, cursor: "pointer", whiteSpace: "nowrap" }}>
                        <Pause size={13} /> Pausar
                      </button>
                    : <button onClick={() => { setFirstMonth(ymNow()); setActivating(r); }} disabled={ativarMut.isPending} title="Ativar: gera o honorário e, se recorrente, repete todo mês"
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, padding: "7px 12px", borderRadius: 9, border: "none", background: C.green, color: "#04211f", cursor: "pointer", whiteSpace: "nowrap" }}>
                        <Play size={13} /> Ativar
                      </button>
                )}
                <button onClick={() => setEditing({ ...r, honorarioValue: r.honorarioValue || "", dueDay: r.dueDay || "", sendDay: r.sendDay || "", weekendRule: r.weekendRule || "mantem", recurring: r.recurring !== false, autoSend: r.autoSend !== false, billingEmail: r.billingEmail || "" })}
                  style={{ ...iconBtn }} title="Configurar"><Pencil size={15} /></button>
              </div>
            ))}
          </div>
        )}

      {/* Ativar: escolhe o mês do PRIMEIRO honorário (ex.: cadastrei hoje mas começa mês que vem) */}
      <Dialog open={!!activating} onOpenChange={(v) => { if (!v) setActivating(null); }}>
        <DialogContent className="max-w-sm" style={{ background: C.panel, borderColor: C.border, color: C.text }}>
          <DialogHeader><DialogTitle style={{ color: C.text }}>Ativar honorário — {activating?.name}</DialogTitle></DialogHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 4 }}>
            <div>
              <label style={labelStyle}>Primeiro honorário (mês/competência)</label>
              <input type="month" value={firstMonth} onChange={(e) => setFirstMonth(e.target.value)} style={{ ...fieldStyle, colorScheme: "dark" }} />
              <div style={{ fontSize: 12, color: C.textFaint, marginTop: 6 }}>Vence no dia {activating?.dueDay || "—"} desse mês. Os próximos meses seguem automaticamente se for recorrente.</div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setActivating(null)} style={ghostBtn}>Cancelar</button>
              <button onClick={confirmAtivar} disabled={ativarMut.isPending} style={primaryBtn}>Ativar</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(v) => { if (!v) setEditing(null); }}>
        <DialogContent className="max-w-md max-h-[88vh] overflow-y-auto" style={{ background: C.panel, borderColor: C.border, color: C.text }}>
          <DialogHeader><DialogTitle style={{ color: C.text }}>Honorário — {editing?.name}</DialogTitle></DialogHeader>
          {editing && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 4 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", background: C.panelHi, border: `1px solid ${editing.hasHonorario ? C.brand : C.border}`, borderRadius: 10, padding: "11px 13px" }}>
                <input type="checkbox" checked={!!editing.hasHonorario} onChange={(e) => setEditing({ ...editing, hasHonorario: e.target.checked })} style={{ accentColor: C.brand, width: 17, height: 17 }} />
                <span style={{ fontSize: 14, fontWeight: 600 }}>Este cliente tem honorário mensal</span>
              </label>
              {editing.hasHonorario && (
                <>
                  <div>
                    <label style={labelStyle}>Valor do honorário (R$)</label>
                    <input value={editing.honorarioValue} onChange={(e) => setEditing({ ...editing, honorarioValue: e.target.value })} placeholder="0,00" style={fieldStyle} />
                  </div>
                  <div style={{ display: "flex", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Dia do vencimento</label>
                      <input type="number" min={1} max={28} value={editing.dueDay} onChange={(e) => setEditing({ ...editing, dueDay: e.target.value })} placeholder="1 a 28" style={fieldStyle} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Dia de enviar cobrança</label>
                      <input type="number" min={1} max={28} value={editing.sendDay} onChange={(e) => setEditing({ ...editing, sendDay: e.target.value })} placeholder="1 a 28" style={fieldStyle} />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Recorrência</label>
                    <select value={editing.recurring !== false ? "sim" : "nao"} onChange={(e) => setEditing({ ...editing, recurring: e.target.value === "sim" })} style={{ ...fieldStyle, cursor: "pointer" }}>
                      <option value="sim">Recorrente — gera todo mês automaticamente</option>
                      <option value="nao">Mês único — gera só quando eu ativar</option>
                    </select>
                  </div>
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", background: C.panelHi, border: `1px solid ${editing.autoSend !== false ? C.brand : C.border}`, borderRadius: 10, padding: "11px 13px" }}>
                    <input type="checkbox" checked={editing.autoSend !== false} onChange={(e) => setEditing({ ...editing, autoSend: e.target.checked })} style={{ accentColor: C.brand, width: 17, height: 17, marginTop: 1 }} />
                    <span style={{ fontSize: 13 }}>
                      <strong>Enviar a cobrança automaticamente</strong>
                      <span style={{ display: "block", color: C.textMuted, marginTop: 2, fontSize: 12.5 }}>Desligue para o honorário entrar no “a receber” (para ter noção) sem disparar nenhuma cobrança ao cliente.</span>
                    </span>
                  </label>
                  <div>
                    <label style={labelStyle}>Se o vencimento cair em fim de semana/feriado</label>
                    <select value={editing.weekendRule} onChange={(e) => setEditing({ ...editing, weekendRule: e.target.value })} style={{ ...fieldStyle, cursor: "pointer" }}>
                      <option value="mantem">Mantém a data</option>
                      <option value="antecipa">Antecipa (dia útil anterior)</option>
                      <option value="posterga">Posterga (próximo dia útil)</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>E-mail de cobrança (opcional — vazio usa o do cadastro)</label>
                    <input value={editing.billingEmail} onChange={(e) => setEditing({ ...editing, billingEmail: e.target.value })} placeholder={editing.email || "email@cliente.com"} style={fieldStyle} />
                  </div>
                </>
              )}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button onClick={() => setEditing(null)} style={ghostBtn}>Cancelar</button>
                <button onClick={save} disabled={upsertMut.isPending} style={primaryBtn}>Salvar</button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Contas a Pagar ── */
function PayablesTab() {
  const utils = trpc.useUtils();
  const { data: rows = [], refetch, isLoading } = trpc.financeiro.listPayables.useQuery({});
  const createMut = trpc.financeiro.createPayable.useMutation();
  const { data: empresas = [] } = trpc.financeiro.clientsWithConfig.useQuery();
  const baixaMut = trpc.financeiro.baixaPayable.useMutation();
  const reverterMut = trpc.financeiro.reverterPayable.useMutation();
  const deleteMut = trpc.financeiro.deletePayable.useMutation();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(null);
  const refreshAll = () => { refetch(); utils.financeiro.dashboard.invalidate(); };

  const PAY_STATUS: Record<string, { label: string; color: string; soft: string }> = {
    aberto: { label: "Aberto", color: C.amber, soft: C.amberSoft },
    pago: { label: "Pago", color: C.green, soft: C.greenSoft },
    vencido: { label: "Vencido", color: C.danger, soft: C.dangerSoft },
    cancelado: { label: "Cancelado", color: C.textFaint, soft: "rgba(92,113,109,.14)" },
  };
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows as any[]).filter((p) => !q || (p.description ?? "").toLowerCase().includes(q) || (p.supplier ?? "").toLowerCase().includes(q));
  }, [rows, query]);

  const openCreate = () => { setForm({ description: "", supplier: "", category: "", clientId: "", amount: "", dueDate: new Date().toISOString().slice(0, 10), recurring: false }); setOpen(true); };
  const save = async () => {
    if (!form.description.trim()) return toast.error("Informe a descrição");
    if (!form.amount) return toast.error("Informe o valor");
    try { await createMut.mutateAsync({ description: form.description, supplier: form.supplier || undefined, category: form.category || undefined, clientId: form.clientId ? Number(form.clientId) : undefined, amount: form.amount, dueDate: form.dueDate, recurring: !!form.recurring }); toast.success("Conta a pagar criada"); setOpen(false); refreshAll(); }
    catch (e: any) { toast.error(e?.message || "Não foi possível criar"); }
  };
  const baixa = async (p: any) => { try { await baixaMut.mutateAsync({ id: p.id }); toast.success("Marcada como paga"); refreshAll(); } catch (e: any) { toast.error(e?.message); } };
  const reverter = async (p: any) => { try { await reverterMut.mutateAsync({ id: p.id }); toast.success("Revertida"); refreshAll(); } catch (e: any) { toast.error(e?.message); } };
  const excluir = async (p: any) => { if (!confirm(`Excluir "${p.description}"?`)) return; try { await deleteMut.mutateAsync({ id: p.id }); toast.success("Excluída"); refreshAll(); } catch (e: any) { toast.error(e?.message); } };

  return (
    <div>
      <SectionHeader title="Contas a pagar" subtitle="Despesas e fornecedores do escritório — para acompanhar o que sai e o saldo."
        action={<button onClick={openCreate} style={{ ...primaryBtn, display: "inline-flex", alignItems: "center", gap: 7 }}><PlusCircle size={16} /> Nova despesa</button>} />
      <div style={{ position: "relative", marginBottom: 14 }}>
        <Search size={16} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: C.textFaint }} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por descrição ou fornecedor…" style={{ ...fieldStyle, paddingLeft: 38 }} />
      </div>

      {isLoading ? <div style={{ color: C.textFaint, textAlign: "center", padding: 40 }}>Carregando…</div>
        : filtered.length === 0 ? <div style={{ color: C.textFaint, textAlign: "center", padding: 40 }}>Nenhuma conta a pagar {query ? "com esse filtro" : "ainda"}.</div>
        : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((p: any) => {
              const st = PAY_STATUS[p.status] || PAY_STATUS.aberto;
              return (
                <div key={p.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 650, fontSize: 14.5 }}>{p.description}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: st.color, background: st.soft, padding: "2px 8px", borderRadius: 6 }}>{st.label}</span>
                      {p.recurring && <span style={{ fontSize: 10.5, fontWeight: 600, color: C.brandText, background: C.brandSoft, padding: "2px 7px", borderRadius: 5 }}>Fixa</span>}
                    </div>
                    <div style={{ fontSize: 12.5, color: C.textFaint, marginTop: 3 }}>
                      {p.clientName ? p.clientName + " · " : ""}{p.supplier ? p.supplier + " · " : ""}{p.category ? p.category + " · " : ""}vence {new Date(p.dueDate).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 750, color: p.status === "pago" ? C.green : C.text }}>{brl(p.amount)}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {p.status === "pago"
                      ? <button onClick={() => reverter(p)} title="Reverter pagamento" style={{ ...iconBtn, color: C.amber }}><RotateCcw size={15} /></button>
                      : <button onClick={() => baixa(p)} title="Marcar como paga" style={{ ...iconBtn, color: C.green, borderColor: "rgba(52,211,153,.3)" }}><CheckCircle2 size={15} /></button>}
                    <button onClick={() => excluir(p)} title="Excluir" style={{ ...iconBtn, color: C.danger }}><Trash2 size={15} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[88vh] overflow-y-auto" style={{ background: C.panel, borderColor: C.border, color: C.text }}>
          <DialogHeader><DialogTitle style={{ color: C.text }}>Nova conta a pagar</DialogTitle></DialogHeader>
          {form && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 4 }}>
              <div>
                <label style={labelStyle}>Descrição</label>
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex.: Aluguel, Energia, Salário…" style={fieldStyle} />
              </div>
              <div>
                <label style={labelStyle}>Empresa</label>
                <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} style={{ ...fieldStyle, cursor: "pointer" }}>
                  <option value="">— Despesa geral do escritório —</option>
                  {(empresas as any[]).map((c) => (<option key={c.clientId} value={c.clientId}>{c.name}</option>))}
                </select>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Fornecedor (opcional)</label>
                  <input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} style={fieldStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Categoria (opcional)</label>
                  <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Aluguel, Impostos…" style={fieldStyle} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Valor (R$)</label>
                  <input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0,00" style={fieldStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Vencimento</label>
                  <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} style={{ ...fieldStyle, colorScheme: "dark" }} />
                </div>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}>
                <input type="checkbox" checked={!!form.recurring} onChange={(e) => setForm({ ...form, recurring: e.target.checked })} style={{ accentColor: C.brand }} />
                <span style={{ fontSize: 13.5 }}>Despesa fixa mensal</span>
              </label>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button onClick={() => setOpen(false)} style={ghostBtn}>Cancelar</button>
                <button onClick={save} disabled={createMut.isPending} style={primaryBtn}>Criar</button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Recebimento (PIX) ── */
function RecebimentoTab() {
  const { data: cfg, refetch } = trpc.financeiro.getConfig.useQuery();
  const upsertMut = trpc.financeiro.upsertConfig.useMutation();
  const [form, setForm] = useState<any>(null);
  const current = form ?? {
    pixKey: cfg?.pixKey || "", pixKeyType: cfg?.pixKeyType || "cnpj", beneficiaryName: cfg?.beneficiaryName || "",
    beneficiaryDoc: cfg?.beneficiaryDoc || "", instructions: cfg?.instructions || "", active: cfg?.active || false,
    autoCobranca: (cfg as any)?.autoCobranca || false, lembreteDias: (cfg as any)?.lembreteDias ?? 2,
  };
  const set = (k: string, v: any) => setForm({ ...current, [k]: v });
  const save = async () => {
    try { await upsertMut.mutateAsync(current); toast.success("Configuração salva"); setForm(null); refetch(); }
    catch (e: any) { toast.error(e?.message || "Não foi possível salvar"); }
  };
  return (
    <div>
      <SectionHeader title="Recebimento (PIX)" subtitle="Dados da conta PJ para o boleto/e-mail de cobrança. Deixe pronto e ative quando a conta estiver disponível." />
      <div style={{ background: C.amberSoft, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, fontSize: 13, color: C.textMuted, marginBottom: 18 }}>
        Ainda sem conta PJ? Sem problema — preencha o que já tiver e deixe <strong style={{ color: C.text }}>desativado</strong>. O envio de cobrança com QR/PIX (Fase 4) só liga quando você marcar como ativo.
      </div>
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, maxWidth: 560, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 2 }}>
            <label style={labelStyle}>Chave PIX</label>
            <input value={current.pixKey} onChange={(e) => set("pixKey", e.target.value)} placeholder="CNPJ, e-mail, telefone ou aleatória" style={fieldStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Tipo</label>
            <select value={current.pixKeyType} onChange={(e) => set("pixKeyType", e.target.value)} style={{ ...fieldStyle, cursor: "pointer" }}>
              <option value="cpf">CPF</option><option value="cnpj">CNPJ</option><option value="email">E-mail</option><option value="telefone">Telefone</option><option value="aleatoria">Aleatória</option>
            </select>
          </div>
        </div>
        <div>
          <label style={labelStyle}>Nome do beneficiário (conta PJ)</label>
          <input value={current.beneficiaryName} onChange={(e) => set("beneficiaryName", e.target.value)} placeholder="Equilibrium Consultoria Contábil LTDA" style={fieldStyle} />
        </div>
        <div>
          <label style={labelStyle}>CNPJ do beneficiário</label>
          <input value={current.beneficiaryDoc} onChange={(e) => set("beneficiaryDoc", e.target.value)} placeholder="00.000.000/0001-00" style={fieldStyle} />
        </div>
        <div>
          <label style={labelStyle}>Instruções no e-mail de cobrança (opcional)</label>
          <textarea value={current.instructions} onChange={(e) => set("instructions", e.target.value)} rows={3} placeholder="Ex.: Em caso de dúvida, fale com o escritório." style={{ ...fieldStyle, resize: "vertical", fontFamily: "inherit" }} />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <input type="checkbox" checked={!!current.active} onChange={(e) => set("active", e.target.checked)} style={{ accentColor: C.green, width: 17, height: 17 }} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>Ativar cobrança com PIX/QR (ligar só quando a conta PJ estiver pronta)</span>
        </label>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={save} disabled={upsertMut.isPending} style={primaryBtn}>Salvar configuração</button>
        </div>
      </div>

      {/* Régua de cobrança automática */}
      <div style={{ marginTop: 22 }}>
        <SectionHeader title="Régua de cobrança automática" subtitle="O sistema envia a cobrança no dia configurado e um lembrete após o vencimento — sozinho." />
        <div style={{ background: C.dangerSoft, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, fontSize: 13, color: C.textMuted, marginBottom: 18 }}>
          <strong style={{ color: C.text }}>Atenção:</strong> com isto <strong style={{ color: C.text }}>ligado</strong>, o sistema dispara e-mails de verdade para os clientes automaticamente. Enquanto estiver testando, deixe <strong style={{ color: C.text }}>desligado</strong> — você continua enviando manualmente pelo botão de avião em cada cobrança.
        </div>
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, maxWidth: 560, display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", background: C.panelHi, border: `1px solid ${current.autoCobranca ? C.green : C.border}`, borderRadius: 10, padding: "12px 14px" }}>
            <input type="checkbox" checked={!!current.autoCobranca} onChange={(e) => set("autoCobranca", e.target.checked)} style={{ accentColor: C.green, width: 18, height: 18 }} />
            <span style={{ fontSize: 14, fontWeight: 650 }}>Ligar envio automático de cobranças e lembretes</span>
          </label>
          <div style={{ maxWidth: 240 }}>
            <label style={labelStyle}>Enviar lembrete após o vencimento (dias)</label>
            <input type="number" min={0} max={60} value={current.lembreteDias} onChange={(e) => set("lembreteDias", Number(e.target.value))} style={fieldStyle} />
          </div>
          <p style={{ fontSize: 12.5, color: C.textFaint }}>
            Envio: no dia que você definiu em cada honorário (campo "cobra dia"). Lembrete: uma vez, {current.lembreteDias || 2} dia(s) após o vencimento, se ainda não houver comprovante. Cobranças já pagas ou canceladas são ignoradas.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={save} disabled={upsertMut.isPending} style={primaryBtn}>Salvar régua</button>
          </div>
        </div>
      </div>
    </div>
  );
}
