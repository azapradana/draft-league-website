export const SHOWCASE_RATIO = 6;
export const SHOWCASE_RATIO_TOLERANCE = 0.02;
export const SHOWCASE_MIN_WIDTH = 1200;
export const SHOWCASE_RECOMMENDED = "Recommended 2400×400 px (6:1). PNG, JPG, WebP or GIF, max 2 MB.";
export const SHOWCASE_SIZE_ERROR =
  "Image must be 6:1 and at least 1200 px wide. Use 2400×400 px (6:1).";

export function isValidShowcaseSize(width: number, height: number): boolean {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return false;
  }
  if (width < SHOWCASE_MIN_WIDTH) return false;
  return Math.abs(width / height / SHOWCASE_RATIO - 1) <= SHOWCASE_RATIO_TOLERANCE;
}

export function normalizeShowcaseLink(value: string): string | null | undefined {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 2048) return undefined;
  try {
    const protocol = new URL(trimmed).protocol;
    return protocol === "http:" || protocol === "https:" ? trimmed : undefined;
  } catch {
    return undefined;
  }
}

export function isShowcaseBlobUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname.endsWith(".public.blob.vercel-storage.com") &&
      url.pathname.startsWith("/images/")
    );
  } catch {
    return false;
  }
}
