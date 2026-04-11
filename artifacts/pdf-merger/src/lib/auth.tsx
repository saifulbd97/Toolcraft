import React, { createContext, useContext, useEffect, useState } from "react";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  photo: string;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  refetch: () => void;
}

const AuthContext = createContext<AuthState>({ user: null, loading: true, refetch: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = () => {
    setLoading(true);
    fetch(`${import.meta.env.BASE_URL}api/auth/me`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setUser(data.user ?? null);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchMe(); }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refetch: fetchMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
