"use client";

import { useEffect, useState, useCallback } from "react";
import { type User, type Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

const HAS_SUPABASE =
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== "your-anon-key";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!HAS_SUPABASE) {
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    if (!HAS_SUPABASE) return;
    const supabase = createClient();
    await supabase.auth.signOut();
  }, []);

  const getToken = useCallback(async (): Promise<string | null> => {
    if (!HAS_SUPABASE) return null;
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  return { user, session, loading, signOut, getToken };
}
