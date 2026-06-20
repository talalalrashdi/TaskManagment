export const AUTH_BYPASS_ENABLED =
  process.env.NEXT_PUBLIC_BYPASS_AUTH !== "false";

export const BYPASS_USER = {
  id: 1,
  name: "System Admin",
  email: "admin@techflow.local",
  role: "Admin" as const,
};
