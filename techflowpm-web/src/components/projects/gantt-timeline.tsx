"use client";

import { useMemo } from "react";
import { Check } from "lucide-react";
import { formatDate, getStatusTone, getTypeColor, percentage } from "@/lib/utils";
import type { ProjectTimelineItem } from "@/types/domain";

const months = [
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

type Props = {
  year: number;
  items: ProjectTimelineItem[];
};

export function GanttTimeline({ year, items }: Props) {
  const yearStart = useMemo(() => new Date(Date.UTC(year, 0, 1)), [year]);
  const yearEnd = useMemo(() => new Date(Date.UTC(year, 11, 31)), [year]);
  const totalDays = useMemo(
    () => Math.floor((yearEnd.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24)) + 1,
    [yearEnd, yearStart],
  );

  return (
    <div className="overflow-hidden rounded-[28px] bg-white/96">
      <div className="grid grid-cols-[300px_1fr] border-b border-[#e5edef] bg-[#f7fbfb] text-sm font-semibold text-[#607277]">
        <div className="border-l border-[#e5edef] px-6 py-4">المشروع</div>
        <div className="grid grid-cols-12">
          {months.map((month) => (
            <div key={month} className="border-l border-[#e5edef] px-2 py-4 text-center text-[12px] font-semibold last:border-l-0">
              {month}
            </div>
          ))}
        </div>
      </div>

      <div className="divide-y divide-[#edf2f3]">
        {items.map((item) => {
          const start = new Date(item.startDate);
          const end = new Date(item.endDate);
          const clippedStart = start < yearStart ? yearStart : start;
          const clippedEnd = end > yearEnd ? yearEnd : end;
          const offsetDays = Math.max(0, Math.floor((clippedStart.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24)));
          const durationDays = Math.max(1, Math.floor((clippedEnd.getTime() - clippedStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
          const right = `${(offsetDays / totalDays) * 100}%`;
          const width = `${(durationDays / totalDays) * 100}%`;
          const typeColor = getTypeColor(item.type);
          const statusColor = getStatusTone(item.status);
          const isCompleted = item.status === "Completed" || item.progressPercent >= 100;
          const barPrimary = item.responsibleDepartmentColor ?? typeColor;
          const barGradient = isCompleted
            ? "linear-gradient(135deg, #27b287, #0d7573)"
            : `linear-gradient(135deg, ${barPrimary}, ${typeColor})`;

          return (
            <div key={item.id} className="grid grid-cols-[300px_1fr] items-stretch">
              <div
                className="border-l border-[#edf2f3] px-6 py-5"
                style={{ backgroundColor: isCompleted ? "#f7fcf9" : "#fcfdfd" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-[#15242a]">{item.title}</p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span
                        className="rounded-full px-3 py-1 text-[11px] font-semibold"
                        style={{
                          color: typeColor,
                          backgroundColor: `color-mix(in srgb, ${typeColor} 14%, white)`,
                        }}
                      >
                        {translateTimelineType(item.type)}
                      </span>
                      <span
                        className="rounded-full px-3 py-1 text-[11px] font-semibold"
                        style={{
                          color: statusColor,
                          backgroundColor: `color-mix(in srgb, ${statusColor} 14%, white)`,
                        }}
                      >
                        {translateTimelineStatus(item.status)}
                      </span>
                    </div>

                    <p className="mt-3 text-[12px] text-[#7b8b90]">
                      {formatDate(item.startDate)} → {formatDate(item.endDate)}
                    </p>
                  </div>

                  <span
                    className="rounded-full px-3 py-1 text-[11px] font-bold"
                    style={{
                      backgroundColor: isCompleted ? "#e9f8f1" : "#f4f7f8",
                      color: isCompleted ? "#1b8f6c" : "#173036",
                    }}
                  >
                    {percentage(item.progressPercent)}
                  </span>
                </div>
              </div>

              <div className="relative min-h-[96px] px-5 py-5">
                <div className="absolute inset-y-0 left-0 right-0 grid grid-cols-12">
                  {months.map((month) => (
                    <div key={month} className="border-l border-[#edf2f3] last:border-l-0" />
                  ))}
                </div>

                <div className="absolute inset-x-5 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-[#edf2f3]" />

                <div className="absolute top-1/2 h-12 -translate-y-1/2" style={{ right, width }}>
                  <div
                    className="relative flex h-full items-center overflow-hidden rounded-[20px] px-4 shadow-[0_20px_36px_-28px_rgba(15,23,42,0.65)] ring-1 ring-white/45"
                    style={{
                      background: barGradient,
                    }}
                    title={`${item.title} • ${percentage(item.progressPercent)}`}
                  >
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.22)_0%,rgba(255,255,255,0.08)_48%,rgba(255,255,255,0)_100%)]" />

                    <div className="relative flex w-full items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-semibold text-white">
                          {item.responsibleDepartmentName ?? "قسم غير محدد"}
                        </p>
                        <p className="mt-0.5 text-[10px] text-white/80">{durationDays} يوم</p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-white/18 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
                            <Check className="h-3 w-3" />
                            مكتمل
                          </span>
                        ) : null}

                        <span className="rounded-full bg-white/16 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
                          {percentage(item.progressPercent)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function translateTimelineType(type: ProjectTimelineItem["type"]) {
  if (type === "Software") return "برمجيات";
  if (type === "Networks") return "شبكات";
  if (type === "Cybersecurity") return "أمن سيبراني";
  return "صيانة";
}

function translateTimelineStatus(status: ProjectTimelineItem["status"]) {
  if (status === "Planning") return "تخطيط";
  if (status === "Active") return "نشط";
  if (status === "OnHold") return "معلق";
  if (status === "Completed") return "مكتمل";
  return "ملغي";
}
