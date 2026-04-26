"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AuthResponse, User } from "@/types/domain";

type AuthState = {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  deviceName: string;
  hydrated: boolean;
  setHydrated: () => void;
  setDeviceName: (deviceName: string) => void;
  setSession: (session: AuthResponse, deviceName: string) => void;
  clearSession: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      user: null,
      deviceName: "",
      hydrated: false,
      setHydrated: () => set({ hydrated: true }),
      setDeviceName: (deviceName) => set({ deviceName }),
      setSession: (session, deviceName) =>
        set({
          token: session.token,
          refreshToken: session.refreshToken,
          user: session.user,
          deviceName,
        }),
      clearSession: () =>
        set({
          token: null,
          refreshToken: null,
          user: null,
          deviceName: "",
        }),
    }),
    {
      name: "techflowpm-auth",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);
