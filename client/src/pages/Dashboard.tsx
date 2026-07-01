import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import {
  AlertTriangle, Building2, CheckCircle2, ChevronDown, ChevronRight,
  ClipboardList, Clock, TrendingUp, Users
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";

const MONTHS = [
  { v: "01", l: "Janeiro" }, { v: "02", l: "Fevereiro" }, { v: "03", l: "Março" },
  { v: "04", l: "Abril" }, { v: "05", l: "Maio" }, { v: "06", l: "Junho" },
  { v: "07", l: "Julho" }, { v: "08", l: "Agosto" }, { v: "09", l: "Setembro" },
  { v: "10", l: "Outubro" }, { v: "11", l: "Novembro" }, { v: "12", l: "Dezembro" },
];
const nowY = new Date().getFullYear();
const YEARS = [nowY - 1, nowY, nowY + 1].map(String);

function defaultCompetencia() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return { mm: String(d.getMonth() + 1).padStart(2, "0"), yyyy: String(d.getFullYear()) };
}

export default function Dashboard() {
  const isAdmin = useIsAdmin();
  const def = defaultCompetencia();
  const [mm, setMm] = useState(def.mm);
  const [yyyy, setYyyy] = useState(def.yyyy);
  const competencia = `${mm}/${yyyy}`;

  const { data, isLoading } = trpc.tasks.managerialDashboard.useQuery({ competencia });

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Header + seletor de competência */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#e5e5e5" }}>
              {isAdmin ? "Painel Gerencial" : "Meu Painel"}
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "#a1a1aa" }}>
              Competência <strong style={{ color: "#9fd4dc" }}>{mm}/{yyyy}</strong>
              {isAdmin ? " — visão do escritório e equipe" : " — suas empresas e tarefas"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select value={mm} onChange={(e) => setMm(e.target.value)}
              className="rounded px-2 py-1.5 text-sm"
              style={{ background: "#0d1f22", border: "1px solid #1e4f5c", color: "#e5e5e5", outline: "none" }}>
              {MONTHS.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
            </select>
            <select value={yyyy} onChange={(e) => setYyyy(e.target.value)}
              className="rounded px-2 py-1.5 text-sm"
              style={{ background: "#0d1f22", border: "1px solid #1e4f5c", color: "#e5e5e5", outline: "none" }}>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: "#1a1a1a" }} />)}
          </div>
        ) : data?.role === "admin" ? (
          <AdminDashboard data={data} />
        ) : (
          <CollaboratorDashboard data={data} />
        )}
      </div>
    </AppLayout>
  );
}

// ── Card de métrica reutilizável ──
function MetricCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: number | string; icon: any; color: string; sub?: string;
}) {
  return (
    <div className="rounded-xl border p-4" style={{ background: "#111", borderColor: "#1e4f5c" }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs" style={{ color: "#a1a1aa" }}>{label}</span>
        <Icon size={16} style={{ color }} />
      </div>
      <div className="text-2xl font-bold" style={{ color: "#e5e5e5" }}>{value}</div>
      {sub && <div className="text-xs mt-1" style={{ color: "#52525b" }}>{sub}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// DASHBOARD ADMIN
// ═══════════════════════════════════════════════════════════════════
function AdminDashboard({ data }: { data: any }) {
  const { overview, byUser, byDepartment, topClientesPendencias } = data;
  const [showTeam, setShowTeam] = useState(true);
  const [showDept, setShowDept] = useState(false);
  const [showClients, setShowClients] = useState(false);

  return (
    <div className="space-y-5">
      {/* Visão geral */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Tarefas em aberto" value={overview.abertas} icon={ClipboardList} color="#60a5fa" />
        <MetricCard label="Concluídas" value={overview.concluidas} icon={CheckCircle2} color="#4ade80" />
        <MetricCard label="Vencidas" value={overview.vencidas} icon={AlertTriangle} color="#f87171"
          sub={overview.vencidas > 0 ? "requer atenção" : "tudo em dia"} />
        <MetricCard label="Entregas no prazo" value={overview.slaNoPrazo === null ? "—" : `${overview.slaNoPrazo}%`}
          icon={TrendingUp} color="#c084fc" sub="SLA do mês" />
      </div>

      {/* Desempenho da equipe (expansível) */}
      <Section title="Desempenho da equipe" icon={Users} count={byUser.length}
        open={showTeam} onToggle={() => setShowTeam(!showTeam)}>
        {byUser.length === 0 ? (
          <EmptyRow text="Nenhum colaborador cadastrado. Crie usuários em Configurações." />
        ) : (
          <div className="space-y-2">
            {byUser.map((u: any) => (
              <div key={u.userId} className="rounded-lg border p-3" style={{ background: "#0d1f22", borderColor: "rgba(30,79,92,0.5)" }}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "#24646c", color: "#fff" }}>
                      {(u.name ?? "?").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-medium" style={{ color: "#e5e5e5" }}>{u.name}</div>
                      <div className="text-xs" style={{ color: "#52525b" }}>
                        {u.departments.length > 0 ? u.departments.join(", ") : "sem departamento"} · {u.clientCount} empresa(s)
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <MiniStat label="A entregar" value={u.aEntregar} color="#60a5fa" />
                    <MiniStat label="Entregues" value={u.entregues} color="#4ade80" />
                    <MiniStat label="Atrasadas" value={u.atrasadas} color={u.atrasadas > 0 ? "#f87171" : "#52525b"} />
                  </div>
                </div>
                {/* Barra de progresso */}
                {u.total > 0 && (
                  <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                    <div className="h-full rounded-full" style={{
                      width: `${Math.round((u.entregues / u.total) * 100)}%`,
                      background: "#4ade80",
                    }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Por departamento (expansível) */}
      <Section title="Por departamento" icon={Building2} count={byDepartment.length}
        open={showDept} onToggle={() => setShowDept(!showDept)}>
        {byDepartment.length === 0 ? (
          <EmptyRow text="Nenhuma tarefa com departamento neste mês." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {byDepartment.map((d: any) => (
              <div key={d.name} className="rounded-lg border p-3" style={{ background: "#0d1f22", borderColor: "rgba(30,79,92,0.5)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                  <span className="text-sm font-medium" style={{ color: "#e5e5e5" }}>{d.name}</span>
                  <span className="text-xs ml-auto" style={{ color: "#52525b" }}>{d.total} tarefas</span>
                </div>
                <div className="flex items-center gap-4">
                  <MiniStat label="Abertas" value={d.abertas} color="#60a5fa" />
                  <MiniStat label="Concluídas" value={d.concluidas} color="#4ade80" />
                  <MiniStat label="Atrasadas" value={d.atrasadas} color={d.atrasadas > 0 ? "#f87171" : "#52525b"} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Clientes com mais pendências (expansível) */}
      <Section title="Clientes com mais pendências" icon={AlertTriangle} count={topClientesPendencias.length}
        open={showClients} onToggle={() => setShowClients(!showClients)}>
        {topClientesPendencias.length === 0 ? (
          <EmptyRow text="Nenhuma pendência neste mês. 🎉" />
        ) : (
          <div className="space-y-1.5">
            {topClientesPendencias.map((c: any, i: number) => (
              <Link key={c.clientId} href={`/clientes/${c.clientId}`}>
                <div className="flex items-center justify-between rounded-lg border p-2.5 cursor-pointer hover:bg-white/5 transition-colors"
                  style={{ background: "#0d1f22", borderColor: "rgba(30,79,92,0.5)" }}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold" style={{ background: "rgba(248,113,113,0.15)", color: "#f87171" }}>{i + 1}</span>
                    <span className="text-sm" style={{ color: "#e5e5e5" }}>{c.name}</span>
                  </div>
                  <span className="text-xs px-2 py-1 rounded" style={{ background: "rgba(248,113,113,0.1)", color: "#f87171" }}>
                    {c.pendencias} pendência(s)
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// DASHBOARD COLABORADOR
// ═══════════════════════════════════════════════════════════════════
function CollaboratorDashboard({ data }: { data: any }) {
  const { overview, myClients, proximasVencer } = data;
  const [showClients, setShowClients] = useState(true);
  const [showNext, setShowNext] = useState(true);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="A entregar" value={overview.aEntregar} icon={ClipboardList} color="#60a5fa" />
        <MetricCard label="Entregues" value={overview.entregues} icon={CheckCircle2} color="#4ade80" />
        <MetricCard label="Atrasadas" value={overview.atrasadas} icon={AlertTriangle}
          color={overview.atrasadas > 0 ? "#f87171" : "#52525b"} sub={overview.atrasadas > 0 ? "priorize estas" : "tudo em dia"} />
        <MetricCard label="Minhas empresas" value={overview.minhasEmpresas} icon={Building2} color="#9fd4dc" />
      </div>

      {overview.meusDepartamentos?.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs" style={{ color: "#52525b" }}>Meus departamentos:</span>
          {overview.meusDepartamentos.map((d: string) => (
            <span key={d} className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(36,100,108,0.2)", color: "#9fd4dc" }}>{d}</span>
          ))}
        </div>
      )}

      {/* Próximas a vencer */}
      <Section title="Próximas a vencer" icon={Clock} count={proximasVencer.length}
        open={showNext} onToggle={() => setShowNext(!showNext)}>
        {proximasVencer.length === 0 ? (
          <EmptyRow text="Nenhuma tarefa em aberto. 🎉" />
        ) : (
          <div className="space-y-1.5">
            {proximasVencer.map((t: any) => {
              const due = new Date(t.dueDate);
              const today = new Date(); today.setHours(0, 0, 0, 0);
              const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
              const overdue = dueDay < today;
              const isToday = dueDay.getTime() === today.getTime();
              return (
                <Link key={t.id} href={`/tarefas/${t.id}`}>
                  <div className="flex items-center justify-between rounded-lg border p-2.5 cursor-pointer hover:bg-white/5 transition-colors"
                    style={{ background: "#0d1f22", borderColor: "rgba(30,79,92,0.5)" }}>
                    <div className="min-w-0">
                      <div className="text-sm truncate" style={{ color: "#e5e5e5" }}>{t.title}</div>
                      <div className="text-xs truncate" style={{ color: "#52525b" }}>{t.clientName} · {t.department}</div>
                    </div>
                    <span className="text-xs px-2 py-1 rounded shrink-0 ml-2" style={{
                      background: overdue ? "rgba(248,113,113,0.12)" : isToday ? "rgba(251,146,60,0.12)" : "rgba(255,255,255,0.05)",
                      color: overdue ? "#f87171" : isToday ? "#fb923c" : "#a1a1aa",
                    }}>
                      {overdue ? "🚨 Vencida" : isToday ? "⚠️ Hoje" : due.toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Section>

      {/* Minhas empresas */}
      <Section title="Minhas empresas" icon={Building2} count={myClients.length}
        open={showClients} onToggle={() => setShowClients(!showClients)}>
        {myClients.length === 0 ? (
          <EmptyRow text="Nenhuma empresa com tarefas neste mês." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {myClients.map((c: any) => (
              <Link key={c.clientId} href={`/clientes/${c.clientId}`}>
                <div className="rounded-lg border p-3 cursor-pointer hover:bg-white/5 transition-colors" style={{ background: "#0d1f22", borderColor: "rgba(30,79,92,0.5)" }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium truncate" style={{ color: "#e5e5e5" }}>{c.name}</span>
                    {c.atrasadas > 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded shrink-0" style={{ background: "rgba(248,113,113,0.12)", color: "#f87171" }}>{c.atrasadas} atrasada(s)</span>
                    )}
                  </div>
                  <div className="text-xs" style={{ color: "#52525b" }}>{c.abertas} em aberto · {c.total} no total</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// ── Componentes auxiliares ──
function Section({ title, icon: Icon, count, open, onToggle, children }: {
  title: string; icon: any; count: number; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border" style={{ background: "#111", borderColor: "#1e4f5c" }}>
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon size={15} style={{ color: "#9fd4dc" }} />
          <span className="text-sm font-medium" style={{ color: "#e5e5e5" }}>{title}</span>
          <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(36,100,108,0.2)", color: "#9fd4dc" }}>{count}</span>
        </div>
        {open ? <ChevronDown size={16} style={{ color: "#52525b" }} /> : <ChevronRight size={16} style={{ color: "#52525b" }} />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <div className="text-lg font-bold leading-none" style={{ color }}>{value}</div>
      <div className="text-xs mt-0.5" style={{ color: "#52525b" }}>{label}</div>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="text-xs text-center py-4" style={{ color: "#52525b" }}>{text}</p>;
}
