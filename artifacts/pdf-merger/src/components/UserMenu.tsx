import { useState, useRef, useEffect } from "react";
import { LogOut, User } from "lucide-react";
import { useAuth } from "@/lib/auth";

export function UserMenu() {
  const { user, refetch } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!user) return null;

  const handleLogout = async () => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    await fetch(`${base}/api/auth/logout`, { method: "POST", credentials: "include" });
    refetch();
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-border bg-card px-2.5 py-1.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
        data-testid="btn-user-menu"
        aria-label="User menu"
      >
        {user.photo ? (
          <img src={user.photo} alt={user.name} className="w-6 h-6 rounded-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <User className="w-4 h-4" />
        )}
        <span className="hidden sm:inline max-w-[120px] truncate">{user.name}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-52 rounded-xl border border-border bg-card shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
            data-testid="btn-logout"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
