import { Switch, Route, Router as WouterRouter, Link, useLocation } from "wouter";
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
import About from "@/pages/about";
import Scanner from "@/pages/scanner";
import BgRemover from "@/pages/bg-remover";
import PdfSign from "@/pages/pdf-sign";

const queryClient = new QueryClient();

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const [location] = useLocation();
  const active = location === href;
  return (
    <Link href={href}>
      <span
        className={`text-sm font-medium transition-colors hover:text-indigo-600 ${
          active ? "text-indigo-600" : "text-muted-foreground"
        }`}
      >
        {children}
      </span>
    </Link>
  );
}

function Navbar() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 h-14 bg-white/90 backdrop-blur border-b border-border">
      <Link href="/">
        <img
          src={`${base}/logo.png`}
          alt="Toolcraft"
          width={100}
          className="h-auto cursor-pointer"
        />
      </Link>
      <div className="flex items-center gap-5">
        <NavLink href="/about">About</NavLink>
        <LanguageToggle />
      </div>
    </nav>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/about" component={About} />
      <Route path="/scanner" component={Scanner} />
      <Route path="/pdf" component={Dashboard} />
      <Route path="/pdf/merge" component={MergePdf} />
      <Route path="/pdf/jpg-to-pdf" component={JpgToPdf} />
      <Route path="/pdf/pdf-to-jpg" component={PdfToJpg} />
      <Route path="/pdf/split" component={Split} />
      <Route path="/pdf/compress" component={Compress} />
      <Route path="/bg-remover" component={BgRemover} />
      <Route path="/pdf/sign" component={PdfSign} />
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
