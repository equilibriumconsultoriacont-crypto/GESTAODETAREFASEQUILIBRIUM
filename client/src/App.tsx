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
import { useAuth } from "./_core/hooks/useAuth";
import TaskCatalogsPage from "./pages/TaskCatalogs";

function Router() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "#a1a1aa" }}>
          <div style={{ width: 40, height: 40, border: "3px solid #24646c", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
          Carregando...
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
    return (
      <Switch>
        <Route path="/" component={ClientPortal} />
        <Route component={ClientPortal} />
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/clientes" component={Clients} />
      <Route path="/clientes/:id" component={ClientDetail} />
      <Route path="/tarefas" component={Tasks} />
      <Route path="/tarefas/:id" component={TaskDetail} />
      <Route path="/recorrentes" component={RecurringTasksPage} />
      <Route path="/catalogo" component={TaskTemplatesPage} />
      <Route path="/catalogos" component={TaskCatalogsPage} />
      <Route path="/painel-mensal" component={MonthlyPanelPage} />
      <Route path="/upload-inteligente" component={SmartUploadPage} />
      <Route path="/acessos-clientes" component={ClientLoginsPage} />
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
