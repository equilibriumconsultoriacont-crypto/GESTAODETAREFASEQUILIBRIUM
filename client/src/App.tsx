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
import ClientPortal from "./pages/ClientPortal";
import ClientLoginsPage from "./pages/ClientLogins";
import ResetPassword from "./pages/ResetPassword";
import Login from "./pages/Login";
import { useAuth } from "./_core/hooks/useAuth";

function Router() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0a0a" }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mx-auto mb-4"></div>
          <p style={{ color: "#a1a1aa" }}>Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Switch>
        <Route path="/reset-senha" component={ResetPassword} />
        <Route path="/" component={Login} />
        <Route component={Login} />
      </Switch>
    );
  }

  // Cliente logado → portal exclusivo
  if ((user as any).role === "client") {
    return (
      <Switch>
        <Route path="/" component={ClientPortal} />
        <Route component={ClientPortal} />
      </Switch>
    );
  }

  // Admin/staff → painel completo
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/clientes" component={Clients} />
      <Route path="/clientes/:id" component={ClientDetail} />
      <Route path="/tarefas" component={Tasks} />
      <Route path="/tarefas/:id" component={TaskDetail} />
      <Route path="/recorrentes" component={RecurringTasksPage} />
      <Route path="/catalogo" component={TaskTemplatesPage} />
      <Route path="/painel-mensal" component={MonthlyPanelPage} />
      <Route path="/upload-inteligente" component={SmartUploadPage} />
      <Route path="/acessos-clientes" component={ClientLoginsPage} />
      <Route path="/reset-senha" component={ResetPassword} />
      <Route path="/404" component={NotFound} />
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
