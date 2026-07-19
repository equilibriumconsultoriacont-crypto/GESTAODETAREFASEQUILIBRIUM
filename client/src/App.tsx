import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import Tasks from "./pages/Tasks";
import TaskDetail from "./pages/TaskDetail";
import RecurringTasksPage from "./pages/RecurringTasks";
import TaskTemplatesPage from "./pages/TaskTemplates";
import MonthlyPanelPage from "./pages/MonthlyPanel";
import SmartUploadPage from "./pages/SmartUpload";
import ClientDetail from "./pages/ClientDetail";
import ClientLoginsPage from "./pages/ClientLogins";
import ResetPassword from "./pages/ResetPassword";
import Login from "./pages/Login";
import InstallGuide from "./pages/InstallGuide";
import ClientPortal from "./pages/ClientPortal";
import SetInitialPassword from "./pages/SetInitialPassword";
import { useAuth } from "./_core/hooks/useAuth";
import TaskCatalogsPage from "./pages/TaskCatalogs";
import PendingSendsPage from "./pages/PendingSends";
import AdminSettingsPage from "./pages/AdminSettings";
import CalendarPage from "./pages/Calendar";
import Hub from "./pages/Hub";
import Proposals from "./pages/Proposals";
import WhatsAppModule from "./pages/WhatsAppModule";
import { useInactivityLogout } from "./hooks/useInactivityLogout";

function Router() {
  const { user, loading, logout } = useAuth();

  // Desloga automaticamente após 5h de inatividade (só quando logado)
  useInactivityLogout(user ? logout : () => {});

  const [location] = useLocation();
  // Página pública do tutorial (aberta pelo link do e-mail, antes do login)
  if (location === "/instalar") return <InstallGuide />;

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <style>{`
          @keyframes eqLogoReveal { 0% { opacity: 0; transform: scale(0.82) translateY(6px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
          @keyframes eqNameUp { 0% { opacity: 0; transform: translateY(12px); } 100% { opacity: 1; transform: translateY(0); } }
          @keyframes eqBarSlide { 0% { transform: translateX(-110%); } 100% { transform: translateX(260%); } }
        `}</style>
        <img src="/logo.png" alt="Equilíbrio" style={{ width: 100, height: 100, objectFit: "contain", animation: "eqLogoReveal 0.8s cubic-bezier(0.16,1,0.3,1) both" }} />
        <h1 style={{ color: "#e5e5e5", fontSize: 25, fontWeight: 700, letterSpacing: "0.5px", margin: "20px 0 4px", animation: "eqNameUp 0.7s ease 0.55s both" }}>Equilíbrio</h1>
        <p style={{ color: "#9fd4dc", fontSize: 12, letterSpacing: "2.5px", textTransform: "uppercase", margin: 0, animation: "eqNameUp 0.7s ease 0.75s both" }}>Consultoria Contábil</p>
        <div style={{ width: 92, height: 2, borderRadius: 2, background: "rgba(159,212,220,0.15)", overflow: "hidden", marginTop: 26, animation: "eqNameUp 0.7s ease 0.95s both" }}>
          <div style={{ width: "38%", height: "100%", background: "#24646c", borderRadius: 2, animation: "eqBarSlide 1.2s ease-in-out infinite" }} />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Switch>
        <Route path="/reset-senha" component={ResetPassword} />
        <Route component={Login} />
      </Switch>
    );
  }

  if ((user as any).role === "client") {
    // Primeiro acesso: obriga a definir a própria senha antes de ver o portal
    if ((user as any).mustChangePassword) {
      return <SetInitialPassword />;
    }
    return (
      <Switch>
        <Route path="/" component={ClientPortal} />
        <Route component={ClientPortal} />
      </Switch>
    );
  }

  return (
    <Switch>
      {/* Hub da plataforma — tela de seleção de módulos */}
      <Route path="/" component={Hub} />

      {/* Módulo Tarefas — /painel é o dashboard; rotas internas mantidas */}
      <Route path="/painel" component={Dashboard} />
      <Route path="/clientes" component={Clients} />
      <Route path="/clientes/:id" component={ClientDetail} />
      <Route path="/tarefas" component={Tasks} />
      <Route path="/tarefas/:id" component={TaskDetail} />
      <Route path="/calendario" component={CalendarPage} />
      <Route path="/recorrentes" component={RecurringTasksPage} />
      <Route path="/catalogo" component={TaskTemplatesPage} />
      <Route path="/catalogos" component={TaskCatalogsPage} />
      <Route path="/painel-mensal" component={MonthlyPanelPage} />
      <Route path="/upload-inteligente" component={SmartUploadPage} />
      <Route path="/acessos-clientes" component={ClientLoginsPage} />
      <Route path="/pendentes-envio" component={PendingSendsPage} />
      <Route path="/configuracoes" component={AdminSettingsPage} />

      {/* Módulo Propostas */}
      <Route path="/propostas" component={Proposals} />

      {/* Módulo WhatsApp (placeholder) */}
      <Route path="/whatsapp" component={WhatsAppModule} />

      <Route path="/portal-cliente/:clientId">
        {(params) => <ClientPortal previewClientId={Number(params.clientId)} />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster theme="dark" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
