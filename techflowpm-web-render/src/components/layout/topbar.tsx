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
  "/admin": "إدارة النظام",
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
  const isManagementDarkRoute =
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/users" ||
    pathname.startsWith("/users/");

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
      <div
        className={cn(
          "flex flex-col gap-4 rounded-[28px] px-4 py-4 md:flex-row md:items-center md:justify-between",
          isManagementDarkRoute
            ? "border border-[#141414] bg-black text-white shadow-[0_30px_90px_-48px_rgba(0,0,0,0.98)]"
            : "glass-panel",
        )}
      >
        <div className="flex items-center gap-3">
          <Button
            variant={isManagementDarkRoute ? "ghost" : "secondary"}
            size="sm"
            onClick={toggleSidebar}
            className={cn(
              "rounded-2xl",
              isManagementDarkRoute && "border border-[#141414] bg-[#0a0a0a] px-3 text-white hover:bg-[#111111] hover:text-white",
            )}
          >
            <Menu className="h-4 w-4" />
          </Button>
          <div>
            <h1 className={cn("mt-1 text-xl font-semibold text-[var(--foreground)]", isManagementDarkRoute && "text-white")}>{title}</h1>
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          {!isManagementDarkRoute ? (
            <div className="relative min-w-[220px]">
              <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input className="pr-11" placeholder="ابحث عن مشروع أو مهمة..." />
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <ThemeToggle className={isManagementDarkRoute ? "border border-[#141414] bg-[#0a0a0a] text-white hover:bg-[#111111] hover:text-white" : undefined} />
            <Button
              variant={isManagementDarkRoute ? "ghost" : "secondary"}
              size="sm"
              className={cn("rounded-2xl px-3", isManagementDarkRoute && "border border-[#141414] bg-[#0a0a0a] text-white hover:bg-[#111111] hover:text-white")}
            >
              <Bell className="h-4 w-4" />
            </Button>
            <div className={cn("hidden rounded-2xl bg-[var(--surface-muted)] px-4 py-2 text-right md:block", isManagementDarkRoute && "border border-[#141414] bg-[#0a0a0a]")}>
              <p className={cn("text-sm font-semibold text-[var(--foreground)]", isManagementDarkRoute && "text-white")}>{user?.name}</p>
              <p className={cn("text-xs text-slate-500 dark:text-slate-400", isManagementDarkRoute && "text-white/35")}>{user?.role}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className={cn("rounded-2xl", isManagementDarkRoute && "text-white/70 hover:bg-[#111111] hover:text-white")}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
