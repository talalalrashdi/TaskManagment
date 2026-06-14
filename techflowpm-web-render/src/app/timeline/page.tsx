"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  FolderKanban,
  Layers3,
  Pencil,
  Plus,
  Sparkles,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { GanttTimeline } from "@/components/projects/gantt-timeline";
import { Button, Card, Input, Select } from "@/components/ui/primitives";
import { cn, percentage } from "@/lib/utils";
import type { ProjectTimelineItem } from "@/types/domain";

type TimelineAsideView = "calendar" | "updates" | "tasks";
type TimelineCalendarEventType = "meeting" | "delivery" | "call" | "other";
type TimelineAccent = "teal" | "amber" | "coral";

type TimelineCalendarEvent = {
  id: number;
  title: string;
  dateKey: string;
  time: string;
  type: TimelineCalendarEventType;
};

type CalendarDayCell = {
  date: Date;
  dateKey: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
};

type TimelineScheduleItem = {
  id: string;
  title: string;
  subtitle: string;
  time: string;
  timeMinutes: number | null;
  dateKey: string;
  accent: TimelineAccent;
  sortValue: number;
  note?: string;
};

const departmentOptions = [
  { id: "", label: "كل الأقسام" },
  { id: "1", label: "قسم البرمجيات" },
  { id: "2", label: "قسم الشبكات" },
  { id: "3", label: "قسم الحماية" },
  { id: "4", label: "قسم الصيانة" },
];

const typeOptions = [
  { value: "", label: "كل الأنواع" },
  { value: "Software", label: "برمجيات" },
  { value: "Networks", label: "شبكات" },
  { value: "Cybersecurity", label: "أمن سيبراني" },
  { value: "Maintenance", label: "صيانة" },
];

const statusOptions = [
  { value: "", label: "كل الحالات" },
  { value: "Planning", label: "تخطيط" },
  { value: "Active", label: "نشط" },
  { value: "OnHold", label: "معلق" },
  { value: "Completed", label: "مكتمل" },
  { value: "Cancelled", label: "ملغي" },
];

const timelineAsideTabs = [
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
const calendarEventTypeOptions: Array<{ key: TimelineCalendarEventType; label: string }> = [
  { key: "meeting", label: "اجتماع" },
  { key: "delivery", label: "تسليم" },
  { key: "call", label: "مكالمة" },
  { key: "other", label: "أخرى" },
];

function isTimelineProjectCompleted(item: ProjectTimelineItem) {
  return item.status === "Completed" || item.progressPercent >= 100;
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

function getProjectTimelineAccent(type: ProjectTimelineItem["type"]): TimelineAccent {
  if (type === "Cybersecurity" || type === "Maintenance") {
    return "coral";
  }

  if (type === "Networks") {
    return "amber";
  }

  return "teal";
}

function getCalendarEventAccent(type: TimelineCalendarEventType): TimelineAccent {
  if (type === "delivery") return "amber";
  if (type === "call") return "coral";
  return "teal";
}

function translateCalendarEventType(type: TimelineCalendarEventType) {
  return (
    {
      meeting: "اجتماع",
      delivery: "تسليم",
      call: "مكالمة",
      other: "أخرى",
    }[type] ?? "أخرى"
  );
}

export default function TimelinePage() {
  const [isTimelineContentScrolled, setIsTimelineContentScrolled] = useState(false);
  const [timelineAsideView, setTimelineAsideView] = useState<TimelineAsideView>("calendar");
  const [isAsideCollapsed, setIsAsideCollapsed] = useState(false);
  const [isCalendarEventComposerOpen, setIsCalendarEventComposerOpen] = useState(false);
  const [calendarEventTitle, setCalendarEventTitle] = useState("");
  const [calendarEventTime, setCalendarEventTime] = useState("09:00");
  const [calendarEventType, setCalendarEventType] = useState<TimelineCalendarEventType>("meeting");
  const [manualCalendarEvents, setManualCalendarEvents] = useState<TimelineCalendarEvent[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => new Date());
  const [filters, setFilters] = useState({
    year: new Date().getFullYear(),
    type: "",
    status: "",
    departmentId: "",
  });

  const timelineQuery = useQuery({
    queryKey: ["project-timeline", filters],
    queryFn: () =>
      apiClient
        .get<ProjectTimelineItem[]>("/projects/timeline", {
          year: filters.year,
          type: filters.type,
          status: filters.status,
          departmentId: filters.departmentId,
        })
        .then((response) => response.data),
  });

  const items = useMemo(() => timelineQuery.data ?? [], [timelineQuery.data]);

  const stats = useMemo(() => {
    const activeCount = items.filter((item) => item.status === "Active" && !isTimelineProjectCompleted(item)).length;
    const completedCount = items.filter((item) => isTimelineProjectCompleted(item)).length;
    const averageProgress = items.length > 0 ? items.reduce((sum, item) => sum + item.progressPercent, 0) / items.length : 0;
    const thisMonth = new Date(filters.year, new Date().getMonth(), 1);
    const nextMonth = new Date(filters.year, new Date().getMonth() + 1, 1);
    const dueSoonCount = items.filter((item) => {
      const end = new Date(item.endDate);
      return end >= thisMonth && end < nextMonth;
    }).length;

    return { activeCount, completedCount, averageProgress, dueSoonCount };
  }, [filters.year, items]);

  const calendarDays = useMemo(() => buildCalendarCells(calendarMonth), [calendarMonth]);
  const selectedCalendarDateKey = getDateKey(selectedCalendarDate);
  const calendarHeading = getCalendarDateLabel(selectedCalendarDate);
  const calendarMonthHeading = getCalendarDateLabel(calendarMonth);

  const scheduleItems = useMemo<TimelineScheduleItem[]>(() => {
    const projectEvents = items.flatMap((item) => {
      const events: TimelineScheduleItem[] = [];
      const startDateKey = getDateKeyFromValue(item.startDate);
      const endDateKey = getDateKeyFromValue(item.endDate);
      const accent = getProjectTimelineAccent(item.type);

      if (startDateKey) {
        events.push({
          id: `timeline-project-start-${item.id}`,
          title: item.title,
          subtitle: "بداية المشروع",
          time: "طوال اليوم",
          timeMinutes: null,
          dateKey: startDateKey,
          accent,
          sortValue: 9 * 60,
          note: item.responsibleDepartmentName ?? undefined,
        });
      }

      if (endDateKey) {
        events.push({
          id: `timeline-project-end-${item.id}`,
          title: item.title,
          subtitle: "الموعد المخطط للانتهاء",
          time: "طوال اليوم",
          timeMinutes: null,
          dateKey: endDateKey,
          accent: isTimelineProjectCompleted(item) ? "teal" : "amber",
          sortValue: 16 * 60,
          note: `نسبة الإنجاز ${percentage(item.progressPercent)}`,
        });
      }

      return events;
    });

    const customEvents = manualCalendarEvents.map((event) => {
      const timeMinutes = parseTimeValueToMinutes(event.time) ?? 9 * 60;

      return {
        id: `timeline-calendar-${event.id}`,
        title: event.title,
        subtitle: translateCalendarEventType(event.type),
        time: formatMinutesAsArabicTime(timeMinutes),
        timeMinutes,
        dateKey: event.dateKey,
        accent: getCalendarEventAccent(event.type),
        sortValue: timeMinutes,
        note: "حدث تمت إضافته من صفحة الجدول الزمني",
      } satisfies TimelineScheduleItem;
    });

    return [...projectEvents, ...customEvents].sort((left, right) => {
      return left.dateKey.localeCompare(right.dateKey) || left.sortValue - right.sortValue || left.title.localeCompare(right.title);
    });
  }, [items, manualCalendarEvents]);

  const calendarEventsByDay = useMemo(() => {
    return scheduleItems.reduce((map, item) => {
      const current = map.get(item.dateKey) ?? [];
      current.push(item);
      map.set(item.dateKey, current);
      return map;
    }, new Map<string, TimelineScheduleItem[]>());
  }, [scheduleItems]);

  const selectedDateEvents = useMemo(
    () => calendarEventsByDay.get(selectedCalendarDateKey) ?? [],
    [calendarEventsByDay, selectedCalendarDateKey],
  );
  const activeAsideTab = useMemo(
    () => timelineAsideTabs.find((tab) => tab.key === timelineAsideView) ?? timelineAsideTabs[0],
    [timelineAsideView],
  );
  const ActiveAsideIcon = activeAsideTab.icon;

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
    <div dir="ltr" className="h-screen overflow-hidden bg-[#f7fbfb]">
      <div className="flex h-screen w-full overflow-hidden bg-[#f7fbfb]">
        <section
          className="m-2 h-[calc(100vh-1rem)] min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-[34px] bg-[#eef7f8] px-5 pb-6 sm:px-6 lg:px-8 lg:pb-8"
          onScroll={(event) => {
            const isScrolled = event.currentTarget.scrollTop > 8;
            setIsTimelineContentScrolled((current) => (current === isScrolled ? current : isScrolled));
          }}
        >
        <header
          dir="rtl"
          className={cn(
            "sticky top-3 z-30 mt-3 flex flex-col gap-4 rounded-[30px] px-5 py-4 transition-all duration-300 lg:flex-row lg:items-center lg:justify-between",
            isTimelineContentScrolled
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
            {isAsideCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <Link
              href="/dashboard"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-white px-4 text-[13px] font-semibold text-[#1d7775] shadow-[0_18px_30px_-26px_rgba(10,76,74,0.28)] transition duration-200 hover:-translate-y-0.5"
            >
              <ArrowLeft className="h-4 w-4" />
              لوحة العمليات
            </Link>
            <span className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#0d7573] px-4 text-[13px] font-semibold text-white shadow-[0_20px_36px_-24px_rgba(13,117,115,0.7)]">
              <CalendarDays className="h-4 w-4" />
              الجدول الزمني
            </span>
            <Link
              href="/director"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-white px-4 text-[13px] font-semibold text-[#173036] shadow-[0_18px_30px_-26px_rgba(10,76,74,0.28)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#f7fbfb]"
            >
              <Sparkles className="h-4 w-4 text-[#f0b819]" />
              مدير الدائرة
            </Link>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              value={String(filters.year)}
              onChange={(event) => setFilters((current) => ({ ...current, year: Number(event.target.value) }))}
              className="h-11 rounded-2xl border border-white/80 bg-white/88 px-4 text-sm font-semibold text-[#173036] outline-none transition focus:border-[#0d7573] focus:ring-2 focus:ring-[#0d7573]/15"
            >
              {Array.from({ length: 5 }).map((_, index) => {
                const year = new Date().getFullYear() - 1 + index;
                return (
                  <option key={year} value={year}>
                    سنة {year}
                  </option>
                );
              })}
            </select>
          </div>
        </header>

        <div className="space-y-6 pt-9" dir="rtl">
          <div className="overflow-hidden rounded-[34px] bg-[linear-gradient(135deg,#eef7f8,#f8fcfc)] shadow-[0_28px_80px_-44px_rgba(10,76,74,0.28)]">
            <div className="px-6 py-7 lg:px-8">
              <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-[#0d7573] shadow-[0_20px_38px_-30px_rgba(13,117,115,0.4)]">
                    <Layers3 className="h-4 w-4" />
                    الجدول العام للمشاريع
                  </div>

                  <h1 className="mt-5 text-[36px] font-semibold tracking-[-0.05em] text-[#12262b] lg:text-[44px]">
                    خارطة تنفيذ جميع المشاريع خلال العام
                  </h1>
                  <p className="mt-3 max-w-2xl text-[15px] leading-8 text-[#6c7c82]">
                    صفحة موحدة لمتابعة تواريخ البدء والانتهاء ونسب التقدم لكل مشروع، مع فلترة سريعة حسب النوع والحالة والقسم المسؤول.
                  </p>
                </div>

                <div className="h-fit self-start rounded-[30px] bg-white/88 p-5 shadow-[0_28px_56px_-42px_rgba(12,54,58,0.26)]">
                  <p className="text-[13px] font-semibold text-[#7b8b90]">إعدادات العرض</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Select
                      value={String(filters.year)}
                      onChange={(event) => setFilters((current) => ({ ...current, year: Number(event.target.value) }))}
                      className="h-11 border-[#e2ebec] bg-[#fbfdfd]"
                    >
                      {Array.from({ length: 5 }).map((_, index) => {
                        const year = new Date().getFullYear() - 1 + index;
                        return (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        );
                      })}
                    </Select>

                    <Select
                      value={filters.type}
                      onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}
                      className="h-11 border-[#e2ebec] bg-[#fbfdfd]"
                    >
                      {typeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>

                    <Select
                      value={filters.status}
                      onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
                      className="h-11 border-[#e2ebec] bg-[#fbfdfd]"
                    >
                      {statusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>

                    <Select
                      value={filters.departmentId}
                      onChange={(event) => setFilters((current) => ({ ...current, departmentId: event.target.value }))}
                      className="h-11 border-[#e2ebec] bg-[#fbfdfd]"
                    >
                      {departmentOptions.map((option) => (
                        <option key={option.id || "all"} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              </div>

              <div className="mt-7 grid w-full gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <TimelineStatCard label="المشاريع النشطة" value={String(stats.activeCount)} accent="#0d7573" icon={FolderKanban} />
                <TimelineStatCard label="مشاريع مكتملة" value={String(stats.completedCount)} accent="#f0b819" icon={CalendarRange} />
                <TimelineStatCard label="متوسط الإنجاز" value={percentage(stats.averageProgress)} accent="#ff8a69" icon={Clock3} />
                <TimelineStatCard label="تنتهي هذا الشهر" value={String(stats.dueSoonCount)} accent="#64748b" icon={Filter} />
              </div>
            </div>
          </div>

          <div className="grid gap-6">
            <Card className="border border-white/70 bg-white/88 p-0 shadow-[0_26px_56px_-42px_rgba(10,76,74,0.22)]">
              {timelineQuery.isLoading ? (
                <div className="px-6 py-16 text-center text-sm text-slate-500">جارٍ تحميل الجدول الزمني...</div>
              ) : items.length > 0 ? (
                <GanttTimeline year={filters.year} items={items} />
              ) : (
                <div className="px-6 py-16 text-center text-sm text-slate-500">لا توجد بيانات للعرض ضمن الفلاتر الحالية.</div>
              )}
            </Card>
          </div>
        </div>
        </section>

        {isAsideCollapsed ? (
          <aside
            dir="rtl"
            className="relative m-2 h-[calc(100vh-1rem)] w-full max-w-[96px] overflow-y-auto overscroll-contain rounded-[34px] border border-[#eff3f4] bg-white px-3 pb-4 pt-7 shadow-[0_28px_70px_-52px_rgba(12,54,58,0.35)]"
          >
            <div className="flex w-full justify-center">
              <div className="grid h-12 w-12 place-items-center rounded-[20px] bg-[#f4f7f8] text-[#0d7573] shadow-[0_20px_35px_-28px_rgba(10,76,74,0.18)]">
                <ActiveAsideIcon className="h-5 w-5" />
              </div>
            </div>
          </aside>
        ) : (
          <TimelineCalendarAside
            activeView={timelineAsideView}
            calendarDays={calendarDays}
            calendarEventsByDay={calendarEventsByDay}
            calendarEventTime={calendarEventTime}
            calendarEventTitle={calendarEventTitle}
            calendarEventType={calendarEventType}
            calendarHeading={calendarHeading}
            calendarMonthHeading={calendarMonthHeading}
            isCalendarEventComposerOpen={isCalendarEventComposerOpen}
            onAddCalendarEvent={handleAddCalendarEvent}
            onCalendarDateSelect={handleCalendarDateSelect}
            onCalendarEventTimeChange={setCalendarEventTime}
            onCalendarEventTitleChange={setCalendarEventTitle}
            onCalendarEventTypeChange={setCalendarEventType}
            onCalendarMonthChange={handleCalendarMonthChange}
            onComposerToggle={() => setIsCalendarEventComposerOpen((current) => !current)}
            onViewChange={setTimelineAsideView}
            selectedCalendarDateKey={selectedCalendarDateKey}
            selectedDateEvents={selectedDateEvents}
          />
        )}
      </div>
    </div>
  );
}

function TimelineStatCard({
  label,
  value,
  accent,
  icon: Icon,
}: {
  label: string;
  value: string;
  accent: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="w-full rounded-[24px] bg-white/88 px-4 py-4 shadow-[0_20px_40px_-34px_rgba(12,54,58,0.28)]">
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

function TimelineCalendarAside({
  activeView,
  calendarDays,
  calendarEventsByDay,
  calendarEventTime,
  calendarEventTitle,
  calendarEventType,
  calendarHeading,
  calendarMonthHeading,
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
  activeView: TimelineAsideView;
  calendarDays: CalendarDayCell[];
  calendarEventsByDay: Map<string, TimelineScheduleItem[]>;
  calendarEventTime: string;
  calendarEventTitle: string;
  calendarEventType: TimelineCalendarEventType;
  calendarHeading: ReturnType<typeof getCalendarDateLabel>;
  calendarMonthHeading: ReturnType<typeof getCalendarDateLabel>;
  isCalendarEventComposerOpen: boolean;
  onAddCalendarEvent: () => void;
  onCalendarDateSelect: (date: Date) => void;
  onCalendarEventTimeChange: (value: string) => void;
  onCalendarEventTitleChange: (value: string) => void;
  onCalendarEventTypeChange: (value: TimelineCalendarEventType) => void;
  onCalendarMonthChange: (direction: -1 | 1) => void;
  onComposerToggle: () => void;
  onViewChange: (view: TimelineAsideView) => void;
  selectedCalendarDateKey: string;
  selectedDateEvents: TimelineScheduleItem[];
}) {
  return (
    <aside
      dir="rtl"
      className="relative m-2 h-[calc(100vh-1rem)] w-full max-w-[520px] overflow-y-auto overscroll-contain rounded-[34px] border border-[#eff3f4] bg-white px-6 pb-8 shadow-[0_28px_70px_-52px_rgba(12,54,58,0.35)] sm:px-7 lg:px-8"
    >
      <div className="sticky top-0 z-30 -mx-6 bg-transparent px-6 pb-0 pt-7 shadow-none backdrop-blur-0 transition-all duration-300 sm:-mx-7 sm:px-7 lg:-mx-8 lg:px-8">
        <div className="rounded-[22px] bg-[#f4f7f8]/90 p-1.5 backdrop-blur">
          <div className="grid grid-cols-3 gap-2">
            {timelineAsideTabs.map((tab) => {
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
                onClick={() => onCalendarMonthChange(-1)}
                className="grid h-9 w-9 place-items-center rounded-full transition hover:bg-[#f4f7f8] hover:text-[#11272c]"
                aria-label="الشهر السابق"
              >
                <ChevronLeft className="h-7 w-7" />
              </button>
              <button
                type="button"
                onClick={() => onCalendarMonthChange(1)}
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
                    <TimelineScheduleCard key={item.id} item={item} />
                  ))}
                </div>
              ) : (
                <TimelineEmptyState
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
                          onChange={(event) => onCalendarEventTypeChange(event.target.value as TimelineCalendarEventType)}
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
      ) : (
        <div className="mt-8">
          <TimelineEmptyState
            title={activeView === "updates" ? "الموقف التنفيذي مرتبط بلوحة التحكم" : "المهام الشخصية مرتبطة بلوحة التحكم"}
            description="هذا التبويب ظاهر للحفاظ على نفس تركيب اللوحة الجانبية، ويمكن توسيعه لاحقاً داخل صفحة الجدول الزمني."
          />
        </div>
      )}
    </aside>
  );
}

function TimelineScheduleCard({ item }: { item: TimelineScheduleItem }) {
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

function TimelineEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[20px] border border-dashed border-[#dce6e7] bg-white px-5 py-8 text-center">
      <p className="text-[15px] font-semibold text-[#172228]">{title}</p>
      <p className="mt-2 text-[13px] leading-6 text-[#7d8b91]">{description}</p>
    </div>
  );
}
