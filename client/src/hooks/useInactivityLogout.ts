import { useEffect, useRef, useState } from "react";

const INACTIVITY_MS = 1000 * 60 * 60 * 5;  // 5 horas sem atividade
const WARNING_MS   = 1000 * 60 * 60 * 4 + 1000 * 60 * 50; // aviso em 4h50
const EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];

export function useInactivityLogout(onLogout: () => void) {
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onLogoutRef     = useRef(onLogout);
  onLogoutRef.current   = onLogout;

  useEffect(() => {
    const reset = () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      if (warningTimer.current)    clearTimeout(warningTimer.current);

      // Aviso silencioso no console (sem confirm que bloqueia o event loop)
      warningTimer.current = setTimeout(() => {
        console.info("[Session] Sessão expirando em 10 minutos por inatividade.");
      }, WARNING_MS);

      // Logout após 5h de inatividade total
      inactivityTimer.current = setTimeout(() => {
        console.info("[Session] Logout por inatividade.");
        onLogoutRef.current();
      }, INACTIVITY_MS);
    };

    reset();
    EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }));

    return () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      if (warningTimer.current)    clearTimeout(warningTimer.current);
      EVENTS.forEach((e) => window.removeEventListener(e, reset));
    };
  }, []);
}
