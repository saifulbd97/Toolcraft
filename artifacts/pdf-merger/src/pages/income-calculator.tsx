import { Link } from "wouter";
import { ArrowLeft, Construction } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/UserMenu";

export default function IncomeCalculator() {
  return (
    <div className="min-h-[100dvh] w-full bg-background flex flex-col items-center justify-center px-4 py-16">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-emerald-50 mx-auto">
          <Construction className="w-10 h-10 text-emerald-500" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Income Calculator</h1>
          <p className="text-muted-foreground">
            Calculate taxes, salary breakdowns, and financial projections.
          </p>
        </div>
        <div className="inline-block bg-emerald-500/10 text-emerald-700 text-sm font-medium px-4 py-2 rounded-full">
          Coming soon
        </div>
        <div className="pt-2">
          <Link href="/">
            <Button variant="outline" className="gap-2" data-testid="button-back-home">
              <ArrowLeft className="w-4 h-4" />
              Back to all tools
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
