"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, CheckCheck } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import { Button, Card, SectionHeader, Select } from "@/components/ui/primitives";
import type { Notification, PagedResult } from "@/types/domain";

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    type: "",
    isRead: "",
  });

  const notificationsQuery = useQuery({
    queryKey: ["notifications", filters],
    queryFn: () =>
      apiClient
        .get<PagedResult<Notification>>("/notifications", {
          page: 1,
          pageSize: 40,
          type: filters.type,
          isRead: filters.isRead,
        })
        .then((response) => response.data),
  });

  const markReadMutation = useMutation({
    mutationFn: () => apiClient.patch("/notifications/mark-read", { notificationIds: null }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return (
    <div className="space-y-6">
      <SectionHeader
        title="مركز الإشعارات"
        subtitle="فلترة حسب النوع والحالة مع تعليم جميع العناصر كمقروءة."
        action={
          <Button variant="secondary" onClick={() => markReadMutation.mutate()}>
            <CheckCheck className="h-4 w-4" />
            تعليم الكل كمقروء
          </Button>
        }
      />

      <Card className="grid gap-4 md:grid-cols-2">
        <Select value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}>
          <option value="">كل الأنواع</option>
          <option value="task:assigned">task:assigned</option>
          <option value="project:updateAdded">project:updateAdded</option>
          <option value="license:expiringSoon">license:expiringSoon</option>
        </Select>
        <Select value={filters.isRead} onChange={(event) => setFilters((current) => ({ ...current, isRead: event.target.value }))}>
          <option value="">الكل</option>
          <option value="false">غير مقروء</option>
          <option value="true">مقروء</option>
        </Select>
      </Card>

      <div className="space-y-3">
        {notificationsQuery.data?.items.map((notification) => (
          <Card
            key={notification.id}
            className={`flex items-start justify-between gap-4 rounded-[28px] ${notification.isRead ? "opacity-70" : ""}`}
          >
            <div className="flex items-start gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-3xl bg-[var(--surface-muted)]">
                <BellRing className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">{notification.title}</p>
                <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                  {notification.message}
                </p>
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  {notification.type} • {formatDate(notification.createdAt)}
                </p>
              </div>
            </div>
            {!notification.isRead ? (
              <span className="rounded-full bg-[rgba(16,185,129,0.14)] px-3 py-1 text-xs font-semibold text-[var(--success)]">
                جديد
              </span>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
