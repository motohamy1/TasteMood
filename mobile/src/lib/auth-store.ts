/**
 * Auth store — keeps the current token and user in memory, persists the
 * token to expo-secure-store. We also wire the token into the API client
 * via setAuthToken() so the rest of the app doesn't have to think about it.
 *
 * NOTE: This is intentionally minimal — it does NOT implement Supabase Auth
 * flows. It just stores whatever token the caller hands in. The original
 * TasteMood backend accepts two token shapes:
 *   1. A Supabase JWT (HS256 with SUPABASE_JWT_SECRET)
 *   2. A `mock-...` token (dev/test only)
 *
 * When a real Supabase integration is added, swap `signIn` for a
 * supabase.auth.signInWithPassword() call and pass the resulting JWT.
 */

import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

import { setAuthToken, getMe, AuthError } from "./api";
import type { UserProfile } from "@/types/user";

const TOKEN_KEY = "tastemood.auth.token";

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  status: "idle" | "loading" | "signed-in" | "signed-out" | "error";
  error?: string;

  hydrate: () => Promise<void>;
  signInWithToken: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

async function readTokenFromSecureStore(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch (err) {
    // SecureStore may be unavailable on the web (uses localStorage fallback).
    // That's fine — we'll just stay signed out.
    if (__DEV__) console.warn("[auth] failed to read token from secure store", err);
    return null;
  }
}

async function writeTokenToSecureStore(token: string | null): Promise<void> {
  try {
    if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch (err) {
    if (__DEV__) console.warn("[auth] failed to write token to secure store", err);
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  status: "idle",

  hydrate: async () => {
    set({ status: "loading" });
    const token = await readTokenFromSecureStore();
    if (!token) {
      set({ status: "signed-out" });
      return;
    }
    setAuthToken(token);
    set({ token, status: "signed-in" });
    try {
      const user = await getMe();
      set({ user, status: "signed-in" });
    } catch (err) {
      if (err instanceof AuthError) {
        // Stored token is dead/expired — clear it so we don't stay stuck
        // "signed in" while every authed call 401s (WR-06).
        if (__DEV__) console.warn("[auth] token rejected on hydrate, signing out", err);
        setAuthToken(null);
        await writeTokenToSecureStore(null);
        set({ token: null, user: null, status: "signed-out" });
        return;
      }
      if (__DEV__) console.warn("[auth] getMe failed during hydrate", err);
      // Network/other failure: keep the token but drop the user — the
      // UI can prompt to retry.
      set({ user: null });
    }
  },

  signInWithToken: async (token) => {
    set({ status: "loading", error: undefined });
    setAuthToken(token);
    await writeTokenToSecureStore(token);
    set({ token, status: "signed-in" });
    try {
      const user = await getMe();
      set({ user });
    } catch (err) {
      if (err instanceof AuthError) {
        // The pasted token was rejected — don't persist it.
        setAuthToken(null);
        await writeTokenToSecureStore(null);
        set({ token: null, user: null, status: "error", error: "Invalid token" });
      } else {
        set({
          status: "error",
          error: err instanceof Error ? err.message : "Sign in failed",
        });
      }
      throw err;
    }
  },

  signOut: async () => {
    setAuthToken(null);
    await writeTokenToSecureStore(null);
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

// Selector helpers to keep components from re-rendering on irrelevant changes.
export const selectIsSignedIn = (s: AuthState) => s.status === "signed-in" && !!s.token;
export const selectUser = (s: AuthState) => s.user;
