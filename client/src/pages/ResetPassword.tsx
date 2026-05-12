import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useLocation } from "wouter";
import { AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";

export default function ResetPassword() {
  const [, navigate] = useLocation();
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (t) setToken(t);
    else setError("Token inválido ou ausente. Solicite um novo link de recuperação.");
  }, []);

  const resetPassword = (trpc.auth as any).resetPassword.useMutation({
    onSuccess: () => setSuccess(true),
    onError: (err: any) => setError(err.message || "Token inválido ou expirado"),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirm) { setError("As senhas não coincidem"); return; }
    if (newPassword.length < 6) { setError("A senha deve ter pelo menos 6 caracteres"); return; }
    setIsLoading(true);
    try {
      await resetPassword.mutateAsync({ token, newPassword });
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
          <p className="text-sm" style={{ color: "#a1a1aa" }}>Redefinição de senha</p>
        </div>

        <Card className="border" style={{ borderColor: "#1e4f5c", background: "#111" }}>
          <div className="p-6">
            {success ? (
              <div className="text-center space-y-4">
                <CheckCircle2 size={40} className="mx-auto" style={{ color: "#4ade80" }} />
                <p className="font-medium" style={{ color: "#e5e5e5" }}>Senha redefinida com sucesso!</p>
                <Button onClick={() => navigate("/")} className="w-full" style={{ background: "#24646c", color: "#fff" }}>
                  Ir para o login
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: "#e5e5e5" }}>Nova senha</label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      required
                      disabled={isLoading || !token}
                      className="pr-10"
                      style={{ background: "#0a0a0a", borderColor: "#1e4f5c", color: "#e5e5e5" }}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "#a1a1aa" }}>
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: "#e5e5e5" }}>Confirmar nova senha</label>
                  <Input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repita a senha"
                    required
                    disabled={isLoading || !token}
                    style={{ background: "#0a0a0a", borderColor: "#1e4f5c", color: "#e5e5e5" }}
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: "rgba(214,40,40,0.1)" }}>
                    <AlertCircle size={16} style={{ color: "#f87171" }} />
                    <span className="text-sm" style={{ color: "#f87171" }}>{error}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isLoading || !token || !newPassword || !confirm}
                  className="w-full"
                  style={{ background: "#24646c", color: "#fff" }}
                >
                  {isLoading ? "Salvando..." : "Redefinir senha"}
                </Button>

                <div className="text-center">
                  <button type="button" onClick={() => navigate("/")} className="text-sm hover:underline" style={{ color: "#9fd4dc" }}>
                    ← Voltar para o login
                  </button>
                </div>
              </form>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
