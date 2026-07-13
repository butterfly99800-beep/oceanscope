import { OrderDetailShell } from "@/features/orders/OrderDetailShell";

export const dynamicParams = false;

export async function generateStaticParams(): Promise<Array<{ id: string }>> {
  return [{ id: "demo" }];
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderDetailShell id={id} />;
}
