/**
 * Auth store — keeps the current access token and user in memory and mirrors
 * the token into the API client via setAuthToken(). Supabase owns the durable
 * session (persisted to AsyncStorage and auto-refreshed); this store reads
 * that session on startup and keeps its in-memory token in sync through
 * onAuthStateChange.
 */

import { create } from "zustand";

import { supabase } from "./supabase";
import { setAuthToken, getMe, AuthError } from "./api";
import type { UserProfile } from "@/types/user";

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  status: "idle" | "loading" | "signed-in" | "signed-out" | "error";
  error?: string;

  hydrate: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string
  ) => Promise<{ needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  status: "idle",

  hydrate: async () => {
    set({ status: "loading" });
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) {
      set({ token: null, user: null, status: "signed-out" });
      return;
    }

    setAuthToken(session.access_token);
    set({ token: session.access_token, status: "signed-in" });
    try {
      const user = await getMe();
      set({ user });
    } catch (err) {
      if (err instanceof AuthError) {
        // Backend rejected the token — clear the Supabase session so we don't
        // stay stuck "signed in" while every authed call 401s (WR-06).
        if (__DEV__) console.warn("[auth] token rejected on hydrate, signing out", err);
        await supabase.auth.signOut();
        setAuthToken(null);
        set({ token: null, user: null, status: "signed-out" });
        return;
      }
      if (__DEV__) console.warn("[auth] getMe failed during hydrate", err);
      set({ user: null });
    }
  },

  signInWithEmail: async (email, password) => {
    set({ status: "loading", error: undefined });
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      set({ status: "error", error: error.message });
      throw error;
    }

    const token = data.session?.access_token ?? null;
    setAuthToken(token);
    set({ token, status: "signed-in" });

    try {
      const user = await getMe();
      set({ user });
    } catch (err) {
      // Supabase signed us in but the backend profile fetch failed. Keep the
      // token so the UI can retry, but surface the error to the caller.
      if (__DEV__) console.warn("[auth] getMe failed after sign in", err);
      throw err;
    }
  },

  signUp: async (email, password) => {
    set({ status: "loading", error: undefined });
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      set({ status: "error", error: error.message });
      throw error;
    }

    // With email confirmation on, Supabase returns no session and the user
    // must verify before signing in. With it off, a session is created now.
    const needsEmailConfirmation = !data.session;
    if (data.session) {
      const token = data.session.access_token;
      setAuthToken(token);
      set({ token, status: "signed-in" });
      try {
        const user = await getMe();
        set({ user });
      } catch (err) {
        if (__DEV__) console.warn("[auth] getMe failed after sign up", err);
      }
    } else {
      set({ status: "signed-out" });
    }

    return { needsEmailConfirmation };
  },

  signOut: async () => {
    await supabase.auth.signOut();
    setAuthToken(null);
    set({ token: null, user: null, status: "signed-out" });
  },

  refreshUser: async () => {
    if (!get().token) return;
    try {
      const user = await getMe();
      set({ user });
    } catch (err) {
      if (__DEV__) console.warn("[auth] refreshUser failed", err);
    }
  },
}));

// Keep the in-memory token in sync with Supabase's session lifecycle — token
// refresh swaps the access token without a full sign-in, and signOut fires
// SIGNED_OUT from either this store or a future OAuth/redirect flow.
supabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT") {
    setAuthToken(null);
    useAuthStore.setState({ token: null, user: null, status: "signed-out" });
  } else if (
    session &&
    (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")
  ) {
    setAuthToken(session.access_token);
    useAuthStore.setState({ token: session.access_token, status: "signed-in" });
  }
});

// Selector helpers to keep components from re-rendering on irrelevant changes.
export const selectIsSignedIn = (s: AuthState) =>
  s.status === "signed-in" && !!s.token;
export const selectUser = (s: AuthState) => s.user;
