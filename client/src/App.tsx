import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
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

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "#a1a1aa" }}>
          <p>Carregando...</p>
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
