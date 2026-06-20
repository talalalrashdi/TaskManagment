"use client";

import { usePathname } from "next/navigation";
import { AUTH_BYPASS_ENABLED } from "@/lib/config";
import { useAuthStore } from "@/store/auth-store";
import { AppShell } from "@/components/layout/app-shell";

export function RootFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hydrated = useAuthStore((state) => state.hydrated);

  if (!AUTH_BYPASS_ENABLED && !hydrated && pathname !== "/login") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="glass-panel rounded-[28px] px-6 py-5 text-sm text-slate-500 dark:text-slate-300">
          يتم تجهيز مساحة العمل...
        </div>
      </div>
    );
  }

  if (pathname === "/login") {
    return children;
  }

  return <AppShell>{children}</AppShell>;
}
