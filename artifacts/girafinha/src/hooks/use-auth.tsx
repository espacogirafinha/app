import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { supabase } from "@/lib/supabase";

type AuthState = {
  status: "loading" | "authenticated" | "unauthenticated";
  email: string | null;
  login: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState["status"]>("loading");
  const [email, setEmail] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    setAuthTokenGetter(async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? null;
    });

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setEmail(data.session?.user.email ?? null);
      setStatus(data.session ? "authenticated" : "unauthenticated");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
      setStatus(session ? "authenticated" : "unauthenticated");
      queryClient.clear();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      setAuthTokenGetter(null);
    };
  }, [queryClient]);

  const login: AuthState["login"] = async (emailInput, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailInput.trim(),
      password,
    });

    if (error || !data.session) {
      return { ok: false, error: "Credenciais invalidas" };
    }

    setEmail(data.user.email ?? null);
    setStatus("authenticated");
    queryClient.invalidateQueries();
    return { ok: true };
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      setEmail(null);
      setStatus("unauthenticated");
      queryClient.clear();
    }
  };

  return (
    <AuthContext.Provider value={{ status, email, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
