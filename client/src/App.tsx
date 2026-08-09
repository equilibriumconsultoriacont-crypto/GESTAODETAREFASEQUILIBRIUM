import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, useLocation } from "wouter";
import { lazy, Suspense } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "./_core/hooks/useAuth";
import { useInactivityLogout } from "./hooks/useInactivityLogout";
import InstallBanner from "./components/InstallBanner";

// Páginas carregadas sob demanda (code-splitting): cada rota vira um chunk
// separado, então o bundle inicial não carrega o app inteiro (recharts do
// Financeiro, iframe do gerador de Propostas, WhatsApp etc.) de uma vez.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Clients = lazy(() => import("./pages/Clients"));
const Tasks = lazy(() => import("./pages/Tasks"));
const TaskDetail = lazy(() => import("./pages/TaskDetail"));
const RecurringTasksPage = lazy(() => import("./pages/RecurringTasks"));
const TaskTemplatesPage = lazy(() => import("./pages/TaskTemplates"));
const MonthlyPanelPage = lazy(() => import("./pages/MonthlyPanel"));
const SmartUploadPage = lazy(() => import("./pages/SmartUpload"));
const ClientDetail = lazy(() => import("./pages/ClientDetail"));
const ClientLoginsPage = lazy(() => import("./pages/ClientLogins"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Login = lazy(() => import("./pages/Login"));
const InstallGuide = lazy(() => import("./pages/InstallGuide"));
const ClientPortal = lazy(() => import("./pages/ClientPortal"));
const SetInitialPassword = lazy(() => import("./pages/SetInitialPassword"));
const TaskCatalogsPage = lazy(() => import("./pages/TaskCatalogs"));
const PendingSendsPage = lazy(() => import("./pages/PendingSends"));
const AdminSettingsPage = lazy(() => import("./pages/AdminSettings"));
const UserManagementPage = lazy(() => import("./pages/UserManagement"));
const FinanceiroPage = lazy(() => import("./pages/Financeiro"));
const CalendarPage = lazy(() => import("./pages/Calendar"));
const CobrancaPublicaPage = lazy(() => import("./pages/CobrancaPublica"));
const Hub = lazy(() => import("./pages/Hub"));
const Proposals = lazy(() => import("./pages/Proposals"));
const WhatsAppModule = lazy(() => import("./pages/WhatsAppModule"));
const NotFound = lazy(() => import("@/pages/NotFound"));

// Spinner de carregamento (mesmo visual do loading de autenticação),
// usado como fallback do Suspense enquanto o chunk da rota baixa.
function PageSpinner() {
  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`@keyframes eqSpin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ width: 34, height: 34, borderRadius: "50%", border: "3px solid rgba(159,212,220,0.15)", borderTopColor: "#24646c", animation: "eqSpin 0.8s linear infinite" }} />
    </div>
  );
}

function Router() {
  const { user, loading, logout } = useAuth();

  // Desloga automaticamente após 5h de inatividade (só quando logado)
  useInactivityLogout(user ? logout : () => {});

  const [location] = useLocation();
  // Página pública do tutorial (aberta pelo link do e-mail, antes do login)
  if (location === "/instalar") return <Suspense fallback={<PageSpinner />}><InstallGuide /></Suspense>;
  // Página pública de cobrança/comprovante (aberta pelo link do e-mail, sem login)
  if (location.startsWith("/cobranca/")) {
    return (
      <Suspense fallback={<PageSpinner />}>
        <Switch>
          <Route path="/cobranca/:id" component={CobrancaPublicaPage} />
        </Switch>
      </Suspense>
    );
  }

  if (loading) {
    return <PageSpinner />;
  }

  if (!user) {
    return (
      <>
        <Suspense fallback={<PageSpinner />}>
          <Switch>
            <Route path="/reset-senha" component={ResetPassword} />
            <Route component={Login} />
          </Switch>
        </Suspense>
        <InstallBanner />
      </>
    );
  }

  if ((user as any).role === "client") {
    // Primeiro acesso: obriga a definir a própria senha antes de ver o portal
    if ((user as any).mustChangePassword) {
      return <Suspense fallback={<PageSpinner />}><SetInitialPassword /></Suspense>;
    }
    return (
      <>
        <Suspense fallback={<PageSpinner />}>
          <Switch>
            <Route path="/" component={ClientPortal} />
            <Route component={ClientPortal} />
          </Switch>
        </Suspense>
        <InstallBanner />
      </>
    );
  }

  return (
    <Suspense fallback={<PageSpinner />}>
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
        <Route path="/usuarios" component={UserManagementPage} />
        <Route path="/financeiro" component={FinanceiroPage} />

        {/* Módulo Propostas */}
        <Route path="/propostas" component={Proposals} />

        {/* Módulo WhatsApp (placeholder) */}
        <Route path="/whatsapp" component={WhatsAppModule} />

        <Route path="/portal-cliente/:clientId">
          {(params) => <ClientPortal previewClientId={Number(params.clientId)} />}
        </Route>
        <Route component={NotFound} />
      </Switch>
    </Suspense>
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
