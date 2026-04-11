import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";
import { LanguageToggle } from "@/components/LanguageToggle";
import { UserMenu } from "@/components/UserMenu";
import { RequireAuth } from "@/components/RequireAuth";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import MergePdf from "@/pages/home";
import JpgToPdf from "@/pages/jpg-to-pdf";
import PdfToJpg from "@/pages/pdf-to-jpg";
import Split from "@/pages/split";
import Compress from "@/pages/compress";
import IncomeCalculator from "@/pages/income-calculator";

const queryClient = new QueryClient();

function TopBar() {
  return (
    <div className="fixed top-3 right-3 z-50 flex items-center gap-2">
      <LanguageToggle />
      <UserMenu />
    </div>
  );
}

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/pdf" component={Dashboard} />
      <Route path="/pdf/merge" component={MergePdf} />
      <Route path="/pdf/jpg-to-pdf" component={JpgToPdf} />
      <Route path="/pdf/pdf-to-jpg" component={PdfToJpg} />
      <Route path="/pdf/split" component={Split} />
      <Route path="/pdf/compress" component={Compress} />

      {/* Protected routes */}
      <Route path="/income">
        <RequireAuth returnTo="/income">
          <IncomeCalculator />
        </RequireAuth>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LanguageProvider>
          <AuthProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <TopBar />
              <Router />
            </WouterRouter>
            <Toaster />
          </AuthProvider>
        </LanguageProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
