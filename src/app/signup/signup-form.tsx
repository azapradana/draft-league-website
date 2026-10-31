"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function SignupForm({
  googleEnabled,
  inviteToken,
  inviteTournamentId,
}: {
  googleEnabled: boolean;
  inviteToken?: string;
  inviteTournamentId?: string;
}) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, inviteToken }),
      });
      const result = (await response.json()) as { error?: string; tournamentId?: string };

      if (!response.ok) {
        setError(result.error ?? "Account creation failed. Please try again.");
        return;
      }

      const callbackUrl = inviteTournamentId
        ? `/t/${encodeURIComponent(inviteTournamentId)}`
        : "/";
      const signInResult = await signIn("credentials", {
        identifier: username,
        password,
        callbackUrl,
        redirect: false,
      });

      if (!signInResult?.ok || signInResult.error) {
        router.push("/login");
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("Account creation could not be completed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <label className="block space-y-2 text-sm">
        <span>Username</span>
        <input
          autoComplete="username"
          className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-white focus:border-amber-400 focus:outline-none"
          maxLength={20}
          minLength={3}
          onChange={(event) => setUsername(event.target.value)}
          pattern="[a-z0-9_]{3,20}"
          required
          title="Use 3–20 lowercase letters, numbers, or underscores."
          value={username}
        />
        <span className="block text-xs text-slate-400">
          3–20 lowercase letters, numbers, or underscores.
        </span>
      </label>
      <label className="block space-y-2 text-sm">
        <span>Password</span>
        <input
          autoComplete="new-password"
          className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-white focus:border-amber-400 focus:outline-none"
          minLength={8}
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
        <span className="block text-xs text-slate-400">
          Use at least 8 characters.
        </span>
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
        {isSubmitting ? "Creating account…" : "Create account"}
      </button>
      {googleEnabled && !inviteToken && (
        <button
          className="w-full rounded-md border border-slate-600 px-4 py-2 font-semibold hover:bg-slate-800"
          onClick={() => signIn("google", { callbackUrl: "/" })}
          type="button"
        >
          Sign up with Google
        </button>
      )}
      <Link
        className="block text-center text-sm text-slate-300 hover:text-white"
        href="/login"
      >
        Back to sign in
      </Link>
    </form>
  );
}
