import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import MergePdf from "@/pages/home";
import JpgToPdf from "@/pages/jpg-to-pdf";
import PdfToJpg from "@/pages/pdf-to-jpg";
import Split from "@/pages/split";
import Compress from "@/pages/compress";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/merge" component={MergePdf} />
      <Route path="/jpg-to-pdf" component={JpgToPdf} />
      <Route path="/pdf-to-jpg" component={PdfToJpg} />
      <Route path="/split" component={Split} />
      <Route path="/compress" component={Compress} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
