import { Switch, Route, Router as WouterRouter, Link } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/lib/i18n";
import { LanguageToggle } from "@/components/LanguageToggle";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import MergePdf from "@/pages/home";
import JpgToPdf from "@/pages/jpg-to-pdf";
import PdfToJpg from "@/pages/pdf-to-jpg";
import Split from "@/pages/split";
import Compress from "@/pages/compress";

const queryClient = new QueryClient();

function Navbar() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-14 bg-white/90 backdrop-blur border-b border-border">
      <Link href="/">
        <img
          src={`${base}/logo.png`}
          alt="Toolcraft"
          width={100}
          className="h-auto cursor-pointer"
        />
      </Link>
      <LanguageToggle />
    </nav>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/pdf" component={Dashboard} />
      <Route path="/pdf/merge" component={MergePdf} />
      <Route path="/pdf/jpg-to-pdf" component={JpgToPdf} />
      <Route path="/pdf/pdf-to-jpg" component={PdfToJpg} />
      <Route path="/pdf/split" component={Split} />
      <Route path="/pdf/compress" component={Compress} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LanguageProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Navbar />
            <div className="pt-14">
              <Router />
            </div>
          </WouterRouter>
          <Toaster />
        </LanguageProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
