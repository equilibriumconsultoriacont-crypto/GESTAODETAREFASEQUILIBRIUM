import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { COOKIE_NAME, SESSION_DURATION_MS } from "@shared/const";
import { getSessionCookieOptions } from "./cookies";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);

    // Renovar cookie a cada request autenticado (reinicia o timer de inatividade)
    if (user) {
      try {
        const newToken = await sdk.createSessionToken(user.id.toString(), {
          name: user.name || user.email || "",
          expiresInMs: SESSION_DURATION_MS,
        });
        const cookieOptions = getSessionCookieOptions(opts.req);
        opts.res.cookie(COOKIE_NAME, newToken, {
          ...cookieOptions,
          maxAge: SESSION_DURATION_MS,
        });
      } catch {
        // Falha ao renovar não bloqueia o request
      }
    }
  } catch (error) {
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
