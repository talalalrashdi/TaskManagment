"use client";

import Link from "next/link";
import { LayoutGrid, ListFilter, Rows3 } from "lucide-react";
import { Badge, Button, Card, Input, ProgressBar, SectionHeader, Select, Skeleton } from "@/components/ui/primitives";
import { cn, formatCurrency, formatDate, getStatusTone, getTypeColor, percentage } from "@/lib/utils";
import type { Project } from "@/types/domain";

type Filters = {
  search: string;
  type: string;
  status: string;
  priority: string;
};

type Props = {
  projects: Project[];
  loading?: boolean;
  view: "cards" | "table";
  filters: Filters;
  onViewChange: (view: "cards" | "table") => void;
  onFiltersChange: (next: Filters) => void;
};

export function ProjectViews({
  projects,
  loading,
  view,
  filters,
  onViewChange,
  onFiltersChange,
}: Props) {
  return (
    <div className="space-y-6">
      <Card className="space-y-5">
        <SectionHeader
          title="المشاريع التقنية"
          subtitle="فلترة سريعة حسب النوع والحالة والأولوية مع إمكانية التبديل بين البطاقات والجدول."
          action={
            <div className="flex items-center gap-2">
              <Button
                variant={view === "cards" ? "primary" : "secondary"}
                size="sm"
                onClick={() => onViewChange("cards")}
              >
                <LayoutGrid className="h-4 w-4" />
                كروت
              </Button>
              <Button
                variant={view === "table" ? "primary" : "secondary"}
                size="sm"
                onClick={() => onViewChange("table")}
              >
                <Rows3 className="h-4 w-4" />
                جدول
              </Button>
            </div>
          }
        />

        <div className="grid gap-3 lg:grid-cols-[1.4fr_repeat(3,minmax(0,0.7fr))]">
          <Input
            value={filters.search}
            onChange={(event) =>
              onFiltersChange({ ...filters, search: event.target.value })
            }
            placeholder="ابحث بعنوان المشروع أو وصفه..."
          />
          <Select
            value={filters.type}
            onChange={(event) => onFiltersChange({ ...filters, type: event.target.value })}
          >
            <option value="">كل الأنواع</option>
            <option value="Software">برمجيات</option>
            <option value="Networks">شبكات</option>
            <option value="Cybersecurity">حماية</option>
            <option value="Maintenance">صيانة</option>
          </Select>
          <Select
            value={filters.status}
            onChange={(event) => onFiltersChange({ ...filters, status: event.target.value })}
          >
            <option value="">كل الحالات</option>
            <option value="Planning">Planning</option>
            <option value="Active">Active</option>
            <option value="OnHold">OnHold</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </Select>
          <Select
            value={filters.priority}
            onChange={(event) =>
              onFiltersChange({ ...filters, priority: event.target.value })
            }
          >
            <option value="">كل الأولويات</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Critical">Critical</option>
          </Select>
        </div>
      </Card>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-56 w-full rounded-[30px]" />
          ))}
        </div>
      ) : view === "cards" ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="h-full space-y-5 transition duration-200 hover:-translate-y-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge
                        style={{
                          backgroundColor: `${getTypeColor(project.type)}22`,
                          color: getTypeColor(project.type),
                          borderColor: `${getTypeColor(project.type)}44`,
                        }}
                      >
                        {project.type}
                      </Badge>
                      <Badge
                        style={{
                          backgroundColor: `${getStatusTone(project.status)}20`,
                          color: getStatusTone(project.status),
                          borderColor: `${getStatusTone(project.status)}38`,
                        }}
                      >
                        {project.status}
                      </Badge>
                    </div>
                    <h3 className="mt-4 text-xl font-semibold">{project.title}</h3>
                    <p className="mt-2 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
                      {project.description}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-[var(--surface-muted)] px-3 py-2 text-center">
                    <p className="text-xs text-slate-500 dark:text-slate-400">الأولوية</p>
                    <p className="mt-1 text-sm font-semibold">{project.priority}</p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <Metric title="المدير" value={project.projectManagerName ?? "-"} />
                  <Metric title="الميزانية" value={formatCurrency(project.budget)} />
                  <Metric title="الفريق" value={`${project.teamSize} عضو`} />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">نسبة الإنجاز</span>
                    <span className="font-semibold">{percentage(project.progressPercent)}</span>
                  </div>
                  <ProgressBar value={project.progressPercent} />
                </div>

                <div className="flex items-center justify-between border-t border-[var(--border)] pt-4 text-sm text-slate-500 dark:text-slate-400">
                  <span>من {formatDate(project.startDate)}</span>
                  <span>إلى {formatDate(project.endDate)}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="min-w-full text-right text-sm">
              <thead className="bg-[var(--surface-muted)] text-slate-500 dark:text-slate-400">
                <tr>
                  {["المشروع", "النوع", "الحالة", "المدير", "الميزانية", "الإنجاز"].map((head) => (
                    <th key={head} className="px-5 py-4 font-medium">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id} className="border-t border-[var(--border)]">
                    <td className="px-5 py-4">
                      <Link href={`/projects/${project.id}`} className="block">
                        <p className="font-semibold">{project.title}</p>
                        <p className="mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
                          {project.description}
                        </p>
                      </Link>
                    </td>
                    <td className="px-5 py-4">
                      <Badge
                        style={{
                          backgroundColor: `${getTypeColor(project.type)}22`,
                          color: getTypeColor(project.type),
                          borderColor: `${getTypeColor(project.type)}44`,
                        }}
                      >
                        {project.type}
                      </Badge>
                    </td>
                    <td className="px-5 py-4">
                      <Badge
                        style={{
                          backgroundColor: `${getStatusTone(project.status)}20`,
                          color: getStatusTone(project.status),
                          borderColor: `${getStatusTone(project.status)}38`,
                        }}
                      >
                        {project.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-4">{project.projectManagerName}</td>
                    <td className="px-5 py-4">{formatCurrency(project.budget)}</td>
                    <td className="px-5 py-4">
                      <div className="flex min-w-44 items-center gap-3">
                        <ProgressBar className="flex-1" value={project.progressPercent} />
                        <span className="w-12 text-left font-semibold">
                          {percentage(project.progressPercent)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!loading && projects.length === 0 ? (
        <Card className="flex items-center justify-center gap-3 rounded-[28px] py-10 text-slate-500 dark:text-slate-400">
          <ListFilter className="h-5 w-5" />
          لا توجد مشاريع مطابقة للفلاتر الحالية.
        </Card>
      ) : null}
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[var(--surface-muted)] px-4 py-3">
      <p className="text-xs text-slate-500 dark:text-slate-400">{title}</p>
      <p className={cn("mt-2 text-sm font-semibold text-[var(--foreground)]")}>{value}</p>
    </div>
  );
}
