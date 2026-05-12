import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useLocation } from "wouter";
import { AlertCircle, Eye, EyeOff, CheckCircle2 } from "lucide-react";

export default function Login() {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const login = (trpc.auth as any).login.useMutation({
    onSuccess: () => navigate("/"),
    onError: (err: any) => setError(err.message || "Credenciais inválidas"),
  });

  const forgotPassword = (trpc.auth as any).forgotPassword.useMutation({
    onSuccess: () => setSuccess("Se este e-mail estiver cadastrado, você receberá as instruções em breve."),
    onError: (err: any) => setError(err.message || "Erro ao enviar e-mail"),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);
    try {
      if (mode === "login") {
        await login.mutateAsync({ email, password });
      } else {
        await forgotPassword.mutateAsync({ email });
      }
    } catch {}
    finally { setIsLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0a0a" }}>
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "#24646c" }}>
            <span className="text-2xl font-bold" style={{ color: "#e5e5e5" }}>EQ</span>
          </div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: "#e5e5e5" }}>Equilibrium</h1>
          <p className="text-sm" style={{ color: "#a1a1aa" }}>Gestão de Tarefas Contábeis</p>
        </div>

        <Card className="border" style={{ borderColor: "#1e4f5c", background: "#111" }}>
          <div className="p-6">
            <h2 className="text-base font-semibold mb-4" style={{ color: "#e5e5e5" }}>
              {mode === "login" ? "Entrar na sua conta" : "Recuperar senha"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "#e5e5e5" }}>E-mail</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  disabled={isLoading}
                  style={{ background: "#0a0a0a", borderColor: "#1e4f5c", color: "#e5e5e5" }}
                />
              </div>

              {mode === "login" && (
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: "#e5e5e5" }}>Senha</label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      disabled={isLoading}
                      className="pr-10"
                      style={{ background: "#0a0a0a", borderColor: "#1e4f5c", color: "#e5e5e5" }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      style={{ color: "#a1a1aa" }}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: "rgba(214,40,40,0.1)" }}>
                  <AlertCircle size={16} style={{ color: "#f87171" }} />
                  <span className="text-sm" style={{ color: "#f87171" }}>{error}</span>
                </div>
              )}

              {success && (
                <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: "rgba(74,222,128,0.1)" }}>
                  <CheckCircle2 size={16} style={{ color: "#4ade80" }} />
                  <span className="text-sm" style={{ color: "#4ade80" }}>{success}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading || !email || (mode === "login" && !password)}
                className="w-full font-medium"
                style={{ background: "#24646c", color: "#fff" }}
              >
                {isLoading ? "Aguarde..." : mode === "login" ? "Entrar" : "Enviar instruções"}
              </Button>

              <div className="text-center">
                {mode === "login" ? (
                  <button
                    type="button"
                    onClick={() => { setMode("forgot"); setError(""); setSuccess(""); }}
                    className="text-sm hover:underline"
                    style={{ color: "#9fd4dc" }}
                  >
                    Esqueci minha senha
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
                    className="text-sm hover:underline"
                    style={{ color: "#9fd4dc" }}
                  >
                    ← Voltar para o login
                  </button>
                )}
              </div>
            </form>
          </div>
        </Card>

        <p className="text-center text-xs mt-6" style={{ color: "#52525b" }}>
          Sistema de gestão de tarefas contábeis © 2026 Equilibrium
        </p>
      </div>
    </div>
  );
}
