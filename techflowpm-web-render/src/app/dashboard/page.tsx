"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  X,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  Layers3,
  Pencil,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { apiClient } from "@/lib/api-client";
import { AUTH_BYPASS_ENABLED, BYPASS_USER } from "@/lib/config";
import { createProjectHubConnection } from "@/lib/signalr";
import { cn, getStatusTone, getTypeColor, percentage } from "@/lib/utils";
import { Button, Input, Select, TextArea } from "@/components/ui/primitives";
import { useAuthStore } from "@/store/auth-store";
import type { DashboardStats, ExecutiveUpdate, PagedResult, Project, ProjectDetail, Task, User } from "@/types/domain";

type ScheduleItem = {
  id: string;
  title: string;
  subtitle: string;
  time: string;
  timeMinutes: number | null;
  dateKey: string;
  accent: "teal" | "amber" | "coral";
  icon: "award" | "idea" | "audio";
  sortValue: number;
  note?: string;
  canDelete?: boolean;
  sourceId?: number;
};

type QuickTaskColor = "teal" | "amber" | "coral" | "slate";
type CalendarEventType = "meeting" | "delivery" | "call" | "other";

type DashboardPersonalTask = Task & {
  accentColor?: QuickTaskColor;
  projectLabel?: string;
  isQuickPersonal?: boolean;
};

type StoredQuickTask = {
  id: number;
  title: string;
  dueDate: string | null;
  color: QuickTaskColor;
  status: Task["status"];
  createdAt: string;
};

type StoredCalendarEvent = {
  id: number;
  title: string;
  dateKey: string;
  time: string;
  type: CalendarEventType;
  createdAt: string;
};

type AsideView = "calendar" | "updates" | "tasks";

type CalendarDayCell = {
  date: Date;
  dateKey: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
};

type ProjectManagerOption = User & {
  displayName: string;
};

const bookingTabs = [
  { key: "owned", label: "مشاريعي", icon: FolderKanban },
  { key: "adHoc", label: "مشاريع عرضيه", icon: Layers3 },
] as const;
const QUICK_TASK_STORAGE_KEY = "techflowpm-dashboard-quick-tasks";
const CALENDAR_EVENT_STORAGE_KEY = "techflowpm-dashboard-calendar-events";
const quickTaskColorOptions: Array<{
  key: QuickTaskColor;
  label: string;
  solid: string;
  soft: string;
  text: string;
}> = [
  { key: "teal", label: "فيروزي", solid: "#0d7573", soft: "#edf8f8", text: "#0d7573" },
  { key: "amber", label: "ذهبي", solid: "#f0b819", soft: "#fff8df", text: "#d89b09" },
  { key: "coral", label: "مرجاني", solid: "#ff8a69", soft: "#fff0ec", text: "#ef7c61" },
  { key: "slate", label: "رمادي", solid: "#64748b", soft: "#eef2f7", text: "#546276" },
];
const calendarEventTypeOptions: Array<{ key: CalendarEventType; label: string }> = [
  { key: "meeting", label: "اجتماع" },
  { key: "delivery", label: "تسليم" },
  { key: "call", label: "مكالمة" },
  { key: "other", label: "أخرى" },
];
const personalTaskStatusOptions: Array<{
  value: Task["status"];
  label: string;
  tone: string;
}> = [
  { value: "Todo", label: "جديدة", tone: "bg-[#edf8f8] text-[#0d7573]" },
  { value: "InProgress", label: "قيد التنفيذ", tone: "bg-[#fff8df] text-[#d89b09]" },
  { value: "Review", label: "مراجعة", tone: "bg-[#eef4ff] text-[#5c6bd8]" },
  { value: "Blocked", label: "توجد مشكلة", tone: "bg-[#fff0ec] text-[#ef7c61]" },
  { value: "Done", label: "منتهي", tone: "bg-[#eef1f2] text-[#7a8589]" },
];
const calendarHeader = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const calendarMonthLabels = [
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
const projectManagerDisplayNames: Record<string, string> = {
  "Fatma Al-Harthi": "طلال الراشدي",
  "Saeed Al-Balushi": "سعيد السلامي",
  "Aisha Al-Rawahi": "محمد النعماني",
  "Mohammed Al-Qahtani": "خالد البوسعيدي",
  "System Admin": "مدير النظام",
};
const calendarWeekdayLabels = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

const projectDepartments = [
  { id: 1, name: "قسم البرمجيات" },
  { id: 2, name: "قسم الشبكات" },
  { id: 3, name: "قسم الحماية" },
  { id: 4, name: "قسم الصيانة" },
];

function getInitialProjectForm(projectManagerId = 2) {
  return {
    title: "",
    documentNumber: "",
    description: "",
    type: "Software",
    status: "Planning",
    priority: "Medium",
    projectManagerId,
    responsibleDepartmentId: 1,
    beneficiaryDepartmentId: 1,
    budget: 0,
    actualCost: 0,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  };
}

function isProjectDetail(detail: ProjectDetail | null | undefined): detail is ProjectDetail {
  return Boolean(detail?.project && Array.isArray(detail.members) && Array.isArray(detail.recentUpdates));
}

function getDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDateKeyFromValue(value?: string | null) {
  return value ? value.slice(0, 10) : null;
}

function buildCalendarCells(month: Date): CalendarDayCell[] {
  const firstDayOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = new Date(firstDayOfMonth);
  gridStart.setDate(firstDayOfMonth.getDate() - firstDayOfMonth.getDay());

  const todayKey = getDateKey(new Date());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index);

    return {
      date,
      dateKey: getDateKey(date),
      dayNumber: date.getDate(),
      isCurrentMonth: date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear(),
      isToday: getDateKey(date) === todayKey,
    };
  });
}

function getCalendarDateLabel(date: Date) {
  return {
    month: calendarMonthLabels[date.getMonth()],
    weekday: calendarWeekdayLabels[date.getDay()],
    day: String(date.getDate()),
    year: String(date.getFullYear()),
  };
}

function getEventSortValue(value?: string | null, fallbackMinutes = 12 * 60) {
  if (!value || !value.includes("T")) {
    return fallbackMinutes;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallbackMinutes;
  }

  return parsed.getHours() * 60 + parsed.getMinutes();
}

function getExplicitEventMinutes(value?: string | null) {
  if (!value || !value.includes("T")) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const minutes = parsed.getHours() * 60 + parsed.getMinutes();
  if (minutes === 0) {
    return null;
  }

  return minutes;
}

function parseTimeValueToMinutes(value?: string | null) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) {
    return null;
  }

  const [hoursPart, minutesPart] = value.split(":");
  const hours = Number(hoursPart);
  const minutes = Number(minutesPart);

  if (Number.isNaN(hours) || Number.isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

function formatMinutesAsArabicTime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return new Intl.DateTimeFormat("ar-OM", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(2026, 0, 1, hours, mins));
}

function getTaskAccent(task: DashboardPersonalTask): ScheduleItem["accent"] {
  if (task.accentColor === "amber") return "amber";
  if (task.accentColor === "coral") return "coral";
  if (task.priority === "Critical") return "coral";
  if (task.priority === "High") return "amber";
  return "teal";
}

function getUpdateAccent(updateType: ExecutiveUpdate["updateType"]): ScheduleItem["accent"] {
  if (updateType === "Issue") return "coral";
  if (updateType === "Milestone") return "amber";
  return "teal";
}

function getProjectAccent(projectType: Project["type"]): ScheduleItem["accent"] {
  if (projectType === "Cybersecurity" || projectType === "Maintenance") {
    return "coral";
  }

  if (projectType === "Networks") {
    return "amber";
  }

  return "teal";
}

function translateUpdateType(updateType: ExecutiveUpdate["updateType"]) {
  return (
    {
      StatusUpdate: "تحديث حالة",
      Milestone: "منجز رئيسي",
      Issue: "مشكلة",
      Achievement: "إنجاز",
    }[updateType] ?? "تحديث"
  );
}

function translateTaskStatus(status: Task["status"]) {
  return (
    {
      Todo: "جديدة",
      InProgress: "قيد التنفيذ",
      Review: "مراجعة",
      Done: "منتهي",
      Blocked: "توجد مشكلة",
    }[status] ?? "مهمة"
  );
}

function getPersonalTaskStatusMeta(status: Task["status"]) {
  return personalTaskStatusOptions.find((option) => option.value === status) ?? personalTaskStatusOptions[0];
}

function translateCalendarEventType(type: CalendarEventType) {
  return (
    {
      meeting: "اجتماع",
      delivery: "تسليم",
      call: "مكالمة",
      other: "أخرى",
    }[type] ?? "أخرى"
  );
}

function getCalendarEventAppearance(type: CalendarEventType): Pick<ScheduleItem, "accent" | "icon"> {
  if (type === "delivery") {
    return { accent: "amber", icon: "idea" };
  }

  if (type === "call") {
    return { accent: "coral", icon: "audio" };
  }

  return { accent: "teal", icon: "award" };
}

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [asideView, setAsideView] = useState<AsideView>("calendar");
  const [isAsideCollapsed, setIsAsideCollapsed] = useState(false);
  const [activeBookingTab, setActiveBookingTab] = useState<(typeof bookingTabs)[number]["key"]>("owned");
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [projectForm, setProjectForm] = useState(() => getInitialProjectForm());
  const storedUser = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const [storedQuickTasks, setStoredQuickTasks] = useState<StoredQuickTask[]>([]);
  const [storedCalendarEvents, setStoredCalendarEvents] = useState<StoredCalendarEvent[]>([]);
  const [quickTasksReady, setQuickTasksReady] = useState(false);
  const [calendarEventsReady, setCalendarEventsReady] = useState(false);
  const [quickTaskTitle, setQuickTaskTitle] = useState("");
  const [quickTaskDueDate, setQuickTaskDueDate] = useState("");
  const [quickTaskColor, setQuickTaskColor] = useState<QuickTaskColor>("teal");
  const [isQuickTaskOptionsOpen, setIsQuickTaskOptionsOpen] = useState(false);
  const [executiveProjectId, setExecutiveProjectId] = useState("");
  const [executiveUpdateContent, setExecutiveUpdateContent] = useState("");
  const [calendarEventTitle, setCalendarEventTitle] = useState("");
  const [calendarEventType, setCalendarEventType] = useState<CalendarEventType>("meeting");
  const [calendarEventTime, setCalendarEventTime] = useState("09:00");
  const [isCalendarEventComposerOpen, setIsCalendarEventComposerOpen] = useState(false);
  const [isExecutiveComposerOpen, setIsExecutiveComposerOpen] = useState(false);
  const [isQuickTaskComposerOpen, setIsQuickTaskComposerOpen] = useState(false);
  const [isDashboardContentScrolled, setIsDashboardContentScrolled] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => new Date());

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
              name: "مستخدم النظام",
              role: "Viewer" as const,
              avatar: null,
            },
    [storedUser],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const stored = window.localStorage.getItem(QUICK_TASK_STORAGE_KEY);
      if (stored) {
        setStoredQuickTasks(parseStoredQuickTasks(stored));
      }
    } catch {
    } finally {
      setQuickTasksReady(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const stored = window.localStorage.getItem(CALENDAR_EVENT_STORAGE_KEY);
      if (stored) {
        setStoredCalendarEvents(parseStoredCalendarEvents(stored));
      }
    } catch {
    } finally {
      setCalendarEventsReady(true);
    }
  }, []);

  useEffect(() => {
    if (!quickTasksReady || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(QUICK_TASK_STORAGE_KEY, JSON.stringify(storedQuickTasks));
  }, [storedQuickTasks, quickTasksReady]);

  useEffect(() => {
    if (!calendarEventsReady || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(CALENDAR_EVENT_STORAGE_KEY, JSON.stringify(storedCalendarEvents));
  }, [calendarEventsReady, storedCalendarEvents]);

  const statsQuery = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () =>
      apiClient.get<DashboardStats>("/projects/stats").then((response) => response.data),
  });

  const projectsQuery = useQuery({
    queryKey: ["dashboard-projects-preview"],
    queryFn: () =>
      apiClient
        .get<PagedResult<Project>>("/projects", { page: 1, pageSize: 100 })
        .then((response) => response.data),
  });

  const allProjects = useMemo(() => projectsQuery.data?.items ?? [], [projectsQuery.data?.items]);

  useEffect(() => {
    if (!executiveProjectId && allProjects[0]?.id) {
      setExecutiveProjectId(String(allProjects[0].id));
    }
  }, [allProjects, executiveProjectId]);

  const usersQuery = useQuery({
    queryKey: ["users", "dashboard-project-drawer"],
    queryFn: () =>
      apiClient
        .get<PagedResult<User>>("/users", { page: 1, pageSize: 100 })
        .then((response) => response.data),
  });

  const projectManagers = useMemo<ProjectManagerOption[]>(
    () =>
      (usersQuery.data?.items ?? [])
        .filter((user) => user.role !== "Admin")
        .map((user) => ({
          ...user,
          displayName: projectManagerDisplayNames[user.name] ?? user.name,
        })),
    [usersQuery.data?.items],
  );

  const projectDetailQueries = useQueries({
    queries: allProjects.map((project) => ({
      queryKey: ["dashboard-project-detail", project.id],
      queryFn: async () => {
        try {
          return await apiClient
            .get<ProjectDetail>(`/projects/${project.id}`)
            .then((response) => response.data);
        } catch {
          return null;
        }
      },
      staleTime: 60_000,
    })),
  });

  const previewProjectIds = useMemo(
    () => allProjects.slice(0, 3).map((project) => project.id),
    [allProjects],
  );

  const previewTaskQueries = useQueries({
    queries: previewProjectIds.map((projectId) => ({
      queryKey: ["dashboard-project-tasks", projectId],
      queryFn: () =>
        apiClient
          .get<Task[]>(`/projects/${projectId}/tasks`)
          .then((response) => response.data)
          .catch(() => []),
      staleTime: 60_000,
    })),
  });

  useEffect(() => {
    if (!token || allProjects.length === 0) {
      return;
    }

    const connection = createProjectHubConnection(token);
    let mounted = true;

    connection.on("task:statusChanged", (payload: { projectId: number }) => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard-project-tasks", payload.projectId] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-project-detail", payload.projectId] });
      void queryClient.invalidateQueries({ queryKey: ["project-detail", payload.projectId] });
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    });

    connection.on("project:updateAdded", (update: ExecutiveUpdate) => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard-project-detail", update.projectId] });
      void queryClient.invalidateQueries({ queryKey: ["project-detail", update.projectId] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    });

    void connection
      .start()
      .then(async () => {
        if (mounted) {
          await Promise.all(allProjects.map((project) => connection.invoke("JoinProject", project.id)));
        }
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
      void Promise.all(allProjects.map((project) => connection.invoke("LeaveProject", project.id).catch(() => undefined)))
        .finally(() => {
          void connection.stop();
        });
    };
  }, [allProjects, queryClient, token]);

  const calendarHeading = useMemo(() => getCalendarDateLabel(selectedCalendarDate), [selectedCalendarDate]);
  const calendarMonthHeading = useMemo(() => getCalendarDateLabel(calendarMonth), [calendarMonth]);
  const calendarDays = useMemo(() => buildCalendarCells(calendarMonth), [calendarMonth]);
  const selectedCalendarDateKey = useMemo(() => getDateKey(selectedCalendarDate), [selectedCalendarDate]);

  const projectTitleMap = useMemo(
    () => new Map(allProjects.map((project) => [project.id, project.title])),
    [allProjects],
  );

  const projectMembersMap = useMemo(
    () =>
      new Map(
        projectDetailQueries
          .map((query) => query.data)
          .filter(isProjectDetail)
          .map((detail) => [detail.project.id, detail.members]),
      ),
    [projectDetailQueries],
  );

  const executiveUpdates = useMemo<ExecutiveUpdate[]>(
    () => (statsQuery.data?.recentUpdates ?? []).slice(0, 5),
    [statsQuery.data?.recentUpdates],
  );

  const asideTabs = useMemo(
    () => [
      { key: "calendar" as const, label: "التقويم", icon: CalendarDays },
      { key: "updates" as const, label: "الموقف التنفيذي", icon: Sparkles },
      { key: "tasks" as const, label: "المهام الشخصية", icon: Pencil },
    ],
    [],
  );

  const activeAsideTab = useMemo(
    () => asideTabs.find((tab) => tab.key === asideView) ?? asideTabs[0],
    [asideTabs, asideView],
  );
  const ActiveAsideIcon = activeAsideTab.icon;

  const projectPersonalTasks = useMemo<DashboardPersonalTask[]>(() => {
    return previewTaskQueries
      .flatMap((query) => query.data ?? [])
      .sort(sortPersonalTasks)
      .slice(0, 6);
  }, [previewTaskQueries]);

  const quickPersonalTasks = useMemo<DashboardPersonalTask[]>(
    () => storedQuickTasks.map((task) => toDashboardPersonalTask(task, currentUser.name, currentUser.id)),
    [storedQuickTasks, currentUser.id, currentUser.name],
  );

  const personalTasks = useMemo<DashboardPersonalTask[]>(
    () => [...quickPersonalTasks, ...projectPersonalTasks].sort(sortPersonalTasks),
    [projectPersonalTasks, quickPersonalTasks],
  );

  const scheduleItems = useMemo<ScheduleItem[]>(() => {
    const projectEvents = allProjects.flatMap((project) => {
      const items: ScheduleItem[] = [];
      const startDateKey = getDateKeyFromValue(project.startDate);
      const endDateKey = getDateKeyFromValue(project.endDate);
      const accent = getProjectAccent(project.type);

      if (startDateKey) {
        const timeMinutes = getExplicitEventMinutes(project.startDate);
        items.push({
          id: `project-start-${project.id}`,
          title: project.title,
          subtitle: "بداية المشروع",
          time: timeMinutes !== null ? formatMinutesAsArabicTime(timeMinutes) : "طوال اليوم",
          timeMinutes,
          dateKey: startDateKey,
          accent,
          icon: "award",
          sortValue: timeMinutes ?? getEventSortValue(project.startDate, 9 * 60),
          note: project.responsibleDepartmentName ?? undefined,
        });
      }

      if (endDateKey) {
        const timeMinutes = getExplicitEventMinutes(project.endDate);
        items.push({
          id: `project-end-${project.id}`,
          title: project.title,
          subtitle: "الموعد المخطط للانتهاء",
          time: timeMinutes !== null ? formatMinutesAsArabicTime(timeMinutes) : "طوال اليوم",
          timeMinutes,
          dateKey: endDateKey,
          accent: project.status === "Completed" ? "teal" : "amber",
          icon: "award",
          sortValue: timeMinutes ?? getEventSortValue(project.endDate, 17 * 60),
          note: `نسبة الإنجاز ${project.progressPercent}%`,
        });
      }

      return items;
    });

    const taskEvents = personalTasks.flatMap((task) => {
      const dateKey = getDateKeyFromValue(task.dueDate);
      if (!dateKey) {
        return [];
      }

      return [
        {
          id: `task-${task.id}`,
          title: task.title,
          subtitle: task.projectLabel ?? projectTitleMap.get(task.projectId) ?? "مهمة شخصية",
          time: (() => {
            const timeMinutes = getExplicitEventMinutes(task.dueDate);
            return timeMinutes !== null ? formatMinutesAsArabicTime(timeMinutes) : "طوال اليوم";
          })(),
          timeMinutes: getExplicitEventMinutes(task.dueDate),
          dateKey,
          accent: getTaskAccent(task),
          icon: "idea" as const,
          sortValue: getExplicitEventMinutes(task.dueDate) ?? getEventSortValue(task.dueDate, 11 * 60),
          note: task.status === "Todo" ? "مهمة جديدة" : translateTaskStatus(task.status),
        },
      ];
    });

    const updateEvents = executiveUpdates.flatMap((update) => {
      const dateKey = getDateKeyFromValue(update.createdAt);
      if (!dateKey) {
        return [];
      }

      return [
        {
          id: `update-${update.id}`,
          title: projectTitleMap.get(update.projectId) ?? `مشروع #${update.projectId}`,
          subtitle: translateUpdateType(update.updateType),
          time: (() => {
            const timeMinutes = getExplicitEventMinutes(update.createdAt);
            return timeMinutes !== null ? formatMinutesAsArabicTime(timeMinutes) : "طوال اليوم";
          })(),
          timeMinutes: getExplicitEventMinutes(update.createdAt),
          dateKey,
          accent: getUpdateAccent(update.updateType),
          icon: "audio" as const,
          sortValue: getExplicitEventMinutes(update.createdAt) ?? getEventSortValue(update.createdAt, 14 * 60),
          note: update.content,
        },
      ];
    });

    const customCalendarEvents = storedCalendarEvents.map((event) => {
      const appearance = getCalendarEventAppearance(event.type);
      const timeMinutes = parseTimeValueToMinutes(event.time) ?? 9 * 60;

      return {
        id: `calendar-${event.id}`,
        title: event.title,
        subtitle: translateCalendarEventType(event.type),
        time: formatMinutesAsArabicTime(timeMinutes),
        timeMinutes,
        dateKey: event.dateKey,
        accent: appearance.accent,
        icon: appearance.icon,
        sortValue: timeMinutes,
        note: "حدث مخصص تمت إضافته من التقويم",
        canDelete: true,
        sourceId: event.id,
      } satisfies ScheduleItem;
    });

    return [...projectEvents, ...taskEvents, ...updateEvents, ...customCalendarEvents].sort((left, right) => {
      return left.dateKey.localeCompare(right.dateKey) || left.sortValue - right.sortValue || left.title.localeCompare(right.title);
    });
  }, [allProjects, executiveUpdates, personalTasks, projectTitleMap, storedCalendarEvents]);

  const calendarEventsByDay = useMemo(() => {
    return scheduleItems.reduce((map, item) => {
      const current = map.get(item.dateKey) ?? [];
      current.push(item);
      map.set(item.dateKey, current);
      return map;
    }, new Map<string, ScheduleItem[]>());
  }, [scheduleItems]);

  const selectedDateEvents = useMemo(
    () => calendarEventsByDay.get(selectedCalendarDateKey) ?? [],
    [calendarEventsByDay, selectedCalendarDateKey],
  );

  const timelineStartMinutes = 6 * 60;
  const timelineEndMinutes = 16 * 60;

  const timedSelectedDateEvents = useMemo(
    () =>
      selectedDateEvents.filter(
        (item) => item.timeMinutes !== null && item.timeMinutes >= timelineStartMinutes && item.timeMinutes <= timelineEndMinutes,
      ),
    [selectedDateEvents, timelineEndMinutes, timelineStartMinutes],
  );

  const untimedSelectedDateEvents = useMemo(
    () =>
      selectedDateEvents.filter(
        (item) => item.timeMinutes === null || item.timeMinutes < timelineStartMinutes || item.timeMinutes > timelineEndMinutes,
      ),
    [selectedDateEvents, timelineEndMinutes, timelineStartMinutes],
  );

  const timelineSlots = useMemo(
    () =>
      Array.from({ length: timelineEndMinutes / 60 - timelineStartMinutes / 60 + 1 }, (_, index) => timelineStartMinutes + index * 60),
    [timelineEndMinutes, timelineStartMinutes],
  );

  const tasksLoading = previewTaskQueries.some((query) => query.isLoading);
  const defaultProjectManagerId = useMemo(
    () =>
      projectManagers[0]?.id ??
      usersQuery.data?.items[0]?.id ??
      2,
    [projectManagers, usersQuery.data?.items],
  );

  useEffect(() => {
    if (!isCreateProjectOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isCreateProjectOpen]);

  const openCreateProjectDrawer = () => {
    setProjectForm(getInitialProjectForm(defaultProjectManagerId));
    createProjectMutation.reset();
    setIsCreateProjectOpen(true);
  };

  const closeCreateProjectDrawer = () => {
    setIsCreateProjectOpen(false);
    createProjectMutation.reset();
  };

  const handleCalendarMonthChange = (offset: number) => {
    setCalendarMonth((currentMonth) => {
      const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1);

      setSelectedCalendarDate((currentDate) => {
        const maxDay = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
        return new Date(nextMonth.getFullYear(), nextMonth.getMonth(), Math.min(currentDate.getDate(), maxDay));
      });

      return nextMonth;
    });
  };

  const handleCalendarDateSelect = (date: Date) => {
    setSelectedCalendarDate(date);

    if (date.getMonth() !== calendarMonth.getMonth() || date.getFullYear() !== calendarMonth.getFullYear()) {
      setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    }
  };

  const resetQuickTaskComposer = () => {
    setQuickTaskTitle("");
    setQuickTaskDueDate("");
    setQuickTaskColor("teal");
    setIsQuickTaskOptionsOpen(false);
  };

  const resetCalendarEventComposer = () => {
    setCalendarEventTitle("");
    setCalendarEventType("meeting");
    setCalendarEventTime("09:00");
  };

  const handleAddQuickTask = () => {
    const trimmedTitle = quickTaskTitle.trim();

    if (!trimmedTitle) {
      return;
    }

    setStoredQuickTasks((current) => [
      {
        id: Date.now(),
        title: trimmedTitle,
        dueDate: quickTaskDueDate || null,
        color: quickTaskColor,
        status: "Todo",
        createdAt: new Date().toISOString(),
      },
      ...current,
    ]);

    resetQuickTaskComposer();
  };

  const handleAddCalendarEvent = () => {
    const trimmedTitle = calendarEventTitle.trim();
    const timeMinutes = parseTimeValueToMinutes(calendarEventTime);

    if (!trimmedTitle || timeMinutes === null) {
      return;
    }

    setStoredCalendarEvents((current) => [
      {
        id: Date.now(),
        title: trimmedTitle,
        dateKey: selectedCalendarDateKey,
        time: calendarEventTime,
        type: calendarEventType,
        createdAt: new Date().toISOString(),
      },
      ...current,
    ]);

    resetCalendarEventComposer();
  };

  const handleDeleteCalendarEvent = (eventId: number) => {
    if (typeof window !== "undefined" && !window.confirm("هل أنت متأكد من حذف هذا الحدث؟")) {
      return;
    }

    setStoredCalendarEvents((current) => current.filter((event) => event.id !== eventId));
  };

  const addExecutiveUpdateMutation = useMutation({
    mutationFn: () =>
      apiClient.post<ExecutiveUpdate>(`/projects/${Number(executiveProjectId)}/updates`, {
        content: executiveUpdateContent.trim(),
        updateType: "StatusUpdate",
      }),
    onSuccess: async () => {
      setExecutiveUpdateContent("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-project-detail", Number(executiveProjectId)] }),
      ]);
    },
  });

  const deleteExecutiveUpdateMutation = useMutation({
    mutationFn: ({ projectId, updateId }: { projectId: number; updateId: number }) =>
      apiClient.delete(`/projects/${projectId}/updates/${updateId}`),
    onSuccess: async (_response, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-project-detail", variables.projectId] }),
        queryClient.invalidateQueries({ queryKey: ["project-updates", variables.projectId] }),
        queryClient.invalidateQueries({ queryKey: ["project-detail", variables.projectId] }),
      ]);
    },
  });

  const updatePersonalTaskStatusMutation = useMutation({
    mutationFn: ({
      taskId,
      status,
    }: {
      taskId: number;
      projectId: number;
      status: Task["status"];
    }) => apiClient.patch(`/tasks/${taskId}/status`, { status }),
    onMutate: async ({ taskId, projectId, status }) => {
      await queryClient.cancelQueries({ queryKey: ["dashboard-project-tasks", projectId] });

      const previousTasks = queryClient.getQueryData<Task[]>(["dashboard-project-tasks", projectId]);

      queryClient.setQueryData<Task[]>(["dashboard-project-tasks", projectId], (currentTasks) =>
        currentTasks?.map((task) => (task.id === taskId ? { ...task, status } : task)) ?? currentTasks,
      );

      return { previousTasks };
    },
    onError: (_error, variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(["dashboard-project-tasks", variables.projectId], context.previousTasks);
      }
    },
    onSuccess: async (_response, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard-project-tasks", variables.projectId] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-project-detail", variables.projectId] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] }),
      ]);
    },
  });

  const deletePersonalTaskMutation = useMutation({
    mutationFn: ({ taskId }: { taskId: number; projectId: number }) => apiClient.delete(`/tasks/${taskId}`),
    onMutate: async ({ taskId, projectId }) => {
      await queryClient.cancelQueries({ queryKey: ["dashboard-project-tasks", projectId] });

      const previousTasks = queryClient.getQueryData<Task[]>(["dashboard-project-tasks", projectId]);

      queryClient.setQueryData<Task[]>(["dashboard-project-tasks", projectId], (currentTasks) =>
        currentTasks?.filter((task) => task.id !== taskId) ?? currentTasks,
      );

      return { previousTasks };
    },
    onError: (_error, variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(["dashboard-project-tasks", variables.projectId], context.previousTasks);
      }
    },
    onSuccess: async (_response, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard-project-tasks", variables.projectId] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-project-detail", variables.projectId] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] }),
      ]);
    },
  });

  const handlePersonalTaskStatusChange = (task: DashboardPersonalTask, status: Task["status"]) => {
    if (task.status === status) {
      return;
    }

    if (task.isQuickPersonal) {
      setStoredQuickTasks((currentTasks) =>
        currentTasks.map((storedTask) => (storedTask.id === task.id ? { ...storedTask, status } : storedTask)),
      );
      return;
    }

    updatePersonalTaskStatusMutation.mutate({
      taskId: task.id,
      projectId: task.projectId,
      status,
    });
  };

  const handlePersonalTaskDelete = (task: DashboardPersonalTask) => {
    if (typeof window !== "undefined" && !window.confirm("هل أنت متأكد من حذف هذه المهمة؟")) {
      return;
    }

    if (task.isQuickPersonal) {
      setStoredQuickTasks((currentTasks) => currentTasks.filter((storedTask) => storedTask.id !== task.id));
      return;
    }

    deletePersonalTaskMutation.mutate({
      taskId: task.id,
      projectId: task.projectId,
    });
  };

  const handleExecutiveUpdateDelete = (update: ExecutiveUpdate) => {
    if (typeof window !== "undefined" && !window.confirm("هل أنت متأكد من حذف هذا الموقف التنفيذي؟")) {
      return;
    }

    deleteExecutiveUpdateMutation.mutate({
      projectId: update.projectId,
      updateId: update.id,
    });
  };

  const createProjectMutation = useMutation({
    mutationFn: () => apiClient.post<ProjectDetail>("/projects", projectForm),
    onSuccess: async () => {
      closeCreateProjectDrawer();
      setProjectForm(getInitialProjectForm(defaultProjectManagerId));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard-projects-preview"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] }),
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
      ]);
    },
  });

  return (
    <div dir="ltr" className="h-screen overflow-hidden bg-[#f7fbfb]">
      <div className="flex h-screen w-full overflow-hidden bg-[#f7fbfb]">
        <section
          className="m-2 h-[calc(100vh-1rem)] min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-[34px] bg-[#eef7f8] px-5 pb-6 sm:px-6 lg:px-8 lg:pb-8"
          onScroll={(event) => {
            const isScrolled = event.currentTarget.scrollTop > 8;
            setIsDashboardContentScrolled((current) => (current === isScrolled ? current : isScrolled));
          }}
        >
          <header
            dir="rtl"
            className={cn(
              "sticky top-3 z-30 mt-3 flex items-center justify-between rounded-[30px] px-5 py-4 transition-all duration-300",
              isDashboardContentScrolled
                ? "border border-white/80 bg-white/76 shadow-[0_22px_48px_-36px_rgba(12,54,58,0.34)] backdrop-blur-xl"
                : "bg-transparent shadow-none backdrop-blur-0",
            )}
          >
            <button
              type="button"
              onClick={() => setIsAsideCollapsed((current) => !current)}
              title={isAsideCollapsed ? "توسيع اللوحة الجانبية" : "تقليص اللوحة الجانبية"}
              aria-label={isAsideCollapsed ? "توسيع اللوحة الجانبية" : "تقليص اللوحة الجانبية"}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#0d7573] shadow-[0_18px_30px_-26px_rgba(10,76,74,0.28)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#f7fbfb]"
            >
              <span className="flex items-center gap-0.5">
                <ChevronRight className="h-3.5 w-3.5" />
                <ChevronLeft className="h-3.5 w-3.5" />
              </span>
            </button>
            <div className="flex items-center gap-3 text-[#28383d]">
              <Link
                href="/director"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-white px-4 text-[13px] font-semibold text-[#173036] shadow-[0_18px_30px_-26px_rgba(10,76,74,0.28)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#f7fbfb]"
              >
                <Sparkles className="h-4 w-4 text-[#f0b819]" />
                رئيس الدائرة
              </Link>
              <Link
                href="/admin"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-white px-4 text-[13px] font-semibold text-[#0d7573] shadow-[0_18px_30px_-26px_rgba(10,76,74,0.28)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#f7fbfb]"
              >
                <ShieldCheck className="h-4 w-4" />
                الإدارة
              </Link>
              <Link
                href="/timeline"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-white px-4 text-[13px] font-semibold text-[#0d7573] shadow-[0_18px_30px_-26px_rgba(10,76,74,0.28)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#f7fbfb]"
              >
                <CalendarDays className="h-4 w-4" />
                الجدول الزمني
              </Link>
              <Button
                size="sm"
                className="h-10 rounded-full bg-[#0d7573] px-4 text-[13px] font-semibold text-white shadow-[0_20px_36px_-24px_rgba(13,117,115,0.7)] hover:bg-[#0b6664]"
                onClick={openCreateProjectDrawer}
              >
                <Plus className="h-4 w-4" />
                إضافة مشروع
              </Button>
            </div>
          </header>

          <div dir="rtl" className="mt-12 flex w-full flex-col items-start gap-5 text-right">
            <div className="flex w-full flex-col items-start text-right">
              <div className="self-start">
                <ProfileAvatar name={currentUser.name} avatar={currentUser.avatar} />
              </div>
              <div className="mt-5 self-start text-right">
                <p className="text-[18px] font-semibold text-[#173036]">{currentUser.name}</p>
                <p className="mt-1 text-[14px] text-[#7a8a8f]">{translateUserRole(currentUser.role)}</p>
              </div>
            </div>
          </div>

          <section className="mt-10" dir="rtl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-col items-end gap-5 text-right">
                <div className="w-full max-w-[360px] text-right">
                  <div className="min-w-0 flex-1 rounded-[22px] bg-[#f4f7f8]/90 p-1.5 backdrop-blur">
                    <div className="grid grid-cols-2 gap-2">
                      {bookingTabs.map((tab) => {
                        const Icon = tab.icon;

                        return (
                          <button
                            key={tab.key}
                            type="button"
                            onClick={() => setActiveBookingTab(tab.key)}
                            className={cn(
                              "flex min-w-0 items-center justify-center gap-1.5 rounded-[18px] px-2 py-2.5 text-[11px] leading-none transition-all md:px-3 md:text-[12px]",
                              activeBookingTab === tab.key
                                ? "bg-white font-bold text-[#0d7573] shadow-[0_20px_35px_-28px_rgba(10,76,74,0.45)]"
                                : "font-medium text-[#7c8f91]",
                            )}
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            <span className="whitespace-nowrap">{tab.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="w-full max-w-[560px]">
                <h2 className="text-[28px] font-semibold tracking-[-0.04em] text-[#12262b]">
                  {activeBookingTab === "owned" ? "قائمة مشاريعي" : "قائمة المشاريع العرضية"}
                </h2>
                <p className="mt-1 text-[14px] text-[#748489]">
                  {activeBookingTab === "owned"
                    ? "جميع المشاريع الحالية مع نسبة الإنجاز وأعضاء كل مشروع"
                    : "عرض المشاريع العرضية الحالية بنفس البطاقات لسهولة المتابعة السريعة."}
                </p>
                </div>
              </div>
              <div className="inline-flex items-center rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-[#0d7573] shadow-[0_18px_30px_-26px_rgba(10,76,74,0.34)]">
                {allProjects.length} مشروع
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.08 }}
              className="mt-6 grid gap-5 lg:grid-cols-2 2xl:grid-cols-3"
            >
              {projectsQuery.isLoading
                ? Array.from({ length: 6 }).map((_, index) => <ProjectCardSkeleton key={index} />)
                : allProjects.map((project) => (
                    <ProjectOverviewCard
                      key={project.id}
                      project={project}
                      members={projectMembersMap.get(project.id) ?? []}
                    />
                  ))}
            </motion.div>
          </section>

        </section>

        <aside
          className={cn(
            "relative m-2 h-[calc(100vh-1rem)] w-full max-w-[520px] overflow-y-auto overscroll-contain rounded-[34px] border border-[#eff3f4] bg-white px-6 pb-8 shadow-[0_28px_70px_-52px_rgba(12,54,58,0.35)] transition-[max-width,padding] duration-300 ease-out sm:px-7 lg:px-8",
            isAsideCollapsed && "max-w-[96px] px-3 pb-4 sm:px-3 lg:px-3",
          )}
        >
          <div
            className={cn(
              "sticky top-0 z-30 bg-transparent pb-0 pt-7 shadow-none backdrop-blur-0 transition-all duration-300",
              isAsideCollapsed ? "-mx-3 px-3" : "-mx-6 px-6 sm:-mx-7 sm:px-7 lg:-mx-8 lg:px-8",
            )}
          >
            <div className={cn("flex items-start gap-2", isAsideCollapsed && "flex-col items-center")}>
              {!isAsideCollapsed ? (
                <div className="min-w-0 flex-1 rounded-[22px] bg-[#f4f7f8]/90 p-1.5 backdrop-blur">
                  <div className="grid grid-cols-3 gap-1.5">
                    {asideTabs.map((tab) => {
                      const Icon = tab.icon;

                      return (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setAsideView(tab.key)}
                          className={cn(
                            "flex min-w-0 items-center justify-center gap-1.5 rounded-[18px] px-2 py-2.5 text-[11px] leading-none transition-all md:px-3 md:text-[12px]",
                            asideView === tab.key
                              ? "bg-white font-bold text-[#0d7573] shadow-[0_20px_35px_-28px_rgba(10,76,74,0.45)]"
                              : "font-medium text-[#7c8f91]",
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="hidden whitespace-nowrap md:inline">{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {isAsideCollapsed ? (
                <div className="grid h-12 w-12 place-items-center rounded-[20px] bg-[#f4f7f8] text-[#0d7573] shadow-[0_20px_35px_-28px_rgba(10,76,74,0.18)]">
                  <ActiveAsideIcon className="h-5 w-5" />
                </div>
              ) : null}
            </div>
          </div>

          {!isAsideCollapsed && asideView === "calendar" ? (
            <>
              <div className="mt-8 flex items-center justify-between">
                <div>
                  <h2 className="text-[26px] font-semibold tracking-[-0.05em] text-[#1d2747] lg:text-[28px]">
                    {calendarMonthHeading.month} {calendarMonthHeading.year}
                  </h2>
                  <p className="mt-1 text-[13px] text-[#7c8793]">
                    {calendarHeading.weekday}، {calendarHeading.day} {calendarHeading.month}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-[#8a9098]">
                  <button
                    type="button"
                    onClick={() => handleCalendarMonthChange(-1)}
                    className="grid h-9 w-9 place-items-center rounded-full transition hover:bg-[#f4f7f8] hover:text-[#11272c]"
                    aria-label="الشهر السابق"
                  >
                    <ChevronLeft className="h-7 w-7" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCalendarMonthChange(1)}
                    className="grid h-9 w-9 place-items-center rounded-full transition hover:bg-[#f4f7f8] hover:text-[#11272c]"
                    aria-label="الشهر التالي"
                  >
                    <ChevronRight className="h-7 w-7" />
                  </button>
                </div>
              </div>

              <div dir="rtl" className="mt-6 grid grid-cols-7 gap-y-1 text-center">
                {calendarHeader.map((label) => (
                  <span key={label} className="text-[11px] font-bold tracking-[-0.01em] text-[#26363a]">
                    {label}
                  </span>
                ))}

                {calendarDays.map((day) => {
                  const dayEvents = calendarEventsByDay.get(day.dateKey) ?? [];
                  const eventAccents = [...new Set(dayEvents.map((item) => item.accent))].slice(0, 3);
                  const primaryAccent = dayEvents[0]?.accent ?? "teal";
                  const isSelected = day.dateKey === selectedCalendarDateKey;

                  return (
                    <button
                      key={day.dateKey}
                      type="button"
                      onClick={() => handleCalendarDateSelect(day.date)}
                      className={cn(
                        "relative mx-auto flex h-[42px] w-[42px] items-center justify-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d7573]",
                        !day.isCurrentMonth && "opacity-60",
                      )}
                    >
                      <span
                        className={cn(
                          "relative z-10 grid h-[38px] w-[38px] place-items-center rounded-full text-[13px] font-medium transition-all",
                          isSelected && "font-bold",
                          isSelected && primaryAccent === "teal" && "bg-[#0d7573] text-white shadow-[0_16px_28px_-18px_rgba(13,117,115,0.55)]",
                          isSelected && primaryAccent === "amber" && "bg-[#fec71a] text-white shadow-[0_16px_28px_-18px_rgba(240,184,25,0.5)]",
                          isSelected && primaryAccent === "coral" && "bg-[#ff8a69] text-white shadow-[0_16px_28px_-18px_rgba(255,138,105,0.48)]",
                          !isSelected && day.isToday && "border border-[#0d7573] bg-[#edf8f8] text-[#0d7573]",
                          !isSelected && day.isCurrentMonth && "text-[#63686f]",
                          !isSelected && !day.isCurrentMonth && "text-[#b7c0c5]",
                        )}
                      >
                        {day.dayNumber}
                      </span>

                      {!isSelected && eventAccents.length > 0 ? (
                        <span className="absolute bottom-0 flex items-center gap-0.5">
                          {eventAccents.map((accent) => (
                            <span
                              key={`${day.dateKey}-${accent}`}
                              className={cn(
                                "h-1 w-1 rounded-full",
                                accent === "teal" && "bg-[#0d7573]",
                                accent === "amber" && "bg-[#f0b819]",
                                accent === "coral" && "bg-[#ff8a69]",
                              )}
                            />
                          ))}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              <div className="mt-8 flex min-h-[520px] flex-col border-t border-[#eff3f4] pt-6">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-[18px] font-semibold text-[#15242a]">أجندة اليوم</h3>
                    <p className="mt-1 text-[13px] text-[#849095]">
                      {calendarHeading.weekday}، {calendarHeading.day} {calendarHeading.month}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#f4f7f8] px-3 py-1 text-[12px] font-semibold text-[#617278]">
                    {selectedDateEvents.length} حدث
                  </span>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto pe-1">
                  {selectedDateEvents.length > 0 ? (
                    <div className="space-y-4">
                      {untimedSelectedDateEvents.length > 0 ? (
                        <div className="space-y-3 rounded-[20px] border border-dashed border-[#dce6e7] bg-white px-4 py-4">
                          <p className="text-right text-[12px] font-semibold text-[#6a7b80]">أحداث بدون وقت محدد</p>
                          <div className="space-y-3">
                            {untimedSelectedDateEvents.map((item) => (
                              <ScheduleCard key={item.id} item={item} />
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <div className="px-0 py-1">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-[13px] font-semibold text-[#15242a]">الجدول الزمني</p>
                          <span className="text-[11px] font-medium text-[#7a8a8f]">06:00 - 16:00</span>
                        </div>

                        <div className="space-y-0">
                          {timelineSlots.map((slotMinutes, index) => {
                            const slotEnd = slotMinutes + 60;
                            const slotEvents = timedSelectedDateEvents.filter((item) => {
                              if (item.timeMinutes === null) {
                                return false;
                              }

                              if (index === timelineSlots.length - 1) {
                                return item.timeMinutes >= slotMinutes && item.timeMinutes <= slotEnd;
                              }

                              return item.timeMinutes >= slotMinutes && item.timeMinutes < slotEnd;
                            });

                            return (
                              <div
                                key={slotMinutes}
                                className="grid grid-cols-[48px_1fr] items-center gap-2 py-1.5"
                              >
                                <div className="text-[11px] font-semibold leading-none text-[#6f7d83]">
                                  {formatMinutesAsArabicTime(slotMinutes)}
                                </div>

                                <div className="space-y-2">
                                  {slotEvents.length > 0 ? (
                                    <>
                                      <div className="space-y-2">
                                        <div className="h-px w-full bg-[#e6eeef]" />
                                        <div className="w-full max-w-[320px]">
                                          <ScheduleCard
                                            item={slotEvents[0]}
                                            onDelete={
                                              slotEvents[0].canDelete && slotEvents[0].sourceId
                                                ? () => handleDeleteCalendarEvent(slotEvents[0].sourceId!)
                                                : undefined
                                            }
                                          />
                                        </div>
                                      </div>

                                      {slotEvents.length > 1 ? (
                                        <div className="ms-auto w-full max-w-[320px] space-y-2">
                                          {slotEvents.slice(1).map((item) => (
                                            <ScheduleCard
                                              key={item.id}
                                              item={item}
                                              onDelete={
                                                item.canDelete && item.sourceId
                                                  ? () => handleDeleteCalendarEvent(item.sourceId!)
                                                  : undefined
                                              }
                                            />
                                          ))}
                                        </div>
                                      ) : null}
                                    </>
                                  ) : (
                                    <div className="h-px w-full bg-[#e6eeef]" />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <EmptyPanelState
                      title="لا توجد أحداث في هذا اليوم"
                      description="اختر يوماً آخر أو أضف بيانات مشاريع ومهام ليظهر الجدول هنا."
                    />
                  )}
                </div>

                <div
                  className={cn(
                    "sticky bottom-0 z-20 -mx-6 mt-auto w-auto shrink-0 px-6 pb-0 pt-9 backdrop-blur-xl sm:-mx-7 sm:px-7 lg:-mx-8 lg:px-8",
                    isCalendarEventComposerOpen
                      ? "bg-[linear-gradient(180deg,#ffffff00_0%,#ffffffe6_34%,#fffffff7_100%)]"
                      : "bg-transparent",
                  )}
                >
                  <div className="pointer-events-none absolute inset-x-0 -top-10 h-10 bg-[linear-gradient(180deg,#ffffff00_0%,#ffffffe8_100%)] backdrop-blur-sm" />
                  <button
                    type="button"
                    onClick={() => setIsCalendarEventComposerOpen((current) => !current)}
                    className="group relative z-10 flex w-full flex-row-reverse items-center justify-between gap-4 rounded-[22px] border border-transparent bg-[#f4f7f8]/90 px-4 py-3 text-right backdrop-blur transition duration-300 ease-out hover:-translate-y-0.5 hover:scale-[1.01] hover:border-[#dce7e8] hover:bg-[#eef4f5]/95 hover:shadow-[0_18px_34px_-28px_rgba(12,54,58,0.28)] active:translate-y-0 active:scale-[0.995]"
                    aria-expanded={isCalendarEventComposerOpen}
                  >
                    <div>
                      <h3 className="text-[18px] font-semibold text-[#15242a]">إضافة حدث</h3>
                      <p className="mt-1 text-[12px] text-[#849095]">
                        {calendarHeading.weekday}، {calendarHeading.day} {calendarHeading.month}
                      </p>
                    </div>
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-[#0d7573] shadow-[0_14px_26px_-22px_rgba(12,54,58,0.28)] transition-transform duration-300 group-hover:rotate-3">
                      {isCalendarEventComposerOpen ? (
                        <ChevronDown className="h-5 w-5 rotate-180 transition-transform" />
                      ) : (
                        <Plus className="h-5 w-5" />
                      )}
                    </span>
                  </button>

                  <div
                    className={cn(
                      "relative z-10 grid transition-all duration-300 ease-out",
                      isCalendarEventComposerOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                    )}
                  >
                    <div className="overflow-hidden">
                      <div className="space-y-3 pt-4">
                        <Input
                          dir="rtl"
                          value={calendarEventTitle}
                          onChange={(event) => setCalendarEventTitle(event.target.value)}
                          placeholder="اكتب عنوان الحدث..."
                          className="h-11 rounded-2xl border-[#e4ecee] bg-white px-4 text-right"
                        />

                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="block space-y-2 text-right">
                            <span className="text-[12px] font-semibold text-[#66787d]">وقت الحدث</span>
                            <Input
                              dir="ltr"
                              type="time"
                              min="06:00"
                              max="16:00"
                              value={calendarEventTime}
                              onChange={(event) => setCalendarEventTime(event.target.value)}
                              className="h-11 rounded-2xl border-[#e4ecee] bg-white px-4 text-center"
                            />
                          </label>

                          <label className="block space-y-2 text-right">
                            <span className="text-[12px] font-semibold text-[#66787d]">نوع الحدث</span>
                            <Select
                              dir="rtl"
                              value={calendarEventType}
                              onChange={(event) => setCalendarEventType(event.target.value as CalendarEventType)}
                              className="h-11 rounded-2xl border-[#e0e9eb] bg-white"
                            >
                              {calendarEventTypeOptions.map((option) => (
                                <option key={option.key} value={option.key}>
                                  {option.label}
                                </option>
                              ))}
                            </Select>
                          </label>
                        </div>

                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            onClick={handleAddCalendarEvent}
                            disabled={!calendarEventTitle.trim()}
                            className="h-10 rounded-full bg-[#11272c] px-4 text-[13px] text-white hover:bg-[#0a171a]"
                          >
                            إضافة الحدث
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : null}

          {!isAsideCollapsed && asideView === "updates" ? (
            <div className="mt-7 flex h-[calc(100dvh-8rem)] min-h-[720px] flex-col">
              <div className="mt-3 flex min-h-0 flex-1 flex-col">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[20px] font-semibold text-[#15242a]">الموقف التنفيذي</h3>
                    <p className="mt-1 text-[13px] text-[#849095]">آخر المستجدات عبر المشاريع الحالية</p>
                  </div>
                  <Sparkles className="h-5 w-5 text-[#0d7573]" />
                </div>

                <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pe-1">
                  {statsQuery.isLoading && executiveUpdates.length === 0 ? (
                    <PanelSkeleton rows={4} />
                  ) : executiveUpdates.length > 0 ? (
                    executiveUpdates.map((update) => (
                      <ExecutiveUpdateCard
                        key={update.id}
                        update={update}
                        projectTitle={projectTitleMap.get(update.projectId) ?? `مشروع #${update.projectId}`}
                        isDeleting={
                          deleteExecutiveUpdateMutation.isPending &&
                          deleteExecutiveUpdateMutation.variables?.updateId === update.id
                        }
                        onDelete={() => handleExecutiveUpdateDelete(update)}
                      />
                    ))
                  ) : (
                    <EmptyPanelState title="لا توجد تحديثات حالياً" description="عند إضافة موقف تنفيذي جديد سيظهر هنا مباشرة." />
                  )}
                </div>

                <div
                  className={cn(
                    "sticky bottom-0 z-20 -mx-6 mt-auto w-auto shrink-0 px-6 pb-0 pt-9 backdrop-blur-xl sm:-mx-7 sm:px-7 lg:-mx-8 lg:px-8",
                    isExecutiveComposerOpen
                      ? "bg-[linear-gradient(180deg,#ffffff00_0%,#ffffffe6_34%,#fffffff7_100%)]"
                      : "bg-transparent",
                  )}
                >
                  <div className="pointer-events-none absolute inset-x-0 -top-10 h-10 bg-[linear-gradient(180deg,#ffffff00_0%,#ffffffe8_100%)] backdrop-blur-sm" />
                  <button
                    type="button"
                    onClick={() => setIsExecutiveComposerOpen((current) => !current)}
                    className="group relative z-10 flex w-full flex-row-reverse items-center justify-between gap-4 rounded-[22px] border border-transparent bg-[#f4f7f8]/90 px-4 py-3 text-right backdrop-blur transition duration-300 ease-out hover:-translate-y-0.5 hover:scale-[1.01] hover:border-[#dce7e8] hover:bg-[#eef4f5]/95 hover:shadow-[0_18px_34px_-28px_rgba(12,54,58,0.28)] active:translate-y-0 active:scale-[0.995]"
                    aria-expanded={isExecutiveComposerOpen}
                  >
                    <div>
                      <h3 className="text-[18px] font-semibold text-[#15242a]">إضافة موقف</h3>
                      <p className="mt-1 text-[12px] text-[#849095]">سيتم حفظه في سجل المشروع المحدد.</p>
                    </div>
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-[#0d7573] shadow-[0_14px_26px_-22px_rgba(12,54,58,0.28)] transition-transform duration-300 group-hover:rotate-3">
                      {isExecutiveComposerOpen ? (
                        <ChevronDown className="h-5 w-5 rotate-180 transition-transform" />
                      ) : (
                        <Plus className="h-5 w-5" />
                      )}
                    </span>
                  </button>

                  <div
                    className={cn(
                      "relative z-10 grid transition-all duration-300 ease-out",
                      isExecutiveComposerOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                    )}
                  >
                    <div className="overflow-hidden">
                      <div className="space-y-3 pt-4">
                        <label className="block space-y-2 text-right">
                          <span className="text-[12px] font-semibold text-[#66787d]">اسم المشروع</span>
                          <Select
                            dir="rtl"
                            value={executiveProjectId}
                            onChange={(event) => setExecutiveProjectId(event.target.value)}
                            className="h-11 border-[#e0e9eb] bg-white"
                          >
                            {allProjects.map((project) => (
                              <option key={project.id} value={project.id}>
                                {project.title}
                              </option>
                            ))}
                          </Select>
                        </label>

                        <TextArea
                          dir="rtl"
                          value={executiveUpdateContent}
                          onChange={(event) => setExecutiveUpdateContent(event.target.value)}
                          placeholder="اكتب الموقف التنفيذي هنا..."
                          className="min-h-[96px] rounded-[24px] border-[#e4ecee] bg-white px-5 pb-4 pt-4 text-[14px]"
                        />

                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            onClick={() => addExecutiveUpdateMutation.mutate()}
                            disabled={!executiveProjectId || !executiveUpdateContent.trim() || addExecutiveUpdateMutation.isPending}
                            className="h-10 rounded-full bg-[#11272c] px-4 text-[13px] text-white hover:bg-[#0a171a]"
                          >
                            {addExecutiveUpdateMutation.isPending ? "جارٍ الإضافة..." : "إضافة الموقف"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {!isAsideCollapsed && asideView === "tasks" ? (
            <div className="mt-7 flex h-[calc(100dvh-8rem)] min-h-[720px] flex-col">
              <div className="mt-3 flex min-h-0 flex-1 flex-col">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[20px] font-semibold text-[#15242a]">المهام الشخصية</h3>
		                    <p className="mt-1 text-[13px] text-[#849095]">أحدث المهام الشخصية ومهام المشاريع الحالية</p>
                  </div>
                  <Pencil className="h-5 w-5 text-[#0d7573]" />
                </div>

		                <div className="mt-4 space-y-3 pb-4">
		                  {tasksLoading && personalTasks.length === 0 ? (
		                    <PanelSkeleton rows={5} />
		                  ) : personalTasks.length > 0 ? (
		                    personalTasks.map((task) => (
	                      <PersonalTaskCard
	                        key={`${task.isQuickPersonal ? "quick" : "project"}-${task.id}`}
	                        task={task}
	                        projectTitle={task.projectLabel ?? projectTitleMap.get(task.projectId) ?? `مشروع #${task.projectId}`}
		                        isStatusUpdating={
		                          updatePersonalTaskStatusMutation.isPending &&
		                          updatePersonalTaskStatusMutation.variables?.taskId === task.id
		                        }
		                        isDeleting={
		                          deletePersonalTaskMutation.isPending &&
		                          deletePersonalTaskMutation.variables?.taskId === task.id
		                        }
		                        onStatusChange={(status) => handlePersonalTaskStatusChange(task, status)}
		                        onDelete={() => handlePersonalTaskDelete(task)}
	                      />
	                    ))
	                  ) : (
		                    <EmptyPanelState title="لا توجد مهام حالية" description="عند توفر مهام مفتوحة في المشاريع ستظهر هنا." />
		                  )}
		                </div>

		                <div
		                  className={cn(
		                    "sticky bottom-0 z-20 -mx-6 mt-auto w-auto shrink-0 px-6 pb-0 pt-9 backdrop-blur-xl sm:-mx-7 sm:px-7 lg:-mx-8 lg:px-8",
		                    isQuickTaskComposerOpen
		                      ? "bg-[linear-gradient(180deg,#ffffff00_0%,#ffffffe6_34%,#fffffff7_100%)]"
		                      : "bg-transparent",
		                  )}
		                >
		                  <div className="pointer-events-none absolute inset-x-0 -top-10 h-10 bg-[linear-gradient(180deg,#ffffff00_0%,#ffffffe8_100%)] backdrop-blur-sm" />
		                  <button
		                    type="button"
		                    onClick={() => setIsQuickTaskComposerOpen((current) => !current)}
		                    className="group relative z-10 flex w-full flex-row-reverse items-center justify-between gap-4 rounded-[22px] border border-transparent bg-[#f4f7f8]/90 px-4 py-3 text-right backdrop-blur transition duration-300 ease-out hover:-translate-y-0.5 hover:scale-[1.01] hover:border-[#dce7e8] hover:bg-[#eef4f5]/95 hover:shadow-[0_18px_34px_-28px_rgba(12,54,58,0.28)] active:translate-y-0 active:scale-[0.995]"
		                    aria-expanded={isQuickTaskComposerOpen}
		                  >
		                    <div>
		                      <h3 className="text-[18px] font-semibold text-[#15242a]">إضافة مهمة</h3>
		                      <p className="mt-1 text-[12px] text-[#849095]">اكتب مهمة شخصية سريعة واحفظها مباشرة.</p>
		                    </div>
		                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-[#0d7573] shadow-[0_14px_26px_-22px_rgba(12,54,58,0.28)] transition-transform duration-300 group-hover:rotate-3">
		                      {isQuickTaskComposerOpen ? (
		                        <ChevronDown className="h-5 w-5 rotate-180 transition-transform" />
		                      ) : (
		                        <Plus className="h-5 w-5" />
		                      )}
		                    </span>
		                  </button>

		                  <div
		                    className={cn(
		                      "relative z-10 grid transition-all duration-300 ease-out",
		                      isQuickTaskComposerOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
		                    )}
		                  >
		                    <div className="overflow-hidden">
		                      <div className="space-y-3 pt-4">
		                        <div className="relative">
		                          <Input
		                            dir="rtl"
		                            value={quickTaskTitle}
		                            onChange={(event) => setQuickTaskTitle(event.target.value)}
		                            onKeyDown={(event) => {
		                              if (event.key === "Enter") {
		                                event.preventDefault();
		                                handleAddQuickTask();
		                              }
		                            }}
		                            placeholder="اكتب مهمة شخصية سريعة..."
		                            className="h-[84px] rounded-[24px] border-[#e4ecee] bg-white px-5 pl-14 text-[14px]"
		                          />
		                          <button
		                            type="button"
		                            onClick={() => setIsQuickTaskOptionsOpen((current) => !current)}
		                            className="absolute left-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-xl bg-[#0d7573] text-white shadow-[0_14px_24px_-18px_rgba(13,117,115,0.48)] transition hover:bg-[#0b6664]"
		                          >
		                            <Plus className={cn("h-4 w-4 transition-transform", isQuickTaskOptionsOpen && "rotate-45")} />
		                          </button>
		                        </div>

		                        {isQuickTaskOptionsOpen ? (
		                          <motion.div
		                            initial={{ opacity: 0, y: 8 }}
		                            animate={{ opacity: 1, y: 0 }}
		                            transition={{ duration: 0.2 }}
		                            className="rounded-[18px] bg-white/72 p-3 shadow-[0_16px_28px_-26px_rgba(12,54,58,0.28)] ring-1 ring-white/70 backdrop-blur"
		                          >
		                            <div className="grid gap-3 md:grid-cols-2">
		                              <label className="space-y-2 text-right">
		                                <span className="text-[12px] font-semibold text-[#66787d]">حدد تاريخ</span>
		                                <Input
		                                  dir="rtl"
		                                  type="date"
		                                  value={quickTaskDueDate}
		                                  onChange={(event) => setQuickTaskDueDate(event.target.value)}
		                                  className="h-11 border-[#e0e9eb] bg-white"
		                                />
		                              </label>

		                              <div className="space-y-2 text-right">
		                                <span className="text-[12px] font-semibold text-[#66787d]">تحديد لون</span>
		                                <div className="flex flex-wrap justify-end gap-2">
		                                  {quickTaskColorOptions.map((option) => (
		                                    <button
		                                      key={option.key}
		                                      type="button"
		                                      onClick={() => setQuickTaskColor(option.key)}
		                                      className={cn(
		                                        "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[12px] font-semibold transition",
		                                        quickTaskColor === option.key
		                                          ? "border-transparent shadow-[0_16px_28px_-24px_rgba(12,54,58,0.32)]"
		                                          : "border-[#dde6e8]",
		                                      )}
		                                      style={{
		                                        backgroundColor: option.soft,
		                                        color: option.text,
		                                      }}
		                                    >
		                                      <span
		                                        className="h-2.5 w-2.5 rounded-full"
		                                        style={{ backgroundColor: option.solid }}
		                                      />
		                                      {option.label}
		                                    </button>
		                                  ))}
		                                </div>
		                              </div>
		                            </div>
		                          </motion.div>
		                        ) : null}

		                        <div className="flex justify-end">
		                          <Button
		                            size="sm"
		                            onClick={handleAddQuickTask}
		                            disabled={!quickTaskTitle.trim()}
		                            className="h-10 rounded-full bg-[#11272c] px-4 text-[13px] text-white hover:bg-[#0a171a]"
		                          >
		                            حفظ المهمة
		                          </Button>
		                        </div>
		                      </div>
		                    </div>
		                  </div>
		                </div>
	              </div>
	            </div>
	          ) : null}
        </aside>
      </div>

      <AnimatePresence>
        {isCreateProjectOpen ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeCreateProjectDrawer}
              className="fixed inset-0 z-50 bg-[#09181a]/35 backdrop-blur-[2px]"
            />

            <motion.aside
              dir="rtl"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.32, ease: "easeOut" }}
              className="fixed inset-y-3 left-3 z-[60] w-[calc(100%-1.5rem)] max-w-[688px] overflow-y-auto rounded-[38px] border border-white/75 bg-[#f8fbfb]/96 px-5 pb-6 pt-5 shadow-[0_40px_90px_-34px_rgba(7,47,52,0.38)] ring-1 ring-[#dfe8e9]/70 backdrop-blur-sm sm:px-6"
            >
              <div className="flex items-center justify-between border-b border-[#e8eff0] pb-4">
                <div>
                  <h2 className="text-[28px] font-semibold tracking-[-0.04em] text-[#11272c]">إضافة مشروع جديد</h2>
                  <p className="mt-1 text-[14px] text-[#7d8c90]">
                    أدخل بيانات المشروع الأساسية وسيتم إضافته مباشرة إلى قائمة المشاريع.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeCreateProjectDrawer}
                  className="grid h-11 w-11 place-items-center rounded-full bg-white text-[#35565a] shadow-[0_18px_32px_-24px_rgba(10,76,74,0.26)] transition hover:bg-[#eef6f6]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-5 space-y-5">
                {createProjectMutation.error ? (
                  <div className="rounded-[20px] border border-[#ffd7cc] bg-[#fff3ef] px-4 py-3 text-[13px] font-medium text-[#bf5d42]">
                    {createProjectMutation.error.message}
                  </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                  <FieldBlock label="اسم المشروع">
                    <Input
                      placeholder="مثال: بوابة الخدمات الداخلية"
                      value={projectForm.title}
                      onChange={(event) =>
                        setProjectForm((current) => ({ ...current, title: event.target.value }))
                      }
                    />
                  </FieldBlock>

                  <FieldBlock label="رقم الوثيقة">
                    <Input
                      placeholder="مثال: DOC-2026-014"
                      value={projectForm.documentNumber}
                      onChange={(event) =>
                        setProjectForm((current) => ({ ...current, documentNumber: event.target.value }))
                      }
                    />
                  </FieldBlock>

                  <FieldBlock label="مدير المشروع">
                    <Select
                      value={String(projectForm.projectManagerId)}
                      onChange={(event) =>
                        setProjectForm((current) => ({
                          ...current,
                          projectManagerId: Number(event.target.value),
                        }))
                      }
                    >
                      {projectManagers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.displayName}
                        </option>
                      ))}
                    </Select>
                  </FieldBlock>

                  <FieldBlock label="نوع المشروع">
                    <Select
                      value={projectForm.type}
                      onChange={(event) =>
                        setProjectForm((current) => ({ ...current, type: event.target.value }))
                      }
                    >
                      <option value="Software">برمجيات</option>
                      <option value="Networks">شبكات</option>
                      <option value="Cybersecurity">أمن سيبراني</option>
                      <option value="Maintenance">صيانة</option>
                    </Select>
                  </FieldBlock>

                  <FieldBlock label="الحالة">
                    <Select
                      value={projectForm.status}
                      onChange={(event) =>
                        setProjectForm((current) => ({ ...current, status: event.target.value }))
                      }
                    >
                      <option value="Planning">تخطيط</option>
                      <option value="Active">نشط</option>
                      <option value="OnHold">معلّق</option>
                      <option value="Completed">مكتمل</option>
                      <option value="Cancelled">ملغي</option>
                    </Select>
                  </FieldBlock>

                  <FieldBlock label="الأولوية">
                    <Select
                      value={projectForm.priority}
                      onChange={(event) =>
                        setProjectForm((current) => ({ ...current, priority: event.target.value }))
                      }
                    >
                      <option value="Medium">متوسطة</option>
                      <option value="High">عالية</option>
                      <option value="Critical">حرجة</option>
                    </Select>
                  </FieldBlock>

                  <FieldBlock label="القسم المسؤول">
                    <Select
                      value={String(projectForm.responsibleDepartmentId)}
                      onChange={(event) =>
                        setProjectForm((current) => ({
                          ...current,
                          responsibleDepartmentId: Number(event.target.value),
                        }))
                      }
                    >
                      {projectDepartments.map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.name}
                        </option>
                      ))}
                    </Select>
                  </FieldBlock>

                  <FieldBlock label="القسم المستفيد">
                    <Select
                      value={String(projectForm.beneficiaryDepartmentId)}
                      onChange={(event) =>
                        setProjectForm((current) => ({
                          ...current,
                          beneficiaryDepartmentId: Number(event.target.value),
                        }))
                      }
                    >
                      {projectDepartments.map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.name}
                        </option>
                      ))}
                    </Select>
                  </FieldBlock>

                  <FieldBlock label="الميزانية">
                    <Input
                      type="number"
                      min={0}
                      value={projectForm.budget}
                      onChange={(event) =>
                        setProjectForm((current) => ({
                          ...current,
                          budget: Number(event.target.value),
                        }))
                      }
                    />
                  </FieldBlock>

                  <FieldBlock label="التكلفة الفعلية">
                    <Input
                      type="number"
                      min={0}
                      value={projectForm.actualCost}
                      onChange={(event) =>
                        setProjectForm((current) => ({
                          ...current,
                          actualCost: Number(event.target.value),
                        }))
                      }
                    />
                  </FieldBlock>

                  <FieldBlock label="تاريخ البداية">
                    <Input
                      type="date"
                      value={projectForm.startDate}
                      onChange={(event) =>
                        setProjectForm((current) => ({ ...current, startDate: event.target.value }))
                      }
                    />
                  </FieldBlock>

                  <FieldBlock label="تاريخ النهاية">
                    <Input
                      type="date"
                      value={projectForm.endDate}
                      onChange={(event) =>
                        setProjectForm((current) => ({ ...current, endDate: event.target.value }))
                      }
                    />
                  </FieldBlock>
                </div>

                <FieldBlock label="وصف المشروع">
                  <TextArea
                    placeholder="اكتب وصفاً واضحاً عن الهدف، النطاق، والفائدة المتوقعة من المشروع."
                    value={projectForm.description}
                    onChange={(event) =>
                      setProjectForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                  />
                </FieldBlock>
              </div>

              <div className="sticky bottom-0 mt-6 border-t border-[#e8eff0] bg-[#f8fbfb]/95 pb-2 pt-4 backdrop-blur">
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <Button variant="secondary" onClick={closeCreateProjectDrawer}>
                    إلغاء
                  </Button>
                  <Button
                    onClick={() => createProjectMutation.mutate()}
                    disabled={createProjectMutation.isPending}
                    className="bg-[#0d7573] hover:bg-[#0b6664]"
                  >
                    {createProjectMutation.isPending ? "جارٍ إنشاء المشروع..." : "حفظ المشروع"}
                  </Button>
                </div>
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function ProjectOverviewCard({
  project,
  members,
}: {
  project: Project;
  members: ProjectDetail["members"];
}) {
  const visibleMembers = members.slice(0, 4);
  const remainingMembers = Math.max(0, members.length - visibleMembers.length);

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group block rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-[0_24px_44px_-34px_rgba(10,76,74,0.28)] backdrop-blur-sm transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_28px_50px_-30px_rgba(10,76,74,0.36)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <span
              className="rounded-full px-3 py-1 text-[12px] font-semibold text-white"
              style={{ backgroundColor: getTypeColor(project.type) }}
            >
              {translateProjectType(project.type)}
            </span>
            <span
              className="rounded-full px-3 py-1 text-[12px] font-semibold text-white"
              style={{ backgroundColor: getStatusTone(project.status) }}
            >
              {translateProjectStatus(project.status)}
            </span>
          </div>
          <h3 className="mt-4 truncate text-[21px] font-semibold tracking-[-0.04em] text-[#132126]">
            {project.title}
          </h3>
        </div>

        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#edf8f8] text-[#0d7573] transition duration-300 group-hover:bg-[#0d7573] group-hover:text-white">
          <ArrowUpRight className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between text-[13px]">
          <span className="font-medium text-[#7d8b91]">نسبة الإنجاز</span>
          <span className="font-semibold text-[#15242a]">{percentage(project.progressPercent)}</span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#e9f0f1]">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.max(6, Math.min(100, project.progressPercent))}%`,
              backgroundColor: getTypeColor(project.type),
            }}
          />
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-4">
        <div className="flex items-center">
          {visibleMembers.length > 0 ? (
            visibleMembers.map((member, index) => (
              <div
                key={member.id}
                className="grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-[linear-gradient(135deg,#dbe9eb,#6a7d83)] text-[11px] font-semibold text-white"
                style={{ marginInlineStart: index === 0 ? 0 : -10 }}
                title={member.userName}
              >
                {member.userName
                  .split(" ")
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join("")}
              </div>
            ))
          ) : (
            <div className="rounded-full bg-[#eef4f5] px-3 py-2 text-[12px] font-medium text-[#6f7d83]">
              بدون أعضاء
            </div>
          )}

          {remainingMembers > 0 ? (
            <div className="-ms-2 grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-[#ff8a69] text-[11px] font-semibold text-white">
              +{remainingMembers}
            </div>
          ) : null}
        </div>

        <div className="text-left">
          <p className="text-[12px] text-[#8b979d]">الفريق</p>
          <p className="mt-1 text-[13px] font-semibold text-[#172228]">{project.teamSize} عضو</p>
        </div>
      </div>
    </Link>
  );
}

function ProjectCardSkeleton() {
  return (
    <div className="animate-pulse rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-[0_24px_44px_-34px_rgba(10,76,74,0.18)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex gap-2">
            <div className="h-7 w-20 rounded-full bg-[#edf2f3]" />
            <div className="h-7 w-24 rounded-full bg-[#edf2f3]" />
          </div>
          <div className="mt-4 h-6 w-3/4 rounded-full bg-[#eef3f4]" />
        </div>
        <div className="h-11 w-11 rounded-full bg-[#edf2f3]" />
      </div>
      <div className="mt-6 h-3 w-24 rounded-full bg-[#edf2f3]" />
      <div className="mt-2 h-2.5 rounded-full bg-[#edf2f3]" />
      <div className="mt-5 flex items-center justify-between">
        <div className="flex items-center">
          <div className="h-9 w-9 rounded-full bg-[#edf2f3]" />
          <div className="-ms-2 h-9 w-9 rounded-full bg-[#edf2f3]" />
          <div className="-ms-2 h-9 w-9 rounded-full bg-[#edf2f3]" />
        </div>
        <div className="h-9 w-16 rounded-2xl bg-[#edf2f3]" />
      </div>
    </div>
  );
}

function ScheduleCard({
  item,
  onDelete,
}: {
  item: ScheduleItem;
  onDelete?: () => void;
}) {
  const tones = {
    teal: {
      line: "#0d7573",
      border: "#7ab2b0",
      text: "#0d7573",
      bg: "#f3fbfb",
    },
    amber: {
      line: "#f0b819",
      border: "#f1d059",
      text: "#e4a800",
      bg: "#fffdf5",
    },
    coral: {
      line: "#ff8a69",
      border: "#f2c0b2",
      text: "#f48f75",
      bg: "#fffaf8",
    },
  }[item.accent];

  return (
    <div
      className="rounded-[18px] px-4 py-3 shadow-[0_16px_28px_-28px_rgba(12,54,58,0.22)]"
      style={{ background: tones.bg }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: tones.line }} />

        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold tracking-[-0.02em]" style={{ color: tones.text }}>
            {item.title}
          </p>
          <p className="mt-1 text-[12px] text-[#5f6770]">{item.subtitle}</p>
        </div>
        </div>

        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            aria-label="حذف الحدث"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#8a969a] transition hover:bg-white/70 hover:text-[#526268]"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ExecutiveUpdateCard({
  update,
  projectTitle,
  isDeleting = false,
  onDelete,
}: {
  update: ExecutiveUpdate;
  projectTitle: string;
  isDeleting?: boolean;
  onDelete?: () => void;
}) {
  const typeTone = {
    StatusUpdate: "bg-[#edf8f8] text-[#0d7573]",
    Milestone: "bg-[#fff8df] text-[#d89b09]",
    Issue: "bg-[#fff0ec] text-[#ef7c61]",
    Achievement: "bg-[#eef4ff] text-[#5c6bd8]",
  }[update.updateType];

  const typeLabel = {
    StatusUpdate: "تحديث حالة",
    Milestone: "منجز رئيسي",
    Issue: "مشكلة",
    Achievement: "إنجاز",
  }[update.updateType];

  return (
    <div className="rounded-[20px] border border-[#eef2f3] bg-white p-4 shadow-[0_18px_30px_-28px_rgba(12,54,58,0.24)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-[#172228]">{projectTitle}</p>
          <p className="mt-1 text-[12px] text-[#8d979b]">
            {update.createdByName ?? "النظام"} • {formatArabicDate(update.createdAt)}
          </p>
        </div>
        <span className={cn("rounded-full px-3 py-1 text-[11px] font-semibold", typeTone)}>{typeLabel}</span>
      </div>
      {update.title ? (
        <p className="mt-3 text-[15px] font-semibold leading-6 text-[#172228]">{update.title}</p>
      ) : null}
      <p className="mt-3 text-[14px] leading-6 text-[#556066]">{update.content}</p>
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

function PersonalTaskCard({
  task,
  projectTitle,
  isStatusUpdating = false,
  isDeleting = false,
  onStatusChange,
  onDelete,
}: {
  task: DashboardPersonalTask;
  projectTitle: string;
  isStatusUpdating?: boolean;
  isDeleting?: boolean;
  onStatusChange: (status: Task["status"]) => void;
  onDelete: () => void;
}) {
  const isDone = task.status === "Done";
  const statusMeta = getPersonalTaskStatusMeta(task.status);
  const priorityTone = {
    Low: "text-[#7a8a91]",
    Medium: "text-[#0d7573]",
    High: "text-[#d89b09]",
    Critical: "text-[#ef7c61]",
  }[task.priority];

  const priorityLabel = {
    Low: "منخفضة",
    Medium: "متوسطة",
    High: "عالية",
    Critical: "حرجة",
  }[task.priority];

  return (
    <div
      className={cn(
        "relative rounded-[20px] border p-4 transition",
        isDone
          ? "border-[#e1e7e8] bg-[#f1f4f5]/78 opacity-70 shadow-none"
          : "border-[#eef2f3] bg-white shadow-[0_18px_30px_-28px_rgba(12,54,58,0.24)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className={cn(
              "truncate text-[15px] font-semibold",
              isDone ? "text-[#879195] line-through decoration-[#b5c0c3]" : "text-[#172228]",
            )}
          >
            {task.title}
          </p>
          <p className={cn("mt-1 truncate text-[12px]", isDone ? "text-[#a0aaae]" : "text-[#8d979b]")}>{projectTitle}</p>
        </div>
        <div className="relative shrink-0">
          <select
            aria-label="تغيير حالة المهمة"
            value={task.status}
            disabled={isStatusUpdating}
            onChange={(event) => onStatusChange(event.target.value as Task["status"])}
            className={cn(
              "h-8 min-w-[110px] cursor-pointer appearance-none rounded-full border-0 pe-3 ps-8 text-right text-[10px] font-semibold leading-none whitespace-nowrap outline-none transition focus:ring-2 focus:ring-[#0d7573]/20 disabled:cursor-wait disabled:opacity-70 md:text-[11px]",
              statusMeta.tone,
            )}
          >
            {personalTaskStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[#526268]" />
        </div>
      </div>

      <div className="mt-3 text-[12px]">
        <span className={cn("font-semibold", isDone ? "text-[#9aa5a9]" : priorityTone)}>أولوية {priorityLabel}</span>
      </div>

      <div className={cn("mt-3 pe-10 text-[12px]", isDone ? "text-[#a0aaae]" : "text-[#8d979b]")}>
        <span>{task.assignedToName ?? task.createdByName ?? "غير محدد"}</span>
      </div>

      <button
        type="button"
        onClick={onDelete}
        disabled={isDeleting}
        aria-label="حذف المهمة"
        className="absolute bottom-3 right-3 grid h-8 w-8 place-items-center rounded-full text-[#8a969a] transition hover:bg-[#eef2f3] hover:text-[#526268] disabled:cursor-wait disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function PanelSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="animate-pulse rounded-[20px] border border-[#eef2f3] bg-white p-4">
          <div className="h-4 w-2/5 rounded-full bg-[#eef2f3]" />
          <div className="mt-3 h-3 w-4/5 rounded-full bg-[#f1f4f5]" />
          <div className="mt-2 h-3 w-3/5 rounded-full bg-[#f1f4f5]" />
        </div>
      ))}
    </div>
  );
}

function FieldBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-[13px] font-semibold text-[#42575b]">{label}</span>
      {children}
    </label>
  );
}

function EmptyPanelState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[20px] border border-dashed border-[#dce6e7] bg-white px-5 py-8 text-center">
      <p className="text-[15px] font-semibold text-[#172228]">{title}</p>
      <p className="mt-2 text-[13px] leading-6 text-[#7d8b91]">{description}</p>
    </div>
  );
}

function ProfileAvatar({ name, avatar }: { name: string; avatar?: string | null }) {
  const initials = getInitials(name);

  return (
    <div className="grid h-[72px] w-[72px] shrink-0 place-items-center overflow-hidden rounded-full bg-[#dce3e6]">
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar} alt={name} className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-[58px] w-[58px] place-items-center rounded-full bg-[linear-gradient(145deg,#0d2f34,#5c6e74)] text-base font-semibold text-white">
          {initials}
        </div>
      )}
    </div>
  );
}

function formatArabicDate(value?: string | null) {
  if (!value) {
    return "غير محدد";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "غير محدد";
  }

  return new Intl.DateTimeFormat("ar", {
    month: "short",
    day: "numeric",
  }).format(date);
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
  if (status === "OnHold") return "معلّق";
  if (status === "Completed") return "مكتمل";
  return "ملغي";
}

function translateUserRole(role: User["role"]) {
  if (role === "Admin") return "مدير النظام";
  if (role === "Department Chair") return "رئيس الدائرة";
  if (role === "Chair Office") return "مكتب الرئيس";
  if (role === "Department Director") return "مدير الدائرة";
  if (role === "Section Head") return "رئيس القسم";
  if (role === "Division Supervisor") return "مشرف شعبة";
  if (role === "Division Member") return "عضو داخل شعبة";
  if (role === "Project Manager") return "مدير مشروع";
  if (role === "Member") return "عضو فريق";
  return "مشاهد";
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

function parseStoredQuickTasks(payload: string): StoredQuickTask[] {
  try {
    const parsed = JSON.parse(payload);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object" || typeof item.title !== "string" || !item.title.trim()) {
        return [];
      }

      return [
        {
          id: typeof item.id === "number" ? item.id : Date.now(),
          title: item.title.trim(),
          dueDate: typeof item.dueDate === "string" && item.dueDate ? item.dueDate : null,
          color: isQuickTaskColor(item.color) ? item.color : "teal",
          status: isTaskStatus(item.status) ? item.status : "Todo",
          createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
        },
      ];
    });
  } catch {
    return [];
  }
}

function parseStoredCalendarEvents(payload: string): StoredCalendarEvent[] {
  try {
    const parsed = JSON.parse(payload);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.flatMap((item) => {
      if (
        !item ||
        typeof item !== "object" ||
        typeof item.title !== "string" ||
        !item.title.trim() ||
        typeof item.dateKey !== "string" ||
        !item.dateKey
      ) {
        return [];
      }

      return [
        {
          id: typeof item.id === "number" ? item.id : Date.now(),
          title: item.title.trim(),
          dateKey: item.dateKey,
          time: isCalendarEventTime(item.time) ? item.time : "09:00",
          type: isCalendarEventType(item.type) ? item.type : "meeting",
          createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
        },
      ];
    });
  } catch {
    return [];
  }
}

function toDashboardPersonalTask(
  task: StoredQuickTask,
  currentUserName: string,
  currentUserId: number,
): DashboardPersonalTask {
  return {
    id: task.id,
    projectId: -1,
    title: task.title,
    description: "",
    assignedToId: currentUserId || null,
    assignedToName: currentUserName,
    createdById: currentUserId || 0,
    createdByName: currentUserName,
    status: task.status,
    priority: "Medium",
    dueDate: task.dueDate,
    estimatedHours: 0,
    actualHours: 0,
    orderIndex: 0,
    createdAt: task.createdAt,
    accentColor: task.color,
    isQuickPersonal: true,
    projectLabel: "مهمة شخصية",
  };
}

function sortPersonalTasks(
  left: { createdAt?: string | null; dueDate?: string | null; orderIndex: number },
  right: { createdAt?: string | null; dueDate?: string | null; orderIndex: number },
) {
  const parsedLeftCreatedAt = left.createdAt ? new Date(left.createdAt).getTime() : 0;
  const parsedRightCreatedAt = right.createdAt ? new Date(right.createdAt).getTime() : 0;
  const leftCreatedAt = Number.isFinite(parsedLeftCreatedAt) ? parsedLeftCreatedAt : 0;
  const rightCreatedAt = Number.isFinite(parsedRightCreatedAt) ? parsedRightCreatedAt : 0;

  if (leftCreatedAt !== rightCreatedAt) {
    return rightCreatedAt - leftCreatedAt;
  }

  if (!left.dueDate && !right.dueDate) {
    return left.orderIndex - right.orderIndex;
  }

  if (!left.dueDate) {
    return 1;
  }

  if (!right.dueDate) {
    return -1;
  }

  return new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime();
}

function isQuickTaskColor(value: unknown): value is QuickTaskColor {
  return value === "teal" || value === "amber" || value === "coral" || value === "slate";
}

function isTaskStatus(value: unknown): value is Task["status"] {
  return value === "Todo" || value === "InProgress" || value === "Review" || value === "Done" || value === "Blocked";
}

function isCalendarEventType(value: unknown): value is CalendarEventType {
  return value === "meeting" || value === "delivery" || value === "call" || value === "other";
}

function isCalendarEventTime(value: unknown): value is string {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value);
}
