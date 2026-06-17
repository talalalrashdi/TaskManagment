"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createProjectHubConnection } from "@/lib/signalr";
import { useAuthStore } from "@/store/auth-store";
import type { Task, ExecutiveUpdate, ProjectMember, Notification } from "@/types/domain";

export function useProjectHub(projectId?: number) {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!projectId || !token) {
      return;
    }

    const connection = createProjectHubConnection(token);
    let mounted = true;

    connection.on("task:statusChanged", () => {
      void queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["project-summary", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-project-detail", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["director-project-detail", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    });

    connection.on("task:assigned", (task: Task) => {
      queryClient.setQueryData<Task[]>(["project-tasks", projectId], (current = []) => {
        const filtered = current.filter((item) => item.id !== task.id);
        return [...filtered, task];
      });
    });

    connection.on("project:updateAdded", (update: ExecutiveUpdate) => {
      queryClient.setQueryData<ExecutiveUpdate[]>(["project-updates", projectId], (current = []) => [update, ...current]);
      void queryClient.invalidateQueries({ queryKey: ["project-detail", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["project-summary", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-project-detail", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["director-project-detail", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    });

    connection.on("project:memberAdded", (payload: { member: ProjectMember }) => {
      queryClient.setQueryData(["project-detail", projectId], (current: { members?: ProjectMember[] } | undefined) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          members: [...(current.members ?? []), payload.member],
        };
      });
    });

    connection.on("license:expiringSoon", () => {
      void queryClient.invalidateQueries({ queryKey: ["licenses"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    });

    connection.on("notification:new", (notification: Notification) => {
      queryClient.setQueryData<Notification[]>(["notifications"], (current = []) => [notification, ...current]);
    });

    void connection
      .start()
      .then(async () => {
        if (mounted) {
          await connection.invoke("JoinProject", projectId);
        }
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
      void connection
        .invoke("LeaveProject", projectId)
        .catch(() => undefined)
        .finally(() => {
          void connection.stop();
        });
    };
  }, [projectId, queryClient, token]);
}
