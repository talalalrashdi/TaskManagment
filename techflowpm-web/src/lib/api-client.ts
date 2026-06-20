import type { ApiResponse } from "@/types/domain";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:5270/api/v1";

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
};

function buildUrl(path: string, query?: RequestOptions["query"]) {
  const url = new URL(`${API_BASE_URL}${path}`);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }

  return url.toString();
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
  const { query, headers, body, ...init } = options;
  const token =
    typeof window !== "undefined" ? window.localStorage.getItem("techflowpm-auth") : null;
  const parsed = token ? (JSON.parse(token) as { state?: { token?: string } }) : null;

  let response: Response;

  try {
    response = await fetch(buildUrl(path, query), {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(parsed?.state?.token
          ? {
              Authorization: `Bearer ${parsed.state.token}`,
            }
          : {}),
        ...headers,
      },
      body:
        body && typeof body !== "string" && !(body instanceof FormData)
          ? JSON.stringify(body)
          : (body as BodyInit | null | undefined),
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error("تعذر الاتصال بالخادم. تأكد من تشغيل الـ API والسماح بطلبات المتصفح.");
    }

    throw error;
  }

  const payload = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !payload.success) {
    const error = payload.errors?.[0] ?? payload.message ?? "Request failed.";
    throw new Error(error);
  }

  return payload;
}

export const apiClient = {
  get: <T>(path: string, query?: RequestOptions["query"]) =>
    request<T>(path, { method: "GET", query, cache: "no-store" }),
  post: <T>(path: string, body?: RequestOptions["body"]) =>
    request<T>(path, { method: "POST", body }),
  put: <T>(path: string, body?: RequestOptions["body"]) =>
    request<T>(path, { method: "PUT", body }),
  patch: <T>(path: string, body?: RequestOptions["body"]) =>
    request<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
