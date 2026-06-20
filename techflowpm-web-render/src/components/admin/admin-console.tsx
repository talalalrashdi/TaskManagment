"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgePlus,
  Building2,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  UserCog,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import {
  departmentIconOptions,
  departmentTypeOptions,
  getRoleDefinition,
  getRoleTone,
  selectableRoleDefinitions,
  translateUserRole,
} from "@/lib/access-control";
import { AUTH_BYPASS_ENABLED, BYPASS_USER } from "@/lib/config";
import { Button, Card, Input, Select } from "@/components/ui/primitives";
import { cn, formatDate } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import type { Department, PagedResult, User, UserRole } from "@/types/domain";

type CreateUserFormState = {
  name: string;
  role: UserRole;
  departmentId: string;
};

type EditUserFormState = {
  name: string;
  role: UserRole;
  departmentId: string;
};

type CreateDepartmentFormState = {
  name: string;
  type: Department["type"];
  color: string;
  icon: string;
};

const defaultUserRole: UserRole = "Division Member";

const defaultCreateUserForm: CreateUserFormState = {
  name: "",
  role: defaultUserRole,
  departmentId: "",
};

const defaultCreateDepartmentForm: CreateDepartmentFormState = {
  name: "",
  type: "Software",
  color: "#0d7573",
  icon: "building-2",
};

const memberNameOptions = [
  "طلال الراشدي",
  "محمد النعماني",
  "سعيد السلامي",
  "خالد البوسعيدي",
  "ناصر الحارثي",
  "مازن المعمري",
  "يوسف العلوي",
  "راشد السيابي",
  "هلال السعدي",
  "سالم الرواحي",
];

const adminPanelClassName =
  "border border-white/10 bg-[linear-gradient(135deg,#0a0a0a,#101417_55%,#041311)] text-white shadow-[0_34px_80px_-48px_rgba(0,0,0,0.95)] backdrop-blur-sm";
const adminFieldClassName =
  "border-white/10 bg-[#0b0b0b] text-white placeholder:text-white/30 focus:border-[#2de2c7] focus:ring-[rgba(45,226,199,0.16)]";
const adminPanelBackgroundStyle = {
  background: "linear-gradient(135deg,#0a0a0a,#101417 55%,#041311)",
};

function syncAdminUsersCache(current: PagedResult<User> | undefined, user: User) {
  const nextItems = [...(current?.items ?? [])];
  const existingIndex = nextItems.findIndex((item) => item.id === user.id);

  if (existingIndex >= 0) {
    nextItems[existingIndex] = user;
  } else {
    nextItems.push(user);
  }

  nextItems.sort((left, right) => left.name.localeCompare(right.name, "ar"));

  const page = current?.page ?? 1;
  const pageSize = current?.pageSize ?? Math.max(nextItems.length, 1);
  const totalCount = existingIndex >= 0 ? current?.totalCount ?? nextItems.length : (current?.totalCount ?? nextItems.length - 1) + 1;

  return {
    items: nextItems,
    totalCount,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(totalCount / Math.max(pageSize, 1))),
  } satisfies PagedResult<User>;
}

function buildGeneratedMemberIdentity(name: string) {
  const normalizedName = name.trim();
  const identifier = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    email: `member-${identifier}@techflow.local`,
    password: `TMP-${identifier}-${normalizedName.length}`,
  };
}

export function AdminConsole() {
  const queryClient = useQueryClient();
  const storedUser = useAuthStore((state) => state.user);
  const currentUser = storedUser ?? (AUTH_BYPASS_ENABLED ? BYPASS_USER : null);
  const isAdmin = currentUser?.role === "Admin";
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [isMemberNamePickerOpen, setIsMemberNamePickerOpen] = useState(false);
  const [createUserForm, setCreateUserForm] = useState<CreateUserFormState>(defaultCreateUserForm);
  const [editUserForm, setEditUserForm] = useState<EditUserFormState>({
    name: "",
    role: defaultUserRole,
    departmentId: "",
  });
  const [createDepartmentForm, setCreateDepartmentForm] = useState<CreateDepartmentFormState>(defaultCreateDepartmentForm);

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: () =>
      apiClient
        .get<PagedResult<User>>("/users", { page: 1, pageSize: 200 })
        .then((response) => response.data),
    enabled: isAdmin,
  });

  const departmentsQuery = useQuery({
    queryKey: ["admin-departments"],
    queryFn: () => apiClient.get<Department[]>("/departments").then((response) => response.data),
    enabled: isAdmin,
  });

  const users = useMemo(() => usersQuery.data?.items ?? [], [usersQuery.data?.items]);
  const departments = useMemo(() => departmentsQuery.data ?? [], [departmentsQuery.data]);
  const filteredMemberNameOptions = useMemo(() => {
    const normalizedSearch = createUserForm.name.trim().toLocaleLowerCase("ar");
    if (!normalizedSearch) {
      return memberNameOptions;
    }

    return memberNameOptions.filter((name) => name.toLocaleLowerCase("ar").includes(normalizedSearch));
  }, [createUserForm.name]);

  const createUserMutation = useMutation({
    mutationFn: () => {
      const generatedIdentity = buildGeneratedMemberIdentity(createUserForm.name);

      return apiClient.post<User>("/users", {
        name: createUserForm.name.trim(),
        email: generatedIdentity.email,
        password: generatedIdentity.password,
        role: createUserForm.role,
        departmentId: createUserForm.departmentId ? Number(createUserForm.departmentId) : null,
        avatar: null,
      });
    },
    onSuccess: async (response) => {
      queryClient.setQueryData<PagedResult<User>>(["admin-users"], (current) =>
        syncAdminUsersCache(current, response.data),
      );
      setCreateUserForm(defaultCreateUserForm);
      setIsMemberNamePickerOpen(false);
      setSelectedUserId(response.data.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-users"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["users"], refetchType: "active" }),
      ]);
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: (userId: number) =>
      apiClient.put<User>(`/users/${userId}`, {
        name: editUserForm.name.trim(),
        role: editUserForm.role,
        departmentId: editUserForm.departmentId ? Number(editUserForm.departmentId) : null,
        avatar: null,
      }),
    onSuccess: async (response) => {
      queryClient.setQueryData<PagedResult<User>>(["admin-users"], (current) =>
        syncAdminUsersCache(current, response.data),
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-users"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["users"], refetchType: "active" }),
      ]);
    },
  });

  const createDepartmentMutation = useMutation({
    mutationFn: () =>
      apiClient.post<Department>("/departments", {
        name: createDepartmentForm.name.trim(),
        type: createDepartmentForm.type,
        color: createDepartmentForm.color,
        icon: createDepartmentForm.icon,
      }),
    onSuccess: async (response) => {
      setCreateDepartmentForm(defaultCreateDepartmentForm);
      setCreateUserForm((current) => ({ ...current, departmentId: String(response.data.id) }));
      await queryClient.invalidateQueries({ queryKey: ["admin-departments"] });
    },
  });

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) {
      return users;
    }

    return users.filter((user) => {
      const departmentName = user.departmentName ?? "";
      return (
        user.name.toLowerCase().includes(normalizedSearch) ||
        user.email.toLowerCase().includes(normalizedSearch) ||
        departmentName.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [search, users]);

  const selectedUser = useMemo(
    () => filteredUsers.find((user) => user.id === selectedUserId) ?? users.find((user) => user.id === selectedUserId) ?? filteredUsers[0] ?? null,
    [filteredUsers, selectedUserId, users],
  );

  useEffect(() => {
    if (!selectedUser && filteredUsers.length > 0) {
      setSelectedUserId(filteredUsers[0].id);
    }
  }, [filteredUsers, selectedUser]);

  useEffect(() => {
    if (!selectedUser) {
      return;
    }

    setEditUserForm({
      name: selectedUser.name,
      role: selectedUser.role,
      departmentId: selectedUser.departmentId ? String(selectedUser.departmentId) : "",
    });
  }, [selectedUser]);

  const selectedRoleDefinition = getRoleDefinition(editUserForm.role);

  const stats = useMemo(
    () => ({
      totalUsers: users.length,
      totalDepartments: departments.length,
      systemAdmins: users.filter((user) => user.role === "Admin").length,
      leadershipRoles: users.filter((user) => ["Department Chair", "Chair Office", "Department Director", "Section Head", "Division Supervisor"].includes(user.role)).length,
    }),
    [departments.length, users],
  );

  if (!isAdmin) {
    return (
      <div className="space-y-6" dir="rtl">
        <Card className="border border-[#5a2621] bg-[linear-gradient(180deg,#140909,#1d0c0c)] p-8 text-right text-white shadow-[0_30px_70px_-42px_rgba(0,0,0,0.92)]">
          <div className="flex items-center gap-3 text-[#ff8d74]">
            <LockKeyhole className="h-6 w-6" />
            <h1 className="text-[26px] font-semibold text-white">الوصول للإدارة محصور بمدير النظام</h1>
          </div>
          <p className="mt-4 max-w-2xl text-[15px] leading-8 text-white/55">
            هذه الصفحة مخصصة لإدارة المستخدمين والدوائر والصلاحيات. سجّل الدخول بحساب يحمل دور مدير النظام للوصول الكامل.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div
      className="space-y-6 rounded-[36px] border border-white/10 bg-[radial-gradient(circle_at_top,#111827_0%,#050505_55%,#020202_100%)] p-4 text-white shadow-[0_38px_90px_-50px_rgba(0,0,0,0.98)]"
      dir="rtl"
    >
      <section className="overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(135deg,#0a0a0a,#101417_55%,#041311)] shadow-[0_34px_90px_-46px_rgba(0,0,0,0.92)]">
        <div className="grid gap-6 px-6 py-7 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-[12px] font-semibold text-[#95ffea] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <ShieldCheck className="h-4 w-4" />
              لوحة إدارة النظام
            </div>
            <h1 className="mt-5 text-[36px] font-semibold tracking-[-0.05em] text-white lg:text-[44px]">
              إدارة المستخدمين والصلاحيات
            </h1>
            <p className="mt-3 max-w-2xl text-[15px] leading-8 text-white/55">
              أضف مستخدمين جدد، أنشئ دوائر، وامنح كل مستخدم الدور المناسب حسب نطاق الرؤية والمسؤولية داخل المؤسسة.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard label="إجمالي المستخدمين" value={stats.totalUsers} icon={UsersRound} accent="#0d7573" />
            <StatCard label="إجمالي الدوائر" value={stats.totalDepartments} icon={Building2} accent="#5163d9" />
            <StatCard label="مديرو النظام" value={stats.systemAdmins} icon={ShieldCheck} accent="#ef7c61" />
            <StatCard label="أدوار قيادية" value={stats.leadershipRoles} icon={Sparkles} accent="#f0b819" />
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card
          className={cn(adminPanelClassName, "relative overflow-visible p-6", isMemberNamePickerOpen && "z-40")}
          style={adminPanelBackgroundStyle}
        >
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-[18px] border border-[#2de2c7]/15 bg-[#071210] text-[#95ffea]">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-[22px] font-semibold text-white">إضافة مستخدم جديد</h2>
              <p className="mt-1 text-[13px] text-white/45">أدخل الاسم وحدد الدور والدائرة، وسيتم إنشاء المستخدم مباشرة.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="relative z-50">
              <Input
                placeholder="ابحث عن اسم المستخدم"
                className={adminFieldClassName}
                value={createUserForm.name}
                onFocus={() => setIsMemberNamePickerOpen(true)}
                onBlur={() => {
                  setTimeout(() => setIsMemberNamePickerOpen(false), 120);
                }}
                onChange={(event) => {
                  const value = event.target.value;
                  setCreateUserForm((current) => ({ ...current, name: value }));
                  setIsMemberNamePickerOpen(true);
                }}
              />
              {isMemberNamePickerOpen ? (
                <div className="absolute z-[120] mt-2 max-h-56 w-full overflow-y-auto rounded-[22px] border border-white/10 bg-[#090909] p-2 shadow-[0_26px_54px_-34px_rgba(0,0,0,0.92)]">
                  {filteredMemberNameOptions.length > 0 ? (
                    filteredMemberNameOptions.map((name) => (
                      <button
                        key={name}
                        type="button"
                        className="flex w-full items-center rounded-[18px] px-3 py-2.5 text-right text-[13px] font-semibold text-white/80 transition hover:bg-white/[0.06]"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          setCreateUserForm((current) => ({ ...current, name }));
                          setIsMemberNamePickerOpen(false);
                        }}
                      >
                        {name}
                      </button>
                    ))
                  ) : (
                    <p className="px-3 py-2 text-[13px] text-white/40">لا توجد نتائج في القائمة الحالية.</p>
                  )}
                </div>
              ) : null}
            </div>
            <Select
              className={adminFieldClassName}
              value={createUserForm.role}
              onChange={(event) => setCreateUserForm((current) => ({ ...current, role: event.target.value as UserRole }))}
            >
              {selectableRoleDefinitions.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </Select>
            <div className="md:col-span-2">
              <Select
                className={adminFieldClassName}
                value={createUserForm.departmentId}
                onChange={(event) => setCreateUserForm((current) => ({ ...current, departmentId: event.target.value }))}
              >
                <option value="">بدون دائرة</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {createUserMutation.error instanceof Error ? (
            <p className="mt-4 text-[13px] text-[#ff8d74]">{createUserMutation.error.message}</p>
          ) : null}

          <div className="mt-5 flex justify-end">
            <Button
              onClick={() => createUserMutation.mutate()}
              disabled={createUserMutation.isPending || !createUserForm.name.trim()}
            >
              <UserPlus className="h-4 w-4" />
              {createUserMutation.isPending ? "جارٍ إنشاء الحساب..." : "إضافة المستخدم"}
            </Button>
          </div>
        </Card>

        <Card className={cn(adminPanelClassName, "p-6")} style={adminPanelBackgroundStyle}>
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-[18px] border border-[#5163d9]/20 bg-[#101425] text-[#8ab4ff]">
              <BadgePlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-[22px] font-semibold text-white">إضافة دائرة جديدة</h2>
              <p className="mt-1 text-[13px] text-white/45">إدارة الهيكل التنظيمي المستخدم في توزيع الصلاحيات وربط المستخدمين.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Input
              className={adminFieldClassName}
              placeholder="اسم الدائرة"
              value={createDepartmentForm.name}
              onChange={(event) => setCreateDepartmentForm((current) => ({ ...current, name: event.target.value }))}
            />
            <Select
              className={adminFieldClassName}
              value={createDepartmentForm.type}
              onChange={(event) =>
                setCreateDepartmentForm((current) => ({ ...current, type: event.target.value as Department["type"] }))
              }
            >
              {departmentTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <div className="flex items-center gap-3">
              <Input
                type="color"
                value={createDepartmentForm.color}
                onChange={(event) => setCreateDepartmentForm((current) => ({ ...current, color: event.target.value }))}
                className="h-12 w-20 rounded-2xl border-white/10 bg-[#0b0b0b] px-2"
              />
              <Input
                className={adminFieldClassName}
                value={createDepartmentForm.color}
                onChange={(event) => setCreateDepartmentForm((current) => ({ ...current, color: event.target.value }))}
                placeholder="#0d7573"
              />
            </div>
            <Select
              className={adminFieldClassName}
              value={createDepartmentForm.icon}
              onChange={(event) => setCreateDepartmentForm((current) => ({ ...current, icon: event.target.value }))}
            >
              {departmentIconOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          {createDepartmentMutation.error instanceof Error ? (
            <p className="mt-4 text-[13px] text-[#ff8d74]">{createDepartmentMutation.error.message}</p>
          ) : null}

          <div className="mt-5 flex items-center justify-between gap-3">
            <span className="rounded-full border border-[#5163d9]/20 bg-[#101425] px-3 py-1 text-[12px] font-semibold text-[#8ab4ff]">
              {departments.length} دائرة مسجلة
            </span>
            <Button
              variant="secondary"
              onClick={() => createDepartmentMutation.mutate()}
              disabled={createDepartmentMutation.isPending || !createDepartmentForm.name.trim()}
            >
              <BadgePlus className="h-4 w-4" />
              {createDepartmentMutation.isPending ? "جارٍ الإضافة..." : "إضافة الدائرة"}
            </Button>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <Card className={adminPanelClassName} style={adminPanelBackgroundStyle}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-[24px] font-semibold text-white">مستخدمو النظام</h2>
              <p className="mt-1 text-[13px] text-white/45">ابحث واختر مستخدمًا لتعديل دوره أو دائرته.</p>
            </div>
            <span className="rounded-full border border-[#2de2c7]/15 bg-[#071210] px-3 py-1 text-[12px] font-semibold text-[#95ffea]">
              {filteredUsers.length} مستخدم
            </span>
          </div>

          <div className="mt-5">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ابحث بالاسم أو البريد أو الدائرة..."
              className={cn("h-11", adminFieldClassName)}
            />
          </div>

          <div className="mt-5 space-y-3">
            {usersQuery.isLoading ? (
              <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] px-4 py-10 text-center text-[13px] text-white/40">
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
                      ? "border-[#2de2c7]/30 bg-[linear-gradient(135deg,rgba(10,18,18,0.96),rgba(5,26,23,0.94))] shadow-[0_24px_50px_-38px_rgba(45,226,199,0.32)]"
                      : "border-white/8 bg-white/[0.03] hover:border-white/14 hover:bg-white/[0.05]",
                  )}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar name={user.name} />
                      <div className="min-w-0">
                        <p className="truncate text-[16px] font-semibold text-white">{user.name}</p>
                        <p className="mt-1 truncate text-[12px] text-white/38">{user.email}</p>
                      </div>
                    </div>
                    <RoleBadge role={user.role} />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[12px] text-white/40">
                    <span>{user.departmentName ?? "بدون دائرة"}</span>
                    <span>انضم {formatDate(user.createdAt)}</span>
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] px-4 py-10 text-center text-[13px] text-white/40">
                لا توجد نتائج مطابقة.
              </div>
            )}
          </div>
        </Card>

        <Card className={adminPanelClassName} style={adminPanelBackgroundStyle}>
          {selectedUser ? (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <UserAvatar name={selectedUser.name} size="lg" />
                  <div>
                    <h2 className="text-[24px] font-semibold tracking-[-0.04em] text-white">{selectedUser.name}</h2>
                    <p className="mt-1 text-[13px] text-white/40">{selectedUser.email}</p>
                  </div>
                </div>
                <RoleBadge role={selectedUser.role} />
              </div>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <label className="text-[13px] font-semibold text-white/55">اسم المستخدم</label>
                  <Input
                    className={adminFieldClassName}
                    value={editUserForm.name}
                    onChange={(event) => setEditUserForm((current) => ({ ...current, name: event.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[13px] font-semibold text-white/55">الدور</label>
                  <Select
                    className={adminFieldClassName}
                    value={editUserForm.role}
                    onChange={(event) => setEditUserForm((current) => ({ ...current, role: event.target.value as UserRole }))}
                  >
                    {selectableRoleDefinitions.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-[13px] font-semibold text-white/55">الدائرة</label>
                  <Select
                    className={adminFieldClassName}
                    value={editUserForm.departmentId}
                    onChange={(event) => setEditUserForm((current) => ({ ...current, departmentId: event.target.value }))}
                  >
                    <option value="">بدون دائرة</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2">
                  <UserCog className="h-4 w-4 text-[#95ffea]" />
                  <h3 className="text-[18px] font-semibold text-white">ملخص الصلاحية</h3>
                </div>
                <div className="mt-4 rounded-[22px] border border-white/10 bg-[#090909] px-4 py-4">
                  <p className="text-[15px] font-semibold text-white">{selectedRoleDefinition.label}</p>
                  <p className="mt-2 text-[13px] leading-7 text-white/50">{selectedRoleDefinition.description}</p>
                  <p className="mt-3 text-[12px] font-semibold" style={{ color: selectedRoleDefinition.color }}>
                    {selectedRoleDefinition.scope}
                  </p>
                </div>
              </div>

              {updateUserMutation.error instanceof Error ? (
                <p className="text-[13px] text-[#ff8d74]">{updateUserMutation.error.message}</p>
              ) : null}

              <div className="flex justify-end">
                <Button
                  onClick={() => updateUserMutation.mutate(selectedUser.id)}
                  disabled={updateUserMutation.isPending || !editUserForm.name.trim()}
                >
                  <ShieldCheck className="h-4 w-4" />
                  {updateUserMutation.isPending ? "جارٍ حفظ التعديل..." : "حفظ الصلاحية"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] px-4 py-10 text-center text-[13px] text-white/40">
              اختر مستخدمًا من القائمة لإدارة دوره.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function StatCard({
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
    <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,#0a0a0a,#101417_55%,#041311)] px-4 py-4 shadow-[0_22px_44px_-34px_rgba(0,0,0,0.88)]">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-semibold text-white/40">{label}</p>
        <div
          className="grid h-10 w-10 place-items-center rounded-[16px] border"
          style={{ backgroundColor: `${accent}18`, color: accent, borderColor: `${accent}35` }}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-4 text-[28px] font-semibold tracking-[-0.04em] text-white">{value}</p>
    </div>
  );
}

function UserAvatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  const dimensions = size === "lg" ? "h-16 w-16 text-base" : "h-12 w-12 text-sm";

  return (
    <div className={cn("grid shrink-0 place-items-center rounded-full bg-[linear-gradient(145deg,#0d2f34,#5c6e74)] font-semibold text-white", dimensions)}>
      {getInitials(name)}
    </div>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  const color = getRoleTone(role);

  return (
    <span
      className="shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold"
      style={{
        color,
        backgroundColor: `${color}18`,
      }}
    >
      {translateUserRole(role)}
    </span>
  );
}

function getInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "U";
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("");
}
