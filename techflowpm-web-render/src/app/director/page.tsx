"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  FolderKanban,
  Layers,
  Sparkles,
  Sun,
  TriangleAlert,
  UsersRound,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { AUTH_BYPASS_ENABLED, BYPASS_USER } from "@/lib/config";
import { cn, formatCurrency, formatDate, percentage } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import type { DashboardStats, ExecutiveUpdate, PagedResult, Project, ProjectDetail, Task, User } from "@/types/domain";

type DepartmentMeta = {
  id: number;
  name: string;
  shortName: string;
  color: string;
  soft: string;
  deep: string;
};

type DepartmentSnapshot = DepartmentMeta & {
  projectCount: number;
  activeCount: number;
  completedCount: number;
  progress: number;
  overdue: number;
  risk: number;
  members: number;
  budgetUsage: number;
  todo: number;
  inProgress: number;
  review: number;
  done: number;
  blocked: number;
};

type DepartmentFilter = "all" | number;

type EnrichedOperation = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  occurredAt: string;
  tone: "teal" | "amber" | "coral" | "slate";
};

const monthLabels = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

const departmentCatalog: DepartmentMeta[] = [
  { id: 1, name: "قسم البرمجيات", shortName: "البرمجيات", color: "#0d7573", soft: "#edf8f8", deep: "#0a5756" },
  { id: 2, name: "قسم الشبكات", shortName: "الشبكات", color: "#5c6bd8", soft: "#eef0ff", deep: "#3e49a6" },
  { id: 3, name: "قسم الحماية", shortName: "الحماية", color: "#ef7c61", soft: "#fff1ec", deep: "#c75f47" },
  { id: 4, name: "قسم الصيانة", shortName: "الصيانة", color: "#f0b819", soft: "#fff8df", deep: "#b98b00" },
];

const statusPalette: Record<Project["status"], string> = {
  Planning: "#5c6bd8",
  Active: "#0d7573",
  OnHold: "#f0b819",
  Completed: "#27b287",
  Cancelled: "#94a3b8",
};

const taskPalette: Record<Task["status"], string> = {
  Todo: "#0d7573",
  InProgress: "#f0b819",
  Review: "#5c6bd8",
  Done: "#27b287",
  Blocked: "#ef7c61",
};

function isProjectDetail(detail: ProjectDetail | null | undefined): detail is ProjectDetail {
  return Boolean(detail?.project && Array.isArray(detail.members) && Array.isArray(detail.recentUpdates));
}

function getDepartmentMeta(project: Project) {
  return (
    departmentCatalog.find((department) => department.id === project.responsibleDepartmentId) ?? {
      id: project.responsibleDepartmentId,
      name: project.responsibleDepartmentName ?? "قسم غير محدد",
      shortName: project.responsibleDepartmentName ?? "غير محدد",
      color: "#64748b",
      soft: "#eef2f7",
      deep: "#475569",
    }
  );
}

function translateTaskStatus(status: Task["status"]) {
  if (status === "Todo") return "جديدة";
  if (status === "InProgress") return "قيد التنفيذ";
  if (status === "Review") return "مراجعة";
  if (status === "Done") return "منتهية";
  return "متعثرة";
}

function translateUserRole(role: User["role"]) {
  if (role === "Admin") return "مدير الدائرة";
  if (role === "Project Manager") return "مدير مشروع";
  if (role === "Member") return "عضو فريق";
  return "مراقب";
}

function translateUpdateType(type: ExecutiveUpdate["updateType"]) {
  if (type === "StatusUpdate") return "تحديث حالة";
  if (type === "Milestone") return "منجز رئيسي";
  if (type === "Issue") return "مشكلة";
  return "إنجاز";
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function isCompletedProject(project: Project) {
  return project.status === "Completed" || project.progressPercent >= 100;
}

function getProjectWindow(project: Project) {
  return {
    start: new Date(project.startDate),
    end: new Date(project.endDate),
  };
}

function projectOverlapsYear(project: Project, year: number) {
  const { start, end } = getProjectWindow(project);
  return start.getFullYear() <= year && end.getFullYear() >= year;
}

function isOverdueTask(task: Task, referenceDate: Date) {
  if (!task.dueDate || task.status === "Done") {
    return false;
  }

  return new Date(task.dueDate).getTime() < referenceDate.getTime();
}

function getProjectRiskScore(project: Project, tasks: Task[], referenceDate: Date) {
  const overdue = tasks.filter((task) => isOverdueTask(task, referenceDate)).length;
  const blocked = tasks.filter((task) => task.status === "Blocked").length;
  const daysLeft = Math.ceil((new Date(project.endDate).getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));

  let score = blocked * 2 + overdue * 2;

  if (project.status === "OnHold") score += 4;
  if (project.priority === "Critical") score += 3;
  if (project.progressPercent < 45 && daysLeft <= 20) score += 3;
  if (project.progressPercent < 25 && daysLeft <= 10) score += 2;

  return score;
}

function getOperationToneFromUpdate(type: ExecutiveUpdate["updateType"]): EnrichedOperation["tone"] {
  if (type === "Issue") return "coral";
  if (type === "Milestone") return "amber";
  if (type === "Achievement") return "teal";
  return "slate";
}

function getOperationToneFromTask(task: Task): EnrichedOperation["tone"] {
  if (task.status === "Blocked") return "coral";
  if (task.priority === "High" || task.priority === "Critical") return "amber";
  if (task.status === "Done") return "teal";
  return "slate";
}

function clampPercentage(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function getMonthRange(year: number, monthIndex: number) {
  return {
    start: new Date(year, monthIndex, 1),
    end: new Date(year, monthIndex + 1, 0, 23, 59, 59, 999),
  };
}

function DirectorMetricCard({
  title,
  value,
  note,
  icon,
  tint,
}: {
  title: string;
  value: string;
  note: string;
  icon: React.ReactNode;
  tint: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="group rounded-[24px] border border-white/70 bg-white/88 px-4 py-4 shadow-[0_22px_42px_-34px_rgba(12,54,58,0.26)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_26px_50px_-30px_rgba(12,54,58,0.32)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold text-[#7f8d92]">{title}</p>
          <p className="mt-3 text-[28px] font-semibold tracking-[-0.04em] text-[#15242a]">{value}</p>
          <p className="mt-2 text-[12px] leading-6 text-[#7c8a8f]">{note}</p>
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-2xl text-white shadow-[0_18px_34px_-26px_rgba(12,54,58,0.4)]" style={{ background: tint }}>
          {icon}
        </div>
      </div>
    </motion.div>
  );
}

function DirectorSection({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-[30px] border border-white/70 bg-white/88 p-5 shadow-[0_24px_54px_-40px_rgba(12,54,58,0.24)]"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-[22px] font-semibold tracking-[-0.04em] text-[#12262b]">{title}</h2>
          <p className="mt-1 text-[13px] leading-6 text-[#7d8b90]">{subtitle}</p>
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </motion.section>
  );
}

function DirectorEmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-[280px] items-center justify-center rounded-[24px] border border-dashed border-[#d9e7e8] bg-[#f9fcfc] px-6 text-center text-[14px] text-[#7d8b91]">
      {message}
    </div>
  );
}

export default function DirectorDashboardPage() {
  const storedUser = useAuthStore((state) => state.user);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentFilter>("all");
  const [isScrolled, setIsScrolled] = useState(false);

  const currentUser = useMemo(
    () =>
      storedUser
        ? {
            id: storedUser.id,
            name: storedUser.name,
            role: storedUser.role,
            avatar: storedUser.avatar ?? null,
          }
        : AUTH_BYPASS_ENABLED
          ? {
              id: BYPASS_USER.id,
              name: BYPASS_USER.name,
              role: BYPASS_USER.role,
              avatar: null,
            }
          : {
              id: 0,
              name: "مدير الدائرة",
              role: "Viewer" as const,
              avatar: null,
            },
    [storedUser],
  );

  const statsQuery = useQuery({
    queryKey: ["director-stats"],
    queryFn: () => apiClient.get<DashboardStats>("/projects/stats").then((response) => response.data),
  });

  const projectsQuery = useQuery({
    queryKey: ["director-projects"],
    queryFn: () =>
      apiClient
        .get<PagedResult<Project>>("/projects", { page: 1, pageSize: 100 })
        .then((response) => response.data),
  });

  const allProjects = useMemo(() => projectsQuery.data?.items ?? [], [projectsQuery.data?.items]);

  const projectDetailsQueries = useQueries({
    queries: allProjects.map((project) => ({
      queryKey: ["director-project-detail", project.id],
      queryFn: async () => {
        try {
          return await apiClient.get<ProjectDetail>(`/projects/${project.id}`).then((response) => response.data);
        } catch {
          return null;
        }
      },
      staleTime: 60_000,
    })),
  });

  const projectTasksQueries = useQueries({
    queries: allProjects.map((project) => ({
      queryKey: ["director-project-tasks", project.id],
      queryFn: () =>
        apiClient
          .get<Task[]>(`/projects/${project.id}/tasks`)
          .then((response) => response.data)
          .catch(() => []),
      staleTime: 60_000,
    })),
  });

  const details = useMemo(
    () => projectDetailsQueries.map((query) => query.data).filter(isProjectDetail),
    [projectDetailsQueries],
  );

  const tasksByProjectId = useMemo(
    () =>
      new Map(
        allProjects.map((project, index) => [project.id, projectTasksQueries[index]?.data ?? []] as const),
      ),
    [allProjects, projectTasksQueries],
  );

  const yearScopedProjects = useMemo(
    () => allProjects.filter((project) => projectOverlapsYear(project, selectedYear)),
    [allProjects, selectedYear],
  );

  const yearScopedProjectIds = useMemo(
    () => new Set(yearScopedProjects.map((project) => project.id)),
    [yearScopedProjects],
  );

  const yearScopedTasks = useMemo(
    () => yearScopedProjects.flatMap((project) => tasksByProjectId.get(project.id) ?? []),
    [tasksByProjectId, yearScopedProjects],
  );

  const yearScopedDetails = useMemo(
    () => details.filter((detail) => yearScopedProjectIds.has(detail.project.id)),
    [details, yearScopedProjectIds],
  );

  const yearOptions = useMemo(() => {
    const years = new Set<number>([new Date().getFullYear()]);

    allProjects.forEach((project) => {
      const { start, end } = getProjectWindow(project);
      years.add(start.getFullYear());
      years.add(end.getFullYear());
    });

    return Array.from(years).sort((a, b) => a - b);
  }, [allProjects]);

  const filteredProjects = useMemo(() => {
    if (selectedDepartment === "all") {
      return yearScopedProjects;
    }

    return yearScopedProjects.filter((project) => project.responsibleDepartmentId === selectedDepartment);
  }, [selectedDepartment, yearScopedProjects]);

  const filteredProjectIds = useMemo(() => new Set(filteredProjects.map((project) => project.id)), [filteredProjects]);

  const filteredTasks = useMemo(
    () => filteredProjects.flatMap((project) => tasksByProjectId.get(project.id) ?? []),
    [filteredProjects, tasksByProjectId],
  );

  const filteredDetails = useMemo(
    () => yearScopedDetails.filter((detail) => filteredProjectIds.has(detail.project.id)),
    [filteredProjectIds, yearScopedDetails],
  );

  const allMembers = useMemo(() => {
    const memberMap = new Map<number, { name: string; role: string }>();

    filteredDetails.forEach((detail) => {
      detail.members.forEach((member) => {
        memberMap.set(member.userId, { name: member.userName, role: member.roleInProject });
      });
    });

    return Array.from(memberMap.entries()).map(([id, value]) => ({ id, ...value }));
  }, [filteredDetails]);

  const referenceDate = useMemo(() => new Date(selectedYear, new Date().getMonth(), new Date().getDate()), [selectedYear]);

  const completedProjects = useMemo(
    () => filteredProjects.filter((project) => isCompletedProject(project)).length,
    [filteredProjects],
  );

  const activeProjects = useMemo(
    () => filteredProjects.filter((project) => project.status === "Active").length,
    [filteredProjects],
  );

  const averageProgress = useMemo(() => {
    if (!filteredProjects.length) return 0;
    return clampPercentage(
      filteredProjects.reduce((sum, project) => sum + project.progressPercent, 0) / filteredProjects.length,
    );
  }, [filteredProjects]);

  const totalBudget = useMemo(
    () => filteredProjects.reduce((sum, project) => sum + project.budget, 0),
    [filteredProjects],
  );

  const totalActualCost = useMemo(
    () => filteredProjects.reduce((sum, project) => sum + project.actualCost, 0),
    [filteredProjects],
  );

  const budgetUtilization = useMemo(() => {
    if (!totalBudget) return 0;
    return clampPercentage((totalActualCost / totalBudget) * 100);
  }, [totalActualCost, totalBudget]);

  const overdueTasksCount = useMemo(
    () => filteredTasks.filter((task) => isOverdueTask(task, referenceDate)).length,
    [filteredTasks, referenceDate],
  );

  const blockedTasksCount = useMemo(
    () => filteredTasks.filter((task) => task.status === "Blocked").length,
    [filteredTasks],
  );

  const doneTasksCount = useMemo(
    () => filteredTasks.filter((task) => task.status === "Done").length,
    [filteredTasks],
  );

  const portfolioHealth = useMemo(() => {
    if (!filteredProjects.length) return 0;

    const doneRatio = filteredTasks.length ? (doneTasksCount / filteredTasks.length) * 100 : averageProgress;
    const riskPenalty = filteredProjects.length
      ? (filteredProjects.filter((project) => getProjectRiskScore(project, tasksByProjectId.get(project.id) ?? [], referenceDate) > 4).length /
          filteredProjects.length) *
        100
      : 0;

    return clampPercentage(averageProgress * 0.5 + doneRatio * 0.35 + (100 - riskPenalty) * 0.15);
  }, [averageProgress, doneTasksCount, filteredProjects, filteredTasks.length, referenceDate, tasksByProjectId]);

  const departmentSnapshots = useMemo<DepartmentSnapshot[]>(() => {
    return departmentCatalog
      .map((department) => {
        const departmentProjects = yearScopedProjects.filter((project) => project.responsibleDepartmentId === department.id);
        const departmentProjectIds = new Set(departmentProjects.map((project) => project.id));
        const departmentTasks = yearScopedTasks.filter((task) => departmentProjectIds.has(task.projectId));
        const departmentMembers = new Set<number>();

        yearScopedDetails.forEach((detail) => {
          if (!departmentProjectIds.has(detail.project.id)) {
            return;
          }

          detail.members.forEach((member) => departmentMembers.add(member.userId));
        });

        const completed = departmentProjects.filter((project) => isCompletedProject(project)).length;
        const avgProgress = departmentProjects.length
          ? clampPercentage(departmentProjects.reduce((sum, project) => sum + project.progressPercent, 0) / departmentProjects.length)
          : 0;
        const overdue = departmentTasks.filter((task) => isOverdueTask(task, referenceDate)).length;
        const risk = departmentProjects.filter(
          (project) => getProjectRiskScore(project, tasksByProjectId.get(project.id) ?? [], referenceDate) > 4,
        ).length;
        const budget = departmentProjects.reduce((sum, project) => sum + project.budget, 0);
        const actual = departmentProjects.reduce((sum, project) => sum + project.actualCost, 0);

        return {
          ...department,
          projectCount: departmentProjects.length,
          activeCount: departmentProjects.filter((project) => project.status === "Active").length,
          completedCount: completed,
          progress: avgProgress,
          overdue,
          risk,
          members: departmentMembers.size,
          budgetUsage: budget ? clampPercentage((actual / budget) * 100) : 0,
          todo: departmentTasks.filter((task) => task.status === "Todo").length,
          inProgress: departmentTasks.filter((task) => task.status === "InProgress").length,
          review: departmentTasks.filter((task) => task.status === "Review").length,
          done: departmentTasks.filter((task) => task.status === "Done").length,
          blocked: departmentTasks.filter((task) => task.status === "Blocked").length,
        };
      });
  }, [referenceDate, tasksByProjectId, yearScopedDetails, yearScopedProjects, yearScopedTasks]);

  const visibleDepartmentPerformance = useMemo(() => {
    if (selectedDepartment === "all") {
      return departmentSnapshots.filter((department) => department.projectCount > 0).sort((a, b) => b.progress - a.progress);
    }

    return departmentSnapshots.filter((department) => department.id === selectedDepartment);
  }, [departmentSnapshots, selectedDepartment]);

  const departmentTabs = useMemo(() => {
    const allMembersSet = new Set<number>();

    yearScopedDetails.forEach((detail) => {
      detail.members.forEach((member) => allMembersSet.add(member.userId));
    });

    const allRisk = yearScopedProjects.filter(
      (project) => getProjectRiskScore(project, tasksByProjectId.get(project.id) ?? [], referenceDate) > 4,
    ).length;

    const allProgress = yearScopedProjects.length
      ? clampPercentage(yearScopedProjects.reduce((sum, project) => sum + project.progressPercent, 0) / yearScopedProjects.length)
      : 0;

    return [
      {
        key: "all" as DepartmentFilter,
        label: "كل الأقسام",
        hint: "صورة موحدة للدائرة",
        color: "#11272c",
        soft: "#eef4f5",
        projectCount: yearScopedProjects.length,
        progress: allProgress,
        activeCount: yearScopedProjects.filter((project) => project.status === "Active").length,
        members: allMembersSet.size,
        risk: allRisk,
      },
      ...departmentSnapshots.map((department) => ({
        key: department.id as DepartmentFilter,
        label: department.name,
        hint:
          department.projectCount > 0
            ? `${department.projectCount} مشروع • ${department.members} عضو`
            : "لا توجد مشاريع ضمن هذا النطاق",
        color: department.color,
        soft: department.soft,
        projectCount: department.projectCount,
        progress: department.progress,
        activeCount: department.activeCount,
        members: department.members,
        risk: department.risk,
      })),
    ];
  }, [departmentSnapshots, referenceDate, tasksByProjectId, yearScopedDetails, yearScopedProjects]);

  const departmentChartData = useMemo(
    () =>
      visibleDepartmentPerformance.map((department) => ({
        name: department.shortName,
        الإنجاز: department.progress,
        المخاطر: department.risk,
        المتأخرة: department.overdue,
      })),
    [visibleDepartmentPerformance],
  );

  const taskFlowData = useMemo(
    () =>
      visibleDepartmentPerformance.map((department) => ({
        name: department.shortName,
        جديدة: department.todo,
        "قيد التنفيذ": department.inProgress,
        مراجعة: department.review,
        منتهية: department.done,
        متعثرة: department.blocked,
      })),
    [visibleDepartmentPerformance],
  );

  const statusChartData = useMemo(() => {
    const counts = new Map<Project["status"], number>();

    filteredProjects.forEach((project) => {
      const status = isCompletedProject(project) ? "Completed" : project.status;
      counts.set(status, (counts.get(status) ?? 0) + 1);
    });

    return [
      { name: "نشط", value: counts.get("Active") ?? 0, color: statusPalette.Active },
      { name: "تخطيط", value: counts.get("Planning") ?? 0, color: statusPalette.Planning },
      { name: "معلّق", value: counts.get("OnHold") ?? 0, color: statusPalette.OnHold },
      { name: "مكتمل", value: counts.get("Completed") ?? 0, color: statusPalette.Completed },
      { name: "ملغي", value: counts.get("Cancelled") ?? 0, color: statusPalette.Cancelled },
    ].filter((entry) => entry.value > 0);
  }, [filteredProjects]);

  const portfolioTrendData = useMemo(
    () =>
      monthLabels.map((label, index) => {
        const { start, end } = getMonthRange(selectedYear, index);

        return {
          month: label,
          active: filteredProjects.filter((project) => {
            const projectStart = new Date(project.startDate);
            const projectEnd = new Date(project.endDate);
            return projectStart.getTime() <= end.getTime() && projectEnd.getTime() >= start.getTime();
          }).length,
          starts: filteredProjects.filter((project) => {
            const projectStart = new Date(project.startDate);
            return projectStart.getFullYear() === selectedYear && projectStart.getMonth() === index;
          }).length,
          deliveries: filteredProjects.filter((project) => {
            const projectEnd = new Date(project.endDate);
            return projectEnd.getFullYear() === selectedYear && projectEnd.getMonth() === index;
          }).length,
        };
      }),
    [filteredProjects, selectedYear],
  );

  const workloadData = useMemo(() => {
    const workloadMap = new Map<string, { open: number; critical: number; hours: number; done: number }>();

    filteredTasks.forEach((task) => {
      const assigneeNames =
        task.assignees && task.assignees.length
          ? task.assignees.map((assignee) => assignee.userName)
          : task.assignedToName
            ? [task.assignedToName]
            : [task.createdByName ?? "النظام"];

      assigneeNames.forEach((name) => {
        const current = workloadMap.get(name) ?? { open: 0, critical: 0, hours: 0, done: 0 };
        current.hours += task.estimatedHours || 0;
        if (task.status === "Done") current.done += 1;
        else current.open += 1;
        if (task.priority === "Critical" || task.priority === "High") current.critical += 1;
        workloadMap.set(name, current);
      });
    });

    return Array.from(workloadMap.entries())
      .map(([name, stats]) => ({
        name,
        open: stats.open,
        critical: stats.critical,
        hours: stats.hours,
        done: stats.done,
        score: stats.open * 10 + stats.critical * 8 + stats.hours,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }, [filteredTasks]);

  const attentionBoard = useMemo(() => {
    return filteredProjects
      .map((project) => {
        const tasks = tasksByProjectId.get(project.id) ?? [];
        const overdue = tasks.filter((task) => isOverdueTask(task, referenceDate)).length;
        const blocked = tasks.filter((task) => task.status === "Blocked").length;
        const riskScore = getProjectRiskScore(project, tasks, referenceDate);

        return {
          id: project.id,
          title: project.title,
          department: getDepartmentMeta(project).name,
          riskScore,
          overdue,
          blocked,
          progress: project.progressPercent,
          dueDate: formatDate(project.endDate),
          tone: getDepartmentMeta(project).color,
        };
      })
      .filter((project) => project.riskScore > 0)
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 5);
  }, [filteredProjects, referenceDate, tasksByProjectId]);

  const operationFeed = useMemo<EnrichedOperation[]>(() => {
    const updates = filteredDetails.flatMap((detail) =>
      detail.recentUpdates.map((update) => ({
        id: `update-${update.id}`,
        title: detail.project.title,
        subtitle: `${translateUpdateType(update.updateType)} • ${getDepartmentMeta(detail.project).name}`,
        description: update.content,
        occurredAt: update.createdAt,
        tone: getOperationToneFromUpdate(update.updateType),
      })),
    );

    const tasks = filteredTasks.map((task) => ({
      id: `task-${task.id}`,
      title: task.title,
      subtitle: `${translateTaskStatus(task.status)} • ${
        filteredProjects.find((project) => project.id === task.projectId)?.title ?? "مشروع"
      }`,
      description: task.assignedToName
        ? `المكلّف: ${task.assignedToName}`
        : `منشأة بواسطة ${task.createdByName ?? "النظام"}`,
      occurredAt: task.createdAt,
      tone: getOperationToneFromTask(task),
    }));

    const fallbackUpdates = (statsQuery.data?.recentUpdates ?? []).map((update) => ({
      id: `fallback-${update.id}`,
      title: filteredProjects.find((project) => project.id === update.projectId)?.title ?? "مشروع الدائرة",
      subtitle: `${translateUpdateType(update.updateType)} • سجل تنفيذي`,
      description: update.content,
      occurredAt: update.createdAt,
      tone: getOperationToneFromUpdate(update.updateType),
    }));

    return [...updates, ...tasks, ...fallbackUpdates]
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      .filter((operation, index, collection) => collection.findIndex((entry) => entry.id === operation.id) === index)
      .slice(0, 8);
  }, [filteredDetails, filteredProjects, filteredTasks, statsQuery.data?.recentUpdates]);

  const recentOperationCount = useMemo(() => {
    const today = new Date();
    return operationFeed.filter((item) => {
      const occurred = new Date(item.occurredAt);
      return (
        occurred.getFullYear() === today.getFullYear() &&
        occurred.getMonth() === today.getMonth() &&
        occurred.getDate() === today.getDate()
      );
    }).length;
  }, [operationFeed]);

  const selectedDepartmentMeta = selectedDepartment === "all"
    ? null
    : departmentCatalog.find((department) => department.id === selectedDepartment) ?? null;

  const activeDepartmentTab = useMemo(
    () => departmentTabs.find((tab) => tab.key === selectedDepartment) ?? departmentTabs[0],
    [departmentTabs, selectedDepartment],
  );

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    return hour >= 5 && hour < 12 ? "صباح المتابعة" : "مساء المتابعة";
  }, []);

  return (
    <div dir="rtl" className="h-screen overflow-hidden bg-[#f7fbfb]">
      <section
        className="m-2 h-[calc(100vh-1rem)] overflow-y-auto overscroll-contain rounded-[34px] bg-[#eef7f8] px-5 pb-10 sm:px-6 lg:px-8"
        onScroll={(event) => {
          const nextState = event.currentTarget.scrollTop > 8;
          setIsScrolled((current) => (current === nextState ? current : nextState));
        }}
      >
        <header
          className={cn(
            "sticky top-3 z-30 mt-3 flex flex-col gap-4 rounded-[30px] px-5 py-4 transition-all duration-300 lg:flex-row lg:items-center lg:justify-between",
            isScrolled
              ? "border border-white/80 bg-white/76 shadow-[0_22px_48px_-36px_rgba(12,54,58,0.34)] backdrop-blur-xl"
              : "bg-transparent shadow-none backdrop-blur-0",
          )}
        >
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Link
              href="/dashboard"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-white px-4 text-[13px] font-semibold text-[#1d7775] shadow-[0_18px_30px_-26px_rgba(10,76,74,0.28)] transition duration-200 hover:-translate-y-0.5"
            >
              <ArrowLeft className="h-4 w-4" />
              لوحة العمليات
            </Link>
            <Link
              href="/timeline"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-white px-4 text-[13px] font-semibold text-[#0d7573] shadow-[0_18px_30px_-26px_rgba(10,76,74,0.28)] transition duration-200 hover:-translate-y-0.5"
            >
              <CalendarDays className="h-4 w-4" />
              الجدول الزمني
            </Link>
            <span className="inline-flex h-10 items-center rounded-full bg-[#0d7573] px-4 text-[13px] font-semibold text-white shadow-[0_20px_36px_-24px_rgba(13,117,115,0.7)]">
              <Sparkles className="ml-2 h-4 w-4" />
              مدير الدائرة
            </span>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              value={selectedYear}
              onChange={(event) => setSelectedYear(Number(event.target.value))}
              className="h-11 rounded-2xl border border-white/80 bg-white/88 px-4 text-sm font-semibold text-[#173036] outline-none transition focus:border-[#0d7573] focus:ring-2 focus:ring-[#0d7573]/15"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  سنة {year}
                </option>
              ))}
            </select>
          </div>
        </header>

        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="relative mt-8 overflow-hidden rounded-[34px] bg-[linear-gradient(135deg,#f6fbfb_0%,#e9f5f5_42%,#fff7e9_100%)] px-6 py-7 shadow-[0_28px_80px_-44px_rgba(10,76,74,0.28)] lg:px-8"
        >
          <div className="pointer-events-none absolute -left-16 top-8 h-40 w-40 rounded-full bg-[#0d7573]/10 blur-3xl" />
          <div className="pointer-events-none absolute -right-10 bottom-0 h-52 w-52 rounded-full bg-[#f0b819]/20 blur-3xl" />

          <div className="relative grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-[#0d7573] shadow-[0_20px_38px_-30px_rgba(13,117,115,0.4)]">
                <Layers className="h-4 w-4" />
                مركز قيادة الدائرة
              </div>
              <div className="mt-5 flex items-center gap-3 text-[#11272c]">
                <Sun className="h-8 w-8 text-[#f0b819]" />
                <div>
                  <p className="text-[14px] font-semibold text-[#6c7c82]">{greeting}</p>
                  <h1 className="text-[38px] font-semibold tracking-[-0.06em] text-[#12262b] lg:text-[46px]">
                    لوحة إشراف شاملة على الأقسام والمشاريع
                  </h1>
                </div>
              </div>
              <p className="mt-4 max-w-3xl text-[15px] leading-8 text-[#6c7c82]">
                مراقبة مباشرة لسير المشاريع، ضغط المهام، استهلاك الميزانيات، وحركة التحديثات التنفيذية عبر جميع الأقسام
                من نقطة تحكم واحدة.
              </p>

              <div className="mt-6 inline-flex items-center gap-3 rounded-[24px] bg-white/88 px-4 py-3 shadow-[0_18px_34px_-28px_rgba(12,54,58,0.24)]">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[linear-gradient(145deg,#0d2f34,#5c6e74)] text-[13px] font-semibold text-white">
                  {getInitials(currentUser.name)}
                </div>
                <div className="text-right">
                  <p className="text-[14px] font-semibold text-[#173036]">{currentUser.name}</p>
                  <p className="mt-1 text-[12px] text-[#7a8a8f]">{translateUserRole(currentUser.role)}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[28px] bg-white/88 p-5 shadow-[0_22px_48px_-34px_rgba(12,54,58,0.24)]">
                <p className="text-[12px] font-semibold text-[#7d8b90]">ميزانية المحفظة</p>
                <p className="mt-3 text-[28px] font-semibold tracking-[-0.04em] text-[#15242a]">
                  {formatCurrency(totalBudget)}
                </p>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#e3ecec]">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#0d7573_0%,#3aa9a6_100%)]"
                    style={{ width: `${budgetUtilization}%` }}
                  />
                </div>
                <p className="mt-2 text-[12px] text-[#708086]">
                  تم صرف {formatCurrency(totalActualCost)} من إجمالي الاعتمادات المعتمدة.
                </p>
              </div>

              <div className="rounded-[28px] bg-[#11272c] p-5 text-white shadow-[0_26px_56px_-38px_rgba(10,76,74,0.34)]">
                <p className="text-[12px] font-semibold text-white/70">المشهد التنفيذي</p>
                <p className="mt-3 text-[30px] font-semibold tracking-[-0.05em]">{attentionBoard.length}</p>
                <p className="mt-2 text-[13px] leading-6 text-white/75">
                  مشروع يحتاج إلى متابعة قريبة بسبب التأخير أو التعثّر أو اقتراب نهاية المدة.
                </p>
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-[12px] font-semibold text-white/90">
                  <TriangleAlert className="h-4 w-4" />
                  {blockedTasksCount} مهام متعثرة
                </div>
              </div>

              <div className="rounded-[28px] bg-white/88 p-5 shadow-[0_22px_48px_-34px_rgba(12,54,58,0.24)]">
                <p className="text-[12px] font-semibold text-[#7d8b90]">الأعضاء الفعّالون</p>
                <div className="mt-3 flex items-end gap-3">
                  <p className="text-[28px] font-semibold tracking-[-0.04em] text-[#15242a]">{allMembers.length}</p>
                  <span className="mb-1 text-[12px] font-semibold text-[#0d7573]">عبر جميع المشاريع</span>
                </div>
                <p className="mt-3 text-[13px] leading-6 text-[#708086]">
                  {selectedDepartmentMeta ? `العرض الحالي يركز على ${selectedDepartmentMeta.name}.` : "الرؤية الحالية تغطي كل الأقسام والمبادرات."}
                </p>
              </div>

              <div className="rounded-[28px] bg-white/88 p-5 shadow-[0_22px_48px_-34px_rgba(12,54,58,0.24)]">
                <p className="text-[12px] font-semibold text-[#7d8b90]">حركة اليوم</p>
                <div className="mt-3 flex items-end gap-3">
                  <p className="text-[28px] font-semibold tracking-[-0.04em] text-[#15242a]">{recentOperationCount}</p>
                  <span className="mb-1 text-[12px] font-semibold text-[#ef7c61]">عملية مسجلة اليوم</span>
                </div>
                <p className="mt-3 text-[13px] leading-6 text-[#708086]">
                  تحديثات ومهام جديدة دخلت في سجل العمليات التنفيذية خلال اليوم الحالي.
                </p>
              </div>
            </div>
          </div>

          <div className="relative mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <DirectorMetricCard
              title="إجمالي المشاريع"
              value={String(filteredProjects.length)}
              note="عدد المشاريع الواقعة ضمن نطاق العرض الحالي."
              tint="linear-gradient(135deg,#0d7573,#3aa9a6)"
              icon={<FolderKanban className="h-5 w-5" />}
            />
            <DirectorMetricCard
              title="المشاريع النشطة"
              value={String(activeProjects)}
              note="مشاريع قيد التنفيذ حالياً وتحتاج متابعة تشغيلية."
              tint="linear-gradient(135deg,#5c6bd8,#8c98ff)"
              icon={<ArrowUpRight className="h-5 w-5" />}
            />
            <DirectorMetricCard
              title="المشاريع المكتملة"
              value={String(completedProjects)}
              note="مبادرات وصلت إلى الإغلاق الكامل أو 100٪ إنجاز."
              tint="linear-gradient(135deg,#27b287,#61d6ab)"
              icon={<Sparkles className="h-5 w-5" />}
            />
            <DirectorMetricCard
              title="متوسط الإنجاز"
              value={percentage(averageProgress)}
              note="متوسط التقدم العام للمحفظة في النطاق المحدد."
              tint="linear-gradient(135deg,#f0b819,#ffd466)"
              icon={<Clock3 className="h-5 w-5" />}
            />
            <DirectorMetricCard
              title="المهام المتأخرة"
              value={String(overdueTasksCount)}
              note="مهام تجاوزت تاريخ الاستحقاق ولم تُغلق بعد."
              tint="linear-gradient(135deg,#ef7c61,#ffb08a)"
              icon={<TriangleAlert className="h-5 w-5" />}
            />
          </div>
        </motion.section>

        <section className="mt-8 overflow-hidden rounded-[34px] border border-white/80 bg-[linear-gradient(180deg,#f8fcfc_0%,#eef7f8_100%)] shadow-[0_28px_60px_-42px_rgba(12,54,58,0.24)]">
          <div className="bg-transparent px-3 pt-4 sm:px-6">
            <div className="flex justify-start overflow-x-auto">
              <div className="flex min-w-max items-end gap-1 pe-3">
                {departmentTabs.map((tab) => {
                  const active = selectedDepartment === tab.key;
                  const accentColor = tab.key === "all" ? "#11272c" : tab.color;

                  return (
                    <button
                      key={String(tab.key)}
                      type="button"
                      onClick={() => setSelectedDepartment(tab.key)}
                      title={tab.hint}
                      className={cn(
                        "group relative z-10 flex items-center gap-2 px-5 py-3 text-right transition-all duration-300",
                        active
                          ? "-mb-px rounded-t-[18px] border-x border-t border-[#dbe7e8] bg-[linear-gradient(180deg,#f8fcfc_0%,#eef7f8_100%)] text-[#12262b] shadow-[0_16px_30px_-26px_rgba(12,54,58,0.14)]"
                          : "rounded-t-[16px] text-[#8aa0a7] hover:bg-white/42 hover:text-[#172228]",
                      )}
                    >
                      {active && (
                        <>
                          <span
                            className="absolute inset-x-3 top-0 h-[3px] rounded-full"
                            style={{ backgroundColor: accentColor }}
                          />
                          <span className="absolute inset-x-0 bottom-[-1px] h-[2px] bg-[linear-gradient(180deg,#f8fcfc_0%,#eef7f8_100%)]" />
                        </>
                      )}
                      <span className={cn("truncate text-[15px] font-semibold", active ? "text-[#12262b]" : "text-current")}>
                        {tab.label}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold transition",
                          active ? "text-white shadow-[0_10px_18px_-14px_rgba(12,54,58,0.2)]" : "bg-white/88 text-[#708086]",
                        )}
                        style={active ? { backgroundColor: accentColor } : undefined}
                      >
                        {tab.projectCount}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="p-5 pt-8 sm:p-6 sm:pt-10">
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <span
                  className="inline-flex items-center gap-2 rounded-full bg-white/86 px-3 py-2 text-[11px] font-semibold shadow-[0_14px_24px_-20px_rgba(12,54,58,0.16)]"
                  style={{ color: selectedDepartment === "all" ? "#173036" : activeDepartmentTab.color }}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: selectedDepartment === "all" ? "#11272c" : activeDepartmentTab.color }}
                  />
                  {selectedDepartment === "all" ? "عرض موحد للدائرة" : "القسم المحدد"}
                </span>
                <h2 className="mt-2 text-[28px] font-semibold tracking-[-0.05em] text-[#12262b]">
                  {activeDepartmentTab.label}
                </h2>
                <p className="mt-2 max-w-3xl text-[14px] leading-7 text-[#6f7f84]">
                  {selectedDepartment === "all"
                    ? `عرض تنفيذي موحد يضم جميع الأقسام خلال سنة ${selectedYear}، مع قراءة شاملة للمشاريع والمهام والمخاطر.`
                    : `تفاصيل تشغيلية كاملة تخص ${activeDepartmentTab.label} خلال سنة ${selectedYear}، وتشمل الإنجاز، الحركة، والضغوط الحالية.`}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-[#173036] shadow-[0_14px_24px_-20px_rgba(12,54,58,0.16)]">
                  {activeDepartmentTab.projectCount} مشروع
                </span>
                <span className="rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-[#173036] shadow-[0_14px_24px_-20px_rgba(12,54,58,0.16)]">
                  {activeDepartmentTab.members} عضو
                </span>
                <span
                  className="rounded-full px-4 py-2 text-[12px] font-semibold text-white shadow-[0_16px_26px_-18px_rgba(12,54,58,0.24)]"
                  style={{ backgroundColor: activeDepartmentTab.color }}
                >
                  الإنجاز {percentage(activeDepartmentTab.progress)}
                </span>
                <span className="rounded-full bg-[#fff1ec] px-4 py-2 text-[12px] font-semibold text-[#cf6247]">
                  مخاطر {activeDepartmentTab.risk}
                </span>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-6">
                <DirectorSection
              title="نبض المحفظة الزمنية"
              subtitle="مقارنة بين المشاريع النشطة والبدايات والتسليمات خلال أشهر السنة."
              action={
                <span className="inline-flex items-center rounded-full bg-[#f4f7f8] px-3 py-1 text-[12px] font-semibold text-[#617278]">
                  سنة {selectedYear}
                </span>
              }
            >
              {filteredProjects.length ? (
                <>
                  <div className="mb-4 flex flex-wrap gap-2">
                    {[
                      { label: "نشطة", color: "#0d7573" },
                      { label: "بدايات", color: "#5c6bd8" },
                      { label: "تسليمات", color: "#ef7c61" },
                    ].map((item) => (
                      <span key={item.label} className="inline-flex items-center gap-2 rounded-full bg-[#f7fbfb] px-3 py-1 text-[12px] font-semibold text-[#607277]">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        {item.label}
                      </span>
                    ))}
                  </div>
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={portfolioTrendData} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="directorActive" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0d7573" stopOpacity={0.32} />
                            <stop offset="95%" stopColor="#0d7573" stopOpacity={0.02} />
                          </linearGradient>
                          <linearGradient id="directorStarts" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#5c6bd8" stopOpacity={0.22} />
                            <stop offset="95%" stopColor="#5c6bd8" stopOpacity={0.01} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#dfe8e9" strokeDasharray="4 4" vertical={false} />
                        <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "#6f7f84", fontSize: 12 }} />
                        <YAxis tickLine={false} axisLine={false} tick={{ fill: "#6f7f84", fontSize: 12 }} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: "18px",
                            border: "1px solid rgba(228,236,237,1)",
                            boxShadow: "0 22px 42px -32px rgba(12,54,58,0.24)",
                            direction: "rtl",
                          }}
                        />
                        <Area type="monotone" dataKey="active" stroke="#0d7573" fill="url(#directorActive)" strokeWidth={3} />
                        <Area type="monotone" dataKey="starts" stroke="#5c6bd8" fill="url(#directorStarts)" strokeWidth={2.5} />
                        <Bar dataKey="deliveries" fill="#ef7c61" radius={[10, 10, 0, 0]} barSize={18} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <DirectorEmptyState message="لا توجد مشاريع ضمن نطاق العرض الحالي لبناء نبض زمني واضح." />
              )}
            </DirectorSection>

            <DirectorSection
              title="أداء الأقسام"
              subtitle="مقارنة مستوى الإنجاز والحمل التشغيلي بين الأقسام التابعة للدائرة."
            >
              {visibleDepartmentPerformance.length ? (
                <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
                  <div className="space-y-3">
                    {visibleDepartmentPerformance.map((department) => (
                      <div
                        key={department.id}
                        className="rounded-[24px] border border-[#edf2f3] bg-[#fbfdfd] px-4 py-4 shadow-[0_18px_32px_-30px_rgba(12,54,58,0.2)]"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: department.color }} />
                              <p className="text-[15px] font-semibold text-[#172228]">{department.name}</p>
                            </div>
                            <p className="mt-2 text-[12px] text-[#819095]">
                              {department.projectCount} مشروع • {department.members} عضو • {department.completedCount} مكتمل
                            </p>
                          </div>
                          <div className="rounded-full px-3 py-1 text-[12px] font-semibold" style={{ backgroundColor: department.soft, color: department.deep }}>
                            {percentage(department.progress)}
                          </div>
                        </div>
                        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[#e5ecec]">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${department.progress}%`, background: `linear-gradient(90deg, ${department.color} 0%, ${department.deep} 100%)` }}
                          />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-[12px]">
                          <span className="rounded-full bg-[#f4f7f8] px-3 py-1 font-semibold text-[#617278]">
                            نشطة {department.activeCount}
                          </span>
                          <span className="rounded-full bg-[#fff8df] px-3 py-1 font-semibold text-[#b98800]">
                            متأخرة {department.overdue}
                          </span>
                          <span className="rounded-full bg-[#fff1ec] px-3 py-1 font-semibold text-[#cf6247]">
                            مخاطر {department.risk}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="h-[360px] rounded-[26px] bg-[#f9fcfc] p-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={departmentChartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                        <CartesianGrid stroke="#e0e8e9" strokeDasharray="4 4" vertical={false} />
                        <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#6f7f84", fontSize: 12 }} />
                        <YAxis tickLine={false} axisLine={false} tick={{ fill: "#6f7f84", fontSize: 12 }} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: "18px",
                            border: "1px solid rgba(228,236,237,1)",
                            boxShadow: "0 22px 42px -32px rgba(12,54,58,0.24)",
                            direction: "rtl",
                          }}
                        />
                        <Bar dataKey="الإنجاز" fill="#0d7573" radius={[12, 12, 0, 0]} />
                        <Bar dataKey="المخاطر" fill="#ef7c61" radius={[12, 12, 0, 0]} />
                        <Bar dataKey="المتأخرة" fill="#f0b819" radius={[12, 12, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <DirectorEmptyState message="لا توجد بيانات أداء أقسام كافية ضمن الفلاتر الحالية." />
              )}
            </DirectorSection>

            <DirectorSection
              title="حركة المهام عبر الأقسام"
              subtitle="تجميع لحظي لمراحل المهام داخل كل قسم لمعرفة أين تتكدس الأعمال."
            >
              {taskFlowData.length ? (
                <div className="h-[360px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={taskFlowData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                      <CartesianGrid stroke="#e0e8e9" strokeDasharray="4 4" vertical={false} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#6f7f84", fontSize: 12 }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fill: "#6f7f84", fontSize: 12 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "18px",
                          border: "1px solid rgba(228,236,237,1)",
                          boxShadow: "0 22px 42px -32px rgba(12,54,58,0.24)",
                          direction: "rtl",
                        }}
                      />
                      <Bar dataKey="جديدة" stackId="tasks" fill={taskPalette.Todo} radius={[10, 10, 0, 0]} />
                      <Bar dataKey="قيد التنفيذ" stackId="tasks" fill={taskPalette.InProgress} />
                      <Bar dataKey="مراجعة" stackId="tasks" fill={taskPalette.Review} />
                      <Bar dataKey="منتهية" stackId="tasks" fill={taskPalette.Done} />
                      <Bar dataKey="متعثرة" stackId="tasks" fill={taskPalette.Blocked} radius={[10, 10, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <DirectorEmptyState message="لا توجد مهام كافية لرسم حركة تشغيلية واضحة بين الأقسام." />
              )}
            </DirectorSection>
              </div>

              <div className="space-y-6">
                <DirectorSection
              title="صحة المحفظة"
              subtitle="مؤشر سريع يدمج الإنجاز العام، إغلاق المهام، ومستوى المخاطر."
            >
              <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr] xl:grid-cols-1">
                <div className="rounded-[28px] bg-[linear-gradient(180deg,#f8fcfc_0%,#eef7f8_100%)] p-5 text-center">
                  <div
                    className="relative mx-auto h-44 w-44 rounded-full"
                    style={{
                      background: `conic-gradient(#0d7573 0 ${portfolioHealth}%, #dce8e9 ${portfolioHealth}% 100%)`,
                    }}
                  >
                    <div className="absolute inset-[16px] rounded-full bg-white shadow-[inset_0_0_0_1px_rgba(223,234,235,0.9)]" />
                    <div className="absolute inset-0 grid place-items-center">
                      <div>
                        <p className="text-[12px] font-semibold text-[#7b8b90]">صحة المحفظة</p>
                        <p className="mt-2 text-[34px] font-semibold tracking-[-0.05em] text-[#12262b]">
                          {portfolioHealth}
                        </p>
                        <p className="text-[12px] font-semibold text-[#0d7573]">من 100</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {[
                    {
                      label: "معدل الإنجاز العام",
                      value: averageProgress,
                      tone: "#0d7573",
                    },
                    {
                      label: "كفاءة إغلاق المهام",
                      value: filteredTasks.length ? clampPercentage((doneTasksCount / filteredTasks.length) * 100) : 0,
                      tone: "#27b287",
                    },
                    {
                      label: "استهلاك الميزانية",
                      value: budgetUtilization,
                      tone: "#5c6bd8",
                    },
                  ].map((item) => (
                    <div key={item.label} className="rounded-[22px] bg-[#f9fcfc] px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[13px] font-semibold text-[#5e7277]">{item.label}</p>
                        <span className="text-[14px] font-semibold text-[#12262b]">{percentage(item.value)}</span>
                      </div>
                      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#e4ecee]">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${item.value}%`, backgroundColor: item.tone }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
                </DirectorSection>

                <DirectorSection
              title="توزيع حالة المشاريع"
              subtitle="كيف تتوزع المبادرات الحالية بين التخطيط والتنفيذ والإغلاق."
            >
              {statusChartData.length ? (
                <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr] xl:grid-cols-1">
                  <div className="relative h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusChartData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={72}
                          outerRadius={104}
                          paddingAngle={4}
                        >
                          {statusChartData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            borderRadius: "18px",
                            border: "1px solid rgba(228,236,237,1)",
                            boxShadow: "0 22px 42px -32px rgba(12,54,58,0.24)",
                            direction: "rtl",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 grid place-items-center">
                      <div className="text-center">
                        <p className="text-[12px] font-semibold text-[#7b8b90]">إجمالي المحفظة</p>
                        <p className="mt-2 text-[30px] font-semibold tracking-[-0.05em] text-[#12262b]">
                          {filteredProjects.length}
                        </p>
                        <p className="text-[12px] text-[#0d7573]">مشروع</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {statusChartData.map((status) => (
                      <div key={status.name} className="flex items-center justify-between rounded-[22px] bg-[#f8fbfb] px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: status.color }} />
                          <span className="text-[13px] font-semibold text-[#223238]">{status.name}</span>
                        </div>
                        <span className="text-[14px] font-semibold text-[#12262b]">{status.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <DirectorEmptyState message="لا يوجد توزيع حالات متاح بعد ضمن هذا النطاق." />
              )}
                </DirectorSection>

                <DirectorSection
              title="لوحة التنبيهات"
              subtitle="العناصر التي تتطلب تدخلاً تنفيذياً أو إعادة ترتيب أولويات."
              action={
                <span className="inline-flex items-center rounded-full bg-[#fff1ec] px-3 py-1 text-[12px] font-semibold text-[#cf6247]">
                  {attentionBoard.length} حالة مراقبة
                </span>
              }
            >
              {attentionBoard.length ? (
                <div className="space-y-3">
                  {attentionBoard.map((project) => (
                    <div key={project.id} className="rounded-[24px] border border-[#edf2f3] bg-[#fbfdfd] px-4 py-4 shadow-[0_18px_30px_-30px_rgba(12,54,58,0.2)]">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-semibold text-[#172228]">{project.title}</p>
                          <p className="mt-1 text-[12px] text-[#819095]">{project.department}</p>
                        </div>
                        <div
                          className="rounded-full px-3 py-1 text-[11px] font-semibold text-white"
                          style={{ backgroundColor: project.tone }}
                        >
                          خطورة {project.riskScore}
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2 text-[12px]">
                        <span className="rounded-full bg-[#fff8df] px-3 py-1 font-semibold text-[#b88900]">
                          متأخرة {project.overdue}
                        </span>
                        <span className="rounded-full bg-[#fff1ec] px-3 py-1 font-semibold text-[#cf6247]">
                          متعثرة {project.blocked}
                        </span>
                        <span className="rounded-full bg-[#eef4ff] px-3 py-1 font-semibold text-[#5c6bd8]">
                          ينتهي {project.dueDate}
                        </span>
                      </div>
                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#e5ecec]">
                        <div className="h-full rounded-full bg-[linear-gradient(90deg,#0d7573_0%,#2db6b2_100%)]" style={{ width: `${project.progress}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <DirectorEmptyState message="لا توجد حالات حرجة حالياً، وضع المحفظة مستقر ضمن هذا النطاق." />
              )}
                </DirectorSection>

                <DirectorSection
              title="حمل الأعضاء"
              subtitle="أعلى الأعضاء انشغالاً حالياً بناءً على المهام المفتوحة والمهام الحرجة."
            >
              {workloadData.length ? (
                <div className="space-y-3">
                  {workloadData.map((member, index) => (
                    <div key={member.name} className="rounded-[24px] bg-[#f9fcfc] px-4 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-[15px] font-semibold text-[#172228]">{member.name}</p>
                          <p className="mt-1 text-[12px] text-[#7e8c91]">
                            {member.open} مفتوحة • {member.critical} حرجة • {member.done} منتهية
                          </p>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-[12px] font-semibold text-[#0d7573] shadow-[0_12px_22px_-18px_rgba(12,54,58,0.22)]">
                          #{index + 1}
                        </span>
                      </div>
                      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#e4ecee]">
                        <div
                          className="h-full rounded-full bg-[linear-gradient(90deg,#0d7573_0%,#5c6bd8_100%)]"
                          style={{ width: `${Math.min(100, member.score)}%` }}
                        />
                      </div>
                      <p className="mt-2 text-[12px] text-[#7e8c91]">{member.hours} ساعة تقديرية ضمن النطاق الحالي</p>
                    </div>
                  ))}
                </div>
              ) : (
                <DirectorEmptyState message="لا توجد بيانات تكليف كافية لقياس حمل الأعضاء حالياً." />
              )}
                </DirectorSection>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6">
          <DirectorSection
            title="سجل العمليات التنفيذية"
            subtitle="آخر ما تم عبر الأقسام من تحديثات ومهام دخلت إلى دورة العمل."
            action={
              <span className="inline-flex items-center gap-2 rounded-full bg-[#f4f7f8] px-3 py-1 text-[12px] font-semibold text-[#617278]">
                <UsersRound className="h-4 w-4" />
                {operationFeed.length} عملية حديثة
              </span>
            }
          >
            {operationFeed.length ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {operationFeed.map((operation) => {
                  const toneClasses = {
                    teal: "bg-[#edf8f8] text-[#0d7573]",
                    amber: "bg-[#fff8df] text-[#d89b09]",
                    coral: "bg-[#fff1ec] text-[#ef7c61]",
                    slate: "bg-[#eef2f3] text-[#66787d]",
                  }[operation.tone];

                  return (
                    <div
                      key={operation.id}
                      className="group rounded-[26px] border border-[#edf2f3] bg-[#fbfdfd] px-4 py-4 shadow-[0_20px_34px_-30px_rgba(12,54,58,0.22)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_40px_-28px_rgba(12,54,58,0.28)]"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-semibold text-[#172228]">{operation.title}</p>
                          <p className="mt-1 text-[12px] text-[#7f8d92]">{operation.subtitle}</p>
                        </div>
                        <span className={cn("shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold", toneClasses)}>
                          {formatDate(operation.occurredAt)}
                        </span>
                      </div>
                      <p className="mt-3 text-[14px] leading-7 text-[#56656b]">{operation.description}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <DirectorEmptyState message="لا توجد عمليات حديثة ضمن الفلاتر الحالية." />
            )}
          </DirectorSection>
        </div>
      </section>
    </div>
  );
}
