import bcrypt from "bcryptjs";
import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isSameOriginRequest } from "@/lib/request-security";
import { prisma } from "@/lib/prisma";

export async function PUT(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Sign in to change your password." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send valid JSON." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Enter your current and new password." }, { status: 400 });
  }

  const { currentPassword, newPassword, confirmPassword } = body as {
    currentPassword?: unknown;
    newPassword?: unknown;
    confirmPassword?: unknown;
  };

  if (typeof currentPassword !== "string" || !currentPassword) {
    return NextResponse.json({ error: "Enter your current password." }, { status: 400 });
  }

  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return NextResponse.json(
      { error: "Your new password must be at least 8 characters." },
      { status: 400 },
    );
  }

  if (new TextEncoder().encode(newPassword).length > 72) {
    return NextResponse.json(
      { error: "Your new password must be no more than 72 UTF-8 bytes." },
      { status: 400 },
    );
  }

  if (confirmPassword !== newPassword) {
    return NextResponse.json({ error: "Your new passwords do not match." }, { status: 400 });
  }

  if (currentPassword === newPassword) {
    return NextResponse.json(
      { error: "Choose a new password that differs from your current password." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });

  if (!user?.passwordHash) {
    return NextResponse.json(
      { error: "This account does not have a password to change." },
      { status: 409 },
    );
  }

  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    return NextResponse.json({ error: "Your current password is incorrect." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  const updated = await prisma.user.updateMany({
    where: { id: userId, passwordHash: user.passwordHash },
    data: { passwordHash },
  });

  if (updated.count !== 1) {
    return NextResponse.json(
      { error: "Your password changed in another request. Sign in again and retry." },
      { status: 409 },
    );
  }

  return NextResponse.json({ message: "Your password has been updated." });
}
