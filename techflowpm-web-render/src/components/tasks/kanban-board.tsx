"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { AlertTriangle, Check, ChevronDown, Clock3, GripVertical, LoaderCircle, User2 } from "lucide-react";
import { Badge, Card } from "@/components/ui/primitives";
import { cn, formatDate, getStatusTone } from "@/lib/utils";
import type { Task, TaskAssignee, User } from "@/types/domain";

const columns: Task["status"][] = ["Todo", "InProgress", "Review", "Done", "Blocked"];

const statusLabels: Record<Task["status"], string> = {
  Todo: "جديدة",
  InProgress: "قيد التنفيذ",
  Review: "قيد المراجعة",
  Done: "منجزة",
  Blocked: "توجد مشكلة",
};

const priorityLabels: Record<Task["priority"], string> = {
  Low: "منخفضة",
  Medium: "متوسطة",
  High: "عالية",
  Critical: "حرجة",
};

type Props = {
  tasks: Task[];
  users: User[];
  movingTaskId?: number | null;
  assigningTaskId?: number | null;
  onMove: (task: Task, status: Task["status"]) => void;
  onAssignTask?: (task: Task, userId: number | null) => void;
};

export function KanbanBoard({ tasks, users, movingTaskId, assigningTaskId, onMove, onAssignTask }: Props) {
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
                  <TaskAssigneeList
                    task={task}
                    users={users}
                    isAssigning={assigningTaskId === task.id}
                    onAssignTask={onAssignTask}
                  />
                  {task.status === "Blocked" ? (
                    <span className="inline-flex items-center gap-1 text-[var(--danger)]">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      توجد مشكلة
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

function TaskAssigneeList({
  task,
  users,
  isAssigning = false,
  onAssignTask,
}: {
  task: Task;
  users: User[];
  isAssigning?: boolean;
  onAssignTask?: (task: Task, userId: number | null) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const assignees = getTaskAssignees(task);
  const selectedUserId = task.assignedToId ?? assignees[0]?.userId ?? null;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  const handleTriggerToggle = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setIsOpen((current) => !current);
  };

  const handleAssignUser = (userId: number | null) => {
    if (isAssigning || selectedUserId === userId) {
      setIsOpen(false);
      return;
    }

    onAssignTask?.(task, userId);
    setIsOpen(false);
  };

  const canEditAssignee = Boolean(onAssignTask) && users.length > 0;

  const visibleAssignees = assignees.slice(0, 4);

  return (
    <div ref={containerRef} className="relative min-w-0">
      <button
        type="button"
        onClick={handleTriggerToggle}
        onMouseDown={(event) => event.stopPropagation()}
        onDragStart={(event) => event.preventDefault()}
        className={cn(
          "flex min-w-0 max-w-full items-center gap-2 rounded-full px-1.5 py-1 transition",
          canEditAssignee ? "hover:bg-white/70" : "cursor-default",
        )}
        disabled={!canEditAssignee}
      >
        {assignees.length === 0 ? (
          <span className="inline-flex items-center gap-1">
            <User2 className="h-3.5 w-3.5" />
            غير معين
          </span>
        ) : assignees.length === 1 ? (
          <div className="flex min-w-0 items-center gap-2">
            <AssigneeAvatar assignee={assignees[0]} />
            <span className="truncate">{assignees[0].userName}</span>
          </div>
        ) : (
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex items-center">
              {visibleAssignees.map((assignee) => (
                <AssigneeAvatar key={assignee.userId} assignee={assignee} stacked />
              ))}
            </div>
            <span className="font-semibold text-[#0d7573]">+{assignees.length}</span>
          </div>
        )}
        {canEditAssignee ? (
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--surface-muted)] text-[#7c8f91]">
            {isAssigning ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </span>
        ) : null}
      </button>

      {isOpen && canEditAssignee ? (
        <div
          onMouseDown={(event) => event.stopPropagation()}
          className="absolute bottom-[calc(100%+0.5rem)] right-0 z-[90] w-72 rounded-[20px] border border-[#dce7e8] bg-white p-2 shadow-[0_24px_48px_-32px_rgba(12,54,58,0.35)]"
        >
          <div className="mb-2 px-2 text-[12px] font-semibold text-[#66787d]">تغيير المكلف بالمهمة</div>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            <button
              type="button"
              onClick={() => handleAssignUser(null)}
              onMouseDown={(event) => event.stopPropagation()}
              onDragStart={(event) => event.preventDefault()}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-right text-[13px] font-semibold transition",
                selectedUserId === null ? "bg-[#edf8f8] text-[#0d7573]" : "text-[#526268] hover:bg-[#f5fafb]",
              )}
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[#dce3e6] text-[#173036]">
                <User2 className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1 truncate">غير معين</span>
              <span
                className={cn(
                  "grid h-5 w-5 place-items-center rounded-full border text-[11px]",
                  selectedUserId === null ? "border-[#0d7573] bg-[#0d7573] text-white" : "border-[#cfdcde] text-transparent",
                )}
              >
                <Check className="h-3 w-3" />
              </span>
            </button>
            {users.map((user) => {
              const selected = user.id === selectedUserId;

              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleAssignUser(user.id)}
                  onMouseDown={(event) => event.stopPropagation()}
                  onDragStart={(event) => event.preventDefault()}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-right text-[13px] font-semibold transition",
                    selected ? "bg-[#edf8f8] text-[#0d7573]" : "text-[#526268] hover:bg-[#f5fafb]",
                  )}
                >
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-[#dce3e6] text-[10px] font-bold text-[#173036]">
                    {getInitials(user.name)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{user.name}</span>
                  <span
                    className={cn(
                      "grid h-5 w-5 place-items-center rounded-full border text-[11px]",
                      selected ? "border-[#0d7573] bg-[#0d7573] text-white" : "border-[#cfdcde] text-transparent",
                    )}
                  >
                    <Check className="h-3 w-3" />
                  </span>
                </button>
              );
            })}
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
