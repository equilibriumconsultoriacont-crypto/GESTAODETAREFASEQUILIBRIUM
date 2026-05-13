import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

export default function Login() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const loginMutation = (trpc.auth as any).login.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await loginMutation.mutateAsync({ email: email.trim(), password });
      window.location.href = "/";
    } catch (err: any) {
      setError(err?.message || "Credenciais inválidas");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0a",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "16px",
    }}>
      <div style={{ width: "100%", maxWidth: "400px" }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{
            width: "64px", height: "64px", borderRadius: "50%",
            background: "#24646c", display: "flex", alignItems: "center",
            justifyContent: "center", margin: "0 auto 16px",
          }}>
            <span style={{ color: "#fff", fontSize: "24px", fontWeight: "bold" }}>EQ</span>
          </div>
          <h1 style={{ color: "#e5e5e5", fontSize: "24px", fontWeight: "bold", margin: "0 0 4px" }}>
            Equilibrium
          </h1>
          <p style={{ color: "#a1a1aa", fontSize: "14px", margin: 0 }}>
            Gestão de Tarefas Contábeis
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: "#111",
          border: "1px solid #1e4f5c",
          borderRadius: "16px",
          padding: "32px",
        }}>
          <h2 style={{ color: "#e5e5e5", fontSize: "16px", fontWeight: "600", margin: "0 0 24px" }}>
            Entrar na sua conta
          </h2>

          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", color: "#a1a1aa", fontSize: "14px", marginBottom: "8px" }}>
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                placeholder="seu@email.com"
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: "8px",
                  border: "1px solid #1e4f5c", background: "#0a0a0a",
                  color: "#e5e5e5", fontSize: "14px", boxSizing: "border-box",
                  outline: "none",
                }}
              />
            </div>

            {/* Senha */}
            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "block", color: "#a1a1aa", fontSize: "14px", marginBottom: "8px" }}>
                Senha
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="••••••••"
                  style={{
                    width: "100%", padding: "10px 44px 10px 14px", borderRadius: "8px",
                    border: "1px solid #1e4f5c", background: "#0a0a0a",
                    color: "#e5e5e5", fontSize: "14px", boxSizing: "border-box",
                    outline: "none",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute", right: "12px", top: "50%",
                    transform: "translateY(-50%)", background: "none",
                    border: "none", color: "#a1a1aa", cursor: "pointer",
                    fontSize: "12px", padding: 0,
                  }}
                >
                  {showPassword ? "Ocultar" : "Ver"}
                </button>
              </div>
            </div>

            {/* Erro */}
            {error && (
              <div style={{
                background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)",
                borderRadius: "8px", padding: "12px 16px", marginBottom: "16px",
                color: "#f87171", fontSize: "14px",
              }}>
                {error}
              </div>
            )}

            {/* Botão */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              style={{
                width: "100%", padding: "12px", borderRadius: "8px",
                background: loading ? "#1a4a52" : "#24646c", color: "#fff",
                border: "none", fontSize: "15px", fontWeight: "600",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", color: "#52525b", fontSize: "12px", marginTop: "24px" }}>
          Sistema de gestão de tarefas contábeis © 2026 Equilibrium
        </p>
      </div>
    </div>
  );
}
