import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";

export const GUEST_FORBIDDEN_ERROR =
  "Guests can only access their invited tournament.";

export function isGuestSession(session: Session | null | undefined) {
  return session?.user?.role === "GUEST";
}

export function guestHomePath(session: Session) {
  const bound = session.user?.boundTournamentId;
  return bound ? `/t/${bound}` : "/login";
}

// A guest may only reach their bound tournament; omit tournamentId for routes
// that are never available to guests.
export function guestMayAccess(
  session: Session | null | undefined,
  tournamentId?: string,
) {
  if (!isGuestSession(session)) return true;
  return (
    tournamentId !== undefined &&
    session?.user?.boundTournamentId === tournamentId
  );
}

export function guestApiBlock(
  session: Session | null | undefined,
  tournamentId?: string,
) {
  if (guestMayAccess(session, tournamentId)) return null;
  return NextResponse.json({ error: GUEST_FORBIDDEN_ERROR }, { status: 403 });
}

export function guardGuestPage(session: Session, tournamentId?: string) {
  if (!guestMayAccess(session, tournamentId)) {
    redirect(guestHomePath(session));
  }
}
