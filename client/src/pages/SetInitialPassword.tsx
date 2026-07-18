import { useState } from "react";
import { trpc } from "@/lib/trpc";

// Primeiro acesso do cliente: o usuário foi criado automaticamente com senha
// padrão e precisa definir a própria senha antes de ver o portal.
export default function SetInitialPassword() {
  const utils = trpc.useUtils();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const setPassword = (trpc.auth as any).setInitialPassword.useMutation();

  const submit = async () => {
    setError("");
    if (pw.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (pw !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    try {
      await setPassword.mutateAsync({ newPassword: pw });
      await utils.auth.me.invalidate(); // re-roteia para o portal
    } catch {
      setError("Não foi possível salvar a senha. Tente novamente.");
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "#0d1f22",
    border: "1px solid #1e4f5c",
    borderRadius: 8,
    color: "#e5e5e5",
    padding: "10px 12px",
    margin: "6px 0 14px",
    outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 400, background: "#111", border: "1px solid #1e4f5c", borderRadius: 12, padding: 28 }}>
        <h1 style={{ color: "#e5e5e5", fontSize: 20, fontWeight: 700, margin: "0 0 6px" }}>Defina sua senha</h1>
        <p style={{ color: "#a1a1aa", fontSize: 14, margin: "0 0 20px", lineHeight: 1.5 }}>
          Este é seu primeiro acesso. Crie uma senha pessoal para continuar.
        </p>

        <label style={{ color: "#a1a1aa", fontSize: 13 }}>Nova senha</label>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="Mínimo 6 caracteres"
          style={inputStyle}
        />

        <label style={{ color: "#a1a1aa", fontSize: 13 }}>Confirmar senha</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Repita a senha"
          style={inputStyle}
        />

        {error && <p style={{ color: "#f87171", fontSize: 13, margin: "0 0 12px" }}>{error}</p>}

        <button
          onClick={submit}
          disabled={setPassword.isPending}
          style={{
            width: "100%",
            background: "#24646c",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "11px",
            fontWeight: 700,
            cursor: setPassword.isPending ? "default" : "pointer",
            opacity: setPassword.isPending ? 0.6 : 1,
          }}
        >
          {setPassword.isPending ? "Salvando..." : "Salvar e entrar"}
        </button>
      </div>
    </div>
  );
}
