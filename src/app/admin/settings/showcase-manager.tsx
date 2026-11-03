"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  SHOWCASE_RECOMMENDED,
  SHOWCASE_SIZE_ERROR,
  isValidShowcaseSize,
} from "@/lib/showcase";

type Slide = { id: string; imageUrl: string; linkUrl: string | null; visible: boolean };

const MAX_BYTES = 2 * 1024 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

function readDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

async function adminAction(payload: Record<string, unknown>) {
  const response = await fetch("/api/admin", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  const result = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(result.error ?? "The request failed. Please try again.");
}

export function ShowcaseManager({ slides }: { slides: Slide[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rowError, setRowError] = useState("");

  async function onFileChange(selected: File | undefined) {
    setError("");
    setFile(null);
    if (!selected) return;
    if (!TYPES.includes(selected.type)) {
      setError("Choose a PNG, JPG, WebP or GIF image.");
      return;
    }
    if (selected.size > MAX_BYTES) {
      setError("Images must be 2 MB or smaller.");
      return;
    }
    const size = await readDimensions(selected);
    if (!size || !isValidShowcaseSize(size.width, size.height)) {
      setError(
        size
          ? `${SHOWCASE_SIZE_ERROR} This image is ${size.width}×${size.height} px.`
          : "The image could not be read.",
      );
      return;
    }
    setFile(selected);
  }

  async function addSlide() {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const data = new FormData();
      data.append("file", file);
      data.append("purpose", "showcase");
      const upload = await fetch("/api/admin/upload", { method: "POST", body: data });
      const uploaded = (await upload.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!upload.ok || !uploaded.url) {
        throw new Error(uploaded.error ?? "The image could not be uploaded. Please try again.");
      }
      await adminAction({ action: "addShowcaseSlide", imageUrl: uploaded.url, linkUrl });
      setFile(null);
      setLinkUrl("");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The slide could not be added.");
    } finally {
      setBusy(false);
    }
  }

  async function run(payload: Record<string, unknown>) {
    setBusy(true);
    setRowError("");
    try {
      await adminAction(payload);
      router.refresh();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "The request failed.");
    } finally {
      setBusy(false);
    }
  }

  const buttonClass =
    "rounded-lg border border-[#243775] px-3 py-1.5 text-xs font-semibold transition hover:border-[#F5C542] disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <section className="mt-6 rounded-2xl border border-[#243775] bg-[#0C1638] p-5 sm:p-7" aria-busy={busy}>
      <h2 className="text-xl font-extrabold tracking-tight">Showcase</h2>
      <p className="mt-1 text-sm text-[#9FB0E6]">Slides shown in the member showcase on the homepage.</p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-sm text-[#9FB0E6]">Slide image</span>
          <input
            ref={fileRef}
            type="file"
            accept={TYPES.join(",")}
            disabled={busy}
            onChange={(event) => void onFileChange(event.currentTarget.files?.[0])}
            className="block w-full cursor-pointer rounded-lg border border-[#243775] bg-[#070D24] p-3 text-sm text-[#9FB0E6] file:mr-4 file:rounded-md file:border-0 file:bg-[#F5C542] file:px-3 file:py-2 file:font-bold file:text-[#070D24] disabled:opacity-60"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm text-[#9FB0E6]">Link (optional)</span>
          <input
            type="url"
            value={linkUrl}
            onChange={(event) => setLinkUrl(event.target.value)}
            placeholder="https://example.com"
            maxLength={2048}
            className="block w-full rounded-lg border border-[#243775] bg-[#070D24] p-3 text-sm text-[#EEF2FF]"
          />
        </label>
      </div>
      <p className="mt-2 text-xs text-[#9FB0E6]">{SHOWCASE_RECOMMENDED}</p>
      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={addSlide}
        disabled={!file || busy}
        className="mt-4 rounded-lg bg-[#F5C542] px-4 py-2 text-sm font-bold text-[#070D24] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy && file ? "Adding…" : "Add slide"}
      </button>

      {rowError && (
        <p role="alert" className="mt-4 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {rowError}
        </p>
      )}

      <ul className="mt-6 space-y-3">
        {busy && file && (
          <li className="aspect-[6/1] animate-pulse rounded-xl border border-[#243775] bg-[#070D24]" aria-hidden="true" />
        )}
        {slides.length === 0 && <li className="text-sm text-[#9FB0E6]">No slides yet.</li>}
        {slides.map((slide, index) => (
          <li key={slide.id} className="rounded-xl border border-[#243775] bg-[#070D24] p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slide.imageUrl}
              alt={`Showcase slide ${index + 1}`}
              className={`aspect-[6/1] w-full rounded-lg object-cover ${slide.visible ? "" : "opacity-40"}`}
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-[#9FB0E6]">
                #{index + 1} · {slide.visible ? "Visible" : "Hidden"}
                {slide.linkUrl ? ` · ${slide.linkUrl}` : ""}
              </span>
              <span className="flex-1" />
              <button type="button" className={buttonClass} disabled={busy || index === 0}
                aria-label={`Move slide ${index + 1} up`}
                onClick={() => run({ action: "moveShowcaseSlide", id: slide.id, direction: "up" })}>
                Up
              </button>
              <button type="button" className={buttonClass} disabled={busy || index === slides.length - 1}
                aria-label={`Move slide ${index + 1} down`}
                onClick={() => run({ action: "moveShowcaseSlide", id: slide.id, direction: "down" })}>
                Down
              </button>
              <button type="button" className={buttonClass} disabled={busy}
                onClick={() => run({ action: "setShowcaseSlideVisible", id: slide.id, visible: !slide.visible })}>
                {slide.visible ? "Hide" : "Show"}
              </button>
              <button type="button" className={`${buttonClass} text-red-300`} disabled={busy}
                onClick={() => {
                  if (window.confirm("Delete this slide? This cannot be undone.")) {
                    void run({ action: "deleteShowcaseSlide", id: slide.id });
                  }
                }}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
