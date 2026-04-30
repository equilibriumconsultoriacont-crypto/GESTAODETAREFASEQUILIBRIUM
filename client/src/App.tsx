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
import ClientDetail from "./pages/ClientDetail";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/clientes" component={Clients} />
      <Route path="/clientes/:id" component={ClientDetail} />
      <Route path="/tarefas" component={Tasks} />
      <Route path="/tarefas/:id" component={TaskDetail} />
      <Route path="/recorrentes" component={RecurringTasksPage} />
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
