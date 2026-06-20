"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FolderKanban,
  Layers,
  Pencil,
  Plus,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { createProjectHubConnection } from "@/lib/signalr";
import { Button, Input, Select } from "@/components/ui/primitives";
import { useAuthStore } from "@/store/auth-store";
import { cn, formatCurrency, formatDate, percentage } from "@/lib/utils";
import type { ExecutiveUpdate, PagedResult, Project, ProjectDetail, Task } from "@/types/domain";

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

type DirectorProjectReference = {
  id: number;
  title: string;
};

type DirectorStatusSummary = {
  key: Project["status"] | "Completed";
  name: string;
  value: number;
  color: string;
  projects: DirectorProjectReference[];
};

type DirectorWorkloadTaskReference = {
  id: number;
  title: string;
  projectTitle: string;
  status: Task["status"];
};

type DirectorAsideView = "calendar" | "updates" | "tasks";
type DirectorCalendarEventType = "meeting" | "delivery" | "call" | "other";
type DirectorAccent = "teal" | "amber" | "coral";

type DirectorCalendarEvent = {
  id: number;
  title: string;
  dateKey: string;
  time: string;
  type: DirectorCalendarEventType;
};

type CalendarDayCell = {
  date: Date;
  dateKey: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
};

type DirectorScheduleItem = {
  id: string;
  title: string;
  subtitle: string;
  time: string;
  timeMinutes: number | null;
  dateKey: string;
  accent: DirectorAccent;
  sortValue: number;
  note?: string;
};

type DirectorExecutiveFeedItem = {
  id: string;
  projectId: number;
  projectTitle: string;
  title?: string | null;
  content: string;
  updateType: ExecutiveUpdate["updateType"];
  createdByName?: string | null;
  createdAt: string;
};

const directorAsideTabs = [
  { key: "calendar" as const, label: "التقويم", icon: CalendarDays },
  { key: "updates" as const, label: "الموقف التنفيذي", icon: Sparkles },
  { key: "tasks" as const, label: "المهام الشخصية", icon: Pencil },
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
const calendarWeekdayLabels = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const calendarEventTypeOptions: Array<{ key: DirectorCalendarEventType; label: string }> = [
  { key: "meeting", label: "اجتماع" },
  { key: "delivery", label: "تسليم" },
  { key: "call", label: "مكالمة" },
  { key: "other", label: "أخرى" },
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

function translateUpdateType(type: ExecutiveUpdate["updateType"]) {
  if (type === "StatusUpdate") return "تحديث حالة";
  if (type === "Milestone") return "منجز رئيسي";
  if (type === "Issue") return "مشكلة";
  return "إنجاز";
}

function translateTaskStatus(status: Task["status"]) {
  if (status === "Todo") return "جديدة";
  if (status === "InProgress") return "قيد التنفيذ";
  if (status === "Review") return "مراجعة";
  if (status === "Done") return "منتهية";
  return "توجد مشكلة";
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

function clampPercentage(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
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

function getDirectorProjectAccent(type: Project["type"]): DirectorAccent {
  if (type === "Cybersecurity" || type === "Maintenance") {
    return "coral";
  }

  if (type === "Networks") {
    return "amber";
  }

  return "teal";
}

function getCalendarEventAccent(type: DirectorCalendarEventType): DirectorAccent {
  if (type === "delivery") return "amber";
  if (type === "call") return "coral";
  return "teal";
}

function translateCalendarEventType(type: DirectorCalendarEventType) {
  return (
    {
      meeting: "اجتماع",
      delivery: "تسليم",
      call: "مكالمة",
      other: "أخرى",
    }[type] ?? "أخرى"
  );
}

function formatArabicNumber(value: number) {
  return new Intl.NumberFormat("ar").format(value);
}

function formatProjectCountLabel(count: number) {
  const formatted = formatArabicNumber(count);

  if (count === 1) return `${formatted} مشروع`;
  if (count === 2) return `${formatted} مشروعان`;
  return `${formatted} مشاريع`;
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
  id,
  title,
  subtitle,
  action,
  children,
  className,
  collapsible = false,
}: {
  id?: string;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  collapsible?: boolean;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      id={id}
      className={cn("rounded-[30px] border border-white/70 bg-white/88 p-5 shadow-[0_24px_54px_-40px_rgba(12,54,58,0.24)]", className)}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-[22px] font-semibold tracking-[-0.04em] text-[#12262b]">{title}</h2>
          <p className="mt-1 text-[13px] leading-6 text-[#7d8b90]">{subtitle}</p>
        </div>
        {action || collapsible ? (
          <div className="flex items-center gap-2 self-start">
            {action}
            {collapsible ? (
              <button
                type="button"
                onClick={() => setIsCollapsed((current) => !current)}
                title={isCollapsed ? "توسيع القسم" : "طي القسم"}
                aria-label={isCollapsed ? "توسيع القسم" : "طي القسم"}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#f4f7f8] text-[#617278] transition hover:bg-[#eaf1f2] hover:text-[#172228]"
              >
                <ChevronDown className={cn("h-4 w-4 transition-transform", isCollapsed && "rotate-180")} />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="mt-5">
        {isCollapsed ? (
          <div className="rounded-[24px] border border-dashed border-[#d9e7e8] bg-[#f9fcfc] px-5 py-6 text-center text-[14px] text-[#7d8b91]">
            تم طي هذا القسم.
          </div>
        ) : (
          children
        )}
      </div>
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

function DirectorInlinePopover({
  align = "right",
  label,
  title,
  children,
}: {
  align?: "left" | "right";
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        aria-label={label}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className="grid h-7 w-7 cursor-pointer list-none place-items-center rounded-full bg-white text-[13px] font-bold text-[#172228] shadow-[0_12px_22px_-18px_rgba(12,54,58,0.24)] transition hover:bg-[#f4f7f8] [&::-webkit-details-marker]:hidden"
      >
        ?
      </button>
      {isOpen ? (
        <div
          className={cn(
            "absolute top-9 z-30 w-[260px] rounded-[20px] border border-[#e5ecee] bg-white p-4 text-right shadow-[0_24px_48px_-30px_rgba(12,54,58,0.26)]",
            align === "left" ? "left-0" : "right-0",
          )}
        >
          <p className="text-[13px] font-bold text-[#172228]">{title}</p>
          <div className="mt-3 space-y-2 text-[12px] leading-6 text-[#64757a]">{children}</div>
        </div>
      ) : null}
    </div>
  );
}

function DirectorCalendarAside({
  activeView,
  calendarDays,
  calendarEventsByDay,
  calendarEventTime,
  calendarEventTitle,
  calendarEventType,
  calendarHeading,
  calendarMonthHeading,
  executiveUpdates,
  isCalendarEventComposerOpen,
  onAddCalendarEvent,
  onCalendarDateSelect,
  onCalendarEventTimeChange,
  onCalendarEventTitleChange,
  onCalendarEventTypeChange,
  onCalendarMonthChange,
  onComposerToggle,
  onViewChange,
  selectedCalendarDateKey,
  selectedDateEvents,
}: {
  activeView: DirectorAsideView;
  calendarDays: CalendarDayCell[];
  calendarEventsByDay: Map<string, DirectorScheduleItem[]>;
  calendarEventTime: string;
  calendarEventTitle: string;
  calendarEventType: DirectorCalendarEventType;
  calendarHeading: ReturnType<typeof getCalendarDateLabel>;
  calendarMonthHeading: ReturnType<typeof getCalendarDateLabel>;
  executiveUpdates: DirectorExecutiveFeedItem[];
  isCalendarEventComposerOpen: boolean;
  onAddCalendarEvent: () => void;
  onCalendarDateSelect: (date: Date) => void;
  onCalendarEventTimeChange: (value: string) => void;
  onCalendarEventTitleChange: (value: string) => void;
  onCalendarEventTypeChange: (value: DirectorCalendarEventType) => void;
  onCalendarMonthChange: (direction: -1 | 1) => void;
  onComposerToggle: () => void;
  onViewChange: (view: DirectorAsideView) => void;
  selectedCalendarDateKey: string;
  selectedDateEvents: DirectorScheduleItem[];
}) {
  return (
    <aside
      className="relative m-2 h-[calc(100vh-1rem)] w-full max-w-[520px] overflow-y-auto overscroll-contain rounded-[34px] border border-[#eff3f4] bg-white px-6 pb-8 shadow-[0_28px_70px_-52px_rgba(12,54,58,0.35)] transition-[max-width,padding] duration-300 ease-out sm:px-7 lg:px-8"
    >
      <div className="sticky top-0 z-30 -mx-6 bg-transparent px-6 pb-0 pt-7 shadow-none backdrop-blur-0 transition-all duration-300 sm:-mx-7 sm:px-7 lg:-mx-8 lg:px-8">
        <div dir="ltr" className="rounded-[22px] bg-[#f4f7f8]/90 p-1.5 backdrop-blur">
          <div className="grid grid-cols-3 gap-1.5">
            {directorAsideTabs.map((tab) => {
              const Icon = tab.icon;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => onViewChange(tab.key)}
                  className={cn(
                    "flex min-w-0 items-center justify-center gap-1.5 rounded-[18px] px-2 py-2.5 text-[11px] leading-none transition-all md:px-3 md:text-[12px]",
                    activeView === tab.key
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
      </div>

      {activeView === "calendar" ? (
        <>
          <div className="mt-8 flex flex-row-reverse items-center justify-between">
            <div className="text-right">
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
                onClick={() => onCalendarMonthChange(-1)}
                className="grid h-9 w-9 place-items-center rounded-full transition hover:bg-[#f4f7f8] hover:text-[#11272c]"
                aria-label="الشهر السابق"
              >
                <ChevronRight className="h-7 w-7" />
              </button>
              <button
                type="button"
                onClick={() => onCalendarMonthChange(1)}
                className="grid h-9 w-9 place-items-center rounded-full transition hover:bg-[#f4f7f8] hover:text-[#11272c]"
                aria-label="الشهر التالي"
              >
                <ChevronLeft className="h-7 w-7" />
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
                  onClick={() => onCalendarDateSelect(day.date)}
                  className={cn(
                    "relative mx-auto flex h-[42px] w-[42px] items-center justify-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d7573]",
                    !day.isCurrentMonth && "opacity-60",
                  )}
                >
                  <span
                    className={cn(
                      "relative z-10 grid h-[38px] w-[38px] place-items-center rounded-full text-[13px] font-medium transition-all",
                      isSelected && "font-bold",
                      isSelected &&
                        primaryAccent === "teal" &&
                        "bg-[#0d7573] text-white shadow-[0_16px_28px_-18px_rgba(13,117,115,0.55)]",
                      isSelected &&
                        primaryAccent === "amber" &&
                        "bg-[#fec71a] text-white shadow-[0_16px_28px_-18px_rgba(240,184,25,0.5)]",
                      isSelected &&
                        primaryAccent === "coral" &&
                        "bg-[#ff8a69] text-white shadow-[0_16px_28px_-18px_rgba(255,138,105,0.48)]",
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

            <div className="min-h-0 flex-1 pe-1">
              {selectedDateEvents.length > 0 ? (
                <div className="space-y-3">
                  {selectedDateEvents.map((item) => (
                    <DirectorScheduleCard key={item.id} item={item} />
                  ))}
                </div>
              ) : (
                <DirectorAsideEmptyState
                  title="لا توجد أحداث في هذا اليوم"
                  description="اختر يوماً آخر أو أضف بيانات مشاريع وأحداث ليظهر الجدول هنا."
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
                onClick={onComposerToggle}
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
                  {isCalendarEventComposerOpen ? <ChevronDown className="h-5 w-5 rotate-180" /> : <Plus className="h-5 w-5" />}
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
                      onChange={(event) => onCalendarEventTitleChange(event.target.value)}
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
                          onChange={(event) => onCalendarEventTimeChange(event.target.value)}
                          className="h-11 rounded-2xl border-[#e4ecee] bg-white px-4 text-center"
                        />
                      </label>

                      <label className="block space-y-2 text-right">
                        <span className="text-[12px] font-semibold text-[#66787d]">نوع الحدث</span>
                        <Select
                          dir="rtl"
                          value={calendarEventType}
                          onChange={(event) => onCalendarEventTypeChange(event.target.value as DirectorCalendarEventType)}
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
                        onClick={onAddCalendarEvent}
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
      ) : activeView === "updates" ? (
        <div className="mt-8 flex min-h-[calc(100dvh-8rem)] flex-col">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-[22px] font-semibold tracking-[-0.04em] text-[#15242a]">الموقف التنفيذي</h3>
              <p className="mt-1 text-[13px] text-[#7d8b91]">جميع المواقف التنفيذية لجميع المشاريع ضمن نطاق العرض الحالي.</p>
            </div>
            <span className="rounded-full bg-[#f4f7f8] px-3 py-1 text-[12px] font-semibold text-[#617278]">
              {executiveUpdates.length} تحديث
            </span>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pe-1 pb-4">
            {executiveUpdates.length > 0 ? (
              executiveUpdates.map((update) => <DirectorExecutiveUpdateCard key={update.id} update={update} />)
            ) : (
              <DirectorAsideEmptyState
                title="لا توجد مواقف تنفيذية حالياً"
                description="لا توجد تحديثات تنفيذية ضمن المشاريع الظاهرة في صفحة مدير النظام."
              />
            )}
          </div>
        </div>
      ) : (
        <div className="mt-8">
          <DirectorAsideEmptyState
            title="المهام الشخصية موجودة في الصفحات التشغيلية"
            description="هذا التبويب ظاهر للحفاظ على نفس تركيب اللوحة الجانبية ويمكن توسيعه لاحقاً داخل صفحة رئيس الدائرة."
          />
        </div>
      )}
    </aside>
  );
}

function DirectorScheduleCard({ item }: { item: DirectorScheduleItem }) {
  const tones = {
    teal: {
      line: "#0d7573",
      text: "#0d7573",
      bg: "#f3fbfb",
    },
    amber: {
      line: "#f0b819",
      text: "#d89b09",
      bg: "#fffdf5",
    },
    coral: {
      line: "#ff8a69",
      text: "#ef7c61",
      bg: "#fffaf8",
    },
  }[item.accent];

  return (
    <div className="rounded-[18px] px-4 py-3 shadow-[0_16px_28px_-28px_rgba(12,54,58,0.22)]" style={{ background: tones.bg }}>
      <div className="flex items-start gap-3">
        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: tones.line }} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold tracking-[-0.02em]" style={{ color: tones.text }}>
            {item.title}
          </p>
          <p className="mt-1 text-[12px] text-[#5f6770]">{item.subtitle}</p>
          <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-[#849095]">
            <span>{item.time}</span>
            {item.note ? <span className="truncate">{item.note}</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function DirectorExecutiveUpdateCard({ update }: { update: DirectorExecutiveFeedItem }) {
  const tone = {
    StatusUpdate: {
      badge: "bg-[#eef4f5] text-[#617278]",
      line: "#0d7573",
      bg: "#ffffff",
    },
    Milestone: {
      badge: "bg-[#fff8df] text-[#b98800]",
      line: "#f0b819",
      bg: "#fffef8",
    },
    Issue: {
      badge: "bg-[#fff1ec] text-[#cf6247]",
      line: "#ef7c61",
      bg: "#fffaf8",
    },
    Achievement: {
      badge: "bg-[#edf8f8] text-[#0d7573]",
      line: "#0d7573",
      bg: "#f8fcfc",
    },
  }[update.updateType];

  return (
    <Link
      href={`/projects/${update.projectId}`}
      className="block rounded-[22px] border border-[#edf2f3] px-4 py-4 shadow-[0_18px_30px_-28px_rgba(12,54,58,0.2)] transition duration-200 hover:-translate-y-0.5 hover:border-[#dbe7e8] hover:shadow-[0_22px_36px_-26px_rgba(12,54,58,0.24)]"
      style={{ backgroundColor: tone.bg }}
    >
      <div className="flex items-start gap-3">
        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: tone.line }} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-bold text-[#172228]">{update.projectTitle}</p>
              <p className="mt-1 text-[12px] text-[#7d8b91]">
                {update.createdByName ?? "النظام"} • {formatDate(update.createdAt)}
              </p>
            </div>
            <span className={cn("shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold", tone.badge)}>
              {translateUpdateType(update.updateType)}
            </span>
          </div>
          {update.title ? <p className="mt-3 text-[15px] font-bold text-[#172228]">{update.title}</p> : null}
          <p className="mt-3 text-[14px] leading-7 text-[#55646a]">{update.content}</p>
        </div>
      </div>
    </Link>
  );
}

function DirectorAsideEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[20px] border border-dashed border-[#dce6e7] bg-white px-5 py-8 text-center">
      <p className="text-[15px] font-semibold text-[#172228]">{title}</p>
      <p className="mt-2 text-[13px] leading-6 text-[#7d8b91]">{description}</p>
    </div>
  );
}

export default function DirectorDashboardPage() {
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentFilter>("all");
  const [isScrolled, setIsScrolled] = useState(false);
  const [directorAsideView, setDirectorAsideView] = useState<DirectorAsideView>("calendar");
  const [isAsideCollapsed, setIsAsideCollapsed] = useState(false);
  const [isDepartmentProjectsCollapsed, setIsDepartmentProjectsCollapsed] = useState(false);
  const [isCalendarEventComposerOpen, setIsCalendarEventComposerOpen] = useState(false);
  const [calendarEventTitle, setCalendarEventTitle] = useState("");
  const [calendarEventTime, setCalendarEventTime] = useState("09:00");
  const [calendarEventType, setCalendarEventType] = useState<DirectorCalendarEventType>("meeting");
  const [manualCalendarEvents, setManualCalendarEvents] = useState<DirectorCalendarEvent[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => new Date());

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

  useEffect(() => {
    if (!token || allProjects.length === 0) {
      return;
    }

    const connection = createProjectHubConnection(token);
    let mounted = true;

    connection.on("task:statusChanged", (payload: { projectId: number }) => {
      void queryClient.invalidateQueries({ queryKey: ["director-project-tasks", payload.projectId] });
      void queryClient.invalidateQueries({ queryKey: ["director-project-detail", payload.projectId] });
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
    });

    connection.on("project:updateAdded", (update: ExecutiveUpdate) => {
      void queryClient.invalidateQueries({ queryKey: ["director-project-detail", update.projectId] });
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
            ? `${formatProjectCountLabel(department.projectCount)} • ${formatArabicNumber(department.members)} عضو`
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

  const taskFlowData = useMemo(
    () =>
      visibleDepartmentPerformance.map((department) => ({
        name: department.shortName,
        جديدة: department.todo,
        "قيد التنفيذ": department.inProgress,
        مراجعة: department.review,
        منتهية: department.done,
        "توجد مشكلة": department.blocked,
      })),
    [visibleDepartmentPerformance],
  );

  const statusChartData = useMemo<DirectorStatusSummary[]>(() => {
    const projectsByStatus = new Map<DirectorStatusSummary["key"], DirectorProjectReference[]>();

    filteredProjects.forEach((project) => {
      const status = (isCompletedProject(project) ? "Completed" : project.status) as DirectorStatusSummary["key"];
      const current = projectsByStatus.get(status) ?? [];
      current.push({ id: project.id, title: project.title });
      projectsByStatus.set(status, current);
    });

    return [
      {
        key: "Active" as const,
        name: "نشط",
        value: projectsByStatus.get("Active")?.length ?? 0,
        color: statusPalette.Active,
        projects: projectsByStatus.get("Active") ?? [],
      },
      {
        key: "Planning" as const,
        name: "تخطيط",
        value: projectsByStatus.get("Planning")?.length ?? 0,
        color: statusPalette.Planning,
        projects: projectsByStatus.get("Planning") ?? [],
      },
      {
        key: "OnHold" as const,
        name: "معلّق",
        value: projectsByStatus.get("OnHold")?.length ?? 0,
        color: statusPalette.OnHold,
        projects: projectsByStatus.get("OnHold") ?? [],
      },
      {
        key: "Completed" as const,
        name: "مكتمل",
        value: projectsByStatus.get("Completed")?.length ?? 0,
        color: statusPalette.Completed,
        projects: projectsByStatus.get("Completed") ?? [],
      },
      {
        key: "Cancelled" as const,
        name: "ملغي",
        value: projectsByStatus.get("Cancelled")?.length ?? 0,
        color: statusPalette.Cancelled,
        projects: projectsByStatus.get("Cancelled") ?? [],
      },
    ].filter((entry) => entry.value > 0);
  }, [filteredProjects]);

  const statusDistributionGradient = useMemo(() => {
    if (!statusChartData.length) {
      return "conic-gradient(#dce8e9 0 100%)";
    }

    const total = statusChartData.reduce((sum, entry) => sum + entry.value, 0);
    let cursor = 0;

    const segments = statusChartData.map((entry) => {
      const start = cursor;
      const portion = total ? (entry.value / total) * 100 : 0;
      cursor += portion;
      return `${entry.color} ${start}% ${cursor}%`;
    });

    return `conic-gradient(${segments.join(", ")})`;
  }, [statusChartData]);

  const leadingProjectStatus = useMemo(() => {
    if (!statusChartData.length) {
      return null;
    }

    const total = statusChartData.reduce((sum, entry) => sum + entry.value, 0);
    const dominant = statusChartData.reduce((top, entry) => (entry.value > top.value ? entry : top), statusChartData[0]);

    return {
      ...dominant,
      percent: total ? clampPercentage((dominant.value / total) * 100) : 0,
    };
  }, [statusChartData]);

  const workloadData = useMemo(() => {
    const projectTitleById = new Map(filteredProjects.map((project) => [project.id, project.title]));
    const workloadMap = new Map<
      string,
      {
        open: number;
        critical: number;
        hours: number;
        done: number;
        projects: Set<string>;
        tasks: DirectorWorkloadTaskReference[];
      }
    >();

    filteredTasks.forEach((task) => {
      const assigneeNames =
        task.assignees && task.assignees.length
          ? task.assignees.map((assignee) => assignee.userName)
          : task.assignedToName
            ? [task.assignedToName]
            : [task.createdByName ?? "النظام"];
      const projectTitle = projectTitleById.get(task.projectId) ?? "مشروع غير معروف";

      assigneeNames.forEach((name) => {
        const current = workloadMap.get(name) ?? {
          open: 0,
          critical: 0,
          hours: 0,
          done: 0,
          projects: new Set<string>(),
          tasks: [],
        };
        current.hours += task.estimatedHours || 0;
        if (task.status === "Done") current.done += 1;
        else current.open += 1;
        if (task.priority === "Critical" || task.priority === "High") current.critical += 1;
        current.projects.add(projectTitle);
        current.tasks.push({
          id: task.id,
          title: task.title,
          projectTitle,
          status: task.status,
        });
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
        projects: Array.from(stats.projects),
        tasks: stats.tasks.slice(0, 5),
        score: stats.open * 10 + stats.critical * 8 + stats.hours,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }, [filteredProjects, filteredTasks]);

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

  const executiveFeed = useMemo<DirectorExecutiveFeedItem[]>(() => {
    return filteredDetails
      .flatMap((detail) =>
        detail.recentUpdates.map((update) => ({
          id: `director-update-${update.id}`,
          projectId: detail.project.id,
          projectTitle: detail.project.title,
          title: update.title,
          content: update.content,
          updateType: update.updateType,
          createdByName: update.createdByName,
          createdAt: update.createdAt,
        })),
      )
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  }, [filteredDetails]);

  const departmentProjectsDirectory = useMemo(() => {
    return filteredProjects
      .map((project) => {
        const detail = filteredDetails.find((entry) => entry.project.id === project.id);
        const managerFromMembers = detail?.members.find((member) => {
          const role = member.roleInProject.trim().toLowerCase();
          return role.includes("manager") || role.includes("مدير") || role.includes("owner") || role.includes("lead");
        });

        return {
          id: project.id,
          title: project.title,
          startDate: project.startDate,
          endDate: project.endDate,
          managerName: project.projectManagerName || managerFromMembers?.userName || "غير محدد",
          departmentName: project.responsibleDepartmentName || "قسم غير محدد",
        };
      })
      .sort((left, right) => new Date(left.startDate).getTime() - new Date(right.startDate).getTime());
  }, [filteredDetails, filteredProjects]);

  const activeDepartmentTab = useMemo(
    () => departmentTabs.find((tab) => tab.key === selectedDepartment) ?? departmentTabs[0],
    [departmentTabs, selectedDepartment],
  );
  const activeAsideTab = useMemo(
    () => directorAsideTabs.find((tab) => tab.key === directorAsideView) ?? directorAsideTabs[0],
    [directorAsideView],
  );
  const ActiveAsideIcon = activeAsideTab.icon;

  const calendarDays = useMemo(() => buildCalendarCells(calendarMonth), [calendarMonth]);
  const selectedCalendarDateKey = getDateKey(selectedCalendarDate);
  const calendarHeading = getCalendarDateLabel(selectedCalendarDate);
  const calendarMonthHeading = getCalendarDateLabel(calendarMonth);

  const directorScheduleItems = useMemo<DirectorScheduleItem[]>(() => {
    const projectEvents = filteredProjects.flatMap((project) => {
      const events: DirectorScheduleItem[] = [];
      const startDateKey = getDateKeyFromValue(project.startDate);
      const endDateKey = getDateKeyFromValue(project.endDate);
      const accent = getDirectorProjectAccent(project.type);

      if (startDateKey) {
        events.push({
          id: `director-project-start-${project.id}`,
          title: project.title,
          subtitle: "بداية المشروع",
          time: "طوال اليوم",
          timeMinutes: null,
          dateKey: startDateKey,
          accent,
          sortValue: 9 * 60,
          note: getDepartmentMeta(project).name,
        });
      }

      if (endDateKey) {
        events.push({
          id: `director-project-end-${project.id}`,
          title: project.title,
          subtitle: "الموعد المخطط للانتهاء",
          time: "طوال اليوم",
          timeMinutes: null,
          dateKey: endDateKey,
          accent: isCompletedProject(project) ? "teal" : "amber",
          sortValue: 16 * 60,
          note: `نسبة الإنجاز ${percentage(project.progressPercent)}`,
        });
      }

      return events;
    });

    const customEvents = manualCalendarEvents.map((event) => {
      const timeMinutes = parseTimeValueToMinutes(event.time) ?? 9 * 60;

      return {
        id: `director-calendar-${event.id}`,
        title: event.title,
        subtitle: translateCalendarEventType(event.type),
        time: formatMinutesAsArabicTime(timeMinutes),
        timeMinutes,
        dateKey: event.dateKey,
        accent: getCalendarEventAccent(event.type),
        sortValue: timeMinutes,
        note: "حدث تمت إضافته من صفحة رئيس الدائرة",
      } satisfies DirectorScheduleItem;
    });

    return [...projectEvents, ...customEvents].sort((left, right) => {
      return left.dateKey.localeCompare(right.dateKey) || left.sortValue - right.sortValue || left.title.localeCompare(right.title);
    });
  }, [filteredProjects, manualCalendarEvents]);

  const calendarEventsByDay = useMemo(() => {
    return directorScheduleItems.reduce((map, item) => {
      const current = map.get(item.dateKey) ?? [];
      current.push(item);
      map.set(item.dateKey, current);
      return map;
    }, new Map<string, DirectorScheduleItem[]>());
  }, [directorScheduleItems]);

  const selectedDateEvents = useMemo(
    () => calendarEventsByDay.get(selectedCalendarDateKey) ?? [],
    [calendarEventsByDay, selectedCalendarDateKey],
  );

  const handleCalendarMonthChange = (direction: -1 | 1) => {
    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
  };

  const handleCalendarDateSelect = (date: Date) => {
    setSelectedCalendarDate(date);
    setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  };

  const handleAddCalendarEvent = () => {
    const title = calendarEventTitle.trim();
    if (!title) {
      return;
    }

    setManualCalendarEvents((current) => [
      {
        id: Date.now(),
        title,
        dateKey: selectedCalendarDateKey,
        time: calendarEventTime,
        type: calendarEventType,
      },
      ...current,
    ]);
    setCalendarEventTitle("");
    setIsCalendarEventComposerOpen(false);
  };

  return (
    <div dir="rtl" className="h-screen overflow-hidden bg-[#f7fbfb]">
      <div className="flex h-screen w-full overflow-hidden bg-[#f7fbfb]">
        <section
          className="order-last m-2 h-[calc(100vh-1rem)] min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-[34px] bg-[#eef7f8] px-5 pb-10 sm:px-6 lg:px-8"
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
              رئيس الدائرة
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
              <div className="mt-5 text-[#11272c]">
                <h1 className="text-[38px] font-semibold tracking-[-0.06em] text-[#12262b] lg:text-[46px]">
                  لوحة إشراف شاملة على الأقسام والمشاريع
                </h1>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[28px] bg-white/88 p-5 shadow-[0_22px_48px_-34px_rgba(12,54,58,0.24)]">
                <p className="text-[12px] font-semibold text-[#7d8b90]">ميزانية المشاريع</p>
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

              <div className="relative rounded-[28px] bg-[#11272c] p-5 text-white shadow-[0_26px_56px_-38px_rgba(10,76,74,0.34)]">
                <Link
                  href="#attention-board"
                  title="الانتقال إلى لوحة التنبيهات"
                  aria-label="الانتقال إلى لوحة التنبيهات"
                  className="absolute left-5 top-5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#11272c] transition hover:bg-[#f4f7f8]"
                >
                  <ArrowLeft className="h-4 w-4 text-black" />
                </Link>
                <p className="text-[12px] font-semibold text-white/70">المشهد التنفيذي</p>
                <p className="mt-3 text-[30px] font-semibold tracking-[-0.05em]">{attentionBoard.length}</p>
                <p className="mt-2 text-[13px] leading-6 text-white/75">
                  مشروع يحتاج إلى متابعة قريبة بسبب التأخير أو وجود مشكلة أو اقتراب نهاية المدة.
                </p>
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-[12px] font-semibold text-white/90">
                  <TriangleAlert className="h-4 w-4" />
                  {blockedTasksCount} مهام توجد بها مشكلة
                </div>
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

        <section className="mt-8 rounded-[34px] border border-white/80 bg-white/72 p-4 shadow-[0_28px_58px_-40px_rgba(12,54,58,0.18)] backdrop-blur-xl sm:p-5">
          <div className="overflow-x-auto border-b border-[#dce7e8]">
            <ul className="-mb-px flex min-w-max flex-nowrap gap-1 text-sm font-medium text-[#7a8a8f]">
              {departmentTabs.map((tab) => {
                const active = selectedDepartment === tab.key;
                const accentColor = tab.key === "all" ? "#11272c" : tab.color;
                const TabIcon = tab.key === "all" ? Layers : FolderKanban;

                return (
                  <li key={String(tab.key)} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedDepartment(tab.key)}
                      title={tab.hint}
                      className={cn(
                        "group inline-flex items-center justify-center gap-2 rounded-t-[20px] border-b-2 px-4 py-4 text-[14px] font-semibold transition",
                        active
                          ? "bg-white text-[#111517] shadow-[0_16px_30px_-24px_rgba(12,54,58,0.16)]"
                          : "border-transparent text-[#7a8a8f] hover:text-[#172228]",
                      )}
                      style={active ? { borderBottomColor: accentColor } : undefined}
                    >
                      <TabIcon
                        className={cn("h-4 w-4 transition", active ? "text-current" : "text-[#97a6ab] group-hover:text-[#172228]")}
                      />
                      <span className="whitespace-nowrap">{tab.label}</span>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold transition",
                          active ? "text-white" : "bg-[#eef4f5] text-[#718287]",
                        )}
                        style={active ? { backgroundColor: accentColor } : undefined}
                      >
                        {tab.projectCount}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="bg-white px-5 py-6 sm:px-6 sm:py-7">
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
                  {selectedDepartment === "all" ? "نظرة شاملة" : "القسم المحدد"}
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
                  {formatProjectCountLabel(activeDepartmentTab.projectCount)}
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

            <DirectorSection
              className="mb-6"
              title="مشاريع القسم"
              subtitle="يعرض اسم المشروع، تاريخ البداية، تاريخ الانتهاء، واسم المسؤول المباشر."
              action={
                <div className="flex items-center gap-2 self-start">
                  <span className="inline-flex items-center rounded-full bg-[#f4f7f8] px-3 py-1 text-[12px] font-semibold text-[#617278]">
                    {formatProjectCountLabel(departmentProjectsDirectory.length)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsDepartmentProjectsCollapsed((current) => !current)}
                    title={isDepartmentProjectsCollapsed ? "توسيع القسم" : "طي القسم"}
                    aria-label={isDepartmentProjectsCollapsed ? "توسيع القسم" : "طي القسم"}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#f4f7f8] text-[#617278] transition hover:bg-[#eaf1f2] hover:text-[#172228]"
                  >
                    <ChevronDown className={cn("h-4 w-4 transition-transform", isDepartmentProjectsCollapsed && "rotate-180")} />
                  </button>
                </div>
              }
            >
              {!isDepartmentProjectsCollapsed ? (
                departmentProjectsDirectory.length ? (
                <div className="overflow-hidden rounded-[26px] border border-[#e7eeef] bg-[#fbfdfd]">
                  <div className="hidden grid-cols-[minmax(0,1.6fr)_0.85fr_0.85fr_1fr] gap-4 border-b border-[#e7eeef] bg-[#f5f9f9] px-5 py-4 text-[12px] font-bold text-[#6b7c81] md:grid">
                    <span>المشروع</span>
                    <span>تاريخ البداية</span>
                    <span>تاريخ الانتهاء</span>
                    <span>المسؤول</span>
                  </div>

                  <div className="divide-y divide-[#edf2f3]">
                    {departmentProjectsDirectory.map((project) => (
                      <Link
                        key={project.id}
                        href={`/projects/${project.id}`}
                        className="block px-5 py-4 transition hover:bg-[#f8fbfb]"
                      >
                        <div className="hidden items-center gap-4 md:grid md:grid-cols-[minmax(0,1.6fr)_0.85fr_0.85fr_1fr]">
                          <div className="min-w-0">
                            <p className="truncate text-[14px] font-bold text-[#172228]">{project.title}</p>
                            {selectedDepartment === "all" ? (
                              <p className="mt-1 text-[12px] text-[#7c8b90]">{project.departmentName}</p>
                            ) : null}
                          </div>
                          <span className="text-[13px] font-semibold text-[#5f7075]">{formatDate(project.startDate)}</span>
                          <span className="text-[13px] font-semibold text-[#5f7075]">{formatDate(project.endDate)}</span>
                          <span className="truncate text-[13px] font-semibold text-[#172228]">{project.managerName}</span>
                        </div>

                        <div className="space-y-3 md:hidden">
                          <div>
                            <p className="text-[14px] font-bold text-[#172228]">{project.title}</p>
                            {selectedDepartment === "all" ? (
                              <p className="mt-1 text-[12px] text-[#7c8b90]">{project.departmentName}</p>
                            ) : null}
                          </div>
                          <div className="grid gap-2 text-[12px] text-[#617278] sm:grid-cols-3">
                            <div className="rounded-[18px] bg-[#f5f9f9] px-3 py-2">
                              <p className="font-bold text-[#7a8a8f]">البداية</p>
                              <p className="mt-1 font-semibold text-[#172228]">{formatDate(project.startDate)}</p>
                            </div>
                            <div className="rounded-[18px] bg-[#f5f9f9] px-3 py-2">
                              <p className="font-bold text-[#7a8a8f]">الانتهاء</p>
                              <p className="mt-1 font-semibold text-[#172228]">{formatDate(project.endDate)}</p>
                            </div>
                            <div className="rounded-[18px] bg-[#f5f9f9] px-3 py-2">
                              <p className="font-bold text-[#7a8a8f]">المسؤول</p>
                              <p className="mt-1 font-semibold text-[#172228]">{project.managerName}</p>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
                ) : (
                  <DirectorEmptyState message="لا توجد مشاريع ضمن القسم المحدد في نطاق السنة الحالية." />
                )
              ) : (
                <div className="rounded-[24px] border border-dashed border-[#d9e7e8] bg-[#f9fcfc] px-5 py-6 text-center text-[14px] text-[#7d8b91]">
                  تم طي هذا القسم.
                </div>
              )}
            </DirectorSection>

            <DirectorSection
              className="mb-6"
              title="حركة المهام عبر الأقسام"
              subtitle="تجميع لحظي لمراحل المهام داخل كل قسم لمعرفة أين تتكدس الأعمال."
              collapsible
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
                      <Bar dataKey="توجد مشكلة" stackId="tasks" fill={taskPalette.Blocked} radius={[10, 10, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <DirectorEmptyState message="لا توجد مهام كافية لرسم حركة تشغيلية واضحة بين الأقسام." />
              )}
            </DirectorSection>

            <div className="space-y-8">
              <div className="grid items-start gap-8 xl:grid-cols-2">
                <DirectorSection
                  className="h-full"
                  title="مؤشر الإنجاز"
                  subtitle="قراءة مركزة لمستوى الإنجاز وكفاءة إغلاق المهام واستهلاك الميزانية."
                  collapsible
                >
              <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr] xl:grid-cols-[0.88fr_1.12fr]">
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
                        <p className="text-[12px] font-semibold text-[#7b8b90]">مؤشر الإنجاز</p>
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
                  className="h-full"
                  title="توزيع حالة المشاريع"
                  subtitle="كيف تتوزع المبادرات الحالية بين التخطيط والتنفيذ والإغلاق."
                  collapsible
                >
              {statusChartData.length ? (
                <div className="grid gap-5 lg:grid-cols-[0.82fr_1.18fr] xl:grid-cols-[0.78fr_1.22fr]">
                  <div className="rounded-[28px] bg-[linear-gradient(180deg,#f8fcfc_0%,#eef7f8_100%)] p-5 text-center">
                    <div className="relative mx-auto h-44 w-44 rounded-full" style={{ background: statusDistributionGradient }}>
                      <div className="absolute inset-[16px] rounded-full bg-white shadow-[inset_0_0_0_1px_rgba(223,234,235,0.9)]" />
                      <div className="absolute inset-0 grid place-items-center">
                        <div>
                          <p className="text-[12px] font-semibold text-[#7b8b90]">إجمالي المشاريع</p>
                          <p className="mt-2 text-[34px] font-semibold tracking-[-0.05em] text-[#12262b]">
                            {filteredProjects.length}
                          </p>
                          <p className="text-[12px] font-semibold" style={{ color: leadingProjectStatus?.color ?? "#0d7573" }}>
                            {leadingProjectStatus ? `الأكثر: ${leadingProjectStatus.name}` : "مشروع"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {statusChartData.map((status) => (
                      <div key={status.name} className="flex items-center justify-between rounded-[22px] bg-[#f8fbfb] px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: status.color }} />
                          <span className="text-[13px] font-semibold text-[#223238]">{status.name}</span>
                          <DirectorInlinePopover
                            label={`عرض مشاريع حالة ${status.name}`}
                            title={`المشاريع ضمن حالة ${status.name}`}
                          >
                            {status.projects.map((project) => (
                              <p key={project.id} className="rounded-[14px] bg-[#f8fbfb] px-3 py-2 font-semibold text-[#223238]">
                                {project.title}
                              </p>
                            ))}
                          </DirectorInlinePopover>
                        </div>
                        <div className="text-left">
                          <p className="text-[14px] font-semibold text-[#12262b]">{status.value}</p>
                          <p className="text-[11px] font-semibold text-[#7b8b90]">
                            {percentage(filteredProjects.length ? (status.value / filteredProjects.length) * 100 : 0)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <DirectorEmptyState message="لا يوجد توزيع حالات متاح بعد ضمن هذا النطاق." />
              )}
                </DirectorSection>
              </div>

              <div className="grid items-start gap-8 xl:grid-cols-2">
                <DirectorSection
                  className="h-full"
                  title="الموظفين والمهام"
                  subtitle="أعلى الأعضاء انشغالاً حالياً بناءً على المهام المفتوحة والمهام الحرجة."
                  collapsible
                >
                  {workloadData.length ? (
                    <div className="space-y-3">
                      {workloadData.map((member) => (
                        <div key={member.name} className="rounded-[24px] bg-[#f9fcfc] px-4 py-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-[15px] font-semibold text-[#172228]">{member.name}</p>
                              <p className="mt-1 text-[12px] text-[#7e8c91]">
                                {member.open} مفتوحة • {member.critical} حرجة • {member.done} منتهية
                              </p>
                            </div>
                            <DirectorInlinePopover
                              align="left"
                              label={`عرض تفاصيل ${member.name}`}
                              title={`تفاصيل ${member.name}`}
                            >
                              <div className="space-y-3">
                                <div>
                                  <p className="text-[11px] font-bold text-[#7b8b90]">المشاريع</p>
                                  <div className="mt-2 space-y-2">
                                    {member.projects.map((project) => (
                                      <p key={`${member.name}-${project}`} className="rounded-[14px] bg-[#f8fbfb] px-3 py-2 font-semibold text-[#223238]">
                                        {project}
                                      </p>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <p className="text-[11px] font-bold text-[#7b8b90]">المهام</p>
                                  <div className="mt-2 space-y-2">
                                    {member.tasks.map((task) => (
                                      <div key={task.id} className="rounded-[14px] bg-[#f8fbfb] px-3 py-2">
                                        <p className="font-semibold text-[#223238]">{task.title}</p>
                                        <p className="mt-1 text-[11px] text-[#6f8085]">
                                          {task.projectTitle} • {translateTaskStatus(task.status)}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </DirectorInlinePopover>
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

                <DirectorSection
                  className="h-full"
                  id="attention-board"
                  title="لوحة التنبيهات"
                  subtitle="العناصر التي تتطلب تدخلاً تنفيذياً أو إعادة ترتيب أولويات."
                  collapsible
                  action={
                    <span className="inline-flex items-center rounded-full bg-[#fff1ec] px-3 py-1 text-[12px] font-semibold text-[#cf6247]">
                      {formatArabicNumber(attentionBoard.length)} حالة مراقبة
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
                          توجد مشكلة {project.blocked}
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
                <DirectorEmptyState message="لا توجد حالات حرجة حالياً، وضع المشاريع مستقر ضمن هذا النطاق." />
              )}
                </DirectorSection>
              </div>
            </div>

          </div>
        </section>

        </section>

        {isAsideCollapsed ? (
          <aside
            dir="rtl"
            className="order-first relative m-2 h-[calc(100vh-1rem)] w-full max-w-[96px] overflow-y-auto overscroll-contain rounded-[34px] border border-[#eff3f4] bg-white px-3 pb-4 pt-7 shadow-[0_28px_70px_-52px_rgba(12,54,58,0.35)]"
          >
            <div className="flex w-full justify-center">
              <div className="grid h-12 w-12 place-items-center rounded-[20px] bg-[#f4f7f8] text-[#0d7573] shadow-[0_20px_35px_-28px_rgba(10,76,74,0.18)]">
                <ActiveAsideIcon className="h-5 w-5" />
              </div>
            </div>
          </aside>
        ) : (
          <DirectorCalendarAside
            activeView={directorAsideView}
            calendarDays={calendarDays}
            calendarEventsByDay={calendarEventsByDay}
            calendarEventTime={calendarEventTime}
            calendarEventTitle={calendarEventTitle}
            calendarEventType={calendarEventType}
            calendarHeading={calendarHeading}
            calendarMonthHeading={calendarMonthHeading}
            executiveUpdates={executiveFeed}
            isCalendarEventComposerOpen={isCalendarEventComposerOpen}
            onAddCalendarEvent={handleAddCalendarEvent}
            onCalendarDateSelect={handleCalendarDateSelect}
            onCalendarEventTimeChange={setCalendarEventTime}
            onCalendarEventTitleChange={setCalendarEventTitle}
            onCalendarEventTypeChange={setCalendarEventType}
            onCalendarMonthChange={handleCalendarMonthChange}
            onComposerToggle={() => setIsCalendarEventComposerOpen((current) => !current)}
            onViewChange={setDirectorAsideView}
            selectedCalendarDateKey={selectedCalendarDateKey}
            selectedDateEvents={selectedDateEvents}
          />
        )}
      </div>
    </div>
  );
}
