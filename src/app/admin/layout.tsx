import { AdminShell } from "@/features/admin/components/AdminShell";
import { requireAdminPage } from "@/lib/authorization";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage("/admin");
  return <AdminShell>{children}</AdminShell>;
}
