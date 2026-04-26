"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AUTH_BYPASS_ENABLED } from "@/lib/config";
import { useAuthStore } from "@/store/auth-store";

export function useAuthGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const token = useAuthStore((state) => state.token);
  const hydrated = useAuthStore((state) => state.hydrated);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (!token && !AUTH_BYPASS_ENABLED && pathname !== "/login") {
      router.replace("/login");
    }
  }, [hydrated, pathname, router, token]);

  return {
    authenticated: AUTH_BYPASS_ENABLED || Boolean(token),
    ready: AUTH_BYPASS_ENABLED || hydrated,
  };
}
