import { useAuth } from "@/_core/hooks/useAuth";

/** Retorna true se o usuário logado é admin. Útil para esconder ações estruturais. */
export function useIsAdmin(): boolean {
  const { user } = useAuth();
  return user?.role === "admin";
}
