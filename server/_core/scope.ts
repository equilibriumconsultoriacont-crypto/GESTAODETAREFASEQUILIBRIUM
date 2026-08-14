// ─────────────────────────────────────────────────────────────────────────────
// Escopo de acesso por EMPRESA (RBAC de dados) — fonte única da verdade.
//
// Perfis:
//   • ADM total          → role="admin", limitedAccess=false → vê/mexe em TUDO.
//   • ADM Limitado       → role="admin", limitedAccess=true  → poderes de admin, mas só
//                          nas empresas vinculadas a ele (userClients).
//   • Funcionário comum  → role="user",  limitedAccess=false → restrito às empresas dele
//                          nas Tarefas/Financeiro, mas continua vendo a fila compartilhada
//                          no Atendimento.
//   • Funcionário Limitado → role="user", limitedAccess=true → cadastrado por um ADM
//                          Limitado; restrito às empresas dele em TODOS os módulos
//                          (inclusive Atendimento).
// ─────────────────────────────────────────────────────────────────────────────
import { TRPCError } from "@trpc/server";
import { getUserClients } from "../db";

export type ScopedUser = { id: number; role: string; limitedAccess?: boolean | null } | null | undefined;

/** ADM total: enxerga e mexe em tudo, sem recorte por empresa. */
export function isFullAdmin(user: ScopedUser): boolean {
  return !!user && user.role === "admin" && !user.limitedAccess;
}

/** ADM Limitado: poderes de admin, mas restrito às empresas vinculadas. */
export function isLimitedAdmin(user: ScopedUser): boolean {
  return !!user && user.role === "admin" && !!user.limitedAccess;
}

/**
 * Restrição por empresa nas LISTAGENS de dados (clientes, tarefas, financeiro):
 * todos menos o ADM total ficam restritos às empresas vinculadas (userClients).
 * (O funcionário comum já era assim nas Tarefas; agora vale em toda listagem — é o que
 * corrige o vazamento do dropdown de clientes.)
 */
export function isCompanyScoped(user: ScopedUser): boolean {
  return !!user && !isFullAdmin(user);
}

/** Conjunto de empresas que o usuário pode ver/mexer (vazio = nenhuma). */
export async function getScopeClientIds(userId: number): Promise<Set<number>> {
  return new Set(await getUserClients(userId));
}

/**
 * Filtra uma lista de itens que têm `clientId` para o que o usuário pode ver.
 * ADM total recebe a lista inteira; os demais, só os itens das empresas deles.
 */
export async function filterByScope<T extends { clientId?: number | null }>(
  user: ScopedUser,
  items: T[],
): Promise<T[]> {
  if (isFullAdmin(user)) return items;
  if (!user) return [];
  const allowed = await getScopeClientIds(user.id);
  return items.filter((it) => it.clientId != null && allowed.has(it.clientId));
}

/**
 * Garante que o usuário pode agir sobre a empresa informada. ADM total passa sempre;
 * os demais só nas empresas vinculadas a eles. Lança FORBIDDEN caso contrário.
 */
export async function assertClientInScope(user: ScopedUser, clientId: number): Promise<void> {
  if (isFullAdmin(user)) return;
  if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Não autenticado." });
  const allowed = await getScopeClientIds(user.id);
  if (!allowed.has(clientId)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Empresa fora do seu acesso." });
  }
}

/**
 * Recorte por empresa no ATENDIMENTO (WhatsApp): só os usuários "limitados" (ADM Limitado
 * e Funcionário Limitado) ficam restritos às conversas das empresas deles. Funcionário
 * comum continua vendo a fila compartilhada, como antes.
 */
export function isWaCompanyScoped(user: ScopedUser): boolean {
  return !!user && !!user.limitedAccess;
}
