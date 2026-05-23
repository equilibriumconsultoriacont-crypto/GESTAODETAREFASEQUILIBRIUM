import { useEffect, useRef } from "react";

const INACTIVITY_MS = 1000 * 60 * 60 * 5; // 5 horas
const WARNING_MS   = 1000 * 60 * 60 * 4 + 1000 * 60 * 50; // aviso 10 min antes (4h50)
const EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];

export function useInactivityLogout(onLogout: () => void) {
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warned         = useRef(false);

  const resetTimers = () => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (warningTimer.current)   clearTimeout(warningTimer.current);
    warned.current = false;

    // Aviso 10 minutos antes
    warningTimer.current = setTimeout(() => {
      if (!warned.current) {
        warned.current = true;
        const stay = window.confirm(
          "⏰ Sua sessão expira em 10 minutos por inatividade.\n\nClique em OK para continuar logado."
        );
        if (stay) resetTimers(); // usuário confirmou, reinicia
      }
    }, WARNING_MS);

    // Logout após 5h de inatividade
    inactivityTimer.current = setTimeout(() => {
      onLogout();
    }, INACTIVITY_MS);
  };

  useEffect(() => {
    resetTimers();
    EVENTS.forEach((e) => window.addEventListener(e, resetTimers, { passive: true }));
    return () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      if (warningTimer.current)   clearTimeout(warningTimer.current);
      EVENTS.forEach((e) => window.removeEventListener(e, resetTimers));
    };
  }, []); // eslint-disable-line
}
