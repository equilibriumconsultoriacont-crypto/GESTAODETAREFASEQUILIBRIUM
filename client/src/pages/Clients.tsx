import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Building2, Edit2, PlusCircle, Search, ToggleLeft, ToggleRight } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

function formatCNPJ(v: string) {
  return v
    .replace(/\D/g, "")
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2")
    .slice(0, 18);
}

export default function Clients() {
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editClient, setEditClient] = useState<null | { id: number; name: string; cnpj: string; email: string; phone?: string | null; notes?: string | null }>(null);
  const [form, setForm] = useState({ name: "", cnpj: "", email: "", phone: "", notes: "" });

  const { data: clients = [], isLoading, refetch } = trpc.clients.list.useQuery({ includeInactive: showInactive });
  const createMutation = trpc.clients.create.useMutation();
  const updateMutation = trpc.clients.update.useMutation();
  const utils = trpc.useUtils();

  const filtered = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.cnpj.includes(search) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditClient(null);
    setForm({ name: "", cnpj: "", email: "", phone: "", notes: "" });
    setDialogOpen(true);
  };

  const openEdit = (c: typeof clients[0]) => {
    setEditClient(c);
    setForm({ name: c.name, cnpj: c.cnpj, email: c.email, phone: c.phone ?? "", notes: c.notes ?? "" });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editClient) {
        await updateMutation.mutateAsync({ id: editClient.id, ...form });
        toast.success("Cliente atualizado com sucesso");
      } else {
        await createMutation.mutateAsync(form);
        toast.success("Cliente cadastrado com sucesso");
      }
      setDialogOpen(false);
      utils.clients.list.invalidate();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar cliente");
    }
  };

  const toggleActive = async (c: typeof clients[0]) => {
    await updateMutation.mutateAsync({ id: c.id, active: !c.active });
    toast.success(c.active ? "Cliente desativado" : "Cliente reativado");
    utils.clients.list.invalidate();
  };

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#e5e5e5" }}>Clientes</h1>
            <p className="text-sm mt-0.5" style={{ color: "#a1a1aa" }}>{clients.length} cliente{clients.length !== 1 ? "s" : ""} cadastrado{clients.length !== 1 ? "s" : ""}</p>
          </div>
          <Button onClick={openCreate} className="gap-2" style={{ background: "#24646c", color: "#fff" }}>
            <PlusCircle size={15} />
            Novo Cliente
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#52525b" }} />
            <Input
              placeholder="Buscar por nome, CNPJ ou e-mail..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-sm"
              style={{ background: "#111", borderColor: "#1e4f5c", color: "#e5e5e5" }}
            />
          </div>
          <button
            onClick={() => setShowInactive(!showInactive)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all"
            style={showInactive ? { background: "rgba(36,100,108,0.2)", color: "#9fd4dc", border: "1px solid rgba(36,100,108,0.4)" } : { background: "#111", color: "#a1a1aa", border: "1px solid #1e4f5c" }}
          >
            {showInactive ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
            Mostrar inativos
          </button>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 rounded-lg animate-pulse" style={{ background: "#1a1a1a" }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 rounded-xl border" style={{ borderColor: "#1e4f5c", background: "#111" }}>
            <Building2 size={36} className="mx-auto mb-3" style={{ color: "#52525b" }} />
            <p className="text-sm font-medium" style={{ color: "#a1a1aa" }}>Nenhum cliente encontrado</p>
            <button onClick={openCreate} className="text-xs mt-2 hover:underline" style={{ color: "#9fd4dc" }}>
              Cadastrar primeiro cliente
            </button>
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#1e4f5c", background: "#111" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid #1e4f5c" }}>
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: "#a1a1aa" }}>Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-medium hidden md:table-cell" style={{ color: "#a1a1aa" }}>CNPJ</th>
                  <th className="text-left px-4 py-3 text-xs font-medium hidden lg:table-cell" style={{ color: "#a1a1aa" }}>E-mail</th>
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: "#a1a1aa" }}>Status</th>
                  <th className="text-right px-4 py-3 text-xs font-medium" style={{ color: "#a1a1aa" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((client, idx) => (
                  <tr key={client.id} style={{ borderBottom: idx < filtered.length - 1 ? "1px solid rgba(30,79,92,0.4)" : "none" }}>
                    <td className="px-4 py-3">
                      <Link href={`/clientes/${client.id}`}>
                        <span className="font-medium cursor-pointer hover:underline" style={{ color: "#e5e5e5" }}>{client.name}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell font-mono text-xs" style={{ color: "#a1a1aa" }}>{client.cnpj}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs" style={{ color: "#a1a1aa" }}>{client.email}</td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                        style={client.active
                          ? { background: "rgba(34,197,94,0.12)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" }
                          : { background: "rgba(82,82,91,0.2)", color: "#a1a1aa", border: "1px solid rgba(82,82,91,0.4)" }}
                      >
                        {client.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(client)} className="p-1.5 rounded hover:bg-white/5 transition-colors" style={{ color: "#9fd4dc" }} title="Editar">
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => toggleActive(client)}
                          className="p-1.5 rounded hover:bg-white/5 transition-colors"
                          style={{ color: client.active ? "#f87171" : "#4ade80" }}
                          title={client.active ? "Desativar" : "Reativar"}
                        >
                          {client.active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent style={{ background: "#111", borderColor: "#1e4f5c", color: "#e5e5e5" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "#e5e5e5" }}>{editClient ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label style={{ color: "#a1a1aa" }}>Nome / Razão Social *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required style={{ background: "#0d1f22", borderColor: "#1e4f5c", color: "#e5e5e5" }} />
            </div>
            <div className="space-y-1.5">
              <Label style={{ color: "#a1a1aa" }}>CNPJ *</Label>
              <Input
                value={form.cnpj}
                onChange={(e) => setForm({ ...form, cnpj: formatCNPJ(e.target.value) })}
                placeholder="00.000.000/0000-00"
                required
                style={{ background: "#0d1f22", borderColor: "#1e4f5c", color: "#e5e5e5" }}
              />
            </div>
            <div className="space-y-1.5">
              <Label style={{ color: "#a1a1aa" }}>E-mail *</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required style={{ background: "#0d1f22", borderColor: "#1e4f5c", color: "#e5e5e5" }} />
            </div>
            <div className="space-y-1.5">
              <Label style={{ color: "#a1a1aa" }}>Telefone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={{ background: "#0d1f22", borderColor: "#1e4f5c", color: "#e5e5e5" }} />
            </div>
            <div className="space-y-1.5">
              <Label style={{ color: "#a1a1aa" }}>Observações</Label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                className="w-full rounded-md px-3 py-2 text-sm resize-none"
                style={{ background: "#0d1f22", borderColor: "#1e4f5c", color: "#e5e5e5", border: "1px solid #1e4f5c", outline: "none" }}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1" style={{ borderColor: "#1e4f5c", color: "#a1a1aa" }}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="flex-1" style={{ background: "#24646c", color: "#fff" }}>
                {createMutation.isPending || updateMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
