import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileSettings } from "./profile-settings";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/login?callbackUrl=%2Fprofile");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      username: true,
      name: true,
      email: true,
      image: true,
      googleEmail: true,
      passwordHash: true,
      coinsBalance: true,
      accounts: { select: { provider: true } },
    },
  });

  if (!user) {
    redirect("/login?callbackUrl=%2Fprofile");
  }

  const displayName = user.name ?? user.username ?? user.email ?? "Player";
  const googleLinked = user.accounts.some((account) => account.provider === "google");
  const canUnlinkGoogle =
    Boolean(user.passwordHash) || user.accounts.some((account) => account.provider !== "google");
  const googleEnabled = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );

  return (
    <main className="min-h-screen bg-[#070D24] px-4 py-10 text-[#EEF2FF] sm:px-6 sm:py-14">
      <div className="mx-auto max-w-5xl">
        <Link
          className="inline-flex min-h-11 items-center text-sm font-semibold text-[#F5C542] hover:underline"
          href="/"
        >
          ← Back to league
        </Link>

        <header className="mt-7 flex flex-col gap-6 rounded-2xl border border-[#243775] bg-[#0C1638] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="flex min-w-0 items-center gap-5">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.image}
                alt=""
                className="size-20 shrink-0 rounded-2xl border border-[#243775] object-cover"
              />
            ) : (
              <span
                aria-hidden="true"
                className="grid size-20 shrink-0 place-items-center rounded-2xl bg-[#122050] text-3xl font-black text-[#F5C542]"
              >
                {displayName.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F5C542]">
                Player profile
              </p>
              <h1 className="mt-1 truncate text-3xl font-black tracking-tight">{displayName}</h1>
              <p className="mt-1 truncate text-sm text-[#9FB0E6]">
                {user.username ? `@${user.username}` : user.email ?? "Draft League account"}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-[#243775] bg-[#070D24] px-5 py-4 sm:min-w-48">
            <p className="text-xs font-bold uppercase tracking-wider text-[#9FB0E6]">
              Personal wallet
            </p>
            <p className="mt-1 text-2xl font-black text-[#F5C542]">
              {user.coinsBalance.toLocaleString()} <span className="text-sm">coins</span>
            </p>
            <p className="mt-1 text-xs text-[#7181B3]">Saved to your account</p>
          </div>
        </header>

        <section className="mt-8">
          <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F5C542]">
              Account security
            </p>
            <h2 className="mt-1 text-2xl font-bold">Sign-in methods</h2>
          </div>
          <ProfileSettings
            googleEmail={user.googleEmail}
            googleEnabled={googleEnabled}
            googleLinked={googleLinked}
            canUnlinkGoogle={canUnlinkGoogle}
            hasPassword={Boolean(user.passwordHash)}
          />
        </section>
      </div>
    </main>
  );
}
