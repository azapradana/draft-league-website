import { imageSize } from "image-size";
import { SHOWCASE_SIZE_ERROR, isValidShowcaseSize } from "@/lib/showcase";

export function checkShowcaseImageBytes(bytes: Uint8Array): string | null {
  try {
    const { width, height } = imageSize(bytes);
    return isValidShowcaseSize(width, height) ? null : SHOWCASE_SIZE_ERROR;
  } catch {
    return "The image dimensions could not be read.";
  }
}
