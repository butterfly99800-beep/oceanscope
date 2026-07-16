import { redirect } from "next/navigation";
import { jsonError } from "@/features/admin/server/api-utils";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";

export async function requireUserForApi(): Promise<{ user?: CurrentUser; response?: Response }> {
  const user = await getCurrentUser();
  if (!user) return { response: jsonError("UNAUTHORIZED", "Please sign in first", 401) };
  return { user };
}

export async function requireAdminForApi(): Promise<{ user?: CurrentUser; response?: Response }> {
  const user = await getCurrentUser();
  if (!user) return { response: jsonError("UNAUTHORIZED", "Please sign in first", 401) };
  if (user.role !== "ADMIN") return { response: jsonError("FORBIDDEN", "Admin access required", 403) };
  return { user };
}

export async function requireAdminPage(callbackUrl: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=" + encodeURIComponent(callbackUrl));
  if (user.role !== "ADMIN") redirect("/forbidden");
  return user;
}
