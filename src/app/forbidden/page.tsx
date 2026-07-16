import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";

export default function ForbiddenPage() {
  return (
    <PageContainer className="py-16">
      <div className="mx-auto max-w-xl rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-ocean-600">403</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">No access</h1>
        <p className="mt-3 text-sm text-slate-600">Your current account does not have permission to access the admin workspace.</p>
        <Link href="/" className="mt-6 inline-flex rounded-md bg-gradient-to-r from-ocean-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white hover:brightness-110">Back to OceanScope</Link>
      </div>
    </PageContainer>
  );
}
