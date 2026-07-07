import { useState } from "react";
import { trpc } from "@/lib/trpc";

type Mode = "login" | "forgot" | "forgot-sent";

export default function Login() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loginMutation = (trpc.auth as any).login.useMutation();
  const forgotMutation = (trpc.auth as any).forgotPassword.useMutation();

  // Traduz erros do tRPC/Zod para mensagens amigáveis
  const parseError = (err: any, fallback: string): string => {
    const raw = err?.message ?? "";
    // Erro de validação Zod vem como JSON (array de issues) — detectar e traduzir
    if (raw.trim().startsWith("[") || raw.includes("too_small") || raw.includes("invalid_")) {
      try {
        const issues = JSON.parse(raw);
        if (Array.isArray(issues) && issues.length > 0) {
          const issue = issues[0];
          const field = issue.path?.[0];
          if (field === "password" && issue.code === "too_small") return "A senha deve ter pelo menos 6 caracteres.";
          if (field === "email") return "Digite um e-mail válido.";
          return "Verifique os dados informados.";
        }
      } catch {
        // Não era JSON parseável — cai no tratamento genérico abaixo
      }
      if (raw.includes("password") && raw.includes("too_small")) return "A senha deve ter pelo menos 6 caracteres.";
      if (raw.includes("email")) return "Digite um e-mail válido.";
      return "Verifique os dados informados.";
    }
    return raw || fallback;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    // Validação client-side (feedback imediato, evita erro cru do servidor)
    if (!email.trim()) { setError("Digite seu e-mail."); return; }
    if (password.length < 6) { setError("A senha deve ter pelo menos 6 caracteres."); return; }
    setLoading(true);
    try {
      await loginMutation.mutateAsync({ email: email.trim().toLowerCase(), password });
      window.location.href = "/";
    } catch (err: any) {
      setError(parseError(err, "Credenciais inválidas"));
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) { setError("Digite seu e-mail."); return; }
    setLoading(true);
    try {
      await forgotMutation.mutateAsync({ email: email.trim().toLowerCase() });
      setMode("forgot-sent");
    } catch (err: any) {
      setError(parseError(err, "Erro ao enviar e-mail"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img src="/logo.png" alt="Equilíbrio" style={{ width: 72, height: 72, objectFit: "contain", margin: "0 auto 16px", display: "block" }} />
          <h1 style={{ color: "#e5e5e5", fontSize: 24, fontWeight: "bold", margin: "0 0 4px" }}>Equilíbrio</h1>
          <p style={{ color: "#a1a1aa", fontSize: 14, margin: 0 }}>Gestão de Tarefas Contábeis</p>
        </div>

        {/* Card */}
        <div style={{ background: "#111", border: "1px solid #1e4f5c", borderRadius: 16, padding: 32 }}>

          {/* Forgot sent */}
          {mode === "forgot-sent" ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✉️</div>
              <h2 style={{ color: "#e5e5e5", fontSize: 16, fontWeight: 600, marginBottom: 8 }}>E-mail enviado!</h2>
              <p style={{ color: "#a1a1aa", fontSize: 14, marginBottom: 24 }}>
                Se este e-mail estiver cadastrado, você receberá as instruções para redefinir sua senha.
              </p>
              <button onClick={() => setMode("login")} style={{ color: "#9fd4dc", background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>
                ← Voltar para o login
              </button>
            </div>
          ) : (
            <>
              <h2 style={{ color: "#e5e5e5", fontSize: 16, fontWeight: 600, margin: "0 0 24px" }}>
                {mode === "login" ? "Entrar na sua conta" : "Recuperar senha"}
              </h2>

              <form onSubmit={mode === "login" ? handleLogin : handleForgot}>
                {/* Email */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", color: "#a1a1aa", fontSize: 14, marginBottom: 8 }}>E-mail</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading}
                    placeholder="seu@email.com"
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #1e4f5c", background: "#0a0a0a", color: "#e5e5e5", fontSize: 14, boxSizing: "border-box", outline: "none" }} />
                </div>

                {/* Password — only on login */}
                {mode === "login" && (
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <label style={{ color: "#a1a1aa", fontSize: 14 }}>Senha</label>
                    </div>
                    <div style={{ position: "relative" }}>
                      <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                        required disabled={loading} placeholder="••••••••"
                        style={{ width: "100%", padding: "10px 44px 10px 14px", borderRadius: 8, border: "1px solid #1e4f5c", background: "#0a0a0a", color: "#e5e5e5", fontSize: 14, boxSizing: "border-box", outline: "none" }} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#a1a1aa", cursor: "pointer", fontSize: 12 }}>
                        {showPassword ? "Ocultar" : "Ver"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 8, padding: "12px 16px", marginBottom: 16, color: "#f87171", fontSize: 14 }}>
                    {error}
                  </div>
                )}

                {/* Submit */}
                <button type="submit" disabled={loading || !email || (mode === "login" && !password)}
                  style={{ width: "100%", padding: 12, borderRadius: 8, background: loading ? "#1a4a52" : "#24646c", color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer" }}>
                  {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Enviar instruções"}
                </button>

                {/* Toggle mode */}
                <div style={{ textAlign: "center", marginTop: 16 }}>
                  {mode === "login" ? (
                    <button type="button" onClick={() => { setMode("forgot"); setError(""); }}
                      style={{ color: "#9fd4dc", background: "none", border: "none", cursor: "pointer", fontSize: 13 }}>
                      Esqueci minha senha
                    </button>
                  ) : (
                    <button type="button" onClick={() => { setMode("login"); setError(""); }}
                      style={{ color: "#9fd4dc", background: "none", border: "none", cursor: "pointer", fontSize: 13 }}>
                      ← Voltar para o login
                    </button>
                  )}
                </div>
              </form>
            </>
          )}
        </div>

        <p style={{ textAlign: "center", color: "#52525b", fontSize: 12, marginTop: 24 }}>
          Sistema de gestão de tarefas contábeis © 2026 Equilibrium
        </p>
      </div>
    </div>
  );
}
