import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await auth();
  if (session) redirect("/dashboard");

  const demoAccounts = await prisma.user.findMany({
    where: { role: { in: ["MANAGER", "CEO"] } },
    select: { name: true, email: true, role: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
            D
          </div>
          <h1 className="text-lg font-semibold text-foreground">DemoPulse</h1>
          <p className="text-sm text-muted-foreground">Demo, delivery &amp; talent evaluation platform</p>
        </div>
        <LoginForm demoAccounts={demoAccounts} />
      </div>
    </div>
  );
}
