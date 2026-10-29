import Link from "next/link";
import { getSiteSettings } from "@/lib/site-settings";
import SignupForm from "./signup-form";

export default async function SignupPage() {
  const settings = await getSiteSettings();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-white">
      <section className="w-full max-w-md space-y-6 rounded-xl border border-slate-700 bg-slate-900 p-6">
        <Link
          className="inline-flex min-h-11 items-center text-sm font-semibold text-amber-300 hover:underline"
          href="/"
        >
          ← Home
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">Create your account</h1>
          <p className="mt-2 text-sm text-slate-300">
            Choose a username and password to join Draft League.
          </p>
          <p className="mt-2 text-sm text-slate-300">
            New accounts start with {settings.initialPlayerCoins.toLocaleString()} coins in their
            personal wallet.
          </p>
        </div>
        <SignupForm />
        <p className="text-center text-sm text-slate-300">
          Already have an account?{" "}
          <Link className="font-semibold text-amber-300 hover:underline" href="/login">
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
