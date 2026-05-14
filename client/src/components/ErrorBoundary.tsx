import React from "react";

interface State { hasError: boolean; error?: Error }

export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error("[ErrorBoundary]", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "#111", border: "1px solid #1e4f5c", borderRadius: 16, padding: 32, maxWidth: 400, textAlign: "center" }}>
            <p style={{ color: "#f87171", fontWeight: "bold", marginBottom: 8 }}>Algo deu errado</p>
            <p style={{ color: "#a1a1aa", fontSize: 13, marginBottom: 24 }}>{this.state.error?.message}</p>
            <button
              onClick={() => { this.setState({ hasError: false }); window.location.href = "/"; }}
              style={{ background: "#24646c", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", cursor: "pointer" }}
            >
              Voltar ao início
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
