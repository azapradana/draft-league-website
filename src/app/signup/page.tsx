import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { guardGuestPage } from "@/lib/guest-access";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";
import SignupForm from "./signup-form";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;
  const session = await getServerSession(authOptions);
  if (session) guardGuestPage(session);
  const settings = await getSiteSettings();
  const inviteTournament = invite
    ? await prisma.tournament.findUnique({
        where: { friendlyMatchInviteToken: invite },
        select: {
          id: true,
          name: true,
          format: true,
          friendlyMatchInviteActive: true,
          friendlyMatchGroupId: true,
          friendlyMatchGroup: { select: { name: true } },
        },
      })
    : null;
  const inviteError = invite
    ? !inviteTournament ||
      inviteTournament.format !== "FRIENDLY_MATCH" ||
      !inviteTournament.friendlyMatchGroupId
      ? "This Friendly Match invitation link is invalid."
      : !inviteTournament.friendlyMatchInviteActive
        ? "This Friendly Match invitation link has been disabled. Ask an admin for a new one."
        : null
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
            Choose a username and password to join 7DS Tournament Platform.
          </p>
          {inviteError && (
            <p className="mt-2 rounded-md border border-rose-400/40 bg-rose-950/40 px-3 py-2 text-sm text-rose-200" role="alert">
              {inviteError}
            </p>
          )}
          {inviteTournament && !inviteError && (
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
        {!inviteError && (
          <SignupForm
            googleEnabled={googleEnabled}
            inviteToken={inviteTournament ? invite : undefined}
            inviteTournamentId={inviteTournament?.id}
          />
        )}
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
