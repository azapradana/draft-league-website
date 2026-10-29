import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isSameOriginRequest } from "@/lib/request-security";
import { prisma } from "@/lib/prisma";

export async function DELETE(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.json({ error: "Google sign-in is not enabled." }, { status: 404 });
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Sign in to manage linked accounts." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      passwordHash: true,
      accounts: { select: { provider: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  if (!user.accounts.some((account) => account.provider === "google")) {
    return NextResponse.json({ error: "No Google account is linked." }, { status: 404 });
  }

  const hasAnotherSignInMethod =
    Boolean(user.passwordHash) ||
    user.accounts.some((account) => account.provider !== "google");

  if (!hasAnotherSignInMethod) {
    return NextResponse.json(
      {
        error:
          "Add another sign-in method before unlinking Google so you do not lose access to your account.",
      },
      { status: 409 },
    );
  }

  await prisma.$transaction([
    prisma.account.deleteMany({ where: { userId, provider: "google" } }),
    prisma.user.update({ where: { id: userId }, data: { googleEmail: null } }),
  ]);

  return NextResponse.json({ message: "Your Google account has been unlinked." });
}
