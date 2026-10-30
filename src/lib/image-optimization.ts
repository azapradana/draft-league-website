export function isOptimizableImageUrl(source: string): boolean {
  try {
    const url = new URL(source);
    return (
      url.protocol === "https:" &&
      (url.hostname.endsWith(".public.blob.vercel-storage.com") ||
        url.hostname === "raw.githubusercontent.com")
    );
  } catch {
    return false;
  }
}
