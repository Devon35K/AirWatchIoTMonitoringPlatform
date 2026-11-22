import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { requireSupabase, supabase, supabaseConfigured } from "../services/supabase";

interface CloudAccount {
  configured: boolean;
  loading: boolean;
  user: User | null;
  initializationError: string;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<boolean>;
  signOut(): Promise<void>;
}

const CloudAccountContext = createContext<CloudAccount | null>(null);

export function CloudAccountProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(supabaseConfigured);
  const [initializationError, setInitializationError] = useState("");

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      setLoading(false);
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setInitializationError(error.message);
      setUser(data.session?.user ?? null);
      setLoading(false);
    }).catch((error: unknown) => {
      if (!active) return;
      setInitializationError(error instanceof Error ? error.message : "Could not load cloud session");
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await requireSupabase().auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await requireSupabase().auth.signUp({ email, password });
    if (error) throw error;
    return !data.session;
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await requireSupabase().auth.signOut();
    if (error) throw error;
  }, []);

  return (
    <CloudAccountContext.Provider
      value={{ configured: supabaseConfigured, loading, user, initializationError, signIn, signUp, signOut }}
    >
      {children}
    </CloudAccountContext.Provider>
  );
}

export function useCloudAccount() {
  const value = useContext(CloudAccountContext);
  if (!value) throw new Error("useCloudAccount must be used inside CloudAccountProvider");
  return value;
}
