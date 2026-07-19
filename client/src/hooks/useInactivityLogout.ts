import { useEffect, useRef } from "react";

// Deslogamento OBRIGATÓRIO a cada 2 horas, independente de atividade.
// A sessão começa a contar no login; ao passar 2h, desloga (inclusive se o
// navegador foi reaberto depois desse tempo — a checagem roda também na carga).
const SESSION_MS = 1000 * 60 * 60 * 2; // 2 horas
const KEY = "eq_session_start";

export function useInactivityLogout(onLogout: () => void) {
  const onLogoutRef = useRef(onLogout);
  onLogoutRef.current = onLogout;

  useEffect(() => {
    let start = Number(localStorage.getItem(KEY) || "0");
    if (!start) {
      start = Date.now();
      localStorage.setItem(KEY, String(start));
    }

    const check = () => {
      if (Date.now() - start >= SESSION_MS) {
        localStorage.removeItem(KEY);
        console.info("[Sessão] Deslogamento obrigatório (2h).");
        onLogoutRef.current();
      }
    };

    check(); // ex.: reabriu o navegador já passadas as 2h
    const remaining = Math.max(0, SESSION_MS - (Date.now() - start));
    const timer = setTimeout(check, remaining);
    const interval = setInterval(check, 60 * 1000); // reforço p/ abas em 2º plano

    return () => { clearTimeout(timer); clearInterval(interval); };
  }, []);
}
