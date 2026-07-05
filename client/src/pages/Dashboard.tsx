import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  AlertTriangle, ArrowUpRight, Building2, CheckCircle2, ChevronDown, ChevronRight,
  ClipboardList, Clock, TrendingUp, Users,
} from "lucide-react";
import { useState } from "react";
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

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default function Dashboard() {
  const isAdmin = useIsAdmin();
  const { user } = useAuth();
  const def = defaultCompetencia();
  const [mm, setMm] = useState(def.mm);
  const [yyyy, setYyyy] = useState(def.yyyy);
  const competencia = `${mm}/${yyyy}`;
  const monthLabel = MONTHS.find((m) => m.v === mm)?.l ?? mm;

  const { data, isLoading } = trpc.tasks.managerialDashboard.useQuery({ competencia });
  const firstName = (user?.name ?? "").split(" ")[0] || "";

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header com saudação */}
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm" style={{ color: "#52525b" }}>{greeting()}{firstName ? `, ${firstName}` : ""} 👋</p>
            <h1 className="text-2xl font-bold mt-0.5" style={{ color: "#f4f4f5" }}>
              {isAdmin ? "Painel Gerencial" : "Meu Painel"}
            </h1>
          </div>
          <div className="flex items-center gap-2 rounded-xl px-2 py-1.5" style={{ background: "#111", border: "1px solid #1e4f5c" }}>
            <span className="text-xs pl-1" style={{ color: "#52525b" }}>Competência</span>
            <select value={mm} onChange={(e) => setMm(e.target.value)}
              className="rounded-lg px-2 py-1 text-sm font-medium"
              style={{ background: "#0d1f22", border: "1px solid #1e4f5c", color: "#e5e5e5", outline: "none" }}>
              {MONTHS.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
            </select>
            <select value={yyyy} onChange={(e) => setYyyy(e.target.value)}
              className="rounded-lg px-2 py-1 text-sm font-medium"
              style={{ background: "#0d1f22", border: "1px solid #1e4f5c", color: "#e5e5e5", outline: "none" }}>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-32 rounded-2xl animate-pulse" style={{ background: "#141414" }} />)}
          </div>
        ) : data?.role === "admin" ? (
          <AdminDashboard data={data} monthLabel={monthLabel} />
        ) : (
          <CollaboratorDashboard data={data} monthLabel={monthLabel} />
        )}
      </div>
    </AppLayout>
  );
}

// Anel de progresso (micro-visualização)
function ProgressRing({ percent, color, size = 56, stroke = 5 }: { percent: number; color: string; size?: number; stroke?: number }) {
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (Math.min(100, Math.max(0, percent)) / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.6s ease" }} />
    </svg>
  );
}

// Card de métrica grande (hero)
function HeroMetric({ label, value, icon: Icon, color, sub, ring }: {
  label: string; value: number | string; icon: any; color: string; sub?: string; ring?: number;
}) {
  return (
    <div className="rounded-2xl p-5 relative overflow-hidden" style={{ background: "#111", border: "1px solid #1e4f5c" }}>
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl" style={{ background: color, opacity: 0.06 }} />
      <div className="flex items-start justify-between relative">
        <div>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: `${color}18` }}>
            <Icon size={17} style={{ color }} />
          </div>
          <div className="text-3xl font-bold tracking-tight" style={{ color: "#f4f4f5" }}>{value}</div>
          <div className="text-xs mt-1" style={{ color: "#71717a" }}>{label}</div>
          {sub && <div className="text-xs mt-2 font-medium" style={{ color }}>{sub}</div>}
        </div>
        {ring !== undefined && (
          <div className="relative flex items-center justify-center">
            <ProgressRing percent={ring} color={color} />
            <span className="absolute text-xs font-bold" style={{ color: "#e5e5e5" }}>{ring}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══ DASHBOARD ADMIN ═══
function AdminDashboard({ data, monthLabel }: { data: any; monthLabel: string }) {
  const { overview, byUser, byDepartment, topClientesPendencias } = data;
  const [showTeam, setShowTeam] = useState(true);
  const [showDept, setShowDept] = useState(false);
  const [showClients, setShowClients] = useState(false);

  const totalTasks = overview.abertas + overview.concluidas;
  const conclusaoPct = totalTasks > 0 ? Math.round((overview.concluidas / totalTasks) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <HeroMetric label="Tarefas em aberto" value={overview.abertas} icon={ClipboardList} color="#60a5fa" />
        <HeroMetric label="Concluídas no mês" value={overview.concluidas} icon={CheckCircle2} color="#4ade80" ring={conclusaoPct} />
        <HeroMetric label="Vencidas" value={overview.vencidas} icon={AlertTriangle} color="#f87171"
          sub={overview.vencidas > 0 ? "requer atenção" : "tudo em dia ✓"} />
        <HeroMetric label="Entregas no prazo" value={overview.slaNoPrazo === null ? "—" : `${overview.slaNoPrazo}%`}
          icon={TrendingUp} color="#c084fc" ring={overview.slaNoPrazo ?? 0} />
      </div>

      <Section title="Desempenho da equipe" icon={Users} count={byUser.length}
        open={showTeam} onToggle={() => setShowTeam(!showTeam)}>
        {byUser.length === 0 ? (
          <EmptyRow text="Nenhum colaborador cadastrado. Crie usuários em Configurações." />
        ) : (
          <div className="space-y-2.5">
            {byUser.map((u: any) => {
              const total = u.total || 1;
              const pct = Math.round((u.entregues / total) * 100);
              return (
                <div key={u.userId} className="rounded-xl p-4" style={{ background: "#0d1f22", border: "1px solid rgba(30,79,92,0.5)" }}>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <div className="relative flex items-center justify-center">
                        <ProgressRing percent={pct} color="#4ade80" size={44} stroke={4} />
                        <span className="absolute text-[10px] font-bold" style={{ color: "#e5e5e5" }}>{pct}%</span>
                      </div>
                      <div>
                        <div className="text-sm font-semibold" style={{ color: "#f4f4f5" }}>{u.name}</div>
                        <div className="text-xs mt-0.5" style={{ color: "#52525b" }}>
                          {u.departments.length > 0 ? u.departments.join(" · ") : "sem departamento"} • {u.clientCount} empresa(s)
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-5">
                      <MiniStat label="A entregar" value={u.aEntregar} color="#60a5fa" />
                      <MiniStat label="Entregues" value={u.entregues} color="#4ade80" />
                      <MiniStat label="Atrasadas" value={u.atrasadas} color={u.atrasadas > 0 ? "#f87171" : "#3f3f46"} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="Distribuição por departamento" icon={Building2} count={byDepartment.length}
        open={showDept} onToggle={() => setShowDept(!showDept)}>
        {byDepartment.length === 0 ? (
          <EmptyRow text="Nenhuma tarefa com departamento neste mês." />
        ) : (
          <div className="space-y-2">
            {byDepartment.map((d: any) => {
              const total = d.total || 1;
              const donePct = Math.round((d.concluidas / total) * 100);
              return (
                <div key={d.name} className="rounded-xl p-3.5" style={{ background: "#0d1f22", border: "1px solid rgba(30,79,92,0.5)" }}>
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                      <span className="text-sm font-medium" style={{ color: "#f4f4f5" }}>{d.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <MiniStat label="Abertas" value={d.abertas} color="#60a5fa" />
                      <MiniStat label="Concluídas" value={d.concluidas} color="#4ade80" />
                      <MiniStat label="Atrasadas" value={d.atrasadas} color={d.atrasadas > 0 ? "#f87171" : "#3f3f46"} />
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                    <div className="h-full rounded-full" style={{ width: `${donePct}%`, background: d.color, transition: "width 0.6s ease" }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="Clientes com mais pendências" icon={AlertTriangle} count={topClientesPendencias.length}
        open={showClients} onToggle={() => setShowClients(!showClients)}>
        {topClientesPendencias.length === 0 ? (
          <EmptyRow text="Nenhuma pendência neste mês. 🎉" />
        ) : (
          <div className="space-y-1.5">
            {topClientesPendencias.map((c: any, i: number) => (
              <Link key={c.clientId} href={`/clientes/${c.clientId}`}>
                <div className="flex items-center justify-between rounded-xl p-3 cursor-pointer transition-colors hover:bg-white/[0.03] group"
                  style={{ background: "#0d1f22", border: "1px solid rgba(30,79,92,0.5)" }}>
                  <div className="flex items-center gap-3">
                    <span className="text-xs w-6 h-6 rounded-lg flex items-center justify-center font-bold" style={{ background: "rgba(248,113,113,0.12)", color: "#f87171" }}>{i + 1}</span>
                    <span className="text-sm" style={{ color: "#f4f4f5" }}>{c.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2.5 py-1 rounded-lg font-medium" style={{ background: "rgba(248,113,113,0.1)", color: "#f87171" }}>
                      {c.pendencias} pendência{c.pendencias !== 1 ? "s" : ""}
                    </span>
                    <ArrowUpRight size={15} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "#52525b" }} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// ═══ DASHBOARD COLABORADOR ═══
function CollaboratorDashboard({ data, monthLabel }: { data: any; monthLabel: string }) {
  const { overview, myClients, proximasVencer } = data;
  const [showClients, setShowClients] = useState(true);
  const [showNext, setShowNext] = useState(true);

  const total = overview.aEntregar + overview.entregues;
  const conclusaoPct = total > 0 ? Math.round((overview.entregues / total) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <HeroMetric label="A entregar" value={overview.aEntregar} icon={ClipboardList} color="#60a5fa" />
        <HeroMetric label="Entregues no mês" value={overview.entregues} icon={CheckCircle2} color="#4ade80" ring={conclusaoPct} />
        <HeroMetric label="Atrasadas" value={overview.atrasadas} icon={AlertTriangle}
          color={overview.atrasadas > 0 ? "#f87171" : "#3f3f46"} sub={overview.atrasadas > 0 ? "priorize estas" : "tudo em dia ✓"} />
        <HeroMetric label="Minhas empresas" value={overview.minhasEmpresas} icon={Building2} color="#9fd4dc" />
      </div>

      {overview.meusDepartamentos?.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs" style={{ color: "#52525b" }}>Meus departamentos:</span>
          {overview.meusDepartamentos.map((d: string) => (
            <span key={d} className="text-xs px-2.5 py-1 rounded-lg font-medium" style={{ background: "rgba(36,100,108,0.2)", color: "#9fd4dc" }}>{d}</span>
          ))}
        </div>
      )}

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
                  <div className="flex items-center justify-between rounded-xl p-3 cursor-pointer transition-colors hover:bg-white/[0.03]"
                    style={{ background: "#0d1f22", border: "1px solid rgba(30,79,92,0.5)" }}>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: "#f4f4f5" }}>{t.title}</div>
                      <div className="text-xs truncate mt-0.5" style={{ color: "#52525b" }}>{t.clientName} · {t.department}</div>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-lg shrink-0 ml-2 font-medium" style={{
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

      <Section title="Minhas empresas" icon={Building2} count={myClients.length}
        open={showClients} onToggle={() => setShowClients(!showClients)}>
        {myClients.length === 0 ? (
          <EmptyRow text="Nenhuma empresa com tarefas neste mês." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {myClients.map((c: any) => (
              <Link key={c.clientId} href={`/clientes/${c.clientId}`}>
                <div className="rounded-xl p-3.5 cursor-pointer transition-colors hover:bg-white/[0.03]" style={{ background: "#0d1f22", border: "1px solid rgba(30,79,92,0.5)" }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium truncate" style={{ color: "#f4f4f5" }}>{c.name}</span>
                    {c.atrasadas > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-lg shrink-0 font-medium" style={{ background: "rgba(248,113,113,0.12)", color: "#f87171" }}>{c.atrasadas} atrasada{c.atrasadas !== 1 ? "s" : ""}</span>
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

// Auxiliares
function Section({ title, icon: Icon, count, open, onToggle, children }: {
  title: string; icon: any; count: number; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl" style={{ background: "#111", border: "1px solid #1e4f5c" }}>
      <button onClick={onToggle} className="w-full flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(159,212,220,0.1)" }}>
            <Icon size={14} style={{ color: "#9fd4dc" }} />
          </div>
          <span className="text-sm font-semibold" style={{ color: "#f4f4f5" }}>{title}</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(36,100,108,0.2)", color: "#9fd4dc" }}>{count}</span>
        </div>
        {open ? <ChevronDown size={17} style={{ color: "#52525b" }} /> : <ChevronRight size={17} style={{ color: "#52525b" }} />}
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <div className="text-xl font-bold leading-none" style={{ color }}>{value}</div>
      <div className="text-[10px] mt-1 uppercase tracking-wide" style={{ color: "#52525b" }}>{label}</div>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="text-sm text-center py-6" style={{ color: "#52525b" }}>{text}</p>;
}
