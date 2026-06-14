"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  FileUp,
  FileText,
  LayoutDashboard,
  ListTodo,
  MessageSquareMore,
  Plus,
  Sparkles,
  Trash2,
  type LucideIcon,
  UserPlus,
  UsersRound,
  ChevronDown,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useProjectHub } from "@/hooks/use-project-hub";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { Button, Input, ProgressBar, Select, TextArea } from "@/components/ui/primitives";
import { cn, formatCurrency, formatDate, getStatusTone, getTypeColor, percentage } from "@/lib/utils";
import type {
  ExecutiveUpdate,
  PagedResult,
  Project,
  ProjectDetail,
  ProjectMember,
  ProjectSummary,
  Task,
  User,
} from "@/types/domain";

type TabKey = "overview" | "tasks" | "costs" | "files";
type SidePanelKey = "updates" | "team";

type TaskStats = {
  total: number;
  todo: number;
  inProgress: number;
  review: number;
  done: number;
  blocked: number;
};

type TaskFormState = {
  title: string;
  description: string;
  assignedToIds: string[];
  status: string;
  priority: string;
  dueDate: string;
  estimatedHours: number;
  actualHours: number;
  orderIndex: number;
};

const tabs: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: "tasks", label: "المهام", icon: ListTodo },
  { key: "costs", label: "التكاليف", icon: CircleDollarSign },
  { key: "files", label: "الملفات والملاحظات", icon: FileText },
  { key: "overview", label: "نظرة عامة", icon: LayoutDashboard },
];

export default function ProjectDetailsPage() {
  const params = useParams<{ id: string }>();
  const projectId = Number(params.id);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>("tasks");
  const [sidePanel, setSidePanel] = useState<SidePanelKey>("updates");
  const [isSidePanelCollapsed, setIsSidePanelCollapsed] = useState(false);
  const [isSideComposerOpen, setIsSideComposerOpen] = useState(false);
  const [isProjectContentScrolled, setIsProjectContentScrolled] = useState(false);
  const [taskForm, setTaskForm] = useState<TaskFormState>({
    title: "",
    description: "",
    assignedToIds: [] as string[],
    status: "Todo",
    priority: "Medium",
    dueDate: "",
    estimatedHours: 8,
    actualHours: 0,
    orderIndex: 0,
  });
  const [updateForm, setUpdateForm] = useState({
    content: "",
    updateType: "StatusUpdate",
  });
  const [memberForm, setMemberForm] = useState({
    userId: "",
    roleInProject: "",
  });

  useProjectHub(projectId);

  const projectQuery = useQuery({
    queryKey: ["project-detail", projectId],
    queryFn: () =>
      apiClient.get<ProjectDetail>(`/projects/${projectId}`).then((response) => response.data),
  });

  const summaryQuery = useQuery({
    queryKey: ["project-summary", projectId],
    queryFn: () =>
      apiClient
        .get<ProjectSummary>(`/projects/${projectId}/summary`)
        .then((response) => response.data),
  });

  const tasksQuery = useQuery({
    queryKey: ["project-tasks", projectId],
    queryFn: () =>
      apiClient.get<Task[]>(`/projects/${projectId}/tasks`).then((response) => response.data),
  });

  const updatesQuery = useQuery({
    queryKey: ["project-updates", projectId],
    queryFn: () =>
      apiClient
        .get<ExecutiveUpdate[]>(`/projects/${projectId}/updates`)
        .then((response) => response.data),
  });

  const usersQuery = useQuery({
    queryKey: ["users", "project-members", projectId],
    queryFn: () =>
      apiClient
        .get<PagedResult<User>>("/users", { page: 1, pageSize: 100 })
        .then((response) => response.data),
  });

  const patchTaskStatusMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: number; status: Task["status"] }) =>
      apiClient.patch(`/tasks/${taskId}/status`, { status }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["project-summary", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
      ]);
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: () =>
      apiClient.post(`/projects/${projectId}/tasks`, {
        ...taskForm,
        assignedToId: taskForm.assignedToIds[0] ? Number(taskForm.assignedToIds[0]) : null,
        assignedUserIds: taskForm.assignedToIds.map(Number),
        dueDate: taskForm.dueDate || null,
      }),
    onSuccess: async () => {
      setTaskForm({
        title: "",
        description: "",
        assignedToIds: [],
        status: "Todo",
        priority: "Medium",
        dueDate: "",
        estimatedHours: 8,
        actualHours: 0,
        orderIndex: 0,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["project-summary", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] }),
      ]);
    },
  });

  const addUpdateMutation = useMutation({
    mutationFn: () => apiClient.post(`/projects/${projectId}/updates`, updateForm),
    onSuccess: async () => {
      setUpdateForm({ content: "", updateType: "StatusUpdate" });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project-updates", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["project-detail", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] }),
      ]);
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: () =>
      apiClient.post<ProjectMember>(`/projects/${projectId}/members`, {
        userId: Number(memberForm.userId),
        roleInProject: memberForm.roleInProject.trim(),
      }),
    onSuccess: async () => {
      setMemberForm({ userId: "", roleInProject: "" });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project-detail", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["project-summary", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-project-detail", projectId] }),
      ]);
    },
  });

  const deleteUpdateMutation = useMutation({
    mutationFn: (updateId: number) => apiClient.delete(`/projects/${projectId}/updates/${updateId}`),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project-updates", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["project-detail", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-project-detail", projectId] }),
      ]);
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: number) => apiClient.delete(`/projects/${projectId}/members/${userId}`),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project-detail", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["project-summary", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-project-detail", projectId] }),
      ]);
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: () => apiClient.delete(`/projects/${projectId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      router.replace("/dashboard");
    },
  });

  const project = projectQuery.data?.project;
  const members = useMemo(() => projectQuery.data?.members ?? [], [projectQuery.data?.members]);
  const summary = summaryQuery.data;
  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const updates = useMemo(
    () => updatesQuery.data ?? projectQuery.data?.recentUpdates ?? [],
    [projectQuery.data?.recentUpdates, updatesQuery.data],
  );
  const users = useMemo(() => usersQuery.data?.items ?? [], [usersQuery.data?.items]);
  const selectableUsers = useMemo(() => {
    const memberUserIds = new Set(members.map((member) => member.userId));
    return users.filter((user) => !memberUserIds.has(user.id));
  }, [members, users]);

  const completionPercent = summary?.completionPercent ?? project?.progressPercent ?? 0;
  const budget = summary?.budget ?? project?.budget ?? 0;
  const actualCost = summary?.actualCost ?? project?.actualCost ?? 0;
  const budgetConsumption = useMemo(() => {
    if (budget === 0) {
      return 0;
    }

    return Math.min(100, Math.max(0, (actualCost / budget) * 100));
  }, [actualCost, budget]);

  const taskStats = useMemo(
    () => ({
      total: tasks.length,
      todo: tasks.filter((task) => task.status === "Todo").length,
      inProgress: tasks.filter((task) => task.status === "InProgress").length,
      review: tasks.filter((task) => task.status === "Review").length,
      done: tasks.filter((task) => task.status === "Done").length,
      blocked: tasks.filter((task) => task.status === "Blocked").length,
    }),
    [tasks],
  );

  const monthlyProgress = useMemo(
    () => buildMonthlyProgress(project, completionPercent),
    [completionPercent, project],
  );

  if (!project) {
    return (
      <div className="min-h-screen bg-[#f7fbfb] px-6 py-8" dir="rtl">
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center rounded-[34px] bg-[#eef7f8] text-[#6c7c82]">
          جاري تحميل المشروع...
        </div>
      </div>
    );
  }

  const statusTone = getStatusTone(project.status);
  const typeColor = getTypeColor(project.type);
  const remainingBudget = budget - actualCost;
  const projectManagerName = project.projectManagerName ?? "غير محدد";
  const projectManagerMember = members.find((member) => member.userId === project.projectManagerId);

  const handleDeleteUpdate = (update: ExecutiveUpdate) => {
    if (typeof window !== "undefined" && !window.confirm("هل أنت متأكد من حذف هذا الموقف التنفيذي؟")) {
      return;
    }

    deleteUpdateMutation.mutate(update.id);
  };

  const handleRemoveMember = (member: ProjectMember) => {
    if (typeof window !== "undefined" && !window.confirm("هل أنت متأكد من حذف هذا العضو من فريق العمل؟")) {
      return;
    }

    removeMemberMutation.mutate(member.userId);
  };

  return (
    <div className="h-screen overflow-hidden bg-[#f7fbfb]" dir="rtl">
      <div className="flex h-screen w-full overflow-hidden bg-[#f7fbfb]" dir="rtl">
        <section
          className="order-last m-2 h-[calc(100vh-1rem)] min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-[34px] bg-[#eef7f8] px-6 pb-8 sm:px-8 lg:px-12"
          onScroll={(event) => {
            const isScrolled = event.currentTarget.scrollTop > 8;
            setIsProjectContentScrolled((current) => (current === isScrolled ? current : isScrolled));
          }}
          dir="rtl"
        >
          <header
            className={cn(
              "sticky top-3 z-30 mt-3 flex flex-col gap-4 rounded-[30px] px-5 py-4 transition-all duration-300 xl:flex-row xl:items-center xl:justify-between",
              isProjectContentScrolled
                ? "border border-white/80 bg-white/76 shadow-[0_22px_48px_-36px_rgba(12,54,58,0.34)] backdrop-blur-xl"
                : "bg-transparent shadow-none backdrop-blur-0",
            )}
          >
            <button
              type="button"
              onClick={() => setIsSidePanelCollapsed((current) => !current)}
              title={isSidePanelCollapsed ? "توسيع اللوحة الجانبية" : "تقليص اللوحة الجانبية"}
              aria-label={isSidePanelCollapsed ? "توسيع اللوحة الجانبية" : "تقليص اللوحة الجانبية"}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#0d7573] shadow-[0_18px_30px_-26px_rgba(10,76,74,0.28)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#f7fbfb]"
            >
              {isSidePanelCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[13px] font-semibold text-[#1d7775] shadow-[0_18px_30px_-26px_rgba(10,76,74,0.34)] transition hover:-translate-y-0.5"
              >
                <ArrowLeft className="h-4 w-4" />
                العودة للرئيسية
              </button>
              <span className="rounded-full bg-white/70 px-4 py-2 text-[12px] font-semibold text-[#66787d]">
                ملف المشروع #{project.id}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => deleteProjectMutation.mutate()}
                disabled={deleteProjectMutation.isPending}
                className="inline-flex items-center gap-2 rounded-full bg-[#eef2f3] px-4 py-2.5 text-[13px] font-semibold text-[#526268] transition hover:bg-[#e2e8ea] disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                حذف
              </button>
            </div>
          </header>

          <div className="mt-9">
            <div className="flex w-full max-w-none flex-col items-start text-right" dir="rtl">
              <div className="flex items-center justify-end gap-3 text-[#11272c]">
                <Sparkles className="h-8 w-8 text-[#f0b819]" />
                <span className="rounded-full bg-white/70 px-4 py-2 text-[12px] font-semibold text-[#0d7573]">
                  مساحة المشروع
                </span>
              </div>
              <h1 className="mt-4 w-full text-[38px] font-semibold leading-tight tracking-[-0.06em] text-[#11272c] lg:text-[50px]">
                {project.title}
              </h1>
              <p className="mt-4 w-full max-w-5xl text-[15px] leading-8 text-[#6e7f84]">
                {project.description || "لا يوجد وصف تفصيلي لهذا المشروع حالياً."}
              </p>
              <div className="mt-5 flex items-center justify-start gap-3 text-right">
                <MemberAvatar name={projectManagerName} avatar={projectManagerMember?.userAvatar} />
                <div>
                  <p className="text-[12px] font-semibold text-[#849095]">مدير المشروع</p>
                  <p className="mt-1 text-[16px] font-semibold text-[#173036]">{projectManagerName}</p>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <ProjectBadge label={translateProjectType(project.type)} color={typeColor} />
                <ProjectBadge label={translateProjectStatus(project.status)} color={statusTone} />
                <ProjectBadge label={translatePriority(project.priority)} color={getStatusTone(project.priority)} />
              </div>
              <ProjectMonthlyProgress months={monthlyProgress} progressPercent={completionPercent} />
            </div>
          </div>

          <nav className="mt-9 w-full max-w-[860px] text-right" dir="rtl">
            <div className="grid grid-cols-2 gap-2 rounded-[24px] bg-[#f7fbfb] p-1.5 md:grid-cols-4">
              {tabs.map((item) => {
                const Icon = item.icon;

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setTab(item.key)}
                    className={cn(
                      "flex min-w-0 items-center justify-center gap-1.5 rounded-[18px] px-3 py-2.5 text-[11px] leading-none transition md:text-[13px]",
                      tab === item.key
                        ? "bg-white font-bold text-[#0d7573] shadow-[0_16px_28px_-24px_rgba(12,54,58,0.28)]"
                        : "font-medium text-[#7a8a8f]",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate whitespace-nowrap">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          {tab === "tasks" ? (
            <div className="mt-9">
              <TaskCreatePanel
                users={users}
                taskForm={taskForm}
                setTaskForm={setTaskForm}
                isSaving={createTaskMutation.isPending}
                onCreateTask={() => createTaskMutation.mutate()}
              />
            </div>
          ) : null}

          <div className="mt-10 min-h-0 flex-1">
            {tab === "overview" ? (
              <OverviewTab
                project={project}
                members={members}
                updates={updates}
                taskStats={taskStats}
                completionPercent={completionPercent}
                deletingUpdateId={deleteUpdateMutation.variables}
                onDeleteUpdate={handleDeleteUpdate}
              />
            ) : null}

            {tab === "tasks" ? (
              <TasksTab
                tasks={tasks}
                movingTaskId={patchTaskStatusMutation.variables?.taskId}
                onMoveTask={(task, status) => patchTaskStatusMutation.mutate({ taskId: task.id, status })}
              />
            ) : null}

            {tab === "costs" ? (
              <CostsTab
                budget={budget}
                actualCost={actualCost}
                remainingBudget={remainingBudget}
                budgetConsumption={budgetConsumption}
                summary={summary}
              />
            ) : null}

            {tab === "files" ? <FilesTab /> : null}
          </div>
        </section>

        {isSidePanelCollapsed ? (
          <aside
            className="order-first sticky top-2 m-2 flex h-[calc(100vh-1rem)] w-full max-w-[96px] flex-col items-center overflow-hidden rounded-[34px] border border-[#eff3f4] bg-white px-3 pb-4 pt-7 text-right shadow-[0_28px_70px_-52px_rgba(12,54,58,0.35)]"
            dir="rtl"
          >
            <div className="grid h-12 w-12 place-items-center rounded-[20px] bg-[#f4f7f8] text-[#0d7573] shadow-[0_20px_35px_-28px_rgba(10,76,74,0.18)]">
              {sidePanel === "updates" ? <MessageSquareMore className="h-5 w-5" /> : <UsersRound className="h-5 w-5" />}
            </div>
          </aside>
        ) : (
          <aside
            className="order-first sticky top-2 m-2 flex h-[calc(100vh-1rem)] w-full max-w-[460px] flex-col items-end overflow-hidden rounded-[34px] border border-[#eff3f4] bg-white px-6 pb-6 pt-7 text-right shadow-[0_28px_70px_-52px_rgba(12,54,58,0.35)] sm:px-7 lg:px-8"
            dir="rtl"
          >
            <div className="w-full border-b border-[#eef2f3] pb-6">
            <div className="flex flex-row-reverse items-start gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="mt-2 text-[30px] font-semibold tracking-[-0.05em] text-[#1d2747]">
                  {sidePanel === "updates" ? "الموقف التنفيذي" : "فريق العمل"}
                </h2>
                <p className="mt-2 text-[13px] leading-6 text-[#849095]">
                  {sidePanel === "updates"
                    ? "عرض وإضافة تحديثات تنفيذية مرتبطة مباشرة بهذا المشروع."
                    : "عرض فريق العمل وإضافة عضو جديد مع تحديد دوره داخل المشروع."}
                </p>
              </div>
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#edf8f8] text-[#0d7573]">
                {sidePanel === "updates" ? <MessageSquareMore className="h-6 w-6" /> : <UsersRound className="h-6 w-6" />}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 rounded-[24px] bg-[#f7fbfb] p-1.5">
              <button
                type="button"
                onClick={() => setSidePanel("updates")}
                className={cn(
                  "rounded-[18px] px-3 py-2.5 text-[13px] transition",
                  sidePanel === "updates"
                    ? "bg-white font-bold text-[#0d7573] shadow-[0_16px_28px_-24px_rgba(12,54,58,0.28)]"
                    : "font-medium text-[#7a8a8f]",
                )}
              >
                الموقف التنفيذي
              </button>
              <button
                type="button"
                onClick={() => setSidePanel("team")}
                className={cn(
                  "rounded-[18px] px-3 py-2.5 text-[13px] transition",
                  sidePanel === "team"
                    ? "bg-white font-bold text-[#0d7573] shadow-[0_16px_28px_-24px_rgba(12,54,58,0.28)]"
                    : "font-medium text-[#7a8a8f]",
                )}
              >
                فريق العمل
              </button>
            </div>

            <div className="mt-4 flex flex-row-reverse items-center justify-between rounded-[22px] bg-[#f7fbfb] px-4 py-3">
              <span className="text-[13px] font-semibold text-[#66787d]">
                {sidePanel === "updates" ? "إجمالي التحديثات" : "إجمالي الأعضاء"}
              </span>
              <span className="rounded-full bg-white px-3 py-1 text-[12px] font-bold text-[#0d7573]">
                {sidePanel === "updates" ? updates.length : members.length}
              </span>
            </div>
          </div>

          <div className="mt-5 min-h-0 w-full flex-1 space-y-3 overflow-y-auto pe-1 pb-4">
            {sidePanel === "updates" ? (
              updates.length > 0 ? (
                updates.map((update) => (
                  <ExecutiveUpdateCard
                    key={update.id}
                    update={update}
                    isDeleting={deleteUpdateMutation.isPending && deleteUpdateMutation.variables === update.id}
                    onDelete={() => handleDeleteUpdate(update)}
                  />
                ))
              ) : (
                <EmptyState
                  title="لا توجد تحديثات تنفيذية بعد"
                  description="أضف أول موقف تنفيذي من النموذج الموجود أسفل هذا القسم."
                />
              )
            ) : members.length > 0 ? (
              members.map((member) => (
                <ProjectMemberCard
                  key={member.id}
                  member={member}
                  isDeleting={removeMemberMutation.isPending && removeMemberMutation.variables === member.userId}
                  onDelete={() => handleRemoveMember(member)}
                />
              ))
            ) : (
              <EmptyState
                title="لا يوجد أعضاء بعد"
                description="أضف أول عضو في فريق العمل من النموذج الموجود أسفل هذا القسم."
              />
            )}
          </div>

          <div className="sticky bottom-0 z-20 mt-auto w-full shrink-0 bg-[linear-gradient(180deg,#ffffff00_0%,#ffffffe6_34%,#fffffff7_100%)] pb-1 pt-9 backdrop-blur-xl">
            <div className="pointer-events-none absolute inset-x-0 -top-10 h-10 bg-[linear-gradient(180deg,#ffffff00_0%,#ffffffe8_100%)] backdrop-blur-sm" />
            <button
              type="button"
              onClick={() => setIsSideComposerOpen((current) => !current)}
              className="relative z-10 flex w-full flex-row-reverse items-center justify-between gap-4 rounded-[22px] bg-white/76 px-4 py-3 text-right shadow-[0_22px_42px_-32px_rgba(12,54,58,0.34)] ring-1 ring-white/70 backdrop-blur-xl transition hover:bg-white/92"
              aria-expanded={isSideComposerOpen}
            >
              <div>
                <h3 className="text-[18px] font-semibold text-[#15242a]">
                  {sidePanel === "updates" ? "إضافة موقف" : "إضافة عضو"}
                </h3>
                <p className="mt-1 text-[12px] text-[#849095]">
                  {sidePanel === "updates" ? "سيتم حفظه داخل سجل هذا المشروع." : "اختر الموظف وحدد دوره داخل المشروع."}
                </p>
              </div>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-[#0d7573] shadow-[0_14px_26px_-22px_rgba(12,54,58,0.28)]">
                {isSideComposerOpen ? (
                  <ChevronDown className="h-5 w-5 rotate-180 transition-transform" />
                ) : sidePanel === "updates" ? (
                  <Plus className="h-5 w-5" />
                ) : (
                  <UserPlus className="h-5 w-5" />
                )}
              </span>
            </button>

            <div
              className={cn(
                "relative z-10 grid transition-all duration-300 ease-out",
                isSideComposerOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
              )}
            >
              <div className="overflow-hidden">
                {sidePanel === "updates" ? (
                  <div className="space-y-3 pt-4">
                    <Select
                      value={updateForm.updateType}
                      onChange={(event) => setUpdateForm((current) => ({ ...current, updateType: event.target.value }))}
                      className="h-11 border-[#e0e9eb] bg-white"
                    >
                      <option value="StatusUpdate">تحديث حالة</option>
                      <option value="Milestone">منجز رئيسي</option>
                      <option value="Issue">مشكلة</option>
                      <option value="Achievement">إنجاز</option>
                    </Select>
                    <TextArea
                      placeholder="اكتب الموقف التنفيذي هنا..."
                      value={updateForm.content}
                      onChange={(event) => setUpdateForm((current) => ({ ...current, content: event.target.value }))}
                      className="min-h-[118px] border-[#e4ecee] bg-white"
                    />
                    <Button
                      onClick={() => addUpdateMutation.mutate()}
                      disabled={addUpdateMutation.isPending || updateForm.content.trim().length === 0}
                      className="w-full rounded-full bg-[#11272c] hover:bg-[#0a171a]"
                    >
                      {addUpdateMutation.isPending ? "جارٍ الإضافة..." : "إضافة الموقف"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3 pt-4">
                    <Select
                      value={memberForm.userId}
                      onChange={(event) => setMemberForm((current) => ({ ...current, userId: event.target.value }))}
                      className="h-11 border-[#e0e9eb] bg-white"
                    >
                      <option value="">اختر الموظف</option>
                      {selectableUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name} - {translateRole(user.role)}
                        </option>
                      ))}
                    </Select>
                    <Input
                      value={memberForm.roleInProject}
                      onChange={(event) => setMemberForm((current) => ({ ...current, roleInProject: event.target.value }))}
                      placeholder="دوره في المشروع مثل: Backend Engineer"
                      className="h-11 border-[#e0e9eb] bg-white"
                    />
                    <Button
                      onClick={() => addMemberMutation.mutate()}
                      disabled={
                        addMemberMutation.isPending ||
                        !memberForm.userId ||
                        memberForm.roleInProject.trim().length === 0 ||
                        selectableUsers.length === 0
                      }
                      className="w-full rounded-full bg-[#11272c] hover:bg-[#0a171a]"
                    >
                      {addMemberMutation.isPending ? "جارٍ الإضافة..." : "إضافة العضو"}
                    </Button>
                    {selectableUsers.length === 0 ? (
                      <p className="text-center text-[12px] leading-6 text-[#849095]">
                        جميع الموظفين الحاليين مضافون إلى هذا المشروع.
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function OverviewTab({
  project,
  members,
  updates,
  taskStats,
  completionPercent,
  deletingUpdateId,
  onDeleteUpdate,
}: {
  project: Project;
  members: ProjectMember[];
  updates: ExecutiveUpdate[];
  taskStats: TaskStats;
  completionPercent: number;
  deletingUpdateId?: number;
  onDeleteUpdate: (update: ExecutiveUpdate) => void;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <div className="space-y-6">
        <Panel className="p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[13px] font-semibold text-[#0d7573]">نبذة المشروع</p>
              <h2 className="mt-2 text-[28px] font-semibold tracking-[-0.05em] text-[#15242a]">
                ملخص تنفيذي سريع
              </h2>
              <p className="mt-3 max-w-3xl text-[15px] leading-8 text-[#5d6d73]">
                {project.description || "لا يوجد وصف تفصيلي بعد. يمكن إضافة ملخص واضح لأهداف المشروع ونطاقه ومخرجاته المتوقعة."}
              </p>
            </div>
            <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-[#0d7573] text-[20px] font-bold text-white">
              {percentage(completionPercent)}
            </div>
          </div>

          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between text-[13px] font-semibold text-[#66787d]">
              <span>نسبة الإنجاز</span>
              <span>{percentage(completionPercent)}</span>
            </div>
            <ProgressBar value={completionPercent} className="h-3 bg-[#e6f1f1]" />
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <CompactInfo label="البداية" value={formatDate(project.startDate)} icon={CalendarRange} />
            <CompactInfo label="النهاية" value={formatDate(project.endDate)} icon={CalendarRange} />
            <CompactInfo label="الأعضاء" value={`${members.length} عضو`} icon={UsersRound} />
          </div>
        </Panel>

        <Panel className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-semibold text-[#0d7573]">الموقف التنفيذي</p>
              <h3 className="mt-1 text-[22px] font-semibold text-[#15242a]">آخر التحديثات</h3>
            </div>
            <MessageSquareMore className="h-5 w-5 text-[#0d7573]" />
          </div>
          <div className="mt-5 space-y-3">
            {updates.slice(0, 4).map((update) => (
              <ExecutiveUpdateCard
                key={update.id}
                update={update}
                isDeleting={deletingUpdateId === update.id}
                onDelete={() => onDeleteUpdate(update)}
              />
            ))}
            {updates.length === 0 ? <EmptyState title="لا توجد تحديثات" description="أضف موقفاً تنفيذياً من تبويب الموقف التنفيذي." /> : null}
          </div>
        </Panel>
      </div>

      <div className="space-y-6">
        <Panel className="p-6">
          <p className="text-[13px] font-semibold text-[#0d7573]">تفصيل المهام</p>
          <h3 className="mt-1 text-[22px] font-semibold text-[#15242a]">حركة العمل الحالية</h3>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <TaskMiniMetric label="الإجمالي" value={taskStats.total} color="#0d7573" />
            <TaskMiniMetric label="قيد التنفيذ" value={taskStats.inProgress} color="#f0b819" />
            <TaskMiniMetric label="مراجعة" value={taskStats.review} color="#5c6bd8" />
            <TaskMiniMetric label="متعثر" value={taskStats.blocked} color="#ef7c61" />
          </div>
        </Panel>

        <Panel className="p-6">
          <p className="text-[13px] font-semibold text-[#0d7573]">الملكية</p>
          <h3 className="mt-1 text-[22px] font-semibold text-[#15242a]">الأقسام المرتبطة</h3>
          <div className="mt-5 space-y-3">
            <OwnerRow label="القسم المسؤول" value={project.responsibleDepartmentName ?? "غير محدد"} />
            <OwnerRow label="القسم المستفيد" value={project.beneficiaryDepartmentName ?? "غير محدد"} />
            <OwnerRow label="مدير المشروع" value={project.projectManagerName ?? "غير محدد"} />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function TaskCreatePanel({
  users,
  taskForm,
  setTaskForm,
  isSaving,
  onCreateTask,
}: {
  users: User[];
  taskForm: TaskFormState;
  setTaskForm: React.Dispatch<React.SetStateAction<TaskFormState>>;
  isSaving: boolean;
  onCreateTask: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAssigneePickerOpen, setIsAssigneePickerOpen] = useState(false);
  const selectedAssignees = users.filter((user) => taskForm.assignedToIds.includes(String(user.id)));

  const toggleAssignee = (userId: number) => {
    const value = String(userId);
    setTaskForm((current) => ({
      ...current,
      assignedToIds: current.assignedToIds.includes(value)
        ? current.assignedToIds.filter((assignedId) => assignedId !== value)
        : [...current.assignedToIds, value],
    }));
  };

  return (
    <Panel className="relative z-40 overflow-visible p-5">
      <button
        type="button"
        onClick={() => setIsExpanded((current) => !current)}
        className="flex w-full items-center justify-between gap-4 text-right"
        aria-expanded={isExpanded}
      >
        <div>
          <p className="text-[13px] font-semibold text-[#0d7573]">إضافة مهمة</p>
          <h3 className="mt-1 text-[22px] font-semibold text-[#15242a]">مهمة جديدة داخل المشروع</h3>
        </div>
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#edf8f8] text-[#0d7573] transition">
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 rotate-180 transition-transform" />
          ) : (
            <Plus className="h-5 w-5" />
          )}
        </span>
      </button>

      <div
        className={cn(
          "grid transition-all duration-300 ease-out",
          isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className={cn(isExpanded ? "overflow-visible" : "overflow-hidden")}>
          <div className="mt-5 space-y-4 border-t border-[#eef2f3] pt-5">
            <Input
              placeholder="عنوان المهمة"
              value={taskForm.title}
              onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))}
            />
            <TextArea
              placeholder="وصف المهمة"
              value={taskForm.description}
              onChange={(event) => setTaskForm((current) => ({ ...current, description: event.target.value }))}
            />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Select value={taskForm.status} onChange={(event) => setTaskForm((current) => ({ ...current, status: event.target.value }))}>
                <option value="Todo">جديدة</option>
                <option value="InProgress">قيد التنفيذ</option>
                <option value="Review">مراجعة</option>
                <option value="Done">منجزة</option>
                <option value="Blocked">متعثر</option>
              </Select>
              <Select value={taskForm.priority} onChange={(event) => setTaskForm((current) => ({ ...current, priority: event.target.value }))}>
                <option value="Low">منخفضة</option>
                <option value="Medium">متوسطة</option>
                <option value="High">عالية</option>
                <option value="Critical">حرجة</option>
              </Select>
              <Input type="date" value={taskForm.dueDate} onChange={(event) => setTaskForm((current) => ({ ...current, dueDate: event.target.value }))} />
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsAssigneePickerOpen((current) => !current)}
                  className="flex h-12 w-full items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 text-right text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgba(99,102,241,0.18)]"
                  aria-expanded={isAssigneePickerOpen}
                >
                  <span className={cn("truncate", selectedAssignees.length > 0 ? "text-[#172228]" : "text-slate-400")}>
                    {selectedAssignees.length > 0
                      ? selectedAssignees.map((user) => user.name).join("، ")
                      : "المكلفون بالمهمة"}
                  </span>
                  <ChevronDown className={cn("h-4 w-4 shrink-0 text-[#7c8f91] transition", isAssigneePickerOpen && "rotate-180")} />
                </button>

                {isAssigneePickerOpen ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[80] overflow-hidden rounded-[20px] border border-[#dce7e8] bg-white p-2 shadow-[0_24px_48px_-32px_rgba(12,54,58,0.35)]">
                    <div className="max-h-64 space-y-1 overflow-y-auto">
                      {users.map((user) => {
                        const selected = taskForm.assignedToIds.includes(String(user.id));

                        return (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => toggleAssignee(user.id)}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-right text-[13px] font-semibold transition",
                              selected ? "bg-[#edf8f8] text-[#0d7573]" : "text-[#526268] hover:bg-[#f5fafb]",
                            )}
                          >
                            <span className="grid h-7 w-7 place-items-center rounded-full bg-[#dce3e6] text-[10px] text-[#173036]">
                              {getInitials(user.name)}
                            </span>
                            <span className="min-w-0 flex-1 truncate">{user.name}</span>
                            <span
                              className={cn(
                                "grid h-5 w-5 place-items-center rounded-full border text-[11px]",
                                selected ? "border-[#0d7573] bg-[#0d7573] text-white" : "border-[#cfdcde] text-transparent",
                              )}
                            >
                              ✓
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={onCreateTask} disabled={isSaving}>
                <Plus className="h-4 w-4" />
                {isSaving ? "جارٍ الإضافة..." : "إضافة المهمة"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function TasksTab({
  tasks,
  movingTaskId,
  onMoveTask,
}: {
  tasks: Task[];
  movingTaskId?: number;
  onMoveTask: (task: Task, status: Task["status"]) => void;
}) {
  return (
    <div className="space-y-6">
      <Panel className="overflow-hidden p-4">
        <KanbanBoard
          tasks={tasks}
          movingTaskId={movingTaskId}
          onMove={(task, status) => onMoveTask(task, status)}
        />
      </Panel>
    </div>
  );
}

function CostsTab({
  budget,
  actualCost,
  remainingBudget,
  budgetConsumption,
  summary,
}: {
  budget: number;
  actualCost: number;
  remainingBudget: number;
  budgetConsumption: number;
  summary?: ProjectSummary;
}) {
  return (
    <div>
      <Panel className="p-6">
        <p className="text-[13px] font-semibold text-[#0d7573]">التكاليف</p>
        <h3 className="mt-1 text-[22px] font-semibold text-[#15242a]">ميزانية مقابل تكلفة فعلية</h3>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <TaskMiniMetric label="الميزانية" value={formatCurrency(budget)} color="#0d7573" />
          <TaskMiniMetric label="المصروف" value={formatCurrency(actualCost)} color="#ef7c61" />
          <TaskMiniMetric label="المتبقي" value={formatCurrency(remainingBudget)} color="#f0b819" />
          <TaskMiniMetric label="الانحراف" value={formatCurrency(summary?.variance ?? remainingBudget)} color="#64748b" />
        </div>
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-[13px] font-semibold text-[#66787d]">
            <span>استهلاك الميزانية</span>
            <span>{percentage(budgetConsumption)}</span>
          </div>
          <ProgressBar value={budgetConsumption} className="h-3 bg-[#e6f1f1]" />
        </div>
      </Panel>
    </div>
  );
}

function FilesTab() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const removeSelectedFile = (targetFile: File) => {
    setSelectedFiles((current) =>
      current.filter(
        (file) =>
          !(
            file.name === targetFile.name &&
            file.size === targetFile.size &&
            file.lastModified === targetFile.lastModified
          ),
      ),
    );
  };

  return (
    <div className="space-y-6">
      <Panel className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[13px] font-semibold text-[#0d7573]">الملفات والملاحظات</p>
            <h3 className="mt-1 text-[22px] font-semibold text-[#15242a]">مرفقات المشروع</h3>
          </div>
          <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-[#11272c] px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-[#0a171a]">
            <FileUp className="h-4 w-4" />
            رفع الملفات
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(event) => setSelectedFiles(Array.from(event.target.files ?? []))}
            />
          </label>
        </div>

        <div className="mt-6 rounded-[28px] border border-[#e4ecee] bg-[#fbfdfd] p-3">
          {selectedFiles.length > 0 ? (
            <div className="space-y-2">
              {selectedFiles.map((file) => (
                <div
                  key={`${file.name}-${file.size}-${file.lastModified}`}
                  className="flex flex-col gap-2 rounded-[22px] bg-white px-4 py-3 text-right shadow-[0_18px_30px_-28px_rgba(12,54,58,0.2)] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="order-2 min-w-0 flex-1 sm:order-1">
                    <p className="text-[14px] font-bold text-[#15242a]">{file.name}</p>
                    <p className="mt-1 text-[12px] font-medium text-[#7a8a8f]">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <div className="order-1 flex items-center gap-2 self-end sm:order-2 sm:self-auto">
                    <button
                      type="button"
                      onClick={() => removeSelectedFile(file)}
                      className="inline-flex h-10 items-center justify-center gap-1 rounded-full bg-[#fff1ee] px-3 text-[12px] font-bold text-[#c45d45] transition hover:bg-[#ffe5de]"
                    >
                      <Trash2 className="h-4 w-4" />
                      حذف
                    </button>
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#eef6f6] text-[#0d7573]">
                      <FileText className="h-5 w-5" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid h-52 place-items-center rounded-[24px] border border-dashed border-[#d8e6e7] bg-white text-center">
              <div>
                <FileText className="mx-auto h-8 w-8 text-[#0d7573]" />
                <p className="mt-3 text-[15px] font-bold text-[#172228]">لا توجد ملفات مرفقة بعد</p>
                <p className="mt-2 text-[13px] font-medium text-[#7d8b91]">ابدأ برفع أول ملف ليظهر داخل القائمة هنا.</p>
              </div>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}

function Panel({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-[30px] bg-white shadow-[0_24px_54px_-40px_rgba(12,54,58,0.28)]", className)}>
      {children}
    </div>
  );
}

function ProjectBadge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="rounded-full px-4 py-2 text-[12px] font-semibold"
      style={{ color, backgroundColor: getSoftBadgeBackground(color) }}
    >
      {label}
    </span>
  );
}

function ProjectMonthlyProgress({
  months,
  progressPercent,
}: {
  months: ProjectProgressMonth[];
  progressPercent: number;
}) {
  const safeProgress = Math.max(0, Math.min(100, progressPercent));

  return (
    <div className="mt-10 w-full">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-[22px] font-semibold tracking-[-0.04em] text-[#15242a]">
            نسبة الانجاز الحالية
          </h3>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between text-[13px] font-bold text-[#26363a]">
          <span>نسبة الإنجاز</span>
          <span>{percentage(safeProgress)}</span>
        </div>
        <div className="h-3 rounded-full bg-[#e6f1f1]">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#0d7573,#7aa6a5)] transition-[width] duration-500 ease-out"
            style={{ width: `${safeProgress}%` }}
          />
        </div>

        <div
          className="mt-5 grid gap-2 text-center"
          style={{ gridTemplateColumns: `repeat(${Math.max(months.length, 1)}, minmax(72px, 1fr))` }}
        >
          {months.map((month) => (
            <div key={month.key} className="min-w-0">
              <p className={cn("truncate text-[12px] font-semibold", month.isActive ? "text-[#0d7573]" : "text-[#6f7d83]")}>
                {month.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function getSoftBadgeBackground(color: string) {
  return color.startsWith("var(") ? `color-mix(in srgb, ${color} 16%, white)` : `${color}18`;
}

type ProjectProgressMonth = {
  key: string;
  label: string;
  isActive: boolean;
};

function buildMonthlyProgress(project: Project | undefined, progressPercent: number): ProjectProgressMonth[] {
  if (!project) {
    return [];
  }

  const start = normalizeMonthDate(project.startDate);
  const end = normalizeMonthDate(project.endDate);
  const safeEnd = end < start ? start : end;
  const totalMonths = getMonthDistance(start, safeEnd) + 1;
  const activeIndex = Math.max(0, Math.min(totalMonths - 1, Math.floor((Math.max(0, Math.min(100, progressPercent)) / 100) * totalMonths)));

  return Array.from({ length: totalMonths }).map((_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth() + index, 1);

    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: new Intl.DateTimeFormat("ar-OM", { month: "short", year: "numeric" }).format(date),
      isActive: index === activeIndex,
    };
  });
}

function normalizeMonthDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthDistance(start: Date, end: Date) {
  return (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth();
}

function CompactInfo({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-[22px] bg-[#f7fbfb] px-4 py-4">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#0d7573]">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[12px] text-[#849095]">{label}</p>
          <p className="mt-1 text-[14px] font-semibold text-[#172228]">{value}</p>
        </div>
      </div>
    </div>
  );
}

function TaskMiniMetric({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-[22px] bg-white px-4 py-4 shadow-[0_18px_34px_-30px_rgba(12,54,58,0.24)]">
      <p className="text-[12px] font-semibold text-[#7f8d92]">{label}</p>
      <p className="mt-2 text-[22px] font-semibold tracking-[-0.04em]" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function OwnerRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[20px] bg-[#f7fbfb] px-4 py-3">
      <span className="text-[13px] text-[#849095]">{label}</span>
      <span className="text-[14px] font-semibold text-[#172228]">{value}</span>
    </div>
  );
}

function ExecutiveUpdateCard({
  update,
  isDeleting = false,
  onDelete,
}: {
  update: ExecutiveUpdate;
  isDeleting?: boolean;
  onDelete?: () => void;
}) {
  return (
    <div className="rounded-[22px] border border-[#edf2f3] bg-[#fbfdfd] px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-[#0d7573]">{translateUpdateType(update.updateType)}</p>
          <p className="mt-1 text-[12px] text-[#8a969a]">
            {update.createdByName ?? "النظام"} • {formatDate(update.createdAt)}
          </p>
        </div>
      </div>
      <p className="mt-3 text-[14px] leading-7 text-[#56656b]">{update.content}</p>
      {onDelete ? (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            aria-label="حذف الموقف التنفيذي"
            className="grid h-8 w-8 place-items-center rounded-full text-[#8a969a] transition hover:bg-[#eef2f3] hover:text-[#526268] disabled:cursor-wait disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ProjectMemberCard({
  member,
  isDeleting = false,
  onDelete,
}: {
  member: ProjectMember;
  isDeleting?: boolean;
  onDelete?: () => void;
}) {
  return (
    <div className="relative flex items-center gap-3 rounded-[22px] border border-[#edf2f3] bg-[#fbfdfd] px-4 py-4">
      <MemberAvatar name={member.userName} avatar={member.userAvatar} />
      <div className={cn("min-w-0 flex-1", onDelete && "pe-10")}>
        <p className="truncate text-[15px] font-semibold text-[#172228]">{member.userName}</p>
        <p className="mt-1 truncate text-[12px] text-[#8a969a]">{member.roleInProject}</p>
        {member.userEmail ? (
          <p className="mt-1 truncate text-[11px] text-[#a0aaae]">{member.userEmail}</p>
        ) : null}
      </div>
      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          disabled={isDeleting}
          aria-label="حذف عضو الفريق"
          className="absolute bottom-3 right-3 grid h-8 w-8 place-items-center rounded-full text-[#8a969a] transition hover:bg-[#eef2f3] hover:text-[#526268] disabled:cursor-wait disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

function MemberAvatar({ name, avatar }: { name: string; avatar?: string | null }) {
  return (
    <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-[#dce3e6]">
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar} alt={name} className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-9 w-9 place-items-center rounded-full bg-[linear-gradient(145deg,#0d2f34,#5c6e74)] text-[12px] font-semibold text-white">
          {getInitials(name)}
        </div>
      )}
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[22px] border border-dashed border-[#dce6e7] bg-[#fbfdfd] px-4 py-8 text-center">
      <p className="text-[15px] font-semibold text-[#172228]">{title}</p>
      <p className="mt-2 text-[13px] leading-6 text-[#7d8b91]">{description}</p>
    </div>
  );
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

function translateProjectType(type: Project["type"]) {
  if (type === "Software") return "برمجيات";
  if (type === "Networks") return "شبكات";
  if (type === "Cybersecurity") return "أمن سيبراني";
  return "صيانة";
}

function translateProjectStatus(status: Project["status"]) {
  if (status === "Planning") return "تخطيط";
  if (status === "Active") return "نشط";
  if (status === "OnHold") return "معلق";
  if (status === "Completed") return "مكتمل";
  return "ملغي";
}

function translatePriority(priority: Project["priority"] | Task["priority"]) {
  if (priority === "Low") return "منخفضة";
  if (priority === "Medium") return "متوسطة";
  if (priority === "High") return "عالية";
  return "حرجة";
}

function translateUpdateType(type: ExecutiveUpdate["updateType"]) {
  if (type === "StatusUpdate") return "تحديث حالة";
  if (type === "Milestone") return "منجز رئيسي";
  if (type === "Issue") return "مشكلة";
  return "إنجاز";
}
