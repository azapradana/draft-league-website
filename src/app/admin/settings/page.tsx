import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSiteSettings } from "@/lib/site-settings";
import { SiteSettingsForm } from "./site-settings-form";

export default async function AdminSettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }
  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  const settings = await getSiteSettings();

  return (
    <main className="min-h-screen bg-[#070D24] px-5 py-8 text-[#EEF2FF] sm:px-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F5C542]">
              Admin · Site settings
            </p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Branding &amp; customization
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#9FB0E6]">
              Shape the first impression of your league. Updates are reflected across the
              homepage and browser tab.
            </p>
          </div>
          <Link
            href="/admin"
            className="rounded-lg border border-[#243775] px-4 py-2 text-sm font-semibold transition hover:border-[#F5C542]"
          >
            Back to admin
          </Link>
        </div>

        <SiteSettingsForm settings={settings} />
      </div>
    </main>
  );
}
