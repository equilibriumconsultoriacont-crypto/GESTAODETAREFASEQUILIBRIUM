import { useEffect, useState } from "react";

// Banner que aparece ao abrir no navegador (quando ainda não está instalado).
// Android/Chrome: botão que dispara a instalação nativa (um toque).
// iPhone (Safari): Apple não permite instalar por código — mostramos a orientação + link do guia.
export default function InstallBanner() {
  const [deferred, setDeferred] = useState<any>(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Já instalado (rodando como app)? Não mostra.
    const standalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      (navigator as any).standalone === true;
    if (standalone) return;
    // Dispensado antes? Respeita por 7 dias.
    try {
      const until = Number(localStorage.getItem("eqInstallDismissed") || "0");
      if (until && Date.now() < until) return;
    } catch {}

    const ua = navigator.userAgent || "";
    const ios = /iPhone|iPod|iPad/i.test(ua);
    const inApp = /(FBAN|FBAV|FB_IAB|Instagram|Line|Twitter|Snapchat|WhatsApp|MicroMessenger|; wv|WebView)/i.test(ua);

    if (ios) {
      // iOS: só orientação, e só fora de navegador embutido de app.
      if (!inApp) {
        setIsIOS(true);
        setShow(true);
      }
      return;
    }

    // Android / Chrome desktop: captura o evento de instalação.
    const onPrompt = (e: any) => {
      e.preventDefault();
      setDeferred(e);
      setShow(true);
    };
    const onInstalled = () => setShow(false);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!show) return null;

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem("eqInstallDismissed", String(Date.now() + 7 * 24 * 60 * 60 * 1000));
    } catch {}
  };

  const install = async () => {
    if (!deferred) return;
    try {
      deferred.prompt();
      await deferred.userChoice;
    } catch {}
    setDeferred(null);
    setShow(false);
  };

  return (
    <div
      style={{
        position: "fixed",
        left: 12,
        right: 12,
        bottom: 12,
        zIndex: 9999,
        maxWidth: 460,
        margin: "0 auto",
        background: "#12313a",
        border: "1px solid #2f6b78",
        borderRadius: 14,
        padding: "12px 12px 12px 14px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxShadow: "0 12px 34px rgba(0,0,0,0.45)",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 11,
          background: "#24646c",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 19 }}>E</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, color: "#fff", fontSize: 13.5, fontWeight: 700 }}>Adicionar à tela inicial</p>
        {isIOS ? (
          <p style={{ margin: "2px 0 0", color: "#9fd4dc", fontSize: 12, lineHeight: 1.45 }}>
            Toque em Compartilhar e depois em “Adicionar à Tela de Início”.
          </p>
        ) : (
          <p style={{ margin: "2px 0 0", color: "#9fd4dc", fontSize: 12 }}>Abra com um toque, como um aplicativo.</p>
        )}
      </div>
      {isIOS ? (
        <a
          href="/instalar"
          style={{
            flexShrink: 0,
            textDecoration: "none",
            background: "#24646c",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            padding: "8px 14px",
            borderRadius: 9,
          }}
        >
          Ver como
        </a>
      ) : (
        <button
          onClick={install}
          style={{
            flexShrink: 0,
            border: "none",
            background: "#24646c",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            padding: "8px 16px",
            borderRadius: 9,
            cursor: "pointer",
          }}
        >
          Instalar
        </button>
      )}
      <button
        onClick={dismiss}
        aria-label="Fechar"
        style={{ flexShrink: 0, background: "none", border: "none", color: "#7a9aa2", fontSize: 20, lineHeight: 1, cursor: "pointer", padding: "4px 6px" }}
      >
        ×
      </button>
    </div>
  );
}
