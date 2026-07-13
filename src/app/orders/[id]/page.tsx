import { OrderDetailShell } from "@/features/orders/OrderDetailShell";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderDetailShell id={id} />;
}
