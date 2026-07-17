import AppLayout from "@/components/AppLayout";
import { TaskTypeBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { BookOpen, ChevronRight, Package, PlusCircle, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function TaskCatalogsPage() {
  const [selectedCatalog, setSelectedCatalog] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [addTemplateOpen, setAddTemplateOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });

  const { data: catalogs = [], refetch: refetchCatalogs } = trpc.taskCatalogs.list.useQuery({ activeOnly: false });
  const { data: allTemplates = [] } = trpc.taskTemplates.list.useQuery({ activeOnly: true });
  const { data: catalogTemplates = [], refetch: refetchTemplates } = trpc.taskCatalogs.getTemplates.useQuery(
    { catalogId: selectedCatalog! },
    { enabled: !!selectedCatalog }
  );

  const createMutation = trpc.taskCatalogs.create.useMutation();
  const updateMutation = trpc.taskCatalogs.update.useMutation();
  const addTemplateMutation = trpc.taskCatalogs.addTemplate.useMutation();
  const removeTemplateMutation = trpc.taskCatalogs.removeTemplate.useMutation();

  const templateMap = new Map(allTemplates.map((t) => [t.id, t]));
  const catalogTemplateIds = new Set(catalogTemplates.map((ct) => ct.taskTemplateId));
  const availableTemplates = allTemplates.filter((t) => !catalogTemplateIds.has(t.id));
  const activeCatalog = catalogs.find((c) => c.id === selectedCatalog);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { id } = await createMutation.mutateAsync(form);
      toast.success("Catálogo criado!");
      setCreateOpen(false);
      setForm({ name: "", description: "" });
      refetchCatalogs();
      setSelectedCatalog(id);
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao criar catálogo");
    }
  };

  const handleToggle = async (id: number, active: boolean) => {
    await updateMutation.mutateAsync({ id, active: !active });
    toast.success(active ? "Catálogo desativado" : "Catálogo reativado");
    refetchCatalogs();
  };

  const handleAddTemplate = async (taskTemplateId: number) => {
    await addTemplateMutation.mutateAsync({ catalogId: selectedCatalog!, taskTemplateId });
    toast.success("Tarefa adicionada ao catálogo");
    refetchTemplates();
    setAddTemplateOpen(false);
  };

  const handleRemoveTemplate = async (taskTemplateId: number) => {
    await removeTemplateMutation.mutateAsync({ catalogId: selectedCatalog!, taskTemplateId });
    toast.success("Tarefa removida do catálogo");
    refetchTemplates();
  };

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#e5e5e5" }}>Catálogos de Serviços</h1>
            <p className="text-sm mt-0.5" style={{ color: "#a1a1aa" }}>
              Pacotes de tarefas para aplicar a clientes de uma vez
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2" style={{ background: "#24646c", color: "#fff" }}>
            <PlusCircle size={15} /> Novo Catálogo
          </Button>
        </div>

        {/* Info */}
        <div className="p-4 rounded-xl text-sm flex gap-3 items-start" style={{ background: "rgba(36,100,108,0.08)", border: "1px solid rgba(36,100,108,0.2)", color: "#9fd4dc" }}>
          <Package size={15} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium mb-1">Como usar os catálogos</p>
            <ol className="space-y-0.5 text-xs" style={{ color: "#a1a1aa" }}>
              <li>1. Crie um catálogo (ex: "Simples Nacional") e adicione as tarefas que ele inclui</li>
              <li>2. No cadastro do cliente, selecione o catálogo e todas as tarefas são vinculadas automaticamente</li>
              <li>3. Você ainda pode adicionar ou remover tarefas do cliente individualmente depois</li>
            </ol>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Catalog list */}
          <div className="space-y-2">
            <p className="text-xs font-medium px-1" style={{ color: "#a1a1aa" }}>CATÁLOGOS ({catalogs.length})</p>
            {catalogs.length === 0 ? (
              <div className="rounded-xl border p-6 text-center" style={{ borderColor: "#1e4f5c", background: "#111" }}>
                <Package size={28} className="mx-auto mb-2" style={{ color: "#52525b" }} />
                <p className="text-sm" style={{ color: "#a1a1aa" }}>Nenhum catálogo ainda</p>
                <button onClick={() => setCreateOpen(true)} className="text-xs mt-2 hover:underline" style={{ color: "#9fd4dc" }}>
                  Criar primeiro catálogo
                </button>
              </div>
            ) : (
              catalogs.map((catalog) => (
                <button
                  key={catalog.id}
                  onClick={() => setSelectedCatalog(catalog.id)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all"
                  style={{
                    background: selectedCatalog === catalog.id ? "rgba(36,100,108,0.2)" : "#111",
                    border: `1px solid ${selectedCatalog === catalog.id ? "#24646c" : "#1e4f5c"}`,
                    opacity: catalog.active ? 1 : 0.5,
                  }}
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: "#e5e5e5" }}>{catalog.name}</p>
                    {catalog.description && (
                      <p className="text-xs mt-0.5" style={{ color: "#52525b" }}>{catalog.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggle(catalog.id, catalog.active); }}
                      style={{ color: catalog.active ? "#f87171" : "#4ade80" }}
                    >
                      {catalog.active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                    </button>
                    <ChevronRight size={14} style={{ color: "#52525b" }} />
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Catalog detail */}
          <div className="lg:col-span-2">
            {!selectedCatalog ? (
              <div className="rounded-xl border p-10 text-center h-full flex items-center justify-center" style={{ borderColor: "#1e4f5c", background: "#111" }}>
                <div>
                  <BookOpen size={32} className="mx-auto mb-3" style={{ color: "#52525b" }} />
                  <p className="text-sm" style={{ color: "#a1a1aa" }}>Selecione um catálogo para gerenciar suas tarefas</p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border overflow-hidden" style={{ background: "#111", borderColor: "#1e4f5c" }}>
                <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #1e4f5c" }}>
                  <div>
                    <p className="font-semibold" style={{ color: "#e5e5e5" }}>{activeCatalog?.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: "#52525b" }}>
                      {catalogTemplates.length} tarefa{catalogTemplates.length !== 1 ? "s" : ""} neste catálogo
                    </p>
                  </div>
                  {availableTemplates.length > 0 && (
                    <Button
                      onClick={() => setAddTemplateOpen(true)}
                      className="gap-1.5 text-xs h-7 px-3"
                      style={{ background: "rgba(36,100,108,0.2)", color: "#9fd4dc", border: "1px solid rgba(36,100,108,0.3)" }}
                    >
                      <PlusCircle size={12} /> Adicionar tarefa
                    </Button>
                  )}
                </div>

                {catalogTemplates.length === 0 ? (
                  <div className="p-10 text-center">
                    <p className="text-sm" style={{ color: "#a1a1aa" }}>Nenhuma tarefa neste catálogo</p>
                    <p className="text-xs mt-1 mb-3" style={{ color: "#52525b" }}>Adicione as tarefas que fazem parte deste serviço</p>
                    {availableTemplates.length > 0 && (
                      <Button onClick={() => setAddTemplateOpen(true)} className="gap-2 text-xs" style={{ background: "#24646c", color: "#fff" }}>
                        <PlusCircle size={12} /> Adicionar tarefa
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="divide-y" style={{ borderColor: "rgba(30,79,92,0.3)" }}>
                    {catalogTemplates.map((ct) => {
                      const tmpl = templateMap.get(ct.taskTemplateId);
                      return (
                        <div key={ct.id} className="flex items-center justify-between px-5 py-3">
                          <div className="flex items-center gap-3">
                            {tmpl && <TaskTypeBadge type={tmpl.taskType} />}
                            <div>
                              <p className="text-sm font-medium" style={{ color: "#e5e5e5" }}>
                                {tmpl?.title ?? `Tarefa #${ct.taskTemplateId}`}
                              </p>
                              {tmpl && (
                                <p className="text-xs mt-0.5" style={{ color: "#52525b" }}>
                                  Vence dia {tmpl.dueDayOfMonth}
                                </p>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveTemplate(ct.taskTemplateId)}
                            className="p-1.5 rounded hover:bg-white/5 transition-colors"
                            style={{ color: "#f87171" }}
                            title="Remover do catálogo"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create catalog dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto" style={{ background: "#111", borderColor: "#1e4f5c", color: "#e5e5e5" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "#e5e5e5" }}>Novo Catálogo</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label style={{ color: "#a1a1aa" }}>Nome *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Simples Nacional, MEI, Lucro Presumido..."
                required
                style={{ background: "#0d1f22", borderColor: "#1e4f5c", color: "#e5e5e5" }}
              />
            </div>
            <div className="space-y-1.5">
              <Label style={{ color: "#a1a1aa" }}>Descrição</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Descrição opcional"
                style={{ background: "#0d1f22", borderColor: "#1e4f5c", color: "#e5e5e5" }}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} className="flex-1" style={{ borderColor: "#1e4f5c", color: "#a1a1aa" }}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending} className="flex-1" style={{ background: "#24646c", color: "#fff" }}>
                {createMutation.isPending ? "Criando..." : "Criar Catálogo"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add template to catalog dialog */}
      <Dialog open={addTemplateOpen} onOpenChange={setAddTemplateOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto" style={{ background: "#111", borderColor: "#1e4f5c", color: "#e5e5e5" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "#e5e5e5" }}>Adicionar Tarefa ao Catálogo</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-2 max-h-80 overflow-y-auto">
            {availableTemplates.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: "#a1a1aa" }}>
                Todas as tarefas já estão neste catálogo.
              </p>
            ) : (
              availableTemplates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleAddTemplate(t.id)}
                  disabled={addTemplateMutation.isPending}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-left hover:bg-white/5 transition-colors"
                  style={{ border: "1px solid rgba(30,79,92,0.5)" }}
                >
                  <div className="flex items-center gap-3">
                    <TaskTypeBadge type={t.taskType} />
                    <div>
                      <p className="text-sm font-medium" style={{ color: "#e5e5e5" }}>{t.title}</p>
                      {t.description && <p className="text-xs" style={{ color: "#52525b" }}>{t.description}</p>}
                    </div>
                  </div>
                  <span className="text-xs shrink-0" style={{ color: "#9fd4dc" }}>Dia {t.dueDayOfMonth}</span>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
