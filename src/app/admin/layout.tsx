import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { AccountMenu } from "@/components/auth/account-menu";
import { authOptions } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }
  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  return (
    <>
      <header className="border-b border-[#243775] bg-[#0C1638] text-[#EEF2FF]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-8">
          <Link
            href="/admin"
            className="text-sm font-bold uppercase tracking-[0.18em] text-[#F5C542]"
          >
            Admin workspace
          </Link>
          <AccountMenu
            email={session.user.email}
            name={session.user.name ?? session.user.email ?? "Admin"}
            role={session.user.role}
          />
        </div>
      </header>
      {children}
    </>
  );
}
