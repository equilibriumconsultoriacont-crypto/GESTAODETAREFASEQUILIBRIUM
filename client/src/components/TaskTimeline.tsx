import {
  Ban, CalendarClock, CheckCircle2, Clock, Download, FilePlus,
  FileText, Mail, PlusCircle, XCircle,
} from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  PENDENTE: "Pendente",
  EM_ANDAMENTO: "Em andamento",
  AGUARDANDO_CLIENTE: "Aguardando cliente",
  EM_REVISAO: "Em revisão",
  CONCLUIDA: "Concluída",
  CANCELADA: "Dispensada",
  VENCIDA: "Vencida",
};

export interface TimelineEvent {
  type: "created" | "status" | "file" | "email" | "scheduled";
  date: string;
  fromStatus?: string;
  toStatus?: string;
  fileId?: number;
  fileName?: string;
  fileUrl?: string;
  fileSize?: number;
  recipientEmail?: string;
  subject?: string;
  emailStatus?: string;
  note?: string;
}

export function TaskTimelineItem({ ev, isLast }: { ev: TimelineEvent; isLast: boolean }) {
  const date = new Date(ev.date);
  const dateStr = date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  let icon: any = Clock;
  let color = "#a1a1aa";
  let title = "";
  let detail: React.ReactNode = null;

  if (ev.type === "created") {
    icon = PlusCircle; color = "#60a5fa";
    title = "Tarefa criada";
  } else if (ev.type === "status") {
    const to = ev.toStatus;
    if (to === "CONCLUIDA") { icon = CheckCircle2; color = "#4ade80"; title = "Tarefa concluída"; }
    else if (to === "CANCELADA") { icon = Ban; color = "#a1a1aa"; title = "Tarefa dispensada"; }
    else if (to === "VENCIDA") { icon = XCircle; color = "#f87171"; title = "Marcada como vencida"; }
    else { icon = Clock; color = "#facc15"; title = `Status: ${STATUS_LABELS[to ?? ""] ?? to}`; }
  } else if (ev.type === "file") {
    icon = FilePlus; color = "#9fd4dc";
    title = "Arquivo anexado";
    detail = (
      <a href={ev.fileUrl} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 mt-1 px-2 py-1 rounded text-xs hover:bg-white/5 transition-colors"
        style={{ color: "#9fd4dc", border: "1px solid rgba(36,100,108,0.3)" }}>
        <FileText size={12} /> {ev.fileName}
        {ev.fileSize ? <span style={{ color: "#52525b" }}>· {(ev.fileSize / 1024).toFixed(0)} KB</span> : null}
        <Download size={11} />
      </a>
    );
  } else if (ev.type === "scheduled") {
    icon = CalendarClock; color = "#fb923c";
    title = "Envio agendado";
    detail = ev.note ? <div className="mt-1 text-xs" style={{ color: "#a1a1aa" }}>{ev.note}</div> : null;
  } else if (ev.type === "email") {
    const ok = ev.emailStatus === "ENVIADO";
    icon = Mail; color = ok ? "#4ade80" : "#f87171";
    title = ok ? "E-mail enviado ao cliente" : "Falha no envio de e-mail";
    detail = (
      <div className="mt-1 text-xs" style={{ color: "#a1a1aa" }}>
        <span style={{ color: "#e5e5e5" }}>{ev.recipientEmail}</span>
        {ev.subject ? <span> · {ev.subject}</span> : null}
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: `${color}18`, border: `1px solid ${color}44` }}>
          {(() => { const Icon = icon; return <Icon size={15} style={{ color }} />; })()}
        </div>
        {!isLast && <div className="w-px flex-1 my-1" style={{ background: "rgba(255,255,255,0.08)", minHeight: 16 }} />}
      </div>
      <div className="pb-4 flex-1">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-sm font-medium" style={{ color: "#e5e5e5" }}>{title}</span>
          <span className="text-xs" style={{ color: "#52525b" }}>{dateStr}</span>
        </div>
        {detail}
      </div>
    </div>
  );
}

/** Timeline completa: recebe a lista de eventos e renderiza a linha do tempo. */
export function TaskTimeline({ history }: { history: TimelineEvent[] }) {
  if (history.length === 0) {
    return <p className="text-sm text-center py-6" style={{ color: "#52525b" }}>Nenhum evento registrado ainda</p>;
  }
  return (
    <div className="space-y-0">
      {history.map((ev, idx) => (
        <TaskTimelineItem key={idx} ev={ev} isLast={idx === history.length - 1} />
      ))}
    </div>
  );
}
