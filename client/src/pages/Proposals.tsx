import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, FileText } from "lucide-react";
import { useEffect, useRef } from "react";
import { Link } from "wouter";

// Módulo Propostas — embute o gerador (HTML/JS testado) num iframe e faz a
// ponte de armazenamento para o BANCO (via tRPC), no lugar do storage local.
// As propostas ficam na tabela `proposals`; o catálogo/config ("base") fica
// numa proposta especial de sistema (title = "__base__").
export default function Proposals() {
  const { user } = useAuth();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const utils = trpc.useUtils();
  const { data: myModules = [], isLoading: modulesLoading } = trpc.modules.mine.useQuery();

  // Guard: só acessa quem tem o módulo "propostas"
  const hasAccess = myModules.some((m: any) => m.module === "propostas");

  // Mutations/queries para persistência
  const createMutation = trpc.proposals.create.useMutation();
  const updateMutation = trpc.proposals.update.useMutation();
  const deleteMutation = trpc.proposals.delete.useMutation();

  useEffect(() => {
    // Handler das mensagens vindas do iframe (ponte de storage)
    const handler = async (ev: MessageEvent) => {
      const d = ev.data;
      if (!d || !d.__equilibrium_storage) return;

      const respond = (result: any) => {
        iframeRef.current?.contentWindow?.postMessage(
          { __equilibrium_storage_response: true, id: d.id, result }, "*"
        );
      };

      try {
        const all = await utils.proposals.list.fetch();

        if (d.op === "get") {
          if (d.key === "base") {
            // Catálogo/config: guardado numa proposta de sistema
            const base = all.find((p: any) => p.title === "__base__");
            if (!base) return respond(null);
            const full = await utils.proposals.get.fetch({ id: base.id });
            return respond(full?.data ?? null);
          }
          // Proposta individual (prop:timestamp)
          const found = all.find((p: any) => p.clientName === d.key || `prop:${p.id}` === d.key);
          if (!found) return respond(null);
          const full = await utils.proposals.get.fetch({ id: found.id });
          return respond(full?.data ?? null);
        }

        if (d.op === "set") {
          if (d.key === "base") {
            const base = all.find((p: any) => p.title === "__base__");
            if (base) {
              await updateMutation.mutateAsync({ id: base.id, data: d.value });
            } else {
              await createMutation.mutateAsync({ title: "__base__", data: d.value });
            }
            await utils.proposals.list.invalidate();
            return respond(true);
          }
          // Proposta: parse para extrair título/cliente
          let title = d.key, clientName = d.key;
          try {
            const parsed = JSON.parse(d.value);
            title = parsed.num ? `Proposta ${parsed.num}` : d.key;
            clientName = parsed.cliente || parsed.num || d.key;
          } catch {}
          const existing = all.find((p: any) => p.clientName === d.key);
          if (existing) {
            await updateMutation.mutateAsync({ id: existing.id, title, clientName: d.key, data: d.value });
          } else {
            await createMutation.mutateAsync({ title, clientName: d.key, data: d.value });
          }
          await utils.proposals.list.invalidate();
          return respond(true);
        }

        if (d.op === "delete") {
          const found = all.find((p: any) => p.clientName === d.key);
          if (found) {
            await deleteMutation.mutateAsync({ id: found.id });
            await utils.proposals.list.invalidate();
          }
          return respond(true);
        }

        if (d.op === "list") {
          // Lista as chaves com o prefixo pedido (ex: "prop:")
          const prefix = d.prefix || "";
          const keys = all
            .filter((p: any) => p.title !== "__base__")
            .map((p: any) => p.clientName)
            .filter((k: string) => k && k.startsWith(prefix));
          return respond(keys);
        }

        respond(null);
      } catch (err) {
        console.error("[Proposals] storage bridge error:", err);
        respond(null);
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [utils, createMutation, updateMutation, deleteMutation]);

  // Bloqueio de acesso: usuário sem o módulo Propostas
  if (!modulesLoading && !hasAccess) {
    return (
      <div style={{ minHeight: "100vh", background: "#0B1F23", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ textAlign: "center", maxWidth: 420 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "rgba(248,113,113,0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
            <FileText size={26} style={{ color: "#f87171" }} />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#E8F0F0", marginBottom: 8 }}>Sem acesso a este módulo</h1>
          <p style={{ fontSize: 14, color: "#8B9491", marginBottom: 20 }}>
            Você não tem permissão para acessar o Gerador de Propostas. Peça a um administrador para liberar o módulo.
          </p>
          <Link href="/">
            <button style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#24646c", border: "none", borderRadius: 8, padding: "10px 16px", color: "#fff", cursor: "pointer", fontSize: 14 }}>
              <ArrowLeft size={15} /> Voltar à plataforma
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0B1F23", display: "flex", flexDirection: "column" }}>
      {/* Barra superior da plataforma */}
      <header style={{ borderBottom: "1px solid #1F4A52", background: "#102B31", flexShrink: 0 }}>
        <div style={{ padding: "12px 20px", display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/">
            <button style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "1px solid #1F4A52", borderRadius: 8, padding: "8px 12px", color: "#C5E4EA", cursor: "pointer", fontSize: 13 }}>
              <ArrowLeft size={15} /> Plataforma
            </button>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(192,132,252,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FileText size={18} style={{ color: "#c084fc" }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#E8F0F0" }}>Gerador de Propostas</div>
              <div style={{ fontSize: 12, color: "#6E8B90" }}>Propostas salvas na nuvem</div>
            </div>
          </div>
        </div>
      </header>

      {/* O gerador roda no iframe, ocupando o resto da tela */}
      <iframe
        ref={iframeRef}
        src="/tools/gerador-propostas.html"
        title="Gerador de Propostas"
        style={{ flex: 1, width: "100%", border: "none" }}
      />
    </div>
  );
}
