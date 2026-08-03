import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowLeft, Wallet, Receipt, Repeat, QrCode, PlusCircle, Pencil, Trash2, Search, Lock,
  CheckCircle2, RotateCcw, TrendingUp, Clock, AlertTriangle, X, Send, Mail, Play, Pause, TrendingDown, Wallet2, Scale,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

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
  const cards = [
    { label: "A receber", value: brl(data?.aReceber ?? 0), icon: Clock, color: C.brandText, soft: C.brandSoft, onClick: () => onGo("titulos") },
    { label: "Recebido", value: brl(data?.recebido ?? 0), icon: CheckCircle2, color: C.green, soft: C.greenSoft, onClick: () => onGo("titulos") },
    { label: "A pagar", value: brl(data?.aPagar ?? 0), icon: TrendingDown, color: C.amber, soft: C.amberSoft, onClick: () => onGo("pagar") },
    { label: "Saldo (recebido − pago)", value: brl(data?.saldo ?? 0), icon: Scale, color: Number(String(data?.saldo ?? 0).replace(",", ".")) < 0 ? C.danger : C.green, soft: Number(String(data?.saldo ?? 0).replace(",", ".")) < 0 ? C.dangerSoft : C.greenSoft },
    { label: "Vencidos", value: String(data?.vencidos ?? 0), icon: AlertTriangle, color: C.danger, soft: C.dangerSoft, onClick: () => onGo("titulos") },
    { label: "Em conferência", value: String(data?.emConferencia ?? 0), icon: Receipt, color: C.amber, soft: C.amberSoft, onClick: () => onGo("titulos") },
    { label: "Honorários ativos", value: String(data?.honorariosAtivos ?? 0), icon: Repeat, color: C.brandText, soft: C.brandSoft, onClick: () => onGo("honorarios") },
  ];
  return (
    <div>
      <SectionHeader title="Visão geral" subtitle="Resumo das cobranças do escritório." />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
        {cards.map((c) => (
          <div key={c.label} onClick={c.onClick} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, cursor: c.onClick ? "pointer" : "default" }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: c.soft, display: "grid", placeItems: "center", marginBottom: 12 }}>
              <c.icon size={18} style={{ color: c.color }} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 750 }}>{c.value}</div>
            <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 2 }}>{c.label}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 20, background: C.brandSoft, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, fontSize: 13, color: C.textMuted }}>
        Esta é a <strong style={{ color: C.text }}>Fase 1</strong> do Financeiro: cadastro de honorários e serviços, contas a receber e baixa manual.
        Cobrança automática por e-mail, comprovante pelo portal e boleto/PIX entram nas próximas fases.
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
  const deleteMut = trpc.financeiro.deleteTitulo.useMutation();
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
  const excluir = async (t: any) => {
    if (!confirm(`Excluir DEFINITIVAMENTE este lançamento de ${t.clientName}? Não dá para desfazer.`)) return;
    try { await deleteMut.mutateAsync({ id: t.id }); toast.success("Lançamento excluído"); refreshAll(); }
    catch (e: any) { toast.error(e?.message || "Não foi possível excluir"); }
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
                    {t.status !== "cancelado" && t.status !== "pago" && (
                      <button onClick={() => enviar(t)} disabled={enviarMut.isPending} title="Enviar cobrança por e-mail" style={{ ...iconBtn, color: "#7dd3fc", borderColor: "rgba(125,211,252,.3)" }}><Send size={15} /></button>
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

  const ativar = async (r: any) => {
    try {
      const res: any = await ativarMut.mutateAsync({ clientId: r.clientId });
      toast.success(res?.recurring ? `Ativado e recorrente — cobrança de ${res?.competencia} gerada; os próximos meses serão automáticos` : `Cobrança de ${res?.competencia} gerada (mês único)`);
      refetch(); utils.financeiro.dashboard.invalidate(); utils.financeiro.listTitulos.invalidate();
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
                    : <button onClick={() => ativar(r)} disabled={ativarMut.isPending} title="Ativar: gera a cobrança e, se recorrente, repete todo mês"
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, padding: "7px 12px", borderRadius: 9, border: "none", background: C.green, color: "#04211f", cursor: "pointer", whiteSpace: "nowrap" }}>
                        <Play size={13} /> Ativar
                      </button>
                )}
                <button onClick={() => setEditing({ ...r, honorarioValue: r.honorarioValue || "", dueDay: r.dueDay || "", sendDay: r.sendDay || "", weekendRule: r.weekendRule || "mantem", recurring: r.recurring !== false, billingEmail: r.billingEmail || "" })}
                  style={{ ...iconBtn }} title="Configurar"><Pencil size={15} /></button>
              </div>
            ))}
          </div>
        )}

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

  const openCreate = () => { setForm({ description: "", supplier: "", category: "", amount: "", dueDate: new Date().toISOString().slice(0, 10), recurring: false }); setOpen(true); };
  const save = async () => {
    if (!form.description.trim()) return toast.error("Informe a descrição");
    if (!form.amount) return toast.error("Informe o valor");
    try { await createMut.mutateAsync({ description: form.description, supplier: form.supplier || undefined, category: form.category || undefined, amount: form.amount, dueDate: form.dueDate, recurring: !!form.recurring }); toast.success("Conta a pagar criada"); setOpen(false); refreshAll(); }
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
                      {p.supplier ? p.supplier + " · " : ""}{p.category ? p.category + " · " : ""}vence {new Date(p.dueDate).toLocaleDateString("pt-BR")}
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
        <p style={{ fontSize: 12, color: C.textFaint }}>O QR Code em imagem você me envia depois e eu encaixo aqui (Fase 4), junto com a geração automática no e-mail/boleto.</p>
      </div>
    </div>
  );
}
