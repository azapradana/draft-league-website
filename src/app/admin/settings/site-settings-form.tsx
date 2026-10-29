"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ImageUpload } from "@/components/ImageUpload";

type SettingsValues = {
  siteTitle: string;
  heroHeadline: string;
  heroSubheading: string;
  heroBackgroundImage: string | null;
  faviconUrl: string | null;
  siteLogoUrl: string | null;
  accentColor: string;
};

type UploadKey = "heroBackgroundImage" | "faviconUrl" | "siteLogoUrl";

export function SiteSettingsForm({ settings }: { settings: SettingsValues }) {
  const router = useRouter();
  const [accentColor, setAccentColor] = useState(settings.accentColor);
  const [uploading, setUploading] = useState<Record<UploadKey, boolean>>({
    heroBackgroundImage: false,
    faviconUrl: false,
    siteLogoUrl: false,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const hasUploadsInProgress = Object.values(uploading).some(Boolean);

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (hasUploadsInProgress) {
      setError("Wait for all image uploads to finish before saving.");
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData(event.currentTarget);
      formData.set("action", "updateSiteSettings");
      const response = await fetch("/api/admin", {
        method: "POST",
        headers: { Accept: "application/json" },
        body: formData,
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(result.error ?? "Your site settings could not be saved.");
        return;
      }

      setMessage("Branding saved. Your website is up to date.");
      router.refresh();
    } catch {
      setError("Your site settings could not be saved. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  function onUploadChange(key: UploadKey, isUploading: boolean) {
    setUploading((current) => ({ ...current, [key]: isUploading }));
  }

  return (
    <form
      onSubmit={saveSettings}
      className="space-y-6"
      aria-busy={saving || hasUploadsInProgress}
    >
      <section className="rounded-2xl border border-[#243775] bg-[#0C1638] p-5 sm:p-7">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#F5C542]">
            Identity
          </p>
          <h2 className="mt-1 text-xl font-bold">Platform branding</h2>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[#B9C5E8]">
              Platform title
            </span>
            <input
              name="siteTitle"
              required
              maxLength={80}
              defaultValue={settings.siteTitle}
              className="w-full rounded-xl border border-[#243775] bg-[#070D24] px-4 py-3 text-sm outline-none transition focus:border-[#F5C542]"
            />
            <span className="mt-1.5 block text-xs text-[#7181B3]">
              Appears in navigation and the browser title.
            </span>
          </label>

          <div>
            <ImageUpload
              name="siteLogoUrl"
              label="Site logo"
              initialUrl={settings.siteLogoUrl}
              onUploadingChange={(value) => onUploadChange("siteLogoUrl", value)}
            />
          </div>

          <div>
            <ImageUpload
              name="faviconUrl"
              label="Browser favicon"
              initialUrl={settings.faviconUrl}
              onUploadingChange={(value) => onUploadChange("faviconUrl", value)}
            />
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[#B9C5E8]">
              Accent color
            </span>
            <div className="flex items-center gap-3 rounded-xl border border-[#243775] bg-[#070D24] p-2.5">
              <input
                type="color"
                name="accentColor"
                value={accentColor}
                onChange={(event) => setAccentColor(event.currentTarget.value)}
                aria-label="Choose platform accent color"
                className="h-9 w-12 cursor-pointer rounded border-0 bg-transparent"
              />
              <span className="text-sm text-[#9FB0E6]">{accentColor}</span>
            </div>
            <span className="mt-1.5 block text-xs text-[#7181B3]">
              Used for calls to action and branded highlights.
            </span>
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-[#243775] bg-[#0C1638] p-5 sm:p-7">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#F5C542]">
            Homepage
          </p>
          <h2 className="mt-1 text-xl font-bold">Hero content</h2>
        </div>

        <div className="grid gap-5">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[#B9C5E8]">
              Hero headline
            </span>
            <input
              name="heroHeadline"
              required
              maxLength={160}
              defaultValue={settings.heroHeadline}
              className="w-full rounded-xl border border-[#243775] bg-[#070D24] px-4 py-3 text-sm outline-none transition focus:border-[#F5C542]"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[#B9C5E8]">
              Hero subheading
            </span>
            <textarea
              name="heroSubheading"
              required
              maxLength={300}
              rows={3}
              defaultValue={settings.heroSubheading}
              className="w-full resize-y rounded-xl border border-[#243775] bg-[#070D24] px-4 py-3 text-sm leading-6 outline-none transition focus:border-[#F5C542]"
            />
          </label>

          <ImageUpload
            name="heroBackgroundImage"
            label="Hero background image"
            initialUrl={settings.heroBackgroundImage}
            onUploadingChange={(value) => onUploadChange("heroBackgroundImage", value)}
          />
        </div>
      </section>

      <div className="flex flex-col-reverse items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div aria-live="polite">
          {error && <p role="alert" className="text-sm font-medium text-red-300">{error}</p>}
          {message && <p className="text-sm font-medium text-emerald-300">{message}</p>}
          {hasUploadsInProgress && (
            <p className="text-sm text-[#9FB0E6]">Wait for image uploads to finish before saving.</p>
          )}
        </div>
        <button
          type="submit"
          disabled={saving || hasUploadsInProgress}
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#F5C542] px-6 py-3 text-sm font-extrabold text-[#070D24] transition hover:bg-[#D9A21B] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving changes…" : "Save branding"}
        </button>
      </div>
    </form>
  );
}
