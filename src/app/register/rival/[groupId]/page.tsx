import Link from "next/link";
import type { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkRivalInvitation } from "@/lib/friendly-war";
import { prisma } from "@/lib/prisma";
import { ClaimInvitationButton, RivalSignupForm } from "./rival-forms";

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-white">
      <section className="w-full max-w-md space-y-6 rounded-xl border border-slate-700 bg-slate-900 p-6">
        {children}
      </section>
    </main>
  );
}

export default async function RivalInvitationPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ invite?: string | string[] }>;
}) {
  const { groupId } = await params;
  const { invite: inviteParam } = await searchParams;
  const invite = Array.isArray(inviteParam) ? inviteParam[0] : inviteParam;
  const check = await checkRivalInvitation(groupId, invite);

  if (!check.ok || !invite) {
    return (
      <Shell>
        <h1 className="text-2xl font-semibold">Invitation unavailable</h1>
        <p className="text-sm text-slate-300">{check.ok ? "Invalid invitation." : check.reason}</p>
        <Link className="font-semibold text-amber-300 hover:underline" href="/">
          Go home
        </Link>
      </Shell>
    );
  }

  const { groupName, groupLogoUrl } = check.invitation;
  const session = await getServerSession(authOptions);
  const callbackUrl = `/register/rival/${groupId}?invite=${encodeURIComponent(invite)}`;
  const currentUser = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { groupId: true, username: true },
      })
    : null;

  return (
    <Shell>
      <div className="flex items-center gap-4">
        {groupLogoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" className="h-14 w-14 rounded-lg object-cover" src={groupLogoUrl} />
        )}
        <div>
          <p className="text-xs uppercase tracking-wide text-amber-300">Friendly Match invitation</p>
          <h1 className="text-2xl font-semibold">Join {groupName}</h1>
        </div>
      </div>

      {currentUser ? (
        currentUser.groupId === groupId ? (
          <>
            <p className="text-sm text-emerald-300">You are already a member of {groupName}.</p>
            <Link className="font-semibold text-amber-300 hover:underline" href="/">
              Continue to the site
            </Link>
          </>
        ) : currentUser.groupId ? (
          <p className="text-sm text-slate-300">
            You are signed in as {currentUser.username}, who already belongs to another group. Ask an
            admin to move you.
          </p>
        ) : (
          <>
            <p className="text-sm text-slate-300">
              Signed in as {currentUser.username}. Accept the invitation to represent {groupName}.
            </p>
            <ClaimInvitationButton groupId={groupId} groupName={groupName} invite={invite} />
          </>
        )
      ) : (
        <>
          <p className="text-sm text-slate-300">
            Create an account to represent {groupName} in the upcoming war.
          </p>
          <RivalSignupForm groupId={groupId} invite={invite} />
          <p className="text-center text-sm text-slate-300">
            Already have an account?{" "}
            <Link
              className="font-semibold text-amber-300 hover:underline"
              href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
            >
              Sign in to accept
            </Link>
          </p>
        </>
      )}
    </Shell>
  );
}
