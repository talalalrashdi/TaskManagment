"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Gauge,
  KeyRound,
  LayoutPanelLeft,
  ShieldCheck,
  TimerReset,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AUTH_BYPASS_ENABLED, BYPASS_USER } from "@/lib/config";
import { useUiStore } from "@/store/ui-store";
import { useAuthStore } from "@/store/auth-store";

const links = [
  { href: "/dashboard", label: "الرئيسية", icon: Gauge },
  { href: "/timeline", label: "الجدول الزمني", icon: TimerReset },
  { href: "/users", label: "المستخدمون والصلاحيات", icon: UsersRound },
  { href: "/licenses", label: "التراخيص", icon: KeyRound },
  { href: "/notifications", label: "الإشعارات", icon: Bell },
  { href: "/settings/devices", label: "الأجهزة", icon: ShieldCheck },
];

export function Sidebar() {
  const pathname = usePathname();
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const storedUser = useAuthStore((state) => state.user);
  const user = storedUser ?? (AUTH_BYPASS_ENABLED ? BYPASS_USER : null);

  return (
    <aside
      className={cn(
        "fixed inset-y-0 right-0 z-40 hidden border-l border-[var(--border)] bg-[rgba(15,23,42,0.78)] px-4 py-5 text-slate-100 shadow-[var(--shadow-soft)] backdrop-blur-2xl md:flex md:flex-col",
        collapsed ? "w-24" : "w-72",
      )}
    >
      <div className="mb-8 flex items-center gap-3">
        <div className="grid h-14 w-14 place-items-center rounded-3xl bg-[linear-gradient(135deg,#6366F1,#0EA5E9)] text-xl font-black text-white shadow-[0_20px_50px_-24px_rgba(14,165,233,0.8)]">
          TF
        </div>
        {!collapsed ? (
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-slate-400">
              TechFlow PM
            </p>
            <p className="mt-1 text-sm text-slate-300">Project Operations Suite</p>
          </div>
        ) : null}
      </div>

      <div className="glass-panel mb-8 rounded-[26px] border-white/10 bg-white/8 p-4 text-right">
        <p className="text-xs text-slate-400">المستخدم الحالي</p>
        <p className="mt-2 text-sm font-semibold text-white">{user?.name ?? "غير معروف"}</p>
        {!collapsed ? (
          <p className="mt-1 text-xs text-slate-400">{user?.role ?? "Guest"}</p>
        ) : null}
      </div>

      <nav className="flex flex-1 flex-col gap-2">
        {links.map((link) => {
          const Icon = link.icon;
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition",
                active
                  ? "bg-[linear-gradient(135deg,rgba(99,102,241,0.28),rgba(14,165,233,0.18))] text-white ring-1 ring-white/10"
                  : "text-slate-300 hover:bg-white/6 hover:text-white",
                collapsed && "justify-center px-0",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed ? <span>{link.label}</span> : null}
            </Link>
          );
        })}
      </nav>

      <div className="rounded-3xl border border-white/10 bg-white/6 p-4 text-right">
        {!collapsed ? (
          <>
            <p className="text-xs text-slate-400">Realtime</p>
            <p className="mt-2 text-sm font-medium text-white">
              SignalR channel جاهز لتحديثات المشروع
            </p>
          </>
        ) : (
          <LayoutPanelLeft className="mx-auto h-5 w-5 text-slate-200" />
        )}
      </div>
    </aside>
  );
}
