"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { useUiStore } from "@/store/ui-store";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { ready, authenticated } = useAuthGuard();
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const pathname = usePathname();

  if (!ready || !authenticated) {
    return null;
  }

  const isImmersiveRoute =
    pathname === "/dashboard" || pathname === "/timeline" || pathname === "/director" || /^\/projects\/\d+$/.test(pathname);

  if (isImmersiveRoute) {
    return (
      <motion.main
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="min-h-screen"
      >
        {children}
      </motion.main>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <motion.main
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className={`flex min-h-screen flex-1 flex-col transition-all duration-300 ${collapsed ? "md:pr-28" : "md:pr-76"}`}
      >
        <Topbar />
        <div className="flex-1 px-4 pb-6 pt-2 sm:px-6 lg:px-8">{children}</div>
      </motion.main>
    </div>
  );
}
