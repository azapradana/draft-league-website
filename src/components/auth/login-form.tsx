"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleCredentialsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const result = await signIn("credentials", {
        identifier,
        password,
        callbackUrl: "/",
        redirect: false,
      });

      if (!result || result.error || !result.ok) {
        setError("Sign-in failed. Check your username or email and password.");
        return;
      }

      router.push(result.url ?? "/");
      router.refresh();
    } catch {
      setError("Sign-in could not be completed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="w-full max-w-md space-y-6 rounded-xl border border-slate-700 bg-slate-900 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-slate-300">
          Use your username or email and password.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleCredentialsSubmit}>
        <label className="block space-y-2 text-sm">
          <span>Username or email</span>
          <input
            autoComplete="username"
            className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-white focus:border-amber-400 focus:outline-none"
            onChange={(event) => setIdentifier(event.target.value)}
            required
            value={identifier}
          />
        </label>
        <label className="block space-y-2 text-sm">
          <span>Password</span>
          <input
            autoComplete="current-password"
            className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-white focus:border-amber-400 focus:outline-none"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>
        {error && (
          <p className="text-sm text-rose-300" role="alert">
            {error}
          </p>
        )}
        <button
          className="w-full rounded-md bg-amber-400 px-4 py-2 font-semibold text-slate-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Signing in…" : "Sign in"}
        </button>
      </form>

      {googleEnabled && (
        <button
          className="w-full rounded-md border border-slate-600 px-4 py-2 font-semibold hover:bg-slate-800"
          onClick={() => signIn("google", { callbackUrl: "/" })}
          type="button"
        >
          Continue with Google
        </button>
      )}
      <p className="text-center text-sm text-slate-300">
        New to Draft League?{" "}
        <Link className="font-semibold text-amber-300 hover:underline" href="/signup">
          Create an account
        </Link>
      </p>
    </section>
  );
}
