import { AdminResourcePage } from "@/features/admin/components/AdminResourcePage";
import { resourceConfigs } from "@/features/admin/data/mock-admin-data";

export default function AdminschedulesPage() {
  return <AdminResourcePage config={resourceConfigs.schedules} />;
}
