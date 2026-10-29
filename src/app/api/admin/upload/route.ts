import { put } from "@vercel/blob";
import { getServerSession } from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";

const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_MULTIPART_OVERHEAD_BYTES = 64 * 1024;
const IMAGE_TYPES = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["image/x-icon", "ico"],
  ["image/vnd.microsoft.icon", "ico"],
]);

function matchesImageType(bytes: Uint8Array, contentType: string): boolean {
  switch (contentType) {
    case "image/png":
      return bytes.length >= 8 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a;
    case "image/jpeg":
      return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "image/webp":
      return bytes.length >= 12 &&
        String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
        String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
    case "image/gif":
      return bytes.length >= 6 &&
        ["GIF87a", "GIF89a"].includes(String.fromCharCode(...bytes.slice(0, 6)));
    case "image/x-icon":
    case "image/vnd.microsoft.icon":
      return bytes.length >= 4 &&
        bytes[0] === 0 &&
        bytes[1] === 0 &&
        bytes[2] === 1 &&
        bytes[3] === 0;
    default:
      return false;
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to upload images." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }
  const hasReadWriteToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
  const hasOidcCredentials =
    Boolean(process.env.BLOB_STORE_ID?.trim()) &&
    Boolean(process.env.VERCEL_OIDC_TOKEN?.trim());
  if (!hasReadWriteToken && !hasOidcCredentials) {
    return NextResponse.json(
      {
        error:
          "Image uploads are not configured. Connect a Vercel Blob store or set BLOB_READ_WRITE_TOKEN.",
      },
      { status: 503 },
    );
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_IMAGE_SIZE_BYTES + MAX_MULTIPART_OVERHEAD_BYTES
  ) {
    return NextResponse.json({ error: "Images must be 2 MB or smaller." }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Choose an image file to upload." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose an image file to upload." }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return NextResponse.json({ error: "Images must be 2 MB or smaller." }, { status: 413 });
  }

  const extension = IMAGE_TYPES.get(file.type);
  if (!extension) {
    return NextResponse.json(
      { error: "Only PNG, JPG, WebP, GIF, and ICO images are supported." },
      { status: 415 },
    );
  }

  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (!matchesImageType(header, file.type)) {
    return NextResponse.json({ error: "The file contents do not match an allowed image type." }, { status: 400 });
  }

  try {
    const blob = await put(`images/${crypto.randomUUID()}.${extension}`, file, {
      access: "public",
      contentType: file.type,
    });
    return NextResponse.json({ url: blob.url }, { status: 201 });
  } catch (error) {
    console.error("Vercel Blob image upload failed:", error);
    return NextResponse.json({ error: "The image could not be uploaded. Please try again." }, { status: 500 });
  }
}
