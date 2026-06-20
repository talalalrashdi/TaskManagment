"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Eye, EyeOff, Plus } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { downloadCsv, formatCurrency, formatDate, getStatusTone } from "@/lib/utils";
import { Button, Card, Input, SectionHeader, Select } from "@/components/ui/primitives";
import type { License, PagedResult } from "@/types/domain";

export default function LicensesPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [revealedIds, setRevealedIds] = useState<number[]>([]);
  const [filters, setFilters] = useState({
    search: "",
    type: "",
    status: "",
  });
  const [formState, setFormState] = useState({
    name: "",
    type: "Software",
    keyValue: "",
    vendor: "",
    purchaseDate: new Date().toISOString().slice(0, 10),
    expiryDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    cost: 0,
    renewalReminderDays: 30,
    projectId: "",
    notes: "",
  });

  const licensesQuery = useQuery({
    queryKey: ["licenses", filters],
    queryFn: () =>
      apiClient
        .get<PagedResult<License>>("/licenses", {
          page: 1,
          pageSize: 40,
          search: filters.search,
          type: filters.type,
          status: filters.status,
        })
        .then((response) => response.data),
  });

  const createLicenseMutation = useMutation({
    mutationFn: () =>
      apiClient.post("/licenses", {
        ...formState,
        projectId: formState.projectId ? Number(formState.projectId) : null,
      }),
    onSuccess: async () => {
      setShowCreate(false);
      await queryClient.invalidateQueries({ queryKey: ["licenses"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });

  const exportRows = useMemo(() => {
    const headers = ["الاسم", "النوع", "المورد", "الانتهاء", "الحالة", "التكلفة"];
    const rows =
      licensesQuery.data?.items.map((license) => [
        license.name,
        license.type,
        license.vendor,
        formatDate(license.expiryDate),
        license.status,
        String(license.cost),
      ]) ?? [];

    return [headers, ...rows];
  }, [licensesQuery.data?.items]);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="التراخيص والمفاتيح"
        subtitle="تتبع زمني للتجديد مع إظهار/إخفاء المفتاح وتصدير سريع إلى CSV."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => downloadCsv("techflow-licenses.csv", exportRows)}>
              <Download className="h-4 w-4" />
              تصدير CSV
            </Button>
            <Button onClick={() => setShowCreate((value) => !value)}>
              <Plus className="h-4 w-4" />
              {showCreate ? "إخفاء النموذج" : "إضافة ترخيص"}
            </Button>
          </div>
        }
      />

      {showCreate ? (
        <Card className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Input placeholder="اسم الترخيص" value={formState.name} onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))} />
          <Select value={formState.type} onChange={(event) => setFormState((current) => ({ ...current, type: event.target.value }))}>
            <option value="Software">Software</option>
            <option value="Certificate">Certificate</option>
            <option value="Domain">Domain</option>
            <option value="OS">OS</option>
            <option value="Other">Other</option>
          </Select>
          <Input placeholder="المورد" value={formState.vendor} onChange={(event) => setFormState((current) => ({ ...current, vendor: event.target.value }))} />
          <Input placeholder="المفتاح" value={formState.keyValue} onChange={(event) => setFormState((current) => ({ ...current, keyValue: event.target.value }))} />
          <Input type="date" value={formState.purchaseDate} onChange={(event) => setFormState((current) => ({ ...current, purchaseDate: event.target.value }))} />
          <Input type="date" value={formState.expiryDate} onChange={(event) => setFormState((current) => ({ ...current, expiryDate: event.target.value }))} />
          <Input type="number" value={formState.cost} onChange={(event) => setFormState((current) => ({ ...current, cost: Number(event.target.value) }))} />
          <Input type="number" value={formState.renewalReminderDays} onChange={(event) => setFormState((current) => ({ ...current, renewalReminderDays: Number(event.target.value) }))} />
          <Input className="md:col-span-2 xl:col-span-4" placeholder="ملاحظات" value={formState.notes} onChange={(event) => setFormState((current) => ({ ...current, notes: event.target.value }))} />
          <div className="md:col-span-2 xl:col-span-4 flex justify-end">
            <Button onClick={() => createLicenseMutation.mutate()} disabled={createLicenseMutation.isPending}>
              {createLicenseMutation.isPending ? "جارٍ الحفظ..." : "حفظ الترخيص"}
            </Button>
          </div>
        </Card>
      ) : null}

      <Card className="grid gap-4 md:grid-cols-3">
        <Input placeholder="ابحث بالاسم أو المورد..." value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} />
        <Select value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}>
          <option value="">كل الأنواع</option>
          <option value="Software">Software</option>
          <option value="Certificate">Certificate</option>
          <option value="Domain">Domain</option>
          <option value="OS">OS</option>
          <option value="Other">Other</option>
        </Select>
        <Select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
          <option value="">كل الحالات</option>
          <option value="Active">Active</option>
          <option value="Expiring">Expiring</option>
          <option value="Expired">Expired</option>
        </Select>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="min-w-full text-right text-sm">
            <thead className="bg-[var(--surface-muted)] text-slate-500 dark:text-slate-400">
              <tr>
                {["الاسم", "النوع", "المفتاح", "الحالة", "الانتهاء", "التكلفة", "إجراء"].map((head) => (
                  <th key={head} className="px-5 py-4 font-medium">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {licensesQuery.data?.items.map((license) => {
                const revealed = revealedIds.includes(license.id);
                return (
                  <tr key={license.id} className="border-t border-[var(--border)]">
                    <td className="px-5 py-4">
                      <p className="font-semibold">{license.name}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{license.vendor}</p>
                    </td>
                    <td className="px-5 py-4">{license.type}</td>
                    <td className="px-5 py-4">
                      <code className="rounded-xl bg-[var(--surface-muted)] px-3 py-2 text-xs">
                        {revealed ? license.keyValue : license.maskedKeyValue}
                      </code>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className="rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset"
                        style={{
                          backgroundColor: `${getStatusTone(license.status)}20`,
                          color: getStatusTone(license.status),
                          borderColor: `${getStatusTone(license.status)}35`,
                        }}
                      >
                        {license.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <p>{formatDate(license.expiryDate)}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {license.daysUntilExpiry} يوم
                      </p>
                    </td>
                    <td className="px-5 py-4">{formatCurrency(license.cost)}</td>
                    <td className="px-5 py-4">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setRevealedIds((current) =>
                            current.includes(license.id)
                              ? current.filter((id) => id !== license.id)
                              : [...current, license.id],
                          )
                        }
                      >
                        {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
