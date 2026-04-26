"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  Eye,
  Filter,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
  UsersRound,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Button, Card, Input, Select } from "@/components/ui/primitives";
import { cn, formatDate } from "@/lib/utils";
import type { PagedResult, User } from "@/types/domain";

type PermissionKey = "manageProjects" | "manageUsers" | "viewFinancials" | "executiveUpdates";

type UserPermissionConfig = {
  role?: User["role"];
  active?: boolean;
  permissions?: Partial<Record<PermissionKey, boolean>>;
};

type ResolvedUser = User & {
  effectiveRole: User["role"];
  active: boolean;
  permissions: Record<PermissionKey, boolean>;
};

const STORAGE_KEY = "techflowpm-user-permissions";

const roleOptions: { value: User["role"] | ""; label: string }[] = [
  { value: "", label: "كل الأدوار" },
  { value: "Admin", label: "مدير النظام" },
  { value: "Project Manager", label: "مدير مشروع" },
  { value: "Member", label: "عضو" },
  { value: "Viewer", label: "مشاهد" },
];

const permissionOptions: { key: PermissionKey; label: string; description: string }[] = [
  {
    key: "manageProjects",
    label: "إدارة المشاريع",
    description: "إنشاء وتعديل المشاريع والمهام وأعضاء الفريق.",
  },
  {
    key: "manageUsers",
    label: "إدارة المستخدمين",
    description: "تعديل الأدوار والصلاحيات وإدارة الأجهزة.",
  },
  {
    key: "viewFinancials",
    label: "عرض التكاليف",
    description: "الوصول إلى الميزانيات والتكلفة الفعلية والانحراف المالي.",
  },
  {
    key: "executiveUpdates",
    label: "الموقف التنفيذي",
    description: "إضافة وقراءة تحديثات الإدارة التنفيذية للمشاريع.",
  },
];

const defaultPermissions: Record<User["role"], Record<PermissionKey, boolean>> = {
  Admin: {
    manageProjects: true,
    manageUsers: true,
    viewFinancials: true,
    executiveUpdates: true,
  },
  "Project Manager": {
    manageProjects: true,
    manageUsers: false,
    viewFinancials: true,
    executiveUpdates: true,
  },
  Member: {
    manageProjects: false,
    manageUsers: false,
    viewFinancials: false,
    executiveUpdates: true,
  },
  Viewer: {
    manageProjects: false,
    manageUsers: false,
    viewFinancials: false,
    executiveUpdates: false,
  },
};

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<User["role"] | "">("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [configs, setConfigs] = useState<Record<number, UserPermissionConfig>>({});
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  const usersQuery = useQuery({
    queryKey: ["users", "permissions-page"],
    queryFn: () =>
      apiClient
        .get<PagedResult<User>>("/users", { page: 1, pageSize: 100 })
        .then((response) => response.data),
  });

  const users = useMemo(() => usersQuery.data?.items ?? [], [usersQuery.data?.items]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setConfigs(parseConfigs(stored));
      }
    } catch {
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!ready || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
  }, [configs, ready]);

  const resolvedUsers = useMemo<ResolvedUser[]>(
    () => users.map((user) => resolveUser(user, configs[user.id])),
    [configs, users],
  );

  useEffect(() => {
    if (selectedUserId || resolvedUsers.length === 0) {
      return;
    }

    setSelectedUserId(resolvedUsers[0].id);
  }, [resolvedUsers, selectedUserId]);

  const departments = useMemo(() => {
    const map = new Map<string, string>();
    resolvedUsers.forEach((user) => {
      const key = String(user.departmentId ?? user.departmentName ?? "غير محدد");
      map.set(key, user.departmentName ?? "غير محدد");
    });

    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [resolvedUsers]);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return resolvedUsers.filter((user) => {
      const matchesSearch =
        !normalizedSearch ||
        user.name.toLowerCase().includes(normalizedSearch) ||
        user.email.toLowerCase().includes(normalizedSearch) ||
        (user.departmentName ?? "").toLowerCase().includes(normalizedSearch);
      const matchesRole = !roleFilter || user.effectiveRole === roleFilter;
      const departmentKey = String(user.departmentId ?? user.departmentName ?? "غير محدد");
      const matchesDepartment = !departmentFilter || departmentKey === departmentFilter;

      return matchesSearch && matchesRole && matchesDepartment;
    });
  }, [departmentFilter, resolvedUsers, roleFilter, search]);

  const selectedUser = useMemo(
    () => resolvedUsers.find((user) => user.id === selectedUserId) ?? filteredUsers[0] ?? null,
    [filteredUsers, resolvedUsers, selectedUserId],
  );

  const stats = useMemo(
    () => ({
      total: resolvedUsers.length,
      active: resolvedUsers.filter((user) => user.active).length,
      admins: resolvedUsers.filter((user) => user.effectiveRole === "Admin").length,
      managers: resolvedUsers.filter((user) => user.effectiveRole === "Project Manager").length,
    }),
    [resolvedUsers],
  );

  const updateUserConfig = (userId: number, updater: (current: UserPermissionConfig) => UserPermissionConfig) => {
    setConfigs((current) => ({
      ...current,
      [userId]: updater(current[userId] ?? {}),
    }));
  };

  const resetUserConfig = (userId: number) => {
    setConfigs((current) => {
      const next = { ...current };
      delete next[userId];
      return next;
    });
  };

  return (
    <div className="space-y-6" dir="rtl">
      <section className="overflow-hidden rounded-[34px] bg-[linear-gradient(135deg,#eef7f8,#f8fcfc)] shadow-[0_28px_80px_-44px_rgba(10,76,74,0.28)]">
        <div className="grid gap-6 px-6 py-7 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-[#0d7573] shadow-[0_20px_38px_-30px_rgba(13,117,115,0.4)]">
              <ShieldCheck className="h-4 w-4" />
              إدارة الوصول الداخلي
            </div>
            <h1 className="mt-5 text-[36px] font-semibold tracking-[-0.05em] text-[#12262b] lg:text-[44px]">
              المستخدمون والصلاحيات
            </h1>
            <p className="mt-3 max-w-2xl text-[15px] leading-8 text-[#6c7c82]">
              راقب الموظفين، عدل الأدوار التشغيلية، واضبط صلاحيات كل مستخدم بما يناسب مسؤولياته داخل مشاريع TechFlow.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <UserStatCard label="إجمالي المستخدمين" value={stats.total} icon={UsersRound} accent="#0d7573" />
            <UserStatCard label="المستخدمون النشطون" value={stats.active} icon={CheckCircle2} accent="#f0b819" />
            <UserStatCard label="مديرو النظام" value={stats.admins} icon={ShieldCheck} accent="#ff8a69" />
            <UserStatCard label="مديرو المشاريع" value={stats.managers} icon={UserCog} accent="#64748b" />
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <Card className="border border-white/70 bg-white/88 shadow-[0_26px_56px_-42px_rgba(10,76,74,0.22)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-[24px] font-semibold text-[#15242a]">قائمة الموظفين</h2>
              <p className="mt-1 text-[13px] text-[#7f8d92]">اختر مستخدماً لتعديل دوره وصلاحياته.</p>
            </div>
            <span className="rounded-full bg-[#edf8f8] px-3 py-1 text-[12px] font-semibold text-[#0d7573]">
              {filteredUsers.length} نتيجة
            </span>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_180px_180px]">
            <div className="relative">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ابحث بالاسم أو البريد أو القسم..."
                className="h-11 border-[#e2ebec] bg-[#fbfdfd] pr-11"
              />
              <Filter className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#93a0a5]" />
            </div>

            <Select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as User["role"] | "")}
              className="h-11 border-[#e2ebec] bg-[#fbfdfd]"
            >
              {roleOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>

            <Select
              value={departmentFilter}
              onChange={(event) => setDepartmentFilter(event.target.value)}
              className="h-11 border-[#e2ebec] bg-[#fbfdfd]"
            >
              <option value="">كل الأقسام</option>
              {departments.map((department) => (
                <option key={department.value} value={department.value}>
                  {department.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="mt-5 space-y-3">
            {usersQuery.isLoading ? (
              <div className="rounded-[24px] border border-dashed border-[#dbe7e8] bg-[#fbfdfd] px-4 py-10 text-center text-[13px] text-[#7d8b91]">
                جارٍ تحميل المستخدمين...
              </div>
            ) : filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => setSelectedUserId(user.id)}
                  className={cn(
                    "w-full rounded-[26px] border px-4 py-4 text-right transition",
                    selectedUser?.id === user.id
                      ? "border-[#0d7573] bg-[#edf8f8] shadow-[0_22px_44px_-36px_rgba(13,117,115,0.55)]"
                      : "border-[#edf2f3] bg-[#fbfdfd] hover:border-[#cfe2e3]",
                  )}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar name={user.name} avatar={user.avatar} />
                      <div className="min-w-0">
                        <p className="truncate text-[16px] font-semibold text-[#172228]">{user.name}</p>
                        <p className="mt-1 truncate text-[12px] text-[#7f8d92]">{user.email}</p>
                      </div>
                    </div>
                    <RoleBadge role={user.effectiveRole} />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[12px] text-[#6d7b80]">
                    <span>{user.departmentName ?? "قسم غير محدد"}</span>
                    <span>{user.active ? "نشط" : "موقوف"} • انضم {formatDate(user.createdAt)}</span>
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-[#dbe7e8] bg-[#fbfdfd] px-4 py-10 text-center text-[13px] text-[#7d8b91]">
                لا توجد نتائج مطابقة للفلاتر الحالية.
              </div>
            )}
          </div>
        </Card>

        <Card className="border border-white/70 bg-white/88 shadow-[0_26px_56px_-42px_rgba(10,76,74,0.22)]">
          {selectedUser ? (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <UserAvatar name={selectedUser.name} avatar={selectedUser.avatar} size="lg" />
                  <div>
                    <h2 className="text-[24px] font-semibold tracking-[-0.04em] text-[#15242a]">
                      {selectedUser.name}
                    </h2>
                    <p className="mt-1 text-[13px] text-[#7f8d92]">{selectedUser.email}</p>
                  </div>
                </div>
                <RoleBadge role={selectedUser.effectiveRole} />
              </div>

              <div className="rounded-[26px] bg-[#f7fbfb] p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[13px] font-semibold text-[#66787d]">حالة الحساب</p>
                    <p className="mt-1 text-[14px] text-[#8a969a]">
                      {selectedUser.active ? "يمكنه الدخول واستخدام النظام" : "الحساب موقوف حالياً"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updateUserConfig(selectedUser.id, (current) => ({
                        ...current,
                        active: !(current.active ?? true),
                      }))
                    }
                    className={cn(
                      "rounded-full px-4 py-2 text-[12px] font-semibold transition",
                      selectedUser.active ? "bg-[#edf8f8] text-[#0d7573]" : "bg-[#fff0ec] text-[#ef7c61]",
                    )}
                  >
                    {selectedUser.active ? "نشط" : "موقوف"}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-[#66787d]">الدور التشغيلي</label>
                <Select
                  value={selectedUser.effectiveRole}
                  onChange={(event) =>
                    updateUserConfig(selectedUser.id, (current) => ({
                      ...current,
                      role: event.target.value as User["role"],
                    }))
                  }
                  className="border-[#e2ebec] bg-[#fbfdfd]"
                >
                  {roleOptions
                    .filter((option): option is { value: User["role"]; label: string } => Boolean(option.value))
                    .map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                </Select>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-[#0d7573]" />
                  <h3 className="text-[18px] font-semibold text-[#15242a]">الصلاحيات التفصيلية</h3>
                </div>
                <div className="mt-4 space-y-3">
                  {permissionOptions.map((permission) => {
                    const enabled = selectedUser.permissions[permission.key];

                    return (
                      <button
                        key={permission.key}
                        type="button"
                        onClick={() =>
                          updateUserConfig(selectedUser.id, (current) => ({
                            ...current,
                            permissions: {
                              ...(current.permissions ?? {}),
                              [permission.key]: !enabled,
                            },
                          }))
                        }
                        className={cn(
                          "w-full rounded-[22px] border px-4 py-4 text-right transition",
                          enabled ? "border-[#b9dcda] bg-[#edf8f8]" : "border-[#edf2f3] bg-[#fbfdfd]",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[15px] font-semibold text-[#172228]">{permission.label}</p>
                            <p className="mt-1 text-[12px] leading-6 text-[#7f8d92]">{permission.description}</p>
                          </div>
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold",
                              enabled ? "bg-[#0d7573] text-white" : "bg-[#eef2f3] text-[#738388]",
                            )}
                          >
                            {enabled ? "مفعل" : "مغلق"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap justify-between gap-3 border-t border-[#eef2f3] pt-5">
                <Button variant="secondary" onClick={() => resetUserConfig(selectedUser.id)}>
                  إعادة الضبط
                </Button>
                <div className="inline-flex items-center gap-2 rounded-full bg-[#f5f9f9] px-4 py-2 text-[12px] font-semibold text-[#66787d]">
                  <Eye className="h-4 w-4" />
                  التغييرات محفوظة على هذه الواجهة
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-[24px] border border-dashed border-[#dbe7e8] bg-[#fbfdfd] px-4 py-10 text-center text-[13px] text-[#7d8b91]">
              اختر مستخدماً من القائمة لإدارة صلاحياته.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function UserStatCard({
  label,
  value,
  accent,
  icon: Icon,
}: {
  label: string;
  value: number;
  accent: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-[24px] bg-white/88 px-4 py-4 shadow-[0_20px_40px_-34px_rgba(12,54,58,0.28)]">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-semibold text-[#7e8b90]">{label}</p>
        <div className="grid h-10 w-10 place-items-center rounded-full text-white" style={{ backgroundColor: accent }}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-4 text-[28px] font-semibold tracking-[-0.04em] text-[#15242a]">{value}</p>
    </div>
  );
}

function UserAvatar({
  name,
  avatar,
  size = "md",
}: {
  name: string;
  avatar?: string | null;
  size?: "md" | "lg";
}) {
  const dimensions = size === "lg" ? "h-16 w-16" : "h-12 w-12";
  const innerDimensions = size === "lg" ? "h-12 w-12 text-base" : "h-9 w-9 text-sm";

  return (
    <div className={cn("grid shrink-0 place-items-center overflow-hidden rounded-full bg-[#dce3e6]", dimensions)}>
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar} alt={name} className="h-full w-full object-cover" />
      ) : (
        <div
          className={cn(
            "grid place-items-center rounded-full bg-[linear-gradient(145deg,#0d2f34,#5c6e74)] font-semibold text-white",
            innerDimensions,
          )}
        >
          {getInitials(name)}
        </div>
      )}
    </div>
  );
}

function RoleBadge({ role }: { role: User["role"] }) {
  return (
    <span
      className="shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold"
      style={{
        color: getRoleTone(role),
        backgroundColor: `${getRoleTone(role)}18`,
      }}
    >
      {translateRole(role)}
    </span>
  );
}

function resolveUser(user: User, config?: UserPermissionConfig): ResolvedUser {
  const effectiveRole = config?.role ?? user.role;
  const permissions = {
    ...defaultPermissions[effectiveRole],
    ...(config?.permissions ?? {}),
  };

  return {
    ...user,
    effectiveRole,
    active: config?.active ?? true,
    permissions,
  };
}

function parseConfigs(value: string): Record<number, UserPermissionConfig> {
  const parsed = JSON.parse(value) as Record<string, UserPermissionConfig>;
  return Object.fromEntries(Object.entries(parsed).map(([key, config]) => [Number(key), config]));
}

function getInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "U";
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("");
}

function translateRole(role: User["role"]) {
  if (role === "Admin") return "مدير النظام";
  if (role === "Project Manager") return "مدير مشروع";
  if (role === "Member") return "عضو";
  return "مشاهد";
}

function getRoleTone(role: User["role"]) {
  if (role === "Admin") return "#ef7c61";
  if (role === "Project Manager") return "#0d7573";
  if (role === "Member") return "#5c6bd8";
  return "#738388";
}
