import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileText,
  LogOut,
  X,
  MessageCircle,
  TrendingUp,
  Wallet,
  ChevronRight as ChevronRightIcon,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// Datas são armazenadas em UTC (meia-noite UTC no banco). Exibir e agrupar
// sempre em UTC — caso contrário o fuso do navegador (Brasil = UTC-3) empurra
// o dia para trás (ex.: vencimento dia 20 aparece como 19).
function formatBR(d: Date | string): string {
  const dt = new Date(d);
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${dt.getUTCFullYear()}`;
}

interface Task {
  id: number;
  title: string;
  taskType: string;
  status: string;
  dueDate: Date | string;
  competencia: string;
}

function OfficeContact({ task }: { task?: { title: string; competencia: string } }) {
  const { data: office } = trpc.clientPortal.officeWhatsApp.useQuery();
  const [open, setOpen] = useState(false);
  const wa = (msg: string) => {
    if (!office?.number) return;
    window.open(`https://wa.me/${office.number}?text=${encodeURIComponent(msg)}`, "_blank");
  };
  if (task) {
    const ctx = `${task.title} (competência ${task.competencia})`;
    return (
      <div className="space-y-2">
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
          style={{ background: "rgba(37,211,102,0.12)", border: "1px solid rgba(37,211,102,0.35)", color: "#25D366" }}
        >
          <MessageCircle size={16} /> Falar com o escritório
        </button>
        {open && (
          <div className="space-y-2">
            <button onClick={() => wa(`Olá! Gostaria de pedir o recálculo da guia ${ctx}.`)}
              className="w-full py-2.5 rounded-lg text-sm" style={{ background: "rgba(255,255,255,0.05)", color: "#e5e5e5", border: "1px solid #2a2a2a" }}>
              Pedir recálculo
            </button>
            <button onClick={() => wa(`Olá! Tenho uma dúvida sobre a guia ${ctx}.`)}
              className="w-full py-2.5 rounded-lg text-sm" style={{ background: "rgba(255,255,255,0.05)", color: "#e5e5e5", border: "1px solid #2a2a2a" }}>
              Tirar uma dúvida
            </button>
          </div>
        )}
      </div>
    );
  }
  return (
    <button
      onClick={() => wa("Olá! Gostaria de falar com o escritório.")}
      className="w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
      style={{ background: "rgba(37,211,102,0.12)", border: "1px solid rgba(37,211,102,0.35)", color: "#25D366" }}
    >
      <MessageCircle size={16} /> Falar com o escritório
    </button>
  );
}

function TaskDrawer({ task, onClose, previewClientId }: { task: Task; onClose: () => void; previewClientId?: number }) {
  const { data: files = [], isLoading } = trpc.clientPortal.taskFiles.useQuery({ taskId: task.id, previewClientId });
  const due = new Date(task.dueDate);
  const isOverdue = due < new Date() && task.status !== "CONCLUIDA";

  const handleDownload = async (fileId: number, filename: string) => {
    try {
      // Open file URL directly
      window.open(`/api/portal/file/${task.id}/${fileId}`, "_blank");
    } catch {
      toast.error("Erro ao baixar arquivo");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="rounded-t-3xl p-6 space-y-5 max-h-[80vh] overflow-y-auto"
        style={{ background: "#111", borderTop: "1px solid #1e4f5c" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex justify-center -mt-2 mb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: "#3f3f46" }} />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium mb-1" style={{ color: "#9fd4dc" }}>{task.taskType}</p>
            <h2 className="text-lg font-bold" style={{ color: "#e5e5e5" }}>{task.title}</h2>
            <p className="text-sm mt-1" style={{ color: "#a1a1aa" }}>Competência {task.competencia}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full" style={{ background: "rgba(255,255,255,0.05)", color: "#a1a1aa" }}>
            <X size={18} />
          </button>
        </div>

        {/* Status + Due date */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl p-3 text-center" style={{ background: "rgba(36,100,108,0.1)", border: "1px solid rgba(36,100,108,0.2)" }}>
            <p className="text-xs mb-1" style={{ color: "#52525b" }}>Vencimento</p>
            <p className="text-sm font-semibold" style={{ color: isOverdue ? "#f87171" : "#e5e5e5" }}>
              {formatBR(due)}
            </p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: "rgba(36,100,108,0.1)", border: "1px solid rgba(36,100,108,0.2)" }}>
            <p className="text-xs mb-1" style={{ color: "#52525b" }}>Situação</p>
            <p
              className="text-sm font-semibold"
              style={{
                color: task.status === "CONCLUIDA" ? "#4ade80"
                  : task.status === "VENCIDA" ? "#f87171"
                  : task.status === "EM_ANDAMENTO" ? "#60a5fa"
                  : "#facc15",
              }}
            >
              {task.status === "CONCLUIDA" ? "Concluída"
                : task.status === "VENCIDA" ? "Vencida"
                : task.status === "EM_ANDAMENTO" ? "Em andamento"
                : "Pendente"}
            </p>
          </div>
        </div>

        {/* Files */}
        <div>
          <p className="text-sm font-medium mb-3" style={{ color: "#e5e5e5" }}>
            Documentos disponíveis
          </p>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(2)].map((_, i) => <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: "#1a1a1a" }} />)}
            </div>
          ) : files.length === 0 ? (
            <div
              className="rounded-xl p-5 text-center"
              style={{ background: "rgba(82,82,91,0.1)", border: "1px dashed #3f3f46" }}
            >
              <FileText size={24} className="mx-auto mb-2" style={{ color: "#52525b" }} />
              <p className="text-sm" style={{ color: "#a1a1aa" }}>Nenhum documento disponível ainda</p>
              <p className="text-xs mt-1" style={{ color: "#52525b" }}>
                O documento será disponibilizado em breve
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((file) => (
                <a
                  key={file.id}
                  href={file.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 rounded-xl active:opacity-70 transition-opacity"
                  style={{ background: "rgba(36,100,108,0.1)", border: "1px solid rgba(36,100,108,0.25)" }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(36,100,108,0.3)" }}>
                      <FileText size={16} style={{ color: "#9fd4dc" }} />
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: "#e5e5e5" }}>{file.filename}</p>
                      <p className="text-xs" style={{ color: "#52525b" }}>
                        {file.fileSize ? `${(file.fileSize / 1024).toFixed(0)} KB` : "PDF"}
                      </p>
                    </div>
                  </div>
                  <Download size={16} style={{ color: "#9fd4dc" }} />
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Falar com o escritório sobre esta guia */}
        <OfficeContact task={task} />
      </div>
    </div>
  );
}

function linreg(pts: { x: number; y: number }[]) {
  const n = pts.length;
  const sx = pts.reduce((s, p) => s + p.x, 0);
  const sy = pts.reduce((s, p) => s + p.y, 0);
  const sxx = pts.reduce((s, p) => s + p.x * p.x, 0);
  const sxy = pts.reduce((s, p) => s + p.x * p.y, 0);
  const d = n * sxx - sx * sx;
  if (d === 0) return { slope: 0, intercept: sy / n };
  const slope = (n * sxy - sx * sy) / d;
  return { slope, intercept: (sy - slope * sx) / n };
}

const fmtBRL = (v: number | null | undefined) =>
  v === null || v === undefined || (typeof v === "number" && isNaN(v))
    ? "—"
    : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const finInput: React.CSSProperties = {
  width: "100%", background: "#0d1f22", border: "1px solid #1e4f5c", borderRadius: 8,
  color: "#e5e5e5", padding: "8px 10px", outline: "none", fontSize: 14,
};

function YearDetail({ months, onPick, isStaff }: { months: Array<{ month: number; faturamento: number | null; imposto: number | null }>; onPick: (m: number) => void; isStaff: boolean }) {
  const withData = months.filter((m) => m.faturamento != null);
  const list = isStaff ? months : withData;
  const totalFat = withData.reduce((s, m) => s + (m.faturamento || 0), 0);
  const totalImp = withData.reduce((s, m) => s + (m.imposto || 0), 0);
  return (
    <div className="rounded-2xl p-4" style={{ background: "#111", border: "1px solid #1e4f5c" }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs" style={{ color: "#52525b" }}>Faturamento no ano</p>
          <p className="text-base font-bold" style={{ color: "#86efac" }}>{fmtBRL(totalFat)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs" style={{ color: "#52525b" }}>Imposto no ano</p>
          <p className="text-base font-bold" style={{ color: "#fca5a5" }}>{fmtBRL(totalImp)}</p>
        </div>
      </div>
      {list.length === 0 ? (
        <p className="text-sm py-4 text-center" style={{ color: "#52525b" }}>Nenhum faturamento informado ainda.</p>
      ) : (
        <div className="space-y-1">
          {list.map((m) => {
            const aliq = m.faturamento && m.imposto != null && m.faturamento > 0 ? (m.imposto / m.faturamento) * 100 : null;
            const hasData = m.faturamento != null;
            return (
              <button key={m.month} onClick={() => onPick(m.month)}
                className="w-full flex items-center justify-between py-2 text-left" style={{ borderBottom: "1px solid rgba(30,79,92,0.3)" }}>
                <span className="text-sm font-medium" style={{ color: hasData ? "#e5e5e5" : "#71717a" }}>{MONTHS[m.month - 1]}</span>
                <span className="text-xs" style={{ color: hasData ? "#a1a1aa" : "#52525b" }}>
                  {hasData ? `${fmtBRL(m.faturamento)}  ·  imp ${fmtBRL(m.imposto)}${aliq != null ? `  ·  ${aliq.toFixed(1).replace(".", ",")}%` : ""}` : (isStaff ? "informar →" : "—")}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MonthDetail({ year, month, previewClientId, onClear, isStaff }: { year: number; month: number; previewClientId?: number; onClear: () => void; isStaff: boolean }) {
  const utils = trpc.useUtils();
  const { data } = trpc.clientPortal.financials.useQuery({ month, year, previewClientId });
  const setRevenue = (trpc.clientPortal as any).setRevenue.useMutation({
    onSuccess: () => { utils.clientPortal.financials.invalidate(); (utils.clientPortal as any).financialsYear.invalidate(); },
  });
  const [editing, setEditing] = useState(false);
  const [fat, setFat] = useState("");
  const [imp, setImp] = useState("");
  const taxes = data?.taxes ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <p className="text-sm font-semibold" style={{ color: "#e5e5e5" }}>{MONTHS[month - 1]} {year}</p>
        <button onClick={onClear} className="text-xs font-medium" style={{ color: "#9fd4dc" }}>Ver ano todo</button>
      </div>

      <div className="rounded-2xl p-4" style={{ background: "#111", border: "1px solid #1e4f5c" }}>
        {isStaff && editing ? (
          <div className="space-y-2">
            <div>
              <label className="text-xs" style={{ color: "#9fd4dc" }}>Faturamento</label>
              <input value={fat} onChange={(e) => setFat(e.target.value)} placeholder="6000,00" style={finInput} />
            </div>
            <div>
              <label className="text-xs" style={{ color: "#9fd4dc" }}>Imposto</label>
              <input value={imp} onChange={(e) => setImp(e.target.value)} placeholder="360,00" style={finInput} />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={async () => { try { await setRevenue.mutateAsync({ clientId: previewClientId!, year, month, valor: fat, imposto: imp || undefined }); setEditing(false); } catch { /* */ } }}
                disabled={setRevenue.isPending}
                style={{ flex: 1, background: "#24646c", color: "#fff", border: "none", borderRadius: 8, padding: "8px 0", fontWeight: 600, fontSize: 13 }}>Salvar</button>
              <button onClick={() => setEditing(false)} style={{ background: "rgba(255,255,255,0.05)", color: "#a1a1aa", border: "1px solid #2a2a2a", borderRadius: 8, padding: "8px 14px", fontSize: 13 }}>Cancelar</button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs" style={{ color: "#52525b" }}>Faturamento</p>
                <p className="text-xl font-bold" style={{ color: "#86efac" }}>{fmtBRL(data?.revenue as any)}</p>
              </div>
              <div>
                <p className="text-xs" style={{ color: "#52525b" }}>Imposto</p>
                <p className="text-xl font-bold" style={{ color: "#fca5a5" }}>{fmtBRL((data as any)?.imposto)}</p>
              </div>
            </div>
            {isStaff && (
              <button onClick={() => { setFat((data?.revenue as any) ?? ""); setImp(((data as any)?.imposto) ?? ""); setEditing(true); }}
                className="mt-3 w-full text-xs py-2 rounded-lg font-medium"
                style={{ color: "#9fd4dc", border: "1px solid rgba(36,100,108,0.3)", background: "rgba(36,100,108,0.08)" }}>
                Lançar / editar manualmente
              </button>
            )}
          </>
        )}
      </div>

      <div className="rounded-2xl p-4" style={{ background: "#111", border: "1px solid #1e4f5c" }}>
        <p className="text-xs mb-3" style={{ color: "#9fd4dc" }}>Guias do mês</p>
        {taxes.length === 0 ? (
          <p className="text-sm" style={{ color: "#52525b" }}>Nenhuma guia disparada neste mês.</p>
        ) : (
          <div className="space-y-1">
            {taxes.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid rgba(30,79,92,0.3)" }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: "#e5e5e5" }}>{t.title}</p>
                  <p className="text-xs" style={{ color: "#52525b" }}>{t.taskType}</p>
                </div>
                <p className="text-sm font-semibold" style={{ color: t.valor ? "#e5e5e5" : "#52525b" }}>{fmtBRL(t.valor ? Number(t.valor) : null)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FinancialsView({ year, previewClientId, onYearChange }: { year: number; previewClientId?: number; onYearChange: (y: number) => void }) {
  const { data: yearData, isLoading } = (trpc.clientPortal as any).financialsYear.useQuery({ year, previewClientId });
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [showProjection, setShowProjection] = useState(false);
  const [projModal, setProjModal] = useState<null | "confirm" | "warning">(null);
  const isStaff = !!previewClientId;

  const months: Array<{ month: number; faturamento: number | null; imposto: number | null }> = yearData?.months ?? [];
  const fatPts = months.filter((m) => m.faturamento != null).map((m) => ({ x: m.month, y: m.faturamento as number }));
  const impPts = months.filter((m) => m.imposto != null).map((m) => ({ x: m.month, y: m.imposto as number }));
  const lastDataMonth = fatPts.length ? Math.max(...fatPts.map((p) => p.x)) : 0;
  const canProject = fatPts.length >= 3;
  const fatReg = canProject ? linreg(fatPts) : null;
  const impReg = impPts.length >= 3 ? linreg(impPts) : null;

  const chartData = months.map((m) => {
    const aliquota = m.faturamento && m.imposto != null && m.faturamento > 0 ? (m.imposto / m.faturamento) * 100 : null;
    let projFat: number | null = null, projImp: number | null = null, projAliq: number | null = null;
    if (showProjection && fatReg && m.month >= lastDataMonth) {
      if (m.month === lastDataMonth) {
        projFat = m.faturamento; projImp = m.imposto; projAliq = aliquota;
      } else {
        projFat = Math.max(0, fatReg.intercept + fatReg.slope * m.month);
        projImp = impReg ? Math.max(0, impReg.intercept + impReg.slope * m.month) : null;
        projAliq = projFat && projImp != null && projFat > 0 ? (projImp / projFat) * 100 : null;
      }
    }
    return {
      name: MONTHS_SHORT[m.month - 1], month: m.month,
      Faturamento: m.faturamento, Imposto: m.imposto, "Alíquota": aliquota,
      projFat, projImp, projAliq,
    };
  });

  const handleProjection = () => {
    if (showProjection) { setShowProjection(false); return; }
    setProjModal(canProject ? "confirm" : "warning");
  };

  return (
    <div className="px-2 pb-6 space-y-4">
      <div className="flex items-center justify-between px-2">
        <button onClick={() => { onYearChange(year - 1); setSelectedMonth(null); setShowProjection(false); setProjModal(null); }} className="p-2 rounded-full" style={{ background: "rgba(255,255,255,0.05)", color: "#9fd4dc" }}><ChevronLeft size={16} /></button>
        <p className="text-sm font-bold" style={{ color: "#e5e5e5" }}>{year}</p>
        <button onClick={() => { onYearChange(year + 1); setSelectedMonth(null); setShowProjection(false); setProjModal(null); }} className="p-2 rounded-full" style={{ background: "rgba(255,255,255,0.05)", color: "#9fd4dc" }}><ChevronRight size={16} /></button>
      </div>

      <div className="rounded-2xl p-3" style={{ background: "#111", border: "1px solid #1e4f5c" }}>
        <div className="flex items-center justify-between mb-2 px-1">
          <p className="text-xs" style={{ color: "#9fd4dc" }}>Faturamento, imposto e alíquota</p>
          <button onClick={handleProjection} className="text-xs px-2.5 py-1 rounded-lg font-medium flex items-center gap-1"
            style={{ background: showProjection ? "#24646c" : "rgba(36,100,108,0.15)", color: showProjection ? "#fff" : "#9fd4dc", border: "1px solid rgba(36,100,108,0.4)" }}>
            <TrendingUp size={12} /> {showProjection ? "Ocultar projeção" : "Projetar"}
          </button>
        </div>
        {isLoading ? (
          <div style={{ height: 220 }} className="animate-pulse rounded-xl" />
        ) : (
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 8, right: 6, left: -14, bottom: 0 }}
                onClick={(e: any) => { const m = e?.activePayload?.[0]?.payload?.month; if (m) setSelectedMonth((cur) => (cur === m ? null : m)); }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" tick={{ fill: "#6b7280", fontSize: 10 }} />
                <YAxis yAxisId="left" tick={{ fill: "#6b7280", fontSize: 9 }} tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: "#6b7280", fontSize: 9 }} tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
                <Tooltip contentStyle={{ background: "#0d1f22", border: "1px solid #1e4f5c", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#9fd4dc" }}
                  formatter={(val: any, name: any) => (name === "Alíquota" ? [`${Number(val).toFixed(2)}%`, name] : [fmtBRL(val), name])} />
                <Line yAxisId="left" type="monotone" dataKey="Faturamento" stroke="#4ade80" strokeWidth={2} dot={{ r: 2 }} connectNulls />
                <Line yAxisId="left" type="monotone" dataKey="Imposto" stroke="#f87171" strokeWidth={2} dot={{ r: 2 }} connectNulls />
                <Line yAxisId="right" type="monotone" dataKey="Alíquota" stroke="#9fd4dc" strokeWidth={2} dot={{ r: 2 }} connectNulls />
                {showProjection && <Line yAxisId="left" type="monotone" dataKey="projFat" stroke="#4ade80" strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={false} />}
                {showProjection && <Line yAxisId="left" type="monotone" dataKey="projImp" stroke="#f87171" strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={false} />}
                {showProjection && <Line yAxisId="right" type="monotone" dataKey="projAliq" stroke="#9fd4dc" strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={false} />}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="flex items-center justify-center gap-4 mt-1">
          <span className="text-xs" style={{ color: "#4ade80" }}>● Faturamento</span>
          <span className="text-xs" style={{ color: "#f87171" }}>● Imposto</span>
          <span className="text-xs" style={{ color: "#9fd4dc" }}>● Alíquota</span>
        </div>
        <p className="text-center text-xs mt-2" style={{ color: "#52525b" }}>Toque em um mês no gráfico para ver os detalhes</p>
      </div>

      {selectedMonth ? (
        <MonthDetail year={year} month={selectedMonth} previewClientId={previewClientId} onClear={() => setSelectedMonth(null)} isStaff={isStaff} />
      ) : (
        <YearDetail months={months} onPick={setSelectedMonth} isStaff={isStaff} />
      )}

      {projModal && (
        <div onClick={() => setProjModal(null)}
          style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: "#111", border: "1px solid #1e4f5c", borderRadius: 16, padding: 20, maxWidth: 360, width: "100%" }}>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={18} style={{ color: "#9fd4dc" }} />
              <p className="text-sm font-semibold" style={{ color: "#e5e5e5" }}>{projModal === "warning" ? "Dados insuficientes" : "Sobre a projeção"}</p>
            </div>
            <p className="text-sm" style={{ color: "#a1a1aa", lineHeight: 1.55 }}>
              {projModal === "warning"
                ? "É necessário pelo menos 3 meses de faturamento informado para gerar a projeção."
                : "A projeção usa apenas os valores já informados; não considera casos específicos. É uma média que projeta linearmente (crescimento, estabilidade ou queda) para os próximos meses."}
            </p>
            <div className="flex justify-end gap-2 mt-5">
              {projModal === "confirm" && (
                <button onClick={() => setProjModal(null)}
                  style={{ background: "rgba(255,255,255,0.05)", color: "#a1a1aa", border: "1px solid #2a2a2a", borderRadius: 8, padding: "8px 14px", fontSize: 13 }}>Cancelar</button>
              )}
              <button onClick={() => { if (projModal === "confirm") setShowProjection(true); setProjModal(null); }}
                style={{ background: "#24646c", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontWeight: 600, fontSize: 13 }}>
                {projModal === "warning" ? "Entendi" : "OK, projetar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function CardHome({ onOpen, previewClientId }: { onOpen: (v: "calendar" | "financials") => void; previewClientId?: number }) {
  const { data: office } = trpc.clientPortal.officeWhatsApp.useQuery();
  const openWhats = () => {
    if (!office?.number) return;
    window.open(`https://wa.me/${office.number}?text=${encodeURIComponent("Olá! Gostaria de falar com o escritório.")}`, "_blank");
  };
  const cards = [
    { key: "calendar", title: "Calendário", desc: "Suas obrigações e guias por mês", icon: <CalendarDays size={22} />, color: "#60a5fa", onClick: () => onOpen("calendar") },
    { key: "financials", title: "Financeiro", desc: "Faturamento, impostos e alíquota efetiva", icon: <Wallet size={22} />, color: "#4ade80", onClick: () => onOpen("financials") },
    { key: "whats", title: "Falar com o escritório", desc: "Tire dúvidas pelo WhatsApp", icon: <MessageCircle size={22} />, color: "#25D366", onClick: openWhats },
  ];
  return (
    <div className="px-2 pt-2 space-y-3">
      {cards.map((c) => (
        <button key={c.key} onClick={c.onClick}
          className="w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all active:scale-[0.98]"
          style={{ background: "#111", border: "1px solid #1e4f5c" }}>
          <div className="flex items-center justify-center rounded-xl shrink-0" style={{ width: 48, height: 48, background: `${c.color}1a`, color: c.color }}>
            {c.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: "#e5e5e5" }}>{c.title}</p>
            <p className="text-xs mt-0.5" style={{ color: "#a1a1aa" }}>{c.desc}</p>
          </div>
          <ChevronRightIcon size={18} style={{ color: "#52525b" }} />
        </button>
      ))}
    </div>
  );
}

export default function ClientPortal({ previewClientId }: { previewClientId?: number }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [view, setView] = useState<"home" | "calendar" | "financials">("home");
  const [, navigate] = useLocation();

  const { data: tasks = [], isLoading } = trpc.clientPortal.calendar.useQuery({ month, year, previewClientId });
  const { data: user } = trpc.auth.me.useQuery();
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => navigate("/login"),
  });

  const prevMonth = () => {
    setSelectedDay(null);
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    setSelectedDay(null);
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date();

  // Map tasks by day of month
  const tasksByDay = new Map<number, Task[]>();
  tasks.forEach((task) => {
    const due = new Date(task.dueDate);
    const day = due.getUTCDate();
    if (!tasksByDay.has(day)) tasksByDay.set(day, []);
    tasksByDay.get(day)!.push(task as Task);
  });

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0a0a0a", maxWidth: 480, margin: "0 auto" }}>
      {previewClientId && (
        <div style={{ background: "#24646c", color: "#fff", textAlign: "center", padding: "6px 12px", fontSize: 12, fontWeight: 600 }}>
          Pré-visualização — você está vendo o portal como o cliente
        </div>
      )}
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 pt-safe-top" style={{ background: "#0a0a0a", borderBottom: "1px solid #1a1a1a" }}>
        <div className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            {view !== "home" ? (
              <button onClick={() => setView("home")} className="p-2 rounded-full" style={{ background: "rgba(255,255,255,0.05)", color: "#9fd4dc" }}>
                <ChevronLeft size={18} />
              </button>
            ) : (
              <img src="/logo.png" alt="Equilíbrio" className="w-8 h-8 object-contain" />
            )}
            <div>
              <p className="text-sm font-semibold" style={{ color: "#e5e5e5" }}>
                {view === "home" ? "Portal do Cliente" : view === "calendar" ? "Calendário" : "Financeiro"}
              </p>
              <p className="text-xs" style={{ color: "#52525b" }}>{user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => logoutMutation.mutate()}
            className="p-2 rounded-full"
            style={{ background: "rgba(255,255,255,0.05)", color: "#a1a1aa" }}
          >
            <LogOut size={16} />
          </button>
        </div>

        {/* Month navigator (só no calendário) */}
        {view === "calendar" && (
        <div className="flex items-center justify-between pb-4">
          <button onClick={prevMonth} className="p-2 rounded-full" style={{ background: "rgba(255,255,255,0.05)", color: "#9fd4dc" }}>
            <ChevronLeft size={18} />
          </button>
          <div className="text-center">
            <p className="text-base font-bold" style={{ color: "#e5e5e5" }}>{MONTHS[month - 1]} {year}</p>
            <p className="text-xs" style={{ color: "#52525b" }}>
              {tasks.length} obrigaç{tasks.length !== 1 ? "ões" : "ão"} neste mês
            </p>
          </div>
          <button onClick={nextMonth} className="p-2 rounded-full" style={{ background: "rgba(255,255,255,0.05)", color: "#9fd4dc" }}>
            <ChevronRight size={18} />
          </button>
        </div>
        )}

        {/* Weekday headers */}
        {view === "calendar" && (
        <div className="grid grid-cols-7 pb-2">
          {WEEKDAYS.map((d) => (
            <div key={d} className="text-center text-xs font-medium py-1" style={{ color: "#52525b" }}>{d}</div>
          ))}
        </div>
        )}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 px-2 pb-6">
        {view === "home" ? (
          <CardHome onOpen={setView} previewClientId={previewClientId} />
        ) : view === "financials" ? (
          <FinancialsView year={year} previewClientId={previewClientId} onYearChange={setYear} />
        ) : (
          <>
        {isLoading ? (
          <div className="grid grid-cols-7 gap-1 p-2">
            {Array(35).fill(0).map((_, i) => (
              <div key={i} className="aspect-square rounded-xl animate-pulse" style={{ background: "#1a1a1a" }} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1 p-2">
            {cells.map((day, idx) => {
              if (!day) return <div key={idx} />;

              const dayTasks = tasksByDay.get(day) ?? [];
              const isToday = day === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();

              const hasOverdue = dayTasks.some((t) => t.status === "VENCIDA" || (new Date(t.dueDate) < today && t.status !== "CONCLUIDA"));
              const hasActive = dayTasks.some((t) => !hasOverdue && (t.status === "PENDENTE" || t.status === "EM_ANDAMENTO"));
              const allDone = dayTasks.length > 0 && dayTasks.every((t) => t.status === "CONCLUIDA");

              const dotColor = hasOverdue ? "#f87171" : allDone ? "#4ade80" : hasActive ? "#60a5fa" : null;

              return (
                <button
                  key={idx}
                  onClick={() => dayTasks.length > 0 && setSelectedDay(selectedDay === day ? null : day)}
                  className="flex flex-col items-center justify-center aspect-square rounded-xl relative transition-all active:scale-95"
                  style={{
                    background: selectedDay === day
                      ? "rgba(36,100,108,0.35)"
                      : isToday
                      ? "rgba(36,100,108,0.25)"
                      : dayTasks.length > 0
                      ? "rgba(255,255,255,0.03)"
                      : "transparent",
                    border: (selectedDay === day || isToday) ? "1px solid rgba(36,100,108,0.5)" : "1px solid transparent",
                    cursor: dayTasks.length > 0 ? "pointer" : "default",
                  }}
                >
                  <span
                    className="text-sm font-medium"
                    style={{
                      color: isToday ? "#9fd4dc" : dayTasks.length > 0 ? "#e5e5e5" : "#3f3f46",
                    }}
                  >
                    {day}
                  </span>
                  {dotColor && (
                    <div className="flex gap-0.5 mt-0.5">
                      {dayTasks.slice(0, 3).map((_, i) => (
                        <div
                          key={i}
                          className="rounded-full"
                          style={{
                            width: 4,
                            height: 4,
                            background: dotColor,
                          }}
                        />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-2 px-4">
          {[
            { color: "#60a5fa", label: "Pendente" },
            { color: "#f87171", label: "Vencida" },
            { color: "#4ade80", label: "Concluída" },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />
              <span className="text-xs" style={{ color: "#52525b" }}>{l.label}</span>
            </div>
          ))}
        </div>

        {/* Task list — do dia selecionado ou do mês inteiro */}
        {tasks.length > 0 && (() => {
          const listTasks = selectedDay
            ? tasks.filter((t) => new Date(t.dueDate).getUTCDate() === selectedDay)
            : tasks;
          return (
          <div className="mt-6 px-2 space-y-2">
            <div className="flex items-center justify-between px-1 mb-3">
              <p className="text-xs font-medium" style={{ color: "#a1a1aa" }}>
                {selectedDay
                  ? `OBRIGAÇÕES DO DIA ${String(selectedDay).padStart(2, "0")}/${String(month).padStart(2, "0")}`
                  : `OBRIGAÇÕES DE ${MONTHS[month - 1].toUpperCase()}`}
              </p>
              {selectedDay && (
                <button onClick={() => setSelectedDay(null)} className="text-xs px-2 py-1 rounded-lg" style={{ color: "#9fd4dc", background: "rgba(36,100,108,0.15)" }}>
                  Ver o mês todo
                </button>
              )}
            </div>
            {listTasks.map((task) => {
              const due = new Date(task.dueDate);
              const isOverdue = due < today && task.status !== "CONCLUIDA";
              const StatusIcon = task.status === "CONCLUIDA" ? CheckCircle2
                : isOverdue ? AlertCircle
                : Clock;
              const statusColor = task.status === "CONCLUIDA" ? "#4ade80"
                : isOverdue ? "#f87171"
                : task.status === "EM_ANDAMENTO" ? "#60a5fa"
                : "#facc15";

              return (
                <button
                  key={task.id}
                  onClick={() => setSelectedTask(task as Task)}
                  className="w-full flex items-center justify-between p-4 rounded-2xl text-left active:scale-98 transition-transform"
                  style={{ background: "#111", border: "1px solid #1a1a1a" }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${statusColor}15` }}
                    >
                      <StatusIcon size={18} style={{ color: statusColor }} />
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: "#e5e5e5" }}>{task.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: "#52525b" }}>
                        Vence {formatBR(due)}
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={16} style={{ color: "#3f3f46" }} />
                </button>
              );
            })}
          </div>
          );
        })()}

        {!isLoading && tasks.length === 0 && (
          <div className="text-center py-16 px-6">
            <CalendarDays size={40} className="mx-auto mb-3" style={{ color: "#1e4f5c" }} />
            <p className="text-sm font-medium" style={{ color: "#a1a1aa" }}>Nenhuma obrigação este mês</p>
            <p className="text-xs mt-1" style={{ color: "#52525b" }}>Navegue pelos meses para ver suas guias</p>
          </div>
        )}
          </>
        )}
      </div>

      {/* Task drawer */}
      {selectedTask && (
        <TaskDrawer task={selectedTask} previewClientId={previewClientId} onClose={() => setSelectedTask(null)} />
      )}
    </div>
  );
}
