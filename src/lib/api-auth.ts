import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function requireUser() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return { ok: false as const, status: 401, error: "Sign in to continue." };
  }

  return { ok: true as const, session, userId: session.user.id, isAdmin: session.user.role === "ADMIN" };
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!user.ok) return user;

  if (!user.isAdmin) {
    return { ok: false as const, status: 403, error: "Admin access is required." };
  }

  return user;
}

export function authFailure(result: { status: number; error: string }) {
  return NextResponse.json({ error: result.error }, { status: result.status });
}
