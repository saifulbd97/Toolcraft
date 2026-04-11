import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";

interface RequireAuthProps {
  children: React.ReactNode;
  returnTo?: string;
}

export function RequireAuth({ children, returnTo }: RequireAuthProps) {
  const { user, loading } = useAuth();
  const [location, navigate] = useLocation();

  const destination = returnTo ?? location;

  useEffect(() => {
    if (!loading && !user) {
      const encodedReturn = encodeURIComponent(destination);
      navigate(`/login?returnTo=${encodedReturn}`);
    }
  }, [user, loading, navigate, destination]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
