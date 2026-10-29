"use client";

import { useEffect, useState } from "react";

const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/x-icon",
  "image/vnd.microsoft.icon",
];

type ImageUploadProps = {
  name: string;
  label: string;
  initialUrl?: string | null;
  onUploadingChange?: (uploading: boolean) => void;
};

type UploadResponse = {
  error?: string;
  url?: string;
};

export function ImageUpload({
  name,
  label,
  initialUrl = null,
  onUploadingChange,
}: ImageUploadProps) {
  const [imageUrl, setImageUrl] = useState(initialUrl ?? "");
  const [previewUrl, setPreviewUrl] = useState(initialUrl ?? "");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(
    () => () => {
      if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  function uploadImage(file: File) {
    setError("");

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setError("Choose a PNG, JPG, WebP, GIF, or ICO image.");
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setError("Images must be 2 MB or smaller.");
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    setUploading(true);
    onUploadingChange?.(true);
    setProgress(0);

    const data = new FormData();
    data.append("file", file);

    const request = new XMLHttpRequest();
    request.open("POST", "/api/admin/upload");
    request.responseType = "json";
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        setProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    request.onload = () => {
      const result = request.response as UploadResponse | null;
      if (request.status < 200 || request.status >= 300 || !result?.url) {
        setError(result?.error ?? "The image could not be uploaded. Please try again.");
        setPreviewUrl(imageUrl);
        setUploading(false);
        onUploadingChange?.(false);
        return;
      }

      setImageUrl(result.url);
      setPreviewUrl(result.url);
      setProgress(100);
      setUploading(false);
      onUploadingChange?.(false);
    };
    request.onerror = () => {
      setError("The image could not be uploaded. Check your connection and try again.");
      setPreviewUrl(imageUrl);
      setUploading(false);
      onUploadingChange?.(false);
    };
    request.send(data);
  }

  function clearImage() {
    setImageUrl("");
    setPreviewUrl("");
    setError("");
  }

  return (
    <div>
      <input type="hidden" name={name} value={imageUrl} />
      <label className="block">
        <span className="mb-2 block text-sm text-[#9FB0E6]">{label}</span>
        <input
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          disabled={uploading}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) uploadImage(file);
            event.currentTarget.value = "";
          }}
          className="block w-full cursor-pointer rounded-lg border border-[#243775] bg-[#070D24] p-3 text-sm text-[#9FB0E6] file:mr-4 file:rounded-md file:border-0 file:bg-[#F5C542] file:px-3 file:py-2 file:font-bold file:text-[#070D24] disabled:cursor-wait disabled:opacity-60"
        />
      </label>
      <p className="mt-2 text-xs text-[#9FB0E6]">PNG, JPG, WebP, GIF, or ICO · maximum 2 MB</p>

      {previewUrl && (
        <div className="mt-4 flex items-start gap-4">
          <div className="relative h-28 w-40 overflow-hidden rounded-lg border border-[#243775] bg-[#070D24]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt={`${label} preview`} className="h-full w-full object-cover" />
            {uploading && (
              <span className="absolute inset-0 flex items-center justify-center bg-[#070D24]/75 text-sm font-semibold text-[#F5C542]">
                Uploading {progress}%
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={clearImage}
            disabled={uploading}
            className="rounded-lg border border-[#243775] px-3 py-2 text-sm font-semibold text-[#9FB0E6] hover:border-[#F5C542] hover:text-[#EEF2FF] disabled:opacity-50"
          >
            Remove image
          </button>
        </div>
      )}

      {uploading && (
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#243775]"
          role="progressbar"
          aria-label="Image upload progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <div
            className="h-full bg-[#F5C542] transition-[width]"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}
    </div>
  );
}
