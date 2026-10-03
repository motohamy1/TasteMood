/**
 * Single in-memory owner of the on-device guest taste profile. Both the
 * Personality tab and the Profile editor read and write through this store, so
 * an edit made in the editor reaches the recommendation session without a
 * remount. Every write persists to protected storage immediately.
 */
import { create } from "zustand";

import {
  emptyGuestPersonalityProfile,
  readGuestPersonalityProfile,
  writeGuestPersonalityProfile,
  type GuestPersonalityProfile,
} from "@/lib/personality-profile";

interface GuestProfileState {
  profile: GuestPersonalityProfile | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  persist: (profile: GuestPersonalityProfile) => Promise<void>;
  reset: () => Promise<void>;
}

export const useGuestProfileStore = create<GuestProfileState>((set) => ({
  profile: null,
  hydrated: false,

  hydrate: async () => {
    const profile = await readGuestPersonalityProfile();
    set({ profile, hydrated: true });
  },

  persist: async (profile) => {
    set({ profile });
    await writeGuestPersonalityProfile(profile);
  },

  reset: async () => {
    const profile = emptyGuestPersonalityProfile();
    set({ profile });
    await writeGuestPersonalityProfile(profile);
  },
}));
