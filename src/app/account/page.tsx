import { redirect } from "next/navigation";
import { AccountShell } from "@/features/account/AccountShell";
import { getCurrentUser } from "@/lib/auth";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/account");
  return <AccountShell />;
}