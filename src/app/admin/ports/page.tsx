import { AdminResourcePage } from "@/features/admin/components/AdminResourcePage";
import { resourceConfigs } from "@/features/admin/data/mock-admin-data";

export default function AdminportsPage() {
  return <AdminResourcePage config={resourceConfigs.ports} />;
}
