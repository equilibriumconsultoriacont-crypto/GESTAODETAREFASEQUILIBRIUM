import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import {
  Bell, Check, ChevronLeft, ChevronRight, Clock, MapPin, PlusCircle,
  Trash2, Users, X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const EVENT_COLORS = ["#24646c", "#c084fc", "#fb923c", "#4ade80", "#facc15", "#f87171", "#60a5fa"];

function pad(n: number) { return String(n).padStart(2, "0"); }
function toLocalInput(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CalendarPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // Intervalo do mês (com margem para eventos que cruzam a virada)
  const rangeStart = new Date(year, month, 1, 0, 0, 0);
  const rangeEnd = new Date(year, month + 1, 0, 23, 59, 59);

  const { data: events = [], refetch } = trpc.calendar.events.useQuery({
    startISO: rangeStart.toISOString(),
    endISO: rangeEnd.toISOString(),
  });
  const { data: pendingInvites = [], refetch: refetchInvites } = trpc.calendar.pendingInvites.useQuery();
  const { data: invitableUsers = [] } = trpc.calendar.invitableUsers.useQuery();
  const { data: googleStatus } = trpc.calendar.googleStatus.useQuery();

  const utils = trpc.useUtils();
  const respondMutation = trpc.calendar.respondInvite.useMutation();

  // Agrupar eventos por dia
  const eventsByDay = useMemo(() => {
    const map = new Map<number, any[]>();
    for (const ev of events) {
      const d = new Date(ev.startAt);
      // Só conta se o evento é neste mês/ano (pelo dia de início)
      if (d.getMonth() === month && d.getFullYear() === year) {
        const day = d.getDate();
        if (!map.has(day)) map.set(day, []);
        map.get(day)!.push(ev);
      }
    }
    return map;
  }, [events, month, year]);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(year - 1); } else setMonth(month - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(year + 1); } else setMonth(month + 1); };
  const goToday = () => { setMonth(now.getMonth()); setYear(now.getFullYear()); };

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const openCreate = (day?: number) => {
    setEditing(null);
    setSelectedDay(day ?? null);
    setDialogOpen(true);
  };
  const openEdit = (ev: any) => {
    setEditing(ev);
    setDialogOpen(true);
  };

  const handleRespond = async (eventId: number, status: "ACEITO" | "RECUSADO") => {
    try {
      await respondMutation.mutateAsync({ eventId, status });
      toast.success(status === "ACEITO" ? "Convite aceito!" : "Convite recusado");
      refetchInvites();
      refetch();
      utils.calendar.events.invalidate();
    } catch (err: any) { toast.error(err?.message ?? "Erro"); }
  };

  const selectedDayEvents = selectedDay ? (eventsByDay.get(selectedDay) ?? []) : [];

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#f4f4f5" }}>Calendário</h1>
            <p className="text-sm mt-0.5" style={{ color: "#a1a1aa" }}>Suas reuniões e compromissos</p>
          </div>
          <Button onClick={() => openCreate()} className="gap-2" style={{ background: "#24646c", color: "#fff" }}>
            <PlusCircle size={15} /> Novo compromisso
          </Button>
        </div>

        {/* Convites pendentes */}
        {pendingInvites.length > 0 && (
          <div className="rounded-2xl border p-4" style={{ background: "rgba(251,146,60,0.06)", borderColor: "rgba(251,146,60,0.3)" }}>
            <div className="flex items-center gap-2 mb-3">
              <Bell size={15} style={{ color: "#fb923c" }} />
              <span className="text-sm font-semibold" style={{ color: "#f4f4f5" }}>
                Convites pendentes ({pendingInvites.length})
              </span>
            </div>
            <div className="space-y-2">
              {pendingInvites.map((inv: any) => {
                const start = new Date(inv.startAt);
                return (
                  <div key={inv.id} className="flex items-center justify-between rounded-xl p-3 gap-3" style={{ background: "#0d1f22", border: "1px solid rgba(30,79,92,0.5)" }}>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: "#f4f4f5" }}>{inv.title}</div>
                      <div className="text-xs mt-0.5" style={{ color: "#52525b" }}>
                        Convidado por {inv.ownerName} · {start.toLocaleDateString("pt-BR")} às {pad(start.getHours())}:{pad(start.getMinutes())}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => handleRespond(inv.id, "ACEITO")} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-green-900/30" style={{ color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)" }}>
                        <Check size={12} /> Aceitar
                      </button>
                      <button onClick={() => handleRespond(inv.id, "RECUSADO")} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-red-900/30" style={{ color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" }}>
                        <X size={12} /> Recusar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Navegação do mês */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-white/5" style={{ color: "#9fd4dc", border: "1px solid #1e4f5c" }}>
              <ChevronLeft size={16} />
            </button>
            <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-white/5" style={{ color: "#9fd4dc", border: "1px solid #1e4f5c" }}>
              <ChevronRight size={16} />
            </button>
            <h2 className="text-lg font-bold ml-1" style={{ color: "#f4f4f5" }}>{MONTHS[month]} {year}</h2>
            <button onClick={goToday} className="text-xs px-2.5 py-1 rounded-lg hover:bg-white/5 ml-1" style={{ color: "#9fd4dc", border: "1px solid #1e4f5c" }}>
              Hoje
            </button>
          </div>
        </div>

        {/* Grade do calendário */}
        <div className="rounded-2xl border overflow-hidden" style={{ background: "#111", borderColor: "#1e4f5c" }}>
          <div className="grid grid-cols-7" style={{ borderBottom: "1px solid #1e4f5c" }}>
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center text-xs font-medium py-2.5" style={{ color: "#52525b" }}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((day, idx) => {
              if (!day) return <div key={idx} style={{ minHeight: 92, borderRight: (idx + 1) % 7 !== 0 ? "1px solid rgba(30,79,92,0.2)" : "none", borderBottom: "1px solid rgba(30,79,92,0.2)" }} />;
              const dayEvents = eventsByDay.get(day) ?? [];
              const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              return (
                <button key={idx} onClick={() => setSelectedDay(day)}
                  className="text-left p-1.5 transition-colors hover:bg-white/[0.02] relative"
                  style={{
                    minHeight: 92,
                    borderRight: (idx + 1) % 7 !== 0 ? "1px solid rgba(30,79,92,0.2)" : "none",
                    borderBottom: "1px solid rgba(30,79,92,0.2)",
                    background: selectedDay === day ? "rgba(36,100,108,0.1)" : "transparent",
                  }}>
                  <div className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium mb-1"
                    style={{ background: isToday ? "#24646c" : "transparent", color: isToday ? "#fff" : dayEvents.length > 0 ? "#e5e5e5" : "#52525b" }}>
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((ev: any) => (
                      <div key={ev.id} className="text-[10px] px-1 py-0.5 rounded truncate" style={{ background: `${ev.color}25`, color: ev.color, borderLeft: `2px solid ${ev.color}` }}>
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] px-1" style={{ color: "#52525b" }}>+{dayEvents.length - 3} mais</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Eventos do dia selecionado */}
        {selectedDay && (
          <div className="rounded-2xl border p-4" style={{ background: "#111", borderColor: "#1e4f5c" }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold" style={{ color: "#f4f4f5" }}>
                {selectedDay} de {MONTHS[month]}
              </span>
              <button onClick={() => openCreate(selectedDay)} className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/5" style={{ color: "#9fd4dc" }}>
                <PlusCircle size={12} /> Adicionar
              </button>
            </div>
            {selectedDayEvents.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: "#52525b" }}>Nenhum compromisso neste dia</p>
            ) : (
              <div className="space-y-2">
                {selectedDayEvents.map((ev: any) => (
                  <EventCard key={ev.id} event={ev} onEdit={() => openEdit(ev)} onChanged={() => { refetch(); utils.calendar.events.invalidate(); }} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Nota sobre Google Calendar (gancho) */}
        {googleStatus && !googleStatus.available && (
          <div className="rounded-xl border p-3 flex items-center gap-2.5" style={{ background: "rgba(96,165,250,0.05)", borderColor: "rgba(96,165,250,0.2)" }}>
            <Clock size={14} className="shrink-0" style={{ color: "#60a5fa" }} />
            <p className="text-xs" style={{ color: "#a1a1aa" }}>
              A sincronização com o Google Agenda (Google Calendar) está em preparação e será ativada em breve —
              seus compromissos aparecerão automaticamente na sua conta do Gmail com notificações.
            </p>
          </div>
        )}
      </div>

      <EventDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        editing={editing}
        defaultDay={selectedDay}
        month={month}
        year={year}
        invitableUsers={invitableUsers}
        onSaved={() => { setDialogOpen(false); refetch(); utils.calendar.events.invalidate(); }}
      />
    </AppLayout>
  );
}

// ── Card de evento ──
function EventCard({ event, onEdit, onChanged }: { event: any; onEdit: () => void; onChanged: () => void }) {
  const deleteMutation = trpc.calendar.delete.useMutation();
  const start = new Date(event.startAt);
  const end = new Date(event.endAt);
  const isOwner = event.myRole === "owner";

  const handleDelete = async () => {
    if (!confirm(`Excluir o compromisso "${event.title}"?`)) return;
    try {
      await deleteMutation.mutateAsync({ id: event.id });
      toast.success("Compromisso excluído");
      onChanged();
    } catch (err: any) { toast.error(err?.message ?? "Erro"); }
  };

  return (
    <div className="rounded-xl p-3" style={{ background: "#0d1f22", border: "1px solid rgba(30,79,92,0.5)", borderLeft: `3px solid ${event.color}` }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium" style={{ color: "#f4f4f5" }}>{event.title}</div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-xs flex items-center gap-1" style={{ color: "#a1a1aa" }}>
              <Clock size={11} />
              {event.allDay ? "Dia todo" : `${pad(start.getHours())}:${pad(start.getMinutes())} – ${pad(end.getHours())}:${pad(end.getMinutes())}`}
            </span>
            {event.location && (
              <span className="text-xs flex items-center gap-1" style={{ color: "#a1a1aa" }}>
                <MapPin size={11} /> {event.location}
              </span>
            )}
          </div>
          {event.description && <p className="text-xs mt-1.5" style={{ color: "#71717a" }}>{event.description}</p>}
          {event.guests && event.guests.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <Users size={11} style={{ color: "#52525b" }} />
              {event.guests.map((g: any) => (
                <span key={g.userId} className="text-[10px] px-1.5 py-0.5 rounded" style={{
                  background: g.status === "ACEITO" ? "rgba(74,222,128,0.12)" : g.status === "RECUSADO" ? "rgba(248,113,113,0.12)" : "rgba(82,82,91,0.15)",
                  color: g.status === "ACEITO" ? "#4ade80" : g.status === "RECUSADO" ? "#f87171" : "#a1a1aa",
                }}>
                  {g.name || g.email} {g.status === "ACEITO" ? "✓" : g.status === "RECUSADO" ? "✕" : "•"}
                </span>
              ))}
            </div>
          )}
          {!isOwner && <div className="text-[10px] mt-1.5" style={{ color: "#52525b" }}>Você foi convidado</div>}
        </div>
        {isOwner && (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={onEdit} className="p-1.5 rounded hover:bg-white/5 text-xs" style={{ color: "#9fd4dc" }}>Editar</button>
            <button onClick={handleDelete} className="p-1.5 rounded hover:bg-red-900/30" style={{ color: "#f87171" }}>
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Dialog criar/editar evento ──
function EventDialog({ open, onClose, editing, defaultDay, month, year, invitableUsers, onSaved }: any) {
  const createMutation = trpc.calendar.create.useMutation();
  const updateMutation = trpc.calendar.update.useMutation();

  const buildDefault = () => {
    const base = defaultDay ? new Date(year, month, defaultDay, 9, 0) : new Date();
    base.setMinutes(0);
    const end = new Date(base); end.setHours(base.getHours() + 1);
    return {
      title: "", description: "", location: "",
      startAt: toLocalInput(base), endAt: toLocalInput(end),
      allDay: false, color: EVENT_COLORS[0], guestUserIds: [] as number[],
    };
  };

  const [form, setForm] = useState(buildDefault());

  // Reset ao abrir
  useMemo(() => {
    if (open) {
      if (editing) {
        setForm({
          title: editing.title ?? "",
          description: editing.description ?? "",
          location: editing.location ?? "",
          startAt: toLocalInput(new Date(editing.startAt)),
          endAt: toLocalInput(new Date(editing.endAt)),
          allDay: !!editing.allDay,
          color: editing.color ?? EVENT_COLORS[0],
          guestUserIds: (editing.guests ?? []).map((g: any) => g.userId),
        });
      } else {
        setForm(buildDefault());
      }
    }
    // eslint-disable-next-line
  }, [open, editing]);

  const toggleGuest = (id: number) => {
    setForm((f) => ({ ...f, guestUserIds: f.guestUserIds.includes(id) ? f.guestUserIds.filter((x) => x !== id) : [...f.guestUserIds, id] }));
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error("Informe o título"); return; }
    if (new Date(form.endAt) < new Date(form.startAt)) { toast.error("O término não pode ser antes do início"); return; }
    try {
      if (editing) {
        await updateMutation.mutateAsync({
          id: editing.id, title: form.title, description: form.description || undefined,
          location: form.location || undefined, startAt: new Date(form.startAt).toISOString(),
          endAt: new Date(form.endAt).toISOString(), allDay: form.allDay, color: form.color,
        });
        toast.success("Compromisso atualizado!");
      } else {
        await createMutation.mutateAsync({
          title: form.title, description: form.description || undefined,
          location: form.location || undefined, startAt: new Date(form.startAt).toISOString(),
          endAt: new Date(form.endAt).toISOString(), allDay: form.allDay, color: form.color,
          guestUserIds: form.guestUserIds,
        });
        toast.success("Compromisso criado!");
      }
      onSaved();
    } catch (err: any) { toast.error(err?.message ?? "Erro ao salvar"); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto" style={{ background: "#111", borderColor: "#1e4f5c", color: "#e5e5e5" }}>
        <DialogHeader><DialogTitle style={{ color: "#e5e5e5" }}>{editing ? "Editar" : "Novo"} compromisso</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label style={{ color: "#a1a1aa" }}>Título *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1"
              placeholder="Ex: Reunião com cliente" style={{ background: "#0d1f22", borderColor: "#1e4f5c", color: "#e5e5e5" }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label style={{ color: "#a1a1aa" }}>Início *</Label>
              <input type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })}
                className="w-full rounded-md px-3 py-2 text-sm mt-1" style={{ background: "#0d1f22", border: "1px solid #1e4f5c", color: "#e5e5e5", outline: "none", colorScheme: "dark" }} />
            </div>
            <div>
              <Label style={{ color: "#a1a1aa" }}>Término *</Label>
              <input type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })}
                className="w-full rounded-md px-3 py-2 text-sm mt-1" style={{ background: "#0d1f22", border: "1px solid #1e4f5c", color: "#e5e5e5", outline: "none", colorScheme: "dark" }} />
            </div>
          </div>
          <div>
            <Label style={{ color: "#a1a1aa" }}>Local (opcional)</Label>
            <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="mt-1"
              placeholder="Ex: Sala de reunião, Google Meet..." style={{ background: "#0d1f22", borderColor: "#1e4f5c", color: "#e5e5e5" }} />
          </div>
          <div>
            <Label style={{ color: "#a1a1aa" }}>Descrição (opcional)</Label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
              className="w-full rounded-md px-3 py-2 text-sm mt-1 resize-none" style={{ background: "#0d1f22", border: "1px solid #1e4f5c", color: "#e5e5e5", outline: "none" }} />
          </div>
          <div>
            <Label style={{ color: "#a1a1aa" }}>Cor</Label>
            <div className="flex gap-2 mt-2 flex-wrap">
              {EVENT_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                  className="w-7 h-7 rounded-full transition-transform"
                  style={{ background: c, transform: form.color === c ? "scale(1.2)" : "scale(1)", border: form.color === c ? "2px solid #fff" : "2px solid transparent" }} />
              ))}
            </div>
          </div>
          {/* Convidados (só ao criar) */}
          {!editing && invitableUsers.length > 0 && (
            <div>
              <Label style={{ color: "#a1a1aa" }}>Convidar pessoas (opcional)</Label>
              <div className="mt-2 space-y-1 max-h-32 overflow-y-auto rounded-lg border p-2" style={{ borderColor: "#1e4f5c", background: "#0d1f22" }}>
                {invitableUsers.map((u: any) => {
                  const active = form.guestUserIds.includes(u.id);
                  return (
                    <button key={u.id} type="button" onClick={() => toggleGuest(u.id)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs hover:bg-white/5"
                      style={{ color: active ? "#9fd4dc" : "#a1a1aa" }}>
                      <div className="w-4 h-4 rounded flex items-center justify-center shrink-0" style={{ border: `1px solid ${active ? "#9fd4dc" : "#52525b"}`, background: active ? "#9fd4dc" : "transparent" }}>
                        {active && <Check size={10} style={{ color: "#0d1f22" }} />}
                      </div>
                      {u.name || u.email}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs mt-1" style={{ color: "#52525b" }}>Os convidados recebem o convite e podem aceitar ou recusar.</p>
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1" style={{ borderColor: "#1e4f5c", color: "#a1a1aa" }}>Cancelar</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending} className="flex-1" style={{ background: "#24646c", color: "#fff" }}>
              {editing ? "Salvar" : "Criar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
