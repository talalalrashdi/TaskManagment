"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Gauge,
  KeyRound,
  ShieldCheck,
  TimerReset,
  UserCog,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/ui-store";

const links = [
  { href: "/dashboard", label: "الرئيسية", icon: Gauge },
  { href: "/timeline", label: "الجدول الزمني", icon: TimerReset },
  { href: "/admin", label: "الإدارة", icon: UserCog },
  { href: "/users", label: "المستخدمون والصلاحيات", icon: UsersRound },
  { href: "/licenses", label: "التراخيص", icon: KeyRound },
  { href: "/notifications", label: "الإشعارات", icon: Bell },
  { href: "/settings/devices", label: "الأجهزة", icon: ShieldCheck },
];

export function Sidebar() {
  const pathname = usePathname();
  const collapsed = useUiStore((state) => state.sidebarCollapsed);

  return (
    <aside
      className={cn(
        "fixed bottom-3 right-3 top-3 z-40 hidden overflow-hidden rounded-[34px] border border-white/10 bg-[#050505] px-3 py-4 text-slate-100 shadow-[0_34px_90px_-42px_rgba(0,0,0,0.92)] md:flex md:flex-col",
        collapsed ? "w-24" : "w-72",
      )}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,rgba(45,226,199,0.16),transparent_58%)]" />
        <div className="absolute -left-12 bottom-16 h-40 w-40 rounded-full bg-[#0f172a]/40 blur-3xl" />
        <div className="absolute inset-x-6 top-24 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.14),transparent)]" />
      </div>

      <div className="relative flex flex-1 flex-col">
        <div className={cn("mb-5", collapsed && "flex justify-center")}>
          <div
            className={cn(
              "rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
              collapsed ? "grid h-14 w-14 place-items-center" : "px-4 py-4 text-right",
            )}
          >
            {collapsed ? (
              <span className="h-2.5 w-2.5 rounded-full bg-[#2de2c7] shadow-[0_0_20px_rgba(45,226,199,0.9)]" />
            ) : (
              <>
                <p className="text-[11px] font-semibold text-white/30">القائمة</p>
                <p className="mt-2 text-[18px] font-semibold tracking-[-0.04em] text-white">التنقل السريع</p>
                <p className="mt-1 text-[12px] leading-6 text-white/45">الوصول المباشر إلى وحدات النظام</p>
              </>
            )}
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-2.5">
        {links.map((link) => {
          const Icon = link.icon;
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "group relative overflow-hidden rounded-[24px] border text-sm transition-all duration-300",
                active
                  ? "border-[#2de2c7]/30 bg-[linear-gradient(135deg,rgba(18,18,18,0.96),rgba(9,24,22,0.94))] text-white shadow-[0_24px_42px_-32px_rgba(45,226,199,0.4)]"
                  : "border-transparent text-white/72 hover:border-white/10 hover:bg-white/[0.04] hover:text-white",
                collapsed ? "flex justify-center px-0 py-3" : "flex items-center gap-3.5 px-3 py-3.5",
              )}
            >
              {active ? (
                <span className="absolute inset-y-3 right-0 w-1 rounded-full bg-[linear-gradient(180deg,#2de2c7,#3b82f6)]" />
              ) : null}
              <span
                className={cn(
                  "grid h-10 w-10 shrink-0 place-items-center rounded-2xl border transition-all duration-300",
                  active
                    ? "border-[#2de2c7]/25 bg-[#071210] text-[#95ffea] shadow-[0_16px_30px_-20px_rgba(45,226,199,0.75)]"
                    : "border-white/10 bg-white/[0.05] text-white/70 group-hover:border-white/15 group-hover:text-white",
                )}
              >
                <Icon className="h-4.5 w-4.5 shrink-0" />
              </span>
              {!collapsed ? <span className="font-semibold">{link.label}</span> : null}
            </Link>
          );
        })}
        </nav>

      </div>
    </aside>
  );
}
