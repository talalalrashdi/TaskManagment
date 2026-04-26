import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("ar-OM", {
    style: "currency",
    currency: "OMR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value?: string | null) {
  if (!value) {
    return "غير محدد";
  }

  return new Intl.DateTimeFormat("ar-OM", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function getTypeColor(type: string) {
  if (type === "Software") return "var(--software)";
  if (type === "Networks") return "var(--networks)";
  if (type === "Cybersecurity") return "var(--security)";
  return "var(--maintenance)";
}

export function getStatusTone(status: string) {
  if (status === "Active" || status === "Done") return "var(--success)";
  if (status === "Planning" || status === "Review") return "var(--secondary)";
  if (status === "OnHold" || status === "Expiring") return "var(--warning)";
  if (status === "Cancelled" || status === "Blocked" || status === "Expired") {
    return "var(--danger)";
  }

  return "var(--primary)";
}

export function percentage(value: number) {
  return `${Math.round(value)}%`;
}

export function remainingDays(value?: string | null) {
  if (!value) {
    return 0;
  }

  const today = new Date();
  const target = new Date(value);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
