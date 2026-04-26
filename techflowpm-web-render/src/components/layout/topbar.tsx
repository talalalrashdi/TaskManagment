"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, LogOut, Menu, Search } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { AUTH_BYPASS_ENABLED, BYPASS_USER } from "@/lib/config";
import { cn } from "@/lib/utils";
import { Button, Input } from "@/components/ui/primitives";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useAuthStore } from "@/store/auth-store";
import { useUiStore } from "@/store/ui-store";

const routeTitles: Record<string, string> = {
  "/dashboard": "لوحة التحكم",
  "/timeline": "الجدول الزمني السنوي",
  "/users": "المستخدمون والصلاحيات",
  "/licenses": "التراخيص والمفاتيح",
  "/notifications": "مركز الإشعارات",
  "/settings/devices": "إدارة الأجهزة المسجلة",
};

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const storedUser = useAuthStore((state) => state.user);
  const user = storedUser ?? (AUTH_BYPASS_ENABLED ? BYPASS_USER : null);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const clearSession = useAuthStore((state) => state.clearSession);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  const title = useMemo(() => {
    return (
      Object.entries(routeTitles).find(([route]) => pathname === route || pathname.startsWith(`${route}/`))?.[1] ??
      "TechFlow PM"
    );
  }, [pathname]);

  const handleLogout = async () => {
    if (AUTH_BYPASS_ENABLED) {
      router.replace("/dashboard");
      return;
    }

    try {
      if (refreshToken) {
        await apiClient.post("/auth/logout", { refreshToken });
      }
    } catch {
    } finally {
      clearSession();
      router.replace("/login");
    }
  };

  return (
    <header className="sticky top-0 z-30 px-4 pb-4 pt-4 sm:px-6 lg:px-8">
      <div className="glass-panel flex flex-col gap-4 rounded-[28px] px-4 py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={toggleSidebar} className="rounded-2xl">
            <Menu className="h-4 w-4" />
          </Button>
          <div>
            <p className="text-xs uppercase tracking-[0.26em] text-slate-500 dark:text-slate-400">
              Workspace
            </p>
            <h1 className="mt-1 text-xl font-semibold text-[var(--foreground)]">{title}</h1>
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative min-w-[220px]">
            <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input className="pr-11" placeholder="ابحث عن مشروع أو مهمة..." />
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="secondary" size="sm" className={cn("rounded-2xl px-3")}>
              <Bell className="h-4 w-4" />
            </Button>
            <div className="hidden rounded-2xl bg-[var(--surface-muted)] px-4 py-2 text-right md:block">
              <p className="text-sm font-semibold text-[var(--foreground)]">{user?.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{user?.role}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="rounded-2xl">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
