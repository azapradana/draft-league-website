import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function isValidImageUrl(value: string) {
  if (!value) return true;
  try {
    return value.length <= 2048 && new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to manage groups." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const formData = await request.formData();
  const action = formData.get("action");
  const groupId = formData.get("groupId");
  const username = formData.get("username");
  const userId = formData.get("userId");
  const participationCount = formData.get("friendlyMatchParticipationCount");

  if (action === "create") {
    const name = formData.get("name");
    const logoUrl = formData.get("logoUrl");
    if (typeof name !== "string" || !name.trim() || name.trim().length > 80) {
      return NextResponse.json(
        { error: "Group name must be between 1 and 80 characters." },
        { status: 400 },
      );
    }
    if (
      typeof logoUrl !== "string" ||
      !isValidImageUrl(logoUrl.trim())
    ) {
      return NextResponse.json(
        { error: "Group logos must use a valid HTTPS URL no longer than 2,048 characters." },
        { status: 400 },
      );
    }
    try {
      await prisma.group.create({
        data: { name: name.trim(), logoUrl: logoUrl.trim() || null },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return NextResponse.json(
          { error: "A group with that name already exists." },
          { status: 409 },
        );
      }
      throw error;
    }
  } else if (action === "assign" && typeof groupId === "string" && typeof username === "string") {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true },
    });
    const user = await prisma.user.findUnique({
      where: { username: username.trim() },
      select: { id: true },
    });
    if (!group || !user) {
      return NextResponse.json(
        { error: "Choose an existing group and username." },
        { status: 404 },
      );
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { groupId: group.id },
    });
  } else if (
    action === "remove" &&
    typeof groupId === "string" &&
    typeof userId === "string"
  ) {
    await prisma.user.updateMany({
      where: { id: userId, groupId },
      data: { groupId: null },
    });
  } else if (
    action === "adjust-count" &&
    typeof groupId === "string" &&
    typeof userId === "string" &&
    typeof participationCount === "string" &&
    /^\d+$/.test(participationCount)
  ) {
    const count = Number(participationCount);
    if (!Number.isSafeInteger(count) || count > 2_147_483_647) {
      return NextResponse.json(
        { error: "Participation count must be a whole number from 0 to 2,147,483,647." },
        { status: 400 },
      );
    }
    const result = await prisma.user.updateMany({
      where: { id: userId, groupId },
      data: { friendlyMatchParticipationCount: count },
    });
    if (result.count === 0) {
      return NextResponse.json(
        { error: "This user is no longer assigned to the selected group." },
        { status: 409 },
      );
    }
  } else {
    return NextResponse.json({ error: "Choose a valid group action." }, { status: 400 });
  }

  return NextResponse.redirect(new URL("/admin/groups", request.url), 303);
}
