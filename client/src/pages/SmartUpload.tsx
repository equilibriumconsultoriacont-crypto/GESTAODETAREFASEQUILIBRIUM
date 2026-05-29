import AppLayout from "@/components/AppLayout";
import { TaskTypeBadge } from "@/components/StatusBadge";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  CheckCircle2,
  CloudUpload,
  FileText,
  Loader2,
  Mail,
  MessageCircle,
  RefreshCw,
  User,
  X,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

interface UploadResult {
  file: File;
  status: "processing" | "success" | "error";
  result?: any;
  error?: string;
}

export default function SmartUploadPage() {
  const [dragging, setDragging] = useState(false);
  const [queue, setQueue] = useState<UploadResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const processMutation = trpc.smartUpload.process.useMutation();

  const processFile = useCallback(async (file: File) => {
    const id = Date.now() + Math.random();

    setQueue((prev) => [...prev, { file, status: "processing" }]);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const result = await processMutation.mutateAsync({
        filename: file.name,
        mimeType: file.type || "application/pdf",
        base64,
      });

      setQueue((prev) =>
        prev.map((item) =>
          item.file === file
            ? { ...item, status: result.success ? "success" : "error", result, error: result.error }
            : item
        )
      );

      if (result.success) {
        toast.success(`✅ ${file.name} alocado para ${result.client?.name}`);
      } else {
        toast.error(`❌ ${file.name}: ${result.error}`);
      }
    } catch (err: any) {
      setQueue((prev) =>
        prev.map((item) =>
          item.file === file
            ? { ...item, status: "error", error: err?.message ?? "Erro ao processar" }
            : item
        )
      );
      toast.error(`Erro ao processar ${file.name}`);
    }
  }, []);

  const handleFiles = (files: FileList | File[]) => {
    const pdfs = Array.from(files).filter(
      (f) => f.type === "application/pdf" || f.name.endsWith(".pdf")
    );
    if (pdfs.length === 0) {
      toast.error("Apenas arquivos PDF são aceitos");
      return;
    }
    pdfs.forEach(processFile);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const clearItem = (file: File) => {
    setQueue((prev) => prev.filter((item) => item.file !== file));
  };

  const clearAll = () => setQueue([]);

  const processing = queue.filter((q) => q.status === "processing").length;
  const successes = queue.filter((q) => q.status === "success").length;
  const errors = queue.filter((q) => q.status === "error").length;

  return (
    <AppLayout>
      <div className="max-w-3xl space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#e5e5e5" }}>Upload Inteligente de Guias</h1>
          <p className="text-sm mt-0.5" style={{ color: "#a1a1aa" }}>
            Arraste PDFs de guias contábeis — o sistema reconhece o tipo, aloca na tarefa e notifica o cliente automaticamente
          </p>
        </div>

        {/* Info banner */}
        <div
          className="p-4 rounded-xl text-sm flex gap-3 items-start"
          style={{ background: "rgba(36,100,108,0.08)", border: "1px solid rgba(36,100,108,0.2)", color: "#9fd4dc" }}
        >
          <CloudUpload size={15} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium mb-1">Como funciona</p>
            <ol className="space-y-0.5 text-xs" style={{ color: "#a1a1aa" }}>
              <li>1. Você solta o PDF aqui</li>
              <li>2. A IA lê e extrai: tipo (DAS, NFS, DCTF...), CNPJ/CPF e competência</li>
              <li>3. O sistema localiza o cliente e a tarefa correspondente</li>
              <li>4. O arquivo é anexado à tarefa e o cliente recebe e-mail + WhatsApp</li>
            </ol>
            <p className="mt-2 text-xs" style={{ color: "#52525b" }}>
              Suportado: <strong style={{ color: "#9fd4dc" }}>DAS</strong>, <strong style={{ color: "#9fd4dc" }}>DAS MEI</strong>, <strong style={{ color: "#9fd4dc" }}>NFS-e</strong>, <strong style={{ color: "#9fd4dc" }}>DCTF</strong>, <strong style={{ color: "#9fd4dc" }}>SPED</strong> e outros.
            </p>
          </div>
        </div>

        {/* Drop zone */}
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={() => setDragging(false)}
          onClick={() => fileInputRef.current?.click()}
          className="relative cursor-pointer rounded-2xl transition-all duration-200 flex flex-col items-center justify-center gap-3 py-14"
          style={{
            border: `2px dashed ${dragging ? "#9fd4dc" : "#1e4f5c"}`,
            background: dragging ? "rgba(36,100,108,0.12)" : "rgba(0,0,0,0.2)",
            transform: dragging ? "scale(1.01)" : "scale(1)",
          }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: dragging ? "rgba(36,100,108,0.3)" : "rgba(36,100,108,0.15)" }}
          >
            <CloudUpload size={26} style={{ color: "#9fd4dc" }} />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium" style={{ color: "#e5e5e5" }}>
              {dragging ? "Solte aqui!" : "Arraste PDFs ou clique para selecionar"}
            </p>
            <p className="text-xs mt-1" style={{ color: "#52525b" }}>
              Aceita múltiplos arquivos PDF — DAS, NFS-e, DCTF, SPED e outros
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
        </div>

        {/* Stats */}
        {queue.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex gap-4 text-xs">
              {processing > 0 && (
                <span className="flex items-center gap-1.5" style={{ color: "#60a5fa" }}>
                  <Loader2 size={12} className="animate-spin" /> {processing} processando
                </span>
              )}
              {successes > 0 && (
                <span className="flex items-center gap-1.5" style={{ color: "#4ade80" }}>
                  <CheckCircle2 size={12} /> {successes} alocado{successes !== 1 ? "s" : ""}
                </span>
              )}
              {errors > 0 && (
                <span className="flex items-center gap-1.5" style={{ color: "#f87171" }}>
                  <AlertCircle size={12} /> {errors} com erro
                </span>
              )}
            </div>
            {queue.every((q) => q.status !== "processing") && (
              <button
                onClick={clearAll}
                className="text-xs hover:underline"
                style={{ color: "#52525b" }}
              >
                Limpar tudo
              </button>
            )}
          </div>
        )}

        {/* Queue items */}
        <div className="space-y-3">
          {queue.map((item, idx) => (
            <div
              key={idx}
              className="rounded-xl border overflow-hidden"
              style={{
                background: "#111",
                borderColor:
                  item.status === "success"
                    ? "rgba(74,222,128,0.3)"
                    : item.status === "error"
                    ? "rgba(248,113,113,0.3)"
                    : "#1e4f5c",
              }}
            >
              {/* File header */}
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: item.status === "processing" ? "none" : "1px solid rgba(30,79,92,0.4)", background: "rgba(0,0,0,0.15)" }}
              >
                <div className="flex items-center gap-2">
                  {item.status === "processing" && <Loader2 size={14} className="animate-spin" style={{ color: "#60a5fa" }} />}
                  {item.status === "success" && <CheckCircle2 size={14} style={{ color: "#4ade80" }} />}
                  {item.status === "error" && <AlertCircle size={14} style={{ color: "#f87171" }} />}
                  <FileText size={14} style={{ color: "#a1a1aa" }} />
                  <span className="text-sm font-medium truncate max-w-xs" style={{ color: "#e5e5e5" }}>
                    {item.file.name}
                  </span>
                  <span className="text-xs" style={{ color: "#52525b" }}>
                    {(item.file.size / 1024).toFixed(0)} KB
                  </span>
                </div>
                {item.status !== "processing" && (
                  <button onClick={() => clearItem(item.file)} className="p-1 rounded hover:bg-white/5" style={{ color: "#52525b" }}>
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Processing state */}
              {item.status === "processing" && (
                <div className="px-4 py-3">
                  <div className="flex items-center gap-2 text-xs" style={{ color: "#60a5fa" }}>
                    <RefreshCw size={12} className="animate-spin" />
                    Analisando documento com IA...
                  </div>
                  <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                    <div className="h-full rounded-full animate-pulse" style={{ width: "60%", background: "linear-gradient(90deg, #24646c, #9fd4dc)" }} />
                  </div>
                </div>
              )}

              {/* Success state */}
              {item.status === "success" && item.result && (
                <div className="px-4 py-3 space-y-3">
                  {/* Recognition result */}
                  <div className="flex flex-wrap gap-2">
                    <span
                      className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium gap-1.5"
                      style={{ background: "rgba(36,100,108,0.2)", color: "#9fd4dc", border: "1px solid rgba(36,100,108,0.3)" }}
                    >
                      <TaskTypeBadge type="DAS" />
                      {item.result.recognition?.documentType === "DAS_MEI" ? "DAS MEI" : "DAS Simples Nacional"}
                    </span>
                    {item.result.recognition?.competencia && (
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded text-xs"
                        style={{ background: "rgba(250,204,21,0.1)", color: "#facc15", border: "1px solid rgba(250,204,21,0.2)" }}
                      >
                        Competência {item.result.recognition.competencia}
                      </span>
                    )}
                    {item.result.recognition?.valorPrincipal && (
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded text-xs"
                        style={{ background: "rgba(74,222,128,0.1)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.2)" }}
                      >
                        R$ {item.result.recognition.valorPrincipal}
                      </span>
                    )}
                    <span
                      className="inline-flex items-center px-2.5 py-1 rounded text-xs"
                      style={{ background: "rgba(82,82,91,0.2)", color: "#a1a1aa" }}
                    >
                      {item.result.recognition?.confidence}% confiança
                    </span>
                  </div>

                  {/* Client + Task */}
                  <div className="grid grid-cols-2 gap-3">
                    <div
                      className="rounded-lg px-3 py-2.5 flex items-center gap-2"
                      style={{ background: "rgba(36,100,108,0.08)", border: "1px solid rgba(36,100,108,0.15)" }}
                    >
                      <User size={13} style={{ color: "#9fd4dc" }} />
                      <div>
                        <p className="text-xs" style={{ color: "#52525b" }}>Cliente</p>
                        <Link href={`/clientes/${item.result.client?.id}`}>
                          <p className="text-sm font-medium hover:underline cursor-pointer" style={{ color: "#e5e5e5" }}>
                            {item.result.client?.name}
                          </p>
                        </Link>
                      </div>
                    </div>
                    <div
                      className="rounded-lg px-3 py-2.5 flex items-center gap-2"
                      style={{ background: "rgba(36,100,108,0.08)", border: "1px solid rgba(36,100,108,0.15)" }}
                    >
                      <FileText size={13} style={{ color: "#9fd4dc" }} />
                      <div>
                        <p className="text-xs" style={{ color: "#52525b" }}>Tarefa</p>
                        <Link href={`/tarefas/${item.result.task?.id}`}>
                          <p className="text-sm font-medium hover:underline cursor-pointer truncate" style={{ color: "#e5e5e5" }}>
                            {item.result.task?.title}
                          </p>
                        </Link>
                      </div>
                    </div>
                  </div>

                  {/* Notifications */}
                  <div className="flex gap-3 flex-wrap">
                    <div
                      className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg"
                      style={item.result.emailSent
                        ? { background: "rgba(74,222,128,0.1)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.2)" }
                        : { background: "rgba(251,146,60,0.1)", color: "#fb923c", border: "1px solid rgba(251,146,60,0.2)" }}
                    >
                      <Mail size={11} />
                      {item.result.emailSent ? "✅ E-mail enviado" : "📋 Pendente de envio"}
                    </div>
                  </div>

                  {!item.result.emailSent && (
                    <p className="text-xs mt-1" style={{ color: "#a1a1aa" }}>
                      🕐 Será enviado automaticamente na próxima hora cheia. Acesse <strong>Pendentes Envio</strong> para disparar agora.
                    </p>
                  )}
                </div>
              )}

              {/* Error state */}
              {item.status === "error" && (
                <div className="px-4 py-3">
                  <p className="text-sm" style={{ color: "#f87171" }}>{item.error}</p>
                  {item.result?.recognition && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(82,82,91,0.2)", color: "#a1a1aa" }}>
                        Tipo detectado: {item.result.recognition.documentType}
                      </span>
                      {item.result.recognition.cnpj && (
                        <span className="text-xs px-2 py-0.5 rounded font-mono" style={{ background: "rgba(82,82,91,0.2)", color: "#a1a1aa" }}>
                          CNPJ: {item.result.recognition.cnpj}
                        </span>
                      )}
                      {item.result.recognition.cpf && (
                        <span className="text-xs px-2 py-0.5 rounded font-mono" style={{ background: "rgba(82,82,91,0.2)", color: "#a1a1aa" }}>
                          CPF: {item.result.recognition.cpf}
                        </span>
                      )}
                      {item.result.clientFound && (
                        <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(250,204,21,0.1)", color: "#facc15" }}>
                          Cliente encontrado: {item.result.clientFound.name}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
