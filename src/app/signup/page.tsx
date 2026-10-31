import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";
import SignupForm from "./signup-form";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;
  const settings = await getSiteSettings();
  const inviteTournament = invite
    ? await prisma.tournament.findUnique({
        where: { friendlyMatchInviteToken: invite },
        select: {
          id: true,
          name: true,
          friendlyMatchGroup: { select: { name: true } },
        },
      })
    : null;
  const googleEnabled = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-white">
      <section className="w-full max-w-md space-y-6 rounded-xl border border-slate-700 bg-slate-900 p-6">
        <Link
          className="inline-flex min-h-11 items-center text-sm font-semibold text-amber-300 hover:underline"
          href="/"
        >
          ← Home
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">Create your account</h1>
          <p className="mt-2 text-sm text-slate-300">
            Choose a username and password to join Draft League.
          </p>
          {inviteTournament && (
            <p className="mt-2 text-sm text-amber-300">
              You are invited to join {inviteTournament.name} with{" "}
              {inviteTournament.friendlyMatchGroup?.name ?? "the rival group"}.
            </p>
          )}
          <p className="mt-2 text-sm text-slate-300">
            New accounts start with {settings.initialPlayerCoins.toLocaleString()} coins in their
            personal wallet.
          </p>
        </div>
        <SignupForm
          googleEnabled={googleEnabled}
          inviteToken={inviteTournament ? invite : undefined}
          inviteTournamentId={inviteTournament?.id}
        />
        <p className="text-center text-sm text-slate-300">
          Already have an account?{" "}
          <Link className="font-semibold text-amber-300 hover:underline" href="/login">
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
