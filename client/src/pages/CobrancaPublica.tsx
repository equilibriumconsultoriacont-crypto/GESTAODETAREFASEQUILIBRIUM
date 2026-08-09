import { useEffect, useState } from "react";
import { useParams } from "wouter";

const C = {
  bg: "#0a0f0e", panel: "#0f1a19", panelHi: "#132321", border: "#1e3a37",
  text: "#e8f0ef", textMuted: "#8fa5a1", textFaint: "#5c716d",
  brand: "#24646c", brandText: "#a9dbe3", green: "#34d399", danger: "#f87171",
};
const brl = (v: any) => "R$ " + Number(String(v ?? 0).replace(",", ".")).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CobrancaPublicaPage() {
  const params = useParams();
  const id = (params as any).id;
  // Token assinado que vem no link do e-mail (?t=...). Sem ele o backend recusa
  // (evita adivinhação de ids de cobrança). Repassado em todas as chamadas.
  const t = new URLSearchParams(window.location.search).get("t") || "";
  const q = `?t=${encodeURIComponent(t)}`;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/financeiro/cobranca/${id}${q}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(setData)
      .catch(() => setErr("Cobrança não encontrada."))
      .finally(() => setLoading(false));
  }, [id]);

  const copy = () => { if (data?.pixCopiaCola) { navigator.clipboard.writeText(data.pixCopiaCola); setCopied(true); setTimeout(() => setCopied(false), 2000); } };

  const enviar = async () => {
    if (!file) return;
    setSending(true);
    try {
      const dataBase64: string = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(file); });
      const resp = await fetch(`/api/financeiro/cobranca/${id}/comprovante${q}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataBase64, t }) });
      const j = await resp.json();
      if (j?.ok) setDone(true); else alert(j?.error || "Não foi possível enviar.");
    } catch { alert("Não foi possível ler o arquivo."); }
    setSending(false);
  };

  const wrap: React.CSSProperties = { minHeight: "100dvh", background: C.bg, color: C.text, fontFamily: "Inter, system-ui, sans-serif", display: "flex", justifyContent: "center", padding: "24px 16px" };

  if (loading) return <div style={{ ...wrap, alignItems: "center" }}><span style={{ color: C.textMuted }}>Carregando…</span></div>;
  if (err) return <div style={{ ...wrap, alignItems: "center" }}><span style={{ color: C.textMuted }}>{err}</span></div>;

  const pago = data.status === "pago";
  return (
    <div style={wrap}>
      <div style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{ fontSize: 18, fontWeight: 750, color: C.brandText }}>Equilibrium Consultoria Contábil</div>
          <div style={{ fontSize: 13, color: C.textMuted, marginTop: 2 }}>Cobrança</div>
        </div>

        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
          <div style={{ fontSize: 13, color: C.textMuted }}>{data.clientName}</div>
          <div style={{ fontSize: 15, fontWeight: 650, marginTop: 2 }}>{data.description}{data.competencia ? ` · ${data.competencia}` : ""}</div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 14 }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: pago ? C.green : C.text }}>{brl(data.amount)}</span>
            <span style={{ fontSize: 13, color: C.textMuted }}>vence {new Date(data.dueDate).toLocaleDateString("pt-BR")}</span>
          </div>
          {pago && <div style={{ marginTop: 14, background: "rgba(52,211,153,.12)", border: "1px solid rgba(52,211,153,.25)", color: C.green, borderRadius: 10, padding: "10px 12px", fontSize: 13, textAlign: "center", fontWeight: 600 }}>Esta cobrança já está paga. Obrigado!</div>}
        </div>

        {!pago && data.pixCopiaCola && (
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, marginTop: 14, textAlign: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 650, marginBottom: 12 }}>Pague com PIX</div>
            <img src={`/api/financeiro/pix-qr/${id}.png${q}`} alt="QR Code PIX" width={220} height={220} style={{ borderRadius: 10, background: "#fff", padding: 6 }} />
            <button onClick={copy} style={{ display: "block", width: "100%", marginTop: 14, background: C.panelHi, border: `1px solid ${C.border}`, color: copied ? C.green : C.brandText, borderRadius: 10, padding: "11px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              {copied ? "✓ Copiado!" : "Copiar PIX copia e cola"}
            </button>
            {data.beneficiaryName && <div style={{ fontSize: 12, color: C.textFaint, marginTop: 8 }}>Beneficiário: {data.beneficiaryName}</div>}
          </div>
        )}
        {!pago && !data.pixCopiaCola && (
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, marginTop: 14, fontSize: 13, color: C.textMuted, textAlign: "center" }}>
            Os dados para pagamento serão informados pelo escritório.
          </div>
        )}

        {!pago && (
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, marginTop: 14 }}>
            {done ? (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
                <div style={{ fontWeight: 650 }}>Comprovante enviado!</div>
                <div style={{ fontSize: 13, color: C.textMuted, marginTop: 6 }}>O escritório vai conferir e dar baixa. Obrigado!</div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 14, fontWeight: 650, marginBottom: 4 }}>Já pagou? Envie o comprovante</div>
                <div style={{ fontSize: 12.5, color: C.textMuted, marginBottom: 14 }}>Anexe o comprovante (imagem ou PDF). Ele fica em conferência até o escritório validar.</div>
                <label style={{ display: "block", border: `1.5px dashed ${C.border}`, borderRadius: 12, padding: "18px 12px", textAlign: "center", cursor: "pointer", background: C.panelHi }}>
                  <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ display: "none" }} />
                  <span style={{ fontSize: 13.5, color: file ? C.text : C.textMuted }}>{file ? `📎 ${file.name}` : "Toque para anexar o comprovante"}</span>
                </label>
                <button onClick={enviar} disabled={!file || sending}
                  style={{ width: "100%", marginTop: 14, background: !file || sending ? C.panelHi : C.green, color: !file || sending ? C.textFaint : "#04211f", border: "none", borderRadius: 10, padding: "13px", fontSize: 15, fontWeight: 700, cursor: !file || sending ? "default" : "pointer" }}>
                  {sending ? "Enviando…" : "Enviar comprovante"}
                </button>
              </>
            )}
          </div>
        )}

        <div style={{ textAlign: "center", fontSize: 11, color: C.textFaint, marginTop: 16 }}>Equilibrium Consultoria Contábil · Rio Claro/SP</div>
      </div>
    </div>
  );
}
