import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { isAdminEmail } from "@/utils/admin";
import { AdminDashboard } from "@/components/admin";

export default async function AdminPage() {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const email = user.emailAddresses[0]?.emailAddress;
  if (!isAdminEmail(email)) {
    redirect("/dashboard");
  }

  return <AdminDashboard />;
}
