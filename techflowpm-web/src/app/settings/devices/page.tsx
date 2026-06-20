"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Power, Trash2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import { Button, Card, Input, SectionHeader, Select } from "@/components/ui/primitives";
import type { PagedResult, RegisteredDevice, User } from "@/types/domain";

export default function DevicesSettingsPage() {
  const queryClient = useQueryClient();
  const [formState, setFormState] = useState({
    deviceName: "",
    userId: 1,
    notes: "",
  });

  const usersQuery = useQuery({
    queryKey: ["users", "devices"],
    queryFn: () =>
      apiClient
        .get<PagedResult<User>>("/users", { page: 1, pageSize: 100 })
        .then((response) => response.data),
  });

  const devicesQuery = useQuery({
    queryKey: ["admin-devices"],
    queryFn: () =>
      apiClient
        .get<PagedResult<RegisteredDevice>>("/admin/devices", { page: 1, pageSize: 100 })
        .then((response) => response.data),
  });

  const createMutation = useMutation({
    mutationFn: () => apiClient.post("/admin/devices", formState),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-devices"] });
      setFormState({ deviceName: "", userId: 1, notes: "" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiClient.patch(`/admin/devices/${id}`, { isActive: !isActive }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-devices"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/admin/devices/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-devices"] });
    },
  });

  return (
    <div className="space-y-6">
      <SectionHeader
        title="إدارة الأجهزة المسجلة"
        subtitle="تسجيل جهاز جديد، تفعيل أو تعطيل الأجهزة الحالية، وتتبع آخر تسجيل دخول."
      />

      <Card className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Input placeholder="اسم الجهاز" value={formState.deviceName} onChange={(event) => setFormState((current) => ({ ...current, deviceName: event.target.value.toUpperCase() }))} />
        <Select value={String(formState.userId)} onChange={(event) => setFormState((current) => ({ ...current, userId: Number(event.target.value) }))}>
          {usersQuery.data?.items.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </Select>
        <Input className="md:col-span-2" placeholder="ملاحظات" value={formState.notes} onChange={(event) => setFormState((current) => ({ ...current, notes: event.target.value }))} />
        <div className="md:col-span-2 xl:col-span-4 flex justify-end">
          <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
            {createMutation.isPending ? "جارٍ التسجيل..." : "تسجيل جهاز جديد"}
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="min-w-full text-right text-sm">
            <thead className="bg-[var(--surface-muted)] text-slate-500 dark:text-slate-400">
              <tr>
                {["الجهاز", "الموظف", "آخر دخول", "الحالة", "إجراءات"].map((head) => (
                  <th key={head} className="px-5 py-4 font-medium">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {devicesQuery.data?.items.map((device) => (
                <tr key={device.id} className="border-t border-[var(--border)]">
                  <td className="px-5 py-4">
                    <p className="font-semibold">{device.deviceName}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{device.notes}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p>{device.userName}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{device.userEmail}</p>
                  </td>
                  <td className="px-5 py-4">{formatDate(device.lastLogin)}</td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${device.isActive ? "bg-[rgba(16,185,129,0.14)] text-[var(--success)]" : "bg-[rgba(239,68,68,0.14)] text-[var(--danger)]"}`}>
                      {device.isActive ? "مفعل" : "معطل"}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => toggleMutation.mutate({ id: device.id, isActive: device.isActive })}
                      >
                        <Power className="h-4 w-4" />
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => deleteMutation.mutate(device.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
