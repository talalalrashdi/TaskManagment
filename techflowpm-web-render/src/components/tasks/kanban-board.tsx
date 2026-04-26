"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Clock3, GripVertical, User2 } from "lucide-react";
import { Badge, Card } from "@/components/ui/primitives";
import { cn, formatDate, getStatusTone } from "@/lib/utils";
import type { Task, TaskAssignee } from "@/types/domain";

const columns: Task["status"][] = ["Todo", "InProgress", "Review", "Done", "Blocked"];

const statusLabels: Record<Task["status"], string> = {
  Todo: "جديدة",
  InProgress: "قيد التنفيذ",
  Review: "قيد المراجعة",
  Done: "منجزة",
  Blocked: "متعثر",
};

const priorityLabels: Record<Task["priority"], string> = {
  Low: "منخفضة",
  Medium: "متوسطة",
  High: "عالية",
  Critical: "حرجة",
};

type Props = {
  tasks: Task[];
  movingTaskId?: number | null;
  onMove: (task: Task, status: Task["status"]) => void;
};

export function KanbanBoard({ tasks, movingTaskId, onMove }: Props) {
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<Task["status"] | null>(null);

  const groupedTasks = useMemo(
    () =>
      columns.reduce<Record<string, Task[]>>((accumulator, status) => {
        accumulator[status] = tasks
          .filter((task) => task.status === status)
          .sort((left, right) => left.orderIndex - right.orderIndex);
        return accumulator;
      }, {}),
    [tasks],
  );

  return (
    <div className="grid gap-4 xl:grid-cols-5">
      {columns.map((status) => (
        <div
          key={status}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            setDragOverStatus(status);
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setDragOverStatus(null);
            }
          }}
          onDrop={(event) => {
            event.preventDefault();
            const droppedTaskId = Number(event.dataTransfer.getData("text/plain")) || draggedTaskId;
            const task = tasks.find((item) => item.id === droppedTaskId);
            if (task && task.status !== status) {
              onMove(task, status);
            }
            setDraggedTaskId(null);
            setDragOverStatus(null);
          }}
          className={cn(
            "min-h-[320px] rounded-[28px] border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-3 transition",
            dragOverStatus === status && "border-[#0d7573] bg-[#edf8f8] shadow-[inset_0_0_0_1px_rgba(13,117,115,0.18)]",
          )}
        >
          <div className="mb-3 flex items-center justify-between rounded-2xl bg-[var(--surface-strong)] px-3 py-2">
            <span className="font-semibold text-[var(--foreground)]">{statusLabels[status]}</span>
            <Badge
              style={{
                backgroundColor: `${getStatusTone(status)}20`,
                color: getStatusTone(status),
                borderColor: `${getStatusTone(status)}35`,
              }}
            >
              {groupedTasks[status].length}
            </Badge>
          </div>

          <div className="space-y-3">
            {groupedTasks[status].map((task) => (
              <Card
                key={task.id}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", String(task.id));
                  setDraggedTaskId(task.id);
                }}
                onDragEnd={() => {
                  setDraggedTaskId(null);
                  setDragOverStatus(null);
                }}
                className={cn(
                  "cursor-grab space-y-3 rounded-[24px] p-4 transition active:cursor-grabbing",
                  draggedTaskId === task.id && "scale-[0.98] opacity-50",
                  movingTaskId === task.id && "opacity-60",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{task.title}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {task.description}
                    </p>
                  </div>
                  <GripVertical className="mt-1 h-4 w-4 text-slate-400" />
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge
                    style={{
                      backgroundColor: `${getStatusTone(task.priority)}20`,
                      color: getStatusTone(task.priority),
                      borderColor: `${getStatusTone(task.priority)}35`,
                    }}
                  >
                    {priorityLabels[task.priority]}
                  </Badge>
                  {task.dueDate ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-muted)] px-3 py-1">
                      <Clock3 className="h-3.5 w-3.5" />
                      {formatDate(task.dueDate)}
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <TaskAssigneeList task={task} />
                  {task.status === "Blocked" ? (
                    <span className="inline-flex items-center gap-1 text-[var(--danger)]">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      متعثر
                    </span>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TaskAssigneeList({ task }: { task: Task }) {
  const [isOpen, setIsOpen] = useState(false);
  const assignees = getTaskAssignees(task);

  if (assignees.length === 0) {
    return (
      <span className="inline-flex items-center gap-1">
        <User2 className="h-3.5 w-3.5" />
        غير معين
      </span>
    );
  }

  if (assignees.length === 1) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <AssigneeAvatar assignee={assignees[0]} />
        <span className="truncate">{assignees[0].userName}</span>
      </div>
    );
  }

  const visibleAssignees = assignees.slice(0, 4);

  return (
    <div className="relative flex min-w-0 items-center gap-2">
      <div className="flex items-center">
        {visibleAssignees.map((assignee) => (
          <AssigneeAvatar key={assignee.userId} assignee={assignee} stacked />
        ))}
      </div>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen((current) => !current);
        }}
        onDragStart={(event) => event.preventDefault()}
        className="grid h-8 min-w-8 place-items-center rounded-full border-2 border-white bg-[#0d7573] px-2 text-[11px] font-bold text-white shadow-[0_12px_24px_-18px_rgba(13,117,115,0.65)]"
      >
        +{assignees.length}
      </button>

      {isOpen ? (
        <div className="absolute bottom-[calc(100%+0.5rem)] right-0 z-[90] w-64 rounded-[20px] border border-[#dce7e8] bg-white p-2 shadow-[0_24px_48px_-32px_rgba(12,54,58,0.35)]">
          <div className="mb-2 px-2 text-[12px] font-semibold text-[#66787d]">المكلفون بالمهمة</div>
          <div className="space-y-1">
            {assignees.map((assignee) => (
              <div key={assignee.userId} className="flex items-center gap-3 rounded-2xl px-3 py-2 text-[#526268]">
                <AssigneeAvatar assignee={assignee} />
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{assignee.userName}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AssigneeAvatar({
  assignee,
  stacked = false,
}: {
  assignee: TaskAssignee;
  stacked?: boolean;
}) {
  return (
    <span
      title={assignee.userName}
      className={cn(
        "grid h-8 w-8 place-items-center overflow-hidden rounded-full border-2 border-white bg-[#dce3e6] text-[10px] font-bold text-[#173036]",
        stacked && "-ms-2 first:ms-0",
      )}
    >
      {assignee.userAvatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={assignee.userAvatar} alt={assignee.userName} className="h-full w-full object-cover" />
      ) : (
        getInitials(assignee.userName)
      )}
    </span>
  );
}

function getTaskAssignees(task: Task): TaskAssignee[] {
  if (task.assignees?.length) {
    return task.assignees;
  }

  if (task.assignedToId && task.assignedToName) {
    return [
      {
        userId: task.assignedToId,
        userName: task.assignedToName,
      },
    ];
  }

  return [];
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
